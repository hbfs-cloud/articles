#!/usr/bin/env node
/*
 * ───────────────────────────────────────────────────────────────────────────
 * DÉPRÉCIÉ (2026-07-22) POUR L'AFFICHAGE — pit-state.json / pit-forward.json ne
 * sont PLUS consommés par gen-status-page.js ni gen-api.js. Source unique de la
 * performance affichée = le sweep frozen (computeStatsFromTrades dans sweep.js).
 * Fichier CONSERVÉ pour référence / rollback ; ne pas supprimer.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * pit-forward.js — FORWARD-ONLY equity layer anchored to the SEALED frozen curve.
 *
 * Product goal: the status page shows ONE current, continuous equity number per mode —
 * the immutable sealed history + a forward delta from trades closed/opened since the
 * anchor — WITHOUT ever recomputing or rewriting a sealed point.
 *
 * Contract (per mode with frozen_<mode>):
 *   • anchorDate / anchorValue = the LAST point of frozen.equityCurve, re-read on EVERY
 *     run (never cached — guards R4). baseline = anchorValue (NOT 100).
 *   • Trade source = data/backtest-trades.json[<mode>] (the REAL book — NOT pit-engine.js,
 *     a parallel/divergent backtest). Opened READ-ONLY (invariant I3).
 *   • Trade classification:
 *       (a) resolved, exitDate <= anchorDate  → IGNORED (already inside anchorValue).
 *       (b) resolved, exitDate  > anchorDate  → adds pnlPct*weight to the forward realized
 *           FROM exitDate. If it was open-at-anchor, only the INCREMENT beyond the anchor
 *           MtM is added: (pnlPct - unrealizedAtAnchor)*weight.
 *       (c) open-at-anchor (entry<=anchor, unresolved) → unrealizedAtAnchor computed ONCE
 *           (MtM at close<=anchor); daily contribution = (unrealized(j) - unrealizedAtAnchor)*weight
 *           (increment only — the P&L already in the anchor is never re-counted).
 *       (d) opened AFTER the anchor → full unrealized/realized, normal.
 *   • weight(trade,mode) via sweep.getWeight → modes-config-history.json. I6/R2: a post-anchor
 *     trade whose configVersion is NOT in the history → healthy=false + reason. NEVER a default
 *     weight (that is the config-blind bug that deflated dynamic 91→75 on 2026-07-02).
 *   • Prices via sweep.fetchOHLCV / priceCache (same path as pit-engine.js). I8: a required
 *     price missing / stale (>2 biz days) / aberrant → healthy=false + reason (no fabrication).
 *   • Output data/pit-forward.json. AUTO-VERIFY before write: I1 (ec prefix byte-identical to
 *     frozen.equityCurve, tol 0) + I2 (seam strict-equal). On failure → healthy=false, no curve.
 *
 * Adopted forward path (the diagnostic-only sibling is extend-frozen.js).
 * DOES NOT modify backtest-results.json / backtest-trades.json / trade-chain.json.
 *
 * Usage: node tools/pit-forward.js [--modes fortress,dynamic] [--verbose]
 */

const fs = require('fs');
const path = require('path');

// sweep.js only runs main() under require.main === module, so requiring is side-effect free.
const sweep = require('./sweep.js');
const { fetchOHLCV, priceCache, getWeight } = sweep;

const ROOT = path.join(__dirname, '..');
const RESULTS_PATH = path.join(ROOT, 'data', 'backtest-results.json');

// Modes SCRIPTÉS (assetClass:'dtx') : pilotés par le moteur systematic-tss via le MCP. Ils n'ont
// AUCUNE notion de poids scanner / config-history — leur equity vient du staging dtx (data/dtx/*.json,
// replay MCP), lu directement par gen-status-page. pit-forward (poids via getWeight + garde I6) ne
// s'applique donc PAS à eux : on les SAUTE (sinon faux « configVersion introuvable … I6 » parasites).
let MODES_CFG = {};
try {
  const _mc = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'modes-config.json'), 'utf8'));
  const _arr = _mc.modes || _mc;
  if (Array.isArray(_arr)) { for (const m of _arr) if (m && (m.id || m.slug)) MODES_CFG[m.id || m.slug] = m; }
  else { for (const [k, v] of Object.entries(_arr)) if (v && typeof v === 'object') MODES_CFG[k] = v; } // objet clé-par-id
} catch (_) { /* absent → tout traité comme discrétionnaire (comportement historique) */ }
const isDtxMode = (id) => !!(MODES_CFG[id] && (MODES_CFG[id].assetClass === 'dtx' || MODES_CFG[id].filterName === 'dtx_engine'));
const TRADES_PATH = path.join(ROOT, 'data', 'backtest-trades.json');
const CFG_HIST_PATH = path.join(ROOT, 'data', 'modes-config-history.json');
const OUT_PATH = path.join(ROOT, 'data', 'pit-forward.json');

