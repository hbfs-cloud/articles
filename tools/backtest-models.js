#!/usr/bin/env node
/**
 * backtest-models.js — Test 4 factor models against historical trades
 *
 * Tests: momentum-model, risk-model, regime-model, antipatterns
 * Then combines best elements into a UNIFIED model.
 */

const trades = require('../data/enriched-trades.json');
const resolved = trades.filter(t => t.status !== 'pending' && t.status !== 'open');

// Enrich with computed fields
resolved.forEach(t => {
  t.stopDistPct = Math.abs((t.actualStop - t.actualEntry) / t.actualEntry * 100);
  // Regime: default to 'unknown' if missing
  if (!t.regime) t.regime = 'unknown';
});

// ===== METRICS FUNCTIONS =====

function computeMetrics(tradeSet, label) {
  if (tradeSet.length === 0) return { label, n: 0, wr: 0, lr: 0, avgPnl: 0, totalPnl: 0, pf: 0, bigLosses: 0 };
  const pos = tradeSet.filter(t => t.pnlPct > 0);
  const neg = tradeSet.filter(t => t.pnlPct < 0);
  const flat = tradeSet.filter(t => t.pnlPct === 0);
  const grossProfit = pos.reduce((s, t) => s + t.pnlPct, 0);
  const grossLoss = Math.abs(neg.reduce((s, t) => s + t.pnlPct, 0));
  const bigLosses = tradeSet.filter(t => t.pnlPct <= -3).length;
  return {
    label,
    n: tradeSet.length,
    wr: (pos.length / tradeSet.length * 100),
    lr: (neg.length / tradeSet.length * 100),
    avgPnl: tradeSet.reduce((s, t) => s + t.pnlPct, 0) / tradeSet.length,
    totalPnl: tradeSet.reduce((s, t) => s + t.pnlPct, 0),
    pf: grossLoss > 0 ? grossProfit / grossLoss : Infinity,
    bigLosses,
    winnersCount: pos.length,
    losersCount: neg.length,
    flatCount: flat.length,
    grossProfit,
    grossLoss
  };
}

function formatMetrics(m) {
  return `  Trades: ${m.n} | WR: ${m.wr.toFixed(1)}% | LR: ${m.lr.toFixed(1)}% | Avg PnL: ${m.avgPnl.toFixed(2)}% | Total: ${m.totalPnl.toFixed(1)}% | PF: ${m.pf.toFixed(2)} | BigLosses: ${m.bigLosses}`;
}

// ===== BASELINE =====
const baseline = computeMetrics(resolved, 'BASELINE');

// ===== MODEL 1: MOMENTUM MODEL =====
function momentumModelFilter(t) {
  // Only applies to momentum trades — pass all breakout through
  if (t.strategy !== 'momentum') return { pass: true, reason: null };

  // F1: RSI floor >= 50
  if (t.rsi14 !== undefined && t.rsi14 < 50) return { pass: false, reason: 'F1:RSI<50' };

  // F2: ATR floor >= 2.0
  if (t.atrPct !== undefined && t.atrPct < 2.0) return { pass: false, reason: 'F2:ATR<2%' };

  // F3: ATR ceiling — reject 8-10% zone (but allow <8 and >=12, skip 10-12 too per model)
  if (t.atrPct !== undefined && t.atrPct >= 8.0 && t.atrPct < 10.0) return { pass: false, reason: 'F3:ATR_8-10%' };

  // F4: Score floor >= 88
  if (t.score < 88) return { pass: false, reason: 'F4:Score<88' };

  // F5: Regime gate — reject EARLY_RISK_OFF for momentum
  if (t.regime === 'EARLY RISK-OFF') return { pass: false, reason: 'F5:ERO_Momentum' };

  // F6: Friday penalty — reject Friday if score < 92
  if (t.dayOfWeek === 'Fri' && t.score < 92) return { pass: false, reason: 'F6:Friday_LowScore' };

  // F7: Dist50DMA floor >= 5%
  if (t.dist50dmaPct !== undefined && t.dist50dmaPct < 5) return { pass: false, reason: 'F7:Dist50<5%' };

  return { pass: true, reason: null };
}

