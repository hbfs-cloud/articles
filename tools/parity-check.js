#!/usr/bin/env node
'use strict';

/**
 * parity-check.js — Go (systematic-tss) ↔ articles scanner-mode parity drift detector
 *
 * Every scripted scanner mode (highvol, etf, etf_eu, casablanca, trendline) claims to mirror
 * a backtested Go strategy in systematic-tss (5y CAGR figures live in the yaml comments).
 * v10.2 (2026-07-02, see .claude/memory/project_parity_v10_2.md and
 * data/modes-config-history.json entry "v10.2-20260702") realigned the scripted configs onto
 * the Go configs. This script re-derives that comparison mechanically so future edits to either
 * side (a Go config sweep, or a scripted mode tweak) get caught instead of silently drifting
 * for months, like the pre-v10.2 state did.
 *
 * Scope / exceptions (deliberate, NOT bugs — do not "fix" the map to make these compare):
 *   - bull: ONLY min_vol_ratio is compared. bull is a documented DELIBERATE high-conviction
 *     variant (score 88 / P3 / H8) vs the Go yaml's min_score 70 / P5 / H10 — see
 *     .claude/memory/feedback_bull_8x_parity.md ("Bull 8× Parity"). Comparing those other
 *     params would be comparing apples to oranges on purpose.
 *   - momentum (US): no Go 5y backtest exists for momentum-rotation on the US universe
 *     (only MA/EU/global) — open flag, not in this map at all.
 *   - etf_eu maxStopPct: NOT compared. Go's dynamic_max_loss is flat 0.17 (→17%) for etf_eu
 *     too, but articles etf_eu.maxStopPct is 0 (ATR-only stop) — a known, accepted gap, not
 *     part of the v10.2 alignment (see modes-config-history.json v10.2 comment: etf_eu list
 *     does not mention maxStopPct).
 *   - casablanca skip_months: Go has skip_months:[9] (September underperforms); pit-engine.js
 *     has no month-skip mechanism. Documented open gap (project_parity_v10_2.md), reported here
 *     as GAP (informational), not DRIFT — it must not fail the gate every single day.
 *
 * Usage:
 *   node tools/parity-check.js               # exit 1 if any real DRIFT found
 *   node tools/parity-check.js --warn-only    # always exit 0, DRIFT rows still printed
 *
 * If ../systematic-tss doesn't exist (cloud/CI runners don't have read access to that repo),
 * prints a one-line notice and exits 0 — this check is a local/dev safety net, not a hard gate.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GO_ROOT = path.resolve(ROOT, '..', 'systematic-tss');
const WARN_ONLY = process.argv.includes('--warn-only');

if (!fs.existsSync(GO_ROOT)) {
  console.log('systematic-tss absent — parity check skipped');
  process.exit(0);
}

// ─── Minimal regex-based YAML scalar/block extractor ───────────────────────
// These config files are simple (scalars + one level of nested maps/lists), so a full
// YAML parser is overkill — we only need a handful of key lookups, indentation-scoped
// so that e.g. "risk_on:" inside dynamic_max_loss doesn't get confused with the
// "risk_on:" inside dynamic_max_positions a few lines below it.

function stripComment(line) {
  const idx = line.indexOf(' #');
  return idx === -1 ? line : line.slice(0, idx);
}

function indentOf(line) {
  return line.match(/^[ \t]*/)[0].length;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Locates `key:` (optionally dash-prefixed, i.e. a YAML list item's own key) and returns
// { inlineValue, blockLines } where blockLines are the following lines indented strictly
// more than the key line (its nested map/list), stopping at the first sibling/dedent.
function findBlock(text, key) {
  const lines = text.split('\n');
  const keyRe = new RegExp(`^([ \\t]*)(?:-[ \\t]*)?${escapeRe(key)}:[ \\t]*(.*)$`);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(keyRe);
    if (!m) continue;
    const baseIndent = m[1].length;
    const inlineValue = stripComment(m[2]).trim();
    const blockLines = [];
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      if (l.trim() === '') continue;
      if (indentOf(l) <= baseIndent) break;
      blockLines.push(l);
    }
    return { inlineValue, blockLines };
  }
  return null;
}

