---
name: rr-gate-is-decorative
description: Sur 5 scans publiés, la cible TP1 est calculée comme la distance au stop × un coefficient quasi constant — le R/R n'est pas mesuré sur le graphique, il est fabriqué pour franchir son propre plancher
metadata:
  type: feedback
---

Établi le 2026-08-08 en reconstruisant la grille de niveaux du scan 20260810, puis en
mesurant les scans déjà publiés.

## La preuve

Pour chaque ligne publiée, distance au stop et distance à TP1 exprimées en multiples d'ATR :

| scan | stop (moy ± σ) | TP1 (moy ± σ) | **R/R (moy ± σ)** |
|---|---|---|---|
| 20260803 | 2,29 ± **1,61** | 4,12 ± **2,90** | 1,80 ± **0,077** |
| 20260804 | 1,79 ± 0,13 | 2,72 ± 0,21 | 1,52 ± **0,016** |
| 20260805 | 1,99 ± 0,31 | 3,12 ± 0,43 | 1,58 ± **0,046** |
| 20260806 | 2,10 ± 0,52 | 3,38 ± 0,89 | 1,61 ± **0,047** |
| 20260807 | 2,00 ± 0,32 | 3,11 ± 0,55 | 1,55 ± **0,036** |

Le 20260803, la distance au stop va de 0,7 à 3,9×ATR selon les lignes, la distance à la
cible suit dans les mêmes proportions, et le rapport tient à 1,80 ± 0,077. Deux grandeurs
qui varient chacune d'un facteur 5 tout en gardant un rapport constant à 4% près ne sont
pas mesurées indépendamment : la seconde est dérivée de la première.

**TP1 ≈ distance au stop × 1,55-1,80.** La cible n'est pas lue sur le graphique.

## Ce que ça implique

Le gate `rr-min-by-regime` (RISK-ON 1,5, EARLY RISK-OFF 2,0), classé `hard_block`, ne
peut structurellement pas mordre : le nombre qu'il contrôle est construit pour le
franchir. Cinq scans, quarante-huit lignes, zéro rejet — non parce que la sélection est
excellente, mais parce que le test se vérifie lui-même.

`validate-scan.js` aggrave le point : il LIT le champ texte `rr` et parse « 1:X » plutôt
que de recalculer depuis entry/stop/tp1. Il valide donc l'affirmation du producteur.
`qa-check.js` recalcule, lui — c'est pourquoi les deux gates ont donné des verdicts
opposés sur le même scan le 2026-08-08.

Lien avec la sous-performance des modes : si la cible est posée à un multiple du stop et
non sur une offre réelle, TP1 n'est atteint que par chance. L'espérance réalisée est celle
que donne le marché, jamais celle qu'annonce le ratio. Un panier affiché à 1,55 de R/R
moyen dont la moitié des cibles n'existe pas dans le carnet n'a pas 1,55 d'espérance.

## Contre-épreuve

En reconstruisant la grille sur des niveaux RÉELS — stop sur un creux de swing coté ou une
moyenne, cible sur la première zone d'offre réellement cotée — aucune des 32 candidatures
du 2026-08-10 n'atteint 1,5, le maximum étant 1,46. Et la même grille appliquée aux quatre
lignes publiées le 07/08 les rejette toutes les quatre. Inversement, toute variante qui
reproduit les scans publiés le fait en rendant le R/R constant (1,73 sur les quatre, soit
exactement 2,6/1,5). Les deux régimes s'excluent : ou bien les niveaux sont mesurés et le
plancher n'est presque jamais atteint, ou bien ils sont fabriqués et le plancher est
toujours atteint.

**Why:** un ratio dérivé de ses propres composantes ne porte aucune information sur le
marché. Publier « R/R 1:1,55 » quand 1,55 est le coefficient choisi, et non une asymétrie
constatée, donne au lecteur une garantie qui n'existe pas — et prive l'équipe du seul
signal qui aurait dû arrêter les mauvais scans.

**How to apply:**
1. `validate-scan.js` doit RECALCULER le R/R depuis entry/stop/tp1 au lieu de parser le
   champ `rr`. Un gate qui lit la conclusion du producteur ne contrôle rien.
2. La cible TP1 doit provenir d'un niveau OBSERVÉ : pivot haut coté, plus haut 52 semaines,
   zone de congestion. Le mouvement mesuré en ATR reste légitime en zone vierge avérée —
   quand il n'existe RIEN au-dessus — et doit alors être étiqueté comme tel.
3. Contrôle de non-circularité, bon marché et décisif : sur un scan, si σ(R/R) est petit
   devant σ(stop en ATR) et σ(TP1 en ATR), la cible est dérivée du stop. Seuil pratique :
   σ(R/R) < 0,10 avec σ(TP1) > 0,4 = alerte.
4. Conséquence à assumer : avec des niveaux honnêtes, il y aura des séances sans aucun
   setup publiable. C'est le cas du 2026-08-10. Une sélection qui produit dix lignes tous
   les jours ouvrés, quel que soit le marché, ne sélectionne pas.

Voir [[gates-certify-green-on-nothing]] — même famille : un contrôle qui répond vert sur
ce qu'il ne regarde pas.
