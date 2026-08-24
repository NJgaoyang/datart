# Phase 6.2-M3 Real Production Backup Upgrade Rehearsal

日期：2026-08-24
结果：**BLOCKED — 未进入 M2 Apply**

## 1. 验证边界

- 仅使用生产 metadata 数据库 `datart` 的独立备份副本。
- rehearsal 数据库：`datart_rehearsal_20260824_m3`
- rehearsal 安装目录：`/opt/datart3-m3-rehearsal`
- 原 `/opt/datart3` 未修改。
- 原生产数据库未连接、未执行 Apply、未修改。
- 代码分支：`dev202608242`
- 验证代码：`0239595c52c5aa1d85787aa6ccb0ee8752cd2fd9`
- 未切换 STRICT，未重新打包，未修改 rc.5。

## 2. 数据库恢复与启动

生产备份副本恢复到独立 rehearsal 数据库后，基础资源数量为：

| 对象 | 数量 |
| --- | ---: |
| Source | 6 |
| View | 70 |
| ViewField | 0 |
| Datachart | 0 |
| Dashboard | 22 |

新 Datart 仅连接 rehearsal 数据库，应用启动成功，HTTP 服务正常。

当前 Schema Migration 已完成，`migration_history` 共 9 条记录，组织迁移模式为 `COMPAT`。`access_log.resource_name` 已存在，未重复添加。

启动日志中存在历史 `AccessLogIndexMigration` 索引创建 warning，但未阻止启动；本次没有修改该逻辑。

## 3. 管理员登录

- 管理员原账号登录：**PASS**
- 登录接口返回 HTTP 200，并返回有效授权头。
- 密码未写入报告、代码或日志。

## 4. M1 Preflight

Preflight 接口返回 HTTP 200，但结果为：

| 项目 | 结果 |
| --- | ---: |
| `applyAllowed` | `false` |
| Blockers | 1824 |
| Warnings | 58 |
| `passwordHashCovered` | `true` |
| 第一次与第二次 Preflight 校验和 | 一致 |
| 数据库副作用 | 无 |

Blocker 分布：

| Issue code | 数量 | 说明 |
| --- | ---: | --- |
| `VIEW_FIELD_MISSING` | 1650 | 70 个旧 View 尚未生成对应 ViewField |
| `VIEW_SCHEMA_REFERENCE_NOT_FOUND` | 170 | View schema 引用无法解析 |
| `MISSING_RESOURCE_PERMISSION_TARGET` | 1 | 资源权限目标无法解析 |
| `ORPHAN_MEMBERSHIP` | 1 | 组织成员关系存在孤儿记录 |
| `ORPHAN_ROLE_PERMISSION` | 1 | 角色权限关系存在孤儿记录 |
| `ORPHAN_USER_ROLE` | 1 | 用户角色关系存在孤儿记录 |

另外有 58 条 `VIEW_LEGACY_MODEL_METADATA` warning。

由于 `applyAllowed=false`，按照 M3 门禁要求立即停止，**没有执行 M2 Apply**。

## 5. Apply 与 Readiness

以下项目因 Preflight 阻断而未执行：

- M2 Apply：未执行
- After Snapshot：未生成
- Immutable checksum 前后 MATCH：不适用
- password hash checksum 前后 MATCH：不适用
- Role / Membership / Permission checksum 前后 MATCH：不适用
- Resource ID checksum 前后 MATCH：不适用
- Apply 二次执行 `NO_OP`：未执行
- Readiness 100%：未达到，不能宣称通过
- `chartFieldIdCoverage=100%`：未达到
- `resolvedChartFieldIdCoverage=100%`：未达到

Preflight 的 Before Snapshot 已保存于本次验证临时目录，整体校验和为：

`2bdcd43e711d7be22a93cd43495bcb3daf2fcbe45ce7decc9bb07c90463f4e8c`

## 6. 运行时验证范围

因 Apply 门禁未通过，本次没有继续执行会改变验证结论的资源运行时验证：

- 普通用户、高权限用户、受限权限用户的原密码登录：未执行，尚未提供这些账号的原密码；未重置密码。
- Dashboard/View/Source 权限允许与拒绝对比：未执行。
- MySQL Source、StarRocks Source、真实 View 查询：未执行。
- Datachart runtime：当前 rehearsal 数据库本身没有 Datachart，无法提供真实 fixture 验证。

