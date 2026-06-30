---
name: feedback-candlestick-no-mcp
description: "candlestick-scanner.js must use local universe file, never MCP RunScreener for ticker listing"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1cc653cd-e658-47d7-96ef-f273b4affc3e
---

candlestick-scanner.js should use `data/americanbull-universe.json` (3511 tickers) directly — never call MCP RunScreener to build the universe.

**Why:** RunScreener is a DSL-based scored screener, not a flat listing tool. It returns 0 results for simple mcap/volume filters (no score_expr match), wasting 90s on a timeout before falling back to the local file anyway. The local bars get refreshed by Yahoo Finance `batchFetch()` in the script itself.

**How to apply:** When writing or reviewing code that needs a ticker universe, use static local files (`americanbull-universe.json`, `tickers-frozen.json`). Reserve MCP screener calls for scored/ranked selection (top-K candidates with DSL expressions).
