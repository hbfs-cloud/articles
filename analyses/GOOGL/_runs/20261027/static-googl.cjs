'use strict';
// Éléments statiques du dossier Alphabet (GOOGL) du 27 octobre 2026 : dépôts primaires ouverts et hachés, extraits
// textuels exigés, groupes économiques du rayon de propagation. Lu par build-googl.cjs.
const ACC_10Q = '0001652044-26-000071', ACC_ER2 = '0001652044-26-000066';

const docs = [
  ['2026-07-23', '10-Q', ACC_10Q, 'goog-20260630.htm', '2026-07-23-10-Q-000071-goog-20260630.htm',
    'Deuxième trimestre 2026 (clos le 30 juin) : 12 230 millions d’actions en circulation au 15 juillet (5 868 M de classe A, 835 M de classe B, 5 527 M de classe C). Gains sur titres de 99,0 Md$ au trimestre, « surtout des gains latents sur SpaceX et une société non cotée » : 77,4 Md$ de revalorisation de titres non cotés, 21,4 Md$ sur titres cotés. Actions SpaceX détenues : 94,1 Md$ (80,0 Md$ sous restriction de courte durée, 14,1 Md$ incessibles jusqu’au troisième trimestre 2027). Engagement de financement de 20,0 Md$ envers une société non cotée, sous conditions, jusqu’en 2030. Arriéré de commandes de 519,5 Md$, dont 513,9 Md$ pour Google Cloud. Aucun rachat d’actions au semestre ; 69,5 Md$ d’autorisation restante. Programme de vente d’actions au fil de l’eau de 40,0 Md$ inutilisé au 30 juin. Investissements de 80,6 Md$ au semestre. Jugement final dans le procès de la recherche (décembre 2025), en appel ; jugement sur les remèdes de la publicité en ligne encore attendu à la date du dépôt. Engagements d’achat et obligations contractuelles de 811,0 Md$, dont 707,0 Md$ d’engagements fixes ou garantis ; 85,2 Md$ de loyers de centres de données non commencés ; garanties de crédit de 43,8 Md$ de notionnel et 24,1 Md$ de garanties futures convenues.'],
  ['2026-07-22', '8-K / Exhibit 99.1', ACC_ER2, 'googexhibit991q22026.htm', '2026-07-22-8-K-000066-googexhibit991q22026.htm',
    'Communiqué du deuxième trimestre : chiffre d’affaires de 119,8 Md$ (+24 %), Google Cloud 24,8 Md$ (+82 %), résultat opérationnel 40,8 Md$ (34 % de marge). Bénéfice net de 112,2 Md$ dont 77,1 Md$ apportés par les gains sur titres après impôt (6,26 $ sur 9,11 $ de bénéfice par action). Flux de trésorerie libre de −5,9 Md$ au trimestre, 53,3 Md$ sur douze mois. Levée de capitaux propres de 49,6 Md$ nets et obligations pour 20,3 Md$ nets au trimestre ; dividende trimestriel de 0,22 $.'],
  ['2026-06-04', '8-K', '0001193125-26-257724', 'd83560d8k.htm', '2026-06-04-8-K-257724-d83560d8k.htm',
    'Programme de vente d’actions au fil de l’eau de 40 Md$ (classes A et C) signé le 1er juin ; émission de 25 459 689 actions A à 355,1982 $ et d’autant d’actions C à 351,8018 $, options de surallocation exercées en totalité le 3 juin ; placement privé de 10 Md$ auprès d’une filiale de Berkshire Hathaway (14 212 035 actions A à environ 351,81 $, 14 359 656 actions C à environ 348,20 $).'],
  ['2026-06-04', '8-K / Exhibit 99.2', '0001193125-26-257724', 'd83560dex992.htm', '2026-06-04-8-K-257724-d83560dex992.htm',
    'Communiqué du 2 juin : levée de capitaux propres de 84,75 Md$ en tout (actions, actions de préférence obligatoirement convertibles à 6,25 %, programme au fil de l’eau, placement privé). Chaque action de préférence de série A se convertira en mai 2029 en 2,2520 à 2,8160 actions A ; la série B en 2,2740 à 2,8420 actions C. Options plafonnées à 532,6704 $ par action A pour limiter la dilution à la conversion.'],
  ['2026-02-05', '10-K', '0001652044-26-000018', 'goog-20251231.htm', '2026-02-05-10-K-000018-goog-20251231.htm',
    'Rapport annuel 2025 : aucun client ni groupe de clients affiliés au-dessus de 10 % du chiffre d’affaires en 2023, 2024 ou 2025 ; puces d’IA maison (TPU, septième génération Ironwood) proposées aux clients de Google Cloud aux côtés de processeurs graphiques.'],
  ['2026-04-29', '8-K / Exhibit 99.1', '0001652044-26-000043', 'googexhibit991q12026.htm', '2026-04-29-8-K-000043-googexhibit991q12026.htm',
    'Communiqué du premier trimestre 2026 : Google Cloud 20,0 Md$ (+63 %) ; gains sur titres de 36,9 Md$ qui ajoutent 28,7 Md$ au bénéfice net (2,35 $ par action) ; obligations pour 31,1 Md$ nets.'],
  ['2026-02-04', '8-K / Exhibit 99.1', '0001652044-26-000012', 'googexhibit991q42025.htm', '2026-02-04-8-K-000012-googexhibit991q42025.htm',
    'Communiqué du quatrième trimestre 2025 : investissements 2026 attendus entre 175 et 185 Md$ ; gains sur titres de 2,3 Md$ qui ajoutent 1,8 Md$ au bénéfice net.'],
  ['2025-10-29', '8-K / Exhibit 99.1', '0001652044-25-000087', 'googexhibit991q32025.htm', '2025-10-29-8-K-000087-googexhibit991q32025.htm',
    'Communiqué du troisième trimestre 2025 : gains sur titres de 10,7 Md$ et commissions de performance qui ajoutent 8,3 Md$ au bénéfice net (0,68 $ par action).'],
  ['2026-08-10', '8-K', '0001193125-26-342390', 'd171253d8k.htm', '2026-08-10-8-K-342390-d171253d8k.htm',
    'Émission close le 10 août 2026 de 25 Md$ d’obligations en dollars, de 2028 à 2066, dont 2,5 Md$ à 6,500 % échéance 2066 : dette postérieure au bilan du 30 juin.'],
  ['2026-06-01', 'S-3ASR', '0001193125-26-251560', 'd135361ds3asr.htm', '2026-06-01-S-3ASR-251560-d135361ds3asr.htm',
    'Enregistrement automatique de l’émetteur (dossier 333-296395) : obligations, actions de préférence, actions A et C, certificats de dépôt, bons de souscription et unités, sans montant plafonné. Base des émissions de juin et d’août.'],
  ['2026-08-06', '424B5', '0001193125-26-336853', 'd140593d424b5.htm', '2026-08-06-424B5-336853-d140593d424b5.htm',
    'Supplément du 6 août au prospectus du programme au fil de l’eau : jusqu’à 40 Md$ d’actions A et C, treize banques ajoutées comme agents ; conditions inchangées.'],
];

