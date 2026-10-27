'use strict';
// Éléments statiques du dossier CrowdStrike (CRWD) du 27 octobre 2026 : dépôts primaires ouverts et hachés, extraits
// textuels exigés, groupes économiques du rayon de propagation. Lu par build-crwd.cjs.
// Ajouts après la relecture contradictoire du 27 octobre : S-8 de mars (pièce 107), 8-K d'attribution d'actions de
// performance à George Kurtz (29 décembre 2025) et à Michael Sentonas (21 avril 2026).
// Les pièces du 24 septembre (10-Q, communiqué, S-3ASR, 10-K, 8-K de rachat et de fractionnement) sont reprises telles
// quelles ; trois pièces nouvelles : l'avis de vente 144 de George Kurtz (19 octobre), le formulaire 4 du directeur
// financier (25 septembre) et le communiqué du troisième trimestre de l'exercice 2026 (2 décembre 2025), repère de la
// date de publication et du net new ARR de l'an passé.

const docs = [
  ['2026-08-26', '8-K / Exhibit 99.1', '0001535527-26-000029', 'crwd-20260826xex991.htm', 'q2fy27-ex991.htm',
    'Communiqué du deuxième trimestre de l’exercice 2027 (clos le 31 juillet 2026) : chiffre d’affaires de 1,47 Md$ (+26 %), ARR de 5,84 Md$ (+25 %) dont 332,8 M$ de net new ARR (+51 %, record), flux de trésorerie libre record de 377 M$, ARR des comptes Falcon Flex au-delà de 2,29 Md$ (+101 %). Prévision du troisième trimestre : ARR de 6 184,4 à 6 188,4 M$, chiffre d’affaires de 1 523,2 à 1 529,2 M$, 0,31 $ de bénéfice ajusté par action ; exercice relevé à 5 991,1–6 011,1 M$ de revenus et 6 603,0–6 611,9 M$ d’ARR.'],
  ['2026-08-27', '10-Q', '0001535527-26-000031', 'crwd-20260731.htm', 'q2fy27-10q.htm',
    'Rapport trimestriel au 31 juillet 2026 : ARR exact de 5 841 421 k$ ; perte opérationnelle GAAP de 63,8 M$ sur le semestre ; rémunération en actions de 674,6 M$ sur six mois ; trésorerie de 5,01 Md$ ; obligations à 3,00 % échéance février 2029 ; 4,14 Md$ d’engagements d’achat, plus 2,9 Md$ pris après le 31 juillet ; aucun rachat au trimestre, 1,3 Md$ encore autorisés ; 1 023 934 842 actions au 20 août. Note 11 : procès de Delta sur l’incident du 19 juillet 2024 en phase de preuves, et demandes d’information du ministère de la Justice et de la SEC sur la comptabilisation des revenus et la déclaration de l’ARR de certaines transactions.'],
  ['2026-10-19', 'Form 144', '0001968582-26-001062', 'primary_doc.xml', 'oct19-144-kurtz.xml',
    'Avis de vente déposé pour George Kurtz, fondateur et directeur général : 620 000 actions issues de sa rémunération, valeur de marché indiquée de 140 981 800 $, par J.P. Morgan Securities, à vendre dans les trois mois. Plan de cession programmé adopté le 16 janvier 2026 ; l’avis liste des ventes de 10 000 actions par séance depuis le 20 juillet 2026.'],
  ['2026-09-25', 'Form 4', '0001778610-26-000024', 'form4-09252026_090901.xml', 'sep25-form4-podbere.xml',
    'Déclaration de Burt Podbere, directeur financier : ventes du 24 septembre 2026, au lendemain du record de clôture du 23, en direct et par des trusts familiaux, « pursuant to a 10b5-1 plan adopted on June 24, 2026 » ; prix pondérés de 259,35 à 263,51 $.'],
  ['2026-09-11', 'S-3ASR', '0001104659-26-107123', 'tm2625079-1_s3asr.htm', 'sep11-s3asr.htm',
    'Le 8 septembre 2026, CrowdStrike a conclu le rachat des actifs technologiques de XM Cyber et remis au vendeur 2 118 022 actions nouvelles, émises sans enregistrement ; ce S-3ASR enregistre leur revente sur le marché. La société ne reçoit aucun produit de la revente.'],
  ['2026-03-05', '10-K', '0001535527-26-000010', 'crwd-20260131.htm', 'fy26-10k.htm',
    'Rapport annuel de l’exercice clos le 31 janvier 2026 : chiffre d’affaires de 4,81 Md$, perte opérationnelle de 293 M$, flux opérationnel de 1,61 Md$ ; aucun client ni partenaire de distribution ne représente 10 % des revenus ; contrôle interne jugé efficace par l’auditeur.'],
  ['2025-12-02', '8-K / Exhibit 99.1', '0001535527-25-000030', 'crwd-20251202xex991.htm', 'q3fy26-ex991.htm',
    'Communiqué du troisième trimestre de l’exercice 2026, publié le 2 décembre 2025 : net new ARR de 265,3 M$ (+73 %), ARR de 4,92 Md$, chiffre d’affaires de 1,23 Md$. Base de comparaison du prochain trimestre et repère de la date de publication, non confirmée pour 2026.'],
  ['2026-04-06', '8-K', '0001535527-26-000013', 'crwd-20260406.htm', 'apr06-8k.htm',
    'Le conseil porte l’autorisation de rachat d’actions à 1,5 Md$ en ajoutant 500 M$, sans échéance ni obligation d’achat ; à cette date, 413 130 actions avaient été rachetées à 364,57 $ en moyenne avant le fractionnement de quatre pour une, soit 150,6 M$.'],
  ['2026-06-03', '8-K', '0001535527-26-000022', 'crwd-20260603.htm', 'jun03-8k.htm',
    'Fractionnement des actions à raison de quatre pour une, sous forme de dividende en actions, effectif après la clôture du 1er juillet 2026 : tous les montants par action sont ajustés depuis, y compris les barres de cours utilisées ici.'],
  ['2026-03-05', 'S-8 / Exhibit 107', '0001104659-26-023803', 'tm267529d1_ex-filingfees.htm', 'mar05-s8-fees.htm',
    'Enregistrement de 7 600 899 actions supplémentaires pour les plans de rémunération (5 067 266 pour le plan d’intéressement de 2019, 2 533 633 pour le plan d’achat d’actions des salariés), par la hausse annuelle automatique de ces plans ; nombres ajustés d’office en cas de fractionnement, donc quadruplés depuis juillet.'],
  ['2025-12-29', '8-K', '0001104659-25-124912', 'tm2534248d1_8k.htm', 'dec29-8k.htm',
    'Attribution à George Kurtz, le 22 décembre 2025, de 300 000 unités d’actions de performance cibles, de zéro à 600 000 actions selon le rendement total de l’action comparé au S&P 500 sur trois ans, jusqu’au 22 décembre 2028 (nombres d’avant le fractionnement de quatre pour une).'],
  ['2026-04-21', '8-K', '0001535527-26-000018', 'crwd-20260416.htm', 'apr21-8k.htm',
    'Attribution à Michael Sentonas, président, le 16 avril 2026, de 100 000 unités d’actions de performance cibles, de zéro à 200 000 actions selon le rendement total comparé au S&P 500 sur la même période de trois ans (nombres d’avant le fractionnement).'],
];

