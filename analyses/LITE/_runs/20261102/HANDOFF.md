# LITE — passation phase A → phase B (refdate 2026-11-02)

Rédigé le 2 novembre 2026 à 18:25 UTC (19:25 Paris). Faits sourcés complets : `phase-a-facts.json` (même dossier).

## Pourquoi l'arrêt

`GetStatus` (18:18 UTC) : `bars_daily_us_equity.served_completed_end = 2026-10-30`, barre du 2/11 incomplète,
`next_complete_available_at = 2026-11-02T21:30:00Z` (22 h 30 Paris). Phase B interdite avant cette heure.
Ne pas faire de RefreshBars plein univers ; certifier par symbole (témoins SPY/QQQ + LITE, MRVL).

## Ce qui change tout

1. **Accord signé.** Marvell rachète Lumentum (8-K 0001193125-26-442758, accord du 1er novembre, annonce
   le 2 avant l'ouverture). 100 % en actions, **parité fixe 4,500 MRVL par LITE**. Valeur annoncée ≈ 1 132 $
   (+23,9 % sur les clôtures non affectées du 28/10 : 4,5 × 251,65 = 1 132,43 ; 913,95 pour LITE).
   Clôture visée S1 2028 (« 12-18 mois » dans les 425). Indemnités : 5,8 Md$ (Marvell), 2,9 Md$ (Lumentum),
   **3,2 Md$ de rupture réglementaire payés par Marvell**. Date butoir 1/11/2027 → jusqu'au 1/8/2028.
   Conditions : deux votes, HSR, autres autorisations listées dans une annexe NON publique, S-4 effectif.
   Marvell peut refuser tout remède « Burdensome ». Détail : `phase-a-facts.json › deal`.
2. **Résultats déjà publiés** le 2/11 avant l'ouverture (8-K 0001628280-26-068655), et non le 5/11 comme
   annoncé le 5 octobre. T1 FY27 : CA 1 262,6 M$ (+136,5 % sur un an), marge op. non-GAAP 42,3 %,
   prévision T2 1 575-1 625 M$, BPA non-GAAP 5,90-6,20 $. Le 5 novembre sort de l'échéancier.
3. **Cotations de la consigne fausses.** Barres certifiées du 29/10 : MRVL 218,34 $ (−13,24 %), LITE 919,53 $
   (+0,61 %), et non 222,66 / 939,82. Du 30/10 : MRVL 196,40 $, LITE 840,70 $. N'utiliser que les barres.
   À la clôture du 30/10, la contrepartie valait 4,5 × 196,40 = 883,80 $ ; LITE 840,70 $ ; écart 43,10 $ (5,1 %).

## Fait (phase A)

- `validate-workflows.js --workflow analyse` : PASS.
- GetStatus lu ; RankBeta reporté en phase B (point-in-time sur la clôture du 2/11).
- 9 dépôts primaires du 2/11 téléchargés et hachés dans `analyses/LITE/_primary/2026-11-02-*` (8-K accord +
  pièces 2.1, 99.1, 99.2 ; 8-K résultats + 99.1 ; trois 425).
- Liste EDGAR complète 1/9 → 2/11 : aucun S-3, S-3ASR, 424B ni ATM.
- Consensus (QueryData analyst_trend, 1/11) : 28 analystes, Buy, objectif moyen 1 166,28 $ (avant l'accord).
- Échéancier vérifié : emploi US 6/11 et CPI 10/11 (14 h 30 Paris, BLS) ; PPI 13/11 ; CoreWeave 10/11 après
  la clôture (communiqué du 27/10) ; Nebius 12/11 avant l'ouverture (communiqué du 30/10) ; NVIDIA 17/11 à
  23 h Paris (page IR) ; Marvell ≈ 1/12 **non confirmé** (Yahoo seulement) ; S-4, HSR, votes non datés.
- CNBC du 29/10 (Microsoft 175 → 170 Md$, retards GPU au S1 2027 ; Alphabet 195-205 Md$) vérifié et copié.
- Comparables proposés (27, sept classes) : `phase-a-facts.json › comparables_proposed`. Seuls changements
  par rapport au 27/10 : MRVL devient l'acquéreur (référence de prix), NBIS entre en aval.
- Copies web hachables : `web/` (Bloomberg 28/10 via Yahoo, CNBC, CoreWeave, Nebius).

## Reste à faire (phase B, après 21:30 UTC)

1. GetStatus : exiger `served_completed_end = 2026-11-02` sur `bars_daily_us_equity`, puis barres LITE et MRVL
   en `completed_only` (as_of_timestamp ≥ 21:30Z) avant toute autre chose.
2. Jeton : `GetReadOnlyToken(minutes=60)` → fichier 0600 du scratchpad → `MCP_TOKEN_FILE_MARKETDATA=…`.
   Node : préfixer `NODE_OPTIONS=` (préchargement cassé dans cette session).
3. `bash tools/run-collect.sh analyse analyses/LITE/_data --var symbol=LITE --var refdate=2026-11-02
   --var comparison_start_date=2025-11-03 --var comparison_symbols=MRVL,COHR,AAOI,CRDO,MTSI,AXTI,SMTC,TSEM,FN,NVDA,CIEN,ANET,CSCO,NBIS,GOOGL,MSFT,META,AMZN,ORCL,CRWV,AVGO,ALAB,GLW,VIAV,SMH,SOXX,XLK
   --var documented_client_symbols=NVDA` ; RankBeta(reference=LITE, as_of=2026-11-02).
4. Builder `analyses/LITE/_runs/20261102/` copié de `20261027` (gabarit R08, `analysis-v3-r08.cjs`) :
   `ref 2026-11-02`, `run 20261102` ; agrégats = FY26 10-K + T1 FY27 − T1 FY26 lus dans le communiqué
   (`manualFinancials`, valeurs dans `phase-a-facts.json › q1_fy27_results.ttm_build_note`) ; bilan au 26/09 ;
   actions 90,6 M + 2,9 M de préférence (communiqué) ; docs = nouveaux dépôts + 10-K + circulaire.
   Archiver la page du 27/10 dans `analyses/LITE/archive/20261026/` et ajouter l'entrée `archiveHistory`.
5. **Fiche = dossier d'arbitrage de fusion.** À calculer depuis les barres du 2/11 : contrepartie = 4,5 × MRVL,
   écart en $ et en %, rendement annualisé sur 12 et 18 mois, dividende MRVL dû sur la jambe vendeuse
   (QueryData dividends), indemnité de rupture réglementaire par action (3,2 Md$ / 93,5 M ≈ 34 $, à recalculer),
   prix de rupture plausible (pairs optiques depuis le 28/10, jamais un chiffre libre). Plan probable :
   pas d'achat directionnel de LITE (le titre suit MRVL × 4,5) ; l'arbitrage exige une vente à découvert de
   4,5 MRVL par LITE (emprunt, dividende, horizon 2028) — à écrire pour un particulier. Statut à trancher :
   `no-trade` (dossier informatif) ou `watch` avec un seuil d'écart ; si un déclencheur en clôture subsiste,
   `tradeIdea.triggerNotBefore = "2026-11-02"` et le dire dans `entryNote`.
5 bis. **Consigne éditoriale du propriétaire (prime sur le point 5).** Lecteur acheteur seulement : pas de
   vente à découvert (interdite pour le lectorat halal, hors portée des particuliers). Ne jamais présenter
   l'écart avec l'offre comme un gain : sans couverture, détenir LITE = détenir 4,5 MRVL jusqu'au S1 2028 avec
   un rabais pour risque de rupture.
   - En tête de verdict : « Voulez-vous porter Marvell jusqu'en 2028 ? »
   - Comparer, chiffré sur la **clôture certifiée du 2/11** uniquement : (a) garder LITE, (b) vendre maintenant,
     (c) remplacer tout de suite par 4,5 MRVL.
   - Résultat de chaque option selon le cours de MRVL à l'échéance (−30 %, −15 %, 0, +15 %, +30 %), puis en cas de
     rupture, avec et sans l'indemnité réglementaire de 3,2 Md$ rapportée par action LITE diluée. Préciser
     qu'elle n'est due que sur blocage réglementaire. Prix de rupture tiré de références mesurées (pairs optiques
     depuis le 28/10, cours non affecté), jamais d'un chiffre libre ; tout calculer dans un artefact de calcul.
   - Annualiser l'écart jusqu'à la date cible (fin du S1 2028 = 2028-06-30 ; indiquer aussi le bas de la plage
     « 12-18 mois »).
   - Plan : pas de vente à découvert ; statut probable `no-trade`/`watch` côté achat.
   - Cotes indicatives de la séance à 19:17 UTC (LITE 689,52 $ −18,0 % ; MRVL 173,61 $ −11,6 %) : **interdites
     dans la fiche**, seulement un signal pour revérifier la clôture.

6. **Correction du cycle de vie : DÉJÀ APPLIQUÉE par l'orchestrateur** (vérifié à 18:27 UTC dans
   `data/analyses-data/LITE.json`) : `meta.status` et `tradeIdea.status` = `watch`, entrée `active → watch`
   du 2026-11-02T18:26:53Z en fin de `meta.statusHistory`, `meta.lastEvent` supprimé, pas de
   `triggerNotBefore`. Le builder doit **reprendre `statusHistory` tel quel depuis ce JSON (archive) sans
   dupliquer cette entrée**, puis n'ajouter que la transition de la refonte (`watch → <nouveau statut>`).
   Le schéma accepte désormais `tradeIdea.triggerNotBefore`.
7. Timeline, blast radius (trois scénarios : accord conclu / revu / rompu), tribunal en dernier, halal
   (ratios dette et trésorerie / capitalisation au 2/11 ; convertibles ; échange futur en titres Marvell).
8. QA : check-freshness, validate-workflows --run-plan, validate-analysis-evidence, check-analysis-editorial-quality
   --strict --pre-review, publish-analysis --dry, qa-content --strict, check-ai-tells --strict ; puis trois revues
   AQ-1.1 (Senior QA, Contrarian, Retail War Room), record-analysis-editorial-reviews, gate --require-current-attestation.

## Interdits rappelés

Pas de commit, push, publish sans `--dry`, Telegram, broker. Ne pas toucher NBIS/MRVL (autres agents),
ni `data/analyses.json`, radar, `data/analyses-status.json`, `tools/analyses-lifecycle.js`.

---

## Phase B accélérée (consigne du propriétaire, refdate 2026-10-30) — état à 19:45 UTC

Fait :
- Builder complet `build-lite.cjs` / `compose-lite.cjs` / `compose-lite-body.cjs` / `static-lite.cjs` (mode `archived`,
  statut `no-trade`, plan du 27/10 archivé, bloc `liveSession` « Séance du 2 novembre en cours », trois options chiffrées,
  rupture avec/sans indemnité, timeline 2 → 20 novembre, tribunal). Relevé de séance MCP haché :
  `live/quote-2026-11-02T1934Z.json` (19:34 UTC). Ancienne page copiée dans `analyses/LITE/archive/20261027/`.
  Archive JSON d'entrée : `original/LITE.json` (version corrigée par l'orchestrateur, statusHistory conservé).
