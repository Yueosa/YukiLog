#!/usr/bin/env bash

set -Eeuo pipefail
umask 022

readonly OPS_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly ROOT="$(cd -- "$OPS_DIR/.." && pwd)"
readonly VERSION="${1:-}"
readonly OUTPUT_DIR="${2:-$ROOT/.release-build/output}"
readonly BUILD_ROOT="${YUKILOG_BUILD_ROOT:-$ROOT/.release-build}"
readonly STAGE="$BUILD_ROOT/stage"
readonly CARGO_HOME_DIR="${CARGO_HOME:-$ROOT/.cargo-home}"
readonly TARGET_DIR="${CARGO_TARGET_DIR:-$BUILD_ROOT/target}"
readonly TMP_DIR="${TMPDIR:-$BUILD_ROOT/tmp}"

if [[ ! "$VERSION" =~ ^[0-9]{8}T[0-9]{6}Z-[a-f0-9]{7,40}$ ]]; then
    printf '用法：%s <YYYYMMDDTHHMMSSZ-gitsha> [输出目录]\n' "$0" >&2
    exit 2
fi

command -v cargo >/dev/null || { echo "缺少 cargo" >&2; exit 1; }
command -v pnpm >/dev/null || { echo "缺少 pnpm" >&2; exit 1; }
command -v sha256sum >/dev/null || { echo "缺少 sha256sum" >&2; exit 1; }

rm -rf -- "$STAGE"
mkdir -p -- "$STAGE/bin" "$STAGE/admin" "$OUTPUT_DIR" "$TMP_DIR"

(
    cd -- "$ROOT"
    CARGO_HOME="$CARGO_HOME_DIR" \
    CARGO_TARGET_DIR="$TARGET_DIR" \
    TMPDIR="$TMP_DIR" \
    CARGO_BUILD_JOBS="${CARGO_BUILD_JOBS:-2}" \
    CARGO_INCREMENTAL=0 \
        cargo build --release --locked \
        -p yukilog-server -p yukilog-migration --bins
    pnpm install --frozen-lockfile
    pnpm --filter @yukilog/web build
)

install -m 755 "$TARGET_DIR/release/yukilog-server" "$STAGE/bin/"
install -m 755 "$TARGET_DIR/release/yukilog-admin" "$STAGE/bin/"
install -m 755 "$TARGET_DIR/release/yukilog-mailer" "$STAGE/bin/"
install -m 755 "$TARGET_DIR/release/yukilog-migration" "$STAGE/bin/"
cp -a -- "$ROOT/web/dist/." "$STAGE/admin/"
printf '%s\n' "$VERSION" > "$STAGE/RELEASE"

(
    cd -- "$STAGE"
    find bin admin -type f -print0 \
        | LC_ALL=C sort -z \
        | xargs -0 sha256sum > MANIFEST.sha256
    sha256sum RELEASE >> MANIFEST.sha256
)

readonly ARCHIVE="$OUTPUT_DIR/yukilog-$VERSION.tar.gz"
tar -C "$STAGE" -czf "$ARCHIVE" .
(
    cd "$OUTPUT_DIR"
    sha256sum "$(basename "$ARCHIVE")" > "$(basename "$ARCHIVE").sha256"
)
printf 'Release: %s\nSHA-256: %s\n' \
    "$ARCHIVE" "$(cut -d' ' -f1 "$ARCHIVE.sha256")"
