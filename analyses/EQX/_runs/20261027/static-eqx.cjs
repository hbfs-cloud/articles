'use strict';
// Éléments statiques du dossier Equinox Gold (EQX) du 27 octobre 2026 : dépôts primaires ouverts et hachés, extraits
// textuels exigés, groupes économiques du rayon de propagation. Lu par build-eqx.cjs.
// Émetteur privé étranger canadien (40-F, 6-K, normes IFRS, dollar américain) : pas de 10-K ni de 10-Q, pas de faits
// us-gaap dans les données XBRL de la SEC. Les agrégats sont lus dans les états financiers déposés (méthode du run du
// 27 septembre, reconduite).
const ACC_40F = '0001628280-26-022120', ACC_Q2 = '0001756607-26-000004';

const docs = [
  // 0
  ['2026-08-05', '6-K', ACC_Q2, 'eqx-20260630financialstate.htm', 'Q2_financials.htm',
    'États financiers intermédiaires du deuxième trimestre 2026 (normes IFRS, dollar américain) : revenus du semestre de 1 631,4 M$ (551,5 M$ un an plus tôt), résultat opérationnel de 637,6 M$, amortissements et épuisement de 238,4 M$, résultat net des activités poursuivies de 405,8 M$ ; au 30 juin, trésorerie de 317,8 M$ et 583,0 M$ de prêts et emprunts, dont 398,2 M$ de ligne de crédit et 145,5 M$ de convertibles 2023. 3 075 271 bons hérités de Calibre en circulation ; programme de rachat de 39 414 095 actions au plus jusqu’au 1er mars 2027.', 1756607],
  // 1
  ['2026-03-31', '40-F', ACC_40F, 'eqx-20251231.htm', '40F_financials.htm',
    'États financiers audités de l’exercice 2025 (normes IFRS, dollar américain) : revenus des activités poursuivies de 1 817,2 M$, résultat opérationnel de 432,3 M$, amortissements et épuisement de 339,7 M$, perte nette des activités poursuivies de 18,9 M$ ; prêts et emprunts de 1 554,7 M$ et trésorerie de 407,4 M$ au 31 décembre 2025. Base des agrégats sur douze mois.', 1756607],
  // 2
  ['2026-08-05', '6-K', ACC_Q2, 'eqx-20260630mda.htm', 'Q2_mda.htm',
    'Rapport de gestion du deuxième trimestre 2026 : après l’opération Orla, 1 167 459 822 actions en circulation et 1 247 524 702 en données pleinement diluées (options, unités d’actions, 33 984 799 actions sous bons de souscription, 27 435 475 actions sous les convertibles 2023 et 4 089 482 sous les convertibles 2025) ; ligne de crédit et prêt à terme d’Orla remboursés pour 115,7 M$ ; départ à la retraite du directeur général Darren Hall le 31 octobre 2026, remplacé par Jason Simpson.', 1756607],
  // 3
  ['2026-10-13', '6-K', '0001171843-26-006596', 'exh_991.htm', '2026-10-13-6-K-006596-exh_991.htm',
    'Production du troisième trimestre 2026 : 237 019 onces produites et 248 484 vendues, dont deux mois seulement de Musselwhite et Camino Rojo ; prévision 2026 de 870 000 à 920 000 onces maintenue ; 190 M$ de dette remboursés dans le trimestre, 365 M$ tirés sur la ligne de crédit, 527 M$ de trésorerie et trésorerie nette de 163 M$ au 30 septembre, chiffres préliminaires ; 759 000 actions rachetées. Résultats annoncés pour le lundi 9 novembre 2026 après la clôture des marchés, conférence le 10.', 1756607],
  // 4
  ['2026-08-06', '6-K', '0001171843-26-005267', 'exh_991.htm', '2026-08-06-6-K-005267-exh_991.htm',
    'Communiqué du deuxième trimestre 2026 : revenus de 769,8 M$, prix de l’or réalisé de 4 256 $ l’once, coût tout compris de 2 175 $ l’once ; résultat net de 218,6 M$ pour les activités poursuivies, 123,3 M$ ajusté ; prévision 2026 portée à 870 000 – 920 000 onces avec Orla, coût tout compris prévu de 1 900 à 2 000 $ l’once, révisé pour tenir compte du prix du carburant ; 378 115 579 actions émises pour Orla ; dividende relevé de 50 % ; extension de Valentine approuvée pour 436 M$.', 1756607],
  // 5
  ['2026-09-21', '6-K', '0001171843-26-006132', 'exh_991.htm', '2026-09-21-6-K-006132-exh_991.htm',
    'Remboursement anticipé, le 20 octobre 2026, des 172,5 M$ d’obligations convertibles à 4,75 % échéance 2028 ; les porteurs pouvaient convertir jusqu’au 19 octobre au prix d’environ 6,0579 $, soit jusqu’à 28 475 124 actions nouvelles, environ 2,44 % du capital.', 1756607],
  // 6
  ['2026-08-05', '6-K', '0001193125-26-333258', 'd117362dex991.htm', '2026-08-05-6-K-333258-d117362dex991.htm',
    'Rapport d’acquisition d’entreprise du 4 août 2026 sur Orla Mining : états pro forma non audités et comptes d’Orla. Au premier trimestre 2026, Orla a réalisé 378,9 M$ de revenus et 201,2 M$ de résultat opérationnel, avec 47,7 M$ d’amortissements ; sur l’exercice 2025, 462,8 M$ de résultat opérationnel et 145,7 M$ d’amortissements, en présentation Equinox. Préventes d’or de 261,9 M$ au 31 mars 2026 (144 887 onces à livrer de mars 2025 à février 2028), 117,0 M$ d’or livré sans encaissement en 2025 ; bons de 23 392 397 actions à C$ 11,50 jusqu’en 2030 et 7 913 333 à C$ 3,00 jusqu’au 18 décembre 2026 ; échange à une action Equinox par action Orla.', 1756607],
  // 7
  ['2024-10-02', 'F-10', '0001193125-24-231041', 'd825516df10.htm', '2024-10-02-F-10-231041-d825516df10.htm',
    'Prospectus préalable de base du 1er octobre 2024 (régime canado-américain), déposé au titre de grand émetteur établi (WKSI), sans montant plafonné : actions, titres de dette, reçus de souscription, contrats d’achat, unités et bons de souscription, émissibles pendant vingt-cinq mois, soit jusqu’au début de novembre 2026 ; utilisé en octobre 2024 pour la seule revente d’actions d’un actionnaire, sans produit pour la société.', 1756607],
  // 8
  ['2026-08-06', 'S-8', '0001193125-26-337684', 'd113825dexfilingfees.htm', '2026-08-06-S-8-337684-d113825dexfilingfees.htm',
    'Enregistrement de 1 995 044 actions à émettre sur exercice d’options reprises du plan d’Orla, au prix de référence de 9,01 $ ; dilution liée à l’opération, modeste.', 1756607],
  // 9
  ['2026-08-17', '6-K', '0001171843-26-005594', 'exh_991.htm', '2026-08-17-6-K-005594-exh_991.htm',
    'Décision favorable du Bureau of Land Management pour South Railroad (Nevada) : fin de l’autorisation fédérale, permis d’État et droits d’eau seulement demandés ; premiers travaux engagés, première production d’or prévue en 2028, environ 130 000 onces par an sur les cinq premières années pour 395 M$ d’investissement initial. Premier contributeur à l’objectif de 800 000 onces annuelles supplémentaires.', 1756607],
  // 10
  ['2026-03-31', '40-F', ACC_40F, 'eqx-20251231mda.htm', '40F_mda.htm',
    'Rapport de gestion annuel 2025, facteurs de risque : le Canada et les États-Unis imposent des sanctions au Nicaragua ; un décret américain de 2022 autorise des sanctions contre les personnes opérant dans le secteur aurifère nicaraguayen ; la société s’estime en conformité, mais des contreparties peuvent être désignées à l’avenir et le financement comme l’assurance des mines du pays peuvent en souffrir.', 1756607],
  // 11
  ['2025-06-18', 'S-8', '0000950142-25-001641', 'eh250642922_ex107.htm', '2025-06-18-S-8-001641-eh250642922_ex107.htm',
    'Enregistrement de 2 000 000 actions à émettre sur exercice d’options reprises du plan de Calibre, au prix de référence de 6,57 $ ; dépôt antérieur à la fenêtre d’un an, ouvert pour le recensement par type de formulaire.', 1756607],
  // 12
  ['2026-08-25', 'SCHEDULE 13G', '0000947871-26-000832', 'primary_doc.xml', '2026-08-25-SC13G-000832-primary_doc.xml',
    'Déclaration de détention passive : Fairfax Financial et V. Prem Watsa détiennent 75 943 806 actions Equinox, 6,4 % du capital, à la date de l’événement du 31 juillet 2026, jour de l’intégration d’Orla.', 1756607],
];

