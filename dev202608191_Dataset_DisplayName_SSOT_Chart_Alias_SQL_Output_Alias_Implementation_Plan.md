# dev202608191 — Dataset DisplayName 单一真源 + Chart Local Alias + SQL 业务转义别名实施方案

> 用途：直接交给另一个 AI / 开发者实现。  
> 仓库：`NJgaoyang/datart`  
> 分支：`dev202608191`  
> 本次审查基线 HEAD：`57f1525df5061cdc4124f26155a92063ff716fdd`  
> 目标阶段建议命名：**Phase 4.4.6 ~ Phase 4.4.7 — Field Display Single Source of Truth & Business SQL Projection Alias**  
> 核心思想：**FineBI 式 Dataset DisplayName 单一真源 + DataEase 式 Chart Local Alias + FineBI 风格可读 SQL 输出别名**

---

## 0. 执行前必须先做的事情

另一个 AI 开始修改前，必须先执行：

```bash
git checkout dev202608191
git pull --ff-only
git rev-parse HEAD
git status --short
```

当前审查基线：

```text
57f1525df5061cdc4124f26155a92063ff716fdd
```

如果 HEAD 已经前进：

1. 先阅读新 commit / diff。
2. 对照本方案判断哪些内容已经完成。
3. 不允许机械覆盖新代码。
4. 不允许 hard reset。
5. 不允许 force push。
6. 不修改 `bin/build.sh`、安装包结构和无关功能。
7. 当前 Dashboard / 报表打开链路、SQL Query Path Repair 已稳定，除非专项测试证明必要，否则不要扩大修改面。

---

# 1. 最终目标

当前 ViewField 已经完成了字段身份、来源元数据和展示名的基本分离，但前端仍存在多个展示入口各自判断：

```text
displayName?
comment?
isDisplayNameCustom?
name?
path?
```

这会导致：

```text
数据集：中文
图表字段列表：中文
交互 -> 查看数据：中英文混合
字段替换：可能英文
拖拽预览：可能英文
JumpToChart / CrossFiltering / URL 参数：可能英文
```

本方案要彻底终止这种模式。

最终架构固定为：

```text
                  Physical Source
                        │
                column / comment
                        │
                        ▼
                    ViewField
       ┌────────────────┼────────────────┐
       │                │                │
    fieldId         originName      sourceComment
       │                                 │
       │                            customName
       │                                 │
       │                                 ▼
       │                         resolveDisplayName()
       │                                 │
       │                                 ▼
       │                            displayName
       │                                 │
       └────────────────┬────────────────┘
                        │
                        ▼
                Dataset Field DTO
            fieldId / originName / path
                   displayName
                        │
       ┌────────────────┼────────────────────┐
       ▼                ▼                    ▼
     Chart            Filter             Interaction
       │                │                    │
       └───────统一消费 Dataset.displayName──┘
                        │
                        ▼
                    Chart 层
              alias?.name ?? displayName
                        │
                        ▼
               Query Projection Alias
          Chart alias ?? Dataset displayName
```

同时，查询身份永远保持：

```text
fieldId
  ↓
ViewField / ChartDataViewMeta
  ↓
originName / logical query path
  ↓
WHERE / GROUP BY / JOIN / ORDER BY
```

**禁止把 `displayName`、`sourceComment`、`customName`、Chart alias 当作查询身份。**

---

# 2. 三条不可破坏的核心规则

## 2.1 Dataset DisplayName 是所有下游的唯一展示真源

后端唯一规则：

```text
displayName = customName ?? sourceComment ?? originName
```

职责：

```text
customName
sourceComment
originName
```

只允许 Dataset / ViewField 层理解。

进入下游以后，原则上只消费：

```text
fieldId
originName/path
displayName
type
category
```

下游组件不再自己重新判断：

```text
sourceComment
customName
legacy comment
isDisplayNameCustom
```

---

## 2.2 Chart Local Alias 是唯一允许覆盖 Dataset DisplayName 的图表局部名称

Chart 最终展示：

```text
Chart alias
    >
Dataset displayName
```

例如：

```text
originName = city
sourceComment = 城市
customName = 运营城市
Dataset.displayName = 运营城市
```

默认图表：

```text
运营城市
```

某个图表设置：

```text
alias = 城市分布
```

该图表显示：

```text
城市分布
```

但 Dataset、其他 Chart、Filter、Interaction 仍然显示：

```text
运营城市
```

以后 Dataset 改成：

```text
customName = 业务城市
Dataset.displayName = 业务城市
```

已选中的 Chart 字段应同步缓存为：

```text
displayName = 业务城市
```

但已有 alias：

```text
alias = 城市分布
```

因此最终图表仍显示：

```text
城市分布
```

清空 Chart alias 后立即回退：

```text
业务城市
```

---

## 2.3 SQL 业务别名只允许出现在最终 SELECT Projection

目标 SQL：

```sql
SELECT
    `DATART_VTABLE`.`recommender_city_name_std` AS `推荐官城市`,
    SUM(`DATART_VTABLE`.`user_count`) AS `用户数`
FROM (...原始 SQL View...) `DATART_VTABLE`
WHERE `DATART_VTABLE`.`recommender_city_name_std` IS NOT NULL
GROUP BY `DATART_VTABLE`.`recommender_city_name_std`
ORDER BY SUM(`DATART_VTABLE`.`user_count`) DESC;
```

如果 Chart alias：

```text
用户数 -> 累计用户数
```

最终 projection：

```sql
SUM(`DATART_VTABLE`.`user_count`) AS `累计用户数`
```

但必须保证：

