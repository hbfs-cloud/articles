#!/usr/bin/env node
/**
 * generate-media.mjs
 * Generate a short YouTube video (≤5 min) + MP3 audio (≤2 min) for any published article.
 *
 * Pipeline:
 *  1. Extract article content
 *  2. Claude Haiku → edu-data.json (rich slides) + audio script
 *  3. edge-tts → audio.mp3  (≤2 min)
 *  4. edge-tts per-slide narration → segment MP3s
 *  5. puppeteer → slide PNGs via slides-to-html.js
 *  6. ffmpeg → video.mp4
 *  7. Upload to YouTube (Mac Mini)
 *  8. Send audio + notification to Telegram
 *
 * Usage:
 *   node tools/generate-media.mjs --type <daily|weekly|scanner|analysis|series|learning>
 *                                  --path <relative/path/to/article>
 *                                  [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, '..');
const VIDEOS    = path.join(ROOT, 'videos');
const SCRIPTS   = path.join(VIDEOS, 'scripts');

// ── Load .env ─────────────────────────────────────────────────────────────────
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}

// ── Config ────────────────────────────────────────────────────────────────────
const EDGE_TTS  = '/home/ci/edge-tts-venv/bin/edge-tts';
const PIPER_TTS = '/home/ci/edge-tts-venv/bin/piper';
const PIPER_MODEL = '/home/ci/piper-voices/en_US-ryan-high.onnx';
const FFMPEG    = 'ffmpeg';
const FFPROBE   = 'ffprobe';
const CHROMIUM  = '/snap/bin/chromium';
const VOICE     = 'en-US-AndrewNeural';  // edge-tts fallback voice
const RATE      = '+5%';
const PITCH     = '+8Hz';
const BASE_URL  = 'https://articles.market-watch.xyz';

// ── SSH Mac Mini (YouTube upload only — TTS is now local) ─────────────────────
const SSH_HOST  = 'marketwatchxyz@melouadis-mac-mini.tail5d09f.ts.net';
const SSH_OPTS  = '-o StrictHostKeyChecking=no -o PubkeyAuthentication=no';
const SSHPASS   = 'sshpass';
const SSH_PASS  = 'Elonux!123';
// YouTube credentials — prefer local CI copy, fallback to Mac Mini path
const YT_TOKEN  = fs.existsSync(path.join(ROOT, 'credentials/youtube-token.json'))
  ? path.join(ROOT, 'credentials/youtube-token.json')
  : '/Users/marketwatchxyz/GolandProjects/video-factory/credentials/youtube-token.json';
const YT_CREDS  = fs.existsSync(path.join(ROOT, 'credentials/youtube-credentials.json'))
  ? path.join(ROOT, 'credentials/youtube-credentials.json')
  : '/Users/marketwatchxyz/GolandProjects/video-factory/credentials/youtube-credentials.json';

// ── Args ──────────────────────────────────────────────────────────────────────
const args   = process.argv.slice(2);
const getArg = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i+1] : null; };
const type    = getArg('--type')  || 'daily';
const artPath = getArg('--path')  || '';
const DRY_RUN = args.includes('--dry-run');
const NO_TELEGRAM = args.includes('--no-telegram');

// ── Type metadata ─────────────────────────────────────────────────────────────
const TYPE_META = {
  daily:    { label: 'Daily Briefing',    emoji: '📰', telegramTopic: 90, ytPlaylist: 'PLv96IetLrmtWfdEl9tObkSLaw_HFt39me' },
  weekly:   { label: 'Weekly Review',     emoji: '📊', telegramTopic: 90, ytPlaylist: 'PLv96IetLrmtWXigx6hLMoABNWsVhli2Vv' },
  scanner:  { label: 'Scanner Signals',   emoji: '🔍', telegramTopic: 89, ytPlaylist: 'PLv96IetLrmtVZZpO-M1Y6NDJETXw9zrU9' },
  analysis: { label: 'Stock Analysis',    emoji: '🔬', telegramTopic: 90, ytPlaylist: 'PLv96IetLrmtU4Yff6kHAvSr3wJNYgXQ3R' },
  learning: { label: 'Trading Education', emoji: '🎓', telegramTopic: 91, ytPlaylist: 'PLv96IetLrmtV0UT9I-V95wPvXs9crtbyL' },
  series:   { label: 'Expert Series',     emoji: '🎯', telegramTopic: 91, ytPlaylist: 'PLv96IetLrmtV0UT9I-V95wPvXs9crtbyL' },
  retro:    { label: 'Scanner Retrospective', emoji: '🔁', telegramTopic: 89, ytPlaylist: 'PLv96IetLrmtVZZpO-M1Y6NDJETXw9zrU9' },
  tech:     { label: 'Tech Watch',       emoji: '💻', telegramTopic: 91, ytPlaylist: 'PLv96IetLrmtV0UT9I-V95wPvXs9crtbyL' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function readHtml(relPath) {
  const p = relPath.startsWith('/') ? relPath : path.join(ROOT, relPath);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&mdash;/g, '—').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function getTitle(html) {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (m) return m[1].split('|')[0].trim().replace(/&mdash;/g,'—').replace(/&amp;/g,'&').replace(/&[a-z]+;/g,' ');
  const h = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  return h ? h[1].trim().replace(/&mdash;/g,'—').replace(/&amp;/g,'&').replace(/&[a-z]+;/g,' ') : 'Market Watch';
}

function getDesc(html) {
  const m = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  return m ? m[1].trim() : '';
}

function buildUrl(relPath) {
  if (!relPath) return BASE_URL;
  const parts = relPath.replace(/\/index\.html$/, '').split('/');
  return `${BASE_URL}/${parts.join('/')}`;
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

function getDate(relPath) {
  const m = relPath.match(/(\d{4})(\d{2})(\d{2})/);
  if (!m) return { dateStr: new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }), dateISO: '' };
  const dateISO = `${m[1]}-${m[2]}-${m[3]}`;
  const dateStr = new Date(dateISO).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return { dateStr, dateISO };
}

// ── Finviz chart URLs ─────────────────────────────────────────────────────────
function finvizUrl(ticker, period = 'd') {
  return `https://finviz.com/chart.ashx?t=${ticker}&ty=c&ta=1&p=${period}&s=l`;
}

// ── Fetch Finviz chart as base64 data URI ────────────────────────────────────
async function fetchFinvizBase64(ticker) {
  // Finviz blocks datacenter IPs — fetch via Mac Mini (residential IP)
  const url = `https://finviz.com/chart.ashx?t=${ticker}&ty=c&ta=1&p=d&s=l`;
  const sshCmd = `sshpass -p 'Elonux!123' ssh -o StrictHostKeyChecking=no -o PubkeyAuthentication=no -o ConnectTimeout=10 marketwatchxyz@melouadis-mac-mini.tail5d09f.ts.net "curl -sL -A 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' --referer 'https://finviz.com/' '${url}' | base64"`;
  try {
    const { execSync } = (await import('child_process'));
    const b64 = execSync(sshCmd, { timeout: 20000, encoding: 'utf8' }).trim().replace(/\s+/g, '');
    return (b64 && b64.length > 500) ? 'data:image/png;base64,' + b64 : null;
  } catch {
    return null;
  }
}

// ── Scanner HTML parser → 6 structured slides ───────────────────────────────
function buildScannerSlides(html, content, dateStr) {
  // 1. Parse regime — TAXONOMY: RISK-ON | EARLY RISK-OFF | RISK-OFF | NEUTRAL | RECOVERY only
  //    Normalize any variant (e.g. "DEEP RISK-OFF", "STRONG RISK-ON") to the official 5 labels
  const regimeMatch = html.match(/badge[^>]*>(🔴|🟡|🟢|⚪)\s*([^<]{3,40})<\//i)
    || html.match(/kpi-value[^>]*>([^<]*(?:risk-off|risk-on|neutral|recovery)[^<]*)<\/span>/i)
    || html.match(/Market Regime:\s*([^<\n]+)/i);
  function normalizeRegime(raw) {
    if (!raw) return 'RISK-OFF'; // safe default
    const s = raw.toUpperCase().trim();
    if (s.includes('EARLY RISK-OFF') || s.includes('EARLY-RISK-OFF')) return 'EARLY RISK-OFF';
    if (s.includes('RISK-OFF') || s.includes('RISK OFF')) return 'RISK-OFF';
    if (s.includes('EARLY RISK-ON') || s.includes('EARLY-RISK-ON')) return 'RISK-ON';
    if (s.includes('RISK-ON') || s.includes('RISK ON')) return 'RISK-ON';
    if (s.includes('RECOVERY')) return 'RECOVERY';
    if (s.includes('NEUTRAL')) return 'NEUTRAL';
    return 'RISK-OFF'; // default when unknown
  }
  const regimeRaw = regimeMatch ? (regimeMatch[2] || regimeMatch[1]) : null;
  const regime = normalizeRegime(regimeRaw);
  const regimeEmoji = regime === 'RISK-OFF' || regime === 'EARLY RISK-OFF' ? '🔴'
    : regime === 'RISK-ON' ? '🟢'
    : regime === 'NEUTRAL' ? '🟡' : '⚪';

  // 2. Parse title tickers
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const titleText = titleMatch ? titleMatch[1] : '';

  // 3. Parse regime thesis (2-line summary)
  const regimeThesisMatch = html.match(/Regime Thesis<\/h4>\s*<p>([\s\S]*?)<\/p>/i);
  const regimeThesis = regimeThesisMatch
    ? regimeThesisMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 250)
    : '';

  // 4. Parse top sectors from setup badges
  const sectorBadges = [...html.matchAll(/badge badge-orange">([^<]+)<\/span>/g)].map(m => m[1]);
  const topSectors = [...new Set(sectorBadges)].slice(0, 4);

  // 5. Parse open positions for slide 1 — timeout & watch
  const openPosMatch = html.match(/tracking\s*<strong>(\d+)\s*open positions/i);
  const openCount = openPosMatch ? parseInt(openPosMatch[1]) : 0;

  // 6. Parse the synthese table for all 10 setups
  const setups = [];
  const tableRows = [...html.matchAll(/<tr><td>\d+<\/td><td><strong>([A-Z.]+)<\/strong><\/td><td>([^<]+)<\/td><td>([^<]+)<\/td><td>([^<]+)<\/td><td>(\d+)<\/td><td>([^<]+)<\/td><td>([^<]+)<\/td><td>([^<]+)<\/td><td>([^<]+)<\/td><td>([^<]+)<\/td><\/tr>/g)];
  for (const m of tableRows) {
    setups.push({
      ticker: m[1], name: m[2].replace(/&amp;/g, '&'), sector: m[3],
      strategy: m[4], score: parseInt(m[5]),
      entry: m[6], stop: m[7], tp1: m[8], tp2: m[9], rr: m[10],
    });
  }

  // 7. Parse investment thesis per ticker (first 3 setups for slides 4-6)
  const theses = {};
  for (const s of setups.slice(0, 3)) {
    const thesisRe = new RegExp(`id="setup-${s.ticker}"[\\s\\S]*?Investment Thesis<\\/h4>\\s*<p>([\\s\\S]*?)<\\/p>`, 'i');
    const tm = html.match(thesisRe);
    if (tm) {
      theses[s.ticker] = tm[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim().slice(0, 200);
    }
  }

  // 8. Parse portfolio metrics from intro
  const spMatch = html.match(/S&amp;P 500[^<]*?(-?\d+\.?\d*%)/);
  const spChange = spMatch ? spMatch[1] : '';
  const nasdaqMatch = html.match(/NASDAQ[^<]*?(-?\d+\.?\d*%)/);
  const nasdaqChange = nasdaqMatch ? nasdaqMatch[1] : '';
  const wtiMatch = html.match(/WTI[^<]*?\$(\d+\.?\d*)/);
  const wtiPrice = wtiMatch ? '$' + wtiMatch[1] : '';

  // 9. Parse KPI values
  const avgScoreMatch = html.match(/Avg Score<\/span>\s*<span[^>]*>(\d+\.?\d*)/);
  const avgScore = avgScoreMatch ? avgScoreMatch[1] : '';

  // Build 6 slides
  const slides = [];

  // ── Slide 1: Portfolio Actions (dark urgent)
  const newOrders = setups.slice(0, 5).map(s =>
    `${s.ticker} · Entry ${s.entry} · Stop ${s.stop} · TP1 ${s.tp1} · R/R ${s.rr}`
  ).join('\n');
  slides.push({
    type: 'scanner-actions',
    title: `⚡ Today's Actions — ${dateStr}`,
    openCount,
    newSetups: setups.slice(0, 5).map(s => ({
      ticker: s.ticker, entry: s.entry, stop: s.stop, tp1: s.tp1, rr: s.rr,
    })),
    narration: `${setups.length} new A-plus setups today. ${regime} regime — ${topSectors.join(', ')} leading. Here are your orders.`,
  });

  // ── Slide 2: Portfolio State (dark blue)
  slides.push({
    type: 'scanner-portfolio',
    title: `📂 Portfolio — ${openCount} open positions`,
    positions: setups.slice(0, 6).map(s => ({
      ticker: s.ticker, sector: s.sector, strategy: s.strategy, score: s.score,
    })),
    metrics: {
      regime, avgScore,
      spChange, nasdaqChange, wtiPrice,
    },
    narration: `Portfolio running ${openCount} slots. Average score ${avgScore}. S and P ${spChange}, NASDAQ ${nasdaqChange}. Energy dominates the book.`,
  });

  // ── Slide 3: Market Analysis (neutral)
  slides.push({
    type: 'scanner-market',
    title: `📊 Market Context — ${dateStr}`,
    regime,
    regimeEmoji,
    thesis: regimeThesis,
    topSectors,
    metrics: { spChange, nasdaqChange, wtiPrice },
    narration: `${regime} confirmed. ${regimeThesis.slice(0, 100)}. The scanner leans into ${topSectors.slice(0, 2).join(' and ')}.`,
  });

  // ── Slides 4-6: Top 3 Setup cards with Finviz
  const topSetups = setups.slice(0, 3);
  for (const s of topSetups) {
    const thesis = theses[s.ticker] || `${s.strategy} setup on ${s.ticker} with score ${s.score}/100.`;
    slides.push({
      type: 'scanner-setup',
      ticker: s.ticker,
      title: `${s.ticker} — ${s.strategy} · Score ${s.score}/100`,
      name: s.name,
      sector: s.sector,
      strategy: s.strategy,
      score: s.score,
      finvizUrl: finvizUrl(s.ticker),
      thesis: thesis.slice(0, 180),
      levels: [
        { label: 'Entry', value: s.entry, type: 'entry' },
        { label: 'Stop', value: s.stop, type: 'stop' },
        { label: 'TP1', value: s.tp1, type: 'tp1' },
        { label: 'TP2', value: s.tp2, type: 'tp2' },
        { label: 'R/R', value: s.rr, type: 'rr' },
      ],
      narration: `${s.ticker} — ${s.strategy} at score ${s.score}. Entry ${s.entry}, stop ${s.stop}, target ${s.tp1}. Risk reward ${s.rr}. ${s.sector} play in this ${regime} regime.`,
    });
  }

  return slides;
}

// ── Resolve API key: env var → Claude OAuth token from credentials ───────────
function resolveApiKey() {
  // 1. Environment variable (set by cron or shell)
  if (process.env.ANTHROPIC_API_KEY) {
    // Validate it's not an expired OAuth token by checking freshness
    const key = process.env.ANTHROPIC_API_KEY;
    if (key.startsWith('sk-ant-api')) return key; // Real API key, always valid
  }
  // 2. Fresh OAuth token from Claude Code credentials
  try {
    const credsPath = path.join(require('os').homedir(), '.claude', '.credentials.json');
    const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
    const oauth = creds.claudeAiOauth;
    if (oauth?.accessToken && oauth.expiresAt > Date.now()) {
      return oauth.accessToken;
    }
  } catch {}
  // 3. Fallback to env var even if OAuth (might work if recently refreshed)
  return process.env.ANTHROPIC_API_KEY || null;
}

// ── AI slide + script generation ──────────────────────────────────────────────
async function generateAIContent(html, url, dateStr, title, meta) {
  const apiKey = resolveApiKey();
  if (!apiKey) { console.log('  ⚠️  No ANTHROPIC_API_KEY'); return null; }

  const raw  = stripHtml(html);
  const lines = raw.split(/\s{2,}/).map(l => l.trim()).filter(l => l.length > 40);
  const body  = lines.slice(0, 80).join('\n').slice(0, 5000);

  // Extract potential ticker symbols from article
  const tickers = [...new Set([...body.matchAll(/\b([A-Z]{2,5})\b/g)].map(m => m[1])
    .filter(t => !['THE', 'AND', 'FOR', 'VIX', 'GDP', 'PCE', 'FED', 'SEC', 'IPO', 'ETF', 'SPX', 'USA', 'EUR', 'USD'].includes(t)))].slice(0, 3);

  const typeGuide = {
    daily:    `a 5-minute Daily Market Briefing video. Structure: market snapshot with charts, key macro catalysts (WHY not just WHAT), top movers with Finviz charts, what to watch next. Use metric-row for data, chart-image for Finviz, event-timeline for news flow.`,
    weekly:   `a 5-minute Weekly Review video. Structure: week's dominant theme, macro forces at play, sector performance, what changed vs last week, setup for next week. Rich data viz — metric rows, event timelines, performance tables.`,
    scanner:  `a 5-minute Scanner Signals video. Structure: market regime context, top 3 setups with trade levels, risk/reward, entry triggers. Use trade-levels slides, chart-image for each ticker, metric rows for key stats.`,
    analysis: `a 5-minute Stock Analysis deep-dive. Structure: company overview, investment thesis, technical setup with Finviz chart, key levels (entry/stop/targets), fundamental metrics, risks. Use chart-image, trade-levels, metric-row, table for financials.`,
    learning: `a 5-minute educational video. Structure: concept intro, step-by-step explanation, real market examples, key takeaways. Use didactic boxes, steps, tips, comparison slides, quiz at end.`,
    series:   `a 5-minute expert series episode. Structure: context, deep analysis, practical application, key insights. Rich visuals.`,
  };

  const prompt = `You are a young, dynamic financial analyst creating an engaging video for Market Watch — think Bloomberg meets TikTok finance. Your voice is confident, direct, fast-paced. You speak like you're explaining a trade to a sharp friend, not reading a report.

ARTICLE: ${title}
DATE: ${dateStr}
URL: ${url}
CONTENT:
${body}

Create ${typeGuide[type] || typeGuide.daily}

## TONE & STYLE
- Narrator: young analyst, 28 years old, sharp, confident, slightly excited when there's a big move
- Script style: punchy sentences. Short. Hit the why. Show surprise when warranted. "Look at this — S&P down 2% AND yields up? That's a double hit."
- Slides: visually rich, light theme (white backgrounds), colored data, no dark backgrounds on data slides
- Each narration: ADDS CONTEXT to what's on screen — don't just read the slide, explain WHY it matters
- Emotion: if markets crashed, convey the weight. If a stock popped 15%, show the excitement.

## SLIDE NARRATION RULES
Each narration field must:
1. Start with a strong opener — never "In this slide..." or "Here we see..."
2. Add ONE key insight not visible on screen
3. End with a forward-looking statement or question (keeps viewer watching)
4. Be 25-45 words — tight and punchy

Good example: "S&P down two-point-four percent — but here's what's really moving markets: the yield curve just inverted again. That's the recession signal everyone's been watching. Does the Fed have room to cut? We'll see next slide."

Bad example: "This slide shows the market metrics for the week. The S&P 500 was down and volatility increased."

## REQUIRED OUTPUT FORMAT
Return ONLY valid JSON, no markdown fences, no explanation:
{
  "audioScript": "90-second punchy audio summary. Sharp hook — start with the biggest number or surprise. WHY things happened, not just what. 2-3 specific data points with context. One forward-looking question or insight at end. 220-240 words. Sound like a 28-year-old Bloomberg analyst on caffeine.",
  "telegramBullets": ["📉 S&P drops 2.4% — worst week since 2022 selloff", "🔥 VIX spikes to 28 as recession fears return", "put 5-10 punchy bullets here with REAL data from the article"],
  "config": {
    "seriesTitle": "${title}",
    "date": "${dateStr}",
    "language": "en",
    "accentColor": "#2563EB"
  },
  "slides": [
    {
      "type": "chapter-intro",
      "icon": "📊",
      "chapter": { "title": "Punchy chapter title", "subtitle": "One bold sentence describing what happened", "partNumber": 1, "totalParts": 4 },
      "narration": "Hook narration — start with the most dramatic or surprising thing from this article. Make them want to keep watching."
    },
    {
      "type": "metric-row",
      "title": "This Week — By The Numbers",
      "metrics": [
        {"label": "S&P 500", "value": "-2.4%", "delta": "Worst week in 3 months", "trend": "down", "context": "5th consecutive weekly loss"},
        {"label": "VIX", "value": "28.5", "delta": "+8.2 spike", "trend": "up", "context": "Fear back at 2022 levels"}
      ],
      "narration": "25-45 words — explain WHY these numbers matter, what's driving them, and what the viewer should feel about this."
    },
    {
      "type": "event-timeline",
      "title": "What Drove Markets This Week",
      "events": [
        {"time": "Mon", "title": "Specific real event from article", "impact": "High", "desc": "One sentence context"},
        {"time": "Wed", "title": "Another real event", "impact": "Medium", "desc": "Context"}
      ],
      "narration": "Walk through the week's narrative. What was the turning point? When did sentiment shift?"
    },
    {
      "type": "highlight",
      "title": "The Big Picture",
      "text": "The single most important insight — the thesis an investor needs to understand right now.",
      "icon": "💡",
      "sentiment": "insight",
      "narration": "Deliver the core insight like you're letting someone in on a secret. Direct, confident, slightly conspiratorial."
    },
    {
      "type": "performance",
      "title": "Winners & Losers",
      "tickers": [
        {"symbol": "XOM", "name": "Exxon Mobil", "perf": 2.1, "note": "Energy bid on oil supply fears"},
        {"symbol": "NVDA", "name": "Nvidia", "perf": -3.8, "note": "Rate sensitivity hits growth"}
      ],
      "narration": "Name the winners and losers — but more importantly, explain the STORY behind the moves."
    },
    {
      "type": "summary",
      "title": "What To Watch Now",
      "items": ["Specific actionable insight #1 with real data", "Specific actionable insight #2", "What could change the thesis"],
      "narration": "Land the takeaways with conviction. This is what the viewer remembers. Make it count."
    }
  ]
}

## HARD RULES
- audioScript: NO "Welcome to Market Watch", NO "Thanks for watching", NO "See you next time", NO "In this video"
- Start audioScript with the biggest number, surprise, or emotion: "S&P just had its worst week..." or "Something broke in markets this week..."
- metric-row: use EXACT numbers from the article — no placeholders
- performance: use REAL tickers and REAL percentage moves from the article
- trade-levels: ONLY include if real entry/stop/target levels exist in the article text
- chart-image: use real Finviz URLs: https://finviz.com/chart.ashx?t=TICKER&ty=c&ta=1&p=d&s=l
- slide narration: NEVER starts with "This slide", "Here we can see", "In this section"
- Minimum 7 slides, maximum 10 slides
- Each narration 25-45 words, total narration sum 450-550 words
- telegramBullets: 5-10 strings, each starts with emoji, 8-15 words, REAL data from article`;

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });
    console.log('  🤖 Generating AI content (Haiku)...');
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw_resp = response.content[0].text.trim();
    // Strip markdown fences if present
    const jsonStr = raw_resp.replace(/^```json\s*/,'').replace(/^```\s*/,'').replace(/\s*```$/,'');
    const data = JSON.parse(jsonStr);
    const slideCount = (data.slides || []).length;
    const wc = data.audioScript?.split(/\s+/).length || 0;
    const bc = (data.telegramBullets || []).length;
    console.log(`  ✅ AI content: ${slideCount} slides, ${wc}w audio script, ${bc} telegram bullets`);
    return data;
  } catch (e) {
    console.error(`  ❌ AI content error: ${e.message?.slice(0,120)}`);
    return null;
  }
}

