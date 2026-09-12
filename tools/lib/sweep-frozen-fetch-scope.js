'use strict';

const RESIMULATE_STATUSES = new Set(['pending', 'sim2_artifact']);

function tickerOf(record) {
  return record && typeof record.ticker === 'string' ? record.ticker : null;
}

function dateOf(record, fallback = '') {
  return record && (record.entryDate || record.scanDate || fallback) || fallback;
}

function lastEquityDate(result) {
  const curve = result && Array.isArray(result.equityCurve) ? result.equityCurve : [];
  for (let index = curve.length - 1; index >= 0; index--) {
    if (curve[index] && typeof curve[index].date === 'string') return curve[index].date;
  }
  return '';
}

function overlapsSimulationStart(trade, boundary) {
  if (!boundary || !tickerOf(trade)) return false;
  const entry = dateOf(trade);
  const exit = trade.exitDate || '';
  // Match the simulator seed: a position opened before the new scan and still
  // alive at that scan must have its history available.
  return Boolean(entry && entry < boundary && (!exit || exit >= boundary));
}

function overlapsEquityAppend(trade, boundary) {
  if (!boundary || !tickerOf(trade)) return false;
  const entry = dateOf(trade);
  const exit = trade.exitDate || '';
  // The appended curve begins after its last recorded point; an exit on that
  // point is already sealed and does not need a new quote.
  return Boolean(entry && entry <= boundary && (!exit || exit > boundary));
}

/**
 * Derive the only price histories a frozen append-only run can use. This is
 * deliberately conservative: every pool candidate from a required scan date
 * stays available; filtering/ranking still happens in sweep.js exactly as it
 * does for the full universe.
 */
function buildFrozenFetchScope({
  scans,
  allSetups,
  modes,
  existingTrades,
  existingResults,
  livePositions = [],
  excludesMode = () => false,
}) {
  if (!Array.isArray(scans) || !Array.isArray(allSetups)) throw new Error('Frozen fetch scope requires scans and allSetups arrays');
  if (!modes || typeof modes !== 'object' || Array.isArray(modes)) throw new Error('Frozen fetch scope requires modes');
  if (!existingTrades || typeof existingTrades !== 'object' || Array.isArray(existingTrades)) throw new Error('Frozen fetch scope requires existingTrades');
  if (!existingResults || typeof existingResults !== 'object' || Array.isArray(existingResults)) throw new Error('Frozen fetch scope requires existingResults');
  if (!Array.isArray(livePositions)) throw new Error('Frozen fetch scope requires livePositions array');
  if (typeof excludesMode !== 'function') throw new Error('Frozen fetch scope requires excludesMode function');

  const scanDates = new Set();
  const purgedScanDates = new Set();
  const overlappingTickers = new Set();
  const modesAudit = [];

  for (const [id, cfg] of Object.entries(modes)) {
    if (!cfg || cfg.status === 'stopped' || excludesMode(id, cfg)) continue;
    const rows = Array.isArray(existingTrades[id]) ? existingTrades[id] : [];
    const retained = rows.filter(trade => !RESIMULATE_STATUSES.has(trade && trade.status));
    const purged = rows.filter(trade => RESIMULATE_STATUSES.has(trade && trade.status));
    const latestExistingScan = retained.reduce((latest, trade) => {
      const date = trade && trade.scanDate || '';
      return date > latest ? date : latest;
    }, '');
    const statusSince = typeof cfg.statusSince === 'string' ? cfg.statusSince.slice(0, 10) : '';
    const modeScans = scans.filter(scan => scan && scan.scanDate && (!statusSince || scan.scanDate >= statusSince));
    const modePurgedDates = new Set(purged.map(trade => trade && trade.scanDate).filter(Boolean));
    const newScans = latestExistingScan
      ? modeScans.filter(scan => scan.scanDate > latestExistingScan || modePurgedDates.has(scan.scanDate))
      : modeScans;
    const firstNewScan = newScans.map(scan => scan.scanDate).sort()[0] || '';
    const frozenBoundary = lastEquityDate(existingResults[`frozen_${id}`]);

    for (const scan of newScans) scanDates.add(scan.scanDate);
    for (const date of modePurgedDates) purgedScanDates.add(date);
    for (const trade of retained) {
      if (overlapsSimulationStart(trade, firstNewScan) || overlapsEquityAppend(trade, frozenBoundary)) {
        overlappingTickers.add(tickerOf(trade));
      }
    }
    modesAudit.push(Object.freeze({
      id,
      status_since: statusSince || null,
      latest_existing_scan: latestExistingScan || null,
      new_scan_dates: Object.freeze(newScans.map(scan => scan.scanDate)),
      purged_scan_dates: Object.freeze([...modePurgedDates].sort()),
      frozen_equity_boundary: frozenBoundary || null,
    }));
  }

  const scopedSetups = allSetups.filter(setup => setup && scanDates.has(setup.scanDate));
  const setupTickers = new Set(scopedSetups.map(tickerOf).filter(Boolean));
  const liveTickers = new Set(livePositions.map(tickerOf).filter(Boolean));
  const tickers = new Set([...setupTickers, ...liveTickers, ...overlappingTickers]);
  return Object.freeze({
    scanDates: Object.freeze([...scanDates].sort()),
    purgedScanDates: Object.freeze([...purgedScanDates].sort()),
    setups: Object.freeze(scopedSetups),
    tickers: Object.freeze([...tickers].sort()),
    setupTickers: Object.freeze([...setupTickers].sort()),
    liveTickers: Object.freeze([...liveTickers].sort()),
    overlappingTickers: Object.freeze([...overlappingTickers].sort()),
    modes: Object.freeze(modesAudit),
  });
}

module.exports = { buildFrozenFetchScope, RESIMULATE_STATUSES };
