#!/usr/bin/env node
'use strict';
/**
 * set-signal-origin.js — déclare l'ORIGINE DES SIGNAUX d'un mode dans data/modes-config.json.
 *
 * POURQUOI (R9, 2026-08-12). `gen-status-page.js` classait les modes en LLM / Scripted / Engine en
 * DEVINANT : `assetClass === 'dtx'` → engine, sinon appartenance à une liste fermée de 7 `filterName`
 * → scripted, sinon LLM. Une liste fermée a un défaut, et les deux défauts possibles sont faux : un
 * mode scripté portant un `filterName` neuf serait affiché « LLM », et rien dans la config ne permet
 * de le rattraper. L'origine des signaux est une propriété DÉCLARÉE du mode, pas une inférence sur un
 * nom de filtre — d'où le champ `signalOrigin`.
 *
 *   llm      — sélection rédigée par l'agent (les 4 modes scanner : turbo/dynamic/balanced/fortress)
 *   scripted — sélection produite par un scanner déterministe (candlestick, momentum_rotation, …)
 *   engine   — décisions servies par le moteur dtx (assetClass 'dtx')
 *
 * Usage :
 *   node tools/set-signal-origin.js --mode best --to engine
 *   node tools/set-signal-origin.js --list
 *
 * Écriture atomique (tmp + rename), formatage 2 espaces préservé (round-trip vérifié).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CFG_PATH = path.join(ROOT, 'data', 'modes-config.json');
const ORIGINS = ['llm', 'scripted', 'engine'];

function parseArgs(argv) {
  const o = { mode: null, to: null, list: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--mode') o.mode = argv[++i];
    else if (a === '--to') o.to = argv[++i];
    else if (a === '--list') o.list = true;
  }
  return o;
}

function load() {
  return JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
}

function main() {
  const opts = parseArgs(process.argv);
  const cfg = load();
  const modes = cfg.modes || {};

  if (opts.list || (!opts.mode && !opts.to)) {
    for (const [id, m] of Object.entries(modes)) {
      const declared = ORIGINS.includes(m.signalOrigin) ? m.signalOrigin : null;
      console.log(`${id.padEnd(12)} signalOrigin: ${declared || '— NON DÉCLARÉ (gen-status-page devine et le signale)'}`);
    }
    process.exit(0);
  }

  if (!opts.mode || !opts.to) {
    console.error('Usage: node tools/set-signal-origin.js --mode <id> --to <llm|scripted|engine>   |   --list');
    process.exit(2);
  }
  if (!modes[opts.mode]) {
    console.error(`❌ mode inconnu: ${opts.mode} (connus: ${Object.keys(modes).join(', ')})`);
    process.exit(2);
  }
  if (!ORIGINS.includes(opts.to)) {
    console.error(`❌ origine invalide: ${opts.to} (valeurs: ${ORIGINS.join(' | ')})`);
    process.exit(2);
  }
  // Garde-fou : un mode dtx est SERVI par le moteur — l'étiqueter autrement mentirait sur la
  // provenance de ses ordres, qui ne sont ni rédigés ni scriptés ici.
  if (modes[opts.mode].assetClass === 'dtx' && opts.to !== 'engine') {
    console.error(`❌ ${opts.mode} a assetClass:'dtx' — ses signaux viennent du moteur, signalOrigin ne peut être que 'engine'.`);
    process.exit(2);
  }

  const prev = modes[opts.mode].signalOrigin;
  if (prev === opts.to) {
    console.log(`${opts.mode}: signalOrigin déjà '${opts.to}' — rien à faire.`);
    process.exit(0);
  }
  modes[opts.mode].signalOrigin = opts.to;

  const tmp = `${CFG_PATH}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, CFG_PATH);
  console.log(`✅ ${opts.mode}: signalOrigin ${prev || '—'} → ${opts.to}`);
}

main();
