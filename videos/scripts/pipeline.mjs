#!/usr/bin/env node
/**
 * pipeline.mjs — Full educational video pipeline
 *
 * Usage: node scripts/pipeline.mjs <series-id> [--skip-tts] [--skip-render] [--skip-upload] [--no-cleanup]
 *
 * Steps:
 * 1. Generate slide content JSON + narration text
 * 2. Generate TTS audio via XTTS on ser
 * 3. Render video with Remotion (--concurrency=4)
 * 4. Generate thumbnail (frame 0)
 * 5. Upload to YouTube (public, correct playlist, chapters, description)
 * 6. Cleanup local files to save disk space
 *
 * Series IDs: debuter-trading, ai-singularity-fr, ai-singularity-en,
 *             swing-trading, maitrise-expert, algo-million, bourses-mena
 */
import fs from 'fs-extra';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createReadStream, readFileSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BOT_DIR = '/Users/marketwatchxyz/GolandProjects/claude-discord-bot/scanner-video';
const CREDENTIALS_PATH = join(BOT_DIR, 'youtube-credentials.json');
const TOKEN_PATH = join(BOT_DIR, 'youtube-token.json');

const seriesId = process.argv[2];
const flags = process.argv.slice(3);
const skipTTS = flags.includes('--skip-tts');
const skipRender = flags.includes('--skip-render');
const skipUpload = flags.includes('--skip-upload');
const noCleanup = flags.includes('--no-cleanup');

if (!seriesId) {
  console.error('Usage: node scripts/pipeline.mjs <series-id>');
  process.exit(1);
}

// ── Series metadata for YouTube ─────────────────────────────────────

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
    title: 'AI Singularity — L\'IA va-t-elle Transformer la Finance ? (3h)',
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

📚 Au programme :
• Comprendre le VIX : calcul, interprétation, contango vs backwardation
• Saisonnalité de la volatilité : patterns récurrents exploitables
• Le VIX comme indicateur de régime : risk-on vs risk-off
• Trader la volatilité : VXX, UVXY, SVXY, futures VIX
• Stratégies options avancées : straddles, strangles, iron condors sur le VIX

⚠️ Ceci n'est pas un conseil financier.
🌐 articles.market-watch.xyz`,
    tags: ['VIX', 'volatilité', 'options', 'trading avancé', 'risk management', 'expert', 'market-watch.xyz'],
    lang: 'fr',
  },
  'algo-million': {
    title: 'De Zéro au Million — Trading Algorithmique (2h)',
    playlist: 'Formations Trading FR',
    description: `🤖 Construisez votre système de trading algorithmique de A à Z.
12 chapitres : infrastructure, données, stratégies, backtesting, exécution, scaling.

⚠️ Ceci n'est pas un conseil financier.
🌐 articles.market-watch.xyz`,
    tags: ['algo trading', 'trading algorithmique', 'backtesting', 'quantitative', 'python', 'finance', 'market-watch.xyz'],
    lang: 'fr',
  },
  'bourses-mena': {
    title: 'Bourses MENA — Investir au Moyen-Orient (2h)',
    playlist: 'Formations Trading FR',
    description: `🌍 Guide complet pour investir dans les marchés MENA.
6 chapitres : panorama, Arabie Saoudite, EAU, Égypte, Maroc/Tunisie, crypto & fintech.

⚠️ Ceci n'est pas un conseil financier.
🌐 articles.market-watch.xyz`,
    tags: ['MENA', 'Moyen-Orient', 'bourse', 'Arabie Saoudite', 'EAU', 'Dubai', 'investissement', 'market-watch.xyz'],
    lang: 'fr',
  },
  // ── Article-based videos ──
  'claude-code-avance': {
    title: 'Claude Code Avancé — Le Guide Expert Complet',
    playlist: 'Tech & AI FR',
    description: `🤖 Guide expert de Claude Code : architecture, MCP servers, hooks, skills, subagents, worktrees, budget optimization.
Tout ce qu'il faut savoir pour maîtriser l'outil de coding AI le plus avancé.

🌐 articles.market-watch.xyz/tech/claude-code-avance/`,
    tags: ['Claude Code', 'AI', 'coding', 'MCP', 'hooks', 'subagents', 'tech', 'market-watch.xyz'],
    lang: 'fr',
  },
  'signal-vs-noise': {
    title: 'Signal vs Bruit — Naviguer l\'Ère de l\'Information',
    playlist: 'Tech & AI FR',
    description: `📡 Comment distinguer le signal du bruit dans un monde saturé d'information.
5 filtres pour identifier ce qui compte vraiment : Lindy, douleur, irréversibilité, et plus.

🌐 articles.market-watch.xyz/tech/signal-vs-noise/`,
    tags: ['signal', 'bruit', 'information', 'AI', 'éducation', 'tech', 'market-watch.xyz'],
    lang: 'fr',
  },
  'orbs-analysis': {
    title: 'ORBS (Eightco Holdings) — Analyse Complète',
    playlist: 'Analyses FR',
    description: `📊 Analyse détaillée d'ORBS (Eightco Holdings) : fondamentaux, catalyseurs, analyse technique, trade idea.
