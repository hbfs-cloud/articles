'use strict';
// Éléments statiques du dossier Amazon (AMZN) du 27 octobre 2026 : dépôts primaires ouverts et hachés, extraits
// textuels exigés, groupes économiques du rayon de propagation. Lu par build-amzn.cjs.
// Pièces de l'émetteur (CIK 1018724) et prospectus d'Anthropic (CIK 2130357, septième champ du tableau).
const ACC_10Q = '0001018724-26-000026', ACC_ER2 = '0001018724-26-000024';

const docs = [
  ['2026-07-31', '10-Q', ACC_10Q, 'amzn-20260630.htm', '2026-07-31-10-Q-000026-amzn-20260630.htm',
    'Deuxième trimestre 2026 : 10 786 313 572 actions au 22 juillet. Réévaluation de la participation dans Anthropic de 50,5 Md$ au trimestre (62,8 Md$ sur six mois) en autres produits ; au 30 juin, 92,5 Md$ d’actions de préférence sans droit de vote et 97,9 Md$ d’obligations convertibles Anthropic au bilan, dont 92,0 Md$ de plus-value latente en capitaux propres. Impôt du semestre alourdi de 15,9 Md$ par ces réévaluations. 28,7 Md$ investis dans OpenAI au 30 juin, 21,3 Md$ versés ensuite. Carnet de commandes à plus d’un an non encore comptabilisé : 496 Md$. 132,1 Md$ d’obligations, prêt à tirage différé de 17,5 Md$, 6,1 Md$ de rachat d’actions autorisé et inutilisé, rachat de Globalstar en numéraire et en actions.'],
  ['2026-07-30', '8-K / Exhibit 99.1', ACC_ER2, 'amzn-20260630xex991.htm', '2026-07-30-8-K-000024-amzn-20260630xex991.htm',
    'Communiqué du deuxième trimestre : chiffre d’affaires de 200,6 Md$ (+20 %), résultat opérationnel de 27,5 Md$ (+43 %), AWS à 42,2 Md$ (+37 %) et 16,6 Md$ de résultat. Bénéfice net de 62,6 Md$ dont 53,4 Md$ de produits non opérationnels avant impôt, surtout la participation dans Anthropic. Flux de trésorerie libre négatif de 7,6 Md$ sur douze mois. Prévision du troisième trimestre : 197,0 à 202,0 Md$ de chiffre d’affaires, 22,5 à 26,5 Md$ de résultat opérationnel contre 17,4 Md$ un an plus tôt.'],
  ['2026-02-06', '10-K', '0001018724-26-000004', 'amzn-20251231.htm', '2026-02-06-10-K-000004-amzn-20251231.htm',
    'Rapport annuel 2025 : carnet de commandes à plus d’un an non encore comptabilisé de 244 Md$ au 31 décembre 2025, durée moyenne restante de 4,1 ans ; 1 576 000 salariés. Sert de point de comparaison au carnet de 496 Md$ du 30 juin 2026.'],
  ['2026-02-06', 'S-3ASR', '0001104659-26-011240', 'tm262510-1_s3asr.htm', '2026-02-06-S-3ASR-011240-tm262510-1_s3asr.htm',
    'Déclaration d’enregistrement universelle à effet immédiat (émetteur de grande taille) : dette, actions ordinaires et de préférence, bons de souscription, sans plafond chiffré. Capacité mixte, dette et capital ; toutes les émissions tirées depuis février sont des obligations.'],
  ['2026-07-09', '8-K', '0001104659-26-082293', 'tm2619352d4_8k.htm', '2026-07-09-8-K-082293-tm2619352d4_8k.htm',
    'Émission obligataire close le 9 juillet 2026 : huit tranches de 2029 à 2066, 24,923 Md$ de prix d’émission, sous la déclaration S-3 du 6 février. Postérieure au bilan du 30 juin.'],
  ['2026-09-14', '8-K', '0001104659-26-107526', 'tm2624614d5_8k.htm', '2026-09-14-8-K-107526-tm2624614d5_8k.htm',
    'Émission obligataire en livres sterling close le 14 septembre 2026 : quatre tranches de 2029 à 2045, 4,242 Md£ de prix d’émission. Postérieure au bilan du 30 juin.'],
  ['2026-06-10', '8-K', '0001104659-26-072140', 'tm2613616d4_8k.htm', '2026-06-10-8-K-072140-tm2613616d4_8k.htm',
    'Prêt à terme à tirage différé de 17,5 Md$ signé le 8 juin 2026, à trois ans, tirable en une fois jusqu’au 30 septembre 2026 ; aucun tirage au 30 juin selon le 10-Q. Le montant tiré éventuellement depuis n’est pas publié.'],
  ['2026-08-18', '424B3', '0001104659-26-098339', 'tm2617924-6_424b3.htm', '2026-08-18-424B3-098339-tm2617924-6_424b3.htm',
    'Prospectus du rachat de Globalstar : 90,00 $ en numéraire ou 0,3210 action Amazon par action Globalstar, numéraire plafonné à 40 % ; les actions remises représenteraient environ 0,23 % du capital d’Amazon ; clôture attendue en 2027. Seule émission d’actions enregistrée sur l’année, marginale.'],
  ['2025-10-30', '8-K / Exhibit 99.1', '0001018724-25-000121', 'amzn-20250930xex991.htm', '2025-10-30-8-K-000121-amzn-20250930xex991.htm',
    'Communiqué du troisième trimestre 2025 : résultat opérationnel de 17,4 Md$ après deux charges exceptionnelles, 2,5 Md$ pour la transaction avec la FTC et 1,8 Md$ d’indemnités de départ ; 21,7 Md$ sans elles. Base de comparaison du trimestre publié le 29 octobre 2026.'],
  ['2026-04-29', '8-K / Exhibit 99.1', '0001018724-26-000012', 'amzn-20260331xex991.htm', '2026-04-29-8-K-000012-amzn-20260331xex991.htm',
    'Communiqué du premier trimestre 2026 : 16,8 Md$ de gains avant impôt sur Anthropic ; prévision du deuxième trimestre à 194,0–199,0 Md$ de chiffre d’affaires et 20,0–24,0 Md$ de résultat opérationnel, dépassée au trimestre suivant (200,6 Md$ et 27,5 Md$).'],
  ['2026-02-27', '8-K', '0001104659-26-021050', 'tm267374d1_8k.htm', '2026-02-27-8-K-021050-tm267374d1_8k.htm',
    'Engagement d’une filiale d’Amazon d’acheter pour 35,0 Md$ d’actions de préférence de série C d’OpenAI, garanti par Amazon, en plus des 15,0 Md$ investis au premier trimestre : 50,0 Md$ au total, entièrement versés après le 30 juin selon le 10-Q.'],
  ['2026-10-26', 'S-1 (Anthropic)', '0001628280-26-067168', 'anthropicpbc-sx1.htm', '2026-10-26-S-1-067168-anthropicpbc-sx1.htm',
    'Prospectus d’introduction en Bourse d’Anthropic, déposé le 26 octobre 2026, sans fourchette de prix : Anthropic s’est engagée en avril 2026 à dépenser au moins 110,0 Md$ chez Amazon de mai 2026 à avril 2036 ; 6,2 Md$ d’obligations convertibles détenues par Amazon au 30 juin ; conversion plafonnée tant qu’Amazon dépasserait 12 % du capital.', 2130357],
];

