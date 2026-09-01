#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const contract = require('./lib/workflow-contract');

const config = contract.readConfig();
const all = contract.validateAll(config);
assert.deepStrictEqual(all.errors, [], all.errors.join('\n'));

const command = `<!-- workflow-contract: daily -->
.claude/skills/source-policy.md
node tools/validate-workflows.js --workflow daily`;
assert.deepStrictEqual(contract.validateCommand(command, 'daily', {}, config.policy), []);
assert(contract.validateCommand(command.replace('source-policy.md', 'other.md'), 'daily', {}, config.policy)
  .some(error => error.includes('source-policy.md')));
assert(contract.validateCommand(`${command}\nmcp__claude_ai_marketdata__GetStatus`, 'daily', {}, config.policy)
  .some(error => error.includes('Claude-only MCP aliases')));
assert(contract.validateCommand(`${command}\nmin_expected_move=4`, 'daily', {}, config.policy)
  .some(error => error.includes('min_expected_move_pct')));
assert(contract.validateCommand(`${command}\nGetSymbolSignals(symbols=A,B)`, 'daily', {}, config.policy)
  .some(error => error.includes('mono-symbol')));
assert(contract.validateCommand(`${command}\nMCP_TOKEN_MARKETDATA=abcdefghijklmnop`, 'daily', {}, config.policy)
  .some(error => error.includes('token-looking')));
assert(contract.validateCommand(`${command}\nnode tools/does-not-exist.js`, 'daily', {}, config.policy)
  .some(error => error.includes('missing executable/resource')));
assert.deepStrictEqual(contract.validateCodexSkill('daily', '---\nname: daily\n---\n.claude/commands/daily.md', '.claude/commands/daily.md'), []);
assert(contract.validateCodexSkill('daily', '---\nname: wrong\n---\n', '.claude/commands/daily.md').length === 2);

const base = {
  artifact: 'daily/$date/index.html',
  waves: [{
    name: 'preflight',
    gate: true,
    calls: [{ as: 'status', server: 'marketdata', tool: 'GetStatus', args: {}, assert: { equity_reference_close: '$refdate' }, freshness: { max_age_h: 1, required: true } }],
  }, {
    name: 'data',
    calls: [{
      as: 'bars', server: 'marketdata', tool: 'QueryData',
      args: { types: 'bars_daily', symbols: '$symbols', as_of_timestamp: '$as_of_timestamp', completion_policy: 'completed_only' },
      freshness: { max_age_h: 24, required: true, expects_close: true, asset_calendar: 'us_equity_exchange_sessions', expected_completed_end: '$refdate' },
    }],
  }],
};
const spec = { required_variables: ['date', 'refdate', 'symbols'] };
assert.deepStrictEqual(contract.validatePlan(base, spec, config.policy), []);
const legacyCloseAssertion = structuredClone(base);
legacyCloseAssertion.waves[0].calls[0].assert = { covers_close: '$refdate' };
assert(contract.validatePlan(legacyCloseAssertion, spec, config.policy)
  .some(error => error.includes('unsupported legacy GetStatus assertion')));

const secWithoutReadiness = structuredClone(base);
secWithoutReadiness.waves[1].calls[0].args = { types: 'sec_filings,flags', symbols: '$symbols' };
secWithoutReadiness.waves[1].calls[0].freshness = { max_age_h: 168, required: true };
assert(contract.validatePlan(secWithoutReadiness, spec, config.policy)
  .some(error => error.includes('must assert GetStatus sec_operation=run_screener_sec_enriched')));
const secWithReadiness = structuredClone(secWithoutReadiness);
secWithReadiness.waves[0].calls[0].assert.sec_operation = 'run_screener_sec_enriched';
assert.deepStrictEqual(contract.validatePlan(secWithReadiness, spec, config.policy), []);
const secWithWrongReadiness = structuredClone(secWithReadiness);
secWithWrongReadiness.waves[0].calls[0].assert.sec_operation = 'bars_daily_us_equity';
assert(contract.validatePlan(secWithWrongReadiness, spec, config.policy)
  .some(error => error.includes('must assert GetStatus sec_operation=run_screener_sec_enriched')));
assert.deepStrictEqual(contract.validateRuntimeVariables(spec, { date: '20260831', refdate: '2026-08-28', symbols: 'AAA,BBB' }), []);

const scannerDtxSpec = config.workflows.scanner.plans.find(item => item.path === 'plans/scanner-dtx-decide-only.json');
const scannerDtxPlan = JSON.parse(fs.readFileSync(path.join(contract.ROOT, scannerDtxSpec.path), 'utf8'));
assert.deepStrictEqual(contract.validatePlan(scannerDtxPlan, scannerDtxSpec, config.policy), []);
const missingDtxBroker = structuredClone(scannerDtxPlan);
delete missingDtxBroker.waves[2].calls[0].args.broker;
assert(contract.validatePlan(missingDtxBroker, scannerDtxSpec, config.policy)
  .some(error => error.includes('broker must be explicit and supported')));
