---
name: squeeze-radar
description: Deterministic US pre-squeeze watch workflow with short, SEC, event and price evidence.
user_invocable: true
---

# Squeeze Radar

`.claude/commands/squeeze-radar.md` is the operational authority. This is a watch radar, not a promise that
high short interest will squeeze.

## Rules

- The universe is US-listed stocks discovered by the configured screener; no local ticker list or foreign
  fallback.
- Every retained symbol needs explicit short-interest, CTB/FTD, exact-close bars, SEC/flags and earnings
  coverage from the same run.
- Read primary filings for shelf, ATM, convertible, warrant, PIPE or other equity-capacity hits. Debt-only
  capacity is not automatically dilution; unknown classification is a reject.
- Short and borrow data must expose their measurement date. Stale or partial coverage is not “zero.”
- Options/dark-pool data is detached context. It may increase caution but cannot rescue missing governing
  evidence or prove a catalyst.
- Derive entry, stop, target and R/R from structured bars under the same level gates as public trade ideas.
  Gap/chase behavior and invalidation must be explicit.
- Rank deterministically with a ticker tie-breaker and accept zero survivors.

Review prior candidates at their published horizon with fill/no-fill separated. Do not count multiple modes
or repeated publication of the same ticker as independent market events.