const needles = {
  h1: [0, ['1,631,389', '551,521', '637,610', '29,159', '238,406', '103,504', '405,768', '106,929']],
  bal: [0, ['317,783', '583,000', 'Credit facility 7(a) $ 398,212', '2023 convertible notes 145,475']],
  warrantsCal: [0, ['Outstanding and exercisable – June 30, 2026 3,075,271', '$6.26 1,569,002 January 31, 2028 $12.86 1,506,269 March 4, 2030']],
  authorized: [1, ['authorized to issue an unlimited number of common shares with no par value']],
  mesquite: [2, ['Mesquite is an open pit']],
  ncib: [0, ['up to an aggregate of 39,414,095 common shares']],
  versamet: [0, ['8.7 million of its common shares in Versamet']],
  annual: [1, ['1,817,195', '432,339', '339,694', '18,861', '1,554,680', '407,355']],
  shares: [2, ['1,167,459,822 common shares issued and outstanding']],
  diluted: [2, ['33,984,799 common shares issuable under share purchase warrants', 'The Company’s fully diluted common shares total is 1,247,524,702', '4,089,482 common shares potentially issuable']],
  orlaDebt: [2, ['fully repaid Orla’s revolving credit facility and term loan, totalling $115.7 million']],
  q3: [3, ['Gold production of 237,019 ounces', 'gold sales of 248,484 oz', 'updated 2026 gold production guidance of 870,000 to 920,000 oz']],
  q3mines: [3, ['Greenstone 60,596', 'Musselwhite 1 (Aug – Sep) 45,616', 'Valentine 34,719', 'Nicaragua 58,489', 'Camino Rojo 1 (Aug – Sep) 18,975', 'Mesquite 17,116', 'Others 2 1,508', 'Total Consolidated 237,019']],
  ytdMines: [3, ['Greenstone 185,589', 'Valentine 94,400', 'Nicaragua 199,246', 'Mesquite 48,861', 'Others 2 18,796', 'Total Consolidated 611,483']],
  fullQuarter: [3, ['Full quarter production for Musselwhite and Camino Rojo was 63,090 oz and 26,168 oz']],
  q3cash: [3, ['repaid $190 million in debt', '$365 million drawn', '$527 million in cash and a net cash position of $163 million', 'repurchased 759,000 shares', 'approximately $1.2 billion in debt repayments']],
  resultsDate: [3, ['Monday, November 9, 2026 after market close', 'Tuesday, November 10, 2026 commencing at 7:00am PT (10:00am ET)']],
  h1price: [4, ['Average realized gold price - All Operations $/oz 4,256 4,604 3,207 4,440']],
  q2: [4, ['Sold 177,959 ounces of gold', 'average realized gold price of $4,256 per oz', 'all-in sustaining costs (“AISC”) of $2,175 per oz', 'Revenue of $769.8 million']],
  q2ni: [4, ['$ 218.6 $ 187.2', 'Unrealized (gain) loss on gold contracts (35.9 )', 'Adjusted net income (loss) - Continuing Operations $ 123.3']],
  guidance: [4, ['870,000 – 920,000', 'AISC 1 ($/ounce) $1,900 – $2,000', 'impact of higher fuel prices', 'consolidated 2026 growth capital guidance is $600-$650 million']],
  orlaClose: [4, ['issued 378,115,579 common shares', 'Darren Hall will retire from Equinox Gold effective October 31, 2026']],
  dividend: [4, ['increase to our quarterly dividend to $0.0225']],
  valentine: [4, ['initial capital budget of $436 million']],
  proForma: [4, ['pro forma net cash position of $214 million']],
  converts: [5, ['$172.5 million aggregate principal amount of 4.75% Convertible Senior Notes due October 15, 2028', 'conversion price of approximately $6.0579', '28,475,124 Common Shares']],
  orlaQ1: [6, ['Revenue $ 861,593 $ 378,880', 'Income from operations 390,232 201,225', 'Depreciation and depletion (111,936 ) (47,728 )']],
  orlaFy: [6, ['Revenue $ 1,817,195 $ 1,057,881', 'Income from operations 432,339 462,837', 'Depreciation and depletion (339,694 ) (145,693 )']],
  shelf: [7, ['SHORT FORM BASE SHELF PROSPECTUS New Issue and Secondary Offering October 1, 2024', 'during the 25-month period that this prospectus']],
  s8: [8, ['Orla Mining Ltd. Stock Option Plan Other 1,995,044 $ 9.01']],
  railroad: [9, ['positive Record of Decision', 'first gold production in 2028']],
  sanctions: [10, ['a 2022 executive order authorized sanctions on persons operating in Nicaragua’s gold sector']],
  capitalHist: [0, ['Balance – June 30, 2026 789,250,264', 'Balance – December 31, 2024 455,232,521']],
  q2adj: [4, ['Change in fair value of 2025 Convertible Notes conversion option (18.6 )', 'Net (gain) loss on modification and extinguishment of debt (18.2 )']],
  railroadCapex: [4, ['$70-$80M for South Railroad']],
  projects: [4, ['the Brazil mines that were sold in January 2026', 'Castle Mountain (USA), South Railroad (USA), Los Filos (Mexico)']],
  selfFund: [3, ['three high-quality, long-life mines in Canada', 'organic growth projects we expect to fund internally']],
  perimQ2: [0, ['2025 convertible notes 23,635', 'Other 15,678', 'Balance – June 30, 2026 $ 123,945 $ 39,417 $ 63,281 $ 226,643', 'Greenstone Contingent Consideration 9(b)(iii) 88,003', 'Amortization of deferred revenue 8 (46,843) (30,124) (75,700) (43,249)']],
  perimFy: [1, ['Amortization of deferred revenue 14 ( 158,063 )']],
  orlaPerim: [6, ['At March 31, 2026 $ 261,875', 'for a total of 144,887 ounces', 'Gold deliveries under the gold prepay (note 16) (117,013 )', '$20 million to be paid if the average spot price of gold exceeds $3,000/oz for the one-year period ending February 28, 2027']],
  orlaWarrants: [6, ['the Company issued 23,392,397 common share purchase warrants', 'The warrants will expire on February 28, 2030', 'At March 31, 2026 7,913,333 — 7,913,333 C$ 3.00', '1.00 (the “ Exchange Ratio ”)']],
  orlaConverts: [6, ['$164,000 of the outstanding principal balance was converted into 29,063,287 Orla common shares', 'plus 104.5% of the principal amount']],
  wksi: [7, ['well-known seasoned issuer', 'under the WKSI Blanket Orders']],
  railroadDetail: [9, ['Applications for key state permits and water rights have also been submitted', 'average 130,000 ounces of gold annually over the first five years', 'Initial capital costs are estimated at $395 million', 'first meaningful contributor towards our objective of adding 800,000 ounces']],
  aiscOrig: [2, ['AISC of $1,775 to $1,875 per ounce sold']],
  fuelCause: [4, ['revised to reflect year-to-date results and the impact of higher fuel prices']],
  s8cal: [11, ['Calibre Long-Term Incentive Plan Other 2,000,000 $ 6.57']],
  fairfax: [12, ['V. PREM WATSA', '75943806.00', 'FAIRFAX FINANCIAL HOLDINGS LIMITED', '07/31/2026']],
};

