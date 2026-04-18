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

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node tools/render-scanner.js scanner/YYYYMMDD/');
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

// ─── HELPERS ─────────────────────────────────────────────────────────────────

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
  return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  const pColor = v <= 30 ? '#22c55e' : v <= 50 ? '#f59e0b' : v <= 70 ? '#f97316' : '#ef4444';
  return JSON.stringify({
    series: [{
      type: 'gauge', startAngle: 200, endAngle: -20, min: 0, max: 100,
      progress: { show: true, width: 18, itemStyle: { color: pColor } },
      pointer: { show: true, length: '60%', width: 6 },
      axisLine: { lineStyle: { width: 18, color: [[0.3,'#ef4444'],[0.5,'#f59e0b'],[0.7,'#22c55e'],[1,'#3b82f6']] } },
      axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
      detail: { valueAnimation: true, formatter: '{value}', fontSize: 28, fontWeight: 800, offsetCenter: [0,'70%'] },
      data: [{ value: v, name: 'Regime Score' }]
    }]
  });
}

// ─── STRATEGY PIE CHART ──────────────────────────────────────────────────────

const PIE_COLORS = { Momentum: '#22c55e', Breakout: '#3b82f6', Pullback: '#f59e0b', 'Pre-Squeeze': '#8b5cf6' };

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
    const color = (s.logo_gradient && s.logo_gradient[0]) || (s.score >= 90 ? '#22c55e' : s.score >= 87 ? '#3b82f6' : '#f59e0b');
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

// ─── PER-SETUP GAUGE & RADAR ──────────────────────────────────────────────────

