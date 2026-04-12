/**
 * tools/config.js — Centralized constants for the scanner → portfolio pipeline.
 *
 * Previously these values were hardcoded across sweep.js, update-tracking.js,
 * gen-status-page.js and gen-api.js. Centralizing prevents drift when rules change.
 *
 * Any change here should be tested by re-running:
 *   node tools/update-tracking.js
 *   node tools/gen-status-page.js
 *   node tools/gen-api.js
 */
'use strict';

module.exports = {
  // ── Scoring & filtering ─────────────────────────────────────────────────
  MIN_SCORE_GLOBAL: 85,      // Legacy fallback (per-mode minScore lives in modes-config.json)
  MAX_SCORE: 100,
  SCORE_RANGE_VALID: [70, 100],  // score parser will only accept values in this range

  // ── Horizons (trading days) ─────────────────────────────────────────────
  HORIZON_DEFAULT: 20,        // Fallback when a scan doesn't specify a horizon
  HORIZON_MAX: 30,

  // ── HTML parser limits ──────────────────────────────────────────────────
  SYNTHESE_MATCH_LEN: 20000,  // Upper bound (chars) when slicing the synthese block
  RECENT_SCANS_WINDOW: 15,    // Number of recent scan dirs to scan for thesis text
  THESIS_MAX_LEN: 140,        // Clip thesis paragraphs to this length
  SCAN_LOOKBACK_DAYS: 35,     // update-tracking.js: only load scans within this window

  // ── Allocation guards ───────────────────────────────────────────────────
  // NOTE: modes are independent alternative strategies — no cross-mode cap.
  ROTATION_SCORE_THRESHOLD: 88, // Score required to trigger an aggressive rotation

  // ── Parsing regexes (shared) ────────────────────────────────────────────
  RE_SCAN_DIR: /^\d{8}(-\d+)?$/,
  RE_TICKER: /^[A-Z]{1,5}$/,
  RE_PRICE_CELL: /^\$[\d.]/,
  RE_RR: /1:\d/,
  RE_STRATEGY: /momentum|squeeze|breakout|pullback|trend follow|defensive yield|defensive|reversal/i,

  // ── Strategy filters (used to partition signals per mode) ───────────────
  STRATEGY_FILTERS: {
    all: () => true,
    no_sq: s => !/short.?squeeze/i.test(s),
    no_sq_pb: s => !/short.?squeeze|pullback/i.test(s),
    momentum_only: s => /momentum/i.test(s),
    breakout_only: s => /breakout/i.test(s),
    mom_bo: s => /momentum|breakout/i.test(s),
  },

  // ── Operational thresholds ──────────────────────────────────────────────
  STOP_BUFFER_PCT: 2,         // "Near stop" threshold for status_label
  ENTRY_ZONE_PCT: 1.5,        // Entry zone band for status_label
  WORKING_CAPITAL_FRACTION: 1 / 30, // Position sizing for equity history
};
