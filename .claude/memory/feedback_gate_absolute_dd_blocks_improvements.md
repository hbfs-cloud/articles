---
name: gate-absolute-dd-guardrail-blocks-improvements
description: Le gate de validate-config-change rejette sur un DD ABSOLU ≤8% que la config actuelle viole déjà — il bloque donc des propositions qui améliorent rendement ET drawdown
metadata:
  type: feedback
---

Constaté le 2026-08-07 en validant la restauration de l'horizon sur turbo.

`tools/validate-config-change.js` applique un guardrail « full DD ≤ 8% » en valeur **absolue**.
Sur turbo :

| | rendement pleine période | DD pleine période |
|---|---|---|
| CURRENT (H=8) | −6,54% | **−11,07%** |
| proposé H=3 | **−0,33%** | **−9,96%** |

La proposition améliore les **deux** axes, et se fait refuser au motif que `-9.96% viole
guardrail ≤8%` — un seuil que la ligne de référence rate déjà, plus largement.

**Why:** le projet a par ailleurs une règle explicite (mémoire `segment-replay-absolute-dd`)
disant que le DD absolu d'un replay de segment n'est **pas fiable** et qu'il faut juger sur des
deltas relatifs A/B. Le gate applique pourtant ce même chiffre absolu comme condition
éliminatoire. Résultat : quand une config est déjà au-delà du seuil, le gate gèle l'état
existant — il devient impossible de l'améliorer par étapes, alors que c'est exactement la
situation où l'amélioration est la plus nécessaire.

**How to apply:**
1. Un guardrail absolu n'a de sens que si la ligne de référence le respecte. Sinon, il faut
   basculer sur la formulation relative : « le DD proposé ne doit pas être PIRE que l'actuel ».
2. Avant de conclure qu'une proposition est refusée, lire le détail : distinguer un refus sur
   comparaison A/B (verdict solide) d'un refus sur seuil absolu que la référence viole aussi
   (verdict à requalifier).
3. Ne pas contourner avec `--force` : la bonne action est de remonter le cas, pas de passer
   outre un gate de config sur des modes live.

Cas ouvert : turbo H=3 attend une décision. Voir [[llm-modes-horizon-redefined]].