const mismatchedDtxBroker = structuredClone(scannerDtxPlan);
mismatchedDtxBroker.waves[2].calls[0].args.balances.broker_source = 'ibkr';
assert(contract.validatePlan(mismatchedDtxBroker, scannerDtxSpec, config.policy)
  .some(error => error.includes('balances.broker_source must equal broker')));

assert(contract.validateRuntimeVariables({ ...spec, variable_constraints: { symbols: { type: 'csv', min_items: 1, max_items: 2 } } }, {
  date: '2026-08-31', refdate: '20260828', symbols: 'AAA,AAA,BBB',
}).length >= 3);

const splitCalendar = structuredClone(base);
splitCalendar.waves[1].calls[0].freshness.asset_calendar = 'crypto_24_7_utc';
splitCalendar.waves[1].calls[0].freshness.expected_completed_end = '$crypto_completed_refdate';
const splitSpec = { required_variables: ['date', 'refdate', 'crypto_completed_refdate', 'symbols'] };
assert.deepStrictEqual(contract.validatePlan(splitCalendar, splitSpec, config.policy), []);
const mismatchedCalendar = structuredClone(splitCalendar);
mismatchedCalendar.waves[1].calls[0].freshness.expected_completed_end = '$refdate';
assert(
  contract.validatePlan(mismatchedCalendar, splitSpec, config.policy)
    .some(e => e.includes('crypto_24_7_utc must use expected_completed_end=$crypto_completed_refdate')),
  'a per-asset close must bind the query and freshness gate to the same variable',
);

const stale = structuredClone(base);
stale.reference_date = '2026-08-01';
stale.waves[1].calls[0].args.as_of_timestamp = '2026-08-01T12:00:00Z';
stale.waves[1].calls[0].args.start_date = '2026-08-01';
const staleErrors = contract.validatePlan(stale, spec, config.policy);
assert(staleErrors.some(e => e.includes('reference_date')));
assert(staleErrors.some(e => e.includes('hard-coded date')));
assert(staleErrors.some(e => e.includes('as_of_timestamp must equal $as_of_timestamp')));

const partialBars = structuredClone(base);
partialBars.waves[1].calls[0].args.include_partial = true;
assert(contract.validatePlan(partialBars, spec, config.policy).some(e => e.includes('must not request include_partial=true')));

const legacyEndDate = structuredClone(base);
legacyEndDate.waves[1].calls[0].args.end_date = '$refdate';
assert(contract.validatePlan(legacyEndDate, spec, config.policy).some(e => e.includes('end_date is forbidden')));

const broker = structuredClone(base);
broker.waves[1].calls[0].server = 'broker_live';
assert(contract.validatePlan(broker, spec, config.policy).some(e => e.includes('not allowed')));

const unknownTool = structuredClone(base);
unknownTool.waves[1].calls[0].tool = 'LooksPlausibleButDoesNotExist';
assert(contract.validatePlan(unknownTool, spec, config.policy).some(e => e.includes('audited marketdata capability set')));

const unknownArgument = structuredClone(base);
unknownArgument.waves[1].calls[0].args.silent_typo = true;
assert(contract.validatePlan(unknownArgument, spec, config.policy).some(e => e.includes('unknown QueryData argument silent_typo')));

const badDsl = structuredClone(base);
badDsl.waves[1].calls[0] = {
  as: 'screen', server: 'marketdata', tool: 'RunScreener',
  args: { pass_expr: 'ema20 > ema50 and atrpct < 3', score_expr: 'abs(rsi14)', region: 'US', asset: 'stock', as_of: '$refdate', force_async: true },
  freshness: { max_age_h: 24, required: true },
};
const badDslErrors = contract.validatePlan(badDsl, spec, config.policy);
assert(badDslErrors.some(e => e.includes('word operators')));
assert(badDslErrors.some(e => e.includes('ema(close,N)')));
assert(badDslErrors.some(e => e.includes('atr() / close')));
assert(badDslErrors.some(e => e.includes('abs()')));

const currentCut = structuredClone(base);
currentCut.waves[1].calls[0] = {
  as: 'screen', server: 'marketdata', tool: 'RunScreener',
  args: { pass_expr: 'rsi14 > 50', score_expr: 'rsi14', region: 'US', asset: 'stock', force_async: true },
  freshness: { max_age_h: 24, required: true },
};
const currentCutSpec = { required_variables: ['date', 'refdate'], allow_current_screener_cut: true };
assert.deepStrictEqual(contract.validatePlan(currentCut, currentCutSpec, config.policy), []);
currentCut.waves[1].calls[0].args.as_of = '$refdate';
assert(contract.validatePlan(currentCut, currentCutSpec, config.policy).some(e => e.includes('as_of must be omitted')));

