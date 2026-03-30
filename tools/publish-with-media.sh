#!/usr/bin/env bash
# publish-with-media.sh
# Called by crons after article publication.
#
# Sends ONE unified Telegram notification:
#   → generate-media.mjs handles everything:
#      1. Generate audio (Qwen3-TTS via Mac Mini)
#      2. Generate Gamma-style video slides
#      3. Upload to YouTube
#      4. Send single Telegram message: sendAudio with caption = AI summary + YouTube + article link
#
# NO separate telegram-publish-notify.js call — that would create a duplicate text message.
#
# Usage:
#   bash tools/publish-with-media.sh --type <daily|weekly|scanner|analysis|series|learning>
#                                    --path <relative/path/to/article>
#                                    [--title "Override title"]
#                                    [--force]   ← bypass dedup lock (use carefully)
#
# Examples:
#   bash tools/publish-with-media.sh --type daily --path daily/20260328/index.html
#   bash tools/publish-with-media.sh --type weekly --path weekly/20260323/index.html
#   bash tools/publish-with-media.sh --type analysis --path analyses/EQNR/index.html

set -e
cd "$(dirname "$0")/.."

# Ensure ANTHROPIC_API_KEY is available (loaded from ~/.profile in cron)
if [ -z "$ANTHROPIC_API_KEY" ]; then
  source ~/.profile 2>/dev/null || true
  source ~/.bashrc 2>/dev/null || true
  source ~/.bash_profile 2>/dev/null || true
  if [ -z "$ANTHROPIC_API_KEY" ]; then
    export ANTHROPIC_API_KEY=$(grep -m1 'ANTHROPIC_API_KEY' ~/.profile 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")
  fi
fi

if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "⚠️ ANTHROPIC_API_KEY not found — AI slides will use fallback (limited quality)"
else
  echo "  ✅ ANTHROPIC_API_KEY loaded (${#ANTHROPIC_API_KEY} chars)"
fi
export ANTHROPIC_API_KEY

TYPE=""
ARTICLE_PATH=""
TITLE_ARG=""
FORCE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --type)  TYPE="$2"; shift 2;;
    --path)  ARTICLE_PATH="$2"; shift 2;;
    --title) TITLE_ARG="$2"; shift 2;;
    --force) FORCE=1; shift;;
    *)       shift;;
  esac
done

if [ -z "$TYPE" ]; then echo "❌ --type required"; exit 1; fi
if [ -z "$ARTICLE_PATH" ]; then echo "❌ --path required"; exit 1; fi

# ── Dedup lock — one notification per article per day ──
# Extract date from path (e.g. daily/20260330/index.html → 20260330)
ARTICLE_DATE=$(echo "$ARTICLE_PATH" | grep -oE '[0-9]{8}' | head -1)
if [ -z "$ARTICLE_DATE" ]; then ARTICLE_DATE=$(date +%Y%m%d); fi

LOCK_FILE="/tmp/mw-publish-lock-${TYPE}-${ARTICLE_DATE}"

if [ -f "$LOCK_FILE" ] && [ "$FORCE" -eq 0 ]; then
  LOCK_AGE=$(( $(date +%s) - $(stat -c %Y "$LOCK_FILE" 2>/dev/null || echo 0) ))
  if [ "$LOCK_AGE" -lt 21600 ]; then  # 6h
    LOCK_MIN=$(( LOCK_AGE / 60 ))
    echo "⚠️  DEDUP: notification already sent for ${TYPE}/${ARTICLE_DATE} (${LOCK_MIN}min ago)."
    echo "   Use --force to bypass. Lock file: $LOCK_FILE"
    echo "   This prevents duplicate Telegram notifications and YouTube uploads."
    exit 0
  fi
fi

# Acquire lock immediately
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) PID=$$" > "$LOCK_FILE"
echo "🔒 Lock acquired: $LOCK_FILE"

echo "📣 [publish-with-media] type=$TYPE path=$ARTICLE_PATH"

MEDIA_ARGS="--type $TYPE --path $ARTICLE_PATH"
if [ -n "$TITLE_ARG" ]; then MEDIA_ARGS="$MEDIA_ARGS --title \"$TITLE_ARG\""; fi

echo "🎬 Starting media generation (audio + video + Telegram)..."
LOG_FILE="/tmp/mw-media-$(date +%s).log"
node tools/generate-media.mjs $MEDIA_ARGS > "$LOG_FILE" 2>&1 &
MEDIA_PID=$!

echo "  PID: $MEDIA_PID | Log: $LOG_FILE"

# Wait up to 20 min
WAITED=0
while kill -0 $MEDIA_PID 2>/dev/null && [ $WAITED -lt 1200 ]; do
  sleep 10
  WAITED=$((WAITED + 10))
  if [ $((WAITED % 60)) -eq 0 ]; then echo "  ⏳ ${WAITED}s elapsed..."; fi
done

if kill -0 $MEDIA_PID 2>/dev/null; then
  echo "⚠️ Media generation timed out after ${WAITED}s — killing and sending text fallback"
  kill $MEDIA_PID 2>/dev/null || true
  echo "📡 Sending fallback text notification via telegram-publish-notify.js..."
  node tools/telegram-publish-notify.js --type "$TYPE" --path "$ARTICLE_PATH" \
    && echo "  ✅ Fallback text notification sent" \
    || echo "  ❌ Fallback text notification failed"
  exit 0
fi

# Check result
RESULT=$(find /tmp/mw-media -name "result.json" -mmin -30 2>/dev/null | tail -1)
if [ -n "$RESULT" ]; then
  echo "✅ Media complete: $(cat $RESULT)"
else
  echo "⚠️ No result.json — check $LOG_FILE"
  tail -20 "$LOG_FILE" 2>/dev/null || true
  echo "📡 Sending fallback text notification (media failed)..."
  node tools/telegram-publish-notify.js --type "$TYPE" --path "$ARTICLE_PATH" \
    && echo "  ✅ Fallback text notification sent" \
    || echo "  ❌ Fallback text notification failed"
fi
