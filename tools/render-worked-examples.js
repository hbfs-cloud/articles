#!/usr/bin/env node
'use strict';

// Rend en PNG les exemples chiffrés déclarés dans `data/substack/episode-illustrations.json`.
//
// Différence de fond avec `render-schematics.js` : un schéma illustre un mécanisme avec des valeurs
// de démonstration, un exemple chiffré rejoue le calcul de l'épisode. Les deux portent donc un pied
// de figure différent, et celui-ci nomme la source — l'épisode lui-même.
//
// LE RENDU EST BLOQUÉ SI UN CHIFFRE DU GRAPHIQUE N'EST PAS DANS L'ÉPISODE.
// Sans ce garde-fou, un graphique « d'illustration » devient une source parallèle que personne ne
// relit : il a l'autorité du dessin sans en avoir la provenance. C'est exactement de cette façon
// qu'un chiffre faux devient crédible.
//
//   node tools/render-worked-examples.js
//   node tools/render-worked-examples.js --only etf-toolkit/episode-04.md

const fs = require('fs');
const path = require('path');
const { FAMILIES } = require('./lib/worked-example');
const { foreignNumbers, proseOf } = require('./lib/episode-illustration');
const { findChrome } = require('./lib/find-chrome');
const { assertSerializable } = require('./lib/echarts-safe');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const outRel = arg('--out', 'substack-assets/examples');
const only = (arg('--only') || '').split(',').map(s => s.trim()).filter(Boolean);
const width = Number(arg('--width', '1200'));

const MAP = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/substack/episode-illustrations.json'), 'utf8'));
const SERIES_DIR = path.join(ROOT, 'data/substack/series');

let keys = Object.keys(MAP).filter(k => !k.startsWith('_') && MAP[k].chart);
if (only.length) keys = keys.filter(k => only.includes(k));
if (!keys.length) { console.log('[exemple] aucun exemple chiffré déclaré'); process.exit(0); }

const outDir = path.resolve(ROOT, outRel);
fs.mkdirSync(outDir, { recursive: true });

const LOCAL_ECHARTS = path.join(ROOT, 'node_modules/echarts/dist/echarts.min.js');
const echartsSrc = fs.existsSync(LOCAL_ECHARTS) ? 'file://' + LOCAL_ECHARTS : 'https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const page = (spec, chart, h) => `<!doctype html><meta charset="utf-8">
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
  <h1>${esc(chart.title)}</h1>
  <p class="sub">${esc(chart.subtitle)}</p>
  <div id="c"></div>
  <div class="foot">
    <span>Worked example — the figures come from this episode.</span>
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
  const browser = await puppeteer.launch({ executablePath: findChrome(), args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  const written = [];
  try {
    for (const key of keys.sort()) {
      const chart = MAP[key].chart;
      const src = path.join(SERIES_DIR, key);
      if (!fs.existsSync(src)) throw new Error(`${key}: épisode introuvable`);
      const prose = proseOf(fs.readFileSync(src, 'utf8'));

      // Le titre et le sous-titre sont de la mise en page : ils peuvent nommer un chiffre déjà dit,
      // pas en apporter un. Les données, elles, sont la substance du graphique.
      const foreign = foreignNumbers({ data: chart.data, title: chart.title, subtitle: chart.subtitle }, prose);
      if (foreign.length) {
        throw new Error(`${key}: chiffre(s) absent(s) de l'épisode — ${foreign.join(', ')}.\n` +
          `    Un graphique ne peut pas apporter un nombre que le texte ne dit pas. Corriger le texte ou le graphique.`);
      }

      const build = FAMILIES[chart.family];
      if (!build) throw new Error(`${key}: famille inconnue « ${chart.family} » (attendu : ${Object.keys(FAMILIES).join(', ')})`);
      const option = build(chart.data);
      assertSerializable(option, key);
      const h = Number(chart.height) || 560;
      const tab = await browser.newPage();
      await tab.setViewport({ width, height: h, deviceScaleFactor: 2 });
      await tab.setContent(page(option, chart, h), { waitUntil: 'networkidle0' });
      await tab.waitForFunction('window.__ready === true', { timeout: 15000 });
      const painted = await tab.evaluate(() => {
        const c = document.querySelector('#c canvas');
        if (!c) return false;
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] !== 0 && (d[i] !== 255 || d[i + 1] !== 255 || d[i + 2] !== 255)) return true;
        return false;
      });
      if (!painted) throw new Error(`${key}: graphique rendu vide`);
      const id = key.replace(/\.md$/, '').replace(/\//g, '_');
      const file = path.join(outDir, `${id}.png`);
      await tab.screenshot({ path: file, type: 'png' });
      await tab.close();
      written.push({ id, key, file: path.relative(ROOT, file), title: chart.title, bytes: fs.statSync(file).size });
      console.log(`  ✓ ${id.padEnd(38)} ${(fs.statSync(file).size / 1024).toFixed(0)} Ko  ${chart.title}`);
    }
  } finally { await browser.close(); }

  // Fusionner, jamais remplacer : un rendu partiel ne doit pas effacer du catalogue des images qui
  // existent toujours sur le disque — le constructeur d'épisodes échouerait ensuite à tort.
  const indexPath = path.join(outDir, 'index.json');
  const prev = fs.existsSync(indexPath) ? (JSON.parse(fs.readFileSync(indexPath, 'utf8')).examples || []) : [];
  const merged = new Map(prev.map(f => [f.id, f]));
  for (const f of written) merged.set(f.id, f);
  const examples = [...merged.values()].filter(f => fs.existsSync(path.resolve(ROOT, f.file))).sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(indexPath, JSON.stringify({ generated_from: 'data/substack/episode-illustrations.json', examples }, null, 2) + '\n');
  console.log(`[exemple] ${written.length} graphique(s) → ${outRel}`);
})().catch(e => { console.error(`[exemple] ERREUR: ${e.message}`); process.exit(1); });
