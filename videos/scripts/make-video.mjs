#!/usr/bin/env node
/**
 * make-video.mjs — CLI entry point for the gamma-style video pipeline
 *
 * Usage:
 *   node scripts/make-video.mjs <series-id> [--skip-tts] [--skip-render] [--upload]
 *
 * Series IDs: debuter-trading, ai-singularity-fr, ai-singularity-en,
 *             swing-trading, maitrise-expert, algo-million, bourses-mena
 */
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, writeFileSync, createReadStream } from 'fs';
import { generateVideo } from '../src/video/generate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BOT_DIR = '/Users/marketwatchxyz/GolandProjects/claude-discord-bot/scanner-video';
const CREDENTIALS_PATH = join(BOT_DIR, 'youtube-credentials.json');
const TOKEN_PATH = join(BOT_DIR, 'youtube-token.json');

// ── Args ──────────────────────────────────────────────────────────────

const [,, seriesId, ...flags] = process.argv;
const skipTts    = flags.includes('--skip-tts');
const skipRender = flags.includes('--skip-render');
const doUpload   = flags.includes('--upload');

if (!seriesId) {
  console.error('Usage: node scripts/make-video.mjs <series-id> [--skip-tts] [--skip-render] [--upload]');
  console.error('Series IDs: debuter-trading, ai-singularity-fr, ai-singularity-en, swing-trading, maitrise-expert, algo-million, bourses-mena');
  process.exit(1);
}

// ── YouTube metadata ──────────────────────────────────────────────────

