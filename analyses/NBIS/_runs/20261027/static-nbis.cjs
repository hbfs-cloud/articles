'use strict';
// Éléments statiques du dossier Nebius Group (NBIS) du 27 octobre 2026 : dépôts primaires ouverts et hachés,
// extraits textuels exigés, groupes économiques du rayon de propagation. Lu par build-nbis.cjs.
// Émetteur privé étranger néerlandais : rapport annuel 20-F et rapports 6-K (pas de 10-K/10-Q). Les états financiers
// sont établis en US GAAP (et non en IFRS, comme l'écrivait à tort la fiche du 25 septembre) ; les données XBRL
// officielles de la SEC (companyfacts) ne portent que le 20-F, les 6-K intermédiaires n'y figurent pas.
const ACC_6K = '0001104659-26-094844', ACC_20F = '0001104659-26-052948';
const Z = '​';

const docs = [
  ['2026-08-12', '6-K / états financiers', ACC_6K, 'nbis-20260812xex99d2.htm', 'q2-6k-fs__nbis-20260812xex99d2.htm',
    'États financiers condensés non audités (US GAAP) des trois et six mois clos le 30 juin 2026 : revenus du semestre de 981,3 M$ (156,0 M$ un an plus tôt), perte opérationnelle de 303,9 M$, amortissements de 471,7 M$, bénéfice des activités poursuivies de 430,8 M$ porté par 780,6 M$ de réévaluation de participations. Au 30 juin : trésorerie de 8 042,1 M$, obligations convertibles de 8 499,0 M$ en valeur comptable (10 041,8 M$ remboursables), carnet de commandes (RPO) de 37 490,6 M$, 271 855 218 actions A et B, bons préfinancés Nvidia sur 21 065 936 actions A. Trois clients non nommés font 24, 21 et 14 % des revenus du trimestre.'],
  ['2026-08-12', '6-K / lettre aux actionnaires', '0001104659-26-094568', 'tm2622968d1_ex99-2.htm', 'q2-letter__tm2622968d1_ex99-2.htm',
    'Lettre du deuxième trimestre 2026 : revenus de 582,3 M$ (+454 %), cloud IA 574,9 M$, revenu annualisé de 3,0 Md$ fin juin, EBITDA ajusté du groupe de 236,2 M$, investissements d’environ 5,7 Md$ au trimestre. Prévision annuelle réaffirmée ; plus de 9 Md$ de prépaiements clients attendus en 2026 ; puissance sous contrat visée à 5 GW fin 2026. Programme d’actions au fil de l’eau : 12,7 millions d’actions vendues à 223,6 $ en moyenne jusqu’au 30 juin, 12,3 millions encore disponibles.'],
  ['2026-08-12', '6-K / revue financière', ACC_6K, 'nbis-20260812xex99d1.htm', 'q2-6k-pr__nbis-20260812xex99d1.htm',
    'Revue opérationnelle et financière du semestre clos le 30 juin 2026 : flux de trésorerie d’exploitation de 4 504,1 M$, portés par les avances des clients (revenus différés en hausse de 4 395,0 M$) et non par le résultat ; ces encaissements financent une partie des investissements en processeurs graphiques.'],
  ['2026-04-30', '20-F', ACC_20F, 'nbis-20251231x20f.htm', 'fy25-20f__nbis-20251231x20f.htm',
    'Rapport annuel de l’exercice 2025, en US GAAP : revenus de 529,8 M$, perte opérationnelle de 611,7 M$, amortissements de 417,9 M$, trésorerie de 3 678,1 M$. Obligations convertibles de juin 2025 (1,0 Md$, conversion à 51,45 $) et de septembre 2025 (3 162,5 M$ en deux tranches égales à 1,00 % échéance 2030 et 2,75 % échéance 2032, option de 412,5 M$ exercée, principal porté à 115 % à l’échéance, conversion à 138,75 $). Deux faiblesses importantes du contrôle interne de l’information financière déclarées. Activités russes cédées en 2024, cotation reprise le 21 octobre 2024.'],
  ['2026-08-20', '6-K / communiqué', '0001104659-26-098924', 'tm2623617d1_ex99-1.htm', 'aug26-6k-cv-pricing__tm2623617d1_ex99-1.htm',
    'Fixation des conditions des obligations convertibles d’août 2026 : 0,50 % échéance 2030, conversion à 313,46 $, principal porté à 110 % à l’échéance ; 4,50 % échéance 2034, conversion à 324,65 $, principal porté à 125 %. Prix de conversion effectifs à l’échéance de 344,81 $ et 405,82 $, contre un cours de 223,90 $ le 19 août.'],
  ['2026-08-24', '6-K / communiqué', '0001104659-26-100347', 'tm2623863d1_ex99-1.htm', 'aug26-6k-cv-closing__tm2623863d1_ex99-1.htm',
    'Clôture de l’émission : 5,75 Md$ de principal d’origine (3,45 Md$ échéance 2030, 2,3 Md$ échéance 2034), options des banques exercées en totalité. En parallèle, 400 M$ d’obligations 2029 et 400 M$ d’obligations 2031 échangés contre environ 15,8 millions d’actions A, que les porteurs peuvent revendre sur le marché.'],
  ['2026-10-22', '6-K', '0001104659-26-117978', 'tm2628078d1_6k.htm', 'oct26-6k-citi__tm2628078d1_6k.htm',
    'Contrat de crédit relais signé le 17 octobre 2026 avec Citibank : prêt à terme garanti de 3,5 Md$, marge de 2,75 % au-dessus du SOFR à terme, relevée de 0,25 point tous les quatre-vingt-dix jours jusqu’à 3,50 %, échéance le 16 octobre 2027, sûretés sur l’essentiel des actifs des emprunteurs et sur les titres des filiales emprunteuses, clause de liquidité minimale.'],
  ['2026-10-22', '6-K / communiqué', '0001104659-26-117978', 'tm2628078d1_ex99-1.htm', 'oct26-6k-citi-pr__tm2628078d1_ex99-1.htm',
    'Communiqué de la ligne Citi : échéance de 364 jours, produits affectés aux centres de données et aux achats de processeurs graphiques ; la société cite plus de 40 Md$ d’engagements de long terme de clients notés en catégorie investissement comme base de financements adossés futurs.'],
  ['2026-07-17', '6-K / communiqué', '0001104659-26-084452', 'tm2620683d1_ex99-1.htm', 'jul26-6k-abf-pr__tm2620683d1_ex99-1.htm',
    'Premier financement garanti : environ 775 M$ à SOFR + 2,50 %, adossés à des processeurs déjà déployés et aux flux d’un contrat avec un client noté en catégorie investissement. La société nomme Microsoft et Meta parmi les clients des plus de 40 Md$ de revenus contractés.'],
  ['2026-03-16', '6-K / communiqué', '0001104659-26-027886', 'tm268879d1_ex99-1.htm', 'mar26-6k-meta__tm268879d1_ex99-1.htm',
    'Nouvel accord de cinq ans avec Meta : 12 Md$ de capacité dédiée, sur l’une des premières grandes installations Nvidia Vera Rubin, livrée à partir de début 2027, et engagement de Meta d’acheter jusqu’à 15 Md$ de capacité supplémentaire, que Nebius compte d’abord vendre à d’autres clients ; valeur totale jusqu’à environ 27 Md$.'],
  ['2025-09-08', '6-K', '0001104659-25-088312', 'tm2525580d1_6k.htm', 'sep25-6k-msft__tm2525580d1_6k.htm',
    'Accord commercial avec Microsoft : capacité de calcul dédiée dans le centre de données de Vineland (New Jersey) sur cinq ans, valeur d’environ 17,4 Md$ jusqu’en 2031, portée à environ 19,4 Md$ si Microsoft prend des services supplémentaires ; Microsoft peut résilier une tranche livrée en retard, après un délai de grâce.'],
  ['2025-11-12', '424B5', '0001104659-25-110025', 'tm2530771-1_424b5.htm', 'nov25-424b5-atm__tm2530771-1_424b5.htm',
    'Prospectus complémentaire du programme d’émission d’actions au fil de l’eau : au plus 25 000 000 d’actions ordinaires de catégorie A, vendues par Goldman Sachs, Morgan Stanley et d’autres agents, à la main de la société, sous l’enregistrement automatique F-3ASR du 2 mai 2025.'],
  ['2026-08-26', '6-K / communiqué', '0001104659-26-101076', 'tm2624077d1_ex99-1.htm', 'aug26-6k-agm__tm2624077d1_ex99-1.htm',
    'Assemblée du 25 août 2026 : toutes les résolutions adoptées, dont l’autorisation donnée au conseil d’émettre jusqu’à 20 % du capital en actions A pendant cinq ans, sans droit préférentiel des actionnaires, et celle de racheter jusqu’à 20 % du capital pendant dix-huit mois. 238 402 543 actions A et 33 455 053 actions B à dix voix.'],
  ['2026-05-13', '6-K / lettre aux actionnaires', '0001104659-26-059872', 'tm2614392d1_ex99-2.htm', 'q1-letter__tm2614392d1_ex99-2.htm',
    'Lettre du premier trimestre 2026 : prévision annuelle de 3,0 à 3,4 Md$ de revenus en 2026 et de 7 à 9 Md$ de revenu annualisé en fin d’année, marge d’EBITDA ajusté visée d’environ 40 % ; puissance sous contrat portée à plus de 4 GW.'],
  ['2026-09-08', '6-K / communiqué', '0001104659-26-105749', 'tm2624958d1_ex99-1.htm', 'sep26-6k-pltr__tm2624958d1_ex99-1.htm',
    'Partenariat avec Palantir, qui désigne Nebius comme son partenaire privilégié d’infrastructure d’IA souveraine et ouvrira, après intégration, la capacité de calcul et d’inférence de Nebius à ses clients commerciaux éligibles.'],
];

