---
name: hybrid-illegal-promotion
description: hybrid mis en live le 06/07 par une transition ILLÉGALE draft→live, minScore=25 inopérant, maxStopPct=20, ddBreakerPct=30, circuitBreakerStops=0 — et AdaptiveFractal échappe au gate validate-scan ET au plancher R/R du simulateur. -144,6 pts sur 14 trades.
metadata:
  type: feedback
---

**Cause #2 du trou de performance juillet 2026.** Trouvée par les angles `données`, `git` et
`process`.

`data/modes-status-history.json` : la **seule** transition du mode `hybrid` est
`2026-07-06T08:56:42Z draft→live`, motif « Passage live demandé user ». `tools/lib/MODE_STATUS.md`
§Valid transitions : **`draft` n'autorise QUE `test`**. La transition est illégale.

**Config au passage live :** `minScore=25` (inopérant), `maxStopPct=20` jusqu'au 23/07,
`ddBreakerPct=30`, `circuitBreakerStops=0`. Les stops scellés d'hybrid vont jusqu'à **-20,0% exact**
(= `maxStopPct` avant le passage à 12 le 23/07, cf. `modes-config-history` v10.9).

**Résultat scellé :** 14 trades, somme **-144,6 pts**, moyenne **-10,33%**, **médiane -6,21%** — la
moyenne est tirée par un seul outlier, à dire honnêtement.

**Le trou de gate, démontré par MPLT.** `scanner/20260722/signals.json` émet
`{"score":73.24, "strategy":"AdaptiveFractal", "entry":37.44, "stop":30.23, "rr":"1:0.52"}` — stop à
**-19,3%**, R/R **inversé**. Il passe pour deux raisons cumulées :
1. `tools/validate-scan.js:55-60` exclut `adaptivefractal` du set `SPECIALIST_STRATEGIES` **AVANT
   toute règle** → les `hard_block` de `data/scanner-lessons.json` (stop max 8%, R/R min 1:1,5) ne
   s'appliquent pas ;
2. `tools/sweep.js:955` : `RR_GATE_STRATEGIES = {momentum, breakout, pullback, pre_squeeze,
   hybrid_megacap}` — `adaptive_fractal` en est absent, donc `sweep.js:960` ne rejette pas.

Résultat scellé sur ce seul trade : **-65,57%**, soit **45% du total du mode**.

**Correction d'une explication fausse qui circulait :** « `minScore=25` est inopérant parce que le
plancher de l'échelle est 27,5 » est **faux** — le minimum réellement émis toutes dates confondues est
**5,57** (ALM, MomentumRotation, 02/07), donc SOUS 25 ; le seuil aurait mordu. Le 27,5 est un signal
AdaptiveFractal/metals d'un seul jour, dans un pool que hybrid ne lit pas. La conclusion reste vraie
mais pour une autre raison : **`tools/hybrid-scanner.js:371` rejette en dur `result.score < 50`**, et
les 14 trades réels d'hybrid scorent 65,15 à 73,47 — `minScore=25` ne filtre effectivement rien.

**Why:** Un mode promu sans passer par `test` n'a aucune espérance mesurée. Pire, un `minScore`
affiché mais dominé par un seuil en dur dans le scanner donne l'illusion d'un garde-fou réglable qui
n'existe pas — toute revue de config est alors trompeuse.

**How to apply:**
- Jamais de `draft→live`. Utiliser `node tools/set-mode-status.js` (qui rejette les transitions
  illégales) — un `--force` doit être justifié par un backtest attaché.
- Avant de citer un `minScore` comme garde-fou, **vérifier le seuil en dur du scanner amont** et la
  distribution réelle des scores émis par ce pool.
- Toute stratégie ajoutée à `SPECIALIST_STRATEGIES` de `validate-scan.js` doit être **simultanément**
  ajoutée à `RR_GATE_STRATEGIES` de `sweep.js` ou faire l'objet d'une dérogation écrite avec preuve.
  Lié à [[mode-status-machine-bypassed]], [[validate-scan-specialist-exemption]].
