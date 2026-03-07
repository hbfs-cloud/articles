/**
 * Yahoo Finance WebSocket streaming
 *
 * Endpoint: wss://streamer.finance.yahoo.com/
 * Protocol: JSON subscribe/unsubscribe, base64-encoded protobuf responses
 *
 * Yahoo's PricingData proto (reverse-engineered):
 *   string id = 1            ticker symbol
 *   float  price = 2         current price
 *   string currency = 4
 *   string exchange = 5
 *   int32  quoteType = 6     1=equity,3=etf,41=crypto
 *   int32  marketHours = 7   0=pre,1=regular,2=post
 *   float  changePercent = 8
 *   int64  dayVolume = 9
 *   float  dayHigh = 10
 *   float  dayLow = 11
 *   float  change = 12
 *   string shortName = 13
 *   float  bid = 15
 *   float  ask = 17
 *   float  openPrice = 19
 *   float  previousClose = 20
 */

import { WebSocket } from 'ws';
import { EventEmitter } from 'events';

const WS_URL = 'wss://streamer.finance.yahoo.com/';

// ─── Minimal protobuf decoder ─────────────────────────────────────────────────

function readVarint(buf, pos) {
  let val = 0, shift = 0;
  while (pos < buf.length) {
    const b = buf[pos++];
    val = val + ((b & 0x7f) * Math.pow(2, shift));  // avoid bitwise for large values
    if (!(b & 0x80)) break;
    shift += 7;
  }
  return { val, pos };
}

function decodePricingData(raw) {
  // raw is a base64 string (or Buffer) from Yahoo WS
  const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw.toString(), 'base64');
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const r = {};
  let pos = 0;

  while (pos < buf.length) {
    try {
      const { val: tag, pos: p1 } = readVarint(buf, pos);
      pos = p1;
      const fieldNum = Math.floor(tag / 8);
      const wireType = tag & 0x7;

      if (wireType === 0) {        // varint
        const { val, pos: p2 } = readVarint(buf, pos);
        pos = p2;
        if (fieldNum === 6)  r.quoteType   = val;
        else if (fieldNum === 7)  r.marketHours = val;
        else if (fieldNum === 9)  r.dayVolume   = val;

      } else if (wireType === 2) { // length-delimited (string / embedded msg)
        const { val: len, pos: p2 } = readVarint(buf, pos);
        pos = p2;
        const str = buf.slice(pos, pos + len).toString('utf8');
        pos += len;
        if (fieldNum === 1)  r.id        = str;
        else if (fieldNum === 4)  r.currency  = str;
        else if (fieldNum === 5)  r.exchange  = str;
        else if (fieldNum === 13) r.shortName = str;

      } else if (wireType === 5) { // 32-bit float (little-endian)
        if (pos + 4 > buf.length) break;
        const val = view.getFloat32(pos, true);
        pos += 4;
        if      (fieldNum === 2)  r.price         = +val.toFixed(6);
        else if (fieldNum === 8)  r.changePercent  = +val.toFixed(4);
        else if (fieldNum === 10) r.dayHigh        = +val.toFixed(6);
        else if (fieldNum === 11) r.dayLow         = +val.toFixed(6);
        else if (fieldNum === 12) r.change         = +val.toFixed(6);
        else if (fieldNum === 15) r.bid            = +val.toFixed(6);
        else if (fieldNum === 17) r.ask            = +val.toFixed(6);
        else if (fieldNum === 19) r.open           = +val.toFixed(6);
        else if (fieldNum === 20) r.previousClose  = +val.toFixed(6);

      } else if (wireType === 1) { // 64-bit — skip
        pos += 8;
      } else {
        break; // unknown wire type — stop
      }
    } catch {
      break;
    }
  }

  return r.id ? r : null;
}

// ─── Yahoo WebSocket stream ───────────────────────────────────────────────────

export class YahooStream extends EventEmitter {
  constructor() {
    super();
    this.ws              = null;
    this.subscriptions   = new Set();
    this.quotes          = new Map();   // symbol → latest decoded quote
    this._reconnectTimer = null;
    this._reconnectDelay = 2000;
    this._maxDelay       = 60_000;
    this._alive          = false;
    this._pingTimer      = null;
    this._stats          = { messages: 0, errors: 0, reconnects: 0 };
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  subscribe(symbols) {
    const syms = [symbols].flat().map(s => s.toUpperCase());
    for (const s of syms) this.subscriptions.add(s);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ subscribe: syms }));
    } else {
      this.connect();
    }
    return this;
  }

  unsubscribe(symbols) {
    const syms = [symbols].flat().map(s => s.toUpperCase());
    for (const s of syms) this.subscriptions.delete(s);
    if (this.ws?.readyState === WebSocket.OPEN && syms.length) {
      this.ws.send(JSON.stringify({ unsubscribe: syms }));
    }
    return this;
  }

  getQuote(symbol) {
    return this.quotes.get(symbol.toUpperCase()) ?? null;
  }

  allQuotes() {
    return Object.fromEntries(this.quotes);
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  status() {
    return {
      connected:     this.isConnected(),
      subscriptions: [...this.subscriptions],
      quotesLive:    this.quotes.size,
      stats:         { ...this._stats },
      url:           WS_URL
    };
  }

  connect() {
    if (this.ws && this.ws.readyState !== WebSocket.CLOSED) return;

    this._alive = true;
    this.ws = new WebSocket(WS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Origin':     'https://finance.yahoo.com',
        'Referer':    'https://finance.yahoo.com/',
      }
    });

    this.ws.on('open', () => {
      this._reconnectDelay = 2000;
      console.error('[YahooWS] Connected');
      this.emit('connected');

      if (this.subscriptions.size > 0) {
        this.ws.send(JSON.stringify({ subscribe: [...this.subscriptions] }));
      }

      // Keep-alive ping every 30s
      this._pingTimer = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.ping();
        }
      }, 30_000);
    });

    this.ws.on('message', (data) => {
      try {
        const quote = decodePricingData(data);
        if (!quote?.id) return;

        this._stats.messages++;
        const prev = this.quotes.get(quote.id);
        this.quotes.set(quote.id, { ...quote, ts: Date.now() });
        this.emit('quote', quote, prev ?? null);
      } catch {
        this._stats.errors++;
      }
    });

    this.ws.on('close', (code, reason) => {
      clearInterval(this._pingTimer);
      console.error(`[YahooWS] Disconnected (${code}): ${reason}`);
      this.emit('disconnected', code);
      if (this._alive) this._scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      this._stats.errors++;
      console.error('[YahooWS] Error:', err.message);
      this.emit('error', err);
    });
  }

  disconnect() {
    this._alive = false;
    clearTimeout(this._reconnectTimer);
    clearInterval(this._pingTimer);
    this._reconnectTimer = null;
    if (this.ws) { this.ws.close(); this.ws = null; }
  }

  _scheduleReconnect() {
    if (this._reconnectTimer) return;
    this._stats.reconnects++;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      console.error(`[YahooWS] Reconnecting (attempt ${this._stats.reconnects})...`);
      this.connect();
    }, this._reconnectDelay);
    this._reconnectDelay = Math.min(this._reconnectDelay * 2, this._maxDelay);
  }
}

export const stream = new YahooStream();
