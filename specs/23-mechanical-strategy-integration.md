# PRD-23: Unified Strategy Engine

## 1. Purpose

Define the **unified strategy engine** that makes scanner-based strategies (MCP-driven, Node.js) and mechanical strategies (Go-based, systematic-tss) **indistinguishable** from the perspective of the execution pipeline, position tracker, API layer, and dashboard.

The platform supports ONE abstraction — a **StrategySlot** — that binds a strategy implementation to capital, risk parameters, and a broker account. Whether the strategy is an MCP screener, a Go momentum scanner, an ML model, or a manual signal source, the downstream pipeline is identical.

### 1.1 What This Replaces

The previous design treated scanner and mechanical as **two parallel pipelines** with a Signal Merger that normalized and deduplicated between them. This created:

- Two signal formats requiring normalization
- A Signal Merger component that exists only because the pipelines don't share a contract
- Duplicated broker adapters (Go has its own Alpaca/IBKR/Saxo/T212/Binance)
- Two position tracking systems
- Two configuration models (JSON modes + YAML allocations)
- Two backtesting engines with incomparable outputs

The unified design eliminates these by defining a single `Strategy` interface that all signal sources implement.

### 1.2 Core Design Decision: Bridge, Don't Rewrite

The Go engine (`systematic-tss`) contains ~20K LOC of battle-tested scanners, position managers, and backtesting logic. **We do not rewrite it in TypeScript.** Instead, we define a TypeScript-native `Strategy` interface and provide a **Go Bridge adapter** that wraps the Go engine behind that same interface.

## 2. Scope

### In Scope
- Universal Strategy interface and StrategySlot configuration
- Go Bridge (stdio JSON-RPC) wrapping all 60+ mechanical scanners
- Unified Signal format consumed by all downstream components
- Hierarchical risk management (portfolio → slot → position)
- Unified backtesting API (dual engine, single output schema)
- Plugin architecture for adding new strategy types
- Full scanner and position manager catalogs (8 asset classes)
- BVC (Bourse de Casablanca) data provider

### Out of Scope
- Rewriting Go engine in Node.js (keep Go runtime)
- Live intraday strategies (daily timeframe only for v1)
- Changing existing scanner validation pipeline (PRD-02 — wrapped, not modified)

---

## 3. Interface Definitions

### 3.1 Signal — The Universal Currency

Every strategy type produces `Signal[]`. This is the ONLY format that flows into risk gating, plan generation, execution, position tracking, and reporting.

```typescript
interface Signal {
  // Identity
  ticker: string;
  scanDate: string;             // ISO date YYYY-MM-DD

  // Scoring (unified 0-100 scale)
  score: number;                // 0-100, comparable within a slot (NOT across slots)
  confluence: string[];         // factors that contributed to the score

  // Trade levels
  entry: number;
  stop: number;
  tp1: number;
  tp2?: number;
  rrNumeric: number;            // risk/reward ratio from entry midpoint

  // Classification
  strategy: string;             // "Momentum" | "Breakout" | "TrendFollowing" | "MeanReversion" | ...
  region: string;               // "US" | "EU" | "APAC" | "CRYPTO" | "FOREX" | "MA" | ...
  sector: string;
  assetClass: AssetClass;

  // Risk metadata
  horizon: number;              // max hold days
  sizePct?: number;             // suggested position size (% of slot capital)
  atr?: number;
  rsi?: number;
  volatility?: number;

  // Compliance
  sharia?: boolean;
  dilutionFlag?: string | null;

  // Provenance
  source: SignalSource;
  strategySlotId: string;       // which StrategySlot produced this signal
  thesis?: string;              // human-readable trade thesis (max 200 chars)
  badges?: string[];
  invalidations?: string[];
}

type AssetClass = 'US_EQUITY' | 'EU_EQUITY' | 'UK_EQUITY' | 'APAC_EQUITY' | 'MA_EQUITY'
               | 'CRYPTO' | 'FOREX' | 'METALS' | 'ETF' | 'LEVERAGED_ETF';

type SignalSource = 'scanner' | 'mechanical' | 'ml' | 'manual';
```

**Score comparability rule**: Scores are comparable **within a slot** (same strategy, same scoring function) but NOT across slots. A scanner score of 92 and a Go score of 87 are not commensurable. Cross-slot prioritization uses portfolio-level rules (§7), not score comparison.

### 3.2 Strategy — The Universal Interface

```typescript
interface Strategy {
  /** Unique identifier: "scanner-main", "go-hybrid-v2-af", "ml-lstm-v1" */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /** Strategy type for routing and UI */
  readonly type: StrategyType;

  /** Asset classes this strategy can trade */
  readonly assetClasses: AssetClass[];

  /**
   * Initialize with historical data (for backtesting).
   * For live mode, may be a no-op.
   */
  init(context: StrategyContext): Promise<void>;

  /**
   * Generate signals for a given date.
   * Pure function of (config + market data + regime) → signals.
   * No side effects (no broker calls, no file writes).
   */
  scan(date: string, marketData: MarketData, regime: RegimeData): Promise<Signal[]>;

  /**
   * Manage existing positions: generate exit/modify actions.
   * Optional — strategies that only generate entry signals return [].
   * Strategies with built-in position management (Go PM) implement this.
   */
  manage?(positions: Position[], marketData: MarketData, regime: RegimeData): Promise<Action[]>;

  /** Teardown / cleanup */
  destroy?(): Promise<void>;
}

type StrategyType = 'scanner' | 'mechanical' | 'ml' | 'manual';

interface StrategyContext {
  config: StrategySlotConfig;
  historicalData?: Map<string, OHLCV[]>;
}
```

### 3.3 StrategySlot — The Unified Mode/Allocation Concept

A StrategySlot replaces both scanner "Modes" and mechanical "Allocations". Both are the same concept: a capital slice bound to a strategy implementation, risk parameters, and a broker account.

```typescript
interface StrategySlotConfig {
  // Identity
  id: string;                       // unique slot ID: "balanced", "us-core", "crypto-mom"
  label: string;                    // display name: "Balanced", "US Core Equities"
  color: string;                    // UI color hex
  goal: string;                     // one-line goal
  riskProfile: RiskProfile;

  // Strategy binding
  strategyId: string;               // references Strategy.id in the registry
  strategyParams: Record<string, unknown>; // strategy-specific (opaque to slot config)

  // Capital & sizing
  capitalUsd: number;
  currency: string;
  positionSizePct: number;          // position size multiplier (1.0 = standard, 0.5 = half-size)
  maxPositions: number;             // max concurrent open positions
  topN: number;                     // max candidates per scan
  minScore: number;                 // minimum signal score to enter

  // Risk management (universal)
  risk: SlotRiskConfig;

  // Execution
  brokerId: string;                 // references a broker account
  horizon: number;                  // max hold days
  rotation: RotationType;

  // Exit management
  exits: ExitConfig;

  // Regime adaptation
  regimeFilters?: Record<string, string>;  // regime → strategy filter override
  regimeSource?: RegimeSourceConfig;       // which indices drive regime for this slot

  // Notifications
  telegramTopicId?: number;

  // Feature flags
  shariaOnly?: boolean;
  tklPoolEnabled?: boolean;
  crossSlotDedup?: boolean;
}

type RiskProfile = 'extreme' | 'high' | 'medium' | 'low' | 'conservative' | 'special';
type RotationType = 'none' | 'daily_max1' | 'daily_max2' | 'aggressive';

interface SlotRiskConfig {
  ddBreakerPct: number;             // drawdown circuit breaker (0 = disabled)
  sectorCapMax: number;             // max positions per sector (0 = disabled)
  vixKillThreshold: number;         // halt entries above this VIX level (0 = disabled)
  correlationCap: number;           // max pairwise correlation (0 = disabled)
  maxSingleLossPct: number;         // max loss per position
  maxPortfolioHeatPct: number;      // max total slot risk
  dailyStopLossPct?: number;        // daily loss circuit breaker
  weeklyStopLossPct?: number;       // weekly loss circuit breaker
  circuitBreakerDays?: number;      // cooldown after circuit breaker fires
}

interface ExitConfig {
  partialTP: boolean;
  partialTPPct: number;             // fraction sold at TP1 (0.5 = 50%)
  trailingStop: boolean;
  maxStopPct: number;               // max stop distance %
  atrStopMult: number;              // ATR multiplier for stop cap
  dailyTrailPct: number;            // daily trailing stop %
  breakevenPct: number;             // move stop to entry after +X%
  staleDays: number;                // tighten stop if no new high for N days
  entryGatePct: number;             // reject if open > entry * (1 + X%)
  vwapGate: boolean;
  sizingMethod: 'inverse_atr' | 'fixed' | 'risk_parity';
  targetRiskPct: number;
}

interface RegimeSourceConfig {
  volatilityIndex: string;          // "^VIX", "^VSTOXX", etc.
  referenceIndex: string;           // "SPY", "^STOXX50E", etc.
  weight?: number;                  // blend weight vs global VIX (0-1, default 1.0)
}
```

