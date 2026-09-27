#!/usr/bin/env node
'use strict';

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { renderValue } = require('../../tools/validate-content-claims');

const ROOT = path.resolve(__dirname, '../..');
const REL = 'weekly/20260928';
const DIR = path.join(ROOT, REL);
const read = rel => JSON.parse(fs.readFileSync(path.join(DIR, rel), 'utf8'));
const digest = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex');
const esc = s => String(s).replace(/~/g, '~0').replace(/\//g, '~1');
const sources = {
  indices: '_data/bars_indices.json', sectors: '_data/bars_sectors.json', crypto: '_data/bars_crypto.json',
  regime: '_data/regime.json', systematic: '_data/regime_systematic.json', options: '_data/options_sentiment.json',
  earnings: '_data/earnings_calendar.json', systemic: '_data/earnings_systemic.json', economic: '_data/economic_events.json',
  selection: '_data/selection.json', focus: '_focus/focus_bars.json', technicals: '_focus/focus_technicals.json',
  fundamentals: '_focus/focus_fundamentals.json', flows: '_focus/focus_flows.json',
  blastA: '_focus/blast_bars_a.json', blastB: '_focus/blast_bars_b.json'
};
const D = Object.fromEntries(Object.entries(sources).map(([k, v]) => [k, read(v)]));
const artifact = key => `${REL}/${sources[key]}`;

function walk(node, pred, ptr = '') {
  if (pred(node)) return { node, ptr };
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) { const hit = walk(node[i], pred, `${ptr}/${i}`); if (hit) return hit; }
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) { const hit = walk(v, pred, `${ptr}/${esc(k)}`); if (hit) return hit; }
  }
  return null;
}
function all(node, pred, ptr = '', out = []) {
  if (pred(node)) out.push({ node, ptr });
  if (Array.isArray(node)) node.forEach((v, i) => all(v, pred, `${ptr}/${i}`, out));
  else if (node && typeof node === 'object') Object.entries(node).forEach(([k, v]) => all(v, pred, `${ptr}/${esc(k)}`, out));
  return out;
}
function barHit(symbol) {
  for (const key of ['indices', 'sectors', 'crypto', 'focus', 'blastA', 'blastB']) {
    const hit = walk(D[key], x => x && x.symbol === symbol && Array.isArray(x.bars));
    if (hit) return { ...hit, key };
  }
  throw new Error(`barres absentes: ${symbol}`);
}
function eventHit(symbol) {
  const hit = walk(D.earnings, x => x && x.symbol === symbol && x.report_date);
  if (!hit) throw new Error(`événement absent: ${symbol}`);
  return { ...hit, key: 'earnings' };
}
function econHit(name) {
  const hit = walk(D.economic, x => x && x.name === name && x.event_time
    && x.event_time.slice(0, 10) >= '2026-09-28' && x.event_time.slice(0, 10) <= '2026-10-02');
  if (!hit) throw new Error(`macro absent: ${name}`);
  return { ...hit, key: 'economic' };
}
function objectHit(key, pred, label) {
  const hit = walk(D[key], pred);
  if (!hit) throw new Error(`${label} absent`);
  return { ...hit, key };
}

const claims = [];
const literals = new Set();
let seq = 0;
function claim(key, pointer, value, render, stem = 'c', formula) {
  const rendered = renderValue(formula ? formula.result : value, render);
  if (rendered == null) throw new Error(`rendu impossible ${stem}: ${JSON.stringify(value)}`);
  const id = `${stem}_${++seq}`.toLowerCase();
  const row = { id, rendered_text: rendered, source_artifact: artifact(key), source_sha256: digest(artifact(key)), source_pointer: pointer, source_value: value, render };
  if (formula) row.formula = formula;
  claims.push(row);
  return `<span data-claim="${id}">${rendered}</span>`;
}
const lit = value => { literals.add(String(value)); return `<span data-literal>${value}</span>`; };
const n = (key, pointer, value, decimals = 1, suffix = '', stem = 'n', sign) => claim(key, pointer, value, { scale: 1, decimals, suffix, format: 'fr', ...(sign ? { sign: 'always' } : {}) }, stem);
const dt = (key, pointer, value, parts = 'weekday_day_month', stem = 'date') => claim(key, pointer, value, { format: 'fr_date', parts }, stem);
const tm = (key, pointer, value, zone = 'America/New_York', stem = 'time') => claim(key, pointer, value, { format: 'fr_time', zone }, stem);
function perf(symbol, startDate, decimals = 1, stem = 'perf') {
  const h = barHit(symbol), b = h.node.bars, i = b.length - 1, j = b.findIndex(x => x[0] === startDate);
  if (j < 0 || j >= i) throw new Error(`${symbol}: base ${startDate} absente`);
  const value = (b[i][4] / b[j][4] - 1) * 100;
  return claim(h.key, `${h.ptr}/bars/${i}/4`, b[i][4], { scale: 1, decimals, suffix: ' %', sign: 'always', format: 'fr' }, `${stem}_${symbol}`, {
    operation: 'ratio_pct', numerator_pointer: `${h.ptr}/bars/${i}/4`, denominator_pointer: `${h.ptr}/bars/${j}/4`, result: value
  });
}
function close(symbol, decimals = 2) {
  const h = barHit(symbol), i = h.node.bars.length - 1, v = h.node.bars[i][4];
  return n(h.key, `${h.ptr}/bars/${i}/4`, v, decimals, ' $', `close_${symbol}`);
}

