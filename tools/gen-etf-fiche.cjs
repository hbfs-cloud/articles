#!/usr/bin/env node
'use strict';
/*
 * gen-etf-fiche.cjs — génère les 3 fiches ETF UCITS (MEUD, QDVE, VWCG).
 * Toutes les valeurs proviennent de sources publiques datées (justETF, Yahoo Finance,
 * émetteur). Aucun chiffre inventé. Voir tools/lib/etf-fiche.cjs + templates/etf-fiche.md.
 *
 * Usage : node tools/gen-etf-fiche.cjs
 */
const fs = require('fs');
const path = require('path');
const { buildHtml, buildCard } = require('./lib/etf-fiche.cjs');

const ROOT = path.resolve(__dirname, '..');
const D = '28 septembre 2026';
const DISO = '2026-09-28';
const JE_DATE = 'sept. 2026';
const YA_DATE = '28 sept. 2026';
const ISS_DATE = 'sept. 2026';

// ─────────────────────────────────────────── MEUD ───────────────────────────
const MEUD = {
  ticker: 'MEUD', name: 'Amundi Core Stoxx Europe 600 UCITS ETF Acc',
  isin: 'LU0908500753', yahooTicker: 'MEUD.PA', exchange: 'Euronext Paris / Borsa Italiana',
  tradingCurrency: 'EUR', fundCurrency: 'EUR', launchDate: '3 avril 2013', domicile: 'Luxembourg',
  index: 'STOXX Europe 600', indexShort: 'STOXX Europe 600',
  replication: 'Physique', replicationLong: 'Physique, réplication complète (détention directe des 612 titres)',
  distribution: 'Capitalisant', distributionLong: 'Capitalisant : dividendes réinvestis dans le fonds, aucun versement',
  domicileLong: 'Luxembourg (fonds UCITS)',
  ter: '0,07 %', aum: '20,8 Md€', holdingsCount: '612',
  grade: 'A', status: 'conserver',
  dataTags: 'etf,eu,europe,financials,industrials', tagsList: ['etf', 'eu', 'europe', 'financials', 'industrials'],
  price: '316,15 €', priceNum: 316.15, changeLabel: '+0,36 % (Yahoo, ligne de Milan)', changeColor: '#16a34a', changePctNum: 0.36,
  securitiesLending: 'Non détaillé sur le profil public <span style="color:#94a3b8;">(indisponible)</span>',
  badges: [
    { text: 'CŒUR ACTIONS EUROPE', color: 'blue' },
    { text: 'TER 0,07 % — parmi les moins chers', color: 'green' },
  ],
  metaDescription: 'MEUD (Amundi Core Stoxx Europe 600) : cœur actions Europe large, 612 valeurs, TER 0,07 %, réplication physique, part capitalisante. Fiche sur données publiques au 28 septembre 2026.',
  ogDescription: 'MEUD : 612 valeurs européennes, 0,07 % de frais, +19,6 % sur un an. Cœur de portefeuille Europe à coût minimal.',
  dateDisplay: D, date: DISO, levelsCloseDate: DISO,
  cardTitle: 'MEUD — Amundi Core Stoxx Europe 600',
  cardSubtitle: 'Cœur actions Europe, TER 0,07 %, réplication physique. Fiche au 28 septembre 2026.',
  top10: [
    { name: 'ASML Holding', weight: '4,29 %' }, { name: 'HSBC Holdings', weight: '2,24 %' },
    { name: 'Roche Holding', weight: '2,06 %' }, { name: 'Novartis', weight: '1,92 %' },
    { name: 'AstraZeneca', weight: '1,66 %' }, { name: 'Shell', weight: '1,63 %' },
    { name: 'Nestlé', weight: '1,62 %' }, { name: 'Siemens', weight: '1,54 %' },
    { name: 'SAP', weight: '1,54 %' }, { name: 'Banco Santander', weight: '1,36 %' },
  ],
  holdingsChart: [
    { name: 'ASML', value: 4.29 }, { name: 'HSBC', value: 2.24 }, { name: 'Roche', value: 2.06 },
    { name: 'Novartis', value: 1.92 }, { name: 'AstraZeneca', value: 1.66 }, { name: 'Shell', value: 1.63 },
    { name: 'Nestlé', value: 1.62 }, { name: 'Siemens', value: 1.54 }, { name: 'SAP', value: 1.54 },
    { name: 'Santander', value: 1.36 },
  ],
  sectors: [
    { name: 'Finance', pct: '26,84 %' }, { name: 'Industrie', pct: '17,07 %' },
    { name: 'Santé', pct: '11,86 %' }, { name: 'Technologie', pct: '9,55 %' }, { name: 'Autres', pct: '34,68 %' },
  ],
  sectorsChart: [
    { name: 'Finance', value: 26.84 }, { name: 'Industrie', value: 17.07 }, { name: 'Santé', value: 11.86 },
    { name: 'Technologie', value: 9.55 }, { name: 'Autres', value: 34.68 },
  ],
  countries: [
    { name: 'Royaume-Uni', pct: '21,66 %' }, { name: 'Suisse', pct: '14,78 %' },
    { name: 'France', pct: '13,85 %' }, { name: 'Allemagne', pct: '13,04 %' }, { name: 'Autres', pct: '36,67 %' },
  ],
  perf: {
    ytd: '+10,70 %', y1: '+19,60 %', y3: '+54,74 %', since: '+215,15 %', vol: '12,19 %',
    note: '<strong>Performance = indice moins frais.</strong> Un fonds indiciel ne cherche pas à battre le STOXX Europe 600, il colle à sa trajectoire en prélevant le moins possible. À 0,07 % de frais, l\'écart de suivi attendu reste minime ; justETF ne publie pas ici de valeur de tracking difference précise <span style="color:#94a3b8;">(indisponible)</span>.',
    refs: [{ url: 'https://www.justetf.com/en/etf-profile.html?isin=LU0908500753', name: 'justETF', date: JE_DATE }],
  },
  perfChart: [10.70, 19.60, 54.74],
  verdict: {
    label: 'Cœur actions Europe, à conserver comme brique de fond',
    summary: 'MEUD réplique le STOXX Europe 600, soit 612 valeurs cotées dans dix-sept pays européens, pour 0,07 % de frais par an — l\'un des tickets d\'entrée les moins chers sur l\'Europe large. Réplication physique complète, part capitalisante, 20,8 Md€ d\'encours : une exposition de fond, rien d\'exotique. Sur un an, +19,6 %.',
    pros: [
      'Frais de 0,07 % : sur dix ans, l\'écart de coût avec un fonds à 0,30 % dépasse 2 points de performance cumulée.',
      'Réplication physique complète des 612 titres — pas de contrepartie de swap, pas d\'échantillonnage.',
      'Diversification réelle : finance 26,8 %, industrie 17,1 %, santé 11,9 %, technologie 9,6 %, sur dix-sept pays.',
      'Encours de 20,8 Md€ : liquidité et écart achat-vente resserrés sur les places où le fonds cote.',
    ],
    cons: [
      'Part capitalisante : aucun revenu versé, l\'intérêt est le rendement total, pas la distribution.',
      'Le Royaume-Uni pèse 21,7 % et la Suisse 14,8 % : exposition indirecte à la livre et au franc, pas seulement à l\'euro.',
      'Indice pondéré par capitalisation : ASML seul pèse 4,3 %, le haut de cote concentre une part notable du fonds.',
    ],
    forWho: 'L\'investisseur qui veut une exposition Europe large en une ligne, à coût minimal, sans pari sectoriel ni géographique. À conserver en socle ; renforcement pertinent sur repli, allègement seulement pour réduire volontairement la poche Europe.',
    refs: [
      { url: 'https://www.justetf.com/en/etf-profile.html?isin=LU0908500753', name: 'justETF', date: JE_DATE },
      { url: 'https://finance.yahoo.com/quote/MEUD.MI/', name: 'Yahoo Finance', date: YA_DATE },
    ],
  },
  mandat: {
    body: '<p>Le STOXX Europe 600 rassemble 600 des plus grandes capitalisations de dix-sept pays d\'Europe, y compris hors zone euro (Royaume-Uni, Suisse, pays nordiques). Il couvre grandes, moyennes et petites capitalisations, pondérées par la capitalisation flottante, avec une révision trimestrielle.</p><p>MEUD le réplique physiquement, en détenant les titres de l\'indice (612 lignes au dernier relevé). Le fonds capitalise les dividendes : ils sont réinvestis plutôt que versés.</p>',
    refs: [{ url: 'https://www.justetf.com/en/etf-profile.html?isin=LU0908500753', name: 'justETF', date: JE_DATE }],
  },
  composition: {
    intro: 'Le portefeuille reflète le haut de la cote européenne : ASML domine, suivi des grandes financières britanniques et des laboratoires suisses.',
    note: '<strong>Ce que dit la structure.</strong> La finance et l\'industrie font près de 44 % du fonds à elles deux ; la technologie reste sous 10 %, très loin de son poids dans un indice américain. C\'est la signature d\'une Europe large : plus cyclique et financière, moins accrochée à quelques géants technologiques.',
    refs: [{ url: 'https://www.justetf.com/en/etf-profile.html?isin=LU0908500753', name: 'justETF', date: JE_DATE }],
  },
  couts: {
    note: '<strong>Le vrai coût.</strong> Au-delà du TER de 0,07 %, comptez l\'écart achat-vente au passage de l\'ordre et le courtage. Le prêt de titres n\'est pas détaillé sur le profil public <span style="color:#94a3b8;">(indisponible)</span> ; il est courant chez les grands émetteurs et peut compenser une part des frais, au prix d\'un risque de contrepartie encadré.',
    refs: [{ url: 'https://www.justetf.com/en/etf-profile.html?isin=LU0908500753', name: 'justETF', date: JE_DATE }],
  },
  tech: {
    last: '316,15 €', low52: '265,65 €', high52: '326,70 €', pos: '≈ 83 % du canal, proche du haut',
    trend: 'haussière, sous le plus haut de 326,70 €',
    note: '<strong>Lecture.</strong> Le fonds évolue dans le tiers supérieur de son canal annuel, à quelques pour cent de son plus haut. Sur un socle de long terme, ces bornes servent surtout à situer un point d\'entrée : renforcer plutôt sur repli vers le bas du canal que près des sommets. Cours relevé sur la ligne de Milan, la page de la ligne de Paris étant momentanément indisponible.',
    refs: [{ url: 'https://finance.yahoo.com/quote/MEUD.MI/', name: 'Yahoo Finance', date: YA_DATE }],
  },
  risks: [
    { title: 'Risque de marché actions', sev: 'medium', icon: 'fa-chart-line', body: 'Un ETF actions suit son marché à la baisse comme à la hausse. Un repli de 20 à 30 % de l\'Europe large se retrouverait presque intégralement dans le fonds.', verdict: 'Exposition assumée : c\'est le prix du rendement actions.' },
    { title: 'Change livre / franc', sev: 'medium', icon: 'fa-money-bill-trend-up', body: 'Environ 36 % du fonds cote hors zone euro (Royaume-Uni 21,7 %, Suisse 14,8 %). Pour un porteur en euros, la performance dépend aussi de la livre et du franc, sans couverture.', verdict: 'Diversification de devises, mais volatilité additionnelle en euros.' },
    { title: 'Concentration du haut de cote', sev: 'low', icon: 'fa-building', body: 'ASML pèse 4,3 % à lui seul et la finance 26,8 %. La pondération par capitalisation fait monter mécaniquement les plus grosses valeurs.', verdict: 'Concentration modérée pour un indice de 612 lignes.' },
    { title: 'Suivi d\'indice et coûts cachés', sev: 'low', icon: 'fa-scale-balanced', body: 'Tracking difference non publiée ici (indisponible) ; l\'écart achat-vente et le courtage s\'ajoutent au TER de 0,07 %.', verdict: 'Coût total très bas, mais non nul.' },
  ],
  risksNote: '<strong>Profil de risque.</strong> Risque de marché actions classique, majoré d\'un risque de change livre/franc pour un porteur en euros. Rien d\'anormal ni de caché : un fonds de socle, à dimensionner selon la part d\'actions Europe voulue.',
  role: {
    body: '<p>MEUD est une brique de fond : une exposition Europe large en une seule ligne, au coût le plus bas. Il se marie avec une poche actions américaines pour couvrir les deux moteurs des marchés développés.</p><p><strong>Recouvrement à surveiller.</strong> Avec un fonds monde (type FTSE All-World / MSCI ACWI), l\'Europe est déjà présente à hauteur de 15 à 20 % ; ajouter MEUD revient à surpondérer l\'Europe — un choix qui peut être délibéré, mais doit être conscient. Avec VWCG (FTSE Developed Europe), le recouvrement est quasi total : les deux fonds tiennent le même rôle, inutile de les cumuler.</p>',
    refs: [{ url: 'https://www.justetf.com/en/etf-profile.html?isin=LU0908500753', name: 'justETF', date: JE_DATE }],
  },
  sources: {
    justetf: { url: 'https://www.justetf.com/en/etf-profile.html?isin=LU0908500753', date: JE_DATE },
    yahoo: { url: 'https://finance.yahoo.com/quote/MEUD.MI/', date: YA_DATE },
    issuer: { name: 'Amundi ETF', url: 'https://www.amundietf.fr', date: ISS_DATE },
  },
};

