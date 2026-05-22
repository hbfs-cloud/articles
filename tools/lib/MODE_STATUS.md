# Mode Status State Machine

Lifecycle for the 6 portfolio modes (turbo, dynamic, balanced, secured,
fortress, tkl). Lets us pause or wind-down a struggling mode without
touching code, and ramp a new one in gradually before flipping it live.

Implementation: [`tools/lib/mode-status.js`](mode-status.js)
CLI: [`tools/set-mode-status.js`](../set-mode-status.js)
Storage: `data/modes-config.json` (current state) + `data/modes-status-history.json` (append-only log)
Public API: `portfolio/v1/status.json` + `status` block in every per-mode endpoint

## States

```
draft → test → test-to-live → live → live-to-pause → paused → stopped
                                ↑                       ↓
                                └────── resume ─────────┘
```

| State | Accepts entries | Trading mode | Existing positions | Public |
|-------|-----------------|--------------|--------------------|--------|
| `draft` | no | none | n/a | hidden |
| `test` | yes | `paper` | paper-managed | visible |
| `test-to-live` | yes (au fil de l'eau) | `paper-ramp` | paper-managed, validation pending | visible |
| `live` | yes | `real` | live-managed | visible |
| `live-to-pause` | **no** | `exit-only` | **wind down via SL/TP/horizon/trailing** | visible |
| `paused` | no | none | should be empty | visible |
| `stopped` | no | none | n/a | hidden |

### Key semantics

- **`live-to-pause`** = intelligent wind-down. New entries (and rotations,
  which open a new position) are suppressed. Existing positions keep
  running their full exit logic — stop-loss, take-profit, horizon expiry,
  trailing stops — until they close naturally. Transition to `paused` once
  `positionCount === 0`.
- **`test-to-live`** = gradual ramp-up. Entries flow "au fil de l'eau":
  paper orders are placed for every new signal, allowing real-condition
  validation before promoting the mode to fully `live`. Once validated,
  transition `test-to-live → live` flips the trading mode from
  `paper-ramp` to `real`.

## Valid transitions

| From | To |
|------|-----|
| `draft` | `test` |
| `test` | `test-to-live`, `draft` |
| `test-to-live` | `live`, `test` (rollback if validation fails) |
| `live` | `live-to-pause` |
| `live-to-pause` | `paused` |
| `paused` | `live` (resume), `stopped` |
| `stopped` | (terminal) |

Any other pair returns `canTransition() === false`. Use `--force` on the
CLI only when you know exactly what you're skipping.

## Pipeline integration

All downstream tools respect the status field:

- **`tools/gen-api.js`** — emits a `status` block on every endpoint
  (`signals/positions/trades/equity/orders/actions/all/risk`). Mode-level
  `orders.json` is auto-emptied when `acceptsNewEntries === false`. Writes
  the aggregate `portfolio/v1/status.json` with `recentTransitions[]`.
- **`tools/gen-status-page.js`** — adds a status badge in the mode tab and
  a status banner in the mode panel for every state other than `live`.
- **`tools/gen-trading-plan.js`** — `draft / paused / stopped` exit with
  no plan. `live-to-pause` emits an exits-only plan (close-now lifecycle
  is preserved, BUY / ROTATE orders are suppressed).
- **`tools/pit-engine.js`** — backtest engine respects `statusSince` so
  earlier days keep their historical behavior. From the transition date
  onward, **rotation is gated by `statusHalt` first** (rotating in a new
  candidate counts as a new entry), then VIX kill and DD breaker apply.
  Existing-position management runs as usual.

## CLI usage

```bash
# Pause a struggling mode
node tools/set-mode-status.js --mode secured --to live-to-pause \
  --reason "OOS PF=0.53 sur n=11 — monitor 30j" \
  --review 2026-06-22

# Start ramping a new test mode toward live
node tools/set-mode-status.js --mode turbo --to test-to-live \
  --reason "Activation paper-ramp before flipping to real"

# Once positions are closed
node tools/set-mode-status.js --mode secured --to paused \
  --reason "All positions closed, equity frozen"

# Resume
node tools/set-mode-status.js --mode secured --to live \
  --reason "Recovery confirmed, OOS WR back to 45%+"
```

The CLI rejects illegal transitions unless `--force` is set. All
transitions are appended to `data/modes-status-history.json`.

## OpenAPI

Schemas: `ModeStatus`, `ModeStatusTransition` (v1.3.0+).
Aggregate path: `GET /portfolio/v1/status.json`.
Per-mode endpoints carry `status` at the root level.
