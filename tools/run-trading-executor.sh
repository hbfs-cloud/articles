#!/bin/bash
# run-trading-executor.sh — Nomad raw_exec launcher for trading executor daemon.
# Spawns daemon.js for all 6 modes as background processes, waits on all.
#
# Usage (standalone): BROKER=paper ./tools/run-trading-executor.sh
# Usage (single):     MODE=balanced BROKER=paper ./tools/run-trading-executor.sh
# Usage (Nomad):      raw_exec { command = "/home/ci/projects/articles/tools/run-trading-executor.sh" }

export HOME=/home/ci

# Load Telegram topics from .profile first (base defaults)
eval "$(grep '^export TELEGRAM_' /home/ci/.profile 2>/dev/null)" 2>/dev/null || true

# Load .env second (overrides .profile)
if [ -f /home/ci/projects/articles/.env ]; then
  set -a
  . /home/ci/projects/articles/.env
  set +a
fi

# Load secrets from Infisical
if command -v infisical >/dev/null 2>&1 && [ -n "${INFISICAL_CLIENT_ID:-}" ]; then
  export INFISICAL_TOKEN=$(infisical login --method=universal-auth \
    --client-id="$INFISICAL_CLIENT_ID" \
    --client-secret="$INFISICAL_CLIENT_SECRET" \
    --domain="$INFISICAL_API_URL" \
    --silent --plain)
  eval "$(infisical export \
    --projectId="$INFISICAL_PROJECT_ID" \
    --env=prod --path=/ \
    --domain="$INFISICAL_API_URL" \
    --format=dotenv --silent 2>/dev/null | sed 's/^/export /')" 2>/dev/null || true
fi

# Telegram topics (hardcoded fallback)
export TELEGRAM_TOPIC_TURBO="${TELEGRAM_TOPIC_TURBO:-366}"
export TELEGRAM_TOPIC_DYNAMIC="${TELEGRAM_TOPIC_DYNAMIC:-291}"
export TELEGRAM_TOPIC_BALANCED="${TELEGRAM_TOPIC_BALANCED:-90}"
export TELEGRAM_TOPIC_SECURED="${TELEGRAM_TOPIC_SECURED:-293}"
export TELEGRAM_TOPIC_FORTRESS="${TELEGRAM_TOPIC_FORTRESS:-367}"
export TELEGRAM_TOPIC_TKL="${TELEGRAM_TOPIC_TKL:-1064}"

# Defaults
export BROKER="${BROKER:-paper}"
export CAPITAL_USD="${CAPITAL_USD:-10000}"
export VERBOSE="${VERBOSE:-false}"
export LOG_DIR="${LOG_DIR:-/home/ci/projects/articles/data/execution-logs}"

cd /home/ci/projects/articles

MODES="${MODE:-turbo dynamic balanced secured fortress tkl}"

echo "=== $(date) — Trading Executor starting ==="
echo "Node: $(node --version)"
echo "Broker: $BROKER | Capital: \$$CAPITAL_USD | Modes: $MODES"
echo "Telegram: BOT=${TELEGRAM_BOT_TOKEN:+SET} CHAT=${TELEGRAM_CHAT_ID:+SET}"

PIDS=""
for m in $MODES; do
  MODE=$m node tools/trading-executor/daemon.js 2>&1 &
  PIDS="$PIDS $!"
  echo "  → $m (PID $!)"
done

trap 'kill $PIDS 2>/dev/null; wait' SIGTERM SIGINT

wait $PIDS
