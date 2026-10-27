'use strict';
// Éléments statiques du dossier Iovance Biotherapeutics (IOVA) du 27 octobre 2026 : dépôts primaires ouverts et hachés,
// extraits textuels exigés, groupes économiques du rayon de propagation. Lu par build-iova.cjs.
// Rappel d'incident (juin 2026) : la fiche IOVA a déjà publié un plus haut annuel, une trésorerie et une capitalisation
// inventés. Ici, chaque chiffre d'entreprise est lu dans un dépôt EDGAR listé ci-dessous et vérifié par un extrait
// textuel ; chaque cours vient des barres certifiées.
const ACC_10Q = '0001104659-26-091716', ACC_ER2 = '0001104659-26-091619';

const docs = [
  ['2026-08-06', '10-Q', ACC_10Q, 'iova-20260630x10q.htm', '2026-08-06-10-Q-091716-iova-20260630x10q.htm',
    'Deuxième trimestre 2026 : 452 971 016 actions au 30 juin et 452 971 432 au 29 juillet (411 938 061 au 31 décembre 2025), plus 32 730 876 équivalents d’actions, dont 17 566 321 options (prix d’exercice moyen 14,85 $ ; 14 570 654 exerçables à 17,08 $ en moyenne) et 12 711 528 actions gratuites en cours d’acquisition ; 341 919 364 actions un an plus tôt, au 30 juin 2025. Programme de vente d’actions au fil de l’eau avec Jefferies (350,0 M$, août 2025) : 14 000 743 actions vendues au trimestre à 3,61 $ en moyenne pour 49,6 M$ nets ; jusqu’à environ 89,7 M$ encore disponibles sous la nouvelle déclaration automatique du 18 juin. 303,7 M$ de trésorerie, placements et liquidités soumises à restriction au 30 juin ; 132,9 M$ consommés par l’exploitation au premier semestre. Aucun client au-dessus de 10 % du chiffre d’affaires brut ; 650 millions d’actions autorisées.'],
  ['2026-08-06', '8-K / Exhibit 99.1', ACC_ER2, 'tm2622322d1_ex99-1.htm', '2026-08-06-8-K-091619-tm2622322d1_ex99-1.htm',
    'Communiqué du deuxième trimestre : chiffre d’affaires d’environ 99 M$ (+66 % sur un an, +39 % sur le trimestre), dont environ 91 M$ d’Amtagvi aux États-Unis ; marge brute de 56 % hors amortissements ; perte nette de 47,3 M$ (0,11 $ par action). Prévision annuelle de 350 à 370 M$ mise « en revue ». Trésorerie d’environ 304 M$ au 30 juin, censée financer l’activité jusqu’au second semestre 2028. Cancer du poumon : inclusions des cohortes pivots presque terminées, mise à jour du programme attendue au quatrième trimestre, demande d’extension d’autorisation prévue en 2027. Frederick Vogt signe comme président et directeur général par intérim.'],
  ['2026-09-29', '8-K / Exhibit 99.1', '0001104659-26-111583', 'tm2626507d1_ex99-1.htm', '2026-09-29-8-K-111583-tm2626507d1_ex99-1.htm',
    'Prévision de chiffre d’affaires 2026 relevée à 410–420 M$ contre 350–370 M$, soit 55 M$ de plus au milieu de la fourchette ; « forte visibilité » sur les troisième et quatrième trimestres. La société publiera ses résultats du troisième trimestre « début novembre 2026 », sans date précise.'],
  ['2026-06-18', 'S-3ASR', '0001104659-26-075778', 'iova-20260618xs3asr.htm', '2026-06-18-S-3ASR-075778-iova-20260618xs3asr.htm',
    'Déclaration d’enregistrement automatique d’émetteur chevronné (WKSI), qui renouvelle à son échéance de trois ans l’étagère du 16 juin 2023 (n° 333-272718) : montant indéterminé d’actions, d’actions de préférence, d’obligations, de bons de souscription et d’unités, régime normal d’un émetteur de cette taille. Supplément joint pour le programme au fil de l’eau avec Jefferies : 260,3 M$ déjà vendus sous l’ancienne déclaration, 89 650 167 $ encore vendables.'],
  ['2026-02-24', '10-K', '0001104659-26-018899', 'iova-20251231x10k.htm', '2026-02-24-10-K-018899-iova-20251231x10k.htm',
    'Rapport annuel 2025 : Amtagvi bénéficie d’une autorisation accélérée aux États-Unis ; TILVANCE-301 (lifileucel et pembrolizumab en première ligne du mélanome avancé) sert d’essai de confirmation. Concurrents cités : BioNTech, Bristol-Myers Squibb, Genmab, Immunocore, Merck, Moderna, Replimune, Immatics, entre autres. Aucun client au-dessus de 10 % du chiffre d’affaires brut en 2025 ; Proleukin vendu à trois distributeurs principaux non nommés.'],
  ['2026-05-07', '10-Q', '0001104659-26-056778', 'iova-20260331x10q.htm', '2026-05-07-10-Q-056778-iova-20260331x10q.htm',
    'Premier trimestre 2026 : 24 918 834 actions vendues au fil de l’eau à 4,03 $ en moyenne, pour 98,5 M$ nets, sous le contrat Jefferies d’août 2025. Avec le deuxième trimestre, 38,9 millions d’actions ont été émises de cette façon au premier semestre : c’est ce qui a maintenu la trésorerie autour de 300 M$.'],
  ['2025-08-22', '8-K', '0001104659-25-081953', 'tm2524060d1_8k.htm', '2025-08-22-8-K-081953-tm2524060d1_8k.htm',
    'Contrat de vente d’actions au fil de l’eau modifié avec Jefferies, signé le 22 août 2025 : jusqu’à 350,0 M$ d’actions ordinaires, vendues au gré de la société, commission jusqu’à 3,0 % du produit brut. C’est le programme qui a financé l’essentiel du premier semestre 2026 et qui garde jusqu’à 89,7 M$ de capacité.'],
  ['2026-10-05', '8-K / Exhibit 99.1', '0001104659-26-113763', 'tm2627047d1_ex99-1.htm', '2026-10-05-8-K-113763-tm2627047d1_ex99-1.htm',
    'Présentation d’octobre 2026 : environ 100 centres de traitement agréés au 5 octobre ; trésorerie censée durer jusqu’au second semestre 2028 ; lancement possible dans le cancer du poumon au second semestre 2027.'],
  ['2026-05-07', '8-K / Exhibit 99.1', '0001104659-26-056782', 'tm2613648d1_ex99-1.htm', '2026-05-07-8-K-056782-tm2613648d1_ex99-1.htm',
    'Communiqué du premier trimestre : prévision de 86 à 88 M$ pour le deuxième trimestre et de 350 à 370 M$ pour 2026 ; trésorerie censée durer jusqu’à une date avancée de 2028 ; départ à la retraite du directeur médical en juin 2026.'],
  ['2026-02-24', '8-K / Exhibit 99.1', '0001104659-26-018837', 'tm266992d1_ex99-1.htm', '2026-02-24-8-K-018837-tm266992d1_ex99-1.htm',
    'Communiqué de l’exercice 2025, publié le 24 février 2026 : environ 264 M$ de chiffre d’affaires, dans la fourchette annoncée de 250 à 300 M$ ; trésorerie d’environ 303 M$ censée durer jusqu’au troisième trimestre 2027, une échéance repoussée depuis au second semestre 2028.'],
  ['2025-11-06', '8-K / Exhibit 99.1', '0001104659-25-107426', 'tm2530236d1_ex99-1.htm', '2025-11-06-8-K-107426-tm2530236d1_ex99-1.htm',
    'Communiqué du troisième trimestre 2025, publié le 6 novembre 2025 : trésorerie censée durer jusqu’au deuxième trimestre 2027. Repère de calendrier : la publication du troisième trimestre 2026, confirmée par la société le 27 octobre pour le 5 novembre, tombe presque un an jour pour jour plus tard.'],
  ['2026-06-10', '8-K', '0001104659-26-072408', 'tm2613648d1_8k.htm', '2026-06-10-8-K-072408-tm2613648d1_8k.htm',
    'Assemblée du 10 juin 2026 : vote sur le relèvement du nombre d’actions autorisées de 500 à 650 millions ; le 10-Q du 6 août confirme 650 millions d’actions autorisées.'],
  ['2026-10-02', '3', '0001104659-26-113341', 'tm2626734-1_3seq1.xml', '2026-10-02-3-113341-tm2626734-1_3seq1.xml',
    'Formulaire 3 de Noah Berkowitz : entré chez Iovance comme directeur médical le 30 septembre 2026, après le départ à la retraite du précédent en juin. Le formulaire 4 déposé le même jour lui attribue 135 000 options à 14,82 $ et 180 000 actions gratuites.'],
];

