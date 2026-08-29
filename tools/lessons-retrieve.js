#!/usr/bin/env node
'use strict';

/**
 * tools/lessons-retrieve.js — Controlled retrieval layer over data/scanner-lessons.json
 * for LLM decision-making during /scanner Phase 0.8 / Phase 2.
 *
 * This is NOT a replacement for lessons-engine.js (decay/validate/promote/contradictions
 * still live there and remain the only writers of scanner-lessons.json). This module is
 * READ-ONLY: it filters + caps + ranks the current rule set into a small, bounded JSON
 * payload safe to inject into an LLM prompt, so the model never has to reason over all
 * 40+ raw rules (context bloat + no guardrail on how many rules can steer one decision).
 *
 * Hard invariants:
 *   - NEVER returns more than --max-rules active_rules, --max-risks known_risks, or
 *     --max-episodes similar_episodes entries, REGARDLESS of how many rules/trades match.
 *   - hard_block rules are still surfaced here (for visibility / rationale) but they are
 *     NOT what enforces them — scanner-filters.json + validate-scan.js are the actual gate.
 *     Retrieval output is advisory context only.
 *   - Effective confidence is recomputed at read-time via lessons-engine's own decay math
 *     (same formula, reused directly — no duplicated logic, no drift).
 *   - Memory (this retrieval) can NEVER by itself flip a quantitative signal (buy<->skip).
 *     It can only adjust confidence / sizing / raise an alert. See scanner.md Phase 0.8
 *     and the _memoryImpact block written to signals.json.
 *
 * Usage:
 *   node tools/lessons-retrieve.js --regime <REGIME> [--setups momentum,breakout] [--mode <id>]
 *                                  [--max-rules 3] [--max-risks 3] [--max-episodes 3]
 *                                  [--file <path>] [--trades-file <path>] [--date YYYY-MM-DD]
 *   node tools/lessons-retrieve.js --self-test     # verifies caps hold with 20+ eligible rules
 */

const fs = require('fs');
const path = require('path');

const lessonsEngine = require('./lessons-engine.js');

const DEFAULT_LESSONS_FILE = path.join(__dirname, '..', 'data', 'scanner-lessons.json');
const DEFAULT_TRADES_FILE = path.join(__dirname, '..', 'data', 'backtest-trades.json');

// Stricter than lessons-engine's DEPRECATION_FLOOR (0.30) — retrieval only surfaces rules
// confident enough to actually steer a live decision. A rule can be status=active and still
// too decayed (0.30-0.39) to be worth injecting into the prompt; --decay will deprecate it
// later, but retrieval doesn't wait for that housekeeping pass.
const RETRIEVAL_MIN_CONFIDENCE = 0.4;
const MARKET_TRUTH_MIN_SAMPLE = 20;

const DEFAULT_MAX_RULES = 3;
const DEFAULT_MAX_RISKS = 3;
const DEFAULT_MAX_EPISODES = 3;

// ── scope matching ──────────────────────────────────────────────────────────

function norm(x) {
  return String(x || '').trim().toLowerCase();
}

/**
 * A rule's scope dimension matches a query dimension if:
 *   - the rule's scope array for that dimension is empty (rule is global on that axis), OR
 *   - the query didn't ask for that dimension (nothing to disqualify against), OR
 *   - there's a case-insensitive intersection.
 * Regime is mandatory (always provided), so an empty rule scope.regimes means "applies to
 * all regimes", not "doesn't care" — this mirrors lessons-engine's scopeOverlaps semantics.
 */
function scopeMatches(scope, query) {
  const s = scope || {};
  const regimes = s.regimes || [];
  const setups = s.setups || [];
  const modes = s.modes || [];

  if (regimes.length && !regimes.some(r => norm(r) === norm(query.regime))) return false;

  if (query.setups && query.setups.length && setups.length) {
    const qs = new Set(query.setups.map(norm));
    if (!setups.some(x => qs.has(norm(x)))) return false;
  }

  if (query.mode && modes.length) {
    if (!modes.some(m => norm(m) === norm(query.mode))) return false;
  }

  return true;
}

// ── rule selection ──────────────────────────────────────────────────────────

/**
 * Build the bounded retrieval payload. Pure function of (lessonsData, query, caps, asOfDate)
 * — no I/O, no mutation, safe to unit-test.
 */
