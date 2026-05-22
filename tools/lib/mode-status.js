/**
 * Mode status state machine.
 *
 * States:
 *   draft       — config created, never run
 *   test        — paper trading only
 *   deploying   — gradual ramp-up: paper executions pending live promotion
 *   live        — fully active
 *   pausing     — exit-only: no new entries, manage open positions to natural exit
 *   liquidated  — force-close all positions at market (emergency)
 *   paused      — inactive, equity frozen, can resume
 *   stopped     — archived, terminal
 */

const VALID_STATES = [
  'draft',
  'test',
  'deploying',
  'live',
  'pausing',
  'liquidated',
  'paused',
  'stopped',
];

const VALID_TRANSITIONS = {
  draft:      ['test'],
  test:       ['deploying', 'draft'],
  deploying:  ['live', 'test'],
  live:       ['pausing', 'liquidated'],
  pausing:    ['paused', 'liquidated'],
  liquidated: ['paused', 'stopped'],
  paused:     ['live', 'stopped'],
  stopped:    [],
};

const DEFAULT_STATE = 'live';

function isValidState(state) {
  return VALID_STATES.includes(state);
}

function canTransition(from, to) {
  if (!isValidState(from) || !isValidState(to)) return false;
  return (VALID_TRANSITIONS[from] || []).includes(to);
}

function acceptsNewEntries(state) {
  // live + test = full new entries. deploying = gradual ramp-up: entries
  // flow at-the-water (paper executions validated before flipping to live).
  return state === 'live' || state === 'test' || state === 'deploying';
}

function exitsOnly(state) {
  return state === 'pausing';
}

function publiclyVisible(state) {
  return state !== 'draft' && state !== 'stopped';
}

function tradingMode(state) {
  if (state === 'live') return 'real';
  if (state === 'test') return 'paper';
  if (state === 'deploying') return 'paper-ramp';   // paper orders pending live promotion
  if (state === 'pausing') return 'exit-only';
  if (state === 'liquidated') return 'liquidating'; // force-close all positions at market
  return 'none';
}

// True when the mode should continue managing existing positions toward exit
// (SL / TP / horizon / trailing) but not open new ones. Used during the
// intelligent wind-down phase: pausing runs normal exit logic while
// suppressing new entries and rotations.
function windsDownPositions(state) {
  return state === 'pausing';
}

// True when the mode must force-close every open position at the next market
// open / close (depending on broker policy). Used for emergency exits, not
// the organic wind-down handled by `pausing`.
function forceLiquidate(state) {
  return state === 'liquidated';
}

function describe(state) {
  const m = {
    draft:      { label: 'Draft',       color: '#94a3b8', sortRank: 6 },
    test:       { label: 'Test',        color: '#3b82f6', sortRank: 3 },
    deploying:  { label: 'Deploying',   color: '#f59e0b', sortRank: 2 },
    live:       { label: 'Live',        color: '#10b981', sortRank: 0 },
    pausing:    { label: 'Pausing',     color: '#f59e0b', sortRank: 1 },
    liquidated: { label: 'Liquidating', color: '#dc2626', sortRank: 4 },
    paused:     { label: 'Paused',      color: '#94a3b8', sortRank: 5 },
    stopped:    { label: 'Stopped',     color: '#475569', sortRank: 7 },
  };
  return m[state] || null;
}

function statusBlock(state, since, reason, nextReviewAt) {
  return {
    state,
    since: since || new Date().toISOString(),
    reason: reason || null,
    acceptsNewEntries: acceptsNewEntries(state),
    exitsOnly: exitsOnly(state),
    forceLiquidate: forceLiquidate(state),
    publiclyVisible: publiclyVisible(state),
    tradingMode: tradingMode(state),
    nextReviewAt: nextReviewAt || null,
  };
}

module.exports = {
  VALID_STATES,
  VALID_TRANSITIONS,
  DEFAULT_STATE,
  isValidState,
  canTransition,
  acceptsNewEntries,
  exitsOnly,
  publiclyVisible,
  tradingMode,
  windsDownPositions,
  forceLiquidate,
  describe,
  statusBlock,
};
