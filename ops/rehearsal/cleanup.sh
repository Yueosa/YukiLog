#!/usr/bin/env bash

set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
readonly STATE="$ROOT/.rehearsal"

if [[ $EUID -ne 0 ]]; then
    exec sudo -- "$0" "$@"
fi
[[ "$(realpath -m "$STATE")" == "$ROOT/.rehearsal" ]] \
    || { echo "清理目录越出仓库，已拒绝" >&2; exit 1; }

while read -r machine _; do
    [[ "$machine" == yukilog-rehearsal-* ]] || continue
    machinectl terminate "$machine" >/dev/null 2>&1 || true
done < <(machinectl list --no-legend --no-pager 2>/dev/null || true)

if mountpoint -q "$STATE"; then
    echo "$STATE 是挂载点，拒绝递归删除" >&2
    exit 1
fi
rm -rf --one-file-system -- "$STATE"
printf '演练缓存、实例和结果已删除：%s\n' "$STATE"
