/**
 * Alert Engine — DSL-based intelligent alerts
 *
 * DSL syntax:
 *   price > 150                          simple threshold
 *   price > ema50                        field vs field
 *   rvol >= 2 AND changePct > 1.5        compound (AND / OR / NOT)
 *   rsi14 < 30                           oversold
 *   price crosses_above ema50            crossover (stateful)
 *   price crosses_below ema200           crossunder (stateful)
 *   rsi14 crosses_below 70               exits overbought
 *   price touches 52w_high               within 0.5% of 52-week high
 *   drawdown > 5                         loss vs entry > 5%
 *   gain > 10                            profit vs entry > 10%
 *
 * Alert fields enriched at eval time:
 *   price, open, high, low, previousClose, change, changePct
 *   volume, rvol, ema50, ema200, high52w, low52w, bid, ask
 *   rsi14, atr14
 *   entry, stop, tp1, tp2  (from alert definition)
 *   drawdown / gain        (price vs entry, %)
 *
 * Channels: desktop | discord | telegram | slack
 */

import * as cache from './cache.js';
import { getEnrichment, track } from './tick-enricher.js';

// ─── Config ──────────────────────────────────────────────────────────────────

let _config = {};
export function configure(cfg) { _config = cfg || {}; }

// ─── Alert store ─────────────────────────────────────────────────────────────

const _alerts  = new Map();   // id → alert
const _history = [];           // last 200 triggered events
let   _nextId  = 1;

// ─── Alert log (visible failures — no silent errors) ─────────────────────────

const _errors = [];  // last 50 eval errors

function logError(alertId, msg) {
  const entry = { alertId, msg, at: new Date().toISOString() };
  _errors.push(entry);
  if (_errors.length > 50) _errors.shift();
  console.error(`[AlertEngine] alert#${alertId}: ${msg}`);
}

export function getErrors() { return [..._errors]; }

// ─── DSL Field map ───────────────────────────────────────────────────────────

const FIELD_MAP = {
  // Price
  price:           'q.price',
  open:            'q.open',
  high:            'q.high',
  low:             'q.low',
  prev_close:      'q.previousClose',
  previousclose:   'q.previousClose',
  change:          'q.change',
  change1d:        'q.changePct',
  changepct:       'q.changePct',
  // Volume
  volume:          'q.volume',
  vol:             'q.volume',
  rvol:            'q.rvol',
  vol_accel:       'q.volAccel',      // volume acceleration vs prev bar
  // MAs
  ema50:           'q.ema50',
  ema200:          'q.ema200',
  vwap:            'q.vwap',
  dist_vwap:       'q.distVwap',      // % distance from VWAP (neg = below)
  // 52w
  '52w_high':      'q.high52w',
  '52w_low':       'q.low52w',
  high52w:         'q.high52w',
  low52w:          'q.low52w',
  pct_from_high:   'q.pctFromHigh',
  pct_from_low:    'q.pctFromLow',
  // Indicators
  rsi14:           'q.rsi14',
  atr14:           'q.atr14',
  atr_pct:         'q.atrPct',        // ATR as % of price
  // Order book
  bid:             'q.bid',
  ask:             'q.ask',
  spread:          'q.spread',
  // Trade context
  entry:           'q.entry',
  stop:            'q.stop',
  tp1:             'q.tp1',
  tp2:             'q.tp2',
  drawdown:        'q.drawdown',
  gain:            'q.gain',
  // Pattern scores (0–100, computed by enrichQuote when bars available)
  breakout_score:  'q.breakoutScore',  // price vs recent range high
  reversal_score:  'q.reversalScore',  // momentum divergence score
  squeeze_score:   'q.squeezeScore',   // consolidation tightness
};

// Same map with prev. prefix for crossover evaluation
function prevField(qExpr) {
  return qExpr.replace(/^q\./, 'prev.');
}

// ─── DSL Compiler ────────────────────────────────────────────────────────────