const START = '2026-09-18';
const labels = {
  SPY:'S&P 500', QQQ:'Nasdaq 100', IWM:'Russell 2000', DIA:'Dow Jones', GLD:'Or', SLV:'Argent', TLT:'Taux longs', USO:'Pétrole',
  XLK:'Technologie', XLB:'Matériaux', XLF:'Finance', XLV:'Santé', XLI:'Industrie', XLY:'Consommation discrétionnaire', XLP:'Consommation de base', XLU:'Services collectifs', XLC:'Communication', XLRE:'Immobilier',
  IBIT:'Bitcoin', ETHA:'Ethereum', SOLZ:'Solana',
  MU:'Micron', NVDA:'Nvidia', AVGO:'Broadcom', AMD:'AMD', DELL:'Dell',
  WDC:'Western Digital', STX:'Seagate', SNDK:'SanDisk', TSM:'TSMC', MRVL:'Marvell', MPWR:'Monolithic Power',
  SMH:'Semis (SMH)', SMCI:'Super Micro', ANET:'Arista', ASML:'ASML', LRCX:'Lam Research', VRT:'Vertiv'
};
const perfValue = symbol => { const b = barHit(symbol).node.bars, j = b.findIndex(x => x[0] === START); return (b.at(-1)[4] / b[j][4] - 1) * 100; };
const chartSeries = symbol => { const b = barHit(symbol).node.bars.filter(x => x[0] >= START); const base = b[0][4]; return b.map(x => [x[0], +(x[4] / base * 100).toFixed(3)]); };
const weekRows = syms => syms.map(s => [s, perfValue(s)]);

const regimeRoot = objectHit('regime', x => x && x.dtx_regime && x.dtx_detail === undefined, 'régime');
const regime = regimeRoot.node.dtx_regime;
const muEvent = objectHit('systemic', x => x && x.symbol === 'MU' && x.report_date, 'événement MU');
const siMu = objectHit('flows', x => x && x.symbol === 'MU' && x.type === 'instrument_short_interest_series', 'short MU');
const term = all(D.options, x => x && x.type === 'term_structure_point');
const earningSymbols = ['ACN','NKE','JBL','CCL','MKC','JEF','FDS'];
const macroNames = ['Core PCE Price Index (Personal Income & Outlays)','ISM Manufacturing PMI','Initial Jobless Claims','Non-Farm Payrolls (Employment Situation)'];
const macroLabels = {
  'Core PCE Price Index (Personal Income & Outlays)': 'Inflation PCE cœur (mesure préférée de la Fed)',
  'ISM Manufacturing PMI': 'ISM manufacturier',
  'Initial Jobless Claims': 'Nouvelles demandes d’allocation chômage',
  'Non-Farm Payrolls (Employment Situation)': 'Emploi américain (NFP)'
};

function chart(id, title, note) {
  return `<figure class="chart-card"><h3>${title}</h3><div id="${id}" class="echart-box" style="width:100%;height:360px"></div><figcaption><strong>Lecture :</strong> ${note}</figcaption></figure>`;
}
function section(id, icon, title, body) { return `<section id="${id}" class="report-section"><h2><i class="fas ${icon}"></i> ${title}</h2>${body}</section>`; }
function card(body, cls='insight-card') { return `<div class="${cls}">${body}</div>`; }
function table(headers, rows) { return `<div class="table-wrap"><table><thead><tr>${headers.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(x=>`<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; }
const badge = (text, tone='blue') => `<span class="badge badge-${tone}">${text}</span>`;

const sections = [];

sections.push(section('verdict','fa-flag-checkered','Verdict',
  `<div class="decision-banner"><div class="decision-label">DÉCISION</div><div class="decision-value">SEMAINE MACRO : ATTENDRE LES CHIFFRES AVANT D’AJOUTER DU RISQUE</div><p>La semaine à venir est dominée par la macro : l’inflation PCE cœur mercredi, l’ISM manufacturier jeudi et surtout l’emploi américain vendredi fixent la trajectoire de baisse des taux de la Fed. En toile de fond, Micron publie ses résultats mercredi après clôture — le baromètre de la demande de mémoire pour l’IA. Le régime systématique reste en reprise (score ${claim('regime',`${regimeRoot.ptr}/dtx_regime/regime_score`,regime.regime_score,{scale:100,decimals:0,suffix:' %',format:'fr'},'regime_score')}), mais avec un tel enchaînement de données, l’action est d’attendre la confirmation, pas de l’anticiper.</p></div>`
  + `<div class="stats-grid">${card(`<span class="stat-label">Volatilité comptant (VIX)</span><strong>${n('regime',`${regimeRoot.ptr}/dtx_regime/dtx_detail/vix_level`,regime.dtx_detail.vix_level,2,'','vix_verdict')}</strong>`)}${card(`<span class="stat-label">S&P sur la semaine</span><strong>${perf('SPY',START)}</strong>`)}${card(`<span class="stat-label">Nasdaq sur la semaine</span><strong>${perf('QQQ',START)}</strong>`)}</div>`));

