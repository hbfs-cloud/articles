'use strict';

// Yahoo Finance WebSocket source — tick-by-tick streaming.
// wss://streamer.finance.yahoo.com/ — protobuf-encoded, no auth.

const path = require('path');
const WebSocket = require('ws');
const protobuf = require('protobufjs');
const { Tick } = require('../types');

const PROTO_FILE = path.join(__dirname, '../../../PricingData.proto');
const WS_URL = 'wss://streamer.finance.yahoo.com/';
const HEARTBEAT_INTERVAL = 15_000;
const MAX_RETRIES = 10;
const BASE_RETRY_DELAY = 3000;

class YahooWSSource {
  constructor(opts = {}) {
    this.verbose = opts.verbose || false;
    this._ws = null;
    this._PricingData = null;
    this._symbols = [];
    this._stopped = false;
    this._retries = 0;
    this._heartbeat = null;
    this._onTick = null; // callback(Tick)
    this._ready = false;
    this._connectedAt = 0;
  }

  get name() { return 'yahoo-ws'; }
  get isStreaming() { return true; }
  get isConnected() { return this._ws && this._ws.readyState === WebSocket.OPEN; }

  async init() {
    try {
      const root = await protobuf.load(PROTO_FILE);
      this._PricingData = root.lookupType('yfinancedata');
    } catch (e) {
      throw new Error(`yahoo-ws: protobuf load failed: ${e.message}`);
    }
  }

  subscribe(symbols, onTick) {
    this._symbols = symbols;
    this._onTick = onTick;
    this._stopped = false;
    this._retries = 0;
    this._connect();
  }

  unsubscribe() {
    this._stopped = true;
    this._cleanup();
  }

  _connect() {
    if (this._stopped) return;
    try {
      this._ws = new WebSocket(WS_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    } catch (e) {
      this._scheduleReconnect();
      return;
    }

    this._ws.on('open', () => {
      this._retries = 0;
      this._connectedAt = Date.now();
      this._ready = true;
      this._sendSubscribe();
      this._heartbeat = setInterval(() => this._sendSubscribe(), HEARTBEAT_INTERVAL);
      if (this.verbose) console.log(`[yahoo-ws] connected (${this._symbols.length} symbols)`);
    });

    this._ws.on('message', (data) => {
      try { this._handleMessage(data); } catch (_) {}
    });

    this._ws.on('close', () => {
      this._cleanup();
      if (!this._stopped) this._scheduleReconnect();
    });

    this._ws.on('error', () => {}); // close fires after
  }

  _sendSubscribe() {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({ subscribe: this._symbols }));
    }
  }

  _handleMessage(data) {
    const buf = Buffer.from(data.toString(), 'base64');
    const msg = this._PricingData.decode(buf);

    // Skip heartbeats and invalid data
    if (msg.quoteType === 7 || !msg.id || !msg.price || msg.price <= 0) return;

    const toNum = v => (v && typeof v === 'object' && 'toNumber' in v) ? v.toNumber() : (+v || 0);

    const tick = new Tick({
      symbol: msg.id,
      price: msg.price,
      bid: msg.bid || null,
      ask: msg.ask || null,
      volume: toNum(msg.lastSize),
      dayHigh: msg.dayHigh || null,
      dayLow: msg.dayLow > 0 ? msg.dayLow : null,
      dayVolume: toNum(msg.dayVolume),
      ts: Date.now(),
      source: 'yahoo-ws',
    });

    if (this._onTick) this._onTick(tick);
  }

  _scheduleReconnect() {
    if (this._stopped || this._retries >= MAX_RETRIES) return;
    const delay = Math.min(BASE_RETRY_DELAY * Math.pow(2, this._retries), 60_000);
    this._retries++;
    if (this.verbose) console.log(`[yahoo-ws] reconnecting in ${delay}ms (attempt ${this._retries})`);
    setTimeout(() => this._connect(), delay);
  }

  _cleanup() {
    if (this._heartbeat) { clearInterval(this._heartbeat); this._heartbeat = null; }
    if (this._ws) { try { this._ws.close(); } catch (_) {} this._ws = null; }
    this._ready = false;
  }

  destroy() {
    this._stopped = true;
    this._cleanup();
  }
}

module.exports = YahooWSSource;
