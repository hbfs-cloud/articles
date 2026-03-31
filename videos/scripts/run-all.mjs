#!/usr/bin/env node
/**
 * run-all.mjs — Master orchestration script
 *
 * Chains ALL video productions automatically:
 *   Phase 1: 7 trading education videos
 *   Phase 2: Kids/youth educational videos (CE2 → PCSI)
 *
 * Each video: generate content → TTS → render → upload → cleanup
 * Sequential processing to avoid disk/memory saturation.
 *
 * Usage: node scripts/run-all.mjs [--start-from <series-id>] [--skip-upload] [--phase 1|2|all]
 */
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const flags = process.argv.slice(2);
const startFrom = flags.includes('--start-from') ? flags[flags.indexOf('--start-from') + 1] : null;
const skipUpload = flags.includes('--skip-upload');
const phase = flags.includes('--phase') ? flags[flags.indexOf('--phase') + 1] : 'all';

// ── Phase 1: Trading education videos ─────────────────────────────────
const TRADING_SERIES = [
  'debuter-trading',
  'ai-singularity-fr',
  'ai-singularity-en',
  'swing-trading',
  'maitrise-expert',
  'algo-million',
  'bourses-mena',
];

// ── Phase 1.5: Article-based videos (existing articles → video) ──────
const ARTICLE_SERIES = [
  {id: 'claude-code-avance', path: '/Users/marketwatchxyz/GolandProjects/articles/tech/claude-code-avance/index.html'},
  {id: 'signal-vs-noise',    path: '/Users/marketwatchxyz/GolandProjects/articles/tech/signal-vs-noise/index.html'},
  {id: 'orbs-analysis',      path: '/Users/marketwatchxyz/GolandProjects/articles/analyses/ORBS/index.html'},
  {id: 'daily-20260319',     path: '/Users/marketwatchxyz/GolandProjects/articles/daily/20260319/index.html'},
];

// ── Phase 2: Kids/youth educational videos ────────────────────────────
const KIDS_SERIES = [
  // CE2 (8-9 ans)
  'ce2-maths',
  'ce2-francais',
  'ce2-sciences',
  // CM1 (9-10 ans)
  'cm1-maths',
  'cm1-histoire',
  'cm1-sciences',
  // 5ème (12-13 ans)
  'cinquieme-maths',
  'cinquieme-physique',
  'cinquieme-histoire',
  // 4ème (13-14 ans)
  'quatrieme-maths',
  'quatrieme-physique',
  'quatrieme-svt',
  // Terminale (17-18 ans)
  'terminale-maths-analyse',
  'terminale-maths-proba',
  'terminale-physique',
  'terminale-philo',
  // PCSI (18-19 ans)
  'pcsi-analyse',
  'pcsi-algebre',
  'pcsi-mecanique',
  'pcsi-thermo',
];