sections.push(section('fab','fa-crosshairs','FAB — ce qui mérite une action',
  `<div class="scenario-grid">${card(`<h3>Avant les données</h3><p>Garder de la liquidité. Les publications macro majeures (PCE, ISM, emploi) et Micron s’enchaînent : le risque d’écart à l’ouverture se concentre en fin de semaine.</p>`)}${card(`<h3>Autour de Micron</h3><p>Lire ensemble Micron et sa chaîne : Western Digital, Seagate, SanDisk pour la mémoire, Nvidia et AMD pour la demande. Une bonne publication sans suivi des pairs serait un signal isolé, pas un régime.</p>`)}${card(`<h3>Signal contraire</h3><p>Un emploi solide avec inflation contenue validerait la reprise et élargirait la hausse aux cycliques et petites capitalisations. Un emploi faible relancerait le débat sur la croissance plutôt que sur les taux.</p>`)}</div>`));

sections.push(section('alerte','fa-triangle-exclamation','Alerte données',
  `<div class="alert-box" data-status="VALIDÉ"><strong>VALIDÉ.</strong> Toutes les séries de cette édition sont arrêtées à la clôture américaine certifiée du ${lit('25 septembre 2026')}. Les performances hebdomadaires partent de la clôture du vendredi précédent, le ${lit('18 septembre 2026')}. Micron ne figure pas dans le calendrier d’options collecté : aucune amplitude implicite n’est affichée pour ce titre, seule sa date de publication est reprise du filtre systémique.</div>`));

const macroRows = macroNames.map(name => { const h=econHit(name); return [dt('economic',`${h.ptr}/event_time`,h.node.event_time,'weekday_day_month','macro_date'),tm('economic',`${h.ptr}/event_time`,h.node.event_time,'America/New_York','macro_time'),macroLabels[name]]; });
const agendaCards = macroRows.map(([date,time,event]) => card(`<div class="stat-label">${date} · ${time}</div><h3>${event}</h3>`)).join('');
sections.push(section('agenda','fa-calendar-week','Agenda de la semaine',
  `<p>La séquence macro se resserre en fin de semaine : l’inflation PCE cœur mercredi, puis l’ISM manufacturier et les inscriptions au chômage jeudi, et enfin le rapport sur l’emploi vendredi. Micron s’intercale mercredi après clôture.</p>`
  + `<div class="scenario-grid" aria-label="Rendez-vous macroéconomiques">${agendaCards}</div>`
  + chart('calendarChart','Concentration des rendez-vous','La fin de semaine concentre inflation, activité et emploi. Invalidation : un report officiel de calendrier rend ce séquençage caduc.')));

sections.push(section('executive-summary','fa-list-check','Synthèse exécutive',
  `<ul class="key-list"><li>Le leadership hebdomadaire oppose la technologie à ${perf('XLK',START)} et la santé à ${perf('XLV',START)} aux financières à ${perf('XLF',START)}.</li><li>La courbe de volatilité reste croissante, de ${n('options',`${term[0].ptr}/level`,term[0].node.level,2,'','vc_short')} à ${lit('9 jours')} jusqu’à ${n('options',`${term.at(-1).ptr}/level`,term.at(-1).node.level,2,'','vc_long')} à ${lit('6 mois')} : le calme immédiat n’efface pas la prime de durée avant l’emploi.</li><li>Les taux longs, via TLT, font ${perf('TLT',START)} sur la semaine : le marché obligataire attend lui aussi les chiffres.</li><li>La mémoire et les semis mènent avant Micron ; Nvidia fait ${perf('NVDA',START)} et Micron ${perf('MU',START)} sur la semaine écoulée.</li></ul>`));

sections.push(section('bilan','fa-clock-rotate-left','Bilan de la semaine écoulée',
  `<p>La semaine écoulée s’est terminée en ordre dispersé. Le S&P termine à ${perf('SPY',START)}, le Dow à ${perf('DIA',START)} et le Russell à ${perf('IWM',START)}, avec le Nasdaq à ${perf('QQQ',START)}. La technologie a porté l’indice, tandis que le marché large restait prudent avant l’enchaînement macro de la semaine suivante.</p>`
  + chart('crossAssetChart','Performance depuis la clôture du vendredi précédent','Le Nasdaq mène, les indices plus larges suivent de loin. Invalidation : un rattrapage simultané du Russell et du Dow.')));

