#!/usr/bin/env node
/**
 * render-scanner.js — DailyTickers Scanner JSON → HTML Renderer
 *
 * Usage:  node tools/render-scanner.js scanner/YYYYMMDD/
 *         node tools/render-scanner.js scanner/YYYYMMDD/data.json
 *
 * Reads  scanner/YYYYMMDD/data.json (schema: scanner/template/schema.json)
 * Writes scanner/YYYYMMDD/index.html
 *
 * Pure Node.js — no npm dependencies.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── CLI ────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const STRICT = argv.includes('--strict');
const arg = argv.find(a => !a.startsWith('--'));
if (!arg) {
  console.error('Usage: node tools/render-scanner.js scanner/YYYYMMDD/ [--strict]');
  process.exit(1);
}

const isJsonArg = arg.endsWith('.json');
const dataPath  = isJsonArg ? arg : path.join(arg.replace(/\/$/, ''), 'data.json');
const outDir    = isJsonArg ? path.dirname(arg) : arg.replace(/\/$/, '');
const outPath   = path.join(outDir, 'index.html');

if (!fs.existsSync(dataPath)) {
  console.error('Error: data.json not found at', dataPath);
  process.exit(1);
}

const d = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// ─── STRICT DATA-QUALITY GUARDS ─────────────────────────────────────────────
// Le renderer ne réencode/ne transforme JAMAIS le texte issu de data.json (esc()
// ci-dessous est un simple coerce-to-string, aucune translittération ASCII).
// Si data.json arrive déjà désaccentué ou tronqué (bug amont — la session LLM qui
// génère le scan a écrit de l'ASCII pur, ou un champ résumé a été coupé avant
// écriture), le renderer ne DOIT PAS deviner/reconstruire le texte correct : deviner
// des accents ou compléter une phrase tronquée serait une forme d'hallucination de
// contenu (règle "No Hallucination" du projet). À la place :
//   - il détecte et log l'anomalie (bloquant en --strict, avertissement sinon)
//   - il applique un fallback DÉGRADÉ mais non-inventé (voir setupPhrase() plus bas :
//     retombe sur un autre champ déjà présent dans data.json, jamais du texte généré)
// Le vrai fix est en amont : la génération de data.json doit écrire l'UTF-8 accentué
// et ne jamais couper une chaîne au milieu d'un mot/d'une parenthèse.

const FR_UNACCENTED_WORDS = [
  'regime', 'echelle', 'cloture', 'defensivite', 'europeen', 'europeens', 'europeenne', 'europeennes',
  'amerique', 'amelioration', 'apres', 'beneficiaire', 'benefice', 'benefices', 'completent', 'confirmee',
  'couts', 'credit', 'defensif', 'desendettement', 'detail', 'diversifiee', 'electronique', 'eleve',
  'entrees', 'equivalent', 'etendu', 'etendus', 'eviter', 'execution', 'fenetre', 'generation',
  'geographique', 'interet', 'lecon', 'liquidite', 'maitrisee', 'malgre', 'marche', 'marches', 'marquee',
  'metaux', 'modele', 'operateur', 'operationnelle', 'opere', 'portee', 'portees', 'precieux',
  'privilegie', 'privilegier', 'probabilites', 'reduite', 'reintegration', 'remuneres', 'resilient',
  'resilients', 'resultat', 'resultats', 'sante', 'seance', 'selection', 'separation', 'strategie',
  'telecom', 'themes', 'unites', 'volatilite', 'annee', 'annees', 'deja', 'egalement', 'tres',
  'precedent', 'precedente', 'general', 'generale', 'generales', 'severite', 'reference', 'references',
];
const FR_UNACCENTED_RE = new RegExp('\\b(' + FR_UNACCENTED_WORDS.join('|') + ')\\b', 'gi');

/** Recursively collect every string value in a JSON tree (skips keys/numbers/booleans). */
function collectStrings(obj, out) {
  if (obj == null) return out;
  if (typeof obj === 'string') { out.push(obj); return out; }
  if (Array.isArray(obj)) { obj.forEach(v => collectStrings(v, out)); return out; }
  if (typeof obj === 'object') { for (const k of Object.keys(obj)) collectStrings(obj[k], out); return out; }
  return out;
}

/** true if a string has an unmatched opening "(" — strong signal it was cut mid-clause */
function looksTruncated(s) {
  if (!s) return false;
  const opens  = (s.match(/\(/g)  || []).length;
  const closes = (s.match(/\)/g) || []).length;
  return opens > closes;
}

// Noms propres qui collisionnent avec la liste FR_UNACCENTED_WORDS (match insensible à la casse) :
// « General Dynamics » n'est pas un « général » désaccentué. On les retire du texte AVANT le scan
// plutôt que d'assouplir la règle, pour garder le garde-fou strict sur la vraie prose française.
const PROPER_NOUN_EXCEPTIONS = [
  /\bGeneral Dynamics\b/g,
  /\bGeneral Motors\b/g,
  /\bGeneral Electric\b/g,
  /\bGeneral Mills\b/g,
];

function guardDataQuality(data, strict) {
  const strings = collectStrings(data, []);
  let text = strings.join('\n');
  for (const re of PROPER_NOUN_EXCEPTIONS) text = text.replace(re, ' ');

  const accentHits = text.match(FR_UNACCENTED_RE) || [];
  const accentUniq = [...new Set(accentHits.map(w => w.toLowerCase()))];

  const truncated = strings.filter(looksTruncated);

  const problems = [];
  if (accentUniq.length) {
    problems.push(`prose FR sans accents détectée (${accentUniq.length} mot(s): ${accentUniq.slice(0, 12).join(', ')}${accentUniq.length > 12 ? '…' : ''}) — le générateur amont (session LLM) doit écrire l'UTF-8 accentué directement dans data.json`);
  }
  if (truncated.length) {
    const sample = truncated[0].length > 60 ? '…' + truncated[0].slice(-50) : truncated[0];
    problems.push(`${truncated.length} champ(s) texte semblent tronqués mi-mot/mi-parenthèse (ex: "${sample}") — vérifier la génération amont de data.json`);
  }
  if (!problems.length) return;

  const prefix = strict ? '[render-scanner] STRICT — BLOQUANT' : '[render-scanner] WARNING';
  problems.forEach(p => console.error(`${prefix}: ${p}`));
  if (strict) {
    console.error('[render-scanner] Abandon (--strict). Corriger data.json à la source, ou relancer sans --strict pour un rendu avec fallback dégradé (non recommandé pour publication).');
    process.exit(1);
  }
}

guardDataQuality(d, STRICT);

/** Plancher R/R RÉELLEMENT publié sur ce scan, mesuré au HAUT de zone (pire remplissage).
 *  Remplace un « 1:1.3 » qui était codé en dur et contredisait le plancher de régime. */
