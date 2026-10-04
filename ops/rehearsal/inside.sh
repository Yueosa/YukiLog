#!/usr/bin/env bash

set -Eeuo pipefail
umask 027

readonly INPUT="/root/rehearsal-input"
readonly RESULTS="/root/rehearsal-results"
readonly WORK="/root/rehearsal-work"
mkdir -p "$RESULTS" "$WORK"
exec > >(tee -a "$RESULTS/transcript.log") 2>&1

collect_diagnostics() {
    local status="$1"
    systemctl --no-pager --full status \
        postgresql.service nginx.service yukilog-server.service \
        yukilog-mailer.service >"$RESULTS/services.txt" 2>&1 || true
    journalctl --no-pager -b \
        -u postgresql.service -u nginx.service \
        -u yukilog-server.service -u yukilog-mailer.service \
        >"$RESULTS/journal.txt" 2>&1 || true
    {
        printf 'exit_status=%s\n' "$status"
        printf 'container_os='
        . /etc/os-release
        printf '%s %s\n' "$NAME" "$VERSION_ID"
        printf 'kernel=%s\n' "$(uname -r)"
        printf 'mail_enabled=%s\n' "${YUKILOG_MAIL_ENABLED:-unset}"
    } >"$RESULTS/environment.txt"
}
trap 'status=$?; collect_diagnostics "$status"' EXIT

fail() {
    echo "演练断言失败：$*" >&2
    exit 1
}

wait_ready() {
    local ready=false
    for _ in {1..40}; do
        if curl -fsS http://127.0.0.1:3000/health/ready >/dev/null; then
            ready=true
            break
        fi
        sleep 1
    done
    [[ "$ready" == true ]] || fail "应用未进入 ready 状态"
}

make_release() {
    local source="$1" version="$2" mode="$3" destination="$4"
    local stage="$WORK/stage-$version"
    rm -rf -- "$stage"
    mkdir -p "$stage"
    tar -xzf "$source" -C "$stage"
    printf '%s\n' "$version" >"$stage/RELEASE"
    if [[ "$mode" == fail ]]; then
        cat >"$stage/bin/yukilog-server" <<'EOF'
#!/bin/sh
echo "intentional rehearsal failure" >&2
exit 42
EOF
        chmod 755 "$stage/bin/yukilog-server"
    fi
    (
        cd "$stage"
        find bin admin -type f -print0 \
            | LC_ALL=C sort -z \
            | xargs -0 sha256sum >MANIFEST.sha256
        sha256sum RELEASE >>MANIFEST.sha256
    )
    tar -C "$stage" -czf "$destination" .
    (
        cd "$(dirname "$destination")"
        sha256sum "$(basename "$destination")" \
            >"$(basename "$destination").sha256"
    )
}