const needles = {
  shares: [0, ['10,786,313,572 shares of common stock, par value $0.01 per share, outstanding as of July 22, 2026']],
  upward: [0, ['We recorded upward adjustments of approximately $ 50.5 billion in Q2 2026 and $ 62.8 billion for the six months ended June 30, 2026']],
  anthropicPref: [0, ['the amounts recorded on our consolidated balance sheets for nonvoting preferred stock were approximately $ 14.8 billion and $ 92.5 billion']],
  anthropicNotes: [0, ['the estimated fair value of our convertible notes recorded on our consolidated balance sheets was approximately $ 45.8 billion and $ 97.9 billion']],
  discreteTax: [0, ['which included $ 15.9 billion of net discrete tax expense primarily attributable to the upward adjustments to our investments in Anthropic']],
  openai: [0, ['Subsequent to June 30, 2026, we invested the remaining $ 21.3 billion Commitment Amount']],
  backlog: [0, ['those commitments not yet recognized were approximately $ 496 billion as of June 30, 2026', 'by $ 100.0 billion over 8.0 years', 'by more than $ 100.0 billion over 10.0 years']],
  buyback: [0, ['As of June 30, 2026, we have $ 6.1 billion remaining under the repurchase program', 'There were no repurchases of our common stock during the six months ended June 30, 2025 or 2026']],
  notes: [0, ['As of June 30, 2026, we had $ 132.1 billion of unsecured senior notes outstanding', 'Total face value of long-term debt 68,836 132,995']],
  ddtl: [0, ['we entered into a $ 17.5 billion unsecured delayed draw term loan']],
  globalstar: [0, ['either (i) $ 90.00 in cash or (ii) 0.3210 shares of Amazon common stock']],
  energy: [0, ['resulted in net unrealized gains of $ 551 million in Q2 2026']],
  tariff: [0, ['we received approximately $ 640 million of tariff refunds']],
  capexQ2: [0, ['Cash capital expenditures were $31.4 billion and $53.1 billion during Q2 2025 and Q2 2026']],
  facility: [0, ['reduced the amount available under the facility to $ 15.0 billion']],
  investments: [0, ['convertible debt investments in public and private companies was $229.7 billion']],
  financing: [0, ['We expect to undertake additional financing activities in 2026']],
  leases: [0, ['Present value of lease liabilities 96,320 13,451 109,771']],
  adsQ2: [0, ['Advertising services (4) 15,694 19,809']],
  conversion: [0, ['then-outstanding notes would be converted to nonvoting common stock, subject to our ownership cap', 'We expect to be subject to a customary lock-up period following an IPO', 'gains of approximately $ 3.3 billion and $ 4.5 billion for the six months ended June 30, 2025 and 2026 were recorded']],
  commitments: [0, ['Total commitments $ 42,752 $ 78,084 $ 53,406 $ 46,767 $ 42,219 $ 386,806 $ 650,034', 'Leases not yet commenced 4,018 11,732 9,278 9,483 9,227 93,476 137,214', 'Unconditional purchase obligations (2) 23,452 33,026 9,326 7,961 7,659 48,641 130,065']],
  energyAws: [0, ['primarily impacting our AWS segment']],
  sharesBs: [0, ['100,000 shares authorized; 11,246 and 11,298 shares issued; 10,731 and 10,783 shares outstanding']],
  ftc: [0, ['Federal Trade Commission have filed cases in the U.S., Canada, and the United Kingdom']],
  awards: [1, ['Common shares and stock-based awards outstanding 10,876 10,952 10,955 10,953 10,949 11,027', 'its fastest growth in 18 quarters', 'growing 36.7% year-over-year in Q2', '$ 147,299 $ 169,007']],
  q2sales: [1, ['Net sales increased 20% to $200.6 billion in the second quarter', 'Net income increased to $62.6 billion in the second quarter, or $5.75 per diluted share']],
  q2oi: [1, ['Operating income increased to $27.5 billion in the second quarter, compared with $19.2 billion in second quarter 2025', 'North America segment operating income was $9.1 billion', 'International segment operating income was $1.7 billion']],
  q2nonop: [1, ['Second quarter 2026 net income includes non-operating pre-tax other income of $53.4 billion, primarily from our investments in Anthropic']],
  aws: [1, ['AWS segment sales increased 37% year-over-year to $42.2 billion', 'AWS segment operating income was $16.6 billion, compared with $10.2 billion in second quarter 2025']],
  fcf: [1, ['Free cash flow decreased to an outflow of $7.6 billion for the trailing twelve months']],
  guidance: [1, ['Net sales are expected to be between $197.0 billion and $202.0 billion', 'Operating income is expected to be between $22.5 billion and $26.5 billion, compared with $17.4 billion in third quarter 2025', 'Excluding the impact of Prime Day in both 2025 and 2026, third quarter 2026 year-over-year growth would be nearly 400 basis points higher']],
  ads: [1, ['Advertising had another strong quarter with 26% year-over-year growth']],
  backlog25: [2, ['those commitments not yet recognized were approximately $ 244 billion as of December 31, 2025']],
  employees: [2, ['we employed approximately 1,576,000 full-time and part-time employees']],
  shelf: [3, ['DEBT SECURITIES COMMON STOCK PREFERRED STOCK WARRANTS DEPOSITARY SHARES PURCHASE CONTRACTS UNITS']],
  julyNotes: [4, ['The aggregate public offering price of the Notes was $24.923 billion', 'registration statement on Form S-3 filed on February 6, 2026']],
  sterling: [5, ['The aggregate public offering price of the Notes was £4.242 billion']],
  ddtl8k: [6, ['$17.5 billion senior unsecured delayed draw term loan credit facility', 'Commitments to provide the DDTL Facility will expire on September 30, 2026']],
  globalstarDilution: [7, ['assuming the maximum permitted cash consideration election', 'collectively represent approximately 0.23% of the outstanding shares of Amazon common stock', 'currently expect the mergers to be completed in 2027']],
  q3base: [8, ['$2.5 billion related to a legal settlement with the Federal Trade Commission and $1.8 billion in estimated severance costs', 'Without these charges, operating income would have been $21.7 billion', 'Third quarter 2025 net income includes pre-tax gains of $9.5 billion included in non-operating income (expense) from our investments in Anthropic']],
  q2guide: [9, ['Operating income is expected to be between $20.0 billion and $24.0 billion', 'Net sales are expected to be between $194.0 billion and $199.0 billion', 'First quarter 2026 net income includes pre-tax gains of $16.8 billion included in non-operating income from our investments in Anthropic']],
  openaiCommit: [10, ['with an aggregate purchase price of $35.0 billion']],
  s1: [11, ['As filed with the Securities and Exchange Commission on October 26, 2026', 'we committed to spend an aggregate of at least $110.0 billion between May 2026 and April 2036', 'our total indebtedness was $6.2 billion', 'Amazon would hold more than 12% of our capitalization']],
};

