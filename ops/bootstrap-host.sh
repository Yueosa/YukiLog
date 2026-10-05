#!/usr/bin/env bash
# YukiLog 主机初始化：依赖、用户、目录、PostgreSQL、环境文件、nginx 与运维脚本。
#
# 交互模式（TTY）会逐项询问；非交互（如部署演练）使用默认值，
# 也可以用环境变量覆盖：
#   YUKILOG_DOMAIN            站点域名（默认 blog.yeastar.xin）
#   YUKILOG_CERT_EMAIL        证书通知邮箱（可留空，enable-https 时再给）
#   YUKILOG_INSTALL_POSTGRES  true/false（默认 true；false 时需给 YUKILOG_DATABASE_URL）
#   YUKILOG_DATABASE_URL      外部 PostgreSQL 连接串（仅 YUKILOG_INSTALL_POSTGRES=false）
#   YUKILOG_SKIP_PACKAGE_INSTALL=true  跳过 apt 安装，仅校验命令存在（演练用）

set -Eeuo pipefail
umask 077

readonly OPS_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly ENV_FILE="/etc/yukilog/yukilog.env"
readonly BOOTSTRAP_CONF="/etc/yukilog/bootstrap.conf"
readonly NGINX_AVAILABLE="/etc/nginx/sites-available/yukilog-blog.conf"
readonly NGINX_ENABLED="/etc/nginx/sites-enabled/yukilog-blog.conf"
readonly DEFAULT_DOMAIN="blog.yeastar.xin"

C_RED=$'\033[31m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'
C_BOLD=$'\033[1m'; C_NC=$'\033[0m'

info() { printf '%s[+]%s %s\n' "$C_GREEN" "$C_NC" "$*"; }
warn() { printf '%s[!]%s %s\n' "$C_YELLOW" "$C_NC" "$*" >&2; }
die() { printf '%s[x]%s %s\n' "$C_RED" "$C_NC" "$*" >&2; exit 1; }
title() { printf '\n%s%s%s\n' "$C_BOLD" "$*" "$C_NC"; }

[[ $EUID -eq 0 ]] || die "请以 root 运行"
[[ ! -e "$ENV_FILE" ]] \
    || die "$ENV_FILE 已存在；为避免覆盖密钥，已停止"

