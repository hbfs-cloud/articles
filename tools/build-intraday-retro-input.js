#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validateCollectedArtifact } = require('./lib/evidence-gates');
const { expectedRthTimes, newYorkDateTime } = require('./lib/retro-intraday');
const ROOT = path.resolve(__dirname, '..');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const rthTimes = new Set(expectedRthTimes);

function toIsoTimestamp(timestamp) {
  if (typeof timestamp === 'number') {
    const date = new Date(timestamp > 1e12 ? timestamp : timestamp * 1000);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }
  if (typeof timestamp !== 'string' || !Number.isFinite(Date.parse(timestamp))) return null;
  return timestamp;
}
function normalizedBar(raw, ticker) {
  const row = Array.isArray(raw) ? { timestamp: raw[0], open: raw[1], high: raw[2], low: raw[3], close: raw[4], volume: raw[5] } : raw;
  const timestamp = row && toIsoTimestamp(row.timestamp || row.datetime || row.time || row.date);
  if (!timestamp || ![row.open, row.high, row.low, row.close].every(Number.isFinite)
    || row.open <= 0 || row.low <= 0 || row.high < row.low) return null;
  const ny = newYorkDateTime(timestamp);
  if (!ny) return null;
  const isUsSessionContract = !ticker.includes('.');
  if (isUsSessionContract && !rthTimes.has(ny.time)) return null;
  return {
    date: isUsSessionContract ? ny.date : new Date(timestamp).toISOString().slice(0, 10),
    bar: { timestamp, open: row.open, high: row.high, low: row.low, close: row.close, volume: row.volume ?? null }
  };
}
function collect(value, inheritedTicker = null, output = []) {
  if (!value || typeof value !== 'object') return output;
  const ticker = String(value.ticker || value.symbol || inheritedTicker || '').toUpperCase();
  const series = Array.isArray(value.bars) ? value.bars : Array.isArray(value.data) && value.data.every(Array.isArray) ? value.data : null;
  if (ticker && series) {
    for (const raw of series) {
      const normalized = normalizedBar(raw, ticker);
      if (normalized) output.push({ ...normalized, ticker });
    }
  }
  for (const [key, child] of Object.entries(value)) if (key !== 'bars' && key !== 'data') collect(child, ticker || inheritedTicker, output);
  if (!series && value.data && typeof value.data === 'object') collect(value.data, ticker || inheritedTicker, output);
  return output;
}
function build(input, existing = { sessions: {} }, sourceArtifact = null) {
  const sessions = existing && existing.sessions || {};
  for (const { date, ticker, bar } of collect(input)) {
    sessions[date] ||= {};
    sessions[date][ticker] ||= [];
    sessions[date][ticker].push(bar);
  }
  for (const tickers of Object.values(sessions)) for (const [ticker, bars] of Object.entries(tickers)) {
    tickers[ticker] = [...new Map(bars.map(bar => [bar.timestamp, bar])).values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }
  const sourceArtifacts = [...(existing.source_artifacts || [])];
  if (sourceArtifact && !sourceArtifacts.some(source => source.path === sourceArtifact.path && source.sha256 === sourceArtifact.sha256)) sourceArtifacts.push(sourceArtifact);
  return { schema_version: 1, generated_at: new Date().toISOString(), source_artifacts: sourceArtifacts, sessions };
}
if (require.main === module) {
  const arg = name => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null; };
  const inputPath = arg('--in'); const outputPath = arg('--out'); const referenceClose = arg('--reference-close');
  if (!inputPath || !outputPath || !/^20\d{2}-\d{2}-\d{2}$/.test(String(referenceClose || ''))) { console.error('Usage: build-intraday-retro-input.js --in bars_intraday.json --out intraday-bars-15m.json --reference-close YYYY-MM-DD [--append]'); process.exit(2); }
  const inputBytes = fs.readFileSync(inputPath);
  const inputHash = sha256(inputBytes);
  const provenanceErrors = validateCollectedArtifact(path.resolve(inputPath), inputHash, referenceClose, ROOT);
  if (provenanceErrors.length) { console.error(`Input intraday collector provenance invalid: ${provenanceErrors.join('; ')}`); process.exit(1); }
  const input = JSON.parse(inputBytes);
  const existing = process.argv.includes('--append') && fs.existsSync(outputPath) ? JSON.parse(fs.readFileSync(outputPath, 'utf8')) : { sessions: {} };
  const result = build(input, existing, { path: path.relative(ROOT, path.resolve(inputPath)), sha256: inputHash, reference_close: referenceClose });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const temp = `${outputPath}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(result, null, 2) + '\n');
  fs.renameSync(temp, outputPath);
  console.log(`${outputPath}: ${Object.keys(result.sessions).length} session(s)`);
}
module.exports = { build, collect };
