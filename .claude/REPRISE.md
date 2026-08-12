# REPRISE — mode « best » (moteur dtx) : ce qui reste après la revue contradictoire du 12/08

Le contenu précédent de ce fichier (sélection du scan 20260812 « rien n'est publié ») était
PÉRIMÉ : ce scan est publié, indexé (`data/scanner.json`), `index.html` fait 66 861 octets et
`validate-scan` passe. Remplacé par l'état réel du chantier « best ».

Les défauts ci-dessous sont **reproduits, pas relus**. Chacun porte sa commande de preuve.
Aucun n'est masqué ; aucun n'a été « corrigé » en désactivant un gate.

---

## ⛔ BLOQUANT AVANT LE PROCHAIN SWEEP — la chaîne rend la décision irréversible

### R1. Le tp1 des ordres moteur est FABRIQUÉ (2R), et l'étiquette de stratégie est fausse

Le moteur n'émet aucun take-profit (poche `tp999` : `takeProfit: null` sur 18/18 ordres).
`tools/dtx-pool-bridge.js` fabrique `tp1 = entry + 2×(entry − stop)` parce que le schéma du sweep
l'exige (`sweep.js` : `if (tp1 <= entry) continue`). Ce tp1 inventé n'est pas décoratif — il
**conditionne l'admission** au simulateur, et `detectStrategy` étiquette les 18 lignes `momentum`.

```
node -e "const sw=require('./tools/sweep.js');const d=sw.parseScan('20260812').dtxPool;
const by={};d.forEach(x=>by[x.strategy]=(by[x.strategy]||0)+1);
console.log(d.length,'setups |',JSON.stringify(by),'| R/R uniques:',[...new Set(d.map(x=>+((x.tp1-x.entry)/(x.entry-x.stop)).toFixed(2)))])"
# 18 setups | {"momentum":18} | R/R uniques: [ 2 ]   ← 2R synthétique sur 100 % des lignes
```

Rendre le tp1 honnête tue le mode (`tp1: null` → rejeté ; un tp1 honnête faible → rejeté aussi).
Et l'étiquette `momentum` fait **entrer** le gate R/R (`RR_GATE_STRATEGIES`), qui n'a aucun sens
sur un ordre moteur sans cible.

Pourquoi c'est bloquant : le premier trade scellé fige le tout dans la chaîne SHA-256
(`hashTrade` inclut `strategy`, `status`, `exitPrice`, `pnlPct`). Après, toute correction des
sorties casse la chaîne — et `sweep.js` avorte alors le sweep de **TOUS** les modes.

**Ce qu'il faudrait** : trancher AVANT le premier sweep. Soit le schéma du sweep accepte un setup
sans cible (`tp1: null` admis pour `source === 'dtx_pool'`, sorties déléguées au moteur), soit
`best` ne passe pas par le simulateur du scanner et son suivi vient du moteur. Décision du
propriétaire du staging — pas un choix de code.

### R2. Le tracker ferme ce que le moteur tient (`partialTPGain` 30 · `horizon` 14)

```
node tools/parity-check.js --warn-only | grep take_profit_pct
# best  uhv.take_profit_pct ↔ partialTPGain (%)  999  30  DRIFT
node -e "const c=require('./data/modes-config.json').modes.best;console.log({partialTP:c.partialTP,partialTPGain:c.partialTPGain,horizon:c.horizon,trailingStop:c.trailingStop})"
# { partialTP: true, partialTPGain: 30, horizon: 14, trailingStop: true }
```

La poche porteuse est `tp999` : le moteur ne prend **jamais** de profit, c'est la queue qui porte
le CAGR servi de 70,9 %. Le sweep, lui, sort 50 % à +30 % et ferme à l'horizon. Même famille que
l'incident du 2026-08-07 (préemption du stop moteur). Le DRIFT est **actif en production** et
scellera de vrais trades dès le premier sweep.

Non corrigé ici **volontairement** : désarmer `partialTP`/`trailingStop`/`horizon` change la
stratégie suivie du mode. `horizon` surtout ne peut pas être aligné sans inventer un chiffre — le
moteur ne publie pas d'horizon. Le gate reste ROUGE et VISIBLE (`qa-check` le remonte en ⚠️),
ce qui est le comportement voulu : il ne se corrige pas en le taisant.

---

## ⛔ BLOQUANT AVANT TOUTE EXÉCUTION COURTIER

### R3. La liste blanche ne protège rien, et sa « preuve d'intégrité » est vide de sens

`tools/trading-executor/config.json` n'est **pas suivi par git** :

```
git check-ignore -v tools/trading-executor/config.json
# .gitignore:52:tools/trading-executor/config.json
git ls-files --error-unmatch tools/trading-executor/config.json
# error: pathspec ... did not match any file(s) known to git
```

Conséquence : tout `git status --porcelain` / `git diff` sur ce chemin rend vide, qu'on l'ait
modifié ou non. Les affirmations « fichier intact » des rapports précédents (celui-ci compris)
sont **non falsifiables**. Le fichier n'a pas été touché — mais rien ne permet de le prouver.

Son contenu actuel : liste blanche `["turbo","dynamic","balanced","secured","fortress","tkl"]` —
`best` absent (c'est ce qui protège aujourd'hui), mais `secured` et `tkl` sont deux modes
**supprimés du catalogue**, et le `_doc` parle encore de « all 6 modes ». Un rempart qui référence
des morts est un rempart que personne n'a relu.

Non corrigé ici : le mandat interdit explicitement de toucher ce fichier dans ce chantier.

### R4. `daemon.js` ignore totalement la liste blanche

```
grep -n "config.json\|accounts\|whitelist" tools/trading-executor/daemon.js   # AUCUN résultat
grep -n "process.env.MODE" tools/trading-executor/daemon.js                   # 19:const MODE = process.env.MODE;
```

`run-session.js` lit `config.json` ; `daemon.js` prend le mode dans `process.env.MODE` et ne
consulte **jamais** la liste blanche ; `index.js` prend un `--plan` déjà écrit. Depuis que la voie
dtx est implémentée dans `gen-trading-plan.js`, `MODE=best BROKER=alpaca node daemon.js` génère le
plan et l'exécute chez le courtier, liste blanche ou pas.

L'ordre imposé par le mandat (« le générateur d'abord, la liste blanche jamais dans ce chantier »)
a été respecté, et le générateur est réparé — mais la protection restante ne couvre qu'**une** des
trois portes d'entrée.

