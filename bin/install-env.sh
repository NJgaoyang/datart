#!/usr/bin/env bash
# Datart Linux build environment installer; project config and DB are untouched.
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd -P)"
ENV_HOME="${DATART_ENV_HOME:-${XDG_DATA_HOME:-$HOME/.local/share}/datart-env}"
NODE_VERSION=22.16.0
MAVEN_VERSION=3.9.11
NODE_DIR="${ENV_HOME}/node-v${NODE_VERSION}"
MAVEN_DIR="${ENV_HOME}/apache-maven-${MAVEN_VERSION}"
ACTIVATE_FILE="${ENV_HOME}/activate.sh"
MAVEN_SHA512=bcfe4fe305c962ace56ac7b5fc7a08b87d5abd8b7e89027ab251069faebee516b0ded8961445d6d91ec1985dfe30f8153268843c89aa392733d1a3ec956c9978
CHECK=false; MYSQL=false; REDIS=false; FRONTEND=true; BUILD=false; APT_UPDATED=false
TMP_WORK=''; PRIV_CMD=()
log(){ printf '[INFO] %s\n' "$*"; }
ok(){ printf '[ OK ] %s\n' "$*"; }
warn(){ printf '[WARN] %s\n' "$*" >&2; }
die(){ printf '[ERROR] %s\n' "$*" >&2; exit 1; }
usage(){ cat <<'HELP'
用法: bash bin/install-env.sh [选项]
默认准备 JDK 17、Node.js 22.16.0 (npm >=10)、Maven 3.9.11，并运行 npm ci。
Linux: Ubuntu/Debian (apt) 或 RHEL 系 (dnf)，x86_64/aarch64。
  --check             检查已安装的 Datart 环境，不执行安装
  --install-frontend  显式安装前端依赖（默认已开启）
  --tools-only        只安装 JDK/Node/Maven，跳过 npm ci
  --build             安装后运行 bin/build.sh
  --with-mysql        安装 MySQL 8.x（需要受支持的软件源）
  --with-redis        安装可选的 Redis 服务端
  --full              同时安装 MySQL 和 Redis（不创建库/账号）
  -h, --help          显示帮助
环境激活：source "$HOME/.local/share/datart-env/activate.sh"（可由 DATART_ENV_HOME 覆盖）
自定义路径：DATART_ENV_HOME=/path/to/tools bash bin/install-env.sh
不会更改 config/datart.conf、数据库账号、系统 Java 默认版本或启动 Datart。
HELP
}
for arg in "$@"; do
  case "$arg" in
    --check) CHECK=true;;
    --with-mysql) MYSQL=true;;
    --with-redis) REDIS=true;;
    --full) MYSQL=true; REDIS=true;;
    --install-frontend) FRONTEND=true;;
    --tools-only) FRONTEND=false;;
    --build) BUILD=true;;
    -h|--help) usage; exit 0;;
    *) die "未知参数: $arg（使用 --help）";;
  esac
