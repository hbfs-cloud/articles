# RunScreener DSL — Rapport de bugs (à destination de l'équipe mcp-marketdata)

**Date** : 2026-07-01
**Contexte** : diagnostic des scénarios `RunScreener` exécutés côté DailyTickers (routine Scanner Nocturne + skill `scanner-pipeline`). RunScreener est **fiable et reste l'outil de référence** — les bugs ci-dessous sont des **pièges de calibration/évaluation du DSL** qui provoquent des **0 résultats silencieux** (pas d'erreur remontée), très coûteux à diagnostiquer.

---

## Bug #1 (CRITIQUE) — `market_cap` évalué à `0` dans `pass_expr`

**Symptôme** : un `pass_expr` contenant `market_cap > <seuil>` renvoie **0 candidat**, silencieusement.

**Reproduction** :
```
pass_expr = "market_cap>10e9 && rsi14>55 && rsi14<70 && macd>0 && ema20>ema50 && ema50>ema200 && vol>avg_volume*1.2"
→ 0 candidat

# même expression SANS market_cap :
pass_expr = "rsi14>55 && rsi14<70 && macd>0 && ema20>ema50 && ema50>ema200 && vol>avg_volume*1.2"
→ 40 candidats
```

**Diagnostic** : dans le contexte d'évaluation du `pass_expr`, `market_cap` vaut **0** (champ non hydraté / non résolu au moment de l'éval du filtre), donc `market_cap > 10e9` est `false` pour **tous** les tickers.

**Impact** : c'est la cause racine d'un « scan stub » (Pullback-only) en production le 2026-07-01 — 12 modes downstream à 0 signal, badges disparus, etc.

**Demande** : soit hydrater `market_cap` avant l'évaluation du `pass_expr`, soit **documenter explicitement** que `market_cap` (et autres champs fondamentaux) ne sont pas disponibles dans `pass_expr` et **émettre un warning** quand un `pass_expr` référence un champ qui évalue à 0/null pour 100 % de l'univers (signal fort de champ non résolu).

**Workaround actuel côté client** : ne JAMAIS mettre `market_cap` dans `pass_expr` ; post-filtrer la mcap en code après récupération des candidats.

---

## Bug #2 — Forme « fonction » de l'EMA-stack renvoie 0, forme « série nommée » OK

**Reproduction** :
```
pass_expr = "ema(close,20)>ema(close,50) && ema(close,50)>ema(close,200)"   → 0 candidat
pass_expr = "ema20>ema50 && ema50>ema200"                                    → OK (40 candidats)
```

**Demande** : aligner les deux formes (que `ema(close,20)` soit équivalent à la série nommée `ema20`), ou documenter la forme supportée + émettre une erreur explicite si la forme fonction n'est pas évaluable.

---

## Bug #3 — Nombre d'arguments d'un helper : échec silencieux du job entier

**Reproduction** :
```
pass_expr = "near_breakout(20, 0.03) && vol>1500000"   → échec "too many arguments" → job renvoie 0
# signature correcte (1 arg = proximité) :
pass_expr = "near_breakout(0.03) && vol>1500000"        → OK
```

**Diagnostic** : un helper appelé avec la mauvaise arité fait échouer **tout** le job (pas juste le prédicat), renvoyant 0 sans distinction d'un « aucun match » légitime.

**Demande** : renvoyer une **erreur structurée distincte** (`invalid_argument_count` avec la signature attendue) plutôt qu'un résultat vide. Idéalement exposer la signature des helpers via `GetDSLDescription`.

---

## Remarque transverse — distinguer « 0 match » de « DSL invalide »

Le point commun des 3 bugs : un DSL **mal formé/mal calibré** renvoie **le même résultat (0 candidat)** qu'un DSL **valide sans match**. Côté consommateur, c'est indétectable sans smoke-test.

**Demande générale** : ajouter au retour de `RunScreener` des **métadonnées de diagnostic** :
- nombre de tickers de l'univers évalués,
- si un champ du `pass_expr` a évalué à null/0 sur 100 % de l'univers (warning),
- si un helper a échoué (erreur structurée).

Cela permettrait au client de détecter un DSL cassé au lieu de committer un scan vide.

---

## DSL validés côté DailyTickers (référence, renvoient 40 candidats)

```
# Momentum
pass_expr  = "rsi14>53 && rsi14<70 && macd>0 && vol>1500000 && close>10"
score_expr = "rsi14 + (macd>0 ? 15 : 0)"

# Breakout
pass_expr  = "near_breakout(0.03) && vol>1500000 && rsi14>52 && rsi14<72 && close>10"
score_expr = "rsi14 + (vol_spike45(1.5) ? 20 : 0)"
```
Rappels de calibration : `pass_expr` booléen, `score_expr` numérique ; les helpers booléens (`vol_spike45`, `near_breakout`, `cross_up`) ne fonctionnent QUE dans `pass_expr` ; post-filtrer `market_cap>=2e9` + exclure ETF/penny en code.
