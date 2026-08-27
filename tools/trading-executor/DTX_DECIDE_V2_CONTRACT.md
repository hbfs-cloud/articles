# DtxDecide Contract V2 — Broker-MCP Execution Contract

This contract is authoritative for any broker-mcp integration that consumes
`DtxDecide` V2 plans. If an implementation cannot guarantee these rules, it
must refuse new orders.

## Responsibility Split

DTX is the only authority for:

- strategy;
- candidate selection and ranking;
- sizing;
- entry levels;
- stops and take-profits;
- execution windows and gates;
- promotion rules;
- plan validity.

Broker-mcp monitors the market, applies broker/risk controls, and executes the
plan. It must never invent, complete, or silently modify a DTX decision.

## Initialization

1. Call `GetHealth` with `expected_close` equal to the close the client wants to trade.
2. Refuse all new entries if any of these are true:
   - `ok != true`;
   - `freshness_ok != true`;
   - `behind_expected == true`;
   - data is stale or incomplete.
3. Call `DtxListConfigs` to discover deployed portfolios.
4. Use `DtxHowTo` for each portfolio cadence.
5. Never hardcode local strategy or symbol lists.

## DtxDecide V2 Request

For each portfolio scheduled for the run, call `DtxDecide` with:

```json
{
  "portfolio": "<id or file returned by DtxListConfigs>",
  "asof": "<decision date>",
  "expected_data_date": "<expected close>",
  "appel": "evening | intraday | manual",
  "request_id": "<stable UUID for this broker run>",
  "consumer_capabilities": {
    "contract_version": "2.0",
    "opportunity_groups": true,
    "per_candidate_symbol": true,
    "durable_intraday_execution": true
  },
  "positions": "<complete broker snapshot>",
  "orders": "<still-open broker orders>",
  "balances": {
    "base_currency": "<currency>",
    "cash_by_currency": {},
    "total_equity": "<real account NAV>"
  },
  "state": "<opaque previous DTX state>",
  "previous_plan_id": "<currently active plan id if revision>",
  "previous_plan_revision": "<currently active revision>"
}
```

Technical retries for identical input must reuse the exact same `request_id`.
Never generate a new `request_id` for a retry of the same call.

If `DtxDecide` returns `async_pending`, poll `DtxJobStatus(job_id)` until `done`
or `error`. Do not launch a second concurrent `DtxDecide` to replace a slow job.

## Response Validation

Before execution, validate the whole response:

- `contract_version == "2.0"`;
- response `request_id` matches the request;
- `run_id`, `call_id`, and `execution_plan.plan_id` are present;
- `revision >= 1`;
- `valid_from` and `valid_until` are present;
- plan is not expired;
- every `group_id` is unique;
- every `candidate_id` is unique;
- each group has `max_winners == 1`;
- ranks are strictly increasing with no duplicates;
- every candidate has `symbol`, `side`, `qty`, `broker`, `sleeve`, `reason`,
  `order`, `protection`, `execution`, and `decision_context`;
- no new BUY has `protection.mode == "none"`;
- no quantity, limit, protection, or exit field is missing.

If validation fails, refuse the entire plan and raise an explicit error. Never
fill missing fields broker-side.

## Execution Source

For a V2 client:

- execute `execution_plan.groups`;
- do not execute `actions.CREATE` in parallel;
- `actions.CREATE` exists only for V1 compatibility;
- continue to process `actions.UPDATE` and `actions.CANCEL`.

A group with one candidate is valid. It means no alternate exists for that
strategy/session.

## Group State Machine

For each group:

1. Sort candidates by `rank`.
2. Observe required market data for all symbols.
3. Arm only one candidate at a time.
4. Start only with `rank=1`.
5. Apply that candidate's exact window, gates, and levels.
6. Re-run broker controls before each placement or promotion:
   - kill switch;
   - buying power;
   - concentration;
   - exposure;
   - instrument availability;
   - data freshness;
   - open session;
   - regulatory and broker constraints.
7. Promote only when the exact cause is present in `promotion_policy.promote_on`.
8. Never promote after a cause present in `stop_on`.
9. Any fill, including a partial fill, ends the group search immediately.
10. Cancel/disarm all other candidates after the first fill.
11. `max_winners=1` is hard.

Failure or stale data must never trigger promotion unless DTX explicitly lists
that cause in `promote_on`.

## Global Symbol Lock

Maintain a global lock per `broker + account + symbol`.

