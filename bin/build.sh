#!/bin/bash
#
# Datart 全量打包脚本
#
# 用法:
#   ./bin/build.sh [选项]
#
# 选项:
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

info() {
    echo -e "${CYAN}[INFO]${NC}  $*"
}

ok() {
    echo -e "${GREEN}[OK]${NC}    $*"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC}  $*"
}

error() {
    echo -e "${RED}[ERROR]${NC} $*"
    exit 1
}

# ============================================================
# 项目根目录
# ============================================================
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd -P)
PROJECT_ROOT=$(cd "${SCRIPT_DIR}/.." && pwd -P)

FRONTEND_DIR="${PROJECT_ROOT}/frontend"
FRONTEND_BUILD_DIR="${FRONTEND_DIR}/build"
STATIC_DIR="${PROJECT_ROOT}/static"

TASK_BUILD_FILE="${FRONTEND_BUILD_DIR}/task/parser.js"
TASK_PUBLIC_FILE="${FRONTEND_DIR}/public/task/parser.js"
TASK_BACKEND_DIR="${PROJECT_ROOT}/server/src/main/resources/javascript"
TASK_BACKEND_FILE="${TASK_BACKEND_DIR}/parser.js"

cd "${PROJECT_ROOT}"

# ============================================================
# 解析参数
# ============================================================
SKIP_FRONTEND=false
SKIP_BACKEND=false
SKIP_TEST=false
CLEAN=false

for arg in "$@"; do
    case "$arg" in
        --skip-frontend)
            SKIP_FRONTEND=true
            ;;
        --skip-backend)
            SKIP_BACKEND=true
            ;;
        --skip-test)
            SKIP_TEST=true
            ;;
        --clean)
            CLEAN=true
            ;;
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
        *)
            warn "未知参数: $arg"
            ;;
    esac
done

# ============================================================
# 环境检查
# ============================================================
check_prerequisites() {
    info "检查构建环境..."

    # --------------------------------------------------------
    # Java
    # --------------------------------------------------------
    if ! command -v java &>/dev/null; then
        error "未找到 Java，请安装 JDK 17"
    fi

    JAVA_VERSION_TEXT=$(java -version 2>&1 | sed -n '1p')
    JAVA_VERSION_NUMBER=$(echo "${JAVA_VERSION_TEXT}" | awk -F '"' '{print $2}')

    JAVA_MAJOR=$(echo "${JAVA_VERSION_NUMBER}" | cut -d'.' -f1)

    # 兼容旧版 Java 版本号，例如 1.8
    if [ "${JAVA_MAJOR}" = "1" ]; then
        JAVA_MAJOR=$(echo "${JAVA_VERSION_NUMBER}" | cut -d'.' -f2)
    fi

    if [ "${JAVA_MAJOR}" -lt 17 ]; then
        error "需要 Java 17+，当前版本: ${JAVA_VERSION_TEXT}"
    fi

    ok "Java: ${JAVA_VERSION_TEXT}"

    # --------------------------------------------------------
    # Maven
    # --------------------------------------------------------
    if ! command -v mvn &>/dev/null; then
        error "未找到 Maven，请安装 Maven 3.6+"
    fi

    MAVEN_VERSION_TEXT=$(mvn -version 2>&1 | sed -n '1p')
    ok "Maven: ${MAVEN_VERSION_TEXT}"

    # --------------------------------------------------------
    # Node / npm
    # 仅前端构建时检查
    # --------------------------------------------------------
    if [ "${SKIP_FRONTEND}" = false ]; then

        if ! command -v node &>/dev/null; then
            error "未找到 Node.js，请安装 Node 18+"
        fi

        NODE_VERSION=$(node -v)
        NODE_MAJOR=$(echo "${NODE_VERSION}" | sed 's/^v//' | cut -d'.' -f1)

        if [ "${NODE_MAJOR}" -lt 18 ]; then
            error "需要 Node 18+，当前版本: ${NODE_VERSION}"
        fi

        ok "Node: ${NODE_VERSION}"

        if ! command -v npm &>/dev/null; then
            error "未找到 npm"
        fi

        ok "npm: $(npm -v)"
    fi

    echo ""
}

# ============================================================
# 清理 static
# ============================================================
reset_static_output() {
    # 安全保护，防止异常变量导致 rm -rf 错误目录
    if [ -z "${PROJECT_ROOT}" ] || [ "${PROJECT_ROOT}" = "/" ]; then
        error "项目根目录无效，拒绝清理静态资源"
    fi

    rm -rf -- "${STATIC_DIR}"
    mkdir -p -- "${STATIC_DIR}"
}

# ============================================================
# 清理旧产物
# ============================================================
do_clean() {
    info "清理旧构建产物..."

    if [ -z "${PROJECT_ROOT}" ] || [ "${PROJECT_ROOT}" = "/" ]; then
        error "项目根目录无效，拒绝执行 clean"
    fi

    rm -rf -- "${STATIC_DIR}"
    rm -rf -- "${FRONTEND_BUILD_DIR}"
    rm -rf -- "${PROJECT_ROOT}/server/target"

    rm -f -- "${PROJECT_ROOT}"/datart-server-*install.zip

    ok "清理完成"
    echo ""
}

