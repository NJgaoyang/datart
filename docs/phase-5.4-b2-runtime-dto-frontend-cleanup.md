# Phase 5.4-B2：Runtime / DTO / Frontend Legacy Metadata Cleanup

## 处理边界

本阶段清理 canonical runtime 对旧字段标记的依赖，但不删除数据库列，也不删除 V1 导入升级能力。

| Metadata | Canonical runtime | V1 / COMPAT | V2 Export |
| --- | --- | --- | --- |
| `ViewField.displayName` | 保留，作为数据集字段展示名 | 可从旧 model 升级 | 保留有效的自定义值 |
| `ViewField.sourceComment` / `comment` | 保留，作为注释来源 | 保留旧输入兼容 | 保留 |
| `isDisplayNameCustom` | 不进入 canonical ViewField DTO，也不从 canonical ViewField 元数据重新生成 | 仅用于读取、升级和兼容旧 Chart/View model | 不输出 |

## 本批实现

- `ViewFieldDTO` 只暴露 canonical 字段，不暴露 `comment` 或 `isDisplayNameCustom`。
- 前端拿到正式 `ViewFieldMeta` 后，不再把 `isDisplayNameCustom` 复制到 canonical chart metadata 或拖拽项。
- 日期层级运行时元数据只继承 canonical `displayName` 和 `comment`，不再生成旧标记。
- 没有正式 `ViewField` 的旧 model/chart 数据仍保留旧标记读取逻辑，供 V1 Reader 和 COMPAT fallback 使用。
- `ViewModelMigrator`、`FieldMetaResolver`、导入升级链路保留，不能当作 canonical runtime reader 删除。

## 回归约束

- 自定义 `displayName` 仍然显示并可被拖拽、图表配置和导出消费。
- `comment` 仍然参与兼容展示和字段元数据解析。
- 无可信中文来源时仍回退到原字段名。
- V1 输入仍可升级，V2 输出不再带 `isDisplayNameCustom`。
- 数据库旧列本阶段不删除。
