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
  export ANTHROPIC_API_KEY
fi

TYPE=""
ARTICLE_PATH=""
TITLE_ARG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --type)  TYPE="$2"; shift 2;;
    --path)  ARTICLE_PATH="$2"; shift 2;;
    --title) TITLE_ARG="$2"; shift 2;;
    *)       shift;;
  esac
done

if [ -z "$TYPE" ]; then echo "❌ --type required"; exit 1; fi

echo "📣 [publish-with-media] type=$TYPE path=$ARTICLE_PATH"

MEDIA_ARGS="--type $TYPE"
if [ -n "$ARTICLE_PATH" ]; then MEDIA_ARGS="$MEDIA_ARGS --path $ARTICLE_PATH"; fi
if [ -n "$TITLE_ARG" ];    then MEDIA_ARGS="$MEDIA_ARGS --title \"$TITLE_ARG\""; fi

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

  # Fallback: send text-only Telegram notification so the article is always announced
  if [ -n "$ARTICLE_PATH" ]; then
    echo "📡 Sending fallback text notification via telegram-publish-notify.js..."
    node tools/telegram-publish-notify.js --type "$TYPE" --path "$ARTICLE_PATH" \
      && echo "  ✅ Fallback text notification sent" \
      || echo "  ❌ Fallback text notification failed"
  fi
  exit 0
fi

# Check result
RESULT=$(find /tmp/mw-media -name "result.json" -mmin -30 2>/dev/null | tail -1)
if [ -n "$RESULT" ]; then
  echo "✅ Media complete: $(cat $RESULT)"
else
  echo "⚠️ No result.json — check $LOG_FILE"
  tail -20 "$LOG_FILE" 2>/dev/null || true
  # Fallback: send text-only notification if media failed but article exists
  if [ -n "$ARTICLE_PATH" ]; then
    echo "📡 Sending fallback text notification (media failed)..."
    node tools/telegram-publish-notify.js --type "$TYPE" --path "$ARTICLE_PATH" \
      && echo "  ✅ Fallback text notification sent" \
      || echo "  ❌ Fallback text notification failed"
  fi
fi