function selectRules(lessonsData, query, caps, asOfDate) {
  const eligible = []; // scope-matching, regardless of status/confidence (for deprecated_rules_ignored)
  const activeCandidates = [];
  const riskCandidates = [];
  const ignored = [];

  for (const rule of lessonsData.rules || []) {
    if (!scopeMatches(rule.scope, query)) continue;
    eligible.push(rule);

    if (rule.status !== 'active') {
      ignored.push(rule.id);
      continue;
    }

    const confEff = lessonsEngine.effectiveConfidence(rule, asOfDate);
    if (confEff < RETRIEVAL_MIN_CONFIDENCE) {
      ignored.push(rule.id);
      continue;
    }
    const evidenceN = Number(rule.evidence && rule.evidence.sample_size);
    if (rule.class === 'market_truth' && (!Number.isFinite(evidenceN) || evidenceN < MARKET_TRUTH_MIN_SAMPLE)) {
      ignored.push(rule.id);
      continue;
    }

    const entry = {
      id: rule.id,
      rule: rule.rule,
      severity: rule.severity,
      confidence: Math.round(confEff * 10000) / 10000,
      evidence_n: rule.evidence && rule.evidence.sample_size != null ? rule.evidence.sample_size : null,
    };

    if (rule.severity === 'advisory') {
      riskCandidates.push(entry);
    } else {
      activeCandidates.push(entry);
    }
  }

  const byConfDesc = (a, b) => b.confidence - a.confidence;
  activeCandidates.sort(byConfDesc);
  riskCandidates.sort(byConfDesc);

  return {
    active_rules: activeCandidates.slice(0, caps.maxRules),
    known_risks: riskCandidates.slice(0, caps.maxRisks),
    deprecated_rules_ignored: ignored,
  };
}

// ── similar episodes (data/backtest-trades.json) ────────────────────────────

/**
 * Flatten backtest-trades.json (keyed by mode -> array of trades) into a single list,
 * tagging each trade with its source mode. Null-safe on every optional field.
 */
function flattenTrades(tradesData, modeFilter) {
  const out = [];
  for (const [mode, trades] of Object.entries(tradesData || {})) {
    if (modeFilter && norm(mode) !== norm(modeFilter)) continue;
    if (!Array.isArray(trades)) continue;
    for (const t of trades) {
      out.push({ mode, ...t });
    }
  }
  return out;
}

function isClosed(trade) {
  return !!trade.exitDate && trade.status !== 'pending';
}

const NON_US_SUFFIX_RE = /\.(?:PA|MI|MC|BR|AS|LS|L|DE|F|SW|ST|OL|CO|HE|WA|PR|VI|HK|T|AX|TO|V|SI|BK|KS|KQ|TW|SS|SZ)$/i;

function isUSPrimaryEpisode(trade) {
  if (trade.source && trade.source !== 'signals') return false;
  if (trade.region) return ['US', 'ETF'].includes(String(trade.region).toUpperCase());
  return !NON_US_SUFFIX_RE.test(String(trade.ticker || ''));
}

function meanFinite(rows, field) {
  const values = rows.map(row => Number(row[field])).filter(Number.isFinite);
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10000) / 10000;
}

/**
 * The capped most recent US primary-signal episodes matching regime x setup. Multiple modes for the
 * same ticker/scan are collapsed so one market event cannot occupy several context slots.
 */