```text
WHERE      → originName/path
GROUP BY   → originName/path
JOIN       → originName/path
ORDER BY   → originName/path / aggregate expression
Filter     → originName/path
Drill      → originName/path
```

禁止：

```sql
WHERE `推荐官城市` = ...
GROUP BY `推荐官城市`
```

除非数据库方言明确通过 SQL AST 证明这是安全引用；本阶段不要依赖 SELECT alias 做查询解析。

---

# 3. 当前代码基线：已经正确的部分

以下内容当前已有，不要推倒重写。

## 3.1 `ViewFieldServiceImpl.resolveDisplayName()` 已正确

路径：

```text
server/src/main/java/datart/server/service/impl/ViewFieldServiceImpl.java
```

当前已经实现：

```java
customName
    >
sourceComment
    >
originName
```

并通过 DTO 输出：

```text
fieldId
originName
sourceComment
customName
displayName
sourcePath
type
category
expression
active
```

**这就是 Dataset 展示真源。不要把同一套规则复制到前端。**

---

## 3.2 SQL physical lineage 与 query path 已经分离

当前约束继续保持：

```text
ViewField.sourcePath
    = physical source lineage

model.path / Chart path
    = query identity
```

SQL View：

```text
originName = SQL output name
query path = [originName]
sourcePath = [database, table, sourceColumn]（仅可信 lineage）
```

禁止重新把 `sourcePath` 注入 Chart query path。

---

## 3.3 `transformHierarchyMeta()` 已能注入 ViewField metadata

路径：

```text
frontend/src/app/utils/internalChartHelper.ts
```

当前已经能把 ViewField 映射到 Chart meta，包括：

```text
fieldId
originName
sourceComment
customName
displayName
```

而 SQL View 已强制：

```text
path = [fieldName]
```

保持这个查询语义。

---

## 3.4 `ChartDataRequestBuilder.buildColumnName()` 已优先走 fieldId

路径：

```text
frontend/src/app/models/ChartDataRequestBuilder.ts
```

当前逻辑：

```text
fieldId
  ↓
findFieldByIdInMeta()
  ↓
field.path / originName
```

只有旧 Chart 没有 `fieldId` 才 fallback：

```text
colName -> findPathByNameInMeta
```

这一点符合未来 STRICT 模式方向。

**不要让 displayName / Chart alias 进入 buildColumnName()。**

---

## 3.5 SQL Builder 已经把 SELECT alias 和过滤/分组表达式分开

路径：

```text
data-providers/data-provider-base/src/main/java/datart/data/provider/calcite/SqlBuilder.java
```

当前：

- columns 使用 `column.getAlias()` 创建 SELECT alias；
- groups 使用 `group.getAlias()` 创建 SELECT alias，但 GROUP BY 使用原 `sqlNode`；
- aggregators 使用 `operator.getAlias()` 创建 SELECT alias；
- filters 使用 column expression；
- order 使用 column / aggregate expression。

因此架构上已经具备：

```text
query expression != output alias
```

的基础。

但当前 `alias` 同时承担了“技术结果键”和“SELECT 输出名”，直接改成中文会有结果映射回归风险，所以必须按本方案增加明确的 Projection 层，不能简单替换现有 alias。

---

## 3.6 当前 SQL Preview metadata 已经有后端 Resolver

路径：

```text
server/src/main/java/datart/server/common/fieldmeta/SqlPreviewFieldMetadataResolver.java
server/src/main/java/datart/server/service/impl/DataProviderServiceImpl.java
core/src/main/java/datart/core/data/provider/Dataframe.java
```

当前未保存 SQL Preview 已经可以返回：

```text
PreviewFieldMeta
sourcePath
sourceComment
displayName
```

本阶段不要再新写第二套 Preview 命名算法。

后续只需要保证：

```text
Preview displayName
=
保存后 ViewField.displayName（无 customName 时）
```

---

# 4. 当前必须解决的核心缺口

## 4.1 前端仍然存在多套字段展示逻辑

当前公共函数仍然理解：

```text
displayName
comment
isDisplayNameCustom
name
path
```

而一些组件直接：

```text
field.name
colName
handleDateLevelsName() -> 普通字段返回 raw name
```

这就是中英文混合继续出现的原因。

---

## 4.2 已选入 Chart 的字段仍可能保留旧 displayName

当前：

```text
reconcileChartConfigFieldMeta()
```

存在类似：

```text
legacyCustomDisplayName
    >
latestMeta.displayName
```

的兼容优先级。

这会造成：

```text
Dataset displayName 已从 城市 改为 运营城市
但已选 Chart row.displayName 仍可能保留 城市
```

正确规则必须改成：

```text
Chart alias          // 用户在 Chart 层明确设置，保留
    >
latest Dataset displayName
```

`row.displayName` 只允许作为 Dataset displayName 的缓存，不再代表 Chart 自定义名。

---

## 4.3 `ChartDataRequestBuilder.buildAliasName()` 当前仍是技术名称

当前类似：

```ts
city
SUM(user_count)
```

这也是现有 Dataframe 结果识别键的一部分。

不能直接改成：

```text
城市
用户数
```

否则可能破坏：

- `ChartDataSet` 列匹配；
- tooltip 数据索引；
- aggregate key；
- table header；
- sort；
- dashboard runtime；
- 下载；
- cache key；
- server aggregate；
- existing chart result parsing。

因此必须引入：

```text
technical result key
vs
business output alias
```

两层。

---

# 5. 目标数据模型

## 5.1 Backend ViewField：唯一业务字段元数据真源

继续使用：

```text
ViewField
├── fieldId
├── originName
├── sourcePath
├── sourceComment
├── customName
├── fieldType
├── fieldCategory
├── expression
├── active
└── displayName (DTO runtime calculated)
```

