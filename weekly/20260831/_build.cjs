#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const rel = p => path.join('weekly/20260831', p);
const read = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, p))).digest('hex');

const sources = {
  indices: rel('_data/bars_indices.json'),
  sectors: rel('_data/bars_sectors.json'),
  crypto: rel('_data/bars_crypto.json'),
  options: rel('_data/options_sentiment.json'),
  regime: rel('_data/regime_systematic.json'),
  earnings: rel('_data/earnings_calendar.json'),
  technicals: rel('_focus/focus_technicals.json')
};
const data = Object.fromEntries(Object.entries(sources).map(([key, file]) => [key, read(file)]));
const hashes = Object.fromEntries(Object.entries(sources).map(([key, file]) => [key, sha(file)]));
const claims = [];

function pointerGet(value, pointer) {
  return pointer.slice(1).split('/').reduce((node, raw) => node[raw.replace(/~1/g, '/').replace(/~0/g, '~')], value);
}

function claim(id, source, pointer, render) {
  const value = pointerGet(data[source], pointer);
  const scaled = value * render.scale;
  const sign = render.sign === 'always' && scaled >= 0 ? '+' : '';
  const rendered = `${render.prefix || ''}${sign}${scaled.toFixed(render.decimals)}${render.suffix || ''}`;
  claims.push({
    id,
    source_artifact: sources[source],
    source_sha256: hashes[source],
    source_pointer: pointer,
    source_value: value,
    render,
    rendered_text: rendered
  });
  return `<span data-claim="${id}">${rendered}</span>`;
}

function marketClaim(id, source, symbol, render) {
  const root = data[source].results[0];
  const row = root.symbols.indexOf(symbol);
  const bar = root.data[row].bars.length - 1;
  return claim(id, source, `/results/0/data/${row}/bars/${bar}/4`, render);
}

function earningsClaim(id, symbol) {
  const row = data.earnings.events.findIndex(event => event.symbol === symbol);
  return claim(id, 'earnings', `/events/${row}/implied_move_pct`, { scale: 1, decimals: 1, suffix: ' %' });
}

function technicalClaim(id, symbol, field, render) {
  const resultIndex = field === 'price' ? 0 : 1;
  const rows = data.technicals.data.items[0].results[resultIndex].data;
  const row = rows.findIndex(item => item.symbol === symbol);
  return claim(id, 'technicals', `/data/items/0/results/${resultIndex}/data/${row}/${field}`, render);
}

const euro = { scale: 1, decimals: 2, suffix: ' $' };
const one = { scale: 1, decimals: 1 };
const marketCards = [
  ['SPY', 'Large caps US', marketClaim('spy_close', 'indices', 'SPY', euro)],
  ['QQQ', 'Croissance US', marketClaim('qqq_close', 'indices', 'QQQ', euro)],
  ['IWM', 'Petites capitalisations', marketClaim('iwm_close', 'indices', 'IWM', euro)],
  ['DIA', 'Industrielles US', marketClaim('dia_close', 'indices', 'DIA', euro)],
  ['GLD', 'Or coté', marketClaim('gld_close', 'indices', 'GLD', euro)],
  ['SLV', 'Argent coté', marketClaim('slv_close', 'indices', 'SLV', euro)],
  ['TLT', 'Obligations longues', marketClaim('tlt_close', 'indices', 'TLT', euro)],
  ['USO', 'Pétrole coté', marketClaim('uso_close', 'indices', 'USO', euro)]
];
const cryptoCards = [
  ['IBIT', 'Proxy Bitcoin', marketClaim('ibit_close', 'crypto', 'IBIT', euro)],
  ['ETHA', 'Proxy Ether', marketClaim('etha_close', 'crypto', 'ETHA', euro)],
  ['SOLZ', 'Proxy Solana', marketClaim('solz_close', 'crypto', 'SOLZ', euro)]
];
const earningsRows = [
  ['Mardi après clôture', 'DELL', 'Serveurs, stockage et demande datacenter', earningsClaim('dell_move', 'DELL')],
  ['Mardi après clôture', 'PANW', 'Budgets cyber et plateforme', earningsClaim('panw_move', 'PANW')],
  ['Mardi après clôture', 'MDB', 'Données applicatives et consommation cloud', earningsClaim('mdb_move', 'MDB')],
  ['Mardi après clôture', 'CRDO', 'Connectivité haut débit pour l’IA', earningsClaim('crdo_move', 'CRDO')],
  ['Mercredi après clôture', 'SNOW', 'Consommation de données dans le cloud', earningsClaim('snow_move', 'SNOW')],
  ['Mercredi après clôture', 'HPE', 'Infrastructure entreprise et serveurs', earningsClaim('hpe_move', 'HPE')],
  ['Jeudi avant ouverture', 'CIEN', 'Réseaux optiques et trafic datacenter', earningsClaim('cien_move', 'CIEN')],
  ['Jeudi après clôture', 'ZS', 'Demande cyber et adoption de plateforme', earningsClaim('zs_move', 'ZS')]
];
const technicalRows = ['DELL', 'MDB', 'SNOW', 'PANW', 'CRDO', 'HPE', 'CIEN', 'ZS'].map(symbol => {
  const key = symbol.toLowerCase();
  return [
    symbol,
    technicalClaim(`${key}_price`, symbol, 'price', euro),
    technicalClaim(`${key}_ema`, symbol, 'ema20', euro),
    technicalClaim(`${key}_rsi`, symbol, 'rsi', one)
  ];
});

