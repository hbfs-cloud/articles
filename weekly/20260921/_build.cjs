#!/usr/bin/env node
'use strict';

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { renderValue } = require('../../tools/validate-content-claims');

const ROOT = path.resolve(__dirname, '../..');
const REL = 'weekly/20260921';
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
    && x.event_time.slice(0, 10) >= '2026-09-21' && x.event_time.slice(0, 10) <= '2026-09-25');
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
const tm = (key, pointer, value, zone = 'Europe/Paris', stem = 'time') => claim(key, pointer, value, { format: 'fr_time', zone }, stem);
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
function eventValue(symbol, field, decimals, suffix, stem) {
  const h = eventHit(symbol); return n(h.key, `${h.ptr}/${field}`, h.node[field], decimals, suffix, stem || `${symbol}_${field}`);
}

const START = '2026-09-11';
const labels = { SPY:'S&P 500', QQQ:'Nasdaq 100', IWM:'Russell 2000', DIA:'Dow Jones', GLD:'Or', SLV:'Argent', TLT:'Taux longs', USO:'Pétrole', XLK:'Technologie', XLB:'Matériaux', XLF:'Finance', XLV:'Santé', XLI:'Industrie', XLY:'Consommation discrétionnaire', XLP:'Consommation de base', XLU:'Services collectifs', XLC:'Communication', XLRE:'Immobilier', IBIT:'Bitcoin', ETHA:'Ethereum', SOLZ:'Solana', COST:'Costco', CTAS:'Cintas', WMT:'Walmart', KR:'Kroger', DG:'Dollar General', DLTR:'Dollar Tree', PG:'Procter & Gamble', PEP:'PepsiCo', CAG:'Conagra', KO:'Coca-Cola' };
const perfValue = symbol => { const b = barHit(symbol).node.bars, j = b.findIndex(x => x[0] === START); return (b.at(-1)[4] / b[j][4] - 1) * 100; };
const chartSeries = symbol => { const b = barHit(symbol).node.bars.filter(x => x[0] >= START); const base = b[0][4]; return b.map(x => [x[0], +(x[4] / base * 100).toFixed(3)]); };
const weekRows = syms => syms.map(s => [s, perfValue(s)]);

const cost = eventHit('COST');
const ctas = eventHit('CTAS');
const regime = objectHit('regime', x => x && x.dtx_regime && x.dtx_detail === undefined, 'régime').node.dtx_regime;
const regimeRoot = objectHit('regime', x => x && x.dtx_regime && x.dtx_detail === undefined, 'régime');
const techCost = objectHit('technicals', x => x && x.symbol === 'COST' && x.type === 'instrument_quote', 'quote COST');
const techCtas = objectHit('technicals', x => x && x.symbol === 'CTAS' && x.type === 'instrument_quote', 'quote CTAS');
const siCost = objectHit('flows', x => x && x.symbol === 'COST' && x.type === 'instrument_short_interest_series', 'short COST');
const siCtas = objectHit('flows', x => x && x.symbol === 'CTAS' && x.type === 'instrument_short_interest_series', 'short CTAS');
const term = all(D.options, x => x && x.type === 'term_structure_point');
const eventSymbols = ['ABVX','AZO','GIS','CTAS','PAYX','DRI','SNX','COST'];
const macroNames = ['Euro Area Flash PMI (HCOB)','Initial Jobless Claims','German ifo Business Climate','Michigan Consumer Sentiment (final)'];
const macroLabels = {
  'Euro Area Flash PMI (HCOB)': 'PMI flash de la zone euro',
  'Initial Jobless Claims': 'Nouvelles demandes d’allocation chômage',
  'German ifo Business Climate': 'Indice ifo du climat des affaires allemand',
  'Michigan Consumer Sentiment (final)': 'Confiance des consommateurs du Michigan (final)'
};

function chart(id, title, note, spec) {
  return `<figure class="chart-card"><h3>${title}</h3><div id="${id}" class="echart-box" style="width:100%;height:360px"></div><figcaption><strong>Lecture :</strong> ${note}</figcaption></figure>`;
}
function section(id, icon, title, body) { return `<section id="${id}" class="report-section"><h2><i class="fas ${icon}"></i> ${title}</h2>${body}</section>`; }
function card(body, cls='insight-card') { return `<div class="${cls}">${body}</div>`; }
function table(headers, rows) { return `<div class="table-wrap"><table><thead><tr>${headers.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(x=>`<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; }
const badge = (text, tone='blue') => `<span class="badge badge-${tone}">${text}</span>`;

