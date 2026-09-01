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
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

function browserExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  return candidates.find(candidate => fs.existsSync(candidate)) || null;
}

function resolveRequest(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname);
  const relative = pathname.replace(/^\/+/, '');
  let target = path.resolve(ROOT, relative);
  const relFromRoot = path.relative(ROOT, target);
  if (relFromRoot.startsWith('..') || path.isAbsolute(relFromRoot)) return null;
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
        'content-type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      if (request.method === 'HEAD') response.end();
      else fs.createReadStream(target).pipe(response);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function createPage(browser, origin, viewport) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    const host = (() => {
      try { return new URL(url).hostname; } catch (_) { return ''; }
    })();
    if (url.startsWith(origin) || url.startsWith('data:') || host === 'cdn.jsdelivr.net') request.continue();
    else request.abort();
  });
  return page;
}

async function settle(page) {
  await page.waitForFunction(() => document.readyState === 'complete' || document.readyState === 'interactive', { timeout: 10000 });
  await new Promise(resolve => setTimeout(resolve, 250));
}

async function inspectViewport(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const viewportWidth = root.clientWidth;
    const visible = element => {
      if (!element) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity || 1) !== 0
        && rect.width > 0
        && rect.height > 0;
    };
    const hasHorizontalScroller = element => {
      let parent = element.parentElement;
      while (parent && parent !== body) {
        const style = getComputedStyle(parent);
        if (['auto', 'scroll'].includes(style.overflowX) && parent.scrollWidth > parent.clientWidth + 1) return true;
        parent = parent.parentElement;
      }
      return false;
    };
    const outliers = Array.from(document.querySelectorAll('.brand-bar,.brand-bar *,.w,.w *,.community-cta,.community-cta *'))
      .filter(visible)
      .filter(element => {
        const rect = element.getBoundingClientRect();
        return (rect.left < -2 || rect.right > viewportWidth + 2) && !hasHorizontalScroller(element);
      })
      .slice(0, 12)
      .map(element => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          id: element.id || '',
          className: typeof element.className === 'string' ? element.className.slice(0, 90) : '',
          left: Math.round(rect.left),
          right: Math.round(rect.right),
        };
      });
    return {
      overflow: Math.max(root.scrollWidth, body.scrollWidth) - viewportWidth,
      overflowMode: `${getComputedStyle(root).overflowX}/${getComputedStyle(body).overflowX}`,
      outliers,
    };
  });
}

async function inspectBest(page) {
  return page.evaluate(() => {
    const visible = element => {
      if (!element) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) !== 0 && rect.width > 0 && rect.height > 0;
    };
    const panel = document.querySelector('#p-best');
    const tab = document.querySelector('.mode-tab[data-mode="best"]');
    const reference = panel && Array.from(panel.querySelectorAll('.perf-hero')).find(visible);
    const forward = panel && panel.querySelector('[data-section="forward-tracking"]');
    const currentPlan = panel && panel.querySelector('[data-section="dtx-plan"]');
    const visiblePositionSections = panel
      ? Array.from(panel.querySelectorAll('[data-section="positions"]')).filter(visible).length
      : 0;
    const actionPills = panel
      ? Array.from(panel.querySelectorAll('.pill')).filter(visible)
        .map(element => element.textContent.replace(/\s+/g, ' ').trim())
        .filter(text => /^(FILLED|EXECUTED|POSITION OPEN|POSITION OUVERTE)$/i.test(text))
      : [];
    const referenceText = reference ? reference.innerText.replace(/\s+/g, ' ').trim() : '';
    const forwardText = forward ? forward.innerText.replace(/\s+/g, ' ').trim() : '';
    const referenceRect = reference ? reference.getBoundingClientRect() : null;
    const forwardRect = forward ? forward.getBoundingClientRect() : null;
    return {
      lang: document.documentElement.lang,
      panelVisible: visible(panel),
      panelScope: panel ? panel.dataset.performanceScope : null,
      executionVerified: panel ? panel.dataset.executionVerified : null,
      tabText: tab ? tab.textContent.replace(/\s+/g, ' ').trim() : '',
      tabActive: Boolean(tab && tab.classList.contains('active') && tab.getAttribute('aria-selected') === 'true'),
      referenceVisible: visible(reference),
      referenceText,
      forwardVisible: visible(forward),
      forwardText,
      currentPlanText: currentPlan ? currentPlan.innerText.replace(/\s+/g, ' ').trim() : '',
      sectionsSeparated: Boolean(referenceRect && forwardRect && Math.abs(referenceRect.top - forwardRect.top) > 20),
      visiblePositionSections,
      actionPills,
      falseExecutionHeading: panel
        ? Array.from(panel.querySelectorAll('h1,h2,h3,h4')).filter(visible)
          .map(element => element.textContent.replace(/\s+/g, ' ').trim())
          .filter(text => /position(?:s)? (?:ouverte|exécutée|filled)/i.test(text))
        : [],
      ambiguousShareLabel: panel ? /\b\d+\s+actions?\b/i.test(panel.innerText) : false,
      preBoundarySymbolVisible: panel ? /\bSNDK\b/i.test(panel.innerText) : false,
    };
  });
}

