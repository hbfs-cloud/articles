#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const LEGACY_MODES = ['turbo', 'dynamic', 'balanced', 'fortress'];
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1000, deviceScaleFactor: 1 },
  { name: 'mobile', width: 390, height: 844, deviceScaleFactor: 1 },
];
const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function browserExecutable() {
  return [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
  ].filter(Boolean).find(candidate => fs.existsSync(candidate)) || null;
}

function startServer() {
  return new Promise(resolve => {
    const server = http.createServer((request, response) => {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      let target = path.resolve(ROOT, pathname.replace(/^\/+/, ''));
      const relative = path.relative(ROOT, target);
      if (relative.startsWith('..') || path.isAbsolute(relative)) target = null;
      if (target && (pathname.endsWith('/') || (fs.existsSync(target) && fs.statSync(target).isDirectory()))) {
        target = path.join(target, 'index.html');
      }
      if (!target || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('Not found');
        return;
      }
      response.writeHead(200, {
        'content-type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      if (request.method === 'HEAD') response.end();
      else fs.createReadStream(target).pipe(response);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function check(failures, condition, message) {
  if (!condition) failures.push(message);
}

async function inspect(page) {
  return page.evaluate(legacyModes => {
    const root = document.documentElement;
    const body = document.body;
    const text = body.innerText.replace(/\s+/g, ' ').trim();
    const mode = id => {
      const card = document.getElementById(`mode-${id}`);
      return {
        present: Boolean(card),
        scope: card?.dataset.performanceScope || null,
        certified: card?.dataset.accountingCertified || null,
        metricValues: card
          ? Array.from(card.querySelectorAll('.tr-metric-value')).map(element => element.textContent.trim())
          : [],
        text: card?.innerText.replace(/\s+/g, ' ').trim() || '',
        charts: card?.querySelectorAll('.tr-chart-slot').length || 0,
      };
    };
    const legacy = Object.fromEntries(legacyModes.map(id => [id, mode(id)]));
    const best = mode('best');
    return {
      lang: root.lang,
      title: document.querySelector('h1')?.textContent.trim() || '',
      hero: document.querySelector('.hero-sub')?.textContent.replace(/\s+/g, ' ').trim() || '',
      sealedBadge: Array.from(document.querySelectorAll('.hero-badge'))
        .map(element => element.textContent.replace(/\s+/g, ' ').trim())
        .find(value => /registre.*certifié/i.test(value)) || '',
      modeCount: document.querySelectorAll('.tr-mode').length,
      legacy,
      best,
      oldValues: ['99,25 %', '59,19 %', '55,02 %', '20,24 %', '3588,72', '3588.72']
        .filter(value => text.includes(value)),
      overflow: Math.max(root.scrollWidth, body.scrollWidth) - root.clientWidth,
      homeLink: Boolean(document.querySelector('.brand-logo[href="/"]')),
    };
  }, LEGACY_MODES);
}

async function main() {
  const executablePath = browserExecutable();
  if (!executablePath) throw new Error('Chrome système introuvable (définir CHROME_PATH si nécessaire)');
  const pagePath = path.join(ROOT, 'tech', 'track-record', 'index.html');
  if (!fs.existsSync(pagePath)) throw new Error(`Rendu absent: ${pagePath}`);

  const server = await startServer();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath,
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const failures = [];
  const captures = [];
  try {
    for (const viewport of VIEWPORTS) {
      const page = await browser.newPage();
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      await page.setViewport(viewport);
      await page.setRequestInterception(true);
      page.on('request', request => {
        const url = request.url();
        if (url.startsWith(origin) || url.startsWith('data:') || /cdn\.jsdelivr\.net/.test(url)) request.continue();
        else request.abort();
      });
      try {
        await page.goto(`${origin}/tech/track-record/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForSelector('#mode-best', { visible: true, timeout: 10000 });
        await new Promise(resolve => setTimeout(resolve, 250));
        const state = await inspect(page);
        check(failures, state.lang === 'fr', `${viewport.name}: langue FR absente`);
        check(failures, /seulement.*certifiés/i.test(state.title), `${viewport.name}: titre de certification ambigu`);
        check(failures, /configurations.*versionnées/i.test(state.hero), `${viewport.name}: historique versionné absent du hero`);
        check(failures, /0 registre certifié/i.test(state.sealedBadge), `${viewport.name}: badge zéro registre certifié absent`);
        check(failures, state.modeCount === 5, `${viewport.name}: ${state.modeCount} cartes au lieu de 5`);
        for (const id of LEGACY_MODES) {
          const mode = state.legacy[id];
          check(failures, mode.present, `${viewport.name} ${id}: carte absente`);
          check(failures, mode.scope === 'simulated_backtest' && mode.certified === 'false', `${viewport.name} ${id}: scope/certification invalide`);
          check(failures, mode.metricValues.length === 5 && mode.metricValues.every(value => value === '—'), `${viewport.name} ${id}: métriques non masquées`);
          check(failures, /Forward certifié · historique retiré/i.test(mode.text), `${viewport.name} ${id}: frontière forward/retrait historique absent`);
          check(failures, mode.charts === 0, `${viewport.name} ${id}: courbe non certifiée visible`);
        }
        check(failures, state.best.scope === 'forward_execution' && state.best.certified === 'false', `${viewport.name} DTX: frontière forward absente`);
        check(failures, state.best.metricValues.length === 5 && state.best.metricValues.every(value => value === '—'), `${viewport.name} DTX: métriques réelles non masquées`);
        check(failures, /Suivi réel non démarré/i.test(state.best.text), `${viewport.name} DTX: état non démarré absent`);
        check(failures, /backtest de référence/i.test(state.best.text), `${viewport.name} DTX: séparation référence absente`);
        check(failures, state.oldValues.length === 0, `${viewport.name}: valeurs interdites visibles (${state.oldValues.join(', ')})`);
        check(failures, state.overflow <= 1, `${viewport.name}: débordement horizontal ${state.overflow}px`);
        check(failures, state.homeLink, `${viewport.name}: lien accueil absent`);
        const capture = `/tmp/track-record-browser-${viewport.name}.png`;
        await page.screenshot({ path: capture, fullPage: true });
        captures.push(capture);
      } finally {
        if (pageErrors.length) failures.push(`${viewport.name}: erreurs JavaScript ${pageErrors.join(' | ')}`);
        await page.close();
      }
    }
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }

  if (failures.length) {
    console.error(`FAIL track-record browser UX (${failures.length})`);
    failures.forEach(failure => console.error(`- ${failure}`));
    if (captures.length) console.error(`Captures: ${captures.join(', ')}`);
    process.exit(1);
  }
  console.log(`PASS track-record browser UX: fail-closed + DTX boundary, desktop/mobile (${path.basename(executablePath)})`);
  console.log(`Captures: ${captures.join(', ')}`);
}

main().catch(error => {
  console.error(`FAIL track-record browser UX: ${error.stack || error.message}`);
  process.exit(1);
});