const minRR = (() => {
  const rs = (d.setups || [])
    .map(s => (typeof s.entry_high === 'number' && typeof s.stop === 'number' && typeof s.tp1 === 'number' && s.entry_high > s.stop)
      ? (s.tp1 - s.entry_high) / (s.entry_high - s.stop) : null)
    .filter(x => x != null && Number.isFinite(x));
  return rs.length ? Math.min(...rs).toFixed(2) : '1.5';
})();

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Escape for HTML attribute values (id, data-*, src, href) */
const escAttr = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
/** Coerce to string — text content from data.json may contain HTML entities, do NOT double-encode */
const esc = s => String(s ?? '');

/** badge(text, color) → <span class="badge badge-{color}">{text}</span> */
function badge(text, color) {
  return `<span class="badge badge-${color}">${text}</span>`;
}

/** Render a single EChart container (div only — script collected separately) */
function echartDiv(id, heightPx) {
  return `<div id="${id}" class="echart-box" style="height:${heightPx || 300}px;"></div>`;
}

/** Collect ECharts init calls; flushed at end of page */
const _charts = [];
function addChart(id, optionCode) {
  _charts.push({ id, optionCode });
}

function flushChartsScript() {
  if (!_charts.length) return '';
  const inits = _charts.map(ch =>
    `(function(){\n  var el=document.getElementById(${JSON.stringify(ch.id)});\n  if(!el)return;\n  var c=echarts.init(el);\n  c.setOption(${ch.optionCode});\n})()`
  ).join(';\n\n');

  const resizeIds = _charts.map(ch => JSON.stringify(ch.id)).join(',');
  return `<script>
${inits}

// Resize on window change
window.addEventListener('resize',function(){
  [${resizeIds}].forEach(function(id){
    var el=document.getElementById(id);
    if(el){var ch=echarts.getInstanceByDom(el);if(ch)ch.resize();}
  });
});
</script>`;
}

/** Pattern → badge color */
function patternColor(p) {
  if (!p) return 'green';
  const lp = p.toLowerCase();
  if (lp === 'momentum')   return 'green';
  if (lp === 'breakout')   return 'blue';
  if (lp === 'pullback')   return 'amber';
  if (lp === 'pre-squeeze' || lp === 'pre_squeeze') return 'purple';
  return 'green';
}

/** Regime → badge color string */
function regimeBadgeColor(regime) {
  if (!regime) return 'green';
  const r = regime.toUpperCase();
  if (r === 'RISK-ON')        return 'green';
  if (r === 'NEUTRAL')        return 'blue';
  if (r === 'RECOVERY')       return 'blue';
  if (r.includes('RISK-OFF')) return 'red';
  return 'amber';
}

/** Format price display (number → string with $) */
function fmtPrice(v) {
  if (v == null) return '';
  return '$' + Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Format change_pct with sign and color class */
function fmtChangePct(pct) {
  if (pct == null) return '';
  const cls = pct >= 0 ? 'pos' : 'neg';
  const sign = pct >= 0 ? '+' : '';
  return `<div class="change ${cls}">${sign}${pct.toFixed(2)}%</div>`;
}

// ─── REGIME GAUGE CHART ──────────────────────────────────────────────────────

function regimeGaugeConfig(score) {
  // Convert 0-1 score to 0-100 for display; determine progress color
  const v = typeof score === 'number' && score <= 1 ? Math.round(score * 100) : score;
  const pColor = v <= 30 ? 'var(--pos)' : v <= 50 ? '#f59e0b' : v <= 70 ? '#f97316' : '#ef4444';
  return JSON.stringify({
    series: [{
      type: 'gauge', startAngle: 200, endAngle: -20, min: 0, max: 100,
      progress: { show: true, width: 18, itemStyle: { color: pColor } },
      pointer: { show: true, length: '60%', width: 6 },
      axisLine: { lineStyle: { width: 18, color: [[0.3,'#ef4444'],[0.5,'#f59e0b'],[0.7,'var(--pos)'],[1,'#3b82f6']] } },
      axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
      detail: { valueAnimation: true, formatter: '{value}', fontSize: 28, fontWeight: 800, offsetCenter: [0,'70%'] },
      data: [{ value: v, name: 'Regime Score' }]
    }]
  });
}

// ─── STRATEGY PIE CHART ──────────────────────────────────────────────────────

const PIE_COLORS = { Momentum: 'var(--pos)', Breakout: '#3b82f6', Pullback: '#f59e0b', 'Pre-Squeeze': '#8b5cf6' };

function strategyPieConfig(weights) {
  const data = Object.entries(weights).map(([name, value]) => ({
    value, name, itemStyle: { color: PIE_COLORS[name] || '#94a3b8' }
  }));
  return JSON.stringify({
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    series: [{
      type: 'pie', radius: ['40%','70%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
      data
    }]
  });
}

// ─── RADAR OVERVIEW CHART (all setups average) ───────────────────────────────

function radarOverviewConfig(setups) {
  const keys = ['momentum','fundamentals','technical','volume','sentiment','macro'];
  const labels = ['Momentum','Fundamentals','Technical','Volume','Sentiment','Macro'];
  const avg = keys.map(k => {
    const vals = setups.map(s => (s.radar_scores && s.radar_scores[k]) || 0);
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  });
  return JSON.stringify({
    tooltip: {},
    radar: {
      indicator: labels.map(n => ({ name: n, max: 100 })),
      radius: '65%'
    },
    series: [{
      type: 'radar',
      data: [{
        value: avg, name: `${setups.length}-Setup Average`,
        areaStyle: { opacity: 0.2, color: '#3b82f6' },
        lineStyle: { color: '#3b82f6', width: 2 },
        itemStyle: { color: '#3b82f6' }
      }]
    }]
  });
}

// ─── TREEMAP SECTOR CHART ────────────────────────────────────────────────────

const SECTOR_COLORS = { us: '#0ea5e9', eu: '#7c3aed', asia: '#059669', etf: '#f59e0b' };

function treemapConfig(setups) {
  // Per-ticker treemap with individual colors from logo_gradient
  const data = setups.map(s => {
    const color = (s.logo_gradient && s.logo_gradient[0]) || SECTOR_COLORS[(s.region||'us').toLowerCase()] || '#94a3b8';
    return { name: s.ticker, value: s.score, itemStyle: { color } };
  });
  // Build option as raw JS string (tooltip.formatter needs a function)
  return `{tooltip:{formatter:function(p){return p.name+' \\u2014 Score: '+p.value}},series:[{type:'treemap',data:${JSON.stringify(data)},label:{show:true,formatter:'{b}\\n{c}',fontSize:13,fontWeight:700,color:'#fff'},breadcrumb:{show:false}}]}`;
}

// ─── SCORE BAR CHART ─────────────────────────────────────────────────────────

function scoreBarConfig(setups) {
  // Horizontal bar (like 20260415 reference) with per-ticker colors
  const sorted = [...setups].sort((a, b) => a.score - b.score); // ascending for horizontal
  const data = sorted.map(s => {
    const color = (s.logo_gradient && s.logo_gradient[0]) || (s.score >= 90 ? 'var(--pos)' : s.score >= 87 ? '#3b82f6' : '#f59e0b');
    return { value: s.score, itemStyle: { color } };
  });
  return JSON.stringify({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '15%', right: '5%', top: '5%', bottom: '5%' },
    xAxis: { type: 'value', min: Math.max(0, Math.min(...sorted.map(s => s.score)) - 5), max: Math.min(100, Math.max(...sorted.map(s => s.score)) + 5) },
    yAxis: { type: 'category', data: sorted.map(s => s.ticker) },
    series: [{
      type: 'bar', data, barWidth: '60%',
      label: { show: true, position: 'right', fontWeight: 700 }
    }]
  });
}

// ─── CORRELATION HEATMAP ────────────────────────────────────────────────────

function correlationHeatmapConfig(pairs, tickers) {
  const n = tickers.length;
  const data = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const key = i <= j ? `${tickers[i]}-${tickers[j]}` : `${tickers[j]}-${tickers[i]}`;
      const val = i === j ? 1.0 : (pairs[key] != null ? pairs[key] : 0);
      data.push([j, i, +val.toFixed(2)]);
    }
  }
  return `{tooltip:{position:'top',formatter:function(p){return p.name+': \\u03C1 = '+p.data[2]}},grid:{left:'15%',right:'5%',top:'5%',bottom:'15%'},xAxis:{type:'category',data:${JSON.stringify(tickers)},axisLabel:{fontSize:11,fontWeight:700},splitArea:{show:true}},yAxis:{type:'category',data:${JSON.stringify(tickers)},axisLabel:{fontSize:11,fontWeight:700},splitArea:{show:true}},visualMap:{min:-1,max:1,calculable:true,orient:'horizontal',left:'center',bottom:0,inRange:{color:['#ef4444','#fbbf24','#f8fafc','#86efac','var(--pos)']}},series:[{type:'heatmap',data:${JSON.stringify(data)},label:{show:true,fontSize:10},emphasis:{itemStyle:{shadowBlur:10,shadowColor:'rgba(0,0,0,0.5)'}}}]}`;
}

