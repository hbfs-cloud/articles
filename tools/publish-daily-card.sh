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

# ─── Step 2: Generate daily card image + Telegram ────────────────────────────
echo ""
echo "🖼️  Step 2: Generating daily card image..."
if [ "$DRY_RUN" = true ]; then
  node tools/generate-scanner-image.js --dry-run
else
  node tools/generate-scanner-image.js --telegram
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

echo ""
echo "✅ Done: $(date '+%H:%M:%S')"
