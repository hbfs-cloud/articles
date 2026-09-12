#!/usr/bin/env bash
# Canonical scanner: marketdata discovery, tracking and rotation. DTX is excluded
# by the versioned product policy; its standalone tools and history remain intact.
set -euo pipefail
cd "$(dirname "$0")/.."
DATE="${1:?usage: scan-parallel.sh <DATE> <REFDATE> <ASOF>}"; REF="${2:?}"; ASOF="${3:?}"
node tools/lib/scanner-scope.js --initialize "$DATE" "$REF"
exec bash tools/scan-marketdata-only.sh "$DATE" "$REF" "$ASOF"
