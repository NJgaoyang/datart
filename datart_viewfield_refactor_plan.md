# Datart ViewField 字段元数据架构改造计划

**基线分支：** `dev202608182`  
**目标：** 参考 DataEase 的字段元数据设计，将 Datart 当前散落在 View / Hierarchy / Chart / Frontend 中的字段显示逻辑，收敛为后端统一的 `ViewField` 单一事实源。

---

## 1. 最终架构目标

统一字段模型：

```text
fieldId = 字段唯一身份
originName = 原始物理字段名 / SQL 输出字段名
sourceComment = 数据库字段注释
customName = 用户明确设置的数据集字段名称

displayName =
customName
?? sourceComment
?? originName
```

核心原则：

- `fieldId` 是稳定字段身份。
- `originName` 用于数据库 / SQL 查询，不作为用户自定义名称。
- `sourceComment` 只来自数据库 Schema 元数据。
- `customName` 只来自用户明确修改。
- `displayName` 不持久化，由后端统一计算后返回。
- 前端、Chart、Hierarchy、SQL Preview 均不得自行重新计算字段名称优先级。
- Chart 自身 alias 保留，最终优先级：

```text
Chart alias
    >
ViewField.customName
    >
ViewField.sourceComment
    >
ViewField.originName
```

---

## 2. 领域命名

Datart 当前的 `View` 实际承担 Dataset 的角色。为降低改造范围，本次不做全局 View → Dataset 重命名，统一使用：

```text
ViewField
ViewFieldService
ViewFieldDTO
ViewFieldController
```

概念上：

```text
ViewFieldService = Dataset Field Service
```

---

## 3. 新增数据表

新增：

```text
view_field
```

Flyway 文件：

```text
server/src/main/resources/db/migration/V3__view_field_metadata.sql
```

建议表结构：

```sql
CREATE TABLE IF NOT EXISTS `view_field` (
    `id` varchar(32) NOT NULL,
    `view_id` varchar(32) NOT NULL,
    `canonical_key` varchar(512) NOT NULL,
    `origin_name` varchar(255) NOT NULL,
    `source_comment` varchar(1024) NULL,
    `custom_name` varchar(255) NULL,
    `source_path` varchar(1024) NULL,
    `field_type` varchar(32) NOT NULL,
    `field_category` varchar(32) NOT NULL,
    `expression` longtext NULL,
    `ordinal` int NOT NULL DEFAULT 0,
    `active` tinyint NOT NULL DEFAULT 1,
    `create_by` varchar(32) NULL,
    `create_time` datetime NULL,
    `update_by` varchar(32) NULL,
    `update_time` datetime NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_view_field_key` (`view_id`, `canonical_key`),
    KEY `idx_view_field_view` (`view_id`),
    KEY `idx_view_field_origin` (`view_id`, `origin_name`)
) ENGINE = InnoDB
  CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_general_ci;
```

### 不要增加 `display_name`

`displayName` 是计算结果，不是独立状态。

---

## 4. 字段职责

| 字段 | 作用 | 变化规则 |
|---|---|---|
| `id / fieldId` | 系统字段身份 | 不得因名称变化而变化 |
| `originName` | SQL/数据库真实字段名 | Schema 变化时允许变化 |
| `sourceComment` | 数据库原始 comment | Schema 同步时允许更新 |
| `customName` | 用户自定义数据集字段名 | 只有用户操作才更新 |
| `displayName` | 最终显示名称 | 服务端动态计算 |
| `sourcePath` | `db.table.column` 来源 | STRUCT/JOIN 重要 |
| `canonicalKey` | View 内稳定匹配键 | 系统内部使用 |

---

## 5. fieldId 是核心身份

当前很多地方使用：

```text
colName
path
rawName
```

作为字段身份。

改造后：

```text
Chart
  │
  │ fieldId
  ▼
ViewFieldService
  │
  ▼
ViewField
```

不再按字段名字猜测身份。

---

## 6. canonicalKey 统一规则

新增：

```text
server/src/main/java/datart/server/common/fieldmeta/ViewFieldKey.java
```

只允许这一处生成 canonical key。

### STRUCT 普通字段

```text
db1.user.city_name
→ FIELD|db1.user.city_name
```

### JOIN 同名字段

```text
db1.user.id
→ FIELD|db1.user.id

