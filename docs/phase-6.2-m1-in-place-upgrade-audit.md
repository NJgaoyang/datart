# Phase 6.2-M1：Legacy Metadata In-place Upgrade Audit & Dry-run

## 1. 结论与生产升级路线

生产升级不采用“导出用户/角色，再导入新系统”的路径。正式升级使用：

```text
老 metadata DB
    ↓ 完整备份
测试克隆库
    ↓ 新版本 Schema Migration
Preflight（只读）
    ↓ blocker = 0
In-place Upgrade
    ↓ 保持旧 ID、密码 Hash、角色、权限
Readiness / Runtime Smoke
```

`.dor` 组织包继续保留，用于跨环境组织复制；它不是生产 metadata 升级主链路。本阶段不执行原地数据升级，只建立审计、快照和预检能力。

## 2. M1 明确禁止的行为

- 不修改老生产数据库；第一次验证只能使用完整克隆库或 fixture 数据库。
- 不调用 `ImportStrategy.NEW`，不执行 `replaceId()`，不生成资源新 ID。
- 不重建 User、Role、Organization、Membership、UserRole 或 Permission。
- 不重新 Hash `user.password`，BCrypt/password hash 必须按原字符串参与校验。
- 不在 Preflight 中调用任何写数据库的 migration、reconcile 或 import 方法。
- 不提供 Apply 执行入口；只有 `applyAllowed` 结果，后续 M2 才实现 Executor。

## 3. 表分类

### 3.1 Immutable Identity / Security

下列表在生产升级中视为不可改动数据：

| 表 | 必须保持 |
| --- | --- |
| `organization` | id、组织关系和组织身份字段 |
| ``user`` | id、username、email、active、`password` hash |
| `rel_user_organization` | org/user 成员关系和关系 ID |
| `role` | id、org_id、name、type |
| `rel_role_user` | user/role 关系 |
| `rel_role_resource` | role/resource/type/org/permission |
| `rel_subject_columns` | View 列权限主体和列权限 |
| `rel_variable_subject` | Variable 权限主体关系；明文 value 不进入 M1 snapshot 输出 |

这些表会被纳入 `MetadataIntegritySnapshot`。快照只返回行数和 SHA-256 摘要，不返回用户密码或其他敏感值；`user.password` 会参与 checksum，`passwordHashCovered=true` 表示这一保护项已启用。

### 3.2 Resource ID immutable / Content upgradable

下列资源的 `id` 必须保持不变，因为 `rel_role_resource.resource_id` 直接依赖它们：

- `source.id`
- `view.id`
- `view_field.id`
- `datachart.id`
- `dashboard.id`
- `folder.id`

内容后续可以在 M2 原地规范化：

- View model normalize；
- ViewField reconcile / fieldId 修复；
- Datachart canonical fieldId 修复；
- Dashboard relation validation。

M2 只能更新允许 canonical upgrade 的内容，不能删除或重新生成上述 ID。

## 4. Preflight 输出

接口：

```text
GET /orgs/{orgId}/metadata-upgrade/preflight
```

Preflight 是只读操作，返回：

- `readOnly=true`；
- `applyAllowed`，仅当 blocker 为 0 时为 true；
- Organization、User、Membership、Role、UserRole、RolePermission 数量；
- Source、View、ViewField、Datachart、Dashboard、Folder 数量；
- `needUpgradeViews`；
- `needFieldIdRepair`；
- `needUpgradeDatacharts`；
- `needUpgradeDashboards`；
- BLOCKER/WARNING 明细；
- 身份/权限 checksum；
- 资源 ID checksum。

资源问题复用现有 Readiness Scanner，包括：

- View model 无法解析或无法规范化；
- ViewField 缺失、孤立、重复或 fieldId 不一致；
- Datachart fieldId 找不到、指向错误 View 或字段 inactive；
- Dashboard 引用不存在的 View/Datachart。

此外，Preflight 会检查：

- 孤立组织成员；
- 孤立用户角色关系；
- 孤立角色权限；
- 权限指向不存在的 Source/View/Datachart/Dashboard/Folder；
- 孤立 View 列权限；
- 孤立 Variable 权限；
- 当前 metadata schema 缺表或缺字段。

