/**
 * generate.js
 * Core video generation pipeline: TTS → screenshots → segments → concat
 *
 * opts: { seriesId, eduDataPath, narrationPath, outputPath, voice, lang }
 */

import puppeteer from 'puppeteer';
import { execSync } from 'child_process';
import { resolve, join, dirname } from 'path';
import { existsSync, mkdirSync, readdirSync, unlinkSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { slidesToHtml } from './slides-to-html.js';
import { tradingTheme } from './theme.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EDGE_TTS = '/opt/homebrew/bin/edge-tts';

const VOICES = {
  fr: { voice: 'fr-FR-RemyMultilingualNeural', rate: '-5%' },
  en: { voice: 'en-US-AndrewMultilingualNeural', rate: '-5%' },
};

function now() {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function log(msg) {
  console.log(`[${now()}] ${msg}`);
}

// ── Step 1: Generate TTS audio ────────────────────────────────────────

function generateAudio(narrationData, tmpDir, voiceOpts, skipExisting) {
  log(`[1/5] Generating TTS audio (${narrationData.length} segments)...`);
  const durations = [];

  for (let i = 0; i < narrationData.length; i++) {
    const audioFile = join(tmpDir, `slide_${String(i).padStart(3, '0')}.mp3`);

    if (skipExisting && existsSync(audioFile)) {
      const dur = parseFloat(
        execSync(`ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${audioFile}"`, { encoding: 'utf-8' }).trim()
      );
      durations.push(dur);
      log(`  [${i + 1}/${narrationData.length}] SKIP (exists) ${dur.toFixed(1)}s`);
      continue;
    }

    const entry = narrationData[i];
    const text = (entry.text || entry).replace(/\n/g, ' ');

    // Write text to temp file to avoid shell escaping issues (parentheses, quotes, etc.)
    const textFile = join(tmpDir, `text_${String(i).padStart(3, '0')}.txt`);
    writeFileSync(textFile, text);

    execSync(
      `${EDGE_TTS} --voice "${voiceOpts.voice}" --rate="${voiceOpts.rate}" --pitch="+0Hz" ` +
      `-f "${textFile}" --write-media "${audioFile}" 2>/dev/null`,
      { stdio: 'pipe', shell: true }
    );

    const dur = parseFloat(
      execSync(`ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${audioFile}"`, { encoding: 'utf-8' }).trim()
    );
    durations.push(dur);

    const bar = '█'.repeat(Math.round(dur / 2)) + '░'.repeat(Math.max(0, 15 - Math.round(dur / 2)));
    log(`  [${i + 1}/${narrationData.length}] ${bar} ${dur.toFixed(1)}s`);
  }

  const total = durations.reduce((a, b) => a + b, 0);
  log(`  Total narration: ${(total / 60).toFixed(1)} min\n`);
  return durations;
}

// ── Step 2: Capture screenshots ───────────────────────────────────────

async function captureScreenshots(htmlPath, slideCount, tmpDir, skipExisting) {
  log(`[2/5] Capturing ${slideCount} slide screenshots...`);

  // Check if all exist
  if (skipExisting) {
    const allExist = Array.from({ length: slideCount }, (_, i) =>
      existsSync(join(tmpDir, `slide_${String(i).padStart(3, '0')}.png`))
    ).every(Boolean);
    if (allExist) {
      log('  All screenshots exist, skipping capture.\n');
      return;
    }
  }

  const browser = await puppeteer.launch({
    headless: 'shell',
    protocolTimeout: 120000,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(`file://${htmlPath}`, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait for Reveal.js to be ready
    await page.waitForFunction(() => typeof Reveal !== 'undefined' && Reveal.isReady(), { timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    for (let i = 0; i < slideCount; i++) {
      const imgFile = join(tmpDir, `slide_${String(i).padStart(3, '0')}.png`);

      if (skipExisting && existsSync(imgFile)) {
        log(`  [${i + 1}/${slideCount}] SKIP (exists)`);
        continue;
      }

      await page.evaluate((idx) => Reveal.slide(idx), i);
      await new Promise(r => setTimeout(r, 800));
      await page.screenshot({ path: imgFile, type: 'png', captureBeyondViewport: false });
      log(`  [${i + 1}/${slideCount}] Captured`);
    }
  } finally {
    await browser.close();
  }
  log('');
}

// ── Step 3: Compose segments ──────────────────────────────────────────

function composeSegments(slideCount, audioDurations, tmpDir) {
  log(`[3/5] Compositing ${slideCount} video segments...`);
  const segmentFiles = [];

  for (let i = 0; i < slideCount; i++) {
    const imgFile  = join(tmpDir, `slide_${String(i).padStart(3, '0')}.png`);
    const audioFile = join(tmpDir, `slide_${String(i).padStart(3, '0')}.mp3`);
    const segFile  = join(tmpDir, `segment_${String(i).padStart(3, '0')}.mp4`);

    if (existsSync(segFile)) {
      log(`  [${i + 1}/${slideCount}] SKIP segment (exists)`);
      segmentFiles.push(segFile);
      continue;
    }

    const dur = audioDurations[i] + 1.5; // 0.5s fade-in + 1s pause after

    execSync(
      `ffmpeg -y -loop 1 -i "${imgFile}" -i "${audioFile}" ` +
      `-filter_complex "[0:v]scale=1920:1080,format=yuv420p,` +
      `fade=t=in:st=0:d=0.5,fade=t=out:st=${(dur - 0.5).toFixed(3)}:d=0.5[v];` +
      `[1:a]adelay=500|500,apad,atrim=0:${dur.toFixed(3)}[a]" ` +
      `-map "[v]" -map "[a]" ` +
      `-c:v libx264 -preset medium -crf 18 -c:a aac -b:a 192k ` +
      `-t ${dur.toFixed(3)} -r 30 "${segFile}" 2>/dev/null`,
      { stdio: 'pipe' }
    );

    segmentFiles.push(segFile);
    log(`  [${i + 1}/${slideCount}] ${dur.toFixed(1)}s`);
  }

  log('');
  return segmentFiles;
}

// ── Step 4: Concatenate ───────────────────────────────────────────────

function concatenateSegments(segmentFiles, tmpDir, outputPath) {
  log('[4/5] Concatenating final video...');

  const concatList = join(tmpDir, 'concat.txt');
  writeFileSync(concatList, segmentFiles.map(f => `file '${f}'`).join('\n'));

  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${concatList}" ` +
    `-c:v libx264 -preset medium -crf 18 -c:a aac -b:a 192k ` +
    `-movflags +faststart "${outputPath}" 2>/dev/null`,
    { stdio: 'pipe' }
  );

  log(`  Output: ${outputPath}\n`);
}

// ── Step 5: Generate chapters.txt ─────────────────────────────────────

function generateChapters(slides, audioDurations, outputDir) {
  log('[5/5] Generating chapters.txt...');
  const chaptersPath = join(outputDir, 'chapters.txt');
  const lines = ['0:00:00 Introduction'];
  let cursor = 0;

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const dur = (audioDurations[i] || 0) + 1.5;

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

  writeFileSync(chaptersPath, lines.join('\n'));
  log(`  Chapters: ${chaptersPath}`);
  return chaptersPath;
}

// ── Main export ───────────────────────────────────────────────────────

export async function generateVideo(opts) {
  const {
    seriesId,
    eduDataPath,
    narrationPath,
    outputPath,
    lang = 'fr',
    skipTts = false,
    skipRender = false,
  } = opts;

  const resolvedOutput = resolve(outputPath);
  const outputDir = dirname(resolvedOutput);
  const tmpDir = join(outputDir, `.video-tmp-${seriesId}`);

  // Ensure dirs exist
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });

  // Load data
  const eduData = JSON.parse(readFileSync(resolve(eduDataPath), 'utf-8'));
  const narrationData = JSON.parse(readFileSync(resolve(narrationPath), 'utf-8'));
  const slides = eduData.slides || [];

  log(`\n${'═'.repeat(60)}`);
  log(`  Series:  ${seriesId}`);
  log(`  Slides:  ${slides.length}`);
  log(`  Lang:    ${lang}`);
  log(`  Output:  ${resolvedOutput}`);
  log(`${'═'.repeat(60)}\n`);

  // Voice config
  const voiceOpts = VOICES[lang] || VOICES.fr;

  // Step 1: TTS
  let audioDurations;
  if (skipTts) {
    log('[1/5] Skipping TTS (--skip-tts)...');
    audioDurations = slides.map((_, i) => {
      const f = join(tmpDir, `slide_${String(i).padStart(3, '0')}.mp3`);
      if (existsSync(f)) {
        return parseFloat(
          execSync(`ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${f}"`, { encoding: 'utf-8' }).trim()
        );
      }
      return 5; // fallback
    });
  } else {
    audioDurations = generateAudio(narrationData, tmpDir, voiceOpts, true);
  }

  // Step 2: Screenshots
  if (!skipRender) {
    // Generate HTML
    const htmlPath = join(tmpDir, 'slides.html');
    log('[2/5] Generating Reveal.js HTML...');
    const html = slidesToHtml(eduData, narrationData, tradingTheme);
    writeFileSync(htmlPath, html);
    log(`  HTML: ${htmlPath}\n`);

    await captureScreenshots(htmlPath, slides.length, tmpDir, true);
  } else {
    log('[2/5] Skipping screenshots (--skip-render)...\n');
  }

  // Step 3: Segments
  const segmentFiles = composeSegments(slides.length, audioDurations, tmpDir);

  // Step 4: Concat
  concatenateSegments(segmentFiles, tmpDir, resolvedOutput);

  // Step 5: Chapters
  const chaptersPath = generateChapters(slides, audioDurations, outputDir);

  // Keep tmp files for thumbnails — caller handles cleanup
  log('Keeping tmp files for thumbnails...');

  const totalDuration = audioDurations.reduce((a, b) => a + b + 1.5, 0);

  log(`\n${'═'.repeat(60)}`);
  log(`  Done! Duration: ${(totalDuration / 60).toFixed(1)} min`);
  log(`  Video: ${resolvedOutput}`);
  log(`  Chapters: ${chaptersPath}`);
  log(`${'═'.repeat(60)}\n`);

  return {
    outputPath: resolvedOutput,
    chaptersPath,
    duration: totalDuration,
    slides: slides.length,
    audioDurations,
    tmpDir,
  };
}
