#!/bin/bash
#
# Datart 全量打包脚本
# 用法: ./bin/build.sh [选项]
#   --skip-frontend    跳过前端构建（仅重新打包后端）
#   --skip-backend     跳过后端构建（仅重新打包前端）
#   --skip-test        跳过后端单元测试
#   --clean            构建前清理旧产物
#   --help             显示帮助信息
#

set -euo pipefail

# ============================================================
# 颜色输出
# ============================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ============================================================
# 项目根目录
# ============================================================
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd -P)
PROJECT_ROOT=$(cd "${SCRIPT_DIR}/.." && pwd -P)
cd "${PROJECT_ROOT}"

# ============================================================
# 解析参数
# ============================================================
SKIP_FRONTEND=false
SKIP_BACKEND=false
SKIP_TEST=false
CLEAN=false

for arg in "$@"; do
    case $arg in
        --skip-frontend) SKIP_FRONTEND=true ;;
        --skip-backend)  SKIP_BACKEND=true ;;
        --skip-test)     SKIP_TEST=true ;;
        --clean)         CLEAN=true ;;
        --help|-h)
            echo "用法: ./bin/build.sh [选项]"
            echo ""
            echo "选项:"
            echo "  --skip-frontend    跳过前端构建（仅重新打包后端）"
            echo "  --skip-backend     跳过后端构建（仅重新打包前端）"
            echo "  --skip-test        跳过后端单元测试"
            echo "  --clean            构建前清理旧产物"
            echo "  --help             显示帮助信息"
            exit 0
            ;;
        *) warn "未知参数: $arg" ;;
    esac
done

# ============================================================
# 环境检查
# ============================================================
check_prerequisites() {
    info "检查构建环境..."

    # Java
    if ! command -v java &>/dev/null; then
        error "未找到 Java，请安装 JDK 17"
    fi
    JAVA_VER=$(java -version 2>&1 | head -1 | awk -F '"' '{print $2}' | cut -d'.' -f1)
    # 旧版版本号形如 1.8 取首段为 1，新版形如 17 取首段为 17
    if [ "$JAVA_VER" = "1" ]; then
        JAVA_VER=$(java -version 2>&1 | head -1 | awk -F '"' '{print $2}' | cut -d'.' -f2)
    fi
    if [ "$JAVA_VER" -lt 17 ]; then
        error "需要 Java 17+，当前版本: $(java -version 2>&1 | head -1)"
    fi
    ok "Java: $(java -version 2>&1 | head -1)"

    # Maven
    if ! command -v mvn &>/dev/null; then
        error "未找到 Maven，请安装 Maven 3.6+"
    fi
    ok "Maven: $(mvn -version 2>&1 | head -1)"

    # Node / npm（仅前端构建需要）
    if [ "$SKIP_FRONTEND" = false ]; then
        if ! command -v node &>/dev/null; then
            error "未找到 Node.js，请安装 Node 18+"
        fi
        NODE_VER=$(node -v | sed 's/v//' | cut -d'.' -f1)
        if [ "$NODE_VER" -lt 18 ]; then
            error "需要 Node 18+，当前版本: $(node -v)"
        fi
        ok "Node: $(node -v)"

        if ! command -v npm &>/dev/null; then
            error "未找到 npm"
        fi
        ok "npm: $(npm -v)"
    fi

    echo ""
}

# ============================================================
# 清理旧产物
# ============================================================
reset_static_output() {
    # 只清理项目根目录下由构建生成的静态资源，避免旧 Hash 文件残留。
    # 放在前端构建成功之后执行，构建失败时保留上一版可用资源。
    if [ -z "${PROJECT_ROOT}" ] || [ "${PROJECT_ROOT}" = "/" ]; then
        error "项目根目录无效，拒绝清理静态资源"
    fi
    rm -rf -- "${PROJECT_ROOT}/static"
    mkdir -p -- "${PROJECT_ROOT}/static"
}

do_clean() {
    info "清理旧构建产物..."
    rm -rf -- "${PROJECT_ROOT}/static"
    rm -rf -- "${PROJECT_ROOT}/frontend/build"
    rm -rf -- "${PROJECT_ROOT}/server/target"
    rm -f -- "${PROJECT_ROOT}/datart-server-"*"install.zip"
    ok "清理完成"
    echo ""
}

