# Phase 5.4-B3：Database Schema Cleanup

## 最终审计结论

本项目当前不存在物理数据库列 `is_display_name_custom`：

- `view_field` 表只有 canonical metadata：`origin_name`、`source_comment`、`custom_name`、`source_path` 等。
- `ViewField` entity、Mapper 和 SQL 均未映射 `isDisplayNameCustom`。
- `isDisplayNameCustom` 只存在于 View.model / Chart 配置 JSON，以及 V1/COMPAT 的导入升级代码。
- `displayName` 和 `comment` 也不是 `view_field` 的数据库列；正式存储使用 `custom_name` 和 `source_comment`。

因此本阶段没有可安全执行的 `DROP COLUMN`，也不新增空操作 Flyway migration。新增 schema contract test 锁定当前结构，防止未来误把旧 JSON metadata 加回 canonical 表。

## 保留边界

- V1 Import / Upgrade 继续读取旧 JSON 中的 `isDisplayNameCustom`。
- View.model 中的旧 JSON 字段继续由兼容迁移链路处理。
- `view_field.custom_name` 保留用户自定义显示名。
- `view_field.source_comment` 保留字段注释来源。
- 不执行数据库列删除，不影响旧库升级和全新库初始化。

## 验收

- `DatabaseSchemaContractTest` 验证 `source_comment`、`custom_name`、`origin_name` 存在。
- 同一测试验证 `is_display_name_custom`、`display_name`、`comment` 不存在于 canonical `view_field` DDL。
- V1 import、V2 export、Readiness 和 STRICT/COMPAT 回归继续使用既有测试验证。
