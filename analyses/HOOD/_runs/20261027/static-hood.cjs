'use strict';
// Éléments statiques du dossier Robinhood Markets (HOOD) du 27 octobre 2026 : dépôts primaires ouverts et hachés,
// extraits textuels exigés, groupes économiques du rayon de propagation. Lu par build-hood.cjs.
// Contrôle EDGAR du 27 octobre 2026 : aucun 8-K depuis celui des résultats du deuxième trimestre (29 juillet). Les données
// mensuelles d'activité (juillet, août) et l'annonce de la date des résultats du troisième trimestre sont des communiqués de la
// société diffusés par GlobeNewswire, pas des dépôts : leur texte est conservé dans analyses/HOOD/_primary/ir/.
const ACC_10Q = '0001783879-26-000114', ACC_ER2 = '0001783879-26-000113', ACC_CONV = '0001783879-26-000077';

const docs = [
  ['2026-07-30', '10-Q', ACC_10Q, 'hood-20260630.htm', 'q2-10q__hood-20260630.htm',
    'Deuxième trimestre 2026 : 790 630 234 actions A et 108 452 039 actions B au 23 juillet ; obligations convertibles de 2,20 Md$ (valeur comptable nette 2,17 Md$), convertibles au plus en 12,6 millions d’actions A ; bons de souscription sur 8,74 millions d’actions A à 26,60 $, échéance 12 février 2031 ; programme de rachat de 1,5 Md$ annoncé le 24 mars, 1 373 M$ encore disponibles au 30 juin. Rothera, coentreprise avec Susquehanna que Robinhood consolide sans la détenir entièrement ni la diriger seule, a racheté 90 % de MIAXdx le 20 janvier 2026. Rémunération en actions : 197 M$ au premier semestre 2026 contre 151 M$ un an plus tôt. Contentieux des contrats événementiels sportifs : Nevada (appel devant la cour du neuvième circuit), Massachusetts, Michigan, Wisconsin, actions collectives en Californie.'],
  ['2026-07-29', '8-K / Exhibit 99.1', ACC_ER2, 'q22026robinhoodexhibit991.htm', 'q2-8k__q22026robinhoodexhibit991.htm',
    'Communiqué du deuxième trimestre 2026 : revenus nets de 1,31 Md$ (+32 %) ; revenus de transaction de 776 M$ dont options 342 M$, contrats événementiels 156 M$ (plus de dix fois plus qu’un an plus tôt), actions 129 M$ et crypto 100 M$ (−38 %) ; revenus d’intérêt nets de 389 M$ (+9 %). Bénéfice net de 573 M$ dont 129 M$ de gains de déconsolidation d’un fonds (0,14 $ sur un bénéfice dilué de 0,62 $). Prévision de charges ajustées 2026 abaissée à 2,675-2,775 Md$. Volumes du trimestre : 956 Md$ d’actions, 774 millions de contrats d’options, 40 Md$ de crypto, 13,6 milliards de contrats événementiels.'],
  ['2026-06-25', '8-K', ACC_CONV, 'hood-20260622.htm', '2026-06-25-8-K-000077-hood-20260622.htm',
    'Émission privée de 2,2 Md$ d’obligations convertibles à 0,00 % échéance 1er octobre 2029 : prix de conversion initial d’environ 174,42 $ par action A (5,7332 actions pour 1 000 $), remboursement du nominal en numéraire et seulement l’excédent en actions ou en numéraire ; options d’achat plafonnées (capped calls) sur environ 12 613 040 actions, d’exercice 174,4227 $ et de plafond 237,8475 $ ; nombre maximal d’actions émises à la conversion : 20 811 560, sous réserve d’ajustement.'],
  ['2026-06-25', '8-K / Exhibit 99.1', ACC_CONV, 'a991projectcatalyst-closin.htm', '2026-06-25-8-K-000077-a991projectcatalyst-closin.htm',
    'Communiqué de clôture de l’émission convertible : produit net d’environ 2,169 Md$, dont environ 290 M$ employés à racheter 2,743 millions d’actions A et 123,2 M$ aux options d’achat plafonnées ; la société n’attend aucune dilution nette de l’opération tant que l’action reste sous 237,85 $, et sous 303,95 $ en tenant compte du rachat simultané.'],
  ['2026-02-18', '10-K', '0001783879-26-000023', 'hood-20251231.htm', 'fy25-10k__hood-20251231.htm',
    'Rapport annuel 2025 : action A à une voix, action B à dix voix, détenue en totalité par les fondateurs et leurs affiliés. Note de concentration : les revenus de transaction versés par les teneurs de marché et les bourses représentent 55 % des revenus nets de 2025 ; Citadel Securities seule en verse 13 %. Facteur de risque : une règle qui toucherait le paiement pour le flux d’ordres (PFOF) aurait un effet démesuré, Robinhood en tirant une part plus grande de ses revenus que ses concurrents.'],
  ['2026-06-16', '8-K', '0001783879-26-000071', 'hood-20260616.htm', '2026-06-16-8-K-000071-hood-20260616.htm',
    'Réduction d’effectifs d’environ 10 % des salariés à temps plein annoncée le 16 juin 2026, « depuis une position de force » selon la société ; charges d’environ 20 M$ en numéraire (indemnités) et 8 M$ de rémunération en actions, comptabilisées au deuxième trimestre 2026.'],
  ['2026-04-28', '8-K / Exhibit 99.1', '0001783879-26-000061', 'q12026robinhoodexhibit991.htm', '2026-04-28-8-K-000061-q12026robinhoodexhibit991.htm',
    'Communiqué du premier trimestre 2026 : revenus de 1,07 Md$ (+15 %), bénéfice dilué de 0,38 $ ; crypto 134 M$ (−47 %), autres revenus de transaction, surtout contrats événementiels, 147 M$ ; prévision de charges ajustées 2026 portée à 2,7-2,825 Md$ avec 100 M$ pour les comptes Trump.'],
  ['2026-02-10', '8-K / Exhibit 99.1', '0001783879-26-000013', 'q42025robinhoodexhibit991.htm', '2026-02-10-8-K-000013-q42025robinhoodexhibit991.htm',
    'Communiqué du quatrième trimestre 2025 : revenus de 1,28 Md$ (+27 %), bénéfice dilué de 0,66 $, crypto 221 M$ (−38 %) ; première prévision de charges ajustées 2026 à 2,6-2,725 Md$.'],
  ['2025-11-05', '8-K / Exhibit 99.1', '0001783879-25-000309', 'q32025robinhoodexhibit991.htm', '2025-11-05-8-K-000309-q32025robinhoodexhibit991.htm',
    'Communiqué du troisième trimestre 2025, base de comparaison du trimestre publié le 27 octobre 2026 : revenus de 1,27 Md$ (+100 %), dont crypto 268 M$ et options 304 M$ ; bénéfice net de 556 M$, bénéfice dilué de 0,61 $.'],
];

