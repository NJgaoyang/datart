# StarRocks 3.3.22 SQL 回归矩阵

本清单用于约束 MySQL 与 StarRocks 二开后的 SQL 兼容性。每次新增操作符或方言转换时，先补充本表和对应单元测试；连接真实 StarRocks 后再记录集成验证结果。

| 功能 | Datart 操作符 | StarRocks 生成 SQL | 单元测试 | 真实 StarRocks 验证 |
| --- | --- | --- | --- | --- |
| 加法 | `ADD` | `a + b` | 已覆盖 | 待验证 |
| 减法 | `SUBTRACT` | `a - b` | 已覆盖 | 待验证 |
| 除法 | `DIVIDE` | `a / b` | 已覆盖 | 待验证 |
| 星期几 | `DAY_OF_WEEK` | `DAYOFWEEK(ts)` | 已覆盖 | 实测通过（2026-08-17） |
| 每月第几天 | `DAY_OF_MONTH` | `DAYOFMONTH(ts)` | 已覆盖 | 待验证 |
| 每年第几天 | `DAY_OF_YEAR` | `DAYOFYEAR(ts)` | 已覆盖 | 待验证 |
| 年粒度（新建） | `AGG_DATE_YEAR_NATIVE` | `DATE_TRUNC('year', ts)` | 已覆盖 | 待验证 |
| 季度粒度（新建） | `AGG_DATE_QUARTER_NATIVE` | `DATE_TRUNC('quarter', ts)` | 已覆盖 | 待验证 |
| 月粒度（新建） | `AGG_DATE_MONTH_NATIVE` | `DATE_TRUNC('month', ts)` | 已覆盖 | 实测通过（2026-08-17） |
| 周粒度（新建） | `AGG_DATE_WEEK_NATIVE` | `DATE_TRUNC('week', ts)` | 已覆盖 | 待验证 |
| 日粒度（新建） | `AGG_DATE_DAY_NATIVE` | `DATE_TRUNC('day', ts)` | 已覆盖 | 待验证 |
| 标准差 | `STDDEV` | `STDDEV(value)` | 已覆盖 | 待验证 |
| 方差 | `VARIANCE` | `VARIANCE(value)` | 已覆盖 | 待验证 |
| 近似去重 | `APPROX_COUNT_DISTINCT` | `APPROX_COUNT_DISTINCT(id)` | 已覆盖 | 实测通过（2026-08-17） |
| 原生 SQL 分页 | 顶层 `LIMIT/OFFSET/FETCH` | 不再附加 `LIMIT` | 已覆盖 | 待验证 |

## 兼容性约束

- 已保存报表继续使用原有 `AGG_DATE_*` 表达式，不迁移也不改变其字符串结果。
- 仅新建或重新选择日期粒度的 StarRocks 字段使用 `*_NATIVE` 操作符。
- `HOUR`、`MINUTE`、`SECOND` 只对 `DATETIME` 字段开放；`TIME_SLICE` 使用 StarRocks 原生语法，并要求 StarRocks >= 2.3。
- `PERCENTILE_APPROX` 已注册为 2～3 参数函数；第三参数是可选 compression，范围由 StarRocks 校验。

## 连接测试环境执行

日常构建不会连接 StarRocks。配置测试环境后可执行下列命令：

```bash
DATART_STARROCKS_JDBC_URL='jdbc:mysql://starrocks-fe:9030/test' \
DATART_STARROCKS_JDBC_USER='user' \
DATART_STARROCKS_JDBC_PASSWORD='password' \
mvn -pl data-providers/jdbc-data-provider -am \
  -Dtest=StarRocksIntegrationTest \
  -DfailIfNoTests=false -Dsurefire.failIfNoSpecifiedTests=false test
```
