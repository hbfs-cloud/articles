---
name: scanner-pipeline
description: Scanner daily pipeline + risk gating + parametric optimization. Auto-load when user says scanner, scan du jour, sweep, regime, risk gating, optimize-param, dilution, Sharia, or works in scanner/**, tools/sweep.js, tools/optimize-param.js. Includes Mountain Plateau methodology, anti-patterns, append-only pipeline.
user_invocable: false
---

# Scanner / Scan du jour

**Langue par défaut : anglais intermediate.** Voir `scanner/CLAUDE.md` pour le template complet, sections, méthodologie.

**⚠️ Convention de date :** Scanner couvre la **prochaine séance de trading**. Généré après 22h30 : dossier = D+1. **Vendredi soir → lundi (D+3).**

1. **Lire TOUTES les rétrospectives** (`scanner/retrospective/YYYYMMDD/`) pour cumuler enseignements
2. **Lire scan précédent** pour filtre anti-doublon (min 70% nouveaux tickers)
3. **Collecte MCP** : `RunAutoScreener` + `RunScreener` (3 DSL + EU + APAC + ETFs) + `GetMarketOverview` (trending, sectors, calendar) + `GetRegimeProbability` (model=ensemble, horizon=5) + `QueryData` (quote, **social_sentiment, capital_flow, insider_transactions, dark_pool, unusual_options, ftd_threshold, sec_filings, flags**) pour 10 tickers retenus
4. **⚠️ Dilution Filter v2 MCP-driven (OBLIGATOIRE)** : `QueryData types=sec_filings,flags days=180` par candidat. Disqualification :
   - `flags.dilution_risk_score >= 70` ou `flags.shelf_active=true` + S-3 récent
   - `flags.atm_program_active=true` ou `flags.aggressive_underwriter=true` (Wainwright, Maxim, Dawson James, Roth, Ladenburg)
   - `flags.warrants_outstanding` ITM imminents (proximity < 0.20)
   - `flags.recent_pipe` (< 180j) ou `flags.reverse_split_recent` (< 180j)
   - Score 40-69 → **-15 pts + flag obligatoire dans Invalidations**
5. **⚠️ Risk Gating Post-Screener (OBLIGATOIRE — Risk Layer v1)** :
   - `GetRegimeProbability` : si `crisis > 0.30` ou `early_risk_off > 0.50` → top réduit à 5, breakout_only, taille × 0.5
   - `GetCorrelationMatrix` (window=60) : `max_pair.rho > 0.85` → drop le score le plus bas ; `avg_off_diagonal > 0.65` → forcer min 2 secteurs
   - `GetEarningsCalendarFiltered` (days_ahead=7, min_expected_move=4) : ticker dans `exclusion_window` → DISQUALIFIER ou tag "earnings risk"
   - `OptimizeSizing` (mode=balanced, method=vol_target, max_position_risk_pct=1.0, max_pairwise_correlation=0.7)
6. **⚠️ Sharia Compliance Tagging (OBLIGATOIRE)** : conformité Sharia (secteur haram, dette/market cap > 33%, intérêts > 5% CA, ETFs levier/bonds). `data-sharia="true|false"` sur chaque `<tr>` + setup-card. Voir `scanner/CLAUDE.md`.
7. **Sélection : 10 setups A+** (score ≥ **90**, confluence ≥ 3 signaux, géo : min 5 US + 2 EU + 1 APAC + 2 ETFs)
8. **Titre carte OBLIGATOIRE** : `Top 10 A+ {REGIME} — {TICKER1}, ..., {TICKER10}`
9. **Indexer + Push HTML d'abord** :
   ```bash
   node tools/publish.js --type scanner --path scanner/YYYYMMDD/index.html --no-notify
   ```

## Pipeline Quotidien (Append-only) — ⚠️ AUTOMATIQUE, NE JAMAIS DEMANDER

Après chaque scanner publié, lancer pipeline complet **sans demander confirmation** :
```bash
node tools/update-tracking.js           # Tracking exits (prix Yahoo)
node tools/sweep.js                     # Append-only: nouveaux trades fermés
MCP_GATEWAY_URL=https://gateway.dailytickers.com/mcp \
  node tools/refresh-risk-metrics.js    # VaR + stress + correlation + regimeProb
node tools/gen-status-page.js           # Snapshot J + Dashboard
node tools/gen-api.js                   # Refresh public JSONs (50 endpoints)
./tools/publish-daily-card.sh           # Image, sweep, media, Telegram + git push
node tools/trading-executor/run-session.js  # Generate plans + execute
```
Sans `MCP_GATEWAY_URL` → stub écrit schéma vide. **TOUJOURS exporter, jamais accepter stub silencieusement.**

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

1. Lire tous scans 10 derniers jours, extraire setups
2. Collecter prix actuels via `QueryData` (quote, bars_daily)
3. Créer `scanner/retrospective/YYYYMMDD/index.html` (note A+ à F = 50% Setup HR + 50% Portfolio Sim, dashboard, tableau, top/flop, equity curve)
4. Mettre à jour redirect `scanner/retrospective/index.html`
5. Dashboard "Performance du Scanner" dans `index.html` :
   - **CONVENTION CUMULÉE** : stats sur TOUTES les rétros
   - KPIs : Hit Rate cumulé (`TP1 / (TP1 + stops)`), meilleur/pire pick all-time
   - Rétros provisoires (< 60% résolu) : marquées `*`
   - Chart Hit Rate : barre par rétro + barre orange `% résolu` (yAxis2)
   - Chart résultats : stacked bars TP1/Stop/Open (jamais masquer open)
6. **Indexer + Push** :
   ```bash
   node tools/publish.js --type retro --path scanner/retrospective/YYYYMMDD/index.html
   ```
