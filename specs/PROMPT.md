# DailyTickers AutoTrader — Master Implementation Prompt

> **Purpose**: This prompt is given to an LLM agent to build the entire DailyTickers AutoTrader SaaS platform from the PRD specifications in this directory.
> **PRDs**: 26 documents (00-overview through 25-ai-first-skills-architecture)
> **Target**: Standalone, deterministic, multi-tenant SaaS — zero manual intervention after initial configuration.

---

## System Context

You are building **DailyTickers AutoTrader**, a fully automated trading SaaS platform that:

1. Collects market data from the DailyTickers MCP Gateway + Yahoo Finance + broker APIs
2. Generates trading signals via the **unified Strategy interface** (PRD-23):
   - **Scanner strategies** (Node.js): MCP screener → validation → Signal[]
   - **Mechanical strategies** (Go bridge): 60+ scanners across 8 asset classes → Signal[]
   - **Future**: ML strategies, manual signals — same interface
3. Applies hierarchical risk gating (portfolio → slot → position)
4. Simulates portfolios across N strategy slots (scanner + mechanical + custom)
5. Generates trading plans per mode × broker pair
6. Executes orders via 6 broker adapters (Paper, Alpaca, IBKR, Saxo, Trading212, Binance)
7. Tracks positions, triggers exits (SL/TP/expiry), manages bracket orders
8. Serves a public JSON API (50+ endpoints) and live dashboard
9. Sends notifications via Telegram (per-mode topics), Discord, Slack, Email, Webhooks
10. Supports multi-tenant users with subscription tiers, JWT auth, and broker credential encryption

## Architecture Overview

Read `specs/00-overview.md` for the full architecture diagram, domain model (8 core entities), data flow (8 phases), and dependency graph.

**Key architectural decisions:**
- **Unified Strategy Engine**: All signal sources (MCP scanner, Go mechanical, ML) implement one `Strategy` interface producing `Signal[]`
- **StrategySlot**: Replaces both "Modes" and "Allocations" — a capital slice bound to a strategy, risk params, and a broker
- **Go Bridge**: systematic-tss runs as embedded child process via stdio JSON-RPC (not HTTP sidecar)
- **Hierarchical Risk**: Portfolio-level → Slot-level → Position-level risk management
- **Append-only history**: Trade history, equity curves, and config changes are never overwritten

## Technology Stack

| Layer | Target |
|-------|--------|
| Runtime | Go 1.24 single binary + Node.js tools (child processes) |
| Orchestration | Embedded Go scheduler (robfig/cron) with pipeline DAG execution |
| Storage | SQLite + Litestream replication to Oracle Object Storage |
| API | REST (Go stdlib net/http or chi router) |
| UI | React dashboard (Next.js static export, served via GitHub Pages) |
| Auth | JWT (RS256, 15min) + refresh tokens (7d, rotate-on-use) |
| Hosting | Oracle Cloud Always Free (ARM A1: 4 OCPUs, 24GB RAM, 200GB disk) + AWS CloudFront free tier + GitHub Pages |
| Cache | In-process Go sync.Map (L1) + optional local Redis on same VM (L2) |
| CI/CD | GitHub Actions (2,000 min/month free) |
| MCP | JSON-RPC 2.0 over HTTP to DailyTickers gateway |
| Mechanical Engine | Go stdio JSON-RPC bridge, unified config, pluggable scanners/PMs |
| Secrets | Oracle Cloud Vault (free tier) or environment variables |
| Notifications | Telegram Bot API (free) + Discord webhooks (free) |

## PRD Reading Order

Build in dependency order. Each PRD is self-contained with exact schemas, algorithms, decision trees, and pseudocode.

### Phase 1: Foundation & Data Layer
1. **PRD-19** `specs/19-shared-market-data.md` — Multi-tier cache (L1 memory → L2 Redis → L3 origin), quote aggregator, screener deduplication
2. **PRD-12** `specs/12-mcp-orchestration.md` — MCP gateway integration, 11 tools, JSON-RPC 2.0, async polling, rate limiting
3. **PRD-01** `specs/01-market-data.md` — All 9 MCP tools with exact params, response schemas, polling algorithm, CORS proxy
4. **PRD-08** `specs/08-instrument-registry.md` — Cross-broker symbol mapping, ISIN/UIC, T212 suffix normalization

