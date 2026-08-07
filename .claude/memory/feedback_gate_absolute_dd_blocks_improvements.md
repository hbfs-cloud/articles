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

## Troisième défaut, même famille (2026-08-07)

La fenêtre de 30 jours exigeait un rendement **strictement supérieur** (`!(w.ret > cw.ret)`).
Or une mesure **protectrice** — plafond de perte, coupe-circuit — ne mord que dans la queue de
distribution : elle est **neutre par construction** sur toute fenêtre où la queue ne s'est pas
produite, et ne peut donc jamais battre strictement.

Cas réel : `fortress` tournait à 10 positions **sans aucun plafond de perte** depuis le 29/06.
Sa pire sortie des 30 derniers jours vaut −5,07%, donc un plafond à −7% ou −8% n'a mordu sur
aucune et laisse le rendement de la fenêtre identique (1,43% contre 1,43%). L'exigence stricte
rendait **toute restauration de garde-fou inapprouvable, quelle que soit sa valeur**.

Corrigé : la fenêtre veto sur **dégradation**, pas sur absence d'amélioration. L'exigence
« bat l'actuel » reste STRICTE sur la pleine période et sur le hors-échantillon.

**Vérification que le gate garde ses dents** — sur 9 variantes testées après le correctif, **une
seule** passe : maxStop 5 et 6 dégradent la fenêtre, 7 et 9 échouent sur le rendement, l'ajout
d'un ATR stop échoue partout, et deux contre-tests délibérés sont bien refusés (`dynamic H=6`
sur le hors-échantillon — signature de surapprentissage — et `dynamic H=2` sur le drawdown).

**Règle générale à retenir :** un gate de validation doit distinguer une mesure qui **cherche du
rendement** (exiger qu'elle en produise) d'une mesure qui **borne le risque** (exiger seulement
qu'elle ne coûte rien). Les confondre bloque exactement les garde-fous qu'on veut restaurer.
