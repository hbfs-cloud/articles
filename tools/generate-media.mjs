#!/usr/bin/env node
/**
 * generate-media.mjs
 * Generate a short YouTube video (≤5 min) + MP3 audio (≤2 min) for any published article.
 * 
 * Usage:
 *   node tools/generate-media.mjs --type <daily|weekly|scanner|analysis|series|learning>
 *                                  --path <relative/path/to/article>
 *                                  [--title "Override title"]
 *                                  [--dry-run]   # generate script only, no TTS/video
 *
 * Output:
 *   /tmp/mw-media/<slug>/audio.mp3        → ≤2 min MP3 (audio summary)
 *   /tmp/mw-media/<slug>/video.mp4        → ≤5 min video (slides + voiceover)
 *   /tmp/mw-media/<slug>/thumb.png        → YouTube thumbnail
 *
 * Requires: edge-tts (venv), ffmpeg, convert (imagemagick) or node-canvas
 */

import fs from 'fs';
import path from 'path';
import { execSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ── Config ────────────────────────────────────────────────────────────────────
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}

const EDGE_TTS     = '/home/ci/edge-tts-venv/bin/edge-tts';
const FFMPEG       = 'ffmpeg';
const VOICE        = 'en-US-EricNeural';
const RATE         = '-8%';
const PITCH        = '+5Hz';
const BASE_URL     = 'https://articles.market-watch.xyz';

// ── Args ──────────────────────────────────────────────────────────────────────
const args   = process.argv.slice(2);
const getArg = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i+1] : null; };
const type     = getArg('--type')  || 'daily';
const artPath  = getArg('--path')  || '';
const titleArg = getArg('--title') || '';
const DRY_RUN  = args.includes('--dry-run');

// ── HTML helpers ──────────────────────────────────────────────────────────────
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
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function getMeta(html, prop) {
  const m = html.match(new RegExp(`property="${prop}"[^>]*content="([^"]+)"`, 'i'))
         || html.match(new RegExp(`content="([^"]+)"[^>]*property="${prop}"`, 'i'))
         || html.match(new RegExp(`name="${prop}"[^>]*content="([^"]+)"`, 'i'));
  return m ? m[1] : '';
}

function decodeEntities(str) {
  return str
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/\s+/g, ' ').trim();
}

function getTitle(html) {
  if (titleArg) return titleArg;
  const og = getMeta(html, 'og:title');
  if (og) return decodeEntities(og.replace(/\s*[–|]\s*Market Watch.*$/i, '').trim());
  const t = html.match(/<title>([^<]+)/i);
  if (t) return decodeEntities(t[1].replace(/\s*[–|—].*$/, '').trim());
  return 'Market Watch';
}

function getDesc(html) {
  const og = getMeta(html, 'og:description') || getMeta(html, 'description');
  return og ? og.replace(/\s+/g, ' ').trim() : '';
}

