/**
 * Rolling Scanner — continuous universe scan job
 *
 * Cycles through a universe in batches, evaluates a DSL filter on each batch,
 * fires alerts (via alert-engine) for matches, and loops indefinitely until
 * stopped. The user controls it via job-manager (start/stop/pause/resume/schedule).
 *
 * Each scanner instance is a job registered in job-manager with id 'scan:{id}'.
 *
 * Progress state (visible in job_list):
 *   { universe, filter, totalSymbols, batch, batches, cycleNum,
 *     alertsFired, lastMatchSymbols, symbolsPerSec, cycleTimeMs }
 */

import * as jobManager from './job-manager.js';
import * as universe   from './universe.js';
import * as yahoo      from './yahoo.js';
import * as binance    from './binance.js';
import * as alertEngine from './alert-engine.js';
import { getEnrichment } from './tick-enricher.js';
import { compileDSL } from './screener.js';

// Active scanner state (keyed by job id)
const _state = new Map();

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * Create and register a rolling scanner.
 *
 * @param {object} opts
 *   id            {string}   unique scanner id (e.g. 'momentum', 'breakout')
 *   name          {string}   human label
 *   universe      {string}   universe key OR comma-sep symbols
 *   filter        {string}   DSL expression (same syntax as screener)
 *   alert_channels {string[]} channels to notify on match (default: config channels)
 *   batch_size    {number}   symbols per batch (default: 50)
 *   batch_delay   {number}   ms between batches (default: 2000)
 *   cycle_delay   {number}   ms between full cycles (default: 60000)
 *   once_per_cycle {boolean} alert max once per symbol per cycle (default: true)
 *   schedule      {object}   optional schedule (defers start until scheduled time)
 */
export function createScanner(opts) {
  const { fn, ok, error } = compileDSL(opts.filter || 'price > 0');
  if (!ok) throw new Error(`Invalid DSL filter: ${error}`);

  const scanId  = `scan:${opts.id || Date.now()}`;
  const batchSz = opts.batch_size   ?? 50;
  const batchMs = opts.batch_delay  ?? 2000;
  const cycleMs = opts.cycle_delay  ?? 60_000;

  // Per-cycle match tracking (reset each cycle)
  _state.set(scanId, {
    universe:        opts.universe || 'us_large',
    filter:          opts.filter   || 'price > 0',
    channels:        opts.alert_channels ?? null,
    batchSize:       batchSz,
    batchDelayMs:    batchMs,
    cycleDelayMs:    cycleMs,
    oncePer:         opts.once_per_cycle ?? true,
    _dslFn:          fn,
    _symbols:        [],
    _seenThisCycle:  new Set(),
    _batchIdx:       0,
    _cycleNum:       0,
    _alertsFired:    0,
    _lastMatches:    [],
    _cycleStart:     null,
    _stop:           false,
    _paused:         false,
  });

  const job = jobManager.register(scanId, {
    name:        opts.name || `Scan: ${opts.universe}`,
    description: `filter: ${opts.filter || 'price > 0'}`,
    type:        'scanner',
    schedule:    opts.schedule ?? null,
    autoStart:   !opts.schedule,
    fn:          (job) => _runCycle(scanId, job),
    stopFn:      () => { const s = _state.get(scanId); if (s) s._stop = true; },
    pauseFn:     () => { const s = _state.get(scanId); if (s) s._paused = true; },
    resumeFn:    () => { const s = _state.get(scanId); if (s) s._paused = false; },
  });

  return { jobId: scanId, job: jobManager.get(scanId) };
}

export function listScanners() {
  return jobManager.list().filter(j => j.id.startsWith('scan:'));
}

export function removeScanner(id) {
  _state.delete(id);
  return jobManager.remove(id);
}

// ─── Cycle executor ───────────────────────────────────────────────────────────

