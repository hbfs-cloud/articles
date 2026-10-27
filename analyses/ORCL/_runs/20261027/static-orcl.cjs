'use strict';
// Éléments statiques du dossier Oracle (ORCL) du 27 octobre 2026 : dépôts primaires ouverts et hachés, extraits
// textuels exigés, groupes économiques du rayon de propagation. Lu par build-orcl.cjs.
// Sept pièces reprises du dossier du 9 octobre (déjà hachées, aucun dépôt nouveau depuis hors formulaires 4) et deux
// pièces nouvelles du plan de financement de février 2026 : le 8-K du 4 février (programme d'actions de 20 Md$ et
// 25 Md$ d'obligations) et le supplément de prospectus définitif des actions préférentielles obligatoirement convertibles.

const docs = [
  ['2026-09-10', '8-K / Exhibit 99.1', '0001193125-26-387905', 'orcl-ex99_1.htm', 'q1fy27-ex991.htm',
    'Communiqué du premier trimestre de l’exercice 2027 (clos le 31 août) : chiffre d’affaires de 19,3 Md$ (+30 %), infrastructure cloud de 7,4 Md$ (+121 %), logiciel sous licence en recul de 3 % à 5,5 Md$ ; plus de 30 Md$ de nouveaux contrats de cloud IA signés, carnet de commandes contractuel (RPO) porté à 664 Md$ ; flux de trésorerie libre négatif d’environ 5 Md$ ; prévision annuelle d’au moins 90 Md$ de revenus et de 8,10 $ de bénéfice ajusté par action. La société affirme que ces contrats ne changent pas son plan de levée de capitaux.'],
  ['2026-09-11', '10-Q', '0001193125-26-389274', 'orcl-20260831.htm', 'q1fy27-10q.htm',
    'Rapport du trimestre clos le 31 août 2026 : flux opérationnel de 23,1 Md$, dont 11,4 Md$ de prépaiements de clients, contre 28,5 Md$ de capex ; programme d’actions « at-the-market » entièrement utilisé (141 millions d’actions, 19,9 Md$ nets) ; emprunts ramenés de 129,5 à 125,3 Md$ ; 288 Md$ de loyers de centres de données signés mais pas encore au bilan, qui démarrent entre le deuxième trimestre de l’exercice 2027 et l’exercice 2029. Charges d’intérêts de 1,4 Md$ (+55 %), aucun rachat d’actions, 6,3 Md$ d’autorisation restante. Plan de restructuration relevé d’environ 700 M$ après la clôture du trimestre ; action collective d’actionnaires déposée le 3 février 2026 dans le Delaware, qui reproche des déclarations trompeuses sur l’infrastructure cloud et que la société conteste. La société prévoit un capex de l’exercice 2027 supérieur à celui de 2026 ; 34,2 Md$ d’engagements d’achat inconditionnels au 31 août.'],
  ['2026-06-22', '10-K', '0001193125-26-277521', 'orcl-20260531.htm', 'fy26-10k.htm',
    'Rapport annuel de l’exercice clos le 31 mai 2026 : 43,0 Md$ d’obligations émises sur l’exercice ; aucun client au-dessus de 10 % du chiffre d’affaires, mais une concentration non nominative sur quelques grands clients de l’infrastructure cloud ; actions préférentielles de série D obligatoirement convertibles cotées (ORCL-PRD). Le facteur de risque prévient qu’un abaissement de la note de crédit pèserait sur la valeur de la dette et des actions.'],
  ['2026-02-04', '8-K', '0001193125-26-037840', 'd23732d8k.htm', 'feb04-8k.htm',
    'Plan de financement de février : contrat de placement d’actions « at-the-market » jusqu’à 20,0 Md$ signé le 2 février sur l’étagère d’enregistrement n° 333-277990, et émission le 4 février de 25 Md$ d’obligations en huit tranches, de 2029 à 2066, aux coupons de 4,550 % à 6,850 %. Avec les préférentielles convertibles, ce sont les trois étages du plan de 45 à 50 Md$ annoncé le 1er février.'],
  ['2026-02-04', '424B5', '0001193125-26-037818', 'd60756d424b5.htm', 'feb04-424b5.htm',
    'Supplément de prospectus définitif : 100 millions d’actions de dépôt, chacune égale à un deux-millième d’une action préférentielle de série D à 6,50 % obligatoirement convertible le 15 janvier 2029, entre 0,2499 et 0,3124 action ordinaire par action de dépôt selon le cours ; produit net d’environ 4,95 Md$. Les dividendes peuvent être payés en actions ordinaires.'],
  ['2026-09-25', 'DEF 14A', '0001193125-26-402816', 'orcl-20260925.htm', 'def14a-2026.htm',
    'Circulaire de l’assemblée du 18 novembre 2026 : 3 031 501 149 actions en circulation au 21 septembre ; Larry Ellison détient 1 158 375 174 actions (38,2 %) et en a nanti 413 millions en garantie d’emprunts personnels. Aucune augmentation du capital autorisé ni nouveau plan d’actions soumis au vote.'],
  ['2026-09-14', '8-K / Exhibit 99.1', '0001193125-26-389753', 'd20034dex991.htm', 'sep14-ex991.htm',
    'Communiqué du 12 septembre, déposé le 14 : Larry Ellison a annulé son plan de cession 10b5-1 sans qu’aucune action n’ait été vendue, et n’a pas d’autre plan de vente. Ce plan, adopté le 22 juin et révélé par le 10-Q (Item 5), l’autorisait à vendre jusqu’à 50 millions d’actions avant le 24 octobre.'],
  ['2026-06-23', '424B5', '0001193125-26-278585', 'd120346d424b5.htm', 'jun23-424b5.htm',
    'Supplément de prospectus du programme d’actions « at-the-market » plafonné à 20 Md$ (étagère n° 333-277990), qui ajoute des agents placeurs. Le 10-Q suivant montre le programme entièrement utilisé au premier trimestre ; aucun nouveau supplément n’a été déposé depuis.'],
  ['2026-10-01', 'Formulaire 4', '0001341439-26-000099', 'form4.xml', 'oct1-form4.xml',
    'Stephen Rusckowski, administrateur, achète 25 000 actions sur le marché le 29 septembre au prix moyen pondéré de 139,352 $ (de 138,96 à 139,74 $), environ 3,5 M$, par son trust personnel. Seul achat d’initié sur le marché relevé dans la période.'],
  ['2026-06-10', '8-K / Exhibit 99.1', '0001193125-26-265848', 'orcl-ex99_1.htm', 'jun10-ex991.htm',
    'Communiqué des résultats de l’exercice 2026 (clos le 31 mai) : flux de trésorerie libre négatif de 23,7 Md$ sur l’exercice, carnet de 638 Md$. Pour l’exercice 2027, Oracle prévoit de lever environ 40 Md$ en dette et en actions, programme d’actions de 20 Md$ compris, et ne prévoit aucune dette supplémentaire sur l’année civile 2026. La part prépayée ou fournie par les clients du matériel des grands contrats d’IA atteint 75 Md$, ce qui réduit d’autant le capital à lever selon la société.'],
  ['2026-02-02', 'FWP', '0001193125-26-032650', 'd36096dfwp.htm', 'feb02-fwp.htm',
    'Communiqué du 1er février déposé comme prospectus libre sur l’étagère n° 333-277990 : levée de 45 à 50 Md$ prévue sur l’année civile 2026, moitié en actions (préférentielles obligatoirement convertibles et programme de 20 Md$), moitié en une émission unique d’obligations, sans autre obligation prévue en 2026. Clients cités : AMD, Meta, Nvidia, OpenAI, TikTok, xAI.'],
];

