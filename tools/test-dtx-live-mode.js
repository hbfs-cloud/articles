#!/usr/bin/env node
'use strict';
// Le mode DTX du scanner suit le catalogue, pas un booléen figé (décision du propriétaire du
// 2026-09-24, jusqu'à nouvel ordre) : compare_only tant qu'etf_us n'est pas eligible_for_live,
// décision Contract V2 dès qu'il l'est. Trois preuves :
//   1. le sélecteur de mode lit le catalogue ;
//   2. le harnais refuse un mode qui contredit le catalogue relu dans la même collecte ;
//   3. le contrat n'accepte que la branche fermée déclarée (compare_only ⇔ compare_only:true).
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { spawnSync } = require('child_process');
const { modeFor } = require('./dtx-live-mode');
const workflowContract = require('./lib/workflow-contract');

// 1. Sélecteur.
assert.strictEqual(modeFor([], 'etf_us'), 'compare_only', 'catalogue vide → compare_only');
assert.strictEqual(modeFor([{ id: 'us_highvol', eligible_for_live: true }], 'etf_us'), 'compare_only', 'autre ligne éligible → compare_only pour etf_us');
assert.strictEqual(modeFor([{ id: 'etf_us', eligible_for_live: true }], 'etf_us'), 'decide', 'etf_us éligible → retour automatique au mode décision');
assert.throws(() => modeFor(null, 'etf_us'), /non tabulaire/);
// Fail-closed : seul `eligible_for_live === true` ouvre le mode décision.
for (const v of [undefined, null, 'true', 1, 'yes', {}, [true]]) {
  const entry = v === undefined ? { id: 'etf_us' } : { id: 'etf_us', eligible_for_live: v };
  assert.strictEqual(modeFor([entry], 'etf_us'), 'compare_only', `eligible_for_live=${JSON.stringify(v)} ne doit jamais ouvrir le mode décision`);
}

// 2. Harnais : collecte hors ligne d'un seul appel DtxCatalog portant l'assertion de mode.
function collect(catalog, mode) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dtx-live-mode-')));
  try {
    fs.mkdirSync(path.join(root, 'tools'), { recursive: true });
    fs.copyFileSync(path.join(__dirname, 'collect.js'), path.join(root, 'tools/collect.js'));
    fs.copyFileSync(path.join(__dirname, 'dtx-scan.js'), path.join(root, 'tools/dtx-scan.js'));
    fs.cpSync(path.join(__dirname, 'lib'), path.join(root, 'tools/lib'), { recursive: true });
    fs.cpSync(path.join(__dirname, '../config'), path.join(root, 'config'), { recursive: true });
    fs.writeFileSync(path.join(root, 'guard.js'), `global.fetch = async (_u, o) => { const q = JSON.parse(o.body);
      if (q.params.name !== 'DtxCatalog') throw Error('unexpected ' + q.params.name);
      return { ok: true, status: 200, text: async () => JSON.stringify({ jsonrpc: '2.0', id: q.id, result: { content: [{ type: 'text', text: ${JSON.stringify(JSON.stringify(catalog))} }] } }) }; };`);
    fs.writeFileSync(path.join(root, 'plan.json'), JSON.stringify({ artifact: 'test', waves: [{ name: 'catalog', calls: [{
      as: 'dtx_catalog_live', server: 'systematic', tool: 'DtxCatalog', args: { eligible_for_live: true },
      assert: { live_mode_for_portfolio: 'etf_us', expected_mode: '$dtx_mode' }, freshness: { required: true, max_age_h: 2 },
    }] }] }));
    const r = spawnSync(process.execPath, ['--require', path.join(root, 'guard.js'), 'tools/collect.js', '--plan', 'plan.json', '--out', 'out', '--var', `dtx_mode=${mode}`, '--var', 'refdate=2026-09-23', '--quiet'], {
      cwd: root, encoding: 'utf8',
      env: { ...process.env, MCP_TOKEN_SYSTEMATIC: 'offline', MCP_TOKEN_SYSTEMATIC_EXPIRES_AT: new Date(Date.now() + 600000).toISOString() },
    });
    return { status: r.status, log: r.stdout + r.stderr };
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
assert.strictEqual(collect([], 'compare_only').status, 0, 'catalogue vide + compare_only doit passer');
assert.strictEqual(collect([{ id: 'etf_us' }], 'compare_only').status, 0, 'entrée sans champ eligible_for_live = compare_only');
assert.notStrictEqual(collect([{ id: 'etf_us', eligible_for_live: 'true' }], 'decide').status, 0, 'une valeur non booléenne ne doit pas autoriser le mode décision');
const stale = collect([{ id: 'etf_us', eligible_for_live: true }], 'compare_only');
assert.notStrictEqual(stale.status, 0, 'etf_us éligible mais compare_only : le harnais doit refuser');
assert.match(stale.log, /mode attendu decide/);
const premature = collect([], 'decide');
assert.notStrictEqual(premature.status, 0, 'catalogue vide mais decide : le harnais doit refuser');
assert.match(premature.log, /mode attendu compare_only/);

// 3. Contrat : la branche déclarée passe, une branche falsifiée est refusée.
const planPath = path.join(__dirname, '../plans/scanner-dtx.json');
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const { planSpec } = workflowContract.findPlanSpec(planPath);
assert.deepStrictEqual(workflowContract.validatePlan(plan, planSpec), [], 'plan DTX réel refusé');
const forged = JSON.parse(JSON.stringify(plan));
for (const w of forged.waves) for (const c of w.calls || []) if (c.as === 'decide_etf_us_compare') delete c.args.compare_only;
assert(workflowContract.validatePlan(forged, planSpec).some(e => /conditional execution/.test(e)), 'une branche compare_only sans compare_only:true doit être refusée');

console.log('dtx live mode: PASS — compare_only suit le catalogue, retour automatique au mode décision, harnais et contrat fermés');
