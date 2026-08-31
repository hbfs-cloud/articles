#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const seriesCatalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'series-catalog.json'), 'utf8'));

function redirectTarget(href) {
  const file = path.join(ROOT, href.replace(/^\//, ''), 'index.html');
  if (!fs.existsSync(file)) return href;
  const html = fs.readFileSync(file, 'utf8');
  const match = html.match(/<meta\s+[^>]*http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"']+)["']/i)
    || html.match(/<meta\s+[^>]*content=["'][^"']*url=([^"']+)["'][^>]*http-equiv=["']refresh["']/i);
  return match ? new URL(match[1], 'http://localhost' + href).pathname : href;
}

const URLS = new Set(seriesCatalog.series.flatMap(series => series.chapters.map(chapter => redirectTarget(chapter.href))));

function browserExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter(Boolean);
  return candidates.find(candidate => fs.existsSync(candidate));
}

function collectTechUrls(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) collectTechUrls(target);
    else if (entry.name === 'index.html') {
      URLS.add('/' + path.relative(ROOT, path.dirname(target)).split(path.sep).join('/') + '/');
    }
  }
}
collectTechUrls(path.join(ROOT, 'tech'));

const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

function resolveRequest(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname);
  const relative = pathname.replace(/^\/+/, '');
  let target = path.resolve(ROOT, relative);
  if (!target.startsWith(ROOT + path.sep) && target !== ROOT) return null;
  if (pathname.endsWith('/') || (fs.existsSync(target) && fs.statSync(target).isDirectory())) {
    target = path.join(target, 'index.html');
  }
  return target;
}

function startServer() {
  return new Promise(resolve => {
    const server = http.createServer((request, response) => {
      const target = resolveRequest(request.url);
      if (!target || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('Not found');
        return;
      }
      response.writeHead(200, {
        'content-type': mime[path.extname(target)] || 'application/octet-stream',
        'cache-control': 'no-store'
      });
      fs.createReadStream(target).pipe(response);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function createPage(browser, origin, viewport) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.setRequestInterception(true);
  page.on('request', request => {
    const requestUrl = request.url();
    if (requestUrl.startsWith(origin) || requestUrl.startsWith('data:')) request.continue();
    else request.abort();
  });
  return page;
}

async function inspectArticle(page, origin, href) {
  const response = await page.goto(origin + href, { waitUntil: 'load', timeout: 15000 });
  await page.waitForFunction(() => document.body && (document.body.classList.contains('content-series') || document.body.classList.contains('content-tech')), { timeout: 5000 });
  await new Promise(resolve => setTimeout(resolve, 50));
  const result = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const visible = element => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const headings = Array.from(document.querySelectorAll('h1,h2,h3')).filter(visible);
    const badHeadings = headings.filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.left < -1 || rect.right > root.clientWidth + 1;
    }).map(element => element.textContent.trim().slice(0, 80));
    const bars = Array.from(document.querySelectorAll('.series-bar')).map(bar => {
      const steps = bar.querySelector('.series-steps');
      return {
        current: Boolean(bar.querySelector('.series-step.current')),
        scrollbar: steps ? getComputedStyle(steps).scrollbarWidth : null,
        rectRight: Math.round(bar.getBoundingClientRect().right),
        viewport: root.clientWidth
      };
    });
    const tableViewports = Array.from(document.querySelectorAll('.article-table-scroll')).map(wrapper => {
      const rect = wrapper.getBoundingClientRect();
      return { left: Math.round(rect.left), right: Math.round(rect.right), overflow: getComputedStyle(wrapper).overflowX };
    });
    return {
      bodyClass: body.className,
      documentOverflow: Math.max(root.scrollWidth, body.scrollWidth) - root.clientWidth,
      rootOverflowMode: getComputedStyle(root).overflowX,
      bodyOverflowMode: getComputedStyle(body).overflowX,
      h1Count: Array.from(document.querySelectorAll('h1')).filter(visible).length,
      badHeadings,
      bars,
      unwrappedTables: Array.from(document.querySelectorAll('table')).filter(table => !table.closest('.table-scroll, .article-table-scroll')).length,
      badTableViewports: tableViewports.filter(viewport => viewport.left < -1 || viewport.right > root.clientWidth + 1 || !['auto', 'scroll'].includes(viewport.overflow)),
      badSourceRefs: Array.from(document.querySelectorAll('.source-ref')).filter(source => source.getBoundingClientRect().right > root.clientWidth + 1).length,
      tagContainerCount: document.querySelectorAll('#article-clickable-tags').length,
      footerCount: document.querySelectorAll('.article-footer, footer').length,
      textLength: body.innerText.replace(/\s+/g, ' ').trim().length
    };
  });

  const errors = [];
  if (!response || response.status() >= 400) errors.push(`HTTP ${response ? response.status() : 'absent'}`);
  const clipsDocument = ['hidden', 'clip'].includes(result.rootOverflowMode) || ['hidden', 'clip'].includes(result.bodyOverflowMode);
  if (result.documentOverflow > 1 && !clipsDocument) errors.push(`scrollbar horizontale globale ${result.documentOverflow}px`);
  if (!result.h1Count) errors.push('aucun H1 visible');
  if (result.badHeadings.length) errors.push(`titre hors viewport: ${result.badHeadings.join(' | ')}`);
  if (result.bars.some(bar => bar.scrollbar !== 'none')) errors.push('scrollbar de chapitres visible');
  if (result.bars.some(bar => !bar.current)) errors.push('chapitre courant absent');
  if (result.unwrappedTables) errors.push(`${result.unwrappedTables} tableau(x) sans viewport responsive`);
  if (result.badTableViewports.length) errors.push(`${result.badTableViewports.length} viewport(s) de tableau hors écran`);
  if (result.badSourceRefs) errors.push(`${result.badSourceRefs} référence(s) de source hors écran`);
  if (result.tagContainerCount > 1) errors.push(`${result.tagContainerCount} blocs de tags dupliqués`);
  if (!result.footerCount) errors.push('footer absent');
  if (result.textLength < 200) errors.push(`contenu anormalement court (${result.textLength} caractères)`);
  return errors;
}

