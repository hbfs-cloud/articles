#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const dirRel = arg('--dir');
const secDirName = arg('--sec-dir') || '_sec-canonical';
if (!dirRel) {
  console.error('Usage: prepare-scanner-final-evidence.js --dir scanner/YYYYMMDD [--sec-dir _sec-canonical]');
  process.exit(2);
}

const DIR = path.resolve(ROOT, dirRel);
const FINAL = path.join(DIR, '_final');
const SEC_DIR = path.join(DIR, secDirName);
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const write = (name, value) => fs.writeFileSync(path.join(FINAL, name), JSON.stringify(value, null, 2) + '\n');
const required = p => { if (!fs.existsSync(p)) throw new Error(`${path.relative(ROOT, p)} absent`); return p; };

fs.mkdirSync(FINAL, { recursive: true });
const selection = read(required(path.join(FINAL, 'selection.json')));
const classifications = read(required(path.join(FINAL, 'sec-classifications.json')));
const audit = read(required(path.join(DIR, '_audit', 'universe.json')));
const verified = read(required(path.join(DIR, '_derived', 'verified-technicals.json')));
const selected = selection.picks.map(x => x.ticker);
const selectedSet = new Set(selected);
if (selectedSet.size !== selected.length) throw new Error('selection.json contient un ticker en double');

// Mesure de concentration sur le panier réellement retenu. Les corrélations sont
// calculées sur 120 rendements logarithmiques appariés par date, jamais sur le
// vivier de présélection. Le sidecar conserve les empreintes des quatre lots de
// barres afin qu'une modification du snapshot invalide aussi cette mesure.
const history = {};
const historySources = [];
for (let i = 1; i <= 4; i++) {
  const p = required(path.join(DIR, '_verify', `history_b${i}.json`));
  historySources.push({ path: path.relative(ROOT, p), sha256: sha(p) });
  const j = read(p);
  for (const item of j.data?.items || []) {
    for (const result of item.results || []) {
      const rows = Array.isArray(result.data) ? result.data : [result.data];
      for (const row of rows.filter(Boolean)) {
        if (selectedSet.has(row.symbol) && Array.isArray(row.bars)) history[row.symbol] = row.bars;
      }
    }
  }
}
for (const ticker of selected) {
  if (!history[ticker] || history[ticker].length < 121) throw new Error(`${ticker}: moins de 121 barres pour la corrélation`);
}
const logReturns = bars => {
  const out = new Map();
  for (let i = 1; i < bars.length; i++) {
    const prev = Number(bars[i - 1][4]);
    const close = Number(bars[i][4]);
    if (prev > 0 && close > 0) out.set(bars[i][0], Math.log(close / prev));
  }
  return out;
};
const returns = Object.fromEntries(selected.map(t => [t, logReturns(history[t])]));
const pearson = (xs, ys) => {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i] - mx, y = ys[i] - my;
    num += x * y; dx += x * x; dy += y * y;
  }
  return num / Math.sqrt(dx * dy);
};
const pairs = [];
for (let i = 0; i < selected.length; i++) {
  for (let j = i + 1; j < selected.length; j++) {
    const a = selected[i], b = selected[j];
    const dates = [...returns[a].keys()].filter(d => returns[b].has(d)).sort().slice(-120);
    if (dates.length !== 120) throw new Error(`${a}/${b}: ${dates.length} rendements communs, 120 requis`);
    const correlation = pearson(dates.map(d => returns[a].get(d)), dates.map(d => returns[b].get(d)));
    pairs.push({ symbols: [a, b], correlation: Math.round(correlation * 10000) / 10000, observations: dates.length,
      start: dates[0], end: dates[dates.length - 1] });
  }
}
const maxPair = pairs.reduce((a, b) => b.correlation > a.correlation ? b : a);
const maxAbsPair = pairs.reduce((a, b) => Math.abs(b.correlation) > Math.abs(a.correlation) ? b : a);
const minPair = pairs.reduce((a, b) => b.correlation < a.correlation ? b : a);
const avgCorrelation = pairs.reduce((sum, x) => sum + x.correlation, 0) / pairs.length;
write('risk-gating.json', {
  reference_close: selection.reference_close,
  correlation_universe: selected,
  correlation_method: 'pearson_log_returns_pairwise_common_dates',
  correlation_observations: 120,
  correlation_window: { start: pairs[0].start, end: selection.reference_close },
  max_pair: maxPair,
  max_abs_pair: maxAbsPair,
  min_pair: minPair,
  avg_off_diagonal_correlation: Math.round(avgCorrelation * 10000) / 10000,
  pairs,
  sources: historySources,
});

