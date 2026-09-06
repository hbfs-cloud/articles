#!/usr/bin/env node
'use strict';

// Rend en PNG les graphiques d'un article, pour les supports qui n'exécutent pas de JavaScript.
//
// Motif : le Substack du 2026-09-06 ne portait ni graphique ni tableau alors que l'article web en
// avait huit. Le connecteur accepte bien un bloc `::chart`, mais le déploiement courant le rend en
// bloc de code — vérifié deux fois, en forme « labels/datasets » et en option ECharts. Une image
// est de toute façon plus sûre : elle s'affiche aussi dans un client de messagerie, ce qu'aucun
// graphique scripté ne fait.
//
// Les spécifications ne sont pas ressaisies : elles sont lues dans `CHART_SPECS`, le tableau que
// `build-weekly.js` sérialise déjà dans la page. Le Substack montre donc EXACTEMENT les mêmes
// courbes que le site, aux mêmes valeurs — un graphique qui diverge de son article est pire que
// pas de graphique.
//
//   node tools/render-charts-png.js --article weekly/YYYYMMDD/index.html --out <dossier>
//   node tools/render-charts-png.js --article ... --only reactionChart,intradayChart

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };

const articleRel = arg('--article');
const outRel = arg('--out');
const only = (arg('--only') || '').split(',').map(s => s.trim()).filter(Boolean);
const labelsRel = arg('--labels');
const width = Number(arg('--width', '1200'));
const height = Number(arg('--height', '620'));
if (!articleRel || !outRel) {
  console.error('Usage: render-charts-png.js --article <page.html> --out <dossier> [--only id,id] [--width N] [--height N]');
  process.exit(2);
}

const html = fs.readFileSync(path.resolve(ROOT, articleRel), 'utf8');
const m = /const CHART_SPECS = (\[[\s\S]*?\]);/.exec(html);
if (!m) { console.error('[charts] aucun CHART_SPECS dans la page — rien à rendre'); process.exit(1); }
let specs = JSON.parse(m[1]);

// Les titres et légendes vivent dans le HTML, à côté du conteneur. On les récupère pour les
// incruster dans l'image : une courbe sans son titre ne veut rien dire une fois sortie de l'article.
for (const s of specs) {
  const panel = new RegExp(`<div class="chart-panel"><div class="chart-title">([^<]*)</div><div id="${s.id}"[^>]*></div><p class="chart-note">([^<]*)</p>`).exec(html);
  if (panel) { s.title = decode(panel[1]); s.note = decode(panel[2]); }
}
// Traduction. Les mêmes séries, les mêmes valeurs, une autre langue : le Substack est en anglais
// et une légende française y serait aussi inutile qu'une absence de graphique. Le dictionnaire est
// appliqué à TOUTES les chaînes de la spécification, titres et notes compris, pour qu'aucun libellé
// d'axe ne reste en français par oubli.
if (labelsRel) {
  const dict = JSON.parse(fs.readFileSync(path.resolve(ROOT, labelsRel), 'utf8'));
  const tr = t => {
    let out = String(t);
    for (const [from, to] of Object.entries(dict.strings || {})) out = out.split(from).join(to);
    return out;
  };
  const walk = node => {
    if (typeof node === 'string') return tr(node);
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(node)) out[k] = typeof v === 'function' ? v : walk(v);
      return out;
    }
    return node;
  };
  for (const s of specs) {
    const over = (dict.charts || {})[s.id] || {};
    s.title = over.title || tr(s.title || '');
    s.note = over.note || tr(s.note || '');
    s.spec = walk(s.spec);
  }
  // Un libellé français qui survit à la traduction est une erreur silencieuse : on le signale.
  const leftovers = specs.flatMap(s => {
    const hay = JSON.stringify([s.title, s.note, s.spec]);
    return (dict.forbid || []).filter(w => new RegExp(w, 'i').test(hay)).map(w => `${s.id}: « ${w} »`);
  });
  if (leftovers.length) { console.error('[charts] libellés non traduits :'); leftovers.forEach(x => console.error(`  - ${x}`)); process.exit(1); }
}