const needles = {
  q2: [0, ['Increases FY27 net new ARR growth guidance by 630 basis points to 34% year-over-year growth at the midpoint', 'Total revenue was $1.47 billion', 'Subscription revenue was $1.40 billion, a 27% increase', 'Professional services 70,606 66,007 135,382 118,673 Total revenue 1,470,897 1,168,952 2,856,526 2,272,386', 'record net new ARR of $333 million', '$332.8 million was net new ARR added in the quarter', 'record free cash flow of $377 million', '$2.29 billion in ending ARR from accounts that have adopted Falcon Flex']],
  guidance: [0, ['Annual recurring revenue $6,184.4 - $6,188.4 million $6,603.0 - $6,611.9 million', 'Total revenue $1,523.2 - $1,529.2 million $5,991.1 - $6,011.1 million', '$0.31 $1.25 - $1.26']],
  arr: [1, ['Annual recurring revenue $ 5,841,421 $ 4,656,682']],
  balance: [1, ['1,023,934,842', '746,216', '5,013,847', '4,141,527', 'Class A common stock, $ 0.0005 par value; 2,000,000 shares']],
  notes: [1, ['3.00 % Senior Notes maturing in February 2029', '$ 2.9 billion of non-cancelable purchase obligations']],
  legal: [1, ['On October 25, 2024, Delta Airlines', 'unspecified punitive damages', 'motion to dismiss was granted in part and denied in part. Discovery is ongoing.', 'requests for information from the U.S. Department of Justice and the U.S. Securities and Exchange Commission relating to the Company', 'recognition of revenue and reporting of ARR for transactions with certain customers', 'The Company is cooperating and providing information in response to these requests']],
  buyback: [1, ['Share repurchases — $ — 1,920 $ 175,622', 'No repurchases were made under the Share Repurchase Program during the three months ended July 31, 2026', '$ 1.3 billion remained available for future share repurchases']],
  cash_flow: [1, ['1,121,205', '222,037', '881,376', '674,617']],
  income: [1, ['2,856,526', '63,832']],
  controls: [1, ['disclosure controls and procedures were effective']],
  kurtz: [2, ['George Kurtz', '620000 140981800', 'J.P. Morgan Securities LLC', 'will be sold within three months from the date of this filing', '01/16/2026', '10/16/2026 10000']],
  podbere: [3, ['Podbere', 'Includes shares sold pursuant to a 10b5-1 plan adopted on June 24, 2026']],
  resale: [4, ['2,118,022', 'On September 8, 2026, we consummated our acquisition of the technology assets of XM Cyber Ltd.', 'pursuant to which we issued 2,118,022 shares of our common stock']],
  s8: [9, ['reserved for issuance pursuant to the 2019 Equity Incentive Plan Other 5,067,266', 'Employee Stock Purchase Plan Other 2,533,633', 'shall automatically be adjusted in accordance with Rule 416']],
  psuKurtz: [10, ['George Kurtz', 'with a target of 300,000 PSUs', 'up to 600,000 shares']],
  psuSentonas: [11, ['Michael Sentonas', 'with a target of 100,000 PSUs', 'up to 200,000 shares']],
  fy26: [5, ['4,812,005', '293,292', '1,612,349', '10% or more of the Company', 'maintained, in all material respects, effective internal control']],
  q3fy26: [6, ['December 2, 2025', '$265.3 million was net new ARR added in the quarter', 'Total revenue was $1.23 billion', 'today at 2:00 p.m. Pacific time (5:00 p.m. Eastern time)']],
  buyback8k: [7, ['$500 million', '$1.5 billion', '413,130 shares of its outstanding Class A common stock at an average price of $364.57 per share, for an aggregate purchase price of $150.6 million']],
  split: [8, ['four-for-one stock split']],
};

