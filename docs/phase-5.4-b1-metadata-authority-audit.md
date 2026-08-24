# Phase 5.4-B1 Metadata Authority Audit

## Authority summary

| 字段 | 当前读取者 | 当前写入者 | V2 Export | 结论 |
| --- | --- | --- | --- | --- |
| `displayName` | V1 View model migration、兼容 View model、前端旧模型读取；运行时展示使用 `ViewField.displayName` | View 编辑兼容规范化、V1 import upgrade | 保留真正用户自定义值；删除与原名重复的副本 | `KEEP_CUSTOM / V1-READ` |
| `comment` | ViewField reconcile 的 SQL/STRUCT 兼容来源、V1 model migration、前端旧模型读取 | View 编辑和旧资源迁移 | 暂时保留 | `KEEP / V1-READ` |
| `isDisplayNameCustom` | View model migration、formal validation、旧前端模型 | View 编辑规范化、旧资源迁移 | V2 Export 不再输出 | `V2-READ-ONLY` |

## Canonical authority

运行时字段展示的权威链路是：

```text
ViewField.customName
    ↓
ViewField.sourceComment
    ↓
ViewField.originName
    ↓
ViewField.displayName (DTO 计算值)
```

`View.model` 中的 `displayName/comment/isDisplayNameCustom` 仍是导入和兼容迁移输入，不再是运行时字段展示的权威来源。

## B1 已完成

- V2 View resource export 删除 `isDisplayNameCustom`。
- V2 View resource export 删除非自定义且等于原名的 `displayName` 副本。
- 用户自定义 `displayName` 保留，避免导出/导入后丢失用户设置。
- `comment` 保留，避免 SQL lineage/schema 不完整时中文注释丢失。
- V1 Reader、Import Upgrade、数据库旧列均保留。

## 暂不处理

- 不删除 `View.model` 中所有 `displayName/comment`。
- 不删除 DTO、前端类型或数据库列。
- 不改变运行时 ViewField 展示规则。

下一批需要先让 V2 Import 直接消费 canonical ViewField metadata，再删除 View model 中仍可确认废弃的副本。
