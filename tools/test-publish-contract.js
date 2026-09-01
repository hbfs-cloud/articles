#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  buildDtxProductNotice,
  buildTelegramCaption,
  generateHTML,
} = require('./generate-scanner-image');

const ROOT = path.resolve(__dirname, '..');
const publisher = fs.readFileSync(path.join(ROOT, 'tools/publish-daily-card.sh'), 'utf8');
const downstream = fs.readFileSync(path.join(ROOT, 'tools/downstream-split.sh'), 'utf8');
const parallel = fs.readFileSync(path.join(ROOT, 'tools/scan-parallel.sh'), 'utf8');
const morning = fs.readFileSync(path.join(ROOT, 'tools/morning-refresh.js'), 'utf8');
const deployWorkflow = fs.readFileSync(path.join(ROOT, '.github/workflows/deploy.yml'), 'utf8');

const count = (source, needle) => source.split(needle).length - 1;
const commonPath = publisher.indexOf('Common pre-publication path');
assert(commonPath >= 0, 'publisher must expose one common path after the optional sweep');
for (const command of [
  'node tools/dtx-history-append.js',
  'node tools/gen-status-page.js',
  'node tools/gen-mode-cards.js',
  'node tools/gen-api.js',
]) {
  assert.strictEqual(count(publisher, command), 1, `${command} must run exactly once`);
  assert(publisher.indexOf(command) > commonPath, `${command} must not be nested in the sweep branch`);
}
assert(publisher.includes('node tools/check-freshness.js "$harness"'));
assert(publisher.includes('node tools/validate-workflows.js --run-plan "$plan" "$out"'));
assert(publisher.includes('verify_collection_run "scanner/$SCAN_DATE/_final"'));
assert.match(publisher, /dtx staging INCOMPLET[^\n]*aucune publication/);
assert(!publisher.includes('generate-scanner-image.js ||'), 'card generation must be blocking');
assert(!publisher.includes('node tools/update-tracking.js'), 'publisher must not run synthetic OHLC tracking');
assert(!parallel.includes('node tools/update-tracking.js'), 'parallel scanner must not run synthetic OHLC tracking');
assert(!morning.includes("['tools/update-tracking.js']"), 'morning refresh must not run synthetic OHLC tracking');

for (const privateArtifact of [
  'dtx-engine-history.json', 'risk-snapshots.json',
  'capacity-ledger-v1.json', 'modes-config-history.json',
  'backtest-results.json', 'backtest-trades.json',
  'pit-state.json', 'pit-forward.json', 'portfolio-history.json',
  'scanner-metrics.json', 'scanner-positions.json',
  'broker-instruments.json', 'executor-allowlist.json', 'routines-manifest.json',
  'signal-alerts-pending.json', 'signals-ledger.json',
  'signals-telegram-messages.json',
]) {
  assert(deployWorkflow.includes(privateArtifact), `${privateArtifact} must be excluded from Pages`);
}
assert(!deployWorkflow.includes('cp -f data/*.json data/*.js _site/data/'),
  'Pages deployment must not bulk-publish every top-level pipeline artifact');
assert(!deployWorkflow.includes('cp -r data/trading-plans'),
  'Pages deployment must not publish broker execution plans');
assert(deployWorkflow.includes("rsync -a --exclude='_*'"),
  'Pages deployment must filter private evidence directories');
assert(deployWorkflow.includes("--exclude='harness.json'"),
  'Pages deployment must keep technical collection harnesses private');
assert(!deployWorkflow.includes('[ -d "$dir" ] && cp -r "$dir"'),
  'Pages deployment must not recursively publish raw article evidence');

const trackedFiles = ['data/scanner-metrics.json', 'data/scanner-positions.json'];
const fingerprint = file => {
  const absolute = path.join(ROOT, file);
  const stat = fs.statSync(absolute);
  return {
    hash: crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex'),
    mtimeMs: stat.mtimeMs,
  };
};
const trackingBefore = Object.fromEntries(trackedFiles.map(file => [file, fingerprint(file)]));
const disabledTracking = spawnSync(process.execPath, ['tools/update-tracking.js'], {
  cwd: ROOT, encoding: 'utf8', timeout: 5000,
});
assert.strictEqual(disabledTracking.status, 2, 'legacy tracking CLI must fail closed');
assert.match(`${disabledTracking.stdout}\n${disabledTracking.stderr}`, /DISABLED:[^\n]*performs no writes/);
for (const file of trackedFiles) {
  assert.deepStrictEqual(fingerprint(file), trackingBefore[file], `${file} changed despite disabled tracking CLI`);
}
const trackingModule = require('./update-tracking');
assert.strictEqual(typeof trackingModule.extractAllFromDir, 'function', 'safe parser import remains available');