// ─── SANKEY CHART (Sector → Strategy → Ticker) ─────────────────────────────

function sankeyConfig(setups) {
  const nodes = new Set();
  const linkMap = {};
  setups.forEach(s => {
    const sector = `sect:${s.sector || s.region_label || s.region || 'US'}`;
    const strategy = `strat:${s.pattern || 'Momentum'}`;
    const ticker = s.ticker;
    nodes.add(sector); nodes.add(strategy); nodes.add(ticker);
    const k1 = `${sector}→${strategy}`;
    linkMap[k1] = (linkMap[k1] || 0) + 1;
    const k2 = `${strategy}→${ticker}`;
    linkMap[k2] = (linkMap[k2] || 0) + 1;
  });
  const STRAT_COLORS = { 'strat:Momentum': 'var(--pos)', 'strat:Breakout': '#3b82f6', 'strat:Pullback': '#f59e0b', 'strat:Pre-Squeeze': '#8b5cf6' };
  const nodeArr = [...nodes].map(n => ({ name: n, itemStyle: { color: STRAT_COLORS[n] || '#64748b' } }));
  const links = Object.entries(linkMap).map(([k, v]) => {
    const [src, tgt] = k.split('→');
    return { source: src, target: tgt, value: v };
  });
  return `{tooltip:{trigger:'item',triggerOn:'mousemove'},series:[{type:'sankey',layout:'none',emphasis:{focus:'adjacency'},nodeAlign:'left',orient:'horizontal',data:${JSON.stringify(nodeArr)},links:${JSON.stringify(links)},lineStyle:{color:'gradient',curveness:0.5},label:{fontSize:12,fontWeight:600,formatter:function(p){return p.name.replace(/^(sect|strat):/,'')}}}]}`;
}

// ─── PER-SETUP GAUGE & RADAR ──────────────────────────────────────────────────

function setupGaugeConfig(score, tickerColor) {
  const pColor = tickerColor || '#3b82f6';
  return JSON.stringify({
    series: [{
      type: 'gauge', startAngle: 200, endAngle: -20, min: 0, max: 100,
      progress: { show: true, width: 14, itemStyle: { color: pColor } },
      pointer: { show: true, length: '55%', width: 5 },
      axisLine: { lineStyle: { width: 14, color: [[0.6,'#e2e8f0'],[0.85,'#fbbf24'],[1,'var(--pos)']] } },
      axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
      detail: { valueAnimation: true, formatter: '{value}', fontSize: 24, fontWeight: 800, offsetCenter: [0,'70%'] },
      data: [{ value: score, name: 'Score' }]
    }]
  });
}

function setupRadarConfig(ticker, scores, tickerColor) {
  const keys   = ['momentum','fundamentals','technical','volume','sentiment','macro'];
  const labels = ['Momentum','Fundamentals','Technical','Volume','Sentiment','Macro'];
  const values = keys.map(k => (scores && scores[k]) || 0);
  const c = tickerColor || '#3b82f6';
  return JSON.stringify({
    radar: {
      indicator: labels.map(n => ({ name: n, max: 100 })),
      radius: '65%'
    },
    series: [{
      type: 'radar',
      data: [{
        value: values, name: ticker,
        areaStyle: { opacity: 0.25, color: c },
        lineStyle: { color: c, width: 2 },
        itemStyle: { color: c }
      }]
    }]
  });
}

// ─── SETUP CARD ──────────────────────────────────────────────────────────────

