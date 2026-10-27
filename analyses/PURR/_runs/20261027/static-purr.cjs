'use strict';
// Éléments statiques du dossier Hyperliquid Strategies (PURR) du 27 octobre 2026 : dépôts primaires ouverts et hachés,
// extraits textuels exigés, groupes économiques du rayon de propagation. Lu par build-purr.cjs.
const CIK = 2078856;
const ACC_10K = '0001193125-26-370281', ACC_B3 = '0001193125-26-399511', ACC_DEF = '0001193125-26-412569',
  ACC_BB = '0001193125-26-431200', ACC_CHEF1 = '0001193125-26-378589', ACC_CHEF3 = '0001193125-26-391090', ACC_PR = '0001193125-26-369668';

const docs = [
  ['2026-08-27', '10-K', ACC_10K, 'purr-20260630.htm', '10k_20260630.htm',
    'Rapport annuel de l’exercice clos le 30 juin 2026 : 29 275 085 unités HYPE portées à une juste valeur de 1 904,1 M$ (coût 1 363,3 M$), trésorerie de 137,9 M$, passifs de 187,1 M$ dont 183,5 M$ d’impôt différé, aucune dette financière. Résultat net de 305,5 M$ : 500,6 M$ de résultat d’exploitation, porté par 709,9 M$ de plus-value latente sur le HYPE et grevé de 169,2 M$ de perte sur l’engagement d’apport de HYPE, moins 183,5 M$ d’impôt différé. Règle de financement : pas de vente d’actions sous un objectif de multiple d’actif net, ni pendant un programme de rachat actif ; après le 30 juin, rachat de 2,7 millions d’actions pour 17,3 M$ puis émission de 10,7 millions d’actions pour 117,1 M$. 28 658 614 bons de souscription, dont trois tranches de 9 131 600 au conseiller ; titres du conseiller verrouillés jusqu’au premier anniversaire de la fusion au plus tard. 238 millions de HYPE des contributeurs se débloquent chaque mois jusqu’en 2027-2028.', CIK],
  ['2026-09-23', '424B3', ACC_B3, 'd168095d424b3.htm', '424b3_20260923.htm',
    'Prospectus couvrant la revente par Chardan de jusqu’à 160 000 000 actions nouvelles que la société peut lui vendre, en plus des 160 000 000 enregistrées en décembre 2025. Au 8 septembre 2026 : environ 33,2 millions d’unités HYPE, 237 919 288 actions ordinaires, 166 173 préférentielles convertibles en 26 587 647 ordinaires ; 112 952 100 actions vendues via la facilité pour environ 1,1 Md$, environ 1,4 Md$ de capacité restante. Le solde de HYPE est publié chaque semaine sur le site de la société, avec une semaine de décalage.', CIK],
  ['2026-10-02', 'DEF 14A', ACC_DEF, 'd290166ddef14a.htm', 'def14a_20261002.htm',
    'Circulaire définitive de l’assemblée virtuelle du mercredi 4 novembre 2026, à 14 h à New York selon l’avis de convocation (13 h selon la rubrique de questions) : 278 271 288 actions ordinaires en circulation à la date d’enregistrement du 30 septembre 2026. La proposition n° 2 autoriserait l’émission d’actions à Chardan au-delà du plafond de 42 641 847 actions (19,99 %) applicable aux ventes sous 12,02 $, au-delà du premier milliard de dollars vendu. Les 27 394 800 bons du conseiller s’exercent à 9,375 $, 12,50 $ et 18,75 $ pendant cinq ans.', CIK],
  ['2026-10-26', '8-K', ACC_BB, 'purr-20261023.htm', '8k_20261026.htm',
    'Rapport du 23 octobre 2026 : le conseil porte le programme de rachat d’actions de 30 à 100 M$ et le prolonge jusqu’au 31 octobre 2027 ; il restait environ 2 M$ sur l’autorisation de décembre 2025, d’où environ 72 M$ disponibles. Aucune garantie sur le nombre d’actions rachetées.', CIK],
  ['2026-10-26', '8-K / Exhibit 99.1', ACC_BB, 'purr-ex99_1.htm', 'ex99_1_20261026.htm',
    'Communiqué du 23 octobre 2026 : rachat d’actions relevé à 100 M$, dont environ 72 M$ disponibles, échéance repoussée du 5 décembre 2026 au 31 octobre 2027 ; rachats en bourse ou de gré à gré, au gré de la direction.', CIK],
  ['2026-09-01', '8-K', ACC_CHEF1, 'purr-20260901.htm', '8k_20260901.htm',
    'Amendement n° 1 de l’accord d’émission d’actions au fil de l’eau (ChEF) avec Chardan : engagement porté de 1,0 à 2,5 Md$ ; au-delà du premier milliard, plafond de 42 641 847 actions (19,99 %) pour les ventes à moins de 12,02 $ tant que les actionnaires n’ont pas approuvé son dépassement.', CIK],
  ['2026-09-15', '8-K', ACC_CHEF3, 'purr-20260914.htm', '8k_20260915.htm',
    'Amendement n° 3 de l’accord ChEF : après les 160 000 000 premières actions vendues, prix de vente à 98,5 % du cours moyen pondéré en séance et 97,0 % hors séance ; il remplace l’amendement n° 2 signé le même jour.', CIK],
  ['2026-08-27', '8-K / Exhibit 99.1', ACC_PR, 'purr-ex99_1.htm', 'ex99_1_20260827.htm',
    'Communiqué des résultats annuels : 647 M$ levés via la facilité sur l’exercice, trésorerie en HYPE portée de 12,5 à 29,3 millions d’unités, 149,9 M$ de liquidités et équivalents, aucune dette ; la quasi-totalité des jetons est mise en staking.', CIK],
];