db1.order.id
→ FIELD|db1.order.id
```

即使 `originName` 都为 `id`，也必须得到不同 `fieldId`。

### SQL 字段

```sql
SELECT city_name, COUNT(*) AS user_count FROM ...
```

建议 canonicalKey：

```text
SQL|city_name
SQL|user_count
```

硬规则：SQL View 最终输出列名必须唯一。

若：

```sql
SELECT a.id, b.id
```

必须报 BLOCKING：

```text
SQL_OUTPUT_COLUMN_DUPLICATED
```

要求显式 alias：

```sql
SELECT a.id AS user_id, b.id AS order_id
```

---

## 7. 日期层级不能复制字段身份

原字段：

```text
fieldId = F100
originName = create_time
```

图表按年：

```text
fieldId = F100
dateLevel = YEAR
```

不要创建：

```text
F100_YEAR
F100_MONTH
F100_DAY
```

日期层级继续引用父 `fieldId`，通过 `dateLevel` 或 `expression` 表达粒度。

---

## 8. Phase 1：建立 ViewField 单一事实源

新增：

```text
core/src/main/java/datart/core/entity/ViewField.java
```

建议：

```java
@Data
@EqualsAndHashCode(callSuper = true)
public class ViewField extends BaseEntity {
    private String viewId;
    private String canonicalKey;
    private String originName;
    private String sourceComment;
    private String customName;
    private String sourcePath;
    private String fieldType;
    private String fieldCategory;
    private String expression;
    private Integer ordinal;
    private Boolean active;
}
```

新增 Mapper：

```text
core/src/main/java/datart/core/mappers/ext/ViewFieldMapperExt.java
```

如项目已有完整 MyBatis Generator 流程，按现有模式补充：

```text
ViewFieldMapper.java
ViewFieldSqlProvider.java
```

不要为了这一张表重构 MyBatis 架构。

---

## 9. 新增 ViewFieldService

新增：

```text
server/src/main/java/datart/server/service/ViewFieldService.java
server/src/main/java/datart/server/service/impl/ViewFieldServiceImpl.java
```

建议接口：

```java
public interface ViewFieldService {
    List<ViewFieldDTO> listByViewId(String viewId);
    ViewFieldDTO get(String viewId, String fieldId);
    Map<String, ViewFieldDTO> mapByViewId(String viewId);
    void reconcile(View view);
    ViewFieldDTO updateCustomName(String viewId, String fieldId, String customName);
    String resolveDisplayName(ViewField field);
}
```

名称决策只能保留这一份：

```java
public String resolveDisplayName(ViewField field) {
    if (hasText(field.getCustomName())) {
        return field.getCustomName().trim();
    }
    if (hasText(field.getSourceComment())) {
        return field.getSourceComment().trim();
    }
    return field.getOriginName();
}
```

---

## 10. 新增 ViewFieldDTO

新增：

```text
server/src/main/java/datart/server/base/dto/ViewFieldDTO.java
```

建议：

```java
@Data
public class ViewFieldDTO {
    private String fieldId;
    private String originName;
    private String sourceComment;
    private String customName;
    private String displayName;
    private List<String> sourcePath;
    private String type;
    private String category;
    private String expression;
}
```

`displayName` 只存在 DTO/API，不存数据库。

---

## 11. ViewDetailDTO 返回 fields

修改：

```text
server/src/main/java/datart/server/base/dto/ViewDetailDTO.java
```

增加：

```java
private List<ViewFieldDTO> fields;
```

在：

```text
ViewServiceImpl.getViewDetail()
```

增加：

```java
viewDetailDTO.setFields(viewFieldService.listByViewId(viewId));
```

最终 API：

```text
GET View
        │
        ├─ model
        └─ fields
             ├─ fieldId
             ├─ originName
             ├─ sourceComment
             ├─ customName
             └─ displayName