/**
 * Compile a DSL expression into a fn(q, prev) → bool
 *
 * q and prev are both enriched quote objects.
 * prev is the previous tick snapshot; used only for crosses_above / crosses_below.
 */
export function compileAlertDSL(expr) {
  let js = expr.trim()
    .replace(/\band\b/gi, '&&')
    .replace(/\bor\b/gi,  '||')
    .replace(/\bnot\b/gi, '!');

  // Use placeholders so that crossover-generated code is not re-processed
  // by the field map substitution step below.
  const _stored = [];
  function protect(code) {
    const idx = _stored.length;
    _stored.push(code);
    return `___P${idx}___`;
  }
  function restorePlaceholders(s) {
    return s.replace(/___P(\d+)___/g, (_, i) => _stored[+i]);
  }

  // ── crosses_above: prev_A < prev_B && curr_A >= curr_B ──
  js = js.replace(
    /\b([\w]+)\s+crosses_above\s+([\w]+)\b/gi,
    (_, a, b) => {
      const qa = FIELD_MAP[a.toLowerCase()] ?? `q.${a}`;
      const qb = isNaN(b) ? (FIELD_MAP[b.toLowerCase()] ?? `q.${b}`) : b;
      const pa = qa.replace(/^q\./, 'prev.');
      const pb = isNaN(b) ? qb.replace(/^q\./, 'prev.') : b;
      return protect(`(prev!=null&&${pa}!=null&&${pb}!=null&&${pa}<${pb}&&${qa}>=${qb})`);
    }
  );

  // ── crosses_below: prev_A > prev_B && curr_A <= curr_B ──
  js = js.replace(
    /\b([\w]+)\s+crosses_below\s+([\w]+)\b/gi,
    (_, a, b) => {
      const qa = FIELD_MAP[a.toLowerCase()] ?? `q.${a}`;
      const qb = isNaN(b) ? (FIELD_MAP[b.toLowerCase()] ?? `q.${b}`) : b;
      const pa = qa.replace(/^q\./, 'prev.');
      const pb = isNaN(b) ? qb.replace(/^q\./, 'prev.') : b;
      return protect(`(prev!=null&&${pa}!=null&&${pb}!=null&&${pa}>${pb}&&${qa}<=${qb})`);
    }
  );

  // ── touches X: within 0.5% of target ──
  js = js.replace(
    /\b([\w]+)\s+touches\s+([\w]+(?:\.\w+)?|\d+(?:\.\d+)?)\b/gi,
    (_, a, b) => {
      const qa = FIELD_MAP[a.toLowerCase()] ?? `q.${a}`;
      const qb = isNaN(b) ? (FIELD_MAP[b.toLowerCase()] ?? `q.${b}`) : b;
      return protect(`(${qb}!=null&&${qb}!==0&&Math.abs(${qa}-${qb})/Math.abs(${qb})<=0.005)`);
    }
  );

  // ── single-pass field name substitution (only on non-placeholder text) ──
  const keys = Object.keys(FIELD_MAP).sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`\\b(${keys.map(k => k.replace('.', '\\.')).join('|')})\\b`, 'gi');
  js = js.replace(pattern, match => FIELD_MAP[match.toLowerCase()] ?? match);

  // ── restore protected crossover/touches code ──
  js = restorePlaceholders(js);

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('q', 'prev', `"use strict"; return !!(${js});`);
    // Smoke-test
    const dummy = {
      price: 100, open: 98, high: 102, low: 97, previousClose: 99,
      change: 1, changePct: 1, volume: 1e6, rvol: 1.5,
      ema50: 98, ema200: 90, high52w: 120, low52w: 70,
      pctFromHigh: -3, pctFromLow: 20, rsi14: 55, atr14: 2,
      bid: 99.9, ask: 100.1, entry: 95, stop: 90, tp1: 110, tp2: 125,
      drawdown: 5.26, gain: 5.26, spread: 0.2
    };
    fn(dummy, { ...dummy, price: 97, ema50: 99, rsi14: 72 });
    return { fn, ok: true, js };
  } catch (e) {
    return { fn: null, ok: false, error: e.message, js };
  }
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

