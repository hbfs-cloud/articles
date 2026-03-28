#!/usr/bin/env node
'use strict';

/**
 * telegram-publish-notify.js
 * Send a rich, phone-friendly Telegram summary when a new article is published.
 *
 * Usage:
 *   node tools/telegram-publish-notify.js --type <daily|weekly|scanner|retro|analysis|series|tech|learning>
 *                                          --path <relative/path/to/article>
 *                                          [--title "Override title"]
 *                                          [--dry-run]
 *
 * Topic routing:
 *   daily    → 📰 Daily News      (73)
 *   weekly   → 📊 Weekly Review   (74)
 *   scanner  → 📈 Portfolio Live  (72)
 *   retro    → 📈 Portfolio Live  (72)
 *   analysis → 🔍 Stock Analysis  (75)
 *   series   → 🎓 Learning        (76)
 *   tech     → 🎓 Learning        (76)
 *   learning → 🎓 Learning        (76)
 */

const https  = require('https');
const fs     = require('fs');
const path   = require('path');

// ─── Config ───────────────────────────────────────────────────────────────────
const ROOT    = path.join(__dirname, '..');
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;
const BASE_URL  = 'https://articles.market-watch.xyz';
const DRY_RUN   = process.argv.includes('--dry-run');

const TOPICS = {
  portfolio : parseInt(process.env.TELEGRAM_TOPIC_PORTFOLIO || '72'),
  daily     : parseInt(process.env.TELEGRAM_TOPIC_DAILY     || '73'),
  weekly    : parseInt(process.env.TELEGRAM_TOPIC_WEEKLY    || '74'),
  analysis  : parseInt(process.env.TELEGRAM_TOPIC_ANALYSIS  || '75'),
  learning  : parseInt(process.env.TELEGRAM_TOPIC_LEARNING  || '76'),
};

// ─── Args ─────────────────────────────────────────────────────────────────────
const args   = process.argv.slice(2);
const getArg = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };

const type     = getArg('--type')  || 'daily';
const artPath  = getArg('--path')  || '';
const titleArg = getArg('--title') || '';

const TYPE_MAP = {
  daily    : { topicId: TOPICS.daily,    section: 'Daily Briefing',   emoji: '📰' },
  weekly   : { topicId: TOPICS.weekly,   section: 'Weekly Review',    emoji: '📊' },
  scanner  : { topicId: TOPICS.portfolio,section: 'Portfolio Scan',   emoji: '📈' },
  retro    : { topicId: TOPICS.portfolio,section: 'Retrospective',    emoji: '🔁' },
  analysis : { topicId: TOPICS.analysis, section: 'Stock Analysis',   emoji: '🔍' },
  series   : { topicId: TOPICS.learning, section: 'New Series',       emoji: '📚' },
  tech     : { topicId: TOPICS.learning, section: 'Tech & Quant',     emoji: '💡' },
  learning : { topicId: TOPICS.learning, section: 'Learning',         emoji: '🎓' },
};

const meta = TYPE_MAP[type] || TYPE_MAP.daily;

// ─── HTML extraction helpers ──────────────────────────────────────────────────
function readHtml(relPath) {
  try { return fs.readFileSync(path.join(ROOT, relPath), 'utf8'); } catch (_) { return ''; }
}

function stripHtml(html) {
  let t = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ').trim();
  return t;
}

function getMeta(html, prop) {
  const m = html.match(new RegExp(`property="${prop}"[^>]*content="([^"]+)"`, 'i'))
         || html.match(new RegExp(`content="([^"]+)"[^>]*property="${prop}"`, 'i'))
         || html.match(new RegExp(`name="${prop}"[^>]*content="([^"]+)"`, 'i'));
  return m ? m[1] : '';
}

