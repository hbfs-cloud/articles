#!/usr/bin/env node
'use strict';
// Documentary publication only. Never creates, edits or releases a trading signal.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
function build({ sourceRoot, session, now = new Date() }) {
  if (session !== '20260908') throw Error('This source adapter is dated 20260908; a new session requires reviewed event classifications');
  sourceRoot = fs.realpathSync(sourceRoot);
  const rel = `scanner/${session}`, input = path.join(sourceRoot, rel), out = path.join(ROOT, rel);
  const read = n => { const bytes = fs.readFileSync(path.join(input, n)); return { data: JSON.parse(bytes), sha256: sha(bytes) }; };
  const audit = read('_audit/universe.json'), derived = read('_derived/technicals.json');
  const membership = read('_audit/islamic-membership.json'), instruments = read('_audit/etf-screening/review.json');
  const finals = read('_audit/etf-screening/final-candidate-flags.json');
  const ref = audit.data.reference_close;
  execFileSync(process.execPath, ['tools/audit-scanner-universe.js', 'validate', '--dir', rel, '--refdate', ref], { cwd: sourceRoot, stdio: 'pipe' });
  for (const [folder, plan] of [['_data', 'scanner-wave1-no-dtx'], ['_data2', 'scanner-wave2']]) {
    execFileSync(process.execPath, ['tools/check-freshness.js', `${rel}/${folder}/harness.json`], { cwd: sourceRoot, stdio: 'pipe' });
    execFileSync(process.execPath, ['tools/validate-workflows.js', '--run-plan', `plans/${plan}.json`, `${rel}/${folder}`], { cwd: sourceRoot, stdio: 'pipe' });
  }
  // Also pin the documentary holdings and issuer review inputs to the recorded bytes.
  for (const source of [membership.data.source, membership.data.methodology]) {
    if (!source?.path || sha(fs.readFileSync(source.path)) !== source.sha256) throw Error('Documentary source hash mismatch');
  }
  const manifest = instruments.data.source_manifest;
  const manifestFile = path.join(input, '_audit/etf-screening', manifest.path);
  if (sha(fs.readFileSync(manifestFile)) !== manifest.sha256) throw Error('Instrument source manifest mismatch');
  const rows = audit.data.candidates, unique = [...new Set(rows.map(r => r.ticker))];
  const numeric = [...new Set(audit.data.numerically_passed.map(r => r.ticker))].sort();
  const members = new Set(membership.data.matches.filter(r => r.status === 'provider_holding_exact_ticker_us_exchange_usd').map(r => r.candidate_symbol));
  const watchlist = numeric.filter(t => members.has(t)).map(ticker => ({ ticker, status: 'verification_pending' }));
  const counts = { screened: unique.length, histories_complete: derived.data.counts.derived,
    histories_rejected: derived.data.counts.rejected, numeric_pass: numeric.length };
  if (counts.screened !== counts.histories_complete + counts.histories_rejected || derived.data.counts.requested !== counts.screened) throw Error('Universe/history count mismatch');
  if (audit.data.actionability_certified !== false || derived.data.actionability_certified !== false) throw Error('Unexpected publication semantics');
  const evidence = {
    schema_version: 1, product: 'scanner_surveillance_evidence', reference_close: ref,
    counts, watchlist, source_rows: rows.length, numeric_pass_rows: audit.data.numerically_passed.length,
    rejected_history_reasons: { missing_sessions: derived.data.rejected.filter(r => /noncontiguous/.test(r.reason)).length,
      insufficient_length: derived.data.rejected.filter(r => /fewer than/.test(r.reason)).length },
    provider: { name: membership.data.provider, composition_as_of: membership.data.composition_as_of, url: membership.data.source.product_url },
    instrument_review: instruments.data.summary,
    // No quotes, price histories, credentials or private filesystem paths are published.
    source_receipts: Object.entries({ universe: audit, technicals: derived, provider_membership: membership, instrument_review: instruments, final_review: finals }).map(([name, value]) => ({ name, sha256: value.sha256 })),
    interpretation: 'Descriptive audit of the collected universe. No certified trade, probability forecast or individual religious certification.'
  };
  fs.mkdirSync(out, { recursive: true });
  const evidenceBytes = JSON.stringify(evidence, null, 2) + '\n';
  fs.writeFileSync(path.join(out, 'review-evidence.json'), evidenceBytes);
  const review = { schema_version: 1, product: 'scanner_surveillance_review', review_date: `${session.slice(0,4)}-${session.slice(4,6)}-${session.slice(6)}`,
    reference_close: ref, status: 'review_only', actionability_certified: false, orders: [], excluded_components: ['dtx'],
    article_url: `/${rel}/`, headline: `${watchlist.map(x => x.ticker).join(', ')} : surveillance, aucun nouvel ordre validé`,
    counts, watchlist, validation_pending: ['dividends', 'sec', 'halal_etfs', 'tracking', 'rotation_eurusd'],
    source_provenance: [{ name: `${rel}/review-evidence.json`, sha256: sha(evidenceBytes) }], reviewed_at: now.toISOString() };
  fs.writeFileSync(path.join(out, 'review.json'), JSON.stringify(review, null, 2) + '\n');
  return review;
}
if (require.main === module) {
  const arg = key => process.argv[process.argv.indexOf(key) + 1];
  try { console.log(JSON.stringify(build({ sourceRoot: arg('--source-root'), session: arg('--session') }))); }
  catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = { build };
