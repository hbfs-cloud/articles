'use strict';
// Éléments statiques du dossier Hewlett Packard Enterprise (HPE) du 27 octobre 2026 : dépôts primaires ouverts et
// hachés, extraits textuels exigés, groupes économiques du rayon de propagation. Lu par build-hpe.cjs.
// Les pièces déjà hachées par les runs du 24 et du 27 septembre gardent leur nom de fichier ; les nouvelles suivent
// la convention date-formulaire-accession.

const docs = [
  // 0
  ['2026-09-03', '10-Q', '0001645590-26-000080', 'hpe-20260731.htm', 'q3-10q__hpe-20260731.htm',
    'Troisième trimestre de l’exercice 2026, clos le 31 juillet. Les serveurs progressent de 35,3 % « surtout grâce au prix moyen de vente », lui-même tiré par la hausse du prix des mémoires et des SSD ; la pénurie mondiale de mémoire est citée comme durable. Le segment Cloud et IA fait 1 539 M$ de résultat sur les 2 109 M$ des segments, et 1 035 M$ de leurs 1 259 M$ de hausse ; son coût des ventes ne monte que de 5,9 % pour un chiffre d’affaires en hausse de 25,4 %. La marge du réseau est stable sur un an (22,0 % contre 22,1 %) et recule sur neuf mois (22,4 % contre 25,1 %). Stocks de 11,8 Md$ contre 6,4 Md$ au 31 octobre 2025, fournisseurs de 13,7 Md$ contre 7,7 Md$, engagements d’achat fermes de 30,4 Md$, dont 11,6 Md$ dus sur l’exercice 2027. Le 2 juillet 2026, bon de souscription de 4 156 466 actions à 0,01 $ accordé à Oracle, acquis par tranches selon ses achats de réseau pour ses centres de données d’IA, exerçable jusqu’au 25 juin 2029. Dette totale ramenée de 22,4 à 20,2 Md$ ; 16,5 millions d’actions rachetées en neuf mois, 3,2 Md$ d’autorisation restante.'],
  // 1
  ['2026-09-02', '8-K / Exhibit 99.1', '0001645590-26-000078', 'ex-991x922026x8k.htm', 'q3-8k__ex-991x922026x8k.htm',
    'Communiqué du troisième trimestre : chiffre d’affaires record de 12,2 Md$ (+34 %), marge opérationnelle GAAP de 11,4 % (16,2 % ajustée), carnet de commandes record. Réseau 2,9 Md$ (+74,9 %), serveurs 6,8 Md$ (+35,3 %). Prévision relevée : 13,9 à 14,8 Md$ au quatrième trimestre, bénéfice ajusté de 3,75 à 3,85 $ par action sur l’exercice 2026 ; cadre 2027 relevé à +13 à +17 % de chiffre d’affaires et au moins 5,0 Md$ de flux de trésorerie libre, avec une marge opérationnelle ajustée de 14 à 15 %, sous les 16,2 % du trimestre. Au moins 75 % du flux libre du quatrième trimestre promis aux actionnaires ; 2 581 M$ de flux libre sur neuf mois.'],
  // 2
  ['2026-09-30', '8-K / Exhibit 99.1', '0001645590-26-000084', 'hpenetworkinginvestorday20.htm', '2026-09-30-8-K-000084-hpenetworkinginvestorday20.htm',
    'Journée investisseurs consacrée au réseau, le 30 septembre 2026 : croissance du segment Réseau relevée pour l’exercice 2027, entre le haut de la fourchette des dix et le bas des vingt pour cent, avec une marge opérationnelle du milieu au haut des vingt pour cent ; économies liées à Juniper portées à 800 M$ par an d’ici la fin de l’exercice 2028 (au moins 600 M$ auparavant) ; première commande de 1,2 Md$ de Vultr pour les baies AMD Helios assemblées par HPE.'],
  // 3
  ['2025-12-18', '10-K', '0001645590-25-000130', 'hpe-20251031.htm', 'fy25-10k__hpe-20251031.htm',
    'Rapport annuel de l’exercice clos le 31 octobre 2025 : Juniper acquis le 2 juillet 2025 pour 13,6 Md$ ; 30 millions de préférentielles obligatoirement convertibles le 1er septembre 2027 en 2,5352 à 3,1056 actions chacune, convertibles plus tôt au gré des porteurs ; engagements d’achat fermes de 3,3 Md$ ; concurrents nommés (Dell, Super Micro, Cisco, Lenovo dans les serveurs ; Cisco, Arista, Nokia, Ciena, Extreme, Palo Alto, Fortinet dans le réseau) ; fournisseurs uniques Intel, AMD, Broadcom et Nvidia ; un distributeur non nommé à 10 % des créances.'],
  // 4
  ['2026-03-23', '8-K', '0001140361-26-010765', 'ef20068405_8k.htm', '2026-03-23-8-K-010765-ef20068405_8k.htm',
    'Clôture d’une émission obligataire de 2,0 Md$ en quatre tranches (taux variable 2028, 4,500 % 2028, 4,600 % 2029, 5,250 % 2033), enregistrée sur l’étagère S-3 n° 333-276221, automatiquement effective le 22 décembre 2023. De la dette, pas d’actions.'],
  // 5
  ['2023-12-22', 'S-3ASR', '0001645590-23-000122', 'forms-32023.htm', '2023-12-22-S-3ASR-000122-forms-32023.htm',
    'Étagère d’émission universelle automatiquement effective le 22 décembre 2023 : dette, actions ordinaires, préférentielles, bons de souscription et unités, sans montant fixé. Elle a servi aux obligations de septembre 2025 et de mars 2026 ; aucun programme de vente d’actions au fil de l’eau n’y est rattaché. Validité de trois ans, jusqu’au 22 décembre 2026.'],
  // 6
  ['2026-10-07', '4', '0001648401-26-000011', 'form4.xml', '2026-10-07-4-000011-neri-form4.xml',
    'Antonio Neri, président-directeur général, a vendu 250 000 actions le 5 octobre 2026 à 68,3102 $ en moyenne pondérée, par sa fiducie, dans le cadre d’un plan de cession programmé adopté le 4 juin 2026, quand le titre clôturait à 53,69 $ ; 1 182 393 actions détenues ensuite par la fiducie.'],
  // 7
  ['2026-10-23', '4', '0001560849-26-000013', 'form4.xml', '2026-10-23-4-000013-rahim-form4.xml',
    'Rami Rahim, ancien patron de Juniper, aujourd’hui à la tête du réseau de HPE, a vendu 34 443 actions le 21 octobre 2026 à 58,0376 $ en moyenne pondérée, par sa fiducie familiale, dans le cadre d’un plan de cession programmé adopté le 30 juin 2026 ; il en détient encore 840 690 par cette fiducie.'],
  // 8
  ['2025-12-04', '8-K', '0001645590-25-000126', 'hpe-20251204.htm', '2025-12-04-8-K-000126-hpe-20251204.htm',
    'Résultats du quatrième trimestre de l’exercice 2025 publiés le 4 décembre 2025 (item 2.02). Seul repère de date pour la publication du quatrième trimestre 2026, que la société n’a pas encore annoncée.'],
  // 9
  ['2026-04-03', '8-K', '0001645590-26-000036', 'hpe-20260401.htm', '2026-04-03-8-K-000036-hpe-20260401.htm',
    'Assemblée du 1er avril 2026 : 22 millions d’actions supplémentaires réservées au plan d’actions des salariés, approuvées par 757 960 873 voix contre 247 372 667. Réserve de dilution salariale : 1,7 % des actions en circulation au 27 août si elle était entièrement émise.'],
  // 10
  ['2026-06-01', '8-K', '0001645590-26-000052', 'hpe-20260601.htm', 'jun01-8k__hpe-20260601.htm',
    'Accord de coopération avec le fonds activiste Elliott amendé le 29 mai 2026 : conseil limité à quatorze administrateurs jusqu’à l’assemblée de 2027, nomination de Christopher Hsu. Gouvernance, sans effet sur le capital.'],
  // 11
  ['2026-10-01', '4', '0001560849-26-000010', 'form4.xml', '2026-10-01-4-000010-rahim-form4.xml',
    'Rami Rahim, à la tête du réseau de HPE, a vendu 34 456 actions le 29 septembre 2026 à 61,42 $ en moyenne pondérée, par sa fiducie familiale, dans le cadre du plan programmé adopté le 30 juin 2026 ; 875 133 actions détenues ensuite par cette fiducie.'],
  // 12
  ['2026-09-15', '4', '0001648401-26-000009', 'form4.xml', '2026-09-15-4-000009-neri-form4.xml',
    'Antonio Neri, président-directeur général, a vendu 250 000 actions le 11 septembre 2026 à 60,442 $ en moyenne pondérée, par sa fiducie, dans le cadre du même plan de cession programmé adopté le 4 juin 2026 ; 1 432 393 actions détenues ensuite par la fiducie.'],
];

