#!/usr/bin/env bash

set -Eeuo pipefail
umask 022

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
readonly STATE="$ROOT/.rehearsal"
readonly RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$"
readonly RUN="$STATE/runs/$RUN_ID"
readonly ROOTFS="$RUN/rootfs"
readonly MACHINE="yukilog-rehearsal-${RUN_ID,,}"
readonly HOST_LOG="$RUN/nspawn.log"

[[ $EUID -eq 0 ]] || {
    echo "请运行：sudo $0" >&2
    exit 1
}
[[ -n "${SUDO_UID:-}" && "$SUDO_UID" != 0 ]] \
    || { echo "请从普通用户通过 sudo 启动，拒绝直接使用 root 会话" >&2; exit 1; }
[[ -f "$ROOT/Cargo.toml" && -x "$ROOT/ops/yukilog-deploy" ]] \
    || { echo "仓库结构不完整：$ROOT" >&2; exit 1; }
[[ "$(realpath -m "$STATE")" == "$ROOT/.rehearsal" ]] \
    || { echo "演练目录越出仓库" >&2; exit 1; }

for command in systemd-nspawn systemd-run machinectl curl sha256sum tar; do
    command -v "$command" >/dev/null \
        || { echo "宿主机缺少命令：$command" >&2; exit 1; }
done

mapfile -t archives < <(
    printf '%s\n' "$ROOT"/.release-build/output/yukilog-*.tar.gz \
        | while IFS= read -r archive; do [[ -f "$archive" ]] && printf '%s\n' "$archive"; done
)
((${#archives[@]} == 1)) || {
    echo "需要且只能存在一个待演练 release；当前找到 ${#archives[@]} 个" >&2
    exit 1
}
readonly ARCHIVE="${archives[0]}"
[[ -f "$ARCHIVE.sha256" ]] || { echo "缺少 $ARCHIVE.sha256" >&2; exit 1; }
(
    cd "$(dirname "$ARCHIVE")"
    sha256sum -c "$(basename "$ARCHIVE").sha256"
)

capture_host_invariants() {
    if command -v pacman >/dev/null; then
        pacman -Qq | LC_ALL=C sort | sha256sum
    else
        printf 'package-manager=unknown\n'
    fi
    for path in /etc/yukilog /var/www/yukilog /var/lib/yukilog /var/backups/yukilog; do
        if [[ -e "$path" ]]; then
            printf '%s=present\n' "$path"
        else
            printf '%s=absent\n' "$path"
        fi
    done
}

mkdir -p -m 755 "$RUN"
capture_host_invariants >"$RUN/host-before.txt"
"$SCRIPT_DIR/prepare.sh" "$ROOT" "$STATE"

cp -a --reflink=auto "$STATE/base" "$ROOTFS"
install -d -m 700 "$ROOTFS/root/rehearsal-input"
# The rehearsal intentionally has no external network. Mask only the copied
# image's wait-online unit so nginx does not wait two minutes for connectivity.
ln -sfn /dev/null \
    "$ROOTFS/etc/systemd/system/systemd-networkd-wait-online.service"
cp -a "$ROOT/ops" "$ROOTFS/root/rehearsal-input/"
install -m 644 "$ARCHIVE" "$ARCHIVE.sha256" "$ROOTFS/root/rehearsal-input/"
install -m 755 "$SCRIPT_DIR/inside.sh" "$ROOTFS/root/rehearsal-input/inside.sh"
# 可选：存在内容迁移包时带入容器，inside.sh 会验证灌库与幂等性
if [[ -f "$ROOT/.build-tmp/migration-pack/yukilog-content-migration.sql" ]]; then
    install -m 644 "$ROOT/.build-tmp/migration-pack/yukilog-content-migration.sql" \
        "$ROOTFS/root/rehearsal-input/content-migration.sql"
fi

container_pid=""
cleanup_machine() {
    machinectl terminate "$MACHINE" >/dev/null 2>&1 || true
    if [[ -n "$container_pid" ]]; then
        wait "$container_pid" 2>/dev/null || true
    fi
}
trap cleanup_machine EXIT

systemd-nspawn --boot --quiet \
    --directory="$ROOTFS" \
    --machine="$MACHINE" \
    --private-network \
    >"$HOST_LOG" 2>&1 &
container_pid=$!

ready=false
for _ in {1..60}; do
    if ! kill -0 "$container_pid" 2>/dev/null; then
        echo "演练容器提前退出" >&2
        cat "$HOST_LOG" >&2
        exit 1
    fi
    if systemd-run --quiet --wait --pipe --machine="$MACHINE" \
        /bin/true >/dev/null 2>&1; then
        ready=true
        break
    fi
    sleep 1
done
[[ "$ready" == true ]] || { echo "演练容器未能在 60 秒内启动" >&2; exit 1; }

set +e
systemd-run --wait --pipe --collect --machine="$MACHINE" \
    --unit=yukilog-rehearsal \
    /root/rehearsal-input/inside.sh
readonly RESULT=$?
set -e

install -d -m 755 "$RUN/results"
if [[ -d "$ROOTFS/root/rehearsal-results" ]]; then
    cp -a "$ROOTFS/root/rehearsal-results/." "$RUN/results/"
fi
cp -a "$HOST_LOG" "$RUN/results/nspawn.log"

cleanup_machine
trap - EXIT
container_pid=""

capture_host_invariants >"$RUN/results/host-after.txt"
cp -a "$RUN/host-before.txt" "$RUN/results/host-before.txt"
invariants_ok=true
if ! diff -u "$RUN/results/host-before.txt" "$RUN/results/host-after.txt" \
    >"$RUN/results/host-invariants.diff"; then
    invariants_ok=false
fi
chown -R "$SUDO_UID:${SUDO_GID:-$SUDO_UID}" "$RUN/results"
if [[ "$invariants_ok" != true ]]; then
    echo "宿主机不变量发生变化，详见 host-invariants.diff" >&2
    exit 1
fi

if ((RESULT != 0)); then
    echo "隔离演练失败；结果保存在 $RUN/results" >&2
    exit "$RESULT"
fi
printf '隔离演练通过；结果保存在 %s\n' "$RUN/results"