const sections = [];
sections.push(section('verdict','fa-flag-checkered','Verdict',
  `<div class="decision-banner"><div class="decision-label">DÉCISION</div><div class="decision-value">ATTENDRE LA PREUVE DU CONSOMMATEUR</div><p>Le Nasdaq a gagné ${perf('QQQ',START)} tandis que les petites capitalisations ont perdu ${perf('IWM',START)}. La force reste étroite. Costco devient le test de diffusion jeudi après clôture : une réaction contenue avec des pairs stables prolongerait le régime; une rupture du panier consommation invaliderait cette lecture.</p></div>`
  + `<div class="stats-grid">${card(`<span class="stat-label">COST, mouvement attendu par les options</span><strong>${eventValue('COST','implied_move_pct',1,' %','cost_move')}</strong>`)}${card(`<span class="stat-label">COST, capitalisation</span><strong>${eventValue('COST','market_cap_b',0,' Md$','cost_cap')}</strong>`)}${card(`<span class="stat-label">Régime systématique</span><strong>${claim('regime',`${regimeRoot.ptr}/dtx_regime/regime_score`,regime.regime_score,{scale:100,decimals:0,suffix:' %',format:'fr'},'regime_score')}</strong>`)}</div>`));

sections.push(section('fab','fa-crosshairs','FAB — ce qui mérite une action',
  `<div class="scenario-grid">${card(`<h3>Avant les résultats</h3><p>Réduire les paris directionnels sur COST. Le titre clôture à ${close('COST')} et recule de ${perf('COST',START)} sur la semaine. La série longue comporte une anomalie d’échelle; aucun niveau technique long n’est publié.</p>`)}${card(`<h3>Après les résultats</h3><p>Lire ensemble COST, Walmart, Kroger, Dollar General et Dollar Tree. La dispersion préexistante interdit de traiter le commerce de détail comme un bloc homogène.</p>`)}${card(`<h3>Signal contraire</h3><p>Une réaction positive de COST accompagnée d’une amélioration des petites capitalisations rendrait la largeur du marché plus crédible. Sans cette confirmation, la technologie reste une poche, pas un régime large.</p>`)}</div>`));

sections.push(section('alerte','fa-triangle-exclamation','Alerte données',
  `<div class="alert-box" data-status="PARTIEL"><strong>PARTIEL.</strong> La rotation énergie est INDISPONIBLE : XLE a échoué au contrôle de barre après rafraîchissement. La corrélation longue de l’or est aussi écartée après un défaut de continuité GLD. Enfin, la barre COST du ${lit('21 août 2026')} porte une échelle incohérente; les lectures COST sont limitées aux clôtures saines depuis le ${lit('11 septembre 2026')}.</div>`));

const macroRows = macroNames.map(name => { const h=econHit(name); return [dt('economic',`${h.ptr}/event_time`,h.node.event_time,'weekday_day_month','macro_date'),tm('economic',`${h.ptr}/event_time`,h.node.event_time,'Europe/Paris','macro_time'),macroLabels[name]]; });
const agendaCards = macroRows.map(([date,time,event]) => card(`<div class="stat-label">${date} · ${time}</div><h3>${event}</h3>`)).join('');
sections.push(section('agenda','fa-calendar-week','Agenda de la semaine',
  `<p>La semaine est moins chargée que la précédente. Les indicateurs d’activité précèdent le test consommation de Costco, puis les enquêtes de confiance ferment la séquence.</p>`
  + `<div class="scenario-grid" aria-label="Rendez-vous macroéconomiques">${agendaCards}</div>`
  + chart('calendarChart','Concentration des rendez-vous','Le milieu de semaine concentre macro et résultats. Invalidation : un report officiel de calendrier rend ce séquençage caduc.',{grid:{left:40,right:20,top:20,bottom:55},xAxis:{type:'category',data:['lun.','mar.','mer.','jeu.','ven.']},yAxis:{type:'value',name:'événements'},series:[{type:'bar',data:[1,1,4,4,2],itemStyle:{color:'#2563eb'}}]})));