valid_domain() {
    [[ "$1" =~ ^([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$ ]]
}

# prompt <说明> <默认值（可空）> -> 回答打印到 stdout
prompt() {
    local label="$1" default="$2" value
    if [[ -n "$default" ]]; then
        read -rp "  $label [$default]: " value
        printf '%s' "${value:-$default}"
    else
        read -rp "  $label（可留空）: " value
        printf '%s' "$value"
    fi
}

configure() {
    title "站点配置"
    if [[ ! -t 0 ]]; then
        DOMAIN="${YUKILOG_DOMAIN:-$DEFAULT_DOMAIN}"
        CERT_EMAIL="${YUKILOG_CERT_EMAIL:-}"
        INSTALL_POSTGRES="${YUKILOG_INSTALL_POSTGRES:-true}"
        DATABASE_URL="${YUKILOG_DATABASE_URL:-}"
        info "非交互模式：域名 $DOMAIN，本机 PostgreSQL：$INSTALL_POSTGRES"
    else
        DOMAIN="$(prompt '站点域名' "${YUKILOG_DOMAIN:-$DEFAULT_DOMAIN}")"
        CERT_EMAIL="$(prompt '证书通知邮箱（enable-https 用，之后可补）' "${YUKILOG_CERT_EMAIL:-}")"
        local answer
        read -rp "  在本机安装并初始化 PostgreSQL？[Y/n]: " answer
        if [[ "${answer,,}" == n ]]; then
            INSTALL_POSTGRES=false
            read -rp "  外部数据库 DATABASE_URL: " DATABASE_URL
        else
            INSTALL_POSTGRES=true
            DATABASE_URL=""
        fi
    fi

    valid_domain "$DOMAIN" || die "域名格式无效：$DOMAIN"
    [[ -z "$CERT_EMAIL" || "$CERT_EMAIL" == *@*.* ]] \
        || die "证书通知邮箱格式无效：$CERT_EMAIL"
    if [[ "$INSTALL_POSTGRES" != true ]]; then
        [[ "$DATABASE_URL" == postgresql://* || "$DATABASE_URL" == postgres://* ]] \
            || die "YUKILOG_INSTALL_POSTGRES=false 时需要合法的 DATABASE_URL"
    fi
}

configure

install -d -m 750 /etc/yukilog
{
    printf 'DOMAIN=%q\n' "$DOMAIN"
    printf 'CERT_EMAIL=%q\n' "$CERT_EMAIL"
} > "$BOOTSTRAP_CONF"
chmod 600 "$BOOTSTRAP_CONF"

title "安装依赖"
if [[ "${YUKILOG_SKIP_PACKAGE_INSTALL:-false}" == "true" ]]; then
    for command in nginx certbot psql pg_dump curl openssl; do
        command -v "$command" >/dev/null \
            || die "演练镜像缺少依赖：$command"
    done
else
    packages=(nginx certbot postgresql-client curl ca-certificates openssl)
    [[ "$INSTALL_POSTGRES" == true ]] && packages+=(postgresql)
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y "${packages[@]}"
fi
if [[ "$INSTALL_POSTGRES" == true ]]; then
    systemctl enable --now postgresql
fi

if ! id yukilog >/dev/null 2>&1; then
    useradd --system --home-dir /var/lib/yukilog \
        --shell /usr/sbin/nologin yukilog
fi

install -d -m 755 /var/www/yukilog/releases /var/www/yukilog/incoming
install -d -o yukilog -g yukilog -m 750 \
    /var/lib/yukilog /var/lib/yukilog/media /var/lib/yukilog/media/assets \
    /var/lib/yukilog/media/staging
install -d -m 700 /var/backups/yukilog
install -d -m 755 /usr/local/lib/yukilog/nginx
install -d -m 755 /etc/letsencrypt/renewal-hooks/deploy
install -d -o www-data -g www-data -m 755 /var/www/letsencrypt

readonly SUBSCRIPTION_SECRET="$(openssl rand -hex 32)"

if [[ "$INSTALL_POSTGRES" == true ]]; then
    title "初始化本机 PostgreSQL"
    readonly DATABASE_PASSWORD="$(openssl rand -hex 24)"
    if ! runuser -u postgres -- psql -tAc \
        "SELECT 1 FROM pg_roles WHERE rolname = 'yukilog'" | grep -qx '1'; then
        runuser -u postgres -- createuser --login yukilog
    fi
    runuser -u postgres -- psql --set=ON_ERROR_STOP=1 >/dev/null <<SQL
ALTER ROLE yukilog PASSWORD '$DATABASE_PASSWORD';
SQL
    if ! runuser -u postgres -- psql -tAc \
        "SELECT 1 FROM pg_database WHERE datname = 'yukilog'" | grep -qx '1'; then
        runuser -u postgres -- createdb --owner=yukilog yukilog
    fi
    DATABASE_URL="postgresql://yukilog:$DATABASE_PASSWORD@127.0.0.1:5432/yukilog"
    info "数据库 yukilog 已就绪"
fi

cat > "$ENV_FILE" <<EOF
DATABASE_URL=$DATABASE_URL
YUKILOG_LISTEN_ADDR=127.0.0.1:3000
YUKILOG_PUBLIC_ORIGIN=https://$DOMAIN
YUKILOG_MEDIA_DIR=/var/lib/yukilog/media
YUKILOG_SUBSCRIPTION_SECRET=$SUBSCRIPTION_SECRET
YUKILOG_MAIL_ENABLED=false
YUKILOG_SMTP_HOST=
YUKILOG_SMTP_PORT=587
YUKILOG_SMTP_USERNAME=
YUKILOG_SMTP_PASSWORD=
YUKILOG_SMTP_FROM=
RUST_LOG=yukilog_server=info,tower_http=info
EOF
chmod 600 "$ENV_FILE"
chown root:root "$ENV_FILE"

install -m 644 "$OPS_DIR/systemd/yukilog-server.service" \
    /etc/systemd/system/yukilog-server.service
install -m 644 "$OPS_DIR/systemd/yukilog-mailer.service" \
    /etc/systemd/system/yukilog-mailer.service
install -m 755 "$OPS_DIR/yukilog-deploy" /usr/local/sbin/yukilog-deploy
install -m 755 "$OPS_DIR/yukilog-backup" /usr/local/sbin/yukilog-backup
install -m 755 "$OPS_DIR/yukilog-restore" /usr/local/sbin/yukilog-restore
install -m 755 "$OPS_DIR/enable-https.sh" /usr/local/sbin/yukilog-enable-https
install -m 755 "$OPS_DIR/certbot-reload-nginx" \
    /etc/letsencrypt/renewal-hooks/deploy/reload-nginx
# nginx 配置按域名实例化后存放，enable-https 时直接取用
sed "s/blog\.yeastar\.xin/$DOMAIN/g" "$OPS_DIR/nginx/yukilog.conf" \
    > /usr/local/lib/yukilog/nginx/yukilog.conf
chmod 644 /usr/local/lib/yukilog/nginx/yukilog.conf

if [[ -s "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
    sed "s/blog\.yeastar\.xin/$DOMAIN/g" "$OPS_DIR/nginx/yukilog.conf" \
        > "$NGINX_AVAILABLE"
else
    sed "s/blog\.yeastar\.xin/$DOMAIN/g" "$OPS_DIR/nginx/yukilog-http-bootstrap.conf" \
        > "$NGINX_AVAILABLE"
fi
chmod 644 "$NGINX_AVAILABLE"
ln -sfn "$NGINX_AVAILABLE" "$NGINX_ENABLED"

systemctl daemon-reload
systemctl enable nginx
[[ "$INSTALL_POSTGRES" == true ]] && systemctl enable postgresql
nginx -t
systemctl restart nginx

info "主机基础设施已建立，应用尚未启动"
cat <<EOF

下一步：
1. 将 release tar.gz 上传到 /var/www/yukilog/incoming/
2. 运行 sudo yukilog-deploy <release.tar.gz>
3. 首次创建管理员：
   sudo bash -c 'set -a; source /etc/yukilog/yukilog.env; set +a; \\
     exec /var/www/yukilog/current/bin/yukilog-admin create-admin <username> <display-name>'
4. HTTP 验证正常后运行 sudo yukilog-enable-https${CERT_EMAIL:+ $CERT_EMAIL}。
5. 完成 SMTP 故障注入和灰度验证后，将 YUKILOG_MAIL_ENABLED 改为 true，
   再执行 systemctl enable --now yukilog-mailer。
EOF
