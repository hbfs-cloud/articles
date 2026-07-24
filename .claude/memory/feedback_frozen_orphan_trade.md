---
name: frozen-orphan-trade-append-limit
description: L'append-only FROZEN_ONLY ne rattrape JAMAIS un trade qui clôture sur/avant la pointe de courbe déjà scellée → il devient orphelin (compté dans backtest-trades mais pas dans l'agrégat frozen). Non corrigeable sans réécrire le scellé.
metadata:
  type: feedback
---

**Incident (2026-07-23/24).** `frozen_balanced.trades=71` mais `backtest-trades.json.balanced` a **72** clôturés. Le 72e = **BTSG** (tp1 +8,93%, cv v10.6, poids 0,333 → +2,977 pts), exit **2026-07-20** — soit SUR un point de courbe déjà scellé (frozen tail : 07-17=142,37 → 07-20=142,85 → 07-21=141,99).

**Cause (sweep.js, chemin FROZEN_ONLY ~L2675 + advance ~L2930).** L'append-only n'avance QUE pour `exitDate > lastFrozenISO` (dernier point gelé = 07-21). Un trade dont l'exit ≤ 07-21 (résolu rétroactivement, ex. re-simulé) tombe sur la branche IMMUTABLE (`stats = existingFrozen`, 71 conservé), MAIS `frozenTrades[id]=merged` (72) est quand même écrit dans backtest-trades.json → divergence 72 clos / 71 agrégé.

**Pourquoi non corrigeable sans violer l'immutabilité (3 chemins testés en workflow) :**
1. `computeStatsFromTrades` from-scratch sur 72 → return 46,29% MAIS réécrit la courbe scellée fév-mai dès l'idx 0 (03-02: 99,86→100). VIOLATION.
2. append `priorEC` (préfixe scellé) → préfixe byte-identique OK mais BTSG (exit 07-20 ≤ pointe 07-21) n'a aucun jour post-pointe à appender → sa contribution +2,977 est DROPPÉE → 72 trades affichés / return de 71 = incohérent.
3. Intégrer BTSG proprement exigerait de RÉÉCRIRE en place les points scellés 07-20/07-21 (142,85→~145,8 ; 141,99→~144,9) — pas un append, incompatible avec le scellé.

La courbe frozen est construite par `computeStatsFromTrades` + priceCache (PAS simulatePortfolio), 102 pts, avec MtM/unrealized (returnTotal 41,99 < returnRealized 43,32). Pas de flag `--reseal` single-mode point-in-time dans sweep.js.

**Décision (règle) :** garder le scellé (41,99%/71) — self-consistant. Un trade orphelin (résolu sur/avant la pointe scellée) NE doit PAS déclencher un re-freeze : réviser le return d'un enregistrement public scellé exige de réécrire l'historique, ce qui est INTERDIT (Immutable Trades). Le reliquat est cosmétique. Prévention amont : éviter qu'un trade se résolve rétroactivement sur une date déjà scellée. Voir [[scanner-workflow-token-blowup]], [[momentum-crash-loss-breakers]].

**How to apply :** si `frozen_<mode>.trades` ≠ count(closed non-premature) dans backtest-trades, vérifier si le trade en trop a exit ≤ pointe frozen. Si oui = orphelin structurel → NE PAS re-freeze, documenter. Ne jamais overwrite un frozen scellé via computeStatsFromTrades from-scratch (change la courbe + le return).
