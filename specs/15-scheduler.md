# PRD-15: Scheduler & Pipeline Orchestrator

**Status**: Specification  
**Version**: 1.0  
**Scope**: Replaces Discord bot + Claude Code agent orchestration with a deterministic per-user pipeline engine

---

## 1. Overview

A cron-based pipeline orchestrator that runs each step of the scanner/trading pipeline for every user on their configured schedule. Steps form a DAG (Directed Acyclic Graph) where blocking steps halt the pipeline on failure and non-blocking steps log and continue. Each user's pipelines are isolated; concurrent runs for the same user are prevented by a per-user lock.

---

## 2. Pipeline DAG

```
scan_collect
     │
     ▼
signal_generate
     │
     ▼
risk_gate
     │
     ├──────────────────────────────┐
     ▼                              ▼
update_tracking              plan_generate
     │                              │
     ▼                              ▼
sweep_backtest              execute_orders
     │                              │
     ▼                              ▼
gen_status_page             notify_results
     │
     ├──────────────┐
     ▼              ▼
  gen_api     gen_mode_cards
     │
     ▼
publish_push
     │
     ▼
  qa_check
```

**Blocking steps** (failure halts the pipeline and alerts the user):
- `scan_collect`
- `signal_generate`
- `risk_gate`

**Non-blocking steps** (failure is logged and Discord/Telegram notified; pipeline continues):
- `update_tracking`, `sweep_backtest`, `gen_status_page`, `gen_api`, `gen_mode_cards`, `publish_push`, `notify_results`, `qa_check`

**Conditional step** (`plan_generate` + `execute_orders`):
- Only runs if the user has at least one broker link with `status='active'` and a plan is not in `dry_run` mode.
- Skipped (not failed) for free-plan users.

---

## 3. Step Definitions

Each step maps to a shell command or internal function. Arguments are resolved at runtime from user config.

```json
{
  "scan_collect": {
    "command": "node tools/gen-scanner-signals.js --user {userId} --mode {modes}",
    "blocking": true,
    "timeout_ms": 120000
  },
  "signal_generate": {
    "command": "node tools/signal-generate.js --user {userId}",
    "blocking": true,
    "timeout_ms": 60000
  },
  "risk_gate": {
    "command": "MCP_GATEWAY_URL={mcpGatewayUrl} node tools/refresh-risk-metrics.js --user {userId}",
    "blocking": true,
    "timeout_ms": 90000
  },
  "update_tracking": {
    "command": "node tools/update-tracking.js --user {userId}",
    "blocking": false,
    "timeout_ms": 60000
  },
  "sweep_backtest": {
    "command": "node tools/sweep.js --user {userId}",
    "blocking": false,
    "timeout_ms": 180000
  },
  "plan_generate": {
    "command": "node tools/gen-trading-plan.js --mode {mode} --broker {broker} --user {userId}",
    "blocking": false,
    "timeout_ms": 60000,
    "condition": "has_active_broker"
  },
  "execute_orders": {
    "command": "node tools/trading-executor/run-session.js --user {userId}",
    "blocking": false,
    "timeout_ms": 300000,
    "condition": "has_active_broker AND plan NOT dry_run"
  },
  "notify_results": {
    "command": "node tools/telegram-publish-notify.js --type scanner --path scanner/{scanDate}/index.html --user {userId}",
    "blocking": false,
    "timeout_ms": 30000
  },
  "gen_status_page": {
    "command": "node tools/gen-status-page.js --user {userId}",
    "blocking": false,
    "timeout_ms": 60000
  },
  "gen_api": {
    "command": "node tools/gen-api.js --user {userId}",
    "blocking": false,
    "timeout_ms": 60000
  },
  "gen_mode_cards": {
    "command": "node tools/gen-mode-cards.js --user {userId}",
    "blocking": false,
    "timeout_ms": 60000
  },
  "publish_push": {
    "command": "bash tools/publish-daily-card.sh --user {userId}",
    "blocking": false,
    "timeout_ms": 120000
  },
  "qa_check": {
    "command": "node tools/qa-check.js --user {userId} --strict",
    "blocking": false,
    "timeout_ms": 30000
  }
}
```

