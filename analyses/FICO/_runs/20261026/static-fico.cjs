'use strict';
// Éléments statiques du dossier Fair Isaac (FICO) du 26 octobre 2026 : dépôts primaires ouverts et hachés, extraits
// textuels exigés, groupes économiques du rayon de propagation. Lu par build-fico.cjs.
const ACC_10Q = '0000814547-26-000030', ACC_ER3 = '0000814547-26-000031';

const docs = [
  ['2026-07-29', '10-Q', ACC_10Q, 'fico-20260630.htm', '2026-07-29-10-Q-000030-fico-20260630.htm',
    'Troisième trimestre de l’exercice 2026 (clos le 30 juin) : 21 597 635 actions en circulation au 17 juillet ; dette totale de 5,6 Md$ au 30 juin contre 3,1 Md$ au 30 septembre 2025 ; 3,1 Md$ de rachats d’actions sur neuf mois, dont un rachat accéléré de 1,5 Md$ avec Wells Fargo (1 055 103 actions livrées d’emblée, solde attendu au quatrième trimestre) ; 800,0 M$ encore disponibles au programme de juin. Les trois bureaux de crédit réunis pèsent 63 % du chiffre d’affaires du trimestre (54 % un an plus tôt), chacun plus de 10 % ; les scores aux entreprises font 400,0 M$, 59 % du total. Une action collective antitrust sur la distribution des scores FICO reste ouverte sur un seul chef (Sherman Act, section 2).'],
  ['2026-07-29', '8-K / Exhibit 99.1', ACC_ER3, 'exhibit991erq32026.htm', '2026-07-29-8-K-000031-exhibit991erq32026.htm',
    'Communiqué du troisième trimestre : chiffre d’affaires de 674,2 M$ (+26 %), bénéfice net de 237,2 M$ (10,45 $ par action). Scores : 458,9 M$ (+41 %), dont scores aux entreprises +49 % grâce au prix unitaire des scores de crédit immobilier. Logiciels : 215,3 M$ (+2 %), revenus récurrents +10 %. Flux de trésorerie libre de 370,3 M$. Prévision annuelle relevée : 2,53 Md$ de chiffre d’affaires (contre 2,45 Md$), 36,86 $ de bénéfice par action GAAP (contre 35,60 $), 42,43 $ hors éléments non récurrents (contre 40,45 $).'],
  ['2026-10-06', '8-K', '0001193125-26-415732', 'd127042d8k.htm', '2026-10-06-8-K-415732-d127042d8k.htm',
    'Plan décidé le 1er octobre 2026 : suppression d’environ 15 % des postes, en réduisant les niveaux hiérarchiques et en intégrant l’intelligence artificielle au développement des produits ; charges avant impôt d’environ 27,0 M$ au quatrième trimestre de l’exercice 2026, presque entièrement en numéraire ; plan achevé pour l’essentiel à la fin du troisième trimestre de l’exercice 2027.'],
  ['2026-06-08', '8-K / Exhibit 99.1', '0001193125-26-260817', 'd140061dex991.htm', '2026-06-08-8-K-260817-d140061dex991.htm',
    'Nouveau programme de rachat d’actions de 2,0 Md$ ; prêt à terme supplémentaire de 1,5 Md$ tiré le 5 juin 2026 pour financer un rachat accéléré d’actions de 1,5 Md$ avec Wells Fargo. Les rachats sont financés à crédit.'],
  ['2025-11-07', '10-K', '0000814547-25-000030', 'fico-20250930.htm', '2025-11-07-10-K-000030-fico-20250930.htm',
    'Rapport annuel de l’exercice 2025 : Experian, TransUnion et Equifax réunis pèsent 51 % du chiffre d’affaires (45 % en 2024, 41 % en 2023) ; ces trois bureaux sont à la fois les distributeurs des scores FICO et les propriétaires de VantageScore, son concurrent. Le facteur de risque cite la décision de juillet 2025 de l’agence fédérale du financement du logement (FHFA) qui laisse les prêteurs choisir le score transmis à Fannie Mae et Freddie Mac. 3 811 salariés à la fin de l’exercice.'],
  ['2026-03-11', '8-K / Exhibit 99.1', '0001193125-26-102450', 'd92566dex991.htm', '2026-03-11-8-K-102450-d92566dex991.htm',
    'Émission de 1,0 Md$ d’obligations à 6,250 % échéance 2034, pour rembourser la ligne de crédit, racheter les obligations à 5,25 % échéance 2026 et, le cas échéant, racheter des actions.'],
  ['2025-11-05', '8-K / Exhibit 99.1', '0000814547-25-000026', 'exhibit991erq42025.htm', '2025-11-05-8-K-000026-exhibit991erq42025.htm',
    'Communiqué du quatrième trimestre de l’exercice 2025, publié le 5 novembre 2025 : il fixait la première prévision de l’exercice 2026 à 2,35 Md$ de chiffre d’affaires, et un flux de trésorerie libre de 739,4 M$ sur l’exercice 2025. Sert de repère pour la date de la prochaine publication, non confirmée.'],
  ['2026-04-28', '8-K / Exhibit 99.1', '0000814547-26-000020', 'exhibit991erq22026.htm', '2026-04-28-8-K-000020-exhibit991erq22026.htm',
    'Communiqué du deuxième trimestre de l’exercice 2026 : prévision annuelle relevée de 2,35 à 2,45 Md$ de chiffre d’affaires et de 33,47 à 35,60 $ de bénéfice par action GAAP.'],
];