const needles = {
  shares: [0, ['Class A and Class B common stock outstanding were 790,630,234 and 108,452,039']],
  convertible: [0, ['the Convertible Notes are potentially convertible into 12.6 million shares of Class A common stock', 'net carrying amount is $ 2.17 billion']],
  warrants: [0, ['strike price of $ 26.60 that can be exercised to purchase 8.74 million shares of Class A common stock', 'The warrants expire on February 12, 2031']],
  buybackProgram: [0, ['authorizing the Company to repurchase up to $ 1.5 billion of its outstanding Class A common stock', 'Total 4,430,374 $ 93.54 1,687,374 $ 1,373']],
  convRepurchase: [0, ['Includes 2,743,000 shares of Class A common stock repurchased on June 25, 2026 at $105.71 per share']],
  miaxdx: [0, ['acquired 90 % of the issued and outstanding equity of MIAXdx on January 20, 2026', 'we do not wholly own or operationally control Rothera, our joint venture with SIG']],
  sbc: [0, ['Share-based compensation 151 197']],
  sportsWisconsin: [0, ['alleging that sports-related event contracts constitute illegal sports betting and are a public nuisance']],
  sportsNevada: [0, ['Robinhood has agreed to cease offering new sports-related event contracts in Nevada as of December 1, 2025']],
  q2Revenue: [1, ['Revenues up 32% year-over-year to a record $1.31 billion', 'Diluted EPS up 48% year-over-year to $0.62']],
  q2Gains: [1, ['Net income included $129 million of gains', 'Diluted EPS included $0.14 of gains']],
  q2Mix: [1, ['event contracts revenue of $156 million, up over 10x', 'cryptocurrencies revenue of $100 million, down 38%', 'Net interest revenues increased 9% year-over-year to $389 million']],
  q2Volumes: [1, ['Equity Notional Trading Volumes increased 85% year-over-year to a record $956 billion', 'Options Contracts Traded increased 50% year-over-year to a record 774 million', 'Crypto Notional Trading Volumes were $40 billion', 'Event Contracts Traded increased over 10x year-over-year to a record 13.6 billion']],
  q2Balance: [1, ['Margin Book increased 127% year-over-year to a record $21.6 billion', 'Funded Customers increased by 1.9 million, or 7%, year-over-year to 28.4 million']],
  q2Outlook: [1, ['lowering and tightening our 2026 outlook for Adjusted Operating Expenses and SBC to a range of $2.675 to $2.775 billion']],
  q2Buyback: [1, ['This includes $290 million repurchased in connection with our June 2026 convertible notes offering and outside of our existing share repurchase authorization']],
  convTerms: [2, ['equivalent to an initial conversion price of approximately $174.42 per share', 'The Capped Calls have initial cap prices of $237.8475 per share', 'approximately 12,613,040 shares', 'issuable upon conversion of the Notes is 20,811,560']],
  convClosing: [3, ['Robinhood anticipates no net dilution from the transaction until its share price exceeds $303.95', 'repurchase 2.743 million shares of its Class A common stock']],
  dualClass: [4, ['Class A common stock has one vote per share, our Class B common stock has 10 votes per share', 'Our founders and Founder Affiliates together hold all of the issued']],
  concentration: [4, ['Market makers: Citadel Securities, LLC 12 % 12 % 13 %', 'Total as percentage of total net revenues 40 % 56 % 55 %']],
  pfof: [4, ['any legal or regulatory change that impacts PFOF could have an outsized impact on our results of operations']],
  rif: [5, ['This reduction in force involves approximately 10% of the Company\'s full-time employees', 'approximately $20 million related to employee severance and benefits costs as well as approximately $8 million related to share-based compensation']],
  q1: [6, ['Revenues up 15% year-over-year to $1.07 billion', 'Diluted EPS up 3% year-over-year to $0.38', 'cryptocurrencies revenue of $134 million, down 47%']],
  q4: [7, ['including a record $1.28 billion in Q4', 'cryptocurrencies revenue of $221 million, down 38%', 'Our outlook for 2026 Adjusted Operating Expenses and SBC is $2.6 billion to $2.725 billion']],
  q3fy25: [8, ['Revenues up 100% year-over-year to a record $1.27 billion', 'Diluted EPS up 259% year-over-year to $0.61', 'cryptocurrencies revenue of $268 million']],
};

