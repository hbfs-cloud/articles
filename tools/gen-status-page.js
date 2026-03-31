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
  // Sort by approximate exit date to ensure correct path-dependent DD computation
  // Exit ≈ entryDate + holdDays calendar days (good enough for ordering)
  const sorted = [...trades].sort((a, b) => {
    const ea = new Date(a.entryDate || a.scanDate || '2000-01-01').getTime() + (a.holdDays || 0) * 86400000;
    const eb = new Date(b.entryDate || b.scanDate || '2000-01-01').getTime() + (b.holdDays || 0) * 86400000;
    if (ea !== eb) return ea - eb;
    return (a.entryDate || '') < (b.entryDate || '') ? -1 : 1;
  });
  for (const t of sorted) {
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
  // Build thesis map from all recent scanner HTMLs (last 15 dirs)
  const thesisMap = {};
  try {
    const dirs = fs.readdirSync(SCANNER_DIR).filter(d => /^\d{8}(-\d+)?$/.test(d)).sort().reverse();
    scanDir = dirs[0] || '';
    const recentDirs = fs.readdirSync(SCANNER_DIR).filter(d => /^\d{8}(-\d+)?$/.test(d)).sort().reverse().slice(0, 15);
    for (const dir of recentDirs) {
      try {
        const scanHtml = fs.readFileSync(path.join(SCANNER_DIR, dir, 'index.html'), 'utf8');
        const setupBlocks = scanHtml.match(/id="setup-([A-Z]{1,5})"[\s\S]*?(?=id="setup-[A-Z]|id="synthese|id="summary|$)/gi) || [];
        for (const block of setupBlocks) {
          const tm = block.match(/id="setup-([A-Z]{1,5})"/i);
          const thM = block.match(/Investment Thesis<\/h4>\s*<p>([\s\S]*?)<\/p>/i);
          if (tm && thM && !thesisMap[tm[1]]) {
            let thesis = thM[1].replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
            if (thesis.length > 140) {
              thesis = thesis.slice(0, 137).replace(/\s+\S*$/, '') + '…';
            }
            thesisMap[tm[1]] = thesis;
          }
        }
      } catch (_) {}
    }

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
            entry: pf[0] || '—', stop: pf[1] || '—', tp1: pf[2] || '—', tp2: pf[3] || '—', rr,
            thesis: thesisMap[ticker.trim()] || '' });
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
    // Stats computed from CLOSED trades only (non-premature) — matches backfill convention
    const closedTrades = trades.filter(t => !t._premature);
    modes[id] = { cfg, trades, m: computeMetrics(closedTrades, cfg.portfolioSize) };
  }
  const ca = modes.calmar.m;
  const caEC = equityDV(ca.equityCurve);

  const _updSrc = liveMetrics.updated_at || results.generated_at;
  const updatedAt = (() => {
    const d = _updSrc ? new Date(_updSrc) : new Date();
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${days[d.getUTCDay()]} ${hh}:${mm} UTC`;
  })();

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
      // Compute stop: prefer live data > trade's actualStop > mode's maxStopPct fallback
      const maxStopPct = cfg.maxStopPct || 8; // default 8% if not defined
      const fallbackStop = entry > 0 ? +(entry * (1 - maxStopPct / 100)).toFixed(2) : 0;
      const resolvedStop = (live && live.stop > 0) ? live.stop
        : (t.actualStop > 0) ? t.actualStop
        : fallbackStop;
      const resolvedTp1 = (live && live.tp1 > 0) ? live.tp1 : (t.actualTp1 || 0);
      const resolvedTp2 = (live && live.tp2 > 0) ? live.tp2 : (t.actualTp2 || null);
      return {
        ticker: t.ticker, scan_date: t.scanDate, entry, current_price: currentPrice,
        return_pct: ret,
        stop: resolvedStop, tp1: resolvedTp1, tp2: resolvedTp2,
        days_remaining: left, strategy: t.strategy, thesis: thesisMap[t.ticker] || '',
      };
    }).sort((a, b) => b.return_pct - a.return_pct);
  }

  // ── Panel builder ──
  function panel(id, cfg, m, trades, ec, chartId, active) {
    const sig = signalsFor(cfg);
    const pos = posFor(cfg, trades);
    const alloc = Math.round(100 / cfg.portfolioSize);
    const totalRet = pos.length ? pos.reduce((s, p) => s + (p.return_pct || 0), 0) / pos.length : 0;

    // Helper: compute biz days from scan_date
    function bizDaysHeld(scanDate) {
      if (!scanDate) return 0;
      const age = Math.round((Date.now() - new Date(scanDate)) / 86400000);
      return Math.round(age * 5 / 7);
    }

    // Timed-out positions: left <= 0 (horizon expired)
    const timedOut = pos.filter(p => {
      const left = Math.max(0, cfg.horizon - bizDaysHeld(p.scan_date));
      return left <= 0;
    });
    // Expiring soon: left == 1 (expire next trading day)
    const expiringSoon = pos.filter(p => {
      const left = Math.max(0, cfg.horizon - bizDaysHeld(p.scan_date));
      return left === 1;
    });

    return `<div id="p-${id}">

<!-- ══ 1. HOW TO TRADE (method — collapsed by default) ══ -->
<div class="section-card">
  <details>
    <summary class="sc-summary">
      <span class="sc-sum-title"><i class="fas fa-book-open" style="color:${cfg.color};font-size:.78rem"></i> How to trade this mode</span>
    </summary>
    <div class="method-steps" style="margin-top:.85rem">
      <div class="step" style="background:${cfg.color}08;border:1px solid ${cfg.color}20;border-radius:8px;padding:.65rem .9rem">
        <span class="step-n" style="background:${cfg.color}"><i class="fas fa-star" style="font-size:.5rem"></i></span>
        <div><b>Starting today?</b> Follow the new signals from tonight's scan — you'll hold the <b>same positions as the system within ${cfg.horizon} trading days</b> (&#8776;&nbsp;${Math.ceil(cfg.horizon * 1.4)} calendar days). Until then, skip positions you don't hold and focus only on open slots.</div>
      </div>
      <div class="step"><span class="step-n" style="background:${cfg.color}">1</span><div><b>Every evening</b>, check the signals below. These are the <b>top ${cfg.topN}</b> from today's scan${cfg.filterName !== 'all' ? ', filtered to ' + filterLabel(cfg.filterName) : ''}.</div></div>
      <div class="step"><span class="step-n" style="background:${cfg.color}">2</span><div><b>At market open</b> (3:30&thinsp;PM Paris / 9:30&thinsp;AM NY), place a <b>limit order</b> within the entry range. Allocate <b>${alloc}%</b> of capital per position.</div></div>
      <div class="step"><span class="step-n" style="background:${cfg.color}">3</span><div>Set the <b>stop loss</b> and <b>take profit</b> as indicated. Don't touch anything.</div></div>
      <div class="step"><span class="step-n" style="background:${cfg.color}">4</span><div>Close when: <b>TP hit</b>, <b>stop triggered</b>, or after <b>${cfg.horizon} trading days</b> — whichever comes first.${cfg.partialTP ? ' If TP1 hit: sell 50%, move stop to breakeven.' : ''}</div></div>
      ${cfg.rotation !== 'none' ? `<div class="step"><span class="step-n" style="background:${cfg.color}">5</span><div><b>Rotation</b>: if a new signal scores higher than your weakest position (score &#8805; 88 vs return &lt; 2%), replace it.</div></div>` : ''}
    </div>
    <div class="method-footer">
      <span><i class="fas fa-layer-group"></i> ${cfg.portfolioSize} positions max</span>
      <span><i class="fas fa-calendar-days"></i> ${cfg.horizon}-day horizon</span>
      <span><i class="fas fa-filter"></i> ${filterLabel(cfg.filterName)}</span>
    </div>
  </details>
</div>

<!-- ══ 2. TODAY'S SIGNALS (context — collapsible) ══ -->
<div class="section-card">
  <details>
    <summary class="sc-summary">
      <span class="sc-sum-title"><i class="fas fa-signal" style="color:#94a3b8;font-size:.78rem"></i> Today's Signals <span class="count">${sig.length} setups</span></span>
      ${scanDir ? `<a href="/scanner/${scanDir}/" class="sc-link" onclick="event.stopPropagation()">Full scan <i class="fas fa-arrow-right" style="font-size:.6rem"></i></a>` : ''}
    </summary>
    ${sig.length ? `<table class="t" style="margin-top:.75rem">
      <thead><tr><th>Ticker</th><th>Score</th><th>Setup</th><th>Entry</th><th>Stop</th><th>TP1/TP2</th><th>R/R</th></tr></thead>
      <tbody>${sig.map((s, i) => {
        const bg = s.score >= 90 ? '#059669' : s.score >= 85 ? '#2563eb' : '#f59e0b';
        return `<tr><td><b>${s.ticker}</b></td><td><span class="pill-score" style="background:${bg}">${s.score}</span></td><td class="m">${s.strategy}</td><td>${s.entry}</td><td class="neg">${s.stop}</td><td class="pos">${s.tp1} / ${s.tp2}</td><td class="am">${s.rr}</td></tr>`;
      }).join('')}</tbody>
    </table>` : `<p class="empty"><i class="fas fa-inbox"></i>No signals for this mode today</p>`}
  </details>
</div>

<!-- ══ 3. PERF + STATS (equity curve) ══ -->
<div class="perf-hero" style="border-left:3px solid ${cfg.color}">
  <div class="perf-chart-wrap">
    <div class="perf-hero-left">
      <span class="perf-hero-label"><i class="fas fa-chart-line" style="color:${cfg.color};margin-right:.3rem"></i>Equity Curve</span>
    </div>
    <div class="perf-chart" id="${chartId}"></div>
  </div>
  <div class="perf-stats">
    <div class="ps"><span class="ps-v" style="color:${cfg.color}">${m.ret > 0 ? '+' : ''}${m.ret}%</span><span class="ps-l">Total Return</span></div>
    <div class="ps"><span class="ps-v" style="color:#dc2626">${m.dd}%</span><span class="ps-l">Max Drawdown</span></div>
    <div class="ps"><span class="ps-v">${m.wr}%</span><span class="ps-l">Win Rate</span></div>
    <div class="ps"><span class="ps-v">${m.pf}x</span><span class="ps-l">Profit Factor</span></div>
    <div class="ps"><span class="ps-v">${m.trades - trades.filter(t=>t._premature).length}</span><span class="ps-l">Closed Trades</span></div>
    <div class="ps"><span class="ps-v">${m.avgHold}d</span><span class="ps-l">Avg Hold</span></div>
  </div>
</div>

<!-- ══ 4. CLOSE NOW ══ -->
${timedOut.length ? `<div class="cta-card cta-close">
  <div class="cta-header">
    <span class="cta-icon"><i class="fas fa-ban"></i></span>
    <div>
      <h3>Close Now <span class="cta-badge">${timedOut.length} position${timedOut.length > 1 ? 's' : ''}</span></h3>
      <p class="cta-sub">Horizon expired — exit at market open, regardless of P&amp;L</p>
    </div>
  </div>
  <table class="t">
    <thead><tr><th>Ticker</th><th>Bought</th><th class="hide-m">Entry $</th><th class="hide-m">Current $</th><th>P&amp;L</th><th>Held</th><th>Action</th></tr></thead>
    <tbody>${timedOut.map(p => {
      const rc = p.return_pct >= 0 ? 'pos' : 'neg';
      const held = bizDaysHeld(p.scan_date);
      return `<tr><td><b>${p.ticker}</b></td><td class="m">${p.scan_date ? p.scan_date.slice(5) : '—'}</td><td class="hide-m">$${(p.entry||0).toFixed(2)}</td><td class="hide-m">$${(p.current_price||0).toFixed(2)}</td><td class="${rc}"><b>${p.return_pct > 0 ? '+' : ''}${p.return_pct}%</b></td><td class="am">${held}d / ${cfg.horizon}d</td><td><span class="pill neg" style="font-size:.7rem;padding:.15rem .5rem">CLOSE</span></td></tr>`;
    }).join('')}</tbody>
  </table>
</div>` : ''}

<!-- ══ 5. ORDERS CTA ══ -->
${(() => {
  const alloc = Math.round(100 / cfg.portfolioSize);
  const openTickers = new Set(pos.map(p => p.ticker));
  const sigFiltered = sig.filter(s => !openTickers.has(s.ticker));
  const slotsAvailable = Math.max(0, cfg.portfolioSize - pos.length);

  // BUY orders: signals that fit into available slots (max = free slots)
  const buyOrders = sigFiltered.slice(0, slotsAvailable);

  // ROTATION candidates (only for rotation=aggressive modes, when portfolio full):
  const rotationCandidates = [];
  if (cfg.rotation === 'aggressive' && slotsAvailable === 0 && pos.length > 0 && sigFiltered.length > 0) {
    const worstPos = [...pos].sort((a, b) => a.return_pct - b.return_pct)[0];
    for (const s of sigFiltered.slice(0, 5)) {
      if (s.score >= 88 && worstPos.return_pct < 2) {
        rotationCandidates.push({ signal: s, replaces: worstPos });
        break;
      }
    }
  }

  // WATCH: signals that could not be placed and don't qualify for rotation.
  // Only shown if portfolio is full and there are remaining signals worth monitoring.
  const scanDateStr = scanDir ? `${scanDir.slice(0,4)}-${scanDir.slice(4,6)}-${scanDir.slice(6,8)}` : null;
  const scanAge = scanDateStr ? Math.round((Date.now() - new Date(scanDateStr)) / 86400000) : 0;
  const timeoutDays = 2;
  function addBizDays(dateStr, n) {
    const d = new Date(dateStr + 'T12:00:00Z');
    let added = 0;
    while (added < n) { d.setDate(d.getDate() + 1); const dow = d.getUTCDay(); if (dow !== 0 && dow !== 6) added++; }
    return d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', timeZone:'UTC' });
  }
  const expiryLabel = scanDateStr ? addBizDays(scanDateStr, timeoutDays) : '—';
  const isExpired = scanAge > timeoutDays;

  // Watch = overflow signals when portfolio is full and no rotation triggered
  const watchPool = slotsAvailable === 0
    ? sigFiltered.filter(s => !rotationCandidates.some(r => r.signal.ticker === s.ticker)).slice(0, 3)
    : [];

  // ── Render: BUY + ROTATE as primary CTA ──
  const actionRows = [];
  for (let i = 0; i < buyOrders.length; i++) {
    const s = buyOrders[i];
    const bg = s.score >= 90 ? '#059669' : s.score >= 85 ? '#2563eb' : '#f59e0b';
    const thesisCols = 10; // number of columns in Orders table
    actionRows.push(`<tr>
      <td><b>${s.ticker}</b></td>
      <td class="hide-m"><img src="https://charts2.finviz.com/chart.ashx?t=${s.ticker}&ty=c&ta=1&p=d&s=l" alt="${s.ticker}" class="fv-thumb" onclick="fvOpen('${s.ticker}')"></td>
      <td class="hide-m"><span class="pill-score" style="background:${bg}">${s.score}</span></td>
      <td class="m hide-m">${s.strategy}</td><td><b>${s.entry}</b></td>
      <td class="neg">${s.stop}</td>
      <td class="pos">${s.tp1}<span class="hide-m"> / ${s.tp2}</span></td>
      <td class="am hide-m">${s.rr}</td><td class="m hide-m">${alloc}%</td>
      <td class="hide-m"><span class="pill pos">BUY</span></td>
    </tr>${s.thesis ? `<tr class="thesis-row"><td colspan="${thesisCols}"><div class="thesis-text">${s.thesis}</div></td></tr>` : ''}`);
  }
  for (const { signal: s, replaces } of rotationCandidates) {
    const bg = s.score >= 90 ? '#059669' : s.score >= 85 ? '#2563eb' : '#f59e0b';
    actionRows.push(`<tr style="background:#fefce8">
      <td><b>${s.ticker}</b></td>
      <td class="hide-m"><img src="https://charts2.finviz.com/chart.ashx?t=${s.ticker}&ty=c&ta=1&p=d&s=l" alt="${s.ticker}" class="fv-thumb" onclick="fvOpen('${s.ticker}')"></td>
      <td class="hide-m"><span class="pill-score" style="background:${bg}">${s.score}</span></td>
      <td class="m hide-m">${s.strategy}</td><td><b>${s.entry}</b></td>
      <td class="neg">${s.stop}</td>
      <td class="pos">${s.tp1}<span class="hide-m"> / ${s.tp2}</span></td>
      <td class="am hide-m">${s.rr}</td><td class="m hide-m">${alloc}%</td>
      <td class="hide-m"><span class="pill am">ROTATE ↔ ${replaces.ticker}</span></td>
    </tr>${s.thesis ? `<tr class="thesis-row"><td colspan="${thesisCols}"><div class="thesis-text">${s.thesis}</div></td></tr>` : ''}`);
  }

  // ── Render: WATCH as secondary collapsible ──
  const watchRows = watchPool.map(s => {
    const expiredLabel = isExpired ? 'Expired' : `Valid until ${expiryLabel}`;
    const expiredCls = isExpired ? 'neg' : 'm';
    return `<tr style="opacity:${isExpired ? '0.45' : '0.75'}">
      <td><b>${s.ticker}</b></td>
      <td><span class="pill-score" style="background:#94a3b8">${s.score}</span></td>
      <td class="m hide-m">${s.strategy}</td><td class="m">${s.entry}</td>
      <td class="neg">${s.stop}</td>
      <td class="pos">${s.tp1}<span class="hide-m"> / ${s.tp2}</span></td>
      <td class="am hide-m">${s.rr}</td>
      <td><span class="pill ${expiredCls}">${expiredLabel}</span></td>
    </tr>`;
  });

  const totalActions = actionRows.length;
  const occupied = pos.length;
  const statusLine = slotsAvailable > 0
    ? `${occupied}/${cfg.portfolioSize} open — <b>${slotsAvailable} slot${slotsAvailable > 1 ? 's' : ''} free</b> — place at next open`
    : `${occupied}/${cfg.portfolioSize} open — portfolio full${rotationCandidates.length ? ' — rotation opportunity' : ''}`;

  if (totalActions === 0 && watchPool.length === 0) {
    return `<div class="section-card"><div class="sc-head"><h3><i class="fas fa-inbox"></i> Orders</h3><span class="sc-meta">Portfolio full &mdash; no action needed</span></div><p class="empty"><i class="fas fa-check-circle"></i>All slots filled, nothing to place</p></div>`;
  }

  return `
${expiringSoon.length ? `<div class="cta-card" style="background:#fffbeb;border:1.5px solid #fde68a;border-left:4px solid #f59e0b">
  <div class="cta-header">
    <span class="cta-icon" style="background:rgba(245,158,11,.12)"><i class="fas fa-hourglass-half" style="color:#d97706"></i></span>
    <div>
      <h3 style="color:#92400e">Expires Tomorrow <span class="cta-badge" style="background:#d97706">${expiringSoon.length} position${expiringSoon.length > 1 ? 's' : ''}</span></h3>
      <p class="cta-sub" style="color:#b45309">Horizon reached at next close — decide: keep or exit at open</p>
    </div>
  </div>
  <table class="t">
    <thead><tr><th>Ticker</th><th>Entry</th><th>P&amp;L</th><th>Stop</th><th>Held</th></tr></thead>
    <tbody>${expiringSoon.map(p => {
      const rc = p.return_pct >= 0 ? 'pos' : 'neg';
      const held = bizDaysHeld(p.scan_date);
      return `<tr><td><b>${p.ticker}</b></td><td>$${(p.entry||0).toFixed(2)}</td><td class="${rc}"><b>${p.return_pct > 0 ? '+' : ''}${p.return_pct}%</b></td><td class="neg">$${(p.stop||0).toFixed(2)}</td><td class="am">${held}d/${cfg.horizon}d</td></tr>`;
    }).join('')}</tbody>
  </table>
</div>` : ''}

<div class="section-card ${totalActions > 0 ? 'cta-orders' : ''}">
  <div class="sc-head">
    <h3>${totalActions > 0 ? '<i class="fas fa-bolt"></i>' : '<i class="fas fa-eye"></i>'} ${totalActions > 0 ? `${totalActions} Order${totalActions > 1 ? 's' : ''} to Place` : 'On Watch'}</h3>
    <span class="sc-meta">${statusLine}</span>
  </div>
  ${totalActions > 0 ? `<table class="t">
    <thead><tr><th>Ticker</th><th class="hide-m">Chart</th><th class="hide-m">Score</th><th class="hide-m">Strat.</th><th>Entry</th><th>Stop</th><th>TP1/TP2</th><th class="hide-m">R/R</th><th class="hide-m">Alloc</th><th class="hide-m">Action</th></tr></thead>
    <tbody>${actionRows.join('')}</tbody>
  </table>` : ''}
  ${watchRows.length ? `<details${totalActions > 0 ? '' : ' open'}>
    <summary class="watch-summary">On watch — ${watchRows.length} signal${watchRows.length > 1 ? 's' : ''} (portfolio full, valid until ${expiryLabel})</summary>
    <table class="t" style="margin-top:.5rem">
      <thead><tr><th>Ticker</th><th>Score</th><th class="hide-m">Strat.</th><th>Entry</th><th>Stop</th><th>TP1/TP2</th><th class="hide-m">R/R</th><th>Status</th></tr></thead>
      <tbody>${watchRows.join('')}</tbody>
    </table>
  </details>` : ''}
</div>`;
})()}

<!-- ══ 6. OPEN POSITIONS (all — expired flagged) ══ -->
<div class="section-card">
  <div class="sc-head">
    <h3><i class="fas fa-folder-open"></i> Open Positions <span class="count">${pos.length}/${cfg.portfolioSize}</span></h3>
    ${pos.length ? `<span class="sc-meta">avg P&amp;L: <b class="${totalRet >= 0 ? 'pos' : 'neg'}">${totalRet > 0 ? '+' : ''}${totalRet.toFixed(1)}%</b></span>` : ''}
  </div>
  ${pos.length ? `
  ${(() => {
    // Scenario bar: worst (all SL) → current → best (all TP2)
    // Each position contributes alloc% of portfolio
    // alloc = 100/portfolioSize (e.g. 5% for 20 slots)
    const a = alloc / 100; // weight per position
    const worstPct = pos.reduce((s, p) => {
      // Skip positions with no stop (stop=0) — treat as no downside for scenario
      if (!p.stop || p.stop <= 0) return s;
      const slPct = p.entry > 0 ? (p.stop - p.entry) / p.entry * 100 : 0;
      // Cap individual SL at -20% per position (protect against bad data)
      const capped = Math.max(slPct, -20);
      return s + capped * a;
    }, 0);
    const bestPct = pos.reduce((s, p) => {
      const tp = p.tp2 || p.tp1 || p.current_price;
      const tp2Pct = (p.entry > 0 && tp > 0) ? (tp - p.entry) / p.entry * 100 : 0;
      return s + tp2Pct * a;
    }, 0);
    const nowPct = pos.reduce((s, p) => s + (p.return_pct || 0) * a, 0);

    // Progress bar: worst is left anchor, best is right anchor, now is the cursor
    const range = bestPct - worstPct;
    const nowPos = range > 0 ? Math.max(0, Math.min(100, (nowPct - worstPct) / range * 100)) : 50;

    const worstCls = worstPct < 0 ? 'neg' : 'pos';
    const nowCls = nowPct >= 0 ? 'pos' : 'neg';
    const bestCls = 'pos';

    // Fill color: red zone (left of now) to green zone (right of now)
    const barW = nowPos.toFixed(1);

    return `<div class="scenario-bar-wrap">
  <div class="scenario-labels">
    <span class="${worstCls}"><i class="fas fa-shield-halved"></i> Worst: ${worstPct > 0 ? '+' : ''}${worstPct.toFixed(1)}%</span>
    <span class="${nowCls}"><i class="fas fa-circle-dot"></i> Now: ${nowPct > 0 ? '+' : ''}${nowPct.toFixed(1)}%</span>
    <span class="${bestCls}"><i class="fas fa-bullseye"></i> Best: +${bestPct.toFixed(1)}%</span>
  </div>
  <div class="scenario-bar">
    <div class="scenario-fill-bad" style="width:${barW}%"></div>
    <div class="scenario-fill-good" style="width:${(100 - parseFloat(barW)).toFixed(1)}%"></div>
    <div class="scenario-cursor" style="left:${barW}%"></div>
  </div>
</div>`;
  })()}
  <table class="t">
    <thead><tr><th>Ticker</th><th class="hide-m">Chart</th><th class="hide-m">Bought</th><th class="hide-m">Entry</th><th class="hide-m">Now</th><th>P&amp;L</th><th class="hide-m">Stop</th><th class="hide-m">TP2</th><th>Left</th></tr></thead>
    <tbody>${pos.map(p => {
      const rc = p.return_pct >= 0 ? 'pos' : 'neg';
      const left = Math.max(0, cfg.horizon - bizDaysHeld(p.scan_date));
      const isExpired = left <= 0;
      const leftCls = isExpired ? 'neg' : left <= 1 ? 'neg' : left <= 2 ? 'am' : 'm';
      const leftLabel = isExpired ? '<span class="pill neg" style="font-size:.65rem;padding:.1rem .4rem">EXPIRED</span>' : left + 'd';
      const rowStyle = isExpired ? ' style="opacity:.6;background:#fef2f2"' : '';
      const posCols = 9; // columns in Open Positions table
      return `<tr${rowStyle}><td><b>${p.ticker}</b></td><td class="hide-m"><img src="https://charts2.finviz.com/chart.ashx?t=${p.ticker}&ty=c&ta=1&p=d&s=l" alt="${p.ticker}" class="fv-thumb" onclick="fvOpen('${p.ticker}')"></td><td class="m hide-m">${p.scan_date ? p.scan_date.slice(5) : '—'}</td><td class="hide-m">$${(p.entry||0).toFixed(2)}</td><td class="hide-m">$${(p.current_price||0).toFixed(2)}</td><td class="${rc}"><b>${p.return_pct > 0 ? '+' : ''}${p.return_pct}%</b></td><td class="neg hide-m">$${(p.stop||0).toFixed(2)}</td><td class="pos hide-m">${p.tp2 ? '$'+p.tp2.toFixed(2) : (p.tp1 ? '$'+p.tp1.toFixed(2) : '—')}</td><td class="${leftCls}">${leftLabel}</td></tr>${p.thesis ? `<tr class="thesis-row"${rowStyle}><td colspan="${posCols}"><div class="thesis-text">${p.thesis}</div></td></tr>` : ''}`;
    }).join('')}</tbody>
  </table>` : `<p class="empty"><i class="fas fa-inbox"></i>No active positions</p>`}
</div>

<!-- ══ 7. TRADE HISTORY (collapsible) ══ -->
<div class="section-card">
  <details>
    <summary class="sc-summary"><span class="sc-sum-title"><i class="fas fa-clock-rotate-left" style="color:#94a3b8;font-size:.78rem"></i> Trade History <span class="count">${trades.filter(t=>!t._premature).length} closed</span></span></summary>
  <table class="t" style="margin-top:.6rem">
    <thead><tr><th>Ticker</th><th class="hide-m">Start</th><th class="hide-m">End</th><th class="hide-m">Entry</th><th class="hide-m">Exit</th><th>P&amp;L</th><th class="hide-m">Hold</th><th>Result</th></tr></thead>
    <tbody>${(() => {
      const sorted = [...trades].sort((a, b) => (b.scanDate || '').localeCompare(a.scanDate || ''));
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
        if (t.exitDate) { exitDate = t.exitDate.slice(5, 10); }
        else if (t.entryDate && t.holdDays) { const d = new Date(t.entryDate); d.setDate(d.getDate() + t.holdDays); exitDate = d.toISOString().slice(5, 10); }
        let statusLabel, statusShort, statusCls;
        switch (t.status) {
          case 'tp1': statusLabel = 'Target 1 hit'; statusShort = 'TP1 ✓'; statusCls = 'pos'; break;
          case 'tp2': statusLabel = 'Target 2 hit'; statusShort = 'TP2 ✓'; statusCls = 'pos'; break;
          case 'tp1_partial': statusLabel = 'TP1 partial (50%)'; statusShort = 'TP1 ½'; statusCls = 'pos'; break;
          case 'sl': statusLabel = 'Stop loss hit'; statusShort = 'SL ✗'; statusCls = 'neg'; break;
          case 'expired': statusLabel = t._premature ? 'Pending (' + (t.holdDays||0) + 'd/' + cfg.horizon + 'd)' : 'Expired'; statusShort = statusLabel; statusCls = t._premature ? 'pending' : 'am'; break;
          case 'rotated': { const rep = replacedBy[t.ticker + t.scanDate]; statusLabel = rep ? 'Replaced by ' + rep : 'Rotated out'; statusShort = rep ? '↔ '+rep : 'Rotated'; statusCls = 'm'; break; }
          default: statusLabel = t.status || '—'; statusShort = statusLabel; statusCls = 'm';
        }
        return `<tr>
          <td><b>${t.ticker||'—'}</b></td>
          <td class="m hide-m">${t.entryDate ? t.entryDate.slice(5) : '—'}</td>
          <td class="m hide-m">${exitDate}</td>
          <td class="hide-m">$${(t.actualEntry||0).toFixed(2)}</td>
          <td class="hide-m">${t.exitPrice ? '$'+t.exitPrice.toFixed(2) : '—'}</td>
          <td class="${cls}"><b>${pnl > 0 ? '+' : ''}${pnl}%</b></td>
          <td class="m hide-m">${t.holdDays||0}d</td>
          <td><span class="pill ${statusCls}" title="${statusLabel}">${statusShort}</span></td>
        </tr>`;
      }).join('');
    })()}</tbody>
  </table>
  </details>
</div>

</div>`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  const html = `<!DOCTYPE html>
<html lang="en" data-tags="technique,formation,trade-idea,us,eu,asia,etf" data-tab="scanner">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Portfolio Live &mdash; Market Watch</title>
  <meta name="description" content="Today's signals, open positions &amp; live performance — Balanced trading mode updated every weekday.">
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-T5Z595CW');</script>
  <link rel="stylesheet" href="/assets/report.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
  <style>
*{box-sizing:border-box}
body{background:#f8fafc;font-family:'Inter',sans-serif;color:#0f172a;margin:0}
.w{max-width:1080px;margin:0 auto;padding:0 1.5rem 4rem}

/* ── Hero ── */
.hero{padding:2.5rem 1.5rem 2rem;border-bottom:1px solid #e2e8f0;position:relative}
.hero-inner{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap}
.hero-left{flex:1;min-width:0}
.hero h1{font-size:1.85rem;font-weight:900;margin:0 0 .5rem;display:flex;align-items:center;gap:.55rem}
.hero h1 .live-dot{width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 0 3px rgba(16,185,129,.18);flex-shrink:0;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{box-shadow:0 0 0 3px rgba(16,185,129,.18)}50%{box-shadow:0 0 0 6px rgba(16,185,129,.06)}}
.hero p{color:#64748b;font-size:.95rem;margin:0}
.hero-meta{display:flex;align-items:center;gap:.75rem;margin-top:.85rem;flex-wrap:wrap}
.hero .ts{display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;color:#64748b;background:#f1f5f9;padding:.25rem .75rem;border-radius:20px;font-weight:500}
.hero .ts i{color:#94a3b8;font-size:.68rem}
/* Time Machine trigger in hero */
.tm-hero-btn{display:none;align-items:center;gap:.4rem;padding:.25rem .75rem;border-radius:20px;border:1px solid #e2e8f0;background:#fff;color:#475569;font-size:.72rem;font-weight:600;cursor:pointer;transition:all .2s;font-family:inherit}
.tm-hero-btn i{font-size:.68rem}
.tm-hero-btn:hover{background:#f1f5f9;color:#0f172a;border-color:#cbd5e1}
.tm-hero-btn.viewing{color:#f59e0b;border-color:#f59e0b20;background:#fffbeb}

/* ── Perf hero = chart left + stats right ── */
.perf-hero{display:flex;gap:1.75rem;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:1.6rem;margin-bottom:1.5rem;overflow:hidden}
.perf-hero-left{display:flex;align-items:center;gap:.5rem;margin-bottom:.6rem}
.perf-hero-label{font-size:.72rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em}
.perf-chart-wrap{flex:1;min-width:0;display:flex;flex-direction:column}
.perf-chart{flex:1;min-height:230px}
.perf-stats{display:grid;grid-template-columns:1fr 1fr;gap:.7rem .85rem;align-content:center;min-width:195px}
.ps{text-align:center;padding:.65rem .5rem;border-radius:10px;background:#f8fafc}
.ps-v{display:block;font-size:1.35rem;font-weight:800;color:#0f172a;line-height:1.2}
.ps-l{display:block;font-size:.62rem;color:#64748b;text-transform:uppercase;letter-spacing:.4px;margin-top:.25rem;font-weight:600}

/* ── Section cards ── */
.section-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:1.4rem 1.6rem;margin-bottom:1.35rem}
.sc-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:.5rem}
.sc-head h3{font-size:1rem;font-weight:800;color:#0f172a;margin:0;display:flex;align-items:center;gap:.45rem}
.sc-head h3 i{font-size:.78rem;color:#94a3b8}
.sc-link{font-size:.78rem;color:#3b82f6;text-decoration:none;font-weight:600;display:inline-flex;align-items:center;gap:.25rem}
.sc-link:hover{text-decoration:underline}
.sc-meta{font-size:.75rem;color:#64748b}
.count{font-size:.73rem;color:#94a3b8;font-weight:500;margin-left:.35rem;background:#f1f5f9;padding:.05rem .4rem;border-radius:10px}

/* ── Tables ── */
.t{width:100%;border-collapse:collapse;font-size:.84rem}
.t th{background:#f8fafc;color:#64748b;font-size:.66rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:.65rem .85rem;text-align:left;border-bottom:2px solid #e2e8f0;white-space:nowrap}
.t td{padding:.6rem .85rem;border-bottom:1px solid #f1f5f9;vertical-align:middle}
.t tr:last-child td{border-bottom:none}
.t tr:hover td{background:#fafbfc}
.t .pos{color:#059669;font-weight:600}
.t .neg{color:#dc2626;font-weight:600}
.t .am{color:#d97706;font-weight:600}
.t .m{color:#64748b;font-size:.75rem}
.t .c{color:#94a3b8;text-align:center;font-weight:700}
.pill-score{display:inline-block;color:#fff;font-weight:800;font-size:.72rem;padding:.15rem .5rem;border-radius:5px;min-width:30px;text-align:center;letter-spacing:.01em}
.pill{display:inline-block;font-size:.68rem;font-weight:700;padding:.15rem .45rem;border-radius:5px;background:#f1f5f9;color:#64748b;white-space:nowrap}
.pill.pos{background:#ecfdf5;color:#059669}
.pill.neg{background:#fef2f2;color:#dc2626}
.pill.am{background:#fffbeb;color:#d97706}
.pill.m{background:#f1f5f9;color:#475569}
.pill.pending{background:#eff6ff;color:#3b82f6;border:1px dashed #93c5fd}
.empty{text-align:center;padding:2rem 1rem;color:#94a3b8;font-size:.85rem;display:flex;flex-direction:column;align-items:center;gap:.4rem}
.empty i{font-size:1.4rem;opacity:.4}
@media(max-width:600px){
  .t{table-layout:auto;word-break:break-word}
  .t th,.t td{white-space:normal;padding:.35rem .45rem;font-size:.72rem}
}

/* ── Scenario bar ── */
.scenario-bar-wrap{margin-bottom:1.25rem;padding:1rem 1.25rem;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0}
.scenario-labels{display:flex;justify-content:space-between;font-size:.72rem;margin-bottom:.5rem;gap:.3rem;font-weight:600}
.scenario-bar{position:relative;height:8px;border-radius:4px;overflow:visible;display:flex;background:#e2e8f0;margin-bottom:.15rem}
.scenario-fill-bad{background:linear-gradient(90deg,#dc2626,#f59e0b);border-radius:4px 0 0 4px;transition:width .3s}
.scenario-fill-good{background:linear-gradient(90deg,#f59e0b,#059669);border-radius:0 4px 4px 0;transition:width .3s}
.scenario-cursor{position:absolute;top:-4px;width:4px;height:16px;background:#0f172a;border-radius:2px;transform:translateX(-50%);box-shadow:0 0 0 2px #fff,0 1px 4px rgba(0,0,0,.2)}

/* ── Method card ── */
.method-card{background:#fff;border:1px solid #e2e8f0;border-left:3px solid;border-radius:12px;padding:1rem 1.2rem;margin-bottom:1rem}
.method-card h3{font-size:.88rem;font-weight:800;margin:0 0 .85rem;display:flex;align-items:center;gap:.45rem}
.method-steps{display:flex;flex-direction:column;gap:.75rem}
.step{display:flex;align-items:flex-start;gap:.75rem;font-size:.86rem;color:#475569;line-height:1.6}
.step-n{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;color:#fff;font-weight:800;font-size:.68rem;flex-shrink:0;margin-top:1px}
.method-footer{margin-top:.7rem;padding-top:.55rem;border-top:1px solid #f1f5f9;font-size:.7rem;color:#94a3b8;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}
.method-footer span{display:inline-flex;align-items:center;gap:.25rem}
.method-footer i{font-size:.6rem}

/* ── CTA cards ── */
.cta-card{border-radius:14px;padding:1.4rem 1.6rem;margin-bottom:1.35rem;border:2px solid}
.cta-close{background:#fef2f2;border-color:#fca5a5}
.cta-orders{background:#f0fdf4;border:1.5px solid #bbf7d0;border-left:4px solid #059669}
.cta-header{display:flex;align-items:flex-start;gap:.85rem;margin-bottom:.85rem}
.cta-icon{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;font-size:1.1rem;flex-shrink:0;background:rgba(220,38,38,.1)}
.cta-close .cta-icon{background:rgba(220,38,38,.1)}
.cta-orders .cta-icon{background:rgba(5,150,105,.1)}
.cta-header h3{font-size:.95rem;font-weight:800;color:#dc2626;margin:0 0 .2rem}
.cta-orders .cta-header h3{color:#065f46}
.cta-badge{display:inline-block;background:#dc2626;color:#fff;font-size:.65rem;font-weight:800;padding:.1rem .45rem;border-radius:4px;margin-left:.4rem;vertical-align:middle}
.cta-orders .cta-badge{background:#059669}
.cta-sub{font-size:.78rem;color:#b91c1c;margin:0}
.cta-orders .cta-sub{color:#047857}

/* ── Collapsible details ── */
details{margin-top:.2rem}
details summary{cursor:pointer;font-size:.85rem;font-weight:600;color:#475569;padding:.45rem 0;user-select:none;list-style:none;display:flex;align-items:center;justify-content:space-between}
details summary::-webkit-details-marker{display:none}
details summary::after{content:"\\f054";font-family:"Font Awesome 6 Free";font-weight:900;font-size:.55rem;color:#94a3b8;flex-shrink:0;margin-left:.5rem;transition:transform .2s}
details[open] summary::after{transform:rotate(90deg)}
.sc-summary{display:flex;align-items:center;justify-content:space-between;gap:.5rem;font-size:.9rem;font-weight:800;color:#0f172a;padding:.1rem 0}
.sc-sum-title{display:flex;align-items:center;gap:.35rem}
.watch-summary{color:#64748b;font-weight:600;font-size:.78rem}

/* ── Responsive ── */
@media(max-width:700px){
  .perf-hero{flex-direction:column;gap:1rem}
  .perf-stats{grid-template-columns:repeat(3,1fr)}
  .perf-chart{min-height:180px}
  .t{font-size:.72rem}
  .t th,.t td{padding:.35rem .4rem}
  .hero-inner{flex-direction:column;align-items:flex-start}
}
@media(max-width:600px){
  .t .hide-m{display:none}
  .perf-stats{grid-template-columns:repeat(3,1fr)}
  .w{padding:0 .75rem 2rem}
}

/* ── Thesis subtitle row ── */
.thesis-row td{padding:.25rem .85rem .5rem!important;border-bottom:1px solid #f1f5f9!important;background:transparent!important}
.thesis-row:hover td{background:transparent!important}
.thesis-text{font-size:.72rem;color:#64748b;line-height:1.45;font-style:italic;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}

/* ── Finviz thumbnails ── */
.fv-thumb{width:110px;height:62px;border-radius:6px;border:1px solid #e2e8f0;cursor:pointer;object-fit:cover;transition:transform .15s,box-shadow .15s;background:#f8fafc}
.fv-thumb:hover{transform:scale(1.08);box-shadow:0 2px 8px rgba(0,0,0,.12);border-color:#94a3b8}
/* ── Finviz fullscreen dialog ── */
.fv-dialog{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.7);backdrop-filter:blur(4px);opacity:0;visibility:hidden;transition:opacity .2s,visibility .2s}
.fv-dialog.open{opacity:1;visibility:visible}
.fv-dialog-inner{position:relative;max-width:min(960px,94vw);max-height:92vh;background:#fff;border-radius:14px;padding:1rem;box-shadow:0 24px 64px rgba(0,0,0,.25)}
.fv-dialog-inner img{width:100%;height:auto;border-radius:8px;display:block}
.fv-dialog-ticker{font-size:.85rem;font-weight:800;color:#0f172a;margin-bottom:.5rem;display:flex;align-items:center;gap:.4rem}
.fv-dialog-ticker a{font-size:.72rem;font-weight:600;color:#3b82f6;text-decoration:none}
.fv-dialog-ticker a:hover{text-decoration:underline}
.fv-dialog-close{position:absolute;top:.6rem;right:.75rem;width:30px;height:30px;border-radius:50%;border:none;background:#f1f5f9;color:#64748b;font-size:.85rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s}
.fv-dialog-close:hover{background:#e2e8f0;color:#0f172a}

/* ── Disclaimer ── */
.disc{text-align:center;font-size:.7rem;color:#94a3b8;margin-top:2rem;padding:1.25rem 1rem;border-top:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center;gap:.4rem;flex-wrap:wrap}
.disc i{font-size:.68rem;opacity:.6}

/* ── Time Machine floating trigger (FAB) ── */
.tm-btn-header{display:none;align-items:center;gap:.35rem;padding:.3rem .7rem;background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;border-radius:8px;font-size:.7rem;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s;vertical-align:middle;margin-left:.5rem}
.tm-btn-header i{font-size:.7rem}
.tm-btn-header:hover{background:#e2e8f0;color:#0f172a;border-color:#cbd5e1}
.tm-btn-header.viewing{background:#fffbeb;color:#b45309;border-color:#f59e0b}
.tm-btn-header.viewing i{animation:spin 2s linear infinite}
@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@media(max-width:400px){.tm-btn-header{padding:.25rem .5rem;font-size:.65rem}}

/* ── Time Machine panel ── */
.tm-panel{position:fixed;top:7rem;right:1.75rem;z-index:999;width:310px;background:#0f172a;border:1px solid rgba(255,255,255,.1);border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.04);padding:0;display:none;flex-direction:column;overflow:hidden}
.tm-panel.open{display:flex;animation:tmSlideIn .18s ease forwards}
@keyframes tmSlideIn{from{opacity:0;transform:translateY(-10px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
.tm-panel-head{display:flex;align-items:center;justify-content:space-between;padding:.9rem 1rem .75rem;border-bottom:1px solid rgba(255,255,255,.07)}
.tm-panel-title{font-size:.7rem;font-weight:700;color:#cbd5e1;display:flex;align-items:center;gap:.45rem;text-transform:uppercase;letter-spacing:.1em}
.tm-panel-title i{color:#3b82f6;font-size:.8rem}
.tm-panel-close{border:none;background:rgba(255,255,255,.06);color:#94a3b8;cursor:pointer;font-size:.75rem;padding:.3rem .4rem;line-height:1;border-radius:5px;transition:all .15s}
.tm-panel-close:hover{background:rgba(255,255,255,.1);color:#e2e8f0}
/* Date display */
.tm-date-display{padding:.9rem 1rem .55rem;text-align:center}
.tm-date-display .date-val{font-size:1.1rem;font-weight:700;color:#f1f5f9;letter-spacing:.02em;font-variant-numeric:tabular-nums}
.tm-date-display .live-badge{display:inline-flex;align-items:center;gap:.25rem;background:rgba(16,185,129,.15);color:#10b981;font-size:.58rem;padding:.18rem .5rem;border-radius:4px;margin-left:.4rem;vertical-align:middle;text-transform:uppercase;letter-spacing:.08em;font-weight:700;border:1px solid rgba(16,185,129,.25)}
.tm-date-display .live-badge::before{content:'';width:5px;height:5px;border-radius:50%;background:#10b981;box-shadow:0 0 5px #10b981;flex-shrink:0}
.tm-date-display .hist-badge{display:inline-block;background:rgba(245,158,11,.12);color:#f59e0b;font-size:.58rem;padding:.18rem .5rem;border-radius:4px;margin-left:.4rem;vertical-align:middle;text-transform:uppercase;letter-spacing:.08em;font-weight:700;border:1px solid rgba(245,158,11,.2)}
/* Slider */
.tm-slider-row{display:flex;align-items:center;gap:.65rem;padding:.3rem 1rem}
.tm-slider{flex:1;-webkit-appearance:none;appearance:none;height:4px;background:rgba(255,255,255,.12);border-radius:2px;cursor:pointer;outline:none}
.tm-slider::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.25);cursor:pointer;transition:box-shadow .15s}
.tm-slider::-webkit-slider-thumb:hover{box-shadow:0 0 0 5px rgba(59,130,246,.3)}
.tm-slider::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:#3b82f6;border:none;cursor:pointer}
.tm-btn{border:none;background:rgba(255,255,255,.07);border-radius:6px;padding:.35rem .5rem;cursor:pointer;color:#64748b;font-size:.72rem;line-height:1;transition:background .15s,color .15s;flex-shrink:0}
.tm-btn:hover{background:rgba(255,255,255,.12);color:#cbd5e1}
.tm-btn:disabled{opacity:.25;cursor:not-allowed}
.tm-range-labels{display:flex;justify-content:space-between;padding:.1rem 1rem .8rem;font-size:.6rem;color:#475569;font-weight:600;font-variant-numeric:tabular-nums}
/* Live button */
.tm-live-btn{border:none;background:rgba(16,185,129,.12);color:#10b981;border-bottom-left-radius:16px;border-bottom-right-radius:16px;padding:.75rem 1rem;font-size:.73rem;font-weight:700;cursor:pointer;width:100%;display:none;align-items:center;justify-content:center;gap:.45rem;letter-spacing:.02em;border-top:1px solid rgba(16,185,129,.15);transition:background .15s;font-family:inherit}
.tm-live-btn:hover{background:rgba(16,185,129,.22)}
.tm-live-btn.show{display:flex}
/* Banner */
.tm-banner{display:none;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:.65rem 1rem;margin-bottom:1rem;font-size:.8rem;color:#92400e;text-align:center}
.tm-banner.show{display:flex;align-items:center;justify-content:center;gap:.5rem}
.tm-banner i{font-size:.85rem;color:#f59e0b;flex-shrink:0}
.tm-banner a{color:#b45309;font-weight:700;cursor:pointer;text-decoration:none;margin-left:.3rem}
.tm-banner a:hover{text-decoration:underline}
@media(max-width:400px){.tm-panel{width:calc(100vw - 2rem);right:1rem}.tm-fab{right:1rem}}

/* ── Community CTA ── */
.community-cta{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:2.25rem 1rem;margin-top:0}
.community-inner{max-width:860px;margin:0 auto;display:flex;align-items:center;gap:2rem;flex-wrap:wrap}
.community-text{flex:1;min-width:220px;color:#e2e8f0}
.community-text h3{font-size:1.15rem;font-weight:800;margin:0 0 .4rem;color:#fff}
.community-text p{font-size:.86rem;color:#94a3b8;margin:0;line-height:1.55}
.community-links{display:flex;gap:.75rem;flex-wrap:wrap}
.cta-btn{display:flex;align-items:center;gap:.7rem;padding:.75rem 1.2rem;border-radius:10px;text-decoration:none;transition:opacity .15s,transform .15s;min-width:200px}
.cta-btn:hover{opacity:.92;transform:translateY(-1px)}
.cta-btn i{font-size:1.5rem;flex-shrink:0}
.cta-btn span{display:flex;flex-direction:column;gap:1px}
.cta-btn strong{font-size:.9rem;font-weight:700;line-height:1.2}
.cta-btn small{font-size:.72rem;opacity:.75;line-height:1.2}
.tg-btn{background:#229ED9;color:#fff}
.yt-btn{background:#1e293b;color:#fff;border:1px solid #334155}
.dc-btn{background:#5865F2;color:#fff}
@media(max-width:600px){.community-inner{flex-direction:column;align-items:flex-start}.cta-btn{min-width:unset;width:100%}}
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
    <div class="hero-inner">
      <div class="hero-left">
        <h1><span class="live-dot"></span>Portfolio Live <button class="tm-btn-header" id="tmFab" onclick="tmToggle()" title="Time Machine"><i class="fas fa-clock-rotate-left"></i> Time Machine</button></h1>
        <p>Signals, open positions &amp; performance &mdash; updated every weekday</p>
        <div class="hero-meta">
          <span class="ts"><i class="fas fa-clock-rotate-left"></i> ${updatedAt}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="tm-banner" id="tmBanner"></div>

  ${panel('calmar', modes.calmar.cfg, ca, modes.calmar.trades, caEC, 'cC', true)}

  <div class="disc">
    <i class="fas fa-circle-info"></i>
    Past performance &ne; future results &nbsp;&middot;&nbsp; Educational only &nbsp;&middot;&nbsp; Not financial advice
  </div>
</div>

<div class="community-cta">
  <div class="community-inner">
    <div class="community-text">
      <h3>Stay in the loop</h3>
      <p>New scan every weekday evening. Follow the signals, track positions, and learn systematic trading — all free.</p>
    </div>
    <div class="community-links">
      <a href="https://t.me/+gl06cNSLV2RiZmE0" target="_blank" rel="noopener" class="cta-btn tg-btn">
        <i class="fab fa-telegram"></i>
        <span>
          <strong>Join on Telegram</strong>
          <small>Daily News · Portfolio Live · Learning</small>
        </span>
      </a>
      <a href="https://www.youtube.com/@marketwatchxyz" target="_blank" rel="noopener" class="cta-btn yt-btn">
        <i class="fab fa-youtube"></i>
        <span>
          <strong>Watch on YouTube</strong>
          <small>Daily Briefing · Weekly Review · Analysis</small>
        </span>
      </a>
    </div>
  </div>
</div>

<footer class="article-footer">
  &copy; 2026 Market Watch &middot;
  <a href="/" title="Home"><i class="fas fa-house"></i></a>
  &nbsp;&middot;&nbsp;
  <a href="https://t.me/+gl06cNSLV2RiZmE0" target="_blank" rel="noopener" style="color:#229ED9"><i class="fab fa-telegram"></i> Telegram</a>
  &nbsp;&middot;&nbsp;
  <a href="https://www.youtube.com/@marketwatchxyz" target="_blank" rel="noopener" style="color:#94a3b8"><i class="fab fa-youtube"></i> YouTube</a>
</footer>

<!-- Finviz fullscreen dialog -->
<div class="fv-dialog" id="fvDialog" onclick="if(event.target===this)fvClose()">
  <div class="fv-dialog-inner">
    <button class="fv-dialog-close" onclick="fvClose()"><i class="fas fa-xmark"></i></button>
    <div class="fv-dialog-ticker"><span id="fvTicker"></span><a id="fvLink" href="#" target="_blank">Open on Finviz <i class="fas fa-arrow-up-right-from-square" style="font-size:.6rem"></i></a></div>
    <img id="fvImg" src="" alt="">
  </div>
</div>
<script>
function fvOpen(ticker){
  var d=document.getElementById('fvDialog');
  document.getElementById('fvTicker').textContent=ticker;
  document.getElementById('fvImg').src='https://charts2.finviz.com/chart.ashx?t='+ticker+'&ty=c&ta=1&p=d&s=l';
  document.getElementById('fvLink').href='https://finviz.com/quote.ashx?t='+ticker;
  d.classList.add('open');
  document.body.style.overflow='hidden';
}
function fvClose(){
  document.getElementById('fvDialog').classList.remove('open');
  document.body.style.overflow='';
}
document.addEventListener('keydown',function(e){if(e.key==='Escape')fvClose()});
</script>

<script src="/assets/core.js"></script>
<script src="/assets/tag-renderer.js"></script>
<script>
document.addEventListener('DOMContentLoaded',function(){
  function mk(el,dates,vals,color){
    if(!document.getElementById(el))return null;
    var c=echarts.init(document.getElementById(el));
    c.setOption({tooltip:{trigger:'axis',formatter:function(p){return p[0].name+'<br/><b>'+p[0].value.toFixed(2)+'</b>'}},xAxis:{type:'category',data:dates,axisLine:{lineStyle:{color:'#e2e8f0'}},axisLabel:{color:'#94a3b8',fontSize:10}},yAxis:{type:'value',min:Math.floor(Math.min.apply(null,vals))-1,axisLine:{show:false},splitLine:{lineStyle:{color:'#f1f5f9'}},axisLabel:{color:'#94a3b8',fontSize:10}},series:[{data:vals,type:'line',smooth:true,symbol:'none',lineStyle:{color:color,width:2.5},areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:color+'33'},{offset:1,color:color+'05'}])}}],grid:{left:40,right:10,top:10,bottom:22}});
    return c;
  }
  var ch=[mk('cC',${JSON.stringify(caEC.d)},${JSON.stringify(caEC.v)},'#2563eb')];
  window.addEventListener('resize',function(){ch.forEach(function(c){if(c)c.resize()})});

  // ── Time Machine (FAB + slider panel) ──
  var tmDates=[], tmCurrentIdx=0;
  function tmInit(){
    fetch('/scanner/status/history/dates.json').then(function(r){return r.json()}).then(function(dates){
      tmDates=dates;if(dates.length<1)return;
      var fab=document.getElementById('tmFab');
      if(fab)fab.style.display='flex';
      var slider=document.getElementById('timeSlider');
      slider.max=dates.length-1;
      slider.value=dates.length-1;
      tmCurrentIdx=dates.length-1;
      tmUpdateLabel();
      // Range labels
      var fmt=function(d){return d.slice(4,6)+'/'+d.slice(6,8)};
      document.getElementById('tmFirstDate').textContent=fmt(dates[0]);
      document.getElementById('tmLastDate').textContent=fmt(dates[dates.length-1]);
      slider.addEventListener('input',function(){
        tmCurrentIdx=parseInt(this.value);
        tmUpdateLabel();
        tmLoadIdx(tmCurrentIdx);
      });
    }).catch(function(){});
  }
  // Exposed globally so inline onclick handlers can reach them
  window.tmToggle=function(){
    var p=document.getElementById('tmPanel');
    var isOpen=p.classList.contains('open');
    p.classList.toggle('open');
    // Keep FAB highlighted while panel is open
    var fab=document.getElementById('tmFab');
    if(fab){
      if(!isOpen)fab.style.boxShadow='0 0 0 3px rgba(59,130,246,.35)';
      else fab.style.boxShadow='';
    }
  };
  // Close panel when clicking outside
  document.addEventListener('click',function(e){
    var p=document.getElementById('tmPanel');
    var fab=document.getElementById('tmFab');
    if(p&&p.classList.contains('open')&&!p.contains(e.target)&&fab&&!fab.contains(e.target)){
      p.classList.remove('open');
      fab.style.boxShadow='';
    }
  });
  function tmUpdateLabel(){
    var el=document.getElementById('tmDateLabel');
    var d=tmDates[tmCurrentIdx];
    var formatted=d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6,8);
    var isLive=tmCurrentIdx===tmDates.length-1;
    if(isLive){
      el.innerHTML='<span class="date-val">'+formatted+'<span class="live-badge">live</span></span>';
      document.getElementById('tmLiveBtn').className='tm-live-btn';
      document.getElementById('tmFab').classList.remove('viewing');
    }else{
      el.innerHTML='<span class="date-val">'+formatted+'<span class="hist-badge">snapshot</span></span>';
      document.getElementById('tmLiveBtn').className='tm-live-btn show';
      document.getElementById('tmFab').classList.add('viewing');
    }
    // Update nav button states
    var btnPrev=document.getElementById('tmBtnPrev'),btnNext=document.getElementById('tmBtnNext');
    if(btnPrev)btnPrev.disabled=tmCurrentIdx===0;
    if(btnNext)btnNext.disabled=tmCurrentIdx===tmDates.length-1;
  }
  window.tmNav=function(dir){
    var newIdx=tmCurrentIdx+dir;
    if(newIdx<0||newIdx>=tmDates.length)return;
    tmCurrentIdx=newIdx;
    document.getElementById('timeSlider').value=tmCurrentIdx;
    tmUpdateLabel();
    tmLoadIdx(tmCurrentIdx);
  };
  // Save original live content on first TM use
  var tmLiveHTML=null;
  function tmSaveLive(){
    if(tmLiveHTML!==null)return;
    var panel=document.getElementById('p-calmar');
    if(panel)tmLiveHTML=panel.innerHTML;
  }
  function tmRestoreLive(){
    var panel=document.getElementById('p-calmar');
    if(panel&&tmLiveHTML!==null){
      panel.innerHTML=tmLiveHTML;
      // Re-init ECharts (innerHTML destroys instances)
      var chartEl=document.getElementById('cC');
      if(chartEl){
        // Dispose any stale instance on the new DOM element
        var old=echarts.getInstanceByDom(chartEl);
        if(old)old.dispose();
        ch[0]=mk('cC',${JSON.stringify(caEC.d)},${JSON.stringify(caEC.v)},'#2563eb');
      }
    }
    document.getElementById('tmBanner').className='tm-banner';
    var fab=document.getElementById('tmFab');
    if(fab){fab.classList.remove('viewing');fab.style.boxShadow='';}
  }
  function tmLoadIdx(idx){
    var banner=document.getElementById('tmBanner');
    if(idx===tmDates.length-1){
      tmRestoreLive();
      return;
    }
    tmSaveLive();
    var dateStr=tmDates[idx];
    fetch('/scanner/status/history/'+dateStr+'.json').then(function(r){return r.json()}).then(function(snap){
      banner.className='tm-banner show';
      var formatted=dateStr.slice(0,4)+'-'+dateStr.slice(4,6)+'-'+dateStr.slice(6,8);
      banner.innerHTML='<i class="fas fa-clock-rotate-left"></i> Viewing snapshot from <b>'+formatted+'</b> &mdash; <a onclick="window.tmGoLive()">Back to live</a>';
      tmRender(snap);
    }).catch(function(){
      banner.className='tm-banner show';
      banner.innerHTML='<i class="fas fa-triangle-exclamation"></i> Snapshot not available for '+dateStr;
    });
  }
  window.tmGoLive=function(){
    tmCurrentIdx=tmDates.length-1;
    document.getElementById('timeSlider').value=tmCurrentIdx;
    tmUpdateLabel();
    document.getElementById('tmPanel').classList.remove('open');
    tmRestoreLive();
  };
  function tmRender(snap){
    var id='calmar';
    var d=snap.modes[id];
    if(!d)return;
    (function(){
      var panel=document.getElementById('p-'+id);
      if(!panel)return;
      // Freeze panel height to prevent layout shift during DOM updates
      panel.style.minHeight=panel.offsetHeight+'px';
      panel.style.opacity='0.6';
      panel.style.transition='opacity .15s';
      var cfg=d.config||{};
      // Update stats
      var stats=panel.querySelectorAll('.ps-v');
      if(stats.length>=6){
        stats[0].textContent=(d.stats.ret>0?'+':'')+d.stats.ret+'%';
        stats[1].textContent=d.stats.dd+'%';
        stats[2].textContent=d.stats.wr+'%';
        stats[3].textContent=d.stats.pf+'x';
        stats[4].textContent=d.stats.trades;
        stats[5].textContent=d.stats.avgHold+'d';
      }
      // Update equity chart
      var chartId='cC';
      var chartEl=document.getElementById(chartId);
      if(chartEl){
        var c=echarts.getInstanceByDom(chartEl);
        if(d.equity&&d.equity.d&&d.equity.d.length>0){
          chartEl.parentElement.style.display='';
          var minV=Math.min.apply(null,d.equity.v);
          if(c)c.setOption({xAxis:{data:d.equity.d},yAxis:{min:Math.floor(minV)-1},series:[{data:d.equity.v}]});
        }else{
          chartEl.parentElement.style.display='none';
        }
      }
      // Hide all live sections (section-card, cta-card, method-card)
      var allSections=panel.querySelectorAll('.section-card, .cta-card, .method-card');
      allSections.forEach(function(s){s.style.display='none'});
      // Remove old tm-injected sections
      panel.querySelectorAll('[data-tm]').forEach(function(el){el.remove()});
      // Find insertion point (after perf-hero)
      var perfHero=panel.querySelector('.perf-hero');
      var insertAfter=perfHero||panel.firstElementChild;

      // Helper: insert after a reference node
      function tmInsertAfter(newEl,ref){
        if(ref.nextSibling)ref.parentNode.insertBefore(newEl,ref.nextSibling);
        else ref.parentNode.appendChild(newEl);
        return newEl;
      }

      // ══ CLOSE NOW (cta-card cta-close) ══
      if(d.closeNow&&d.closeNow.length>0){
        var cn=document.createElement('div');
        cn.className='cta-card cta-close';cn.setAttribute('data-tm','1');
        var cnh='<div class="cta-header"><span class="cta-icon"><i class="fas fa-ban"></i></span><div>'
          +'<h3>Close Now <span class="cta-badge">'+d.closeNow.length+' position'+(d.closeNow.length>1?'s':'')+'</span></h3>'
          +'<p class="cta-sub">Horizon expired — exit at market open, regardless of P&amp;L</p>'
          +'</div></div>'
          +'<table class="t"><thead><tr><th>Ticker</th><th>Bought</th><th class="hide-m">Entry $</th><th class="hide-m">Current $</th><th>P&amp;L</th><th>Held</th><th>Action</th></tr></thead><tbody>';
        d.closeNow.forEach(function(p){
          var rc=p.return_pct>=0?'pos':'neg';
          var heldStr=(p.days_held||cfg.horizon||'?')+'d / '+(p.horizon||cfg.horizon||'?')+'d';
          cnh+='<tr><td><b>'+p.ticker+'</b></td><td class="m">'+(p.scan_date?p.scan_date.slice(5):'—')+'</td><td class="hide-m">$'+(p.entry||0).toFixed(2)+'</td><td class="hide-m">$'+(p.current_price||0).toFixed(2)+'</td><td class="'+rc+'"><b>'+(p.return_pct>0?'+':'')+p.return_pct+'%</b></td><td class="am">'+heldStr+'</td><td><span class="pill neg" style="font-size:.7rem;padding:.15rem .5rem">CLOSE</span></td></tr>';
        });
        cnh+='</tbody></table>';
        cn.innerHTML=cnh;
        insertAfter=tmInsertAfter(cn,insertAfter);
      }

      // ══ EXPIRES TOMORROW (cta-card yellow) ══
      if(d.expiresTomorrow&&d.expiresTomorrow.length>0){
        var et=document.createElement('div');
        et.className='cta-card';et.setAttribute('data-tm','1');
        et.setAttribute('style','background:#fffbeb;border:2px solid #fcd34d');
        var eth='<div class="cta-header"><span class="cta-icon" style="background:rgba(245,158,11,.12)"><i class="fas fa-hourglass-half" style="color:#d97706"></i></span><div>'
          +'<h3 style="color:#92400e">Expires Tomorrow <span class="cta-badge" style="background:#d97706">'+d.expiresTomorrow.length+' position'+(d.expiresTomorrow.length>1?'s':'')+'</span></h3>'
          +'<p class="cta-sub" style="color:#b45309">Horizon reached at next close — decide: keep or exit at open</p>'
          +'</div></div>'
          +'<table class="t"><thead><tr><th>Ticker</th><th>Entry</th><th>P&amp;L</th><th>Stop</th><th>Held</th></tr></thead><tbody>';
        d.expiresTomorrow.forEach(function(p){
          var rc=p.return_pct>=0?'pos':'neg';
          eth+='<tr><td><b>'+p.ticker+'</b></td><td>$'+(p.entry||0).toFixed(2)+'</td><td class="'+rc+'"><b>'+(p.return_pct>0?'+':'')+p.return_pct+'%</b></td><td class="neg">$'+(p.stop||0).toFixed(2)+'</td><td class="am">'+(p.days_held||'?')+'d/'+(p.horizon||cfg.horizon||'?')+'d</td></tr>';
        });
        eth+='</tbody></table>';
        et.innerHTML=eth;
        insertAfter=tmInsertAfter(et,insertAfter);
      }

      // ══ ORDERS TO PLACE (section-card cta-orders) ══
      if(d.orders&&d.orders.length>0){
        var od=document.createElement('div');
        od.className='section-card cta-orders';od.setAttribute('data-tm','1');
        var posCount=d.positions?d.positions.length:0;
        var ps=cfg.portfolioSize||'?';
        var slots=Math.max(0,(cfg.portfolioSize||0)-posCount);
        var hasRotate=d.orders.some(function(o){return o.action==='ROTATE'});
        var statusLine=slots>0?posCount+'/'+ps+' open — <b>'+slots+' slot'+(slots>1?'s':'')+' free</b> — place at next open':posCount+'/'+ps+' open — portfolio full'+(hasRotate?' — rotation opportunity':'');
        var alloc=Math.round(100/(cfg.portfolioSize||1));
        var tmOrdCols=9; // no Chart column in Time Machine (would leak future data)
        var odh='<div class="sc-head"><h3><i class="fas fa-bolt"></i> '+d.orders.length+' Order'+(d.orders.length>1?'s':'')+' to Place</h3><span class="sc-meta">'+statusLine+'</span></div>'
          +'<table class="t"><thead><tr><th>Ticker</th><th class="hide-m">Score</th><th class="hide-m">Strat.</th><th>Entry</th><th>Stop</th><th>TP1/TP2</th><th class="hide-m">R/R</th><th class="hide-m">Alloc</th><th class="hide-m">Action</th></tr></thead><tbody>';
        d.orders.forEach(function(o){
          var bg=o.score>=90?'#059669':o.score>=85?'#2563eb':'#f59e0b';
          var isRot=o.action==='ROTATE';
          var rowStyle=isRot?' style="background:#fefce8"':'';
          var actionPill=isRot?'<span class="pill am">ROTATE'+(o.replaces?' ↔ '+o.replaces:'')+'</span>':'<span class="pill pos">BUY</span>';
          odh+='<tr'+rowStyle+'><td><b>'+o.ticker+'</b></td><td class="hide-m"><span class="pill-score" style="background:'+bg+'">'+o.score+'</span></td><td class="m hide-m">'+(o.strategy||'')+'</td><td><b>'+o.entry+'</b></td><td class="neg">'+o.stop+'</td><td class="pos">'+o.tp1+'<span class="hide-m"> / '+o.tp2+'</span></td><td class="am hide-m">'+(o.rr||'')+'</td><td class="m hide-m">'+alloc+'%</td><td class="hide-m">'+actionPill+'</td></tr>';
          if(o.thesis)odh+='<tr class="thesis-row"><td colspan="'+tmOrdCols+'"><div class="thesis-text">'+o.thesis+'</div></td></tr>';
        });
        odh+='</tbody></table>';
        od.innerHTML=odh;
        insertAfter=tmInsertAfter(od,insertAfter);
      }

      // ══ TODAY'S SIGNALS (collapsible details) ══
      if(d.signals&&d.signals.length>0){
        var sg=document.createElement('div');
        sg.className='section-card';sg.setAttribute('data-tm','1');
        var scanLink=snap.scanDir?'<a href="/scanner/'+snap.scanDir+'/" class="sc-link" onclick="event.stopPropagation()">Full scan →</a>':'';
        var sgh='<details><summary class="sc-summary"><span class="sc-sum-title">Today\\\'s Signals <span class="count">'+d.signals.length+' setups</span></span>'+scanLink+'</summary>'
          +'<table class="t" style="margin-top:.6rem"><thead><tr><th>Ticker</th><th>Score</th><th>Setup</th><th>Entry</th><th>Stop</th><th>TP1/TP2</th><th>R/R</th></tr></thead><tbody>';
        d.signals.forEach(function(s){
          var bg=s.score>=90?'#059669':s.score>=85?'#2563eb':'#f59e0b';
          sgh+='<tr><td><b>'+s.ticker+'</b></td><td><span class="pill-score" style="background:'+bg+'">'+s.score+'</span></td><td class="m">'+(s.strategy||'')+'</td><td>'+s.entry+'</td><td class="neg">'+s.stop+'</td><td class="pos">'+s.tp1+' / '+s.tp2+'</td><td class="am">'+(s.rr||'')+'</td></tr>';
        });
        sgh+='</tbody></table></details>';
        sg.innerHTML=sgh;
        insertAfter=tmInsertAfter(sg,insertAfter);
      }

      // ══ OPEN POSITIONS (with scenario bar) ══
      var posSection=document.createElement('div');
      posSection.className='section-card';posSection.setAttribute('data-tm','1');
      if(d.positions&&d.positions.length>0){
        var avgPnl=d.positions.reduce(function(s,p){return s+(p.return_pct||0)},0)/d.positions.length;
        var avgCls=avgPnl>=0?'pos':'neg';
        var psh='<div class="sc-head"><h3>Open Positions <span class="count">'+d.positions.length+'/'+(cfg.portfolioSize||'?')+'</span></h3><span class="sc-meta">avg P&amp;L: <b class="'+avgCls+'">'+(avgPnl>0?'+':'')+avgPnl.toFixed(1)+'%</b></span></div>';
        // Scenario bar
        var allocPct=(cfg.portfolioSize?100/cfg.portfolioSize:100)/100;
        var worstPct=0,bestPct=0,nowPct=0;
        d.positions.forEach(function(p){
          if(p.stop&&p.stop>0&&p.entry>0){worstPct+=(p.stop-p.entry)/p.entry*100*allocPct}
          var tp=p.tp2||p.tp1||p.current_price||p.entry;
          if(p.entry>0&&tp>0){bestPct+=(tp-p.entry)/p.entry*100*allocPct}
          nowPct+=(p.return_pct||0)*allocPct;
        });
        var range=bestPct-worstPct;
        var cursorPos=range>0?Math.max(0,Math.min(100,(nowPct-worstPct)/range*100)):50;
        var wCls=worstPct<0?'neg':'pos';var nCls=nowPct>=0?'pos':'neg';
        psh+='<div class="scenario-bar-wrap"><div class="scenario-labels">'
          +'<span class="'+wCls+'"><i class="fas fa-shield-halved"></i> Worst: '+(worstPct>0?'+':'')+worstPct.toFixed(1)+'%</span>'
          +'<span class="'+nCls+'"><i class="fas fa-circle-dot"></i> Now: '+(nowPct>0?'+':'')+nowPct.toFixed(1)+'%</span>'
          +'<span class="pos"><i class="fas fa-bullseye"></i> Best: +'+bestPct.toFixed(1)+'%</span>'
          +'</div><div class="scenario-bar">'
          +'<div class="scenario-fill-bad" style="width:'+cursorPos.toFixed(1)+'%"></div>'
          +'<div class="scenario-fill-good" style="width:'+(100-cursorPos).toFixed(1)+'%"></div>'
          +'<div class="scenario-cursor" style="left:'+cursorPos.toFixed(1)+'%"></div>'
          +'</div></div>';
        var tmPosCols=8; // no Chart column in Time Machine
        psh+='<table class="t"><thead><tr><th>Ticker</th><th class="hide-m">Bought</th><th class="hide-m">Entry</th><th class="hide-m">Now</th><th>P&amp;L</th><th class="hide-m">Stop</th><th class="hide-m">TP2</th><th>Left</th></tr></thead><tbody>';
        d.positions.forEach(function(p){
          var rc=p.return_pct>=0?'pos':'neg';
          var left=p.days_remaining||0;
          var isExp=left<=0;
          var leftCls=isExp?'neg':left<=1?'neg':left<=2?'am':'m';
          var leftLabel=isExp?'<span class="pill neg" style="font-size:.65rem;padding:.1rem .4rem">EXPIRED</span>':left+'d';
          var rowStyle=isExp?' style="opacity:.6;background:#fef2f2"':'';
          psh+='<tr'+rowStyle+'><td><b>'+p.ticker+'</b></td><td class="m hide-m">'+(p.scan_date?p.scan_date.slice(5):'—')+'</td><td class="hide-m">$'+(p.entry||0).toFixed(2)+'</td><td class="hide-m">$'+(p.current_price||0).toFixed(2)+'</td><td class="'+rc+'"><b>'+(p.return_pct>0?'+':'')+p.return_pct+'%</b></td><td class="neg hide-m">$'+(p.stop||0).toFixed(2)+'</td><td class="pos hide-m">'+(p.tp2?'$'+p.tp2.toFixed(2):(p.tp1?'$'+p.tp1.toFixed(2):'—'))+'</td><td class="'+leftCls+'">'+leftLabel+'</td></tr>';
          if(p.thesis)psh+='<tr class="thesis-row"'+rowStyle+'><td colspan="'+tmPosCols+'"><div class="thesis-text">'+p.thesis+'</div></td></tr>';
        });
        psh+='</tbody></table>';
        posSection.innerHTML=psh;
      }else{
        posSection.innerHTML='<div class="sc-head"><h3>Open Positions <span class="count">0/'+(cfg.portfolioSize||'?')+'</span></h3></div><p class="empty">No active positions</p>';
      }
      insertAfter=tmInsertAfter(posSection,insertAfter);

      // ══ TRADE HISTORY (collapsible details) ══
      if(d.closedTrades&&d.closedTrades.length>0){
        var th=document.createElement('div');
        th.className='section-card';th.setAttribute('data-tm','1');
        var thh='<details><summary class="sc-summary"><span class="sc-sum-title">Trade History <span class="count">'+d.closedTrades.length+' closed</span></span></summary>'
          +'<table class="t" style="margin-top:.6rem"><thead><tr><th>Ticker</th><th class="hide-m">Start</th><th class="hide-m">End</th><th class="hide-m">Entry</th><th class="hide-m">Exit</th><th>P&amp;L</th><th class="hide-m">Hold</th><th>Result</th></tr></thead><tbody>';
        var sorted=d.closedTrades.slice().sort(function(a,b){return(b.scanDate||'').localeCompare(a.scanDate||'')});
        sorted.forEach(function(t){
          var pnl=t.pnlPct||0;
          var cls=pnl>0?'pos':pnl<0?'neg':'m';
          var exitDate='—';
          if(t.entryDate&&t.holdDays!=null){var dd=new Date(t.entryDate);dd.setDate(dd.getDate()+t.holdDays);exitDate=dd.toISOString().slice(5,10)}
          var statusLabel,statusCls;
          switch(t.status){
            case'tp1':statusLabel='TP1 ✓';statusCls='pos';break;
            case'tp2':statusLabel='TP2 ✓';statusCls='pos';break;
            case'tp1_partial':statusLabel='TP1 ½';statusCls='pos';break;
            case'sl':statusLabel='SL ✗';statusCls='neg';break;
            case'expired':statusLabel='Expired';statusCls='am';break;
            case'rotated':statusLabel='Rotated';statusCls='m';break;
            default:statusLabel=t.status||'—';statusCls='m';
          }
          thh+='<tr><td><b>'+(t.ticker||'—')+'</b></td><td class="m hide-m">'+(t.entryDate?t.entryDate.slice(5):'—')+'</td><td class="m hide-m">'+exitDate+'</td><td class="hide-m">$'+(t.actualEntry||0).toFixed(2)+'</td><td class="hide-m">'+(t.exitPrice?'$'+t.exitPrice.toFixed(2):'—')+'</td><td class="'+cls+'"><b>'+(pnl>0?'+':'')+pnl+'%</b></td><td class="m hide-m">'+(t.holdDays||0)+'d</td><td><span class="pill '+statusCls+'">'+statusLabel+'</span></td></tr>';
        });
        thh+='</tbody></table></details>';
        th.innerHTML=thh;
        insertAfter=tmInsertAfter(th,insertAfter);
      }

      // If nothing at all
      if((!d.signals||!d.signals.length)&&(!d.positions||!d.positions.length)&&(!d.closedTrades||!d.closedTrades.length)&&(!d.closeNow||!d.closeNow.length)&&(!d.orders||!d.orders.length)){
        var empty=document.createElement('div');
        empty.className='section-card';empty.setAttribute('data-tm','1');
        empty.innerHTML='<div class="sc-head"><h3>No Activity</h3></div><p class="empty">No signals, positions, or trades recorded for this date.</p>';
        tmInsertAfter(empty,insertAfter);
      }
      // Release height lock and fade back in
      requestAnimationFrame(function(){
        panel.style.opacity='1';
        setTimeout(function(){panel.style.minHeight='';},200);
      });
    })();
  }
  tmInit();
});
</script>

<div class="tm-panel" id="tmPanel">
  <div class="tm-panel-head">
    <span class="tm-panel-title"><i class="fas fa-clock-rotate-left"></i> Time Machine</span>
    <button class="tm-panel-close" onclick="tmToggle()" aria-label="Close"><i class="fas fa-xmark"></i></button>
  </div>
  <div class="tm-date-display" id="tmDateLabel"></div>
  <div class="tm-slider-row">
    <button class="tm-btn" id="tmBtnPrev" onclick="tmNav(-1)" aria-label="Previous"><i class="fas fa-chevron-left"></i></button>
    <input type="range" id="timeSlider" class="tm-slider" min="0" max="0" value="0">
    <button class="tm-btn" id="tmBtnNext" onclick="tmNav(1)" aria-label="Next"><i class="fas fa-chevron-right"></i></button>
  </div>
  <div class="tm-range-labels"><span id="tmFirstDate"></span><span id="tmLastDate"></span></div>
  <button class="tm-live-btn" id="tmLiveBtn" onclick="tmGoLive()"><i class="fas fa-satellite-dish"></i> Back to Live</button>
</div>
</body>
</html>`;

  fs.writeFileSync(OUT, html);
  console.log(`\u2705 ${OUT} generated (${(html.length / 1024).toFixed(0)}KB)`);
  console.log(`   Balanced: +${ca.ret}%, DD ${ca.dd}%, WR ${ca.wr}%, PF ${ca.pf}x, ${ca.trades} trades`);

  // ── Save daily snapshot for time machine ──
  const todayISO = new Date().toISOString().slice(0, 10);
  const todayKey = todayISO.replace(/-/g, '');
  const historyDir = path.join(ROOT, 'scanner/status/history');
  fs.mkdirSync(historyDir, { recursive: true });

  // Build MtM equity curves from historical backfill snapshots + today's live data
  // This ensures the live snapshot's equity curve is consistent with backfill snapshots
  const modeEquityHistory = {};
  try {
    const histFiles = fs.readdirSync(historyDir).filter(f => /^\d{8}\.json$/.test(f) && f.replace('.json', '') < todayKey).sort();
    for (const f of histFiles) {
      const snap = JSON.parse(fs.readFileSync(path.join(historyDir, f), 'utf8'));
      for (const [mId, mData] of Object.entries(snap.modes || {})) {
        if (!modeEquityHistory[mId]) modeEquityHistory[mId] = [];
        if (mData.equity && mData.equity.d && mData.equity.v) {
          // Take the LAST point from each snapshot (the point for that date)
          const lastIdx = mData.equity.d.length - 1;
          if (lastIdx >= 0) {
            modeEquityHistory[mId].push({ d: mData.equity.d[lastIdx], v: mData.equity.v[lastIdx] });
          }
        }
      }
    }
  } catch (e) {}

  const snapshot = { date: todayISO, updatedAt, scanDir };
  snapshot.modes = {};
  for (const [id, { cfg, trades: mTrades, m: mM }] of Object.entries(modes)) {
    const sig = signalsFor(cfg);
    const pos = posFor(cfg, mTrades);

    // MtM equity for today: realized + unrealized (matching backfill logic)
    const realized = mM.ret;
    const unrealized = pos.reduce((s, p) => s + (p.return_pct || 0), 0) / cfg.portfolioSize;
    const todayMtm = +(100 + realized + unrealized).toFixed(2);
    const todayLabel = todayISO.slice(5).replace('-', '/');

    // Build continuous MtM curve: historical points + today
    const hist = modeEquityHistory[id] || [];
    const ec = {
      d: [...hist.map(p => p.d), todayLabel],
      v: [...hist.map(p => p.v), todayMtm]
    };
    // Compute closeNow (timed out positions) first — they free slots for orders
    function bizDaysHeldSnap(sd) { if (!sd) return 0; return Math.round(Math.round((Date.now() - new Date(sd)) / 86400000) * 5 / 7); }
    const timedOutSnap = pos.filter(p => Math.max(0, cfg.horizon - bizDaysHeldSnap(p.scan_date)) <= 0);
    // Compute orders for snapshot — closeNow positions free their slots
    const closeNowTickers = new Set(timedOutSnap.map(p => p.ticker));
    const activePos = pos.filter(p => !closeNowTickers.has(p.ticker));
    const openTickers = new Set(activePos.map(p => p.ticker));
    const sigFiltered = sig.filter(s => !openTickers.has(s.ticker));
    const slotsAvailable = Math.max(0, cfg.portfolioSize - activePos.length);
    const buyOrders = sigFiltered.slice(0, slotsAvailable).map(s => ({ ...s, action: 'BUY' }));
    const rotCands = [];
    if (cfg.rotation === 'aggressive' && slotsAvailable === 0 && activePos.length > 0 && sigFiltered.length > 0) {
      const worst = [...activePos].sort((a, b) => a.return_pct - b.return_pct)[0];
      for (const s of sigFiltered.slice(0, 5)) {
        if (s.score >= 88 && worst.return_pct < 2) { rotCands.push({ ...s, action: 'ROTATE', replaces: worst.ticker }); break; }
      }
    }

    snapshot.modes[id] = {
      stats: { ret: mM.ret, dd: mM.dd, wr: mM.wr, pf: mM.pf, trades: mM.trades, avgHold: mM.avgHold },
      equity: ec,
      signals: sig.map(s => ({ ticker: s.ticker, score: s.score, strategy: s.strategy, entry: s.entry, stop: s.stop, tp1: s.tp1, tp2: s.tp2, rr: s.rr, thesis: s.thesis || '' })),
      positions: pos.map(p => ({ ticker: p.ticker, scan_date: p.scan_date, entry: p.entry, current_price: p.current_price, return_pct: p.return_pct, stop: p.stop, tp1: p.tp1, tp2: p.tp2, days_remaining: p.days_remaining, strategy: p.strategy, thesis: p.thesis || '' })),
      orders: [...buyOrders, ...rotCands],
      closeNow: timedOutSnap.map(p => ({ ticker: p.ticker, scan_date: p.scan_date, entry: p.entry, current_price: p.current_price, return_pct: p.return_pct, days_held: bizDaysHeldSnap(p.scan_date), horizon: cfg.horizon })),
      expiresTomorrow: pos.filter(p => { const left = Math.max(0, cfg.horizon - bizDaysHeldSnap(p.scan_date)); return left === 1; }).map(p => ({ ticker: p.ticker, entry: p.entry, return_pct: p.return_pct, stop: p.stop, days_held: bizDaysHeldSnap(p.scan_date), horizon: cfg.horizon })),
      closedTrades: mTrades.filter(t => !t._premature).map(t => ({ ticker: t.ticker, scanDate: t.scanDate, entryDate: t.entryDate, actualEntry: t.actualEntry, exitPrice: t.exitPrice, pnlPct: t.pnlPct, holdDays: t.holdDays, status: t.status, strategy: t.strategy })),
      config: { portfolioSize: cfg.portfolioSize, horizon: cfg.horizon, filterName: cfg.filterName, rotation: cfg.rotation, color: cfg.color }
    };
  }

  fs.writeFileSync(path.join(historyDir, todayKey + '.json'), JSON.stringify(snapshot));
  const existingDates = fs.readdirSync(historyDir).filter(f => /^\d{8}\.json$/.test(f)).map(f => f.replace('.json', '')).sort();
  fs.writeFileSync(path.join(historyDir, 'dates.json'), JSON.stringify(existingDates));
  console.log(`   Snapshot: history/${todayKey}.json (${existingDates.length} dates)`);
}

main();