sections.push(section('executive-summary','fa-list-check','Synthèse exécutive',
  `<ul class="key-list"><li>Le leadership hebdomadaire oppose la santé à ${perf('XLV',START)} et la technologie à ${perf('XLK',START)} aux financières à ${perf('XLF',START)}.</li><li>La courbe de volatilité reste croissante du très court au semestre; le calme immédiat ne supprime pas la prime de durée.</li><li>Le crypto accélère alors que le Russell et le Dow reculent. Cette divergence est un signal de concentration spéculative, pas une confirmation cyclique.</li><li>Le commerce de détail présente déjà une forte dispersion. Le résultat COST sert de test sur le trafic, le panier et le pouvoir de fixation des prix.</li></ul>`));

sections.push(section('bilan','fa-clock-rotate-left','Bilan de la semaine écoulée',
  `<p>Le scénario de revalorisation large après la Fed n’est pas confirmé. Le S&P termine à ${perf('SPY',START)}, le Dow à ${perf('DIA',START)} et le Russell à ${perf('IWM',START)}, malgré le Nasdaq à ${perf('QQQ',START)}. La lecture correcte est une hausse concentrée, avec une validation cyclique absente.</p>`
  + chart('crossAssetChart','Performance depuis la clôture du vendredi précédent','Le Nasdaq résiste, tandis que les indices plus larges reculent. Invalidation : un rattrapage simultané du Russell et du Dow.',{grid:{left:120,right:35,top:15,bottom:35},xAxis:{type:'value',name:'%'},yAxis:{type:'category',data:weekRows(['SPY','QQQ','IWM','DIA','TLT','USO']).map(x=>labels[x[0]])},series:[{type:'bar',data:weekRows(['SPY','QQQ','IWM','DIA','TLT','USO']).map(x=>({value:+x[1].toFixed(2),itemStyle:{color:x[1]>=0?'#15803d':'#b91c1c'}})),label:{show:true,position:'right',formatter:p=>`${p.value.toFixed(1)} %`}}]})));

sections.push(section('macro','fa-landmark','Macro et taux',
  `<p>Les obligations longues progressent de ${perf('TLT',START)}. Le régime systématique cote la volatilité comptant à ${n('regime',`${regimeRoot.ptr}/dtx_regime/dtx_detail/vix_level`,regime.dtx_detail.vix_level,2,'','vix_spot')}, sous sa moyenne mobile à ${n('regime',`${regimeRoot.ptr}/dtx_regime/dtx_detail/vix_sma14`,regime.dtx_detail.vix_sma14,2,'','vix_avg')}. Le signal autorise le risque, mais la faiblesse des financières et des petites capitalisations impose une taille modérée.</p>`
  + chart('volChart','Structure par terme de la volatilité','La pente est positive : la protection éloignée coûte davantage. Invalidation : inversion franche de la courbe ou rupture du comptant au-dessus de sa moyenne.',{grid:{left:55,right:25,top:20,bottom:45},xAxis:{type:'category',data:term.map(x=>x.node.tenor)},yAxis:{type:'value',scale:true},series:[{type:'line',smooth:true,symbolSize:10,data:term.map(x=>x.node.level),lineStyle:{width:3,color:'#7c3aed'}}]})));

sections.push(section('metaux','fa-coins','Métaux et matières premières',
  `<p>L’or gagne ${perf('GLD',START)} et l’argent ${perf('SLV',START)}, contre ${perf('USO',START)} pour le pétrole coté via USO. L’argent mène nettement : ce différentiel peut refléter un mélange de demande monétaire et de sensibilité à l’activité industrielle. La corrélation longue GLD reste INDISPONIBLE; aucune conclusion de diversification n’en est tirée.</p>`));