function getScalar(text, key) {
  const b = findBlock(text, key);
  if (!b || !b.inlineValue) return null;
  return b.inlineValue.replace(/^["']|["']$/g, '');
}

function getNestedScalar(text, parentKey, childKey) {
  const b = findBlock(text, parentKey);
  if (!b) return null;
  return getScalar(b.blockLines.join('\n'), childKey);
}

// All direct numeric scalar children of a block, e.g. dynamic_max_loss: {risk_on: 0.35, ...}
function getBlockNumericValues(text, key) {
  const b = findBlock(text, key);
  if (!b) return null;
  const values = [];
  for (const l of b.blockLines) {
    const m = stripComment(l).match(/^[ \t]*[\w.]+:[ \t]*([\d.]+)[ \t]*$/);
    if (m) values.push(parseFloat(m[1]));
  }
  return values.length ? values : null;
}

// "- item" lines inside a block (YAML list), e.g. scanner_filters.params.blacklist
function getListItems(text, key) {
  const b = findBlock(text, key);
  if (!b) return null;
  const items = [];
  for (const l of b.blockLines) {
    const m = stripComment(l).match(/^[ \t]*-[ \t]*(.+?)[ \t]*$/);
    if (m && m[1]) items.push(m[1].trim());
  }
  return items;
}

// Go's dynamic_max_loss / max_loss_pct are fractions (0.15 = 15%); articles' maxStopPct is a
// plain percent number (15). The v10.2 alignment used the TIGHTEST (min) regime value as the
// static hard-cap, since maxStopPct can't be regime-adaptive the way Go's dynamic dict is.
// IMPORTANT: check the top-level dynamic_max_loss block FIRST. Some configs (e.g. etf_us.yaml)
// also have an unrelated nested `max_loss_pct` under `early_exit:` (a different concept — an
// early stop-out for fast losers, not the position's overall max stop) — a flat-scalar-first
// lookup would silently grab that instead, since findBlock() isn't indentation-anchored to the
// allocation's top level.
function maxLossPctFromGo(text) {
  const blockVals = getBlockNumericValues(text, 'dynamic_max_loss');
  if (blockVals) return Math.min(...blockVals) * 100;
  const flat = getScalar(text, 'max_loss_pct');
  if (flat !== null) return parseFloat(flat) * 100;
  return null;
}

function jsConstNumber(text, name) {
  const m = text.match(new RegExp(`const\\s+${name}\\s*=\\s*([\\d.]+)`));
  return m ? parseFloat(m[1]) : null;
}

function jsSetSize(text, varName) {
  const m = text.match(new RegExp(`${varName}\\s*=\\s*new Set\\(\\[([\\s\\S]*?)\\]\\)`));
  if (!m) return null;
  const items = m[1].match(/'[^']*'|"[^"]*"/g) || [];
  return items.length;
}

function approxEqual(a, b, eps = 1e-6) {
  const na = typeof a === 'number' ? a : parseFloat(a);
  const nb = typeof b === 'number' ? b : parseFloat(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return Math.abs(na - nb) < eps;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

// ─── File readers ───────────────────────────────────────────────────────────

function readGoFile(relPath) {
  const full = path.join(GO_ROOT, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
}
function readGoFileWithFallback(relPaths) {
  for (const p of relPaths) {
    const text = readGoFile(p);
    if (text !== null) return { text, usedPath: p };
  }
  return { text: null, usedPath: relPaths[relPaths.length - 1] };
}
function readArticlesFile(relPath) {
  const full = path.join(ROOT, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
}
function readArticlesJSON(relPath) {
  const text = readArticlesFile(relPath);
  return text ? JSON.parse(text) : null;
}

// ─── Row helper ─────────────────────────────────────────────────────────────

function row(mode, label, goVal, artVal, opts = {}) {
  const { gap = false, note = '', goSource = '', artSource = '' } = opts;
  let status;
  let finalNote = note;
  if (gap) {
    status = 'GAP';
  } else if (goVal === null || goVal === undefined || artVal === null || artVal === undefined) {
    status = 'DRIFT';
    finalNote = finalNote || 'extraction échouée (fichier/clé introuvable)';
  } else if (approxEqual(goVal, artVal)) {
    status = 'OK';
  } else {
    status = 'DRIFT';
  }
  return { mode, label, goVal, artVal, status, note: finalNote, goSource, artSource };
}

// ─── PARITY_MAP — declarative mode → Go file → param pairs (v10.2 alignment) ──
// Each entry's `run(ctx)` returns the comparison rows for that mode. The extraction logic is
// intentionally explicit per param rather than hidden behind a generic engine — these Go yaml
// files are hand-tuned artifacts, not a uniform schema, and being explicit here means a broken
// mapping shows up as a clear DRIFT/extraction-failure row instead of a silent false OK.

const modesConfig = readArticlesJSON('data/modes-config.json');
const modes = (modesConfig && modesConfig.modes) || {};

const PARITY_MAP = [
  {
    id: 'highvol',
    goFile: 'config/portfolio_us_highvol.yaml',
    run(ctx) {
      const { text } = ctx.go('config/portfolio_us_highvol.yaml');
      const art = modes.highvol || {};
      if (!text) return [row('highvol', 'file', null, null, { note: 'Go yaml introuvable' })];
      return [
        row('highvol', 'positions (risk_on) ↔ portfolioSize',
          getNestedScalar(text, 'dynamic_max_positions', 'risk_on'), art.portfolioSize),
        row('highvol', 'timeout_days ↔ horizon',
          getScalar(text, 'timeout_days'), art.horizon),
        row('highvol', 'base_stop_atr ↔ atrStopMult',
          getScalar(text, 'base_stop_atr'), art.atrStopMult),
        row('highvol', 'take_profit_pct ↔ partialTPGain (%)',
          getScalar(text, 'take_profit_pct'), art.partialTPGain),
        row('highvol', 'max_correlation ↔ correlationCap',
          getScalar(text, 'max_correlation'), art.correlationCap),
        row('highvol', 'max_loss (min dynamic_max_loss, ×100) ↔ maxStopPct',
          maxLossPctFromGo(text), art.maxStopPct),
      ];
    },
  },
  {
    id: 'etf',
    goFile: 'config/pre-live/portfolio_etf_us.yaml',
    run(ctx) {
      const { text } = ctx.go('config/pre-live/portfolio_etf_us.yaml');
      const scannerText = ctx.articles('tools/etf-scanner.js');
      const art = modes.etf || {};
      if (!text) return [row('etf', 'file', null, null, { note: 'Go yaml introuvable' })];
      return [
        row('etf', 'positions ↔ portfolioSize',
          getScalar(text, 'max_open_positions'), art.portfolioSize),
        row('etf', 'base_stop_atr ↔ atrStopMult',
          getScalar(text, 'base_stop_atr'), art.atrStopMult),
        row('etf', 'max_loss (min dynamic_max_loss, ×100) ↔ maxStopPct',
          maxLossPctFromGo(text), art.maxStopPct),
        row('etf', 'scanner_filters.min_price ↔ etf-scanner.js MIN_PRICE',
          getScalar(text, 'min_price'), scannerText ? jsConstNumber(scannerText, 'MIN_PRICE') : null),
        row('etf', 'scanner_filters.max_atr_ratio ↔ etf-scanner.js MAX_ATR_RATIO',
          getScalar(text, 'max_atr_ratio'), scannerText ? jsConstNumber(scannerText, 'MAX_ATR_RATIO') : null),
      ];
    },
  },
  {
    id: 'etf_eu',
    goFile: 'config/later/portfolio_etf_eu.yaml',
    run(ctx) {
      const { text } = ctx.go('config/later/portfolio_etf_eu.yaml');
      const scannerText = ctx.articles('tools/etf-scanner.js');
      const art = modes.etf_eu || {};
      if (!text) return [row('etf_eu', 'file', null, null, { note: 'Go yaml introuvable' })];
      return [
        row('etf_eu', 'positions ↔ portfolioSize',
          getScalar(text, 'max_open_positions'), art.portfolioSize),
        row('etf_eu', 'min_score ↔ minScore',
          getScalar(text, 'min_score'), art.minScore),
        row('etf_eu', 'base_stop_atr ↔ atrStopMult',
          getScalar(text, 'base_stop_atr'), art.atrStopMult),
        row('etf_eu', 'blacklist size ↔ BLACKLIST_EU.size (etf-scanner.js)',
          (() => { const items = getListItems(text, 'blacklist'); return items ? items.length : null; })(),
          scannerText ? jsSetSize(scannerText, 'BLACKLIST_EU') : null),
      ];
    },
  },
  {
    id: 'casablanca',
    goFile: 'config/later/portfolio_ma.yaml (fallback: config/pre-live/portfolio_ma.yaml)',
    run(ctx) {
      const { text, usedPath } = ctx.goFallback([
        'config/later/portfolio_ma.yaml',
        'config/pre-live/portfolio_ma.yaml',
      ]);
      const art = modes.casablanca || {};
      if (!text) return [row('casablanca', 'file', null, null, { note: 'Go yaml introuvable (ni later/ ni pre-live/)' })];
      const rows = [
        row('casablanca', `timeout_days ↔ horizon (${usedPath})`,
          getScalar(text, 'timeout_days'), art.horizon),
        row('casablanca', 'positions ↔ portfolioSize',
          getScalar(text, 'max_open_positions'), art.portfolioSize),
        row('casablanca', 'strategy=momentum-rotation ↔ rotation=daily_max1',
          getScalar(text, 'strategy') === 'momentum-rotation' && art.rotation === 'daily_max1' ? 'match' : 'mismatch',
          'match'),
      ];
      const skipMonths = getScalar(text, 'skip_months');
      rows.push(row('casablanca', 'skip_months presence (Go-only, no articles equivalent)',
        skipMonths, 'not implemented — documented gap',
        { gap: true, note: `Go has skip_months: ${skipMonths} — pit-engine.js has no month-skip mechanism (see project_parity_v10_2.md "Gaps restants")` }));
      return rows;
    },
  },
  {
    id: 'trendline',
    goFile: 'internal/engine/pm_eu_trend.go (constants hardcoded here — Go source parsing is brittle for this file)',
    run() {
      const art = modes.trendline || {};
      // Verified by hand against pm_eu_trend.go comments/constants on 2026-07-02:
      //   "Stop: 2.5xATR" / "Timeout: 25 jours" (both literal Go consts: stopATRMult=2.5, timeout=25)
      // minScore=50 is the scanner-side threshold applied to filterName=trendline_breakout signals,
      // not a Go PM constant — carried over from the v10.2 alignment comment (minScore 40→50).
      const HARDCODED = { horizon: 25, atrStopMult: 2.5, minScore: 50 };
      return [
        row('trendline', 'horizon (hardcoded from pm_eu_trend.go: "Timeout: 25 jours")',
          HARDCODED.horizon, art.horizon),
        row('trendline', 'atrStopMult (hardcoded from pm_eu_trend.go: "Stop: 2.5xATR")',
          HARDCODED.atrStopMult, art.atrStopMult),
        row('trendline', 'minScore (hardcoded, v10.2 alignment target)',
          HARDCODED.minScore, art.minScore),
      ];
    },
  },
  {
    id: 'bull',
    goFile: 'config/portfolio_us_americanbulls.yaml',
    run(ctx) {
      const { text } = ctx.go('config/portfolio_us_americanbulls.yaml');
      const filters = readArticlesJSON('data/scanner-filters.json');
      if (!text) return [row('bull', 'file', null, null, { note: 'Go yaml introuvable' })];
      // ONLY min_vol_ratio is compared — bull is a DELIBERATE high-conviction variant
      // (score 88 / P3 / H8) vs Go's min_score 70 / P5 / H10 (see feedback_bull_8x_parity.md).
      // Comparing minScore/portfolioSize/horizon here would be a false-positive DRIFT by design.
      return [
        row('bull', 'min_vol_ratio ↔ scanner-filters.json candlestick.min_vol_ratio_trading',
          getNestedScalar(text, 'scanner_filters', 'min_vol_ratio'),
          filters && filters.candlestick ? filters.candlestick.min_vol_ratio_trading : null),
      ];
    },
  },
];

// ─── Run ─────────────────────────────────────────────────────────────────────

const goCache = new Map();
const articlesCache = new Map();
const ctx = {
  go(relPath) {
    if (!goCache.has(relPath)) goCache.set(relPath, { text: readGoFile(relPath), usedPath: relPath });
    return goCache.get(relPath);
  },
  goFallback(relPaths) {
    const key = relPaths.join('|');
    if (!goCache.has(key)) goCache.set(key, readGoFileWithFallback(relPaths));
    return goCache.get(key);
  },
  articles(relPath) {
    if (!articlesCache.has(relPath)) articlesCache.set(relPath, readArticlesFile(relPath));
    return articlesCache.get(relPath);
  },
};

const allRows = [];
for (const mode of PARITY_MAP) {
  try {
    allRows.push(...mode.run(ctx));
  } catch (e) {
    allRows.push(row(mode.id, 'run() threw', null, null, { note: e.message }));
  }
}

// ─── Print table ─────────────────────────────────────────────────────────────

function fmt(v) {
  if (v === null || v === undefined) return '(none)';
  return String(v);
}

const modeW = Math.max(4, ...allRows.map(r => r.mode.length));
const labelW = Math.max(5, ...allRows.map(r => r.label.length));
const goW = Math.max(2, ...allRows.map(r => fmt(r.goVal).length));
const artW = Math.max(9, ...allRows.map(r => fmt(r.artVal).length));

function pad(s, w) { return String(s).padEnd(w); }

console.log('');
console.log('Parity check — systematic-tss (Go) ↔ articles (scripted modes) — v10.2 alignment');
console.log('='.repeat(80));
console.log(pad('MODE', modeW) + '  ' + pad('PARAM', labelW) + '  ' + pad('GO', goW) + '  ' + pad('ARTICLES', artW) + '  STATUS');
console.log('-'.repeat(modeW) + '  ' + '-'.repeat(labelW) + '  ' + '-'.repeat(goW) + '  ' + '-'.repeat(artW) + '  ------');

for (const r of allRows) {
  console.log(
    pad(r.mode, modeW) + '  ' + pad(r.label, labelW) + '  ' + pad(fmt(r.goVal), goW) + '  ' + pad(fmt(r.artVal), artW) + '  ' + r.status +
    (r.note ? `  (${r.note})` : '')
  );
}

const driftRows = allRows.filter(r => r.status === 'DRIFT');
const gapRows = allRows.filter(r => r.status === 'GAP');
const okRows = allRows.filter(r => r.status === 'OK');

console.log('-'.repeat(80));
console.log(`Total: ${allRows.length} | OK: ${okRows.length} | DRIFT: ${driftRows.length} | GAP (documented, non-blocking): ${gapRows.length}`);
console.log('');

if (driftRows.length > 0) {
  console.log(`${driftRows.length} real DRIFT row(s) found:`);
  driftRows.forEach(r => console.log(`  - [${r.mode}] ${r.label}: Go=${fmt(r.goVal)} vs articles=${fmt(r.artVal)}${r.note ? ` — ${r.note}` : ''}`));
  console.log('');
}

if (driftRows.length > 0 && !WARN_ONLY) {
  process.exit(1);
}
process.exit(0);
