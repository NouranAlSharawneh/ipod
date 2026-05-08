#!/usr/bin/env bash
# Build the Express bridge as a self-contained native binary using Bun,
# named with the Rust target triple Tauri expects for sidecars.
set -euo pipefail

cd "$(dirname "$0")/.."

TRIPLE="$(rustc -vV | sed -n 's/host: //p')"
case "$TRIPLE" in
  aarch64-apple-darwin) BUN_TARGET="bun-darwin-arm64" ;;
  x86_64-apple-darwin)  BUN_TARGET="bun-darwin-x64"  ;;
  *) echo "unsupported triple: $TRIPLE" >&2; exit 1 ;;
esac

OUT="src-tauri/binaries/ipod-bridge-${TRIPLE}"
mkdir -p "$(dirname "$OUT")"

echo "[build-bridge] compiling server/index.ts -> $OUT (target=$BUN_TARGET)"
bun build server/index.ts \
  --compile \
  --target "$BUN_TARGET" \
  --outfile "$OUT"

chmod +x "$OUT"
echo "[build-bridge] done"
