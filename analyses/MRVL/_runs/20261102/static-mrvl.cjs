'use strict';
// Éléments statiques du dossier Marvell Technology (MRVL) du 2 novembre 2026 : dépôts primaires ouverts et hachés,
// extraits textuels exigés, groupes économiques du rayon de propagation. Lu par build-mrvl.cjs (gabarit R08).
// Phase A (indépendante des cours) préparée le 2 novembre 2026 vers 19 h 30, heure de Paris : accord de fusion
// avec Lumentum signé le 1er novembre et annoncé le 2 novembre avant l'ouverture (8-K 0001193125-26-442717 et
// 0001193125-26-442714), ligne de crédit relevée le 22 octobre (8-K du 23 octobre), dividende du 25 septembre.
// Aucun S-3, S-3ASR, 424B ni S-8 déposé par Marvell entre le 24 septembre et le 2 novembre 2026 (index EDGAR).
const ACC_MERGER = '0001193125-26-442717', ACC_PR = '0001193125-26-442714', ACC_10Q = '0001835632-26-000025';
const LITE_CIK = 1633978;

// [date, formulaire, accession, fichier EDGAR, fichier local (analyses/MRVL/_primary), constat, cik facultatif]
const docs = [
  ['2026-11-02', '8-K', ACC_MERGER, 'd352474d8k.htm', 'nov26-nov02-8k-merger.htm',
    'Accord de fusion signé le 1er novembre 2026 : chaque action Lumentum recevra 4,500 actions Marvell, rémunération entièrement en actions. Conditions : vote des actionnaires des deux sociétés (émission des actions et hausse du nombre d’actions autorisées chez Marvell), délai HSR et autres autorisations réglementaires, enregistrement S-4. Date limite au 1er novembre 2027, prolongeable jusqu’au 1er août 2028. Indemnités de rupture : 5,8 Md$ dues par Marvell si son conseil retire sa recommandation, 2,9 Md$ dues par Lumentum dans le cas symétrique, 3,2 Md$ dues par Marvell si l’opération échoue pour raison réglementaire.'],
  ['2026-11-02', '8-K / Exhibit 99.1', ACC_PR, 'd81187dex991.htm', 'nov26-nov02-ex991.htm',
    'Communiqué commun : valeur d’entreprise implicite de 115 Md$ pour Lumentum, environ 1 132 $ par action, prime d’environ 23,9 % sur les cours du 28 octobre, dernière séance avant les rumeurs. Les actionnaires actuels de Marvell détiendront environ 67 % du nouvel ensemble, ceux de Lumentum environ 33 %. Plus de 1 Md$ de synergies de coûts annuelles visées, relution du bénéfice ajusté par action de Marvell dès la première année après la clôture, prévue au premier semestre 2028. Revenus préliminaires du troisième trimestre conformes à la prévision : milieu maintenu, fourchette resserrée à 2 % près.'],
  ['2026-08-28', '10-Q', ACC_10Q, 'mrvl-20260801.htm', 'q2fy27-10q.htm',
    'Rapport trimestriel au 1er août 2026 : 876,9 millions d’actions ordinaires au 21 août ; 1,3 milliard d’actions autorisées ; 2 millions d’actions de préférence de série A (NVIDIA). Un distributeur écoule 44 % des revenus du trimestre et un client direct 16 %.'],
  ['2026-08-27', '8-K / Exhibit 99.1', '0001835632-26-000022', 'q227_8kx812026ex-991.htm', 'q2fy27-ex991.htm',
    'Communiqué du deuxième trimestre de l’exercice 2027 : revenus de 2,739 Md$ (+37 %), centres de données à 2,172 Md$ ; prévision de 3,150 Md$ de revenus au troisième trimestre, à 5 % près.'],
  ['2026-08-19', '8-K', '0001193125-26-356217', 'd412696d8k.htm', 'aug19-8k.htm',
    'Accord commercial avec Google et bon de souscription de 58 970 907 actions à 206,58 $ émis le 18 août 2026, acquis par tranches liées aux achats de Google.'],
  ['2026-03-31', '8-K', '0001193125-26-134462', 'd113606d8k.htm', 'mar31-8k.htm',
    'Émission à NVIDIA de 2 millions d’actions de préférence de série A pour 2 Md$, convertibles en 21 778 000 actions ordinaires au maximum, sans droit de vote pour l’élection des administrateurs ; déjà comptées dans le nombre d’actions retenu par la fiche, elles s’ajoutent à la dilution de l’accord avec Lumentum.'],
  ['2026-02-02', '8-K/A', '0001193125-26-032861', 'd45933d8ka.htm', 'feb02-8ka.htm',
    'Clôture de l’acquisition de Celestial AI : actions émises à la clôture et complément de prix en actions lié à des paliers de revenus jusqu’à l’exercice 2029.'],
  ['2026-03-11', '10-K', '0001835632-26-000011', 'mrvl-20260131.htm', 'fy26-10k.htm',
    'Rapport annuel de l’exercice clos le 31 janvier 2026 : 1,3 milliard d’actions ordinaires autorisées ; un distributeur pèse 37 % des revenus annuels et un client direct 14 %.'],
  ['2026-10-23', '8-K', '0001193125-26-430424', 'd147430d8k.htm', 'nov26-oct23-8k.htm',
    'Ligne de crédit renouvelable portée de 1,5 à 3 Md$ le 22 octobre 2026, extensible de 2 Md$, rien de tiré à la signature ; ratio de levier plafonné à 4,00, relevable à 4,50 l’année d’une acquisition d’au moins 500 M$.'],
  ['2026-09-25', '8-K / Exhibit 99.1', '0001628280-26-063592', 'a20260925dividendpressrele.htm', 'nov26-sep25-ex99.htm',
    'Dividende trimestriel de 0,06 $ par action, actions de préférence comprises sur une base convertie, payé le 29 octobre 2026 aux actionnaires inscrits le 9 octobre ; un rendement marginal qui ne pèse ni sur la trésorerie ni sur le dossier de l’accord.'],
  ['2026-11-02', 'Lumentum 8-K / Exhibit 99.1', '0001628280-26-068655', 'lite_ex991xq1fy27.htm', 'nov26-lite-q1fy27-ex991.htm',
    'Résultats de Lumentum au trimestre clos le 26 septembre 2026 : revenus de 1 262,6 M$ (+136,5 % sur un an), marge opérationnelle ajustée de 42,3 %, 101,7 millions d’actions diluées ; prévision de 1 575 à 1 625 M$ de revenus au trimestre suivant. 1 360,3 M$ de dette à court terme au bilan, essentiellement des obligations convertibles.', LITE_CIK],
  ['2026-08-17', 'Lumentum 10-K', '0001628280-26-057358', 'lite-20260627.htm', 'nov26-lite-fy26-10k.htm',
    'Rapport annuel de Lumentum : actions de préférence convertibles de série A émises en mars 2026 pour 1 999,7 M$ nets ; obligations convertibles à 0,375 % échéance 2032 de 1 265,0 M$.', LITE_CIK],
  ['2026-11-02', 'Lumentum 425', '0001193125-26-442765', 'd162314d425.htm', 'nov26-lite-425-a.htm',
    'Courriel de Lumentum à ses clients : clôture attendue dans environ 12 à 18 mois ; d’ici là, les deux sociétés restent indépendantes et les commandes en cours ne changent pas.', LITE_CIK],
];

