# 旧报表模板独立升级

前端运行时只读取当前配置，不再自动执行 alpha、beta、RC 历史转换。
已存在且结构为当前格式的数据库报表可以直接读取，不会在打开时改写版本、样式或坐标。

要求 Node 22.12+，先在 frontend 目录安装项目依赖。转换 `.viz` 或解压后的 JSON 模板：

```sh
cd frontend
node scripts/upgrade-legacy-template.mjs --input /path/old.viz --output /path/upgraded.viz
```

早期 Java 二进制 `.viz` 还需要当前后端安装目录和运行后端所用的 JDK：

```sh
node scripts/upgrade-legacy-template.mjs --input /path/old.viz --output /path/upgraded.viz --server-dir /opt/datart
```

工具独立运行，不连接数据库、不调用在线接口、不覆盖原文件，也拒绝覆盖已经存在的输出文件。
支持仪表板模板和图表模板；保留资源 ID、内嵌数据、关联和附件，历史配置通过原有转换器升级。
输出仍是原来的 gzip `.viz` 或 JSON 格式，通过原来的“模板导入”入口导入转换后的文件。
不支持组织包或完整资源迁移包；这些包继续使用产品中的资源迁移流程。

自动布局坐标保持原值。如需从旧网格升级坐标，先将 JSON 模板交给仓库已有的
`tools/grid-layout-migration.mjs` 预览和转换，再导入；有重叠或缺少位置时应先核对布局。
工具沿用历史转换规则：容器边框、内边距及查询按钮颜色会采用当前默认样式。
数据库中的历史格式资源需要先导出、转换、验证后再迁移；不要直接批量修改数据库 JSON。

验证：

```sh
npm run check:upgrade-baseline
npx vitest run scripts/legacy-upgrade
node --test scripts/__tests__/upgrade-legacy-template.test.mjs
```

## 独立网页：直接连接数据库

不必先导出模板，可以单独启动数据库升级网页。它不需要启动 Datart 服务，但需要本项目依赖、后端安装目录中的 JDBC/Jackson 库，以及与该后端兼容的 JDK。

```sh
cd /root/datart/frontend
node scripts/start-database-upgrade.mjs --server-dir /opt/datart_dev20261020 --port 8099
```

浏览器打开 `http://127.0.0.1:8099`，依次操作：

1. 填写 **Datart 元数据库** 的 MySQL 地址、端口、数据库名、账号和密码。不要填写报表连接的业务数据库。支持 MySQL，以及使用 MySQL 协议的 MariaDB；TLS 默认启用，没有配置 TLS 的本机测试数据库可取消勾选。
2. 连接成功后选择组织，点击“检查报表配置”。只检查该组织的仪表板、图表和组件，新版配置不会被重复升级。
3. 展开条目检查升级前后的配置。有损坏配置或不支持的版本时，整批升级会被阻止。
4. 如果只需要备份，在“备份与回滚”点击“立即备份”，无需检查或升级。工具只读取所选组织的全部仪表板、组件和图表配置，保存到服务器备份目录，并显示文件路径。手动备份不是整库备份，仅离线保存配置，不支持在线回滚；升级备份仍支持下述回滚流程。
5. 核对预览并暂停编辑这些报表后，勾选确认，点击“备份并升级”。工具先保存备份，再在同一个数据库事务中更新配置。预览后数据发生变化时拒绝写入；任一更新失败则整批取消。
6. 需要恢复时选择升级备份，点击“预览回滚”，核对后勾选确认并执行。升级后又被编辑的配置不会被回滚覆盖。

升级和回滚后刷新 Datart 报表，无需重启 Datart 后端。工具只更新 `dashboard.config`、`widget.config` 和 `datachart.config`；保留创建时间和修改时间，不会重排布局，不修改账号、权限、业务数据或数据视图 SQL，也不升级表结构、字段元数据或组织迁移包。字段元数据仍使用项目已有的迁移流程。

每个打开的工具页面拥有独立连接会话；其他页面不会继承已经填写的数据库账号。会话闲置一小时后需要重新连接。连接信息只保存在内存里，不保存在浏览器缓存或备份文件里。默认备份目录是启动用户的 `~/.datart-upgrade/backups`，可通过 `--backup-dir /安全目录` 指定；目录权限为仅当前用户访问，新备份文件权限为 `600`。备份包含报表配置，需妥善保存，不要手动编辑。备份保留原始配置与目标配置，并带完整性校验，可在工具重启、使用相同地址、端口和数据库名重新连接后继续使用。

网页仅监听本机回环地址，并校验请求来源。工具没有独立账号系统，应仅由获授权的数据库维护人员使用；能检查哪些数据库、能否执行升级由所填数据库账号的权限决定。只读账号可以检查，但无法升级。不要把端口直接代理到公共网络。

在远程服务器运行时，可以在自己的电脑上转发端口，再用本机浏览器打开：

```sh
ssh -N -L 8099:127.0.0.1:8099 用户名@服务器地址
```

停止工具：在启动它的终端按 `Ctrl+C`。关闭工具会清除内存中的连接信息，但保留备份。

验证数据库网页与真实数据库事务：

```sh
node --test scripts/__tests__/database-upgrade-web.test.mjs
npx vitest run scripts/legacy-upgrade/__tests__/databasePlan.test.ts
DATART_TEST_MYSQL_CONFIG=/安全路径/测试连接.json DATART_TEST_SERVER_DIR=/opt/datart \
  node --test scripts/__tests__/database-upgrade-mysql.test.mjs
```

真实数据库测试连接文件格式为 `{"host":"127.0.0.1","port":3306,"database":"datart","username":"测试账号","password":"测试密码","tls":false}`。测试只创建和删除随机命名的 `datart_upgrade_test_*` 独立测试库，不会升级连接文件中原数据库的数据；测试账号需要创建和删除测试库的权限。
