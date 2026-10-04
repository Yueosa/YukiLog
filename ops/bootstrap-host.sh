#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

readonly OPS_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly ENV_FILE="/etc/yukilog/yukilog.env"
readonly NGINX_AVAILABLE="/etc/nginx/sites-available/yukilog-blog.conf"
readonly NGINX_ENABLED="/etc/nginx/sites-enabled/yukilog-blog.conf"

[[ $EUID -eq 0 ]] || { echo "请以 root 运行" >&2; exit 1; }
[[ ! -e "$ENV_FILE" ]] \
    || { echo "$ENV_FILE 已存在；为避免覆盖密钥，已停止" >&2; exit 1; }

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y \
    nginx certbot postgresql postgresql-client curl ca-certificates openssl
systemctl enable --now postgresql

if ! id yukilog >/dev/null 2>&1; then
    useradd --system --home-dir /var/lib/yukilog \
        --shell /usr/sbin/nologin yukilog
fi

install -d -m 755 /var/www/yukilog/releases /var/www/yukilog/incoming
install -d -o yukilog -g yukilog -m 750 \
    /var/lib/yukilog /var/lib/yukilog/media /var/lib/yukilog/media/assets \
    /var/lib/yukilog/media/staging
install -d -m 700 /var/backups/yukilog
install -d -m 750 /etc/yukilog
install -d -m 755 /usr/local/lib/yukilog/nginx
install -d -m 755 /etc/letsencrypt/renewal-hooks/deploy
install -d -o www-data -g www-data -m 755 /var/www/letsencrypt

readonly DATABASE_PASSWORD="$(openssl rand -hex 24)"
readonly SUBSCRIPTION_SECRET="$(openssl rand -hex 32)"

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

cat > "$ENV_FILE" <<EOF
DATABASE_URL=postgresql://yukilog:$DATABASE_PASSWORD@127.0.0.1:5432/yukilog
YUKILOG_LISTEN_ADDR=127.0.0.1:3000
YUKILOG_PUBLIC_ORIGIN=https://blog.yeastar.xin
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
install -m 644 "$OPS_DIR/nginx/yukilog.conf" \
    /usr/local/lib/yukilog/nginx/yukilog.conf

if [[ -s /etc/letsencrypt/live/blog.yeastar.xin/fullchain.pem ]]; then
    install -m 644 "$OPS_DIR/nginx/yukilog.conf" "$NGINX_AVAILABLE"
else
    install -m 644 "$OPS_DIR/nginx/yukilog-http-bootstrap.conf" "$NGINX_AVAILABLE"
fi
ln -sfn "$NGINX_AVAILABLE" "$NGINX_ENABLED"

systemctl daemon-reload
systemctl enable nginx postgresql
nginx -t
systemctl restart nginx

cat <<'EOF'
主机基础设施已建立，但应用尚未启动。

下一步：
1. 将 release tar.gz 上传到 /var/www/yukilog/incoming/
2. 运行 sudo yukilog-deploy <release.tar.gz>
3. 首次创建管理员：
   sudo bash -c 'set -a; source /etc/yukilog/yukilog.env; set +a; \
     exec /var/www/yukilog/current/bin/yukilog-admin create-admin <username> <display-name>'
4. HTTP 验证正常后运行 sudo yukilog-enable-https <证书通知邮箱>。
5. 完成 SMTP 故障注入和灰度验证后，将 YUKILOG_MAIL_ENABLED 改为 true，
   再执行 systemctl enable --now yukilog-mailer。
EOF