const needles = {
  sharesCover: [0, ['As of July 29, 2026, the issuer had 452,971,432 shares of common stock']],
  sharesJune: [0, ['As of June 30, 2026, we had 452,971,016 shares of common stock outstanding. In addition, we had 32,730,876 shares of common stock equivalents']],
  atmQ2: [0, ['raised approximately $ 49.6 million in net proceeds, through the sale of 14,000,743 shares of common stock pursuant to the 2025 Sale Agreement at a weighted average price per share of $ 3.61']],
  atmLeft: [0, ['up to approximately $ 89.7 million of Common Shares', 'up to $ 350.0 million of shares of the Company’s common stock']],
  liquidity: [0, ['$ 303.7 million in cash, cash equivalents, short-term investments, and restricted cash', 'used $ 132.9 million of cash in its operating activities during the six months ended June 30, 2026']],
  authorized: [0, ['650,000,000 shares authorized, 452,971,016 and 411,938,061 shares issued and outstanding']],
  distributors: [0, ['to three main distributors in the U.S.']],
  financing: [0, ['Net cash provided by financing activities for the six months ended June 30, 2026, was $143.6 million']],
  options: [0, ['17,566,321 $ 14.85', 'Options exercisable at June 30, 2026 14,570,654', '$ 17.08 4.35', '12,711,528']],
  sharesYearAgo: [0, ['341,919,364']],
  q2: [1, ['Total product revenue was ~$99 million, an increase of 66% from ~$60 million in 2Q25 and 39% from ~$71 million in 1Q26', 'U.S. Amtagvi revenue was ~$91 million, up 40% from 4Q25', 'Gross margin was 56%']],
  review: [1, ['we are reviewing our previously issued 2026 revenue guidance of $350 million to $370 million']],
  runwayQ2: [1, ['As of June 30, 2026, Iovance’s cash position was ~$304 million', 'current cash is expected to fund operations into 2H28']],
  weighted: [1, ['Basic and Diluted 450,189 334,511']],
  interim: [1, ['Interim President and Chief Executive Officer']],
  lung: [1, ['Enrollment is nearly complete in the pivotal cohorts and program updates are expected in 4Q26', 'A supplemental Biologics License Application (sBLA) submission is planned in 2027']],
  atcs: [1, ['The network has grown to more than 95 U.S., Canadian, and Australian ATCs, with at least 110 ATCs expected to be active by the end of 2026']],
  raise: [2, ['raised its full year 2026 total revenue guidance range to $410 to $420 million', 'Increasing patient demand and our current manufacturing schedule provide strong visibility into our third and fourth quarter revenues']],
  q3date: [2, ['Iovance expects to report third quarter 2026 financial results in early November 2026']],
  shelf: [3, ['“well-known seasoned issuer”', 'an indeterminate amount of', 'up to a maximum aggregate offering price of $89,650,167', 'an aggregate offering price of approximately $260,349,833']],
  shelfRenewal: [3, ['(Registration Statement No. 333-272718)']],
  competitors: [4, ['BioNtech, Bristol-Myers Squibb, Daiichi Sankyo, Eisai, Genmab, Immunocore, IO Biotech, Merck, Moderna, Pfizer, Regeneron Pharmaceuticals, and Replimune', 'Immatics, Immunocore']],
  confirmatory: [4, ['is designed to support a registrational path for lifileucel in combination with pembrolizumab in frontline advanced']],
  shares2025: [4, ['As of December 31, 2025 we had 411,938,061 shares of common stock outstanding']],
  atmQ1: [5, ['raised approximately $ 98.5 million in net proceeds, through the sale of 24,918,834 shares of common stock pursuant to the 2025 Sale Agreement at a weighted average price per share of $ 4.03']],
  atmDeal: [6, ['up to $350.0 million of shares of the Company', 'commission of up to 3.0% of the gross sales proceeds']],
  october: [7, ['~100 Treatment Centers as of 10/05/26', 'Potential launch in 2H27', 'Cash Runway into 2H28']],
  q1guide: [8, ['Total product revenue guidance for 2Q26 is $86 million to $88 million and for FY26 is $350 million to $370 million', 'is expected to fund operations well into 2028', 'retire from Iovance in June 2026']],
  fy25: [9, ['is expected to fund operations into the third quarter of 2027', 'Full year 2025 total product revenue of ~$264 million', 'guidance range of $250 million to $300 million']],
  q3fy25: [10, ['SAN CARLOS, Calif., November 6, 2025', 'is expected to fund operations into the second quarter of 2027']],
  cmo: [12, ['joined Iovance Biotherapeutics, Inc.', 'as its Chief Medical Officer']],
  authorizedVote: [11, ['to increase the number of authorized shares of the Company’s common stock from 500,000,000 shares to 650,000,000 shares']],
};