### R5. 18 ordres · 23 197 $ de notionnel sur un compte à 10 000 $, sans garde d'exposition

```
node tools/gen-trading-plan.js --mode best --broker paper --output /tmp/p.json
node -e "const p=require('/tmp/p.json');console.log(p.orders.length,'ordres',p.orders.reduce((s,o)=>s+o.entry.size.nominal_usd,0).toFixed(0),'USD, max_positions='+p.account.max_positions)"
# 18 ordres 23197 USD, max_positions=15
```

`daemon.js:126` écrase `plan.account.nominal_usd = CAPITAL` (défaut 10 000 $) — précisément le
champ que la voie dtx met volontairement à `null`. `engine.js` n'a aucun contrôle de buying power
ni de plafond à la soumission. Le plan est en outre incohérent avec lui-même : `max_positions: 15`
pour 18 ordres.

**Ce qu'il faudrait, pour R3+R4+R5** : une liste blanche **versionnée** (ex. `data/executor-allowlist.json`),
lue par les trois entrées (`run-session`, `daemon`, `index`), plus un garde de capacité dans
`engine.js`. C'est le chantier suivant, et il doit venir avant tout branchement courtier.

---

## Défauts RÉELS mais non corrigeables sans une décision

### R6. La courbe publiée n'est pas celle du livre

`portfolio/v1/best/equity.json.engineBacktest` publie désormais les **statistiques servies**
(CAGR 70,9 · MaxDD 27,2 · p95 38,3 · Sharpe 1,56 · 3 638 trades, `metrics_source: "book_served_stats"`).
En revanche `equityCurve` reste la courbe de replay de la **poche porteuse** : un consommateur qui
y recalcule un drawdown obtient 17,49 %.

```
node -e "function dd(v){let pk=-1e18,m=0;for(const x of v){if(x>pk)pk=x;const d=(pk-x)/pk*100;if(d>m)m=d}return m}
const c=require('./portfolio/v1/best/equity.json').equityCurve;console.log(dd(c.v).toFixed(2))"   # 17.49
```

L'écart est désormais **DIT** dans `curve_warning` au lieu d'être masqué. Il ne se referme que le
jour où le moteur sert la courbe du livre : la reconstruire ici serait exactement la « reconstruction »
que `data/dtx/best.json` interdit (`note: "NE PAS reconstruire depuis DtxReplay.combined"`).

### R7. Le champ `sleeve` est perdu, et ne peut pas être deviné

Le `signals.json` commité portait `sleeve` (`mx` ×8, `etf_us` ×7, `ep` ×2, `uhv_tp999` ×1) sur les
18 entrées dtx. Le staging `data/dtx/best.json` ne le porte pas : aucune des 15 clés d'un ordre
CREATE ne le contient, et le payload MCP non plus.

```
node -e "const o=require('./data/dtx/best.json').orders;console.log(Object.keys(o[0]))"
# symbol,side,orderType,qty,entry,limitPrice,stopPrice,stopLoss,takeProfit,score,reason,priority,orderId,execOptions,alternates
```