// ===== MODEL 2: RISK MODEL =====
function riskModelFilter(t) {
  // Filter 1: Regime Gate
  if (t.regime === 'EARLY RISK-OFF' && t.strategy === 'momentum') return { pass: false, reason: 'R1:ERO_Momentum' };
  if (t.regime === 'EARLY RISK-OFF' && t.strategy === 'breakout' && t.score < 90) return { pass: false, reason: 'R1:ERO_BO_Score<90' };
  if (t.regime === 'RECOVERY' && t.strategy === 'momentum' && t.score < 90) return { pass: false, reason: 'R1:REC_Mom_Score<90' };

  // Filter 2: Score Floor by Strategy
  if (t.strategy === 'momentum' && t.score < 90) return { pass: false, reason: 'R2:Mom_Score<90' };
  if (t.strategy === 'breakout' && t.score < 88) return { pass: false, reason: 'R2:BO_Score<88' };

  // Filter 3: Stop Distance Dead Zone (4-5%)
  if (t.stopDistPct >= 4.0 && t.stopDistPct < 5.0) return { pass: false, reason: 'R3:Stop_4-5%' };

  // Filter 4: 1-Day Hold Prevention (hold=1 => likely instant SL)
  if (t.holdDays === 1) return { pass: false, reason: 'R4:Hold_1Day' };
  // Corollary: stop < 0.5 * ATR
  if (t.atrPct && t.stopDistPct < 0.5 * t.atrPct) return { pass: false, reason: 'R4:Stop<0.5ATR' };

  // Filter 5: Friday penalty (non-RISK-ON only, reduce = reject for hard filter)
  if (t.dayOfWeek === 'Fri' && t.regime !== 'RISK-ON' && t.score < 92) return { pass: false, reason: 'R5:Friday_NonRO' };

  // Filter 6: ATR Dead Zone
  if (t.atrPct !== undefined && t.atrPct < 2.0) return { pass: false, reason: 'R6:ATR<2%' };
  if (t.atrPct !== undefined && t.atrPct >= 8.0 && t.atrPct < 10.0) return { pass: false, reason: 'R6:ATR_8-10%' };

  return { pass: true, reason: null };
}

// ===== MODEL 3: REGIME MODEL =====
function regimeModelFilter(t) {
  // RISK-ON: allow both, but raise momentum floor to 88
  if (t.regime === 'RISK-ON') {
    if (t.strategy === 'momentum' && t.score < 88) return { pass: false, reason: 'REG:RO_Mom<88' };
    return { pass: true, reason: null };
  }

  // RECOVERY: mom_bo, breakout slightly favored
  if (t.regime === 'RECOVERY') {
    // Breakout score bonus +1 effectively means breakout passes at 84+
    if (t.strategy === 'breakout' && t.score < 85) return { pass: false, reason: 'REG:REC_BO<85' };
    if (t.strategy === 'momentum' && t.score < 88) return { pass: false, reason: 'REG:REC_Mom<88' };
    return { pass: true, reason: null };
  }

  // EARLY RISK-OFF: breakout_only, minScore 90
  if (t.regime === 'EARLY RISK-OFF') {
    if (t.strategy === 'momentum') return { pass: false, reason: 'REG:ERO_Momentum' };
    if (t.score < 90) return { pass: false, reason: 'REG:ERO_Score<90' };
    return { pass: true, reason: null };
  }

  // RISK-OFF: breakout only, defensive sectors, minScore 90
  if (t.regime === 'RISK-OFF') {
    if (t.strategy === 'momentum') return { pass: false, reason: 'REG:RO_Momentum' };
    if (t.score < 90) return { pass: false, reason: 'REG:ROFF_Score<90' };
    return { pass: true, reason: null };
  }

  // Unknown regime: treat as NEUTRAL - moderate restrictions
  if (t.regime === 'unknown') {
    if (t.strategy === 'momentum' && t.score < 90) return { pass: false, reason: 'REG:UNK_Mom<90' };
    return { pass: true, reason: null };
  }

  return { pass: true, reason: null };
}

