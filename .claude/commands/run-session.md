# /run-session — Pre-market checklist + trading plan

Automated trading checklist. Outputs ONLY actions — no explanations. User asks "pourquoi ?" on any line to get justification.

Heures = Paris (CET/CEST), marché US.

## Arguments

- `/run-session` ou `/run-session pre-market` → plan complet avant l'open
- `/run-session open` → VWAP check live + ordres finaux
- `/run-session close` → bilan séance + stops à ajuster
- `/run-session review` → état du portfolio

## Principes de sortie

1. **Actions uniquement.** Pas d'explication. Le user demande "pourquoi ?" → justifier CE point.
2. **Format terminal.** Court, scannable.
3. **GO / NO-GO.** Chaque ticker = un verdict, pas une analyse.
4. **Aucun disclaimer, aucun conseil générique, aucun emoji dans le corps.**
5. **Unités explicites partout.** "BUY 80 sh", jamais "BUY 80".

---

## PRE-MARKET (argument: pre-market ou vide)

### Étape 1 — Fetch en parallèle :
1. `GetMarketContext(facets='regime', model='ensemble', horizon_days=5)` (canonique, ex-GetRegimeProbability)
2. `QueryData symbols=^VIX types=quote`
3. `GetEarningsCalendarFiltered days_ahead=5`
4. `get_portfolio(account_id="91fa4372-b446-4dd8-93c4-b2bf9fb6d5cf")`
5. Lire le dernier scanner : `scanner/$(ls -t scanner/ | grep -v status | head -1)/data.json`
6. `Read data/modes-config.json`

### Étape 2 — Staleness check (BLOQUANT)
Si timestamp des quotes MCP > 24h → afficher :
```
STOP — Données MCP stale ({age}h). Pas de plan.
```
Et s'arrêter. Ne rien générer.

### Étape 3 — Sélection du mode

Lire le label du régime retourné par `GetMarketContext(facets='regime')` (canonique, ex-GetRegimeProbability ; champ `current_regime` ou `current_state`).
Pour chaque mode dans modes-config.json :
1. Status doit être `live` ou `deploying` → sinon EXCLURE
2. Lire `regimeFilters[current_regime]` du mode → absent = EXCLURE
3. Lire `vixKillThreshold` du mode → VIX actuel > seuil = EXCLURE

**Ne PAS inventer de seuils numériques.** Utiliser UNIQUEMENT `regimeFilters` et `vixKillThreshold` de chaque mode.

Parmi les modes restants, sélectionner le plus défensif (riskProfile: Ultra-Low > moderate > Medium > Medium-High > High > Extreme).

Si AUCUN mode ne passe → afficher :
```
PLAN — {date}
RÉGIME {label} | VIX {val}
PAS DE TRADE — aucun mode compatible
```

### Étape 4 — DD breaker check (BLOQUANT par mode)

Pour le mode sélectionné :
1. Lire `ddBreakerPct` du mode
2. Calculer le DD actuel (equity vs high-water mark depuis `statusSince`)
3. Si DD > ddBreakerPct → MODE BLOQUÉ, essayer le mode suivant

### Étape 5 — Circuit breaker check (BLOQUANT par mode)

1. Lire `circuitBreakerStops`, `circuitBreakerWindow`, `circuitBreakerPause`
2. Compter les SL hits dans les N derniers jours (window) via `scanner-positions.json`
3. Si SL count >= circuitBreakerStops → MODE EN PAUSE

### Étape 6 — Filtrer les picks du scanner

Pour chaque pick, dans l'ordre :
1. `sharia != true` → ❌ sharia
2. Ticker dans exclusion window earnings (calendrier) → ❌ earnings
3. `score < minScore` du mode → ❌ score
4. Ticker déjà en portefeuille (toutes positions) → ❌ doublon
5. ATR = 0 ou NaN ou absent → ❌ données
6. Pattern du pick incompatible avec le filtre régime du mode :
   - `breakout_only` → seuls les picks pattern "Breakout" passent
   - `mom_bo` → picks pattern "Momentum" ou "Breakout" passent
   - `candlestick_only` → seuls les picks pattern "Candlestick" passent
   - `all` → tout passe
7. Si le mode a `postWideningRRMin > 0` :
   - Calculer R/R après widening = (TP1 - entry) / (ATR × atrStopMult)
   - Si R/R < postWideningRRMin → ❌ R/R gate

Trier par score décroissant.

### Étape 7 — Slots disponibles

```
slots = portfolioSize - positions_ouvertes_dans_ce_mode
```

Compter les positions par mode via `scanner-positions.json` (champ `mode`).
Cap additionnel : max 2 si aucune position existante dans le mode (première séance).
Garder les `min(slots, topN)` premiers picks.

Si 0 picks passent le mode le plus défensif → essayer le mode suivant dans l'ordre de défensivité. Si AUCUN mode n'a de picks → afficher la liste des exclusions et s'arrêter.

### Étape 8 — Correlation check

Pour chaque pick retenu, si le mode a `correlationCap > 0` :
1. `PortfolioRisk(action='correlation', symbols='{pick},{positions_existantes}')` (canonique, ex-GetCorrelationMatrix — symbols en CSV)
2. Si corrélation max > correlationCap → ❌ corrélé