// ── Fallback slide data ───────────────────────────────────────────────────────
function fallbackContent(html, url, dateStr, title, meta) {
  const raw = stripHtml(html);
  const desc = getDesc(html) || raw.slice(0, 300);

  // Extract key points from HTML sections (h2/h3 headings + first paragraph)
  const headings = [...html.matchAll(/<h[23][^>]*>([^<]+)<\/h[23]>/gi)]
    .map(m => m[1].replace(/&[a-z]+;/g, ' ').trim())
    .filter(h => h.length > 3 && h.length < 80)
    .slice(0, 8);

  // Extract key metrics (numbers with % or $)
  const metrics = [...raw.matchAll(/(?:S&P|NASDAQ|BTC|ETH|Gold|Oil|VIX|DXY|WTI)[^.]*?(-?\d+\.?\d*%|\$[\d,.]+)/gi)]
    .map(m => m[0].trim().slice(0, 60))
    .slice(0, 5);

  // Build meaningful audio script from description
  const audioScript = desc.length > 50
    ? `${title}. ${desc.slice(0, 500)}. Full analysis at articles.market-watch.xyz.`
    : `${title}. Full analysis at articles.market-watch.xyz.`;

  // Build telegram bullets from headings + metrics
  const telegramBullets = [];
  if (metrics.length > 0) telegramBullets.push(`📊 ${metrics.join(' | ')}`);
  for (const h of headings.slice(0, 6)) {
    const emoji = h.match(/risk|alert|warning/i) ? '⚠️' : h.match(/crypto|bitcoin/i) ? '₿' : h.match(/oil|energy|commodity/i) ? '🛢️' : h.match(/outlook|forecast/i) ? '🔮' : '📌';
    telegramBullets.push(`${emoji} ${h}`);
  }
  if (telegramBullets.length === 0) telegramBullets.push(`📌 ${desc.slice(0, 100)}`);

  // Build richer slides
  const slides = [
    { type: 'chapter-intro', chapter: { title, subtitle: dateStr, partNumber: 1, totalParts: 1 }, narration: title },
  ];
  if (metrics.length > 0) {
    slides.push({ type: 'metric-row', title: 'Market Snapshot', metrics: metrics.map(m => ({ label: m.split(/[-+$]/)[0].trim(), value: m.match(/[-+]?\d+\.?\d*%|\$[\d,.]+/)?.[0] || '', delta: '' })), narration: `Key numbers: ${metrics.join('. ')}.` });
  }
  for (const h of headings.slice(0, 4)) {
    slides.push({ type: 'summary', title: h, items: [desc.slice(0, 120)], narration: h });
  }
  slides.push({ type: 'summary', title: 'Read More', items: [`Full article at ${url}`], narration: 'Full article available online at articles.market-watch.xyz.' });

  return {
    audioScript,
    telegramBullets,
    config: { seriesTitle: title, date: dateStr, language: 'en', accentColor: '#3b82f6', totalChapters: slides.length },
    slides,
  };
}

