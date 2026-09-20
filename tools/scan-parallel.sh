#!/usr/bin/env bash
# Canonical scanner: marketdata discovery, DTX engine information, tracking and rotation.
# The dated product policy can retain an explicit historical DTX waiver.
set -euo pipefail
cd "$(dirname "$0")/.."
DATE="${1:?usage: scan-parallel.sh <DATE> <REFDATE> <ASOF>}"; REF="${2:?}"; ASOF="${3:?}"
node tools/lib/scanner-scope.js --initialize "$DATE" "$REF"
exec bash tools/scan-marketdata-only.sh "$DATE" "$REF" "$ASOF"
