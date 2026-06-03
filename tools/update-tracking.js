#!/usr/bin/env node
'use strict';

const fs = require('fs');
const https = require('https');
const path = require('path');
const parser = require('./lib/scanner-parser');
const sharedCfg = require('./config');

const ROOT = path.join(__dirname, '..');
const METRICS_FILE = path.join(ROOT, 'data', 'scanner-metrics.json');
const POSITIONS_FILE = path.join(ROOT, 'data', 'scanner-positions.json');
const BACKTEST_TRADES = path.join(ROOT, 'data', 'backtest-trades.json');
const SCANNER_DIR = path.join(ROOT, 'scanner');

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// Fetch daily OHLC bars for a ticker — returns { history: {dateStr: {open,high,low,close}}, lastPrice }
// Range covers up to ~60 trading days back (enough for 35d window in main).
function fetchOHLC(ticker) {
  return new Promise((resolve) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=60d`;
    const opts = { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 };
    https.get(url, opts, (res) => {
      if (res.statusCode === 429 || res.statusCode >= 500) {
        console.warn(`  ⚠ ${ticker}: Yahoo HTTP ${res.statusCode} — skipped`);
        res.resume();
        return resolve({ history: {}, lastPrice: null, error: `http_${res.statusCode}` });
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (j?.chart?.error) {
            console.warn(`  ⚠ ${ticker}: Yahoo API error ${j.chart.error.code || ''} — skipped`);
            return resolve({ history: {}, lastPrice: null, error: 'api_error' });
          }
          const result = j?.chart?.result?.[0];
          if (!result) return resolve({ history: {}, lastPrice: null });
          const ts = result.timestamp || [];
          const q = result.indicators?.quote?.[0] || {};
          const history = {};
          for (let i = 0; i < ts.length; i++) {
            if (q.open?.[i] != null && q.high?.[i] != null && q.low?.[i] != null && q.close?.[i] != null) {
              const dateStr = new Date(ts[i] * 1000).toISOString().slice(0, 10);
              history[dateStr] = { open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i] };
            }
          }
          const lastPrice = result.meta?.regularMarketPrice ?? null;
          resolve({ history, lastPrice });
        } catch { resolve({ history: {}, lastPrice: null }); }
      });
    }).on('error', () => resolve({ history: {}, lastPrice: null })).on('timeout', () => resolve({ history: {}, lastPrice: null }));
  });
}

function parseMidpoint(entryStr) {
  if (!entryStr) return null;
  const nums = String(entryStr).replace(/[$,]/g, '').match(/[\d.]+/g);
  if (!nums) return null;
  const vals = nums.map(Number);
  return vals.length >= 2 ? (vals[0] + vals[1]) / 2 : vals[0];
}

function parseNumber(s) {
  if (s == null) return null;
  const n = parseFloat(String(s).replace(/[$,]/g, ''));
  return isNaN(n) ? null : n;
}

// ─── Extract ALL signals from scan (JSON-first, HTML fallback) ──────────────
// Returns up to 10 signals, sorted by score desc. Was top-3-only — now full slate
// so feedback loop covers the entire published universe (P1 audit fix).

function extractAllFromDir(dir) {
  const loaded = parser.loadSignals(dir);
  if (!loaded || !loaded.signals.length) return [];

  return loaded.signals
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 10)
    .map(s => ({
      ticker: s.ticker,
      score: s.score || 85,
      strategy: s.strategy,
      entry: s.entry,
      stop: s.stop,
      tp1: s.tp1,
      tp2: s.tp2,
      horizon_days: 20,
    }));
}

// ─── Yahoo ticker mapping ─────────────────────────────────────────────────────

// Yahoo override map — only list tickers that actually need remapping
// (e.g. European listings that Yahoo serves under a suffixed symbol).
// If a ticker is not in the map it's used as-is.
const YAHOO_MAP = {
  // (empty for now — all local tickers resolve directly on Yahoo)
};
function yahooTicker(t) {
  return YAHOO_MAP[t] || t;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const today = new Date().toISOString().slice(0, 10);

  // Get all scan dirs (YYYYMMDD, not retrospective)
  const scanDirs = fs.readdirSync(SCANNER_DIR)
    .filter(d => /^\d{8}(-\d+)?$/.test(d))
    .filter(d => {
      const dateStr = d.slice(0, 8);
      const scanDate = new Date(dateStr.slice(0, 4) + '-' + dateStr.slice(4, 6) + '-' + dateStr.slice(6, 8));
      const cutoff = new Date(today);
      cutoff.setDate(cutoff.getDate() - 35);
      return scanDate >= cutoff;
    })
    .sort();

  console.log(`Found ${scanDirs.length} scan dirs:`, scanDirs);

  // Build all trades from HTMLs
  const allTrades = [];
  for (const dir of scanDirs) {
    const dateStr = dir.slice(0, 8);
    const scanDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;

    const setups = extractAllFromDir(dir);
    if (setups.length === 0) {
      console.log(`  [${dir}] No trades extracted`);
      continue;
    }
    console.log(`  [${dir}] Extracted ${setups.length}:`, setups.map(t => t.ticker).join(', '));

    for (let i = 0; i < setups.length; i++) {
      const t = setups[i];
      const expireDate = addBusinessDays(scanDate, t.horizon_days || 20);
      allTrades.push({
        id: `${dir}-${t.ticker}-${i + 1}`,
        scan_date: scanDate,
        scan: dir,
        rank: i + 1,
        ticker: t.ticker,
        ticker_yahoo: yahooTicker(t.ticker),
        strategy: t.strategy || 'Momentum',
        chart_url: `https://finviz.com/chart.ashx?t=${t.ticker}&ty=c&ta=1&p=d&s=l`,
        entry: t.entry,
        stop: t.stop,
        tp1: t.tp1,
        tp2: t.tp2,
        horizon_days: t.horizon_days || 20,
        expire_date: expireDate,
        status: 'open',
        current_price: null,
        exit_price: null,
        exit_date: null,
        pnl_pct: null,
      });
    }
  }

  console.log(`\nTotal trades: ${allTrades.length}`);

  // Fetch OHLC bars for every traded ticker (batched by unique symbol)
  const tickers = [...new Set(allTrades.map(t => t.ticker_yahoo))];
  console.log(`\nFetching OHLC for: ${tickers.join(', ')}`);
  const ohlcData = {};
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  for (const tkr of tickers) {
    ohlcData[tkr] = await fetchOHLC(tkr);
    const bars = Object.keys(ohlcData[tkr].history).length;
    console.log(`  ${tkr}: last=${ohlcData[tkr].lastPrice}, ${bars} bars`);
    await sleep(150); // Throttle — Yahoo rate-limits at ~15 rps
  }

  // Determine status for each trade — walk OHLC bars day by day.
  // First touch wins: low <= stop → SL, high >= tp2 → TP2, high >= tp1 → TP1.
  // No more close-only cheat (P0 audit fix).
  for (const trade of allTrades) {
    const ticker = trade.ticker_yahoo;
    const data = ohlcData[ticker];
    const lastPrice = data?.lastPrice ?? null;
    trade.current_price = lastPrice;

    if (!trade.entry || !trade.stop || !trade.tp1) continue;
    if (!data || !Object.keys(data.history).length) continue;

    // Sorted list of bar dates within trade window (scan_date → min(today, expire))
    const cutoff = today < trade.expire_date ? today : trade.expire_date;
    const dates = Object.keys(data.history)
      .filter(d => d >= trade.scan_date && d <= cutoff)
      .sort();

    let exitFound = false;
    for (const d of dates) {
      const bar = data.history[d];
      // Flag ambiguous bars — same bar hit SL AND a TP level (first-touch picks SL = conservative)
      const hitSL = bar.low <= trade.stop;
      const hitTP = (trade.tp2 && bar.high >= trade.tp2) || bar.high >= trade.tp1;
      if (hitSL && hitTP) trade.ambiguous = true;
      // Stop touched (intraday low)
      if (bar.low <= trade.stop) {
        trade.status = 'sl';
        trade.exit_price = trade.stop;
        trade.exit_date = d;
        trade.pnl_pct = +((trade.stop - trade.entry) / trade.entry * 100).toFixed(2);
        exitFound = true;
        break;
      }
      // TP2 touched (intraday high)
      if (trade.tp2 && bar.high >= trade.tp2) {
        trade.status = 'tp2';
        trade.exit_price = trade.tp2;
        trade.exit_date = d;
        trade.pnl_pct = +((trade.tp2 - trade.entry) / trade.entry * 100).toFixed(2);
        exitFound = true;
        break;
      }
      // TP1 touched (intraday high)
      if (bar.high >= trade.tp1) {
        trade.status = 'tp1';
        trade.exit_price = trade.tp1;
        trade.exit_date = d;
        trade.pnl_pct = +((trade.tp1 - trade.entry) / trade.entry * 100).toFixed(2);
        exitFound = true;
        break;
      }
    }

    if (exitFound) continue;

    // No exit hit during window — either expired or still open
    const expired = today >= trade.expire_date;
    if (expired && lastPrice != null) {
      trade.status = 'expired';
      trade.exit_price = lastPrice;
      trade.exit_date = today;
      trade.pnl_pct = +((lastPrice - trade.entry) / trade.entry * 100).toFixed(2);
    } else if (lastPrice != null) {
      trade.status = 'open';
      trade.pnl_pct = +((lastPrice - trade.entry) / trade.entry * 100).toFixed(2);
    }
  }

  // ── Metrics ──
  const closed = allTrades.filter(t => ['tp1', 'tp2', 'sl', 'expired'].includes(t.status));
  const open = allTrades.filter(t => t.status === 'open');
  const tp1c = allTrades.filter(t => t.status === 'tp1').length;
  const tp2c = allTrades.filter(t => t.status === 'tp2').length;
  const slc = allTrades.filter(t => t.status === 'sl').length;
  const expc = allTrades.filter(t => t.status === 'expired').length;
  const wins = closed.filter(t => ['tp1', 'tp2'].includes(t.status));
  const losses = closed.filter(t => ['sl', 'expired'].includes(t.status) && t.pnl_pct < 0);

  const FRACTION = 1 / 30;
  const cutoff30 = new Date(today); cutoff30.setDate(cutoff30.getDate() - 30);
  const closed30 = closed.filter(t => t.exit_date && new Date(t.exit_date) >= cutoff30);
  // return_30d = weighted portfolio return: each trade contributes pnl_pct * (1/30)
  // But pnl_pct is already in % (e.g. 8.5 means +8.5%), so portfolio return in % = sum(pnl_pct * 1/30)
  // return_30d = closed P&L + open MtM (positions ouvertes comptent au prix actuel)
  const open30 = open.filter(t => t.scan_date && new Date(t.scan_date) >= cutoff30);
  const return30d = +(
    closed30.reduce((s, t) => s + (t.pnl_pct || 0) / 30, 0) +
    open30.reduce((s, t) => s + (t.pnl_pct || 0) / 30, 0)
  ).toFixed(2);

  // return_30d_closed_only = pour référence (stats partielles)
  const return30d_closed = +closed30.reduce((s, t) => s + (t.pnl_pct || 0) / 30, 0).toFixed(2);

  // Max drawdown — sur tous trades (closed + open MtM), triés par date d'entrée
  const allSorted = [...allTrades]
    .filter(t => t.scan_date && t.pnl_pct != null)
    .sort((a, b) => a.scan_date.localeCompare(b.scan_date));
  let running = 0, peak = 0, maxDD = 0;
  for (const t of allSorted) {
    running += (t.pnl_pct || 0) * FRACTION;
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDD) maxDD = dd;
  }

  // Capital allocation
  const entered = open.filter(t => t.current_price && t.entry && t.current_price >= t.entry * 0.98);
  const pending = open.filter(t => t.current_price && t.entry && t.current_price < t.entry * 0.98);
  const workingCapitalPct = +Math.min(100, +(entered.length * FRACTION * 100).toFixed(1));
  const pendingOrdersPct = +Math.min(100 - workingCapitalPct, +(pending.length * FRACTION * 100).toFixed(1));
  const availableCashPct = +Math.max(0, 100 - workingCapitalPct - pendingOrdersPct).toFixed(1);

  // ── Return total depuis D0 (all trades, not just 30d) ──
  const returnTotal = +(allSorted.reduce((s, t) => s + (t.pnl_pct || 0) * FRACTION, 0)).toFixed(2);

  // ── Profit Factor ──
  const grossWins = closed.filter(t => t.pnl_pct > 0).reduce((s, t) => s + t.pnl_pct, 0);
  const grossLosses = Math.abs(closed.filter(t => t.pnl_pct < 0).reduce((s, t) => s + t.pnl_pct, 0));
  const profitFactor = grossLosses > 0 ? +(grossWins / grossLosses).toFixed(1) : (grossWins > 0 ? 99 : 0);

  // ── Total days and scans count ──
  const scanDates = [...new Set(allTrades.map(t => t.scan_date).filter(Boolean))].sort();
  const scansCount = scanDates.length;
  const firstScan = scanDates[0] || '2026-02-15';
  const totalDays = Math.round((new Date(today) - new Date(firstScan)) / 86400000);

  // ── Return / DD ratio ──
  const returnDDRatio = maxDD > 0 ? +(returnTotal / maxDD).toFixed(1) : (returnTotal > 0 ? 99 : 0);

  // ── Portfolio history (cumulative return curve) ──
  const portfolioHistory = [0];
  const drawdownHistory = [0];
  let cumReturn = 0, cumPeak = 0;
  for (const t of allSorted) {
    cumReturn += (t.pnl_pct || 0) * FRACTION;
    if (cumReturn > cumPeak) cumPeak = cumReturn;
    const dd = cumPeak - cumReturn;
    portfolioHistory.push(+cumReturn.toFixed(2));
    drawdownHistory.push(+(-dd).toFixed(2));
  }

  // ── Per-rank metrics (top3 vs top10 honesty) ──
  const top3Trades = allTrades.filter(t => t.rank <= 3);
  const top3Closed = top3Trades.filter(t => ['tp1','tp2','sl','expired'].includes(t.status));
  const top3Wins = top3Closed.filter(t => ['tp1','tp2'].includes(t.status));
  const winRateTop3 = top3Closed.length ? +((top3Wins.length / top3Closed.length) * 100).toFixed(1) : 0;
  const winRateTop10 = closed.length ? +((wins.length / closed.length) * 100).toFixed(1) : 0;

  // ── Realized vs unrealized split (P0 audit fix) ──
  // return_realized: closed P&L only (the figure a regulator reads)
  // return_unrealized: MtM of currently-open positions
  // return_total = realized + unrealized (kept for backward-compat)
  const returnRealized = +allSorted
    .filter(t => ['tp1','tp2','sl','expired'].includes(t.status))
    .reduce((s, t) => s + (t.pnl_pct || 0) * FRACTION, 0).toFixed(2);
  const returnUnrealized = +allSorted
    .filter(t => t.status === 'open')
    .reduce((s, t) => s + (t.pnl_pct || 0) * FRACTION, 0).toFixed(2);

  const metrics = {
    updated_at: new Date().toISOString(),
    trades_total: allTrades.length,
    trades_closed: closed.length,
    trades_open: open.length,
    resolved_pct: allTrades.length ? +((closed.length / allTrades.length) * 100).toFixed(1) : 0,
    win_rate: closed.length ? +((wins.length / closed.length) * 100).toFixed(1) : 0,
    win_rate_top3: winRateTop3,
    win_rate_top10: winRateTop10,
    top3_closed_count: top3Closed.length,
    return_realized: returnRealized,
    return_unrealized: returnUnrealized,
    tp1_count: tp1c,
    tp2_count: tp2c,
    sl_count: slc,
    expired_count: expc,
    return_30d: return30d,
    return_30d_closed_only: return30d_closed,
    return_total: returnTotal,
    max_drawdown: +(-maxDD).toFixed(2),
    profit_factor: profitFactor,
    avg_win_pct: wins.length ? +(wins.reduce((s, t) => s + (t.pnl_pct || 0), 0) / wins.length).toFixed(2) : 0,
    avg_loss_pct: losses.length ? +(losses.reduce((s, t) => s + (t.pnl_pct || 0), 0) / losses.length).toFixed(2) : 0,
    working_capital_pct: workingCapitalPct,
    pending_orders_pct: pendingOrdersPct,
    available_cash_pct: availableCashPct,
    total_days: totalDays,
    scans_count: scansCount,
    return_dd_ratio: returnDDRatio,
    portfolio_history: portfolioHistory,
    drawdown_history: drawdownHistory,
  };

  // ── Positions ──
  // Close legacy trades with missing levels (e.g. old forbidden-strategy entries) at current price
  for (const t of open) {
    if ((!t.stop || !t.tp1) && t.current_price && t.entry) {
      t.status = 'expired';
      t.exit_price = t.current_price;
      t.exit_date = today;
      t.pnl_pct = +((t.current_price - t.entry) / t.entry * 100).toFixed(2);
    }
  }
  const stillOpen = allTrades.filter(t => t.status === 'open');

  // Dedupe by ticker — keep the most recent scan_date per ticker (avoid duplicate exposure)
  const seenTickers = new Set();
  const dedupOpen = [];
  for (const t of [...stillOpen].sort((a, b) => b.scan_date.localeCompare(a.scan_date))) {
    if (seenTickers.has(t.ticker)) continue;
    seenTickers.add(t.ticker);
    dedupOpen.push(t);
  }

  const positions = dedupOpen
    .filter(t => t.current_price && t.entry)
    .map(t => {
      const ret = +((t.current_price - t.entry) / t.entry * 100).toFixed(2);
      const daysLeft = Math.max(0, Math.ceil((new Date(t.expire_date) - new Date(today)) / 86400000));
      const toTP1 = t.tp1 ? +((t.tp1 - t.current_price) / t.current_price * 100).toFixed(1) : null;
      const toSL = t.stop ? +((t.current_price - t.stop) / t.current_price * 100).toFixed(1) : null;
      let signal, status_label;
      if (ret >= 5) { signal = 'green'; status_label = '🟢 En route TP1'; }
      else if (ret >= 2) { signal = 'green'; status_label = '🟢 Positif'; }
      else if (toTP1 && toTP1 < 3) { signal = 'green'; status_label = '🎯 TP1 proche'; }
      else if (toSL && toSL < 3) { signal = 'red'; status_label = '🔴 Vers SL'; }
      else if (ret < -2) { signal = 'red'; status_label = '🔴 Sous eau'; }
      else { signal = 'yellow'; status_label = '🟡 Neutre'; }
      return {
        id: t.id, ticker: t.ticker, scan_date: t.scan_date,
        entry: t.entry, current_price: t.current_price,
        return_pct: ret, stop: t.stop, tp1: t.tp1, tp2: t.tp2,
        days_remaining: daysLeft, expire_date: t.expire_date,
        strategy: t.strategy,
        chart_url: t.chart_url, signal, status_label,
        to_tp1_pct: toTP1, to_sl_pct: toSL,
        progress_pct: t.tp1 && t.stop ? +Math.min(100, Math.max(0, (t.current_price - t.stop) / (t.tp1 - t.stop) * 100)).toFixed(0) : 0,
      };
    })
    .sort((a, b) => b.return_pct - a.return_pct);

  // ── Cross-reference with backtest-trades.json: keep only positions open in ≥1 mode ──
  let activePositions = positions;
  if (fs.existsSync(BACKTEST_TRADES)) {
    try {
      const bt = JSON.parse(fs.readFileSync(BACKTEST_TRADES, 'utf8'));
      const modes = Object.keys(bt).filter(k => Array.isArray(bt[k]));
      const openInModes = new Set();
      for (const m of modes) {
        for (const t of bt[m]) {
          if (!t.exitDate || t.status === 'pending') openInModes.add(t.ticker);
        }
      }
      const before = activePositions.length;
      activePositions = activePositions.filter(p => openInModes.has(p.ticker));
      const pruned = before - activePositions.length;
      if (pruned > 0) console.log(`\n🧹 Pruned ${pruned} orphan positions (not open in any mode)`);
    } catch (e) { console.warn('⚠️ Could not cross-reference backtest-trades:', e.message); }
  }

  fs.writeFileSync(METRICS_FILE, JSON.stringify(metrics, null, 2));
  fs.writeFileSync(POSITIONS_FILE, JSON.stringify({ updated_at: metrics.updated_at, open_positions: activePositions }, null, 2));

  console.log('\n✅ scanner-metrics.json:', metrics);
  console.log(`✅ scanner-positions.json: ${activePositions.length} open positions`);
}

main().catch(console.error);
