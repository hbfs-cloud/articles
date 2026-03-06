/**
 * add_langs.js — Add data-lang attributes to all cards in JSON data files
 *
 * Scans each card's href, reads the article file to get <html lang="...">,
 * checks for variant subdirectories (en/, ar/, beginner/en/, expert/en/, etc.),
 * and adds data-lang="fr,en,ar" to the card's root div.
 *
 * Usage: node tools/add_langs.js
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../data');
const ROOT = path.resolve(__dirname, '..');
const JSON_FILES = ['analyses.json', 'daily.json', 'weekly.json', 'scanner.json', 'tech.json', 'series.json'];

function detectLangs(articleDir) {
  const langs = new Set();

  // 1. Check variants.json if it exists
  const variantsPath = path.join(articleDir, 'variants.json');
  if (fs.existsSync(variantsPath)) {
    try {
      const variants = JSON.parse(fs.readFileSync(variantsPath, 'utf8'));
      if (variants.variants) {
        variants.variants.forEach(v => {
          if (v.lang) langs.add(v.lang);
        });
      }
      if (langs.size > 0) return Array.from(langs).sort();
    } catch (e) { /* ignore */ }
  }

  // 2. Check <html lang="..."> on the main index.html
  const indexPath = path.join(articleDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    const html = fs.readFileSync(indexPath, 'utf8').substring(0, 500);
    const langMatch = html.match(/lang="([a-z]{2})"/);
    if (langMatch) langs.add(langMatch[1]);
  }

  // 3. Check for language subdirectories
  const langDirs = ['en', 'fr', 'ar', 'es', 'zh'];
  const levelDirs = ['beginner', 'expert'];

  for (const lang of langDirs) {
    // Direct: article/en/index.html
    if (fs.existsSync(path.join(articleDir, lang, 'index.html'))) {
      langs.add(lang);
    }
    // Via level: article/beginner/en/index.html or article/expert/en/index.html
    for (const level of levelDirs) {
      if (fs.existsSync(path.join(articleDir, level, lang, 'index.html'))) {
        langs.add(lang);
      }
    }
  }

  // 4. Default to 'fr' if nothing detected
  if (langs.size === 0) langs.add('fr');

  return Array.from(langs).sort();
}

function extractHref(cardHtml) {
  // Extract href from the card — look for the main article link
  const hrefMatch = cardHtml.match(/href="([^"]+)"/);
  if (!hrefMatch) return null;
  return hrefMatch[1];
}

function hrefToDir(href) {
  // Convert href like /analyses/AAPL/ or /daily/20260305/ to filesystem path
  let p = href.replace(/^\//, '');
  if (p.endsWith('/')) p = p.slice(0, -1);
  return path.join(ROOT, p);
}

function addDataLang(cardHtml, langs) {
  const langStr = langs.join(',');

  // If data-lang already exists, update it
  if (/data-lang="[^"]*"/.test(cardHtml)) {
    return cardHtml.replace(/data-lang="[^"]*"/, `data-lang="${langStr}"`);
  }

  // Add data-lang after the opening <div class="report-card"
  // Pattern: <div class="report-card" data-grade="..." data-tags="..."
  return cardHtml.replace(
    /(<div\s+class="report-card")/,
    `$1 data-lang="${langStr}"`
  );
}

let totalCards = 0;
let updatedCards = 0;

for (const jsonFile of JSON_FILES) {
  const filePath = path.join(DATA_DIR, jsonFile);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${jsonFile} (not found)`);
    continue;
  }

  const cards = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  console.log(`\nProcessing ${jsonFile} (${cards.length} cards)...`);

  const updatedCardsArr = cards.map((card, i) => {
    totalCards++;
    const href = extractHref(card);
    if (!href) {
      console.log(`  [${i}] No href found, skipping`);
      return card;
    }

    const dir = hrefToDir(href);
    if (!fs.existsSync(dir)) {
      // Try as file path instead of directory
      const dirAlt = path.dirname(path.join(ROOT, href.replace(/^\//, '')));
      if (!fs.existsSync(dirAlt)) {
        console.log(`  [${i}] Dir not found: ${dir}, defaulting to fr`);
        updatedCards++;
        return addDataLang(card, ['fr']);
      }
    }

    const articleDir = fs.existsSync(dir) && fs.statSync(dir).isDirectory() ? dir : path.dirname(dir);
    const langs = detectLangs(articleDir);
    updatedCards++;
    return addDataLang(card, langs);
  });

  fs.writeFileSync(filePath, JSON.stringify(updatedCardsArr, null, 2));
  console.log(`  Updated ${jsonFile}`);
}

console.log(`\nDone: ${updatedCards}/${totalCards} cards updated with data-lang.`);