---

## 4. Database Schema

### 4.1 Scheduled Tasks

```sql
CREATE TABLE scheduled_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_type       VARCHAR(50) NOT NULL,
                  -- 'scanner_pipeline' | 'position_tracking' | 'risk_refresh'
                  --  | 'order_execution' | 'sweep_backtest' | 'status_regen' | 'api_refresh'
  cron_expression VARCHAR(100) NOT NULL,       -- POSIX cron (5 fields)
  timezone        VARCHAR(50) DEFAULT 'America/New_York',
  enabled         BOOLEAN DEFAULT true,
  last_run_at     TIMESTAMP,
  next_run_at     TIMESTAMP NOT NULL,
  config          JSONB DEFAULT '{}',          -- task-specific overrides
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_scheduled_tasks_next_run ON scheduled_tasks(next_run_at) WHERE enabled = true;
CREATE INDEX idx_scheduled_tasks_user_id ON scheduled_tasks(user_id);
```

**Default tasks provisioned for every new user** (inserted on registration):

```json
[
  {
    "task_type": "scanner_pipeline",
    "cron_expression": "0 23 * * 1-5",
    "timezone": "America/New_York"
  },
  {
    "task_type": "position_tracking",
    "cron_expression": "*/30 9-16 * * 1-5",
    "timezone": "America/New_York"
  },
  {
    "task_type": "risk_refresh",
    "cron_expression": "0 9,16 * * 1-5",
    "timezone": "America/New_York"
  },
  {
    "task_type": "order_execution",
    "cron_expression": "30 9 * * 1-5",
    "timezone": "America/New_York"
  }
]
```

### 4.2 Pipeline Runs

```sql
CREATE TABLE pipeline_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id         UUID REFERENCES scheduled_tasks(id),
  pipeline_type   VARCHAR(50) NOT NULL,
  status          VARCHAR(20) DEFAULT 'pending'
                  CHECK (status IN ('pending','running','completed','failed','cancelled')),
  trigger         VARCHAR(20) DEFAULT 'cron'
                  CHECK (trigger IN ('cron','manual','dependency','health_check')),
  started_at      TIMESTAMP,
  completed_at    TIMESTAMP,
  steps           JSONB DEFAULT '[]',          -- array of StepResult (see §5)
  errors          JSONB DEFAULT '[]',          -- array of { step, message, timestamp }
  metadata        JSONB DEFAULT '{}',          -- scan_date, modes, broker_ids, etc.
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pipeline_runs_user_id ON pipeline_runs(user_id);
CREATE INDEX idx_pipeline_runs_status ON pipeline_runs(status);
CREATE INDEX idx_pipeline_runs_started_at ON pipeline_runs(started_at);
```

### 4.3 Pipeline Locks

```sql
CREATE TABLE pipeline_locks (
  user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  pipeline_run_id UUID NOT NULL REFERENCES pipeline_runs(id),
  acquired_at     TIMESTAMP DEFAULT NOW(),
  expires_at      TIMESTAMP NOT NULL           -- NOW() + max pipeline duration (45 min)
);
```

---

## 5. Step Result Schema

Each element of `pipeline_runs.steps` (JSONB array):

```json
{
  "name": "scan_collect",
  "status": "completed",
  "started_at": "2026-05-07T23:00:05Z",
  "completed_at": "2026-05-07T23:00:51Z",
  "duration_ms": 45823,
  "exit_code": 0,
  "stdout_tail": "...last 200 chars of stdout...",
  "stderr_tail": "...last 200 chars of stderr...",
  "retries": 0,
  "blocking": true
}
```

Status values per step: `pending` | `running` | `completed` | `failed` | `skipped` | `timed_out`.

---

## 6. Retry Policy

Applied per step. Retry state is tracked in the step result object.

