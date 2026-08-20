# dev202608191 — ViewField SQL 字段元数据稳定化实施交接方案

> 用途：直接交给另一个 AI / 开发者执行。  
> 仓库：`NJgaoyang/datart`  
> 分支：`dev202608191`  
> 本次审查基线 HEAD：`4d0d654ec3bc7f0bc44bf7b1dccd36651e00185d`  
> 基线提交信息：`fix: preserve legacy chart field labels`  
> 阶段建议命名：**Phase 4.4 — SQL View Field Metadata Stabilization**

---

## 0. 任务目标

当前运行时主链路已经恢复：

- Dashboard / 报表可以正常打开。
- SQL 查询可以正常执行。
- 之前 `fields` 重复空列表序列化成 `$ref` 导致前端 `.map is not a function` 的问题已经解决。
- 最新提交已经补了 Chart 历史字段 label 的兼容逻辑。

**当前剩余的核心问题：**

> TABLE/STRUCT 类型 View 的字段基本都显示中文，但 SQL View 的字段出现“部分中文、部分英文”。

本阶段不是让系统“把所有 SQL 英文字段自动翻译成中文”，而是：

1. **凡是历史上已有可信中文元数据的字段，必须恢复并持久保存。**
2. **用户明确修改过的字段名必须进入 `customName`，后续 SQL refresh/reconcile 不得覆盖。**
3. **没有可信中文来源的 SQL 表达式 alias，允许继续显示 `originName` 英文，禁止猜测。**
4. `fieldId`、SQL 查询身份和展示名称继续彻底解耦。
5. 在真正 migrate 之前，把 `view_field` 的回滚完整性补齐。

---

# 1. 不允许重新设计的架构

本阶段必须继续使用现有 ViewField 方案，不要 1:1 改造成 DataEase 模型。

最终语义固定为：

```text
fieldId
    = 稳定字段身份

originName
    = 物理字段名 / SQL 输出字段名
    = 查询身份
    ≠ 用户展示名

sourceComment
    = 可信来源的字段注释
    = 数据库 comment / 历史可信 model comment

customName
    = 用户明确设置的数据集字段名称

displayName
    = customName ?? sourceComment ?? originName
    = 运行时计算
    = 不作为字段身份
```

Chart 层继续保持：

```text
Chart alias
    >
ViewField.displayName
```

不要把 Chart alias、ViewField customName、SQL originName 混在一起。

---

# 2. 本阶段硬边界

另一个 AI 开始修改前必须遵守：

1. 不做 chart-by-chart 的字段中文修复。
2. 不在每个图表类型里复制 display fallback。
3. 不允许根据 `originName` 在全库搜索同名列并猜 comment。
4. `displayName` 不能作为 identity。
5. `customName` 不能用于 SQL 查询。
6. comment/customName/displayName 改变不能生成新 `fieldId`。
7. date hierarchy/dateLevel 不能生成新的 metadata identity。
8. Phase 5 之前保留 legacy View.model 双轨兼容。
9. 不删除现有 migration service。
10. 只维护 V3 schema，不重新引入旧 schema。
11. 历史 JSON 只能走 `scan -> migrate -> verify`。
12. SQL 字段来源不确定时，不得自动猜。
13. SQL duplicate output name 必须 BLOCK。
14. 不处理日期 `00:00:00` 问题。
15. 不修改 `bin/build.sh` 或打包逻辑。
16. 不覆盖无关的现有修复。
17. 不 hard reset、不 force overwrite 用户改动。
18. 不做无关的大范围重构。
19. 当前报表已经能正常打开，**冻结 Dashboard/Chart/query runtime 主链路**，除非新测试证明本阶段修改导致回归。

---

# 3. 已审查的当前代码状态

## 3.1 当前分支 HEAD

审查时：

```text
branch: dev202608191
HEAD:   4d0d654ec3bc7f0bc44bf7b1dccd36651e00185d
commit: fix: preserve legacy chart field labels
```

**执行 AI 开始工作时必须先重新确认 HEAD。**

如果分支已经前进：

- 先阅读新的 commit/diff。
- 不要把本方案机械覆盖到更新后的代码。
- 保留所有已存在的 runtime 修复。

---

## 3.2 `ViewFieldServiceImpl` 当前已经完成的部分

路径：

