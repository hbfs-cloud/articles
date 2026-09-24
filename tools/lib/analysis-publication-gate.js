'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

// Read-only: fail before archives, rendering, indexing or staging can change.
function assertAnalysisPublicationReady(jsonPath, options = {}) {
  const root = fs.realpathSync(options.root || path.join(__dirname, '../..'));
  const runner = options.runner || spawnSync;
  const absolute = fs.realpathSync(path.resolve(root, jsonPath));
  const bytes = fs.readFileSync(absolute);
  const data = JSON.parse(bytes);
  const ticker = data.header?.ticker;
  if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(ticker || '')) throw new Error('Invalid analysis ticker');
  const canonical = path.join(root, 'data', 'analyses-data', `${ticker}.json`);
  if (absolute !== canonical) {
    throw new Error('Publication requires the canonical analysis dossier');
  }
  const evidencePath = path.join(root, 'data', 'analyses-evidence', `${ticker}.json`);
  const evidenceBytes = fs.readFileSync(evidencePath);
  const evidence = JSON.parse(evidenceBytes);
  if (evidence.ticker !== ticker || path.resolve(root, evidence.analysis_path || '') !== absolute
      || evidence.analysis_sha256 !== sha256(bytes)) {
    throw new Error('Evidence is not bound to the dossier being published');
  }
  // Le plan est celui que le harnais déclare, à condition qu'il soit enregistré pour le workflow
  // analyse. Un plan codé en dur refusait toute collecte faite avec un plan de repli légitime
  // (source tiingo ou webull quand l'historique yahoo est troué) — constaté le 2026-09-24.
  const harnessPath = path.join(root, 'analyses', ticker, '_data', 'harness.json');
  const declaredPlan = JSON.parse(fs.readFileSync(harnessPath, 'utf8')).plan;
  const contracts = JSON.parse(fs.readFileSync(path.join(root, 'config', 'workflow-contracts.json'), 'utf8'));
  const registered = ((contracts.workflows || {}).analyse || {}).plans || [];
  if (!registered.some(entry => entry.path === declaredPlan)) {
    throw new Error(`Analysis harness plan is not registered for the analyse workflow: ${declaredPlan}`);
  }
  for (const args of [
    ['tools/check-freshness.js', `analyses/${ticker}/_data/harness.json`],
    ['tools/validate-workflows.js', '--run-plan', declaredPlan, `analyses/${ticker}/_data`],
    ['tools/validate-analysis-evidence.js', evidencePath],
    ['tools/check-analysis-editorial-quality.js', '--strict', '--require-current-attestation', absolute],
  ]) {
    const result = runner(process.execPath, args, { cwd: root, stdio: 'inherit' });
    if (result.error || result.status !== 0) throw new Error(`Analysis publication gate failed: ${args[0]}`);
  }
  if (sha256(fs.readFileSync(absolute)) !== sha256(bytes)
      || sha256(fs.readFileSync(evidencePath)) !== sha256(evidenceBytes)) {
    throw new Error('Dossier or evidence changed during publication validation');
  }
  if (options.htmlPath) {
    const htmlPath = path.resolve(root, options.htmlPath);
    if (htmlPath !== path.join(root, 'analyses', ticker, 'index.html')) {
      throw new Error('HTML path does not match the reviewed ticker');
    }
    const { render } = require('../render-analysis');
    if (fs.readFileSync(htmlPath, 'utf8') !== render(data)) {
      throw new Error('HTML differs from the reviewed dossier; render it again before publication');
    }
  }
  return { ticker, analysisSha256: sha256(bytes) };
}

module.exports = { assertAnalysisPublicationReady };