const needles = {
  rev: [0, ['Revenues', '981.3', '156.0']],
  ebit: [0, ['Loss from operations', '(303.9)', '(231.5)']],
  da: [0, ['Depreciation and amortization', '471.7', '124.3']],
  ni: [0, ['Net income / (loss) from continuing operations', '430.8', '398.2']],
  bal: [0, ['8,042.1', 'Debt, current', '46.7', 'Debt, non-current', '8,499.0', 'Total convertible debt', '10,041.8']],
  shares: [0, ['Balance as of June 30, 2026 271,855,218', 'Pre-Funded Warrants to purchase 21,065,936 Class A ordinary shares']],
  rpo: [0, ['the amount of unsatisfied RPO was $37,490.6, of which 36% is expected to be recognized as revenue during the 24 months ending June 30, 2028']],
  reval: [0, ['Gain from revaluation of investment in equity securities', '780.6']],
  marchConv: [0, ['approximately $183.22 per share', 'approximately $180.31 per s']],
  customers: [0, ['Customer C ' + Z + ' * ' + Z + ' 24%', 'Customer D ' + Z + ' * ' + Z + ' 21%', 'Customer E ' + Z + ' * ' + Z + ' 14%']],
  depreciation: [0, ['reduction in depreciation expense of $86.1', 'reduction in depreciation expense of $43.0']],
  interest: [0, ['(4.8) ' + Z + ' (119.1)', 'Interest expense for the three and six months ended June 30, 2026 primarily relates to interest and amortization of debt issuance costs and accretion associated with the Group’s convertible notes', 'interest expense recognized on advances received from major customers', '7.06%', '4.15%']],
  gaap: [0, ['prepared in accordance with accounting principles generally accepted in the United States of America']],
  q2: [1, ['Q2 group revenue of $582.3 million, was up 454% year-over-year', 'Nebius AI cloud revenue grew 514% year-over-year to $575 million, ARR reached $3.0 billion', 'Nebius AI cloud revenue was $574.9 million in Q2’26']],
  capex: [1, ['capital expenditures were approximately $5.7 billion']],
  prepay: [1, ['We expect to receive over $9 billion in customer prepayments in 2026', 'covering 50-60% of the associat-ed capex']],
  atm: [1, ['we sold 12.7 million Class A shares at a weighted-average price of $223.6 per share', '12.3 million shares remained available under the program']],
  reaffirm: [1, ['We are reaffirming our full-year 2026 guidance across all metrics']],
  adjEbitda: [1, ['Group adjusted EBITDA of $236.2 million', '$115.9 million of non-recurring expense']],
  power: [1, ['raising our year-end contracted power tar-get again to 5 GW']],
  delivery: [1, ['We have already received our first NVIDIA Vera Rubin NVL72 systems', 'To date, we’ve delivered all capacity tranches to Microsoft', 'second Meta agreement, with capacity on track to come online in early 2027']],
  ocf: [2, ['Net cash provided by operating activities was $4,504.1 million for the six months ended June 30, 2026', 'increase in deferred revenue of $4,395.0 million']],
  annual: [3, ['529.8', '(611.7)', '417.9', '3,678.1', '4,103.2']],
  sepConv: [3, ['initial conversion rate of 7.2072 shares per $1,000 principal amount (approximately $ 138.75 per share)', 'we issued additional convertible notes in an aggregate principal amount of $3,162.5 million, in two equal tranches due 2030 and 2032', 'The 2030 Notes accrete to 115 % of their original principal at maturity', '(approximately $ 51.45 per share)']],
  usgaap: [3, ['Our consolidated financial statements are prepared in accordance with U.S. GAAP']],
  weakness: [3, ['We have identified two material weaknesses in our internal control over financial reporting']],
  divest: [3, ['We divested all our group’s businesses in Russia', 'Trading in our shares resumed on October 21, 2024']],
  augPricing: [4, ['initial conversion price of approximately $313.46 per Class A share', 'initial conversion price of approximately $324.65 per Class A share', 'it reaches 110% of the original principal amount of the 2030 Notes', 'it reaches 125% of the original principal amount of the 2034 Notes', 'approximately $344.81 per Class A share', '$405.82', 'last reported sale price of $223.90 per Class A share']],
  augClosing: [5, ['the total aggregate original principal amount of the Notes is $5.75 billion', 'exchange $400 million aggregate original principal amount of the 2029 Notes and $400 million aggregate original principal amount of the 2031 Notes for an aggregate of approximately 15.8 million of its Class A ordinary shares']],
  citi: [6, ['senior secured term loan facility in an aggregate principal amount of $3.5 billion', 'Term SOFR plus an applicable margin commencing at 2.75% per annum', 'up to 3.50% per annum', 'The maturity date of the Facility Agreement is October 16, 2027', 'minimum liquidity financial covenant']],
  citiPr: [7, ['investment-grade customer commitments of more than $40 billion of long-term contracts', 'The facility has a 364-day maturity']],
  abf: [8, ['senior secured debt facility for approximately $775 million', 'more than $40 billion of additional contracted revenue from investment-grade customers such as Microsoft and Meta', 'SOFR + 2.50%']],
  meta: [9, ['Nebius currently intends to sell this capacity to third-party customers', 'Nebius will provide $12 billion of dedicated capacity', 'up to a total of $15 billion over a five-year period', 'contract value of up to approximately $27 billion', 'starting early 2027']],
  msft: [10, ['the total contract value is about $17.4 billion through 2031', 'about $19.4 billion', 'Vineland, New Jersey']],
  atmProspectus: [11, ['25,000,000', 'at-the-market', 'Class A ordinary shares']],
  agm: [12, ['334,550,530', 'issue Class A Shares up to an additional 20% of the issued share capital', 'repurchase shares in the capital of the Company up to 20% of the issued share capital', '238,402,543', '33,455,053']],
  guidance: [13, ['On track to achieve $3.0B–$3.4B revenue in 2026 and $7B–$9B ARR', 'On track to achieve ~40% Adj. EBITDA margin in 2026']],
  palantir: [14, ['Palantir has named Nebius its preferred sovereign AI infrastructure partner']],
};

