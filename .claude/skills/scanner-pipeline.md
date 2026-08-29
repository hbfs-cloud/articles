---
name: scanner-pipeline
description: Canonical deterministic US scanner pipeline: MCP collection, selection, DTX, QA, rendering and publication.
user_invocable: false
---

# Scanner Pipeline

This is the only active scanner architecture. Historical incident notes remain in git history and memory
files; they do not define alternate execution paths. Shared source/security rules are in
`.claude/skills/source-policy.md`; directory rules are in `scanner/CLAUDE.md`.

## Invariants

1. US-listed stocks and US-listed ETFs only. Never run or stage an EU/APAC fallback.
2. Target 8 stocks + 2 ETFs; minimum honest publication 6 stocks + 2 ETFs. Never force a failing name.
3. Marketdata and systematic are required. Missing auth, service failure, stale close, incomplete
   pagination or failed source is a hard stop.
4. `refdate` is the last completed US close. Folder/session `date` may be the next trading day. They are
   never inferred from one another inside a plan.
5. Selection, levels, risk gates and ordering consume structured outputs. An LLM cannot invent or repair
   a missing value.
6. No broker/account/order tools. DTX output is published as engine information, not executed here.
7. No push, card, Telegram or public mutation before all deterministic and review gates pass.

## NO-SKIP

`--skip-validation`, `--skip-downstream` and similar flags require explicit user approval in the current
session. Token expiry, latency, weekend, a thin universe or a failing reviewer are not reasons to skip.
A legitimate zero-candidate result is published only when the complete pipeline proves it.

## Collecte Scriptée

Preflight:

```bash
node tools/validate-workflows.js --workflow scanner
bash tools/scan-parallel.sh YYYYMMDD YYYY-MM-DD YYYY-MM-DD
```

Arguments are session folder, `refdate`, and DTX `asof`. Tokens are short-lived and scoped to the minimum
surface; values enter via a secure environment or masked prompt and never appear in commands or logs.

`scan-parallel.sh` runs four independent chains:

- **A:** `scanner-wave1` candidate universe, then `scanner-wave2` governing evidence.
- **B:** DTX health/config/Contract V2 decision and replay/cache for deployed `best`.
- **C:** tracking, quick sweep and analysis lifecycle.
- **D:** US sector rotation and beta pages.

A is publication-critical. B is required for a current DTX panel/status. C is required for current
performance and analysis status. D is required for the rotation/API outputs distributed by the same run;
its failure cannot alter editorial selection but blocks distribution rather than leaving stale pages.
The script validates freshness and run provenance immediately after each collection.

### Authentication

- Marketdata token: mint with `GetReadOnlyToken` from the authenticated MCP session.
- Systematic token: mint with `DtxMintReadOnlyToken(scope="refresh")`; this is the minimal scanner scope
  because it adds only the bounded `DtxRefreshBars` recovery path to the readonly compute surface.
- `DtxBookEquity` and `DtxStats` are outside that scoped-token surface. Do not broaden or fake the
  token: capture `DtxBookEquity` through the authenticated agent tool and validate it offline.
- Never echo, print, paste into argv, persist or commit either value.
- A retry of the same DTX request reuses `scanner/<date>/_dtx/request-id.txt`; this file is runtime staging
  and is never committed.

## Date and Freshness Contract

- Every `bars_daily` call uses `end_date=$refdate` and `freshness.expects_close=true`.
- Every systematic plan starts with `GetHealth(expected_close=$refdate)` and fails on `ok=false`,
  `freshness_ok=false` or `behind_expected=true`.
- Every async marketdata job is polled once and paginated to exhaustion by `mcp-client.js`.
- A harness carries resolved artifact, `reference_close`, plan SHA-256 and normalized input SHA-256.
- Run `check-freshness.js` without `--warn-only`; a collected-at timestamp does not prove the referenced
  close, so `data_through` must reach `refdate`.

## MCP DSL Syntax

- `RunScreener` custom filters use `region:"US"`, `asset:"stock"`, numeric literals and explicit
  liquidity/price floors. Custom-path default quality floors are not assumed.
- `pass_expr` is boolean. `score_expr` is numeric. Boolean helpers in a score require a ternary.
- Always inspect `warnings[]`, `detected_bars_ago`, `detected_at` and `estimated_valid_bars`.
- `RunAutoScreener` supplies regime context and a candidate source; it does not bypass the editorial
  quality, SEC, earnings or recent-performance gates.
- Screen output identifies candidates only. Scores from different producers/families are never compared
  until normalized under `tools/lib/score-contract.js`.

## Phase 0.8 - Immutable Lessons

Load versioned recent-performance overlays and verify their evidence hash. Only mature, horizon-complete
cohorts may cap a family. Lessons may down-weight, cap or reject a family under their declared policy;
they may not create a candidate, invert a raw signal or rewrite historical outcomes. Open questions are
reported, not promoted to facts. The retrieval layer excludes market-truth rules below 20 observations
and collapses prior outcomes to one US-listed underlying per scan across modes; weak or duplicated history
cannot steer the model.

## Candidate Evidence

Wave 2 is governing and required for every candidate batch:

- `sec_filings,flags` over 180 days;
- `quote,technicals,support_resistance,trading_signals`;
- 120 bounded daily bars with exact close proof;
- optional contextual flows in a detached wave.

The selection phase additionally applies:

- open-position and duplicate exclusions;
- minimum liquidity/price/market-cap rules from `data/scanner-filters.json`;
- 8-K Item 2.02 earnings evidence and event windows;
- SEC equity-capacity classification from primary filings;
- sector/factor concentration and current strategy overlay caps;
- US ETF allocation requirement.

Unknown SEC classification, missing earnings evidence, stale bars or a scale mismatch is a reject. Debt
prospectuses are not equity dilution. Web snippets never settle classification.

## Phase 3 - Levels and Selection

1. Build the eligible set from collected rows only.
2. Normalize scores within their producer/family and apply immutable overlay caps.
3. Rank deterministically; use ticker as the final stable tie-breaker.
4. Derive levels from structured ATR/support-resistance inputs.
5. Test TP1 reachability for the published horizon before R/R.
6. Recompute R/R from `entry_high`, the worst allowed fill.
7. Apply the always-on next-session VWAP/open gate encoded by the scanner schema.
8. Enforce diversification, duplicate and open-position exclusions again after final ranking.

The active R/R floors and horizon/target envelopes live in `data/scanner-filters.json`; prose must not
duplicate hard-coded values that can drift. `validate-scan.js` is the executable authority.

## DTX

- Read `DtxListConfigs`; deployed `best` must exist for the public best panel.
- Call `DtxDecide` with Contract V2 capabilities, exact `expected_data_date`, stable `request_id`, empty
  content-only positions/orders and explicit notional balances.
- Poll `DtxJobStatus`; never launch a replacement decision merely because a job is slow.
- Validate `request_id`, contract version, plan/revision, validity window, unique groups/candidates,
  rank order, protection and required execution fields with `tools/dtx-scan.js`.
- Consume `execution_plan.groups`, not duplicate `actions.CREATE` compatibility output.
- Use replay/book-equity provenance exactly as labeled. Do not call a replay curve a served book curve.
- Capture the exact `DtxBookEquity({portfolio:"best"})` result as
  `scanner/<date>/_dtx/book_equity_best.json`. `dtx-book-equity-ingest.js` must reproduce CAGR and
  MaxDD from that curve, bind it to `best` and the exact `refdate`, and persist a durable curve SHA-256
  before the status page is regenerated.
- Never merge a current `DtxStats` row into an older `DtxBookEquity` curve. They may be displayed as
  separately dated measurements, but only book-native fields are curve-linked.
- Outside `valid_from`/`valid_until`, publish zero actionable orders while retaining plan provenance.

## Phase 4 - Structured Output

Write `scanner/YYYYMMDD/signals.json` first. Required editorial fields include scan/session dates, regime,
input provenance, pipeline order, memory impact, risk gating, per-signal strategy/region/score, entry zone,
stop, targets, R/R, horizon, evidence and invalidation. Use the existing schema and renderer. Do not edit
rendered HTML values independently.

The renderer keeps the established Finviz chart source. A chart-source change is a product decision and
requires explicit user instruction.

## Phase 5.5 - Downstream

After structured validation:

1. Render scanner HTML/variants.
2. Run tracking and status/API generation.
3. Ensure future scans do not enter open positions or actionable status orders.
4. Update DTX history/provenance and scanner indexes.
5. Generate visual assets and inspect them when the publish command requires them.

Do not rerun the full sweep twice. `scan-parallel.sh` owns the sweep for the run; downstream publication
uses its no-sweep path.

## Phase 6 - Deterministic QA and Reviews

Run, at minimum:

```bash
node tools/validate-workflows.js --workflow scanner
node tools/validate-scan.js scanner/YYYYMMDD/
node tools/qa-check.js scanner/YYYYMMDD/ --strict
node tools/check-ai-tells.js scanner/YYYYMMDD/index.html --strict
node tools/test-scanner-quality-gates.js
```

Then run three independent views before publication:

- **Senior QA:** schema/provenance, arithmetic, renderer/downstream integrity and regression risk.
- **Contrarian:** challenge target reachability, family performance, catalyst attribution, dilution/event
  classification and any claim stronger than the evidence.
- **Retail war room:** verify actionability, simple wording, gap/slippage reality, invalidation and no-chase
  behavior.

Each reviewer returns blocking/fix/advisory findings with file/evidence references. Apply fixes, rerun all
affected deterministic checks, and require zero blockers. Reviewer prose cannot waive a script failure.

## Publication

- Stage explicit files only; never `.mcp.json`, `_data*`, `_dtx`, request IDs, tokens or unrelated work.
- Recheck `git diff --cached`, run the final test set, commit, push `main`, and verify the deployment when
  publication is part of the request.
- Telegram/public messaging is sent only after the pushed artifact is reachable and must be concise,
  self-contained and consistent with the published levels.

## Failure Modes

| Failure | Required action |
|---|---|
| MCP auth/service/timeout | Stop; mint a new TTL token or wait for service recovery |
| Systematic behind expected close | Mint a short TTL systematic token with `scope=refresh`; run `node tools/dtx-refresh-if-stale.js --expected-close REFDATE`, which calls `DtxRefreshBars`, polls `GetHealth`, and blocks unless the close advances; then recollect with the same request ID |
| Required source/page missing | Stop; no partial selection |
| Too few eligible stocks | Publish the allowed smaller minimum or no scan; never add non-US names |
| SEC/earnings classification unknown | Reject candidate |
| DTX invalid/expired | Zero actionable DTX orders and report the exact fault |
| QA/reviewer blocker | Fix and rerun; no push/publication |
