---
name: scanner-pipeline
description: Scanner daily pipeline + risk gating + parametric optimization. Auto-load when user says scanner, scan du jour, sweep, regime, risk gating, optimize-param, dilution, Sharia, or works in scanner/**, tools/sweep.js, tools/optimize-param.js. Includes Mountain Plateau methodology, anti-patterns, append-only pipeline.
user_invocable: false
---

# Scanner / Scan du jour

## ⛔ NO-SKIP POLICY (CRITICAL)

JAMAIS skipper une étape du pipeline (anti-dilution, MCP enrichment per ticker, risk gating, earnings/economic event proximity, validation) sans accord explicite du user. Token/temps ≠ raison valable. Si une étape semble trop coûteuse, demander explicitement avant. Default = exécution complète.

## ✅ MCP DSL Syntax — Bons appels (verified)

- Variables : `rsi14`, `ema20/50/200`, `sma50`, `sma200`, `vwap`, `bbw`, `hhv20/50`, `llv20/50`, `atrpct`, `obvz`, `vol`
- Fonctions (série quotée) : `sma('close',50)`, `ema('close',20)`, `rsi('close',14)`, `atr(14)`, `hhv('close',50)`, `pct_change('vwap',3)`
- Patterns : `cross_up('ema20','ema50')`, `rising('ema50',10)`, `vol_spike45(1.5)`, `near_breakout(0.02)`, `is_cup_handle()`
- Context : `market_cap`, `avg_volume`, `asset_type`, `sector`, `industry`, `country`, `in_index`, `themes`
- Calendar : `days_until_earnings('AAPL') <= 3`, `is_near_economic_event('USD', 3, 2)`
- Relative strength : `perf_rank('sector', '', 20) <= 5` (max 3 args après kind), `perf_rel('sector', '', 20)` (no bench sauf kind='etf')
- Macro : `vix()`, `regime_score()`
- Multi-asset : `security('SPY','1d','close',1)`, `benchmark('SPY')`

⚠️ INVALID : `sma(close,50)` (manque quotes), `ma(close,50)` (fonction inexistante), `asset_type=='etf'` dans pass_expr — utiliser param `asset='etf'` séparé.

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

**Collecte MCP** : `RunAutoScreener` + `RunScreener` (3 DSL + EU + APAC + ETFs) + `GetMarketOverview` (trending, sectors, calendar) + `GetRegimeProbability` (model=ensemble, horizon=5) + `QueryData` (quote, **social_sentiment, capital_flow, insider_transactions, dark_pool, unusual_options, ftd_threshold, sec_filings, flags**) pour candidats

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

**Sélection : 10 setups A+** (score ≥ **90**, confluence ≥ 3 signaux, géo : min 5 US + 2 EU + 1 APAC + 2 ETFs)

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

**Titre carte OBLIGATOIRE** : `Top 10 A+ {REGIME} — {TICKER1}, ..., {TICKER10}`

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
node tools/candlestick-scanner.js --output signals  # AB candlestick signals → signals.json (bull mode)
node tools/sweep.js                     # Append-only: nouveaux trades fermés
node tools/refresh-risk-metrics.js      # VaR + stress + correlation + regimeProb (MCP OAuth2)
node tools/gen-status-page.js           # Snapshot J + Dashboard
node tools/gen-api.js                   # Refresh public JSONs (50 endpoints)
node tools/trading-executor/run-session.js  # Generate plans + execute
```
Après le push, envoyer les notifications via **MCP Notification** :
```
send_batch([
  { to: "scanner-{mode}", body: "🔍 Scanner {DATE} — {N} picks\n\n{résumé par mode}\n\nhttps://articles.dailytickers.com/scanner/{YYYYMMDD}/" }
  // un message par mode actif (turbo, dynamic, balanced, orbit, fortress, tkl)
])
```
Les MCPs (DailyTickers, Notification, Memory) sont enregistrés via OAuth2 — aucun token en .env nécessaire.

**Post-pipeline checklist OBLIGATOIRE** :
- QA check (`tools/qa-check.js`) doit afficher 0 ❌
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
