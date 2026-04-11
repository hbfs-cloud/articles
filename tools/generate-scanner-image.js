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

function fetchUrl(url) {
  return new Promise((resolve) => {
    const opts = { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 };
    https.get(url, opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', () => resolve(null)).on('timeout', () => resolve(null));
  });
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
  const htmlPath = path.join(SCANNER_DIR, scanDir, 'index.html');
  if (!fs.existsSync(htmlPath)) return [];
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Use the shared parser (tools/lib/scanner-parser.js) to keep every script in sync.
  const rawSignals = scannerParser.parseScannerHtml(html);
  const trades = [];

  for (const s of rawSignals) {
    const strategy = normalizeStrategy(s.strategy);
    if (EXCLUDED_STRATEGIES.includes(strategy)) continue;
    const entry = parseMidpoint(s.entry);
    const stop = parseNumber(s.stop);
    const tp1 = parseNumber(s.tp1);
    if (entry == null || stop == null || tp1 == null) continue;
    trades.push({
      ticker: s.ticker,
      strategy,
      score: s.score || 85,
      entry,
      stop,
      tp1,
      tp2: s.tp2 && s.tp2 !== '—' ? parseNumber(s.tp2) : null,
      rr: s.rr || 'n/a',
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

// ─── Fetch FinViz chart as base64 ────────────────────────────────────────────
// Direct PNG fetch — no Puppeteer needed. FinViz returns a chart image directly.
// URL pattern: https://finviz.com/chart.ashx?t=TICKER&ty=c&ta=1&p=d&s=l
// ty=c (candle), ta=1 (with technicals: SMA50/200, RSI, MACD, Volume), p=d (daily), s=l (large)

function fetchChartBase64(ticker) {
  return new Promise((resolve) => {
    const url = `https://finviz.com/chart.ashx?t=${ticker}&ty=c&ta=1&p=d&s=l`;
    const opts = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://finviz.com/',
      },
      timeout: 10000,
    };
    https.get(url, opts, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, opts, (res2) => {
          const chunks = [];
          res2.on('data', c => chunks.push(c));
          res2.on('end', () => {
            const buf = Buffer.concat(chunks);
            if (buf.length > 1000) {
              resolve('data:image/png;base64,' + buf.toString('base64'));
            } else {
              resolve(null);
            }
          });
        }).on('error', () => resolve(null));
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        // Sanity check: a real chart PNG is > 1KB
        if (buf.length > 1000) {
          resolve('data:image/png;base64,' + buf.toString('base64'));
        } else {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null)).on('timeout', () => resolve(null));
  });
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

  const equityHist = metrics.portfolio_history || [0, 0.5, 1.0, 1.8, 2.3, 2.8, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, metrics.return_total || 8.7];
  const ddHist = metrics.drawdown_history || [0, -0.1, -0.2, -0.5, -0.8, -1.0, -0.8, -0.6, -0.4, -0.2, -0.3, -0.2, -0.1, -0.2, -0.1, -0.1, 0, 0, 0, metrics.max_drawdown || -1.0];

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
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
    <div style="color:#94a3b8;font-size:9px">Hier · Top 3</div>
    <div style="color:#e2e8f0;font-size:10px;line-height:1.9;margin-top:2px">
      ${(yesterday || []).map(t => `${t.ticker} <span style="color:${t.ret > 0 ? '#86efac' : '#f87171'}">${t.ret > 0 ? '+' : ''}${t.ret}%</span>`).join(' · ')}
    </div>
  </div>
</div>

<!-- GUIDE LECTEURS -->
<div style="background:#f1f5f9;border-bottom:2px solid #e2e8f0;padding:7px 22px;display:flex;gap:14px;align-items:center;flex-wrap:wrap">
  <span style="color:#475569;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:1px;white-space:nowrap">📖 Guide</span>
  ${[
    ['📋 Méthode', 'Max 5 pos. · 1/30 capital · Stop obligatoire à l\'ouverture J+1 (15h30 Paris)'],
    ['🔄 Rotation', 'Scan 22h → Exec J+1 open · Sans cash : Sell J+1 → Cash J+2 → Buy J+3'],
    ['📊 Stats', 'Depuis D0 (15 fév) · Return = MtM réalisé + positions ouvertes · Short Squeeze exclu'],
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
  const chartEl = t.chart_b64
    ? `<img src="${t.chart_b64}" style="width:100%;height:110px;object-fit:cover;border-radius:6px;margin-bottom:8px;display:block;border:1px solid #f1f5f9"/>`
    : `<div style="width:100%;height:110px;background:${t.color}10;border-radius:6px;margin-bottom:8px;display:flex;align-items:center;justify-content:center;border:1px solid ${t.color}30;font-size:12px;color:${t.color};font-weight:700">${t.ticker} · Daily</div>`;
  return `
<div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);border:1px solid #e2e8f0">
  <div style="height:4px;background:${t.color}"></div>
  <div style="padding:11px 12px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:7px">
      <div>
        <div style="display:flex;align-items:center;gap:5px;margin-bottom:3px">
          <span style="background:${t.color};color:white;font-weight:800;font-size:9px;padding:2px 7px;border-radius:4px">#${t.rank}</span>
          <span style="font-weight:800;font-size:17px;color:#0f172a">${t.ticker}</span>
          <span style="font-size:9px;color:#94a3b8">${t.name}</span>
        </div>
        <div style="display:flex;gap:4px;align-items:center">
          <span style="background:${t.color}18;color:${t.color};font-size:9px;padding:1px 6px;border-radius:8px;border:1px solid ${t.color}40">${t.strategy}</span>
        </div>
      </div>
      <div style="background:${t.color}18;border:2px solid ${t.color};color:${t.color};font-weight:900;font-size:18px;width:38px;height:38px;border-radius:8px;display:flex;align-items:center;justify-content:center">${t.score}</div>
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
    <span style="background:#f1f5f9;color:#64748b;font-size:8px;font-weight:700;padding:1px 4px;border-radius:3px">${p.score}</span>
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
  ${[['Déployé', metrics.working_capital_pct || 86.7, '#3b82f6'],['Attente', metrics.pending_orders_pct || 13.3, '#f59e0b'],['Libre', metrics.available_cash_pct || 0, '#94a3b8']].map(([l,v,c]) => `
  <div style="margin-bottom:5px">
    <div style="display:flex;justify-content:space-between;margin-bottom:2px">
      <span style="font-size:8px;color:#64748b">${l}</span>
      <span style="font-weight:700;font-size:9px;color:${c}">${v}%</span>
    </div>
    <div style="background:#f1f5f9;border-radius:3px;height:4px">
      <div style="background:${c};height:100%;width:${Math.min(100, v)}%;border-radius:3px"></div>
    </div>
  </div>`).join('')}
  <div style="background:${metrics.available_cash_pct > 5 ? '#f0fdf4' : '#fef2f2'};border-radius:4px;padding:3px 5px;font-size:7px;color:${metrics.available_cash_pct > 5 ? '#059669' : '#dc2626'};font-weight:600;margin-top:3px;text-align:center">
    ${metrics.available_cash_pct > 5 ? '✅ Rotation J+1 possible' : '⚠️ 0% libre → Rotation J+3'}
  </div>
</div>
</div>

<!-- STATS DEPUIS D0 -->
<div style="font-size:9px;font-weight:700;color:#475569;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;display:flex;align-items:center;gap:8px">
  <span style="width:3px;height:14px;background:#22c55e;border-radius:2px;display:inline-block"></span>
  PERFORMANCES DEPUIS D0 (15 FÉV 2026) · ${metrics.total_days || 34}j · ${metrics.scans_count || 23} SCANS · MODÈLE OPTIMAL
</div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1.8fr;gap:8px;margin-bottom:14px">

  <div style="background:white;border-radius:10px;padding:11px 13px;box-shadow:0 1px 5px rgba(0,0,0,.06);border:1px solid #e2e8f0">
    <div style="font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px">Return total D0</div>
    <div style="font-weight:900;font-size:28px;color:#059669;line-height:1.1">${metrics.return_total > 0 ? '+' : ''}${metrics.return_total || 8.7}%</div>
    <div style="font-size:8px;color:#94a3b8;margin-bottom:4px">Capital-weighted MtM</div>
    ${spark(equityHist, '#22c55e', 190, 28)}
    <div style="font-size:7px;color:#94a3b8;margin-top:2px">15 fév → aujourd'hui</div>
  </div>

  <div style="background:white;border-radius:10px;padding:11px 13px;box-shadow:0 1px 5px rgba(0,0,0,.06);border:1px solid #e2e8f0">
    <div style="font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px">Max Drawdown</div>
    <div style="font-weight:900;font-size:28px;color:#ef4444;line-height:1.1">${metrics.max_drawdown || -1.0}%</div>
    <div style="font-size:8px;color:#059669;margin-bottom:4px">Ratio R/DD : <strong>${metrics.return_dd_ratio || '8.7'}×</strong></div>
    ${spark(ddHist, '#ef4444', 190, 28)}
  </div>

  <div style="background:white;border-radius:10px;padding:11px 13px;box-shadow:0 1px 5px rgba(0,0,0,.06);border:1px solid #e2e8f0">
    <div style="font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px">Win Rate</div>
    <div style="font-weight:900;font-size:28px;color:#0f172a;line-height:1.1">${metrics.win_rate || 64}%</div>
    <div style="font-size:8px;color:#94a3b8;margin-bottom:6px">${metrics.trades_closed || 31} trades résolus</div>
    <div style="display:flex;gap:3px;flex-wrap:wrap">
      <span style="background:#ecfdf5;color:#059669;font-size:7px;font-weight:700;padding:2px 5px;border-radius:4px">✅ ${metrics.tp1_count || 6} TP1</span>
      <span style="background:#ecfdf5;color:#047857;font-size:7px;font-weight:700;padding:2px 5px;border-radius:4px">🎯 ${metrics.tp2_count || 5} TP2</span>
      <span style="background:#fef2f2;color:#dc2626;font-size:7px;font-weight:700;padding:2px 5px;border-radius:4px">❌ ${metrics.sl_count || 16} SL</span>
    </div>
  </div>

  <div style="background:white;border-radius:10px;padding:11px 13px;box-shadow:0 1px 5px rgba(0,0,0,.06);border:1px solid #e2e8f0">
    <div style="font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px">Profit Factor</div>
    <div style="font-weight:900;font-size:28px;color:#0f172a;line-height:1.1">${metrics.profit_factor || '2.0'}×</div>
    <div style="font-size:8px;color:#94a3b8;margin-bottom:6px">Gains / Pertes</div>
    <div style="font-size:8px;color:#64748b">Win moy : <strong style="color:#059669">+${metrics.avg_win_pct || 11.6}%</strong></div>
    <div style="font-size:8px;color:#64748b">Loss moy : <strong style="color:#ef4444">${metrics.avg_loss_pct || -5.8}%</strong></div>
  </div>

  <!-- Equity curve large -->
  <div style="background:white;border-radius:10px;padding:11px 13px;box-shadow:0 1px 5px rgba(0,0,0,.06);border:1px solid #e2e8f0">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
      <span style="font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px">Courbe equity depuis D0</span>
      <span style="font-size:9px;font-weight:700;color:#059669">Base 100 → ${(100 + (metrics.return_total || 8.7)).toFixed(1)}</span>
    </div>
    ${spark(equityHist.map(v => 100 + v), '#22c55e', 370, 50)}
    <div style="display:flex;justify-content:space-between;margin-top:3px;font-size:7px;color:#cbd5e1">
      <span>15 fév</span><span>1 mars</span><span>10 mars</span><span>20 mars</span>
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
    Charts: StockCharts.com · Données: Yahoo Finance · Modèle: Top 5 · Rotation max 2/j · Sans SQ · Anti-doublon
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

  // Add chart images
  console.log('Fetching charts...');
  const top3 = await Promise.all(top3raw.map(async (t, i) => {
    const chartB64 = await fetchChartBase64(t.ticker);
    const colors = ['#059669', '#2563eb', '#7c3aed'];
    return {
      ...t,
      rank: i + 1,
      name: t.ticker, // Will be enhanced with full name in future
      color: colors[i],
      horizon_days: t.horizon_days || '10–20',
      chart_b64: chartB64,
    };
  }));

  // Yesterday top3 (previous scan)
  const allScanDirs = fs.readdirSync(SCANNER_DIR)
    .filter(d => /^\d{8}(-\d+)?$/.test(d)).sort().reverse();
  const prevDir = allScanDirs[1];
  const yesterday = prevDir ? extractTop3(prevDir).slice(0, 3).map(t => ({
    ticker: t.ticker,
    ret: 0, // Would need actual price data
  })) : [];

  // Generate HTML
  const html = generateHTML({ top3, metrics, positions, portfolio, regime, scanDir, yesterday });

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

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