async function inspectIndex(page, origin, tab, viewport) {
  await page.goto(`${origin}/?tab=${tab}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForSelector(`#tab-${tab} .series-catalog-card`, { timeout: 10000 });
  return page.evaluate((currentTab, expectedWidth) => {
    const root = document.documentElement;
    const cards = Array.from(document.querySelectorAll(`#tab-${currentTab} .series-catalog-card`));
    const dimensions = cards.slice(0, 8).map(card => {
      const rect = card.getBoundingClientRect();
      return { width: Math.round(rect.width), height: Math.round(rect.height) };
    });
    return {
      title: document.querySelector(`#tab-${currentTab} .series-tab-title`)?.textContent.trim() || '',
      guidedPaths: document.querySelectorAll(`#tab-${currentTab} .parcours-item`).length,
      cardCount: cards.length,
      dimensions,
      overflow: document.documentElement.scrollWidth - root.clientWidth,
      viewport: expectedWidth
    };
  }, tab, viewport.width);
}

async function main() {
  const server = await startServer();
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  const executablePath = browserExecutable();
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath,
    args: ['--no-sandbox', '--disable-gpu']
  });
  const failures = [];
  let auditedPageCount = 0;
  try {
    const pathPattern = process.env.UX_PATH_PATTERN ? new RegExp(process.env.UX_PATH_PATTERN) : null;
    const queue = Array.from(URLS).sort().filter(href => !pathPattern || pathPattern.test(href));
    auditedPageCount = queue.length;
    const workerCount = Math.max(1, Number(process.env.UX_WORKERS || 1));
    const workers = Array.from({ length: workerCount }, async () => {
      while (queue.length) {
        const href = queue.shift();
        let finalErrors = [];
        for (let attempt = 0; attempt < 2; attempt++) {
          let page;
          try {
            page = await createPage(browser, origin, { width: 390, height: 844, deviceScaleFactor: 1 });
            finalErrors = await inspectArticle(page, origin, href);
            break;
          } catch (error) {
            finalErrors = [error.message];
          } finally {
            if (page) await page.close();
          }
        }
        if (finalErrors.length) failures.push(`${href}: ${finalErrors.join('; ')}`);
      }
    });
    await Promise.all(workers);

    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
      const page = await createPage(browser, origin, viewport);
      const series = await inspectIndex(page, origin, 'series', viewport);
      const tech = await inspectIndex(page, origin, 'tech', viewport);
      await page.close();
      for (const [name, result] of [['series', series], ['tech', tech]]) {
        if (result.overflow > 1) failures.push(`index ${name} ${viewport.width}px: débordement ${result.overflow}px`);
        if (!result.guidedPaths) failures.push(`index ${name} ${viewport.width}px: parcours guidés absents`);
        if (!result.cardCount) failures.push(`index ${name} ${viewport.width}px: cartes absentes`);
        if (result.dimensions.some(size => size.height !== (viewport.width <= 640 ? 292 : 300))) {
          failures.push(`index ${name} ${viewport.width}px: hauteurs de cartes incohérentes ${JSON.stringify(result.dimensions)}`);
        }
      }
      if (tech.title !== 'Guides techniques') failures.push(`index tech ${viewport.width}px: titre inattendu « ${tech.title} »`);
      const seriesWidths = new Set(series.dimensions.map(size => size.width));
      const techWidths = new Set(tech.dimensions.map(size => size.width));
      if (seriesWidths.size !== 1 || techWidths.size !== 1 || [...seriesWidths][0] !== [...techWidths][0]) {
        failures.push(`index ${viewport.width}px: largeurs Series/Tech différentes`);
      }
    }
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }

  if (failures.length) {
    console.error(`FAIL browser UX (${failures.length})`);
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
  }
  console.log(`PASS browser UX: ${auditedPageCount} pages Series/Tech à 390px, index alignés à 390px et 1440px`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