async function inspectProposedPlans(page) {
  return page.evaluate(() => {
    const visible = element => {
      if (!element) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) !== 0 && rect.width > 0 && rect.height > 0;
    };
    const panel = document.querySelector('#p-best');
    const details = panel && Array.from(panel.querySelectorAll('details'))
      .find(element => /Plans proposés/i.test(element.querySelector('summary')?.innerText || ''));
    const summary = details?.querySelector('summary') || null;
    const meta = document.querySelector('#engHistMeta-best');
    const body = document.querySelector('#engHistBody-best');
    const rows = body ? Array.from(body.querySelectorAll('tbody tr')).filter(visible) : [];
    const rowStates = rows.map(row => row.lastElementChild?.innerText.replace(/\s+/g, ' ').trim() || '');
    const text = details ? details.innerText.replace(/\s+/g, ' ').trim() : '';
    return {
      visible: visible(details),
      open: Boolean(details?.open),
      summary: summary ? summary.innerText.replace(/\s+/g, ' ').trim() : '',
      meta: meta ? meta.innerText.replace(/\s+/g, ' ').trim() : '',
      text,
      rowCount: rows.length,
      rowStates,
      nonExecutedBadges: details
        ? Array.from(details.querySelectorAll('.pill')).filter(visible)
          .filter(element => /NON EXÉCUTÉ/i.test(element.innerText)).length
        : 0,
      forbiddenCopy: text.match(/\bmoteur\b|\bmcp\b|\bordres?\b/gi) || [],
    };
  });
}

async function inspectTimeMachine(page) {
  return page.evaluate(async () => {
    const response = await fetch('/scanner/status/history/dates.json?browser-test=1');
    const dates = await response.json();
    const slider = document.getElementById('timeSlider');
    return {
      dates,
      sliderMin: slider ? Number(slider.min) : null,
      sliderMax: slider ? Number(slider.max) : null,
    };
  });
}

