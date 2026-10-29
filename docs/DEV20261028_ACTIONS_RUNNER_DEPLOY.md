# dev20261028：GitHub Actions + Linux self-hosted Runner（非 Docker）

本方案针对 NJgaoyang/datart 的 **Java 17 / Maven 多模块 / React Node 22 / ZIP(lib/* + static + config)** 安装包。不是单个可执行 JAR；现有入口为 datart.DatartServerApplication。

> 2026-10-29 状态：仅代码准备完成。Linux 机器尚未注册 Runner、未安装脚本/服务、未验证健康检查，GitHub Actions 的 DATART_DEV_DEPLOY_ENABLED 默认未配置（因此部署关闭）。**不操作生产机、线上数据库或 main 分支。**

## 工作流

- .github/workflows/dev20261028-deploy.yml 仅在 dev20261028 push / workflow_dispatch 时被发现。
- 默认跳过所有部署任务：必须由仓库管理者手动设置 Repository variable DATART_DEV_DEPLOY_ENABLED = true。
- package 在 GitHub-hosted ubuntu-latest 上执行前端类型检查、回归测试、构建和 Maven 安全回归测试，校验 ZIP，upload-artifact（公开仓库标准 Runner 的运行分钟免费；制品存储有套餐额度）。
- deploy 下载同一次运行产物，只在带 datart-dev 标签的专用 Linux self-hosted Runner 上运行。**不 checkout、不编译、不运行仓库脚本**。调用管理员事先审核并安装的 /usr/local/bin/datart-deploy。
- deploy job 绑定 datart-development environment。建议设置 required reviewers 与 branch restrictions，仅允许 dev20261028，启用前务必测试保护是否生效。
- 仓库中现有的 dev20261028-ci.yml 继续工作。当前自动部署工作流与现有 CI 是并行触发；部署构建包含自己的构建校验，**不会自动等待独立 CI 所有检查通过**。如需硬性先后，设置分支保护、合并策略，或后续改为受信任发布工作流。
- GitHub UI 的 workflow_dispatch 按钮通常要求 workflow 位于默认分支；本次遵守约定不更改 main，直接 push 到 dev20261028 仍能触发。**在变量未打开前不会实际部署。**

## 事先确认（必须人工执行）

1. 这台 Linux 仅作开发部署，不允许把未经审查的公开 PR/fork 任务交给它。给 self-hosted Runner 指定独立账号 gha-runner 和唯一标签 datart-dev。禁止让该 Runner 接收生产任务。
2. 使用可信维护窗口迁移现有应用、服务和路径。先备份真实数据库、现有 config、所有 static 文件、上传资源、证书、日志与原启动脚本。确认数据库初始化/迁移策略：项目的 datart.migration.enable: true **可能在启动时变更数据库**；本流程不删除数据库，但无法保证应用启动不执行迁移。不要在未确认前连接线上数据库。
3. 保留现有 datart.security.token.secret、MySQL 连接信息和用户数据。公开仓库的 config 示例**绝不可覆盖运行时配置**。
4. 运行时必须是 Java 17；无需在 self-hosted Runner 上安装 Node/npm/Maven，构建交给 GitHub-hosted Runner。
5. 提前实测该机器上的 http://127.0.0.1:8080/api/v1/sys/info 是否能作为不需要登录的健康检查。如果实际路径、协议或端口不同，人工审核并调整 **本机安装的** /usr/local/bin/datart-deploy 中 HEALTH_URL。
6. 当前 systemd 服务必须是 /etc/systemd/system/datart.service，使用 deploy/systemd/datart.service.example 作为审核模板。不要在未核对原服务、原运行账号和 JVM 参数前直接覆盖同名服务。

## 推荐服务器目录

    /opt/datart/
      current -> releases/<commit-sha>/
      releases/<commit-sha>/        # lib/, bin/, static -> shared/static, config -> shared/config
      shared/
        config/                     # 来自现有运行服务器的原配置，绝不由 ZIP 替换
          datart.conf
          profiles/application-config.yml
          logback.xml
        static/                     # 同时保存静态前端资源和用户上传文件，永不 --delete
        logs/
      .deployment.lock

安装包的 static/ 会先被保存为每个版本私有的 .frontend-assets/，再**增量复制**到 shared/static/。这样上传文件不会被整个目录替换，失败回滚会把上个版本的前端资产覆盖回来。旧哈希资源长期保留，清理须经单独审计。**这不是完整的 uploads/、数据库或运行时状态快照；数据库变更无法靠切回旧 JAR 恢复。**

## 1. Linux：准备普通账号和权限

以下示例适用于 Debian/Ubuntu，执行前逐项核对现有账号/目录，已有实体不要重复创建：

    sudo apt-get update
    sudo apt-get install -y openjdk-17-jre-headless unzip rsync curl git
    sudo useradd --system --no-create-home --shell /usr/sbin/nologin datart
    sudo useradd --create-home --shell /bin/bash gha-runner
    sudo usermod -aG datart gha-runner

创建目录（必须确认 /opt/datart 不与原生产目录冲突）：

    sudo install -d -o gha-runner -g datart -m 2775 /opt/datart /opt/datart/releases
    sudo install -d -o gha-runner -g datart -m 2775 /opt/datart/shared
    sudo install -d -o datart -g datart -m 2775 /opt/datart/shared/static /opt/datart/shared/logs
    sudo install -d -o root -g datart -m 0750 /opt/datart/shared/config /opt/datart/shared/config/profiles

谨慎地从**原运行目录**迁移原配置和 static 文件，并核对所有上传资源、运行账号和 ACL；此处不能用仓库提供的示例口令自动初始化。参考人工操作（替换 <OLD_APP_DIR>，运行前必须先完成备份并安排维护窗口）：

    sudo cp -a <OLD_APP_DIR>/config/. /opt/datart/shared/config/
    sudo rsync -a <OLD_APP_DIR>/static/ /opt/datart/shared/static/

迁移后按实际权限重设属主/属组：config 的内容必须仅可由 datart 运行账号和管理员读取；static 必须可由 datart 服务写入，并允许 gha-runner 增量发布前端文件。将共享目录中的已有上传文件保持原样；不要清库、删表、清空 static。切换前需要冻结旧服务的写入，防止新上传文件只写入旧路径。

## 2. GitHub：注册 Linux Runner

GitHub 仓库 → Settings → Actions → Runners → New self-hosted runner → Linux x64。

使用页面生成的**对应当前仓库的一次性注册命令**，以 gha-runner 身份安装，添加标签 datart-dev（在 ./config.sh 注册时通过 --labels datart-dev 指定，保留默认 linux/x64 标签）。**不要把注册 token、PAT、SSH 私钥发到聊天或放入仓库。**

注册后在 Runner 目录内运行：

    sudo ./svc.sh install gha-runner
    sudo ./svc.sh start
    sudo ./svc.sh status

确保 Runner 处于 Online，运行用户是 gha-runner，机器为非生产开发机。

## 3. Linux：安装不可由 Runner 修改的部署程序

从已审核的 dev20261028 提交中下载 deploy/scripts/deploy-dev.sh，在服务器上由管理员安装：

    sudo install -o root -g root -m 0755 deploy/scripts/deploy-dev.sh /usr/local/bin/datart-deploy

Runner 不以 root 运行。使用 sudoers 专门授权 **restart 这一个 systemd 服务**，而不是赋予任意 sudo 权限：

    sudo visudo -f /etc/sudoers.d/gha-datart

添加下面一行（根据本机 systemctl 真实绝对路径调整）：

    gha-runner ALL=(root) NOPASSWD: /usr/bin/systemctl restart datart.service

保存后检查：

    sudo visudo -cf /etc/sudoers.d/gha-datart

新组成员权限需要让 gha-runner 服务重新启动后生效。确保 systemd 模板的 WorkingDirectory=/opt/datart/current、ExecStart 的 Java 17 classpath、启动参数、User=datart 正确。推荐使用版本软链接作为 current；如果之前的 current 是普通目录，脚本会拒绝覆盖它。既有的版本软链接应指向 releases/ 下含 .frontend-assets 的人工验收版本，否则为了安全脚本会拒绝部署。**首次安装无 previous 时，失败无法自动回滚**。

## 4. GitHub：设置审批和显式开关

1. Settings → Environments → 创建 datart-development，设置 only dev20261028 deployment branches 及 required reviewers（若套餐支持）。
2. Settings → Secrets and variables → Actions → Variables → 新建 DATART_DEV_DEPLOY_ENABLED，初始不要设置或者设为 false。
3. **本仓库是公开仓库：GitHub 官方不建议把持有服务器管理权限的 self-hosted Runner 注册到公开仓库。最推荐将部署部分放到独立私有仓库，只让公开仓库做 GitHub-hosted 构建。** 现有模板的 deploy job 为公开仓库增加第二道保护：还需要设置 DATART_ALLOW_PUBLIC_RUNNER = I_ACCEPT_RISK 才允许排队。设置这个变量不代表风险被消除；在私有部署仓库建立前，请不要设置它。
4. 先检查当前的 dev20261028-ci.yml 执行，审查 GitHub Actions 打包步骤和公开仓库的部署权限配置。
5. 确认目录、运行配置、数据库备份、服务权限、Runner、健康检查和审核全部通过，再把 DATART_DEV_DEPLOY_ENABLED 改成 true。若仓库仍为公开状态，deploy job 默认仍会跳过。
6. 下一次 push 到 dev20261028 将触发包构建；在受信任且满足安全条件的仓库里，经过 environment 审批后才会部署。如果业务要求只手动发布，可调整 push 触发器或改用已注册默认分支的显式发布工作流，不能把「自动」误认为「每次均审批」。

## 5. 验证与回滚

- GitHub → Actions → Datart dev20261028 opt-in deployment → 查看 package 和 deploy 日志。
- 在开发机上执行：

    readlink -f /opt/datart/current
    sudo systemctl status datart.service
    curl -fsS http://127.0.0.1:8080/api/v1/sys/info
    sudo journalctl -u datart.service -n 100 --no-pager

- 新部署程序以原子方式切换 current；启动或健康检查失败时尝试切回旧 current 并重启旧服务。原数据库、Token 与配置不做修改。若数据库迁移已执行，恢复旧程序不保证数据库兼容，必须使用事先确认的数据库恢复方案。
- 第一次无旧版本时，没有自动回滚目标；禁止把这套流程当作直接覆盖生产环境的工具。
- 不允许 public PR/任意 fork 的构建代码直接在 self-hosted Runner 上执行。应设置分支保护、受限 Runner、受保护 environment、最小 sudo 权限，并专用开发机。

## ChatGPT 网页端如何使用

先在 ChatGPT GitHub 连接中对 dev20261028 修改代码并提交，再在 GitHub Actions 观察 CI、打包和部署日志。GitHub 插件实际可写操作取决于授权；Runner 不是 ChatGPT 的实时 SSH 终端，不能直接代替 Remote Desktop Commander 的任意远程命令操作。
