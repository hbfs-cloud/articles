#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RESULTS_PATH = path.join(ROOT, 'data', 'backtest-results.json');
const shardDir = process.argv[2] || '/tmp/sweep-shards';

const files = fs.readdirSync(shardDir).filter(f => f.endsWith('.json')).sort();
if (!files.length) { console.error('No shard files found in', shardDir); process.exit(1); }

function insertTop(arr, item, compareFn, maxK = 50) {
  arr.push(item);
  arr.sort(compareFn);
  if (arr.length > maxK) arr.length = maxK;
}

const merged = {
  topBySharpe: [], topByReturn: [], topByCalmar: [], topByComposite: [],
  advTurbo: [], advDynamic: [], advBalanced: [], advSecured: [], advFortress: [], advTkl: [],
  advTurboRelaxed: [], advDynamicRelaxed: [], advBalancedRelaxed: [],
  advSecuredRelaxed: [], advFortressRelaxed: [], advTklRelaxed: [],
};
let totalTested = 0;

for (const f of files) {
  const shard = JSON.parse(fs.readFileSync(path.join(shardDir, f), 'utf8'));
  totalTested += shard.tested || 0;
  console.log(`  Shard ${shard.shard}: ${shard.tested} combos, PS=${JSON.stringify(shard.portfolioSizes)}`);
  for (const key of Object.keys(merged)) {
    const items = shard[key] || [];
    const cmp = key.includes('Fortress') || key.includes('LowestDD')
      ? (a, b) => Math.abs(a.maxDD) - Math.abs(b.maxDD)
      : key.includes('Sharpe') ? (a, b) => b.sharpe - a.sharpe
      : key.includes('Calmar') ? (a, b) => b.calmar - a.calmar
      : key.includes('Composite') ? (a, b) => b.composite - a.composite
      : (a, b) => b.returnTotal - a.returnTotal;
    for (const item of items) insertTop(merged[key], item, cmp);
  }
}

console.log(`\nMerged ${files.length} shards, ${totalTested.toLocaleString()} total combos\n`);

const existing = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf8'));
const advisorKeys = [
  'advisor_turbo', 'advisor_dynamic', 'advisor_balanced', 'advisor_secured', 'advisor_fortress', 'advisor_tkl',
  'advisor_turbo_relaxed', 'advisor_dynamic_relaxed', 'advisor_balanced_relaxed',
  'advisor_secured_relaxed', 'advisor_fortress_relaxed', 'advisor_tkl_relaxed',
];
const keyMap = {
  advisor_turbo: 'advTurbo', advisor_dynamic: 'advDynamic', advisor_balanced: 'advBalanced',
  advisor_secured: 'advSecured', advisor_fortress: 'advFortress', advisor_tkl: 'advTkl',
  advisor_turbo_relaxed: 'advTurboRelaxed', advisor_dynamic_relaxed: 'advDynamicRelaxed',
  advisor_balanced_relaxed: 'advBalancedRelaxed', advisor_secured_relaxed: 'advSecuredRelaxed',
  advisor_fortress_relaxed: 'advFortressRelaxed', advisor_tkl_relaxed: 'advTklRelaxed',
};

for (const ak of advisorKeys) {
  const mk = keyMap[ak];
  existing[ak] = merged[mk]?.[0] || null;
  const status = existing[ak] ? `Ret=${existing[ak].returnTotal}% DD=${existing[ak].maxDD}%` : 'NULL';
  console.log(`  ${ak}: ${status}`);
}
existing.optimal_sharpe = merged.topBySharpe[0] || existing.optimal_sharpe;
existing.optimal_return = merged.topByReturn[0] || existing.optimal_return;
existing.optimal_calmar = merged.topByCalmar[0] || existing.optimal_calmar;
existing.optimal_composite = merged.topByComposite[0] || existing.optimal_composite;
existing.top20_sharpe = merged.topBySharpe.slice(0, 20);
existing.top20_return = merged.topByReturn.slice(0, 20);
existing.top20_calmar = merged.topByCalmar.slice(0, 20);
existing.top20_composite = merged.topByComposite.slice(0, 20);
existing._full_sweep_merged = { shards: files.length, total_combos: totalTested, merged_at: new Date().toISOString() };

fs.writeFileSync(RESULTS_PATH, JSON.stringify(existing, null, 2));
console.log(`\nWrote merged results to ${RESULTS_PATH}`);
