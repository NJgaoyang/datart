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