```

---

## 12. View 保存流程

当前 `ViewServiceImpl.create()` / `update()` 仍依赖 `normalizeModelDisplayNames()`。

最终该函数要退出正常运行，但不能第一阶段直接删除。

过渡流程：

```text
收到 View model
       ↓
解析字段结构
       ↓
ViewFieldService.reconcile()
       ↓
生成/保留 fieldId
       ↓
写入 view_field
       ↓
fieldId 写回 model
       ↓
保存 View
```

---

## 13. reconcile 核心规则

已有：

```text
fieldId = F1
canonicalKey = FIELD|db.user.city_name
originName = city_name
sourceComment = 城市
customName = 城市简称
```

数据库 comment 改为：

```text
城市名称
```

reconcile 后：

```text
fieldId = F1           不变
originName = city_name
sourceComment = 城市名称
customName = 城市简称  不变
```

最终：

```text
displayName = 城市简称
```

用户清空：

```text
customName = null
```

自动：

```text
displayName = 城市名称
```

---

## 14. fieldId 稳定性硬规则

以下变化不得重新生成 fieldId：

```text
sourceComment 变化
customName 变化
displayName 变化
```

字段从 Schema 暂时消失：

```text
active = 0
```

不要立即 DELETE，以便历史 Chart 明确识别 `FIELD_INACTIVE`。

---

## 15. STRUCT comment 来源

复用现有：

```text
Column.comment
SourceSchemaIndex
```

通过完整 path：

```text
db.table.column
```

精确获取 `sourceComment`。

不重写现有数据库元数据读取体系。

---

## 16. SQL View 规则

固定：

```text
有确定 lineage
    ↓
sourceComment = 数据库 comment

无法确定 lineage
    ↓
sourceComment = null
```

绝对禁止按全库同名字段猜 comment。

SQL alias 示例：

```sql
SELECT COUNT(*) AS user_count
```

字段：

```text
originName = user_count
sourceComment = null
customName = null
displayName = user_count
```

用户设置 `customName = 用户数量` 后：

```text
displayName = 用户数量
```

---

## 17. 计算字段

计算字段也进入 `view_field`：

```text
fieldId = ...
originName = avg_price
sourceComment = null
customName = 平均价格
fieldCategory = COMPUTED
expression = amount / count
```

计算字段不得依赖名称作为身份。

---

## 18. 用户改字段名称走独立 API

新增：

```text
PATCH /views/{viewId}/fields/{fieldId}
```

请求：

```json
{
  "customName": "当前在租用户"
}
```

新增：

```text
server/src/main/java/datart/server/controller/ViewFieldController.java
server/src/main/java/datart/server/base/params/ViewFieldUpdateParam.java
```

清空：

```json
{
  "customName": null
}
```

语义：恢复 `sourceComment / originName`。

---

## 19. View.model 最终目标

当前：

```json
{
  "name": ["db", "table", "city_name"],
  "displayName": "城市",
  "comment": "城市",
  "isDisplayNameCustom": false,
  "type": "STRING"
}
```

最终：

```json
{
  "fieldId": "F10001",
  "name": ["db", "table", "city_name"],
  "type": "STRING"
}
```

最终从 View.model 删除：

```text
displayName
comment
isDisplayNameCustom
```

但只能在 Phase 5 执行。

---

## 20. 前端字段模型

修改：

```text
frontend/src/app/types/ChartDataViewMeta.ts
```

目标：

```ts
export type ChartDataViewMeta = {
  fieldId: string;
  name: string;
  originName: string;
  sourceComment?: string;
  customName?: string;
  displayName: string;
  path?: string[];
  // ... existing business fields
};
```

前端必须直接使用：

```ts
field.displayName
```

禁止：

```ts
customName || sourceComment || originName
```

---

## 21. 前端移除名称决策

逐步退出：

```text
frontend/src/utils/utils.ts
```

中的：

```text
getFieldDisplayName
getFieldCustomDisplayName
```

以及：

```text
frontend/src/app/utils/internalChartHelper.ts
```

中的字段显示 fallback。

最终只允许类似：

```ts
return c.displayName;
```

---

## 22. 保留 Chart alias

Chart alias 与 Dataset customName 是不同层级。

最终：

```text
Chart alias
      >