sections.push(section('crypto','fa-bitcoin-sign','Crypto',
  `<p>Bitcoin gagne ${perf('IBIT',START)}, Ethereum ${perf('ETHA',START)} et Solana ${perf('SOLZ',START)} via leurs véhicules cotés. La hiérarchie favorise l’actif le plus sensible aux mouvements du marché, alors que la largeur des actions se dégrade. Une poursuite sans amélioration du Russell augmenterait le risque de retour brutal à la moyenne.</p>`
  + chart('cryptoChart','Crypto coté : accélération des actifs les plus sensibles','Solana domine la semaine. Invalidation : repli simultané de chaque véhicule sous sa base du vendredi précédent.',{grid:{left:100,right:35,top:20,bottom:35},xAxis:{type:'value',name:'%'},yAxis:{type:'category',data:weekRows(['IBIT','ETHA','SOLZ']).map(x=>labels[x[0]])},series:[{type:'bar',data:weekRows(['IBIT','ETHA','SOLZ']).map(x=>+x[1].toFixed(2)),itemStyle:{color:'#7c3aed'},label:{show:true,position:'right',formatter:p=>`${p.value.toFixed(1)} %`}}]})));

const earningsRows = eventSymbols.map(s=>{const h=eventHit(s);return [s,dt('earnings',`${h.ptr}/report_date`,h.node.report_date,'weekday_day_month',`earn_date_${s}`),h.node.report_time==='BMO'?'avant ouverture':'après clôture',n('earnings',`${h.ptr}/implied_move_pct`,h.node.implied_move_pct,1,' %',`earn_move_${s}`),n('earnings',`${h.ptr}/market_cap_b`,h.node.market_cap_b,0,' Md$',`earn_cap_${s}`)];});
sections.push(section('earnings','fa-building','Résultats : COST porte le risque systémique',
  `<p>Costco publie le ${dt('earnings',`${cost.ptr}/report_date`,cost.node.report_date,'weekday_day_month','cost_date')} après clôture. Son mouvement attendu par les options, ${eventValue('COST','implied_move_pct',1,' %','cost_move_bis')}, est le plus faible du groupe, mais sa capitalisation de ${eventValue('COST','market_cap_b',0,' Md$','cost_cap_bis')} lui donne le rayon de propagation le plus large.</p>`
  + table(['Titre','Date','Moment','Mouvement attendu','Capitalisation'],earningsRows)
  + chart('earningsChart','Mouvement attendu autour des publications','AZO et SNX portent les mouvements attendus les plus élevés, COST le poids systémique. Invalidation : échéance options déplacée avant l’annonce ou date officielle modifiée.',{grid:{left:65,right:30,top:20,bottom:35},xAxis:{type:'value',name:'%'},yAxis:{type:'category',data:eventSymbols},series:[{type:'bar',data:eventSymbols.map(s=>+eventHit(s).node.implied_move_pct.toFixed(2)),itemStyle:{color:'#ea580c'},label:{show:true,position:'right',formatter:p=>`${p.value.toFixed(1)} %`}}]})));

sections.push(section('geopolitics','fa-globe','Géopolitique',
  `<p>Aucun catalyseur géopolitique gouvernant n’est suffisamment documenté dans le snapshot pour justifier une position. Les marchés de prédiction disponibles sont partiels et leur scan est tronqué; ils restent du contexte et ne pilotent ni scénario ni allocation. Le canal de transmission à surveiller reste le pétrole, actuellement à ${perf('USO',START)} sur la semaine.</p>`));

const sectorSyms=['XLK','XLB','XLF','XLV','XLI','XLY','XLP','XLU','XLC','XLRE'];
sections.push(section('rotation','fa-arrows-rotate','Rotation sectorielle',
  `<p>La santé mène à ${perf('XLV',START)}, devant la technologie à ${perf('XLK',START)}. Les services collectifs ferment la marche à ${perf('XLU',START)}. L’énergie est volontairement absente après échec de qualité; son omission est une limite, pas une neutralité.</p>`
  + chart('sectorChart','Rotation hebdomadaire hors énergie','La hausse se concentre dans la santé et la technologie. Invalidation : retour concerté des secteurs cycliques au-dessus du marché.',{grid:{left:155,right:35,top:15,bottom:35},xAxis:{type:'value',name:'%'},yAxis:{type:'category',data:sectorSyms.map(s=>labels[s])},series:[{type:'bar',data:sectorSyms.map(s=>({value:+perfValue(s).toFixed(2),itemStyle:{color:perfValue(s)>=0?'#15803d':'#b91c1c'}})),label:{show:true,position:'right',formatter:p=>`${p.value.toFixed(1)} %`}}]})));