A symbol already held, filled in another group, armed by another group, or
covered by an active BUY order cannot be executed concurrently in another
group. Re-run group controls and apply only a promotion reason allowed by DTX.

## Protections

Supported modes:

1. `native_bracket`
   - `stop_loss` and `take_profit` required;
   - pass DTX levels unchanged.
2. `native_oco`
   - exits only;
   - two legs required.
3. `engine_managed`
   - `stop_loss` and `exit_policy_ref` required;
   - if `required_before_fill == true`, place protection before or atomically
     with the fill;
   - the client must not invent exit logic.
4. `none`
   - allowed only for reduction/closure;
   - forbidden for a new position.

If the broker cannot guarantee `required_before_fill`, refuse the candidate.
Never silently downgrade native protection into weaker local protection.

## Broker Options

Respect exactly:

- `order_type`;
- `limit_price`;
- `stop_price`;
- `qty`;
- `max_notional`;
- `time_in_force`;
- `extended_hours`;
- `window_start`, `window_end`, `timezone`;
- `gate_timeout_sec`;
- `fill_timeout_sec`;
- `min_fill_qty`;
- `vwap_weak_skip`;
- `gap_up_pct`, `gap_down_pct`;
- `max_vix`;
- `max_slippage_bps`;
- `slicer`, when supplied.

A LIMIT order never becomes MARKET for convenience.

If the broker does not support a required option, classify the candidate as
`instrument_unavailable` or `symbol_rejected` only when that exact reason is true
and allowed in `promote_on`; otherwise stop the group.

## Validity And Supersession

- Never order before `valid_from` or after `valid_until`.
- Expired plans are permanently unexecutable.
- `supersedes_plan_id` explicitly replaces the prior plan.
- Cancel/disarm the old plan before activating the new one.
- Never merge plans implicitly.
- A new revision atomically replaces the previous revision.

## Idempotence

Compute `engine_order_fingerprint` from normalized order fields.

Before placement:

- check whether the fingerprint was already sent;
- check open broker orders;
- check fills and partial fills;
- never place the same order twice after retry, restart, or network timeout.

Persist durably:

- `request_id`;
- `run_id`;
- `call_id`;
- `plan_id`;
- `revision`;
- `group_id`;
- `candidate_id`;
- `engine_order_fingerprint`;
- broker order id;
- status and filled quantity;
- promotion/stop reason;
- timestamps.

## UPDATE And CANCEL

For `actions.UPDATE` and `actions.CANCEL`, validate:

- `run_id`;
- `call_id`;
- `candidate_id`;
- `group_id`;
- `target_order_id`;
- `parent_candidate_id` or `parent_engine_order_fingerprint`;
- `reason`;
- `levels_before`;
- `levels_after`;
- `place_now`.

Modify or cancel only the identified order. If the target no longer exists,
reconcile fills before any further action.

## DTX State

The returned DTX state is opaque:

- persist after every successful response;
- pass back unchanged to the next `DtxDecide` for the same portfolio;
- never recompute from broker state;
- separate by portfolio;
- preserve sleeve structure for multi-sleeve books.

## Required Journal

For every event, log:

- strategy, sleeve, broker;
- plan, revision, group, candidate, rank;
- symbol, side, quantity, levels;
- complete DTX reason;
- `decision_context`;
- each gate result;
- broker controls;
- exact promotion, refusal, or stop reason;
- broker order and fills;
- protection actually active.

The journal must answer:

- why DTX selected this candidate;
- why broker-mcp armed it;
- why it executed, refused, or replaced it;
- why no alternate was used;
- what protection was active at fill time.

## Absolute Prohibitions

- Never call DTX on every tick.
- Never execute `actions.CREATE` and `execution_plan.groups` together.
- Never invent `qty`, stop, take-profit, limit, or alternate.
- Never promote after a partial fill.
- Never promote on stale data or technical failure without authorization.
- Never execute an expired plan.
- Never merge two plans.
- Never convert LIMIT to MARKET automatically.
- Never treat missing alternates as an error.
- Never infer operational instructions from text `reason`; use structured fields.

## Session Report

After the session, produce:

```json
{
  "plan_id": "",
  "revision": 1,
  "status": "completed | expired | stopped | superseded",
  "groups": [
    {
      "group_id": "",
      "winner_candidate_id": null,
      "final_status": "",
      "fills": [],
      "promotions": [],
      "stop_reason": null
    }
  ],
  "orders": [],
  "errors": []
}
```

No order may be emitted if contract validation, data freshness, protections, or
idempotence cannot be guaranteed.
