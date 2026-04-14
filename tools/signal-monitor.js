#!/usr/bin/env node
'use strict';

/**
 * signal-monitor.js — Live price monitor + Telegram alerts (WebSocket edition)
 *
 * Connects to Yahoo Finance WebSocket streamer for real-time price ticks.
 * Detects: SL hits, TP1/TP2 hits, rotation eligibility, horizon expiry.
 * Sends Telegram alerts ONLY on state transitions (deduped via state file).
 *
 * Usage:
 *   node tools/signal-monitor.js              # WebSocket continuous mode (default)
 *   node tools/signal-monitor.js --loop       # Same as default (backward compat)
 *   node tools/signal-monitor.js --once       # Single evaluation then exit (cron mode)
 *   node tools/signal-monitor.js --dry-run    # No Telegram, print to stdout
 *
 * Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID in .env
 */

const fs = require('fs');
const https = require('https');
const path = require('path');
const WebSocket = require('ws');
const protobuf = require('protobufjs');

const ROOT = path.join(__dirname, '..');
const STATE_FILE = path.join(ROOT, 'data', 'signal-monitor-state.json');
const MODES_CFG = path.join(ROOT, 'data', 'modes-config.json');
const HISTORY_DIR = path.join(ROOT, 'scanner', 'status', 'history');
const PROTO_FILE = path.join(__dirname, 'PricingData.proto');

const WS_URL = 'wss://streamer.finance.yahoo.com/';
const HEARTBEAT_INTERVAL_MS = 15 * 1000;       // Re-subscribe every 15s
const FULL_EVAL_INTERVAL_MS = 60 * 1000;        // Full sweep every 60s safety net
const RECONNECT_BASE_MS = 3000;                 // Initial backoff
const RECONNECT_MAX_MS = 60 * 1000;             // Max backoff

// ATR cache: { [ticker]: { atr: number, ts: number } }
const atrCache = {};

// Live price cache updated by WebSocket ticks
// { [ticker]: { price, dayHigh, dayLow, dayVolume, changePercent, marketHours, ts } }
const liveCache = {};

// ─── Load .env (robust parser) ────────────────────────────────────────────────
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Za-z_]\w*)=\s*(?:"([^"]*)"|'([^']*)'|([^#\n]*))/);
    if (m) process.env[m[1]] = (m[2] ?? m[3] ?? m[4] ?? '').trim();
  }
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const DRY_RUN = process.argv.includes('--dry-run');
const ONCE = process.argv.includes('--once');
// --loop is now identical to default (WS continuous); kept for backward compat

// ─── Per-mode Telegram topic routing ─────────────────────────────────────────
// Alias vars (TELEGRAM_TOPIC_DYNAMIC etc.) take precedence over legacy names.
const TOPICS = {
  portfolio: parseInt(process.env.TELEGRAM_TOPIC_PORTFOLIO || '72', 10),
  turbo:     parseInt(process.env.TELEGRAM_TOPIC_TURBO     || process.env.TELEGRAM_TOPIC_GROWTH       || '89', 10),
  dynamic:   parseInt(process.env.TELEGRAM_TOPIC_DYNAMIC   || process.env.TELEGRAM_TOPIC_GROWTH       || '89', 10),
  balanced:  parseInt(process.env.TELEGRAM_TOPIC_BALANCED  || process.env.TELEGRAM_TOPIC_CALMAR       || '90', 10),
  secured:   parseInt(process.env.TELEGRAM_TOPIC_SECURED   || process.env.TELEGRAM_TOPIC_CONSERVATIVE || '91', 10),
  fortress:  parseInt(process.env.TELEGRAM_TOPIC_FORTRESS  || process.env.TELEGRAM_TOPIC_CONSERVATIVE || '91', 10),
};

// ─── Discord webhook URLs per mode ───────────────────────────────────────────
const DISCORD_WEBHOOKS = {
  global:   process.env.DISCORD_WEBHOOK_SIGNALS           || '',
  turbo:    process.env.DISCORD_WEBHOOK_SIGNALS_TURBO     || '',
  dynamic:  process.env.DISCORD_WEBHOOK_SIGNALS_DYNAMIC   || '',
  balanced: process.env.DISCORD_WEBHOOK_SIGNALS_BALANCED  || '',
  secured:  process.env.DISCORD_WEBHOOK_SIGNALS_SECURED   || '',
  fortress: process.env.DISCORD_WEBHOOK_SIGNALS_FORTRESS  || '',
};

// Status → Discord embed color (decimal)
const DISCORD_COLORS = {
  SL_HIT:      15548997, // red
  TP1_HIT:     5763719,  // green
  TP2_HIT:     5763719,  // green
  TP1_PARTIAL: 5763719,  // green
  EXPIRED:     16744448, // orange
  NEAR_STOP:   16766720, // gold
  NEAR_TP1:    16766720, // gold
  ROTATION:    16744448, // orange
};

// ─── Market hours check (UTC-based, NYSE 9:30-16:00 ET = 13:30-20:00 UTC) ────

