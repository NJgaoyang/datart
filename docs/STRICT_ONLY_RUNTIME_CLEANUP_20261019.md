# STRICT-only 运行时清理（2026-10-19）

生产组织据用户确认已经完成历史字段元数据迁移并启用 STRICT。后续不再提供“迁移就绪度”页面、COMPAT 默认回退、COMPAT 模式切换接口。

本次移除 ReadinessPage、管理导航/路由、后端 ReadinessController（/admin/readiness/scan、/strict-status、/mode）及旧切换 DTO；仅保留内部 ReadinessScanner/ReadinessService.scan 给仍存在的归档迁移内部模块使用。资源导入/导出是独立功能，不随本次界面一同删除。

运行时 MigrationModeServiceImpl.getMode 遇到非 STRICT（包括 COMPAT 和 NULL）明确失败；View 详情强制 STRICT；实际查询继续通过严格 fieldId 验证。新建 Organization 的 Java 默认模式改为 STRICT。新 Flyway V7 仅调整数据库 migration_mode 列的 DEFAULT 为 STRICT，不修改已有行和已执行 V1～V6 文件。

## 上线门槛

复核各环境的迁移状态：

    SELECT COALESCE(migration_mode, 'NULL') AS mode, COUNT(*) AS org_count
    FROM organization GROUP BY migration_mode;

**开发机经重新只读核对：1 个组织为 STRICT，0 个 COMPAT**（2026-10-19）。用户表示已完成切换。部署时仍需检查启动、登录、分享和查询；生产库不在本次作业范围内。

## 回归重点

MigrationModeServiceImplTest 测试 STRICT、COMPAT、NULL 与新实体默认值；MigrationRuntimeVerificationTest 验证历史导入夹具仅用于归档迁移，业务运行仅 STRICT；保留 MetadataUpgradeServiceImplTest、ViewResourceRoundTripTest、ShareSupportedFunctionSecurityTest 等定向回归。前端 TypeScript 和多入口构建需通过。CI 通过不免除数据库门槛。

资源导入旧版协议、归档迁移扫描及数据库审计表属于另一个精简阶段，本次不重写 Flyway 历史、不删除业务数据。
## 运行时强制 STRICT 补强与翻译文件修复

- 普通/分享图表查询在访问 SQL 前始终读取并校验组织 STRICT 状态，随后总是执行 `StrictRuntimeValidator` 字段引用校验，不再通过 `isStrict` 选择跳过校验。
- 仪表板加载始终拒绝缺失的 Datachart 或 View 关联，而不是仅在一个分支里拒绝。
- 图表导入不再按列名匹配、补写缺失的 `fieldId`。使用 `ChartConfigReconciler.validateStrict` 验证已迁移字段 ID；缺失/无效/停用字段及损坏的配置均拒绝，不允许 COMPAT 静默成功。
- 后端增加 `DatachartStrictOnlyImportTest`，并与 `MigrationModeServiceImplTest`、`MigrationRuntimeVerificationTest`、`DashboardServiceImplTest` 一起纳入定向回归。
- 修复首次 STRICT UI 清理时被误截断的 `src/locales/en/translation.json` 与 `zh/translation.json`：恢复所有正常 BI 页面翻译，只移除退休的就绪度导航文案，确保 JSON 有效并可生产构建。
- 离线迁移工具/既有历史数据库版本仍用于审计与恢复，不作为线上 COMPAT 模式运行。**不删除真实数据、不重写已执行 Flyway 历史版本**；遗留资源归档格式兼容属于后续单独评估范围。

## 2026-10-19：前端 COMPAT 拒绝及开发机发布验收

- ChartDataRequestBuilder 明确拒绝显式 migrationMode=COMPAT，旧兼容测试改为拒绝测试；STRICT 计算字段、日期层级保持既有处理。提交 2d93331cb4b10df93c920c22bf3e7612b14d880c，Actions 39191405806 成功。
- 在独立目录精确同步 GitHub 28 项变更并逐项校验 Git blob SHA，原 /root/datart 工作区没有 reset。TypeScript、87 项专项测试、COMPAT 拒绝测试、生产构建、体积检查和发布前 Chromium 冒烟通过。
- 开发机数据库发布前后验证唯一组织为 STRICT；数据库 migration_mode 新建组织默认 STRICT。发布前已备份旧静态文件、服务端 JAR 和 organization 表。
- 部署 app.78f04363.js 后，登录 HTTP 200；静态缓存、gzip、Chromium 登录及分享入口 2/2 通过；真实公开分享移动/桌面 3/3 通过，另 1 项无表格而跳过。
- 新构建 JAR 缺少运行时 javascript/parser.js、javascript/task/parser.js，已从原可用 JAR 中校验 SHA256 并保留。解析器不是 COMPAT 迁移逻辑；后续应完善干净环境生成/打包步骤。
- 旧 ReadinessController class 已从发布 JAR 移除。内部 ReadinessScanner 仍被历史归档升级服务依赖，删除它必须先完成依赖清理及 Java 编译验证；历史 V1-V7 数据库结构迁移保持不变。