```text
server/src/main/java/datart/server/service/impl/ViewFieldServiceImpl.java
```

当前已有：

- `fieldId`
- `originName`
- `sourceComment`
- `customName`
- `resolveDisplayName()`
- `reconcile(View view)`
- inactive field 保留
- SQL duplicate output name 检测
- exact schema lookup
- legacy resolver
- `updateCustomName`
- 独立 `ArrayList` 返回，避免 `$ref` 空列表复用问题

`resolveDisplayName()` 已符合：

```java
customName != null
    ? customName
    : sourceComment != null
        ? sourceComment
        : originName;
```

这部分不要重写。

---

## 3.3 canonical key 当前正确，不改

`ViewFieldKey` 当前规则：

```text
SQL:
    SQL|originName

STRUCT/JOIN:
    full source path
```

这符合当前架构。

不要将：

- displayName
- customName
- comment

加入 canonical key。

---

## 3.4 `SourceSchemaIndex.exact()` 当前正确，不改成全局猜测

当前 exact lookup 只根据明确 source path 找真实列。

这是需要保留的安全边界。

禁止实现：

```text
originName = "city"
    ↓
扫描所有表
    ↓
找到任意 city.comment
    ↓
自动作为 sourceComment
```

因为 `city/status/name/id` 等列在多个表中可能同名但语义不同。

---

## 3.5 最新前端 Chart label 兼容已经完成

当前 HEAD 提交本身就是：

```text
fix: preserve legacy chart field labels
```

因此：

**不要重新改 `internalChartHelper.ts` 来解决 SQL View 字段中英混合。**

当前问题首先属于 Dataset/ViewField 元数据层。

只有测试证明 Chart 层仍有新问题时，才允许最小修改。

---

# 4. 当前代码中的核心缺口

---

## P0-1：正常 `reconcile()` 不能负责“历史 customName 回填”

当前逻辑只有在：

```java
field == null
```

新建 ViewField 时才执行类似：

```java
field.setCustomName(legacyCustomName(...));
```

这会导致一个现实问题：

### 场景

早期 migration/reconcile 已经创建：

```text
view_field
fieldId = F1
originName = net_increase_users
customName = null
```

但 legacy `View.model` 仍然能够确定：

```text
displayName = 在租用户较昨日净增人数
isDisplayNameCustom = true
```

现在正常 `reconcile()` 因为 field 已存在，不会再回填 `customName`。

于是 SQL View 继续显示：

```text
net_increase_users
```

### 但不能简单把正常 reconcile 改成：

```java
if (field.getCustomName() == null) {
    field.setCustomName(legacyCustomName(...));
}
```

因为现有 API 支持：

```http
PATCH /views/{viewId}/fields/{fieldId}
{
  "customName": null
}
```

其语义是“用户主动恢复默认”。

如果正常 reconcile 每次都从 legacy model 重新回填，则：

```text
用户 customName -> null
    ↓
下一次 reconcile
    ↓
旧 model displayName 又被恢复
```

用户永远无法真正清除自定义名。

### 正确方案

把“历史 legacy metadata 回填”做成 **migration-only 行为**。

建议新增明确的方法，例如二选一：

```java
void reconcileForMigration(View view);
```

或：

```java
void migrateLegacyMetadata(View view);
```

推荐第二种语义更清晰。

正常：

```java
reconcile(View view)
```

只负责：

- identity reconcile
- technical metadata refresh
- active/inactive
- trusted source metadata refresh
- 永远不把 legacy custom displayName 重新灌入已存在且 customName=null 的字段

migration-only 方法才负责：

```text
已有 view_field.customName == null
+
legacy resolver 能明确判断“历史 displayName 是用户自定义”
    ↓
回填 customName
```

同时：

```text
已有 non-null customName
    → 永远不覆盖
```

---

# 5. P0-2：`sourceComment == null` 必须表示“本次无可信新值”，不能清空历史值

当前 `reconcile()` 每次都会：

```java
field.setSourceComment(sourceComment(...));
```

而 `sourceComment()` 在某些路径会返回 null。

特别是：

```text
COMPUTED
```

当前可能直接返回 null。

这意味着：

```text
existing.sourceComment = 中文
    ↓
本次 resolver 返回 null
    ↓
setSourceComment(null)
    ↓
历史中文丢失
```

这是不安全的。