# ============================================================
# 校验 task JS
# ============================================================
check_task_bundle() {
    info "检查 task JS 构建产物..."

    # 当前项目的 esbuild.task.mjs 输出：
    #
    # frontend/public/task/parser.js
    #
    # Vite 构建完成后 public 内容会进入：
    #
    # frontend/build/task/parser.js

    if [ ! -f "${TASK_PUBLIC_FILE}" ]; then
        error "未找到 task 原始构建产物: ${TASK_PUBLIC_FILE}"
    fi

    if [ ! -f "${TASK_BUILD_FILE}" ]; then
        error "未找到 task 最终构建产物: ${TASK_BUILD_FILE}"
    fi

    if [ ! -s "${TASK_BUILD_FILE}" ]; then
        error "task JS 文件为空: ${TASK_BUILD_FILE}"
    fi

    TASK_SIZE=$(du -h "${TASK_BUILD_FILE}" | cut -f1)

    ok "task JS: ${TASK_BUILD_FILE} (${TASK_SIZE})"
}

# ============================================================
# 拷贝 task JS 到后端资源
# ============================================================
copy_task_to_backend() {
    info "拷贝 task JS 到后端资源目录..."

    if [ ! -f "${TASK_BUILD_FILE}" ]; then
        error "无法拷贝 task JS，文件不存在: ${TASK_BUILD_FILE}"
    fi

    mkdir -p "${TASK_BACKEND_DIR}"

    cp -f \
        "${TASK_BUILD_FILE}" \
        "${TASK_BACKEND_FILE}"

    if [ ! -f "${TASK_BACKEND_FILE}" ]; then
        error "task JS 拷贝失败: ${TASK_BACKEND_FILE}"
    fi

    ok "task JS 已拷贝到: ${TASK_BACKEND_FILE}"
}

# ============================================================
# 前端构建
# ============================================================
build_frontend() {
    info "========== 前端构建 =========="

    cd "${FRONTEND_DIR}"

    # --------------------------------------------------------
    # 安装依赖
    # --------------------------------------------------------
    info "安装前端依赖 (npm install)..."

    npm install --legacy-peer-deps

    ok "前端依赖安装完成"

    # --------------------------------------------------------
    # 全量构建
    #
    # 当前 package.json:
    #
    # build:task = node esbuild.task.mjs
    # build      = vite build
    # build:all  = npm run build:task && npm run build
    # --------------------------------------------------------
    info "执行前端构建 (npm run build:all)..."

    npm run build:all

    ok "前端构建完成"

    # --------------------------------------------------------
    # 校验前端 build 目录
    # --------------------------------------------------------
    if [ ! -d "${FRONTEND_BUILD_DIR}" ]; then
        error "前端构建目录不存在: ${FRONTEND_BUILD_DIR}"
    fi

    if [ ! -f "${FRONTEND_BUILD_DIR}/index.html" ]; then
        error "前端构建结果异常，未找到: ${FRONTEND_BUILD_DIR}/index.html"
    fi

    # --------------------------------------------------------
    # 校验 task/parser.js
    # --------------------------------------------------------
    check_task_bundle

    # --------------------------------------------------------
    # 拷贝前端产物到项目根目录 static/
    # --------------------------------------------------------
    info "拷贝前端产物到 static/..."

    reset_static_output

    cp -a \
        "${FRONTEND_BUILD_DIR}/." \
        "${STATIC_DIR}/"

    if [ ! -f "${STATIC_DIR}/index.html" ]; then
        error "前端静态资源拷贝失败，未找到: ${STATIC_DIR}/index.html"
    fi

    ok "前端产物已拷贝到 static/"

    # --------------------------------------------------------
    # 拷贝 task JS 到后端资源目录
    #
    # 注意：
    # 旧版路径：
    #   frontend/build/task/index.js
    #
    # 当前项目实际路径：
    #   frontend/build/task/parser.js
    # --------------------------------------------------------
    copy_task_to_backend

    cd "${PROJECT_ROOT}"

    echo ""
}

# ============================================================
# 后端构建前检查
# ============================================================
check_backend_resources() {
    info "检查后端构建资源..."

    # --------------------------------------------------------
    # 前端 static
    # --------------------------------------------------------
    if [ ! -d "${STATIC_DIR}" ]; then
        warn "static 目录不存在，最终安装包可能缺少前端资源"
    elif [ ! -f "${STATIC_DIR}/index.html" ]; then
        warn "static/index.html 不存在，最终安装包可能缺少有效前端页面"
    else
        ok "static 前端资源正常"
    fi

    # --------------------------------------------------------
    # parser.js
    # --------------------------------------------------------
    if [ ! -f "${TASK_BACKEND_FILE}" ]; then

        # 如果 skip frontend，但 build 目录里仍然存在 parser.js，
        # 自动补一次，避免后端打包缺少 parser.js。
        if [ -f "${TASK_BUILD_FILE}" ]; then

            warn "后端 parser.js 不存在，但发现前端历史构建产物，自动补拷贝"

            copy_task_to_backend

        else
            warn "未找到后端 task JS: ${TASK_BACKEND_FILE}"
            warn "如果 SQL 解析依赖 parser.js，运行时可能出现异常"
        fi

    else
        TASK_BACKEND_SIZE=$(du -h "${TASK_BACKEND_FILE}" | cut -f1)
        ok "后端 task JS 正常: ${TASK_BACKEND_FILE} (${TASK_BACKEND_SIZE})"
    fi

    echo ""
}