### 3.4 StrategyRegistry

```typescript
class StrategyRegistry {
  private strategies: Map<string, Strategy> = new Map();

  register(strategy: Strategy): void;
  get(id: string): Strategy | undefined;
  list(): Strategy[];
  listByType(type: StrategyType): Strategy[];
  listByAssetClass(ac: AssetClass): Strategy[];
}
```

All strategies self-register at startup. The orchestrator, backtester, and UI query the registry to discover available strategies.

---

## 4. Strategy Implementations

### 4.1 Scanner Strategies (Node.js native)

Wraps the existing MCP-based scanner pipeline (PRD-01 + PRD-02):

```typescript
class ScannerStrategy implements Strategy {
  readonly id = 'scanner-main';
  readonly name = 'MCP Scanner (Main Pool)';
  readonly type: StrategyType = 'scanner';
  readonly assetClasses: AssetClass[] = ['US_EQUITY', 'EU_EQUITY', 'ETF'];

  async scan(date: string, marketData: MarketData, regime: RegimeData): Promise<Signal[]> {
    // 1. Call MCP RunAutoScreener + RunScreener (3 DSL + EU + APAC + ETFs)
    // 2. Run PRD-02 validation pipeline (market cap, ADV, anti-dilution, earnings)
    // 3. Score, rank, diversify
    // 4. Return Signal[] — same shape as mechanical signals
  }
  // No manage() — scanner strategies use the universal exit engine (PRD-06)
}

class ScannerTKLStrategy implements Strategy {
  readonly id = 'scanner-tkl';
  readonly name = 'MCP Scanner (TKL Pool)';
  readonly type: StrategyType = 'scanner';
  readonly assetClasses: AssetClass[] = ['US_EQUITY'];
  // Same pipeline but with TKL thresholds (lower market cap, lower ADV)
}
```

### 4.2 Go Bridge Strategy (wraps systematic-tss)

One `GoBridgeStrategy` instance per (scanner, positionManager) pair:

```typescript
class GoBridgeStrategy implements Strategy {
  readonly id: string;          // "go-hybrid-v2-af"
  readonly name: string;        // "Go hybrid-v2 + adaptive-fractal"
  readonly type: StrategyType = 'mechanical';
  readonly assetClasses: AssetClass[];

  private bridge: GoProcessBridge;
  private scannerName: string;
  private pmName: string;

  async scan(date: string, marketData: MarketData, regime: RegimeData): Promise<Signal[]> {
    const response = await this.bridge.call('scan', {
      scanner: this.scannerName,
      date,
      regime: { vix: regime.vixLevel, vix_regime: regime.currentState,
                spy_trend: regime.spyTrend },
      filters: this.config.scannerFilters,
      limit: this.config.maxCandidates || 20,
    });
    return response.opportunities.map(opp => this.toSignal(opp, date));
  }

  async manage(positions: Position[], marketData: MarketData, regime: RegimeData): Promise<Action[]> {
    if (this.pmName === 'none') return [];
    const response = await this.bridge.call('manage_positions', {
      pm: this.pmName,
      positions: positions.map(serializePosition),
      regime: serializeRegime(regime),
      config: this.config.pmConfig,
    });
    return response.actions.map(deserializeAction);
  }
}
```

### 4.3 Future: ML Strategy (same pattern)

```typescript
class MLStrategy implements Strategy {
  readonly id = 'ml-lstm-v1';
  readonly type: StrategyType = 'ml';
  async scan(...): Promise<Signal[]> { /* Call Python ML service */ }
}
```

Adding a new strategy type = implement `scan()`, register, configure a slot. No new merger, adapter, or pipeline phase.

---

## 5. Go Bridge Architecture

### 5.1 Communication: stdio JSON-RPC

The Go binary runs as an **embedded child process** (not a network sidecar), communicating via **stdin/stdout JSON-RPC**. No port management, no service discovery, lifecycle tied to the parent Node.js process.

```typescript
class GoProcessBridge {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pending: Map<number, { resolve: Function; reject: Function }> = new Map();

  async ensureRunning(): Promise<void> {
    if (this.process && !this.process.killed) return;
    this.process = spawn(GO_ENGINE_BINARY, ['--mode', 'bridge'], {
      stdio: ['pipe', 'pipe', 'inherit'],  // stdin/stdout piped; stderr to parent
    });
    // Read newline-delimited JSON responses from stdout
    const rl = readline.createInterface({ input: this.process.stdout });
    rl.on('line', (line) => {
      const msg = JSON.parse(line);
      const p = this.pending.get(msg.id);
      if (p) { this.pending.delete(msg.id); msg.error ? p.reject(msg.error) : p.resolve(msg.result); }
    });
  }

  async call(method: string, params: unknown): Promise<any> {
    await this.ensureRunning();
    const id = ++this.requestId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.process!.stdin!.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(`Timeout: ${method}`)); }
      }, 60_000);
    });
  }

  async shutdown(): Promise<void> {
    if (this.process) {
      await this.call('shutdown', {}).catch(() => {});
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }
}
```

**Singleton pattern**: All Go strategies share ONE process (multiplexed by scanner/PM name in the `method` + `params`). Go indicator caches are expensive to initialize — do it once.

### 5.2 Go JSON-RPC Methods

| Method | Params | Returns | Maps to |
|--------|--------|---------|---------|
| `scan` | `{scanner, date, regime, filters, limit}` | `{opportunities: Opportunity[]}` | `OpportunityScanner.Scan()` |
| `manage_positions` | `{pm, positions, regime, config}` | `{actions: Action[]}` | `PositionManager.ManagePositions()` |
| `backtest_init` | `{data: OHLCV[]}` | `{ok: true}` | `Strategy.BacktestInit()` |
| `backtest` | `{strategy, config, dateRange, capital}` | `{metrics, equityCurve, trades}` | Full backtest run |
| `list_scanners` | `{}` | `{scanners: string[]}` | `ScannerFactory` keys |
| `list_pms` | `{}` | `{pms: string[]}` | `PositionManagerFactory` keys |
| `health` | `{}` | `{status, version, scanners, pms}` | Health check |
| `shutdown` | `{}` | `{ok: true}` | Graceful exit |

### 5.3 Go Engine Changes Required

Add a `--mode bridge` flag that starts a stdio JSON-RPC server:

```go
// cmd/live/main.go — add bridge mode
case "bridge":
    scanner := bufio.NewScanner(os.Stdin)
    for scanner.Scan() {
        req := parseJSONRPC(scanner.Text())
        result, err := dispatch(req.Method, req.Params)
        resp := jsonrpc.Response{ID: req.ID, Result: result, Error: err}
        fmt.Fprintln(os.Stdout, marshal(resp))
    }
```

### 5.4 What Stays in Go

- All 18+ scanners and their implementations (§9)
- All 12+ position managers and their implementations (§10)
- Technical indicator calculations (§12)
- Backtesting engine (for Go-native strategies)
- BVC data provider
- Regime detection logic

### 5.5 What Moves to Node.js (or Becomes Unnecessary)

| Component | Status | Replacement |
|-----------|--------|-------------|
| Go HTTP server (`/scan`, `/backtest`) | **Replaced** | stdio JSON-RPC bridge |
| Go broker adapters (in SaaS mode) | **Removed** | Node.js `@dt/execution` (PRD-07) |
| YAML config parser | **Simplified** | `strategyParams` in unified config (Node.js parses, Go receives pre-parsed) |
| Signal Merger & Deduplication | **Removed** | Orchestrator cross-slot dedup (§6) |
| Score normalization layer | **Removed** | Each strategy normalizes to 0-100 at its boundary |
| `unified-signals.json` | **Removed** | Each slot produces `Signal[]` independently |
| `mechanical_signals` DB table | **Removed** | Unified `signals` table with `strategy_slot_id` |
| `mechanical_positions` DB table | **Removed** | Unified `positions` table with `strategy_slot_id` |

---

## 6. Unified Pipeline (Data Flow)

