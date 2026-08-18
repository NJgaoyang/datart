# MySQL / StarRocks 部署后真实回归

本回归用于确认部署后的真实数据源行为，不会在日常构建中自动连接生产数据库。

## 1. 构建与服务确认

- 确认前端静态资源和后端包来自同一次构建。
- 启动后登录管理员账号，打开数据源详情，确认“连接池运行状态”能看到活跃连接、空闲连接、连接上限、等待线程和查询超时。
- 执行一次普通查询，再刷新该页面，确认“查询摘要”出现 `RUNNING` 后变为 `SUCCESS` 或 `ERROR`。摘要只包含 SHA-256 指纹，不展示 SQL 明文。
- 查询完成后，摘要会异步写入 `datart_query_trace`；数据库异常时仍显示当前实例内存摘要，不影响查询。
- 追踪表默认保留 30 天，每写入约 100 条摘要清理一次过期数据；可通过 `datart.query-trace.retention-days` 调整，最小按 1 天处理。

## 2. MySQL 慢查询取消与超时

测试环境执行：

```bash
DATART_MYSQL_JDBC_URL='jdbc:mysql://mysql-host:3306/test' \
DATART_MYSQL_JDBC_USER='user' \
DATART_MYSQL_JDBC_PASSWORD='password' \
mvn -pl data-providers/jdbc-data-provider -am \
  -Dtest=MySqlIntegrationTest \
  -DfailIfNoTests=false -Dsurefire.failIfNoSpecifiedTests=false test
```

同时在页面验证：启动一个确实较慢的交互式查询，点击取消；该查询应结束，其他用户查询和后台任务不受影响。

## 3. StarRocks 函数与日期回归

```bash
DATART_STARROCKS_JDBC_URL='jdbc:mysql://starrocks-fe:9030/test' \
DATART_STARROCKS_JDBC_USER='user' \
DATART_STARROCKS_JDBC_PASSWORD='password' \
mvn -pl data-providers/jdbc-data-provider -am \
  -Dtest=StarRocksIntegrationTest \
  -DfailIfNoTests=false -Dsurefire.failIfNoSpecifiedTests=false test
```

重点确认：

- `PERCENTILE_APPROX(value, 0.5)`；
- `PERCENTILE_APPROX(value, 0.5, 10000)`；
- DATETIME 字段的小时、分钟、秒；
- `TIME_SLICE`；
- CTE、UNION 原始 SQL 分页；
- 编辑页和查看页的日期下钻结果一致。

## 4. 后台任务边界

定时任务、异步下载和同步下载都会清除交互式 `queryId`，因此不会被页面上的“取消查询”误取消。它们仍受数据源 JDBC 查询超时保护；如需停止后台任务，应使用任务自身的停止或失败处理，不调用交互式取消接口。

## 5. 失败判定

- 连接池状态无法读取：检查数据源是否实际初始化、管理员权限和服务日志。
- 查询摘要只有 `RUNNING`：检查连接池等待、数据库锁和 JDBC 驱动超时。
- 取消返回失败：确认是当前用户发起的交互式查询，并且查询仍在执行。
- 日期下钻失败：检查字段是否为 DATETIME；DATE 字段不应出现小时、分钟、秒选项。
- 查询摘要丢失：检查 `datart_query_trace` 表是否创建成功，以及服务实例是否使用同一个元数据库。
