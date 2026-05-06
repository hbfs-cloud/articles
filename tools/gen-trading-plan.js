#!/usr/bin/env node
'use strict';

// gen-trading-plan.js — Generate a broker-specific trading plan DSL from scanner signals.
// Usage: node tools/gen-trading-plan.js --mode balanced --broker alpaca [--date 20260505] [--dry-run]

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');

// ── CLI args ──
const args = process.argv.slice(2);
function flag(name) { const i = args.indexOf('--' + name); return i >= 0 ? (args[i + 1] || true) : null; }
const MODE = flag('mode') || 'balanced';
const BROKER_RAW = flag('broker') || 'paper';
const BROKER_ALIAS = { t212: 'trading212' };
const BROKER_LOOKUP = BROKER_ALIAS[BROKER_RAW] || BROKER_RAW;
const BROKER = BROKER_RAW;
let DATE = flag('date');
const DRY_RUN = args.includes('--dry-run');
const OUTPUT = flag('output');

// ── Load data ──
const modesConfig = JSON.parse(fs.readFileSync(path.join(DATA, 'modes-config.json'), 'utf8'));
const modeCfg = modesConfig.modes[MODE];
if (!modeCfg) { console.error(`Unknown mode: ${MODE}. Available: ${Object.keys(modesConfig.modes).join(', ')}`); process.exit(1); }

const brokerMap = JSON.parse(fs.readFileSync(path.join(DATA, 'broker-instruments.json'), 'utf8'));
if (!brokerMap.brokers.includes(BROKER_LOOKUP) && BROKER !== 'paper') {
  console.error(`Unknown broker: ${BROKER}. Available: ${brokerMap.brokers.join(', ')}, paper, t212`);
  process.exit(1);
}

const signalsPath = path.join(ROOT, 'portfolio/v1', MODE, 'signals.json');
const signals = JSON.parse(fs.readFileSync(signalsPath, 'utf8'));

let positions = [];
try { positions = JSON.parse(fs.readFileSync(path.join(DATA, 'scanner-positions.json'), 'utf8')).open_positions || []; } catch (_) {}

const ordersPath = path.join(ROOT, 'portfolio/v1', MODE, 'orders.json');
let currentOrders = [];
let ordersScanDate = '';
try {
  const ordersData = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
  currentOrders = ordersData.orders || [];
  ordersScanDate = ordersData.scanDate || '';
} catch (_) {}

if (!DATE) DATE = ordersScanDate || new Date().toISOString().slice(0, 10).replace(/-/g, '');

// Load raw scanner signals as fallback pool (mode signals.json is topN-filtered)
let rawSignals = [];
const scanDir = ordersScanDate || DATE;
const rawPath = path.join(ROOT, 'scanner', scanDir, 'signals.json');
try {
  const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
  rawSignals = raw.signals || [];
} catch (_) {}

// ── Helpers ──
function brokerSymbol(ticker) {
  if (BROKER === 'paper') return ticker;
  const entry = brokerMap.symbols[ticker];
  if (!entry || !entry.brokers[BROKER_LOOKUP]) return null;
  return entry.brokers[BROKER_LOOKUP].symbol;
}

function brokerInfo(ticker) {
  if (BROKER === 'paper') return { symbol: ticker };
  const entry = brokerMap.symbols[ticker];
  if (!entry || !entry.brokers[BROKER_LOOKUP]) return null;
  const b = entry.brokers[BROKER_LOOKUP];
  const info = { symbol: b.symbol, exchange: b.exchange || '' };
  if (b.uic) info.uic = b.uic;
  if (b.isin) info.isin = b.isin;
  if (b.currency) info.currency = b.currency;
  if (b.asset_type) info.asset_type = b.asset_type;
  return info;
}

function brokerRestrictions(ticker) {
  if (BROKER === 'paper') return { tradable: true, marginable: true, shortable: true, min_order_size: 1, price_increment: 0.01 };
  const entry = brokerMap.symbols[ticker];
  if (!entry || !entry.brokers[BROKER_LOOKUP]) return null;
  const b = entry.brokers[BROKER_LOOKUP];
  return { tradable: b.tradable, marginable: b.marginable, shortable: b.shortable, min_order_size: b.min_order_size || 1, price_increment: b.price_increment || 0.01 };
}

function addBizDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00Z');
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

function roundToIncrement(price, increment) {
  return Math.round(price / increment) * increment;
}

// ── Build plan ──
const now = new Date();
const todayISO = now.toISOString().slice(0, 10);
const targetISO = DATE.length === 8 ? `${DATE.slice(0,4)}-${DATE.slice(4,6)}-${DATE.slice(6,8)}` : todayISO;
const expiryDate = addBizDays(targetISO, modeCfg.horizon);
const nominalUsd = modeCfg.portfolioSize > 0 ? 10000 : 10000; // default capital
const positionPct = modeCfg.positionSizePct || +(100 / modeCfg.portfolioSize).toFixed(2);
const positionNominal = +(nominalUsd * positionPct / 100).toFixed(2);

// Current positions for this mode
const modePositions = positions.filter(p => {
  // Match positions from mode's trades
  return true; // positions are mode-agnostic in scanner-positions.json
});

// Identify close-now (horizon expired)
function bizDaysSince(dateStr) {
  if (!dateStr) return 0;
  const start = new Date(dateStr + 'T12:00:00Z');
  const end = new Date();
  let count = 0;
  const d = new Date(start);
  while (d < end) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

// ── Orders from API ──
const buyOrders = currentOrders.filter(o => o.action === 'BUY');
const rotateOrders = currentOrders.filter(o => o.action === 'ROTATE');

// ── Generate order entries ──
let orderSeq = 0;
function makeOrder(signal, action, rotation) {
  orderSeq++;
  const sym = brokerSymbol(signal.ticker);
  const restrictions = brokerRestrictions(signal.ticker);

  if (!sym) {
    return {
      id: `ORD-${String(orderSeq).padStart(3, '0')}`,
      action: 'SKIP',
      ticker: signal.ticker,
      reason: `Not available on ${BROKER}`,
    };
  }
  if (restrictions && !restrictions.tradable) {
    return {
      id: `ORD-${String(orderSeq).padStart(3, '0')}`,
      action: 'SKIP',
      ticker: signal.ticker,
      broker_symbol: sym,
      reason: `Not tradable on ${BROKER}`,
    };
  }

  const increment = restrictions?.price_increment || 0.01;
  const entryPrice = roundToIncrement(signal.entry, increment);
  const stopPrice = roundToIncrement(signal.stop, increment);
  const tp1Price = roundToIncrement(signal.tp1, increment);
  const tp2Price = signal.tp2 ? roundToIncrement(signal.tp2, increment) : null;
  const shares = Math.max(restrictions?.min_order_size || 1, Math.floor(positionNominal / entryPrice));

  return {
    id: `ORD-${String(orderSeq).padStart(3, '0')}`,
    action: action,
    ticker: signal.ticker,
    broker_symbol: sym,
    broker: brokerInfo(signal.ticker),
    entry: {
      type: 'LIMIT',
      price: entryPrice,
      vwap_gate: {
        enabled: true,
        max_open_ratio: 1.01,
        description: 'Fill only if next open ≤ entry × 1.01. If gap-up above threshold, wait for VWAP pullback.',
      },
      size: {
        method: 'FIXED_NOMINAL',
        nominal_usd: positionNominal,
        shares: shares,
        pct_of_portfolio: positionPct,
      },
      valid_from: `${targetISO}T09:30:00-04:00`,
      valid_until: `${targetISO}T16:00:00-04:00`,
      time_in_force: 'DAY',
    },
    exit: {
      stop_loss: {
        type: 'STOP',
        price: stopPrice,
        trailing: false,
      },
      take_profit_1: {
        type: 'LIMIT',
        price: tp1Price,
        partial_exit_pct: 50,
        description: 'Sell 50% at TP1, move stop to breakeven on remainder',
      },
      take_profit_2: tp2Price ? {
        type: 'LIMIT',
        price: tp2Price,
        partial_exit_pct: 100,
        description: 'Sell remaining position at TP2',
      } : null,
      breakeven: {
        trigger_pct: modeCfg.breakevenPct || 2,
        action: 'MOVE_STOP_TO_ENTRY',
        description: `When unrealized P&L ≥ ${modeCfg.breakevenPct || 2}%, move stop to entry price`,
      },
      time_exit: {
        horizon_days: modeCfg.horizon,
        expiry_date: expiryDate,
        action: 'CLOSE_AT_MARKET_OPEN',
        description: `If still open after ${modeCfg.horizon} business days, close at next market open`,
      },
    },
    conditions: [
      {
        phase: 'PRE_ENTRY',
        check: 'GAP_UP',
        threshold_ratio: 1.02,
        if_true: 'WAIT_VWAP_PULLBACK',
        description: 'If open > entry × 1.02, do not market buy. Wait for price to pull back to VWAP.',
      },
      {
        phase: 'PRE_ENTRY',
        check: 'HALTED',
        if_true: 'SKIP_ORDER',
        description: 'If symbol is halted at market open, skip entirely.',
      },
      {
        phase: 'PRE_ENTRY',
        check: 'SPREAD',
        max_spread_pct: 0.5,
        if_true: 'DELAY_30S',
        description: 'If bid-ask spread > 0.5%, wait 30s for spread to tighten.',
      },
      {
        phase: 'POST_FILL',
        check: 'SLIPPAGE',
        max_slippage_pct: 1.0,
        if_exceeded: 'LOG_WARNING',
        description: 'Log warning if fill price > 1% worse than limit.',
      },
    ],
    rotation: rotation ? {
      close_ticker: rotation.close,
      close_broker_symbol: brokerSymbol(rotation.close),
      reason: rotation.reason || 'Score upgrade — rotate worst position for better signal',
    } : undefined,
    metadata: {
      score: signal.score,
      strategy: signal.strategy,
      rr: signal.rr,
      sharia: signal.sharia,
      thesis: signal.thesis,
    },
  };
}

// Build orders — scanner picks first (priority 1), then remaining signals as fallbacks
const MAX_ORDERS = 5;
const orders = [];
const usedTickers = new Set();

for (const o of buyOrders) {
  const sig = signals.signals.find(s => s.ticker === o.ticker) || o;
  const order = makeOrder(sig, 'BUY', null);
  order.priority = orders.filter(x => x.action !== 'SKIP').length + 1;
  orders.push(order);
  usedTickers.add(o.ticker);
}
for (const o of rotateOrders) {
  const sig = signals.signals.find(s => s.ticker === o.ticker) || o;
  const order = makeOrder(sig, 'ROTATE', { close: o.rotate_out || o.close, reason: o.reason });
  order.priority = orders.filter(x => x.action !== 'SKIP').length + 1;
  orders.push(order);
  usedTickers.add(o.ticker);
}

// Fallback: raw scanner signals (not topN-filtered), sorted by score
const fallbackSignals = (rawSignals.length > 0 ? rawSignals : signals.signals)
  .filter(s => !usedTickers.has(s.ticker) && s.entry && s.stop && s.tp1)
  .sort((a, b) => (b.score || 0) - (a.score || 0));

for (const sig of fallbackSignals) {
  if (orders.filter(o => o.action !== 'SKIP').length >= MAX_ORDERS) break;
  const order = makeOrder(sig, 'BUY', null);
  if (order.action !== 'SKIP') {
    order.priority = orders.filter(x => x.action !== 'SKIP').length + 1;
    orders.push(order);
  }
}

// ── Close-now positions ──
const closeNow = [];
for (const p of modePositions) {
  const held = bizDaysSince(p.scan_date || p.entry_date);
  if (held >= modeCfg.horizon) {
    const sym = brokerSymbol(p.ticker);
    closeNow.push({
      action: 'CLOSE',
      ticker: p.ticker,
      broker_symbol: sym || p.ticker,
      broker: brokerInfo(p.ticker),
      reason: 'HORIZON_EXPIRED',
      held_days: held,
      horizon: modeCfg.horizon,
      current_pnl_pct: p.return_pct,
      execution: {
        type: 'MARKET',
        timing: 'AT_OPEN',
        description: 'Close at market open — horizon expired, exit regardless of P&L',
      },
    });
  }
}

// ── Assemble full plan ──
const plan = {
  version: '1.0',
  dsl: 'dailytickers-trading-plan',
  generated_at: now.toISOString(),
  valid_for: targetISO,

  broker: {
    name: BROKER,
    type: BROKER === 'paper' ? 'simulation' : brokerMap.symbols[Object.keys(brokerMap.symbols)[0]]?.brokers[BROKER] ? 'live' : 'live',
    credentials: {
      api_key: '${BROKER_API_KEY}',
      api_secret: '${BROKER_API_SECRET}',
      base_url: BROKER === 'alpaca' ? 'https://paper-api.alpaca.markets'
        : BROKER === 'ibkr' ? 'https://localhost:5000/v1/api'
        : BROKER === 'trading212' ? 'https://live.trading212.com/api/v0'
        : BROKER === 'saxo' ? 'https://gateway.saxobank.com/openapi'
        : BROKER === 'binance' ? 'https://api.binance.com'
        : 'http://localhost:9999',
      note: 'Replace ${BROKER_API_KEY} and ${BROKER_API_SECRET} with actual credentials. For paper trading, use sandbox URLs.',
    },
  },

  account: {
    nominal_usd: nominalUsd,
    currency: 'USD',
    position_size_pct: positionPct,
    max_positions: modeCfg.portfolioSize,
  },

  mode: {
    name: MODE,
    horizon_days: modeCfg.horizon,
    filter: modeCfg.filterName,
    min_score: modeCfg.minScore,
    rotation: modeCfg.rotation,
    breakeven_pct: modeCfg.breakevenPct,
    vix_kill: modeCfg.vixKill,
  },

  session: {
    market: 'US_EQUITY',
    timezone: 'America/New_York',
    pre_market: '04:00',
    market_open: '09:30',
    market_close: '16:00',
    post_market: '20:00',
    extended_hours: false,
  },

  risk: {
    max_portfolio_heat_pct: (modeCfg.portfolioSize * (modeCfg.positionSizePct || 33.33) * 0.03).toFixed(1),
    max_single_loss_pct: 3,
    max_slippage_pct: 1.0,
    max_spread_pct: 0.5,
    circuit_breaker: {
      daily_loss_pct: 5,
      action: 'HALT_ALL_ORDERS',
      description: 'If portfolio drops 5% intraday, cancel all pending orders and alert.',
    },
    correlation_limit: 0.85,
    max_sector_concentration: 3,
  },

  close_now: closeNow,
  orders: orders,

  error_handlers: {
    INSUFFICIENT_MARGIN: {
      action: 'REDUCE_SIZE',
      reduce_pct: 50,
      retry: true,
      max_retries: 1,
    },
    SYMBOL_NOT_FOUND: {
      action: 'SKIP',
      log_level: 'ERROR',
    },
    CONNECTION_LOST: {
      action: 'RECONNECT',
      max_retries: 10,
      backoff_ms: [1000, 2000, 5000, 10000, 30000],
      on_failure: 'CANCEL_PENDING_AND_ALERT',
    },
    PARTIAL_FILL: {
      action: 'KEEP_PARTIAL',
      adjust_exits: true,
      description: 'Keep partial fill. Adjust TP/SL quantities proportionally.',
    },
    ORDER_REJECTED: {
      action: 'LOG_AND_SKIP',
      log_level: 'WARN',
    },
    MARKET_HALTED: {
      action: 'WAIT_RESUME',
      timeout_min: 60,
      on_timeout: 'CANCEL_ORDER',
    },
    RATE_LIMITED: {
      action: 'BACKOFF',
      delay_ms: 5000,
      max_retries: 3,
    },
    DUPLICATE_ORDER: {
      action: 'SKIP',
      description: 'Order for this symbol already exists. Idempotent — skip.',
    },
  },

  lifecycle: {
    on_start: [
      { step: 'CHECK_MARKET_STATUS', description: 'Verify market is open or will open today' },
      { step: 'SYNC_ACCOUNT', description: 'Fetch current account balance, buying power, positions' },
      { step: 'RECONCILE_POSITIONS', description: 'Compare broker positions with expected positions. Alert on discrepancy.' },
      { step: 'CHECK_VIX', threshold: modeCfg.vixKill, action: 'HALT_IF_ABOVE', description: `If VIX > ${modeCfg.vixKill}, halt all new orders` },
      { step: 'LOG_STATE', description: 'Log initial account state for audit trail' },
    ],
    on_fill: [
      { step: 'PLACE_EXITS', description: 'Immediately place SL and TP1/TP2 bracket orders' },
      { step: 'LOG_FILL', description: 'Record fill price, time, slippage, fees' },
      { step: 'CHECK_BREAKEVEN', description: 'Start monitoring for breakeven trigger' },
      { step: 'NOTIFY', channel: 'telegram', description: 'Send fill notification to Telegram' },
    ],
    on_exit: [
      { step: 'CANCEL_REMAINING_EXITS', description: 'Cancel the other side (SL if TP hit, TP if SL hit)' },
      { step: 'LOG_EXIT', description: 'Record exit price, P&L, hold time' },
      { step: 'CHECK_ROTATION', description: 'If slot freed, check for pending rotation candidates' },
      { step: 'UPDATE_PORTFOLIO', description: 'Update local portfolio state file' },
    ],
    on_breakeven: [
      { step: 'MODIFY_STOP', description: 'Move stop loss to entry price (+ spread buffer)' },
      { step: 'LOG_BREAKEVEN', description: 'Record breakeven activation' },
    ],
    on_horizon_expiry: [
      { step: 'CLOSE_AT_MARKET', description: 'Submit market close order at next open' },
      { step: 'CANCEL_EXITS', description: 'Cancel any pending TP/SL orders for this position' },
    ],
    on_error: [
      { step: 'LOG_ERROR', description: 'Record error with full context' },
      { step: 'LOOKUP_HANDLER', description: 'Find matching error_handler and execute action' },
      { step: 'NOTIFY_IF_CRITICAL', description: 'Alert on CONNECTION_LOST, CIRCUIT_BREAKER, or unknown errors' },
    ],
    on_end: [
      { step: 'CANCEL_UNFILLED', description: 'Cancel any GTC orders that were not filled today' },
      { step: 'EXPORT_TRADES', description: 'Write execution log to trades-YYYYMMDD.json' },
      { step: 'SUMMARY', description: 'Print session summary: fills, skips, errors, P&L' },
    ],
  },

  broker_notes: {
    alpaca: {
      pdt_rule: 'Pattern Day Trader: max 3 day trades in 5 business days if account < $25K',
      fractional: 'Alpaca supports fractional shares — use exact nominal instead of rounding to whole shares',
      paper_url: 'https://paper-api.alpaca.markets',
      live_url: 'https://api.alpaca.markets',
      websocket: 'wss://stream.data.alpaca.markets/v2/iex',
      auth: 'Headers: APCA-API-KEY-ID + APCA-API-SECRET-KEY',
    },
    ibkr: {
      gateway: 'Requires IB Gateway or TWS running locally on port 5000',
      auth: 'Session-based — authenticate via Client Portal then use session token',
      order_types: 'Supports all order types including adaptive, pegged, TWAP',
      fractional: 'No fractional shares on IBKR',
      min_commission: '$1.00 per trade',
    },
    trading212: {
      api_limits: 'Very limited API — equity orders only, no bracket orders',
      fractional: 'Supports fractional shares down to 0.001',
      symbol_format: 'Append _US_EQ for US equities (e.g., GOOGL_US_EQ)',
      workaround: 'No native bracket orders — must monitor and place SL/TP separately',
    },
    saxo: {
      auth: 'OAuth2 — requires authorization code flow',
      symbol_format: 'Use Uic (unique instrument code) or SYMBOL:EXCHANGE format',
      order_types: 'Supports limit, stop, trailing stop, OCO',
      related_orders: 'Supports related orders (bracket) natively',
    },
    binance: {
      crypto_only: 'Binance only supports crypto pairs — not applicable for stock signals',
      symbol_format: 'Trading pairs like BTCUSDT, ETHUSDT',
    },
  }[BROKER] || {},
};

// ── Output ──
const json = JSON.stringify(plan, null, 2);
const outPath = OUTPUT || path.join(ROOT, `data/trading-plans/${MODE}-${BROKER}-${DATE}.json`);

if (DRY_RUN) {
  console.log(json);
  process.stderr.write(`✅ Dry run — plan for ${MODE}/${BROKER} with ${orders.length} orders, ${closeNow.length} close-now\n`);
} else {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, json);
  console.log(`✅ Trading plan written: ${outPath}`);
  console.log(`   Mode: ${MODE} | Broker: ${BROKER} | Orders: ${orders.length} | Close: ${closeNow.length}`);
  console.log(`   Valid for: ${targetISO} | Horizon: ${modeCfg.horizon}d | Expiry: ${expiryDate}`);
}
