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
set -o pipefail   # fail pipelines on first non-zero (sweep | tail used to swallow crashes)
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
  # ─── Step 2c: Candlestick scan (AmericanBulls) → appends Bull-mode signals ──
  # Feeds the "bull" mode (filterName=candlestick_only). MUST run before sweep AND
  # gen-status-page (gen-status-page builds the per-mode "Orders to Place" panel by
  # filtering the latest scan's signals.json — without this, bull shows 0 signals).
  # Idempotent: candlestick-scanner dedups by ticker, safe to re-run.
  echo ""
  echo "🕯️  Step 2c: Candlestick scan (Bull mode signals)..."
  CS_SCAN_DIR=$(ls -d scanner/2*/ 2>/dev/null | sort | tail -1)
  CS_FOLDER=$(basename "$CS_SCAN_DIR")
  CS_REGIME=$(node -e "try{process.stdout.write(require('./${CS_SCAN_DIR}signals.json').regime||'')}catch(e){}" 2>/dev/null)
  CS_LAST_TRADING=$(node -e "const s=require('./${CS_SCAN_DIR}signals.json');const d=s.signals[0]?.date||'';process.stdout.write(d.replace(/-/g,''))" 2>/dev/null || echo "$CS_FOLDER")
  node tools/candlestick-scanner.js --output signals --source yahoo --date "${CS_LAST_TRADING:-$CS_FOLDER}" --folder "$CS_FOLDER" --regime "$CS_REGIME" || echo "⚠️  Candlestick scan failed (non-blocking)"

  echo ""
  echo "🔮 Step 2d: Adaptive Fractal scan (AF mode signals)..."
  node tools/fractal-scanner.js --output signals --date "${CS_LAST_TRADING:-$CS_FOLDER}" --folder "$CS_FOLDER" --regime "$CS_REGIME" --min-score 35 --top 30 || echo "⚠️  Fractal scan failed (non-blocking)"

  echo ""
  echo "⚡ Step 2e: HighVol Breakout scan..."
  node tools/highvol-scanner.js --output signals --date "${CS_LAST_TRADING:-$CS_FOLDER}" --folder "$CS_FOLDER" --regime "$CS_REGIME" --min-score 50 --top 20 || echo "⚠️  HighVol scan failed (non-blocking)"

  echo ""
  echo "⛏️  Step 2f: Metals scan..."
  node tools/fractal-scanner.js --universe metals --output signals --date "${CS_LAST_TRADING:-$CS_FOLDER}" --folder "$CS_FOLDER" --regime "$CS_REGIME" --min-score 25 --top 15 || echo "⚠️  Metals scan failed (non-blocking)"

  echo ""
  echo "💱 Step 2g: Forex scan..."
  # forex-scanner.js (3-axis systematic-tss port) fills signals.forex_pool — the ONLY
  # field sweep.js reads for the forex mode. It has NO --folder/--regime flags (unlike
  # fractal-scanner) and strips dashes from --date internally to derive the scan folder.
  node tools/forex-scanner.js --output signals --date "${CS_LAST_TRADING:-$CS_FOLDER}" --min-score 20 --top 10 || echo "⚠️  Forex scan failed (non-blocking)"

  echo ""
  echo "🏛️  Step 2h: Casablanca Bourse scan..."
  node tools/casablanca-scanner.js --output signals --date "${CS_LAST_TRADING:-$CS_FOLDER}" --folder "$CS_FOLDER" --regime "$CS_REGIME" --min-score 25 --top 15 || echo "⚠️  Casablanca scan failed (non-blocking)"

  echo ""
  echo "🔄 Step 2i: Casablanca Momentum Rotation scan..."
  node tools/momentum-scanner.js --universe casablanca --output signals --date "${CS_LAST_TRADING:-$CS_FOLDER}" --folder "$CS_FOLDER" --regime "$CS_REGIME" --min-score 5 --top 15 || echo "⚠️  Casablanca MomRot scan failed (non-blocking)"

  echo ""
  echo "🔄 Step 2j: Momentum Rotation scan (US)..."
  node tools/momentum-scanner.js --output signals --date "${CS_LAST_TRADING:-$CS_FOLDER}" --folder "$CS_FOLDER" --regime "$CS_REGIME" --min-score 5 --top 20 || echo "⚠️  Momentum scan failed (non-blocking)"

  echo ""
  echo "📈 Step 2k: ETF Momentum scan..."
  node tools/etf-scanner.js --output signals --date "${CS_LAST_TRADING:-$CS_FOLDER}" --folder "$CS_FOLDER" --regime "$CS_REGIME" --top 10 || echo "⚠️  ETF scan failed (non-blocking)"

  echo ""
  echo "📈 Step 2k2: ETF Momentum scan (Europe)..."
  node tools/etf-scanner.js --universe etf-eu --output signals --date "${CS_LAST_TRADING:-$CS_FOLDER}" --folder "$CS_FOLDER" --regime "$CS_REGIME" --top 10 || echo "⚠️  ETF EU scan failed (non-blocking)"

  echo ""
  echo "📐 Step 2l: Trendline Breakout scan (forex)..."
  node tools/trendline-scanner.js --universe forex --output signals --date "${CS_LAST_TRADING:-$CS_FOLDER}" --folder "$CS_FOLDER" --regime "$CS_REGIME" --min-score 50 --top 10 || echo "⚠️  Trendline forex scan failed (non-blocking)"

  echo ""
  echo "📐 Step 2m: Trendline Breakout scan (indices 4h)..."
  node tools/trendline-scanner.js --universe indices --interval 4h --output signals --date "${CS_LAST_TRADING:-$CS_FOLDER}" --folder "$CS_FOLDER" --regime "$CS_REGIME" --min-score 50 --top 10 || echo "⚠️  Trendline indices 4h scan failed (non-blocking)"

  # Steps 2n (trendline ETF) and 2p (trendline stocks daily) REMOVED
  # Backtest showed negative CAGR: stocks -11.6%, ETF -3.6%. Keep only forex 4h + indices 1h/4h.

  echo ""
  echo "🔄 Step 2n: Hybrid breadth analysis..."
  node tools/hybrid-scanner.js --output signals --date "${CS_LAST_TRADING:-$CS_FOLDER}" --folder "$CS_FOLDER" --regime "$CS_REGIME" || echo "⚠️  Hybrid scan failed (non-blocking)"

  echo ""
  echo "🔄 Step 3: Running sweep (~5 min)..."
  SWEEP_START=$(date +%s)
  node tools/sweep.js 2>&1 | tail -20
  SWEEP_END=$(date +%s)
  echo "   Sweep done in $((SWEEP_END - SWEEP_START))s"

  # ─── Step 4: Refresh risk metrics (VaR + stress + correlation + regime) ────
  echo ""
  echo "🛡️  Step 4: Refreshing risk metrics from MCP gateway..."
  export MCP_GATEWAY_URL="${MCP_GATEWAY_URL:-https://mcp.dailytickers.com/mcp}"
  node tools/refresh-risk-metrics.js

  # ─── Step 4b: Replay trades with 1-min OHLCV (realistic entry/exit times) ──
  echo ""
  echo "🔁 Step 4b: Replaying trades with 1-min data..."
  node tools/replay-trades.js 2>&1 | tail -15
  echo "   Replay done."

  # ─── Step 4c: Forward continuity layer (sealed anchor + post-anchor delta) ──
  # Runs AFTER sweep+replay so backtest-trades.json is final: pit-forward.js re-reads
  # each frozen_<mode> anchor and appends ONLY the delta of trades closed/opened since,
  # into data/pit-forward.json (READ-ONLY on results/trades; sealed prefix byte-identical).
  # gen-status-page prefers this healthy forward hero+curve, else falls back to sealed.
  # Non-blocking (like the scanners): a failure just leaves the sealed hero in place.
  echo ""
  echo "🧭 Step 4c: Forward continuity (pit-forward)..."
  node tools/pit-forward.js 2>&1 | tail -10 || echo "⚠️  pit-forward failed (non-blocking — sealed hero stays)"

  # ─── Step 5: Regenerate scanner/status page + portfolio endpoints ──────────
  echo ""
  echo "📄 Step 5: Generating scanner/status page + portfolio endpoints..."
  node tools/gen-status-page.js
  node tools/gen-mode-cards.js
  node tools/gen-api.js

  # ─── Step 5b: Regime recalibration check (dry-run) ─────────────────────────
  # Detects significant regime shift vs modes-config.json. Append-only to
  # config-history.json. Auto-apply only when REGIME_AUTO_APPLY=1 is set.
  echo ""
  echo "🌐 Step 5b: Regime recalibration check (dry-run)..."
  if [ "${REGIME_AUTO_APPLY:-0}" = "1" ]; then
    node tools/regime-recalibrate.js --apply || echo "  Recalibration skipped (gate not met or no advisor delta)."
  else
    node tools/regime-recalibrate.js || echo "  Recalibration check exited cleanly (no change proposed)."
  fi
