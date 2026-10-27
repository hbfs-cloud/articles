'use strict';
// Éléments statiques du dossier Reddit (RDDT) du 27 octobre 2026 : dépôts primaires ouverts et hachés, extraits
// textuels exigés, groupes économiques du rayon de propagation. Lu par build-rddt.cjs.
const ACC_10Q = '0001713445-26-000100', ACC_Q2 = '0001713445-26-000098', ACC_Q4 = '0001713445-26-000020';

const docs = [
  ['2026-07-31', '10-Q', ACC_10Q, 'rddt-20260630.htm', 'q2-10q__rddt-20260630.htm',
    'Deuxième trimestre 2026 (clos le 30 juin) : 146 103 200 actions Class A et 46 293 310 Class B au 29 juillet ; 1 486,8 M$ de liquidités et 1 299,5 M$ de placements courants, aucune dette tirée, 494,4 M$ disponibles sur la ligne de crédit de 500 M$. Le prix des annonces a monté d’environ 40 % sur un an et le nombre d’impressions de 17 % (35 % et 24 % sur six mois). 1 523 502 actions rachetées pour 239,6 M$ au semestre, 760,4 M$ encore autorisés. Provision intégrale sur les impôts différés américains, dont une reprise « significative » est jugée possible sous douze mois. Action collective en cours sur l’effet de la recherche Google et de ses résumés par IA, plaintes dérivées, amende britannique de 14,5 M£ contestée en appel. La ventilation entre utilisateurs connectés et non connectés ne sera plus publiée à partir du troisième trimestre. 92,1 M$ d’obligations de prestation restantes, surtout des licences de contenu.'],
  ['2026-07-30', '8-K / Exhibit 99.1', ACC_Q2, 'earningspressreleaseq226.htm', 'q2-8k-ex991__earningspressreleaseq226.htm',
    'Communiqué du deuxième trimestre 2026 : revenus de 804,9 M$ (+61 %), dont 762 M$ de publicité (+64 %) ; résultat net de 253 M$ ; flux de trésorerie libre de 261 M$. Utilisateurs quotidiens (DAUq) : 130,3 millions (+18 %), dont 53,2 millions aux États-Unis (+6 %) ; utilisateurs américains connectés : 23,1 millions (+1 %). Revenu par utilisateur américain : 11,85 $ (+51 %). Prévision du troisième trimestre : 860 à 870 M$ de revenus, 385 à 395 M$ d’EBITDA ajusté.'],
  ['2026-07-30', '8-K / Exhibit 99.2', ACC_Q2, 'exhibit992q226.htm', 'q2-8k-ex992__exhibit992q226.htm',
    'Lettre aux actionnaires du deuxième trimestre : « les visites venues de la recherche ont été heurtées pendant le trimestre, et le trafic plus volatil en fin de trimestre » ; utilisateurs connectés +7 %, non connectés +27 % ; 207,0 millions d’actions totalement diluées au 30 juin ; 1,5 million d’actions rachetées au prix moyen de 157,57 $.'],
  ['2026-02-06', '10-K', '0001713445-26-000022', 'rddt-20251231.htm', 'fy25-10k__rddt-20251231.htm',
    'Rapport annuel 2025 : Reddit dépend en partie des moteurs de recherche, Google en tête, pour son trafic ; la quasi-totalité de la valeur contractuelle de ses licences de contenu vient de deux partenaires, non nommés ; hébergement chez Amazon Web Services et Google Cloud ; la Class B porte dix voix par action, et Steve Huffman dispose, par des conventions de vote, d’environ 75 % des droits de vote au 31 décembre 2025.'],
  ['2026-02-05', '8-K / Exhibit 99.2', ACC_Q4, 'exhibit992q425.htm', 'feb05-8k-ex992__exhibit992q425.htm',
    'Lettre aux actionnaires du quatrième trimestre 2025 : la société annonce qu’elle cessera « plus tard cette année » de publier la distinction entre utilisateurs connectés et non connectés, au motif que l’accueil personnalisé des nouveaux venus brouille la frontière entre les deux.'],
  ['2026-02-05', '8-K / Exhibit 99.1', ACC_Q4, 'earningspressreleaseq425.htm', 'feb05-8k-ex991__earningspressreleaseq425.htm',
    'Communiqué du quatrième trimestre 2025 : revenus trimestriels de 725,6 M$ (+70 %), 2 202,5 M$ sur l’exercice ; programme de rachat d’actions de 1,0 Md$ ; prévision du premier trimestre 2026 : 595 à 605 M$ de revenus.'],
  ['2026-04-30', '8-K / Exhibit 99.1', '0001713445-26-000067', 'earningspressreleaseq126.htm', 'q1-8k-ex991__earningspressreleaseq126.htm',
    'Communiqué du premier trimestre 2026 : revenus de 663,4 M$ (+69 %) ; 53,5 millions d’utilisateurs quotidiens américains (+7 %) ; prévision du deuxième trimestre : 715 à 725 M$ de revenus.'],
  ['2025-10-30', '8-K / Exhibit 99.1', '0001713445-25-000225', 'earningspressreleaseq325.htm', 'q325-8k-ex991__earningspressreleaseq325.htm',
    'Communiqué du troisième trimestre 2025 : revenus de 585,0 M$ (+68 %), base de comparaison du trimestre publié le 29 octobre 2026 ; 51,6 millions d’utilisateurs quotidiens américains ; prévision du quatrième trimestre 2025 : 655 à 665 M$.'],
  ['2026-04-06', 'CORRESP', '0001104659-26-040050', 'filename1.htm', 'apr06-corresp__filename1.htm',
    'Réponse de la société au service des entreprises de la SEC sur le 10-K 2025 : le régulateur demandait de chiffrer la hausse des impressions, présentée comme premier moteur de la croissance ; la société s’engage à détailler prix et volumes à partir du 10-Q du premier trimestre 2026.'],
];

