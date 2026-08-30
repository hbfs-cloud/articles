#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const rel = p => path.join('daily/20260830', p);
const read = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, p))).digest('hex');

const sources = {
  indices: rel('_data/bars_indices.json'),
  sectors: rel('_data/bars_sectors.json'),
  crypto: rel('_data/bars_crypto.json'),
  options: rel('_data/options_sentiment.json'),
  offHours: rel('_data/off_hours.json'),
  regime: rel('_data/regime_systematic.json'),
  earnings: rel('_data/earnings_today.json'),
  focusBars: rel('_focus/focus_bars.json'),
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

function queryRoot(source) {
  return data[source].data?.items?.[0] || data[source];
}

function marketClaim(id, source, symbol, render) {
  const root = queryRoot(source).results[0];
  const row = root.symbols.indexOf(symbol);
  const bar = root.data[row].bars.length - 1;
  const prefix = data[source].data?.items ? '/data/items/0' : '';
  return claim(id, source, `${prefix}/results/0/data/${row}/bars/${bar}/4`, render);
}

function marketBarClaim(id, source, symbol, field, render) {
  const root = queryRoot(source).results[0];
  const row = root.symbols.indexOf(symbol);
  const bar = root.data[row].bars.length - 1;
  const prefix = data[source].data?.items ? '/data/items/0' : '';
  return claim(id, source, `${prefix}/results/0/data/${row}/bars/${bar}/${field}`, render);
}

function earningsClaim(id, symbol, field, render) {
  const row = data.earnings.events.findIndex(event => event.symbol === symbol);
  return claim(id, 'earnings', `/events/${row}/${field}`, render);
}

function technicalClaim(id, symbol, field, render) {
  const root = queryRoot('technicals');
  const resultIndex = field === 'price' ? 0 : 1;
  const rows = root.results[resultIndex].data;
  const row = rows.findIndex(item => item.symbol === symbol);
  return claim(id, 'technicals', `/data/items/0/results/${resultIndex}/data/${row}/${field}`, render);
}

const usd = { scale: 1, decimals: 2, prefix: '$' };
const usd4 = { scale: 1, decimals: 4, prefix: '$' };
const one = { scale: 1, decimals: 1 };
const pct = { scale: 1, decimals: 1, suffix: ' %' };
const focusSymbols = ['DELL', 'MDB', 'PANW', 'CRDO', 'MDT', 'NIO'];

const allSeries = {};
for (const source of ['indices', 'sectors', 'crypto']) {
  const root = queryRoot(source).results[0];
  root.symbols.forEach((symbol, index) => {
    allSeries[symbol] = root.data[index].bars.map(bar => [bar[0], bar[4]]);
  });
}

const cryptoCards = [
  ['BTC', 'Bitcoin', claim('btc_live', 'offHours', '/facets/crypto/observations/0/price', usd), claim('btc_24h', 'offHours', '/facets/crypto/observations/0/returns/24h_pct', { scale: 1, decimals: 2, sign: 'always', suffix: ' %' })],
  ['ETH', 'Ether', claim('eth_live', 'offHours', '/facets/crypto/observations/1/price', usd), claim('eth_24h', 'offHours', '/facets/crypto/observations/1/returns/24h_pct', { scale: 1, decimals: 2, sign: 'always', suffix: ' %' })],
  ['SOL', 'Solana', claim('sol_live', 'offHours', '/facets/crypto/observations/2/price', usd), claim('sol_24h', 'offHours', '/facets/crypto/observations/2/returns/24h_pct', { scale: 1, decimals: 2, sign: 'always', suffix: ' %' })],
  ['TOTAL', 'Capitalisation crypto', claim('crypto_mcap', 'offHours', '/facets/crypto/observations/3/price', { scale: 0.000000000001, decimals: 2, suffix: ' T$' }), claim('btc_dominance', 'offHours', '/facets/crypto/observations/3/metrics/btc_dominance_pct', { scale: 1, decimals: 1, suffix: ' % BTC' })]
].map(([ticker, label, value, change]) => `<div class="metric-card"><div class="metric-value">${value}</div><div class="metric-label">${ticker} · ${label}</div><div class="metric-note">${change} · observation du dimanche</div></div>`).join('');

const cryptoStructureRows = [
  ['BTC-USD', 'Bitcoin', 'Actif directeur', 'btc'],
  ['ETH-USD', 'Ether', 'Diffusion vers les applications', 'eth'],
  ['SOL-USD', 'Solana', 'Bêta élevée et leadership relatif', 'sol'],
  ['XRP-USD', 'XRP', 'Liquidité alternative', 'xrp']
].map(([symbol, label, role, key]) => {
  const fmt = symbol === 'XRP-USD' ? usd4 : usd;
  return `<tr><td><strong>${label}</strong><br><small>${symbol}</small></td><td>${role}</td><td>${marketBarClaim(`${key}_open`, 'crypto', symbol, 1, fmt)}</td><td>${marketBarClaim(`${key}_high`, 'crypto', symbol, 2, fmt)}</td><td>${marketBarClaim(`${key}_low`, 'crypto', symbol, 3, fmt)}</td><td>${marketBarClaim(`${key}_close_table`, 'crypto', symbol, 4, fmt)}</td><td>Clôture sous l’ouverture : confirmation haussière absente.</td></tr>`;
}).join('');

const crossAssetCards = [
  ['SPY', 'Large caps US', marketClaim('spy_close', 'indices', 'SPY', usd)],
  ['QQQ', 'Croissance US', marketClaim('qqq_close', 'indices', 'QQQ', usd)],
  ['IWM', 'Petites capitalisations', marketClaim('iwm_close', 'indices', 'IWM', usd)],
  ['GLD', 'Or coté', marketClaim('gld_close', 'indices', 'GLD', usd)],
  ['TLT', 'Obligations longues', marketClaim('tlt_close', 'indices', 'TLT', usd)],
  ['USO', 'Pétrole coté', marketClaim('uso_close', 'indices', 'USO', usd)]
].map(([ticker, label, value]) => `<div class="metric-card"><div class="metric-value">${value}</div><div class="metric-label">${ticker} · ${label}</div></div>`).join('');

const earningsRows = focusSymbols.map(symbol => {
  const event = data.earnings.events.find(row => row.symbol === symbol);
  const key = symbol.toLowerCase();
  const when = event.report_time === 'BMO' ? 'Avant ouverture' : 'Après clôture';
  return `<tr><td><strong>${symbol}</strong></td><td>Mardi</td><td>${when}</td><td>${earningsClaim(`${key}_implied_move`, symbol, 'implied_move_pct', pct)}</td><td>${earningsClaim(`${key}_consensus_eps`, symbol, 'consensus_eps', { scale: 1, decimals: 2, prefix: '$' })}</td></tr>`;
}).join('');

const technicalRows = focusSymbols.map(symbol => {
  const key = symbol.toLowerCase();
  const quote = technicalClaim(`${key}_price`, symbol, 'price', usd);
  const ema20 = technicalClaim(`${key}_ema20`, symbol, 'ema20', usd);
  const rsi = technicalClaim(`${key}_rsi`, symbol, 'rsi', one);
  const root = queryRoot('technicals');
  const q = root.results[0].data.find(item => item.symbol === symbol);
  const t = root.results[1].data.find(item => item.symbol === symbol);
  const state = q.price >= t.ema20 ? 'Au-dessus de la moyenne courte' : 'Sous la moyenne courte';
  return `<tr><td><strong>${symbol}</strong></td><td>${quote}</td><td>${ema20}</td><td>${rsi}</td><td>${state}</td><td>Publication imminente : structure indicative, entrée bloquée.</td></tr>`;
}).join('');

const html = `<!doctype html>
<html lang="fr" data-tags="crypto,macro,earnings,ai,cybersecurity,cloud,formation" data-tab="daily">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>DailyTickers | Dimanche 30 août 2026 · Le plan avant la semaine du test IA</title>
<meta name="description" content="Daily français du dimanche : crypto datée, régime, volatilité, résultats DELL, MDB, PANW, CRDO, MDT et NIO, scénarios et plan d’action pour lundi.">
<meta property="og:title" content="Le plan avant la semaine du test IA"><meta property="og:description" content="Crypto, taux, volatilité et six publications à préparer sans anticiper les gaps."><meta property="og:url" content="https://articles.dailytickers.com/daily/20260830/"><meta property="og:type" content="article"><meta property="og:image" content="https://articles.dailytickers.com/favicon.ico">
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-T5Z595CW');</script>
<link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/assets/report.css"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"><script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
</head><body>
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-T5Z595CW" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<nav class="brand-bar"><div class="brand-bar-inner"><a href="/" class="brand-logo"><img src="/logo.svg" alt="" width="36" height="36"><span class="brand-title">DailyTickers</span></a><div class="brand-nav"><a href="/?tab=weekly">Hebdo</a><a href="/?tab=daily">Daily</a><a href="/?tab=analyses">Analyses</a><a href="/?tab=scanner">Scanner</a><a href="/?tab=radar">Radar</a><a href="/?tab=series">Séries</a></div><div class="brand-actions"><a href="/" class="brand-home-btn" title="Accueil"><i class="fas fa-house"></i></a></div></div></nav>
<section class="hero-section"><div class="container"><div class="hero-date">Édition du dimanche · Préparation de la semaine · Snapshot arrêté à la dernière clôture certifiée</div><h1 class="hero-title">Crypto d’abord : le plan avant l’ouverture américaine</h1><p class="hero-subtitle">Bitcoin, Ether, Solana et XRP ont tous terminé vendredi sous leur ouverture. Le régime actions reste favorable, mais la participation est étroite et les publications à venir peuvent provoquer de grands gaps. Le travail du dimanche consiste à lire la structure crypto, tester sa cohérence avec les autres actifs et préparer les conditions de lundi.</p><div class="hero-badges"><span class="hero-badge">Crypto : confirmation requise</span><span class="hero-badge">RISK-ON sous conditions</span><span class="hero-badge">Aucun achat pré-earnings</span></div><div id="article-clickable-tags" class="card-tags"></div></div></section>
<main class="container" id="main-content">
<section class="alert-banner" id="alerte"><div><strong>Décision prioritaire</strong><p>Préserver du cash jusqu’aux premières réactions post-résultats. Les options signalent des écarts potentiellement très larges sur les six titres suivis. Un stop placé avant publication ne contrôle pas un gap nocturne.</p></div></section>

<section class="content-card" id="dashboard"><h2><i class="fa-solid fa-gauge-high"></i> Tableau de bord crypto du dimanche</h2><div class="metrics-grid">${cryptoCards}</div><div class="decision-grid"><div class="decision-item"><span class="decision-label">Verdict hors séance</span><strong>INCONCLUSIVE</strong><p>La hausse de court terme existe, mais les confirmations restent trop faibles pour prédire lundi.</p></div><div class="decision-item"><span class="decision-label">Régime actions</span><strong>RISK-ON · ${claim('regime_score', 'regime', '/regime_score', { scale: 100, decimals: 0, suffix: ' %' })}</strong><p>Autorise la prise de risque sélective, sans annuler le risque événementiel.</p></div><div class="decision-item"><span class="decision-label">Volatilité actions</span><strong>VIX ${claim('vix_level', 'options', '/items/1/level', { scale: 1, decimals: 2 })}</strong><p>Courbe en contango : calme immédiat, protection future plus chère.</p></div><div class="decision-item"><span class="decision-label">Action</span><strong>NE PAS CHASSER</strong><p>Le rebond du week-end ne suffit pas à valider la bêta actions lundi.</p></div></div><div class="alert-box"><strong>Temporalité :</strong> les trois prix spot et leurs variations viennent d’une capture live du dimanche. Les graphiques historiques et les comparaisons actions restent bornés à la clôture certifiée de vendredi. Les deux horloges ne sont jamais fusionnées.</div></section>

<section class="content-card" id="crypto-live"><h2><i class="fa-solid fa-satellite-dish"></i> Pouls crypto hors séance</h2><p>Bitcoin progresse de ${claim('btc_24h_detail', 'offHours', '/facets/crypto/observations/0/returns/24h_pct', { scale: 1, decimals: 2, sign: 'always', suffix: ' %' })} sur la fenêtre glissante, Ether de ${claim('eth_24h_detail', 'offHours', '/facets/crypto/observations/1/returns/24h_pct', { scale: 1, decimals: 2, sign: 'always', suffix: ' %' })} et Solana de ${claim('sol_24h_detail', 'offHours', '/facets/crypto/observations/2/returns/24h_pct', { scale: 1, decimals: 2, sign: 'always', suffix: ' %' })}. La largeur du panier crypto observé est positive, mais le verdict agrégé reste inconclusif.</p><div class="evidence-grid"><article><h3>Prix contre intérêt ouvert</h3><p>Ether et Solana montent alors que leur intérêt ouvert recule de ${claim('eth_oi_change', 'offHours', '/facets/crypto/observations/1/metrics/open_interest_change_24h_pct', { scale: 1, decimals: 2, sign: 'always', suffix: ' %' })} et ${claim('sol_oi_change', 'offHours', '/facets/crypto/observations/2/metrics/open_interest_change_24h_pct', { scale: 1, decimals: 2, sign: 'always', suffix: ' %' })}. Cette combinaison ressemble davantage à du désendettement ou du rachat de shorts qu’à une accumulation agressive de nouveaux leviers.</p></article><article><h3>Funding et basis</h3><p>Les taux de financement restent positifs mais modestes, tandis que le basis spot/perp est légèrement négatif sur les trois actifs. Le levier n’envoie pas un signal d’euphorie.</p></article><article><h3>Volume relatif</h3><p>L’activité sur Bitcoin, Ether et Solana reste sous leur référence récente. Une hausse à faible volume relatif mérite confirmation avant l’ouverture actions.</p></article><article><h3>Dominance</h3><p>Bitcoin représente ${claim('btc_dominance_detail', 'offHours', '/facets/crypto/observations/3/metrics/btc_dominance_pct', { scale: 1, decimals: 1, suffix: ' %' })} de la capitalisation observée. La diffusion existe, mais Bitcoin garde le rôle directeur.</p></article></div><div class="pedagogy-box"><strong>Lecture contrarian :</strong> prix en hausse et intérêt ouvert en baisse peuvent produire un rebond propre, mais pas nécessairement durable. La confirmation utile serait une reprise accompagnée d’un volume relatif plus fort, sans emballement du funding.</div></section>

<section class="content-card" id="crypto"><h2><i class="fa-brands fa-bitcoin"></i> Crypto : ce que dit réellement la clôture certifiée</h2><p>Bitcoin termine à ${marketClaim('btc_detail', 'crypto', 'BTC-USD', usd)}, Ether à ${marketClaim('eth_detail', 'crypto', 'ETH-USD', usd)}, Solana à ${marketClaim('sol_detail', 'crypto', 'SOL-USD', usd)} et XRP à ${marketClaim('xrp_detail', 'crypto', 'XRP-USD', usd4)}. Les quatre actifs ont connu une séance de repli vendredi, après une séquence plus constructive pour Solana au milieu de la semaine.</p><div class="chart-container"><div class="chart-title">Crypto spot · fenêtre certifiée, séries normalisées</div><div id="cryptoChart" class="chart-host" style="width:100%;height:360px;min-width:0"></div></div><h3>Lecture en trois étages</h3><div class="scenario-grid"><div class="scenario-card bullish"><h3>Confirmation positive</h3><p>BTC retrouve sa dynamique, ETH participe et SOL ne reste pas l’unique leader. Les actions à bêta crypto ne sont intéressantes qu’après cette confirmation commune.</p></div><div class="scenario-card neutral"><h3>Scénario central</h3><p>Les actifs divergent. Dans ce cas, il faut traiter chaque sous-thème séparément et réduire les tailles sur les proxies les plus volatils.</p></div><div class="scenario-card bearish"><h3>Invalidation</h3><p>Nouvelle faiblesse simultanée de BTC et ETH, accompagnée d’une hausse du dollar et de la volatilité. Éviter mineurs et sociétés de trésorerie crypto.</p></div></div><p>Un marché ouvert en continu ne prédit pas mécaniquement l’ouverture américaine. Il fournit un test de liquidité et d’appétit pour le risque, jamais une garantie directionnelle pour le Nasdaq.</p></section>

<section class="content-card" id="crypto-structure"><h2><i class="fa-solid fa-wave-square"></i> Structure crypto, actif par actif</h2><div class="table-responsive" style="overflow-x:auto;max-width:100%"><table class="data-table"><thead><tr><th>Actif</th><th>Rôle</th><th>Ouverture</th><th>Plus haut</th><th>Plus bas</th><th>Clôture</th><th>Lecture</th></tr></thead><tbody>${cryptoStructureRows}</tbody></table></div><h3>Ordre de confirmation</h3><ol><li><strong>Bitcoin :</strong> il doit stabiliser le complexe. Sans lui, la hausse d’un proxy isolé reste fragile.</li><li><strong>Ether :</strong> sa participation indique que l’appétit pour le risque dépasse la seule réserve de valeur.</li><li><strong>Solana :</strong> son leadership devient constructif uniquement s’il ne repose pas sur une divergence persistante avec les deux actifs directeurs.</li><li><strong>XRP :</strong> il complète la lecture de liquidité, mais ne remplace pas la confirmation de Bitcoin et Ether.</li></ol><div class="pedagogy-box"><strong>Ce qui compte lundi :</strong> la séquence, pas seulement la couleur. Stabilisation des actifs directeurs, reprise coordonnée, puis confirmation par la bêta élevée cotée. Inverser cet ordre augmente le risque de poursuivre un mouvement déjà épuisé.</div></section>

<section class="content-card" id="crypto-beta"><h2><i class="fa-solid fa-bolt"></i> Bêta crypto associée : comment éviter le faux signal</h2><p>Les mineurs, plateformes d’échange, producteurs de calcul et sociétés de trésorerie crypto amplifient souvent le mouvement du sous-jacent. Cette amplification vient avec des risques propres : financement, dilution, coût de l’énergie, dette, disponibilité des machines, prime sur la valeur des actifs détenus et sentiment actions.</p><div class="table-responsive" style="overflow-x:auto;max-width:100%"><table class="data-table"><thead><tr><th>Famille</th><th>Driver principal</th><th>Confirmation nécessaire</th><th>Risque propre</th></tr></thead><tbody><tr><td>ETF spot</td><td>Sous-jacent et flux de fonds</td><td>BTC ou ETH confirme directement</td><td>Décalage horaire et prime/décote intraday</td></tr><tr><td>Mineurs</td><td>Prix du BTC et économie du hash</td><td>BTC ferme, coûts énergétiques contenus</td><td>Dilution, capex et difficulté réseau</td></tr><tr><td>Trésoreries crypto</td><td>Valeur des actifs détenus</td><td>Prime sur NAV stable et accès au financement</td><td>Dette, émission d’actions et compression de prime</td></tr><tr><td>Exchanges</td><td>Volumes, volatilité et actifs clients</td><td>Activité réelle sur plusieurs actifs</td><td>Réglementation et mix de revenus</td></tr><tr><td>Infrastructure</td><td>Demande de calcul et d’hébergement</td><td>Contrats, capacité et financement documentés</td><td>Exécution, contreparties et coût du capital</td></tr></tbody></table></div><h3>Liens déterministes observés</h3><p>COIN présente une corrélation glissante de ${claim('coin_corr', 'offHours', '/facets/crypto/observations/0/metadata/rolling_equity_links_60d/1/correlation', { scale: 1, decimals: 2 })} avec Bitcoin et un bêta de ${claim('coin_beta', 'offHours', '/facets/crypto/observations/0/metadata/rolling_equity_links_60d/1/beta_to_btc', { scale: 1, decimals: 2 })}. MSTR affiche une corrélation de ${claim('mstr_corr', 'offHours', '/facets/crypto/observations/0/metadata/rolling_equity_links_60d/4/correlation', { scale: 1, decimals: 2 })} et un bêta de ${claim('mstr_beta', 'offHours', '/facets/crypto/observations/0/metadata/rolling_equity_links_60d/4/beta_to_btc', { scale: 1, decimals: 2 })}. HUT et IREN ne passent pas le seuil de corrélation du moteur pour cette capture.</p><p>Le marché perpétuel alternatif xyz:MSTR reste un instrument séparé de l’action officielle, actuellement fermée. Son écart ne doit jamais être présenté comme une cotation MSTR ni comme une garantie d’ouverture.</p></section>

<section class="content-card" id="cross-asset"><h2><i class="fa-solid fa-scale-balanced"></i> Carte cross-asset avant lundi</h2><div class="metrics-grid">${crossAssetCards}</div><div class="chart-container"><div class="chart-title">Indices, or, obligations et pétrole · trajectoires normalisées</div><div id="marketChart" class="chart-host" style="width:100%;height:360px;min-width:0"></div></div><p>Les grandes capitalisations américaines restent proches de leurs sommets, mais IWM a faibli vendredi. L’or coté a subi une nette baisse, tandis que les obligations longues n’ont pas offert de refuge évident sur la dernière séance. Le pétrole reste ferme par rapport au début de semaine. Ce mélange ne correspond ni à un risk-on large, ni à une panique : il décrit un marché sélectif.</p><div class="pedagogy-box"><strong>Test de cohérence lundi :</strong> un vrai élargissement demande que IWM et plusieurs secteurs cycliques cessent de sous-performer QQQ. Si le Nasdaq monte seul, le risque de concentration reste intact.</div></section>

<section class="content-card" id="earnings"><h2><i class="fa-solid fa-calendar-check"></i> Six publications, six tests économiques</h2><div class="table-responsive" style="overflow-x:auto;max-width:100%"><table class="data-table"><thead><tr><th>Titre</th><th>Date</th><th>Fenêtre</th><th>Mouvement implicite</th><th>Consensus EPS</th></tr></thead><tbody>${earningsRows}</tbody></table></div><div class="evidence-grid"><article><h3>DELL · serveurs et marges</h3><p>Le marché veut savoir si la demande IA produit du cash et des marges, pas seulement du chiffre d’affaires coûteux. Une guidance forte avec pression persistante sur les marges serait une confirmation incomplète.</p></article><article><h3>MDB · consommation applicative</h3><p>MongoDB teste la monétisation des projets IA au niveau des bases de données. L’ampleur implicite élevée signifie qu’un beat ordinaire peut ne pas suffire.</p></article><article><h3>PANW · sécurité d’entreprise</h3><p>Palo Alto mesure si les budgets cyber suivent l’expansion des workloads et des identités. Le marché regardera la plateforme et la visibilité future, pas seulement le trimestre passé.</p></article><article><h3>CRDO · connectivité datacenter</h3><p>Credo est un test de second ordre : plus de calcul exige plus d’interconnexions. Il faut distinguer demande structurelle, concentration clients et exécution.</p></article><article><h3>MDT · medtech défensive</h3><p>Medtronic offre un contrepoint à la concentration IA. Sa réaction dira si le marché accepte encore une croissance moins explosive mais plus défensive.</p></article><article><h3>NIO · demande chinoise</h3><p>NIO combine pression concurrentielle, besoin de financement et sensibilité au cycle chinois. Le gap attendu n’est pas une preuve de direction.</p></article></div></section>

<section class="content-card" id="technique"><h2><i class="fa-solid fa-list-check"></i> Contrôle technique systématique</h2><div class="table-responsive" style="overflow-x:auto;max-width:100%"><table class="data-table"><thead><tr><th>Titre</th><th>Clôture</th><th>Moyenne courte</th><th>RSI</th><th>Structure</th><th>Verdict</th></tr></thead><tbody>${technicalRows}</tbody></table></div><h3>Checklist avant toute entrée</h3><ul class="check-list"><li><strong>Événement :</strong> publication passée et guidance comprise.</li><li><strong>Prix :</strong> gap observé, pas anticipé.</li><li><strong>Volume :</strong> activité régulière réelle, pas une indication pré-market vide.</li><li><strong>VWAP :</strong> tenue au-dessus après l’ouverture pour un scénario long.</li><li><strong>Base :</strong> première structure intraday visible avant de définir entrée et stop.</li><li><strong>Pairs :</strong> confirmation par le sous-secteur, sans confondre corrélation et causalité.</li><li><strong>Risque :</strong> taille compatible avec un slippage et un gap supérieur au stop théorique.</li></ul><div class="alert-box"><strong>Limite de source :</strong> les niveaux de support/résistance structurés remontent sous une forme non exploitable dans ce snapshot. Aucun prix d’entrée, stop ou objectif n’est donc inventé.</div></section>

<section class="content-card" id="propagation"><h2><i class="fa-solid fa-diagram-project"></i> Rayon de propagation à surveiller</h2><div class="table-responsive" style="overflow-x:auto;max-width:100%"><table class="data-table"><thead><tr><th>Déclencheur</th><th>Premier ordre</th><th>Deuxième ordre</th><th>Lecture utile</th></tr></thead><tbody><tr><td>DELL fort</td><td>HPE, serveurs et stockage</td><td>Connectivité, refroidissement, alimentation</td><td>Confirmer par les marges et la guidance, pas par le seul gap.</td></tr><tr><td>MDB fort</td><td>SNOW et plateformes de données</td><td>Cloud et logiciels applicatifs</td><td>Vérifier que la consommation payante accélère réellement.</td></tr><tr><td>PANW fort</td><td>ZS, CRWD, FTNT</td><td>ETF cyber et software</td><td>Une plateforme forte ne garantit pas une demande uniforme.</td></tr><tr><td>CRDO fort</td><td>CIEN, ANET, MRVL</td><td>Optique et fournisseurs datacenter</td><td>Contrôler concentration clients et calendrier des pairs.</td></tr><tr><td>Crypto forte</td><td>ETF spot cotés</td><td>Mineurs et trésoreries crypto</td><td>Le sous-jacent doit confirmer avant la bêta élevée.</td></tr><tr><td>Taux en hausse</td><td>QQQ et software</td><td>Segments à multiples élevés</td><td>Le macro peut annuler un bon signal micro.</td></tr></tbody></table></div><p>Le rayon de propagation n’est pas une liste automatique d’achats. Il sert à vérifier si un catalyseur se diffuse de façon cohérente. Une réaction isolée peut refléter une surprise propre à l’entreprise, un positionnement déséquilibré ou une guidance spécifique.</p></section>

<section class="content-card" id="geopolitique"><h2><i class="fa-solid fa-earth-americas"></i> Géopolitique et risques de week-end</h2><p>Aucun événement géopolitique unique du snapshot certifié ne justifie un verdict directionnel. Le bon cadre est conditionnel : un choc pertinent pour lundi se verrait dans une hausse conjointe du pétrole, du dollar et de la volatilité, ou dans une annonce officielle touchant les semi-conducteurs, les serveurs ou les équipements datacenter.</p><p>Pour la chaîne IA, les restrictions commerciales constituent le risque le plus directement transmissible. Elles peuvent affecter les volumes, les marges, le calendrier de livraison et la valorisation des fournisseurs. Sans annonce primaire nouvelle, ce risque reste une branche de scénario, pas un fait.</p><div class="pedagogy-box"><strong>Règle de week-end :</strong> le silence d’un marché fermé n’est pas une preuve de stabilité. L’absence de transaction ne réduit pas le risque ; elle retarde seulement son observation.</div></section>

<section class="content-card" id="formation"><h2><i class="fa-solid fa-graduation-cap"></i> Formation : pourquoi un bon résultat peut faire baisser l’action</h2><p>Le prix ne réagit pas au caractère “bon” ou “mauvais” d’un communiqué. Il réagit à l’écart entre le résultat publié et ce que les investisseurs avaient déjà payé. Si une action a monté avant les résultats et si les options anticipent un mouvement important, les attentes intégrées dans le prix peuvent être supérieures au consensus affiché.</p><p>Imagine une entreprise qui dépasse légèrement les estimations de bénéfice, mais qui guide le trimestre suivant seulement en ligne avec les attentes. Le trimestre est objectivement bon. Pourtant, les investisseurs qui espéraient une hausse de guidance peuvent vendre. Le gap négatif ne contredit pas les chiffres ; il révèle que la barre implicite était plus haute.</p><p>Les options donnent une approximation de l’amplitude attendue, pas de la direction. Un mouvement implicite élevé signifie que le marché paie pour une large distribution de résultats possibles. Il ne dit pas si le titre montera ou baissera. C’est pourquoi transformer ce chiffre en objectif de cours serait une erreur.</p><p>Après publication, trois observations réduisent l’incertitude. D’abord, la guidance explique si le moteur est durable. Ensuite, la tenue du gap montre si les acheteurs acceptent le nouveau prix. Enfin, la réaction des pairs distingue une surprise propre à l’entreprise d’un signal sectoriel. Aucun de ces contrôles n’existe avant la publication.</p><p>Pour un particulier, le meilleur avantage n’est pas de deviner plus vite. C’est de pouvoir attendre sans mandat d’investissement. Le cash évite le risque de gap et permet d’acheter une structure confirmée, même si le prix est légèrement moins favorable.</p></section>

<section class="content-card" id="trade"><h2><i class="fa-solid fa-crosshairs"></i> Idées de trading</h2><div class="no-setup"><strong>NO_SETUP</strong><p>Aucun trade pré-earnings ne passe le contrôle. Les niveaux structurés sont incomplets et les gaps anticipés sont trop larges pour publier honnêtement une entrée, un stop et des objectifs. La décision actionnable est d’attendre les barres régulières post-événement.</p></div><div class="decision-grid"><div class="decision-item"><span class="decision-label">Armer</span><strong>Après la publication</strong><p>Jamais avant la disponibilité économique : le communiqué et la guidance.</p></div><div class="decision-item"><span class="decision-label">Confirmer</span><strong>Gap + VWAP + volume</strong><p>Les trois doivent être observés sur la séance régulière.</p></div><div class="decision-item"><span class="decision-label">Refuser</span><strong>Gap vertical sans base</strong><p>Un bon dossier peut rester un mauvais point d’entrée.</p></div><div class="decision-item"><span class="decision-label">Invalider</span><strong>Perte de structure</strong><p>La règle doit être définie après le gap, pas recyclée depuis vendredi.</p></div></div></section>

<section class="content-card" id="surveiller"><h2><i class="fa-solid fa-eye"></i> Ce qu’il faut surveiller</h2><ol><li>La cohérence entre BTC, ETH et la bêta crypto avant l’ouverture américaine.</li><li>La participation de IWM et des secteurs cycliques face à QQQ.</li><li>La pente de la volatilité : VIX court contre VIX à trois mois.</li><li>Les taux et le dollar autour des données d’activité et d’emploi.</li><li>DELL, MDB, PANW et CRDO mardi soir : guidance avant headline.</li><li>La confirmation de second ordre chez HPE, SNOW, CIEN et ZS.</li><li>Le comportement du gap : tenue, VWAP, volume et première base intraday.</li><li>Toute annonce officielle sur tarifs ou restrictions touchant la chaîne datacenter.</li></ol></section>

<section class="content-card" id="sources"><h2><i class="fa-solid fa-book"></i> Sources, qualité et méthode</h2><p>Snapshot MCP Marketdata et Systematic collecté dimanche, borné à la dernière clôture américaine complète de vendredi. La couverture crypto point-in-time sert la même date afin d’éviter de mélanger un prix du dimanche avec les clôtures actions du vendredi.</p><p>Les barres actions, ETF, secteurs et crypto sont complètes jusqu’à vendredi. Les six focus disposent de barres, techniques, fondamentaux, événements, flux et corrélations dans le même run. Les supports/résistances sont exclus car leur payload n’est pas exploitable comme niveaux numériques. Les données manquantes ne sont pas remplacées par le web.</p><p>La qualité globale est suffisante pour préparer des scénarios, mais pas pour publier un trade avant événement. Toute exécution lundi exige des données régulières nouvelles et une reconstruction des niveaux après le gap.</p><div class="disclaimer"><strong>Avertissement :</strong> contenu informatif, pas un conseil financier. Les gaps de résultats peuvent dépasser le risque prévu et rendre un stop inefficace.</div></section>
</main>
<div class="fnav" id="floatingNav"><div class="fnav-menu" id="fnavMenu"><a href="#alerte" class="fnav-item" data-section="alerte"><i class="fas fa-bullhorn"></i><span>Décision</span></a><a href="#dashboard" class="fnav-item" data-section="dashboard"><i class="fas fa-gauge-high"></i><span>Dashboard</span></a><a href="#crypto" class="fnav-item" data-section="crypto"><i class="fab fa-bitcoin"></i><span>Crypto</span></a><a href="#earnings" class="fnav-item" data-section="earnings"><i class="fas fa-calendar-check"></i><span>Résultats</span></a><a href="#formation" class="fnav-item" data-section="formation"><i class="fas fa-graduation-cap"></i><span>Formation</span></a><a href="#trade" class="fnav-item" data-section="trade"><i class="fas fa-crosshairs"></i><span>Plan</span></a></div><button class="fnav-btn" id="fnavBtn" type="button" aria-label="Navigation"><i class="fas fa-bars" id="fnavIcon"></i><span class="fnav-btn-label" id="fnavLabel">Menu</span></button></div>
<footer class="article-footer">&copy; 2026 DailyTickers. Données DailyTickers. Ceci n’est pas un conseil financier.<br><a href="/" title="Accueil"><i class="fas fa-house"></i></a></footer>
<script>
const dailySeries=${JSON.stringify(allSeries)};
function normalized(symbol){const rows=dailySeries[symbol]||[];const base=rows.length?rows[0][1]:1;return rows.map(row=>[row[0],Number((row[1]/base*100).toFixed(2))]);}
function lineChart(id,symbols){const host=document.getElementById(id);if(!host||typeof echarts==='undefined')return;const chart=echarts.init(host);chart.setOption({animation:false,tooltip:{trigger:'axis'},legend:{type:'scroll',bottom:0},grid:{left:48,right:18,top:24,bottom:58},xAxis:{type:'time'},yAxis:{type:'value',scale:true,name:'Base 100'},series:symbols.map(symbol=>({name:symbol,type:'line',showSymbol:false,data:normalized(symbol),emphasis:{focus:'series'}}))});window.addEventListener('resize',()=>chart.resize());}
lineChart('cryptoChart',['BTC-USD','ETH-USD','SOL-USD','XRP-USD']);lineChart('marketChart',['SPY','QQQ','IWM','GLD','TLT','USO']);
</script><script src="/assets/core.js"></script><script src="/assets/echarts-responsive.js"></script><script src="/assets/tag-renderer.js"></script><script src="/assets/sidebar.js"></script></body></html>`;

const telegram = `<b>DAILY CRYPTO · REBOND DU WEEK-END, SIGNAL ENCORE INCONCLUSIF</b>\n\nCapture live dimanche : BTC <b>$78 720,79 (+1,10 %)</b>, ETH <b>$2 476,45 (+1,30 %)</b>, SOL <b>$106,35 (+1,26 %)</b>. Dominance BTC <b>59,5 %</b>.\n\n<b>Ce qui gêne</b>\n• ETH et SOL montent avec un intérêt ouvert en baisse : désendettement ou rachats de shorts possibles.\n• Volume relatif encore faible.\n• Le perp alternatif xyz:MSTR n’est pas l’action MSTR et ne prédit pas son ouverture.\n\n<b>Plan actionnable</b>\n• Ne pas chasser la bêta crypto lundi.\n• Exiger BTC + ETH fermes, volume en hausse, puis confirmation de COIN/MSTR.\n• HUT/IREN ne passent pas le filtre de corrélation de cette capture.\n• Aucun achat pré-earnings sur DELL, MDB, PANW, CRDO, MDT ou NIO.\n\n<b>Verdict : INCONCLUSIVE / NO_SETUP.</b> Cash actif jusqu’à confirmation.\n\nhttps://articles.dailytickers.com/daily/20260830/`;

const substack = `# The Sunday Plan Before AI Spending Faces Its Next Test

The market enters the week in a constructive regime, but the rally is narrow and the next set of earnings can produce double-digit gaps. The useful decision is not to predict those gaps. It is to prepare the conditions that would make them tradable afterward.

The live Sunday capture shows Bitcoin at $78,720.79, Ether at $2,476.45, and Solana at $106.35. Their rolling 24-hour returns are +1.10%, +1.30%, and +1.26%. Bitcoin dominance is 59.5%. The certified Friday snapshot remains separate and is used only for comparisons with US-listed assets.

## What the backdrop says

The systematic regime remains risk-on with a 79% score. The VIX closed at 14.43 and the volatility curve is in contango, meaning near-term protection is cheaper than protection several months out. That is a calm structure, not a panic structure.

The contradiction is participation. Large-cap indices remain close to their highs, while small caps weakened into Friday. Gold sold off sharply, long-duration Treasuries did not provide a clean final-session refuge, and oil stayed relatively firm. This is selective risk appetite, not a broad all-clear.

Crypto does not resolve the contradiction. The weekend rebound is real, but the off-hours engine still returns INCONCLUSIVE. Ether and Solana are rising while open interest falls, which is consistent with deleveraging or short covering rather than aggressive new leverage. Relative volume also remains light. A 24/7 market does not mechanically predict the US open.

The clean bullish confirmation would be Bitcoin and Ether strengthening together on better participation, followed by confirmation from the listed proxies. COIN currently has a 0.73 rolling correlation with Bitcoin and a 1.32 beta. MSTR has a 0.76 correlation and a 1.68 beta. HUT and IREN fail the engine's correlation gate in this capture. The alternative xyz:MSTR perpetual is not the official MSTR share price and must not be used as an opening quote.

## Six earnings, six different tests

Dell, MongoDB, Palo Alto Networks, Credo, Medtronic, and NIO report on Tuesday. Their options-implied moves range from roughly 5% to 16%.

**Dell tests AI servers and margins.** Revenue growth is not enough if expensive systems fail to produce cash and operating leverage.

**MongoDB tests paid application demand.** The question is whether AI projects create measurable database consumption rather than announcements.

**Palo Alto tests cybersecurity budgets.** New workloads create new identities, data flows, and attack surfaces. Investors need evidence that security spending follows infrastructure spending.

**Credo tests data-center connectivity.** More compute requires faster links. The report can confirm second-order AI demand, but customer concentration and execution still matter.

**Medtronic is the defensive control group.** Its reaction shows whether investors still reward steadier, less explosive growth outside the AI complex.

**NIO tests Chinese demand and financing risk.** Competitive pressure can overwhelm a superficially strong delivery narrative.

## The execution checklist

No pre-earnings entry qualifies. The collected support and resistance payload is not reliable enough to publish precise levels, and an overnight gap can jump over any stop.

After each report, require five things:

1. Guidance that supports the thesis.
2. A gap observed after the release, not guessed beforehand.
3. Real regular-session volume.
4. Price holding above VWAP for a long setup.
5. A visible 15-minute base that defines the entry and invalidation.

Then check the blast radius. Dell should be compared with server and infrastructure names. MongoDB should be checked against data and cloud platforms. Palo Alto should be checked against cybersecurity peers. Credo should be checked against networking and optical suppliers. A single stock gap never validates an entire theme.

## Why a good report can still send a stock down

Price reacts to the difference between the published result and what investors already paid for. A company can beat the consensus and still disappoint the higher expectation embedded in its valuation and options market.

An implied move estimates magnitude, not direction. A 12% implied move does not mean the stock should rise 12%. It means the market is paying for a wide range of outcomes. Turning it into a price target creates false precision.

Retail investors have one advantage: they can wait. Cash avoids gap risk and preserves the ability to buy a confirmed structure after the event, even at a slightly higher price.

## Bottom line

The regime allows selective risk, but the calendar blocks pre-event execution. The correct status is **NO SETUP** until guidance, the gap, VWAP, volume, and the first post-event base can be observed.

If hardware is strong while data or cybersecurity is weak, treat AI as a capex-heavy cycle rather than a broad monetization cycle. If all links confirm and small caps participate, the rally can broaden. If rates, the dollar, and volatility rise together, macro overrides the micro signal.

*Informational only, not financial advice. Earnings gaps can exceed planned risk and make stop orders ineffective.*
`;

fs.writeFileSync(path.join(__dirname, 'index.html'), html);
fs.writeFileSync(path.join(__dirname, 'telegram-fr.html'), telegram + '\n');
fs.writeFileSync(path.join(__dirname, 'substack-en.md'), substack);
const articleSha = crypto.createHash('sha256').update(Buffer.from(html)).digest('hex');
fs.writeFileSync(path.join(__dirname, '_data/claims.json'), JSON.stringify({
  schema_version: 1,
  reference_close: '2026-08-28',
  article_path: 'daily/20260830/index.html',
  article_sha256: articleSha,
  claims
}, null, 2) + '\n');
console.log(`Built daily/20260830/index.html (${Buffer.byteLength(html)} bytes, ${claims.length} claims)`);
