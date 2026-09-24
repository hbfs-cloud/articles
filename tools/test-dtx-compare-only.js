#!/usr/bin/env node
'use strict';

// Une évaluation DtxDecide compare_only ne produit JAMAIS d'ordre, de plan, de candidat dtx_pool
// ni d'ordre API — quelle que soit la forme du résumé hypothétique qu'elle porte.
//
// Décision du propriétaire du 2026-09-24 : le catalogue eligible_for_live est vide pour toutes les
// stratégies ; le scanner interroge donc le moteur en compare_only:true. La réponse ci-dessous est
// la forme réellement servie ce jour-là par systematic.dailytickers.com pour etf_us.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const scan = require('./dtx-scan');
const { validateDtxDecision } = require('./lib/dtx-content-gates');
const hist = require('./lib/dtx-engine-history');

const SERVED = {
  account_broker: 'alpaca', compare_only: true, contract_version: '2.0',
  config_hash: 'sha256:2a90819e5a0cf583e619442a72e76f4a80f3eede57f3f5cb1c374b9a4e5de3d3',
  data_asof: '2026-09-23', data_snapshot_id: 'yahoo-frozen:2026-09-23:content-sha256:3a6e',
  decision_quality: 'OK', decision_reasons: [{ code: 'COLD_START_REGIME_UNSEEDED', severity: 'warning' }],
  eligible_for_live: false, executable: false, expected_data_date: '2026-09-23',
  hypothetical_actions: { CANCEL: [], UPDATE: [], CREATE: [
    { symbol: 'AMDY', side: 'BUY' }, { symbol: 'DIME', side: 'BUY' }, { symbol: 'UGA', side: 'BUY' },
  ] },
  hypothetical_actions_unreadable: false,
  ineligibility_reasons: ['lifecycle_not_production', 'reference_stats_not_viable', 'viability_bar_not_met'],
  last_data_date: '2026-09-23',
  non_executable_reason: 'COMPARE_ONLY: research evaluation requested; actions, execution_plan and state are withheld',
  portfolio: 'etf_us', request_id: '3c9b1f20-7a11-4c2e-9d55-6a0e8b3f2d41', requested_asof: '2026-09-23',
  risk_summary: { create_orders: 3 }, sessions_behind: 0, strategy_id: 'etf_us',
};
const clone = v => JSON.parse(JSON.stringify(v));
const modeInfo = { id: 'best', path: null };
const cfg = { id: 'etf_us', name: 'ETF US', currency: 'USD' };
const build = decision => scan.buildCompareOnlyStaging({
  modeInfo, cfg, asof: '2026-09-24', decidedOn: '2026-09-23', currency: 'USD', decision,
  metrics: null, equity: null, replayErr: null, engineLabel: 'test', engineMode: 'mcp', t0: Date.now(),
});

// 1. Le contrat accepte la réponse servie, et seulement une réponse non exécutable.
assert.deepStrictEqual(validateDtxDecision(SERVED, { asof: '2026-09-23', referenceClose: '2026-09-23' }), [], 'réponse compare_only servie rejetée');
for (const [label, mutate] of [
  ['executable:true', d => { d.executable = true; }],
  ['execution_plan présent', d => { d.execution_plan = { groups: [] }; }],
  ['actions.CREATE non vide', d => { d.actions = { CREATE: [{ symbol: 'UGA', side: 'BUY', qty: 10 }] }; }],
  ['state présent', d => { d.state = {}; }],
  ['résumé avec quantité', d => { d.hypothetical_actions.CREATE[0].qty = 100; }],
  ['résumé avec limite', d => { d.hypothetical_actions.CREATE[0].limit_price = 12.3; }],
  ['raisons absentes', d => { delete d.ineligibility_reasons; }],
]) {
  const d = clone(SERVED); mutate(d);
  assert(scan.validateCompareOnlyDecision(d, { asof: '2026-09-23' }).length > 0, `compare_only accepté malgré ${label}`);
  assert.throws(() => build(d), /compare_only rejected/, `staging construit malgré ${label}`);
}