function selectEpisodes(tradesData, query, maxEpisodes) {
  const setupSet = query.setups && query.setups.length ? new Set(query.setups.map(norm)) : null;

  const closed = flattenTrades(tradesData, query.mode)
    .filter(isClosed)
    .filter(isUSPrimaryEpisode)
    .filter(t => norm(t.regime) === norm(query.regime))
    .filter(t => !setupSet || setupSet.has(norm(t.strategy)));

  const groups = new Map();
  for (const trade of closed) {
    const key = `${trade.scanDate || ''}|${trade.ticker || ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(trade);
  }

  const episodes = [...groups.values()].map(rows => {
    rows.sort((a, b) => String(a.mode || '').localeCompare(String(b.mode || '')));
    const first = rows[0];
    const modes = [...new Set(rows.map(row => row.mode).filter(Boolean))].sort();
    const statuses = [...new Set(rows.map(row => row.status).filter(Boolean))].sort();
    const exits = rows.map(row => row.exitDate).filter(Boolean).sort();
    return {
      ticker: first.ticker || null,
      mode: modes.join(',') || null,
      variants: rows.length,
      strategy: first.strategy || null,
      regime: first.regime || null,
      scanDate: first.scanDate || null,
      exitDate: exits[exits.length - 1] || null,
      status: statuses.join('|') || null,
      pnlPct: meanFinite(rows, 'pnlPct'),
      mae_pct: meanFinite(rows, 'mae_pct'),
      mfe_pct: meanFinite(rows, 'mfe_pct'),
      outcomes: rows.every(row => JSON.stringify(row.outcomes || null) === JSON.stringify(first.outcomes || null))
        ? (first.outcomes || null)
        : null,
      r_multiple: meanFinite(rows, 'r_multiple'),
    };
  });

  episodes.sort((a, b) =>
    String(b.exitDate || '').localeCompare(String(a.exitDate || '')) ||
    String(b.scanDate || '').localeCompare(String(a.scanDate || '')) ||
    String(a.ticker || '').localeCompare(String(b.ticker || '')));
  return episodes.slice(0, maxEpisodes);
}

// ── public API ───────────────────────────────────────────────────────────────

function retrieve({
  regime,
  setups = [],
  mode = null,
  maxRules = DEFAULT_MAX_RULES,
  maxRisks = DEFAULT_MAX_RISKS,
  maxEpisodes = DEFAULT_MAX_EPISODES,
  lessonsFile = DEFAULT_LESSONS_FILE,
  tradesFile = DEFAULT_TRADES_FILE,
  asOfDate = lessonsEngine.todayIso(),
} = {}) {
  if (!regime) throw new Error('retrieve() requires a regime');

  const lessonsData = lessonsEngine.loadLessons(lessonsFile);

  let tradesData = {};
  try {
    tradesData = JSON.parse(fs.readFileSync(tradesFile, 'utf8'));
  } catch (e) {
    tradesData = {}; // null-safe: no trades file / unreadable -> empty episodes, not a crash
  }

  const query = { regime, setups, mode };
  const caps = { maxRules, maxRisks, maxEpisodes };

  const { active_rules, known_risks, deprecated_rules_ignored } =
    selectRules(lessonsData, query, caps, asOfDate);
  const similar_episodes = selectEpisodes(tradesData, query, maxEpisodes);

  return {
    active_rules,
    known_risks,
    similar_episodes,
    deprecated_rules_ignored,
    retrieval_meta: {
      caps: { max_rules: maxRules, max_risks: maxRisks, max_episodes: maxEpisodes },
      filters: { regime, setups, mode },
      as_of: asOfDate,
      min_confidence: RETRIEVAL_MIN_CONFIDENCE,
    },
  };
}

// ── self-test ────────────────────────────────────────────────────────────────

function selfTest() {
  const asOfDate = '2026-07-02';
  const rules = [];
  for (let i = 0; i < 20; i++) {
    rules.push({
      id: `synthetic-${i}`,
      class: 'market_truth',
      status: 'active',
      severity: i % 5 === 0 ? 'advisory' : 'selection_filter',
      rule: `synthetic rule ${i}`,
      scope: { setups: [], regimes: ['RISK-ON'], modes: [] },
      effect: { action: 'noop', target: {}, params: {} },
      evidence: { sample_size: 30 + i, wins: 5, losses: 2, expectancy: 0.1, tickers: [], clusters: [] },
      confidence: 0.9,
      confidence_base: 0.9,
      half_life_days: 180,
      created_at: '2026-01-01',
      last_validated_at: '2026-06-01', // small decay elapsed, still >> 0.4 floor
      expires_at: null,
    });
  }
  rules.push({
    id: 'immature-market-truth',
    class: 'market_truth',
    status: 'active',
    severity: 'selection_filter',
    rule: 'must not steer selection yet',
    scope: { setups: [], regimes: ['RISK-ON'], modes: [] },
    evidence: { sample_size: 2, tickers: ['A', 'B'] },
    confidence: 1,
    confidence_base: 1,
    half_life_days: 180,
    created_at: '2026-06-01',
    last_validated_at: '2026-07-01',
  });
  const lessonsData = { rules };
  const tradesData = {
    balanced: Array.from({ length: 10 }, (_, i) => ({
      ticker: `T${i}`,
      strategy: 'momentum',
      regime: 'RISK-ON',
      scanDate: `2026-06-${10 + i}`,
      exitDate: `2026-06-${11 + i}`,
      status: 'win',
      pnlPct: 1.2,
      mae_pct: -0.5,
      mfe_pct: 2.1,
      outcomes: { d1: 1.2, d5: null, d20: null },
      r_multiple: 0.8,
    })),
  };
  tradesData.turbo = [{
    ...tradesData.balanced[0],
    pnlPct: 0.8,
    r_multiple: 0.4,
  }, {
    ...tradesData.balanced[1],
    ticker: 'EDP.LS',
    region: 'EU',
    pnlPct: 9,
  }];

  const caps = { maxRules: 3, maxRisks: 2, maxEpisodes: 3 };
  const query = { regime: 'RISK-ON', setups: ['momentum'], mode: null };
  const { active_rules, known_risks } = selectRules(lessonsData, query, caps, asOfDate);
  const episodes = selectEpisodes(tradesData, query, caps.maxEpisodes);
  const allEpisodes = selectEpisodes(tradesData, query, 20);

  const failures = [];
  if (active_rules.length !== caps.maxRules) failures.push(`active_rules.length=${active_rules.length}, expected ${caps.maxRules}`);
  if (known_risks.length !== caps.maxRisks) failures.push(`known_risks.length=${known_risks.length}, expected ${caps.maxRisks}`);
  if (active_rules.some(rule => rule.id === 'immature-market-truth')) failures.push('immature market truth steered selection');
  if (episodes.length !== caps.maxEpisodes) failures.push(`episodes.length=${episodes.length}, expected ${caps.maxEpisodes}`);
  if (allEpisodes.some(episode => episode.ticker === 'EDP.LS')) failures.push('non-US episode leaked into US scanner context');
  const duplicate = allEpisodes.find(episode => episode.ticker === 'T0');
  if (!duplicate || duplicate.variants !== 2 || duplicate.pnlPct !== 1) failures.push('same underlying was not collapsed across modes');
  // sorted by confidence desc
  for (let i = 1; i < active_rules.length; i++) {
    if (active_rules[i - 1].confidence < active_rules[i].confidence) failures.push('active_rules not sorted by confidence desc');
  }
  // most recent episode first
  if (episodes.length >= 2 && episodes[0].exitDate < episodes[1].exitDate) failures.push('episodes not sorted by exitDate desc');

  if (failures.length) {
    console.error('[lessons-retrieve] --self-test FAILED:');
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`[lessons-retrieve] --self-test PASSED (20 eligible rules -> capped to ${caps.maxRules}/${caps.maxRisks}, 10 trades -> capped to ${caps.maxEpisodes})`);
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args['self-test']) {
    selfTest();
    return;
  }

  if (!args.regime) {
    console.error(`Usage:
  node tools/lessons-retrieve.js --regime <REGIME> [--setups momentum,breakout] [--mode <id>]
                                 [--max-rules 3] [--max-risks 3] [--max-episodes 3]
                                 [--file <path>] [--trades-file <path>] [--date YYYY-MM-DD]
  node tools/lessons-retrieve.js --self-test`);
    process.exit(1);
  }

  const setups = args.setups ? String(args.setups).split(',').map(s => s.trim()).filter(Boolean) : [];

  const result = retrieve({
    regime: args.regime,
    setups,
    mode: args.mode || null,
    maxRules: args['max-rules'] ? parseInt(args['max-rules'], 10) : DEFAULT_MAX_RULES,
    maxRisks: args['max-risks'] ? parseInt(args['max-risks'], 10) : DEFAULT_MAX_RISKS,
    maxEpisodes: args['max-episodes'] ? parseInt(args['max-episodes'], 10) : DEFAULT_MAX_EPISODES,
    lessonsFile: args.file || DEFAULT_LESSONS_FILE,
    tradesFile: args['trades-file'] || DEFAULT_TRADES_FILE,
    asOfDate: args.date || lessonsEngine.todayIso(),
  });

  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = {
  retrieve,
  selectRules,
  selectEpisodes,
  scopeMatches,
  RETRIEVAL_MIN_CONFIDENCE,
};