ViewField.displayName
```

而 `ViewField.displayName` 由服务端决定：

```text
customName
>
sourceComment
>
originName
```

---

## 23. ChartDataSectionField 增加 fieldId

修改：

```text
frontend/src/app/types/ChartConfig.ts
```

第一阶段增加：

```ts
fieldId?: string;
```

暂时保留：

```text
colName
path
comment
displayName
isDisplayNameCustom
```

仅作为历史兼容，最终再清理。

---

## 24. ChartDataRequestBuilder 优先 fieldId

当前 `buildColumnName()` 主要按 `colName` 查 meta。

过渡实现：

```ts
private buildColumnName(col) {
  if (col.fieldId) {
    const field = findByFieldId(this.dataView.meta, col.fieldId);
    if (field) {
      return field.path || [field.originName];
    }
  }

  // LEGACY COMPATIBILITY ONLY
  const row = findPathByNameInMeta(this.dataView.meta, col.colName);
  // legacy fallback...
}
```

`colName` fallback 必须标记为 Legacy Compatibility，不允许成为新逻辑。

---

## 25. 暂时不要重构 ChartDataSet

本轮不要把 `ChartDataSetRow.getCell()` 全部切为 fieldId。

原因：影响：

```text
groupBy
sort
tooltip
filter
selection
drill
```

第一版采用：

```text
fieldId = metadata identity
query column/path = 查询和 ChartDataSet lookup
```

---

## 26. Hierarchy 边界

Hierarchy 不再拥有独立：

```text
comment
displayName
isDisplayNameCustom
```

普通 hierarchy：

```text
hierarchy node → fieldId
```

日期 hierarchy：

```text
fieldId + dateLevel
```

禁止复制字段 metadata。

---

## 27. 继续复用现有迁移体系

不得删除：

```text
scan
migrate
verify
rollback
```

以及：

```text
field_meta_migration_run
field_meta_migration_backup
```

继续扩展：

```text
FieldMetaMigrationServiceImpl
ViewModelMigrator
ChartConfigReconciler
FieldMetaResolver
```

`FieldMetaResolver` 最终降级为：

```text
legacy metadata migration only
```

不再参与正常运行。

---

## 28. 新迁移流程

```text
scan
 │
 ├─ View 字段能否唯一确定
 ├─ canonicalKey 是否冲突
 ├─ SQL 输出名是否重复
 ├─ Chart 字段是否能够匹配
 └─ Blocking issue

       ↓

migrate

       ↓

创建 view_field

       ↓

View.model 写 fieldId

       ↓

ChartConfig 写 fieldId

       ↓

verify
```

---

## 29. ChartConfig 迁移策略

旧：

```json
{
  "colName": "city_name",
  "path": ["db", "user", "city_name"],
  "displayName": "城市",
  "comment": "城市",
  "isDisplayNameCustom": false
}
```

第一阶段迁移：

```json
{
  "fieldId": "F1001",
  "colName": "city_name",
  "path": ["db", "user", "city_name"],
  "displayName": "城市",
  "comment": "城市",
  "isDisplayNameCustom": false
}
```

第一轮只增加 `fieldId`，不删除旧字段。

---

## 30. 最终 Cleanup 条件

只有：

```text
fieldIdCoverage = 100%
chartFieldIdCoverage = 100%
blockingIssues = 0
```

才允许 Cleanup。

Cleanup 删除 View.model：

```text
displayName
comment
isDisplayNameCustom
```

ChartConfig 逐步删除：

```text
comment
isDisplayNameCustom
```

`displayName` 可最后处理。

---

# 31. 五阶段执行计划

## Phase 1 — 建立字段事实源，不改变现有行为

新增：

```text
V3__view_field_metadata.sql
ViewField.java
ViewFieldMapper / ViewFieldMapperExt
ViewFieldDTO.java
ViewFieldService.java
ViewFieldServiceImpl.java
```

要求：

```text
后端编译通过
新增单测通过
现有 View / Chart 行为不能变化
```

## Phase 2 — View 双写

修改：

```text
ViewDetailDTO.java
ViewServiceImpl.java
```

实现：

```text
View save → reconcile ViewField
View detail → 返回 fields
```

此阶段继续保留 View.model 旧 metadata。

## Phase 3 — 历史 fieldId 迁移

修改：

```text
FieldMetaMigrationServiceImpl.java
ViewModelMigrator.java
ChartConfigReconciler.java
FieldMetaMigrationMapperExt.java
```

目标：

```text
历史 View → fieldId
历史 Chart → fieldId
```

继续使用：

```text
scan / migrate / verify / rollback
```

## Phase 4 — 前端切换 fieldId + server displayName

核心修改：

```text
frontend/src/app/types/ChartDataViewMeta.ts
frontend/src/app/types/ChartConfig.ts
frontend/src/app/pages/MainPage/pages/ViewPage/slice/types.ts
frontend/src/app/utils/internalChartHelper.ts
frontend/src/app/models/ChartDataRequestBuilder.ts
```

以及所有 `View meta → ChartDataSectionField` 的构建入口。

要求：

```text
前端禁止自行计算 customName ?? comment ?? name
统一使用 field.displayName
```

## Phase 5 — Cleanup

只有 Phase 1–4 全部验证通过才执行。

删除正常运行路径：

```text
normalizeModelDisplayNames()
```

逐步退出：

```text
getFieldDisplayName()
getFieldCustomDisplayName()
```

View / Chart 不再持久化重复字段 metadata。

---

## 32. 建议 Commit 边界

```text
commit 1
feat: add persistent view field metadata

