import fs from 'fs-extra';
import path from 'path';
import OpenAI from 'openai'; // Import OpenAI
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const AUDIO_DIR = path.join(PUBLIC, 'audio');
const DATA_FILE = path.join(PUBLIC, 'data.json');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); // Initialize OpenAI

// Use a shared cache directory for OpenAI TTS
const TTS_CACHE_DIR = path.join(ROOT, '.openai-tts-cache');

// Voice Instruction for OpenAI TTS (Young, Dynamic, Punchy Narrator in English)
// Using 'alloy' voice for a dynamic male voice
const VOICE_MODEL = "tts-1";
const VOICE_NAME = "alloy";
const VOICE_LANG = "en"; // For cache hashing clarity

async function generateOpenAIAudio(text, outputPath) {
  const mp3 = await openai.audio.speech.create({
    model: VOICE_MODEL,
    voice: VOICE_NAME,
    input: text,
  });
  const buffer = Buffer.from(await mp3.arrayBuffer());
  await fs.writeFile(outputPath, buffer);
}

async function main() {
  const data = await fs.readJson(DATA_FILE);
  const setups = data.setups;

  await fs.ensureDir(AUDIO_DIR);
  await fs.ensureDir(TTS_CACHE_DIR);

  const segments = setups.map((s, i) => {
    const changeIndicator = s.change.startsWith('+') ? 'up' : 'down';
    const badgeNarrations = s.badges.length > 0 ? `It's categorized as ${s.badges.join(', ')}. ` : '';
    
    const text = `Next up: ${s.ticker}, also known as ${s.name}. It's currently priced at ${s.price}, showing a ${s.change} change today. Our advanced scanner gives it a proprietary score of ${s.score} out of 100. ${badgeNarrations}
    On your screen, you can see its price action with moving averages, highlighting key support and resistance levels. The radar chart details its profile across technicals, volume, momentum, risk, and conviction.
    Our investment thesis for ${s.ticker} is: ${s.description} 
    For trading, our key levels are: an entry zone between ${s.levels.entry}, a protective stop loss at ${s.levels.stop}, with profit targets at ${s.levels.target1} and a secondary target at ${s.levels.target2}. This offers a compelling risk-reward ratio of ${s.levels.rr || s.levels['r/r']}.`;
    
    const outputPath = path.join(AUDIO_DIR, `${s.ticker}.mp3`); // OpenAI returns MP3
    
    return {
      id: s.ticker,
      text,
      path: outputPath,
    };
  });

  // Handle caching for OpenAI TTS
  const missing = [];
  for (const seg of segments) {
    const h = createHash("sha256");
    h.update(JSON.stringify({ text: seg.text, model: VOICE_MODEL, voice: VOICE_NAME, lang_code: VOICE_LANG }));
    const cacheKey = h.digest("hex").slice(0, 16);
    const cachedFilePath = path.join(TTS_CACHE_DIR, `${cacheKey}.mp3`);
    
    if (fs.existsSync(cachedFilePath)) {
      console.log(`  → Cache hit for ${seg.id}`);
      await fs.copy(cachedFilePath, seg.path);
    } else if (fs.existsSync(seg.path)) {
      console.log(`  → Already exists in public/audio for ${seg.id}. Skipping to avoid re-generation.`);
    } else {
      missing.push(seg);
    }
  }

  if (missing.length > 0) {
    console.log(`Generating ${missing.length} new audio segments via OpenAI TTS...`);
    for (const seg of missing) {
        console.log(`  → Generating audio for ${seg.id}...`);
        await generateOpenAIAudio(seg.text, seg.path);

        // Cache the new one
        const h = createHash("sha256");
        h.update(JSON.stringify({ text: seg.text, model: VOICE_MODEL, voice: VOICE_NAME, lang_code: VOICE_LANG }));
        const cacheKey = h.digest("hex").slice(0, 16);
        await fs.copy(seg.path, path.join(TTS_CACHE_DIR, `${cacheKey}.mp3`));
    }
  } else {
    console.log("All audio segments already exist or are cached. No new generation needed.");
  }

  console.log("Audio generation process completed.");
}

main().catch(console.error);
