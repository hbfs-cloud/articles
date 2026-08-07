'use strict';
// ─── tools/lib/mode-stats.js ─────────────────────────────────────────────────
// SHARED accounting lib — SOURCE UNIQUE de la comptabilité des modes.
//
// Extraction VERBATIM depuis tools/sweep.js (getWeight + computeStatsFromTrades)
// pour que sweep.js, gen-status-page.js et gen-api.js calculent EXACTEMENT les
// mêmes stats (frozen_*, backtest-results.json, hero/chart-scellé, API) à partir
// de la même formule — plus de divergence entre pit-state et sweep.
//
// La comptabilité est POINT-IN-TIME et NE DOIT PAS changer :
//   dailyEquity = 100 + Σ(pnlPct * getWeight) + unrealized
//   getWeight = (1/portfolioSize)*positionSizePct du configVersion stampé sur le
//   trade (via data/modes-config-history.json). Ex balanced +42% = 23 trades à
//   poids 1.0 (portfolioSize=1 fév-avr) + 48 à poids 0.333. C'EST CORRECT.
//
// Différence unique vs la version inline de sweep.js : le priceCache n'est plus
// une variable de module (closure) mais passé via `opts.priceCache`. sweep.js
// garde un wrapper mince qui injecte SON priceCache de module → sortie identique
// et le partage-par-référence avec pit-forward.js/extend-frozen.js préservé.

const fs = require('fs');
const path = require('path');
const invalidCohorts = require('./invalid-cohorts');

const ROOT = path.join(__dirname, '..', '..');

