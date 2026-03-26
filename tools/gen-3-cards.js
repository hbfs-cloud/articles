#!/usr/bin/env node
/**
 * gen-3-cards.js — Generates 3 rich mode-card PNG images for scanner/status/.
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
const RESULTS = path.join(ROOT, 'data/backtest-results.json');
const STATUS = path.join(ROOT, 'scanner/status');

// ─── Compute metrics ────────────────────────────────────────────────────────
function computeMetrics(trades, portfolioSize) {
  const wins = trades.filter(t => t.pnlPct > 0);
  const losses = trades.filter(t => t.pnlPct <= 0);
  const totalReturn = trades.reduce((s, t) => s + (t.pnlPct || 0) / portfolioSize, 0);

  let equity = 0, peak = 0, maxDD = 0;
  const curve = [0];
  const ddCurve = [0];
  for (const t of trades) {
    equity += (t.pnlPct || 0) / portfolioSize;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDD) maxDD = dd;
    curve.push(+equity.toFixed(2));
    ddCurve.push(+(-dd).toFixed(2));
  }

  const grossWin = wins.reduce((s, t) => s + t.pnlPct, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));
  const pf = grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : (grossWin > 0 ? '99' : '0');
  const wr = trades.length ? ((wins.length / trades.length) * 100).toFixed(1) : '0';
  const avgWin = wins.length ? (grossWin / wins.length).toFixed(2) : '0';
  const avgLoss = losses.length ? (losses.reduce((s, t) => s + t.pnlPct, 0) / losses.length).toFixed(2) : '0';
  const holdDays = trades.filter(t => t.holdDays).map(t => t.holdDays);
  const avgHold = holdDays.length ? (holdDays.reduce((a, b) => a + b, 0) / holdDays.length).toFixed(1) : '0';

  // Strategy breakdown
  const stratCounts = {};
  const stratPnl = {};
  for (const t of trades) {
    const s = t.strategy || 'other';
    stratCounts[s] = (stratCounts[s] || 0) + 1;
    stratPnl[s] = (stratPnl[s] || 0) + (t.pnlPct || 0);
  }

  // Best/worst trades
  const sorted = [...trades].sort((a, b) => (b.pnlPct || 0) - (a.pnlPct || 0));
  const best3 = sorted.slice(0, 3);
  const worst3 = sorted.slice(-3).reverse();

  // Calmar ratio
  const calmar = maxDD > 0 ? (totalReturn / maxDD).toFixed(1) : totalReturn > 0 ? '∞' : '0';

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
    curve, ddCurve,
    stratCounts, stratPnl,
    best3, worst3, calmar,
    wins: wins.length, losses: losses.length
  };
}

// ─── SVG sparkline with area fill ───────────────────────────────────────────
function sparkSVG(values, color, w, h, ddValues) {
  if (!values.length) return '';
  const min = Math.min(...values, ...(ddValues || []));
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const fill = pts + ` ${w},${h} 0,${h}`;

  let ddSvg = '';
  if (ddValues && ddValues.length) {
    const ddPts = ddValues.map((v, i) => {
      const x = (i / (ddValues.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const ddFill = ddPts + ` ${w},${h} 0,${h}`;
    ddSvg = `<polygon points="${ddFill}" fill="#dc2626" fill-opacity="0.08"/>
    <polyline points="${ddPts}" fill="none" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="4,3"/>`;
  }

  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:${h}px">
    <polygon points="${fill}" fill="${color}" fill-opacity="0.15"/>
    ${ddSvg}
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5"/>
  </svg>`;
}

// ─── Horizontal bar SVG ─────────────────────────────────────────────────────
function hBarSVG(segments, w, h) {
  // segments: [{value, color, label}]
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (!total) return '';
  let x = 0;
  const bars = segments.map(seg => {
    const barW = (seg.value / total) * w;
    const rect = `<rect x="${x.toFixed(1)}" y="0" width="${barW.toFixed(1)}" height="${h}" fill="${seg.color}" rx="0"/>`;
    const label = barW > 40 ? `<text x="${(x + barW / 2).toFixed(1)}" y="${h / 2 + 4}" text-anchor="middle" font-size="10" font-weight="700" fill="white">${seg.value}</text>` : '';
    x += barW;
    return rect + label;
  }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:${h}px;border-radius:8px;overflow:hidden">${bars}</svg>`;
}

// ─── Build card HTML ────────────────────────────────────────────────────────
function buildCardHTML(id, cfg, trades, m, backtest) {
  const desc = [`P${cfg.portfolioSize}`, `Top${cfg.topN}`, `H${cfg.horizon}j`, cfg.filterName, cfg.rotation,
    cfg.partialTP ? 'PTP' : null, cfg.trailingStop ? 'Trail' : null].filter(Boolean).join(' / ');

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const period = backtest?.period || {};
  const periodLabel = period.start && period.end
    ? `${new Date(period.start).toLocaleDateString('fr-FR', {day:'numeric',month:'short'})} – ${new Date(period.end).toLocaleDateString('fr-FR', {day:'numeric',month:'short',year:'numeric'})}`
    : '';

  // Status breakdown
  const statusItems = [
    { label: 'TP1', value: m.tp1, color: '#059669' },
    { label: 'TP2', value: m.tp2, color: '#047857' },
    { label: 'TP1½', value: m.tp1_partial, color: '#10b981' },
    { label: 'SL', value: m.sl, color: '#dc2626' },
    { label: 'Expired', value: m.expired, color: '#f59e0b' },
    { label: 'Rotated', value: m.rotated, color: '#6366f1' },
  ].filter(s => s.value > 0);

  // Strategy breakdown
  const stratEntries = Object.entries(m.stratCounts).sort((a, b) => b[1] - a[1]);
  const stratColors = { momentum: '#059669', breakout: '#2563eb', pre_squeeze: '#7c3aed', pullback: '#f59e0b', other: '#94a3b8' };

  // Trade grid (color-coded tiles like daily card positions grid)
  const tradeGrid = trades.map(t => {
    const pnl = t.pnlPct || 0;
    let bg, border, textColor;
    if (pnl >= 10) { bg = '#047857'; border = '#065f46'; textColor = 'white'; }
    else if (pnl >= 5) { bg = '#059669'; border = '#047857'; textColor = 'white'; }
    else if (pnl > 0) { bg = '#d1fae5'; border = '#6ee7b7'; textColor = '#065f46'; }
    else if (pnl === 0) { bg = '#f1f5f9'; border = '#cbd5e1'; textColor = '#475569'; }
    else if (pnl > -3) { bg = '#fee2e2'; border = '#fca5a5'; textColor = '#991b1b'; }
    else { bg = '#dc2626'; border = '#b91c1c'; textColor = 'white'; }
    const icon = { tp1: '✅', tp2: '🎯', sl: '❌', expired: '⏳', rotated: '🔄', tp1_partial: '✅' }[t.status] || '';
    return `<div style="background:${bg};border:1px solid ${border};border-radius:8px;padding:6px 8px;text-align:center;min-width:0">
      <div style="font-weight:800;font-size:11px;color:${textColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.ticker}</div>
      <div style="font-weight:700;font-size:10px;color:${textColor};opacity:.9">${pnl > 0 ? '+' : ''}${pnl}%</div>
      <div style="font-size:8px;color:${textColor};opacity:.7">${icon} ${t.holdDays || 0}j</div>
    </div>`;
  }).join('');

  // Trade table (top 20)
  const seen = {};
  const tradeRows = trades.slice(0, 20).map((t, i) => {
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

  // KPI tile helper
  const kpi = (val, label, color) => `<div style="background:white;border-radius:10px;padding:11px 8px;box-shadow:0 1px 5px rgba(0,0,0,.06);border:1px solid #e2e8f0;text-align:center">
    <div style="font-weight:900;font-size:22px;color:${color};line-height:1.1">${val}</div>
    <div style="font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-top:3px">${label}</div>
  </div>`;

  // Big stat helper (like daily card performance section)
  const bigStat = (val, label, sub, color) => `<div style="background:white;border-radius:14px;padding:16px 14px;box-shadow:0 2px 8px rgba(0,0,0,.06);border:1px solid #e2e8f0;text-align:center;flex:1">
    <div style="font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">${label}</div>
    <div style="font-weight:900;font-size:32px;color:${color};line-height:1">${val}</div>
    <div style="font-size:9px;color:#64748b;margin-top:4px">${sub}</div>
  </div>`;

  // Equity curve values
  const equityBase100 = m.curve.map(v => 100 + v);
  const ddBase100 = m.ddCurve.map(v => 100 + v);

  // Top 3 best / worst
  const topCard = (t, rank, isBest) => {
    const pnl = t.pnlPct || 0;
    const borderColor = isBest ? '#059669' : '#dc2626';
    const bgColor = isBest ? '#f0fdf4' : '#fef2f2';
    return `<div style="background:${bgColor};border:2px solid ${borderColor};border-radius:10px;padding:10px 12px;flex:1;min-width:0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <div style="display:flex;align-items:center;gap:5px">
          <span style="background:${borderColor};color:white;font-weight:800;font-size:9px;padding:2px 6px;border-radius:4px">#${rank}</span>
          <span style="font-weight:800;font-size:14px;color:#0f172a">${t.ticker}</span>
        </div>
        <span style="font-weight:900;font-size:15px;color:${borderColor}">${pnl > 0 ? '+' : ''}${pnl}%</span>
      </div>
      <div style="font-size:9px;color:#64748b">${t.strategy || ''} · ${t.holdDays || 0}j · $${(t.actualEntry || 0).toFixed(2)} → $${(t.exitPrice || 0).toFixed(2)}</div>
    </div>`;
  };

  // Strategy pie (simple horizontal stacked bar)
  const stratBar = hBarSVG(
    stratEntries.map(([s, count]) => ({ value: count, color: stratColors[s] || '#94a3b8', label: s })),
    760, 28
  );
  const stratLegend = stratEntries.map(([s, count]) => {
    const pnl = (m.stratPnl[s] || 0);
    return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:#475569;margin-right:12px">
      <span style="width:10px;height:10px;border-radius:3px;background:${stratColors[s] || '#94a3b8'};display:inline-block"></span>
      <strong>${s}</strong> ${count}t · <span style="color:${pnl >= 0 ? '#059669' : '#dc2626'}">${pnl >= 0 ? '+' : ''}${pnl.toFixed(1)}%</span>
    </span>`;
  }).join('');

  // Status bar
  const statusBar = hBarSVG(statusItems.map(s => ({ value: s.value, color: s.color, label: s.label })), 760, 28);
  const statusLegend = statusItems.map(s =>
    `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:#475569;margin-right:12px">
      <span style="width:10px;height:10px;border-radius:3px;background:${s.color};display:inline-block"></span>
      <strong>${s.label}</strong> ${s.value}
    </span>`
  ).join('');

  // Walk-forward info
  const wf = backtest?.walk_forward || {};
  const wfHtml = wf.in_sample_scans ? `
  <div style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border:2px solid #f59e0b;border-radius:10px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:14px">
    <div style="font-size:10px;color:#92400e;font-weight:700">🧪 Walk-Forward</div>
    <div style="font-size:10px;color:#78350f">In-sample: <strong>${wf.in_sample_scans}</strong> scans · Out-sample: <strong>${wf.out_sample_scans}</strong> scans</div>
    <div style="font-size:10px;color:#78350f">Univers: <strong>${backtest?.universe?.tickers || '?'}</strong> tickers · <strong>${backtest?.universe?.total_setups || '?'}</strong> setups</div>
  </div>` : '';

  const sectionTitle = (icon, text) => `<div style="font-size:9px;font-weight:700;color:#475569;letter-spacing:2px;text-transform:uppercase;margin:16px 0 8px;display:flex;align-items:center;gap:8px">
    <span style="width:3px;height:14px;background:${cfg.color};border-radius:2px;display:inline-block"></span>
    ${icon} ${text}
  </div>`;

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
    <div style="width:40px;height:40px;background:linear-gradient(135deg,#f59e0b,#ef4444);border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:15px;color:white">MW</div>
    <div>
      <div style="font-size:14px;color:white;font-weight:800;letter-spacing:.5px">MARKET WATCH</div>
      <div style="font-size:10px;color:#60a5fa;text-transform:uppercase;letter-spacing:2px">Scanner Strategy · Backtest</div>
    </div>
  </div>
  <div style="text-align:center">
    <div style="color:#f59e0b;font-weight:800;font-size:13px;text-transform:capitalize">${today}</div>
    <div style="font-size:9px;color:#94a3b8;margin-top:3px">${periodLabel} · ${period.scans || '?'} scans</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:9px;color:#94a3b8">${m.trades} trades · ${m.wins}W / ${m.losses}L</div>
    <div style="font-size:9px;color:#94a3b8;margin-top:2px">Calmar: ${m.calmar}</div>
  </div>
</div>

<!-- GUIDE LECTEURS -->
<div style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;padding:8px 18px;margin-bottom:14px;display:flex;gap:14px;align-items:center;flex-wrap:wrap">
  <span style="color:#475569;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:1px;white-space:nowrap">📖 Guide</span>
  <span style="font-size:8px;color:#64748b"><strong style="color:#374151">📋 Méthode</strong> : Max ${cfg.portfolioSize} pos. · Top${cfg.topN} signaux · Horizon ${cfg.horizon}j</span><span style="color:#cbd5e1">|</span>
  <span style="font-size:8px;color:#64748b"><strong style="color:#374151">🔄 Rotation</strong> : ${cfg.rotation} · Filtre: ${cfg.filterName}</span><span style="color:#cbd5e1">|</span>
  <span style="font-size:8px;color:#64748b"><strong style="color:#374151">📊 Stats</strong> : Depuis D0 (15 fév) · Return = MtM réalisé · ${cfg.partialTP ? 'Partial TP actif' : 'Full TP'} · ${cfg.trailingStop ? 'Trailing Stop actif' : 'Fixed Stop'}</span>
</div>

<!-- MODE BADGE -->
<div style="background:${cfg.color};padding:16px 22px;border-radius:12px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between">
  <div>
    <div style="font-weight:900;font-size:26px;color:white;letter-spacing:1px">${cfg.label.toUpperCase()}</div>
    <div style="font-size:13px;color:rgba(255,255,255,.85);margin-top:2px">${desc}</div>
  </div>
  <div style="text-align:right">
    <div style="font-weight:900;font-size:38px;color:white">${m.ret > 0 ? '+' : ''}${m.ret}%</div>
    <div style="font-size:11px;color:rgba(255,255,255,.7)">Return total</div>
  </div>
</div>

${wfHtml}

<!-- PERFORMANCE STATS (big numbers like daily card) -->
${sectionTitle('📊', `PERFORMANCES DEPUIS D0 (15 FÉV 2026) · ${m.trades} TRADES`)}
<div style="display:flex;gap:10px;margin-bottom:14px">
  ${bigStat(`${m.ret > 0 ? '+' : ''}${m.ret}%`, 'Return Total', `Calmar: ${m.calmar}`, m.ret >= 0 ? '#059669' : '#dc2626')}
  ${bigStat(`${m.dd}%`, 'Max Drawdown', `Peak → Trough`, '#dc2626')}
  ${bigStat(`${m.wr}%`, 'Win Rate', `${m.wins} wins / ${m.losses} losses`, '#7c3aed')}
  ${bigStat(`${m.pf}x`, 'Profit Factor', `Avg W: +${m.avgWin}% / L: ${m.avgLoss}%`, '#2563eb')}
</div>

<!-- KPI GRID (secondary metrics) -->
<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:14px">
  ${kpi(m.trades, 'Trades', '#0891b2')}
  ${kpi(m.avgHold + 'j', 'Hold Moy.', '#f59e0b')}
  ${kpi(`+${m.avgWin}%`, 'Win Moy.', '#059669')}
  ${kpi(`${m.avgLoss}%`, 'Loss Moy.', '#dc2626')}
  ${kpi(m.calmar, 'Calmar', '#7c3aed')}
</div>

<!-- EQUITY CURVE with DD overlay -->
${sectionTitle('📈', 'EQUITY CURVE (BASE 100) + DRAWDOWN')}
<div style="background:white;border-radius:12px;padding:14px 16px;box-shadow:0 2px 8px rgba(0,0,0,.06);border:1px solid #e2e8f0;margin-bottom:14px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <div style="display:flex;gap:16px;align-items:center">
      <span style="display:flex;align-items:center;gap:4px;font-size:9px;color:#64748b"><span style="width:16px;height:3px;background:${cfg.color};border-radius:2px;display:inline-block"></span> Equity</span>
      <span style="display:flex;align-items:center;gap:4px;font-size:9px;color:#64748b"><span style="width:16px;height:2px;border-top:2px dashed #dc2626;display:inline-block"></span> Drawdown</span>
    </div>
    <span style="font-size:11px;font-weight:700;color:${m.ret >= 0 ? '#059669' : '#dc2626'}">100 → ${(100 + m.ret).toFixed(1)}</span>
  </div>
  ${sparkSVG(equityBase100, cfg.color, 1040, 100, ddBase100)}
</div>

<!-- TOP 3 BEST TRADES -->
${sectionTitle('🏆', 'TOP 3 MEILLEURS TRADES')}
<div style="display:flex;gap:10px;margin-bottom:14px">
  ${m.best3.map((t, i) => topCard(t, i + 1, true)).join('')}
</div>

<!-- TOP 3 WORST TRADES -->
${sectionTitle('⚠️', 'TOP 3 PIRES TRADES')}
<div style="display:flex;gap:10px;margin-bottom:14px">
  ${m.worst3.map((t, i) => topCard(t, i + 1, false)).join('')}
</div>

<!-- STATUS BREAKDOWN -->
${sectionTitle('🎯', 'RÉSULTATS PAR STATUT')}
<div style="background:white;border-radius:10px;padding:12px 14px;box-shadow:0 1px 5px rgba(0,0,0,.06);border:1px solid #e2e8f0;margin-bottom:14px">
  ${statusBar}
  <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px">${statusLegend}</div>
</div>

<!-- STRATEGY BREAKDOWN -->
${sectionTitle('🧬', 'RÉPARTITION PAR STRATÉGIE')}
<div style="background:white;border-radius:10px;padding:12px 14px;box-shadow:0 1px 5px rgba(0,0,0,.06);border:1px solid #e2e8f0;margin-bottom:14px">
  ${stratBar}
  <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px">${stratLegend}</div>
</div>

<!-- ALL TRADES GRID (color-coded like daily card positions) -->
${sectionTitle('📋', `TOUS LES TRADES (${trades.length}) — TRIÉS PAR DATE`)}
<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-bottom:14px">
  ${tradeGrid}
</div>

<!-- TRADE TABLE (detailed) -->
${sectionTitle('📑', `HISTORIQUE DÉTAILLÉ (${Math.min(trades.length, 20)} / ${trades.length})`)}
<div style="background:white;border-radius:10px;overflow:hidden;box-shadow:0 1px 5px rgba(0,0,0,.06);border:1px solid #e2e8f0;margin-bottom:14px">
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
<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 2px;margin-top:10px;border-top:2px solid #e2e8f0">
  <div style="font-size:8px;color:#94a3b8;line-height:1.6">
    <strong style="color:#475569">⚠️ Backtest uniquement.</strong> Pas un conseil financier. Frais, slippage, impact non modélisés.<br>
    Données issues de 126 000 combinaisons testées via sweep optimizer.
  </div>
  <div style="text-align:right;flex-shrink:0;margin-left:10px">
    <div style="font-size:10px;font-weight:700;color:#374151">articles.market-watch.xyz/scanner/status/</div>
    <div style="font-size:8px;color:#94a3b8">© 2026 Market Watch™</div>
  </div>
</div>

</div>
</body></html>`;
}

// ─── Clean old timestamped images ───────────────────────────────────────────
function cleanOldImages(dir, prefix) {
  const re = new RegExp(`^${prefix}-\\d+\\.png$`);
  try {
    fs.readdirSync(dir).filter(f => re.test(f)).forEach(f => {
      fs.unlinkSync(path.join(dir, f));
    });
  } catch (_) {}
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const config = JSON.parse(fs.readFileSync(MODES_CFG));
  let allTrades = {};
  try { allTrades = JSON.parse(fs.readFileSync(TRADES)); } catch (_) {}
  let backtest = {};
  try { backtest = JSON.parse(fs.readFileSync(RESULTS)); } catch (_) {}
  const puppeteer = require('puppeteer');

  const modeMap = { growth: 'growth', calmar: 'calmar', zero: 'sharpe' };
  const ts = Date.now();
  const manifest = {};

  // Read existing manifest to preserve daily-card entry
  const manifestPath = path.join(STATUS, 'manifest.json');
  try {
    const existing = JSON.parse(fs.readFileSync(manifestPath));
    if (existing['daily-card']) manifest['daily-card'] = existing['daily-card'];
  } catch (_) {}

  for (const [id, cfg] of Object.entries(config.modes)) {
    const tradeKey = modeMap[id] || id;
    const trades = allTrades[tradeKey] || [];
    const m = computeMetrics(trades, cfg.portfolioSize);
    console.log(`\n=== ${id}: ${cfg.label} (${trades.length} trades, return=${m.ret}%) ===`);

    const html = buildCardHTML(id, cfg, trades, m, backtest);

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-software-rasterizer'], protocolTimeout: 120000 });
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 5000, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 2000));
    const clip = await page.evaluate(() => {
      const el = document.body.firstElementChild;
      return { x: 0, y: 0, width: 1080, height: Math.ceil(el.getBoundingClientRect().height) };
    });

    // Clean old timestamped files, then write new one
    cleanOldImages(STATUS, `mode-${id}`);
    const filename = `mode-${id}-${ts}.png`;
    const outPath = path.join(STATUS, filename);
    await page.screenshot({ path: outPath, clip, type: 'png' });
    await browser.close();

    manifest[`mode-${id}`] = filename;
    console.log(`✅ ${outPath} (${clip.height}px, ${(fs.statSync(outPath).size / 1024).toFixed(0)}KB)`);
  }

  // Write manifest for gen-status-page.js and other scripts
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\n✅ Manifest written: ${manifestPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
