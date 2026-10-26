#!/usr/bin/env node
'use strict';

// Rend en PNG l'échéancier d'une page publiée, pour les supports en français qui n'affichent pas
// de HTML (X notamment ; Substack est en anglais et n'en reçoit pas). L'image n'est pas ressaisie : on découpe `<figure class="evt-tl">` dans la page
// elle-même, avec la même feuille de style. L'image montre donc exactement les rendez-vous, les
// jours et les heures que le site affiche — une image qui diverge de son article est pire que pas
// d'image.
//
//   node tools/render-timeline-png.js --article weekly/YYYYMMDD/index.html --out weekly/YYYYMMDD/_img/echeancier.png
//   options : --id <id de la figure> (si la page en porte plusieurs), --width 1080, --mobile (390 px)
//
// Le logo est le VRAI /logo.svg embarqué (règle des images générées), jamais un logotype redessiné.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (name, fallback = null) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : fallback; };
const articleRel = arg('--article');
const outRel = arg('--out');
const figureId = arg('--id');
const mobile = argv.includes('--mobile');
const width = Number(arg('--width', mobile ? '390' : '1080'));
if (!articleRel || !outRel) {
  console.error('Usage: render-timeline-png.js --article <page.html> --out <fichier.png> [--id echeancier] [--width 1080] [--mobile]');
  process.exit(2);
}

const html = fs.readFileSync(path.resolve(ROOT, articleRel), 'utf8');
const figures = [...html.matchAll(/<figure class="evt-tl" id="([^"]+)"[\s\S]*?<\/figure>/g)];
const figure = figureId ? figures.find(m => m[1] === figureId) : figures[0];
if (!figure) { console.error(`[timeline] aucun échéancier${figureId ? ` « ${figureId} »` : ''} dans ${articleRel}`); process.exit(1); }
if (!figureId && figures.length > 1) console.warn(`[timeline] ${figures.length} échéanciers dans la page ; rendu du premier (${figure[1]}), --id pour un autre`);

const css = fs.readFileSync(path.join(ROOT, 'assets', 'report.css'), 'utf8');
const logo = Buffer.from(fs.readFileSync(path.join(ROOT, 'logo.svg'))).toString('base64');
const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<style>${css}
html, body { margin: 0; background: var(--bg); font-family: Inter, system-ui, sans-serif; }
.png-shell { width: ${width}px; box-sizing: border-box; padding: ${mobile ? '16px' : '28px 32px 24px'}; background: var(--bg); }
.png-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; font-size: 20px; font-weight: 800; color: var(--ink); }
.png-brand img { width: 30px; height: 30px; }
.png-shell .evt-tl { margin: 0; }
</style></head><body><div class="png-shell" id="shot"><div class="png-brand"><img src="data:image/svg+xml;base64,${logo}" alt="">DailyTickers</div>${figure[0]}</div></body></html>`;

(async () => {
  const puppeteer = require('puppeteer');
  const { findChrome } = require('./lib/find-chrome');
  const browser = await puppeteer.launch({ executablePath: findChrome(), args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  try {
    const tab = await browser.newPage();
    await tab.setViewport({ width, height: 900, deviceScaleFactor: 2 });
    await tab.setContent(page, { waitUntil: 'networkidle0', timeout: 30000 });
    await tab.evaluate(() => document.fonts.ready);
    // Sans la police d'icônes, chaque pastille porterait un carré vide : refuser plutôt que livrer.
    const iconsLoaded = await tab.evaluate(() => document.fonts.check('900 16px "Font Awesome 6 Free"'));
    if (!iconsLoaded) throw new Error('police d’icônes non chargée (réseau ?) : image refusée');
    const shot = await tab.$('#shot');
    const box = await shot.boundingBox();
    if (!box || box.height < 200) throw new Error('échéancier rendu vide');
    const out = path.resolve(ROOT, outRel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await shot.screenshot({ path: out, type: 'png' });
    console.log(`[timeline] ${path.relative(ROOT, out)} (${Math.round(box.width)}×${Math.round(box.height)} px, ${(fs.statSync(out).size / 1024).toFixed(0)} Ko)`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(`[timeline] ERREUR: ${error.message}`); process.exit(1); });