commit 2
feat: reconcile view fields on view save

commit 3
feat: migrate legacy view and chart field references to fieldId

commit 4
feat: use server-resolved field metadata in frontend

commit 5
refactor: remove legacy field display fallback
```

每个 Phase 必须独立 commit。

---

# 33. 执行 AI 的硬边界

## 绝对禁止

1. 不允许修改每一种 Chart 实现来解决字段名称。
2. 不允许在柱图、折线图、饼图、表格图分别写 `customName/comment/originName` fallback。
3. 不允许再根据全库相同 `columnName` 猜 comment。
4. 不允许用 `displayName` 作为字段 identity。
5. 不允许用 `customName` 作为 SQL 查询字段。
6. 不允许因为 customName/comment 变化重新生成 fieldId。
7. 不允许因为 hierarchy/dateLevel 生成另外一套字段 metadata。
8. 不允许直接删除旧 `displayName/comment/isDisplayNameCustom`，必须双轨过渡。
9. 不允许直接废弃 `FieldMetaMigrationService`。
10. 不允许用 Flyway V3 自动修改历史 View/Chart JSON。
11. V3 只负责建表，历史数据必须通过 scan/migrate/verify。
12. 不允许自动修复无法确定来源的 SQL 字段。
13. SQL 字段冲突必须 BLOCKING，而不是猜。
14. 不允许修改日期 `00:00:00` 问题，此问题属于独立任务。
15. 不允许修改打包脚本。
16. 不允许覆盖已有数据视图列宽和 SQL 字段显示修复。
17. 不允许 `git reset --hard`、强制 checkout 或覆盖用户现有未提交修改。
18. 不允许顺手做无关的大范围重构。

---

## 34. 开工前必须执行

```bash
git status
git branch --show-current
git log -5 --oneline
```

必须确认：

```text
base = dev202608182
```

如果有未提交修改：

```text
禁止 reset
禁止 checkout .
禁止 clean -fd
```

必须识别并保留。

建议新分支：

```text
dev202608183
```

如果已存在，禁止强行覆盖。

---

# 35. 后端测试要求

## ViewFieldDisplayNameTest

覆盖：

```text
customName 有值 → customName
customName null + sourceComment 有值 → sourceComment
两个都 null → originName
customName = " " → sourceComment
sourceComment = " " → originName
```

## ViewFieldReconcileTest

覆盖：

```text
STRUCT 精确 path
JOIN 同名字段
数据库 comment 更新
customName 保留
字段消失 active=false
字段重新出现 fieldId 不变
计算字段
SQL alias
SQL duplicate alias
```

---

## 36. JOIN 验收

```text
user.id
order.id
```

必须得到：

```text
fieldId = F1
canonicalKey = FIELD|db.user.id
```

和：

```text
fieldId = F2
canonicalKey = FIELD|db.order.id
```

要求：

```text
F1 != F2
```

---

## 37. comment 更新验收

初始：

```text
originName = battery_48v_cnt
sourceComment = 48V电池数
customName = null
displayName = 48V电池数
```

数据库 comment 改为：

```text
48V电池数量
```

reconcile：

```text
fieldId 不变
sourceComment = 48V电池数量
displayName = 48V电池数量
```

---

## 38. customName 验收

数据库：

```text
sourceComment = 在租用户数
```

用户设置：

```text
customName = 租用中用户数
```

结果：

```text
displayName = 租用中用户数
```

数据库 comment 后续改成：

```text
正在租赁用户数
```

结果仍然：

```text
displayName = 租用中用户数
```

用户清空：

```text
customName = null
```

结果：

```text
displayName = 正在租赁用户数
```

---

## 39. Chart 回归

历史 Chart 无 fieldId：兼容模式必须仍能打开。

迁移后有 fieldId：必须优先依靠 fieldId 找字段。

用户修改 Dataset Field 名称后：

```text
不修改 Chart JSON
```

重新打开 Chart：

```text
自动显示新名字
```

这条是架构改造成功的核心验收标准。

---

## 40. 前端验收

搜索：

```bash
grep -R "isDisplayNameCustom" frontend/src
grep -R "getFieldCustomDisplayName" frontend/src
grep -R "getFieldDisplayName" frontend/src
```

第一阶段允许 Legacy Compatibility 存在。

最终要求：正常业务运行逻辑不再依赖这些 fallback。

---

## 41. 后端最终链路

目标：

```text
数据库 Schema
       ↓
