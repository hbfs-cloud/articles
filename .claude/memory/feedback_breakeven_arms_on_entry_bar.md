---
name: breakeven-arms-on-entry-bar
description: Dans simulateTrade, daysHeld++ s'exécute dès la barre d'entrée → la garde `daysHeld > beGraceDays` vaut 1>0 le jour même. Avec beGraceDays=0, un +0,5% intraday colle le stop à l'entrée et sort SOUS l'entrée le lendemain. -66,0 pts vérifiés.
metadata:
  type: feedback
---

**Cause #3 du trou de performance juillet 2026** — trouvée indépendamment par les angles `code` et
`git`, et retrouvée par un relecteur adversarial qui cherchait pourtant à réfuter autre chose.

`tools/sweep.js:989` incrémente `daysHeld++` **dès la première itération, sur `entryDate`**. La garde
du verrou breakeven, `tools/sweep.js:1122` (`if (breakevenPct > 0 && !breakevenActivated && daysHeld >
beGraceDays)`), vaut donc `1 > 0` **le jour même de l'entrée**. Avec `beGraceDays = 0`, un titre qui
touche `+breakevenPct` en intraday **le jour de l'entrée** voit son stop collé à l'entrée
immédiatement — et le remplissage sur gap (`sweep.js:1008`,
`exitPrice = heldOvernight ? Math.min(currentStop, bar.open) : currentStop`) le fait sortir **SOUS
l'entrée** le lendemain.

**Vérifié par test unitaire sur le module réel** (`require` de `tools/sweep.js` ; entrée 100, stop 93,
tp1 115 ; barre d'entrée high 100,6 puis repli à 99,4 puis +12%) :

| beGraceDays | résultat |
|---|---|
| 0 | `{status:'breakeven', pnl:-0,6, hold:2, exit:99,4}` |
| 1 | `{status:'expired', pnl:+12, hold:4}` |
| 2 | `+12` |
| `breakevenPct:0` | `+12` |

**Un seul paramètre transforme +12% en -0,6%.**

**Dans les données scellées :** 39 sorties `breakeven` **avant juillet** totalisent **exactement
0,00 pt**. 49 sorties `breakeven` **depuis juillet** totalisent **-65,96 pts** (28 négatives),
médiane de détention **2 jours**, réparties fortress 16 / dynamic 14 / turbo 12 / aplus 7. Le mix de
sorties bascule : **20% de `breakeven` avant juin → 43% en juillet-août**.

**Configs live au moment du diagnostic :** turbo `be=0,5 / grace=0`, dynamic `be=0,5 / grace=0`,
fortress `be=1 / grace=0`. Seul **aplus** est protégé (`be=3 / grace=3`).

Le manque à gagner sur les positions tuées à J+2 avec un horizon de 8 à 20 séances n'est **pas
quantifiable sans re-simulation** — ne pas l'inventer.

**Why:** Un verrou breakeven est censé protéger un gain *installé*, pas un tick intraday du jour
d'entrée. Armé sur la barre d'entrée, il transforme le bruit d'ouverture en sortie perdante
systématique, et le statut affiché (`breakeven`) masque la perte en la faisant passer pour neutre.

**How to apply:**
- **`beGraceDays >= 1` est obligatoire dès que `breakevenPct > 0`.** Un `grace=0` sur un mode live est
  un défaut de config, pas un choix.
- Si l'on veut la sémantique « N barres pleines de détention », corriger la garde en
  `daysHeld > beGraceDays + 1` **forward-only** (`_effectiveFrom`) — jamais rétroactivement, cf.
  [[immutable-trades]] et [[config-change-forward-only]].
- Signal d'alerte à surveiller dans les stats : une part de sorties `breakeven` qui monte, avec une
  **somme négative** (le statut dit « neutre », la somme dit non) et une médiane de détention de 1-2
  jours sur un horizon de 8-20 séances. Lié à [[backtest-gap-fills]].