const needles = {
  q3q: [0, ['common stock outstanding as of August 27, 2026 was 1,327,464,779 shares', '30,000,000 shares issued and outstanding as of July 31, 2026', 'the Company recorded a gain on sale of equity interest of $ 444 million', '$ 118 million of net income tax charges resulting from the gain on the H3C divestiture', 'On July 2, 2025, the Company completed the Juniper Networks merger']],
  memory: [0, ['Server net revenue increased by $1.8 billion, or 35.3%, predominantly due to an increase in the average selling price', 'primarily driven by commodity price increases, especially memory and SSDs', 'We are affected by the worldwide shortage in memory components', 'Cloud & AI earnings from operations increased by $1.0 billion, or 205.4%']],
  juniperRev: [0, ['Networking net revenue increased $1.2 billion, or 74.9%, primarily due to revenue attributable to Juniper Networks']],
  inventory: [0, ['Inventory 11,823 6,352', 'Accounts payable 13,734 7,731', 'Inventory ( 5,847 )', 'Accounts payable 5,870', 'Net cash provided by operating activities 4,229']],
  obligations: [0, ['had unconditional purchase obligations, including long-term agreements, of approximately $ 30.4 billion', 'The Company expects the commitments to total $ 4.2 billion, $ 11.6 billion']],
  segmentsQ: [0, ['Segment earnings (loss) from operations $ 637 $ 1,539 $ ( 67 ) $ 2,109', 'Segment earnings (loss) from operations $ 365 $ 504 $ ( 19 ) $ 850', 'Cost of sales 5,859 5,535 5.9 %', 'Gross profit 3,183 1,677 89.8 %', 'Earnings from operations as a % of net revenue 22.0 % 22.1 % 22.4 % 25.1 %', 'Earnings from operations $ 1,539 $ 504 205.4 % $ 3,138 $ 1,465 114.2 %']],
  debtPaydown: [0, ['In March 2026, we prepaid $1.25 billion of the $2.0 billion outstanding balance', 'In December 2025, we repaid $400 million of 1.20% Juniper Global Notes']],
  customerShares: [0, ['share-based consideration payable to a customer']],
  oracle: [0, ['aggregate of 4,156,466 shares of the Company’s common stock at an exercise price of $ 0.01 per share', 'deploy the Company’s networking solutions in the Holder’s AI data centers', 'exercisable through June 25, 2029']],
  buyback: [0, ['repurchased and settled 16.5 million shares', 'remaining authorization of approximately $ 3.2 billion']],
  debt: [0, ['Total $ 20,244 $ 22,365', 'included $ 0.9 billion and $ 1.2 billion respectively, both associated with the asset-backed debt securities']],
  diluted: [0, ['Weighted-average shares used to compute diluted net EPS 1,449', 'Dilutive effect of 7.625 % Series C mandatory convertible preferred stock (1) 76', '9,600,000,000 shares authorized']],
  q3: [1, ['HPE (NYSE: HPE) today announced financial results for the third quarter ended July 31, 2026', 'Record revenue of $12.2 billion, up 34% year-over-year', 'GAAP of 11.4%, up 870 basis points', 'Non-GAAP (1) of 16.2%', 'our order backlog at a record level', 'Free cash flow (1)(2) : $1.0 billion']],
  segments: [1, ['Networking revenue was $2.9 billion, up 74.9% from the prior-year period, with 22.0% operating profit margin', 'Server was $6.8 billion, up 35.3% from the prior-year period', 'Routing was $788 million, up 270.0% from the prior-year period', 'Data Center Networking was $382 million, up 112.2% from the prior-year period', 'Cloud & AI revenue was $9.0 billion, up 25.4% from the prior-year period, with 17.0% operating profit margin, compared to 7.0%']],
  guidance: [1, ['HPE estimates revenue to be in the range of $13.9 billion to $14.8 billion', 'GAAP diluted net EPS to be in the range of $2.93 to $3.03', 'non-GAAP diluted net EPS (1) to be in the range of $3.75 to $3.85', 'now expects free cash flow to be at least $3.75 billion']],
  fy27: [1, ['HPE is raising its revenue growth outlook range to 13% to 17%', 'non-GAAP diluted net EPS growth to be in the range of 16% to 20%', 'now expects free cash flow to be at least $5.0 billion', 'non-GAAP operating margin rate to be in the range of 14% to 15%']],
  fcf: [1, ['Free cash flow $ 2,581 $ (934)', 'return at least 75% of free cash flow to shareholders in Q4']],
  dividend: [1, ['regular cash dividend of $0.1425 per share', 'to stockholders of record as of the close of business on September 17, 2026']],
  nid: [2, ['$800 million in annual run-rate savings by the end of fiscal 2028, up from its previously announced target of at least $600 million', 'between high teens to low-20s percent', 'mid-to-high 20s percent range', '$1.2 billion order from Vultr', 'low-to-high 50s percent CAGR through fiscal 2029', 'doubled its quarter-over-quarter networking supply purchase commitments']],
  preferred: [3, ['into between 2.5352 shares and 3.1056 shares of common stock', 'expected to be September 1, 2027', 'Holders of shares of Preferred Stock have the option to convert all or any portion of their shares of Preferred Stock at any time']],
  obligations25: [3, ['unconditional purchase obligations of approximately $ 3.3 billion']],
  competitors: [3, ['such as Dell Technologies Inc., Super Micro Computer, Inc., Cisco Systems, Inc., and Lenovo Group Ltd.', 'Cisco Systems, Inc., Arista Networks Inc, Nokia Corporation, Huawei Technologies Co. Ltd., Ciena Corporation, NVIDIA Corporation, Extreme Networks, Inc., Palo Alto Networks, Fortinet, Inc.', 'Broadcom, Cisco Systems Inc., Dell Technologies Inc., IBM, NetApp Inc., Nutanix, and Pure Storage']],
  suppliers: [3, ['Intel and AMD as suppliers of certain x86 processors Broadcom and others for industry standard Application-Specific Standard Product, or NVIDIA for Graphics Processing Units']],
  distributor: [3, ['one distributor accounted for 10% of the Company\'s accounts receivable balance']],
  juniper: [3, ['completed the acquisition of Juniper Networks, Inc. for total consideration of $13.6 billion']],
  notes: [4, ['$500,000,000 in aggregate principal amount of its 4.500% Notes due 2028', '$600,000,000 in aggregate principal amount of its 5.250% Notes due 2033', 'S-3 (No. 333-276221), filed with the Securities and Exchange Commission and automatically effective on December 22, 2023']],
  shelf: [5, ['We may offer from time to time, in one or more offerings, debt securities, common stock, preferred stock, depositary shares, warrants, purchase contracts, guarantees and units consisting of any of these securities']],
  neri: [6, ['Neri Antonio F', '2026-10-05 4 S 0 56696 68.3102 D 1375697', '2026-10-05 4 S 0 193304 68.3102 D 1182393', 'pursuant to a trading plan adopted on 06/04/26']],
  neriSep: [12, ['Neri Antonio F', '2026-09-11 4 S 0 250000 60.4420 D 1432393', 'pursuant to a trading plan adopted on 06/04/26']],
  rahim: [7, ['rahim rami', 'EVP, Pres GM Networking', '2026-10-21 4 S 0 23500 58.0376 D 851633', '2026-10-21 4 S 0 10943 58.0376 D 840690', 'trading plan adopted on 06/30/26']],
  rahimSep: [11, ['rahim rami', '2026-09-29 4 S 0 27877 61.42 D 881712', '2026-09-29 4 S 0 6579 61.42 D 875133', 'trading plan adopted on 06/30/26']],
  lastQ4: [8, ['On December 4, 2025, Hewlett Packard Enterprise Company', 'results of operations for its fiscal quarter ended October 31, 2025']],
  sip: [9, ['increase the number of shares of common stock reserved for issuance under the 2021 Plan by 22 million (22,000,000) shares', '757,960,873 247,372,667']],
  elliott: [10, ['with Elliott Investment Management L.P.']],
};

