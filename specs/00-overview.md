# PRD-00: System Overview & Architecture

## 1. Vision

**DailyTickers AutoTrader** is a fully automated trading SaaS platform that transforms daily market scans into executed broker orders across N trading modes × X broker accounts — with zero manual intervention after initial configuration.

The system currently operates as a collection of Node.js scripts orchestrated by a Claude Code agent. This PRD suite specifies the extraction of all logic into a standalone, deterministic, multi-tenant SaaS platform.

## 2. System Boundaries

```
┌─────────────────────────────────────────────────────────────────────┐
│                     DailyTickers AutoTrader                         │
│                                                                     │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────────┐    │
│  │ PRD-01   │   │ PRD-02   │   │ PRD-03   │   │ PRD-12       │    │
│  │ Market   │──▶│ Signal   │──▶│ Risk     │   │ MCP          │    │
│  │ Data     │   │ Gen      │   │ Mgmt     │   │ Orchestrator │    │
│  └──────────┘   └──────────┘   └──────────┘   └──────┬───────┘    │
│       │              │              │                  │            │
│       ▼              ▼              ▼                  ▼            │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────────┐    │
│  │ PRD-04   │   │ PRD-05   │   │ PRD-06   │   │ PRD-07       │    │
│  │ Portfolio │──▶│ Position │──▶│ Order    │──▶│ Broker       │    │
│  │ Sim      │   │ Tracking │   │ Execution│   │ Adapters     │    │
│  └──────────┘   └──────────┘   └──────────┘   └──────────────┘    │
│       │              │              │                  │            │
│       ▼              ▼              ▼                  ▼            │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────────┐    │
│  │ PRD-10   │   │ PRD-11   │   │ PRD-09   │   │ PRD-08       │    │
│  │ API      │   │ Dashboard│   │ Notifs   │   │ Instrument   │    │
│  │ Layer    │   │ UI       │   │          │   │ Registry     │    │
│  └──────────┘   └──────────┘   └──────────┘   └──────────────┘    │
│                                                                     │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐                       │
│  │ PRD-13   │   │ PRD-14   │   │ PRD-15   │   ┌──────────────┐    │
│  │ Mode     │   │ User     │   │ Scheduler│   │ PRD-16       │    │
│  │ Config   │   │ Mgmt     │   │          │   │ QA           │    │
│  └──────────┘   └──────────┘   └──────────┘   └──────────────┘    │
└─────────────────────────────────────────────────────────────────────┘

External Dependencies:
  ├── DailyTickers MCP Gateway (market data, screeners, risk metrics)
  ├── Yahoo Finance (live prices via CORS proxy)
  ├── Binance API (crypto prices, order execution)
  ├── Broker APIs (Alpaca, IBKR, Saxo, Trading212)
  ├── Telegram / Discord (notifications)
  ├── systematic-tss Go Engine (60+ mechanical scanners, stdio JSON-RPC bridge)
  └── BVC API (Casablanca Bourse, Moroccan equities)
```

## 3. Domain Model

### 3.1 Core Entities

| Entity | Description | Primary Key |
|--------|-------------|-------------|
| **Signal** | A scored trading setup from the scanner | `{ticker, scanDate}` |
| **Mode** | A trading strategy configuration (e.g., turbo, balanced) | `modeId` |
| **Position** | An active trade in a specific mode | `{ticker, scanDate, modeId}` |
| **Trade** | A completed position with entry/exit data | `{ticker, scanDate, modeId, exitDate}` |
| **Plan** | Generated orders for a mode×broker pair | `{modeId, brokerId, date}` |
| **Order** | A single broker order (entry, SL, TP) | `{planId, orderId}` |
| **Account** | A user's broker account | `{userId, brokerId}` |
| **Instrument** | A tradable symbol with broker-specific mappings | `internalSymbol` |

### 3.2 Aggregate Boundaries

- **Scanner Aggregate**: Signals + TKL Pool for a given scan date
- **Portfolio Aggregate**: Mode config + positions + trades + equity curve
- **Execution Aggregate**: Plan + orders + fills + bracket exits
- **User Aggregate**: Account + subscriptions + broker links

## 4. Data Flow — End-to-End Pipeline

```
Phase 1: COLLECT (PRD-01, PRD-12)
  MCP Gateway ──▶ Market Overview + Screener Results + Regime Probability
  
Phase 2: GENERATE (PRD-02)
  Screener Results ──▶ Score + Validate + Filter ──▶ signals.json (10 A+ + 20 TKL)

Phase 3: GATE (PRD-03)
  signals.json ──▶ Regime Check + Correlation + Earnings + Sizing ──▶ gated signals

Phase 4: SIMULATE (PRD-04)
  All historical signals ──▶ Walk-forward backtest ──▶ backtest-trades.json + equity curves

Phase 5: TRACK (PRD-05)
  Yahoo Finance prices ──▶ Update exits (SL/TP/expiry) ──▶ scanner-positions.json

Phase 6: PLAN (PRD-06)
  gated signals + mode config + positions ──▶ trading-plan-{mode}-{broker}.json

Phase 7: EXECUTE (PRD-06, PRD-07)
  trading-plan ──▶ Broker Adapter ──▶ Orders submitted + brackets placed

Phase 8: REPORT (PRD-09, PRD-10, PRD-11)
  Execution results ──▶ Telegram + Dashboard + API endpoints
```

