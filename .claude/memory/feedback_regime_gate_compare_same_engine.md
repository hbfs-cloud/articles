---
name: regime-gate-compare-same-engine
description: Comparer des scores de régime entre scans exige le même MOTEUR, pas seulement la même échelle ; sinon une porte de risque se déclenche sur un changement d'instrument de mesure.
metadata:
  type: feedback
---

La porte `regime_score_drop_momentum_cap` normalisait les **échelles** (défensivité ↔ haussier,
0-1 ↔ 0-100) mais pas les **moteurs**. Le 2026-09-17 elle a lu un décrochage de **30 points**
(92,3 → 62,1) et plafonné le momentum à 1 ligne sur 8, ce qui rendait le plancher de 2 ETF
inatteignable — donc aucun panier conforme.

Le décrochage n'existait pas. Les scans des 14, 15 et 17 lisent le classificateur
`switcher_analyzer` (`facets.regime.dtx_regime`, échelle native 0-1 risk-on). Celui du **16** a
publié une autre grandeur : le complément de la défensivité du parent `context_conditional`
(100 − 7,7 = 92,3). Même journée, même marché, deux instruments : 92,3 contre 65,4. À moteur
constant la série vaut **73,0 → 68,2 → 65,4 → 62,1**, soit −10,9 points, SOUS le seuil de 15.

Correctif : G3 ne retient dans l'historique que les scans dont `regimeEngine` correspond au moteur
courant (clé = premier segment avant `/`, en minuscules), et **déclare en advisory** les scans
écartés avec leur moteur et leur score. Moteur absent d'un côté ou de l'autre (archive ≤ 20260731) :
comportement inchangé. Testé : la porte mord toujours sur un décrochage réel à moteur constant
(score témoin 40 contre un pic de 73,0 → violation levée).

**Why:** une porte de risque qui se déclenche sur un artefact de mesure finit par être contournée ou
désactivée, ce qui coûte plus cher que le faux positif. Et un historique tronqué en silence vaut
moins que pas d'historique : le skip doit se voir.

**How to apply:** tout gate qui compare une grandeur ENTRE runs doit vérifier l'échelle ET le
producteur. Quand le producteur change, le manifeste doit porter la série à moteur constant
(`regime_constant_engine_series`) et la prose publiée doit le dire au lecteur — pas seulement le
manifeste. Voir [[scanner-regime-authority-scale]] si la note existe.