function isMarketHours() {
  const now = new Date();
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return utcMinutes >= 13 * 60 + 25 && utcMinutes <= 20 * 60 + 5;
}

// ─── Heartbeat — market open/close status messages ──────────────────────────

const HEARTBEAT_STATE = { lastOpenBeat: null, lastCloseBeat: null };

function buildHeartbeatMessage(type) {
  const now = new Date();
  const ts = now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const snap = loadLatestSnapshot();
  const modes = loadModes();
  const state = loadState();

  // Count positions per mode
  let totalPositions = 0;
  const modeLines = [];
  for (const [modeId, cfg] of Object.entries(modes)) {
    const modeSnap = snap?.modes?.[modeId];
    const positions = modeSnap?.positions || [];
    totalPositions += positions.length;
    const posStr = positions.map(p => p.ticker).join(', ') || '—';
    modeLines.push(`  <b>${cfg.label || modeId}</b>: ${positions.length} pos [${posStr}]`);
  }

  // Count today's alerts from state
  const todayKey = now.toISOString().slice(0, 10);
  const todayAlerts = Object.keys(state).filter(k =>
    !k.startsWith('_') && state[k]?.lastAlert?.startsWith?.(todayKey)
  ).length;

  const tickers = snap ? [...collectAllTickers(snap)] : [];
  const wsStatus = Object.keys(liveCache).length;
  const uptime = process.uptime();
  const uptimeStr = uptime > 3600
    ? `${Math.floor(uptime / 3600)}h${Math.floor((uptime % 3600) / 60)}m`
    : `${Math.floor(uptime / 60)}m`;

  const emoji = type === 'open' ? '🔔' : '🔕';
  const label = type === 'open' ? 'MARKET OPEN' : 'MARKET CLOSE';

  return `${emoji} <b>Signal Monitor — ${label}</b>\n`
    + `${ts}\n\n`
    + `📡 WebSocket: ${wsStatus}/${tickers.length} tickers cached\n`
    + `⏱ Uptime: ${uptimeStr}\n`
    + `📊 Positions: ${totalPositions} across ${Object.keys(modes).length} modes\n`
    + `🔔 Alerts today: ${todayAlerts}\n\n`
    + modeLines.join('\n');
}

async function checkHeartbeat() {
  const now = new Date();
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return; // Skip weekends

  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const today = now.toISOString().slice(0, 10);

  // Market open heartbeat: 13:30-13:32 UTC (9:30 ET)
  if (utcMinutes >= 810 && utcMinutes <= 812 && HEARTBEAT_STATE.lastOpenBeat !== today) {
    HEARTBEAT_STATE.lastOpenBeat = today;
    const msg = buildHeartbeatMessage('open');
    console.log(`[${now.toISOString()}] Sending market open heartbeat`);
    // Send to global Telegram + Discord
    sendTelegram(msg, TOPICS.portfolio, false).catch(e => console.error('[heartbeat] tg error:', e.message));
    if (DISCORD_WEBHOOKS.global) {
      sendDiscord(DISCORD_WEBHOOKS.global, '🔔 Signal Monitor — MARKET OPEN', htmlToDiscord(msg), 3066993, false)
        .catch(e => console.error('[heartbeat] discord error:', e.message));
    }
  }

  // Market close heartbeat: 20:00-20:02 UTC (16:00 ET)
  if (utcMinutes >= 1200 && utcMinutes <= 1202 && HEARTBEAT_STATE.lastCloseBeat !== today) {
    HEARTBEAT_STATE.lastCloseBeat = today;
    const msg = buildHeartbeatMessage('close');
    console.log(`[${now.toISOString()}] Sending market close heartbeat`);
    sendTelegram(msg, TOPICS.portfolio, false).catch(e => console.error('[heartbeat] tg error:', e.message));
    if (DISCORD_WEBHOOKS.global) {
      sendDiscord(DISCORD_WEBHOOKS.global, '🔕 Signal Monitor — MARKET CLOSE', htmlToDiscord(msg), 9807270, false)
        .catch(e => console.error('[heartbeat] discord error:', e.message));
    }
  }
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function httpsGet(url, timeoutMs) {
  return new Promise((resolve) => {
    const opts = { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: timeoutMs || 10000 };
    const req = https.get(url, opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ ok: res.statusCode === 200, body: data, status: res.statusCode }));
    });
    req.on('error', () => resolve({ ok: false, body: '', status: 0 }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, body: '', status: 0 }); });
  });
}

function httpsPost(urlStr, bodyObj, timeoutMs) {
  return new Promise((resolve) => {
    const bodyStr = JSON.stringify(bodyObj);
    const parsed = new URL(urlStr);
    const opts = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'User-Agent': 'signal-monitor/1.0',
      },
      timeout: timeoutMs || 10000,
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body: data }));
    });
    req.on('error', () => resolve({ ok: false, status: 0, body: '' }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, body: '' }); });
    req.write(bodyStr);
    req.end();
  });
}

// ─── Price fetching (HTTP fallback + ATR) ─────────────────────────────────────

