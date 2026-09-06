'use strict';

// Localise un navigateur utilisable pour les captures.
//
// `tools/generate-scanner-image.js` ne cherchait qu'un cache Playwright sous `/home/ci` : la
// découverte marchait sur la machine d'intégration et échouait partout ailleurs, avec un message
// de puppeteer qui parle d'installer Chrome alors qu'il est déjà là. On regarde donc, dans
// l'ordre : ce que l'environnement impose, les caches d'outillage, puis les emplacements
// d'installation du système.

const fs = require('fs');
const path = require('path');
const os = require('os');

function fromPlaywrightCache(base) {
  if (!fs.existsSync(base)) return null;
  const dirs = fs.readdirSync(base).filter(d => d.startsWith('chromium-')).sort().reverse();
  for (const dir of dirs) {
    for (const rel of ['chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-win/chrome.exe']) {
      const candidate = path.join(base, dir, rel);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function fromPuppeteerCache(base) {
  if (!fs.existsSync(base)) return null;
  const roots = ['chrome', 'chrome-headless-shell'].map(d => path.join(base, d)).filter(fs.existsSync);
  for (const root of roots) {
    for (const build of fs.readdirSync(root).sort().reverse()) {
      const dir = path.join(root, build);
      for (const rel of [
        'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
        'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
        'chrome-linux64/chrome', 'chrome-win64/chrome.exe',
      ]) {
        const candidate = path.join(dir, rel);
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }
  return null;
}

/** Chemin du navigateur, ou `undefined` pour laisser puppeteer se débrouiller. */
function findChrome() {
  const explicit = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH;
  if (explicit && fs.existsSync(explicit)) return explicit;

  const home = os.homedir();
  const cached = fromPlaywrightCache('/home/ci/.cache/ms-playwright')
    || fromPlaywrightCache(path.join(home, '.cache/ms-playwright'))
    || fromPuppeteerCache(path.join(home, '.cache/puppeteer'));
  if (cached) return cached;

  for (const candidate of [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
  ]) if (fs.existsSync(candidate)) return candidate;

  return undefined;
}

module.exports = { findChrome };