const needles = {
  shares: [0, ['146,103,200 shares of Class A common stock', '46,293,310 shares of Class B common stock']],
  cash: [0, ['The aggregate available balance under the Revolving Credit Facility was $494.4 million']],
  buyback: [0, ['we repurchased 1,523,502 shares of our Class A common stock for $239.6 million', 'As of June 30, 2026, $760.4 million remained available for repurchases']],
  priceVolume: [0, ['During the three and six months ended June 30, 2026, the price of ads increased by approximately 40% and 35%', 'ad impressions delivered increased by approximately 17% and 24%']],
  tax: [0, ['We have a full valuation allowance against our United States federal and state deferred tax assets', 'release a significant portion of the valuation allowance']],
  phaseOutQ3: [0, ['beginning in the quarter ended September 30, 2026, we will no longer report logged-in and logged-out DAUq']],
  ico: [0, ['which includes a fine of GBP £ 14.5 million', 'shareholder derivative complaints with similar allegations']],
  rpo: [0, ['the aggregate amount of remaining performance obligations in contracts with an original expected duration exceeding one year was $ 92.1 million', 'consists primarily of long-term content licensing contracts']],
  reserved: [0, ['Remaining shares reserved for future issuances under the 2024 Plan 52,942,957 45,792,210', 'Total shares of common stock reserved 68,943,374 62,351,580']],
  authorized: [0, ['2,000,000,000 shares authorized as of June 30, 2026 and December 31, 2025; 145,841,108 and 139,218,373 share', '140,000,000 shares authorized as of June 30, 2026 and December 31, 2025; 46,480,309 and 51,673,735 shares issued and outstanding']],
  lawsuit: [0, ['concerning the impact of Google Search and its AI Overviews feature on our business']],
  q2: [1, ['Revenue of $805 million grew 61%', 'Diluted EPS of $1.25', 'With 26+ billion posts and comments', 'Revenue: Global $ 804.9 $ 499.6 61 %', 'Ad revenue increased 64% year-over-year to $762 million', 'Net income of $253 million', 'Free Cash Flow 1 was $261 million']],
  users: [1, ['DAUq: U.S. 53.2 50.3 6 %', 'Logged-in DAUq: U.S. 23.1 22.9 1 %', 'ARPU: U.S. $ 11.85 $ 7.87 51 %', 'ARPU: International $ 2.26 $ 1.73 31 %']],
  guideQ3: [1, ['$860 million to $870 million', '$385 million to $395 million']],
  search: [2, ['Search referrals were choppy in the quarter, and traffic was more volatile later in the quarter', 'Logged-in users grew 7% and Logged-out users grew 27% year-over-year']],
  diluted: [2, ['Total fully diluted shares outstanding were 207.0 million as of June 30, 2026', 'at an average price per share of $157.57']],
  google: [3, ['We rely, in part, on internet search engines, such as Google, to generate traffic to our website']],
  licensing: [3, ['substantially all of the contract value associated with our licensing revenue is derived from two of our partners']],
  hosting: [3, ['currently Amazon Web Services and Google Cloud Platform', 'Amazon Web Services outage on October 20, 2025']],
  allowance: [3, ['Valuation allowance ( 779,030 ) ( 572,894 )', 'As of December 31, 2025, we had $ 1.7 billion']],
  votes: [3, ['ten votes', 'Mr. Huffman was entitled to vote shares representing approximately 75% of the voting power']],
  phaseOut: [4, ['we plan to phase out reporting on logged-in and logged-out later this year']],
  q4: [5, ['DAUq: U.S. 52.5 48.0 9 %', 'Revenue: Global $ 725.6 $ 427.7 70 %', 'Announces $1 Billion Share Repurchase Program', 'Revenue in the range of $595 million to $605 million']],
  q1: [6, ['Revenue grew 69% year-over-year to $663 million', 'Revenue: Global $ 663.4 $ 392.4 69 %', 'Revenue in the range of $715 million to $725 million', 'DAUq: U.S. 53.5 50.1 7 %']],
  q3prior: [7, ['Revenue: Global $ 585.0 $ 348.4 68 %', 'Revenue in the range of $655 million to $665 million', 'DAUq: U.S. 51.6 48.2 7 %']],
  sec: [8, ['letter dated March 31, 2026', 'please quantify, discuss, and analyze the increase in impressions in greater detail', 'beginning with its Form 10-Q for the three months ended March 31, 2026']],
};