const groups = [
  { name: 'Leaders — courtage de détail coté', order: 1, transmission: 'Schwab et Interactive Brokers vivent des mêmes moteurs que Robinhood : soldes des clients placés à taux courts, prêts sur marge, volumes d’actions et d’options. Ils disent si le marché sanctionne le courtage dans son ensemble ou Robinhood seul.', rows: [
    ['SCHW', 'leader', 'Premier courtier de détail américain', 'Référence des revenus d’intérêt sur la trésorerie des clients, que Robinhood rémunère aussi : une baisse des taux courts touche les deux.'],
    ['IBKR', 'leader', 'Courtier électronique des investisseurs actifs', 'Concurrent direct sur les investisseurs actifs, les options et les prêts sur marge ; sa plateforme sert de point de comparaison pour les volumes et les taux servis aux clients.']] },
  { name: 'Pairs directs — trading de détail, crypto et contrats événementiels', order: 1, transmission: 'Même clientèle de particuliers, mêmes produits : crypto, options, contrats sur événements. Coinbase partage avec Robinhood le procès du Wisconsin sur les contrats sportifs ; les autres mesurent l’appétit des particuliers pour le trading.', rows: [
    ['COIN', 'direct_peer', 'Plateforme crypto et contrats événementiels', 'Codéfendeur de Robinhood et Kalshi dans la plainte du Wisconsin ; son volume crypto annonce celui de l’application Robinhood et de Bitstamp.'],
    ['SOFI', 'direct_peer', 'Néobanque et courtage en ligne', 'Même clientèle jeune, même course aux dépôts : SoFi publie le 27 octobre selon une seule source de calendrier, le même jour que Robinhood.'],
    ['ETOR', 'direct_peer', 'Courtier social coté depuis 2025', 'Concurrent international sur le trading d’actions et de crypto par les particuliers.'],
    ['FUTU', 'direct_peer', 'Courtier de détail en Asie', 'Mêmes revenus de commissions et de marge sur une clientèle asiatique ; mesure l’appétit du trading de détail hors des États-Unis.'],
    ['TIGR', 'direct_peer', 'Courtier de détail en Asie', 'Même modèle que Futu, avec une taille et une liquidité bien moindres.']] },
  { name: 'Amont — teneurs de marché et bourses', order: 1, transmission: 'Robinhood touche un paiement des teneurs de marché pour chaque ordre routé et fait exécuter les options sur les bourses : en 2025, les revenus de transaction versés par les teneurs de marché et les bourses ont fait 55 % des revenus nets. Leurs volumes sont les siens ; leurs cours n’en disent pas autant.', rows: [
    ['VIRT', 'upstream', 'Teneur de marché coté', 'Paie le flux d’ordres des courtiers de détail ; la contrepartie dominante, Citadel Securities (13 % des revenus nets de Robinhood en 2025), n’est pas cotée.'],
    ['CBOE', 'upstream', 'Première bourse d’options américaine', 'Les options sont la première ligne de revenus de transaction de Robinhood ; Cboe encaisse les mêmes volumes côté bourse.'],
    ['NDAQ', 'upstream', 'Bourse de cotation et d’options', 'Place de cotation de Robinhood et bourse d’options ; profite des mêmes volumes record.'],
    ['ICE', 'upstream', 'Bourse de New York et chambre de compensation', 'Infrastructure d’exécution et de compensation des actions ; contrôle des volumes de marché.'],
    ['CME', 'upstream', 'Bourse de contrats à terme', 'Robinhood vend des contrats à terme à ses clients ; CME mesure la demande de produits dérivés réglementés par la CFTC.'],
    ['MIAX', 'upstream', 'Bourse vendeuse de MIAXdx', 'A vendu le 20 janvier 2026 90 % de sa bourse de dérivés MIAXdx à Rothera, la coentreprise de Robinhood et Susquehanna, et en garde 10 %.']] },
  { name: 'Second ordre — paris sportifs et paiement', order: 2, transmission: 'Les contrats événementiels sportifs de Robinhood prennent des mises aux opérateurs de paris ; chaque décision de justice qui les classe en paris fait monter DraftKings et Flutter et baisser Robinhood. Block vend aussi des actions et du bitcoin aux particuliers par Cash App.', rows: [
    ['DKNG', 'second_order', 'Opérateur de paris sportifs en ligne', 'Concurrent indirect des contrats sportifs : le 28 août, jour de l’arrêt du neuvième circuit, il a monté pendant que Robinhood baissait.'],
    ['FLUT', 'second_order', 'Maison mère de FanDuel', 'Même lecture que DraftKings : ce que perdent les contrats événementiels sportifs revient aux opérateurs de paris agréés par les États.'],
    ['XYZ', 'second_order', 'Paiement et Cash App', 'Cash App vend des actions et du bitcoin à des particuliers : même portefeuille de clients, autre porte d’entrée.']] },
  { name: 'Second ordre — prix du bitcoin', order: 2, transmission: 'Les revenus crypto de Robinhood suivent le prix et l’activité du bitcoin : 268 M$ au troisième trimestre 2025, 100 M$ au deuxième trimestre 2026. Le fonds indiciel bitcoin sert de baromètre.', rows: [
    ['IBIT', 'second_order', 'Fonds indiciel adossé au bitcoin', 'Le prix du bitcoin fait le volume crypto de l’application et de Bitstamp, donc une ligne de revenus qui a perdu 38 % en un an au deuxième trimestre.']] },
  { name: 'Contrôles sectoriels', order: 2, transmission: 'Paniers de référence pour séparer ce qui est propre à Robinhood de ce qui vient des courtiers, de la finance ou des valeurs technologiques financières.', rows: [
    ['IAI', 'sector_proxy', 'Panier des courtiers et des bourses', 'S’il tient pendant que Robinhood chute, la baisse est propre au titre et pas au courtage.'],
    ['XLF', 'sector_proxy', 'Panier financier du S&P 500', 'Contrôle financier large : un mouvement commun n’a rien de spécifique à Robinhood.'],
    ['ARKF', 'sector_proxy', 'Panier des valeurs technologiques financières', 'Le comparable le plus corrélé à Robinhood depuis février : il mesure l’appétit pour les valeurs financières de croissance.']] },
];

module.exports = { docs, needles, groups, ACC_10Q, ACC_ER2, ACC_CONV };