Crypto mining + AI + speculative play.

⚠️ Ceci n'est pas un conseil financier.
🌐 articles.market-watch.xyz/analyses/ORBS/`,
    tags: ['ORBS', 'analyse', 'crypto', 'AI', 'speculative', 'trade-idea', 'market-watch.xyz'],
    lang: 'fr',
  },
  'daily-20260319': {
    title: 'Briefing Marché 19 Mars 2026 — Analyse Quotidienne',
    playlist: 'Briefings Quotidiens FR',
    description: `📰 Briefing quotidien des marchés : US, Europe, Asie, Crypto, Géopolitique.
Analyse complète de la journée avec trade ideas et formation.

⚠️ Ceci n'est pas un conseil financier.
🌐 articles.market-watch.xyz/daily/20260319/`,
    tags: ['daily', 'marché', 'briefing', 'trading', 'analyse', 'market-watch.xyz'],
    lang: 'fr',
  },
  'psx-analysis': {
    title: 'Phillips 66 (PSX) — Complete Stock Analysis | B+ Energy Play at 52W High',
    playlist: 'Analyses EN',
    description: `📊 Complete analysis of Phillips 66 (PSX): fundamentals, technicals, trade idea.

📈 Key highlights:
• Refining at 99% utilization, 88% clean product yield (record)
• Midstream growth toward $4.5B EBITDA by 2027
• EPS beat 3 consecutive quarters (Q2-Q4 2025)
• Dividend yield 2.87%, Forward P/E 13.6x
• Trade Idea: Entry $175-178 / Stop $165 / TP1 $190 / TP2 $200