/**
 * Fetch current price + intraday high/low for a single ticker via HTTP.
 * Used as fallback when WS cache is stale, and for initial price seeding.
 */
function fetchPrice(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=2d`;
  return httpsGet(url, 10000).then(({ ok, body }) => {
    if (!ok) return { price: null, dayHigh: null, dayLow: null };
    try {
      const j = JSON.parse(body);
      const result = j?.chart?.result?.[0];
      if (!result) return { price: null, dayHigh: null, dayLow: null };
      const meta = result.meta || {};
      const price = meta.regularMarketPrice ?? null;
      const dayHigh = meta.regularMarketDayHigh ?? price;
      const dayLow = meta.regularMarketDayLow ?? price;
      return { price, dayHigh, dayLow };
    } catch {
      return { price: null, dayHigh: null, dayLow: null };
    }
  });
}

function fetchPricesParallel(tickers) {
  const unique = [...new Set(tickers)];
  return Promise.all(unique.map(t => fetchPrice(t).then(p => [t, p])))
    .then(pairs => Object.fromEntries(pairs));
}

// ─── ATR calculation (cached per ticker, 1h TTL) ──────────────────────────────

function computeATRFromHistory(history) {
  const dates = Object.keys(history).sort().slice(-16); // 15 periods + 1 prev
  if (dates.length < 2) return null;
  let sum = 0, count = 0;
  for (let i = 1; i < dates.length; i++) {
    const prev = history[dates[i - 1]];
    const cur = history[dates[i]];
    if (!prev || !cur) continue;
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close),
    );
    sum += tr;
    count++;
  }
  return count > 0 ? sum / count : null;
}

async function getATR(ticker) {
  const cached = atrCache[ticker];
  if (cached && Date.now() - cached.ts < 3600 * 1000) return cached.atr;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=30d`;
  const { ok, body } = await httpsGet(url, 12000);
  if (!ok) return null;
  try {
    const j = JSON.parse(body);
    const result = j?.chart?.result?.[0];
    if (!result) return null;
    const timestamps = result.timestamp || [];
    const q = result.indicators?.quote?.[0] || {};
    const history = {};
    for (let i = 0; i < timestamps.length; i++) {
      const ds = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
      if (q.open?.[i] != null && q.high?.[i] != null && q.low?.[i] != null && q.close?.[i] != null) {
        history[ds] = { open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i] };
      }
    }
    const atr = computeATRFromHistory(history);
    atrCache[ticker] = { atr, ts: Date.now() };
    return atr;
  } catch {
    return null;
  }
}

// ─── Stop computation (ported from sweep.js simulateTrade) ───────────────────

/**
 * Compute the initial clamped stop for a position.
 * Returns the tightest of: original stop, maxStopPct cap, ATR-based stop.
 * atr may be null — in that case ATR step is skipped.
 */
function computeInitialStop(entry, rawStop, cfg, atr) {
  let risk = entry - rawStop;
  if (risk <= 0) risk = entry * 0.03; // fallback 3%

  // maxStopPct hard cap
  if (cfg.maxStopPct > 0) {
    const maxRisk = entry * (cfg.maxStopPct / 100);
    if (risk > maxRisk) risk = maxRisk;
  }

  // ATR-based stop: use tightest of current risk and N*ATR
  if (cfg.atrStopMult > 0 && atr) {
    const atrRisk = atr * cfg.atrStopMult;
    if (atrRisk < risk) risk = atrRisk;
  }

  return +(entry - risk).toFixed(4);
}

/**
 * Update stop and highWaterMark based on live price.
 * Returns { currentStop, highWaterMark }.
 */
function updateStopDynamic(entry, currentStop, highWaterMark, price, cfg, partialClosed) {
  let stop = currentStop;
  let hwm = highWaterMark;

  // Update high water mark
  if (price > hwm) hwm = price;

  // Breakeven: after +breakevenPct% gain, move stop to entry
  if (cfg.breakevenPct > 0) {
    const gainPct = (price - entry) / entry * 100;
    if (gainPct >= cfg.breakevenPct && entry > stop) {
      stop = entry;
    }
  }

  // Daily trailing stop: trail stop up when price makes new high
  // newStop = highWaterMark * (1 - dailyTrailPct/100)
  if (cfg.dailyTrailPct > 0) {
    const trailLevel = hwm * (1 - cfg.dailyTrailPct / 100);
    if (trailLevel > stop) stop = trailLevel;
  }

  // Trailing stop after TP1 partial: move to entry + trail at 1.5R
  if (cfg.trailingStop && partialClosed) {
    if (entry > stop) stop = entry; // move to breakeven
    // trail at 1.5R from hwm
    const riskUnit = entry - currentStop;
    if (riskUnit > 0) {
      const trailLevel = hwm - riskUnit * 1.5;
      if (trailLevel > stop) stop = trailLevel;
    }
  }

  return { currentStop: +stop.toFixed(4), highWaterMark: +hwm.toFixed(4) };
}

// ─── Business days helper ─────────────────────────────────────────────────────