| Step type | Max retries | Backoff (seconds) |
|-----------|-------------|-------------------|
| blocking  | 3           | 10, 30, 90        |
| non-blocking | 2        | 15, 60            |

**Backoff formula**: `delay = baseDelays[retryCount]`. After all retries exhausted:
- Blocking step failed → set `pipeline_runs.status = 'failed'`, emit alert, halt.
- Non-blocking step failed → set step `status = 'failed'`, emit warning, continue to next step.

**Retry exemptions**: steps that fail due to `SIGKILL` (OOM) or timeout are not retried (the failure is considered environment-level, not transient).

---

## 7. Cron Expression Format

Standard 5-field POSIX cron: `minute hour day-of-month month day-of-week`.

```
┌─── minute (0-59)
│ ┌─── hour (0-23)
│ │ ┌─── day of month (1-31)
│ │ │ ┌─── month (1-12)
│ │ │ │ ┌─── day of week (0=Sunday … 6=Saturday, 1-5=Mon-Fri)
│ │ │ │ │
* * * * *
```

Supported special characters: `*` (any), `,` (list), `-` (range), `/` (step).  
**Not supported**: `@yearly`, `@monthly`, `@weekly`, `@daily`, `@hourly` aliases (reject with 400).

Timezone: stored as IANA timezone string (e.g. `America/New_York`, `Europe/Paris`). `next_run_at` is always stored as UTC; the scheduler converts using the user's timezone before computing the next fire time.

`next_run_at` computation: use `node-cron` or equivalent library. After each run completes (success or failure), recompute `next_run_at = nextAfter(cron, timezone, NOW())` and update the row.

---

## 8. Market Hours Detection

Before executing `scan_collect`, `order_execution`, and `position_tracking`, the scheduler checks:

```javascript
function isMarketOpen(now = new Date()) {
  // Convert to America/New_York
  const et = toZonedTime(now, 'America/New_York');
  const dow = et.getDay(); // 0=Sun, 6=Sat
  if (dow === 0 || dow === 6) return false; // weekend

  // US federal holidays (static list, updated annually)
  if (isUSHoliday(et)) return false;

  const hhmm = et.getHours() * 100 + et.getMinutes();
  return hhmm >= 930 && hhmm < 1600; // 09:30–16:00 ET
}

// US market holidays (2026 example — maintain annually)
const US_HOLIDAYS_2026 = [
  '2026-01-01', // New Year's Day
  '2026-01-19', // MLK Day
  '2026-02-16', // Presidents' Day
  '2026-04-03', // Good Friday
  '2026-05-25', // Memorial Day
  '2026-07-03', // Independence Day (observed)
  '2026-09-07', // Labor Day
  '2026-11-26', // Thanksgiving
  '2026-11-27', // Day after Thanksgiving (early close → treat as closed)
  '2026-12-25', // Christmas
];
```

If `position_tracking` fires during non-market hours, the step is **skipped** (not failed). Scanner pipeline fires at 23:00 ET after market close — no market-hours gate needed.

---

## 9. Concurrent Pipeline Prevention

A per-user advisory lock prevents two scanner pipelines from running simultaneously.

**Lock acquisition** (at pipeline start):
```sql
-- Attempt to insert a lock row. If one exists and has not expired, fail.
INSERT INTO pipeline_locks (user_id, pipeline_run_id, expires_at)
VALUES (:userId, :runId, NOW() + INTERVAL '45 minutes')
ON CONFLICT (user_id) DO UPDATE
  SET pipeline_run_id = EXCLUDED.pipeline_run_id,
      acquired_at = NOW(),
      expires_at = EXCLUDED.expires_at
  WHERE pipeline_locks.expires_at < NOW()  -- only take over if expired
RETURNING user_id;
-- If no row returned → another pipeline is running; abort with status='cancelled'
```

**Lock release** (at pipeline end, success or failure):
```sql
DELETE FROM pipeline_locks WHERE user_id = :userId AND pipeline_run_id = :runId;
```

**Stale lock cleanup**: a background job runs every 5 minutes and deletes rows where `expires_at < NOW()`. This handles crashed workers.

