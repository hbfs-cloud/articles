#!/bin/bash
export HOME=/home/ci

# Load Telegram topics from .profile first (base defaults)
eval "$(grep '^export TELEGRAM_' /home/ci/.profile 2>/dev/null)" 2>/dev/null || true

# Load .env second (overrides .profile — TELEGRAM_BOT_TOKEN, CHAT_ID, updated topics)
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
export TELEGRAM_TOPIC_PORTFOLIO="${TELEGRAM_TOPIC_PORTFOLIO:-0}"
export TELEGRAM_TOPIC_TURBO="${TELEGRAM_TOPIC_TURBO:-366}"
export TELEGRAM_TOPIC_DYNAMIC="${TELEGRAM_TOPIC_DYNAMIC:-291}"
export TELEGRAM_TOPIC_BALANCED="${TELEGRAM_TOPIC_BALANCED:-90}"
export TELEGRAM_TOPIC_SECURED="${TELEGRAM_TOPIC_SECURED:-293}"
export TELEGRAM_TOPIC_FORTRESS="${TELEGRAM_TOPIC_FORTRESS:-367}"

# Discord webhooks (global + per mode)
export DISCORD_WEBHOOK_SIGNALS="${DISCORD_WEBHOOK_SIGNALS:-https://discord.com/api/webhooks/1492919246878146621/4GuOPJM1d1a4DYKjZ1ZfzUHsW5taHyBlNrgS7EzbMVh8D66EMdxWl1830TFxun-DwO06}"
export DISCORD_WEBHOOK_SIGNALS_TURBO="${DISCORD_WEBHOOK_SIGNALS_TURBO:-https://discord.com/api/webhooks/1492913789039808695/zhEF3FrXQE0sKpwsuqO5NzM_nLrOzD3M_z9swcczXw7U4DdTd2jrLe58xHOmiz9VpVId}"
export DISCORD_WEBHOOK_SIGNALS_DYNAMIC="${DISCORD_WEBHOOK_SIGNALS_DYNAMIC:-https://discord.com/api/webhooks/1492913791380361247/KAoOHELHQF8EMTgllHwNVs7UhjnfKH2CIONGCt9vyZxgBpt6uKJknoKmkdPkxkcluGW0}"
export DISCORD_WEBHOOK_SIGNALS_BALANCED="${DISCORD_WEBHOOK_SIGNALS_BALANCED:-https://discord.com/api/webhooks/1492913793074729021/5XdYN65XfoKuslRDtar2G6AWpRS-wvQz_bHwa8SkUPDxfQ849K2YKca4KNsV1vmbox5n}"
export DISCORD_WEBHOOK_SIGNALS_SECURED="${DISCORD_WEBHOOK_SIGNALS_SECURED:-https://discord.com/api/webhooks/1492913794760966346/KjtqRx2OuYFdrJdxWFBQrpsmZEXJN9sZcIFJBrd8OIua30M6u0sqj0PA7s2FjKSF9-lU}"
export DISCORD_WEBHOOK_SIGNALS_FORTRESS="${DISCORD_WEBHOOK_SIGNALS_FORTRESS:-https://discord.com/api/webhooks/1492913796367388814/KxNOXYmaVm58u8MIAoFm97BaHTCnaPEESBYzZKLDgntDGNH4QAGpQrMyCldve3fW6BFd}"

cd /home/ci/projects/articles

echo "=== $(date) — Signal Monitor starting ==="
echo "Node: $(node --version)"
echo "Tickers will be loaded from scanner/status/history/"
echo "Telegram: BOT=${TELEGRAM_BOT_TOKEN:+SET} CHAT=${TELEGRAM_CHAT_ID:+SET}"
echo "Telegram topics: portfolio=$TELEGRAM_TOPIC_PORTFOLIO turbo=$TELEGRAM_TOPIC_TURBO dynamic=$TELEGRAM_TOPIC_DYNAMIC balanced=$TELEGRAM_TOPIC_BALANCED secured=$TELEGRAM_TOPIC_SECURED fortress=$TELEGRAM_TOPIC_FORTRESS"
echo "Discord webhooks: global=${DISCORD_WEBHOOK_SIGNALS:+SET} turbo=${DISCORD_WEBHOOK_SIGNALS_TURBO:+SET} dynamic=${DISCORD_WEBHOOK_SIGNALS_DYNAMIC:+SET} balanced=${DISCORD_WEBHOOK_SIGNALS_BALANCED:+SET} secured=${DISCORD_WEBHOOK_SIGNALS_SECURED:+SET} fortress=${DISCORD_WEBHOOK_SIGNALS_FORTRESS:+SET}"

# Run in WebSocket continuous mode
exec node tools/signal-monitor.js --loop 2>&1