function buildUrl(relPath) {
  if (!relPath) return BASE_URL + '/';
  const clean = relPath.replace(/\/index\.html$/, '/').replace(/^\//, '');
  return BASE_URL + '/' + clean;
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

// ── Script builders ───────────────────────────────────────────────────────────

const TYPE_META = {
  daily    : { label: 'Daily Briefing',  emoji: '📰', playlist: 'Daily Briefing'  },
  weekly   : { label: 'Weekly Review',   emoji: '📊', playlist: 'Weekly Review'   },
  scanner  : { label: 'Portfolio Scan',  emoji: '📈', playlist: 'Daily Scanner'   },
  retro    : { label: 'Weekly Scan Recap',emoji:'🔁', playlist: 'Daily Scanner'   },
  analysis : { label: 'Stock Analysis',  emoji: '🔍', playlist: 'Stock Analysis'  },
  series   : { label: 'Expert Series',   emoji: '📚', playlist: 'Trading Education'},
  tech     : { label: 'Tech & Quant',    emoji: '💡', playlist: 'Trading Education'},
  learning : { label: 'Learning',        emoji: '🎓', playlist: 'Trading Education'},
};

/**
 * Build a ~90s narration script (≤250 words) for the audio summary.
 * Build a ~4min narration script (≤600 words) for the video.
 */
function buildScripts(html, url) {
  const text   = stripHtml(html);
  const title  = getTitle(html);
  const desc   = getDesc(html);
  const meta   = TYPE_META[type] || TYPE_META.daily;

  const dateMatch = artPath.match(/(\d{4})(\d{2})(\d{2})/);
  const dateStr = dateMatch
    ? new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`).toLocaleDateString('en-US', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
      })
    : new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

  // Placeholder scripts — will be overwritten by AI generation in generateMedia()
  const audioScript = `${title}. ${(desc||'').slice(0,100)}. Full article at articles.market-watch.xyz.`;
  const videoScript = `[INTRO]\n\n${title}.\n\n[OUTRO]\n\nFull article at articles.market-watch.xyz.`;

  return { audioScript, videoScript, title, dateStr, url, meta };
}

/**
 * Use Claude Haiku to generate punchy, high-value scripts from the article content.
 * Falls back to template-based scripts if API unavailable.
 */
async function generateAIScripts(html, url, dateStr, title, meta) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('  ⚠️  No ANTHROPIC_API_KEY — using template scripts');
    return null;
  }

  // Extract the most relevant text from the article
  const raw   = stripHtml(html);
  // Take up to 3000 chars of the most meaningful content (skip nav/header boilerplate)
  const lines = raw.split(/\n+/).map(l => l.trim()).filter(l => l.length > 40);
  const body  = lines.slice(0, 60).join(' ').slice(0, 3500);

  const typeGuide = {
    daily: `a punchy 90-second daily market briefing. Hit the biggest market moves, WHY they happened, and what traders need to watch. Numbers WITH context — not just "S&P was down 1.6%" but WHY and what it means.`,
    weekly: `a compelling weekly market recap. Cover the week's dominant theme, the macro catalyst, and what sets up the week ahead. Narrative-driven, not a list of numbers.`,
    scanner: `an exciting scanner signal alert. What setups are firing, why the risk/reward is compelling, and a clear trading plan. Action-oriented.`,
    analysis: `a sharp stock analysis. Investment thesis, key levels, risk/reward, catalyst. Speak to a serious trader — be direct, confident, insightful.`,
    learning: `an educational deep-dive. Clear, engaging, practical. Use examples. Build conviction in the listener.`,
    series: `an engaging expert series episode. Structured, insightful, with concrete takeaways.`,
  };

  const guide = typeGuide[type] || typeGuide.daily;

  const prompt = `You are a sharp, energetic financial analyst for Market Watch. You have a direct, confident voice — like a Bloomberg anchor meets a hedge fund trader. No fluff, no filler words.

Write TWO scripts from this article content:

ARTICLE: ${title}
DATE: ${dateStr}
CONTENT: ${body}

---
SCRIPT 1 — AUDIO SUMMARY (90 seconds, ~230 words MAX)
This is ${guide}
Rules:
- Start with a sharp hook, NOT "Welcome to Market Watch"
- Drive insight: WHY did this happen? What does it mean for traders?  
- Include 2-3 specific data points WITH context
- End with a clear actionable thought or what to watch next
- Tone: punchy, fast-paced, confident. Zero filler phrases.
- No "In conclusion", no "Stay tuned", no "See you next time"

SCRIPT 2 — VIDEO NARRATION (4 minutes, ~550 words MAX)
Same energy but structured in sections using [SECTION NAME] headers:
[HOOK] — 20-word grabber that makes you stop scrolling
[MARKET PULSE] — key data WITH analysis (not just numbers)
[THE BIG STORY] — deep dive on the dominant narrative
[TRADER'S TAKE] — actionable insight, levels to watch, what to do
[WHAT'S NEXT] — setup for the coming days/week

Rules:
- Every sentence must ADD VALUE — no repetition of what was already said
- Speak to a serious trader: assume they know what an EMA is
- Be opinionated — this is analysis, not journalism

OUTPUT FORMAT (exactly):
---AUDIO---
[audio script here]
---VIDEO---
[section headers with video script here]
---END---`;

  try {
    // Dynamic import to avoid breaking if SDK not installed
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });
    console.log('  🤖 Generating AI scripts (Haiku)...');
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw_resp = response.content[0].text;

    const audioMatch = raw_resp.match(/---AUDIO---\s*([\s\S]+?)---VIDEO---/);
    // VIDEO section ends at ---END--- or at end of string
    const videoMatch = raw_resp.match(/---VIDEO---\s*([\s\S]+?)(?:---END---|$)/);
    if (audioMatch && videoMatch) {
      const audioScript = audioMatch[1].trim().replace(/\*\*/g, '');  // strip markdown bold
      const videoScript = videoMatch[1].trim().replace(/\*\*/g, '');
      const wc_audio = audioScript.split(/\s+/).length;
      const wc_video = videoScript.split(/\s+/).length;
      console.log(`  ✅ AI scripts: audio ${wc_audio}w, video ${wc_video}w`);
      return { audioScript, videoScript };
    }
    console.log('  ⚠️  AI response parsing failed, using template');
    return null;
  } catch (e) {
    console.log(`  ⚠️  AI script error: ${e.message?.slice(0,60)}`);
    return null;
  }
}


