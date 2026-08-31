# Phase 6.1：Organization & Security Migration Inventory

## 1. 目的与边界

本阶段只完成组织迁移的现状审计和协议设计，不改变现有资源导入/导出行为，不新增数据库迁移，也不改变 COMPAT、STRICT 或现有运行时权限逻辑。

当前系统保留两类独立能力：

- **RESOURCE package**：继续处理 `Source`、`View`、`ViewField`、`Datachart`、`Dashboard`、`Folder` 等 BI 资源，用于普通资源复制。
- **ORGANIZATION package**：Phase 6 新增的完整组织迁移包，处理身份、成员、角色、权限以及资源之间的关系，用于系统或组织迁移。

组织迁移包不能直接把当前数据库表或 Java Entity 整体序列化。特别是用户密码、Token、Session、签名密钥等安全数据禁止作为普通迁移资源导出。

相关现有代码和协议入口：

- 领域实体：`core/src/main/java/datart/core/entity/`
- 初始数据库结构：`server/src/main/resources/db/migration/V1__init_schema.sql`
- 资源包模型：`server/src/main/java/datart/server/base/transfer/model/`
- 资源导入导出入口：`server/src/main/java/datart/server/service/impl/VizServiceImpl.java`

## 2. 当前关系模型

```text
Organization
  ├─ RelUserOrganization ── User
  ├─ Role
  │    ├─ RelRoleUser ── User
  │    └─ RelRoleResource ── Resource
  └─ Resource
       ├─ RelSubjectColumns       (View 列权限)
       └─ RelVariableSubject       (Variable 与主体关系)

User / Role / Resource
  └─ BaseEntity.createBy / updateBy
```

当前没有独立的 `Permission` Entity。资源权限主要保存在 `rel_role_resource.permission`，列权限保存在 `rel_subject_columns.column_permission`，并通过 `RoleService` 及相关 Mapper 读写。

## 3. 实体与表清单

### 3.1 组织与身份

| 对象 | 表 | 范围 | 主键/唯一规则 | Phase 6 导出策略 |
| --- | --- | --- | --- | --- |
| `Organization` | `organization` | 组织级 | `id`；`name` 全局唯一 | 导出 `sourceId`、名称、头像、描述；目标组织由管理员明确选择，不自动合并 |
| `User` | `user` | 全局身份 | `id`；`username`、`email` 全局唯一 | 导出 `sourceId`、username、email、name、description、avatar、active；禁止导出 password、Token、Session、密钥 |
| `RelUserOrganization` | `rel_user_organization` | 组织成员关系 | `id`；`(org_id,user_id)` 唯一 | 导出 source user/org 引用，导入时通过映射恢复 |
| `UserSettings` | `user_settings` | 用户配置 | `id`；按 user 查询 | 第一版不作为身份和权限必需数据；后续按产品需要单独纳入 |

用户密码不按普通字段迁移。若后续确认旧、新系统密码哈希机制安全兼容，另行设计专项迁移；否则导入后要求用户重置密码。

### 3.2 角色与授权主体

| 对象 | 表 | 范围 | 主键/唯一规则 | Phase 6 导出策略 |
| --- | --- | --- | --- | --- |
| `Role` | `role` | 组织级 | `id`；`(org_id,name)` 唯一 | 导出 sourceId、名称、类型、描述、头像、sourceOrgId；导入生成新 roleId |
| `RelRoleUser` | `rel_role_user` | 组织内用户-角色 | `id`；`(user_id,role_id)` 唯一 | 导出 source user/role 引用，导入时通过映射恢复 |
| `RelRoleResource` | `rel_role_resource` | 角色-资源权限 | `id`；`(role_id,resource_id,resource_type)` 唯一 | 导出 role/resource/type/permission/org 引用；权限恢复必须在资源导入后进行 |
| `RelSubjectColumns` | `rel_subject_columns` | View 列级权限 | `id`；由 view、subject、type 组合识别 | 纳入完整组织迁移；viewId 和 subjectId 均必须经过映射 |
| `RelVariableSubject` | `rel_variable_subject` | Variable-主体关系 | `id`；`(variable_id,subject_type,subject_id)` 唯一 | 纳入完整迁移前需明确 `value` 的敏感信息策略；不能无条件复制明文配置 |

`RelRoleResource.permission` 使用 `BaseEntity.permission` 语义，主体类型和资源类型必须按现有 `RoleService` 规则校验，不能通过名称猜测权限对象。

### 3.3 资源与所有者引用

现有资源实体均包含组织和审计引用，至少包括：