// ─────────────────────────────────────────── QDVE ───────────────────────────
const QDVE = {
  ticker: 'QDVE', name: 'iShares S&P 500 Information Technology Sector UCITS ETF USD (Acc)',
  isin: 'IE00B3WJKG14', yahooTicker: 'QDVE.DE', exchange: 'Xetra',
  tradingCurrency: 'EUR (fonds en USD)', fundCurrency: 'USD', launchDate: '20 novembre 2015', domicile: 'Irlande',
  index: 'S&P 500 Capped 35/20 Information Technology', indexShort: 'S&P 500 Tech (plafonné)',
  replication: 'Physique', replicationLong: 'Physique (détention directe des 74 titres de l\'indice)',
  distribution: 'Capitalisant', distributionLong: 'Capitalisant : dividendes réinvestis',
  domicileLong: 'Irlande (fonds UCITS) — traité fiscal États-Unis/Irlande favorable sur les dividendes américains',
  ter: '0,15 %', aum: '18,1 Md€', holdingsCount: '74',
  grade: 'B', status: 'satellite',
  dataTags: 'etf,us,tech,semis,ai,software', tagsList: ['etf', 'us', 'tech', 'semis', 'ai', 'software'],
  price: '47,17 €', priceNum: 47.17, changeLabel: '+0,10 % (Yahoo, Xetra)', changeColor: '#16a34a', changePctNum: 0.10,
  securitiesLending: 'Non détaillé sur le profil public <span style="color:#94a3b8;">(indisponible)</span>',
  badges: [
    { text: 'TECH US CONCENTRÉE', color: 'purple' },
    { text: '3 valeurs = 53 % du fonds', color: 'red' },
  ],
  metaDescription: 'QDVE (iShares S&P 500 Technologie) : satellite tech US très concentré — Nvidia, Apple et Microsoft pèsent 53 % du fonds. TER 0,15 %, fonds en USD. Fiche sur données publiques au 28 septembre 2026.',
  ogDescription: 'QDVE : 74 valeurs, mais Nvidia+Apple+Microsoft = 53 %. Tech US, fonds en dollars, +36,8 % sur un an. Satellite, pas socle.',
  dateDisplay: D, date: DISO, levelsCloseDate: DISO,
  cardTitle: 'QDVE — iShares S&P 500 Technologie',
  cardSubtitle: 'Satellite tech US très concentré (Nvidia+Apple+Microsoft = 53 %), fonds en USD. Fiche au 28 septembre 2026.',
  top10: [
    { name: 'Nvidia', weight: '18,76 %' }, { name: 'Apple', weight: '18,55 %' },
    { name: 'Microsoft', weight: '15,66 %' }, { name: 'Broadcom', weight: '7,29 %' },
    { name: 'Micron Technology', weight: '4,49 %' }, { name: 'AMD', weight: '3,19 %' },
    { name: 'Intel', weight: '1,84 %' }, { name: 'Cisco Systems', weight: '1,81 %' },
    { name: 'Palantir Technologies', weight: '1,78 %' }, { name: 'Lam Research', weight: '1,57 %' },
  ],
  holdingsChart: [
    { name: 'Nvidia', value: 18.76 }, { name: 'Apple', value: 18.55 }, { name: 'Microsoft', value: 15.66 },
    { name: 'Broadcom', value: 7.29 }, { name: 'Micron', value: 4.49 }, { name: 'AMD', value: 3.19 },
    { name: 'Intel', value: 1.84 }, { name: 'Cisco', value: 1.81 }, { name: 'Palantir', value: 1.78 },
    { name: 'Lam Research', value: 1.57 },
  ],
  sectors: [
    { name: 'Technologie', pct: '96,99 %' }, { name: 'Services aux entreprises', pct: '1,96 %' },
    { name: 'Matériaux', pct: '0,59 %' }, { name: 'Industrie', pct: '0,28 %' }, { name: 'Autres', pct: '0,18 %' },
  ],
  sectorsChart: [
    { name: 'Technologie', value: 96.99 }, { name: 'Services aux entreprises', value: 1.96 },
    { name: 'Matériaux', value: 0.59 }, { name: 'Industrie', value: 0.28 }, { name: 'Autres', value: 0.18 },
  ],
  countries: [
    { name: 'États-Unis', pct: '98,08 %' }, { name: 'Autres', pct: '1,92 %' },
  ],
  perf: {
    ytd: '+32,75 %', y1: '+36,75 %', y3: '+136,81 %', since: '+904,68 %', vol: '23,27 %',
    note: '<strong>Performance portée par le haut du classement.</strong> Le rendement suit celui de quelques méga-capitalisations : quand Nvidia ou Apple corrige, l\'ETF entier bouge. La performance depuis 2015 (+905 %) reflète un cycle exceptionnel, pas une garantie. Tracking difference précise non publiée ici <span style="color:#94a3b8;">(indisponible)</span>.',
    refs: [{ url: 'https://www.justetf.com/en/etf-profile.html?isin=IE00B3WJKG14', name: 'justETF', date: JE_DATE }],
  },
  perfChart: [32.75, 36.75, 136.81],
  verdict: {
    label: 'Pari sectoriel tech US, à doser comme un satellite',
    summary: 'QDVE réplique le secteur technologie du S&P 500 : 74 valeurs, mais Nvidia (18,8 %), Apple (18,6 %) et Microsoft (15,7 %) pèsent à elles seules 53 % du fonds. C\'est une brique de performance, pas de diversification. Sur un an, +36,8 % ; frais de 0,15 %, réplication physique, part capitalisante. Le fonds est libellé en dollars : l\'investisseur en euros porte le risque de change, où que la part cote.',
    pros: [
      'Exposition directe au moteur qui a tiré les indices américains : semi-conducteurs, logiciels, matériel.',
      'Frais de 0,15 %, raisonnables pour un ETF sectoriel ; réplication physique des 74 titres.',
      'Performance de +136,8 % sur trois ans, reflet du cycle IA et de la domination des méga-capitalisations.',
    ],
    cons: [
      'Concentration extrême : trois valeurs font 53 % du fonds, le sommet du classement dicte la performance.',
      'Volatilité de 23,3 % sur un an, presque le double d\'un indice Europe large — les corrections y sont plus violentes.',
      'Fonds en dollars, non couvert : une baisse du dollar face à l\'euro ampute la performance en euros, indépendamment des actions.',
      '98 % américain, 97 % technologie : aucun amortisseur sectoriel ni géographique.',
    ],
    forWho: 'L\'investisseur qui veut surpondérer la tech US en connaissance de cause, en satellite d\'un cœur diversifié. À doser : renforcer relève le risque du portefeuille entier ; alléger est un arbitrage de prudence si la poche tech est devenue trop lourde après le rallye.',
    refs: [
      { url: 'https://www.justetf.com/en/etf-profile.html?isin=IE00B3WJKG14', name: 'justETF', date: JE_DATE },
      { url: 'https://finance.yahoo.com/quote/QDVE.DE/', name: 'Yahoo Finance', date: YA_DATE },
    ],
  },
  mandat: {
    body: '<p>L\'indice isole le secteur des technologies de l\'information du S&P 500, puis applique un plafonnement (dit 35/20) destiné à respecter les limites de diversification des fonds UCITS : il bride la plus grosse ligne et la somme des plus grosses positions. Il en résulte 74 valeurs, dominées par une poignée de méga-capitalisations.</p><p>QDVE le réplique physiquement. La part est capitalisante : les dividendes, modestes dans la tech, sont réinvestis.</p>',
    refs: [{ url: 'https://www.justetf.com/en/etf-profile.html?isin=IE00B3WJKG14', name: 'justETF', date: JE_DATE }],
  },
  composition: {
    intro: 'Le fonds est un concentré de méga-capitalisations technologiques américaines. Le trio de tête suffit à faire plus de la moitié du portefeuille.',
    note: '<strong>La concentration est le sujet.</strong> Avec Nvidia, Apple et Microsoft à 53 % réunis, QDVE se comporte presque comme un panier de trois actions complété de 71 satellites. La technologie représente 97 % du fonds et les États-Unis 98 % : ni secteur refuge, ni diversification géographique.',
    refs: [{ url: 'https://www.justetf.com/en/etf-profile.html?isin=IE00B3WJKG14', name: 'justETF', date: JE_DATE }],
  },
  couts: {
    note: '<strong>Coût et fiscalité.</strong> TER de 0,15 %, correct pour un ETF sectoriel. Le domicile irlandais réduit la retenue à la source américaine sur les dividendes (15 % au lieu de 30 %), un avantage structurel des UCITS irlandais sur les actions américaines. Écart achat-vente et courtage s\'ajoutent au TER.',
    refs: [{ url: 'https://www.justetf.com/en/etf-profile.html?isin=IE00B3WJKG14', name: 'justETF', date: JE_DATE }],
  },
  tech: {
    last: '47,17 €', low52: '31,88 €', high52: '47,27 €', pos: '≈ 99 % du canal, sur son plus haut',
    trend: 'haussière marquée, au contact du plus haut annuel',
    note: '<strong>Lecture.</strong> Le fonds cote sur son plus haut de 52 semaines, après avoir gagné près de 48 % depuis le bas de 31,88 €. Acheter au sommet d\'un secteur déjà très porté augmente le risque de repli à court terme ; un satellite tech se construit de préférence par étapes, pas en une fois près des records.',
    refs: [{ url: 'https://finance.yahoo.com/quote/QDVE.DE/', name: 'Yahoo Finance', date: YA_DATE }],
  },
  risks: [
    { title: 'Concentration extrême', sev: 'high', icon: 'fa-building', body: 'Trois valeurs (Nvidia, Apple, Microsoft) pèsent 53 % du fonds. Un accident sur l\'une d\'elles se répercute directement sur l\'ETF.', verdict: 'Le risque n°1 : ce n\'est pas un fonds diversifié.' },
    { title: 'Change dollar / euro', sev: 'high', icon: 'fa-money-bill-trend-up', body: 'Fonds libellé en dollars, non couvert. Une baisse de 10 % du dollar face à l\'euro retranche environ 10 % à la performance en euros, quoi que fassent les actions.', verdict: 'Risque de change plein, à intégrer au dimensionnement.' },
    { title: 'Volatilité sectorielle', sev: 'high', icon: 'fa-rocket', body: 'Volatilité de 23,3 % sur un an. La tech corrige plus fort et plus vite que le marché large ; les baisses de 20 à 30 % y sont récurrentes.', verdict: 'Réservé à un horizon long et à une taille maîtrisée.' },
    { title: 'Valorisation après rallye', sev: 'medium', icon: 'fa-scale-balanced', body: 'Le fonds cote sur son plus haut après +137 % en trois ans. Une part de la hausse anticipe déjà l\'essor de l\'IA.', verdict: 'Entrer par étapes plutôt qu\'en une fois.' },
  ],
  risksNote: '<strong>Profil de risque.</strong> Élevé et assumé : concentration, change dollar et volatilité sectorielle se cumulent. QDVE amplifie les mouvements du marché dans les deux sens. Un moteur de performance à tenir en satellite, pas un fonds de socle.',
  role: {
    body: '<p>QDVE est un satellite de performance, pas un cœur de portefeuille. Sa place logique : une poche limitée (souvent 5 à 15 % selon le profil) posée sur un socle diversifié, pour surpondérer volontairement la technologie américaine.</p><p><strong>Recouvrement à surveiller.</strong> Un fonds S&P 500 ou monde contient déjà 30 à 35 % de technologie et détient les mêmes Nvidia, Apple, Microsoft. Ajouter QDVE double la mise sur ces valeurs : l\'exposition réelle à la tech peut vite dépasser ce que l\'on croit. À croiser avec les lignes déjà détenues avant tout renforcement.</p>',
    refs: [{ url: 'https://www.justetf.com/en/etf-profile.html?isin=IE00B3WJKG14', name: 'justETF', date: JE_DATE }],
  },
  sources: {
    justetf: { url: 'https://www.justetf.com/en/etf-profile.html?isin=IE00B3WJKG14', date: JE_DATE },
    yahoo: { url: 'https://finance.yahoo.com/quote/QDVE.DE/', date: YA_DATE },
    issuer: { name: 'iShares (BlackRock)', url: 'https://www.ishares.com', date: ISS_DATE },
  },
};