固定规则：

```text
displayName = customName ?? sourceComment ?? originName
```

`displayName` 不是 identity，不进入 canonical key。

---

## 5.2 Frontend Dataset Field DTO

建议把“下游业务字段”收敛为：

```ts
type DatasetFieldMeta = {
  fieldId: string;
  originName: string;
  path: string[];
  displayName: string;
  type: string;
  category: string;
  expression?: string;
  active?: boolean;
};
```

兼容期可以继续保留：

```text
sourceComment
customName
comment
isDisplayNameCustom
```

但：

> 下游 UI 禁止再读取这些字段决定显示名称。

---

## 5.3 ChartDataSectionField

建议最终语义：

```ts
type ChartDataSectionField = {
  uid?: string;

  // dataset identity
  fieldId?: string;
  originName?: string;

  // query identity/cache
  colName: string;
  path?: string[];

  // dataset presentation snapshot
  displayName?: string;

  // chart-local presentation override
  alias?: {
    name?: string;
    desc?: string;
  };

  type: ...;
  category: ...;
  ...
};
```

明确：

```text
row.displayName
= latest Dataset.displayName cache

row.alias.name
= Chart local custom name
```

禁止再把：

```text
row.displayName + isDisplayNameCustom
```

解释成 Chart 局部改名。

Chart 局部改名只有一个正式入口：

```text
row.alias.name
```

---

# 6. Phase 4.4.6A — Dataset DisplayName Single Source of Truth

## 6.1 后端保持唯一 resolve 规则

不要重写 `ViewFieldServiceImpl.resolveDisplayName()`。

建议增加专项测试锁死：

```text
customName != null
→ customName

customName == null && sourceComment != null
→ sourceComment

customName == null && sourceComment == null
→ originName
```

增加空格语义：

```text
"  " -> null
```

清除 customName：

```text
运营城市
  ↓ PATCH customName=null
城市（sourceComment）
```

---

## 6.2 前端拆分“新模式 resolver”和“legacy fallback”

路径：

```text
frontend/src/utils/utils.ts
```

不要继续让一个函数无限识别：

```text
customName/sourceComment/displayName/comment/isDisplayNameCustom/name/path
```

建议明确拆分：

```ts
export function getDatasetFieldDisplayName(field): string {
  return (
    field?.displayName?.trim() ||
    field?.originName?.trim() ||
    field?.name?.trim() ||
    field?.path?.[field.path.length - 1] ||
    ''
  );
}
```

兼容旧历史 JSON 单独：

```ts
export function getLegacyFieldDisplayName(field): string {
  // 仅 legacy fallback 使用当前旧逻辑
}
```

然后：

```text
新 ViewField / ChartDataViewMeta
→ getDatasetFieldDisplayName

没有 fieldId 的 legacy object
→ getLegacyFieldDisplayName
```

避免新数据再次被 `isDisplayNameCustom=false` 误判而忽略服务器 `displayName`。

---

## 6.3 `transformHierarchyMeta()` 只负责“绑定”，不再重新计算业务名称

路径：

```text
frontend/src/app/utils/internalChartHelper.ts
```

当匹配到 server ViewField：

```ts
return {
  ...,
  fieldId: serverField.fieldId,
  originName: serverField.originName,
  displayName: serverField.displayName,
};
```

这时：

```text
serverField.displayName
```

必须是 authoritative。

不要再使用：

```text
comment
isDisplayNameCustom
legacyDisplayName
```

去覆盖它。

legacy fallback 只允许发生在：

```text
没有匹配 serverField
```

的旧数据场景。

---

## 6.4 ViewField 匹配只允许 active 字段参与当前 Dataset fallback

对于当前 Dataset 展示：

```text
active=false
```

的历史 ViewField 不应干扰当前字段名称匹配。

建议：

```ts
const activeFields = fields.filter(field => field.active !== false);
```

匹配顺序：

```text
1. fieldId
2. sourcePath（兼容期）
3. unique originName（兼容期）
```

如果 `fieldId` 指向 inactive/stale，当前 Dataset UI 不应停止，应继续兼容 fallback 找 active 字段。

STRICT 模式以后只保留：

```text
fieldId -> active ViewField
```

---

# 7. Phase 4.4.6B — Chart 已选字段同步 Dataset DisplayName

## 7.1 修正 `reconcileChartConfigFieldMeta()`

路径：

```text
frontend/src/app/utils/internalChartHelper.ts
```

目标：

```text
fieldId
  ↓
latest Dataset Field
  ↓
强制同步 row.displayName
```

建议语义：

```ts
return {
  ...row,
  fieldId: latestMeta.fieldId ?? row.fieldId,
  originName: latestMeta.originName ?? row.originName ?? row.colName,
  path: latestMeta.path ?? row.path,

  // authoritative Dataset display snapshot
  displayName:
    latestMeta.displayName ??
    row.displayName ??
    latestMeta.originName ??
    row.colName,

  // 永远不修改 Chart alias
  alias: row.alias,
};
```

删除/降级：

```text
legacyCustomDisplayName > latestMeta.displayName
```

这条优先级。

兼容旧 Chart 的 legacy displayName 只能在：

```text
latestMeta 不存在
```

时使用。

---

## 7.2 Chart display helper 固定为两级

正式 helper：

```ts
export function getChartFieldDisplayName(field): string {
  return (
    field?.alias?.name?.trim() ||
    field?.displayName?.trim() ||
    field?.originName?.trim() ||
    field?.colName ||
    ''
  );
}
```

不允许：

```text
alias
> legacy custom display
> comment
> sourceComment
> ...
```