function bizDaysHeld(scanDate) {
  if (!scanDate) return 0;
  const age = Math.round((Date.now() - new Date(scanDate + 'T12:00:00Z')) / 86400000);
  return Math.round(age * 5 / 7);
}

// ─── State persistence (atomic write) ────────────────────────────────────────

function loadState() {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (raw && typeof raw === 'object') return raw;
  } catch { /* ignore */ }
  return {};
}

function saveState(state) {
  const tmp = STATE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, STATE_FILE);
}

// ─── Load latest snapshot (with fallback to 3 most recent) ───────────────────

function loadLatestSnapshot() {
  const files = fs.readdirSync(HISTORY_DIR)
    .filter(f => /^\d{8}\.json$/.test(f))
    .sort()
    .reverse()
    .slice(0, 3); // try up to 3 most recent

  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, f), 'utf8'));
      if (data && data.modes) return data;
    } catch { /* corrupt, try next */ }
  }
  return null;
}

function loadModes() {
  try { return JSON.parse(fs.readFileSync(MODES_CFG, 'utf8')).modes; }
  catch { return {}; }
}

// ─── Collect all tickers from snapshot ───────────────────────────────────────

function collectAllTickers(snap) {
  const tickers = new Set();
  if (!snap) return tickers;
  for (const modeSnap of Object.values(snap.modes)) {
    for (const p of (modeSnap.positions || [])) tickers.add(p.ticker);
    for (const s of (modeSnap.signals || [])) tickers.add(s.ticker);
  }
  return tickers;
}

// ─── Telegram with retry for critical alerts ──────────────────────────────────

function sendTelegramOnce(text, topicId) {
  if (DRY_RUN) {
    console.log('[DRY-RUN] Would send:\n' + text + '\n---');
    return Promise.resolve(true);
  }
  if (!BOT_TOKEN || !CHAT_ID) {
    console.log('[SKIP] No Telegram config:\n' + text);
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const body = JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: 'HTML',
      message_thread_id: topicId || undefined,
      disable_web_page_preview: true,
    });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 10000,
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          console.error(`Telegram ${res.statusCode}: ${d.slice(0, 200)}`);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
    req.on('error', (e) => { console.error('Telegram error:', e.message); resolve(false); });
    req.write(body);
    req.end();
  });
}

async function sendTelegram(text, topicId, critical) {
  const ok = await sendTelegramOnce(text, topicId);
  if (!ok && critical) {
    // Single retry after 5s for SL_HIT / TP_HIT
    await new Promise(r => setTimeout(r, 5000));
    const ok2 = await sendTelegramOnce(text, topicId);
    if (!ok2) console.error('[FAIL] Telegram retry also failed for:', text.slice(0, 80));
  }
}

// ─── Discord helpers ──────────────────────────────────────────────────────────

/**
 * Convert HTML Telegram markup to Discord markdown (best-effort).
 * <b>text</b> → **text** ; <i>text</i> → text (stripped tags, text kept)
 */
function htmlToDiscord(html) {
  return html
    .replace(/<b>([\s\S]*?)<\/b>/g, '**$1**')
    .replace(/<\/?i>/g, '')
    .replace(/<[^>]+>/g, ''); // strip any remaining tags
}

function sendDiscordOnce(webhookUrl, title, description, color) {
  if (!webhookUrl) return Promise.resolve(true);
  if (DRY_RUN) {
    console.log(`[DRY-RUN] Discord webhook: ${title}\n${description}\n---`);
    return Promise.resolve(true);
  }
  const body = {
    embeds: [{
      title,
      description,
      color,
      footer: { text: `Signal Monitor • ${new Date().toISOString()}` },
    }],
  };
  return httpsPost(webhookUrl, body, 10000).then(({ ok, status }) => {
    if (!ok) console.error(`Discord webhook ${status}: ${webhookUrl.slice(0, 60)}...`);
    return ok;
  });
}

async function sendDiscord(webhookUrl, title, description, color, critical) {
  const ok = await sendDiscordOnce(webhookUrl, title, description, color);
  if (!ok && critical) {
    await new Promise(r => setTimeout(r, 5000));
    const ok2 = await sendDiscordOnce(webhookUrl, title, description, color);
    if (!ok2) console.error('[FAIL] Discord retry also failed for:', title);
  }
}

/**
 * Resolve the Telegram topic ID for a given modeId.
 * Falls back to the global portfolio topic if the mode is unknown.
 */
function topicForMode(modeId) {
  return TOPICS[modeId] ?? TOPICS.portfolio;
}

/**
 * Dispatch an alert to all 4 channels (fire-and-forget):
 *   1. Mode-specific Telegram topic
 *   2. Global Telegram topic (condensed 1-liner)
 *   3. Mode-specific Discord webhook
 *   4. Global Discord webhook (condensed 1-liner)
 * Missing webhook URLs are skipped silently.
 */