### Phase 2: Signal Generation
5. **PRD-02** `specs/02-signal-generation.md` — 8-step validation pipeline, scoring formula, TKL normalization, diversification, Sharia tagging
6. **PRD-03** `specs/03-risk-management.md` — 4 MCP risk gates, inverse-ATR sizing, VIX kill, DD breaker, correlation caps
7. **PRD-23** `specs/23-mechanical-strategy-integration.md` — Unified Strategy Engine: Strategy interface, StrategySlot config, Go bridge (stdio JSON-RPC), 60+ scanners, 12+ PMs, hierarchical risk, plugin architecture

### Phase 3: Simulation & Tracking
8. **PRD-13** `specs/13-mode-configuration.md` — 6 modes with exact production parameters (20+ params each), regime recalibration
9. **PRD-04** `specs/04-portfolio-simulation.md` — Walk-forward simulation, grid search (~311K combos), all metric formulas
10. **PRD-05** `specs/05-position-tracking.md` — Yahoo Finance price fetch, exit detection priority (SL→TP2→TP1→expiry)

### Phase 4: Execution
11. **PRD-06** `specs/06-order-execution.md` — Engine lifecycle (6 phases), order state machine, bracket placement, circuit breaker
12. **PRD-07** `specs/07-broker-adapters.md` — 9-method adapter interface, per-broker specs (6 brokers with exact endpoints/auth)

### Phase 5: Platform
13. **PRD-10** `specs/10-api-layer.md` — 54 per-mode + 6 global JSON endpoints, filtering logic
14. **PRD-11** `specs/11-dashboard-ui.md` — panel() function, 7 section-cards, live-engine WebSocket, Time Machine
15. **PRD-22** `specs/22-notification-hub.md` — Router, 5 channels, severity filtering, quiet hours, digest mode
16. **PRD-09** `specs/09-notifications.md` — 9 event types, Telegram/Discord transports, topic routing per mode

### Phase 6: SaaS & Security
17. **PRD-18** `specs/18-security-access-control.md` — JWT + API keys, AES-256-GCM encryption, rate limiting, SQLite row filtering, audit logging
18. **PRD-14** `specs/14-user-management.md` — Multi-tenant SQL schema, plan tiers, broker linking, 20 REST endpoints
19. **PRD-15** `specs/15-scheduler.md` — Pipeline DAG, cron format, market hours detection, retry policy
20. **PRD-16** `specs/16-qa-validation.md` — 28 checks, 7 rule groups, regression catalog

### Phase 7: Research & MCP Servers
21. **PRD-17** `specs/17-strategy-discovery.md` — Grid search optimizer as SaaS API, walk-forward validation, strategy lab
22. **PRD-20** `specs/20-mcp-strategy-analysis.md` — 7 MCP tools (RunBacktest, OptimizeStrategy, CompareStrategies)
23. **PRD-21** `specs/21-mcp-user-facing.md` — 10 MCP tools for portfolio queries, trade explanations

### Phase 8: Analytical Data Layer
24. **PRD-24** `specs/24-analytical-data-layer.md` — Cube.dev-like semantic layer, dbt-style transformation pipeline (staging → intermediate → marts), 6 OLAP cubes, pre-aggregated marts, strategy discovery via MCP tools (QueryAnalytics, GetMart, DiscoverStrategy)

### Phase 9: AI-First Development
25. **PRD-25** `specs/25-ai-first-skills-architecture.md` — Skills catalog (10 skills, oz-skills format), CLAUDE.md per module (Karpathy principles), .mcp.json configuration, 21 agentic design patterns mapped to platform, plugin architecture, zero-cost mandate

## Implementation Rules

### Code Quality
- **Deterministic**: Given the same inputs, the system must produce the same outputs. No randomness in signal generation or order execution.
- **Append-only**: Never overwrite trade history, equity curves, or config history. Always append new versions.
- **Idempotent**: Running the pipeline twice for the same date must not create duplicate signals, trades, or orders.
- **Graceful degradation**: If MCP gateway is down → skip scanner signals, continue with mechanical. If Go engine is down → skip mechanical, continue with scanner. If a broker API errors → log, skip that broker, continue others.

### Signal Pipeline
- All strategies implement the `Strategy` interface and produce `Signal[]` in a unified format (PRD-23 §3.1)
- Each signal carries a `source` field: `"scanner"`, `"mechanical"`, `"ml"`, or `"manual"`
- Scores are comparable **within a slot** but NOT across slots (different calibration)
- Slot-level filters (min_score, max_positions, sector limits) apply per-slot in the orchestrator

