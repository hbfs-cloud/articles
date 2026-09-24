#!/usr/bin/env node
'use strict';
// Offline integration: a call carrying a `retry` policy is re-run ALONE after a failed facet,
// completes the SAME collection when the source recovers, and fails closed — naming the missing
// symbols — once the attempt cap is reached. The 120 s wait is shortened by patching setTimeout in
// the offline guard only; production code has no test hook.
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { spawnSync } = require('child_process');

const failedCell = { data_type: 'trading_signals', status: 'failed', error: 'trading_signals[OKLL]: context deadline exceeded',
  cells: [{ symbol: 'OKLL', status: 'failed', error: 'trading_signals[OKLL]: context deadline exceeded' }], data: [] };
const okCell = { data_type: 'trading_signals', status: 'completed', cells: [{ symbol: 'OKLL', status: 'completed' }],
  data: [{ symbol: 'OKLL', signals: ['symbol,signal_type', 'OKLL,buy'] }] };
const response = cell => ({ type: 'query_data', status: cell.status === 'failed' ? 'partial' : 'completed',
  total_failed: cell.status === 'failed' ? 1 : 0, results: [cell] });

function run(failuresBeforeSuccess, maxAttempts) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'collect-retry-')));
  try {
    fs.mkdirSync(path.join(root, 'tools'), { recursive: true });
    fs.copyFileSync(path.join(__dirname, 'collect.js'), path.join(root, 'tools/collect.js'));
    fs.copyFileSync(path.join(__dirname, 'dtx-scan.js'), path.join(root, 'tools/dtx-scan.js'));
    fs.cpSync(path.join(__dirname, 'lib'), path.join(root, 'tools/lib'), { recursive: true });
    fs.cpSync(path.join(__dirname, '../config'), path.join(root, 'config'), { recursive: true });
    fs.writeFileSync(path.join(root, 'offline-guard.js'), `
      const realSetTimeout = global.setTimeout;
      global.setTimeout = (fn, ms, ...a) => realSetTimeout(fn, ms >= 120000 ? 5 : ms, ...a);
      let n = 0; const calls = [];
      process.on('exit', () => require('fs').writeFileSync(${JSON.stringify(path.join(root, 'calls.json'))}, JSON.stringify(calls)));
      global.fetch = async (_url, options) => {
        const q = JSON.parse(options.body); const name = q.params.name;
        if (name !== 'QueryData') throw Error('Unexpected call ' + name);
        calls.push(q.params.arguments.symbols);
        const value = n++ < ${failuresBeforeSuccess} ? ${JSON.stringify(response(failedCell))} : ${JSON.stringify(response(okCell))};
        return { ok: true, status: 200, text: async () => JSON.stringify({ jsonrpc: '2.0', id: q.id, result: { content: [{ type: 'text', text: JSON.stringify(value) }] } }) };
      };`);
    fs.writeFileSync(path.join(root, 'plan.json'), JSON.stringify({ artifact: 'test/index.html', waves: [{ name: 'tech', calls: [{
      as: 'tech_b1', server: 'marketdata', tool: 'QueryData', args: { types: 'trading_signals', symbols: 'OKLL', execution_mode: 'sync' },
      retry: { interval_s: 120, max_attempts: maxAttempts, max_total_s: 1800 }, freshness: { required: true, max_age_h: 24 },
    }] }] }));
    const result = spawnSync(process.execPath, ['--require', path.join(root, 'offline-guard.js'), 'tools/collect.js', '--plan', 'plan.json', '--out', 'out', '--var', 'refdate=2026-09-23'], {
      cwd: root, encoding: 'utf8',
      env: { ...process.env, MCP_TOKEN_MARKETDATA: 'offline-test-token', MCP_TOKEN_MARKETDATA_EXPIRES_AT: new Date(Date.now() + 600000).toISOString() },
    });
    const journal = JSON.parse(fs.readFileSync(path.join(root, 'out/_collect.json'), 'utf8'));
    return { result, journal, calls: JSON.parse(fs.readFileSync(path.join(root, 'calls.json'), 'utf8')),
      hasOutput: fs.existsSync(path.join(root, 'out/tech_b1.json')), log: result.stdout + result.stderr,
      harness: fs.existsSync(path.join(root, 'out/harness.json')) ? JSON.parse(fs.readFileSync(path.join(root, 'out/harness.json'), 'utf8')) : null };
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

// 1. The source recovers on the third attempt: the collection completes, nothing else is re-run.
const ok = run(2, 15);
assert.strictEqual(ok.result.status, 0, ok.log);
assert.strictEqual(ok.calls.length, 3, 'the failed call must be re-run exactly until it succeeds');
assert.strictEqual(ok.journal.failures, 0, ok.log);
assert.strictEqual(ok.journal.waves[0].calls[0].retry_attempts, 2, 'retry attempts must be journaled');
assert.strictEqual(ok.journal.retries.length, 2);
assert.match(ok.journal.waves[0].calls[0].observed_at || '', /^\d{4}-\d{2}-\d{2}T/, 'a retried response must carry its own observation instant');
assert(ok.journal.retries.every(r => r.observed_at && r.observed_at.tech_b1), 'each retry must journal the observation instant of the response it produced');
const src = ok.harness && ok.harness.sources.find(x => x.name === 'tech_b1');
assert(src && src.as_of === ok.journal.waves[0].calls[0].observed_at, 'freshness manifest must date the retried source by its own observation, not by the run');
assert(ok.hasOutput, 'recovered source must be persisted');
assert.match(ok.log, /\d{2}:\d{2} reprise 1\/15 dans 120 s — 1 appel\(s\), manquants : trading_signals\[OKLL\]/, 'each attempt must log HH:MM and the missing symbols');

// 2. The source never recovers: the cap holds, the run fails closed and names what is missing.
const ko = run(99, 3);
assert.notStrictEqual(ko.result.status, 0, ko.log);
assert.strictEqual(ko.calls.length, 4, 'initial call plus exactly max_attempts retries');
assert.deepStrictEqual(ko.journal.retry_exhausted.missing, ['trading_signals[OKLL]']);
assert.strictEqual(ko.journal.failures, 1);
assert.match(ko.log, /reprise plafonnée \(3\/3 tentatives/, ko.log);

console.log('collect retry: PASS — failed calls are re-run alone, recover within the same collection, and fail closed at the cap');