sections.push(section('risks','fa-shield-halved','Matrice des risques',
  table(['Risque','Signal actuel','Conséquence','Invalidation'],[
    ['Largeur du marché','Russell '+perf('IWM',START)+'; Dow '+perf('DIA',START),'Garder un budget de risque modéré','Rattrapage simultané de ces indices'],
    ['Consommateur','DLTR '+perf('DLTR',START)+'; PEP '+perf('PEP',START),'Éviter le pari sectoriel uniforme','Diffusion positive après COST'],
    ['Volatilité','Comptant sous moyenne','Coût immédiat de protection contenu','Courbe inversée'],
    ['Qualité des données COST','Anomalie historique détectée','Pas de niveau long ni amplitude quotidienne moyenne publiée','Série réconciliée après l’opération sur titre']
  ])));

sections.push(section('allocation','fa-chart-pie','Allocation tactique',
  `<div class="allocation-grid">${card(`<h3>Risque</h3><p>Modéré. Conserver de la liquidité jusqu’à la publication COST.</p>`)}${card(`<h3>Actions</h3><p>Préférence relative pour santé et technologie, avec validation exigée par la largeur.</p>`)}${card(`<h3>Couvertures</h3><p>Taux longs et métaux restent des diversifiants tactiques; aucune corrélation longue GLD n’est revendiquée.</p>`)}</div>`
  + chart('regimeChart','Composantes du régime systématique','La volatilité soutient le score, la dispersion des composantes interdit une lecture binaire. Invalidation : sortie du régime de reprise.',{radar:{indicator:Object.keys(regime.component_scores).map(k=>({name:k.toUpperCase(),max:1}))},series:[{type:'radar',data:[{value:Object.values(regime.component_scores).map(x=>+x.toFixed(3)),areaStyle:{color:'rgba(37,99,235,.2)'}}]}]})));

sections.push(section('trades','fa-scale-balanced','Trades de la semaine',
  `<div class="alert-box" data-status="no_setup"><strong>Pas de configuration exploitable.</strong> Aucun plan directionnel n’est publié avant COST. L’écart de cours possible à l’ouverture après l’annonce domine le risque, les niveaux techniques longs COST sont contaminés par l’anomalie d’échelle et CTAS publie également pendant la semaine. L’action consiste à attendre une clôture post-annonce et la confirmation du panier.</div>`));

const siCp=siCost.node.points.at(-1), siCi=siCost.node.points.length-1, siTp=siCtas.node.points.at(-1), siTi=siCtas.node.points.length-1;
sections.push(section('themes','fa-diagram-project','Rayon de propagation et leaders',
  `<p>COST clôture à ${close('COST')} et CTAS à ${close('CTAS')}. L’intérêt vendeur déclaré reste contenu sur COST à ${n('flows',`${siCost.ptr}/points/${siCi}/short_pct_float`,siCp.short_pct_float,2,' %','cost_short')}, contre ${n('flows',`${siCtas.ptr}/points/${siTi}/short_pct_float`,siTp.short_pct_float,2,' %','ctas_short')} pour CTAS.</p>`
  + table(['Titre','Rôle économique','Semaine'],[['WMT','concurrent direct',perf('WMT',START)],['KR','épicerie',perf('KR',START)],['DG','valeur',perf('DG',START)],['DLTR','valeur',perf('DLTR',START)],['PG','fournisseur',perf('PG',START)],['PEP','fournisseur',perf('PEP',START)],['CAG','alimentation emballée',perf('CAG',START)],['KO','boissons',perf('KO',START)]])
  + chart('blastChart','Panier de propagation consommation','La dispersion est déjà élevée avant COST. Invalidation : convergence du panier après la publication, qui fournirait un signal sectoriel plus propre.',{grid:{left:75,right:35,top:15,bottom:35},xAxis:{type:'value',name:'%'},yAxis:{type:'category',data:['WMT','KR','DG','DLTR','PG','PEP','CAG','KO']},series:[{type:'bar',data:weekRows(['WMT','KR','DG','DLTR','PG','PEP','CAG','KO']).map(x=>({value:+x[1].toFixed(2),itemStyle:{color:x[1]>=0?'#15803d':'#b91c1c'}})),label:{show:true,position:'right',formatter:p=>`${p.value.toFixed(1)} %`}}]}))
  + chart('focusChart','COST et CTAS, base commune au vendredi précédent','Les titres arrivent en repli. Invalidation : clôture post-résultats au-dessus de la base pour l’un sans propagation aux pairs.',{grid:{left:50,right:25,top:30,bottom:45},legend:{data:['COST','CTAS']},xAxis:{type:'time'},yAxis:{type:'value',name:'base 100',scale:true},series:['COST','CTAS'].map(s=>({name:s,type:'line',smooth:true,symbolSize:7,data:chartSeries(s)}))}));

