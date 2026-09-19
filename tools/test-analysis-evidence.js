#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { validate, validateNonMarketInput } = require('./validate-analysis-evidence');
const { stableStringify } = require('./lib/workflow-contract');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'analysis-evidence-'));
try {
  fs.mkdirSync(path.join(root, 'data'));
  const sourceObject = { symbol: 'TEST', values: { levelsCloseDate: '2026-08-28', price: 100, changePct: 1, entry: 101, stop: 98, tp1: 106, tp2: 110 } };
  const source = JSON.stringify(sourceObject);
  fs.writeFileSync(path.join(root, 'data', 'source.json'), source);
  const analysis = {
    meta: { levelsCloseDate: '2026-08-28' }, header: { ticker: 'TEST', price: 100, changePct: 1 },
    technicals: {}, tradeIdea: { entry: 101, stop: 98, tp1: 106, tp2: 110 },
  };
  const analysisBody = JSON.stringify(analysis);
  fs.writeFileSync(path.join(root, 'data', 'analysis.json'), analysisBody);
  const sourceHash = crypto.createHash('sha256').update(source).digest('hex');
  const plan = '{}'; fs.writeFileSync(path.join(root, 'plan.json'), plan);
  const resolvedInput = { artifact: 'analysis', refdate: '2026-08-28', waves: [{ calls: [{ as: 'source', server: 'marketdata', tool: 'QueryData' }] }] };
  const inputHash = crypto.createHash('sha256').update(stableStringify(resolvedInput)).digest('hex');
  fs.writeFileSync(path.join(root, 'data', 'harness.json'), JSON.stringify({
    reference_close: '2026-08-28', plan: 'plan.json', plan_sha256: crypto.createHash('sha256').update(plan).digest('hex'), input_sha256: inputHash,
    sources: [{ name: 'source', sha256: sourceHash, required: true }],
  }));
  fs.writeFileSync(path.join(root, 'data', '_collect.json'), JSON.stringify({
    reference_date: '2026-08-28', plan: 'plan.json', plan_sha256: crypto.createHash('sha256').update(plan).digest('hex'),
    input_sha256: inputHash, resolved_input: resolvedInput,
    waves: [{ calls: [{ as: 'source', server: 'marketdata', tool: 'QueryData', ok: true, output_sha256: sourceHash }] }],
  }));
  const manifest = {
    ticker: 'TEST', reference_close: '2026-08-28', analysis_path: 'data/analysis.json',
    analysis_sha256: crypto.createHash('sha256').update(analysisBody).digest('hex'),
    claims: ['meta.levelsCloseDate', 'header.price', 'header.changePct', 'tradeIdea.entry', 'tradeIdea.stop', 'tradeIdea.tp1', 'tradeIdea.tp2']
      .map(p => ({ path: p, value: p === 'meta.levelsCloseDate' ? '2026-08-28' : p === 'header.price' ? 100 : p === 'header.changePct' ? 1 : analysis.tradeIdea[p.split('.')[1]], as_of: '2026-08-28', source_artifact: 'data/source.json', source_sha256: sourceHash, source_pointer: `/values/${p.split('.')[1]}` })),
  };
  assert.deepStrictEqual(validate(manifest, root), []);
  const bad = structuredClone(manifest); bad.claims[0].value = 999;
  assert(validate(bad, root).some(error => error.includes('differs')));
  const omitted = structuredClone(manifest); omitted.claims.pop();
  assert(validate(omitted, root).some(error => error.includes('missing claim')));
  const selfProof = structuredClone(manifest);
  selfProof.claims.forEach(claim => { claim.source_artifact = 'data/analysis.json'; claim.source_sha256 = selfProof.analysis_sha256; });
  assert(validate(selfProof, root).some(error => error.includes('cannot prove itself')));
  const archived = { header: { ticker: 'TEST' }, tradeIdea: { entry: 189.7489, stop: 176.4499, tp1: 214.8, tp2: 219.0299 } };
  const archiveInput = { kind: 'archived_analysis', path: 'archive.json' };
  const checkArchiveText = (field, value) => {
    const candidate = { tradeIdea: { [field]: value } };
    const calculation = { claim_provenance: { [`tradeIdea.${field}`]: { input_path: 'archive.json', source_pointer: '/tradeIdea', derivation: 'archived_trade_geometry' } } };
    return validateNonMarketInput(archiveInput, archived, calculation, candidate, 'TEST');
  };
  assert.deepStrictEqual(checkArchiveText('rr', '1:1.88 / 1:2.20'), [], 'both archived targets reproduce their R/R');
  assert.deepStrictEqual(checkArchiveText('stopPct', '-7.0%'), [], 'published precision is respected');
  assert.deepStrictEqual(checkArchiveText('thesis', 'Historical entry 189.7489'), [], 'exact archived precision is supported');
  assert(checkArchiveText('rr', '1:1.88 / 1:2.50').length, 'invented target ratio remains rejected');
  assert(checkArchiveText('stopPct', '-8.0%').length, 'incorrect percentage remains rejected');
  for (const [field, text] of [['stopPct', '+7.0%'], ['tp1Pct', '-13.2%'], ['tp2Pct', '-15.4%'], ['rr', '1:-1.88 / 1:2.20'], ['rr', '1:2.20 / 1:1.88'], ['stopPct', '+13.2%']]) {
    assert(checkArchiveText(field, text).length, `reject wrong sign, target or order: ${field} ${text}`);
  }
  console.log('analysis evidence tests: PASS');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
