# Datart 开发／构建环境一键安装（Linux）

`bin/install-env.sh` 按**当前分支实际配置**安装构建工具：

| 工具 | 要求与安装行为 | 来源 |
| --- | --- | --- |
| JDK | **17**，使用发行版 OpenJDK 17 开发包，不覆盖 Java alternatives | `pom.xml` 的 `java.version` |
| Node.js / npm | **Node 22.16.0**（npm >= 10），安装在当前用户目录 | `frontend/.nvmrc`、`frontend/package.json` 的 `engines` |
| Maven | **3.9.11**，安装在当前用户目录 | `bin/build.sh`、`pom.xml`（要求 Maven 3.6+） |
| 前端 npm 依赖 | 默认执行 `npm ci --legacy-peer-deps`，**严格使用 lockfile 中的版本** | `frontend/package-lock.json` |
| MySQL | 可选 `--with-mysql`，**只支持发行版软件源提供 MySQL 8.x** | `config/profiles/application-config.yml`、`config/datart.conf` |
| Redis | 可选 `--with-redis`，安装发行版提供的 Redis | 项目可选的 Redis 缓存实现 |

## 使用

在仓库根目录运行：

```bash
bash bin/install-env.sh               # JDK17 + Node22 + Maven3.9 + npm ci
bash bin/install-env.sh --tools-only  # 仅安装构建工具，不执行 npm ci
bash bin/install-env.sh --full        # 同时安装 MySQL 8.x 和 Redis 服务端
bash bin/install-env.sh --check       # 检查已安装工具（不修改系统）
bash bin/install-env.sh --build       # 安装后执行原有 bin/build.sh 构建
```

**安装完成后，在当前 shell 加载工具环境：**

```bash
source "$HOME/.local/share/datart-env/activate.sh"
node -v
npm -v
javac -version
mvn -version
```

可以用 `DATART_ENV_HOME=/some/path` 指定自定义工具路径；之后也要 source 对应目录的 `activate.sh`。

脚本支持 Ubuntu/Debian（apt）及有 dnf 的 RHEL 系 Linux，支持 x86_64、aarch64。首次下载需要访问 `nodejs.org`、`archive.apache.org` 和 npm registry，安装 OpenJDK 或数据库软件包需要 sudo/root；下载的 Node tarball 采用固定 SHA-256 校验，Maven tarball 采用固定 SHA-512 校验。再次执行时会复用已安装的目标版本。

## MySQL 和 Redis 注意事项

- **默认不会安装 MySQL/Redis**。已使用远程 MySQL，或只在现有容器中运行服务时，通常不需要安装本地数据库。
- 项目配置当前**默认使用 MySQL**，自带的 H2 **并不代表默认启动就会使用 H2**。`--with-mysql` 只安装 MySQL 8.x 软件包，不创建库、用户或密码；需要自行创建专用低权限应用账号并修改 `config/datart.conf`。
- Debian 等发行版的软件源可能不提供 MySQL 8.x；脚本会明确报错，不用 MariaDB 冒充 MySQL。
- Redis 为可选项，**不自动配置远程访问、认证或 Datart 连接设置**。
- 数据库包安装后，systemd/apt/dnf 可能按发行版策略启动其服务；脚本不会执行 MySQL 初始化、删库、重置密码或执行项目数据库迁移。
- 此脚本负责**环境和前端依赖**，不是生产部署器。生产部署时仍应配置数据库、密钥、网络、TLS、备份与服务守护，再用现有 `bin/build.sh` 构建。

## 异常处理

- Java 版本不对：确保发行版提供 OpenJDK 17 JDK（含 `javac`），脚本不会更改系统默认 Java。
- Maven 或 Node 无法下载：检查网络出口、代理与 TLS；脚本不会忽略散列校验失败。
- npm 安装失败：检查 `frontend/package-lock.json` 与 npm registry，修复后再次执行即可。
- `--check` 只验证工具环境，不会修改文件；它不会测试数据库是否已经配置或服务端是否能启动。
