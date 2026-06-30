---
name: orbit-mode
description: "Orbit mode (internal ID=secured) — H20/3.5×ATR swing strategy replacing Secured. Deploying paper-ramp from 2026-06-03, review 2026-07-03."
metadata: 
  node_type: memory
  type: project
  originSessionId: 7a9ed487-24ed-4b64-9363-f17cfdaa97cf
---

## Orbit Mode

Replaces Secured mode. Internal ID remains `secured` in code/config/API. Label "Orbit" everywhere user-facing.

**Key params**: horizon 20d, ATR stop 3.5×, no BE lock, no stale tightening, partial TP 30% at TP1, 2 slots (50% each), minScore 88, mom_bo filter.

**URL**: `#orbit` in hash (JS alias in gen-status-page.js maps to `secured` internally). `#secured` also still works for backward compat.

**Grid search results** (768 combos, 20 tickers, 4 weeks):
- Best: 11 slots / 20d / 3.5×ATR → +171%, WR 91%, PF 35 (but overfitted)
- Deployed config: 2 slots / 20d / 3.5×ATR → conservative, matches existing slot structure

**Real scanner signal backtest** (32 scans, 60 trades, top-2 per scan):
- 5d/1.5×ATR (current): $10K→$32K (+220%), WR 60%, PF 3.97, DD -17.4%
- 15d/3×ATR: $10K→$207K (+1966%), WR 72%, PF 8.72, DD -11.3%  
- 20d/3.5×ATR (deployed): $10K→$302K (+2921%), WR 72%, PF 10.44, DD -6.3%

**Files changed**: modes-config.json, gen-mode-cards.js (🪐 Orbit), gen-status-page.js (How to trade, URL alias, English status labels), notify-scanner-status.js (6 label maps), modes-status-history.json (pausing→deploying logged).

**Trade history**: Reset to zero on 2026-06-02. Clean slate.

**Why:** Analysis showed scanner picks winners but H5 cuts trades too early. DELL made +87% over 16d, turbo captured +3.4%. ARM +99% in 20d, turbo got +4.4%. The same signals, just more time.

**How to apply:** First Orbit trades start with scan 2026-06-03. Paper-ramp mode = entries accepted but not real capital. Review at 2026-07-03: if WR>60% and PF>3, flip to live via `node tools/set-mode-status.js --mode secured --to live`.
