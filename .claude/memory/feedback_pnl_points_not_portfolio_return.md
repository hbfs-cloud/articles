---
name: pnl-points-not-portfolio-return
description: Une somme de pnlPct sur backtest-trades.json n'est PAS un rendement de portefeuille — lignes chevauchantes, 26-32% de doublons cross-modes, 13 stratégies indépendantes. Diagnostiquer à périmètre constant, dédupliqué et corrigé du bêta, sinon on triple la dégradation.
metadata:
  type: feedback
---

**Discipline de diagnostic, issue du post-mortem de juillet 2026 où les trois affirmations soumises
ont toutes échoué au test adversarial — pour la même raison de fond.**

### 1. « -276 pts / -584 pts cumulés » n'est pas une perte

C'est une **somme de `pnlPct` non pondérés par le sizing**, sur des lignes **chevauchantes**,
**dédupliquées à 26-32%**, réparties sur **13 stratégies alternatives indépendantes** (cf.
[[modes-independent]]). **Aucun livre n'a perdu cela.** Les agrégats publiés sur le **même fichier**
affichent `portfolio/v1/all.json` : **ret +43,44%, PF 1,19, dd -13,87%**.

Les points de `pnlPct` servent **uniquement à classer les causes entre elles**, jamais comme une
perte monétaire.

### 2. Le « profit factor 2,54 → 0,24 » est un effet de composition

L'arithmétique brute est exacte, l'interprétation ne tient sur aucun point :
- **8 des 13 modes** de la fenêtre n'ont **aucun trade avant le 16/06** et portent **82% de la perte** ;
- à **périmètre constant**, dédupliqué sur `(ticker, scanDate)` et **corrigé du bêta SPY trade par
  trade** sur la fenêtre exacte de détention (`data/bench-spy.json`) : alpha **+1,01% → -0,69%**, soit
  **~1,7pp** — pas les 4,6pp bruts revendiqués. Le PF like-for-like passe de **2,29 à 0,56**, pas à 0,24 ;
- les bornes de fenêtre ne correspondent à aucun événement : la cohorte **après** le 13/07 est deux
  fois pire, ce qui **détruit** le récit « filtre cassé puis réparé » ;
- **33% de la perte de la fenêtre** vient de **6 lignes synthétiques à -15,00 exact**, toutes datées
  du **dernier jour** de la fenêtre choisie (cf. [[dtx-modes-cloned-risk-block]]).

Formulation honnête de ce qui reste : *« à partir de la mi-juin, 8 modes expérimentaux non validés
entrent dans le même fichier de trades, dans un marché passé de +9,5% à plat, et l'alpha des modes
historiques se dégrade d'environ 1,7pp par trade »*. C'est réel. **Ce n'est pas le sujet.**

### 3. « La restauration du 14/07 n'a pas ramené la performance, donc il reste une cause cachée »

Non-sequitur. La restauration **n'a jamais touché l'input des modes historiques** : leurs scores
d'entrée sont **85-108 avant, 85-91 pendant, 88-94 après** — distribution inchangée dans les trois
fenêtres. Il n'y avait rien à restaurer pour eux. Et la performance **ne stagne pas, elle progresse** :
PF **0,147** (01→13/07), **0,200** (14→31/07), **0,611** (août). Enfin le chiffre est un **artefact
closed-only** : 17 positions ouvertes des modes historiques marquent **+0,53%** en moyenne ; marks
inclus, PF **0,489** et **-0,79%/trade**.

**Why:** `data/backtest-trades.json` agrège des lignes **dupliquées entre modes**, sur **deux
conventions comptables** différentes (cf. [[exit-convention-break-20260701]]), dans un marché passé de
**+9,5% à plat**. Un « avant/après » naïf sur ce fichier attribue à un mécanisme de sélection ce qui
est un effet de composition, de bêta et de convention. C'est exactement l'erreur qu'ont commise les
trois hypothèses initiales.

**How to apply — protocole obligatoire avant d'affirmer une dégradation :**
1. **Périmètre constant** : ne comparer que les modes présents dans les DEUX fenêtres.
2. **Dédupliquer** sur `(ticker, scanDate)` — un même ticket répliqué sur N modes compte 1 fois.
3. **Corriger du bêta** SPY trade par trade sur la fenêtre exacte de détention (`data/bench-spy.json`).
4. **Une seule convention de mesure** par comparaison (test de la pénalité gap = 0).
5. **Inclure les marks** des positions ouvertes, ou déclarer explicitement le biais closed-only.
6. Ne jamais présenter une somme de `pnlPct` comme un rendement.