const detached = structuredClone(base);
detached.waves[1].detached = true;
assert(contract.validatePlan(detached, spec, config.policy).some(e => e.includes('optional sources only')));

const fixedTicker = structuredClone(base);
fixedTicker.waves[1].calls[0].args.symbols = 'NVDA,CRM';
assert(contract.validatePlan(fixedTicker, spec, config.policy).some(e => e.includes('fixed symbols')));

const unboundedBatch = structuredClone(base);
const batchSpec = {
  ...spec,
  variable_constraints: { symbols: { type: 'csv', min_items: 1, max_items: 5 } },
};
assert(
  contract.validatePlan(unboundedBatch, batchSpec, config.policy).some(e => e.includes('force_async=true')),
  'multi-symbol QueryData must use the tested async/pagination path',
);

const pluralSignal = structuredClone(base);
pluralSignal.waves[1].calls[0] = {
  as: 'symbol_signals', server: 'marketdata', tool: 'GetSymbolSignals',
  args: { symbol: '$symbols' },
  freshness: { max_age_h: 24, required: true },
};
assert(
  contract.validatePlan(pluralSignal, batchSpec, config.policy).some(e => e.includes('mono-symbol')),
  'GetSymbolSignals must not receive a CSV',
);

const floatingContext = structuredClone(base);
floatingContext.waves[1].calls[0] = {
  as: 'overview', server: 'marketdata', tool: 'GetMarketContext',
  args: { facets: 'overview' },
  freshness: { max_age_h: 6, required: true },
};
assert(
  contract.validatePlan(floatingContext, spec, config.policy).some(e => e.includes('overview as_of must equal $refdate')),
  'overview must be reproducibly anchored to the reference close',
);

const fakeHistoricalRegime = structuredClone(base);
fakeHistoricalRegime.waves[1].calls[0] = {
  as: 'regime', server: 'marketdata', tool: 'GetMarketContext',
  args: { facets: 'regime', as_of: '$refdate' },
  freshness: { max_age_h: 6, required: true },
};
assert(
  contract.validatePlan(fakeHistoricalRegime, spec, config.policy).some(e => e.includes('supported only for the overview')),
  'regime must not pretend to support point-in-time as_of',
);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-contract-'));
try {
  const planRel = 'plans/daily.json';
  const planHash = contract.sha256(fs.readFileSync(path.join(contract.ROOT, planRel)));
  const inputHash = 'a'.repeat(64);
  fs.writeFileSync(path.join(tmp, 'status.json'), '{}');
  const sourceHash = contract.sha256('{}');
  fs.writeFileSync(path.join(tmp, 'harness.json'), JSON.stringify({
    contract_version: '1.0', workflow: 'daily', artifact: 'daily/20260829/index.html',
    reference_close: '2026-08-28', plan: planRel, plan_sha256: planHash,
    input_sha256: inputHash, sources: [{ name: 'status', required: true, sha256: sourceHash }],
  }));
  fs.writeFileSync(path.join(tmp, '_collect.json'), JSON.stringify({
    plan: planRel, plan_sha256: planHash, input_sha256: inputHash, failures: 0,
    executed_calls: 1, skipped_calls: 0,
    waves: [{ calls: [{ as: 'status', tool: 'GetStatus', ok: true, required: true }] }],
  }));
  assert.deepStrictEqual(contract.validateRun('daily', tmp, config).errors, []);
  const journal = JSON.parse(fs.readFileSync(path.join(tmp, '_collect.json')));
  journal.resolved_input = {
    artifact: 'daily/20260829/index.html',
    refdate: '2026-08-28',
    waves: [{ name: 'preflight', calls: [] }],
  };
  fs.writeFileSync(path.join(tmp, '_collect.json'), JSON.stringify(journal));
  assert(
    contract.validateRun('daily', tmp, config).errors.some(e => e.includes('does not match resolved collection input')),
    'a declared input hash must bind the resolved input, not merely match between files',
  );
  assert(
    contract.validateRun('daily', tmp, config).errors.some(e => e.includes('missing wave')),
    'the resolved input must still bind every literal wave/call in the current hashed plan',
  );
  const broken = JSON.parse(fs.readFileSync(path.join(tmp, 'harness.json')));
  broken.artifact = 'daily/$date/index.html';
  fs.writeFileSync(path.join(tmp, 'harness.json'), JSON.stringify(broken));
  assert(contract.validateRun('daily', tmp, config).errors.some(e => e.includes('unresolved')));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

const archived = spawnSync(process.execPath, ['tools/collect.js', '--plan', 'plans/aplus-bars.json', '--out', os.tmpdir(), '--plan-only'], {
  cwd: contract.ROOT,
  encoding: 'utf8',
});
assert.strictEqual(archived.status, 2);
assert((archived.stdout + archived.stderr).includes('Plan archivé'));

console.log('workflow contract tests: PASS');
