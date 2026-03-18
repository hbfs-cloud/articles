#!/usr/bin/env node
/**
 * generate-tts.mjs — Generate narration audio for scanner video via XTTS on ser
 *
 * Creates rich narration scripts for each ticker covering:
 * - Investment thesis
 * - Technical chart interpretation
 * - Social sentiment & capital composition
 * - Key risks and dangers
 *
 * Sends to tts-queue-server.py on ser via SSH
 */
import fs from 'fs-extra';
import { execSync } from 'child_process';
import path from 'path';

const SSH_KEY = '~/.ssh/id_ed25519_ci';
const SSH_HOST = 'ci@ser.tail5d09f.ts.net';
const REMOTE_QUEUE = '/tmp/tts-queue';
const LOCAL_AUDIO = 'public/audio';

const data = await fs.readJson('public/data.json');

// Generate narration scripts — English, professional financial analyst voice
function generateNarration(setup, index) {
  const { ticker, name, price, change, score, description, thesis, levels, ownership, sentiment, risk } = setup;
  const sent = sentiment || { pos: 60, neu: 25, neg: 15, st: 60, rd: 50 };
  const own = ownership || { insiders: 10, institutions: 65, retail: 25 };
  const riskData = risk || { risk: 'Standard market risk.', category: 'Market Risk' };

  // Slide 1 narration: Thesis & Score (10s)
  const slide1 = `Setup number ${index + 1}: ${ticker}, ${name}. Trading at ${price}, ${change} on the day. Our proprietary score is ${score} out of 100. ${thesis}`;

  // Slide 2 narration: Technical chart (10s)
  const slide2 = `Looking at the technical chart for ${ticker}. Entry zone between ${levels.entry}. Stop loss at ${levels.stop}. First target at ${levels.target1}, second target at ${levels.target2}. Risk-reward ratio of ${levels['r/r']}. Time horizon: ${levels.horizon || '7 to 21 days'}.`;

  // Slide 3 narration: Capital, Social & Risk (10s)
  const slide3 = `Capital composition: ${own.institutions}% institutional, ${own.insiders}% insider, ${own.retail}% retail. Social sentiment is ${sent.st > 60 ? 'bullish' : sent.st > 40 ? 'neutral' : 'bearish'} with StockTwits at ${sent.st}%. Key risk: ${riskData.category}. ${riskData.risk}`;

  // Full narration (30s total)
  return `${slide1} ${slide2} ${slide3}`;
}

// Build TTS job JSON
const segments = data.setups.map((setup, i) => ({
  text: generateNarration(setup, i),
  path: `/tmp/scanner-tts/${setup.ticker}.wav`,
  speaker: "Craig Gutsy", // Male professional voice
  language: "en"
}));

// Write job file locally
const jobFile = '/tmp/scanner-video-tts.json';
await fs.writeJson(jobFile, segments, { spaces: 2 });
console.log(`📝 Generated ${segments.length} narration scripts`);

// Preview narrations
for (const seg of segments) {
  const ticker = path.basename(seg.path, '.wav');
  console.log(`\n--- ${ticker} (${seg.text.length} chars) ---`);
  console.log(seg.text.substring(0, 150) + '...');
}

// Upload to ser queue
console.log('\n🚀 Uploading to TTS queue on ser...');
try {
  // Create output dir on ser
  execSync(`ssh -i ${SSH_KEY} ${SSH_HOST} "mkdir -p /tmp/scanner-tts"`, { stdio: 'inherit' });

  // Copy job file to queue
  execSync(`scp -i ${SSH_KEY} ${jobFile} ${SSH_HOST}:${REMOTE_QUEUE}/scanner-video.json`, { stdio: 'inherit' });

  console.log('✅ Job queued! Waiting for TTS generation...');

  // Poll for completion
  const maxWait = 600; // 10 minutes max
  let elapsed = 0;
  while (elapsed < maxWait) {
    await new Promise(r => setTimeout(r, 10000)); // Check every 10s
    elapsed += 10;

    try {
      const result = execSync(
        `ssh -i ${SSH_KEY} ${SSH_HOST} "cat ${REMOTE_QUEUE}/done/scanner-video-results.json 2>/dev/null"`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      );

      const results = JSON.parse(result);
      console.log(`\n✅ TTS generation complete! ${results.length} files generated.`);

      // Download generated audio files
      await fs.ensureDir(LOCAL_AUDIO);
      for (const r of results) {
        if (r.duration > 0) {
          const ticker = path.basename(r.path, '.wav');
          console.log(`  📥 Downloading ${ticker}.wav (${r.duration}s, gen: ${r.genTime}s)`);
          execSync(
            `scp -i ${SSH_KEY} ${SSH_HOST}:${r.path} ${LOCAL_AUDIO}/${ticker}.wav`,
            { stdio: 'inherit' }
          );
        }
      }

      console.log('\n🎬 All audio files ready! Run `npm run build` to render the video.');
      process.exit(0);
    } catch {
      process.stdout.write(`  ⏳ ${elapsed}s elapsed...\r`);
    }
  }

  console.log('\n⚠️ Timeout waiting for TTS. Check ser manually.');
} catch (err) {
  console.error('❌ Failed to upload to ser:', err.message);
  process.exit(1);
}