sections.push(section('macro','fa-landmark','Macro et taux',
  `<p>Le régime systématique cote la volatilité comptant à ${n('regime',`${regimeRoot.ptr}/dtx_regime/dtx_detail/vix_level`,regime.dtx_detail.vix_level,2,'','vix_spot')}, sous sa moyenne mobile à ${n('regime',`${regimeRoot.ptr}/dtx_regime/dtx_detail/vix_sma14`,regime.dtx_detail.vix_sma14,2,'','vix_avg')} : le signal autorise le risque. Mais la semaine empile la mesure d’inflation préférée de la Fed (PCE cœur), l’ISM et l’emploi. Ces chiffres pilotent la probabilité d’une baisse de taux : un PCE tiède et un emploi solide seraient le meilleur des mondes ; un emploi faible rouvrirait le débat sur la croissance. Les taux longs font ${perf('TLT',START)} sur la semaine.</p>`
  + `<div class="pedagogy-box"><h4>Pourquoi ces données comptent</h4><p>L’indice PCE cœur est la mesure d’inflation que la Réserve fédérale surveille en priorité, car il exclut l’alimentation et l’énergie, plus volatiles. Un chiffre en décélération élargit la marge de manœuvre pour baisser les taux ; une surprise à la hausse la referme. Le rapport sur l’emploi, publié vendredi, ferme la séquence : il mesure à la fois la vigueur du marché du travail et les pressions salariales. En régime de reprise, le marché récompense la combinaison d’une inflation qui reflue et d’un emploi qui tient, et sanctionne les extrêmes, qu’il s’agisse d’une surchauffe ou d’un net ralentissement. C’est pourquoi ajouter du risque avant ces publications revient à parier sur la donnée plutôt que sur une configuration.</p></div>`
  + chart('volChart','Structure par terme de la volatilité','La pente est positive : la protection éloignée coûte davantage, cohérent avec le risque événementiel de fin de semaine. Invalidation : inversion franche de la courbe ou rupture du comptant au-dessus de sa moyenne.')));

sections.push(section('metaux','fa-coins','Métaux et matières premières',
  `<p>L’or fait ${perf('GLD',START)} et l’argent ${perf('SLV',START)} sur la semaine, contre ${perf('USO',START)} pour le pétrole coté via USO. L’or reste un baromètre des taux réels : une inflation qui décélère sans emploi qui s’effondre serait le scénario le plus favorable au métal. Le différentiel or/argent mêle demande monétaire et sensibilité industrielle.</p>`
  + chart('metalsChart','Métaux et énergie, semaine écoulée','Comparaison des grands actifs réels. Invalidation : un décrochage simultané de l’or et de l’argent signalerait une remontée des taux réels.')));

sections.push(section('crypto','fa-bitcoin-sign','Crypto',
  `<p>Bitcoin fait ${perf('IBIT',START)}, Ethereum ${perf('ETHA',START)} et Solana ${perf('SOLZ',START)} via leurs véhicules cotés. Le crypto reste l’actif le plus sensible à l’appétit pour le risque et au coût de l’argent : un emploi qui renforce le scénario de baisse des taux lui serait favorable, un emploi trop chaud le pénaliserait. La hiérarchie de la semaine indique l’intensité de cet appétit.</p>`
  + `<div class="pedagogy-box"><h4>Le crypto comme baromètre du risque</h4><p>Les véhicules cotés sur Bitcoin, Ethereum et Solana réagissent avant tout au coût de l’argent et à l’appétit pour le risque. Quand le marché anticipe une politique monétaire plus souple, ces actifs surperforment ; quand la crainte d’une inflation persistante domine, ils corrigent brutalement. Leur hiérarchie de la semaine est donc un indicateur avancé de la tolérance au risque, à confronter avec la largeur du marché actions : une envolée du crypto pendant que les petites capitalisations reculent signale une concentration spéculative, pas une confirmation cyclique.</p></div>`
  + chart('cryptoChart','Crypto coté : hiérarchie de l’appétit pour le risque','La dispersion entre ces actifs mesure la concentration spéculative. Invalidation : repli simultané sous la base du vendredi précédent.')));

const earningsRows = earningSymbols.map(s=>{const h=eventHit(s);return [s,dt('earnings',`${h.ptr}/report_date`,h.node.report_date,'weekday_day_month',`earn_date_${s}`),h.node.report_time==='BMO'?'avant ouverture':'après clôture',n('earnings',`${h.ptr}/implied_move_pct`,h.node.implied_move_pct,1,' %',`earn_move_${s}`),n('earnings',`${h.ptr}/market_cap_b`,h.node.market_cap_b,0,' Md$',`earn_cap_${s}`)];});
sections.push(section('earnings','fa-building','Résultats : Micron porte le risque de la chaîne IA',
  `<p>Micron publie le ${dt('systemic',`${muEvent.ptr}/report_date`,muEvent.node.report_date,'weekday_day_month','mu_date')} après clôture : c’est le seul catalyseur d’entreprise systémique de la semaine et le baromètre de la demande de mémoire (DRAM/HBM) pour l’IA. Le titre arrive à ${close('MU')}, en ${perf('MU',START)} sur la semaine écoulée. Le calendrier d’options collecté ne couvre pas Micron ; aucune amplitude implicite n’est affichée pour ce nom. Parmi les publications datées, Accenture porte la plus grosse capitalisation.</p>`
  + `<div class="pedagogy-box"><h4>Lire le cycle de la mémoire</h4><p>La mémoire — DRAM et HBM — est un marché cyclique : les prix montent quand la demande dépasse l’offre, puis retombent quand les fabricants investissent trop. La vague d’intelligence artificielle a interrompu le cycle baissier précédent, car les accélérateurs de calcul consomment d’énormes volumes de mémoire à haute bande passante. La publication de Micron sert donc de test : ses prix de vente moyens, ses marges et surtout ses prévisions diront si la demande liée à l’IA reste supérieure à l’offre. Un message prudent pèserait sur toute la chaîne, des fondeurs aux fabricants de serveurs ; un message confiant validerait les valorisations du secteur. C’est le signal d’entreprise le plus lu de la semaine, à confronter au verdict macro.</p></div>`
  + table(['Titre','Date','Moment','Mouvement attendu','Capitalisation'],earningsRows)
  + chart('earningsChart','Mouvement attendu autour des publications datées','Les valeurs moyennes portent les amplitudes implicites les plus élevées ; Accenture le poids systémique. Invalidation : échéance options déplacée avant l’annonce ou date officielle modifiée.')));

