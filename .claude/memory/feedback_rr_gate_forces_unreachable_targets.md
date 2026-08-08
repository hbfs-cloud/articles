---
name: rr-gate-forces-unreachable-targets
description: Backtest 30 jours, 96 trades — le plancher de R/R à 1,5 impose mathématiquement une cible à ≥2,25×ATR, atteinte 12% du temps ; ramener la cible à 1,5×ATR quadruple l'espérance
metadata:
  type: feedback
---

Backtest du 2026-08-08 sur les 21 scans publiés du 10/07 au 07/08 : 196 lignes éditoriales,
169 tickers, barres quotidiennes réelles, règles de remplissage et de sortie du dépôt
(entrée = min(ouverture, cours moyen pondéré) bornée au plus bas ; sortie au stop uniquement
si le stop a été coté, sinon à l'ouverture).

## Ce que fait la méthode actuelle

Sur l'échantillon NON CENSURÉ (horizon écoulé, n=96) :

| | |
|---|---|
| taux de réussite | 41,7% |
| **espérance** | **+0,025 R** |
| médiane | −0,45 R |
| TP1 atteint | 12 / 96 = **12,5%** |
| stoppé | 46 / 96 = 47,9% |
| sorti à l'horizon | 38 / 96 = 39,6%, à +0,71 R en moyenne |

Piège de mesure à connaître : sur l'échantillon COMPLET (n=123, scans récents inclus)
l'espérance ressort à −0,072 R. C'est un artefact de CENSURE — sur un scan récent, seuls les
stops rapides sont clos, les gagnants courent encore. Ne jamais agréger des scans dont
l'horizon n'est pas écoulé.

## La cause

R/R moyen ANNONCÉ : 1,704 → il faudrait 37,0% de réussite pour qu'il ait un sens.
Réussite CONSTATÉE : 12,5%.

La raison est physique, pas statistique :

  distance moyenne à la cible ....... 8,48%
  meilleur gain latent moyen (MFE) .. 4,38%

**La cible est deux fois plus loin que là où le prix va.** L'espérance ne reste positive que
grâce aux sorties à l'horizon, jamais grâce aux cibles.

## La correction, mesurée

Mêmes lignes, mêmes entrées, mêmes stops — SEULE la cible change (n=88, les 8 lignes sans
champ ATR sont exclues) :

| cible | TP1 atteint | espérance |
|---|---|---|
| publiée | 12 | +0,025 R |
| 1,0×ATR | 41 | +0,071 R |
| 1,25×ATR | 36 | +0,089 R |
| **1,5×ATR** | **31** | **+0,108 R** |
| 1,75×ATR | 27 | +0,061 R |
| 2,0×ATR | 21 | +0,055 R |
| 2,5×ATR | 14 | +0,035 R |

Courbe à optimum net, monotone de part et d'autre — ce n'est pas du bruit de sur-ajustement.
1,5×ATR **quadruple** l'espérance.

## L'incompatibilité, et c'est le point

Un stop doit être ≥ 1,5×ATR (plancher de bruit, règle `stops-min-atr-multiple`). Une cible à
1,5×ATR donne donc un R/R ≤ 1,0. Sur les 26 candidats du 2026-08-10, cible à portée : R/R
moyen **0,74**, meilleur 0,97.

Exiger R/R ≥ 1,5 revient donc à exiger une cible à **≥ 2,25×ATR**, que le backtest montre
atteinte 12 à 21% du temps.

**Le plancher de R/R à 1,5 n'est pas un garde-fou contre les mauvais trades : c'est la cause
des cibles inatteignables.** Il sélectionne pour l'inatteignabilité.

**Why:** un ratio n'est pas une espérance. Exiger un ratio élevé sans contrainte
d'atteignabilité pousse mécaniquement la cible au-delà de la portée du titre sur l'horizon,
et transforme des trades gagnants en sorties à l'horizon — ou en stops, le temps que le prix
reparte. Le gate optimise la promesse, pas le résultat.

**How to apply:**
1. Remplacer le critère de R/R minimum par un critère d'ESPÉRANCE : la cible doit être à une
   distance que le titre parcourt réellement sur l'horizon. Repère mesuré : ≈1,5×ATR sur 10
   séances.
2. Si un plancher de ratio est conservé pour la lisibilité, il doit être cohérent avec le
   plancher de stop : avec stop ≥ 1,5×ATR et cible ≈ 1,5×ATR, le ratio annoncé sera proche
   de 1,0. Il faut l'assumer plutôt que de gonfler la cible.
3. Contrôle d'atteignabilité à ajouter au scan : comparer la distance à la cible au MFE
   médian historique du titre sur l'horizon. Cible > 2× MFE médian = cible décorative.
4. Ne JAMAIS agréger des scans dont l'horizon n'est pas écoulé : la censure biaise
   l'espérance vers le bas de façon massive (−0,072 contre +0,025 ici).

Voir [[rr-gate-is-decorative]] — la première moitié du constat : le ratio était fabriqué.
Celle-ci en donne le coût mesuré.