function getTitle(html) {
  if (titleArg) return titleArg;
  const og = getMeta(html, 'og:title');
  if (og) return og.replace(/\s*[–|]\s*Market Watch.*$/i, '').trim();
  const t = html.match(/<title>([^<]+)/i);
  if (t) return t[1].replace(/\s*[–|—].*$/, '').trim();
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return h1[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return '';
}

function getDesc(html) {
  const og = getMeta(html, 'og:description') || getMeta(html, 'description');
  return og ? og.replace(/\s+/g, ' ').trim() : '';
}

// Extract up to N key data points (numbers with context) from plain text
function extractDataPoints(text, n = 5) {
  // Find patterns like: "S&P 500 −1.6%" or "Gold $4,453" or "Nasdaq −2.00%"
  const patterns = [
    /([A-Z][A-Za-z0-9 &]+)\s+([\−+−]?\$?[\d,]+\.?\d*%?)/g,
    /([\−+−]?\d+\.?\d*%)\s+([A-Za-z ]+)/g,
  ];
  const hits = [];
  let m;
  for (const pat of patterns) {
    pat.lastIndex = 0;
    while ((m = pat.exec(text)) !== null && hits.length < n * 3) {
      const a = m[1].trim(), b = m[2].trim();
      if (a.length < 30 && b.length < 20) hits.push(`${a}: ${b}`);
    }
  }
  return [...new Set(hits)].slice(0, n);
}

// Build URL from path
function buildUrl(relPath) {
  if (!relPath) return BASE_URL + '/scanner/status/';
  const clean = relPath.replace(/\/index\.html$/, '/').replace(/^\//, '');
  return BASE_URL + '/' + clean;
}

// ─── Message builders per type ─────────────────────────────────────────────────

function buildDailyMessage(html, url) {
  const text  = stripHtml(html);
  const rawTitle = getTitle(html);
  const title = rawTitle.replace(/&mdash;/g,'—').replace(/&ndash;/g,'–').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
  const desc  = getDesc(html);

  // Extract date from path (daily/20260328/...)
  const dateMatch = artPath.match(/(\d{4})(\d{2})(\d{2})/);
  const dateStr = dateMatch
    ? new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`).toLocaleDateString('en-US', { weekday:'long', day:'numeric', month:'long', year:'numeric', timeZone:'UTC' })
    : new Date().toLocaleDateString('en-US', { weekday:'long', day:'numeric', month:'long', year:'numeric', timeZone:'UTC' });

  // Try to isolate Dashboard/Snapshot section first
  const dashIdx = text.search(/Quick Dashboard|Market Snapshot|Friday Close|Daily Close/i);
  const dashText = dashIdx >= 0 ? text.slice(dashIdx, dashIdx + 600) : text;

  // Extract market snapshot numbers from dashboard section
  const spMatch    = dashText.match(/S[&\s]*P\s*500\s+([\d,]+)/i);
  const nasdaqMatch= dashText.match(/Nasdaq\s+([\d,]+)/i);
  const dowMatch   = dashText.match(/Dow(?:\s+Jones)?\s+([\d,]+)/i);
  const goldMatch  = dashText.match(/Gold\s*\$?([\d,]+)/i);
  const btcMatch   = dashText.match(/BTC\s+([\d,]+)/i);
  const oilMatch   = (dashText.match(/Brent[^$]*\$([\d,.]+)/i) || text.match(/Brent[^$]*\$(\d+)/i));
  const vixMatch   = dashText.match(/VIX[^\d]*([\d.]+)/i);
  // % changes
  const spPct      = dashText.match(/S[&\s]*P\s*500\s+[\d,]+\s*([\−\+\-]?\d[\d.]+%)/i);
  const nasdaqPct  = dashText.match(/Nasdaq\s+[\d,]+\s*([\−\+\-]?\d[\d.]+%)/i);
  const dowPct     = dashText.match(/Dow(?:\s+Jones)?\s+[\d,]+\s*([\−\+\-]?\d[\d.]+%)/i);

  // Extract 2-3 key storylines (sentence containing important keywords)
  const sentences = text.split(/\.\s+/).filter(s => s.length > 40 && s.length < 200);
  const keyStories = sentences.filter(s =>
    /correction|bear|rally|crash|surge|plunge|record|war|fed|inflation|recession|default/i.test(s)
  ).slice(0, 3);

  let msg = `📰 <b>Daily Briefing</b> — ${dateStr}\n`;
  msg    += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg    += `<b>${title}</b>\n`;
  if (desc) msg += `\n<i>${desc.slice(0, 160)}${desc.length > 160 ? '…' : ''}</i>\n`;

  msg += `\n<b>📊 Market Snapshot</b>\n`;
  if (spMatch)    msg += `▸ S&amp;P 500 <code>${spMatch[1]}${spPct?' '+spPct[1]:''}</code>\n`;
  if (nasdaqMatch)msg += `▸ Nasdaq <code>${nasdaqMatch[1]}${nasdaqPct?' '+nasdaqPct[1]:''}</code>\n`;
  if (dowMatch)   msg += `▸ Dow <code>${dowMatch[1]}${dowPct?' '+dowPct[1]:''}</code>\n`;
  if (oilMatch)   msg += `▸ Brent <code>$${oilMatch[1]}</code>\n`;
  if (goldMatch)  msg += `▸ Gold <code>$${goldMatch[1]}</code>\n`;
  if (btcMatch)   msg += `▸ BTC <code>$${btcMatch[1]}</code>\n`;
  if (vixMatch)   msg += `▸ VIX <code>${vixMatch[1]}</code>\n`;

  if (keyStories.length) {
    msg += `\n<b>🔑 Key Stories</b>\n`;
    keyStories.forEach(s => {
      msg += `▸ ${s.trim().slice(0, 120)}…\n`;
    });
  }

  msg += `\n🔗 <a href="${url}">Read full briefing →</a>`;
  return msg;
}

function buildWeeklyMessage(html, url) {
  const text  = stripHtml(html);
  const title = getTitle(html);
  const desc  = getDesc(html);

  const dateMatch = artPath.match(/(\d{4})(\d{2})(\d{2})/);
  const weekStr = dateMatch ? `Week of ${dateMatch[2]}/${dateMatch[3]}/${dateMatch[1]}` : '';

  // Extract perf numbers
  const spWeek   = text.match(/S[&\s]*P\s*500[^.]*week[^.]*?([\−\+−]?\d[\d,.]+%)/i)
                || text.match(/week[^.]*S[&\s]*P[^.]*?([\−\+−]?\d[\d,.]+%)/i);
  const nasdaqW  = text.match(/Nasdaq[^.]*week[^.]*?([\−\+−]?\d[\d,.]+%)/i)
                || text.match(/week[^.]*Nasdaq[^.]*?([\−\+−]?\d[\d,.]+%)/i);

  // Top themes (find numbered sections or h2/h3 headlines)
  const headings = [...html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)]
    .map(m => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
    .filter(h => h.length > 5 && h.length < 80 && !/menu|nav|footer|header/i.test(h))
    .slice(0, 6);

  // Key sentences
  const sentences = text.split(/\.\s+/).filter(s => s.length > 60 && s.length < 200);
  const keyPoints = sentences.filter(s =>
    /week|monthly|quarter|fed|rate|inflation|oil|gold|earnings|guidance|outlook/i.test(s)
  ).slice(0, 3);

  let msg = `📊 <b>Weekly Review</b>`;
  if (weekStr) msg += ` — ${weekStr}`;
  msg += `\n━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `<b>${title.slice(0, 100)}</b>\n`;
  if (desc) msg += `\n<i>${desc.slice(0, 180)}${desc.length > 180 ? '…' : ''}</i>\n`;

  if (headings.length) {
    msg += `\n<b>📋 What's inside</b>\n`;
    headings.forEach(h => { msg += `▸ ${h}\n`; });
  }

  if (keyPoints.length) {
    msg += `\n<b>💡 This week's takeaways</b>\n`;
    keyPoints.forEach(p => { msg += `▸ ${p.trim().slice(0, 130)}…\n`; });
  }

  msg += `\n🔗 <a href="${url}">Read full weekly →</a>`;
  return msg;
}

function buildSeriesMessage(html, url) {
  const text  = stripHtml(html);
  const title = getTitle(html);
  const desc  = getDesc(html);

  // Extract parts from plain text (more reliable than HTML parsing)
  const partsMap = new Map();
  for (const m of text.matchAll(/Part\s+(\d+)\s+([A-Z][^.]{5,60})/g)) {
    const num = parseInt(m[1]);
    if (!partsMap.has(num)) partsMap.set(num, m[2].trim().split(/\s{2,}/)[0]);
  }
  const parts = [...partsMap.entries()].sort((a,b) => a[0]-b[0]).slice(0,7).map(([n,t]) => `Part ${n}: ${t}`);

  // Key phrases
  const sentences = text.split(/\.\s+/).filter(s => s.length > 50 && s.length < 180);
  const hooks = sentences.filter(s =>
    /invest|trade|setup|opportunity|billion|trillion|disrupt|revolution|future/i.test(s)
  ).slice(0, 2);

  let msg = `📚 <b>New Expert Series</b>\n`;
  msg    += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg    += `<b>${title}</b>\n`;
  if (desc) msg += `\n<i>${desc.slice(0, 200)}${desc.length > 200 ? '…' : ''}</i>\n`;

  if (parts.length) {
    msg += `\n<b>📖 Series overview</b>\n`;
    parts.forEach(p => { msg += `▸ ${p}\n`; });
    if (parts.length >= 6) msg += `▸ … and more\n`;
  }

  if (hooks.length) {
    msg += `\n<b>🎯 Why it matters</b>\n`;
    hooks.forEach(h => { msg += `▸ ${h.trim().slice(0, 140)}…\n`; });
  }

  msg += `\n🔗 <a href="${url}">Start reading →</a>`;
  return msg;
}

function buildGenericMessage(html, url) {
  const title = getTitle(html);
  const desc  = getDesc(html);
  const now   = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday:'long', day:'numeric', month:'long', year:'numeric', timeZone:'UTC' });

  let msg = `${meta.emoji} <b>${meta.section}</b> — ${dateStr}\n`;
  msg    += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg    += `<b>${title}</b>\n`;
  if (desc) msg += `\n<i>${desc.slice(0, 200)}${desc.length > 200 ? '…' : ''}</i>\n`;
  msg    += `\n🔗 <a href="${url}">Read more →</a>`;
  return msg;
}

