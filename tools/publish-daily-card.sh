#!/bin/bash
# publish-daily-card.sh
#
# Pipeline post-scan complet : tracking → image Telegram → sweep → mode cards → status page → push
#
# Usage:
#   ./tools/publish-daily-card.sh                        # Full pipeline + Telegram (token-based)
#   ./tools/publish-daily-card.sh --dry-run              # Full pipeline sans push ni Telegram
#   ./tools/publish-daily-card.sh --no-sweep             # Skip le sweep (déjà lancé en amont par /scanner)
#   ./tools/publish-daily-card.sh --no-telegram          # Push + QA MAIS pas de notif token-based —
#                                                        # le Telegram part via le MCP notification (AGENT)
#   ./tools/publish-daily-card.sh --no-sweep --no-telegram   # ← recommandé depuis /scanner (voir .claude/commands/scanner.md)
#
# Cron (chaque soir à 23h30):
#   30 23 * * 1-5 cd /home/ci/projects/articles && ./tools/publish-daily-card.sh >> /tmp/scanner-publish.log 2>&1

set -e
set -o pipefail   # fail pipelines on first non-zero (sweep | tail used to swallow crashes)
cd "$(dirname "$0")/.."

SKIP_SWEEP=false
DRY_RUN=false
NO_TELEGRAM=false   # --no-telegram : pipeline complet (image, push, QA) SANS notif token-based.
                    # Le Telegram part alors via le MCP notification connecté (envoyé par l'AGENT).
for arg in "$@"; do
  case "$arg" in
    --no-sweep)    SKIP_SWEEP=true ;;
    --dry-run)     DRY_RUN=true ;;
    --no-telegram) NO_TELEGRAM=true ;;
  esac
done
# NO_NOTIFY = vrai si dry-run OU no-telegram → gate unique pour les Steps 8/9/10 (notif token-based).
NO_NOTIFY=false
{ [ "$DRY_RUN" = true ] || [ "$NO_TELEGRAM" = true ]; } && NO_NOTIFY=true

echo "=== Scanner Daily Card Publisher ==="
echo "Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Options: sweep=$([ "$SKIP_SWEEP" = true ] && echo "skip" || echo "yes") telegram=$([ "$NO_NOTIFY" = true ] && echo "no (→ via MCP notification)" || echo "yes")"

# ─── Next trading session (séance J+1) — computed ONCE, used by dtx-scan (Step 4d) ─────
# and by the commit step (Step 6). Convention: scanner du soir = prochaine séance ouvrable
# (Lun→Mar … Ven→Lun). Cross-platform date arithmetic (BSD on macOS / GNU on Linux).
if date -v +1d '+%Y' >/dev/null 2>&1; then
  _date_add_days() { date -v "+${1}d" "$2"; }   # BSD
else
  _date_add_days() { date -d "+${1} days" "$2"; } # GNU
fi
_DOW=$(date '+%u')  # 1=Mon … 5=Fri, 6=Sat, 7=Sun
case "$_DOW" in
  5) _ADD=3 ;;  # Vendredi → lundi
  6) _ADD=2 ;;  # Samedi → lundi
  7) _ADD=1 ;;  # Dimanche → lundi
  *) _ADD=1 ;;  # Lun-Jeu → J+1
