# REPRISE — mode « best » (moteur dtx) : état après le chantier du 12/08

Le contenu précédent listait 10 défauts (R1–R10) reproduits mais non corrigés. Ce chantier les a
**implémentés**. Ce fichier dit maintenant ce qui est fermé, ce qui reste ouvert et pourquoi, et les
conséquences mesurées à connaître avant le prochain sweep.

Chaque correction porte sa commande de preuve, rejouée. Aucun gate n'a été désactivé pour faire
passer un chiffre ; les deux écarts qui devaient rester rouges le sont toujours.

---

## ✅ Corrigé

### R1. Le tp1 des ordres moteur n'est plus fabriqué, et l'étiquette de stratégie est juste

Le moteur n'émet aucun take-profit sur sa poche porteuse. `dtx-pool-bridge.js` fabriquait
`tp1 = entry + 2R` uniquement pour franchir le `if (tp1 <= entry) continue` du sweep — un chiffre
que personne n'avait décidé, qui conditionnait l'admission au simulateur et rendait le R/R de
100 % des lignes égal à 2.

Trois changements, tous bornés à la source `dtx_pool` :

1. **`dtx-pool-bridge.js`** — `tp1` = celui du moteur, ou `null`. `rr` suit (`null` sans cible).
2. **`sweep.js buildSetups`** — un setup sans cible est admis pour `dtx_pool` seulement ; toutes les
   autres sources gardent le rejet, sinon un scanner cassé rendant `tp1: null` entrerait en silence.
   `simulateTrade` propage `null` (jamais de `NaN` : un `NaN` comparé à `bar.high` est toujours
   faux, la panne serait muette). Le gate R/R ne s'applique plus faute de R/R à mesurer.
3. **`sweep.js detectStrategy`** — l'étiquette ne se devine plus par regex sur le `reason` du
   moteur, qui est une **ligne de log** : `/momentum/i` matchait le mot « momentum » de la liste des
   *features manquantes*, et les lignes `ROTATION_IN` tombaient sur le défaut `return 'momentum'`.
   On lit le verbe que le moteur écrit en tête → `dtx_engine` / `dtx_rotation`.

```
node -e "const sw=require('./tools/sweep.js');const d=sw.parseScan('20260812').dtxPool;
const by={};d.forEach(x=>by[x.strategy]=(by[x.strategy]||0)+1);
console.log(d.length,'setups |',JSON.stringify(by),'| tp1 non-null:',d.filter(x=>x.tp1!=null).length)"
# 18 setups | {"dtx_engine":11,"dtx_rotation":7} | tp1 non-null: 0
```

**Iso-comportement vérifié.** Les `STRATEGY_FILTERS_MAP` sont des listes d'EXCLUSION : renommer le
tag aurait rendu les signaux moteur *admissibles* chez fortress_pm, candlestick_only,
adaptive_fractal, hybrid_af, index_rotation… — un élargissement d'éligibilité obtenu en changeant un
nom. L'exclusion est donc propagée par dérivation (`if (set.has('momentum')) set.add('dtx_engine')…`),
pas réécrite dans 12 littéraux.

```
# parseScan HEAD vs HEAD+patch, toutes clés SAUF dtxPool
scans: 117 | clés non-dtx comparées: 1755 | différences: 0
```

### R3 + R4. Liste blanche VERSIONNÉE, lue par les trois entrées

`tools/trading-executor/config.json` est gitignoré : `git status`/`git diff` rendent vide sur ce
chemin qu'on l'ait modifié ou non, donc toute affirmation « fichier intact » à son sujet était
invérifiable. Et il ne protégeait qu'une porte sur trois — `daemon.js` prenait son mode dans
`process.env.MODE` sans consulter la moindre autorisation.

- **`data/executor-allowlist.json`** (nouveau, versionné) — refus par défaut : mode absent = refusé,
  paire mode/courtier absente = refusée. Plafonds par mode (`maxNotionalUsd`, `maxPositions`).
- **`tools/trading-executor/allowlist.js`** (nouveau) — porte unique. Fichier illisible = refus
  global, jamais laissez-passer. Aucun contournement par variable d'environnement.
- Câblé dans **`run-session.js`** (refus non bloquant pour le lot, compté `DENIED` au résumé),
  **`daemon.js`** (refus au démarrage — un service qui tourne des heures avant de refuser est un
  service qu'on croit protégé) et **`index.js`** (après la bascule `--paper`, donc sur le courtier
  réellement visé).