SourceSchemaIndex
       ↓
ViewFieldService.reconcile
       ↓
view_field
       ↓
ViewFieldDTO
       ↓
displayName
       ↓
Frontend
```

禁止继续依赖：

```text
Schema
 ↓
View.model
 ↓
Hierarchy
 ↓
ChartConfig
 ↓
Frontend Utils
 ↓
重新判断 displayName
```

---

## 42. sourceComment / customName 严格来源

必须保证：

```text
sourceComment → 只来源于数据库 metadata
customName → 只来源于用户明确修改
```

迁移时禁止：

```java
customName = comment;
```

---

## 43. Legacy FieldMetaResolver 定位

现有 `FieldMetaResolver` 继续用于：

```text
legacy View.model
       ↓
解析历史 displayName/comment/isDisplayNameCustom
       ↓
构造 ViewField
```

新架构稳定后，它只属于：

```text
legacy migration
```

不再参与正常运行。

---

## 44. Verify 建议新增指标

```text
viewFields
fieldIdCoverage
chartFieldIdCoverage
inactiveReferencedFields
duplicateCanonicalKeys
unresolvedSqlFields
legacyMetadataRemaining
```

理想结果：

```text
fieldIdCoverage = 100%
chartFieldIdCoverage = 100%
duplicateCanonicalKeys = 0
unresolvedSqlFields = 0
blockingIssues = 0
```

达到后才能执行 Phase 5。

---

## 45. 日期问题独立处理

本任务禁止修改：

```text
AGG_DATE_*_NATIVE
DATE_TRUNC
00:00:00
```

本次只解决：

```text
Field Metadata Identity
```

日期问题属于独立的 `Date Aggregation Semantics` 任务，必须分开提交和回归。

---

# 46. 可直接交给另一个 AI 的执行 Prompt

```text
基于仓库 NJgaoyang/datart 的 dev202608182 开始工作。

本任务不是修复某一个字段显示 Bug，而是建立稳定的 Dataset/View Field 元数据架构。

最终设计必须满足：

fieldId = 字段唯一身份
originName = 原始物理/SQL 输出字段名
sourceComment = 数据库字段注释
customName = 用户明确设置的数据集字段名称

displayName =
customName
?? sourceComment
?? originName

`displayName` 不持久化，由后端 ViewFieldService 统一计算并返回。

前端、Chart、Hierarchy、SQL Preview 均不得自行计算上述优先级。