function setupCard(s, idx) {
  const gaugeId = `gaugeSetup${s.ticker}`;
  const radarId = `radarSetup${s.ticker}`;
  const tickerColor = (s.logo_gradient && s.logo_gradient[0]) || '#3b82f6';

  addChart(gaugeId, setupGaugeConfig(s.score, tickerColor));
  addChart(radarId, setupRadarConfig(s.ticker, s.radar_scores, tickerColor));

  const gradStyle = s.logo_gradient && s.logo_gradient.length >= 2
    ? `background:linear-gradient(135deg,${s.logo_gradient[0]},${s.logo_gradient[1]});`
    : 'background:#64748b;';

  // Region badge
  const regionBadgeColor = { us: 'blue', eu: 'purple', asia: 'purple', etf: 'green' };
  const regionColor = regionBadgeColor[(s.region || '').toLowerCase()] || 'blue';
  const regionLabel = `${s.region_label || s.region || 'US'} ${s.region_flag || ''}`;

  // Sharia badge
  const shariaBadge = s.sharia
    ? `<span class="badge badge-green" style="font-size:.7rem">&#x262A; Halal</span>`
    : `<span class="badge" style="background:#94a3b8;color:#fff;font-size:.7rem">CONV</span>`;

  // Extra badges
  const extraBadges = (s.extra_badges || []).map(b => badge(b, 'amber')).join('');

  // Confirmations
  const confirmItems = (s.confirmations || []).map(c => `<li>${c}</li>`).join('');
  // Invalidations
  const invalidItems = (s.invalidations || []).map(c => `<li>${c}</li>`).join('');

  // Entry display
  const entryDisplay = s.entry_display
    ? s.entry_display
    : (s.entry_low && s.entry_high ? `$${s.entry_low}&ndash;$${s.entry_high}` : fmtPrice(s.entry_low || s.entry_high || 0));

  return `
<!-- SETUP ${idx + 1}: ${esc(s.ticker)} -->
<div class="section-header"><h2>#${idx + 1} ${esc(s.ticker)} &middot; ${esc(s.name)}</h2></div>
<div class="setup-card" id="setup-${escAttr(s.ticker)}" data-ticker="${escAttr(s.ticker)}" data-sharia="${s.sharia ? 'true' : 'false'}" data-entry="${s.entry_low || s.entry_high || 0}" data-stop="${s.stop || 0}" data-tp1="${s.tp1 || 0}" data-tp2="${s.tp2 || 0}">
  <div class="setup-header">
    <div class="scanner-ticker-logo" style="${gradStyle}">${esc(s.ticker)}</div>
    <div class="setup-header-info">
      <h3>${esc(s.ticker)} &middot; ${esc(s.name)}</h3>
      <div class="setup-name">${esc(s.description || '')}</div>
    </div>
    <div class="setup-header-price">
      <div class="price">${fmtPrice(s.price)}</div>
      ${fmtChangePct(s.change_pct)}
    </div>
  </div>
  <div class="setup-badges">
    ${badge(regionLabel, regionColor)}
    ${badge(s.pattern || 'Momentum', patternColor(s.pattern))}
    ${badge(`Score ${s.score}`, 'purple')}
    ${extraBadges}
    ${shariaBadge}
  </div>

  <img class="finviz-chart" src="https://finviz.com/chart.ashx?t=${escAttr(s.ticker)}&amp;ty=c&amp;ta=1&amp;p=d&amp;s=l" alt="${escAttr(s.ticker)} FinViz Chart" loading="lazy">

  <div class="chart-grid-2col">
    <div>${echartDiv(gaugeId, 250)}</div>
    <div>${echartDiv(radarId, 250)}</div>
  </div>

  <p>${s.thesis || ''}</p>

  <div class="confirm-box">
    <h3>&#x2705; Confirmations</h3>
    <ul>${confirmItems}</ul>
  </div>
  <div class="invalid-box">
    <h3>&#x274C; Invalidations</h3>
    <ul>${invalidItems}</ul>
  </div>

  <div class="levels-grid">
    <div><strong>Entry:</strong> ${entryDisplay}</div>
    <div><strong>Stop Loss:</strong> ${fmtPrice(s.stop)}</div>
    <div><strong>TP1:</strong> ${fmtPrice(s.tp1)}</div>
    <div><strong>TP2:</strong> ${s.tp2 ? fmtPrice(s.tp2) : 'n/a'}</div>
    <div><strong>R/R:</strong> ${s.rr || 'n/a'}</div>
    <div><strong>Horizon:</strong> ${s.horizon_days ? s.horizon_days + ' s\u00e9ances' : 'n/a'}</div>
  </div>
</div>`;
}

// ─── NAV GRID ────────────────────────────────────────────────────────────────

function navGrid(setups) {
  const links = setups.map(s => {
    const gradStyle = s.logo_gradient && s.logo_gradient.length >= 2
      ? `background:${s.logo_gradient[0]};`
      : 'background:#64748b;';
    const flag = s.region_flag ? ` ${s.region_flag}` : '';
    return `    <a href="#setup-${escAttr(s.ticker)}"><span style="${gradStyle}color:white;padding:2px 8px;border-radius:6px;font-size:0.8rem;">${esc(s.ticker)}</span> ${esc(s.name.split(' ').slice(0,2).join(' '))}${flag}</a>`;
  });
  return `<div class="nav-grid">\n${links.join('\n')}\n</div>`;
}

// ─── SYNTHESE TABLE ──────────────────────────────────────────────────────────

function syntheseTable(setups) {
  const rows = setups.map((s, i) => {
    const shariaAttr = `data-sharia="${s.sharia ? 'true' : 'false'}"`;
    const entryVal = s.entry_low || s.entry_high || 0;
    return `        <tr ${shariaAttr}><td>${i + 1}</td><td><strong>${esc(s.ticker)}</strong></td><td>${s.name}</td><td>${esc(s.region_label || s.region || 'US')}</td><td>${esc(s.pattern || 'Momentum')}</td><td class="up"><strong>${s.score}</strong></td><td>${s.entry_low && s.entry_high && s.entry_low !== s.entry_high ? `$${s.entry_low}&ndash;$${s.entry_high}` : `$${entryVal}`}</td><td>$${s.stop || ''}</td><td>$${s.tp1 || ''}</td><td>${s.rr || ''}</td></tr>`;
  });
  return `    <div style="overflow-x:auto"><table class="data-table">
      <thead>
        <tr><th>#</th><th>Ticker</th><th>Name</th><th>Region</th><th>Strategy</th><th>Score</th><th>Entry</th><th>Stop</th><th>TP1</th><th>R/R</th></tr>
      </thead>
      <tbody>
${rows.join('\n')}
      </tbody>
    </table></div>`;
}

// ─── DIVERSIFICATION TABLE ───────────────────────────────────────────────────

function divmatTable(data) {
  if (!data || !data.length) return '';
  const rows = data.map(r =>
    `        <tr><td><strong>${esc(r.region)}</strong></td><td>${esc(r.tickers)}</td><td>${r.count}</td><td>${esc(r.strategies)}</td></tr>`
  );
  // Total row
  const total = data.reduce((a, r) => a + r.count, 0);
  return `    <div style="overflow-x:auto"><table class="divmat-table">
      <thead><tr><th>Region</th><th>Tickers</th><th>Count</th><th>Strategies</th></tr></thead>
      <tbody>
${rows.join('\n')}
        <tr style="background:#eff6ff;font-weight:700;"><td><strong>Total</strong></td><td>${total} setups</td><td>${total}</td><td></td></tr>
      </tbody>
    </table></div>`;
}

// ─── THEMATIC TABLE ──────────────────────────────────────────────────────────

function thematicTable(data) {
  if (!data || !data.length) return '';
  const rows = data.map(r =>
    `        <tr><td><strong>${esc(r.theme)}</strong></td><td>${esc(r.tickers)}</td><td>${esc(r.rationale)}</td></tr>`
  );
  return `    <div style="overflow-x:auto"><table class="divmat-table">
      <thead><tr><th>Theme</th><th>Tickers</th><th>Rationale</th></tr></thead>
      <tbody>${rows.join('\n')}</tbody>
    </table></div>`;
}