Chart 自定义名称只能来自：

```text
alias.name
```

Dataset 名称只能来自：

```text
displayName
```

---

## 7.3 Drag item 只传播 resolved displayName

当前 `buildDragItem()` 仍传播：

```text
displayName
comment
isDisplayNameCustom
```

调整方向：

```ts
return {
  fieldId: item.fieldId,
  originName: item.originName ?? item.name,
  colName: item.name,
  path: item.path,
  displayName: item.displayName,
  ...query/type metadata
};
```

兼容期可以保留 legacy 字段，但新增代码不得依赖它们。

---

# 8. Phase 4.4.6C — 所有下游 UI 一次性统一

不要再 chart-by-chart 修。

执行 AI 开始前先生成 inventory：

```bash
rg -n "getFieldDisplayName|handleDateLevelsName|getColumnRenderName|getColumnRenderOriginName" frontend/src
rg -n "\.comment|isDisplayNameCustom|\.colName|\.name" frontend/src/app/components/FormGenerator frontend/src/app/pages/ChartWorkbenchPage frontend/src/app/pages/DashBoardPage
rg -n "Select\.Option|options=.*label|label:.*name|title:.*name" frontend/src/app/components/FormGenerator frontend/src/app/pages/ChartWorkbenchPage
```

人工分类：

```text
A. 字段展示
B. 查询 identity
C. UI 标题/资源名称
```

只修改 A，不要误把 B 改成 displayName。

必须覆盖至少以下入口：

```text
Dataset View 页面字段列表
SQL Preview 字段列表
Chart 左侧 Dataset 字段列表
字段搜索
字段排序
字段拖拽 ghost
Chart 数据槽位
字段替换菜单
字段 Alias 面板中的原字段名
Filter 字段名
Tooltip 字段名
日期层级字段
计算字段编辑器字段选择
交互 -> 查看数据 -> 自定义字段
交互 -> JumpToChart 字段映射
交互 -> CrossFiltering 字段映射
交互 -> JumpToDashboard 字段映射
交互 -> JumpToUrl 参数字段
Dashboard 编辑态字段选择
Dashboard 运行态字段描述
```

重点文件包括但不限于：

```text
frontend/src/app/components/FormGenerator/Customize/Interaction/ViewDetailPanel.tsx
frontend/src/app/components/FormGenerator/Customize/Interaction/ChartRelationList.tsx
frontend/src/app/components/FormGenerator/Customize/Interaction/BoardRelationList.tsx
frontend/src/app/components/FormGenerator/Customize/Interaction/ControllerList.tsx
frontend/src/app/components/FormGenerator/Customize/Interaction/UrlParamList.tsx
frontend/src/app/components/FormGenerator/Customize/Interaction/CrossFilteringPanel.tsx
frontend/src/app/components/FormGenerator/Customize/Interaction/CrossFilteringRuleList.tsx

frontend/src/app/pages/ChartWorkbenchPage/components/ChartOperationPanel/components/ChartDataViewPanel/ChartDataViewPanel.tsx
frontend/src/app/pages/ChartWorkbenchPage/components/ChartOperationPanel/components/ChartDataViewPanel/components/ChartComputedFieldSettingPanel.tsx
frontend/src/app/pages/ChartWorkbenchPage/components/ChartOperationPanel/components/ChartDraggable/*
frontend/src/app/pages/ChartWorkbenchPage/components/ChartOperationPanel/components/ChartFieldAction/*
frontend/src/app/pages/ChartWorkbenchPage/components/ChartOperationPanel/utils.ts

frontend/src/app/utils/chartHelper.ts
frontend/src/app/utils/internalChartHelper.ts
frontend/src/utils/utils.ts
frontend/src/app/pages/DashBoardPage/utils/board.ts
```

---

# 9. 日期层级规则

DateLevel 不创建新的物理字段业务名称来源。

父字段：

```text
originName = created_date
displayName = 创建日期
```

层级显示：

```text
创建日期（年）
创建日期（月）
创建日期（日）
```

如果 Dataset 自定义：

```text
customName = 下单日期
```

则所有 DateLevel 自动：

```text
下单日期（年）
下单日期（月）
下单日期（日）
```

`buildDateLevelFields()` 要传播：

```text
fieldId
originName
displayName
path
```

但 DateLevel 自己仍有独立 category/expression。

当前 `handleDateLevelsName()` 的普通字段分支如果仍：

```ts
return col.name;
```

必须改成统一 Dataset display resolver。

---

# 10. SQL Preview 一致性

当前已经存在：

```text
SqlPreviewFieldMetadataResolver
Dataframe.previewFields
```

本阶段要求：

```text
新建 SQL View
点击查询
尚未保存
```

与：

```text
保存 View 后 ViewField.displayName
```

在没有 Dataset customName 的情况下完全一致。

规则：

```text
DIRECT_COLUMN
ALIASED_COLUMN
STAR_EXPANDED
    → trusted sourceComment → displayName

EXPRESSION
AMBIGUOUS
UNRESOLVED
    → originName
```

不要给表达式猜数据库 comment。

---

# 11. Phase 4.4.7 — SQL Business Projection Alias

这是本方案风险最高的部分，必须在 Display SSOT 完成并通过测试后再做。

## 11.1 不允许直接把现有技术 alias 改成 displayName

当前 `ChartDataRequestBuilder.buildAliasName()` 生成：

```text
city
SUM(user_count)
```

现有前后端大量代码可能把这些 alias 当作 Dataframe 技术列键。

所以禁止直接：

```ts
return field.alias?.name || field.displayName;
```

替换 `buildAliasName()`。

必须把两个概念拆开：

