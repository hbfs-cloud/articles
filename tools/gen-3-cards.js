#!/usr/bin/env node
/**
 * gen-3-cards.js — Generates 3 mode-card PNG images for scanner/status/.
 *
 * Self-contained: builds HTML from backtest-trades.json + modes-config.json.
 * Does NOT use generate-scanner-image.js or scanner-metrics.json.
 *
 * Usage: node tools/gen-3-cards.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MODES_CFG = path.join(ROOT, 'data/modes-config.json');
const TRADES = path.join(ROOT, 'data/backtest-trades.json');
const STATUS = path.join(ROOT, 'scanner/status');

// ─── Compute metrics ────────────────────────────────────────────────────────
function computeMetrics(trades, portfolioSize) {
  const wins = trades.filter(t => t.pnlPct > 0);
  const losses = trades.filter(t => t.pnlPct <= 0);
  const totalReturn = trades.reduce((s, t) => s + (t.pnlPct || 0) / portfolioSize, 0);

  let equity = 0, peak = 0, maxDD = 0;
  const curve = [0];
  for (const t of trades) {
    equity += (t.pnlPct || 0) / portfolioSize;
    if (equity > peak) peak = equity;
    if (peak - equity > maxDD) maxDD = peak - equity;
    curve.push(+equity.toFixed(2));
  }

  const grossWin = wins.reduce((s, t) => s + t.pnlPct, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));
  const pf = grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : (grossWin > 0 ? '99' : '0');
  const wr = trades.length ? ((wins.length / trades.length) * 100).toFixed(1) : '0';
  const avgWin = wins.length ? (grossWin / wins.length).toFixed(2) : '0';
  const avgLoss = losses.length ? (losses.reduce((s, t) => s + t.pnlPct, 0) / losses.length).toFixed(2) : '0';
  const holdDays = trades.filter(t => t.holdDays).map(t => t.holdDays);
  const avgHold = holdDays.length ? (holdDays.reduce((a, b) => a + b, 0) / holdDays.length).toFixed(1) : '0';

  return {
    ret: +totalReturn.toFixed(2),
    dd: +(-maxDD).toFixed(2),
    wr: +wr, pf, trades: trades.length,
    avgWin: +avgWin, avgLoss: +avgLoss, avgHold: +avgHold,
    tp1: trades.filter(t => t.status === 'tp1').length,
    tp2: trades.filter(t => t.status === 'tp2').length,
    sl: trades.filter(t => t.status === 'sl').length,
    expired: trades.filter(t => t.status === 'expired').length,
    rotated: trades.filter(t => t.status === 'rotated').length,
    tp1_partial: trades.filter(t => t.status === 'tp1_partial').length,
    curve
  };
}

// ─── SVG sparkline ──────────────────────────────────────────────────────────
function sparkSVG(values, color, w, h) {
  if (!values.length) return '';
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const fill = pts + ` ${w},${h} 0,${h}`;
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:${h}px">
    <polygon points="${fill}" fill="${color}" fill-opacity="0.15"/>
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2"/>
  </svg>`;
}

// ─── Build card HTML ────────────────────────────────────────────────────────
function buildCardHTML(id, cfg, trades, m) {
  const desc = [`P${cfg.portfolioSize}`, `Top${cfg.topN}`, `H${cfg.horizon}j`, cfg.filterName, cfg.rotation,
    cfg.partialTP ? 'PTP' : null, cfg.trailingStop ? 'Trail' : null].filter(Boolean).join(' / ');

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Status breakdown
  const statuses = [
    m.tp1 > 0 ? `TP1: ${m.tp1}` : null,
    m.tp2 > 0 ? `TP2: ${m.tp2}` : null,
    m.tp1_partial > 0 ? `TP1½: ${m.tp1_partial}` : null,
    m.sl > 0 ? `SL: ${m.sl}` : null,
    m.expired > 0 ? `Exp: ${m.expired}` : null,
    m.rotated > 0 ? `Rot: ${m.rotated}` : null,
  ].filter(Boolean).join(' · ');

  // Trade table
  const seen = {};
  const tradeRows = trades.slice(0, 30).map((t, i) => {
    const bg = i % 2 === 0 ? '#f8fafc' : '#ffffff';
    const pnlColor = t.pnlPct > 0 ? '#059669' : t.pnlPct < 0 ? '#dc2626' : '#64748b';
    const statusIcon = { tp1: '✅', tp2: '🎯', sl: '❌', expired: '⏳', rotated: '🔄', tp1_partial: '✅½' }[t.status] || '—';
    seen[t.ticker] = (seen[t.ticker] || 0) + 1;
    const reentry = seen[t.ticker] > 1 ? ` <span style="font-size:8px;color:#f59e0b;font-weight:600">🔁${seen[t.ticker]}e</span>` : '';
    const dateShort = t.scanDate ? t.scanDate.slice(5) : '—';
    return `<tr style="background:${bg}">
      <td style="padding:5px 8px;font-size:10px;color:#94a3b8;text-align:center">${i + 1}</td>
      <td style="padding:5px 8px;font-weight:700;font-size:11px;color:#0f172a">${t.ticker}${reentry}</td>
      <td style="padding:5px 8px;font-size:10px;color:#64748b">${dateShort}</td>
      <td style="padding:5px 8px;font-size:10px;color:#64748b">${t.strategy || '—'}</td>
      <td style="padding:5px 8px;font-size:10px;color:#0f172a;font-weight:600">$${(t.actualEntry || 0).toFixed(2)}</td>
      <td style="padding:5px 8px;font-size:10px;color:#0f172a;font-weight:600">$${(t.exitPrice || 0).toFixed(2)}</td>
      <td style="padding:5px 8px;font-weight:800;font-size:11px;color:${pnlColor}">${t.pnlPct > 0 ? '+' : ''}${t.pnlPct}%</td>
      <td style="padding:5px 8px;font-size:10px;color:#64748b;text-align:center">${t.holdDays || 0}j</td>
      <td style="padding:5px 8px;font-size:10px;text-align:center">${statusIcon}</td>
    </tr>`;
  }).join('');

  // KPI tile
  const kpi = (val, label, color) => `<div style="background:white;border-radius:10px;padding:11px 8px;box-shadow:0 1px 5px rgba(0,0,0,.06);border:1px solid #e2e8f0;text-align:center">
    <div style="font-weight:900;font-size:22px;color:${color};line-height:1.1">${val}</div>
    <div style="font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-top:3px">${label}</div>
  </div>`;

  // Equity curve values for sparkline (base 100)
  const equityBase100 = m.curve.map(v => 100 + v);

  return `<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Inter,-apple-system,sans-serif;background:#f0f4f8;width:1080px}
</style>
</head><body>
<div style="max-width:1080px;padding:20px;background:#f0f4f8">

<!-- HEADER -->
<div style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:14px;padding:18px 22px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center">
  <div style="display:flex;align-items:center;gap:12px">
    <div style="width:36px;height:36px;background:#059669;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;color:white">MW</div>
    <div>
      <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:2px">Market Watch · Scanner Strategy</div>
      <div style="font-size:10px;color:#64748b;margin-top:2px">${today}</div>
    </div>
  </div>
  <div style="text-align:right">
    <div style="font-size:9px;color:#94a3b8">Backtests: ${m.trades} trades · ${statuses}</div>
  </div>
</div>

<!-- MODE BADGE -->
<div style="background:${cfg.color};padding:14px 22px;border-radius:12px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between">
  <div>
    <div style="font-weight:900;font-size:22px;color:white;letter-spacing:1px">${cfg.label.toUpperCase()}</div>
    <div style="font-size:13px;color:rgba(255,255,255,.85);margin-top:2px">${desc}</div>
  </div>
  <div style="text-align:right">
    <div style="font-weight:900;font-size:32px;color:white">${m.ret > 0 ? '+' : ''}${m.ret}%</div>
    <div style="font-size:11px;color:rgba(255,255,255,.7)">Return total</div>
  </div>
</div>

<!-- KPI GRID -->
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">
  ${kpi(`${m.ret > 0 ? '+' : ''}${m.ret}%`, 'Return', '#059669')}
  ${kpi(`${m.dd}%`, 'Max DD', '#dc2626')}
  ${kpi(m.wr + '%', 'Win Rate', '#7c3aed')}
  ${kpi(m.pf + 'x', 'Profit Factor', '#2563eb')}
</div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">
  ${kpi(m.trades, 'Trades', '#0891b2')}
  ${kpi(m.avgHold + 'j', 'Hold Moy.', '#f59e0b')}
  ${kpi(`+${m.avgWin}%`, 'Win Moy.', '#059669')}
  ${kpi(`${m.avgLoss}%`, 'Loss Moy.', '#dc2626')}
</div>

<!-- EQUITY CURVE -->
<div style="background:white;border-radius:10px;padding:12px 14px;box-shadow:0 1px 5px rgba(0,0,0,.06);border:1px solid #e2e8f0;margin-bottom:14px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
    <span style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">Equity Curve (base 100)</span>
    <span style="font-size:10px;font-weight:700;color:${m.ret >= 0 ? '#059669' : '#dc2626'}">100 → ${(100 + m.ret).toFixed(1)}</span>
  </div>
  ${sparkSVG(equityBase100, cfg.color, 1000, 80)}
</div>

<!-- TRADE TABLE -->
<div style="font-size:9px;font-weight:700;color:#475569;letter-spacing:2px;text-transform:uppercase;margin:14px 0 8px;display:flex;align-items:center;gap:8px">
  <span style="width:3px;height:14px;background:${cfg.color};border-radius:2px;display:inline-block"></span>
  HISTORIQUE DES TRADES (${trades.length})
</div>
<div style="background:white;border-radius:10px;overflow:hidden;box-shadow:0 1px 5px rgba(0,0,0,.06);border:1px solid #e2e8f0">
<table style="width:100%;border-collapse:collapse">
<thead><tr style="background:#0f172a">
  <th style="padding:6px 8px;font-size:8px;color:#94a3b8;text-transform:uppercase;text-align:center">#</th>
  <th style="padding:6px 8px;font-size:8px;color:#94a3b8;text-transform:uppercase;text-align:left">Ticker</th>
  <th style="padding:6px 8px;font-size:8px;color:#94a3b8;text-transform:uppercase;text-align:left">Date</th>
  <th style="padding:6px 8px;font-size:8px;color:#94a3b8;text-transform:uppercase;text-align:left">Strat.</th>
  <th style="padding:6px 8px;font-size:8px;color:#94a3b8;text-transform:uppercase;text-align:left">Entry</th>
  <th style="padding:6px 8px;font-size:8px;color:#94a3b8;text-transform:uppercase;text-align:left">Exit</th>
  <th style="padding:6px 8px;font-size:8px;color:#94a3b8;text-transform:uppercase;text-align:left">P&amp;L</th>
  <th style="padding:6px 8px;font-size:8px;color:#94a3b8;text-transform:uppercase;text-align:center">Dur&eacute;e</th>
  <th style="padding:6px 8px;font-size:8px;color:#94a3b8;text-transform:uppercase;text-align:center">Statut</th>
</tr></thead>
<tbody>${tradeRows}</tbody>
</table></div>

<!-- FOOTER -->
<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 2px;margin-top:10px;border-top:1px solid #e2e8f0">
  <div style="font-size:7px;color:#94a3b8;line-height:1.6">
    <strong style="color:#475569">⚠️ Backtest uniquement.</strong> Pas un conseil financier. Frais, slippage, impact non modélisés.
  </div>
  <div style="text-align:right;flex-shrink:0;margin-left:10px">
    <div style="font-size:9px;font-weight:700;color:#374151">articles.market-watch.xyz/scanner/status/</div>
    <div style="font-size:7px;color:#94a3b8">© 2026 Market Watch™</div>
  </div>
</div>

</div>
</body></html>`;
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const config = JSON.parse(fs.readFileSync(MODES_CFG));
  let allTrades = {};
  try { allTrades = JSON.parse(fs.readFileSync(TRADES)); } catch (_) {}
  const puppeteer = require('puppeteer');

  const modeMap = { growth: 'growth', calmar: 'calmar', zero: 'sharpe' };

  for (const [id, cfg] of Object.entries(config.modes)) {
    const tradeKey = modeMap[id] || id;
    const trades = allTrades[tradeKey] || [];
    const m = computeMetrics(trades, cfg.portfolioSize);
    console.log(`\n=== ${id}: ${cfg.label} (${trades.length} trades, return=${m.ret}%) ===`);

    const html = buildCardHTML(id, cfg, trades, m);

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-software-rasterizer'], protocolTimeout: 120000 });
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 3000, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 2000));
    const clip = await page.evaluate(() => {
      const el = document.body.firstElementChild;
      return { x: 0, y: 0, width: 1080, height: Math.ceil(el.getBoundingClientRect().height) };
    });
    const outPath = path.join(STATUS, `mode-${id}.png`);
    await page.screenshot({ path: outPath, clip, type: 'png' });
    await browser.close();
    console.log(`✅ ${outPath} (${clip.height}px, ${(fs.statSync(outPath).size / 1024).toFixed(0)}KB)`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