### Execution
- Plan generation (PRD-06) accepts `Signal[]` from any strategy — same bracket logic applies
- The plan JSON includes `strategySlotId` field for audit trail
- ONE set of broker adapters (PRD-07, Node.js) — Go broker adapters removed in SaaS mode
- Circuit breaker and VIX kill apply per-slot AND at portfolio level (hierarchical, PRD-23 §7)

## AI-First Development (Mandatory)

This platform is **AI-agent-native from D0**. Every workflow is agent-invocable, every module is agent-discoverable, and every convention is documented for both human and AI consumption.

### Reference Architectures

| Reference | URL | What We Adopt |
|-----------|-----|---------------|
| **Karpathy Principles** | https://github.com/forrestchang/andrej-karpathy-skills | 4 principles in every CLAUDE.md: Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven Execution |
| **Oz Skills Format** | https://github.com/warpdotdev/oz-skills | `.agents/skills/{name}/SKILL.md` — YAML frontmatter + markdown body for reusable agent workflows |
| **Agentic Design Patterns** | https://github.com/evoiz/Agentic-Design-Patterns | 21 patterns mapped to platform modules (see PRD-25 §7) |
| **Refero Design** | https://styles.refero.design/ | UI design inspiration — browse before designing any new dashboard component |

### Skills

Every major workflow MUST have a corresponding skill in `.agents/skills/`. Skills use the oz-skills format:

```
.agents/skills/{name}/SKILL.md
```

Each SKILL.md has YAML frontmatter (`name`, `description`, `version`) and a markdown body with: When to Use, Steps, MCP Tools Used, Output, Examples.

**Mandatory skills** (defined in PRD-25): `discover-strategy`, `review-strategy`, `add-feature`, `run-backtest`, `daily-pipeline`, `monitor-portfolio`, `add-strategy`, `debug-trade`, `add-broker`, `regime-check`.

### CLAUDE.md Structure

The project MUST have:
- **Root CLAUDE.md**: Karpathy 4 principles + project overview + build/test/lint commands + skill catalog summary + code conventions
- **Per Go package**: `cmd/autotrader/CLAUDE.md`, `internal/signal/CLAUDE.md`, `internal/risk/CLAUDE.md`, `internal/broker/CLAUDE.md`, `internal/portfolio/CLAUDE.md`, `internal/scheduler/CLAUDE.md`, `internal/bridge/CLAUDE.md`, `internal/mart/CLAUDE.md`
- **Dashboard**: `dashboard/CLAUDE.md` (React conventions, component patterns, state management)

Each per-package CLAUDE.md contains: package purpose, key interfaces/types, testing conventions, common pitfalls, related skills.

### MCP Configuration

A `.mcp.json` file at project root MUST list all MCP servers:

```json
{
  "mcpServers": {
    "dailytickers-gateway": {
      "transport": "http",
      "url": "${DT_MCP_GATEWAY_URL}",
      "description": "Market data, screeners, risk metrics (11 tools)"
    },
    "go-bridge": {
      "transport": "stdio",
      "command": "./autotrader",
      "args": ["--mode", "bridge"],
      "description": "Go mechanical engine (60+ scanners, JSON-RPC)"
    },
    "forecast-timesfm": {
      "transport": "http",
      "url": "${DT_FORECAST_URL}",
      "description": "TimesFM 2.5 price/vol/volume forecasts"
    }
  }
}
```

Secrets NEVER in `.mcp.json` — use `${ENV_VAR}` references.

### Secrets & Environment

- `.env` file MUST be in `.gitignore` — NEVER committed
- `.env.example` (committed) serves as template with placeholder values
- **Naming convention**: `DT_BROKER_*` (broker credentials), `DT_MCP_*` (MCP server URLs/keys), `DT_NOTIFY_*` (notification tokens), `DT_DB_*` (database), `DT_VAULT_*` (Oracle Cloud Vault)
- **Production**: Oracle Cloud Vault (free tier) via OCI SDK
- **Development**: `.env` file loaded by `godotenv`

### Agentic Design Patterns

The platform implements these agentic design patterns from D0 (see PRD-25 §7 for complete mapping of all 21 patterns):