/**
 * Create a DSL alert.
 *
 * @param {object} opts
 *   ticker      {string}   e.g. "AAPL" or "BTCUSDT"
 *   name        {string}   human label
 *   when        {string}   DSL expression  ← NEW — replaces condition/value
 *   channels    {string[]} ['discord','telegram','desktop','slack']
 *   once        {boolean}  disable after first trigger (default false)
 *   throttle    {number}   seconds between re-triggers (default 300)
 *   message     {string}   custom message (optional — auto-generated if null)
 *   entry       {number}   entry price context for drawdown/gain
 *   stop        {number}
 *   tp1         {number}
 *   tp2         {number}
 *   auto        {boolean}  internal flag — set by createWatchlistAlerts
 */
export function createAlert(opts) {
  const { fn, ok, error, js } = compileAlertDSL(opts.when || 'price > 0');
  if (!ok) throw new Error(`Invalid DSL: ${error}\nCompiled: ${js}`);

  const id = _nextId++;
  const alert = {
    id,
    ticker:   (opts.ticker || '').toUpperCase(),
    name:     opts.name || opts.when,
    when:     opts.when,
    _fn:      fn,    // compiled function — not serialised
    channels: opts.channels || defaultChannels(),
    once:     opts.once     ?? false,
    throttle: opts.throttle ?? 300,
    message:  opts.message  || null,
    entry:    opts.entry    ?? null,
    stop:     opts.stop     ?? null,
    tp1:      opts.tp1      ?? null,
    tp2:      opts.tp2      ?? null,
    auto:     opts.auto     ?? false,
    status:   'active',
    createdAt:   new Date().toISOString(),
    triggeredAt: null,
    triggerCount: 0,
  };

  _alerts.set(id, alert);
  // Auto-track ticker for background enrichment (pattern scores)
  if (alert.ticker) track(alert.ticker);
  return toPublic(alert);
}

export function getAlert(id)           { return toPublic(_alerts.get(id)); }
export function deleteAlert(id)        { return _alerts.delete(id); }
export function pauseAlert(id)         { return _update(id, { status: 'paused' }); }
export function resumeAlert(id)        { return _update(id, { status: 'active' }); }

export function listAlerts(filter = {}) {
  let list = [..._alerts.values()];
  if (filter.ticker) list = list.filter(a => a.ticker === filter.ticker.toUpperCase());
  if (filter.status) list = list.filter(a => a.status === filter.status);
  if (filter.auto   !== undefined) list = list.filter(a => a.auto === filter.auto);
  return list.map(toPublic);
}

export function alertHistory(n = 50) {
  return _history.slice(-n);
}

function _update(id, updates) {
  const a = _alerts.get(id);
  if (!a) return null;
  Object.assign(a, updates);
  if (updates.when) {
    const { fn, ok, error } = compileAlertDSL(updates.when);
    if (!ok) throw new Error(`Invalid DSL: ${error}`);
    a._fn = fn;
  }
  return toPublic(a);
}

// ─── Watchlist integration ────────────────────────────────────────────────────

/**
 * Auto-generate standard entry/stop/TP alerts from a watchlist.
 * Clears previous auto alerts first.
 */