async function notifyAll(modeId, alert) {
  // Guard: never send empty/blank notifications
  if (!alert.text || alert.text.replace(/<[^>]+>/g, '').trim().length === 0) {
    console.error(`[notify] Skipping empty alert for ${modeId}:${alert.status}`);
    return;
  }

  const modeTopicId  = topicForMode(modeId);
  const globalTopicId = TOPICS.portfolio;
  const isCritical   = alert.critical;
  const color        = DISCORD_COLORS[alert.status] ?? 9807270; // grey default

  // Build condensed 1-line summary for global channels
  // Extract first non-empty line of alert text as summary
  const summaryLine = alert.text.split('\n').find(l => l.trim().length > 0) || alert.text;
  const discordFull = htmlToDiscord(alert.text);
  const discordSummary = htmlToDiscord(summaryLine);

  // Derive a clean title from the first line (strip emoji prefix for embed title)
  const titleClean = summaryLine.replace(/<[^>]+>/g, '').replace(/^[\s\S]{1,2}\s/, '').trim();

  // 1. Mode-specific Telegram (full message)
  sendTelegram(alert.text, modeTopicId, isCritical).catch(e => console.error('[notify] tg-mode error:', e.message));

  // 2. Global Telegram (condensed — only if mode topic differs from global)
  if (modeTopicId !== globalTopicId) {
    sendTelegram(summaryLine, globalTopicId, false).catch(e => console.error('[notify] tg-global error:', e.message));
  }

  // 3. Mode-specific Discord webhook
  const modeWebhook = DISCORD_WEBHOOKS[modeId] || '';
  if (modeWebhook) {
    sendDiscord(modeWebhook, titleClean, discordFull, color, isCritical)
      .catch(e => console.error('[notify] discord-mode error:', e.message));
  }

  // 4. Global Discord webhook (condensed — only if differs from mode webhook)
  if (DISCORD_WEBHOOKS.global && DISCORD_WEBHOOKS.global !== modeWebhook) {
    sendDiscord(DISCORD_WEBHOOKS.global, titleClean, discordSummary, color, false)
      .catch(e => console.error('[notify] discord-global error:', e.message));
  }
}

// ─── Core: evaluate all positions ─────────────────────────────────────────────

/**
 * Resolve price data for a ticker: prefer live WS cache, fall back to HTTP.
 * maxAgeMs: how stale the WS cache can be before we fall back (default 5min).
 */
async function resolvePriceData(ticker, maxAgeMs = 5 * 60 * 1000) {
  const cached = liveCache[ticker];
  if (cached && (Date.now() - cached.ts) < maxAgeMs) {
    return { price: cached.price, dayHigh: cached.dayHigh, dayLow: cached.dayLow };
  }
  // Fallback to HTTP
  return fetchPrice(ticker);
}