// Canonical NY trading day (matches gen-status-page TODAY_ISO).
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

const ARGS = (() => {
  const out = { modes: null, verbose: false };
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (!m) continue;
    if (m[1] === 'verbose') out.verbose = true;
    else if (m[1] === 'modes' && m[2]) out.modes = m[2].split(',').map(s => s.trim());
  }
  return out;
})();
const log = (...a) => ARGS.verbose && console.log(...a);

const RESOLVED_STATUSES = new Set(['tp1', 'tp1_partial', 'tp2', 'sl', 'expired', 'rotated', 'breakeven', 'trail', 'liquidated']);
const isResolved = t => !!t.exitDate && RESOLVED_STATUSES.has((t.status || '').replace(/_amb$/, ''));
const entryOf = t => t.entryDate || t.scanDate;

// ── Business-day helpers ──────────────────────────────────────────────────────
function bizDaysAfter(afterDate, toDate) {
  // Weekday dates strictly > afterDate and <= toDate.
  const days = [];
  const d = new Date(afterDate + 'T12:00:00Z');
  const end = new Date(toDate + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  while (d <= end) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) days.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}
function bizDaysBetween(a, b) {
  if (!a || !b || a >= b) return 0;
  let n = 0;
  const d = new Date(a + 'T12:00:00Z');
  const end = new Date(b + 'T12:00:00Z');
  while (d < end) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) n++;
  }
  return n;
}

// Config-version registry (same shape sweep.computeStatsFromTrades builds).
function loadCfgVersions() {
  const cfgVersions = {};
  if (fs.existsSync(CFG_HIST_PATH)) {
    try {
      const hist = JSON.parse(fs.readFileSync(CFG_HIST_PATH, 'utf8'));
      for (const v of (hist.versions || [])) cfgVersions[v.id] = v.config;
    } catch (e) { /* leave empty — every lookup then fails I6, which is the safe outcome */ }
  }
  return cfgVersions;
}

// Last close on-or-before `day` for a ticker (carry-forward), or null if none.
function closeOnOrBefore(ticker, day) {
  const hist = priceCache[ticker];
  if (!hist) return null;
  let best = null, bestDate = '';
  for (const d of Object.keys(hist)) {
    if (d <= day && d > bestDate) {
      const c = hist[d] && hist[d].close;
      if (c != null && isFinite(c) && c > 0) { best = c; bestDate = d; }
    }
  }
  return best;
}
function latestPriceDate(ticker) {
  const hist = priceCache[ticker];
  if (!hist) return null;
  const ds = Object.keys(hist).filter(d => hist[d] && hist[d].close != null).sort();
  return ds.length ? ds[ds.length - 1] : null;
}

