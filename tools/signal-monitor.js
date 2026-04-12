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
 *   node tools/signal-monitor.js --loop       # Poll every 5min (daemon mode)
 *   node tools/signal-monitor.js --dry-run    # No Telegram, print to stdout
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
const POSITIONS_FILE = path.join(ROOT, 'data', 'scanner-positions.json');
const HISTORY_DIR = path.join(ROOT, 'scanner', 'status', 'history');

// ─── Load .env ────────────────────────────────────────────────────────────────
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const DRY_RUN = process.argv.includes('--dry-run');
const LOOP = process.argv.includes('--loop');
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fetchPrice(ticker) {
  return new Promise((resolve) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=2d`;
    const opts = { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 };
    https.get(url, opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          const result = j?.chart?.result?.[0];
          const price = result?.meta?.regularMarketPrice ?? null;
          const dayHigh = result?.indicators?.quote?.[0]?.high?.slice(-1)?.[0] ?? price;
          const dayLow = result?.indicators?.quote?.[0]?.low?.slice(-1)?.[0] ?? price;
          resolve({ price, dayHigh, dayLow });
        } catch { resolve({ price: null, dayHigh: null, dayLow: null }); }
      });
    }).on('error', () => resolve({ price: null, dayHigh: null, dayLow: null }))
      .on('timeout', () => resolve({ price: null, dayHigh: null, dayLow: null }));
  });
}

function fetchPricesParallel(tickers) {
  const unique = [...new Set(tickers)];
  return Promise.all(unique.map(t => fetchPrice(t).then(p => [t, p])))
    .then(pairs => Object.fromEntries(pairs));
}

function bizDaysHeld(scanDate) {
  if (!scanDate) return 0;
  const age = Math.round((Date.now() - new Date(scanDate + 'T12:00:00Z')) / 86400000);
  return Math.round(age * 5 / 7);
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return {}; }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function sendTelegram(text, topicId) {
  if (DRY_RUN) {
    console.log('[DRY-RUN] Would send:\n' + text + '\n---');
    return Promise.resolve();
  }
  if (!BOT_TOKEN || !CHAT_ID) {
    console.log('[SKIP] No Telegram config:\n' + text);
    return Promise.resolve();
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
        if (res.statusCode !== 200) console.error(`Telegram ${res.statusCode}: ${d.slice(0, 200)}`);
        resolve();
      });
    });
    req.on('error', (e) => { console.error('Telegram error:', e.message); resolve(); });
    req.write(body);
    req.end();
  });
}

// ─── Load mode data from latest snapshot ──────────────────────────────────────

function loadLatestSnapshot() {
  const files = fs.readdirSync(HISTORY_DIR).filter(f => /^\d{8}\.json$/.test(f)).sort();
  if (!files.length) return null;
  return JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, files[files.length - 1]), 'utf8'));
}

function loadModes() {
  try { return JSON.parse(fs.readFileSync(MODES_CFG, 'utf8')).modes; }
  catch { return {}; }
}

// ─── Core: evaluate all positions ─────────────────────────────────────────────

async function evaluate() {
  const modes = loadModes();
  const snap = loadLatestSnapshot();
  if (!snap) { console.log('No snapshot found'); return; }

  const state = loadState();
  const alerts = [];
  const newState = { ...state, _lastRun: new Date().toISOString() };

  // Collect all tickers needing prices
  const allTickers = [];
  for (const [modeId, modeSnap] of Object.entries(snap.modes)) {
    for (const p of (modeSnap.positions || [])) allTickers.push(p.ticker);
    for (const s of (modeSnap.signals || [])) allTickers.push(s.ticker);
  }

  console.log(`Fetching prices for ${[...new Set(allTickers)].length} tickers...`);
  const prices = await fetchPricesParallel(allTickers);

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
      const stop = pos.stop || 0;
      const tp1 = pos.tp1 || 0;
      const tp2 = pos.tp2 || null;
      const returnPct = entry > 0 ? ((price - entry) / entry * 100) : 0;
      const daysHeld = bizDaysHeld(pos.scan_date);
      const daysLeft = Math.max(0, cfg.horizon - daysHeld);

      // Clamp stop to mode's maxStopPct
      const clampedStop = (cfg.maxStopPct > 0 && entry > 0)
        ? Math.max(stop, +(entry * (1 - cfg.maxStopPct / 100)).toFixed(2))
        : stop;

      const stateKey = `${modeId}:${pos.ticker}:${pos.scan_date}`;
      const prev = state[stateKey] || {};

      let status = 'OPEN';
      if (dayLow <= clampedStop || price <= clampedStop) status = 'SL_HIT';
      else if (tp2 && dayHigh >= tp2) status = 'TP2_HIT';
      else if (tp1 > 0 && dayHigh >= tp1) status = 'TP1_HIT';
      else if (daysLeft <= 0) status = 'EXPIRED';
      else if (clampedStop > 0 && entry > 0 && ((price - clampedStop) / (entry - clampedStop)) < 0.3) status = 'NEAR_STOP';
      else if (tp1 > 0 && entry > 0 && ((price - entry) / (tp1 - entry)) > 0.8) status = 'NEAR_TP1';

      // Only alert on transitions
      if (prev.status !== status) {
        const emoji = {
          SL_HIT: '🔴', TP1_HIT: '🟢', TP2_HIT: '🏆', EXPIRED: '⏰',
          NEAR_STOP: '⚠️', NEAR_TP1: '📈', OPEN: '✅'
        }[status] || '📊';

        const actionMap = {
          SL_HIT: `CLOSE at market — loss ${returnPct.toFixed(2)}%`,
          TP1_HIT: cfg.partialTP
            ? `Sell ${Math.round((cfg.partialTPPct || 0.5) * 100)}%, trail rest to TP2`
            : `CLOSE at market — profit ${returnPct.toFixed(2)}%`,
          TP2_HIT: `CLOSE ALL — full target hit ${returnPct.toFixed(2)}%`,
          EXPIRED: `Horizon expired (${cfg.horizon}d) — close at open, P&L ${returnPct > 0 ? '+' : ''}${returnPct.toFixed(2)}%`,
          NEAR_STOP: `Price $${price.toFixed(2)} approaching stop $${clampedStop.toFixed(2)} — watch closely`,
          NEAR_TP1: `Price $${price.toFixed(2)} approaching TP1 $${tp1.toFixed(2)} — prepare exit`,
        };

        if (status !== 'OPEN') {
          alerts.push({
            priority: ['SL_HIT', 'TP2_HIT', 'TP1_HIT', 'EXPIRED'].includes(status) ? 1 : 2,
            text: `${emoji} <b>[${modeLabel}] ${status.replace('_', ' ')}</b>\n`
              + `<b>${pos.ticker}</b> @ $${price.toFixed(2)} (entry $${entry.toFixed(2)})\n`
              + `${actionMap[status] || ''}\n`
              + `Stop: $${clampedStop.toFixed(2)} | TP1: $${tp1.toFixed(2)}${tp2 ? ` | TP2: $${tp2.toFixed(2)}` : ''}\n`
              + `Held: ${daysHeld}d / ${cfg.horizon}d`,
          });
        }
      }

      newState[stateKey] = { status, price, returnPct: +returnPct.toFixed(2), ts: new Date().toISOString() };
    }

    // ── Check rotation eligibility ──
    if (cfg.rotation !== 'none' && positions.length >= cfg.portfolioSize) {
      const margin = cfg.rotation === 'aggressive' ? 0 : 5;
      const openTickers = new Set(positions.map(p => p.ticker));
      const eligible = signals.filter(s => !openTickers.has(s.ticker) && s.score >= (cfg.minScore || 85));

      // Find worst position (by live P&L)
      let worstPos = null;
      let worstReturn = Infinity;
      for (const p of positions) {
        const pd = prices[p.ticker];
        if (!pd || !pd.price) continue;
        const ret = p.entry > 0 ? ((pd.price - p.entry) / p.entry * 100) : 0;
        if (ret < worstReturn) { worstReturn = ret; worstPos = { ...p, liveReturn: ret, livePrice: pd.price }; }
      }

      if (worstPos && eligible.length > 0) {
        const best = eligible[0]; // signals already sorted by score desc
        const worstScore = worstPos.score || 0;
        const scoreDelta = best.score - worstScore;
        const meetsMargin = margin > 0 ? scoreDelta >= margin : (best.score >= 88 && worstReturn < 2);

        const rotKey = `${modeId}:rotation`;
        const prevRot = state[rotKey] || {};

        if (meetsMargin && prevRot.candidate !== best.ticker) {
          alerts.push({
            priority: 2,
            text: `🔄 <b>[${modeLabel}] ROTATION ELIGIBLE</b>\n`
              + `New: <b>${best.ticker}</b> (score ${best.score}) vs Worst: <b>${worstPos.ticker}</b> (score ${worstScore}, ${worstReturn > 0 ? '+' : ''}${worstReturn.toFixed(2)}%)\n`
              + `Delta: ${scoreDelta >= 0 ? '+' : ''}${scoreDelta} pts (threshold: ${margin || 'score≥88 & ret<2%'})\n`
              + `Action: Close ${worstPos.ticker} → Buy ${best.ticker} @ ${best.entry}`,
          });
          newState[rotKey] = { candidate: best.ticker, replaces: worstPos.ticker, ts: new Date().toISOString() };
        } else {
          newState[rotKey] = prevRot;
        }
      }
    }
  }

  // ── Send alerts ──
  alerts.sort((a, b) => a.priority - b.priority);
  if (alerts.length === 0) {
    console.log(`[${new Date().toISOString()}] No transitions detected. All positions stable.`);
  } else {
    console.log(`[${new Date().toISOString()}] ${alerts.length} alert(s) to send.`);
    for (const a of alerts) {
      await sendTelegram(a.text, 72); // topic 72 = Portfolio Live
    }
  }

  saveState(newState);
  console.log(`State saved (${Object.keys(newState).length} entries).`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Check if market is open (rough: weekday + between 13:25 and 20:05 UTC)
  const now = new Date();
  const day = now.getUTCDay();
  const h = now.getUTCHours();
  const m = now.getUTCMinutes();
  const utcMinutes = h * 60 + m;
  const marketOpen = day >= 1 && day <= 5 && utcMinutes >= 13 * 60 + 25 && utcMinutes <= 20 * 60 + 5;

  if (!marketOpen && !DRY_RUN && !LOOP) {
    console.log(`Market closed (UTC ${h}:${String(m).padStart(2, '0')}, day ${day}). Use --dry-run to force.`);
    return;
  }

  await evaluate();

  if (LOOP) {
    console.log(`\nLoop mode: polling every ${POLL_INTERVAL_MS / 1000}s. Ctrl+C to stop.`);
    setInterval(evaluate, POLL_INTERVAL_MS);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