async function evaluatePosition(pos, modeId, cfg, state, newState, alerts, priceData, isFirstRun) {
  const { price, dayLow, dayHigh } = priceData;
  if (!price || isNaN(price) || price <= 0) return;

  const entry = pos.entry || 0;
  if (!entry || isNaN(entry) || entry <= 0) return;
  const rawStop = pos.stop || 0;
  const tp1 = pos.tp1 || 0;
  const tp2 = pos.tp2 || null;
  const returnPct = entry > 0 ? ((price - entry) / entry * 100) : 0;
  const daysHeld = bizDaysHeld(pos.scan_date);
  const daysLeft = Math.max(0, cfg.horizon - daysHeld);
  const stateKey = `${modeId}:${pos.ticker}:${pos.scan_date}`;
  const prev = state[stateKey] || {};
  const modeLabel = cfg.label || modeId;

  // Fetch ATR for stop computation (cached, HTTP)
  let atr = null;
  if (cfg.atrStopMult > 0) {
    atr = await getATR(pos.ticker);
  }

  // Compute initial clamped stop (first time seeing this position)
  const initialStop = computeInitialStop(entry, rawStop, cfg, atr);

  // Restore or initialize per-position live state
  const prevStop = prev.currentStop ?? initialStop;
  const prevHWM = prev.highWaterMark ?? entry;
  const partialClosed = prev.partialClosed ?? false;

  // Update stop based on current price
  const { currentStop, highWaterMark } = updateStopDynamic(
    entry, prevStop, prevHWM, price, cfg, partialClosed,
  );

  // Determine status
  let status = 'OPEN';
  if (dayLow <= currentStop || price <= currentStop) {
    status = 'SL_HIT';
  } else if (tp2 && dayHigh >= tp2) {
    status = 'TP2_HIT';
  } else if (tp1 > 0 && dayHigh >= tp1) {
    if (cfg.partialTP && !partialClosed) {
      status = 'TP1_PARTIAL';
    } else if (!partialClosed) {
      status = 'TP1_HIT';
    }
    // If already partial, check TP2 on subsequent ticks
    if (partialClosed && tp2 && dayHigh >= tp2) {
      status = 'TP2_HIT';
    } else if (partialClosed) {
      status = 'OPEN';
    }
  } else if (daysLeft <= 0) {
    status = 'EXPIRED';
  } else if (currentStop > 0 && entry > currentStop && ((price - currentStop) / (entry - currentStop)) < 0.3) {
    status = 'NEAR_STOP';
  } else if (tp1 > 0 && entry > 0 && tp1 > entry && ((price - entry) / (tp1 - entry)) > 0.8) {
    status = 'NEAR_TP1';
  }

  // On first run: initialize state without sending alerts
  if (isFirstRun) {
    newState[stateKey] = {
      status,
      price: +price.toFixed(4),
      returnPct: +returnPct.toFixed(2),
      currentStop,
      highWaterMark,
      partialClosed,
      ts: new Date().toISOString(),
    };
    return;
  }

  // Track partial TP state transition
  let newPartialClosed = partialClosed;
  if (status === 'TP1_PARTIAL' && !partialClosed) {
    newPartialClosed = true;
  }

  // Only alert on status transitions
  if (prev.status !== status && status !== 'OPEN') {
    const isCritical = ['SL_HIT', 'TP1_HIT', 'TP2_HIT', 'TP1_PARTIAL'].includes(status);
    const emoji = {
      SL_HIT: '🔴', TP1_HIT: '🟢', TP2_HIT: '🏆', TP1_PARTIAL: '💚',
      EXPIRED: '⏰', NEAR_STOP: '⚠️', NEAR_TP1: '📈',
    }[status] || '📊';

    const partialPct = Math.round((cfg.partialTPPct || 0.5) * 100);
    const actionMap = {
      SL_HIT: `CLOSE at market — loss ${returnPct.toFixed(2)}%`,
      TP1_HIT: `CLOSE at market — profit +${returnPct.toFixed(2)}%`,
      TP1_PARTIAL: `Sell ${partialPct}% @ $${tp1.toFixed(2)} — move stop to entry, trail rest to TP2`,
      TP2_HIT: `CLOSE ALL — full target hit +${returnPct.toFixed(2)}%`,
      EXPIRED: `Horizon expired (${cfg.horizon}d) — close at open, P&L ${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%`,
      NEAR_STOP: `Price $${price.toFixed(2)} approaching stop $${currentStop.toFixed(2)} — watch closely`,
      NEAR_TP1: `Price $${price.toFixed(2)} approaching TP1 $${tp1.toFixed(2)} — prepare exit`,
    };

    alerts.push({
      priority: isCritical ? 1 : 2,
      critical: isCritical,
      modeId,
      status,
      text: `${emoji} <b>[${modeLabel}] ${status.replace(/_/g, ' ')}</b>\n`
        + `<b>${pos.ticker}</b> @ $${price.toFixed(2)} (entry $${entry.toFixed(2)})\n`
        + `${actionMap[status] || ''}\n`
        + `Stop: $${currentStop.toFixed(2)} | TP1: $${tp1.toFixed(2)}${tp2 ? ` | TP2: $${tp2.toFixed(2)}` : ''}\n`
        + `Held: ${daysHeld}d / ${cfg.horizon}d | ATR stop: ${atr ? `$${(entry - cfg.atrStopMult * atr).toFixed(2)}` : 'n/a'}`,
    });
  }

  newState[stateKey] = {
    status,
    price: +price.toFixed(4),
    returnPct: +returnPct.toFixed(2),
    currentStop,
    highWaterMark,
    partialClosed: newPartialClosed,
    ts: new Date().toISOString(),
  };
}