## 改造要求

区分：

```text
“解析不到新 sourceComment”
```

和：

```text
“明确要求删除 sourceComment”
```

本阶段没有“自动删除 sourceComment”的需求。

推荐：

```java
String resolved = resolveTrustedSourceComment(...);

if (resolved != null) {
    field.setSourceComment(resolved);
}

// resolved == null:
// 对已有字段保留 existing sourceComment
```

如果是新字段：

```text
resolved == null
→ sourceComment = null
```

即可。

---

# 6. P0-3：SQL View 的 sourceComment 解析策略

本阶段为了兼容历史 SQL View，建议固定为：

```text
SQL View:

1. legacy/current View.model 的可信 comment
   - columns.comment
   - hierarchy.comment

2. exact schema comment
   - 仅当 sourcePath 能严格证明真实 lineage

3. existing view_field.sourceComment

4. null
```

为什么 SQL 兼容期优先 model comment：

- SQL View 输出已经是结果集字段。
- 历史 model 中可能保存了过去已经确认的中文。
- SQL expression alias 并不一定对应物理列。
- 即使同名，也不能通过全库同名推导。

对于 STRUCT/JOIN，可以继续：

```text
exact schema comment
    ↓
legacy model comment
    ↓
existing sourceComment
    ↓
null
```

如果执行 AI 认为应该统一顺序，必须先用现有真实 SQL View + 测试证明不会把历史中文覆盖掉。

---

# 7. P0-4：不要继续依赖 `refs.get(0)` / `refs.get(1)` 的隐含位置

当前 `collectReferences()` 先收：

```text
columns
hierarchy
computedFields
```

而：

```java
ObjectNode column = refs.get(0);
ObjectNode hierarchy = refs.get(1);
```

依赖了“List 顺序等于元数据角色”。

这对于当前数据可能可用，但 migration 核心逻辑不应该依赖隐含顺序。

## 推荐最小改造

不要大范围重构。

可以引入一个窄范围结构，例如：

```java
record FieldReferences(
    ObjectNode column,
    ObjectNode hierarchy,
    List<ObjectNode> computed
) {}
```

或者至少提供 helper：

```java
private LegacyFieldNodes resolveLegacyNodes(
    String fieldKey,
    List<ObjectNode> refs
)
```

明确识别：

- column
- hierarchy
- computed

随后：

```java
legacyResolver.resolve(...)
```

永远拿到正确角色。

如果不想改变 `collectReferences()` 返回类型，也必须写测试证明：

- columns only
- hierarchy only
- columns + hierarchy
- computed

都不会错位。

---

# 8. P0-5：Migration rollback 当前对 `view_field` 不完整

这是执行 migrate 前必须处理的安全问题。

当前：

```text
FieldMetaMigrationServiceImpl.migrateViews()
```

会调用：

```java
viewFieldService.reconcile(view.view());
```

这个调用会：

- INSERT view_field
- UPDATE view_field
- 更新 customName/sourceComment/active 等数据库状态

但是当前：

```text
rollback(runId)
```

主要恢复：

- view.model
- widget.config
- datachart.config

对应：

```text
field_meta_migration_backup
```

中的 JSON。

**当前没有看到对 `view_field` insert/update 的完整 backup + restore。**

因此：

```text
migrate
→ view_field 被修改
→ rollback
→ JSON 恢复
→ view_field 仍然是迁移后的状态
```

这不是真正完整的 rollback。

## 本阶段要求

在真正执行 migration 前，必须二选一：

### 推荐方案 A：把 ViewField 纳入 migration backup

新增 migration batch 对 ViewField 的备份能力。

至少需要覆盖：

```text
id
view_id
canonical_key
origin_name
source_comment
custom_name
source_path
field_type
field_category
expression
ordinal
active
create/update metadata（按实际表字段）
```

rollback 时：

- migration 新增的 ViewField → 删除
- migration 更新的 ViewField → 恢复原值
- migration 标 inactive 的 ViewField → 恢复原 active 状态

并做 conflict/hash/版本检查，避免覆盖 migration 后用户的新编辑。

### 备选方案 B：单独设计 ViewField migration journal

如果不想复用 `field_meta_migration_backup`，可以新建明确的：

```text
field_meta_migration_view_field_backup
```

或 migration change log。

