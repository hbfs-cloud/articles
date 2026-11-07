# Revues indépendantes du scan du 9 novembre 2026, tour 1 (fil principal, 7 novembre 2026)

Relu : signals.json 85d9b92a…7764, index.html 5be72fd4…ed9c. Senior QA BLOCK, Contrarian BLOCK, Retail War Room BLOCK.

## Décision du fil principal (le propriétaire a délégué l'arbitrage : « tu tranches toi-même les problèmes »)

KWEB est REJETÉ par jugement écrit (même mécanisme que Chevron le 5 novembre : le modèle peut écarter un éligible, jamais en créer un). Motifs, tous tirés du snapshot :
- profil de retournement et non de suivi de tendance : EMA20 23,93 < EMA50 24,54 < EMA200 27,67 (empilement inversé), MACD −0,136, clôture 10,1 % sous l'EMA200, +9,4 % mesuré depuis la plus basse clôture sur un an (22,74 $ le 30 octobre) ; en RISK-OFF seuls les suivis de tendance sont ouverts et « Reversal » est interdit (data/scanner-filters.json#strategies.forbidden) : l'étiquette Momentum vient de la famille du crible ETF, pas du fonds ;
- gain/risque 1:0,95 sous 1 ; sur l'horizon de 10 séances, rejeu grossier sur 290 départs : invalidation touchée en premier 41 %, objectif 36 % ;
- fonds non diversifié composé d'émetteurs étrangers dont les grandes lignes publient d'ordinaire leurs comptes à la mi-novembre, non vérifié dans le snapshot, alors que le même scan écarte BIRK, LI, SONY comme émetteurs étrangers ;
- fonds sans DICI, inachetable chez la plupart des courtiers européens ; achat lundi la veille de l'inflation, à rebours du weekly et du daily (aucun achat avant le test de mercredi 22h00).

Résultat : zéro ligne. Publier le résultat honnête « aucune ligne pour lundi 9 novembre » si l'outillage le permet (validate-scan/render/qa sur 0 signal, sans affaiblir un garde-fou) ; sinon ne pas publier de page de scan et s'assurer que l'aval (sweep, status, API, dtx_pool, cartes de modes, tracking) ne contient AUCUN ordre KWEB pour le 9 novembre. Les dérogations plancher/plafond deviennent sans objet : les retirer des listes fermées (tools/lib/basket-minimum-waiver.js, family-cap-waiver.js) et supprimer les fichiers de dérogation du 9 novembre, sauf si une page « aucune ligne » les exige pour passer (dans ce cas les justifier comme tels).

## Corrections obligatoires sur tout texte publié (page « aucune ligne », Telegram)

- Retirer la phrase « Seule distribution des douze derniers mois : 2,096 $, détachée le 22 décembre 2025 » : chiffre absent du snapshot et contredit par les barres (Senior QA, bloquant). Vérifier qu'aucun autre chiffre de la thèse n'est hors snapshot.
- Saison des résultats, honnêteté (Contrarian, bloquant) : « Sept publient dans la fenêtre (CALY, ABNB, PENN, RYN, LEGN, DIS, LOW). Onze viennent de publier (du 21 octobre au 3 novembre : WCN, ROL, HLT, PNR, LTH, MAR, HLF, SBRA, FLYW, MOS, RYTM) mais notre source ne donne pas leur prochaine date : notre règle les écarte par défaut, sans risque de résultats établi dans l'horizon. VMRK n'a aucune donnée. » Ne PAS changer la règle fail-closed dans ce run ; la consigner comme question ouverte pour le propriétaire (règle d'inférence : 8-K 2.02 de moins de N jours ⇒ prochaine publication hors horizon, à backtester).
- Dilution : « COST, CPB et LVS ont enregistré une étagère d'émission (S-3ASR) dans la fenêtre ; nos règles l'écartent par sa forme, même sans émission constatée. NEE : 424B3 du 28 juillet lu sur pièce (actions de fusion). »
- Échéancier de l'horizon (si une page est publiée) : CPI mardi 10 (14h30), CoreWeave mardi 10 (23h00), Cisco et Applied Materials jeudi 12 (22h30), PPI vendredi 13 (14h30, BLS), Nvidia mardi 17 (vers 22h20) — sources déjà certifiées dans weekly/20261109/primary-reference.json. Supprimer « aucun ne tombe entre le 16 et le 20 ».
- « pire séance du Nasdaq-100 depuis mars 2020 » : citer QQQ −6,5 % depuis les barres ou renvoyer au daily du 6 novembre ; « l'argent sorti de la tech américaine n'a pas fui toute la tech » → fait mesuré (KWEB +1,8 % jeudi quand le Nasdaq-100 reculait) ou retirer.
- Restes de gabarit au singulier/pluriel (« 1 setups », « 1 thèses », « Top 1 », « de 1:0,95 à 1:0,95 »), meta description comprise.
- Une phrase de cohérence avec le weekly et le daily : aucun achat avant le test de mercredi 11 à 22h00 (lien /weekly/20261109/ et /daily/20261107/).
- Entonnoir : vérifier 59 contre 60 (26 + 18 + 14 + 2) avant d'afficher un total.
- risk-gating.json : correlation_observations à null quand il n'y a aucune paire.
- tools/lib/family-cap-waiver.js : si la date du 9 reste, commentaire de justification ; sinon la retirer.
