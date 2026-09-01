#!/usr/bin/env node
'use strict';

/**
 * Parité entre l'alias public du scanner et le portefeuille DTX réellement servi.
 *
 * Le mode public (actuellement #best) est une URL stable. Il ne doit jamais être
 * confondu avec l'identité moteur portée par modes-config.dtxPortfolio. Les règles
 * de trading ne sont pas réimplémentées ici : le Contract V2 et son config_hash
 * font foi. Ce contrôle vérifie seulement le câblage, les identités et les champs
 * d'affichage qui pourraient sinon attribuer une décision à la mauvaise stratégie.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SYSTEMATIC_ROOT = path.resolve(ROOT, '..', 'systematic-tss');
const WARN_ONLY = process.argv.includes('--warn-only');

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')); }
  catch (_) { return null; }
}

function yamlScalar(text, key) {
  const m = String(text || '').match(new RegExp('^[ \\t]*(?:-[ \\t]*)?' + key + ':[ \\t]*["\\\']?([^"\\\' #\\n]+)', 'm'));
  return m ? m[1] : null;
}

function nestedRegimeValue(text, parent, child) {
  const lines = String(text || '').split('\n');
  const start = lines.findIndex(line => new RegExp('^[ \\t]*' + parent + ':[ \\t]*(?:#.*)?$').test(line));
  if (start < 0) return null;
  const base = (lines[start].match(/^[ \\t]*/) || [''])[0].length;
  for (let i = start + 1; i < lines.length; i++) {
    const indent = (lines[i].match(/^[ \\t]*/) || [''])[0].length;
    if (lines[i].trim() && indent <= base) break;
    const m = lines[i].match(new RegExp('^[ \\t]*' + child + ':[ \\t]*([0-9.]+)'));
    if (m) return Number(m[1]);
  }
  return null;
}

function eq(a, b) {
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
  return String(a) === String(b);
}

const rows = [];
function check(label, expected, actual, note = '') {
  rows.push({ label, expected, actual, ok: expected != null && actual != null && eq(expected, actual), note });
}

const catalog = readJson('data/modes-config.json');
const modes = (catalog && catalog.modes) || {};
const dtxModes = Object.entries(modes).filter(([, cfg]) => cfg && cfg.assetClass === 'dtx');

if (!dtxModes.length) {
  console.error('DRIFT: aucun mode public assetClass=dtx');
  process.exit(WARN_ONLY ? 0 : 1);
}

for (const [publicId, cfg] of dtxModes) {
  const portfolio = String(cfg.dtxPortfolio || publicId);
  const yamlPath = path.join(SYSTEMATIC_ROOT, 'config', 'dtx', `portfolio_${portfolio}.yaml`);
  let yaml = null;
  try { yaml = fs.readFileSync(yamlPath, 'utf8'); } catch (_) {}

  const staging = readJson(`data/dtx/${publicId}.json`);
  const provenance = (staging && staging.decisionProvenance) || {};

  check(`${publicId}: portefeuille YAML`, portfolio, yamlScalar(yaml, 'id'),
    fs.existsSync(SYSTEMATIC_ROOT) ? path.relative(ROOT, yamlPath) : 'systematic-tss absent');
  check(`${publicId}: staging.mode`, publicId, staging && staging.mode);
  check(`${publicId}: staging.portfolioId`, portfolio, staging && staging.portfolioId);
  check(`${publicId}: config hash Contract V2`, cfg.dtxConfigHash, staging && staging.configHash);
  check(`${publicId}: clôture décision`, staging && staging.decisionAsOf, provenance.requestedAsOf);
  check(`${publicId}: données décision`, staging && staging.decisionAsOf, provenance.dataAsOf);
  check(`${publicId}: filtre public`, 'dtx_engine', cfg.filterName);
  check(`${publicId}: modèle d'entrée`, 'dtx_contract_v2', cfg.entryModel);
  check(`${publicId}: sizing`, 'engine', cfg.sizingMethod);
  check(`${publicId}: aucun re-seuillage aval`, 0, cfg.minScore);
  check(`${publicId}: partition publique`, publicId, cfg.universeFilter);
  check(`${publicId}: capacité affichée`,
    nestedRegimeValue(yaml, 'dynamic_max_positions', 'risk_on'), cfg.portfolioSize);
  check(`${publicId}: horizon affiché`, Number(yamlScalar(yaml, 'timeout_days')), cfg.horizon);
}

const labelWidth = Math.max(8, ...rows.map(row => row.label.length));
console.log('');
console.log('Parity check — alias public ↔ identité DTX Contract V2');
console.log('='.repeat(88));
for (const row of rows) {
  const status = row.ok ? 'OK' : 'DRIFT';
  console.log(`${row.label.padEnd(labelWidth)}  ${status.padEnd(5)}  attendu=${row.expected ?? '(absent)'}  obtenu=${row.actual ?? '(absent)'}${row.note ? `  (${row.note})` : ''}`);
}

const drift = rows.filter(row => !row.ok);
console.log('-'.repeat(88));
console.log(`Total: ${rows.length} | OK: ${rows.length - drift.length} | DRIFT: ${drift.length}`);

if (drift.length && !WARN_ONLY) process.exit(1);