- Build OK ; `check-analysis-editorial-quality --strict --pre-review` PASS ; `qa-content --strict` PASS (32/0/0) ;
  `check-ai-tells --strict` PASS ; `publish-analysis --dry` PASS ; rendu `analyses/LITE/index.html` fait.

Bloqué :
- Collecte `run-collect` (refdate 2026-10-30) : 1er passage partiellement en échec (backpressure du serveur sur la
  vague « context » + insider_current, symbol_signals), 2e passage HTTP 502 dès le preflight. Le MCP marketdata
  renvoie 502 (Cloudflare) depuis 19:36 UTC ; sondes de reprise à 60 s, 120 s, 240 s. `_collect.json` reflète le
  passage en 502 ⇒ `validate-analysis-evidence` échoue sur la provenance du collecteur (seule erreur restante),
  check-freshness / validate --run-plan non passables.
- Reste après reprise : relancer run-collect (même commande), rebuild, toutes les gates, recapturer la séance si
  souhaité (capture-live.cjs, puis changer `LIVE` dans build-lite.cjs), trois revues AQ-1.1, record, gate attestation.
- Sondes de reprise : 19:39:38, 19:41:38, 19:45:38 UTC → HTTP 502 à chaque fois. HARD STOP appliqué (aucune donnée
  substituée). Jeton effacé du scratchpad ; en reprendre un avec GetReadOnlyToken(60) à la relance.
