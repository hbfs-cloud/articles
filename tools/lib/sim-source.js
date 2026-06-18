'use strict';

/**
 * sim-source.js — the read-switch helper for the articles ⇄ broker-simulator parallel-run.
 *
 * cutover-decision.js writes data/source-of-truth.json = { "<mode>": "sim" | "articles", ... }.
 * When a mode is "sim", the public page/API render that mode's POSITIONS + EQUITY from the
 * broker-simulator instead of articles' pit-state. This module is the single, safe gateway for
 * that switch, with TWO hard rules:
 *
 *   1. HARD FALLBACK. Any error, missing token, missing/stale cache, or a mode not flagged "sim"
 *      ⇒ the caller uses its existing articles source EXACTLY as today. Nothing here ever throws
 *      to the caller; every accessor returns null to mean "fall back".
 *
 *   2. RENDER IS NETWORK-FREE. gen-api.js is synchronous and gen-status-page.js renders inside a
 *      tight loop; neither should block on the sim. So the nightly first calls refreshCache()
 *      (async, non-blocking) to pull each sim-flagged mode's portfolio/equity into
 *      data/sim-source-cache.json, then the render scripts read that cache SYNCHRONOUSLY.
 *
 * pit-state is still computed in shadow regardless — this only changes what gets RENDERED.
 */

const fs   = require('fs');
const path = require('path');

const ROOT       = path.join(__dirname, '..', '..');
const SOT_FILE   = path.join(ROOT, 'data', 'source-of-truth.json');
const CACHE_FILE = path.join(ROOT, 'data', 'sim-source-cache.json');

// Cache entries older than this are ignored (treated as absent → articles fallback), so a stale
// cache from a night the refresh failed can never feed the public page out-of-date sim numbers.
const CACHE_MAX_AGE_MS = 36 * 60 * 60 * 1000; // 36h (covers a skipped night + clock slack)

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

// ── source-of-truth flag ─────────────────────────────────────────────────────────
// Returns true ONLY when source-of-truth.json explicitly marks the mode "sim". Missing file,
// unreadable file, or any other value ⇒ false (articles). Safe by default.
function modeUsesSim(mode) {
  const sot = readJSON(SOT_FILE, null);
  return !!sot && sot[mode] === 'sim';
}

function anyModeUsesSim(modes) {
  return (modes || []).some(modeUsesSim);
}

// ── cache refresh (async, nightly, non-blocking) ───────────────────────────────────
// For each mode flagged "sim", pull portfolio + equity-curve + positions from the sim and store a
// normalized snapshot. A mode we cannot fetch is simply omitted (caller falls back to articles).
// Returns the cache object it wrote (or the existing one on total failure). NEVER throws.
async function refreshCache(modes) {
  let SimulatorClient;
  try { ({ SimulatorClient } = require('./simulator-client')); }
  catch (e) { console.warn(`sim-source: client unavailable (${e.message}) — cache not refreshed`); return readJSON(CACHE_FILE, {}); }

  const simModes = (modes || []).filter(modeUsesSim);
  if (simModes.length === 0) {
    // No mode wants sim → write an empty, fresh cache so render falls back everywhere.
    const empty = { updatedAt: new Date().toISOString(), modes: {} };
    try { fs.writeFileSync(CACHE_FILE, JSON.stringify(empty, null, 2) + '\n'); } catch {}
    return empty;
  }

  let client;
  try { client = new SimulatorClient(); }
  catch (e) { console.warn(`sim-source: ${e.message} — cache not refreshed (modes stay on articles)`); return readJSON(CACHE_FILE, {}); }

  const cache = { updatedAt: new Date().toISOString(), modes: {} };
  for (const mode of simModes) {
    try {
      const accountId   = await client.resolveAccountId(mode);
      const portfolio   = await client.getPortfolio(accountId);
      const equityCurve = await client.getEquityCurve(accountId);
      cache.modes[mode] = {
        accountId,
        portfolio:   portfolio   || null,
        equityCurve: Array.isArray(equityCurve) ? equityCurve : [],
      };
      const nPos = portfolio && Array.isArray(portfolio.positions) ? portfolio.positions.length : 0;
      console.log(`  sim-source ${mode}: cached ${nPos} position(s), ${cache.modes[mode].equityCurve.length} equity pt(s)`);
    } catch (e) {
      console.warn(`  sim-source ${mode}: refresh failed (${e.message}) — mode falls back to articles`);
    }
  }
  try { fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2) + '\n'); }
  catch (e) { console.warn(`sim-source: cannot write cache (${e.message})`); }
  return cache;
}