async function evaluate(tickerFilter) {
  const modes = loadModes();
  const snap = loadLatestSnapshot();
  if (!snap) { console.log('No snapshot found'); return; }

  const state = loadState();
  const newState = { ...state, _version: 1, _lastRun: new Date().toISOString() };
  const alerts = [];

  const isFirstRun = Object.keys(state).filter(k => !k.startsWith('_')).length === 0;

  for (const [modeId, cfg] of Object.entries(modes)) {
    const modeSnap = snap.modes[modeId];
    if (!modeSnap) continue;
    const positions = modeSnap.positions || [];
    const signals = modeSnap.signals || [];

    // ── Check each position ──
    for (const pos of positions) {
      // If tickerFilter set (WS tick-driven), only evaluate that ticker
      if (tickerFilter && pos.ticker !== tickerFilter) continue;

      const priceData = await resolvePriceData(pos.ticker);
      if (!priceData || !priceData.price) continue;

      await evaluatePosition(pos, modeId, cfg, state, newState, alerts, priceData, isFirstRun);
    }

    // ── Check rotation eligibility (only on full sweep, not per-tick) ──
    if (!tickerFilter && cfg.rotation !== 'none' && positions.length >= cfg.portfolioSize) {
      const rotLimit = cfg.rotation === 'daily_max1' ? 1
        : cfg.rotation === 'daily_max2' ? 2
          : cfg.portfolioSize;
      const margin = (cfg.rotation === 'aggressive') ? 0 : 5;
      const openTickers = new Set(positions.map(p => p.ticker));
      const eligible = signals
        .filter(s => !openTickers.has(s.ticker) && s.score >= (cfg.minScore || 85))
        .sort((a, b) => b.score - a.score);

      // Build sorted positions by live return (ascending = worst first)
      const posWithReturn = (await Promise.all(
        positions.map(async p => {
          const pd = await resolvePriceData(p.ticker);
          if (!pd || !pd.price) return null;
          const ret = p.entry > 0 ? ((pd.price - p.entry) / p.entry * 100) : 0;
          return { ...p, liveReturn: ret, livePrice: pd.price };
        })
      )).filter(Boolean).sort((a, b) => a.liveReturn - b.liveReturn);

      let rotationsGenerated = 0;
      for (const best of eligible) {
        if (rotationsGenerated >= rotLimit) break;
        if (posWithReturn.length === 0) break;

        const worstPos = posWithReturn[rotationsGenerated];
        if (!worstPos) break;

        const worstScore = worstPos.score || 0;
        const scoreDelta = best.score - worstScore;

        let meetsMargin;
        if (cfg.rotation === 'aggressive') {
          meetsMargin = best.score >= 88 && worstPos.liveReturn < 2;
        } else {
          meetsMargin = scoreDelta >= margin;
        }

        const rotKey = `${modeId}:rotation:${rotationsGenerated}`;
        const prevRot = state[rotKey] || {};

        if (meetsMargin && prevRot.candidate !== best.ticker) {
          const modeLabel = cfg.label || modeId;
          alerts.push({
            priority: 2,
            critical: false,
            modeId,
            status: 'ROTATION',
            text: `🔄 <b>[${modeLabel}] ROTATION ELIGIBLE</b> (slot ${rotationsGenerated + 1}/${rotLimit})\n`
              + `New: <b>${best.ticker}</b> (score ${best.score}) vs Worst: <b>${worstPos.ticker}</b> (score ${worstScore}, ${worstPos.liveReturn >= 0 ? '+' : ''}${worstPos.liveReturn.toFixed(2)}%)\n`
              + `Delta: ${scoreDelta >= 0 ? '+' : ''}${scoreDelta} pts (threshold: ${margin || 'score≥88 & ret<2%'})\n`
              + `Action: Close ${worstPos.ticker} → Buy ${best.ticker} @ ${best.entry}`,
          });
          newState[rotKey] = { candidate: best.ticker, replaces: worstPos.ticker, ts: new Date().toISOString() };
        } else {
          newState[rotKey] = prevRot;
        }

        rotationsGenerated++;
      }
    }
  }

  // ── Send alerts (sorted by priority) ──
  alerts.sort((a, b) => a.priority - b.priority);
  if (alerts.length === 0) {
    if (!tickerFilter) {
      console.log(`[${new Date().toISOString()}] No transitions detected. All positions stable.`);
    }
  } else {
    console.log(`[${new Date().toISOString()}] ${alerts.length} alert(s) to send.`);
    for (const a of alerts) {
      await notifyAll(a.modeId, a);
    }
  }

  saveState(newState);
  if (!tickerFilter) {
    console.log(`State saved (${Object.keys(newState).filter(k => !k.startsWith('_')).length} position entries).`);
  }
}

// ─── WebSocket manager ────────────────────────────────────────────────────────

class YahooStreamer {
  constructor(tickers) {
    this.tickers = [...tickers];
    this.ws = null;
    this.PricingData = null;          // protobuf type, loaded async
    this.heartbeatTimer = null;
    this.fullEvalTimer = null;
    this.reconnectDelay = RECONNECT_BASE_MS;
    this.stopped = false;
  }

  async loadProto() {
    const root = await protobuf.load(PROTO_FILE);
    this.PricingData = root.lookupType('yfinancedata');
  }

  decodeMessage(rawB64) {
    try {
      const buf = Buffer.from(rawB64, 'base64');
      return this.PricingData.decode(buf);
    } catch {
      return null;
    }
  }

