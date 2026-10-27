'use strict';
// Éléments statiques du dossier Lumentum (LITE) du 27 octobre 2026 : dépôts primaires ouverts et hachés, extraits
// textuels exigés, groupes économiques du rayon de propagation. Lu par build-lite.cjs.

const docs = [
  ['2026-08-17', '10-K', '0001628280-26-057358', 'lite-20260627.htm', 'fy26-10k__lite-20260627.htm',
    'Rapport annuel de l’exercice clos le 27 juin 2026 : 89,7 millions d’actions ordinaires au 14 août ; deux clients finaux non nommés à 26,6 % et 15,0 % du chiffre d’affaires ; 1 554,3 M$ d’obligations convertibles restantes (2026 : 54,8 ; 2028 : 179,6 ; 2029 : 54,9 ; 2032 : 1 265,0), toutes convertibles au premier trimestre 2027, principal remboursé en numéraire et excédent en numéraire ou en actions au choix de la société ; 1 124,9 M$ de principal échangés contre des actions pendant l’exercice, d’où la perte comptable de 7 756,6 M$ ; option d’achat plafonnée à 268,24 $ sur les obligations 2032 ; 2 738,4 M$ de trésorerie et placements ; 2 354,4 M$ d’engagements d’achat.'],
  ['2026-08-11', '8-K / Exhibit 99.1', '0001628280-26-055726', 'lite_ex991xq4fy26.htm', 'q4-8k-ex991__lite_ex991xq4fy26.htm',
    'Communiqué du quatrième trimestre : chiffre d’affaires de 1 006,3 M$ (+109,3 % sur un an), marge brute GAAP de 47,4 %, marge opérationnelle GAAP de 27,8 % (36,6 % hors rémunérations en actions et autres ajustements) ; composants 649,4 M$, systèmes 356,9 M$. Perte nette GAAP de 7,2 Md$ au trimestre, due à la perte non monétaire de 7,8 Md$ sur l’échange des convertibles ; résultat net ajusté de 326,3 M$, 3,23 $ par action sur 101,1 millions d’actions diluées. Prévision du premier trimestre 2027 : 1,225 à 1,275 Md$ de chiffre d’affaires, marge opérationnelle ajustée de 39,5 à 40,5 %, 4,05 à 4,35 $ de bénéfice ajusté par action.'],
  ['2026-10-06', 'DEF 14A', '0001308179-26-000420', 'lite2026-def14a.htm', '2026-10-06-DEF14A-000420-lite2026-def14a.htm',
    'Circulaire de l’assemblée annuelle du 18 novembre 2026 : au 24 septembre, date d’enregistrement, 90 582 856 actions ordinaires et 2 876 415 actions de préférence Série A convertibles en autant d’actions ordinaires, soit 93 459 271 voix. Nombre d’actions le plus récent publié par la société.'],
  ['2026-03-02', '8-K / Exhibit 99.1', '0001193125-26-085412', 'd41019dex991.htm', '2026-03-02-8-K-085412-d41019dex991.htm',
    'Communiqué conjoint de NVIDIA et Lumentum : accords pluriannuels non exclusifs comprenant un engagement d’achat de NVIDIA de plusieurs milliards de dollars et des droits d’accès à la capacité future de composants laser ; investissement de 2 Md$ de NVIDIA pour la recherche, la capacité future et l’exploitation, pendant que Lumentum construit une nouvelle usine aux États-Unis. Seul client coté documenté par un dépôt.'],
  ['2026-06-01', '8-K', '0001193125-26-249535', 'd112771d8k.htm', '2026-06-01-8-K-249535-d112771d8k.htm',
    'Échange privé du 29 mai 2026 : environ 5,0 millions d’actions nouvelles remises contre 650,4 M$ de principal des obligations 2028 et la valeur de conversion au-delà ; aucun produit en numéraire pour la société ; 172,2 M$ d’obligations 2028 restent en circulation après l’opération.'],
  ['2026-04-08', '8-K', '0001193125-26-146256', 'd13152d8k.htm', '2026-04-08-8-K-146256-d13152d8k.htm',
    'Échange privé du 7 avril 2026 : environ 5,7 millions d’actions nouvelles remises contre 264,8 M$ d’obligations 2026 et 209,8 M$ d’obligations 2029 ; restent 63,1 M$ d’obligations 2026 et 84,5 M$ d’obligations 2029 après l’opération.'],
  ['2025-09-08', '8-K', '0001193125-25-198329', 'd863090d8k.htm', '2025-09-08-8-K-198329-d863090d8k.htm',
    'Émission de 1,265 Md$ d’obligations convertibles à 0,375 % échéance 2032 : 5,3257 actions par tranche de 1 000 $, soit un prix de conversion d’environ 187,77 $ ; principal remboursé en numéraire à la conversion, excédent en numéraire ou en actions au choix de la société.'],
  ['2025-12-22', '8-K', '0001193125-25-328691', 'd38670d8k.htm', '2025-12-22-8-K-328691-d38670d8k.htm',
    'Ligne de crédit renouvelable garantie de 400,0 M$ signée le 19 décembre 2025 avec Wells Fargo comme agent, non tirée à la signature ; ratio de dette nette garantie limité à 3,25 fois. Capacité d’endettement, pas d’émission d’actions.'],
];