else
  echo ""
  echo "⏭️  Steps 3-5b: Skipped (--no-sweep)"
fi

# ─── Step 6: Commit & push everything ────────────────────────────────────────
echo ""
echo "📤 Step 6: Committing..."
# Convention: scanner du soir = séance J+1 (prochain jour de trading ouvrable)
# Lundi→Mardi, Mardi→Mercredi, ..., Vendredi→Lundi (skip weekend)
# Cross-platform date arithmetic (BSD on macOS / GNU on Linux)
if date -v +1d '+%Y' >/dev/null 2>&1; then
  _date_add_days() { date -v "+${1}d" '+%Y%m%d'; }   # BSD
else
  _date_add_days() { date -d "+${1} days" '+%Y%m%d'; } # GNU
fi
_DOW=$(date '+%u')  # 1=Mon, 5=Fri, 6=Sat, 7=Sun
if [ "$_DOW" -eq 5 ]; then
  SCAN_DATE=$(_date_add_days 3)  # Vendredi soir → lundi
elif [ "$_DOW" -eq 6 ]; then
  SCAN_DATE=$(_date_add_days 2)  # Samedi → lundi
elif [ "$_DOW" -eq 7 ]; then
  SCAN_DATE=$(_date_add_days 1)  # Dimanche → lundi
