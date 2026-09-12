'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { primaryCorrection } = require('./lib/calendar-primary-corrections');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'calendar-proof-'));
const write = (p, x) => fs.writeFileSync(path.join(dir, p), JSON.stringify(x));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, p))).digest('hex');
fs.mkdirSync(path.join(dir, '_data'));
const event = { id: 'ppi', date: '2026-09-10', source: 'bls' };
const registry = { sources: { bls: { url: 'https://www.bls.gov/schedule/news_release/ppi.htm' } } };
const row = { date: '2026-09-14', label: 'Producer Price Index (PPI)' };
write('_data/economic_events.json', [row]);
write('registry.json', registry);
const disclosure = 'Correction PPI : 2026-09-10 officiel ; 2026-09-14 dans le flux brut.';
const doc = { version: 1, raw_sha256: hash('_data/economic_events.json'), registry_sha256: hash('registry.json'), corrections: [{ event_id: event.id, raw_label: row.label, raw_date: row.date, authoritative_date: event.date, source_url: registry.sources.bls.url, public_disclosure: disclosure }] };
const args = { dir, registryPath: path.join(dir, 'registry.json'), registry, event, row, prose: `<p>${disclosure}</p><a href="${registry.sources.bls.url}">BLS</a>` };
try {
  assert.strictEqual(primaryCorrection(args), false, 'no implicit correction');
  write('calendar-corrections.json', doc);
  assert.strictEqual(primaryCorrection(args), true);
  for (const field of ['raw_sha256', 'registry_sha256']) {
    write('calendar-corrections.json', { ...doc, [field]: 'bad' });
    assert.strictEqual(primaryCorrection(args), false, field);
  }
  write('calendar-corrections.json', doc);
  assert.strictEqual(primaryCorrection({ ...args, prose: '' }), false, 'must reach readers');
  assert.strictEqual(primaryCorrection({ ...args, prose: disclosure }), false, 'primary link required');
  assert.strictEqual(primaryCorrection({ ...args, event: { ...event, date: '2026-09-09' } }), false, 'cannot overrule primary date');
  write('_data/economic_events.json', [{ ...row, date: '2026-09-15' }]);
  assert.strictEqual(primaryCorrection(args), false, 'stale correction invalidated by raw change');
  console.log('calendar primary corrections: PASS');
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