任何上述关系问题都是 BLOCKER。Preflight 不会自动修复它们。

## 5. Snapshot / Checksum 规则

`MetadataSnapshotHasher` 对每张表使用：

```text
table name
    + selected column order
    + rows ordered by stable primary key
    + canonical null/value representation
    ↓
SHA-256
```

身份与权限快照至少覆盖：

```text
organization
user（包含 password）
rel_user_organization
role
rel_role_user
rel_role_resource
rel_subject_columns
rel_variable_subject
```

资源 ID 快照覆盖：

```text
source.id
view.id
view_field.id
datachart.id
dashboard.id
folder.id
```

后续 M2 Apply 前后必须满足：

```text
identity/security checksum before == after
resource ID checksum before == after
```

特别是：

```text
old user.id         == new user.id
old user.password   == new user.password
old role.id         == new role.id
old organization.id == new organization.id
old resource.id     == new resource.id
```

## 6. 允许的升级边界

| 对象 | M1 | M2 允许的方向 |
| --- | --- | --- |
| User / password / Role / Permission | 只读快照 | 禁止重建、换 ID、改权限 |
| Source | 只读 ID 审计 | 内容校验；ID 不变 |
| View | 只读 Readiness | model canonical normalize；ID 不变 |
| ViewField | 只读完整性审计 | reconcile/修复 metadata；ID 策略必须保持稳定 |
| Datachart | 只读 fieldId/引用审计 | canonical fieldId 修复；ID 不变 |
| Dashboard | 只读关系审计 | relation validation/修复；ID 不变 |
| Folder | 只读 ID 审计 | 内容必要时原地调整；ID 不变 |

## 7. 失败门禁

```text
Preflight
  ├─ blockers > 0  → applyAllowed=false，禁止 M2 Apply
  └─ blockers = 0  → applyAllowed=true，可进入后续人工确认
```

`applyAllowed=true` 不是“已经升级完成”，也不代表可以直接切 STRICT。M2 必须在事务中执行原地升级，并在执行后重新计算：

1. Identity/Security checksum；
2. Resource ID checksum；
3. Resource Readiness；
4. Organization/System Upgrade Readiness；
5. 登录、角色权限和 BI runtime smoke。

## 8. 已识别的现有危险路径

现有 Resource Import 的 `ImportStrategy.NEW` 会调用各资源的 `replaceId()`，并建立 Source/View/Datachart/Dashboard/Folder 的新 ID mapping。这条路径适合跨环境复制，不适合生产 metadata 原地升级。

因此 M2 Executor 必须独立于 Resource Import：

```text
Schema Migration
  ↓
Metadata Preflight
  ↓
In-place View/Field/Chart/Dashboard Upgrade
  ↓
Identity/Resource ID checksum
  ↓
Readiness
```

M1 没有调用该危险路径，也没有调用任何 `ImportStrategy.NEW`。

## 9. 验证与上线前要求

第一次验证必须使用：

```text
旧 metadata DB backup
    ↓
独立测试库 datart_upgrade_test
    ↓
新版本启动 / Schema Migration
    ↓
Preflight
```

需要进一步补充的 M2 验证包括：

- Before/After 用户、角色、成员、权限 checksum 一致；
- 原密码登录成功，且 password hash 不变；
- 管理员、分析师、普通查看者、无权限用户的可见资源一致；
- MySQL Source、StarRocks Source、普通 View、SQL View、computed field、date hierarchy 正常；
- Datachart、Dashboard 正常打开和执行；
- Readiness 100%、Blockers 0 后才允许切 STRICT。

生产切换顺序固定为：

```text
停止老 Datart 写入
  ↓
完整备份 metadata DB
  ↓
恢复到新 metadata DB
  ↓
Schema Migration
  ↓
Metadata Preflight
  ↓
M2 In-place Apply
  ↓
Checksum / Readiness / Runtime Smoke
  ↓
切换流量
```

任一步失败，保持老系统和老数据库不变并回退，不在老生产库上继续尝试。
