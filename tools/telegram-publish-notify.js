#!/usr/bin/env node
'use strict';
/**
 * telegram-publish-notify.js  v2 — AI-powered rich notifications
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
const { spawnSync } = require('child_process');

// ─── Config ───────────────────────────────────────────────────────────────────
const ROOT    = path.join(__dirname, '..');
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}

// Load from ~/.profile if not already in env
function loadProfile() {
  try {
    const profilePath = require('os').homedir() + '/.profile';
    const content = fs.readFileSync(profilePath, 'utf8');
    for (const line of content.split('\n')) {
      const m = line.match(/^export\s+([A-Z_][A-Z0-9_]*)=["']?(.+?)["']?$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {}
}
loadProfile();

const BOT_TOKEN    = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID      = process.env.TELEGRAM_CHAT_ID;
const ANTHROPIC_KEY= process.env.ANTHROPIC_API_KEY;

// ─── Token redaction helper (prevents BOT_TOKEN leak via stack traces) ─────
function redactToken(s) {
  if (!BOT_TOKEN || !s) return s;
  return String(s).split(BOT_TOKEN).join(BOT_TOKEN.slice(0, 6) + '…REDACTED');
}
const BASE_URL     = 'https://articles.dailytickers.com';
const DRY_RUN      = process.argv.includes('--dry-run');

if (!process.env.TELEGRAM_TOPIC_PORTFOLIO) console.warn('[topics] TELEGRAM_TOPIC_PORTFOLIO unset, fallback to default 72');
if (!process.env.TELEGRAM_TOPIC_DAILY)     console.warn('[topics] TELEGRAM_TOPIC_DAILY unset, fallback to default 73');
if (!process.env.TELEGRAM_TOPIC_WEEKLY)    console.warn('[topics] TELEGRAM_TOPIC_WEEKLY unset, fallback to default 74');
if (!process.env.TELEGRAM_TOPIC_ANALYSIS)  console.warn('[topics] TELEGRAM_TOPIC_ANALYSIS unset, fallback to default 75');
if (!process.env.TELEGRAM_TOPIC_LEARNING)  console.warn('[topics] TELEGRAM_TOPIC_LEARNING unset, fallback to default 76');
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

// --help
if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage: node tools/telegram-publish-notify.js --type <daily|weekly|scanner|retro|analysis|series|tech|learning> --path <relative/path/to/article> [--title "Override"] [--dry-run]`);
  process.exit(0);
}

const type     = getArg('--type')  || 'daily';
const artPath  = getArg('--path')  || '';
const titleArg = getArg('--title') || '';

// ─── Guard: --path is mandatory for production sends ─────────────────────────
if (!artPath && !DRY_RUN) {
  console.error('❌ --path is required. Example: --path daily/20260329/index.html');
  console.error('   Run with --dry-run to test without a real article.');
  process.exit(1);
}
if (artPath && !fs.existsSync(path.join(path.join(__dirname, '..'), artPath))) {
  console.error(`❌ Article not found: ${artPath}`);
  process.exit(1);
}

const TYPE_MAP = {
  daily    : { topicId: TOPICS.daily,     section: 'Daily Briefing',  emoji: '📰' },
  weekly   : { topicId: TOPICS.weekly,    section: 'Weekly Review',   emoji: '📊' },
  scanner  : { topicId: TOPICS.portfolio, section: 'Portfolio Scan',  emoji: '📈' },
  retro    : { topicId: TOPICS.portfolio, section: 'Retrospective',   emoji: '🔁' },
  analysis : { topicId: TOPICS.analysis,  section: 'Stock Analysis',  emoji: '🔍' },
  series   : { topicId: TOPICS.learning,  section: 'New Series',      emoji: '📚' },
  tech     : { topicId: TOPICS.learning,  section: 'Tech & Quant',    emoji: '💡' },
  learning : { topicId: TOPICS.learning,  section: 'Learning',        emoji: '🎓' },
};

const meta = TYPE_MAP[type] || TYPE_MAP.daily;

// ─── HTML helpers ─────────────────────────────────────────────────────────────
function readHtml(relPath) {
  try { return fs.readFileSync(path.join(ROOT, relPath), 'utf8'); } catch { return ''; }
}

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&[a-z#\d]+;/g, ' ')
    .replace(/\s+/g, ' ').trim();
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
  if (og) return og.replace(/\s*[–|]\s*DailyTickers.*$/i, '').trim()
                   .replace(/&mdash;/g,'—').replace(/&ndash;/g,'–').replace(/&amp;/g,'&');
  const t = html.match(/<title>([^<]+)/i);
  if (t) return t[1].replace(/\s*[–|—].*$/, '').trim();
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return h1[1].replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
  return '';
}

function getDesc(html) {
  const og = getMeta(html, 'og:description') || getMeta(html, 'description');
  return og ? og.replace(/\s+/g, ' ').trim() : '';
}

function buildUrl(relPath) {
  if (!relPath) return BASE_URL + '/scanner/status/';
  const clean = relPath.replace(/\/index\.html$/, '/').replace(/^\//, '');
  return BASE_URL + '/' + clean;
}

function getDateStr(relPath) {
  const m = relPath.match(/(\d{4})(\d{2})(\d{2})/);
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}`).toLocaleDateString('en-US',
    { weekday:'long', day:'numeric', month:'long', year:'numeric', timeZone:'UTC' });
  return new Date().toLocaleDateString('en-US',
    { weekday:'long', day:'numeric', month:'long', year:'numeric', timeZone:'UTC' });
}

// ─── AI notification builder ──────────────────────────────────────────────────
async function buildAINotification(html, url) {
  if (!ANTHROPIC_KEY) {
    console.log('  ⚠️  No ANTHROPIC_API_KEY — using fallback');
    return buildFallbackMessage(html, url);
  }

  const title   = getTitle(html);
  const desc    = getDesc(html);
  const dateStr = getDateStr(artPath);
  const text    = stripHtml(html);

  // Feed meaningful content to the AI (first 3000 chars of real content)
  const lines = text.split(/\s{2,}/).map(l => l.trim()).filter(l => l.length > 40);
  const body  = lines.slice(0, 70).join('\n').slice(0, 3000);

  // Detect section headers for structure
  const headings = [...html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)]
    .map(m => m[1].replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim())
    .filter(h => h.length > 5 && h.length < 80)
    .slice(0, 8);

  const typePrompts = {
    daily: `You are writing a TELEGRAM notification for a daily market briefing. Make it feel like a sharp morning note from a trader friend — the kind you actually want to read at 7am. Not a press release.

Structure:
1. One punchy headline line (bold, no filler)
2. Market snapshot: 4-6 key numbers WITH direction and context (not just values)
3. The narrative: 3-4 sentences explaining WHY markets moved — the story behind the numbers
4. 2-3 key bullets: what to watch, biggest risks, or opportunities
5. CTA link`,

    weekly: `You are writing a TELEGRAM notification for a weekly market review. Write like you're summarizing the week to a sharp investor friend over coffee.

Structure:
1. One punchy headline — what DEFINED this week
2. Weekly performance: top movers, key indices WITH % change and context
3. The theme: what macro story dominated? (2-3 sentences)
4. 3 key takeaways for the week ahead
5. CTA link`,

    analysis: `You are writing a TELEGRAM notification for a stock analysis deep-dive. Write like a confident analyst pitching a trade idea.

Structure:
1. Company name + ticker + one-sentence thesis
2. Key fundamentals: 3-4 numbers that matter (PE, growth, margin, etc.)
3. Technical setup: where it is vs key levels
4. The trade: entry zone, stop, target (if available in content)
5. Risk in one sentence
6. CTA link`,

    scanner: `You are writing a TELEGRAM notification for a portfolio scanner update. Market signals, top setups.

Structure:
1. Market regime: risk-on or risk-off today?
2. Top 3 signals from the scan with ticker + setup type + score
3. Key risk to watch
4. CTA link`,

    default: `You are writing a TELEGRAM notification for a financial article on DailyTickers. Make it engaging and informative — the kind of message that makes people want to read the full article.

Structure:
1. Bold headline
2. Key insight (2-3 sentences, the most important thing)
3. 2-3 bullets: what's in the article, why it matters
4. CTA link`,
  };

  const promptType = typePrompts[type] || typePrompts.default;

  const prompt = `${promptType}

ARTICLE INFO:
Title: ${title}
Date: ${dateStr}
Section: ${meta.section}
URL: ${url}

ARTICLE CONTENT:
${body}

${headings.length ? 'SECTION HEADERS:\n' + headings.join('\n') : ''}

RULES:
- Write in ENGLISH
- Use Telegram HTML: <b>bold</b>, <i>italic</i>, <code>numbers</code>, <a href="URL">text</a>
- Start with an EMOJI relevant to the content, then <b>bold title</b>
- Use ▸ for bullet points
- Numbers in <code>tags</code> (prices, percentages, etc.)
- Add context to every number: not just "S&P: <code>6,369</code>" but "S&P 500 <code>−1.67%</code> — fifth weekly loss, correction territory"
- Show emotion when warranted: "📉 Markets broke down this week" not "Markets declined"
- Maximum 35 lines total (phone-readable)
- End with: 🔗 <a href="${url}">Read full ${meta.section.toLowerCase()} →</a>
- DO NOT use markdown (no **, no ##, no ---)
- DO NOT include "DailyTickers" in the opening line (it's in the topic name already)`;

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: ANTHROPIC_KEY });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    let msg = response.content[0].text.trim();

    // Strip any accidental markdown fences
    msg = msg.replace(/^```[\w]*\n?/m, '').replace(/```$/m, '').trim();

    // Ensure the link is in there
    if (!msg.includes(url)) {
      msg += `\n\n🔗 <a href="${url}">Read full ${meta.section.toLowerCase()} →</a>`;
    }

    const lineCount = msg.split('\n').length;
    const wordCount = msg.replace(/<[^>]+>/g,'').split(/\s+/).length;
    console.log(`  🤖 AI notification: ${lineCount} lines, ${wordCount} words`);
    return msg;

  } catch (e) {
    console.error(`  ⚠️  AI notification failed (${e.message?.slice(0,80)}) — fallback`);
    return buildFallbackMessage(html, url);
  }
}

// ─── Fallback (no API key or API failure) ─────────────────────────────────────
function buildFallbackMessage(html, url) {
  const title   = getTitle(html);
  const desc    = getDesc(html);
  const dateStr = getDateStr(artPath);

  let msg = `${meta.emoji} <b>${title}</b>\n`;
  msg += `<i>${dateStr}</i>\n\n`;
  if (desc) msg += `${desc.slice(0, 280)}${desc.length > 280 ? '…' : ''}\n\n`;
  msg += `🔗 <a href="${url}">Read on DailyTickers →</a>`;
  return msg;
}

// ─── Send to Telegram ──────────────────────────────────────────────────────────
function send(text, topicId) {
  return new Promise((resolve, reject) => {
    const body    = {
      chat_id: CHAT_ID,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: false,  // show link preview for the article
    };
    if (topicId) body.message_thread_id = topicId;
    const payload = JSON.stringify(body);
    const opts = {
      hostname: 'api.telegram.org',
      path    : `/bot${BOT_TOKEN}/sendMessage`,
      method  : 'POST',
      headers : {
        'Content-Type'  : 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (j.ok) resolve(j.result);
          else reject(new Error(redactToken(j.description || JSON.stringify(j))));
        } catch (e) { reject(new Error(redactToken(e?.message || e))); }
      });
    });
    req.on('error', (e) => reject(new Error(redactToken(e?.message || e))));
    req.write(payload);
    req.end();
  });
}

// ─── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  const html = artPath ? readHtml(artPath) : '';
  const url  = buildUrl(artPath);

  let msg;
  if (html) {
    msg = await buildAINotification(html, url);
  } else {
    msg = `${meta.emoji} <b>New ${meta.section}</b>\n\nNew content published on DailyTickers.\n🔗 <a href="${url}">${url}</a>`;
  }

  if (DRY_RUN) {
    console.log('\n─── TELEGRAM PREVIEW ───');
    console.log(`Topic: ${meta.section} (thread ${meta.topicId})`);
    console.log('');
    console.log(msg.replace(/<b>|<\/b>/g,'**').replace(/<i>|<\/i>/g,'_')
                   .replace(/<code>|<\/code>/g,'`').replace(/<a href="[^"]+">([^<]+)<\/a>/g,'[$1]')
                   .replace(/<[^>]+>/g,''));
    console.log('\n─── RAW HTML ───');
    console.log(msg);
    return;
  }

  if (!BOT_TOKEN || !CHAT_ID) {
    console.error('❌ TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID manquants');
    process.exit(1);
  }

  try {
    const r = await send(msg, meta.topicId);
    console.log(`✅ Telegram → ${meta.section} (msg_id: ${r.message_id}, thread: ${meta.topicId})`);
  } catch (e) {
    console.error('❌ Telegram failed:', redactToken(e?.message || e));
    process.exit(1);
  }
})();