sections.push(section('outlook','fa-binoculars','Perspectives',
  `<div class="scenario-grid">${card(`<h3>Scénario central — probabilité dominante</h3><p>COST reste dans le mouvement attendu par les options, le panier demeure dispersé et le Nasdaq conserve son leadership. Action : risque modéré, sélection titre par titre.</p>`)}${card(`<h3>Scénario haussier — probabilité secondaire</h3><p>COST dépasse les attentes et entraîne les détaillants, tandis que Russell et financières rebondissent. Action : augmenter progressivement l’exposition cyclique après clôture confirmée.</p>`)}${card(`<h3>Scénario baissier — probabilité secondaire</h3><p>COST baisse au-delà du mouvement attendu par les options, les fournisseurs reculent et la volatilité comptant franchit sa moyenne. Action : réduire l’exposition au risque et privilégier la liquidité.</p>`)}</div>`));

sections.push(section('sources','fa-database','Sources et qualité',
  table(['Bloc','Statut','Limite'],[
    ['Marchés et secteurs',badge('VALIDÉ','green'),'Clôture US du '+lit('18 septembre 2026')+'; XLE exclu'],
    ['Crypto',badge('VALIDÉ','green'),'Dernière clôture complétée du véhicule coté'],
    ['COST et propagation',badge('PARTIEL','yellow'),'Fenêtre récente saine; historique COST long exclu'],
    ['Macro et résultats',badge('VALIDÉ','green'),'Calendrier MCP, dates société recoupées pour COST'],
    ['Corrélations',badge('PARTIEL','yellow'),'GLD long indisponible après défaut de continuité']
  ])
  + `<div class="source-links"><h3>Méthode de lecture</h3><p>Chaque performance part de la clôture du vendredi précédent et se termine à la clôture américaine certifiée. Les valeurs affichées dans le texte sont liées à leur artefact par une empreinte cryptographique et un pointeur JSON. Les graphiques reprennent les mêmes séries sans saisie parallèle.</p><p>Le catalyseur systémique est choisi par portée économique, puis son rayon de propagation est séparé entre concurrents directs et fournisseurs. Cette hiérarchie explique pourquoi Costco reste le centre de la semaine malgré un mouvement attendu par les options inférieur à celui de titres plus petits.</p><p>Une source partielle ne devient jamais une absence de risque. XLE, la corrélation longue GLD et les indicateurs longs COST sont nommés comme indisponibles. Ils ne sont ni remplacés par le web, ni ramenés à zéro, ni utilisés pour ordonner les secteurs.</p><p>Le calendrier officiel courant de la Réserve fédérale ne confirme pas les prises de parole remontées par le flux MCP pour cette semaine; ces items sont donc exclus de l’agenda décisionnel. Les probabilités de scénario sont qualitatives. Elles expriment un ordre de priorité éditorial, pas une fréquence statistique ni une prévision calibrée.</p><p>Toute modification du calendrier officiel, de la clôture de référence ou de l’intégrité des séries impose une nouvelle collecte.</p><h3>Références primaires</h3><p><a href="https://investor.costco.com/events-and-presentations/default.aspx?c=83830&amp;p=irol-audioarchives">Costco Investor Relations — résultats et webcast</a></p><p><a href="https://www.federalreserve.gov/newsevents/calendar.htm">Federal Reserve — calendrier officiel</a></p><p>Les chiffres de marché proviennent des snapshots Marketdata MCP et Systematic MCP hashés dans les harness de cette édition. Arrêté des données : clôture certifiée du ${lit('18 septembre 2026')}.</p></div><p class="disclaimer">Contenu informatif. Aucune recommandation personnalisée. Les scénarios sont conditionnels et doivent être invalidés quand les faits changent.</p>`));

