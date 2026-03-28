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
const FFMPEG    = 'ffmpeg';
const FFPROBE   = 'ffprobe';
const CHROMIUM  = '/snap/bin/chromium';
const VOICE     = 'en-US-AndrewNeural';  // Young, dynamic, energetic male voice
const RATE      = '+5%';                 // Slightly faster = punchy analyst delivery
const PITCH     = '+8Hz';               // Slightly higher = youthful energy
const BASE_URL  = 'https://articles.market-watch.xyz';

// ── SSH Mac Mini ──────────────────────────────────────────────────────────────
const SSH_HOST  = 'marketwatchxyz@melouadis-mac-mini.tail5d09f.ts.net';
const SSH_OPTS  = '-o StrictHostKeyChecking=no -o PubkeyAuthentication=no';
const SSHPASS   = 'sshpass';
const SSH_PASS  = 'Elonux!123';
const YT_TOKEN  = '/Users/marketwatchxyz/GolandProjects/video-factory/credentials/youtube-token.json';
const YT_CREDS  = '/Users/marketwatchxyz/GolandProjects/video-factory/credentials/youtube-credentials.json';

// ── Args ──────────────────────────────────────────────────────────────────────
const args   = process.argv.slice(2);
const getArg = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i+1] : null; };
const type    = getArg('--type')  || 'daily';
const artPath = getArg('--path')  || '';
const DRY_RUN = args.includes('--dry-run');

// ── Type metadata ─────────────────────────────────────────────────────────────
const TYPE_META = {
  daily:    { label: 'Daily Briefing',    emoji: '📰', telegramTopic: 73, ytPlaylist: 'PLv96IetLrmtWfdEl9tObkSLaw_HFt39me' },
  weekly:   { label: 'Weekly Review',     emoji: '📊', telegramTopic: 74, ytPlaylist: 'PLv96IetLrmtWXigx6hLMoABNWsVhli2Vv' },
  scanner:  { label: 'Scanner Signals',   emoji: '🔍', telegramTopic: 73, ytPlaylist: 'PLv96IetLrmtVZZpO-M1Y6NDJETXw9zrU9' },
  analysis: { label: 'Stock Analysis',    emoji: '🔬', telegramTopic: 75, ytPlaylist: 'PLv96IetLrmtU4Yff6kHAvSr3wJNYgXQ3R' },
  learning: { label: 'Trading Education', emoji: '🎓', telegramTopic: 76, ytPlaylist: 'PLv96IetLrmtV0UT9I-V95wPvXs9crtbyL' },
  series:   { label: 'Expert Series',     emoji: '🎯', telegramTopic: 76, ytPlaylist: 'PLv96IetLrmtV0UT9I-V95wPvXs9crtbyL' },
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

// ── AI slide + script generation ──────────────────────────────────────────────
async function generateAIContent(html, url, dateStr, title, meta) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
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
  return {
    audioScript: `${title}. Full analysis at articles.market-watch.xyz.`,
    config: { seriesTitle: title, date: dateStr, language: 'en', accentColor: '#3b82f6', totalChapters: 2 },
    slides: [
      { type: 'chapter-intro', chapter: { title: title, subtitle: dateStr, partNumber: 1, totalParts: 1 }, narration: title },
      { type: 'summary', title: 'Key Points', items: ['Full article at articles.market-watch.xyz'], narration: 'Full article available online.' },
    ],
  };
}

