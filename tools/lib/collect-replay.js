'use strict';
/** Validated offline input for collect.js. No network/auth/cache capabilities. */
const fs = require('fs'), path = require('path');
const { sha256, stableStringify } = require('./workflow-contract');
const { reassembleJobResponse } = require('./mcp-chunks');
function validTimestamp(value) { return typeof value === 'string' && Number.isFinite(Date.parse(value)); }
function loadReplay({ originalDir, outDir, planPath, expectedJournalSha256 }) {
  const origin = fs.realpathSync(originalDir), destination = path.resolve(outDir);
  // A new sibling is required: no overwrite, nested output or symlink escape.
  if (fs.existsSync(destination)) throw Error('Replay output must be a new distinct directory');
  let ancestor = path.dirname(destination), suffix = path.basename(destination);
  while (!fs.existsSync(ancestor)) { suffix = path.join(path.basename(ancestor), suffix); ancestor = path.dirname(ancestor); }
  const realDestination = path.join(fs.realpathSync(ancestor), suffix);
  const relative = path.relative(origin, realDestination);
  if (!relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))) throw Error('Replay output cannot equal or be inside original directory');
  if (path.relative(realDestination, origin) === '' || !path.relative(realDestination, origin).startsWith('..')) throw Error('Replay output cannot contain original directory');
  const dependencies = [];
  const read = filename => { const bytes = fs.readFileSync(filename), hash = sha256(bytes); dependencies.push({ path: fs.realpathSync(filename), sha256: hash }); return { value: JSON.parse(bytes), sha256: hash }; };
  const j = read(path.join(origin, '_collect.json')), h = read(path.join(origin, 'harness.json'));
  if (expectedJournalSha256 && j.sha256 !== expectedJournalSha256) throw Error('Replay original journal hash mismatch');
  const journal = j.value, harness = h.value, input = journal.resolved_input;
  if (!input || !Array.isArray(input.waves) || !journal.finished_at || !validTimestamp(journal.started_at) || !validTimestamp(journal.finished_at) || !validTimestamp(input.as_of_timestamp)) throw Error('Replay original journal is incomplete or lacks original timestamps');
  if (Date.parse(journal.finished_at) < Date.parse(journal.started_at)) throw Error('Replay original journal timestamps reversed');
  const inputHash = sha256(stableStringify(input));
  if (journal.input_sha256 !== inputHash || harness.input_sha256 !== inputHash) throw Error('Replay original input hash mismatch');
  const planHash = sha256(fs.readFileSync(planPath));
  if (journal.plan_sha256 !== planHash || harness.plan_sha256 !== planHash || harness.plan !== journal.plan) throw Error('Replay original plan hash/path mismatch');
  if (harness.workflow !== journal.workflow || harness.reference_close !== journal.reference_date || input.equity_reference_close !== journal.reference_date
    || journal.equity_reference_close !== input.equity_reference_close || journal.crypto_completed_refdate !== input.crypto_completed_refdate
    || harness.equity_reference_close !== input.equity_reference_close || harness.crypto_completed_refdate !== input.crypto_completed_refdate
    || journal.artifact !== input.artifact || harness.artifact !== input.artifact) throw Error('Replay journal/harness reference/workflow/artifact mismatch');
  const calls = input.waves.flatMap(w => w.calls || []), receipts = (journal.waves || []).flatMap(w => w.calls || []);
  const aliases = calls.map(c => c.as);
  if (new Set(aliases).size !== aliases.length || aliases.some(as => typeof as !== 'string' || !/^[A-Za-z0-9_-]+$/.test(as))) throw Error('Replay aliases duplicate or unsafe');
  if (receipts.length !== calls.length || receipts.some(r => !aliases.includes(r.as))) throw Error('Replay original journal lacks exact call coverage');
  const files = new Map(), sourceProvenance = [];
  for (const call of calls) {
    const rows = receipts.filter(r => r.as === call.as);
    if (rows.length !== 1 || rows[0].server !== call.server || rows[0].tool !== call.tool || !/^[a-f0-9]{64}$/.test(rows[0].output_sha256 || '')) throw Error(`Replay ${call.as}: receipt identity/output hash absent or ambiguous`);
    const file = read(path.join(origin, call.as + '.json'));
    if (file.sha256 !== rows[0].output_sha256) throw Error(`Replay ${call.as}: source hash mismatch`);
    const matches = (harness.sources || []).filter(s => s.name === call.as);
    if (matches.length > 1 || (matches.length && matches[0].sha256 !== file.sha256)) throw Error(`Replay ${call.as}: original harness source hash mismatch`);
    if (rows[0].ok === true && call.freshness && matches.length !== 1) throw Error(`Replay ${call.as}: successful original source missing from harness`);
    const asOf = matches[0]?.as_of || journal.started_at;
    if (!validTimestamp(asOf) || Date.parse(asOf) > Date.parse(journal.finished_at)) throw Error(`Replay ${call.as}: invalid/future original source timestamp`);
    const value = reassembleJobResponse(file.value);
    const status = value?.status || value?.data?.status;
    if (['pending', 'running', 'async_pending'].includes(status)) throw Error(`Replay ${call.as}: unfinished job cannot be resolved offline`);
    files.set(call.as, { value, asOf, originalAsOf: matches[0]?.as_of || null });
    sourceProvenance.push({ as: call.as, path: path.join(origin, call.as + '.json'), sha256: file.sha256, original_ok: rows[0].ok, original_error: rows[0].error || null, as_of: asOf, as_of_basis: matches[0]?.as_of ? 'original_harness_source' : 'original_started_at_conservative' });
  }
  if ((harness.sources || []).some(s => !aliases.includes(s.name))) throw Error('Replay original harness has unregistered sources');
  return {
    journal, harness, timestamp: input.as_of_timestamp,
    assertInput(resolved, relativePlan, workflow) {
      if (relativePlan !== journal.plan || workflow !== journal.workflow || sha256(stableStringify(resolved)) !== inputHash) throw Error('Replay resolved plan/variables/refdate/as_of_timestamp must exactly match original input');
    },
    assertUnchanged() { for (const item of dependencies) if (sha256(fs.readFileSync(item.path)) !== item.sha256) throw Error(`Replay original changed during processing: ${item.path}`); },
    result(call) { const item = files.get(call.as); if (!item) throw Error(`Replay ${call.as}: artifact unavailable`); return { as: call.as, ok: true, value: structuredClone(item.value), ms: 0, waitMs: 0, asOf: item.asOf, replay: true }; },
    provenance: { mode: 'offline_replay', original_directory: origin, original_journal_sha256: j.sha256, original_harness_sha256: h.sha256,
      original_input_sha256: inputHash, original_plan_sha256: planHash, original_started_at: journal.started_at, original_finished_at: journal.finished_at,
      sources: sourceProvenance, reprocessed_at: new Date().toISOString(), network_calls: 0, cache_reads: 0, cache_writes: 0 },
  };
}
module.exports = { loadReplay };