但不要用“rollback 后再 reconcile 一次”来假装恢复，因为：

- 用户自定义名可能已经改变。
- legacy model 已被改过。
- reconcile 不是精确逆操作。

**在这个 P0 未解决之前，不允许对生产/真实数据执行 migrate。**

---

# 9. Migration-only legacy metadata backfill 规则

这是解决 SQL 中英混合的核心。

---

## 9.1 historical explicit custom displayName

旧 model：

```json
{
  "name": ["net_increase_users"],
  "displayName": "在租用户较昨日净增人数",
  "isDisplayNameCustom": true
}
```

迁移目标：

```text
originName    = net_increase_users
customName    = 在租用户较昨日净增人数
sourceComment = null / 已有可信 comment
```

以后：

```text
SQL refresh
View reconcile
schema comment 改动
```

都不能覆盖 `customName`。

---

## 9.2 legacy normal comment

例如：

```json
{
  "name": ["city"],
  "comment": "城市"
}
```

迁移：

```text
originName    = city
customName    = null
sourceComment = 城市
displayName   = 城市
```

---

## 9.3 columns 无 comment、hierarchy 有 comment

例如：

```text
columns.city.comment = null
hierarchy.city.comment = 城市
```

必须：

```text
sourceComment = 城市
```

不能只检查第一个 ref。

---

## 9.4 existing customName 已有值

例如：

```text
existing.customName = 所属城市
legacy displayName   = 城市名称
```

结果必须：

```text
customName = 所属城市
```

migration 不得覆盖已有用户业务名。

---

## 9.5 existing sourceComment 已有值，而本次解析不到

例如：

```text
existing.sourceComment = 在租用户数
current resolver = null
```

必须：

```text
sourceComment = 在租用户数
```

---

## 9.6 SQL expression alias 没有任何可信中文来源

例如：

```sql
round(t2.renting_users / t1.in_use_count, 2)
AS cabinet_efficiency
```

而：

```text
legacy model comment = null
legacy customName = null
exact schema lineage = none
existing sourceComment = null
existing customName = null
```

正确结果：

```text
originName    = cabinet_efficiency
sourceComment = null
customName    = null
displayName   = cabinet_efficiency
```

**这是合法结果，不是 migration failure。**

禁止自动生成：

```text
电柜效率
```

也禁止找数据库里别的 `cabinet_efficiency` 同名列来猜。

---

# 10. 建议的代码改造结构

以下是推荐结构，不要求逐字照抄，但语义必须保持。

---

## 10.1 `ViewFieldService`

当前：

```java
void reconcile(View view);
```

建议增加 migration-only API：

```java
void migrateLegacyMetadata(View view);
```

或者：

```java
void reconcileForMigration(View view);
```

推荐：

```java
migrateLegacyMetadata
```

因为它表达的是“一次性历史 backfill”，避免以后 runtime 误调用。

---

## 10.2 正常 `reconcile()`

正常 reconcile 只负责：

```text
match/create field identity
refresh originName
refresh sourcePath
refresh type/category/expression
refresh ordinal
active/inactive
refresh trusted sourceComment when non-null
write fieldId into current model refs
```

**不要对已有字段从 legacy displayName 回填 customName。**

---

## 10.3 `migrateLegacyMetadata()`

建议：

```text
1. 先按正常规则完成 identity reconcile
2. 对每一个 canonical field：
   - existing customName != null
       → 保留
   - existing customName == null
       + legacy resolver 明确 displayNameCustom=true
       → 回填 customName
   - existing sourceComment == null
       + legacy/current model 有可信 comment
       → 回填 sourceComment
3. 不改变 fieldId
4. 不根据 displayName 生成 canonical key
5. 不全局猜 schema comment
```

如果为了避免 reconcile 后 model 结构变化导致 source refs 消失，应在 migration service 中先提取 migration metadata snapshot，再应用。

---

# 11. `FieldMetaMigrationServiceImpl` 修改建议

路径：

```text
server/src/main/java/datart/server/service/impl/FieldMetaMigrationServiceImpl.java
```

当前 `migrateViews()` 大致：

```text
apply ViewModelMigrator
→ viewFieldService.reconcile(view)
→ update view.model
```

建议调整为明确的迁移流程：

