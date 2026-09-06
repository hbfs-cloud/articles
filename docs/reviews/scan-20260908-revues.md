# Scan 20260908 — les trois revues indépendantes

Date : 2026-09-06. Objet : le scan destiné à la séance du lundi 8 septembre, bâti sur la clôture
certifiée du 4 septembre. Trois revues lancées en parallèle sur le même instantané hashé : QA senior,
contrarian, développeur senior.

**Verdict : la sélection initiale n'a pas été publiée.** Elle échouait son propre gate bloquant
(`validate-scan.js`, 155 constats) et, plus grave, elle était orientée du mauvais côté des trois axes
que notre propre registre scellé mesure. Ce document garde la trace de ce qui a été trouvé, parce que
la plupart des défauts sont structurels et se reproduiront si on ne les nomme pas.

---

## 1. Ce que la revue contrarian a réfuté, pièces en main

Toutes les vérifications ci-dessous ont été faites contre les barres dont l'empreinte SHA-256 figure
dans `signals.json` — donc contre les mêmes octets que ceux qui auraient été publiés.

### 1.1 Une thèse fabriquée (LNG)

Texte écrit : « Sorti par le haut le 31 juillet avec un volume au-dessus de sa moyenne cinq séances
d'affilée, puis stabilisé : la rupture a été digérée, pas revendue. »

Les trois clauses sont fausses :

| Affirmation | Réalité mesurée |
|---|---|
| sortie par le haut le 31/07 | clôture 263,57, soit **3,7% SOUS** le plus-haut 60 jours (273,63) |
| — | la vraie cassure est le **18/08** (clôture 273,78) |
| volume au-dessus de la moyenne 5 séances d'affilée | 31/07 à **0,67×** la moyenne 20 j — le plus bas de la fenêtre ; les 5 suivantes : 0,71 / 1,05 / 0,90 / 1,19 / 0,99 |
| « stabilisé », « digérée » | 3 dernières séances en repli (295,86 → 290,85 → 292,00) sur volume **croissant** (1,65 / 1,51 / 1,84×) — distribution, pas digestion |

C'est une violation de la règle *No Hallucination*. Elle n'est pas venue d'un outil défaillant : elle
est venue de moi, en écrivant une narration plausible au lieu de lire les barres. **Aucune phrase de
thèse ne doit décrire un mouvement de prix sans que le chiffre correspondant ait été calculé.**

### 1.2 Trois invalidations inatteignables

Le stop ferme la position avant que le niveau annoncé puisse être observé. Une invalidation que le
lecteur ne verra jamais n'est pas une invalidation.

| | Invalidation publiée | Stop | Écart |
|---|---|---|---|
| CRBG | « retour sous 32 $ » | 33,39 | invalidation 4,2% **sous** le stop |
| PDBC | « clôture sous 18,40 $ » | 18,51 | 0,6% sous le stop |
| ILF | « sous le creux du 20 août » (33,49) | 35,14 | 4,7% sous le stop |

Et les descripteurs étaient eux-mêmes faux : « 32 $, borne **haute** de la fourchette d'août » alors
que la fourchette d'août de CRBG est 30,85 / 34,81 — 32 $ est dans le tiers bas.

**Règle qui en découle** : toute invalidation doit être située STRICTEMENT AU-DESSUS du stop, sinon
elle est décorative. À vérifier par script, pas à la relecture.

### 1.3 Deux métriques mal nommées

- **ILF** : « l'histogramme MACD s'écarte franchement de sa ligne de signal (0,41 contre 0,20) ».
  0,41 et 0,20 sont la ligne MACD et sa ligne de signal ; l'histogramme vaut 0,215 et classe ILF
  **9e sur 30**, pas premier. Accessoirement, comparer des MACD bruts entre un instrument à 19 $ et un
  autre à 70 $ n'a pas de sens : c'est une grandeur en unités de prix.
- **WTRG** : « le candidat le moins tendu de tout le vivier » — il est 4e (SFNC +3,49%, ILF +4,00%,
  TECH +4,17%). Et « le seul dont le stop de structure tient à moins de 4% » — **neuf stops sur dix**
  étaient sous 4%.

### 1.4 Une conclusion de marché réfutée par le vivier qu'elle résumait

