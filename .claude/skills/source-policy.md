---
name: source-policy
description: Deterministic source and side-effect policy shared by every DailyTickers content workflow.
user_invocable: false
---

# Source Policy

This policy is authoritative for `/daily`, `/weekly`, `/analyse`, `/aplus`, `/signals-desk`,
`/signals-desk-fire-and-forget`, `/scanner`, `/retro`, `/earnings-reaction`, `/sector-rotation`,
`/macro-event-playbook`, `/squeeze-radar` and `/desk`. The executable mirror is
`config/workflow-contracts.json`; drift is blocked by `tools/validate-workflows.js`.

## 1. Source ownership

- **Marketdata MCP owns numerical market facts:** prices, returns, OHLCV, technicals, fundamentals,
  valuation inputs, calendars, SEC/flag discovery, options, short interest, flows, screeners,
  correlations and backtests.
- **Systematic MCP owns DTX facts:** deployed configs, health relative to the requested close, regime,
  decisions, replays, statistics and book curves.
- **The web may only establish narrative facts:** an SEC EDGAR primary filing, company IR release or
  transcript, an official macro/central-bank calendar, or attributed current news.
- **The web is never a fallback for missing numerical MCP data.** Missing/stale MCP evidence removes the
  claim or blocks the product. It is not replaced by a quote site, chart site, search snippet or memory.
- A SEC search result is discovery, not proof. Open the primary filing and record form, accession/date,
  security type and whether capacity is equity, debt or mixed.

## 2. Runtime contract

1. Run `node tools/validate-workflows.js --workflow <name>` before collection.
2. Pass `date` and the exact last close as `refdate`; reusable plans never carry literal dates.
3. The first plan wave is `gate:true`: `GetStatus`, plus
   `GetHealth(expected_close=$refdate)` whenever systematic is used.
4. Required sources fail closed. A detached wave is context-only and may never govern a number,
   candidate, score or publication decision.
5. One async job is polled by its stable job ID until terminal state and paginated to exhaustion. A
   duplicate replacement job, missing page, pagination loop or incomplete result is a failed source.
6. Run freshness and `validate-workflows.js --run-plan <plan> <out>` after collection.
7. Numeric decisions then pass their domain gate (`validate-scan.js`,
   `validate-trade-ideas.js`, `validate-aplus-candidates.js`, or analysis quality checks).
8. Contrarian/retail review, senior review and strict local QA remain blocking.

## 3. Determinism and provenance

- Selection starts from plan outputs and versioned filters. The LLM may explain or reject a candidate;
  it may not create a score, level, alternate or missing field.
- Every harness records the resolved artifact, reference close, plan hash and normalized input hash.
- Every collected source is SHA-256 stamped in its harness. A derived `ideas.json` or
  `candidates.json` carries an `evidence` map whose logical IDs point to repository-relative source
  files and repeat those hashes. The domain validator verifies the files, sibling harnesses, hashes
  and reference close; `source_ids` alone are never accepted as proof.
- Evidence-map shape: `"evidence":{"bars":{"path":"data/workflow-runs/.../bars.json",
  "sha256":"<64 lowercase hex>"}}`. One artifact may satisfy several logical IDs, but every ID
  named by a candidate must be mapped. Optional/detached sources cannot govern a decision.
- Dynamic story names use runtime variables (`focus_symbols`, `symbols`, scanner batches). Yesterday's
  tickers never live in a reusable plan.
- A dated close is backed by `bars_daily(end_date=$refdate)` with `expects_close:true`.
- Published R/R, ATR distance and actionability are recomputed by code from published levels.

## 4. Security and side effects

- Content workflows may call only `marketdata` and `systematic`. Broker, trading and account tools are
  forbidden even if exposed in the session.
- Tokens are short-lived, read-only and server-scoped. Their values never appear in commands, logs,
  chat, files or commits. `run-collect.sh` uses masked terminal input when a secure environment is not
  already present; `collect.js --token-bundle-stdin` supports non-interactive secret injection.
- Public posting, notifications and `git push` happen only after every blocking gate and only when the
  command/user authorizes that side effect. A dry run performs none of them.
- The fire-and-forget signals workflow may post Telegram after its lean gates. A Substack note is
  opt-in, never a hidden default side effect.

## 5. Publication channels

- Web: French only for every new publication.
- Telegram: French, concise, actionable, self-contained and derived from the certified run.
- Substack: English, concise, actionable, self-contained, separately authored from the same certified run,
  and free of any website URL, backlink, CTA or textual reference to a fuller web version.
- A channel transformation may simplify wording but may not change a value, condition, ranking, risk or
  invalidation. Any mismatch blocks all affected outputs.