```text
1. 从 original model 建 migration candidate / legacy metadata snapshot
2. 执行 blocking validation
3. 备份 View JSON
4. 备份即将 insert/update 的 ViewField 状态
5. 执行 ViewModelMigrator
6. 执行 migration-only ViewField metadata backfill
7. reconcile identity/model fieldId
8. 更新 View.model
9. 刷新 snapshot viewFields
```

注意实际步骤 5~7 可以根据代码最小侵入调整，但必须保证：

- legacy custom displayName 在被 `ViewModelMigrator` 删除前已经被识别/保存。
- ViewField change 在写入数据库前有 rollback 信息。
- migration 中途失败时不会留下半迁移状态。

---

# 12. Scan 必须增强可观测性

现在不能只看：

```text
total
modified
conflicts
unresolved
```

对于 SQL View 中英混合，需要能够回答：

> 哪些英文是“可恢复但还没迁移”，哪些英文是“本来就没有可信中文来源”？

建议新增统计，至少在 View scope 或 issue diagnostics 中能看到：

```text
sqlViews
sqlFields

recoverableCustomNames
recoverableLegacyComments
recoverableExactSchemaComments

existingCustomNames
preservedExistingComments

unresolvedSqlFields
blockingSqlConflicts
```

如果修改 DTO 成本较大，可以先通过 migration issue reason + count 实现，但必须可审计。

建议 issue reason：

```text
SQL_CUSTOM_NAME_RECOVERABLE
SQL_COMMENT_RECOVERABLE_FROM_COLUMNS
SQL_COMMENT_RECOVERABLE_FROM_HIERARCHY
SQL_COMMENT_RECOVERABLE_FROM_EXACT_SCHEMA
SQL_COMMENT_PRESERVED_EXISTING
SQL_FIELD_NO_TRUSTED_DISPLAY_METADATA
SQL_OUTPUT_COLUMN_DUPLICATED
```

其中：

```text
SQL_FIELD_NO_TRUSTED_DISPLAY_METADATA
```

应是 INFO/WARN，**不是自动 BLOCK**。

而：

```text
SQL_OUTPUT_COLUMN_DUPLICATED
```

必须 BLOCK。

---

# 13. 必须增加的后端测试

路径主要关注：

```text
server/src/test/java/datart/server/service/impl/ViewFieldServiceImplTest.java
server/src/test/java/datart/server/common/fieldmeta/FieldMetaMigrationTest.java
```

以及必要的 migration service integration test。

至少新增以下用例。

---

## 13.1 normal reconcile 不复活用户已清除的 customName

步骤：

```text
legacy model 有 custom displayName
existing view_field.customName = null
调用 normal reconcile
```

期望：

```text
customName 仍然 null
```

这是防止 PATCH null 后被旧 model 复活的关键测试。

---

## 13.2 migration-only backfill customName

```text
legacy model:
displayName = 在租用户较昨日净增人数
isDisplayNameCustom = true

existing:
customName = null
```

执行 migration-only：

```text
customName = 在租用户较昨日净增人数
```

且：

```text
fieldId 不变
```

---

## 13.3 existing customName 永不被 migration 覆盖

```text
existing.customName = 用户自定义A
legacy.customName    = 历史B
```

期望：

```text
用户自定义A
```

---

## 13.4 SQL columns.comment

```text
columns.comment = 创建时间
```

期望：

```text
sourceComment = 创建时间
```

---

## 13.5 SQL hierarchy.comment fallback

```text
columns.comment = null
hierarchy.comment = 城市
```

期望：

```text
sourceComment = 城市
```

---

## 13.6 SQL exact schema comment

仅当：

```text
sourcePath 精确定位 schema/table/column
```

时：

```text
sourceComment = schema comment
```

禁止 same-name guess。

---

## 13.7 existing sourceComment 不被 null 清空

```text
existing.sourceComment = 中文
current resolver = null
```

正常 reconcile 后：

```text
sourceComment = 中文
```

---

## 13.8 SQL expression alias 没 metadata

```text
originName = cabinet_efficiency
comment = null
custom = null
exact schema = none
```

期望：

```text
displayName = cabinet_efficiency
```

测试必须明确说明：

**这不是 failure。**

---

## 13.9 field identity stability

修改：

```text
sourceComment
customName
displayName
```

前后：

```text
fieldId 相同
canonicalKey 相同
```

---

## 13.10 inactive field