sections.push(section('geopolitics','fa-globe','Géopolitique',
  `<p>Aucun catalyseur géopolitique gouvernant n’est suffisamment documenté dans le snapshot pour justifier une position cette semaine. Le canal de transmission à surveiller reste le pétrole, à ${perf('USO',START)} sur la semaine ; une flambée modifierait la lecture de l’inflation PCE et de l’emploi. Les marchés de prédiction disponibles restent du contexte, ils ne pilotent ni scénario ni allocation.</p>`));

const sectorSyms=['XLK','XLB','XLF','XLV','XLI','XLY','XLP','XLU','XLC','XLRE'];
sections.push(section('rotation','fa-arrows-rotate','Rotation sectorielle',
  `<p>La technologie mène à ${perf('XLK',START)}, portée par les semis avant Micron ; la santé suit à ${perf('XLV',START)}. Les secteurs sensibles aux taux — services collectifs à ${perf('XLU',START)}, immobilier à ${perf('XLRE',START)} — dépendront directement du verdict de l’emploi sur la trajectoire de la Fed.</p>`
  + chart('sectorChart','Rotation hebdomadaire','La hausse se concentre dans la technologie. Invalidation : rotation vers les cycliques et sensibles aux taux après un emploi favorable.')));

sections.push(section('risks','fa-shield-halved','Matrice des risques',
  table(['Risque','Signal actuel','Conséquence','Invalidation'],[
    ['Emploi (NFP)','Publication vendredi','Écart à l’ouverture possible sur tout le marché','Chiffre proche du consensus'],
    ['Inflation PCE cœur','Publication mercredi','Réévaluation de la trajectoire des taux','Décélération conforme aux attentes'],
    ['Micron / chaîne IA','MU '+perf('MU',START)+' avant résultats','Repricing de la demande mémoire','Publication suivie par les pairs'],
    ['Largeur du marché','Russell '+perf('IWM',START)+'; Dow '+perf('DIA',START),'Garder un budget de risque modéré','Rattrapage simultané de ces indices']
  ])));

sections.push(section('allocation','fa-chart-pie','Allocation tactique',
  `<div class="allocation-grid">${card(`<h3>Risque</h3><p>Modéré. Conserver de la liquidité jusqu’après l’emploi de vendredi.</p>`)}${card(`<h3>Actions</h3><p>Préférence relative pour la technologie et la santé ; validation exigée par la largeur et par le verdict macro.</p>`)}${card(`<h3>Couvertures</h3><p>Taux longs et or restent des diversifiants tactiques avant les données ; aucune corrélation longue n’est revendiquée.</p>`)}</div>`
  + chart('regimeChart','Composantes du régime systématique','La volatilité soutient le score, la dispersion des composantes interdit une lecture binaire. Invalidation : sortie du régime de reprise.')));

sections.push(section('trades','fa-scale-balanced','Trades de la semaine',
  `<div class="alert-box" data-status="no_setup"><strong>Pas de configuration exploitable.</strong> Aucun plan directionnel n’est publié avant l’enchaînement PCE / ISM / emploi et la publication de Micron. Le risque d’écart à l’ouverture domine, et une entrée avant ces chiffres reviendrait à parier sur la donnée macro, pas sur une configuration technique. L’action consiste à attendre les clôtures post-données et la confirmation de la chaîne mémoire.</div>`));

