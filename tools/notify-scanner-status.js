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

// ─── Read metrics + scenario from generated status page (source of truth) ─────
function readStatusMetrics() {
  const statusHtml = fs.readFileSync(path.join(ROOT, 'scanner/status/index.html'), 'utf8');
  const section = statusHtml.match(/id="p-calmar"[\s\S]{0,8000}/);
  if (!section) return null;
  const html = section[0];

  // Perf stats (first 4 span numbers in perf-stats)
  const nums = html.match(/>([+\-]?[\d.]+[%x]?)<\/span/g) || [];
  const extract = s => parseFloat(s.replace(/[><\/span%x]/g, ''));
  const vals = nums.map(extract).filter(n => !isNaN(n));

  // Scenario worst/now/best from scenario-labels
  const worstM = html.match(/Worst:\s*([+\-]?[\d.]+)%/);
  const nowM   = html.match(/Now:\s*([+\-]?[\d.]+)%/);
  const bestM  = html.match(/Best:\s*([+\-]?[\d.]+)%/);

  return {
    ret:   vals[0] || 0,
    dd:    vals[1] || 0,
    wr:    vals[2] || 0,
    pf:    vals[3] || 0,
    worst: worstM ? parseFloat(worstM[1]) : 0,
    now:   nowM   ? parseFloat(nowM[1])   : 0,
    best:  bestM  ? parseFloat(bestM[1])  : 0,
  };
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
  const wl = JSON.parse(fs.readFileSync(path.join(ROOT, 'mcp/watchlist.json')));

  // Balanced = calmar
  const cfgRaw = modesObj.calmar;
  const cfg = { id: 'calmar', ...cfgRaw };

  // Read metrics + scenario from generated status page (source of truth)
  const m = readStatusMetrics() || { ret: 0, dd: 0, wr: 0, pf: 0, worst: 0, now: 0, best: 0 };

  // Active positions (same logic as gen-status-page.js)
  const activePos = buildPositions(cfg, 'calmar');

  // Expiring soon (left = 1)
  const expiring = activePos.filter(p => p.left === 1);

  // Scenario from status page (source of truth)
  const worstPct = m.worst;
  const nowPct   = m.now;
  const bestPct  = m.best;

  // All signals (10 max, no Short Squeeze)
  const picks = (wl.picks || []).filter(s => !/short.?squeeze/i.test(s.strategy)).slice(0, 10);

  // Portfolio full?
  const slotsLeft = cfg.portfolioSize - activePos.length;

  const alloc = Math.round(100 / cfg.portfolioSize);

  return {
    scanDir,
    scanDate: formatDate(scanDir),
    cfg,
    alloc,
    metrics: {
      ret: m.ret,   // return total depuis D0 (= ce qu'affiche gen-status-page)
      dd: m.dd,
      wr: m.wr,
      pf: m.pf,
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
  const BAR = 30;
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
  const bar = asciiBar(d.worstPct, d.nowPct, d.bestPct);

  // 1. ACTIONS
  let actionsBlock = '';

  // Positions proches du timeout (left <= 2)
  const closeNow   = d.activePos.filter(p => p.left <= 1);
  const decideSoon = d.activePos.filter(p => p.left === 2);

  if (closeNow.length) {
    actionsBlock += `\n⛔ <b>CLÔTURER à l'ouverture :</b>`;
    closeNow.forEach(p => {
      const pnl = (p.return_pct >= 0 ? '+' : '') + p.return_pct + '%';
      actionsBlock += `\n  → <b>${p.ticker}</b> ${pnl} | entry ${p.entry} → now ${p.current_price} | stop ${p.stop} | horizon atteint`;
    });
  }
  if (decideSoon.length) {
    actionsBlock += `\n⏰ <b>Décision requise (expire dans 2j) :</b>`;
    decideSoon.forEach(p => {
      const pnl = (p.return_pct >= 0 ? '+' : '') + p.return_pct + '%';
      const toTp1 = p.tp1 && p.current_price ? (((p.tp1 - p.current_price) / p.current_price) * 100).toFixed(1) : null;
      actionsBlock += `\n  → <b>${p.ticker}</b> ${pnl} | now ${p.current_price} | TP1 ${p.tp1}${toTp1 ? ` (+${toTp1}%)` : ''} | stop ${p.stop} — keep ou exit ?`;
    });
  }

  if (d.slotsLeft > 0) {
    const buyPicks = d.picks.slice(0, d.slotsLeft);
    actionsBlock += `\n⚡ <b>${d.slotsLeft} slot${d.slotsLeft > 1 ? 's' : ''} à ouvrir (${d.alloc}% chacun) :</b>`;
    buyPicks.forEach(s => {
      actionsBlock += `\n  → <b>${s.symbol}</b> ${s.strategy} | entry ${s.entry} | stop ${s.stop} | TP1 ${s.tp1} | TP2 ${s.tp2} | R/R ${s.rr}`;
    });
  } else {
    actionsBlock += `\n✅ <b>Portfolio plein</b> — aucun ordre à passer`;
  }

  // 2. POSITIONS + RISQUE
  const posLines = d.activePos.map(p => {
    const warn = p.left <= 1 ? ' ⚠️' : '';
    return `  ${p.ticker.padEnd(5)} ${(sign(p.return_pct) + p.return_pct + '%').padEnd(8)} ${d.alloc}% — ${p.left}j restant${warn}`;
  }).join('\n');

  // 3. SIGNAUX (tous les topN du mode)
  const picksLines = d.picks.map(s =>
    `  ${s.symbol.padEnd(5)} ${String(s.score).padEnd(3)} ${s.strategy.padEnd(12)} entry ${s.entry} stop ${s.stop} TP1 ${s.tp1} TP2 ${s.tp2} R/R ${s.rr} (${d.alloc}%)`
  ).join('\n');

  return `📊 <b>Scanner Balanced — ${d.scanDate}</b>
📈 Perf D0 : ${sign(d.metrics.ret)}${d.metrics.ret}% | DD ${d.metrics.dd}% | WR ${d.metrics.wr}% | PF ${d.metrics.pf}x
${actionsBlock}

<b>📂 Positions (${d.activePos.length}/${d.cfg.portfolioSize}) :</b>
<pre>${posLines || '  —'}</pre>
<b>⚖️ Risque portefeuille :</b>
<pre>${sign(d.worstPct)}${d.worstPct.toFixed(1)}% ${bar} +${d.bestPct.toFixed(1)}%
         ▲ Now : ${sign(d.nowPct)}${d.nowPct.toFixed(1)}%</pre>
<b>📡 Signaux du jour (top ${d.picks.length}) :</b>
<pre>${picksLines || '  —'}</pre>
🔗 ${STATUS_URL}`;
}

// ─── Discord message (Markdown) ───────────────────────────────────────────────
function buildDiscordMessage(d) {
  const sign = n => n >= 0 ? '+' : '';
  const bar = asciiBar(d.worstPct, d.nowPct, d.bestPct);

  // 1. ACTIONS
  let actionsBlock = '';

  const closeNow   = d.activePos.filter(p => p.left <= 1);
  const decideSoon = d.activePos.filter(p => p.left === 2);

  if (closeNow.length) {
    actionsBlock += `\n⛔ **CLÔTURER à l'ouverture :**`;
    closeNow.forEach(p => {
      const pnl = (p.return_pct >= 0 ? '+' : '') + p.return_pct + '%';
      actionsBlock += `\n→ **${p.ticker}** ${pnl} | entry ${p.entry} → now ${p.current_price} | stop ${p.stop} | horizon atteint`;
    });
  }
  if (decideSoon.length) {
    actionsBlock += `\n⏰ **Décision requise (expire dans 2j) :**`;
    decideSoon.forEach(p => {
      const pnl = (p.return_pct >= 0 ? '+' : '') + p.return_pct + '%';
      const toTp1 = p.tp1 && p.current_price ? (((p.tp1 - p.current_price) / p.current_price) * 100).toFixed(1) : null;
      actionsBlock += `\n→ **${p.ticker}** ${pnl} | now ${p.current_price} | TP1 ${p.tp1}${toTp1 ? ` (+${toTp1}%)` : ''} | stop ${p.stop} — keep ou exit ?`;
    });
  }

  if (d.slotsLeft > 0) {
    const buyPicks = d.picks.slice(0, d.slotsLeft);
    actionsBlock += `\n⚡ **${d.slotsLeft} slot${d.slotsLeft > 1 ? 's' : ''} à ouvrir (${d.alloc}% chacun) :**`;
    buyPicks.forEach(s => {
      actionsBlock += `\n→ **${s.symbol}** ${s.strategy} | entry ${s.entry} | stop ${s.stop} | TP1 ${s.tp1} | TP2 ${s.tp2} | R/R ${s.rr}`;
    });
  } else {
    actionsBlock += `\n✅ **Portfolio plein** — aucun ordre à passer`;
  }

  // 2. POSITIONS + RISQUE
  const posLines = d.activePos.map(p => {
    const warn = p.left <= 1 ? ' ⚠️' : '';
    return `${p.ticker.padEnd(5)} ${(sign(p.return_pct) + p.return_pct + '%').padEnd(8)} ${d.alloc}% — ${p.left}j restant${warn}`;
  }).join('\n');

  // 3. SIGNAUX (tous les topN du mode)
  const picksLines = d.picks.map(s =>
    `${s.symbol.padEnd(5)} ${String(s.score).padEnd(3)} ${s.strategy.padEnd(12)} entry ${s.entry} stop ${s.stop} TP1 ${s.tp1} TP2 ${s.tp2} R/R ${s.rr} (${d.alloc}%)`
  ).join('\n');

  return `📊 **Scanner Balanced — ${d.scanDate}**
📈 Perf D0 : ${sign(d.metrics.ret)}${d.metrics.ret}% | DD ${d.metrics.dd}% | WR ${d.metrics.wr}% | PF ${d.metrics.pf}x
${actionsBlock}

**📂 Positions (${d.activePos.length}/${d.cfg.portfolioSize})**
\`\`\`
${posLines || '—'}
\`\`\`
**⚖️ Risque portefeuille**
\`\`\`
${sign(d.worstPct)}${d.worstPct.toFixed(1)}% ${bar} +${d.bestPct.toFixed(1)}%
          ▲ Now : ${sign(d.nowPct)}${d.nowPct.toFixed(1)}%
\`\`\`
**📡 Signaux du jour (top ${d.picks.length})**
\`\`\`
${picksLines || '—'}
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