// ─────────────────────────────────────────── VWCG ───────────────────────────
const VWCG = {
  ticker: 'VWCG', name: 'Vanguard FTSE Developed Europe UCITS ETF (EUR) Accumulating',
  isin: 'IE00BK5BQX27', yahooTicker: 'VWCG.DE', exchange: 'Xetra / London Stock Exchange',
  tradingCurrency: 'EUR', fundCurrency: 'EUR', launchDate: '23 juillet 2019', domicile: 'Irlande',
  index: 'FTSE Developed Europe', indexShort: 'FTSE Developed Europe',
  replication: 'Physique', replicationLong: 'Physique (détention directe des 512 titres)',
  distribution: 'Capitalisant', distributionLong: 'Capitalisant : dividendes réinvestis',
  domicileLong: 'Irlande (fonds UCITS)',
  ter: '0,10 %', aum: '3,0 Md€', holdingsCount: '512',
  grade: 'A-', status: 'conserver',
  dataTags: 'etf,eu,europe,financials,healthcare', tagsList: ['etf', 'eu', 'europe', 'financials', 'healthcare'],
  price: '59,62 €', priceNum: 59.62, changeLabel: '+0,17 % (Yahoo, Xetra)', changeColor: '#16a34a', changePctNum: 0.17,
  securitiesLending: 'Non détaillé sur le profil public <span style="color:#94a3b8;">(indisponible)</span>',
  badges: [
    { text: 'CŒUR ACTIONS EUROPE', color: 'blue' },
    { text: 'Signature Vanguard, TER 0,10 %', color: 'green' },
  ],
  metaDescription: 'VWCG (Vanguard FTSE Developed Europe) : cœur actions Europe développée, 512 valeurs, TER 0,10 %, part capitalisante. Composition quasi identique à MEUD. Fiche sur données publiques au 28 septembre 2026.',
  ogDescription: 'VWCG : 512 valeurs Europe développée, 0,10 % de frais, +19,4 % sur un an. Quasi jumeau de MEUD — choisir l\'un, pas les deux.',
  dateDisplay: D, date: DISO, levelsCloseDate: DISO,
  cardTitle: 'VWCG — Vanguard FTSE Developed Europe',
  cardSubtitle: 'Cœur actions Europe développée, TER 0,10 %, quasi jumeau de MEUD. Fiche au 28 septembre 2026.',
  top10: [
    { name: 'ASML Holding', weight: '4,29 %' }, { name: 'HSBC Holdings', weight: '2,35 %' },
    { name: 'Roche Holding', weight: '2,03 %' }, { name: 'Novartis', weight: '1,88 %' },
    { name: 'Shell', weight: '1,68 %' }, { name: 'Nestlé', weight: '1,66 %' },
    { name: 'Siemens', weight: '1,61 %' }, { name: 'AstraZeneca', weight: '1,61 %' },
    { name: 'SAP', weight: '1,51 %' }, { name: 'Banco Santander', weight: '1,44 %' },
  ],
  holdingsChart: [
    { name: 'ASML', value: 4.29 }, { name: 'HSBC', value: 2.35 }, { name: 'Roche', value: 2.03 },
    { name: 'Novartis', value: 1.88 }, { name: 'Shell', value: 1.68 }, { name: 'Nestlé', value: 1.66 },
    { name: 'Siemens', value: 1.61 }, { name: 'AstraZeneca', value: 1.61 }, { name: 'SAP', value: 1.51 },
    { name: 'Santander', value: 1.44 },
  ],
  sectors: [
    { name: 'Finance', pct: '26,56 %' }, { name: 'Industrie', pct: '16,54 %' },
    { name: 'Santé', pct: '11,62 %' }, { name: 'Technologie', pct: '9,41 %' }, { name: 'Autres', pct: '35,87 %' },
  ],
  sectorsChart: [
    { name: 'Finance', value: 26.56 }, { name: 'Industrie', value: 16.54 }, { name: 'Santé', value: 11.62 },
    { name: 'Technologie', value: 9.41 }, { name: 'Autres', value: 35.87 },
  ],
  countries: [
    { name: 'Royaume-Uni', pct: '21,22 %' }, { name: 'Suisse', pct: '14,84 %' },
    { name: 'Allemagne', pct: '13,26 %' }, { name: 'France', pct: '13,07 %' }, { name: 'Autres', pct: '37,61 %' },
  ],
  perf: {
    ytd: '+10,45 %', y1: '+19,36 %', y3: '+54,60 %', since: '+97,93 %', vol: '12,22 %',
    note: '<strong>Une performance calquée sur MEUD.</strong> À trois ans, VWCG (+54,6 %) et MEUD (+54,7 %) sont pratiquement indissociables : même Europe, même moteur. L\'écart de 3 points de base de frais joue à la marge sur le long terme. Tracking difference précise non publiée ici <span style="color:#94a3b8;">(indisponible)</span>.',
    refs: [{ url: 'https://www.justetf.com/en/etf-profile.html?isin=IE00BK5BQX27', name: 'justETF', date: JE_DATE }],
  },
  perfChart: [10.45, 19.36, 54.60],
  verdict: {
    label: 'Cœur actions Europe développée, quasi jumeau de MEUD',
    summary: 'VWCG réplique le FTSE Developed Europe : 512 grandes et moyennes valeurs des marchés européens développés, part capitalisante, 0,10 % de frais. Sa composition est presque identique à celle du STOXX Europe 600 — mêmes ASML, HSBC, Roche, Nestlé en tête. Sur un an, +19,4 %. Un cœur Europe solide, signé Vanguard, mais qui fait double emploi avec un autre fonds Europe large.',
    pros: [
      'Réplication physique de 512 titres, part capitalisante, gestion Vanguard reconnue pour son suivi d\'indice.',
      'Frais de 0,10 %, très bas pour une exposition Europe développée en une ligne.',
      'Diversification large : finance 26,6 %, industrie 16,5 %, santé 11,6 %, sur les principaux marchés européens.',
    ],
    cons: [
      'Encours de 3,0 Md€, plus modeste que les mastodontes du segment — liquidité correcte mais inférieure.',
      'Frais de 0,10 %, soit 3 points de base de plus que le moins cher du segment (MEUD à 0,07 %).',
      'Comme tout fonds Europe large, forte exposition livre/franc (Royaume-Uni 21,2 %, Suisse 14,8 %) pour un porteur en euros.',
    ],
    forWho: 'L\'investisseur qui veut un cœur Europe développée à bas coût dans l\'univers Vanguard. À conserver comme socle ; mais détenir VWCG et MEUD en même temps est inutile — ils font le même travail. Choisir l\'un, pas les deux.',
    refs: [
      { url: 'https://www.justetf.com/en/etf-profile.html?isin=IE00BK5BQX27', name: 'justETF', date: JE_DATE },
      { url: 'https://finance.yahoo.com/quote/VWCG.DE/', name: 'Yahoo Finance', date: YA_DATE },
    ],
  },
  mandat: {
    body: '<p>Le FTSE Developed Europe regroupe environ 500 grandes et moyennes capitalisations des marchés européens classés « développés » par FTSE : zone euro, Royaume-Uni, Suisse, pays nordiques. Un périmètre très proche du STOXX Europe 600, avec des règles de classement et de révision différentes.</p><p>VWCG le réplique physiquement (512 lignes). Part capitalisante : les dividendes sont réinvestis, ce qui sert une logique de croissance du capital plutôt que de revenu.</p>',
    refs: [{ url: 'https://www.justetf.com/en/etf-profile.html?isin=IE00BK5BQX27', name: 'justETF', date: JE_DATE }],
  },
  composition: {
    intro: 'Le portefeuille est celui de l\'Europe des grandes valeurs : ASML en tête, suivi des banques britanniques et des laboratoires suisses — presque le même ordre que le STOXX Europe 600.',
    note: '<strong>Un quasi-jumeau.</strong> Les dix premières lignes et les poids sectoriels de VWCG sont presque calqués sur ceux de MEUD : les deux indices couvrent la même Europe des grandes capitalisations. Détenir les deux n\'apporte pas de diversification, seulement de la redondance.',
    refs: [{ url: 'https://www.justetf.com/en/etf-profile.html?isin=IE00BK5BQX27', name: 'justETF', date: JE_DATE }],
  },
  couts: {
    note: '<strong>Le vrai coût.</strong> TER de 0,10 %, soit 3 points de base au-dessus de MEUD (0,07 %) — un écart minime mais réel sur le long terme, à mettre en regard de l\'univers Vanguard et de la qualité de suivi. Écart achat-vente et courtage s\'ajoutent.',
    refs: [{ url: 'https://www.justetf.com/en/etf-profile.html?isin=IE00BK5BQX27', name: 'justETF', date: JE_DATE }],
  },
  tech: {
    last: '59,62 €', low52: '50,16 €', high52: '61,77 €', pos: '≈ 81 % du canal',
    trend: 'haussière, sous le plus haut de 61,77 €',
    note: '<strong>Lecture.</strong> Le fonds évolue dans le tiers supérieur de son canal annuel, non loin de son plus haut. Comme brique de socle, ces bornes servent à situer un point d\'entrée : privilégier les replis vers le bas du canal pour renforcer.',
    refs: [{ url: 'https://finance.yahoo.com/quote/VWCG.DE/', name: 'Yahoo Finance', date: YA_DATE }],
  },
  risks: [
    { title: 'Risque de marché actions', sev: 'medium', icon: 'fa-chart-line', body: 'Fonds actions : il suit l\'Europe développée à la hausse comme à la baisse, sans amortisseur.', verdict: 'Exposition assumée, prix du rendement actions.' },
    { title: 'Change livre / franc', sev: 'medium', icon: 'fa-money-bill-trend-up', body: 'Le Royaume-Uni (21,2 %) et la Suisse (14,8 %) cotent hors euro. La performance en euros dépend aussi de la livre et du franc, sans couverture.', verdict: 'Volatilité de change additionnelle pour un porteur en euros.' },
    { title: 'Redondance avec MEUD', sev: 'medium', icon: 'fa-code-branch', body: 'Composition quasi identique à MEUD (STOXX Europe 600). Détenir les deux ne diversifie pas, cela double une même exposition à des frais un peu plus élevés.', verdict: 'Choisir l\'un des deux, pas les deux.' },
    { title: 'Encours plus modeste', sev: 'low', icon: 'fa-water', body: '3,0 Md€ d\'encours, contre plus de 20 Md€ pour les plus gros du segment. Liquidité correcte, mais écart achat-vente potentiellement un peu plus large aux heures creuses.', verdict: 'Passer les ordres aux heures de forte liquidité.' },
  ],
  risksNote: '<strong>Profil de risque.</strong> Risque de marché actions Europe et de change livre/franc, standards du segment. Le vrai point d\'attention n\'est pas le fonds lui-même mais son recouvrement avec un autre fonds Europe large déjà détenu.',
  role: {
    body: '<p>VWCG joue le même rôle de socle que MEUD : une exposition Europe développée en une ligne, à bas coût, capitalisante. Il complète naturellement une poche actions américaines pour couvrir les deux grands moteurs des marchés développés.</p><p><strong>Recouvrement à surveiller.</strong> Avec MEUD, le recouvrement est quasi total : même Europe, mêmes premières lignes, même performance. Il faut choisir entre les deux (coût, écosystème, plan d\'épargne disponible), pas les cumuler. Avec un fonds monde, l\'Europe est déjà présente à 15 à 20 % : ajouter VWCG surpondère volontairement l\'Europe.</p>',
    refs: [{ url: 'https://www.justetf.com/en/etf-profile.html?isin=IE00BK5BQX27', name: 'justETF', date: JE_DATE }],
  },
  sources: {
    justetf: { url: 'https://www.justetf.com/en/etf-profile.html?isin=IE00BK5BQX27', date: JE_DATE },
    yahoo: { url: 'https://finance.yahoo.com/quote/VWCG.DE/', date: YA_DATE },
    issuer: { name: 'Vanguard', url: 'https://www.vanguard.co.uk', date: ISS_DATE },
  },
};

const ALL = [MEUD, QDVE, VWCG];
for (const d of ALL) {
  const dir = path.join(ROOT, 'analyses', d.ticker);
  fs.mkdirSync(dir, { recursive: true });
  const html = buildHtml(d);
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
  const card = buildCard(d);
  fs.writeFileSync(path.join(ROOT, 'data', 'analyses-data', d.ticker + '.json'), JSON.stringify(card, null, 2) + '\n', 'utf8');
  console.log(`✓ ${d.ticker} — ${(html.length / 1024).toFixed(1)} KB HTML + carte JSON`);
}
console.log('Fait.');
