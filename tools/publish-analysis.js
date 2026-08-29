#!/usr/bin/env node
/**
 * publish-analysis.js — Universal analysis publisher
 *
 * The single entry point for ALL analysis types (stock, ETF, crypto, forex, commodity, index).
 * Orchestrates: validate JSON → render HTML → add_card → optional git commit.
 *
 * Usage:
 *   node tools/publish-analysis.js data/analyses-data/AAPL.json
 *   node tools/publish-analysis.js data/analyses-data/AAPL.json --commit
 *   node tools/publish-analysis.js data/analyses-data/AAPL.json --dry
 *   node tools/publish-analysis.js --batch data/analyses-data/AAPL.json data/analyses-data/MSFT.json
 *   node tools/publish-analysis.js --re-render          # re-render ALL from data/analyses-data/
 *   node tools/publish-analysis.js --re-render --commit  # re-render + commit
 *   node tools/publish-analysis.js --update AAPL --grade B+ --reason "R/R collapsed at spot"
 *
 * Pipeline:
 *   1. Read JSON from data/analyses-data/{TICKER}.json
 *   2. Validate against tools/lib/analysis-schema.json
 *   3. Render to analyses/{TICKER}/index.html via render-analysis.js
 *   4. Index via add_card.js
 *   5. (optional) git add + commit
 *
 * For LLM integration: the LLM produces the JSON, this script does the rest.
 */

'use strict';

const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const ROOT     = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data', 'analyses-data');
const SCHEMA   = JSON.parse(fs.readFileSync(path.join(__dirname, 'lib', 'analysis-schema.json'), 'utf8'));

// ─── Minimal validator ─────────────────────────────────────────────────────

function validate(data, schema, loc) {
  loc = loc || '';
  const errs = [];
  if (data == null) return errs;
  if (schema.required && schema.type === 'object' && typeof data === 'object') {
    for (const k of schema.required) {
      const nullable = Array.isArray(schema.properties?.[k]?.type) && schema.properties[k].type.includes('null');
      if (data[k] === undefined || (data[k] === null && !nullable)) errs.push(`${loc}.${k} is required`);
    }
  }
  if (schema.type === 'object' && schema.properties && typeof data === 'object') {
    for (const [k, sub] of Object.entries(schema.properties)) {
      if (data[k] !== undefined) errs.push(...validate(data[k], sub, `${loc}.${k}`));
    }
  }
  if (schema.type === 'array' && Array.isArray(data) && schema.items) {
    data.forEach((item, i) => errs.push(...validate(item, schema.items, `${loc}[${i}]`)));
  }
  if (Array.isArray(schema.type) && data !== null && !schema.type.includes(typeof data)) errs.push(`${loc} must be one of ${schema.type.join(', ')}`);
  if (schema.type === 'number' && typeof data !== 'number') errs.push(`${loc} must be number`);
  if (schema.type === 'string' && typeof data !== 'string') errs.push(`${loc} must be string`);
  return errs;
}

// ─── Quick update mode ─────────────────────────────────────────────────────

