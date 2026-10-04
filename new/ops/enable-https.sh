#!/usr/bin/env bash

set -Eeuo pipefail

readonly EMAIL="${1:-}"
readonly AVAILABLE="/etc/nginx/sites-available/yukilog-blog.conf"
readonly HTTPS_CONFIG="/usr/local/lib/yukilog/nginx/yukilog.conf"

[[ $EUID -eq 0 ]] || { echo "请以 root 运行" >&2; exit 1; }
[[ "$EMAIL" == *@*.* ]] || { echo "用法：enable-https.sh <证书通知邮箱>" >&2; exit 2; }

certbot certonly --webroot --webroot-path /var/www/letsencrypt \
    --cert-name blog.yeastar.xin \
    --domain blog.yeastar.xin \
    --email "$EMAIL" --agree-tos --non-interactive

install -m 644 "$HTTPS_CONFIG" "$AVAILABLE"
nginx -t
systemctl reload nginx
printf 'HTTPS 已启用：https://blog.yeastar.xin\n'
