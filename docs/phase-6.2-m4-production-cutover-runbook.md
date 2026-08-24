# Phase 6.2-M4 Production Cutover Runbook

## Scope

本 Runbook 用于将旧 Datart metadata 数据库安全切换到新版本 Datart。正式生产升级必须使用旧库备份恢复出的新 metadata 数据库，不原地修改旧生产库。

任何关键步骤失败都必须停止，不得现场修改数据库、删除历史关系、修改密码、重建用户/角色、绕过 `applyAllowed` 或强行进入 STRICT。

## 1. Release prerequisites

- 确认 release commit SHA、release tag 和安装包 SHA256。
- 保留旧 Datart 安装目录和旧 metadata 数据库，不覆盖、不删除。
- 准备数据库备份与恢复位置，并确认恢复库名称。
- 准备管理员、普通用户、高权限用户、受限权限用户的验证账号；不在 Runbook 中记录密码。
- 确认新系统默认以 `COMPAT` 启动。

## 2. Maintenance window and database cutover

1. 宣布维护窗口并停止用户写入。
2. 停止旧 Datart 服务。
3. 对停止写入后的旧 metadata DB 做完整备份。
4. 记录备份文件名和 SHA256。
5. 将备份恢复为新的 production metadata DB。
6. 新 Datart 仅连接新的 production metadata DB。

旧库只用于回滚和对照，不允许被新版本 Apply。

## 3. Startup and schema migration

1. 启动新 Datart。
2. 确认 HTTP health 为 200。
3. 确认 Schema Migration 成功完成 V1–V6。
4. 确认 `access_log.resource_name` 存在。
5. 确认组织模式为 `COMPAT`。

若启动、迁移或 schema 检查失败，立即停止，不进入 Preflight。

## 4. Preflight gate

对每个目标组织执行 metadata upgrade Preflight，并保存原始 JSON：

- `blockers = 0`
- `applyAllowed = true`

否则停止上线。不得通过降低问题级别、删除资源或手工修改权限关系放行。

## 5. Before Snapshot and Apply

保存 Preflight Before Snapshot，至少包括：

- Identity checksum
- Password hash checksum
- Role checksum
- Membership checksum
- Permission checksum
- Resource ID checksum
- immutable 表行数

执行 M2 Apply，并要求：

- HTTP 200
- status `SUCCESS`
- 无异常

若 Apply 失败，停止并按事务回滚结果处理，不继续执行后续步骤。

## 6. After validation

Apply 后立即保存 After Snapshot，并确认：

- Identity checksum：MATCH
- Password hash checksum：MATCH
- Role checksum：MATCH
- Membership checksum：MATCH
- Permission checksum：MATCH
- Resource ID checksum：MATCH
- immutable 表行数一致
- Readiness：100%
- blockers：0
- `chartFieldIdCoverage`：100%
- `resolvedChartFieldIdCoverage`：100%

随后再次执行 Apply，结果必须为 `NO_OP`。否则停止上线并调查幂等性问题。

## 7. Runtime smoke in COMPAT

按用户角色验证：

- 管理员：原 username + 原 password 登录成功。
- 普通用户：允许的 View、Dashboard 可访问；未授权资源被拒绝。
- 高权限用户：授权 Source、View、Dashboard 和查询可用。
- 受限权限用户：未授权资源仍被拒绝。

至少验证：

- MySQL Source
- StarRocks Source（如生产存在）
- 真实 View
- 嵌入式 Widget 图表
- 核心 Dashboard
- 含筛选器和多个 Widget 的 Dashboard
- 变量权限、字段权限（如生产存在）

## 8. STRICT transition

只有 COMPAT 下登录、权限、View、查询和 Dashboard smoke 全部通过后，才允许执行：

```text
COMPAT → STRICT
```

启用 STRICT 后重新验证：

- Readiness 与 fieldId coverage 仍为 100%。
- 核心 View 正常加载。
- 核心 Dashboard 正常打开和查询。
- canonical fieldId runtime 正常。
- 不触发 legacy runtime fallback。

如果 STRICT smoke 失败，先回退到 COMPAT，保留现场证据，不直接切正式流量。

## 9. Traffic cutover and rollback window

全部验证通过后，将正式入口切换到新 Datart。旧 Datart、旧安装目录和旧 metadata DB 在明确 rollback window 结束前保留。

回滚原则：

1. 停止新 Datart 流量和写入。
2. 保留新库与 Apply 证据，不覆盖现场。
3. 恢复旧 Datart 指向旧 metadata DB。
4. 重新开放旧入口。
5. 记录回滚原因和影响范围。

## 10. Required evidence record

每次正式切换至少保存：

- release commit SHA
- release tag
- package path and SHA256
- old DB backup filename and SHA256
- new DB name
- Preflight JSON
- Before Snapshot
- Apply result
- After Snapshot
- all checksum comparison results
- Readiness result
- second Apply `NO_OP` result
- administrator login smoke
- role and permission smoke
- Source/View/Dashboard smoke
- STRICT smoke and final mode

## Hard stop checklist

- [ ] 原始旧 metadata DB 未被新版本 Apply
- [ ] 新 metadata DB 已由停止写入后的备份恢复
- [ ] Schema Migration 成功
- [ ] Preflight blockers 为 0
- [ ] `applyAllowed = true`
- [ ] Apply #1 为 `SUCCESS`
- [ ] 全部 checksum MATCH
- [ ] Readiness 和两个 fieldId coverage 均为 100%
- [ ] Apply #2 为 `NO_OP`
- [ ] 角色、权限和账号行为符合旧系统
- [ ] COMPAT runtime smoke 通过
- [ ] STRICT runtime smoke 通过
- [ ] rollback window 已明确
