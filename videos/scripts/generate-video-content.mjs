import fs from 'fs-extra';
import path from 'path';
import { JSDOM } from 'jsdom';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const scannerPath = process.argv[2] || '../scanner/20260317/index.html';
const outputDir = 'public/audio';

async function generateAudio(text, filename) {
  const mp3 = await openai.audio.speech.create({
    model: "tts-1",
    voice: "alloy",
    input: text,
  });
  const buffer = Buffer.from(await mp3.arrayBuffer());
  await fs.writeFile(path.join(outputDir, filename), buffer);
}

async function parseScanner() {
  const html = await fs.readFile(scannerPath, 'utf8');
  const dom = new JSDOM(html);
  const document = dom.window.document;

  const date = document.querySelector('.ticker-name')?.textContent || 'March 17, 2026';
  const regime = document.querySelector('.ticker-metric-value')?.textContent || 'Early Risk-Off';
  
  const setupCards = Array.from(document.querySelectorAll('.setup-card'));
  const setups = setupCards.map((card, index) => {
    const ticker = card.querySelector('.setup-ticker-logo')?.textContent;
    const name = card.querySelector('h3')?.textContent.split(' \u2014 ')[1];
    const price = card.querySelector('.price')?.textContent;
    const change = card.querySelector('.chg')?.textContent;
    const badges = Array.from(card.querySelectorAll('.badge')).map(b => b.textContent);
    const description = card.querySelector('.setup-description')?.textContent;
    const levels = Array.from(card.querySelectorAll('.level-item')).reduce((acc, el) => {
      const lbl = el.querySelector('.lbl').textContent.toLowerCase().replace(' ', '');
      const val = el.querySelector('.val').textContent;
      acc[lbl] = val;
      return acc;
    }, {});

    // Try to extract score from the script (hacky but effective)
    const scoreMatch = html.match(new RegExp(`makeGauge\\('gauge${ticker}',(\\d+(\\.\\d+)?)`));
    const score = scoreMatch ? parseFloat(scoreMatch[1]) : 90;

    // Try to extract scoreFactors from the script
    const radarMatch = html.match(new RegExp(`makeRadar\\('radar${ticker}',\\[([\\d, ]+)\\]`));
    const scoreFactors = radarMatch ? radarMatch[1].split(',').map(n => parseFloat(n.trim())) : [85, 80, 90, 75, 85, 95];

    return { ticker, name, price, change, score, badges, description, levels, scoreFactors };
  });

  const videoData = { date, regime, setups };
  await fs.writeJson('public/data.json', videoData, { spaces: 2 });

  // Generate Voiceover Script
  console.log("Generating audio files...");
  await fs.ensureDir(outputDir);

  for (let i = 0; i < setups.length; i++) {
    const s = setups[i];
    const text = `Setup ${i + 1}: ${s.ticker}, ${s.name}. Currently trading at ${s.price}, showing a ${s.change} change. Our proprietary score is ${s.score} out of 100. ${s.description} Key levels: Entry zone between ${s.levels.entry}, with a stop loss at ${s.stoploss} and targets at ${s.target1} and ${s.target2}. Risk-reward ratio is ${s.rr}.`;
    
    console.log(`Generating audio for ${s.ticker}...`);
    await generateAudio(text, `${s.ticker}.mp3`);
  }

  console.log("Done!");
}

parseScanner().catch(console.error);