const needles = {
  q1: [0, ['Q1 Cloud Infra (IaaS) Revenue up 121% in USD', 'Software revenues were down 3% to $5.5 billion']],
  bookings: [0, ['Oracle booked more than $30 billion of additional AI cloud contracts in Q1', 'the Company confirms there is no incremental impact on its plans to raise capital']],
  guidance: [0, ['we now expect total revenue to be at least $90 billion, and non-GAAP EPS to be at $8.10', 'Total revenues are expected to grow between 30% and 34% in constant currency and USD', 'between $1.85 and $1.93 in USD']],
  fcfq1: [0, ['Free cash flow was negative $5 billion for Q1']],
  dividend: [0, ['quarterly cash dividend of $0.50 per share']],
  cashflow: [1, ['Net cash provided by operating activities 23,103', 'Capital expenditures ( 28,499 )', 'Increase in deferred revenues from customer prepayments with significant financing component 11,363']],
  borrowings: [1, ['Notes payable and other borrowings, current $ 7,625 $ 7,199', 'Notes payable and other borrowings, non-current 117,712 122,342']],
  leases: [1, ['$ 288 billion of additional lease commitments']],
  rpo: [1, ['Remaining performance obligations were $664 billion and $455 billion as of August 31, 2026 and 2025']],
  income: [1, ['Operating income 6,728 4,277', 'Interest expense ( 1,428 ) ( 923 )', 'Non-operating income, net 307 73', 'Restructuring and other 94 415']],
  dilutedq1: [1, ['Weighted average common shares outstanding: Basic 2,966 2,826 Diluted 3,000 2,909']],
  authorized: [1, ['authorized: 11,000 shares; outstanding: 3,024 shares and 2,880 shares as of August 31, 2026 and May 31, 2026']],
  atm: [1, ['fully utilized the ATM Program and issued 141 million shares of common stock under the ATM Program for net proceeds of $ 19.9 billion']],
  buyback: [1, ['approximately $ 6.3 billion remained available for stock repurchases', 'There was no stock repurchase activity for the three months ended August 31, 2026']],
  restructuring: [1, ['supplemented the 2026 Restructuring Plan by approximately $ 700 million']],
  litigation: [1, ['Securities Class Action']],
  ellisonplan: [1, ['adopted a new trading plan on June 22, 2026', 'scheduled to terminate on October 24, 2026', 'to sell up to 50 million shares of Oracle common stock']],
  notes: [2, ['we issued a total of $43.0 billion par value of senior notes']],
  ratingrisk: [2, ['changes to our outlook or credit rating or a withdrawal by any rating agency could negatively affect the value of both our debt and equity securities']],
  customers: [2, ['No single customer accounted for 10% or more of our total revenues']],
  prd: [2, ['Depositary Shares, each representing a 1/2,000th interest in a share of 6.50% Series D Mandatory Convertible Preferred Stock']],
  feb_notes: [3, ['Issuance of $25 Billion Aggregate Principal Amount of Notes']],
  feb_atm: [3, ['having aggregate sales proceeds of up to $20.0 billion', 'File No. 333-277990']],
  mcp: [4, ['Oracle Corporation is offering 100,000,000 depositary shares', '6.50% Series D Mandatory Convertible Preferred Stock', 'mandatory conversion date is expected to be January 15, 2029', 'not more than 0.3124 shares of common stock and not less than 0.2499 shares of common stock']],
  shares: [5, ['We had 3,031,501,149 shares of common stock outstanding and entitled to vote on the record date, September 21, 2026']],
  pledge: [5, ['had pledged 413 million shares of Oracle common stock', '1,158,375,174 38.2%', 'Wednesday, November 18, 2026']],
  ellison: [6, ['Ellison', '10b5-1', 'has cancelled', 'no other', 'September 12, 2026']],
  atm_shelf: [7, ['20,000,000,000', 'Prospectus Supplement', 'common stock', 'Registration No. 333-277990']],
  purchase: [8, ['RUSCKOWSKI', '25000', '139.352', 'prices ranging from $138.96 to $139.74']],
  fy27plan: [9, ['In fiscal year 2027, Oracle expects to raise approximately $40 billion through a combination of debt and equity financing including its previously announced $20 billion at-the-market equity issuance', 'Oracle does not expect to issue additional debt in calendar year 2026']],
  prepaid75: [9, ['The prepaid and customer supplied hardware portions of our large AI contracts now total $75 billion', 'This substantially reduces the amount of capital Oracle must raise']],
  fy26: [9, ['Free cash flow was negative $23.7 billion for fiscal year 2026', 'Increase in deferred revenues from customer prepayments with significant financing component 4,592', '$638 billion']],
  febplan: [10, ['Oracle expects to raise $45 to $50 billion of gross cash proceeds during the 2026 calendar year', 'Oracle does not expect to issue additional bonds during calendar year 2026 beyond this transaction', 'including AMD, Meta, NVIDIA, OpenAI, TikTok, xAI and others']],
  rposchedule: [1, ['of which we expect to recognize approximately 13 % as revenues over the next twelve months , 37 % over the subsequent month 13 to month 36 , 34 % over the subsequent month 37 to month 60']],
  capex27: [1, ['We expect our capital expenditures in fiscal 2027 to be higher than fiscal 2026']],
  unconditional: [1, ['unconditional purchase and certain other obligations with terms of one year or greater', 'Thereafter 6,622 Total $ 34,150']],
  dividendsq1: [1, ['Payments of dividends to stockholders ( 1,565 ) ( 1,413 )']],
  prefcarry: [1, ['Preferred stock and additional paid in capital Balance, beginning and end of period $ 4,954']],
  classaction: [1, ['On February 3, 2026, a putative class action, brought by an alleged stockholder of Oracle, was filed in the U.S. District Court for the District of Delaware']],
  ampere: [2, ['We recorded $ 2.7 billion of realized gain, which is included in the non-operating income (expenses), net line item']],
  leasecost: [2, ['Operating lease cost $ 2,794']],
  interest10k: [2, ['Interest expense ( 4,599 )']],
  div10k: [2, ['Payments of dividends to stockholders ( 5,787 )']],
  wksi: [2, ['well-known seasoned issuer, as defined in Rule 405 of the Securities Act. Yes ☒']],
  ampereq2: [0, ['interest in Ampere', 'decline between -18% and -14% in USD']],
};