async function inspectLegacy(page, mode) {
  return page.evaluate(currentMode => {
    const visible = element => {
      if (!element) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) !== 0 && rect.width > 0 && rect.height > 0;
    };
    const panel = document.querySelector(`#p-${currentMode}`);
    const tab = document.querySelector(`.mode-tab[data-mode="${currentMode}"]`);
    const text = panel ? panel.innerText.replace(/\s+/g, ' ').trim() : '';
    const pitCards = panel
      ? Array.from(panel.querySelectorAll('[data-section="performance-unavailable"][data-accounting-certified="false"]')).filter(visible)
      : [];
    const forbiddenSections = panel
      ? Array.from(panel.querySelectorAll('.perf-hero,.perf-chart,[data-section="positions"],[data-section="orders"],[data-section="closenow"],details summary .fa-clock-rotate-left'))
        .filter(element => {
          if (!visible(element)) return false;
          if (element.matches('.fa-clock-rotate-left')) return Boolean(element.closest(`#sec-hist-${currentMode}`));
          return true;
        })
        .map(element => element.matches('.fa-clock-rotate-left') ? `#sec-hist-${currentMode}` : (element.id ? `#${element.id}` : element.className || element.dataset.section || element.tagName))
      : [];
    const actionPills = panel
      ? Array.from(panel.querySelectorAll('.pill')).filter(visible)
        .map(element => element.textContent.replace(/\s+/g, ' ').trim())
        .filter(label => /^(BUY|CLOSE|ROTATE|FILLED|EXECUTED)$/i.test(label))
      : [];
    const idea = panel && panel.querySelector('[data-section="simulation-ideas"]');
    const englishUiTokens = [
      /\bDashboard\b/, /How to trade/, /Today's Signals/, /Last Session Signals/,
      /Full scan/, /Fallback candidates/, /Market (?:Open|Closed)/,
      /No open positions/, /\bSnapshot\b/, /No signals published/,
      /Existing positions remain active/,
    ].filter(pattern => pattern.test(text)).map(pattern => pattern.source);
    return {
      panelVisible: visible(panel),
      panelScope: panel ? panel.dataset.performanceScope : null,
      executionVerified: panel ? panel.dataset.executionVerified : null,
      tabActive: Boolean(tab && tab.classList.contains('active') && tab.getAttribute('aria-selected') === 'true'),
      pitCardCount: pitCards.length,
      pitText: pitCards[0] ? pitCards[0].innerText.replace(/\s+/g, ' ').trim() : '',
      forbiddenTokens: text.match(/(?:null\s*%|undefined|NaN\s*%)/gi) || [],
      forbiddenSections,
      actionPills,
      ideaVisible: visible(idea),
      ideaActionable: idea ? idea.dataset.actionable : null,
      ideaText: idea ? idea.innerText.replace(/\s+/g, ' ').trim() : '',
      englishUiTokens,
    };
  }, mode);
}