async function processVideo(seriesId, contentGenerator) {
  const ts = new Date().toISOString().slice(0, 19);
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  🎬 [${ts}] Processing: ${seriesId}`);
  console.log(`${'═'.repeat(70)}\n`);

  try {
    // Step 1: Generate content
    console.log('📚 Step 1: Generating content...');
    execSync(`node scripts/${contentGenerator} ${seriesId}`, {
      cwd: ROOT, stdio: 'inherit', timeout: 120000,
    });

    // Step 2: TTS (Qwen3 local)
    console.log('\n🎙️  Step 2: Generating TTS audio (Qwen3 local)...');
    execSync('node scripts/generate-edu-tts.mjs --batch-size 5', {
      cwd: ROOT, stdio: 'inherit', timeout: 86400000, // 24h max
    });

    // Step 3: Render video (Remotion)
    const outputDir = join(ROOT, 'output');
    await fs.ensureDir(outputDir);
    const videoPath = join(outputDir, `${seriesId}.mp4`);

    console.log('\n🎬 Step 3: Rendering video (Remotion)...');
    execSync(
      `npx remotion render EducationalVideo "${videoPath}" --concurrency=8`,
      { cwd: ROOT, stdio: 'inherit', timeout: 86400000 }
    );
    const stats = await fs.stat(videoPath);
    console.log(`   ✅ Video: ${(stats.size / 1024 / 1024).toFixed(0)} MB`);

    // Step 4: Thumbnail
    const thumbPath = join(outputDir, `${seriesId}-thumb.png`);
    console.log('\n🖼️  Step 4: Generating thumbnail...');
    try {
      execSync(
        `npx remotion still EducationalVideo "${thumbPath}" --frame=0`,
        { cwd: ROOT, stdio: 'inherit', timeout: 60000 }
      );
    } catch { console.log('   ⚠️  Thumbnail failed, continuing'); }

    // Step 5: Upload to YouTube
    if (!skipUpload) {
      console.log('\n📤 Step 5: Uploading to YouTube...');
      execSync(`node scripts/pipeline.mjs ${seriesId} --skip-tts --skip-render`, {
        cwd: ROOT, stdio: 'inherit', timeout: 3600000,
      });
    } else {
      console.log('\n⏭️  Step 5: Skipping upload');
    }

    // Step 6: Cleanup
    console.log('\n🧹 Step 6: Cleaning up...');
    if (await fs.pathExists(videoPath)) await fs.remove(videoPath);
    if (await fs.pathExists(thumbPath)) await fs.remove(thumbPath);
    const audioDir = join(ROOT, 'public/audio');
    const prefix = seriesId.replace(/-/g, '_');
    try {
      const audioFiles = (await fs.readdir(audioDir)).filter(f => f.startsWith(prefix + '_'));
      for (const f of audioFiles) await fs.remove(join(audioDir, f));
      console.log(`   🗑️  Removed ${audioFiles.length} audio files + video + thumb`);
    } catch {}

    console.log(`\n✅ ${seriesId} DONE`);
    return true;
  } catch (err) {
    console.error(`\n❌ ${seriesId} FAILED: ${err.message?.slice(0, 200)}`);
    return false;
  }
}

async function processArticleVideo(seriesId, articlePath) {
  const ts = new Date().toISOString().slice(0, 19);
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  🎬 [${ts}] Processing article: ${seriesId}`);
  console.log(`  📄 Source: ${articlePath}`);
  console.log(`${'═'.repeat(70)}\n`);

  try {
    // Step 1: Generate content from article HTML
    console.log('📚 Step 1: Generating content from article...');
    execSync(`node scripts/generate-article-video.mjs ${seriesId} "${articlePath}"`, {
      cwd: ROOT, stdio: 'inherit', timeout: 120000,
    });

    // Step 2: TTS (Qwen3 local)
    console.log('\n🎙️  Step 2: Generating TTS audio (Qwen3 local)...');
    execSync('node scripts/generate-edu-tts.mjs --batch-size 5', {
      cwd: ROOT, stdio: 'inherit', timeout: 86400000,
    });

    // Step 3: Render video (Remotion)
    const outputDir = join(ROOT, 'output');
    await fs.ensureDir(outputDir);
    const videoPath = join(outputDir, `${seriesId}.mp4`);

    console.log('\n🎬 Step 3: Rendering video (Remotion)...');
    execSync(
      `npx remotion render EducationalVideo "${videoPath}" --concurrency=8`,
      { cwd: ROOT, stdio: 'inherit', timeout: 86400000 }
    );
    const stats = await fs.stat(videoPath);
    console.log(`   ✅ Video: ${(stats.size / 1024 / 1024).toFixed(0)} MB`);

    // Step 4: Thumbnail
    const thumbPath = join(outputDir, `${seriesId}-thumb.png`);
    console.log('\n🖼️  Step 4: Generating thumbnail...');
    try {
      execSync(
        `npx remotion still EducationalVideo "${thumbPath}" --frame=0`,
        { cwd: ROOT, stdio: 'inherit', timeout: 60000 }
      );
    } catch { console.log('   ⚠️  Thumbnail failed, continuing'); }

    // Step 5: Upload to YouTube
    if (!skipUpload) {
      console.log('\n📤 Step 5: Uploading to YouTube...');
      execSync(`node scripts/pipeline.mjs ${seriesId} --skip-tts --skip-render`, {
        cwd: ROOT, stdio: 'inherit', timeout: 3600000,
      });
    } else {
      console.log('\n⏭️  Step 5: Skipping upload');
    }

    // Step 6: Cleanup
    console.log('\n🧹 Step 6: Cleaning up...');
    if (await fs.pathExists(videoPath)) await fs.remove(videoPath);
    if (await fs.pathExists(thumbPath)) await fs.remove(thumbPath);
    const audioDir = join(ROOT, 'public/audio');
    const prefix = seriesId.replace(/-/g, '_');
    try {
      const audioFiles = (await fs.readdir(audioDir)).filter(f => f.startsWith(prefix + '_'));
      for (const f of audioFiles) await fs.remove(join(audioDir, f));
      console.log(`   🗑️  Removed ${audioFiles.length} audio files + video + thumb`);
    } catch {}

    console.log(`\n✅ ${seriesId} DONE`);
    return true;
  } catch (err) {
    console.error(`\n❌ ${seriesId} FAILED: ${err.message?.slice(0, 200)}`);
    return false;
  }
}

