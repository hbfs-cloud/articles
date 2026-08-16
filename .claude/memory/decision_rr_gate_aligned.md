---
name: rr-gate-aligned-editorial-floor
description: Décision user 16/08/2026 — le gate R/R de simulateTrade est aligné PAR ÈRE sur le plancher éditorial publié (1,5 avant le 2026-08-10, 0,7 depuis) ; « il ne faut rien bloquer »
type: decision
---

# Gate R/R du tracker aligné sur le plancher éditorial (16/08/2026)

Le gate de `simulateTrade` (sweep.js — momentum/breakout/pullback/pre_squeeze/hybrid_megacap)
n'est plus 1,5 fixe : `rrFloor = scanDate >= '2026-08-10' ? 0.7 : 1.5` (date du passage de
validate-scan.js à rr_min=0,7 RISK-ON). Décision user après l'incident [[fortress-starvation-aug2026]]
(43/43 signaux publiés 10-17/08 invisibles au tracker).

**Validation** : historique identique à l'octet (chaînes intègres, returns/DD inchangés sur les
5 modes) ; seuls des trades nouveaux post-10/08 apparaissent (fortress +4 : OXY/COMP/CLF/HL du
13/08 ; balanced OXY ; turbo FRSH breakeven). L'alerte `[rr-gate]` reste dans le sweep en
détecteur de récidive.

**Why:** rien de publié ne doit être bloqué par le tracker ; un gate codé en dur DOIT suivre les
planchers éditoriaux.
**How to apply:** tout futur changement du plancher R/R publié = ajouter la nouvelle ère (date +
valeur) dans `rrFloor` ET dans le bloc d'alerte `[rr-gate]` de sweep.js.