字段从当前 model 消失：

```text
active = false
fieldId 保留
row 不删除
```

字段之后恢复，若 canonical key 相同：

```text
复用同 fieldId
```

---

## 13.11 SQL duplicate output alias

SQL 同一结果存在重复 output name：

```text
SQL_OUTPUT_COLUMN_DUPLICATED
```

scan/verify 必须 BLOCK。

---

## 13.12 migration rollback — existing ViewField update

migration 前：

```text
sourceComment/customName/active = old
```

migration 后变化。

rollback 后：

```text
完全恢复 old
```

---

## 13.13 migration rollback — inserted ViewField

migration 新插入一条 ViewField。

rollback 后：

```text
该 migration-created row 被删除
```

---

## 13.14 rollback conflict

migration 后用户又 PATCH 了：

```text
customName
```

此时 rollback：

```text
不能静默覆盖用户新修改
```

应检测 conflict 并拒绝/明确报告。

---

# 14. 前端本阶段只做回归验证，不主动重构

当前 HEAD 已经修：

```text
preserve legacy chart field labels
```

因此本阶段 frontend 任务主要是验证：

1. Dashboard 正常打开。
2. Chart 正常打开。
3. SQL View field list 显示 `ViewField.displayName`。
4. TABLE View 中文不退化。
5. customName PATCH 后立即显示。
6. customName=null 后恢复：
   ```text
   sourceComment ?? originName
   ```
7. normal refresh/reopen 后 customName=null 不会被旧 model 复活。
8. Chart alias 仍然高于 ViewField.displayName。

除非测试失败，不要再次改 Chart label reconciliation。

---

# 15. 真实问题 View 的抽查标准

已知需要重点抽查的 SQL View：

```text
新用户日报
```

示例目标：

```text
created_date
→ 创建时间

city
→ 城市

net_48v_increase_users
→ 48V在租用户较昨日净增人数

net_60v_increase_users
→ 60V在租用户较昨日净增人数

net_72v_increase_users
→ 72V在租用户较昨日净增人数
```

对于：

```text
net_increase_users
```

必须根据历史可信元数据判断：

### 如果 legacy model 中存在：

```text
explicit custom displayName
或可信 comment
```

则：

```text
恢复中文
```

### 如果 legacy model / exact schema / existing ViewField 全部没有中文

则：

```text
displayName = net_increase_users
```

这是正确结果。

不要人为“补译”。

---

# 16. 执行顺序

必须严格按下面顺序。

---

## Step 1 — Preflight

```bash
git status
git branch --show-current
git rev-parse HEAD
```

确认：

```text
branch = dev202608191
```

记录当前 HEAD。

如果不是本文基线 `4d0d654...`，先检查后续 commit。

禁止：

```bash
git reset --hard
git checkout -- .
git clean -fd
```

除非用户明确授权。

---

## Step 2 — 只读确认当前代码

重新确认：

```text
ViewFieldServiceImpl
FieldMetaResolver
ViewModelMigrator
FieldMetaMigrationServiceImpl
FieldMetaMigrationController
ViewFieldService
ViewFieldController
SourceSchemaIndex
ViewFieldKey
相关 tests
```

确保没有新的实现已经解决本文某个 P0。

---

## Step 3 — 先写测试复现，不先大改实现

先新增失败测试：

```text
normal reconcile 不复活 customName
migration-only customName backfill
existing sourceComment preservation
SQL hierarchy comment fallback
rollback ViewField changes
```

让测试明确暴露当前缺口。

---

## Step 4 — 实现 migration-only legacy metadata backfill

优先新增清晰的 migration-only service API。

不要污染 normal runtime reconcile 的 customName reset 语义。

---

## Step 5 — 修 sourceComment preservation

确保：

```text
resolver null != clear existing
```

并完成 SQL / STRUCT 解析优先级测试。

---

## Step 6 — 修 ViewField rollback

这是 migrate 前 P0。

做到：

```text
migration-created ViewField 可删除
migration-updated ViewField 可恢复
migration-after-user-edit 能检测 conflict
```

---

## Step 7 — 增强 scan diagnostics

让 scan 能区分：

```text
可恢复中文
vs
真正无可信中文
vs
SQL blocking conflict
```

---

## Step 8 — 跑后端 targeted tests

至少：

