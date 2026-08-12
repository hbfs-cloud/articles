#!/usr/bin/env node
/**
 * tools/regime-recalibrate.js
 *
 * Detects market regime change and proposes recalibration of mode parameters.
 *
 * Logic:
 *   1. Read recent scanner history (default last 7 scans) — extract regime per scan
 *   2. Compute dominant regime + stability counter (consecutive days same regime)
 *   3. Compare with modes-config.json#_regime (currently active)
 *   4. If dominant != current AND stability >= STABILITY_DAYS → trigger recalibration
 *   5. Recalibration sources from data/backtest-results.json advisor_<mode> (already
 *      computed by sweep.js — these are the best combos found by the latest grid run)
 *   6. Print proposed delta. With --apply: append new version to config-history.json
 *      and update modes-config.json (preserves history, never overwrites).
 *
 * Append-only: every recalibration produces a new entry in config-history.json
 * with bumped _version and timestamp. modes-config.json gets the new active params
 * but the previous version stays preserved in config-history.
 *
 * Usage:
 *   node tools/regime-recalibrate.js                      # detect + report only (dry run)
 *   node tools/regime-recalibrate.js --apply              # apply recalibration
 *   node tools/regime-recalibrate.js --force --apply      # force apply even if no regime change
 *   node tools/regime-recalibrate.js --stability=3        # require N stable days before trigger (default 3)
 *   node tools/regime-recalibrate.js --history-window=14  # regime detection window (default 7)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');
const STABILITY_DAYS = parseInt((process.argv.find(a => a.startsWith('--stability=')) || '--stability=3').split('=')[1], 10);
const HISTORY_WINDOW = parseInt((process.argv.find(a => a.startsWith('--history-window=')) || '--history-window=7').split('=')[1], 10);

function log(...args) { console.log('[regime-recalibrate]', ...args); }
function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

// 1. Read scanner history — regime per scan
function readRecentRegimes() {
  const scannerDirs = fs.readdirSync(path.join(ROOT, 'scanner'))
    .filter(d => /^\d{8}$/.test(d))
    .sort()
    .reverse()
    .slice(0, HISTORY_WINDOW);
  const regimes = [];
  for (const d of scannerDirs) {
    const dataPath = path.join(ROOT, 'scanner', d, 'data.json');
    if (!fs.existsSync(dataPath)) continue;
    try {
      const data = loadJson(dataPath);
      regimes.push({ date: d, regime: (data.regime || '').toUpperCase() });
    } catch {}
  }
  return regimes.reverse();  // oldest first
}

// 2. Dominant regime + stability
function dominantRegime(regimes) {
  if (!regimes.length) return { dominant: null, stability: 0, distribution: {} };
  const distribution = {};
  for (const r of regimes) distribution[r.regime] = (distribution[r.regime] || 0) + 1;
  const sorted = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
  const dominant = sorted[0][0];

  // count consecutive days at the end matching dominant
  let stability = 0;
  for (let i = regimes.length - 1; i >= 0; i--) {
    if (regimes[i].regime === dominant) stability++;
    else break;
  }
  return { dominant, stability, distribution, count: regimes.length };
}

// 3. Read active params + history
function readActiveConfig() {
  const cfg = loadJson(path.join(ROOT, 'data', 'modes-config.json'));
  return cfg;
}
function readConfigHistory() {
  const p = path.join(ROOT, 'portfolio', 'v1', 'config-history.json');
  if (!fs.existsSync(p)) return { updatedAt: new Date().toISOString(), versions: [] };
  return loadJson(p);
}

// 4. Read advisor recommendations from latest sweep
function readAdvisorRecommendations() {
  const p = path.join(ROOT, 'data', 'backtest-results.json');
  if (!fs.existsSync(p)) return null;
  const r = loadJson(p);
  const out = {};
  // Modes lus depuis data/modes-config.json (source de vérité), pas depuis une liste figée :
  // celle-ci nommait encore secured/tkl (supprimés) et ignorait `best`, dont les recommandations
  // d'advisor n'étaient donc JAMAIS lues — le mode était invisible pour la recalibration.
  let modeIds;
  try {
    modeIds = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'modes-config.json'), 'utf8')).modes || {});
  } catch { modeIds = []; }
  for (const mode of modeIds) {
    out[mode] = r['advisor_' + mode] || r['advisor_' + mode + '_relaxed'] || null;
  }
  return out;
}

// 5. Build proposal
function buildProposal(activeCfg, advisor, newRegime) {
  const proposal = {
    timestamp: new Date().toISOString(),
    new_regime: newRegime,
    prev_regime: activeCfg._regime,
    prev_version: activeCfg._version,
    new_version: bumpVersion(activeCfg._version),
    deltas: {},
  };
  for (const mode of Object.keys(activeCfg.modes || {})) {
    const cur = activeCfg.modes[mode];
    const sug = advisor && advisor[mode];
    if (!sug) {
      proposal.deltas[mode] = { status: 'no_advisor', cur };
      continue;
    }
    const BACKTEST_FIELDS = new Set(['equityCurve', 'closedTrades', 'losses', 'wins', 'composite', 'trades', 'totalReturn', 'maxDD', 'profitFactor', 'winRate', 'sharpe', 'calmar', 'returnTotal', 'returnRealized', 'returnUnrealized', 'r2', 'avgWin', 'avgLoss', 'returnDDRatio', 'sortino', 'avgHold']);
    const diff = {};
    for (const k of Object.keys(sug)) {
      if (BACKTEST_FIELDS.has(k)) continue;
      if (cur[k] !== sug[k]) diff[k] = { from: cur[k], to: sug[k] };
    }
    proposal.deltas[mode] = { status: Object.keys(diff).length ? 'change' : 'no_change', diff };
  }
  return proposal;
}

function bumpVersion(v) {
  const m = String(v || 'v0').match(/^v?(\d+)(?:\.(\d+))?(?:-.*)?$/);
  if (!m) return 'v1';
  const major = parseInt(m[1], 10);
  const minor = m[2] ? parseInt(m[2], 10) : 0;
  return `v${major}.${minor + 1}`;
}

// 6. Apply
function applyProposal(proposal, activeCfg, history) {
  // Update modes-config.json
  const newCfg = JSON.parse(JSON.stringify(activeCfg));
  for (const [mode, delta] of Object.entries(proposal.deltas)) {
    if (delta.status !== 'change') continue;
    for (const [k, change] of Object.entries(delta.diff || {})) {
      newCfg.modes[mode][k] = change.to;
    }
  }
  newCfg._regime = proposal.new_regime;
  newCfg._prevVersion = activeCfg._version;
  newCfg._version = proposal.new_version;
  newCfg._updated = proposal.timestamp.slice(0, 10);
  newCfg._comment = `${Object.keys(newCfg.modes || {}).length} modes — ${proposal.new_regime} ${proposal.new_version} (regime recalibration ${proposal.timestamp.slice(0, 10)}). Previous: ${activeCfg._version}.`;
  fs.writeFileSync(path.join(ROOT, 'data', 'modes-config.json'), JSON.stringify(newCfg, null, 2));

  // Append to config-history.json (preserve all prior versions)
  const newHistEntry = {
    id: `${proposal.new_version}-${proposal.timestamp.slice(0, 10).replace(/-/g, '')}`,
    timestamp: proposal.timestamp,
    regime: proposal.new_regime,
    config: newCfg.modes,
    triggered_by: 'regime-recalibrate.js',
    prev_version: activeCfg._version,
  };
  history.versions.push(newHistEntry);
  history.updatedAt = proposal.timestamp;
  fs.writeFileSync(path.join(ROOT, 'portfolio', 'v1', 'config-history.json'), JSON.stringify(history, null, 2));

  return { newCfg, newHistEntry };
}

// === MAIN ===
log(`stability_days=${STABILITY_DAYS}, history_window=${HISTORY_WINDOW}, apply=${APPLY}, force=${FORCE}`);

const regimes = readRecentRegimes();
log(`recent regimes (n=${regimes.length}):`, regimes.map(r => `${r.date}=${r.regime}`).join(', '));

const dom = dominantRegime(regimes);
log(`dominant regime: ${dom.dominant} (${dom.stability} consecutive days, distribution: ${JSON.stringify(dom.distribution)})`);

const activeCfg = readActiveConfig();
log(`active config: version=${activeCfg._version} regime=${activeCfg._regime}`);

const regimeChanged = dom.dominant && (dom.dominant !== activeCfg._regime);
const stable = dom.stability >= STABILITY_DAYS;
log(`regime_changed=${regimeChanged}  stable=${stable}`);

if (!regimeChanged && !FORCE) {
  log('No regime change detected. Use --force to recalibrate anyway. Exiting.');
  process.exit(0);
}
if (regimeChanged && !stable && !FORCE) {
  log(`Regime change detected (${activeCfg._regime} → ${dom.dominant}) but only ${dom.stability} stable day(s). Need ${STABILITY_DAYS}. Use --force to override. Exiting.`);
  process.exit(0);
}

const advisor = readAdvisorRecommendations();
if (!advisor) {
  log('No advisor data in data/backtest-results.json. Run sweep.js first.');
  process.exit(1);
}

const newRegime = FORCE && !regimeChanged ? activeCfg._regime : dom.dominant;
const proposal = buildProposal(activeCfg, advisor, newRegime);

console.log('\n=== Recalibration Proposal ===');
console.log(JSON.stringify({
  prev_version: proposal.prev_version,
  new_version: proposal.new_version,
  prev_regime: proposal.prev_regime,
  new_regime: proposal.new_regime,
  changes_per_mode: Object.fromEntries(Object.entries(proposal.deltas).map(([m, d]) => [m, d.status === 'change' ? Object.keys(d.diff).length + ' field(s) changed' : d.status]))
}, null, 2));

if (Object.values(proposal.deltas).every(d => d.status !== 'change')) {
  log('Advisor matches current config — no parameter changes needed. Exiting.');
  process.exit(0);
}

console.log('\n=== Mode-by-mode Diffs ===');
for (const [mode, delta] of Object.entries(proposal.deltas)) {
  if (delta.status !== 'change') {
    console.log(`  ${mode}: ${delta.status}`);
    continue;
  }
  console.log(`  ${mode}:`);
  for (const [k, c] of Object.entries(delta.diff)) {
    console.log(`    ${k}: ${JSON.stringify(c.from)} → ${JSON.stringify(c.to)}`);
  }
}

if (!APPLY) {
  console.log('\nDry run only. Re-run with --apply to commit changes.');
  console.log(`Will append new version to portfolio/v1/config-history.json (preserves all prior versions).`);
  process.exit(0);
}

// Backup before apply (defense in depth — regime-recalibrate is APPEND-ONLY by design but extra safety)
const backupDir = path.join(ROOT, `.backup-history-${Date.now()}`);
fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(path.join(ROOT, 'data', 'modes-config.json'), path.join(backupDir, 'modes-config.json'));
fs.copyFileSync(path.join(ROOT, 'portfolio', 'v1', 'config-history.json'), path.join(backupDir, 'config-history.json'));
log(`Pre-apply backup written to ${backupDir} (modes-config.json + config-history.json snapshot).`);

// Apply
const history = readConfigHistory();
const { newCfg, newHistEntry } = applyProposal(proposal, activeCfg, history);
log(`Applied. New active version: ${newCfg._version} (${newCfg._regime}).`);
log(`Appended history entry: ${newHistEntry.id}`);
log(`config-history.json now has ${history.versions.length} versions (no history overwritten).`);
log(`To rollback: cp ${backupDir}/modes-config.json data/ && cp ${backupDir}/config-history.json portfolio/v1/`);