## 5. Trading Modes (6)

| Mode | Slots | Horizon | Risk | Key Feature |
|------|-------|---------|------|-------------|
| **Turbo** | 1 | 2d | Extreme | Max alpha, aggressive rotation, BE at +0.5% |
| **Dynamic** | 1 | 2d | High | All strategies, daily rotation, VIX kill 25 |
| **Balanced** | 3 | 5d | Medium | Momentum only, DD breaker 5%, cross-mode dedup |
| **Secured** | 2 | 5d | Low | Capital preservation, sector cap 1, VIX kill 22 |
| **Fortress** | 4 | 8d | Ultra-Low | Half-size positions, trailing stop, VIX kill 20 |
| **TKL** | 5 | 5d | Medium | Small/mid-cap momentum, extended universe |

## 6. Broker Adapters (6)

| Broker | Markets | Auth | Special |
|--------|---------|------|---------|
| **Paper** | All | None | Simulation mode, full notification flow |
| **Alpaca** | US Equities | API key + secret | Paper/live toggle |
| **IBKR** | Global | Gateway host:port + account ID | Localhost gateway required |
| **Saxo** | EU/Global | OAuth token + account key | UIC-based instrument IDs |
| **Trading212** | EU | API key | No quote API, London-listed ETF suffixes |
| **Binance** | Crypto | API key + secret | 24/7, testnet toggle, TKL mode only |

## 7. Technology Stack (Target)

| Layer | Current | Target SaaS |
|-------|---------|-------------|
| Runtime | Node.js scripts | Go single binary (API + pipeline + scheduler) |
| Orchestration | Claude Code agent | Embedded pipeline scheduler (PRD-15) |
| Storage | JSON files on disk | SQLite + Litestream replication (or Oracle Autonomous DB free tier) |
| API | Static JSON files on GitHub Pages | REST API (Go stdlib net/http or chi) |
| UI | Server-rendered HTML | React dashboard on GitHub Pages (PRD-11) |
| Auth | None | JWT + OAuth2 (PRD-14) |
| Hosting | GitHub Pages + local scripts | Oracle Cloud Always Free (ARM A1: 4 OCPUs, 24GB RAM, 200GB disk) |
| CDN | None | AWS CloudFront free tier (1TB/month, 10M requests) |
| Cache | None | Redis on same VM (in-process memory L1 + local Redis L2) |
| CI/CD | Manual | GitHub Actions (2,000 min/month free) |
| MCP | Direct MCP tool calls | MCP Orchestration layer (PRD-12) |
| Notifications | Telegram + Discord | Telegram Bot API (free) + Discord webhooks (free) |

### 7.1 Deployment Diagram

```
┌─────────────────────────────────────────────────────────┐
│           Oracle Cloud Always Free (ARM A1)              │
│           4 OCPUs · 24 GB RAM · 200 GB disk              │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │         Single Go Binary                          │    │
│  │  ┌────────────┐  ┌──────────────┐  ┌──────────┐  │    │
│  │  │  REST API   │  │  Pipeline    │  │ Scheduler│  │    │
│  │  │  (port 8080)│  │  Engine      │  │ (cron)   │  │    │
│  │  └────────────┘  └──────────────┘  └──────────┘  │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Redis   │  │  SQLite DB   │  │  Object Storage  │   │
│  │ (local)  │  │  + Litestream│  │  (Oracle 10GB)   │   │
│  └──────────┘  └──────────────┘  └──────────────────┘   │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTPS
              ┌─────────▼──────────┐
              │  AWS CloudFront    │
              │  (CDN, free tier)  │
              └─────────┬──────────┘
                        │
              ┌─────────▼──────────┐
              │  GitHub Pages      │
              │  (React dashboard) │
              └────────────────────┘
```

## 8. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Pipeline latency (scan → orders) | < 5 minutes |
| Order execution window | Market open ± 30 min |
| Data freshness (prices) | < 5 min during market hours |
| Uptime | 99.5% during market hours |
| Concurrent users | ~25 (personal + invited users) |
| Modes per user | 1-6 selectable |
| Brokers per user | 1-5 linkable |

## 9. PRD Dependency Graph