```
                    ┌─────────────────────────────────────────────┐
                    │           Strategy Registry                  │
                    │                                              │
                    │  scanner-main ──┐                            │
                    │  scanner-tkl  ──┤  all implement             │
                    │  go-hybrid-v2 ──┤  Strategy.scan()           │
                    │  go-crypto-adv ─┤  → Signal[]                │
                    │  go-forex     ──┤                            │
                    │  go-metals    ──┤                            │
                    │  ml-lstm-v1   ──┘                            │
                    └────────────────┬────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────┐
│                         Orchestrator                                │
│                                                                     │
│  For each StrategySlot:                                             │
│    1. Get strategy from registry by slot.strategyId                 │
│    2. Collect market data (PRD-01/Yahoo/Go bridge per asset class)  │
│    3. Get regime data (slot.regimeSource → VIX/VSTOXX/DXY/BTC)     │
│    4. strategy.scan(date, marketData, regime) → Signal[]            │
│    5. Apply slot-level filters:                                      │
│       - minScore gate                                                │
│       - regime filter overrides                                      │
│       - VIX kill switch                                              │
│       - DD circuit breaker                                          │
│       - sector cap                                                   │
│       - correlation cap                                              │
│    6. Sort by score, take topN                                       │
│    7. If strategy.manage exists: call for position exit actions     │
│    8. Output: Signal[] for this slot                                │
│                                                                     │
│  Cross-slot processing:                                              │
│    - Cross-slot dedup (if enabled): same ticker → keep highest cap  │
│    - Portfolio-level risk checks (§7)                               │
│                                                                     │
│  Output: Map<slotId, Signal[]>                                      │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│                     Risk Gating (PRD-03, enhanced §7)               │
│                                                                     │
│  Per-slot:                                                          │
│    - RegimeProbability (regional source per slot)                   │
│    - CorrelationMatrix (within slot + cross-slot overlay)           │
│    - EarningsCalendar (equities only, skip forex/metals/crypto)    │
│    - OptimizeSizing (slot-level caps, PM proposes, gate constrains)│
│                                                                     │
│  Portfolio-level:                                                    │
│    - Aggregate exposure check                                       │
│    - Cross-slot ticker dedup                                        │
│    - Cross-slot sector concentration                                │
│    - Portfolio drawdown breaker                                     │
│                                                                     │
│  Output: Map<slotId, GatedSignal[]>                                 │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│                  Plan Generation (PRD-06)                           │
│                                                                     │
│  For each slot × broker:                                            │
│    - Generate trading-plan JSON (same schema for all strategies)   │
│    - Include entry orders + close_now + bracket exits               │
│    - Resolve broker-specific symbols (instrument registry PRD-08)  │
│                                                                     │
│  Output: TradingPlan per (slotId, brokerId)                        │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│               Execution Engine (PRD-06 + PRD-07)                    │
│                                                                     │
│  ONE engine, ONE set of broker adapters                             │
│  Same 6-phase lifecycle for ALL strategy types:                    │
│    INIT → PRE_MARKET → OPEN_SESSION → MONITOR → CLOSE → DONE      │
│                                                                     │
│  No strategy-specific execution logic — it's all in the plan JSON  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│           Position Tracking + Reporting (PRD-05/09/10/11)           │
│                                                                     │
│  ONE position tracker (unified-positions.json):                    │
│    - Tracks all open positions regardless of source strategy       │
│    - Each position tagged with strategySlotId for attribution      │
│    - Yahoo Finance price feed for all positions                    │
│                                                                     │
│  ONE API layer:                                                     │
│    - /portfolio/v1/{slotId}/[signals|positions|equity|...].json    │
│    - Same endpoints whether slot is scanner or mechanical          │
│                                                                     │
│  ONE notification hub:                                              │
│    - Per-slot Telegram topic routing                                │
│    - Same message format for all strategy types                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 7. Hierarchical Risk Management

### 7.1 Three-Layer Architecture

```
Portfolio-Level Risk (highest priority, overrides everything)
├── Aggregate drawdown breaker: -15% portfolio → HALT ALL slots
├── Aggregate VIX kill: VIX > 40 → HALT ALL new entries
├── Aggregate daily loss: -5% portfolio in one day → HALT ALL
├── Cross-slot ticker cap: max 15% of total portfolio in one ticker
├── Cross-slot sector cap: max 40% of total portfolio in one sector
├── Cross-slot correlation: max 0.80 pairwise across all slots
│
Slot-Level Risk (per-slot, independent)
├── VIX kill per slot (turbo=28, dynamic=25, secured=22, fortress=20, ...)
├── DD breaker per slot (turbo=4%, balanced=8%, us-core=15%)
├── Sector cap per slot
├── Correlation cap per slot
├── Daily/weekly stop-loss (mechanical slots)
├── Circuit breaker cooldown (mechanical slots)
│
Position-Level Risk (per-position)
├── Max loss per trade (max_loss_pct)
├── Max stop distance (max_stop_dist_pct)
├── Stale position tightening
├── Breakeven trigger
└── SL cooldown per ticker (10 days after stop-out)
```

### 7.2 Portfolio-Level Configuration

```json
{
  "portfolio_limits": {
    "max_total_positions": 30,
    "max_total_exposure_pct": 100,
    "max_single_ticker_exposure_pct": 15,
    "max_sector_exposure_pct": 40,
    "max_cross_slot_correlation": 0.80,
    "max_single_asset_class_pct": 60,
    "max_drawdown_pct": 15,
    "max_daily_loss_pct": 5,
    "vix_nuclear_kill": 40
  }
}
```

### 7.3 Risk Gate Application Rules

**Gate 1 — Regime Gating: per-slot with regional adaptation**

Each slot specifies its `regimeSource`:
| Slot Type | Volatility Index | Reference Index |
|-----------|-----------------|-----------------|
| US equity slots | ^VIX | SPY |
| EU equity slots | ^VSTOXX | ^STOXX50E |
| Forex slots | DXY + VIX composite | — |
| Crypto slots | BTC dominance + VIX | BTC-USD |
| Metals slots | GLD momentum + VIX | GLD |
| BVC slots | VIX (proxy, 0.6 weight) | MASI |

**Gate 2 — Correlation: per-slot AND cross-slot**

Within a slot: enforce `slot.risk.correlationCap` on slot's own positions. Across slots: enforce `portfolio_limits.max_cross_slot_correlation`. If `balanced` holds NVDA and `us-core` wants AMD, cross-slot correlation check flags it.

**Gate 3 — Earnings Filter: asset-class-aware**

Applied to equity slots only. Skip for forex, metals, crypto, BVC. Apply with regional calendar for US/EU/UK equity slots.

**Gate 4 — Position Sizing: slot proposes, portfolio constrains**

For scanner slots: `inverse_atr` sizing via `OptimizeSizing` MCP. For mechanical slots: Go PM's sizing (more sophisticated — knows holding period, TP dynamics). The portfolio-level gate **constrains** but does not **replace** the slot's sizing: `final_size = min(slot_proposed_size, portfolio_cap)`.

### 7.4 Cross-Slot Position Rules

**Same ticker from multiple slots**:
1. Both slots enter independently — each gets its own position with its own exit logic
2. Total combined size capped by `max_single_ticker_exposure_pct`
3. If cap would be exceeded: higher-priority slot gets full allocation, lower gets reduced
4. Priority: user-configurable per slot, default = capital-weighted

**Same ticker stopped out by 2+ slots within 5 days**: add to portfolio-level cooldown (7 days, all slots).

### 7.5 Circuit Breaker Coordination

When one slot's circuit breaker fires: notify all other slots (informational). If 3+ slots fire circuit breakers on the same day: escalate to portfolio-level halt (correlated stress event).

### 7.6 Virtual Position Tracking

If two slots share the same broker account, the broker sees ONE position (sum). Track "virtual positions" per slot internally. When slot A exits its 27 shares, sell 27 shares but slot B's 50 shares remain intact.

**Production recommendation**: Use different broker accounts per slot for clean isolation.

---

## 8. Configuration Schema

### 8.1 Unified Strategy Slots Config

Replaces both `modes-config.json` and YAML allocations in a single JSON file:

```json
{
  "_version": "v6.0-20260507",
  "_regime": "RISK-ON",
  "_updated": "2026-05-07",

  "portfolio_limits": {
    "max_total_positions": 30,
    "max_single_ticker_exposure_pct": 15,
    "max_sector_exposure_pct": 40,
    "max_drawdown_pct": 15,
    "vix_nuclear_kill": 40
  },

  "slots": {
    "turbo": {
      "label": "Turbo",
      "color": "#f59e0b",
      "goal": "Maximum Short-Term Alpha",
      "riskProfile": "extreme",
      "strategyId": "scanner-main",
      "strategyParams": {},
      "capitalUsd": 10000,
      "currency": "USD",
      "positionSizePct": 1.0,
      "maxPositions": 1,
      "topN": 1,
      "minScore": 90,
      "horizon": 2,
      "rotation": "aggressive",
      "brokerId": "alpaca",
      "risk": {
        "ddBreakerPct": 4,
        "sectorCapMax": 1,
        "vixKillThreshold": 28,
        "correlationCap": 0,
        "maxSingleLossPct": 3,
        "maxPortfolioHeatPct": 10
      },
      "exits": {
        "partialTP": true, "partialTPPct": 0.5,
        "trailingStop": false, "maxStopPct": 0,
        "atrStopMult": 0, "dailyTrailPct": 2,
        "breakevenPct": 0.5, "staleDays": 0,
        "entryGatePct": 0, "vwapGate": true,
        "sizingMethod": "inverse_atr", "targetRiskPct": 1
      },
      "regimeFilters": {
        "risk_on": "all", "early_risk_off": "breakout_only",
        "risk_off": "breakout_only", "neutral": "mom_bo", "recovery": "mom_bo"
      },
      "tklPoolEnabled": true,
      "telegramTopicId": 89
    },

    "us-core": {
      "label": "US Core Equities",
      "color": "#2563eb",
      "goal": "Systematic US equity trend following",
      "riskProfile": "medium",
      "strategyId": "go-hybrid-v2-af",
      "strategyParams": {
        "scannerFilters": {
          "minPrice": 2.0, "maxVolatility": 0.20, "maxAtrRatio": 0.15,
          "aboveSma200": true, "minP80DollarVolume": 1000000
        },
        "pmConfig": {
          "maxOpenPositions": 10, "baseStopAtr": 2.0, "maxStopAtr": 3.5,
          "maxLossPct": 0.10, "dynamicTakeProfitPct": 0.35,
          "partialTpPct": 50, "breakevenTriggerPct": 0.05,
          "autoReentry": true, "autoReentryBoost": 1.5
        },
        "regimeTickers": { "volatility": "^VIX", "index": "SPY" }
      },
      "capitalUsd": 100000,
      "currency": "USD",
      "positionSizePct": 1.0,
      "maxPositions": 10,
      "topN": 20,
      "minScore": 35,
      "horizon": 20,
      "rotation": "none",
      "brokerId": "ibkr",
      "risk": {
        "ddBreakerPct": 15, "sectorCapMax": 3, "vixKillThreshold": 0,
        "correlationCap": 0.70, "maxSingleLossPct": 10, "maxPortfolioHeatPct": 20,
        "dailyStopLossPct": 5, "weeklyStopLossPct": 10, "circuitBreakerDays": 5
      },
      "exits": {
        "partialTP": true, "partialTPPct": 0.5,
        "trailingStop": false, "maxStopPct": 12,
        "atrStopMult": 3.0, "dailyTrailPct": 0,
        "breakevenPct": 5, "staleDays": 3,
        "entryGatePct": 0, "vwapGate": false,
        "sizingMethod": "risk_parity", "targetRiskPct": 2
      },
      "regimeSource": { "volatilityIndex": "^VIX", "referenceIndex": "SPY" },
      "telegramTopicId": 92
    },

    "crypto-momentum": {
      "label": "Crypto Momentum",
      "color": "#d97706",
      "goal": "Crypto momentum with BTC relative strength",
      "riskProfile": "high",
      "strategyId": "go-crypto-advanced",
      "strategyParams": {
        "whitelist": ["BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD", "ADA-USD"],
        "isCrypto": true
      },
      "capitalUsd": 25000,
      "currency": "USD",
      "positionSizePct": 1.0,
      "maxPositions": 5,
      "topN": 10,
      "minScore": 30,
      "horizon": 10,
      "rotation": "daily_max1",
      "brokerId": "binance",
      "risk": {
        "ddBreakerPct": 20, "sectorCapMax": 0, "vixKillThreshold": 0,
        "correlationCap": 0, "maxSingleLossPct": 15, "maxPortfolioHeatPct": 100
      },
      "exits": {
        "partialTP": true, "partialTPPct": 0.5,
        "trailingStop": true, "maxStopPct": 0,
        "atrStopMult": 2.0, "dailyTrailPct": 0,
        "breakevenPct": 3, "staleDays": 0,
        "entryGatePct": 0, "vwapGate": false,
        "sizingMethod": "inverse_atr", "targetRiskPct": 2
      },
      "regimeSource": { "volatilityIndex": "^VIX", "referenceIndex": "BTC-USD" },
      "telegramTopicId": 93
    }
  }
}
```

### 8.2 Key Design Choice: Opaque `strategyParams`

The `strategyParams` field is free-form JSON whose schema depends on `strategyId`:
- `scanner-*` strategies: screener DSL queries, pool selection
- `go-*` strategies: `scannerFilters`, `pmConfig`, `regimeTickers`, `whitelist`
- `ml-*` strategies: model paths, feature configs

The slot config handles **universal concerns** (capital, risk, exits, regime) while `strategyParams` handles **strategy-specific concerns**. Adding a new strategy type never changes the slot config schema.

---

## 9. Scanner Catalog (Complete)

### 9.1 Scanner Architecture

Every scanner implements the Go `OpportunityScanner` interface:

```go
type OpportunityScanner interface {
    Name() string
    Init(fullMkData map[string][]ohlcv.OHLCV) error
    Scan(mkData MkData, regime *RegimeData, limit int) []Opportunity
    SetFilters(filters *ScannerFilterConfig)
}
```

**Strategy = Scanner + PositionManager** (pluggable composition).

### 9.2 Scanner Factory (18 registered + 43 regional variants)

#### Core Scanners (in ScannerFactory)

| Scanner | Type | Markets | Key Logic |
|---------|------|---------|-----------|
| `dsl` | Technical/DSL | All equities | Configurable DSL expressions via `expr` library. Default: RSI < 50, volume above avg |
| `adaptive-fractal` | Momentum/Fractal | All equities | Price > SMA200, RSI 30-80, Mom10 > 1%, Vol < 15%, ATR < 12%, VolRatio > 0.5, VIX-adaptive candidate cap |
| `hybrid` | Regime-switching | All equities | VIX < 20 → use AF (momentum); VIX >= 20 → use DSL (mean reversion) |
| `hybrid-v2` | Enhanced hybrid | All equities | Same as hybrid + VolRatio scoring boost (targets 3.35+) |
| `mega-cap` | Large-cap | US equities | Market cap > $100B filter + momentum |
| `highvol` | High volatility | US equities | Targets stocks with 20+ ATR volatility |
| `ultra-momentum` | Extreme momentum | US equities | Mom10 > Mom60 > Mom120 (triple acceleration) |
| `ultra-v5` | Aggressive V5 | US equities | Ultra-aggressive setup discovery |
| `selective` | Best-in-class | US equities | Selective candidate filtering |
| `longrunner` | Trend continuation | US equities | Long-duration trend following |
| `americanbulls` | Candlestick | All equities | Hammer, Engulfing, Pin Bar patterns + volume spike confirmation |
| `forex` | Multi-strategy FX | Forex pairs | 3-axis scoring: Momentum 40% (30/14/7d returns) + Mean Reversion 30% (BB%B, RSI, MA20 dist) + Relative Strength vs DXY 30%. Both BUY and SELL signals |
| `metals` | Rotation | Precious metals | Ranks metals ETFs/miners by momentum. GLD beta bonus. Weights: 30d 20%, 14d 50%, 7d 15%, volume 10%, MA50 dist 5% |
| `crypto-hold` | Buy & hold | Crypto | Long-term accumulation (BTC, ETH, ALT) |
| `crypto-momentum` | Momentum | Crypto | Crypto momentum detection |
| `crypto-advanced` | Multi-factor | Crypto | Momentum acceleration + relative strength vs BTC + volume surge + volatility normalization. Rejects cryptos underperforming BTC by > 10% |
| `crypto-beast` | Aggressive | Crypto | High-frequency rebalancing, aggressive entries |
| `crypto-pairs` | Pair trading | Crypto | BTC/ETH spread trading |
| `crypto-grid` | Grid trading | Crypto | Configurable grid bands |
| `crypto-buyhold` | Passive | Crypto | Passive accumulation strategy |
| `crypto-dualmode` | Dual regime | Crypto | Long/short switching by regime |
| `momentum-rotation` | Sector rotation | All | Rotate into strongest sectors by momentum |
| `etf-momentum` | ETF momentum | ETFs | ETF-based momentum scanning |
| `etf-leveraged` | Leveraged ETFs | Leveraged ETFs | Leveraged ETF strategies |

#### Regional Scanners (instantiated via slot config, not factory)

| Scanner | Region | Markets | Key Logic |
|---------|--------|---------|-----------|
| `eu-trend` | EU | Eurozone equities | Trend following with VSTOXX regime |
| `eu-breakout` | EU | Eurozone equities | Breakout patterns |
| `eu-pullback` | EU | Eurozone equities | Pullback-from-high patterns |
| `eu-dip` | EU | Eurozone equities | Dip buying in oversold conditions |
| `eu-panic` | EU | Eurozone equities | Panic-driven oversold (VIX spike) |
| `eu-highvol` | EU | Eurozone equities | High volatility momentum |
| `eu-composite` | EU | Eurozone equities | Multi-signal composite |
| `eu-robust` | EU | Eurozone equities | Robust multi-factor |
| `fr-vix-trend` | FR | French equities | VSTOXX trend following |
| `fr-outlier` | FR | French equities | Outlier momentum detection |
| `fr-momentum` | FR | French equities | French momentum |
| `fr-dip` | FR | French equities | French dip buying |
| `fr-aggro` | FR | French equities | Aggressive French scanner |
| `fr-5d` | FR | French equities | 5-day French patterns |
| `fr-optimal` | FR | French equities | Optimal parameter set |
| `uk-financials` | UK | UK equities | Financials sector focus |
| `uk-recovery` | UK | UK equities | Recovery patterns |
| `uk-panic` | UK | UK equities | Panic-driven trades |
| `uk-cluster` | UK | UK equities | Clustering analysis |
| `uk-composite` | UK | UK equities | Multi-signal composite |
| `uk-lowvol` | UK | UK equities | Low volatility |
| `br-composite` | BR | Brazil equities | Multi-signal composite |
| `ca-composite` | CA | Canada equities | Multi-signal composite |
| `in-composite` | IN | India equities | Multi-signal composite |
| `jp-recovery` | JP | Japan equities | Recovery patterns |
| `hk-highvol` | HK | Hong Kong equities | High volatility |
| `hk-codex` | HK | Hong Kong equities | Specialized codex |

#### BVC / Casablanca Bourse

Data provider for **Moroccan equities** via `api.casablanca-bourse.com`:
- Instruments fetched via BVC JSON:API (paginated, TLS)
- OHLCV data: daily bars for all listed instruments
- Symbols: ATW, BCP, IAM, etc. (ISIN-mapped)
- Can be used with any compatible scanner (e.g., `dsl`, `eu-composite`)
- Region identifier: `"MA"` (Morocco)

### 9.3 Asset Class Summary

| Asset Class | Scanners | Data Source | Regime Index | Default PM |
|-------------|----------|-------------|--------------|-----------|
| **US Equities** | dsl, af, hybrid, hybrid-v2, megacap, highvol, ultra-momentum, ultra-v5, selective, longrunner, americanbulls | Yahoo Finance, Alpaca | VIX, SPY | Adaptive Fractal |
| **EU Equities** | eu-trend, eu-breakout, eu-pullback, eu-dip, eu-panic, eu-highvol, eu-composite, eu-robust | Yahoo Finance, Saxo | VSTOXX, STOXX50E | Adaptive Fractal |
| **French Equities** | fr-vix-trend, fr-outlier, fr-momentum, fr-dip, fr-aggro, fr-5d, fr-optimal | Yahoo Finance, Saxo | VSTOXX | Adaptive Fractal |
| **UK Equities** | uk-financials, uk-recovery, uk-panic, uk-cluster, uk-composite, uk-lowvol | Yahoo Finance, T212, IBKR | VIX | Adaptive Fractal |
| **LATAM** | br-composite | Yahoo Finance | — | Adaptive Fractal |
| **Canada** | ca-composite | Yahoo Finance, Alpaca | VIX | Adaptive Fractal |
| **India** | in-composite | Yahoo Finance | — | Adaptive Fractal |
| **Japan** | jp-recovery | Yahoo Finance | — | Adaptive Fractal |
| **Hong Kong** | hk-highvol, hk-codex | Yahoo Finance | HSI | Adaptive Fractal |
| **Morocco** | (via BVC provider + any scanner) | BVC API | MASI (via VIX proxy) | Adaptive Fractal |
| **Forex** | forex | Yahoo Finance (=X pairs) | DXY | Adaptive Fractal |
| **Metals** | metals | Yahoo Finance (GLD, SLV, miners) | GLD momentum | Adaptive Fractal |
| **Crypto** | crypto-hold, momentum, advanced, beast, pairs, grid, buyhold, dualmode | Binance | BTC dominance | Crypto variants (6) |
| **ETFs** | etf-momentum, etf-leveraged | Yahoo Finance | VIX | Adaptive Fractal |

---

## 10. Position Manager Catalog

### 10.1 Adaptive Fractal Position Manager (Primary)

The default PM for all equity and forex/metals strategies.

#### Position Sizing

```
base_size = capital / max_open_positions
risk_adjusted_size = base_size × (max_loss_pct / stop_distance)
final_size = min(risk_adjusted_size, capital × max_portfolio_risk_pct)
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `max_open_positions` | 5-20 | Slots per slot |
| `max_loss_pct` | 0.10 | Max 10% loss per trade |
| `max_portfolio_risk_pct` | 0.02 | Max 2% portfolio risk per position |
| `max_stop_dist_pct` | 0.12 | Stop must be < 12% from entry |