if (sections.length !== 18) throw new Error(`sections: ${sections.length}`);
const charts = [];
for (const m of sections.join('').matchAll(/<div id="([^"]+)" class="echart-box"[^>]*><\/div>[\s\S]*?<figcaption>/g)) void m;
// Les options sont extraites du HTML construit plus haut via un registre explicite injecté ci-dessous.
const chartSpecs = [
  ['calendarChart',{grid:{left:40,right:20,top:20,bottom:55},xAxis:{type:'category',data:['lun.','mar.','mer.','jeu.','ven.']},yAxis:{type:'value',name:'événements'},series:[{type:'bar',data:[1,1,4,4,2],itemStyle:{color:'#2563eb'}}]}],
  ['crossAssetChart',{grid:{left:120,right:35,top:15,bottom:35},xAxis:{type:'value',name:'%'},yAxis:{type:'category',data:weekRows(['SPY','QQQ','IWM','DIA','TLT','USO']).map(x=>labels[x[0]])},series:[{type:'bar',data:weekRows(['SPY','QQQ','IWM','DIA','TLT','USO']).map(x=>({value:+x[1].toFixed(2),itemStyle:{color:x[1]>=0?'#15803d':'#b91c1c'}})),label:{show:true,position:'right',formatter:'{c} %'}}]}],
  ['volChart',{grid:{left:55,right:25,top:20,bottom:45},xAxis:{type:'category',data:term.map(x=>x.node.tenor)},yAxis:{type:'value',scale:true},series:[{type:'line',smooth:true,symbolSize:10,data:term.map(x=>x.node.level),lineStyle:{width:3,color:'#7c3aed'}}]}],
  ['cryptoChart',{grid:{left:100,right:35,top:20,bottom:35},xAxis:{type:'value',name:'%'},yAxis:{type:'category',data:weekRows(['IBIT','ETHA','SOLZ']).map(x=>labels[x[0]])},series:[{type:'bar',data:weekRows(['IBIT','ETHA','SOLZ']).map(x=>+x[1].toFixed(2)),itemStyle:{color:'#7c3aed'},label:{show:true,position:'right',formatter:'{c} %'}}]}],
  ['earningsChart',{grid:{left:65,right:30,top:20,bottom:35},xAxis:{type:'value',name:'%'},yAxis:{type:'category',data:eventSymbols},series:[{type:'bar',data:eventSymbols.map(s=>+eventHit(s).node.implied_move_pct.toFixed(2)),itemStyle:{color:'#ea580c'},label:{show:true,position:'right',formatter:'{c} %'}}]}],
  ['sectorChart',{grid:{left:155,right:35,top:15,bottom:35},xAxis:{type:'value',name:'%'},yAxis:{type:'category',data:sectorSyms.map(s=>labels[s])},series:[{type:'bar',data:sectorSyms.map(s=>({value:+perfValue(s).toFixed(2),itemStyle:{color:perfValue(s)>=0?'#15803d':'#b91c1c'}})),label:{show:true,position:'right',formatter:'{c} %'}}]}],
  ['regimeChart',{radar:{indicator:Object.keys(regime.component_scores).map(k=>({name:k.toUpperCase(),max:1}))},series:[{type:'radar',data:[{value:Object.values(regime.component_scores).map(x=>+x.toFixed(3)),areaStyle:{color:'rgba(37,99,235,.2)'}}]}]}],
  ['blastChart',{grid:{left:75,right:35,top:15,bottom:35},xAxis:{type:'value',name:'%'},yAxis:{type:'category',data:['WMT','KR','DG','DLTR','PG','PEP','CAG','KO']},series:[{type:'bar',data:weekRows(['WMT','KR','DG','DLTR','PG','PEP','CAG','KO']).map(x=>({value:+x[1].toFixed(2),itemStyle:{color:x[1]>=0?'#15803d':'#b91c1c'}})),label:{show:true,position:'right',formatter:'{c} %'}}]}],
  ['focusChart',{grid:{left:50,right:25,top:30,bottom:45},legend:{data:['COST','CTAS']},xAxis:{type:'time'},yAxis:{type:'value',name:'base 100',scale:true},series:['COST','CTAS'].map(s=>({name:s,type:'line',smooth:true,symbolSize:7,data:chartSeries(s)}))}]
].map(([id,spec])=>({id,spec}));

