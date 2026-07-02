#!/usr/bin/env node
'use strict';

/**
 * tools/lessons-engine.js — Policy engine for data/scanner-lessons.json (v3.0 schema).
 *
 * Manages the lifecycle of scanner selection rules: decay, revalidation, promotion
 * from candidate to active, and contradiction detection between active rules.
 *
 * Schema recap (see data/scanner-lessons.json header for the full methodology):
 *   class:  'market_truth' | 'process_rule'
 *     - market_truth  = empirical claim about market/strategy behavior. Subject to
 *       confidence decay over time (half_life_days) and can be promoted/deprecated.
 *     - process_rule  = data-integrity / execution-mechanics / compliance invariant.
 *       NEVER decays (half_life_days must be null, expires_at must be null).
 *   status: 'candidate' | 'active' | 'deprecated' | 'rejected'
 *   confidence / confidence_base:
 *     confidence_base = the confidence value set at the last real validation event
 *       (creation, --validate, --promote, or a --contradictions penalty).
 *     confidence      = the EFFECTIVE (decayed) confidence, recomputed idempotently
 *       from confidence_base + last_validated_at + half_life_days every time
 *       --decay runs. Re-running --decay on the same day is a no-op (same inputs
 *       -> same output), so decay never compounds across repeated invocations.
 *   half_life_days: exponential decay half-life. null ⇔ process_rule (never decays).
 *   expires_at: informational — the date at which the EFFECTIVE confidence would
 *       cross the 0.30 deprecation floor if the rule is never revalidated. Not
 *       itself used by the decay math (which always recomputes from
 *       confidence_base/last_validated_at) — it's a human-facing "review by" hint,
 *       and used by --report to exclude overdue rules from the "active" table even
 *       if their `status` field hasn't been flipped to deprecated yet by a --decay run.
 *
 * Usage:
 *   node tools/lessons-engine.js --report [--dry-run]
 *   node tools/lessons-engine.js --decay [--dry-run]
 *   node tools/lessons-engine.js --validate <id> --outcome <win|loss|neutral> [--evidence-json '<json>'] [--dry-run]
 *   node tools/lessons-engine.js --promote <id> [--dry-run]
 *   node tools/lessons-engine.js --contradictions [--dry-run]
 *
 * All commands accept --file <path> (default data/scanner-lessons.json) and
 * --date <YYYY-MM-DD> (default = today, UTC) for reproducible/testable runs.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_FILE = path.join(__dirname, '..', 'data', 'scanner-lessons.json');
const DEPRECATION_FLOOR = 0.30;
const CONTRADICTION_PENALTY = 0.30; // reduce confidence_base by 30%

// ── date helpers ─────────────────────────────────────────────────────────────

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function diffDays(fromIso, toIso) {
  const a = new Date(fromIso + 'T00:00:00Z').getTime();
  const b = new Date(toIso + 'T00:00:00Z').getTime();
  return (b - a) / 86400000;
}

function addDaysIso(fromIso, days) {
  const d = new Date(fromIso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + Math.round(days));
  return d.toISOString().slice(0, 10);
}

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function round4(x) {
  return Math.round(x * 10000) / 10000;
}

// ── I/O ──────────────────────────────────────────────────────────────────────

function loadLessons(file) {
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw);
}

function saveLessons(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// ── core math ────────────────────────────────────────────────────────────────

/**
 * Recompute the EFFECTIVE confidence for a rule as of `asOfDate`, without
 * mutating anything. Idempotent: pure function of (confidence_base,
 * last_validated_at, half_life_days, class, asOfDate).
 */
function effectiveConfidence(rule, asOfDate) {
  const base = typeof rule.confidence_base === 'number' ? rule.confidence_base : rule.confidence;
  if (rule.class === 'process_rule') return base; // process_rule never decays
  if (!rule.half_life_days || rule.half_life_days <= 0) return base; // no half-life configured -> no decay
  if (!rule.last_validated_at) return base;
  const days = diffDays(rule.last_validated_at, asOfDate);
  if (days <= 0) return base;
  const eff = base * Math.pow(0.5, days / rule.half_life_days);
  return clamp(eff, 0, 1);
}

/**
 * Date at which the effective confidence would cross `floor` starting from
 * `base` at `fromIso`, given `halfLifeDays`. Returns null if it never will
 * (base already <= floor, or no half-life).
 */