// ===== MODEL 4: ANTIPATTERNS =====
function antipatternFilter(t) {
  // AP-1: TKL Day-1 Stop-Loss
  if (t.mode === 'tkl' && t.holdDays === 1) return { pass: false, reason: 'AP1:TKL_Day1' };

  // AP-2: EARLY RISK-OFF + Score < 90
  if (t.regime === 'EARLY RISK-OFF' && t.score < 90) return { pass: false, reason: 'AP2:ERO_Score<90' };

  // AP-3: RSI 40-50
  if (t.rsi14 !== undefined && t.rsi14 >= 40 && t.rsi14 < 50) return { pass: false, reason: 'AP3:RSI_40-50' };

  // AP-4: ATR 8-10%
  if (t.atrPct !== undefined && t.atrPct >= 8.0 && t.atrPct < 10.0) return { pass: false, reason: 'AP4:ATR_8-10%' };

  // AP-5: Score >= 93 + RSI < 55
  if (t.score >= 93 && t.rsi14 !== undefined && t.rsi14 < 55) return { pass: false, reason: 'AP5:HighScore_LowRSI' };

  // AP-6: Gap 0.5-1% + ATR > 6%
  if (t.gapPct !== undefined && t.gapPct >= 0.5 && t.gapPct < 1.0 && t.atrPct > 6.0) return { pass: false, reason: 'AP6:GapTrap' };

  // AP-7: Entry Above VWAP (>0.5%)
  if (t.entryVsVwap !== undefined && t.entryVsVwap > 0.5) return { pass: false, reason: 'AP7:AboveVWAP' };

  // AP-8: ATR < 2% + Dist50 < 5%
  if (t.atrPct !== undefined && t.atrPct < 2.0 && t.dist50dmaPct !== undefined && Math.abs(t.dist50dmaPct) < 5.0) return { pass: false, reason: 'AP8:DeadMoney' };

  // AP-9: Score <= 87
  if (t.score <= 87) return { pass: false, reason: 'AP9:Score<=87' };

  return { pass: true, reason: null };
}

// ===== RUN BACKTEST FOR EACH MODEL =====

function runBacktest(filterFn, modelName) {
  const kept = [];
  const rejected = [];
  const rejectionReasons = {};

  resolved.forEach(t => {
    const result = filterFn(t);
    if (result.pass) {
      kept.push(t);
    } else {
      rejected.push({ ...t, rejectionReason: result.reason });
      rejectionReasons[result.reason] = (rejectionReasons[result.reason] || 0) + 1;
    }
  });

  const keptMetrics = computeMetrics(kept, modelName + ' (kept)');
  const rejectedMetrics = computeMetrics(rejected, modelName + ' (rejected)');

  // Analyze what was rejected
  const winnersRejected = rejected.filter(t => t.pnlPct > 0);
  const losersRejected = rejected.filter(t => t.pnlPct < 0);
  const flatRejected = rejected.filter(t => t.pnlPct === 0);
  const bigLosersRejected = rejected.filter(t => t.pnlPct <= -3);
  const bigWinnersRejected = rejected.filter(t => t.pnlPct >= 5);

  // Alpha lost = sum of positive PnL from rejected trades
  const alphaLost = winnersRejected.reduce((s, t) => s + t.pnlPct, 0);
  // Losses saved = sum of negative PnL from rejected trades (absolute)
  const lossesSaved = Math.abs(losersRejected.reduce((s, t) => s + t.pnlPct, 0));

  return {
    modelName,
    kept: keptMetrics,
    rejected: rejectedMetrics,
    winnersLost: winnersRejected.length,
    losersRejected: losersRejected.length,
    flatRejected: flatRejected.length,
    bigLosersRejected: bigLosersRejected.length,
    bigWinnersRejected: bigWinnersRejected.length,
    alphaLost,
    lossesSaved,
    netBenefit: lossesSaved - alphaLost,
    rejectionReasons,
    rejectedTrades: rejected
  };
}