## 7. 结论

本次 rehearsal 证明：

1. 生产备份可以在隔离数据库中恢复。
2. 新版本可以连接该 rehearsal 数据库并完成当前 Schema Migration。
3. 管理员可以使用原密码登录。
4. Preflight 是只读且结果可重复。
5. 当前 M1/M2 不能通过这份真实备份的升级门禁，主要缺口是 ViewField/Schema 引用重建以及历史权限关系清理或兼容判定。

因此本次结果不是“升级成功”，而是：

> **隔离环境与启动验证通过；M1 Preflight BLOCKED；M2 Apply 及后续生产升级验收未执行。**

后续应先修复或明确上述 Preflight blocker 的规则/升级处理，再重新创建一份全新的 rehearsal 数据库重跑，不能在本数据库上绕过门禁直接 Apply。

## 8. M2.1 Planner / Preflight Alignment follow-up

在不修改原始 `datart` 克隆库、也不在旧 rehearsal 库上绕过 `applyAllowed` 的前提下，完成了一轮 M2.1 对齐验证。当前验证代码仍在分支 `dev202608242` 的工作树中，未移动或覆盖 `rc.5`。

本轮新增的关键行为：

- Preflight 使用现有 Field Metadata Migration 的只读扫描结果作为 M2 dry-run 计划来源。
- 可以由旧 View/model 确定性重建的缺失 ViewField，不再作为不可升级 blocker，而是报告为 `VIEW_FIELD_AUTO_UPGRADE_REQUIRED` warning。
- M2 规划得到的 ViewField 生成失败、字段歧义等问题仍然阻塞。
- `VIEW_SCHEMA_REFERENCE_NOT_FOUND` 没有被简单降级；只有真正能证明 normalize/rebuild 后可消解时才能放行。本次真实数据仍无法证明这 170 条引用安全可修复，因此继续保持 blocker。
- 历史孤儿成员、用户角色、角色权限和资源权限关系没有删除或改写，保留为 legacy integrity warning；identity/security checksum 仍覆盖这些记录。
- 新增 V6 migration 将 `view.model` 扩展为 `LONGTEXT`，避免真实旧 View canonicalization 时超过原 `TEXT` 列限制。
- Chart 兼容解析补充了 qualified source path 匹配，避免旧配置中的 `table.field` 形式阻断升级。

### 全新 m3c rehearsal 结果

为避免复用已做过诊断性修改的数据库，重新从原始生产克隆 `datart` 恢复了全新的隔离库：

- 数据库：`datart_rehearsal_20260824_m3c`
- 安装目录：`/opt/datart3-m3-rehearsal3`
- 原始 `datart`：未执行 Apply、未修改
- `m3c` Schema Migration：成功，包含 `expand_view_model_storage`
- `view.model`：`LONGTEXT`
- `migration_mode`：`COMPAT`
- 启动：成功，HTTP health：`200`
- 管理员原账号登录：成功，HTTP `200`

Preflight 返回 HTTP `200`，但门禁结果仍为：

| 项目 | 结果 |
| --- | ---: |
| `applyAllowed` | `false` |
| Blockers | `170` |
| Warnings | `1712` |
| `autoUpgradeRequired` | `1650` |
| View | `70` |
| ViewField | `0` |
| Datachart 表记录 | `0` |
| Dashboard | `22` |

1650 条缺失 ViewField 已全部变为可由 M2 处理的 warning；剩余 170 条 blocker 全部来自 View `102cdf4eafc5427595cf3ad1d7946b11`（名称“城市健康数据”）的 `VIEW_SCHEMA_REFERENCE_NOT_FOUND`。该 View 使用 Source `4a5a552d4fb6452fb3f908dcd4aad2b5`（`sr-ads`），旧字段路径无法在当前保存的 Source schema 中被确认，当前不能安全自动修复。

### Dashboard / Datachart 审计

本库 `datachart` 表为 0，但 Dashboard 通过 `widget` 配置保存图表内容：

- `widget`：171
- `rel_widget_element`：113 条，均为 `VIEW` 关系
- `rel_widget_widget`：176
- 含有 `datachart/chart` 配置文本的 widget：84

因此不能仅依据 `datachart` 表为 0 判断 Dashboard 没有图表；真实图表配置嵌入 widget。当前未发现 `rel_widget_element` 指向不存在 Datachart 的关系，但这些嵌入式图表仍需在 schema blocker 解决后通过实际 Dashboard runtime smoke 验证。

