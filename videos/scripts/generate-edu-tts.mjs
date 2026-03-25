#!/usr/bin/env node
/**
 * generate-edu-tts.mjs — Generate TTS audio locally using Qwen 3 TTS (MLX)
 *
 * Usage: node scripts/generate-edu-tts.mjs [--batch-size 5] [--start 0] [--limit 10]
 *
 * Reads public/edu-narration.json, generates WAV files locally via Qwen3-TTS,
 * then computes audio durations and updates edu-data.json.
 *
 * Qwen3-TTS runs on this Mac via MLX — no server needed.
 */
import fs from 'fs-extra';
import { execSync } from 'child_process';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const LOCAL_AUDIO = path.join(ROOT, 'public/audio');

// Qwen3-TTS MLX config
const PYTHON = '/Users/marketwatchxyz/GolandProjects/claude-discord-bot/scanner-video/.venv-mlx/bin/python3';
const BATCH_SCRIPT = '/Users/marketwatchxyz/GolandProjects/claude-discord-bot/scanner-video/tts-mlx-batch.py';

// Qwen3 voice design instruct — professional French narrator
const INSTRUCT = "Speak in a clear, warm, and professional French tone. You are a confident and engaging financial educator presenting a premium online trading course. Use a natural, dynamic pace — slightly faster for lists, slower and more emphatic for key concepts. Pronounce English trading terms (stock picking, market maker, hedge fund, stop-loss, all-in) naturally with a light French accent. Be didactic but never boring — this is not a lecture, it's a conversation with the viewer.";

const BATCH_SIZE = parseInt(process.argv.find((_, i, a) => a[i-1] === '--batch-size') || '5');
const START = parseInt(process.argv.find((_, i, a) => a[i-1] === '--start') || '0');
const LIMIT = parseInt(process.argv.find((_, i, a) => a[i-1] === '--limit') || '999');