// ─── Main build ───────────────────────────────────────────────────────────────
function buildMessage() {
  const html = artPath ? readHtml(artPath) : '';
  const url  = buildUrl(artPath);

  if (!html) {
    return `${meta.emoji} <b>${meta.section}</b>\n\nNew content published on Market Watch.\n🔗 <a href="${url}">${url}</a>`;
  }

  switch (type) {
    case 'daily':   return buildDailyMessage(html, url);
    case 'weekly':  return buildWeeklyMessage(html, url);
    case 'series':  return buildSeriesMessage(html, url);
    default:        return buildGenericMessage(html, url);
  }
}

// ─── Send ──────────────────────────────────────────────────────────────────────
function send(text, topicId) {
  return new Promise((resolve, reject) => {
    const body    = { chat_id: CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true };
    if (topicId) body.message_thread_id = topicId;
    const payload = JSON.stringify(body);
    const opts = {
      hostname: 'api.telegram.org',
      path    : `/bot${BOT_TOKEN}/sendMessage`,
      method  : 'POST',
      headers : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (j.ok) resolve(j.result);
          else reject(new Error(j.description || JSON.stringify(j)));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ─── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  const msg = buildMessage();

  if (DRY_RUN) {
    console.log('--- Telegram preview ---');
    console.log(`Topic: ${meta.section} (${meta.topicId})`);
    console.log(msg.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
    console.log('\n--- Raw HTML ---');
    console.log(msg);
    return;
  }

  if (!BOT_TOKEN || !CHAT_ID) {
    console.error('❌ TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID manquants');
    process.exit(1);
  }

  try {
    const r = await send(msg, meta.topicId);
    console.log(`✅ Telegram → ${meta.section} (msg_id: ${r.message_id})`);
  } catch (e) {
    console.error('❌ Telegram failed:', e.message);
    process.exit(1);
  }
})();