// ===== UNIFIED MODEL =====
function unifiedModelFilter(t) {
  // HARD GATES (highest precision filters from all models)

  // 1. Score <= 87 (from antipatterns AP-9, confirmed by all models)
  if (t.score <= 87) return { pass: false, reason: 'U:Score<=87' };

  // 2. EARLY RISK-OFF + Momentum (from all 4 models unanimously)
  if (t.regime === 'EARLY RISK-OFF' && t.strategy === 'momentum') return { pass: false, reason: 'U:ERO_Momentum' };

  // 3. EARLY RISK-OFF + Score < 90 for breakout (from risk-model + regime-model)
  if (t.regime === 'EARLY RISK-OFF' && t.score < 90) return { pass: false, reason: 'U:ERO_Score<90' };

  // 4. RSI 40-50 (from momentum-model F1, antipatterns AP-3)
  if (t.rsi14 !== undefined && t.rsi14 >= 40 && t.rsi14 < 50) return { pass: false, reason: 'U:RSI_40-50' };

  // 5. ATR < 2% (from momentum-model F2, risk-model R6)
  if (t.atrPct !== undefined && t.atrPct < 2.0) return { pass: false, reason: 'U:ATR<2%' };

  // 6. ATR 8-10% valley (from momentum-model F3, risk-model R6, antipatterns AP-4)
  if (t.atrPct !== undefined && t.atrPct >= 8.0 && t.atrPct < 10.0) return { pass: false, reason: 'U:ATR_8-10%' };

  // 7. Score >= 93 + RSI < 55 (from antipatterns AP-5 — deadly combo)
  if (t.score >= 93 && t.rsi14 !== undefined && t.rsi14 < 55) return { pass: false, reason: 'U:HighScore_LowRSI' };

  // 8. TKL Day-1 (from antipatterns AP-1 — 100% loss rate)
  if (t.mode === 'tkl' && t.holdDays === 1) return { pass: false, reason: 'U:TKL_Day1' };

  // 9. Entry above VWAP > 0.5% (from antipatterns AP-7)
  if (t.entryVsVwap !== undefined && t.entryVsVwap > 0.5) return { pass: false, reason: 'U:AboveVWAP' };

  // 10. Momentum in RECOVERY with score < 90 (from risk-model R1)
  if (t.regime === 'RECOVERY' && t.strategy === 'momentum' && t.score < 90) return { pass: false, reason: 'U:REC_Mom<90' };

  // 11. Momentum in unknown regime with score < 90 (from regime-model)
  if (t.regime === 'unknown' && t.strategy === 'momentum' && t.score < 90) return { pass: false, reason: 'U:UNK_Mom<90' };

  // Note: NOT including these filters due to poor precision:
  // - Stop 4-5% dead zone (risk-model R3): needs validation, hard to apply at entry time
  // - Hold 1 day filter (risk-model R4): retrospective, can't filter at entry
  // - Friday penalty (aggressive versions): moderate alpha loss
  // - Dist50 < 5% for momentum (momentum-model F7): rejects too many winners
  // - Gap 0.5-1% + ATR>6% (AP-6): tiny sample, unreliable

  return { pass: true, reason: null };
}