const title = 'Costco teste la largeur du marché';
const description = 'La technologie tient, le marché large recule et Costco devient le test consommation de la semaine du 21 septembre.';
const html = `<!doctype html><html lang="fr" dir="ltr" data-level="intermediate" data-tags="us,macro,earnings,consumer,crypto,etf" data-tab="weekly"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DailyTickers | ${title}</title><meta name="description" content="${description}"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:image" content="https://articles.dailytickers.com/logo.svg"><meta property="og:url" content="https://articles.dailytickers.com/weekly/20260921/"><meta property="og:type" content="article"><script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-T5Z595CW');</script><link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/assets/report.css"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&amp;display=swap" rel="stylesheet"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"><script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script></head><body class="weekly-brief"><noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-T5Z595CW" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript><nav class="brand-bar"><div class="brand-bar-inner"><a href="/" class="brand-logo"><img src="/logo.svg" alt="" width="36" height="36"><span class="brand-title">DailyTickers</span></a><div class="brand-nav"><a href="/?tab=weekly">Hebdo</a><a href="/?tab=daily">Daily</a><a href="/?tab=analyses">Analyses</a><a href="/?tab=scanner">Scanner</a><a href="/?tab=radar">Radar</a></div></div></nav><main class="report-container"><header class="hero-section"><div class="report-card-meta">Semaine du ${lit('21 au 25 septembre 2026')} · données au ${lit('18 septembre 2026')}</div><h1>${title}</h1><p class="hero-subtitle">${lit(description)}</p><div id="article-clickable-tags" class="card-tags"></div></header><nav class="report-jump-nav" aria-label="Sommaire"><a href="#verdict">Verdict</a><a href="#agenda">Agenda</a><a href="#earnings">Résultats</a><a href="#rotation">Rotation</a><a href="#risks">Risques</a><a href="#outlook">Perspectives</a></nav>${sections.join('\n')}</main><div class="fnav"><a href="#verdict" title="Verdict"><i class="fas fa-flag-checkered"></i></a><a href="#agenda" title="Agenda"><i class="fas fa-calendar-week"></i></a><a href="#earnings" title="Résultats"><i class="fas fa-building"></i></a><a href="#rotation" title="Rotation"><i class="fas fa-arrows-rotate"></i></a><a href="#outlook" title="Perspectives"><i class="fas fa-binoculars"></i></a><a href="#sources" title="Sources"><i class="fas fa-database"></i></a></div><footer class="article-footer">DailyTickers · contenu informatif.</footer><script>const CHART_SPECS=${JSON.stringify(chartSpecs,null,2)};(function(){if(typeof echarts==='undefined')return;const xs=[];for(const c of CHART_SPECS){const el=document.getElementById(c.id);if(!el)continue;const x=echarts.init(el);x.setOption(Object.assign({animation:false,textStyle:{fontFamily:'Inter,system-ui,sans-serif'},tooltip:{trigger:'axis'}},c.spec));xs.push(x)}addEventListener('resize',()=>xs.forEach(x=>x.resize()))})();</script><script src="/assets/core.js"></script><script src="/assets/tag-renderer.js"></script></body></html>`;

fs.writeFileSync(path.join(DIR,'index.html'),html);
const articleSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR,'index.html'))).digest('hex');
fs.writeFileSync(path.join(DIR,'_data/chart-data.json'),JSON.stringify({reference_close:'2026-09-18',start_close:START,chart_specs:chartSpecs},null,2)+'\n');
fs.writeFileSync(path.join(DIR,'_data/claims.json'),JSON.stringify({reference_close:'2026-09-18',article_path:`${REL}/index.html`,article_sha256:articleSha,generated_by:`${REL}/_build.cjs`,literals:[...literals].sort(),claims},null,2)+'\n');
console.log(`weekly rendu: ${sections.length} sections, ${chartSpecs.length} graphiques, ${claims.length} claims, ${(html.length/1024).toFixed(1)} Ko`);