# ============================================================
# 前端构建
# ============================================================
build_frontend() {
    info "========== 前端构建 =========="

    cd "${PROJECT_ROOT}/frontend"

    # 安装依赖
    info "安装前端依赖 (npm install)..."
    npm install --legacy-peer-deps
    ok "前端依赖安装完成"

    # 全量构建（theme + task + 主应用）
    info "执行前端构建 (npm run build:all)..."
    npm run build:all
    ok "前端构建完成"

    # 拷贝前端产物到 static 目录
    info "拷贝前端产物到 static/..."
    reset_static_output
    cp -a "${PROJECT_ROOT}/frontend/build/." "${PROJECT_ROOT}/static/"
    ok "前端产物已拷贝到 static/"

    # 拷贝 task JS 到后端资源目录（用于 SQL 解析）
    info "拷贝 task JS 到后端资源目录..."
    mkdir -p "${PROJECT_ROOT}/server/src/main/resources/javascript"
    cp -f "${PROJECT_ROOT}/frontend/build/task/index.js" \
          "${PROJECT_ROOT}/server/src/main/resources/javascript/parser.js"
    ok "task JS 已拷贝"

    cd "${PROJECT_ROOT}"
    echo ""
}

# ============================================================
# 后端构建
# ============================================================
build_backend() {
    info "========== 后端构建 =========="

    cd "${PROJECT_ROOT}"

    # 构建 Maven 参数
    MVN_ARGS="-T 1C"  # 每个 CPU 核心一个线程
    if [ "$SKIP_TEST" = true ]; then
        MVN_ARGS="${MVN_ARGS} -DskipTests"
    fi

    # 跳过前端构建（已手动完成），同时跳过 exec-maven-plugin 的 npm 命令
    info "执行 Maven 构建..."
    mvn clean package ${MVN_ARGS} \
        -Dexec.skip=true \
        -P '!default'
    ok "Maven 构建完成"

    echo ""
}

# ============================================================
# 打包结果
# ============================================================
show_result() {
    info "========== 构建结果 =========="

    # 查找生成的 zip 包
    ZIP_FILE=$(find "${PROJECT_ROOT}" -maxdepth 1 -name "datart-server-*install.zip" | head -1)

    if [ -n "$ZIP_FILE" ] && [ -f "$ZIP_FILE" ]; then
        ZIP_SIZE=$(du -h "$ZIP_FILE" | cut -f1)
        ok "安装包: ${ZIP_FILE} (${ZIP_SIZE})"
    else
        warn "未找到 zip 安装包，请检查 Maven assembly 配置"
    fi

    # static 目录
    if [ -d "${PROJECT_ROOT}/static" ]; then
        STATIC_SIZE=$(du -sh "${PROJECT_ROOT}/static" | cut -f1)
        ok "前端静态资源: ${PROJECT_ROOT}/static/ (${STATIC_SIZE})"
    fi

    echo ""
    info "部署方式:"
    echo "  1. 解压 zip 包到目标目录"
    echo "  2. 修改 config/profiles/application-config.yml 配置数据库等"
    echo "  3. 执行 bin/datart-server.sh start"
    echo ""
}

# ============================================================
# 主流程
# ============================================================
main() {
    echo ""
    echo "============================================"
    echo "  Datart 全量打包"
    echo "============================================"
    echo ""

    START_TIME=$(date +%s)

    check_prerequisites

    if [ "$CLEAN" = true ]; then
        do_clean
    fi

    if [ "$SKIP_FRONTEND" = false ]; then
        build_frontend
    else
        warn "跳过前端构建 (--skip-frontend)"
        # 确保 static 目录存在
        if [ ! -d "${PROJECT_ROOT}/static" ]; then
            warn "static 目录不存在，后端打包可能缺少前端资源"
        fi
        echo ""
    fi

    if [ "$SKIP_BACKEND" = false ]; then
        build_backend
    else
        warn "跳过后端构建 (--skip-backend)"
        echo ""
    fi

    show_result

    END_TIME=$(date +%s)
    DURATION=$(( END_TIME - START_TIME ))
    MINUTES=$(( DURATION / 60 ))
    SECONDS=$(( DURATION % 60 ))

    ok "全部构建完成，耗时: ${MINUTES}分${SECONDS}秒"
    echo ""
}

main