// ── Slide data builder (for make-slides.py) ─────────────────────────────────
function buildSlideData(scripts) {
  const { title, dateStr, meta, videoScript } = scripts;
  const text = artPath ? stripHtml(readHtml(artPath)) : '';
  const slides = [];

  // Parse script sections
  const sections = videoScript.split(/\[([A-Z '&]+)\]\n\n/).filter(s => s.trim());

  // Intro
  slides.push({ type: 'intro', title, date: dateStr, badge: `${meta.emoji} ${meta.label}` });

  // Market snapshot
  if (['daily', 'scanner', 'weekly'].includes(type)) {
    const sp    = text.match(/S[&P\s]*P\s*500[^\d]*([\d,]{4,6})/i);
    const spPct = text.match(/S[&P\s]*P\s*500[^\n%]{0,40}([−\-+]\s*\d[\d.]+\s*%)/i);
    const nas   = text.match(/Nasdaq[^\d]*([\d,]{4,6})/i);
    const nasPct= text.match(/Nasdaq[^\n%]{0,40}([−\-+]\s*\d[\d.]+\s*%)/i);
    const btc   = text.match(/BTC[^\d$]*\$?([\d,]{4,7})/i) || text.match(/Bitcoin[^\d$]*\$?([\d,]{4,7})/i);
    const gold  = text.match(/Gold[^\d$]*\$?([\d,]{3,6})/i);
    const vix   = text.match(/VIX[^\d]*([\d]{1,2}\.[\d]+)/i);
    const oil   = text.match(/Brent[^\d$]*\$?([\d]{2,3}\.[\d]+)/i);
    const items = [];
    if (sp)   items.push({ label: 'S&P 500',    value: sp[1],         change: spPct?.[1]?.trim()||'' });
    if (nas)  items.push({ label: 'Nasdaq',     value: nas[1],        change: nasPct?.[1]?.trim()||'' });
    if (btc)  items.push({ label: 'Bitcoin',    value: `$${btc[1]}`,  change: '' });
    if (gold) items.push({ label: 'Gold',       value: `$${gold[1]}`, change: '' });
    if (vix)  items.push({ label: 'VIX',        value: vix[1],        change: '' });
    if (oil)  items.push({ label: 'Oil (Brent)',value: `$${oil[1]}`,  change: '' });
    if (items.length >= 2) slides.push({ type: 'snapshot', header: 'Market Snapshot', items, footer: 'articles.market-watch.xyz' });
  }

  // Content slides from sections
  for (let i = 0; i < sections.length - 1; i += 2) {
    const sectionTitle   = sections[i];
    const sectionContent = sections[i+1];
    if (!sectionTitle || !sectionContent) continue;
    if (/intro|headline/i.test(sectionTitle)) continue;
    const bullets = sectionContent.split('\n')
      .filter(l => l.trim().length > 10)
      .map(l => l.trim().replace(/^Point\s*\d+:\s*/i, '').slice(0, 120))
      .slice(0, 5);
    if (bullets.length) slides.push({ type: 'content', header: sectionTitle, bullets, accent: '#3b82f6', footer: 'articles.market-watch.xyz' });
  }

  // Outro
  slides.push({ type: 'outro', url: 'articles.market-watch.xyz', subtitle: 'Follow us on Telegram for daily signals' });
  return slides;
}

// ── Render slides via make-slides.py (Pillow) ─────────────────────────────────
async function renderSlides(slideData, outDir) {
  const PYTHON    = '/home/ci/edge-tts-venv/bin/python3';
  const SCRIPT    = path.join(__dirname, 'make-slides.py');
  const dataFile  = path.join(outDir, 'slides-data.json');
  fs.writeFileSync(dataFile, JSON.stringify({ slides: slideData }), 'utf8');

  const result = spawnSync(PYTHON, [SCRIPT, '--data-file', dataFile, '--outdir', outDir], { stdio: 'pipe' });
  const stdout = result.stdout?.toString() || '';
  const stderr = result.stderr?.toString() || '';
  if (stderr) process.stderr.write(stderr);

  // Parse rendered paths from last JSON line
  const jsonLine = stdout.trim().split('\n').reverse().find(l => l.startsWith('{'));
  if (jsonLine) {
    try {
      const parsed = JSON.parse(jsonLine);
      return parsed.slides || [];
    } catch {}
  }
  // Fallback: list png files
  return fs.readdirSync(outDir).filter(f => /^slide-\d+\.png$/.test(f)).sort()
    .map(f => path.join(outDir, f));
}

// ── TTS generation ────────────────────────────────────────────────────────────
function runTTS(text, outPath) {
  const txtPath = outPath.replace('.mp3', '.txt');
  fs.writeFileSync(txtPath, text, 'utf8');
  const cmd = `${EDGE_TTS} --voice "${VOICE}" --rate="${RATE}" --pitch="${PITCH}" -f "${txtPath}" --write-media "${outPath}.wav"`;
  console.log(`  🔊 TTS: ${path.basename(outPath)}`);
  spawnSync('sh', ['-c', cmd], { stdio: 'inherit' });
  spawnSync(FFMPEG, ['-y', '-i', `${outPath}.wav`, '-codec:a', 'libmp3lame', '-qscale:a', '4', '-ar', '44100', outPath], { stdio: 'pipe' });
  try { fs.unlinkSync(`${outPath}.wav`); } catch {}
  try { fs.unlinkSync(txtPath); } catch {}
  return outPath;
}

// ── Build video from slides + audio ──────────────────────────────────────────
function buildVideo(pngPaths, audioPath, outPath, totalDurationSec) {
  if (!pngPaths.length) { console.log('  ⚠️ No slides, skipping video'); return; }
  
  const secPerSlide = Math.floor(totalDurationSec / pngPaths.length);
  
  // Create concat file with slide images
  const concatPath = outPath + '.concat.txt';
  const lines = pngPaths.map(p => `file '${p}'\nduration ${secPerSlide}`).join('\n');
  // Add last frame with 0 duration
  fs.writeFileSync(concatPath, lines + `\nfile '${pngPaths[pngPaths.length-1]}'`, 'utf8');
  
  // Generate slideshow video + overlay audio
  const result = spawnSync(FFMPEG, [
    '-y',
    '-f', 'concat', '-safe', '0', '-i', concatPath,
    '-i', audioPath,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-c:a', 'aac', '-b:a', '128k',
    '-pix_fmt', 'yuv420p',
    '-shortest',
    outPath
  ], { stdio: 'pipe' });
  
  fs.unlinkSync(concatPath);
  
  if (result.status !== 0) {
    console.error('  ❌ ffmpeg error:', result.stderr?.toString().slice(-200));
  } else {
    const size = (fs.statSync(outPath).size / 1024 / 1024).toFixed(1);
    console.log(`  ✅ Video: ${outPath} (${size}MB)`);
  }
}

// ── YouTube upload ────────────────────────────────────────────────────────────
function getPlaylistId(playlistName) {
  const MAP = {
    'Daily Scanner':    'PLv96IetLrmtVZZpO-M1Y6NDJETXw9zrU9',
    'Daily Briefing':   'PLv96IetLrmtWfdEl9tObkSLaw_HFt39me',
    'Weekly Review':    'PLv96IetLrmtWXigx6hLMoABNWsVhli2Vv',
    'Stock Analysis':   'PLv96IetLrmtU4Yff6kHAvSr3wJNYgXQ3R',
    'Trading Education':'PLv96IetLrmtV0UT9I-V95wPvXs9crtbyL',
  };
  return MAP[playlistName] || null;
}

async function uploadToYouTube(videoPath, thumbPath, scripts) {
  const { title, dateStr, meta, url } = scripts;
  
  const tokenPath  = '/Users/marketwatchxyz/GolandProjects/video-factory/credentials/youtube-token.json';
  const credsPath  = '/Users/marketwatchxyz/GolandProjects/video-factory/credentials/youtube-credentials.json';
  
  const playlistId = getPlaylistId(meta.playlist);
  const ytTitle    = `${title.slice(0, 90)} | MarketWatch`.slice(0, 100);
  const ytDesc     = `📊 ${meta.label} — ${dateStr}\n\n${scripts.videoScript.replace(/\[[A-Z '&]+\]\n\n/g, '\n').slice(0, 4000)}\n\n🔗 Full article: ${url}\n\n⚠️ Not financial advice.`;
  
  // Transfer video + thumb to Mac Mini then upload
  const remoteDir  = '/tmp/mw-upload';
  const remoteVideo = `${remoteDir}/video.mp4`;
  const remoteThumb = `${remoteDir}/thumb.png`;
  const SSH_OPTS   = '-o StrictHostKeyChecking=no -o PubkeyAuthentication=no';
  const SSH_HOST   = 'marketwatchxyz@melouadis-mac-mini.tail5d09f.ts.net';
  const SSHPASS    = `sshpass -p 'Elonux!123'`;

  // Create remote dir + copy files
  spawnSync('sh', ['-c', `${SSHPASS} ssh ${SSH_OPTS} ${SSH_HOST} "mkdir -p ${remoteDir}"`], { stdio: 'pipe' });
  spawnSync('sh', ['-c', `${SSHPASS} scp ${SSH_OPTS} '${videoPath}' ${SSH_HOST}:${remoteVideo}`], { stdio: 'pipe', timeout: 120000 });
  if (thumbPath && fs.existsSync(thumbPath)) {
    spawnSync('sh', ['-c', `${SSHPASS} scp ${SSH_OPTS} '${thumbPath}' ${SSH_HOST}:${remoteThumb}`], { stdio: 'pipe', timeout: 30000 });
  }

  const uploadScript = `
import json, sys, os
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
import warnings
warnings.filterwarnings('ignore')

token = json.load(open('${tokenPath}'))
creds_data = json.load(open('${credsPath}'))['web']
creds = Credentials(token=token['access_token'], refresh_token=token['refresh_token'],
    token_uri=creds_data['token_uri'], client_id=creds_data['client_id'], client_secret=creds_data['client_secret'])
yt = build('youtube', 'v3', credentials=creds)

body = {
  'snippet': {
    'title': ${JSON.stringify(ytTitle)},
    'description': ${JSON.stringify(ytDesc)},
    'categoryId': '25',
    'defaultLanguage': 'en',
    'defaultAudioLanguage': 'en',
    'tags': ['market watch', 'stock market', 'trading', 'finance', 'analysis', 'MarketWatch'],
  },
  'status': {'privacyStatus': 'unlisted'}
}

media = MediaFileUpload('${remoteVideo}', mimetype='video/mp4', resumable=True)
req = yt.videos().insert(part='snippet,status', body=body, media_body=media)

print('Uploading...', file=sys.stderr)
response = None
while response is None:
    status, response = req.next_chunk()
    if status:
        print(f'  {int(status.progress()*100)}%', file=sys.stderr)

vid_id = response['id']
print(f'Uploaded: {vid_id}', file=sys.stderr)

if '${playlistId}':
    yt.playlistItems().insert(part='snippet', body={
        'snippet': {'playlistId': '${playlistId}', 'resourceId': {'kind': 'youtube#video', 'videoId': vid_id}}
    }).execute()
    print('Added to playlist', file=sys.stderr)

if os.path.exists('${remoteThumb}'):
    yt.thumbnails().set(videoId=vid_id, media_body=MediaFileUpload('${remoteThumb}', mimetype='image/png')).execute()
    print('Thumbnail set', file=sys.stderr)

# cleanup
os.system('rm -rf ${remoteDir}')
print(vid_id)
`;

  const scriptPath = '/tmp/yt-upload.py';
  fs.writeFileSync(scriptPath, uploadScript, 'utf8');
  
  // Copy script to Mac Mini and run it there
  spawnSync('sh', ['-c', `${SSHPASS} scp ${SSH_OPTS} '${scriptPath}' ${SSH_HOST}:/tmp/yt-upload.py`], { stdio: 'pipe' });
  const result = spawnSync('sh', ['-c',
    `${SSHPASS} ssh ${SSH_OPTS} ${SSH_HOST} "python3 /tmp/yt-upload.py"`
  ], { stdio: ['pipe', 'pipe', 'inherit'], timeout: 300000 });
  
  const videoId = result.stdout?.toString().trim().split('\n').pop();
  if (videoId && videoId.length === 11) {
    console.log(`  ✅ YouTube: https://youtu.be/${videoId}`);
    return videoId;
  }
  console.error('  ❌ Upload failed');
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const html    = artPath ? readHtml(artPath) : '';
  const url     = buildUrl(artPath);
  const scripts = buildScripts(html, url);
  const { title, meta } = scripts;

  const slug   = slugify(title || type);
  const outDir = `/tmp/mw-media/${slug}`;
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`\n🎬 Generating media for: ${title}`);
  console.log(`   Type: ${type} | Slug: ${slug}`);

  // ── AI script generation ──
  const aiScripts = await generateAIScripts(html, url, scripts.dateStr, title, meta);
  if (aiScripts) {
    scripts.audioScript = aiScripts.audioScript;
    scripts.videoScript = aiScripts.videoScript;
  }

  if (DRY_RUN) {
    console.log('\n─── AUDIO SCRIPT ───');
    console.log(scripts.audioScript);
    console.log('\n─── VIDEO SCRIPT ───');
    console.log(scripts.videoScript);
    return;
  }

  // 1. Generate audio (≤2 min)
  const audioPath = path.join(outDir, 'audio.mp3');
  console.log('\n📢 Generating audio summary...');
  runTTS(scripts.audioScript, audioPath);
  
  if (!fs.existsSync(audioPath)) {
    console.error('❌ Audio generation failed');
    process.exit(1);
  }
  const audioDur = parseFloat(spawnSync(FFMPEG, [
    '-i', audioPath, '-f', 'null', '-'
  ], { stdio: ['pipe', 'pipe', 'pipe'] }).stderr?.toString().match(/Duration:\s*(\d+):(\d+):(\d+)/)?.[0]
    .replace('Duration: ', '').split(':').reduce((acc, v, i) => acc + parseFloat(v) * [3600, 60, 1][i], 0) || 90);
  console.log(`  ✅ Audio: ${audioPath} (~${Math.round(audioDur)}s)`);

  // 2. Generate video script TTS (longer)
  const videoTtsPath = path.join(outDir, 'video-tts.mp3');
  console.log('\n🎙️ Generating video narration...');
  runTTS(scripts.videoScript.replace(/\[[\w\s'&]+\]\s*/g, '\n\n'), videoTtsPath);
  
  const videoDur = 240; // target ~4 min

  // 3. Render slides
  console.log('\n🖼️ Rendering slides...');
  const slides   = buildSlideData(scripts);
  const pngPaths = await renderSlides(slides, outDir);
  console.log(`  ✅ ${pngPaths.length} slides rendered`);

  // Use first slide as thumbnail
  const thumbPath = pngPaths[0] || null;

  // 4. Build video
  const videoPath = path.join(outDir, 'video.mp4');
  console.log('\n🎬 Building video...');
  buildVideo(pngPaths, videoTtsPath, videoPath, videoDur);

  // 5. Upload to YouTube
  let youtubeId = null;
  if (fs.existsSync(videoPath)) {
    console.log('\n📤 Uploading to YouTube...');
    youtubeId = await uploadToYouTube(videoPath, thumbPath, scripts);
  }

  // 5b. Send audio to Telegram
  if (fs.existsSync(audioPath)) {
    try {
      console.log('\n📱 Sending audio to Telegram...');
      const topicMap = {
        daily: 73, weekly: 74, scanner: 89, retro: 89,
        analysis: 75, series: 76, tech: 76, learning: 76,
      };
      const threadId = topicMap[type] || 73;
      const ytLine   = youtubeId ? `\n📺 Video: https://youtu.be/${youtubeId}` : '';
      const artUrl   = buildUrl(artPath);
      const caption  = `🎙️ <b>${meta.label}</b> — ${scripts.dateStr}\n\n2-min audio summary.${ytLine}\n🔗 Full article: ${artUrl}`;

      const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
      const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

      if (BOT_TOKEN && CHAT_ID) {
        // Write caption to tmp file to avoid shell escaping issues with newlines
        const captionFile = path.join(outDir, 'caption.txt');
        fs.writeFileSync(captionFile, caption, 'utf8');

        // Use curl with @file for caption to preserve real newlines
        const curlCmd = [
          `curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendAudio"`,
          `-F "chat_id=${CHAT_ID}"`,
          `-F "message_thread_id=${threadId}"`,
          `-F "audio=@${audioPath}"`,
          `-F "title=${scripts.title.replace(/['"]/g,'').slice(0,60)}"`,
          `-F "performer=Market Watch"`,
          `-F "caption=<${captionFile}"`,
          `-F "parse_mode=HTML"`,
        ].join(' ');

        const curlResult = spawnSync('sh', ['-c', curlCmd], { stdio: 'pipe', timeout: 60000 });
        try { fs.unlinkSync(captionFile); } catch {}
        const curlOut = curlResult.stdout?.toString() || '';
        try {
          const j = JSON.parse(curlOut);
          if (j.ok) console.log(`  ✅ Telegram audio sent (msg_id: ${j.result.message_id})`);
          else console.error('  ❌ Telegram audio:', j.description);
        } catch { console.log('  ⚠️ Telegram audio response:', curlOut.slice(0,100)); }
      }
    } catch (e) {
      console.error('  ⚠️ Telegram audio failed:', e.message);
    }
  }

  // 6. Output result
  const result = {
    audioPath,
    videoPath: fs.existsSync(videoPath) ? videoPath : null,
    youtubeId,
    youtubeUrl: youtubeId ? `https://youtu.be/${youtubeId}` : null,
    title,
    slug,
  };

  console.log('\n✅ Media generation complete:');
  console.log(JSON.stringify(result, null, 2));
  
  // Write result file for upstream scripts to read
  fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result), 'utf8');
  console.log(`\nResult: ${path.join(outDir, 'result.json')}`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