const requiredStage = publisher.indexOf('data/dtx-engine-history.json');
const sweepOnlyStage = publisher.indexOf('if [ "$SKIP_SWEEP" = false ]; then', commonPath);
assert(requiredStage > commonPath && requiredStage < sweepOnlyStage,
  'status/API/history staging must happen outside the sweep-only branch');
for (const artifact of [
  'scanner-daily-card.png',
  'scanner/status/index.html',
  'scanner/status/history/*.json',
  'portfolio/v1/',
]) assert(publisher.includes(artifact), `${artifact} must be staged`);
assert(downstream.includes('PUBLISH_SCAN_DATE="$DATE" bash tools/publish-daily-card.sh --no-sweep --no-telegram'),
  'distribute must bind publication to its explicit target session');

function mode(status, extraTracking = {}) {
  return {
    label: 'DTX Max',
    forwardTracking: { status, ...extraTracking },
  };
}

const notStarted = buildDtxProductNotice(mode('not_started'));
assert.strictEqual(notStarted.status, 'not_started');
assert.match(notStarted.stateSentence, /fill certifié/);

const active = buildDtxProductNotice(mode(' ACTIVE ', { openPositions: 99, executedTrades: 1234 }));
assert.strictEqual(active.status, 'active');
assert.match(active.stateLabel, /actif/);
assert(!JSON.stringify(active).includes('99') && !JSON.stringify(active).includes('1234'),
  'notification notice must not invent or relay position/performance counts');

const paused = buildDtxProductNotice(mode('paused'));
assert.strictEqual(paused.status, 'paused');
assert.match(paused.stateLabel, /pause/);

assert.throws(() => buildDtxProductNotice(mode('backtest_only')), /carte refusée/);
assert.throws(() => buildDtxProductNotice(mode('toString')), /carte refusée/);
assert.throws(() => buildDtxProductNotice(mode('__proto__')), /carte refusée/);
assert.throws(() => buildDtxProductNotice({ label: 'DTX Max' }), /carte refusée/);
assert.throws(() => buildDtxProductNotice({ ...mode('active'), label: 'Best' }), /absent ou renommé/);

const caption = buildTelegramCaption({
  top3: [
    { ticker: 'AAA', entry: 10, stop: 9, tp1: 12, tp2: 13 },
    { ticker: 'BBB', entry: 20, stop: 18, tp1: 24, tp2: 26 },
    { ticker: 'CCC', entry: 30, stop: 27, tp1: 36, tp2: 39 },
  ],
  regime: { label: 'RISK-ON' },
  scanDir: '20260901',
  dtxNotice: active,
});
assert.match(caption, /aucune idée exécutée/);
assert(!caption.includes('aucune position ouverte'), 'caption must not claim that DTX has no position');
assert(!/3588|561 opérations|backtest/i.test(caption), 'caption must not expose replay metrics');

const cardHtml = generateHTML({
  top3: [
    { ticker: 'AAA', name: 'Alpha', strategy: 'Momentum', score: 91, entry: 10, stop: 9, tp1: 12, tp2: 13, rr: 2, horizon_days: 10, color: '#059669', chart: null },
    { ticker: 'BBB', name: 'Beta', strategy: 'Breakout', score: 90, entry: 20, stop: 18, tp1: 24, tp2: 26, rr: 2, horizon_days: 10, color: '#2563eb', chart: null },
    { ticker: 'CCC', name: 'Gamma', strategy: 'Momentum', score: 89, entry: 30, stop: 27, tp1: 36, tp2: 39, rr: 2, horizon_days: 10, color: '#7c3aed', chart: null },
  ],
  regime: { label: 'RISK-ON', color: '#059669' },
  scanDir: '20260901',
  referenceClose: '2026-08-31',
  dtxNotice: active,
});
assert.match(cardHtml, /suivi réel actif/);
assert(!/3588|561 opérations|backtest/i.test(cardHtml), 'card must not expose replay metrics');

console.log('publish contract tests: PASS');
