#!/usr/bin/env bash

set -Eeuo pipefail
umask 022

readonly ROOT="${1:?repository root is required}"
readonly STATE="${2:?rehearsal state directory is required}"
readonly CACHE="$STATE/cache"
readonly BASE="$STATE/base"
readonly IMAGE="ubuntu-24.04-minimal-cloudimg-amd64-root.tar.xz"
readonly RELEASE_BASE="https://cloud-images.ubuntu.com/minimal/releases/noble/release"

[[ $EUID -eq 0 ]] || { echo "prepare.sh 必须以 root 运行" >&2; exit 1; }
[[ "$(realpath -m "$STATE")" == "$(realpath "$ROOT")/.rehearsal" ]] \
    || { echo "拒绝在仓库外准备演练环境" >&2; exit 1; }

for command in curl sha256sum tar systemd-nspawn; do
    command -v "$command" >/dev/null \
        || { echo "宿主机缺少命令：$command" >&2; exit 1; }
done

mkdir -p -m 755 "$CACHE"
curl -fsSL "$RELEASE_BASE/SHA256SUMS" -o "$CACHE/SHA256SUMS"
readonly EXPECTED="$(
    awk -v image="$IMAGE" '$2 == "*" image { print $1; exit }' \
        "$CACHE/SHA256SUMS"
)"
[[ "$EXPECTED" =~ ^[a-f0-9]{64}$ ]] \
    || { echo "Ubuntu 校验清单中缺少 $IMAGE" >&2; exit 1; }

if [[ -f "$CACHE/$IMAGE" ]] \
    && ! printf '%s *%s\n' "$EXPECTED" "$CACHE/$IMAGE" | sha256sum -c - >/dev/null; then
    rm -f -- "$CACHE/$IMAGE"
fi
if [[ ! -f "$CACHE/$IMAGE" ]]; then
    curl -fL "$RELEASE_BASE/$IMAGE" -o "$CACHE/$IMAGE"
fi
printf '%s *%s\n' "$EXPECTED" "$CACHE/$IMAGE" | sha256sum -c -
printf '%s\n' "$EXPECTED" > "$CACHE/rootfs.sha256"

if [[ -f "$BASE/.yukilog-rehearsal-base" ]] \
    && [[ "$(< "$BASE/.yukilog-rehearsal-base")" == "$EXPECTED" ]]; then
    printf '复用已校验的 Ubuntu 基础镜像：%s\n' "$EXPECTED"
    exit 0
fi

readonly NEW_BASE="$STATE/.base-new-$$"
rm -rf -- "$NEW_BASE"
mkdir -p -m 755 "$NEW_BASE"
trap 'rm -rf -- "$NEW_BASE"' EXIT
tar -xJpf "$CACHE/$IMAGE" -C "$NEW_BASE"

cat > "$NEW_BASE/usr/sbin/policy-rc.d" <<'EOF'
#!/bin/sh
exit 101
EOF
chmod 755 "$NEW_BASE/usr/sbin/policy-rc.d"

systemd-nspawn --quiet --directory="$NEW_BASE" \
    --resolv-conf=replace-host \
    --setenv=DEBIAN_FRONTEND=noninteractive \
    /bin/bash -Eeuo pipefail -c '
        apt-get update
        apt-get install -y --no-install-recommends \
            nginx certbot postgresql postgresql-client \
            curl ca-certificates openssl xz-utils util-linux
        apt-get clean
        rm -rf /var/lib/apt/lists/*
    '
rm -f -- "$NEW_BASE/usr/sbin/policy-rc.d"
rm -f -- "$NEW_BASE/etc/machine-id"
: > "$NEW_BASE/etc/machine-id"
printf '%s\n' "$EXPECTED" > "$NEW_BASE/.yukilog-rehearsal-base"

rm -rf -- "$BASE"
mv -- "$NEW_BASE" "$BASE"
trap - EXIT
printf 'Ubuntu 演练基础镜像已准备：%s\n' "$EXPECTED"
