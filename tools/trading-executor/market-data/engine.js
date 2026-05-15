'use strict';

// Market Data Engine — unified, source-agnostic, hardened.
//
// Features:
//  - Transparent multi-source: Yahoo WS (tick streaming) + Webull (RT snapshot)
//    + T212 (bars + RT price) + Yahoo REST (historical)
//  - Subscribe to any timeframe: tick, 1m, 5m, 15m, 1h, 4h, 1d
//  - Fetch historical bars
//  - Data hardening: staleness rejection, sanity validation, circuit breakers
//  - Tick-to-bar aggregation (builds bars from streaming ticks)
//
// Usage:
//   const { MarketDataEngine } = require('./market-data/engine');
//   const md = new MarketDataEngine({ verbose: true });
//   await md.start(['AAPL', 'MSFT', 'TSLA']);
//   md.subscribe('1m', (bar) => console.log(bar));
//   const bars = await md.fetch('AAPL', '1d', 50);
//   const quote = md.getQuote('AAPL'); // latest validated tick
//   await md.stop();

const EventEmitter = require('events');
const { Tick, Bar, TIMEFRAMES, MAX_AGE, SANITY } = require('./types');
const YahooWSSource = require('./sources/yahoo-ws');
const WebullSource = require('./sources/webull');
const T212Source = require('./sources/t212');
const YahooRESTSource = require('./sources/yahoo-rest');

// How often to flush aggregated bars (ms)
const AGGREGATION_INTERVAL = 1000;

// Circuit breaker: source fails N times consecutively → disable for cooldown
const CB_THRESHOLD = 5;
const CB_COOLDOWN = 60_000;

