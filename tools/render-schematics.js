#!/usr/bin/env node
'use strict';

// Rend en PNG les schémas pédagogiques de `tools/lib/schematics.js`.
//
// Les 129 épisodes programmés jusqu'en 2028 sont du texte nu : un tableau au total, aucune image,
// aucun graphique, 570 mots de moyenne. Illisible d'affilée. Ces figures existent pour rendre le
// mécanisme visible — pas pour habiller un chiffre.
//
// D'où le pied de figure, imposé par le code et non par la bonne volonté de l'auteur :
// « Schematic — illustrates the mechanism, not market data ». Les épisodes avancent des
// statistiques que leurs sources citées ne couvrent pas ; mettre celles-là en graphique les rendrait
// plus crédibles sans les rendre plus vraies.
//
//   node tools/render-schematics.js --out substack-assets/schematics
//   node tools/render-schematics.js --out … --only gap_and_stop,option_payoff

const fs = require('fs');
const path = require('path');
const { SCHEMATICS } = require('./lib/schematics');
const { findChrome } = require('./lib/find-chrome');
const { assertSerializable } = require('./lib/echarts-safe');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const outRel = arg('--out', 'substack-assets/schematics');
const only = (arg('--only') || '').split(',').map(s => s.trim()).filter(Boolean);
const width = Number(arg('--width', '1200'));
const height = Number(arg('--height', '620'));

const TITLES = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/substack/schematic-titles.json'), 'utf8'));

let ids = Object.keys(SCHEMATICS);
if (only.length) ids = ids.filter(k => only.includes(k));
if (!ids.length) { console.error('[schema] aucune figure retenue'); process.exit(1); }

const outDir = path.resolve(ROOT, outRel);
fs.mkdirSync(outDir, { recursive: true });

const LOCAL_ECHARTS = path.join(ROOT, 'node_modules/echarts/dist/echarts.min.js');
const echartsSrc = fs.existsSync(LOCAL_ECHARTS) ? 'file://' + LOCAL_ECHARTS : 'https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const page = (id, spec, meta, h) => `<!doctype html><meta charset="utf-8">
<style>
  body { margin:0; font-family:Inter,system-ui,-apple-system,sans-serif; background:#fff; color:#0f172a; }
  .wrap { padding:26px 32px 20px; }
  h1 { font-size:21px; line-height:1.3; margin:0 0 4px; font-weight:700; }
  .sub { font-size:13px; color:#475569; margin:0 0 16px; }
  #c { width:${width - 64}px; height:${h - 178}px; }
  .foot { display:flex; align-items:center; justify-content:space-between; margin-top:16px; font-size:11px; color:#94a3b8; }
  .brand { display:flex; align-items:center; gap:7px; color:#64748b; font-weight:600; }
  .dot { width:9px; height:9px; border-radius:50%; background:#50b4ee; }
</style>
<div class="wrap">
  <h1>${esc(meta.title)}</h1>
  <p class="sub">${esc(meta.subtitle)}</p>
  <div id="c"></div>
  <div class="foot">
    <span>Schematic — illustrates the mechanism, not market data.</span>
    <span class="brand"><span class="dot"></span> DailyTickers</span>
  </div>
</div>
<script src="${echartsSrc}"></script>
<script>
  const inst = echarts.init(document.getElementById('c'), null, { renderer:'canvas' });
  inst.setOption(${JSON.stringify(spec)});
  window.__ready = true;
</script>`;

(async () => {
  const puppeteer = require('puppeteer');
  const executablePath = findChrome();
  const browser = await puppeteer.launch({ executablePath, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  const written = [];
  try {
    for (const id of ids) {
      const meta = TITLES[id];
      if (!meta) throw new Error(`${id}: titre et sous-titre absents de data/substack/schematic-titles.json`);
      // Hauteur par figure : un diagramme de flux tient dans 440 px et laissait sinon un tiers de
      // l'image vide, ce qui se voit immédiatement une fois l'image posée dans un article.
      const h = Number(meta.height) || height;
      const option = SCHEMATICS[id]();
      assertSerializable(option, id);
      const tab = await browser.newPage();
      await tab.setViewport({ width, height: h, deviceScaleFactor: 2 });
      await tab.setContent(page(id, option, meta, h), { waitUntil: 'networkidle0' });
      await tab.waitForFunction('window.__ready === true', { timeout: 15000 });
      const painted = await tab.evaluate(() => {
        const c = document.querySelector('#c canvas');
        if (!c) return false;
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] !== 0 && (d[i] !== 255 || d[i + 1] !== 255 || d[i + 2] !== 255)) return true;
        return false;
      });
      if (!painted) throw new Error(`${id}: figure rendue vide`);
      const file = path.join(outDir, `${id}.png`);
      await tab.screenshot({ path: file, type: 'png' });
      await tab.close();
      written.push({ id, file: path.relative(ROOT, file), title: meta.title, bytes: fs.statSync(file).size });
      console.log(`  ✓ ${id.padEnd(22)} ${(fs.statSync(file).size / 1024).toFixed(0)} Ko  ${meta.title}`);
    }
  } finally { await browser.close(); }
  // FUSIONNER, JAMAIS REMPLACER. Un rendu partiel (`--only`) écrasait le catalogue complet, et le
  // constructeur d'épisodes échouait ensuite sur « figure inconnue » pour des images pourtant
  // présentes sur le disque. Un fichier d'index qui ment sur ce qui existe est pire qu'aucun index.
  const indexPath = path.join(outDir, 'index.json');
  const prev = fs.existsSync(indexPath) ? (JSON.parse(fs.readFileSync(indexPath, 'utf8')).figures || []) : [];
  const merged = new Map(prev.map(f => [f.id, f]));
  for (const f of written) merged.set(f.id, f);
  // Une entrée dont l'image a disparu du disque n'a rien à faire dans le catalogue.
  const figures = [...merged.values()].filter(f => fs.existsSync(path.resolve(ROOT, f.file))).sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(indexPath, JSON.stringify({ generated_from: 'tools/lib/schematics.js', figures }, null, 2) + '\n');
  console.log(`[schema] ${written.length} figure(s) → ${outRel}`);
})().catch(e => { console.error(`[schema] ERREUR: ${e.message}`); process.exit(1); });
