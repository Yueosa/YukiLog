#!/usr/bin/env bash
# ============================================================
#  YukiLog 一键部署脚本
#  ✦ 首次部署：全流程（DB / Redis / 构建 / systemd / nginx / SSL）
#  ✦ 更新模式：从 .env 读取配置，重建 → 迁移 → 重启
#  ✦ 仅迁移：只执行未应用的增量 SQL
#
#  用法:
#    ./deploy.sh              # 自动检测模式
#    ./deploy.sh --fresh      # 强制首次部署
#    ./deploy.sh --update     # 强制更新模式
#    ./deploy.sh --db-migrate # 仅执行数据库增量迁移
# ============================================================
set -euo pipefail

# ── 颜色定义 ──────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()  { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
err()   { echo -e "${RED}[✗]${NC} $*" >&2; }
step()  { echo -e "\n${CYAN}${BOLD}══ $* ══${NC}"; }
doing() { echo -e "${CYAN}[→]${NC} $*"; }

# ── 目录定位 ──────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/yukilog-backend"
FRONTEND_DIR="$SCRIPT_DIR/yukilog-hanakoi"
DATABASE_DIR="$SCRIPT_DIR/yukilog-database"

# ── 默认值 ────────────────────────────────────────────────
DEFAULT_DOMAIN="blog.yeastar.xin"
DEFAULT_DB_HOST="localhost"
DEFAULT_DB_PORT="5432"
DEFAULT_DB_NAME="yukilog"
DEFAULT_DB_USER="lian"
DEFAULT_DB_PASS="defaultpassword"
DEFAULT_REDIS_URL="redis://localhost:6379"
DEFAULT_BACKEND_PORT=3639
DEFAULT_FRONTEND_PORT=4132

# ── 运行时状态 ────────────────────────────────────────────
NEED_HASH_UPDATE=false
FORCE_REBUILD=false
BUILD_START_TIME=$(date +%s)
MIGRATIONS_APPLIED=()
ENV_CREATED=false

# ── 模式解析 ──────────────────────────────────────────────
MODE="auto"
for arg in "$@"; do
    case "$arg" in
        --fresh)      MODE="fresh" ;;
        --update)     MODE="update" ;;
        --db-migrate) MODE="db-migrate" ;;
        *) err "未知参数: $arg"; echo "用法: $0 [--fresh|--update|--db-migrate]"; exit 1 ;;
    esac
done

# ============================================================
#  工具函数
# ============================================================

find_free_port() {
    local port="$1"
    local max_attempts=50
    for ((i = 0; i < max_attempts; i++)); do
        if ! ss -lntp 2>/dev/null | grep -q ":${port} " && \
           ! ss -lnup 2>/dev/null | grep -q ":${port} "; then
            echo "$port"; return 0
        fi
        ((port++))
    done
    err "无法在 $1 - $((port)) 范围内找到可用端口"; return 1
}

has_cmd() { command -v "$1" &>/dev/null; }

confirm() {
    local msg="$1"
    read -rp "$(echo -e "${YELLOW}$msg [Y/n]: ${NC}")" ans
    [[ -z "$ans" || "$ans" =~ ^[Yy] ]]
}

confirm_danger() {
    local msg="$1"
    read -rp "$(echo -e "${RED}[危险] $msg [y/N]: ${NC}")" ans
    [[ "$ans" =~ ^[Yy] ]]
}

# 从已有 .env 读取某个 key 的值
read_env_key() {
    local file="$1" key="$2"
    grep -E "^${key}=" "$file" 2>/dev/null | head -1 | cut -d= -f2-
}

# ============================================================
#  模式检测
# ============================================================
BACKEND_ENV="$BACKEND_DIR/.env"
FRONTEND_ENV="$FRONTEND_DIR/.env"

if [[ "$MODE" == "auto" ]]; then
    if [[ -f "$BACKEND_ENV" ]] && grep -q "^\$argon2" "$BACKEND_ENV" 2>/dev/null || \
       grep -q "^ADMIN_PASSWORD_HASH=\$argon2" "$BACKEND_ENV" 2>/dev/null; then
        MODE="update"
    elif [[ -f "$BACKEND_ENV" ]]; then
        MODE="update"
    else
        MODE="fresh"
    fi
fi

