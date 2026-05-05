'use strict';

// Universal market data types — source-agnostic format.

const TIMEFRAMES = Object.freeze({
  TICK: 'tick',
  M1: '1m',
  M5: '5m',
  M15: '15m',
  M30: '30m',
  H1: '1h',
  H4: '4h',
  D1: '1d',
  W1: '1w',
});

// Staleness thresholds per timeframe (ms). Data older than this is considered expired.
const MAX_AGE = Object.freeze({
  tick: 10_000,     // 10s — tick must be fresh
  '1m': 90_000,    // 90s
  '5m': 6 * 60_000,
  '15m': 18 * 60_000,
  '30m': 35 * 60_000,
  '1h': 65 * 60_000,
  '4h': 4.5 * 3600_000,
  '1d': 25 * 3600_000,
  '1w': 8 * 86400_000,
});

// Price sanity bounds — reject data outside these
const SANITY = Object.freeze({
  MIN_PRICE: 0.0001,
  MAX_PRICE: 999_999,
  MAX_SPREAD_PCT: 10, // bid/ask spread > 10% = suspicious
  MAX_CHANGE_PCT: 50, // single tick > 50% move = likely bad data
  MIN_VOLUME: 0,
  MAX_VOLUME: 50_000_000_000,
});

class Tick {
  constructor({ symbol, price, bid, ask, volume, dayHigh, dayLow, dayVolume, ts, source }) {
    this.symbol = symbol;
    this.price = price;
    this.bid = bid || null;
    this.ask = ask || null;
    this.volume = volume || 0;   // last trade size
    this.dayHigh = dayHigh || null;
    this.dayLow = dayLow || null;
    this.dayVolume = dayVolume || 0;
    this.ts = ts || Date.now();
    this.source = source || 'unknown';
  }

  get age() { return Date.now() - this.ts; }
  get isStale() { return this.age > MAX_AGE.tick; }
  get midPrice() { return (this.bid && this.ask) ? (this.bid + this.ask) / 2 : this.price; }

  get spreadPct() {
    if (!this.bid || !this.ask || this.bid <= 0) return 0;
    return ((this.ask - this.bid) / this.bid) * 100;
  }

  validate(prevTick) {
    if (!this.price || this.price < SANITY.MIN_PRICE || this.price > SANITY.MAX_PRICE) {
      return { valid: false, reason: `price_out_of_range: ${this.price}` };
    }
    if (this.bid && this.ask && this.bid > this.ask) {
      return { valid: false, reason: `crossed_market: bid=${this.bid} > ask=${this.ask}` };
    }
    if (this.spreadPct > SANITY.MAX_SPREAD_PCT) {
      return { valid: false, reason: `spread_too_wide: ${this.spreadPct.toFixed(1)}%` };
    }
    if (prevTick && prevTick.price > 0) {
      const changePct = Math.abs((this.price - prevTick.price) / prevTick.price) * 100;
      if (changePct > SANITY.MAX_CHANGE_PCT) {
        return { valid: false, reason: `jump_too_large: ${changePct.toFixed(1)}% from ${prevTick.price}` };
      }
    }
    if (this.dayVolume < SANITY.MIN_VOLUME || this.dayVolume > SANITY.MAX_VOLUME) {
      return { valid: false, reason: `volume_suspicious: ${this.dayVolume}` };
    }
    return { valid: true };
  }
}

class Bar {
  constructor({ symbol, timeframe, open, high, low, close, volume, ts, tsEnd, source }) {
    this.symbol = symbol;
    this.timeframe = timeframe;
    this.open = open;
    this.high = high;
    this.low = low;
    this.close = close;
    this.volume = volume || 0;
    this.ts = ts;          // bar open timestamp (ms)
    this.tsEnd = tsEnd || null; // bar close timestamp (ms)
    this.source = source || 'unknown';
  }

  get age() { return Date.now() - (this.tsEnd || this.ts); }
  get isStale() { return this.age > (MAX_AGE[this.timeframe] || MAX_AGE['1d']); }

  validate() {
    if (!this.open || !this.high || !this.low || !this.close) {
      return { valid: false, reason: 'missing_ohlc_field' };
    }
    if (this.high < this.low) {
      return { valid: false, reason: `high < low: ${this.high} < ${this.low}` };
    }
    if (this.open < this.low || this.open > this.high) {
      return { valid: false, reason: `open outside H/L: O=${this.open} H=${this.high} L=${this.low}` };
    }
    if (this.close < this.low || this.close > this.high) {
      return { valid: false, reason: `close outside H/L: C=${this.close} H=${this.high} L=${this.low}` };
    }
    if (this.close < SANITY.MIN_PRICE || this.close > SANITY.MAX_PRICE) {
      return { valid: false, reason: `price_out_of_range: ${this.close}` };
    }
    if (this.volume < 0) {
      return { valid: false, reason: `negative_volume: ${this.volume}` };
    }
    return { valid: true };
  }
}

module.exports = { TIMEFRAMES, MAX_AGE, SANITY, Tick, Bar };