- Commande de reprise : `MCP_TOKEN_FILE_MARKETDATA=<fichier 0600> NODE_OPTIONS= bash tools/run-collect.sh analyse analyses/LITE/_data --var symbol=LITE --var refdate=2026-10-30 --var comparison_start_date=2026-02-09 --var comparison_symbols=MRVL,COHR,AAOI,CRDO,MTSI,AXTI,SMTC,TSEM,FN,NVDA,CIEN,ANET,CSCO,NBIS,GOOGL,MSFT,META,AMZN,ORCL,CRWV,AVGO,ALAB,GLW,VIAV,SMH,SOXX,XLK --var documented_client_symbols=NVDA`
  puis `NODE_OPTIONS= node analyses/LITE/_runs/20261102/build-lite.cjs` et les gates.

## Clôture du run (20:09 UTC)
MCP rétabli à 19:48 UTC ; collecte complète refdate 2026-10-30 (PASS), séance collectée par `live-plan.json` → `session/`
(19:54 UTC). Toutes les gates PASS ; trois relectures AQ-1.1 PASS (Senior QA 90, Contrarian 89, War Room 88) sur le JSON
610f0731… ; attestation `data/analysis-editorial-reviews/attestations/LITE-20261102-aq11.json`, manifeste
`data/analysis-editorial-reviews/20261102.json` ; `--require-current-attestation` PASS. Rien de commité ni publié.