// ── sync cache read (render time) ──────────────────────────────────────────────────
let _cache;            // memoized per-process
let _cacheLoaded = false;
function loadCache() {
  if (_cacheLoaded) return _cache;
  _cacheLoaded = true;
  const c = readJSON(CACHE_FILE, null);
  if (!c || !c.modes) { _cache = null; return _cache; }
  // Staleness guard.
  const age = c.updatedAt ? (Date.now() - new Date(c.updatedAt).getTime()) : Infinity;
  if (!(age >= 0) || age > CACHE_MAX_AGE_MS) {
    console.warn('sim-source: cache stale or undated — ignoring (articles fallback)');
    _cache = null; return _cache;
  }
  _cache = c;
  return _cache;
}

// Returns the sim-cached entry for a mode ONLY when the mode is flagged "sim" AND the cache holds
// a usable snapshot for it. Otherwise null → caller falls back to articles.
function simEntry(mode) {
  if (!modeUsesSim(mode)) return null;
  const c = loadCache();
  if (!c) return null;
  const e = c.modes[mode];
  return e || null;
}

// simPositions(mode): normalized open positions from the sim portfolio, or null to fall back.
// Shape mirrors the fields gen-api / gen-status-page already use from articles positions:
//   { ticker, entry, current_price, return_pct, qty }
// The sim portfolio (PortfolioSummary) flattens PositionDetail, so symbol/avg_price/current_price
// are top-level; unrealized_pnl_pct is the per-position % P&L the page renders as return_pct.
function simPositions(mode) {
  const e = simEntry(mode);
  if (!e || !e.portfolio || !Array.isArray(e.portfolio.positions)) return null;
  return e.portfolio.positions.map(d => {
    const sym = (d.position && d.position.symbol) || d.symbol || '';
    const avg = (d.position && d.position.avg_price) ?? d.avg_price ?? 0;
    const cur = (d.position && d.position.current_price) ?? d.current_price ?? 0;
    const qty = (d.position && d.position.qty) ?? d.qty ?? 0;
    const ret = d.unrealized_pnl_pct != null ? d.unrealized_pnl_pct
              : (avg > 0 ? (cur - avg) / avg * 100 : 0);
    return {
      ticker: (sym || '').toUpperCase(),
      entry: avg,
      current_price: cur,
      return_pct: +(+ret).toFixed(2),
      qty,
    };
  }).filter(p => p.ticker);
}

// simEquityCurve(mode): the sim NAV curve normalized to articles' { date:'YYYY-MM-DD', value }
// base-100 shape (value = total_equity / initial_equity * 100). Returns null to fall back.
// initialEquity is read from simulator-config.json (default 100000), matching how the backfill
// scaled it (total_equity = value/100 * initial_equity), so the round-trip is base-100 again.
function simEquityCurve(mode, initialEquity) {
  const e = simEntry(mode);
  if (!e || !Array.isArray(e.equityCurve) || e.equityCurve.length === 0) return null;
  const base = initialEquity > 0 ? initialEquity : 100000;
  const out = [];
  for (const pt of e.equityCurve) {
    const te = pt.total_equity;
    if (te == null) continue;
    const date = typeof pt.ts === 'string' ? pt.ts.slice(0, 10) : null;
    if (!date) continue;
    out.push({ date, value: +(te / base * 100).toFixed(2) });
  }
  return out.length ? out : null;
}

module.exports = {
  modeUsesSim,
  anyModeUsesSim,
  refreshCache,
  loadCache,
  simPositions,
  simEquityCurve,
  SOT_FILE,
  CACHE_FILE,
};

// ── CLI: `node tools/lib/sim-source.js --refresh` ──────────────────────────────────
// The nightly's pre-render cache refresh. Reads pilot modes from simulator-config.json, pulls
// each sim-flagged mode's portfolio/equity into the cache, and ALWAYS exits 0 — a sim/token
// problem must never abort the nightly (the render path falls back to articles on its own).
if (require.main === module && process.argv.includes('--refresh')) {
  (async () => {
    let pilotModes = ['turbo', 'dynamic', 'balanced', 'bull', 'secured'];
    try { const { loadConfig } = require('./simulator-client'); pilotModes = loadConfig().pilotModes || pilotModes; } catch {}
    console.log(`[sim-source] refreshing cache for sim-flagged modes among: ${pilotModes.join(',')}`);
    await refreshCache(pilotModes);
  })().catch(e => { console.error(`[sim-source] refresh disabled: ${e.message}`); }).finally(() => process.exit(0));
}