const groups = [
  { name: 'Leader — publicité sociale', order: 1, transmission: 'Meta fixe le prix de l’attention sur les réseaux sociaux et capte la plus grosse part des budgets publicitaires. Ses chiffres disent si les annonceurs dépensent encore, et son multiple borne ce que le marché accepte de payer pour un réseau social.', rows: [
    ['META', 'leader', 'Premier réseau social publicitaire', 'Chiffre d’affaires +26 % au troisième trimestre, publié le 21 octobre ; selon la presse, le titre a baissé le lendemain sur l’ampleur de ses investissements en IA, pas sur la publicité.']] },
  { name: 'Amont — trafic de recherche et hébergement', order: 1, transmission: 'Google envoie à Reddit une partie de ses visiteurs et réduit cette part en répondant directement aux questions ; Google et Amazon hébergent la plateforme. Ces deux maillons ne vendent pas l’audience de Reddit, ils la conditionnent.', rows: [
    ['GOOGL', 'upstream', 'Moteur de recherche, hébergeur et concurrent', 'Source de trafic citée au 10-K, hébergeur (Google Cloud) et concurrent publicitaire ; ses résumés par IA sont au cœur de l’action collective contre Reddit.'],
    ['AMZN', 'upstream', 'Hébergeur principal (Amazon Web Services)', 'Hébergeur cité au 10-K ; une panne d’AWS a rendu Reddit inaccessible le 20 octobre 2025. Lien d’exploitation réel, corrélation boursière faible.']] },
  { name: 'Pairs directs — réseaux sociaux financés par la publicité', order: 1, transmission: 'Pinterest, Snap et Roblox vendent comme Reddit l’attention d’une audience jeune ou de niche aux annonceurs. Quand le marché craint pour les budgets ou pour l’audience des réseaux de second rang, ils baissent ensemble.', rows: [
    ['PINS', 'direct_peer', 'Réseau social de découverte et d’achat', 'Le pair le plus proche par le modèle : publicité de recherche et d’intention d’achat ; il a baissé avec Reddit le 23 et le 26 octobre.'],
    ['SNAP', 'direct_peer', 'Messagerie et réseau social mobile', 'Réseau social de taille comparable, rentabilité bien plus faible ; repère du bas de la fourchette de valorisation des réseaux sociaux.'],
    ['RBLX', 'direct_peer', 'Plateforme communautaire de jeu', 'Plateforme d’audience jeune monétisée par l’engagement et la publicité ; même débat sur la croissance de l’audience que Reddit.']] },
  { name: 'Aval — chaîne de la publicité programmatique', order: 2, transmission: 'AppLovin, The Trade Desk, Magnite, DoubleVerify et Criteo achètent, vendent ou mesurent des impressions. Leur activité suit le volume de budgets numériques qui alimente aussi les prix des annonces de Reddit.', rows: [
    ['APP', 'downstream', 'Moteur publicitaire mobile piloté par IA', 'Référence de la prime payée pour une plateforme publicitaire en très forte croissance ; même débat sur la durabilité des prix.'],
    ['TTD', 'downstream', 'Plateforme d’achat publicitaire', 'Côté acheteur des budgets numériques ; sa demande signale l’appétit des annonceurs pour l’inventaire hors des deux géants.'],
    ['MGNI', 'downstream', 'Plateforme de vente d’inventaire', 'Monétise l’inventaire des éditeurs ; reflète le prix des impressions sur le web ouvert.'],
    ['DV', 'downstream', 'Mesure et vérification des annonces', 'Vérifie la qualité des impressions ; son volume suit celui de la publicité numérique.'],
    ['CRTO', 'downstream', 'Publicité de performance et reciblage', 'Publicité payée au résultat sur l’inventaire des éditeurs ; sensible au même cycle de dépenses.']] },
  { name: 'Second ordre — sites de contenu dépendants de la recherche', order: 2, transmission: 'Yelp, Tripadvisor et Zillow vivent, comme Reddit, de visiteurs envoyés par les moteurs de recherche vers des avis et des contenus d’utilisateurs. Netflix concurrence pour le temps d’écran. Ils séparent le risque de trafic de la santé des budgets publicitaires.', rows: [
    ['YELP', 'second_order', 'Avis locaux et publicité locale', 'Contenu d’utilisateurs trouvé par la recherche : premier exposé si les réponses générées par IA retiennent les clics.'],
    ['TRIP', 'second_order', 'Avis de voyage et réservations', 'Même dépendance aux visiteurs envoyés par Google, sur des avis d’utilisateurs.'],
    ['ZG', 'second_order', 'Place de marché immobilière en ligne', 'Plateforme grand public monétisée par la publicité et les contacts, elle aussi alimentée par la recherche.'],
    ['NFLX', 'second_order', 'Vidéo à la demande avec formule publicitaire', 'Concurrent pour le temps d’écran ; sa formule financée par la publicité lit la demande des annonceurs vidéo.']] },
  { name: 'Contrôles sectoriels', order: 2, transmission: 'Paniers de référence pour séparer ce qui est propre à Reddit de ce qui vient des services de communication ou des réseaux sociaux en général.', rows: [
    ['XLC', 'sector_proxy', 'Secteur services de communication du S&P', 'Contient Meta et Alphabet ; un mouvement commun n’a rien de propre à Reddit.'],
    ['SOCL', 'sector_proxy', 'Panier de réseaux sociaux', 'Panier ciblé sur les réseaux sociaux, peu échangé ; il montre si le segment entier monte ou baisse.']] },
];

module.exports = { docs, needles, groups, ACC_10Q, ACC_Q2 };