```
PRD-19 (Shared Data) ──▶ PRD-12 (MCP Orch) ──▶ PRD-01 (Market Data) ──▶ PRD-02 (Signals) ──▶ PRD-03 (Risk)
                                                                                                      │
PRD-13 (Modes) ──▶ PRD-04 (Simulation) ◀──────────────────────────────────────────────────────────────┘
                        │
                        ▼
PRD-08 (Instruments) ──▶ PRD-06 (Execution) ──▶ PRD-07 (Brokers)
                              │
PRD-05 (Tracking) ◀──────────┘
                              │
                              ▼
                   PRD-22 (Notification Hub) ──▶ PRD-09 (Channel Dispatch)
                   PRD-10 (API)
                   PRD-11 (Dashboard)

PRD-18 (Security) ──▶ PRD-14 (Users) ──▶ PRD-15 (Scheduler) ──▶ PRD-16 (QA)

PRD-04 (Simulation) ──▶ PRD-17 (Strategy Discovery) ──▶ PRD-20 (MCP Strategy)
PRD-23 (Mechanical) ──▶ PRD-17 (Strategy Discovery)
PRD-23 (Mechanical) ──▶ PRD-06 (Execution)
PRD-10 (API) ──▶ PRD-21 (MCP User-Facing)

PRD-04 (Simulation) ──▶ PRD-24 (Analytical Data Layer)
PRD-02 (Signals) ──▶ PRD-24 (Analytical Data Layer)
PRD-17 (Strategy Discovery) ◀── PRD-24 (Analytical Data Layer)
PRD-20 (MCP Strategy) ◀── PRD-24 (Analytical Data Layer)
PRD-25 (AI-First) ──▶ PRD-12 (MCP Orch)
PRD-25 (AI-First) ──▶ PRD-23 (Mechanical)
PRD-25 (AI-First) ──▶ PRD-24 (Analytical)
```

## 10. Glossary

| Term | Definition |
|------|-----------|
| **Signal** | A scored setup (ticker + entry/stop/TP levels) from the scanner |
| **Mode** | A named strategy configuration with specific risk/return profile |
| **Sweep** | Grid search optimization over mode parameters |
| **VWAP Gate** | Entry filter: effective entry = min(open, VWAP) clamped to day low |
| **DD Breaker** | Circuit breaker that halts trading when drawdown exceeds threshold |
| **VIX Kill** | Shuts down entries when VIX exceeds mode-specific threshold |
| **Regime** | Market state classification: RISK-ON, NEUTRAL, EARLY RISK-OFF, RISK-OFF, RECOVERY |
| **TKL Pool** | Extended universe of small/mid-cap momentum signals |
| **Bracket Order** | Entry order with attached stop-loss and take-profit orders |
| **Rotation** | Closing worst position to enter a better-scoring candidate |
| **MtM** | Mark-to-Market: unrealized P&L based on current prices |
| **Partial TP** | Selling 50% at TP1, trailing remainder to TP2 |
| **Breakeven** | Moving stop-loss to entry price after position gains X% |
| **Cross-mode Dedup** | Preventing same ticker from appearing in multiple modes |
| **Sharia Compliant** | Meets AAOIFI Islamic finance criteria (debt ratio, sector, interest) |
| **Mechanical Strategy** | Go-based systematic strategy from systematic-tss — implements the unified Strategy interface via Go bridge |
| **Allocation** | A capital slice assigned to a specific mechanical strategy + region + broker |
| **Adaptive Fractal PM** | Position manager with dynamic ATR stops, partial TP, breakeven, circuit breaker |
| **Scanner (Go)** | OpportunityScanner interface — produces scored entry signals from OHLCV data |
| **BVC** | Bourse de Casablanca — Moroccan equity exchange with JSON:API data provider |
| **StrategySlot** | Unified concept replacing Mode + Allocation — a capital slice bound to a strategy, risk params, and broker |
| **Skill** | Reusable agent workflow defined in SKILL.md (oz-skills format) — teaches AI agents domain-specific procedures |
| **Agentic Pattern** | Architectural pattern for AI agent systems: prompt chaining, routing, reflection, tool use, etc. (21 patterns from Agentic Design Patterns) |
| **.mcp.json** | Project-level MCP server configuration file listing all available tool servers |

## 11. Extended PRDs (SaaS & Infrastructure)

| PRD | Module | Purpose |
|-----|--------|---------|
| **17** | Strategy Discovery & Research | Backtesting, grid search, walk-forward, strategy lab, A/B comparison |
| **18** | Security & Access Control | API security (JWT/API keys), MCP access control, credential encryption, audit logging |
| **19** | Shared Market Data Layer | Mutualized data access, multi-tier cache (L1 memory → L2 Redis → L3 origin), quote aggregator |
| **20** | MCP Server — Strategy Analysis | Internal MCP server exposing RunBacktest, OptimizeStrategy, CompareStrategies to LLM agents |
| **21** | MCP Server — User Facing | User-scoped MCP server for portfolio queries, trade explanations, alerts via LLM chat |
| **22** | Multi-Channel Notification Hub | Unified Slack + Telegram + Discord + Email + Webhooks with per-user routing, templates, quiet hours |
| **23** | Unified Strategy Engine | Strategy interface, StrategySlot config, Go bridge (stdio JSON-RPC), 60+ scanners, 12+ PMs, hierarchical risk, plugin architecture |
| **24** | Analytical Data Layer | Cube.dev-like semantic layer, dbt-style transformations (staging → intermediate → marts), 6 OLAP cubes, pre-aggregated marts, MCP query tools (QueryAnalytics, GetMart, DiscoverStrategy) |
| **25** | AI-First Development | Skills catalog (oz-skills format), CLAUDE.md per module, .mcp.json, agentic design patterns, plugin architecture |
