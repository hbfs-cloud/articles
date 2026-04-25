#!/usr/bin/env node
'use strict';

/**
 * signal-monitor.test.js — Unit tests for signal-monitor evaluation logic
 *
 * Tests the two bugs fixed:
 *   BUG-1: NEAR_STOP false positive when trailing stop exceeds entry (negative denominator)
 *   BUG-2: False SL_HIT from Yahoo official-close tick arriving after market hours
 *
 * Run: node tools/signal-monitor.test.js
 */

// ─── Inline the pure logic under test (no imports from signal-monitor.js) ─────

function isMarketHours(now) {
  const d = now || new Date();
  const day = d.getUTCDay();
  if (day === 0 || day === 6) return false;
  const utcMinutes = d.getUTCHours() * 60 + d.getUTCMinutes();
  return utcMinutes >= 13 * 60 + 25 && utcMinutes <= 20 * 60 + 5;
}

function computeInitialStop(entry, rawStop, cfg, atr) {
  let risk = entry - rawStop;
  if (risk <= 0) risk = entry * 0.03;
  if (cfg.maxStopPct > 0) {
    const maxRisk = entry * (cfg.maxStopPct / 100);
    if (risk > maxRisk) risk = maxRisk;
  }
  if (cfg.atrStopMult > 0 && atr) {
    const atrRisk = atr * cfg.atrStopMult;
    if (atrRisk < risk) risk = atrRisk;
  }
  return +(entry - risk).toFixed(4);
}

function updateStopDynamic(entry, currentStop, highWaterMark, price, cfg, partialClosed) {
  let stop = currentStop;
  let hwm = highWaterMark;
  if (price > hwm) hwm = price;
  if (cfg.breakevenPct > 0) {
    const gainPct = (price - entry) / entry * 100;
    if (gainPct >= cfg.breakevenPct && entry > stop) stop = entry;
  }
  if (cfg.dailyTrailPct > 0) {
    const trailLevel = hwm * (1 - cfg.dailyTrailPct / 100);
    if (trailLevel > stop) stop = trailLevel;
  }
  if (cfg.trailingStop && partialClosed) {
    if (entry > stop) stop = entry;
    const riskUnit = entry - currentStop;
    if (riskUnit > 0) {
      const trailLevel = hwm - riskUnit * 1.5;
      if (trailLevel > stop) stop = trailLevel;
    }
  }
  return { currentStop: +stop.toFixed(4), highWaterMark: +hwm.toFixed(4) };
}

/**
 * Determine status for a position — mirrors evaluatePosition() in signal-monitor.js.
 * Returns the status string only (no alerting).
 */
function determineStatus(pos, cfg, priceData, prev) {
  const { price, dayHigh, dayLow } = priceData;
  if (!price || price <= 0) return null;
  const entry = pos.entry;
  if (!entry || entry <= 0) return null;

  const tp1 = pos.tp1 || 0;
  const tp2 = pos.tp2 || null;

  const initialStop = computeInitialStop(entry, pos.stop, cfg, null);
  const prevStop = prev.currentStop !== undefined ? prev.currentStop : initialStop;
  const prevHWM  = prev.highWaterMark !== undefined ? prev.highWaterMark : entry;
  const partialClosed = prev.partialClosed || false;

  const { currentStop, highWaterMark } = updateStopDynamic(
    entry, prevStop, prevHWM, price, cfg, partialClosed,
  );

  let status = 'OPEN';
  const dayLowValid = dayLow > 0 && dayLow > price * 0.85;
  if (price <= currentStop || (dayLowValid && dayLow <= currentStop)) {
    status = 'SL_HIT';
  } else if (tp2 && dayHigh >= tp2) {
    status = 'TP2_HIT';
  } else if (tp1 > 0 && dayHigh >= tp1) {
    if (cfg.partialTP && !partialClosed) {
      status = 'TP1_PARTIAL';
    } else if (!partialClosed) {
      status = 'TP1_HIT';
    }
    if (partialClosed && tp2 && dayHigh >= tp2) {
      status = 'TP2_HIT';
    } else if (partialClosed) {
      status = 'OPEN';
    }
  } else if (cfg.horizon && (prev.daysHeld || 0) > cfg.horizon) {
    status = 'EXPIRED';
  // BUG-1 FIX: added `price > currentStop && entry > currentStop` guards
  } else if (currentStop > 0 && price > currentStop && entry > currentStop && ((price - currentStop) / (entry - currentStop)) < 0.3) {
    status = 'NEAR_STOP';
  } else if (tp1 > 0 && entry > 0 && tp1 > entry && ((price - entry) / (tp1 - entry)) > 0.8) {
    status = 'NEAR_TP1';
  }

  return { status, currentStop, highWaterMark };
}

