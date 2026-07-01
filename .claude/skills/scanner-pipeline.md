---
name: scanner-pipeline
description: Scanner daily pipeline + risk gating + parametric optimization. Auto-load when user says scanner, scan du jour, sweep, regime, risk gating, optimize-param, dilution, Sharia, or works in scanner/**, tools/sweep.js, tools/optimize-param.js. Includes Mountain Plateau methodology, anti-patterns, append-only pipeline.
user_invocable: false
---

# Scanner / Scan du jour

## ⛔ NO-SKIP POLICY (CRITICAL)

JAMAIS skipper une étape du pipeline (anti-dilution, MCP enrichment per ticker, risk gating, earnings/economic event proximity, validation) sans accord explicite du user. Token/temps ≠ raison valable. Si une étape semble trop coûteuse, demander explicitement avant. Default = exécution complète.

## ✅ MCP DSL Syntax — Référence (source: `GetDSLDescription`, vérifié 2026-06-25)

### Séries numériques (utilisables dans pass_expr ET score_expr)
`close`, `open`, `high`, `low`, `vol` (alias `volume`), `hlc3`, `ema20`, `ema50`, `ema200`, `atr14`, `atrpct`, `rsi14`, `obvz`, `bbw`, `hhv20`, `llv20`, `hhv50`, `llv50`, `vwap`, `vwapstd`, `px` (alias `ref`)

### Context (pass_expr uniquement pour comparaisons)
`market_cap` (alias `marketcap`), `avg_volume`, `asset_type`, `sector`, `industry`, `country`, `exchange`, `market_cap_category`, `consensus_price`, `in_index`, `themes`, `tags`

### Fonctions numériques (pass_expr ET score_expr)
- `sma('close',50)`, `ema('close',20)`, `rsi('close',14)`, `atr(14)`, `hhv('close',50)`, `llv('close',20)`
- `pct_change('vwap',3)`, `change_pct(5)`, `gap_pct()`
- `avg_vol(20)`, `slope('close',20)`, `trend_strength(20)`, `tf('close',20)`
- `entropy('close',20)`, `skewness('close',20)`, `kurtosis('close',20)`, `autocorr_sign('close',5)`
- `security('SPY','1d','close',1)`, `pxof('SPY','1d','close')`, `benchmark('SPY')`
- `vix()`, `regime_score()`
- `min(a,b)`, `max(a,b)`, `abs(x)`
- `near_sr_score()`, `vwap_band()`
- `days_until_earnings()`, `days_until_economic_event('USD',3)`

### Fonctions booléennes (pass_expr UNIQUEMENT — crashent dans score_expr)
- `cross_up('ema20','ema50')`, `cross_down(...)`, `cross_up_lookback('ema20','ema50',5)`
- `rising('ema50',10)`, `falling('vwap',5)`
- `near_breakout(0.02)`, `near_sr(1.5)`, `near_poc(0.05)`
- `vol_spike45(1.5)`, `vol_spike45_lookback(2.0,10)`
- `is_cup_handle()`, `is_hammer()`, `is_doji()`, `is_bullish_engulfing()`, `is_bearish_engulfing()`
- `inrange('rsi14',45,70,10)`, `between(x,min,max)`
- `price_le(50)`, `price_ge(200)`
- `theme_match('ai')`
- `rank('sector',5)`, `is_near_earnings()`, `is_near_economic_event('USD',3,2)`

### Relative strength (⚠️ pass_expr uniquement — `perf_rel` plante dans score_expr malgré retour float)
- `perf_rank('sector','',20) <= 5` — rang dans le groupe (1=meilleur)
- `perf_rel('sector','',40) > 0` — delta perf vs groupe (%)
- `perf_rel('etf','ai','QQQ',20)` — avec benchmark explicite
- `rank('sector',5)` — booléen top N
- `roc_sector(20)` — return moyen du secteur

### Gotchas vérifiés
- ⚠️ `perf_rel(...)` dans score_expr → "too many arguments" même avec args valides. Utiliser uniquement dans pass_expr.
- ⚠️ `sma(close,50)` → INVALIDE, quotes obligatoires : `sma('close',50)`
- ⚠️ `ma(close,50)` → fonction inexistante
- ⚠️ `asset_type=='etf'` dans pass_expr → utiliser param `asset='etf'` séparé
- ⚠️ Booléens dans score_expr → convertir : `(vol_spike45(1.5) ? 20 : 0)`

RunScreener params : `pass_expr`, `score_expr`, `region` ('us'/'eu'), `asset` ('stock' default ou 'etf'), `top_k`, `force_async=true` recommandé.

**Langue par défaut : anglais intermediate.** Voir `scanner/CLAUDE.md` pour le template complet, sections, méthodologie.

**⚠️ Convention de date :** Scanner couvre la **prochaine séance de trading**. Généré après 22h30 : dossier = D+1. **Vendredi soir → lundi (D+3).**

### Phase 0 — Preparation

1. **Lire scan précédent** pour filtre anti-doublon (min 70% nouveaux tickers)
2. **Lire `data/scanner-positions.json`** pour tickers bloqués (positions ouvertes)
3. **Lire `data/scanner-lessons.json`** — les 39 règles v2.0 sont le référentiel de sélection. La checklist complète est ci-dessous.
4. **Lire `data/retro-summary.json`** — grade trend, HR par stratégie × régime, meilleur/pire trade par régime. Identifier :
   - Quelle stratégie surperforme dans le régime actuel (ex: Pullback 80% HR en RISK-ON soutenu, Pre-Squeeze 70% en EARLY RISK-OFF)
   - Quelle stratégie sous-performe (ex: Breakout 0% en EARLY RISK-OFF, ForexMultiStrategy 0%)
   - Trajectoire des grades (tendance : amélioration ou plateau ?)
5. **Lire `data/scanner-filters.json`** pour sector_map + diversification rules
6. **Pre-flight gotchas** : lire `~/.claude/projects/.../memory/feedback_pipeline_gotchas.md`

### Phase 1 — MCP Data Collection

**Collecte MCP** : `RunAutoScreener` + **5 RunScreener DSL** (ci-dessous) + `GetMarketOverview` (trending, sectors, calendar) + `GetRegimeProbability` (model=ensemble, horizon=5) + `QueryData` (quote, **social_sentiment, capital_flow, insider_transactions, dark_pool, unusual_options, ftd_threshold, sec_filings, flags**) pour candidats

**⚠️ RunScreener — 5 queries obligatoires :**

🔴 **CRITIQUE (root cause du scan stub 20260701) — NE JAMAIS mettre `market_cap` dans `pass_expr`.**
Le screener évalue `market_cap` à **0** dans le contexte DSL → `market_cap > 10000000000` est **false pour TOUS** → **0 candidat silencieux** → scan mono-stratégie (Pullback-only) → 12 modes cassés. Vérifié 2026-07-01 : le DSL momentum "vérifié 06-25" renvoie **0** aujourd'hui ; en retirant `market_cap` il renvoie **40**. La mcap DOIT être **post-filtrée en code** sur les candidats retournés (chaque candidat porte `market_cap`), PAS gatée dans pass_expr.

**Réduction d'univers (perf)** : ne pas compter sur market_cap. Utiliser `vol > 1500000 and close > 10` dans pass_expr — filtre les penny/illiquides et garde les jobs US <30s en `force_async: true`.

**Post-filtrage OBLIGATOIRE en code sur les résultats** : `market_cap >= 2e9` + exclure ETF (`market_cap == 0` OU tickers IWX/FAI/IJR/BIL/VTEB/XHB/XLV/MUB/KRE/SHV/SGOV/MOAT/IUSV…) + exclure penny. Puis vérifier l'EMA-stack per-ticker via `QueryData types=technicals` si besoin.

🔴 **SMOKE-TEST OBLIGATOIRE** : après chaque query, si **< 10 candidats** (post-filtre) → le DSL est mal calibré, **ALERTER et ne PAS committer un scan mono-stratégie** sans le signaler explicitement. Voir mémoire `runscreener-dsl-calibration`.

1. **Momentum** (US, ~40 candidats) — corrigé + vérifié 2026-07-01 ✅ :
   ```
   pass_expr: "rsi14 > 53 and rsi14 < 70 and macd > 0 and vol > 1500000 and close > 10"
   score_expr: "rsi14 + (macd > 0 ? 15 : 0)"
   region: "us", top_k: 40, force_async: true   → puis post-filtre market_cap>=2e9 + no-ETF
   ```

2. **Pullback / Defensive** (US) — retirer market_cap du pass_expr :
   ```
   pass_expr: "rsi14 > 40 and rsi14 < 65 and ema20 > ema50 and atrpct < 2.5 and vol > 1500000 and close > 10"
   score_expr: "(65 - rsi14) * 1.5 + (2.5 - atrpct) * 20"
   region: "us", top_k: 25   → post-filtre market_cap>=2e9 + no-ETF
   ```

3. **Breakout** (US, ~40 candidats) — corrigé + vérifié 2026-07-01 ✅ (⚠️ `near_breakout(0.03)` = 1 seul argument, pas 2) :
   ```
   pass_expr: "near_breakout(0.03) and vol > 1500000 and rsi14 > 52 and rsi14 < 72 and close > 10"
   score_expr: "rsi14 + (vol_spike45(1.5) ? 20 : 0)"
   region: "us", top_k: 40, force_async: true   → post-filtre market_cap>=2e9 + no-ETF
   ```

4. **Oversold bounce** (US, 0 résultats si marché pas survendu — normal) — retirer market_cap :
   ```
   pass_expr: "rsi14 < 40 and ema50 > ema200 and vol > 1500000 and close > 10"
   score_expr: "(40 - rsi14) * 3 + obvz * 10"
   region: "us", top_k: 15   → post-filtre market_cap>=2e9 + no-ETF
   ```

5. **EU diversification** — retirer market_cap du pass_expr :
   ```
   pass_expr: "rsi14 > 45 and rsi14 < 75 and ema20 > ema50 and vol > 500000 and close > 5"
   score_expr: "(75 - rsi14) * 2 + obvz * 10"
   region: "eu", top_k: 15   → post-filtre market_cap>=1e9 + no-ETF
   ```

Les queries 1+2 produisent **20-30 candidats** dans toutes les conditions de marché. Les queries 3+4 complètent l'univers quand les conditions le permettent (squeeze/survente). La query 5 apporte la diversification géographique. **Pool total attendu : 25-50 candidats uniques** avant dedup + filtering Phase 2.

**⚠️ Safety check** : si TOUS les résultats RunScreener ont `market_cap < 500000000` → le screener est cassé → STOP + alerter le user. Ne JAMAIS ignorer des résultats full-penny-stock.

**Assemblage pool** : merge les 5 résultats + RunAutoScreener → dedup par ticker → rejeter tout candidat avec market_cap < $2B → enrichir top 30 via QueryData

### ⚠️ Multi-List Output Format (OBLIGATOIRE depuis 2026-06-30)

Le scanner produit **5 listes** dans `signals.json` :
- `momentum[]` — top 10 momentum (EMA stack, RSI 55-80, vol surge)
- `breakout[]` — top 10 breakout (near_breakout, BBW squeeze, vol spike)
- `pullback[]` — top 10 pullback (RSI < 45, above EMA200, near support)
- `pre_squeeze[]` — top 10 pre-squeeze (low ATR%, tight BBW, above EMA50)
- `signals[]` — **composite top 10** (meilleur de chaque pool, diversifié secteur/géo)

Chaque signal dans les pools a la même shape que les signaux classiques (ticker, score, strategy, entry, stop, tp1, tp2, rr, thesis, sharia, region, etc.).

**Règles d'assemblage multi-list :**
1. Chaque screener alimente directement son pool (Momentum screener → `momentum[]`)
2. Les candidats passent la validation complète Phase 2 (dilution, earnings, Sharia, scoring)
3. Le `signals[]` composite est construit APRÈS les pools : pick les meilleurs de chaque pool en respectant la diversification (max 3/secteur, min 5 US + 2 EU)
4. Un ticker peut apparaître dans 1 pool + le composite, mais jamais dans 2 pools différents
5. `scanner-parser.js:loadSignals()` fusionne les pools dans `signals` pour backward compat (sweep.js, gen-api.js, etc.)

**HTML multi-list :** La page scanner affiche 5 sections :
- Section "Top 10 Composite" avec la table synthèse classique + setup cards
- 4 sections "Strategy Focus" (Momentum / Breakout / Pullback / Pre-Squeeze) avec mini-tables + thesis résumée
- Les setup cards détaillés ne sont générés que pour le Top 10 composite

### Phase 2 — Ticker Selection & Validation

**⚠️ Dilution Filter v2 MCP-driven (OBLIGATOIRE)** : `QueryData types=sec_filings,flags days=180` par candidat. Disqualification :
   - `flags.dilution_risk_score >= 70` ou `flags.shelf_active=true` + S-3 récent
   - `flags.atm_program_active=true` ou `flags.aggressive_underwriter=true` (Wainwright, Maxim, Dawson James, Roth, Ladenburg)
   - `flags.warrants_outstanding` ITM imminents (proximity < 0.20)
   - `flags.recent_pipe` (< 180j) ou `flags.reverse_split_recent` (< 180j)
   - Score 40-69 → **-15 pts + flag obligatoire dans Invalidations**

**⚠️ Risk Gating Post-Screener (OBLIGATOIRE — Risk Layer v1)** :
   - `GetRegimeProbability` : si `crisis > 0.30` ou `early_risk_off > 0.50` → top réduit à 5, breakout_only, taille × 0.5
   - `GetCorrelationMatrix` (window=60) : `max_pair.rho > 0.85` → drop le score le plus bas ; `avg_off_diagonal > 0.65` → forcer min 2 secteurs
   - `GetEarningsCalendarFiltered` (days_ahead=7, min_expected_move=4) : ticker dans `exclusion_window` → DISQUALIFIER ou tag "earnings risk"
   - `OptimizeSizing` (mode=balanced, method=vol_target, max_position_risk_pct=1.0, max_pairwise_correlation=0.7)

**⚠️ Sharia Compliance Tagging (OBLIGATOIRE)** : conformité Sharia (secteur haram, dette/market cap > 33%, intérêts > 5% CA, ETFs levier/bonds). `data-sharia="true|false"` sur chaque `<tr>` + setup-card. Voir `scanner/CLAUDE.md`.

**Sélection multi-list :** 10 par pool stratégique (momentum, breakout, pullback, pre_squeeze) + 10 composite. Composite = meilleur de chaque pool diversifié (score ≥ **90**, confluence ≥ 3 signaux, géo : min 5 US + 2 EU + 1 APAC + 2 ETFs)

**⚠️ SCORING RULES (hard enforced by validate-scan.js since 2026-06-30) :**
- **Score max 98** — no perfect scores. Score reflects REALISTIC probability of TP1 hit.
- **R:R computed from TECHNICALS** — TP1 = nearest resistance/supply zone. NEVER reverse-engineer TP from a fixed R:R ratio. Each signal MUST have a unique R:R reflecting its individual technical setup.
- **Score inflation gate** — if >50% signals score ≥ 95, validation FAILS. In ERO, most signals should score 75-90.
- **Strategy caps by regime** — ERO: max 1 Pullback (need confidence ≥60%), 0 Breakout, max 4 Momentum. RISK-OFF: 0 Pullback, 0 Breakout, max 2 Momentum.
- **Penny stock block** — entry < $5 = auto-reject.
- **Candlestick signals** — allowed but MUST pass same stop (3-8%), sector, and Sharia gates as fundamental strategies.

**⚠️ Grille A+ empirique (cohorte 29 setups, juin 2026) — 4 ÉLIMINATOIRES obligatoires :**
Tout candidat A+ doit passer ces 4 gates. Échec sur 1 = plafond A (max 88/100).
1. **Guidance relevée** par le management au dernier trimestre (discriminant #1 : 100% des A+ l'ont)
2. **≥ 5 EPS beats consécutifs**
3. **PE forward < 35x** (exception documentée si monopole tech mondial + EPS growth >25% + PEG <2)
4. **Extension EMA20 ≤ 3%** (DECK lesson : 3.8% ext = seul A+ sous-performeur)

**Critères pondérés (score /100) :** PEG <1.5 (15pts), buyback actif (8pts), dividende (7pts), structure technique consolidation >3sem (20pts), R/R ≥2.5 (15pts), SEC 8-K/10-Q propre (15pts). A+ ≥ 92, A ≥ 88.
**Exclusion :** earnings dans 10 jours → "earnings play", pas swing A+.

### ⚠️ Phase 2b — VALIDATION GATE (OBLIGATOIRE AVANT Phase 3)

Après sélection des 10 candidats, CHAQUE signal passe la checklist v2.0.
- **HARD BLOCK** → disqualification immédiate, pas d'override
- **SELECTION FILTER** → disqualification sauf rationale documentée par signal
- **ADVISORY** → noter et ajuster sizing/thesis

**Si un signal est disqualifié, le remplacer par le candidat suivant et re-valider.**

### Pre-Flight Rule Checklist (scanner-lessons.json v2.0 — 39 règles)

#### HARD BLOCKS (auto-reject, aucun override)
- [ ] `stops-min-atr-multiple` : stop < 1.5× ATR(14) OU stop_pct < 3% OU stop_pct > 8% → REJECT (toutes stratégies y compris Candlestick)
- [ ] `rr-min-by-regime` : R/R < seuil régime → REJECT. Seuils H10 : RISK-ON 1.5, NEUTRAL 1.5, EARLY RISK-OFF/RISK-OFF 2.0. Seuils H15+ : NEUTRAL 1.7, ERO/RO 2.0
- [ ] `regime-score-label-lag` : label diverge ≥ 2 niveaux du score (ex: label RISK-ON + score < 50 = NEUTRAL effectif) → REJECT scan. Score < 40 = EARLY RISK-OFF quel que soit le label
- [ ] `stopped-ticker-cooldown` : ticker stoppé dans les 3 derniers scans OU ticker dans 3+ scans consécutifs → REJECT
- [ ] `regime-override-ensemble-block` : override régime diverge > 0.2 de l'ensemble + catalyseur binaire ≤ 48h → REJECT override
- [ ] `no-short-squeeze-strategy` : stratégie Short Squeeze → REJECT. Autorisées : Momentum, Pre-Squeeze, Breakout, Pullback, Candlestick
- [ ] `entry-price-spot-validation` : |entry - spot| / spot > 0.10 → REJECT (cache stale, pre-split)
- [ ] `degenerate-band-rejection` : |entry - stop| / ATR14 < 0.5 → REJECT. close > TP1 → REJECT (entry stale)

#### SELECTION FILTERS (reject sauf rationale documentée)
- [ ] `tp1-horizon-calibration` : H10 → TP1 ≤ 1.5R. H15+ → TP1 ≤ 2.0R. Linkage régime-horizon : RISK-ON/NEUTRAL = H10, EARLY RISK-OFF/RISK-OFF = H15
- [ ] `min-composite-score` : score < 80 → REJECT du top 10
- [ ] `limit-high-beta-ai-infra` : distance_50dma > 2× cap stratégie OU RSI > 72 → REJECT. Max 1 AI infra en RECOVERY/ERO
- [ ] `earnings-window-strict` : earnings ±3j bourse → REJECT
- [ ] `dilution-block-toxic-underwriters` : S-1/S-3/424B < 90j + underwriter toxique → REJECT
- [ ] `diversification-floor` : max 3/secteur (hard), min 5 US + 2 EU + 1 APAC + 2 ETFs, max 3 repeats
- [ ] `high-score-low-rsi-conflict` : score ≥ 93 AND RSI < 55 → REJECT
- [ ] `rsi-no-mans-land-momentum` : Momentum AND RSI ∈ [40,50] → REJECT (sauf turbo)
- [ ] `tkl-momentum-quality-gate` : TKL pool AND (prix < $5 OU score < 88) → REJECT
- [ ] `energy-early-risk-off-block` : secteur Energy AND early_risk_off > 0.30 → REJECT
- [ ] `correlated-pool-exposure-cap` : score < 50 → max 1 crypto-momentum, max 2 metals
- [ ] `sector-regime-alignment` : secteur contre-thème dominant → score -= 10 à 15
- [ ] `winner-reentry-pullback-gate` : ticker top 3 rétro précédente AND pullback < 10% → REJECT
- [ ] `vix-defensive-tilt` : VIX > 28 → min 5/10 défensif/commodity/hedge. Suspendre tech momentum
- [ ] `open-portfolio-cap` : positions ouvertes ≥ 12 → max 5 nouveaux setups
- [ ] `breakout-early-risk-off-block` : early_risk_off > 0.40 AND Breakout → REJECT
- [ ] `regime-persistence-gate` : même régime 3+ sessions → caps Pullback (0% en ERO soutenu)
- [ ] `regime-rotation-penalty` : ≥ 2 changements régime en 5j → sizing ×0.7 + stops ×1.5 ATR
- [ ] `momentum-favored-risk-on` : RISK-ON soutenu ≥ 2j → Momentum 45%, Breakout 30%. EARLY RISK-OFF → Breakout 40%, Pullback 30%, Momentum 20%
- [ ] `pre-squeeze-early-risk-off` : EARLY RISK-OFF + compression vol → 25% Pre-Squeeze
- [ ] `pullback-regime-confidence-gate` : Pullback ET régime confidence < 60% → REJECT
- [ ] `mega-cap-regime-oscillation` : ≥ 2 rotations en 5j → mcap min $50B, commodity/small-cap max 1

#### ADVISORIES (biais sélection, déviation OK avec rationale)
- [ ] `repeat-pick-fatigue` : 3+ scans consécutifs → score -= 5 × (apparitions - 2)
- [ ] `trailing-stop-delay` : R/R ≥ 1:2.4 → trailing inactif avant 50% vers TP1
- [ ] `cyclicals-macro-context-gate` : Materials/Industrials breakout sans tailwind macro → score -= 10
- [ ] `same-day-strategy-cap` : EARLY RISK-OFF max 1 Pullback, tout régime max 2 même stratégie
- [ ] `gap-up-pullback-entry` : RISK-ON > 70 conf + gap-up > 1% → attendre pullback -0.3%
- [ ] `gap-up-preflight-phase2` : close > entry × 1.02 → ajuster entry au VWAP estimé J+1
- [ ] `high-atr-sizing-oscillating-regime` : ATR/prix > 4% + oscillation régime → sizing ×0.7

#### INFRASTRUCTURE (always-on, pas de check manuel)
- `vwap-entry-gate` : entry = min(open, VWAP) clamped day_low. Gap > 2% → VWAP pullback seul

### Phase 3 — Data Generation

**Titre carte OBLIGATOIRE** : `Top 10 A+ {REGIME} — {TICKER1}, ..., {TICKER10}` (composite)

**signals.json output format :**
```json
{
  "regime": "RISK-ON",
  "regimeScore": 86,
  "signals": [...],       // composite top 10 (fully enriched)
  "momentum": [...],      // top 10 momentum pool
  "breakout": [...],      // top 10 breakout pool
  "pullback": [...],      // top 10 pullback pool
  "pre_squeeze": [...],   // top 10 pre-squeeze pool
  "tkl_pool": [...],      // TKL momentum (separate pipeline)
  "crypto_pool": [...],   // crypto signals (separate pipeline)
  "metals_pool": [...],   // metals signals (separate pipeline)
  "forex_pool": [...]     // forex signals (separate pipeline)
}
```

**R/R et Horizon par régime (table harmonisée v2.0) :**
| Régime | Horizon | R/R min | TP1 max |
|--------|---------|---------|---------|
| RISK-ON | H10 | 1.5 | 1.5R |
| NEUTRAL | H10 | 1.5 | 1.5R |
| EARLY RISK-OFF | H15 | 2.0 | 2.0R |
| RISK-OFF | H15 | 2.0 | 2.0R |

### Phase 4 — Render & Publish

```bash
node tools/publish.js --type scanner --path scanner/YYYYMMDD/index.html --no-notify
```

## Pipeline Quotidien (Append-only) — ⚠️ AUTOMATIQUE, NE JAMAIS DEMANDER

Après chaque scanner publié, lancer pipeline complet **sans demander confirmation** :
```bash
node tools/update-tracking.js           # Tracking exits (prix Yahoo)
node tools/candlestick-scanner.js --output signals --source yahoo --date YYYYMMDD --folder YYYYMMDD  # AB candlestick signals → bull[] in signals.json. --date = last trading day, --folder = scanner session folder
node tools/fractal-scanner.js --output signals --date YYYYMMDD --folder YYYYMMDD --min-score 35 --top 30  # AF default → signals.json (adaptive_fractal strategy)
node tools/fractal-scanner.js --output signals --date YYYYMMDD --folder YYYYMMDD --min-score 35 --top 30 --strategy highvol_breakout --universe americanbull  # HighVol mode signals
node tools/fractal-scanner.js --output signals --date YYYYMMDD --folder YYYYMMDD --min-score 35 --top 20 --strategy etf_momentum --universe etf  # ETF mode signals
node tools/trendline-scanner.js --output signals --folder YYYYMMDD --interval 1h --universe americanbull --min-score 40 --top 15  # Trendline mode (H1 bars, dedicated scanner)
node tools/trendline-scanner.js --output signals --folder YYYYMMDD --interval 4h --universe americanbull --min-score 40 --top 15  # Trendline mode (H4 bars)
node tools/casablanca-scanner.js --output signals --folder YYYYMMDD --min-score 20 --top 15  # Casablanca mode → casablanca_pool[] in signals.json
node tools/hybrid-scanner.js --output signals --date YYYYMMDD --folder YYYYMMDD  # Hybrid breadth analysis → signals.json (MegaCap signals if narrow rally)
node tools/sweep.js                     # Append-only: nouveaux trades fermés
node tools/refresh-risk-metrics.js      # VaR + stress + correlation + regimeProb (MCP OAuth2)
node tools/gen-status-page.js           # Snapshot J + Dashboard
node tools/gen-api.js                   # Refresh public JSONs (50 endpoints)
node tools/trading-executor/run-session.js  # Generate plans + execute
```

### ⛔ Fortress PM A+ Halal — ÉTAPE OBLIGATOIRE (entre sweep et refresh-risk)

**NE PAS SKIPPER.** Fortress est géré par le PM (toi), pas par sweep.js. Cette étape est
AI-driven (appels MCP), exécutée DANS le pipeline au même titre que les scripts node.
Le prompt opérationnel complet est dans `.claude/skills/fortress-pm.md` — le LIRE et l'APPLIQUER.

**Séquence DÉTERMINISTE — 7 étapes, dans cet ordre, TOUTES obligatoires :**

**F1. CHARGER LE BOOK** : Lire le BLOC §1 dans `.claude/skills/fortress-pm.md`. Ce bloc contient
les positions tenues, sorties, cash, et NET courant. C'est l'état mutable — le reste du prompt
(§0 à §9) sont les règles fixes.

**F2. RECALCULER LES PRIX LIVE** : Pour CHAQUE ticker du §1 (tenus + watchlist redéploiement) :
```
QueryData(symbol="{TICKER}", data_type="quote")        → prix live
QueryData(symbol="{TICKER}", data_type="technicals")   → EMA20, EMA10, EMA50, ATR14, RSI14
```
Recalculer l'extension EMA20 : `ext% = (price / ema20 - 1) × 100`.
Recalculer le trailing stop : EMA20 si en gain, sinon stop initial.
**ZÉRO FABRICATION** : si QueryData échoue pour un ticker → le signaler, ne JAMAIS inventer.

**F3. JAUGE RÉGIME** :
```
QueryData(data_type="regime")                           → label + composantes + VIX
QueryData(data_type="performance_rotations")            → leaders vs laggards par secteur/industrie
```
Déterminer le MODE DU JOUR : DEPLOY / PYRAMIDE / DEFEND / RISK-OFF / RECOVERY (cf. §4).
Déterminer l'état moteur : CŒUR ON (toujours) / SATELLITE ON ou OFF (risk_on/recovery seulement).

**F4. GÉRER CHAQUE LIGNE** : Pour chaque position tenue, selon le mode du jour + rotation de
son groupe :
- Groupe MÈNE → trail EMA20, tenir / pyramider si pullback
- Groupe BASCULE LAGGARD → resserrer stop, préparer sortie
- Sous EMA20 close → SORTIR
- RSI extrême (>75) → partiel 33% + serrage
- Stall ≥4 jours → serrage 50%
Appliquer les ordres via broker MCP (paper) : `rb_paper_close_position` pour les sorties,
`rb_paper_modify_orders` pour les trailing stops.

**F5. REDÉPLOYER LE CASH** (si slots cash > 1 ET mode = DEPLOY ou RECOVERY) :
Exécuter le Step 0 scan A+ (§3.0 → §3.7) dans cet ordre STRICT :
1. §3.0 SHARIA : exclure riba / haram / ratios non conformes → `GetInstruments(symbol="{TICKER}")`
2. §3.1 ROTATION : identifier les groupes leaders via F3
3. §3.2 POOL : `RunScreener(pass_expr="rsi14>48 && rsi14<60 && macd>0 && vol>2500000", top_k=90)`
   → poll `CheckJobStatus` → post-filtre market_cap 2-20G$, leaders only, pas déjà au book
4. §3.3 LES 4 ÉLIMINATOIRES par ticker survivant :
   - ① Guidance relevée : `QueryData(symbol="{T}", data_type="earnings")`
   - ② ≥5 EPS beats : `QueryData(symbol="{T}", data_type="earnings_quarterly", limit=8)`
   - ③ PE fwd <35 : `QueryData(symbol="{T}", data_type="stats")` → forwardPE
   - ④ Extension EMA20 ≤3% : calculé depuis F2
5. §3.4 FLAGS : `QueryData(symbol="{T}", data_type="news")` + dilution check
6. §3.5 SCORING /100 → A+ ≥ 92
7. §3.7 WAR-ROOM : panel adverse (quant/PM/risk/short), vote ≥3/4 pour passer
Entrées via broker MCP : `rb_paper_place_orders` avec sizing §1bis (tier conviction/standard/starter).
Si aucun A+ ne qualifie en risk_on → cash excédentaire en ETF Sharia (SPUS/HLAL/UMMA) via §6.

**F6. RÉÉCRIRE LE BLOC §1** : Mettre à jour la section `## 1. ÉTAT DU BOOK` dans
`.claude/skills/fortress-pm.md` avec le nouvel état : positions tenues (ticker/entrée/mark/note),
sorties, cash, NET, MaxDD, slots libres. **Écrire via l'outil Edit**, pas manuellement.

**F7. DIGEST + NOTIFICATION** : Produire le digest §8bis (format compact) et l'envoyer :
```
send_message(to="scanner-fortress", body="<digest HTML>", format="html")
```
Format Telegram obligatoire : `<b>` pas `**`, `\n` pas `<br>`.

**Fortress ne passe PAS par sweep.js** — ses trades sont gérés ici par le PM via broker MCP.

Après le push, envoyer les notifications per-mode via le **générateur dédié** puis **MCP Notification** :
```bash
# 1. Génère les messages per-mode (lit modes-config + portfolio/v1/<mode>/all.json + signals.json)
node tools/gen-scanner-notifications.js --out    # écrit data/scanner-notifications.json
```
```
# 2. Passe le tableau data/scanner-notifications.json#messages TEL QUEL à send_batch :
send_batch(messages = <contenu de data/scanner-notifications.json#messages>)
```
- Chaque message = `{ to, format:"html", body }` déjà prêt (alias pré-configuré, HTML, \n). **Ne rien reformater.**
- Le générateur gère honnêtement : **Bull 0-signal** explique le gate 8× haute-conviction (pas cassé), **Fortress** montre l'univers Halal (☪, sharia===true), modes pleins expliquent pourquoi 0 nouveau candidat.
- **NE PAS** rédiger les messages à la main — le générateur garantit cohérence avec la status page (mêmes stats/positions/régime).
- Alias : `scanner-turbo/dynamic/balanced/orbit/fortress` sont pré-configurés. `scanner-bull`/`scanner-aplus` : créer via `set_alias` OU router vers `alerts` OU filtrer avec `--modes`.
- Les MCPs (DailyTickers, Notification, Memory) sont enregistrés via OAuth2 — aucun token en .env nécessaire.

**Post-pipeline checklist OBLIGATOIRE** :
- QA check (`tools/qa-check.js`) doit afficher 0 ❌
- ⚠️ **Mode Bull = haute-conviction, 0 signal est LÉGITIME les jours calmes** : `candlestick-scanner.js` ne qualifie un signal Bull que si un pattern chandelier a un **spike de volume ≥ 8× la moyenne 20j le jour du signal** (volume de CLÔTURE, parité systematic-tss config `americanbull` — PAS intraday J+1) + score ≥ 88 + dollar-volume ≥ $1M. Sur 5 ans : ~1 trade/sem (1061 trades, parité Go/JS validée). **Vérifié 2026-06-30** : sur 3512 tickers, 1 seul candidat (MESH) passe score+vol mais échoue la liquidité ($111k < $1M) → **0 ordre, identique au backtest Go**. Donc **0 signal Bull ≠ bug**. Le QA check vérifie le **marqueur `_candlestickScan`** (preuve que le scanner a tourné : `universeFetched`, `detectedPatterns`, `qualified`), PAS la présence de signaux. Le seuil 8× vit dans `data/scanner-filters.json#candlestick.min_vol_ratio_trading` (source de vérité, lu par sweep.js + gen-status-page.js). **Source des prix = `--source yahoo`** (défaut). **CRITIQUE** : `--date` = dernier jour de trading (pas la date du dossier si weekend). `--folder` = nom du dossier scanner (= prochaine séance). Le scanner DOIT tourner à chaque pipeline pour écrire le marqueur, même s'il qualifie 0.
- `scanner/status/index.html` : pas de "Pending (Nd/Md)" sur trades dont `exitDate` est passé
- `data/risk-snapshots.json` non-stub si MCP_GATEWAY_URL set
- QA strategy-label lit `signals.json` (pas HTML)
- `date -d` doit avoir fallback BSD `date -v`

## Optimisation Paramétrique — Méthode Plateau (ON-DEMAND)

```bash
node tools/optimize-param.js --mode balanced --all
node tools/optimize-param.js --mode balanced --param maxStopPct
node tools/optimize-param.js --mode balanced --param horizon --range 2,3,5,8,10
```

**Méthodologie "Mountain Plateau" (OBLIGATOIRE) :**
- **1 paramètre à la fois** — autres restent baseline
- **Plateau > pic** — zone stable (retour ≥ 85% du max), PAS le maximum
- **Centre du plateau** — valeur recommandée = centre zone stable
- **Stabilité ≥ 50%** — ignorer plateaux étroits (< 25% = overfitting)
- **Consistance cross-période** — vérifier sur sous-périodes
- **Assemblage** — combiner optima individuels, tester, ≥ 85% meilleur individuel
- **Fine-tuning** — micro-sweep ±1-2 steps
- **Validation** — full + stress + recent + param ±10%

**⚠️ ANTI-PATTERNS (INTERDITS) :**
- ❌ `sweep.js --full-sweep` pour config prod (26M combos = data snooping)
- ❌ Modifier plusieurs params simultanément
- ❌ CAGR max absolu (pic étroit = overfitting)
- ❌ Ignorer contradictions données réelles

**Ordre d'optimisation (impact décroissant) :**
1. portfolioSize / topN
2. maxStopPct / atrStopMult
3. horizon
4. dailyTrailPct / breakevenPct
5. filterName / minScore
6. rotation / partialTP / staleDays / entryGatePct

## Rétrospective Scanner

1. Lire tous scans de la semaine, extraire setups + OHLCV bars via `QueryData` (bars_daily)
2. Calculer outcomes : TP1 hit, stopped, pending, no-fill (VWAP gate)
3. Créer `scanner/retrospective/YYYYMMDD/index.html` (note A+ à F = 50% Setup HR + 50% Portfolio Sim)
4. Mettre à jour redirect `scanner/retrospective/index.html`
5. **Mettre à jour `data/retro-summary.json`** — ajouter la nouvelle rétro aux données agrégées. Ce fichier alimente les charts de tendance.
6. **Mettre à jour `data/scanner-lessons.json`** — ajouter/mettre à jour les règles issues des conclusions de la rétro. Bumper la version. Résoudre les open_questions si la rétro fournit des données.
7. **Indexer + Push** :
   ```bash
   node tools/publish.js --type retro --path scanner/retrospective/YYYYMMDD/index.html
   ```

**⚠️ Checklist post-rétro (OBLIGATOIRE) :**
- [ ] retro-summary.json contient la nouvelle rétro avec grade, HR, stats
- [ ] scanner-lessons.json bumped avec nouvelles règles ou mises à jour
- [ ] Redirect `scanner/retrospective/index.html` pointe vers la dernière rétro
- [ ] Carte ajoutée via `add_card.js`

## Analyses Refresh (à chaque run scanner)

À chaque exécution du pipeline `/scanner`, après la Phase 5 (downstream) et avant le commit final :

### Étape 1 — Grade Auto-Refresh (AUTOMATIQUE)
```bash
node tools/refresh-analyses.js --max-age 30 --commit
```
Rafraîchit toutes les analyses < 30 jours :
- Fetch prix courants via MCP Gateway (fallback Yahoo/allorigins)
- Re-évalue le grade basé sur : prix vs stop/entry/TP, R/R courant, signaux techniques
- Si grade change → met à jour le JSON, re-rend le HTML, ajoute badge `⬇ A+ → A` sur la carte
- Si trade complété (prix > TP2) → marque `status: completed` sans dégrader le grade
- Ajoute `gradeHistory[]` pour traçabilité
- `--dry` pour preview, `--tickers AAPL,MSFT` pour forcer des tickers spécifiques

### Étape 2 — Watchlist Deep Refresh (MANUEL, tickers critiques)
Fichier : `data/analyses-watchlist.json` — liste de tickers dont l'analyse doit être régénérée complètement.
```json
{ "tickers": ["ALT", "IOVA", "ALLR"], "frequency": "each_scanner_run" }
```

### Process par ticker (watchlist uniquement)
1. **Archiver** l'analyse existante : `mv analyses/{TICKER}/index.html analyses/{TICKER}/archive/YYYYMMDD/index.html`
2. **Collecter données fraîches** via MCP (`GetInstruments` + `QueryData types=sec_filings,flags,insider_transactions,news`)
3. **Générer** la nouvelle analyse en français niveau intermédiaire
4. **Mettre à jour la modale Historique** avec lien vers la version archivée
5. **Publier** : `node tools/publish.js --type analysis --path analyses/{TICKER}/index.html --no-notify`

### Contraintes
- **Versioning** : toujours archiver avant d'écraser
- **Pas de doublons** : vérifier `data/analyses.json` avant `add_card.js`
- **Qualité** : même standard que les analyses manuelles
- **Parallélisable** : les analyses sont indépendantes, lancer les agents en parallèle