const groups = [
  { name: 'Leader — serveurs d’IA', order: 1, transmission: 'Dell est le premier assembleur de serveurs d’IA et le concurrent que le 10-K de HPE nomme en tête. Le 14 octobre, Barclays a dégradé Dell, HPE et NetApp le même jour : pas encore d’inflexion significative de l’IA dans les entreprises, des revenus aidés par le prix des composants.', rows: [
    ['DELL', 'leader', 'Premier assembleur de serveurs d’IA', 'Corrélation la plus forte du panel avec HPE depuis février ; même client, même composant, même dégradation de Barclays le 14 octobre.']] },
  { name: 'Pairs directs — serveurs et stockage', order: 1, transmission: 'Mêmes acheteurs de serveurs et de stockage, mêmes coûts de mémoire et de SSD. Leurs marges disent si la hausse des prix des composants se répercute encore aux clients.', rows: [
    ['SMCI', 'direct_peer', 'Assembleur de serveurs d’IA', 'Concurrent nommé par le 10-K ; ses résultats annoncés le 3 novembre (une seule source) donneront le premier chiffre du trimestre sur les serveurs d’IA.'],
    ['NTAP', 'direct_peer', 'Stockage de données d’entreprise', 'Concurrent nommé par le 10-K pour le stockage, dégradé par Barclays le même jour que HPE et Dell ; il a pourtant monté depuis : la thèse de la mémoire ne frappe pas tout le groupe dégradé.'],
    ['IBM', 'direct_peer', 'Infrastructures et cloud hybride', 'Concurrent nommé par le 10-K dans le cloud hybride ; quasi décorrélé de HPE depuis février, il sert de témoin des dépenses informatiques hors IA.']] },
  { name: 'Pairs directs — réseau, le métier de Juniper', order: 1, transmission: 'Depuis l’achat de Juniper, le réseau pèse 24 % du chiffre d’affaires du troisième trimestre et l’essentiel de la marge de HPE. Ces concurrents nommés par le 10-K disent si le cycle des centres de données et des campus tient.', rows: [
    ['CSCO', 'direct_peer', 'Réseau d’entreprise et des centres de données', 'Premier concurrent nommé par le 10-K dans le réseau ; ses résultats annoncés le 12 novembre (une seule source) serviront de mesure du marché.'],
    ['ANET', 'direct_peer', 'Commutateurs des centres de données', 'Concurrent direct de la ligne réseau des centres de données (+112,2 % au troisième trimestre) ; résultats annoncés le 3 novembre (une seule source).'],
    ['EXTR', 'direct_peer', 'Réseau de campus', 'Concurrent nommé par le 10-K sur les campus, cœur historique d’Aruba ; résultats annoncés le 28 octobre (une seule source).'],
    ['NOK', 'direct_peer', 'Routage des opérateurs', 'Concurrent nommé par le 10-K dans le routage, la ligne de Juniper qui a fait +270 % au troisième trimestre.'],
    ['CIEN', 'direct_peer', 'Réseau optique des centres de données', 'Concurrent nommé par le 10-K ; même vague de liaisons entre centres de données d’IA que le routage de Juniper.']] },
  { name: 'Amont — processeurs, mémoire et SSD', order: 1, transmission: 'Le 10-K nomme Intel, AMD, Broadcom et Nvidia comme fournisseurs uniques ; le 10-Q attribue la hausse des serveurs au prix de la mémoire et des SSD. Le prix de ces composants fait à la fois le chiffre d’affaires et le risque de HPE.', rows: [
    ['NVDA', 'upstream', 'Processeurs graphiques des serveurs d’IA', 'Fournisseur unique des processeurs graphiques nommé par le 10-K ; ses allocations rythment les livraisons de systèmes d’IA.'],
    ['AMD', 'upstream', 'Processeurs et baies d’IA Helios', 'Fournisseur unique de processeurs x86 nommé par le 10-K, et partenaire de la baie Helios commandée 1,2 Md$ par Vultr le 30 septembre.'],
    ['INTC', 'upstream', 'Processeurs des serveurs classiques', 'Fournisseur unique de processeurs x86 nommé par le 10-K ; ses délais conditionnent le renouvellement du parc hors IA.'],
    ['AVGO', 'upstream', 'Puces de réseau du marché', 'Fournisseur unique de circuits de réseau standard nommé par le 10-K, et concurrent dans le cloud privé avec VMware.'],
    ['MU', 'upstream', 'Mémoire DRAM et HBM', 'La pénurie de mémoire citée par le 10-Q gonfle le prix moyen des serveurs ; une détente des prix de Micron dégonflerait le chiffre d’affaires de HPE.'],
    ['SNDK', 'upstream', 'SSD et mémoire flash', 'Le 10-Q cite les SSD avec la mémoire dans la hausse du prix moyen des serveurs ; résultats annoncés le 29 octobre (une seule source).']] },
  { name: 'Aval — client documenté et distribution', order: 1, transmission: 'Oracle est le seul client coté nommé par un dépôt : il détient un bon de souscription d’actions HPE qui s’acquiert par tranches selon ses achats de réseau pour ses centres de données d’IA. La distribution informatique porte le reste : un distributeur non nommé pèse 10 % des créances.', rows: [
    ['ORCL', 'downstream', 'Client nommé, centres de données d’IA', 'Détient un bon de souscription de 4 156 466 actions HPE à 0,01 $, acquis par tranches selon ses achats de réseau (10-Q), aucune tranche publiée comme acquise ; il a perdu 8,8 % le 14 octobre, avec le matériel d’IA.'],
    ['SNX', 'second_order', 'Distributeur de matériel informatique', 'Un distributeur non nommé pèse 10 % des créances de HPE au 31 octobre 2025 (10-K) ; TD Synnex sert de mesure du canal, sans que le dépôt le désigne.']] },
  { name: 'Second ordre — sécurité et ancienne maison mère', order: 2, transmission: 'La sécurité ne fait que 281 M$ au troisième trimestre, et HP Inc ne partage plus que l’histoire et le coût de la mémoire. Ces titres séparent le risque propre aux serveurs du sentiment sur le matériel et les logiciels de réseau.', rows: [
    ['FTNT', 'second_order', 'Pare-feu et réseau sécurisé', 'Concurrent nommé par le 10-K sur la sécurité réseau ; résultats annoncés le 28 octobre (une seule source).'],
    ['PANW', 'second_order', 'Plateforme de sécurité', 'Concurrent nommé par le 10-K ; témoin du sentiment sur la sécurité, segment encore petit chez HPE.'],
    ['HPQ', 'second_order', 'Ordinateurs et imprimantes', 'Ancienne société sœur ; la mémoire chère pèse sur ses coûts de PC, pas sur ses prix : utile pour lire qui répercute la hausse et qui la subit.']] },
  { name: 'Contrôles sectoriels', order: 2, transmission: 'Paniers de référence pour séparer ce qui est propre à HPE de ce qui vient des semi-conducteurs ou de toute la technologie.', rows: [
    ['SMH', 'sector_proxy', 'Panier de semi-conducteurs', 'Mesure le cycle de ses fournisseurs : un écart avec ce panier isole ce qui tient au matériel de HPE.'],
    ['XLK', 'sector_proxy', 'Panier technologique du S&P 500', 'Contrôle large : un mouvement commun avec ce panier n’a rien de propre à HPE.']] },
];

module.exports = { docs, needles, groups };