const fund = {};
const fundSources = [];
for (let i = 1; i <= 4; i++) {
  const p = required(path.join(DIR, '_verify', `fund_b${i}.json`));
  fundSources.push({ path: path.relative(ROOT, p), sha256: sha(p) });
  const j = read(p);
  for (const result of j.data?.items?.[0]?.results || []) {
    for (const row of result.data || []) {
      if (!selectedSet.has(row.symbol)) continue;
      fund[row.symbol] ||= {};
      const key = result.data_type === 'financials' ? 'instrument_comprehensive_financials'
        : `instrument_comprehensive_${result.data_type}`;
      fund[row.symbol][key] = row;
    }
  }
}
for (const ticker of selected) {
  if (!verified.symbols?.[ticker]) throw new Error(`${ticker}: technique vérifiée absente`);
  if (!fund[ticker]?.instrument_comprehensive_profile) throw new Error(`${ticker}: profil fondamental absent`);
}

const fundSelected = {
  reference_close: selection.reference_close,
  sources: fundSources,
  tickers: fund,
};
write('fund_selected.json', fundSelected);
const fundPath = path.join(FINAL, 'fund_selected.json');

const candidates = [];
for (const pick of selection.picks) {
  const source = audit.candidates.find(x => x.ticker === pick.ticker && x.strategy === pick.strategy);
  if (!source?.source_row) throw new Error(`${pick.ticker}: ligne de screener ${pick.strategy} absente`);
  const row = JSON.parse(JSON.stringify(source.source_row));
  row.symbol = pick.ticker;
  row.ticker = pick.ticker;
  if (pick.region === 'US') {
    const shares = fund[pick.ticker]?.instrument_comprehensive_stats?.sharesOutstanding;
    const close = verified.symbols[pick.ticker].close;
    if (!Number.isFinite(shares) || !Number.isFinite(close)) throw new Error(`${pick.ticker}: capitalisation non calculable`);
    row.market_cap = shares * close;
    row.market_cap_as_of = selection.reference_close;
    row.market_cap_as_of_kind = 'verified_close_x_latest_collected_shares_outstanding';
    row.market_cap_point_in_time = false;
  }
  candidates.push(row);
}
write('selection_rows.json', {
  reference_close: selection.reference_close,
  source_audit: path.relative(ROOT, path.join(DIR, '_audit', 'universe.json')),
  source_audit_sha256: sha(path.join(DIR, '_audit', 'universe.json')),
  market_cap_method: 'Clôture Webull vérifiée multipliée par sharesOutstanding collecté; ce n’est pas une capitalisation historique point-in-time.',
  data: { items: [{ candidates }] },
});