### M2.1 当前结论

本轮没有执行 M2 Apply，也没有生成 After Snapshot、checksum 对比或 Readiness 100% 结论。M3 仍然是 **BLOCKED**，但 blocker 已从“所有旧字段缺失”收敛为真实无法确认的 Source schema 引用问题。

这次结果符合安全门设计：

> M2 可以自动处理的旧 ViewField 不应阻塞升级；无法证明安全修复的 schema 引用必须继续阻塞，不能通过降低 severity、手工清理用户/角色/权限或直接 Apply 绕过。

## 9. M2.2A Explicit Legacy Resource Exclusion follow-up

根据人工确认，将唯一明确的历史残留 View 加入显式迁移排除项：

- View ID：`102cdf4eafc5427595cf3ad1d7946b11`
- View Name：`城市健康数据`
- Decision：`EXCLUDED_FROM_MIGRATION`

排除规则是按 View ID 精确匹配，不改变 `VIEW_SCHEMA_REFERENCE_NOT_FOUND` 的全局规则。Preflight 与 Field Metadata Migration 共用同一排除常量；排除 View 不进入 normalize、ViewField rebuild 或 Source schema refresh。数据库记录及 View ID 均保留。

### 排除项依赖审计

在新的 rehearsal 库中执行只读审计，结果如下：

| 依赖类型 | 数量 | 处理 |
| --- | ---: | --- |
| Datachart | 0 | 无运行时依赖 |
| Widget / Dashboard chart | 0 | 无运行时依赖 |
| Variable | 0 | 无运行时依赖 |
| View role permission | 0 | 无运行时依赖 |
| Column permission | 0 | 无运行时依赖 |
| Folder membership | 1 | 保留历史关系，warning |

### 全新 m3d rehearsal

从原始 `datart` 克隆库重新恢复：

- 数据库：`datart_rehearsal_20260824_m3d`
- 安装目录：`/opt/datart3-m3-rehearsal4`
- 原始 `datart`：未修改，未执行 Apply
- 登录：成功
- Preflight HTTP：`200`
- `MIGRATION_RESOURCE_EXCLUDED`：`1`
- 被排除 View 的 schema blocker：`0`
- `autoUpgradeRequired`：`1590`
- Blockers：`110`
- Warnings：`1652`
- `applyAllowed`：`false`
- `view_field`：`0`

剩余 110 个 blocker 来自两个未排除 View，仍严格保持原规则：

| View | View ID | Schema blockers |
| --- | --- | ---: |
| 电柜数据 | `780e724c89844a528150751bc80f5ec9` | 5 |
| 城市日报 | `9d8e8ba6789d45538cc1feb1ed5588ed` | 105 |

因此本轮没有执行 M2 Apply、没有修改任何 View/Widget/ViewField，也没有生成 After Snapshot 或 checksum 对比。m3d 服务已停止。

本轮结论是：

> 「城市健康数据」的显式排除已经生效，但真实备份并非只剩这一张 View 的 blocker；另外两个 View 的 110 条 schema 引用仍需独立确认或处理，不能因为排除项而放行整个升级。

## 10. Current `datart` clone re-evaluation

用户随后确认原始克隆库 `datart` 已更新为最新旧系统数据，并且 `城市健康数据` 已经删除。本轮以该库重新创建全新的隔离 rehearsal 数据库；原始 `datart` 只执行只读检查，没有执行 M2 Apply、没有删除或更新任何数据。

### 10.1 Original database read-only facts

- Target View ID `102cdf4eafc5427595cf3ad1d7946b11`：不存在。
- View name `城市健康数据`：不存在。
- View：43。
- Dashboard：16。
- Datachart：0。
- Widget：141。
- `view_field`：迁移前不存在，符合旧库状态。
- 对目标 View 的 Datachart、Widget/Dashboard、Variable、Permission、Folder 运行时引用：无有效引用。

因此，之前 rehearsal 中针对该 View 的 170 条 schema blocker 属于旧快照结果，不适用于当前最新 `datart` 数据。本轮已移除此前为该 View 增加的临时显式排除逻辑；由于目标 View 已不存在，本轮不会产生 `MIGRATION_RESOURCE_EXCLUDED` warning，也不会影响 readiness 或 applyAllowed 判断。