// ─── ALERTS ──────────────────────────────────────────────────────────────────

function alertsHtml(alerts) {
  if (!alerts || !alerts.length) return '';
  return alerts.map(a => {
    const isWarning = a.type === 'warning';
    const cls = isWarning ? 'pedagogy-box' : 'risk-on-banner';
    const warnStyle = isWarning ? ' style="background:#fef2f2;border-left:4px solid #ef4444;"' : '';
    return `  <div class="${cls}"${warnStyle}>\n    <strong>&#x26A0; ${esc(a.title)}:</strong> ${esc(a.text)}\n  </div>`;
  }).join('\n');
}

// ─── MACRO CALENDAR TABLE ────────────────────────────────────────────────────

function macroCalendarTable(rows) {
  if (!Array.isArray(rows) || !rows.length) return '';
  const trs = rows.map(r => {
    const dirClass = r.dir === 'up' ? 'up' : r.dir === 'down' ? 'down' : '';
    const impact = r.impact ?? r.importance ?? '';
    const impactClass = /HIGH|\u00C9LEV|ELEV/i.test(impact) ? 'warn-cell' : '';
    return `            <tr><td><strong>${esc(r.date)}</strong></td><td>${esc(r.event)}</td><td class="${impactClass}"><strong>${esc(impact)}</strong></td><td>${esc(r.note ?? r.risk ?? '')}</td></tr>`;
  });
  return `        <div style="overflow-x:auto"><table class="data-table">
          <thead><tr><th>Date</th><th>&Eacute;v&eacute;nement</th><th>Impact</th><th>Sens du risque</th></tr></thead>
          <tbody>${trs.join('')}</tbody>
        </table></div>`;
}

/** Direction d'une ligne de tableau : `dir`/`trend` explicite, sinon dérivée du SIGNE de la
 *  variation. Sans cela une variation positive tombait dans le `else` et s'affichait en rouge
 *  (bug de contrat de champs, scans <= 20260804). */
function rowDir(r) {
  const d = r.dir || r.trend;
  if (d === 'up' || d === 'down') return d;
  const raw = String(r.change ?? r.perf ?? '').trim();
  if (/^[-\u2212\u2013\u2014]/.test(raw)) return 'down';
  if (/^\+/.test(raw) || /^[0-9]/.test(raw)) return 'up';
  return '';
}

// ─── SECTOR ROTATION TABLE ───

function sectorRotationTable(rows) {
  if (!Array.isArray(rows) || !rows.length) return '';
  const trs = rows.map(r => {
    const dirClass = rowDir(r);
    return `            <tr><td>${esc(r.sector)}</td><td class="${dirClass}">${esc(r.perf)}</td><td>${esc(r.signal ?? r.note ?? '')}</td><td><strong>${esc(r.exposure ?? '')}</strong></td></tr>`;
  });
  return `        <div style="overflow-x:auto"><table class="data-table">
          <thead><tr><th>Secteur (ETF)</th><th>Perf. s&eacute;ance</th><th>Signal de r&eacute;gime</th><th>Exposition du scan</th></tr></thead>
          <tbody>${trs.join('')}</tbody>
        </table></div>`;
}

// ─── COMPACT STRATEGY TABLE (Ticker | Setup | Entrée | Stop | TP | R/R) ───────

/** Strip leading "1:" from an R/R string for compact display ("1:1.9" → "1.9") */
function rrDisplay(rr) {
  return String(rr ?? '').replace(/^\s*1:\s*/, '').trim() || '—';
}