#### Stop Loss Rules

```
entry_stop = entry_price - ATR(14) × base_stop_atr     # Default 1.5 ATR
max_stop = ATR(14) × max_stop_atr                       # Default 3.0 ATR
daily_raise = +daily_stop_raise_pct per day              # Default +0.5%/day
stale_tightening: after stale_grace_days (3) without new high,
                  raise by stale_raise_rate (0.02) with quadratic acceleration
```

#### Take Profit Rules

```
TP1 (50% exit) = entry + ATR × dynamic_take_profit_pct / 2
TP2 (remaining) = entry + ATR × dynamic_take_profit_pct
```

**Regime-adaptive TP%:**

| Regime | TP% Range |
|--------|-----------|
| RISK_ON | 30%-50% |
| NEUTRAL | 25%-35% |
| EARLY_RISK_OFF | 20%-30% |
| RISK_OFF | 15%-25% |

`entry_regime_tp: true` — use entry regime for TP calculation (not current), prevents TP trap.

#### Advanced Features

| Feature | Parameter | Default | Description |
|---------|-----------|---------|-------------|
| Breakeven trigger | `breakeven_trigger_pct` | 0.05 | Move stop to BE at +5% |
| Auto-reentry | `auto_reentry` | true | Rebuy after partial sell on new high |
| Auto-reentry boost | `auto_reentry_boost` | 1.5 | Rebuy at 150% of partial size |
| Circuit breaker | `daily_stop_loss_pct` | 0.05 | Pause after -5% daily loss |
| Circuit breaker | `weekly_stop_loss_pct` | 0.10 | Pause after -10% weekly loss |
| Cooldown | `circuit_breaker_days` | 5 | Days paused after circuit breaker |
| Min gain exit | `min_gain_pct` | 0.01 | Don't exit unless 1%+ profit |
| Mean reversion overlay | `mean_rev_max_slots` | 3 | Optional MR slots (8% capital each) |
| Mean reversion cap | `mean_rev_max_cash_pct` | 0.25 | Max 25% in MR positions |

