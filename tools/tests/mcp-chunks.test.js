'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { reassembleItems, reassembleJobResponse, McpChunkError } = require('../lib/mcp-chunks');
const { awaitJob } = require('../lib/mcp-client');
const bytes = fs.readFileSync(path.join(__dirname, 'fixtures/mcp-bars-fragments-13a1b497.json'));
const fixture = JSON.parse(bytes), fresh = () => structuredClone(fixture);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
test('real raw fixture provenance matches exact archived bytes', () => {
  const p = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/mcp-bars-fragments-13a1b497.provenance.json')));
  assert.equal(hash(bytes), p.source_sha256); assert.equal(fixture.commit, p.commit);
});
test('real raw fragments reconstruct QueryData object and complete bar arrays without mutation', () => {
  const before = JSON.stringify(fixture), out = reassembleJobResponse(fixture);
  assert.equal(JSON.stringify(fixture), before); assert.equal(out.data.items.length, 1);
  const expected = JSON.parse(fixture.data.items.map(x => x._chunk_data).join(''));
  assert.deepEqual(out.data.items[0], expected); assert(out.data.items[0].results.length > 0);
  assert(out.data.items[0].results.some(r => r.data_type === 'bars_daily' && r.data.some(x => Array.isArray(x.bars) && x.bars.length === 300)));
  assert.equal(out.chunk_reassembly.groups[0].sha256, hash(fixture.data.items.map(x => x._chunk_data).join('')));
  assert.equal(out.chunk_reassembly.groups[0].fragment_hashes.length, 2);
});
test('awaitJob replays the saved exhausted response locally before returning consumer data', async () => {
  let calls = 0;
  const out = await awaitJob('marketdata', fixture.job_id, { call: async () => { calls++; return fresh(); } });
  assert.equal(calls, 1); assert.equal(out.chunk_reassembly.status, 'complete'); assert(out.data.items[0].results.length > 0);
});
test('normal objects are retained, including reference identity when no fragments exist', () => {
  const normal = { data: { items: [{ x: 1 }, { y: 2 }] } };
  assert.equal(reassembleJobResponse(normal), normal); assert.deepEqual(reassembleItems(normal.data.items).items, normal.data.items);
});
test('mixed normal and chunked logical items preserve exact original order', () => {
  const chunks = fresh().data.items.map(c => ({ ...c, _chunk_item_index: 2 }));
  const before = { normal: 'first' }, after = { normal: 'last' };
  const out = reassembleItems([before, ...chunks, after]);
  assert.equal(out.items[0], before); assert.equal(out.items[2], after); assert(out.items[1].results);
});
test('two chunk groups stay separate and ordered', () => {
  const a = fresh().data.items, b = fresh().data.items.map(c => ({ ...c, _chunk_item_index: 2 }));
  const out = reassembleItems([...a, ...b]); assert.equal(out.items.length, 2); assert.deepEqual(out.items[0], out.items[1]);
});
test('optional fragment hashes can be omitted without changing decoded data', () => {
  const a = reassembleItems(fixture.data.items), b = reassembleItems(fixture.data.items, { includeProvenance: false });
  assert.deepEqual(a.items, b.items); assert.equal(b.groups[0].sha256, undefined);
});
const corruptions = [
  ['missing final fragment', x => x.pop()],
  ['missing first fragment', x => x.shift()],
  ['duplicate fragment', x => { x[1] = structuredClone(x[0]); }],
  ['out-of-order fragments', x => x.reverse()],
  ['inconsistent totals', x => { x[1]._chunk_total = 3; }],
  ['non-numeric total', x => { x[0]._chunk_total = '2'; }],
  ['fractional index', x => { x[0]._chunk_index = 1.5; }],
  ['zero index', x => { x[0]._chunk_index = 0; }],
  ['negative group', x => { x[0]._chunk_item_index = -1; }],
  ['group does not match logical item position', x => { x.forEach(c => { c._chunk_item_index = 3; }); }],
  ['interleaved groups', x => { x[1]._chunk_item_index = 2; }],
  ['wrong encoding', x => { x[1]._chunk_encoding = 'base64'; }],
  ['wrong field', x => { x[1]._chunk_field = '$.results'; }],
  ['false reassembly marker', x => { x[1]._chunk_requires_reassembly = false; }],
  ['missing required marker', x => { delete x[1]._chunk_field; }],
  ['unexpected field', x => { x[1].ignored = 'must not discard'; }],
  ['nonstring fragment', x => { x[1]._chunk_data = {}; }],
  ['normal item inside unfinished group', x => { x[1] = { normal: true }; }],
  ['invalid assembled JSON', x => { x[1]._chunk_data = '!bad json'; }],
];
for (const [name, mutate] of corruptions) test(`rejects ${name}`, () => {
  const x = fresh().data.items; mutate(x); assert.throws(() => reassembleItems(x), McpChunkError);
});
for (const value of ['null', '42', 'true', '"text"', '[]']) test(`rejects nonobject assembled JSON ${value}`, () => {
  const chunk = { ...fixture.data.items[0], _chunk_total: 1, _chunk_data: value }; assert.throws(() => reassembleItems([chunk]), /must be an object/);
});
test('untrusted content is parsed as data, never evaluated', () => {
  const chunk = { ...fixture.data.items[0], _chunk_total: 1, _chunk_data: '{"text":"process.exit(9)","__proto__":{"polluted":true}}' };
  const out = reassembleItems([chunk]); assert.equal(out.items[0].text, 'process.exit(9)'); assert.equal({}.polluted, undefined);
});
test('incomplete pagination never reassembles even with all fragments', () => {
  const x = fresh(); x.pagination.has_next = true; assert.throws(() => reassembleJobResponse(x), /exhausted/);
});
test('logical total mismatch is not silently rewritten', () => {
  const x = fresh(); x.data.total_items = 2; assert.throws(() => reassembleJobResponse(x), /total_items/);
});
test('awaitJob surfaces malformed fragments instead of returning zero-cell data', async () => {
  const x = fresh(); x.data.items.pop();
  await assert.rejects(awaitJob('marketdata', fixture.job_id, { call: async () => x }), McpChunkError);
});

test('real legacy overview array-field chunks remain unchanged and are not UTF8 fragments', async () => {
  const bytes = fs.readFileSync(path.join(__dirname, 'fixtures/mcp-overview-legacy-chunks-13a1b497.json'));
  const p = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/mcp-overview-legacy-chunks-13a1b497.provenance.json')));
  assert.equal(hash(bytes), p.source_sha256);
  const raw = JSON.parse(bytes), before = JSON.stringify(raw);
  assert(raw.data.items.some(i => i._chunk_field === 'data.markets' && !Object.hasOwn(i, '_chunk_data')));
  assert.equal(reassembleJobResponse(raw), raw); assert.equal(JSON.stringify(raw), before);
  assert.deepEqual(reassembleItems(raw.data.items).items, raw.data.items);
  const result = await awaitJob('marketdata', raw.job_id, { call: async () => raw });
  assert.equal(result, raw); assert.equal(JSON.stringify(result), before);
});
