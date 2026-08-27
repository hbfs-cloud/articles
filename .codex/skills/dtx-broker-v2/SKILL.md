---
name: dtx-broker-v2
description: Implement, review, or operate broker-mcp execution for DtxDecide Contract V2 plans, including grouped candidates, strict validation, protections, idempotence, state persistence, and fail-closed execution.
metadata:
  short-description: DTX broker-mcp Contract V2 execution
---

# DTX Broker V2

Use this skill for any task touching broker-mcp execution of `DtxDecide` V2
responses, including implementation, review, runbooks, tests, incident analysis,
or production operation.

The authoritative contract is
`tools/trading-executor/DTX_DECIDE_V2_CONTRACT.md`. Read it before editing or
operating any broker integration that consumes:

- `contract_version: "2.0"`;
- `execution_plan.groups`;
- grouped/alternate candidates;
- DTX promotion policies;
- DTX-managed protections or opaque state.

## Hard Boundaries

- DTX owns strategy, ranking, sizing, levels, protections, execution gates,
  promotions, and plan validity.
- Broker-mcp executes structured fields only. It may apply risk/broker controls,
  but it must never invent, complete, or silently modify DTX decisions.
- A V2 client executes `execution_plan.groups`; it does not execute
  `actions.CREATE` in parallel.
- The legacy `tools/trading-executor` scanner-plan engine is not a V2 executor.
  It must fail closed on V2 plans.
- If contract validation, freshness, protections, broker support, or idempotence
  cannot be guaranteed, no order may be emitted.

## Required Working Pattern

When implementing or reviewing:

1. Read `tools/trading-executor/DTX_DECIDE_V2_CONTRACT.md`.
2. Verify initialization uses `GetHealth(expected_close=...)`,
   `DtxListConfigs`, and `DtxHowTo`; never hardcode deployed portfolios.
3. Verify `DtxDecide` requests include stable `request_id`,
   `expected_data_date`, complete broker snapshots, opaque previous DTX state,
   previous plan identity, and `consumer_capabilities.contract_version="2.0"`.
4. Verify async jobs are polled via `DtxJobStatus` instead of launching a second
   competing `DtxDecide`.
5. Validate the full response before execution: identity, revision, validity
   window, unique groups/candidates, strict ranks, `max_winners=1`, complete
   candidate fields, and non-empty protections for new BUYs.
6. Enforce group state machines, global broker/account/symbol locks,
   idempotent order fingerprints, exact broker options, and strict
   supersession/revision semantics.
7. Persist and replay DTX `state` unchanged per portfolio/sleeve.
8. Produce the required structured session report.

Never infer operational instructions from free-text `reason`; use structured
fields only.