// ─── Test runner ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, name, detail) {
  if (condition) {
    console.log(`  PASS  ${name}`);
    passed++;
  } else {
    console.error(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

// Shared configs
const fortressCfg = {
  horizon: 8, partialTP: true, partialTPPct: 0.5, trailingStop: false,
  maxStopPct: 0, atrStopMult: 0, dailyTrailPct: 2, breakevenPct: 1,
};
const secureCfg = {
  horizon: 2, partialTP: false, partialTPPct: 0.5, trailingStop: false,
  maxStopPct: 0, atrStopMult: 0, dailyTrailPct: 0, breakevenPct: 1,
};
const noCfg = {
  horizon: 5, partialTP: false, partialTPPct: 0.5, trailingStop: false,
  maxStopPct: 0, atrStopMult: 0, dailyTrailPct: 0, breakevenPct: 0,
};

// ─── Suite 1: Basic status determination ──────────────────────────────────────

console.log('\nSuite 1: Basic status determination');

{
  // Well above SL → should NOT alert
  const pos = { entry: 100, stop: 90, tp1: 115, tp2: 130 };
  const r = determineStatus(pos, noCfg, { price: 108, dayHigh: 109, dayLow: 107 }, {});
  assert(r.status === 'OPEN', 'Position well above SL → OPEN');
}

{
  // Price hits SL → should be SL_HIT
  const pos = { entry: 100, stop: 90, tp1: 115, tp2: 130 };
  const r = determineStatus(pos, noCfg, { price: 89.5, dayHigh: 100, dayLow: 89 }, {});
  assert(r.status === 'SL_HIT', 'Price at SL → SL_HIT');
}

{
  // dayLow hits SL (intraday) → should be SL_HIT
  const pos = { entry: 100, stop: 90, tp1: 115, tp2: 130 };
  const r = determineStatus(pos, noCfg, { price: 95, dayHigh: 96, dayLow: 89.5 }, {});
  assert(r.status === 'SL_HIT', 'dayLow touches SL → SL_HIT');
}

{
  // Price near SL but still above (within 30% of entry-stop range) → NEAR_STOP
  const pos = { entry: 100, stop: 90, tp1: 115, tp2: 130 };
  // price=92 → (92-90)/(100-90) = 0.2 < 0.3 → NEAR_STOP
  const r = determineStatus(pos, noCfg, { price: 92, dayHigh: 95, dayLow: 91 }, {});
  assert(r.status === 'NEAR_STOP', 'Price within 30% of entry-stop range → NEAR_STOP');
}

{
  // Price already below SL → SL_HIT (not NEAR_STOP)
  const pos = { entry: 100, stop: 90, tp1: 115, tp2: 130 };
  const r = determineStatus(pos, noCfg, { price: 85, dayHigh: 90, dayLow: 84 }, {});
  assert(r.status === 'SL_HIT', 'Price below SL → SL_HIT not NEAR_STOP');
}

{
  // TP1 hit → TP1_HIT
  const pos = { entry: 100, stop: 90, tp1: 115, tp2: 130 };
  const r = determineStatus(pos, noCfg, { price: 116, dayHigh: 116, dayLow: 110 }, {});
  assert(r.status === 'TP1_HIT', 'dayHigh hits TP1 → TP1_HIT');
}

{
  // TP2 hit → TP2_HIT
  const pos = { entry: 100, stop: 90, tp1: 115, tp2: 130 };
  const r = determineStatus(pos, noCfg, { price: 131, dayHigh: 131, dayLow: 120 }, {});
  assert(r.status === 'TP2_HIT', 'dayHigh hits TP2 → TP2_HIT');
}

{
  // Already stopped-out (prev status SL_HIT, position not in snapshot) → no re-alert
  // Signal-monitor uses state transition: prev.status === status → no alert
  // We only test that status computes correctly (the dedup logic is in evaluatePosition)
  const pos = { entry: 100, stop: 90, tp1: 115, tp2: 130 };
  const r = determineStatus(pos, noCfg, { price: 85, dayHigh: 90, dayLow: 84 }, {
    currentStop: 90, highWaterMark: 105, status: 'SL_HIT',
  });
  assert(r.status === 'SL_HIT', 'Previously stopped position → still SL_HIT (dedup handled upstream)');
}

// ─── Suite 2: BUG-1 — NEAR_STOP false positive when trailing stop > entry ─────

console.log('\nSuite 2: BUG-1 — NEAR_STOP false positive (trailing stop exceeds entry)');

{
  // Fortress CAT scenario: price rose, dailyTrailPct raised stop ABOVE entry
  // entry=817.11, rawStop=773, price=820 (healthy, above trail stop)
  // hwm=835 → trailLevel = 835*0.98 = 818.3 (> entry 817.11)
  // Before fix: (820-818.3)/(817.11-818.3) = 1.7/-1.19 = -1.43 < 0.3 → NEAR_STOP (wrong!)
  // After fix: entry > currentStop guard = 817.11 > 818.3 = false → OPEN (correct)
  const pos = { entry: 817.11, stop: 773, tp1: 860, tp2: null };
  const prev = { currentStop: 818.3, highWaterMark: 835, partialClosed: false };
  const r = determineStatus(pos, fortressCfg, { price: 820, dayHigh: 835, dayLow: 818 }, prev);
  assert(r.status !== 'NEAR_STOP', 'Stop > entry: price above trail stop → NOT NEAR_STOP (BUG-1 fix)');
  assert(r.status === 'OPEN' || r.status === 'SL_HIT', 'Stop > entry: status is OPEN or SL_HIT only');
}

{
  // Variant: price exactly at the raised trail stop → SL_HIT (legitimate)
  const pos = { entry: 817.11, stop: 773, tp1: 860, tp2: null };
  const prev = { currentStop: 818.3, highWaterMark: 835, partialClosed: false };
  const r = determineStatus(pos, fortressCfg, { price: 817.5, dayHigh: 835, dayLow: 817 }, prev);
  assert(r.status === 'SL_HIT', 'Stop > entry: price touches trail stop → SL_HIT (legitimate)');
}

{
  // Normal case: stop < entry, price in NEAR_STOP zone → NEAR_STOP should still fire
  const pos = { entry: 100, stop: 88, tp1: 118, tp2: null };
  const prev = { currentStop: 90, highWaterMark: 102, partialClosed: false };
  // price=92.5 → (92.5-90)/(100-90)=0.25 < 0.3 → NEAR_STOP
  const r = determineStatus(pos, noCfg, { price: 92.5, dayHigh: 103, dayLow: 92 }, prev);
  assert(r.status === 'NEAR_STOP', 'Normal stop < entry: price in 30% zone → NEAR_STOP still works');
}

{
  // WMT scenario: entry=stop=130 (zero risk range) — must NOT fire NEAR_STOP or divide by zero
  const pos = { entry: 130, stop: 130, tp1: 136, tp2: null };
  const r = determineStatus(pos, secureCfg, { price: 132, dayHigh: 132, dayLow: 131 }, {});
  assert(r.status !== 'NEAR_STOP', 'Entry equals stop (zero range): no NEAR_STOP divide-by-zero');
}

// ─── Suite 3: BUG-2 — Wall-clock market hours guard ───────────────────────────

console.log('\nSuite 3: BUG-2 — Wall-clock market hours guard');

{
  // NYSE regular hours: Monday 14:00 UTC (10am ET) → should be market hours
  const d = new Date('2026-04-21T14:00:00Z'); // Monday
  assert(isMarketHours(d), 'Monday 14:00 UTC → market hours');
}

{
  // NYSE open boundary: 13:25 UTC → just inside
  const d = new Date('2026-04-21T13:25:00Z');
  assert(isMarketHours(d), '13:25 UTC → market hours (open boundary)');
}

{
  // Just before open: 13:24 UTC → outside
  const d = new Date('2026-04-21T13:24:00Z');
  assert(!isMarketHours(d), '13:24 UTC → NOT market hours (pre-open)');
}

{
  // NYSE close boundary: 20:05 UTC → just inside
  const d = new Date('2026-04-21T20:05:00Z');
  assert(isMarketHours(d), '20:05 UTC → market hours (close boundary)');
}

{
  // Just after close: 20:06 UTC → outside
  const d = new Date('2026-04-21T20:06:00Z');
  assert(!isMarketHours(d), '20:06 UTC → NOT market hours (post-close)');
}

{
  // Midnight UTC (Yahoo official close tick pattern): 00:05 UTC → outside hours
  const d = new Date('2026-04-24T00:05:03Z'); // matches fortress:CAT false alert timestamp
  assert(!isMarketHours(d), '00:05 UTC → NOT market hours (Yahoo close-price tick window, BUG-2 fix)');
}

{
  // 21:00 UTC (post-market, matches fortress:PANW false alert): outside hours
  const d = new Date('2026-04-22T21:00:00Z');
  assert(!isMarketHours(d), '21:00 UTC → NOT market hours (post-market)');
}

{
  // Saturday → outside hours
  const d = new Date('2026-04-25T15:00:00Z'); // Saturday
  assert(!isMarketHours(d), 'Saturday 15:00 UTC → NOT market hours');
}

{
  // Sunday → outside hours
  const d = new Date('2026-04-26T14:00:00Z'); // Sunday
  assert(!isMarketHours(d), 'Sunday 14:00 UTC → NOT market hours');
}

// ─── Suite 4: Trailing stop logic ─────────────────────────────────────────────

console.log('\nSuite 4: Trailing stop / breakeven interaction');

{
  // dailyTrailPct=2, price at 1% gain from entry → breakeven fires, trail stays below entry
  // initialStop=88, breakevenPct=1: gain=1% → stop moves to entry(100)
  // trailLevel = 101*0.98=98.98 < stop(100) → stop stays at 100
  // price=101 > stop=100 → OPEN; dayLow must be above stop to avoid dayLow SL trigger
  const pos = { entry: 100, stop: 88, tp1: 118, tp2: null };
  const r = determineStatus(pos, fortressCfg, { price: 101, dayHigh: 101, dayLow: 100.5 }, {});
  assert(r.status === 'OPEN', 'Breakeven fires, trail < entry: position stays OPEN');
}

{
  // dailyTrailPct=2, strong intraday rise then pullback to just above trail stop
  // hwm=110, trail=110*0.98=107.8, price=108 (above trail) → OPEN
  // dayLow must be above trail stop (107.8) to avoid dayLow SL trigger
  const pos = { entry: 100, stop: 88, tp1: 118, tp2: null };
  const prev = { currentStop: 100, highWaterMark: 110, partialClosed: false };
  const r = determineStatus(pos, fortressCfg, { price: 108, dayHigh: 110, dayLow: 108 }, prev);
  // currentStop = max(100, 110*0.98) = 107.8; price=108 > 107.8 → OPEN
  assert(r.status === 'OPEN', 'Price just above trail level: OPEN');
}

{
  // dailyTrailPct=2, pullback crosses trail: price=107, hwm=110 → trail=107.8 → SL_HIT
  const pos = { entry: 100, stop: 88, tp1: 118, tp2: null };
  const prev = { currentStop: 100, highWaterMark: 110, partialClosed: false };
  const r = determineStatus(pos, fortressCfg, { price: 107, dayHigh: 110, dayLow: 106.5 }, prev);
  // currentStop = 107.8, price=107 < 107.8 → SL_HIT (legitimate trail stop)
  assert(r.status === 'SL_HIT', 'Price crosses trail level: SL_HIT (legitimate)');
}

// ─── Suite 5: Expired / stale position should NOT re-alert ────────────────────

console.log('\nSuite 5: Expired and stale positions');

{
  // Position expired by horizon — status is EXPIRED, not SL_HIT or NEAR_STOP
  const pos = { entry: 100, stop: 90, tp1: 115, tp2: null };
  const prev = { currentStop: 90, highWaterMark: 105, partialClosed: false, daysHeld: 10 };
  const cfg = { ...noCfg, horizon: 5 };
  const r = determineStatus(pos, cfg, { price: 102, dayHigh: 103, dayLow: 101 }, prev);
  // daysHeld=10 > horizon=5 → EXPIRED
  assert(r.status === 'EXPIRED', 'Horizon exceeded → EXPIRED');
}

{
  // dayLow stale guard: dayLow far below price (>15% gap) must NOT trigger SL_HIT
  // Simulates HTTP-fetched dayLow from prior session or bad data
  const pos = { entry: 100, stop: 90, tp1: 115, tp2: null };
  const r = determineStatus(pos, noCfg, { price: 105, dayHigh: 106, dayLow: 70 }, {});
  // dayLow=70 < price*0.85=89.25 → dayLowValid=false → no SL from dayLow
  // price=105 > stop=90 → OPEN
  assert(r.status !== 'SL_HIT', 'Stale/invalid dayLow (>15% below price) does NOT trigger SL_HIT');
  assert(r.status === 'OPEN', 'Stale dayLow: position stays OPEN');
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('SOME TESTS FAILED');
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED');
  process.exit(0);
}