// ── TTS — Piper TTS (local, ARM64 optimized) with edge-tts fallback ──────────
function runTTS(text, outPath) {
  const wavPath = outPath.replace(/\.mp3$/, '.wav');
  const cleanText = text.replace(/\n/g, ' ').trim();
  if (!cleanText) { console.log(`  ⚠️  Empty text, skipping TTS for ${path.basename(outPath)}`); return; }

  // Primary: Piper TTS (100% local, ~0.5s per sentence)
  try {
    const r = spawnSync('sh', ['-c', `echo '${cleanText.replace(/'/g, "'\\''")}' | '${PIPER_TTS}' --model '${PIPER_MODEL}' --output_file '${wavPath}'`], { stdio: 'pipe', timeout: 60000 });
    if (fs.existsSync(wavPath) && fs.statSync(wavPath).size > 1000) {
      // Convert WAV → MP3
      spawnSync(FFMPEG, ['-y', '-i', wavPath, '-codec:a', 'libmp3lame', '-qscale:a', '3', outPath], { stdio: 'pipe', timeout: 30000 });
      try { fs.unlinkSync(wavPath); } catch {}
      if (fs.existsSync(outPath) && fs.statSync(outPath).size > 500) {
        const size = Math.round(fs.statSync(outPath).size / 1024);
        console.log(`  ✅ ${path.basename(outPath)} (${size}KB) [Piper TTS]`);
        return;
      }
    }
    console.error('  ⚠️  Piper TTS failed, trying edge-tts fallback...');
  } catch (e) {
    console.error(`  ⚠️  Piper TTS error: ${e.message?.slice(0, 80)}, trying edge-tts fallback...`);
  }
  try { fs.unlinkSync(wavPath); } catch {}

  // Fallback: edge-tts (Microsoft free API)
  const txtPath = outPath + '.txt';
  fs.writeFileSync(txtPath, cleanText, 'utf8');
  spawnSync(EDGE_TTS, ['--voice', VOICE, `--rate=${RATE}`, `--pitch=${PITCH}`, '-f', txtPath, '--write-media', outPath], { stdio: 'pipe', timeout: 60000 });
  try { fs.unlinkSync(txtPath); } catch {}
  const size = fs.existsSync(outPath) ? Math.round(fs.statSync(outPath).size / 1024) : 0;
  if (size > 0) {
    console.log(`  ✅ ${path.basename(outPath)} (${size}KB) [edge-tts fallback]`);
  } else {
    console.error(`  ❌ Both Piper and edge-tts failed for ${path.basename(outPath)}`);
  }
}

