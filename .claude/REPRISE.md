# REPRISE — mode « best » (moteur dtx) : chantier clos au 12/08

Les dix défauts relevés en revue (R1–R10) sont **tous fermés**, R6 compris depuis que
systematic-tss v1.34.1 sert la courbe du livre (`DtxBookEquity`).

Ce fichier dit ce qui a changé, ce qui a été vérifié, et surtout **deux conclusions de la revue
précédente qui étaient fausses** : la « fuite moteur→scanner » n'existe pas, et la poche du livre
était lisible depuis le début.

---

## ✅ Fermé

| # | Défaut | Ce qui a changé |
|---|--------|-----------------|
| R1 | tp1 fabriqué à 2R, étiquette de stratégie fausse | tp1 du moteur ou `null` ; tags `dtx_engine`/`dtx_rotation` lus du verbe du moteur |
| R2 | Le tracker ferme ce que le moteur tient | Sorties **par poche**, appliquées à la position |
| R3 | Liste blanche non versionnée, invérifiable | `data/executor-allowlist.json`, refus par défaut |
| R4 | `daemon.js` ignorait toute autorisation | Les **trois** entrées consultent la même porte |
| R5 | Aucun garde de capacité | Trois plafonds dans `engine.js`, le plus contraignant gagne |
| R7 | La poche du livre était perdue | **Lue** dans `DtxDecide.state`, 18/18 taguées |
| R8 | Cartes PNG à chiffres faux | Rastérisées ; fortress publiait son win rate comme rendement |
| R9 | Classe LLM/Scripted devinée | `signalOrigin` déclaré dans `modes-config` |
| R6 | Courbe publiée ≠ courbe du livre | `DtxBookEquity`, **vérifiée** à l'ingestion (±0,05 pt) |
| R10 | Garde de sanity éteinte sur 6 stagings | Retombe sur `_retired`, warning explicite |

### R7 puis R2 — le déblocage

R7 était présenté comme irrécupérable : un ordre CREATE ne porte que 7 champs, aucun ne nomme la
poche. Mais `DtxDecide` renvoie aussi `state`, et **`state` est indexé par poche** :
`state.<poche>.pm_state.position_open_dates` liste les symboles que cette poche tient. Partition
exacte des 18 ordres du 12/08, sans recouvrement :

```
node -e "const d=require('./data/dtx/best.json');const by={};d.orders.forEach(o=>by[o.sleeve]=(by[o.sleeve]||0)+1);console.log(JSON.stringify(by),d.sleeveCoverage.tagged+'/'+d.sleeveCoverage.total)"
# {"mx":8,"etf_us":7,"ep":2,"uhv_tp999":1} 18/18
```

Ce n'est pas une inférence (« GDX est un ETF donc `etf_us` ») : c'est une lecture de ce que le moteur
déclare. Un symbole revendiqué par deux poches rend `null` et le dit.