const groups = [
  { name: 'Référence — Nvidia, fournisseur et actionnaire', order: 1, transmission: 'Nvidia vend les processeurs que Nebius loue, détient 2,0 Md$ de bons préfinancés sur ses actions et lui réserve ses nouvelles générations. Son cours dit si le marché doute de la demande de calcul ou seulement de ceux qui s’endettent pour l’acheter.', rows: [
    ['NVDA', 'leader', 'Processeurs graphiques et actionnaire de Nebius', 'Fournisseur quasi exclusif du parc de Nebius et détenteur de bons préfinancés sur environ 21 millions d’actions : une baisse de Nvidia toucherait la demande, une baisse des loueurs seuls toucherait leur financement.']] },
  { name: 'Pairs directs — loueurs de calcul cotés', order: 1, transmission: 'CoreWeave et IREN louent la même capacité de calcul aux mêmes laboratoires et aux mêmes géants du numérique, et se financent par la dette et les obligations convertibles. Le marché les traite désormais comme un seul crédit.', rows: [
    ['CRWV', 'direct_peer', 'Premier loueur de calcul coté', 'Même métier et mêmes clients ; c’est le rendement de 15 % sur l’une de ses obligations qui a déclenché la baisse du secteur le 14 octobre.'],
    ['IREN', 'direct_peer', 'Loueur de calcul sous contrat Microsoft', 'Ancien mineur devenu loueur de processeurs graphiques, lui aussi sous contrat pluriannuel avec Microsoft et financé par convertibles : le pair dont le profil de financement ressemble le plus à celui de Nebius.']] },
  { name: 'Aval — clients documentés', order: 1, transmission: 'Microsoft et Meta sont nommés par Nebius parmi les clients de plus de 40 Md$ de revenus contractés. Leurs budgets d’investissement fixent la demande de capacité ; leur signature sert de garantie aux financements adossés.', rows: [
    ['MSFT', 'downstream', 'Client documenté, contrat de cinq ans', 'Contrat de Vineland d’environ 17,4 Md$ jusqu’en 2031, toutes les tranches livrées au 12 août ; le premier prêt garanti est adossé au contrat d’un client noté en catégorie investissement, non nommé.'],
    ['META', 'downstream', 'Client documenté, deux accords', 'Accord de mars 2026 jusqu’à environ 27 Md$, dont 12 Md$ de capacité dédiée livrée à partir de début 2027 et jusqu’à 15 Md$ de capacité que Nebius n’aura pas vendue à d’autres clients.']] },
  { name: 'Amont — serveurs et énergie des centres de données', order: 1, transmission: 'Dell et Supermicro assemblent les serveurs, Vertiv refroidit et alimente les salles, Bloom Energy fournit des piles à combustible que Nebius déploie depuis 2026. Leurs carnets suivent les commandes des loueurs, qui financent leurs achats.', rows: [
    ['DELL', 'upstream', 'Serveurs d’intelligence artificielle', 'Fournisseur de baies de serveurs pour les loueurs de calcul : un loueur qui ralentit ses investissements réduit ses commandes.'],
    ['SMCI', 'upstream', 'Assembleur de serveurs d’intelligence artificielle', 'Autre assembleur exposé aux mêmes clients ; ses marges montrent la pression des prix dans la chaîne.'],
    ['VRT', 'upstream', 'Alimentation et refroidissement', 'Ses équipements accompagnent chaque nouvelle salle ; un report de construction se voit dans ses commandes.'],
    ['BE', 'upstream', 'Piles à combustible, partenaire de Nebius', 'Partenariat annoncé en mai pour une alimentation sur site : l’énergie, et pas seulement les puces, borne la vitesse de mise en service.']] },
  { name: 'Second ordre — hébergeurs reconvertis et cloud concurrent', order: 2, transmission: 'Anciens mineurs de bitcoin devenus hébergeurs de calcul et Oracle, qui loue lui aussi des processeurs graphiques à crédit : ils partagent avec Nebius les mêmes acheteurs d’obligations et la même question sur le coût du capital.', rows: [
    ['APLD', 'second_order', 'Centres de données loués aux loueurs de calcul', 'Construit et loue des salles à des loueurs comme CoreWeave : premier touché si ceux-ci ralentissent.'],
    ['CIFR', 'second_order', 'Mineur reconverti en hébergeur', 'Financement par convertibles et contrats d’hébergement : même sensibilité au crédit, avec un bilan plus petit.'],
    ['WULF', 'second_order', 'Mineur reconverti en hébergeur', 'Hébergeur de calcul financé par la dette ; il réagit au même signal de crédit que les loueurs.'],
    ['CORZ', 'second_order', 'Mineur reconverti, hébergeur de CoreWeave', 'Lié contractuellement à CoreWeave : il relaie vers les hébergeurs toute tension sur le premier loueur.'],
    ['ORCL', 'second_order', 'Cloud concurrent financé par la dette', 'Loue aussi des processeurs graphiques à grande échelle et emprunte massivement pour le faire : un repère du prix que le marché fait payer à ce modèle.']] },
  { name: 'Aval — canal de distribution', order: 2, transmission: 'Palantir a fait de Nebius son partenaire privilégié d’infrastructure d’IA souveraine : un canal vers des entreprises clientes, sans contrat chiffré publié.', rows: [
    ['PLTR', 'downstream', 'Partenaire de distribution d’IA souveraine', 'Ouvrira la capacité de Nebius à ses clients commerciaux après une période d’intégration ; aucun montant publié, l’effet sur les revenus reste à mesurer.']] },
  { name: 'Contrôles sectoriels', order: 2, transmission: 'Paniers de référence pour séparer ce qui vient des semi-conducteurs, des logiciels ou du marché large de ce qui est propre aux loueurs de calcul.', rows: [
    ['SMH', 'sector_proxy', 'Panier des semi-conducteurs', 'S’il tient pendant que Nebius chute, la baisse vient du financement des loueurs, pas de la demande de puces.'],
    ['IGV', 'sector_proxy', 'Panier des éditeurs de logiciels', 'Mesure le sentiment sur les logiciels, où se trouvent une partie des clients de Nebius.'],
    ['QQQ', 'sector_proxy', 'Grandes valeurs du Nasdaq', 'Contrôle large : un mouvement commun avec ce panier n’a rien de propre au titre.']] },
];

module.exports = { docs, needles, groups, ACC_6K, ACC_20F };
