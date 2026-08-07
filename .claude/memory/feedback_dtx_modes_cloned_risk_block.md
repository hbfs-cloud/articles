---
name: dtx-modes-cloned-risk-block
description: Le tracker local préempte le moteur systematic — maxStopPct=15 écrase le disaster-stop de 25% déclaré par dtx-pool-bridge.js, et liquide des positions de rotation que le moteur tenait encore. 12 sorties à exactement -15,00%.
metadata:
  type: feedback
---

**Défaut de câblage entre le moteur et son suiveur** (convergence des 4 angles d'enquête aveugles : données, code, git, process).

> ⚠️ **CADRAGE CORRIGÉ PAR LE USER, 2026-08-07.** Les modes dtx proviennent du moteur systematic
> via MCP : **c'est le design voulu**, ce ne sont pas des modes « non validés poussés en live ».
> Le premier jet de ce diagnostic en concluait qu'il fallait les mettre en `pausing` — remède FAUX,
> annulé le jour même. Le défaut n'est pas dans les modes, il est dans le **tracker qui préempte le
> moteur**. Voir la résolution en fin de fichier.

Les 6 modes dtx (`book_honest`, `us_highvol`, `hvep`, `stockbox_pit`, `etf_us`, `ep`) portent
`status:'live'`, `statusSince:'2026-07-13T16:00:00Z'` dans `data/modes-config.json`. Leur **bloc de
risque et de sortie** — `{minScore:50, topN:15, horizon:14, atrStopMult:2.5, maxStopPct:15,
breakevenPct:0, beGraceDays:0, trailMultR:1.5, partialTPGain:30, ddBreakerPct:8, portfolioSize:15,
positionSizePct, regimeParams}` — donne **UNE SEULE signature de hash pour les 6 modes ET pour
`highvol`, dont le statut est `stopped`**. (Les configs complètes, elles, sont bien distinctes :
6 signatures, elles diffèrent par `goal`/`universeFilter`/`riskProfile`/`color`. La formulation
exacte est « bloc de risque cloné », pas « configs byte-identiques ».)

**Le défaut mécanique :** `maxStopPct=15` est un plafond de perte appliqué à des stratégies de
**rotation**. `tools/dtx-pool-bridge.js:66-71` pose `DISASTER_STOP_PCT = 25` en disant explicitement
que « le moteur n'émet PAS de stop — la rotation EST l'exit […] PAS un stop de stratégie ».
`sweep.js:925-940` rabote ce disaster-stop à 15, et `sweep.js:1000-1009` le déclenche. Le sweep
**liquide donc au plafond des positions que le moteur aurait fait sortir par rotation**.

**Signature dans les données scellées** (`data/backtest-trades.json`) :
- 18 lignes dtx scellées, somme **-221,2 pts**, moyenne **-12,29%/trade**, **6% de gagnants**.
- Dédupliqué sur `(ticker, scanDate)` : 14 tickets distincts, **-171,5 pts** (LASR 13/07 compté 3×,
  DDOG 04/08 2×, SEPN 13/07 2×).
- **12 sorties à EXACTEMENT `pnlPct = -15,00`**, avec `exitPrice / actualEntry = 0,850000` pile et
  `actualStop == exitPrice`. C'est une signature mécanique de plafond, **pas un fill de marché**.
  Ces 12 lignes seules pèsent **-180 pts**.
- Soit **38% de la perte brute des sorties depuis le 01/06** (-584,5 pts) avec **10% des lignes**.

**Gouvernance :** `data/modes-status-history.json` (40 transitions, la dernière le 11/07) ne contient
**AUCUNE entrée** pour ces 6 modes. Ils n'ont jamais transité — ils ont été **écrits** directement
dans `modes-config.json`. Zéro preuve de backtest attachée.

**Why:** Un plafond de perte statique n'est pas neutre sur une stratégie sans stop : il devient
*l'unique* mécanisme de sortie, et il coupe systématiquement au pire moment. Copier un bloc de risque
depuis un mode `stopped` importe en prime la raison pour laquelle ce mode a été arrêté. Le clonage
est invisible en revue parce que le reste de la config (goal, univers, couleur) diffère.

**How to apply:**
1. Avant tout nouveau mode : **hasher le bloc de risque** (`minScore, topN, horizon, atrStopMult,
   maxStopPct, breakevenPct, beGraceDays, trailMultR, partialTPGain, ddBreakerPct,
   circuitBreakerStops, portfolioSize, positionSizePct, regimeParams`) et le comparer à tous les
   modes existants. Collision avec un mode `stopped`/`paused` = **BLOQUANT**.
2. Un mode dont le moteur n'émet pas de stop de stratégie (rotation, dtx) ne doit **pas** porter de
   `maxStopPct` serré. Le disaster-stop de `dtx-pool-bridge.js` (25%) est informationnel — le sweep ne
   doit pas le raboter.
3. Détection a posteriori : chercher les sorties où `exitPrice / actualEntry` vaut exactement
   `1 - maxStopPct/100` à 6 décimales, et où `actualStop == exitPrice`. C'est un artefact, jamais un
   fill. Lié à [[mode-status-machine-bypassed]], [[live-mode-risk-layer]], [[dtx-live-track-drift]].

## Résolution appliquée (2026-08-07)

`maxStopPct: 15 → 25` sur les 6 modes dtx, pour **aligner le plafond du tracker sur le
`DISASTER_STOP_PCT = 25` que `dtx-pool-bridge.js` déclare**. Le garde-fou redevient ce que le pont
dit qu'il est : informationnel, quasi jamais atteint — et non un stop de stratégie qui coupe avant
la rotation.

Les 3 modes mis en `pausing` par erreur (`book_honest`, `hvep`, `stockbox_pit`) ont été repris en
`live` par le chemin légal `pausing → paused → live` via `set-mode-status.js`, sans `--force`.

**Why:** le sweep est un SUIVEUR pour `assetClass:'dtx'` — les entrées ET les sorties appartiennent
au moteur. Tout paramètre de sortie que le tracker applique de son propre chef contredit cette
répartition, et le fait en silence : rien ne signale qu'un plafond local a coupé avant le moteur.

**How to apply:**
1. Pour un mode piloté par un moteur externe, la config locale ne doit porter que des garde-fous
   **strictement plus larges** que ceux du producteur. Un plafond local plus SERRÉ que le
   disaster-stop déclaré prend la main sur le moteur — c'est toujours un bug.
2. Signature à reconnaître : des sorties dont `exitPrice / actualEntry` vaut une constante exacte
   (ici 0,850000) et où `actualStop == exitPrice`. C'est un plafond qui se déclenche, jamais un
   prix de marché.
3. Avant de mettre un mode en pause pour sous-performance, vérifier D'ABORD si la perte a une
   signature mécanique. Un plafond mal réglé se corrige en une ligne ; arrêter le mode traite le
   symptôme et masque la cause.