Le champ traverse désormais toute la chaîne — chaque étape était une liste blanche qui l'aurait perdu
en silence : `mapOrder` (staging) → `scanner-parser` (signaux) → `sweep` (setups puis **trades**, pour
qu'un trade scellé dise sous quelle règle il est sorti) → `gen-api` (API publique) → registre
point-in-time. Un compteur `sleeveCoverage` dans le staging dit combien d'ordres n'ont pas pu être
rattachés : si le moteur cessait de renvoyer `state`, le tracker retomberait sur les sorties du mode
et cela se verrait au lieu de passer inaperçu.

La séance du 12/08 était déjà enregistrée dans `data/dtx-engine-history.json`, immuable par
(mode, date). Plutôt que `--force` — qui réécrit l'entrée entière, `recordedAt`, prix et quantités
compris, donc perd l'invariant pour compléter un champ — `tools/dtx-history-enrich-sleeve.js`
n'écrit **que** `sleeve`, et seulement depuis le payload MCP archivé de la **même** (mode, date)
(`scanner/20260812/_dtx/decide_best.json`), c'est-à-dire la source dont l'entrée est elle-même
issue. Il compare `symbol`/`qty`/`entry`/`stopLoss` ordre par ordre et **refuse** d'écrire à la
moindre divergence (vérifié en altérant volontairement une quantité : refus sur GBUG). L'ajout est
horodaté dans l'entrée (`_sleeveEnrichedAt`, `_sleeveSource`).

```
ordres identiques hors sleeve : true   |  recordedAt inchangé : true   |  autres champs modifiés : []
portfolio/v1/best/orders.json → {"mx":8,"etf_us":7,"ep":2,"uhv_tp999":1}
```

R2 en découlait. Le DRIFT n'était pas « un chiffre diffère » mais **le tracker portait UN jeu de
sorties là où le livre en a QUATRE** :

| poche | % | take-profit moteur | timeout | ce que le tracker faisait |
|---|---|---|---|---|
| `uhv_tp999` | 70 | aucun (`999` = injoignable) | 14 | vendait 50 % à +30 % |
| `ep` | 45 | **20 %**, sortie totale | 20 | idem |
| `etf_us` | 25 | aucun (la rotation est l'exit) | aucun | idem |
| `mx` | 15 | **25 %**, sortie totale | 14 | idem |

Et la sémantique ne correspondait même pas : `take_profit_pct` est une sortie **totale** côté moteur
(`pm_base.go` → `exitReason = TAKE_PROFIT` ferme la position), pas une prise partielle. Aucun réglage
unique ne pouvait donc être juste — il l'était pour zéro poche sur quatre.

Corrections : table versionnée `data/dtx-sleeve-exits.json` (transcription du yaml, comparée par
`parity-check`), override par position dans `sweep.js`, et `partialTP`/`partialTPGain` désarmés sur
le mode — aucune poche du livre ne prend de profit partiel. `horizon: 14` est **conservé** comme
garde-fou du tracker pour `etf_us`, qui n'a ni take-profit ni timeout côté moteur ; déclaré comme
garde-fou, pas comme règle du moteur.

```
# comportement par poche, barres synthétiques +8 %/séance
uhv_tp999  expired  +45%  15j   ← ne coupe pas : c'est la queue qui porte le CAGR
ep         tp1      +24%   4j   ← sortie totale à +20 % (remplie à 124 sur gap)
etf_us     expired  +45%  15j   ← pas de cible ; horizon du mode en garde-fou
mx         tp1      +25%   4j   ← sortie totale à +25 %
sans poche expired  +45%  15j   ← comportement d'avant, inchangé
```

```
node tools/parity-check.js --warn-only | tail -1
# Total: 28 | OK: 21 | DRIFT: 0 | GAP (documented, non-blocking): 7
```

La ligne unique en DRIFT perpétuel est remplacée par **9 lignes** couvrant les 4 poches
(take-profit + timeout chacune) plus l'absence de prise partielle. Si le moteur change un
take-profit et que la transcription ne suit pas, la ligne concernée sort en DRIFT.

### Non-régression

```
# simulateTrade, HEAD vs HEAD+patch, sur le cache de prix réel
non-dtx : 11 928 simulations comparées, 0 différence
dtx     :  2 240 simulations comparées, 0 différence
```

Le zéro côté dtx est attendu et vérifié : le seul scan portant un tag de poche est celui du 12/08,
qui n'a **aucune barre postérieure** (la séance n'a pas encore eu lieu).

### Validation sur barres RÉELLES

Les portefeuilles autonomes `ep` et `etf_us` de juillet portaient **exactement** les mêmes règles de
sortie que les poches homonymes d'aujourd'hui (`portfolio_ep.yaml` : tp 20 / timeout 20 ;
`portfolio_etf_us.yaml` : ni l'un ni l'autre). Leurs entrées historiques sont donc de vraies
décisions du moteur, sur de vraies barres, sous les mêmes règles.

**1. Aucun effet rétroactif mesurable.** 103 trades rejoués (98 `etf_us`, 5 `ep`) : 0 issue
différente, P&L moyen identique à la décimale. Aucun n'a franchi de seuil de prise de profit, et
l'override d'horizon s'applique bien (`horizonAppliqué=20` sur les `ep`).

**2. Fréquence des seuils** — sur 302 entrées moteur réelles disposant de barres :

```
+20 % (poche ep) atteint par  22 (7,3 %)
+25 % (poche mx) atteint par   7 (2,3 %)
+30 % (ancien réglage unique)  4 (1,3 %)
```

La règle par poche se déclenche donc 2 à 6 fois plus souvent que l'ancien seuil unique — et en
sortie **totale** au lieu d'une vente de 50 %, ce qui est l'écart de fond.

**3. Exécution correcte au seuil, sur les cas réels qui l'ont franchi** — 17 cas, **17 cohérents** :

```
20260717 SEPN  MFE=31,1%  | uhv(aucun TP): expired 27,6%  | mx(+25%): tp1 25%    J13 | ep(+20%): tp1 20%    J13
20260729 ALAB  MFE=41,4%  | uhv(aucun TP): pending 21,9%  | mx(+25%): tp1 26,16% J3  | ep(+20%): tp1 26,16% J3
20260805 VOYG  MFE=33,9%  | uhv(aucun TP): pending 32,15% | mx(+25%): tp1 25%    J3  | ep(+20%): tp1 20%    J3
```

SEPN montre le comportement voulu : la poche porteuse **ne coupe pas** et finit à +27,6 % là où `mx`
sort à +25 %. ALAB sort à 26,16 % — remplissage sur gap au-dessus du niveau, prix réellement traité.

⚠️ Ce que cela ne prouve pas : que le P&L du livre `best` s'améliore. Il n'existe **aucun trade
dtx_pool scellé**, tous modes confondus — c'est une correction de parité vérifiée, pas une
optimisation validée par backtest.

---

## ⛔ Ce que la revue précédente affirmait à tort

### La « fuite moteur→scanner » n'existe pas

`sweep.js` portait ce commentaire : « les 4 modes scanner n'ont aucun `excludeSources` et les ordres
du moteur entrent bel et bien dans leur vivier ». **C'est faux**, et cette phrase a produit deux
conclusions erronées dans la revue précédente : une « fuite ouverte et assumée », et le rejet d'un
correctif (`excludeSources: ['dtx_pool']`) au motif qu'il « changerait l'éligibilité ».

Le constructeur d'`excludeSources` donne à tout mode sans `assetClass` la liste **complète** des
pools d'asset-class, `dtx_pool` compris — et les deux consommateurs l'appliquent : le backtest
(`if (excludeSet.has(t.source)) continue`) et le constructeur d'ordres live
(`.filter(s => !exclSources.has(s.source))`).

```
turbo/dynamic/balanced/fortress → trade dtx_pool IGNORÉ
best                            → trade dtx_pool ADMIS
```

Conséquences : (1) le correctif écarté était déjà en place ; (2) les scans du 13/07 au 11/08, qui
gardent le tp1 fabriqué à 2R faute de staging pour les régénérer, sont **inertes sur les deux
chemins** — les modes scanner les excluent par source, `best` les exclut par `universeFilter`. Rien
à réécrire. Le commentaire est corrigé dans `sweep.js`.

### Le plan turbo n'était pas un cas isolé

Le garde de capacité (R5) a révélé le même défaut que sur `best`, sur les modes scanner. `MAX_ORDERS`
était la constante 5, sans rapport avec les places du compte :

```
AVANT                                          APRÈS
turbo     1 place  → 5 ordres = 50 000 $       1 ordre  = 10 000 $
dynamic   1 place  → 5 ordres = 50 000 $       1 ordre  = 10 000 $
balanced  3 places → 5 ordres = 16 665 $       3 ordres =  9 999 $
fortress 10 places → 5 ordres =    250 $       5 ordres =    250 $  (inchangé)
```

La capacité n'est pas un chiffre à inventer : le mode la déclare déjà (`portfolioSize`, qui sert
aussi à dimensionner chaque position). `MAX_ORDERS` la lit.