async function main() {
  const narration = await fs.readJson(path.join(ROOT, 'public/edu-narration.json'));
  const eduData = await fs.readJson(path.join(ROOT, 'public/edu-data.json'));

  console.log(`\n🎙️  Qwen3-TTS Pipeline — ${narration.length} segments`);
  console.log(`   Model: Qwen3-TTS-12Hz-1.7B-VoiceDesign-8bit (local MLX)`);
  console.log(`   Language: ${eduData.config.language}`);
  console.log(`   Batch size: ${BATCH_SIZE}`);

  await fs.ensureDir(LOCAL_AUDIO);

  // Check which files already exist (resume support)
  const existing = new Set();
  try {
    const files = await fs.readdir(LOCAL_AUDIO);
    files.forEach(f => { if (f.endsWith('.wav')) existing.add(f.replace('.wav', '')); });
  } catch {}

  let todo = narration.filter(s => !existing.has(s.key));

  // Apply --start and --limit
  if (START > 0) {
    todo = todo.filter(s => {
      const idx = parseInt(s.key.replace(/.*_s/, ''));
      return idx >= START;
    });
  }
  if (LIMIT < 999) {
    todo = todo.slice(0, LIMIT);
  }

  console.log(`   Already done: ${existing.size}, remaining: ${todo.length}`);

  if (todo.length === 0) {
    console.log('✅ All audio already generated. Computing durations...');
    await computeDurations(narration, eduData);
    return;
  }

  // Process in small batches (Qwen3 is memory-intensive)
  const batches = [];
  for (let i = 0; i < todo.length; i += BATCH_SIZE) {
    batches.push(todo.slice(i, i + BATCH_SIZE));
  }

  console.log(`\n📦 Processing ${batches.length} batches of ~${BATCH_SIZE}...\n`);

  let totalGenTime = 0;
  let totalAudioDur = 0;
  let successCount = 0;

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    console.log(`── Batch ${bi + 1}/${batches.length} (${batch.length} segments) ──`);

    // Build input JSON for tts-mlx-batch.py
    const lang = eduData.config.language || 'fr';
    const langCode = lang === 'en' ? 'english' : 'french';

    // Voice cloning: use Mohamed's reference voice if available
    const refVoicePath = path.join(LOCAL_AUDIO, `ref_voice_${lang === 'en' ? 'en' : 'fr'}.wav`);
    const refVoiceText = lang === 'en'
      ? "English texts for beginners to practice reading and comprehension online and for free. Practicing your comprehension of written English will both improve your vocabulary and understanding of grammar and word order. The texts below are designed to help you develop while giving you an instant evaluation of your progress. Prepared by experienced English teachers"
      : null;
    const useRefVoice = refVoiceText && fs.existsSync(refVoicePath);

    const segments = batch.map(s => {
      const seg = {
        text: s.text,
        path: path.join(LOCAL_AUDIO, `${s.key}.wav`),
        lang_code: langCode,
      };
      if (useRefVoice) {
        seg.model = "qwen3-tts";
        seg.ref_audio = refVoicePath;
        seg.ref_text = refVoiceText;
        seg.instruct = "A dynamic, punchy young male voice. Energetic and confident like a top financial YouTuber. Fast-paced delivery with emphasis on key numbers. Clear, sharp articulation. Engaging and exciting tone that keeps viewers hooked.";
      } else {
        seg.model = "qwen3-tts-cv";
        seg.voice = "eric";
      }
      return seg;
    });

    const inputFile = `/tmp/edu-tts-input-${bi}.json`;
    await fs.writeJson(inputFile, segments);

    try {
      // Run tts-mlx-batch.py — pipe JSON in, get JSON results out
      // Note: stdout may contain init messages before the JSON line, so we extract the last line
      const rawResult = execSync(
        `cat "${inputFile}" | ${PYTHON} "${BATCH_SCRIPT}"`,
        {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'inherit'], // stderr to console for progress
          timeout: 600000, // 10 min per batch
          env: {
            ...process.env,
            PHONEMIZER_ESPEAK_LIBRARY: '/opt/homebrew/lib/libespeak-ng.dylib',
          },
          cwd: ROOT,
        }
      );

      // Extract JSON from last line of stdout (Python may print init messages before)
      const lines = rawResult.trim().split('\n');
      const jsonLine = lines[lines.length - 1];
      const results = JSON.parse(jsonLine);

      for (const r of results) {
        if (r.duration > 0) {
          successCount++;
          totalAudioDur += r.duration;
          totalGenTime += r.genTime;
          const key = path.basename(r.path, '.wav');
          console.log(`   ✅ ${key}: ${r.duration.toFixed(1)}s audio (${r.genTime.toFixed(1)}s gen)`);
        } else {
          const key = path.basename(r.path, '.wav');
          console.log(`   ⚠️  ${key}: failed (0s audio)`);
        }
      }
    } catch (err) {
      console.error(`   ❌ Batch ${bi + 1} failed: ${err.message?.slice(0, 100)}`);
      // Try individual segments as fallback
      for (const seg of batch) {
        const singleSeg = {
          text: seg.text,
          path: path.join(LOCAL_AUDIO, `${seg.key}.wav`),
          voice: "eric",
          lang_code: langCode,
          model: "qwen3-tts-cv",
        };
        const singleInput = `/tmp/edu-tts-single.json`;
        await fs.writeJson(singleInput, [singleSeg]);
        try {
          const rawResult = execSync(
            `cat "${singleInput}" | ${PYTHON} "${BATCH_SCRIPT}"`,
            {
              encoding: 'utf8',
              stdio: ['pipe', 'pipe', 'inherit'],
              timeout: 180000,
              env: {
                ...process.env,
                PHONEMIZER_ESPEAK_LIBRARY: '/opt/homebrew/lib/libespeak-ng.dylib',
              },
              cwd: ROOT,
            }
          );
          const singleLines = rawResult.trim().split('\n');
          const [r] = JSON.parse(singleLines[singleLines.length - 1]);
          if (r.duration > 0) {
            successCount++;
            totalAudioDur += r.duration;
            const key = path.basename(r.path, '.wav');
            console.log(`   ✅ ${key}: ${r.duration.toFixed(1)}s (retry ok)`);
          }
        } catch {
          console.log(`   ❌ ${path.basename(seg.path, '.wav')}: failed even on retry`);
        }
      }
    }

    // Clean up temp file
    await fs.remove(inputFile);

    // Progress
    const pct = ((bi + 1) / batches.length * 100).toFixed(0);
    console.log(`   📊 Progress: ${pct}% — ${successCount} files, ${Math.round(totalAudioDur / 60)}min audio\n`);
  }

  console.log(`\n🏁 TTS Generation Complete:`);
  console.log(`   ${successCount}/${todo.length} segments generated`);
  console.log(`   Total audio: ${Math.round(totalAudioDur / 60)} min`);
  console.log(`   Total gen time: ${Math.round(totalGenTime / 60)} min`);
  if (totalAudioDur > 0) {
    console.log(`   RTF: ${(totalGenTime / totalAudioDur).toFixed(2)}x`);
  }

  // Compute durations
  await computeDurations(narration, eduData);
}

async function computeDurations(narration, eduData) {
  console.log('\n📏 Computing audio durations...');
  const durations = {};

  for (const seg of narration) {
    const wavPath = path.join(LOCAL_AUDIO, `${seg.key}.wav`);
    try {
      const dur = execSync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${wavPath}"`,
        { encoding: 'utf8' }
      ).trim();
      durations[seg.key] = parseFloat(dur);
    } catch {
      durations[seg.key] = 12;
    }
  }

  // Update edu-data.json with actual durations
  eduData.audioDurations = durations;
  await fs.writeJson(path.join(ROOT, 'public/edu-data.json'), eduData, { spaces: 2 });

  const totalSec = Object.values(durations).reduce((a, b) => a + b, 0);
  const realCount = Object.values(durations).filter(d => d !== 12).length;
  console.log(`\n✅ Audio durations computed:`);
  console.log(`   Total: ${Math.round(totalSec / 60)} min (${(totalSec / 3600).toFixed(1)}h)`);
  console.log(`   Real audio: ${realCount}/${narration.length} segments`);
  console.log(`   Default (12s): ${narration.length - realCount} segments`);
  console.log(`\n🎬 Next: run pipeline.mjs to render the video`);
}

main().catch(err => { console.error(err); process.exit(1); });