function expiryDate(base, fromIso, halfLifeDays, floor = DEPRECATION_FLOOR) {
  if (!halfLifeDays || halfLifeDays <= 0) return null;
  if (base <= floor) return fromIso;
  const days = halfLifeDays * Math.log(floor / base) / Math.log(0.5);
  return addDaysIso(fromIso, days);
}

// ── --decay ──────────────────────────────────────────────────────────────────

/**
 * Decay all active/candidate market_truth rules. process_rule entries are
 * never touched. Idempotent — running twice on the same asOfDate produces
 * the same confidence values and no duplicate status transitions.
 */
function decay(data, { asOfDate = todayIso(), dryRun = false } = {}) {
  const changes = [];
  for (const rule of data.rules) {
    if (rule.class !== 'market_truth') continue;
    if (!['active', 'candidate'].includes(rule.status)) continue;

    const eff = round4(effectiveConfidence(rule, asOfDate));
    if (eff !== rule.confidence) {
      changes.push({ id: rule.id, event: 'confidence_decay', from: rule.confidence, to: eff });
      if (!dryRun) rule.confidence = eff;
    }

    if (rule.status === 'active' && eff < DEPRECATION_FLOOR) {
      changes.push({ id: rule.id, event: 'status_transition', from: 'active', to: 'deprecated', reason: `effective confidence ${eff} < ${DEPRECATION_FLOOR}` });
      if (!dryRun) rule.status = 'deprecated';
    }

    // keep expires_at in sync with the (possibly unchanged) confidence_base/last_validated_at anchor
    const newExpiry = expiryDate(rule.confidence_base, rule.last_validated_at, rule.half_life_days);
    if (newExpiry !== rule.expires_at) {
      if (!dryRun) rule.expires_at = newExpiry;
    }
  }
  return { data, changes };
}

// ── --validate ───────────────────────────────────────────────────────────────

const VALID_OUTCOMES = new Set(['win', 'loss', 'neutral']);
const OUTCOME_STEP = { win: 0.05, loss: -0.10, neutral: 0 };

function mergeEvidencePatch(evidence, patch) {
  for (const [k, v] of Object.entries(patch || {})) {
    if (Array.isArray(v)) {
      const existing = Array.isArray(evidence[k]) ? evidence[k] : [];
      evidence[k] = Array.from(new Set([...existing, ...v]));
    } else {
      evidence[k] = v;
    }
  }
  return evidence;
}

/**
 * Record a real-world outcome against a rule: bumps evidence.sample_size /
 * wins / losses, merges an optional evidence-json patch (arrays are
 * unioned+deduped, scalars overwritten), moves last_validated_at to asOfDate,
 * and recomputes confidence_base (win +0.05 / loss -0.10 / neutral +0,
 * clamped 0-1). Since last_validated_at becomes asOfDate, the new effective
 * confidence == the new confidence_base (zero elapsed decay at the moment
 * of validation).
 *
 * A deprecated market_truth rule whose confidence rises back to >= 0.30
 * through revalidation is automatically reactivated to 'active' (symmetric
 * to the auto-deprecation threshold in decay()).
 */
function validateRule(data, { id, outcome, evidencePatch = {}, asOfDate = todayIso() } = {}) {
  if (!VALID_OUTCOMES.has(outcome)) {
    throw new Error(`Invalid outcome "${outcome}" — must be one of: win, loss, neutral`);
  }
  const rule = data.rules.find(r => r.id === id);
  if (!rule) throw new Error(`Unknown rule id: ${id}`);

  const ev = rule.evidence || (rule.evidence = {});
  if (outcome === 'win') {
    ev.wins = (ev.wins || 0) + 1;
    ev.sample_size = (ev.sample_size || 0) + 1;
  } else if (outcome === 'loss') {
    ev.losses = (ev.losses || 0) + 1;
    ev.sample_size = (ev.sample_size || 0) + 1;
  } else {
    ev.sample_size = (ev.sample_size || 0) + 1;
  }
  mergeEvidencePatch(ev, evidencePatch);

  const base = typeof rule.confidence_base === 'number' ? rule.confidence_base : rule.confidence;
  const newBase = round4(clamp(base + OUTCOME_STEP[outcome], 0, 1));
  rule.confidence_base = newBase;
  rule.confidence = newBase;
  rule.last_validated_at = asOfDate;
  rule.expires_at = expiryDate(rule.confidence_base, rule.last_validated_at, rule.half_life_days);

  if (rule.status === 'deprecated' && rule.class === 'market_truth' && newBase >= DEPRECATION_FLOOR) {
    rule.status = 'active';
  }

  return rule;
}

