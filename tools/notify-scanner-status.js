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
const STATUS_URL = 'https://articles.dailytickers.com/scanner/status/';


function tradStrat(str) { return str || ''; }
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
function readStatusMetrics(modeKey = 'balanced') {
  const statusHtml = fs.readFileSync(path.join(ROOT, 'scanner/status/index.html'), 'utf8');
  // Map mode keys to panel IDs in the status page
  const panelId = `p-${modeKey}`;
  const section = statusHtml.match(new RegExp(`id="${panelId}"[\\s\\S]{0,8000}`));
  if (!section) return null;
  const html = section[0];

  // Extract perf-stats block only (contains ps-v spans with real metrics)
  const perfBlock = html.match(/class="perf-stats"[\s\S]{0,1500}?<\/div>\s*<\/div>/);
  const perfHtml = perfBlock ? perfBlock[0] : '';

  // Perf stats from ps-v spans only (Total Return, Max DD, Win Rate, Profit Factor)
  const nums = perfHtml.match(/class="ps-v"[^>]*>([+\-]?[\d.]+[%x]?)<\/span/g) || [];
  const extract = s => { const m = s.match(/>([+\-]?[\d.]+)/); return m ? parseFloat(m[1]) : NaN; };
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
  const modeMap = { turbo: 'turbo', dynamic: 'dynamic', balanced: 'balanced', secured: 'secured', fortress: 'fortress' };
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
function buildStatusPayload(scanDir, modeKey = 'balanced') {
  const modesObj = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/modes-config.json'))).modes;
  const wl = JSON.parse(fs.readFileSync(path.join(ROOT, 'mcp/watchlist.json')));

  const cfgRaw = modesObj[modeKey] || modesObj.balanced;
  const cfg = { id: modeKey, ...cfgRaw };

  // Read metrics + scenario from generated status page (source of truth)
  const m = readStatusMetrics(modeKey) || { ret: 0, dd: 0, wr: 0, pf: 0, worst: 0, now: 0, best: 0 };

  // Active positions (same logic as gen-status-page.js)
  const activePos = buildPositions(cfg, modeKey);

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
  const BAR = 12;
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
  const sep = '──────────────────────────────';

  const closeNow   = d.activePos.filter(p => p.left <= 1);
  const decideSoon = d.activePos.filter(p => p.left === 2);

  // ── BLOC 1 : GESTION POSITIONS EXISTANTES ──
  let manageBlock = '';
  if (closeNow.length || decideSoon.length) {
    manageBlock += `\n🗂 <b>Open positions — action required</b>\n`;
    closeNow.forEach(p => {
      const pnl = (p.return_pct >= 0 ? '+' : '') + p.return_pct + '%';
      manageBlock += `  ⛔ <b>${p.ticker}</b>  ${pnl}  now ${p.current_price}  → <b>CLOSE</b> (horizon reached)\n`;
    });
    decideSoon.forEach(p => {
      const pnl = (p.return_pct >= 0 ? '+' : '') + p.return_pct + '%';
      const toTp1 = p.tp1 && p.current_price ? (((p.tp1 - p.current_price) / p.current_price) * 100).toFixed(1) : null;
      manageBlock += `  ⏰ <b>${p.ticker}</b>  ${pnl}  TP1 ${p.tp1}${toTp1 ? ` (+${toTp1}%)` : ''}  stop ${p.stop}  → decision in 2 days\n`;
    });
  }

  // ── BLOC 2 : NOUVEAUX ORDRES ──
  let ordersBlock = '';
  if (d.slotsLeft > 0) {
    const buyPicks = d.picks.slice(0, d.slotsLeft);
    ordersBlock += `\n📥 <b>New orders — ${d.slotsLeft} slot${d.slotsLeft > 1 ? 's' : ''} free (${d.alloc}% each)</b>\n`;
    buyPicks.forEach(s => {
      ordersBlock += `  🟢 <b>${s.symbol}</b>  ${s.strategy}  entry ${s.entry}  stop ${s.stop}  TP1 ${s.tp1}  TP2 ${s.tp2}  R/R ${s.rr}\n`;
    });
  } else {
    ordersBlock += `\n✅ <b>Portfolio full</b> — no new orders\n`;
  }

  const actions = manageBlock + ordersBlock;

  // ── POSITIONS ──
  const posLines = d.activePos.length
    ? d.activePos.map(p => {
        const pnl = (p.return_pct >= 0 ? '📈 +' : '📉 ') + p.return_pct + '%';
        const warn = p.left <= 1 ? ' ⚠️' : p.left === 2 ? ' ⏰' : '';
        return `  ${p.ticker.padEnd(6)} ${pnl.padEnd(12)}  ${d.alloc}%  ${p.left}d${warn}`;
      }).join('\n')
    : '  No open positions';

  // ── SIGNAUX ──
  const picksLines = d.picks.map((s, i) =>
    `  ${String(i + 1).padEnd(3)}${s.symbol.padEnd(7)}${String(s.score).padEnd(5)}${tradStrat(s.strategy).padEnd(13)}R/R ${s.rr}`
  ).join('\n');

  const modeLabel = d.cfg.id === 'dynamic' ? '🔥 Dynamic' : d.cfg.id === 'secured' ? '🛡️ Secured' : '⚖️ Balanced';

  return `${modeLabel}  —  ${d.scanDate}
<code>${sep}</code>
📈 <b>Perf D0</b>  ${sign(d.metrics.ret)}${d.metrics.ret}%   <b>DD</b> ${d.metrics.dd}%   <b>WR</b> ${d.metrics.wr}%   <b>PF</b> ${d.metrics.pf}x
<code>${sep}</code>
${actions}
<code>${sep}</code>
📂 <b>Open positions  (${d.activePos.length}/${d.cfg.portfolioSize})</b>
<pre>${posLines}</pre>
⚖️ <b>Portfolio risk</b>
<pre>${sign(d.worstPct)}${d.worstPct.toFixed(1)}%  ${bar}  +${d.bestPct.toFixed(1)}%
            ▲ Now ${sign(d.nowPct)}${d.nowPct.toFixed(1)}%</pre>
<code>${sep}</code>
🔗 <a href="${STATUS_URL}">Full status →</a>${d.ytUrl ? `\n📺 <a href="${d.ytUrl}">Watch on YouTube</a>` : ''}`;
}

// ─── Discord message (Markdown) ───────────────────────────────────────────────
function buildDiscordMessage(d) {
  const sign = n => n >= 0 ? '+' : '';
  const bar = asciiBar(d.worstPct, d.nowPct, d.bestPct);

  const closeNow   = d.activePos.filter(p => p.left <= 1);
  const decideSoon = d.activePos.filter(p => p.left === 2);

  // ── BLOC 1 : GESTION POSITIONS EXISTANTES ──
  let manageBlock = '';
  if (closeNow.length || decideSoon.length) {
    manageBlock += `\n🗂 **Open positions — action required**\n`;
    closeNow.forEach(p => {
      const pnl = (p.return_pct >= 0 ? '+' : '') + p.return_pct + '%';
      manageBlock += `> ⛔ **${p.ticker}**  ${pnl}  now \`${p.current_price}\`  → **CLOSE** (horizon reached)\n`;
    });
    decideSoon.forEach(p => {
      const pnl = (p.return_pct >= 0 ? '+' : '') + p.return_pct + '%';
      const toTp1 = p.tp1 && p.current_price ? (((p.tp1 - p.current_price) / p.current_price) * 100).toFixed(1) : null;
      manageBlock += `> ⏰ **${p.ticker}**  ${pnl}  TP1 \`${p.tp1}\`${toTp1 ? ` (+${toTp1}%)` : ''}  stop \`${p.stop}\`  → decision in 2 days\n`;
    });
  }

  // ── BLOC 2 : NOUVEAUX ORDRES ──
  let ordersBlock = '';
  if (d.slotsLeft > 0) {
    const buyPicks = d.picks.slice(0, d.slotsLeft);
    ordersBlock += `\n📥 **New orders — ${d.slotsLeft} slot${d.slotsLeft > 1 ? 's' : ''} free (${d.alloc}% each)**\n`;
    buyPicks.forEach(s => {
      ordersBlock += `> 🟢 **${s.symbol}**  ${tradStrat(s.strategy)}  entry \`${s.entry}\`  stop \`${s.stop}\`  TP1 \`${s.tp1}\`  TP2 \`${s.tp2}\`  R/R ${s.rr}\n`;
    });
  } else {
    ordersBlock += `\n✅ **Portfolio full** — no new orders\n`;
  }

  const actions = manageBlock + ordersBlock;

  // ── POSITIONS ──
  const posLines = d.activePos.length
    ? d.activePos.map(p => {
        const pnl = (p.return_pct >= 0 ? '+' : '') + p.return_pct + '%';
        const warn = p.left <= 1 ? ' ⚠️' : p.left === 2 ? ' ⏰' : '';
        return `${p.ticker.padEnd(6)} ${pnl.padEnd(9)}  ${d.alloc}%   ${p.left}d left${warn}`;
      }).join('\n')
    : 'No open positions';

  // ── SIGNAUX ──
  const picksLines = d.picks.map((s, i) =>
    `${String(i + 1).padEnd(3)}${s.symbol.padEnd(7)}${String(s.score).padEnd(5)}${tradStrat(s.strategy).padEnd(13)}R/R ${s.rr}`
  ).join('\n');

  const dcLabel = d.cfg.id === 'dynamic' ? 'Dynamic' : d.cfg.id === 'secured' ? 'Secured' : 'Balanced';
  return `## 📊 Portfolio ${dcLabel} — ${d.scanDate}
> 📈 **Perf D0** ${sign(d.metrics.ret)}${d.metrics.ret}%  ·  **DD** ${d.metrics.dd}%  ·  **WR** ${d.metrics.wr}%  ·  **PF** ${d.metrics.pf}x
${actions}
---
**📂 Open positions  ${d.activePos.length}/${d.cfg.portfolioSize}**
\`\`\`
${posLines}
\`\`\`
**⚖️ Portfolio risk**
\`\`\`
${sign(d.worstPct)}${d.worstPct.toFixed(1)}%  ${bar}  +${d.bestPct.toFixed(1)}%
              ▲ Now ${sign(d.nowPct)}${d.nowPct.toFixed(1)}%
\`\`\`
🔗 <${STATUS_URL}>`;
}

// ─── Build compact caption for sendAudio (max 1024 chars) ─────────────────────
function buildAudioCaption(d, ytUrl) {
  const sign = n => n >= 0 ? '+' : '';
  const modeLabel = d.cfg.id === 'dynamic' ? '🔥 Dynamic' : d.cfg.id === 'secured' ? '🛡️ Secured' : '⚖️ Balanced';
  const bar = asciiBar(d.worstPct, d.nowPct, d.bestPct);

  const closeNow   = d.activePos.filter(p => p.left <= 1);
  const decideSoon = d.activePos.filter(p => p.left === 2);

  let lines = [];
  lines.push(`<b>${modeLabel} — ${d.scanDate}</b>`);
  lines.push(`📈 D0 ${sign(d.metrics.ret)}${d.metrics.ret}%  DD ${d.metrics.dd}%  WR ${d.metrics.wr}%  PF ${d.metrics.pf}x`);

  // Actions required
  if (closeNow.length || decideSoon.length) {
    lines.push('');
    lines.push('🗂 <b>Action required</b>');
    closeNow.forEach(p => {
      const pnl = (p.return_pct >= 0 ? '+' : '') + p.return_pct + '%';
      lines.push(`⛔ <b>${p.ticker}</b> ${pnl} → CLOSE`);
    });
    decideSoon.forEach(p => {
      const pnl = (p.return_pct >= 0 ? '+' : '') + p.return_pct + '%';
      lines.push(`⏰ <b>${p.ticker}</b> ${pnl} TP1 ${p.tp1} · 2d left`);
    });
  }

  // New orders
  if (d.slotsLeft > 0) {
    const buyPicks = d.picks.slice(0, Math.min(d.slotsLeft, 3));
    lines.push('');
    lines.push(`📥 <b>${d.slotsLeft} slot${d.slotsLeft > 1 ? 's' : ''} open</b> (${d.alloc}% each)`);
    buyPicks.forEach(s => {
      lines.push(`🟢 <b>${s.symbol}</b> ${s.entry}→TP1 ${s.tp1} R/R ${s.rr}`);
    });
  } else {
    lines.push('✅ Portfolio full');
  }

  // Open positions
  if (d.activePos.length > 0) {
    lines.push('');
    lines.push(`📂 <b>Positions (${d.activePos.length}/${d.cfg.portfolioSize})</b>`);
    d.activePos.forEach(p => {
      const pnl = (p.return_pct >= 0 ? '+' : '') + p.return_pct + '%';
      const warn = p.left <= 1 ? '⚠️' : p.left === 2 ? '⏰' : '';
      lines.push(`  ${p.ticker} ${pnl} · ${p.left}d ${warn}`);
    });
  }

  // Risk view
  lines.push('');
  lines.push(`⚖️ Risk: ${sign(d.worstPct)}${d.worstPct.toFixed(1)}% ${bar} +${d.bestPct.toFixed(1)}%  ▲ now ${sign(d.nowPct)}${d.nowPct.toFixed(1)}%`);

  if (ytUrl) lines.push(`\n📺 <a href="${ytUrl}">Watch on YouTube</a>`);
  lines.push(`🔗 <a href="${STATUS_URL}">Full status →</a>`);

  return lines.join('\n').slice(0, 1024);
}

// ─── Build audio narration script (60-80 words, analytical) ─────────────────
function buildAudioScript(d) {
  const sign = n => n >= 0 ? '+' : '';
  const modeLabel = d.cfg.id === 'dynamic' ? 'Dynamic' : d.cfg.id === 'secured' ? 'Secured' : 'Balanced';

  const closeNow = d.activePos.filter(p => p.left <= 1);
  const decideSoon = d.activePos.filter(p => p.left === 2);
  const top3 = d.picks.slice(0, 3);

  let parts = [];

  // Context: portfolio state (spell out date for TTS — DD/MM/YYYY → "April 3rd, 2026")
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const [dd, mm, yyyy] = d.scanDate.split('/');
  const spokenDate = `${MONTHS[parseInt(mm, 10) - 1]} ${parseInt(dd, 10)}, ${yyyy}`;
  parts.push(`${modeLabel} portfolio, ${spokenDate}.`);

  if (d.metrics.ret !== 0) {
    const trend = d.metrics.ret > 0 ? 'up' : 'down';
    parts.push(`We're ${trend} ${Math.abs(d.metrics.ret)}% overall, win rate ${d.metrics.wr}%, profit factor ${d.metrics.pf}.`);
  }

  // WHY we close positions
  if (closeNow.length > 0) {
    closeNow.forEach(p => {
      const verb = p.return_pct >= 0 ? 'locking in' : 'cutting';
      parts.push(`${p.ticker} hits its ${d.cfg.horizon}-day horizon — ${verb} ${sign(p.return_pct)}${p.return_pct}%, freeing up ${d.alloc}% capital for fresh setups.`);
    });
  }

  // WHY we watch expiring positions
  if (decideSoon.length > 0) {
    decideSoon.forEach(p => {
      const distance = p.tp1 && p.current_price ? ((p.tp1 - p.current_price) / p.current_price * 100).toFixed(1) : null;
      if (distance && parseFloat(distance) > 0) {
        parts.push(`${p.ticker} at ${sign(p.return_pct)}${p.return_pct}%, still ${distance}% from TP1 — two days to decide if momentum carries it.`);
      } else {
        parts.push(`${p.ticker} needs a decision in two days, sitting at ${sign(p.return_pct)}${p.return_pct}%.`);
      }
    });
  }

  // WHY we enter new positions
  if (d.slotsLeft > 0 && top3.length > 0) {
    const top = top3[0];
    parts.push(`${d.slotsLeft} slot${d.slotsLeft > 1 ? 's' : ''} open. Top pick: ${top.symbol}, ${top.strategy} setup with ${top.rr} risk-reward, entry at ${top.entry} targeting ${top.tp1}.`);
    if (top3.length > 1) {
      parts.push(`Also watching ${top3.slice(1).map(s => s.symbol).join(' and ')}.`);
    }
  } else if (d.slotsLeft === 0) {
    parts.push(`Portfolio fully allocated — monitoring existing positions, no new entries.`);
  }

  // Risk context
  if (d.nowPct !== 0) {
    parts.push(`Risk range ${sign(d.worstPct)}${d.worstPct.toFixed(1)}% to +${d.bestPct.toFixed(1)}%, currently at ${sign(d.nowPct)}${d.nowPct.toFixed(1)}%.`);
  }

  parts.push(`Full details at market watch dot xyz.`);

  return parts.join(' ').trim();
}

// ─── Generate audio via edge-tts (local, cross-platform) ─────────────────────
function generateQwen3Audio(text, outPath) {
  const EDGE_TTS_CANDIDATES = [
    '/opt/homebrew/bin/edge-tts',           // macOS (Homebrew)
    '/home/ci/edge-tts-venv/bin/edge-tts',  // Linux CI (Hetzner)
    'edge-tts'                              // system PATH fallback
  ];
  const edgeTts = EDGE_TTS_CANDIDATES.find(p =>
    p === 'edge-tts' || fs.existsSync(p)
  ) || 'edge-tts';

  const VOICE = 'en-US-AndrewNeural';
  const RATE = '+5%';
  const PITCH = '+8Hz';

  // Write text to temp file (avoids shell escaping issues)
  const txtPath = outPath.replace(/\.mp3$/, '.txt');
  fs.writeFileSync(txtPath, text);

  const r = require('child_process').spawnSync(
    edgeTts,
    ['--voice', VOICE, `--rate=${RATE}`, `--pitch=${PITCH}`, '-f', txtPath, '--write-media', outPath],
    { stdio: 'pipe', timeout: 60000 }
  );

  // Cleanup temp text file
  try { fs.unlinkSync(txtPath); } catch (_) {}

  if (!fs.existsSync(outPath) || fs.statSync(outPath).size < 1000) {
    const stderr = r.stderr?.toString()?.slice(-200) || '';
    console.error(`  ⚠️  edge-tts failed: ${stderr}`);
    return false;
  }

  console.log(`  ✅ Audio: ${outPath} (${Math.round(fs.statSync(outPath).size / 1024)}KB)`);
  return true;
}

// ─── Generate video from mode card image + audio ─────────────────────────────
function generateModeVideo(modeKey, audioPath, scanDir) {
  // Find mode card image from manifest
  const manifestPath = path.join(ROOT, 'scanner/status/manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(`  ⚠️  No manifest.json — skip video for ${modeKey}`);
    return null;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  const imgFile = manifest[`mode-${modeKey}`];
  if (!imgFile) {
    console.error(`  ⚠️  No card image for mode-${modeKey} in manifest`);
    return null;
  }
  const imgPath = path.join(ROOT, 'scanner/status', imgFile);
  if (!fs.existsSync(imgPath)) {
    console.error(`  ⚠️  Card image not found: ${imgPath}`);
    return null;
  }

  const videoPath = `/tmp/scanner-${modeKey}-${scanDir}.mp4`;
  // ffmpeg: static image + audio → video
  const r = execSync(
    `ffmpeg -y -loop 1 -i "${imgPath}" -i "${audioPath}" ` +
    `-c:v libx264 -tune stillimage -c:a aac -b:a 192k ` +
    `-vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0a0e1a" ` +
    `-pix_fmt yuv420p -shortest -movflags +faststart "${videoPath}"`,
    { stdio: 'pipe', timeout: 60000 }
  );
  if (fs.existsSync(videoPath)) {
    const size = Math.round(fs.statSync(videoPath).size / 1024);
    console.log(`  ✅ Video: ${videoPath} (${size}KB)`);
    return videoPath;
  }
  return null;
}

// ─── Upload to YouTube via Mac Mini ──────────────────────────────────────────
function uploadToYouTube(videoPath, title, description, modeKey) {
  // Local CI upload — no Mac Mini needed
  const YT_TOKEN = ['/home/ci/yt-venv/youtube-token.json', path.join(ROOT, 'credentials/youtube-token.json')].find(p => fs.existsSync(p));
  const YT_CREDS = ['/home/ci/yt-venv/youtube-credentials.json', path.join(ROOT, 'credentials/youtube-credentials.json')].find(p => fs.existsSync(p));
  const YT_PYTHON = fs.existsSync('/home/ci/yt-venv/bin/python3') ? '/home/ci/yt-venv/bin/python3' : 'python3';

  if (!YT_TOKEN || !YT_CREDS) {
    console.error(`  ⚠️  YouTube credentials not found for ${modeKey}`);
    return null;
  }

  const metaPath = `/tmp/mw-yt-meta-${modeKey}.json`;
  const pyPath = `/tmp/mw-yt-upload-${modeKey}.py`;

  fs.writeFileSync(metaPath, JSON.stringify({
    title: title.slice(0, 100),
    description: description.slice(0, 5000),
    videoPath,
    tags: ['DailyTickers', 'portfolio', modeKey, 'trading'],
    categoryId: '22',
  }), 'utf8');

  const pyScript = [
    'import json,os,warnings; warnings.filterwarnings("ignore")',
    'from google.oauth2.credentials import Credentials',
    'from googleapiclient.discovery import build',
    'from googleapiclient.http import MediaFileUpload',
    `t=json.load(open('${YT_TOKEN}'))`,
    `c=json.load(open('${YT_CREDS}'))['web']`,
    `meta=json.load(open('${metaPath}'))`,
    'creds=Credentials(token=t["access_token"],refresh_token=t["refresh_token"],token_uri=c["token_uri"],client_id=c["client_id"],client_secret=c["client_secret"])',
    'yt=build("youtube","v3",credentials=creds)',
    'body={"snippet":{"title":meta["title"],"description":meta["description"],"categoryId":meta.get("categoryId","22"),"tags":meta.get("tags",[])},"status":{"privacyStatus":"public"}}',
    'media=MediaFileUpload(meta["videoPath"],mimetype="video/mp4",resumable=True)',
    'req=yt.videos().insert(part="snippet,status",body=body,media_body=media)',
    'resp=None',
    'while resp is None:',
    '    st,resp=req.next_chunk()',
    'vid=resp["id"]',
    'print(f"YTID:{vid}")',
  ].join('\n');

  fs.writeFileSync(pyPath, pyScript, 'utf8');
  const r = require('child_process').spawnSync(YT_PYTHON, [pyPath], { stdio: 'pipe', timeout: 300000 });
  const out = (r.stdout?.toString() || '') + (r.stderr?.toString() || '');
  const ytMatch = out.match(/YTID:([a-zA-Z0-9_-]+)/);

  if (ytMatch) {
    const ytId = ytMatch[1];
    console.log(`  ✅ YouTube: https://youtu.be/${ytId} [${modeKey}]`);
    return ytId;
  }
  console.error(`  ⚠️  YouTube upload failed for ${modeKey}:`, out.slice(-200));
  return null;
}

// ─── Senders ──────────────────────────────────────────────────────────────────
function sendTelegramAudio(audioPath, caption, topicId, title) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn('⚠️  TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID manquants — skip Telegram');
    return null;
  }
  const capFile = audioPath + '.caption.txt';
  require('fs').writeFileSync(capFile, caption, 'utf8');
  const curlArgs = [
    '-s', '-X', 'POST',
    `https://api.telegram.org/bot${BOT_TOKEN}/sendAudio`,
    '-F', `chat_id=${CHAT_ID}`,
    '-F', `message_thread_id=${topicId}`,
    '-F', `audio=@${audioPath}`,
    '-F', `title=${(title || 'Portfolio Update').replace(/['"]/g,'').slice(0,60)}`,
    '-F', 'performer=DailyTickers',
    '-F', `caption=<${capFile}`,
    '-F', 'parse_mode=HTML',
  ];
  const r = require('child_process').spawnSync('curl', curlArgs, { stdio: 'pipe', timeout: 60000 });
  try { require('fs').unlinkSync(capFile); } catch {}
  try {
    const j = JSON.parse(r.stdout?.toString() || '{}');
    if (j.ok) {
      console.log(`  ✅ Telegram audio sent (msg_id: ${j.result.message_id})`);
      return j.result.message_id;
    } else {
      console.error('  ❌ Telegram sendAudio:', j.description);
    }
  } catch {}
  return null;
}