const needles = {
  ratio: [0, ['will be converted into the right to receive 4.500 shares of common stock', 'Marvell Series B Preferred Stock']],
  approvals: [0, ['adoption of the Merger Agreement by Lumentum’s stockholders', 'approval of the Share Issuance and the Charter Amendment by Marvell’s stockholders', 'Hart-Scott-Rodino Antitrust Improvements Act of 1976', 'effectiveness of the Form S-4']],
  charter: [0, ['an amendment of Marvell’s Second Amended and Restated Certificate of Incorporation (the “ Charter ”) to increase the number of authorized shares of Marvell Common Stock']],
  outside: [0, ['November 1, 2027, which may be extended to February 1, 2028, May 1, 2028 and August 1, 2028']],
  fees: [0, ['a termination fee equal to $5.8 billion', 'a termination fee equal to $2.9 billion', 'a termination fee equal to $3.2 billion']],
  board: [0, ['Marvell will appoint three (3) individuals designated by Lumentum']],
  ev: [1, ['implied enterprise value of $115 billion for Lumentum', 'approximately $1,132 per share of Lumentum common stock', 'a premium of approximately 23.9%', 'as of October 28, 2026, the last trading day before market speculation regarding a potential transaction began']],
  ownership: [1, ['current Marvell stockholders will own approximately 67% of the combined company on a fully diluted basis, while Lumentum stockholders will own approximately 33%']],
  synergies: [1, ['more than $1 billion in annual run-rate cost synergies', 'accretive to Marvell non-GAAP earnings per share in year one post-close']],
  close: [1, ['expected to close in the first half of calendar year 2028']],
  prelim: [1, ['maintaining the midpoint of its prior guidance while narrowing the expected range to plus or minus 2%, compared with the original range of plus or minus 5%']],
  allStock: [1, ['in an all-stock transaction']],
  shares10q: [2, ['The number of shares of common stock of the registrant outstanding as of August 21, 2026 was 876.9 million']],
  authorized: [2, ['the Company is authorized to issue 8.0 million shares of $ 0.002 par value preferred stock and 1.3 billion shares of $ 0.002 par value common stock']],
  customers: [2, ['Customer A 16% 16% 16% 16% Distributor: Distributor A 44% 34% 45% 35%']],
  balance: [2, ['Total assets $ 27,554.6', 'Long-term debt 4,962.9', 'Cash and cash equivalents $ 3,932.8']],
  buyback: [2, ['As of August 1, 2026, $ 5.1 billion remained available for future stock repurchases']],
  q3guide: [3, ['Net revenue is expected to be $3.150 billion +/- 5%.', 'Non-GAAP gross margin is expected to be 57.5% to 58.5%.', 'Non-GAAP operating expenses are expected to be approximately $655 million.']],
  icfr: [7, ['management concluded that our internal control over financial reporting was effective as of January 31, 2026']],
  dcp: [2, ['concluded that our disclosure controls and procedures were effective as of August 1, 2026']],
  china: [2, ['China $ 1,161.5 42 %']],
  liteGeo: [11, ['Hong Kong 519.3 17.2', 'China 284.8 9.4', '2032 Notes $ 187.77']],
  q2nonGaap: [3, ['Non-GAAP operating margin 36.6 %']],
  revolver: [8, ['provides for borrowings of up to $3 billion', 'increase the commitments under the Revolving Credit Agreement by up to an aggregate of $2 billion', 'no Revolving Loans were outstanding', 'no greater than 4.00 to 1.00', 'increase to 4.50 to 1.00']],
  dividend: [9, ['a quarterly dividend of $0.06 per share of common stock, including preferred stock on an as converted to common stock basis']],
  liteQ1: [10, ['Net revenue $ 1,262.6 $ 1,006.3 $ 533.8 25.5% 136.5%', 'Non-GAAP operating margin of 42.3%', 'Diluted 101.7 78.3', 'Net revenue in the range of $1.575 billion to $1.625 billion', 'Current portion of long-term debt 1,360.3', 'Long-term debt 39.3', 'Cash and cash equivalents $ 1,272.2 $ 2,043.5 Short-term investments 707.4', 'Non-GAAP diluted earnings per share of $5.90 to $6.20']],
  liteNvidia: [11, ['Series A Convertible Preferred Stock, par value $ 0.001 per share (the “Preferred Stock”) to NVIDIA Corporation (“NVIDIA”)', 'sold at a price of $ 695.31 per share for an aggregate purchase price of $ 2.0 billion in cash']],
  litePref: [11, ['$1,999.7 million of net proceeds from the issuance of Series A Convertible Preferred Stock', '$ 1,265.0 million in aggregate principal amounts of 0.375 % Convertible Senior Notes due in 2032']],
  liteTiming: [12, ['we expect the transaction to close in approximately 12-18 months']],
};