const needles = {
  shares: [0, ['As of August 14, 2026, the Registrant had 89.7 million shares of common stock outstanding', 'single, integrated enterprise']],
  customers: [0, ['Customer A 26.6 % 15.4 % 18.9 %', 'Customer B 15.0 % 16.0 % 11.4 %']],
  preferred: [0, ['approximately 2.9 million shares of our Series A Convertible Preferred Stock', 'sold at a price of $ 695.31 per share for an aggregate purchase price of $ 2.0 billion in cash', 'The Preferred Stock will convert on a one-for-one basis']],
  notesTable: [0, ['2026 Notes $ 1,050.0 $ — $ ( 149.3 ) $ ( 264.8 ) $ ( 581.1 ) $ 54.8', '2028 Notes 861.0 — ( 31.0 ) ( 650.4 ) — 179.6', '2029 Notes 603.7 — ( 339.1 ) ( 209.7 ) — 54.9', '2032 Notes — 1,265.0 — — — 1,265.0']],
  convPrice: [0, ['2032 Notes $ 187.77 $ 244.10 2029 Notes 69.54 90.40 2028 Notes 131.03 170.34 2026 Notes 99.29 129.08', 'all of our Notes remain convertible at the option of the holders during the first quarter of fiscal year 2027']],
  settlement: [0, ['by paying cash equal to the principal amounts of such series of converted Notes and paying or delivering, as the case may be, cash, shares of common stock, or a combination of cash and shares of common stock, at our election']],
  earlyConv: [0, ['we have received early conversion requests totaling $757.8 million aggregate principal amount of the Notes', 'the aggregate principal amount of the Notes settled in cash was $519.4 million', 'we have not received any early conversion requests with respect to the 2032 Notes']],
  cappedCall: [0, ['The cap price of the 2032 Capped Call Options was initially $268.24 per share']],
  cash: [0, ['we had cash, cash equivalents, and short-term investments of $2,738.4 million']],
  extinguishment: [0, ['The cumulative loss is driven by the loss on debt extinguishment of $7,756.6 million']],
  purchaseObl: [0, ['Purchase obligations (3) 2,354.4 2,112.5 241.9']],
  supply: [0, ['demand is outpacing our current supply which has required us to make decisions on supply allocation', 'some of our suppliers are our sole sources for certain materials, equipment and components']],
  cms: [0, ['Our significant contract manufacturing partners are located primarily in Thailand, Taiwan, Malaysia and the Philippines']],
  competitors: [0, ['Some of these competitors are also our customers for certain of our products']],
  equitization: [0, ['Aggregate principal amount of the convertible notes settled through issuance of common stock (equitization) 1,124.9']],
  intl: [0, ['represented 79.2%, 81.0% and 73.8% of net revenue']],
  awards: [0, ['Balance as of June 27, 2026 0.2 $ 8.1 2.0 $ 114.6 0.8 $ 84.0']],
  geo: [0, ['Mexico 443.7 14.7 148.5 9.0', 'Thailand $ 626.6 20.8 %', 'Hong Kong 519.3 17.2 398.6 24.2', 'China 284.8 9.4 95.5 5.8']],
  trade: [0, ['export controls on critical components may increase our costs']],
  exchange: [0, ['we issued an aggregate of approximately 10.6 million shares of our common stock in exchange for approximately $264.8 million, $650.4 million, and $209.7 million']],
  excessShares: [0, ['Conversion of convertible notes for conversion value in excess of principal amount — — 6.0']],
  q4: [1, ['Net revenue for the fourth quarter of fiscal year 2026 was $1.01 billion', 'one-time, non-cash loss on debt extinguishment of $7.8 billion', 'Net revenue for fiscal year 2026 was $3.01 billion']],
  q4table: [1, ['Net revenue $ 1,006.3 $ 808.4 $ 480.7 24.5% 109.3%', 'GAAP gross margin 47.4 % 44.2 % 33.3 %', 'GAAP operating margin (loss) 27.8 % 21.6 % (1.7) %', 'Non-GAAP operating margin 36.6 % 32.2 % 15.0 %']],
  mix: [1, ['Components $ 649.4 64.5 % $ 533.3 $ 320.4 21.8 % 102.7 % Systems 356.9 35.5 % 275.1 160.3 29.7 % 122.6 %']],
  guidance: [1, ['Net revenue in the range of $1.225 billion to $1.275 billion', 'Non-GAAP operating margin of 39.5% - 40.5%', 'Non-GAAP diluted net income per share of $4.05 to $4.35']],
  nongaap: [1, ['Non-GAAP net income for fiscal year 2026 was $782.3 million, or $8.67 per diluted share', 'Non-GAAP net income for the fourth quarter of fiscal year 2026 was $326.3 million, or $3.23 per diluted share']],
  dilshares: [1, ['Shares used in per share calculation - diluted on non-GAAP basis 101.1 95.2 72.0 90.2 71.2']],
  ceo: [1, ['Increasing demand for ultra-high-power CPO lasers, an initial order for ELS modules', 'OCS solutions and our cloud module business, where we are advancing 1.6T adoption']],
  fyMargins: [1, ['GAAP Gross margin 41.7 % 28.0 %', 'GAAP Operating margin (loss) 17.4 % (10.9) %']],
  proxyShares: [2, ['there were 90,582,856 shares of our common stock outstanding and 2,876,415 shares of our Series A Convertible Preferred Stock outstanding', 'Therefore, there are 93,459,271 total shares']],
  meeting: [2, ['The Annual Meeting starts at 8:00 a.m. Pacific Time on Wednesday, November 18, 2026', 'close of business on September 24, 2026 as the record date']],
  nvidia: [3, ['The non-exclusive agreement includes an NVIDIA multi-billion purchase commitment and future capacity access rights for advanced laser components', 'NVIDIA is investing $2 billion in Lumentum', 'builds out its U.S.-based manufacturing capabilities in a new fab']],
  exch2028: [4, ['will deliver an aggregate of approximately 5.0 million shares', 'in exchange for approximately $650.4 million principal amount of the Notes', 'approximately $172.2 million in aggregate principal amount of Notes will remain outstanding']],
  exch2026: [5, ['will deliver an aggregate of approximately 5.7 million shares', 'approximately $63.1 million in aggregate principal amount of 2026 Notes will remain outstanding', 'approximately $84.5 million in aggregate principal amount of 2029 Notes will remain outstanding']],
  notes2032: [6, ['issued $1.265 billion in aggregate principal amount of its 0.375% Convertible Senior Notes due 2032', 'The initial conversion rate is 5.3257 shares of common stock per $1,000 principal amount of Notes', 'approximately $187.77 per share']],
  credit: [7, ['provides for a senior secured revolving credit facility in an aggregate principal amount of $400.0 million', 'requiring the Company to maintain a secured net leverage ratio of less than or equal to 3.25:1.00', 'the Company had no outstanding revolving loans or letters of credit']],
};