// ===== COMPOSITE SCORE (from unified model) =====
function computeCompositeScore(t) {
  let score = t.score; // base: 85-95

  // Score premium/penalty (from risk-model)
  if (t.score >= 92) score += 3;
  if (t.score === 88) score -= 3;

  // RSI adjustments
  if (t.rsi14 !== undefined) {
    if (t.rsi14 > 80) score += 2;         // Momentum confirmation
    if (t.rsi14 >= 40 && t.rsi14 < 50) score -= 3;  // No man's land
    if (t.rsi14 >= 60 && t.rsi14 < 70) score -= 1;  // Indecision zone
  }

  // ATR adjustments
  if (t.atrPct !== undefined) {
    if (t.atrPct >= 4.0 && t.atrPct < 6.0) score += 2;   // Sweet spot
    if (t.atrPct < 2.0) score -= 3;                        // Dead money
    if (t.atrPct >= 8.0 && t.atrPct < 10.0) score -= 3;  // Valley of death
  }

  // Stop distance
  if (t.stopDistPct >= 5.0 && t.stopDistPct < 7.0) score += 2;  // Best zone
  if (t.stopDistPct >= 4.0 && t.stopDistPct < 5.0) score -= 5;  // Death trap

  // Regime
  if (t.regime === 'RISK-ON') score += 3;
  if (t.regime === 'RECOVERY') score -= 1;
  if (t.regime === 'EARLY RISK-OFF') score -= 5;

  // Gap
  if (t.gapPct !== undefined) {
    if (t.gapPct >= -2.0 && t.gapPct < -1.0) score += 2;  // Dip-buy sweet spot
    if (t.gapPct > 2.0) score += 1;                         // Strong continuation
  }

  // Day of week
  if (t.dayOfWeek === 'Tue' || t.dayOfWeek === 'Thu') score += 1;
  if (t.dayOfWeek === 'Wed' || t.dayOfWeek === 'Fri') score -= 1;

  // Dist from 50DMA
  if (t.dist50dmaPct !== undefined && t.dist50dmaPct > 20) score += 1;

  // Breakout strategy bonus
  if (t.strategy === 'breakout') score += 1;

  // Entry vs VWAP
  if (t.entryVsVwap !== undefined && t.entryVsVwap > 0.5) score -= 2;
  if (t.entryVsVwap !== undefined && t.entryVsVwap < -1.0) score += 1;

  return score;
}

// ===== UNIFIED MODEL V2 (with composite score threshold) =====
function unifiedModelV2Filter(t) {
  // Apply hard gates first
  const hardGateResult = unifiedModelFilter(t);
  if (!hardGateResult.pass) return hardGateResult;

  // Then apply composite score threshold
  const composite = computeCompositeScore(t);
  if (composite < 88) return { pass: false, reason: 'U2:Composite<88' };

  return { pass: true, reason: null };
}

// ===== EXECUTE ALL BACKTESTS =====

console.log('=' .repeat(100));
console.log('BACKTEST RESULTS — 4 Factor Models + Unified');
console.log('=' .repeat(100));

console.log('\n--- BASELINE ---');
console.log(formatMetrics(baseline));
console.log(`  Winners: ${baseline.winnersCount} | Losers: ${baseline.losersCount} | Flat: ${baseline.flatCount}`);

const models = [
  { name: 'MOMENTUM-MODEL', fn: momentumModelFilter },
  { name: 'RISK-MODEL', fn: riskModelFilter },
  { name: 'REGIME-MODEL', fn: regimeModelFilter },
  { name: 'ANTIPATTERNS', fn: antipatternFilter },
  { name: 'UNIFIED-V1', fn: unifiedModelFilter },
  { name: 'UNIFIED-V2 (composite)', fn: unifiedModelV2Filter },
];

const results = [];

