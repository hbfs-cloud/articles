#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validateCollectedArtifact } = require('./lib/evidence-gates');
const ROOT = path.resolve(__dirname, '..');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function nyDate(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function collect(value, inheritedTicker = null, output = []) {
  if (!value || typeof value !== 'object') return output;
  const ticker = String(value.ticker || value.symbol || inheritedTicker || '').toUpperCase();
  if (ticker && Array.isArray(value.bars)) {
    for (const raw of value.bars) {
      const row = Array.isArray(raw) ? { timestamp: raw[0], open: raw[1], high: raw[2], low: raw[3], close: raw[4], volume: raw[5] } : raw;
      const timestamp = row && (row.timestamp || row.datetime || row.time || row.date);
      const isoTimestamp = typeof timestamp === 'number' ? new Date(timestamp > 1e12 ? timestamp : timestamp * 1000).toISOString() : String(timestamp || '');
      const date = nyDate(isoTimestamp);
      if (date) output.push({ date, ticker, bar: { timestamp: isoTimestamp, open: row.open, high: row.high, low: row.low, close: row.close, volume: row.volume ?? null } });
    }
  }
  for (const [key, child] of Object.entries(value)) if (key !== 'bars') collect(child, ticker || inheritedTicker, output);
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
