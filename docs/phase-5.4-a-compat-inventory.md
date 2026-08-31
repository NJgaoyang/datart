# Phase 5.4-A Compatibility Inventory

本阶段只清理“运行时迁移 fallback”。V1 资源导入升级和普通产品默认值不属于清理范围。

## KEEP：资源导入与迁移

| 路径 | 用途 | 结论 |
| --- | --- | --- |
| `server/src/main/java/datart/server/common/TransferFileUtils.java` | 读取无版本/`formatVersion=1` 的资源包 | 保留，V1 reader 是资源格式兼容能力 |
| `server/src/main/java/datart/server/service/impl/ViewServiceImpl.java` | 导入/更新 View 时规范化旧 model | 保留，仅在写入 canonical View 前使用 |
| `server/src/main/java/datart/server/service/impl/ViewFieldServiceImpl.java` | reconcile 与 legacy metadata migration | 保留，属于迁移和写入 canonical ViewField |
| `server/src/main/java/datart/server/common/fieldmeta/ChartConfigReconciler.java` | 导入 Datachart 时补齐 fieldId | 保留，属于 import upgrade |
| `server/src/main/java/datart/server/service/impl/FieldMetaMigrationServiceImpl.java` | 历史字段元数据迁移 | 保留，属于显式 migration |

## KEEP：诊断能力

| 路径 | 用途 | 结论 |
| --- | --- | --- |
| `server/src/main/java/datart/server/common/readiness/ReadinessScanner.java` | 报告缺少 fieldId 的旧图表引用 | 保留；扫描只能检测，不能修改数据 |
| `server/src/main/java/datart/server/common/strict/StrictRuntimeValidator.java` | STRICT 请求入口校验 fieldId | 保留；canonical runtime 入口，不执行名称/路径猜测 |

## REVIEW：当前仍服务 COMPAT runtime

| 路径 | 用途 | 当前处理 |
| --- | --- | --- |
| `frontend/src/app/utils/internalChartHelper.ts` | 加载旧图表时按 fieldId、path、originName 重建元数据 | 已收敛：存在 fieldId 但已失效时不再按旧 path/name 重绑；无 fieldId 的 COMPAT 记录暂保留 |
| `frontend/src/app/models/ChartDataRequestBuilder.ts` | 旧图表没有 fieldId 时按字段名构造请求列 | 暂保留；需要在前端获得组织 migration mode 后再做 canonical-only 收敛 |
| `frontend/src/app/pages/DashBoardPage/utils/index.ts` | 旧控制器关联字段按名称找到路径 | 暂保留；需确认控制器资源已完成 canonical 化后再清理 |

## A2：模式感知运行时

| 路径 | 处理 |
| --- | --- |
| `server/src/main/java/datart/server/base/dto/OrganizationBaseInfo.java` | 组织列表返回 `migrationMode`，前端无需为每张图单独查询 |
| `server/src/main/java/datart/server/base/dto/ViewDetailDTO.java` | View 详情携带组织模式 |
| `server/src/main/java/datart/server/service/impl/DashboardServiceImpl.java` | Dashboard 只读取一次组织模式，并传播给全部 View |
| `frontend/src/app/models/ChartDataRequestBuilder.ts` | COMPAT 允许无 `fieldId` 旧请求；STRICT 下无 `fieldId` 直接抛出 `STRICT_FIELD_ID_REQUIRED` |

## 已确认的边界

1. `ChartConfigReconciler.reconcile(...)` 只由 import/migration 调用，不是运行时查询解析器。
2. `ReadinessScanner.resolveLegacyField(...)` 只用于诊断旧引用，不能改成运行时 resolver。
3. STRICT 下 `StrictRuntimeValidator` 只接受当前 View 中 active 的 fieldId；缺失、失效、跨 View 都必须失败。
4. 普通的 `displayName ?? name`、空列表保护、旧布局尺寸转换等产品默认行为不属于 migration fallback。

## 下一步

剩余 REVIEW 项仍明确限制在 COMPAT 旧资源路径。下一阶段进入 5.4-B，审计并清理 `displayName`、`comment`、`isDisplayNameCustom` 及 V2 Export；当前不删除 V1 reader、import upgrade、Readiness 诊断或 MigrationMode。