| Pattern | Implementation |
|---------|---------------|
| Prompt Chaining | Pipeline DAG: scan → signal → risk → plan → execute |
| Routing | Strategy dispatch: scanner / mechanical / ML → unified Strategy interface |
| Parallelization | Multi-slot concurrent execution + multi-broker order submission |
| Reflection | Strategy health monitor + regime recalibration |
| Tool Use | MCP tools (11 DailyTickers + Go bridge JSON-RPC) |
| Memory | Append-only trade history + config versioning |
| Guardrails | VIX kill, DD breaker, correlation caps, position limits |
| Evaluation | QA validation (34 checks, 0 failures required) |
| Exploration | Strategy discovery via PRD-24 analytical marts |

### Zero-Cost Mandate

Platform MUST run for **€0/month** using exclusively free-tier services:
- Oracle Cloud Always Free (ARM A1: 4 OCPUs, 24GB RAM, 200GB disk)
- GitHub Pages (React dashboard static export)
- AWS CloudFront free tier (1TB/month, 10M requests)
- GitHub Actions (2,000 min/month)
- Telegram Bot API + Discord webhooks (free)
- SQLite + Litestream → Oracle Object Storage (10GB free)

No paid services unless explicitly approved. See PRD-00 §7 for deployment diagram.

### Multi-Tenant
- Every database table has `user_id` foreign key with application-level row filtering (SQLite)
- Broker credentials encrypted with AES-256-GCM, key derived from user-specific salt
- API keys use `dt_live_` prefix, stored as SHA-256 hashes
- Rate limiting per user tier (free=100/min, basic=1K, pro=10K)

### Unified Strategy Engine (PRD-23)
- Go engine runs as embedded child process via stdio JSON-RPC (`--mode bridge`), started by Node.js orchestrator
- All strategies (scanner + mechanical + ML) implement the same `Strategy` interface
- StrategySlot replaces both "Mode" and "Allocation" — unified config in `strategy-slots.json`
- Backtest uses dual engines behind unified `BacktestResult` schema: sweep.js for scanner, Go bridge for mechanical
- ONE position tracker for all slots (unified-positions.json), tagged by `strategySlotId`

### Dashboard & API
- Dashboard shows all strategy slots in unified view (scanner and mechanical side by side)
- API endpoints: `/portfolio/v1/{slotId}/[signals|positions|equity|...].json` — same structure for all slots
- Time Machine works for all slot types
- Live engine WebSocket pushes updates for all active positions regardless of source

## Database Schema Summary

Core tables (see individual PRDs for exact schemas):

```
users                    — PRD-14
user_subscriptions       — PRD-14
user_broker_accounts     — PRD-14
user_api_keys            — PRD-18

signals                  — PRD-02/23 (unified, all sources)
strategy_templates       — PRD-23
strategy_slots           — PRD-23 (replaces modes + allocations)
portfolio_risk_state     — PRD-23

modes_config             — PRD-13 (legacy, migrated to strategy_slots)
backtest_results         — PRD-04
positions                — PRD-05
trades                   — PRD-04
plans                    — PRD-06
orders                   — PRD-06
fills                    — PRD-06

instruments              — PRD-08
broker_instrument_map    — PRD-08

notifications            — PRD-22
notification_preferences — PRD-22
audit_log                — PRD-18

strategy_runs            — PRD-17
backtest_jobs            — PRD-17

cache_entries            — PRD-19
screener_requests        — PRD-19
```

## Daily Pipeline Execution

The scheduler (PRD-15) runs this DAG daily at market close:

```
┌─────────────────────────────────────────────────────────────┐
│  Phase 1: DATA COLLECTION (parallel)                         │
│  ├── MCP GetMarketOverview                                   │
│  ├── MCP RunAutoScreener + RunScreener (3 DSL + EU)          │
│  ├── Yahoo Finance quotes (open positions)                   │
│  └── Go Bridge: load OHLCV data for mechanical slots         │
│                                                              │
│  Phase 2: SIGNAL GENERATION (parallel, per slot)             │
│  └── For each StrategySlot:                                  │
│      strategy.scan(date, marketData, regime) → Signal[]      │
│      (scanner slots call MCP, mechanical slots call Go bridge)│
│                                                              │
│  Phase 3: RISK GATING (per-slot + portfolio)                 │
│  ├── Per-slot: regime, correlation, earnings, sizing         │
│  └── Portfolio: cross-slot dedup, aggregate exposure, DD cap │
│                                                              │
│  Phase 4: POSITION TRACKING                                  │
│  └── Update exits (SL/TP/expiry) for all open positions      │
│                                                              │
│  Phase 5: SIMULATION                                         │
│  └── Sweep: append new closed trades, compute metrics        │
│                                                              │
│  Phase 6: RISK REFRESH                                       │
│  └── MCP: VaR, stress test, correlation, regime probability  │
│                                                              │
│  Phase 7: PLAN GENERATION                                    │
│  └── For each slot × broker: generate plan JSON              │
│                                                              │
│  Phase 8: EXECUTION                                          │
│  └── For each plan: broker adapter → submit orders → brackets│
│                                                              │
│  Phase 9: REPORTING (parallel)                               │
│  ├── Generate status page (all slots)                        │
│  ├── Refresh API endpoints (50+)                             │
│  ├── Generate slot cards (PNG)                               │
│  ├── Send notifications (Telegram/Discord/Slack/Email)       │
│  └── QA validation (34 checks, 0 failures required)          │
└─────────────────────────────────────────────────────────────┘
```

## Key Constraints

1. **Pipeline latency**: Scan → orders < 5 minutes
2. **Order execution window**: Market open ± 30 minutes
3. **Data freshness**: < 5 min during market hours
4. **Uptime**: 99.5% during market hours
5. **Scale**: ~25 concurrent users (personal use: 4-5 brokers, 10 portfolios max + ~20 invited users). Single-node, no horizontal scaling needed.
6. **No manual intervention**: After initial config, the system runs autonomously
7. **Multi-broker**: Same signal can be executed on different brokers simultaneously
8. **Multi-slot**: A user can run N strategy slots concurrently (scanner + mechanical + ML)
9. **Audit trail**: Every signal, plan, order, fill, and exit is logged with timestamps

## Asset Classes Supported

| Asset Class | Signal Source | Scanners | Brokers |
|-------------|-------------|----------|---------|
| US Equities | Scanner + Mechanical | MCP screener + dsl/af/hybrid/highvol/megacap/ultra/selective/longrunner/americanbulls | Alpaca, IBKR, Saxo |
| EU Equities | Scanner + Mechanical | MCP screener (EU) + eu-trend/breakout/pullback/dip/panic/highvol/composite/robust | Saxo, IBKR, T212 |
| French Equities | Mechanical | fr-vix-trend/outlier/momentum/dip/aggro/5d/optimal | Saxo, IBKR |
| UK Equities | Mechanical | uk-financials/recovery/panic/cluster/composite/lowvol | T212, IBKR |
| LATAM/Canada/India/Japan/HK | Mechanical | br/ca/in-composite, jp-recovery, hk-highvol/codex | IBKR, Saxo |
| Morocco (BVC) | Mechanical | dsl/eu-composite via BVC data provider | — (paper only for v1) |
| Forex | Mechanical | forex (momentum + MR + RS vs DXY) | Saxo, IBKR |
| Metals | Mechanical | metals (GLD-beta rotation) | Alpaca, IBKR |
| Crypto | Scanner (TKL) + Mechanical | MCP + crypto-hold/momentum/advanced/beast/pairs/grid/buyhold/dualmode | Binance |
| ETFs | Scanner + Mechanical | MCP screener + etf-momentum/etf-leveraged | Alpaca, IBKR, Saxo, T212 |

## How to Use This Prompt

1. Read all 26 PRDs in the order specified above
2. For each PRD, extract the exact schemas, algorithms, and decision trees
3. Implement each module as a standalone service/package with clear interfaces
4. Wire modules together following the dependency graph in PRD-00 §9
5. Test each module independently, then integration test the full pipeline
6. Deploy as a single Go binary on Oracle Cloud Always Free (ARM A1) via systemd, with GitHub Pages for the React dashboard and AWS CloudFront as CDN
7. Set up AI-first development: create `.agents/skills/` directory, write root CLAUDE.md with Karpathy principles, configure `.mcp.json`, create `.env.example`. Every new feature starts with the `/add-feature` skill.

**Every number in the PRDs is a production value** — not a placeholder. Use them exactly as specified unless explicitly noted as configurable. When a PRD says "default X, configurable via Y", implement both the default and the configuration mechanism.

**When in doubt**, the existing codebase (`tools/`, `assets/`, `data/`) is the source of truth for current behavior. The PRDs specify the target SaaS architecture that extracts and generalizes this behavior for multi-tenant use.
