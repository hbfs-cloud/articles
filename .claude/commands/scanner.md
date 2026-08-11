# /scanner — Full scanner pipeline (MCP → publish → downstream → QA)

End-to-end scanner pipeline for the next trading session.


## ⚡ Phase de collecte — SCRIPTÉE (obligatoire depuis 2026-08-10)

**Ne joue plus les salves MCP à la main.** Émets un jeton, lance la collecte, lis les
artefacts. Le modèle déclare le besoin ; il ne transporte plus la donnée.

```bash
# 1. l'AGENT émet le jeton (max 60 min marketdata, 1440 systematic)
#    GetReadOnlyToken(minutes=60) / DtxMintReadOnlyToken(ttl_minutes=240)
#    → export MCP_TOKEN_MARKETDATA=… MCP_TOKEN_SYSTEMATIC=…
# 2. collecte parallèle + gate de fraîcheur en une commande
bash tools/run-collect.sh scanner-wave1 <dossier>/_data --var refdate=<derniere_cloture> [--var symbol=X]
```

Ce que ça règle mécaniquement, et qu'on oubliait :
- `$refdate` est substitué dans TOUS les arguments → le contrat de date devient structurel,
  plus aucun `end_date` oublié (cause des inversions de signe du weekly du 10/08) ;
- `harness.json` est un sous-produit de la collecte → une source collectée mais non déclarée
  devient impossible ;
- les appels d'une vague partent en parallèle → la règle R2 de `perf-parallel-mcp` est dans le
  moteur, plus dans un rappel de prompt.

Une variable référencée par le plan mais non fournie est une **erreur**, pas un vide : un
`end_date` absent renverrait « le monde d'aujourd'hui » au lieu de la date visée.

Reste à l'agent, et à lui seul : `RefreshBars` / `DtxRefreshBars` (vraies écritures), la
sélection, la rédaction, les gates adversariaux, la décision de publier.
Doctrine complète : skill `llm-script-boundary`.

## ⛔ NO-SKIP POLICY (CRITICAL)

NEVER skip any phase, step, or per-ticker check without explicit user consent. Token budget / time pressure are NOT valid reasons. If a step seems too costly, ASK the user first and wait for the answer. Default = complete every step exactly as specified.

Mandatory per-ticker checks (run for EVERY candidate top-10 + every tkl_pool entry):
- Anti-dilution: `QueryData(symbols=T, types='sec_filings,flags', days=180)` — disqualify dilution_risk_score≥70, S-3 active, ATM, aggressive underwriter, ITM warrants, recent PIPE
- Per-ticker enrichment: `QueryData(symbols=T, types='quote,social_sentiment,insider_transactions,dark_pool,unusual_options,trading_signals')`
- Earnings proximity: `GetEarningsCalendarFiltered(days_ahead=7)` AND DSL `days_until_earnings('T') <= 3` check — DISQUALIFY if within ±3 trading days (or tag "earnings risk")
- Economic event proximity (per ticker currency): `is_near_economic_event(currency, min_priority=2, within_days=3)` — drop or tag

## ✅ MCP DSL Syntax Reference (verified working)

- Indicator variables: `rsi14`, `ema20`, `ema50`, `ema200`, `vwap`, `bbw`, `hhv20`, `hhv50`, `llv20`, `llv50`, `atrpct`, `obvz`, `sma50`, `sma200`, `vol`
- Indicator functions (series argument MUST be quoted): `sma('close', 50)`, `ema('close', 20)`, `rsi('close', 14)`, `atr(14)`, `hhv('close', 50)`, `pct_change('vwap', 3)`
- Pattern: `is_cup_handle()`, `near_breakout(0.02)`, `cross_up('ema20', 'ema50')`, `vol_spike45(1.5)`
- Signal: `rising('ema50', 10)`, `falling('vwap', 5)`, `inrange('rsi14', 45, 70, 10)`, `trend_strength(20)`
- Context: `market_cap`, `avg_volume`, `asset_type` (== 'stock' or 'etf'), `sector`, `industry`, `country`, `in_index`, `themes`
- Calendar: `days_until_earnings('AAPL') <= 3`, `is_near_economic_event('USD', 3, 2)`
- Relative strength: `perf_rank('sector', '', 20) <= 5` (max 3 args excluding kind), `perf_rel('sector', '', 20)` (no bench unless kind='etf')
- Macro: `vix() > 20`, `regime_score() >= 0.75`
- Multi-asset: `security('SPY', '1d', 'close', 1)`, `benchmark('SPY')`