// ─── Business-day helpers (copie verbatim depuis sweep.js) ───────────────────
function addBizDays(dateStr, n) {
  let d = new Date(dateStr + 'T12:00:00Z');
  const step = n >= 0 ? 1 : -1;
  let added = 0;
  while (added < Math.abs(n)) {
    d.setDate(d.getDate() + step);
    if (d.getDay() !== 0 && d.getDay() !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

function getAllBizDays(startDate, endDate) {
  const days = [];
  let d = new Date(startDate + 'T12:00:00Z');
  const end = new Date(endDate + 'T12:00:00Z');
  while (d <= end) {
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      days.push(d.toISOString().slice(0, 10));
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function bizDaysBetween(dateA, dateB) {
  let d = new Date(dateA + 'T12:00:00Z');
  const end = new Date(dateB + 'T12:00:00Z');
  if (d >= end) return 0;
  let count = 0;
  while (d < end) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) count++;
  }
  return count;
}

// ─── Calendar-day variants (24/7 markets: crypto, and forex-leaning) ─────────
// Same signatures as the biz-day helpers but counting EVERY calendar day (no
// weekend skip). Used only by modes that opt in via config.calendar='24/7'.
function addCalDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function getAllCalDays(startDate, endDate) {
  const days = [];
  let d = new Date(startDate + 'T12:00:00Z');
  const end = new Date(endDate + 'T12:00:00Z');
  while (d <= end) {
    days.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return days;
}
function calDaysBetween(dateA, dateB) {
  const a = new Date(dateA + 'T12:00:00Z');
  const b = new Date(dateB + 'T12:00:00Z');
  if (a >= b) return 0;
  return Math.round((b - a) / 86400000);
}

// Calendar selector. Equity modes (no `calendar` field) get the EXACT biz-day
// functions → byte-identical results (parity guaranteed by construction). Only
// modes with calendar='24/7' (crypto/forex) switch to calendar-day counting.
const BIZ_DAY_FNS = { addDays: addBizDays, allDays: getAllBizDays, daysBetween: bizDaysBetween };
const CAL_DAY_FNS = { addDays: addCalDays, allDays: getAllCalDays, daysBetween: calDaysBetween };
function dayFnsFor(calendar) {
  return calendar === '24/7' || calendar === 'cal' || calendar === 'calendar' ? CAL_DAY_FNS : BIZ_DAY_FNS;
}

// ─── Per-trade portfolio weight from config (copie verbatim) ─────────────────
// Module-level (exporté) so forward/replay tooling reuses the SAME weighting.
// Reads the trade's stamped configVersion → (1/portfolioSize)*positionSizePct
// for the mode. Falls back to `defaultWeight` when the version/mode is absent.
function getWeight(trade, modeId, cfgVersions, defaultWeight) {
  const ver = trade.configVersion;
  if (ver && cfgVersions[ver] && cfgVersions[ver][modeId]) {
    const c = cfgVersions[ver][modeId];
    return (1 / (c.portfolioSize || 1)) * (c.positionSizePct || 1);
  }
  return defaultWeight;
}

// ─── Stats from a flat closed-trade list (append-only mode) ──────────────────
// Computes returnTotal, maxDD, winRate, profitFactor, equityCurve from a
// pre-existing list of trades (resolved + pending/open).
// Daily MtM equity curve: realized P&L from closed trades + unrealized from
// open positions at each business day's close (via priceCache).
// Trades must have: pnlPct, exitDate, scanDate, status, holdDays, actualEntry.
// Uses configVersion on each trade to look up the correct weight from config history.
//
// `opts.priceCache` : OHLCV cache { ticker: { 'YYYY-MM-DD': { close } } }. Passé
// par l'appelant (sweep.js injecte son cache de module ; gen-status-page/gen-api
// passent le leur). Absent → {} (getClose → null, unrealized 0 : « pas de data »).
// `opts.priorEC`    : courbe d'equity scellée (append-only) à préfixer.
//
// `opts.excludeInvalidCohorts` : retire du calcul les trades marqués par
// `data/invalid-cohorts.json` (registre déclaratif — voir lib/invalid-cohorts.js).
// DÉFAUT = false : la comptabilité point-in-time publiée reste byte-identique.
// Le MARQUAGE, lui, est toujours reporté dans le retour (`invalidCohortTrades`,
// `invalidCohorts`, `invalidCohortExcluded`) : les trades entrés via un filtre
// inopérant sont visibles partout, y compris quand on ne les exclut pas.
// Activation globale possible via `EXCLUDE_INVALID_COHORTS=1`.
function computeStatsFromTrades(closedTrades, portfolioSize, positionSizePct, modeId, calendar, opts = {}) {
  const DF = dayFnsFor(calendar);
  const priceCache = opts.priceCache || {};
  let allTrades = (closedTrades || []).filter(t => t.actualEntry > 0);

  // ─── Cohortes invalides : marquage systématique, exclusion sur demande ─────
  const excludeInvalid = invalidCohorts.isExclusionEnabled(opts);
  const cohortInfo = invalidCohorts.summarize(allTrades, modeId, excludeInvalid);
  if (excludeInvalid && cohortInfo.invalidCohortTrades > 0) {
    allTrades = invalidCohorts.partitionTrades(allTrades, modeId).valid;
  }

  if (allTrades.length === 0) return null;
  const defaultWeight = (1 / portfolioSize) * (positionSizePct || 1);

  // Load config history for per-trade weight lookup
  const cfgHistPath = path.join(ROOT, 'data', 'modes-config-history.json');
  let cfgVersions = {};
  if (fs.existsSync(cfgHistPath)) {
    try {
      const hist = JSON.parse(fs.readFileSync(cfgHistPath, 'utf8'));
      for (const v of (hist.versions || [])) {
        cfgVersions[v.id] = v.config;
      }
    } catch(e) {}
  }

  const RESOLVED_STATUSES = ['tp1', 'tp1_partial', 'tp2', 'sl', 'expired', 'rotated', 'breakeven', 'trail'];
  const resolved = allTrades.filter(t => {
    const base = (t.status || '').replace(/_amb$/, '');
    return RESOLVED_STATUSES.includes(base);
  });
  const pendingTrades = allTrades.filter(t => t.status === 'pending')
    .sort((a, b) => {
      // Injected (real broker positions) always take priority over sim2 artifacts
      if (a._injected && !b._injected) return -1;
      if (!a._injected && b._injected) return 1;
      return (a.scanDate || '').localeCompare(b.scanDate || '');
    });

  if (resolved.length === 0 && pendingTrades.length === 0) return null;

  // ─── Daily MtM equity curve: realized + unrealized at each biz day close ───
  const allDates = [
    ...resolved.flatMap(t => [t.scanDate, t.entryDate, t.exitDate]),
    ...pendingTrades.flatMap(t => [t.scanDate, t.entryDate, t.exitDate]),
  ].filter(Boolean).sort();
  const firstDate = allDates[0];
  // Use last available price date (not today) to avoid zero-unrealized tail
  // when Yahoo data hasn't arrived yet for the current day.
  const lastTradeDate = allDates[allDates.length - 1];
  let lastPriceDate = '';
  const allMtmTickers = [...new Set([...pendingTrades.map(t => t.ticker), ...resolved.map(t => t.ticker)])];
  for (const ticker of allMtmTickers) {
    const hist = priceCache[ticker];
    if (hist) {
      const dates = Object.keys(hist).sort();
      if (dates.length > 0 && dates[dates.length - 1] > lastPriceDate) {
        lastPriceDate = dates[dates.length - 1];
      }
    }
  }
  // Clamp to today — never extend the equity curve into future dates
  const todayClamp = new Date().toISOString().slice(0, 10);
  if (lastPriceDate > todayClamp) lastPriceDate = todayClamp;
  const endDate = lastPriceDate || lastTradeDate;

  const allDays = DF.allDays(firstDate, endDate);
  const sortedResolved = [...resolved].sort((a, b) => (a.exitDate || '').localeCompare(b.exitDate || ''));

  let realizedPnl = 0;
  let resolvedIdx = 0;
  let peak = 100, maxDD = 0;
  const equityCurve = [];
  const lastKnownClose = {};

  // Append-only: if prior equity curve provided, copy frozen points and fast-forward
  const priorEC = opts.priorEC || [];
  let appendAfter = '';
  if (priorEC.length > 0) {
    for (const pt of priorEC) {
      equityCurve.push(pt);
      if (pt.value > peak) peak = pt.value;
      const dd = ((peak - pt.value) / peak) * 100;
      if (dd > maxDD) maxDD = dd;
    }
    appendAfter = priorEC[priorEC.length - 1].date;
    // Fast-forward realized PnL and resolvedIdx to match the frozen point
    for (let i = 0; i < sortedResolved.length; i++) {
      if (sortedResolved[i].exitDate <= appendAfter) {
        realizedPnl += (sortedResolved[i].pnlPct || 0) * getWeight(sortedResolved[i], modeId || '', cfgVersions, defaultWeight);
        resolvedIdx = i + 1;
      }
    }
  }

  function getClose(ticker, day) {
    const hist = priceCache[ticker];
    if (hist && hist[day]) {
      lastKnownClose[ticker] = hist[day].close;
      return hist[day].close;
    }
    return lastKnownClose[ticker] || null;
  }

  for (const day of allDays) {
    if (appendAfter && day <= appendAfter) continue;
    // Accumulate realized from trades closing on or before this day
    while (resolvedIdx < sortedResolved.length && sortedResolved[resolvedIdx].exitDate <= day) {
      realizedPnl += (sortedResolved[resolvedIdx].pnlPct || 0) * getWeight(sortedResolved[resolvedIdx], modeId || '', cfgVersions, defaultWeight);
      resolvedIdx++;
    }

    // Unrealized: resolved trades not yet closed + pending trades
    let unrealizedPnl = 0;

    // Resolved trades entered but not yet exited as of this day
    // Cap at portfolioSize to prevent inflated equity when FROZEN_ONLY merges
    // overlapping old + new trades (e.g. 23 positions at 10% each = 230% exposure)
    let resolvedExposure = 0;
    const maxExposure = (1 / portfolioSize) * (positionSizePct || 1) * portfolioSize; // = positionSizePct (1.0)
    for (let i = resolvedIdx; i < sortedResolved.length; i++) {
      const t = sortedResolved[i];
      const entryDay = t.entryDate || t.scanDate;
      if (entryDay && entryDay <= day && t.actualEntry > 0) {
        const w = getWeight(t, modeId || '', cfgVersions, defaultWeight);
        if (resolvedExposure + w > maxExposure + 1e-9) continue;
        const close = getClose(t.ticker, day);
        if (close) {
          resolvedExposure += w;
          unrealizedPnl += ((close - t.actualEntry) / t.actualEntry) * 100 * w;
        }
      }
    }

    // Pending trades (still open) — cap total unrealized exposure at 1.0 (100% capital)
    let pendingExposure = 0;
    for (const t of pendingTrades) {
      const w = getWeight(t, modeId || '', cfgVersions, defaultWeight);
      if (pendingExposure + w > 1.0 + 1e-9) continue;
      const entryDay = t.entryDate || t.scanDate;
      if (entryDay && entryDay <= day && t.actualEntry > 0) {
        const close = getClose(t.ticker, day);
        if (close) {
          pendingExposure += w;
          unrealizedPnl += ((close - t.actualEntry) / t.actualEntry) * 100 * w;
        }
      }
    }

    const dailyEquity = 100 + realizedPnl + unrealizedPnl;
    equityCurve.push({ date: day, value: +dailyEquity.toFixed(2) });

    if (dailyEquity > peak) peak = dailyEquity;
    const dd = ((peak - dailyEquity) / peak) * 100;
    if (dd > maxDD) maxDD = dd;
  }

  // Keep ALL business days in equity curve — flat days are real (capital idle, no trade)

  const returnTotal = equityCurve.length > 0
    ? +(equityCurve[equityCurve.length - 1].value - 100).toFixed(2) : 0;
  const returnRealized = +realizedPnl.toFixed(2);
  const returnUnrealized = +(returnTotal - returnRealized).toFixed(2);

  // WR, PF — from resolved trades only (unrealized don't count)
  const wins = resolved.filter(t => (t.pnlPct || 0) > 0);
  const losses = resolved.filter(t => (t.pnlPct || 0) <= 0);
  const winRate = resolved.length ? +((wins.length / resolved.length) * 100).toFixed(1) : 0;
  const grossWin = wins.reduce((s, t) => s + t.pnlPct, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));
  const profitFactor = grossLoss > 0 ? +(grossWin / grossLoss).toFixed(2) : grossWin > 0 ? 99 : 0;

  // Risk-adjusted return metrics
  const returnDDRatio = maxDD > 0 ? +(returnTotal / maxDD).toFixed(2) : returnTotal > 0 ? 99 : 0;

  // True Sharpe ratio from daily MtM returns
  let sharpe = 0;
  if (equityCurve.length > 2) {
    const dailyReturns = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const prev = equityCurve[i - 1].value;
      const curr = equityCurve[i].value;
      if (prev > 0) dailyReturns.push((curr - prev) / prev);
    }
    if (dailyReturns.length > 1) {
      const mean = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
      const variance = dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (dailyReturns.length - 1);
      const stdev = Math.sqrt(variance);
      if (stdev > 0) sharpe = +(Math.sqrt(252) * mean / stdev).toFixed(2);
    }
  }

  const dayCount = allDays.length || 1;
  const annReturn = returnTotal * (252 / dayCount);
  const calmar = maxDD > 0 ? +(annReturn / maxDD).toFixed(2) : 0;

  return {
    returnTotal,
    returnRealized,
    returnUnrealized,
    maxDD: +(-maxDD).toFixed(2),
    winRate,
    profitFactor,
    trades: resolved.length,
    calmar,
    sharpe,
    returnDDRatio,
    equityCurve,
    // Marquage cohortes invalides — informatif quand `invalidCohortExcluded`
    // est false (chiffres ci-dessus inchangés), effectif quand il est true.
    ...cohortInfo,
  };
}

module.exports = {
  getWeight,
  computeStatsFromTrades,
  dayFnsFor,
  BIZ_DAY_FNS,
  CAL_DAY_FNS,
};
