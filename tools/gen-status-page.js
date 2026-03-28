#!/usr/bin/env node
/**
 * gen-status-page.js — Scanner Status dashboard
 *
 * For each mode: equity+stats → signals → positions → method → trades (collapsed)
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
  return { ret, dd: +(-dd).toFixed(2), wr, pf, trades: trades.length, avgHold, equityCurve, wins: wins.length, losses: losses.length };
}

function equityDV(curve) {
  const byDate = {};
  for (const p of curve) { if (p.date) byDate[p.date] = p.value; }
  const dates = Object.keys(byDate).sort();
  return { d: dates.map(d => d.slice(5).replace('-', '/')), v: dates.map(d => byDate[d]) };
}

function main() {
  const config = JSON.parse(fs.readFileSync(MODES_CFG));
  let allTrades = {};
  try { allTrades = JSON.parse(fs.readFileSync(TRADES)); } catch (_) {}
  let results = {};
  try { results = JSON.parse(fs.readFileSync(RESULTS)); } catch (_) {}
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
      const m = html.match(/id="(?:synthese|summary)"[\s\S]{0,15000}/);
      if (m) {
        const rows = m[0].match(/<tr[\s\S]*?<\/tr>/gi) || [];
        for (const row of rows) {
          const cells = (row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [])
            .map(c => c.replace(/<[^>]+>/g, '').replace(/,/g, '.').trim());
          if (cells.length < 4) continue;
          const ticker = cells.find(c => /^[A-Z]{1,5}$/.test(c.trim()));
          if (!ticker) continue;
          const score = cells.map(c => parseFloat(c)).find(n => n >= 70 && n <= 100);
          const stratRaw = cells.find(c => /momentum|squeeze|breakout|pullback|trend follow|defensive yield|defensive|reversal/i.test(c)) || '';
          const pf = cells.filter(c => /^\$[\d.]/.test(c.trim()));
          const rr = cells.find(c => /1:\d/.test(c)) || '';
          signals.push({ ticker: ticker.trim(), score: score || 0, strategy: stratRaw.trim(),
            entry: pf[0] || '—', stop: pf[1] || '—', tp1: pf[2] || '—', tp2: pf[3] || '—', rr });
        }
      }
    }
  } catch (_) {}
  signals.sort((a, b) => b.score - a.score);

  // Modes — mark premature expirations as "pending" (not enough data yet, not real exits)
  const modeMap = { growth: 'growth', calmar: 'calmar', zero: 'sharpe' };
  const modes = {};
  for (const [id, cfg] of Object.entries(config.modes)) {
    const raw = allTrades[modeMap[id] || id] || [];
    // Tag premature expirations but keep them in the dataset
    const trades = raw.map(t => {
      if (t.status === 'expired' && t.holdDays < cfg.horizon) {
        return { ...t, _premature: true };
      }
      return t;
    });
    modes[id] = { cfg, trades, m: computeMetrics(trades, cfg.portfolioSize) };
  }
  const g = modes.growth.m, ca = modes.calmar.m, z = modes.zero.m;
  const gEC = equityDV(g.equityCurve), caEC = equityDV(ca.equityCurve), zEC = equityDV(z.equityCurve);

  const updatedAt = liveMetrics.updated_at
    ? new Date(liveMetrics.updated_at).toLocaleDateString('en-US', { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })
    : new Date().toLocaleDateString('en-US', { day:'numeric', month:'long', year:'numeric' });

  // Filters
  const SF = {
    all: () => true, no_sq: s => !/short.?squeeze/i.test(s),
    momentum_only: s => /momentum/i.test(s), breakout_only: s => /breakout/i.test(s),
    no_sq_pb: s => !/short.?squeeze|pullback/i.test(s),
  };
  function filterLabel(f) { return { all:'All strategies', no_sq:'No Short Squeeze', momentum_only:'Momentum only', breakout_only:'Breakout only', no_sq_pb:'No SQ/PB' }[f] || f; }

  function signalsFor(cfg) {
    const f = SF[cfg.filterName] || (() => true);
    return signals.filter(s => f(s.strategy || '')).filter(s => cfg.minScore <= 0 || s.score >= cfg.minScore).slice(0, cfg.topN);
  }
  // Open positions = pending trades from the backtest (holdDays < horizon)
  // enriched with live prices from scanner-positions.json
  function posFor(cfg, trades) {
    const liveLookup = {};
    for (const p of livePositions) { liveLookup[p.ticker] = p; }

    const pending = trades.filter(t => t._premature);
    return pending.map(t => {
      const live = liveLookup[t.ticker];
      const currentPrice = live ? live.current_price : t.exitPrice;
      const entry = t.actualEntry || 0;
      const ret = entry > 0 ? +((currentPrice - entry) / entry * 100).toFixed(2) : 0;
      const ageD = t.entryDate ? Math.round((new Date() - new Date(t.entryDate)) / 86400000) : 0;
      const left = Math.max(0, cfg.horizon - Math.round(ageD * 5/7));
      return {
        ticker: t.ticker, scan_date: t.scanDate, entry, current_price: currentPrice,
        return_pct: ret, stop: live ? live.stop : 0, tp1: live ? live.tp1 : 0, tp2: live ? live.tp2 : null,
        days_remaining: left, strategy: t.strategy,
      };
    }).sort((a, b) => b.return_pct - a.return_pct);
  }

  // ── Panel builder ──
  function panel(id, cfg, m, trades, ec, chartId, active) {
    const sig = signalsFor(cfg);
    const pos = posFor(cfg, trades);
    const alloc = Math.round(100 / cfg.portfolioSize);
    const totalRet = pos.length ? pos.reduce((s, p) => s + (p.return_pct || 0), 0) / pos.length : 0;

    return `<div class="mp${active ? ' active' : ''}" id="p-${id}">

<!-- ══ PERF + STATS ══ -->
<div class="perf-hero" style="border-left:4px solid ${cfg.color}">
  <div class="perf-chart" id="${chartId}"></div>
  <div class="perf-stats">
    <div class="ps"><span class="ps-v" style="color:${cfg.color}">${m.ret > 0 ? '+' : ''}${m.ret}%</span><span class="ps-l">Return</span></div>
    <div class="ps"><span class="ps-v" style="color:#dc2626">${m.dd}%</span><span class="ps-l">Max DD</span></div>
    <div class="ps"><span class="ps-v">${m.wr}%</span><span class="ps-l">Win Rate</span></div>
    <div class="ps"><span class="ps-v">${m.pf}x</span><span class="ps-l">Profit F.</span></div>
    <div class="ps"><span class="ps-v">${m.trades}</span><span class="ps-l">Trades</span></div>
    <div class="ps"><span class="ps-v">${m.avgHold}d</span><span class="ps-l">Avg Hold</span></div>
  </div>
</div>

<!-- ══ SIGNAUX DU JOUR ══ -->
<div class="section-card">
  <div class="sc-head">
    <h3>Today's Signals</h3>
    ${scanDir ? `<a href="/scanner/${scanDir}/" class="sc-link">Full scan &rarr;</a>` : ''}
  </div>
  ${sig.length ? `<table class="t">
    <thead><tr><th>#</th><th>Ticker</th><th>Score</th><th>Strat.</th><th>Entry</th><th>Stop</th><th>TP1</th><th>TP2</th><th>R/R</th></tr></thead>
    <tbody>${sig.map((s, i) => {
      const bg = s.score >= 90 ? '#059669' : s.score >= 85 ? '#2563eb' : '#f59e0b';
      return `<tr><td class="c">${i+1}</td><td><b>${s.ticker}</b></td><td><span class="pill-score" style="background:${bg}">${s.score}</span></td><td class="m">${s.strategy}</td><td>${s.entry}</td><td class="neg">${s.stop}</td><td class="pos">${s.tp1}</td><td class="pos">${s.tp2}</td><td class="am">${s.rr}</td></tr>`;
    }).join('')}</tbody>
  </table>` : `<p class="empty">No signals for this mode today</p>`}
</div>

<!-- ══ PENDING ORDERS ══ -->
${(() => {
  const openTickers = new Set(pos.map(p => p.ticker));
  const slotsAvailable = Math.max(0, cfg.portfolioSize - pos.length);
  const pendingOrders = sig.filter(s => !openTickers.has(s.ticker)).slice(0, slotsAvailable);
  const alloc = Math.round(100 / cfg.portfolioSize);
  if (!pendingOrders.length) return `<div class="section-card"><div class="sc-head"><h3>⏳ Orders to Place <span class="count">0/${cfg.portfolioSize}</span></h3><span class="sc-meta">Portfolio full — no new orders</span></div></div>`;
  return `<div class="section-card">
  <div class="sc-head">
    <h3>⏳ Orders to Place <span class="count">${pendingOrders.length}/${cfg.portfolioSize}</span></h3>
    <span class="sc-meta">📅 Next open &middot; limit order &middot; ${alloc}%/pos.</span>
  </div>
  ${pendingOrders.length ? `<table class="t">
    <thead><tr><th>#</th><th>Ticker</th><th>Score</th><th>Strat.</th><th>Entry</th><th>Stop</th><th>TP1</th><th>TP2</th><th>R/R</th><th>Alloc</th></tr></thead>
    <tbody>${pendingOrders.map((s, i) => {
      const bg = s.score >= 90 ? '#059669' : s.score >= 85 ? '#2563eb' : '#f59e0b';
      return `<tr><td class="c">${i+1}</td><td><b>${s.ticker}</b></td><td><span class="pill-score" style="background:${bg}">${s.score}</span></td><td class="m">${s.strategy}</td><td><b>${s.entry}</b></td><td class="neg">${s.stop}</td><td class="pos">${s.tp1}</td><td class="pos">${s.tp2}</td><td class="am">${s.rr}</td><td class="m">${alloc}%</td></tr>`;
    }).join('')}</tbody>
  </table>` : ''}
</div>`;
})()}

<!-- ══ POSITIONS EN COURS ══ -->
<div class="section-card">
  <div class="sc-head">
    <h3>Open Positions <span class="count">${pos.length}/${cfg.portfolioSize}</span></h3>
    <span class="sc-meta">P&amp;L moy: <b class="${totalRet >= 0 ? 'pos' : 'neg'}">${totalRet > 0 ? '+' : ''}${totalRet.toFixed(1)}%</b> &middot; ${alloc}%/pos.</span>
  </div>
  ${pos.length ? `
  <div class="pos-bar">${pos.map(p => {
    const c = p.return_pct >= 5 ? '#059669' : p.return_pct >= 0 ? '#3b82f6' : p.return_pct >= -3 ? '#f59e0b' : '#dc2626';
    return `<div style="flex:1;background:${c}" title="${p.ticker} ${p.return_pct > 0 ? '+' : ''}${p.return_pct}%"></div>`;
  }).join('')}</div>
  <table class="t">
    <thead><tr><th>Ticker</th><th>Bought</th><th>Entry $</th><th>Current $</th><th>P&amp;L</th><th>Alloc</th><th>Stop</th><th>TP1</th><th>TP2</th><th>Left</th></tr></thead>
    <tbody>${pos.map(p => {
      const rc = p.return_pct >= 0 ? 'pos' : 'neg';
      // Compute days left based on mode horizon, not the raw 30d expire
      const ageD = p.scan_date ? Math.round((new Date() - new Date(p.scan_date)) / 86400000) : 0;
      const left = Math.max(0, cfg.horizon - Math.round(ageD * 5/7)); // convert calendar to business days approx
      return `<tr><td><b>${p.ticker}</b></td><td class="m">${p.scan_date ? p.scan_date.slice(5) : '—'}</td><td>$${(p.entry||0).toFixed(2)}</td><td>$${(p.current_price||0).toFixed(2)}</td><td class="${rc}"><b>${p.return_pct > 0 ? '+' : ''}${p.return_pct}%</b></td><td class="m">${alloc}%</td><td class="neg">$${(p.stop||0).toFixed(2)}</td><td class="pos">${p.tp1 ? '$'+p.tp1.toFixed(2) : '—'}</td><td class="pos">${p.tp2 ? '$'+p.tp2.toFixed(2) : '—'}</td><td class="m">${left}d</td></tr>`;
    }).join('')}</tbody>
  </table>` : `<p class="empty">No open positions</p>`}
</div>

<!-- ══ METHODE ══ -->
<div class="method-card" style="border-color:${cfg.color}30">
  <h3 style="color:${cfg.color}"><i class="fas fa-book-open"></i> How to trade this mode</h3>
  <div class="method-steps">
    <div class="step"><span class="step-n" style="background:${cfg.color}">1</span><div><b>Every evening</b>, check the signals above. These are the <b>top ${cfg.topN}</b> from today's scan${cfg.filterName !== 'all' ? ', filtered to ' + filterLabel(cfg.filterName) : ''}.</div></div>
    <div class="step"><span class="step-n" style="background:${cfg.color}">2</span><div><b>At market open</b> (3:30 PM Paris / 9:30 AM NY), place a <b>limit order</b> within the entry range. Allocate <b>${alloc}%</b> of capital per position.</div></div>
    <div class="step"><span class="step-n" style="background:${cfg.color}">3</span><div>Set the <b>stop loss</b> and <b>target</b> as indicated. Don't touch anything.</div></div>
    <div class="step"><span class="step-n" style="background:${cfg.color}">4</span><div>The position closes <b>automatically</b> when: target hit, stop triggered, or after <b>${cfg.horizon} days</b>.${cfg.partialTP ? ' If TP1 hit: sell 50%, move stop to breakeven.' : ''}</div></div>
    ${cfg.rotation !== 'none' ? `<div class="step"><span class="step-n" style="background:${cfg.color}">5</span><div><b>Rotation</b>: if a new signal is better than your worst position, replace it.</div></div>` : ''}
  </div>
  <div class="method-footer">${cfg.portfolioSize} positions max &middot; ${cfg.horizon}-day horizon &middot; ${filterLabel(cfg.filterName)}</div>
</div>

<!-- ══ TRADE HISTORY ══ -->
<div class="section-card">
  <div class="sc-head"><h3>Trade History <span class="count">${trades.length}</span></h3></div>
  <table class="t">
    <thead><tr><th>Ticker</th><th>Start</th><th>End</th><th>Entry</th><th>Exit</th><th>P&amp;L</th><th>Hold</th><th>Result</th></tr></thead>
    <tbody>${(() => {
      const sorted = [...trades].sort((a, b) => (b.scanDate || '').localeCompare(a.scanDate || ''));
      // Build replacement map: for rotated trades, find what replaced them
      const replacedBy = {};
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].status === 'rotated') {
          for (let j = i + 1; j < sorted.length; j++) {
            if (sorted[j].entryDate && sorted[i].entryDate) {
              const exitD = new Date(sorted[i].entryDate); exitD.setDate(exitD.getDate() + (sorted[i].holdDays || 0));
              const entryD = new Date(sorted[j].entryDate);
              if (Math.abs(entryD - exitD) <= 2 * 86400000) { replacedBy[sorted[i].ticker + sorted[i].scanDate] = sorted[j].ticker; break; }
            }
          }
        }
      }
      return sorted.map(t => {
        const pnl = t.pnlPct || 0;
        const cls = pnl > 0 ? 'pos' : pnl < 0 ? 'neg' : 'm';
        let exitDate = '—';
        if (t.entryDate && t.holdDays) { const d = new Date(t.entryDate); d.setDate(d.getDate() + t.holdDays); exitDate = d.toISOString().slice(5, 10); }
        let statusLabel, statusCls;
        switch (t.status) {
          case 'tp1': statusLabel = 'Target 1 hit'; statusCls = 'pos'; break;
          case 'tp2': statusLabel = 'Target 2 hit'; statusCls = 'pos'; break;
          case 'tp1_partial': statusLabel = 'TP1 partial (50%)'; statusCls = 'pos'; break;
          case 'sl': statusLabel = 'Stop loss hit'; statusCls = 'neg'; break;
          case 'expired': statusLabel = t._premature ? 'Pending (' + (t.holdDays||0) + 'd/' + cfg.horizon + 'd)' : 'Expired (' + cfg.horizon + 'd limit)'; statusCls = t._premature ? 'pending' : 'am'; break;
          case 'rotated':
            const rep = replacedBy[t.ticker + t.scanDate];
            statusLabel = rep ? 'Replaced by ' + rep : 'Rotated out';
            statusCls = 'm'; break;
          default: statusLabel = t.status || '—'; statusCls = 'm';
        }
        return `<tr><td><b>${t.ticker||'—'}</b></td><td class="m">${t.entryDate ? t.entryDate.slice(5) : '—'}</td><td class="m">${exitDate}</td><td>$${(t.actualEntry||0).toFixed(2)}</td><td>${t.exitPrice ? '$'+t.exitPrice.toFixed(2) : '—'}</td><td class="${cls}"><b>${pnl > 0 ? '+' : ''}${pnl}%</b></td><td class="m">${t.holdDays||0}d</td><td><span class="pill ${statusCls}">${statusLabel}</span></td></tr>`;
      }).join('');
    })()}</tbody>
  </table>
</div>

</div>`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  const html = `<!DOCTYPE html>
<html lang="en" data-tags="technique,formation,trade-idea,us,eu,asia,etf" data-tab="scanner">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scanner Live &mdash; Market Watch</title>
  <meta name="description" content="Today's signals, open positions, performance — 3 optimized trading modes.">
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-T5Z595CW');</script>
  <link rel="stylesheet" href="/assets/report.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
  <style>
*{box-sizing:border-box}
body{background:#f8fafc;font-family:'Inter',sans-serif;color:#0f172a;margin:0}
.w{max-width:1000px;margin:0 auto;padding:0 1rem 3rem}

/* Hero */
.hero{text-align:center;padding:2rem 1rem 1.5rem;border-bottom:1px solid #e2e8f0}
.hero h1{font-size:1.6rem;font-weight:900;margin:0 0 .25rem}
.hero p{color:#64748b;font-size:.9rem;margin:0}
.hero .ts{display:inline-block;margin-top:.6rem;font-size:.72rem;color:#94a3b8;background:#f1f5f9;padding:.2rem .7rem;border-radius:12px}

/* Mode tabs */
.tabs{display:flex;border-radius:10px;overflow:hidden;margin:1.5rem 0;border:1px solid #e2e8f0;background:#fff}
.tab{flex:1;padding:.7rem .5rem;text-align:center;cursor:pointer;font-weight:700;font-size:.82rem;border:none;background:#fff;color:#64748b;transition:all .2s}
.tab:hover{background:#f8fafc}
.tab.active{color:#fff}
.tab[data-m="growth"].active{background:#dc2626}
.tab[data-m="calmar"].active{background:#059669}
.tab[data-m="zero"].active{background:#7c3aed}
.tab .tab-ret{display:block;font-size:1rem;font-weight:900;margin-top:.15rem}
.mp{display:none;animation:fadeUp .2s ease}
.mp.active{display:block}
@keyframes fadeUp{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}

/* Perf hero = chart left + stats right */
.perf-hero{display:flex;gap:1rem;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:1rem;margin-bottom:1.2rem;overflow:hidden}
.perf-chart{flex:1;min-height:200px;min-width:0}
.perf-stats{display:grid;grid-template-columns:1fr 1fr;gap:.4rem .8rem;align-content:center;min-width:180px}
.ps{text-align:center;padding:.35rem .2rem}
.ps-v{display:block;font-size:1.15rem;font-weight:800;color:#0f172a}
.ps-l{font-size:.6rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.3px}

/* Section cards */
.section-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:1rem 1.2rem;margin-bottom:1rem}
.sc-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:.6rem;flex-wrap:wrap;gap:.4rem}
.sc-head h3{font-size:.95rem;font-weight:800;color:#0f172a;margin:0}
.sc-link{font-size:.78rem;color:#3b82f6;text-decoration:none;font-weight:600}
.sc-link:hover{text-decoration:underline}
.sc-meta{font-size:.75rem;color:#94a3b8}
.count{font-size:.75rem;color:#94a3b8;font-weight:500;margin-left:.3rem}

/* Tables */
.t{width:100%;border-collapse:collapse;font-size:.8rem}
.t th{background:#f8fafc;color:#64748b;font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.4px;padding:.45rem .6rem;text-align:left;border-bottom:1px solid #e2e8f0;white-space:nowrap}
.t td{padding:.4rem .6rem;border-bottom:1px solid #f8fafc}
.t tr:hover{background:#fafbfc}
.t .pos{color:#059669;font-weight:600}
.t .neg{color:#dc2626;font-weight:600}
.t .am{color:#d97706;font-weight:600}
.t .m{color:#94a3b8;font-size:.75rem}
.t .c{color:#94a3b8;text-align:center;font-weight:700}
.pill-score{display:inline-block;color:#fff;font-weight:800;font-size:.72rem;padding:.1rem .45rem;border-radius:5px;min-width:26px;text-align:center}
.pill{display:inline-block;font-size:.68rem;font-weight:700;padding:.12rem .4rem;border-radius:5px;background:#f1f5f9;color:#64748b}
.pill.pos{background:#ecfdf5;color:#059669}
.pill.neg{background:#fef2f2;color:#dc2626}
.pill.am{background:#fffbeb;color:#d97706}
.pill.pending{background:#eff6ff;color:#3b82f6;border:1px dashed #93c5fd}
.empty{text-align:center;padding:1.5rem;color:#94a3b8;font-size:.85rem}

/* Position bar */
.pos-bar{display:flex;height:6px;border-radius:3px;overflow:hidden;gap:1px;margin-bottom:.6rem}

/* Method card */
.method-card{background:#fff;border:1px solid #e2e8f0;border-left:4px solid;border-radius:12px;padding:1rem 1.2rem;margin-bottom:1rem}
.method-card h3{font-size:.9rem;font-weight:800;margin:0 0 .8rem;display:flex;align-items:center;gap:.4rem}
.method-steps{display:flex;flex-direction:column;gap:.5rem}
.step{display:flex;align-items:flex-start;gap:.6rem;font-size:.82rem;color:#475569;line-height:1.5}
.step-n{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;color:#fff;font-weight:800;font-size:.7rem;flex-shrink:0;margin-top:1px}
.method-footer{margin-top:.6rem;padding-top:.5rem;border-top:1px solid #f1f5f9;font-size:.72rem;color:#94a3b8}


/* Disclaimer */
.disc{text-align:center;font-size:.72rem;color:#94a3b8;margin-top:1.5rem;padding:1rem;border-top:1px solid #e2e8f0}

@media(max-width:700px){
  .perf-hero{flex-direction:column}
  .perf-stats{grid-template-columns:repeat(3,1fr)}
  .perf-chart{min-height:160px}
  .t{font-size:.72rem}
  .t th,.t td{padding:.35rem .4rem}
  .tab{font-size:.72rem;padding:.5rem .3rem}
}
  </style>
</head>
<body>
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-T5Z595CW" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>

<nav class="brand-bar">
  <div class="brand-bar-inner">
    <a href="/" class="brand-logo"><img src="/logo.svg" alt="" width="36" height="36"><span class="brand-title">MarketWatch</span></a>
    <div class="brand-nav"><a href="/?tab=weekly">Hebdo</a><a href="/?tab=daily">Daily</a><a href="/?tab=analyses">Analyses</a><a href="/?tab=scanner">Scanner</a><a href="/?tab=radar">Radar</a><a href="/?tab=series">S&eacute;ries</a></div>
    <div class="brand-actions"><a href="/" class="brand-home-btn" title="Accueil"><i class="fas fa-house"></i></a></div>
  </div>
</nav>

<div class="w">
  <div class="hero">
    <h1>Scanner Live</h1>
    <p>Pick a mode, see what to buy, track your positions</p>
    <span class="ts"><i class="fas fa-clock"></i> ${updatedAt}</span>
  </div>

  <div class="tabs">
    <button class="tab" data-m="growth" onclick="sw('growth')"><i class="fas fa-rocket"></i> Aggressive<span class="tab-ret">+${g.ret}%</span></button>
    <button class="tab active" data-m="calmar" onclick="sw('calmar')"><i class="fas fa-shield-halved"></i> Balanced<span class="tab-ret">+${ca.ret}%</span></button>
    <button class="tab" data-m="zero" onclick="sw('zero')"><i class="fas fa-gem"></i> Conserv.<span class="tab-ret">+${z.ret}%</span></button>
  </div>

  ${panel('growth', modes.growth.cfg, g, modes.growth.trades, gEC, 'cG', false)}
  ${panel('calmar', modes.calmar.cfg, ca, modes.calmar.trades, caEC, 'cC', true)}
  ${panel('zero', modes.zero.cfg, z, modes.zero.trades, zEC, 'cZ', false)}

  <div class="disc">
    Past performance &ne; future results &middot; Educational only &middot; Not financial advice
  </div>
</div>

<footer class="article-footer">&copy; 2026 Market Watch &middot; <a href="/" title="Home"><i class="fas fa-house"></i></a></footer>

<script src="/assets/core.js"></script>
<script src="/assets/tag-renderer.js"></script>
<script>
function sw(m){
  document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active')});
  document.querySelectorAll('.mp').forEach(function(p){p.classList.remove('active')});
  document.querySelector('[data-m="'+m+'"]').classList.add('active');
  document.getElementById('p-'+m).classList.add('active');
  setTimeout(function(){window.dispatchEvent(new Event('resize'))},100);
}
document.addEventListener('DOMContentLoaded',function(){
  function mk(el,dates,vals,color){
    if(!document.getElementById(el))return null;
    var c=echarts.init(document.getElementById(el));
    c.setOption({tooltip:{trigger:'axis',formatter:function(p){return p[0].name+'<br/><b>'+p[0].value.toFixed(2)+'</b>'}},xAxis:{type:'category',data:dates,axisLine:{lineStyle:{color:'#e2e8f0'}},axisLabel:{color:'#94a3b8',fontSize:10}},yAxis:{type:'value',min:Math.floor(Math.min.apply(null,vals))-1,axisLine:{show:false},splitLine:{lineStyle:{color:'#f1f5f9'}},axisLabel:{color:'#94a3b8',fontSize:10}},series:[{data:vals,type:'line',smooth:true,symbol:'none',lineStyle:{color:color,width:2.5},areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:color+'33'},{offset:1,color:color+'05'}])}}],grid:{left:40,right:10,top:10,bottom:22}});
    return c;
  }
  var ch=[mk('cG',${JSON.stringify(gEC.d)},${JSON.stringify(gEC.v)},'#059669'),mk('cC',${JSON.stringify(caEC.d)},${JSON.stringify(caEC.v)},'#2563eb'),mk('cZ',${JSON.stringify(zEC.d)},${JSON.stringify(zEC.v)},'#7c3aed')];
  window.addEventListener('resize',function(){ch.forEach(function(c){if(c)c.resize()})});
});
</script>
</body>
</html>`;

  fs.writeFileSync(OUT, html);
  console.log(`\u2705 ${OUT} generated (${(html.length / 1024).toFixed(0)}KB)`);
  console.log(`   Growth: +${g.ret}%, DD ${g.dd}%, WR ${g.wr}%, PF ${g.pf}x, ${g.trades} trades`);
  console.log(`   Calmar: +${ca.ret}%, DD ${ca.dd}%, WR ${ca.wr}%, PF ${ca.pf}x, ${ca.trades} trades`);
  console.log(`   Conservative: +${z.ret}%, DD ${z.dd}%, WR ${z.wr}%, PF ${z.pf}x, ${z.trades} trades`);
}

main();