if (only.length) specs = specs.filter(s => only.includes(s.id));
if (!specs.length) { console.error('[charts] aucun graphique retenu'); process.exit(1); }

function decode(t) {
  return String(t).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ');
}

const outDir = path.resolve(ROOT, outRel);
fs.mkdirSync(outDir, { recursive: true });

// La bibliothèque est chargée depuis le disque quand elle y est, sinon depuis le réseau. Un rendu
// qui dépend d'une requête au moment de la capture échoue en silence sur une ligne lente, et rend
// une image vide qu'on ne remarque qu'après publication.
const LOCAL_ECHARTS = ['node_modules/echarts/dist/echarts.min.js']
  .map(p => path.join(ROOT, p)).find(p => fs.existsSync(p));

const page = spec => `<!doctype html><meta charset="utf-8">
<style>
  body { margin:0; font-family:Inter,system-ui,-apple-system,sans-serif; background:#fff; color:#0f172a; }
  .wrap { padding:28px 32px 22px; }
  h1 { font-size:22px; line-height:1.3; margin:0 0 18px; font-weight:700; }
  #c { width:${width - 64}px; height:${height - 170}px; }
  p { font-size:13px; line-height:1.5; color:#475569; margin:16px 0 0; }
  .brand { display:flex; align-items:center; gap:8px; margin-top:18px; font-size:12px; color:#64748b; font-weight:600; letter-spacing:.02em; }
  .dot { width:9px; height:9px; border-radius:50%; background:#50b4ee; }
</style>
<div class="wrap">
  <h1>${escapeHtml(spec.title || '')}</h1>
  <div id="c"></div>
  <p>${escapeHtml(spec.note || '')}</p>
  <div class="brand"><span class="dot"></span> DailyTickers</div>
</div>
<script src="${LOCAL_ECHARTS ? 'file://' + LOCAL_ECHARTS : 'https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js'}"></script>
<script>
  const inst = echarts.init(document.getElementById('c'), null, { renderer: 'canvas' });
  inst.setOption(Object.assign({ animation:false, textStyle:{ fontFamily:'Inter, system-ui, sans-serif', fontSize:12 } }, ${JSON.stringify(spec.spec)}));
  window.__ready = true;
</script>`;

const escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

(async () => {
  const puppeteer = require('puppeteer');
  const { findChrome } = require('./lib/find-chrome');
  const executablePath = findChrome();
  if (executablePath) console.log(`[charts] navigateur : ${executablePath}`);
  const browser = await puppeteer.launch({ executablePath, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  const written = [];
  try {
    for (const spec of specs) {
      const tab = await browser.newPage();
      await tab.setViewport({ width, height, deviceScaleFactor: 2 });
      await tab.setContent(page(spec), { waitUntil: 'networkidle0' });
      await tab.waitForFunction('window.__ready === true', { timeout: 15000 });
      // Une image vide passe inaperçue jusqu'à la publication : on vérifie que le rendu a bien
      // produit un canvas non vide avant d'écrire le fichier.
      const painted = await tab.evaluate(() => {
        const c = document.querySelector('#c canvas');
        if (!c) return false;
        const ctx = c.getContext('2d');
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] !== 0 && (d[i] !== 255 || d[i + 1] !== 255 || d[i + 2] !== 255)) return true;
        return false;
      });
      if (!painted) throw new Error(`${spec.id}: le graphique s'est rendu vide`);
      const file = path.join(outDir, `${spec.id}.png`);
      await tab.screenshot({ path: file, type: 'png' });
      await tab.close();
      written.push({ id: spec.id, file: path.relative(ROOT, file), title: spec.title, bytes: fs.statSync(file).size });
      console.log(`  ✓ ${spec.id.padEnd(18)} ${(fs.statSync(file).size / 1024).toFixed(0)} Ko  ${spec.title || ''}`);
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(outDir, 'charts.json'), JSON.stringify({ article: articleRel, charts: written }, null, 2) + '\n');
  console.log(`[charts] ${written.length} image(s) → ${outRel}`);
})().catch(error => { console.error(`[charts] ERREUR: ${error.message}`); process.exit(1); });