// Obligations convertibles restantes au 27 juin 2026 (10-K, tableau des principaux et des prix de conversion).
const NOTES = [
  { serie: '2026', principal: 54.8, conv: 99.29, echeance: '15 décembre 2026' },
  { serie: '2028', principal: 179.6, conv: 131.03, echeance: '15 juin 2028' },
  { serie: '2029', principal: 54.9, conv: 69.54, echeance: '15 décembre 2029' },
  { serie: '2032', principal: 1265.0, conv: 187.77, echeance: '15 mars 2032', cap: 268.24 },
];

const groups = [
  { name: 'Référence de la filière — le plus gros fabricant d’optique', order: 1, transmission: 'Coherent vend, comme Lumentum, des lasers, des transcepteurs et des composants aux centres de données de l’IA. Les deux titres montent et baissent ensemble : un écart entre eux est la seule information propre à Lumentum.', rows: [
    ['COHR', 'leader', 'Lasers, transcepteurs et matériaux optiques', 'Concurrent frontal et plus gros pair coté de l’optique pour l’IA ; même clientèle de centres de données, mêmes contraintes de capacité laser.']] },
  { name: 'Pairs directs — modules et liaisons optiques', order: 1, transmission: 'Même budget d’interconnexion des grappes de calcul, réparti entre modules optiques, câbles actifs et puces de liaison. Une commande gagnée par l’un est souvent perdue par l’autre.', rows: [
    ['AAOI', 'direct_peer', 'Transcepteurs optiques pour centres de données', 'Concurrent direct sur les modules à haut débit des hyperscalers, plus petit et plus volatil ; ses résultats sont annoncés le même jour que ceux de Lumentum.'],
    ['CRDO', 'direct_peer', 'Câbles électriques actifs et puces de liaison', 'Alternative au cuivre pour les liaisons courtes dans la baie : chaque génération de débit déplace la frontière entre son marché et celui des modules optiques.'],
    ['MTSI', 'direct_peer', 'Lasers, pilotes et photodétecteurs', 'Vend des composants analogiques et optiques pour les mêmes modules ; à la fois fournisseur possible et concurrent sur certaines puces.']] },
  { name: 'Amont — substrats, puces de signal, fonderie et assemblage', order: 1, transmission: 'Le 10-K dit que la demande dépasse l’offre et que certains fournisseurs sont des sources uniques. La capacité des maillons amont fixe donc le chiffre d’affaires que Lumentum peut livrer.', rows: [
    ['AXTI', 'upstream', 'Substrats de phosphure d’indium', 'Fabrique les plaquettes de phosphure d’indium sur lesquelles sont gravés les lasers de la filière ; lien de filière, aucun contrat avec Lumentum publié.'],
    ['MRVL', 'upstream', 'Processeurs de signal des modules', 'Ses processeurs de signal équipent des modules optiques à 800 gigabits et 1,6 térabit ; fournisseur de la filière et concurrent sur l’optique intégrée.'],
    ['SMTC', 'upstream', 'Pilotes et amplificateurs pour l’optique', 'Puces analogiques qui pilotent les lasers et lisent les photodétecteurs des modules ; son carnet suit le volume de modules livrés.'],
    ['TSEM', 'upstream', 'Fonderie de photonique sur silicium', 'Grave des puces de photonique sur silicium pour les fabricants de modules ; baromètre de la capacité de l’optique intégrée.'],
    ['FN', 'upstream', 'Assembleur à façon en Thaïlande', 'Assemble des modules optiques pour la filière ; le 10-K de Lumentum cite des sous-traitants en Thaïlande, à Taïwan, en Malaisie et aux Philippines sans les nommer.']] },
  { name: 'Aval — client documenté et systèmes réseau', order: 1, transmission: 'NVIDIA est le seul client coté documenté par un dépôt : engagement d’achat de plusieurs milliards, accès réservé à la capacité laser et 2 Md$ investis. Les fabricants de systèmes achètent l’optique et en revendent une partie, parfois en concurrents.', rows: [
    ['NVDA', 'downstream', 'Client sous contrat et actionnaire', 'Engagement d’achat pluriannuel de plusieurs milliards et préférence convertible de 2 Md$ : ses plateformes de calcul fixent le volume de lasers commandés.'],
    ['CIEN', 'downstream', 'Systèmes de transport optique', 'Achète des composants et vend des systèmes cohérents ; client et concurrent sur les liaisons entre centres de données.'],
    ['ANET', 'downstream', 'Commutateurs pour centres de données', 'Chaque port de commutateur à haut débit appelle des transcepteurs : ses volumes donnent la demande de modules en aval.'],
    ['CSCO', 'downstream', 'Réseau et optique de centres de données', 'Client historique de l’optique télécom et des centres de données, aussi concurrent par ses propres modules.']] },
  { name: 'Second ordre — budgets d’investissement des hyperscalers', order: 2, transmission: 'Les deux clients à plus de 10 % ne sont pas nommés. Ce sont les budgets d’investissement des grands du cloud qui paient les grappes de calcul, donc l’optique : leurs prévisions de dépenses passent dans le carnet de Lumentum avec un ou deux trimestres de décalage.', rows: [
    ['GOOGL', 'second_order', 'Cloud et puces maison, acheteur d’infrastructure', 'Ses dépenses de centres de données et ses grappes de puces maison consomment de l’optique ; aucun contrat avec Lumentum publié.'],
    ['MSFT', 'second_order', 'Cloud Azure, acheteur d’infrastructure', 'Sa prévision d’investissement pour l’année fixe une part du volume d’optique commandé à la filière.'],
    ['META', 'second_order', 'Grappes d’IA internes', 'Bâtit ses propres grappes d’entraînement : son budget d’investissement se lit dans la demande de transcepteurs.'],
    ['AMZN', 'second_order', 'Cloud AWS, acheteur d’infrastructure', 'Sa dépense de centres de données conditionne le volume d’optique commandé à la filière.'],
    ['ORCL', 'second_order', 'Cloud Oracle, grands contrats d’IA', 'Construit des capacités de calcul financées en partie par la dette : un doute sur leur financement touche toute la chaîne.'],
    ['CRWV', 'second_order', 'Loueur de puissance de calcul', 'Nouveau cloud de l’IA financé à crédit : le premier maillon à souffrir si le crédit se resserre, la crainte exprimée par les patrons de Broadcom et d’Intel le 12 octobre, selon la presse.']] },
  { name: 'Second ordre — alternatives et maillons voisins', order: 2, transmission: 'Broadcom pousse l’optique intégrée au commutateur, menace de fond pour les modules enfichables ; Astera Labs et Corning vendent les liaisons et la fibre voisines ; Viavi teste les réseaux optiques.', rows: [
    ['AVGO', 'second_order', 'Commutateurs et optique intégrée', 'Son optique co-intégrée au commutateur déplacerait de la valeur hors des modules ; son patron a parlé du financement comme contrainte de l’IA le 12 octobre, selon la presse.'],
    ['ALAB', 'second_order', 'Connectivité dans la baie de calcul', 'Liaisons électriques entre puces et mémoire : même budget d’interconnexion, autre technologie.'],
    ['GLW', 'second_order', 'Fibre et câblage optique', 'Fibre et connectique des centres de données : volume qui suit celui des liaisons optiques, sans concurrence frontale.'],
    ['VIAV', 'second_order', 'Test des réseaux optiques', 'Ancienne maison mère issue de JDSU ; ses instruments de test suivent le déploiement des nouvelles générations de liaisons.']] },
  { name: 'Contrôles sectoriels', order: 2, transmission: 'Paniers de référence pour séparer ce qui est propre à Lumentum de ce qui vient des semi-conducteurs ou de la technologie en général.', rows: [
    ['SMH', 'sector_proxy', 'Panier de semi-conducteurs pondéré', 'S’il tient pendant que Lumentum chute, la baisse est propre à l’optique ou au titre.'],
    ['SOXX', 'sector_proxy', 'Panier de semi-conducteurs moins concentré', 'Second contrôle semi-conducteurs, moins dominé par les très grandes capitalisations.'],
    ['XLK', 'sector_proxy', 'Panier de technologie américaine', 'Contrôle large : un mouvement commun avec ce panier n’a rien de propre au titre.']] },
];

module.exports = { docs, needles, groups, NOTES };