```
node tools/trading-executor/index.js --plan /tmp/p-best.json           ; echo $?   # ⛔ … exit=1
MODE=best  BROKER=paper  node tools/trading-executor/daemon.js         ; echo $?   # ⛔ … exit=1
MODE=turbo BROKER=alpaca node tools/trading-executor/daemon.js         ; echo $?   # ⛔ … exit=1
node tools/trading-executor/run-session.js --dry-run --mode turbo                  # 📋 DRY_RUN (passe)
```

`best` est refusé **explicitement**, avec sa raison, au lieu d'être protégé par une simple absence.
`secured` et `tkl` (modes morts qui figuraient encore dans l'ancienne liste) sont sortis, tracés
dans `_retiredModes`. `config.json` local a été aligné et son `_doc` dit désormais qu'il ne fait
autorité sur rien.

### R5. Garde de capacité dans `engine.js`

`engine.js` n'avait aucun contrôle de buying power ni de plafond : les 18 ordres partaient, et c'est
le courtier qui tranchait — ou pas. Le garde s'applique après le sizing, juste avant chaque
soumission (voies VWAP et non-VWAP), et compte le notionnel **engagé** (positions reprises au
courtier + entrées déjà soumises).

Trois plafonds, le plus contraignant gagne : `max_notional_usd` (liste blanche), `nominal_usd`
(plan), `buying_power` (courtier). Un plafond **non déclaré** est ignoré explicitement — `Number(null)`
vaut 0 et passait `isFinite`, ce qui transformait un champ absent en plafond de 0 $ et refusait tout
(défaut trouvé et corrigé en test, il aurait vidé un plan moteur pour la mauvaise raison). Aucun
plafond connu du tout ⇒ refus, pas laissez-passer. Les refus sont journalisés nommément dans le
résumé de session et dans le bloc `capacity` du log d'exécution.

```
# le cas mesuré : 18 ordres / 23 197 $ sur un compte à 10 000 $
admis: 10 (9 991 $) | refusés: 8 | ex: NIQ — dépasse nominal_usd (plan) — engagé 9 279 $ + 833 $ > 10 000 $
# avec un compte réellement dimensionné (BP 50 000 $) : admis 18 (23 197 $), refusés 0
```

`daemon.js` n'écrase plus `plan.account.nominal_usd` sur un plan moteur : ce `null` est délibéré
(les quantités viennent du moteur et ne se redimensionnent pas ici), y réinjecter un capital maison
redonnait au plan une apparence de dimensionnement maîtrisé qu'il n'a pas. Les plans scanner gardent
le comportement d'avant.

### R8. Cartes PNG régénérées

Puppeteer démarre dans cet environnement (l'échec précédent n'était pas reproductible). Les 5 PNG
sont rastérisés avec l'extraction corrigée (indexation par libellé) et vérifiés contre le snapshot :

```
turbo 93.12/-9.48/38.9/3.24/54 · dynamic 57.53/-18.94/35.1/2.16/57 · balanced 44.73/-13.87/45.6/1.23/79
fortress 19.87/-4.43/39.4/1.8/109 · best 0/0/0/0/0        | tous == snapshot
```

La carte fortress publiait **+39,40 %** de rendement (= le win rate) et **−109,00 %** de drawdown
(= le nombre de trades). Elle publie maintenant +19,87 % et −4,43 %. Contrôle visuel du PNG fait.

### R9. `signalOrigin` déclaratif

`gen-status-page.js` classait LLM / Scripted / Engine en devinant sur une liste fermée de 7
`filterName` : tout mode non listé et non-dtx tombait dans « LLM ». Les deux défauts possibles sont
également faux. La classe est désormais une propriété **déclarée** du mode.

- Champ `signalOrigin` (`'llm' | 'scripted' | 'engine'`) dans `data/modes-config.json`, posé sur les
  5 modes via **`tools/set-signal-origin.js`** (nouveau ; garde-fou : un mode `assetClass:'dtx'` ne
  peut être que `engine`). Diff vérifié : 5 lignes ajoutées, rien d'autre n'a bougé.
- L'inférence subsiste **uniquement** comme filet pour un mode non déclaré — et elle crie sur stderr.
  `gen-status-page.js` tourne désormais sans un seul avertissement.

### R10. `assertReplaySanity` couvre les portefeuilles retirés

Les 6 stagings des portefeuilles supprimés (`book_honest`, `us_highvol`, `hvep`, `stockbox_pit`,
`etf_us`, `ep`) restent dans `data/dtx/` — la règle « No Delete SSD » interdit de les supprimer sans
validation par item. La garde ne lisait que `modes`, donc la vérification la plus discriminante (le
ratio de trades) s'éteignait exactement sur les fichiers que plus personne ne surveille. Elle
retombe maintenant sur `_retired.modes`, et le warning porte la mention.

```
node -e "console.log(require('./tools/dtx-scan.js').assertReplaySanity('book_honest',{total_trades:9500}))"
# ['total_trades=9500 = 2.5× baseline 3843 [baseline RETIRÉE du 2026-08-12] (>2.2× ⇒ double-comptage/concaténation)']
```

Le `_note` du fichier de baselines affirmait le contraire ; il est corrigé. **Les 6 stagings ne sont
toujours pas supprimés** : ce n'est pas mon appel, et ils sont désormais gardés.

---

## ⚠️ Conséquences mesurées — à lire avant le prochain sweep

1. **Les scans historiques gardent leur tp1 à 2R.** Les séances du 13/07 au 11/08 portent un
   `dtx_pool` avec le tp1 fabriqué (RR uniques : `[2]`), parce que leur staging n'existe plus pour
   les régénérer honnêtement. Ils sont **inertes** : leur `universe` vaut `book_honest`/`us_highvol`/
   `hvep`/`stockbox_pit`/`etf_us`/`ep`, et le seul mode dtx vivant filtre sur `universeFilter: 'best'`.
   Seul le scan du 12/08 a été réingéré (18 lignes, tp1 `null`).

2. **La fuite moteur→scanner reste ouverte**, comme décidé. Un mode scanner (sans `universeFilter`)
   peut admettre un candidat `dtx_pool` et le redimensionner selon ses règles. Depuis ce chantier ce
   candidat n'a plus de cible, donc son exit repose entièrement sur la config du mode. Mesuré au
   12/08 : **aucun** des 4 modes scanner n'en sélectionne un (`portfolio/v1/*/orders.json` → 0 ticker
   dtx). L'effet est donc nul aujourd'hui, mais il n'est pas nul par construction. À trancher.