models.forEach(model => {
  const r = runBacktest(model.fn, model.name);
  results.push(r);

  console.log(`\n${'='.repeat(80)}`);
  console.log(`MODEL: ${model.name}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`KEPT: ${formatMetrics(r.kept)}`);
  console.log(`REJECTED: ${formatMetrics(r.rejected)}`);
  console.log(`\n  Impact Analysis:`);
  console.log(`    Trades rejected: ${r.rejected.n} (${(r.rejected.n / baseline.n * 100).toFixed(1)}%)`);
  console.log(`    Winners lost: ${r.winnersLost} (alpha lost: ${r.alphaLost.toFixed(1)}%)`);
  console.log(`    Losers saved: ${r.losersRejected} (losses saved: ${r.lossesSaved.toFixed(1)}%)`);
  console.log(`    Big losers caught: ${r.bigLosersRejected} / ${baseline.bigLosses}`);
  console.log(`    Big winners lost: ${r.bigWinnersRejected}`);
  console.log(`    Net benefit: ${r.netBenefit > 0 ? '+' : ''}${r.netBenefit.toFixed(1)}% PnL saved vs lost`);
  console.log(`    Flat/BE rejected: ${r.flatRejected}`);

  console.log(`\n  Delta vs Baseline:`);
  console.log(`    WR: ${baseline.wr.toFixed(1)}% -> ${r.kept.wr.toFixed(1)}% (${(r.kept.wr - baseline.wr) >= 0 ? '+' : ''}${(r.kept.wr - baseline.wr).toFixed(1)}pp)`);
  console.log(`    LR: ${baseline.lr.toFixed(1)}% -> ${r.kept.lr.toFixed(1)}% (${(r.kept.lr - baseline.lr) >= 0 ? '+' : ''}${(r.kept.lr - baseline.lr).toFixed(1)}pp)`);
  console.log(`    PF: ${baseline.pf.toFixed(2)} -> ${r.kept.pf.toFixed(2)}`);
  console.log(`    Avg PnL: ${baseline.avgPnl.toFixed(2)}% -> ${r.kept.avgPnl.toFixed(2)}%`);
  console.log(`    Total PnL: ${baseline.totalPnl.toFixed(1)}% -> ${r.kept.totalPnl.toFixed(1)}% (${(r.kept.totalPnl - baseline.totalPnl) >= 0 ? '+' : ''}${(r.kept.totalPnl - baseline.totalPnl).toFixed(1)}%)`);

  console.log(`\n  Rejection Breakdown:`);
  Object.entries(r.rejectionReasons)
    .sort((a, b) => b[1] - a[1])
    .forEach(([reason, count]) => {
      const rejTrades = r.rejectedTrades.filter(t => t.rejectionReason === reason);
      const rejAvg = rejTrades.reduce((s, t) => s + t.pnlPct, 0) / rejTrades.length;
      const rejLosers = rejTrades.filter(t => t.pnlPct < 0).length;
      const rejWinners = rejTrades.filter(t => t.pnlPct > 0).length;
      console.log(`    ${reason}: ${count} trades (avg ${rejAvg.toFixed(2)}%, ${rejWinners}W/${rejLosers}L)`);
    });
});

// ===== FILTER PRECISION ANALYSIS =====
console.log('\n\n' + '='.repeat(100));
console.log('FILTER PRECISION ANALYSIS (higher = better at catching losers without losing winners)');
console.log('='.repeat(100));

const allFilters = {};
// Collect all unique filter reasons across all models
results.forEach(r => {
  Object.keys(r.rejectionReasons).forEach(reason => {
    if (!allFilters[reason]) allFilters[reason] = [];
    const rejected = r.rejectedTrades.filter(t => t.rejectionReason === reason);
    allFilters[reason] = rejected;
  });
});

console.log('\n  Filter | Rejected | Losers | Winners | Flat | Precision | Avg PnL | Total PnL Lost');
console.log('  ' + '-'.repeat(110));
Object.entries(allFilters)
  .sort((a, b) => {
    const precA = a[1].filter(t => t.pnlPct < 0).length / a[1].length;
    const precB = b[1].filter(t => t.pnlPct < 0).length / b[1].length;
    return precB - precA;
  })
  .forEach(([reason, trades]) => {
    const losers = trades.filter(t => t.pnlPct < 0).length;
    const winners = trades.filter(t => t.pnlPct > 0).length;
    const flat = trades.filter(t => t.pnlPct === 0).length;
    const precision = losers / trades.length;
    const avgPnl = trades.reduce((s, t) => s + t.pnlPct, 0) / trades.length;
    const totalPnl = trades.reduce((s, t) => s + t.pnlPct, 0);
    console.log(`  ${reason.padEnd(25)} | ${String(trades.length).padStart(8)} | ${String(losers).padStart(6)} | ${String(winners).padStart(7)} | ${String(flat).padStart(4)} | ${(precision * 100).toFixed(1).padStart(9)}% | ${avgPnl.toFixed(2).padStart(7)}% | ${totalPnl.toFixed(1).padStart(14)}%`);
  });

// ===== COMPOSITE SCORE ANALYSIS =====
console.log('\n\n' + '='.repeat(100));
console.log('COMPOSITE SCORE DISTRIBUTION');
console.log('='.repeat(100));

resolved.forEach(t => { t.compositeScore = computeCompositeScore(t); });

const scoreBuckets = {};
resolved.forEach(t => {
  const bucket = Math.floor(t.compositeScore / 5) * 5;
  const key = `${bucket}-${bucket + 4}`;
  if (!scoreBuckets[key]) scoreBuckets[key] = [];
  scoreBuckets[key].push(t);
});

console.log('\n  Bucket | Trades | WR | LR | Avg PnL | Total PnL | Big Losers');
console.log('  ' + '-'.repeat(80));
Object.entries(scoreBuckets)
  .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
  .forEach(([bucket, trades]) => {
    const m = computeMetrics(trades, bucket);
    console.log(`  ${bucket.padEnd(8)} | ${String(m.n).padStart(6)} | ${m.wr.toFixed(1).padStart(5)}% | ${m.lr.toFixed(1).padStart(5)}% | ${m.avgPnl.toFixed(2).padStart(7)}% | ${m.totalPnl.toFixed(1).padStart(9)}% | ${m.bigLosses}`);
  });

// ===== SUMMARY TABLE =====
console.log('\n\n' + '='.repeat(100));
console.log('SUMMARY COMPARISON');
console.log('='.repeat(100));
console.log('\n  Model               | Kept | Rej | WR     | LR     | PF    | AvgPnL | TotalPnL | LossSaved | AlphaLost | NetBenefit');
console.log('  ' + '-'.repeat(115));
console.log(`  BASELINE            | ${String(baseline.n).padStart(4)} |   0 | ${baseline.wr.toFixed(1).padStart(6)}% | ${baseline.lr.toFixed(1).padStart(6)}% | ${baseline.pf.toFixed(2).padStart(5)} | ${baseline.avgPnl.toFixed(2).padStart(6)}% | ${baseline.totalPnl.toFixed(1).padStart(8)}% |       N/A |       N/A |        N/A`);
results.forEach(r => {
  console.log(`  ${r.modelName.padEnd(20)} | ${String(r.kept.n).padStart(4)} | ${String(r.rejected.n).padStart(3)} | ${r.kept.wr.toFixed(1).padStart(6)}% | ${r.kept.lr.toFixed(1).padStart(6)}% | ${r.kept.pf.toFixed(2).padStart(5)} | ${r.kept.avgPnl.toFixed(2).padStart(6)}% | ${r.kept.totalPnl.toFixed(1).padStart(8)}% | ${r.lossesSaved.toFixed(1).padStart(9)}% | ${r.alphaLost.toFixed(1).padStart(9)}% | ${(r.netBenefit > 0 ? '+' : '') + r.netBenefit.toFixed(1).padStart(9)}%`);
});

// ===== OVERLAPPING REJECTIONS =====
console.log('\n\n' + '='.repeat(100));
console.log('OVERLAP ANALYSIS: How many trades are rejected by multiple models?');
console.log('='.repeat(100));

resolved.forEach(t => {
  t._rejectedBy = [];
  if (!momentumModelFilter(t).pass) t._rejectedBy.push('momentum');
  if (!riskModelFilter(t).pass) t._rejectedBy.push('risk');
  if (!regimeModelFilter(t).pass) t._rejectedBy.push('regime');
  if (!antipatternFilter(t).pass) t._rejectedBy.push('antipattern');
});

const overlapCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
resolved.forEach(t => { overlapCounts[t._rejectedBy.length]++; });
console.log('\n  Rejected by N models:');
Object.entries(overlapCounts).forEach(([n, count]) => {
  const subset = resolved.filter(t => t._rejectedBy.length === parseInt(n));
  const avgPnl = subset.length > 0 ? subset.reduce((s, t) => s + t.pnlPct, 0) / subset.length : 0;
  const losers = subset.filter(t => t.pnlPct < 0).length;
  console.log(`    ${n} models: ${count} trades (avg PnL: ${avgPnl.toFixed(2)}%, losers: ${losers})`);
});

// Trades rejected by ALL 4 models
const rejectedByAll = resolved.filter(t => t._rejectedBy.length === 4);
console.log(`\n  Trades rejected by ALL 4 models (${rejectedByAll.length}):`);
rejectedByAll.forEach(t => {
  console.log(`    ${t.ticker} | ${t.mode} | ${t.strategy} | score=${t.score} | regime=${t.regime} | pnl=${t.pnlPct.toFixed(2)}% | ${t.scanDate}`);
});

// Trades rejected by 3+ models
const rejectedBy3Plus = resolved.filter(t => t._rejectedBy.length >= 3);
console.log(`\n  Trades rejected by 3+ models (${rejectedBy3Plus.length}) - avg PnL: ${(rejectedBy3Plus.reduce((s,t)=>s+t.pnlPct,0)/rejectedBy3Plus.length).toFixed(2)}%:`);
const m3 = computeMetrics(rejectedBy3Plus, '3+ models rejected');
console.log(`    ${formatMetrics(m3)}`);

// ===== BEST BIG LOSERS CAUGHT =====
console.log('\n\n' + '='.repeat(100));
console.log('BIG LOSERS ANALYSIS (pnl <= -3%)');
console.log('='.repeat(100));

const bigLosers = resolved.filter(t => t.pnlPct <= -3);
console.log(`\n  Total big losers: ${bigLosers.length}, total damage: ${bigLosers.reduce((s,t)=>s+t.pnlPct,0).toFixed(1)}%`);
console.log(`\n  Ticker       | Mode     | Strategy | Score | Regime        | PnL     | Caught by`);
console.log('  ' + '-'.repeat(95));
bigLosers
  .sort((a, b) => a.pnlPct - b.pnlPct)
  .forEach(t => {
    const caughtBy = t._rejectedBy.length > 0 ? t._rejectedBy.join(', ') : 'NONE';
    console.log(`  ${t.ticker.padEnd(12)} | ${t.mode.padEnd(8)} | ${t.strategy.padEnd(8)} | ${String(t.score).padStart(5)} | ${t.regime.padEnd(13)} | ${t.pnlPct.toFixed(2).padStart(7)}% | ${caughtBy}`);
  });

const uncaughtBigLosers = bigLosers.filter(t => t._rejectedBy.length === 0);
console.log(`\n  Uncaught big losers: ${uncaughtBigLosers.length} / ${bigLosers.length}`);
uncaughtBigLosers.forEach(t => {
  console.log(`    ${t.ticker} | score=${t.score} | RSI=${t.rsi14?.toFixed(1)} | ATR=${t.atrPct?.toFixed(1)}% | gap=${t.gapPct?.toFixed(2)}% | dist50=${t.dist50dmaPct?.toFixed(1)}% | vwap=${t.entryVsVwap?.toFixed(2)}% | stop=${t.stopDistPct.toFixed(1)}% | mode=${t.mode} | regime=${t.regime}`);
});