// Groupes économiques du rayon de propagation (lien économique documenté, pas une corrélation).
const groups = [
  { name: 'Leaders — grands producteurs d’or', order: 1, transmission: 'Newmont, Barrick et Agnico Eagle font le prix des actions aurifères : leurs multiples servent d’étalon et leurs résultats donnent le ton du secteur pour l’inflation des coûts et l’allocation du capital.', rows: [
    ['NEM', 'leader', 'Premier producteur d’or mondial', 'Étalon de valorisation du secteur ; ses résultats du troisième trimestre, déjà publiés, ont fixé la lecture des coûts avant ceux d’Equinox.'],
    ['B', 'leader', 'Grand producteur d’or mondial (Barrick)', 'Second étalon du secteur ; ses résultats tombent le même soir que ceux d’Equinox, la lecture des deux se fera sur la même séance.'],
    ['AEM', 'leader', 'Producteur senior aux mines surtout canadiennes', 'Producteur canadien de référence, comme Equinox depuis Orla : mêmes coûts de main-d’œuvre et d’énergie, multiple le plus élevé du groupe des producteurs.']] },
  { name: 'Pairs directs — producteurs intermédiaires des Amériques', order: 1, transmission: 'Même métier, même équation : prix de l’or moins coût tout compris. Leurs résultats d’octobre et novembre diront si la hausse du carburant ronge les marges avant qu’Equinox ne publie.', rows: [
    ['AGI', 'direct_peer', 'Producteur canadien et mexicain (Alamos)', 'Mines au Canada et au Mexique comme Equinox : premier pair à dire ce que le carburant et la main-d’œuvre ont coûté au trimestre.'],
    ['KGC', 'direct_peer', 'Producteur intermédiaire diversifié (Kinross)', 'Même équation prix de l’or moins coûts ; sa lecture des coûts et de la production sert de comparaison immédiate.'],
    ['IAG', 'direct_peer', 'Producteur intermédiaire aux actifs canadiens (IAMGOLD)', 'Autre producteur à fort levier sur l’or et à base canadienne ; a reculé un peu plus qu’Equinox sur vingt et une séances.'],
    ['EGO', 'direct_peer', 'Producteur intermédiaire (Eldorado)', 'Même taille de capitalisation, même sensibilité au prix de l’or ; a reculé davantage qu’Equinox sur vingt et une séances.'],
    ['BTG', 'direct_peer', 'Producteur intermédiaire à forte exposition africaine (B2Gold)', 'Producteur exposé à des juridictions difficiles, comme Equinox au Nicaragua ; son multiple, le plus bas du groupe, montre la décote appliquée à ce risque.'],
    ['SSRM', 'direct_peer', 'Producteur intermédiaire (SSR Mining)', 'Plus petite valeur d’entreprise du groupe et multiple de bas de fourchette ; il publie quelques jours avant Equinox, autre lecture des coûts du trimestre.']] },
  { name: 'Amont — le métal et le carburant', order: 1, transmission: 'Le prix de l’or fait le chiffre d’affaires ; le prix du carburant fait une partie du coût des mines à ciel ouvert. La société a relevé sa prévision de coûts en août en citant le carburant.', rows: [
    ['GLD', 'upstream', 'Or physique (fonds indiciel)', 'Le métal vendu par Equinox : chaque variation du prix de l’once passe directement dans les revenus et, amplifiée, dans la marge.'],
    ['USO', 'upstream', 'Pétrole brut (fonds indiciel)', 'Indicateur du coût du carburant des engins et des usines ; la société cite le prix du carburant dans la révision de ses coûts d’août.']] },
  { name: 'Second ordre — redevances et streaming', order: 2, transmission: 'Les sociétés de redevances touchent une part de l’or produit sans payer les coûts d’exploitation. Elles suivent le métal, pas le carburant : leur écart avec les producteurs isole le risque de coûts.', rows: [
    ['RGLD', 'second_order', 'Redevances et streaming (Royal Gold)', 'Exposition à l’or sans coût d’extraction ; un recul moindre que les producteurs signale que le marché sanctionne les coûts.'],
    ['FNV', 'second_order', 'Redevances diversifiées (Franco-Nevada)', 'Mêmes revenus liés à l’or, sans carburant ni main-d’œuvre : point de comparaison pour la part du recul due aux coûts.'],
    ['WPM', 'second_order', 'Streaming or et argent (Wheaton)', 'Achète la production future des mineurs à prix fixe : exposition au métal sans risque d’exploitation ni de chantier.']] },
  { name: 'Paniers sectoriels', order: 2, transmission: 'Paniers de mineurs : un mouvement commun avec eux n’a rien de propre à Equinox ; un écart durable en a.', rows: [
    ['GDX', 'sector_proxy', 'Panier des grands mineurs d’or', 'Si Equinox suit GDX à son bêta habituel, le mouvement vient du secteur ; un écart isole ce qui est propre à la société.'],
    ['GDXJ', 'sector_proxy', 'Panier des mineurs d’or intermédiaires', 'Segment des producteurs de taille moyenne, le plus proche du profil d’Equinox par la capitalisation et la volatilité.']] },
];

module.exports = { docs, needles, groups, ACC_40F, ACC_Q2 };
