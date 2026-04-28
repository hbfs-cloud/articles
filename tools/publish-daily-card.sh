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
rm -f scanner/status/mode-growth.png scanner/status/mode-calmar.png scanner/status/mode-zero.png scanner/status/mode-turbo.png scanner/status/mode-dynamic.png scanner/status/mode-balanced.png scanner/status/mode-secured.png scanner/status/mode-fortress.png scanner/status/daily-card.png 2>/dev/null

# ─── Step 2: Generate daily card image (site only — notif texte via Step 8) ──
echo ""
echo "🖼️  Step 2: Generating daily card image..."
if [ "$DRY_RUN" = true ]; then
  node tools/generate-scanner-image.js --dry-run || echo "⚠️  Image generation failed (non-blocking)"
else
  node tools/generate-scanner-image.js || echo "⚠️  Image generation failed (non-blocking)"
fi

# ─── Step 3: Re-run sweep (backtest all scans with current prices) ───────────
if [ "$SKIP_SWEEP" = false ]; then
  echo ""
  echo "🔄 Step 3: Running sweep (~5 min)..."
  SWEEP_START=$(date +%s)
  node tools/sweep.js 2>&1 | tail -20
  SWEEP_END=$(date +%s)
  echo "   Sweep done in $((SWEEP_END - SWEEP_START))s"

  # ─── Step 4: (removed — gen-3-cards.js legacy) ───────────────────────────

  # ─── Step 5: Regenerate scanner/status page + portfolio endpoints ──────────
  echo ""
  echo "📄 Step 5: Generating scanner/status page + portfolio endpoints..."
  node tools/gen-status-page.js
  node tools/gen-mode-cards.js
  node tools/gen-api.js
else
  echo ""
  echo "⏭️  Steps 3-5: Skipped (--no-sweep)"
fi

# ─── Step 6: Commit & push everything ────────────────────────────────────────
echo ""
echo "📤 Step 6: Committing..."
# Convention: scanner du soir = séance J+1 (prochain jour de trading ouvrable)
# Lundi→Mardi, Mardi→Mercredi, ..., Vendredi→Lundi (skip weekend)
_DOW=$(date '+%u')  # 1=Mon, 5=Fri, 6=Sat, 7=Sun
if [ "$_DOW" -eq 5 ]; then
  SCAN_DATE=$(date -d '+3 days' '+%Y%m%d')  # Vendredi soir → lundi
elif [ "$_DOW" -eq 6 ]; then
  SCAN_DATE=$(date -d '+2 days' '+%Y%m%d')  # Samedi → lundi
elif [ "$_DOW" -eq 7 ]; then
  SCAN_DATE=$(date -d '+1 day' '+%Y%m%d')   # Dimanche → lundi
else
  SCAN_DATE=$(date -d '+1 day' '+%Y%m%d')   # Lun-Jeu → J+1
fi
TODAY=$(date '+%Y%m%d')  # Date réelle (pour commits/logs)
echo "   Scan date (séance): $SCAN_DATE | Today: $TODAY"

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
    data/modes-config.json \
    data/modes-config-history.json \
    data/risk-snapshots.json \
    scanner/status/mode-*-*.png \
    scanner/status/index.html \
    scanner/status/manifest.json \
    scanner/status/history/dates.json \
    scanner/status/history/*.json \
    portfolio/v1/ \
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
SCAN_PATH="scanner/${SCAN_DATE}/index.html"
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