const needles = {
  shares: [0, ['The number of shares of common stock outstanding on July 17, 2026 was 21,597,635']],
  debt: [0, ['Total debt balance was $5.6 billion as of June 30, 2026']],
  asr: [0, ['received an initial delivery of 1,055,103 shares of common stock', 'expected to occur during the fourth quarter of fiscal 2026']],
  remaining: [0, ['we had $800.0 million remaining under the June 2026 program']],
  repurchases: [0, ['during the nine months ended June 30, 2026 were $3.1 billion']],
  antitrust: [0, ['alleging antitrust claims in connection with the distribution of FICO Scores', 'other than a Sherman Act Section 2 claim']],
  bureausQ3: [0, ['Revenues collectively generated by agreements with these customers accounted for 63', 'all three consumer reporting agencies each contributing more than 10']],
  sharesBs: [0, ['21,597 and 23,764 shares outstanding at June 30, 2026 and September 30, 2025']],
  b2b: [0, ['Business-to-business Scores $ 400,043 $ 268,479']],
  covenant: [0, ['maximum consolidated leverage ratio of 4.5 to 1.0 through December 30, 2026, 4.0 to 1.0 during December 31, 2026 through December 30, 2027', 'we had $ 710.0 million in borrowings outstanding under the revolving line of credit']],
  interest: [0, ['Interest expense, net ( 59,877 ) ( 32,899 )']],
  scoresMargin: [0, ['Segment operating income $ 416,886 $ 55,040']],
  q3: [1, ['Revenue of $674 million vs. $536 million in prior year', 'Net income for the quarter totaled $237.2 million, or $10.45 per share']],
  scores: [1, ['were $458.9 million in the third quarter, compared to $324.3 million in the prior year period, an increase of 41%', 'B2B revenue increased 49%, primarily attributable to a higher mortgage origination scores unit price']],
  software: [1, ['were up 2% year-over-year with $215.3 million in the third quarter', 'Software Annual Recurring Revenue (ARR) was up 10% year-over-year']],
  fcf: [1, ['Free cash flow was $370.3 million for the current quarter']],
  guidance: [1, ['$2.45 billion $2.53 billion', '$35.60 $36.86', '$40.45 $42.43']],
  layoffs: [2, ['elimination of approximately 15% of positions across the Company', 'aggregate pre-tax charges of approximately $27.0 million in the fourth quarter of fiscal 2026']],
  buyback: [3, ['acquire up to $2.0 billion of the company’s outstanding common stock', 'incremental term loan in the amount of $1.5 billion']],
  bureaus: [4, ['collectively accounted for 51%, 45% and 41% of our total revenues']],
  fhfa: [4, ['permitting mortgage originators to choose the credit score they submit with mortgages delivered to Fannie Mae and Freddie Mac']],
  vantage: [4, ['VantageScore (a joint venture entity established by the three major U.S. consumer reporting agencies)']],
  employees: [4, ['Number of employees at fiscal year-end 3,811']],
  bureauData: [4, ['consumer reporting agency data and processing services']],
  notes: [5, ['priced $1.0 billion in aggregate principal amount of 6.250% Senior Notes due 2034', '5.25% Senior Notes due 2026']],
  q4fy25: [6, ['November 5, 2025', 'Fiscal 2026 Guidance Revenues $2.35 billion', 'Free cash flow $ 210,844 $ 219,355 $ 739,400 $ 607,413']],
  q2: [7, ['Revenues $2.35 billion $2.45 billion']],
  fcf9m: [1, ['Free cash flow $ 370,343 $ 276,239 $ 750,035 $ 528,556']],
};

