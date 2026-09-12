'use strict';

// This engine simulates levels. It does not replay a published VWAP, EMA,
// portfolio-capacity or order-activation gate. OHLCV continuity cannot certify
// those conditions, and a price touching a zone is not an authorized fill.
function requireLevelsDiagnostic(args) {
  if (!args.includes('--levels-only')) {
    throw new Error('Execution certification unavailable: this engine does not verify published activation gates (VWAP/EMA/capacity). Use --levels-only explicitly for hypothetical level diagnostics; never report them as authorized fills.');
  }
  return {
    execution_certified: false,
    performance_basis: 'hypothetical_published_levels_without_activation_confirmation',
    unverified_conditions: ['published_intraday_activation', 'portfolio_capacity', 'actual_order_fills'],
  };
}

module.exports = { requireLevelsDiagnostic };
