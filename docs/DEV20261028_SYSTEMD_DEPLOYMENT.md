# dev20261028：非 Docker 的 systemd 部署准备（模板，尚未部署）

当前项目的 `bin/datart-server.sh` 是 Java 17 + `lib/*` classpath 启动 `datart.DatartServerApplication`，而不是直接 `java -jar app.jar`。请以实际发布包的目录结构为准，不要误把脚本替换成不存在的可执行 JAR。

本次只提供 [systemd 服务模板](../deploy/systemd/datart.service.example) 与人工验收方案，**没有安装 Runner、写服务器文件、重启进程或迁移数据库**。

## 部署前置条件（尚需确认）

1. 非生产/开发服务器能访问 GitHub，已有足够磁盘、JDK 17、Node 22 构建环境。
2. 明确真正的运行账号、安装包结构、`systemd` 服务名、运行目录、静态文件目录和健康检查 URL。
3. 现有 `config/datart.conf`、`config/profiles/application-config.yml`、Token 加密密钥、数据源连接密码、文件资源目录、证书、配置文件权限必须**完整保留**。禁止从仓库模板覆盖运行中的配置。
4. 备份当前二进制包、静态资源及数据库，并验证能恢复。确认数据迁移不会在更新过程中写入现有数据库或执行意外脚本。
5. 维护窗口与失败回退负责人明确后，才进行任何实际部署操作。

## 建议的版本化目录

```text
/opt/datart/
├── releases/
│   ├── <current-commit-sha>/      # 已验收的当前版本
│   └── <candidate-commit-sha>/    # 待发布版本
├── current -> releases/<current-commit-sha>
└── shared/                        # 需保留的文件和配置（具体路径按部署机决定）
```

版本目录只包含发布产物；运行所依赖的配置和持久化文件必须按实际项目配置从 shared 安全挂载/引用，并检查应用是否可写。不要默认运行目录包含仓库里的示例口令；也不要用软链接切换操作自动修改数据库。

## systemd 服务模板

`deploy/systemd/datart.service.example` 是 **示例文件**。里面的 `User=datart`、`WorkingDirectory=/opt/datart/current` 和 `/usr/bin/java` 是占位假设，必须按开发机实际情况核实，不要直接在现有机器启用。

相比当前 `bin/datart-server.sh stop` 的强制杀进程方式，systemd 的 `KillSignal=SIGTERM` / `TimeoutStopSec` 可尝试优雅停止。但仍需验证应用的数据库连接、Quartz 任务和在途 SQL 是否能安全退出，不能仅因为配置存在就认为已达到零停机。

## GitHub Actions 自动部署推荐架构（未来需授权后实施）

```text
ChatGPT -> GitHub dev20261028 代码提交
             |
             v
       CI（GitHub 托管 runner，只读）
       编译 / 单测 / 构建 / 产物校验
             |
             v
       人工审核版本与部署目标
             |
             v
       受保护 environment 审核
             |
             v
       专用 self-hosted runner（Linux）
       仅下载通过校验的发布产物
             |
             v
       独立版本目录 / systemd / 健康检查 / 回滚
```

- `self-hosted` runner 使用**专用受限账号**；不能与公开 PR 的不可信代码检查混用。
- 部署权限、环境变量、数据库凭据均只保存在服务器或 GitHub Environment Secrets 中，不写进仓库、CI 日志或公开产物。
- 部署 workflow 不应在每次 push 后自动覆盖线上服务；必须由受保护的 environment 审批并固定构建 commit SHA。
- 已经提交的 `.github/workflows/dev20261028-ci.yml` **只做 CI，不执行部署**。
- 由于新的 workflow 只存在开发分支，GitHub UI 手动触发存在默认分支注册限制；不能因此修改 `main`，除非另行明确要求。

## 人工验收步骤（说明，不自动执行）

1. 在隔离目录完成前后端构建及检查，校验发布文件 SHA256。
2. 不修改旧发布目录和现有持久化配置，准备候选版本。
3. 验证候选版本能读取完整原配置、静态目录和加密数据源密码；确认数据库不会被无意重置。
4. 维护窗口内经批准后切换候选版本，执行受控 systemd 重启。
5. 检查服务端 `/api/v1/sys/info`（实际路径/代理以服务器配置为准）、登录、权限、已有分享链接、真实 SQL、仪表板和定时任务。
6. 出错立即停止新流量并恢复旧版本链接；如果迁移已经改动数据库，不能仅恢复二进制，必须按既定数据库恢复方案处理。

**当前没有连接/部署到任何 Linux 主机。** 在获取授权且核实目录之前，不应将此模板当成可立即执行的上线脚本。