function audioDuration(mp3Path) {
  if (!fs.existsSync(mp3Path)) return 5;
  const r = spawnSync(FFPROBE, ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3Path], { stdio: 'pipe' });
  return parseFloat(r.stdout?.toString().trim()) || 5;
}

// ── Slide screenshots via puppeteer + custom renderer ────────────────────────
async function screenshotSlides(slides, config, outDir) {
  const { renderSlidesToPng } = await import(path.join(__dirname, 'slides-renderer.mjs'));
  return renderSlidesToPng(slides, config, outDir);
}

// ── Fallback slide screenshots (Pillow) ──────────────────────────────────────
async function screenshotFallback(slides, config, outDir) {
  const PYTHON = '/home/ci/edge-tts-venv/bin/python3';
  const SCRIPT = path.join(__dirname, 'make-slides.py');

  const pillowSlides = slides.map(s => {
    if (s.type === 'chapter-intro') return { type: 'intro', title: s.chapter?.title || config.seriesTitle, date: config.date, badge: '📊 ' + config.date };
    if (s.type === 'metric-row') return { type: 'snapshot', header: s.title, items: (s.metrics||[]).map(m => ({ label: m.label, value: m.value, change: m.delta || '' })) };
    if (s.type === 'summary') return { type: 'content', header: s.title, bullets: s.items || [] };
    if (s.type === 'highlight') return { type: 'content', header: s.title, bullets: [s.text || ''] };
    if (s.type === 'bullets') return { type: 'content', header: s.title, bullets: s.items || [] };
    return { type: 'outro', url: 'articles.market-watch.xyz', subtitle: 'Follow us on Telegram for daily signals' };
  });
  pillowSlides.push({ type: 'outro', url: 'articles.market-watch.xyz', subtitle: 'Follow us on Telegram — @MarketWatchXYZ' });

  const dataFile = path.join(outDir, 'slides-data.json');
  fs.writeFileSync(dataFile, JSON.stringify({ slides: pillowSlides }), 'utf8');
  const r = spawnSync(PYTHON, [SCRIPT, '--data-file', dataFile, '--outdir', outDir], { stdio: 'pipe' });
  if (r.stderr) process.stderr.write(r.stderr);
  return fs.readdirSync(outDir).filter(f => /^slide-\d+\.png$/.test(f)).sort((a,b) => {
    return parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]);
  }).map(f => path.join(outDir, f));
}