⚠️ Les ordres de repêchage n'étaient **pas** des remplaçants : ils sortaient en `action: 'BUY'`, donc
indiscernables du pick principal, et l'exécuteur les aurait tous envoyés. De vrais remplaçants
demandent une action distincte que l'exécuteur sait interpréter — comme la cascade `alternates` de la
voie moteur — pas des ordres d'achat supplémentaires. À faire si le besoin existe.

Au passage, le plan moteur ne déclare plus `max_positions: 15` : 15 est la capacité de la poche
porteuse, pas celle du livre (les quatre poches ont 15/15/7/10). Publier 15 face à 18 ordres rendait
le plan contradictoire. Le champ vaut `null` — même raison que `nominal_usd` — et le garde de
capacité borne alors sur le buying power réel du courtier, seule limite vraie à l'exécution.

---

## ✅ R6 fermé — le moteur sert la courbe du livre

`portfolio/v1/best/equity.json` publiait les statistiques **servies** du livre à côté d'une courbe
qui n'était pas la sienne (replay de la poche porteuse, sous-échantillonné) : un drawdown recalculé
dessus rendait 17,49 % contre 27,2 %. L'écart était *déclaré* dans un `curve_warning` — un
pansement, pas un correctif : un fichier qui publie une courbe ET des chiffres qui ne s'en déduisent
pas invite à l'erreur, quel que soit l'avertissement.