class MarketDataEngine extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.verbose = opts.verbose || false;
    this._symbols = [];
    this._running = false;

    // Sources (T212 disabled — CF blocks from non-datacenter IPs, enable on ser)
    this._yahooWS = new YahooWSSource({ verbose: this.verbose });
    this._webull = new WebullSource({ verbose: this.verbose });
    this._t212 = process.env.ENABLE_T212 ? new T212Source({ verbose: this.verbose }) : null;
    this._yahooREST = new YahooRESTSource({ verbose: this.verbose });

    // State per symbol
    this._lastTick = new Map();    // symbol → Tick (latest validated)
    this._prevTick = new Map();    // symbol → Tick (previous, for jump detection)
    this._barBuilders = new Map(); // `${symbol}:${tf}` → BarBuilder
    this._vwapState = new Map(); // symbol → { cumPV, cumVol, vwap, sessionDate }
    this._vwapDriftCheck = null;

    // Subscriptions: timeframe → Set<callback>
    this._subs = new Map();

    // Circuit breakers per source
    this._cb = new Map(); // source.name → { failures, disabledUntil }

    // Stats
    this._stats = { ticksReceived: 0, ticksRejected: 0, barsEmitted: 0, fetchCount: 0 };

    // Aggregation timer
    this._aggTimer = null;
  }

  // ── Public API ──

  async start(symbols) {
    if (this._running) return;
    this._symbols = symbols;
    this._running = true;

    // Init Yahoo WS (async protobuf load)
    try {
      await this._yahooWS.init();
      this._yahooWS.subscribe(symbols, (tick) => this._onTick(tick));
    } catch (e) {
      this._log(`yahoo-ws init failed, continuing without streaming: ${e.message}`);
      this._disableSource('yahoo-ws');
    }

    // Prime cache: fetch latest price for each symbol (don't block on all)
    this._primeCache(symbols);

    // Start bar aggregation loop
    this._aggTimer = setInterval(() => this._flushBars(), AGGREGATION_INTERVAL);
    this._vwapDriftCheck = setInterval(() => this._checkVWAPDrift(), 60_000);

    const srcs = ['yahoo-ws', 'webull', this._t212 ? 't212' : null, 'yahoo-rest'].filter(Boolean);
    this._log(`started (${symbols.length} symbols, sources: ${srcs.join(', ')})`);
  }

  async stop() {
    this._running = false;
    if (this._aggTimer) { clearInterval(this._aggTimer); this._aggTimer = null; }
    if (this._vwapDriftCheck) { clearInterval(this._vwapDriftCheck); this._vwapDriftCheck = null; }
    this._yahooWS.destroy();
    this._webull.destroy();
    if (this._t212) this._t212.destroy();
    this._yahooREST.destroy();
    this._log('stopped');
  }

  // Subscribe to bar updates at a given timeframe. Returns unsubscribe fn.
  subscribe(timeframe, callback) {
    if (!this._subs.has(timeframe)) this._subs.set(timeframe, new Set());
    this._subs.get(timeframe).add(callback);

    // Ensure bar builders exist for all symbols at this timeframe
    if (timeframe !== 'tick') {
      for (const symbol of this._symbols) {
        const key = `${symbol}:${timeframe}`;
        if (!this._barBuilders.has(key)) {
          this._barBuilders.set(key, new BarBuilder(symbol, timeframe));
        }
      }
    }

    return () => {
      const set = this._subs.get(timeframe);
      if (set) set.delete(callback);
    };
  }

  // Get latest validated quote for symbol. Returns null if stale/unavailable.
  getQuote(symbol) {
    const tick = this._lastTick.get(symbol);
    if (!tick) return null;
    if (tick.isStale) {
      this._log(`getQuote(${symbol}): stale tick (${tick.age}ms old), rejecting`);
      return null;
    }
    return tick;
  }

  // Get latest price (number) or null. Convenience wrapper.
  getPrice(symbol) {
    const tick = this.getQuote(symbol);
    return tick ? tick.price : null;
  }

  // Fetch historical bars. Source priority: T212 (RT bars) → Yahoo REST (fallback).
  async fetch(symbol, timeframe, count = 100) {
    this._stats.fetchCount++;

    // Try T212 first (real-time bars, no 15min delay) — only if enabled
    if (this._t212 && !this._isDisabled('t212')) {
      try {
        const bars = await this._t212.getBars(symbol, timeframe, count);
        if (bars && bars.length > 0) {
          const validated = this._validateBars(bars);
          if (validated.length > 0) return validated;
        }
      } catch (e) {
        this._recordFailure('t212');
      }
    }

    // Fallback: Yahoo REST (may be 15min delayed for intraday)
    if (!this._isDisabled('yahoo-rest')) {
      try {
        const bars = await this._yahooREST.getBars(symbol, timeframe, count);
        if (bars && bars.length > 0) {
          const validated = this._validateBars(bars);
          if (validated.length > 0) return validated;
        }
      } catch (e) {
        this._recordFailure('yahoo-rest');
      }
    }

    this._log(`fetch(${symbol}, ${timeframe}): all sources failed`);
    return [];
  }

  // Force-refresh quote for a symbol (poll sources if WS hasn't delivered)
  async refreshQuote(symbol) {
    // Try Webull first (truly RT)
    if (!this._isDisabled('webull')) {
      try {
        const tick = await this._webull.getQuote(symbol);
        if (tick) {
          this._ingestTick(tick);
          return tick;
        }
      } catch (_) { this._recordFailure('webull'); }
    }

    // Try T212 deviation (only if enabled)
    if (this._t212 && !this._isDisabled('t212')) {
      try {
        const tick = await this._t212.getQuote(symbol);
        if (tick) {
          this._ingestTick(tick);
          return tick;
        }
      } catch (_) { this._recordFailure('t212'); }
    }

    return this._lastTick.get(symbol) || null;
  }

  get stats() {
    const vwapCoverage = [...this._vwapState.values()].filter(s => s.cumVol > 0).length;
    return { ...this._stats, symbols: this._symbols.length, vwapCoverage, sources: this._sourceStatus() };
  }

  // ── Internal: VWAP ──

  _updateVWAP(tick) {
    const sessionDate = this._getSessionDate(tick.ts);
    let state = this._vwapState.get(tick.symbol);
    if (!state || state.sessionDate !== sessionDate) {
      state = { cumPV: 0, cumVol: 0, vwap: 0, sessionDate };
      this._vwapState.set(tick.symbol, state);
    }
    const vol = tick.volume || 0;
    if (vol > 0) {
      state.cumPV += tick.price * vol;
      state.cumVol += vol;
      state.vwap = state.cumPV / state.cumVol;
    }
  }

  _getSessionDate(ts) {
    const d = new Date(ts);
    const etStr = d.toLocaleString('en-US', { timeZone: 'America/New_York' });
    const et = new Date(etStr);
    if (et.getHours() < 4) et.setDate(et.getDate() - 1);
    return et.toISOString().slice(0, 10);
  }

  async _checkVWAPDrift() {
    if (!this._running) return;
    for (const symbol of this._symbols) {
      const vwapState = this._vwapState.get(symbol);
      if (!vwapState || vwapState.cumVol === 0) continue;
      try {
        const wbTick = await this._webull.getQuote(symbol).catch(() => null);
        if (!wbTick || !wbTick.dayVolume || wbTick.dayVolume === 0) continue;
        const drift = Math.abs(vwapState.cumVol - wbTick.dayVolume) / wbTick.dayVolume;
        if (drift > 0.3) {
          this._log(`VWAP drift ${symbol}: cumVol=${vwapState.cumVol} vs dayVol=${wbTick.dayVolume} (${(drift*100).toFixed(1)}%)`);
          vwapState.cumVol = wbTick.dayVolume;
          vwapState._driftDetected = true;
        }
      } catch (_) {}
    }
  }

  // ── Internal: Tick Processing ──

  _onTick(tick) {
    this._stats.ticksReceived++;
    this._ingestTick(tick);
  }

  _ingestTick(tick) {
    const prev = this._lastTick.get(tick.symbol);
    const validation = tick.validate(prev);

    if (!validation.valid) {
      this._stats.ticksRejected++;
      if (this.verbose) this._log(`REJECTED ${tick.symbol} from ${tick.source}: ${validation.reason}`);
      this.emit('rejected', { tick, reason: validation.reason });
      return;
    }

    // Update state
    if (prev) this._prevTick.set(tick.symbol, prev);
    this._lastTick.set(tick.symbol, tick);
    this._updateVWAP(tick);

    // Emit to tick subscribers
    const tickSubs = this._subs.get('tick');
    if (tickSubs) for (const cb of tickSubs) cb(tick);

    // Feed bar builders
    for (const [key, builder] of this._barBuilders) {
      if (key.startsWith(tick.symbol + ':')) {
        builder.addTick(tick);
      }
    }

    this.emit('tick', tick);
  }

  getVWAP(symbol) {
    const state = this._vwapState.get(symbol);
    if (!state || state.cumVol === 0) return null;
    return {
      vwap: state.vwap,
      cumVol: state.cumVol,
      sessionDate: state.sessionDate,
      confidence: state.cumVol > 10000 ? 'high' : 'low',
    };
  }

  // ── Internal: Bar Aggregation ──

  _flushBars() {
    const now = Date.now();
    for (const [key, builder] of this._barBuilders) {
      const bar = builder.tryClose(now);
      if (bar) {
        const validation = bar.validate();
        if (validation.valid) {
          this._stats.barsEmitted++;
          const subs = this._subs.get(bar.timeframe);
          if (subs) for (const cb of subs) cb(bar);
          this.emit('bar', bar);
        } else if (this.verbose) {
          this._log(`bar rejected ${key}: ${validation.reason}`);
        }
      }
    }
  }

  _validateBars(bars) {
    return bars.filter(bar => {
      const v = bar.validate();
      if (!v.valid && this.verbose) this._log(`historical bar rejected: ${v.reason}`);
      return v.valid;
    });
  }

  // ── Internal: Cache Priming ──

  async _primeCache(symbols) {
    // Parallel fetch first quote for each symbol via Webull (fastest RT source for snapshots)
    const batchSize = 5;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      await Promise.all(batch.map(async (symbol) => {
        if (this._lastTick.has(symbol)) return; // already have from WS

        // Try Webull → T212 → skip (WS will deliver eventually)
        let tick = null;
        if (!this._isDisabled('webull')) {
          tick = await this._webull.getQuote(symbol).catch(() => null);
        }
        if (!tick && this._t212 && !this._isDisabled('t212')) {
          tick = await this._t212.getQuote(symbol).catch(() => null);
        }
        if (tick) this._ingestTick(tick);
      }));
    }
  }

  // ── Internal: Circuit Breaker ──

  _recordFailure(sourceName) {
    if (!this._cb.has(sourceName)) this._cb.set(sourceName, { failures: 0, disabledUntil: 0 });
    const cb = this._cb.get(sourceName);
    cb.failures++;
    if (cb.failures >= CB_THRESHOLD) {
      cb.disabledUntil = Date.now() + CB_COOLDOWN;
      this._log(`circuit breaker OPEN for ${sourceName} (${cb.failures} failures, cooldown ${CB_COOLDOWN / 1000}s)`);
    }
  }

  _disableSource(sourceName) {
    this._cb.set(sourceName, { failures: CB_THRESHOLD, disabledUntil: Date.now() + CB_COOLDOWN * 5 });
  }

  _isDisabled(sourceName) {
    const cb = this._cb.get(sourceName);
    if (!cb) return false;
    if (cb.disabledUntil > Date.now()) return true;
    // Cooldown expired → half-open: reset failures
    if (cb.failures >= CB_THRESHOLD) {
      cb.failures = Math.floor(CB_THRESHOLD / 2);
      this._log(`circuit breaker HALF-OPEN for ${sourceName}`);
    }
    return false;
  }

  _sourceStatus() {
    const status = {};
    const sourceNames = ['yahoo-ws', 'webull', this._t212 ? 't212' : null, 'yahoo-rest'].filter(Boolean);
    for (const name of sourceNames) {
      const cb = this._cb.get(name);
      if (!cb || cb.failures < CB_THRESHOLD) status[name] = 'ok';
      else if (cb.disabledUntil > Date.now()) status[name] = 'disabled';
      else status[name] = 'half-open';
    }
    if (this._yahooWS.isConnected) status['yahoo-ws'] = 'streaming';
    return status;
  }

  _log(msg) {
    if (this.verbose) console.log(`[market-data] ${msg}`);
  }
}