async function inspectHomeLink(page) {
  return page.evaluate(() => {
    const visible = element => {
      if (!element) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const links = Array.from(document.querySelectorAll('a[href="/scanner/status/#best"]'));
    const link = links.find(visible) || links[0] || null;
    return {
      count: links.length,
      visible: visible(link),
      text: link ? link.textContent.replace(/\s+/g, ' ').trim() : '',
      insideScannerTab: Boolean(link && link.closest('#tab-scanner')),
    };
  });
}

function pushCheck(failures, condition, message) {
  if (!condition) failures.push(message);
}

async function main() {
  const executablePath = browserExecutable();
  if (!executablePath) throw new Error('Chrome système introuvable (définir CHROME_PATH si nécessaire)');
  const statusPath = path.join(ROOT, 'scanner', 'status', 'index.html');
  if (!fs.existsSync(statusPath)) throw new Error(`Rendu absent: ${statusPath}`);

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
      const page = await createPage(browser, origin, viewport);
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      try {
        await page.goto(`${origin}/scanner/status/#best`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForSelector('#p-best', { visible: true, timeout: 10000 });
        await settle(page);

        const best = await inspectBest(page);
        pushCheck(failures, best.lang === 'fr', `${viewport.name} #best: <html lang="fr"> absent`);
        pushCheck(failures, best.panelVisible, `${viewport.name} #best: panneau DTX masqué`);
        pushCheck(failures, best.panelScope === 'forward_execution', `${viewport.name} #best: scope ${best.panelScope || 'absent'} au lieu de forward_execution`);
        pushCheck(failures, best.executionVerified === 'false', `${viewport.name} #best: execution_verified doit rester false`);
        pushCheck(failures, best.tabActive && /DTX Max/.test(best.tabText), `${viewport.name} #best: onglet actif DTX Max absent`);
        pushCheck(failures, best.referenceVisible && /Courbe de référence/i.test(best.referenceText), `${viewport.name} #best: référence historique identifiable absente`);
        pushCheck(failures, /simulation|historique|backtest/i.test(best.referenceText) && /pas un suivi réel|pas une performance réelle|référence/i.test(best.referenceText), `${viewport.name} #best: la référence n'est pas explicitement non-live`);
        pushCheck(failures, best.forwardVisible && /Suivi réel/i.test(best.forwardText) && /non démarré/i.test(best.forwardText), `${viewport.name} #best: suivi réel non démarré absent`);
        pushCheck(failures, /Aucune exécution certifiée/i.test(best.forwardText), `${viewport.name} #best: absence d'exécution certifiée non déclarée`);
        pushCheck(failures, /Aucun plan certifié/i.test(best.currentPlanText) && /NON EXÉCUTÉ/i.test(best.currentPlanText), `${viewport.name} #best: retrait du plan courant pré-frontière insuffisamment explicite`);
        pushCheck(failures, best.sectionsSeparated, `${viewport.name} #best: référence et suivi réel ne sont pas visuellement séparés`);
        pushCheck(failures, best.visiblePositionSections === 0, `${viewport.name} #best: section de positions visible sans ledger certifié`);
        pushCheck(failures, best.actionPills.length === 0, `${viewport.name} #best: faux état d'exécution visible (${best.actionPills.join(', ')})`);
        pushCheck(failures, best.falseExecutionHeading.length === 0, `${viewport.name} #best: heading d'exécution trompeur (${best.falseExecutionHeading.join(', ')})`);
        pushCheck(failures, !best.ambiguousShareLabel, `${viewport.name} #best: quantité ambiguë libellée « action(s) »`);
        pushCheck(failures, !best.preBoundarySymbolVisible, `${viewport.name} #best: SNDK pré-frontière visible dans le panneau courant`);

        await page.evaluate(() => {
          const details = Array.from(document.querySelectorAll('#p-best details'))
            .find(element => /Plans proposés/i.test(element.querySelector('summary')?.innerText || ''));
          if (details) details.open = true;
          if (typeof window.engHistInit === 'function') window.engHistInit('best');
        });
        await page.waitForFunction(() => /NON EXÉCUTÉ/i.test(document.querySelector('#engHistMeta-best')?.textContent || ''), { timeout: 10000 });
        const plans = await inspectProposedPlans(page);
        pushCheck(failures, plans.visible && plans.open && /Plans proposés/i.test(plans.summary), `${viewport.name} #best: section « Plans proposés » absente`);
        pushCheck(failures, /NON EXÉCUTÉ/i.test(plans.summary) && /NON EXÉCUTÉ/i.test(plans.meta), `${viewport.name} #best: état NON EXÉCUTÉ absent du résumé ou de la séance`);
        pushCheck(failures, plans.nonExecutedBadges >= 1, `${viewport.name} #best: badge NON EXÉCUTÉ absent`);
        pushCheck(failures, plans.rowStates.every(state => /NON EXÉCUTÉ/i.test(state)), `${viewport.name} #best: une proposition n'est pas explicitement NON EXÉCUTÉE (${plans.rowStates.join(', ')})`);
        pushCheck(failures, plans.forbiddenCopy.length === 0, `${viewport.name} #best: vocabulaire trompeur/interne dans les plans (${plans.forbiddenCopy.join(', ')})`);
        pushCheck(failures, plans.rowCount === 0 && !/SNDK/i.test(plans.text), `${viewport.name} #best: proposition SNDK pré-frontière encore exposée`);
        pushCheck(failures, /historique non certifié retiré|antérieure à la frontière certifiée/i.test(plans.text), `${viewport.name} #best: retrait pré-frontière non expliqué`);

        const timeMachine = await inspectTimeMachine(page);
        pushCheck(failures, timeMachine.dates.length >= 1, `${viewport.name} Time Machine: aucune date forward publiée`);
        pushCheck(failures, timeMachine.dates.every(date => /^\d{8}$/.test(date) && date >= '20260901'), `${viewport.name} Time Machine: date pré-frontière exposée (${timeMachine.dates.join(', ')})`);
        pushCheck(failures, timeMachine.sliderMin === 0 && timeMachine.sliderMax === Math.max(0, timeMachine.dates.length - 1), `${viewport.name} Time Machine: bornes du slider incohérentes (${timeMachine.sliderMin}..${timeMachine.sliderMax})`);

        const bestLayout = await inspectViewport(page);
        pushCheck(failures, bestLayout.overflow <= 1, `${viewport.name} #best: débordement document ${bestLayout.overflow}px (${bestLayout.overflowMode})`);
        pushCheck(failures, bestLayout.outliers.length === 0, `${viewport.name} #best: éléments hors viewport ${JSON.stringify(bestLayout.outliers)}`);

        const bestCapture = `/tmp/scanner-status-browser-best-${viewport.name}.png`;
        await page.screenshot({ path: bestCapture, fullPage: true });
        captures.push(bestCapture);

        for (const mode of LEGACY_MODES) {
          await page.goto(`${origin}/scanner/status/#${mode}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await page.waitForSelector(`#p-${mode}`, { visible: true, timeout: 10000 });
          await settle(page);
          const legacy = await inspectLegacy(page, mode);
          pushCheck(failures, legacy.panelVisible && legacy.tabActive, `${viewport.name} #${mode}: panneau/onglet actif absent`);
          pushCheck(failures, legacy.panelScope === 'simulated_backtest', `${viewport.name} #${mode}: scope ${legacy.panelScope || 'absent'} au lieu de simulated_backtest`);
          pushCheck(failures, legacy.executionVerified === 'false', `${viewport.name} #${mode}: execution_verified doit rester false`);
          pushCheck(failures, legacy.pitCardCount === 1, `${viewport.name} #${mode}: ${legacy.pitCardCount} carte(s) fail-closed PIT au lieu de 1`);
          pushCheck(failures, /Suivi point-in-time remis à zéro/i.test(legacy.pitText) && /historique retiré/i.test(legacy.pitText), `${viewport.name} #${mode}: copy frontière forward/retrait historique incomplète`);
          pushCheck(failures, legacy.forbiddenTokens.length === 0, `${viewport.name} #${mode}: token invalide visible (${legacy.forbiddenTokens.join(', ')})`);
          pushCheck(failures, legacy.forbiddenSections.length === 0, `${viewport.name} #${mode}: sections interdites visibles (${legacy.forbiddenSections.join(', ')})`);
          pushCheck(failures, legacy.actionPills.length === 0, `${viewport.name} #${mode}: action simulée présentée comme réelle (${legacy.actionPills.join(', ')})`);
          pushCheck(failures, legacy.ideaVisible && legacy.ideaActionable === 'false' && /aucun ordre à placer/i.test(legacy.ideaText), `${viewport.name} #${mode}: garde-fou « idées simulées / aucun ordre » absent`);
          pushCheck(failures, legacy.englishUiTokens.length === 0, `${viewport.name} #${mode}: chaînes UI anglaises visibles (${legacy.englishUiTokens.join(', ')})`);

          const legacyLayout = await inspectViewport(page);
          pushCheck(failures, legacyLayout.overflow <= 1, `${viewport.name} #${mode}: débordement document ${legacyLayout.overflow}px (${legacyLayout.overflowMode})`);
          pushCheck(failures, legacyLayout.outliers.length === 0, `${viewport.name} #${mode}: éléments hors viewport ${JSON.stringify(legacyLayout.outliers)}`);

          if (mode === 'turbo') {
            const pitCapture = `/tmp/scanner-status-browser-pit-${viewport.name}.png`;
            await page.screenshot({ path: pitCapture, fullPage: true });
            captures.push(pitCapture);
          }

        }

        await page.goto(`${origin}/?tab=scanner`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForSelector('a[href="/scanner/status/#best"]', { timeout: 10000 });
        await settle(page);
        const home = await inspectHomeLink(page);
        pushCheck(failures, home.count >= 1 && home.visible && home.insideScannerTab, `${viewport.name} home scanner: lien visible vers /scanner/status/#best absent`);
        pushCheck(failures, /DTX Max|Voir le Scan/i.test(home.text), `${viewport.name} home scanner: libellé du lien inattendu « ${home.text} »`);
      } finally {
        if (pageErrors.length) failures.push(`${viewport.name}: erreur(s) JavaScript navigateur: ${pageErrors.join(' | ')}`);
        await page.close();
      }
    }
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }

  if (failures.length) {
    console.error(`FAIL scanner/status browser UX (${failures.length})`);
    failures.forEach(failure => console.error(`- ${failure}`));
    if (captures.length) console.error(`Captures: ${captures.join(', ')}`);
    process.exit(1);
  }
  console.log(`PASS scanner/status browser UX: DTX Max + 4 modes PIT + home, desktop/mobile, Chrome système (${path.basename(executablePath)})`);
  console.log(`Captures: ${captures.join(', ')}`);
}

main().catch(error => {
  console.error(`FAIL scanner/status browser UX: ${error.stack || error.message}`);
  process.exit(1);
});