- `Source`、`View`、`Datachart`、`Dashboard`、`Folder`、`Variable` 等资源的 `orgId`；
- `BaseEntity.createBy`、`BaseEntity.updateBy`；
- 资源配置中可能存在 owner、创建人或更新人引用；
- `source_schemas`、`schedule`、`share` 等与资源相关但不一定属于当前 Resource package 的附属数据。

这些字段不是独立身份数据，但在完整组织迁移中必须处理：

```text
oldUserId ──> newUserId
oldResourceId ──> newResourceId
```

无法解析的 `createBy`、`updateBy`、owner 或权限主体应作为迁移问题报告，不能静默保留旧 ID。

### 3.4 明确区分的附属数据

下列对象需要在后续 Phase 单独决定是否纳入，不应在 6.1 中隐式混入身份迁移：

- `share`：资源分享关系，属于资源权限边界，需要和 `RelRoleResource` 一起确定迁移策略；
- `schedule`、`schedule_log`：调度定义与运行历史，定义可迁移，运行日志通常不迁移；
- `access_log`、`download`：运行审计/下载历史，默认不迁移；
- `source_schemas`：数据源缓存/元数据快照，默认由目标环境重新获取；
- `storyboard`、`storypage` 等展示附属数据：只有确认属于目标资源图谱后才纳入；
- `UserSettings`：属于用户体验配置，不是组织权限成立的前提。

## 4. 权威来源与字段分类

### 4.1 必须迁移的关系

第一版组织迁移必须能够恢复：

1. 目标组织与用户的成员关系；
2. 组织角色；
3. 用户与角色关系；
4. 角色与 Source/View/Datachart/Dashboard 的资源权限；
5. View 的列级权限；
6. 资源的 `createBy`、`updateBy`、owner 等用户引用。

### 4.2 禁止直接导出的字段

默认禁止：

- `user.password`；
- Token、Session、登录凭据、重置密码凭据；
- JWT/签名密钥、加密主密钥及类似安全材料；
- access log、download history 等运行历史；
- 未经过现有资源安全策略处理的连接密码、访问令牌和私密配置。

`Source.config` 可能包含数据源凭据。组织包不得绕过现有 Resource package 的加密/脱敏规则重复导出，凭据迁移应另行确认目标环境的安全策略。

## 5. Organization Package V1 合同

组织包使用独立协议，不扩展或改变现有 Resource package 的含义：

```json
{
  "packageType": "ORGANIZATION",
  "formatVersion": 1,
  "organization": {
    "sourceId": "old-org-id",
    "name": "销售分析组织",
    "avatar": "...",
    "description": "..."
  },
  "users": [
    {
      "sourceId": "old-user-id",
      "username": "zhangsan",
      "email": "user@example.com",
      "name": "张三",
      "description": "...",
      "avatar": "...",
      "active": true
    }
  ],
  "memberships": [
    { "sourceOrgId": "old-org-id", "sourceUserId": "old-user-id" }
  ],
  "roles": [
    {
      "sourceId": "old-role-id",
      "sourceOrgId": "old-org-id",
      "name": "分析师",
      "type": "...",
      "description": "...",
      "avatar": "..."
    }
  ],
  "userRoles": [
    { "sourceUserId": "old-user-id", "sourceRoleId": "old-role-id" }
  ],
  "resources": {
    "sources": [],
    "views": [],
    "datacharts": [],
    "dashboards": [],
    "folders": []
  },
  "permissions": {
    "resources": [],
    "viewColumns": [],
    "variables": []
  },
  "ownership": []
}
```

约定：

- 包必须声明 `packageType=ORGANIZATION`；不得根据文件内容猜测包类型。
- `formatVersion=1` 是 Organization package 的第一版协议，与 Resource package 的版本独立。
- 关系记录使用 `sourceId` 引用，不假设目标库复用旧 ID。
- `resources` 可以复用现有资源升级/导入能力，但不能反向修改现有 RESOURCE package。
- `organization` 的目标组织由导入者明确选择；第一版不自动按名称合并组织。
- V1 reader 可以继续兼容未来明确列出的旧字段；V1 writer 不输出密码、Token、Session 等敏感字段。

## 6. ID Mapping 合同

导入过程必须维护统一的旧 ID 到新 ID 映射：

```text
MigrationIdMapping {
  entityType: ORGANIZATION | USER | ROLE | SOURCE | VIEW |
               VIEW_FIELD | DATACHART | DASHBOARD | FOLDER | VARIABLE
  sourceId:    old identifier
  targetId:    new identifier
}
```

最低要求的映射包括：

```text
oldOrgId        -> newOrgId
oldUserId       -> newUserId
oldRoleId       -> newRoleId
oldSourceId     -> newSourceId
oldViewId       -> newViewId
oldChartId      -> newChartId
oldDashboardId  -> newDashboardId
```