  subscribe() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const msg = JSON.stringify({ subscribe: this.tickers });
    this.ws.send(msg);
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.subscribe();
    }, HEARTBEAT_INTERVAL_MS);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
  }

  startFullEvalTimer() {
    this.stopFullEvalTimer();
    this.fullEvalTimer = setInterval(async () => {
      try {
        await checkHeartbeat();
        // Skip full evaluation outside market hours (prevents 2am ghost alerts)
        if (!isMarketHours()) return;
        console.log(`[${new Date().toISOString()}] Full sweep (safety net)...`);
        await evaluate(null);
      } catch (e) {
        console.error('[EVAL ERROR]', e.message);
      }
    }, FULL_EVAL_INTERVAL_MS);
  }

  stopFullEvalTimer() {
    if (this.fullEvalTimer) { clearInterval(this.fullEvalTimer); this.fullEvalTimer = null; }
  }

  connect() {
    if (this.stopped) return;

    console.log(`[${new Date().toISOString()}] Connecting to ${WS_URL} (${this.tickers.length} tickers)...`);
    this.ws = new WebSocket(WS_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    this.ws.on('open', () => {
      console.log(`[${new Date().toISOString()}] WebSocket connected.`);
      this.reconnectDelay = RECONNECT_BASE_MS; // reset backoff on success
      this.subscribe();
      this.startHeartbeat();
      this.startFullEvalTimer();
    });

    this.ws.on('message', async (data) => {
      const rawB64 = data.toString();
      const msg = this.decodeMessage(rawB64);
      if (!msg) return;

      // Skip heartbeat messages (quoteType === 7 = HEARTBEAT)
      if (msg.quoteType === 7) return;

      const ticker = msg.id;
      if (!ticker) return;

      // Only process regular market hours ticks
      // marketHours: 0=PRE, 1=REGULAR, 2=POST, 3=EXTENDED
      if (msg.marketHours !== 1 && !DRY_RUN) return;

      const price = msg.price || 0;
      if (price <= 0) return;

      // Update live cache — merge with existing to preserve intraday high/low
      const prev = liveCache[ticker] || {};
      liveCache[ticker] = {
        price,
        dayHigh: Math.max(msg.dayHigh || price, prev.dayHigh || price),
        dayLow: msg.dayLow > 0
          ? (prev.dayLow > 0 ? Math.min(msg.dayLow, prev.dayLow) : msg.dayLow)
          : (prev.dayLow || price),
        dayVolume: msg.dayVolume || prev.dayVolume || 0,
        changePercent: msg.changePercent || prev.changePercent || 0,
        marketHours: msg.marketHours,
        ts: Date.now(),
      };

      // Immediate per-tick evaluation for this ticker
      try {
        await evaluate(ticker);
      } catch (e) {
        console.error(`[TICK EVAL ERROR] ${ticker}:`, e.message);
      }
    });

    this.ws.on('close', (code, reason) => {
      this.stopHeartbeat();
      this.stopFullEvalTimer();
      if (this.stopped) return;
      console.warn(`[${new Date().toISOString()}] WebSocket closed (${code}). Reconnecting in ${this.reconnectDelay / 1000}s...`);
      setTimeout(() => this.connect(), this.reconnectDelay);
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, RECONNECT_MAX_MS);
    });

    this.ws.on('error', (err) => {
      console.error(`[${new Date().toISOString()}] WebSocket error:`, err.message);
      // close event will fire after error, triggering reconnect
    });
  }

  stop() {
    this.stopped = true;
    this.stopHeartbeat();
    this.stopFullEvalTimer();
    if (this.ws) {
      this.ws.terminate();
      this.ws = null;
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // --once mode: single evaluation then exit (replaces old default cron behavior)
  if (ONCE) {
    if (!DRY_RUN) {
      const now = new Date();
      const day = now.getUTCDay();
      if (day === 0 || day === 6 || !isMarketHours()) {
        const h = now.getUTCHours();
        const m = now.getUTCMinutes();
        console.log(`Market closed (UTC ${h}:${String(m).padStart(2, '0')}, day ${day}). Use --dry-run to force or omit --once for WS mode.`);
        return;
      }
    }

    const snap = loadLatestSnapshot();
    if (!snap) { console.log('No snapshot found'); return; }
    const tickers = [...collectAllTickers(snap)];

    console.log(`[${new Date().toISOString()}] --once mode: fetching ${tickers.length} prices via HTTP...`);
    const prices = await fetchPricesParallel(tickers);

    // Seed live cache from HTTP fetch so evaluate() uses it
    for (const [ticker, data] of Object.entries(prices)) {
      if (data.price) {
        liveCache[ticker] = {
          price: data.price,
          dayHigh: data.dayHigh,
          dayLow: data.dayLow,
          ts: Date.now(),
        };
      }
    }

    await evaluate(null);
    return;
  }

  // WebSocket continuous mode (default, also --loop)
  const snap = loadLatestSnapshot();
  if (!snap) { console.log('No snapshot found — cannot start WS mode.'); return; }
  const tickers = [...collectAllTickers(snap)];

  if (tickers.length === 0) {
    console.log('No tickers in snapshot. Nothing to monitor.');
    return;
  }

  console.log(`[${new Date().toISOString()}] Starting WebSocket monitor for ${tickers.length} tickers.`);
  console.log(`Tickers: ${tickers.join(', ')}`);

  // Seed live cache with HTTP prices before WS connects (avoids stale-data fallback on first eval)
  console.log('Seeding initial prices via HTTP...');
  const initialPrices = await fetchPricesParallel(tickers);
  let seeded = 0;
  for (const [ticker, data] of Object.entries(initialPrices)) {
    if (data.price) {
      liveCache[ticker] = { price: data.price, dayHigh: data.dayHigh, dayLow: data.dayLow, ts: Date.now() };
      seeded++;
    }
  }
  console.log(`Seeded ${seeded}/${tickers.length} tickers. Connecting WebSocket...`);

  const streamer = new YahooStreamer(tickers);
  await streamer.loadProto();
  streamer.connect();

  // Graceful shutdown
  const shutdown = () => {
    console.log('\nShutting down...');
    streamer.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(e => { console.error(e); process.exit(1); });
