# NBIS — état du 2 novembre 2026, 21 h 30 Paris

**Phase B faite sur consigne du propriétaire (publication avant certification) : refdate = 2026-10-30.**
- Collecte harnachée `analyses/NBIS/_data` (plan analyse, 28/28, refdate 2026-10-30, 21 comparables dont LITE/COHR/MRVL) ;
  supplément de séance collecté par `collect.js` avec un plan propre au run (`plan-supplement.json`, non inscrit dans
  `config/workflow-contracts.json`) → `supplement/` (quote, chaîne du 13/11, calendrier 30 jours, harnais + journal).
- Builder `build-nbis.cjs` (+ compose, body, static) → `data/analyses-data/NBIS.json`, `data/analyses-evidence/NBIS.json`,
  `revision/numeric-evidence.json`, `revision/primary-manifest.json`, `preview/index.html`. La ligne « Dette nette /
  capitalisation » voit sa provenance réécrite en fin de build (bilans fournisseur + actions + clôtures), sidecar
  re-haché.
- Section « Séance du 2 novembre en cours » = premier point du verdict (controlChecklist[0]) + news[0] + options ; le
  renderer n'a pas de section titrée libre (changer `tools/render-analysis.js` aurait touché un outil partagé).
- Gates : freshness PASS (26 + 4), run-plan PASS, evidence PASS, éditorial pré-revue PASS, publish --dry PASS,
  qa-content et ai-tells PASS sur `preview/index.html` (la page publiée `analyses/NBIS/index.html` n'est pas rendue :
  publication par l'orchestrateur).
- Revues AQ-1.1 (4 tours ; v4 finale) : Senior QA 91, Contrarian 87, War room 86, aucun BLOCK ; attestation
  `revision/reviews/NBIS-20261102-aq11.json` enregistrée dans `data/analysis-editorial-reviews/20261102.json` ;
  `check-analysis-editorial-quality.js --strict --require-current-attestation` PASS. Hashes finaux : JSON 5dcae027…, sidecar e6e973bd….
- Ne plus reconstruire sans relecture : tout build change l'empreinte et invalide l'attestation.
- À faire après la clôture certifiée du 2 novembre : appliquer la règle des 145,80 $, recalculer les niveaux.

---

# NBIS — relève du 2 novembre 2026 (phase A faite, phase B en attente de la clôture)

Arrêt à 18 h 40 UTC (19 h 40 Paris). `GetStatus` à 18 h 19 UTC : `bars_daily_us_equity.served_completed_end = 2026-10-30`,
`next_complete_available_at = 2026-11-02T21:30:00Z` (22 h 30 Paris). Clôture du 2 novembre non certifiée : rien de chiffré
sur le cours n'est écrit dans la fiche.

## Fait

- Contrat lu : `.claude/commands/analyse.md`, `analyses/CLAUDE.md`, `source-policy.md`, `mcp-token-procedure.md`,
  `EDITORIAL_STYLE.md`, gotchas (mémoire auto), builders FICO et NBIS du 27 octobre (gabarit R08).
- Archive figée : `original/NBIS.json` = `data/analyses-data/NBIS.json` **après la correction de l'orchestrateur**
  (sha256 `9a82c9620939084fde8207fec99de9399c8ddd24d99f4910db0634b3a7b7ca73`) : statuts `watch`,
  `tradeIdea.triggerNotBefore = 2026-11-12`, `lastEvent` supprimé, et entrée `active → watch` du
  2026-11-02T18:26:53Z ajoutée en fin de `meta.statusHistory` (note : signal du 28 octobre invalide). L'entrée fautive
  `watch → active` du 29 octobre reste dans l'historique. Si le cycle de vie réécrit NBIS.json ce soir, comparer avant
  de reconstruire et recopier l'archive.
- EDGAR (CIK 1513845, submissions lues à 18 h 20 UTC) : **aucun 6-K, F-3, 424B ni 13G depuis le 6-K Citi du 22 octobre.**
  Seulement des formulaires 4 et un 144, tous minuscules et sous plan 10b5-1 :
  - Arne Grimme (administrateur), achats : 22/10 357 à 161,97 ; 23/10 205 à 158,98 ; 26/10 208 à 153,96 ; 27/10 205 à
    159,04 ; 28/10 148 à 169,84 ; 29/10 148 à 169,42 (plan du 15 juin 2026) — accessions 0001513845-26-000141/143/145.
  - John Boynton (président), vente 29/10 de 333 actions à 173,07 $ (plan du 6 mars 2026), 0001513845-26-000147 ; avis 144
    du 29/10 (333 actions, 60 719 $, RSU), 0001950047-26-010478.
- Date de résultats **confirmée par la société** : communiqué « Amsterdam, October 30, 2026 » — résultats du T3 le
  **jeudi 12 novembre 2026 avant l'ouverture**, conférence à **8 h ET = 14 h Paris**. Le MCP (`calendar`) donne aussi
  `nextEarningsDate 2026-11-12T13:30:00Z`. Corriger partout le « 10 novembre » de la fiche du 27 octobre.
- Pièces hors EDGAR enregistrées et hachées (`primary/`), extraits vérifiés par `build-sources-manifest.cjs` →
  `revision/sources-manifest.json` (5 pièces) :
  - Nebius, date du T3 (ci-dessus).
  - CoreWeave : conférence des résultats du T3 le **mardi 10 novembre à 17 h ET (23 h Paris)**, donc après la clôture ;
    réaction le **mercredi 11**. (La fiche du 27 retenait le 11 d'une seule source : faux.)
  - Nvidia : conférence le **mardi 17 novembre à 14 h PT / 17 h ET (23 h Paris)**, T3 de l'exercice 2027 ; réaction le 18.
  - CNBC, Jordan Novet, 29 octobre 7 h 30 EDT : « Microsoft reduced its capex forecast for the year to $170 billion from
    $175 billion » ; Amy Hood : « third-party providers of graphics processing units had delays that will push out some
    available capacity until the first half of 2027 » ; « Microsoft relies on CoreWeave, IREN and Nebius, among others ».
    **CNBC ne dit pas que Nebius est en retard** : ne rien lui attribuer. L'année du capex n'est pas précisée dans les
    phrases relevées (« for the year ») — ne pas écrire « exercice 2027 » sans le relire.
  - Lumentum 8-K pièce 99.1 du **2 novembre** (accession 0001193125-26-442758) : accord définitif Marvell–Lumentum, tout
    en actions, 4,500 actions Marvell par action Lumentum, valeur d'entreprise implicite 115 Md$, clôture visée au
    S1 2028. Le scoop Bloomberg du 28 octobre est donc dépassé : citer l'accord.
- Consensus T3 (presse attribuée, aucune source MCP) : MarketBeat **905,75 M$ / BPA −0,7067 $** (page du rapport
  « 2026-11-10 » mais qui affiche bien le 12 novembre) ; TradingView **904,82 M$ / BPA −0,75 $** (page non datée, date de
  publication périmée : citer avec prudence) ; Benzinga, repris par Tickeron le 22 octobre, **environ 937 M$** et BPA
  ajusté d'environ −1,03 $. Repère de la fiche : la prévision 3,0–3,4 Md$ exige en moyenne 1 009,4 à 1 209,4 M$ par
  trimestre au S2 (calcul existant) ; un T3 à 905 M$ impose ≥ 1 113 M$ au T4 pour tenir le bas de la fourchette.
- Prévision de la société (dépôts déjà ouverts) : lettre T1 « $3.0B–$3.4B revenue in 2026 and $7B–$9B ARR », lettre T2
  « reaffirming our full-year 2026 guidance across all metrics » (aiguilles `guidance` et `reaffirm` du static). Aucune
  mise à jour depuis.
- Calendriers MCP capturés par jeton read-only (jeton effacé) :
  - `revision/capture-calendar.json` (GetEarningsCalendarFiltered, 30 jours, 18 h 24 UTC) : LITE 2/11, PLTR 2/11 AMC,
    CIFR 2/11 BMO, SMCI 3/11, COHR 4/11, CORZ 5/11, IREN 5/11, WULF 6/11, CRWV 10/11, NBIS 12/11, NVDA 17/11, DELL 24/11,
    MRVL 1/12 (une seule source sauf PLTR/CIFR). MSFT, META, VRT, BE, APLD, ORCL : pas d'événement dans 30 jours.
  - `revision/capture-options.json` (chaîne NBIS, échéances 6/13/20 novembre, ±20 %, **18 h 24 UTC, séance ouverte**,
    spot 146,68 $) : secours si la chaîne relevée après la clôture n'a pas de cotations. Straddle 148 du 13/11 à ce
    moment ≈ 14,05 + 13,90 = 27,95 $ (≈ 19 %). **Attention : à 147/148 la vol. implicite des calls (≈ 1,38–1,39) dépasse
    celle des puts (≈ 1,24)** — l'affirmation « IV puts > calls » du brief n'est pas vérifiée à cette heure ; relire à
    la clôture avant d'écrire quoi que ce soit sur le skew.
- Quote MCP 18 h 21 UTC (non certifiée, ne pas publier) : 146,68 $, −4,84 %, plus bas 145,57, plus haut 155,355,
  ouverture 154,56, veille 154,14. **Le seuil d'abandon de 145,80 $ est à 0,6 % du cours** : la règle se jugera sur la
  clôture certifiée.
- Comparables retenus (21, sept groupes, ≥ 4 classes) : ceux du 27 octobre (NVDA ; CRWV, IREN ; MSFT, META ; DELL, SMCI,
  VRT, BE ; APLD, CIFR, WULF, CORZ, ORCL ; PLTR ; SMH, IGV, QQQ) **+ nouveau groupe amont « optique et interconnexion des
  grappes » : LITE, COHR, MRVL** (lien : transceivers et puces d'interconnexion des grappes de GPU ; l'accord du 2/11
  est un signal sur le prix que le marché paie l'IA d'infrastructure, pas un lien contractuel avec Nebius — l'écrire
  ainsi). Pas de GOOGL/AMZN : aucun lien documenté avec Nebius.

## À vérifier au dépôt primaire avant usage (transmis par l'agent LITE, non relu ici)

- Accord Marvell–Lumentum signé le 1er novembre, annoncé le 2 avant l'ouverture (même 8-K 0001193125-26-442758 :
  relire le 8-K principal `d163169d8k.htm` pour la date de signature).
- Résultats de Lumentum publiés le 2 novembre : CA 1 262,6 M$, prévision 1 575–1 625 M$ au trimestre suivant (pièce
  99.2 du même 8-K, `d163169dex992.htm`, à ouvrir et hacher si la fiche l'utilise dans le maillon optique).
- Clôtures certifiées du 29 octobre (selon l'agent LITE) : MRVL 218,34 $, LITE 919,53 $ — à relire dans
  `comparison_bars` après la collecte, jamais à recopier.

## Reste (phase B, après certification)

1. `GetStatus` : exiger `bars_daily_us_equity.served_completed_end = 2026-11-02` (witness SPY + NBIS). Pas de RefreshBars
   plein univers.
2. Jeton (`GetReadOnlyToken(60)` → fichier 0600 du scratchpad) puis :
   ```
   NODE_OPTIONS= bash tools/run-collect.sh analyse analyses/NBIS/_data \
     --var symbol=NBIS --var refdate=2026-11-02 --var comparison_start_date=2026-02-09 \
     --var comparison_symbols=NVDA,CRWV,IREN,DELL,SMCI,VRT,BE,LITE,COHR,MRVL,PLTR,ORCL,APLD,CIFR,WULF,CORZ,SMH,IGV,QQQ \
     --var documented_client_symbols=MSFT,META
   ```
   (`NODE_OPTIONS=` obligatoire : préchargement cmux cassé dans cette session.) Puis `capture-supplement.cjs options`
   une seconde fois si la chaîne du plan est sans cotation ; garder la capture de 18 h 24 UTC sinon, datée comme telle.
3. Builder `20261102/` (copie du 27 octobre, gabarit R08) : REF `2026-11-02`, run `20261102`, asOf `2026-11-02` (ou
   date de collecte) ; `earningsDate` attend `2026-11-12` et la source est le communiqué de la société (plus « une seule
   source ») ; `base()` vérifie les extrêmes annuels — recalculer ; nouveaux niveaux sur les barres jusqu'au 2/11 ;
   static : ajouter le 8-K Lumentum (cik 1633978) aux `docs`, groupe optique, `eventRisk` (CRWV 10/11 après clôture,
   NVDA 17/11 après clôture, IREN 5/11, LITE/PLTR/CIFR 2/11, COHR 4/11, SMCI 3/11, WULF 6/11, MRVL 1/12).
4. `meta.statusHistory` : reprendre les cinq entrées de l'archive telles quelles (provenance `archive`), dont la
   correction `active → watch` de l'orchestrateur — **ne pas la dupliquer**. Puis appliquer la règle des 145,80 $ sur la
   clôture certifiée du 2/11 : si elle est dessous, ajouter `watch → invalidated` (plan abandonné) ; sinon, ajouter
   l'entrée de refonte `watch → watch` avec la note datée « clôture du 2 novembre à X $, au-dessus du seuil d'abandon ».
   Pas de `lastEvent` (supprimé par l'orchestrateur).
5. `tradeIdea.triggerNotBefore = "2026-11-12"` : le schéma l'accepte désormais (mise à jour de l'orchestrateur). Le
   compose doit l'écrire, cohérent avec l'entryNote (résultats avant l'ouverture : la clôture du 12 à 22 h Paris est la
   première qui compte ; CoreWeave aura publié le 10 au soir).
6. Échéancier : Nebius 12/11 (confirmé, 14 h Paris la conférence), CoreWeave 10/11 23 h Paris, NFP 6/11 14 h 30 Paris
   (`daily/20261022/_primary/bls_empsit_schedule.htm`), CPI 10/11 (`data/scheduled-events.json`), PPI 13/11, Nvidia
   17/11 23 h Paris, IREN 5/11 (une source), échéance options 13/11, fin du plan, ligne Citi 16/10/2027 (hors fenêtre :
   en note).
7. Calculs, sidecar, gates du contrat, trois relectures nommées (AQ-1.1), `record-analysis-editorial-reviews.js`,
   `check-analysis-editorial-quality.js --strict --require-current-attestation`.

## Fichiers créés à ce stade

- `analyses/NBIS/_runs/20261102/HANDOFF.md`
- `analyses/NBIS/_runs/20261102/original/NBIS.json`
- `analyses/NBIS/_runs/20261102/capture-supplement.cjs`, `build-sources-manifest.cjs`
- `analyses/NBIS/_runs/20261102/revision/capture-options.json`, `capture-calendar.json`, `sources-manifest.json`
- `analyses/NBIS/_runs/20261102/primary/` : `oct30-ir-q3-date.html`, `oct27-crwv-q3-date-businesswire.html`,
  `nvda-q3fy27-call-globenewswire.html`, `oct29-cnbc-msft-capex.html`, `nov02-lite-8k-ex991-marvell.htm`

Aucun fichier partagé modifié par cet agent ; `data/analyses-data/NBIS.json` corrigé par l’orchestrateur (statut watch, triggerNotBefore).
