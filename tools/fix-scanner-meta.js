#!/usr/bin/env node
'use strict';

/**
 * Fix scanner HTML files:
 * 1. Replace og:image with scanner-daily-card.png + add twitter meta
 * 2. Add Telegram/WhatsApp share buttons before </body>
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCANNER_DIR = path.join(ROOT, 'scanner');

// Get all scanner dirs from 20260215 to 20260320
const scanDirs = fs.readdirSync(SCANNER_DIR)
  .filter(d => /^\d{8}/.test(d))
  .sort();

const CARD_URL = 'https://articles.market-watch.xyz/scanner-daily-card.png';
const BASE_URL = 'https://articles.market-watch.xyz/scanner';

const MONTHS_FR = {
  '01': 'Janvier', '02': 'Février', '03': 'Mars', '04': 'Avril',
  '05': 'Mai', '06': 'Juin', '07': 'Juillet', '08': 'Août',
  '09': 'Septembre', '10': 'Octobre', '11': 'Novembre', '12': 'Décembre',
};

function formatDateFR(yyyymmdd) {
  // yyyymmdd can be like "20260215" or "20260310-2300"
  const m = yyyymmdd.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return yyyymmdd;
  const [, year, month, day] = m;
  return `${parseInt(day)} ${MONTHS_FR[month]} ${year}`;
}

let updated = 0;
let skipped = 0;

for (const dir of scanDirs) {
  const htmlPath = path.join(SCANNER_DIR, dir, 'index.html');
  if (!fs.existsSync(htmlPath)) {
    console.log(`  SKIP ${dir}: no index.html`);
    skipped++;
    continue;
  }

  let html = fs.readFileSync(htmlPath, 'utf8');
  let changed = false;

  // --- Task 2: Fix OG/Twitter meta ---
  // Replace any og:image line
  const ogImageRe = /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/gi;
  
  const newOgMeta = `<meta property="og:image" content="${CARD_URL}">
    <meta property="og:image:width" content="1080">
    <meta property="og:image:height" content="1200">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="${CARD_URL}">`;

  if (ogImageRe.test(html)) {
    // Remove existing twitter meta if present (avoid duplicates)
    html = html.replace(/<meta\s+name="twitter:card"[^>]*\/?>\s*/gi, '');
    html = html.replace(/<meta\s+name="twitter:image"[^>]*\/?>\s*/gi, '');
    html = html.replace(/<meta\s+property="og:image:width"[^>]*\/?>\s*/gi, '');
    html = html.replace(/<meta\s+property="og:image:height"[^>]*\/?>\s*/gi, '');
    // Now replace og:image
    html = html.replace(/<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/gi, newOgMeta);
    changed = true;
    console.log(`  ${dir}: OG meta updated`);
  } else {
    console.log(`  ${dir}: no og:image found, skipping OG update`);
  }

  // --- Task 3: Add share buttons before </body> ---
  const yyyymmdd = dir.replace('-2300', ''); // strip time suffix for date-only
  const dateFR = formatDateFR(dir);
  const pageUrl = `${BASE_URL}/${dir}/`;
  
  const shareButtons = `
<div class="share-buttons" style="position:fixed;bottom:80px;right:16px;display:flex;flex-direction:column;gap:8px;z-index:999">
  <a href="https://t.me/share/url?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(`Scanner Market Watch du ${dateFR} — Top setups A+`)}" target="_blank" style="background:#0088cc;color:white;border-radius:50%;width:44px;height:44px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.2);text-decoration:none;font-size:18px">✈️</a>
  <a href="https://wa.me/?text=${encodeURIComponent(`Scanner Market Watch — ${pageUrl}`)}" target="_blank" style="background:#25d366;color:white;border-radius:50%;width:44px;height:44px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.2);text-decoration:none;font-size:18px">💬</a>
</div>
</body>`;

  if (!html.includes('class="share-buttons"')) {
    html = html.replace(/<\/body>/i, shareButtons);
    changed = true;
    console.log(`  ${dir}: share buttons added`);
  } else {
    console.log(`  ${dir}: share buttons already present`);
  }

  if (changed) {
    fs.writeFileSync(htmlPath, html, 'utf8');
    updated++;
  }
}

console.log(`\nDone: ${updated} files updated, ${skipped} skipped.`);
