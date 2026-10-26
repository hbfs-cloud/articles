#!/usr/bin/env bash
# Wrapper : injecte le jeton read-only marketdata par fichier (jamais en argv), puis lance mcp-call.cjs.
set -euo pipefail
cd "$(dirname "$0")/../../../.."
# shellcheck source=tools/lib/mcp-auth.sh
source tools/lib/mcp-auth.sh
mcp_require_token marketdata
node scanner/20261026/_final/fortress-step0-scripts/mcp-call.cjs "$1"
