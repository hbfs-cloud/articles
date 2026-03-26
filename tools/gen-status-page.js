#!/usr/bin/env node
/**
 * gen-status-page.js — Generates scanner/status/index.html
 *
 * Sections:
 *   1. Signaux du jour (latest scan)
 *   2. Positions en cours + cash allocation
 *   3. 3 mode tabs (Growth / Risk-Adjusted / Conservative) with KPIs, config, equity, trades
 *
 * Usage: node tools/gen-status-page.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MODES_CFG = path.join(ROOT, 'data/modes-config.json');
const TRADES = path.join(ROOT, 'data/backtest-trades.json');
const RESULTS = path.join(ROOT, 'data/backtest-results.json');
const SCANNER_DIR = path.join(ROOT, 'scanner');
const POSITIONS_FILE = path.join(ROOT, 'data/scanner-positions.json');
const METRICS_FILE = path.join(ROOT, 'data/scanner-metrics.json');
const OUT = path.join(ROOT, 'scanner/status/index.html');

// ─── Compute metrics ────────────────────────────────────────────────────────
function computeMetrics(trades, portfolioSize) {
  const wins = trades.filter(t => t.pnlPct > 0);
  const losses = trades.filter(t => t.pnlPct <= 0);
  const totalReturn = trades.reduce((s, t) => s + (t.pnlPct || 0) / portfolioSize, 0);

  let equity = 0, peak = 0, maxDD = 0;
  const equityCurve = [{ date: null, value: 100 }];
  for (const t of trades) {
    equity += (t.pnlPct || 0) / portfolioSize;
    if (equity > peak) peak = equity;
    if (peak - equity > maxDD) maxDD = peak - equity;
    equityCurve.push({ date: t.scanDate, value: +(100 + equity).toFixed(2) });
  }

  const grossWin = wins.reduce((s, t) => s + t.pnlPct, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));
  const pf = grossLoss > 0 ? +(grossWin / grossLoss).toFixed(2) : (grossWin > 0 ? 99 : 0);
  const wr = trades.length ? +((wins.length / trades.length) * 100).toFixed(1) : 0;
  const holdDays = trades.filter(t => t.holdDays).map(t => t.holdDays);
  const avgHold = holdDays.length ? +(holdDays.reduce((a, b) => a + b, 0) / holdDays.length).toFixed(1) : 0;
  const ret = +totalReturn.toFixed(2);
  const dd = +maxDD.toFixed(2);
  const sharpe = dd > 0 ? +(ret / dd).toFixed(2) : (ret > 0 ? 999 : 0);
  const calmar = dd > 0 ? Math.round(ret / dd) : (ret > 0 ? 999 : 0);

  return { ret, dd: +(-dd).toFixed(2), wr, pf, trades: trades.length, avgHold, sharpe, calmar, equityCurve,
    wins: wins.length, losses: losses.length };
}

function equityDatesValues(curve) {
  const byDate = {};
  for (const p of curve) { if (p.date) byDate[p.date] = p.value; }
  const dates = Object.keys(byDate).sort();
  return { dates: dates.map(d => d.slice(5).replace('-', '/')), values: dates.map(d => byDate[d]) };
}

// ─── Main ───────────────────────────────────────────────────────────────────
function main() {
  const config = JSON.parse(fs.readFileSync(MODES_CFG));
  let allTrades = {};
  try { allTrades = JSON.parse(fs.readFileSync(TRADES)); } catch (_) {}
  let results = {};
  try { results = JSON.parse(fs.readFileSync(RESULTS)); } catch (_) {}

  // Live data
  let liveMetrics = {};
  try { liveMetrics = JSON.parse(fs.readFileSync(METRICS_FILE)); } catch (_) {}
  let livePositions = [];
  try { livePositions = JSON.parse(fs.readFileSync(POSITIONS_FILE)).open_positions || []; } catch (_) {}

  // Latest scan signals
  let signals = [];
  let scanDir = '';
  try {
    const dirs = fs.readdirSync(SCANNER_DIR).filter(d => /^\d{8}(-\d+)?$/.test(d)).sort().reverse();
    scanDir = dirs[0] || '';
    if (scanDir) {
      const html = fs.readFileSync(path.join(SCANNER_DIR, scanDir, 'index.html'), 'utf8');
      const m = html.match(/id="synthese"[\s\S]{0,15000}/);
      if (m) {
        const rows = m[0].match(/<tr[\s\S]*?<\/tr>/gi) || [];
        for (const row of rows) {
          const cells = (row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [])
            .map(c => c.replace(/<[^>]+>/g, '').replace(/,/g, '.').trim());
          if (cells.length < 4) continue;
          const ticker = cells.find(c => /^[A-Z]{1,5}$/.test(c.trim()));
          if (!ticker) continue;
          const score = cells.map(c => parseFloat(c)).find(n => n >= 70 && n <= 100);
          const stratRaw = cells.find(c => /momentum|squeeze|breakout|pullback/i.test(c)) || '';
          const pf = cells.filter(c => /^\$[\d.]/.test(c.trim()));
          const rr = cells.find(c => /1:\d/.test(c)) || '';
          signals.push({ ticker: ticker.trim(), score: score || 0, strategy: stratRaw.trim(),
            entry: pf[0] || '—', stop: pf[1] || '—', tp1: pf[2] || '—', tp2: pf[3] || '—', rr });
        }
      }
    }
  } catch (_) {}
  signals.sort((a, b) => b.score - a.score);

  // Modes
  const modeMap = { growth: 'growth', calmar: 'calmar', zero: 'sharpe' };
  const modes = {};
  for (const [id, cfg] of Object.entries(config.modes)) {
    const trades = allTrades[modeMap[id] || id] || [];
    modes[id] = { cfg, trades, m: computeMetrics(trades, cfg.portfolioSize) };
  }
  const g = modes.growth.m, ca = modes.calmar.m, z = modes.zero.m;
  const gEC = equityDatesValues(g.equityCurve);
  const caEC = equityDatesValues(ca.equityCurve);
  const zEC = equityDatesValues(z.equityCurve);

  const todayFr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const totalCombos = (results.total_combinations || 126000).toLocaleString('fr');
  const updatedAt = liveMetrics.updated_at
    ? new Date(liveMetrics.updated_at).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })
    : todayFr;

  // ── Helpers ──
  function filterLabel(f) {
    return { all: 'Toutes', no_sq: 'Sans Short Squeeze', momentum_only: 'Momentum', breakout_only: 'Breakout', no_sq_pb: 'Sans SQ/PB' }[f] || f;
  }
  function rotationLabel(r) {
    return { none: 'Aucune', daily_max1: 'Max 1/j', daily_max2: 'Max 2/j', aggressive: 'Agressive' }[r] || r;
  }

  // ── Filter positions per mode ──
  const STRAT_FILTERS = {
    all: () => true,
    no_sq: s => !/short.?squeeze/i.test(s),
    momentum_only: s => /momentum/i.test(s),
    breakout_only: s => /breakout/i.test(s),
    no_sq_pb: s => !/short.?squeeze|pullback/i.test(s),
  };

  function positionsForMode(cfg) {
    const filter = STRAT_FILTERS[cfg.filterName] || (() => true);
    return [...livePositions]
      .filter(p => filter(p.strategy || ''))
      .sort((a, b) => b.return_pct - a.return_pct)
      .slice(0, cfg.portfolioSize);
  }

  function posTableHTML(positions) {
    if (!positions.length) return '<p class="muted" style="text-align:center;padding:1rem">Aucune position</p>';
    const alloc = positions.length ? Math.round(100 / positions.length) : 0;
    const deployed = positions.reduce((s, p) => s + (p.return_pct >= 0 ? 1 : 0), 0);
    const totalRet = positions.reduce((s, p) => s + (p.return_pct || 0), 0) / positions.length;
    return `
    <div class="cap-strip" style="margin-bottom:.5rem">
      ${positions.map(p => {
        const c = p.return_pct >= 5 ? '#059669' : p.return_pct >= 0 ? '#3b82f6' : p.return_pct >= -3 ? '#f59e0b' : '#dc2626';
        return `<div style="flex:1;background:${c}" title="${p.ticker} ${p.return_pct > 0 ? '+' : ''}${p.return_pct}%"></div>`;
      }).join('')}
    </div>
    <div class="cap-bar" style="margin-bottom:.6rem">
      <div class="cap-seg"><strong>${positions.length}</strong> positions</div>
      <div class="cap-seg">${alloc}% / pos.</div>
      <div class="cap-seg" style="margin-left:auto">P&amp;L moy : <strong class="${totalRet >= 0 ? 'pos' : 'neg'}" style="color:${totalRet >= 0 ? '#059669' : '#dc2626'}">${totalRet > 0 ? '+' : ''}${totalRet.toFixed(1)}%</strong></div>
    </div>
    <div class="tbl-wrap">
    <table class="tbl">
      <thead><tr><th>Ticker</th><th>Date achat</th><th>Prix achat</th><th>Prix actuel</th><th>P&amp;L</th><th>Alloc.</th><th>Stop</th><th>TP1</th><th>Progr.</th><th>Jours restants</th></tr></thead>
      <tbody>${positions.map(p => {
        const rc = p.return_pct >= 0 ? 'pos' : 'neg';
        const prog = Math.min(100, Math.max(0, p.progress_pct || 0));
        const pc = prog >= 70 ? '#059669' : prog >= 40 ? '#f59e0b' : '#dc2626';
        return `<tr>
          <td><strong>${p.ticker}</strong></td>
          <td class="muted">${p.scan_date || '—'}</td>
          <td>$${(p.entry||0).toFixed(2)}</td>
          <td>$${(p.current_price||0).toFixed(2)}</td>
          <td class="${rc}" style="font-weight:700">${p.return_pct > 0 ? '+' : ''}${p.return_pct}%</td>
          <td class="muted">${alloc}%</td>
          <td class="neg">$${(p.stop||0).toFixed(2)}</td>
          <td class="pos">${p.tp1 ? '$'+p.tp1.toFixed(2) : '—'}</td>
          <td><div class="prog"><div class="prog-fill" style="width:${prog}%;background:${pc}"></div></div></td>
          <td class="muted">${p.days_remaining || 0}j</td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>
    </div>`;
  }

  // ── Signals table ──
  const sigRows = signals.map((s, i) => {
    const bg = s.score >= 90 ? '#059669' : s.score >= 85 ? '#2563eb' : '#f59e0b';
    return `<tr>
      <td class="muted" style="text-align:center">${i + 1}</td>
      <td><strong>${s.ticker}</strong></td>
      <td><span class="score-pill" style="background:${bg}">${s.score}</span></td>
      <td class="muted">${s.strategy}</td>
      <td>${s.entry}</td>
      <td class="neg">${s.stop}</td>
      <td class="pos">${s.tp1}</td>
      <td class="pos">${s.tp2}</td>
      <td style="color:#d97706;font-weight:600">${s.rr}</td>
    </tr>`;
  }).join('');

  // ── Trade table builder ──
  function tradeRows(trades, color) {
    if (!trades.length) return '<tr><td colspan="9" class="muted" style="text-align:center;padding:2rem">Aucun trade</td></tr>';
    const statusMap = { tp1:'TP1', tp2:'TP2', sl:'SL', expired:'Exp.', rotated:'Rot.', tp1_partial:'TP1½', open:'Open' };
    const statusCls = { tp1:'pos', tp2:'pos', sl:'neg', expired:'warn', rotated:'muted', tp1_partial:'pos' };
    return [...trades].sort((a, b) => (b.scanDate || '').localeCompare(a.scanDate || '')).map((t, i) => {
      const pnl = t.pnlPct || 0;
      const cls = pnl > 0 ? 'pos' : pnl < 0 ? 'neg' : 'muted';
      return `<tr>
        <td><strong>${t.ticker || '—'}</strong></td>
        <td class="muted">${t.scanDate ? t.scanDate.slice(5) : '—'}</td>
        <td class="muted">${t.strategy || '—'}</td>
        <td>$${(t.actualEntry||0).toFixed(2)}</td>
        <td>${t.exitPrice ? '$'+t.exitPrice.toFixed(2) : '—'}</td>
        <td class="${cls}" style="font-weight:700">${pnl > 0 ? '+' : ''}${pnl}%</td>
        <td class="muted">${t.holdDays || 0}j</td>
        <td><span class="pill ${statusCls[t.status] || 'muted'}">${statusMap[t.status] || t.status || '—'}</span></td>
      </tr>`;
    }).join('');
  }

  // ── Mode panel builder ──
  function modePanel(id, cfg, m, trades, ec, chartId, isActive) {
    const alloc = Math.round(100 / cfg.portfolioSize);
    const modePos = positionsForMode(cfg);
    return `
    <div class="mp${isActive ? ' active' : ''}" id="p-${id}">

      <!-- 1. R&eacute;sum&eacute; rapide -->
      <div class="kstrip">
        <div class="k"><span class="kv" style="color:${cfg.color}">${m.ret > 0 ? '+' : ''}${m.ret}%</span><span class="kl">Return</span></div>
        <div class="k"><span class="kv neg">${m.dd}%</span><span class="kl">Max DD</span></div>
        <div class="k"><span class="kv">${m.wr}%</span><span class="kl">Win Rate</span></div>
        <div class="k"><span class="kv">${m.pf}x</span><span class="kl">Profit F.</span></div>
        <div class="k"><span class="kv">${m.trades}</span><span class="kl">Trades</span></div>
        <div class="k"><span class="kv">${m.avgHold}j</span><span class="kl">Hold moy</span></div>
      </div>

      <!-- 2. Comment faire (simple) -->
      <div class="how-card" style="border-color:${cfg.color}40;margin:1rem 0">
        <h4 style="color:${cfg.color}">Comment faire ?</h4>
        <ol>
          <li>Chaque soir, prendre les <strong>Top ${cfg.topN}</strong> signaux par score${cfg.filterName !== 'all' ? ' (filtre : ' + filterLabel(cfg.filterName) + ')' : ''}</li>
          <li>Acheter &agrave; l'ouverture du lendemain (<strong>15h30 Paris</strong>)</li>
          <li>Placer le <strong>stop</strong> et le <strong>target</strong> indiqu&eacute;s dans le scan</li>
          <li>Vendre quand : target atteint, stop touch&eacute;, ou apr&egrave;s <strong>${cfg.horizon} jours</strong></li>
          ${cfg.partialTP ? '<li>Si target atteint &rarr; vendre la moiti&eacute;, d&eacute;placer le stop au prix d\'achat</li>' : ''}
          ${cfg.rotation !== 'none' ? '<li>Rotation : remplacer la pire position si un meilleur signal appara&icirc;t</li>' : ''}
        </ol>
        <div style="margin-top:.6rem;padding-top:.6rem;border-top:1px solid #f1f5f9;font-size:.78rem;color:#94a3b8">
          ${cfg.portfolioSize} positions max &middot; ${alloc}% du capital par position &middot; Horizon ${cfg.horizon}j &middot; ${filterLabel(cfg.filterName)}
        </div>
      </div>

      <!-- 3. Positions en cours pour ce mode -->
      <h4 class="tbl-title">Positions en cours (${modePos.length} / ${cfg.portfolioSize} max)</h4>
      ${posTableHTML(modePos)}

      <!-- 4. Equity curve -->
      <h4 class="tbl-title">Performance cumul&eacute;e</h4>
      <div id="${chartId}" style="width:100%;height:250px;border-radius:12px;background:#fff"></div>

      <!-- 5. Historique trades -->
      <details style="margin-top:1rem">
        <summary class="tbl-title" style="cursor:pointer">Historique des trades (${trades.length})</summary>
        <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr><th>Ticker</th><th>Date</th><th>Strat.</th><th>Entry</th><th>Exit</th><th>P&amp;L</th><th>Dur&eacute;e</th><th>Statut</th></tr></thead>
          <tbody>${tradeRows(trades, cfg.color)}</tbody>
        </table>
        </div>
      </details>
    </div>`;
  }

  function modeDesc(cfg) {
    return [`P${cfg.portfolioSize}`, `Top${cfg.topN}`, `H${cfg.horizon}j`, filterLabel(cfg.filterName), rotationLabel(cfg.rotation),
      cfg.partialTP ? 'PTP' : null, cfg.trailingStop ? 'Trail' : null].filter(Boolean).join(' · ');
  }

  // ── Capital bar ──
  const wk = liveMetrics.working_capital_pct || 0;
  const pd = liveMetrics.pending_orders_pct || 0;
  const av = liveMetrics.available_cash_pct || 0;

  // ═══════════════════════════════════════════════════════════════════════════
  const html = `<!DOCTYPE html>
<html lang="fr" data-tags="technique,formation,trade-idea,us,eu,asia,etf" data-tab="scanner">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scanner Status &mdash; Market Watch</title>
  <meta name="description" content="Signaux du jour, positions en cours et 3 modes de trading optimis&eacute;s.">
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-T5Z595CW');</script>
  <link rel="stylesheet" href="/assets/report.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
  <style>
    body{background:#f8fafc;font-family:'Inter',sans-serif;color:#0f172a}
    .wrap{max-width:1060px;margin:0 auto;padding:0 1rem 3rem}

    /* Hero */
    .hero{text-align:center;padding:2.5rem 1.5rem 1.8rem;background:linear-gradient(180deg,#fff 0%,#f1f5f9 100%);margin-bottom:1rem}
    .hero h1{font-size:1.8rem;font-weight:900;margin:0 0 .3rem;color:#0f172a}
    .hero .sub{font-size:.95rem;color:#64748b;margin:0}
    .hero .ts{display:inline-block;margin-top:.8rem;font-size:.75rem;color:#94a3b8;background:#f1f5f9;padding:.25rem .8rem;border-radius:20px}

    /* Section headers */
    .sh{display:flex;align-items:center;gap:.6rem;margin:2rem 0 .8rem;padding-bottom:.5rem;border-bottom:2px solid #e2e8f0}
    .sh h2{font-size:1.15rem;font-weight:800;color:#0f172a;margin:0}
    .sh .badge{font-size:.75rem;font-weight:700;padding:.2rem .6rem;border-radius:8px;color:#fff}
    .sh a{font-size:.8rem;color:#3b82f6;text-decoration:none;margin-left:auto;font-weight:600}
    .sh a:hover{text-decoration:underline}

    /* Tables */
    .tbl-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 0 1rem}
    .tbl{width:100%;border-collapse:collapse;font-size:.82rem}
    .tbl th{background:#f1f5f9;color:#64748b;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.4px;padding:.55rem .7rem;text-align:left;border-bottom:2px solid #e2e8f0;white-space:nowrap}
    .tbl td{padding:.5rem .7rem;border-bottom:1px solid #f1f5f9;vertical-align:middle}
    .tbl tr:hover{background:#f8fafc}
    .tbl .pos{color:#059669;font-weight:600}
    .tbl .neg{color:#dc2626;font-weight:600}
    .tbl .warn{color:#d97706;font-weight:600}
    .tbl .muted{color:#94a3b8;font-size:.78rem}
    .score-pill{display:inline-block;color:#fff;font-weight:800;font-size:.75rem;padding:.15rem .55rem;border-radius:6px;min-width:28px;text-align:center}
    .pill{display:inline-block;font-size:.7rem;font-weight:700;padding:.15rem .5rem;border-radius:6px;background:#f1f5f9}
    .pill.pos{background:#ecfdf5;color:#059669}
    .pill.neg{background:#fef2f2;color:#dc2626}
    .pill.warn{background:#fffbeb;color:#d97706}
    .prog{width:60px;height:5px;background:#e2e8f0;border-radius:3px;display:inline-block;vertical-align:middle}
    .prog-fill{height:100%;border-radius:3px}
    .tbl-title{font-size:.95rem;font-weight:700;color:#334155;margin:1.5rem 0 .5rem}

    /* Capital bar */
    .cap-bar{display:flex;gap:1rem;margin:.8rem 0 0;align-items:center;flex-wrap:wrap}
    .cap-seg{display:flex;align-items:center;gap:.4rem;font-size:.8rem;color:#475569}
    .cap-dot{width:10px;height:10px;border-radius:3px}
    .cap-strip{width:100%;height:8px;border-radius:4px;background:#e2e8f0;overflow:hidden;display:flex;margin-top:.3rem}
    .cap-strip div{height:100%}

    /* Mode tabs */
    .mtabs{display:flex;gap:0;border-radius:12px;overflow:hidden;margin:1.5rem 0;border:1px solid #e2e8f0}
    .mtab{flex:1;padding:.8rem 1rem;text-align:center;cursor:pointer;font-weight:700;font-size:.85rem;transition:all .2s;border:none;background:#fff;color:#64748b;display:flex;flex-direction:column;align-items:center;gap:.2rem}
    .mtab:hover{background:#f8fafc}
    .mtab.active{color:#fff}
    .mtab[data-m="growth"].active{background:#059669}
    .mtab[data-m="calmar"].active{background:#2563eb}
    .mtab[data-m="zero"].active{background:#7c3aed}
    .mtab .mtab-ret{font-size:1.1rem;font-weight:900}
    .mp{display:none;animation:fadeUp .25s ease}
    .mp.active{display:block}
    @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}

    /* KPI strip */
    .kstrip{display:grid;grid-template-columns:repeat(7,1fr);gap:.5rem;margin:1rem 0}
    .k{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:.6rem .4rem;text-align:center}
    .kv{display:block;font-size:1.1rem;font-weight:800;color:#0f172a;line-height:1.2}
    .kv.neg{color:#dc2626}
    .kl{display:block;font-size:.6rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.3px;margin-top:.15rem}

    /* Two col layout */
    .two-col{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin:1rem 0}
    .cfg-card,.how-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:1.2rem}
    .cfg-card h4,.how-card h4{font-size:.9rem;font-weight:700;color:#334155;margin:0 0 .8rem}
    .cfg-row{display:flex;justify-content:space-between;padding:.35rem 0;border-bottom:1px solid #f8fafc;font-size:.82rem;color:#64748b}
    .cfg-row strong{color:#0f172a}
    .how-card{border-left:3px solid}
    .how-card ol{margin:0;padding-left:1.1rem;font-size:.82rem;color:#475569;line-height:1.7}
    .how-card li{margin-bottom:.2rem}

    /* Disclaimer */
    .disc{background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:1rem;font-size:.8rem;color:#991b1b;margin-top:1.5rem}

    @media(max-width:700px){
      .kstrip{grid-template-columns:repeat(4,1fr)}
      .two-col{grid-template-columns:1fr}
      .mtab{font-size:.75rem;padding:.6rem .5rem}
      .tbl{font-size:.75rem}
      .tbl th,.tbl td{padding:.4rem .5rem}
    }
  </style>
</head>
<body>
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-T5Z595CW" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>

<nav class="brand-bar">
  <div class="brand-bar-inner">
    <a href="/" class="brand-logo"><img src="/logo.svg" alt="" width="36" height="36"><span class="brand-title">MarketWatch</span></a>
    <div class="brand-nav">
      <a href="/?tab=weekly">Hebdo</a><a href="/?tab=daily">Daily</a><a href="/?tab=analyses">Analyses</a><a href="/?tab=scanner">Scanner</a><a href="/?tab=radar">Radar</a><a href="/?tab=series">S&eacute;ries</a>
    </div>
    <div class="brand-actions"><a href="/" class="brand-home-btn" title="Accueil"><i class="fas fa-house"></i></a></div>
  </div>
</nav>

<div class="wrap">

  <div class="hero">
    <h1>Scanner Status</h1>
    <p class="sub">Signaux du jour, positions en cours, 3 modes optimis&eacute;s (${totalCombos} backtests)</p>
    <span class="ts"><i class="fas fa-clock"></i> ${updatedAt}</span>
  </div>

  <!-- ═══ SIGNAUX DU JOUR ═══ -->
  ${signals.length ? `
  <div class="sh">
    <h2><i class="fas fa-bolt" style="color:#f59e0b"></i> Signaux du jour</h2>
    <span class="badge" style="background:#f59e0b">${signals.length} setups</span>
    <a href="/scanner/${scanDir}/">Voir scan complet &rarr;</a>
  </div>
  <div class="tbl-wrap">
  <table class="tbl">
    <thead><tr><th>#</th><th>Ticker</th><th>Score</th><th>Strat.</th><th>Entry</th><th>Stop</th><th>TP1</th><th>TP2</th><th>R/R</th></tr></thead>
    <tbody>${sigRows}</tbody>
  </table>
  </div>` : ''}

  <!-- ═══ 3 MODES ═══ -->
  <div class="sh">
    <h2><i class="fas fa-sliders" style="color:#7c3aed"></i> Modes de trading</h2>
  </div>

  <div class="mtabs">
    <button class="mtab active" data-m="growth" onclick="sw('growth')"><i class="fas fa-rocket"></i><span>Growth</span><span class="mtab-ret">+${g.ret}%</span></button>
    <button class="mtab" data-m="calmar" onclick="sw('calmar')"><i class="fas fa-shield-halved"></i><span>Risk-Adj.</span><span class="mtab-ret">+${ca.ret}%</span></button>
    <button class="mtab" data-m="zero" onclick="sw('zero')"><i class="fas fa-gem"></i><span>Conserv.</span><span class="mtab-ret">+${z.ret}%</span></button>
  </div>

  ${modePanel('growth', modes.growth.cfg, g, modes.growth.trades, gEC, 'cG', true)}
  ${modePanel('calmar', modes.calmar.cfg, ca, modes.calmar.trades, caEC, 'cC', false)}
  ${modePanel('zero', modes.zero.cfg, z, modes.zero.trades, zEC, 'cZ', false)}

  <div class="disc">
    <strong><i class="fas fa-triangle-exclamation"></i></strong>
    Performances pass&eacute;es ≠ r&eacute;sultats futurs. Usage &eacute;ducatif. Frais, slippage, impact de march&eacute; non mod&eacute;lis&eacute;s.
  </div>

</div>

<footer class="article-footer">
  &copy; 2026 Market Watch. Donn&eacute;es via Yahoo Finance.
  Ceci n'est pas un conseil financier.
  <br><a href="/" title="Accueil"><i class="fas fa-house"></i></a>
</footer>

<script src="/assets/core.js"></script>
<script src="/assets/tag-renderer.js"></script>
<script>
function sw(m){
  document.querySelectorAll('.mtab').forEach(function(t){t.classList.remove('active')});
  document.querySelectorAll('.mp').forEach(function(p){p.classList.remove('active')});
  document.querySelector('[data-m="'+m+'"]').classList.add('active');
  document.getElementById('p-'+m).classList.add('active');
  setTimeout(function(){window.dispatchEvent(new Event('resize'))},100);
}
document.addEventListener('DOMContentLoaded',function(){
  var dk='#334155',gc='#f1f5f9';
  function mkChart(el,dates,vals,color){
    if(!document.getElementById(el))return null;
    var c=echarts.init(document.getElementById(el));
    c.setOption({tooltip:{trigger:'axis',formatter:function(p){return p[0].name+'<br/><strong>'+p[0].value.toFixed(2)+'</strong>'}},xAxis:{type:'category',data:dates,axisLine:{lineStyle:{color:gc}},axisLabel:{color:'#94a3b8',fontSize:10}},yAxis:{type:'value',min:Math.floor(Math.min.apply(null,vals))-1,axisLine:{show:false},splitLine:{lineStyle:{color:gc}},axisLabel:{color:'#94a3b8'}},series:[{data:vals,type:'line',smooth:true,symbol:'none',lineStyle:{color:color,width:2.5},areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:color+'33'},{offset:1,color:color+'05'}])}}],grid:{left:45,right:15,top:15,bottom:25}});
    return c;
  }
  var charts=[
    mkChart('cG',${JSON.stringify(gEC.dates)},${JSON.stringify(gEC.values)},'#059669'),
    mkChart('cC',${JSON.stringify(caEC.dates)},${JSON.stringify(caEC.values)},'#2563eb'),
    mkChart('cZ',${JSON.stringify(zEC.dates)},${JSON.stringify(zEC.values)},'#7c3aed')
  ];
  window.addEventListener('resize',function(){charts.forEach(function(c){if(c)c.resize()})});
});
</script>
</body>
</html>`;

  fs.writeFileSync(OUT, html);
  console.log(`✅ ${OUT} generated (${(html.length / 1024).toFixed(0)}KB)`);
  console.log(`   Growth: +${g.ret}%, DD ${g.dd}%, WR ${g.wr}%, PF ${g.pf}x, ${g.trades} trades`);
  console.log(`   Calmar: +${ca.ret}%, DD ${ca.dd}%, WR ${ca.wr}%, PF ${ca.pf}x, ${ca.trades} trades`);
  console.log(`   Conservative: +${z.ret}%, DD ${z.dd}%, WR ${z.wr}%, PF ${z.pf}x, ${z.trades} trades`);
}

main();