const groups = [
  { name: 'Leaders — mesure du risque et données financières', order: 1, transmission: 'S&P Global, Moody’s, MSCI et Verisk vendent, comme FICO, une note ou une mesure que tout un marché doit utiliser. Leur cours dit si les investisseurs paient encore ces positions de péage, ou s’ils craignent qu’un régulateur les ouvre à la concurrence.', rows: [
    ['SPGI', 'leader', 'Notation et indices', 'Modèle de péage voisin de celui de FICO : une mesure de référence imposée par l’usage et la réglementation, facturée à chaque émission.'],
    ['MCO', 'leader', 'Notation de crédit', 'Même logique de référence obligée que le score FICO, sur le marché obligataire plutôt que sur le crédit aux particuliers.'],
    ['MSCI', 'leader', 'Indices et mesure du risque', 'Rentabilité et pouvoir de prix comparables ; sert à séparer ce que le marché retire à FICO de ce qu’il retire à tous les péages de données.'],
    ['VRSK', 'leader', 'Données et modèles d’assurance', 'Fournisseur de données et de modèles de référence pour un secteur réglementé, comme FICO pour le crédit.']] },
  { name: 'Pair direct et amont — bureaux de crédit', order: 1, transmission: 'Equifax et TransUnion distribuent les scores FICO, qui leur doivent la majorité de leurs ventes, et possèdent VantageScore avec Experian. Chaque point gagné par VantageScore dans le crédit immobilier leur rapporte et coûte à FICO.', rows: [
    ['EFX', 'direct_peer', 'Bureau de crédit, copropriétaire de VantageScore', 'Distributeur des scores FICO et concurrent par VantageScore ; avec TransUnion et Experian, 51 % du chiffre d’affaires de FICO sur l’exercice 2025.'],
    ['TRU', 'upstream', 'Fournisseur de données de crédit et distributeur', 'FICO achète aux bureaux de crédit des données et des traitements pour ses offres aux particuliers (coût des ventes, 10-K), et TransUnion calcule et distribue le score FICO. Comme Equifax, il possède VantageScore et en a prolongé le prix de 0,99 $ jusqu’en décembre 2028 : le classement retient ici son rôle de fournisseur.']] },
  { name: 'Aval — prêteurs immobiliers', order: 1, transmission: 'Les prêteurs immobiliers achètent un score à chaque dossier. Leur volume fait celui des scores de crédit immobilier, la ligne qui a porté la croissance de FICO ; leur choix entre FICO et VantageScore fait désormais son prix.', rows: [
    ['RKT', 'downstream', 'Premier prêteur immobilier américain', 'A désigné VantageScore comme score préféré, selon la presse du 29 septembre : le premier client qui bascule ouvertement.'],
    ['UWMC', 'downstream', 'Prêteur immobilier de gros', 'Volume de crédits immobiliers transmis à Fannie Mae et Freddie Mac, donc de scores achetés.'],
    ['PFSI', 'downstream', 'Prêteur et gestionnaire de crédits immobiliers', 'Sensible au volume de refinancements, qui dépend des taux longs.']] },
  { name: 'Aval — crédit à la consommation', order: 2, transmission: 'Les émetteurs de cartes et les banques achètent des scores pour accorder et surveiller les crédits. Le régulateur du logement ne touche pas à ce marché : c’est la partie du métier que les décisions de septembre laissent intacte.', rows: [
    ['COF', 'downstream', 'Émetteur de cartes de crédit', 'Gros acheteur de scores pour l’octroi et le suivi des cartes ; volume de demandes de crédit.'],
    ['SYF', 'downstream', 'Émetteur de cartes de magasin', 'Octroi de crédit à la consommation à grande échelle, fondé sur les scores.'],
    ['AXP', 'downstream', 'Émetteur de cartes', 'Volume d’ouvertures de comptes et de suivi du risque.'],
    ['JPM', 'downstream', 'Première banque américaine', 'Prêteur immobilier et émetteur de cartes : les deux marchés des scores à la fois.'],
    ['ALLY', 'downstream', 'Prêteur en crédit automobile', 'Le crédit automobile est un autre gros consommateur de scores, hors du champ du régulateur du logement.']] },
  { name: 'Second ordre — logiciels et services aux consommateurs', order: 2, transmission: 'Intuit possède Credit Karma, qui montre aux particuliers des scores VantageScore ; Tyler et Guidewire sont des éditeurs de logiciels rentables que les mêmes fonds détiennent. Ils séparent le risque propre au score du sentiment sur les logiciels.', rows: [
    ['INTU', 'second_order', 'Logiciels financiers, Credit Karma', 'Credit Karma montre au grand public des scores VantageScore ; le segment logiciel de FICO concurrence aussi les outils de décision des banques.'],
    ['TYL', 'second_order', 'Logiciels pour le secteur public', 'Éditeur rentable à revenus récurrents ; contrôle du sentiment sur les logiciels de gestion.'],
    ['GWRE', 'second_order', 'Logiciels pour l’assurance', 'Éditeur rentable corrélé à FICO sans lien commercial : le lien passe par les investisseurs qui détiennent les mêmes logiciels.']] },
  { name: 'Contrôles sectoriels', order: 2, transmission: 'Paniers de référence pour séparer ce qui est propre à FICO de ce qui vient des logiciels ou de l’immobilier résidentiel.', rows: [
    ['IGV', 'sector_proxy', 'Panier des éditeurs de logiciels américains', 'S’il tient pendant que FICO chute, la baisse est propre au score et au régulateur.'],
    ['ITB', 'sector_proxy', 'Panier des constructeurs de logements', 'Mesure l’activité immobilière, donc le volume de crédits et de scores.']] },
];

module.exports = { docs, needles, groups, ACC_10Q, ACC_ER3 };