const earningsRaw = required(path.join(SEC_DIR, 'earnings_selected.json'));
const earningsPayload = read(earningsRaw);
if (!Array.isArray(earningsPayload.events)) throw new Error('earnings_selected.events absent');
const horizonEnd = selection.horizon_last_session;
const exclusionEnd = new Date(`${horizonEnd}T00:00:00Z`);
exclusionEnd.setUTCDate(exclusionEnd.getUTCDate() + selection.earnings_exclude_days_after);
const exclusionEndIso = exclusionEnd.toISOString().slice(0, 10);
const earningsTickers = {};
for (const pick of selection.picks) {
  if (pick.region === 'ETF') {
    earningsTickers[pick.ticker] = { event_found: false, next_earnings: null, result: 'ETF — aucune publication de résultats émetteur', calendar_status: 'not_applicable' };
    continue;
  }
  const cal = fund[pick.ticker]?.instrument_comprehensive_calendar;
  if (!cal || cal.earningsCalendarStatus !== 'available' || !cal.nextEarningsDate) throw new Error(`${pick.ticker}: calendrier prévisionnel indisponible`);
  const next = cal.nextEarningsDate.slice(0, 10);
  const eventFound = next <= exclusionEndIso;
  earningsTickers[pick.ticker] = {
    event_found: eventFound,
    next_earnings: next,
    result: eventFound ? `publication ${next} dans la fenêtre d’exclusion` : `prochaine publication ${next}, après la fenêtre qui finit le ${exclusionEndIso}`,
    calendar_status: cal.earningsCalendarStatus,
    calendar_provider: cal.earningsCalendarSource,
    source: path.relative(ROOT, fundPath),
    source_sha256: sha(fundPath),
  };
}
const earningsCoverage = Object.fromEntries(selection.picks.map(p => [p.ticker,
  p.region === 'ETF' ? 'no issuer earnings (ETF)' : 'no earnings found in next 7 days']));
write('earnings_selected_evidence.json', {
  reference_close: selection.reference_close,
  session: selection.session,
  horizon_days: selection.horizon_days,
  horizon_last_session: horizonEnd,
  checked_at: earningsPayload.captured_at,
  days_ahead: 7,
  filtered_calendar_result: `GetEarningsCalendarFiltered a rendu ${earningsPayload.events.length} événement(s) sur les sept prochains jours; la date par symbole couvre le reste de l’horizon.`,
  filtered_calendar_artifact: { path: path.relative(ROOT, earningsRaw), sha256: sha(earningsRaw) },
  coverage: earningsCoverage,
  tickers: earningsTickers,
});

const rawFilings = {};
const secSources = [];
let checkedAt = null;
for (let i = 1; i <= 4; i++) {
  const p = required(path.join(SEC_DIR, `sec_selected_b${i}.json`));
  secSources.push({ path: path.relative(ROOT, p), sha256: sha(p) });
  const j = read(p);
  checkedAt ||= j.captured_at;
  const result = j.data?.items?.[0]?.results?.find(x => x.data_type === 'sec_filings');
  for (const row of result?.data || []) rawFilings[row.symbol] = row.data || [];
}
const secTickers = {};
for (const pick of selection.picks) {
  if (pick.region === 'ETF') {
    secTickers[pick.ticker] = {
      issuer_filing_regime: 'not_applicable', dilution_clear: true, basis: 'etf_not_applicable',
      equity_offering_hits: [], non_equity_offering_hits: [],
      classification_evidence: 'ETF coté aux États-Unis : la dilution d’actions d’une société émettrice est sans objet.',
    };
    continue;
  }
  const cls = classifications.tickers?.[pick.ticker];
  if (!cls) throw new Error(`${pick.ticker}: classification SEC manuelle absente`);
  if (!rawFilings[pick.ticker]) throw new Error(`${pick.ticker}: inventaire SEC brut absent`);
  secTickers[pick.ticker] = { ...cls, total_filings_in_window: rawFilings[pick.ticker].length };
}
write('sec_selected_evidence.json', {
  reference_close: selection.reference_close,
  checked_at: checkedAt,
  dilution_window: classifications.dilution_window,
  pagination_exhausted: true,
  discovery_sources: secSources,
  classification_method: classifications.classification_method,
  coverage: secTickers,
  tickers: secTickers,
});

console.log(`[scanner-final] ${selected.length} lignes préparées: ${selection.picks.filter(x => x.region === 'US').length} actions, ${selection.picks.filter(x => x.region === 'ETF').length} ETF`);