```text
FieldMetaMigrationTest
ViewFieldServiceImplTest
新增 migration rollback/integration tests
```

所有必须通过。

---

## Step 9 — 跑 frontend regression tests + TypeScript

重点是防止：

```text
Dashboard/Chart runtime
legacy labels
fieldId fallback
```

出现回归。

当前已有运行时修复必须全部保住。

---

## Step 10 — 完整 server build/package

按照仓库当前已经验证过的标准构建方式执行。

不要修改 `bin/build.sh` 来绕测试。

---

## Step 11 — 只执行 scan

现有接口：

```http
GET /admin/field-meta-migration/scan?orgId={orgId}
```

此时：

**不要 migrate。**

检查：

```text
blocking SQL conflicts = 0
recoverable custom names
recoverable comments
unresolved SQL fields
```

并人工抽查问题 SQL View。

---

## Step 12 — 人工审核 scan

重点查看：

```text
net_increase_users
cabinet_efficiency
48V_battery_ratio
60V_battery_ratio
72V_battery_ratio
```

每个英文必须能解释为什么：

```text
有可信中文 → 应恢复
无可信中文 → 保持英文
```

不能存在：

```text
明明 legacy 有中文但 scan 判 unresolved
```

---

## Step 13 — migrate

只有 scan 正确、P0 rollback 已完成后：

```http
POST /admin/field-meta-migration/migrate
```

必须使用最新 scan 返回的：

```text
expectedScanToken
```

不要复用旧 token。

---

## Step 14 — verify

```http
GET /admin/field-meta-migration/verify?orgId={orgId}
```

确认：

```text
blocking issues = 0
duplicate SQL aliases = 0
dangling fieldId = 0
unexpected unresolved = 0
```

“真正没有可信中文来源”的 SQL 字段允许作为非 blocking diagnostics 存在。

---

## Step 15 — rollback 演练

在测试/安全环境至少演练一次：

```http
POST /admin/field-meta-migration/{runId}/rollback
```

确认：

```text
View.model 恢复
Widget/DataChart JSON 恢复
ViewField INSERT/UPDATE 也恢复
```

不能只验证 JSON。

---

# 17. 最终验收标准

本阶段完成后必须全部满足。

### Runtime

- 所有现有 Dashboard/报表继续正常打开。
- 不出现 `$ref` 导致的 `map is not a function`。
- SQL 查询执行逻辑不退化。
- TABLE View 中文显示不退化。

### ViewField

- `fieldId` 稳定。
- `originName` 保持查询身份。
- `customName` 永不被正常 reconcile 覆盖。
- `customName=null` 后不会被 legacy model 自动复活。
- 新可信 `sourceComment` 可更新。
- resolver 无值时不清空历史 `sourceComment`。
- inactive field 不物理删除。

### SQL View 中文/英文

- 历史有可信中文 → 恢复。
- 用户自定义中文 → `customName` 持久保存。
- 无可信中文 → 合法显示 `originName` 英文。
- 不做全库同名猜 comment。
- 不做自动中英翻译。

### Migration

- scan 不修改数据。
- migrate 必须使用 scan token。
- SQL duplicate alias BLOCK。
- migration 写入 ViewField 可完整 rollback。
- rollback 不覆盖 migration 后用户的新编辑。
- verify 可审计。

### Chart

- Chart alias > ViewField.displayName。
- 已修复的 legacy chart labels 不退化。
- 不新增 chart-specific naming patch。

---

# 18. 本阶段完成后再进入 Phase 4.5

本阶段完成前：

**不要进入 Phase 5 cleanup。**

Phase 4.5 readiness 后续建议指标：

```text
viewFields
viewFieldReferences
viewFieldIdReferences
fieldIdCoverage

chartFieldReferences
chartFieldIdReferences
chartFieldIdCoverage

inactiveReferencedFields
duplicateCanonicalKeys
unresolvedSqlFields
legacyMetadataRemaining
blockingIssues
cleanupReady
```

建议 gate：

```java
cleanupReady =
    fieldIdCoverage == 100D
    && chartFieldIdCoverage == 100D
    && inactiveReferencedFields == 0
    && duplicateCanonicalKeys == 0
    && unresolvedSqlFields == 0
    && blockingIssues == 0;
```

注意：

```text
legacyMetadataRemaining
```