const groups = [
  { name: 'Leaders — immuno-oncologie et thérapie cellulaire', order: 1, transmission: 'Merck fournit le pembrolizumab associé à lifileucel dans les essais de première ligne ; Bristol-Myers Squibb vend les traitements de référence du mélanome avancé ; Gilead, avec Kite, a bâti le modèle commercial de la thérapie cellulaire autologue. Leur cours mesure l’appétit des investisseurs pour l’immuno-oncologie, pas le sort d’Amtagvi.', rows: [
    ['MRK', 'leader', 'Pembrolizumab, partenaire des essais de première ligne', 'Keytruda est associé à lifileucel dans TILVANCE-301, l’essai de confirmation, et dans IOV-COM-202 : une bonne donnée de l’association sert les deux, mais Merck reste aussi le traitement de référence que lifileucel doit battre.'],
    ['BMY', 'leader', 'Traitements de référence du mélanome avancé', 'Ses anticorps anti-PD-1 et anti-LAG-3 traitent le mélanome en première ligne ; les malades qui échappent à ces traitements forment le marché actuel d’Amtagvi. Concurrent cité dans le 10-K d’Iovance.'],
    ['GILD', 'leader', 'Thérapie cellulaire autologue commerciale (Kite)', 'Gilead vend des cellules T modifiées fabriquées pour chaque malade, comme Amtagvi : même logistique de centres agréés, même question de capacité de production et de remboursement.']] },
  { name: 'Pairs directs — mélanome et cellules T', order: 1, transmission: 'Ces sociétés visent les mêmes malades, mélanome avancé après échec des anti-PD-1 ou cancers solides traités par cellules T. Un succès chez elles réduit la place d’Amtagvi ; un échec rappelle le risque de ces traitements.', rows: [
    ['IMTX', 'direct_peer', 'Cellules T à récepteur modifié contre PRAME', 'Immatics, citée parmi les concurrents en cellules T dans le 10-K d’Iovance, développe des cellules T modifiées dans le mélanome : le concurrent le plus proche du même malade.'],
    ['IMCR', 'direct_peer', 'Récepteurs T solubles dans le mélanome', 'Immunocore, concurrent cité dans le 10-K, vend une immunothérapie du mélanome uvéal et développe d’autres molécules contre PRAME dans le mélanome cutané.'],
    ['REPL', 'direct_peer', 'Virus oncolytique dans le mélanome réfractaire', 'Replimune, cité dans le 10-K, vise les mêmes malades atteints de mélanome après échec des anti-PD-1 : une alternative injectable, sans fabrication de cellules.']] },
  { name: 'Second ordre — lanceurs de thérapies cellulaires', order: 2, transmission: 'Legend, Autolus et CRISPR Therapeutics vendent ou préparent des thérapies cellulaires fabriquées à l’unité. Leur cours dit si le marché paie encore la croissance d’un lancement cellulaire, indépendamment du mélanome.', rows: [
    ['LEGN', 'second_order', 'Thérapie cellulaire commercialisée dans le myélome', 'Lancement cellulaire plus avancé, à marge opérationnelle positive selon les statistiques relevées en instantané : sert d’étalon de valorisation pour une thérapie cellulaire qui croît, à 2,6 fois les revenus.'],
    ['AUTL', 'second_order', 'Thérapie cellulaire en lancement dans la leucémie', 'Autolus vit un lancement cellulaire plus jeune que celui d’Amtagvi, encore à marge brute négative : la comparaison montre ce que vaut l’avance industrielle d’Iovance.'],
    ['CRSP', 'second_order', 'Plateforme de cellules et d’édition génétique', 'Titre de plateforme cellulaire le plus corrélé à IOVA dans le classement statistique du 26 octobre ; mesure le sentiment sur les biotechnologies cellulaires.']] },
  { name: 'Amont — outils de bioproduction', order: 2, transmission: 'La fabrication de chaque dose d’Amtagvi consomme milieux de culture, réactifs et consommables de bioproduction. Aucun contrat avec ces fournisseurs n’est nommé dans les dépôts lus : le lien est générique et sert de contrôle de secteur.', rows: [
    ['TMO', 'upstream', 'Milieux, réactifs et services de bioproduction', 'Premier fournisseur mondial d’outils pour la culture cellulaire ; lien générique avec la fabrication centralisée d’Amtagvi, aucun contrat nommé dans les dépôts.'],
    ['DHR', 'upstream', 'Équipements de bioproduction (Cytiva)', 'Équipements et consommables de production biologique ; lien générique, aucun contrat nommé dans les dépôts d’Iovance.'],
    ['RGEN', 'upstream', 'Filtration et consommables de bioproduction', 'Fournisseur spécialisé des chaînes de production biologique ; lien générique, aucun contrat nommé dans les dépôts.']] },
  { name: 'Aval — distribution et payeurs', order: 2, transmission: 'Proleukin passe par trois distributeurs principaux non nommés, et Amtagvi est payé par Medicare et les assureurs privés. Les distributeurs et les payeurs cotés mesurent la santé de ce canal, sans lien contractuel prouvé avec Iovance.', rows: [
    ['MCK', 'downstream', 'Distribution pharmaceutique et de spécialités', 'Un des grands distributeurs américains de médicaments de spécialité ; Iovance ne nomme pas ses trois distributeurs de Proleukin, le lien reste générique.'],
    ['COR', 'downstream', 'Distribution pharmaceutique et de spécialités', 'Distributeur de spécialités oncologiques ; aucun contrat avec Iovance nommé dans les dépôts lus, lien générique sur le canal de Proleukin.'],
    ['CAH', 'downstream', 'Distribution pharmaceutique et de spécialités', 'Distributeur de spécialités ; lien générique sur le canal de Proleukin, aucun contrat nommé dans les dépôts d’Iovance.'],
    ['UNH', 'downstream', 'Premier assureur santé américain', 'Les assureurs paient Amtagvi à chaque perfusion : leur politique de remboursement fixe le rythme des ventes, sans lien contractuel publié avec Iovance.']] },
  { name: 'Second ordre — immuno-oncologie concurrente', order: 2, transmission: 'Moderna, BioNTech et Genmab sont cités comme concurrents dans le 10-K : vaccins individualisés et anticorps qui pourraient prendre des malades avant ou à la place d’une thérapie cellulaire.', rows: [
    ['MRNA', 'second_order', 'Vaccin individualisé contre le mélanome, avec Merck', 'Moderna, cité dans le 10-K, développe un traitement individualisé du mélanome avec Merck : s’il réussit en traitement adjuvant, le réservoir de malades en échec de première ligne se réduit.'],
    ['BNTX', 'second_order', 'Immuno-oncologie et vaccins individualisés', 'BioNTech, cité dans le 10-K, développe des immunothérapies individualisées dans les tumeurs solides ; concurrent de second rang pour les mêmes indications.'],
    ['GMAB', 'second_order', 'Anticorps en oncologie', 'Genmab, cité dans le 10-K, vend des anticorps en oncologie ; sa valorisation sert aussi d’étalon pour une biotechnologie rentable, à 7,4 fois les revenus.']] },
  { name: 'Contrôles sectoriels', order: 2, transmission: 'Paniers de biotechnologies américaines pour séparer ce qui est propre à Iovance de ce qui vient du secteur.', rows: [
    ['XBI', 'sector_proxy', 'Panier équipondéré des biotechnologies américaines', 'Le comparable le plus corrélé à IOVA sur la fenêtre : s’il monte pendant qu’IOVA baisse, le décrochage est propre au titre.'],
    ['IBB', 'sector_proxy', 'Panier des grandes biotechnologies américaines', 'Contrôle pondéré par la taille ; sépare l’effet secteur de l’effet propre aux petites et moyennes valeurs.']] },
];

module.exports = { docs, needles, groups, ACC_10Q, ACC_ER2 };