export function createWatchlistAlerts(watchlist) {
  for (const [id, a] of _alerts) {
    if (a.auto) _alerts.delete(id);
  }

  const channels = defaultChannels();

  for (const pick of watchlist.picks || []) {
    const { ticker, entry, stop, tp1, tp2, strategy, score } = pick;
    if (!ticker) continue;

    const ctx = { ticker, entry, stop, tp1, tp2, auto: true, channels };

    // Entry zone
    if (entry) {
      createAlert({ ...ctx,
        name:    `${ticker} — Entry zone`,
        when:    `price touches ${entry}`,
        message: `${ticker} approaching entry $${entry} (score ${score}, ${strategy})`,
      });
    }

    // Stop loss
    if (stop) {
      createAlert({ ...ctx,
        name:    `${ticker} — Stop hit`,
        when:    `price crosses_below ${stop}`,
        once:    true,
        message: `${ticker} STOP HIT $${stop} — Exit, thesis invalidated`,
      });
    }

    // TP1
    if (tp1) {
      createAlert({ ...ctx,
        name:    `${ticker} — TP1`,
        when:    `price crosses_above ${tp1}`,
        once:    true,
        message: `${ticker} TP1 $${tp1} — Scale out 50%`,
      });
    }

    // TP2
    if (tp2) {
      createAlert({ ...ctx,
        name:    `${ticker} — TP2`,
        when:    `price crosses_above ${tp2}`,
        once:    true,
        message: `${ticker} TP2 $${tp2} — Full target, close position`,
      });
    }
  }

  return listAlerts({ status: 'active', auto: true });
}

// ─── Tick evaluator ───────────────────────────────────────────────────────────

/**
 * Evaluate all active alerts against the latest quote snapshot.
 *
 * @param {Map|object} quotesMap  symbol → quote object (normalised screener format)
 * @param {Map|object} prevMap    symbol → previous quote object (for crossovers)
 * @returns {Array} triggered alerts
 */
export async function tick(quotesMap, prevMap = {}) {
  const triggered = [];

  for (const [id, alert] of _alerts) {
    if (alert.status !== 'active') continue;

    // Look up quote by ticker
    const raw  = quotesMap instanceof Map ? quotesMap.get(alert.ticker) : quotesMap[alert.ticker];
    const prev = prevMap  instanceof Map ? prevMap.get(alert.ticker)  : prevMap[alert.ticker];
    if (!raw) continue;

    // Merge pattern scores from tick-enricher (non-blocking — returns {} if not ready)
    const patternData = getEnrichment(alert.ticker);
    // Enrich with alert context (entry/stop/tp + derived drawdown/gain + pattern scores)
    const q = enrichQuote({ ...raw, ...patternData }, alert);
    const p = prev ? enrichQuote({ ...prev, ...patternData }, alert) : null;

    // Throttle check
    if (isThrottled(alert)) continue;

    // Evaluate DSL — log errors explicitly, never fail silently
    let fired = false;
    try {
      fired = alert._fn(q, p);
    } catch (e) {
      logError(id, `DSL eval error: ${e.message} | expr: ${alert.when}`);
      continue;
    }
    if (!fired) continue;

    // Throttle record
    const cacheKey = `alert:throttle:${id}`;
    cache.set(cacheKey, 1, alert.throttle);

    alert.triggeredAt  = new Date().toISOString();
    alert.triggerCount++;
    if (alert.once) alert.status = 'triggered';

    const event = {
      alertId:      id,
      name:         alert.name,
      ticker:       alert.ticker,
      when:         alert.when,
      channels:     alert.channels,
      message:      alert.message || autoMessage(alert, q),
      price:        q.price,
      changePct:    q.changePct,
      rvol:         q.rvol,
      drawdown:     q.drawdown,
      triggeredAt:  alert.triggeredAt,
    };

    triggered.push(event);
    _history.push(event);
    if (_history.length > 200) _history.shift();

    await notify(event);
  }

  return triggered;
}

// ─── Quote enrichment ─────────────────────────────────────────────────────────