// ── TTS ───────────────────────────────────────────────────────────────────────
function runTTS(text, outPath) {
  const txtPath = outPath + '.txt';
  fs.writeFileSync(txtPath, text, 'utf8');
  // edge-tts writes .mp3 directly
  const r = spawnSync(EDGE_TTS, ['--voice', VOICE, `--rate=${RATE}`, `--pitch=${PITCH}`, '-f', txtPath, '--write-media', outPath], { stdio: 'pipe', timeout: 120000 });
  try { fs.unlinkSync(txtPath); } catch {}
  if (!fs.existsSync(outPath)) {
    // Try with wav then convert
    const wavPath = outPath.replace('.mp3', '.wav');
    spawnSync(EDGE_TTS, ['--voice', VOICE, `--rate=${RATE}`, `--pitch=${PITCH}`, '-f', txtPath + '.2', '--write-media', wavPath], { stdio: 'pipe', timeout: 120000 });
    if (fs.existsSync(wavPath)) {
      spawnSync(FFMPEG, ['-y', '-i', wavPath, '-codec:a', 'libmp3lame', '-qscale:a', '4', outPath], { stdio: 'pipe' });
      try { fs.unlinkSync(wavPath); } catch {}
    }
  }
  const size = fs.existsSync(outPath) ? Math.round(fs.statSync(outPath).size / 1024) : 0;
  console.log(`  ✅ ${path.basename(outPath)} (${size}KB)`);
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
    `t=json.load(open('${YT_TOKEN}'))`,
    `c=json.load(open('${YT_CREDS}'))['web']`,
    'creds=Credentials(token=t["access_token"],refresh_token=t["refresh_token"],token_uri=c["token_uri"],client_id=c["client_id"],client_secret=c["client_secret"])',
    'yt=build("youtube","v3",credentials=creds)',
    'meta=json.load(open("/tmp/mw-yt-meta.json"))',
    'body={"snippet":{"title":meta["title"],"description":meta["description"],"categoryId":"25","defaultLanguage":"en","tags":["Market Watch","finance","trading"]},"status":{"privacyStatus":"unlisted"}}',
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

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const html    = artPath ? readHtml(artPath) : '';
  const url     = buildUrl(artPath);
  const title   = getTitle(html);
  const desc    = getDesc(html);
  const meta    = TYPE_META[type] || TYPE_META.daily;
  const { dateStr } = getDate(artPath);

  const slug   = slugify(title || type);
  const outDir = `/tmp/mw-media/${slug}`;
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`\n🎬 Generating media for: ${title}`);
  console.log(`   Type: ${type} | Slug: ${slug}`);

  // ── 1. Generate AI content ──
  let content = await generateAIContent(html, url, dateStr, title, meta);
  if (!content) content = fallbackContent(html, url, dateStr, title, meta);

  const { audioScript, slides, config } = content;

  if (DRY_RUN) {
    console.log('\n─── AUDIO SCRIPT ───');
    console.log(audioScript);
    console.log('\n─── SLIDES ───');
    slides.forEach((s, i) => console.log(`  [${i}] ${s.type}: ${s.title || s.chapter?.title || ''}`));
    console.log(`       narrations: ${slides.map(s => (s.narration||'').split(' ').length).join(', ')} words`);
    return;
  }

  // ── 2. Audio summary ──
  const audioPath = path.join(outDir, 'audio.mp3');
  console.log('\n📢 Generating audio summary...');
  runTTS(audioScript, audioPath);
  const audioDur = audioDuration(audioPath);
  console.log(`  ⏱  Duration: ${Math.round(audioDur)}s`);

  // ── 3. Per-slide narration audio ──
  console.log('\n🎙️  Generating per-slide narration...');
  const segAudios = generateSegmentAudio(slides, outDir);

  // ── 4. Slide screenshots ──
  console.log('\n🖼️  Rendering slides...');
  let pngPaths = [];
  try {
    pngPaths = await screenshotSlides(slides, config, outDir);
  } catch (e) {
    console.error(`  ⚠️  puppeteer failed: ${e.message?.slice(0,80)}, falling back to Pillow`);
    pngPaths = await screenshotFallback(slides, config, outDir);
  }

  if (pngPaths.length === 0) {
    console.error('  ❌ No slides generated. Aborting video.');
    return;
  }

  // ── 5. Build video ──
  const videoPath = path.join(outDir, 'video.mp4');
  console.log('\n🎬 Building video...');
  buildVideo(pngPaths, segAudios, videoPath);
  const videoSize = fs.existsSync(videoPath) ? Math.round(fs.statSync(videoPath).size / 1024 / 1024 * 10) / 10 : 0;
  console.log(`  ✅ Video: ${videoPath} (${videoSize}MB)`);

  // ── 6. YouTube upload ──
  const ytTitle = `${title} | Market Watch`;
  const ytDesc  = `${meta.emoji} ${meta.label} — ${dateStr}\n\n${(slides.map(s => s.narration || '').join(' ')).slice(0,2000)}\n\n🔗 Full article: ${url}\n📱 Telegram: https://t.me/+gl06cNSLV2RiZmE0\n\n⚠️ Not financial advice.`;
  const ytId = uploadToYouTube(videoPath, pngPaths[0], ytTitle, ytDesc, meta.ytPlaylist);

  // ── 7. Telegram notification ──
  const ytLine = ytId ? `\n📺 <a href="https://youtu.be/${ytId}">Watch on YouTube</a>` : '';
  // Normalize bullets — AI may return strings or objects {emoji, text}
  const rawBullets = (content.telegramBullets || []).slice(0, 10);
  const bullets = rawBullets.map(b => {
    if (typeof b === 'string') return b;
    if (b && typeof b === 'object') return `${b.emoji || ''} ${b.text || b.content || b.bullet || JSON.stringify(b)}`.trim();
    return String(b);
  }).filter(b => b.length > 2);
  const bulletBlock = bullets.length > 0 ? '\n\n' + bullets.join('\n') : '';
  const caption = `🎙️ <b>${meta.label}</b> — ${dateStr}${bulletBlock}${ytLine}\n🔗 <a href="${url}">Full article</a>`;
  sendTelegramAudio(audioPath, meta.telegramTopic, title, caption);

  // ── 8. Result ──
  const result = { audioPath, videoPath, youtubeId: ytId, youtubeUrl: ytId ? `https://youtu.be/${ytId}` : null, title, slug };
  fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2), 'utf8');
  console.log('\n✅ Media generation complete:');
  console.log(JSON.stringify(result, null, 2));
  console.log(`\nResult: ${path.join(outDir, 'result.json')}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