---

## 10. Pipeline Runner — Execution Loop

```
function runPipeline(pipelineRunId):
  run = fetchPipelineRun(pipelineRunId)
  user = fetchUser(run.user_id)
  config = resolveUserConfig(user)            # modes, broker_ids, mcpGatewayUrl, etc.

  acquired = acquireLock(user.id, run.id)
  if not acquired: markCancelled(run.id, "concurrent pipeline"); return

  markRunning(run.id)

  for step in DAG_STEPS_IN_ORDER:
    if not meetsCondition(step, config): markStepSkipped(run, step); continue

    markStepRunning(run, step)
    result = executeWithRetry(step, config, maxRetries, backoff)

    if result.success:
      markStepCompleted(run, step, result)
    else:
      markStepFailed(run, step, result)
      if step.blocking:
        markRunFailed(run.id, step, result.error)
        alertUser(user, "Pipeline halted at step: " + step.name)
        releaseLock(user.id, run.id)
        return
      else:
        emitStepWarning(user, step, result.error)
        continue  # proceed to next step

  markRunCompleted(run.id)
  releaseLock(user.id, run.id)
  updateNextRunAt(run.task_id)
```

---

## 11. Scheduler Daemon

The scheduler runs as a goroutine inside the single Go binary (no separate process). It polls the `scheduled_tasks` table every 30 seconds:

```sql
SELECT id, user_id, task_type, config
FROM scheduled_tasks
WHERE enabled = true
  AND next_run_at <= NOW()
ORDER BY next_run_at ASC
LIMIT 50;
```

For each matched row:
1. Create a `pipeline_runs` row with `status='pending'`.
2. Dispatch to the worker pool (max 10 concurrent pipelines across all users).
3. Update `scheduled_tasks.last_run_at = NOW()`, compute and write `next_run_at`.

Worker pool: use Go goroutines with a semaphore (`chan struct{}`, capacity 10). Each pipeline runs in an isolated goroutine. Panics are recovered and logged without affecting other pipelines.

### 11.1 Deployment

The scheduler is embedded in the main Go binary — no container orchestration needed:

```bash
# Build
CGO_ENABLED=0 GOARCH=arm64 go build -o autotrader ./cmd/server/

# Deploy on Oracle Cloud Always Free (ARM A1)
scp autotrader oracle-vm:/usr/local/bin/
ssh oracle-vm 'sudo systemctl restart autotrader'
```

**systemd unit** (`/etc/systemd/system/autotrader.service`):
```ini
[Unit]
Description=DailyTickers AutoTrader
After=network-online.target redis.service
Wants=network-online.target

[Service]
Type=simple
User=autotrader
ExecStart=/usr/local/bin/autotrader serve
Restart=on-failure
RestartSec=5
Environment=DATABASE_URL=file:/var/lib/autotrader/db.sqlite3
Environment=REDIS_URL=redis://localhost:6379
Environment=MCP_GATEWAY_URL=https://gateway.dailytickers.com/mcp
KillSignal=SIGTERM
TimeoutStopSec=35

[Install]
WantedBy=multi-user.target
```

**Cron alternative**: For environments without a long-running daemon, the pipeline can also run via systemd timers:
```ini
# /etc/systemd/system/autotrader-pipeline.timer
[Timer]
OnCalendar=Mon..Fri *-*-* 23:00:00 America/New_York
Persistent=true

[Install]
WantedBy=timers.target
```

---

## 12. Health Checks

Health checks run as separate scheduled tasks on the daemon's internal timer (not user-configurable).

| Check | Interval | Action on failure |
|-------|----------|-------------------|
| MCP Gateway reachability | every 5 min | Log + set `risk_gate` step to skip with warning |
| Yahoo Finance proxy | before each `position_tracking` | Skip step + alert user |
| Broker credential validity | daily at 09:00 ET per user | Set `broker_links.status='error'` + alert user |
| Pipeline staleness | every 6h | Alert if no completed scanner pipeline in 48h (weekdays) |
| Redis connectivity | every 60s | Log + fallback to in-process rate limiting |