const YOUTUBE_META = {
  'debuter-trading': {
    title: 'Bien Débuter en Trading — Le Guide COMPLET (2h)',
    playlist: 'Formations Trading FR',
    description: `🎓 Formation complète pour débuter en bourse et en trading.

📚 Au programme (2h) :
• Comprendre le marché : acteurs, manipulations, VIX
• Le stock picking : 4 méthodes éprouvées
• Construire son portefeuille : ETF, DCA, diversification
• L'art du all-in intelligent
• Stratégies avancées : momentum, value, options
• Psychologie : gérer les pertes et les gains

🧠 7 quizzes interactifs pour tester vos connaissances
💡 Cas concrets : GameStop, ArcelorMittal, stratégie Barbell de Taleb

⚠️ Ceci n'est pas un conseil financier.
🌐 articles.market-watch.xyz`,
    tags: ['trading', 'bourse', 'investissement', 'débutant', 'formation', 'stock picking', 'ETF', 'DCA', 'portefeuille', 'VIX', 'options', 'risk management', 'market-watch.xyz'],
    lang: 'fr',
  },
  'ai-singularity-fr': {
    title: "AI Singularity — L'IA va-t-elle Transformer la Finance ? (3h)",
    playlist: 'Formations Trading FR',
    description: `🤖 Série complète sur l'intelligence artificielle et la finance.
15 chapitres couvrant : fondements de l'IA, trading algorithmique, LLMs en finance, risques systémiques, et l'avenir.

⚠️ Ceci n'est pas un conseil financier.
🌐 articles.market-watch.xyz`,
    tags: ['AI', 'intelligence artificielle', 'finance', 'trading algorithmique', 'LLM', 'machine learning', 'singularity', 'market-watch.xyz'],
    lang: 'fr',
  },
  'ai-singularity-en': {
    title: 'AI Singularity — Will AI Transform Finance Forever? (3h)',
    playlist: 'Trading Education EN',
    description: `🤖 Complete series on artificial intelligence and finance.
15 chapters covering: AI foundations, algorithmic trading, LLMs in finance, systemic risks, and the future.

⚠️ This is not financial advice.
🌐 articles.market-watch.xyz`,
    tags: ['AI', 'artificial intelligence', 'finance', 'algorithmic trading', 'LLM', 'machine learning', 'singularity', 'market-watch.xyz'],
    lang: 'en',
  },
  'swing-trading': {
    title: 'Swing Trading Rentable — Du Setup à la Routine (2h)',
    playlist: 'Formations Trading FR',
    description: `📈 Maîtrisez le swing trading de A à Z.
6 chapitres : identification des setups, timing d'entrée, gestion de position, stop-loss dynamiques, et routine quotidienne.

⚠️ Ceci n'est pas un conseil financier.
🌐 articles.market-watch.xyz`,
    tags: ['swing trading', 'trading', 'bourse', 'setup', 'stop-loss', 'routine trading', 'market-watch.xyz'],
    lang: 'fr',
  },
  'maitrise-expert': {
    title: 'Maîtrise Expert — Le VIX, Volatilité & Stratégies Avancées (3h)',
    playlist: 'Formations Trading FR',
    description: `🎯 Formation expert : maîtriser le VIX et la volatilité pour trader comme un pro.
5 chapitres de niveau avancé : décoder le VIX, saisonnalité, indicateur de régime, trading de volatilité, stratégies options.

⚠️ Ceci n'est pas un conseil financier.
🌐 articles.market-watch.xyz`,
    tags: ['VIX', 'volatilité', 'options', 'trading avancé', 'risk management', 'expert', 'market-watch.xyz'],
    lang: 'fr',
  },
  'algo-million': {
    title: 'De Zéro au Million — Trading Algorithmique (2h)',
    playlist: 'Formations Trading FR',
    description: `🤖 Construisez votre système de trading algorithmique de A à Z.

⚠️ Ceci n'est pas un conseil financier.
🌐 articles.market-watch.xyz`,
    tags: ['trading algorithmique', 'algorithme', 'backtest', 'python', 'quant', 'market-watch.xyz'],
    lang: 'fr',
  },
  'bourses-mena': {
    title: 'Bourses MENA — Investir au Moyen-Orient & Afrique du Nord',
    playlist: 'Formations Trading FR',
    description: `🌍 Guide complet pour investir dans les marchés MENA.

⚠️ Ceci n'est pas un conseil financier.
🌐 articles.market-watch.xyz`,
    tags: ['MENA', 'Moyen-Orient', 'bourse', 'investissement', 'marchés émergents', 'market-watch.xyz'],
    lang: 'fr',
  },
  'bilan-hebdo-20260331': {
    title: 'Bilan Hebdo 31 Mars — Iran Jour 29, S&P 5ème Semaine de Baisse, Or $4592',
    playlist: 'Bilan Hebdo FR',
    description: `📊 Bilan complet de la semaine du 31 mars 2026 — tous les marchés décryptés.

📚 Au programme :
• Vue d'ensemble : S&P -2.1% (5ème semaine), STOXX 600 pire mois depuis 2020
• Actions USA, Europe, Asie : Dow en correction, Nikkei +6% YTD
• Forex : dollar perd sa prime refuge, yen frôle les 160
• Commodities : pétrole $107, or record $4 592, argent +3.8%
• Crypto : Bitcoin -47% depuis le sommet, bear market confirmé
• Iran Jour 29 & Risque de Gap : proposition US 15 points, 4 scénarios lundi

🧠 6 quizzes interactifs
📊 Données de marché en temps réel via MCP Gateway
🛢️ Détroit d'Ormuz toujours fermé — impact sur tous les marchés

⚠️ Ceci n'est pas un conseil financier.
🌐 https://articles.market-watch.xyz`,
    tags: ['bilan hebdo', 'bourse', 'Iran', 'pétrole', 'Ormuz', 'gap risk', 'S&P 500', 'crypto', 'bitcoin', 'or', 'obligations', 'forex', 'market-watch.xyz'],
    lang: 'fr',
  },
  'bilan-hebdo-20260327': {
    title: 'Bilan Hebdo 27 Mars — Iran, Pétrole $112, S&P en Chute, Risque de Gap',
    playlist: 'Bilan Hebdo FR',
    description: `📊 Bilan complet de la semaine du 27 mars 2026 — tous les marchés décryptés.

📚 Au programme :
• Vue d'ensemble : S&P -2.1%, VIX 27.4, Brent $112
• Actions USA, Europe, Asie : Dow en correction, rotation énergie
• Forex & Obligations : dollar affaibli, taux en hausse, 60/40 cassé
• Commodities : pétrole +50% depuis le blocus, or refuge
• Crypto : Bitcoin $66K, Extreme Fear, $258M liquidations
• Iran & Risque de Gap : deadline 6 avril, 4 scénarios, protection

🧠 5 quizzes interactifs
📊 Données de marché en temps réel via MCP Gateway
🛢️ Analyse complète du blocus du détroit d'Ormuz

⚠️ Ceci n'est pas un conseil financier.
🌐 https://articles.market-watch.xyz`,
    tags: ['bilan hebdo', 'bourse', 'Iran', 'pétrole', 'Ormuz', 'gap risk', 'S&P 500', 'crypto', 'bitcoin', 'or', 'VIX', 'market-watch.xyz'],
    lang: 'fr',
  },
  'presentation-en': {
    title: 'Who is Behind Market Watch? 25 Years in Trading Infrastructure',
    playlist: 'Trading Education EN',
    description: `Almost 25 years building trading systems at Thomson Reuters, Euronext, Societe Generale, and Brevan Howard. This is the story behind Market Watch - from institutional infrastructure to independent analysis tools.

4 Chapters:
- Who's Behind Market Watch - the person behind the data
- The Professional Journey - Thomson Reuters, Euronext, SocGen, Brevan Howard
- From Infrastructure to Trading - how building systems creates a unique edge
- Market Watch Vision - institutional tools, accessible to everyone

2 interactive quizzes
Free tools and transparent track record

This is not financial advice.
https://articles.market-watch.xyz`,
    tags: ['trading', 'market watch', 'trading infrastructure', 'hedge fund', 'exchange', 'investment bank', 'about', 'market-watch.xyz'],
    lang: 'en',
  },
  'scanner-diy-en': {
    title: 'DIY Scanner - Replicate Our Trading System for Free, No Coding Required',
    playlist: 'Trading Education EN',
    description: `Build your own stock scanner using free tools only - same results as our automated system.

7 Chapters:
- What We're Building - toolkit overview (Finviz, Google Sheets, Yahoo/Webull)
- Step 1: Check Market Regime - 30-second VIX check
- Strategy 1: Oversold Bounce - RSI + high relative volume
- Strategy 2: Momentum Expansion - SMA20 + volume surge
- Strategy 3: Breakout Squeeze - new highs + volatility expansion
- Scoring and Selection - 3-factor manual scoring + dilution check
- Google Sheets Tracker - position management, alerts, daily routine

5 interactive quizzes
Real Finviz screener setups you can bookmark
15-minute daily routine, zero cost
Includes the INDO dilution lesson

This is not financial advice.
https://articles.market-watch.xyz`,
    tags: ['trading', 'scanner', 'DIY', 'Finviz', 'free tools', 'stock screener', 'RSI', 'momentum', 'breakout', 'position sizing', 'Google Sheets', 'market-watch.xyz'],
    lang: 'en',
  },
  'scanner-guide-en': {
    title: 'The Scanner Guide — Your Complete Playbook for Automated Trading Signals',
    playlist: 'Trading Education EN',
    description: `📊 Complete guide to the Market Watch Scanner — automated trading signals explained.

📚 8 Chapters:
• What Is the Scanner? — why automated screening works
• Reading a Scan — anatomy, scoring system, safety filters
• The 3 Portfolio Modes — Growth, Calmar, Conservative
• Signal Lifecycle — TP1, TP2, Stop Loss, Timeout, Rotation
• Position Sizing & Risk — what "25% allocation" really means
• Market Regime — 5 regimes, strategy adaptation
• Getting Started & Convergence — day 1 to full alignment
• Your Dashboard — Status Page, Telegram, YouTube tools

🧠 8 interactive quizzes
📈 Real trade examples with actual P&L numbers
💡 98,000 backtested parameter combinations
📊 Live portfolio tracking: +5.46% return, -1.63% max drawdown

⚠️ This is not financial advice.
🌐 https://articles.market-watch.xyz/scanner/status/`,
    tags: ['trading', 'scanner', 'automated trading', 'signals', 'portfolio', 'risk management', 'position sizing', 'market regime', 'VIX', 'backtesting', 'market-watch.xyz'],
    lang: 'en',
  },
};

