#!/bin/bash
# publish-daily-card.sh
#
# Pipeline post-scan complet : tracking → image Telegram → sweep → mode cards → status page → push
#
# Usage:
#   ./tools/publish-daily-card.sh              # Full pipeline + Telegram
#   ./tools/publish-daily-card.sh --dry-run    # Full pipeline sans Telegram
#   ./tools/publish-daily-card.sh --no-sweep   # Skip sweep (rapide, tracking + image seulement)
#
# Cron (chaque soir à 23h30):
#   30 23 * * 1-5 cd /home/ci/projects/articles && ./tools/publish-daily-card.sh >> /tmp/scanner-publish.log 2>&1

set -e
cd "$(dirname "$0")/.."

SKIP_SWEEP=false
DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --no-sweep) SKIP_SWEEP=true ;;
    --dry-run)  DRY_RUN=true ;;
  esac
done

echo "=== Scanner Daily Card Publisher ==="
echo "Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Options: sweep=$([ "$SKIP_SWEEP" = true ] && echo "skip" || echo "yes") telegram=$([ "$DRY_RUN" = true ] && echo "no" || echo "yes")"

# ─── Step 1: Update tracking (positions + metrics from live prices) ──────────
echo ""
echo "📊 Step 1: Updating tracking data..."
node tools/update-tracking.js

# ─── Step 1b: Clean old static-named images (pre-timestamp migration) ────────
rm -f scanner/status/mode-growth.png scanner/status/mode-calmar.png scanner/status/mode-zero.png scanner/status/daily-card.png 2>/dev/null

# ─── Step 2: Generate daily card image (site only — notif texte via Step 8) ──
echo ""
echo "🖼️  Step 2: Generating daily card image..."
if [ "$DRY_RUN" = true ]; then
  node tools/generate-scanner-image.js --dry-run
else
  node tools/generate-scanner-image.js
fi

# ─── Step 3: Re-run sweep (backtest all scans with current prices) ───────────
if [ "$SKIP_SWEEP" = false ]; then
  echo ""
  echo "🔄 Step 3: Running sweep (~5 min)..."
  SWEEP_START=$(date +%s)
  node tools/sweep.js 2>&1 | tail -20
  SWEEP_END=$(date +%s)
  echo "   Sweep done in $((SWEEP_END - SWEEP_START))s"

  # ─── Step 4: Regenerate mode card images (from backtest data) ──────────────
  echo ""
  echo "🖼️  Step 4: Generating mode card images..."
  node tools/gen-3-cards.js

  # ─── Step 5: Regenerate scanner/status page (from backtest data) ───────────
  echo ""
  echo "📄 Step 5: Generating scanner/status page..."
  node tools/gen-status-page.js
else
  echo ""
  echo "⏭️  Steps 3-5: Skipped (--no-sweep)"
fi

# ─── Step 6: Commit & push everything ────────────────────────────────────────
echo ""
echo "📤 Step 6: Committing..."
TODAY=$(date '+%Y%m%d')

# Stage all potentially changed files (ignore errors for missing files)
git add \
  scanner-daily-card.html \
  data/scanner-metrics.json \
  data/scanner-positions.json \
  2>/dev/null || true

git add \
  scanner/status/daily-card-*.png \
  scanner/status/manifest.json \
  2>/dev/null || true

if [ "$SKIP_SWEEP" = false ]; then
  git add \
    data/backtest-results.json \
    data/backtest-trades.json \
    data/portfolio-history.json \
    scanner/status/mode-growth-*.png \
    scanner/status/mode-calmar-*.png \
    scanner/status/mode-zero-*.png \
    scanner/status/index.html \
    scanner/status/manifest.json \
    2>/dev/null || true
fi

# Only commit if there are staged changes
if git diff --cached --quiet; then
  echo "⚠️  No changes to commit"
else
  git commit -m "chore: scanner daily card + sweep update ${TODAY}"
  git push origin main
  echo "✅ Pushed to main"
fi

# ─── Step 7: QA Check ────────────────────────────────────────────────────────
echo ""
echo "🔍 Step 7: QA Check..."
node tools/qa-check.js --discord
# Post QA report to Discord if there are issues
if [ -f /tmp/qa-discord-report.txt ]; then
  QA_MSG=$(cat /tmp/qa-discord-report.txt)
  # Only post if there are errors/warnings (not just the short OK line)
  if echo "$QA_MSG" | grep -q "❌\|Erreur\|Avertissement\|warning"; then
    openclaw message send \
      --channel discord \
      --target "1483382014588747778" \
      --message "$QA_MSG" 2>/dev/null || true
  fi
  rm -f /tmp/qa-discord-report.txt
fi

# ─── Step 8: Generate media (audio + video + Telegram to Portfolio Live) ─────
echo ""
echo "🎬 Step 8: Generating media (audio + video + Telegram)..."
SCAN_PATH="scanner/${TODAY}/index.html"
if [ -f "$SCAN_PATH" ] && [ "$DRY_RUN" != true ]; then
  # ANTHROPIC_API_KEY needed for AI script generation
  if [ -z "$ANTHROPIC_API_KEY" ]; then
    source ~/.profile 2>/dev/null || true
    export ANTHROPIC_API_KEY
  fi
  node tools/generate-media.mjs --type scanner --path "$SCAN_PATH" \
    > /tmp/mw-media-scanner.log 2>&1 \
    && echo "✅ Media generated + Telegram audio/video sent (scanner)" \
    || echo "⚠️  Media generation failed (check /tmp/mw-media-scanner.log)"
else
  echo "   (dry-run or no scanner file: skip media)"
fi

# ─── Step 9: Scanner Status Notification (text per portfolio mode: 89/90/91) ─
echo ""
echo "📡 Step 9: Scanner status notification..."
if [ "$DRY_RUN" = true ]; then
  echo "   (dry-run: skip notification)"
else
  node tools/notify-scanner-status.js 2>&1 || echo "⚠️  notify-scanner-status failed (non-blocking)"
fi

echo ""
echo "✅ Done: $(date '+%H:%M:%S')"
