#!/usr/bin/env node
'use strict';
/**
 * invalid-cohort-report.js — impact des cohortes invalides déclarées.
 *
 * LECTURE SEULE. N'écrit rien, ne modifie aucun trade. Montre, par mode :
 * combien de trades scellés sont marqués par `data/invalid-cohorts.json`, et
 * ce que devient l'espérance par trade une fois la cohorte écartée.
 *
 * Usage:
 *   node tools/invalid-cohort-report.js            # tous les modes
 *   node tools/invalid-cohort-report.js --mode hybrid
 *   node tools/invalid-cohort-report.js --json
 */

const fs = require('fs');
const path = require('path');
const { loadCohorts, partitionTrades, REGISTRY_PATH } = require('./lib/invalid-cohorts');

const ROOT = path.join(__dirname, '..');
const TRADES = path.join(ROOT, 'data', 'backtest-trades.json');

function avg(list) {
  const p = list.map(t => t.pnlPct).filter(x => typeof x === 'number');
  return p.length ? +(p.reduce((a, b) => a + b, 0) / p.length).toFixed(2) : null;
}
function winRate(list) {
  const p = list.map(t => t.pnlPct).filter(x => typeof x === 'number');
  return p.length ? +((p.filter(x => x > 0).length / p.length) * 100).toFixed(0) : null;
}

function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const mi = argv.indexOf('--mode');
  const onlyMode = mi >= 0 ? argv[mi + 1] : null;

  const cohorts = loadCohorts();
  if (!cohorts.length) {
    console.log(`[invalid-cohort-report] aucune cohorte déclarée dans ${REGISTRY_PATH}`);
    return;
  }

  let byMode;
  try {
    byMode = JSON.parse(fs.readFileSync(TRADES, 'utf8'));
  } catch (e) {
    console.error(`[invalid-cohort-report] lecture ${TRADES} impossible : ${e.message}`);
    process.exit(1);
  }

  const rows = [];
  for (const [mode, trades] of Object.entries(byMode)) {
    if (onlyMode && mode !== onlyMode) continue;
    if (!Array.isArray(trades) || trades.length === 0) continue;
    const { valid, invalid, cohortIds } = partitionTrades(trades, mode);
    if (invalid.length === 0 && onlyMode == null) continue;
    rows.push({
      mode,
      n_total: trades.length,
      n_marques: invalid.length,
      avg_brut: avg(trades),
      avg_hors_cohorte: avg(valid),
      wr_brut: winRate(trades),
      wr_hors_cohorte: winRate(valid),
      cohortes: cohortIds.join(','),
    });
  }

  if (asJson) {
    console.log(JSON.stringify({ cohorts, modes: rows }, null, 2));
    return;
  }

  console.log(`Registre : ${REGISTRY_PATH}`);
  for (const c of cohorts) {
    console.log(`  • ${c.id} — ${c.field} ∈ [${c.from} … ${c.to}] · modes=${
      Array.isArray(c.modes) ? c.modes.join(',') : c.modes} · ${c.label}`);
  }
  console.log('');
  console.table(rows);
  console.log('\nMarquage seulement : les stats publiées restent inchangées tant que');
  console.log('EXCLUDE_INVALID_COHORTS=1 (ou opts.excludeInvalidCohorts) n\'est pas passé.');
}

main();
