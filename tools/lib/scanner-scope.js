/** Explicit per-run authorization; never inferred from missing DTX data or environment. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { isUSTradingDay, previousUSTradingDay } = require('./market-calendar');

function loadScannerScope(root, argv = process.argv.slice(2)) {
  root = fs.realpathSync(root);
  const args = argv.filter(a => a === '--scope' || a.startsWith('--scope='));
  if (args.length > 1 || args[0] === '--scope') throw new Error('Use exactly one --scope=scanner/YYYYMMDD/_scope.json');
  let audit = null;
  let configs = {};
  if (args.length) {
    const supplied = args[0].slice('--scope='.length);
    const absolute = path.resolve(root, supplied);
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    const match = /^scanner\/(\d{8})\/_scope\.json$/.exec(relative);
    if (!match || fs.realpathSync(absolute) !== absolute) throw new Error('Scope must be the real scanner/YYYYMMDD/_scope.json in this workspace');
    const raw = fs.readFileSync(absolute);
    const doc = JSON.parse(raw);
    const date = match[1];
    const iso = date.slice(0,4) + '-' + date.slice(4,6) + '-' + date.slice(6,8);
    if (doc.date !== date || !isUSTradingDay(iso) || doc.refdate !== previousUSTradingDay(iso)) {
      throw new Error('Scope date/refdate must match its folder and the previous completed US session');
    }
    if (!Array.isArray(doc.excluded_components) || doc.excluded_components.length !== 1 || doc.excluded_components[0] !== 'dtx') {
      throw new Error('Scope may exclude exactly ["dtx"] and no other component');
    }
    if (typeof doc.user_instruction !== 'string' || !/\bdtx\b/i.test(doc.user_instruction) || !/skip|exclu|hors|sans/i.test(doc.user_instruction)) {
      throw new Error('Scope requires the explicit user instruction to exclude DTX');
    }
    if (doc.all_other_gates_required !== true) throw new Error('Scope must retain every other gate');
    configs = JSON.parse(fs.readFileSync(path.join(root, 'data/modes-config.json'), 'utf8')).modes;
    if (!configs || typeof configs !== 'object' || Array.isArray(configs)) throw new Error('Scope requires a valid modes-config catalog');
    audit = { status: 'WAIVED', component: 'dtx', date, refdate: doc.refdate,
      path: relative, sha256: crypto.createHash('sha256').update(raw).digest('hex'),
      user_instruction: doc.user_instruction, all_other_gates_required: true };
  }
  const active = audit !== null;
  const excludesMode = (id, cfg) => active && ((configs[id] || {}).assetClass === 'dtx' || (cfg || {}).assetClass === 'dtx');
  const filterModes = modes => !active ? modes : Object.fromEntries(Object.entries(modes || {}).filter(([id,cfg]) => !excludesMode(id,cfg)));
  const isDtxResultKey = key => active && Object.keys(configs).some(id => excludesMode(id) &&
    (key === 'frozen_' + id || key === 'advisor_' + id || key === 'advisor_' + id + '_relaxed'));
  const preserveDtxResults = (output, previous) => {
    if (!active) return output;
    for (const k of Object.keys(output)) if (isDtxResultKey(k)) delete output[k];
    for (const [k,v] of Object.entries(previous)) if (isDtxResultKey(k)) output[k] = v;
    return output;
  };
  return Object.freeze({ active, audit, excludesMode, filterModes, isDtxResultKey, preserveDtxResults });
}
module.exports = { loadScannerScope };
