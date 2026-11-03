#!/usr/bin/env node
'use strict';
// generate-og-card.cjs — carte d'aperçu neutre /og-card.png (1200×630) pour les liens partagés
// (Telegram, WhatsApp, X). Aucune date, aucun chiffre : elle ne peut pas devenir périmée, à la
// différence de l'ancienne /scanner-daily-card.png restée figée sur le tableau de bord du 27 mars 2026.
// Logo réel /logo.svg embarqué en data-URI.
//
// Usage : node tools/generate-og-card.cjs [sortie.png]   (défaut : og-card.png à la racine)

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'og-card.png'));
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const logo = fs.readFileSync(path.join(ROOT, 'logo.svg'), 'utf8');
  const uri = 'data:image/svg+xml;base64,' + Buffer.from(logo).toString('base64');
  const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;700;800&display=swap" rel="stylesheet"><style>
html,body{margin:0;width:1200px;height:630px;background:#f8fafc;font-family:Inter,system-ui,sans-serif;color:#0f172a}
.w{box-sizing:border-box;height:100%;padding:80px 96px;display:flex;flex-direction:column;justify-content:space-between;border-top:10px solid #2563eb}
.b{display:flex;align-items:center;gap:28px}.b img{height:120px}
h1{font-size:76px;font-weight:800;margin:0;letter-spacing:-1.5px}
p{font-size:36px;font-weight:500;color:#334155;margin:0;line-height:1.35}
.u{font-size:28px;font-weight:700;color:#2563eb}</style></head><body><div class="w">
<div class="b"><img src="${uri}"><h1>DailyTickers</h1></div>
<p>Analyses de marché, scanner et idées de trade,<br>vérifiées avant publication.</p>
<div class="u">articles.dailytickers.com</div></div></body></html>`;
  const opts = { headless: 'new' };
  if (fs.existsSync(CHROME)) opts.executablePath = CHROME;
  const browser = await puppeteer.launch(opts);
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: OUT });
  await browser.close();
  console.log(`✅ ${path.relative(ROOT, OUT)}`);
})().catch(e => { console.error(`❌ ${e.message}`); process.exit(1); });