// ── Generate per-slide audio segments ────────────────────────────────────────
function generateSegmentAudio(slides, outDir) {
  const audioPaths = [];
  for (let i = 0; i < slides.length; i++) {
    const text = (slides[i].narration || slides[i].title || '').trim();
    if (!text) {
      audioPaths.push(null);
      continue;
    }
    const outPath = path.join(outDir, `seg-${i}.mp3`);
    runTTS(text, outPath);
    audioPaths.push(fs.existsSync(outPath) ? outPath : null);
  }
  return audioPaths;
}

// ── Build video ───────────────────────────────────────────────────────────────
function buildVideo(pngPaths, segAudios, outPath) {
  // Each slide: duration = segment audio duration, or 5s min
  const durations = pngPaths.map((_, i) => {
    const a = segAudios[i];
    return a ? Math.max(audioDuration(a), 3) + 0.5 : 5;
  });

  // Concat audio segments
  const concatAudioTxt = outPath + '.audio-concat.txt';
  const validSegments = segAudios.filter(Boolean);
  if (validSegments.length === 0) {
    console.log('  ⚠️  No segment audio — using silent video');
    buildSilentVideo(pngPaths, durations, outPath);
    return;
  }

  // Write audio concat list (with silence padding between slides)
  const concatLines = [];
  segAudios.forEach((a, i) => {
    if (a) concatLines.push(`file '${a}'`);
    else {
      // Generate 3s silence
      const silPath = outPath + `.sil-${i}.mp3`;
      spawnSync(FFMPEG, ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '3', silPath], { stdio: 'pipe' });
      concatLines.push(`file '${silPath}'`);
    }
  });
  fs.writeFileSync(concatAudioTxt, concatLines.join('\n'), 'utf8');
  const mergedAudio = outPath + '.merged.mp3';
  spawnSync(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', concatAudioTxt, '-c', 'copy', mergedAudio], { stdio: 'pipe' });

  // Build video concat
  const concatVideoTxt = outPath + '.video-concat.txt';
  const videoLines = [];
  pngPaths.forEach((p, i) => {
    videoLines.push(`file '${p}'`);
    videoLines.push(`duration ${durations[i].toFixed(2)}`);
  });
  videoLines.push(`file '${pngPaths[pngPaths.length - 1]}'`);  // last frame duplicate
  fs.writeFileSync(concatVideoTxt, videoLines.join('\n'), 'utf8');

  spawnSync(FFMPEG, [
    '-y',
    '-f', 'concat', '-safe', '0', '-i', concatVideoTxt,
    '-i', mergedAudio,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-c:a', 'aac', '-b:a', '128k',
    '-pix_fmt', 'yuv420p',
    '-shortest',
    outPath,
  ], { stdio: 'pipe', timeout: 300000 });

  // Cleanup
  try { fs.unlinkSync(concatAudioTxt); fs.unlinkSync(concatVideoTxt); fs.unlinkSync(mergedAudio); } catch {}
}