// ── --promote ────────────────────────────────────────────────────────────────

const PROMOTION_GATES = {
  minSampleSize: 12,
  minDistinctTickers: 3,
  minDistinctClusters: 2,
};

/**
 * Anti-overfit promotion gate: candidate -> active only if ALL hold:
 *   - evidence.sample_size >= 12
 *   - >= 3 distinct evidence.tickers
 *   - >= 2 distinct evidence.clusters
 *   - scope.regimes has >= 2 entries (validated across regimes) OR exactly 1
 *     entry (rule explicitly scoped to a single regime, so cross-regime
 *     generalization isn't claimed/required). Zero entries (unscoped =
 *     claims to apply to ALL regimes) fails this gate — too broad a claim
 *     for the available evidence.
 *   - evidence.expectancy is not null/undefined
 * Returns { ok, missing: [...] } and never mutates on failure. On success,
 * flips status to 'active', re-anchors last_validated_at, and rounds up
 * confidence slightly (+0.1, capped 1.0) to reflect the promotion event.
 */
function promote(data, { id, asOfDate = todayIso() } = {}) {
  const rule = data.rules.find(r => r.id === id);
  if (!rule) throw new Error(`Unknown rule id: ${id}`);

  const missing = [];
  if (rule.status !== 'candidate') {
    missing.push(`status must be 'candidate' (current: '${rule.status}')`);
    return { ok: false, id, missing };
  }

  const ev = rule.evidence || {};
  const sampleSize = ev.sample_size || 0;
  const distinctTickers = new Set(ev.tickers || []).size;
  const distinctClusters = new Set(ev.clusters || []).size;
  const regimes = (rule.scope && rule.scope.regimes) || [];
  const regimesOk = regimes.length >= 2 || regimes.length === 1;
  const hasExpectancy = ev.expectancy !== null && ev.expectancy !== undefined;

  if (sampleSize < PROMOTION_GATES.minSampleSize) {
    missing.push(`evidence.sample_size >= ${PROMOTION_GATES.minSampleSize} (got ${sampleSize})`);
  }
  if (distinctTickers < PROMOTION_GATES.minDistinctTickers) {
    missing.push(`>= ${PROMOTION_GATES.minDistinctTickers} distinct evidence.tickers (got ${distinctTickers})`);
  }
  if (distinctClusters < PROMOTION_GATES.minDistinctClusters) {
    missing.push(`>= ${PROMOTION_GATES.minDistinctClusters} distinct evidence.clusters (got ${distinctClusters})`);
  }
  if (!regimesOk) {
    missing.push(`scope.regimes must have >= 2 entries or exactly 1 (got ${regimes.length})`);
  }
  if (!hasExpectancy) {
    missing.push(`evidence.expectancy must be non-null (got ${ev.expectancy === undefined ? 'undefined' : ev.expectancy})`);
  }

  if (missing.length) return { ok: false, id, missing };

  rule.status = 'active';
  rule.confidence_base = round4(clamp((rule.confidence_base || rule.confidence || 0.5) + 0.1, 0, 1));
  rule.confidence = rule.confidence_base;
  rule.last_validated_at = asOfDate;
  rule.expires_at = expiryDate(rule.confidence_base, rule.last_validated_at, rule.half_life_days);

  return { ok: true, id, missing: [] };
}

// ── --contradictions ─────────────────────────────────────────────────────────

const RESTRICT_RE = /reject|ban|penalty|penalize|cap_|block|disqualif|reduce_sizing|delay_|hard_reject/i;
const PROMOTE_RE = /prefer|boost|force_allocation|increase/i;

function classifyEffect(effect) {
  if (!effect || !effect.action) return null;
  if (RESTRICT_RE.test(effect.action)) return 'restrict';
  if (PROMOTE_RE.test(effect.action)) return 'promote';
  return null;
}

function arraysIntersect(a, b) {
  if (!a || !b || !a.length || !b.length) return false;
  const bs = new Set(b.map(x => String(x).toLowerCase()));
  return a.some(x => bs.has(String(x).toLowerCase()));
}

