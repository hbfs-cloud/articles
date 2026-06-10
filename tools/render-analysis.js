#!/usr/bin/env node
/**
 * render-analysis.js — DailyTickers Analysis JSON → HTML Renderer
 *
 * Usage:  node tools/render-analysis.js analyses/DKNG/data.json
 *         node tools/render-analysis.js analyses/DKNG/
 *         node tools/render-analysis.js --batch analyses/batch.json
 *
 * Reads  analyses/{TICKER}/data.json
 * Writes analyses/{TICKER}/index.html
 *
 * Batch mode: reads a JSON array of ticker data objects,
 * writes each to analyses/{ticker}/index.html
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── CLI ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isBatch = args[0] === '--batch';

if (!args.length) {
  console.error('Usage: node tools/render-analysis.js analyses/TICKER/data.json');
  console.error('       node tools/render-analysis.js --batch analyses/batch.json');
  process.exit(1);
}

if (isBatch) {
  const batchPath = args[1];
  if (!batchPath || !fs.existsSync(batchPath)) {
    console.error('Batch file not found:', batchPath);
    process.exit(1);
  }
  const items = JSON.parse(fs.readFileSync(batchPath, 'utf8'));
  for (const d of items) {
    const outDir = path.join('analyses', d.ticker);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, 'index.html');
    fs.writeFileSync(outPath, render(d), 'utf8');
    console.log(`✅ ${d.ticker} → ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)}KB)`);
  }
  process.exit(0);
}

const arg = args[0];
const isJson = arg.endsWith('.json');
const dataPath = isJson ? arg : path.join(arg.replace(/\/$/, ''), 'data.json');
const outDir = isJson ? path.dirname(arg) : arg.replace(/\/$/, '');
const outPath = path.join(outDir, 'index.html');

if (!fs.existsSync(dataPath)) {
  console.error('data.json not found at', dataPath);
  process.exit(1);
}

const d = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
fs.writeFileSync(outPath, render(d), 'utf8');
console.log(`✅ ${d.ticker} → ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)}KB)`);

// ─── HELPERS ────────────────────────────────────────────────────────────────

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function fmtNum(n) {
  if (n == null) return 'N/A';
  if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

function fmtPct(n) { return n != null ? n.toFixed(2) + '%' : 'N/A'; }
function fmtPrice(n) { return n != null ? '$' + Number(n).toFixed(2) : 'N/A'; }
function badge(text, color) { return `<span class="badge badge-${color}">${text}</span>`; }

function gradeColor(g) {
  if (!g) return '#64748b';
  if (g.startsWith('A')) return '#22c55e';
  if (g.startsWith('B')) return '#3b82f6';
  if (g.startsWith('C')) return '#f59e0b';
  return '#ef4444';
}

function severityColor(s) {
  const m = { critical: '#ef4444', high: '#f59e0b', medium: '#3b82f6', low: '#22c55e' };
  return m[s] || '#64748b';
}

function severityIcon(s) {
  const m = { critical: 'fa-skull-crossbones', high: 'fa-triangle-exclamation', medium: 'fa-circle-info', low: 'fa-circle-check' };
  return m[s] || 'fa-circle-info';
}

function strategyColor(s) {
  const m = { Momentum: 'purple', Breakout: 'blue', 'Pre-Squeeze': 'green', Pullback: 'amber' };
  return m[s] || 'blue';
}

// ─── RENDER ─────────────────────────────────────────────────────────────────

function render(d) {
  const q = d.quote || {};
  const fin = d.financials || {};
  const tech = d.technicals || {};
  const trade = d.trade || {};
  const verdict = d.verdict || {};
  const isEtf = d.type === 'etf';
  const changePctAbs = Math.abs(q.change_pct || 0);
  const changeSign = (q.change_pct || 0) >= 0 ? '+' : '';
  const debtMcap = q.market_cap ? ((fin.total_debt || 0) / q.market_cap * 100).toFixed(1) : 'N/A';
  const chartId = d.ticker.replace(/[^a-zA-Z0-9]/g, '');

  return `<!DOCTYPE html>
<html lang="${d.lang || 'en'}" data-tags="${esc(d.tags)}" data-tab="analyses" data-grade="${esc(d.grade || 'B+')}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DailyTickers | ${esc(d.ticker)} Analysis — ${esc(d.name)} | ${d.date}</title>
    <meta name="description" content="${esc(d.ticker)} analysis: ${esc(verdict.summary || trade.thesis || '').slice(0, 160)}">
    <meta property="og:title" content="DailyTickers — ${esc(d.ticker)} Analysis">
    <meta property="og:description" content="${esc(d.ticker)}: ${esc(trade.strategy)} setup, score ${trade.score}/100. Entry ${fmtPrice(trade.entry)}, target ${fmtPrice(trade.tp1)}.">
    <meta property="og:image" content="https://assets.parqet.com/logos/symbol/${esc(d.ticker)}?format=jpg">
    <meta property="og:type" content="article">
    <meta property="og:url" content="https://articles.dailytickers.com/analyses/${esc(d.ticker)}/">
    <meta name="twitter:card" content="summary_large_image">
    <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-T5Z595CW');</script>
    <link rel="icon" href="/favicon.ico">
    <link rel="stylesheet" href="/assets/report.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
</head>
<body>
    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-T5Z595CW" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>

    <nav class="brand-bar">
      <div class="brand-bar-inner">
        <a href="/" class="brand-logo">
          <img src="/logo.svg" alt="" width="36" height="36">
          <span class="brand-title">DailyTickers</span>
        </a>
        <div class="brand-nav">
          <a href="/?tab=weekly">Hebdo</a>
          <a href="/?tab=daily">Daily</a>
          <a href="/?tab=analyses">Analyses</a>
          <a href="/?tab=scanner">Scanner</a>
          <a href="/?tab=radar">Radar</a>
          <a href="/?tab=series">S&eacute;ries</a>
        </div>
        <div class="brand-actions">
          <a href="/" class="brand-home-btn" title="Home"><i class="fas fa-house"></i></a>
        </div>
      </div>
    </nav>

    <header class="ticker-header">
      <div class="ticker-symbol" style="display:none">${esc(d.ticker)}</div>
      <div class="ticker-name" style="display:none">${esc(d.name)} — ${esc(d.exchange || 'NASDAQ')} · ${isEtf ? 'ETF' : esc(d.sector || '')}</div>
      <div class="ticker-exchange" style="display:none">${esc(d.exchange || 'NASDAQ')} · ${isEtf ? 'ETF' : esc(d.sector || '')}</div>
      <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem;flex-wrap:wrap;">
        <img src="/logo.svg" alt="" width="44" height="44" style="border-radius:10px;">
        <div>
          <h1 style="margin:0;font-size:1.8rem;font-weight:800;">${esc(d.ticker)} <span style="font-weight:400;font-size:1rem;color:#64748b;">— ${esc(d.name)}</span></h1>
          <div style="font-size:0.85rem;color:#64748b;">${esc(d.exchange || 'NASDAQ')} · ${isEtf ? 'ETF' : esc(d.sector || '')} · ${d.date}</div>
        </div>
      </div>

      <div style="display:flex;align-items:baseline;gap:1rem;margin-bottom:1rem;flex-wrap:wrap;">
        <span style="font-size:2.2rem;font-weight:800;">${fmtPrice(q.price)}</span>
        <span style="font-size:1.1rem;font-weight:600;color:${(q.change_pct||0) >= 0 ? '#22c55e' : '#ef4444'};">${changeSign}${fmtPct(q.change_pct)}</span>
        ${badge(trade.strategy, strategyColor(trade.strategy))}
        ${badge('Score ' + trade.score, 'blue')}
        ${badge(d.grade, gradeColor(d.grade).includes('22c55e') ? 'green' : gradeColor(d.grade).includes('3b82f6') ? 'blue' : 'amber')}
        ${d.sharia ? badge('☪ Halal', 'green') : badge('CONV', 'gray')}
      </div>

      <div class="ticker-metrics" style="display:flex;flex-wrap:wrap;gap:1rem;">
        ${q.market_cap ? `<div class="ticker-metric"><div class="tm-value">$${fmtNum(q.market_cap)}</div><div class="tm-label">Market Cap</div></div>` : ''}
        ${q.volume ? `<div class="ticker-metric"><div class="tm-value">${fmtNum(q.volume)}</div><div class="tm-label">Volume</div></div>` : ''}
        ${q.pe_forward ? `<div class="ticker-metric"><div class="tm-value">${q.pe_forward.toFixed(1)}x</div><div class="tm-label">Fwd P/E</div></div>` : ''}
        <div class="ticker-metric"><div class="tm-value">${q.beta ? q.beta.toFixed(2) : 'N/A'}</div><div class="tm-label">Beta</div></div>
        <div class="ticker-metric"><div class="tm-value">$${q.low_52w ? q.low_52w.toFixed(0) : '?'} – $${q.high_52w ? q.high_52w.toFixed(0) : '?'}</div><div class="tm-label">52W Range</div></div>
        ${q.short_pct ? `<div class="ticker-metric"><div class="tm-value">${q.short_pct.toFixed(1)}%</div><div class="tm-label">Short Interest</div></div>` : ''}
        ${q.dividend_yield > 0 ? `<div class="ticker-metric"><div class="tm-value">${(q.dividend_yield * 100).toFixed(2)}%</div><div class="tm-label">Div Yield</div></div>` : ''}
      </div>

      <div id="article-clickable-tags" class="card-tags"></div>
    </header>

    <!-- Finviz Chart -->
    ${!isEtf ? `<div style="max-width:900px;margin:1rem auto;padding:0 1rem;">
      <div onclick="openChartModal()" style="cursor:pointer;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <img src="https://charts2.finviz.com/chart.ashx?t=${esc(d.ticker)}&ty=c&ta=1&p=d&s=l" alt="${esc(d.ticker)} Chart" style="width:100%;display:block;" loading="lazy">
        <div style="background:#f8fafc;padding:6px 12px;font-size:0.7rem;color:#64748b;">
          <span><i class="fa-solid fa-chart-line"></i> Click to enlarge</span>
        </div>
      </div>
    </div>` : ''}

    <div class="container">

      <!-- ═══ VERDICT EXPRESS ═══ -->
      <div id="verdict" class="content-card">
        <h2><i class="fa-solid fa-gavel"></i> Verdict Express</h2>

        <div style="display:flex;gap:2rem;align-items:center;flex-wrap:wrap;margin-bottom:1.5rem;">
          <div style="text-align:center;">
            <div id="gaugeScore" class="echart-box" style="width:180px;height:180px;"></div>
          </div>
          <div style="flex:1;min-width:200px;">
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.75rem;">
              <span style="background:${gradeColor(d.grade)};color:#fff;padding:0.3rem 0.8rem;border-radius:8px;font-weight:800;font-size:1.2rem;">${esc(d.grade)}</span>
              ${badge(verdict.bias || 'Neutral', verdict.bias === 'Bullish' ? 'green' : verdict.bias === 'Bearish' ? 'red' : 'blue')}
              ${badge((verdict.confidence || 70) + '% confidence', 'purple')}
            </div>
            <p style="font-size:0.95rem;line-height:1.6;color:#334155;">${esc(verdict.summary || '')}</p>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem;">
          <div style="background:#f0fdf4;border:1px solid #86efac;padding:1.25rem;border-radius:12px;">
            <h4 style="color:#16a34a;margin:0 0 0.75rem;font-size:1rem;"><i class="fa-solid fa-thumbs-up"></i> Why Buy</h4>
            <ul style="margin:0;padding-left:1.2rem;display:flex;flex-direction:column;gap:0.5rem;">
              ${(verdict.pros || []).map(p => `<li style="font-size:0.9rem;line-height:1.5;">${esc(p)}</li>`).join('\n              ')}
            </ul>
          </div>
          <div style="background:#fef2f2;border:1px solid #fecaca;padding:1.25rem;border-radius:12px;">
            <h4 style="color:#dc2626;margin:0 0 0.75rem;font-size:1rem;"><i class="fa-solid fa-thumbs-down"></i> Why Avoid</h4>
            <ul style="margin:0;padding-left:1.2rem;display:flex;flex-direction:column;gap:0.5rem;">
              ${(verdict.cons || []).map(c => `<li style="font-size:0.9rem;line-height:1.5;">${esc(c)}</li>`).join('\n              ')}
            </ul>
          </div>
        </div>
      </div>

      <!-- ═══ BUSINESS OVERVIEW ═══ -->
      <div id="business" class="content-card">
        <h2><i class="fa-solid fa-building"></i> ${isEtf ? 'ETF Overview' : 'Business Overview'}</h2>
        ${d.business_html || '<p>Business overview not available.</p>'}
      </div>

      <!-- ═══ FUNDAMENTALS ═══ -->
      ${isEtf ? renderEtfFundamentals(d) : renderStockFundamentals(d)}

      <!-- ═══ TECHNICAL ANALYSIS ═══ -->
      <div id="technique" class="content-card">
        <h2><i class="fa-solid fa-chart-area"></i> Technical Analysis</h2>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:2rem;margin-bottom:1.5rem;">
          <div>
            <div id="radarTech${chartId}" class="echart-box" style="height:320px;"></div>
          </div>
          <div>
            <table class="data-table">
              <tbody>
                <tr><td><strong>RSI (14)</strong></td><td style="color:${tech.rsi > 70 ? '#ef4444' : tech.rsi < 30 ? '#22c55e' : '#334155'};font-weight:600;">${tech.rsi ? tech.rsi.toFixed(1) : 'N/A'}</td></tr>
                <tr><td><strong>EMA 20</strong></td><td>${fmtPrice(tech.ema20)}</td></tr>
                <tr><td><strong>EMA 50</strong></td><td>${fmtPrice(tech.ema50)}</td></tr>
                <tr><td><strong>EMA 200</strong></td><td>${fmtPrice(tech.ema200)}</td></tr>
                <tr><td><strong>MACD</strong></td><td style="color:${(tech.macd||0) > (tech.signal||0) ? '#22c55e' : '#ef4444'};font-weight:600;">${tech.macd ? tech.macd.toFixed(3) : 'N/A'}</td></tr>
                <tr><td><strong>Signal</strong></td><td>${tech.signal ? tech.signal.toFixed(3) : 'N/A'}</td></tr>
                <tr><td><strong>ATR (14)</strong></td><td>${fmtPrice(tech.atr)}</td></tr>
              </tbody>
            </table>
            <div style="margin-top:1rem;">
              ${q.price > (tech.ema200 || 0) ? badge('Above EMA200', 'green') : badge('Below EMA200', 'red')}
              ${q.price > (tech.ema50 || 0) ? badge('Above EMA50', 'green') : badge('Below EMA50', 'red')}
              ${(tech.macd||0) > (tech.signal||0) ? badge('MACD Bullish', 'green') : badge('MACD Bearish', 'red')}
              ${tech.rsi > 70 ? badge('Overbought', 'red') : tech.rsi < 30 ? badge('Oversold', 'green') : badge('RSI Neutral', 'blue')}
            </div>
          </div>
        </div>

        <div class="pedagogy-box">
          <h4><i class="fa-solid fa-lightbulb"></i> Technical Setup</h4>
          <p>${esc(d.technical_summary || `${d.ticker} is trading at ${fmtPrice(q.price)}, ${q.price > (tech.ema50||0) ? 'above' : 'below'} its 50-day EMA (${fmtPrice(tech.ema50)}) and ${q.price > (tech.ema200||0) ? 'above' : 'below'} its 200-day EMA (${fmtPrice(tech.ema200)}). RSI at ${(tech.rsi||0).toFixed(1)} indicates ${tech.rsi > 70 ? 'overbought conditions' : tech.rsi < 30 ? 'oversold conditions' : 'neutral momentum'}. MACD is ${(tech.macd||0) > (tech.signal||0) ? 'bullish (above signal line)' : 'bearish (below signal line)'}.`)}</p>
        </div>
      </div>

      <!-- ═══ RISK ANALYSIS ═══ -->
      <div id="risques" class="content-card">
        <h2><i class="fa-solid fa-shield-halved"></i> Risk Analysis</h2>

        <div class="risk-summary">
          <div class="risk-gauge" style="border-color:${severityColor(d.risk_level || 'medium')};">
            <div class="risk-gauge-score" style="color:${severityColor(d.risk_level || 'medium')};">${d.risk_score || 5}/10</div>
            <div class="risk-gauge-label">Risk</div>
          </div>
          <div class="risk-summary-detail">
            <h3>Risk Profile: ${d.risk_level === 'low' ? 'Low' : d.risk_level === 'high' ? 'High' : d.risk_level === 'critical' ? 'Very High' : 'Moderate'}</h3>
            <p>${esc(d.risk_summary || '')}</p>
          </div>
        </div>

        <div class="risk-grid">
          ${(d.risks || []).map(r => `
          <div class="risk-card risk-card-${r.severity}">
            <div class="risk-card-header">
              <div class="risk-card-icon"><i class="fa-solid ${r.icon || 'fa-circle-info'}"></i></div>
              <h4>${esc(r.title)}</h4>
              <span class="risk-severity">${r.severity === 'critical' ? 'Critical' : r.severity === 'high' ? 'High' : r.severity === 'low' ? 'Low' : 'Medium'}</span>
            </div>
            <div class="risk-card-body">
              <ul>${(r.points || []).map(p => `<li>${esc(p)}</li>`).join('')}</ul>
              <div class="risk-meters">
                <div class="risk-meter">
                  <div class="risk-meter-label">Probability</div>
                  <div class="risk-meter-bar"><div class="risk-meter-fill" style="width:${r.probability || 50}%;"></div></div>
                </div>
                <div class="risk-meter">
                  <div class="risk-meter-label">Impact</div>
                  <div class="risk-meter-bar"><div class="risk-meter-fill" style="width:${r.impact || 50}%;"></div></div>
                </div>
              </div>
            </div>
            <div class="risk-verdict"><i class="fa-solid ${severityIcon(r.severity)}"></i> ${esc(r.verdict || '')}</div>
          </div>`).join('\n')}
        </div>
      </div>

      <!-- ═══ TRADE IDEA ═══ -->
      <div id="trade" class="content-card">
        <h2><i class="fa-solid fa-crosshairs"></i> Trade Idea</h2>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;margin-bottom:1.5rem;">
          <div style="border-left:4px solid #3b82f6;padding:1rem;background:#f8fafc;border-radius:0 8px 8px 0;">
            <div style="font-size:0.72rem;color:#64748b;text-transform:uppercase;font-weight:600;">Entry Zone</div>
            <div style="font-size:1.5rem;font-weight:800;color:#0f172a;margin:0.25rem 0;">${fmtPrice(trade.entry)}</div>
            <div style="font-size:0.78rem;color:#64748b;">${esc(trade.strategy)} entry</div>
          </div>
          <div style="border-left:4px solid #ef4444;padding:1rem;background:#fef2f2;border-radius:0 8px 8px 0;">
            <div style="font-size:0.72rem;color:#64748b;text-transform:uppercase;font-weight:600;">Stop Loss</div>
            <div style="font-size:1.5rem;font-weight:800;color:#ef4444;margin:0.25rem 0;">${fmtPrice(trade.stop)}</div>
            <div style="font-size:0.78rem;color:#64748b;">${trade.entry && trade.stop ? (-((trade.entry - trade.stop) / trade.entry * 100)).toFixed(1) : '?'}% risk</div>
          </div>
          <div style="border-left:4px solid #22c55e;padding:1rem;background:#f0fdf4;border-radius:0 8px 8px 0;">
            <div style="font-size:0.72rem;color:#64748b;text-transform:uppercase;font-weight:600;">Target 1</div>
            <div style="font-size:1.5rem;font-weight:800;color:#22c55e;margin:0.25rem 0;">${fmtPrice(trade.tp1)}</div>
            <div style="font-size:0.78rem;color:#64748b;">+${trade.entry && trade.tp1 ? ((trade.tp1 - trade.entry) / trade.entry * 100).toFixed(1) : '?'}% upside</div>
          </div>
          <div style="border-left:4px solid #22c55e;padding:1rem;background:#f0fdf4;border-radius:0 8px 8px 0;">
            <div style="font-size:0.72rem;color:#64748b;text-transform:uppercase;font-weight:600;">Target 2</div>
            <div style="font-size:1.5rem;font-weight:800;color:#22c55e;margin:0.25rem 0;">${fmtPrice(trade.tp2)}</div>
            <div style="font-size:0.78rem;color:#64748b;">+${trade.entry && trade.tp2 ? ((trade.tp2 - trade.entry) / trade.entry * 100).toFixed(1) : '?'}% stretch</div>
          </div>
          <div style="border-left:4px solid #7c3aed;padding:1rem;background:#f5f3ff;border-radius:0 8px 8px 0;">
            <div style="font-size:0.72rem;color:#64748b;text-transform:uppercase;font-weight:600;">Risk/Reward</div>
            <div style="font-size:1.5rem;font-weight:800;color:#7c3aed;margin:0.25rem 0;">${esc(trade.rr || '1:2.0')}</div>
            <div style="font-size:0.78rem;color:#64748b;">${trade.horizon || 10}-day horizon</div>
          </div>
        </div>

        <div class="pedagogy-box">
          <h4><i class="fa-solid fa-lightbulb"></i> Thesis</h4>
          <p>${esc(trade.thesis || '')}</p>
        </div>

        ${trade.catalysts && trade.catalysts.length ? `
        <div style="margin-top:1rem;">
          <h4 style="font-size:0.95rem;margin-bottom:0.5rem;"><i class="fa-solid fa-bolt" style="color:#f59e0b;"></i> Catalysts</h4>
          <ul style="display:flex;flex-direction:column;gap:0.4rem;padding-left:1.2rem;">
            ${trade.catalysts.map(c => `<li style="font-size:0.9rem;">${esc(c)}</li>`).join('\n            ')}
          </ul>
        </div>` : ''}

        ${trade.invalidations && trade.invalidations.length ? `
        <div class="alert-box" style="margin-top:1rem;">
          <h4 style="margin:0 0 0.5rem;"><i class="fa-solid fa-triangle-exclamation"></i> Invalidation</h4>
          <ul style="margin:0;padding-left:1.2rem;">
            ${trade.invalidations.map(inv => `<li style="font-size:0.9rem;">${esc(inv)}</li>`).join('\n            ')}
          </ul>
        </div>` : ''}
      </div>

      <!-- ═══ DISCLAIMER ═══ -->
      <div id="disclaimer" class="content-card">
        <h2><i class="fa-solid fa-triangle-exclamation"></i> Disclaimer</h2>
        <div class="disclaimer-mega">
          <p>This analysis is provided for <strong>informational and educational purposes only</strong>. It does not constitute financial advice, investment recommendation, or solicitation to buy or sell any security.</p>
          <p>Past performance is not indicative of future results. All investments involve risk, including the possible loss of principal. Always conduct your own research and consult a licensed financial advisor before making investment decisions.</p>
          <p>Data sourced from DailyTickers Gateway, Yahoo Finance, SEC EDGAR, and public market data. Accuracy is not guaranteed.</p>
        </div>
      </div>

    </div><!-- /container -->

    <!-- ═══ FAB ═══ -->
    <div class="fnav" id="floatingNav">
      <div class="fnav-menu" id="fnavMenu">
        <a href="#verdict" class="fnav-item" data-section="verdict"><i class="fas fa-gavel"></i><span>Verdict</span></a>
        <a href="#business" class="fnav-item" data-section="business"><i class="fas fa-building"></i><span>${isEtf ? 'Overview' : 'Business'}</span></a>
        <a href="#fondamentaux" class="fnav-item" data-section="fondamentaux"><i class="fas fa-chart-line"></i><span>Fundamentals</span></a>
        <a href="#technique" class="fnav-item" data-section="technique"><i class="fas fa-chart-area"></i><span>Technical</span></a>
        <a href="#risques" class="fnav-item" data-section="risques"><i class="fas fa-shield-halved"></i><span>Risks</span></a>
        <a href="#trade" class="fnav-item" data-section="trade"><i class="fas fa-crosshairs"></i><span>Trade Idea</span></a>
      </div>
      <button class="fnav-btn" id="fnavBtn" type="button" aria-label="Navigation">
        <i class="fas fa-bars" id="fnavIcon"></i>
        <span class="fnav-btn-label" id="fnavLabel">Menu</span>
      </button>
    </div>

    <!-- ═══ CHART MODAL ═══ -->
    <div id="chartModal" style="display:none;position:fixed;inset:0;background:rgba(15,23,42,0.95);z-index:1000;align-items:center;justify-content:center;padding:1rem;" onclick="if(event.target===this)this.style.display='none'">
      <div style="max-width:1000px;width:100%;text-align:center;">
        <img src="https://charts2.finviz.com/chart.ashx?t=${esc(d.ticker)}&ty=c&ta=1&p=d&s=l" alt="${esc(d.ticker)}" style="width:100%;border-radius:12px;margin-bottom:1rem;">
        <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;">
          <a href="https://finviz.com/quote.ashx?t=${esc(d.ticker)}" target="_blank" rel="noopener" style="color:#60a5fa;font-size:0.85rem;"><i class="fa-solid fa-arrow-up-right-from-square"></i> Finviz</a>
          <a href="https://www.tradingview.com/chart/?symbol=${esc(d.ticker)}" target="_blank" rel="noopener" style="color:#60a5fa;font-size:0.85rem;"><i class="fa-solid fa-arrow-up-right-from-square"></i> TradingView</a>
          <a href="https://finance.yahoo.com/quote/${esc(d.ticker)}/" target="_blank" rel="noopener" style="color:#60a5fa;font-size:0.85rem;"><i class="fa-solid fa-arrow-up-right-from-square"></i> Yahoo Finance</a>
        </div>
        <button onclick="document.getElementById('chartModal').style.display='none'" style="position:absolute;top:1rem;right:1rem;background:none;border:none;color:#fff;font-size:2rem;cursor:pointer;">&times;</button>
      </div>
    </div>

    <footer class="article-footer">
      &copy; 2026 DailyTickers. Data via DailyTickers Gateway. Not financial advice.
      <br><a href="/" title="Home"><i class="fas fa-house"></i></a>
    </footer>

    <!-- ═══ ECHARTS ═══ -->
    <script>
    // Score Gauge
    (function(){
      var el=document.getElementById('gaugeScore');
      if(!el)return;
      var c=echarts.init(el);
      c.setOption({
        series:[{
          type:'gauge',radius:'90%',
          axisLine:{lineStyle:{width:12,color:[[0.3,'#ef4444'],[0.5,'#f59e0b'],[0.7,'#3b82f6'],[1,'#22c55e']]}},
          pointer:{itemStyle:{color:'auto'}},
          axisTick:{distance:-12,length:6,lineStyle:{color:'#fff',width:1}},
          splitLine:{distance:-14,length:12,lineStyle:{color:'#fff',width:2}},
          axisLabel:{color:'auto',distance:16,fontSize:11},
          detail:{valueAnimation:true,formatter:'{value}',color:'auto',fontSize:28,fontWeight:800,offsetCenter:[0,'70%']},
          data:[{value:${trade.score || 75}}]
        }]
      });
      window.addEventListener('resize',function(){c.resize();});
    })();

    // Technical Radar
    (function(){
      var el=document.getElementById('radarTech${chartId}');
      if(!el)return;
      var c=echarts.init(el);
      c.setOption({
        radar:{
          indicator:[
            {name:'RSI',max:100},
            {name:'Trend',max:100},
            {name:'Volume',max:100},
            {name:'Momentum',max:100},
            {name:'Volatility',max:100},
            {name:'Support',max:100}
          ],
          shape:'circle',
          splitArea:{areaStyle:{color:['rgba(59,130,246,0.02)','rgba(59,130,246,0.04)']}}
        },
        series:[{
          type:'radar',
          data:[{
            value:[${tech.rsi ? Math.round(tech.rsi) : 50}, ${q.price > (tech.ema50||0) ? (q.price > (tech.ema200||0) ? 85 : 65) : 35}, ${q.volume ? Math.min(90, Math.round((q.volume / 10000000) * 20)) : 50}, ${(tech.macd||0) > (tech.signal||0) ? 75 : 35}, ${tech.atr && q.price ? Math.min(90, Math.round((tech.atr / q.price * 100) * 15)) : 50}, ${q.price > (tech.ema200||0) ? 80 : 30}],
            name:'${esc(d.ticker)}',
            areaStyle:{color:'rgba(59,130,246,0.15)'},
            lineStyle:{color:'#3b82f6'},
            itemStyle:{color:'#3b82f6'}
          }]
        }]
      });
      window.addEventListener('resize',function(){c.resize();});
    })();
    </script>

    <script>
    function openChartModal(){document.getElementById('chartModal').style.display='flex';}
    document.addEventListener('keydown',function(e){if(e.key==='Escape'){var m=document.getElementById('chartModal');if(m)m.style.display='none';}});

    // FAB
    (function(){
      var btn=document.getElementById('fnavBtn'),menu=document.getElementById('fnavMenu'),open=false;
      if(!btn||!menu)return;
      btn.addEventListener('click',function(){open=!open;menu.classList.toggle('open',open);});
      menu.querySelectorAll('.fnav-item').forEach(function(a){a.addEventListener('click',function(){open=false;menu.classList.remove('open');});});
      var obs=new IntersectionObserver(function(entries){
        entries.forEach(function(e){if(e.isIntersecting){var id=e.target.id;menu.querySelectorAll('.fnav-item').forEach(function(a){a.classList.toggle('active',a.getAttribute('data-section')===id);});}});
      },{threshold:0.3});
      document.querySelectorAll('[id]').forEach(function(el){if(menu.querySelector('[data-section="'+el.id+'"]'))obs.observe(el);});
    })();
    </script>
    <script src="/assets/core.js"></script>
    <script src="/assets/tag-renderer.js"></script>
</body>
</html>`;
}

// ─── STOCK FUNDAMENTALS ─────────────────────────────────────────────────────

function renderStockFundamentals(d) {
  const fin = d.financials || {};
  const q = d.quote || {};
  const debtMcap = q.market_cap && fin.total_debt ? (fin.total_debt / q.market_cap * 100).toFixed(1) : 'N/A';

  return `
      <div id="fondamentaux" class="content-card">
        <h2><i class="fa-solid fa-chart-line"></i> Fundamentals</h2>
        <table class="data-table">
          <thead><tr><th>Metric</th><th>Value</th><th>Signal</th></tr></thead>
          <tbody>
            <tr><td>Revenue (TTM)</td><td><strong>$${fmtNum(fin.revenue)}</strong></td><td>${(fin.revenue_growth||0) > 0 ? badge('+' + fmtPct(fin.revenue_growth) + ' YoY', 'green') : badge(fmtPct(fin.revenue_growth) + ' YoY', 'red')}</td></tr>
            <tr><td>EBITDA</td><td><strong>$${fmtNum(fin.ebitda)}</strong></td><td>${(fin.ebitda||0) > 0 ? badge('Positive', 'green') : badge('Negative', 'red')}</td></tr>
            <tr><td>Gross Margin</td><td><strong>${fmtPct(fin.gross_margin)}</strong></td><td>${(fin.gross_margin||0) > 50 ? badge('Strong', 'green') : (fin.gross_margin||0) > 30 ? badge('Decent', 'blue') : badge('Weak', 'red')}</td></tr>
            <tr><td>Operating Margin</td><td><strong>${fmtPct(fin.op_margin)}</strong></td><td>${(fin.op_margin||0) > 15 ? badge('Strong', 'green') : (fin.op_margin||0) > 0 ? badge('Positive', 'blue') : badge('Negative', 'red')}</td></tr>
            <tr><td>Net Margin</td><td><strong>${fmtPct(fin.profit_margin)}</strong></td><td>${(fin.profit_margin||0) > 10 ? badge('Healthy', 'green') : (fin.profit_margin||0) > 0 ? badge('Thin', 'amber') : badge('Loss', 'red')}</td></tr>
            <tr><td>ROE</td><td><strong>${fmtPct(fin.roe)}</strong></td><td>${(fin.roe||0) > 15 ? badge('Excellent', 'green') : (fin.roe||0) > 0 ? badge('Positive', 'blue') : badge('Negative', 'red')}</td></tr>
            <tr><td>Cash</td><td><strong>$${fmtNum(fin.total_cash)}</strong></td><td></td></tr>
            <tr><td>Debt</td><td><strong>$${fmtNum(fin.total_debt)}</strong></td><td>${badge('Debt/MCap ' + debtMcap + '%', parseFloat(debtMcap) > 50 ? 'red' : parseFloat(debtMcap) > 30 ? 'amber' : 'green')}</td></tr>
            <tr><td>Fwd P/E</td><td><strong>${q.pe_forward ? q.pe_forward.toFixed(1) + 'x' : 'N/A'}</strong></td><td>${q.pe_forward && q.pe_forward < 15 ? badge('Value', 'green') : q.pe_forward && q.pe_forward < 30 ? badge('Fair', 'blue') : badge('Growth', 'purple')}</td></tr>
            <tr><td>Analyst Target</td><td><strong>${fmtPrice(fin.analyst_target)}</strong></td><td>${fin.analyst_target && q.price ? badge((fin.analyst_target > q.price ? '+' : '') + ((fin.analyst_target - q.price) / q.price * 100).toFixed(0) + '% upside', fin.analyst_target > q.price ? 'green' : 'red') : ''}</td></tr>
          </tbody>
        </table>
      </div>`;
}

// ─── ETF FUNDAMENTALS ───────────────────────────────────────────────────────

function renderEtfFundamentals(d) {
  const q = d.quote || {};
  const holdings = d.holdings || [];

  return `
      <div id="fondamentaux" class="content-card">
        <h2><i class="fa-solid fa-chart-line"></i> ETF Fundamentals</h2>
        ${holdings.length ? `
        <h4 style="margin-bottom:0.75rem;">Top Holdings</h4>
        <table class="data-table">
          <thead><tr><th>#</th><th>Holding</th><th>Weight</th></tr></thead>
          <tbody>
            ${holdings.map((h, i) => `<tr><td>${i+1}</td><td><strong>${esc(h.name || h.ticker)}</strong></td><td>${h.weight}%</td></tr>`).join('\n            ')}
          </tbody>
        </table>` : ''}
        <table class="data-table" style="margin-top:1rem;">
          <thead><tr><th>Metric</th><th>Value</th></tr></thead>
          <tbody>
            <tr><td>P/E Ratio</td><td><strong>${q.pe_trailing ? q.pe_trailing.toFixed(1) + 'x' : 'N/A'}</strong></td></tr>
            <tr><td>52-Week High</td><td><strong>${fmtPrice(q.high_52w)}</strong></td></tr>
            <tr><td>52-Week Low</td><td><strong>${fmtPrice(q.low_52w)}</strong></td></tr>
            <tr><td>Avg Volume</td><td><strong>${fmtNum(q.volume)}</strong></td></tr>
            ${d.expense_ratio ? `<tr><td>Expense Ratio</td><td><strong>${d.expense_ratio}%</strong></td></tr>` : ''}
            ${d.aum ? `<tr><td>AUM</td><td><strong>$${fmtNum(d.aum)}</strong></td></tr>` : ''}
          </tbody>
        </table>
      </div>`;
}