#### Full Configuration Schema

```yaml
position_manager_config:
  max_open_positions: 15
  base_stop_atr: 1.5
  max_stop_atr: 3.0
  max_loss_pct: 0.10
  max_portfolio_risk_pct: 0.02
  max_stop_dist_pct: 0.12
  daily_stop_raise_pct: 0.005
  stale_grace_days: 3
  stale_raise_rate: 0.02
  partial_tp_pct: 50
  partial_tp_gain: 0.03
  dynamic_take_profit_pct: 0.35
  entry_regime_tp: true
  breakeven_trigger_pct: 0.05
  auto_reentry: true
  auto_reentry_boost: 1.5
  daily_stop_loss_pct: 0.05
  weekly_stop_loss_pct: 0.10
  circuit_breaker_days: 5
  max_slippage_pct: 0.005
  max_order_wait_days: 3
  mean_rev_max_slots: 3
  mean_rev_position_size_pct: 0.08
  mean_rev_max_cash_pct: 0.25
```

### 10.2 AmericanBulls Position Manager

Candlestick confirmation-based:
- Entry: on confirmed pattern + volume spike
- Partial: scale in on breakout confirmation
- Exit: at pattern target or swing high invalidation

### 10.3 Crypto Position Managers (6 variants)

| PM | Strategy | Key Logic |
|----|----------|-----------|
| `crypto-hold` | Buy & hold | Minimal management, long-term accumulation |
| `crypto-momentum` | Momentum scaling | Momentum-based size scaling + grid rebalancing |
| `crypto-grid` | Grid trading | Configurable grid bands, buy low / sell high within range |
| `crypto-rotation` | Relative strength | Rotate BTC/ETH/ALT based on RS ranking |
| `crypto-advanced` | Multi-timeframe | Regime-aware, acceleration + RS vs BTC |
| `crypto-beast` | Aggressive | High-frequency rebalancing, aggressive entries |

### 10.4 Specialized Position Managers

| PM | Description |
|----|-------------|
| `highvol-corr` | Correlation-aware sizing — avoids high-beta clustering |
| `crypto-pairs` | Pair trading (BTC/ETH spread) |
| `momentum-rotation` | Sector rotation weighting |
| `none` (NoOp) | Signals only — no position management (for scanner strategies) |
| `lego` | Pluggable exit plugin chain from YAML — compose exit rules dynamically |

---

## 11. Go Strategy Composition

Strategies compose a scanner with a position manager:

| Strategy ID | Scanner | Position Manager | Max Candidates | Markets |
|-------------|---------|------------------|----------------|---------|
| `trend` (default) | dsl | adaptive-fractal | 20 | Equities |
| `trend-dsl-af` | dsl | adaptive-fractal | 20 | Equities |
| `trend-dsl-noop` | dsl | none | 20 | Equities (signals only) |
| `trend-af-af` | adaptive-fractal | adaptive-fractal | 20 | Equities |
| `trend-af-noop` | adaptive-fractal | none | 20 | Equities (signals only) |
| `trend-hybrid-af` | hybrid | adaptive-fractal | 20 | Equities |
| `trend-hybrid-v2-af` | hybrid-v2 | adaptive-fractal | 20 | Equities |
| `trend-americanbulls` | americanbulls | americanbulls | 30 | Equities |
| `dummy` | — | — | — | Testing |