### 10.2 Fresh rehearsal result

从当前 `datart` 全新恢复隔离数据库 `datart_rehearsal_20260824_m3e`，仅让隔离 Datart 实例连接该数据库。

#### Preflight

| 指标 | 结果 |
| --- | ---: |
| HTTP | 200 |
| applyAllowed | true |
| Blockers | 0 |
| Warnings | 1234 |
| Views | 43 |
| Auto-upgrade required | 1184 |
| ViewField repair required | 0 |
| Datacharts requiring upgrade | 0 |
| Dashboards requiring upgrade | 0 |
| City health exclusion warning | 0 |

剩余 warning 均为可审计的历史兼容提示，包括自动生成 ViewField、旧模型元数据以及既有孤儿关系；没有 schema-not-found blocker。

#### M2 Apply

第一次 Apply 在隔离 rehearsal 库执行成功：

- status：`SUCCESS`
- `noOp`：`false`
- normalized Views：35
- created ViewFields：1184
- reconciled ViewFields：1184
- Widgets：66
- Datacharts：0
- Dashboards：0

Apply 后：

- readiness：100%
- blockers：0
- warnings：0
- chartFieldIdCoverage：100%
- resolvedChartFieldIdCoverage：100%
- identity、password hash、permission、resource ID checksum：全部 MATCH
- immutable identity/security/resource 行数：保持一致
- `city_health_remaining`：0

第二次 Apply 返回 `NO_OP`，并保持 readiness 100%、两个 Chart fieldId coverage 100% 及全部 checksum MATCH，证明升级结果稳定且幂等。

### 10.3 Runtime smoke

隔离实例启动健康检查 HTTP 200。使用原有管理员账号完成登录后，以下接口均返回 HTTP 200：

- View 列表
- View 详情
- Folder 列表
- Dashboard 详情

当前最新旧库的 `datachart` 表记录为 0，因此独立 Datachart 运行验证不适用；Dashboard 仍包含嵌入式 Widget 图表配置，Dashboard 详情接口已成功返回。

### 10.4 Final conclusion

针对当前最新 `datart` 数据，Phase 6.2-M3 重新评估结果为 **PASS**：

> `城市健康数据` 已删除，旧 blocker 不再存在；全新隔离 rehearsal 的 Preflight 已放行，M2 Apply 成功，二次执行为 NO_OP，Readiness 与 fieldId coverage 均为 100%，且原始 `datart` 数据库未被修改。

本轮没有切换 STRICT、没有对原始 `datart` 执行 Apply，也没有生成或修改正式发布包/tag。隔离 rehearsal 服务在验证结束后停止。

## 11. Phase 6.2-M3.1 final cleanup

根据最新生产克隆数据已确认目标 View 已删除，M2.2A 的临时 hard-coded exclusion 已从代码和测试中移除：

- 不再特殊识别 View ID `102cdf4eafc5427595cf3ad1d7946b11`。
- 通用 `VIEW_SCHEMA_REFERENCE_NOT_FOUND` blocker 规则未改变。
- M2.1 Planner、auto-upgrade、orphan identity/security warning、V6 `view.model` LONGTEXT migration 和 qualified source path compatibility 未改变。
- User、Password、Role、Permission 未修改。

### 11.1 Fresh m3f rehearsal

从最新原始 `datart` 全新恢复隔离数据库 `datart_rehearsal_20260824_m3f`，使用包含 M3.1 清理后的 server JAR 启动隔离实例。原始 `datart` 未执行 Apply。

| 阶段 | 结果 |
| --- | --- |
| 原始库目标 View | 不存在 |
| Preflight | HTTP 200，`applyAllowed=true`，Blockers 0 |
| 首次 Apply | HTTP 200，`SUCCESS` |
| Apply 后 Readiness | 100% |
| Chart fieldId coverage | 100% |
| Resolved chart fieldId coverage | 100% |
| Identity checksum | MATCH |
| Password checksum | MATCH |
| Permission checksum | MATCH |
| Resource ID checksum | MATCH |
| 第二次 Apply | HTTP 200，`NO_OP` |

M3.1 复核结果与 m3e 一致，证明移除临时排除逻辑后，当前最新生产数据仍可由通用迁移能力完成升级。没有连接原始生产库执行 Apply，没有修改 rc.5，也没有生成安装包。
