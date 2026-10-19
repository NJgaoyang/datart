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