esac
SCAN_DATE=$(_date_add_days "$_ADD" '+%Y%m%d')       # YYYYMMDD (folders / commits)
SCAN_DATE_ISO=$(_date_add_days "$_ADD" '+%Y-%m-%d') # YYYY-MM-DD (dtx --asof)
TODAY=$(date '+%Y%m%d')
echo "Scan date (séance): $SCAN_DATE ($SCAN_DATE_ISO) | Today: $TODAY"

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
  # MCP-PRIMARY (décret archi 2026-07-12 « le MCP fait foi ») : candlestick-scanner NE FETCH PLUS
  # (Yahoo/allorigins + univers local retirés) — il ingère un staging JSON de barres OHLCV produit
  # par l'AGENT via mcp__marketdata__* (RunScreener US + QueryData bars_daily). Ce subprocess node
  # NE PEUT PAS appeler le MCP (OAuth2, zéro token) : si le staging n'a pas été pré-produit, on skip
  # (non-bloquant), exactement comme factor/momentum. Chemin par défaut surchargé par CANDLESTICK_STAGE.
  echo ""
  echo "🕯️  Step 2c: Candlestick scan (Bull mode signals)..."
  CS_SCAN_DIR=$(ls -d scanner/2*/ 2>/dev/null | sort | tail -1)
  CS_FOLDER=$(basename "$CS_SCAN_DIR")
  CS_REGIME=$(node -e "try{process.stdout.write(require('./${CS_SCAN_DIR}signals.json').regime||'')}catch(e){}" 2>/dev/null)
  CS_LAST_TRADING=$(node -e "const s=require('./${CS_SCAN_DIR}signals.json');const d=s.signals[0]?.date||'';process.stdout.write(d.replace(/-/g,''))" 2>/dev/null || echo "$CS_FOLDER")
  CS_STAGE="${CANDLESTICK_STAGE:-/tmp/candlestick-stage.json}"
  if [ -f "$CS_STAGE" ]; then
    node tools/candlestick-scanner.js --ingest "$CS_STAGE" --output signals --date "${CS_LAST_TRADING:-$CS_FOLDER}" --folder "$CS_FOLDER" --regime "$CS_REGIME" || echo "⚠️  Candlestick scan failed (non-blocking)"
  else
    echo "⚠️  Candlestick staging absent ($CS_STAGE) — MCP-primary : staging produit par l'AGENT (mcp__marketdata__*). Skip non-bloquant."
  fi

  echo ""
  echo "🔮 Step 2d: Adaptive Fractal scan (AF mode signals)..."
  node tools/fractal-scanner.js --output signals --date "${CS_LAST_TRADING:-$CS_FOLDER}" --folder "$CS_FOLDER" --regime "$CS_REGIME" --min-score 35 --top 30 || echo "⚠️  Fractal scan failed (non-blocking)"

  echo ""
  echo "⚡ Step 2e: HighVol Breakout scan..."
  # MCP-PRIMARY (décret archi 2026-07-12) : highvol-scanner NE FETCH PLUS (Yahoo + univers local
  # retirés) — il ingère un staging JSON (RunScreener + QueryData bars_daily) produit par l'AGENT.
  # Ce subprocess node NE PEUT PAS appeler le MCP (OAuth2, zéro token) : staging absent → skip
  # non-bloquant (0 signal légitime ce run), JAMAIS de fetch local. Chemin surchargé par HIGHVOL_STAGE.
  HIGHVOL_STAGE="${HIGHVOL_STAGE:-/tmp/highvol-stage.json}"
  if [ -f "$HIGHVOL_STAGE" ]; then
    node tools/highvol-scanner.js --ingest "$HIGHVOL_STAGE" --output signals --date "${CS_LAST_TRADING:-$CS_FOLDER}" --folder "$CS_FOLDER" --regime "$CS_REGIME" --min-score 50 --top 20 || echo "⚠️  HighVol scan failed (non-blocking)"
  else
    echo "⚠️  HighVol staging absent ($HIGHVOL_STAGE) — MCP-primary : staging produit par l'AGENT (mcp__marketdata__*). Skip non-bloquant."
  fi

  echo ""
  echo "⛏️  Step 2f: Metals scan..."
  # MCP-PRIMARY : la voie flippée est metals-scanner.js --ingest (fractal-scanner reste NON flippé —
  # fetch local — donc on NE l'appelle plus pour metals). Staging (RunScreener metals + QueryData
  # bars_daily) produit par l'AGENT ; absent → skip non-bloquant. Chemin surchargé par METALS_STAGE.
  METALS_STAGE="${METALS_STAGE:-/tmp/metals-stage.json}"
  if [ -f "$METALS_STAGE" ]; then
    node tools/metals-scanner.js --ingest "$METALS_STAGE" --output signals --date "${CS_LAST_TRADING:-$CS_FOLDER}" --folder "$CS_FOLDER" --regime "$CS_REGIME" --min-score 25 --top 15 || echo "⚠️  Metals scan failed (non-blocking)"
  else
    echo "⚠️  Metals staging absent ($METALS_STAGE) — MCP-primary : staging produit par l'AGENT (mcp__marketdata__*). Skip non-bloquant."
  fi

  echo ""
  echo "💱 Step 2g: Forex scan..."
  # forex-scanner.js (3-axis systematic-tss port) fills signals.forex_pool — the ONLY
  # field sweep.js reads for the forex mode. MCP-PRIMARY : staging (RunScreener FX + QueryData
  # bars_daily) produit par l'AGENT ; absent → skip non-bloquant. Chemin surchargé par FOREX_STAGE.
  FOREX_STAGE="${FOREX_STAGE:-/tmp/forex-stage.json}"
  if [ -f "$FOREX_STAGE" ]; then
    node tools/forex-scanner.js --ingest "$FOREX_STAGE" --output signals --date "${CS_LAST_TRADING:-$CS_FOLDER}" --min-score 20 --top 10 || echo "⚠️  Forex scan failed (non-blocking)"
  else
    echo "⚠️  Forex staging absent ($FOREX_STAGE) — MCP-primary : staging produit par l'AGENT (mcp__marketdata__*). Skip non-bloquant."
  fi

  # Steps 2h/2i (Casablanca Bourse + Casablanca MomRot) RETIRED 2026-07-11 : la stratégie casablanca
  # ne tourne plus (univers BVC bloqué/malformé, api.casablanca-bourse.com KO). Les appels échouaient
  # chaque soir (exit 1) et la routine cloud alertait Telegram à chaque run. On retire du pipeline pour
  # stopper les alertes ; casablanca_pool reste vide (gen-status-page/scanner-parser gèrent le pool vide).
  # Pour réactiver : décommenter + rétablir une source de prix BVC fiable + revalider.

  echo ""
  echo "🔄 Step 2j: Momentum Rotation scan (US)..."
  # MCP-PRIMARY : momentum-scanner ingère un staging PRE-SCORÉ (candidates[] scorés côté agent) produit
  # par l'AGENT (RunScreener US + QueryData bars_daily) ; absent → skip non-bloquant. Var: MOMENTUM_STAGE.
  MOMENTUM_STAGE="${MOMENTUM_STAGE:-/tmp/momentum-stage.json}"
  if [ -f "$MOMENTUM_STAGE" ]; then
    node tools/momentum-scanner.js --ingest "$MOMENTUM_STAGE" --output signals --date "${CS_LAST_TRADING:-$CS_FOLDER}" --folder "$CS_FOLDER" --regime "$CS_REGIME" --min-score 5 --top 20 || echo "⚠️  Momentum scan failed (non-blocking)"
  else
    echo "⚠️  Momentum staging absent ($MOMENTUM_STAGE) — MCP-primary : staging produit par l'AGENT (mcp__marketdata__*). Skip non-bloquant."
  fi

  echo ""
  echo "📈 Step 2k: ETF Momentum scan..."
  # MCP-PRIMARY : etf-scanner ingère un staging (RunScreener etf-us + QueryData bars_daily) produit par
  # l'AGENT ; absent → skip non-bloquant. Chemin surchargé par ETF_STAGE.
  ETF_STAGE="${ETF_STAGE:-/tmp/etf-stage.json}"
  if [ -f "$ETF_STAGE" ]; then
    node tools/etf-scanner.js --ingest "$ETF_STAGE" --output signals --date "${CS_LAST_TRADING:-$CS_FOLDER}" --folder "$CS_FOLDER" --regime "$CS_REGIME" --top 10 || echo "⚠️  ETF scan failed (non-blocking)"
  else
    echo "⚠️  ETF staging absent ($ETF_STAGE) — MCP-primary : staging produit par l'AGENT (mcp__marketdata__*). Skip non-bloquant."
  fi

  echo ""
  echo "📈 Step 2k2: ETF Momentum scan (Europe)..."
  # MCP-PRIMARY : même binaire, univers etf-eu. Staging distinct (RunScreener etf-eu + QueryData
  # bars_daily) produit par l'AGENT ; absent → skip non-bloquant. Chemin surchargé par ETF_EU_STAGE.
  ETF_EU_STAGE="${ETF_EU_STAGE:-/tmp/etf-eu-stage.json}"
  if [ -f "$ETF_EU_STAGE" ]; then
    node tools/etf-scanner.js --universe etf-eu --ingest "$ETF_EU_STAGE" --output signals --date "${CS_LAST_TRADING:-$CS_FOLDER}" --folder "$CS_FOLDER" --regime "$CS_REGIME" --top 10 || echo "⚠️  ETF EU scan failed (non-blocking)"
  else
    echo "⚠️  ETF EU staging absent ($ETF_EU_STAGE) — MCP-primary : staging produit par l'AGENT (mcp__marketdata__*). Skip non-bloquant."
  fi

  echo ""
  echo "📐 Step 2l: Trendline Breakout scan (forex)..."
  # MCP-PRIMARY : trendline-scanner ingère un staging (RunScreener/QueryData bars_daily FX) produit par
  # l'AGENT ; absent → skip non-bloquant. Chemin surchargé par TRENDLINE_FOREX_STAGE.
  TRENDLINE_FOREX_STAGE="${TRENDLINE_FOREX_STAGE:-/tmp/trendline-forex-stage.json}"
  if [ -f "$TRENDLINE_FOREX_STAGE" ]; then
    node tools/trendline-scanner.js --universe forex --ingest "$TRENDLINE_FOREX_STAGE" --output signals --date "${CS_LAST_TRADING:-$CS_FOLDER}" --folder "$CS_FOLDER" --regime "$CS_REGIME" --min-score 50 --top 10 || echo "⚠️  Trendline forex scan failed (non-blocking)"
  else
    echo "⚠️  Trendline forex staging absent ($TRENDLINE_FOREX_STAGE) — MCP-primary : staging produit par l'AGENT (mcp__marketdata__*). Skip non-bloquant."
  fi

  echo ""
  echo "📐 Step 2m: Trendline Breakout scan (indices 4h)..."
  # MCP-PRIMARY : même binaire, univers indices interval 4h. Staging distinct produit par l'AGENT
  # (barres 4h QueryData) ; absent → skip non-bloquant. Chemin surchargé par TRENDLINE_INDICES_STAGE.
  TRENDLINE_INDICES_STAGE="${TRENDLINE_INDICES_STAGE:-/tmp/trendline-indices-stage.json}"
  if [ -f "$TRENDLINE_INDICES_STAGE" ]; then
    node tools/trendline-scanner.js --universe indices --interval 4h --ingest "$TRENDLINE_INDICES_STAGE" --output signals --date "${CS_LAST_TRADING:-$CS_FOLDER}" --folder "$CS_FOLDER" --regime "$CS_REGIME" --min-score 50 --top 10 || echo "⚠️  Trendline indices 4h scan failed (non-blocking)"
  else
    echo "⚠️  Trendline indices staging absent ($TRENDLINE_INDICES_STAGE) — MCP-primary : staging produit par l'AGENT (mcp__marketdata__*). Skip non-bloquant."
  fi

  # Steps 2n (trendline ETF) and 2p (trendline stocks daily) REMOVED
  # Backtest showed negative CAGR: stocks -11.6%, ETF -3.6%. Keep only forex 4h + indices 1h/4h.

  echo ""
  echo "🔄 Step 2n: Hybrid breadth analysis..."
  # MCP-PRIMARY : hybrid-scanner ingère un staging (RunScreener US + QueryData bars_daily pour la
  # breadth) produit par l'AGENT ; absent → skip non-bloquant. Chemin surchargé par HYBRID_STAGE.
  HYBRID_STAGE="${HYBRID_STAGE:-/tmp/hybrid-stage.json}"
  if [ -f "$HYBRID_STAGE" ]; then
    node tools/hybrid-scanner.js --ingest "$HYBRID_STAGE" --output signals --date "${CS_LAST_TRADING:-$CS_FOLDER}" --folder "$CS_FOLDER" --regime "$CS_REGIME" || echo "⚠️  Hybrid scan failed (non-blocking)"
  else
    echo "⚠️  Hybrid staging absent ($HYBRID_STAGE) — MCP-primary : staging produit par l'AGENT (mcp__marketdata__*). Skip non-bloquant."
  fi

  echo ""
  echo "🧮 Step 2o: Factor composite scan (low-turnover, US)..."
  # factor-scanner.js fills signals.factor_pool — the ONLY field sweep.js reads for the `factor`
  # mode (assetClass us_factor). Monthly rebalance (21d) with a hysteresis buffer → holdings are
  # frozen on non-rebalance days (low turnover). MCP-PRIMARY : staging (RunScreener US + QueryData
  # bars_daily) produit par l'AGENT ; absent → skip non-bloquant. Chemin surchargé par FACTOR_STAGE.
  FACTOR_STAGE="${FACTOR_STAGE:-/tmp/factor-stage.json}"
  if [ -f "$FACTOR_STAGE" ]; then
    node tools/factor-scanner.js --ingest "$FACTOR_STAGE" --output signals --date "${CS_LAST_TRADING:-$CS_FOLDER}" --folder "$CS_FOLDER" --top 15 || echo "⚠️  Factor scan failed (non-blocking)"
  else
    echo "⚠️  Factor staging absent ($FACTOR_STAGE) — MCP-primary : staging produit par l'AGENT (mcp__marketdata__*). Skip non-bloquant."
  fi

  echo ""
  echo "💲 Step 2p2: price cache ingest (bars MCP marketdata → cache daté du sweep)..."
  # DÉCRET « le MCP fait foi » : PAS de Yahoo. Le fallback réseau de sweep.js est mort en cloud
  # (« Fetched prices for 0/937 » dans les runs committés) → l'AGENT stage les bars via
  # QueryData(bars_daily) AVANT le pipeline (liste : node tools/price-cache-ingest.js --list-needed),
  # et cet ingest les écrit dans data/.price-cache/<date>/ que loadCachedPrice() lit AVANT tout
  # réseau. Staging absent → skip non-bloquant MAIS le sweep n'appendra rien de neuf (loggé).
  PRICE_STAGE_GLOB="${PRICE_STAGE_GLOB:-/tmp/price-stage-*.json}"
  # shellcheck disable=SC2086
  if ls $PRICE_STAGE_GLOB >/dev/null 2>&1; then
    node tools/price-cache-ingest.js --stage $PRICE_STAGE_GLOB || echo "⚠️  price-cache-ingest incomplet (non-bloquant)"
  else
    echo "⚠️  Price staging absent ($PRICE_STAGE_GLOB) — MCP-primary : bars produits par l'AGENT (QueryData bars_daily). Sans lui, le sweep n'a PAS de prix frais → zéro nouveau trade ce soir (dégradation honnête)."
  fi

  echo ""
  echo "🧩 Step 2q: dtx pool bridge (ordres moteur scriptés → dtx_pool)..."
  # Fix « 0 trades depuis D0 » (2026-07-16) : les ordres DtxDecide du staging data/dtx/<id>.json
  # deviennent des signaux source-taggés dtx_pool dans signals.json, consommés EXCLUSIVEMENT par
  # les modes scriptés (assetClass 'dtx', partition universe=modeId). C'est ce qui permet au sweep
  # de tracker fills/exits/trades pour ces modes (avant : AUCUN producteur → live book vide à vie).
  # Staging stale (asof ≠ séance du scan) → mode skippé BRUYAMMENT par le bridge (exit 3, résumé
  # par mode) — dégradation honnête, jamais fabriquée, jamais silencieuse.
  node tools/dtx-pool-bridge.js --folder "$CS_FOLDER" --date "$SCAN_DATE_ISO" || echo "⚠️  dtx pool bridge incomplet (modes skippés ou erreur — voir résumé ci-dessus, non-bloquant)"

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

  # Step 4a1: re-grade mécanique des analyses (prix courants) + watchlist forcée (ALLR/IOVA/ALT/EQX).
  # Met à jour grade + meta.lastCheckedAt/lastCheckedDisplay ("prix vérifié le X"), non-bloquant.
  # NB : le DEEP-refresh (régénération de contenu fact-checkée MCP → bump de la date de PUBLICATION)
  # est une passe AGENT séparée (un subprocess node ne peut pas appeler le MCP marché) — cf
  # scanner-pipeline.md §"Analyses Refresh" Étape 2. Ici = re-grade mécanique seulement.
  echo ""
  echo "🔄 Step 4a1: Re-grade analyses (watchlist + max-age 30)..."
  node tools/refresh-analyses.js --max-age 30 --commit || echo "⚠️  refresh-analyses failed (non-blocking)"

  # ─── Step 4b: Replay trades with 1-min OHLCV (realistic entry/exit times) ──
  echo ""
  echo "🔁 Step 4b: Replaying trades with 1-min data..."
  node tools/replay-trades.js 2>&1 | tail -15
  echo "   Replay done."

  # ─── Step 4c: Forward continuity layer (sealed anchor + post-anchor delta) ──
  # DÉPRÉCIÉ (2026-07-22) POUR L'AFFICHAGE : pit-forward.json n'est PLUS consommé par
  # gen-status-page.js ni gen-api.js. Source unique de la perf affichée = le sweep frozen
  # (computeStatsFromTrades). L'étape est donc SKIPPÉE par défaut ; on la conserve derrière
  # un flag opt-in (ENABLE_PIT_FORWARD=1) pour référence / rollback uniquement.
  echo ""
  if [ "${ENABLE_PIT_FORWARD:-0}" = "1" ]; then
    echo "🧭 Step 4c: Forward continuity (pit-forward) [opt-in ENABLE_PIT_FORWARD=1]..."
    node tools/pit-forward.js 2>&1 | tail -10 || echo "⚠️  pit-forward failed (non-blocking — sealed hero stays)"
  else
    echo "⏭️  Step 4c: pit-forward SKIPPÉ (déprécié en affichage — source unique = sweep frozen). Réactiver avec ENABLE_PIT_FORWARD=1."
  fi

  # ─── Step 4d: dtx (systematic-tss) staging GUARD for SCRIPTED modes — MCP is the SOLE engine ───
  # CUT-OVER (2026-07-08): the hosted dtx MCP (systematic.dailytickers.com) is the ONLY engine
  # ("le MCP fait foi"). The vendored local binary + data bundle have been REMOVED. A `node`
  # subprocess CANNOT call the MCP (OAuth2 on claude.ai, ZERO-token rule) — only the AGENT
  # (Claude Code locally; `claude -p` in the cloud bot) holds mcp__claude_ai_systematic__*.
  #
  # So the 5 dtx-wired scripted modes (highvol/forex/etf/etf_eu/stockbox) get their staging
  # (data/dtx/<mode>.json — "Orders to Place" from DtxDecide + backtest equity from DtxReplay)
  # produced by the AGENT via `tools/dtx-mcp-ingest.js` BEFORE this shell pipeline runs (see the
  # scanner-pipeline skill §"dtx refresh — MCP SOLE ENGINE", Phase 5). This step can NO LONGER
  # regenerate anything (no binary to spawn). It is a GRACEFUL GUARD only: it warns per mode if the
  # committed staging is missing or not a fresh (today, engineMode:"mcp") MCP snapshot, then lets
  # gen-status-page READ whatever staging is committed. It NEVER blocks the scan.
  echo ""
  echo "🧩 Step 4d: dtx scripted-mode staging COMPLETENESS guard (MCP sole engine — no binary)..."
  # ANTI-SILENT-SKIP FRESHNESS NET. A `node` subprocess CANNOT call the MCP, so it cannot regenerate
  # staging — the AGENT must do that BEFORE this shell pipeline (GetHealth preflight + per-mode
  # DtxReplay/DtxDecide → dtx-mcp-ingest; see scanner-pipeline skill §"dtx preflight & completeness").
  # This step is the SECONDARY net that catches a stale-staging night even if the agent's MCP preflight
  # was skipped: it writes data/dtx/_staging-completeness.json (the marker tools/qa-check.js reads →
  # escalates a stale/missing mode to ❌) and prints a LOUD summary. It is NON-crashing (never exits
  # non-zero here) but NEVER silent — an incomplete run is surfaced, not swallowed.
  if node -e 'const r=require("./tools/dtx-scan").writeStagingCompleteness(process.argv[1]);process.exit(r.complete?0:1)' "$SCAN_DATE_ISO"; then
    echo "  ✅ dtx staging COMPLET — les 5 modes scriptés ont un staging MCP frais (engineMode:mcp, aujourd'hui)."
  else
    echo "  ❗❗❗ dtx staging INCOMPLET — un ou plusieurs des 5 modes scriptés n'ont PAS de staging MCP frais."
    echo "  ❗❗❗ L'AGENT n'a PAS régénéré ces modes via le MCP dtx ce run (MCP injoignable / connector absent / job échoué)."
    echo "  ❗❗❗ → data/dtx/_staging-completeness.json marque le run INCOMPLET ; qa-check.js le remontera en ❌ (fail loud)."
    echo "  ❗❗❗ → l'agent DOIT avoir envoyé une alerte Telegram (alias 'alerts'). Staging conservé = STALE, JAMAIS fabriqué."
  fi

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
# SCAN_DATE / SCAN_DATE_ISO / TODAY were computed once at the top of this script.
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
    data/dtx/*.json \
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
if [ -f "$SCAN_PATH" ] && [ "$NO_NOTIFY" != true ]; then
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
if [ "$NO_NOTIFY" = true ]; then
  echo "   (skip notif token-based → Telegram via MCP notification connecté, envoyé par l'AGENT)"
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
elif [ "$NO_NOTIFY" = true ]; then
  echo "   (no-telegram/dry-run: skip)"
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
