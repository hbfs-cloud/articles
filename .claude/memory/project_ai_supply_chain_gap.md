---
name: ai-supply-chain-gap
description: "Scanner misses entire AI supply chain (HBM, optics, power, networking). HPE +94%, DELL +111%, MU +80% in 1 month — none traded. Thematic watchlist needed."
metadata: 
  node_type: memory
  type: project
  originSessionId: 7a9ed487-24ed-4b64-9363-f17cfdaa97cf
---

## AI Supply Chain Blind Spot

The scanner DSL screener focuses on mega-caps with momentum/breakout signals. It systematically misses mid-cap AI infrastructure plays.

### What we missed (1-month perf as of Jun 2, 2026):
| Segment | Tickers | Perf | Scanned? |
|---------|---------|------|----------|
| AI Infra | DELL +111%, HPE +94%, SMCI +80% | 🔥 | DELL 1× only |
| HBM/Memory | MU +80%, SNDK +39%, WDC +27% | 🔥 | MU 2× (stoppé) |
| Optics | COHR +28%, AAOI +18% | 🔥 | Never |
| Power | FLEX +71%, POWL +8% | 🔥 | Never |
| Networking | CIEN +14% | ✅ | Never |

### Why the screener misses them:
1. Mid-caps (AAOI $3B, POWL $6B) don't rank high enough vs mega-cap momentum
2. No thematic/supply-chain concept in DSL
3. When MU was scanned (score 95), it was stoppé 3× at -5.5% due to tight stops

### Potential fix:
- Curated AI supply chain watchlist for thematic screening
- Force-scan these tickers even if DSL score < 85
- Orbit mode (H20/3.5×ATR) is designed to capture these moves

**How to apply:** Consider adding a thematic screener layer to the scanner pipeline (Phase 1). The [[orbit-mode]] was designed partly to address this gap — wider stops + longer horizon = fewer shakeouts on volatile mid-caps.
