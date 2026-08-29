#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const compact = process.argv[2];
if (!/^\d{8}$/.test(compact || '')) {
  console.error('Usage: node tools/update-period-retro-summary.js YYYYMMDD');
  process.exit(2);
}
const results = JSON.parse(fs.readFileSync(path.join(ROOT, 'scanner', 'retrospective', compact, 'retro-results.json'), 'utf8'));
const file = path.join(ROOT, 'data', 'retro-summary.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const s = results.summary;
const strategy = name => results.by_strategy.find(row => row.name === name) || {};
const momentum = strategy('Momentum');
const pullback = strategy('Pullback');
const record = {
  date: s.period_end,
  grade: 'C',
  global_grade: null,
  setup_grade: 'C',
  grade_basis: 'setup_quality_only',
  total_signals: s.proposed,
  resolved: s.resolved,
  hit_rate_pct: s.hit_rate_pct,
  avg_return_pct: s.average_return_pct,
  profit_factor: s.profit_factor,
  avg_r_multiple: s.average_r,
  best_trade: { ticker: results.top[0].ticker, return_pct: results.top[0].return_pct, strategy: results.top[0].strategy },
  worst_trade: { ticker: results.bottom[0].ticker, return_pct: results.bottom[0].return_pct, strategy: results.bottom[0].strategy },
  regime: 'RISK-ON label with weak breadth: Momentum overrepresented and loss-making; Pullback positive on a small sample',
  regime_label: 'RISK-ON (rotation fragile)',
  note: `${s.scans} published scans / ${s.proposed} setups; ${s.no_fill} no-fills; ${s.data_error} unverified; ${s.pending} pending plus ${s.open_runners} open runner. Setup quality C; global composite N/A. Momentum PF ${momentum.profit_factor}; Pullback PF ${pullback.profit_factor} on ${pullback.fully_closed} fully closed setups.`,
  strategy_breakdown: results.by_strategy.map(x => ({
    strategy: x.name,
    count: x.proposed,
    resolved: x.resolved,
    tp1_count: x.tp_hits,
    stopped_count: x.stopped,
    hit_rate_pct: x.hit_rate_pct,
    avg_r_multiple: x.average_r,
    profit_factor: x.profit_factor
  }))
};
const old = data.retros.find(r => r.date === record.date);
if (old) Object.assign(old, record);
else data.retros.push(record);
data.retros.sort((a, b) => a.date.localeCompare(b.date));
data._version = `v1.3-${compact}`;
data._updated = s.period_end;
data._comment = `Retrospective summary dashboard data through ${s.period_end}.`;
data.aggregate.total_retros = data.retros.length;
data.aggregate.date_range.end = s.period_end;
data.aggregate.total_signals = data.retros.reduce((sum, r) => sum + (r.total_signals || 0), 0);
data.aggregate.total_resolved = data.retros.reduce((sum, r) => sum + (r.resolved || 0), 0);
const resolvedWithRates = data.retros.filter(r => Number.isFinite(r.hit_rate_pct) && Number.isFinite(r.resolved));
const resolvedDenom = resolvedWithRates.reduce((sum, r) => sum + r.resolved, 0);
data.aggregate.overall_hit_rate_pct = resolvedDenom
  ? Number((resolvedWithRates.reduce((sum, r) => sum + r.hit_rate_pct * r.resolved, 0) / resolvedDenom).toFixed(1))
  : null;
const returnRows = data.retros.filter(r => Number.isFinite(r.avg_return_pct) && Number.isFinite(r.resolved));
const returnDenom = returnRows.reduce((sum, r) => sum + r.resolved, 0);
data.aggregate.overall_avg_return_pct = returnDenom
  ? Number((returnRows.reduce((sum, r) => sum + r.avg_return_pct * r.resolved, 0) / returnDenom).toFixed(2))
  : null;
data.aggregate.grade_distribution = data.retros.reduce((acc, r) => {
  acc[r.grade] = (acc[r.grade] || 0) + 1;
  return acc;
}, {});
data.aggregate.grade_trend_direction = 'mixed';
data.aggregate.grade_trend_summary = `Latest three-week audit: setup quality C (${s.hit_rate_pct}% TP1 hit rate, ${s.average_return_pct}% average closed return, PF ${s.profit_factor}); global grade N/A because the portfolio pillar is unavailable. Momentum PF ${momentum.profit_factor}; Pullback PF ${pullback.profit_factor} on only ${pullback.fully_closed} fully closed setups.`;
fs.writeFileSync(file, JSON.stringify(data, null, 1) + '\n');
console.log(`data/retro-summary.json: ${data.retros.length} retros, latest ${record.date} ${record.grade}`);