Texte écrit : « la conduite du marché est passée aux ressources et aux services publics, pas à la
technologie ». Le vivier dit l'inverse : les cinq lignes les plus liquides du screen momentum sont
MRNA 4,84 Md$, **DELL 4,36 Md$, MSTR 3,95 Md$, HOOD 2,53 Md$, CRCL 1,53 Md$**, et 12 des 30 candidats
ETF sont des véhicules crypto. La technologie n'était pas absente du vivier : elle a été **écartée par
notre propre filtre d'extension** (DELL +21,0% / MM50, MSTR +24,1%, CRCL +27,0%).

Confirmé indépendamment par les performances sectorielles à une semaine (28/08 → 04/09) :

| XLE | XLK | XLU | XLV | XLC | XLP | XLI | XLRE | XLB | XLY |
|---|---|---|---|---|---|---|---|---|---|
| +2,20% | **+0,86%** | +0,82% | +0,17% | −0,85% | −1,02% | −1,05% | −1,23% | −1,39% | −1,96% |

La technologie est **troisième**. Publier « le marché a quitté la tech » aurait été présenter un
artefact de filtre comme un fait de marché.

### 1.5 Diversification : l'accusation facile était fausse, le vrai défaut était ailleurs

Corrélation moyenne des 45 paires (log-rendements, 24 séances communes) : **+0,047**. Ratio de
diversification 2,62, soit **6,9 paris effectifs sur 10**. Le panier n'était donc PAS « un seul pari
déguisé en dix », et MT était même **négativement** corrélé à l'énergie (MT/LNG −0,31, MT/AR −0,36 sur
118 séances).

Le vrai défaut était plus étroit et plus grave :

- **CVX + LNG + AR + PDBC = 1,4 pari effectif sur 4 lignes** (PDBC/CVX = **+0,73**, la corrélation la
  plus forte du panier). La thèse PDBC disait « complète les producteurs sans les dupliquer » : faux.
- Le plafond `max_per_sector` ne l'a pas vu **parce que PDBC était étiqueté `ETF-Commodity`** et non
  `Energy`, alors que `sector_map` classe déjà `USO: "Energy"`. Le gate a été contourné par une
  étiquette, pas satisfait sur le fond. `etf_lookthrough.max_per_cluster: 2` existe pour ça et n'avait
  pas été appliqué.
- **Le facteur commun n'était pas sectoriel, il était l'extension** : les dix lignes clôturaient à
  moins de 1% de leur plus-haut d'août, après un mois à +7 à +15%.

Réserve à garder en tête : n = 24, erreur-type ≈ 0,22 — seules les corrélations |r| > 0,43 se
distinguent de zéro. Et la fenêtre **ne contient aucune séance de stress** (pire journée du panier :
−0,77%). Un +0,047 mesuré sur un marché uniformément haussier ne dit rien d'un jour de retournement.

---

## 2. Le point décisif : le panier était du mauvais côté du registre scellé

`data/signal-outcomes.json` — 165 lignes scellées, généré le 05/09, soit **la veille**. Les trois axes
qu'il mesure donnaient tous le même verdict.

| Entrée vs clôture de référence | n | R moyen | Taux de gain |
|---|---|---|---|
| ≤ 0% | 21 | **+0,220** | 62% |
| +0,5 à +1% | 29 | **−0,260** | 38% |
| > +1% | 35 | −0,026 | 40% |

Les dix entrées étaient au-dessus de la clôture, **sept dans le seau à −0,260R**, zéro dans le seau
positif. Ce n'était pas de la malchance : `entry_high = clôture + 0,25 × ATR` est une formule qui ne
**peut pas** produire une entrée sous la clôture.

| RSI au scan | n | R moyen |
|---|---|---|
| < 50 | 7 | +0,110 |
| 50-60 | 21 | +0,022 |
| 60-65 | 26 | −0,042 |
| 65-70 | 26 | **−0,104** |

Six signaux en 65-70, quatre en 60-65, **zéro dans les deux bandes positives**.

| Stratégie | n | R moyen |
|---|---|---|
| Pullback | 8 | **+0,252** |
| Momentum | 52 | −0,055 |
| Breakout | 22 | **−0,220** |

Huit Momentum, deux Breakout, **zéro Pullback** — alors que le screen Pullback contenait **25
candidats liquides à RSI 41-51**, exactement la bande positive : AMZN 8,4 Md$ d'ADV, XOM 2,2 Md$,
KO 1,27 Md$, DIS 799 M$, WELL 632 M$, FDX 506 M$…

C'est le plus gros manque du scan : le seul seau positif du mois, 25 candidats disponibles, aucun
retenu.

---

## 3. Ce que la revue QA a établi

### 3.1 Le gate bloquant refusait le scan