// ── Per-mode forward computation ──────────────────────────────────────────────
async function forwardForMode(id, frozen, allTrades, cfgVersions) {
  const reasons = [];
  let healthy = true;

  // Modes scriptés (dtx) : hors périmètre pit-forward — leur equity vient du MCP (staging dtx),
  // pas des poids scanner. On les saute proprement (pas de forward, pas d'erreur configVersion/I6).
  if (isDtxMode(id)) {
    return { mode: id, healthy: false, skipped: true,
      reasons: ['mode scripté (dtx) — piloté par le MCP (staging dtx), hors périmètre pit-forward (pas de poids scanner)'],
      anchorDate: null, anchorValue: null, asOf: null, ec: [], ret: null, dd: null, wr: 0, pf: 0,
      trades: 0, avgHold: 0, unrealized: 0, newPoints: 0, sealedLen: 0 };
  }

  const sealed = (frozen.equityCurve || []).filter(p => p && p.date);
  if (sealed.length === 0) {
    return { mode: id, healthy: false, reasons: ['frozen.equityCurve vide'], anchorDate: null,
      anchorValue: null, asOf: null, ec: [], ret: null, dd: null, wr: 0, pf: 0, trades: 0,
      avgHold: 0, unrealized: 0, newPoints: 0, sealedLen: 0 };
  }
  const anchorPt = sealed[sealed.length - 1];
  const anchorDate = anchorPt.date;
  const anchorValue = anchorPt.value; // baseline = anchorValue (NOT 100)

  // Relevant forward trades: still open OR resolved strictly after the anchor.
  // (Resolved on-or-before anchor = class (a) → already inside anchorValue → ignored.)
  const relevant = (allTrades || []).filter(t =>
    (t.actualEntry > 0) && entryOf(t) && (!t.exitDate || t.exitDate > anchorDate));

  // I6/R2: resolve each weight; a missing configVersion is a HARD unhealthy (never default).
  for (const t of relevant) {
    const w = getWeight(t, id, cfgVersions, null);
    if (w == null) {
      healthy = false;
      reasons.push(`configVersion introuvable pour ${t.ticker} (${t.configVersion || 'none'}) — poids par défaut interdit (I6)`);
    }
    t.__w = w;
  }

  // Tickers needing prices: EVERY relevant trade is MtM'd on each forward day it is held
  // (open-at-anchor → baseline close; resolved-after-anchor → daily MtM over entry..exit;
  // still-open → daily MtM through today). So fetch closes for all of them.
  const priceTickers = new Set(relevant.map(t => t.ticker));
  for (const tk of priceTickers) {
    if (!priceCache[tk]) {
      try { await fetchOHLCV(tk); } catch (e) { /* handled below */ }
    }
    if (!priceCache[tk]) {
      healthy = false;
      reasons.push(`prix indisponible ${tk} (I8)`);
    }
  }

  // Anchor-time MtM (computed ONCE per open-at-anchor trade).
  for (const t of relevant) {
    if (entryOf(t) <= anchorDate) {
      const closeA = closeOnOrBefore(t.ticker, anchorDate);
      if (closeA == null) {
        healthy = false;
        reasons.push(`close à l'ancre ${anchorDate} manquant pour ${t.ticker} (I8)`);
        t.__baseline = 0;
      } else {
        t.__baseline = ((closeA - t.actualEntry) / t.actualEntry) * 100;
      }
    } else {
      t.__baseline = 0; // opened after the anchor → nothing of it is inside anchorValue
    }
  }

  // I8 staleness: any position still open at the run must have a fresh mark (<=2 biz days).
  for (const t of relevant) {
    if (isResolved(t)) continue;
    const lp = latestPriceDate(t.ticker);
    if (lp && bizDaysBetween(lp, TODAY) > 2) {
      healthy = false;
      reasons.push(`prix stale pour ${t.ticker} (dernier ${lp} > 2 j ouvrés avant ${TODAY}) (I8)`);
    }
  }

  // ── Build the new daily points (strictly after the anchor, up to today) ──
  const newDays = bizDaysAfter(anchorDate, TODAY);
  const newPoints = [];
  for (const day of newDays) {
    let realized = 0, unrealized = 0;
    for (const t of relevant) {
      const w = t.__w;
      if (w == null) continue; // unhealthy already flagged; skip to avoid NaN
      const b = t.__baseline || 0;
      if (isResolved(t) && t.exitDate <= day) {
        // (b) realized by this day — increment beyond the anchor MtM (b=0 unless open-at-anchor)
        realized += ((t.pnlPct || 0) - b) * w;
      } else if (entryOf(t) <= day) {
        // (c)/(d) open as of this day (unresolved, OR resolved but exit still ahead)
        let close = closeOnOrBefore(t.ticker, day);
        if (close == null) {
          // No mark yet for an open position on this day → cannot MtM honestly.
          healthy = false;
          reasons.push(`close manquant ${t.ticker} @ ${day} (I8)`);
          continue;
        }
        const unre = ((close - t.actualEntry) / t.actualEntry) * 100;
        unrealized += (unre - b) * w;
      }
      // not yet entered as of `day` → 0
    }
    const value = anchorValue + realized + unrealized;
    newPoints.push({
      date: day,
      value: +value.toFixed(2),
      realized: +realized.toFixed(2),
      unrealized: +unrealized.toFixed(2),
    });
  }

  // ── Assemble the full equity curve: sealed prefix VERBATIM + new points ──
  const ec = healthy ? [...sealed, ...newPoints] : [...sealed];
  const sealedLen = sealed.length;

  // I1 — prefix byte-identical to frozen.equityCurve (tol 0).
  for (let i = 0; i < sealedLen; i++) {
    if (ec[i].date !== sealed[i].date || ec[i].value !== sealed[i].value) {
      healthy = false;
      reasons.push(`I1 violé au point ${i} (préfixe ≠ scellé)`);
      break;
    }
  }
  // I2 — seam strict-equal: last sealed point unchanged and continuous with the anchor.
  if (ec[sealedLen - 1].value !== anchorValue) {
    healthy = false;
    reasons.push('I2 violé (seam ≠ anchorValue)');
  }
  // If any invariant broke, do NOT expose an appended (invalid) curve.
  const finalEc = healthy ? ec : [...sealed];
  const finalNewPoints = healthy ? newPoints.length : 0;

  // Stats over POST-ANCHOR resolved trades only.
  const postResolved = relevant.filter(isResolved);
  const wins = postResolved.filter(t => (t.pnlPct || 0) > 0);
  const losses = postResolved.filter(t => (t.pnlPct || 0) <= 0);
  const wr = postResolved.length ? +((wins.length / postResolved.length) * 100).toFixed(1) : 0;
  const gw = wins.reduce((s, t) => s + (t.pnlPct || 0), 0);
  const gl = Math.abs(losses.reduce((s, t) => s + (t.pnlPct || 0), 0));
  const pf = gl > 0 ? +(gw / gl).toFixed(2) : (gw > 0 ? 99 : 0);
  const holds = postResolved.map(t => t.holdDays || 0).filter(x => x > 0);
  const avgHold = holds.length ? +(holds.reduce((a, b) => a + b, 0) / holds.length).toFixed(1) : 0;

  // Continuous total return = last point value − 100 (whole curve sits on the 100 baseline).
  const lastPt = finalEc[finalEc.length - 1];
  const ret = +(lastPt.value - 100).toFixed(2);
  // Full-curve max drawdown.
  let peak = -Infinity, maxDD = 0;
  for (const p of finalEc) { if (p.value > peak) peak = p.value; const dd = peak > 0 ? (peak - p.value) / peak * 100 : 0; if (dd > maxDD) maxDD = dd; }
  const dd = +(-maxDD).toFixed(2);
  // MtM annotation = unrealized of the last appended point (0 when curve ends flat/closed).
  const lastNew = finalNewPoints > 0 ? newPoints[newPoints.length - 1] : null;
  const unrealized = lastNew ? lastNew.unrealized : 0;

  return {
    mode: id, healthy, reasons,
    anchorDate, anchorValue, asOf: lastPt.date,
    sealedLen, newPoints: finalNewPoints,
    ec: finalEc, ret, dd, wr, pf, trades: postResolved.length, avgHold, unrealized,
  };
}