// Groupes économiques : définis par le lien d'affaires, jamais par la seule corrélation.
const groups = [
  { name: 'Leaders — puces sur mesure et accélérateurs', order: 1, transmission: 'Broadcom fixe le prix du sur-mesure chez les grands clouds ; NVIDIA vend les grappes de calcul que relient les puces de Marvell, détient des actions de préférence de Marvell et des actions de préférence de Lumentum.', rows: [
    ['AVGO', 'leader', 'Leader des puces sur mesure et de la commutation', 'Concurrent de référence sur les accélérateurs sur mesure et les commutateurs ; le marché compare désormais Marvell-Lumentum à un Broadcom de l’optique.'],
    ['NVDA', 'leader', 'Leader des accélérateurs, actionnaire des deux sociétés', 'Détient 2 Md$ d’actions de préférence Marvell et les actions de préférence de série A de Lumentum ; ses résultats du 17 novembre fixent le ton des budgets de connectivité.']] },
  { name: 'Pairs directs — connectivité et optique', order: 1, transmission: 'Même demande de liaisons électriques et optiques dans les centres de données, mêmes clients. Lumentum est la cible : son cours, rapporté au ratio de 4,5, dit ce que le marché paie pour l’accord.', rows: [
    ['LITE', 'direct_peer', 'Cible du rachat, lasers et modules optiques', 'Chaque action Lumentum vaudra 4,5 actions Marvell : l’écart entre son cours et 4,5 fois celui de Marvell mesure le doute sur la conclusion de l’opération.'],
    ['COHR', 'direct_peer', 'Modules optiques et lasers, concurrent de la cible', 'Premier concurrent du nouvel ensemble dans l’optique ; il gagne si des clients veulent éviter de dépendre d’un seul fournisseur intégré.'],
    ['ALAB', 'direct_peer', 'Connectivité électrique des serveurs', 'Concurrent sur les liaisons de proximité, le pair le plus corrélé à Marvell parmi les composants.'],
    ['CRDO', 'direct_peer', 'Câbles électriques actifs et liaisons courtes', 'Concurrent sur les liaisons de courte distance, que l’optique intégrée doit remplacer à terme.']] },
  { name: 'Amont — fabrication, assemblage et substrats', order: 1, transmission: 'Marvell ne fabrique pas ses puces ; Lumentum fabrique ses lasers sur phosphure d’indium. Fonderie, assemblage et substrats fixent volumes et délais du nouvel ensemble.', rows: [
    ['TSM', 'upstream', 'Fonderie des puces avancées', 'Ses capacités en gravure et en assemblage avancé fixent les volumes livrables des puces sur mesure.'],
    ['AMKR', 'upstream', 'Assemblage et test des puces', 'Ses capacités d’assemblage avancé comptent pour les grandes puces sur mesure et l’optique intégrée au boîtier.'],
    ['AXTI', 'upstream', 'Substrats de phosphure d’indium', 'Fournit le matériau de base des lasers ; ses tensions d’approvisionnement touchent d’abord la partie Lumentum.'],
    ['FN', 'upstream', 'Sous-traitant de fabrication optique', 'Assemble des modules optiques pour le secteur ; une intégration verticale de Marvell-Lumentum pourrait déplacer une partie de ces volumes.']] },
  { name: 'Aval — client documenté et grands acheteurs d’infrastructure', order: 1, transmission: 'Google est nommé comme client dans un dépôt de Marvell ; les budgets des grands clouds fixent la demande de puces sur mesure et de liaisons optiques. Microsoft a réduit le 29 octobre sa prévision d’investissements 2026 de 175 à 170 Md$.', rows: [
    ['GOOGL', 'downstream', 'Client documenté des puces sur mesure', 'Chaque tranche de 500 M$ achetée par Google fait croître les revenus de Marvell et lui acquiert une part du bon de souscription.'],
    ['MSFT', 'downstream', 'Grand cloud, budget d’infrastructure en baisse', 'A ramené sa prévision d’investissements 2026 de 175 à 170 Md$ en citant des retards de fournisseurs tiers de capacité ; aucun lien client avec Marvell n’est affirmé ici.'],
    ['AMZN', 'downstream', 'Grand cloud, concepteur de puces maison', 'Son budget d’infrastructure pèse sur la demande de puces sur mesure ; aucun lien client n’est affirmé ici, les dépôts de Marvell ne le nomment pas.'],
    ['META', 'downstream', 'Grand acheteur d’infrastructure d’IA', 'Ses annonces d’investissements déplacent tout le panier des semi-conducteurs et des liaisons optiques.']] },
  { name: 'Second ordre — réseaux, mémoire et loueurs de calcul', order: 2, transmission: 'Commutateurs, réseaux optiques, mémoire et loueurs de calcul partagent la même dépendance aux budgets d’IA ; ils disent si la baisse de Marvell vient de l’accord ou du cycle.', rows: [
    ['AMD', 'second_order', 'Accélérateurs concurrents de NVIDIA', 'Ses grappes demandent aussi des liaisons rapides ; publie le 3 novembre.'],
    ['ANET', 'second_order', 'Commutateurs de centres de données', 'Gros consommateur de modules optiques ; ses commandes mesurent la construction des réseaux d’IA.'],
    ['CIEN', 'second_order', 'Réseaux optiques longue distance', 'Lecture du trafic entre centres de données, débouché des processeurs de signal optiques.'],
    ['AAOI', 'second_order', 'Modules optiques, concurrent plus petit', 'Concurrent de la cible sur les modules ; profite si des clients diversifient leurs fournisseurs.'],
    ['MU', 'second_order', 'Mémoire à haute bande passante', 'Baromètre des budgets de mémoire et d’infrastructure d’IA ; le contrôleur de mémoire de Marvell en dépend.'],
    ['NBIS', 'second_order', 'Loueur de calcul, client aval des grands clouds', 'Publie le 12 novembre ; ses investissements en processeurs graphiques tirent la demande de liaisons.']] },
  { name: 'Contrôles sectoriels', order: 2, transmission: 'Paniers de référence pour séparer ce qui est propre à Marvell et à l’accord de ce qui vient du secteur ou du marché.', rows: [
    ['SMH', 'sector_proxy', 'Panier des semi-conducteurs', 'Un écart avec ce panier isole ce qui vient de l’accord.'],
    ['SOXX', 'sector_proxy', 'Panier des semi-conducteurs, autre pondération', 'Confirme le premier panier avec une pondération moins concentrée.'],
    ['QQQ', 'sector_proxy', 'Grandes valeurs du Nasdaq', 'Contrôle du marché de croissance : un mouvement commun n’a rien de propre au titre.']] },
];

module.exports = { docs, needles, groups, ACC_MERGER, ACC_PR, ACC_10Q };