`node tools/validate-scan.js scanner/20260908/` → **155 constats**, dont :

1. `strategy_concentration` — Momentum 8/10 dépasse le plafond dur de 50% et, surtout, le plafond
   `max_share_pct: 40` de `data/scanner-strategy-overlays.json`, posé le 31/08 sur preuve immuable
   (PF 0,59 / R moyen −0,243 / 31,8% de gain).
2. `sector_concentration` — secteur « Other » à 8 candidats pour un plafond de 3, parce que 8 des 10
   tickers étaient absents de `sector_map` et regroupés fail-closed.
3. `rr_min_by_regime` — **fail-closed sur les 10 signaux** : le validateur cherche `tp1`, le
   constructeur écrivait `target`. **Le plancher de R/R n'a donc jamais été appliqué par une porte.**
   Le rejet de MDT à 0,69 était une décision éditoriale déguisée en gate.

### 3.2 Incompatibilité de schéma

`build-scan.js` émettait `entry:[low,high]` / `stop` / `target`. Le schéma canonique
(cf. `scanner/20260901/signals.json`) attend `entry`, `entry_low`, `entry_high`, `stop`, `tp1`, `tp2`,
`rr` (chaîne « 1:x.xx »), `rr_entry`, `tp1_atr_multiple`, plus les blocs de preuve par signal
`sec_evidence`, `earnings_forward_evidence`, `selection_evidence` et le bloc racine `_pipelineOrder`.
**Une sortie qui n'entre pas dans le validateur n'est pas validée : elle est ignorée.**

### 3.3 R/R non reproductible depuis les niveaux publiés — et toujours en faveur du signal

Les pourcentages et le R/R étaient calculés sur `entryHigh` **non arrondi**, alors que `signals.json`
ne publiait que l'arrondi. Écart systématiquement favorable : AR 1,00 publié pour 0,99 réel ; CRBG
1,00 pour 0,99 ; WTRG 0,99 pour 0,98 ; ILF 0,87 pour 0,86 ; PDBC 0,71 pour **0,70**. Seize champs faux
sur six tickers, **aucun dans le sens défavorable**.

Corollaire : PDBC passait le plancher de 3% du stop uniquement grâce à une tolérance `− 0,01`
appliquée à une valeur calculée sur l'entrée non arrondie. Au prix publié, son stop était à **−2,987%**.

**Règle** : tout champ dérivé se calcule sur les valeurs ARRONDIES telles que publiées.

---

## 4. Ce que la revue dev a établi

### 4.1 Le stop était mesuré du mauvais côté de la bande d'entrée

`minDist` et `stopPct` étaient calculés depuis `entryHigh`, alors qu'un ordre limite posé dans une
bande se remplit **en bas** de la bande. À un remplissage réaliste :

| | distance réelle | en ATR | `stopAtr` publié |
|---|---|---|---|
| CVX | 2,07% | **1,08×** | 1,58 |
| LNG / AR / CEG / GILD / MT / CRBG | 2,42–3,42% | **1,00×** | 1,50 |
| WTRG | 2,02% | 1,01× | 1,52 |
| PDBC | 2,27% | 1,59× | 2,11 |

Le plancher `min_atr_multiple: 1,5` est déclaré non négociable (incident de mars : les stops sous
1,5 ATR se déclenchaient en séance avant reprise). **Neuf signaux sur dix étaient dessous**, et sept
pile à 1,00× — deux tiers du budget de bruit consommés par la seule largeur de la bande d'entrée. Le
fichier publiait un `stopAtr: 1.5` que le trade ne pouvait pas atteindre.

### 4.2 NaN désarmait les six portes exécutables

Un enregistrement `technicals` présent mais partiel (sans `atr`) propageait `NaN` dans tous les
niveaux. Or **toute comparaison avec NaN est fausse** : `NaN < 0.7`, `NaN > 72`, `Math.abs(NaN) < 3`…
tous faux. Le signal passait toutes les portes et `JSON.stringify` sérialisait les NaN en `null` :
`{"entry":[null,null],"stop":null,"target":null,"rr":null}`.

Ceci contredisait le contrat écrit dans la politique elle-même :
`tp1_reachability.requires` = « champ manquant = fail-closed ». Le script ne fail-closait pas.

### 4.3 Les deux branches « structure » étaient mortes