### Étape 9 — Sizing

Pour chaque pick, appeler `QueryData symbols={TICKER} types=quote,technicals` :
```
risk_per_share = ATR × atrStopMult
stop_atr = entry - risk_per_share
```

Si le mode a `maxStopPct > 0` :
```
stop_max = entry × (1 - maxStopPct / 100)
stop = max(stop_atr, stop_max)
risk_per_share = entry - stop
```

Sizing :
```
base_size = floor(equity × targetRiskPct% / risk_per_share)
```

Si le mode a `positionSizePct` (ex: Fortress 0.6) :
```
base_size = floor(base_size × positionSizePct)
```

Cash guard :
```
sizing = min(base_size, floor(cash / entry))
```

Si sizing = 0 → ❌ sizing impossible

### Étape 10 — Afficher le plan

```
PLAN — {JJ mois YYYY}

RÉGIME {label} | VIX {val} (kill={vixKillThreshold})
CASH {cash}$ | {nb} positions | EQUITY {eq}$

{MODE_LABEL} (slots: {dispo}/{portfolioSize})
──────────────────────────────────
{TICKER}  {prix}$  BUY {qty} sh  STOP {stop}$  TP {tp1}$  risque {risque}$ ✅
{TICKER}  ❌ {raison}

ORDRES : {nb} | RISQUE AGRÉGÉ : {sum}$ ({pct}% capital)

15h25  Ouvrir broker + TradingView, vérifier VIX
15h30  Marché ouvre — NE RIEN FAIRE
15h45  /run-session open → confirmation VWAP + ordres finaux
```

Si TOUT est bloqué :
```
PLAN — {date}
RÉGIME {label} | VIX {val}
PAS DE TRADE — {raison par mode}
```

---

## OPEN (argument: open)

### Fetch :
1. `QueryData symbols={TICKERS_DU_PLAN},^VIX types=quote`
2. `GetMarketContext(facets='regime', model='ensemble', horizon_days=5)` (canonique, ex-GetRegimeProbability) (re-check)

### Logique :
- VIX > vixKillThreshold du mode → TOUT ANNULER
- Régime changé de label vs pre-market → RE-ÉVALUER
- Pour chaque ticker :
  - prix > VWAP (indicateur intraday) → GO
  - prix < VWAP → SKIP
  - gap open > 3% vs close veille ET ATR% < 3% → SKIP

### Format :
```
OPEN — 15h45

VIX {val} vs kill {seuil} → {OK/KILL}
RÉGIME {label} → {inchangé/CHANGÉ}

{TICKER}  {prix}$ vs VWAP → GO
  LIMIT @ {prix}$ | QTY {qty} sh | STOP @ {stop}$

{TICKER}  {prix}$ vs VWAP → SKIP (sous VWAP)

Après chaque fill → placer STOP immédiatement (cancel/replace sur broker)
```

---

## CLOSE (argument: close)

### Fetch :
1. `get_portfolio`
2. `QueryData symbols={POSITIONS} types=quote`

### Format :
```
CLOSE — 21h50

{TICKER}  {pnl%}  stop {stop}$  trail {oui/non}  horizon J{x}/{max}

P&L JOUR : {total}$ ({pct}%)

ACTION :
- {rien / modifier stop {TICKER} → {new}$ (cancel/replace) / sortir demain (horizon)}
```

---

## REVIEW (argument: review)

```
PORTFOLIO — {JJ mois YYYY} {HH:MM}

CASH {cash}$
{TICKER} x{qty} @ {avg}$ → {prix}$ ({pnl}$ / {pnl%})  STOP {stop}$
EQUITY {total}$  EXPOSITION {pct}%
```

---

## Harness interne (silencieux sauf FAIL)

Vérifier chaque point AVANT d'afficher. Afficher UNIQUEMENT les fails.

| # | Check | Si FAIL |
|---|-------|---------|
| 1 | Données MCP < 24h | STOP TOUT |
| 2 | Chaque prix = prix MCP (pas inventé) | STOP TOUT |
| 3 | ATR > 0 et numérique | EXCLURE ticker |
| 4 | sizing × prix ≤ cash | EXCLURE ticker |
| 5 | risk × sizing ≤ equity × targetRiskPct × 1.05 | RÉDUIRE sizing |
| 6 | Ticker pas en exclusion earnings | EXCLURE ticker |
| 7 | Ticker sharia = true | EXCLURE ticker |
| 8 | Mode compatible régime (regimeFilters) | EXCLURE mode |
| 9 | VIX < vixKillThreshold | EXCLURE mode |
| 10 | Positions après achat ≤ portfolioSize | RÉDUIRE nb ordres |
| 11 | Stop clampé par maxStopPct si applicable | RECALCULER |
| 12 | Corrélation < correlationCap | EXCLURE ticker |
| 13 | DD < ddBreakerPct | BLOQUER mode |
| 14 | SL count < circuitBreakerStops | BLOQUER mode |
| 15 | Pas de doublon cross-mode si crossModeDedup | EXCLURE ticker |