function targetsOverlap(targetA, targetB) {
  if (!targetA || !targetB) return false;
  for (const key of ['strategy', 'sector', 'cluster', 'ticker']) {
    if (arraysIntersect(targetA[key], targetB[key])) return true;
  }
  return false;
}

function scopeOverlaps(scopeA, scopeB) {
  const ra = (scopeA && scopeA.regimes) || [];
  const rb = (scopeB && scopeB.regimes) || [];
  if (!ra.length || !rb.length) return true; // unscoped = applies everywhere = overlaps by definition
  return arraysIntersect(ra, rb);
}

/**
 * Pairwise scan of active rules for opposite effects on an overlapping
 * scope/target (e.g. one rule REJECTs strategy X in regime R while another
 * PREFERs/BOOSTs strategy X in an overlapping regime). On a detected pair,
 * BOTH rules' confidence_base is cut by 30% (never just the newer one — per
 * spec, the engine must not silently assume the more recent rule wins), and
 * an _open_questions entry is appended for human cross-validation.
 * Never mutates status automatically.
 */
function findContradictions(data, { asOfDate = todayIso(), dryRun = false } = {}) {
  const active = data.rules.filter(r => r.status === 'active');
  const pairs = [];

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i], b = active[j];
      const ca = classifyEffect(a.effect);
      const cb = classifyEffect(b.effect);
      if (!ca || !cb || ca === cb) continue;
      if (!targetsOverlap(a.effect.target, b.effect.target)) continue;
      if (!scopeOverlaps(a.scope, b.scope)) continue;
      pairs.push([a, b]);
    }
  }

  if (!dryRun) {
    for (const [a, b] of pairs) {
      for (const rule of [a, b]) {
        rule.confidence_base = round4(clamp(rule.confidence_base * (1 - CONTRADICTION_PENALTY), 0, 1));
        rule.confidence = rule.confidence_base;
        rule.expires_at = expiryDate(rule.confidence_base, rule.last_validated_at, rule.half_life_days);
      }
      data._open_questions = data._open_questions || [];
      data._open_questions.push({
        id: `contradiction-${a.id}-${b.id}-${asOfDate}`,
        type: 'contradiction',
        rule_ids: [a.id, b.id],
        question: `Rules "${a.id}" and "${b.id}" have opposing effects on an overlapping scope/target. Cross-validate against retro evidence before trusting either — confidence for both was cut 30% pending review. Do NOT assume the more recent rule automatically wins.`,
        created_at: asOfDate,
      });
    }
  }

  return { data, pairs: pairs.map(([a, b]) => [a.id, b.id]) };
}

// ── --report ─────────────────────────────────────────────────────────────────

/**
 * Rules considered "effectively active" for reporting: status === 'active'
 * AND not past their expires_at review horizon. A rule can be status=active
 * in storage yet excluded here if --decay hasn't run recently enough to
 * catch up with its expiry — this keeps the report honest even between
 * --decay runs.
 */
function getEffectivelyActiveRules(data, asOfDate = todayIso()) {
  return data.rules.filter(r => {
    if (r.status !== 'active') return false;
    if (r.class === 'process_rule') return true; // never expires
    if (!r.expires_at) return true;
    return r.expires_at >= asOfDate;
  });
}

function buildReportRows(data, asOfDate = todayIso()) {
  return data.rules.map(r => ({
    id: r.id,
    class: r.class,
    status: r.status,
    confidence_effective: round4(effectiveConfidence(r, asOfDate)),
    expires_at: r.expires_at || '—',
    evidence_n: r.evidence && r.evidence.sample_size != null ? r.evidence.sample_size : '—',
  }));
}