Datart 中 View 就是 Dataset，因此实现名称使用 ViewField / ViewFieldService。

第一阶段新增 view_field 表、ViewField entity/mapper/service/DTO，只建立单一事实源，不删除旧 JSON metadata。

第二阶段 View create/update 调用 ViewFieldService.reconcile()，ViewDetailDTO 返回 fields。

第三阶段扩展现有 FieldMetaMigrationService，通过 scan → migrate → verify → rollback 为历史 View 和 Chart 增加 fieldId。Flyway 只建表，不自动修改历史业务 JSON。

第四阶段前端 ChartDataViewMeta、ChartDataSectionField 增加 fieldId，并优先通过 fieldId 找字段。前端只能直接使用后端给出的 displayName。Chart 自身 alias 功能保留，其优先级为 chart alias > ViewField.displayName。

第五阶段只有在 fieldIdCoverage 和 chartFieldIdCoverage 均达到 100%、所有 blocking issue 为 0 后，才允许清理 View.model / ChartConfig 中历史 displayName/comment/isDisplayNameCustom。

必须复用现有 SourceSchemaIndex 精确 path 获取数据库 comment；禁止按照全库同名字段猜 comment。

STRUCT/JOIN 字段使用完整 sourcePath 生成 canonicalKey。同名 A.id 和 B.id 必须得到不同 fieldId。

SQL View 无法确定 lineage 时 sourceComment 必须为 null；禁止按原字段名猜数据库注释。SQL 最终输出列名重复时必须报 BLOCKING，并要求使用 alias。

日期层级不得创建新的 Dataset Field metadata 副本，继续引用父 fieldId，并由 dateLevel/expression 表达粒度。

字段 comment/customName/displayName 变化不得修改 fieldId。字段暂时从 Schema 消失时先 active=false，不物理删除。

不允许修改具体柱状图/折线图/饼图等实现来解决字段名称。

不允许修改日期 00:00:00 问题。

不允许修改打包脚本。

不允许覆盖已有数据视图列宽以及 SQL 字段显示修复。

开始前必须执行：

git status
git branch --show-current
git log -5 --oneline

如果工作区存在修改，禁止 reset、checkout 覆盖或 clean。

每个 Phase 独立提交，不允许把 5 个阶段压成一个大提交。

每阶段完成后执行后端测试、前端 typecheck 和相关单测，并汇报：

修改文件
新增文件
数据库变更
行为变化
兼容逻辑
测试结果
尚未完成项目

在 Phase 1–4 未全部验证完成前，禁止执行 legacy cleanup。
```

---

# 47. 推荐实际执行顺序

第一轮只完成：

```text
Phase 1 + Phase 2
```

即：

```text
view_field 建立
        +
ViewFieldService 建立
        +
View 保存时 reconcile
        +
ViewDetailDTO 返回 fields
```

暂时不要立即做 Chart / 前端大迁移。

完成后先验证：

```sql
SELECT
    id,
    view_id,
    canonical_key,
    origin_name,
    source_comment,
    custom_name,
    active
FROM view_field
WHERE view_id = 'xxx';
```

确认：

```text
fieldId 唯一稳定
JOIN 同名不冲突
数据库 comment 正确
customName 正确
字段失效 active 正确
```

稳定后再进入 Phase 3 / Phase 4。

---

# 48. 最终验收标准

```text
1. 用户修改 customName，不修改 fieldId。
2. 数据库 comment 修改，不修改 fieldId。
3. 用户清空 customName，自动回退 sourceComment。
4. sourceComment 为空，自动回退 originName。
5. JOIN 同名字段绝不冲突。
6. SQL alias 不猜数据库 comment。
7. Chart 不再复制或决定字段 metadata。
8. Hierarchy 不再复制字段 metadata。
9. 前端不再计算 customName/comment/originName 优先级。
10. 修改 Dataset Field 名称后，无需改 Chart JSON，所有 Chart 自动显示新名称。
11. 历史 View/Chart 可通过 scan/migrate/verify/rollback 安全迁移。
12. fieldIdCoverage = 100% 后才能清理 legacy metadata。
```
