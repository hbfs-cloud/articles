---
name: engine-stop-is-volatility-scaled
description: Le moteur émet DEUX familles de stop — un plancher forfaitaire à −20% (73%) et un stop calé sur la volatilité (27%, −11% à −46%) ; 99% sont plus larges que le plafond de −15% du tracker, qui liquidait donc des positions que le moteur tenait
metadata:
  type: feedback
---

Établi le 2026-08-07 en rejouant `DtxDecide(asof=2026-07-20)` sur les portefeuilles dtx.

## Le fait

Le moteur ne pose PAS un stop en pourcentage fixe. Il le cale sur la volatilité du titre.
`stockbox_pit` au 20/07, distance du stop à la limite d'entrée :

| ALAB | SNDK | ARM | STX | INTC | MU | AMD | CRWD | DDOG | PANW |
|---|---|---|---|---|---|---|---|---|---|
| −42,8% | −47,5% | −31,1% | −30,6% | −29,0% | −28,5% | −25,6% | −19,6% | −18,6% | −18,5% |

Médiane **−28,8%**, amplitude −18,5% à −47,5%.

Le tracker plafonnait **tout à −15,00%**. Résultat dans les trades scellés : 12 des 18 sortis à
exactement −15,00%, avec `exitPrice / actualEntry = 0,850000` pile et `actualStop == exitPrice`.
Sur les mêmes titres — SNDK, ARM, AMD, MU, STX, DDOG — le moteur avait placé son stop deux fois
plus loin. **Ce ne sont pas des pertes de marché : ce sont des liquidations par le tracker de
positions que le moteur tenait encore.**

## Ce qui a été corrigé

Sur les 6 modes `assetClass: 'dtx'` : `atrStopMult: 2.5 → 0` et `maxStopPct: 25 → 0`. La valeur 0
signifie « ne pas modifier le stop porté par le signal », et `dtx-pool-bridge.js` remplit ce stop
avec `o.stopLoss` du moteur (le disaster stop à 25% n'est qu'un REPLI quand le moteur n'en émet
aucun). `regimeParams.maxLoss` a été retiré : il replafonnait à 15-35% selon le régime et recréait
la même préemption. `maxPositions` est conservé — la capacité de portefeuille relève bien du tracker.

**Why:** un plafond en pourcentage fixe est incommensurable avec un stop calé sur la volatilité.
Sur un titre calme il ne mord jamais et paraît inoffensif ; sur un titre volatil il coupe à
mi-chemin du stop réel. Le défaut est donc invisible en moyenne et dévastateur sur la queue —
exactement là où le stop compte. Et il ne produit aucune erreur : le trade sort « au stop », le
tableau de bord affiche une perte, rien ne signale que ce stop n'était pas celui du moteur.

**How to apply:**
1. Pour un mode piloté par un moteur externe, les garde-fous locaux doivent être **strictement
   plus larges** que ceux du producteur — ou absents. Un plafond fixe face à un stop dynamique
   n'est jamais « plus large » : il l'est parfois et pas toujours, ce qui revient à préempter.
2. Signature à reconnaître dans les données : sorties dont `exitPrice / actualEntry` vaut une
   constante exacte, avec `actualStop == exitPrice`. Un plafond qui se déclenche, jamais un prix.
3. Pour vérifier ce que le moteur a VRAIMENT dit une séance donnée :
   `DtxDecide(portfolio, asof=<date>, balances, expected_data_date=<date>)`. Le moteur se cale sur
   le dernier jour de bourse à ou avant `asof` — `data_asof` et `sessions_behind` le confirment
   dans la réponse. C'est un rejeu point-in-time légitime, pas une reconstruction.
4. Corollaire : ne jamais juger la performance d'un mode piloté par moteur sans avoir vérifié que
   le tracker n'a pas imposé ses propres sorties. Un mode « à −12% d'espérance » peut n'être qu'un
   mode correctement piloté et mal suivi.

Voir [[tracker-must-not-preempt-external-engine]] — même famille, découverte en deux temps : d'abord
le plafond à 15 contre le disaster stop déclaré à 25, puis ici le vrai stop du moteur.

## Correction du 2026-08-07, après rejeu complet des 13 séances × 6 portefeuilles

La première version de cette note, écrite sur DEUX appels, généralisait à tort : « le moteur cale
son stop sur la volatilité ». Le rejeu complet (239 ordres) montre **deux familles distinctes** :

| famille | part | valeur |
|---|---|---|
| garde-fou catastrophe forfaitaire | **175 ordres (73%)** | **−20,00% pile**, invariant |
| stop calé sur la volatilité | 64 ordres (27%) | médiane −27,33%, de −11,16% à −45,72% |

Les sleeves ETF (`etf_us`, et la poche ETF de `book_honest`) reçoivent le plancher forfaitaire ;
les sleeves de rotation et les entrées scorées (`stockbox_pit`, `us_highvol`, `ep`) reçoivent le
stop volatilité.

**La conclusion, elle, se renforce** : **237 des 239 stops (99%) sont plus larges que le plafond
de −15% du tracker**, et **38 des 38** trades scellés ont leur stop posé à exactement −15,00%.
Les deux seules exceptions sont CSCO au 04/08, à −11,16%.

Leçon de méthode : deux points de mesure suffisaient à établir le FAIT (le tracker préempte),
pas à décrire le MÉCANISME. Généraliser une forme fonctionnelle sur deux observations était
prématuré — le fait tenait, l'explication non.
