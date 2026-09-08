#!/usr/bin/env node
'use strict';
// Separate documentary gate: never substitutes for validate-scan's trade gates.
const fs = require('node:fs'), path = require('node:path');
const { validateReview, publishReview } = require('./lib/scanner-publication-review');
const { render } = require('./render-scanner-review');
const root = path.resolve(__dirname, '..');
function validate(reviewPath, { publication = false } = {}) {
  const v = validateReview(root, reviewPath);
  const expected = render(root, reviewPath, { write: false });
  if (fs.readFileSync(expected.output, 'utf8') !== expected.html) throw Error('Article differs from its validated documentary source/renderer');
  if (publication) for (const target of ['status','api']) {
    const manifest = path.join(root, v.dir, '_publication', `${target}-manifest.json`);
    if (!fs.existsSync(manifest)) throw Error(`Missing ${target} publication manifest`);
    const check = publishReview({root, reviewPath, target});
    if (!check.idempotent) throw Error('Verification must not produce new publication writes');
  }
  return {status:'PASS', product:v.review.product, actionability_certified:false, trading_gate:'not_passed_by_this_check', publication_verified:publication};
}
module.exports = { validate };
if (require.main === module) try {
  const args = process.argv.slice(2), publication = args.includes('--publication');
  const positional = args.filter(a => a !== '--publication');
  if (positional.length !== 1) throw Error('Usage: validate-scanner-review.js scanner/YYYYMMDD/review.json [--publication]');
  console.log(JSON.stringify(validate(positional[0], {publication})));
} catch (e) { console.error(e.message); process.exitCode=1; }