const allSeries = {};
for (const source of ['indices', 'sectors', 'crypto']) {
  const root = data[source].results[0];
  root.symbols.forEach((symbol, index) => {
    allSeries[symbol] = root.data[index].bars.slice(-260).map(bar => [bar[0], bar[4]]);
  });
}

const cards = marketCards.map(([ticker, label, value]) => `<div class="metric-card"><div class="metric-value">${value}</div><div class="metric-label">${ticker} · ${label}</div></div>`).join('');
const cryptoCardsHtml = cryptoCards.map(([ticker, label, value]) => `<div class="metric-card"><div class="metric-value">${value}</div><div class="metric-label">${ticker} · ${label}</div></div>`).join('');
const earn = earningsRows.map(row => `<tr><td>${row[0]}</td><td><strong>${row[1]}</strong></td><td>${row[2]}</td><td>${row[3]}</td></tr>`).join('');
const tech = technicalRows.map(row => `<tr><td><strong>${row[0]}</strong></td><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td><td>${Number(row[1].replace(/<[^>]+>| \$/g, '')) > Number(row[2].replace(/<[^>]+>| \$/g, '')) ? 'Au-dessus' : 'Sous la moyenne'}</td></tr>`).join('');

let html = `<!DOCTYPE html>
<html lang="fr" dir="ltr" data-level="intermediate" data-tags="us,crypto,commodity,macro,earnings,ai,cloud,cybersecurity,semis,etf" data-tab="weekly">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>DailyTickers | Semaine à venir : l’IA face au test de diffusion et à l’emploi</title>
<meta name="description" content="Weekly français : marché étroit, test de diffusion de l’IA via Dell, MongoDB, Snowflake, Palo Alto, Credo, HPE, Ciena et Zscaler, puis rapport emploi. Scénarios et plan d’action.">
<meta property="og:title" content="L’IA face au test de diffusion et à l’emploi"><meta property="og:description" content="Une semaine pour vérifier si le capex IA se transforme en revenus hardware, cloud et cyber, avant le verdict de l’emploi."><meta property="og:image" content="https://articles.dailytickers.com/favicon.ico"><meta property="og:url" content="https://articles.dailytickers.com/weekly/20260831/"><meta property="og:type" content="article">
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-T5Z595CW');</script>
<link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/assets/report.css"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"><script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
</head><body>
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-T5Z595CW" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<nav class="brand-bar"><div class="brand-bar-inner"><a href="/" class="brand-logo"><img src="/logo.svg" alt="" width="36" height="36"><span class="brand-title">DailyTickers</span></a><div class="brand-nav"><a href="/?tab=weekly">Hebdo</a><a href="/?tab=daily">Daily</a><a href="/?tab=analyses">Analyses</a><a href="/?tab=scanner">Scanner</a><a href="/?tab=radar">Radar</a><a href="/?tab=series">Séries</a></div><div class="brand-actions"><a href="/" class="brand-home-btn" title="Accueil"><i class="fas fa-house"></i></a></div></div></nav>
<div class="fnav"><a href="#alerte" title="Alerte"><i class="fas fa-bell"></i></a><a href="#marches" title="Marchés"><i class="fas fa-chart-line"></i></a><a href="#metaux" title="Métaux et crypto"><i class="fab fa-bitcoin"></i></a><a href="#allocation" title="Allocation"><i class="fas fa-scale-balanced"></i></a><a href="#outlook" title="Scénarios"><i class="fas fa-compass"></i></a><a href="#sources" title="Sources"><i class="fas fa-book"></i></a></div>
<section class="hero-section"><div class="container"><div class="hero-date">Semaine du lundi au vendredi · Clôture de référence vendredi</div><h1 class="hero-title">L’IA face au test de diffusion et à l’emploi</h1><p class="hero-subtitle">Les indices tiennent, mais la participation se rétrécit. Dell, MongoDB, Snowflake, Palo Alto, Credo, HPE, Ciena et Zscaler diront si la demande IA descend réellement des puces vers les serveurs, les données et la cybersécurité. Le rapport emploi décidera ensuite si les taux laissent respirer ce mouvement.</p><div class="hero-badges"><span class="hero-badge">Régime favorable, largeur fragile</span><span class="hero-badge">Test hardware, cloud et cyber</span><span class="hero-badge">Emploi vendredi</span></div><div id="article-clickable-tags" class="card-tags"></div></div></section>
<main class="container" id="main-content">
<section class="alert-banner" id="alerte"><div><strong>ALERTE DE LA SEMAINE</strong><p>Ne pas confondre un bon résultat avec une bonne entrée. Les options anticipent déjà de grands écarts sur les leaders : attendre la réaction, la tenue du prix moyen de séance et une base après publication. Le rapport emploi peut invalider jeudi soir une lecture pourtant correcte des résultats.</p></div></section>

<section class="content-card" id="calendrier"><h2>Calendrier de la semaine</h2><div class="table-responsive"><table class="data-table"><thead><tr><th>Jour</th><th>Macro</th><th>Résultats</th><th>Décision</th></tr></thead><tbody><tr><td>Lundi</td><td>Inflation en zone euro</td><td>Pas de publication majeure dans le groupe suivi</td><td>Préparer les comparaisons croisées sans anticiper les résultats.</td></tr><tr><td>Mardi</td><td>Activité manufacturière américaine et intervention de la Fed</td><td>DELL, PANW, MDB et CRDO après clôture</td><td>Premier test commun du hardware, des données et de la cyber.</td></tr><tr><td>Mercredi</td><td>Transition vers les données d’emploi</td><td>SNOW et HPE après clôture</td><td>Comparer consommation cloud et dépenses d’infrastructure.</td></tr><tr><td>Jeudi</td><td>Demandes d’allocations, services américains et intervention de la Fed</td><td>CIEN avant ouverture, ZS après clôture</td><td>Vérifier la confirmation réseau et cyber ; réduire les échecs.</td></tr><tr><td>Vendredi</td><td>Rapport emploi américain</td><td>Pas de catalyseur micro dominant</td><td>Le taux et le dollar priment sur les récits sectoriels.</td></tr></tbody></table></div><div class="pedagogy-box"><strong>Ordre de lecture :</strong> résultats d’abord, confirmation sectorielle ensuite, macro en dernier. Une réaction isolée ne valide pas toute la chaîne IA.</div></section>

<section class="content-card" id="synthese"><h2>Synthèse exécutive</h2><div class="metrics-grid">${cards}</div><p>Le régime systématique reste <strong>${data.regime.regime}</strong>, avec un score de ${claim('regime_score', 'regime', '/regime_score', { scale: 100, decimals: 0, suffix: ' %' })}. Le VIX clôture à ${claim('vix_level', 'options', '/items/1/level', { scale: 1, decimals: 2 })}, sous sa moyenne récente, tandis que la volatilité à moyen terme reste plus chère que la volatilité immédiate. Ce n’est pas une structure de panique.</p><p>Le paradoxe est ailleurs : les grands indices progressent légèrement, mais les petites capitalisations et la majorité des secteurs reculent. La hausse repose donc sur peu de poches. Cela autorise des achats sélectifs après confirmation ; cela ne justifie pas une exposition aveugle au marché.</p><div class="pedagogy-box"><strong>En langage simple :</strong> la marée ne monte pas pour tous les bateaux. Quelques grands titres gardent les indices en surface pendant qu’une grande partie du marché fatigue.</div></section>

<section class="content-card" id="bilan"><h2>Bilan de la semaine précédente</h2><p>La thèse précédente privilégiait les actifs réels et la crypto face à la duration technologique. Elle n’a pas tenu proprement : l’or, l’argent et le pétrole ont reculé, les proxies Bitcoin et Ether n’ont offert qu’une progression limitée, tandis que la technologie et les services de communication ont mené. Le proxy Solana a fait exception avec une nette accélération.</p><div class="table-responsive"><table class="data-table"><thead><tr><th>Anticipation</th><th>Observation</th><th>Verdict</th><th>Leçon</th></tr></thead><tbody><tr><td>Leadership des actifs réels</td><td>Métaux et pétrole en retrait</td><td><span class="badge badge-red">Invalidée</span></td><td>Ne pas prolonger un récit sans confirmation inter-marchés.</td></tr><tr><td>Pression persistante sur la technologie</td><td>Technologie en tête</td><td><span class="badge badge-red">Invalidée</span></td><td>Le signal des résultats a repris le dessus sur le facteur duration.</td></tr><tr><td>Appétit crypto généralisé</td><td>Dispersion forte entre proxies</td><td><span class="badge badge-yellow">Partielle</span></td><td>Traiter chaque segment, pas “la crypto” comme un bloc.</td></tr></tbody></table></div><p><strong>Trades précédents :</strong> aucun score n’est publié ici sans reconstruction certifiée des fills, des fenêtres et des sorties. Transformer une zone théorique en performance serait trompeur. La présente édition repart donc avec <code>no_setup</code>.</p></section>

<section class="content-card" id="marches"><h2>Contexte macro et marchés</h2><h3>Actions américaines</h3><p>SPY, QQQ et DIA terminent près de leurs sommets récents, alors que IWM recule. La qualité et la taille restent préférées à la cyclicité domestique. Un rallye durable demanderait que les petites capitalisations cessent de sous-performer.</p><div class="chart-container"><div class="chart-title">Indices et actifs de couverture · base normalisée</div><div id="marketChart" class="chart-host"></div></div><h3>Taux et volatilité</h3><p>TLT a progressé pendant que l’énergie et les métaux reculaient. Avec un VIX court à ${claim('vix9d', 'options', '/items/0/level', { scale: 1, decimals: 2 })}, un VIX principal à ${claim('vix30d', 'options', '/items/1/level', { scale: 1, decimals: 2 })} et un VIX trimestriel à ${claim('vix3m', 'options', '/items/2/level', { scale: 1, decimals: 2 })}, la courbe reste en contango. Le marché paie davantage la protection future que le danger immédiat.</p><h3>International</h3><p>L’inflation européenne ouvre la semaine, mais le centre de gravité reste américain. Sans panier international certifié dans cette collecte, cette édition ne publie ni classement européen ni faux signal global. La décision vient des taux américains, de l’emploi et des résultats d’entreprise.</p></section>

<section class="content-card" id="metaux"><h2>Métaux précieux et énergie</h2><p>GLD clôture à ${marketClaim('gld_close_detail', 'indices', 'GLD', euro)} et SLV à ${marketClaim('slv_close_detail', 'indices', 'SLV', euro)} après une semaine de baisse. USO termine à ${marketClaim('uso_close_detail', 'indices', 'USO', euro)}. La lecture commune est défensive : moins de pression inflationniste immédiate, mais aussi moins d’enthousiasme pour le cycle nominal.</p><p>Le bon réflexe n’est pas d’acheter mécaniquement la baisse. Pour redevenir constructifs, l’or et l’argent doivent d’abord cesser de sous-performer les obligations longues. Pour l’énergie, une stabilisation du pétrole doit précéder tout pari sur les producteurs.</p><div class="alert-box"><strong>Invalidation :</strong> si les taux remontent après l’emploi mais que l’or ne retrouve pas de force relative, le métal n’agit plus comme protection efficace. Dans ce cas, le cash et les obligations courtes sont des outils plus propres.</div></section>

<section class="content-card" id="crypto"><h2>Crypto et bêta élevée associée</h2><div class="metrics-grid">${cryptoCardsHtml}</div><p>Les données spot disponibles étaient incomplètes pour la clôture de référence ; elles ont donc été exclues. Les lectures publiées utilisent uniquement des ETF américains alignés sur la même séance que les actions. IBIT et ETHA ont peu bougé sur la semaine, tandis que SOLZ a fortement surperformé.</p><p>Cette divergence interdit un message “risk-on crypto” uniforme. La confirmation propre serait une hausse conjointe des proxies Bitcoin et Ether, accompagnée par les valeurs de bêta élevée cotées aux États-Unis. Tant que ce front commun manque, les mineurs et les sociétés de trésorerie crypto restent des véhicules tactiques, pas une validation macro.</p><div class="pedagogy-box"><strong>Plan :</strong> privilégier la confirmation du sous-jacent avant la bêta associée. Quand le proxy principal hésite mais qu’une action liée s’envole, le risque de retour brutal augmente.</div></section>

<section class="content-card" id="earnings"><h2>Résultats : le vrai test de diffusion de l’IA</h2><p>Après le choc NVIDIA de la semaine passée, la question n’est plus seulement la demande de calcul. Il faut maintenant voir si les dépenses se transforment en serveurs vendus, en trafic réseau, en consommation de données et en budgets cyber. Les mouvements implicites montrent que le marché attend déjà de fortes réactions.</p><div class="table-responsive"><table class="data-table"><thead><tr><th>Fenêtre</th><th>Titre</th><th>Ce qu’il teste</th><th>Mouvement implicite</th></tr></thead><tbody>${earn}</tbody></table></div><h3>La chaîne à suivre</h3><p><strong>DELL, HPE, CRDO et CIEN</strong> testent le hardware, la connectivité et l’infrastructure. <strong>SNOW et MDB</strong> testent la consommation réelle de données. <strong>PANW et ZS</strong> testent si la sécurité capte elle aussi les budgets d’entreprise. Une chaîne saine exige plus qu’un beat : elle exige des guidances cohérentes entre ces groupes.</p><div class="alert-box"><strong>Risque principal :</strong> un titre peut battre les attentes et baisser si le marché avait acheté un résultat encore meilleur. La réaction au prix compte davantage que l’adjectif utilisé dans le communiqué.</div></section>

<section class="content-card" id="geopolitique"><h2>Géopolitique et politique économique</h2><p>Cette semaine ne présente pas un événement géopolitique unique capable de dominer le calendrier certifié. Le risque vient plutôt d’un choc exogène qui ferait remonter simultanément pétrole, dollar et volatilité. Ce triptyque serait négatif pour les multiples de croissance et compliquerait la lecture des résultats IA.</p><p>Le deuxième front est commercial : toute extension de restrictions ou de tarifs sur les puces, serveurs et équipements de datacenter toucherait directement la chaîne étudiée. Sans annonce officielle nouvelle dans le jeu de preuves, ce point reste un risque conditionnel, pas un fait de marché.</p><p>Le troisième front est monétaire. Les interventions de la Fed avant le rapport emploi peuvent déplacer les taux, mais aucune phrase isolée ne doit être traitée comme un changement de régime sans confirmation par la courbe obligataire.</p></section>

<section class="content-card" id="rotation"><h2>Rotation sectorielle et largeur</h2><div class="chart-container"><div class="chart-title">Secteurs américains · trajectoires normalisées</div><div id="sectorChart" class="chart-host"></div></div><p>La technologie, les services de communication et les financières ont terminé en tête. L’énergie, l’industrie, la santé et l’immobilier ont pesé. Avec une majorité de secteurs en baisse, le signal est constructif pour les leaders mais insuffisant pour parler d’élargissement.</p><div class="table-responsive"><table class="data-table"><thead><tr><th>Bloc</th><th>Lecture</th><th>Confirmation attendue</th></tr></thead><tbody><tr><td>Technologie et communication</td><td>Leadership conservé</td><td>Réactions positives après résultats sans perte du prix moyen de séance</td></tr><tr><td>Financières</td><td>Résilience utile</td><td>Tenue si les taux bougent après l’emploi</td></tr><tr><td>Petites capitalisations</td><td>Faiblesse relative</td><td>Reprise nécessaire pour valider un risk-on large</td></tr><tr><td>Défensifs et cycliques</td><td>Participation médiocre</td><td>Stabilisation avant toute augmentation d’exposition</td></tr></tbody></table></div></section>

<section class="content-card" id="risques"><h2>Matrice des risques</h2><div class="table-responsive"><table class="data-table"><thead><tr><th>Risque</th><th>Probabilité</th><th>Impact</th><th>Signal précoce</th><th>Réponse</th></tr></thead><tbody><tr><td>Emploi trop fort, taux en hausse</td><td>Moyenne</td><td>Élevé</td><td>TLT faiblit, dollar et volatilité montent</td><td>Réduire la duration et les poursuites de gap</td></tr><tr><td>Guidances IA incohérentes</td><td>Moyenne</td><td>Élevé</td><td>Hardware fort mais cloud ou cyber faible</td><td>Traiter les sous-secteurs séparément</td></tr><tr><td>Déception malgré un beat</td><td>Élevée</td><td>Moyen</td><td>Gap positif vendu sous le prix moyen</td><td>Ne pas anticiper ; attendre une base</td></tr><tr><td>Élargissement haussier</td><td>Moyenne</td><td>Positif</td><td>IWM et secteurs cycliques rejoignent QQQ</td><td>Augmenter progressivement, jamais d’un bloc</td></tr><tr><td>Choc commercial ou géopolitique</td><td>Faible</td><td>Élevé</td><td>Pétrole, dollar et VIX montent ensemble</td><td>Couper les positions les plus corrélées</td></tr><tr><td>Donnée ou niveau incomplet</td><td>Connue</td><td>Élevé</td><td>Support non vérifiable ou flux absent</td><td>Refuser le trade au lieu de compléter</td></tr></tbody></table></div></section>

<section class="content-card" id="allocation"><h2>Allocation tactique</h2><p>Cette grille décrit des inclinaisons, pas un portefeuille universel. Le régime favorable autorise une exposition au risque, mais la largeur médiocre et le calendrier imposent des réserves.</p><div class="table-responsive"><table class="data-table"><thead><tr><th>Poche</th><th>Inclinaison</th><th>Raison</th><th>Condition de changement</th></tr></thead><tbody><tr><td>Large caps US</td><td>Neutre à positive</td><td>Leadership intact, volatilité contenue</td><td>Renforcer seulement si la largeur s’améliore</td></tr><tr><td>Software et cyber</td><td>Observation active</td><td>Test direct de monétisation IA</td><td>Passer positif après guidance et tenue du gap</td></tr><tr><td>Hardware IA</td><td>Sélective</td><td>Demande forte déjà largement anticipée</td><td>Privilégier les confirmations croisées</td></tr><tr><td>Petites capitalisations</td><td>Sous-pondérée</td><td>Faiblesse relative persistante</td><td>Attendre une reprise face aux grandes capitalisations</td></tr><tr><td>Métaux et énergie</td><td>Neutre</td><td>Momentum hebdomadaire détérioré</td><td>Revenir après stabilisation relative</td></tr><tr><td>Crypto</td><td>Tactique</td><td>Dispersion entre proxies</td><td>Exiger une confirmation Bitcoin et Ether</td></tr><tr><td>Cash</td><td>Réserve active</td><td>Option gratuite avant résultats et emploi</td><td>Déployer après confirmation, pas avant</td></tr></tbody></table></div></section>

<section class="content-card" id="trades"><h2>Trades de la semaine</h2><div class="no-setup"><strong>NO_SETUP</strong><p>Aucune idée directionnelle n’est publiée avant les résultats et le rapport emploi. Les supports et résistances structurés de la collecte sont incomplets ; inventer une entrée, un stop ou une cible violerait le cadre de risque.</p></div><h3>Ce qui peut devenir tradable</h3><ul><li><strong>Post-résultats :</strong> gap tenu, prix au-dessus du prix moyen de séance, base visible, volume réel et stop structurel.</li><li><strong>Alternate :</strong> si le leader échoue, ne pas acheter automatiquement son concurrent ; attendre que le concurrent confirme sa propre force.</li><li><strong>Invalidation :</strong> toute perte du niveau de structure observé après l’ouverture annule le setup. Un stop mental n’est pas une protection.</li></ul><p>Ce choix est volontaire : une semaine chargée en événements récompense davantage la patience que la précision artificielle.</p></section>

<section class="content-card" id="leaders"><h2>Leaders thématiques et sectoriels</h2><div class="table-responsive"><table class="data-table"><thead><tr><th>Thème</th><th>Leaders à observer</th><th>Question décisive</th></tr></thead><tbody><tr><td>Serveurs et infrastructure</td><td>DELL, HPE</td><td>La demande IA améliore-t-elle aussi les marges et la guidance ?</td></tr><tr><td>Connectivité</td><td>CRDO, CIEN</td><td>Le trafic et les interconnexions suivent-ils le capex de calcul ?</td></tr><tr><td>Données et cloud</td><td>SNOW, MDB</td><td>Les clients consomment-ils davantage, au-delà des annonces IA ?</td></tr><tr><td>Cybersécurité</td><td>PANW, ZS</td><td>Les budgets de sécurité accélèrent-ils avec les nouveaux usages ?</td></tr><tr><td>Crypto coté</td><td>IBIT, ETHA, SOLZ</td><td>Le mouvement devient-il commun ou reste-t-il concentré ?</td></tr></tbody></table></div><h3>Carte technique avant événements</h3><div class="table-responsive"><table class="data-table"><thead><tr><th>Titre</th><th>Clôture</th><th>Moyenne courte</th><th>RSI</th><th>État</th></tr></thead><tbody>${tech}</tbody></table></div><p>MDB, SNOW, PANW et ZS abordent leurs publications au-dessus de leur moyenne courte. DELL est proche de cette ligne. CRDO, HPE et CIEN doivent la reconquérir. Ce classement décrit la structure avant événement ; il ne prédit pas la réaction après publication.</p><div class="source-refs"><a class="source-ref" href="https://www.sec.gov/Archives/edgar/data/1571996/000157199626000032/dell-20260611.htm" target="_blank" rel="noopener"><i class="fa-solid fa-file-shield"></i><span class="source-name">SEC · Dell : conversion d’actions, pas un financement nouveau</span></a><a class="source-ref" href="https://www.sec.gov/Archives/edgar/data/1807794/000162828026024892/crdo-20260413.htm" target="_blank" rel="noopener"><i class="fa-solid fa-file-shield"></i><span class="source-name">SEC · Credo : acquisition payée en cash et actions, avec composante conditionnelle</span></a></div></section>

<section class="content-card" id="outlook"><h2>Outlook et scénarios</h2><div class="scenario-grid"><div class="scenario-card bullish"><h3>Scénario haussier</h3><p>Les guidances hardware, cloud et cyber se répondent positivement. Les gaps tiennent après l’ouverture, IWM rejoint les grands indices et l’emploi n’entraîne pas de remontée brutale des taux.</p><p><strong>Action :</strong> ajouter par étapes sur les leaders confirmés, avec protection sous la structure post-résultats.</p></div><div class="scenario-card neutral"><h3>Scénario central</h3><p>Les résultats sont bons mais dispersés : hardware solide, software ou cyber plus mitigé. Les indices tiennent grâce aux grandes capitalisations, sans véritable élargissement.</p><p><strong>Action :</strong> rester sélectif, conserver du cash et éviter les paniers thématiques indiscriminés.</p></div><div class="scenario-card bearish"><h3>Scénario baissier</h3><p>Les guidances déçoivent ou l’emploi fait remonter les taux. Les gaps positifs sont vendus, QQQ perd son leadership et la volatilité courte rattrape la volatilité future.</p><p><strong>Action :</strong> couper rapidement les échecs, ne pas moyenner et attendre une nouvelle base.</p></div></div><h3>Checklist de décision</h3><ul><li>Le résultat dépasse-t-il les attentes, et la guidance confirme-t-elle ?</li><li>Le titre tient-il son gap et son prix moyen de séance ?</li><li>Les concurrents confirment-ils ou divergent-ils ?</li><li>IWM et les secteurs cycliques participent-ils ?</li><li>Les taux et le dollar valident-ils encore le régime favorable ?</li></ul></section>

<section class="content-card" id="sources"><h2>Sources et méthode</h2><p>Données de marché, volatilité, résultats, fondamentaux et indicateurs techniques arrêtés à la dernière clôture américaine complète de vendredi. Les calculs utilisent les mêmes bornes de séance pour les actions, les ETF de matières premières et les proxies crypto.</p><p>Les données spot crypto obsolètes, les niveaux de support-résistance mal formés, le dark pool indisponible et une anomalie de date dans les flux internes ont été exclus. Aucun de ces éléments ne soutient une conclusion publiée.</p><div class="source-refs"><a class="source-ref" href="https://www.bls.gov/schedule/news_release/empsit.htm" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i><span class="source-name">BLS · calendrier du rapport emploi</span></a><a class="source-ref" href="https://www.federalreserve.gov/newsevents/calendar.htm" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i><span class="source-name">Réserve fédérale · calendrier officiel</span></a><a class="source-ref" href="https://www.ismworld.org/supply-management-news-and-reports/reports/ism-report-on-business/" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i><span class="source-name">ISM · rapports d’activité</span></a></div><div class="disclaimer"><strong>Avertissement :</strong> contenu informatif, pas un conseil financier. Les résultats créent des gaps qui peuvent rendre un stop inopérant. La taille doit rester compatible avec une perte supérieure au risque théorique.</div></section>
</main>
<footer class="article-footer">&copy; 2026 DailyTickers. Données arrêtées à la clôture de référence. Ceci n’est pas un conseil financier.<br><a href="/" title="Accueil"><i class="fas fa-house"></i></a></footer>
<script>
const weeklySeries=${JSON.stringify(allSeries)};
function normalized(symbol,start){const rows=(weeklySeries[symbol]||[]).filter(row=>row[0]>=start);const base=rows.length?rows[0][1]:1;return rows.map(row=>[row[0],Number((row[1]/base*100).toFixed(2))]);}
function lineChart(id,symbols){const host=document.getElementById(id);if(!host||typeof echarts==='undefined')return;const starts=symbols.map(symbol=>(weeklySeries[symbol]||[])[0]?.[0]).filter(Boolean);const commonStart=starts.sort().at(-1);const chart=echarts.init(host);chart.setOption({tooltip:{trigger:'axis'},legend:{type:'scroll',bottom:0},grid:{left:45,right:20,top:25,bottom:55},xAxis:{type:'time'},yAxis:{type:'value',scale:true,name:'Base 100'},series:symbols.map(symbol=>({name:symbol,type:'line',showSymbol:false,data:normalized(symbol,commonStart),emphasis:{focus:'series'}}))});window.addEventListener('resize',()=>chart.resize());}
lineChart('marketChart',['SPY','QQQ','IWM','GLD','TLT','USO']);lineChart('sectorChart',['XLK','XLC','XLF','XLE','XLV','XLI','XLY','XLP','XLU','XLRE']);
</script><script src="/assets/core.js"></script><script src="/assets/echarts-responsive.js"></script><script src="/assets/tag-renderer.js"></script><script src="/assets/sidebar.js"></script></body></html>`;

html = html
  .replaceAll('class="table-responsive"', 'class="table-responsive" style="overflow-x:auto;max-width:100%"')
  .replaceAll('class="chart-host"', 'class="chart-host" style="width:100%;height:340px;min-width:0"');

const articlePath = path.join(__dirname, 'index.html');
fs.writeFileSync(articlePath, html);
const articleSha = crypto.createHash('sha256').update(Buffer.from(html)).digest('hex');
fs.writeFileSync(path.join(__dirname, '_data/claims.json'), JSON.stringify({
  schema_version: 1,
  reference_close: '2026-08-28',
  article_path: 'weekly/20260831/index.html',
  article_sha256: articleSha,
  claims
}, null, 2) + '\n');
console.log(`Built ${path.relative(ROOT, articlePath)} (${Buffer.byteLength(html)} bytes, ${claims.length} claims)`);
