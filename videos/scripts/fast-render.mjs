#!/usr/bin/env node
/**
 * fast-render.mjs — Fast video render using Remotion stills + FFmpeg
 *
 * Instead of rendering 261K frames at 30fps, this:
 * 1. Renders each slide as a single PNG (208 images instead of 261K frames)
 * 2. Uses FFmpeg to combine each PNG + WAV into a video segment
 * 3. Concatenates all segments into the final video
 *
 * ~200x faster than full Remotion render for mostly-static educational content.
 */
import fs from 'fs-extra';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT = join(ROOT, 'output');
const STILLS_DIR = join(OUTPUT, 'stills');
const SEGMENTS_DIR = join(OUTPUT, 'segments');

const seriesId = process.argv[2] || 'debuter-trading';
const outputFile = join(OUTPUT, `${seriesId}.mp4`);
const CONCURRENCY = parseInt(process.argv[3] || '4'); // parallel still renders

async function main() {
  const eduData = await fs.readJson(join(ROOT, 'public/edu-data.json'));
  const { slides, audioDurations, config } = eduData;
  const fps = 15; // Must match Remotion composition fps

  console.log(`\n🎬 Fast Render: ${config.seriesTitle}`);
  console.log(`   ${slides.length} slides, ${Object.keys(audioDurations).length} audio segments`);

  await fs.ensureDir(STILLS_DIR);
  await fs.ensureDir(SEGMENTS_DIR);

  // Calculate frame offsets for each slide
  const slideFrames = [];
  let currentFrame = 6 * fps; // intro = 6s

  // Add intro frame
  slideFrames.push({ index: -1, frame: 0, duration: 6 });

  for (let i = 0; i < slides.length; i++) {
    const key = slides[i].audioFile?.replace('.wav', '') || `edu_s${i}`;
    const audioDur = audioDurations[key] || 12;
    const totalDur = audioDur + 1.5;

    slideFrames.push({
      index: i,
      frame: currentFrame + Math.floor(fps * 2), // capture 2s into the slide (after animations finish)
      duration: totalDur,
      audioKey: key,
    });

    currentFrame += Math.ceil(totalDur * fps);
  }

  const totalDuration = slideFrames.reduce((a, s) => a + s.duration, 0);
  console.log(`   Total duration: ${Math.round(totalDuration / 60)} min`);
  console.log(`   Rendering ${slideFrames.length} stills...\n`);

  // ── Step 1: Render stills in parallel batches ────────────────────
  const existingStills = new Set();
  try {
    const files = await fs.readdir(STILLS_DIR);
    files.forEach(f => { if (f.endsWith('.png')) existingStills.add(f.replace('.png', '')); });
  } catch {}

  const stillsToRender = slideFrames.filter(s => !existingStills.has(`slide_${s.index}`));
  console.log(`   Already rendered: ${existingStills.size}, remaining: ${stillsToRender.length}`);

  for (let batch = 0; batch < stillsToRender.length; batch += CONCURRENCY) {
    const chunk = stillsToRender.slice(batch, batch + CONCURRENCY);
    const promises = chunk.map(s => {
      const outPath = join(STILLS_DIR, `slide_${s.index}.png`);
      const cmd = `npx remotion still EducationalVideo "${outPath}" --frame=${s.frame} --log=error 2>&1`;
      return new Promise((resolve) => {
        try {
          execSync(cmd, { cwd: ROOT, stdio: 'pipe', timeout: 120000 });
          process.stdout.write(`   ✅ slide_${s.index} (frame ${s.frame})\n`);
          resolve(true);
        } catch (err) {
          console.log(`   ⚠️  slide_${s.index} failed, retrying...`);
          try {
            execSync(cmd, { cwd: ROOT, stdio: 'pipe', timeout: 120000 });
            resolve(true);
          } catch {
            console.log(`   ❌ slide_${s.index} FAILED`);
            resolve(false);
          }
        }
      });
    });
    // Run sequentially within batch since Remotion still uses shared browser
    for (const p of promises) await p;
  }

  // ── Step 2: Create video segments with FFmpeg ────────────────────
  console.log('\n📹 Creating video segments...');
  const concatList = [];

  for (const s of slideFrames) {
    const stillPath = join(STILLS_DIR, `slide_${s.index}.png`);
    const segPath = join(SEGMENTS_DIR, `seg_${String(s.index + 1).padStart(4, '0')}.mp4`);

    if (!await fs.pathExists(stillPath)) {
      console.log(`   ⚠️  Missing still for slide ${s.index}, skipping`);
      continue;
    }

    // Check if segment already exists
    if (await fs.pathExists(segPath)) {
      concatList.push(segPath);
      continue;
    }

    // Try original WAV first, fallback to extracted AAC from previous segments
    let audioPath = s.audioKey ? join(ROOT, 'public/audio', `${s.audioKey}.wav`) : null;
    let audioIsAac = false;
    if (audioPath && !await fs.pathExists(audioPath)) {
      const aacPath = join(OUTPUT, 'audio-extracted', `seg_${String(s.index + 1).padStart(4, '0')}.aac`);
      if (await fs.pathExists(aacPath)) {
        audioPath = aacPath;
        audioIsAac = true;
      } else {
        audioPath = null;
      }
    }
    const hasAudio = audioPath && await fs.pathExists(audioPath);

    let cmd;
    if (hasAudio) {
      // Image + audio → video segment (duration = audio + 1.5s padding)
      const audioCodec = audioIsAac ? '-c:a copy' : '-c:a aac -b:a 192k';
      cmd = `ffmpeg -y -loop 1 -i "${stillPath}" -i "${audioPath}" -c:v libx264 -tune stillimage ${audioCodec} -pix_fmt yuv420p -shortest -t ${s.duration.toFixed(2)} -r 30 "${segPath}" 2>/dev/null`;
    } else {
      // Image only (intro slide or missing audio) — add silent audio track for concat compatibility
      cmd = `ffmpeg -y -loop 1 -i "${stillPath}" -f lavfi -i anullsrc=r=44100:cl=stereo -c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p -t ${s.duration.toFixed(2)} -r 30 -shortest "${segPath}" 2>/dev/null`;
    }

    try {
      execSync(cmd, { stdio: 'pipe', timeout: 60000 });
      concatList.push(segPath);
      if ((concatList.length % 20) === 0) {
        process.stdout.write(`   📹 ${concatList.length}/${slideFrames.length} segments\n`);
      }
    } catch (err) {
      console.log(`   ⚠️  Segment ${s.index} failed: ${err.message?.slice(0, 50)}`);
    }
  }

  console.log(`   ✅ ${concatList.length} segments created`);

  // ── Step 3: Concatenate all segments ──────────────────────────────
  console.log('\n🔗 Concatenating segments...');
  const listFile = join(OUTPUT, 'concat-list.txt');
  const listContent = concatList.map(p => `file '${p}'`).join('\n');
  await fs.writeFile(listFile, listContent);

  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${outputFile}" 2>/dev/null`,
    { stdio: 'pipe', timeout: 300000 }
  );

  const stats = await fs.stat(outputFile);
  console.log(`\n✅ Video rendered: ${outputFile}`);
  console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(0)} MB`);

  // ── Step 4: Cleanup temp files (disabled — keep stills for resume) ────
  // console.log('\n🧹 Cleaning up temp files...');
  // await fs.remove(STILLS_DIR);
  // await fs.remove(SEGMENTS_DIR);
  // await fs.remove(listFile);
  // console.log('   ✅ Temp files removed');
  console.log('\n📁 Stills and segments kept for resume.');
}

main().catch(err => { console.error(err); process.exit(1); });
