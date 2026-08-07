---
name: exit-convention-break-20260701
description: Le fill gap-through (sweep.js:1008) est FORWARD-ONLY depuis le 01/07 — pénalité sous le stop = EXACTEMENT 0 avant juillet, -116,2 pts après. Tout avant/après sur backtest-trades.json mélange deux comptabilités et surestime la dégradation d'environ 20%.
metadata:
  type: feedback
---

**Angle mort majeur du diagnostic de juillet 2026 — absent des trois affirmations initiales, et il
invalide leur méthode.**

`tools/sweep.js:1008` — `exitPrice = heldOvernight ? Math.min(currentStop, bar.open) : currentStop` —
a été introduit par `6f80f25ac` (01/07, « realistic gap-through fills — was optimistic »), **reverté**
par `7e078a6b3` le même jour, puis **restauré en FORWARD-ONLY** par `7bf9d8fa2`.

Pénalité sous le niveau de stop recalculée mois par mois sur les **354 trades scellés**
(`sl` : `min(0, pnlPct − distance de stop)` ; `breakeven` : `min(0, pnlPct)`) :

| fév | mars | avril | mai | juin | **juillet** | **août** |
|---|---|---|---|---|---|---|
| 0,0 | -0,0 | -0,0 | +0,0 | -0,0 | **-104,7** | **-11,5** |

Total **-116,2 pts**, et **EXACTEMENT ZÉRO avant juillet**.

Un historique de 5 mois **sans un seul fill sous le stop est physiquement impossible**. Le
track-record scellé mars-mai (**+411 pts**) est mesuré sous une **convention optimiste** et n'est
**PAS comparable** à juillet-août.

**Conséquence directe :** tout diagnostic construit sur un « avant/après » de
`data/backtest-trades.json` mélange **deux comptabilités** et **surestime la dégradation d'environ
116 pts, soit ~20% de la perte brute depuis juin**. Les trois affirmations soumises au panel sont
tombées là-dessus.

**Why:** Un changement de convention de mesure appliqué forward-only est *correct* pour
l'immutabilité (cf. [[immutable-trades]], [[backtest-gap-fills]]) mais crée une **discontinuité de
comptabilité** dans le fichier scellé. Comparer deux cohortes de part et d'autre de cette date, c'est
comparer deux règles de calcul, pas deux performances.

**How to apply:**
- Avant toute comparaison de cohortes sur `data/backtest-trades.json`, **lister les changements
  forward-only de convention de sortie** (`git log -S 'heldOvernight' tools/sweep.js`) et **borner la
  fenêtre à une seule convention**, ou neutraliser explicitement la pénalité gap.
- Test de contrôle en 1 ligne : la somme de `min(0, pnlPct − distance de stop)` sur les sorties `sl`
  d'une période. **Si elle vaut 0 sur plusieurs mois, la période est mesurée sous convention
  optimiste** — c'est le marqueur.
- Toute rupture de convention de mesure doit être **datée et déclarée dans un champ du fichier
  scellé** (pas seulement dans un message de commit), pour que les analyses ultérieures ne puissent
  pas l'ignorer en silence.
