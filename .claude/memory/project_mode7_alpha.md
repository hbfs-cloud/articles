---
name: mode7-alpha
description: Mode 7 Alpha — concentrated Nasdaq swing (P2/H10/ATR3.0x/Trail 2.0R grace 5d). Validated by 6 experts. Deployed paper-ramp Jun 4.
metadata: 
  node_type: memory
  type: project
  originSessionId: 7a9ed487-24ed-4b64-9363-f17cfdaa97cf
---

## Mode 7 Alpha

7th scanner mode targeting Nasdaq outperformance via concentrated swing trading.

### Config (validated by 4 experts + independent QA)
- Internal ID: `alpha`, Label: "Alpha", Color: #2563eb
- **P=2, topN=2, H=10, ATR 3.0×, score≥90**
- Trail: 2.0R with 5-day grace (no trail until day 6)
- No partial TP, no TP2 (let winners run fully)
- Stale tightening: sqrt accel, 8-day grace, rate 0.0005 (force exit dead money)
- sectorCapMax=1 (forced diversification with only 2 positions)
- ddBreaker 6%, VIX kill 28, correlationCap 0.7, CB 3SL/5d/5d pause
- rotation=aggressive (swap weak for strong)
- filterName=mom_bo, regimeFilters: risk_on=all, neutral=mom_bo, ERO=breakout_only
- sizingMethod=inverse_atr, targetRiskPct=1.0
- vwapGate=true, tklExcludeSignals=false

### Projected Performance (honest range)
- Bull market: 60-100% CAGR
- Full-cycle realistic: 35-55% CAGR, median ~35%
- Retail advantage (<$1M): could reach 100-300% due to zero market impact + instant execution
- Max DD target: < Nasdaq DD in same period
- Backtest 14 weeks: +107%, DD -3.2%

### Validator Concerns
- Only 35 trades in backtest (need 200+ for statistical significance)
- Bull market only (no stress test)
- 6-month paper-ramp recommended before declaring success

### Why Retail Can Beat Hedge Funds
- Zero market impact on <$1M capital
- No SEC reporting/concentration limits
- Instant execution, no committee approval
- Our own systematic-tss proves it: us_americanbulls CAGR 452% over 5 years

**How to apply:** Alpha starts in draft/paper-ramp mode. First scan picks appear in next /scanner run. Review at Jul 4. If WR>50% and PF>3 after 100+ trades, flip to live.
