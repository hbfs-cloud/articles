#!/bin/bash
set -u

# Load secrets from Infisical
if command -v infisical >/dev/null 2>&1 && [ -n "$INFISICAL_CLIENT_ID" ]; then
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

# Telegram topics (from Infisical or hardcoded fallback)
export TELEGRAM_TOPIC_PORTFOLIO="${TELEGRAM_TOPIC_PORTFOLIO:-72}"
export TELEGRAM_TOPIC_DYNAMIC="${TELEGRAM_TOPIC_DYNAMIC:-${TELEGRAM_TOPIC_GROWTH:-89}}"
export TELEGRAM_TOPIC_BALANCED="${TELEGRAM_TOPIC_BALANCED:-${TELEGRAM_TOPIC_CALMAR:-90}}"
export TELEGRAM_TOPIC_SECURED="${TELEGRAM_TOPIC_SECURED:-${TELEGRAM_TOPIC_CONSERVATIVE:-91}}"

export HOME=/home/ci
cd /home/ci/projects/articles

echo "=== $(date) — Signal Monitor starting ==="
echo "Node: $(node --version)"
echo "Tickers will be loaded from scanner/status/history/"
echo "Telegram topics: portfolio=$TELEGRAM_TOPIC_PORTFOLIO dynamic=$TELEGRAM_TOPIC_DYNAMIC balanced=$TELEGRAM_TOPIC_BALANCED secured=$TELEGRAM_TOPIC_SECURED"

# Run in WebSocket continuous mode
exec node tools/signal-monitor.js --loop 2>&1