const needles = {
  nav: [0, ['29,275,085', '1,904,052', '1,363,333', '137,917', '187,137', '183,475']],
  income: [0, ['9,460', '305,542', '709,875', '13,951']],
  capital0630: [0, ['200,550,458', '166,173', '26,587,647', '27,394,800']],
  warrants: [0, ['28,658,614', '9,131,600', '1,237,334']],
  buyback0630: [0, ['3,067,097', '10.5 million']],
  staking: [0, ['approximate net annualized staking reward rate of 2.19%']],
  rule: [0, ['Equity sales generally require an mNAV above an established target ratio', 'The Company will not conduct equity sales while an active share repurchase program is in effect', 'when its shares trade at a meaningful discount to mNAV']],
  subsequent: [0, ['deployed $ 17.3 million to repurchase approximately 2.7 million shares', 'raised $ 117.1 million through the issuance of approximately 10.7 million shares']],
  incomeSplit: [0, ['Net operating income (loss) 500,623', 'Loss on HYPE contribution commitment ( 169,156 )', 'IPR&D write-off from Sonnet acquisition ( 35,605 )', 'Deferred income tax 183,475']],
  lockup: [0, ['7,761,860 shares', 'first anniversary of the Closing Date', '150% of the price (or deemed price) for which the Advisor acquired such securities']],
  unlocks: [0, ['238 million HYPE tokens', 'monthly vesting commencing November 2025, continuing through 2027-2028', 'circulating supply of approximately 235.0 million tokens']],
  sonnetWarrants: [0, ['1,263,814', '26,480']],
  usdc: [0, ['A significant portion of Hyperliquid’s total value locked, open interest, and daily trading activity is denominated in USDC']],
  assistance: [0, ['Currently, 99% of all fees generated by the protocol are allocated to the Assistance Fund', '46.7 million HYPE tokens have been acquired by the Assistance Fund']],
  registration: [1, ['Up to 160,000,000 shares of Common Stock that we may elect', 'in addition to the 160,000,000 shares of Common Stock previously registered and sold']],
  holdings0908: [1, ['As of September 8, 2026, the Company holds approximately 33.2 million HYPE Tokens', '237,919,288', 'updated weekly with a one-week data delay']],
  facility0908: [1, ['112,952,100', '1.1 billion', '1.4 billion', '97.5%']],
  merger: [1, ['approximately $299.9 million in cash proceeds from the Closing PIPE', 'On March 31, 2026, we entered into an asset purchase agreement']],
  closing: [2, ['closing on December 2, 2025']],
  pref0908: [1, ['166,173 shares of the Company Series A preferred stock', '26,587,647']],
  shares0930: [2, ['As of the Record Date, we had 278,271,288 issued and outstanding shares of Common Stock']],
  meeting: [2, ['Wednesday, November 4, 2026, at 2:00 p.m. Eastern time', 'September 30, 2026', 'November 4, 2026, at 1:00 p.m., Eastern time']],
  cap: [2, ['42,641,847', '$12.02', 'remove the Exchange Cap']],
  advisorWarrants: [2, ['27,394,800 Advisor Warrants', '$9.375']],
  buyback: [3, ['from $30 million to up to $100 million', 'approximately $2 million remaining', 'approximately $72 million available', 'October 31, 2027']],
  buybackPr: [4, ['approximately $72 million remains available', 'from December 5, 2026 to October 31, 2027']],
  chef1: [5, ['from $1.0 billion to $2.5 billion', '42,641,847']],
  chef3: [6, ['following the sale of the first 160,000,000 shares', '98.5%', '97.0%']],
  pr0827: [7, ['$647 million', '29.3 million HYPE tokens', '$149.9 million', 'Unit validator']],
};

