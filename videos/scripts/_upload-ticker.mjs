import { createReadStream, readFileSync, writeFileSync } from 'fs';
import fs from 'fs-extra';
import { join } from 'path';

const ROOT = '/Users/marketwatchxyz/GolandProjects/articles/videos';
const BOT_DIR = '/Users/marketwatchxyz/GolandProjects/claude-discord-bot/scanner-video';
const videoPath = join(ROOT, 'output/psx-analysis.mp4');
const thumbPath = join(ROOT, 'output/psx-analysis-thumb.png');

const eduData = await fs.readJson(join(ROOT, 'public/edu-data.json'));
const cfg = eduData.config;

const meta = {
  title: `${cfg.ticker} (${cfg.tickerName}) — ${cfg.seriesSubtitle}`,
  playlist: 'Analyses EN',
  description: `📊 ${cfg.seriesTitle}\n${cfg.seriesSubtitle}\n\n📈 Complete 5-minute analysis covering verdict, fundamentals, technical setup, risks & catalysts, and trade idea.\n\n⚠️ This is not financial advice.\n🌐 articles.market-watch.xyz/analyses/${cfg.ticker}/`,
  tags: [cfg.ticker, cfg.tickerName, 'stock analysis', 'energy', 'refining', 'dividend', 'trade-idea', 'market-watch.xyz'],
  lang: cfg.language || 'en',
};

// Build chapters
const slides = eduData.slides || [];
const audioDurations = eduData.audioDurations || {};
const fps = 30;
let currentFrame = 0;
const chapters = [];
for (const slide of slides) {
  if (slide.type === 'chapter-intro' && slide.chapter) {
    const secs = Math.floor(currentFrame / fps);
    const mm = String(Math.floor(secs / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');
    chapters.push(mm + ':' + ss + ' ' + slide.chapter.title);
  }
  const key = (slide.audioFile || '').replace('.wav', '');
  const dur = audioDurations[key] || 12;
  currentFrame += Math.ceil(dur * fps) + 30;
}

const chaptersStr = chapters.join('\n');
const fullDescription = meta.description + '\n\n📑 Chapters:\n' + chaptersStr + '\n\n#' + meta.tags.join(' #');

const { google } = await import('googleapis');
const credentials = JSON.parse(readFileSync(join(BOT_DIR, 'youtube-credentials.json'), 'utf8'));
const token = JSON.parse(readFileSync(join(BOT_DIR, 'youtube-token.json'), 'utf8'));
const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;
const oauth2 = new google.auth.OAuth2(client_id, client_secret, redirect_uris?.[0] || 'http://localhost');
oauth2.setCredentials(token);
if (token.expiry_date && Date.now() > token.expiry_date) {
  const { credentials: newCreds } = await oauth2.refreshAccessToken();
  writeFileSync(join(BOT_DIR, 'youtube-token.json'), JSON.stringify(newCreds, null, 2));
  oauth2.setCredentials(newCreds);
}
const youtube = google.youtube({ version: 'v3', auth: oauth2 });

console.log('📤 Uploading:', meta.title);
console.log('📑 Chapters:\n' + chaptersStr);

const res = await youtube.videos.insert({
  part: ['snippet', 'status'],
  requestBody: {
    snippet: { title: meta.title.slice(0, 100), description: fullDescription, tags: meta.tags, categoryId: '27', defaultLanguage: meta.lang, defaultAudioLanguage: meta.lang },
    status: { privacyStatus: 'public', selfDeclaredMadeForKids: false, embeddable: true },
  },
  media: { body: createReadStream(videoPath) },
});
const videoId = res.data.id;
console.log('✅ Uploaded: https://youtu.be/' + videoId);

if (await fs.pathExists(thumbPath)) {
  try { await youtube.thumbnails.set({ videoId, media: { body: createReadStream(thumbPath) } }); console.log('🖼️ Thumbnail set'); } catch (e) { console.warn('⚠️ Thumb:', e.message?.slice(0, 60)); }
}

try {
  const pls = await youtube.playlists.list({ part: ['snippet'], mine: true, maxResults: 50 });
  let plId = pls.data.items?.find(p => p.snippet.title === 'Analyses EN')?.id;
  if (!plId) { const pl = await youtube.playlists.insert({ part: ['snippet', 'status'], requestBody: { snippet: { title: 'Analyses EN' }, status: { privacyStatus: 'public' } } }); plId = pl.data.id; }
  await youtube.playlistItems.insert({ part: ['snippet'], requestBody: { snippet: { playlistId: plId, resourceId: { kind: 'youtube#video', videoId } } } });
  console.log('📋 Added to playlist');
} catch (e) { console.warn('⚠️ Playlist:', e.message?.slice(0, 60)); }
