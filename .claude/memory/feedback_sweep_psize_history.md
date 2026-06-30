---
name: feedback-sweep-psize-history
description: Never assume portfolioSize is constant — check modes-config-history.json before comparing concurrent positions across time
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 967bb452-a850-4068-88ab-3d85267b8c5f
---

portfolioSize changes over time (modes-config-history.json has versioned configs). Before flagging over-allocation or resetting trades, always resolve the configVersion of each trade to its historical pSize.

**Why:** Cleared all 6 modes' backtest-trades.json thinking they were all broken, when only TKL had a visible equity spike. The "violations" on turbo/dynamic/balanced/secured/fortress were partly real (FROZEN_ONLY merge bug) but the user didn't want a mass reset — prefer surgical fixes.

**How to apply:** When investigating backtest anomalies, (1) check modes-config-history.json for pSize changes, (2) verify visible impact on equity curve before resetting, (3) ask before clearing any mode's trades — never batch-reset without explicit consent.