function setupGaugeConfig(score, tickerColor) {
  const pColor = tickerColor || '#3b82f6';
  return JSON.stringify({
    series: [{
      type: 'gauge', startAngle: 200, endAngle: -20, min: 0, max: 100,
      progress: { show: true, width: 14, itemStyle: { color: pColor } },
      pointer: { show: true, length: '55%', width: 5 },
      axisLine: { lineStyle: { width: 14, color: [[0.6,'#e2e8f0'],[0.85,'#fbbf24'],[1,'#22c55e']] } },
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
<!-- SETUP ${idx + 1}: ${s.ticker} -->
<div class="setup-card" id="setup-${s.ticker}" data-ticker="${s.ticker}" data-sharia="${s.sharia ? 'true' : 'false'}" data-entry="${s.entry_low || s.entry_high || 0}" data-stop="${s.stop || 0}" data-tp1="${s.tp1 || 0}" data-tp2="${s.tp2 || 0}">
  <div class="setup-header">
    <div class="scanner-ticker-logo" style="${gradStyle}">${s.ticker}</div>
    <div class="setup-header-info">
      <h3>${s.ticker} &mdash; ${s.name}</h3>
      <div class="setup-name">${s.description || ''}</div>
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

  <img class="finviz-chart" src="https://finviz.com/chart.ashx?t=${s.ticker}&amp;ty=c&amp;ta=1&amp;p=d&amp;s=l" alt="${s.ticker} FinViz Chart" loading="lazy">

  <div class="chart-grid-2col">
    <div>${echartDiv(gaugeId, 250)}</div>
    <div>${echartDiv(radarId, 250)}</div>
  </div>

  <p>${s.thesis || ''}</p>

  <div class="confirm-box">
    <h4>&#x2705; Confirmations</h4>
    <ul>${confirmItems}</ul>
  </div>
  <div class="invalid-box">
    <h4>&#x274C; Invalidations</h4>
    <ul>${invalidItems}</ul>
  </div>

  <div class="levels-grid">
    <div><strong>Entry:</strong> ${entryDisplay}</div>
    <div><strong>Stop Loss:</strong> ${fmtPrice(s.stop)}</div>
    <div><strong>TP1:</strong> ${fmtPrice(s.tp1)}</div>
    <div><strong>TP2:</strong> ${s.tp2 ? fmtPrice(s.tp2) : '&mdash;'}</div>
    <div><strong>R/R:</strong> ${s.rr || '&mdash;'}</div>
    <div><strong>Horizon:</strong> ${s.horizon_days ? s.horizon_days + ' days' : '&mdash;'}</div>
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
    return `    <a href="#setup-${s.ticker}"><span style="${gradStyle}color:white;padding:2px 8px;border-radius:6px;font-size:0.8rem;">${s.ticker}</span> ${s.name.split(' ').slice(0,2).join(' ')}${flag}</a>`;
  });
  return `<div class="nav-grid">\n${links.join('\n')}\n</div>`;
}

// ─── SYNTHESE TABLE ──────────────────────────────────────────────────────────

function syntheseTable(setups) {
  const rows = setups.map((s, i) => {
    const shariaAttr = `data-sharia="${s.sharia ? 'true' : 'false'}"`;
    const entryVal = s.entry_low || s.entry_high || 0;
    return `        <tr ${shariaAttr}><td>${i + 1}</td><td><strong>${s.ticker}</strong></td><td>${s.name}</td><td>${s.region_label || s.region || 'US'}</td><td>${s.pattern || 'Momentum'}</td><td class="up"><strong>${s.score}</strong></td><td>$${entryVal}</td><td>$${s.stop || ''}</td><td>$${s.tp1 || ''}</td><td>${s.rr || ''}</td></tr>`;
  });
  return `    <table class="data-table">
      <thead>
        <tr><th>#</th><th>Ticker</th><th>Name</th><th>Region</th><th>Strategy</th><th>Score</th><th>Entry</th><th>Stop</th><th>TP1</th><th>R/R</th></tr>
      </thead>
      <tbody>
${rows.join('\n')}
      </tbody>
    </table>`;
}

// ─── DIVERSIFICATION TABLE ───────────────────────────────────────────────────

function divmatTable(data) {
  if (!data || !data.length) return '';
  const rows = data.map(r =>
    `        <tr><td><strong>${r.region}</strong></td><td>${r.tickers}</td><td>${r.count}</td><td>${r.strategies}</td></tr>`
  );
  // Total row
  const total = data.reduce((a, r) => a + r.count, 0);
  return `    <table class="divmat-table">
      <thead><tr><th>Region</th><th>Tickers</th><th>Count</th><th>Strategies</th></tr></thead>
      <tbody>
${rows.join('\n')}
        <tr style="background:#eff6ff;font-weight:700;"><td><strong>Total</strong></td><td>${total} setups</td><td>${total}</td><td>&mdash;</td></tr>
      </tbody>
    </table>`;
}

// ─── THEMATIC TABLE ──────────────────────────────────────────────────────────

function thematicTable(data) {
  if (!data || !data.length) return '';
  const rows = data.map(r =>
    `        <tr><td><strong>${r.theme}</strong></td><td>${r.tickers}</td><td>${r.rationale}</td></tr>`
  );
  return `    <table class="divmat-table">
      <thead><tr><th>Theme</th><th>Tickers</th><th>Rationale</th></tr></thead>
      <tbody>${rows.join('\n')}</tbody>
    </table>`;
}

// ─── ALERTS ──────────────────────────────────────────────────────────────────

function alertsHtml(alerts) {
  if (!alerts || !alerts.length) return '';
  return alerts.map(a => {
    const cls = a.type === 'warning' ? 'iran-alert' : 'risk-on-banner';
    return `  <div class="${cls}">\n    <strong>&#x26A0; ${a.title}:</strong> ${a.text}\n  </div>`;
  }).join('\n');
}

// ─── MACRO CALENDAR TABLE ────────────────────────────────────────────────────

function macroCalendarTable(rows) {
  if (!rows || !rows.length) return '';
  const trs = rows.map(r => {
    const dirClass = r.dir === 'up' ? 'up' : r.dir === 'down' ? 'down' : '';
    const impactClass = (r.impact || '').toUpperCase().includes('HIGH') ? 'up' : '';
    return `            <tr><td><strong>${r.date}</strong></td><td>${r.event}</td><td class="${impactClass}"><strong>${r.impact || ''}</strong></td><td>${r.note || ''}</td></tr>`;
  });
  return `        <table class="data-table">
          <thead><tr><th>Date</th><th>Event</th><th>Impact</th><th>Direction Risk</th></tr></thead>
          <tbody>${trs.join('')}</tbody>
        </table>`;
}

// ─── SECTOR ROTATION TABLE ───────────────────────────────────────────────────

function sectorRotationTable(rows) {
  if (!rows || !rows.length) return '';
  const trs = rows.map(r => {
    const dirClass = r.dir === 'up' ? 'up' : r.dir === 'down' ? 'down' : '';
    return `            <tr><td>${r.sector}</td><td class="${dirClass}">${r.perf}</td><td>${r.signal}</td><td><strong>${r.exposure}</strong></td></tr>`;
  });
  return `        <table class="data-table">
          <thead><tr><th>Sector (ETF)</th><th>Week Performance</th><th>Regime Signal</th><th>Our Exposure</th></tr></thead>
          <tbody>${trs.join('')}</tbody>
        </table>`;
}

// ─── MAIN PAGE ASSEMBLER ─────────────────────────────────────────────────────

function buildPage(d) {
  const setups   = d.setups || [];
  const tagStr   = (d.tags || []).join(',');
  const tickers  = setups.map(s => s.ticker).join(', ');
  const regime   = d.regime || 'RISK-ON';
  const regColor = d.regime_color || '#16a34a';

  // Register top-level charts early (before flush)
  addChart('regimeGauge',  regimeGaugeConfig(d.regime_score || 0));
  addChart('strategyPie',  strategyPieConfig(d.regime_strategy_weights || {}));
  addChart('radarOverview',radarOverviewConfig(setups));
  addChart('treemapSector',treemapConfig(setups));
  addChart('scoreBar',     scoreBarConfig(setups));

  // Build per-setup HTML (also registers per-setup charts)
  const setupCardsHtml = setups.map((s, i) => setupCard(s, i)).join('\n');

  // ── KPI boxes ──────────────────────────────────────────────────────────────
  const dominantStr = (d.kpis && d.kpis.dominant_patterns || []).join(' + ');
  const vixVal   = (d.kpis && d.kpis.vix)  ? `${d.kpis.vix.value} (${d.kpis.vix.label})` : '';
  const vixColor = (d.kpis && d.kpis.vix && d.kpis.vix.color) || '#22c55e';
  const spxVal   = (d.kpis && d.kpis.spx)  ? `${d.kpis.spx.value}` : '';
  const spxColor = (d.kpis && d.kpis.spx && d.kpis.spx.color) || '#22c55e';
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
    ? `<p><strong>Contextual Risk Warning (${d.session_label || d.date}):</strong> ${d.disclaimer_extra}</p>`
    : '';

  // ── synthese_extra tables ──────────────────────────────────────────────────
  const extra = d.synthese_extra || {};
  const divMatHtml = divmatTable(extra.diversification || []);
  const thematicHtml = thematicTable(extra.thematic || []);

  return `<!DOCTYPE html>
<html lang="en" data-tags="${tagStr}" data-tab="scanner">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Top ${setups.length} A+ ${regime} &mdash; ${tickers} | DailyTickers Scanner</title>
  <meta name="description" content="Scanner ${d.session_label || d.date} &mdash; ${regime} (score ${d.regime_score || 0}). ${setups.length} A+ setups.">
  <meta property="og:title" content="Scanner DailyTickers &mdash; ${d.session_label || d.date} &mdash; ${tickers}">
  <meta property="og:description" content="${regime} regime. ${d.session_label || d.date}. ${setups.length} A+ setups.">
  <meta property="og:image" content="https://articles.dailytickers.com/scanner-daily-card.png">
  <meta property="og:url" content="${d.url || `https://articles.dailytickers.com/scanner/${d.date}/`}">
  <meta property="og:type" content="article">
  <meta name="twitter:card" content="summary_large_image">
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-T5Z595CW');</script>
  <link rel="stylesheet" href="/assets/report.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
  <!-- Scanner styles live in /assets/report.css (scanner-specific section) -->
</head>
<body>
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-T5Z595CW" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>

<nav class="brand-bar">
  <div class="brand-bar-inner">
    <a href="/" class="brand-logo"><img src="/logo.svg" alt="" width="36" height="36"><span class="brand-title">DailyTickers</span></a>
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
  <h1 class="ticker-name">Scanner DailyTickers &mdash; ${d.session_label || d.date}</h1>
  <p class="ticker-subtitle">Top ${setups.length} A+ ${regime} &mdash; ${tickers}</p>
  <div class="ticker-kpis">
    <div class="kpi-box"><span class="kpi-label">Regime</span><span class="kpi-value" style="color:${regColor};">${regime}</span></div>
    <div class="kpi-box"><span class="kpi-label">Avg Score</span><span class="kpi-value">${avgScore}</span></div>
    <div class="kpi-box"><span class="kpi-label">Setups</span><span class="kpi-value">${setups.length}</span></div>
    <div class="kpi-box"><span class="kpi-label">Dominant</span><span class="kpi-value">${dominantStr || 'Momentum'}</span></div>
    ${vixVal ? `<div class="kpi-box"><span class="kpi-label">VIX</span><span class="kpi-value" style="color:${vixColor};">${vixVal}</span></div>` : ''}
    ${spxVal ? `<div class="kpi-box"><span class="kpi-label">SPX</span><span class="kpi-value" style="color:${spxColor};">${spxVal}</span></div>` : ''}
  </div>
  <div id="article-clickable-tags" class="card-tags"></div>
</div>

<!-- INTRO -->
<div class="content-card">
  ${d.intro || ''}
${alertsHtml(d.alerts)}
  <p>${d.regime_prose || ''}</p>
  <p style="background:#f0fdf4;border:1px solid #86efac;padding:0.75rem;border-radius:8px;font-size:0.9rem;">
    <strong>Session strategy:</strong> ${d.strategy || ''}
  </p>
  <div class="report-card-meta">${d.session_label || d.date}</div>
</div>

<!-- REGIME SECTION -->
<section id="regime" class="section-block">
  <div class="section-header"><h2><i class="fas fa-gauge"></i> Market Regime: ${regime} (Score ${d.regime_score || 0})</h2></div>
  <div class="content-card">
    <p>${d.regime_prose || ''}</p>
    <div class="chart-grid-2col">
      <div>${echartDiv('regimeGauge', 280)}</div>
      <div>${echartDiv('strategyPie', 280)}</div>
    </div>

    <h4 style="margin:1.5rem 0 0.75rem;font-weight:700;">Market Snapshot (${d.session_label || d.date})</h4>
    <table class="data-table">
      <thead><tr><th>Index / Asset</th><th>Price</th><th>Change</th><th>Signal</th></tr></thead>
      <tbody>
${(d.market_snapshot || []).map(r => `        <tr><td><strong>${r.name}</strong></td><td>${r.price}</td><td class="${r.dir === 'up' ? 'up' : 'down'}">${r.change}</td><td>${r.signal}</td></tr>`).join('\n')}
      </tbody>
    </table>

    ${d.pedagogy ? `<div class="pedagogy-box">
      <h4><i class="fas fa-graduation-cap"></i> ${d.pedagogy.title}</h4>
      <p>${d.pedagogy.content}</p>
    </div>` : ''}
  </div>
</section>

<!-- OVERVIEW -->
<section id="overview" class="section-block">
  <div class="section-header"><h2><i class="fas fa-list"></i> Visual Overview &mdash; ${setups.length} Setups</h2></div>
  <div class="content-card">
    <div class="chart-grid-2col">
      <div>${echartDiv('radarOverview', 350)}</div>
      <div>${echartDiv('treemapSector', 350)}</div>
    </div>
  </div>
${navGrid(setups)}
</section>

<!-- MACRO CONTEXT -->
<section class="section-block">
  <div class="section-header"><h2><i class="fas fa-globe"></i> Macro Context &mdash; Week of ${d.session_label || d.date}</h2></div>
  <div class="content-card">
    <div class="chart-grid-2col">
      <div>
        <h4 style="font-weight:700;margin-bottom:0.75rem;">Global Events Calendar</h4>
${macroCalendarTable(d.macro_calendar)}
      </div>
      <div>
        <h4 style="font-weight:700;margin-bottom:0.75rem;">Sector Rotation Scorecard</h4>
${sectorRotationTable(d.sector_rotation)}
      </div>
    </div>

    ${d.macro_thesis ? `<div class="pedagogy-box">
      <h4><i class="fas fa-info-circle"></i> Week-Ahead Thesis</h4>
      <p>${d.macro_thesis}</p>
    </div>` : ''}
  </div>
</section>

<!-- ===================== SETUP CARDS ===================== -->
${setupCardsHtml}

<!-- ===================== SYNTHESIS ===================== -->
<section id="synthese" class="section-block">
  <div class="section-header"><h2><i class="fas fa-chart-pie"></i> Synthesis &mdash; ${setups.length} Setup Summary</h2></div>
  <div class="content-card">
${syntheseTable(setups)}
    ${echartDiv('scoreBar', 280)}

    ${divMatHtml ? `<h4 style="margin:1.5rem 0 0.75rem;font-weight:700;">Diversification Matrix</h4>\n${divMatHtml}` : ''}
    ${thematicHtml ? `<h4 style="margin:1.5rem 0 0.75rem;font-weight:700;">Thematic Allocation</h4>\n${thematicHtml}` : ''}
  </div>
</section>

<!-- PERFORMANCE -->
<section id="performance" class="section-block">
  <div class="section-header"><h2><i class="fas fa-chart-bar"></i> Portfolio Parameters &amp; Historical Performance</h2></div>
  <div class="content-card">
    ${perfRows ? `<table class="data-table">
      <thead><tr><th>Metric</th><th>Value</th></tr></thead>
      <tbody>${perfRows}</tbody>
    </table>` : '<p>Performance data will be available after the sweep cycle completes.</p>'}
    <div class="pedagogy-box">
      <h4><i class="fas fa-info-circle"></i> How to use these levels</h4>
      <p>Entry zones are ranges &mdash; enter at the open (9:30&ndash;9:45 ET) if price falls within range. For EU setups, enter at the London open or early US session ADR price. Stop losses are hard exits, not mental stops. TP1 is the primary profit target: take 50% off at TP1, move stop to breakeven, trail the remainder to TP2. R/R ratios assume entry at the midpoint of the range. Horizon is the expected time to TP1 &mdash; if TP1 is not hit within 2&times; the horizon, reassess.</p>
    </div>
  </div>
</section>

<!-- METHODOLOGY -->
<section id="methodo" class="section-block">
  <div class="section-header"><h2><i class="fas fa-flask"></i> Methodology</h2></div>
  <div class="content-card">
    <div class="pedagogy-box">
      <h4>1. Market Regime Detection</h4>
      <p>We compute a composite regime score from 6 components: VIX (sub-20 = 0 = bullish), SPX breadth (above 50/200 DMA), Credit (HYG spread normalization), DXY (weak dollar = bullish for multinationals), Liquidity (Fed balance sheet trend), and TLT (bond market signal). Score range 0&ndash;1: 0&ndash;0.30 = RISK-ON, 0.30&ndash;0.50 = NEUTRAL/Early Risk-Off, 0.50&ndash;0.70 = RISK-OFF, &gt;0.70 = DEEP RISK-OFF. The VIX close behavior is the primary confirmation signal.</p>
    </div>
    <div class="pedagogy-box">
      <h4>2. Multi-Strategy Screening</h4>
      <p>We run 3 complementary DSL screens: (a) Momentum Expansion: <code>close&gt;sma(close,20) &amp;&amp; vol&gt;sma(vol,20)*1.5 &amp;&amp; rsi14&gt;50 &amp;&amp; rsi14&lt;75</code>, (b) Breakout Squeeze: <code>close&gt;sma(close,50) &amp;&amp; atr(14)&gt;atr(28)*1.2</code>, (c) Pullback-to-Support: <code>rsi14&lt;45 &amp;&amp; close&gt;sma(close,200) &amp;&amp; close&lt;sma(close,50)*1.05</code>. Screened universe: US mega-caps, EU/ADR large-caps, Asian ADRs, and sector ETFs. Short Squeeze is excluded from all screens per protocol established March 20, 2026.</p>
    </div>
    <div class="pedagogy-box">
      <h4>3. Composite Scoring (4 Factors)</h4>
      <p>Each setup receives a score 0&ndash;100 based on: <strong>Technical (40%)</strong> &mdash; RSI position, MACD signal, SMA alignment, volume vs average; <strong>Momentum (30%)</strong> &mdash; 1-week, 1-month, 3-month price performance; <strong>Confluence (20%)</strong> &mdash; number of independent signals aligned (min 3 required for A+); <strong>Catalyst (10%)</strong> &mdash; identifiable near-term catalyst (earnings, sector rotation, macro event). Only setups scoring &ge;85 qualify as A+.</p>
    </div>
    <div class="pedagogy-box">
      <h4>4. Anti-Dilution &amp; Quality Filter</h4>
      <p>All selected tickers are vetted for dilution risk: no S-3 shelf registrations, ATM programs, PIPE structures, or aggressive underwriter relationships. Short Squeeze permanently excluded. Open-position exclusions applied per current portfolio state.</p>
    </div>
    <div class="pedagogy-box">
      <h4>5. Validation &amp; Ranking</h4>
      <p>Final ranking prioritizes: (1) earnings catalyst recency/quality, (2) geopolitical/macro thematic alignment, (3) momentum quality, (4) diversification requirements (min 5 US, 2 EU, 1 Asia, 2 ETF). R/R minimum of 1:1.5 enforced for all setups. Sharia compliance tagged on every setup.</p>
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:1rem;margin-top:1rem;">
      <h4 style="margin:0 0 0.5rem;">Data Sources</h4>
      <ul style="margin:0;font-size:0.85rem;color:#64748b;">
        <li>Price data: Yahoo Finance (via DailyTickers Gateway)</li>
        <li>Market regime: DailyTickers RunAutoScreener (6-component model)</li>
        <li>Screening: RunScreener DSL (3 strategies: momentum, breakout, pullback)</li>
        <li>Fundamental data: MCP QueryData (quote, social_sentiment, capital_flow, insider_transactions)</li>
        <li>Generated: ${d.session_label || d.date}</li>
      </ul>
    </div>
  </div>
</section>

<!-- DISCLAIMER -->
<section id="disclaimer" class="section-block">
  <div class="section-header"><h2><i class="fas fa-triangle-exclamation"></i> Disclaimer</h2></div>
  <div class="content-card">
    <p><strong>This scanner is for informational and educational purposes only. It does not constitute financial advice, investment advice, or a recommendation to buy or sell any security.</strong></p>
    <p>All setups carry risk. Past performance of the DailyTickers scanner does not guarantee future results. Entry zones, stops, and targets are estimates based on technical analysis and are not guarantees of execution. Market conditions can change rapidly.</p>
    ${disclaimerExtra}
    <p>DailyTickers is not a registered investment advisor. All content is provided &ldquo;as is&rdquo; without warranty of any kind. Always consult a qualified financial advisor before making investment decisions.</p>
    <p style="font-size:0.8rem;color:#94a3b8;">&copy; 2026 DailyTickers &mdash; <a href="${d.url || `https://articles.dailytickers.com/scanner/${d.date}/`}">${d.url || `articles.dailytickers.com/scanner/${d.date}/`}</a></p>
  </div>
</section>

<!-- FAB -->
<div class="fnav" id="floatingNav">
  <div class="fnav-menu" id="fnavMenu">
    <a href="#regime" class="fnav-item" data-section="regime"><i class="fas fa-gauge"></i><span>R&eacute;gime</span></a>
    <a href="#overview" class="fnav-item" data-section="overview"><i class="fas fa-list"></i><span>Vue d&rsquo;Ensemble</span></a>
    <a href="#synthese" class="fnav-item" data-section="synthese"><i class="fas fa-chart-pie"></i><span>Synth&egrave;se</span></a>
    <a href="#performance" class="fnav-item" data-section="performance"><i class="fas fa-chart-bar"></i><span>Performance</span></a>
    <a href="#methodo" class="fnav-item" data-section="methodo"><i class="fas fa-flask"></i><span>M&eacute;thodologie</span></a>
    <a href="#disclaimer" class="fnav-item" data-section="disclaimer"><i class="fas fa-triangle-exclamation"></i><span>Disclaimer</span></a>
  </div>
  <button class="fnav-btn" id="fnavBtn" type="button" aria-label="Navigation">
    <i class="fas fa-bars" id="fnavIcon"></i>
    <span class="fnav-btn-label" id="fnavLabel">Menu</span>
  </button>
</div>

<footer class="article-footer">
  &copy; 2026 DailyTickers. Donn&eacute;es via DailyTickers Gateway.
  Ceci n&rsquo;est pas un conseil financier.
  <br><a href="/" title="Accueil"><i class="fas fa-house"></i></a>
</footer>

<script src="/assets/core.js"></script>
<script src="/assets/tag-renderer.js"></script>
<script src="/assets/live-tracker.js"></script>

${flushChartsScript()}
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