所有成员、角色、权限、所有者和审计字段都只能通过该映射恢复。禁止按 username、name、displayName、资源名称或字段名称隐式重新绑定。

## 7. 推荐导入顺序

```text
1. 解析 packageType / formatVersion
2. 确认目标 Organization
3. 导入或解析 Users
4. 建立 Organization Membership
5. 导入 Roles
6. 建立 User <-> Role
7. 导入 Source / View / ViewField / Datachart / Dashboard / Folder
8. 恢复 Resource Permission
9. 恢复 View Column Permission / Variable Subject
10. remap createBy / updateBy / owner
11. 执行 Organization Readiness 校验
12. 事务提交
```

权限放在资源之后，是因为权限关系依赖用户、角色和目标资源都已经完成映射。任何一步出现 blocker，都应在持久化完成前失败并回滚，不能留下半套组织关系。

## 8. 冲突与失败策略

第一版采用保守策略：

| 场景 | 处理 |
| --- | --- |
| 目标组织由管理员明确指定 | 不按名称自动创建、合并或覆盖 |
| username 已存在 | BLOCKER；不自动合并用户 |
| email 已存在 | BLOCKER；不自动合并用户 |
| 同组织同名角色已存在 | BLOCKER；后续可增加显式“复用角色”选项 |
| 缺少 user/role/resource 映射 | BLOCKER |
| 已存在但无效的资源 ID | BLOCKER；不得按 name/path 猜测 |
| 密码哈希不可安全兼容 | 导入账号但标记为需重置密码；未完成重置前不能正常登录 |
| 资源名称或资源 ID 冲突 | 使用现有资源导入策略并记录 oldId -> newId；不得静默覆盖 |
| 未解析的 owner/createBy/updateBy | BLOCKER，或在明确的系统账号策略下重映射 |

不自动把“同名”当作“同一个对象”。所有复用、覆盖和合并行为都需要明确的导入选项和审计记录。

## 9. Organization Readiness 合同

Phase 6 的 readiness 不替代现有 Resource Readiness，而是在其上增加组织关系检查：

```text
Organization migration readiness
  ├─ usersResolved
  ├─ rolesResolved
  ├─ membershipsResolved
  ├─ userRolesResolved
  ├─ resourcePermissionsResolved
  ├─ viewColumnPermissionsResolved
  ├─ ownershipReferencesResolved
  └─ resourceReadiness
```

第一版规则：

- scanner 只读，不自动修复、不写数据库；
- 缺失映射、重复映射、孤立成员、孤立角色、无法解析的权限主体或 owner 是 BLOCKER；
- 密码需要重置属于独立的安全状态，不得通过伪造密码迁移为成功；
- `strictEligible` 继续由 blocker 数量决定，不能由前端自行推断；
- 组织 readiness 只有在资源和身份关系都达到要求后才可视为 100%。

## 10. 后续阶段边界

```text
6.1 Inventory & Contract          当前阶段：只审计、定协议
6.2 Organization Package V1       定义 DTO、读写边界和版本识别
6.3 User + Membership Migration   用户、成员、密码重置策略
6.4 Role + UserRole Migration     角色及角色成员关系
6.5 Resource Integration          复用现有资源导入并建立映射
6.6 Permission Remapping          资源/列/变量权限恢复
6.7 Ownership Remapping           createBy/updateBy/owner 恢复
6.8 Organization Readiness        组织级扫描与诊断
6.9 Full Round-trip               导出 -> 导入 -> 再导出
6.10 Production Smoke             脱敏后的真实迁移验证
```

本阶段明确不做：

- 不修改现有 Resource Export/Import；
- 不把 User、Role、Permission 直接加入现有资源包；
- 不导出密码、Token、Session 或密钥；
- 不自动合并同名用户、角色或组织；
- 不新增数据库表或 Flyway migration；
- 不改变 COMPAT/STRICT 行为。

## 11. Phase 6.1 验收标准

- [x] 已盘点 Organization、User、Membership、Role、UserRole、Resource Permission 和列级权限关系。
- [x] 已区分组织级、全局级、资源级和运行历史数据。
- [x] 已明确用户唯一键、角色唯一规则及关系表唯一约束。
- [x] 已明确 password、Token、Session、密钥和运行历史的禁止导出范围。
- [x] 已定义独立的 `ORGANIZATION` / `formatVersion=1` 合同。
- [x] 已定义 `sourceId -> targetId` 的统一映射模型。
- [x] 已定义导入顺序、冲突策略和 blocker 边界。
- [x] 已定义组织级 readiness 的统计维度。
- [x] 未修改现有 Resource Export/Import、数据库结构或运行时行为。