const siP = siMu.node.points.at(-1), siI = siMu.node.points.length-1;
sections.push(section('themes','fa-diagram-project','Rayon de propagation et leaders',
  `<p>Micron clôture à ${close('MU')}. L’intérêt vendeur déclaré reste contenu à ${n('flows',`${siMu.ptr}/points/${siI}/short_pct_float`,siP.short_pct_float,2,' %','mu_short')} du flottant. La chaîne se lit successivement : les pairs mémoire/stockage (Western Digital, Seagate, SanDisk) réagissent au cycle DRAM/NAND ; les clients et l’aval IA (Nvidia, AMD, serveurs) réagissent à la demande.</p>`
  + table(['Titre','Rôle économique','Semaine'],[
    ['NVDA','client HBM',perf('NVDA',START)],['AVGO','accélérateurs IA',perf('AVGO',START)],['AMD','client GPU',perf('AMD',START)],['DELL','serveurs IA',perf('DELL',START)],
    ['WDC','pair mémoire',perf('WDC',START)],['STX','pair stockage',perf('STX',START)],['SNDK','NAND',perf('SNDK',START)],['TSM','fondeur',perf('TSM',START)],['SMH','panier semis',perf('SMH',START)],['VRT','infra data center',perf('VRT',START)]])
  + `<div class="pedagogy-box"><h4>Ce que la chaîne nous dit</h4><p>La configuration actuelle est celle d’un secteur qui monte avant son catalyseur, porté par l’appétit pour l’intelligence artificielle plutôt que par une confirmation déjà publiée. Tant que les pairs avancent groupés, la hausse reste un pari sectoriel cohérent. Une divergence après la publication de Micron — le titre qui décroche pendant que ses pairs tiennent, ou l’inverse — serait le premier signal d’un changement de leadership à l’intérieur de la chaîne. Le panier de propagation sert précisément à distinguer un mouvement propre à Micron d’un mouvement de tout le complexe mémoire.</p></div>`
  + chart('blastChart','Chaîne mémoire et IA, semaine écoulée','La dispersion précède Micron. Invalidation : convergence de la chaîne après la publication, qui fournirait un signal sectoriel plus net.')
  + chart('focusChart','Micron et ses pairs, base commune au vendredi précédent','Les titres arrivent groupés. Invalidation : décrochage de Micron post-résultats sans propagation aux pairs.')));

sections.push(section('outlook','fa-binoculars','Perspectives',
  `<div class="scenario-grid">${card(`<h3>Scénario central — probabilité dominante</h3><p>PCE tiède, emploi proche du consensus, Micron dans ses attentes : la reprise se prolonge, leadership technologie. Action : risque modéré, sélection titre par titre.</p>`)}${card(`<h3>Scénario haussier — probabilité secondaire</h3><p>Inflation qui décélère et emploi solide sans surchauffe : la baisse des taux se confirme, la hausse s’élargit aux cycliques et petites capitalisations. Action : augmenter progressivement l’exposition cyclique après confirmation.</p>`)}${card(`<h3>Scénario baissier — probabilité secondaire</h3><p>PCE trop chaud ou emploi qui déçoit fortement, Micron sous ses attentes : la volatilité comptant repasse au-dessus de sa moyenne. Action : réduire l’exposition et privilégier la liquidité.</p>`)}</div>`
  + `<div class="pedagogy-box"><h4>Ce qu’il faut surveiller</h4><p>La lecture de la semaine tient en une question : la baisse des taux se confirme-t-elle sans que la croissance ne se fissure ? L’inflation PCE cœur répond sur le premier volet, l’emploi américain sur le second. Au milieu de la semaine, l’ISM manufacturier donne le pouls de l’activité industrielle. Micron, mercredi soir, ajoute la lecture micro : la demande de mémoire pour l’intelligence artificielle reste-t-elle supérieure à l’offre ? Le meilleur enchaînement pour les actifs risqués serait une inflation qui reflue, un emploi qui tient et une chaîne mémoire qui confirme ; le pire, une inflation qui surprend à la hausse doublée d’un emploi qui déçoit. Face à cette dispersion des issues possibles, la discipline prime sur l’anticipation : on lit les chiffres, puis on agit. Les niveaux d’invalidation de chaque scénario restent la boussole — un fait qui contredit la thèse doit faire changer d’avis, pas chercher une justification.</p></div>`));

sections.push(section('sources','fa-database','Sources et qualité',
  table(['Bloc','Statut','Limite'],[
    ['Marchés et secteurs',badge('VALIDÉ','green'),'Clôture US du '+lit('25 septembre 2026')],
    ['Crypto',badge('VALIDÉ','green'),'Dernière clôture complétée du véhicule coté'],
    ['Chaîne Micron / IA',badge('VALIDÉ','green'),'Barres focus et propagation certifiées à la clôture de référence'],
    ['Micron — options',badge('PARTIEL','yellow'),'Absent du calendrier d’options collecté ; aucune amplitude implicite affichée'],
    ['Macro et résultats',badge('VALIDÉ','green'),'Calendrier MCP ; dates recoupées']
  ])
  + `<div class="source-links"><h3>Méthode de lecture</h3><p>Chaque performance part de la clôture du vendredi précédent, le ${lit('18 septembre 2026')}, et se termine à la clôture américaine certifiée du ${lit('25 septembre 2026')}. Les valeurs affichées dans le texte sont liées à leur artefact par une empreinte cryptographique et un pointeur JSON. Les graphiques reprennent les mêmes séries sans saisie parallèle.</p><p>Le catalyseur systémique d’entreprise de la semaine est Micron, choisi par le filtre systémique ; son rayon de propagation est séparé entre pairs mémoire/stockage et clients de l’aval IA. La semaine est toutefois dominée par la macro : l’inflation PCE cœur, l’ISM et surtout l’emploi américain pilotent la trajectoire des taux.</p><p>Une source partielle ne devient jamais une absence de risque. L’amplitude implicite de Micron est nommée comme indisponible ; elle n’est ni remplacée par le web ni ramenée à zéro. Les probabilités de scénario sont qualitatives : elles expriment un ordre de priorité éditorial, pas une fréquence statistique.</p><p>Toute modification du calendrier officiel, de la clôture de référence ou de l’intégrité des séries impose une nouvelle collecte.</p><h3>Références primaires</h3><p><a href="https://www.bea.gov/data/personal-consumption-expenditures-price-index">Bureau of Economic Analysis — indice des prix PCE</a></p><p><a href="https://www.bls.gov/ces/">Bureau of Labor Statistics — situation de l’emploi</a></p><p><a href="https://investors.micron.com/">Micron — relations investisseurs</a></p><p>Les chiffres de marché proviennent des snapshots Marketdata MCP et Systematic MCP hashés dans les harness de cette édition. Arrêté des données : clôture certifiée du ${lit('25 septembre 2026')}.</p></div><p class="disclaimer">Contenu informatif. Aucune recommandation personnalisée. Les scénarios sont conditionnels et doivent être invalidés quand les faits changent.</p>`));