// ── YouTube upload (adapted from pipeline.mjs) ─────────────────────────

function buildChapters(eduData, audioDurations) {
  const slides = eduData.slides || [];
  const lines = ['0:00:00 Introduction'];
  let cursor = 0;

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const dur = (audioDurations[i] || 5) + 1.5;

    if (slide.type === 'chapter-intro' && i > 0) {
      const totalSec = Math.round(cursor);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      const ts = `${String(h).padStart(1, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      const ch = slide.chapter || {};
      lines.push(`${ts} ${ch.title || `Chapitre ${ch.partNumber}`}`);
    }
    cursor += dur;
  }

  return lines.join('\n');
}

async function uploadToYouTube(videoPath, meta, eduData, audioDurations, thumbnailPath) {
  const { google } = await import('googleapis');

  const credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const token = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8'));
  const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;
  const oauth2 = new google.auth.OAuth2(client_id, client_secret, redirect_uris?.[0] || 'http://localhost');
  oauth2.setCredentials(token);

  if (token.expiry_date && Date.now() > token.expiry_date) {
    const { credentials: newCreds } = await oauth2.refreshAccessToken();
    writeFileSync(TOKEN_PATH, JSON.stringify(newCreds, null, 2));
    oauth2.setCredentials(newCreds);
  }

  const youtube = google.youtube({ version: 'v3', auth: oauth2 });

  const chapters = buildChapters(eduData, audioDurations);
  const fullDescription = `${meta.description}\n\n📑 Chapitres :\n${chapters}\n\n#${meta.tags.join(' #')}`;

  console.log(`   Uploading: ${meta.title}`);

  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: meta.title.slice(0, 100),
        description: fullDescription,
        tags: meta.tags,
        categoryId: '27', // Education
        defaultLanguage: meta.lang,
        defaultAudioLanguage: meta.lang,
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false,
        license: 'youtube',
        embeddable: true,
        publicStatsViewable: true,
      },
    },
    media: {
      body: createReadStream(videoPath),
    },
  });

  const videoId = res.data.id;
  console.log(`   Uploaded: https://youtu.be/${videoId}`);

  // Set thumbnail
  if (thumbnailPath && existsSync(thumbnailPath)) {
    try {
      await youtube.thumbnails.set({
        videoId,
        media: { body: createReadStream(thumbnailPath) },
      });
      console.log(`   Thumbnail set`);
    } catch (err) {
      console.warn(`   Thumbnail error: ${err.message?.slice(0, 80)}`);
    }
  }

  // Add to playlist
  try {
    const playlists = await youtube.playlists.list({ part: ['snippet'], mine: true, maxResults: 50 });
    let playlistId = playlists.data.items?.find(p => p.snippet.title === meta.playlist)?.id;

    if (!playlistId) {
      const pl = await youtube.playlists.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: meta.playlist,
            description: `Formations trading — ${meta.lang === 'fr' ? 'Série éducative par market-watch.xyz' : 'Educational series by market-watch.xyz'}`,
          },
          status: { privacyStatus: 'public' },
        },
      });
      playlistId = pl.data.id;
      console.log(`   Created playlist: ${meta.playlist}`);
    }

    await youtube.playlistItems.insert({
      part: ['snippet'],
      requestBody: {
        snippet: { playlistId, resourceId: { kind: 'youtube#video', videoId } },
      },
    });
    console.log(`   Added to playlist: ${meta.playlist}`);
  } catch (err) {
    console.warn(`   Playlist error: ${err.message?.slice(0, 80)}`);
  }

  return videoId;
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  const eduDataPath   = join(ROOT, `public/edu-data-${seriesId}.json`);
  const narrationPath = join(ROOT, `public/edu-narration-${seriesId}.json`);

  // Fallback to generic names for debuter-trading which has edu-narration.json
  const narrationFallback = join(ROOT, 'public/edu-narration.json');

  if (!existsSync(eduDataPath)) {
    console.error(`edu-data not found: ${eduDataPath}`);
    process.exit(1);
  }

  const resolvedNarration = existsSync(narrationPath) ? narrationPath : narrationFallback;
  if (!existsSync(resolvedNarration)) {
    console.error(`narration not found: ${narrationPath}`);
    process.exit(1);
  }

  const meta = YOUTUBE_META[seriesId];
  if (!meta) {
    console.error(`Unknown series: ${seriesId}. Available: ${Object.keys(YOUTUBE_META).join(', ')}`);
    process.exit(1);
  }

  const outputDir  = join(ROOT, 'output');
  const outputPath = join(outputDir, `${seriesId}.mp4`);

  const result = await generateVideo({
    seriesId,
    eduDataPath,
    narrationPath: resolvedNarration,
    outputPath,
    lang: meta.lang,
    skipTts,
    skipRender,
  });

  // Generate thumbnails (global + per chapter)
  const eduData = JSON.parse(readFileSync(eduDataPath, 'utf-8'));
  const thumbDir = join(outputDir, `thumbnails-${seriesId}`);
  if (!existsSync(thumbDir)) {
    const { mkdirSync } = await import('fs');
    mkdirSync(thumbDir, { recursive: true });
  }

  // Copy chapter-intro slides as chapter thumbnails
  const slides = eduData.slides || [];
  const chapterSlides = slides.map((s, i) => ({ ...s, index: i })).filter(s => s.type === 'chapter-intro');
  const tmpDir = result.tmpDir || join(outputDir, `.video-tmp-${seriesId}`);

  for (const ch of chapterSlides) {
    const srcPng = join(tmpDir, `slide_${String(ch.index).padStart(3, '0')}.png`);
    const dstPng = join(thumbDir, `chapter_${ch.chapter?.partNumber || ch.index}.png`);
    if (existsSync(srcPng)) {
      const { copyFileSync } = await import('fs');
      copyFileSync(srcPng, dstPng);
      console.log(`   Thumbnail: ${dstPng}`);
    }
  }

  // Global thumbnail = first slide (chapter-intro of part 1)
  const globalSrc = join(tmpDir, 'slide_000.png');
  const globalThumb = join(thumbDir, 'thumbnail.png');
  if (existsSync(globalSrc)) {
    const { copyFileSync } = await import('fs');
    copyFileSync(globalSrc, globalThumb);
    console.log(`   Global thumbnail: ${globalThumb}`);
  }

  if (doUpload) {
    if (!existsSync(CREDENTIALS_PATH) || !existsSync(TOKEN_PATH)) {
      console.error('YouTube credentials not found. Skipping upload.');
      process.exit(0);
    }

    await uploadToYouTube(result.outputPath, meta, eduData, result.audioDurations, globalThumb);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