**Dynamic strategies**: Created via `CreateStrategyFromAllocation()` for regional/crypto/forex/metals by combining any scanner with any PM at runtime.

---

## 12. Technical Indicators

All indicators used by mechanical scanners:

| Indicator | Lookback | Used By | Purpose |
|-----------|----------|---------|---------|
| SMA(20) | 20d | forex, metals, AF | Short-term trend |
| SMA(50) | 50d | AF, metals, crypto | Medium-term trend |
| SMA(200) | 200d | AF, hybrid, crypto | Bull market filter |
| RSI(14) | 14d | All scanners | Momentum/overbought/oversold |
| ATR(14) | 14d | All scanners | Volatility, stop sizing |
| Momentum(10) | 10d | AF, hybrid | Short acceleration |
| Momentum(60) | 60d | AF | Medium momentum |
| Momentum(120) | 120d | AF, ultra-momentum | Long momentum (trend confirmation) |
| Bollinger %B | 20d, 2σ | forex | Mean reversion extremes |
| MACD(12,26) | 26d | DSL | Trend confirmation |
| Volume MA(20) | 20d | AF, metals, crypto | Liquidity baseline |
| Volume MA(60) | 60d | AF | Long-term volume |
| Volatility (σ) | 20d | AF, highvol | Risk measurement |
| Returns(7d/14d/30d) | 7/14/30d | forex, metals, crypto | Momentum scoring |
| Dollar Volume P80 | 20d | metals | Robust liquidity filter |

---

## 13. Regime Detection

### 13.1 Multi-Region Regime Data

```go
type RegimeData struct {
    VIX         float64   // US volatility (^VIX)
    VSTOXX      float64   // EU volatility (^VSTOXX)
    SPYTrend    string    // "UP", "DOWN", "FLAT"
    Regime      string    // "RISK_ON", "NEUTRAL", "EARLY_RISK_OFF", "RISK_OFF"
    RegimeDate  time.Time
}
```

**Regime classification:**

| Condition | Regime |
|-----------|--------|
| VIX < 15 | RISK_ON |
| 15 ≤ VIX < 25 | NEUTRAL |
| 25 ≤ VIX < 35 | EARLY_RISK_OFF |
| VIX ≥ 35 | RISK_OFF |

**Regional regime tickers (configurable per slot via `regimeSource`):**

| Region | Volatility Index | Reference Index |
|--------|-----------------|-----------------|
| US | ^VIX | SPY / ^GSPC |
| EU | ^VSTOXX | ^STOXX50E |
| UK | — (use VIX) | ^FTSE |
| HK | — | ^HSI |
| JP | — | ^N225 |
| MA | — | MASI index |
| Forex | DXY composite | — |
| Crypto | BTC dominance | BTC-USD |
| Metals | GLD momentum | GLD |

### 13.2 VIX-Adaptive Scanner Behavior

Applies to Adaptive Fractal and derived scanners:

| VIX Range | Max Candidates | Cap Filter |
|-----------|---------------|------------|
| < 30 (normal) | Unlimited | None |
| 30-40 (fear) | 10 | Large-cap only |
| > 40 (panic) | 5 | Mega-cap (>$100B) or defensive large-cap |

---

## 14. Market Data Providers

| Source | Assets | Protocol | Rate Limit |
|--------|--------|----------|------------|
| Yahoo Finance | Equities, ETFs, Forex (=X), Crypto (-USD) | HTTP REST | ~2000/hour |
| Alpaca Market Data | US equities | REST + WebSocket | 200/min (free) |
| Interactive Brokers | Global equities | TWS Gateway | Connection-based |
| Saxo OpenAPI | EU equities, FX | REST | Token-based |
| Binance | Crypto | REST + WebSocket | 1200/min |
| BVC API | Moroccan equities | JSON:API (HTTPS) | Unknown (paginated) |

### BVC (Bourse de Casablanca) Provider

```
Base URL: https://api.casablanca-bourse.com/fr/api/bourse_data
TLS: Required (skip verify for self-signed cert)

Endpoints:
  /instruments?page[size]=50&page[number]=N    → paginated instrument list
  /ohlcv/{instrument_id}?from=YYYY-MM-DD      → daily OHLCV bars

Response format: JSON:API (data[].attributes)

Instrument fields:
  - Symbol (ATW, BCP, IAM, ...)
  - InstrumentID (BVC internal, used for OHLCV queries)
  - ISIN
  - Name
```

---

## 15. Backtesting Framework

### 15.1 Dual Engine, Unified Output

Both engines are preserved behind a unified `BacktestResult` schema:

```typescript
interface BacktestRequest {
  strategy: string;           // "go-hybrid-v2-af" or "scanner-main"
  config: StrategySlotConfig;
  dateRange: { from: string; to: string };
  initialCapital: number;
  mode: "historical" | "walk-forward" | "stress-test" | "grid-search";
  gridParams?: GridSearchConfig;
}

interface BacktestResult {
  metrics: {
    totalReturn: number;
    maxDrawdown: number;
    sharpeRatio: number;
    winRate: number;
    profitFactor: number;
    calmarRatio: number;
    trades: number;
    avgHoldDays: number;
  };
  equityCurve: { date: string; equity: number }[];
  trades: TradeRecord[];
  walkForward?: { inSample: Metrics; outOfSample: Metrics };
}
```

**Go engine** (`backtest` JSON-RPC method): Full OHLCV-replay with daily step loop, SimulatedBroker, multi-currency, slippage. For mechanical strategies.

**Node.js engine** (`sweep.js`): Signal-replay from scanner signals, grid search (~311K combos), walk-forward 70/30 split. For scanner strategies.

### 15.2 Strategy Discovery Integration (PRD-17)

Strategy Lab queries both engines and compares results. Same `BacktestResult` schema makes them interchangeable from the comparison perspective. PRD-20 `CompareStrategies` MCP tool can compare scanner vs mechanical side-by-side.

### 15.3 Backtest Output Format (Go engine)

```
output/backtest/{DATE}/
├── report.html          # QuantStats-style dashboard
├── history.json         # Daily P&L + positions snapshot
├── trades.csv           # All trades (entry, exit, P&L, reason)
├── equity.csv           # Daily equity curve (NAV)
└── features.json        # ML-ready indicator snapshots
```

---

## 16. Extensibility & Plugin Architecture

### 16.1 Adding a New Strategy — 4 Steps

```typescript
// 1. Implement Strategy interface
class SentimentStrategy implements Strategy {
  readonly id = 'sentiment-reddit-v1';
  readonly type: StrategyType = 'ml';
  readonly assetClasses: AssetClass[] = ['US_EQUITY'];
  async scan(date: string, md: MarketData, regime: RegimeData): Promise<Signal[]> {
    // Fetch sentiment data, score tickers, return Signal[]
  }
}

// 2. Register it
registry.register(new SentimentStrategy());

// 3. Configure a slot (add to strategy-slots.json)
{
  "reddit-alpha": {
    "strategyId": "sentiment-reddit-v1",
    "capitalUsd": 5000,
    "maxPositions": 3,
    "brokerId": "alpaca",
    // ... standard slot config
  }
}

// 4. Done. Orchestrator, execution, tracking, API, notifications — all automatic.
```

### 16.2 Adding a New Go Scanner

```go
// 1. Implement OpportunityScanner interface
type MyScanner struct { filters *ScannerFilterConfig }
func (s *MyScanner) Name() string { return "my-scanner" }
func (s *MyScanner) Init(fullMkData map[string][]ohlcv.OHLCV) error { return nil }
func (s *MyScanner) Scan(mkData MkData, regime *RegimeData, limit int) []Opportunity { ... }
func (s *MyScanner) SetFilters(filters *ScannerFilterConfig) { s.filters = filters }

// 2. Register in ScannerFactory
func init() { RegisterScanner("my-scanner", func() OpportunityScanner { return &MyScanner{} }) }

// 3. Register composite strategy (scanner + PM)
func init() {
    RegisterStrategy("trend-myscanner-af", StrategyDef{
        Scanner: "my-scanner", PositionManager: "adaptive-fractal", MaxCandidates: 20,
    })
}
```

The Go bridge auto-discovers all registered scanners and strategies via `list_scanners` / `list_pms` JSON-RPC calls.

### 16.3 Plugin Registration Checklist

| # | Step | Required |
|---|------|----------|
| 1 | Implement `OpportunityScanner` or `Strategy` interface | Yes |
| 2 | Register in factory/registry | Yes |
| 3 | Add config template (YAML/JSON) | Yes |
| 4 | Write unit tests + fixture-based E2E test | Yes |
| 5 | Add golden files for regression | Yes |
| 6 | Update strategy catalog in this PRD | Yes |
| 7 | Run property-based invariant tests | Yes |

