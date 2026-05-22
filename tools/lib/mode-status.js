/**
 * Mode status state machine.
 *
 * States:
 *   draft         — config created, never run
 *   test          — paper trading only
 *   test-to-live  — activation queued, awaits validation
 *   live          — fully active
 *   live-to-pause — exit-only: no new entries, manage open positions
 *   paused        — inactive, equity frozen, can resume
 *   stopped       — archived, terminal
 */

const VALID_STATES = [
  'draft',
  'test',
  'test-to-live',
  'live',
  'live-to-pause',
  'paused',
  'stopped',
];

const VALID_TRANSITIONS = {
  draft:           ['test'],
  test:            ['test-to-live', 'draft'],
  'test-to-live':  ['live', 'test'],
  live:            ['live-to-pause'],
  'live-to-pause': ['paused'],
  paused:          ['live', 'stopped'],
  stopped:         [],
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
  // live + test = full new entries. test-to-live = gradual ramp-up: entries
  // flow at-the-water (paper executions validated before flipping to live).
  return state === 'live' || state === 'test' || state === 'test-to-live';
}

function exitsOnly(state) {
  return state === 'live-to-pause';
}

function publiclyVisible(state) {
  return state !== 'draft' && state !== 'stopped';
}

function tradingMode(state) {
  if (state === 'live') return 'real';
  if (state === 'test') return 'paper';
  if (state === 'test-to-live') return 'paper-ramp';  // paper orders pending live promotion
  if (state === 'live-to-pause') return 'exit-only';
  return 'none';
}

// True when the mode should continue managing existing positions toward exit
// (SL / TP / horizon / trailing) but not open new ones. Useful for the
// intelligent wind-down phase: live-to-pause runs normal exit logic while
// suppressing new entries and rotations.
function windsDownPositions(state) {
  return state === 'live-to-pause';
}

function describe(state) {
  const m = {
    draft:           { label: 'Draft',     color: '#94a3b8', sortRank: 5 },
    test:            { label: 'Test',      color: '#3b82f6', sortRank: 3 },
    'test-to-live':  { label: 'Activating',color: '#f59e0b', sortRank: 2 },
    live:            { label: 'Live',      color: '#10b981', sortRank: 0 },
    'live-to-pause': { label: 'Exiting',   color: '#f59e0b', sortRank: 1 },
    paused:          { label: 'Paused',    color: '#94a3b8', sortRank: 4 },
    stopped:         { label: 'Stopped',   color: '#475569', sortRank: 6 },
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
  describe,
  statusBlock,
};