const groups = [
  { name: 'Leaders — trésorerie de référence et bourse cotée', order: 1, transmission: 'Strategy est le modèle de toutes les trésoreries d’actifs numériques : son multiple d’actif net donne le ton pour la catégorie. Coinbase, première bourse crypto cotée aux États-Unis, mesure l’appétit des investisseurs pour tout ce qui touche aux jetons.', rows: [
    ['MSTR', 'leader', 'Première trésorerie cotée, en bitcoin', 'Sa prime ou sa décote sur le bitcoin détenu sert d’étalon à toutes les trésoreries cotées, PURR compris ; quand elle se comprime, la catégorie entière se dévalorise.'],
    ['COIN', 'leader', 'Première bourse crypto cotée aux États-Unis', 'Ses volumes et son cours disent si les investisseurs reviennent vers les actifs numériques ; c’est aussi un concurrent d’Hyperliquid sur les contrats perpétuels.']] },
  { name: 'Pairs directs — trésoreries d’actifs numériques', order: 1, transmission: 'Même mécanique que PURR : émettre des actions pour acheter un jeton, puis vivre de l’écart entre le cours et la valeur du jeton détenu. Hyperion DeFi détient le même jeton ; les autres appliquent la recette à l’ether, au solana ou au bitcoin.', rows: [
    ['HYPD', 'direct_peer', 'Autre trésorerie cotée en HYPE', 'Seule autre société cotée dont l’actif principal est le HYPE : elle subit le même prix du jeton et la même défiance envers le modèle, à une taille bien plus petite.'],
    ['BMNR', 'direct_peer', 'Trésorerie cotée en ether', 'Plus grande trésorerie en ether : sa décote ou sa prime sur l’actif net est le meilleur miroir de celle de PURR sur un autre jeton.'],
    ['SBET', 'direct_peer', 'Trésorerie cotée en ether', 'Deuxième trésorerie en ether, financée elle aussi par émission continue d’actions ; même sensibilité au multiple d’actif net.'],
    ['FWDI', 'direct_peer', 'Trésorerie cotée en solana', 'Trésorerie construite sur un jeton de plateforme concurrente ; elle isole l’effet propre au modèle de celui propre au HYPE.'],
    ['ASST', 'direct_peer', 'Trésorerie cotée en bitcoin', 'Trésorerie en bitcoin plus récente ; elle montre comment le marché paie les nouveaux venus du modèle quand les jetons baissent.']] },
  { name: 'Amont — actifs sous-jacents et collatéral', order: 1, transmission: 'Le bitcoin et l’ether mènent tout le marché des jetons, HYPE compris. L’USDC de Circle sert de collatéral à une part importante de l’activité d’Hyperliquid, selon le 10-K : son volume suit l’activité du protocole.', rows: [
    ['IBIT', 'upstream', 'Fonds coté adossé au bitcoin', 'Exposition pure au bitcoin, qui mène le marché des jetons : sépare le mouvement de l’actif de celui propre aux trésoreries.'],
    ['FETH', 'upstream', 'Fonds coté adossé à l’ether (Fidelity)', 'Exposition pure à l’ether, deuxième actif du marché : référence pour les jetons de plateforme comme le HYPE.'],
    ['CRCL', 'upstream', 'Émetteur de l’USDC, collatéral d’Hyperliquid', 'Une part importante des dépôts, des positions ouvertes et des échanges d’Hyperliquid est libellée en USDC (10-K) : l’activité du protocole passe par la monnaie de Circle.']] },
  { name: 'Second ordre — plateformes concurrentes du protocole', order: 2, transmission: 'La valeur du HYPE vient des frais d’Hyperliquid, qui servent à racheter le jeton. Les bourses centralisées cotées se disputent les mêmes volumes de dérivés ; leurs cours disent si l’activité de négociation tient.', rows: [
    ['HOOD', 'second_order', 'Courtier grand public et bourse crypto', 'Concurrent pour les volumes de négociation des particuliers sur les jetons et les contrats perpétuels.'],
    ['BLSH', 'second_order', 'Bourse crypto institutionnelle', 'Plateforme cotée de négociation au comptant et de dérivés ; même cycle de volumes que celui qui alimente les rachats de HYPE.'],
    ['GEMI', 'second_order', 'Bourse crypto cotée', 'Petite bourse cotée très sensible aux volumes ; elle amplifie le cycle d’activité du marché des jetons.']] },
  { name: 'Second ordre — mineurs de bitcoin', order: 2, transmission: 'Les mineurs portent le bêta du bitcoin avec un métier d’exploitation : ils séparent la sensibilité au prix des jetons de la défiance propre aux trésoreries.', rows: [
    ['MARA', 'second_order', 'Mineur de bitcoin, grande capitalisation', 'Bêta opérationnel au bitcoin ; il détient aussi du bitcoin au bilan, ce qui le rapproche partiellement du modèle de trésorerie.'],
    ['RIOT', 'second_order', 'Mineur de bitcoin', 'Autre grand mineur coté ; contrôle de la sensibilité au cycle des jetons hors effet de dilution.'],
    ['CLSK', 'second_order', 'Mineur de bitcoin', 'Mineur coté très exposé au prix du bitcoin ; complète la lecture du bêta opérationnel.']] },
  { name: 'Contrôle sectoriel — actions crypto', order: 2, transmission: 'Panier coté des sociétés du secteur : un mouvement commun avec lui n’a rien de propre à PURR, un écart isole ce qui l’est.', rows: [
    ['BITQ', 'sector_proxy', 'Fonds coté des sociétés crypto', 'Référence sectorielle : bourses, mineurs et trésoreries réunis ; sert à séparer le mouvement du secteur de celui du titre.']] },
];

module.exports = { docs, needles, groups, CIK, ACC_10K, ACC_B3, ACC_DEF, ACC_BB };