mapfile -t source_archives < <(
    printf '%s\n' "$INPUT"/yukilog-*.tar.gz \
        | while IFS= read -r archive; do [[ -f "$archive" ]] && printf '%s\n' "$archive"; done
)
((${#source_archives[@]} == 1)) || fail "输入 release 数量不是 1"
readonly SOURCE_ARCHIVE="${source_archives[0]}"
(
    cd "$INPUT"
    sha256sum -c "$(basename "$SOURCE_ARCHIVE").sha256"
)
readonly SOURCE_VERSION="$(tar -xOf "$SOURCE_ARCHIVE" ./RELEASE | tr -d '\r\n')"
readonly SOURCE_SHA="${SOURCE_VERSION#*-}"
[[ "$SOURCE_SHA" =~ ^[a-f0-9]{7,40}$ ]] || fail "源 release 版本无效"

readonly FIRST_FAIL_VERSION="20990101T000001Z-$SOURCE_SHA"
readonly HEALTHY_VERSION="20990101T000002Z-$SOURCE_SHA"
readonly ROLLBACK_FAIL_VERSION="20990101T000003Z-$SOURCE_SHA"
readonly FIRST_FAIL="$WORK/yukilog-$FIRST_FAIL_VERSION.tar.gz"
readonly HEALTHY="$WORK/yukilog-$HEALTHY_VERSION.tar.gz"
readonly ROLLBACK_FAIL="$WORK/yukilog-$ROLLBACK_FAIL_VERSION.tar.gz"
make_release "$SOURCE_ARCHIVE" "$FIRST_FAIL_VERSION" fail "$FIRST_FAIL"
make_release "$SOURCE_ARCHIVE" "$HEALTHY_VERSION" healthy "$HEALTHY"
make_release "$SOURCE_ARCHIVE" "$ROLLBACK_FAIL_VERSION" fail "$ROLLBACK_FAIL"

echo "== 初始化干净 Ubuntu 主机 =="
YUKILOG_SKIP_PACKAGE_INSTALL=true "$INPUT/ops/bootstrap-host.sh"
grep -qx 'YUKILOG_MAIL_ENABLED=false' /etc/yukilog/yukilog.env \
    || fail "bootstrap 未默认关闭邮件"
systemctl is-active --quiet postgresql.service || fail "PostgreSQL 未启动"
systemctl is-active --quiet nginx.service || fail "nginx 未启动"

install_release() {
    local archive="$1"
    install -m 644 "$archive" "$archive.sha256" /var/www/yukilog/incoming/
    yukilog-deploy "/var/www/yukilog/incoming/$(basename "$archive")"
}

echo "== 验证首次发布失败不会留下 current =="
if install_release "$FIRST_FAIL"; then
    fail "故障 release 意外部署成功"
fi
[[ ! -e /var/www/yukilog/current ]] || fail "首次失败后仍存在 current"
systemctl is-active --quiet yukilog-server.service \
    && fail "首次失败后服务仍处于 active"

echo "== 首次部署真实 release =="
install_release "$SOURCE_ARCHIVE"
wait_ready
curl -fsS -H 'Host: blog.yeastar.xin' \
    http://127.0.0.1/health/ready >/dev/null
[[ "$(basename "$(readlink -f /var/www/yukilog/current)")" == "$SOURCE_VERSION" ]] \
    || fail "current 未指向源 release"

echo "== 创建演练管理员 =="
printf '%s\n%s\n' \
    'Rehearsal-Only-Password-2026!' \
    'Rehearsal-Only-Password-2026!' \
    | script -qec \
        "bash -c 'set -a; source /etc/yukilog/yukilog.env; set +a; exec /var/www/yukilog/current/bin/yukilog-admin create-admin rehearsal Rehearsal'" \
        /dev/null

echo "== 验证健康原子升级 =="
install_release "$HEALTHY"
wait_ready
[[ "$(basename "$(readlink -f /var/www/yukilog/current)")" == "$HEALTHY_VERSION" ]] \
    || fail "健康升级未切换 current"

echo "== 验证升级失败自动回滚 =="
if install_release "$ROLLBACK_FAIL"; then
    fail "故障升级意外成功"
fi
wait_ready
[[ "$(basename "$(readlink -f /var/www/yukilog/current)")" == "$HEALTHY_VERSION" ]] \
    || fail "故障升级未回滚到健康 release"

echo "== 验证数据库与媒体备份恢复 =="
set -a
# shellcheck disable=SC1091
source /etc/yukilog/yukilog.env
set +a
psql "$DATABASE_URL" --set=ON_ERROR_STOP=1 >/dev/null <<'SQL'
CREATE TABLE rehearsal_marker (id integer PRIMARY KEY, value text NOT NULL);
INSERT INTO rehearsal_marker VALUES (1, 'before-backup');
SQL
printf 'before-backup\n' >/var/lib/yukilog/media/assets/rehearsal-marker.txt
chown yukilog:yukilog /var/lib/yukilog/media/assets/rehearsal-marker.txt
yukilog-backup
readonly BACKUP_ID="$(basename "$(ls -1dt /var/backups/yukilog/* | sed -n '1p')")"
[[ "$BACKUP_ID" =~ ^[0-9]{8}T[0-9]{6}Z-[0-9]{9}$ ]] \
    || fail "备份 ID 格式无效：$BACKUP_ID"

psql "$DATABASE_URL" --set=ON_ERROR_STOP=1 \
    -c "UPDATE rehearsal_marker SET value = 'after-backup' WHERE id = 1" >/dev/null
printf 'after-backup\n' >/var/lib/yukilog/media/assets/rehearsal-marker.txt
yukilog-restore "$BACKUP_ID" --confirm-restore
wait_ready

readonly DB_VALUE="$(
    psql "$DATABASE_URL" -Atc 'SELECT value FROM rehearsal_marker WHERE id = 1'
)"
readonly MEDIA_VALUE="$(tr -d '\r\n' </var/lib/yukilog/media/assets/rehearsal-marker.txt)"
[[ "$DB_VALUE" == before-backup ]] || fail "数据库未恢复到备份值"
[[ "$MEDIA_VALUE" == before-backup ]] || fail "媒体未恢复到备份值"
readonly SAFE_BACKUP_ID="${BACKUP_ID//[^0-9A-Za-z]/_}"
runuser -u postgres -- psql -Atc \
    "SELECT 1 FROM pg_database WHERE datname = 'yukilog_before_$SAFE_BACKUP_ID'" \
    | grep -qx 1 || fail "恢复后未保留旧数据库"
[[ -d "/var/lib/yukilog/media-before-$BACKUP_ID" ]] \
    || fail "恢复后未保留旧媒体"

echo "== 验证邮件保持关闭 =="
grep -qx 'YUKILOG_MAIL_ENABLED=false' /etc/yukilog/yukilog.env \
    || fail "邮件开关发生变化"
systemctl is-active --quiet yukilog-mailer.service \
    && fail "邮件 worker 不应运行"

sha256sum "$SOURCE_ARCHIVE" >"$RESULTS/release.sha256"
cp -a "/var/backups/yukilog/$BACKUP_ID/MANIFEST.sha256" \
    "$RESULTS/backup-manifest.sha256"
cat >"$RESULTS/report.txt" <<EOF
result=passed
source_release=$SOURCE_VERSION
healthy_release=$HEALTHY_VERSION
rollback_target=$HEALTHY_VERSION
backup_id=$BACKUP_ID
database_restore=$DB_VALUE
media_restore=$MEDIA_VALUE
mail_enabled=false
EOF
echo "隔离演练全部通过"