function enrichQuote(q, alert) {
  const entry    = alert.entry ?? null;
  const price    = q.price ?? 0;
  const drawdown = entry ? +((price - entry) / entry * 100).toFixed(3) : null;

  // Volume acceleration: how much faster is current volume vs previous close volume
  const volAccel = (q.volume > 0 && q.avgvol3m > 0)
    ? +(q.volume / q.avgvol3m).toFixed(2)
    : (q.rvol ?? null);

  // Distance from VWAP (%)
  const vwap     = q.vwap ?? null;
  const distVwap = (vwap && price) ? +((price - vwap) / vwap * 100).toFixed(3) : null;

  // ATR as % of price
  const atrPct = (q.atr14 && price) ? +(q.atr14 / price * 100).toFixed(3) : null;

  // Pattern scores (populated by bars-enriched screener ticks, otherwise null)
  const breakoutScore = q.breakoutScore ?? null;
  const reversalScore = q.reversalScore ?? null;
  const squeezeScore  = q.squeezeScore  ?? null;

  return {
    price,
    open:          q.open          ?? null,
    high:          q.high          ?? null,
    low:           q.low           ?? null,
    previousClose: q.previousClose ?? null,
    change:        q.change        ?? null,
    changePct:     q.changePct     ?? 0,
    volume:        q.volume        ?? 0,
    rvol:          q.rvol          ?? null,
    volAccel,
    ema50:         q.ema50         ?? null,
    ema200:        q.ema200        ?? null,
    vwap,
    distVwap,
    high52w:       q.high52w       ?? null,
    low52w:        q.low52w        ?? null,
    pctFromHigh:   q.pctFromHigh   ?? null,
    pctFromLow:    q.pctFromLow    ?? null,
    rsi14:         q.rsi14         ?? null,
    atr14:         q.atr14         ?? null,
    atrPct,
    bid:           q.bid           ?? null,
    ask:           q.ask           ?? null,
    spread:        q.bid && q.ask ? +(q.ask - q.bid).toFixed(6) : null,
    entry,
    stop:          alert.stop      ?? null,
    tp1:           alert.tp1       ?? null,
    tp2:           alert.tp2       ?? null,
    drawdown,
    gain: drawdown,
    breakoutScore,
    reversalScore,
    squeezeScore,
  };
}

// ─── Auto-message generator ───────────────────────────────────────────────────

function autoMessage(alert, q) {
  const sym   = alert.ticker;
  const price = q.price.toFixed(2);
  const chg   = q.changePct >= 0 ? `+${q.changePct.toFixed(2)}%` : `${q.changePct.toFixed(2)}%`;

  if (alert.when.includes('crosses_above')) {
    return `📈 ${sym} @ $${price} (${chg}) — ${alert.name}`;
  }
  if (alert.when.includes('crosses_below')) {
    return `📉 ${sym} @ $${price} (${chg}) — ${alert.name}`;
  }
  if (alert.when.includes('touches')) {
    return `🎯 ${sym} @ $${price} (${chg}) — ${alert.name}`;
  }
  if (q.drawdown !== null) {
    const pnl = q.drawdown >= 0 ? `+${q.drawdown.toFixed(2)}%` : `${q.drawdown.toFixed(2)}%`;
    return `🔔 ${sym} @ $${price} | P&L: ${pnl} — ${alert.name}`;
  }
  return `🔔 ${sym} @ $${price} (${chg}) — ${alert.name}`;
}

// ─── Notifications ────────────────────────────────────────────────────────────

async function notify(event) {
  for (const ch of event.channels) {
    try {
      if (ch === 'discord')  await notifyDiscord(event);
      if (ch === 'telegram') await notifyTelegram(event);
      if (ch === 'slack')    await notifySlack(event);
      if (ch === 'desktop')  await notifyDesktop(event);
    } catch (e) {
      console.error(`[AlertEngine] ${ch} notify failed:`, e.message);
    }
  }
}