// 2. Le staging porte zéro ordre, aucun plan, et la mention exigée.
const stg = build(clone(SERVED));
assert.strictEqual(stg.actionable, false);
assert.strictEqual(stg.failureMode, 'compare_only');
assert.deepStrictEqual(stg.orders, [], 'compare_only a produit des ordres');
assert.deepStrictEqual(stg.updates, []);
assert.deepStrictEqual(stg.cancels, []);
assert.strictEqual(stg.executionPlan, null);
assert.strictEqual(stg.decisionProvenance.validFrom, null);
assert.strictEqual(stg.evaluation.executable, false);
assert.strictEqual(stg.evaluation.noticeFr,
  'Évaluation informative, non éligible au live (raison serveur : lifecycle_not_production, reference_stats_not_viable, viability_bar_not_met)');
for (const row of stg.evaluation.hypotheticalActions.CREATE) assert.deepStrictEqual(Object.keys(row).sort(), ['side', 'symbol'], 'le résumé hypothétique a gagné des champs exécutables');
assert.deepStrictEqual(scan.stagingSnapshotErrors(stg, 'etf_us', { todayIso: stg.generatedAt.slice(0, 10), scanDateIso: '2026-09-24', expectedClose: '2026-09-23' }), [], 'staging compare_only jugé invalide');
const tampered = clone(stg); tampered.orders = [{ symbol: 'UGA', side: 'BUY' }];
assert(scan.stagingSnapshotErrors(tampered, 'etf_us', { todayIso: stg.generatedAt.slice(0, 10), scanDateIso: '2026-09-24', expectedClose: '2026-09-23' }).includes('compare_only staging orders must be empty'), 'ordre injecté non détecté');

// 3. L'historique enregistre l'évaluation, jamais un ordre.
const store = { modes: {} };
const r = hist.append({ ...stg, _provenance: 'staging' }, { store });
assert.strictEqual(r.counts.orders, 0);
assert.strictEqual(store.modes.best['2026-09-24'].failureMode, 'compare_only');
assert.strictEqual(store.modes.best['2026-09-24'].evaluation.executable, false);

// 4. Le pont dtx_pool, exécuté réellement sur un dépôt temporaire, n'émet aucun candidat.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dtx-compare-only-'));
try {
  const ROOT = path.resolve(__dirname, '..');
  for (const rel of ['tools/dtx-pool-bridge.js', 'data/modes-config.json']) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, rel), path.join(root, rel));
  }
  const modes = JSON.parse(fs.readFileSync(path.join(root, 'data/modes-config.json'), 'utf8'));
  const engineOf = id => (modes.modes || modes)[id] && ((modes.modes || modes)[id].enginePortfolio || id);
  const engine = engineOf('best') || 'etf_us';
  fs.mkdirSync(path.join(root, 'data/dtx'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data/dtx', `${engine}.json`), JSON.stringify({ ...stg, portfolioId: engine }));
  fs.mkdirSync(path.join(root, 'scanner/20260924'), { recursive: true });
  fs.writeFileSync(path.join(root, 'scanner/20260924/signals.json'), JSON.stringify({ scanDate: '2026-09-24', signals: [], dtx_pool: [{ stale: true }] }));
  const run = spawnSync(process.execPath, [path.join(root, 'tools/dtx-pool-bridge.js'), '--folder', '20260924', '--date', '2026-09-24'], { cwd: root, encoding: 'utf8' });
  const out = JSON.parse(fs.readFileSync(path.join(root, 'scanner/20260924/signals.json'), 'utf8'));
  assert.deepStrictEqual(out.dtx_pool, [], `compare_only a produit des candidats dtx_pool : ${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /Évaluation informative, non éligible au live/, 'le pont ne déclare pas la nature compare_only');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log('[dtx-compare-only] PASS — aucune évaluation compare_only ne produit d’ordre, de plan, de candidat ou d’ordre API');
