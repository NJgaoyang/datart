# Phase 6.2-M2：Metadata In-place Upgrade Executor

生产升级使用克隆后的 metadata database，不通过资源包重建用户、角色、权限或资源。

## 执行入口

```text
POST /orgs/{orgId}/metadata-upgrade/apply
```

服务端每次执行都会重新运行 M1 Preflight。只有 `applyAllowed=true` 且组织处于
`COMPAT` 模式时才会继续；客户端不能提交或覆盖这个判断。

## 事务和不变量

执行在一个事务中完成：

```text
Preflight / before snapshot
  -> existing in-place field metadata migration
  -> after snapshot
  -> Readiness verification
  -> commit
```

异常、Preflight blocker、Readiness 未达到 100%、用户/密码/权限/资源 ID 快照不一致，
都会抛出异常并回滚事务，不会继续提交半套升级结果。

以下数据不由执行器写入：

- organization、user、rel_user_organization、role、rel_role_user
- rel_role_resource、rel_subject_columns、rel_variable_subject
- source、view、view_field、datachart、dashboard、folder 的既有 ID

View/ViewField/Datachart/Widget 只沿用现有原地规范化链路更新内容。ViewField 按
canonical key 复用已有 ID；只有确实不存在的字段才创建新 ID。第二次执行在 Readiness
已经达到 100% 时返回 `NO_OP`。

## 返回结果

Apply 返回：

- 实际变更的表和字段；
- ViewField reconcile/create、View、Widget、Datachart 变更计数；
- before/after integrity snapshot；
- identity、密码 hash、权限、资源 ID 和 ViewField ID 不变量结果；
- 最终 Readiness 和是否 `NO_OP`。

组织处于 `STRICT` 时拒绝 Apply；M2 不调用资源导入的 `NEW` 策略，也不删除重建资源。
