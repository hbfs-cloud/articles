#!/usr/bin/env node
'use strict';

/**
 * telegram-notify.js
 * Envoie une notification Telegram après chaque scan publié.
 * 
 * Usage:
 *   node tools/telegram-notify.js [YYYYMMDD]
 *   
 *   Si YYYYMMDD est omis, prend la date du dernier scan publié.
 * 
 * Env vars requises (dans .env) :
 *   TELEGRAM_BOT_TOKEN=...
 *   TELEGRAM_CHAT_ID=...
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Load .env
const ROOT = path.join(__dirname, '..');
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.error('ERROR: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set in .env');
  process.exit(1);
}

const SCANNER_DIR = path.join(ROOT, 'scanner');
const BASE_URL = 'https://articles.dailytickers.com/scanner';

const MONTHS_FR = {
  '01': 'Janvier', '02': 'Février', '03': 'Mars', '04': 'Avril',
  '05': 'Mai', '06': 'Juin', '07': 'Juillet', '08': 'Août',
  '09': 'Septembre', '10': 'Octobre', '11': 'Novembre', '12': 'Décembre',
};

function formatDateFR(yyyymmdd) {
  const m = yyyymmdd.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return yyyymmdd;
  const [, year, month, day] = m;
  return `${parseInt(day)} ${MONTHS_FR[month]} ${year}`;
}

function getLatestScanDir() {
  const dirs = fs.readdirSync(SCANNER_DIR)
    .filter(d => /^\d{8}/.test(d) && fs.existsSync(path.join(SCANNER_DIR, d, 'index.html')))
    .sort()
    .reverse();
  return dirs[0] || null;
}

function extractScanSummary(dir) {
  const htmlPath = path.join(SCANNER_DIR, dir, 'index.html');
  if (!fs.existsSync(htmlPath)) return null;
  
  const html = fs.readFileSync(htmlPath, 'utf8');
  
  // Extract top tickers from h2 title (pattern: "Top 10 A+ REGIME — T1, T2, T3...")
  let tickers = [];
  const h2Match = html.match(/<h2[^>]*>[\s\S]*?—\s*([A-Z][A-Z0-9,\s]+?)<\/h2>/i);
  if (h2Match) {
    tickers = h2Match[1].split(',').map(t => t.trim()).filter(t => /^[A-Z]{1,5}$/.test(t)).slice(0, 5);
  }
  if (!tickers.length) {
    // Fallback: og:title
    const ogTitle = html.match(/og:title.*?content="([^"]+)"/i);
    if (ogTitle) {
      const afterDash = ogTitle[1].match(/[—-]\s*(.+)/);
      if (afterDash) tickers = afterDash[1].split(',').map(t=>t.trim()).filter(t=>/^[A-Z]{1,5}$/.test(t)).slice(0,5);
    }
  }
  
  // Extract regime
  let regime = '';
  if (/early risk-off/i.test(html)) regime = '⚠️ Early Risk-Off';
  else if (/risk-off/i.test(html)) regime = '🔴 Risk-Off';
  else if (/risk-on/i.test(html)) regime = '🟢 Risk-On';
  else if (/neutral/i.test(html)) regime = '🟡 Neutral';
  else if (/recovery/i.test(html)) regime = '🔄 Recovery';
  
  // Count setups
  const setupCount = (html.match(/class="setup-card"/gi) || []).length;
  
  return { tickers, regime, setupCount };
}

function sendTelegramMessage(text, topicId) {
  return new Promise((resolve, reject) => {
    const body = { chat_id: CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: false };
    if (topicId) body.message_thread_id = parseInt(topicId, 10);
    const payload = JSON.stringify(body);
    
    const opts = {
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (j.ok) {
            resolve(j.result);
          } else {
            reject(new Error(`Telegram API error: ${j.description}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  // Get scan dir from args or use latest
  const argDir = process.argv[2];
  let scanDir = argDir;
  
  if (!scanDir) {
    scanDir = getLatestScanDir();
    if (!scanDir) {
      console.error('ERROR: No scanner directory found');
      process.exit(1);
    }
  }
  
  console.log(`Processing scan: ${scanDir}`);
  
  const dateFR = formatDateFR(scanDir);
  const pageUrl = `${BASE_URL}/${scanDir}/`;
  const summary = extractScanSummary(scanDir);
  
  // Build message
  let topTickers = '';
  if (summary && summary.tickers.length > 0) {
    topTickers = `\n📈 <b>Top tickers :</b> ${summary.tickers.join(', ')}`;
  }
  
  let regimeLine = '';
  if (summary && summary.regime) {
    regimeLine = `\n🌡️ <b>Régime :</b> ${summary.regime}`;
  }
  
  let setupLine = '';
  if (summary && summary.setupCount > 0) {
    setupLine = `\n🎯 <b>Setups A+ :</b> ${summary.setupCount}`;
  }
  
  const message = `📊 <b>Scanner DailyTickers — ${dateFR}</b>${regimeLine}${setupLine}${topTickers}

🔗 ${pageUrl}

<i>Top setups algorithmiques du jour — DailyTickers</i>`;
  
  console.log('Sending Telegram message...');
  console.log(message);
  
  try {
    // Route to correct topic based on content type
    const scanTopicId = process.env.TELEGRAM_TOPIC_PORTFOLIO;
    const result = await sendTelegramMessage(message, scanTopicId);
    console.log(`✅ Message sent (id: ${result.message_id})`);
  } catch (e) {
    console.error(`❌ Failed: ${e.message}`);
    process.exit(1);
  }
}

main();
