#!/usr/bin/env node
/**
 * backfill-og.js — CHANTIER 2 (og:image auto) : backfill léger, exécution unique.
 *
 * Ajoute les balises manquantes <meta property="og:image">,
 * <meta name="twitter:card" content="summary_large_image"> et
 * <meta name="twitter:image"> aux articles publiés récemment qui n'ont pas encore
 * été (re-)rendus avec le helper tools/lib/og-image.js.
 *
 * Comportement volontairement conservateur (backfill LÉGER) :
 *   - Ne touche QUE les balises manquantes. Un og:image déjà présent (même s'il
 *     pointe vers une carte scanner générique sur un article "analyses") n'est
 *     JAMAIS écrasé — on ne veut pas régresser un visuel qui fonctionne déjà.
 *   - Idempotent : ré-exécuter le script sur un fichier déjà backfillé ne change
 *     rien (0 balise ajoutée).
 *
 * Usage :
 *   node tools/backfill-og.js                # cible la liste par défaut ci-dessous
 *   node tools/backfill-og.js daily/20260813 analyses/CSGP   # cible explicite
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { pickOgImage } = require('./lib/og-image.js');

const ROOT = path.resolve(__dirname, '..');

// Liste par défaut : articles publiés cette semaine (chantier 2, backfill unique).
const DEFAULT_TARGETS = [
  'scanner/20260813',
  'scanner/20260814',
  'daily/20260813',
  'analyses/SECTEUR-XLE-20260814',
  'analyses/GROUPE-CAS-DU-JOUR-20260814',
  'analyses/GROUPE-HAUT-RISQUE-20260814',
  'analyses/GROUPE-MINEURS-IA-20260814',
  'analyses/GROUPE-PELLES-IA-20260814',
  'analyses/GROUPE-SAAS-20260814',
  'analyses/CSGP',
  'analyses/SQUEEZE-20260814',
  'analyses/EARNINGS-20260814',
  'analyses/aplus-20260814',
];

function typeFromPath(relDir) {
  const top = relDir.split('/')[0];
  return top; // 'scanner' | 'daily' | 'analyses' | 'weekly' | 'series' | 'tech'
}

function detectIndent(html) {
  const m = html.match(/\n([ \t]*)<meta\s+name=["']viewport["']/i);
  return m ? m[1] : '  ';
}

function backfillFile(relDir) {
  const absDir = path.join(ROOT, relDir);
  const htmlPath = path.join(absDir, 'index.html');
  if (!fs.existsSync(htmlPath)) {
    return { relDir, skipped: true, reason: 'no index.html' };
  }

  const original = fs.readFileSync(htmlPath, 'utf8');
  let html = original;

  const type = typeFromPath(relDir);
  const hasOgImage = /<meta\s+property=["']og:image["']/i.test(html);
  const hasTwitterCard = /<meta\s+name=["']twitter:card["']/i.test(html);
  const hasTwitterImage = /<meta\s+(?:name|property)=["']twitter:image["']/i.test(html);

  const added = [];
  let imageUrl = null;
  let imageSource = 'existing';

  if (!hasOgImage) {
    const picked = pickOgImage({ articleDir: absDir, type });
    imageUrl = picked.url;
    imageSource = picked.source;
  } else {
    const m = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    imageUrl = m ? m[1] : pickOgImage({ articleDir: absDir, type }).url;
  }

  const indent = detectIndent(html);
  const newTags = [];
  if (!hasOgImage) {
    newTags.push(`${indent}<meta property="og:image" content="${imageUrl}">`);
    added.push('og:image');
  }
  if (!hasTwitterCard) {
    newTags.push(`${indent}<meta name="twitter:card" content="summary_large_image">`);
    added.push('twitter:card');
  }
  if (!hasTwitterImage) {
    newTags.push(`${indent}<meta name="twitter:image" content="${imageUrl}">`);
    added.push('twitter:image');
  }

  if (newTags.length === 0) {
    return { relDir, skipped: true, reason: 'already complete', image: imageUrl };
  }

  const headCloseRe = /<\/head>/i;
  if (!headCloseRe.test(html)) {
    return { relDir, skipped: true, reason: 'no </head> found' };
  }
  html = html.replace(headCloseRe, `${newTags.join('\n')}\n</head>`);

  fs.writeFileSync(htmlPath, html, 'utf8');
  return { relDir, skipped: false, added, image: imageUrl, source: imageSource };
}

function main() {
  const argv = process.argv.slice(2);
  const targets = argv.length ? argv : DEFAULT_TARGETS;

  console.log(`[backfill-og] ${targets.length} article(s) ciblé(s)\n`);

  const results = targets.map(backfillFile);

  for (const r of results) {
    if (r.skipped) {
      console.log(`  – SKIP  ${r.relDir}  (${r.reason})`);
    } else {
      console.log(`  + OK    ${r.relDir}  added=[${r.added.join(', ')}]  image=${r.image} (${r.source})`);
    }
  }

  const changed = results.filter(r => !r.skipped).length;
  console.log(`\n[backfill-og] ${changed}/${targets.length} fichier(s) modifié(s).`);
}

main();