const groups = [
  { name: 'Leaders du cloud — Microsoft, Alphabet, Oracle', order: 1, transmission: 'AWS fait l’essentiel du résultat d’Amazon. Azure, Google Cloud et Oracle vendent la même capacité de calcul aux mêmes clients ; leurs résultats, publiés la veille ou quelques semaines avant, fixent ce que le marché attend d’AWS. Alphabet détient aussi une participation dans Anthropic.', rows: [
    ['MSFT', 'leader', 'Cloud Azure, premier concurrent d’AWS', 'Azure et AWS se disputent les mêmes budgets informatiques ; la croissance d’Azure publiée la veille sert d’étalon à celle d’AWS.'],
    ['GOOGL', 'leader', 'Google Cloud, actionnaire et fournisseur d’Anthropic', 'Concurrent d’AWS dans le cloud et co-investisseur d’Anthropic : son cours réagit aux mêmes nouvelles sur l’IA et sur la valeur d’Anthropic.'],
    ['ORCL', 'leader', 'Infrastructure cloud Oracle pour l’IA', 'Vend de la capacité de calcul aux laboratoires d’IA, financée par la dette comme celle d’Amazon : il dit combien le marché accepte de payer cette course.']] },
  { name: 'Pairs directs — commerce en ligne et distribution', order: 1, transmission: 'Walmart, Costco, eBay, MercadoLibre et Shopify vendent aux mêmes consommateurs ou aux mêmes commerçants que la place de marché d’Amazon. Leurs ventes disent l’état de la consommation ; en Bourse, leur lien avec Amazon est presque nul depuis février.', rows: [
    ['WMT', 'direct_peer', 'Premier distributeur américain, concurrent du commerce d’Amazon', 'Concurrent frontal sur l’épicerie, la livraison et la publicité en magasin ; ses chiffres de consommation se lisent sur le segment Amérique du Nord d’Amazon.'],
    ['COST', 'direct_peer', 'Distributeur par abonnement, concurrent de Prime', 'Même modèle d’abonnement payant que Prime ; ses ventes mensuelles mesurent la dépense des ménages aisés.'],
    ['EBAY', 'direct_peer', 'Place de marché en ligne', 'Concurrent de la place de marché d’Amazon auprès des vendeurs tiers ; lit le volume du commerce en ligne américain.'],
    ['MELI', 'direct_peer', 'Commerce en ligne et paiements en Amérique latine', 'Concurrent d’Amazon au Brésil et au Mexique, deux marchés où le segment international d’Amazon investit.'],
    ['SHOP', 'direct_peer', 'Logiciel de boutique en ligne pour commerçants', 'Alternative aux services d’Amazon pour les commerçants indépendants : logistique, paiement, vente multicanal.']] },
  { name: 'Amont — puces, réseau et énergie des centres de données', order: 1, transmission: 'Les dépenses d’équipement d’Amazon, 173,0 Md$ sur douze mois, sont le chiffre d’affaires de ces fournisseurs. Une prévision d’investissement relevée ou réduite le 29 octobre se transmet à eux dès le lendemain.', rows: [
    ['NVDA', 'upstream', 'Processeurs graphiques des centres de données d’IA', 'AWS achète ses processeurs graphiques tout en poussant ses propres puces Trainium : chaque dollar d’investissement d’Amazon se partage entre les deux.'],
    ['MRVL', 'upstream', 'Puces sur mesure et interconnexions de centres de données', 'Ses ventes de circuits sur mesure et de composants optiques suivent les budgets d’équipement des grands clouds, dont AWS.'],
    ['ANET', 'upstream', 'Commutateurs réseau des centres de données', 'Ses commandes lisent le cycle d’investissement des grands clouds plus qu’Amazon seul ; la corrélation reste faible.'],
    ['VRT', 'upstream', 'Alimentation et refroidissement des centres de données', 'Chaque centre de données d’AWS consomme de l’alimentation électrique et du refroidissement ; ses commandes suivent le rythme des chantiers.']] },
  { name: 'Aval — clients d’AWS et transporteurs', order: 2, transmission: 'Netflix et Snowflake écrivent dans leur rapport annuel qu’ils dépendent d’AWS ; UPS et FedEx transportent une partie des colis d’Amazon, qui livre de plus en plus lui-même. Le lien passe par les volumes, pas par le cours.', rows: [
    ['NFLX', 'downstream', 'Client d’AWS pour une partie de son service', '« Nous dépendons d’Amazon Web Services pour faire fonctionner certains aspects de notre service », écrit Netflix dans son rapport annuel déposé le 23 janvier 2026.'],
    ['SNOW', 'downstream', 'Client et concurrent d’AWS dans les données', 'Selon son rapport annuel du 20 mars 2026, « une large majorité » de son activité tourne sur AWS, qui est aussi l’un de ses principaux concurrents.'],
    ['UPS', 'downstream', 'Transporteur de colis, ancien premier client Amazon', 'Les volumes d’Amazon pèsent sur son réseau ; chaque colis qu’Amazon livre lui-même est un colis que UPS ne transporte pas.'],
    ['FDX', 'downstream', 'Transporteur de colis et de fret', 'Concurrencé par la logistique d’Amazon, qui vend désormais ses services de chaîne d’approvisionnement à d’autres entreprises.']] },
  { name: 'Second ordre — publicité numérique', order: 2, transmission: 'La publicité d’Amazon progresse de 26 % au deuxième trimestre ; Meta et The Trade Desk se disputent les mêmes budgets d’annonceurs. Meta porte aussi le débat sur le coût des investissements d’IA.', rows: [
    ['META', 'second_order', 'Publicité numérique et investissements d’IA', 'Concurrent pour les budgets publicitaires et autre grand investisseur dans l’IA : ses annonces de dépenses font bouger tout le groupe des grandes valeurs technologiques.'],
    ['TTD', 'second_order', 'Achat programmatique de publicité', 'La plateforme publicitaire d’Amazon concurrence directement son offre auprès des annonceurs.']] },
  { name: 'Contrôles sectoriels', order: 2, transmission: 'Paniers de référence pour séparer ce qui est propre à Amazon de ce qui vient des valeurs de consommation ou des grandes valeurs technologiques. Amazon pèse lourd dans les deux : la corrélation est en partie mécanique.', rows: [
    ['XLY', 'sector_proxy', 'Panier américain de la consommation discrétionnaire', 'Amazon en est l’une des plus grosses pondérations : le panier suit Amazon autant qu’Amazon le suit.'],
    ['QQQ', 'sector_proxy', 'Panier des cent premières valeurs du Nasdaq', 'Mesure le sentiment sur les grandes valeurs technologiques, dont Amazon fait partie.']] },
];

module.exports = { docs, needles, groups, ACC_10Q, ACC_ER2 };
