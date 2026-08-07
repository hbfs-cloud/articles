---
name: llm-modes-horizon-redefined
description: turbo et dynamic étaient des stratégies à 2 jours avec rotation agressive ; l'horizon a été porté à 8-10 jours sans re-calibrer la sélection — l'edge de ~2% est rendu avant la sortie
metadata:
  type: feedback
---

Diagnostic du 2026-08-07 sur la sous-performance des modes LLM depuis juin 2026.

## Le fait

Les modes n'ont pas déraillé : ils ont été **redéfinis**, et la sélection n'a jamais suivi.

| | jusqu'au 15/05 | 01/06 | 20/06 → aujourd'hui |
|---|---|---|---|
| turbo   | horizon **2**, rotation **aggressive** | 5 | **8**, rotation **none** |
| dynamic | horizon **2**, rotation **aggressive** | 8 | **10**, rotation **none** |

Les taglines de config le disent en clair : turbo était « Ultra-aggressive **1–2 day plays** »,
il est devenu « Ultra-aggressive **H8** concentrated swings ».

## La preuve

Performance par génération de config (modes LLM, tickets dédupliqués sur `(ticker, scanDate)`) :

| configVersion | n | réussi | espérance |
|---|---|---|---|
| v1-20260215 | 64 | 55% | **+2,31%** |
| v2-20260418 | 72 | 39% | +0,56% |
| **v7-20260604** | 8 | 12% | **−1,91%** ← bascule, exactement quand H passe de 2 à 5-8 |
| v10.6-20260704 | 35 | 11% | −1,60% |

Et ce que les entrées produisent réellement : **excursion favorable médiane +1,97%**, la moitié
des trades tués au verrou étaient à +2% ou plus. Le signal génère un mouvement d'environ 2% en
environ 2 jours — ce que la config v1/v2 récoltait, et que la config actuelle rend avant de sortir.

Les entrées, elles, n'ont PAS changé : mêmes stratégies (momentum 57→64%, breakout 39→31%),
même score médian (91 → 90), même plage (85-108 → 85-94).

## Pourquoi ça explique les DEUX canaux de perte

- Sorties au seuil : le mouvement monte de ~2%, arme le verrou, puis est rendu → sortie à 0 ou sous.
- Stops francs : le mouvement est rendu au-delà de l'entrée et va chercher le stop.
Les deux sont le même défaut : **tenir 8-10 jours un edge de 2 jours**.

**Why:** allonger un horizon est perçu comme un réglage de risque anodin, alors que c'est un
changement de STRATÉGIE. Le sélecteur continue de trouver des configurations de pop à 2 jours ;
personne ne l'a re-calibré. Aucun test ne compare la durée de détention à la durée de vie réelle
de l'edge, donc rien ne signale l'incohérence.

**How to apply:**
1. Avant de toucher `horizon`, mesurer la **durée de vie de l'edge** : à quel jour l'excursion
   favorable médiane culmine-t-elle ? Un horizon supérieur à ce pic transforme un gagnant en
   rendu de gain, mécaniquement.
2. `horizon` et `rotation` ne sont pas des paramètres de risque : ce sont des paramètres de
   STRATÉGIE. Les changer impose de revalider la sélection, pas seulement la sortie.
3. Signature à reconnaître : excursion favorable médiane nettement inférieure à la distance à
   TP1, avec une majorité de sorties au seuil ou au stop. Le sélecteur et la sortie ne visent
   pas la même échelle de temps.
4. Le tagline d'un mode est une documentation utile : quand il dit « 1–2 day plays » et que
   `horizon` vaut 8, l'un des deux ment.

## Statut de l'action

Les variantes H=2 et H=3 ont été testées via `validate-config-change.js` :
turbo H=3 fait passer le rendement pleine période de **−6,54% à −0,33%** ET améliore le DD de
**−11,07% à −9,96%**. Le gate les REFUSE quand même, sur un guardrail de DD absolu à 8% que la
config actuelle viole elle aussi. Voir [[gate-absolute-dd-guardrail-blocks-improvements]].
Aucun changement appliqué : décision remontée au user.
