---
name: sector-rotation
description: Deterministic US sector-ETF relative-strength and rotation workflow.
user_invocable: true
---

# Sector Rotation

`.claude/commands/sector-rotation.md` is the operational authority. The configured plan collects exact
close histories for the standard US sector ETFs and benchmarks plus a correlation snapshot.

## Rules

- Rank only windows that can be calculated from the bounded bar artifact.
- Compare every sector against the same benchmark, dates and return convention.
- Missing closes or a shorter common window exclude that comparison.
- `performance_rotations` is detached context because its aggregation window is not guaranteed.
- Macro explanations are hypotheses unless supported by a dated primary source and the collected market
  reaction. Correlation is not causation.
- Do not infer individual stock leaders from an ETF rank. Use a separate verified scanner/analysis run.
- A prior recommendation is evaluated against what it actually stated, including horizon and benchmark;
  do not move either after the fact.

Emit the computed window, reference close, sector/benchmark returns, relative return, rank, correlation,
observed regime context, invalidation and evidence IDs. Use a stable ticker tie-breaker.