async function _runCycle(scanId, job) {
  const st = _state.get(scanId);
  if (!st) return;

  st._stop   = false;
  st._paused = false;

  // Load / refresh universe
  if (st.universe.includes(',')) {
    st._symbols = st.universe.split(',').map(s => s.trim().toUpperCase());
  } else {
    st._symbols = await universe.get(st.universe);
  }

  const symbols = st._symbols;
  if (!symbols.length) return { cycleNum: st._cycleNum, error: 'empty universe' };

  st._cycleNum++;
  st._cycleStart   = Date.now();
  st._batchIdx     = 0;
  st._seenThisCycle.clear();
  st._lastMatches  = [];

  const batches    = Math.ceil(symbols.length / st.batchSize);
  const isCrypto   = s => /^[A-Z0-9]+(USDT|BUSD|USDC|BTC|ETH|BNB)$/i.test(s);

  for (let b = 0; b < batches; b++) {
    if (st._stop) break;

    // Pause support: busy-wait 200ms intervals
    while (st._paused) {
      await _sleep(200);
      if (st._stop) break;
    }
    if (st._stop) break;

    st._batchIdx = b + 1;
    const batch  = symbols.slice(b * st.batchSize, (b + 1) * st.batchSize);

    // Update progress on job
    job.progress = {
      universe:        st.universe,
      filter:          st.filter,
      totalSymbols:    symbols.length,
      batch:           st._batchIdx,
      batches,
      cycleNum:        st._cycleNum,
      alertsFired:     st._alertsFired,
      lastMatches:     st._lastMatches.slice(-5),
      symbolsPerSec:   _symbolsPerSec(st, symbols.length, b, batches),
      cyclePct:        +(b / batches * 100).toFixed(1),
    };

    // Split by source
    const cryptoSyms = batch.filter(s => isCrypto(s));
    const equitySyms = batch.filter(s => !isCrypto(s));
    const quotes     = [];

    // Crypto: Binance batch
    if (cryptoSyms.length) {
      try {
        const tickers = await binance.getMultiTicker(cryptoSyms);
        for (const t of tickers) {
          quotes.push(_normBinance(t));
        }
      } catch { /* skip batch on error */ }
    }

    // Equities: Yahoo batch
    if (equitySyms.length) {
      try {
        const raw = await yahoo.getQuotes(equitySyms);
        for (const q of raw) {
          if (q.price > 0) quotes.push(_normYahoo(q));
        }
      } catch { /* skip batch on error */ }
    }

    // Evaluate DSL
    for (const q of quotes) {
      if (st._stop) break;
      if (st.oncePer && st._seenThisCycle.has(q.symbol)) continue;

      // Merge pattern enrichment
      const enrichment = getEnrichment(q.symbol);
      const enriched   = { ...q, ...enrichment };

      let match = false;
      try { match = st._dslFn(enriched); } catch { continue; }
      if (!match) continue;

      st._seenThisCycle.add(q.symbol);
      st._alertsFired++;
      st._lastMatches.push(q.symbol);

      // Fire alert
      await _notify(scanId, st, q, enriched);
    }

    // Rate-limit between batches
    if (b < batches - 1 && st.batchDelayMs > 0) {
      await _sleep(st.batchDelayMs);
    }
  }

  const cycleTimeMs = Date.now() - st._cycleStart;

  job.progress = {
    universe:     st.universe,
    filter:       st.filter,
    totalSymbols: symbols.length,
    batch:        batches,
    batches,
    cycleNum:     st._cycleNum,
    alertsFired:  st._alertsFired,
    lastMatches:  st._lastMatches.slice(-10),
    cycleTimeMs,
    symbolsPerSec: +(symbols.length / (cycleTimeMs / 1000)).toFixed(1),
    cyclePct:     100,
  };

  // Pause between cycles (job-manager will call _runCycle again via schedule)
  return { cycleNum: st._cycleNum, scanned: symbols.length, cycleTimeMs, alertsFired: st._alertsFired };
}

// ─── Alert notification ───────────────────────────────────────────────────────

async function _notify(scanId, st, q, enriched) {
  const scannerName = jobManager.get(scanId)?.name ?? scanId;
  const chg = q.changePct >= 0 ? `+${q.changePct.toFixed(2)}%` : `${q.changePct.toFixed(2)}%`;
  const patternsStr = enriched.patterns?.length ? ` [${enriched.patterns.join(', ')}]` : '';
  const msg = `📡 ${q.symbol} @ $${q.price} (${chg})${patternsStr} — ${scannerName} | ${st.filter}`;

  const event = {
    alertId:    scanId,
    name:       scannerName,
    ticker:     q.symbol,
    when:       st.filter,
    channels:   st.channels ?? [],
    message:    msg,
    price:      q.price,
    changePct:  q.changePct,
    rvol:       q.rvol,
    drawdown:   null,
    triggeredAt: new Date().toISOString(),
    // Extra scanner context
    patterns:      enriched.patterns ?? [],
    breakoutScore: enriched.breakoutScore ?? null,
    reversalScore: enriched.reversalScore ?? null,
  };

  // Re-use alert-engine notification channels
  if (st.channels?.length) {
    await alertEngine.tick(new Map([[q.symbol, q]]), new Map());
  }

  console.error(`[Scanner] Match: ${msg}`);
}

// ─── Normalisers ──────────────────────────────────────────────────────────────

function _normYahoo(q) {
  const price  = q.price ?? 0;
  const avgvol = q.avgVolume || 1;
  return {
    symbol:   q.symbol,
    price,
    open:     q.open      ?? null,
    high:     q.high      ?? null,
    low:      q.low       ?? null,
    changePct:q.changePct ?? 0,
    volume:   q.volume    ?? 0,
    rvol:     q.volume && avgvol ? +(q.volume / avgvol).toFixed(2) : null,
    ema50:    q.fiftyDayAvg      ?? null,
    ema200:   q.twoHundredDayAvg ?? null,
    high52w:  q.fiftyTwoWeekHigh ?? null,
    low52w:   q.fiftyTwoWeekLow  ?? null,
    pctFromHigh: q.fiftyTwoWeekHigh ? +((price - q.fiftyTwoWeekHigh) / q.fiftyTwoWeekHigh * 100).toFixed(2) : null,
    rsi14:    null,
    exchange: 'EQUITY',
  };
}

function _normBinance(t) {
  return {
    symbol:    t.symbol,
    price:     t.price  ?? 0,
    open:      t.open   ?? null,
    high:      t.high   ?? null,
    low:       t.low    ?? null,
    changePct: t.changePct ?? 0,
    volume:    t.quoteVolume ?? 0,
    rvol:      null,
    ema50:     t.price,
    ema200:    t.price,
    high52w:   t.high   ?? null,
    low52w:    t.low    ?? null,
    pctFromHigh: null,
    rsi14:     null,
    exchange: 'BINANCE',
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _symbolsPerSec(st, total, batchDone, batches) {
  if (!st._cycleStart || batchDone === 0) return 0;
  const elapsed = (Date.now() - st._cycleStart) / 1000;
  return elapsed > 0 ? +(batchDone * st.batchSize / elapsed).toFixed(1) : 0;
}

function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