echo ""
echo -e "${BOLD}YukiLog 部署脚本${NC}"
case "$MODE" in
    fresh)      echo -e "  模式: ${GREEN}首次部署${NC}" ;;
    update)     echo -e "  模式: ${CYAN}更新模式${NC}（从 .env 读取配置）" ;;
    db-migrate) echo -e "  模式: ${YELLOW}仅数据库迁移${NC}" ;;
esac
echo ""

# ============================================================
#  仅迁移模式：直接跳到迁移步骤
# ============================================================
if [[ "$MODE" == "db-migrate" ]]; then
    if [[ ! -f "$BACKEND_ENV" ]]; then
        err "未找到 $BACKEND_ENV，无法读取数据库配置"
        exit 1
    fi
    DB_URL=$(read_env_key "$BACKEND_ENV" "DATABASE_URL")
    # 解析 DATABASE_URL: postgresql://user:pass@host:port/dbname
    DB_USER=$(echo "$DB_URL" | sed -E 's|postgresql://([^:]+):.*|\1|')
    DB_PASS=$(echo "$DB_URL" | sed -E 's|postgresql://[^:]+:([^@]+)@.*|\1|')
    DB_HOST=$(echo "$DB_URL" | sed -E 's|.*@([^:]+):.*|\1|')
    DB_PORT=$(echo "$DB_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
    DB_NAME=$(echo "$DB_URL" | sed -E 's|.*/([^/]+)$|\1|')
    step "数据库增量迁移"
    run_migrations
    echo ""
    if [[ ${#MIGRATIONS_APPLIED[@]} -eq 0 ]]; then
        info "没有待执行的迁移，数据库已是最新版本"
    else
        info "本次执行了 ${#MIGRATIONS_APPLIED[@]} 个迁移: ${MIGRATIONS_APPLIED[*]}"
    fi
    exit 0
fi

# ============================================================
#  更新模式：从 .env 读取配置
# ============================================================
if [[ "$MODE" == "update" ]]; then
    if [[ ! -f "$BACKEND_ENV" ]]; then
        err "更新模式需要已有 $BACKEND_ENV，请先运行首次部署"
        exit 1
    fi
    doing "从现有 .env 读取配置..."
    DB_URL=$(read_env_key "$BACKEND_ENV" "DATABASE_URL")
    DB_USER=$(echo "$DB_URL" | sed -E 's|postgresql://([^:]+):.*|\1|')
    DB_PASS=$(echo "$DB_URL" | sed -E 's|postgresql://[^:]+:([^@]+)@.*|\1|')
    DB_HOST=$(echo "$DB_URL" | sed -E 's|.*@([^:]+):.*|\1|')
    DB_PORT=$(echo "$DB_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
    DB_NAME=$(echo "$DB_URL" | sed -E 's|.*/([^/]+)$|\1|')
    REDIS_URL=$(read_env_key "$BACKEND_ENV" "REDIS_URL")
    BACKEND_PORT=$(read_env_key "$BACKEND_ENV" "SERVER_PORT")
    DOMAIN=$(read_env_key "$BACKEND_ENV" "CORS_ALLOWED_ORIGINS" | sed 's|https://||' | cut -d, -f1)
    DATABASE_URL="$DB_URL"
    JWT_SECRET=$(read_env_key "$BACKEND_ENV" "JWT_SECRET")
    ADMIN_USERNAME=$(read_env_key "$BACKEND_ENV" "ADMIN_USERNAME")
    FRONTEND_PORT=$(read_env_key "$FRONTEND_ENV" "PORT" 2>/dev/null || echo "$DEFAULT_FRONTEND_PORT")
    info "配置读取完成"
    echo "  域名:     ${DOMAIN:-（未检测到）}"
    echo "  数据库:   postgresql://${DB_USER}:****@${DB_HOST}:${DB_PORT}/${DB_NAME}"
    echo "  后端端口: $BACKEND_PORT"
    echo ""
    if ! confirm "确认以上配置，开始更新?"; then
        echo "更新已取消。"; exit 0
    fi
    FORCE_REBUILD=true
fi

# ============================================================
#  首次部署：收集信息
# ============================================================
if [[ "$MODE" == "fresh" ]]; then
    step "1/8  收集部署信息"

    read -rp "$(echo -e "${CYAN}域名${NC} (默认 ${DEFAULT_DOMAIN}): ")" DOMAIN
    DOMAIN="${DOMAIN:-$DEFAULT_DOMAIN}"

    echo ""
    echo -e "${BOLD}数据库配置${NC} (直接回车使用默认值)"
    read -rp "  DB 主机 (${DEFAULT_DB_HOST}): " DB_HOST; DB_HOST="${DB_HOST:-$DEFAULT_DB_HOST}"
    read -rp "  DB 端口 (${DEFAULT_DB_PORT}): " DB_PORT; DB_PORT="${DB_PORT:-$DEFAULT_DB_PORT}"
    read -rp "  DB 名称 (${DEFAULT_DB_NAME}): " DB_NAME; DB_NAME="${DB_NAME:-$DEFAULT_DB_NAME}"
    read -rp "  DB 用户 (${DEFAULT_DB_USER}): " DB_USER; DB_USER="${DB_USER:-$DEFAULT_DB_USER}"
    read -rsp "  DB 密码 (默认隐藏): " DB_PASS; echo
    DB_PASS="${DB_PASS:-$DEFAULT_DB_PASS}"
    DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

    echo ""
    read -rp "$(echo -e "${CYAN}Redis URL${NC} (默认 ${DEFAULT_REDIS_URL}): ")" REDIS_URL
    REDIS_URL="${REDIS_URL:-$DEFAULT_REDIS_URL}"

    echo ""
    echo -e "${BOLD}管理员账号${NC}"
    read -rp "  用户名 (默认 admin): " ADMIN_USERNAME; ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
    read -rsp "  密码: " ADMIN_PASSWORD; echo
    while [[ -z "$ADMIN_PASSWORD" ]]; do
        warn "密码不能为空"
        read -rsp "  密码: " ADMIN_PASSWORD; echo
    done

    step "检测可用端口"
    BACKEND_PORT=$(find_free_port "$DEFAULT_BACKEND_PORT")
    info "后端端口: $BACKEND_PORT"
    FRONTEND_START="$DEFAULT_FRONTEND_PORT"
    [[ "$FRONTEND_START" -eq "$BACKEND_PORT" ]] && ((FRONTEND_START++))
    FRONTEND_PORT=$(find_free_port "$FRONTEND_START")
    info "前端端口: $FRONTEND_PORT"
    JWT_SECRET=$(openssl rand -base64 32)
    info "JWT Secret 已自动生成"

    echo ""
    echo -e "${BOLD}部署摘要${NC}"
    echo "  域名:        $DOMAIN"
    echo "  数据库:      postgresql://${DB_USER}:****@${DB_HOST}:${DB_PORT}/${DB_NAME}"
    echo "  Redis:       $REDIS_URL"
    echo "  后端端口:    $BACKEND_PORT"
    echo "  前端端口:    $FRONTEND_PORT"
    echo "  管理员:      $ADMIN_USERNAME"
    echo ""
    if ! confirm "确认以上信息开始部署?"; then
        echo "部署已取消。"; exit 0
    fi
    NEED_HASH_UPDATE=true
fi

# ============================================================
#  迁移函数（首次部署 + 更新模式共用）
# ============================================================
run_migrations() {
    local version_dir="$DATABASE_DIR/version"
    local applied_file="$version_dir/applied.txt"

    [[ -d "$version_dir" ]] || { info "无 version/ 目录，跳过迁移"; return 0; }

    # 读取已执行版本
    local applied=()
    if [[ -f "$applied_file" ]]; then
        mapfile -t applied < "$applied_file"
    fi

    # 找出待执行的迁移（按版本号排序）
    local pending=()
    while IFS= read -r -d '' f; do
        local fname
        fname=$(basename "$f")
        local already=false
        for a in "${applied[@]}"; do
            [[ "$a" == "$fname" ]] && already=true && break
        done
        $already || pending+=("$f")
    done < <(find "$version_dir" -name "v*.sql" -print0 | sort -zV)

    if [[ ${#pending[@]} -eq 0 ]]; then
        info "数据库已是最新版本，无待执行迁移"; return 0
    fi

    echo ""
    warn "发现 ${#pending[@]} 个待执行迁移："
    for f in "${pending[@]}"; do echo "  • $(basename "$f")"; done
    echo ""
    if ! confirm "确认执行以上迁移?"; then
        warn "跳过数据库迁移（可稍后用 --db-migrate 执行）"; return 0
    fi

    for f in "${pending[@]}"; do
        local fname
        fname=$(basename "$f")
        doing "执行迁移: $fname ..."
        PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$f"
        echo "$fname" >> "$applied_file"
        MIGRATIONS_APPLIED+=("$fname")
        info "$fname 执行完成"
    done
}
# ============================================================
#  步骤编号（首次部署 8 步，更新模式 4 步）
# ============================================================
if [[ "$MODE" == "fresh" ]]; then
    STEP_DEPS="2/8"; STEP_PG="3/8"; STEP_REDIS="4/8"
    STEP_ENV="5/8"; STEP_BUILD="6/8"; STEP_SVC="7/8"; STEP_SSL="8/8"
else
    STEP_DEPS="1/4"; STEP_PG=""; STEP_REDIS=""
    STEP_ENV=""; STEP_BUILD="2/4"; STEP_SVC="3/4"; STEP_SSL="4/4"
fi

# ============================================================
#  系统依赖
# ============================================================
step "${STEP_DEPS}  检查系统依赖"

install_if_missing() {
    local cmd="$1" pkg="${2:-$1}"
    if ! has_cmd "$cmd"; then
        doing "$cmd 未安装，正在安装 $pkg ..."
        sudo apt-get update -qq
        sudo apt-get install -y -qq "$pkg"
        info "$pkg 已安装"
    else
        info "$cmd 已就绪"
    fi
}

install_if_missing "curl" "curl"
install_if_missing "git" "git"
install_if_missing "openssl" "openssl"
install_if_missing "ss" "iproute2"
install_if_missing "nginx" "nginx"

if ! has_cmd certbot; then
    doing "certbot 未安装，正在安装..."
    sudo apt-get update -qq
    sudo apt-get install -y -qq certbot python3-certbot-nginx
    info "certbot 已安装"
else
    info "certbot 已就绪"
fi

# 可选：切换国内镜像源（询问后执行）
SOURCES_LIST="/etc/apt/sources.list"
if [[ -f "$SOURCES_LIST" ]] && ! grep -q "mirrors.ustc.edu.cn\|mirrors.aliyun.com" "$SOURCES_LIST"; then
    echo ""
    if confirm "检测到官方 apt 源，是否切换为国内镜像（USTC/阿里云）以加速安装?"; then
        UBUNTU_CODENAME=$(lsb_release -sc 2>/dev/null || grep VERSION_CODENAME /etc/os-release | cut -d= -f2)
        if [[ -n "$UBUNTU_CODENAME" ]]; then
            MIRROR=""
            if curl -m 2 -s http://mirrors.ustc.edu.cn/ > /dev/null 2>&1; then
                MIRROR="mirrors.ustc.edu.cn"; info "选择中科大镜像源"
            elif curl -m 2 -s http://mirrors.aliyun.com/ > /dev/null 2>&1; then
                MIRROR="mirrors.aliyun.com"; info "选择阿里云镜像源"
            fi
            if [[ -n "$MIRROR" ]]; then
                SOURCES_BACKUP="/etc/apt/sources.list.backup-$(date +%Y%m%d-%H%M%S)"
                sudo cp "$SOURCES_LIST" "$SOURCES_BACKUP"
                info "已备份原文件到 $SOURCES_BACKUP"
                sudo tee "$SOURCES_LIST" > /dev/null <<SOURCEEOF
deb http://${MIRROR}/ubuntu/ ${UBUNTU_CODENAME} main restricted universe multiverse
deb http://${MIRROR}/ubuntu/ ${UBUNTU_CODENAME}-updates main restricted universe multiverse
deb http://${MIRROR}/ubuntu/ ${UBUNTU_CODENAME}-backports main restricted universe multiverse
deb http://${MIRROR}/ubuntu/ ${UBUNTU_CODENAME}-security main restricted universe multiverse
SOURCEEOF
                sudo apt-get update -qq
                info "镜像源切换完成"
            else
                warn "国内镜像源不可达，保持原有配置"
            fi
        fi
    else
        info "保持原有 apt 源"
    fi
fi

# ============================================================
#  PostgreSQL（仅首次部署）
# ============================================================
if [[ "$MODE" == "fresh" ]]; then
    step "${STEP_PG}  PostgreSQL"

    if ! has_cmd psql; then
        doing "PostgreSQL 未安装，正在安装..."
        sudo apt-get update -qq
        sudo apt-get install -y -qq postgresql postgresql-contrib
        sudo systemctl enable --now postgresql
        info "PostgreSQL 已安装并启动"
    else
        info "PostgreSQL 客户端已就绪"
    fi

    if systemctl is-active --quiet postgresql 2>/dev/null; then
        info "PostgreSQL 服务正在运行"
    else
        doing "正在启动 PostgreSQL 服务..."
        sudo systemctl start postgresql
        info "PostgreSQL 服务已启动"
    fi

    if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
        info "数据库用户 '${DB_USER}' 已存在"
    else
        doing "正在创建数据库用户 '${DB_USER}'..."
        sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
        info "数据库用户 '${DB_USER}' 已创建"
    fi

    if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
        info "数据库 '${DB_NAME}' 已存在"
    else
        doing "正在创建数据库 '${DB_NAME}'..."
        sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
        info "数据库 '${DB_NAME}' 已创建"
    fi

    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" 2>/dev/null || true

    SQL_FILE="$DATABASE_DIR/db/yukilog.sql"
    TABLE_COUNT=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
        "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null || echo "0")
    if [[ "$TABLE_COUNT" -gt 0 ]]; then
        info "数据库已有 ${TABLE_COUNT} 张表，跳过全量导入"
    else
        if [[ -f "$SQL_FILE" ]]; then
            doing "正在导入数据库表结构..."
            PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SQL_FILE"
            info "数据库表结构导入完成"
            # 标记所有现有版本为已执行
            VERSION_DIR="$DATABASE_DIR/version"
            APPLIED_FILE="$VERSION_DIR/applied.txt"
            if [[ -d "$VERSION_DIR" ]]; then
                : > "$APPLIED_FILE"
                while IFS= read -r -d '' f; do
                    basename "$f" >> "$APPLIED_FILE"
                done < <(find "$VERSION_DIR" -name "v*.sql" -print0 | sort -zV)
                info "已标记现有迁移版本为已执行"
            fi
        else
            warn "找不到 $SQL_FILE，请稍后手动导入"
        fi
    fi
fi

# ============================================================
#  Redis（仅首次部署）
# ============================================================
if [[ "$MODE" == "fresh" ]]; then
    step "${STEP_REDIS}  Redis"

    if has_cmd redis-cli && redis-cli ping &>/dev/null; then
        info "Redis 已就绪 (PONG)"
    else
        if ! has_cmd redis-server; then
            doing "Redis 未安装，正在安装..."
            sudo apt-get update -qq
            sudo apt-get install -y -qq redis-server
        fi
        REDIS_CONF="/etc/redis/redis.conf"
        if [[ -f "$REDIS_CONF" ]]; then
            sudo sed -i 's/^bind .*/bind 127.0.0.1 ::1/' "$REDIS_CONF"
            sudo sed -i 's/^supervised .*/supervised systemd/' "$REDIS_CONF"
        fi
        sudo systemctl enable --now redis-server
        sleep 1
        if redis-cli ping &>/dev/null; then
            info "Redis 已安装并就绪 (PONG)"
        else
            warn "Redis 已安装但 ping 失败，请手动检查"
        fi
    fi
fi
# ============================================================
#  生成 .env（仅首次部署）
# ============================================================
if [[ "$MODE" == "fresh" ]]; then
    step "${STEP_ENV}  生成环境配置文件"

    if [[ -f "$BACKEND_ENV" ]]; then
        info "后端 .env 已存在，跳过生成"
        NEED_HASH_UPDATE=false
    else
        doing "正在生成后端 .env ..."
        ADMIN_HASH="TEMP_PLACEHOLDER_WILL_BE_UPDATED_AFTER_RUST_BUILD"
        cat > "$BACKEND_ENV" <<ENVEOF
# ====================================
# YukiLog Backend 配置 (自动生成)
# ====================================

DATABASE_URL=${DATABASE_URL}
REDIS_URL=${REDIS_URL}
SERVER_HOST=127.0.0.1
SERVER_PORT=${BACKEND_PORT}
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=86400
JWT_ISSUER=yukilog
JWT_AUDIENCE=yukilog-admin
ADMIN_USERNAME=${ADMIN_USERNAME}
ADMIN_PASSWORD_HASH=${ADMIN_HASH}
CORS_ALLOWED_ORIGINS=https://${DOMAIN}
TRUST_PROXY_HEADERS=true
RUST_LOG=info
ENVEOF
        info "后端 .env 已生成"
        ENV_CREATED=true
    fi

    if [[ -f "$FRONTEND_ENV" ]]; then
        info "前端 .env 已存在，跳过生成"
    else
        doing "正在生成前端 .env ..."
        cat > "$FRONTEND_ENV" <<ENVEOF
# YukiLog 前端配置 (自动生成)
PUBLIC_API_URL=http://localhost:${BACKEND_PORT}
PUBLIC_SITE_URL=https://${DOMAIN}
PUBLIC_DEV_SKIP_AUTH=false
ENVEOF
        info "前端 .env 已生成"
    fi
fi

# ============================================================
#  构建后端
# ============================================================
step "${STEP_BUILD}  构建后端 (Rust)"

if ! has_cmd cargo; then
    doing "Rust 未安装，正在通过 rustup 安装..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    export PATH="$HOME/.cargo/bin:$PATH"
    source "$HOME/.cargo/env" 2>/dev/null || true
    info "Rust 已安装"
else
    info "Rust 工具链已就绪 ($(rustc --version))"
fi

if ! has_cmd cargo; then
    export PATH="$HOME/.cargo/bin:/root/.cargo/bin:$PATH"
fi

pushd "$BACKEND_DIR" > /dev/null
BACKEND_BIN="$BACKEND_DIR/target/release/yukilog-backend"

if [[ "$FORCE_REBUILD" == "true" ]]; then
    [[ -f "$BACKEND_BIN" ]] && rm -f "$BACKEND_BIN" && info "已清理旧后端二进制"
fi

if [[ -f "$BACKEND_BIN" ]]; then
    info "后端二进制已存在，跳过编译"
else
    doing "正在编译后端 (release 模式)..."
    BUILD_BACKEND_START=$(date +%s)
    cargo build --release
    BUILD_BACKEND_END=$(date +%s)
    info "后端编译完成（耗时 $((BUILD_BACKEND_END - BUILD_BACKEND_START))s）"
fi

if [[ "$NEED_HASH_UPDATE" == "true" ]]; then
    doing "正在生成管理员密码哈希 (Argon2) ..."
    CARGO_BIN=""
    if [[ -f "$HOME/.cargo/bin/cargo" ]]; then
        CARGO_BIN="$HOME/.cargo/bin/cargo"
    elif [[ -f "/root/.cargo/bin/cargo" ]]; then
        CARGO_BIN="/root/.cargo/bin/cargo"
    else
        CARGO_BIN="cargo"
    fi
    ADMIN_HASH=$($CARGO_BIN run --bin hash_password --release -- "$ADMIN_PASSWORD" 2>/dev/null)
    if [[ -n "$ADMIN_HASH" ]] && [[ "$ADMIN_HASH" =~ ^\$argon2 ]]; then
        info "密码哈希生成成功"
        sed -i "s|TEMP_PLACEHOLDER_WILL_BE_UPDATED_AFTER_RUST_BUILD|${ADMIN_HASH}|" "$BACKEND_ENV"
        info "后端 .env 密码哈希已更新"
    else
        err "密码哈希生成失败，请手动运行: cargo run --bin hash_password -- <密码>"
    fi
fi

popd > /dev/null

# ============================================================
#  数据库增量迁移（首次部署 + 更新模式）
# ============================================================
run_migrations

# ============================================================
#  构建前端
# ============================================================
step "  构建前端 (SvelteKit)"

if ! has_cmd node; then
    doing "Node.js 未安装，正在安装..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y -qq nodejs
    info "Node.js 已安装 ($(node --version))"
else
    info "Node.js 已就绪 ($(node --version))"
fi

if ! has_cmd pnpm; then
    doing "pnpm 未安装，正在安装..."
    corepack enable && corepack prepare pnpm@latest --activate 2>/dev/null || npm install -g pnpm
    info "pnpm 已安装"
else
    info "pnpm 已就绪"
fi

pushd "$FRONTEND_DIR" > /dev/null
# 清理旧 Astro 构建产物（如有）
if [[ -d "dist" ]]; then
    rm -rf dist
    info "已清理旧 Astro 构建产物 (dist/)"
fi
if [[ "$FORCE_REBUILD" == "true" ]] && [[ -d "build" ]]; then
    rm -rf build
    info "已清理旧前端构建"
fi

if [[ -d "build" ]]; then
    info "前端已构建，跳过"
else
    doing "正在安装前端依赖..."
    pnpm install --no-frozen-lockfile 2>/dev/null || pnpm install
    doing "正在构建前端..."
    BUILD_FRONTEND_START=$(date +%s)
    pnpm build
    BUILD_FRONTEND_END=$(date +%s)
    info "前端构建完成（耗时 $((BUILD_FRONTEND_END - BUILD_FRONTEND_START))s）"
fi
popd > /dev/null
# ============================================================
#  Systemd 服务 + Nginx + 启动
# ============================================================
step "${STEP_SVC}  配置系统服务与 Nginx"

CURRENT_USER="$(whoami)"
CURRENT_GROUP="$(id -gn)"

# ── systemd: 后端 ────────────────────────────────────────
BACKEND_SERVICE="/etc/systemd/system/yukilog-backend.service"
if [[ -f "$BACKEND_SERVICE" ]]; then
    info "后端 systemd 服务已存在，跳过创建"
else
    doing "正在创建后端 systemd 服务..."
    sudo tee "$BACKEND_SERVICE" > /dev/null <<SVCEOF
[Unit]
Description=YukiLog Backend (Rust/Axum)
After=network.target postgresql.service redis-server.service
Wants=postgresql.service redis-server.service

[Service]
Type=simple
User=${CURRENT_USER}
Group=${CURRENT_GROUP}
WorkingDirectory=${BACKEND_DIR}
EnvironmentFile=${BACKEND_DIR}/.env
ExecStart=${BACKEND_DIR}/target/release/yukilog-backend
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVCEOF
    info "后端 systemd 服务已创建"
fi

# ── systemd: 前端（总是重新生成，确保入口路径正确）────
FRONTEND_SERVICE="/etc/systemd/system/yukilog-hanakoi.service"
doing "正在写入前端 systemd 服务..."
sudo tee "$FRONTEND_SERVICE" > /dev/null <<SVCEOF
[Unit]
Description=YukiLog Frontend (SvelteKit/Node)
After=network.target

[Service]
Type=simple
User=${CURRENT_USER}
Group=${CURRENT_GROUP}
WorkingDirectory=${FRONTEND_DIR}
EnvironmentFile=${FRONTEND_DIR}/.env
Environment=HOST=127.0.0.1
Environment=PORT=${FRONTEND_PORT}
Environment=ORIGIN=https://${DOMAIN}
ExecStart=$(which node) ${FRONTEND_DIR}/build/index.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVCEOF
info "前端 systemd 服务已写入"

sudo systemctl daemon-reload

for svc in yukilog-backend yukilog-hanakoi; do
    sudo systemctl enable "$svc"
    if systemctl is-active --quiet "$svc"; then
        doing "$svc 正在运行，正在重启..."
        sudo systemctl restart "$svc"
    else
        doing "正在启动 $svc ..."
        sudo systemctl start "$svc"
    fi
    sleep 2
    if systemctl is-active --quiet "$svc"; then
        info "$svc 启动成功"
    else
        err "$svc 启动失败，请检查: journalctl -u $svc -n 30"
    fi
done

# ── Nginx 配置 ───────────────────────────────────────────
NGINX_CONF="/etc/nginx/sites-available/yukilog"
NGINX_LINK="/etc/nginx/sites-enabled/yukilog"

if [[ -f "$NGINX_CONF" ]]; then
    info "Nginx 配置已存在，跳过创建"
else
    doing "正在生成 Nginx 配置..."
    sudo tee "$NGINX_CONF" > /dev/null <<NGINXEOF
# YukiLog — Nginx 反向代理配置 (自动生成)
upstream yukilog_backend {
    server 127.0.0.1:${BACKEND_PORT};
    keepalive 16;
}
upstream yukilog_frontend {
    server 127.0.0.1:${FRONTEND_PORT};
    keepalive 16;
}
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    location /api/ {
        proxy_pass http://yukilog_backend/api/;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Connection        "";
        proxy_connect_timeout 30s;
        proxy_read_timeout    60s;
        proxy_send_timeout    60s;
    }
    location / {
        proxy_pass http://yukilog_frontend;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Connection        "";
        proxy_connect_timeout 30s;
        proxy_read_timeout    60s;
        proxy_send_timeout    60s;
    }
    location /_app/ {
        proxy_pass http://yukilog_frontend/_app/;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    add_header X-Frame-Options        "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff"    always;
    add_header X-XSS-Protection       "1; mode=block" always;
    access_log /var/log/nginx/yukilog_access.log;
    error_log  /var/log/nginx/yukilog_error.log;
}
NGINXEOF
    info "Nginx 配置已生成"
fi

[[ -L "$NGINX_LINK" ]] || sudo ln -s "$NGINX_CONF" "$NGINX_LINK"

if [[ -L "/etc/nginx/sites-enabled/default" ]]; then
    if confirm_danger "是否移除 Nginx 默认站点 (sites-enabled/default)?"; then
        sudo rm -f /etc/nginx/sites-enabled/default
        info "已移除 Nginx 默认站点"
    else
        warn "保留 Nginx 默认站点，可能与本站配置冲突"
    fi
fi

if sudo nginx -t 2>&1; then
    sudo systemctl reload nginx
    info "Nginx 配置已重载"
else
    err "Nginx 配置测试失败，请手动检查"
fi

# ============================================================
#  SSL 证书
# ============================================================
step "${STEP_SSL}  SSL 证书"

CERT_PATH="/etc/letsencrypt/live/${DOMAIN:-_}"
if [[ -d "$CERT_PATH" ]]; then
    info "SSL 证书已存在，跳过申请"
else
    if confirm "是否现在申请 Let's Encrypt SSL 证书 (需要域名已解析到本机)?"; then
        doing "正在申请 SSL 证书..."
        if sudo certbot --nginx -d "$DOMAIN" --agree-tos \
             --register-unsafely-without-email --redirect; then
            info "SSL 证书申请成功，HTTPS 已启用"
        else
            err "SSL 证书申请失败"
            echo "  可能原因: 域名未解析到本机 / 80 端口不可达"
            echo "  稍后手动重试: sudo certbot --nginx -d ${DOMAIN}"
        fi
    else
        warn "跳过 SSL 申请，稍后可手动运行: sudo certbot --nginx -d ${DOMAIN}"
    fi
fi

if systemctl is-enabled --quiet certbot.timer 2>/dev/null; then
    info "certbot 自动续期已启用"
else
    sudo systemctl enable --now certbot.timer 2>/dev/null || \
        warn "certbot.timer 不可用，请手动配置续期 cron"
fi

# ============================================================
#  完成摘要
# ============================================================
BUILD_END_TIME=$(date +%s)
TOTAL_ELAPSED=$((BUILD_END_TIME - BUILD_START_TIME))

echo ""
echo -e "${GREEN}${BOLD}════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ✨ YukiLog 部署完成！${NC}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════${NC}"
echo ""
echo -e "  网站地址:   ${CYAN}https://${DOMAIN:-（未配置）}${NC}"
echo -e "  管理后台:   ${CYAN}https://${DOMAIN:-（未配置）}/admin/login${NC}"
echo -e "  总耗时:     ${TOTAL_ELAPSED}s"
echo ""

echo -e "  ${BOLD}服务状态:${NC}"
for svc in yukilog-backend yukilog-hanakoi; do
    if systemctl is-active --quiet "$svc" 2>/dev/null; then
        echo -e "    ${GREEN}●${NC} $svc  运行中"
    else
        echo -e "    ${RED}●${NC} $svc  未运行"
    fi
done
echo ""

if [[ ${#MIGRATIONS_APPLIED[@]} -gt 0 ]]; then
    echo -e "  ${BOLD}本次执行的迁移:${NC}"
    for m in "${MIGRATIONS_APPLIED[@]}"; do
        echo "    • $m"
    done
    echo ""
fi

if [[ "$ENV_CREATED" == "true" ]]; then
    echo -e "  ${YELLOW}[!]${NC} 新生成了 .env 文件，请妥善保管"
fi

echo -e "  ${BOLD}服务管理:${NC}"
echo "    sudo systemctl status  yukilog-backend"
echo "    sudo systemctl status  yukilog-hanakoi"
echo "    sudo systemctl restart yukilog-backend"
echo "    sudo systemctl restart yukilog-hanakoi"
echo ""
echo -e "  ${BOLD}查看日志:${NC}"
echo "    journalctl -u yukilog-backend -f"
echo "    journalctl -u yukilog-hanakoi -f"
echo ""
echo -e "  ${BOLD}数据库迁移:${NC}"
echo "    ./deploy.sh --db-migrate"
echo ""