else
  SCAN_DATE=$(_date_add_days 1)  # Lun-Jeu → J+1
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

# ─── Step 7b: Lessons decay (daily, idempotent, non-blocking) ────────────────
# Recomputes effective confidence for market_truth rules in scanner-lessons.json
# from their half_life_days (process_rules never decay). Safe to run every day —
# re-running on the same date is a no-op. Never blocks the pipeline on failure.
echo ""
echo "🧠 Step 7b: Lessons decay..."
node tools/lessons-engine.js --decay 2>/dev/null || true

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

# ─── Step 10: Substack draft (OPTIONAL, non-blocking) ────────────────────────
# Converts today's scanner article to a Substack draft (data/substack-drafts/)
# and, only when SUBSTACK_MCP_URL is reachable + MCP_AUTH_TOKEN is set, posts a
# Notes teaser. Without those, stays draft-only local — never fails the pipeline.
# Disable entirely with SUBSTACK_DISABLE=1.
echo ""
echo "📰 Step 10: Substack draft (optional)..."
if [ "${SUBSTACK_DISABLE:-0}" = "1" ]; then
  echo "   (SUBSTACK_DISABLE=1: skipped)"
elif [ "$DRY_RUN" = true ]; then
  echo "   (dry-run: skip)"
else
  SCAN_PATH="scanner/${SCAN_DATE}/index.html"
  if [ -f "$SCAN_PATH" ]; then
    node tools/substack-publish.js "$SCAN_PATH" 2>&1 || echo "⚠️  substack-publish failed (non-blocking)"
  else
    echo "   (no scanner article at $SCAN_PATH: skip)"
  fi
fi

echo ""
echo "✅ Done: $(date '+%H:%M:%S')"