function quickUpdate(ticker, updates) {
  const jsonPath = path.join(DATA_DIR, `${ticker}.json`);
  if (!fs.existsSync(jsonPath)) {
    console.error(`[ERROR] No data file for ${ticker} at ${jsonPath}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  if (updates.grade) {
    data.meta.grade = updates.grade;
    console.log(`  grade: ${data.meta.grade} → ${updates.grade}`);
  }
  if (updates.price) {
    data.header.price = parseFloat(updates.price);
    console.log(`  price: → $${data.header.price}`);
  }
  if (updates.status) {
    data.meta.status = updates.status;
    console.log(`  status: → ${updates.status}`);
  }
  if (updates.reason) {
    data.meta.invalidationNote = updates.reason;
  }

  data.meta.version = (data.meta.version || 1) + 1;
  data.meta.lastMcpRefresh = new Date().toISOString();

  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`[UPDATED] ${jsonPath}`);
  return jsonPath;
}

// ─── Archive ──────────────────────────────────────────────────────────────

function archiveIfExists(ticker, nextDate) {
  const htmlPath = path.join(ROOT, 'analyses', ticker, 'index.html');
  if (!fs.existsSync(htmlPath)) return null;

  const content = fs.readFileSync(htmlPath, 'utf8');
  const dateMatch = content.match(/data-date="([^"]+)"/);
  if (dateMatch && nextDate && dateMatch[1] === nextDate) return null;
  const folderDate = dateMatch
    ? dateMatch[1].replace(/-/g, '')
    : new Date().toISOString().slice(0, 10).replace(/-/g, '');

  const archiveDir = path.join(ROOT, 'analyses', ticker, 'archive', folderDate);
  if (fs.existsSync(path.join(archiveDir, 'index.html'))) return archiveDir;

  fs.mkdirSync(archiveDir, { recursive: true });
  fs.copyFileSync(htmlPath, path.join(archiveDir, 'index.html'));
  console.log(`[ARCHIVED] ${ticker} → analyses/${ticker}/archive/${folderDate}/`);
  return archiveDir;
}

// ─── Render ────────────────────────────────────────────────────────────────

function renderFile(jsonPath, dryRun) {
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const ticker = data.header.ticker;

  const errors = validate(data, SCHEMA);
  if (errors.length) {
    console.error(`[VALIDATION] ${jsonPath}:`);
    errors.forEach(e => console.error(`  - ${e}`));
    const fatal = errors.filter(e => e.includes('is required'));
    if (fatal.length) {
      console.error(`[FATAL] ${fatal.length} required field(s) missing. Aborting.`);
      return null;
    }
  }

  if (dryRun) {
    console.log(`[DRY] ${ticker} (${data.meta.grade}) — valid, would render to analyses/${ticker}/index.html`);
    return ticker;
  }

  archiveIfExists(ticker, data.meta.date);

  try {
    execSync(`node "${path.join(__dirname, 'render-analysis.js')}" "${jsonPath}"`, { stdio: 'inherit', cwd: ROOT });
  } catch (e) {
    console.error(`[ERROR] render failed for ${ticker}: ${e.message}`);
    return null;
  }

  const htmlPath = path.join(ROOT, 'analyses', ticker, 'index.html');
  const sizeKb = (fs.statSync(htmlPath).size / 1024).toFixed(1);
  console.log(`[RENDERED] ${ticker} → analyses/${ticker}/index.html (${sizeKb}KB)`);

  return ticker;
}

// ─── Index ─────────────────────────────────────────────────────────────────

function indexTicker(ticker) {
  const htmlPath = path.join('analyses', ticker, 'index.html');
  try {
    execSync(`node "${path.join(__dirname, 'add_card.js')}" "${htmlPath}"`, { stdio: 'inherit', cwd: ROOT });
    console.log(`[INDEXED] ${ticker}`);
    return true;
  } catch (e) {
    console.error(`[ERROR] add_card failed for ${ticker}: ${e.message}`);
    return false;
  }
}

// ─── Git ───────────────────────────────────────────────────────────────────

function commitTickers(tickers, message) {
  const files = tickers.flatMap(t => {
    const base = [
      `analyses/${t}/index.html`,
      `data/analyses-data/${t}.json`
    ];
    const archiveDir = path.join(ROOT, 'analyses', t, 'archive');
    if (fs.existsSync(archiveDir)) base.push(`analyses/${t}/archive/`);
    return base;
  }).filter(f => fs.existsSync(path.join(ROOT, f)));

  files.push('data/analyses.json', 'data/search_data.js');
  if (fs.existsSync(path.join(ROOT, 'data/analyses_archive.json'))) {
    files.push('data/analyses_archive.json');
  }

  try {
    execSync(`git add ${files.join(' ')}`, { cwd: ROOT, stdio: 'inherit' });
    execSync(`git commit -m "${message}\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"`, { cwd: ROOT, stdio: 'inherit' });
    console.log(`[COMMITTED] ${tickers.join(', ')}`);
  } catch (e) {
    console.error(`[WARN] commit failed: ${e.message}`);
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter(a => a.startsWith('--')));
  const positional = args.filter(a => !a.startsWith('--'));

  const dryRun  = flags.has('--dry');
  const doCommit = flags.has('--commit');
  const reRender = flags.has('--re-render');
  const batchMode = flags.has('--batch');
  const updateMode = flags.has('--update');

  // Quick update mode: --update TICKER --grade A --price 150 --reason "..."
  if (updateMode) {
    const tickerIdx = args.indexOf('--update') + 1;
    const ticker = args[tickerIdx];
    if (!ticker || ticker.startsWith('--')) {
      console.error('Usage: --update TICKER [--grade X] [--price N] [--status X] [--reason "..."]');
      process.exit(1);
    }

    const updates = {};
    const gradeIdx = args.indexOf('--grade');
    if (gradeIdx !== -1) updates.grade = args[gradeIdx + 1];
    const priceIdx = args.indexOf('--price');
    if (priceIdx !== -1) updates.price = args[priceIdx + 1];
    const statusIdx = args.indexOf('--status');
    if (statusIdx !== -1) updates.status = args[statusIdx + 1];
    const reasonIdx = args.indexOf('--reason');
    if (reasonIdx !== -1) updates.reason = args[reasonIdx + 1];

    console.log(`[UPDATE] ${ticker}:`);
    const jsonPath = quickUpdate(ticker, updates);
    const rendered = renderFile(jsonPath, dryRun);
    if (rendered && !dryRun) {
      indexTicker(ticker);
      if (doCommit) {
        commitTickers([ticker], `fix(analyses): update ${ticker} grade to ${updates.grade || 'updated'}`);
      }
    }
    return;
  }

  // Collect JSON files
  let files;
  if (reRender) {
    if (!fs.existsSync(DATA_DIR)) {
      console.error(`Data directory not found: ${DATA_DIR}`);
      console.error('Create JSON data files in data/analyses-data/ first.');
      process.exit(1);
    }
    files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json')).map(f => path.join(DATA_DIR, f));
    console.log(`[RE-RENDER] Found ${files.length} data files in ${DATA_DIR}`);
  } else {
    files = positional.map(f => path.resolve(f));
  }

  if (!files.length) {
    console.log(`
publish-analysis.js — Universal analysis publisher

Usage:
  node tools/publish-analysis.js data/analyses-data/AAPL.json         # render + index one
  node tools/publish-analysis.js --batch FILE1.json FILE2.json        # render + index batch
  node tools/publish-analysis.js --re-render                          # re-render ALL
  node tools/publish-analysis.js --update AAPL --grade B+ --commit    # quick grade update
  node tools/publish-analysis.js FILE.json --dry                      # validate only
  node tools/publish-analysis.js FILE.json --commit                   # render + index + commit

Pipeline: validate JSON → render HTML → add_card.js → (optional) git commit
`);
    process.exit(0);
  }

  // Process
  const rendered = [];
  for (const file of files) {
    if (!fs.existsSync(file)) {
      console.error(`[ERROR] File not found: ${file}`);
      continue;
    }
    const ticker = renderFile(file, dryRun);
    if (ticker) rendered.push(ticker);
  }

  if (dryRun) {
    console.log(`\n[DRY] ${rendered.length}/${files.length} valid.`);
    return;
  }

  // Index all rendered
  const indexed = [];
  for (const ticker of rendered) {
    if (indexTicker(ticker)) indexed.push(ticker);
  }

  console.log(`\n[DONE] Rendered: ${rendered.length}, Indexed: ${indexed.length}`);

  // Commit if requested
  if (doCommit && indexed.length) {
    const msg = indexed.length === 1
      ? `feat(analyses): publish ${indexed[0]} analysis`
      : `feat(analyses): publish ${indexed.length} analyses (${indexed.join(', ')})`;
    commitTickers(indexed, msg);
  }
}

main();