⚠️ INVALID (do NOT use): `sma(close, 50)` (no quotes), `ma(close, 50)` (function doesn't exist), `asset_type=='etf'` inside pass_expr — use the separate `asset='etf'` param of RunScreener.

RunScreener call params: `pass_expr` (boolean filter), `score_expr` (numeric ranker), `region` ('us'/'eu'), `asset` ('stock' default, 'etf' for ETF universe), `top_k`, `force_async=true` recommended.

## Input

`$ARGUMENTS` — Options:
- *(empty)* — auto-detect next trading day, full pipeline with validation
- `--date YYYYMMDD` — target a specific scan date
- `--skip-validation` — skip the 7-agent QA pass. **RÉSERVÉ à un run interactif avec accord explicite du user dans la session. INTERDIT aux routines/runs autonomes** : la règle durable `analysis-senior-review-first` exige le panel AVANT publication, jamais en rattrapage (violée par le run nocturne du 22/07 — risk_gating vide + zéro panel, corrigé a posteriori).
- `--skip-downstream` — stop after publish (ni `downstream-split.sh compute` ni `distribute` : pas de sweep, pas de status page, pas d'API, pas de push, pas de Telegram)
- `--dry-run` — generate data.json only, no publish or push

## Phase 0 — Date Resolution & Anti-Doublon

1. Compute target scan date:
   - Weekday before 22h30 → today
   - Weekday after 22h30 → D+1
   - Friday after 22h30 → Monday
   - Saturday → Monday
   - Sunday → Monday
2. Check `data/scanner.json` for existing entry at target date → abort if duplicate
3. Read previous scan (`ls scanner/ | sort | tail -1`) for anti-doublon filter (min 70% new = max 3 repeats out of 10)
4. Read `data/scanner-positions.json` for blocked tickers (open positions)
5. Read `data/scanner-filters.json` for sector_map + diversification rules
6. Modes downstream = 6: `turbo`, `dynamic`, `balanced`, `secured`, `fortress`, `tkl`. TKL pool gated per-mode via `modes-config.json#tklPoolEnabled`.
7. Pre-flight: read `~/.claude/projects/-Users-marketwatchxyz-GolandProjects-articles/memory/feedback_pipeline_gotchas.md` for known regression traps (BSD date fallback, qa-check reads `signals.json` not HTML, Pending status, order count).
8. **Retrieve lessons via `node tools/lessons-retrieve.js --regime <REGIME>`** (add `--setups <list>` / `--mode <id>` once known) instead of reading `data/scanner-lessons.json` raw. This returns a small, capped JSON payload (`active_rules`, `known_risks`, `similar_episodes`, `deprecated_rules_ignored`, `retrieval_meta`) — status=active rules only, confidence effective ≥ 0.4, scope-matched to the current regime/setups/mode, sorted by confidence, hard-capped (default 3/3/3) regardless of how many rules are eligible. **The retros fuel the candidate-selection debate at Phase 2** — they do NOT block trades at publish-time. Apply during Phase 2 selection:
   - `active_rules` (non-advisory severities: `selection_filter`, `hard_block`, `infrastructure`) → use these to PICK better candidates upstream (e.g., favor names with stop ≥ 1.5× ATR, R/R ≥ regime threshold, RSI < 72, no earnings ±3d, no toxic underwriters). Each rule's `rule` text carries its rationale — incorporate the reasoning during selection.
   - `known_risks` (`severity: advisory` matches) → bias selection (e.g., favor Momentum in RISK-ON, lift Pre-Squeeze weight in EARLY RISK-OFF). Deviations OK with rationale.
   - `similar_episodes` → the last closed trades in the same regime×setup, with mae/mfe/outcomes/r_multiple where available — use as color, not as a hard filter.
   - **`severity: hard_block` rules remain enforced by `scanner-filters.json` + `validate-scan.js` at publish time, independent of retrieval** — retrieval surfacing them here is for rationale/visibility, NOT the enforcement mechanism. A hard_block rule missing from `active_rules` (e.g. filtered by scope or confidence) is still enforced downstream.
   - `severity: infrastructure` rules → enforced downstream (sweep.js, signal-monitor.js, portfolio API).
   - Cross-reference `_open_questions` in `data/scanner-lessons.json` directly (not covered by retrieval) — if a question targets the current scan (`next_retro_check ≤ today`), test the hypothesis and report in Phase 6 QA.

   **Output of validate-scan.js may emit non-blocking advisories** (lesson-rule deviations such as stop < 1.5× ATR, RSI > 72, R/R below regime threshold). These are educational signals for the NEXT scan iteration — not gates on the current one.

   **⚠️ Absolute principle — memory can never invert a quantitative signal.** Retrieved rules/risks/episodes may only adjust confidence, sizing, or raise an alert/tag on a candidate that already passed the quantitative screen (score, R/R, dilution, earnings, correlation, regime gating). They can NEVER by themselves flip a signal from reject→select or select→reject, and they can NEVER override a hard_block. Every scan MUST record what memory actually did to the decision — see the `_memoryImpact` block required in Phase 3.

## Phase 1 — MCP Data Collection

Run in parallel:

```
mcp__claude_ai_marketdata__GetMarketContext(facets="overview")   # async, seul (pas combinable) — canonique, ex-GetMarketOverview
mcp__claude_ai_marketdata__RunAutoScreener()
mcp__claude_ai_marketdata__RunScreener(expression="...", region="us")   # 3 DSL strategies
mcp__claude_ai_marketdata__RunScreener(expression="...", region="eu")
```

Wait for async jobs via `Jobs(job_id=...)` (canonique, ex-CheckJobStatus/ListJobs → `Jobs(job_id=...)` ou `Jobs(intent_id=...)`). Extract:
- Regime (risk-on/risk-off/neutral), VIX, SPX level
- Top movers, sector variations, trending themes
- Screener candidates with scores

**Manifeste de fraîcheur (skill `content-harness`, H2)** : tracer chaque source collectée dans
`scanner/YYYYMMDD/harness.json` avec son `as_of` RÉEL (régime 6h, quotes/calendriers 24h, insiders 96h,
SEC 168h). Avant Phase 4 (publish) : `node tools/check-freshness.js scanner/YYYYMMDD/harness.json` —
**exit 1 = publication interdite** (recollecter, jamais estimer). `--warn-only` interdit en pipeline.

## Phase 2 — Ticker Selection & Validation

### Selection Rules (scanner-filters.json)
- Score >= 90 (v4 risk layer threshold)
- Min 3 confluence signals per setup
- Diversification: min 5 US + 2 EU + 1 APAC + 2 ETFs
- Max 3 per sector (per sector_map)
- Max 3 repeats from previous scan
- Zero overlap with scanner-positions.json open_positions
- No earnings within ±3 trading days

### Anti-Dilution v2 (OBLIGATOIRE)
For each candidate, check:
```
mcp__claude_ai_marketdata__QueryData(symbols="TICKER", types="sec_filings,flags", days=180)
```
Disqualify on: dilution_risk_score >= 70, shelf_active, atm_program_active, aggressive_underwriter, ITM warrants, recent PIPE/reverse split.

### Risk Gating (OBLIGATOIRE)
Before finalizing top 10, run 4 MCP checks:
```
mcp__claude_ai_marketdata__GetMarketContext(facets="regime", model="ensemble", horizon_days=5)   # canonique, ex-GetRegimeProbability
mcp__claude_ai_marketdata__PortfolioRisk(action="correlation", symbols="TICK1,TICK2,...", lookback_days=60, method="pearson")   # symbols=CSV string (PAS un array). ⚠️ US-only : mélanger des tickers EU (.PA) casse le calc ("0 common trading days"). Endpoint parfois cassé côté serveur (même sur large-caps US) → si échec, FALLBACK concentration manuelle : max 2/secteur + dispersion géo, NE PAS inventer de rho.
mcp__claude_ai_marketdata__GetEarningsCalendarFiltered(days_ahead=7, min_expected_move=4)
mcp__claude_ai_marketdata__PortfolioRisk(action="sizing", signals=[...], constraints={mode:"balanced", max_position_risk_pct:1.0, max_pairwise_correlation:0.7}, mode="balanced")   # canonique, ex-OptimizeSizing — signals=JSON array, constraints=JSON object
```
- Regime: `crisis > 0.30` or `early_risk_off > 0.50` → reduce to 5, breakout_only, size × 0.5
- Correlation: `max_pair.rho > 0.85` → drop lowest score; `avg_off_diagonal > 0.65` → force min 2 sectors
- Earnings: ticker in `exclusion_window` → DISQUALIFY or tag "earnings risk"
- Sizing: use `risk_pct` returned to set position size

### Sharia Compliance
Tag each setup: haram sector, debt/mcap > 33%, interest > 5% revenue, leveraged/bond ETFs.
DOM contract: `data-sharia="true|false"` on BOTH `<tr>` synthesis row AND `<div class="setup-card">`.

### Per-Ticker MCP Enrichment
For each of the 10 selected tickers:
```
mcp__claude_ai_marketdata__QueryData(
  symbols="TICKER",
  types="quote,social_sentiment,insider_transactions,dark_pool,unusual_options,trading_signals"
)
```

### TKL Pool — SAME Validation Pipeline (OBLIGATOIRE)

TKL pool tickers MUST pass the **identical** validation as the top 10. The only relaxed threshold is market cap ($10M vs $500M) and ADV ($2M vs $10M). See `scanner-filters.json#tkl_pool`.

For ALL TKL candidates (batched in groups of 4-6):
```
mcp__claude_ai_marketdata__QueryData(symbols="TKL_TICKERS", types="sec_filings,flags,quote,insider_transactions,unusual_options,dark_pool,financials", days=180)
mcp__claude_ai_marketdata__QueryData(types="earnings_calendar", days=14)
```

**Disqualification rules (same as top 10):**
- Market cap < $10M → DROP
- ADV < $2M → DROP
- Anti-dilution: S-3/424B5 within 90 days, shelf_active, atm_program_active, aggressive_underwriter → DROP
- Serial diluter (multiple S-3/424B5 filings in 12 months) → DROP
- Earnings within ±3 trading days → DROP or tag "earnings risk"
- Unusual options: call_put_ratio < 0.4 + volume > 2× normal (smart money short) → DROP

**Sharia tagging (same as top 10):**
- Check sector (financials/defense/alcohol/tobacco/gambling → false)
- Check debt/mcap ratio > 33% → false
- Tag `sharia: true|false` in signals.json tkl_pool entries

**Insider transactions:** Flag significant buys (+5 pts) or sells (-5 pts to score).

This validation is NOT optional — it runs as part of Phase 2, immediately after TKL screener results are collected. No TKL ticker enters signals.json without passing all checks.

## Phase 3 — Data Generation

1. Generate `scanner/YYYYMMDD/data.json` following `scanner/template/schema.json` exactly
2. Generate `scanner/YYYYMMDD/signals.json` (simplified format for downstream tools)
3. **MANDATORY signals.json fields per signal (top_10 + tkl_pool)** — required for validate-scan.js advisory checks and Phase 0.8 lessons-engine consumption:
   - `extension: { rsi, atr, distance_50dma_pct }` — populate from MCP technicals (GetInstruments instrument_technicals + instrument_support_resistance). RSI 0–100, ATR in price units, distance_50dma_pct = (price-ema50)/ema50*100.
   - `earnings_clear: true` — set false ONLY if you decide to tag-and-keep (rare); default true means scan was filtered against `±3d` earnings window.
   - `dilution_clear: true` — set false ONLY if you accept a flagged ticker with explicit rationale (extremely rare); default true means anti-dilution v2 passed.
   - `region: "US"|"EU"|"UK"|"ASIA"|"CHINA"|"JAPAN"|"ETF"` — used for diversification floor advisory (5 US + 2 EU + 1 APAC + 2 ETFs).
   - `earnings_source: "8k_item_202"` — **BLOQUANT (gate G4)**. La date de résultats DOIT venir du dépôt 8-K item 2.02, jamais du champ calendrier prévisionnel. Le 20260730 ce champ a laissé passer 10 titres ayant déjà publié (F, AWK, EXR, REG, FE, CNC, IVZ + LYV/KKR/OWL/RAL le jour même).
3a-bis. **`_pipelineOrder` block (MANDATORY, top-level — gate G4 bloquant à partir du 2026-07-31)** — preuve que le filtre résultats a tourné sur le vivier COMPLET **avant** toute salve d'enrichissement par ticker (doctrine `perf-parallel-mcp` R2 : calendrier + 8-K en **Vague 1**, enrichissement en Vague 3) :
   ```json
   "_pipelineOrder": {
     "earnings_screened_at": "2026-07-30T20:05:00Z",
     "enrichment_started_at": "2026-07-30T20:18:00Z",
     "candidates_screened": 39,
     "method": "8-K item 2.02 filing dates sur le vivier complet, avant toute salve enrichissement"
   }
   ```
   - `earnings_screened_at` **doit être strictement antérieur** à `enrichment_started_at`, sinon publication refusée.
   - `candidates_screened` doit couvrir le vivier complet (≥ 2× le nombre de lignes publiées), pas la sélection finale.
   - Raison d'être : le 20260730, le filtre résultats a tourné en Vague 3. F et PFE sont morts **après** avoir consommé leur enrichissement complet — ~15 min de reprise pure. La doctrine perf existait déjà et n'était pas appliquée ; ce gate la rend mécanique.
3b. **`_memoryImpact` block (MANDATORY, top-level in `signals.json`)** — records what Phase 0.8 retrieval actually did to this scan's decisions, for audit + weekly retro consumption:
   ```json
   "_memoryImpact": {
     "rules_applied": ["rule-id-1", "rule-id-2"],
     "decision_changed": false,
     "sizing_delta": 0,
     "reason": "1-2 sentences: which retrieved rule(s)/risk(s) nudged confidence, sizing, or added a tag, and on which ticker(s). If nothing from retrieval changed anything this scan, say so explicitly (e.g. \"no active_rules/known_risks materially changed the top 10 selection\")."
   }
   ```
   - `rules_applied`: ids from `active_rules`/`known_risks` (per `lessons-retrieve.js` output) that actually influenced a selection/sizing/tag decision this scan. Empty array is valid.
   - `decision_changed`: `true` only if a candidate's inclusion/exclusion was influenced by memory — and even then, per the absolute principle above, memory can only have acted as a tie-breaker/filter AFTER the quantitative screen, never as the sole reason a candidate was added.
   - `sizing_delta`: numeric multiplier or percentage-point adjustment applied to position sizing because of a retrieved rule (0 if none).
   - `reason`: free text, human-auditable.
4. Strategy labels ONLY: Momentum, Breakout, Pullback, Pre-Squeeze
5. R/R calculated from entry MIDPOINT (not entry_low) — must respect regime-based minimum per `scanner-lessons.json#rr-min-by-regime`: RISK-ON 1.5, RECOVERY/NEUTRAL 1.7, EARLY RISK-OFF/RISK-OFF 2.0.
6. **VWAP entry gate (always-on, not grid-searched)** — validated +29% PnL, +16pp WR, 2.5× PF (commit 91596bd9):
   - Effective entry = `min(open_next_session, VWAP_next_session)` clamped to `day_low` (no-lookahead)
   - Skip gap-up traps: if `open > entry_high × 1.02`, only fill at VWAP pullback
   - Display VWAP value in setup card AND status table (commit 58bac3bb)
   - Applied uniformly across `sweep.js`, `signal-monitor.js`, status page how-to-trade, portfolio API

## Phase 4 — Render & Publish (LOCAL — rien ne devient public ici)

```bash
node tools/render-scanner.js scanner/YYYYMMDD/ --strict   # bloque si data.json désaccentué/tronqué (garde qualité amont)
node tools/check-freshness.js scanner/YYYYMMDD/harness.json   # exit 1 = publication INTERDITE
node tools/qa-check.js                                        # lit signals.json, pas le HTML — 0 ❌ exigé
node tools/publish.js --type scanner --path scanner/YYYYMMDD/index.html --no-notify --no-push
```

⚠️ **`--no-push` est obligatoire, et ce n'est pas du confort.** Le panel adversarial passe en
Phase 6, donc APRÈS. Sans lui, la page est déjà en ligne quand le panel la refuse et la Phase 8
n'est plus qu'un décor. `publish.js` indexe, valide le contenu et commite **en local** ; la mise
en ligne est une décision de Phase 8. N'ajoute aucun `git push` ici.

If publish validation fails (filter violations), return to Phase 2 with the specific violations and re-select.

## Phase 5 — Downstream Pipeline (skip with --skip-downstream)

### ⚡ Coupure CALCUL / DIFFUSION — `tools/downstream-split.sh` (obligatoire depuis 2026-08-11)

**N'enchaîne plus le downstream en une seule coulée qui finit par un `git push`.** Le panel de
la Phase 6 juge le contenu ; le downstream ne le modifie pas. Les deux tournent donc ENSEMBLE
— 8 à 12 min de mur en moins. Mais paralléliser le downstream *entier* serait une faute : il
contient des actions irréversibles. D'où la coupure, et l'ordre réel des phases :

```
Phase 4  publish.js --no-push --no-notify          ← indexe et commite EN LOCAL, rien de public
Phase 5A  bash tools/downstream-split.sh compute <DATE> <ASOF>   ┐ MÊME parallel()
Phase 6   les 7 relecteurs adversariaux                          ┘ que le calcul
Phase 7   arbitrage : corrections + rejeu conditionnel du compute
Phase 8   bash tools/downstream-split.sh distribute <DATE>  → image, push, Telegram
```

- `compute` = ingestion dtx (decide **et** replay), history-append, pont `dtx_pool`,
  `gen-status-page`, puis `gen-api` / `gen-mode-cards` / `daily-synthesis` en parallèle, et
  `qa-check`. **Local, idempotent, rejouable autant de fois qu'il faut.** Il prend un verrou :
  `/desk` et `/scanner` écrivent les mêmes fichiers, deux `gen-status-page` simultanés
  corrompent SANS lever d'erreur. S'il annonce qu'il attend, laisse-le attendre.
- `distribute` = `publish-daily-card.sh --no-sweep --no-telegram` (image + QA + push).
  **Après le verdict, jamais avant.** Coût d'un panel qui refuse : recalculer des fichiers
  locaux, 1 à 2 min. On ne retire pas un message déjà parti.
- **Ce que `compute` ne contient PAS, et qui reste à lancer avant lui** (une seule fois, pas
  rejoué après une correction, car indépendant du contenu publié) : `update-tracking.js`,
  `sweep.js --quick`, puis `refresh-risk-metrics.js --ingest /tmp/risk-mcp.json`.

**Rejouer `compute` ou non — un seul critère, et il est mécanique.** Le constat du panel
touche-t-il `data.json` ou `signals.json` ?

```bash
shasum -a 256 scanner/YYYYMMDD/data.json scanner/YYYYMMDD/signals.json > /tmp/scan-hash-before.txt
# … corrections du panel, re-render, re-validation …
shasum -a 256 scanner/YYYYMMDD/data.json scanner/YYYYMMDD/signals.json > /tmp/scan-hash-after.txt
diff /tmp/scan-hash-before.txt /tmp/scan-hash-after.txt   # différent → relancer compute
```

Niveau faux, R/R erroné, ticker retiré → les artefacts dérivés décrivent un scan qui n'existe
plus, **relance `compute`**. Tournure, lien, réserve éditoriale → ils sont intacts, ne le
relance pas. `qa-check.js` tranche de la même façon : il lit `signals.json`, pas le HTML.

⚠️ Les relecteurs de la Phase 6 **ne modifient aucun fichier** pendant que `compute` tourne —
ils lisent et rapportent, l'arbitrage corrige. La seule clé que `compute` réécrit dans
`signals.json` est `dtx_pool` (vivier du moteur scripté, hors sélection publiée) et cette
écriture est atomique (tmp + rename) : aucun relecteur ne peut lire un JSON tronqué.

**⚡ Doctrine « le MCP fait foi » (OAuth2, ZÉRO token) : un subprocess `node` NE PEUT PAS appeler le MCP. Donc l'AGENT (toi) appelle le MCP, écrit des JSON, et les scripts INGÈRENT. Ça évite les 3 bugs d'aujourd'hui (risk-metrics auth-fail, Telegram token-fail, sweep re-run redondant).**

Détail des commandes que `downstream-split.sh` enchaîne pour toi (le sweep tourne UNE SEULE fois — `publish-daily-card.sh` reçoit `--no-sweep`) :
```bash
node tools/update-tracking.js                                                # Yahoo prices → exit triggers (pas de MCP)
node tools/sweep.js                                                          # Append-only: closed trades + advisor_* (LENT ~5-7 min, CPU-bound — normal)

# ── refresh-risk-metrics : VOIE --ingest (MCP connecté). NE PAS utiliser MCP_GATEWAY_URL (auth-fail
#    "Authorization required", pas du JSON). L'AGENT produit risk-mcp.json AVANT :
#    1) GetMarketContext(facets="regime", model="ensemble", horizon_days=5) → bloc regimeProbability
#    2) pour CHAQUE mode AVEC positions ouvertes (voir scanner/status/history/<latest>.json) :
#       PortfolioRisk(action="var"/"stress") → modes{<id>}. Modes à 0 position = omis (→ no_positions auto).
#    Corrélation : souvent cassée serveur ("0 common trading days") et EU (.PA) casse le calc → US-only,
#    sinon fallback concentration manuelle (max 2/secteur). N'INVENTE JAMAIS de VaR.
node tools/refresh-risk-metrics.js --ingest /tmp/risk-mcp.json               # écrit data/risk-snapshots.json (non-stub)

node tools/gen-status-page.js                                                # Snapshot J + dashboard (6 modes)
node tools/gen-mode-cards.js                                                 # Per-mode PNG cards (6 modes)
node tools/gen-api.js                                                        # Refresh 100+ public JSON endpoints
node tools/daily-synthesis.js                                               # Per-mode synthesis: entries / exits / equity move
node tools/dtx-pool-bridge.js --folder YYYYMMDD --date YYYY-MM-DD            # dtx CREATE (6 modes systematic) → dtx_pool[] dans signals.json

# Push + QA SANS notif token-based ; le sweep n'est PAS relancé :
bash tools/publish-daily-card.sh --no-sweep --no-telegram                    # image + git push + QA (Step 7)

# ── Telegram : VIA LE MCP notification connecté (envoyé par l'AGENT), pas par le shell.
#    send_message(to="alerts", format="html", body="<b>…</b>…", ...) — HTML uniquement (pas de **markdown**),
#    AUCUN terme interne (pas de "MCP"/"dtx"/noms de scripts), voix éditoriale (EDITORIAL_STYLE.md).
```

> ⚠️ **`candlestick`/mode « bull » = SUPPRIMÉ (été 2026).** Ne PAS le rappeler dans le pipeline (plus de `candlestick-scanner.js`, plus de staging candlestick). Idem `refresh-risk-metrics` sans token = stub inutile.
> ⚠️ **dtx (6 modes systematic) — DECIDE *ET* REPLAY OBLIGATOIRES (incident 2026-07-23).** Pour CHAQUE config (`DtxListConfigs`), l'AGENT appelle **les DEUX** : `DtxDecide(portfolio, asof=J+1, expected_data_date=<dernière clôture>, balances)` (→ ordres) **ET** `DtxReplay(portfolio, from=2021-01-01, to=J+1)` (→ courbe backtest + métriques). Puis ingest **avec les deux** : `node tools/dtx-mcp-ingest.js --portfolio <id> --decide <file> --replay <file> --from 2021-01-01 --to <statusSince> --asof YYYY-MM-DD`. **⛔ `--decide` SEUL ne suffit PAS** : sans `--replay`, le staging a `metrics`/`equity` vides (`stateless:true`), le bloc splice backtest+live de `gen-status-page` (L~902) est SAUTÉ, et le dashboard retombe sur un placeholder frozen figé (−1,24 % / 0 trade) — c'est exactement le bug du 23/07 (staging decide-only). **⚠️ SATURATION ORIGINE** : batcher les `DtxReplay`/`DtxDecide` par **lots de ≤3** (au-delà → 502 bad gateway), poller `DtxJobStatus`, back-off 60 s sur 502. 0 ordre CREATE = LÉGITIME (setup non déclenché), mais le REPLAY doit quand même être ingéré pour la courbe. Voir skill `scanner-pipeline` §"dtx refresh" step 3.
> ⚠️ **Aucune exécution broker dans /scanner.** Le pipeline s'arrête à la publication + dashboards + notification. `run-session` reste manuel — on ne trade JAMAIS du réel depuis le scanner.
> ⚠️ **Connector `marketdata` instable** (redéploiements serveur) : peut se déregistrer après quelques appels → l'utilisateur relance `/mcp`. Batcher agressivement (max de données par salve), les gros payloads débordent en fichiers `tool-results` → parser en jq/node, pas re-fetch. `capital_flow` n'est PAS un data_type valide — utiliser `dark_pool,unusual_options,trading_signals,insider_transactions`.

### Phase 5b — Regime Recalibration (optional, run weekly OR on regime shift)

Append-only mode-parameter recalibration. Detects significant regime change vs `data/modes-config.json#_regime` and proposes new params from `advisor_*` fields:

```bash
node tools/regime-recalibrate.js                      # dry-run report
node tools/regime-recalibrate.js --apply              # apply (append to config-history.json)
node tools/regime-recalibrate.js --force --apply      # bypass stability gate
```

**Behavior**: detects dominant regime in last 7 scanner runs, requires 3 consecutive stable days at new regime before triggering. NEVER overwrites history — appends new version to `portfolio/v1/config-history.json` with bumped `_version` and tags `triggered_by`. `modes-config.json` gets the new params with `_prevVersion` chain.

⚠️ Prerequisites: `data/backtest-results.json` must contain non-null `advisor_<mode>` fields. If sweep strict thresholds aren't met, advisor falls back to `advisor_<mode>_relaxed`. TKL needs `advisor_tkl` populated (sweep.js advTkl array — see audit `.omc/audit-20260502/dev.md` for status).

### Phase 5c — Rolling Walk-Forward Sanity Check (optional, ad-hoc)

```bash
node tools/rolling-walk-forward.js                    # rolling 10-day window
node tools/rolling-walk-forward.js --days=20          # rolling 20-day window
```

Outputs `data/rolling-walk-forward.json` + markdown summary. Per-mode rolling-N-day WR/PF/Ret time series. Caveat: small sample sizes (~9 weeks of data) limit statistical power — use for direction-of-travel signal only.

⚠️ **refresh-risk-metrics = voie `--ingest` (MCP connecté).** NE PAS compter sur `MCP_GATEWAY_URL` en local : le MCP est OAuth2 ZÉRO token → un subprocess node reçoit "Authorization required" (pas du JSON) et écrit des nulls. L'AGENT appelle `GetMarketContext(facets=regime)` + `PortfolioRisk` (modes avec positions), écrit `risk-mcp.json`, puis `refresh-risk-metrics.js --ingest`. `MCP_GATEWAY_URL` direct reste réservé aux routines cloud qui ONT un token injecté. Jamais `--stub` (schéma vide).

### Post-Pipeline Checklist
- QA check (`tools/qa-check.js`, step 7 of publish-daily-card.sh) must show 0 ❌. Investigate every failure (not only ⚠️). qa-check reads `signals.json` (NOT the HTML).
- `scanner/status/index.html` per mode: no stale "Pending (Nd/Md)" on trades whose `exitDate` is past. "Orders to Place" count cohérent avec rangées affichées (filter applies execution-day-only — commit 0fd444af).
- `data/risk-snapshots.json` — non-stub via `--ingest` : `source:"ingest:mcp_connected"`, `regimeProbability` peuplé (depuis GetMarketContext), modes à 0 position = `{reason:"no_positions"}` (correct, pas un échec), modes AVEC positions = VaR agent-fed ou `awaiting_mcp` si non fourni
- signals.json strategy labels match `data.json` setup labels
- **Stats consistency** for ALL 6 modes (`turbo`, `dynamic`, `balanced`, `secured`, `fortress`, `tkl`):
  - Hero stats (Closed Trades, WR, PF, Return, DD) in `scanner/status/index.html` match `frozen_*` values in `data/backtest-results.json`
  - Trade History count = hero "Closed Trades" (same `closedTrades.filter(!_premature).length` filter)
  - Mismatch → re-run `node tools/gen-status-page.js`
- **API consistency**: `portfolio/v1/{mode}/equity.json` contains non-null stats for all 6 modes after `gen-api.js`
- **Trade integrity** in `data/backtest-trades.json`:
  - Zero same-day expired trades (`holdDays===1 && status==='expired' && entryDate===exitDate`)
  - Zero early-expired trades (`holdDays < mode.horizon && status==='expired'`)
- **Sweep timing**: sweep.js returns null for trades without enough forward data (`lastDate < expireDate`). Safe — simulated on next run when more OHLC bars arrive.
- **TKL pool**: `modes-config.json#tklPoolEnabled` per-mode gate respected. Time Machine backfill present in `scanner/status/history/*.json` (commit 4a39aea3).
- **BSD date fallback**: any `date -d` in shell scripts must have BSD `date -v` fallback (publish-daily-card.sh helper).

## Phase 6 — Multi-Agent Validation (skip UNIQUEMENT en interactif avec accord user)

**Deux invariants NON négociables, même en fast-path :** (1) le panel senior-review tourne AVANT le push final de la session de scan ; (2) `data.json#engine_meta.risk_gating` doit porter les champs réels (ensemble_confidence, crisis_prob_5d, max_pair_correlation, avg_off_diagonal_correlation, sizing) — un bloc vide = le risk gating de Phase 2 n'a pas tourné = scan NON conforme (garde qa-check `risk_gating non vide`).


Spawn 7 parallel validation agents:

| Agent | Role | Focus |
|-------|------|-------|
| Trader | Trade quality | Entry/stop/TP realism, R/R, tradability |
| Risk | Portfolio risk | Duplicates, diversification, correlation, DD exposure |
| Quant | Quantitative rigor | Score justification, R/R math, confluence independence |
| Analyst | Macro/fundamental | Regime coherence, catalysts, sector rotation logic |
| QA | Data integrity | Schema compliance, cross-file consistency, pipeline outputs |
| Dev | Code quality | HTML validity, script loading, performance |
| UX | User experience | Layout, mobile, charts, navigation, accessibility |

Each agent returns PASS/WARN/FAIL per check area with required fixes.

## Phase 7 — Fix & Re-Verify (if Phase 6 finds issues)

1. Collect all FAIL and WARN items from 7 agents
2. Fix data.json for content issues (scores, R/R, strategy labels, factual errors)
3. Re-render HTML: `node tools/render-scanner.js scanner/YYYYMMDD/`
4. Re-run publish validation
5. Re-spawn failing agents to verify fixes
6. Iterate until all agents return PASS (max 3 iterations)

## Phase 8 — Final Commit & Notify

C'est ici — et **seulement** ici — que quelque chose devient public. Tout ce qui précède est
local et défaisable ; à partir de cette ligne, plus rien ne se rétracte.

```bash
bash tools/downstream-split.sh distribute YYYYMMDD   # image + QA avant push + commit + push
```

`distribute` appelle `publish-daily-card.sh --no-sweep --no-telegram` : image, QA **avant** le
push, commit, push — mais **PAS le Telegram** (envoyé par l'AGENT via le MCP notification).

⚠️ Avec `--no-sweep`, `publish-daily-card.sh` ne stage que la carte, `scanner-metrics.json` et
`scanner-positions.json`. Les artefacts recalculés par `compute` doivent être ajoutés à la
main, de façon CIBLÉE (jamais `-A`) :

```bash
git add scanner/YYYYMMDD/ data/scanner.json data/scanner-history.json
git add scanner/status/ portfolio/v1/
git add data/backtest-results.json data/backtest-trades.json data/risk-snapshots.json data/dtx/
git commit -m "feat: scanner YYYYMMDD — auto-published"
git push origin main
```

Le `git push` de `distribute` emporte aussi le commit local laissé par `publish.js --no-push`
en Phase 4 — c'est voulu, il n'y a qu'un seul moment de mise en ligne. Si `--skip-downstream`
a été utilisé, ni `compute` ni `distribute` n'ont tourné : le commit + push ci-dessus est
alors entièrement à ta charge.

## Error Handling
- MCP screener returns empty → use GetMarketContext(facets="overview") top movers + manual candidate selection
- DSL screener scores all 0 → ignore DSL results, rely on AutoScreener only
- EU screener empty → fill EU slots from GetMarketContext(facets="overview") EU movers or known EU large-caps
- Sweep timeout → continue pipeline, sweep is not blocking
- Telegram notification fails → log warning, do not block
- refresh-risk-metrics.js: **voie `--ingest` (MCP connecté)**. En local, un subprocess node ne peut pas s'authentifier au MCP OAuth2 (auth-fail) → l'AGENT fournit les données. La corrélation MCP peut être cassée côté serveur ("0 common trading days", et EU `.PA` mélangés cassent le calc) → US-only + fallback concentration manuelle (max 2/secteur). NE JAMAIS inventer de VaR/corrélation.
- Phase 6 validation loops > 3 → stop, report remaining issues to user
- TKL pool empty (Time Machine backfill missing) → re-run scanner with `--date YYYYMMDD` to populate `scanner/status/history/YYYYMMDD.json`