/** One number → compact price string (no trailing zeros beyond 2 decimals) */
function num(v) {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (!isFinite(n)) return '—';
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

/** Trim a truncated string back to the last safe boundary before the unmatched "(" cut */
function safeTrimTruncated(s) {
  const idx = s.lastIndexOf('(');
  const base = (looksTruncated(s) && idx > 0) ? s.slice(0, idx) : s;
  return base.replace(/[,;:\s]+$/, '').trim();
}

/**
 * Short setup phrase for the Setup column.
 * data.json may ship setup_phrase already cut mid-word/mid-parenthesis (upstream bug,
 * not a renderer slice — see guardDataQuality above). Never invent the missing tail:
 * prefer the first candidate field that is NOT truncated (description/thesis are full
 * sentences already present in data.json). Only if every candidate is truncated do we
 * trim the shortest one back to its last safe boundary + no fabricated text.
 */
function setupPhrase(s) {
  const candidates = [s.setup_phrase, s.description, s.thesis].filter(Boolean);
  const clean = candidates.find(c => !looksTruncated(c));
  if (clean) return esc(clean);
  if (!candidates.length) return '';
  const shortest = candidates.reduce((a, b) => (a.length <= b.length ? a : b));
  return esc(safeTrimTruncated(shortest));
}

/**
 * Compact per-ticker <details> block listing Confirmations/Invalidations (scanner/CLAUDE.md
 * §Confirmations/Invalidations OBLIGATOIRES). Collapsed by default to keep the compact
 * table format — reuses the existing .confirm-box/.invalid-box CSS (colorblind-safe vars),
 * inline layout styles allowed here per convention (CLAUDE.md rule 8 exception).
 */
function confirmInvalidDetails(s) {
  const confirmItems = (s.confirmations || []).map(c => `<li>${esc(c)}</li>`).join('');
  const invalidItems = (s.invalidations || []).map(c => `<li>${esc(c)}</li>`).join('');
  if (!confirmItems && !invalidItems) return '';
  return `        <details class="setup-civ-details" style="margin:.2rem 0 .6rem;">
          <summary style="cursor:pointer;font-size:.82rem;font-weight:600;color:#334155;">${esc(s.ticker)} — Thèse, confirmations et invalidations${s.score ? ` · score ${esc(s.score)}/100` : ''}${s.horizon_days ? ` · ${esc(s.horizon_days)} séances` : ''}</summary>
${s.thesis ? `          <p style="margin:.5rem 0 .2rem;font-size:.85rem;line-height:1.5;">${esc(s.thesis)}</p>` : ''}
${s.tp2 ? `          <p style="margin:.2rem 0 .5rem;font-size:.8rem;color:#475569;">Deuxième objectif : ${esc(num(s.tp2))} · Horizon : ${esc(s.horizon_days || 10)} séances</p>` : ''}
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:.6rem;margin-top:.5rem;">
${confirmItems ? `            <div class="confirm-box" style="margin:0;"><h4>&#x2705; Confirmations</h4><ul style="margin:0;padding-left:1.1rem;font-size:.82rem;">${confirmItems}</ul></div>` : ''}
${invalidItems ? `            <div class="invalid-box" style="margin:0;"><h4>&#x274C; Invalidations</h4><ul style="margin:0;padding-left:1.1rem;font-size:.82rem;">${invalidItems}</ul></div>` : ''}
          </div>
        </details>`;
}

/** Render one compact strategy table. Returns '' when no rows. */
function strategyTable(title, subtitle, rows) {
  if (!rows || !rows.length) return '';
  const trs = rows.map(s => {
    const entry = s.entry_low ?? s.entry_high ?? s.entry ?? '';
    const tp = s.tp1 ?? s.tp2 ?? '';
    const shariaBadge = s.sharia === true
      ? ' <span class="badge badge-green" style="font-size:.68rem">&#x262A;</span>'
      : s.sharia === false
        ? ' <span class="badge" style="background:#e2e8f0;color:#334155;border:1px solid #94a3b8;font-size:.68rem">CONV</span>'
        : '';
    return `        <tr data-ticker="${escAttr(s.ticker)}" data-sharia="${s.sharia === true ? 'true' : s.sharia === false ? 'false' : ''}" data-entry="${entry || 0}" data-stop="${s.stop || 0}" data-tp1="${s.tp1 || 0}" data-tp2="${s.tp2 || 0}">`
      + `<td><strong>${esc(s.ticker)}</strong>${shariaBadge}</td>`
      + `<td class="setup-phrase">${setupPhrase(s)}</td>`
      + `<td>${s.entry_low != null && s.entry_high != null && s.entry_low !== s.entry_high ? `${num(s.entry_low)}&ndash;${num(s.entry_high)}` : num(entry)}</td><td>${num(s.stop)}</td><td>${num(tp)}</td><td><strong>${rrDisplay(s.rr)}</strong></td></tr>`;
  }).join('\n');
  const civBlocks = rows.map(confirmInvalidDetails).filter(Boolean).join('\n');
  return `  <h3 class="strategy-table-title">${title}${subtitle ? ` <span style="font-weight:500;color:#64748b;font-size:.85rem">— ${subtitle}</span>` : ''}</h3>
  <div style="overflow-x:auto">
    <table class="compare-table setups-table">
      <thead>
        <tr><th>Ticker</th><th>Setup</th><th>Entrée</th><th>Stop</th><th>TP</th><th>R/R</th></tr>
      </thead>
      <tbody>
${trs}
      </tbody>
    </table>
  </div>
${civBlocks ? `  <div class="setup-civ-list">\n${civBlocks}\n  </div>` : ''}`;
}

// ─── MAIN PAGE ASSEMBLER ─────────────────────────────────────────────────────

function buildPage(d) {
  const setups   = d.setups || [];
  const tagStr   = (d.tags || []).join(',');
  const tickers  = setups.map(s => s.ticker).join(', ');
  const { adjustRegimeLabel } = require('./lib/scanner-parser');
  const rawRegime = d.regime || 'RISK-ON';
  // adjustRegimeLabel(label, score) attend un score sur l'échelle 0-100 de scoreToRegime
  // (>=65 = RISK-ON). Mais le scan produit regime_score sur une AUTRE échelle (6.2, parfois
  // stocké 0.062) → scoreToRegime le lit comme "très bas" et inverse RISK-ON → RISK-OFF (hero,
  // title, meta, section se contredisent). Le champ `regime` du scan est la source de vérité
  // (dérivé VIX/S&P). On ne ré-ajuste QUE si le score est clairement sur l'échelle 0-100.
  const scoreOn100 = (typeof d.regime_score === 'number' && d.regime_score >= 38 && d.regime_score <= 100);
  const regime = scoreOn100 ? adjustRegimeLabel(rawRegime, d.regime_score) : rawRegime;
  const REGIME_COLORS = { 'RISK-ON': 'var(--pos)', 'RECOVERY': '#3b82f6', 'NEUTRAL': '#94a3b8', 'EARLY RISK-OFF': '#f59e0b', 'RISK-OFF': '#ef4444' };
  const regColor = REGIME_COLORS[regime] || d.regime_color || 'var(--pos)';

  // ── Group setups by strategy (compact tables — no per-card charts) ──────────
  const PATTERN_ORDER = ['Momentum', 'Breakout', 'Pullback', 'Combiné'];
  const PATTERN_SUB = {
    Momentum: 'tendance établie, cassure de plus-hauts',
    Breakout: 'sortie de base / gap sur volume',
    Pullback: 'repli technique dans un uptrend intact',
    'Combiné': 'panier diversifié multi-secteurs',
  };
  const groups = {};
  for (const s of setups) {
    const p = PATTERN_ORDER.includes(s.pattern) ? s.pattern : 'Combiné';
    (groups[p] = groups[p] || []).push(s);
  }
  const strategyTablesHtml = PATTERN_ORDER
    .map(p => strategyTable(p, PATTERN_SUB[p], groups[p]))
    .filter(Boolean)
    .join('\n\n');

  // ── KPI boxes ──────────────────────────────────────────────────────────────
  const dominantStr = (d.kpis && d.kpis.dominant_patterns || []).join(' + ');
  const vixVal   = (d.kpis && d.kpis.vix)  ? `${d.kpis.vix.value} (${d.kpis.vix.label})` : '';
  const vixColor = (d.kpis && d.kpis.vix && d.kpis.vix.color) || 'var(--pos)';
  const spxVal   = (d.kpis && d.kpis.spx)  ? `${d.kpis.spx.value}` : '';
  const spxColor = (d.kpis && d.kpis.spx && d.kpis.spx.color) || 'var(--pos)';
  const avgScore = (d.kpis && d.kpis.avg_score) || (setups.reduce((a, s) => a + s.score, 0) / (setups.length || 1)).toFixed(1);

  // ── Hero badges ────────────────────────────────────────────────────────────
  const regimeDot = regime === 'RISK-ON' ? '&#x1F7E2;' : regime.includes('RISK-OFF') ? '&#x1F534;' : '&#x1F7E1;';
  const heroBadges = [
    badge(`${regimeDot} ${regime}`, regimeBadgeColor(regime)),
    badge(d.session_label || d.date || '', 'blue'),
    badge(`${setups.length} Setups A+`, 'green'),
    ...(d.alerts || []).map(a => badge(`&#x26A0; ${a.title}`, 'amber'))
  ].join('\n    ');

  // ── Performance table ──────────────────────────────────────────────────────
  const perf = d.performance || {};
  const perfRows = perf.win_rate ? `
          <tr><td>Win Rate (3m)</td><td class="up">${perf.win_rate}</td></tr>
          <tr><td>Avg Win</td><td class="up">${perf.avg_win}</td></tr>
          <tr><td>Avg Loss</td><td class="down">${perf.avg_loss}</td></tr>
          <tr><td>Profit Factor</td><td class="up">${perf.profit_factor}</td></tr>
          <tr><td>Sharpe (3m)</td><td class="up">${perf.sharpe}</td></tr>
          <tr><td>Max Drawdown (3m)</td><td class="down">${perf.max_dd}</td></tr>
          ${perf.r2 ? `<tr><td>R&sup2;</td><td>${perf.r2}</td></tr>` : ''}` : '';

  // ── Disclaimer extra ───────────────────────────────────────────────────────
  const disclaimerExtra = d.disclaimer_extra
    ? `<p><strong>Avertissement de risque contextuel (${d.session_label || d.date}) :</strong> ${d.disclaimer_extra}</p>`
    : '';

  // ── synthese_extra tables ──────────────────────────────────────────────────
  const extra = d.synthese_extra || {};
  const divMatHtml = divmatTable(extra.diversification || []);
  const thematicHtml = thematicTable(extra.thematic || []);

  return `<!DOCTYPE html>
<html lang="fr" data-tags="${tagStr}" data-tab="scanner">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Top ${setups.length} A+ ${regime} &middot; ${setups.slice(0,10).map(s=>s.ticker).join(', ')} | DailyTickers Scanner</title>
  <meta name="description" content="Scanner ${d.session_label || d.date} &middot; ${regime} (score ${d.regime_score || 0}). ${setups.length} setups A+ en tableaux compacts, niveaux vérifiés.">
  <meta property="og:title" content="Scanner DailyTickers &middot; ${d.session_label || d.date} &middot; ${setups.slice(0,10).map(s=>s.ticker).join(', ')}">
  <meta property="og:description" content="${regime} regime. ${d.session_label || d.date}. ${setups.length} setups A+.">
  <meta property="og:image" content="https://articles.dailytickers.com/scanner-daily-card.png">
  <meta property="og:url" content="${d.url || `https://articles.dailytickers.com/scanner/${d.date}/`}">
  <meta property="og:type" content="article">
  <meta name="twitter:card" content="summary_large_image">
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-T5Z595CW');</script>
  <link rel="stylesheet" href="/assets/report.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    .setups-table td, .setups-table th { vertical-align: middle; }
    .setups-table td.setup-phrase { font-size: 0.86rem; color: #334155; line-height: 1.35; }
    .strategy-table-title { margin: 1.75rem 0 0.6rem; font-weight: 700; font-size: 1.05rem; }
    .setups-table td:nth-child(3), .setups-table td:nth-child(4),
    .setups-table td:nth-child(5), .setups-table td:nth-child(6) { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  </style>
</head>
<body>
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-T5Z595CW" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>

<nav class="brand-bar">
  <div class="brand-bar-inner">
    <a href="/" class="brand-logo"><img src="/logo.svg" alt="DailyTickers" width="36" height="36"><span class="brand-title">DailyTickers</span></a>
    <div class="brand-nav">
      <a href="/?tab=weekly">Hebdo</a><a href="/?tab=daily">Daily</a><a href="/?tab=analyses">Analyses</a><a href="/?tab=scanner">Scanner</a><a href="/?tab=radar">Radar</a><a href="/?tab=series">Séries</a>
    </div>
    <div class="brand-actions"><a href="/" class="brand-home-btn" title="Home"><i class="fas fa-house"></i></a></div>
  </div>
</nav>

<!-- HERO -->
<div class="ticker-header">
  <div class="ticker-meta">
    ${heroBadges}
  </div>
  <h1 class="ticker-name">Scanner DailyTickers — ${d.session_label || d.date}</h1>
  <p class="ticker-subtitle">Top ${setups.length} A+ ${regime} — niveaux vérifiés sur données de séance, tableaux compacts par stratégie</p>
  <div class="ticker-metrics">
    <div class="ticker-metric"><div class="tm-value" style="color:${regColor};">${regime}</div><div class="tm-label">Régime</div></div>
    <div class="ticker-metric"><div class="tm-value">${avgScore}</div><div class="tm-label">Score moyen</div></div>
    <div class="ticker-metric"><div class="tm-value">${setups.length}</div><div class="tm-label">Setups</div></div>
    <div class="ticker-metric"><div class="tm-value">${dominantStr || 'Momentum'}</div><div class="tm-label">Dominante</div></div>
    ${vixVal ? `<div class="ticker-metric"><div class="tm-value" style="color:${vixColor};">${vixVal}</div><div class="tm-label">VIX</div></div>` : ''}
    ${spxVal ? `<div class="ticker-metric"><div class="tm-value" style="color:${spxColor};">${spxVal}</div><div class="tm-label">SPX</div></div>` : ''}
  </div>
  <div id="article-clickable-tags" class="card-tags"></div>
</div>

<!-- INTRO -->
<div class="content-card" style="margin:1.5rem auto;max-width:960px;">
  ${d.intro || ''}
${alertsHtml(d.alerts)}
  <p>${d.regime_prose || ''}</p>
  <p style="background:#f0fdf4;border:1px solid #86efac;padding:0.75rem;border-radius:8px;font-size:0.9rem;">
    <strong>Stratégie de séance :</strong> ${d.strategy || ''}
  </p>
  <div class="report-card-meta">${d.session_label || d.date}</div>
</div>

<!-- REGIME -->
<section id="regime" class="section-block">
  <div class="section-header"><h2><i class="fas fa-gauge"></i> Régime de marché : ${regime} (confiance ${d.regime_score ? String((d.regime_score * 100).toFixed(1)).replace('.', ',') + '%' : 'n/a'})</h2></div>
  <div class="content-card">
    <p>${''}</p>
    <h3 style="margin:1.25rem 0 0.6rem;font-weight:700;">Market Snapshot (${d.session_label || d.date})</h3>
    <div style="overflow-x:auto"><table class="data-table">
      <thead><tr><th>Indice / Actif</th><th>Prix</th><th>Variation</th><th>Signal</th></tr></thead>
      <tbody>
${(d.market_snapshot || []).map(r => `        <tr><td><strong>${esc(r.name ?? r.label)}</strong></td><td>${esc(r.price ?? r.value)}</td><td class="${rowDir(r)}">${esc(r.change)}</td><td>${esc(r.signal ?? r.note)}</td></tr>`).join('\n')}
      </tbody>
    </table></div>
    ${d.pedagogy ? `<div class="pedagogy-box">
      <h4><i class="fas fa-graduation-cap"></i> ${d.pedagogy.title}</h4>
      <p>${d.pedagogy.content}</p>
    </div>` : ''}
  </div>
</section>

<!-- MACRO -->
<section id="macro" class="section-block">
  <div class="section-header"><h2><i class="fas fa-globe"></i> Contexte macro — semaine du ${d.session_label || d.date}</h2></div>
  <div class="content-card">
    <div class="chart-grid-2col">
      <div>
        <h3 style="font-weight:700;margin-bottom:0.6rem;">Calendrier des événements</h3>
${macroCalendarTable(d.macro_calendar)}
      </div>
      <div>
        <h3 style="font-weight:700;margin-bottom:0.6rem;">Rotation sectorielle</h3>
${sectorRotationTable(d.sector_rotation)}
      </div>
    </div>
    ${d.macro_thesis ? `<div class="pedagogy-box">
      <h4><i class="fas fa-info-circle"></i> Thèse de la semaine</h4>
      <p>${d.macro_thesis}</p>
    </div>` : ''}
  </div>
</section>

<!-- ===================== SIGNAUX (TABLEAUX COMPACTS) ===================== -->
<section id="synthese" class="section-block">
  <div class="section-header"><h2><i class="fas fa-table-list"></i> Signaux du jour — ${setups.length} setups par stratégie</h2></div>
  <div class="content-card">
    <p style="font-size:0.9rem;color:#475569;">Niveaux (entrée, stop, TP, R/R) calculés et vérifiés sur les données de séance. Les setups momentum/breakout jugés faibles (R/R non actionnable, entrée trop étendue) ont été retirés. Prendre 50% à TP1 puis stop au point mort.</p>
${strategyTablesHtml}
    <div class="pedagogy-box">
      <h4><i class="fas fa-info-circle"></i> Comment utiliser ces niveaux</h4>
      <p>Entrée = zone d'exécution à l'ouverture (9h30–9h45 ET) si le prix s'y trouve. Le stop est un ordre dur, pas mental. TP = objectif principal : prendre 50% à l'objectif, remonter le stop au point mort, laisser courir le reste. Le R/R publié suppose une entrée au HAUT de la zone, c'est-à-dire au pire remplissage possible. R/R minimum retenu sur ce scan : 1:${minRR}.</p>
    </div>
  </div>
</section>

<!-- METHODOLOGY -->
<section id="methodo" class="section-block">
  <div class="section-header"><h2><i class="fas fa-flask"></i> Méthodologie</h2></div>
  <div class="content-card">
    <div class="pedagogy-box">
      <h4>1. Détection du régime</h4>
      <p>Score composite sur 6 composantes (VIX, largeur SPX, crédit HYG, DXY, liquidité Fed, TLT). 0–0,30 = RISK-ON, 0,30–0,50 = NEUTRAL/Early Risk-Off, 0,50–0,70 = RISK-OFF, &gt;0,70 = DEEP RISK-OFF.</p>
    </div>
    <div class="pedagogy-box">
      <h4>2. Screening multi-stratégie</h4>
      <p>Trois filtres DSL complémentaires : Momentum (tendance + volume), Breakout (sortie de base / gap volume), Pullback (repli vers support dans un uptrend intact). Short Squeeze exclu depuis le 20 mars 2026.</p>
    </div>
    <div class="pedagogy-box">
      <h4>3. Scoring composite (4 facteurs)</h4>
      <p>Technique (40%), Momentum (30%), Confluence (20% — min. 3 signaux alignés pour A+), Catalyseur (10%). Seuls les setups ≥85 qualifient A+.</p>
    </div>
    <div class="pedagogy-box">
      <h4>4. Niveaux réels vérifiés</h4>
      <p>Entrée / stop / TP / R/R calculés sur les données de séance réelles (plus-bas de cassure, résistances 52 sem., extensions mesurées). Les setups à R/R non actionnable ou entrée trop étendue au-dessus de l'EMA20 sont retirés du pool.</p>
    </div>
    <div class="pedagogy-box">
      <h4>5. Anti-dilution &amp; ranking</h4>
      <p>Vérification SEC (pas de S-3 récent, ATM, PIPE, underwriter agressif). Diversification secteur/géographie. R/R minimum 1:${minRR}, mesuré au haut de la zone d'entrée. Conformité Sharia taggée sur chaque ligne.</p>
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:1rem;margin-top:1rem;">
      <h4 style="margin:0 0 0.5rem;">Sources de données</h4>
      <ul style="margin:0;font-size:0.85rem;color:#64748b;">
        <li>Prix &amp; niveaux : données de marché temps réel</li>
        <li>Régime : modèle 6 composantes (crédit, VIX, dollar, liquidité, actions, taux)</li>
        <li>Screening : filtres techniques multi-stratégies (momentum, breakout, pullback)</li>
        <li>Généré : ${d.session_label || d.date}</li>
      </ul>
    </div>
  </div>
</section>

<!-- DISCLAIMER -->
<section id="disclaimer" class="section-block">
  <div class="section-header"><h2><i class="fas fa-triangle-exclamation"></i> Disclaimer</h2></div>
  <div class="content-card">
    <p><strong>Ce scanner est fourni à titre informatif et éducatif uniquement. Il ne constitue pas un conseil financier ni une recommandation d'achat ou de vente.</strong></p>
    <p>Tous les setups comportent un risque. Les performances passées du scanner ne préjugent pas des résultats futurs. Les zones d'entrée, stops et objectifs sont des estimations basées sur l'analyse technique.</p>
    ${disclaimerExtra}
    <p>DailyTickers n'est pas un conseiller en investissement enregistré. Consultez toujours un professionnel qualifié avant toute décision.</p>
    <p style="font-size:0.8rem;color:#94a3b8;">&copy; 2026 DailyTickers &mdash; <a href="${d.url || `https://articles.dailytickers.com/scanner/${d.date}/`}">${d.url || `articles.dailytickers.com/scanner/${d.date}/`}</a></p>
  </div>
</section>

<!-- FAB -->
<div class="fnav" id="floatingNav">
  <div class="fnav-menu" id="fnavMenu">
    <a href="#regime" class="fnav-item" data-section="regime"><i class="fas fa-gauge"></i><span>Régime</span></a>
    <a href="#macro" class="fnav-item" data-section="macro"><i class="fas fa-globe"></i><span>Macro</span></a>
    <a href="#synthese" class="fnav-item" data-section="synthese"><i class="fas fa-table-list"></i><span>Signaux</span></a>
    <a href="#methodo" class="fnav-item" data-section="methodo"><i class="fas fa-flask"></i><span>Méthodologie</span></a>
    <a href="#disclaimer" class="fnav-item" data-section="disclaimer"><i class="fas fa-triangle-exclamation"></i><span>Disclaimer</span></a>
    <a href="#" class="fnav-item"><i class="fas fa-arrow-up"></i><span>Haut</span></a>
  </div>
  <button class="fnav-btn" id="fnavBtn" type="button" aria-label="Navigation">
    <i class="fas fa-bars" id="fnavIcon"></i>
    <span class="fnav-btn-label" id="fnavLabel">Menu</span>
  </button>
</div>

<footer class="article-footer">
  © 2026 DailyTickers. Données de marché temps réel.
  Ceci n'est pas un conseil financier.
  <br><a href="/" title="Accueil"><i class="fas fa-house"></i></a>
</footer>

<script src="/assets/core.js"></script>
<script src="/assets/tag-renderer.js"></script>
<script src="/assets/live-tracker.js"></script>
</body>
</html>`;
}

// ─── WRITE OUTPUT ─────────────────────────────────────────────────────────────

const html = buildPage(d);

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(outPath, html, 'utf8');
console.log(`Wrote ${outPath} (${(html.length / 1024).toFixed(1)} KB, ${d.setups ? d.setups.length : 0} setups)`);