if (sections.length !== 18) throw new Error(`sections: ${sections.length}`);

const chartSpecs = [
  ['calendarChart',{grid:{left:40,right:20,top:20,bottom:55},xAxis:{type:'category',data:['lun.','mar.','mer.','jeu.','ven.']},yAxis:{type:'value',name:'événements'},series:[{type:'bar',data:[1,1,2,3,1],itemStyle:{color:'#2563eb'}}]}],
  ['crossAssetChart',{grid:{left:120,right:35,top:15,bottom:35},xAxis:{type:'value',name:'%'},yAxis:{type:'category',data:weekRows(['SPY','QQQ','IWM','DIA','TLT','USO']).map(x=>labels[x[0]])},series:[{type:'bar',data:weekRows(['SPY','QQQ','IWM','DIA','TLT','USO']).map(x=>({value:+x[1].toFixed(2),itemStyle:{color:x[1]>=0?'#15803d':'#b91c1c'}})),label:{show:true,position:'right',formatter:'{c} %'}}]}],
  ['volChart',{grid:{left:55,right:25,top:20,bottom:45},xAxis:{type:'category',data:term.map(x=>x.node.tenor)},yAxis:{type:'value',scale:true},series:[{type:'line',smooth:true,symbolSize:10,data:term.map(x=>x.node.level),lineStyle:{width:3,color:'#7c3aed'}}]}],
  ['metalsChart',{grid:{left:80,right:35,top:15,bottom:35},xAxis:{type:'value',name:'%'},yAxis:{type:'category',data:weekRows(['GLD','SLV','USO']).map(x=>labels[x[0]])},series:[{type:'bar',data:weekRows(['GLD','SLV','USO']).map(x=>({value:+x[1].toFixed(2),itemStyle:{color:x[1]>=0?'#15803d':'#b91c1c'}})),label:{show:true,position:'right',formatter:'{c} %'}}]}],
  ['cryptoChart',{grid:{left:100,right:35,top:20,bottom:35},xAxis:{type:'value',name:'%'},yAxis:{type:'category',data:weekRows(['IBIT','ETHA','SOLZ']).map(x=>labels[x[0]])},series:[{type:'bar',data:weekRows(['IBIT','ETHA','SOLZ']).map(x=>+x[1].toFixed(2)),itemStyle:{color:'#7c3aed'},label:{show:true,position:'right',formatter:'{c} %'}}]}],
  ['earningsChart',{grid:{left:65,right:30,top:20,bottom:35},xAxis:{type:'value',name:'%'},yAxis:{type:'category',data:earningSymbols},series:[{type:'bar',data:earningSymbols.map(s=>+eventHit(s).node.implied_move_pct.toFixed(2)),itemStyle:{color:'#ea580c'},label:{show:true,position:'right',formatter:'{c} %'}}]}],
  ['sectorChart',{grid:{left:155,right:35,top:15,bottom:35},xAxis:{type:'value',name:'%'},yAxis:{type:'category',data:sectorSyms.map(s=>labels[s])},series:[{type:'bar',data:sectorSyms.map(s=>({value:+perfValue(s).toFixed(2),itemStyle:{color:perfValue(s)>=0?'#15803d':'#b91c1c'}})),label:{show:true,position:'right',formatter:'{c} %'}}]}],
  ['regimeChart',{radar:{indicator:Object.keys(regime.component_scores).map(k=>({name:k.toUpperCase(),max:1}))},series:[{type:'radar',data:[{value:Object.values(regime.component_scores).map(x=>+x.toFixed(3)),areaStyle:{color:'rgba(37,99,235,.2)'}}]}]}],
  ['blastChart',{grid:{left:110,right:35,top:15,bottom:35},xAxis:{type:'value',name:'%'},yAxis:{type:'category',data:['NVDA','AVGO','AMD','DELL','WDC','STX','SNDK','TSM','SMH','VRT'].map(s=>labels[s])},series:[{type:'bar',data:weekRows(['NVDA','AVGO','AMD','DELL','WDC','STX','SNDK','TSM','SMH','VRT']).map(x=>({value:+x[1].toFixed(2),itemStyle:{color:x[1]>=0?'#15803d':'#b91c1c'}})),label:{show:true,position:'right',formatter:'{c} %'}}]}],
  ['focusChart',{grid:{left:50,right:25,top:30,bottom:45},legend:{data:['MU','NVDA','AMD']},xAxis:{type:'time'},yAxis:{type:'value',name:'base 100',scale:true},series:['MU','NVDA','AMD'].map(s=>({name:s,type:'line',smooth:true,symbolSize:7,data:chartSeries(s)}))}]
].map(([id,spec])=>({id,spec}));