---

## 17. Testing & QA Framework

### 17.1 Fixture-Based Testing

Test fixtures are deterministic JSON snapshots containing all inputs for a strategy run:

```json
{
  "fixture_id": "momentum-riskon-basic-001",
  "signals": [...],
  "price_data": { "AAPL": { "2026-05-05": { "open": 194.5, "high": 197, "low": 193, "close": 196 } } },
  "config": { "portfolioSize": 3, "horizonDays": 5, "partialTP": true },
  "regime_data": { "vix": 14.5, "regime_label": "RISK-ON" },
  "expected": { "trades_count": 3, "win_rate_range": [60, 70] }
}
```

### 17.2 Universal Invariants

Must hold for ANY strategy, ANY config, ANY regime:

| Invariant | Description |
|-----------|-------------|
| No duplicate positions | One position per ticker per slot |
| Positions within limit | `openPositions.length <= maxPositions` |
| Exposure within capital | Total weight ≤ 1.0 |
| Stop below entry (long) | `stop < entry` for all signals |
| TP1 above entry (long) | `tp1 > entry` for all signals |
| R/R ≥ 1.5 | `(tp1 - entry) / (entry - stop) >= 1.5` |
| Sector cap respected | Per-sector count ≤ `sectorCapMax` |
| Exit date after entry | No time travel |
| Hold days within horizon | `holdDays <= horizon + 1` |
| Equity never negative | `equity > 0` at all points |
| Circuit breaker fires | DD breaker prevents exceeding 2× threshold |
| Higher score preferred | Higher-scoring candidates enter before lower-scoring |

### 17.3 Golden File Parity

```bash
# Generate golden outputs
node tools/generate-goldens.js --fixtures tests/fixtures/ --output tests/goldens/

# Verify Node.js engine
node tools/verify-goldens.js --goldens tests/goldens/

# Verify Go engine (cross-engine parity)
go test ./cmd/backtest/ -run TestGoldenFiles -goldens ../../articles/tests/goldens/
```

### 17.4 Extended QA Checks (adds to PRD-16)

| Check ID | Severity | Label |
|----------|----------|-------|
| 29 | ERROR | Go bridge: health endpoint responsive within 5s |
| 30 | ERROR | Signals: no duplicate tickers within any slot |
| 31 | WARN | Signals: mechanical signals present (0 = bridge may be down) |
| 32 | ERROR | Cross-slot dedup: no ticker in multiple slots (if enabled) |
| 33 | ERROR | Invariants: all universal invariants pass |
| 34 | WARN | Golden parity: last CI run passed |

### 17.5 Configuration Validation (3 layers)

| Layer | When | Catches |
|-------|------|---------|
| JSON Schema | Build time | Typos, missing fields, wrong types, out-of-range values |
| Runtime validation | Startup | Cross-field constraints (topN > maxPositions, daily > weekly stop) |
| Dry-run | Pre-execution | Data availability, broker connectivity, signal quality |

---

## 18. Database Schema (Unified)

All tables use `strategy_slot_id` instead of separate mechanical/scanner tables:

```sql
-- Strategy templates (available to all users)
CREATE TABLE strategy_templates (
  id            SERIAL PRIMARY KEY,
  strategy_id   TEXT NOT NULL UNIQUE,     -- 'go-hybrid-v2-af', 'scanner-main'
  type          TEXT NOT NULL,            -- 'scanner', 'mechanical', 'ml'
  scanner       TEXT,                     -- 'hybrid-v2' (null for scanner type)
  position_mgr  TEXT,                     -- 'adaptive-fractal' (null for scanner type)
  asset_classes TEXT[] NOT NULL,          -- '{US_EQUITY,EU_EQUITY}'
  regions       TEXT[] NOT NULL,          -- '{US,EU}'
  description   TEXT,
  default_config JSONB NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- User strategy slots (replaces both user_allocations AND implicit mode bindings)
CREATE TABLE strategy_slots (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER REFERENCES users(id),
  slot_id        TEXT NOT NULL,           -- 'balanced', 'us-core', 'crypto-mom'
  strategy_id    TEXT REFERENCES strategy_templates(strategy_id),
  label          TEXT NOT NULL,
  config         JSONB NOT NULL,          -- Full StrategySlotConfig
  broker_id      TEXT NOT NULL,
  active         BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, slot_id)
);

-- Unified signals (all sources)
CREATE TABLE signals (
  id             SERIAL PRIMARY KEY,
  scan_date      DATE NOT NULL,
  slot_id        TEXT NOT NULL,
  user_id        INTEGER REFERENCES users(id),
  ticker         TEXT NOT NULL,
  score          DECIMAL(8,2),
  source         TEXT NOT NULL,           -- 'scanner', 'mechanical', 'ml'
  entry_price    DECIMAL(12,4),
  stop_loss      DECIMAL(12,4),
  tp1            DECIMAL(12,4),
  tp2            DECIMAL(12,4),
  size_pct       DECIMAL(5,2),
  regime         TEXT,
  reasons        JSONB,
  metadata       JSONB,                   -- strategy-specific extra data
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(scan_date, slot_id, user_id, ticker)
);

-- Unified positions (all sources)
CREATE TABLE positions (
  id             SERIAL PRIMARY KEY,
  slot_id        TEXT NOT NULL,
  user_id        INTEGER REFERENCES users(id),
  ticker         TEXT NOT NULL,
  entry_date     DATE NOT NULL,
  entry_price    DECIMAL(12,4) NOT NULL,
  current_stop   DECIMAL(12,4),
  tp1_price      DECIMAL(12,4),
  tp2_price      DECIMAL(12,4),
  size           DECIMAL(12,4),
  status         TEXT DEFAULT 'open',     -- open, partial_tp, closed
  exit_date      DATE,
  exit_price     DECIMAL(12,4),
  exit_reason    TEXT,
  pnl_pct        DECIMAL(8,4),
  hold_days      INTEGER,
  source         TEXT NOT NULL,           -- 'scanner', 'mechanical', 'ml'
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Portfolio-level risk state
CREATE TABLE portfolio_risk_state (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER REFERENCES users(id),
  date           DATE NOT NULL,
  aggregate_dd   DECIMAL(8,4),
  daily_pnl      DECIMAL(8,4),
  circuit_breaker_active BOOLEAN DEFAULT false,
  breaker_slots  TEXT[],                  -- which slots triggered
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- RLS policies
ALTER TABLE strategy_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_risk_state ENABLE ROW LEVEL SECURITY;
```

---

## 19. Integration with Other PRDs

| PRD | Integration Point | Change from Previous Design |
|-----|-------------------|---------------------------|
| **PRD-02** (Signal Gen) | Scanner strategies wrap PRD-02 pipeline | No change — wrapped, not modified |
| **PRD-03** (Risk Mgmt) | 4 MCP risk gates apply per-slot + portfolio overlay | Add portfolio-level aggregation, regional regime sources |
| **PRD-04** (Simulation) | Sweep.js for scanner slots, Go bridge for mechanical | Same output schema (`BacktestResult`) |
| **PRD-05** (Tracking) | ONE position tracker, `strategy_slot_id` on each position | Replaces separate `mechanical_positions` |
| **PRD-06** (Execution) | ONE plan generator, ONE execution engine | No strategy-specific execution logic |
| **PRD-07** (Brokers) | ONE set of broker adapters (Node.js) | Go broker adapters removed in SaaS mode |
| **PRD-08** (Instruments) | Same registry, used by all slots | No change |
| **PRD-10** (API) | `/portfolio/v1/{slotId}/` endpoints for all slots | Same structure, more slots |
| **PRD-11** (Dashboard) | Unified view — scanner + mechanical slots side by side | StrategySlot replaces Mode+Allocation |
| **PRD-13** (Mode Config) | Modes = StrategySlots with `strategyId: "scanner-*"` | Modes are just slot instances |
| **PRD-15** (Scheduler) | Single pipeline phase for all strategies | No separate "mechanical scan" phase |
| **PRD-17** (Discovery) | Strategy Lab queries both engines via unified API | Same `BacktestResult` schema |
| **PRD-22** (Notifs) | Per-slot topic routing | Same, more slots possible |

---

## 20. Component Packages

```
@dt/core                    — Signal, Strategy, StrategySlotConfig, RegimeData, MarketData,
                              Position, Action, OHLCV (type definitions only, zero deps)

@dt/strategy-scanner        — ScannerStrategy, ScannerTKLStrategy, ValidationPipeline (PRD-02)
                              Depends on: @dt/core, MCP Gateway

@dt/strategy-go-bridge      — GoBridgeStrategy (N instances per scanner+PM pair),
                              GoProcessBridge (singleton, stdio JSON-RPC)
                              Depends on: @dt/core, systematic-tss binary

@dt/strategy-registry       — StrategyRegistry (singleton), auto-discovery
                              Depends on: @dt/core

@dt/orchestrator            — Pipeline: scan → filter → gate → plan → execute
                              Slot management, cross-slot dedup, regime routing
                              Depends on: @dt/core, @dt/strategy-registry

@dt/execution               — Engine (PRD-06), BrokerAdapters (PRD-07), PlanGenerator
                              NO dependency on any strategy package
                              Depends on: @dt/core

@dt/backtest                — UnifiedBacktester: delegates to sweep.js or Go bridge
                              Same output metrics for all strategy types
                              Depends on: @dt/core, @dt/strategy-registry
```