10/10 `stopBasis = plancher_bruit`, 10/10 `targetBasis = optimum_mesuré`. Aucune résistance ni aucun
pivot n'a jamais borné un niveau. La raison est structurelle : un titre sélectionné parce qu'il est sur
ses plus hauts n'a **par définition** aucun pivot haut au-dessus du prix. Le champ
`targetBasis: "optimum_mesuré"` était donc un champ de provenance mensonger : rien n'était mesuré,
c'était une constante.

Conséquence : `rr = 1,5 / stopAtr` mécaniquement, six R/R sur dix à exactement 1,00, soit **60,0%** —
le gate `rr_uniformity_threshold_pct: 60` passait sur un `>` au lieu d'un `≥`, à marge nulle. Il n'a
tenu que grâce au rejet fortuit de MDT (avec MDT : 7/11 = 63,6% → bloquant).

*Nuance trouvée après coup* : `validate-scan.js` (l. 621-632) whiteliste déjà explicitement le R/R égal
à `target_atr_multiple / min_atr_multiple` = 1,00 comme « conséquence attendue de `tp1_reachability`,
pas une alerte ». La porte du constructeur était donc plus stricte que la politique. Le vrai problème
n'est pas le gate : c'est que **le R/R publié, comme le score, est une fonction déterministe de l'ATR
et ne discrimine rien**.

### 4.4 Quatre règles déclarées exécutables n'étaient implémentées nulle part

`max_distance_200dma_pct`, `min_consolidation_bars`, `diversification.allowed_regions`, et surtout
`diversification.sector_map` : **le secteur venait de `pick.sector`, texte libre du manifeste**. Le
plafond `max_per_sector: 3` était donc auto-déclaré. L'en-tête du script affirmait « Rien dans ce
fichier ne contourne une porte » — c'était faux pour celle-là.

### 4.5 Le contrôle de transcription était aveugle au chiffre le plus dangereux

Le contrôle recalculait ATR et RSI depuis les barres recopiées et les comparait au serveur. Mesuré par
bissection : **le close de la dernière barre pouvait être faux de +14,3% sur NTR (89,47 au lieu de
79,47) et de +5,4% sur CVX en passant le contrôle.**

Raison mécanique : le close de la dernière barre **n'entre pas dans son propre True Range** (le TR
utilise le haut, le bas courants et le close *précédent*) → poids exactement **zéro** dans l'ATR14. Il
ne pèse que 1/14 dans le RSI de Wilder. Or c'est ce nombre qui devient `price`, `entry`, `stop` et
`target`. Le volume, lui, n'était **jamais** examiné : le multiplier par 10 passait le contrôle et
gonflait l'ADV citée dans la thèse.

**Correctif** : contrôler `close`, `high`, `low` et `volume` de la dernière barre directement contre
une valeur serveur, et resserrer la tolérance ATR à ~5% (la déviation réelle observée est ≤ 4,1%).

---

## 5. Défauts de collecte trouvés en chemin

### 5.1 `vars.json` a rétréci l'univers de 40% en silence

Le fichier était figé à 36 tickers alors que rejouer `extract-universe.js` sur le **même** dossier
`_data` en rendait 60. Il avait été produit avant l'arrivée de `autoscreen_etf.json` et des fichiers
breakout/pullback recollectés. **24 candidats certifiés n'ont jamais été enrichis**, dont tous les ETF
et CVX. `vars.json` est un artefact dérivé sans aucun contrôle de fraîcheur sur ses entrées.

### 5.2 Les screeners tournent sans borne de capitalisation

Les quatre DSL ne contiennent aucun `market_cap`, et les résultats portent `market_cap: 0`,
`market_cap_point_in_time: false`. Violation directe de la règle *Screener Mcap Filter* et de
`scanner-filters.json` (`min_market_cap_usd: 500000000`, `min_avg_daily_volume_usd: 10000000`).
Conséquence visible : **AOUT, 4 M$ d'ADV**, est arrivé en tête du screen breakout avec un score de 90.

### 5.3 Le gate de liquidité du screener porte sur une seule barre

`vol > 1500000` est évalué sur la barre de référence, pas sur une moyenne. AOUT a fait 4,4 M titres
le jour du scan pour une ADV 20 jours de **4 M$**. Un pic de volume isolé suffit à faire entrer une
micro-capitalisation dans le vivier éditorial.

### 5.4 `support_resistance` renvoie une charge utile dégénérée

Les 36 symboles rendent `resistances` / `supports` contenant **uniquement l'en-tête CSV** et zéro
ligne, alors que `status: "completed"` et `count: 7`. Non détecté, parce que le constructeur ignorait
ce `data_type` et recalculait ses propres pivots. `trading_signals` est également inexploitable
(`stop_loss: 0.00` partout).