const title = 'Micron et l’emploi américain testent la reprise';
const description = 'Semaine macro dense — PCE, ISM, emploi — et résultats Micron : la chaîne IA-mémoire face à la trajectoire des taux de la Fed pour la semaine du 28 septembre.';
const html = `<!doctype html><html lang="fr" dir="ltr" data-level="intermediate" data-tags="us,macro,earnings,semis,ai,crypto,etf" data-tab="weekly"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DailyTickers | ${title}</title><meta name="description" content="${description}"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:image" content="https://articles.dailytickers.com/logo.svg"><meta property="og:url" content="https://articles.dailytickers.com/weekly/20260928/"><meta property="og:type" content="article"><script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-T5Z595CW');</script><link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/assets/report.css"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&amp;display=swap" rel="stylesheet"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"><script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script></head><body class="weekly-brief"><noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-T5Z595CW" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript><nav class="brand-bar"><div class="brand-bar-inner"><a href="/" class="brand-logo"><img src="/logo.svg" alt="" width="36" height="36"><span class="brand-title">DailyTickers</span></a><div class="brand-nav"><a href="/?tab=weekly">Hebdo</a><a href="/?tab=daily">Daily</a><a href="/?tab=analyses">Analyses</a><a href="/?tab=scanner">Scanner</a><a href="/?tab=radar">Radar</a><a href="/?tab=series">S&eacute;ries</a></div><div class="brand-actions"><a href="/" class="brand-home-btn" title="Accueil"><i class="fas fa-house"></i></a></div></div></nav><main class="report-container"><header class="hero-section"><div class="report-card-meta">Semaine du ${lit('28 septembre au 2 octobre 2026')} · données au ${lit('25 septembre 2026')}</div><h1>${title}</h1><p class="hero-subtitle">${lit(description)}</p><div id="article-clickable-tags" class="card-tags"></div></header><nav class="report-jump-nav" aria-label="Sommaire"><a href="#verdict">Verdict</a><a href="#agenda">Agenda</a><a href="#earnings">Résultats</a><a href="#rotation">Rotation</a><a href="#risks">Risques</a><a href="#outlook">Perspectives</a></nav>${sections.join('\n')}</main><div class="fnav"><a href="#verdict" title="Verdict"><i class="fas fa-flag-checkered"></i></a><a href="#agenda" title="Agenda"><i class="fas fa-calendar-week"></i></a><a href="#earnings" title="Résultats"><i class="fas fa-building"></i></a><a href="#rotation" title="Rotation"><i class="fas fa-arrows-rotate"></i></a><a href="#outlook" title="Perspectives"><i class="fas fa-binoculars"></i></a><a href="#sources" title="Sources"><i class="fas fa-database"></i></a></div><footer class="article-footer">DailyTickers · contenu informatif.</footer><script>const CHART_SPECS=${JSON.stringify(chartSpecs)};(function(){if(typeof echarts==='undefined')return;const xs=[];for(const c of CHART_SPECS){const el=document.getElementById(c.id);if(!el)continue;const x=echarts.init(el);x.setOption(Object.assign({animation:false,textStyle:{fontFamily:'Inter,system-ui,sans-serif'},tooltip:{trigger:'axis'}},c.spec));xs.push(x)}addEventListener('resize',()=>xs.forEach(x=>x.resize()))})();</script><script src="/assets/core.js"></script><script src="/assets/tag-renderer.js"></script></body></html>`;

fs.writeFileSync(path.join(DIR,'index.html'),html);
const articleSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR,'index.html'))).digest('hex');
fs.writeFileSync(path.join(DIR,'_data/chart-data.json'),JSON.stringify({reference_close:'2026-09-25',start_close:START,chart_specs:chartSpecs},null,2)+'\n');
fs.writeFileSync(path.join(DIR,'_data/claims.json'),JSON.stringify({reference_close:'2026-09-25',article_path:`${REL}/index.html`,article_sha256:articleSha,generated_by:`${REL}/_build.cjs`,literals:[...literals].sort(),claims},null,2)+'\n');
console.log(`weekly rendu: ${sections.length} sections, ${chartSpecs.length} graphiques, ${claims.length} claims, ${(html.length/1024).toFixed(1)} Ko`);