async function main() {
  const results = {};

  // Determine which series to process
  let tradingSeries = phase === '2' || phase === '1.5' || phase === '3' ? [] : [...TRADING_SERIES];
  let articleSeries = phase === '1' || phase === '2' || phase === '3' ? [] : [...ARTICLE_SERIES];
  let kidsSeries = phase === '1' || phase === '1.5' ? [] : [...KIDS_SERIES];

  // Allow specific phases
  if (phase === '1.5') articleSeries = [...ARTICLE_SERIES];
  if (phase === '3') kidsSeries = [...KIDS_SERIES];

  // Handle --start-from
  if (startFrom) {
    const tradingIdx = tradingSeries.indexOf(startFrom);
    const articleIdx = articleSeries.findIndex(a => a.id === startFrom);
    const kidsIdx = kidsSeries.indexOf(startFrom);
    if (tradingIdx >= 0) {
      tradingSeries = tradingSeries.slice(tradingIdx);
    } else if (articleIdx >= 0) {
      tradingSeries = [];
      articleSeries = articleSeries.slice(articleIdx);
    } else if (kidsIdx >= 0) {
      tradingSeries = [];
      articleSeries = [];
      kidsSeries = kidsSeries.slice(kidsIdx);
    }
  }

  const totalCount = tradingSeries.length + articleSeries.length + kidsSeries.length;
  let processed = 0;

  console.log(`\n${'█'.repeat(70)}`);
  console.log(`  🚀 MASTER PIPELINE — ${totalCount} videos to process`);
  console.log(`  Phase 1: ${tradingSeries.length} trading videos`);
  console.log(`  Phase 1.5: ${articleSeries.length} article-based videos`);
  console.log(`  Phase 2: ${kidsSeries.length} educational videos`);
  console.log(`${'█'.repeat(70)}\n`);

  // ── Phase 1: Trading videos ──
  if (tradingSeries.length > 0) {
    console.log('\n' + '▓'.repeat(70));
    console.log('  PHASE 1: TRADING EDUCATION');
    console.log('▓'.repeat(70));

    for (const id of tradingSeries) {
      processed++;
      console.log(`\n  [${processed}/${totalCount}]`);
      const ok = await processVideo(id, 'generate-edu-content.mjs');
      results[id] = ok;
    }
  }

  // ── Phase 1.5: Article-based videos ──
  if (articleSeries.length > 0) {
    console.log('\n' + '▓'.repeat(70));
    console.log('  PHASE 1.5: ARTICLE-BASED VIDEOS');
    console.log('▓'.repeat(70));

    for (const {id, path} of articleSeries) {
      processed++;
      console.log(`\n  [${processed}/${totalCount}]`);
      const ok = await processArticleVideo(id, path);
      results[id] = ok;
    }
  }

  // ── Phase 2: Kids/youth videos ──
  if (kidsSeries.length > 0) {
    console.log('\n' + '▓'.repeat(70));
    console.log('  PHASE 2: KIDS/YOUTH EDUCATION');
    console.log('▓'.repeat(70));

    for (const id of kidsSeries) {
      processed++;
      console.log(`\n  [${processed}/${totalCount}]`);
      const ok = await processVideo(id, 'generate-kids-content.mjs');
      results[id] = ok;
    }
  }

  // ── Summary ──
  console.log(`\n\n${'█'.repeat(70)}`);
  console.log('  📊 FINAL RESULTS');
  console.log('█'.repeat(70));
  const succeeded = Object.values(results).filter(Boolean).length;
  const failed = Object.values(results).filter(v => !v).length;
  console.log(`  ✅ Succeeded: ${succeeded}`);
  console.log(`  ❌ Failed: ${failed}`);
  for (const [id, ok] of Object.entries(results)) {
    console.log(`    ${ok ? '✅' : '❌'} ${id}`);
  }
  console.log('█'.repeat(70) + '\n');
}

main().catch(err => { console.error(err); process.exit(1); });