// ── BarBuilder: aggregates ticks into bars at a given timeframe ──

class BarBuilder {
  constructor(symbol, timeframe) {
    this.symbol = symbol;
    this.timeframe = timeframe;
    this._durationMs = this._parseDuration(timeframe);
    this._currentBar = null;
    this._barOpenTs = 0;
  }

  addTick(tick) {
    const barStart = this._alignTs(tick.ts);

    if (!this._currentBar || barStart !== this._barOpenTs) {
      // New bar period — close previous (handled by tryClose), start fresh
      this._barOpenTs = barStart;
      this._currentBar = {
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        volume: tick.volume || 0,
        tickCount: 1,
      };
    } else {
      this._currentBar.high = Math.max(this._currentBar.high, tick.price);
      this._currentBar.low = Math.min(this._currentBar.low, tick.price);
      this._currentBar.close = tick.price;
      this._currentBar.volume += (tick.volume || 0);
      this._currentBar.tickCount++;
    }
  }

  tryClose(now) {
    if (!this._currentBar) return null;
    const barEnd = this._barOpenTs + this._durationMs;

    // Bar period has elapsed → emit completed bar
    if (now >= barEnd) {
      const bar = new Bar({
        symbol: this.symbol,
        timeframe: this.timeframe,
        open: this._currentBar.open,
        high: this._currentBar.high,
        low: this._currentBar.low,
        close: this._currentBar.close,
        volume: this._currentBar.volume,
        ts: this._barOpenTs,
        tsEnd: barEnd,
        source: 'aggregated',
      });
      this._currentBar = null;
      this._barOpenTs = 0;
      return bar;
    }
    return null;
  }

  // Align timestamp to bar boundary (e.g., 1m → floor to minute)
  _alignTs(ts) {
    return Math.floor(ts / this._durationMs) * this._durationMs;
  }

  _parseDuration(tf) {
    const map = { '1m': 60e3, '5m': 300e3, '15m': 900e3, '30m': 1800e3, '1h': 3600e3, '4h': 14400e3, '1d': 86400e3, '1w': 604800e3 };
    return map[tf] || 60e3;
  }
}

module.exports = { MarketDataEngine, BarBuilder };