`orderToSignal()` fait désormais **transiter** `sleeve` dès que le staging le fournira, et refuse de
le dériver (« GDX est un ETF donc `etf_us` » est une inférence, pas une donnée). **Abandon déclaré**
en attendant : tant que l'ingest ne porte pas ce tag, le DRIFT R2 n'est pas diagnosticable à la
granularité de la poche.

### R8. Les cartes PNG publient encore des chiffres faux — le code est réparé, la rasterisation a échoué

Défaut **pré-existant** (identique sur l'`index.html` de HEAD), trouvé pendant ce chantier :
`gen-mode-cards.js` lisait les KPI **par position** avec un motif exigeant `class="ps-v"` exactement.
Trois cellules sur neuf y échappaient (`ps-v pos`, `ps-v neg`, et la valeur imbriquée du Profit
Factor), donc tout l'index glissait. La carte fortress publiait **+39,40 % de rendement total**
(= le win rate) et **−109,00 % de max drawdown** (= le nombre de trades) au lieu de +19,87 % et
−4,43 % — sur une image poussée en Telegram/Discord et servie en Open Graph.

L'extraction est corrigée à la source (indexation par **libellé**, plus par position) et vérifiée
contre le snapshot pour les 5 modes :

```
turbo    93.12/-9.48/38.9/3.24/54   | snapshot idem ✅
dynamic  57.53/-18.94/35.1/2.16/57  | snapshot idem ✅
balanced 44.73/-13.87/45.6/1.23/79  | snapshot idem ✅
fortress 19.87/-4.43/39.4/1.8/109   | snapshot idem ✅
best     0/0/0/0/0                  | snapshot idem ✅
```

MAIS : puppeteer ne rastérise pas dans cet environnement (`Navigation timeout of 30000 ms exceeded`
sur 4 modes sur 5, `WS endpoint` introuvable). **Aucun PNG n'a été commité** — les assets et
`manifest.json` ont été restaurés à HEAD pour ne pas publier un jeu à moitié régénéré.

**Ce qu'il reste** : relancer `node tools/gen-mode-cards.js` dans un environnement où Chromium
démarre, puis committer les 5 PNG + `manifest.json`. Les chiffres seront alors justes sans autre
changement.

### R9. Le classement LLM/Scripted a un défaut inversé (latent)

`SCRIPTED_FILTER_NAMES` (`gen-status-page.js`) est une liste fermée de 7 `filterName`. Tout mode
non listé et non-dtx tombe désormais dans **LLM** (avant : dans *Scripted*). Aucun des 5 modes
actuels n'est concerné — les 4 modes scanner sont bien en `llm`, `best` en `engine`. Mais un futur
mode scripté avec un `filterName` neuf serait étiqueté « LLM ».

Non corrigé : les deux défauts possibles sont également faux, et il n'existe aucun champ de config
qui déclare l'origine des signaux. **Le vrai correctif est déclaratif** : un champ `signalOrigin`
(`'llm' | 'scripted' | 'engine'`) dans `data/modes-config.json`, qu'on lit au lieu de deviner.
C'est une décision de schéma.

### R10. `data/dtx/` garde les stagings de 6 portefeuilles supprimés

`book_honest`, `us_highvol`, `hvep`, `stockbox_pit`, `etf_us`, `ep` ont encore leur staging alors
que leurs baselines sont descendues dans `_retired` — que `assertReplaySanity` ne lit pas. Un
ré-ingest accidentel de ces fichiers passerait donc **sans** ratio de trades.

```
ls data/dtx/   # best.json + les 6 morts
node -e "console.log(require('./tools/dtx-scan.js').assertReplaySanity('book_honest',{total_trades:9500}))"   # [] (silence)
```

Non corrigé : la règle « No Delete SSD » interdit toute suppression sans validation explicite par
item. **Ce qu'il faudrait** : soit les supprimer un par un après accord, soit faire lire `_retired`
à `assertReplaySanity` pour que la garde couvre aussi les portefeuilles retirés.

---

## Ce qui a été écarté, et pourquoi

- **Donner `excludeSources: ['dtx_pool']` aux 4 modes scanner** (suggéré par le panel comme
  variante « plus propre » pour clore la fuite moteur→scanner). Écarté : cela **change
  l'éligibilité** de turbo/dynamic/balanced (1 candidat dtx éligible chacun au 12/08), donc leur
  sélection, sans backtest. Le défaut de tri qui motivait la suggestion est réglé autrement, par un
  ordre total. La fuite elle-même reste ouverte et assumée : un ordre moteur peut entrer chez un
  mode scanner, qui le resize selon ses propres règles. À trancher séparément.
- **Réparer la liste blanche de l'exécuteur** : interdit par le mandat dans ce chantier (R3/R4).
