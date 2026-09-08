'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { stableStringify } = require('../lib/workflow-contract');
const { reassembleJobResponse } = require('../lib/mcp-chunks');
const ROOT = path.resolve(__dirname, '../..'), ref = '2026-09-04';
const rawFixture = fs.readFileSync(path.join(__dirname, 'fixtures/mcp-bars-fragments-13a1b497.json'));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
function fixture(t, { failed = true, sourceTime = true, semanticBad = false } = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'collect-replay-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'tools'), { recursive: true });
  for (const name of ['collect.js', 'dtx-scan.js']) fs.copyFileSync(path.join(ROOT, 'tools', name), path.join(root, 'tools', name));
  fs.cpSync(path.join(ROOT, 'tools/lib'), path.join(root, 'tools/lib'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'config'), path.join(root, 'config'), { recursive: true });
  const put = (name, data) => { const p = path.join(root, name); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data, null, 2)); return sha(fs.readFileSync(p)); };
  const raw = JSON.parse(rawFixture), decoded = reassembleJobResponse(raw), symbols = decoded.data.items.flatMap(i => i.results || []).filter(r => r.data_type === 'bars_daily').flatMap(r => r.data || []).map(c => c.symbol).join(',');
  const timestamp = '2026-09-08T06:55:00.000Z', finished = '2026-09-08T07:30:00.000Z', asOf = '2026-09-08T07:20:00.000Z';
  const planPath = 'plans/replay-fixture.json', original = 'scanner/20260908/original', destination = 'scanner/20260908/replayed';
  const declaration = { as: 'bars_b1', server: 'marketdata', tool: 'QueryData', cache_minutes: 60,
    args: { types: 'bars_daily', symbols, limit: 300, as_of_timestamp: '$as_of_timestamp', completion_policy: 'completed_only' },
    freshness: { max_age_h: 24, required: true, expects_close: true, asset_calendar: 'us_equity_exchange_sessions', expected_completed_end: '$refdate' } };
  const plan = { artifact: 'scanner/$date/signals.json', waves: [{ name: 'history', calls: [declaration] }] };
  const ph = put(planPath, plan), call = structuredClone(declaration); call.args.as_of_timestamp = timestamp; call.freshness.expected_completed_end = ref;
  const resolved = { artifact: 'scanner/20260908/signals.json', equity_reference_close: ref, crypto_completed_refdate: null, as_of_timestamp: timestamp, waves: [{ name: 'history', calls: [call] }] };
  const ih = sha(stableStringify(resolved));
  let payload = rawFixture;
  if (semanticBad) {
    const broken = decoded; broken.data.items[0].results[0].data[0].served_completed_end = '2026-09-03'; payload = JSON.stringify(broken);
  }
  const bh = put(`${original}/bars_b1.json`, payload);
  const journal = { workflow: null, plan: planPath, plan_sha256: ph, input_sha256: ih, resolved_input: resolved,
    artifact: resolved.artifact, reference_date: ref, equity_reference_close: ref, crypto_completed_refdate: null,
    started_at: timestamp, finished_at: finished, failures: failed ? 1 : 0,
    waves: [{ name: 'history', calls: [{ as: 'bars_b1', server: 'marketdata', tool: 'QueryData', ok: !failed, error: failed ? 'zero cells before chunk reassembly' : null, output_sha256: bh, artifact_preserved: failed }] }] };
  put(`${original}/_collect.json`, journal);
  const harness = { workflow: null, plan: planPath, plan_sha256: ph, input_sha256: ih, artifact: resolved.artifact,
    reference_close: ref, equity_reference_close: ref, crypto_completed_refdate: null,
    sources: sourceTime ? [{ name: 'bars_b1', sha256: bh, as_of: asOf }] : [] };
  put(`${original}/harness.json`, harness);
  put('data/collect-cache/sentinel.json', { must: 'remain unchanged' });
  // Test guard forbids all transport, authentication and cache access in the subprocess.
  put('offline-guard.js', `const fs=require('fs');global.fetch=()=>{throw Error('NETWORK FORBIDDEN')};for(const n of ['http','https']){require(n).request=()=>{throw Error('NETWORK FORBIDDEN')}}const read=fs.readFileSync;fs.readFileSync=function(p,...args){if(String(p).includes('collect-cache')||String(p).endsWith('_socle.json'))throw Error('CACHE READ FORBIDDEN');return read.call(this,p,...args)};const write=fs.writeFileSync;fs.writeFileSync=function(p,...args){if(String(p).includes('collect-cache'))throw Error('CACHE WRITE FORBIDDEN');return write.call(this,p,...args)};`);
  const run = (extra = [], out = destination) => spawnSync(process.execPath, ['--require', path.join(root, 'offline-guard.js'), 'tools/collect.js', '--plan', planPath, '--out', out, '--replay-dir', original, '--var', 'date=20260908', '--var', 'refdate=' + ref, '--quiet', ...extra], {
    cwd: root, encoding: 'utf8', timeout: 15000, env: { PATH: process.env.PATH, HOME: root, COLLECT_SOCLE_DIR: 'forbidden-socle', MCP_SERVER_MARKETDATA: 'http://127.0.0.1:1' }
  });
  return { root, original, destination, planPath, put, run, journal, harness, ih, timestamp, finished, asOf };
}
test('offline replay reassembles real saved response, reruns semantic gates, preserves timestamps and originals', t => {
  const f = fixture(t), before = fs.readdirSync(path.join(f.root, f.original)).map(n => [n, sha(fs.readFileSync(path.join(f.root, f.original, n)))]);
  const result = f.run(); assert.equal(result.status, 0, result.stderr || result.stdout);
  const journal = JSON.parse(fs.readFileSync(path.join(f.root, f.destination, '_collect.json'))), harness = JSON.parse(fs.readFileSync(path.join(f.root, f.destination, 'harness.json')));
  assert.equal(journal.failures, 0); assert.equal(journal.waves[0].calls[0].ok, true); assert.equal(journal.input_sha256, f.ih);
  assert.equal(journal.started_at, f.timestamp); assert.equal(journal.finished_at, f.finished); assert.equal(harness.sources[0].as_of, f.asOf);
  assert.equal(journal.replay.network_calls, 0); assert.equal(journal.replay.cache_writes, 0); assert(journal.replay.reprocessed_at);
  assert.equal(journal.replay.original_journal_sha256, sha(fs.readFileSync(path.join(f.root, f.original, '_collect.json'))));
  for (const [name, digest] of before) assert.equal(sha(fs.readFileSync(path.join(f.root, f.original, name))), digest);
  const data = JSON.parse(fs.readFileSync(path.join(f.root, f.destination, 'bars_b1.json'))); assert.equal(data.chunk_reassembly.status, 'complete');
  assert.equal(journal.waves[0].calls[0].output_sha256, sha(fs.readFileSync(path.join(f.root, f.destination, 'bars_b1.json'))));
});
test('failed semantic source without original harness entry uses conservative original started_at', t => {
  const f = fixture(t, { sourceTime: false }); const result = f.run(); assert.equal(result.status, 0, result.stderr);
  const h = JSON.parse(fs.readFileSync(path.join(f.root, f.destination, 'harness.json'))); assert.equal(h.sources[0].as_of, f.timestamp);
});
test('replay still rejects genuine semantic close mismatch after transport decoding', t => {
  const f = fixture(t, { semanticBad: true }); const result = f.run(); assert.equal(result.status, 1);
  const j = JSON.parse(fs.readFileSync(path.join(f.root, f.destination, '_collect.json'))); assert.equal(j.failures, 1); assert.match(j.waves[0].calls[0].error, /close|completed/);
});
const mutations = [
  ['source tamper', f => f.put(`${f.original}/bars_b1.json`, {})],
  ['journal input hash tamper', f => f.put(`${f.original}/_collect.json`, { ...f.journal, input_sha256: '0'.repeat(64) })],
  ['journal receipt hash tamper', f => { const j = structuredClone(f.journal); j.waves[0].calls[0].output_sha256 = '0'.repeat(64); f.put(`${f.original}/_collect.json`, j); }],
  ['harness source hash tamper', f => { const h = structuredClone(f.harness); h.sources[0].sha256 = '0'.repeat(64); f.put(`${f.original}/harness.json`, h); }],
  ['plan tamper', f => { const p = JSON.parse(fs.readFileSync(path.join(f.root, f.planPath))); p.waves[0].calls[0].args.limit = 120; f.put(f.planPath, p); }],
  ['missing source', f => fs.unlinkSync(path.join(f.root, f.original, 'bars_b1.json'))],
  ['missing harness', f => fs.unlinkSync(path.join(f.root, f.original, 'harness.json'))],
  ['missing receipt', f => { const j = structuredClone(f.journal); j.waves[0].calls = []; f.put(`${f.original}/_collect.json`, j); }],
];
for (const [name, mutate] of mutations) test(`rejects ${name} before creating output`, t => {
  const f = fixture(t); mutate(f); const result = f.run(); assert.notEqual(result.status, 0); assert.equal(fs.existsSync(path.join(f.root, f.destination)), false);
});
test('changed refdate or as_of cannot alter original replay input', t => {
  const f = fixture(t);
  for (const extra of [['--var', 'refdate=2026-09-03'], ['--var', 'as_of_timestamp=2026-09-08T08:00:00Z']]) {
    const result = f.run(extra); assert.notEqual(result.status, 0); assert.equal(fs.existsSync(path.join(f.root, f.destination)), false);
  }
});
test('same directory, existing directory and nested output rejected without touching originals', t => {
  const f = fixture(t); const digest = sha(fs.readFileSync(path.join(f.root, f.original, '_collect.json')));
  for (const out of [f.original, f.original + '/child']) { const result = f.run([], out); assert.notEqual(result.status, 0); }
  assert.equal(sha(fs.readFileSync(path.join(f.root, f.original, '_collect.json'))), digest);
});
test('optional externally pinned original journal hash must match', t => {
  const f = fixture(t); const result = f.run(['--replay-journal-sha256', '0'.repeat(64)]); assert.notEqual(result.status, 0); assert.match(result.stderr, /journal hash mismatch/);
});
test('replay refuses stdin auth flags before reading stdin', t => {
  const f = fixture(t); const result = f.run(['--token-stdin']); assert.equal(result.status, 2); assert.match(result.stderr, /offline/);
});
