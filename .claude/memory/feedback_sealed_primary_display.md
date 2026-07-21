---
name: sealed-primary-display
description: Le status page hero affiche TOUJOURS le sweep scellé (hash-chain) comme chiffre primaire d'un mode — jamais le carnet live NI la forward-view incl. MtM. Gater les DEUX branches (pit ET forward) par frozenMeaningful. Garde-fou qa-check "SEALED-PRIMARY invariant".
metadata:
  type: feedback
---

**Règle (immuable)** : le chiffre en tête de chaque mode = son **sweep scellé** (frozen_*,
chaîne SHA-256) dès qu'il existe un vrai track record. Un carnet live (échantillon récent) OU
une forward-view incluant le mark-to-market des positions ouvertes ne doit **JAMAIS** remplacer
un track record scellé au headline. Une seule courbe = le portfolio (série nommée `Portfolio`) ;
pas de « Strategy » / « Sim backtest » / « LIVE BOOK ». La blockchain protège les DONNÉES, ce
feedback protège l'AFFICHAGE.

## Incident 1 — carnet live en primaire (2026-07-02)
Une routine cloud (commit `a1e2642a9`, « Fable 5 ») a fait du **carnet live pit-state** la couche
PRIMAIRE du status page pour tous les modes, reléguant le track record **scellé** en sous-bloc
« Sim backtest ». Affiché : **turbo 111.76% → 5.51%**, dynamic 75% → 24%, balanced 45% → 21%.
Vécu comme une réécriture de l'historique (« foutage de gueule »). `verifyTradeChain()` = 13/13
modes valides, 0 changement : données intactes, incident **100% couche d'affichage**.

## Incident 2 — branche forward non gatée (2026-07-13, fix f7ed8c970)
Le hero « Total Return » de turbo affichait **106.92 %** (forward-view incl. MtM des positions
ouvertes) au lieu du **112.24 %** frozen scellé. La branche `forward` (`F = m.forward`) dans
`gen-status-page.js` n'était PAS gatée par `frozenMeaningful` (contrairement à la branche `pit`),
donc elle court-circuitait le même invariant que 2026-07-02. Un chiffre « qui chute de 112 à 106
sans explication », alarmant. **Fix** : gater `F` par `!frozenMeaningful` (miroir de `pit`) →
headline des modes meaningful = `m` frozen scellé. Le live incl. MtM s'affiche SÉPARÉMENT dans
une ligne `.ps-live` labellisée (« Live incl. MtM », tooltip + caveat stop-sell), jamais fondu
dans « Total Return ».

## Piège pédagogique : points-de-return ≠ %-réel
Un mode à **+112 % cumulé** dont le portefeuille bouge de **−2.5 %** voit son « Total Return »
passer de 112.24 à 106.92 = **−5.32 POINTS** — mais la perte RÉELLE est **−2.5 %**, pas −5.3 %.
Ex. turbo (mono-position ~pleine taille) : trade CAH vendu −2.2 % le 10/07 → book ~−2.2 % →
affiché −4.6 points sur la base +112. Toujours raisonner en variation d'equity réelle
(`equity_fin/equity_ini − 1`), pas en soustraction de points de return.

## How to apply
- `gen-status-page.js` : gate `frozenMeaningful = (m.trades>=10) || |m.ret|>=5` dans `panel()`,
  dans `modeCharts`, ET sur la branche forward `F`. `P` (pit-live) et `F` (forward incl. MtM)
  ne deviennent primaires que si `!frozenMeaningful`. Modes frais sans sweep (aplus/etf/momentum/…)
  gardent leur carnet live comme unique portfolio ; les modes dtx gardent le label « Live Return
  since … ».
- Garde-fou bloquant `qa-check.js` (check 27b « SEALED-PRIMARY invariant ») : pour tout mode à
  track record scellé, `hero Total Return == frozen.returnTotal` (TOL 1.0) — le gate `fwdPrimary`
  est aussi par `!frozenMeaningful` ; et zéro label `LIVE BOOK` / `Sim backtest` / `name:'Strategy'`
  dans le HTML. Exit 1 si violé — un régén ne peut plus déraper.
- Edge : orbit (secured, 13 trades scellés) affiche son sweep scellé (**−1.69%**), pas le live
  (+10.46%) — cohérent avec « un seul = portfolio comme avant ».

## Sources de vérité
- Frozen scellé : `backtest-results.json frozen_*`. Sa courbe s'arrête à sa date de gel (turbo :
  26/06, 40 trades) — les trades post-gel vivent dans la forward-view, pas dans le frozen.
- Live jour-par-jour : `data/pit-forward.json` (anchorDate/anchorValue + ec).

Lié : [[immutable-trades]] (protège les données), [[frozen-stats-append-only-advance]] (avancement des agrégats).
