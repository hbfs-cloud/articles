# MRVL — passation phase A → phase B (refdate 2026-11-02)

Arrêt à 19 h 25 (Paris), le 2 novembre 2026. La clôture du 2 novembre n'est pas certifiée : selon GetStatus
(18:18Z), `bars_daily_us_equity.served_completed_end` vaut 2026-10-30 et `next_complete_available_at`
2026-11-02T21:30:00Z, soit 22 h 30 à Paris. Le témoin SPY est complet au 30 octobre. La phase B ne démarre
qu'après le passage de `served_completed_end` au 2026-11-02 pour les témoins US. Pas de RefreshBars sur
tout l'univers.

## Fait (phase A, sans cours)

- Rachat de Lumentum signé et annoncé. Dépôts primaires ouverts, copiés dans `analyses/MRVL/_primary/`
  (préfixe `nov26-`) et dans `primary/` du run, avec les 24 diapositives de la présentation (images).
- Inventaire EDGAR de Marvell (CIK 1835632) depuis le 1er août 2026 : 10-Q (28/08), 8-K (19/08, 27/08,
  25/09, 23/10, deux le 02/11), deux 425 (02/11), un 13G/A (06/08), 13 formulaires 4 et 6 formulaires 144.
  Aucun S-3, S-3ASR, 424B ni S-8.
- `static-mrvl.cjs` est écrit (gabarit R08) : 13 documents primaires, 21 groupes d'extraits (needles) tous
  vérifiés sur le rendu `htmlText`, 6 groupes économiques et 23 comparables.
- `companyfacts.json` de la SEC a été téléchargé dans `analyses/MRVL/_primary/`. Étiquettes XBRL à
  utiliser : `RevenueFromContractWithCustomerExcludingAssessedTax`, `OperatingIncomeLoss`, `NetIncomeLoss`,
  `OtherDepreciationAndAmortization` et `AmortizationOfIntangibleAssets` (D&A),
  `NetCashProvidedByUsedInOperatingActivities`, `PaymentsToAcquirePropertyPlantAndEquipment`,
  `CashAndCashEquivalentsAtCarryingValue` (pas de placements à court terme),
  `LongTermDebtCurrent` et `LongTermDebtNoncurrent`. Le dernier 10-Q couvre la période close le 1er août 2026 :
  le 10-Q du troisième trimestre n'est pas encore déposé.
- `node tools/validate-workflows.js --workflow analyse` : PASS. Il faut préfixer `NODE_OPTIONS=` : la
  variable héritée pointe vers un module cmux absent, ce qui fait échouer toute commande node.

## Faits sourcés (phase A)

### Rachat de Lumentum (8-K 0001193125-26-442717 et 8-K/EX-99.1 0001193125-26-442714 du 2 novembre 2026)
- Accord signé le 1er novembre 2026 et annoncé le 2 novembre avant l'ouverture (conférence téléphonique à
  8 h ET). Paiement **entièrement en actions** : **4,500 actions MRVL par action LITE**, ratio fixe.
  Les actions de préférence de série A de Lumentum (≈2,9 M, détenues par NVIDIA, achetées 695,31 $ l'action
  pour 2,0 Md$ selon le 10-K de Lumentum) sont converties sur la même base. Leur porteur peut aussi choisir
  des actions de préférence de série B de Marvell.
- La valeur d'entreprise implicite de Lumentum est de 115 Md$, soit environ 1 132 $ par action, avec une prime
  d'environ 23,9 % sur les cours non affectés du 28 octobre. Le cours implicite de MRVL, 1 132 / 4,5 ≈ 251,6 $,
  reste à recouper sur la barre du 28 octobre en phase B.
- Après l'opération, les actionnaires actuels de Marvell détiendront **≈67 %** de l'ensemble et ceux de
  Lumentum **≈33 %** (base entièrement diluée). Sur la base des 101,7 M d'actions diluées de Lumentum au
  premier trimestre, cela représente environ 4,5 × 101,7 ≈ 458 M d'actions MRVL nouvelles, contre
  921,2 M d'actions diluées pour Marvell au deuxième trimestre. Le calcul est à refaire dans le générateur.
- Hausse du nombre d'actions autorisées : le vote des actionnaires de Marvell porte sur l'émission des titres
  ET sur l'amendement de la charte. Le plafond actuel est de 1,3 Md d'actions autorisées (10-Q), alors qu'on
  compte 876,9 M d'actions en circulation au 21 août, plus environ 458 M d'actions nouvelles, plus le bon
  Google (58,97 M), la préférence NVIDIA (21,8 M) et Celestial (24,4 M).