function sendTelegramVideo(videoPath, caption, topicId, title) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn('⚠️  TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID manquants — skip Telegram');
    return null;
  }
  const capFile = videoPath + '.caption.txt';
  require('fs').writeFileSync(capFile, caption, 'utf8');
  const curlArgs = [
    '-s', '-X', 'POST',
    `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`,
    '-F', `chat_id=${CHAT_ID}`,
    '-F', `message_thread_id=${topicId}`,
    '-F', `video=@${videoPath}`,
    '-F', `caption=<${capFile}`,
    '-F', 'parse_mode=HTML',
    '-F', 'supports_streaming=true',
  ];
  const r = require('child_process').spawnSync('curl', curlArgs, { stdio: 'pipe', timeout: 120000 });
  try { require('fs').unlinkSync(capFile); } catch {}
  try {
    const j = JSON.parse(r.stdout?.toString() || '{}');
    if (j.ok) {
      console.log(`  ✅ Telegram video sent (msg_id: ${j.result.message_id})`);
      return j.result.message_id;
    } else {
      console.error('  ❌ Telegram sendVideo:', j.description);
    }
  } catch {}
  return null;
}

// Fallback: text-only sendMessage
function sendTelegramText(text, topicId) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn('⚠️  TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID manquants — skip Telegram');
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const body = { chat_id: CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true };
    if (topicId) body.message_thread_id = parseInt(topicId, 10);
    const payload = JSON.stringify(body);
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
  const positionalArgs = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const scanDir = positionalArgs[0] || getLatestScanDir();
  if (!scanDir) { console.error('ERROR: aucun scan trouvé'); process.exit(1); }

  // Anti-doublon: skip if already sent today for this scan
  const sentFlag = `/tmp/mw-notify-sent-${scanDir}.flag`;
  if (fs.existsSync(sentFlag) && !process.argv.includes('--force')) {
    console.log(`⚠️  Already sent for ${scanDir} (${sentFlag}). Use --force to override.`);
    process.exit(0);
  }

  console.log(`📡 Notification scanner — ${scanDir}`);

  let payload;
  try {
    payload = buildStatusPayload(scanDir, 'balanced');
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

  // Send to all 3 mode topics
  const modeTopics = [
    { key: 'dynamic',  topicEnv: 'TELEGRAM_TOPIC_DYNAMIC' },
    { key: 'balanced', topicEnv: 'TELEGRAM_TOPIC_BALANCED' },
    { key: 'secured',  topicEnv: 'TELEGRAM_TOPIC_SECURED' },
  ];

  // ── Media paths: YouTube URL + local video from scanner-specific result.json ─
  function getScannerMediaPaths(scanDir) {
    const mediaDir = path.join('/tmp/mw-media', `scanner-${scanDir}`);
    let ytUrl = null;
    let videoPath = null;
    try {
      const resultFile = path.join(mediaDir, 'result.json');
      if (fs.existsSync(resultFile)) {
        const r = JSON.parse(fs.readFileSync(resultFile));
        ytUrl = r.youtubeUrl || null;
        if (r.videoPath && fs.existsSync(r.videoPath)) {
          videoPath = r.videoPath;
        }
      }
    } catch {}
    // Also check for video.mp4 directly in media dir
    if (!videoPath) {
      const directVideo = path.join(mediaDir, 'video.mp4');
      if (fs.existsSync(directVideo)) videoPath = directVideo;
    }
    return { ytUrl, videoPath };
  }

  const media = getScannerMediaPaths(scanDir);
  if (media.ytUrl) console.log(`📺 YouTube (scanner): ${media.ytUrl}`);
  else if (media.videoPath) console.log(`📺 Video found (no YouTube): ${media.videoPath}`);
  else console.log('📺 No scanner media found');

  for (const { key, topicEnv } of modeTopics) {
    const modePayload = buildStatusPayload(scanDir, key);
    const topicId     = process.env[topicEnv];

    // Generate audio
    const audioPath = `/tmp/scanner-${key}-${scanDir}.mp3`;
    const audioScript = buildAudioScript(modePayload);
    console.log(`\n🎙️  [${key}] Generating audio...`);
    console.log(`  Script: ${audioScript.slice(0, 120)}...`);
    const audioOk = generateQwen3Audio(audioScript, audioPath);

    // Generate mode-specific video (card image + audio)
    let modeVideoPath = null;
    let modeYtUrl = null;
    if (audioOk) {
      try {
        modeVideoPath = generateModeVideo(key, audioPath, scanDir);
      } catch (e) {
        console.error(`  ⚠️  Video generation failed for ${key}:`, e.message);
      }
      // Upload to YouTube
      if (modeVideoPath) {
        const modeLabel = key === 'dynamic' ? '🔥 Dynamic' : key === 'secured' ? '🛡️ Secured' : '⚖️ Balanced';
        const ytTitle = `${modeLabel} Portfolio — ${modePayload.scanDate} | DailyTickers`;
        const ytDesc = `${modeLabel} Portfolio Update\n\n` +
          `📈 Return: ${(modePayload.metrics.ret >= 0 ? '+' : '')}${modePayload.metrics.ret}%\n` +
          `📉 Max DD: ${modePayload.metrics.dd}%\n` +
          `🎯 Win Rate: ${modePayload.metrics.wr}%\n` +
          `📊 Profit Factor: ${modePayload.metrics.pf}x\n\n` +
          `🔗 Full status: ${STATUS_URL}\n` +
          `📱 Telegram: https://t.me/+gl06cNSLV2RiZmE0\n\n⚠️ Not financial advice.`;
        try {
          const ytId = uploadToYouTube(modeVideoPath, ytTitle, ytDesc, key);
          if (ytId) modeYtUrl = `https://youtu.be/${ytId}`;
        } catch (e) {
          console.error(`  ⚠️  YouTube upload failed for ${key}:`, e.message);
        }
      }
    }

    // Build caption with mode-specific YT link
    const caption = buildAudioCaption(modePayload, modeYtUrl || media.ytUrl);

    if (audioOk) {
      sendTelegramAudio(audioPath, caption, topicId, `Portfolio ${key} — ${modePayload.scanDate}`);
      console.log(`✅ Telegram audio+caption [${key}] → topic ${topicId}`);
      // Send video if no YouTube (fallback: embed directly)
      if (!modeYtUrl && modeVideoPath) {
        const videoCaption = `📊 <b>${key === 'dynamic' ? 'Dynamic' : key === 'secured' ? 'Secured' : 'Balanced'} Portfolio — ${modePayload.scanDate}</b>\nPositions · Rotations · Setups · Risk`;
        sendTelegramVideo(modeVideoPath, videoCaption, topicId, `Portfolio ${key} — ${modePayload.scanDate}`);
        console.log(`✅ Telegram video embedded [${key}] → topic ${topicId}`);
      }
    } else {
      // No audio — text-only fallback
      modePayload.ytUrl = modeYtUrl || media.ytUrl || null;
      const modeTgMsg = buildTelegramMessage(modePayload);
      try {
        const r = await sendTelegramText(modeTgMsg, topicId);
        console.log(`✅ Telegram text fallback [${key}] → topic ${topicId} (id: ${r?.message_id})`);
      } catch (e) {
        console.error(`❌ Telegram [${key}] failed:`, e.message);
      }
    }
  }

  sendDiscord(dcMsg);

  // Mark as sent (anti-doublon)
  fs.writeFileSync(sentFlag, new Date().toISOString(), 'utf8');
  console.log(`✅ Sent flag written: ${sentFlag}`);
}

main();
