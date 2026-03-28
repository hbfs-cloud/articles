#!/usr/bin/env bash
# publish-with-media.sh
# Wrapper appelé par les crons après publication d'un article.
# 1. Envoie la notif Telegram
# 2. Lance la génération vidéo + audio en fond
# 3. Quand la vidéo est uploadée, envoie une 2e notif avec le lien YouTube
#
# Usage:
#   bash tools/publish-with-media.sh --type <type> --path <path> [--title "..."]
#
# Examples:
#   bash tools/publish-with-media.sh --type daily --path daily/20260328/index.html
#   bash tools/publish-with-media.sh --type weekly --path weekly/20260323/index.html
#   bash tools/publish-with-media.sh --type analysis --path analyses/EQNR/index.html

set -e
cd "$(dirname "$0")/.."

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

# ── Step 1: Send Telegram notification ────────────────────────────────────────
NOTIFY_ARGS="--type $TYPE"
if [ -n "$ARTICLE_PATH" ]; then NOTIFY_ARGS="$NOTIFY_ARGS --path $ARTICLE_PATH"; fi
if [ -n "$TITLE_ARG" ];    then NOTIFY_ARGS="$NOTIFY_ARGS --title \"$TITLE_ARG\""; fi

echo "📬 Sending Telegram notification..."
node tools/telegram-publish-notify.js $NOTIFY_ARGS && echo "✅ Telegram sent"

# ── Step 2: Generate media in background ─────────────────────────────────────
MEDIA_ARGS="--type $TYPE"
if [ -n "$ARTICLE_PATH" ]; then MEDIA_ARGS="$MEDIA_ARGS --path $ARTICLE_PATH"; fi
if [ -n "$TITLE_ARG" ];    then MEDIA_ARGS="$MEDIA_ARGS --title \"$TITLE_ARG\""; fi

echo "🎬 Starting media generation in background..."
LOG_FILE="/tmp/mw-media-$(date +%s).log"
node tools/generate-media.mjs $MEDIA_ARGS > "$LOG_FILE" 2>&1 &
MEDIA_PID=$!

echo "  Media PID: $MEDIA_PID | Log: $LOG_FILE"

# Wait for media (max 20 min)
WAITED=0
while kill -0 $MEDIA_PID 2>/dev/null && [ $WAITED -lt 1200 ]; do
  sleep 10
  WAITED=$((WAITED + 10))
  if [ $((WAITED % 60)) -eq 0 ]; then echo "  ⏳ ${WAITED}s elapsed..."; fi
done

if kill -0 $MEDIA_PID 2>/dev/null; then
  echo "⚠️ Media generation timed out after ${WAITED}s"
  kill $MEDIA_PID 2>/dev/null || true
  exit 0
fi

# ── Step 3: Send YouTube link notification if upload succeeded ─────────────────
# Find result.json from latest slug
RESULT=$(find /tmp/mw-media -name "result.json" -newer /tmp -maxdepth 2 2>/dev/null | sort -t/ -k4 | tail -1)
if [ -z "$RESULT" ]; then
  # Fallback: any result.json modified in last 30 min
  RESULT=$(find /tmp/mw-media -name "result.json" -mmin -30 2>/dev/null | tail -1)
fi

if [ -n "$RESULT" ]; then
  YOUTUBE_URL=$(node -e "const r=require('$RESULT'); if(r.youtubeUrl) console.log(r.youtubeUrl);" 2>/dev/null || true)
  AUDIO_PATH=$(node -e "const r=require('$RESULT'); if(r.audioPath) console.log(r.audioPath);" 2>/dev/null || true)

  if [ -n "$YOUTUBE_URL" ]; then
    echo "📺 YouTube video uploaded: $YOUTUBE_URL"
    # Send follow-up Telegram with video link
    node tools/telegram-publish-notify.js $NOTIFY_ARGS --youtube-url "$YOUTUBE_URL" 2>/dev/null || true
  fi
  
  # Log success
  echo "✅ Media complete: $(cat $RESULT)"
else
  echo "⚠️ No result.json found — check $LOG_FILE"
  tail -20 "$LOG_FILE" 2>/dev/null || true
fi