- Synergies de coûts annuelles visées : plus de 1 Md$, « principalement sur le coût des ventes » selon la
  diapositive 21. Relution annoncée du BPA ajusté de Marvell dès la première année après la clôture. Le
  marché adressable revendiqué est de 550 Md$. Diapositive 20 (image, non vérifiable par extrait) : revenus
  annualisés pro forma de 17,7 Md$ (12,6 pour Marvell, 5,1 pour Lumentum), marge brute ajustée de 57 %,
  marge opérationnelle ajustée de 39 %. Diapositive 21 : VE combinée supérieure à environ 275 Md$ au
  30 octobre.
- Conditions : vote des deux assemblées, délai HSR et « certain other required regulatory approvals »
  (liste dans les annexes confidentielles, aucune juridiction nommée publiquement), S-4 effectif, cotation
  Nasdaq, absence d'effet défavorable important.
- Date limite : **1er novembre 2027**, prolongeable au 1er février, au 1er mai puis au 1er août 2028 si les
  autorisations manquent. Clôture visée : **premier semestre calendaire 2028**. Le courriel client de
  Lumentum (425 0001193125-26-442765) parle de 12 à 18 mois.
- Indemnités de rupture : **5,8 Md$** dues par Marvell (retrait de la recommandation, offre supérieure ou
  opération alternative dans les 12 mois), **2,9 Md$** dues par Lumentum dans les cas symétriques, et
  **3,2 Md$** d'indemnité réglementaire due par Marvell (date limite dépassée, interdiction antitrust ou
  refus définitif).
