#!/usr/bin/env node
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { validate } = require('./validate-content-claims');
const { stableStringify } = require('./lib/workflow-contract');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'content-claims-'));
try {
  const article = '<!doctype html><main><p>Move: <span data-claim="move">+2.5%</span></p></main>';
  const source = JSON.stringify({ move: 2.5 });
  fs.writeFileSync(path.join(root, 'article.html'), article);
  fs.writeFileSync(path.join(root, 'source.json'), source);
  const plan = '{}'; fs.writeFileSync(path.join(root, 'plan.json'), plan);
  const resolvedInput = { artifact: 'article', refdate: '2026-08-28', waves: [{ calls: [{ as: 'source', server: 'marketdata', tool: 'QueryData' }] }] };
  const inputHash = crypto.createHash('sha256').update(stableStringify(resolvedInput)).digest('hex');
  fs.writeFileSync(path.join(root, 'harness.json'), JSON.stringify({
    reference_close: '2026-08-28', plan: 'plan.json', plan_sha256: crypto.createHash('sha256').update(plan).digest('hex'), input_sha256: inputHash,
    sources: [{ name: 'source', sha256: crypto.createHash('sha256').update(source).digest('hex'), required: true }],
  }));
  fs.writeFileSync(path.join(root, '_collect.json'), JSON.stringify({
    reference_date: '2026-08-28', plan: 'plan.json', plan_sha256: crypto.createHash('sha256').update(plan).digest('hex'),
    input_sha256: inputHash, resolved_input: resolvedInput,
    waves: [{ calls: [{ as: 'source', server: 'marketdata', tool: 'QueryData', ok: true, output_sha256: crypto.createHash('sha256').update(source).digest('hex') }] }],
  }));
  const manifest = { reference_close: '2026-08-28', article_path: 'article.html', article_sha256: crypto.createHash('sha256').update(article).digest('hex'), claims: [{
    id: 'move', rendered_text: '+2.5%', source_artifact: 'source.json', source_sha256: crypto.createHash('sha256').update(source).digest('hex'), source_pointer: '/move', source_value: 2.5,
    render: { scale: 1, decimals: 1, sign: 'always', suffix: '%' },
  }] };
  assert.deepStrictEqual(validate(manifest, root), []);
  const badArticle = '<main><p>Unbound 42</p></main>';
  fs.writeFileSync(path.join(root, 'article.html'), badArticle);
  manifest.article_sha256 = crypto.createHash('sha256').update(badArticle).digest('hex');
  assert(validate(manifest, root).some(error => error.includes('unbound numeric')));
  fs.writeFileSync(path.join(root, 'article.html'), article.replace('+2.5%', '+999.0%'));
  manifest.article_sha256 = crypto.createHash('sha256').update(article.replace('+2.5%', '+999.0%')).digest('hex');
  manifest.claims[0].rendered_text = '+999.0%';
  assert(validate(manifest, root).some(error => error.includes('deterministic rendering')));
  console.log('content claims tests: PASS');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