**Health check endpoint** (HTTP GET, no auth required):
```
GET /health
Returns: {
  "status": "ok" | "degraded" | "down",
  "checks": {
    "database": "ok",
    "redis": "ok",
    "mcp_gateway": "ok" | "unreachable",
    "worker_pool": { "active": 3, "queued": 1, "max": 10 }
  },
  "uptime_seconds": 86400
}
```

---

## 13. API Endpoints

```
GET  /api/v1/pipelines
  Auth:    Bearer access_token
  Query:   status?, pipeline_type?, limit=20, offset=0
  Returns: [{ id, pipeline_type, status, trigger, started_at, completed_at, steps_summary }]
  Note:    steps_summary = { total, completed, failed, skipped }

GET  /api/v1/pipelines/{id}
  Auth:    Bearer access_token
  Returns: full pipeline_runs row including steps array and errors

POST /api/v1/pipelines/trigger
  Auth:    Bearer access_token
  Body:    { pipeline_type: "scanner_pipeline", config?: {} }
  Effect:  Creates pipeline_run with trigger='manual', dispatches immediately
  Errors:  409 if pipeline already running for this user
  Returns: { pipeline_run_id }

DELETE /api/v1/pipelines/{id}
  Auth:    Bearer access_token
  Effect:  Sets status='cancelled' if status='pending'. Running pipelines: sends SIGTERM to worker.
  Returns: { message }

GET  /api/v1/schedules
  Auth:    Bearer access_token
  Returns: [{ id, task_type, cron_expression, timezone, enabled, last_run_at, next_run_at, config }]

PATCH /api/v1/schedules/{id}
  Auth:    Bearer access_token
  Body:    { cron_expression?, timezone?, enabled?, config? }
  Errors:  400 if cron_expression is invalid; 400 if unsupported alias
  Returns: { id, cron_expression, timezone, enabled, next_run_at }

POST /api/v1/schedules/{id}/run-now
  Auth:    Bearer access_token
  Effect:  Triggers immediate run (same as /pipelines/trigger for this task's type)
  Returns: { pipeline_run_id }
```

---

## 14. Graceful Shutdown

On `SIGTERM` (e.g. `systemctl restart autotrader`, deploy update):

1. Stop accepting new pipeline dispatches from the scheduler goroutine.
2. Signal all active pipeline goroutines to cancel via `context.Context` cancellation.
3. Wait up to 30 seconds for in-flight steps to complete their current operation (`TimeoutStopSec=35` in systemd gives 5s buffer).
4. After 30 seconds: force-cancel remaining goroutines (context deadline exceeded).
5. For any `pipeline_runs` row still `status='running'` at shutdown: set `status='failed'`, append `{ step: "daemon_shutdown", message: "Forced by SIGTERM" }` to `errors`.
6. Release all `pipeline_locks` rows held by this daemon instance.
7. Close database connections (SQLite WAL checkpoint, Redis disconnect).
8. Exit 0.

---

## 15. Notifications on Pipeline Events

All notifications route through the existing `tools/telegram-publish-notify.js` and Discord webhook infrastructure.

| Event | Severity | Channel |
|-------|----------|---------|
| Pipeline completed (all green) | info | Telegram topic per mode |
| Non-blocking step failed | warning | Discord + Telegram DM |
| Blocking step failed (pipeline halted) | error | Discord + Telegram DM (immediate) |
| Pipeline staleness alert | warning | Discord |
| Broker credential invalid | error | Telegram DM |
| Trial expiring in 3 days | info | Email + Telegram DM |

Notification payloads follow the existing format used by `telegram-publish-notify.js`. For pipeline-level alerts, the message format is:

```
[AutoTrader] Pipeline FAILED
User: {email}
Step: risk_gate
Error: MCP Gateway unreachable after 3 retries
Run ID: {pipelineRunId}
Time: 2026-05-07 23:04:12 ET
```
