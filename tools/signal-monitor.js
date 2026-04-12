#!/usr/bin/env node
'use strict';

/**
 * signal-monitor.js — Live price monitor + Telegram alerts
 *
 * Polls Yahoo Finance for current positions across all 3 modes.
 * Detects: SL hits, TP1/TP2 hits, rotation eligibility, horizon expiry.
 * Sends Telegram alerts ONLY on state transitions (deduped via state file).
 *
 * Usage:
 *   node tools/signal-monitor.js              # Run once (cron mode)
 *   node tools/signal-monitor.js --loop       # Poll every 30s during hours, 5m outside
 *   node tools/signal-monitor.js --dry-run    # No Telegram, print to stdout
 *   node tools/signal-monitor.js --interval 60  # Override poll interval (seconds)
 *
 * Cron (weekdays, market hours 9:25-16:05 ET):
 *   25-59/5 13-14 * * 1-5    node /path/to/signal-monitor.js
 *   0/5     14-20 * * 1-5    node /path/to/signal-monitor.js
 *   0-5/5   20    * * 1-5    node /path/to/signal-monitor.js
 *
 * Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID in .env
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const STATE_FILE = path.join(ROOT, 'data', 'signal-monitor-state.json');
const MODES_CFG = path.join(ROOT, 'data', 'modes-config.json');
const HISTORY_DIR = path.join(ROOT, 'scanner', 'status', 'history');

// ATR cache: { [ticker]: { atr: number, ts: number } }
const atrCache = {};

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
const LOOP = process.argv.includes('--loop');

// --interval N override (seconds)
let INTERVAL_OVERRIDE = null;
const idxInterval = process.argv.indexOf('--interval');
if (idxInterval !== -1 && process.argv[idxInterval + 1]) {
  const n = parseInt(process.argv[idxInterval + 1], 10);
  if (n > 0) INTERVAL_OVERRIDE = n * 1000;
}

const POLL_IN_HOURS_MS = 30 * 1000;       // 30s during market hours
const POLL_OUT_HOURS_MS = 5 * 60 * 1000;  // 5min outside market hours

// ─── Market hours check ───────────────────────────────────────────────────────

function isMarketHours() {
  const now = new Date();
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return utcMinutes >= 13 * 60 + 25 && utcMinutes <= 20 * 60 + 5;
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

// ─── Price fetching ───────────────────────────────────────────────────────────

/**
 * Fetch current price + intraday high/low for a single ticker.
 * Uses meta.regularMarketDayHigh / meta.regularMarketDayLow for correct intraday extremes.
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
      // Use meta fields for correct intraday extremes
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

// ─── Core: evaluate all positions ─────────────────────────────────────────────

async function evaluate() {
  const modes = loadModes();
  const snap = loadLatestSnapshot();
  if (!snap) { console.log('No snapshot found'); return; }

  const state = loadState();
  const newState = { ...state, _version: 1, _lastRun: new Date().toISOString() };
  const alerts = [];

  // Collect all tickers needing prices
  const allTickers = [];
  for (const modeSnap of Object.values(snap.modes)) {
    for (const p of (modeSnap.positions || [])) allTickers.push(p.ticker);
    for (const s of (modeSnap.signals || [])) allTickers.push(s.ticker);
  }

  const uniqueTickers = [...new Set(allTickers)];
  console.log(`[${new Date().toISOString()}] Fetching prices for ${uniqueTickers.length} tickers...`);
  const prices = await fetchPricesParallel(uniqueTickers);

  // Check if we need to initialize state (first run with existing positions)
  const isFirstRun = Object.keys(state).filter(k => !k.startsWith('_')).length === 0;

  for (const [modeId, cfg] of Object.entries(modes)) {
    const modeSnap = snap.modes[modeId];
    if (!modeSnap) continue;
    const modeLabel = cfg.label || modeId;
    const positions = modeSnap.positions || [];
    const signals = modeSnap.signals || [];

    // ── Check each position ──
    for (const pos of positions) {
      const priceData = prices[pos.ticker];
      if (!priceData || !priceData.price) continue;

      const { price, dayLow, dayHigh } = priceData;
      const entry = pos.entry || 0;
      const rawStop = pos.stop || 0;
      const tp1 = pos.tp1 || 0;
      const tp2 = pos.tp2 || null;
      const returnPct = entry > 0 ? ((price - entry) / entry * 100) : 0;
      const daysHeld = bizDaysHeld(pos.scan_date);
      const daysLeft = Math.max(0, cfg.horizon - daysHeld);
      const stateKey = `${modeId}:${pos.ticker}:${pos.scan_date}`;
      const prev = state[stateKey] || {};

      // Fetch ATR for stop computation (cached)
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
        // If already partial, check TP2 on subsequent polls
        if (partialClosed && tp2 && dayHigh >= tp2) {
          status = 'TP2_HIT';
        } else if (partialClosed) {
          // Still open, monitoring for TP2
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
        continue;
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

    // ── Check rotation eligibility ──
    if (cfg.rotation !== 'none' && positions.length >= cfg.portfolioSize) {
      const rotLimit = cfg.rotation === 'daily_max1' ? 1
        : cfg.rotation === 'daily_max2' ? 2
          : cfg.portfolioSize;
      const margin = (cfg.rotation === 'aggressive') ? 0 : 5;
      const openTickers = new Set(positions.map(p => p.ticker));
      const eligible = signals
        .filter(s => !openTickers.has(s.ticker) && s.score >= (cfg.minScore || 85))
        .sort((a, b) => b.score - a.score);

      // Build sorted positions by live return (ascending = worst first)
      const posWithReturn = positions
        .map(p => {
          const pd = prices[p.ticker];
          if (!pd || !pd.price) return null;
          const ret = p.entry > 0 ? ((pd.price - p.entry) / p.entry * 100) : 0;
          return { ...p, liveReturn: ret, livePrice: pd.price };
        })
        .filter(Boolean)
        .sort((a, b) => a.liveReturn - b.liveReturn);

      let rotationsGenerated = 0;
      for (const best of eligible) {
        if (rotationsGenerated >= rotLimit) break;
        if (posWithReturn.length === 0) break;

        const worstPos = posWithReturn[rotationsGenerated]; // next-worst for each slot
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
          alerts.push({
            priority: 2,
            critical: false,
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
    console.log(`[${new Date().toISOString()}] No transitions detected. All positions stable.`);
  } else {
    console.log(`[${new Date().toISOString()}] ${alerts.length} alert(s) to send.`);
    for (const a of alerts) {
      await sendTelegram(a.text, 72, a.critical);
    }
  }

  saveState(newState);
  console.log(`State saved (${Object.keys(newState).filter(k => !k.startsWith('_')).length} position entries).`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (LOOP) {
    const inHours = isMarketHours();
    console.log(`Loop mode started. Market ${inHours ? 'OPEN' : 'CLOSED'}. ` +
      `Polling every ${inHours ? POLL_IN_HOURS_MS / 1000 : POLL_OUT_HOURS_MS / 1000}s. Ctrl+C to stop.`);

    const tick = async () => {
      const open = isMarketHours();
      if (!open && !DRY_RUN) {
        const now = new Date();
        console.log(`[${now.toISOString()}] Market closed — skipping evaluate(). ` +
          `Next check in ${POLL_OUT_HOURS_MS / 1000}s.`);
      } else {
        await evaluate();
      }
      const interval = INTERVAL_OVERRIDE ?? (isMarketHours() ? POLL_IN_HOURS_MS : POLL_OUT_HOURS_MS);
      setTimeout(tick, interval);
    };

    await tick();
    return;
  }

  // Single-shot mode: skip if market closed (unless --dry-run)
  if (!DRY_RUN) {
    const now = new Date();
    const day = now.getUTCDay();
    if (day === 0 || day === 6 || !isMarketHours()) {
      const h = now.getUTCHours();
      const m = now.getUTCMinutes();
      console.log(`Market closed (UTC ${h}:${String(m).padStart(2, '0')}, day ${day}). Use --dry-run to force or --loop for continuous mode.`);
      return;
    }
  }

  await evaluate();
}

main().catch(e => { console.error(e); process.exit(1); });