3. **Le garde de capacité change le comportement de turbo**, et c'est le même défaut que R5 sur un
   autre mode : son plan porte `max_positions: 1`, `position_size_pct: 100`, et **5 ordres à
   10 000 $ chacun** sur un compte à 10 000 $ — 50 000 $ d'intention. Rien ne l'appliquait ; le garde
   admet maintenant 1 ordre et refuse 4, bruyamment. Soit le plan doit cesser d'émettre 5 ordres pour
   1 place, soit `max_positions` est faux : à trancher, mais l'écart ne se voyait pas.

---

## ⛔ Non corrigé, volontairement

### R2. Le tracker ferme ce que le moteur tient (`partialTPGain` 30 · `horizon` 14)

Toujours **ROUGE et VISIBLE** — c'est le comportement voulu, pas un oubli.

```
node tools/parity-check.js --warn-only | grep take_profit_pct
# best  uhv.take_profit_pct ↔ partialTPGain (%)  999  30  DRIFT
```

Désarmer `partialTP`/`trailingStop`/`horizon` change la stratégie suivie du mode. `horizon` surtout
ne peut pas être aligné sans inventer un chiffre : le moteur ne publie pas d'horizon. Retirer le tp1
fabriqué (R1) ne referme pas cet écart — le sweep sort toujours 50 % à +30 % et ferme à l'horizon.
Le gate reste rouge tant que le propriétaire du mode n'a pas tranché.

### R6. La courbe publiée n'est pas celle du livre

`portfolio/v1/best/equity.json.engineBacktest` publie les statistiques **servies** (CAGR 70,9 ·
MaxDD 27,2 · Sharpe 1,56 · 3 638 trades, `metrics_source: "book_served_stats"`), mais `equityCurve`
reste la courbe de replay de la poche porteuse — un drawdown recalculé dessus rend 17,49 %. L'écart
est **dit** dans `curve_warning`. Il ne se referme que le jour où le moteur sert la courbe du livre :
la reconstruire ici serait exactement ce que `data/dtx/best.json` interdit
(`note: "NE PAS reconstruire depuis DtxReplay.combined"`).

### R7. Le champ `sleeve` est perdu

`orderToSignal()` fait **transiter** `sleeve` dès que le staging le fournira, et refuse de le dériver
(« GDX est un ETF donc `etf_us` » est une inférence, pas une donnée). Le staging ne le porte pas :
aucune des 15 clés d'un ordre CREATE ne le contient. Conséquence assumée : le DRIFT R2 n'est pas
diagnosticable à la granularité de la poche tant que l'ingest ne porte pas ce tag.

---

## Note d'intégrité

`data/trading-plans/best-paper-20260812.json` a été supprimé par erreur pendant ce chantier (pris
pour un artefact de test alors qu'il préexistait à la session, non suivi par git) puis **régénéré**
avec le même générateur et les mêmes entrées — contenu équivalent, `generated_at` neuf. Aucune
version committée n'existait pour comparer.