```text
technicalAlias
    = 稳定结果键 / 兼容当前 ChartDataSet

businessAlias
    = Chart alias ?? Dataset displayName
    = 只用于最终 SQL projection / 查询日志可读性
```

---

## 11.2 推荐新增 Query Projection 模型

优先新增一个明确 DTO，而不是把越来越多语义塞进现有 `alias` 字段。

建议概念：

```java
public class QueryOutputProjection {
    private String fieldId;
    private String technicalAlias;
    private String displayAlias;
    private Integer ordinal;
}
```

或在现有 Operator 上增加：

```text
alias        = technicalAlias
displayAlias = businessAlias
fieldId      = optional identity
```

推荐第一种，耦合更低。

`ExecuteParam` 可增加：

```java
private List<QueryOutputProjection> outputProjections;
```

Frontend `ChartDataRequest` 增加对应结构。

---

## 11.3 Frontend 构造 Projection

路径：

```text
frontend/src/app/models/ChartDataRequestBuilder.ts
```

增加 helper：

```ts
private buildBusinessAlias(field: ChartDataSectionField): string {
  return (
    field.alias?.name?.trim() ||
    field.displayName?.trim() ||
    field.originName?.trim() ||
    field.colName
  );
}
```

技术 alias 保持现状：

```text
city
SUM(user_count)
```

business alias：

```text
城市
用户数
```

如果 Chart alias：

```text
累计用户数
```

请求示意：

```json
{
  "aggregators": [
    {
      "column": ["user_count"],
      "sqlOperator": "SUM",
      "alias": "SUM(user_count)"
    }
  ],
  "outputProjections": [
    {
      "fieldId": "F002",
      "technicalAlias": "SUM(user_count)",
      "displayAlias": "累计用户数",
      "ordinal": 1
    }
  ]
}
```

**Filters / Groups / Orders 继续只构造 column/path，不使用 businessAlias。**

---

# 12. SQL Builder 的推荐实现：两层 Projection

为了不让业务别名污染 GROUP BY / ORDER BY / Filter，推荐生成：

```sql
SELECT
    `DATART_RESULT`.`city` AS `城市`,
    `DATART_RESULT`.`SUM(user_count)` AS `用户数`
FROM (
    SELECT
        `DATART_VTABLE`.`city` AS `city`,
        SUM(`DATART_VTABLE`.`user_count`) AS `SUM(user_count)`
    FROM (...) `DATART_VTABLE`
    WHERE ...
    GROUP BY `DATART_VTABLE`.`city`
    ORDER BY SUM(`DATART_VTABLE`.`user_count`) DESC
) `DATART_RESULT`
```

这样分层：

```text
Inner Query
    = technical query + technical result aliases

Outer Query
    = presentation-only alias projection
```

优点：

1. WHERE/GROUP/ORDER 完全不接触中文业务名。
2. SQL 日志能看到最终业务别名。
3. Chart alias 只改变 outer SELECT。
4. Dataset customName 只改变 outer SELECT。
5. 不改变字段 query identity。

---

# 13. 最关键的安全点：JDBC 返回列不能变成新的字段身份

Outer SELECT 执行以后，JDBC columnLabel 会变成：

```text
城市
用户数
```

但系统真正的结果身份仍应是：

```text
fieldId / technicalAlias / ordinal
```

因此不能让：

```text
JDBC columnLabel = 城市
```

成为 ChartDataSet 查列主键。

## 推荐方案

执行 SQL 后按 projection ordinal 进行 Dataframe normalization：

```text
DB Result:
column 0 label = 城市
column 1 label = 用户数

outputProjection:
0 -> technicalAlias=city, displayAlias=城市, fieldId=F001
1 -> technicalAlias=SUM(user_count), displayAlias=用户数, fieldId=F002

API Dataframe internal columns:
column 0 name = city
column 1 name = SUM(user_count)

另附 result metadata:
fieldId/displayName/ordinal
```

也就是说：

```text
实际执行 SQL
→ 带中文业务 alias

Datart API 技术列身份
→ 仍恢复成 technicalAlias

UI 展示
→ displayName
```

这样不会破坏现有 ChartDataSet。

---

# 14. 推荐增加 Result Projection Metadata

不要让 `Column.name` 同时承担技术身份和展示名称。

可复用/扩展类似 Preview metadata 的结构，建议：

```java
public class ResultFieldMeta {
    private String fieldId;
    private String technicalName;
    private String displayName;
    private Integer ordinal;
}
```

`Dataframe`：

```java
private List<ResultFieldMeta> resultFields;
```

原则：

```text
columns[i].name
    = technical result identity

resultFields[i].displayName
    = business presentation
```

前端如果现阶段不需要 `resultFields`，可以先不消费；但后端 normalization 必须按 ordinal 保证列身份稳定。

---

# 15. SQL identifier quoting

目标只支持当前项目实际重点：

```text
MySQL
StarRocks
```

禁止：

```java
" AS `" + displayName + "`"
```

必须通过 Calcite AST / dialect：

```text
SqlIdentifier
SqlNodeUtils.createAliasNode(...)
SqlDialect
```

让数据库方言输出：

```sql
AS `推荐官城市`
```

同时在 `updateCustomName()` 和 Chart alias 保存层增加合理校验：

```text
null / blank → 视为未设置
长度限制 → 统一限制
控制字符 → 禁止
```

不要手工删普通中文、空格、括号等合法展示字符。

---

# 16. Query Trace / 日志要求

当前 JDBC 执行层已经记录实际 SQL trace。

如果最终实际执行的是 outer projection SQL，则 trace 自然应出现：

```sql
AS `推荐官城市`
AS `用户数`
```

验收必须检查：

