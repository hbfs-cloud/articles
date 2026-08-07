---
name: horizon-calibrate-on-realized-hold
description: Calibrer `horizon` sur la durée de détention RÉELLE des gagnants (médiane), pas sur une valeur héritée — et ne le faire que sur les modes réellement convertis
metadata:
  type: feedback
---

Méthode dégagée le 2026-08-07 en réparant les modes LLM.

## La mesure qui compte

La **durée de détention médiane des GAGNANTS** est la durée de vie empirique de l'edge. Un
`horizon` très supérieur laisse le mouvement se rendre avant la sortie ; un horizon très inférieur
coupe avant maturité. Le bon repère observé : `horizon ≈ médiane des gagnants`, +1 de marge.

| mode | H hérité | détention gagnants | H validé | verdict du gate |
|---|---|---|---|---|
| turbo | 8 | 3,0 | **3** | GO (rendement −6,54→−0,33%, DD −11,07→−9,96%) |
| balanced | 8 | 5 | **6** | GO |
| aplus | 20 | 6 | **10** | GO (30j +2,31% PF 3,20) |
| dynamic | 10 | 3,0 | — | WAIT sur tous les horizons courts |
| secured | 20 | 5 | — | WAIT : tous dégradent l'OOS |
| fortress | 8 | 4 | — | WAIT, marginal (1,42 vs 1,43) |

## Le garde-fou : ne restaurer que ce qui a été converti

Le test discrimine correctement, et c'est ce qui valide la méthode :

- `turbo`, `dynamic`, `balanced` étaient des stratégies à **2 jours avec rotation agressive** en
  avril, converties en swings de 8-10 jours entre le 04/06 et le 20/06. Raccourcir les répare.
- `secured` est à H=20 par **mandat** (Orbit : H20 / ATR3.5 / trail 2R). Tous les horizons courts
  dégradent son OOS — le gate le refuse, et il a raison.
- `fortress` n'a **jamais** été converti : H=8 depuis toujours, et il est positif. Le gate le
  refuse marginalement, cohérent.

**Why:** allonger un horizon passe pour un réglage de risque anodin, alors que c'est un changement
de STRATÉGIE. Et l'inverse est vrai aussi : raccourcir partout « parce que ça a marché sur turbo »
casserait les modes dont l'horizon long est délibéré. Vérifier l'historique git AVANT de conclure
qu'un paramètre a dérivé.

**How to apply:**
1. Mesurer `median(holdDays)` sur les trades GAGNANTS uniquement, dédupliqués sur
   `(ticker, scanDate)`. Attention à la censure : si la détention moyenne colle au plafond, la
   mesure est tronquée par l'horizon lui-même et ne dit rien.
2. Vérifier dans l'historique git si `horizon` a changé, et quand. Un horizon d'origine n'est pas
   une dérive.
3. Un écart supérieur à ~2× entre horizon et détention réelle des gagnants est un signal, pas une
   preuve : passer par `validate-config-change.js` et laisser le gate trancher.
4. Signature associée : excursion favorable médiane nettement sous la distance à TP1, majorité de
   sorties au seuil ou au stop. Le sélecteur et la sortie ne visent pas la même échelle de temps.

Voir [[llm-modes-horizon-redefined]] pour le diagnostic d'origine et
[[gate-absolute-dd-guardrail-blocks-improvements]] pour les deux défauts du gate qui masquaient tout ça.