const needles = {
  shares: [0, ['5,868 million shares of Alphabet’s Class A stock outstanding', '835 million shares of Alphabet\'s Class B stock outstanding', '5,527 million shares of Alphabet\'s Class C stock outstanding']],
  gainsSource: [0, ['primarily related to unrealized gains in our equity securities portfolio from SpaceX and a private company']],
  gainsSplit: [0, ['Unrealized net gain (loss) on non-marketable equity securities accounted for under the measurement alternative 216 77,354', 'Unrealized net gain (loss) on marketable and other equity securities 853 21,399']],
  privateCo: [0, ['our investments in non-marketable securities accounted for under the measurement alternative primarily consist of our investment in a private company']],
  spacex: [0, ['Includes $ 80.0 billion of Space Exploration Technologies Corp. (SpaceX) shares subject to short-term restrictions on the ability to sell', 'Includes $ 14.1 billion of SpaceX shares subject to long-term restrictions on the ability to sell through the third quarter of 2027']],
  commitment: [0, ['$ 20.0 billion of future capital funding commitments with a private company contingent upon the achievement of specified operational and']],
  backlog: [0, ['we had $ 519.5 billion of remaining performance obligations', 'of which $ 513.9 billion related to Google Cloud', 'We expect to recognize just over 50 % of the revenue backlog as revenues over the next 24 months']],
  atm: [0, ['As of June 30, 2026, we have not sold any shares under the ATM Program, and the full $ 40.0 billion remains available for future issuance']],
  buyback: [0, ['there were no repurchases of the company\'s Class A or Class C shares', 'As of June 30, 2026, $ 69.5 billion remained available for Class A and Class C share repurchases']],
  offering: [0, ['completed an underwritten public offering of 29 million Class A shares at a price of $ 355.1982 per share and 29 million Class C shares at a price of $ 351.8018 per share', 'private placement of 14 million Class A and 14 million Class C shares to an affiliate of Berkshire Hathaway Inc.']],
  preferred: [0, ['385 million Series A and Series B depositary shares, representing 19 million shares of 6.25 % Mandatory Convertible Preferred Stock']],
  capex: [0, ['we spent $39.6 billion and $80.6 billion on capital expenditures, respectively']],
  pricerunner: [0, ['The principal damages of $1.5 billion were accrued in general and administrative expenses in our Google Services segment']],
  searchCase: [0, ['A final judgment was entered in December 2025, which, among other things, imposes restrictions on how Google distributes its services and requires Google to share certain search data with and offer syndication services to certain competitors']],
  adtech: [0, ['The DOJ\'s remedy proposal includes structural remedies that could have a material adverse effect on our business', 'we are awaiting a final judgment']],
  android: [0, ['In July 2026, we made a cash payment of $ 5.2 billion for the fine plus accrued interest']],
  wiz: [0, ['we completed our acquisition of Wiz for $ 29.5 billion']],
  interest: [0, ['Interest expense (1) ( 261 ) ( 1,278 )']],
  commitments: [0, ['material purchase commitments and other contractual obligations totaling $811.0 billion, of which $200.7 billion was short-term', 'expected future fixed or guaranteed commitments under these agreements were $ 707.0 billion', 'an estimated $24.1 billion of future backstops', 'our maximum potential amount of future payments under these guarantees was $ 7.6 billion']],
  leases: [0, ['we have entered into leases, primarily related to data centers, that have not yet commenced with future lease payments of $ 85.2 billion that are not yet recorded']],
  backstops: [0, ['Credit derivatives $ 16,940 $ 43,785', 'We have entered into agreements with certain third parties to backstop certain payment obligations relating to data centers']],
  q2: [1, ['Consolidated Alphabet revenues increased 24%, or 23% in constant currency, to $119.8 billion', 'Google Cloud saw a meaningful acceleration in growth as revenues increased 82% to $24.8 billion', 'Consolidated Alphabet operating income increased 30% and operating margin expanded by 2 percentage points to 34%']],
  gainEffect2: [1, ['For Q2 2026, the net effect of the gain on equity securities of $99.0 billion increased the provision for income tax, net income, and diluted net income per common share by $21.9 billion, $77.1 billion, and $6.26, respectively']],
  income2: [1, ['Net income available to common stockholders $ 28,196 $ 112,107', 'Diluted net income per common share $ 2.31 $ 9.11']],
  fcf: [1, ['Free cash flow $ 24,461 $ 24,551 $ 10,116 $ (5,855) $ 53,273']],
  raise: [1, ['we issued a combination of Class A stock and Class C stock and mandatory convertible preferred stock for aggregate net proceeds of $49.6 billion', 'In the second quarter of 2026, we issued senior unsecured notes for net proceeds of $20.3 billion']],
  segments: [1, ['Google Services $ 33,063 $ 39,544 Google Cloud 2,826 8,814 Other Bets (1,246) (1,799) Alphabet-level activities (1) (3,372) (5,789)', 'Google Search & other $ 54,190 $ 63,271', 'Total TAC $ 14,705 $ 16,179']],
  repurchases: [1, ['Repurchases of stock (13,238) 0 (28,306) 0']],
  sbc: [1, ['Stock-based compensation expense 5,998 7,957 11,514 14,708']],
  diluted: [1, ['Number of shares used in diluted net income per common share calculation 12,198 12,309']],
  dividend: [1, ['a quarterly cash dividend of $0.22 per share on our Class A, Class B, and Class C stock']],
  atmDeal: [2, ['registration rights letter agreement with Berkshire Hathaway', 'up to $40 billion of shares of Class A Common Stock and Class C Capital Stock', 'On June 3, 2026, the Underwriters exercised each option in full', 'for gross proceeds of $10 billion']],
  raiseTotal: [3, ['represent a total equity raise of $84.75 billion', 'into between 2.2520 and 2.8160 shares of Class A Common Stock', 'into between 2.2740 and 2.8420 shares of Class C Capital Stock', 'is initially $532.6704 per share of the Class A Common Stock']],
  customers: [4, ['customer or groups of affiliated customers represented more than 10% of our revenues in 2023, 2024, or 2025']],
  tpu: [4, ['our own custom-built Tensor Processing Units (TPUs), such as Ironwood, our seventh-generation TPU']],
  q1: [5, ['revenues increased 63% to $20.0 billion', 'For Q1 2026, the net effect of the gain on equity securities of $36.9 billion increased the provision for income tax, net income, and diluted net income per share by $8.2 billion, $28.7 billion, and $2.35, respectively', 'we issued senior unsecured notes for net proceeds of $31.1 billion']],
  capexGuide: [6, ['our 2026 CapEx investments are anticipated to be in the range of $175 to $185 billion', 'For Q4 2025, the net effect of the gain on equity securities of $2.3 billion increased the provision for income tax, net income, and diluted net income per share by $483 million, $1.8 billion, and $0.15, respectively']],
  q3fy25: [7, ['For Q3 2025, the net effect of the gain on equity securities of $10.7 billion and the performance fees related to certain investments of $174 million increased the provision for income tax, net income, and diluted net income per share by $2.2 billion, $8.3 billion, and $0.68, respectively']],
  notesAug: [8, ['closed its underwritten public offering of $25 billion aggregate principal amount of U.S. dollar-denominated senior notes', '$2,500,000,000 aggregate principal amount of 6.500% notes due 2066']],
  shelf: [9, ['Alphabet Inc. Debt Securities Preferred Stock Class A Common Stock Class C Capital Stock Depositary Shares Warrants Units']],
  atmSupp: [10, ['Up to $40,000,000,000 Alphabet Inc. Class A Common Stock Class C Capital Stock']],
};