- Gouvernance : Matt Murphy reste président-directeur général ; trois administrateurs de Lumentum, dont
  Michael Hurlston, entrent au conseil de Marvell (7 membres aujourd'hui).
- Financement : aucun financement par dette n'est annoncé. Le 22 octobre (8-K du 23/10), Marvell a porté sa
  ligne renouvelable de 1,5 à **3 Md$**, extensible de 2 Md$, sans tirage. Le levier y est plafonné à 4,00 et
  relevable à 4,50 l'année d'une acquisition d'au moins 500 M$. La dette de Lumentum est reprise : 1 360,3 M$
  à court terme au 26 septembre (convertibles), plus les convertibles 2032 de 1 265 M$ à 0,375 %.
  L'accord prévoit un traitement des convertibles et des capped calls (section 6.16).
- Conseils : Qatalyst (principal), J.P. Morgan et Goldman Sachs pour Marvell ; Citi et Evercore pour Lumentum.
- Lumentum, premier trimestre de l'exercice 2027 (clos le 26/09), publié le 02/11 : revenus de 1 262,6 M$
  (+136,5 %), marge opérationnelle ajustée de 42,3 %, prévision de 1 575 à 1 625 M$ et de 5,90 à 6,20 $ de
  BPA ajusté pour le deuxième trimestre.

### Marvell, autres faits
- Troisième trimestre de l'exercice 2027 : revenus préliminaires annoncés le 02/11, milieu de prévision
  maintenu (3,150 Md$), fourchette resserrée de ±5 % à **±2 %**. Aucun chiffre de bénéfice.
- **Date de publication des résultats non confirmée par l'émetteur.** Calendrier de données : 1er décembre
  2026, source unique (Yahoo, GetEarningsCalendarFiltered capturé à 18:21Z) → `uncertain: true`.
- Dividende de 0,06 $ (8-K du 25/09), payé le 29/10.
- Initiés depuis le 15/09 (formulaires 4) : uniquement des ventes, toutes sous plan 10b5-1 sauf Scarpulla.
  Murphy a vendu 7 500 actions le 15/09 à 223,39 $ et 7 500 le 15/10 à 235,47 $ ; Koopmans 10 000 le
  01/10 à 262,05 $ ; Bharathi 3 685 le 16/10 à 234,97 $ ; Scarpulla 1 100 le 08/10 à 273,59 $. Le reste
  correspond à des retenues fiscales (code F) sur actions acquises le 15/10 à 241,24 $. Aucun achat.
- Bon Google (58 970 907 actions à 206,58 $), préférence NVIDIA (21 778 000 actions) et complément
  Celestial (24,4 M) : aucun dépôt nouveau depuis le 24 septembre.
- Consensus (QueryData analyst_trend, capturé à 18:23Z, valeur courante) : 46 analystes, « Strong Buy »,
  objectif moyen de 341,44 $ au 1er novembre, avant l'annonce. Aucune action d'analyste du 19/10 au 01/11.
  À recollecter en phase B pour voir les révisions du 2 novembre.
- Clients : distributeur A à 44 % et client direct A à 16 % des revenus du deuxième trimestre (10-Q). Google
  est le seul client nommé. Amazon n'apparaît pas dans les dépôts : aucun lien client n'est à affirmer.

### Contexte attribué (presse ; narratif seulement, aucun chiffre de cours)
- Bloomberg, 28/10 : discussions avancées, annonce possible la semaine suivante, opération probablement en
  actions. https://www.bloomberg.com/news/articles/2026-10-28/marvell-is-said-to-near-deal-for-lumentum-in-ai-related-megadeal
- Bloomberg, 02/11 : accord de 115 Md$ en actions.
  https://www.bloomberg.com/news/articles/2026-11-02/marvell-reaches-115-billion-deal-for-lumentum-holdings
- CNBC, 29/10 : Microsoft ramène ses investissements 2026 de 175 à 170 Md$ en raison de retards de
  fournisseurs tiers de processeurs graphiques ; Google et Microsoft ne relèvent pas leurs prévisions.
  https://www.cnbc.com/2026/10/29/microsoft-google-ai-capex-estimates.html
- Selon la presse, MRVL a fortement baissé le 29/10 et le 02/11 en séance. **Ne pas reprendre ces cours** :
  tout pourcentage viendra des barres certifiées.

### Comparables (23 au total, 6 groupes, `static-mrvl.cjs`)
- Leaders : AVGO, NVDA.
- Pairs directs : LITE (cible), COHR, ALAB, CRDO.
- Amont : TSM, AMKR, AXTI, FN.
- Aval : GOOGL (client documenté), MSFT, AMZN, META.
- Second ordre : AMD, ANET, CIEN, AAOI, MU, NBIS.
- Paniers : SMH, SOXX, QQQ.
- Variables run-collect : `documented_client_symbols=GOOGL`. En découverte, RankBeta (au 30/10, 180 j)
  place ALAB, COHR, LITE, AAOI, AXTI et MU parmi les actions corrélées à plus de 0,5.

### Calendrier connu (sources de données, une seule source sauf mention)
AMD, ALAB et ANET le 03/11 ; COHR le 04/11 ; AAOI le 05/11 ; NBIS le 12/11 ; NVDA le 17/11 ; CRDO le 30/11 ;
MRVL le 01/12 (non confirmé). FN publiait le 02/11 après la clôture (deux sources).

### Consignes de l'orchestrateur (reçues pendant la phase A)
- Clôtures du 29/10 signalées par l'agent LITE : MRVL 218,34 $ (−13,2 %), LITE 919,53 $. **À recouper sur
  les barres certifiées** avant usage ; les chiffres « 222,66 $ / −11,5 % » étaient des cotations en séance.
- Dilution à chiffrer dans le générateur, convertibles compris. Formule : actions LITE diluées × 4,5 /
  capital MRVL. Les 101,7 M d'actions diluées GAAP du premier trimestre (EX-99.1 Lumentum) incluent la
  préférence de NVIDIA. L'effet dilutif des convertibles 2026, 2029 et 2032 au cours du jour reste à
  vérifier dans les notes du 10-K et du 10-Q de Lumentum. Montrer les deux bases : 921,2 M d'actions diluées
  MRVL et 876,9 M d'actions ordinaires. Effet sur le bilan : reprise de la dette de Lumentum, de sa trésorerie
  (1 979,6 M$ = 1 272,2 + 707,4 au 26/09) et d'un écart d'acquisition considérable. Il n'y a pas de dette
  d'acquisition.
- `tradeIdea.triggerNotBefore` est obligatoire si le plan est conditionné à un événement daté.

## Reste (phase B, après certification du 2026-11-02)
1. GetStatus : vérifier `served_completed_end == 2026-11-02` sur `bars_daily_us_equity` et le témoin SPY.
   Puis jeton via `GetReadOnlyToken(minutes=60)` dans le scratchpad, en `chmod 600`, transmis par
   `MCP_TOKEN_FILE_MARKETDATA`.
2. `NODE_OPTIONS= bash tools/run-collect.sh analyse analyses/MRVL/_data --var symbol=MRVL --var refdate=2026-11-02 --var comparison_start_date=<J-300 environ> --var comparison_symbols=AVGO,NVDA,LITE,COHR,ALAB,CRDO,TSM,AMKR,AXTI,FN,GOOGL,MSFT,AMZN,META,AMD,ANET,CIEN,AAOI,MU,NBIS,SMH,SOXX,QQQ --var documented_client_symbols=GOOGL`
   (ce répertoire contient encore la collecte du 24 septembre, que run-collect écrase).
3. Archiver la fiche du 24 septembre : copier `data/analyses-data/MRVL.json` vers `analyses/MRVL/_runs/20261102/original/MRVL.json`.
   L'archive HTML `analyses/MRVL/archive/20260924/` existe déjà. Conserver `meta.statusHistory` (watch →
   active le 01/10 à 275,28 → stopped le 14/10 à 245,28).