### 5.5 Le « contradicteur » du régime n'en était pas un

On croyait opposer deux avis : `marketdata.GetMarketContext(facets=overview).regime` (autorité, 77) et
`systematic.DtxRegime` (contradicteur, 79). Vérification faite en paginant `overview` jusqu'au bout :
le bloc régime d'overview porte `engine: switcher_analyzer`, `model: dtx`, `scale: 0-1_risk_on`. **Le
même moteur.** L'écart de 2 points séparait deux exécutions du même modèle à des instants différents,
pas deux opinions. Un contrôle de convergence entre eux ne peut rien détecter.

*À l'inverse*, le constat QA n°9 — « l'autorité déclarée n'a jamais été obtenue » — est **infirmé** :
`_data/regime_authority.json` contient exactement le même bloc qu'un appel `overview` live entièrement
paginé (`0.7696415068207527` au chiffre près). Le `_note` du fichier documente seulement que la
collecte *scriptée* ne l'atteint pas et que l'agent l'a mis en staging — le chemin sanctionné.

### 5.6 Le contrôle de dilution avait porté sur les mauvais tickers

Le crible SEC avait été passé sur DOCU, SRPT, FMC, MRX, WT, HPQ, EL, SWKS, PEGA, MOS, EXEL, DHT —
**aucun des huit finalement retenus**. Refait sur la vraie sélection, avec bornage point-in-time à la
clôture de référence (`sec_filings` est current-only, la borne doit être posée côté client) :

| | dépôt d'offre le plus récent | âge |
|---|---|---|
| CVX, LNG, CEG | aucun | — |
| GILD | 424B5 | J-109 |
| MT | 424B5 | J-114 |
| WTRG | 424B5 | J-179 |
| AR | 424B5 | J-232 |
| CRBG | 424B5 | J-294 |

Tous hors de la fenêtre de 90 jours. Les avis EDGAR live du validateur (« GILD S-3ASR il y a 31 j »,
« CRBG 424B2 il y a 19-20 j ») ne sont pas soutenus par ces données et restent à réconcilier — ils
portent peut-être sur une entité liée.

---

## 6. Ce qui tenait

- **La thèse CVX**, seule ligne dont chaque chiffre a survécu au contrôle : ADV 1 582 M$ ✓, extension
  +6,80% contre une médiane de vivier à 11,06% ✓, 0/15 barre au-dessus de 1,5 ATR ✓.
- **Les volumes cités** : GILD 775 M$, MDT 734 M$, CVX 1,6 Md$ — exacts.
- **La décorrélation de CRBG** — ligne la plus indépendante du panier. Mais le *mécanisme* invoqué
  (« un assureur dont les résultats s'améliorent quand les taux longs restent hauts ») n'était étayé
  par aucun artefact du dépôt : causalité plausible, non vérifiée, donc à retirer ou à sourcer.
- **Les gates événementiels** : aucun titre dans `earnings_7d.json`, aucune collision avec
  `scanner-positions.json`, prochains résultats tous au-delà du 28/10.
- **Le score** : le caveat de `_selection.json` était exact et vérifiable — Momentum = RSI + 15,
  Breakout = RSI + 20 en cas de pic de volume. MT 83,32 / RSI 68,32 ; GILD 82,70 / 67,70 ;
  CEG 81,71 / 66,71 ; CVX 79,20 / 64,20.

---

## 7. Ce qui change dans la méthode

1. **L'entrée ne dépasse plus la clôture de référence.** C'est le levier le plus fort du registre
   (+0,220R contre −0,260R) et il est mécanique. Le signal ne se remplit que si le marché revient
   chercher le prix. Le taux de déclenchement baissera ; l'espérance monte.
2. **Zéro Breakout publié** tant que son espérance n'est pas repassée positive sur 40 lignes — c'était
   déjà la recommandation de la revue d'août, restée lettre morte.
3. **Momentum plafonné à 40%** du panier, conformément à l'overlay immuable.
4. **Le secteur vient de `sector_map`**, jamais du manifeste. Une entrée manquante bloque au lieu de
   tomber dans « Other ».
5. **Le look-through ETF est appliqué** : un ETF matières premières compte dans la grappe énergie.
6. **Toute invalidation est vérifiée strictement au-dessus du stop.**
7. **Aucune phrase de thèse ne décrit un mouvement de prix sans le chiffre qui l'établit.**
