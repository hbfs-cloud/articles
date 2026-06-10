#!/usr/bin/env node
/**
 * gen-status-page.js — Scanner Status dashboard
 *
 * For each mode: equity+stats → signals → positions → method → trades (collapsed)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');
const ms = require('./lib/mode-status');

function fmtDateFR(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const months = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
function fmtDateEN(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function renderStatusBadge(state) {
  if (!state || state === 'live') return '';
  const d = ms.describe(state) || { label: state, color: '#94a3b8' };
  return `<span class="mode-status-badge ms-${state}" style="--ms-bg:${d.color}">${d.label.toUpperCase()}</span>`;
}

function renderStatusBanner(cfg) {
  const state = ms.isValidState(cfg.status) ? cfg.status : ms.DEFAULT_STATE;
  if (state === 'live') return '';
  const d = ms.describe(state);
  const messages = {
    'draft':      { title: 'Draft Mode', body: 'Configuration created, no execution.' },
    'test':       { title: 'Paper Testing', body: 'Paper trading only, no real positions.' },
    'deploying':  { title: 'Deploying', body: 'Gradual ramp-up: orders in paper-validation before going live.' },
    'pausing':    { title: 'Winding Down', body: 'No new entries. Managing exits on open positions until natural close.' },
    'liquidated': { title: 'Force Liquidated', body: 'All positions closed at market at the next session.' },
    'paused':     { title: 'Paused', body: 'No activity, equity frozen — can be reactivated.' },
    'stopped':    { title: 'Archived', body: 'Mode permanently stopped.' },
  };
  const m = messages[state] || { title: d.label, body: '' };
  const reason = cfg.statusReason ? `<p class="msb-reason">Reason: ${cfg.statusReason}</p>` : '';
  const since = cfg.statusSince ? `Since ${fmtDateEN(cfg.statusSince)}` : '';
  const review = cfg.statusNextReviewAt ? ` · Review ${fmtDateEN(cfg.statusNextReviewAt)}` : '';
  const meta = (since || review) ? `<small>${since}${review}</small>` : '';
  return `<div class="mode-status-banner ms-banner-${state}" style="--ms-bg:${d.color}">
    <i class="fas fa-circle-info"></i>
    <div class="msb-text">
      <strong>${m.title}</strong>
      <p>${m.body}</p>
      ${reason}
      ${meta}
    </div>
  </div>`;
}

const tkLogo = t => `<img src="https://assets.parqet.com/logos/symbol/${t}?format=jpg" alt="" class="tk-logo" onerror="this.style.display='none'">`;

function fetchOHLC(ticker) {
  return new Promise((resolve) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=30d`;
    const opts = { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 };
    https.get(url, opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          const result = j?.chart?.result?.[0];
          if (!result) return resolve({ bars: {}, lastPrice: null });
          const ts = result.timestamp || [];
          const q = result.indicators?.quote?.[0] || {};
          const bars = {};
          let lastOHLC = null;
          for (let i = 0; i < ts.length; i++) {
            if (q.close?.[i] != null) {
              const dateStr = new Date(ts[i] * 1000).toISOString().slice(0, 10);
              bars[dateStr] = q.close[i];
              lastOHLC = { open: q.open?.[i] || 0, high: q.high?.[i] || 0, low: q.low?.[i] || 0, close: q.close[i] };
            }
          }
          const vwap = lastOHLC ? +((lastOHLC.high + lastOHLC.low + lastOHLC.close) / 3).toFixed(2) : null;
          resolve({ bars, lastPrice: result.meta?.regularMarketPrice ?? null, vwap, ohlc: lastOHLC });
        } catch { resolve({ bars: {}, lastPrice: null }); }
      });
    }).on('error', () => resolve({ bars: {}, lastPrice: null })).on('timeout', () => resolve({ bars: {}, lastPrice: null }));
  });
}

function bizDaysSince(dateStr) {
  if (!dateStr) return 0;
  const start = new Date(dateStr + 'T00:00:00Z');
  const now = new Date();
  let count = 0;
  const d = new Date(start);
  d.setUTCDate(d.getUTCDate() + 1);
  while (d <= now) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

function addBizDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  let added = 0;
  while (added < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

const ROOT = path.join(__dirname, '..');
const MODES_CFG = path.join(ROOT, 'data/modes-config.json');
const TRADES = path.join(ROOT, 'data/backtest-trades.json');
const RESULTS = path.join(ROOT, 'data/backtest-results.json');
const SCANNER_DIR = path.join(ROOT, 'scanner');
const POSITIONS_FILE = path.join(ROOT, 'data/scanner-positions.json');
const METRICS_FILE = path.join(ROOT, 'data/scanner-metrics.json');
const RISK_SNAP_FILE = path.join(ROOT, 'data/risk-snapshots.json');
const OUT = path.join(ROOT, 'scanner/status/index.html');

// Lazy risk-snapshot loader — graceful no-op when file is missing.
let _riskSnap = null;
function loadRiskSnapshot() {
  if (_riskSnap !== null) return _riskSnap;
  if (!fs.existsSync(RISK_SNAP_FILE)) return (_riskSnap = {});
  try { _riskSnap = JSON.parse(fs.readFileSync(RISK_SNAP_FILE, 'utf8')) || {}; }
  catch (e) { _riskSnap = {}; }
  return _riskSnap;
}
function getRiskFor(modeId) {
  const snap = loadRiskSnapshot();
  return (snap.modes || {})[modeId] || null;
}
function getGlobalRegimeProb() {
  const snap = loadRiskSnapshot();
  return snap.regimeProbability || null;
}

function computeMetrics(trades, portfolioSize, positionSizePct) {
  const pspct = positionSizePct || 1;
  const wins = trades.filter(t => t.pnlPct > 0);
  const losses = trades.filter(t => t.pnlPct <= 0);
  const totalReturn = trades.reduce((s, t) => s + (t.pnlPct || 0) / portfolioSize * pspct, 0);
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
    equity += (t.pnlPct || 0) / portfolioSize * pspct;
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
  // Realized = closed trades only (excludes any open/live mark-to-market)
  const realized = +trades
    .filter(t => ['tp1','tp2','sl','expired','rotated','tp1_partial','breakeven','trail'].includes(t.status) || t.exitDate)
    .reduce((s, t) => s + (t.pnlPct || 0) / portfolioSize * pspct, 0).toFixed(2);
  const unrealized = +(ret - realized).toFixed(2);
  // Bootstrap 90% confidence band on PF when n<50 (rule of thumb — thin samples lie)
  const pnls = trades.map(t => t.pnlPct || 0);
  let pfLow = null, pfHigh = null, pfReliable = trades.length >= 50;
  if (trades.length >= 5 && trades.length < 50) {
    const bootPFs = [];
    const N = 500; // 500 bootstraps is plenty for 90% CI
    for (let b = 0; b < N; b++) {
      let gw = 0, gl = 0;
      for (let i = 0; i < pnls.length; i++) {
        const p = pnls[Math.floor(Math.random() * pnls.length)];
        if (p > 0) gw += p; else gl += Math.abs(p);
      }
      bootPFs.push(gl > 0 ? gw / gl : (gw > 0 ? 99 : 0));
    }
    bootPFs.sort((a, b) => a - b);
    pfLow = +bootPFs[Math.floor(N * 0.05)].toFixed(2);
    pfHigh = +bootPFs[Math.floor(N * 0.95)].toFixed(2);
  }
  return { ret, realized, unrealized, dd: +(-dd).toFixed(2), wr, pf, pfLow, pfHigh, pfReliable, trades: trades.length, avgHold, equityCurve, wins: wins.length, losses: losses.length };
}

function equityDV(curve) {
  const byDate = {};
  for (const p of curve) { if (p.date) byDate[p.date] = p.value; }
  const dates = Object.keys(byDate).sort();
  return { d: dates.map(d => d.slice(5).replace('-', '/')), v: dates.map(d => byDate[d]) };
}

async function main() {
  let config;
  try { config = JSON.parse(fs.readFileSync(MODES_CFG)); } catch (e) { console.error(`[gen-status-page] Cannot read modes-config: ${e.message}`); process.exit(1); }
  let allTrades = {};
  try { allTrades = JSON.parse(fs.readFileSync(TRADES)); } catch (_) { }
  let results = {};
  try { results = JSON.parse(fs.readFileSync(RESULTS)); } catch (_) { }
  let liveMetrics = {};
  try { liveMetrics = JSON.parse(fs.readFileSync(METRICS_FILE)); } catch (_) { }
  let livePositions = [];
  try { livePositions = JSON.parse(fs.readFileSync(POSITIONS_FILE)).open_positions || []; } catch (_) { }

  // Load previous snapshot once — used by panel() to surface "rotation just executed"
  // (yesterday had a ROTATE order whose ticker is now today's position).
  let prevSnap = null;
  // Per-mode FROZEN historical equity (one point per snapshot date, anchored to
  // each snapshot's own stats.ret). This is the canonical source of truth for the
  // equity curve — historical points NEVER change retroactively because each
  // snapshot's stats.ret is captured at close on that date.
  const modeEquityHistory = {};
  const _todayKeyNY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })
    .format(new Date()).replace(/-/g, '');
  try {
    const _historyDir = path.join(ROOT, 'scanner/status/history');
    const _files = fs.readdirSync(_historyDir).filter(f => /^\d{8}\.json$/.test(f)).sort();
    const _prev = _files.filter(f => f.replace('.json', '') < _todayKeyNY).slice(-1)[0];
    if (_prev) prevSnap = JSON.parse(fs.readFileSync(path.join(_historyDir, _prev), 'utf8'));
    // Build per-mode history from EVERY snapshot < today (excludes today, which
    // gets appended at panel-build time using fresh stats.ret).
    const _statusSinceCutoff = {};
    for (const [mId, mCfg] of Object.entries(config.modes || {})) {
      if (mCfg.statusSince) _statusSinceCutoff[mId] = mCfg.statusSince.slice(0, 10).replace(/-/g, '');
    }
    for (const f of _files.filter(ff => ff.replace('.json', '') < _todayKeyNY)) {
      const snap = JSON.parse(fs.readFileSync(path.join(_historyDir, f), 'utf8'));
      const dateKey = f.replace('.json', '');
      const dateLabel = dateKey.slice(4, 6) + '/' + dateKey.slice(6, 8);
      for (const [mId, mData] of Object.entries(snap.modes || {})) {
        if (_statusSinceCutoff[mId] && dateKey < _statusSinceCutoff[mId]) continue;
        if (!modeEquityHistory[mId]) modeEquityHistory[mId] = [];
        const ret = mData.stats && mData.stats.ret != null ? mData.stats.ret : null;
        if (ret != null) {
          modeEquityHistory[mId].push({ d: dateLabel, v: +(100 + ret).toFixed(2) });
        }
      }
    }
  } catch (e) { /* first run — no previous snapshot */ }

  // ── Regime map: scan date → regime label ──
  const regimeMap = {};
  try {
    const scanDirs = fs.readdirSync(path.join(ROOT, 'scanner')).filter(d => /^\d{8}$/.test(d)).sort();
    for (const d of scanDirs) {
      try {
        const sig = JSON.parse(fs.readFileSync(path.join(ROOT, 'scanner', d, 'signals.json')));
        regimeMap[d.slice(4, 6) + '/' + d.slice(6, 8)] = sig.regime || 'NEUTRAL';
      } catch (_) {}
    }
  } catch (_) {}

  // ── SPY benchmark (indexed to 100 at inception) ──
  const spyRaw = await new Promise(resolve => {
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1d&range=6mo';
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          const r = j?.chart?.result?.[0];
          const ts = r?.timestamp || [], cl = r?.indicators?.quote?.[0]?.close || [];
          const bars = {};
          for (let i = 0; i < ts.length; i++) {
            if (cl[i] != null) {
              const ds = new Date(ts[i] * 1000).toISOString().slice(0, 10);
              bars[ds.slice(5).replace('-', '/')] = cl[i];
            }
          }
          resolve(bars);
        } catch { resolve({}); }
      });
    }).on('error', () => resolve({})).on('timeout', function() { this.destroy(); resolve({}); });
  });
  const spyKeys = Object.keys(spyRaw).sort();
  const spyBaseKey = spyKeys.find(k => k >= '02/26') || spyKeys[0];
  const spyBase = spyBaseKey ? spyRaw[spyBaseKey] : null;
  const spyIndexed = {};
  if (spyBase) { for (const [d, v] of Object.entries(spyRaw)) spyIndexed[d] = +(v / spyBase * 100).toFixed(2); }
  console.log(`📊 SPY benchmark: ${spyKeys.length} bars, base=${spyBase ? '$' + spyBase.toFixed(2) : 'N/A'}`);

  // Collect ALL premature tickers (holdDays < horizon) for equity curve MtM
  const liveTickers = new Set(livePositions.map(p => p.ticker));
  const allPrematureTickers = new Set();
  const prematureNeedLive = new Set();
  for (const [id, cfg] of Object.entries(config.modes)) {
    const raw = allTrades[id] || [];
    for (const t of raw) {
      if (t.status === 'pending' || (t.status === 'expired' && t.holdDays < cfg.horizon)) {
        allPrematureTickers.add(t.ticker);
        if (!liveTickers.has(t.ticker)) prematureNeedLive.add(t.ticker);
      }
    }
  }
  const prematureBars = {};
  if (allPrematureTickers.size > 0) {
    const tickers = [...allPrematureTickers];
    console.log(`📡 Fetching live OHLC for ${tickers.length} premature ticker(s): ${tickers.join(', ')}`);
    const ohlcResults = await Promise.all(tickers.map(fetchOHLC));
    for (let i = 0; i < tickers.length; i++) {
      prematureBars[tickers[i]] = ohlcResults[i];
      if (prematureNeedLive.has(tickers[i]) && ohlcResults[i].lastPrice !== null) {
        livePositions.push({ ticker: tickers[i], current_price: ohlcResults[i].lastPrice, stop: 0, tp1: 0, tp2: 0 });
      }
    }
  }

  // Latest scan signals — JSON-first via loadSignals, HTML fallback for legacy scans
  const parser = require('./lib/scanner-parser');
  const sharedCfg = require('./config');
  let signals = [];
  let scanDir = '';
  const thesisMap = {};
  let dirs = [];
  try {
    dirs = fs.readdirSync(SCANNER_DIR).filter(d => sharedCfg.RE_SCAN_DIR.test(d)).sort().reverse();
    // Pick the most recent scan dir that has a valid scan
    for (const d of dirs) {
      const jsonP = path.join(SCANNER_DIR, d, 'signals.json');
      const htmlP = path.join(SCANNER_DIR, d, 'index.html');
      try {
        if (fs.existsSync(jsonP) || (fs.statSync(htmlP).size > 5000)) { scanDir = d; break; }
      } catch (_) { }
    }
    // Collect thesis from recent scans (loadSignals handles JSON/HTML automatically)
    const recentDirs = dirs.slice(0, sharedCfg.RECENT_SCANS_WINDOW);
    for (const dir of recentDirs) {
      try {
        const loaded = parser.loadSignals(dir);
        if (loaded && loaded.thesis) {
          for (const [k, v] of Object.entries(loaded.thesis)) { if (!thesisMap[k]) thesisMap[k] = v; }
        }
      } catch (_) { }
    }
    if (scanDir) {
      const loaded = parser.loadSignals(scanDir);
      if (loaded) {
        signals = loaded.signals.map(s => ({ ...s, thesis: thesisMap[s.ticker] || loaded.thesis[s.ticker] || '' }));
      }
    }
  } catch (_) { }
  signals.sort((a, b) => (b.score || 0) - (a.score || 0));

  // Fetch previous-day VWAP for signal tickers (trader reference for VWAP gate)
  const signalVwap = {}, signalOhlc = {};
  if (signals.length) {
    const sigTickers = [...new Set(signals.map(s => s.ticker))];
    // Limit concurrency to 6 (matches live-tracker.js convention) to avoid Yahoo rate limits
    async function pMapLimit(items, limit, fn) {
      const results = []; let i = 0;
      await Promise.all(Array.from({length: Math.min(limit, items.length)}, async () => {
        while (i < items.length) { const idx = i++; results[idx] = await fn(items[idx]); }
      }));
      return results;
    }
    const sigOhlc = await pMapLimit(sigTickers, 6, fetchOHLC);
    for (let i = 0; i < sigTickers.length; i++) {
      if (sigOhlc[i].vwap) signalVwap[sigTickers[i]] = sigOhlc[i].vwap;
      if (sigOhlc[i].ohlc) signalOhlc[sigTickers[i]] = { ...sigOhlc[i].ohlc, price: sigOhlc[i].lastPrice || sigOhlc[i].ohlc.close };
    }
  }

  // Baked prices for client-side live-engine (eliminates CORS dependency)
  const bakedPrices = {};
  for (const [ticker, data] of Object.entries(prematureBars)) {
    if (data.lastPrice != null) {
      const o = data.ohlc || {};
      const bd = Object.keys(data.bars).sort();
      const pc = bd.length >= 2 ? data.bars[bd[bd.length - 2]] : o.close;
      bakedPrices[ticker] = { p: data.lastPrice, o: o.open||0, h: o.high||0, l: o.low||0, pc: pc||0 };
    }
  }
  for (const [ticker, o] of Object.entries(signalOhlc)) {
    if (!bakedPrices[ticker] && o.price)
      bakedPrices[ticker] = { p: o.price, o: o.open||0, h: o.high||0, l: o.low||0, pc: o.close||0 };
  }

  // Filter out stopped modes — they should not appear on the status page
  for (const [id, cfg] of Object.entries(config.modes)) {
    if (cfg.status === 'stopped') delete config.modes[id];
  }

  // Modes — mark premature expirations as "pending" (not enough data yet, not real exits)
  const modes = {};
  for (const [id, cfg] of Object.entries(config.modes)) {
    const raw = allTrades[id] || [];
    // Tag premature expirations — compute horizon expiry date for MtM capping.
    // Override sweep's stale exit values with live data so the row reflects today's
    // reality (current price, actual hold days, today's date).
    const livePosByTicker = {};
    for (const lp of (livePositions || [])) {
      livePosByTicker[lp.ticker + '|' + (lp.scan_date || '')] = lp;
    }
    const _todayISOEarly = new Date().toISOString().slice(0, 10);
    const trades = raw.map(t => {
      if (t.status === 'pending' || (t.status === 'expired' && t.holdDays < cfg.horizon)) {
        const scanDate = t.scanDate || t.entryDate;
        const horizonExpiryDate = addBizDays(scanDate, cfg.horizon);
        const realBizDays = bizDaysSince(scanDate);
        const horizonExpired = realBizDays >= cfg.horizon;
        // Replace sweep's stale exit fields with live values when the position
        // is still pending. _exitPriceLive used by the trade history renderer.
        const live = livePosByTicker[t.ticker + '|' + scanDate];
        const overrides = live ? {
          exitDate: _todayISOEarly,
          exitPrice: live.current_price || t.exitPrice,
          pnlPct: (t.actualEntry > 0 && live.current_price > 0)
            ? +(((live.current_price - t.actualEntry) / t.actualEntry) * 100).toFixed(2)
            : t.pnlPct,
          holdDays: realBizDays,
        } : {};
        return { ...t, ...overrides, _premature: true, _horizonExpiryDate: horizonExpiryDate, _horizonExpired: horizonExpired };
      }
      return t;
    });
    // Stats computed from CLOSED trades only (non-premature) — matches backfill convention
    const closedTrades = trades.filter(t => !t._premature);
    const m = computeMetrics(closedTrades, cfg.portfolioSize, cfg.positionSizePct);
    // Override all stats with authoritative frozen_ values from sweep (daily MtM).
    // Frozen ret is the final portfolio-simulation result (handles concurrency, sizing,
    // rotation correctly). It supersedes the per-trade sum from computeMetrics.
    // Keep the realized/unrealized split coherent: when frozen ret is applied, realized
    // is by definition ret (sweep covers closed period only), unrealized = 0.
    const frozenKey = `frozen_${id}`;
    const frozen = results[frozenKey];
    if (frozen) {
      m.ret = frozen.returnTotal;
      m.dd = frozen.maxDD;
      m.realized = frozen.returnRealized ?? frozen.returnTotal;
      m.unrealized = frozen.returnUnrealized ?? 0;
      if (frozen.winRate !== undefined) m.wr = frozen.winRate;
      if (frozen.profitFactor !== undefined) m.pf = frozen.profitFactor;
      if (frozen.trades !== undefined) m.trades = frozen.trades;
      if (frozen.equityCurve && frozen.equityCurve.length > 0) {
        // Trim flat tail (post-backtest plateau where price data ran out)
        const ec = [...frozen.equityCurve];
        while (ec.length > 1 && ec[ec.length - 1].value === ec[ec.length - 2].value) ec.pop();

        // Clamp: drop any points dated after today (future dates from stale price cache)
        const todayISO = new Date().toISOString().slice(0, 10);
        while (ec.length > 1 && ec[ec.length - 1].date > todayISO) ec.pop();

        // Frozen EC is authoritative — no MtM extension (append-only: sweep stats are final)

        m.equityCurve = ec;
      }
      // Out-of-sample degradation flag — surface overfitting risk to the UI.
      // Triggers if OOS PF < 1.5 OR (IS_WR - OOS_WR) > 20pp on a non-trivial OOS sample.
      const isS = frozen.in_sample, oosS = frozen.out_sample;
      if (isS && oosS && oosS.trades >= 5) {
        const wrDelta = (isS.winRate || 0) - (oosS.winRate || 0);
        const pfWeak = (oosS.profitFactor || 0) < 1.5;
        m.oosWarn = (pfWeak || wrDelta > 20)
          ? { isWR: isS.winRate, oosWR: oosS.winRate, isPF: isS.profitFactor, oosPF: oosS.profitFactor, oosTrades: oosS.trades, wrDelta: +wrDelta.toFixed(1) }
          : null;
      } else {
        m.oosWarn = null;
      }
    }
    // Use FROZEN equity curve (authoritative daily MtM from sweep).
    // Frozen EC never changes retroactively — unlike snapshot stats.ret which gets
    // recalculated when sweep reruns with updated parameters.
    let ec;
    if (m.equityCurve && m.equityCurve.filter(p => p.date).length > 0) {
      // Deduplicate: multiple trades on same date → keep last value (end-of-day state)
      const _dedup = new Map();
      for (const p of m.equityCurve) {
        if (!p.date) continue;
        _dedup.set(p.date.slice(5, 7) + '/' + p.date.slice(8, 10), p.value);
      }
      ec = { d: [..._dedup.keys()], v: [..._dedup.values()] };
    } else {
      const _todayLabel = (function(){
        const d = new Date();
        return ('0' + (d.getMonth()+1)).slice(-2) + '/' + ('0' + d.getDate()).slice(-2);
      })();
      const _hist = modeEquityHistory[id] || [];
      const _todayMtm = +(100 + (m.ret || 0)).toFixed(2);
      ec = {
        d: [..._hist.map(p => p.d), _todayLabel],
        v: [..._hist.map(p => p.v), _todayMtm],
      };
    }
    // ── Compute R², CAGR, Sharpe from equity curve ──
    if (ec.v && ec.v.length >= 3) {
      // R² — linear regression on equity values
      const n = ec.v.length;
      const xMean = (n - 1) / 2;
      const yMean = ec.v.reduce((a, b) => a + b, 0) / n;
      let ssXY = 0, ssXX = 0, ssTot = 0, ssRes = 0;
      for (let i = 0; i < n; i++) {
        ssXY += (i - xMean) * (ec.v[i] - yMean);
        ssXX += (i - xMean) ** 2;
        ssTot += (ec.v[i] - yMean) ** 2;
      }
      const slope = ssXX ? ssXY / ssXX : 0;
      const intercept = yMean - slope * xMean;
      for (let i = 0; i < n; i++) { ssRes += (ec.v[i] - (intercept + slope * i)) ** 2; }
      m.r2 = ssTot > 0 ? +(1 - ssRes / ssTot).toFixed(3) : 0;

      // CAGR — annualized from equity curve date range
      const ecDates = m.equityCurve ? m.equityCurve.filter(p => p.date) : [];
      if (ecDates.length >= 2) {
        const d0 = new Date(ecDates[0].date), d1 = new Date(ecDates[ecDates.length - 1].date);
        const years = (d1 - d0) / (365.25 * 86400000);
        const finalV = ec.v[ec.v.length - 1], startV = ec.v[0];
        m.cagr = years > 0.01 && startV > 0 ? +((Math.pow(finalV / startV, 1 / years) - 1) * 100).toFixed(1) : null;
      } else { m.cagr = null; }

      // Sharpe — annualized (daily returns, risk-free = 0)
      const dailyRet = [];
      for (let i = 1; i < ec.v.length; i++) {
        if (ec.v[i - 1] > 0) dailyRet.push((ec.v[i] - ec.v[i - 1]) / ec.v[i - 1]);
      }
      if (dailyRet.length >= 5) {
        const mu = dailyRet.reduce((a, b) => a + b, 0) / dailyRet.length;
        const sigma = Math.sqrt(dailyRet.reduce((s, r) => s + (r - mu) ** 2, 0) / dailyRet.length);
        m.sharpe = sigma > 0 ? +(mu / sigma * Math.sqrt(252)).toFixed(2) : null;
      } else { m.sharpe = null; }
    } else { m.r2 = 0; m.cagr = null; m.sharpe = null; }
    // Override sharpe with frozen if available (sweep's is authoritative)
    if (frozen && frozen.sharpe != null) m.sharpe = frozen.sharpe;

    modes[id] = { cfg, trades, m, ec };
  }
  // Default mode for API/telegram = balanced
  const defaultMode = modes.balanced || modes[Object.keys(modes)[0]];
  const ca = defaultMode.m;
  const caEC = defaultMode.ec;

  const _updSrc = liveMetrics.updated_at || results.generated_at;
  const updatedAt = (() => {
    const d = _updSrc ? new Date(_updSrc) : new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${days[d.getUTCDay()]} ${hh}:${mm} UTC`;
  })();

  // Filters
  const SF = {
    all: () => true, no_sq: s => !/short.?squeeze/i.test(s),
    momentum_only: s => /momentum/i.test(s), breakout_only: s => /breakout/i.test(s),
    no_sq_pb: s => !/short.?squeeze|pullback/i.test(s),
    mom_bo: s => /momentum|breakout/i.test(s),
  };
  function filterLabel(f) { return { all: 'All strategies', no_sq: 'No Short Squeeze', momentum_only: 'Momentum only', breakout_only: 'Breakout only', no_sq_pb: 'No SQ/PB', mom_bo: 'Momentum + Breakout' }[f] || f; }

  // Generate config-aware tagline (overrides stale hardcoded taglines in modes-config.json)
  function buildTagline(id, cfg) {
    const parts = [];
    parts.push(`${cfg.label || id}`);
    parts.push(`H${cfg.horizon}`);
    parts.push(`${filterLabel(cfg.filterName)}`);
    if (cfg.atrStopMult > 0) parts.push(`${cfg.atrStopMult}× ATR stop`);
    if (cfg.maxStopPct > 0) parts.push(`maxStop ${cfg.maxStopPct}%`);
    if (cfg.partialTP && cfg.partialTPPct) parts.push(`partial TP ${Math.round(cfg.partialTPPct * 100)}%${cfg.partialTPGain ? ' at +' + cfg.partialTPGain + '%' : ''}`);
    if (cfg.disableTP2) parts.push('TP2 disabled (ride momentum)');
    if (cfg.staleDays > 0) parts.push(`stale exit ${cfg.staleDays}d`);
    if (cfg.dailyTrailPct > 0) parts.push(`trail ${cfg.dailyTrailPct}%`);
    if (cfg.trailingStop && !cfg.dailyTrailPct) parts.push('ATR trailing stop');
    if (cfg.breakevenPct > 0) parts.push(`BE lock at +${cfg.breakevenPct}%`);
    if (cfg.circuitBreakerStops) parts.push(`circuit breaker ${cfg.circuitBreakerStops}SL/${cfg.circuitBreakerWindow}d→${cfg.circuitBreakerPause}d pause`);
    parts.push(`Risk layer: DD breaker ${cfg.ddBreakerPct}%`);
    if (cfg.vixKillThreshold) parts.push(`VIX kill ${cfg.vixKillThreshold}`);
    if (cfg.sizingMethod === 'inverse_atr') parts.push('inverse-ATR sizing');
    if (cfg.positionSizePct && cfg.positionSizePct < 1) parts.push(`half-sized (${Math.round(cfg.positionSizePct * 100)}%)`);
    if (cfg.sectorCapMax > 0) parts.push(`sector cap ${cfg.sectorCapMax}`);
    if (cfg.correlationCap > 0) parts.push(`correlation ${cfg.correlationCap}`);
    return parts.join(', ').replace(/,\s*\./g, '.'); // fix "Label., " edge case
  }

  // Format number as "$X.XX" for display — data stays numeric until render
  function $fmt(n) { return n != null && !isNaN(n) ? '$' + Number(n).toFixed(2) : '—'; }

  function clampStop(entry, stop, maxStopPct) {
    if (!maxStopPct || maxStopPct <= 0 || !entry || entry <= 0 || !stop) return stop;
    const clamped = +(entry * (1 - maxStopPct / 100)).toFixed(2);
    return Math.max(stop, clamped);
  }
  function signalsFor(cfg) {
    const f = SF[cfg.filterName] || (() => true);
    return signals.filter(s => f(s.strategy || '')).filter(s => cfg.minScore <= 0 || s.score >= cfg.minScore).slice(0, cfg.topN).map(s => {
      const stop = clampStop(s.entry, s.stop, cfg.maxStopPct);
      // Return display-ready strings for HTML rendering, keep numeric _raw for computations
      const vwapRef = signalVwap[s.ticker] || null;
      return {
        ...s,
        stop,
        vwapRef,
        // Display fields (used in HTML templates)
        entry: $fmt(s.entry), stop: $fmt(stop), tp1: $fmt(s.tp1), tp2: $fmt(s.tp2),
        // Keep raw numbers for downstream logic (rotation score comparison, etc.)
        _entry: s.entry, _stop: stop, _tp1: s.tp1, _tp2: s.tp2,
      };
    });
  }
  // Open positions = scanner-positions.json entries matched to this mode's signals.
  // scanner-positions.json is the source of truth for live-tracked positions.
  // Each position is matched to a mode by checking if its ticker+scan_date appeared
  // in the mode's filtered signals for that scan date. Sweep-resolved trades excluded.
  function posFor(cfg, trades) {
    const liveLookup = {};
    for (const p of livePositions) { liveLookup[p.ticker] = p; }
    const todayISO = new Date().toISOString().slice(0, 10);

    // Source of truth: backtest-trades.json per mode
    // 1) Active positions: _premature (sweep hasn't resolved — still holding)
    const openTrades = trades.filter(t => t._premature);
    // 2) Same-day closed: resolved today, show grayed with terminal status
    const closedToday = trades.filter(t => !t._premature && t.exitDate === todayISO);

    const positions = [];
    for (const t of openTrades) {
      const lp = liveLookup[t.ticker];
      const entry = t.actualEntry || t.entry || 0;
      const currentPrice = (lp && lp.current_price) || entry;
      const ret = entry > 0 ? +((currentPrice - entry) / entry * 100).toFixed(2) : 0;
      const stop = clampStop(entry, t.actualStop || t.stop || 0, cfg.maxStopPct);
      positions.push({
        ticker: t.ticker, scan_date: t.scanDate, entry, current_price: currentPrice,
        return_pct: ret, score: t.score || 0,
        stop, tp1: t.tp1 || 0, tp2: t.tp2 || null,
        vwap: t.vwap || (lp && lp.vwap) || null,
        days_remaining: (lp && lp.days_remaining) || 0,
        strategy: t.strategy || '', thesis: thesisMap[t.ticker] || '',
      });
    }
    for (const t of closedToday) {
      positions.push({
        ticker: t.ticker, scan_date: t.scanDate,
        entry: t.actualEntry || t.entry || 0,
        current_price: t.exitPrice || t.actualEntry || 0,
        return_pct: t.pnlPct || 0, score: t.score || 0,
        stop: t.actualStop || t.stop || 0, tp1: t.tp1 || 0, tp2: t.tp2 || null,
        vwap: t.vwap || null, days_remaining: 0,
        strategy: t.strategy || '', thesis: thesisMap[t.ticker] || '',
        _terminal: true, _terminalStatus: t.status,
      });
    }

    // Tag mode-expired positions so they don't occupy portfolio slots
    for (const p of positions) {
      if (p._terminal) continue;
      const age = Math.round((Date.now() - new Date(p.scan_date)) / 86400000);
      const held = Math.round(age * 5 / 7);
      p._expired = held >= cfg.horizon;
    }
    const live = positions.filter(p => !p._expired && !p._terminal).sort((a, b) => b.return_pct - a.return_pct);
    const terminal = positions.filter(p => p._terminal);
    return [...live.slice(0, cfg.portfolioSize), ...terminal];
  }

  // ── Panel builder ──
  function panel(id, cfg, m, trades, ec, chartId, active) {
    const sig = signalsFor(cfg);
    // Fallback candidates: signals beyond topN that still pass filter + minScore
    const _sf = SF[cfg.filterName] || (() => true);
    const fallback = signals.filter(s => _sf(s.strategy || '')).filter(s => cfg.minScore <= 0 || s.score >= cfg.minScore)
      .slice(cfg.topN, cfg.topN + 4).map(s => {
        const st = clampStop(s.entry, s.stop, cfg.maxStopPct);
        return { ...s, vwapRef: signalVwap[s.ticker] || null, entry: $fmt(s.entry), stop: $fmt(st), tp1: $fmt(s.tp1), tp2: $fmt(s.tp2), _entry: s.entry, _stop: st, _tp1: s.tp1, _tp2: s.tp2 };
      });
    // Signal validity (scan-level): 2 biz-day timeout
    const _sigScanDate = scanDir ? `${scanDir.slice(0, 4)}-${scanDir.slice(4, 6)}-${scanDir.slice(6, 8)}` : null;
    const _sigAge = _sigScanDate ? Math.round((Date.now() - new Date(_sigScanDate)) / 86400000) : 0;
    const _sigExpired = _sigAge > 2;
    const _sigStatusLabel = _sigAge <= 1 ? 'LIVE' : _sigAge <= 2 ? 'VALID' : 'EXPIRED';
    const _sigStatusCls = _sigAge <= 1 ? 'pos' : _sigAge <= 2 ? 'am' : 'neg';
    const pos = posFor(cfg, trades);
    const alloc = Math.round(100 / cfg.portfolioSize * (cfg.positionSizePct || 1));
    const liveCount = pos.filter(p => !p._expired && !p._terminal).length;
    const terminalCount = pos.filter(p => p._terminal).length;

    // Recently executed rotation: yesterday's ROTATE order whose ticker is now in pos.
    // Hoisted at panel() level so both the Orders section and the Trade History
    // section can use it (relabel "Expired" → "Rotated", keep the row visible).
    let recentExecutedRotation = null;
    if (prevSnap && prevSnap.modes && prevSnap.modes[id]) {
      const prevOrders = (prevSnap.modes[id].orders || []).filter(o => (o.action || '').toUpperCase() === 'ROTATE');
      const currentTickers = new Set(pos.map(p => p.ticker));
      const justExecuted = prevOrders.find(o => currentTickers.has(o.ticker));
      if (justExecuted) {
        recentExecutedRotation = {
          ticker: justExecuted.ticker,
          replaces: justExecuted.replaces || null,
          score: justExecuted.score || null,
          scoreDelta: justExecuted.scoreDelta || null,
          fromDate: prevSnap.date || null,
        };
      }
    }
    const totalRet = pos.length ? pos.reduce((s, p) => s + (p.return_pct || 0), 0) / pos.length : 0;

    // Helper: compute biz days from scan_date
    function bizDaysHeld(scanDate) {
      if (!scanDate) return 0;
      const age = Math.round((Date.now() - new Date(scanDate)) / 86400000);
      return Math.round(age * 5 / 7);
    }

    const livePos = pos.filter(p => !p._expired && !p._terminal);
    // Timed-out positions: left <= 0 (horizon expired) — only from live, not already-expired
    const timedOut = livePos.filter(p => {
      const left = Math.max(0, cfg.horizon - bizDaysHeld(p.scan_date));
      return left <= 0;
    });
    // Expiring soon: left == 1 (expire next trading day)
    const expiringSoon = livePos.filter(p => {
      const left = Math.max(0, cfg.horizon - bizDaysHeld(p.scan_date));
      return left === 1;
    });

    return `<div id="p-${id}" class="mode-panel" data-mode-status="${cfg.status || 'live'}" style="${active ? '' : 'display:none'}">
${renderStatusBanner(cfg)}
<!-- ══ 1. HOW TO TRADE (method — collapsed by default) ══ -->
<div class="section-card" data-static="1">
  <details>
    <summary class="sc-summary">
      <span class="sc-sum-title"><i class="fas fa-book-open" style="color:${cfg.color};font-size:.78rem"></i> How to trade this mode</span>
      <span style="font-size:.72rem;color:#64748b;margin-left:.5rem">${cfg.goal}${cfg.riskProfile ? ' · ' + cfg.riskProfile + ' risk' : ''}</span>
    </summary>
    <div style="margin-top:.75rem;padding:.6rem .85rem;background:${cfg.color}08;border-left:3px solid ${cfg.color};border-radius:0 6px 6px 0;font-size:.82rem;color:#334155">
      ${buildTagline(id, cfg)}
    </div>
    <div class="method-steps" style="margin-top:.85rem">
      <div class="step"><span class="step-n" style="background:${cfg.color}">1</span><div>Each evening, look at the <b>signals section</b> below. It shows the best ${cfg.topN} setup${cfg.topN > 1 ? 's' : ''} from tonight's scan${cfg.filterName === 'breakout_only' ? ' (breakout setups only)' : cfg.filterName === 'mom_bo' ? ' (momentum + breakout setups only)' : cfg.filterName === 'momentum_only' ? ' (momentum setups only)' : cfg.filterName === 'no_sq' ? ' (no Short Squeeze plays)' : ''}. These are the ones you can act on tomorrow.</div></div>
      ${id === 'turbo' ? `
      <div class="step"><span class="step-n" style="background:${cfg.color}">2</span><div><b>3-Phase Smart Entry (momentum/breakout plays — you must watch at open):</b><br>
        <b>Phase 1 — 9:30–10:15 ET / 15:30–16:15 Paris:</b> strict confirmation. <i>Momentum:</i> wait for a 5-min green candle above the entry. <i>Breakout:</i> price above entry + volume spike. <i>Pullback:</i> price dips below VWAP then reclaims it with a green candle. VWAP = the fair price of the day based on where most volume traded — buying at or below it gives you a better fill.<br>
        <b>Phase 2 — 10:15–11:30 ET / 16:15–17:30 Paris:</b> relaxed. <i>Momentum:</i> price ≤ entry. <i>Breakout:</i> limit at support. <i>Pullback:</i> price ≤ entry and still below VWAP.<br>
        <b>Phase 3 — 11:30–12:00 ET / 17:30–18:00 Paris:</b> deadline. Market order if price is near entry — otherwise skip and move to next signal. Do <b>NOT</b> chase a stock up more than 3% above entry.
      </div></div>
      <div class="step"><span class="step-n" style="background:${cfg.color}">3</span><div>${cfg.maxStopPct > 0 ? `Set a <b>hard stop at −${cfg.maxStopPct}%</b> immediately.` : `Your stop adapts to each stock's volatility (${cfg.atrStopMult}× ATR) — see signal card for exact levels.`} When price hits TP1: <b>sell ${Math.round((cfg.partialTPPct || 0.3) * 100)}%</b> to lock profit, move stop to breakeven, and trail the rest toward TP2.${cfg.staleDays > 0 ? ` If no movement after ${cfg.staleDays} days, <b>exit at market</b> — stale momentum = dead trade.` : ''}</div></div>` : id === 'dynamic' ? `
      <div class="step"><span class="step-n" style="background:${cfg.color}">2</span><div><b>3-Phase Smart Entry (watch the first 90 minutes after open):</b><br>
        <b>Phase 1 — 9:30–10:15 ET / 15:30–16:15 Paris:</b> wait for a 5-min green candle above the entry + volume to confirm the move is real. <i>Pullback setup:</i> price dips to VWAP and reclaims it.<br>
        <b>Phase 2 — 10:15–11:30 ET / 16:15–17:30 Paris:</b> price must still be at or below your entry (no chasing). Limit order at support.<br>
        <b>Phase 3 — 11:30–12:00 ET / 17:30–18:00 Paris:</b> last chance — market order if price is near entry, otherwise skip. If the stock spikes +10% in the first hour, consider taking partial profit early.
      </div></div>
      <div class="step"><span class="step-n" style="background:${cfg.color}">3</span><div>Once in the trade, ${cfg.maxStopPct > 0 ? `set your <b>stop loss</b> at −${cfg.maxStopPct}% from your entry` : `set your <b>stop loss</b> based on the signal card (${cfg.atrStopMult}× ATR — adapts to volatility)`} and your <b>take profit</b> at TP1.</div></div>` : `
      <div class="step"><span class="step-n" style="background:${cfg.color}">2</span><div><b>Before market open</b> (set your orders the evening before, or before 9:25 AM New York / 3:25 PM Paris), place a <b>limit buy order</b> at the entry price shown. Put <b>${alloc}% of your total money</b> into each trade. You can have up to <b>${cfg.portfolioSize} trades open at the same time</b>. The executor uses a <b>3-phase entry window</b> (9:30–12:00 ET / 15:30–18:00 Paris): it tries to fill near entry in Phase 1, relaxes conditions in Phase 2, and places a market order in Phase 3 if price is still close — otherwise skips the signal.</div></div>
      <div class="step"><span class="step-n" style="background:${cfg.color}">3</span><div>At the same time, set your <b>stop loss</b> and <b>take profit</b> as bracket orders (OCO). The levels are shown on the signal card.${cfg.maxStopPct > 0 ? ` Hard stop at −<b>${cfg.maxStopPct}%</b> from entry — this is your maximum loss per trade, no exceptions.` : cfg.atrStopMult > 0 ? ' Your stop adapts to each stock\'s volatility — wider for volatile stocks, tighter for stable ones.' : ''}</div></div>`}
      <div class="step"><span class="step-n" style="background:${cfg.color}">4</span><div>${cfg.partialTP ? `When the price hits <b>TP1</b>: sell <b>${Math.round((cfg.partialTPPct || 0.3) * 100)}%</b> of your shares to lock in profit, and let the remaining ${Math.round((1 - (cfg.partialTPPct || 0.3)) * 100)}% ${cfg.disableTP2 ? 'ride until horizon expires or rotation' : 'run toward TP2'}. ${cfg.breakevenPct > 0 ? 'Move your stop to your entry price (you can\'t lose money on this trade anymore).' : 'Consider manually moving stop to entry to eliminate downside risk on the remaining shares.'}` : 'Hold your full position and let it run. Exit when TP1 is hit, your stop triggers, or after the max hold time below.'}</div></div>
      ${cfg.vwapGate ? `<div class="step"><span class="step-n" style="background:${cfg.color}">&#x25b6;</span><div><b>VWAP Gate (built into the 3-phase entry):</b> VWAP = the fair price of the day based on where most trading volume happened. The executor already enforces VWAP-aware entries in each phase — buying below or at VWAP gives you a better fill than the crowd. If the stock gaps up hard at open (above VWAP &times; 1.01 and more than 3% above entry), the Phase 1 check will skip it automatically to avoid a gap-up trap.</div></div>` : ''}
      <div class="step"><span class="step-n" style="background:${cfg.color}">5</span><div>${cfg.trailingStop && cfg.horizon >= 30 ? `<b>Trailing exit (no fixed time limit):</b> ride the position with ${cfg.dailyTrailPct > 0 ? `the <b>${cfg.dailyTrailPct}% daily trailing stop</b>` : `an <b>ATR-based trailing stop</b> (${cfg.atrStopMult}× ATR — adapts to each stock's volatility)`}.${cfg.staleDays > 0 ? ` If the position goes <b>${cfg.staleDays} sessions without making a new high</b> (stale), exit at market — momentum is dead.` : ''} Hard cap at ${cfg.horizon} trading days as a safety net.` : `Close everything after <b>${cfg.horizon} trading days</b> (about ${Math.ceil(cfg.horizon * 7 / 5)} calendar days) — even if the trade hasn't hit TP or stop. This keeps your capital moving.`}</div></div>
      ${cfg.rotation === 'aggressive' ? `<div class="step"><span class="step-n" style="background:${cfg.color}">6</span><div><b>Rotation:</b> each evening, check if a new signal (score ≥ ${cfg.minScore}) appeared. If your worst open trade is still losing and the new setup is stronger, close the loser and buy the new one instead. Fresh opportunity beats a stale position.</div></div>` : cfg.rotation === 'daily_max1' ? `<div class="step"><span class="step-n" style="background:${cfg.color}">6</span><div><b>Upgrade rule (max once per day):</b> if the scanner finds a new setup that scores at least 5 points higher than your weakest current trade, close the weak one and buy the new one. This keeps your portfolio fresh without turning everything over at once.</div></div>` : ''}
      ${id === 'fortress' ? `<div class="step" style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:.65rem .9rem"><span class="step-n" style="background:#6d28d9"><i class="fas fa-shield-halved" style="font-size:.5rem"></i></span><div><b>Capital preservation first:</b> with ${cfg.portfolioSize} slots at ~${Math.round(100 / cfg.portfolioSize * (cfg.positionSizePct || 1))}% each, a single stop-out costs only <b>−${((cfg.maxStopPct || cfg.atrStopMult * 2) * (cfg.positionSizePct || 1) / cfg.portfolioSize).toFixed(1)}% of portfolio</b>. <b>VIX &lt; 15 (calm)</b>: run ${Math.max(1, Math.round(cfg.portfolioSize * 0.6))}–${Math.round(cfg.portfolioSize * 0.7)} positions. <b>VIX 15–${cfg.vixKillThreshold} (elevated)</b>: aim for ${Math.max(1, Math.round(cfg.portfolioSize * 0.8))}+ positions. <b>VIX &gt; ${cfg.vixKillThreshold}</b>: mode pauses — no new entries until VIX drops. Never hold fewer than ${Math.max(1, Math.round(cfg.portfolioSize * 0.4))} position${Math.round(cfg.portfolioSize * 0.4) > 1 ? 's' : ''}. Consider adding defensive ETFs (GLD, TLT) manually during high-VIX regimes.</div></div>` : id === 'secured' ? `<div class="step" style="background:#ecfeff;border:1px solid #a5f3fc;border-radius:8px;padding:.65rem .9rem"><span class="step-n" style="background:#0891b2"><i class="fas fa-satellite" style="font-size:.5rem"></i></span><div><b>Orbit = patience.</b> This mode holds ${cfg.horizon} trading days (~${Math.round(cfg.horizon / 5)} weeks) with ${cfg.atrStopMult}× ATR stops — much wider than other modes. The key insight: the scanner already picks winners, but short horizons (5–8d) exit before the move fully develops. Orbit lets the trade breathe through intraday noise and captures the full trend arc. <b>Do NOT</b> panic-sell on red days — the wide stop is your safety net. If it doesn't hit, the trade is still working.</div></div>` : ''}
    </div>
    <div class="method-footer">
      <span><i class="fas fa-layer-group"></i> ${cfg.portfolioSize} ${cfg.portfolioSize === 1 ? 'trade' : 'trades'} max · ${alloc}% each</span>
      <span><i class="fas fa-calendar-days"></i> Close after ${cfg.horizon} trading days</span>
      ${cfg.maxStopPct > 0 ? `<span><i class="fas fa-shield-halved"></i> Hard stop at −${cfg.maxStopPct}%</span>` : ''}
      ${cfg.partialTP ? `<span><i class="fas fa-scissors"></i> Sell ${Math.round((cfg.partialTPPct || 0.3) * 100)}% at TP1</span>` : ''}
    </div>
  </details>
</div>

<!-- ══ 2. TODAY'S SIGNALS (open by default — dashboard context) ══ -->
<div class="section-card">
  <details${sig.length ? ' open' : ''}>
    <summary class="sc-summary">
      <span class="sc-sum-title"><i class="fas fa-signal" style="color:#94a3b8;font-size:.78rem"></i> Today's Signals <span class="count">${sig.length} setup${sig.length === 1 ? '' : 's'}${fallback.length ? ' + ' + fallback.length + ' fallback' : ''}</span>${sig.length ? `<span class="sc-preview">${sig.slice(0,3).map(s => `<b>${s.ticker}</b> <span style="color:#94a3b8">${s.score}</span>`).join(' · ')}</span>` : ''}</span>
      ${scanDir ? `<a href="/scanner/${scanDir}/" class="sc-link" onclick="event.stopPropagation()">Full scan <i class="fas fa-arrow-right" style="font-size:.6rem"></i></a>` : ''}
    </summary>
    ${sig.length ? `<table class="t" style="margin-top:.75rem">
      <thead><tr><th>Ticker</th><th>Score</th><th>Setup</th><th>Entry</th><th>Stop</th><th>TP1/TP2</th><th>R/R</th><th>Status</th></tr></thead>
      <tbody>${sig.map((s, i) => {
      const bg = s.score >= 90 ? '#059669' : s.score >= 85 ? '#2563eb' : '#f59e0b';
      const shariaTag = s.sharia === true ? '<span class="pill am" style="background:#059669;color:#fff;font-size:.6rem;padding:.1rem .35rem;margin-left:.3rem" title="Sharia Compliant">HALAL</span>'
        : s.sharia === false ? '<span class="pill am" style="background:#94a3b8;color:#fff;font-size:.6rem;padding:.1rem .35rem;margin-left:.3rem" title="Not Sharia Compliant">CONV</span>' : '';
      const _ohlc = signalOhlc[s.ticker] || {};
      return `<tr data-sig-ticker="${s.ticker}" data-sig-entry="${s._entry}" data-sig-stop="${s._stop}" data-sig-tp1="${s._tp1}" data-sig-tp2="${s._tp2 || ''}" data-sig-vwap="${s.vwapRef || ''}" data-sig-rank="primary" data-sig-open="${_ohlc.open || ''}" data-sig-high="${_ohlc.high || ''}" data-sig-low="${_ohlc.low || ''}" data-sig-price="${_ohlc.price || ''}"><td>${tkLogo(s.ticker)}<b>${s.ticker}</b>${shariaTag}</td><td><span class="pill-score" style="background:${bg}">${s.score}</span></td><td class="m">${s.strategy}</td><td>${s.entry}</td><td class="neg">${s.stop}</td><td class="pos">${s.tp1} / ${s.tp2}</td><td class="am">${s.rr}</td><td><span class="pill ${_sigStatusCls}"${_sigStatusLabel === 'LIVE' ? ' style="background:#ecfdf5;color:#059669;border:1px solid #a7f3d0"' : ''}>${_sigStatusLabel}</span></td></tr>`;
    }).join('')}${fallback.length ? `<tr><td colspan="8" style="text-align:center;padding:.45rem;background:#f8fafc;font-size:.68rem;color:#94a3b8;font-weight:600;border-top:2px dashed #e2e8f0"><i class="fas fa-arrow-down" style="margin-right:.3rem"></i>Fallback candidates (if signal above skipped by VWAP gate)</td></tr>${fallback.map((s, i) => {
      const bg = s.score >= 90 ? '#059669' : s.score >= 85 ? '#2563eb' : '#f59e0b';
      const shariaTag = s.sharia === true ? '<span class="pill am" style="background:#059669;color:#fff;font-size:.6rem;padding:.1rem .35rem;margin-left:.3rem" title="Sharia Compliant">HALAL</span>' : s.sharia === false ? '<span class="pill am" style="background:#94a3b8;color:#fff;font-size:.6rem;padding:.1rem .35rem;margin-left:.3rem">CONV</span>' : '';
      const _ohlc = signalOhlc[s.ticker] || {};
      return `<tr data-sig-ticker="${s.ticker}" data-sig-entry="${s._entry}" data-sig-stop="${s._stop}" data-sig-tp1="${s._tp1}" data-sig-tp2="${s._tp2 || ''}" data-sig-vwap="${s.vwapRef || ''}" data-sig-rank="fallback" data-sig-open="${_ohlc.open || ''}" data-sig-high="${_ohlc.high || ''}" data-sig-low="${_ohlc.low || ''}" data-sig-price="${_ohlc.price || ''}" style="opacity:.55"><td>${tkLogo(s.ticker)}<b>${s.ticker}</b>${shariaTag}<span class="pill m" style="font-size:.55rem;margin-left:.3rem">#${cfg.topN + i + 1}</span></td><td><span class="pill-score" style="background:${bg}">${s.score}</span></td><td class="m">${s.strategy}</td><td>${s.entry}</td><td class="neg">${s.stop}</td><td class="pos">${s.tp1} / ${s.tp2}</td><td class="am">${s.rr}</td><td><span class="pill ${_sigStatusCls}">${_sigStatusLabel}</span></td></tr>`;
    }).join('')}` : ''}</tbody>
    </table>` : (() => {
      // Contextual empty state: explain WHY 0 signals (vs generic "no signals today")
      const total = (signals || []).length;
      if (total === 0) {
        return `<p class="empty"><i class="fas fa-inbox"></i>No signals published today.</p>`;
      }
      const f = SF[cfg.filterName] || (() => true);
      const afterFilter = signals.filter(s => f(s.strategy || ''));
      const afterScore = afterFilter.filter(s => cfg.minScore <= 0 || s.score >= cfg.minScore);
      let reason;
      if (afterFilter.length === 0) {
        reason = `Filter <b>${filterLabel(cfg.filterName)}</b> excluded all ${total} signal${total > 1 ? 's' : ''} today (no matching strategy).`;
      } else if (afterScore.length === 0) {
        reason = `${afterFilter.length} signal${afterFilter.length > 1 ? 's' : ''} matched filter <b>${filterLabel(cfg.filterName)}</b> but none reached minScore <b>${cfg.minScore}</b>.`;
      } else {
        reason = `No new signals for this mode today.`;
      }
      return `<p class="empty"><i class="fas fa-inbox"></i>${reason} Existing positions remain active.</p>`;
    })()}
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
    <div class="ps" title="Cumulative percent gain since strategy inception (2026-02-26). Includes mark-to-market on open positions.">
      <span class="ps-v" style="color:${cfg.color}">${m.ret > 0 ? '+' : ''}${m.ret}%</span><span class="ps-l">Total Return${m.unrealized ? ' <small style="opacity:.6">(incl. ' + (m.unrealized > 0 ? '+' : '') + m.unrealized + '% MtM)</small>' : ''}</span>
    </div>
    <div class="ps" title="Largest peak-to-trough drop on the equity curve. Lower is better; measures worst pain experienced.">
      <span class="ps-v" style="color:#dc2626">${m.dd}%</span><span class="ps-l">Max Drawdown</span>
    </div>
    <div class="ps" title="Share of resolved trades that ended profitable. 50% with high R:R is normal for momentum strategies.">
      <span class="ps-v">${m.wr}%</span><span class="ps-l">Win Rate</span>
    </div>
    <div class="ps" title="Sum of winning P&amp;L divided by sum of losing P&amp;L. >1 = profitable. >2 = robust. >5 = small-sample inflated.${m.pfLow != null && m.pfHigh != null ? ` 90% bootstrap CI: [${m.pfLow}x — ${m.pfHigh}x] over ${m.trades} trades.` : (m.pfReliable === false ? ` Sample ${m.trades}<50 trades — point estimate only, treat as fragile.` : '')}">
      <span class="ps-v">${m.pf}x${m.pfLow != null && m.pfHigh != null ? `<span style="font-size:.55rem;color:#94a3b8;margin-left:.2rem;font-weight:500">[${m.pfLow}–${m.pfHigh}]</span>` : ''}</span><span class="ps-l">Profit Factor${m.pfReliable === false ? ' <span style="color:#d97706;font-size:.55rem;background:#fef3c7;padding:0 .25rem;border-radius:3px;font-weight:700;text-transform:uppercase">small n</span>' : ''}</span>
    </div>
    <div class="ps" title="Number of fully-closed trades counted in the stats above. Pending/open positions excluded.">
      <span class="ps-v">${m.trades}</span><span class="ps-l">Closed Trades</span>
    </div>
    <div class="ps" title="Average number of trading days each closed trade was held.">
      <span class="ps-v">${m.avgHold}d</span><span class="ps-l">Avg Hold</span>
    </div>
    <div class="ps" title="R-squared: how closely the equity curve follows a straight line. 1.0 = perfect linear growth, 0 = random.">
      <span class="ps-v">${m.r2 != null ? m.r2.toFixed(3) : '—'}</span><span class="ps-l">R²</span>
    </div>
    <div class="ps" title="Compound Annual Growth Rate: annualized return extrapolated from the equity curve.">
      <span class="ps-v">${m.cagr != null ? (m.cagr > 0 ? '+' : '') + m.cagr + '%' : '—'}</span><span class="ps-l">CAGR</span>
    </div>
    <div class="ps" title="Annualized Sharpe Ratio: risk-adjusted return (daily returns × √252). >1 = good, >2 = excellent, >3 = elite.">
      <span class="ps-v">${m.sharpe != null ? m.sharpe : '—'}</span><span class="ps-l">Sharpe</span>
    </div>
  </div>
</div>

<!-- ══ 4. CLOSE NOW ══ -->
${timedOut.length ? `<div class="cta-card cta-close" data-section="closenow">
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
      return `<tr><td>${tkLogo(p.ticker)}<b>${p.ticker}</b></td><td class="m">${p.scan_date ? p.scan_date.slice(5) : '—'}</td><td class="hide-m">$${(p.entry || 0).toFixed(2)}</td><td class="hide-m">$${(p.current_price || 0).toFixed(2)}</td><td class="${rc}"><b>${p.return_pct > 0 ? '+' : ''}${p.return_pct}%</b></td><td class="am">${held}d / ${cfg.horizon}d</td><td><span class="pill neg" style="font-size:.7rem;padding:.15rem .5rem">CLOSE</span></td></tr>`;
    }).join('')}</tbody>
  </table>
</div>` : ''}

<!-- ══ 5. ORDERS CTA ══ -->
${(() => {
        const alloc = Math.round(100 / cfg.portfolioSize * (cfg.positionSizePct || 1));
        const openTickers = new Set(pos.filter(p => !p._terminal).map(p => p.ticker));
        const sigFiltered = sig.filter(s => !openTickers.has(s.ticker));
        const slotsAvailable = Math.max(0, cfg.portfolioSize - liveCount);

        // BUY orders: signals that fit into available slots (max = free slots)
        const buyOrders = sigFiltered.slice(0, slotsAvailable);

        // ROTATION candidates (for all rotation modes when portfolio full):
        const rotationCandidates = [];
        if (cfg.rotation !== 'none' && slotsAvailable === 0 && livePos.length > 0 && sigFiltered.length > 0) {
          const rotLimit = cfg.rotation === 'daily_max1' ? 1 : cfg.rotation === 'daily_max2' ? 2 : cfg.portfolioSize;
          const margin = cfg.rotation === 'aggressive' ? 0 : 5; // daily_max needs +5pt advantage
          const worstPos = [...livePos].sort((a, b) => a.return_pct - b.return_pct)[0];
          const worstScore = worstPos.score || 0;
          for (const s of sigFiltered.slice(0, 5)) {
            if (rotationCandidates.length >= rotLimit) break;
            const meetsMargin = margin > 0 ? (s.score - worstScore >= margin) : (s.score >= 88 && worstPos.return_pct < 2);
            if (meetsMargin) {
              rotationCandidates.push({ signal: s, replaces: worstPos, scoreDelta: s.score - worstScore });
              break; // one rotation at a time
            }
          }
        }

        // recentExecutedRotation is hoisted at panel() top level so both Orders
        // and Trade History sections can use it.

        // WATCH: signals that could not be placed and don't qualify for rotation.
        // Only shown if portfolio is full and there are remaining signals worth monitoring.
        const scanDateStr = scanDir ? `${scanDir.slice(0, 4)}-${scanDir.slice(4, 6)}-${scanDir.slice(6, 8)}` : null;
        const scanAge = scanDateStr ? Math.round((Date.now() - new Date(scanDateStr)) / 86400000) : 0;
        const timeoutDays = 2;
        function addBizDays(dateStr, n) {
          const d = new Date(dateStr + 'T12:00:00Z');
          let added = 0;
          while (added < n) { d.setDate(d.getDate() + 1); const dow = d.getUTCDay(); if (dow !== 0 && dow !== 6) added++; }
          return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
        }
        const expiryLabel = scanDateStr ? addBizDays(scanDateStr, timeoutDays) : '—';
        const isExpired = scanAge > timeoutDays;

        // Watch = overflow signals when portfolio is full and no rotation triggered
        const watchPool = slotsAvailable === 0
          ? sigFiltered.filter(s => !rotationCandidates.some(r => r.signal.ticker === s.ticker)).slice(0, 3)
          : [];

        // ── Render: BUY → ROTATE (Close Now lives in its own card, no duplicate SELL row) ──
        // Compact mode: when many orders queue up, suppress per-row thesis prose +
        // rotation comparison card to keep the table from steamrolling the equity
        // curve and pushing other sections off-screen.
        const _ttlActions = buyOrders.length + rotationCandidates.length;
        const compactRows = _ttlActions > 3;
        const actionRows = [];
        for (let i = 0; i < buyOrders.length; i++) {
          const s = buyOrders[i];
          const bg = s.score >= 90 ? '#059669' : s.score >= 85 ? '#2563eb' : '#f59e0b';
          const sht = s.sharia === true ? ' <span class="pill am" style="background:#059669;color:#fff;font-size:.55rem;padding:.1rem .3rem" title="Sharia Compliant">HALAL</span>' : s.sharia === false ? ' <span class="pill am" style="background:#94a3b8;color:#fff;font-size:.55rem;padding:.1rem .3rem" title="Conventional">CONV</span>' : '';
          const thesisCols = 11; // number of columns in Orders table
          const vwapCell = s.vwapRef ? `$${s.vwapRef.toFixed(2)}` : '—';
          actionRows.push(`<tr>
      <td>${tkLogo(s.ticker)}<b>${s.ticker}</b>${sht}</td>
      <td class="hide-m"><img src="https://charts2-node.finviz.com/chart?t=${s.ticker}&tf=d&s=linear&ct=candle_stick&o[0][ot]=sma&o[0][op]=20&o[0][oc]=DC32B363&o[1][ot]=sma&o[1][op]=50&o[1][oc]=FF8F33C6&o[2][ot]=sma&o[2][op]=200&o[2][oc]=DCB3326D" alt="${s.ticker}" class="fv-thumb" onclick="fvOpen('${s.ticker}')"></td>
      <td class="hide-m"><span class="pill-score" style="background:${bg}">${s.score}</span></td>
      <td class="m hide-m">${s.strategy}</td><td><b>${s.entry}</b></td>
      <td class="am hide-m" title="Pivot J-1 (H+L+C)/3 — skip si open > pivot×1.01">${vwapCell}</td>
      <td class="neg">${s.stop}</td>
      <td class="pos">${s.tp1}<span class="hide-m"> / ${s.tp2}</span></td>
      <td class="am hide-m">${s.rr}</td><td class="m hide-m">${alloc}%</td>
      <td><span class="pill pos">BUY</span></td>
    </tr>${s.thesis ? `<tr class="thesis-row"><td colspan="${thesisCols}"><div class="thesis-text">${s.thesis}</div></td></tr>` : ''}`);
        }
        for (const { signal: s, replaces, scoreDelta } of rotationCandidates) {
          const thesisCols = 11;
          const bg = s.score >= 90 ? '#059669' : s.score >= 85 ? '#2563eb' : '#f59e0b';
          const repBg = (replaces.score || 0) >= 90 ? '#059669' : (replaces.score || 0) >= 85 ? '#2563eb' : '#94a3b8';
          const deltaSign = (scoreDelta || 0) >= 0 ? '+' : '';
          const deltaColor = (scoreDelta || 0) >= 5 ? '#059669' : (scoreDelta || 0) >= 0 ? '#f59e0b' : '#dc2626';
          const rotVwapCell = s.vwapRef ? `$${s.vwapRef.toFixed(2)}` : '—';
          actionRows.push(`<tr style="background:#fefce8">
      <td>${tkLogo(s.ticker)}<b>${s.ticker}</b></td>
      <td class="hide-m"><img src="https://charts2-node.finviz.com/chart?t=${s.ticker}&tf=d&s=linear&ct=candle_stick&o[0][ot]=sma&o[0][op]=20&o[0][oc]=DC32B363&o[1][ot]=sma&o[1][op]=50&o[1][oc]=FF8F33C6&o[2][ot]=sma&o[2][op]=200&o[2][oc]=DCB3326D" alt="${s.ticker}" class="fv-thumb" onclick="fvOpen('${s.ticker}')"></td>
      <td class="hide-m"><span class="pill-score" style="background:${bg}">${s.score}</span></td>
      <td class="m hide-m">${s.strategy}</td><td><b>${s.entry}</b></td>
      <td class="am hide-m" title="Pivot J-1 (H+L+C)/3 — skip si open > pivot×1.01">${rotVwapCell}</td>
      <td class="neg">${s.stop}</td>
      <td class="pos">${s.tp1}<span class="hide-m"> / ${s.tp2}</span></td>
      <td class="am hide-m">${s.rr}</td><td class="m hide-m">${alloc}%</td>
      <td><span class="pill am">ROTATE ↔ ${replaces.ticker}</span></td>
    </tr>${compactRows ? '' : `
    <tr class="thesis-row"><td colspan="${thesisCols}">
      <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:.75rem;align-items:center;padding:.5rem .75rem;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:.8rem">
        <div style="text-align:center">
          <div style="font-size:.65rem;text-transform:uppercase;color:#92400e;font-weight:600;margin-bottom:.3rem">Close</div>
          <div style="font-weight:700;font-size:.95rem">${replaces.ticker}</div>
          <div>Score <span class="pill-score" style="background:${repBg};font-size:.7rem;padding:.1rem .4rem">${replaces.score || '—'}</span></div>
          <div style="color:${(replaces.return_pct || 0) >= 0 ? '#059669' : '#dc2626'}">${(replaces.return_pct || 0) > 0 ? '+' : ''}${(replaces.return_pct || 0).toFixed(2)}%</div>
          <div style="color:#64748b;font-size:.7rem">${replaces.days_remaining || 0}d left</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:1.3rem">→</div>
          <div style="font-weight:700;color:${deltaColor};font-size:.85rem">${deltaSign}${scoreDelta || 0} pts</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:.65rem;text-transform:uppercase;color:#059669;font-weight:600;margin-bottom:.3rem">Buy</div>
          <div style="font-weight:700;font-size:.95rem">${s.ticker}</div>
          <div>Score <span class="pill-score" style="background:${bg};font-size:.7rem;padding:.1rem .4rem">${s.score}</span></div>
          <div style="color:#64748b">${s.entry} → ${s.tp1}</div>
          <div style="color:#64748b;font-size:.7rem">R/R ${s.rr}</div>
        </div>
      </div>
    </td></tr>`}`);
          if (s.thesis && !compactRows) actionRows.push(`<tr class="thesis-row"><td colspan="${thesisCols}"><div class="thesis-text">${s.thesis}</div></td></tr>`);
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

        // Count logical orders (1 per buy, 1 per rotation), NOT TR rows
        // (each order can push 1-3 <tr> for main+comparison+thesis).
        const totalActions = buyOrders.length + rotationCandidates.length;
        const occupied = liveCount;
        const statusLine = slotsAvailable > 0
          ? `${occupied}/${cfg.portfolioSize} open — <b>${slotsAvailable} slot${slotsAvailable > 1 ? 's' : ''} free</b> — place at next open`
          : `${occupied}/${cfg.portfolioSize} open — portfolio full${rotationCandidates.length ? ' — rotation opportunity' : ''}`;

        // Just-executed rotation card (always shown when recentExecutedRotation exists)
        const recentRotationHTML = recentExecutedRotation ? `
<div class="cta-card" style="background:#ecfdf5;border:1px solid #a7f3d0;border-left:4px solid #059669;margin-bottom:.75rem;padding:.7rem 1rem;border-radius:8px">
  <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;font-size:.82rem">
    <span style="background:#059669;color:#fff;padding:.15rem .45rem;border-radius:4px;font-weight:700;font-size:.6rem;letter-spacing:.06em"><i class="fas fa-check-circle"></i> JUST EXECUTED</span>
    <span style="color:#92400e;font-weight:700">CLOSE</span>
    <b style="color:#dc2626">${recentExecutedRotation.replaces || '?'}</b>
    <span style="color:#059669;font-size:1.1rem">⟶</span>
    <span style="color:#065f46;font-weight:700">BUY</span>
    <b style="color:#059669">${recentExecutedRotation.ticker}</b>
    ${recentExecutedRotation.score ? `<span class="pill-score" style="background:#059669;font-size:.65rem;padding:.1rem .4rem">${recentExecutedRotation.score}</span>` : ''}
    <span style="margin-left:auto;color:#059669;font-size:.7rem"><i class="fas fa-clock"></i> ${recentExecutedRotation.fromDate || 'previous'}</span>
  </div>
  <div style="margin-top:.4rem;font-size:.7rem;color:#065f46">Yesterday's rotation order applied — <b>${recentExecutedRotation.replaces || '?'}</b> closed, <b>${recentExecutedRotation.ticker}</b> now in portfolio.</div>
</div>` : '';

        if (totalActions === 0 && watchPool.length === 0 && !recentExecutedRotation) {
          return `<div class="section-card"><div class="sc-head"><h3><i class="fas fa-inbox"></i> Orders</h3><span class="sc-meta">Portfolio full &mdash; no action needed</span></div><p class="empty"><i class="fas fa-check-circle"></i>All slots filled, nothing to place</p></div>`;
        }
        if (totalActions === 0 && watchPool.length === 0 && recentExecutedRotation) {
          // Render "Orders to Place" header WITH the Recent Rotation card inside.
          return `<div class="section-card cta-orders">
  <div class="sc-head">
    <h3><i class="fas fa-bolt"></i> Orders to Place</h3>
    <span class="sc-meta">${statusLine} — yesterday's rotation applied</span>
  </div>
  ${recentRotationHTML}
  <p class="empty" style="margin:.5rem 0 0"><i class="fas fa-check-circle"></i> All slots filled — no new orders to place at next open.</p>
</div>`;
        }

        return `
${expiringSoon.length ? `<div class="cta-card" data-section="expiring" style="background:#fffbeb;border:1.5px solid #fde68a;border-left:4px solid #f59e0b">
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
          return `<tr><td>${tkLogo(p.ticker)}<b>${p.ticker}</b></td><td>$${(p.entry || 0).toFixed(2)}</td><td class="${rc}"><b>${p.return_pct > 0 ? '+' : ''}${p.return_pct}%</b></td><td class="neg">$${(p.stop || 0).toFixed(2)}</td><td class="am">${held}d/${cfg.horizon}d</td></tr>`;
        }).join('')}</tbody>
  </table>
</div>` : ''}

<div class="section-card ${totalActions > 0 ? 'cta-orders' : ''}" data-section="orders" data-scan-date="${scanDir}">
  <div class="sc-head">
    <h3>${totalActions > 0 ? '<i class="fas fa-bolt"></i>' : '<i class="fas fa-coffee" style="color:#94a3b8"></i>'} ${totalActions > 0 ? `${totalActions} Order${totalActions > 1 ? 's' : ''} to Place` : 'No new orders'}</h3>
    <span class="sc-meta">${statusLine}</span>
    ${totalActions > 0 && cfg.vwapGate ? `<div style="flex:0 0 100%;margin:.35rem 0 0;padding:.4rem .65rem;background:#fffbeb;border:1px solid #fde68a;border-left:3px solid #f59e0b;border-radius:6px;font-size:.7rem;color:#78350f;display:flex;gap:.4rem;align-items:flex-start" role="note">
      <i class="fas fa-circle-info" style="color:#d97706;margin-top:.12rem;flex-shrink:0"></i>
      <span><b>VWAP gate active:</b> orders fill only if next open ≤ pivot × 1.01. Gap-up above pivot ⇒ skip (by design).</span>
    </div>` : ''}
  </div>
  ${recentRotationHTML}
  ${totalActions > 0 ? `<table class="t">
    <thead><tr><th>Ticker</th><th class="hide-m">Chart</th><th class="hide-m">Score</th><th class="hide-m">Strat.</th><th>Entry</th><th class="hide-m">Pivot</th><th>Stop</th><th>TP1/TP2</th><th class="hide-m">R/R</th><th class="hide-m">Alloc</th><th>Action</th></tr></thead>
    <tbody>${actionRows.join('')}</tbody>
  </table>` : `<div style="padding:.6rem .85rem;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:6px;font-size:.78rem;color:#475569;text-align:center">${timedOut.length ? `Today's only action: see <b>Close Now</b> above.` : (watchRows.length ? `Portfolio full — see <b>On Watch</b> below.` : `No actions today.`)}</div>`}
</div>
${watchRows.length ? `<div class="section-card" data-section="watch">
  <div class="sc-head">
    <h3><i class="fas fa-eye"></i> On Watch <span class="count">${watchRows.length}</span></h3>
    <span class="sc-meta">portfolio full — signals expire ${expiryLabel}</span>
  </div>
  <table class="t">
    <thead><tr><th>Ticker</th><th>Score</th><th class="hide-m">Strat.</th><th>Entry</th><th>Stop</th><th>TP1/TP2</th><th class="hide-m">R/R</th><th>Status</th></tr></thead>
    <tbody>${watchRows.join('')}</tbody>
  </table>
</div>` : ''}`;
      })()}

<!-- ══ 6. OPEN POSITIONS (all — expired flagged) ══ -->
<div class="section-card" id="sec-pos-${id}">
  <div class="sc-head">
    <h3><i class="fas fa-folder-open"></i> Open Positions <span class="count">${liveCount}/${cfg.portfolioSize}${terminalCount ? ' + ' + terminalCount + ' closed today' : ''}${pos.length > liveCount + terminalCount ? ' + ' + (pos.length - liveCount - terminalCount) + ' expired' : ''}</span></h3>
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
    <thead><tr><th>Ticker</th><th class="hide-m">Chart</th><th class="hide-m">Bought</th><th class="hide-m">Entry</th><th class="hide-m">Pivot</th><th class="hide-m">Now</th><th>P&amp;L</th><th class="hide-m">Stop</th><th class="hide-m">TP2</th><th>Left</th></tr></thead>
    <tbody>${pos.map(p => {
          const rc = p.return_pct >= 0 ? 'pos' : 'neg';
          const left = Math.max(0, cfg.horizon - bizDaysHeld(p.scan_date));
          const isExpired = !p._terminal && left <= 0;
          const isTerminal = p._terminal;
          const termBadge = isTerminal ? { sl: 'SL', tp1: 'TP1', tp1_partial: 'TP1', tp2: 'TP2', expired: 'EXP', rotated: 'ROT', breakeven: 'B.EVEN', trail: 'TRAIL' }[p._terminalStatus] || p._terminalStatus || 'CLOSED' : '';
          const leftCls = isTerminal ? 'neg' : isExpired ? 'neg' : left <= 1 ? 'neg' : left <= 2 ? 'am' : 'm';
          const leftLabel = isTerminal ? `<span class="pill neg" style="font-size:.65rem;padding:.1rem .4rem">${termBadge}</span>` : isExpired ? '<span class="pill neg" style="font-size:.65rem;padding:.1rem .4rem">EXPIRED</span>' : left + 'd';
          const rowStyle = isTerminal ? ' style="opacity:.45;background:#f1f5f9;filter:grayscale(1)"' : isExpired ? ' style="opacity:.6;background:#fef2f2"' : '';
          const posCols = 10; // columns in Open Positions table
          const posVwap = p.vwap ? '$' + p.vwap.toFixed(2) : '—';
          return `<tr${rowStyle}><td>${tkLogo(p.ticker)}<b>${p.ticker}</b></td><td class="hide-m"><img src="https://charts2-node.finviz.com/chart?t=${p.ticker}&tf=d&s=linear&ct=candle_stick" alt="${p.ticker}" class="fv-thumb" onclick="fvOpen('${p.ticker}')"></td><td class="m hide-m">${p.scan_date ? p.scan_date.slice(5) : '—'}</td><td class="hide-m">$${(p.entry || 0).toFixed(2)}</td><td class="am hide-m" title="Pivot entrée (H+L+C)/3">${posVwap}</td><td class="hide-m">$${(p.current_price || 0).toFixed(2)}</td><td class="${rc}"><b>${p.return_pct > 0 ? '+' : ''}${p.return_pct}%</b></td><td class="neg hide-m">$${(p.stop || 0).toFixed(2)}</td><td class="pos hide-m">${p.tp2 ? '$' + p.tp2.toFixed(2) : (p.tp1 ? '$' + p.tp1.toFixed(2) : '—')}</td><td class="${leftCls}">${leftLabel}</td></tr>${p.thesis ? `<tr class="thesis-row"${rowStyle}><td colspan="${posCols}"><div class="thesis-text">${p.thesis}</div></td></tr>` : ''}`;
        }).join('')}</tbody>
  </table>` : `<p class="empty"><i class="fas fa-inbox"></i>
    <span><b>No active positions</b><br><span style="font-size:.72rem;color:#94a3b8">${cfg.portfolioSize === 1 ? 'Single-slot mode — entries open only when a signal passes minScore (' + (cfg.minScore || 85) + ') and entry-gate (VWAP/ATR).' : 'All ' + cfg.portfolioSize + ' slots empty — either no signal cleared minScore (' + (cfg.minScore || 85) + ') today or stale exits closed prior holds.'}</span></span>
  </p>`}
</div>

<!-- ══ 7. TRADE HISTORY (collapsible) ══ -->
<div class="section-card" id="sec-hist-${id}">
  <details>
    <summary class="sc-summary"><span class="sc-sum-title"><i class="fas fa-clock-rotate-left" style="color:#94a3b8;font-size:.78rem"></i> Trade History <span class="count">${m.trades} closed</span></span></summary>
  <table class="t" style="margin-top:.6rem">
    <thead><tr><th>Ticker</th><th class="hide-m">Start</th><th class="hide-m">End</th><th class="hide-m">Entry</th><th class="hide-m">Exit</th><th>P&amp;L</th><th class="hide-m">Hold</th><th>Result</th></tr></thead>
    <tbody>${(() => {
        // Only show pending trades that actually made it into open positions (capped to portfolioSize).
        // Premature trades that were dropped by the cap are backtest overflow — hiding them keeps
        // Trade History consistent with Open Positions (no orphan "Pending" rows).
        // ALSO keep yesterday's positions that were just rotated out — otherwise the rotation
        // closes the trade with status='expired' + _premature=true and it disappears from history.
        const keptPremature = new Set(pos.map(p => p.ticker + '|' + p.scan_date));
        if (prevSnap && prevSnap.modes && prevSnap.modes[id]) {
          for (const p of (prevSnap.modes[id].positions || [])) {
            keptPremature.add(p.ticker + '|' + p.scan_date);
          }
        }
        // Mark trades that were rotated-out so their status renders as "Rotated" (not Pending/Expired)
        const rotatedKeys = new Set();
        if (recentExecutedRotation && recentExecutedRotation.replaces && recentExecutedRotation.fromDate) {
          rotatedKeys.add(recentExecutedRotation.replaces + '|' + recentExecutedRotation.fromDate);
        }
        const _todayISOLocal = new Date().toISOString().slice(0, 10);
        // Try to use the live current price for the rotated ticker as a better
        // exit-price approximation (sweep.js's synthesized exit is at scan-day
        // which is wrong for rotation-closed trades).
        const rotatedTickerLive = (recentExecutedRotation && recentExecutedRotation.replaces)
          ? (livePositions || []).find(p => p.ticker === recentExecutedRotation.replaces)
          : null;
        // Trade History = closed trades only (status !== 'pending'). Open positions live in their own section.
        // Premature trades from rotation (status='expired' + _premature) ARE kept if they match keptPremature.
        const filtered = trades
          .filter(t => t.status !== 'pending')
          .filter(t => !t._premature || keptPremature.has(t.ticker + '|' + t.scanDate))
          .map(t => {
          if (rotatedKeys.has(t.ticker + '|' + t.scanDate)) {
            const exitPrice = rotatedTickerLive && rotatedTickerLive.current_price
              ? rotatedTickerLive.current_price
              : t.exitPrice;
            const pnlPct = (t.actualEntry > 0 && exitPrice > 0)
              ? +(((exitPrice - t.actualEntry) / t.actualEntry) * 100).toFixed(2)
              : t.pnlPct;
            return { ...t, status: 'rotated', exitDate: _todayISOLocal, exitPrice, pnlPct, _rotatedTo: recentExecutedRotation && recentExecutedRotation.ticker };
          }
          return t;
        });
        const sorted = [...filtered].sort((a, b) => (b.scanDate || '').localeCompare(a.scanDate || ''));
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
        const _etTime = iso => { if (!iso) return ''; if (/^\d{2}:\d{2}$/.test(iso)) return iso; if (iso.length <= 16 && iso.includes('T')) return iso.slice(11, 16); try { return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' }); } catch { return iso.slice(11, 16); } };
        return sorted.map(t => {
          const pnl = t.pnlPct || 0;
          const cls = pnl > 0 ? 'pos' : pnl < 0 ? 'neg' : 'm';
          let exitDate = '—';
          if (t.exitDate) { exitDate = t.exitDate.slice(5, 10); }
          else if (t.entryDate && t.holdDays) { const d = new Date(t.entryDate); d.setDate(d.getDate() + t.holdDays); exitDate = d.toISOString().slice(5, 10); }
          const entryTimeFmt = t.entryTime ? `<br><span style="font-size:.6rem;color:#94a3b8">${_etTime(t.entryTime)} ET</span>` : '';
          const exitTimeFmt = t.exitTime ? `<br><span style="font-size:.6rem;color:#94a3b8">${_etTime(t.exitTime)} ET</span>` : '';
          let statusLabel, statusShort, statusCls;
          switch (t.status) {
            case 'tp1': statusLabel = 'Target 1 hit'; statusShort = 'TP1 ✓'; statusCls = 'pos'; break;
            case 'tp2': statusLabel = 'Target 2 hit'; statusShort = 'TP2 ✓'; statusCls = 'pos'; break;
            case 'tp1_partial': { const _tpPct = Math.round((cfg.partialTPPct || 0.3) * 100); statusLabel = `TP1 partial (${_tpPct}%)`; statusShort = `TP1 ${_tpPct}%`; statusCls = 'pos'; break; }
            case 'sl': statusLabel = 'Stop loss hit'; statusShort = 'SL ✗'; statusCls = 'neg'; break;
            case 'expired': {
              // A trade is "Pending" only if its horizon hasn't actually expired in real time.
              // _premature alone is set whenever holdDays < cfg.horizon — but the trade can already
              // be terminal (rotated/early-exit/horizon-expired). Use _horizonExpired to gate.
              const stillPending = t._premature && !t._horizonExpired;
              if (stillPending) {
                statusLabel = 'Pending (' + (t.holdDays || 0) + 'd/' + cfg.horizon + 'd)';
                statusShort = statusLabel;
                statusCls = 'pending';
              } else {
                statusLabel = 'Expired';
                statusShort = 'Expired';
                statusCls = 'am';
              }
              break;
            }
            case 'rotated': { const rep = replacedBy[t.ticker + t.scanDate]; statusLabel = rep ? 'Replaced by ' + rep : 'Rotated out'; statusShort = rep ? '↔ ' + rep : 'Rotated'; statusCls = 'm'; break; }
            default: statusLabel = t.status || '—'; statusShort = statusLabel; statusCls = 'm';
          }
          return `<tr>
          <td>${t.ticker ? tkLogo(t.ticker) : ''}<b>${t.ticker || '—'}</b></td>
          <td class="m hide-m">${t.entryDate ? t.entryDate.slice(5) : '—'}${entryTimeFmt}</td>
          <td class="m hide-m">${exitDate}${exitTimeFmt}</td>
          <td class="hide-m">$${(t.actualEntry || 0).toFixed(2)}</td>
          <td class="hide-m">${t.exitPrice ? '$' + t.exitPrice.toFixed(2) : '—'}</td>
          <td class="${cls}"><b>${pnl > 0 ? '+' : ''}${pnl}%</b></td>
          <td class="m hide-m">${t.holdDays || 0}d</td>
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
  const buildVer = Date.now();
  const html = `<!DOCTYPE html>
<html lang="en" data-tags="technique,formation,trade-idea,us,eu,asia,etf" data-tab="scanner">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Portfolio Live &mdash; DailyTickers</title>
  <meta name="description" content="Today's signals, open positions &amp; live performance — Balanced trading mode updated every weekday.">
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-T5Z595CW');</script>
  <link rel="stylesheet" href="/assets/report.css?v=${buildVer}">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
  <style>
*{box-sizing:border-box}
html,body{overflow-x:hidden;max-width:100vw}
body{background:#f1f5f9;font-family:'Inter',sans-serif;color:#0f172a;margin:0}
.w{max-width:1080px;margin:0 auto;padding:0 1.5rem 4rem;width:100%}
.mode-panel{min-width:0;max-width:100%;overflow-x:hidden}
.mode-panel>*{min-width:0;max-width:100%}
.mode-tabs{display:flex;gap:.5rem;margin-bottom:1.5rem;padding:.25rem;background:#f1f5f9;border-radius:12px}
.mode-tab{flex:1;padding:.65rem 1rem;border:none;background:transparent;border-radius:10px;cursor:pointer;font-size:.85rem;font-weight:600;color:#64748b;display:flex;align-items:center;justify-content:center;gap:.4rem;transition:all .2s}
.mode-tab:focus-visible{outline:2px solid var(--mc,#0f172a);outline-offset:2px}
@media(max-width:600px){
  .mode-tabs{overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;scroll-snap-type:x mandatory;scroll-padding-left:.5rem;
    background-image:
      linear-gradient(to right,#f1f5f9 30%,rgba(241,245,249,0)),
      linear-gradient(to right,rgba(241,245,249,0),#f1f5f9 70%) 100% 0,
      radial-gradient(farthest-side at 0 50%,rgba(15,23,42,.18),rgba(0,0,0,0)),
      radial-gradient(farthest-side at 100% 50%,rgba(15,23,42,.18),rgba(0,0,0,0)) 100% 0;
    background-repeat:no-repeat;background-color:#f1f5f9;background-size:36px 100%,36px 100%,12px 100%,12px 100%;background-attachment:local,local,scroll,scroll;
  }
  .mode-tabs::-webkit-scrollbar{display:none}
  .mode-tab{flex:0 0 auto;padding:.55rem .75rem;font-size:.78rem;white-space:nowrap;scroll-snap-align:start}
}
/* Time Machine FAB pulse for first-time discoverability */
@keyframes tmFabPulse{0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,.5)}50%{box-shadow:0 0 0 6px rgba(245,158,11,0)}}
.tm-hero-btn:not(.viewing):not(.dismissed){animation:tmFabPulse 2.4s ease-in-out infinite}
.mode-tab:hover{background:#e2e8f0;color:#334155}
.mode-tab.active{background:#fff;color:var(--mc,#0f172a);box-shadow:0 2px 8px rgba(0,0,0,.08);border-bottom:2px solid var(--mc,#0f172a);font-weight:700}
.mode-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
/* ── Mode status badge / banner ── */
.mode-status-badge{display:inline-flex;align-items:center;font-size:.58rem;font-weight:800;letter-spacing:.04em;background:var(--ms-bg,#94a3b8);color:#fff;padding:.12rem .38rem;border-radius:4px;margin-left:.3rem;text-transform:uppercase;line-height:1.1}
.mode-status-badge.ms-pausing,.mode-status-badge.ms-deploying,.mode-status-badge.ms-liquidated{animation:msPulse 2s ease-in-out infinite}
@media(max-width:600px){.mode-status-badge{font-size:.5rem;padding:.1rem .28rem;margin-left:.2rem}}
@keyframes msPulse{0%,100%{opacity:1}50%{opacity:.55}}
.mode-status-banner{display:flex;align-items:flex-start;gap:.7rem;padding:.85rem 1rem;margin:0 0 1.25rem;border-radius:10px;background:#fff8eb;border-left:4px solid var(--ms-bg,#f59e0b);color:#334155}
.mode-status-banner.ms-banner-paused,.mode-status-banner.ms-banner-stopped,.mode-status-banner.ms-banner-draft{background:#f1f5f9;color:#475569}
.mode-status-banner.ms-banner-test,.mode-status-banner.ms-banner-deploying{background:#eff6ff;color:#1e3a8a}
.mode-status-banner.ms-banner-liquidated{background:#fef2f2;color:#7f1d1d;border-left-color:#dc2626}
.mode-status-banner>i{font-size:1.05rem;color:var(--ms-bg,#f59e0b);margin-top:.15rem;flex-shrink:0}
.mode-status-banner .msb-text{flex:1;min-width:0;font-size:.82rem;line-height:1.45}
.mode-status-banner .msb-text strong{display:block;font-size:.92rem;color:#0f172a;margin-bottom:.2rem}
.mode-status-banner .msb-text p{margin:.1rem 0}
.mode-status-banner .msb-text .msb-reason{font-style:italic;color:#64748b;font-size:.78rem;margin-top:.25rem}
.mode-status-banner .msb-text small{display:block;margin-top:.35rem;font-size:.7rem;color:#94a3b8}

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
.perf-hero{display:flex;gap:1.75rem;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:1.6rem;margin-bottom:1.5rem;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,.03),0 4px 12px rgba(15,23,42,.02)}
.perf-hero-left{display:flex;align-items:center;gap:.5rem;margin-bottom:.6rem}
.perf-hero-label{font-size:.72rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em}
.perf-chart-wrap{flex:1;min-width:0;display:flex;flex-direction:column}
.perf-chart{flex:1;min-height:360px}
.perf-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:.55rem .65rem;align-content:center;min-width:260px}
@media(max-width:600px){.perf-stats{grid-template-columns:1fr 1fr}}
.ps{text-align:center;padding:.75rem .6rem;border-radius:10px;background:#f8fafc;border:1px solid #f1f5f9;transition:box-shadow .15s}
.ps:hover{box-shadow:0 2px 8px rgba(15,23,42,.05)}
.ps-v{display:block;font-size:1.45rem;font-weight:800;color:#0f172a;line-height:1.2;font-variant-numeric:tabular-nums}
.ps-l{display:block;font-size:.62rem;color:#64748b;text-transform:uppercase;letter-spacing:.4px;margin-top:.3rem;font-weight:600}

/* ── Section cards ── */
.section-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:1.4rem 1.6rem;margin-bottom:1.35rem;box-shadow:0 1px 3px rgba(15,23,42,.03),0 4px 12px rgba(15,23,42,.02)}
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
.t td b,.t td strong{cursor:pointer;border-bottom:1px dashed #cbd5e1;transition:color .15s}
.t td b:hover,.t td strong:hover{color:#3b82f6}
.t tr:last-child td{border-bottom:none}
.t tr:hover td{background:#f8fafc}
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
/* Long Orders to Place tables — bound card height + sticky head, vertical scroll */
.section-card.cta-orders{max-height:560px;overflow-y:auto;overflow-x:hidden}
.section-card.cta-orders .sc-head{position:sticky;top:0;background:#fff;z-index:2;padding-top:.6rem}
.section-card.cta-orders table.t thead th{position:sticky;top:3.2rem;background:#f8fafc;z-index:1}
@media(max-width:600px){.section-card.cta-orders{max-height:420px}}
.empty{text-align:center;padding:2rem 1rem;color:#94a3b8;font-size:.85rem;display:flex;flex-direction:column;align-items:center;gap:.4rem}
.empty i{font-size:1.4rem;opacity:.4}
@media(max-width:600px){
  .section-card details[open]>table.t,.section-card>table.t{
    display:block;width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;
  }
  .t{table-layout:auto}
  .t th,.t td{white-space:nowrap;padding:.3rem .45rem;font-size:.68rem}
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
.sc-sum-title{display:flex;align-items:center;gap:.35rem;flex-wrap:wrap}
.sc-preview{font-size:.68rem;color:#475569;margin-left:.5rem;font-weight:500;font-family:"JetBrains Mono",monospace;letter-spacing:-.01em}
.sc-preview b{color:#0f172a;font-weight:700}
.watch-summary{color:#64748b;font-weight:600;font-size:.78rem}

/* ── Responsive ── */
@media(max-width:700px){
  .perf-hero{flex-direction:column;gap:1rem}
  .perf-stats{grid-template-columns:repeat(3,1fr)}
  .perf-chart{min-height:240px}
  .t{font-size:.72rem}
  .t th,.t td{padding:.35rem .4rem}
  .hero-inner{flex-direction:column;align-items:flex-start}
}
@media(max-width:640px){.hide-m{display:none!important}}
@media(max-width:600px){
  .t .hide-m{display:none}
  .perf-stats{grid-template-columns:repeat(3,1fr)}
  .w{padding:0 .75rem 2rem}
}

/* ── Thesis subtitle row ── */
.thesis-row td{padding:.25rem .85rem .5rem!important;border-bottom:1px solid #f1f5f9!important;background:transparent!important}
.thesis-row:hover td{background:transparent!important}
.thesis-text{font-size:.72rem;color:#64748b;line-height:1.45;font-style:italic;display:-webkit-box;-webkit-line-clamp:2;line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}

/* ── Finviz thumbnails ── */
.tk-logo{width:18px;height:18px;border-radius:50%;vertical-align:middle;margin-right:4px;object-fit:cover;background:#f1f5f9}
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
@keyframes tm-pulse{0%,100%{box-shadow:0 0 0 0 rgba(59,130,246,.45)}60%{box-shadow:0 0 0 7px rgba(59,130,246,0)}}
@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.tm-btn-header{display:none;align-items:center;gap:.45rem;padding:.45rem 1rem;background:linear-gradient(135deg,#3b82f6 0%,#2563eb 100%);color:#fff;border:none;border-radius:999px;font-size:.8rem;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s ease;vertical-align:middle;margin-left:.85rem;letter-spacing:.01em;box-shadow:0 2px 8px rgba(37,99,235,.45);animation:tm-pulse 2.4s ease-in-out infinite}
.tm-btn-header i{font-size:.75rem;transition:transform .3s ease}
.tm-btn-header:hover{background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);box-shadow:0 4px 16px rgba(37,99,235,.6);transform:translateY(-1px);animation:none}
.tm-btn-header:hover i{transform:rotate(-20deg)}
.tm-btn-header:active{transform:translateY(0);box-shadow:0 2px 6px rgba(37,99,235,.4)}
.tm-btn-header.viewing{background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);box-shadow:0 2px 8px rgba(217,119,6,.5);animation:none;color:#fff}
.tm-btn-header.viewing i{animation:spin 2s linear infinite}
@media(max-width:400px){.tm-btn-header{padding:.4rem .75rem;font-size:.72rem;margin-left:.5rem}}

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
    <a href="/" class="brand-logo"><img src="/logo.svg" alt="" width="36" height="36"><span class="brand-title">DailyTickers</span></a>
    <div class="brand-nav"><a href="/?tab=weekly">Hebdo</a><a href="/?tab=daily">Daily</a><a href="/?tab=analyses">Analyses</a><a href="/?tab=scanner">Scanner</a><a href="/?tab=radar">Radar</a><a href="/?tab=series">Séries</a></div>
    <div class="brand-actions"><a href="/" class="brand-home-btn" title="Home"><i class="fas fa-house"></i></a></div>
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

  <!-- Mode Tabs -->
  <div class="mode-tabs" role="tablist" aria-label="Portfolio modes">
    ${Object.entries(modes).map(([id, m]) => `<button type="button" role="tab" aria-pressed="${id === 'balanced' ? 'true' : 'false'}" aria-label="Switch to ${m.cfg.label} mode" class="mode-tab${id === 'balanced' ? ' active' : ''}" data-mode="${id}" data-mode-status="${m.cfg.status || 'live'}" onclick="switchMode('${id}')" style="--mc:${m.cfg.color}"><span class="mode-dot" style="background:${m.cfg.color}"></span>${m.cfg.label}${renderStatusBadge(m.cfg.status)}${id === 'balanced' ? ' <span class="hide-m" style="font-size:.6rem;background:#dcfce7;color:#15803d;padding:.1rem .35rem;border-radius:4px;font-weight:700;margin-left:.2rem;">★ Rec.</span>' : ''}</button>`).join('')}
  </div>

  ${Object.entries(modes).map(([id, m]) => panel(id, m.cfg, m.m, m.trades, m.ec, 'chart-' + id, id === 'balanced')).join('\n')}

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
  &copy; 2026 DailyTickers &middot;
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
  document.getElementById('fvImg').src='https://charts2-node.finviz.com/chart?t='+ticker+'&tf=d&s=linear&ct=candle_stick&o[0][ot]=sma&o[0][op]=20&o[0][oc]=DC32B363&o[1][ot]=sma&o[1][op]=50&o[1][oc]=FF8F33C6&o[2][ot]=sma&o[2][op]=200&o[2][oc]=DCB3326D';
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

<script src="/assets/core.js?v=${buildVer}"></script>
<script src="/assets/tag-renderer.js?v=${buildVer}"></script>
<script src="/assets/mode-panel-binder.js?v=${buildVer}"></script>
<script>window.__BP=${JSON.stringify(bakedPrices)}</script>
<script src="/assets/live-engine.js?v=${buildVer}"></script>
<script src="/assets/live-engine-ui.js?v=${buildVer}"></script>
<script>
var _v='${buildVer}';
document.addEventListener('DOMContentLoaded',function(){
  function mk(el,dates,vals,color){
    if(!document.getElementById(el))return null;
    var dom=document.getElementById(el);
    var existing=echarts.getInstanceByDom(dom);
    if(existing) existing.dispose();
    var c=echarts.init(dom);
    var ddS=[],pk=vals[0]||100;
    for(var i=0;i<vals.length;i++){
      if(vals[i]>pk)pk=vals[i];
      ddS.push(pk>0?+((vals[i]-pk)/pk*100).toFixed(2):0);
    }
    var regimeAreas=[];
    if(typeof _regimeMap!=='undefined'){
      var prevR=null,startI=0;
      for(var i=0;i<dates.length;i++){
        var r=_regimeMap[dates[i]]||null;
        if(r)prevR=r;
        var cur=prevR||'NEUTRAL';
        if(i===0){prevR=cur;startI=0;continue;}
        var prev=_regimeMap[dates[startI]]||prevR||'NEUTRAL';
        if(cur!==prev){
          regimeAreas.push([{xAxis:dates[startI],itemStyle:{color:_RCOL[prev]||'rgba(148,163,184,.05)'}},{xAxis:dates[i-1]}]);
          startI=i;
        }
      }
      if(dates.length>0){var lastR=prevR||'NEUTRAL';regimeAreas.push([{xAxis:dates[startI],itemStyle:{color:_RCOL[lastR]||'rgba(148,163,184,.05)'}},{xAxis:dates[dates.length-1]}]);}
    }
    var spyVals=null;
    if(typeof _spyData!=='undefined'&&Object.keys(_spyData).length>0){
      spyVals=dates.map(function(d){return _spyData[d]||null;});
    }
    var series=[
      {name:'Strategy',data:vals,type:'line',smooth:.3,symbol:'none',xAxisIndex:0,yAxisIndex:0,z:5,
        lineStyle:{color:color,width:2.8,shadowColor:color+'30',shadowBlur:8,shadowOffsetY:2},
        areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:color+'15'},{offset:.7,color:color+'06'},{offset:1,color:color+'00'}])},
        markArea:regimeAreas.length?{silent:true,data:regimeAreas}:undefined},
      {name:'Drawdown',data:ddS,type:'line',smooth:.3,symbol:'none',xAxisIndex:1,yAxisIndex:2,z:2,
        lineStyle:{color:'#ef4444',width:2,opacity:1},
        areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'rgba(239,68,68,.18)'},{offset:1,color:'rgba(239,68,68,.02)'}])}}
    ];
    var legendItems=['Strategy','Drawdown'];
    if(spyVals){
      series.splice(1,0,{name:'SPY',data:spyVals,type:'line',smooth:.3,symbol:'none',xAxisIndex:0,yAxisIndex:0,z:4,
        lineStyle:{color:'#94a3b8',width:1.6,type:[6,4]},connectNulls:true});
      legendItems.splice(1,0,'SPY');
    }
    c.setOption({
      tooltip:{trigger:'axis',axisPointer:{type:'line',lineStyle:{color:'#cbd5e1',type:'dashed',width:1}},
        backgroundColor:'rgba(255,255,255,.97)',borderColor:'#e2e8f0',borderWidth:1,padding:[10,14],
        textStyle:{fontFamily:'Inter,system-ui,sans-serif',fontSize:11},
        formatter:function(p){
          var dt=p[0].name;
          var s='<div style="font-weight:700;color:#1e293b;margin-bottom:5px;font-size:11px">'+dt;
          if(typeof _regimeMap!=='undefined'){var rr=null,pr=null;for(var k=0;k<dates.length;k++){if(_regimeMap[dates[k]])pr=_regimeMap[dates[k]];if(dates[k]===dt){rr=pr;break;}}
            if(rr){var rbg=(_RCOL[rr]||'rgba(148,163,184,.08)').replace('.12)','.35)').replace('.08)','.35)').replace('.05)','.35)');s+=' <span style="font-size:9px;padding:1px 5px;border-radius:3px;background:'+rbg+';color:#334155;font-weight:600">'+rr+'</span>';}}
          s+='</div>';
          for(var j=0;j<p.length;j++){if(p[j].value!=null){
            var v=p[j].value,nm=p[j].seriesName,isDd=nm==='Drawdown';
            var clr=isDd?(v<0?'#ef4444':'#10b981'):p[j].color;
            s+='<div style="display:flex;align-items:center;gap:6px;line-height:1.7">'+p[j].marker+'<span style="color:#64748b;min-width:56px">'+nm+'</span><span style="font-weight:700;color:'+clr+'">'+v+(isDd?'%':'')+'</span></div>';
          }}return s;
        }},
      legend:{data:legendItems,top:2,right:8,textStyle:{fontSize:10,color:'#94a3b8',fontFamily:'Inter,system-ui'},itemWidth:16,itemHeight:8,itemGap:16},
      axisPointer:{link:[{xAxisIndex:'all'}]},
      grid:[{top:28,bottom:'30%',left:48,right:14},{top:'76%',bottom:20,left:48,right:14}],
      xAxis:[
        {type:'category',data:dates,gridIndex:0,axisLine:{lineStyle:{color:'#e2e8f0'}},axisLabel:{show:false},axisTick:{show:false},splitLine:{show:false}},
        {type:'category',data:dates,gridIndex:1,axisLine:{lineStyle:{color:'#f1f5f9'}},axisLabel:{color:'#94a3b8',fontSize:9,interval:'auto',fontFamily:'Inter'},axisTick:{lineStyle:{color:'#e2e8f0'}},splitLine:{show:false}}
      ],
      yAxis:[
        {type:'value',gridIndex:0,min:function(v){return Math.floor(v.min-1)},axisLine:{show:false},splitLine:{lineStyle:{color:'#f1f5f9',type:'dashed'}},axisLabel:{color:'#94a3b8',fontSize:9,fontFamily:'Inter'}},
        {type:'value',gridIndex:0,show:false},
        {type:'value',gridIndex:1,max:0,axisLine:{show:false},splitLine:{lineStyle:{color:'#fef2f2',type:'dashed'}},axisLabel:{color:'#f87171',fontSize:8,fontFamily:'Inter',formatter:'{value}%'}}
      ],
      series:series
    });
    window.addEventListener('resize',function(){c.resize()});
    return c;
  }
  var tmDates=[], tmCurrentIdx=0, tmModesCfg={};
  function tmInit(){
    fetch('/data/modes-config.json?v='+_v).then(function(r){return r.json()}).then(function(cfg){
      tmModesCfg = cfg;
      return fetch('/scanner/status/history/dates.json?v='+_v);
    }).then(function(r){return r.json()}).then(function(dates){
      tmDates=dates;if(dates.length<1)return;
      var fab=document.getElementById('tmFab');
      if(fab)fab.style.display='flex';
      var slider=document.getElementById('timeSlider');
      slider.max=dates.length-1;
      slider.value=dates.length-1;
      tmCurrentIdx=dates.length-1;
      tmUpdateLabel();
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
    var fab=document.getElementById('tmFab');
    if(fab){
      // First open: kill the discoverability pulse permanently for this session
      fab.classList.add('dismissed');
      try{sessionStorage.setItem('tmFabDismissed','1');}catch(_){ }
      if(!isOpen)fab.style.boxShadow='0 0 0 3px rgba(59,130,246,.35)';
      else{
        fab.style.boxShadow='';
        if(tmDates.length&&tmCurrentIdx<tmDates.length-1){window.tmGoLive();}
      }
    }
  };
  // Restore dismissed state across page reloads within session
  (function(){try{
    if(sessionStorage.getItem('tmFabDismissed')==='1'){
      var f=document.getElementById('tmFab');if(f)f.classList.add('dismissed');
    }
  }catch(_){ }})();
  document.addEventListener('click',function(e){
    var p=document.getElementById('tmPanel');
    var fab=document.getElementById('tmFab');
    if(p&&p.classList.contains('open')&&!p.contains(e.target)&&fab&&!fab.contains(e.target)){
      p.classList.remove('open');
      fab.style.boxShadow='';
      if(tmDates.length&&tmCurrentIdx<tmDates.length-1){window.tmGoLive();}
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
  var VALID_MODES=${JSON.stringify(Object.keys(modes))};
  var activeMode='balanced';
  var modeCharts=${JSON.stringify(Object.fromEntries(Object.entries(modes).map(([id, m]) => [id, { d: m.ec.d, v: m.ec.v, c: m.cfg.color }])))};
  var _regimeMap=${JSON.stringify(regimeMap)};
  var _spyData=${JSON.stringify(spyIndexed)};
  var _RCOL={'RISK-ON':'rgba(16,185,129,.07)','RECOVERY':'rgba(59,130,246,.07)','NEUTRAL':'rgba(148,163,184,.04)','EARLY RISK-OFF':'rgba(245,158,11,.07)','RISK-OFF':'rgba(239,68,68,.07)'};
  window.switchMode=function(id,opts){
    if(!VALID_MODES.includes(id))return;
    activeMode=id;
    document.querySelectorAll('.mode-tab').forEach(function(t){
      var on=t.dataset.mode===id;
      t.classList.toggle('active',on);
      t.setAttribute('aria-pressed', on ? 'true' : 'false');
      // Scroll active tab horizontally inside .mode-tabs only (avoid window-level scroll
      // that would shift the whole panel on mobile when picking fortress/tkl).
      if(on){try{
        var tabs=t.parentElement;
        if(tabs && tabs.scrollWidth > tabs.clientWidth){
          var target=t.offsetLeft - (tabs.clientWidth - t.offsetWidth)/2;
          tabs.scrollTo ? tabs.scrollTo({left:Math.max(0,target),behavior:'smooth'}) : (tabs.scrollLeft=Math.max(0,target));
        }
      }catch(_){ }}
    });
    document.querySelectorAll('.mode-panel').forEach(function(p){p.style.display=p.id==='p-'+id?'':'none'});
    var chartEl=document.getElementById('chart-'+id);
    if(chartEl){
      var inst=echarts.getInstanceByDom(chartEl);
      if(!inst){var cfg=modeCharts[id];if(cfg)mk('chart-'+id,cfg.d,cfg.v,cfg.c);}
      else{inst.resize();}
    }
    updateLiveActions(id);
    if(tmDates.length&&tmCurrentIdx<tmDates.length-1){tmLoadIdx(tmCurrentIdx);}
    // Deep-link: update hash without scroll/reload (skip on initial boot)
    // Reverse-alias: secured → orbit in URL for user-facing hash
    var REVERSE_ALIASES={secured:'orbit'};
    var hashId=REVERSE_ALIASES[id]||id;
    if(!opts||!opts.silent){
      try{history.replaceState(null,'','#'+hashId);}catch(_){ location.hash='#'+hashId; }
    }
  };
  // URL aliases: #orbit → secured (internal ID kept for backward compat)
  var MODE_ALIASES={orbit:'secured'};
  function resolveMode(m){return MODE_ALIASES[m]||m;}
  // Boot from URL hash (#orbit, #fortress) or ?m= param — allows shareable per-mode links
  (function(){
    var m=(location.hash||'').replace(/^#/,'').toLowerCase();
    if(!m){var q=new URLSearchParams(location.search).get('m');if(q)m=q.toLowerCase();}
    m=resolveMode(m);
    if(m&&VALID_MODES.includes(m)&&m!=='balanced'){window.switchMode(m,{silent:true});}
  })();
  window.addEventListener('hashchange',function(){
    var m=resolveMode((location.hash||'').replace(/^#/,'').toLowerCase());
    if(VALID_MODES.includes(m)&&m!==activeMode){window.switchMode(m,{silent:true});}
  });
  function updateLiveActions(modeId){
    fetch('/data/modes-config.json?v='+_v).then(function(r){return r.json()}).then(function(cfg){
      document.querySelectorAll(modeId ? '#p-'+modeId : '.mode-panel').forEach(function(p){
        var id = p.id.replace('p-',''), mCfg = cfg.modes[id]||{};
        if(!mCfg.breakevenPct) return;
        var posCard = Array.from(p.querySelectorAll('.section-card')).find(function(c){return c.querySelector('h3')?.textContent.includes('Open Positions')});
        var posTable = posCard?.querySelector('table');
        if(!posTable) return;
        var raised = [];
        posTable.querySelectorAll('tbody tr:not(.empty-row):not(.thesis-row)').forEach(function(tr){
          var ticker = tr.querySelector('b')?.textContent;
          var pnlTr = tr.querySelector('.pos b, .neg b');
          if(!ticker || !pnlTr) return;
          var pnl = parseFloat(pnlTr.textContent);
          if(!isNaN(pnl) && pnl >= mCfg.breakevenPct){
            raised.push({ticker: ticker, entry: tr.cells[3]?.textContent || tr.cells[1].textContent, pnl: pnlTr.textContent, stop: tr.cells[6]?.textContent || 'B.EVEN'});
          }
        });
        if(raised.length > 0){
          var actCard = p.querySelector('.live-content .cta-card.cta-raise-sl') || p.querySelector('.live-content .cta-card');
          if(!actCard || !actCard.innerHTML.includes('Raise Stop Loss')){
            var firstSec = p.querySelector('.live-content .section-card');
            actCard = document.createElement('div'); actCard.className = 'cta-card cta-raise-sl';
            actCard.style = 'background:#f0f9ff;border:1.5px solid #bae6fd;border-left:4px solid #0284c7;margin-bottom:1.5rem';
            actCard.innerHTML = '<div class="cta-header"><span class="cta-icon" style="background:rgba(2,132,199,0.1)"><i class="fas fa-arrow-up-right-dots" style="color:#0284c7"></i></span>'
            +'<div><h3 style="color:#0284c7">Raise Stop Loss <span class="cta-badge" style="background:#0284c7">'+raised.length+' targets</span></h3>'
            +'<p class="cta-sub" style="color:#0284c7dd">Break-even triggered — move stop to entry</p></div></div>'
            +'<table class="t"><thead><tr><th>Ticker</th><th>Entry</th><th>P&L</th><th>Stop</th><th>Held</th></tr></thead><tbody></tbody></table>';
            if(firstSec) firstSec.parentNode.insertBefore(actCard, firstSec.nextSibling);
          }
          var tbody = actCard.querySelector('tbody');
          raised.forEach(function(r){
            if(Array.from(tbody.rows).some(function(row){return row.cells[0].textContent === r.ticker})) return;
            var tr = document.createElement('tr');
            tr.innerHTML = '<td><b>'+r.ticker+'</b></td><td>'+r.entry+'</td><td class="pos"><b>'+r.pnl+'</b></td><td><span class="pill pos" style="background:#0284c7;color:#fff">B.EVEN</span></td><td>Trailing</td>';
            tbody.insertBefore(tr, tbody.firstChild);
          });
          var badge = actCard.querySelector('.cta-badge');
          if(badge) badge.textContent = tbody.rows.length + ' targets';
        }
      });
    });
  }
  setTimeout(updateLiveActions, 800);
  // Hide stale orders: orders only show on their scan date
  (function(){
    var today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date()).replace(/-/g,'');
    document.querySelectorAll('.cta-orders[data-scan-date]').forEach(function(el){
      var sd=el.getAttribute('data-scan-date');
      if(sd&&sd!==today) el.style.display='none';
    });
  })();
  // ═══ TIME MACHINE — template approach: hide grid, render into .tm-render ═══
  document.querySelectorAll('.mode-panel').forEach(function(p){
    var tmr=document.createElement('div');tmr.className='tm-render';tmr.style.display='none';
    p.appendChild(tmr);
  });
  // ── Mode-panel layout template (static HTML, parsed once) ──
  // Driven by data-bind/data-list/data-show-if attributes via ModePanelBinder.
  // No conditional sections — layout is constant across dates so Time Machine
  // sliding doesn't reflow. Empty states surface inside their own table body.
  var MODE_PANEL_TPL = ''
    + '<div class="section-card tm-section tm-stats" style="margin-bottom:1rem"><div class="ps">'
    +   '<div class="ps-i"><div class="ps-v" data-bind="stats.ret" data-format="pct2"></div><div class="ps-l">Total Return</div></div>'
    +   '<div class="ps-i"><div class="ps-v" data-bind="stats.dd" data-format="pct2"></div><div class="ps-l">Max Drawdown</div></div>'
    +   '<div class="ps-i"><div class="ps-v" data-bind="stats.wr" data-format="pct1"></div><div class="ps-l">Win Rate</div></div>'
    +   '<div class="ps-i"><div class="ps-v" data-bind="stats.pf" data-format="mult"></div><div class="ps-l">Profit Factor</div></div>'
    +   '<div class="ps-i"><div class="ps-v" data-bind="stats.trades" data-format="int"></div><div class="ps-l">Closed Trades</div></div>'
    +   '<div class="ps-i"><div class="ps-v" data-bind="stats.avgHold" data-format="days"></div><div class="ps-l">Avg Hold</div></div>'
    + '</div></div>'
    // Equity (chart container id is set per-mode after clone)
    + '<div class="perf-hero tm-section tm-equity" data-color>'
    +   '<div class="perf-hero-left"><span class="perf-hero-label"><i class="fas fa-chart-line"></i> Equity Curve</span></div>'
    +   '<div class="tm-equity-target" style="width:100%;height:260px"></div>'
    + '</div>'
    // Rotation Signal — pending + just-executed visible side by side
    + '<div class="section-card tm-section tm-rotation" style="border-left:4px solid #f59e0b;background:#fffbeb">'
    +   '<div class="sc-head"><h3 style="color:#92400e"><i class="fas fa-arrows-rotate"></i> Rotation Signal '
    +     '<span class="count" data-bind="orders|filter:rotate|count" data-format="int"></span></h3>'
    +     '<span class="sc-meta">close-and-buy swap</span></div>'
    +   '<table class="t" data-list="orders|filter:rotate" data-empty="No pending rotation — portfolio stable.">'
    +     '<thead><tr><th>Close</th><th></th><th>Buy</th><th class="hide-m">Score Δ</th><th class="hide-m">Entry / Stop / TP1</th></tr></thead>'
    +     '<tbody></tbody>'
    +     '<template>'
    +       '<tr><td><b class="neg" data-bind="replaces"></b></td>'
    +       '<td style="text-align:center;color:#92400e">⟶</td>'
    +       '<td><b class="pos" data-bind="ticker"></b> <span class="pill-score" data-bind="score"></span></td>'
    +       '<td class="hide-m am" data-bind="scoreDelta" data-format="int"></td>'
    +       '<td class="hide-m"><span data-bind="entry" data-format="usd"></span> / '
    +         '<span data-bind="stop" data-format="usd"></span> / '
    +         '<span data-bind="tp1" data-format="usd"></span></td></tr>'
    +     '</template>'
    +   '</table>'
    +   // Just-executed rotation block — shown when recentRotation is populated
    +   '<div data-show-if="recentRotation" style="margin-top:.7rem;padding:.55rem .8rem;background:#ecfdf5;border:1px solid #6ee7b7;border-left:3px solid #059669;border-radius:6px;font-size:.78rem">'
    +     '<div style="font-weight:700;color:#065f46;margin-bottom:.2rem"><i class="fas fa-check-circle"></i> Just Executed</div>'
    +     '<div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">'
    +       '<span style="color:#92400e">CLOSE</span>'
    +       '<b class="neg" data-bind="recentRotation.replaces"></b>'
    +       '<span style="color:#059669">⟶</span>'
    +       '<span style="color:#065f46">BUY</span>'
    +       '<b class="pos" data-bind="recentRotation.ticker"></b>'
    +       '<span class="pill-score" data-bind="recentRotation.score" style="background:#059669"></span>'
    +       '<span style="margin-left:auto;color:#059669;font-size:.7rem"><i class="fas fa-clock"></i> '
    +         '<span data-bind="recentRotation.executedDate" data-format="date-md"></span></span>'
    +     '</div>'
    +   '</div>'
    + '</div>'
    // Close Now
    + '<div class="section-card tm-section tm-close-now cta-close">'
    +   '<div class="sc-head"><h3><i class="fas fa-ban"></i> Close Now '
    +     '<span class="count" data-bind="closeNow|count" data-format="int"></span></h3>'
    +     '<span class="sc-meta">horizon expired</span></div>'
    +   '<table class="t" data-list="closeNow" data-empty="No exits required at next open.">'
    +     '<thead><tr><th>Ticker</th><th class="hide-m">Bought</th><th class="hide-m">Entry $</th><th>P&L</th><th>Held</th><th>Action</th></tr></thead>'
    +     '<tbody></tbody>'
    +     '<template>'
    +       '<tr><td><b data-bind="ticker"></b></td>'
    +       '<td class="m hide-m" data-bind="scan_date" data-format="date-md"></td>'
    +       '<td class="hide-m" data-bind="entry" data-format="usd"></td>'
    +       '<td data-bind="return_pct" data-format="pct2" data-class-sign="return_pct"></td>'
    +       '<td class="am" data-bind="days_held" data-format="days"></td>'
    +       '<td><span class="pill neg">CLOSE</span></td></tr>'
    +     '</template>'
    +   '</table>'
    + '</div>'
    // Expires Tomorrow
    + '<div class="section-card tm-section tm-expires" style="background:#fffbeb;border:1.5px solid #fcd34d;border-left:4px solid #f59e0b">'
    +   '<div class="sc-head"><h3 style="color:#92400e"><i class="fas fa-hourglass-half"></i> Expires Tomorrow '
    +     '<span class="count" data-bind="expiresTomorrow|count" data-format="int"></span></h3>'
    +     '<span class="sc-meta" style="color:#b45309">horizon at next close</span></div>'
    +   '<table class="t" data-list="expiresTomorrow" data-empty="No position expires tomorrow.">'
    +     '<thead><tr><th>Ticker</th><th>Entry</th><th>P&L</th><th>Stop</th><th>Held</th></tr></thead>'
    +     '<tbody></tbody>'
    +     '<template>'
    +       '<tr><td><b data-bind="ticker"></b></td>'
    +       '<td data-bind="entry" data-format="usd"></td>'
    +       '<td data-bind="return_pct" data-format="pct2" data-class-sign="return_pct"></td>'
    +       '<td class="neg" data-bind="stop" data-format="usd"></td>'
    +       '<td class="am" data-bind="days_held" data-format="days"></td></tr>'
    +     '</template>'
    +   '</table>'
    + '</div>'
    // Buy Orders
    + '<div class="section-card tm-section tm-orders cta-orders">'
    +   '<div class="sc-head"><h3><i class="fas fa-bolt"></i> New Buy Orders '
    +     '<span class="count" data-bind="orders|filter:buy|count" data-format="int"></span></h3>'
    +     '<span class="sc-meta">portfolio expansion</span></div>'
    +   '<table class="t" data-list="orders|filter:buy" data-empty="No new buy orders queued.">'
    +     '<thead><tr><th>Ticker</th><th class="hide-m">Score</th><th>Entry</th><th>Stop / TP1</th></tr></thead>'
    +     '<tbody></tbody>'
    +     '<template>'
    +       '<tr><td><b data-bind="ticker"></b></td>'
    +       '<td class="hide-m"><span class="pill-score" data-bind="score"></span></td>'
    +       '<td><b data-bind="entry"></b></td>'
    +       '<td><span data-bind="stop"></span> / <span data-bind="tp1"></span></td></tr>'
    +     '</template>'
    +   '</table>'
    + '</div>'
    // Today's Signals (collapsible)
    + '<div class="section-card tm-section tm-signals">'
    +   '<details><summary class="sc-summary"><span class="sc-sum-title">Today&#39;s Signals '
    +     '<span class="count" data-bind="signals|count" data-format="int"></span></span></summary>'
    +   '<table class="t" style="margin-top:.6rem" data-list="signals" data-empty="No signals — scanner published no setups.">'
    +     '<thead><tr><th>Ticker</th><th>Score</th><th>Entry</th><th>Stop</th><th>TP1</th></tr></thead>'
    +     '<tbody></tbody>'
    +     '<template>'
    +       '<tr><td><b data-bind="ticker"></b></td>'
    +       '<td><span class="pill-score" data-bind="score"></span></td>'
    +       '<td data-bind="entry"></td>'
    +       '<td class="neg" data-bind="stop"></td>'
    +       '<td class="pos" data-bind="tp1"></td></tr>'
    +     '</template>'
    +   '</table></details>'
    + '</div>'
    // Open Positions + scenario bar
    + '<div class="section-card tm-section tm-positions">'
    +   '<div class="sc-head"><h3>Open Positions <span class="count" data-bind="_positions.label"></span></h3>'
    +     '<span class="sc-meta">avg P&L: <b data-bind="_positions.avgPnl" data-format="pct2" data-class-sign="_positions.avgPnl"></b></span></div>'
    +   '<div class="scenario-bar-wrap" data-show-if="_positions.has"><div class="scenario-labels">'
    +     '<span data-bind="_positions.worst" data-format="pct1" data-class-sign="_positions.worst" class="neg"></span>'
    +     '<span data-bind="_positions.now" data-format="pct1" data-class-sign="_positions.now" class="pos"></span>'
    +     '<span class="pos" data-bind="_positions.best" data-format="pct1"></span>'
    +     '</div><div class="scenario-bar"></div></div>'
    +   '<table class="t" data-list="positions" data-empty="No open positions on this date.">'
    +     '<thead><tr><th>Ticker</th><th class="hide-m">Bought</th><th class="hide-m">Entry</th><th class="hide-m">Now</th><th>P&L</th><th class="hide-m">Stop</th><th class="hide-m">TP2</th><th>Left</th></tr></thead>'
    +     '<tbody></tbody>'
    +     '<template>'
    +       '<tr><td><b data-bind="ticker"></b></td>'
    +       '<td class="m hide-m" data-bind="scan_date" data-format="date-md"></td>'
    +       '<td class="hide-m" data-bind="entry" data-format="usd"></td>'
    +       '<td class="hide-m" data-bind="current_price" data-format="usd"></td>'
    +       '<td data-bind="return_pct" data-format="pct2" data-class-sign="return_pct"></td>'
    +       '<td class="neg hide-m" data-bind="stop" data-format="usd"></td>'
    +       '<td class="pos hide-m" data-bind="tp2" data-format="usd"></td>'
    +       '<td class="m" data-bind="days_remaining" data-format="days"></td></tr>'
    +     '</template>'
    +   '</table>'
    + '</div>'
    // Trade History (collapsible)
    + '<div class="section-card tm-section tm-history">'
    +   '<details><summary class="sc-summary"><span class="sc-sum-title">Trade History '
    +     '<span class="count"><span data-bind="closedTrades|count" data-format="int"></span> closed</span></span></summary>'
    +   '<table class="t" style="margin-top:.6rem" data-list="closedTrades|sort:scanDate" data-empty="No closed trades on this date.">'
    +     '<thead><tr><th>Ticker</th><th class="hide-m">End</th><th>P&L</th><th>Result</th></tr></thead>'
    +     '<tbody></tbody>'
    +     '<template>'
    +       '<tr><td><b data-bind="ticker"></b></td>'
    +       '<td class="m hide-m" data-bind="scanDate" data-format="date-md"></td>'
    +       '<td data-bind="pnlPct" data-format="pct2" data-class-sign="pnlPct"></td>'
    +       '<td><span class="pill" data-bind="status" data-format="upper"></span></td></tr>'
    +     '</template>'
    +   '</table></details>'
    + '</div>';

  var _modeTpl = null;
  function getModeTpl() {
    if (!_modeTpl) {
      _modeTpl = document.createElement('template');
      _modeTpl.innerHTML = MODE_PANEL_TPL;
    }
    return _modeTpl;
  }

  // Pre-compute fields the template can't derive from raw JSON
  function enrichForBinding(d, mCfg) {
    var out = Object.assign({}, d);
    var positions = out.positions || [];
    var allocPct = (mCfg.portfolioSize ? 100 / mCfg.portfolioSize : 100) / 100;
    var w = 0, b = 0, n = 0;
    positions.forEach(function (p) {
      var pnl = p.pnlPct != null ? p.pnlPct : (p.return_pct || 0);
      var entry = p.entry || 0;
      var stop = p.stop || 0;
      if (stop > 0 && entry > 0) w += (stop - entry) / entry * 100 * allocPct;
      var tp = p.tp2 || p.tp1 || p.current_price || entry;
      if (entry > 0 && tp > 0) b += (tp - entry) / entry * 100 * allocPct;
      n += pnl * allocPct;
    });
    var avgPnl = positions.length ? positions.reduce(function (s, p) {
      return s + (p.pnlPct != null ? p.pnlPct : (p.return_pct || 0));
    }, 0) / positions.length : 0;
    out._positions = {
      label: positions.length + '/' + (mCfg.portfolioSize || '?'),
      has: positions.length > 0,
      worst: w, best: b, now: n, avgPnl: avgPnl,
    };
    return out;
  }

  // tmBuildHTML is now a stub — actual rendering uses the static MODE_PANEL_TPL template
  // cloned and bound by ModePanelBinder inside tmRenderInto. Kept for backward compat.
  function tmBuildHTML(d, mCfg, modeId) { return ''; }


  // Render mode panel for Time Machine: clone the static template, set the equity
  // chart container's id, then bind enriched data via ModePanelBinder. No string concat.
  function tmRenderInto(tmr, d, mCfg, modeId) {
    if (!d) { tmr.innerHTML = '<div class="empty">No snapshot for this date.</div>'; return; }
    var color = mCfg.color || '#94a3b8';
    tmr.innerHTML = '';
    var clone = getModeTpl().content.cloneNode(true);
    var equityTarget = clone.querySelector('.tm-equity-target');
    if (equityTarget) equityTarget.id = 'tm-eq-' + modeId;
    clone.querySelectorAll('[data-color]').forEach(function (el) {
      el.style.borderLeft = '3px solid ' + color;
    });
    var enriched = enrichForBinding(d, mCfg);
    if (window.ModePanelBinder && window.ModePanelBinder.bind) {
      window.ModePanelBinder.bind(clone, enriched);
    } else {
      console.warn('[tm] ModePanelBinder not loaded — skipping data binding');
    }
    tmr.appendChild(clone);
    // Equity chart (post-bind, since the canvas now exists in DOM)
    if (d.equity && d.equity.d && d.equity.d.length > 0) {
      var el = document.getElementById('tm-eq-' + modeId);
      if (el) mk('tm-eq-' + modeId, d.equity.d, d.equity.v, color);
    }
    // Update scenario-bar fills using enriched _positions data
    var sb = clone.querySelector ? null : null;
    var pos = tmr.querySelector('.scenario-bar');
    if (pos && enriched._positions && enriched._positions.has) {
      var p = enriched._positions;
      var rng = p.best - p.worst;
      var cp = rng > 0 ? Math.max(0, Math.min(100, (p.now - p.worst) / rng * 100)) : 50;
      pos.innerHTML =
        '<div class="scenario-fill-bad" style="width:' + cp.toFixed(1) + '%"></div>' +
        '<div class="scenario-fill-good" style="width:' + (100 - cp).toFixed(1) + '%"></div>' +
        '<div class="scenario-cursor" style="left:' + cp.toFixed(1) + '%"></div>';
    }
  }
  // Time Machine = update Live sections in-place. Snapshot the full lp-grid
  // HTML on first activation so we can restore it exactly on "Back to live".
  var _tmLiveCache = {};
  function _tmCaptureLive(modeId){
    if(_tmLiveCache[modeId]) return;
    var panel=document.getElementById('p-'+modeId);
    var grid=panel?panel.querySelector('.lp-grid'):null;
    if(grid) _tmLiveCache[modeId] = grid.innerHTML;
  }
  function _fmtPct2(v){var n=Number(v||0);return (n>0?'+':'')+n.toFixed(2)+'%';}
  function _fmtUsd2(v){var n=Number(v||0);if(!isFinite(n)||n===0)return '—';return '$'+n.toFixed(2);}
  function _scoreBg(s){return s>=90?'#059669':s>=85?'#2563eb':'#f59e0b';}
  function _tkLogo(t){return t?'<img src="https://assets.parqet.com/logos/symbol/'+t+'?format=jpg" alt="" class="tk-logo" onerror="this.style.display=\\'none\\'">':'';}
  function tmUpdateLive(modeId, d, mCfg){
    var panel=document.getElementById('p-'+modeId);
    if(!panel||!d) return;
    var stats=d.stats||{};
    // ── Close Now: render from snapshot (create container if missing) ──
    var closeNow=(d.closeNow||[]);
    var closeSec=panel.querySelector('[data-section="closenow"]');
    if(closeNow.length){
      var closeHTML='<div class="cta-card cta-close" data-section="closenow"><div class="cta-header"><span class="cta-icon"><i class="fas fa-ban"></i></span><div><h3>Close Now <span class="cta-badge">'+closeNow.length+' position'+(closeNow.length>1?'s':'')+'</span></h3><p class="cta-sub">Horizon expired — exit at market open</p></div></div><table class="t"><thead><tr><th>Ticker</th><th>Bought</th><th class="hide-m">Entry $</th><th class="hide-m">Current $</th><th>P&L</th><th>Held</th><th>Action</th></tr></thead><tbody>'+closeNow.map(function(p){var rc=(p.return_pct||0)>=0?'pos':'neg';return '<tr><td>'+_tkLogo(p.ticker)+'<b>'+p.ticker+'</b></td><td class="m">'+(p.scan_date?p.scan_date.slice(5):'—')+'</td><td class="hide-m">'+_fmtUsd2(p.entry)+'</td><td class="hide-m">'+_fmtUsd2(p.current_price)+'</td><td class="'+rc+'"><b>'+_fmtPct2(p.return_pct)+'</b></td><td class="am">'+(p.days_held||'—')+'d</td><td><span class="pill neg" style="font-size:.7rem;padding:.15rem .5rem">CLOSE</span></td></tr>';}).join('')+'</tbody></table></div>';
      if(closeSec){closeSec.outerHTML=closeHTML;}
      else{var ordersSec=panel.querySelector('[data-section="orders"]');if(ordersSec)ordersSec.insertAdjacentHTML('beforebegin',closeHTML);}
    } else if(closeSec){closeSec.style.display='none';}

    // ── Orders: render from snapshot (inject table if missing) ──
    var ordersSec=panel.querySelector('[data-section="orders"]');
    if(ordersSec){
      // Hide any live "JUST EXECUTED" rotation card
      ordersSec.querySelectorAll('.cta-card').forEach(function(c){
        if(/JUST EXECUTED/i.test(c.textContent||'')) c.style.display='none';
      });
      var orders=(d.orders||[]);
      var oTable=ordersSec.querySelector('table');
      if(orders.length){
        var tableHTML='<table class="t"><thead><tr><th>Ticker</th><th class="hide-m">Chart</th><th class="hide-m">Score</th><th class="hide-m">Strat.</th><th>Entry</th><th class="hide-m">Pivot</th><th>Stop</th><th>TP1/TP2</th><th class="hide-m">R/R</th><th class="hide-m">Alloc</th><th>Action</th></tr></thead><tbody>'+orders.map(function(o){var bg=_scoreBg(o.score||0);return '<tr><td>'+_tkLogo(o.ticker)+'<b>'+o.ticker+'</b></td><td class="hide-m">—</td><td class="hide-m"><span class="pill-score" style="background:'+bg+'">'+(o.score||0)+'</span></td><td class="m hide-m">'+(o.strategy||'')+'</td><td>'+(o.entry||'')+'</td><td class="hide-m">—</td><td class="neg">'+(o.stop||'')+'</td><td class="pos">'+(o.tp1||'')+' / '+(o.tp2||'')+'</td><td class="am hide-m">'+(o.rr||'')+'</td><td class="hide-m">—</td><td><span class="pill pos">BUY</span></td></tr>';}).join('')+'</tbody></table>';
        if(oTable){oTable.outerHTML=tableHTML;}
        else{var emptyBox=ordersSec.querySelector('[style*="dashed"]');if(emptyBox)emptyBox.outerHTML=tableHTML;else ordersSec.insertAdjacentHTML('beforeend',tableHTML);}
      } else if(oTable){
        oTable.querySelector('tbody').innerHTML='<tr><td colspan="11" class="empty">No orders for this snapshot</td></tr>';
      }
      var oMeta=ordersSec.querySelector('.sc-meta');
      if(oMeta) oMeta.textContent=orders.length+' order'+(orders.length!==1?'s':'')+' on this date';
    }

    // ── On Watch: render from snapshot signals not in positions ──
    var watchSec=panel.querySelector('[data-section="watch"]');
    var expTmrw=(d.expiresTomorrow||[]);
    if(expTmrw.length){
      var watchHTML='<div class="section-card" data-section="watch"><div class="sc-head"><h3><i class="fas fa-eye"></i> On Watch <span class="count">'+expTmrw.length+'</span></h3><span class="sc-meta">portfolio full — signals on standby</span></div><table class="t"><thead><tr><th>Ticker</th><th>Score</th><th class="hide-m">Strat.</th><th>Entry</th><th>Stop</th><th>TP1/TP2</th><th class="hide-m">R/R</th><th>Status</th></tr></thead><tbody>'+expTmrw.map(function(s){var bg=_scoreBg(s.score||0);return '<tr><td>'+_tkLogo(s.ticker)+'<b>'+s.ticker+'</b></td><td><span class="pill-score" style="background:'+bg+'">'+(s.score||0)+'</span></td><td class="m hide-m">'+(s.strategy||'')+'</td><td>'+(s.entry||'')+'</td><td class="neg">'+(s.stop||'')+'</td><td class="pos">'+(s.tp1||'')+' / '+(s.tp2||'')+'</td><td class="am hide-m">'+(s.rr||'')+'</td><td><span class="pill">WATCH</span></td></tr>';}).join('')+'</tbody></table></div>';
      if(watchSec){watchSec.outerHTML=watchHTML;}
      else{var posSec=Array.from(panel.querySelectorAll('.section-card')).find(function(s){var h=s.querySelector('h3');return h&&/open positions/i.test(h.textContent);});if(posSec)posSec.insertAdjacentHTML('beforebegin',watchHTML);}
    } else if(watchSec){watchSec.style.display='none';}
    var psList=panel.querySelectorAll('.perf-hero .perf-stats .ps .ps-v');
    if(psList.length>=6){
      psList[0].textContent=_fmtPct2(stats.ret);
      psList[1].textContent=_fmtPct2(stats.dd);
      psList[2].textContent=Number(stats.wr||0).toFixed(1)+'%';
      psList[3].textContent=Number(stats.pf||0).toFixed(2)+'x';
      psList[4].textContent=String(stats.trades||0);
      psList[5].textContent=Number(stats.avgHold||0).toFixed(1)+'d';
      if(psList.length>=9){
        psList[6].textContent=stats.r2!=null?Number(stats.r2).toFixed(3):'—';
        psList[7].textContent=stats.cagr!=null?(stats.cagr>0?'+':'')+Number(stats.cagr).toFixed(1)+'%':'—';
        psList[8].textContent=stats.sharpe!=null?Number(stats.sharpe).toFixed(2):'—';
      }
    }
    var chartEl=document.getElementById('chart-'+modeId);
    if(chartEl && window.echarts){
      var existing=window.echarts.getInstanceByDom(chartEl);
      if(existing) existing.dispose();
      // Prefer the stats.ret-based cumulative curve (modeCharts) sliced to the
      // snapshot date — keeps Time Machine continuous with the live chart.
      // Fall back to the snapshot's own equity (legacy MtM) if slicing fails.
      var src=modeCharts[modeId];
      var sliced=null;
      if(src && tmActiveDateLabel){
        var idx=src.d.indexOf(tmActiveDateLabel);
        if(idx>=0) sliced={d:src.d.slice(0,idx+1), v:src.v.slice(0,idx+1)};
      }
      var dArr = sliced ? sliced.d : (d.equity && d.equity.d ? d.equity.d : []);
      var vArr = sliced ? sliced.v : (d.equity && d.equity.v ? d.equity.v : []);
      if(dArr.length) mk('chart-'+modeId, dArr, vArr, mCfg.color||'#94a3b8');
    }
    var sigSec=Array.from(panel.querySelectorAll('.section-card')).find(function(s){var h=s.querySelector('h3, .sc-sum-title');return h && /today.s signals/i.test(h.textContent);});
    if(sigSec){
      var sigBody=sigSec.querySelector('tbody');
      var sig=(d.signals||[]);
      if(sigBody){
        sigBody.innerHTML = sig.length ? sig.map(function(s){
          var bg=_scoreBg(s.score||0);
          return '<tr><td>'+_tkLogo(s.ticker)+'<b>'+s.ticker+'</b></td><td><span class="pill-score" style="background:'+bg+'">'+(s.score||0)+'</span></td><td class="m">'+(s.strategy||'')+'</td><td>'+(s.entry||'')+'</td><td class="neg">'+(s.stop||'')+'</td><td class="pos">'+(s.tp1||'')+' / '+(s.tp2||'')+'</td><td class="am">'+(s.rr||'')+'</td></tr>';
        }).join('') : '<tr><td colspan="7" class="empty">No signals</td></tr>';
      }
    }
    var posSec=Array.from(panel.querySelectorAll('.section-card')).find(function(s){var h=s.querySelector('h3');return h && /open positions/i.test(h.textContent);});
    if(posSec){
      var posBody=posSec.querySelector('tbody');
      var pos=(d.positions||[]);
      if(posBody){
        posBody.innerHTML = pos.length ? pos.map(function(p){
          var pnl=p.return_pct!=null?p.return_pct:(p.pnlPct||0);
          var rc=pnl>=0?'pos':'neg';
          var termStyle=p._terminal?'style="opacity:.45;filter:grayscale(1);background:#f1f5f9"':'';
          var stBadge='';
          if(p._terminal){var st=(p._terminalStatus||'closed').toUpperCase();var sc=/TP/.test(st)?'pos':/SL/.test(st)?'neg':'m';stBadge=' <span class="pill '+sc+'" style="font-size:.55rem;padding:.1rem .3rem">'+st+'</span>';}
          return '<tr '+termStyle+'><td>'+_tkLogo(p.ticker)+'<b>'+p.ticker+'</b>'+stBadge+'</td><td class="m hide-m">'+(p.scan_date?p.scan_date.slice(5):'—')+'</td><td class="hide-m">'+_fmtUsd2(p.entry)+'</td><td class="hide-m">'+_fmtUsd2(p.current_price)+'</td><td class="'+rc+'"><b>'+_fmtPct2(pnl)+'</b></td><td class="neg hide-m">'+_fmtUsd2(p.stop)+'</td><td class="pos hide-m">'+_fmtUsd2(p.tp2)+'</td><td class="m">'+(p.days_remaining||0)+'d</td></tr>';
        }).join('') : '<tr><td colspan="8" class="empty">No active positions</td></tr>';
      }
      var posCount=posSec.querySelector('.count'); if(posCount) posCount.textContent=pos.length+'/'+(mCfg.portfolioSize||'?');
    }
    var hSec=Array.from(panel.querySelectorAll('.section-card')).find(function(s){var h=s.querySelector('h3, .sc-sum-title');return h && /trade history/i.test(h.textContent);});
    if(hSec){
      var hBody=hSec.querySelector('tbody');
      var ct=(d.closedTrades||[]).slice().sort(function(a,b){return (b.scanDate||'').localeCompare(a.scanDate||'');});
      if(hBody){
        hBody.innerHTML = ct.length ? ct.map(function(t){
          var pnl=t.pnlPct||0;
          var rc=pnl>0?'pos':pnl<0?'neg':'m';
          var st=(t.status||'').toUpperCase();
          var stCls=/TP/.test(st)?'pos':/SL/.test(st)?'neg':'m';
          return '<tr><td>'+_tkLogo(t.ticker)+'<b>'+t.ticker+'</b></td><td class="m hide-m">'+(t.entryDate?t.entryDate.slice(5):'—')+'</td><td class="m hide-m">'+(t.exitDate?t.exitDate.slice(5):'—')+'</td><td class="hide-m">'+_fmtUsd2(t.actualEntry)+'</td><td class="hide-m">'+_fmtUsd2(t.exitPrice)+'</td><td class="'+rc+'"><b>'+_fmtPct2(pnl)+'</b></td><td class="m hide-m">'+(t.holdDays||0)+'d</td><td><span class="pill '+stCls+'">'+st+'</span></td></tr>';
        }).join('') : '<tr><td colspan="8" class="empty">No closed trades</td></tr>';
      }
      var hCount=hSec.querySelector('.count'); if(hCount) hCount.textContent=ct.length+' closed';
    }
  }
  window.tmUpdateLive = tmUpdateLive;

  function tmShowLive(){
    tmActiveDateLabel=null;
    var panel=document.getElementById('p-'+activeMode);
    var grid=panel?panel.querySelector('.lp-grid'):null;
    if(grid && _tmLiveCache[activeMode]){
      grid.innerHTML=_tmLiveCache[activeMode];
      var chartEl=document.getElementById('chart-'+activeMode);
      if(chartEl){
        var existing=window.echarts && window.echarts.getInstanceByDom(chartEl);
        if(existing) existing.dispose();
        var dflt=modeCharts[activeMode];
        if(dflt) mk('chart-'+activeMode, dflt.d, dflt.v, dflt.c);
      }
      delete _tmLiveCache[activeMode];
    }
    document.getElementById('tmBanner').className='tm-banner';
    var fab=document.getElementById('tmFab');
    if(fab){fab.classList.remove('viewing');fab.style.boxShadow='';}
  }
  var tmActiveDateLabel=null;
  function tmLoadIdx(idx){
    var banner=document.getElementById('tmBanner');
    if(idx===tmDates.length-1){tmShowLive();return;}
    _tmCaptureLive(activeMode);
    var dateStr=tmDates[idx];
    tmActiveDateLabel=dateStr.slice(4,6)+'/'+dateStr.slice(6,8);
    fetch('/scanner/status/history/'+dateStr+'.json?v='+_v).then(function(r){return r.json()}).then(function(snap){
      var d=snap.modes[activeMode];
      if(!d){
        banner.className='tm-banner show';
        banner.innerHTML='<i class="fas fa-triangle-exclamation"></i> No data for '+activeMode+' on '+dateStr;
        return;
      }
      var mCfg=tmModesCfg.modes?tmModesCfg.modes[activeMode]:{};
      tmUpdateLive(activeMode, d, mCfg);
      banner.className='tm-banner show';
      var formatted=dateStr.slice(0,4)+'-'+dateStr.slice(4,6)+'-'+dateStr.slice(6,8);
      banner.innerHTML='<i class="fas fa-clock-rotate-left"></i> Viewing snapshot from <b>'+formatted+'</b> &mdash; <a onclick="window.tmGoLive()">Back to live</a>';
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
    tmShowLive();
  };
  // Init chart for the default visible mode
  var dflt=modeCharts[activeMode];
  if(dflt)mk('chart-'+activeMode,dflt.d,dflt.v,dflt.c);
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
<script>
// ── Signal Live Tracker v2 — fill detection + virtual P&L + execution summary ──
(function(){
  var PROXIES=['https://api.allorigins.win/get?url=','https://api.codetabs.com/v1/proxy?quest='];
  var INTERVAL=30000;
  var _cache={};var _cacheTs=0;var CACHE_TTL=300000;

  function tryProxy(idx,yahooUrl,cb){
    if(idx>=PROXIES.length)return cb({});
    var purl=PROXIES[idx]+encodeURIComponent(yahooUrl);
    fetch(purl).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.text()}).then(function(raw){
      try{var body=raw;try{var wrap=JSON.parse(raw);if(wrap.contents)body=wrap.contents}catch(e){}
      var p=JSON.parse(body);var m={};(p.quoteResponse&&p.quoteResponse.result||[]).forEach(function(q){m[q.symbol]={price:q.regularMarketPrice,open:q.regularMarketOpen,high:q.regularMarketDayHigh,low:q.regularMarketDayLow,chg:q.regularMarketChangePercent}});
      if(Object.keys(m).length>0){_cache=m;_cacheTs=Date.now();cb(m)}else{tryProxy(idx+1,yahooUrl,cb)}}catch(e){tryProxy(idx+1,yahooUrl,cb)}
    }).catch(function(){tryProxy(idx+1,yahooUrl,cb)});
  }

  function isNYSEOpen(){
    var now=new Date();var d=now.getUTCDay();if(d===0||d===6)return false;
    var mins=now.getUTCHours()*60+now.getUTCMinutes();return mins>=810&&mins<=1200;
  }

  function fetchQuotes(tickers,cb){
    if(Date.now()-_cacheTs<CACHE_TTL&&Object.keys(_cache).length){return cb(_cache)}
    var mktOpen=isNYSEOpen();
    // Try LiveEngine prices first (Webull-fed or WebSocket)
    if(window.LE&&typeof LE.getPrices==='function'){
      var lp=LE.getPrices(),m={},got=0;
      tickers.forEach(function(t){if(lp[t]&&lp[t].price){
        m[t]={price:lp[t].price,open:mktOpen?lp[t].open:null,high:mktOpen?lp[t].dayHigh:null,low:mktOpen?lp[t].dayLow:null,chg:lp[t].changePct};got++}});
      if(got>=tickers.length*0.5){_cache=m;_cacheTs=Date.now();return cb(m)}
    }
    // Fallback: Webull quote per ticker (no CORS proxy needed)
    var done=false;var pending=tickers.length;var result={};
    var timer=setTimeout(function(){if(!done){done=true;cb(result)}},8000);
    tickers.forEach(function(t){
      if(window.LE&&typeof LE.getPrice==='function'){var p=LE.getPrice(t);if(p&&p.price){
        result[t]={price:p.price,open:mktOpen?p.open:null,high:mktOpen?p.dayHigh:null,low:mktOpen?p.dayLow:null,chg:p.changePct};
        pending--;if(pending<=0&&!done){done=true;clearTimeout(timer);cb(result)}return}}
      pending--;if(pending<=0&&!done){done=true;clearTimeout(timer);cb(result)}
    });
  }

  function evalSignal(q,entry,stop,tp1,tp2,vwap){
    if(!q||!q.price)return{label:'—',cls:'m',detail:'',skip:false,filled:false,pnl:null};
    var p=q.price,o=q.open,lo=q.low,hi=q.high;
    if(!isNYSEOpen()){o=null;lo=null;hi=null;}
    // VWAP gate: if open gapped too far above entry, skip
    var gate=vwap?vwap*1.01:entry*1.02;
    if(o&&o>gate&&o>entry*1.03)return{label:'SKIPPED ⊘',cls:'neg',detail:'Gap +'+((o/entry-1)*100).toFixed(1)+'% above gate',skip:true,filled:false,pnl:null};
    // Fill detection: limit buy at entry triggers if dayLow <= entry or open <= entry
    var filled=(o!=null&&o<=entry)||(lo!=null&&lo<=entry);
    if(!filled){
      if(p>=entry)return{label:'UNFILLED',cls:'m',detail:'Limit $'+entry.toFixed(2)+' not reached (low $'+(lo||0).toFixed(2)+')',skip:false,filled:false,pnl:null};
      return{label:'PENDING',cls:'m',detail:'$'+((entry-p)).toFixed(2)+' to entry',skip:false,filled:false,pnl:null};
    }
    // Fill price: open below entry = better fill at open; otherwise fill at limit
    var fp=o!=null&&o<=entry?o:entry;
    // Stop hit check (dayLow breached stop after fill)
    if(lo!=null&&lo<=stop){var slPnl=((stop-fp)/fp*100);return{label:'STOPPED ✗ '+slPnl.toFixed(1)+'%',cls:'neg',detail:'Fill $'+fp.toFixed(2)+' → SL $'+stop.toFixed(2),skip:false,filled:true,fp:fp,pnl:slPnl,terminal:true}}
    // TP2 hit
    if(tp2&&hi!=null&&hi>=tp2){var t2=((tp2-fp)/fp*100);return{label:'TP2 ✓✓ +'+t2.toFixed(1)+'%',cls:'pos',detail:'Fill $'+fp.toFixed(2)+' → TP2 $'+tp2.toFixed(2),skip:false,filled:true,fp:fp,pnl:t2,terminal:true,tp1Hit:true}}
    // TP1 hit (still holding remainder)
    if(hi!=null&&hi>=tp1){var pnl1=((p-fp)/fp*100);return{label:'TP1 ✓ '+(pnl1>=0?'+':'')+pnl1.toFixed(1)+'%',cls:'pos',detail:'Fill $'+fp.toFixed(2)+' — TP1 touched at $'+tp1.toFixed(2),skip:false,filled:true,fp:fp,pnl:pnl1,tp1Hit:true}}
    // Active filled position
    var pnl=((p-fp)/fp*100);
    return{label:(pnl>=0?'↑+':'↓')+pnl.toFixed(1)+'%',cls:pnl>=0?'pos':'neg',detail:'Fill $'+fp.toFixed(2)+' → Now $'+p.toFixed(2),skip:false,filled:true,fp:fp,pnl:pnl};
  }

  function update(){
    var rows=document.querySelectorAll('tr[data-sig-ticker]');
    if(!rows.length)return;
    var tickers=[],seen={},baked={};
    rows.forEach(function(r){
      var t=r.dataset.sigTicker;
      if(!seen[t]){
        seen[t]=1;tickers.push(t);
        var bp=+r.dataset.sigPrice,bo=+r.dataset.sigOpen,bh=+r.dataset.sigHigh,bl=+r.dataset.sigLow;
        if(bp)baked[t]={price:bp,open:bo||null,high:bh||null,low:bl||null,chg:null};
      }
    });
    if(window.LE&&typeof LE.addTickers==='function')LE.addTickers(tickers);
    fetchQuotes(tickers,function(live){
      var quotes={};tickers.forEach(function(t){quotes[t]=live[t]||baked[t]||null});
      var panels={};
      rows.forEach(function(row){
        var tk=row.dataset.sigTicker,entry=+row.dataset.sigEntry,stop=+row.dataset.sigStop,tp1=+row.dataset.sigTp1,tp2=+row.dataset.sigTp2||0,vwap=+row.dataset.sigVwap||0,rank=row.dataset.sigRank;
        var q=quotes[tk];var st=evalSignal(q,entry,stop,tp1,tp2,vwap);
        // Status pill
        var statusCell=row.querySelector('td:last-child');
        if(statusCell){var pill=statusCell.querySelector('.pill');if(pill){pill.className='pill '+st.cls;pill.textContent=st.label;pill.title=st.detail}}
        // Price + P&L badge under ticker name
        var tc=row.querySelector('td:first-child');
        if(tc&&q&&q.price){
          var b=tc.querySelector('.slp');
          if(!b){b=document.createElement('span');b.className='slp';b.style.cssText='display:block;font-size:.6rem;margin-top:.1rem';tc.appendChild(b)}
          if(st.filled&&st.pnl!=null){
            var pc=st.pnl>=0?'#059669':'#dc2626';
            b.innerHTML='<span style="color:#64748b">$'+q.price.toFixed(2)+'</span> <b style="color:'+pc+'">'+(st.pnl>=0?'+':'')+st.pnl.toFixed(2)+'%</b> <span style="font-size:.5rem;color:#94a3b8">from $'+(st.fp||entry).toFixed(2)+'</span>';
          }else{
            var cc=q.chg>=0?'#059669':'#dc2626';var cs=q.chg!=null?(q.chg>=0?'+':'')+q.chg.toFixed(2)+'%':'';
            b.innerHTML='<span style="color:#64748b">$'+q.price.toFixed(2)+'</span> <span style="color:'+cc+';font-weight:600">'+cs+'</span>';
          }
        }
        // Row background: green=filled+winning, red=stopped, orange=filled+losing, grey=unfilled
        if(st.skip){row.style.cssText='opacity:.35;text-decoration:line-through'}
        else if(st.filled&&st.terminal&&st.label.indexOf('STOPPED')>=0){row.style.cssText='background:rgba(254,226,226,.35);border-left:3px solid #fca5a5'}
        else if(st.filled&&st.tp1Hit){row.style.cssText='background:rgba(209,250,229,.3);border-left:3px solid #6ee7b7'}
        else if(st.filled&&st.pnl!=null&&st.pnl>=0){row.style.cssText='background:rgba(220,252,231,.25);border-left:3px solid #86efac'}
        else if(st.filled&&st.pnl!=null){row.style.cssText='background:rgba(255,237,213,.25);border-left:3px solid #fdba74'}
        else if(!st.filled){row.style.cssText='opacity:.55;background:#fafbfc'}
        else{row.style.cssText=''}
        // Fill badge in entry column (index 3: Ticker, Score, Setup, Entry)
        var entryTd=row.querySelectorAll('td')[3];
        if(entryTd){
          var fb=entryTd.querySelector('.fill-tag');
          if(st.filled){
            if(!fb){fb=document.createElement('div');fb.className='fill-tag';fb.style.cssText='font-size:.55rem;font-weight:600;margin-top:.15rem';entryTd.appendChild(fb)}
            fb.style.color=st.pnl>=0?'#059669':'#dc2626';
            fb.textContent='✓ filled'+(st.fp&&st.fp<entry?' @ $'+st.fp.toFixed(2):'');
          }else if(fb){fb.remove()}
        }
        // Panel tracking for summary + fallback
        var panel=row.closest('.mode-panel');
        if(panel){
          var pid=panel.id;
          if(!panels[pid])panels[pid]={p:[],f:[],filled:0,wins:0,losses:0,pnlSum:0,stopped:0,tp1:0,tp2:0,n:0};
          if(rank==='primary'){
            panels[pid].p.push({row:row,st:st,tk:tk,entry:entry,stop:stop,tp1:tp1,tp2:tp2,q:q});panels[pid].n++;
            if(st.filled){panels[pid].filled++;if(st.pnl!=null){panels[pid].pnlSum+=st.pnl;if(st.pnl>=0)panels[pid].wins++;else panels[pid].losses++}if(st.terminal&&st.label.indexOf('STOPPED')>=0)panels[pid].stopped++;if(st.tp1Hit)panels[pid].tp1++;if(st.terminal&&st.label.indexOf('TP2')>=0)panels[pid].tp2++}
          }else{panels[pid].f.push({row:row,st:st})}
        }
      });
      // Fallback promotion + per-mode execution summary
      Object.keys(panels).forEach(function(pid){
        var d=panels[pid],pr=d.p,fb=d.f;
        var allSkip=pr.length>0&&pr.every(function(x){return x.st.skip});
        fb.forEach(function(x,i){
          if(allSkip&&i===0){
            x.row.style.cssText='opacity:1;background:#f0fdf4';
            var tc=x.row.querySelector('td:first-child');
            if(tc&&!tc.querySelector('.fb-up')){var bd=document.createElement('span');bd.className='fb-up pill pos';bd.style.cssText='font-size:.55rem;margin-left:.3rem';bd.textContent='▲ PROMOTED';tc.appendChild(bd)}
          }else if(!allSkip){
            x.row.style.cssText='opacity:.55';
            var rm=x.row.querySelector('.fb-up');if(rm)rm.remove();
          }
        });
        // Execution summary bar above signals table
        if(d.n>0){
          var panel=document.getElementById(pid);if(!panel)return;
          var sumEl=panel.querySelector('.sig-exec-sum');
          if(!sumEl){var sig=panel.querySelector('tr[data-sig-ticker]');if(!sig)return;var tbl=sig.closest('table');if(!tbl)return;sumEl=document.createElement('div');sumEl.className='sig-exec-sum';sumEl.style.cssText='display:flex;gap:.65rem;flex-wrap:wrap;align-items:center;padding:.55rem .85rem;margin-bottom:.65rem;background:#fff;border-radius:10px;border:1px solid #e2e8f0;font-size:.73rem;box-shadow:0 1px 3px rgba(15,23,42,.04)';tbl.parentNode.insertBefore(sumEl,tbl)}
          var nc=d.pnlSum>=0?'#059669':'#dc2626';
          var h='<span style="font-weight:700;color:#334155">⚡ Live Execution Sim</span>';
          h+=' <span style="background:#e0e7ff;padding:.15rem .4rem;border-radius:4px;font-weight:600;color:#3730a3">'+d.filled+'/'+d.n+' filled</span>';
          if(d.filled>0){
            h+=' <span style="color:'+nc+';font-weight:700;font-size:.78rem">'+(d.pnlSum>=0?'+':'')+d.pnlSum.toFixed(2)+'% net</span>';
            h+=' <span style="color:#94a3b8">'+d.wins+'W '+d.losses+'L</span>';
          }
          if(d.tp1>0)h+=' <span style="color:#059669;font-weight:600">✓ '+d.tp1+' TP1</span>';
          if(d.tp2>0)h+=' <span style="color:#d97706;font-weight:600">✓✓ '+d.tp2+' TP2</span>';
          if(d.stopped>0)h+=' <span style="color:#dc2626;font-weight:600">✗ '+d.stopped+' SL</span>';
          if(d.n>d.filled)h+=' <span style="color:#94a3b8;font-style:italic">'+(d.n-d.filled)+' waiting</span>';
          sumEl.innerHTML=h;
        }
        // ── Sync filled signals → Open Positions + lp-card + Trade History ──
        var modeId=pid.replace('p-','');
        var livePos=[],termTrades=[];
        d.p.forEach(function(x){
          if(!x.st.filled)return;
          if(x.st.terminal)termTrades.push(x);else livePos.push(x);
        });
        var totalCount=livePos.length+termTrades.length;
        if(totalCount===0)return;
        // 1) Open Positions section
        var posEl=document.getElementById('sec-pos-'+modeId);
        if(posEl){
          var empty=posEl.querySelector('.empty');if(empty)empty.style.display='none';
          posEl.querySelectorAll('tr[data-sig-live]').forEach(function(r){r.remove()});
          var tbody=posEl.querySelector('tbody');
          if(!tbody){
            var tbl=document.createElement('table');tbl.className='t';
            tbl.innerHTML='<thead><tr><th>Ticker</th><th class="hide-m">Fill</th><th class="hide-m">Now</th><th>P&L</th><th class="hide-m">Stop</th><th class="hide-m">TP</th><th>Status</th></tr></thead><tbody></tbody>';
            var sh=posEl.querySelector('.sc-head');if(sh)sh.after(tbl);else posEl.appendChild(tbl);
            tbody=tbl.querySelector('tbody');
          }
          livePos.forEach(function(x){
            var fp=x.st.fp||x.entry,pr=x.q?x.q.price:0,pc=x.st.pnl>=0?'pos':'neg';
            var sLbl=x.st.tp1Hit?'TP1 ✓':'LIVE',sCls=x.st.tp1Hit?'pos':pc;
            var tr=document.createElement('tr');tr.setAttribute('data-sig-live','1');
            tr.style.cssText='background:'+(x.st.pnl>=0?'#f0fdf4':'#fff7ed')+';border-left:3px solid '+(x.st.pnl>=0?'#059669':'#f59e0b');
            tr.innerHTML='<td><b>'+x.tk+'</b><div style="font-size:.55rem;color:#3b82f6">⚡ Signal fill</div></td><td class="hide-m">$'+fp.toFixed(2)+'</td><td class="hide-m">$'+pr.toFixed(2)+'</td><td class="'+pc+'"><b>'+(x.st.pnl>=0?'+':'')+x.st.pnl.toFixed(2)+'%</b></td><td class="neg hide-m">$'+x.stop.toFixed(2)+'</td><td class="pos hide-m">$'+x.tp1.toFixed(2)+(x.tp2?' / $'+x.tp2.toFixed(2):'')+'</td><td><span class="pill '+sCls+'">'+sLbl+'</span></td>';
            tbody.insertBefore(tr,tbody.firstChild);
          });
          termTrades.forEach(function(x){
            var fp=x.st.fp||x.entry,pc=x.st.pnl>=0?'pos':'neg';
            var rLbl=x.st.label.indexOf('STOPPED')>=0?'SL':x.st.label.indexOf('TP2')>=0?'TP2':'TP1';
            var tr=document.createElement('tr');tr.setAttribute('data-sig-live','1');
            tr.style.cssText='opacity:.5;background:#f1f5f9;filter:grayscale(.8)';
            tr.innerHTML='<td><b>'+x.tk+'</b><div style="font-size:.55rem;color:#94a3b8">Closed today</div></td><td class="hide-m">$'+fp.toFixed(2)+'</td><td class="hide-m">—</td><td class="'+pc+'"><b>'+(x.st.pnl>=0?'+':'')+x.st.pnl.toFixed(2)+'%</b></td><td class="neg hide-m">$'+x.stop.toFixed(2)+'</td><td class="pos hide-m">$'+x.tp1.toFixed(2)+'</td><td><span class="pill '+pc+'">'+rLbl+'</span></td>';
            tbody.appendChild(tr);
          });
        }
        // 2) Live Portfolio card
        var pnlEl=document.getElementById('lp-pnl-'+modeId);
        var chipsEl=document.getElementById('lp-chips-'+modeId);
        var posC=document.getElementById('lp-pos-'+modeId);
        var initEl=document.getElementById('lp-init-'+modeId);
        if(initEl)initEl.style.display='none';
        window._sigLiveAgg=window._sigLiveAgg||{};
        var tPnl=0;livePos.forEach(function(x){tPnl+=(x.st.pnl||0)});
        window._sigLiveAgg[modeId]={count:livePos.length,totalPnl:tPnl,alerts:[]};
        if(pnlEl){
          pnlEl.textContent=(tPnl>=0?'+':'')+tPnl.toFixed(2)+'%';
          pnlEl.className='lp-pnl '+(tPnl>=0?'pos':'neg');
          var absEl=document.getElementById('lp-pnl-abs-'+modeId);
          if(absEl)absEl.textContent='Unrealized P&L ('+livePos.length+' pos)';
        }
        if(chipsEl){
          var ch='<span class="lp-chip lp-chip-pos"><i class="fas fa-layer-group"></i> '+livePos.length+' pos</span>';
          if(termTrades.length)ch+='<span class="lp-chip" style="color:#94a3b8;font-size:.65rem"><i class="fas fa-check"></i> '+termTrades.length+' closed</span>';
          chipsEl.innerHTML=ch;
        }
        if(posC&&livePos.length){
          var strip='';livePos.forEach(function(x){
            var c=x.st.pnl>=0?'#059669':'#dc2626';
            strip+='<div style="display:inline-flex;align-items:center;gap:.3rem;padding:.2rem .5rem;background:'+(x.st.pnl>=0?'#ecfdf5':'#fef2f2')+';border-radius:6px;font-size:.72rem;margin:.1rem .15rem"><b>'+x.tk+'</b><span style="color:'+c+';font-weight:700">'+(x.st.pnl>=0?'+':'')+x.st.pnl.toFixed(1)+'%</span></div>';
          });
          posC.innerHTML=strip;
        }
        // 3) Trade History — inject terminal trades at top
        var histEl=document.getElementById('sec-hist-'+modeId);
        if(histEl&&termTrades.length){
          var htb=histEl.querySelector('tbody');
          if(htb){
            htb.querySelectorAll('tr[data-sig-live]').forEach(function(r){r.remove()});
            var today=new Date().toISOString().slice(0,10).slice(5);
            termTrades.forEach(function(x){
              var fp=x.st.fp||x.entry,pc=x.st.pnl>=0?'pos':'neg';
              var exitP=x.st.label.indexOf('STOPPED')>=0?x.stop:x.st.label.indexOf('TP2')>=0?x.tp2:x.tp1;
              var rLbl=x.st.label.indexOf('STOPPED')>=0?'SL':x.st.label.indexOf('TP2')>=0?'TP2':'TP1';
              var tr=document.createElement('tr');tr.setAttribute('data-sig-live','1');
              tr.style.cssText='background:#fffbeb;border-left:3px solid #f59e0b';
              tr.innerHTML='<td><b>'+x.tk+'</b><div style="font-size:.55rem;color:#d97706">Today (sim)</div></td><td class="hide-m">'+today+'</td><td class="hide-m">'+today+'</td><td class="hide-m">$'+fp.toFixed(2)+'</td><td class="hide-m">$'+exitP.toFixed(2)+'</td><td class="'+pc+'"><b>'+(x.st.pnl>=0?'+':'')+x.st.pnl.toFixed(2)+'%</b></td><td class="hide-m">0d</td><td><span class="pill '+pc+'">'+rLbl+'</span></td>';
              htb.insertBefore(tr,htb.firstChild);
            });
            var hCount=histEl.querySelector('.count');
            if(hCount)hCount.textContent=(htb.querySelectorAll('tr').length)+' closed';
          }
        }
      });
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){update();setInterval(update,INTERVAL)});
  else{update();setInterval(update,INTERVAL)}
})();

// ── Position Live MtM + Equity Point Update ──
(function(){
  var MTM_INTERVAL=60000; // 60s
  var PROXIES=['https://api.allorigins.win/get?url='];
  function isNYSEOpen(){var now=new Date();var d=now.getUTCDay();if(d===0||d===6)return false;var m=now.getUTCHours()*60+now.getUTCMinutes();return m>=810&&m<=1200;}
  function fetchQuote(ticker){
    var u='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(ticker)+'?range=1d&interval=1d';
    return fetch(PROXIES[0]+encodeURIComponent(u)).then(function(r){return r.json()}).then(function(w){
      var inner=JSON.parse(w.contents);return inner.chart.result[0].meta.regularMarketPrice;
    }).catch(function(){return null});
  }
  function updatePositions(){
    if(!isNYSEOpen())return;
    var activeTab=document.querySelector('.mode-tab.active');
    if(!activeTab)return;
    var modeId=activeTab.dataset.mode;
    var panel=document.getElementById('p-'+modeId);
    if(!panel)return;
    // Find position rows
    var posRows=panel.querySelectorAll('[data-section="positions"] tr[data-pos-ticker], [data-section="positions"] tbody tr');
    if(!posRows||!posRows.length)return;
    // Collect tickers from position rows
    var positions=[];
    posRows.forEach(function(row){
      var cells=row.querySelectorAll('td');
      if(cells.length<5)return;
      var tickerEl=cells[0].querySelector('b');
      if(!tickerEl)return;
      var ticker=tickerEl.textContent.trim();
      var entryCell=cells[2]||cells[1];
      var entry=parseFloat((entryCell.textContent||'').replace(/[^0-9.]/g,''));
      if(!ticker||!entry)return;
      positions.push({ticker:ticker,entry:entry,row:row,cells:cells});
    });
    if(!positions.length)return;
    // Fetch prices for all position tickers
    var tickers=[...new Set(positions.map(function(p){return p.ticker}))];
    Promise.all(tickers.map(fetchQuote)).then(function(prices){
      var priceMap={};tickers.forEach(function(t,i){if(prices[i])priceMap[t]=prices[i]});
      var totalMtm=0;var count=0;
      positions.forEach(function(p){
        var lp=priceMap[p.ticker];
        if(!lp)return;
        var pnl=((lp-p.entry)/p.entry*100);
        totalMtm+=pnl;count++;
        // Update current price cell (usually cell 3)
        var curCell=p.cells[3];
        if(curCell&&curCell.classList.contains('hide-m')){curCell.textContent='$'+lp.toFixed(2)}
        // Update P&L cell (usually cell 4)
        var pnlCell=p.cells[4];
        if(pnlCell){
          var b=pnlCell.querySelector('b');
          if(b){b.textContent=(pnl>=0?'+':'')+pnl.toFixed(2)+'%';pnlCell.className=pnl>=0?'pos':'neg'}
        }
      });
      // Update hero unrealized stat if available
      var heroUnreal=panel.querySelector('[data-bind="unrealized"]');
      if(heroUnreal&&count>0){
        var avgMtm=totalMtm/count;
        heroUnreal.textContent=(avgMtm>=0?'+':'')+avgMtm.toFixed(2)+'%';
        heroUnreal.style.color=avgMtm>=0?'#059669':'#dc2626';
      }
      // Append live equity point to chart
      if(typeof modeCharts!=='undefined'&&modeCharts[modeId]&&count>0){
        var now=new Date();var label=(now.getMonth()+1).toString().padStart(2,'0')+'/'+now.getDate().toString().padStart(2,'0');
        var eq=modeCharts[modeId];
        var lastEq=eq.v[eq.v.length-1]||100;
        // Simple: adjust last equity point by avg position MtM delta
        var _pSizeMap=${JSON.stringify(Object.fromEntries(Object.entries(config.modes).map(([id,c])=>[id,c.portfolioSize])))};
        var weight=1/(_pSizeMap[modeId]||1);
        var liveEq=lastEq+(totalMtm*weight);
        // Update or append today's point
        if(eq.d[eq.d.length-1]===label){eq.v[eq.v.length-1]=+liveEq.toFixed(2)}
        else{eq.d.push(label);eq.v.push(+liveEq.toFixed(2))}
        // Re-render chart
        var chartEl=panel.querySelector('.eq-chart');
        if(chartEl){
          var inst=window.echarts&&window.echarts.getInstanceByDom(chartEl);
          if(inst){inst.setOption({xAxis:{data:eq.d},series:[{data:eq.v}]})}
        }
      }
      // Update last-refresh timestamp
      var ts=panel.querySelector('.mtm-timestamp');
      if(!ts){ts=document.createElement('span');ts.className='mtm-timestamp';ts.style.cssText='font-size:.65rem;color:#94a3b8;margin-left:.5rem';
        var heroEl=panel.querySelector('.hero-stats');if(heroEl)heroEl.appendChild(ts)}
      var t=new Date();ts.textContent='Live '+t.getHours().toString().padStart(2,'0')+':'+t.getMinutes().toString().padStart(2,'0');
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){updatePositions();setInterval(updatePositions,MTM_INTERVAL)});
  else{updatePositions();setInterval(updatePositions,MTM_INTERVAL)}
})();
</script>
<style>
.fv-overlay{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .2s}
.fv-overlay.open{opacity:1;pointer-events:auto}
.fv-modal{background:#fff;border-radius:14px;padding:1rem;max-width:620px;width:95%;box-shadow:0 20px 60px rgba(0,0,0,.3);position:relative}
.fv-modal img{width:100%;border-radius:8px;display:block}
.fv-close{position:absolute;top:.5rem;right:.75rem;background:none;border:none;font-size:1.3rem;cursor:pointer;color:#64748b;line-height:1}
.fv-title{font-size:.85rem;font-weight:700;margin-bottom:.5rem;color:#0f172a}
.fv-links{display:flex;gap:.5rem;margin-top:.6rem;flex-wrap:wrap}
.fv-links a{font-size:.7rem;padding:.25rem .6rem;border-radius:6px;background:#f1f5f9;color:#3b82f6;text-decoration:none;font-weight:600}
.fv-links a:hover{background:#e0e7ff}
</style>
<div class="fv-overlay" id="fvOverlay" onclick="if(event.target===this)closeFV()">
  <div class="fv-modal">
    <button class="fv-close" onclick="closeFV()">&times;</button>
    <div class="fv-title" id="fvTitle"></div>
    <img id="fvImg2" src="" alt="chart">
    <div class="fv-links" id="fvLinks"></div>
  </div>
</div>
<script>
(function(){
  function openFV(ticker){
    if(!ticker)return;
    var t=ticker.toUpperCase();
    document.getElementById('fvTitle').textContent=t+' — Daily Chart';
    document.getElementById('fvImg2').src='https://charts2-node.finviz.com/chart?t='+t+'&tf=d&s=linear&ct=candle_stick&o[0][ot]=sma&o[0][op]=20&o[0][oc]=DC32B363&o[1][ot]=sma&o[1][op]=50&o[1][oc]=FF8F33C6&o[2][ot]=sma&o[2][op]=200&o[2][oc]=DCB3326D';
    document.getElementById('fvLinks').innerHTML=
      '<a href="https://finviz.com/quote.ashx?t='+t+'" target="_blank" rel="noopener">FinViz</a>'+
      '<a href="https://finance.yahoo.com/quote/'+t+'/" target="_blank" rel="noopener">Yahoo Finance</a>'+
      '<a href="https://www.tradingview.com/symbols/'+t+'/" target="_blank" rel="noopener">TradingView</a>'+
      '<a href="https://stockanalysis.com/stocks/'+t.toLowerCase()+'/" target="_blank" rel="noopener">StockAnalysis</a>';
    document.getElementById('fvOverlay').classList.add('open');
  }
  window.closeFV=function(){document.getElementById('fvOverlay').classList.remove('open')};
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeFV()});
  document.addEventListener('click',function(e){
    var b=e.target.closest('td b, td strong');
    if(!b)return;
    var txt=(b.textContent||'').trim();
    if(/^[A-Z]{1,5}(-[A-Z]{1,4})?$/.test(txt)){e.preventDefault();openFV(txt);}
  });
})();
</script>
</body>
</html>`;

  fs.writeFileSync(OUT, html);
  console.log(`\u2705 ${OUT} generated (${(html.length / 1024).toFixed(0)}KB)`);
  for (const [id, m] of Object.entries(modes)) {
    console.log(`   ${m.cfg.label}: +${m.m.ret}%, DD ${m.m.dd}%, WR ${m.m.wr}%, PF ${m.m.pf}x, ${m.m.trades} trades`);
  }

  // ── Save daily snapshot for time machine ──
  const todayISO = new Date().toISOString().slice(0, 10);
  const todayKey = todayISO.replace(/-/g, '');
  const historyDir = path.join(ROOT, 'scanner/status/history');
  fs.mkdirSync(historyDir, { recursive: true });

  // modeEquityHistory was built earlier in main() (right after prevSnap load).
  // It's the canonical per-day equity already used by modes[id].ec / modeCharts /
  // panel(). Reused below to seed the persisted snapshot's equity payload.

  // prevSnap is loaded earlier in main() (so panel() can use it during HTML render).
  // Reuse the same closure-bound prevSnap here for snapshot annotation.

  const snapshot = { date: todayISO, updatedAt, scanDir };
  snapshot.modes = {};
  // NOTE: each mode is an independent alternative strategy — a user replicating
  // Dynamic is not replicating Balanced/Secured in parallel, so the same ticker
  // legitimately showing up across modes is a signal of confirmation, not a
  // hidden concentration risk. No cross-mode gating here by design.
  for (const [id, { cfg, trades: mTrades, m: mM }] of Object.entries(modes)) {
    const sig = signalsFor(cfg);
    const pos = posFor(cfg, mTrades);

    // MtM equity for today: anchor to frozen returnTotal (sweep-authoritative).
    // Adding live unrealized created day-to-day discontinuities (chart jumps when open
    // positions PnL fluctuates). Frozen value is the consistent backtest equity.
    const realized = mM.ret;
    const todayMtm = +(100 + realized).toFixed(2);
    const todayLabel = todayISO.slice(5).replace('-', '/');

    // Build continuous MtM curve from frozen EC (authoritative) or snapshot fallback
    const frozenEC = modes[id].m.equityCurve;
    let ec;
    if (frozenEC && frozenEC.filter(p => p.date).length > 0) {
      const _dedup = new Map();
      for (const p of frozenEC) {
        if (!p.date) continue;
        _dedup.set(p.date.slice(5, 7) + '/' + p.date.slice(8, 10), p.value);
      }
      ec = { d: [..._dedup.keys()], v: [..._dedup.values()] };
    } else {
      const hist = modeEquityHistory[id] || [];
      ec = {
        d: [...hist.map(p => p.d), todayLabel],
        v: [...hist.map(p => p.v), todayMtm]
      };
    }
    // Compute closeNow (timed out positions) first — they free slots for orders
    function bizDaysHeldSnap(sd) { if (!sd) return 0; return Math.round(Math.round((Date.now() - new Date(sd)) / 86400000) * 5 / 7); }
    const timedOutSnap = pos.filter(p => !p._terminal && Math.max(0, cfg.horizon - bizDaysHeldSnap(p.scan_date)) <= 0);
    // Compute orders for snapshot — closeNow and terminal positions free their slots
    const closeNowTickers = new Set(timedOutSnap.map(p => p.ticker));
    const activePos = pos.filter(p => !p._terminal && !closeNowTickers.has(p.ticker));
    const openTickers = new Set(activePos.map(p => p.ticker));
    const sigFiltered = sig.filter(s => !openTickers.has(s.ticker));
    const slotsAvailable = Math.max(0, cfg.portfolioSize - activePos.length);
    const buyOrders = sigFiltered.slice(0, slotsAvailable).map(s => ({ ...s, action: 'BUY' }));
    const rotCands = [];
    if (cfg.rotation !== 'none' && slotsAvailable === 0 && activePos.length > 0 && sigFiltered.length > 0) {
      const rotLimit = cfg.rotation === 'daily_max1' ? 1 : cfg.rotation === 'daily_max2' ? 2 : cfg.portfolioSize;
      const margin = cfg.rotation === 'aggressive' ? 0 : 5;
      const worst = [...activePos].sort((a, b) => a.return_pct - b.return_pct)[0];
      const worstScore = worst.score || 0;
      for (const s of sigFiltered.slice(0, 5)) {
        if (rotCands.length >= rotLimit) break;
        const meetsMargin = margin > 0 ? (s.score - worstScore >= margin) : (s.score >= 88 && worst.return_pct < 2);
        if (meetsMargin) { rotCands.push({ ...s, action: 'ROTATE', replaces: worst.ticker, scoreDelta: s.score - worstScore }); break; }
      }
    }

    // Recent rotation: if yesterday's snapshot had a ROTATE order whose ticker
    // is now a current position, surface "CLOSE X → BUY Y" info even after exec.
    let recentRotation = null;
    if (prevSnap && prevSnap.modes && prevSnap.modes[id]) {
      const prevMode = prevSnap.modes[id];
      const prevOrders = (prevMode.orders || []).filter(o => (o.action || '').toUpperCase() === 'ROTATE');
      const currentTickers = new Set(pos.map(p => p.ticker));
      const justExecuted = prevOrders.find(o => currentTickers.has(o.ticker));
      if (justExecuted) {
        recentRotation = {
          ticker: justExecuted.ticker,
          replaces: justExecuted.replaces || null,
          score: justExecuted.score || null,
          scoreDelta: justExecuted.scoreDelta || null,
          executedDate: todayISO,
          fromDate: prevSnap.date || null,
        };
      }
    }

    snapshot.modes[id] = {
      stats: { ret: mM.ret, realized: mM.realized, unrealized: mM.unrealized, dd: mM.dd, wr: mM.wr, pf: mM.pf, pfLow: mM.pfLow, pfHigh: mM.pfHigh, pfReliable: mM.pfReliable, trades: mM.trades, avgHold: mM.avgHold, oosWarn: mM.oosWarn || null, r2: mM.r2 ?? null, cagr: mM.cagr ?? null, sharpe: mM.sharpe ?? null },
      equity: ec,
      signals: sig.map(s => ({ ticker: s.ticker, score: s.score, strategy: s.strategy, entry: s._entry, stop: s._stop, tp1: s._tp1, tp2: s._tp2, rr: s.rr, thesis: s.thesis || '', sharia: s.sharia })),
      positions: pos.map(p => ({ ticker: p.ticker, scan_date: p.scan_date, entry: p.entry, current_price: p.current_price, return_pct: p.return_pct, score: p.score || 0, stop: p.stop, tp1: p.tp1, tp2: p.tp2, days_remaining: p.days_remaining, strategy: p.strategy, thesis: p.thesis || '', replacedFrom: (recentRotation && recentRotation.ticker === p.ticker) ? recentRotation.replaces : null, _terminal: p._terminal || false, _terminalStatus: p._terminalStatus || null })),
      orders: [...buyOrders, ...rotCands],
      recentRotation,
      closeNow: timedOutSnap.map(p => ({ ticker: p.ticker, scan_date: p.scan_date, entry: p.entry, current_price: p.current_price, return_pct: p.return_pct, days_held: bizDaysHeldSnap(p.scan_date), horizon: cfg.horizon })),
      expiresTomorrow: pos.filter(p => { const left = Math.max(0, cfg.horizon - bizDaysHeldSnap(p.scan_date)); return left === 1; }).map(p => ({ ticker: p.ticker, entry: p.entry, return_pct: p.return_pct, stop: p.stop, days_held: bizDaysHeldSnap(p.scan_date), horizon: cfg.horizon })),
      closedTrades: mTrades.map(t => ({ ticker: t.ticker, scanDate: t.scanDate, entryDate: t.entryDate, actualEntry: t.actualEntry, exitPrice: t.exitPrice, pnlPct: t.pnlPct, holdDays: t.holdDays, status: t.status, strategy: t.strategy })),
      config: { portfolioSize: cfg.portfolioSize, horizon: cfg.horizon, filterName: cfg.filterName, rotation: cfg.rotation, color: cfg.color, maxStopPct: cfg.maxStopPct || 0, minScore: cfg.minScore || 85, atrStopMult: cfg.atrStopMult || 0, dailyTrailPct: cfg.dailyTrailPct || 0, breakevenPct: cfg.breakevenPct || 0, partialTP: cfg.partialTP || false, trailingStop: cfg.trailingStop || false, positionSizePct: cfg.positionSizePct || 1, ddBreakerPct: cfg.ddBreakerPct || 0, sectorCapMax: cfg.sectorCapMax || 0, sizingMethod: cfg.sizingMethod || null, targetRiskPct: cfg.targetRiskPct || 0, vixKillThreshold: cfg.vixKillThreshold || 0, correlationCap: cfg.correlationCap || 0, crossModeDedup: cfg.crossModeDedup || false, label: cfg.label || id },
      risk: getRiskFor(id),
    };
  }
  // Attach the global (market-wide) regime probability once per snapshot.
  snapshot.regimeProbability = getGlobalRegimeProb();

  fs.writeFileSync(path.join(historyDir, todayKey + '.json'), JSON.stringify(snapshot));
  const existingDates = fs.readdirSync(historyDir).filter(f => /^\d{8}\.json$/.test(f)).map(f => f.replace('.json', '')).sort();
  fs.writeFileSync(path.join(historyDir, 'dates.json'), JSON.stringify(existingDates));
  console.log(`   Snapshot: history/${todayKey}.json (${existingDates.length} dates)`);
}

// ─── Backfill: regenerate all history snapshots with current configs ──────────
function backfillHistory() {
  const historyDir = path.join(ROOT, 'scanner', 'status', 'history');
  const SCANNER_DIR_BF = path.join(ROOT, 'scanner');
  let allTrades = {}, modesCfg = {}, results = {};
  try { allTrades = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'backtest-trades.json'), 'utf8')); } catch (e) { console.error(`[backfillHistory] Cannot read backtest-trades: ${e.message}`); return; }
  try { modesCfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'modes-config.json'), 'utf8')).modes; } catch (e) { console.error(`[backfillHistory] Cannot read modes-config: ${e.message}`); return; }
  try { results = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'backtest-results.json'), 'utf8')); } catch (e) { console.error(`[backfillHistory] Cannot read backtest-results: ${e.message}`); return; }

  function addBizDaysBF(dateStr, n) {
    let d = new Date(dateStr + 'T12:00:00Z');
    let added = 0;
    while (added < n) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) added++; }
    return d.toISOString().slice(0, 10);
  }
  function bizDaysBetweenBF(from, to) {
    let d = new Date(from + 'T12:00:00Z'), count = 0;
    const end = new Date(to + 'T12:00:00Z');
    while (d < end) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) count++; }
    return count;
  }

  // Parse signals for a given dateKey (YYYYMMDD) — JSON-first, HTML fallback
  const SF_BF = {
    all: () => true, no_sq: s => !/short.?squeeze/i.test(s),
    momentum_only: s => /momentum/i.test(s), breakout_only: s => /breakout/i.test(s),
    no_sq_pb: s => !/short.?squeeze|pullback/i.test(s),
    mom_bo: s => /momentum|breakout/i.test(s),
  };
  function parseScannerSignalsBF(dateKey) {
    const loaded = parser.loadSignals(dateKey);
    if (!loaded) return [];
    return loaded.signals
      .map(s => ({ ...s, thesis: loaded.thesis[s.ticker] || '' }))
      .sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  const histFiles = fs.readdirSync(historyDir).filter(f => /^\d{8}\.json$/.test(f)).sort();
  console.log(`Backfilling ${histFiles.length} history snapshots with current configs...`);

  // Build full equity curve per mode from frozen_ data (sweep's daily MtM — source of truth)
  const frozenEC = {};
  for (const id of Object.keys(modesCfg)) {
    const frozen = results[`frozen_${id}`];
    if (frozen && frozen.equityCurve && frozen.equityCurve.length) {
      // Trim flat tail
      const ec = [...frozen.equityCurve];
      while (ec.length > 1 && ec[ec.length - 1].value === ec[ec.length - 2].value) ec.pop();
      frozenEC[id] = ec; // [{date:"YYYY-MM-DD", value:X}, ...]
    }
  }

  for (const f of histFiles) {
    const dateKey = f.replace('.json', '');
    const dateISO = `${dateKey.slice(0, 4)}-${dateKey.slice(4, 6)}-${dateKey.slice(6, 8)}`;
    let existing;
    try { existing = JSON.parse(fs.readFileSync(path.join(historyDir, f), 'utf8')); } catch (e) { console.warn(`[backfillHistory] Skipping ${f}: ${e.message}`); continue; }

    // Parse scanner signals for this date
    const rawSignals = parseScannerSignalsBF(dateKey);

    const newModes = {};
    for (const [id, cfg] of Object.entries(modesCfg)) {
      const modeTrades = (allTrades[id] || []).filter(t => (t.scanDate || '') <= dateISO);
      if (!modeTrades.length) continue;

      // ── Equity curve sliced to this date from frozen_ sweep data ──
      const fullEC = frozenEC[id] || [];
      const slicedEC = fullEC.filter(pt => pt.date <= dateISO);
      const ecDates = slicedEC.map(pt => pt.date.slice(5).replace('-', '/'));
      const ecVals = slicedEC.map(pt => +pt.value.toFixed(2));
      const retAtDate = slicedEC.length ? +(slicedEC[slicedEC.length - 1].value - 100).toFixed(2) : 0;
      let peakEC = 100, maxDDEC = 0;
      for (const pt of slicedEC) {
        if (pt.value > peakEC) peakEC = pt.value;
        const dd = +((pt.value - peakEC) / peakEC * 100).toFixed(2);
        if (dd < maxDDEC) maxDDEC = dd;
      }

      // ── Trade-level stats ──
      const wins = modeTrades.filter(t => (t.pnlPct || 0) > 0).length;
      const grossW = modeTrades.filter(t => (t.pnlPct || 0) > 0).reduce((s, t) => s + (t.pnlPct || 0), 0);
      const grossL = Math.abs(modeTrades.filter(t => (t.pnlPct || 0) < 0).reduce((s, t) => s + (t.pnlPct || 0), 0));
      const wr = modeTrades.length ? +(wins / modeTrades.length * 100).toFixed(1) : 0;
      const pf = grossL > 0 ? +(grossW / grossL).toFixed(2) : 99;
      const avgHold = modeTrades.length ? +(modeTrades.reduce((s, t) => s + (t.holdDays || 0), 0) / modeTrades.length).toFixed(1) : 0;

      // ── Open positions on this date ──
      // A trade is open if: scanDate <= D AND exitDate > D
      const openTrades = modeTrades.filter(t => {
        const exitDate = addBizDaysBF(t.scanDate, t.holdDays || cfg.horizon);
        return exitDate > dateISO;
      }).slice(-cfg.portfolioSize); // max portfolioSize most recent

      const positions = openTrades.map(t => {
        const daysHeld = bizDaysBetweenBF(t.scanDate, dateISO);
        const daysRemaining = Math.max(0, cfg.horizon - daysHeld);
        return {
          ticker: t.ticker, scan_date: t.scanDate,
          entry: +(t.actualEntry || 0), current_price: +(t.actualEntry || 0), // no historical prices
          return_pct: 0, // can't compute without historical OHLC
          stop: 0, tp1: 0, tp2: null,
          days_remaining: daysRemaining, strategy: t.strategy, thesis: ''
        };
      });

      // ── Signals for this mode (filtered + topN) ──
      const filterFn = SF_BF[cfg.filterName] || (() => true);
      const filteredSignals = rawSignals
        .filter(s => filterFn(s.strategy || ''))
        .filter(s => cfg.minScore <= 0 || s.score >= cfg.minScore)
        .slice(0, cfg.topN)
        .map(s => ({ ticker: s.ticker, score: s.score, strategy: s.strategy, entry: s.entry, stop: s.stop, tp1: s.tp1, tp2: s.tp2, rr: s.rr, thesis: s.thesis || '' }));

      // ── Orders: signals not already in open positions, up to available slots ──
      const openTickers = new Set(positions.map(p => p.ticker));
      const timedOut = positions.filter(p => p.days_remaining <= 0);
      const activePos = positions.filter(p => p.days_remaining > 0);
      const slots = Math.max(0, cfg.portfolioSize - activePos.length);
      const buyOrders = filteredSignals.filter(s => !openTickers.has(s.ticker)).slice(0, slots).map(s => ({ ...s, action: 'BUY' }));
      const rotCands = [];
      if (cfg.rotation === 'aggressive' && slots === 0 && activePos.length > 0 && filteredSignals.length > 0) {
        const worst = [...activePos].sort((a, b) => a.return_pct - b.return_pct)[0];
        for (const s of filteredSignals.filter(x => !openTickers.has(x.ticker)).slice(0, 5)) {
          if (s.score >= 88) { rotCands.push({ ...s, action: 'ROTATE', replaces: worst.ticker }); break; }
        }
      }

      const existing_mode = (existing.modes || {})[id] || {};
      newModes[id] = {
        ...existing_mode,
        stats: { ret: retAtDate, realized: retAtDate, unrealized: 0, dd: maxDDEC, wr, pf, trades: modeTrades.length, avgHold, r2: null, cagr: null, sharpe: null },
        equity: { d: ecDates, v: ecVals },
        positions,
        orders: [...buyOrders, ...rotCands],
        closeNow: timedOut.map(p => ({ ticker: p.ticker, scan_date: p.scan_date, entry: p.entry, current_price: p.current_price, return_pct: p.return_pct, days_held: bizDaysBetweenBF(p.scan_date, dateISO), horizon: cfg.horizon })),
        expiresTomorrow: activePos.filter(p => p.days_remaining === 1).map(p => ({ ticker: p.ticker, entry: p.entry, return_pct: p.return_pct, stop: p.stop, days_held: bizDaysBetweenBF(p.scan_date, dateISO), horizon: cfg.horizon })),
        signals: filteredSignals,
        closedTrades: modeTrades.map(t => ({ ticker: t.ticker, scanDate: t.scanDate, entryDate: t.entryDate, actualEntry: t.actualEntry, exitPrice: t.exitPrice, pnlPct: t.pnlPct, holdDays: t.holdDays, status: t.status, strategy: t.strategy })),
        config: { portfolioSize: cfg.portfolioSize, horizon: cfg.horizon, filterName: cfg.filterName, rotation: cfg.rotation, color: cfg.color, maxStopPct: cfg.maxStopPct || 0, minScore: cfg.minScore || 85, atrStopMult: cfg.atrStopMult || 0, dailyTrailPct: cfg.dailyTrailPct || 0, breakevenPct: cfg.breakevenPct || 0, partialTP: cfg.partialTP || false, trailingStop: cfg.trailingStop || false, positionSizePct: cfg.positionSizePct || 1 },
      };
    }

    const updated = { ...existing, modes: { ...existing.modes, ...newModes } };
    fs.writeFileSync(path.join(historyDir, f), JSON.stringify(updated));
    process.stdout.write(`  ${dateKey} `);
  }
  console.log(`\n✅ Backfill complete — ${histFiles.length} snapshots updated`);
}

if (process.argv.includes('--backfill')) {
  backfillHistory();
} else {
  main();
}