const groups = [
  { name: 'Leaders — plateformes de sécurité', order: 1, transmission: 'Palo Alto Networks et Microsoft fixent le prix et le périmètre des plateformes : quand ils regroupent les achats de sécurité, ils prennent ou cèdent des budgets à CrowdStrike sur les mêmes contrats.', rows: [
    ['PANW', 'leader', 'Premier éditeur de sécurité réseau et cloud', 'Concurrent frontal sur la consolidation des outils de sécurité ; corrélation de rendements la plus forte des grandes plateformes, et ses résultats donnent le ton du secteur avant ceux de CrowdStrike.'],
    ['MSFT', 'leader', 'Sécurité Defender intégrée à Windows et Azure', 'Sa sécurité vendue avec ses licences pèse sur les prix chez les entreprises moyennes ; concurrent structurel, mais son cours dépend surtout du nuage et de l’intelligence artificielle, pas de la sécurité.']] },
  { name: 'Pairs directs — postes, nuage et identités', order: 1, transmission: 'Même acheteur, le responsable de la sécurité, et même argument : protéger les postes, les accès et les identités, y compris celles des agents d’intelligence artificielle. Leurs écarts de croissance disent qui prend les parts de qui.', rows: [
    ['S', 'direct_peer', 'Concurrent direct sur la protection des postes', 'Le concurrent le plus proche de Falcon sur l’endpoint ; sa politique de prix est le premier signal d’une concurrence plus dure sur le cœur du métier.'],
    ['ZS', 'direct_peer', 'Sécurité des accès réseau en nuage', 'Même clientèle de grandes entreprises et même lecture des budgets ; ses résultats tombent avant ceux de CrowdStrike, une semaine plus tôt.'],
    ['OKTA', 'direct_peer', 'Gestion des identités', 'L’identité est le second front de Falcon ; sa croissance mesure la demande de contrôle des accès humains et des agents d’intelligence artificielle.'],
    ['SAIL', 'direct_peer', 'Gouvernance des identités', 'Même marché de l’identité que les modules Falcon Identity ; nouveau venu en Bourse, sensible aux mêmes annonces de budgets.'],
    ['NTSK', 'direct_peer', 'Sécurité des accès et des données en nuage', 'Concurrent de Zscaler et des modules cloud de Falcon, coté depuis peu ; il amplifie les mouvements du panier de sécurité.'],
    ['NET', 'direct_peer', 'Réseau et sécurité en périphérie', 'Même argument de plateforme unique et une valorisation comparable : il sert de repère au multiple que le marché accepte de payer pour la croissance.']] },
  { name: 'Pairs directs — réseau, vulnérabilités et résilience', order: 1, transmission: 'Les directions informatiques achètent aussi pare-feu, gestion des vulnérabilités et sauvegarde ; un ralentissement de leurs commandes précède souvent celui des budgets de sécurité.', rows: [
    ['FTNT', 'direct_peer', 'Pare-feu et sécurité réseau', 'Cycle matériel différent, mêmes acheteurs : ses résultats du 28 octobre sont la première lecture des budgets de sécurité du trimestre.'],
    ['CHKP', 'direct_peer', 'Pare-feu et sécurité des entreprises', 'Acteur mûr et rentable du même marché ; sa croissance lente sert de borne basse à ce que vaut la sécurité sans accélération.'],
    ['TENB', 'direct_peer', 'Gestion des vulnérabilités', 'Concurrent des modules d’exposition aux risques de Falcon, que le rachat des actifs de XM Cyber (simulation des chemins d’attaque) renforce ; sa faiblesse relative mesure la pression des plateformes.'],
    ['QLYS', 'direct_peer', 'Conformité et vulnérabilités en nuage', 'Acteur plus petit et très rentable du même périmètre ; exposé aux gains de parts des plateformes comme Falcon.'],
    ['RBRK', 'direct_peer', 'Sauvegarde et cyber-résilience', 'Même budget de résilience après incident ; très réactif en séance aux annonces de failles et aux publications du secteur.']] },
  { name: 'Amont — hébergement en nuage', order: 1, transmission: 'Falcon tourne sur l’infrastructure des grands clouds ; une partie des 4,14 Md$ d’engagements d’achat porte sur la capacité des centres de données, donc sur la marge brute.', rows: [
    ['AMZN', 'upstream', 'Hébergeur de la plateforme', 'Fournisseur de capacité de calcul de Falcon, et concurrent par ses outils de sécurité natifs ; son cours suit le commerce et le nuage, pas la sécurité.']] },
  { name: 'Second ordre — logiciels d’entreprise et partenaires', order: 2, transmission: 'Alliances nommées par CrowdStrike et éditeurs vendus aux mêmes directions informatiques : ils séparent le risque propre à la sécurité du sentiment sur tout le logiciel d’entreprise.', rows: [
    ['SNOW', 'second_order', 'Plateforme de données, partenaire nommé', 'Alliance annoncée pour sécuriser les données d’entreprise utilisées par l’intelligence artificielle ; partage les mêmes révisions de multiples des logiciels de croissance.'],
    ['CTSH', 'second_order', 'Services numériques, partenaire nommé', 'Alliance d’intégration chez les grands comptes : canal de distribution de Falcon, pas un pair de cours.'],
    ['DDOG', 'second_order', 'Supervision des infrastructures en nuage', 'Autre bénéficiaire des migrations vers le nuage ; son rythme mesure la croissance des charges hébergées qu’il faut aussi protéger.'],
    ['NOW', 'second_order', 'Plateforme de flux de travail d’entreprise', 'Même client, la direction informatique ; ses commentaires du 28 octobre sur les budgets valent pour la sécurité.'],
    ['CRM', 'second_order', 'Logiciel d’entreprise et données clients', 'Même budget logiciel des grandes entreprises ; repère de la tolérance du marché aux multiples de croissance.']] },
  { name: 'Contrôles sectoriels', order: 2, transmission: 'Paniers de référence pour séparer ce qui est propre à CrowdStrike de ce qui vient de la cybersécurité, du logiciel ou du marché.', rows: [
    ['CIBR', 'sector_proxy', 'Panier de cybersécurité pondéré', 'Un écart de performance avec ce panier isole ce qui est propre à CrowdStrike ; c’est le comparable qui explique le plus de ses mouvements.'],
    ['BUG', 'sector_proxy', 'Panier de cybersécurité équipondéré', 'Moins concentré sur les géants que CIBR : il dit si la hausse touche tout le secteur ou seulement les leaders.'],
    ['IGV', 'sector_proxy', 'Panier de logiciels américains', 'Contrôle large du logiciel : un mouvement commun à IGV n’a rien de spécifique à la sécurité.'],
    ['QQQ', 'sector_proxy', 'Panier des grandes valeurs du Nasdaq', 'Contrôle du marché : sépare le bêta de marché du mouvement propre au secteur et au titre.']] },
];

module.exports = { docs, needles, groups };