4. Écrire `build-mrvl.cjs`, `compose-mrvl.cjs` et `compose-mrvl-body.cjs` sur le modèle NBIS/LITE du 27
   octobre (R08, `mode`, `levels` lus sur les barres, `timeline`, `tribunal`, `bottomEstimation`, trois
   scénarios : accord à termes acceptables / discussions ou procédure qui traînent / accord cher en actions
   ou rupture). Si le plan dépend d'un événement daté, ajouter `tradeIdea.triggerNotBefore` (consigne de
   l'orchestrateur : première séance dont la clôture compte).
5. Valorisation : multiple des pairs (statistiques collectées), VE recalculée au cours du jour et non tirée du
   champ `enterpriseValue` du fournisseur. Statut halal : ratios dette/actifs (4 962,9 M$ de dette pour
   27 554,6 M$ d'actifs au 01/08) et trésorerie/actifs, selon la même méthode que les fiches existantes.
6. Contrôles : check-freshness, validate-workflows --run-plan, validate-analysis-evidence,
   check-analysis-editorial-quality --strict --pre-review, publish-analysis --dry, qa-content --strict et
   check-ai-tells --strict. Ensuite trois relectures AQ-1.1 (Senior QA, Contrarian, Retail War Room)
   enregistrées avec record-analysis-editorial-reviews.js, puis le contrôle `--require-current-attestation`.

## Interdits rappelés
Pas de commit, pas de push, pas de publish-analysis sans `--dry`, aucune notification et aucun outil broker.
Ne pas toucher aux fiches LITE et NBIS (refaites en parallèle) ni aux index partagés.

## Mise à jour 20 h 45 (Paris) — phase B lancée sur refdate 2026-10-30 (consigne du propriétaire)

- Collecte n° 1 (19:33Z) : vagues preflight, price-fundamentals et blast-radius OK (barres certifiées
  jusqu'au 30/10, comparables, contexte). La vague risk-evidence a échoué sur `insider_current` (délai
  dépassé sur insider_ownership[LITE]) et `symbol_signals` (timeout), ce qui rend la collecte FAIL.
- Collecte n° 2 : HTTP 502 dès le preflight. Depuis 19:36Z, le MCP marketdata renvoie 502 (Cloudflare
  origin_bad_gateway). Règle MCP HARD STOP appliquée : aucune substitution. Les sondes GetStatus légères
  sont espacées (60, 120, 240 puis 480 s) ; il n'y a plus de salve lourde.
- Relevé de séance non certifié capturé AVANT la panne : `revision/live-quote-2026-11-02T1933Z.json`
  (MRVL 173,375 $ à −11,7 % ; LITE 689,97 $ à −17,9 % ; à 19:30Z).
- Générateur écrit (`build-mrvl.cjs`, `compose-mrvl.cjs`, `compose-mrvl-body.cjs`) au gabarit R08, avec
  une section `liveSession` « Séance du 2 novembre en cours » et le plan `watch` avec
  `triggerNotBefore: 2026-11-03`. Ajout facultatif de `liveSession` au schéma
  (`tools/lib/analysis-schema.json`) et au rendu (`tools/render-analysis.js`, `renderLiveSession`).
- Original archivé dans `original/MRVL.json`. L'ancien `analyses/MRVL/_data` (copie du 24/09) a été
  déplacé vers `analyses/MRVL/_runs/20260924/_data-live-0924`.
- Reste : relancer `run-collect` (refdate 2026-10-30) dès que le MCP répond, puis lancer le build, les
  contrôles et les trois revues. Le jeton expire à 20:32Z ; il faudra en réémettre un si la reprise est
  plus tardive.

## État final 21 h 15 (Paris) — phase B terminée sur refdate 2026-10-30
- Collecte `plans/analyse.json` PASS (19:56Z) ; cotations de séance collectées avec leur propre harnais
  (`plans/analyse-20261102-live.json` → `analyses/MRVL/_data-live/`, enregistré dans `config/workflow-contracts.json`).
- Toutes les gates sont PASS ; trois relectures AQ-1.1 en PASS (Senior QA 88, Contrarian 87, Retail 88) sur JSON 3998324d… et sidecar
  dc26c44e… ; l'attestation est enregistrée dans `data/analysis-editorial-reviews/20261102.json` ; `--require-current-attestation` PASS.
- Pas de rendu de `analyses/MRVL/index.html` (publication laissée à l'orchestrateur) ; aperçu : `preview/index.html`.
- À faire après la clôture certifiée du 2/11 : recalculer les niveaux (le plan est provisoire), refaire les relectures.