async function notifyDiscord(ev) {
  const wh = _config.alerts?.channels?.discord?.webhook_url;
  if (!wh) return;

  const isStop = ev.when.includes('crosses_below') || ev.name.toLowerCase().includes('stop');
  const isTp   = ev.when.includes('crosses_above') || ev.name.toLowerCase().includes('tp');
  const color  = isStop ? 0xef4444 : isTp ? 0x10b981 : 0x3b82f6;
  const emoji  = isStop ? '🔴' : isTp ? '✅' : '🔔';

  const fields = [
    { name: 'Price',    value: `$${ev.price}`,                   inline: true },
    { name: 'Change',   value: `${ev.changePct?.toFixed(2)}%`,   inline: true },
    { name: 'RVOL',     value: `${ev.rvol?.toFixed(2) ?? 'N/A'}`,inline: true },
  ];
  if (ev.drawdown !== null) {
    fields.push({ name: 'P&L vs Entry', value: `${ev.drawdown.toFixed(2)}%`, inline: true });
  }

  await fetch(wh, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title:       `${emoji} ${ev.ticker} — ${ev.name}`,
        description: ev.message,
        color,
        fields,
        footer:      { text: `DailyTickers Alert · ${ev.when}` },
        timestamp:   ev.triggeredAt,
      }]
    })
  });
}

async function notifyTelegram(ev) {
  const token  = _config.alerts?.channels?.telegram?.bot_token;
  const chatId = _config.alerts?.channels?.telegram?.chat_id;
  if (!token || !chatId) return;

  const isStop = ev.when.includes('crosses_below') || ev.name.toLowerCase().includes('stop');
  const emoji  = isStop ? '🔴' : ev.when.includes('crosses_above') ? '✅' : '🔔';
  const pnl    = ev.drawdown != null ? `\nP&L: ${ev.drawdown.toFixed(2)}%` : '';

  const text = `${emoji} *${ev.ticker}* — ${ev.name}\n\n${ev.message}\n\n💰 $${ev.price} | ${ev.changePct?.toFixed(2)}% | RVOL ${ev.rvol?.toFixed(2) ?? '—'}${pnl}\n\`${ev.when}\``;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', disable_notification: false })
  });
}

async function notifySlack(ev) {
  const wh = _config.alerts?.channels?.slack?.webhook_url;
  if (!wh) return;

  const isStop = ev.when.includes('crosses_below');
  const color  = isStop ? '#ef4444' : ev.when.includes('crosses_above') ? '#10b981' : '#3b82f6';

  await fetch(wh, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attachments: [{
        color,
        title:  `${ev.ticker} — ${ev.name}`,
        text:   ev.message,
        fields: [
          { title: 'Price',  value: `$${ev.price}`,                   short: true },
          { title: 'Change', value: `${ev.changePct?.toFixed(2)}%`,   short: true },
          { title: 'RVOL',   value: `${ev.rvol?.toFixed(2) ?? '—'}`,  short: true },
          { title: 'DSL',    value: `\`${ev.when}\``,                 short: false },
        ],
        footer: 'DailyTickers Alert',
        ts:     Math.floor(Date.now() / 1000),
      }]
    })
  });
}

async function notifyDesktop(ev) {
  try {
    const notifier = (await import('node-notifier')).default;
    notifier.notify({
      title:   `MW: ${ev.ticker} — ${ev.name}`,
      message: ev.message,
      sound:   true,
    });
  } catch { /* node-notifier optional */ }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isThrottled(alert) {
  return !!cache.get(`alert:throttle:${alert.id}`);
}

function defaultChannels() {
  const ch = _config.alerts?.channels || {};
  const active = Object.entries(ch).filter(([, v]) => v?.enabled).map(([k]) => k);
  return active.length ? active : ['desktop'];
}

function toPublic(alert) {
  if (!alert) return null;
  const { _fn, ...pub } = alert;  // strip compiled function from serialised output
  return pub;
}

// ─── Status ───────────────────────────────────────────────────────────────────

export function status() {
  const all    = [..._alerts.values()];
  const active = all.filter(a => a.status === 'active');
  return {
    total:         all.length,
    active:        active.length,
    triggered:     all.filter(a => a.status === 'triggered').length,
    paused:        all.filter(a => a.status === 'paused').length,
    historyCount:  _history.length,
    recentErrors:  _errors.slice(-5),
    channels:      defaultChannels(),
  };
}
