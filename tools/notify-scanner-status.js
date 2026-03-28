#!/usr/bin/env node
'use strict';

/**
 * notify-scanner-status.js
 * Envoie une notification synthétique après chaque scan :
 *   - Telegram (via Bot API)
 *   - Discord (via openclaw message send CLI)
 *
 * Usage:
 *   node tools/notify-scanner-status.js [YYYYMMDD]
 *
 * Env vars (.env) :
 *   TELEGRAM_BOT_TOKEN=...
 *   TELEGRAM_CHAT_ID=...
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── Load .env ───────────────────────────────────────────────────────────────
const ROOT = path.join(__dirname, '..');
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const DISCORD_CHANNEL = '1483382014588747778';
const STATUS_URL = 'https://articles.market-watch.xyz/scanner/status/';

// ─── Data helpers ─────────────────────────────────────────────────────────────
function bizDaysHeld(scanDate) {
  if (!scanDate) return 0;
  const age = Math.round((Date.now() - new Date(scanDate)) / 86400000);
  return Math.round(age * 5 / 7);
}

function getLatestScanDir() {
  const scannerDir = path.join(ROOT, 'scanner');
  return fs.readdirSync(scannerDir)
    .filter(d => /^\d{8}$/.test(d) && fs.existsSync(path.join(scannerDir, d, 'index.html')))
    .sort().reverse()[0] || null;
}

function formatDate(yyyymmdd) {
  if (!yyyymmdd) return '';
  return `${yyyymmdd.slice(6, 8)}/${yyyymmdd.slice(4, 6)}/${yyyymmdd.slice(0, 4)}`;
}

// ─── Reconstruct positions like gen-status-page.js ───────────────────────────
// Positions = premature (expired but holdDays < horizon) trades, enriched with live prices
function buildPositions(cfg, modeKey) {
  const modeMap = { growth: 'growth', calmar: 'calmar', zero: 'sharpe' };
  const allTrades = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/backtest-trades.json')));
  const livePositions = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/scanner-positions.json'))).open_positions || [];
  const liveLookup = {};
  for (const p of livePositions) liveLookup[p.ticker] = p;

  const raw = allTrades[modeMap[modeKey] || modeKey] || [];
  const trades = raw.map(t =>
    (t.status === 'expired' && t.holdDays < cfg.horizon) ? { ...t, _premature: true } : t
  );
  const pending = trades.filter(t => t._premature);

  return pending.map(t => {
    const live = liveLookup[t.ticker];
    const currentPrice = live ? live.current_price : (t.exitPrice || 0);
    const entry = t.actualEntry || 0;
    const ret = entry > 0 ? +((currentPrice - entry) / entry * 100).toFixed(2) : 0;
    const ageD = t.entryDate ? Math.round((new Date() - new Date(t.entryDate)) / 86400000) : 0;
    const left = Math.max(0, cfg.horizon - Math.round(ageD * 5 / 7));
    return {
      ticker: t.ticker,
      scan_date: t.scanDate,
      entry,
      current_price: currentPrice,
      return_pct: ret,
      stop: live ? live.stop : 0,
      tp1: live ? live.tp1 : 0,
      tp2: live ? (live.tp2 || null) : null,
      left,
    };
  }).sort((a, b) => b.return_pct - a.return_pct);
}

// ─── Build payload ────────────────────────────────────────────────────────────
function buildStatusPayload(scanDir) {
  const modesObj = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/modes-config.json'))).modes;
  const metrics = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/scanner-metrics.json')));
  const wl = JSON.parse(fs.readFileSync(path.join(ROOT, 'mcp/watchlist.json')));

  // Balanced = calmar
  const cfgRaw = modesObj.calmar;
  const cfg = { id: 'calmar', ...cfgRaw };

  // Active positions (same logic as gen-status-page.js)
  const activePos = buildPositions(cfg, 'calmar');

  // Expiring soon (left = 1)
  const expiring = activePos.filter(p => p.left === 1);

  // Scenario (weighted by alloc = 1/portfolioSize per position)
  const n = activePos.length || 1;
  const a = 1 / n;
  const worstPct = activePos.reduce((s, p) => s + (p.entry > 0 ? (p.stop - p.entry) / p.entry * 100 : 0) * a, 0);
  const bestPct = activePos.reduce((s, p) => {
    const tp = p.tp2 || p.tp1 || p.current_price;
    return s + (p.entry > 0 ? (tp - p.entry) / p.entry * 100 : 0) * a;
  }, 0);
  const nowPct = activePos.reduce((s, p) => s + (p.return_pct || 0) * a, 0);

  // Top signals (top 3, no Short Squeeze)
  const picks = (wl.picks || []).filter(s => !/short.?squeeze/i.test(s.strategy)).slice(0, 3);

  // Portfolio full?
  const slotsLeft = cfg.portfolioSize - activePos.length;

  return {
    scanDir,
    scanDate: formatDate(scanDir),
    cfg,
    metrics: {
      return30d: metrics.return_30d,
      dd: metrics.max_drawdown,
      wr: metrics.win_rate,
      pf: metrics.profit_factor,
    },
    activePos,
    expiring,
    worstPct,
    bestPct,
    nowPct,
    picks,
    slotsLeft,
  };
}

// ─── Scenario bar (ASCII, 20 chars) ──────────────────────────────────────────
function asciiBar(worstPct, nowPct, bestPct) {
  const BAR = 16;
  const range = bestPct - worstPct;
  const pos = range > 0 ? Math.round((nowPct - worstPct) / range * BAR) : Math.round(BAR / 2);
  const clamped = Math.max(0, Math.min(BAR, pos));
  const left = '▒'.repeat(clamped);
  const right = '░'.repeat(BAR - clamped);
  return left + '▲' + right;
}

// ─── Telegram message (HTML) ──────────────────────────────────────────────────
function buildTelegramMessage(d) {
  const sign = n => n >= 0 ? '+' : '';
  const posLines = d.activePos.map(p => {
    const warn = p.left <= 1 ? ' ⚠️' : '';
    return `  ${p.ticker.padEnd(5)} ${sign(p.return_pct)}${p.return_pct}%  ${p.left}j restant${warn}`;
  }).join('\n');

  const picksLines = d.picks.map(s =>
    `  ${s.symbol.padEnd(5)} ${s.score}  ${s.strategy.padEnd(12)} ${s.entry}→${s.tp1}/${s.tp2}  R/R ${s.rr}`
  ).join('\n');

  const bar = asciiBar(d.worstPct, d.nowPct, d.bestPct);
  const expiringWarn = d.expiring.length
    ? `\n⚠️ <b>Expire demain :</b> ${d.expiring.map(p => p.ticker).join(', ')}`
    : '';

  const ordersLine = d.slotsLeft > 0
    ? `\n⚡ <b>Orders :</b> ${d.slotsLeft} slot${d.slotsLeft > 1 ? 's' : ''} disponible${d.slotsLeft > 1 ? 's' : ''}`
    : '\n✅ <b>Orders :</b> Portfolio plein';

  return `📊 <b>Scanner Balanced — ${d.scanDate}</b>

📈 <b>Perf 30j :</b> ${sign(d.metrics.return30d)}${d.metrics.return30d}% | DD ${d.metrics.dd}% | WR ${d.metrics.wr}% | PF ${d.metrics.pf}x${ordersLine}${expiringWarn}

<b>Positions (${d.activePos.length}/${d.cfg.portfolioSize}) :</b>
<pre>${posLines}</pre>
<b>Scénario portefeuille :</b>
<pre>${sign(d.worstPct)}${d.worstPct.toFixed(1)}% ${bar} +${d.bestPct.toFixed(1)}%
         ▲ Maintenant : ${sign(d.nowPct)}${d.nowPct.toFixed(1)}%</pre>
<b>Top 3 signaux :</b>
<pre>${picksLines}</pre>
🔗 ${STATUS_URL}`;
}

// ─── Discord message (Markdown) ───────────────────────────────────────────────
function buildDiscordMessage(d) {
  const sign = n => n >= 0 ? '+' : '';

  const posLines = d.activePos.map(p => {
    const warn = p.left <= 1 ? ' ⚠️' : '';
    return `${p.ticker.padEnd(5)} ${(sign(p.return_pct) + p.return_pct + '%').padEnd(7)}  ${p.left}j restant${warn}`;
  }).join('\n');

  const picksLines = d.picks.map(s =>
    `${s.symbol.padEnd(5)} ${String(s.score).padEnd(3)}  ${s.strategy.padEnd(12)} ${String(s.entry).padEnd(6)}→ TP1 ${s.tp1}  TP2 ${s.tp2}  R/R ${s.rr}`
  ).join('\n');

  const bar = asciiBar(d.worstPct, d.nowPct, d.bestPct);
  const expiringWarn = d.expiring.length
    ? `\n⚠️ **Expire demain** : ${d.expiring.map(p => p.ticker).join(', ')}`
    : '';

  const ordersLine = d.slotsLeft > 0
    ? `\n⚡ **Orders** : ${d.slotsLeft} slot${d.slotsLeft > 1 ? 's' : ''} disponible${d.slotsLeft > 1 ? 's' : ''}`
    : '\n✅ **Orders** : Portfolio plein';

  return `📊 **Scanner Balanced — ${d.scanDate}**

**Perf 30j** → ${sign(d.metrics.return30d)}${d.metrics.return30d}% | DD ${d.metrics.dd}% | WR ${d.metrics.wr}% | PF ${d.metrics.pf}x${ordersLine}${expiringWarn}

**Positions (${d.activePos.length}/${d.cfg.portfolioSize})**
\`\`\`
${posLines}
\`\`\`
**Scénario portefeuille**
\`\`\`
${sign(d.worstPct)}${d.worstPct.toFixed(1)}% ${bar} +${d.bestPct.toFixed(1)}%
          ▲ Now: ${sign(d.nowPct)}${d.nowPct.toFixed(1)}%
\`\`\`
**Top 3 signaux**
\`\`\`
${picksLines}
\`\`\`
🔗 <${STATUS_URL}>`;
}

// ─── Senders ──────────────────────────────────────────────────────────────────
function sendTelegram(text) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn('⚠️  TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID manquants — skip Telegram');
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true });
    const opts = {
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          j.ok ? resolve(j.result) : reject(new Error(`Telegram: ${j.description}`));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function sendDiscord(text) {
  try {
    // Escape single quotes in message for shell safety
    const safe = text.replace(/'/g, "'\\''");
    execSync(`openclaw message send --channel discord --target "${DISCORD_CHANNEL}" --message '${safe}'`, {
      stdio: 'pipe',
      timeout: 15000,
    });
    console.log('✅ Discord envoyé');
  } catch (e) {
    console.error('❌ Discord failed:', e.message);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const scanDir = process.argv[2] || getLatestScanDir();
  if (!scanDir) { console.error('ERROR: aucun scan trouvé'); process.exit(1); }

  console.log(`📡 Notification scanner — ${scanDir}`);

  let payload;
  try {
    payload = buildStatusPayload(scanDir);
  } catch (e) {
    console.error('ERROR building payload:', e.message);
    process.exit(1);
  }

  const tgMsg = buildTelegramMessage(payload);
  const dcMsg = buildDiscordMessage(payload);

  console.log('\n--- Telegram preview ---');
  console.log(tgMsg);
  console.log('\n--- Discord preview ---');
  console.log(dcMsg);

  try {
    const r = await sendTelegram(tgMsg);
    console.log(`✅ Telegram envoyé (id: ${r?.message_id})`);
  } catch (e) {
    console.error('❌ Telegram failed:', e.message);
  }

  sendDiscord(dcMsg);
}

main();