done
[[ -f "$ROOT/pom.xml" && -f "$ROOT/frontend/package.json" ]] || die '请在本仓库 bin 目录中执行。'
[[ -f "$ROOT/frontend/package-lock.json" ]] || die '找不到 frontend/package-lock.json。'
[[ "$(uname -s)" == Linux ]] || die '仅支持 Linux；macOS/Windows 请使用各自的软件包管理器。'
case "$(uname -m)" in x86_64|amd64) NODE_ARCH=x64;; aarch64|arm64) NODE_ARCH=arm64;; *) die '仅支持 x86_64/aarch64 架构';; esac
if command -v apt-get >/dev/null 2>&1; then PKG=apt
elif command -v dnf >/dev/null 2>&1; then PKG=dnf
else die '未找到 apt-get 或 dnf'; fi
[[ "$CHECK" == false || "$BUILD" == false ]] || die '--check 不可与 --build 组合'
priv(){ if (( EUID == 0 )); then PRIV_CMD=(); elif command -v sudo >/dev/null 2>&1; then PRIV_CMD=(sudo); else die '安装系统软件包需要 root 或 sudo'; fi; }
install_pkgs(){
  priv
  if [[ "$PKG" == apt ]]; then
    if [[ "$APT_UPDATED" == false ]]; then "${PRIV_CMD[@]}" apt-get update; APT_UPDATED=true; fi
    "${PRIV_CMD[@]}" env DEBIAN_FRONTEND=noninteractive apt-get install -y "$@"
  else "${PRIV_CMD[@]}" dnf install -y "$@"; fi
}
ensure_utils(){
  local cmd missing=false
  for cmd in curl tar xz sha256sum sha512sum; do command -v "$cmd" >/dev/null 2>&1 || missing=true; done
  [[ "$missing" == false ]] && return 0
  if [[ "$PKG" == apt ]]; then install_pkgs ca-certificates curl tar xz-utils coreutils
  else install_pkgs ca-certificates curl tar xz coreutils; fi
}
select_java(){
  local candidate v resolved
  for candidate in "${JAVA_HOME:-}" /usr/lib/jvm/java-17-openjdk-amd64 /usr/lib/jvm/java-17-openjdk /usr/lib/jvm/java-17-openjdk-* /usr/lib/jvm/temurin-17-jdk-*; do
    [[ -n "$candidate" && -x "$candidate/bin/javac" ]] || continue
    v=$("$candidate/bin/javac" -version 2>&1 || true)
    if [[ "$v" =~ ^javac[[:space:]]+17([.[:space:]]|$) ]]; then SELECTED_JAVA="$candidate"; return 0; fi
  done
  if command -v javac >/dev/null 2>&1; then
    v=$(javac -version 2>&1 || true)
    if [[ "$v" =~ ^javac[[:space:]]+17([.[:space:]]|$) ]]; then
      resolved=$(readlink -f "$(command -v javac)")
      SELECTED_JAVA="$(dirname "$(dirname "$resolved")")"; return 0
    fi
  fi
  return 1
}
ensure_java(){
  if select_java; then ok "JDK 17: ${SELECTED_JAVA}"; return; fi
  [[ "$CHECK" == false ]] || die 'JDK 17 未安装'
  if [[ "$PKG" == apt ]]; then install_pkgs openjdk-17-jdk
  else install_pkgs java-17-openjdk-devel; fi
  select_java || die '安装后未检测到 JDK 17；请检查软件源'
  ok "JDK 17: ${SELECTED_JAVA}"
}
make_temp(){ [[ -n "$TMP_WORK" ]] || TMP_WORK=$(mktemp -d "${TMPDIR:-/tmp}/datart-env.XXXXXXXX"); }
cleanup(){ if [[ -n "$TMP_WORK" && -d "$TMP_WORK" && "$TMP_WORK" == *datart-env.* ]]; then rm -rf -- "$TMP_WORK"; fi; }
trap cleanup EXIT
verify_sha(){ printf '%s  %s\n' "$2" "$3" | "sha${1}sum" -c - >/dev/null; }
ensure_node(){
  if [[ -x "$NODE_DIR/bin/node" && "$("$NODE_DIR/bin/node" -v)" == "v$NODE_VERSION" ]]; then
    ok "Node.js: v${NODE_VERSION}"
    return
  fi
  [[ "$CHECK" == false ]] || die "Node.js v${NODE_VERSION} 未安装"
  make_temp
  local sha archive extracted
  archive="node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz"
  case "$NODE_ARCH" in
    x64) sha=f4cb75bb036f0d0eddf6b79d9596df1aaab9ddccd6a20bf489be5abe9467e84e;;
    arm64) sha=eab80cb88f8fda1e65f5e8d0420c9809bdb320b03fd34976ab7161b6e703b910;;
  esac
  log "下载 Node.js v${NODE_VERSION} (${NODE_ARCH})..."
  curl --fail --location --retry 3 --connect-timeout 15 "https://nodejs.org/dist/v${NODE_VERSION}/${archive}" -o "$TMP_WORK/$archive"
  verify_sha 256 "$sha" "$TMP_WORK/$archive" || die 'Node.js SHA256 校验失败，未安装'
  tar -xJf "$TMP_WORK/$archive" -C "$TMP_WORK"
  extracted="$TMP_WORK/node-v${NODE_VERSION}-linux-${NODE_ARCH}"
  [[ -x "$extracted/bin/node" && -e "$extracted/bin/npm" ]] || die 'Node.js 压缩包不完整'
  mkdir -p "$ENV_HOME"
  [[ ! -e "$NODE_DIR" ]] || die "目标版本目录已存在但不可用: $NODE_DIR（请人工检查）"
  mv "$extracted" "$NODE_DIR"
  ok "Node.js: v${NODE_VERSION}"
}
ensure_maven(){
  if [[ -x "$MAVEN_DIR/bin/mvn" ]]; then ok "Maven: ${MAVEN_VERSION}"; return; fi
  [[ "$CHECK" == false ]] || die "Maven ${MAVEN_VERSION} 未安装"
  make_temp
  local archive extracted
  archive="apache-maven-${MAVEN_VERSION}-bin.tar.gz"
  log "下载 Maven ${MAVEN_VERSION}..."
  curl --fail --location --retry 3 --connect-timeout 15 \
    "https://archive.apache.org/dist/maven/maven-3/${MAVEN_VERSION}/binaries/${archive}" -o "$TMP_WORK/$archive"
  verify_sha 512 "$MAVEN_SHA512" "$TMP_WORK/$archive" || die 'Maven SHA512 校验失败，未安装'
  tar -xzf "$TMP_WORK/$archive" -C "$TMP_WORK"
  extracted="$TMP_WORK/apache-maven-${MAVEN_VERSION}"
  [[ -x "$extracted/bin/mvn" ]] || die 'Maven 压缩包不完整'
  mkdir -p "$ENV_HOME"
  [[ ! -e "$MAVEN_DIR" ]] || die "目标版本目录已存在但不可用: $MAVEN_DIR（请人工检查）"
  mv "$extracted" "$MAVEN_DIR"
  ok "Maven: ${MAVEN_VERSION}"
}
write_activation(){
  local java_q node_q maven_q staging
  mkdir -p "$ENV_HOME"
  staging="${ACTIVATE_FILE}.tmp.$$"
  printf -v java_q '%q' "$SELECTED_JAVA"
  printf -v node_q '%q' "$NODE_DIR"
  printf -v maven_q '%q' "$MAVEN_DIR"
  {
    printf '#!/usr/bin/env bash\n# source this file to use the pinned Datart build environment\n'
    printf 'export JAVA_HOME=%s\n' "$java_q"
    printf 'export PATH=%s/bin:%s/bin:%s/bin:"$PATH"\n' "$java_q" "$node_q" "$maven_q"
  } > "$staging"
  mv -f "$staging" "$ACTIVATE_FILE"
}
verify_versions(){
  # shellcheck disable=SC1090
  source "$ACTIVATE_FILE"
  local java node npm maven
  java=$(javac -version 2>&1)
  node=$(node -v)
  npm=$(npm -v)
  maven=$(mvn -v | head -n 1)
  [[ "$java" =~ ^javac[[:space:]]+17([.[:space:]]|$) ]] || die "JDK 版本不符: $java"
  [[ "$node" == "v$NODE_VERSION" ]] || die "Node 版本不符: $node"
  [[ "${npm%%.*}" -ge 10 ]] || die "npm >=10 必需，当前: $npm"
  [[ "$maven" == *"$MAVEN_VERSION"* ]] || die "Maven 版本不符: $maven"
  ok "验证通过：${java} / Node ${node} / npm ${npm} / ${maven}"
}
check_mysql(){
  local out
  command -v mysqld >/dev/null 2>&1 || return 1
  out=$(mysqld --version 2>&1 || true)
  [[ "$out" != *MariaDB* && "$out" =~ Ver[[:space:]]8[.] ]]
}
ensure_mysql(){
  if check_mysql; then ok "MySQL: $(mysqld --version)"; return; fi
  [[ "$CHECK" == false ]] || die '未安装 MySQL 8.x 服务端'
  command -v mysqld >/dev/null 2>&1 && die '发现非 MySQL 8.x 服务端，为保护已有数据库，拒绝替换'
  [[ "$PKG" == apt ]] || die 'dnf 平台需先手动启用 MySQL 官方 8.x 软件源'
  local candidate
  candidate=$(apt-cache show mysql-server 2>/dev/null | awk '/^Version: / {print $2; exit}')
  [[ "$candidate" == 8.* ]] || die "软件源未提供 MySQL 8.x（检测到: ${candidate:-无}）；不会自动安装 MariaDB"
  install_pkgs mysql-server
  check_mysql || die 'MySQL 安装后版本检查失败，请检查软件源'
  warn '请手动创建 datart 数据库、专用账号和密码；不会写入弱默认密码。'
}
ensure_redis(){
  if command -v redis-server >/dev/null 2>&1; then ok "Redis: $(redis-server --version)"; return; fi
  [[ "$CHECK" == false ]] || die 'Redis 服务端未安装'
  if [[ "$PKG" == apt ]]; then install_pkgs redis-server; else install_pkgs redis; fi
  command -v redis-server >/dev/null 2>&1 || die '安装后未检测到 Redis'
  ok "Redis: $(redis-server --version)"
  warn 'Redis 为可选项；不会自动开放端口或启用远程访问。'
}

