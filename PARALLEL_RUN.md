# PARALLEL_RUN.md — articles ⇄ broker-simulator (forward-validation → cutover)

The nightly `/scanner` runs a **parallel-run**: the broker-simulator (https://simulator.dailytickers.com)
independently executes this project's trades as a **faithful mirror**, so we can validate day-over-day
(divergence ≈ 0 ⇒ a bug) and eventually **cut over** the position source-of-truth from `pit-state.json`
to the sim. **It is already built, wired, and self-managing — you usually don't touch it.** Every step is
**non-blocking**: a sim outage or missing token NEVER aborts the scan (the Discord alert is the signal).

## The autonomous loop (already wired in `run_full_scan.sh` + `tools/publish-daily-card.sh`)
1. **bootstrap-once** — `node tools/export-to-simulator.js --sync`: any pilot mode that has `pit-state` data
   but whose `mirror:<mode>` sim account has no fills yet is backfilled (frozen history) exactly once, then
   skipped forever. New modes self-onboard.
2. **mirror-run** — `node tools/run-mirror.js`: the sim enters the day's pending intents at next-open + VWAP
   gate and replays intraday for SL/TP/horizon exits.
3. **reconcile** — `node tools/reconcile-simulator.js`: compares sim vs `pit-state.json` per mode (price ±0.5%,
   NAV ±2%), appends `data/reconciliation-log.json`, Discord-alerts on breach.
4. **cutover-decision** — `node tools/cutover-decision.js`: per mode, flips `data/source-of-truth.json` to
   `"sim"` after **cutoverDays (20)** consecutive zero-divergence days; **auto-reverts** to `"articles"` on any
   fresh divergence (alerts AUTO-CUTOVER / AUTO-REVERTED). No human flag, no big-bang, fully reversible.
5. **read-switch** — `tools/lib/sim-source.js` makes `gen-api.js` + `gen-status-page.js` render positions/equity
   from the sim for `"sim"` modes, with a **HARD FALLBACK to `pit-state.json`** on any error/missing-token/stale
   cache. The public page/API can never break or empty because of the sim.
6. **publish** — `node tools/publish-to-simulator.js` (after sweep): posts the next day's entry intents.

## Auth / config (DO NOT hardcode or commit secrets)
- Service token: env **`BROKERSIM_SERVICE_TOKEN`**, read from **`articles/.env`** (gitignored) by
  `tools/lib/simulator-client.js loadEnv()`. `~/.profile` is an optional override (exported only if non-empty,
  so it can't shadow `.env`). If absent → the scan logs a WARNING and the parallel-run is a clean no-op.
  **.env values must be UNQUOTED** (loadEnv does not strip quotes).
- `data/simulator-config.json`: baseUrl, `pilotModes` [turbo, dynamic, balanced, bull, secured], tolerances,
  `cutoverDays`. Accounts resolve by label **`mirror:<mode>`** via `GET /api/accounts` (token auto-scopes to
  its protected workspace — no `X-Org-Id` needed).
- The sim REST contract lives in `broker-simulator/internal/api/{mirror,backfill}.go` (in the
  dailystocks-platform repo). Endpoints: `POST /api/accounts/{id}/{mirror-order,mirror-run,backfill}`.

## Pilot scope
Equity-live modes only: **turbo, dynamic, balanced, bull, secured**. (forex/metals excluded — the sim doesn't
price intraday FX / metals futures; crypto later.) Only `dynamic` had `pit-state` data at setup; the others
auto-onboard via bootstrap-once at the first sweep that populates them.

## Validated (2026-06-18, prod broker-simulator v33)
Backfill of `dynamic` → **0.0 % equity parity** (sim = articles); a forward intent entered AAPL at the next-day
open (VWAP-gated). Protected workspace `pilot` + service token + 5 `mirror:*` accounts provisioned.

## Known limits / things to watch on the FIRST real nightly
- **Day-offset**: confirm `mirror-run` / `reconcile` target the same day `pit-state.json` represents.
- **Stale backfilled positions** can't be intraday-replayed (Yahoo 1m only ~30 days) — a big one-off navDiff on
  an old open position is a staleness artifact, not a bug; **forward** trades are unaffected.
- **Sim-side gotcha** (if you add migrations there): tables created as the `postgres` superuser need
  `ALTER TABLE sim.<t> OWNER TO analytics` or the sim gets "permission denied".

## Troubleshooting
- "parallel-run disabled" in the log → `BROKERSIM_SERVICE_TOKEN` missing in `.env` (and `~/.profile`).
- reconcile alerts a divergence → check `data/reconciliation-log.json`; a `"sim"` mode auto-reverts.
- Want to re-onboard a mode → reset its `mirror:<mode>` account on the sim, then `--sync` re-backfills.