const groups = [
  { name: 'Leaders — hyperscalers', order: 1, transmission: 'Microsoft, Amazon et Alphabet vendent la même capacité de calcul et se financent sur leurs propres flux de trésorerie. Leur capex dit si la demande d’IA tient ; leur cours, si le marché accepte encore de payer cette dépense.', rows: [
    ['MSFT', 'leader', 'Hyperscaler et partenaire historique d’OpenAI', 'Azure se dispute les mêmes contrats d’entraînement ; ses résultats du 28 octobre chiffreront le capex et la demande d’OpenAI vue par son premier partenaire.'],
    ['AMZN', 'leader', 'Premier fournisseur de cloud public', 'AWS fixe la référence de prix de la capacité ; une guerre de prix sur les processeurs graphiques comprimerait la marge de l’infrastructure d’Oracle.'],
    ['GOOGL', 'leader', 'Hyperscaler doté de puces maison', 'Google Cloud s’appuie sur ses propres processeurs ; son avance de coût menace les contrats d’Oracle bâtis sur des puces achetées.']] },
  { name: 'Pairs directs — néo-clouds financés à crédit', order: 1, transmission: 'CoreWeave et Nebius louent, comme Oracle, de la capacité de calcul construite avec de l’argent emprunté et vendue à quelques laboratoires d’IA. Le marché du crédit les juge ensemble : quand leurs obligations décrochent, Oracle suit.', rows: [
    ['CRWV', 'direct_peer', 'Néo-cloud coté, très endetté', 'Même modèle de location de capacité financée par dette et même dépendance à OpenAI ; c’est le comparable qui a le plus chuté avec Oracle le 14 et le 22 octobre.'],
    ['NBIS', 'direct_peer', 'Néo-cloud coté en Bourse', 'Même modèle de capacité louée à des laboratoires d’IA, financée par capitaux externes ; ses conditions de financement éclairent celles d’Oracle.']] },
  { name: 'Pairs directs — logiciel d’entreprise', order: 2, transmission: 'IBM, SAP, Salesforce et ServiceNow vendent aux mêmes directions informatiques que les bases de données et les applications d’Oracle. Ils séparent ce qui relève du logiciel de ce qui relève de la dette des centres de données.', rows: [
    ['IBM', 'direct_peer', 'Logiciel et infrastructure d’entreprise', 'Même base de grands comptes et même transition du logiciel vers le cloud hybride, sans le pari du calcul pour l’IA ; sert de multiple de référence au plancher de valeur.'],
    ['SAP', 'direct_peer', 'Concurrent en applications de gestion', 'Concurrent frontal des applications cloud d’Oracle ; ses renouvellements mesurent la part de marché des progiciels.'],
    ['CRM', 'direct_peer', 'Applications cloud d’entreprise', 'Budget logiciel des mêmes directions ; une pression sur les applications toucherait les deux sociétés.'],
    ['NOW', 'direct_peer', 'Plateforme logicielle d’entreprise', 'Référence de valorisation des logiciels à abonnement ; elle encadre le multiple accordé aux applications d’Oracle.']] },
  { name: 'Amont — puces, réseau et serveurs', order: 1, transmission: 'Oracle achète des processeurs graphiques, de la mémoire, des commutateurs et des serveurs avant d’encaisser le moindre loyer. Nvidia et AMD sont aussi clients d’Oracle, nommés par la société le 1er février : l’argent circule dans les deux sens.', rows: [
    ['NVDA', 'upstream', 'Fournisseur de processeurs graphiques et client nommé', 'Premier fournisseur des grappes d’Oracle et client cité par la société le 1er février (prospectus libre) ; une note de TD Cowen du 20 octobre lui prête un soutien de crédit à certains baux d’Oracle, sans confirmation.'],
    ['AMD', 'upstream', 'Accélérateurs alternatifs et client nommé', 'Seconde source d’accélérateurs et client cité par Oracle le 1er février ; sa disponibilité pèse sur le coût et le calendrier des déploiements.'],
    ['AVGO', 'upstream', 'Puces réseau et accélérateurs sur mesure', 'Le réseau des grappes IA passe par ses puces ; la demande d’Oracle se lit dans ses commandes.'],
    ['ANET', 'upstream', 'Commutateurs de centres de données', 'Équipementier réseau des grandes grappes ; un signal avancé de construction de capacité.'],
    ['MU', 'upstream', 'Mémoire à haut débit', 'La mémoire limite l’assemblage des serveurs IA ; sa rareté renchérit le capex d’Oracle.'],
    ['DELL', 'upstream', 'Intégrateur de serveurs IA', 'Assemble des serveurs pour les clouds ; son carnet reflète en partie la demande des acheteurs de capacité.']] },
  { name: 'Amont et second ordre — électricité des sites', order: 2, transmission: 'Un centre de données sans électricité ne loue rien. Les délais d’équipements électriques, le prix de l’énergie et les piles à combustible fixent le calendrier des campus d’Oracle, Project Jupiter compris.', rows: [
    ['VRT', 'upstream', 'Alimentation et refroidissement', 'Équipements électriques et thermiques des centres de données ; un goulot pour la mise en service.'],
    ['BE', 'upstream', 'Piles à combustible sur site', 'Bloom Energy alimente des centres de données d’Oracle en électricité produite sur place, solution de secours quand le réseau manque.'],
    ['CEG', 'second_order', 'Producteur d’électricité nucléaire', 'L’électricité est le premier goulot des centres de données ; son prix pèse sur la marge de l’infrastructure d’Oracle.'],
    ['TLN', 'second_order', 'Producteur d’électricité indépendant', 'Fournisseur d’énergie pour centres de données ; ses contrats indiquent le coût marginal de l’électricité.'],
    ['GEV', 'second_order', 'Turbines et équipements de réseau', 'Les délais de turbines et de transformateurs fixent le calendrier des nouveaux sites alimentés au gaz.']] },
  { name: 'Aval et second ordre — acheteurs et hébergeurs de capacité', order: 2, transmission: 'Meta achète de la capacité de calcul et figure parmi les clients nommés par Oracle le 1er février ; Applied Digital construit et loue des centres de données à crédit, comme les promoteurs des campus d’Oracle.', rows: [
    ['META', 'downstream', 'Grand acheteur de capacité IA, client nommé', 'Client cité par Oracle le 1er février ; le 21 octobre, il a relevé le bas de sa fourchette de capex 2026 (135-145 Md$) et le titre a quand même reculé, Oracle avec lui.'],
    ['APLD', 'second_order', 'Promoteur de centres de données IA', 'Même chaîne de construction financée à crédit ; ses conditions de financement signalent l’appétit des prêteurs pour les campus loués.']] },
  { name: 'Contrôles sectoriels', order: 2, transmission: 'Paniers de référence pour séparer ce qui est propre à Oracle de ce qui vient du logiciel, de la technologie ou des semi-conducteurs.', rows: [
    ['IGV', 'sector_proxy', 'Panier des éditeurs de logiciels américains', 'S’il tient pendant qu’Oracle chute, la baisse vient du financement des centres de données, pas du logiciel.'],
    ['XLK', 'sector_proxy', 'Secteur technologie du S&P 500', 'Contrôle large de la technologie : un recul commun n’a rien de spécifique à Oracle.'],
    ['SMH', 'sector_proxy', 'Panier des semi-conducteurs', 'Contrôle de l’amont : si les puces montent et qu’Oracle baisse, c’est le financement qui est en cause.']] },
];

module.exports = { docs, needles, groups };
