#!/usr/bin/env node
/**
 * generate-scanner-image.js
 * 
 * Génère l'image quotidienne du scanner DailyTickers et la publie sur Telegram.
 * 
 * Usage:
 *   node tools/generate-scanner-image.js [YYYYMMDD]
 *   node tools/generate-scanner-image.js --telegram  (publie aussi sur Telegram)
 *   node tools/generate-scanner-image.js --dry-run   (génère sans publier)
 * 
 * Prérequis:
 *   - puppeteer: npm install puppeteer
 *   - TELEGRAM_BOT_TOKEN dans l'env ou .env
 *   - TELEGRAM_CHAT_ID dans l'env ou .env
 *   - data/scanner-metrics.json (généré par update-tracking.js)
 *   - data/scanner-positions.json (généré par update-tracking.js)
 * 
 * Flux complet:
 *   1. node tools/update-tracking.js       → met à jour les métriques
 *   2. node tools/generate-scanner-image.js --telegram → génère + publie
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const SCANNER_DIR = path.join(ROOT, 'scanner');

// ─── Config ───────────────────────────────────────────────────────────────────

// Load .env if present
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
}

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID   = process.env.TELEGRAM_CHAT_ID   || '';
const PUBLISH_TELEGRAM   = process.argv.includes('--telegram');
const DRY_RUN            = process.argv.includes('--dry-run');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseNumber(s) {
  if (s == null) return null;
  const n = parseFloat(String(s).replace(/[$,]/g, ''));
  return isNaN(n) ? null : n;
}

function parseMidpoint(s) {
  if (!s) return null;
  const nums = String(s).replace(/[$,]/g, '').match(/[\d.]+/g);
  if (!nums) return null;
  const vals = nums.map(Number);
  return vals.length >= 2 ? (vals[0] + vals[1]) / 2 : vals[0];
}

function addBusinessDays(dateStr, days) {
  const d = new Date(dateStr);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

function formatFrenchDate(date, options = {}) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 'date indisponible';
  const rendered = new Intl.DateTimeFormat('fr-FR', options).format(date);
  return rendered.replace(/\b1 (?=[a-zéû])/i, '1er ');
}

// ─── Extract top3 from scan HTML ─────────────────────────────────────────────

const EXCLUDED_STRATEGIES = ['Short Squeeze', 'Short_Squeeze'];
const scannerParser = require('./lib/scanner-parser');

function normalizeStrategy(raw) {
  const s = (raw || '').trim();
  if (/short.?squeeze/i.test(s)) return 'Short Squeeze';
  if (/pre.?squeeze/i.test(s)) return 'Pre-Squeeze';
  if (/breakout/i.test(s)) return 'Breakout';
  if (/pullback/i.test(s)) return 'Pullback';
  return 'Momentum';
}

function extractTop3(scanDir) {
  // JSON-first via loadSignals, HTML fallback for legacy scans
  const loaded = scannerParser.loadSignals(scanDir);
  if (!loaded) return [];
  const trades = [];

  for (const s of loaded.signals) {
    const strategy = normalizeStrategy(s.strategy);
    if (EXCLUDED_STRATEGIES.includes(strategy)) continue;
    if (s.entry == null || s.stop == null || s.tp1 == null) continue;
    trades.push({
      ticker: s.ticker,
      name: s.name || s.ticker,
      strategy,
      score: s.score ?? null,
      entry: s.entry,
      stop: s.stop,
      tp1: s.tp1,
      tp2: s.tp2 || null,
      rr: s.rr || 'n/a',
      completed_end: s.selection_evidence?.screen_snapshot_as_of || null,
    });
  }

  // Anti-doublon: remove tickers already open
  const openTickers = new Set();
  try {
    const pos = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'scanner-positions.json')));
    pos.open_positions.forEach(p => openTickers.add(p.ticker));
  } catch (_) {}

  return trades
    .filter(t => !openTickers.has(t.ticker) || true) // keep for display, flag if duplicate
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

// ─── Extract regime from scan HTML ───────────────────────────────────────────

function extractRegime(scanDir) {
  const htmlPath = path.join(SCANNER_DIR, scanDir, 'index.html');
  if (!fs.existsSync(htmlPath)) return { label: 'UNKNOWN', color: '#94a3b8' };
  const html = fs.readFileSync(htmlPath, 'utf8');
  const m = html.match(/RISK-OFF|EARLY.RISK-OFF|RISK-ON|NEUTRAL|RECOVERY/i);
  const label = m ? m[0].toUpperCase().replace('.', ' ') : 'NEUTRAL';
  const colors = {
    'RISK-OFF': '#dc2626',
    'EARLY RISK-OFF': '#f59e0b',
    'RISK-ON': '#16a34a',
    'NEUTRAL': '#3b82f6',
    'RECOVERY': '#8b5cf6',
  };
  return { label, color: colors[label] || '#64748b' };
}

// ─── Certified local charts ──────────────────────────────────────────────────
// Notification cards must be reproducible and must not become blank when a
// third-party chart CDN redirects, rate-limits or changes markup. Use the
// already collected Marketdata bars, bounded to the scanner reference close.

function findBarsForSymbol(value, ticker) {
  let found = null;
  const visit = node => {
    if (found || !node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (String(node.symbol || node.instrument_id || '').toUpperCase() === ticker.toUpperCase() && Array.isArray(node.bars)) {
      found = node.bars;
      return;
    }
    Object.values(node).forEach(visit);
  };
  visit(value);
  return found;
}

function loadLocalBars(scanDir, ticker, completedEnd) {
  for (const subdir of ['_data2', '_data2_candidates']) {
    const dir = path.join(SCANNER_DIR, scanDir, subdir);
    let files = [];
    try { files = fs.readdirSync(dir).filter(name => /^bars_.*\.json$/.test(name)).sort(); }
    catch (_) { continue; }
    for (const file of files) {
      let payload;
      try { payload = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')); }
      catch (_) { continue; }
      const bars = findBarsForSymbol(payload, ticker);
      if (!bars) continue;
      return bars
        .map(row => Array.isArray(row) ? row : [row.date || row.time, row.open, row.high, row.low, row.close, row.volume])
        .filter(row => /^20\d{2}-\d{2}-\d{2}$/.test(String(row[0])) && (!completedEnd || row[0] <= completedEnd)
          && row.slice(1, 5).every(value => Number.isFinite(Number(value))))
        .slice(-42);
    }
  }
  return [];
}

function candleChart(bars, color) {
  if (!Array.isArray(bars) || bars.length < 2) {
    return `<div style="width:100%;height:110px;background:#f8fafc;border-radius:6px;margin-bottom:8px;display:flex;align-items:center;justify-content:center;border:1px solid #e2e8f0;font-size:10px;color:#64748b;font-weight:700">Graphique indisponible · aucune clôture certifiée</div>`;
  }
  const width = 300, height = 110, left = 6, right = 48, top = 7, bottom = 18;
  const highs = bars.map(row => Number(row[2]));
  const lows = bars.map(row => Number(row[3]));
  const min = Math.min(...lows), max = Math.max(...highs), range = max - min || 1;
  const plotW = width - left - right, plotH = height - top - bottom;
  const xStep = plotW / bars.length;
  const y = value => top + (max - Number(value)) / range * plotH;
  const candles = bars.map((row, index) => {
    const [, open, high, low, close] = row.map((value, i) => i ? Number(value) : value);
    const x = left + (index + 0.5) * xStep;
    const up = close >= open;
    const candleColor = up ? '#059669' : '#dc2626';
    const bodyY = Math.min(y(open), y(close));
    const bodyH = Math.max(1.3, Math.abs(y(open) - y(close)));
    return `<line x1="${x.toFixed(1)}" y1="${y(high).toFixed(1)}" x2="${x.toFixed(1)}" y2="${y(low).toFixed(1)}" stroke="${candleColor}" stroke-width="0.8"/><rect x="${(x - Math.max(1, xStep * .31)).toFixed(1)}" y="${bodyY.toFixed(1)}" width="${Math.max(2, xStep * .62).toFixed(1)}" height="${bodyH.toFixed(1)}" rx="0.5" fill="${candleColor}"/>`;
  }).join('');
  const last = bars[bars.length - 1];
  const firstDate = formatFrenchDate(new Date(`${bars[0][0]}T12:00:00Z`), { day: 'numeric', month: 'short' });
  const lastDate = formatFrenchDate(new Date(`${last[0]}T12:00:00Z`), { day: 'numeric', month: 'short' });
  return `<svg viewBox="0 0 ${width} ${height}" style="width:100%;height:110px;background:#f8fafc;border-radius:6px;margin-bottom:8px;display:block;border:1px solid #e2e8f0" role="img" aria-label="Chandeliers quotidiens jusqu’au ${lastDate}">
    <rect width="${width}" height="${height}" fill="#f8fafc"/>
    ${[0.25, 0.5, 0.75].map(ratio => `<line x1="${left}" y1="${(top + plotH * ratio).toFixed(1)}" x2="${width - right}" y2="${(top + plotH * ratio).toFixed(1)}" stroke="#e2e8f0" stroke-width="0.7"/>`).join('')}
    ${candles}
    <line x1="${width - right + 3}" y1="${y(last[4]).toFixed(1)}" x2="${width - 4}" y2="${y(last[4]).toFixed(1)}" stroke="${color}" stroke-width="1" stroke-dasharray="2 2"/>
    <text x="${width - 4}" y="${Math.max(10, y(last[4]) - 2).toFixed(1)}" text-anchor="end" font-size="8" font-weight="700" fill="${color}">${Number(last[4]).toFixed(2)}</text>
    <text x="${left}" y="${height - 5}" font-size="7" fill="#64748b">${firstDate}</text><text x="${width - right}" y="${height - 5}" text-anchor="end" font-size="7" fill="#64748b">${lastDate} · clôturée</text>
  </svg>`;
}

// ─── Generate HTML for the image ─────────────────────────────────────────────

function generateHTML({ top3, metrics, positions, portfolio, regime, scanDir, yesterday }) {
  const sc = s => s === 'green'
    ? { c: '#059669', bg: '#ecfdf5', bdr: '#6ee7b7' }
    : s === 'red'
    ? { c: '#dc2626', bg: '#fef2f2', bdr: '#fca5a5' }
    : { c: '#d97706', bg: '#fffbeb', bdr: '#fde68a' };

  function spark(vals, color, w, h) {
    w = w || 120; h = h || 26;
    vals = Array.isArray(vals) ? vals.filter(Number.isFinite) : [];
    if (vals.length < 2) return `<div style="height:${h}px;display:flex;align-items:center;color:#94a3b8;font-size:7px">Série indisponible</div>`;
    const max = Math.max(...vals), min = Math.min(...vals), range = max - min || 1;
    const pts = vals.map((v, i) => [
      (i / (vals.length - 1)) * w,
      h - ((v - min) / range) * (h - 4) + 2
    ].join(',')).join(' ');
    const last = pts.split(' ').pop().split(',');
    return `<svg width="${w}" height="${h}" style="display:block">
      <polygon points="0,${h} ${pts} ${w},${h}" fill="${color}18"/>
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="${last[0]}" cy="${last[1]}" r="3" fill="${color}" stroke="white" stroke-width="1.5"/>
    </svg>`;
  }

  const posGrid = [];
  const openPos = (positions || []).slice().sort((a, b) => a.ticker.localeCompare(b.ticker));
  for (let i = 0; i < openPos.length; i += 5) posGrid.push(openPos.slice(i, i + 5));

  const equityHist = Array.isArray(metrics.portfolio_history) ? metrics.portfolio_history : [];
  const ddHist = Array.isArray(metrics.drawdown_history) ? metrics.drawdown_history : [];

  const scanDate = new Date(`${scanDir.slice(0, 4)}-${scanDir.slice(4, 6)}-${scanDir.slice(6, 8)}T12:00:00Z`);
  const today = formatFrenchDate(scanDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const metricsEnd = metrics.updated_at ? new Date(metrics.updated_at) : scanDate;
  const metricsStart = Number.isFinite(metrics.total_days) ? new Date(metricsEnd.getTime() - metrics.total_days * 86400000) : null;
  const metricsPeriod = metricsStart
    ? `${formatFrenchDate(metricsStart, { day: 'numeric', month: 'short' })} → ${formatFrenchDate(metricsEnd, { day: 'numeric', month: 'short', year: 'numeric' })}`
    : 'période indisponible';
  const scanUrl = `https://articles.dailytickers.com/scanner/${scanDir}/`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { background:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif; width:1080px; }
</style>
</head><body>
<div style="background:white;width:1080px">

<!-- HEADER -->
<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:16px 22px 14px;display:flex;justify-content:space-between;align-items:center">
  <div style="display:flex;align-items:center;gap:12px">
    <div style="width:36px;height:36px;background:linear-gradient(135deg,#f59e0b,#ef4444);border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;color:white">MW</div>
    <div>
      <div style="color:white;font-weight:800;font-size:18px;letter-spacing:0.5px">MARKET WATCH</div>
      <div style="color:#60a5fa;font-size:10px;letter-spacing:2px;text-transform:uppercase">Scanner Algorithmique™</div>
    </div>
  </div>
  <div style="text-align:center">
    <div style="color:#f59e0b;font-weight:800;font-size:13px;text-transform:capitalize">${today}</div>
    <div style="display:flex;gap:5px;margin-top:5px;justify-content:center;flex-wrap:wrap">
      <span style="background:${regime.color};color:white;padding:2px 10px;border-radius:12px;font-size:10px;font-weight:700">⚠️ ${regime.label}</span>
    </div>
  </div>
  <div style="text-align:right">
    <div style="color:#94a3b8;font-size:9px">Scan précédent · Top 3</div>
    <div style="color:#e2e8f0;font-size:10px;line-height:1.9;margin-top:2px">
      ${(yesterday || []).map(t => t.ticker).join(' · ') || 'Indisponible'}
    </div>
  </div>
</div>

<!-- GUIDE LECTEURS -->
<div style="background:#f1f5f9;border-bottom:2px solid #e2e8f0;padding:7px 22px;display:flex;gap:14px;align-items:center;flex-wrap:wrap">
  <span style="color:#475569;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:1px;white-space:nowrap">📖 Guide</span>
  ${[
    ['📋 Méthode', 'Max 5 pos. · 1/30 capital · Stop obligatoire à l\'ouverture J+1 (15h30 Paris)'],
    ['🔄 Rotation', 'Scan 22h → Exec J+1 open · Sans cash : Sell J+1 → Cash J+2 → Buy J+3'],
    ['📊 Stats', `${metricsPeriod} · Return = réalisé + positions ouvertes MtM · exécution proxy`],
    ['⚡ Signal', '🟢 >+2%  🟡 Neutre  🔴 <−3% ou proche SL'],
  ].map(([t, d]) => `<span style="font-size:8px;color:#64748b"><strong style="color:#374151">${t}</strong> : ${d}</span>`).join('<span style="color:#cbd5e1">|</span>')}
</div>

<div style="padding:14px 20px;background:#f8fafc">

<!-- TOP 3 SIGNAUX -->
<div style="font-size:9px;font-weight:700;color:#475569;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;display:flex;align-items:center;gap:8px">
  <span style="width:3px;height:14px;background:#f59e0b;border-radius:2px;display:inline-block"></span>
  TOP 3 SIGNAUX — Momentum · Pre-Squeeze · Breakout (Short Squeeze exclu)
</div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
${top3.map(t => {
  const chartEl = candleChart(t.bars, t.color);
  return `
<div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);border:1px solid #e2e8f0">
  <div style="height:4px;background:${t.color}"></div>
  <div style="padding:11px 12px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:7px">
      <div>
        <div style="display:flex;align-items:center;gap:5px;margin-bottom:3px">
          <span style="background:${t.color};color:white;font-weight:800;font-size:9px;padding:2px 7px;border-radius:4px">#${t.rank}</span>
          <span style="font-weight:800;font-size:17px;color:#0f172a">${t.ticker}</span>
          <span style="font-size:9px;color:#64748b;max-width:96px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.name !== t.ticker ? t.name : ''}</span>
        </div>
        <div style="display:flex;gap:4px;align-items:center">
          <span style="background:${t.color}18;color:${t.color};font-size:9px;padding:1px 6px;border-radius:8px;border:1px solid ${t.color}40">${t.strategy}</span>
        </div>
      </div>
      <div style="background:${t.color}18;border:2px solid ${t.color};color:${t.color};font-weight:900;font-size:${String(t.score ?? '').length > 2 ? '15px' : '18px'};min-width:46px;height:38px;padding:0 5px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-variant-numeric:tabular-nums">${t.score ?? 'N/D'}</div>
    </div>
    ${chartEl}
    <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:2px">
      ${[['ENTRY','$'+(t.entry||'—'),'#0f172a'],['STOP','$'+(t.stop||'—'),'#dc2626'],['TP1','$'+(t.tp1||'—'),'#059669'],['TP2','$'+(t.tp2||'—'),'#047857'],['R/R',t.rr||'—','#d97706'],['HOR.',t.horizon_days+'j','#6366f1']].map(([l,v,c]) => `
      <div style="background:#f8fafc;border-radius:4px;padding:4px 2px;text-align:center">
        <div style="color:#94a3b8;font-size:7px;text-transform:uppercase;margin-bottom:1px">${l}</div>
        <div style="color:${c};font-weight:700;font-size:9px;white-space:nowrap">${v}</div>
      </div>`).join('')}
    </div>
  </div>
</div>`;
}).join('')}
</div>

<!-- PORTFOLIO + ROTATION + CAPITAL -->
<div style="display:grid;grid-template-columns:repeat(5,1fr) 1fr 0.85fr;gap:8px;margin-bottom:14px;align-items:start">
${(portfolio || []).map(p => {
  const s = sc(p.signal);
  return `
<div style="background:white;border-radius:10px;padding:10px;box-shadow:0 1px 5px rgba(0,0,0,.06);border:1px solid #e2e8f0;${p.rotate ? 'border:1.5px dashed #fca5a5;opacity:0.72' : ''}">
  <div style="height:3px;background:${p.rotate ? '#ef4444' : s.c};border-radius:2px;margin-bottom:7px"></div>
  <div style="display:flex;justify-content:space-between;margin-bottom:1px">
    <span style="font-weight:800;font-size:14px;color:#0f172a">${p.ticker}${p.rotate ? ' ↩' : ''}</span>
    <span style="background:#f1f5f9;color:#64748b;font-size:8px;font-weight:700;padding:1px 4px;border-radius:3px">${p.score ?? 'LIVE'}</span>
  </div>
  <div style="font-size:8px;color:#94a3b8;margin-bottom:3px">${p.strategy}</div>
  <div style="font-weight:800;font-size:18px;color:${p.rotate ? '#ef4444' : s.c};margin-bottom:3px">${p.return_pct > 0 ? '+' : ''}${p.return_pct}%</div>
  <div style="background:#f1f5f9;border-radius:3px;height:3px;margin-bottom:4px"><div style="background:${s.c};height:100%;width:${Math.min(100, Math.max(0, p.progress_pct || 50))}%;border-radius:3px"></div></div>
  <div style="font-size:8px;color:${p.rotate ? '#ef4444' : '#94a3b8'}">${p.rotate ? '↩ Vente J+1 · 15h30' : 'SL $' + p.stop + ' · TP $' + p.tp1}</div>
</div>`;
}).join('')}

<!-- ROTATION -->
<div style="background:white;border-radius:10px;padding:10px;box-shadow:0 1px 5px rgba(0,0,0,.06);border:1px solid #fde68a">
  <div style="font-size:9px;font-weight:700;color:#d97706;margin-bottom:6px">🔄 Rotation</div>
  ${[['J+1 15h30','Sell ↩','#fef2f2','#ef4444','EXEC'],['J+2','Cash T+1','#f8fafc','#64748b','ATTENTE'],['J+3 15h30','Buy ✅','#f0fdf4','#059669','PRÉVU']].map(([d,a,bg,c,badge]) => `
  <div style="background:${bg};border-radius:5px;padding:3px 6px;margin-bottom:3px;display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:8px;color:#94a3b8;font-weight:600">${d}</span>
    <span style="font-size:8px;font-weight:700;color:${c}">${a}</span>
    <span style="background:${c}22;color:${c};font-size:7px;font-weight:700;padding:1px 4px;border-radius:3px">${badge}</span>
  </div>`).join('')}
</div>

<!-- CAPITAL -->
<div style="background:white;border-radius:10px;padding:10px;box-shadow:0 1px 5px rgba(0,0,0,.06);border:1px solid #e2e8f0">
  <div style="font-size:9px;font-weight:700;color:#475569;margin-bottom:6px">Capital</div>
  ${[['Déployé', metrics.working_capital_pct, '#3b82f6'],['Attente', metrics.pending_orders_pct, '#f59e0b'],['Libre', metrics.available_cash_pct, '#94a3b8']].map(([l,v,c]) => `
  <div style="margin-bottom:5px">
    <div style="display:flex;justify-content:space-between;margin-bottom:2px">
      <span style="font-size:8px;color:#64748b">${l}</span>
      <span style="font-weight:700;font-size:9px;color:${c}">${Number.isFinite(v) ? `${v}%` : 'N/D'}</span>
    </div>
    <div style="background:#f1f5f9;border-radius:3px;height:4px">
      <div style="background:${c};height:100%;width:${Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0}%;border-radius:3px"></div>
    </div>
  </div>`).join('')}
  <div style="background:${metrics.available_cash_pct > 5 ? '#f0fdf4' : '#fef2f2'};border-radius:4px;padding:3px 5px;font-size:7px;color:${metrics.available_cash_pct > 5 ? '#059669' : '#dc2626'};font-weight:600;margin-top:3px;text-align:center">
    ${!Number.isFinite(metrics.available_cash_pct) ? 'Capital indisponible' : metrics.available_cash_pct > 5 ? '✅ Rotation J+1 possible' : '⚠️ 0% libre → Rotation J+3'}
  </div>
</div>
</div>

<!-- STATS DEPUIS D0 -->
<div style="font-size:9px;font-weight:700;color:#475569;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;display:flex;align-items:center;gap:8px">
  <span style="width:3px;height:14px;background:#22c55e;border-radius:2px;display:inline-block"></span>
  SUIVI ${metricsPeriod.toUpperCase()} · ${metrics.total_days ?? 'N/D'} JOURS · ${metrics.scans_count ?? 'N/D'} SCANS · PROXY QUOTIDIEN, EXÉCUTION NON VÉRIFIÉE
</div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1.8fr;gap:8px;margin-bottom:14px">

  <div style="background:white;border-radius:10px;padding:11px 13px;box-shadow:0 1px 5px rgba(0,0,0,.06);border:1px solid #e2e8f0">
    <div style="font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px">Realized P&L (closed)</div>
    <div style="font-weight:900;font-size:28px;color:${metrics.return_realized == null ? '#64748b' : metrics.return_realized >= 0 ? '#059669' : '#dc2626'};line-height:1.1">${metrics.return_realized == null ? 'N/D' : `${metrics.return_realized > 0 ? '+' : ''}${metrics.return_realized}%`}</div>
    <div style="font-size:8px;color:#64748b;margin-bottom:2px">Unrealized (open MtM): <strong style="color:${metrics.return_unrealized == null ? '#64748b' : metrics.return_unrealized >= 0 ? '#059669' : '#dc2626'}">${metrics.return_unrealized == null ? 'N/D' : `${metrics.return_unrealized > 0 ? '+' : ''}${metrics.return_unrealized}%`}</strong></div>
    ${spark(equityHist, (metrics.return_total ?? 0) >= 0 ? '#059669' : '#dc2626', 190, 22)}
    <div style="font-size:7px;color:#94a3b8;margin-top:2px">${equityHist.length} observations ordonnées par idée</div>
  </div>

  <div style="background:white;border-radius:10px;padding:11px 13px;box-shadow:0 1px 5px rgba(0,0,0,.06);border:1px solid #e2e8f0">
    <div style="font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px">Max Drawdown</div>
    <div style="font-weight:900;font-size:28px;color:#ef4444;line-height:1.1">${metrics.max_drawdown != null ? `${metrics.max_drawdown}%` : 'N/D'}</div>
    <div style="font-size:8px;color:#64748b;margin-bottom:4px">Ratio R/DD : <strong>${metrics.return_dd_ratio != null ? `${metrics.return_dd_ratio}×` : 'N/D'}</strong></div>
    ${spark(ddHist, '#ef4444', 190, 28)}
  </div>

  <div style="background:white;border-radius:10px;padding:11px 13px;box-shadow:0 1px 5px rgba(0,0,0,.06);border:1px solid #e2e8f0">
    <div style="font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px">Win Rate</div>
    <div style="font-weight:900;font-size:28px;color:#0f172a;line-height:1.1">${metrics.win_rate != null ? `${metrics.win_rate}%` : 'N/D'}</div>
    <div style="font-size:8px;color:#94a3b8;margin-bottom:6px">${metrics.trades_closed ?? 'N/D'} trades résolus</div>
    <div style="display:flex;gap:3px;flex-wrap:wrap">
      <span style="background:#ecfdf5;color:#059669;font-size:7px;font-weight:700;padding:2px 5px;border-radius:4px">✅ ${metrics.tp1_count ?? 'N/D'} TP1</span>
      <span style="background:#ecfdf5;color:#047857;font-size:7px;font-weight:700;padding:2px 5px;border-radius:4px">🎯 ${metrics.tp2_count ?? 'N/D'} TP2</span>
      <span style="background:#fef2f2;color:#dc2626;font-size:7px;font-weight:700;padding:2px 5px;border-radius:4px">❌ ${metrics.sl_count ?? 'N/D'} SL</span>
    </div>
  </div>

  <div style="background:white;border-radius:10px;padding:11px 13px;box-shadow:0 1px 5px rgba(0,0,0,.06);border:1px solid #e2e8f0">
    <div style="font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px">Profit Factor</div>
    <div style="font-weight:900;font-size:28px;color:#0f172a;line-height:1.1">${metrics.profit_factor != null ? `${metrics.profit_factor}×` : 'N/D'}</div>
    <div style="font-size:8px;color:#94a3b8;margin-bottom:6px">Gains / Pertes</div>
    <div style="font-size:8px;color:#64748b">Win moy : <strong style="color:#059669">${metrics.avg_win_pct != null ? `+${metrics.avg_win_pct}%` : 'N/D'}</strong></div>
    <div style="font-size:8px;color:#64748b">Loss moy : <strong style="color:#ef4444">${metrics.avg_loss_pct != null ? `${metrics.avg_loss_pct}%` : 'N/D'}</strong></div>
  </div>

  <!-- Equity curve large -->
  <div style="background:white;border-radius:10px;padding:11px 13px;box-shadow:0 1px 5px rgba(0,0,0,.06);border:1px solid #e2e8f0">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
      <span style="font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px">Trajectoire cumulée par idée</span>
      <span style="font-size:9px;font-weight:700;color:${metrics.return_total == null ? '#64748b' : metrics.return_total >= 0 ? '#059669' : '#dc2626'}">${metrics.return_total == null ? 'Base 100 → N/D' : `Base 100 → ${(100 + metrics.return_total).toFixed(1)}`} <span style="color:#94a3b8;font-weight:500">${metrics.return_realized == null ? '(réalisé N/D)' : `(réalisé ${metrics.return_realized > 0 ? '+' : ''}${metrics.return_realized}%)`}</span></span>
    </div>
    ${spark(equityHist.map(v => 100 + v), (metrics.return_total ?? 0) >= 0 ? '#059669' : '#dc2626', 370, 50)}
    <div style="display:flex;justify-content:space-between;margin-top:3px;font-size:7px;color:#cbd5e1">
      <span>Départ</span><span>${Math.floor(equityHist.length / 3)} obs.</span><span>${Math.floor(equityHist.length * 2 / 3)} obs.</span><span>${equityHist.length} obs.</span>
    </div>
  </div>
</div>

<!-- POSITIONS OUVERTES -->
<div style="font-size:9px;font-weight:700;color:#475569;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;display:flex;align-items:center;gap:8px">
  <span style="width:3px;height:14px;background:#3b82f6;border-radius:2px;display:inline-block"></span>
  POSITIONS OUVERTES (${openPos.length}) — Short Squeeze exclus · Triées par symbole
</div>
<div style="background:white;border-radius:10px;padding:10px 12px;box-shadow:0 1px 5px rgba(0,0,0,.06);border:1px solid #e2e8f0;margin-bottom:12px">
${posGrid.map(row => `
<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin-bottom:4px">
  ${row.map(p => {
    const s = sc(p.signal);
    const dateShort = p.scan_date ? p.scan_date.slice(5) : '';
    return `<div style="background:${s.bg};border:1px solid ${s.bdr};border-radius:6px;padding:4px 6px;text-align:center">
      <div style="display:flex;gap:4px;align-items:center;justify-content:center">
        <span style="font-weight:700;font-size:11px;color:#0f172a">${p.ticker}</span>
        <span style="font-weight:700;font-size:10px;color:${s.c}">${p.return_pct > 0 ? '+' : ''}${p.return_pct}%</span>
      </div>
      ${dateShort ? `<div style="font-size:7px;color:#94a3b8;margin-top:1px">${dateShort}</div>` : ''}
    </div>`;
  }).join('')}
  ${row.length < 5 ? Array(5 - row.length).fill('<div></div>').join('') : ''}
</div>`).join('')}
</div>

<!-- FOOTER -->
<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 2px;border-top:1px solid #e2e8f0">
  <div style="font-size:7px;color:#94a3b8;line-height:1.6">
    <strong style="color:#475569">⚠️ Pas un conseil financier.</strong> Usage éducatif. Return = MtM réalisé + positions ouvertes depuis D0.
    Charts: barres Marketdata certifiées · Suivi: proxy daily non vérifié en 15 min · Modèle: Top 5 · Rotation max 2/j · Sans SQ
  </div>
  <div style="text-align:right;flex-shrink:0;margin-left:10px">
    <div style="font-size:9px;font-weight:700;color:#374151">articles.dailytickers.com/scanner/${scanDir}/</div>
    <div style="font-size:7px;color:#94a3b8">© 2026 DailyTickers™ · All rights reserved</div>
  </div>
</div>

</div>
</div>
</body></html>`;
}

// ─── Generate PNG with Puppeteer ─────────────────────────────────────────────

async function generatePNG(html, outputPath) {
  const puppeteer = require('puppeteer');
  // Use arm64-compatible chromium from playwright if available (Hetzner aarch64 CI)
  const fs = require('fs');
  const { execSync } = require('child_process');

  // Chrome for Testing 146 on macOS can hang in Page.captureScreenshot.
  // Use the installed Playwright browser locally; CI keeps the Puppeteer path below.
  if (process.platform === 'darwin') {
    const { execFileSync } = require('child_process');
    const os = require('os');
    const tmp = path.join(os.tmpdir(), `scanner-card-${process.pid}-${Date.now()}.html`);
    try {
      fs.writeFileSync(tmp, html);
      execFileSync('playwright', [
        'screenshot', '--browser', 'chromium', '--viewport-size', '1080,800',
        '--full-page', '--wait-for-timeout', '1000', '--timeout', '60000',
        `file://${tmp}`, outputPath,
      ], { stdio: 'pipe', timeout: 65000 });
      console.log(`✅ PNG generated: ${outputPath}`);
      return;
    } finally {
      try { fs.unlinkSync(tmp); } catch (_) {}
    }
  }
  let executablePath;
  const playwrightBase = '/home/ci/.cache/ms-playwright';
  if (fs.existsSync(playwrightBase)) {
    try {
      const dirs = fs.readdirSync(playwrightBase).filter(d => d.startsWith('chromium-')).sort().reverse();
      for (const dir of dirs) {
        const candidate = `${playwrightBase}/${dir}/chrome-linux/chrome`;
        if (fs.existsSync(candidate)) { executablePath = candidate; break; }
      }
    } catch (e) { /* fallback to default */ }
  }
  const browser = await puppeteer.launch({
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1200, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  // Wait for images to load
  await new Promise(r => setTimeout(r, 2000));
  const clip = await page.evaluate(() => {
    const el = document.body.firstElementChild;
    const rect = el.getBoundingClientRect();
    return { x: 0, y: 0, width: 1080, height: Math.ceil(rect.height) };
  });
  await page.screenshot({
    path: outputPath,
    clip,
    type: 'png',
  });
  await browser.close();
  console.log(`✅ PNG generated: ${outputPath} (${clip.height}px)`);
}

// ─── Publish to Telegram ─────────────────────────────────────────────────────

async function publishTelegram(imagePath, caption) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('❌ TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set in .env');
    return false;
  }

  const FormData = require('form-data');
  const form = new FormData();
  form.append('chat_id', TELEGRAM_CHAT_ID);
  form.append('caption', caption);
  form.append('parse_mode', 'Markdown');
  form.append('photo', fs.createReadStream(imagePath));

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
      method: 'POST',
      headers: form.getHeaders(),
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const json = JSON.parse(data);
        if (json.ok) {
          console.log('✅ Published to Telegram');
          resolve(true);
        } else {
          console.error('❌ Telegram error:', json.description);
          resolve(false);
        }
      });
    });
    req.on('error', e => { console.error('❌ Telegram request error:', e.message); resolve(false); });
    form.pipe(req);
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Determine scan dir
  const argDate = process.argv.find(a => /^\d{8}/.test(a));
  let scanDir;
  if (argDate) {
    scanDir = argDate;
  } else {
    // Find latest scan — skip empty placeholder dirs (no index.html or < 5KB)
    const dirs = fs.readdirSync(SCANNER_DIR)
      .filter(d => /^\d{8}(-\d+)?$/.test(d))
      .sort()
      .reverse();
    for (const d of dirs) {
      const p = path.join(SCANNER_DIR, d, 'index.html');
      try {
        const st = fs.statSync(p);
        if (st.size > 5000) { scanDir = d; break; }
      } catch (_) { }
    }
    scanDir = scanDir || dirs[0];
  }

  if (!scanDir) { console.error('No scan dir found'); process.exit(1); }
  console.log(`Using scan: ${scanDir}`);

  // Load metrics and positions
  let metrics = {}, positions = [], portfolio = [];
  try {
    metrics = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'scanner-metrics.json')));
  } catch (_) { console.warn('⚠️ scanner-metrics.json not found, using defaults'); }

  try {
    const posData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'scanner-positions.json')));
    positions = posData.open_positions || [];
    // Top 5 portfolio (highest return first)
    portfolio = [...positions]
      .sort((a, b) => b.return_pct - a.return_pct)
      .slice(0, 5)
      .map((p, i) => ({
        ...p,
        rotate: i === 4 && p.return_pct < 2, // Lowest performer candidate for rotation
      }));
  } catch (_) { console.warn('⚠️ scanner-positions.json not found'); }

  // Extract top3 from HTML
  const top3raw = extractTop3(scanDir);
  const regime = extractRegime(scanDir);

  // Build charts from the close-bounded Marketdata artifacts collected for this scan.
  console.log('Building certified local charts...');
  const top3 = top3raw.map((t, i) => {
    const colors = ['#059669', '#2563eb', '#7c3aed'];
    return {
      ...t,
      rank: i + 1,
      color: colors[i],
      horizon_days: t.horizon_days || '10–20',
      bars: loadLocalBars(scanDir, t.ticker, t.completed_end),
    };
  });

  // Yesterday top3 (previous scan)
  const allScanDirs = fs.readdirSync(SCANNER_DIR)
    .filter(d => /^\d{8}(-\d+)?$/.test(d)).sort().reverse();
  const prevDir = allScanDirs[1];
  const yesterday = prevDir ? extractTop3(prevDir).slice(0, 3).map(t => ({
    ticker: t.ticker,
  })) : [];

  // Generate HTML
  const html = generateHTML({ top3, metrics, positions, portfolio, regime, scanDir, yesterday })
    .replace(/[ \t]+$/gm, '');

  // Save HTML for debugging
  const htmlPath = path.join(ROOT, 'scanner-daily-card.html');
  fs.writeFileSync(htmlPath, html);
  console.log(`✅ HTML saved: ${htmlPath}`);

  // Generate PNG
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const pngPath = path.join(ROOT, `scanner-daily-${today}.png`);

  if (!DRY_RUN) {
    await generatePNG(html, pngPath);

    // Also save to scanner/status/ with timestamp for cache busting
    const statusDir = path.join(SCANNER_DIR, 'status');
    const ts = Date.now();

    // Clean old daily-card-*.png files
    try {
      fs.readdirSync(statusDir)
        .filter(f => /^daily-card-\d+\.png$/.test(f))
        .forEach(f => fs.unlinkSync(path.join(statusDir, f)));
    } catch (_) {}

    const dailyCardFilename = `daily-card-${ts}.png`;
    const dailyCardPath = path.join(statusDir, dailyCardFilename);
    fs.copyFileSync(pngPath, dailyCardPath);
    console.log(`✅ Daily card copied to: ${dailyCardPath}`);

    // Cible Open Graph canonique : render-scanner.js pointe TOUTES les pages scanner sur
    // /scanner-daily-card.png (meta og:image + twitter:image). Aucun outil n'écrivait ce
    // fichier — il n'était mis à jour que par les copies datées, donc l'aperçu partagé sur
    // Telegram/WhatsApp restait figé sur une carte périmée. On l'écrase à chaque génération.
    const ogCardPath = path.join(ROOT, 'scanner-daily-card.png');
    fs.copyFileSync(pngPath, ogCardPath);
    console.log(`✅ Open Graph card updated: ${ogCardPath}`);

    // Update manifest.json with daily-card entry
    const manifestPath = path.join(statusDir, 'manifest.json');
    let manifest = {};
    try { manifest = JSON.parse(fs.readFileSync(manifestPath)); } catch (_) {}
    manifest['daily-card'] = dailyCardFilename;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`✅ Manifest updated with daily-card`);
  } else {
    console.log('Dry run — skipping PNG generation');
  }

  // Publish to Telegram
  if (PUBLISH_TELEGRAM && !DRY_RUN && fs.existsSync(pngPath)) {
    const scanUrl = `https://articles.dailytickers.com/scanner/${scanDir}/`;
    const caption = `📡 *Scanner DailyTickers* — ${new Date().toLocaleDateString('fr-FR')}
Régime : *${regime.label}* | Top 5 + Rotation | Sans Short Squeeze

🔗 [Voir l'analyse complète](${scanUrl})
_articles.dailytickers.com_`;
    await publishTelegram(pngPath, caption);
  }

  console.log('\n✅ Done.');
}

main().then(() => process.exit(0)).catch(e => { console.error('Fatal:', e.message); process.exit(1); });
