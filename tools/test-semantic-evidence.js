#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { validateAplusPointers, validateObservationPointers } = require('./lib/semantic-evidence');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-evidence-'));
try {
  const write = (name, value) => { fs.writeFileSync(path.join(root, name), JSON.stringify(value)); return { path: name }; };
  const payload = {
    evidence: {
      bars: write('bars.json', { rows: [{ close: 100 }] }),
      guidance: write('guidance.json', { events: [{ ticker: 'TEST', date: '2026-08-20', action: 'raised' }] }),
      eps_history: write('eps.json', { quarters: [{ ticker: 'TEST', date: '2026-08-20', actual: 2.1, estimate: 2 }] }),
      sec: write('sec.json', { filings: [{ ticker: 'TEST', accession: '0001' }] }),
    },
    ideas: [{ ticker: 'TEST', market_observations: { spot: { value: 100, source_id: 'bars', source_pointer: '/rows/0/close' } } }],
  };
  assert.deepStrictEqual(validateObservationPointers(payload, root), []);
  payload.ideas[0].market_observations.spot.value = 101;
  assert(validateObservationPointers(payload, root).some(error => error.includes('does not equal')));
  payload.ideas = [];
  payload.candidates = [{
    ticker: 'TEST', market_observations: {},
    guidance_proof: { date: '2026-08-20', source_pointer: '/events/0' },
    eps_beat_proof: [{ date: '2026-08-20', actual: 2.1, estimate: 2, source_pointer: '/quarters/0' }],
    sec_review: { filings: [{ accession: '0001', source_pointer: '/filings/0' }] },
  }];
  assert.deepStrictEqual(validateAplusPointers(payload, root), []);
  fs.writeFileSync(path.join(root, 'guidance.json'), JSON.stringify({ events: [{ ticker: 'TEST', date: '2026-08-20', action: 'not_raised', note: 'costs increased' }] }));
  assert(validateAplusPointers(payload, root).some(error => error.includes('raised-guidance')));
  fs.writeFileSync(path.join(root, 'guidance.json'), JSON.stringify({ events: [{ ticker: 'TEST', date: '2026-08-20', action: 'raised' }] }));
  fs.writeFileSync(path.join(root, 'eps.json'), JSON.stringify({ quarters: [{ ticker: 'TEST', date: '2026-08-20', actual: 2, estimate: 2.1 }] }));
  assert(validateAplusPointers(payload, root).some(error => error.includes('EPS proof')));
  fs.writeFileSync(path.join(root, 'eps.json'), JSON.stringify({ quarters: [{ ticker: 'TEST', date: '2026-08-20', actual: 2.1, estimate: 2 }] }));
  fs.writeFileSync(path.join(root, 'sec.json'), JSON.stringify({ filings: [{ ticker: 'OTHER', accession: '0001' }] }));
  assert(validateAplusPointers(payload, root).some(error => error.includes("issuer's source row")));
  fs.writeFileSync(path.join(root, 'sec.json'), JSON.stringify({ filings: [{ ticker: 'TEST', accession: '0001' }] }));
  payload.candidates[0].sec_review.filings[0].accession = 'missing';
  assert(validateAplusPointers(payload, root).some(error => error.includes('does not resolve')));
  console.log('semantic evidence tests: PASS');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