---

## 21. Deployment

### 21.1 Go Engine Build

```bash
# Build for Oracle Cloud ARM A1
GOOS=linux GOARCH=arm64 CGO_ENABLED=1 go build -o engine ./cmd/live/

# Or cross-compile from macOS/x86
GOOS=linux GOARCH=arm64 CC=aarch64-linux-gnu-gcc CGO_ENABLED=1 go build -o engine ./cmd/live/
```

### 21.2 Deployment (Oracle Cloud Always Free)

```bash
# Copy binary + data to Oracle VM
scp engine oracle-vm:/opt/dailytickers/
scp -r data/models/ oracle-vm:/opt/dailytickers/data/models/

# systemd service (see PRD-15 §11.1 for full unit file)
sudo systemctl enable dailytickers
sudo systemctl start dailytickers
```

The Go engine binary runs on the same Oracle Cloud ARM A1 VM as the main application. Started by the orchestrator via `spawn("./engine", ["--mode", "bridge"])`, dies when the orchestrator stops. No containers, no Docker — single binary deployment via systemd.

### 21.3 Health Check

```
GoProcessBridge.call('health') → {
  "status": "ok",
  "version": "1.0.0",
  "scanners": 18,
  "position_managers": 16,
  "strategies": 15,
  "uptime_seconds": 86400
}
```

---

## 22. Error Handling

| Scenario | Behavior |
|----------|----------|
| Go bridge process crashes | Restart automatically, log, retry scan. After 3 failures → skip mechanical slots, proceed with scanner-only |
| Go bridge timeout (60s) | Skip that scanner, continue with other slots. Log warning |
| OHLCV data missing for symbol | Skip symbol, log, continue scanning remaining universe |
| BVC API down | Skip Morocco slot, log, continue with other slots |
| Circuit breaker triggered (slot) | Halt new entries for that slot only, existing positions managed normally |
| Circuit breaker triggered (portfolio) | Halt ALL new entries, existing positions managed normally |
| Scanner returns 0 signals | Normal — no trades for that slot on that day |
| Config validation error | Reject slot, notify user via dashboard + notification hub |
| MCP Gateway down | Skip scanner strategies, continue with mechanical. Log warning |
| Broker API error | Log, skip that broker, continue others |

---

## 23. Monitoring & Observability

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| Go bridge response time | `scan` call latency | > 30s |
| Signal count per slot | Scan output | 0 for 5 consecutive days |
| Pipeline total latency | Scan → orders complete | > 5 minutes |
| Position count per slot | Position tracker | Exceeds `maxPositions` |
| Daily P&L per slot | Position tracking | Below `dailyStopLossPct` |
| Portfolio aggregate DD | Portfolio risk state | Below `max_drawdown_pct` |
| Circuit breaker activations | Slot/portfolio risk events | > 2/week per slot |
| Invariant violations | QA check run | Any violation = CRITICAL |
| Golden file drift | CI parity check | Any mismatch = block PR |
| Go bridge restarts | Process manager | > 3/day |

---

## 24. Migration Path

### Phase 1: Interface Extraction (no behavior change)
1. Define `@dt/core` types (Signal, Strategy, StrategySlotConfig)
2. Wrap existing `gen-trading-plan.js` to accept `Signal[]` input
3. Existing pipeline continues working — this is additive

### Phase 2: Scanner Strategies
1. Extract scanner logic into `ScannerStrategy.scan()`
2. Wire through the new orchestrator
3. Validate: same signals.json output for same inputs

### Phase 3: Go Bridge
1. Add `--mode bridge` to Go engine
2. Implement `GoBridgeStrategy` + `GoProcessBridge`
3. Auto-register Go strategies in the registry
4. Test: run Go scanners through the unified pipeline

### Phase 4: Unified Config
1. Migrate `modes-config.json` → unified `strategy-slots.json`
2. Migrate YAML allocations → additional slots in same config
3. Remove Signal Merger (no longer needed)

### Phase 5: Unified Backtest
1. Wrap `sweep.js` as backtest engine for scanner slots
2. Delegate to Go bridge for mechanical slots
3. Same comparison metrics across all strategy types

---

## 25. Design Decisions & Rationale

| # | Decision | Rationale | Alternatives Rejected |
|---|----------|-----------|----------------------|
| 1 | **stdio JSON-RPC** over HTTP sidecar | No port management, lifecycle tied to parent, proven pattern (LSP, MCP) | HTTP sidecar, gRPC, Unix socket, FFI/CGO, WASM |
| 2 | **One Go process, multiplexed** | Go init (indicator caches) is expensive — do it once. Avoids 60+ processes | One process per strategy, shared library |
| 3 | **`strategyParams` is opaque** | Adding new strategy types never changes config schema | Typed union config (verbose, breaks on new types) |
| 4 | **`manage()` optional on Strategy** | Scanner strategies use universal exit engine. Mechanical strategies override | Mandatory manage() with no-op default |
| 5 | **StrategySlot unifies Mode + Allocation** | Both are "capital slice + strategy + broker". Same concept, different names | Keep separate (creates parallel pipelines) |
| 6 | **Bridge, not rewrite** | 20K LOC of battle-tested Go. Rewriting = 6 months of risk, zero user value | Full TS rewrite, WASM compilation |
| 7 | **Signal is universal currency** | Every downstream component operates on one shape. No normalization layers | Per-source schemas with adapters at every boundary |
| 8 | **Go broker adapters removed (SaaS)** | Dual-connection conflict. One adapter per broker, in Node.js | Keep Go adapters (maintenance burden, dual connections) |
| 9 | **Keep both backtest engines** | Fundamentally different simulation models (OHLCV replay vs signal replay). Unify output, not engine | One engine for all (too much rewrite) |
| 10 | **Scores NOT comparable cross-slot** | Scanner and mechanical scores use different scales with different calibration. Clamping ≠ normalization | Signal Merger with score normalization (+5 agreement bonus) |
| 11 | **Hierarchical risk (portfolio → slot)** | Prevents death-by-a-thousand-cuts where 5 slots each lose 5% but portfolio is down 25% | Per-slot only (current) |
| 12 | **Regional regime sources** | EU needs VSTOXX, forex needs DXY, crypto needs BTC dominance. One-size VIX is wrong | VIX-only for everything |

## 26. Agent-Driven Strategy Development

The mechanical strategy engine is fully agent-accessible via skills (PRD-25).

### 26.1 Adding a Strategy (`/add-strategy` skill)

The `/add-strategy` skill walks an AI agent through the full process:

1. **Choose**: Asset class, region, timeframe, scanner type
2. **Implement**: `OpportunityScanner` interface in Go — `Name() string` + `Scan(ctx, bars) []Signal`
3. **Register**: Add to scanner factory (`internal/scanner/factory.go`)
4. **Configure**: Default params in `scanner-defaults.json`, StrategySlot template in `strategy-templates.json`
5. **Validate**: Run backtest via Go bridge — minimum 100 trades, Sharpe > 1.0
6. **Publish**: Refresh discovery marts (`RunTransformation`), update CLAUDE.md

### 26.2 Discovering Strategies (`/discover-strategy` skill)

The `/discover-strategy` skill leverages PRD-24 analytical marts:

1. Query `mart_discovery_candidates` for high-performing scanner/parameter combos
2. Filter: Sharpe > 1.2, WR > 50%, PF > 1.5, minimum 30 trades
3. Run full backtest via `RunBacktest` MCP tool
4. Compare with existing production slots via `CompareStrategies`
5. Present findings with equity curve, regime sensitivity, correlation to existing slots
6. Generate StrategySlot config template if approved

### 26.3 Reviewing Strategy Health (`/review-strategy` skill)

The `/review-strategy` skill monitors slot health:

1. Fetch 30/60/90-day rolling performance from `mart_strategy_performance`
2. Check regime sensitivity via `GetRegimeImpact`
3. Analyze signal quality degradation (hit rate trends, score predictiveness)
4. Compare current vs original backtest performance
5. Recommend: continue | reduce size | pause | recalibrate | retire

### 26.4 Skill ↔ Go Bridge Integration

Skills invoke the Go bridge via MCP stdio JSON-RPC for:
- `scan` — Run a scanner on historical data
- `backtest` — Full walk-forward backtest with metrics
- `list_scanners` — Enumerate available scanners
- `get_config` — Read scanner default parameters

The Go bridge exposes these as MCP tools when running in `--mode bridge`. Skills compose these primitives into higher-level workflows.

See PRD-25 for the complete skills catalog and architecture.