async function run() {
  const results = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf8'));      // READ-ONLY (I3)
  const trades = JSON.parse(fs.readFileSync(TRADES_PATH, 'utf8'));        // READ-ONLY (I3)
  const cfgVersions = loadCfgVersions();

  const frozenModes = Object.keys(results).filter(k => k.startsWith('frozen_')).map(k => k.slice(7));
  const targetModes = ARGS.modes ? frozenModes.filter(m => ARGS.modes.includes(m)) : frozenModes;

  const out = { generated_at: new Date().toISOString(), asOf: TODAY, modes: {} };
  for (const id of targetModes) {
    const entry = await forwardForMode(id, results[`frozen_${id}`], trades[id] || [], cfgVersions);
    out.modes[id] = entry;
    const flag = entry.healthy ? 'OK ' : 'UNHEALTHY';
    console.log(`${id.padEnd(10)} ${flag} anchor=${entry.anchorDate}@${entry.anchorValue} → ret=${entry.ret}% dd=${entry.dd}% new=${entry.newPoints} post-trades=${entry.trades}${entry.reasons.length ? '  [' + entry.reasons.join('; ') + ']' : ''}`);
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${OUT_PATH} (${Object.keys(out.modes).length} modes).`);
}

if (require.main === module) {
  run().catch(e => { console.error('Fatal:', e.message, e.stack); process.exit(1); });
}

module.exports = { forwardForMode, loadCfgVersions, bizDaysAfter, bizDaysBetween };
