#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const TRADES_PATH = path.join(ROOT, 'data', 'backtest-trades.json');
const MODES_PATH = path.join(ROOT, 'data', 'modes-config.json');
const CACHE_DIR = path.join(ROOT, 'data', '.replay-cache');
fs.mkdirSync(CACHE_DIR, { recursive: true });

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');
const scanDateArg = (args.find(a => a.startsWith('--scan-date=')) || '').split('=')[1];
const modeArg = (args.find(a => a.startsWith('--mode=')) || '').split('=')[1];
const ALL = args.includes('--all');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function toET(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
}

// ─── Yahoo Finance 1-min bars (file-cached, 24h TTL) ────────────────────────────

function fetchYahooMinute(ticker, dateStr) {
  const cacheFile = path.join(CACHE_DIR, `${ticker}_${dateStr}_1m.json`);
  if (fs.existsSync(cacheFile)) {
    const stat = fs.statSync(cacheFile);
    if (Date.now() - stat.mtimeMs < 24 * 3600 * 1000) {
      try { return Promise.resolve(JSON.parse(fs.readFileSync(cacheFile, 'utf8'))); } catch { /* fall through */ }
    }
  }

  const marketOpen = new Date(dateStr + 'T09:25:00-04:00');
  const marketClose = new Date(dateStr + 'T16:05:00-04:00');
  const period1 = Math.floor(marketOpen.getTime() / 1000);
  const period2 = Math.floor(marketClose.getTime() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1m&period1=${period1}&period2=${period2}&includePrePost=false`;

  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' },
      timeout: 15000,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          const result = j?.chart?.result?.[0];
          if (!result) return resolve(null);
          const timestamps = result.timestamp || [];
          const q = result.indicators?.quote?.[0] || {};
          const bars = [];
          for (let i = 0; i < timestamps.length; i++) {
            if (q.open?.[i] != null && q.high?.[i] != null && q.low?.[i] != null && q.close?.[i] != null) {
              bars.push({
                time: new Date(timestamps[i] * 1000).toISOString(),
                ts: timestamps[i],
                open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i],
                volume: q.volume?.[i] || 0,
              });
            }
          }
          if (bars.length > 0) fs.writeFileSync(cacheFile, JSON.stringify(bars));
          resolve(bars.length > 0 ? bars : null);
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// ─── VWAP from minute bars ──────────────────────────────────────────────────────

function calcVWAP(bars) {
  let cumPV = 0, cumV = 0;
  for (const b of bars) {
    const typical = (b.high + b.low + b.close) / 3;
    cumPV += typical * b.volume;
    cumV += b.volume;
  }
  return cumV > 0 ? cumPV / cumV : null;
}

// ─── Entry replay per mode ──────────────────────────────────────────────────────

function replayEntry(bars, signal, modeId, config) {
  if (!bars || bars.length < 10) return null;

  const sessionStart = bars[0].ts;
  const barsM = bars.map(b => ({ ...b, mfo: Math.round((b.ts - sessionStart) / 60) }));
  const marketOpen = bars[0].open;

  // VWAP gate: calculate from first 30 minutes of session
  let vwap = null;
  if (config.vwapGate) {
    const first30 = barsM.filter(b => b.mfo < 30);
    if (first30.length >= 5) {
      vwap = calcVWAP(first30);
      if (vwap && marketOpen > vwap * 1.01) {
        return { skipped: true, reason: 'vwap_gap_up', vwap, marketOpen };
      }
    }
  }

  const entryRef = signal.entry;

  switch (modeId) {
    case 'turbo': {
      // How-to step 2: watch first 5-min candle, buy ONLY if close > entry, no chase >3%
      const first5 = barsM.filter(b => b.mfo < 5);
      if (!first5.length) return null;
      const c5close = first5[first5.length - 1].close;

      if (marketOpen > entryRef * 1.03)
        return { skipped: true, reason: 'gap_up_3pct', marketOpen, entryRef };
      if (c5close <= entryRef)
        return { skipped: true, reason: 'no_5min_confirm', c5close, entryRef };

      // VWAP gate step: wait 30 min, enter at min(price, VWAP)
      if (config.vwapGate && vwap) {
        const bar30 = barsM.find(b => b.mfo >= 30);
        if (!bar30) return null;
        const ep = Math.min(bar30.close, vwap);
        return { entryPrice: ep, entryTime: bar30.time, vwap, confirmed: true, confirmType: '5min+vwap30' };
      }
      return { entryPrice: c5close, entryTime: first5[first5.length - 1].time, vwap, confirmed: true, confirmType: '5min_candle' };
    }

    case 'dynamic': {
      // How-to step 2: watch first 15 min, wait for 5-min candle close > entry
      if (marketOpen > entryRef * 1.03)
        return { skipped: true, reason: 'gap_up_3pct', marketOpen, entryRef };

      const first15 = barsM.filter(b => b.mfo < 15);
      const candles5m = [];
      for (let start = 0; start < 15; start += 5) {
        const grp = first15.filter(b => b.mfo >= start && b.mfo < start + 5);
        if (!grp.length) continue;
        candles5m.push({
          close: grp[grp.length - 1].close,
          high: Math.max(...grp.map(b => b.high)),
          volume: grp.reduce((s, b) => s + b.volume, 0),
          time: grp[grp.length - 1].time,
        });
      }
      const confirm = candles5m.find(c => c.close > entryRef);
      if (!confirm)
        return { skipped: true, reason: 'no_15min_confirm', candles: candles5m.map(c => +c.close.toFixed(2)), entryRef };

      if (config.vwapGate && vwap) {
        const bar30 = barsM.find(b => b.mfo >= 30);
        if (!bar30) return null;
        const ep = Math.min(bar30.close, vwap);
        return { entryPrice: ep, entryTime: bar30.time, vwap, confirmed: true, confirmType: '15min+vwap30' };
      }
      return { entryPrice: confirm.close, entryTime: confirm.time, vwap, confirmed: true, confirmType: '15min_candle' };
    }

    default: {
      // balanced, secured, fortress, tkl: limit buy at signal.entry before open
      for (const bar of barsM) {
        if (bar.low <= entryRef) {
          const fp = Math.min(bar.open, entryRef);
          return { entryPrice: fp, entryTime: bar.time, vwap, confirmed: true, confirmType: 'limit_fill' };
        }
      }
      // VWAP fallback: if price never reaches limit but VWAP gate is on
      if (config.vwapGate && vwap) {
        const bar30 = barsM.find(b => b.mfo >= 30);
        if (bar30) {
          const ep = Math.min(bar30.close, vwap);
          return { entryPrice: ep, entryTime: bar30.time, vwap, confirmed: true, confirmType: 'vwap_fill' };
        }
      }
      return { skipped: true, reason: 'limit_not_reached', entryRef };
    }
  }
}

// ─── Exit replay (minute by minute across all days) ─────────────────────────────

function replayExit(allBars, entryResult, trade, config) {
  const { entryPrice, entryTime } = entryResult;
  if (!entryPrice || !entryTime) return null;

  let riskPerUnit = entryPrice - (trade.actualStop || entryPrice * 0.95);
  if (riskPerUnit <= 0) riskPerUnit = entryPrice * 0.05;

  const origRisk = (trade.actualEntry || entryPrice) - (trade.actualStop || entryPrice * 0.95);
  const rm1 = origRisk > 0 && trade.actualTp1 ? ((trade.actualTp1 - trade.actualEntry) / origRisk) : 1.5;
  const rm2 = origRisk > 0 && trade.actualTp2 ? ((trade.actualTp2 - trade.actualEntry) / origRisk) : rm1 * 1.5;

  const stop0 = entryPrice - riskPerUnit;
  const tp1 = entryPrice + riskPerUnit * rm1;
  const tp2 = trade.actualTp2 ? entryPrice + riskPerUnit * rm2 : null;

  let stop = stop0;
  let partialRealized = 0;
  let hwm = entryPrice;
  let beActivated = false;
  let dayCount = 0;
  let daysSinceNewHigh = 0;

  const sortedDates = [...allBars.keys()].sort();
  const entryDateStr = entryTime.slice(0, 10);
  const si = sortedDates.indexOf(entryDateStr);
  if (si < 0) return null;

  for (let di = si; di < sortedDates.length; di++) {
    const dateStr = sortedDates[di];
    const bars = allBars.get(dateStr) || [];
    if (!bars.length) continue;
    dayCount++;

    const startIdx = dateStr === entryDateStr ? bars.findIndex(b => b.time >= entryTime) : 0;
    let dailyHigh = entryPrice;

    for (let i = Math.max(0, startIdx); i < bars.length; i++) {
      const bar = bars[i];

      if (bar.low <= stop) {
        let status;
        if (partialRealized > 0) status = 'trail';
        else if (stop >= entryPrice) status = 'breakeven';
        else status = 'sl';
        return { exitPrice: +stop.toFixed(4), exitTime: bar.time, status, tp1, tp2, stop };
      }

      if (tp2 && bar.high >= tp2) {
        return { exitPrice: +tp2.toFixed(4), exitTime: bar.time, status: 'tp2', tp1, tp2, stop };
      }

      if (bar.high >= tp1 && partialRealized === 0) {
        if (config.partialTP) {
          const frac = (config.partialTPPct || 0.5) * 100;
          partialRealized = ((tp1 - entryPrice) / entryPrice) * frac;
          stop = entryPrice;
          beActivated = true;
        } else {
          return { exitPrice: +tp1.toFixed(4), exitTime: bar.time, status: 'tp1', tp1, tp2, stop };
        }
      }

      if (bar.high > hwm) { hwm = bar.high; daysSinceNewHigh = 0; }
      if (bar.high > dailyHigh) dailyHigh = bar.high;

      if (config.breakevenPct > 0 && !beActivated) {
        const gain = (bar.high - entryPrice) / entryPrice * 100;
        if (gain >= config.breakevenPct) {
          beActivated = true;
          if (entryPrice > stop) stop = entryPrice;
        }
      }
    }

    const lastBar = bars[bars.length - 1];

    if (config.dailyTrailPct > 0 && lastBar) {
      const trail = hwm * (1 - config.dailyTrailPct / 100);
      if (trail > stop) stop = trail;
    }

    if (dailyHigh <= hwm) daysSinceNewHigh++;

    if (config.staleDays > 0 && daysSinceNewHigh >= config.staleDays) {
      const tighten = (daysSinceNewHigh - config.staleDays + 1) * 0.002 * entryPrice;
      const raised = stop + tighten;
      if (lastBar && raised < lastBar.close) stop = raised;
    }

    if (dayCount >= (config.horizon || 2) && lastBar) {
      return { exitPrice: +lastBar.close.toFixed(4), exitTime: lastBar.time, status: 'expired', tp1, tp2, stop };
    }
  }

  const lastDate = sortedDates[sortedDates.length - 1];
  const lastBars = allBars.get(lastDate) || [];
  const lb = lastBars[lastBars.length - 1];
  return {
    exitPrice: lb ? +lb.close.toFixed(4) : trade.exitPrice,
    exitTime: lb ? lb.time : null,
    status: 'pending', tp1, tp2, stop,
  };
}

// ─── Collect trading dates between two dates ────────────────────────────────────

function tradingDatesBetween(start, end) {
  const dates = [];
  const d = new Date(start);
  const e = new Date(end);
  while (d <= e) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔬 Replay trades with 1-min OHLCV bars\n');

  const trades = JSON.parse(fs.readFileSync(TRADES_PATH, 'utf8'));
  const modesConfig = JSON.parse(fs.readFileSync(MODES_PATH, 'utf8')).modes;

  // Determine target scan date(s)
  let targetDates;
  if (ALL) {
    const allDates = new Set();
    for (const modeId of Object.keys(trades)) {
      if (!Array.isArray(trades[modeId])) continue;
      for (const t of trades[modeId]) if (t.scanDate) allDates.add(t.scanDate);
    }
    targetDates = [...allDates].sort();
  } else {
    let td = scanDateArg;
    if (!td) {
      const allDates = new Set();
      for (const modeId of Object.keys(trades)) {
        if (!Array.isArray(trades[modeId])) continue;
        for (const t of trades[modeId]) {
          if (t.scanDate && t.exitDate) allDates.add(t.scanDate);
        }
      }
      td = [...allDates].sort().pop();
    }
    targetDates = td ? [td] : [];
  }

  console.log(`  Target date(s): ${targetDates.join(', ')}`);

  // Load signals for each target date
  const signalsByDate = {};
  for (const td of targetDates) {
    const sp = path.join(ROOT, 'scanner', td.replace(/-/g, ''), 'signals.json');
    if (fs.existsSync(sp)) {
      const sData = JSON.parse(fs.readFileSync(sp, 'utf8'));
      const map = {};
      for (const s of (sData.signals || [])) map[s.ticker] = s;
      for (const s of (sData.tkl_pool || [])) map[s.ticker] = s;
      signalsByDate[td] = map;
    }
  }

  // Collect trades to replay
  const replayTargets = [];
  for (const modeId of Object.keys(trades)) {
    if (!Array.isArray(trades[modeId])) continue;
    if (modeArg && modeId !== modeArg) continue;
    for (let i = 0; i < trades[modeId].length; i++) {
      const t = trades[modeId][i];
      if (!targetDates.includes(t.scanDate)) continue;
      if (t.entryTime && !ALL) continue;
      replayTargets.push({ modeId, idx: i, trade: t });
    }
  }

  const modeSet = new Set(replayTargets.map(r => r.modeId));
  console.log(`  Found ${replayTargets.length} trades across ${modeSet.size} modes (${[...modeSet].join(', ')})\n`);

  if (replayTargets.length === 0) {
    console.log('  Nothing to replay.');
    return [];
  }

  // Fetch 1-min bars for all needed ticker-dates
  const tickerDates = new Set();
  for (const { trade } of replayTargets) {
    const entry = trade.entryDate || trade.scanDate;
    const exit = trade.exitDate || entry;
    const dates = tradingDatesBetween(entry, exit);
    for (const d of dates) tickerDates.add(`${trade.ticker}:${d}`);
  }

  console.log(`  Fetching 1-min bars for ${tickerDates.size} ticker-dates...`);
  const minuteData = new Map();
  const queue = [...tickerDates];
  for (let i = 0; i < queue.length; i += 3) {
    const batch = queue.slice(i, i + 3);
    const results = await Promise.all(batch.map(async (key) => {
      const [ticker, date] = key.split(':');
      const bars = await fetchYahooMinute(ticker, date);
      if (bars) minuteData.set(key, bars);
      return { key, ok: !!bars, count: bars ? bars.length : 0 };
    }));
    for (const r of results) {
      if (VERBOSE) console.log(`    ${r.key}: ${r.count} bars`);
      else if (!r.ok) console.log(`    ⚠ ${r.key}: no data`);
    }
    if (i + 3 < queue.length) await sleep(350);
  }
  console.log(`  Got data for ${minuteData.size}/${tickerDates.size} ticker-dates\n`);

  // Replay each trade
  const allResults = [];
  for (const { modeId, idx, trade } of replayTargets) {
    const config = modesConfig[modeId] || {};
    const signals = signalsByDate[trade.scanDate] || {};
    const signal = signals[trade.ticker] || {
      entry: trade.actualEntry, stop: trade.actualStop, tp1: trade.actualTp1,
    };

    const entryDate = trade.entryDate || trade.scanDate;
    const entryBars = minuteData.get(`${trade.ticker}:${entryDate}`);

    if (!entryBars) {
      if (VERBOSE) console.log(`  [${modeId}] ${trade.ticker} ${entryDate}: no minute data — keeping daily-bar`);
      allResults.push({ modeId, idx, status: 'no_data', ticker: trade.ticker });
      continue;
    }

    const entryResult = replayEntry(entryBars, signal, modeId, config);
    if (!entryResult) {
      allResults.push({ modeId, idx, status: 'entry_failed', ticker: trade.ticker });
      continue;
    }

    if (entryResult.skipped) {
      console.log(`  [${modeId}] ${trade.ticker} ${entryDate}: ❌ NO FILL — ${entryResult.reason}` +
        (entryResult.vwap ? ` (VWAP=${entryResult.vwap.toFixed(2)}, open=${entryResult.marketOpen?.toFixed(2)})` : ''));
      trades[modeId][idx].replayStatus = 'no_fill';
      trades[modeId][idx].replayReason = entryResult.reason;
      trades[modeId][idx].replayVwap = entryResult.vwap ? +entryResult.vwap.toFixed(4) : null;
      allResults.push({ modeId, idx, status: 'no_fill', ticker: trade.ticker, reason: entryResult.reason });
      continue;
    }

    // Collect all minute bars for trade duration
    const exitDate = trade.exitDate || entryDate;
    const allBarsMap = new Map();
    for (const d of tradingDatesBetween(entryDate, exitDate)) {
      const bars = minuteData.get(`${trade.ticker}:${d}`);
      if (bars) allBarsMap.set(d, bars);
    }

    const exitResult = replayExit(allBarsMap, entryResult, trade, config);
    if (!exitResult) {
      allResults.push({ modeId, idx, status: 'exit_failed', ticker: trade.ticker });
      continue;
    }

    const rPnl = exitResult.exitPrice && entryResult.entryPrice
      ? ((exitResult.exitPrice - entryResult.entryPrice) / entryResult.entryPrice * 100)
      : null;

    trades[modeId][idx].entryTime = entryResult.entryTime;
    trades[modeId][idx].exitTime = exitResult.exitTime;
    trades[modeId][idx].replayEntry = +entryResult.entryPrice.toFixed(4);
    trades[modeId][idx].replayExit = +exitResult.exitPrice.toFixed(4);
    trades[modeId][idx].replayPnlPct = rPnl !== null ? +rPnl.toFixed(2) : null;
    trades[modeId][idx].replayStatus = exitResult.status;
    trades[modeId][idx].replayVwap = entryResult.vwap ? +entryResult.vwap.toFixed(4) : null;
    trades[modeId][idx].replayConfirm = entryResult.confirmType || null;

    const origPnl = trade.pnlPct || 0;
    const delta = rPnl !== null ? +(rPnl - origPnl).toFixed(2) : 0;
    const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '=';
    console.log(`  [${modeId}] ${trade.ticker}: ` +
      `entry $${trade.actualEntry?.toFixed(2)} → $${entryResult.entryPrice.toFixed(2)} @ ${toET(entryResult.entryTime)} ET | ` +
      `exit $${trade.exitPrice?.toFixed(2)} → $${exitResult.exitPrice.toFixed(2)} @ ${toET(exitResult.exitTime)} ET | ` +
      `P&L ${origPnl}% → ${rPnl?.toFixed(2)}% (${arrow}${Math.abs(delta)}%) [${exitResult.status}]`);

    allResults.push({
      modeId, idx, status: 'replayed', ticker: trade.ticker,
      origEntry: trade.actualEntry, replayEntry: +entryResult.entryPrice.toFixed(4),
      entryTime: entryResult.entryTime,
      origExit: trade.exitPrice, replayExit: +exitResult.exitPrice.toFixed(4),
      exitTime: exitResult.exitTime,
      origPnl, replayPnl: rPnl !== null ? +rPnl.toFixed(2) : null,
      origStatus: trade.status, replayStatus: exitResult.status,
      vwap: entryResult.vwap,
    });
  }

  // ─── Summary ────────────────────────────────────────────────────────────────
  console.log('\n═══ Replay Summary ═══');
  const replayed = allResults.filter(r => r.status === 'replayed');
  const noFill = allResults.filter(r => r.status === 'no_fill');
  const noData = allResults.filter(r => ['no_data', 'entry_failed', 'exit_failed'].includes(r.status));

  console.log(`  Replayed: ${replayed.length} | No fill: ${noFill.length} | No data: ${noData.length}`);

  if (replayed.length > 0) {
    const totalDelta = replayed.reduce((s, r) => s + ((r.replayPnl || 0) - (r.origPnl || 0)), 0);
    const avgDelta = totalDelta / replayed.length;
    console.log(`  Avg P&L delta: ${avgDelta >= 0 ? '+' : ''}${avgDelta.toFixed(2)}% per trade`);
    console.log(`  Total P&L impact: ${totalDelta >= 0 ? '+' : ''}${totalDelta.toFixed(2)}%`);
  }

  if (noFill.length > 0) {
    console.log(`\n  ⚠ Trades that WOULD NOT have filled per how-to-trade rules:`);
    for (const r of noFill) {
      console.log(`    ${r.modeId}/${r.ticker}: ${r.reason}`);
    }
  }

  // Per-mode breakdown
  console.log('\n  Per-mode:');
  for (const modeId of [...modeSet].sort()) {
    const mr = allResults.filter(r => r.modeId === modeId);
    const ok = mr.filter(r => r.status === 'replayed');
    const nf = mr.filter(r => r.status === 'no_fill');
    const pnlDelta = ok.reduce((s, r) => s + ((r.replayPnl || 0) - (r.origPnl || 0)), 0);
    console.log(`    ${modeId}: ${ok.length} replayed, ${nf.length} no-fill, Δ P&L ${pnlDelta >= 0 ? '+' : ''}${pnlDelta.toFixed(2)}%`);
  }

  if (DRY_RUN) {
    console.log('\n  [DRY RUN] Not writing backtest-trades.json');
  } else {
    fs.writeFileSync(TRADES_PATH, JSON.stringify(trades, null, 2));
    console.log(`\n  ✅ Wrote ${TRADES_PATH}`);
  }

  return allResults;
}

module.exports = { main, replayEntry, replayExit, calcVWAP, fetchYahooMinute };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
