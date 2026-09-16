# Scanner Directory Contract

This file governs work under `scanner/`. The active orchestration is
`.claude/commands/scanner.md`; detailed rules live in `.claude/skills/scanner-pipeline.md`; the shared
source contract is `.claude/skills/source-policy.md`. Those files override historical artifacts.

## Product

- Every newly published scanner page and status page is in French and declares `<html lang="fr">`.
- A scan is produced after the US close for the next US trading session.
- Universe: US-listed stocks and US-listed ETFs only. No EU, APAC, forex or non-US fallback pool.
- Target: 8 stocks plus 2 US-listed ETFs. Publish as few as 6 stocks plus 2 ETFs instead of weakening a
  blocking rule. A smaller honest list is preferable to a padded list.
- `scanner/YYYYMMDD/signals.json` is the structured source of truth. Render HTML from JSON; do not edit
  rendered values independently.
- Finviz remains the chart source used by the established renderer. Do not replace it with a local chart
  unless the user explicitly requests that product change.

## Required Sequence

1. `node tools/validate-workflows.js --workflow scanner`.
2. Resolve `date`, `refdate` (last completed US close) explicitly (the third legacy collector argument remains accepted).
3. Run `tools/scan-parallel.sh`; it performs the marketdata, enrichment, tracking and beta
   chains. Required chains fail closed.
4. Read the generated harnais and source files. Never replay the same MCP calls manually just to obtain a
   different answer.
5. Select only from the collected candidate universe and apply `data/scanner-filters.json`, immutable
   recent-performance overlays, SEC/earnings gates and open-position exclusions.
6. Produce `signals.json`, then run `validate-scan.js`, `qa-check.js --strict`, renderer checks, strict
   content/AI checks and the senior/contrarian/retail panel.
7. Render, update tracking/status/API, and publish only after every blocking gate.

## Data Integrity

- The first collection wave is a health gate: marketdata `GetStatus`.
- DTX is excluded by `config/scanner-components.json`; the scanner does not depend on its curve or
  systematic authentication. Propagate the generated dated `_scope.json` through downstream tools.
- Async MCP results must be polled once and paginated to exhaustion. Partial pages are a failed source.
- Every daily bar request uses the immutable `as_of_timestamp`, `completion_policy=completed_only`,
  its explicit asset calendar, and `expected_completed_end=refdate`; `end_date` is not close certification.
- SEC discovery uses MCP `sec_filings,flags`; every equity-offering hit is classified from the primary
  filing. Debt is not dilution. Unknown classification blocks the candidate.
- Registration-form screening is NOT sufficient. A large cap issues shares through an **8-K Item 3.02
  (Unregistered Sales of Equity Securities)**, which carries no S-*/424B* form and is invisible to a
  form-type filter. Read 8-K item codes: 3.02 (issuance) and 3.03 (modification of holder rights) are
  equity events and must be classified like any offering. QCOM cleared a form-type screen on 2026-09-16
  while holding a 2026-09-08 Item 3.02 warrant to Amazon for 25,000,000 shares at $161.26 — in the money
  at the $187.80 reference close — plus 19,200,000 shares for the Modular acquisition. Both filings were
  present in the collected MCP payload; only the filter was blind.
- The MCP `sec_filings` list is truncated relative to EDGAR and its date bounds are refused
  (`current-only`). Treat it as discovery, never as the complete record: classification opens the primary
  filing on EDGAR, and the point-in-time bound (`filingDate <= refdate`) is applied when reading.
- Web access is limited to primary SEC/IR/macro documents and attributed current news. It never replaces
  market data, a technical, a score, a level, a backtest or a missing DTX response.

## Selection Integrity

- Same input, filters and overlays must produce the same eligible set and ordering. The LLM may explain
  or reject an eligible name; it cannot create a candidate or alter a numeric gate.
- Recompute all entry/stop/target/R-R fields from structured inputs. Enforce target reachability before
  R/R, and calculate R/R from `entry_high` (worst allowed fill).
- Never turn a LIMIT into MARKET or promote a candidate without its structured cause.
- Recent-performance overlays can cap or down-weight a family; they are hash-bound to mature evidence.
  A weak strategy cannot dominate the editorial basket.
- A future scan never becomes an open position or an actionable status order before its session.

## Security and Side Effects

- Scanner content must never call broker, account or trading MCP tools.
- Token values never appear in terminal commands, logs, files, chat or commits. The scripts accept secure
  environment injection or masked input only.
- Use explicit file staging; never `git add -A`. Do not stage `.mcp.json`, token files, `_data` staging,
  request-id files or unrelated user work.
- Telegram, public publication and push happen after QA and only when the command/user authorizes them.
- Telegram output is French, concise, actionable and self-contained. Substack output, when separately
  authorized, is an independent English artifact and contains no website reference.

## Blocking Checks

At minimum, a publish run must pass:

```bash
node tools/validate-workflows.js --workflow scanner
node tools/check-freshness.js scanner/YYYYMMDD/_data/harness.json
node tools/check-freshness.js scanner/YYYYMMDD/_data2/harness.json
node tools/validate-scan.js scanner/YYYYMMDD/
node tools/qa-check.js scanner/YYYYMMDD/ --strict --scope=scanner/YYYYMMDD/_scope.json
node tools/check-ai-tells.js scanner/YYYYMMDD/index.html --strict
node tools/test-scanner-quality-gates.js --scope=scanner/YYYYMMDD/_scope.json
```

Any failure is a stop, not a warning to explain away.
