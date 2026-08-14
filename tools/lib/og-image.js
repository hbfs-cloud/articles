'use strict';
// og-image.js — CHANTIER 2 : sélection automatique de l'image og:image / twitter:image.
//
// Ordre de résolution (spec) :
//   1. PNG/JPG déjà présent dans le dossier de l'article (ex: analyses/CSGP/*.png)
//   2. Carte PNG générique par type de contenu (aujourd'hui : scanner → dernier
//      scanner/status/daily-card-*.png)
//   3. Fallback ultime : /logo.svg
// Toujours renvoyé en URL absolue (https://articles.dailytickers.com/...) — requis
// par les crawlers OG/Twitter qui ne résolvent pas les chemins relatifs.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SITE_BASE = 'https://articles.dailytickers.com';
const LOGO_FALLBACK = `${SITE_BASE}/logo.svg`;

const IMAGE_EXT_RE = /\.(png|jpe?g)$/i;

function toAbsoluteUrl(relFromRoot) {
  const clean = String(relFromRoot).replace(/^\.?\/+/, '').split(path.sep).join('/');
  return `${SITE_BASE}/${clean}`;
}

// Liste les images (png/jpg) d'un dossier (non récursif), triées par mtime desc.
function listImages(absDir) {
  if (!absDir) return [];
  let entries;
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch (e) {
    return [];
  }
  return entries
    .filter(e => e.isFile() && IMAGE_EXT_RE.test(e.name))
    .map(e => {
      const full = path.join(absDir, e.name);
      let mtimeMs = 0;
      try { mtimeMs = fs.statSync(full).mtimeMs; } catch (e2) { /* ignore */ }
      return { name: e.name, full, mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

// Cartes génériques par type de contenu. "scanner" a une carte dédiée (générée
// par tools/generate-scanner-image.js → scanner/status/). "analyses" retombe sur
// le logo boursier par ticker (assets.parqet.com) quand un ticker réel est connu
// — comportement préexistant de render-analysis.js, conservé pour ne pas
// dégrader les analyses mono-valeur (CSGP, XLE, ...) vers un simple /logo.svg.
// Étendre cette map si un autre type (daily, weekly, ...) obtient sa propre
// carte générique un jour.
const GENERIC_BY_TYPE = {
  scanner() {
    // Cible canonique (cf. tools/generate-scanner-image.js) : /scanner-daily-card.png
    // à la racine est réécrasé à CHAQUE génération de carte scanner — c'est le fix de
    // l'incident "aperçu Telegram/WhatsApp figé sur une carte périmée" (le fichier
    // n'était mis à jour que par les copies datées de scanner/status/). Toujours
    // préférer ce chemin evergreen ; les daily-card-<ts>.png de scanner/status/ ne
    // servent qu'au cache-busting du dashboard et sont un filet de secours si jamais
    // le fichier racine n'existe pas encore.
    const rootCard = path.join(ROOT, 'scanner-daily-card.png');
    if (fs.existsSync(rootCard)) return toAbsoluteUrl('scanner-daily-card.png');
    const statusDir = path.join(ROOT, 'scanner', 'status');
    const cards = listImages(statusDir).filter(f => /^daily-card-/i.test(f.name));
    if (cards.length) return toAbsoluteUrl(path.relative(ROOT, cards[0].full));
    return null;
  },
  analyses(ctx) {
    if (ctx && ctx.ticker) {
      return `https://assets.parqet.com/logos/symbol/${ctx.ticker}?format=jpg`;
    }
    return null;
  },
};

/**
 * pickOgImage({ articleDir, type, ticker })
 *
 * @param {string} [articleDir] - Chemin (absolu, ou relatif à la racine du repo) du
 *   dossier de l'article publié, ex: "analyses/CSGP" ou "scanner/20260814".
 * @param {string} [type] - Type de contenu ("scanner" | "analyses" | "daily" |
 *   "weekly" | "series" | "tech" | ...). Utilisé uniquement pour choisir la carte
 *   générique si aucun visuel local n'existe.
 * @param {string} [ticker] - Ticker de l'article (analyses mono-valeur), utilisé
 *   par la carte générique "analyses".
 * @returns {{ url: string, source: 'local'|'generic'|'fallback' }}
 */
function pickOgImage(opts) {
  const { articleDir, type, ticker } = opts || {};

  if (articleDir) {
    const absDir = path.isAbsolute(articleDir) ? articleDir : path.join(ROOT, articleDir);
    const local = listImages(absDir);
    if (local.length) {
      return { url: toAbsoluteUrl(path.relative(ROOT, local[0].full)), source: 'local' };
    }
  }

  const genericFn = type && GENERIC_BY_TYPE[type];
  if (genericFn) {
    const generic = genericFn({ ticker });
    if (generic) return { url: generic, source: 'generic' };
  }

  return { url: LOGO_FALLBACK, source: 'fallback' };
}

module.exports = { pickOgImage, toAbsoluteUrl, SITE_BASE, LOGO_FALLBACK };