// Gains sur titres après impôt, par trimestre, lus dans les communiqués (Md$) : T3 2025, T4 2025, T1 2026, T2 2026.
const gainsAfterTax = [
  { q: 'T3 2025', v: 8.3, doc: 7 }, { q: 'T4 2025', v: 1.8, doc: 6 }, { q: 'T1 2026', v: 28.7, doc: 5 }, { q: 'T2 2026', v: 77.1, doc: 1 }];

const groups = [
  { name: 'Leaders — nuage et intelligence artificielle', order: 1, transmission: 'Microsoft et Amazon louent la même ressource que Google Cloud, de la puissance de calcul pour l’IA, et dépensent au même rythme. Leurs résultats de la même semaine diront si le marché paie encore ces investissements ou s’il exige du flux de trésorerie. Oracle est le loueur de capacité le plus endetté du groupe : il montre le prix d’un pari financé à crédit.', rows: [
    ['MSFT', 'leader', 'Nuage Azure, partenaire d’OpenAI, moteur Bing', 'Concurrent direct de Google Cloud et de Gemini ; résultats le même soir qu’Alphabet, selon une seule source.'],
    ['AMZN', 'leader', 'Nuage AWS, publicité, actionnaire d’Anthropic', 'Premier loueur de puissance de calcul et, comme Alphabet, actionnaire d’Anthropic : ses comptes portent le même type de gain de revalorisation.'],
    ['ORCL', 'direct_peer', 'Nuage d’infrastructure pour l’IA', 'Loue de la capacité de calcul aux laboratoires d’IA ; sert de mesure de l’appétit du marché pour les investissements financés par la dette.']] },
  { name: 'Pairs directs — publicité numérique', order: 1, transmission: 'La recherche et YouTube vendent de l’attention aux annonceurs, comme Meta, Pinterest, Snap et Reddit. Une hausse ou une baisse des budgets publicitaires se lit chez eux le même trimestre ; un recul de la recherche au profit des assistants d’IA aussi.', rows: [
    ['META', 'direct_peer', 'Publicité sur réseaux sociaux', 'Deuxième régie publicitaire mondiale ; mêmes annonceurs, même course aux investissements dans l’IA.'],
    ['PINS', 'direct_peer', 'Publicité visuelle et commerce', 'Petite régie concurrente pour les budgets des distributeurs ; résultats le 29 octobre, selon une seule source.'],
    ['SNAP', 'direct_peer', 'Publicité sur messagerie', 'Régie concurrente de YouTube pour l’attention des jeunes publics.'],
    ['RDDT', 'direct_peer', 'Forums et publicité', 'Site dont l’audience dépend en partie des moteurs de recherche ; mesure de ce que les réponses de l’IA font aux sites qui vivent des clics.']] },
  { name: 'Amont — puces, serveurs et optique des centres de données', order: 1, transmission: 'Alphabet prévoit 195 à 205 Md$ d’investissements en 2026, surtout en serveurs, puces et centres de données. Chaque dollar dépensé est un chiffre d’affaires pour Broadcom, Nvidia, TSMC, Micron, Celestica et Lumentum ; une prévision d’investissements relevée ou réduite le 28 octobre se lit d’abord chez eux.', rows: [
    ['AVGO', 'upstream', 'Puces sur mesure et réseau', 'Conçoit des puces d’IA sur mesure pour les hyperscalers et fournit des commutateurs réseau : premier bénéficiaire d’un budget d’investissement relevé.'],
    ['NVDA', 'upstream', 'Processeurs graphiques pour l’IA', 'Google Cloud propose ses processeurs aux côtés des TPU (10-K) : Alphabet est à la fois client et concurrent.'],
    ['TSM', 'upstream', 'Fonderie de puces', 'Fabrique les puces d’IA des hyperscalers, TPU compris.'],
    ['MU', 'upstream', 'Mémoire à haut débit', 'Mémoire empilée des accélérateurs d’IA, TPU compris ; sa demande suit les budgets d’investissement des hyperscalers.'],
    ['CLS', 'upstream', 'Assemblage de serveurs et de commutateurs', 'Assembleur de matériel pour les centres de données des hyperscalers.'],
    ['LITE', 'upstream', 'Optique des centres de données', 'Lasers et modules optiques qui relient les grappes de puces d’IA.']] },
  { name: 'Amont — distribution du trafic', order: 1, transmission: 'Alphabet paie des partenaires pour que sa recherche soit l’option par défaut sur leurs appareils : ce sont les coûts d’acquisition de trafic, 16,2 Md$ au deuxième trimestre. Apple en est le premier bénéficiaire, et le jugement de décembre 2025 restreint ces accords.', rows: [
    ['AAPL', 'upstream', 'Fabricant d’appareils, navigateur Safari', 'Recherche Google par défaut sur Safari, rémunérée par un partage de revenus ; les restrictions du jugement de la recherche visent ce type d’accord.']] },
  { name: 'Aval — annonceurs et agences', order: 2, transmission: 'Les agences de voyage en ligne et les grandes agences de publicité achètent des mots-clés et de l’espace sur YouTube. Leurs budgets font le chiffre d’affaires de la recherche ; leurs commentaires sur le coût du clic disent si l’IA change le rendement de ces dépenses.', rows: [
    ['BKNG', 'downstream', 'Agence de voyage en ligne', 'L’un des plus gros acheteurs de mots-clés ; résultats le 3 novembre, selon une seule source.'],
    ['EXPE', 'downstream', 'Agence de voyage en ligne', 'Acheteur de trafic payant sur la recherche ; résultats le 4 novembre, selon une seule source.'],
    ['OMC', 'downstream', 'Groupe d’agences de publicité', 'Place les budgets des annonceurs sur la recherche et YouTube.']] },
  { name: 'Second ordre — participations et écosystème publicitaire', order: 2, transmission: 'Depuis l’introduction en bourse de SpaceX en juin, la participation d’Alphabet est cotée : chaque variation du cours de SpaceX passe désormais dans le résultat trimestriel d’Alphabet, sans un dollar encaissé. The Trade Desk achète de la publicité en ligne pour les annonceurs, en concurrence avec les outils de Google visés par le procès de la publicité.', rows: [
    ['SPCX', 'second_order', 'Participation cotée d’Alphabet', '94,1 Md$ d’actions SpaceX au 30 juin, réévaluées chaque trimestre au cours de bourse (10-Q).'],
    ['TTD', 'second_order', 'Achat de publicité pour les annonceurs', 'Concurrent des outils publicitaires de Google ; les remèdes de comportement du 2 septembre ouvrent les enchères de Google aux outils concurrents.']] },
  { name: 'Contrôles sectoriels', order: 2, transmission: 'Paniers de référence pour séparer ce qui est propre à Alphabet de ce qui vient des services de communication ou des grandes valeurs technologiques.', rows: [
    ['XLC', 'sector_proxy', 'Panier des services de communication', 'Alphabet en est l’une des plus grosses pondérations : le panier bouge en partie avec lui.'],
    ['QQQ', 'sector_proxy', 'Panier des cent plus grandes valeurs du Nasdaq', 'S’il tient pendant qu’Alphabet baisse, la baisse vient de la société, pas du marché.']] },
];

module.exports = { docs, needles, groups, gainsAfterTax, ACC_10Q, ACC_ER2 };