log "Datart 目标环境：JDK 17 / Node.js ${NODE_VERSION} / Maven ${MAVEN_VERSION}"
log "工具目录：${ENV_HOME}"
if [[ "$CHECK" == false ]]; then ensure_utils; fi
ensure_java
ensure_node
ensure_maven
if [[ "$MYSQL" == true ]]; then ensure_mysql; fi
if [[ "$REDIS" == true ]]; then ensure_redis; fi
if [[ "$CHECK" == true ]]; then
  [[ -f "$ACTIVATE_FILE" ]] || die "找不到激活文件：${ACTIVATE_FILE}"
  verify_versions
  ok '只读环境检查完成'
  exit 0
fi
write_activation
verify_versions
if [[ "$FRONTEND" == true ]]; then
  log '执行 npm ci --legacy-peer-deps（锁定依赖版本）...'
  (cd "$ROOT/frontend" && npm ci --legacy-peer-deps)
fi
if [[ "$BUILD" == true ]]; then
  log '运行项目现有的 bin/build.sh 构建流程...'
  bash "$ROOT/bin/build.sh"
fi
ok 'Datart 构建环境安装完成！在新终端执行：'
printf '  source %q\n' "$ACTIVATE_FILE"
printf '  bash %q/bin/build.sh\n' "$ROOT"
if [[ "$MYSQL" == false ]]; then warn '项目默认配置使用 MySQL；需要本机 MySQL 8.x 时传入 --with-mysql 或 --full'; fi