function buildSilentVideo(pngPaths, durations, outPath) {
  const concatTxt = outPath + '.concat.txt';
  const lines = pngPaths.map((p, i) => `file '${p}'\nduration ${durations[i].toFixed(2)}`);
  lines.push(`file '${pngPaths[pngPaths.length - 1]}'`);
  fs.writeFileSync(concatTxt, lines.join('\n'), 'utf8');
  spawnSync(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', concatTxt, '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-pix_fmt', 'yuv420p', outPath], { stdio: 'pipe' });
  try { fs.unlinkSync(concatTxt); } catch {}
}

// ── YouTube upload via Mac Mini ───────────────────────────────────────────────
function uploadToYouTube(videoPath, thumbPath, title, description, playlistId) {
  const sshCmd = (cmd) => spawnSync('bash', ['-c', `${SSHPASS} -p '${SSH_PASS}' ssh ${SSH_OPTS} ${SSH_HOST} '${cmd}'`], { stdio: 'pipe', timeout: 30000 });
  const scpCmd = (local, remote) => spawnSync('bash', ['-c', `${SSHPASS} -p '${SSH_PASS}' scp ${SSH_OPTS} '${local}' ${SSH_HOST}:${remote}`], { stdio: 'pipe', timeout: 300000 });

  console.log('\n📤 Uploading to YouTube...');
  sshCmd('mkdir -p /tmp/mw-upload');
  const copyResult = scpCmd(videoPath, '/tmp/mw-upload/video.mp4');
  if (copyResult.status !== 0) {
    console.error('  ❌ SCP failed:', copyResult.stderr?.toString().slice(0,100));
    return null;
  }
  if (thumbPath && fs.existsSync(thumbPath)) {
    scpCmd(thumbPath, '/tmp/mw-upload/thumb.png');
  }

  const escTitle = title.replace(/'/g, "\\'").replace(/"/g, '\\"').slice(0, 100);
  const escDesc  = description.replace(/'/g, "\\'").replace(/`/g, '').slice(0, 4000);

  // Write upload script to file to avoid shell escaping issues
  const ytDescClean = description.replace(/[`\\$]/g, '').replace(/\n/g, '\\n').slice(0, 3000);
  const ytTitleClean = title.replace(/'/g, '').replace(/"/g, '').slice(0, 100);
  const pyScript = [
    'import json,sys,os,warnings',
    'warnings.filterwarnings("ignore")',
    'from google.oauth2.credentials import Credentials',
    'from googleapiclient.discovery import build',
    'from googleapiclient.http import MediaFileUpload',
    // Always use Mac Mini paths in the remote Python script
    `t=json.load(open('/Users/marketwatchxyz/GolandProjects/video-factory/credentials/youtube-token.json'))`,
    `c=json.load(open('/Users/marketwatchxyz/GolandProjects/video-factory/credentials/youtube-credentials.json'))['web']`,
    'creds=Credentials(token=t["access_token"],refresh_token=t["refresh_token"],token_uri=c["token_uri"],client_id=c["client_id"],client_secret=c["client_secret"])',
    'yt=build("youtube","v3",credentials=creds)',
    'meta=json.load(open("/tmp/mw-yt-meta.json"))',
    'body={"snippet":{"title":meta["title"],"description":meta["description"],"categoryId":"25","defaultLanguage":"en","tags":["Market Watch","finance","trading"]},"status":{"privacyStatus":"public"}}',
    'media=MediaFileUpload("/tmp/mw-upload/video.mp4",mimetype="video/mp4",resumable=True)',
    'req=yt.videos().insert(part="snippet,status",body=body,media_body=media)',
    'resp=None',
    'while resp is None:',
    '    st,resp=req.next_chunk()',
    'vid=resp["id"]',
    'yt.playlistItems().insert(part="snippet",body={"snippet":{"playlistId":meta["playlist"],"resourceId":{"kind":"youtube#video","videoId":vid}}}).execute()',
    'if os.path.exists("/tmp/mw-upload/thumb.png"):',
    '    yt.thumbnails().set(videoId=vid,media_body=MediaFileUpload("/tmp/mw-upload/thumb.png",mimetype="image/png")).execute()',
    'os.system("rm -rf /tmp/mw-upload")',
    'print(vid)',
  ].join('\n');

  // Write metadata JSON (avoids shell escaping issues)
  const metaJson = JSON.stringify({ title: title.slice(0,100), description: description.slice(0,3000), playlist: playlistId });
  const metaPath = '/tmp/mw-yt-meta.json';
  fs.writeFileSync(metaPath, metaJson, 'utf8');
  scpCmd(metaPath, '/tmp/mw-yt-meta.json');

  const pyPath = '/tmp/mw-yt-upload.py';
  fs.writeFileSync(pyPath, pyScript, 'utf8');
  scpCmd(pyPath, '/tmp/mw-yt-upload.py');
  const result = sshCmd('python3 /tmp/mw-yt-upload.py');
  const stdout = result.stdout?.toString().trim() || '';
  const videoId = stdout.split('\n').pop()?.trim();
  if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    console.log(`  ✅ YouTube: https://youtu.be/${videoId}`);
    return videoId;
  }
  console.error('  ❌ Upload failed:', result.stderr?.toString().slice(0,200));
  return null;
}

// ── Telegram ──────────────────────────────────────────────────────────────────
function sendTelegramAudio(audioPath, threadId, title, caption) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;
  if (!BOT_TOKEN || !CHAT_ID) { console.log('  ⚠️  No Telegram env vars'); return null; }

  const capFile = audioPath + '.caption.txt';
  fs.writeFileSync(capFile, caption, 'utf8');
  console.log('\n─── TELEGRAM CAPTION ───');
  console.log(caption);
  console.log('─────────────────────────');
  const curlCmd = [
    `curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendAudio"`,
    `-F "chat_id=${CHAT_ID}"`,
    `-F "message_thread_id=${threadId}"`,
    `-F "audio=@${audioPath}"`,
    `-F "title=${title.replace(/['"]/g,'').slice(0,60)}"`,
    `-F "performer=Market Watch"`,
    `-F "caption=<${capFile}"`,
    `-F "parse_mode=HTML"`,
  ].join(' ');
  const r = spawnSync('sh', ['-c', curlCmd], { stdio: 'pipe', timeout: 60000 });
  try { fs.unlinkSync(capFile); } catch {}
  try {
    const j = JSON.parse(r.stdout?.toString() || '{}');
    if (j.ok) { console.log(`  ✅ Telegram audio sent (msg_id: ${j.result.message_id})`); return j.result.message_id; }
    else console.error('  ❌ Telegram:', j.description);
  } catch {}
  return null;
}

// Send video as Telegram video message (fallback when YouTube quota exceeded)
function sendTelegramVideo(videoPath, threadId, title, caption) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;
  if (!BOT_TOKEN || !CHAT_ID) { console.log('  ⚠️  No Telegram env vars'); return null; }
  if (!videoPath || !fs.existsSync(videoPath)) { console.log('  ⚠️  No video file'); return null; }

  const videoSize = Math.round(fs.statSync(videoPath).size / 1024 / 1024 * 10) / 10;
  // Telegram video limit: 50MB
  if (videoSize > 48) { console.log(`  ⚠️  Video too large (${videoSize}MB), skipping embed`); return null; }

  const capFile = videoPath + '.caption.txt';
  // Video caption + remove YouTube line since we're embedding directly
  const videoCaption = caption.slice(0, 1020);
  fs.writeFileSync(capFile, videoCaption, 'utf8');
  console.log(`\n📹 Sending video embed to Telegram (${videoSize}MB)...`);

  const curlCmd = [
    `curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendVideo"`,
    `-F "chat_id=${CHAT_ID}"`,
    `-F "message_thread_id=${threadId}"`,
    `-F "video=@${videoPath}"`,
    `-F "caption=<${capFile}"`,
    `-F "parse_mode=HTML"`,
    `-F "supports_streaming=true"`,
  ].join(' ');
  const r = spawnSync('sh', ['-c', curlCmd], { stdio: 'pipe', timeout: 120000 });
  try { fs.unlinkSync(capFile); } catch {}
  try {
    const j = JSON.parse(r.stdout?.toString() || '{}');
    if (j.ok) { console.log(`  ✅ Telegram video sent (msg_id: ${j.result.message_id})`); return j.result.message_id; }
    else console.error('  ❌ Telegram video:', j.description);
  } catch {}
  return null;
}

// ── gamma-slides integration ─────────────────────────────────────────────────
// Dynamic path: CI server vs Mac Mini
const _GAMMA_CANDIDATES = [
  '/home/ci/projects/gamma-slides/bin/gamma-slides.js',
  path.join(process.env.HOME || '/root', 'GolandProjects/gamma-slides/bin/gamma-slides.js'),
  path.join(process.env.HOME || '/root', 'projects/gamma-slides/bin/gamma-slides.js'),
];
const GAMMA_SLIDES = _GAMMA_CANDIDATES.find(p => fs.existsSync(p)) || _GAMMA_CANDIDATES[0];
const GAMMA_CWD = path.dirname(path.dirname(GAMMA_SLIDES));

// Theme mapping per article type
const TYPE_THEME = {
  daily: 'corporate', weekly: 'corporate', scanner: 'dark',
  analysis: 'startup', learning: 'minimal', series: 'startup',
  retro: 'dark', tech: 'neon',
};

// Convert AI slides to gamma-slides YAML deck
function convertToGammaDeck(content, { title, dateStr, url, type: artType, meta: artMeta, finvizPngs }) {
  const { slides, config, audioScript } = content;
  const theme = TYPE_THEME[artType] || 'corporate';

  const gammaSlides = slides.map(s => {
    const narration = s.narration || s.title || '';

    switch (s.type) {
      case 'chapter-intro':
        return { layout: 'title', title: s.chapter?.title || config.seriesTitle || title, subtitle: s.chapter?.subtitle || dateStr, badge: `${artMeta.emoji} ${artMeta.label}`, narration };

      case 'metric-row':
        return { layout: 'metrics', title: s.title || 'Market Snapshot', columns: Math.min((s.metrics||[]).length, 4),
          metrics: (s.metrics||[]).slice(0, 6).map(m => ({
            label: m.label || '', value: m.value || '', delta: m.delta || '',
            trend: m.trend || (String(m.delta||'').startsWith('-') ? 'down' : String(m.delta||'').startsWith('+') ? 'up' : 'neutral'),
          })), narration };

      case 'event-timeline':
        return { layout: 'timeline', title: s.title || 'Timeline',
          items: (s.events||[]).slice(0, 6).map(e => ({ title: e.title || '', description: e.desc || '', icon: e.impact === 'high' ? '🔴' : e.impact === 'low' ? '🟢' : '🟡' })),
          narration };

      case 'highlight':
        return { layout: 'quote', quote: s.text || s.title || '', author: 'Market Watch Analysis', narration };

      case 'performance':
        return { layout: 'table', title: s.title || 'Performance',
          headers: ['Symbol', 'Name', 'Performance'],
          rows: (s.tickers||[]).slice(0, 8).map(t => [t.symbol, t.name || '', typeof t.perf === 'number' ? `${t.perf > 0 ? '+' : ''}${t.perf.toFixed(1)}%` : String(t.perf || '')]),
          narration };

      case 'summary':
      case 'bullets':
        return { layout: 'bullets', title: s.title || '',
          items: (s.items||[]).map(item => ({ text: typeof item === 'string' ? item : item.text || '', icon: '→' })),
          narration };

      case 'chart-image':
      case 'scanner-setup': {
        const ticker = s.ticker || s.title?.match(/^([A-Z]{1,5})/)?.[1] || '';
        const pngPath = finvizPngs?.[ticker];
        if (pngPath) {
          // Split layout: chart image + trade levels
          // right.type must be one of: table|chart|bullets|image|metrics
          const levelItems = (s.levels||[]).map(l => ({ text: `${l.label}: ${l.value}`, icon: l.type === 'stop' ? '🛑' : l.type === 'tp1' || l.type === 'tp2' ? '🎯' : '📊' }));
          return { layout: 'split',
            left: { type: 'image', image: { src: `file://${pngPath}`, alt: `${ticker} chart`, fit: 'contain' } },
            right: { type: 'bullets', title: s.title || ticker, items: levelItems.length ? levelItems : [{ text: s.narration || '', icon: '📊' }] },
            narration };
        }
        // No chart image — use metrics/bullets fallback
        return { layout: 'bullets', title: s.title || ticker,
          items: (s.levels||[]).map(l => ({ text: `${l.label}: ${l.value}`, icon: l.type === 'tp1' || l.type === 'tp2' ? '🎯' : l.type === 'stop' ? '🛑' : '📊' })),
          narration };
      }

      case 'scanner-actions':
        return { layout: 'bullets', title: s.title || 'Actions',
          items: (s.orders||s.items||[]).slice(0, 8).map(o => ({ text: typeof o === 'string' ? o : `${o.ticker || ''} · ${o.action || o.text || ''}`, icon: '⚡' })),
          narration };

      case 'scanner-portfolio': {
        // metrics can be an object {regime, avgScore, spChange...} or array
        const pm = Array.isArray(s.metrics)
          ? s.metrics
          : Object.entries(s.metrics || {}).map(([k, v]) => ({ label: k, value: String(v ?? '') }));
        return { layout: 'metrics', title: s.title || 'Portfolio', columns: 4,
          metrics: pm.slice(0, 6).map(m => ({ label: m.label || '', value: m.value || '', delta: '', trend: 'neutral' })),
          narration };
      }

      case 'scanner-market': {
        const mm = Array.isArray(s.metrics)
          ? s.metrics
          : Object.entries(s.metrics || {}).map(([k, v]) => ({ label: k, value: String(v ?? '') }));
        return { layout: 'metrics', title: s.title || 'Market Context', columns: 3,
          metrics: mm.slice(0, 6).map(m => ({ label: m.label || '', value: m.value || '', delta: '', trend: 'neutral' })),
          narration };
      }

      case 'chapter-outro':
        return { layout: 'closing', title: s.title || 'Follow Market Watch',
          metrics: [{ label: 'Telegram', value: '@MarketWatchXYZ' }, { label: 'Web', value: 'articles.market-watch.xyz' }],
          narration };

      default:
        // Fallback: treat as bullets
        return { layout: 'bullets', title: s.title || '',
          items: [{ text: s.text || s.narration || s.title || '', icon: '📌' }],
          narration };
    }
  });

  // Always add a closing slide if not present
  const hasClosing = gammaSlides.some(s => s.layout === 'closing');
  if (!hasClosing) {
    gammaSlides.push({
      layout: 'closing',
      title: 'Market Watch',
      subtitle: `${artMeta.emoji} ${artMeta.label} — ${dateStr}`,
      metrics: [{ label: 'Full Article', value: url.replace('https://', '') }],
      narration: 'Full article available at articles.market-watch.xyz. Follow us on Telegram for daily signals.',
    });
  }

  return {
    version: '1',
    meta: { title, author: 'Market Watch', company: 'Market Watch', date: dateStr, language: 'en', tags: [artType, 'finance', 'markets'], description: audioScript?.slice(0, 200) || '' },
    branding: { watermark: 'MARKET WATCH', company_url: 'articles.market-watch.xyz' },
    theme,
    narration: { voice: 'en-US-AndrewNeural', rate: '+5%', pitch: '+0Hz' },
    video: { subtitles: true, youtube: { title: `${title} | Market Watch`, description: `${artMeta.emoji} ${artMeta.label} — ${dateStr}\n\n🔗 Full article: ${url}\n📱 Telegram: https://t.me/+gl06cNSLV2RiZmE0\n\n⚠️ Not financial advice.`, tags: ['Market Watch', 'finance', 'trading', artType], category: 'Education' } },
    slides: gammaSlides,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const html    = artPath ? readHtml(artPath) : '';
  const url     = buildUrl(artPath);
  const title   = getTitle(html);
  const desc    = getDesc(html);
  const meta    = TYPE_META[type] || TYPE_META.daily;
  const { dateStr } = getDate(artPath);

  // For scanner type: use fixed slug scanner-{YYYYMMDD} so notify-scanner-status.js can find result.json
  const scannerDate = type === 'scanner' && artPath ? artPath.match(/(\d{8})/)?.[1] : null;
  const slug   = scannerDate ? `scanner-${scannerDate}` : slugify(title || type);
  const outDir = `/tmp/mw-media/${slug}`;
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`\n🎬 Generating media for: ${title}`);
  console.log(`   Type: ${type} | Slug: ${slug}`);

  // ── 1. Generate AI content ──
  let content = await generateAIContent(html, url, dateStr, title, meta);
  if (!content) content = fallbackContent(html, url, dateStr, title, meta);

  // For scanner: override slides with parsed HTML slides
  if (type === 'scanner' && html) {
    const scannerSlides = buildScannerSlides(html, content, dateStr);
    if (scannerSlides.length >= 4) {
      console.log(`  🔍 Scanner: ${scannerSlides.length} slides parsed from HTML (replacing AI slides)`);
      content.slides = scannerSlides;
      content.config = { ...content.config, accentColor: '#f0883e' };
    }
  }

  const { audioScript, slides, config } = content;

  // ── 2. Pre-fetch Finviz charts as PNG files ──
  const finvizPngs = {};
  const finvizSlides = slides.filter(s => s.finvizUrl && s.finvizUrl.includes('finviz.com'));
  if (finvizSlides.length > 0) {
    console.log(`\n📈 Pre-fetching ${finvizSlides.length} Finviz chart(s)...`);
    for (const s of finvizSlides) {
      const ticker = s.ticker || s.finvizUrl.match(/t=([A-Z.]+)/)?.[1] || '?';
      const b64 = await fetchFinvizBase64(ticker);
      if (b64) {
        // Save base64 as PNG file for gamma-slides image layout
        const pngPath = path.join(outDir, `finviz-${ticker}.png`);
        const b64Data = b64.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(pngPath, Buffer.from(b64Data, 'base64'));
        finvizPngs[ticker] = pngPath;
        console.log(`  ✅ ${ticker} chart saved (${Math.round(fs.statSync(pngPath).size / 1024)}KB)`);
      } else {
        console.log(`  ⚠️  ${ticker} chart fetch failed — slide will show text fallback`);
      }
    }
  }

  // ── 3. Convert to gamma-slides YAML deck ──
  const deck = convertToGammaDeck(content, { title, dateStr, url, type, meta, finvizPngs });
  const deckPath = path.join(outDir, 'deck.yaml');
  // Write as JSON (gamma-slides accepts both YAML and JSON)
  fs.writeFileSync(deckPath, JSON.stringify(deck, null, 2), 'utf8');
  console.log(`\n📋 Deck: ${deck.slides.length} slides (${deck.theme} theme)`);

  if (DRY_RUN) {
    console.log('\n─── AUDIO SCRIPT ───');
    console.log(audioScript);
    console.log('\n─── DECK SLIDES ───');
    deck.slides.forEach((s, i) => console.log(`  [${i}] ${s.layout}: ${s.title || ''}`));
    console.log(`\n─── TELEGRAM BULLETS ───`);
    (content.telegramBullets || []).forEach(b => console.log(`  ${typeof b === 'string' ? b : b.text || JSON.stringify(b)}`));
    return;
  }

  // ── 4. Audio summary (Piper TTS, for Telegram) ──
  const audioPath = path.join(outDir, 'audio.mp3');
  console.log('\n📢 Generating Telegram audio summary...');
  runTTS(audioScript, audioPath);
  const audioDur = audioDuration(audioPath);
  console.log(`  ⏱  Duration: ${Math.round(audioDur)}s`);

  // ── 5. Generate video via gamma-slides ──
  const videoPath = path.join(outDir, 'video.mp4');
  console.log('\n🎬 Generating video via gamma-slides...');
  const gammaEnv = { ...process.env, PUPPETEER_EXECUTABLE_PATH: '/snap/bin/chromium', PATH: `/home/ci/edge-tts-venv/bin:${process.env.PATH}` };
  const gammaResult = spawnSync('node', [GAMMA_SLIDES, 'video', '-f', deckPath, '-o', videoPath], {
    stdio: 'pipe', timeout: 600000, env: gammaEnv, cwd: GAMMA_CWD,
  });
  const gammaOut = gammaResult.stdout?.toString() || '';
  const gammaErr = gammaResult.stderr?.toString() || '';
  if (gammaResult.status === 0 && fs.existsSync(videoPath)) {
    const videoSize = Math.round(fs.statSync(videoPath).size / 1024 / 1024 * 10) / 10;
    console.log(`  ✅ Video: ${videoPath} (${videoSize}MB)`);
    console.log(gammaOut.split('\n').filter(l => l.includes('✓') || l.includes('slides')).join('\n  '));
  } else {
    console.error(`  ❌ gamma-slides failed (exit ${gammaResult.status}):`);
    console.error(gammaErr.slice(-300) || gammaOut.slice(-300));
    console.log('  ⚠️  Continuing without video...');
  }

  // ── 6. YouTube upload ──
  let ytId = null;
  if (fs.existsSync(videoPath)) {
    const ytTitle = `${title} | Market Watch`;
    const ytDesc = `${meta.emoji} ${meta.label} — ${dateStr}\n\n${(audioScript || '').slice(0,2000)}\n\n🔗 Full article: ${url}\n📱 Telegram: https://t.me/+gl06cNSLV2RiZmE0\n\n⚠️ Not financial advice.`;
    ytId = uploadToYouTube(videoPath, null, ytTitle, ytDesc, meta.ytPlaylist);
  }

  // ── 7. Telegram notification ──
  const rawBullets = (content.telegramBullets || []).slice(0, 8);
  const bullets = rawBullets.map(b => {
    if (typeof b === 'string') return b;
    if (b && typeof b === 'object') return `${b.emoji || ''} ${b.text || b.content || b.bullet || JSON.stringify(b)}`.trim();
    return String(b);
  }).filter(b => b.length > 2);
  const bulletBlock = bullets.length > 0 ? '\n\n' + bullets.join('\n') : '';
  const ytLine = ytId ? `\n\n📺 <a href="https://youtu.be/${ytId}">Watch on YouTube</a>` : '';
  const caption = `${meta.emoji} <b>${title}</b>${bulletBlock}${ytLine}\n\n🔗 <a href="${url}">Full article →</a>`.slice(0, 1020);

  if (!NO_TELEGRAM) {
    sendTelegramAudio(audioPath, meta.telegramTopic, title, caption);
    if (!ytId && fs.existsSync(videoPath)) {
      const videoCaption = `${meta.emoji} <b>${title}</b> — Vidéo\n\n🔗 <a href="${url}">Full article →</a>`;
      sendTelegramVideo(videoPath, meta.telegramTopic, title, videoCaption);
    }
  } else {
    console.log('  (--no-telegram: skip Telegram send)');
  }

  // ── 8. Result ──
  const result = { audioPath, videoPath: fs.existsSync(videoPath) ? videoPath : null, youtubeId: ytId, youtubeUrl: ytId ? `https://youtu.be/${ytId}` : null, title, slug };
  fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2), 'utf8');
  console.log('\n✅ Media generation complete:');
  console.log(JSON.stringify(result, null, 2));
  console.log(`\nResult: ${path.join(outDir, 'result.json')}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
