---
name: config-change-backtest
description: MANDATORY 30-day backtest before any config change to turbo/balanced/dynamic/fortress
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ae4db5ff-a124-40d7-8586-81972e819812
---

Before modifying ANY trading parameter in modes-config.json for turbo, balanced, dynamic or fortress: run a 30-day backtest comparing current config vs proposed config.

**Why:** 41 config changes in 50 days degraded balanced from +60% to +47% and fortress from +23% to +18%. Each change looked reasonable in isolation but the cumulative effect was catastrophic. No change was validated by backtest before being applied.

**How to apply:**
1. Simulate BOTH configs (current + proposed) over the last 30 scan days using price cache data
2. Compare portfolio return, WR, avg win/loss, trade count
3. The proposed config must BEAT the current config on portfolio return to be applied
4. Show the comparison table to the user BEFORE applying
5. Never apply a config change without explicit user approval after seeing the backtest results
6. Related: [[immutable-trades]], [[regime-aware-eval]]
