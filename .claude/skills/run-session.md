---
name: run-session
description: "Pre-market checklist + trading plan. Outputs ONLY actions — no explanations. 'pourquoi ?' on any line to get justification. Trigger: run-session, séance, pre-market, plan de trading."
version: 3.0.0
user-invocable: true
argument-hint: "[pre-market | open | close | review]"
---

# Run Session — Checklist Pilote v3

Heures = Paris (CET/CEST), marché US.

## Principes de sortie

1. **Actions uniquement.** Pas d'explication. Le user demande "pourquoi ?" → justifier CE point.
2. **Format terminal.** Court, scannable.
3. **GO / NO-GO.** Chaque ticker = un verdict, pas une analyse.
4. **Aucun disclaimer, aucun conseil générique, aucun emoji dans le corps.**
5. **Unités explicites partout.** "BUY 80 sh", jamais "BUY 80".

---

## PRE-MARKET (argument: pre-market ou vide)

### Étape 1 — Fetch en parallèle :
1. `GetRegimeProbability model=ensemble horizon_days=5`
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

Lire le label du régime retourné par `GetRegimeProbability` (champ `current_regime`).
Pour chaque mode LIVE dans modes-config.json :
1. Lire `regimeFilters[current_regime]` du mode
2. Si le filtre = absent ou mode status != `live` ou `deploying` → EXCLURE le mode
3. Lire `vixKillThreshold` du mode → si VIX actuel > seuil → EXCLURE le mode

**Ne PAS inventer de seuils numériques.** Utiliser UNIQUEMENT les champs `regimeFilters` et `vixKillThreshold` de chaque mode dans modes-config.json.

Parmi les modes restants, sélectionner le plus défensif (riskProfile: Ultra-Low > Medium > High > Extreme).

Si AUCUN mode ne passe → afficher :
```
PLAN — {date}
RÉGIME {label} | VIX {val}
PAS DE TRADE — aucun mode compatible
```

### Étape 4 — DD breaker check (BLOQUANT par mode)

Pour le mode sélectionné :
1. Lire `ddBreakerPct` du mode
2. Calculer le DD actuel du mode (equity actuelle vs high-water mark depuis `statusSince`)
3. Si DD actuel > ddBreakerPct → MODE BLOQUÉ, essayer le mode suivant
4. Si tous bloqués → PAS DE TRADE

### Étape 5 — Circuit breaker check (BLOQUANT par mode)

1. Lire `circuitBreakerStops`, `circuitBreakerWindow`, `circuitBreakerPause` du mode
2. Compter les SL hits dans les N derniers jours (window) depuis `scanner-positions.json`
3. Si SL count >= circuitBreakerStops → MODE EN PAUSE pour circuitBreakerPause jours

### Étape 6 — Filtrer les picks du scanner

Pour chaque pick du scanner, dans l'ordre :
1. `sharia != true` → ❌ sharia
2. Ticker dans la liste earnings < 5 jours calendaires → ❌ earnings
3. `score < minScore` du mode → ❌ score
4. Ticker déjà dans le portfolio (toutes positions, tous modes) → ❌ doublon
5. ATR = 0 ou NaN ou absent → ❌ données
6. Mode status = `deploying` et ticker pas dans les signaux du mode → ❌ hors scope

Trier les picks restants par score décroissant.

### Étape 7 — Slots disponibles

```
slots = portfolioSize - positions_ouvertes_dans_ce_mode
```

Compter les positions par mode via `scanner-positions.json` (champ `mode`), PAS le total broker.

Cap additionnel : max 2 ordres si aucune position existante (première séance).

Garder les `min(slots, topN)` premiers picks.

### Étape 8 — Correlation check

Pour chaque pick retenu, si le mode a `correlationCap > 0` :
1. Appeler `GetCorrelationMatrix symbols={pick},{positions_existantes_du_mode}`
2. Si corrélation max avec une position existante > correlationCap → ❌ corrélé

### Étape 9 — Sizing

Pour chaque pick :
```
risk_per_share = ATR × atrStopMult
stop_atr = entry - risk_per_share
```

