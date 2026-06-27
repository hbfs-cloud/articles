#!/usr/bin/env node
/**
 * refresh-risk-metrics.js — Populate data/risk-snapshots.json from MCP gateway.
 *
 * For each portfolio mode, calls (in order):
 *   1. CalculatePortfolioVaR (historical, 5-day, 95% + 99%)
 *   2. GetPortfolioStressTest (preset scenarios)
 *   3. GetCorrelationMatrix (open positions only)
 *   4. GetRegimeProbability (single market-level call, shared across modes)
 *
 * Source: scanner/status/history/<latest>.json (current open positions per mode)
 *
 * Transport: HTTP POST to MCP gateway via JSON-RPC 2.0.
 * Configure with env var MCP_GATEWAY_URL (e.g. https://mcp.dailytickers.com/mcp).
 * Without the env var the script writes a stub file documenting the schema.
 *
 * Output: data/risk-snapshots.json
 *
 * Usage:
 *   MCP_GATEWAY_URL=https://mcp.dailytickers.com/mcp node tools/refresh-risk-metrics.js
 *   node tools/refresh-risk-metrics.js --stub          # write empty schema-only stub
 *   node tools/refresh-risk-metrics.js --dry-run       # print payloads, do not write
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const HISTORY = path.join(ROOT, 'scanner', 'status', 'history');
const OUT_PATH = path.join(ROOT, 'data', 'risk-snapshots.json');
const GATEWAY = process.env.MCP_GATEWAY_URL || '';
const STUB = process.argv.includes('--stub');
const DRY = process.argv.includes('--dry-run');
const PORTFOLIO_VALUE_USD = +(process.env.PORTFOLIO_VALUE_USD || 100000);
const MODE_IDS = (() => {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'modes-config.json'), 'utf8'));
    return Object.keys(cfg.modes || {});
  } catch {
    return ['turbo', 'dynamic', 'balanced', 'secured', 'fortress', 'tkl'];
  }
})();

// Bounds-check helpers — reject obviously bad responses from the gateway.
function _isFiniteNumber(x) { return typeof x === 'number' && Number.isFinite(x); }
function _validateVar(v) { return _isFiniteNumber(v) ? v : null; }
function _validateCorr(rho) { return _isFiniteNumber(rho) && rho >= -1 && rho <= 1 ? rho : null; }
function _validateProb(p) { return _isFiniteNumber(p) && p >= 0 && p <= 1 ? p : null; }
function _writeAtomic(p, data) {
  const tmp = p + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, p);
}

function readLatestSnapshot() {
  const files = fs.readdirSync(HISTORY).filter(f => /^\d{8}\.json$/.test(f)).sort();
  if (!files.length) throw new Error('No snapshot in scanner/status/history/');
  return JSON.parse(fs.readFileSync(path.join(HISTORY, files[files.length - 1]), 'utf8'));
}

function buildPositions(modeSnapshot) {
  return (modeSnapshot.positions || []).map(p => ({
    symbol: p.ticker,
    qty: 1,
    avg_cost: +p.entry || +p.current_price || 0,
  })).filter(x => x.symbol && x.avg_cost > 0);
}

function buildSymbolsWeights(modeSnapshot) {
  const positions = modeSnapshot.positions || [];
  if (positions.length === 0) return null;
  const symbols = positions.map(p => p.ticker);
  const equalWeight = +(1 / symbols.length).toFixed(4);
  const weights = symbols.map(() => equalWeight);
  // Normalize last weight so sum = 1.0
  const sum = weights.reduce((s, w) => s + w, 0);
  weights[weights.length - 1] += +(1 - sum).toFixed(4);
  return { symbols, weights };
}

// ─── JSON-RPC 2.0 transport — HTTPS only ─────────────────────────────────────
function jsonrpcCall(toolName, params) {
  if (!GATEWAY) return Promise.reject(new Error('MCP_GATEWAY_URL not set'));
  const url = new URL(GATEWAY);
  if (url.protocol !== 'https:') {
    return Promise.reject(new Error(`HTTPS required for MCP_GATEWAY_URL (got ${url.protocol})`));
  }
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'tools/call',
    params: { name: toolName, arguments: params },
  });
  const opts = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + (url.search || ''),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Content-Length': Buffer.byteLength(body),
    },
    timeout: 30000,
  };
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (j.error) return reject(new Error(j.error.message || 'rpc error'));
          // MCP tools/call wraps the actual payload in result.content[0].text (JSON string).
          // Unwrap so callers get the raw object directly.
          const r = j.result;
          if (r && r.isError) {
            const msg = r.content?.[0]?.text || 'MCP tool returned isError';
            return reject(new Error(msg));
          }
          if (r && r.content && Array.isArray(r.content) && r.content[0]?.type === 'text') {
            try { resolve(JSON.parse(r.content[0].text)); }
            catch { resolve(r.content[0].text); }
            return;
          }
          resolve(r);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('rpc timeout')); });
    req.write(body);
    req.end();
  });
}

// Fetch bars from QueryData and compute weighted portfolio returns for VaR Mode 1.
// Mode 2 (symbols+weights) fails with "no historical data" — the gateway's VaR module
// doesn't have its own bar store. Mode 1 (pre-computed returns array) works.
async function fetchPortfolioReturns(symbols, weights, lookbackDays) {
  const barsResult = await jsonrpcCall('QueryData', {
    symbols: symbols.join(','),
    types: 'bars_daily',
    days: lookbackDays + 10,
  });
  const barsBySymbol = {};
  for (const r of (barsResult.results || [])) {
    if (r.data_type !== 'bars_daily' || !r.data) continue;
    for (let i = 0; i < (r.symbols || []).length; i++) {
      const sym = r.symbols[i];
      const bars = r.data[i] || [];
      const closes = bars.map(b => b[4]).filter(c => c > 0);
      if (closes.length < 20) continue;
      const rets = [];
      for (let j = 1; j < closes.length; j++) {
        rets.push(+((closes[j] - closes[j - 1]) / closes[j - 1]).toFixed(6));
      }
      barsBySymbol[sym] = rets;
    }
  }
  const validSymbols = symbols.filter(s => barsBySymbol[s]);
  if (validSymbols.length === 0) return null;
  const minLen = Math.min(...validSymbols.map(s => barsBySymbol[s].length));
  const portfolioReturns = [];
  for (let d = 0; d < minLen; d++) {
    let dayRet = 0;
    for (let i = 0; i < validSymbols.length; i++) {
      const idx = symbols.indexOf(validSymbols[i]);
      dayRet += barsBySymbol[validSymbols[i]][d] * weights[idx];
    }
    portfolioReturns.push(+dayRet.toFixed(6));
  }
  return portfolioReturns;
}

async function fetchModeRisk(modeId, modeSnapshot) {
  const sw = buildSymbolsWeights(modeSnapshot);
  const positions = buildPositions(modeSnapshot);
  if (!sw || positions.length === 0) {
    return { asOf: new Date().toISOString(), reason: 'no_positions' };
  }

  const out = { asOf: new Date().toISOString(), portfolioValueUsd: PORTFOLIO_VALUE_USD };

  // VaR 95 + 99 (5-day horizon) — Mode 1: compute returns from bars, pass directly
  const portfolioReturns = await fetchPortfolioReturns(sw.symbols, sw.weights, 252).catch(e => {
    console.log(`  [warn] fetchReturns ${modeId}: ${e.message}`);
    return null;
  });

  if (portfolioReturns && portfolioReturns.length >= 20) {
    try {
      const var95 = await jsonrpcCall('CalculatePortfolioVaR', {
        portfolio_value: PORTFOLIO_VALUE_USD,
        returns: JSON.stringify(portfolioReturns),
        confidence_level: 0.95,
        horizon: 5,
        method: 'historical',
      });
      out.var95_5d = _validateVar(var95?.totalVaR ?? var95?.value_at_risk ?? null);
      out.expectedShortfall95_5d = _validateVar(var95?.expectedShortfall ?? var95?.expected_shortfall ?? null);
      out.method = 'historical';
    } catch (e) { console.log(`  [warn] VaR95 ${modeId}: ${e.message}`); }

    try {
      const var99 = await jsonrpcCall('CalculatePortfolioVaR', {
        portfolio_value: PORTFOLIO_VALUE_USD,
        returns: JSON.stringify(portfolioReturns),
        confidence_level: 0.99,
        horizon: 5,
        method: 'historical',
      });
      out.var99_5d = _validateVar(var99?.totalVaR ?? var99?.value_at_risk ?? null);
    } catch (e) { console.log(`  [warn] VaR99 ${modeId}: ${e.message}`); }
  } else {
    console.log(`  [warn] VaR ${modeId}: insufficient returns data (${portfolioReturns?.length || 0} days)`);
  }

  // Stress test
  try {
    const stress = await jsonrpcCall('GetPortfolioStressTest', {
      positions: JSON.stringify(positions),
      scenarios: 'fed_plus_100bps,equity_minus_20pct,vix_spike_to_40,btc_minus_30pct,geopolitical',
      horizon_days: 5,
    });
    out.stressScenarios = stress?.results || stress?.scenarios || [];
  } catch (e) { console.log(`  [warn] stress ${modeId}: ${e.message}`); }

  // Correlation
  try {
    if (sw.symbols.length >= 2) {
      const corr = await jsonrpcCall('GetCorrelationMatrix', {
        symbols: sw.symbols.join(','),
        window_days: 60,
        method: 'pearson',
      });
      out.maxPairwiseCorrelation = _validateCorr(corr?.max_pair?.correlation ?? corr?.max_pair?.rho ?? null);
      out.avgCorrelation = _validateCorr(corr?.avg_off_diagonal ?? null);
    }
  } catch (e) { console.log(`  [warn] correlation ${modeId}: ${e.message}`); }

  return out;
}

async function fetchRegimeProbability() {
  try {
    const r = await jsonrpcCall('GetRegimeProbability', {
      horizon_days: 5,
      model: 'ensemble',
      include_history: false,
    });
    return {
      asOf: new Date().toISOString(),
      currentState: r?.current_state || null,
      currentStateConfidence: r?.current_state_confidence ?? null,
      probabilities: r?.probabilities || null,
      transition5d: r?.transition_5d || null,
      expectedReturnSpyPct: r?.expected_return_spy_pct ?? null,
      expectedDrawdownPct: r?.expected_drawdown_pct ?? null,
      model: r?.model || 'ensemble',
    };
  } catch (e) { console.log(`  [warn] regime: ${e.message}`); return null; }
}

async function main() {
  const now = new Date().toISOString();

  let STUB_FALLBACK = false;

  if (!GATEWAY && !DRY) {
    console.log('  [info] MCP_GATEWAY_URL not set (post-OAuth2 migration).');
    console.log('  Writing stub — real risk metrics are computed by cloud routines with MCP OAuth2 access.');
    STUB_FALLBACK = true;
  }

  if (STUB || STUB_FALLBACK) {
    console.log('  [info] Writing schema-only stub');
    const stub = {
      asOf: now,
      portfolioValueUsd: PORTFOLIO_VALUE_USD,
      regimeProbability: null,
      modes: Object.fromEntries(MODE_IDS.map(id => [id, null])),
      _schema: {
        asOf: 'ISO-8601',
        modes: '<modeId>: { asOf, var95_5d, var99_5d, expectedShortfall95_5d, portfolioValueUsd, stressScenarios[], maxPairwiseCorrelation, avgCorrelation, method }',
        regimeProbability: '{ currentState, probabilities{risk_on,neutral,early_risk_off,crisis}, transition5d, expectedReturnSpyPct, expectedDrawdownPct }',
      },
    };
    _writeAtomic(OUT_PATH, JSON.stringify(stub, null, 2));
    console.log(`  [ok]  wrote stub to ${OUT_PATH}`);
    return;
  }
  const snap = readLatestSnapshot();
  console.log(`  Source: scanner/status/history/${snap.date}.json`);
  if (DRY) console.log('  [dry-run] no file will be written');

  const result = {
    asOf: now,
    portfolioValueUsd: PORTFOLIO_VALUE_USD,
    snapshotDate: snap.date,
    regimeProbability: await fetchRegimeProbability(),
    modes: {},
  };

  for (const id of MODE_IDS) {
    const mode = snap.modes?.[id];
    if (!mode) { result.modes[id] = null; continue; }
    console.log(`  → ${id}`);
    result.modes[id] = await fetchModeRisk(id, mode);
  }

  if (DRY) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  _writeAtomic(OUT_PATH, JSON.stringify(result, null, 2));
  console.log(`  [ok]  wrote ${OUT_PATH}`);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