可以报告，但不应单独 BLOCK Phase 5，因为 Phase 5 本来就负责删除 legacy metadata。

---

# 19. 建议修改文件清单

优先：

```text
server/src/main/java/datart/server/service/ViewFieldService.java

server/src/main/java/datart/server/service/impl/ViewFieldServiceImpl.java

server/src/main/java/datart/server/service/impl/FieldMetaMigrationServiceImpl.java

server/src/main/java/datart/server/common/fieldmeta/FieldMetaResolver.java
    （仅在现有 resolver 无法可靠区分 refs 时最小修改）

server/src/main/java/datart/server/base/dto/FieldMetaMigrationScope.java
    （如采用新增 scan counters）

相关 migration backup entity/table/mapper/sql
    （按当前项目实现方式新增 ViewField backup）
```

测试：

```text
server/src/test/java/datart/server/service/impl/ViewFieldServiceImplTest.java

server/src/test/java/datart/server/common/fieldmeta/FieldMetaMigrationTest.java

建议新增：
server/src/test/java/datart/server/service/impl/FieldMetaMigrationServiceImplTest.java
或对应 integration test
```

前端：

```text
默认不改。
仅跑回归测试。
```

---

# 20. 明确不要改的文件/区域

除非新测试直接证明必要，否则不要修改：

```text
bin/build.sh

Dashboard permission/runtime enrichment

Chart query builder

SQL execution engine

date 00:00:00 相关逻辑

canonical key 规则

SourceSchemaIndex exact 机制

Chart 各具体图表类型

最新的 legacy chart field labels 修复
```

---

# 21. 给执行 AI 的最终指令

你正在处理 `NJgaoyang/datart` 的 `dev202608191` 分支。

你的任务不是重新设计 ViewField，而是完成：

```text
Phase 4.4 — SQL View Field Metadata Stabilization
```

首先重新确认当前 HEAD 和 diff。

核心目标：

1. migration-only 恢复历史 explicit custom displayName 到 `ViewField.customName`；
2. normal reconcile 绝不复活用户通过 PATCH null 清除的 customName；
3. sourceComment resolver 返回 null 时不清空已有可信值；
4. SQL 字段优先恢复历史可信 comment，只允许 exact lineage schema comment，禁止 same-name guess；
5. migration 对 `view_field` 的 INSERT/UPDATE 必须可完整 rollback；
6. scan 能区分“可恢复中文”和“真正没有中文来源”；
7. 先补测试，再修改实现；
8. 完成后只先 scan，人工审核后才能 migrate；
9. migrate 后 verify，并做 rollback 演练；
10. 不动已经稳定的 Dashboard/Chart/query runtime 主链路。

任何 SQL expression alias 在无可信中文来源时保持英文是正确行为，不要翻译或猜测。

不要 hard reset、不要 force overwrite、不要修改无关文件。

完成时输出：

```text
- 修改文件
- 核心行为变化
- 新增测试与结果
- scan 结果
- 尚未解决的 unresolved SQL fields
- migrate 是否执行
- verify 结果
- rollback 演练结果
- 是否满足进入 Phase 4.5 条件
```

---

# 22. 本次代码审查依据

本方案基于 `dev202608191` 的以下当前代码/路径审查整理：

```text
server/src/main/java/datart/server/service/impl/ViewFieldServiceImpl.java

server/src/main/java/datart/server/service/ViewFieldService.java

server/src/main/java/datart/server/service/impl/FieldMetaMigrationServiceImpl.java

server/src/main/java/datart/server/controller/FieldMetaMigrationController.java

server/src/main/java/datart/server/common/fieldmeta/FieldMetaResolver.java

server/src/main/java/datart/server/common/fieldmeta/ViewModelMigrator.java

server/src/main/java/datart/server/common/fieldmeta/SourceSchemaIndex.java

server/src/main/java/datart/server/common/fieldmeta/ViewFieldKey.java

server/src/test/java/datart/server/common/fieldmeta/FieldMetaMigrationTest.java

server/src/test/java/datart/server/service/impl/ViewFieldServiceImplTest.java
```

审查时分支 HEAD：

```text
4d0d654ec3bc7f0bc44bf7b1dccd36651e00185d
```

如果执行时 HEAD 已变化，以新的代码事实为准，但必须保留本文定义的架构边界和数据安全要求。
