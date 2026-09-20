#!/usr/bin/env node
'use strict';

/**
 * Build the editorial MarketWatch universe from canonical repository data.
 *
 * Sources:
 *   - the most recent scanner/YYYYMMDD/signals.json
 *   - data/analyses-status.json plus data/analyses-data/<TICKER>.json
 *
 * Usage:
 *   node tools/build-marketwatch-data.js
 *   node tools/build-marketwatch-data.js --check
 *   node tools/build-marketwatch-data.js --root /path/to/repo --stdout
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_ROOT = path.resolve(__dirname, '..');
const LIVE_ANALYSIS_STATUSES = new Set(['active', 'wait', 'watch', 'speculative']);
const STATUS_TAGS = {
  active: 'Analyse active',
  wait: 'En attente',
  watch: 'Sous surveillance',
  speculative: 'Spéculatif'
};
const TAG_TRANSLATIONS = {
  us: 'US', eu: 'Europe', apac: 'APAC', equities: 'Actions', stock: 'Actions', etf: 'ETF',
  'trade-idea': 'Trade idea', technology: 'Technologie', financials: 'Finance', healthcare: 'Santé',
  energy: 'Énergie', earnings: 'Résultats', dividend: 'Dividende', dividende: 'Dividende',
  crypto: 'Crypto', metals: 'Métaux', software: 'Logiciels', cybersecurity: 'Cybersécurité',
  semiconductors: 'Semi-conducteurs', semiconductor: 'Semi-conducteurs', semis: 'Semi-conducteurs',
  'semi-conducteurs': 'Semi-conducteurs', semiconducteurs: 'Semi-conducteurs', tech: 'Technologie',
  ai: 'IA', ia: 'IA', 'ai-chain': 'Chaîne IA', 'etf-factor': 'ETF factor', staples: 'Consommation défensive',
  'basic-materials': 'Matériaux', 'basic materials': 'Matériaux', biotech: 'Biotechnologie', 'clinical-stage': 'Phase clinique',
  event: 'Événement', 'financial-services': 'Services financiers', 'financial services': 'Services financiers', hardware: 'Matériel',
  industrials: 'Industrie', mining: 'Mines', 'no-trade': 'Sans trade', observed: 'Observé',
  oncology: 'Oncologie', optics: 'Optique', 'real-estate-services': 'Services immobiliers', 'real estate services': 'Services immobiliers',
  silver: 'Argent', cyber: 'Cybersécurité', 'technology / semiconductors': 'Technologie / Semi-conducteurs',
  'technologie / semiconducteurs': 'Technologie / Semi-conducteurs',
  'mines-d’argent-et-d’or': 'Mines d’or et d’argent', 'mines d’argent et d’or': 'Mines d’or et d’argent',
  'équipements-de-communication': 'Équipements de communication', 'équipements de communication': 'Équipements de communication',
  'équipements-pour-semi-conducteurs': 'Équipements semi-conducteurs', 'équipements pour semi conducteurs': 'Équipements semi-conducteurs',
  forex: 'Forex', commodity: 'Matières premières'
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function cleanTicker(value) {
  return String(value || '').trim().toUpperCase();
}

function cleanTag(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  if (TAG_TRANSLATIONS[key]) return TAG_TRANSLATIONS[key];
  return raw.replace(/[_-]+/g, ' ').split(/\s+/)
    .map(word => `${word.charAt(0).toLocaleUpperCase('fr-FR')}${word.slice(1)}`).join(' ');
}

function scanDateTag(value) {
  const raw = String(value || '');
  return /^\d{8}$/.test(raw) ? `Scan ${raw.slice(6, 8)}/${raw.slice(4, 6)}/${raw.slice(0, 4)}` : 'Dernier scan';
}

function latestScanner(root) {
  const scannerRoot = path.join(root, 'scanner');
  if (!fs.existsSync(scannerRoot)) return null;
  const candidates = fs.readdirSync(scannerRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d{8}$/.test(entry.name))
    .map(entry => ({ date: entry.name, file: path.join(scannerRoot, entry.name, 'signals.json') }))
    .filter(entry => fs.existsSync(entry.file))
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!candidates.length) return null;
  const latest = candidates[0];
  return { ...latest, data: readJson(latest.file) };
}

function marketForAnalysis(ticker, header, meta) {
  const tags = new Set((meta.tags || []).map(tag => String(tag).toLowerCase()));
  const exchange = String(header.exchange || '').toUpperCase();
  const type = String(meta.assetType || '').toLowerCase();
  if (type === 'crypto' || tags.has('crypto')) return 'CRYPTO';
  if (['forex', 'commodity', 'index'].includes(type) || /XAU|XAG|EURUSD|GOLD|SILVER|CRUDE/.test(ticker)) return 'MACRO';
  if (tags.has('apac') || /TOKYO|HONG KONG|ASX/.test(exchange)) return 'APAC';
  if (tags.has('eu') || /EURONEXT|LSE|XETRA|FRANKFURT|MILAN|SIX/.test(exchange) || /\.(LS|L|PA|DE|AS|MI)$/.test(ticker)) return 'EU';
  return 'US';
}

function automaticId(ticker, market) {
  return `${ticker.replace(/[^A-Z0-9]+/g, '_')}_${market}_AUTO`;
}

function sortedUnique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
}

function buildUniverse(root = DEFAULT_ROOT) {
  const statusFile = path.join(root, 'data', 'analyses-status.json');
  const statusData = fs.existsSync(statusFile) ? readJson(statusFile) : { entries: {}, symbol_exclusions: {} };
  const excluded = new Set((statusData.symbol_exclusions?.symbols || []).map(cleanTicker));
  const assets = new Map();

  function upsert(candidate) {
    const ticker = cleanTicker(candidate.ticker);
    if (!ticker || excluded.has(ticker)) return;
    const previous = assets.get(ticker);
    if (!previous) {
      assets.set(ticker, {
        id: automaticId(ticker, candidate.market), ticker,
        name: candidate.name || ticker, market: candidate.market,
        price: Number.isFinite(candidate.price) ? candidate.price : null,
        change: Number.isFinite(candidate.change) ? candidate.change : null,
        tags: sortedUnique(candidate.tags || []), sources: sortedUnique(candidate.sources || []),
        analysisUrl: candidate.analysisUrl || null, scannerUrl: candidate.scannerUrl || null,
        sourcePriority: candidate.sourcePriority || 0
      });
      return;
    }
    previous.name = previous.name === ticker && candidate.name ? candidate.name : previous.name;
    if (candidate.sourcePriority > previous.sourcePriority) {
      if (Number.isFinite(candidate.price)) previous.price = candidate.price;
      if (Number.isFinite(candidate.change)) previous.change = candidate.change;
    }
    previous.sourcePriority = Math.max(previous.sourcePriority, candidate.sourcePriority || 0);
    previous.tags = sortedUnique([...previous.tags, ...(candidate.tags || [])]);
    previous.sources = sortedUnique([...previous.sources, ...(candidate.sources || [])]);
    previous.analysisUrl ||= candidate.analysisUrl || null;
    previous.scannerUrl ||= candidate.scannerUrl || null;
  }

  for (const [tickerKey, entry] of Object.entries(statusData.entries || {})) {
    if (!LIVE_ANALYSIS_STATUSES.has(entry.status) || entry.hasPlan === false) continue;
    const ticker = cleanTicker(tickerKey);
    const analysisFile = path.join(root, 'data', 'analyses-data', `${ticker}.json`);
    const analysis = fs.existsSync(analysisFile) ? readJson(analysisFile) : {};
    const meta = analysis.meta || {};
    const header = analysis.header || {};
    const market = marketForAnalysis(ticker, header, meta);
    const tags = [
      'Analyse suivie', STATUS_TAGS[entry.status], entry.grade ? `Grade ${entry.grade}` : null,
      cleanTag(meta.assetType), cleanTag(header.sector), ...(meta.tags || []).map(cleanTag)
    ];
    upsert({
      ticker, name: header.name || entry.name || ticker, market,
      price: Number(header.price), change: Number(header.changePct), tags,
      sources: ['Analyses DailyTickers'], analysisUrl: `/analyses/${ticker}/`, sourcePriority: 1
    });
  }

  const scan = latestScanner(root);
  if (scan) {
    const scanData = scan.data || {};
    for (const signal of scanData.signals || []) {
      const ticker = cleanTicker(signal.ticker);
      const isEtf = String(signal.region || '').toUpperCase() === 'ETF';
      const tags = [
        'Dernier scan', scanDateTag(scanData.scanDate || scan.date), cleanTag(signal.strategy),
        cleanTag(signal.sector), isEtf ? 'ETF' : 'Actions',
        scanData.regime ? `Régime ${cleanTag(scanData.regime)}` : null
      ];
      upsert({
        ticker, name: signal.name || ticker, market: 'US', price: Number(signal.price), change: null, tags,
        sources: ['Scanner DailyTickers'], scannerUrl: `/scanner/${scan.date}/`, sourcePriority: 2
      });
    }
  }

  const outputAssets = [...assets.values()]
    .map(({ sourcePriority, ...asset }) => asset)
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
  const analysisCount = outputAssets.filter(asset => asset.sources.includes('Analyses DailyTickers')).length;
  const scannerCount = outputAssets.filter(asset => asset.sources.includes('Scanner DailyTickers')).length;

  return {
    version: 1,
    generatedFrom: {
      analysesStatusAt: statusData.generatedAt || null,
      scannerDate: scan?.data?.scanDate || scan?.date || null,
      scannerReferenceClose: scan?.data?.referenceClose || null
    },
    counts: { assets: outputAssets.length, analyses: analysisCount, scanner: scannerCount },
    assets: outputAssets
  };
}

function serialize(data) {
  return `${JSON.stringify(data, null, 2)}\n`;
}

function parseArgs(argv) {
  const valueAfter = flag => { const index = argv.indexOf(flag); return index >= 0 ? argv[index + 1] : null; };
  return {
    root: path.resolve(valueAfter('--root') || DEFAULT_ROOT),
    output: valueAfter('--output'), check: argv.includes('--check'), stdout: argv.includes('--stdout'),
    help: argv.includes('--help') || argv.includes('-h')
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log('Usage: node tools/build-marketwatch-data.js [--check] [--stdout] [--root PATH] [--output PATH]');
    return;
  }
  const outputFile = path.resolve(options.output || path.join(options.root, 'marketwatch', 'data', 'auto-universe.json'));
  const rendered = serialize(buildUniverse(options.root));
  if (options.stdout) process.stdout.write(rendered);
  if (options.check) {
    if (!fs.existsSync(outputFile) || fs.readFileSync(outputFile, 'utf8') !== rendered) {
      console.error(`MarketWatch data is stale: ${outputFile}`);
      process.exitCode = 1;
      return;
    }
    console.log(`MarketWatch data is current: ${outputFile}`);
    return;
  }
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, rendered);
  const result = JSON.parse(rendered);
  console.log(`MarketWatch: ${result.counts.assets} auto assets (${result.counts.scanner} scan, ${result.counts.analyses} analyses)`);
}

if (require.main === module) main();

module.exports = { buildUniverse, latestScanner, serialize };
