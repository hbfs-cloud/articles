#!/bin/bash
# render-chain.sh — Automated render pipeline using local + remote split
#
# Monitors active renders, concatenates, uploads, then chains next video.
# Usage: bash scripts/render-chain.sh [--skip-upload]

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REMOTE="ci@ser.tail5d09f.ts.net"
SSH_KEY="$HOME/.ssh/id_ed25519_ci"
SSH="ssh -i $SSH_KEY $REMOTE"
SCP="scp -i $SSH_KEY"
RSYNC="rsync -az -e 'ssh -i $SSH_KEY'"
SKIP_UPLOAD="${1:-}"

TRADING_SERIES=(
  debuter-trading
  ai-singularity-fr
  ai-singularity-en
  swing-trading
  maitrise-expert
  algo-million
  bourses-mena
)

CONTENT_GENERATORS=(
  generate-edu-content.mjs
  generate-edu-content.mjs
  generate-edu-content.mjs
  generate-edu-content.mjs
  generate-edu-content.mjs
  generate-edu-content.mjs
  generate-edu-content.mjs
)

log() { echo "[$(date +%H:%M:%S)] $*"; }

# ── Wait for both render halves to complete ──────────────────────────────
wait_for_renders() {
  local series_id="$1"
  log "Waiting for renders to complete for $series_id..."

  # Wait for remote render
  while true; do
    local remote_done=$($SSH "test -f ~/videos/output/${series_id}-part1.mp4 && ! pgrep -f 'remotion render' > /dev/null 2>&1 && echo yes || echo no" 2>/dev/null)
    local local_done="no"
    if [ -f "output/${series_id}-part2.mp4" ] && ! pgrep -f "remotion render" > /dev/null 2>&1; then
      local_done="yes"
    fi

    # Show progress
    local remote_progress=$($SSH "tail -1 /tmp/remotion-render.log 2>/dev/null" 2>/dev/null || echo "unknown")
    local local_progress=$(tail -1 /tmp/remotion-render-local.log 2>/dev/null || echo "unknown")
    log "Remote: $remote_progress"
    log "Local:  $local_progress"

    if [ "$remote_done" = "yes" ] && [ "$local_done" = "yes" ]; then
      log "Both renders complete!"
      break
    fi

    sleep 120
  done
}

# ── Concatenate two halves ───────────────────────────────────────────────
concat_parts() {
  local series_id="$1"
  log "Downloading part1 from remote..."
  $SCP "$REMOTE:~/videos/output/${series_id}-part1.mp4" "output/${series_id}-part1.mp4"

  log "Concatenating parts..."
  echo "file 'output/${series_id}-part1.mp4'" > /tmp/concat-list.txt
  echo "file 'output/${series_id}-part2.mp4'" >> /tmp/concat-list.txt
  ffmpeg -y -f concat -safe 0 -i /tmp/concat-list.txt -c copy "output/${series_id}.mp4"

  local size=$(du -h "output/${series_id}.mp4" | cut -f1)
  log "Final video: $size"

  # Cleanup parts
  rm -f "output/${series_id}-part1.mp4" "output/${series_id}-part2.mp4"
  $SSH "rm -f ~/videos/output/${series_id}-part1.mp4" 2>/dev/null || true
}

# ── Generate content + TTS for a series ──────────────────────────────────
generate_content() {
  local series_id="$1"
  local generator="$2"
  log "Generating content for $series_id..."
  node "scripts/$generator" "$series_id"

  log "Generating TTS audio..."
  node scripts/generate-edu-tts.mjs --batch-size 5
}

# ── Split render between local + remote ──────────────────────────────────
launch_split_render() {
  local series_id="$1"

  # Get total frames
  local total_frames=$(node -e "
    const d = require('./public/edu-data.json');
    const fps = 15;
    let total = 0;
    for (const s of d.slides) {
      const k = s.audioFile?.replace('.wav','');
      const dur = d.audioDurations[k] || 12;
      total += Math.ceil(dur * fps) + 12;
    }
    console.log(total);
  ")
  local half=$((total_frames / 2))
  local last=$((total_frames - 1))

  log "Total frames: $total_frames — splitting at $half"

  # Sync updated project to remote
  log "Syncing project to remote..."
  rsync -az --exclude 'node_modules' --exclude 'output' --exclude '.git' --exclude '*.mp4' \
    -e "ssh -i $SSH_KEY" \
    "$ROOT/" "$REMOTE:~/videos/"

  # Launch remote render (first half)
  log "Launching remote render (frames 0-$half)..."
  $SSH "cd ~/videos && mkdir -p output && nohup npx remotion render EducationalVideo 'output/${series_id}-part1.mp4' --concurrency=14 --frames=0-${half} > /tmp/remotion-render.log 2>&1 &"

  # Launch local render (second half)
  log "Launching local render (frames $((half+1))-$last)..."
  npx remotion render EducationalVideo "output/${series_id}-part2.mp4" --concurrency=8 --frames=$((half+1))-${last} > /tmp/remotion-render-local.log 2>&1 &

  log "Both renders launched!"
}

# ── Upload to YouTube ────────────────────────────────────────────────────
upload_video() {
  local series_id="$1"
  if [ "$SKIP_UPLOAD" = "--skip-upload" ]; then
    log "Skipping upload (--skip-upload)"
    return
  fi
  log "Uploading $series_id to YouTube..."
  node scripts/pipeline.mjs "$series_id" --skip-tts --skip-render
}

# ── Cleanup after upload ─────────────────────────────────────────────────
cleanup() {
  local series_id="$1"
  log "Cleaning up $series_id..."
  rm -f "output/${series_id}.mp4" "output/${series_id}-thumb.png"
  local prefix="${series_id//-/_}"
  find public/audio -name "${prefix}_s*.wav" -delete 2>/dev/null || true
  log "Cleanup done"
}

# ══════════════════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════════════════

main() {
  # Step 1: Wait for current debuter-trading render
  log "=== PHASE: Waiting for debuter-trading render ==="
  wait_for_renders "debuter-trading"
  concat_parts "debuter-trading"
  upload_video "debuter-trading"
  cleanup "debuter-trading"

  # Step 2: Process remaining trading videos
  for i in "${!TRADING_SERIES[@]}"; do
    local series_id="${TRADING_SERIES[$i]}"
    if [ "$series_id" = "debuter-trading" ]; then continue; fi

    log ""
    log "═══════════════════════════════════════════════════════════════"
    log "  PROCESSING: $series_id ($((i+1))/${#TRADING_SERIES[@]})"
    log "═══════════════════════════════════════════════════════════════"

    generate_content "$series_id" "${CONTENT_GENERATORS[$i]}"
    launch_split_render "$series_id"
    wait_for_renders "$series_id"
    concat_parts "$series_id"
    upload_video "$series_id"
    cleanup "$series_id"

    log "✅ $series_id COMPLETE"
  done

  log ""
  log "██████████████████████████████████████████████████████████████████"
  log "  ALL 7 TRADING VIDEOS COMPLETE!"
  log "██████████████████████████████████████████████████████████████████"
}

main