Si le mode a `maxStopPct > 0` :
```
stop_max = entry × (1 - maxStopPct / 100)
stop = max(stop_atr, stop_max)    // le stop le plus serré
risk_per_share = entry - stop      // recalculer après clamp
```

Sizing :
```
base_size = floor(equity × targetRiskPct% / risk_per_share)
```

Si le mode a `positionSizePct` (ex: Fortress = 0.6) :
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

{MODE_LABEL} (slots: {slots_dispo}/{portfolioSize})
──────────────────────────────────
{TICKER}  {prix}$  BUY {qty} sh  STOP {stop}$  TP {tp1}$  risque {risque}$ ✅
{TICKER}  {prix}$  BUY {qty} sh  STOP {stop}$  TP {tp1}$  risque {risque}$ ✅
{TICKER}  ❌ {raison}
{TICKER}  ❌ {raison}

ORDRES : {nb} | RISQUE AGRÉGÉ : {sum}$ ({pct}% capital)

15h25  Ouvrir broker + TradingView, vérifier VIX
15h30  Marché ouvre — NE RIEN FAIRE
15h45  /run-session open → confirmation VWAP + ordres finaux
```

---

## OPEN (argument: open)

### Fetch :
1. `QueryData symbols={TICKERS_DU_PLAN},^VIX types=quote`
2. `GetRegimeProbability model=ensemble horizon_days=5` (re-check)

### Logique :
- VIX > vixKillThreshold du mode → TOUT ANNULER
- Régime a changé de label vs pre-market → RE-ÉVALUER (downgrade mode ou annuler)
- Pour chaque ticker :
  - prix > VWAP (indicateur intraday) → GO
  - prix < VWAP → SKIP
  - gap open > 3% vs close veille ET ATR% < 3% → SKIP (gap anormal)
  - gap open > 3% ET ATR% >= 3% → OK (volatilité normale pour ce titre)

### Format :
```
OPEN — 15h45

VIX {val} vs kill {seuil} → {OK/KILL}
RÉGIME {label} → {inchangé/CHANGÉ → action}

{TICKER}  {prix}$ vs VWAP → GO
  LIMIT @ {prix}$ | QTY {qty} sh | STOP @ {stop}$

{TICKER}  {prix}$ vs VWAP → SKIP (sous VWAP)

Après chaque fill → STOP IMMÉDIAT (cancel/replace sur broker)
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
{TICKER}  {pnl%}  stop {stop}$  trail {oui/non}  horizon J{x}/{max}

P&L JOUR : {total}$ ({pct}%)

ACTION :
- {rien / modifier stop {TICKER} → {new}$ (cancel/replace) / sortir {TICKER} demain (horizon atteint)}
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

Vérifier chaque point AVANT d'afficher le plan. Afficher UNIQUEMENT les checks qui FAIL.

| # | Check | Si FAIL |
|---|-------|---------|
| 1 | Données MCP < 24h | STOP TOUT |
| 2 | Chaque prix = prix MCP (pas inventé) | STOP TOUT |
| 3 | ATR > 0 et numérique | EXCLURE ticker |
| 4 | sizing × prix ≤ cash | EXCLURE ticker |
| 5 | risk_per_share × sizing ≤ equity × targetRiskPct × 1.05 | RÉDUIRE sizing |
| 6 | Ticker pas en exclusion earnings | EXCLURE ticker |
| 7 | Ticker sharia = true | EXCLURE ticker |
| 8 | Mode compatible régime (regimeFilters) | EXCLURE mode |
| 9 | VIX < vixKillThreshold du mode | EXCLURE mode |
| 10 | Positions après achat ≤ portfolioSize | RÉDUIRE nb ordres |
| 11 | Stop = max(entry - ATR×mult, entry×(1-maxStopPct%)) | RECALCULER |
| 12 | Corrélation < correlationCap | EXCLURE ticker |
| 13 | DD actuel < ddBreakerPct | BLOQUER mode |
| 14 | SL count < circuitBreakerStops | BLOQUER mode |
| 15 | Pas de doublon cross-mode si crossModeDedup=true | EXCLURE ticker |

Si TOUT passe → plan normal, pas de mention du harness.
Si un check FAIL → ticker/mode marqué ❌ avec la raison (une ligne).
Si check 1 ou 2 FAIL → AUCUN plan.