function formatReport(rows) {
  const headers = ['id', 'class', 'status', 'confidence', 'expires_at', 'evidence_n'];
  const widths = headers.map((h, i) => Math.max(
    h.length,
    ...rows.map(r => String(Object.values(r)[i]).length)
  ));
  const line = (cells) => cells.map((c, i) => String(c).padEnd(widths[i])).join('  ');
  const out = [line(headers), line(widths.map(w => '-'.repeat(w)))];
  for (const r of rows) out.push(line(Object.values(r)));
  return out.join('\n');
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
  const file = args.file || DEFAULT_FILE;
  const asOfDate = args.date || todayIso();
  const dryRun = !!args['dry-run'];

  const data = loadLessons(file);

  if (args.decay) {
    const { changes } = decay(data, { asOfDate, dryRun });
    console.log(`[lessons-engine] --decay (asOf=${asOfDate}${dryRun ? ', dry-run' : ''})`);
    if (!changes.length) console.log('  No changes.');
    for (const c of changes) {
      if (c.event === 'confidence_decay') console.log(`  ${c.id}: confidence ${c.from} -> ${c.to}`);
      else console.log(`  ${c.id}: status ${c.from} -> ${c.to} (${c.reason})`);
    }
    if (!dryRun) saveLessons(file, data);
    return;
  }

  if (args.validate) {
    const id = args.validate;
    const outcome = args.outcome;
    let evidencePatch = {};
    if (args['evidence-json']) {
      try {
        evidencePatch = JSON.parse(args['evidence-json']);
      } catch (e) {
        console.error(`[lessons-engine] Invalid --evidence-json: ${e.message}`);
        process.exit(1);
      }
    }
    if (!outcome) {
      console.error('[lessons-engine] --validate requires --outcome <win|loss|neutral>');
      process.exit(1);
    }
    try {
      const rule = validateRule(data, { id, outcome, evidencePatch, asOfDate });
      console.log(`[lessons-engine] --validate ${id} outcome=${outcome} (asOf=${asOfDate}${dryRun ? ', dry-run' : ''})`);
      console.log(`  confidence -> ${rule.confidence} | status=${rule.status} | evidence.sample_size=${rule.evidence.sample_size}`);
      if (!dryRun) saveLessons(file, data);
    } catch (e) {
      console.error(`[lessons-engine] ${e.message}`);
      process.exit(1);
    }
    return;
  }

  if (args.promote) {
    const id = args.promote;
    try {
      const result = promote(data, { id, asOfDate });
      if (result.ok) {
        console.log(`[lessons-engine] --promote ${id}: PROMOTED candidate -> active (asOf=${asOfDate}${dryRun ? ', dry-run' : ''})`);
        if (!dryRun) saveLessons(file, data);
      } else {
        console.log(`[lessons-engine] --promote ${id}: REFUSED — missing gates:`);
        for (const m of result.missing) console.log(`  - ${m}`);
        process.exitCode = 1;
      }
    } catch (e) {
      console.error(`[lessons-engine] ${e.message}`);
      process.exit(1);
    }
    return;
  }

  if (args.contradictions) {
    const { pairs } = findContradictions(data, { asOfDate, dryRun });
    console.log(`[lessons-engine] --contradictions (asOf=${asOfDate}${dryRun ? ', dry-run' : ''})`);
    if (!pairs.length) console.log('  No contradictions detected among active rules.');
    for (const [a, b] of pairs) console.log(`  CONTRADICTION: "${a}" vs "${b}" — both confidence cut 30%, open_question added.`);
    if (!dryRun) saveLessons(file, data);
    return;
  }

  if (args.report) {
    const rows = buildReportRows(data, asOfDate);
    console.log(`[lessons-engine] --report (asOf=${asOfDate})`);
    console.log(formatReport(rows));
    const activeCount = getEffectivelyActiveRules(data, asOfDate).length;
    console.log(`\n${activeCount}/${data.rules.length} rules effectively active (status=active AND not past expires_at).`);
    return;
  }

  console.log(`Usage:
  node tools/lessons-engine.js --report [--dry-run] [--date YYYY-MM-DD]
  node tools/lessons-engine.js --decay [--dry-run] [--date YYYY-MM-DD]
  node tools/lessons-engine.js --validate <id> --outcome <win|loss|neutral> [--evidence-json '<json>'] [--dry-run]
  node tools/lessons-engine.js --promote <id> [--dry-run]
  node tools/lessons-engine.js --contradictions [--dry-run]
  [--file <path>] defaults to data/scanner-lessons.json`);
}

if (require.main === module) {
  main();
}

module.exports = {
  loadLessons,
  saveLessons,
  effectiveConfidence,
  expiryDate,
  decay,
  validateRule,
  promote,
  findContradictions,
  getEffectivelyActiveRules,
  buildReportRows,
  formatReport,
  todayIso,
  diffDays,
  addDaysIso,
  DEPRECATION_FLOOR,
};