```text
QueryExecutionTraceRegistry
GET query traces / 管理页面（如已有）
debug SQL log
SQL failure log
```

必须确认：

```text
正常 query trace
→ business alias 可读

错误 SQL digest
→ 仍保持现有安全日志策略
```

不要为了可读 SQL 把敏感变量或全部 SQL 强制提升到 error/info 日志。

---

# 17. Cache Key 规则

这一点必须专项处理。

Dataset displayName / Chart alias 是 presentation metadata。

原则上：

```text
仅 displayName 改变
不应该改变数据语义
```

但如果实际执行 SQL 的 outer alias 改变，现有 SQL digest/query key 可能会变化。

建议明确：

```text
Data Cache Semantic Key
= technical inner query
  + filters/groups/orders/page...

Presentation Alias
= 不进入语义缓存 key
```

否则用户把：

```text
城市 -> 运营城市
```

会无意义造成数据 cache miss。

当前 `JdbcDataProviderAdapter.getQueryKey()` 使用 rendered SQL 参与 MD5。

实现 AI 必须决定并测试：

### 推荐

`getQueryKey()` 使用：

```text
technical render（不带 outer business alias）
```

实际 execute 使用：

```text
business projection render
```

不要因为展示名变化改变数据缓存语义。

---

# 18. Count / Paging

Outer projection 不能破坏分页和 COUNT。

推荐顺序：

```text
Inner technical query
    ├── WHERE
    ├── GROUP BY
    ├── HAVING
    ├── ORDER BY
    ├── OFFSET/FETCH/LIMIT
    ↓
Outer display projection
```

COUNT 时应统计 technical semantic query：

```sql
SELECT COUNT(*) FROM (<technical query without display-only projection if possible>) V_T
```

不要让 display alias 影响 COUNT。

专项测试：

```text
page 1/page 2
countTotal=true
GROUP BY
aggregate
ORDER BY
StarRocks LIMIT
MySQL LIMIT
```

---

# 19. Function / Computed / DateLevel 字段

## 19.1 SQL expression output

例如 Dataset：

```sql
renting_users - last_month_users AS net_increase_users
```

ViewField：

```text
originName = net_increase_users
sourceComment = null
customName = 净增用户
Dataset.displayName = 净增用户
```

Chart：

```text
alias = 本月净增
```

最终 SQL：

```sql
... `net_increase_users` AS `本月净增`
```

查询身份仍：

```text
net_increase_users
```

---

## 19.2 Chart computed field

Chart computed field 不一定有 ViewField。

规则：

```text
Chart computed field 自己的 name/displayName
→ Dataset/View computed name（如果来源是 View computed）
→ Chart alias 可覆盖
```

不要强制把所有 Chart computed field 伪造成 physical ViewField。

但 projection model 同样支持：

```text
technical expression alias
business output alias
```

---

## 19.3 DateLevel

技术 key 仍是：

```text
AGG_DATE_YEAR(created_date)
```

业务 alias：

```text
创建日期（年）
```

如果 Chart alias：

```text
年份
```

最终 output alias：

```text
年份
```

---

# 20. Interaction 模块

本阶段分成两件事：

## 20.1 展示立即统一

所有下拉 label 使用：

```text
Dataset field.displayName
```

不要：

```text
field.name
handleDateLevelsName 普通字段 raw name
```

---

## 20.2 Identity 暂时保持兼容，Phase 5 再严格 fieldId 化

当前不少 interaction config 仍保存：

```text
source/target/name
```

本阶段不要为了中文显示一次性重写所有交互数据结构。

先实现：

```text
value = legacy/query identity
label = displayName
```

Phase 5 One-time Cutover 时再迁移成：

```text
fieldId
```

避免本阶段同时承担：

```text
Display SSOT
+
Interaction identity migration
+
SQL projection
```

三个高风险改造。

---

# 21. 历史 Chart 兼容

老 Chart 可能：

```text
没有 fieldId
有旧 displayName
有 comment
有 isDisplayNameCustom
```

COMPAT 期间：

```text
fieldId
→ path unique fallback
→ name unique fallback
```

找到 latest Dataset field 后：

```text
row.displayName = latest Dataset.displayName
```

但：

```text
row.alias
```

永远保留。

如果无法匹配 latest Dataset field：

```text
保留 legacy displayName
不自动猜
记录诊断
```

建议诊断：

```text
LEGACY_CHART_FIELD_UNMATCHED
CHART_FIELD_ID_STALE
CHART_DATASET_DISPLAY_SYNCED
```

---

# 22. Migration / STRICT Cutover 关系

本方案完成后，仍建议按照：

```text
COMPAT
  ↓
scan
  ↓
migrate
  ↓
verify
  ↓
readiness=100%
  ↓
STRICT
```

STRICT 后：

```text
Dataset UI
→ field.displayName

Chart identity
→ fieldId

Chart display
→ alias ?? displayName

SQL query identity
→ fieldId -> originName/path
```

STRICT 模式下禁止：

```text
path/name 猜字段身份
comment 决定展示
sourceComment 在 UI 被重新计算
```

---

# 23. 后端建议改动文件

执行 AI 应先确认实际调用链，再修改。

## Dataset metadata

```text
server/src/main/java/datart/server/service/impl/ViewFieldServiceImpl.java
server/src/main/java/datart/server/base/dto/ViewFieldDTO.java
server/src/main/java/datart/server/common/fieldmeta/SqlPreviewFieldMetadataResolver.java
```

主要是测试/边界，不建议大改核心逻辑。

## Query request / projection