# ============================================================
# 后端构建
# ============================================================
build_backend() {
    info "========== 后端构建 =========="

    cd "${PROJECT_ROOT}"

    check_backend_resources

    # --------------------------------------------------------
    # Maven 参数
    # 使用数组，避免字符串参数拆分问题
    # --------------------------------------------------------
    MVN_ARGS=(
        clean
        package
        "-T"
        "1C"
        "-Dexec.skip=true"
        "-P"
        "!default"
    )

    if [ "${SKIP_TEST}" = true ]; then
        MVN_ARGS+=("-DskipTests")
    fi

    info "执行 Maven 构建..."

    if [ "${SKIP_TEST}" = true ]; then
        info "后端单元测试: 跳过"
    else
        info "后端单元测试: 执行"
    fi

    mvn "${MVN_ARGS[@]}"

    ok "Maven 构建完成"

    echo ""
}

# ============================================================
# 打包结果
# ============================================================
show_result() {
    info "========== 构建结果 =========="

    # --------------------------------------------------------
    # 查找安装包
    # --------------------------------------------------------
    ZIP_FILE=$(
        find "${PROJECT_ROOT}" \
            -maxdepth 1 \
            -type f \
            -name "datart-server-*install.zip" \
            -print \
            | head -1 || true
    )

    if [ -n "${ZIP_FILE}" ] && [ -f "${ZIP_FILE}" ]; then

        ZIP_SIZE=$(du -h "${ZIP_FILE}" | cut -f1)

        ok "安装包: ${ZIP_FILE} (${ZIP_SIZE})"

    else

        warn "未找到 zip 安装包，请检查 Maven assembly 配置"

    fi

    # --------------------------------------------------------
    # static
    # --------------------------------------------------------
    if [ -d "${STATIC_DIR}" ]; then

        STATIC_SIZE=$(du -sh "${STATIC_DIR}" | cut -f1)

        ok "前端静态资源: ${STATIC_DIR}/ (${STATIC_SIZE})"

    else

        warn "未找到前端 static 目录"

    fi

    # --------------------------------------------------------
    # task/parser.js
    # --------------------------------------------------------
    if [ -f "${TASK_BUILD_FILE}" ]; then

        TASK_BUILD_SIZE=$(du -h "${TASK_BUILD_FILE}" | cut -f1)

        ok "前端 task JS: ${TASK_BUILD_FILE} (${TASK_BUILD_SIZE})"

    else

        warn "未找到前端 task JS: ${TASK_BUILD_FILE}"

    fi

    if [ -f "${TASK_BACKEND_FILE}" ]; then

        TASK_BACKEND_SIZE=$(du -h "${TASK_BACKEND_FILE}" | cut -f1)

        ok "后端 task JS: ${TASK_BACKEND_FILE} (${TASK_BACKEND_SIZE})"

    else

        warn "未找到后端 task JS: ${TASK_BACKEND_FILE}"

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

    # --------------------------------------------------------
    # clean
    # --------------------------------------------------------
    if [ "${CLEAN}" = true ]; then
        do_clean
    fi

    # --------------------------------------------------------
    # frontend
    # --------------------------------------------------------
    if [ "${SKIP_FRONTEND}" = false ]; then

        build_frontend

    else

        warn "跳过前端构建 (--skip-frontend)"

        if [ ! -d "${STATIC_DIR}" ]; then
            warn "static 目录不存在，后端打包可能缺少前端资源"
        fi

        if [ ! -f "${TASK_BACKEND_FILE}" ]; then

            if [ -f "${TASK_BUILD_FILE}" ]; then
                warn "后端 parser.js 不存在，将在后端构建前自动从 frontend/build 拷贝"
            else
                warn "frontend/build/task/parser.js 和后端 parser.js 均不存在"
            fi

        fi

        echo ""
    fi

    # --------------------------------------------------------
    # backend
    # --------------------------------------------------------
    if [ "${SKIP_BACKEND}" = false ]; then

        build_backend

    else

        warn "跳过后端构建 (--skip-backend)"
        echo ""

    fi

    # --------------------------------------------------------
    # result
    # --------------------------------------------------------
    show_result

    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    MINUTES=$((DURATION / 60))
    SECONDS=$((DURATION % 60))

    ok "全部构建完成，耗时: ${MINUTES}分${SECONDS}秒"

    echo ""
}

main "$@"