systematic-tss v1.34.1 sert désormais `DtxBookEquity` : la courbe quotidienne du walk qui produit
les stats servies, embarquée au build **avec** elles pour qu'elles ne puissent plus diverger.

**Vérifié, pas cru.** `tools/dtx-book-equity-ingest.js` recalcule CAGR et max drawdown depuis
`equity_values` AVANT d'écrire, et refuse au-delà de ±0,05 pt. Le refus n'est pas théorique : au
premier essai il a bloqué, parce que j'annualisais en jours calendaires (71,69 contre 72,03 servi).
La convention du moteur a été identifiée par départage, pas devinée :

```
n/252        → 72,0334   écart 0,0034 pt   ← retenu (et figé dans le script)
(n-1)/252    → 72,0999   écart 0,0699
jours/365,25 → 71,6873   écart 0,3427
jours/365    → 71,6238   écart 0,4062
```

Le candidat retenu est 20× plus proche que le suivant. Un contrôle qui s'ajuste à son résultat ne
contrôle plus rien : la tolérance n'a pas bougé, c'est la convention qui a été trouvée.

```
max drawdown : servi 27,18 | recalculé 27,1834 | écart 0,0034 pt
CAGR         : servi 72,03 | recalculé 72,0334 | écart 0,0034 pt
→ DD recalculé sur la courbe PUBLIÉE : 27,18 % = la statistique servie
```

`curve_warning` a disparu — il disait qu'on publiait une courbe qui n'était pas celle des chiffres,
ce qui est faux désormais. À la place, de quoi recalculer JUSTE : `curve_is_book`, `committed_capital`
(155 000 — les pourcentages des poches somment à 155, pas 100), `trading_days_per_year`,
`curve_rebased_to`, et une note qui reproduit les chiffres **à la lettre**.

**Deux défauts introduits par ce changement, trouvés et corrigés avant publication :**

1. *La courbe démarrait à 155 au lieu de 100.* Le rebasage utilisait `initial_capital` (100 000)
   alors que la courbe du livre démarre au capital **engagé** (155 000) : le livre semblait valoir
   +55 % à l'instant zéro. La base est maintenant `committed_capital`.
2. *Ma note publiée était fausse.* Appliquée à la courbe entière elle donnait 71,97 et non 72,03 :
   `equityCurve` porte le segment de backtest **puis** un point d'ancrage au go-live. La note dit
   désormais de s'arrêter à `to`. Vérifié en la suivant littéralement : écarts 0,0034 et 0,0016 pt.

**Millésime.** La re-mesure sur le binaire courant donne CAGR 72,03 (contre 70,87 au 11/08) et
MaxDD 27,18 (contre 27,2) — MaxDD identique à 0,02 près, +1,16 pt de CAGR dû à l'évolution du
binaire entre les deux mesures. L'owner conserve l'ancienne valeur dans `_meta._prev` et date le
millésime ; côté articles, courbe et chiffres viennent maintenant du **même run**, ce qui est le
point.

## Écarts VOULUS, non des dérives

`parity-check` sort 7 GAP documentés, dont trois sur `best` — tous délibérés et datés :
`minScore 0` (le seuil est interne au moteur et par poche, appliqué avant émission),
`atrStopMult 0` et `maxStopPct 0` (le tracker honore le stop **du moteur**, décision du 2026-08-07).
Ne pas les « corriger ».

---

## Trouvé en passant, hors périmètre

`node tools/lessons-engine.test.js` — 9 échecs, **antérieurs à ce chantier** (identiques sur HEAD
stashé). Ils portent sur `data/scanner-lessons.json` : les règles n'ont pas les champs canoniques
`class`, `scope`, `effect`, `confidence_base`, `created_at`, `last_validated_at`,
`invalidation_conditions`, `notes`. Les remplir demande un jugement éditorial par règle — les
inventer serait exactement le genre de fabrication que ce chantier a passé son temps à retirer. À
traiter avec le propriétaire des rétrospectives.

---

## Note d'intégrité

`data/trading-plans/best-paper-20260812.json` a été supprimé par erreur pendant le chantier (pris
pour un artefact de test alors qu'il préexistait, non suivi par git) puis régénéré avec le même
générateur. Il l'a été de nouveau depuis, avec le générateur corrigé, comme les quatre plans scanner
du jour.
