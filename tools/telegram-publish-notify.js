#!/usr/bin/env node
'use strict';

/**
 * telegram-publish-notify.js
 * Notify the Telegram forum when a new article is published on the site.
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

// Topic IDs (from .env with fallback hardcoded)
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

// ─── Type → topic + label mapping ─────────────────────────────────────────────
const TYPE_MAP = {
  daily    : { topicId: TOPICS.daily,    label: '📰 Daily News',     emoji: '📰', section: 'Daily Briefing'  },
  weekly   : { topicId: TOPICS.weekly,   label: '📊 Weekly Review',  emoji: '📊', section: 'Weekly Analysis' },
  scanner  : { topicId: TOPICS.portfolio,label: '📈 Portfolio Live', emoji: '📈', section: 'Daily Scan'       },
  retro    : { topicId: TOPICS.portfolio,label: '📈 Portfolio Live', emoji: '🔁', section: 'Retrospective'    },
  analysis : { topicId: TOPICS.analysis, label: '🔍 Stock Analysis', emoji: '🔍', section: 'Ticker Analysis'  },
  series   : { topicId: TOPICS.learning, label: '🎓 Learning',       emoji: '🎓', section: 'Series'           },
  tech     : { topicId: TOPICS.learning, label: '🎓 Learning',       emoji: '💡', section: 'Tech / Quant'     },
  learning : { topicId: TOPICS.learning, label: '🎓 Learning',       emoji: '🎓', section: 'Learning'         },
};

const meta = TYPE_MAP[type] || TYPE_MAP.daily;

// ─── Extract title from HTML if available ─────────────────────────────────────
function extractTitle(htmlPath) {
  if (titleArg) return titleArg;
  try {
    const html = fs.readFileSync(path.join(ROOT, htmlPath), 'utf8');
    // Try og:title first
    const og = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
    if (og) return og[1];
    // Try <title>
    const t = html.match(/<title>([^<]+)</i);
    if (t) return t[1].replace(/\s*[–—|-].*$/, '').trim();
    // Try <h1>
    const h1 = html.match(/<h1[^>]*>([^<]+)</i);
    if (h1) return h1[1].trim();
  } catch (_) {}
  return artPath ? path.basename(path.dirname(artPath)) : 'New Article';
}

// ─── Extract description ──────────────────────────────────────────────────────
function extractDesc(htmlPath) {
  try {
    const html = fs.readFileSync(path.join(ROOT, htmlPath), 'utf8');
    const og = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)
            || html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);
    if (og) return og[1].slice(0, 200) + (og[1].length > 200 ? '…' : '');
  } catch (_) {}
  return '';
}

// ─── Build URL ────────────────────────────────────────────────────────────────
function buildUrl() {
  if (!artPath) return BASE_URL + '/scanner/status/';
  // Convert file path to URL: daily/20260328/index.html → /daily/20260328/
  const clean = artPath.replace(/\/index\.html$/, '/').replace(/^\//, '');
  return BASE_URL + '/' + clean;
}

// ─── Build message ────────────────────────────────────────────────────────────
function buildMessage() {
  const title = extractTitle(artPath);
  const desc  = extractDesc(artPath);
  const url   = buildUrl();
  const now   = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

  let msg = `${meta.emoji} <b>${meta.section}</b> — ${dateStr}\n\n`;
  msg    += `<b>${title}</b>\n`;
  if (desc) msg += `\n${desc}\n`;
  msg    += `\n🔗 <a href="${url}">${url}</a>`;

  return msg;
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
          else reject(new Error(j.description));
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
    console.log(`Topic: ${meta.label} (${meta.topicId})`);
    console.log(msg.replace(/<[^>]+>/g, ''));
    return;
  }

  if (!BOT_TOKEN || !CHAT_ID) {
    console.error('❌ TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID manquants');
    process.exit(1);
  }

  try {
    const r = await send(msg, meta.topicId);
    console.log(`✅ Telegram → ${meta.label} (msg_id: ${r.message_id})`);
  } catch (e) {
    console.error('❌ Telegram failed:', e.message);
    process.exit(1);
  }
})();