```text
core/src/main/java/datart/core/data/provider/ExecuteParam.java
core/src/main/java/datart/core/data/provider/Dataframe.java
core/src/main/java/datart/core/data/provider/SelectColumn.java
core/src/main/java/datart/core/data/provider/sql/Alias.java
core/src/main/java/datart/core/data/provider/sql/AggregateOperator.java
core/src/main/java/datart/core/data/provider/sql/GroupByOperator.java
```

推荐新增独立：

```text
core/src/main/java/datart/core/data/provider/QueryOutputProjection.java
core/src/main/java/datart/core/data/provider/ResultFieldMeta.java
```

## SQL render

```text
data-providers/data-provider-base/src/main/java/datart/data/provider/calcite/SqlBuilder.java
data-providers/data-provider-base/src/main/java/datart/data/provider/jdbc/SqlScriptRender.java
```

## JDBC execute / trace / result normalization

```text
data-providers/jdbc-data-provider/src/main/java/datart/data/provider/jdbc/adapters/JdbcDataProviderAdapter.java
```

检查：

```text
executeOnSource()
renderSql()
getQueryKey()
parseResultSet()
count/paging
QueryExecutionTraceRegistry
```

## Server API bridge

```text
server/src/main/java/datart/server/service/impl/DataProviderServiceImpl.java
server/src/main/java/datart/server/base/params/ViewExecuteParam.java
```

---

# 24. 前端建议改动文件

## 类型

```text
frontend/src/app/types/View.ts
frontend/src/app/types/ChartDataViewMeta.ts
frontend/src/app/types/ChartConfig.ts
frontend/src/app/types/ChartDataRequest.ts
```

## Dataset -> Chart meta

```text
frontend/src/app/utils/internalChartHelper.ts
frontend/src/app/utils/chartHelper.ts
frontend/src/utils/utils.ts
```

## Query request

```text
frontend/src/app/models/ChartDataRequestBuilder.ts
```

## Chart editor / downstream display

```text
frontend/src/app/pages/ChartWorkbenchPage/components/ChartOperationPanel/**
frontend/src/app/components/FormGenerator/Customize/Interaction/**
frontend/src/app/pages/DashBoardPage/**
```

重点用 `rg` 做完整 inventory，不要只改本文列出的文件。

---

# 25. 测试计划 — Backend

至少新增/补充以下测试。

## 25.1 ViewField displayName

```text
sourceComment only
customName overrides sourceComment
clear customName falls back to sourceComment
no sourceComment falls back originName
customName does not change fieldId
comment change does not change fieldId
```

## 25.2 SQL Preview

```text
SELECT *
qualified SELECT *
direct column
aliased column
expression alias
JOIN ambiguous
unsupported SQL
```

验证：

```text
Preview displayName == saved ViewField displayName
```

对 expression：

```text
sourceComment == null
```

除非有明确可信历史业务 metadata。

## 25.3 SQL query path regression

必须继续锁死：

```text
SQL View:
DATART_VTABLE.originName
```

永远不能再次：

```text
DATART_VTABLE.db.table.column
```

## 25.4 SQL business projection

测试：

```text
plain column
SUM
COUNT DISTINCT
date level
function column
computed field
multiple dimensions
same displayName twice
chart alias
Chinese alias
alias with spaces / parentheses
```

验证：

```text
business name only appears in SELECT projection alias
```

不出现在：

```text
WHERE
GROUP BY
HAVING
JOIN
base column identity
```

## 25.5 Result normalization

DB 返回：

```text
城市
用户数
```

Dataframe 内部技术列恢复：

```text
city
SUM(user_count)
```

并按 ordinal 正确对应。

## 25.6 Cache

仅改：

```text
Dataset customName
Chart alias
```

不应改变 semantic query cache key。

## 25.7 MySQL / StarRocks

必须分别验证 SQL quoting：

```sql
AS `推荐官城市`
```

以及：

```text
分页
COUNT
GROUP BY
ORDER BY
NULL/filter
```

---

# 26. 测试计划 — Frontend

## 26.1 Dataset DisplayName 全入口

同一字段：

```text
originName = recommender_city_name_std
sourceComment = 推荐官城市
customName = null
displayName = 推荐官城市
```

以下全部必须显示：

```text
推荐官城市
```

覆盖：

```text
Dataset 保存后字段
Chart 左侧字段
搜索
排序
拖拽 ghost
已选维度
已选指标
字段替换
Filter
Tooltip
Alias 面板原字段名
计算字段选择器
查看数据 -> 自定义字段
JumpToChart
CrossFiltering
JumpToDashboard
JumpToUrl
Dashboard
```

---

## 26.2 Dataset customName 向下游同步

先创建 Chart：

```text
Dataset.displayName = 推荐官城市
Chart row.displayName = 推荐官城市
alias = null
```

然后 Dataset 修改：

```text
customName = 推荐城市
```

重新打开/refresh Chart 后：

```text
Chart row.fieldId 不变
Chart row.displayName = 推荐城市
Chart alias = null
最终显示 = 推荐城市
```

---

## 26.3 Chart alias 优先

Dataset：

```text
displayName = 推荐城市
```

Chart：

```text
alias = 城市来源
```

显示：

```text
城市来源
```

Dataset 后续改成：

```text
业务城市
```

验证：

```text
row.displayName = 业务城市
alias = 城市来源
最终显示 = 城市来源
```

清除 alias：

```text
最终显示 = 业务城市
```

---

## 26.4 Query request identity

无论 Dataset displayName / Chart alias 如何变化：

```text
request.filters[].column
request.groups[].column
request.orders[].column
request.aggregators[].column
```

必须保持：

```text
fieldId -> path/originName
```

不能出现中文 displayName。

business alias 只能进入：