⚠️ This is not financial advice.
🌐 articles.market-watch.xyz/analyses/PSX/`,
    tags: ['PSX', 'Phillips 66', 'stock analysis', 'energy', 'refining', 'midstream', 'dividend', 'trade-idea', 'market-watch.xyz'],
    lang: 'en',
  },
};

// ── Main pipeline ───────────────────────────────────────────────────

async function main() {
  const meta = YOUTUBE_META[seriesId];
  if (!meta) {
    console.error(`Unknown series: ${seriesId}`);
    process.exit(1);
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  🎬 Pipeline: ${meta.title}`);
  console.log(`${'═'.repeat(60)}\n`);

  const outputDir = join(ROOT, 'output');
  await fs.ensureDir(outputDir);
  const videoPath = join(outputDir, `${seriesId}.mp4`);
  const thumbPath = join(outputDir, `${seriesId}-thumb.png`);

  // ── Step 1: Generate content ──────────────────────────────────────
  console.log('\n📚 Step 1: Generating slide content...');
  execSync(`node scripts/generate-edu-content.mjs ${seriesId}`, { cwd: ROOT, stdio: 'inherit' });

  // ── Step 2: TTS ───────────────────────────────────────────────────
  if (!skipTTS) {
    console.log('\n🎙️  Step 2: Generating TTS audio...');
    execSync(`node scripts/generate-edu-tts.mjs`, { cwd: ROOT, stdio: 'inherit', timeout: 3600000 });
  } else {
    console.log('\n⏭️  Step 2: Skipping TTS (--skip-tts)');
  }

  // ── Step 3: Render video ──────────────────────────────────────────
  if (!skipRender) {
    console.log('\n🎬 Step 3: Rendering video (full Remotion render)...');
    execSync(
      `npx remotion render EducationalVideo "${videoPath}" --concurrency=8`,
      { cwd: ROOT, stdio: 'inherit', timeout: 86400000 } // 24h timeout
    );
    const stats = await fs.stat(videoPath);
    console.log(`   ✅ Video rendered: ${(stats.size / 1024 / 1024).toFixed(0)} MB`);
  } else {
    console.log('\n⏭️  Step 3: Skipping render (--skip-render)');
  }

  // ── Step 4: Generate thumbnail ────────────────────────────────────
  if (!skipRender) {
    console.log('\n🖼️  Step 4: Generating thumbnail...');
    try {
      execSync(
        `npx remotion still EducationalVideo "${thumbPath}" --frame=0`,
        { cwd: ROOT, stdio: 'inherit', timeout: 60000 }
      );
      console.log('   ✅ Thumbnail generated');
    } catch {
      console.log('   ⚠️  Thumbnail generation failed, continuing without');
    }
  }

  // ── Step 5: Upload to YouTube ─────────────────────────────────────
  if (!skipUpload) {
    console.log('\n📤 Step 5: Uploading to YouTube...');
    await uploadToYouTube(videoPath, thumbPath, meta);
  } else {
    console.log('\n⏭️  Step 5: Skipping upload (--skip-upload)');
  }

  // ── Step 6: Cleanup ───────────────────────────────────────────────
  if (!noCleanup) {
    console.log('\n🧹 Step 6: Cleaning up...');
    // Remove video file (biggest)
    if (await fs.pathExists(videoPath)) {
      await fs.remove(videoPath);
      console.log(`   🗑️  Removed ${videoPath}`);
    }
    // Remove audio files
    const audioDir = join(ROOT, 'public/audio');
    const prefix = seriesId.replace(/-/g, '_');
    const audioFiles = (await fs.readdir(audioDir)).filter(f => f.startsWith(prefix + '_'));
    for (const f of audioFiles) {
      await fs.remove(join(audioDir, f));
    }
    console.log(`   🗑️  Removed ${audioFiles.length} audio files`);
    // Remove thumbnail
    if (await fs.pathExists(thumbPath)) {
      await fs.remove(thumbPath);
    }
    console.log('   ✅ Cleanup complete');
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ✅ Pipeline complete: ${meta.title}`);
  console.log(`${'═'.repeat(60)}\n`);
}

// ── YouTube upload ──────────────────────────────────────────────────

async function uploadToYouTube(videoPath, thumbPath, meta) {
  const { google } = await import('googleapis');

  const credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf8'));
  const token = JSON.parse(readFileSync(TOKEN_PATH, 'utf8'));
  const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;
  const oauth2 = new google.auth.OAuth2(client_id, client_secret, redirect_uris?.[0] || 'http://localhost');
  oauth2.setCredentials(token);

  if (token.expiry_date && Date.now() > token.expiry_date) {
    const { credentials: newCreds } = await oauth2.refreshAccessToken();
    writeFileSync(TOKEN_PATH, JSON.stringify(newCreds, null, 2));
    oauth2.setCredentials(newCreds);
  }

  const youtube = google.youtube({ version: 'v3', auth: oauth2 });

  // Build chapter timestamps from edu-data
  const eduData = await fs.readJson(join(ROOT, 'public/edu-data.json'));
  const chapters = buildChapters(eduData);
  const fullDescription = `${meta.description}\n\n📑 Chapitres :\n${chapters}\n\n#${meta.tags.join(' #')}`;

  console.log(`   📤 Uploading: ${meta.title}`);

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
  console.log(`   ✅ Uploaded: https://youtu.be/${videoId}`);

  // Set thumbnail
  if (await fs.pathExists(thumbPath)) {
    try {
      await youtube.thumbnails.set({ videoId, media: { body: createReadStream(thumbPath) } });
      console.log('   🖼️  Thumbnail set');
    } catch (err) {
      console.warn(`   ⚠️  Thumbnail failed: ${err.message?.slice(0, 60)}`);
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
            description: `Formations et tutoriels trading — ${meta.lang === 'fr' ? 'Série éducative par market-watch.xyz' : 'Educational series by market-watch.xyz'}`,
          },
          status: { privacyStatus: 'public' },
        },
      });
      playlistId = pl.data.id;
      console.log(`   📋 Created playlist: ${meta.playlist} (${playlistId})`);
    }

    await youtube.playlistItems.insert({
      part: ['snippet'],
      requestBody: {
        snippet: { playlistId, resourceId: { kind: 'youtube#video', videoId } },
      },
    });
    console.log(`   📋 Added to playlist: ${meta.playlist}`);
  } catch (err) {
    console.warn(`   ⚠️  Playlist error: ${err.message?.slice(0, 60)}`);
  }

  return videoId;
}

// ── Build YouTube chapters from slide data ──────────────────────────

function buildChapters(eduData) {
  const { slides, audioDurations, config } = eduData;
  const fps = 15; // Must match Root.tsx eduFps
  const lines = [];
  const introDuration = 6 * fps; // Same as EducationalVideo.tsx
  let cursorFrames = introDuration;

  // First chapter at 0:00 (YouTube requirement)
  lines.push(`0:00 Introduction — ${config.seriesTitle}`);

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const audioKey = slide.audioFile?.replace('.wav', '') || `slide_${i}`;
    // Same formula as EducationalVideo.tsx line 1752
    const durFrames = Math.ceil(((audioDurations[audioKey] || 12) + 1.5) * fps);
    const cursorSec = cursorFrames / fps;

    if (slide.type === 'chapter-intro' && slide.chapter) {
      const mm = Math.floor(cursorSec / 60);
      const ss = Math.floor(cursorSec % 60);
      const ts = `${mm}:${ss.toString().padStart(2, '0')}`;
      const label = slide.chapter.partNumber
        ? `Chapitre ${slide.chapter.partNumber} — ${slide.chapter.title}`
        : slide.chapter.title;
      lines.push(`${ts} ${label}`);
    }

    if (slide.type === 'quiz') {
      const mm = Math.floor(cursorSec / 60);
      const ss = Math.floor(cursorSec % 60);
      const ts = `${mm}:${ss.toString().padStart(2, '0')}`;
      lines.push(`${ts} 🧠 Quiz`);
    }

    cursorFrames += durFrames;
  }

  return lines.join('\n');
}

main().catch(err => { console.error(err); process.exit(1); });