```text
outputProjections[].displayAlias
```

---

# 27. 端到端验收 SQL

Dataset：

```sql
SELECT *
FROM ads.ads_channel_invited_cohort_user_month_detail_di
```

假设：

```text
originName = recommender_city_name_std
sourceComment = 推荐官城市
customName = null
```

Chart dimension + metric：

```text
推荐官城市
用户数
```

SQL 日志必须类似：

```sql
SELECT
    `DATART_RESULT`.`recommender_city_name_std` AS `推荐官城市`,
    `DATART_RESULT`.`SUM(user_count)` AS `用户数`
FROM (
    SELECT
        `DATART_VTABLE`.`recommender_city_name_std` AS `recommender_city_name_std`,
        SUM(`DATART_VTABLE`.`user_count`) AS `SUM(user_count)`
    FROM (
        SELECT *
        FROM ads.ads_channel_invited_cohort_user_month_detail_di
    ) `DATART_VTABLE`
    GROUP BY `DATART_VTABLE`.`recommender_city_name_std`
) `DATART_RESULT`;
```

如果 Dataset customName：

```text
推荐城市
```

SQL outer alias：

```sql
AS `推荐城市`
```

如果 Chart alias：

```text
城市来源
```

SQL outer alias：

```sql
AS `城市来源`
```

但 inner query 永远继续：

```sql
`DATART_VTABLE`.`recommender_city_name_std`
```

---

# 28. 禁止实现方式

另一个 AI 必须避免：

```text
1. 每个 UI 组件自己 customName ?? comment ?? name。
2. Chart 直接读取 sourceComment 决定显示。
3. displayName 参与 fieldId/canonicalKey。
4. customName 改变 query path。
5. Chart alias 写回 Dataset customName。
6. sourcePath 作为 SQL View query path。
7. 为了中文 SQL 把 WHERE/GROUP BY 改成 displayName。
8. 直接把 buildAliasName() 改成 displayName 而不处理结果列映射。
9. 用 JDBC 返回的中文 columnLabel 重新猜 field identity。
10. 手工字符串拼 `AS ` + displayName。
11. 根据全库同名字段猜 sourceComment。
12. 删除 inactive ViewField。
13. 修改 Dashboard/report-open 已稳定链路，除非专项测试证明必要。
14. 一次同时删除全部 legacy compatibility。
```

---

# 29. 推荐实施顺序

严格按以下顺序：

```text
Step 1
前端 Display SSOT helper / 类型语义收口

Step 2
transformHierarchyMeta + Chart reconcile
保证 Dataset 改名能同步已选 Chart displayName

Step 3
一次性扫完所有下游字段展示入口

Step 4
SQL Preview display consistency
确认与保存后 ViewField 一致

Step 5
全量前端回归

Step 6
引入 technicalAlias / businessAlias projection model

Step 7
SQL Builder outer presentation projection

Step 8
JDBC result ordinal normalization

Step 9
query cache key 排除 presentation alias

Step 10
MySQL + StarRocks SQL/分页/聚合/日志专项测试

Step 11
Dashboard / old Chart / report smoke

Step 12
FieldMeta migration scan/verify

Step 13
准备 Phase 5 readiness / STRICT cutover
```

不要把 Step 1~5 和 Step 6~10 混成一个无法定位回归的大 commit。

---

# 30. 推荐 commit 拆分

如果用户允许提交，建议：

```text
1. refactor: make dataset displayName authoritative downstream
2. fix: sync selected chart fields with latest dataset displayName
3. fix: unify field labels across chart interactions
4. feat: add business output projection metadata
5. feat: render business aliases in final SQL projection
6. fix: normalize query results to technical field identities
7. test: cover dataset display and SQL business aliases
```

每个 commit 必须可独立测试。

---

# 31. 完成定义 Definition of Done

只有全部满足才算完成。

## Dataset

```text
customName > sourceComment > originName
```

只有 ViewField 层计算。

## Downstream

```text
全部使用 Dataset.displayName
```

不再各自解析 comment/customName。

## Chart

```text
Chart alias > Dataset.displayName
```

Dataset 改名后，已选 Chart row.displayName 自动同步。

Chart alias 永不被 Dataset 同步覆盖。

## Query Identity

```text
fieldId -> originName/path
```

WHERE/GROUP/JOIN/ORDER 不使用 displayName。

## SQL Log

最终 SELECT projection 可看到：

```sql
AS `业务中文名`
```

Chart alias 存在时：

```sql
AS `Chart 局部别名`
```

## Result Identity

SQL 返回中文 columnLabel 后，Datart 内部仍按：

```text
fieldId / technicalAlias / ordinal
```

识别结果，绝不按中文 label 猜 identity。

## Regression

```text
SQL View query path 不回退
STRUCT path 不被破坏
Dashboard 正常打开
旧 Chart 正常打开
Filter 正常
Drill 正常
分页正常
下载正常
MySQL 正常
StarRocks 正常
```

---

# 32. 最终架构一句话

```text
FineBI 式 Dataset DisplayName 单一真源
+
DataEase 式 Chart Local Alias
+
fieldId/originName 驱动查询身份
+
最终 SELECT 仅做业务可读 alias projection
```

最终必须达到：

```text
“字段叫什么”
只由 Dataset.displayName 决定；

“某个图表想叫什么”
只由 Chart.alias 决定；

“SQL 实际查哪个字段”
只由 fieldId -> originName/path 决定；

“SQL 日志给人看叫什么”
只由最终 SELECT projection 的 business alias 决定。
```

这四个概念彻底分开后，当前所有“有的地方中文、有的地方英文”的问题才能从架构层消失，而不是继续靠页面级补丁维护。
