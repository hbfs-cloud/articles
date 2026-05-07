# PRD-11: Dashboard & Live UI

## Overview

The DailyTickers AutoTrader dashboard is a **React single-page application** built on the Foundation design system. It replaces the server-rendered `gen-status-page.js` HTML with a component-driven architecture served via GitHub Pages (static export) and powered by live WebSocket data from the Go API server.

The dashboard surfaces all strategy slots — scanner-based and mechanical — in a unified view. Every slot type renders with the same component hierarchy: stat cards, equity chart, signal table, position tracker, and trade history. The Time Machine replays historical snapshots by patching data into the same components (never switching containers). The Live Engine pushes real-time price ticks via WebSocket for mark-to-market updates.

**Scale target**: ~25 concurrent users (personal use + 20 invited users). Single Go binary serves the REST API + WebSocket; React dashboard is a static export on GitHub Pages / CloudFront.

**Design system**: Foundation — dark-first premium aesthetic, sidebar-inset layout, Emerald (#10b981) finance vertical tint. See `DESIGN.md` for full token reference.

---

## 1. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  GitHub Pages / CloudFront (static)                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  React SPA (Next.js static export)                         │  │
│  │  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐  │  │
│  │  │ Sidebar  │  │ Header       │  │ Content Area       │  │  │
│  │  │ (280px)  │  │ (56px sticky)│  │ (max-w 1280px)     │  │  │
│  │  │          │  │ ⌘K search    │  │ ┌────────────────┐ │  │  │
│  │  │ Slots    │  │ notifs bell  │  │ │ Stat Cards     │ │  │  │
│  │  │ Settings │  │ user avatar  │  │ │ Equity Chart   │ │  │  │
│  │  │ History  │  │              │  │ │ Signal Table   │ │  │  │
│  │  │          │  │              │  │ │ Position Grid  │ │  │  │
│  │  │          │  │              │  │ │ Trade History  │ │  │  │
│  │  └──────────┘  └──────────────┘  │ └────────────────┘ │  │  │
│  │                                   └────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────┬───────────────────────────────┘
                              │ HTTPS (REST + WebSocket)
                    ┌─────────▼──────────┐
                    │  Go API Server     │
                    │  :8080             │
                    │  /api/v1/*  REST   │
                    │  /ws       WS     │
                    └────────────────────┘
```

### 1.1 Technology Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Next.js 16 (static export) | Foundation already uses it; `output: 'export'` produces pure HTML/JS/CSS |
| Styling | Tailwind CSS + Foundation design tokens | Dark-first, token-driven, no runtime CSS |
| Charts | ECharts (equity curves, performance) + Recharts (sparklines) | ECharts for complex financial charts; Recharts for inline micro-charts |
| State | React Context + SWR | SWR for REST polling with stale-while-revalidate; Context for WebSocket state |
| Real-time | Native WebSocket (browser) | Single persistent connection per session, JSON messages |
| Icons | @tabler/icons-react | Consistent with Foundation |
| Fonts | Inter (variable) + JetBrains Mono | Foundation standard; `tnum` for tabular numbers |

### 1.2 Build & Deploy

```bash
# Development
npm run dev              # Next.js dev server, hot reload

# Production (static export for GitHub Pages)
npm run build            # next build && next export → out/
# Deploy: push out/ to gh-pages branch or copy to articles repo
```

The static export fetches all data from the Go API server at runtime. No server-side rendering required — the Go binary at `:8080` serves REST + WebSocket, the React app is pure client-side.

---

## 2. Foundation Design Integration

### 2.1 Color Tokens (Finance Vertical)

The dashboard uses Foundation's dark palette with Emerald (#10b981) as the finance vertical tint:

| Token | Value | Usage |
|-------|-------|-------|
| `background` | `#0f1117` | Page canvas |
| `background-subtle` | `#151720` | Alternating row stripe |
| `surface` | `#1a1d27` | Cards, table containers, sidebar Level 1 |
| `surface-elevated` | `#222633` | Dropdowns, tooltips, hover states Level 2 |
| `surface-overlay` | `#2a2e3d` | Command palette, modals Level 3 |
| `on-surface` | `#eef0f6` | Primary text |
| `on-surface-muted` | `#9ba1b0` | Secondary text, labels |
| `on-surface-subtle` | `#6b7280` | Tertiary text, timestamps |
| `primary` | `#24acee` | Links, active nav, primary actions |
| `accent` | `#ffc936` | Upgrade CTAs, urgency indicators |
| `finance-tint` | `#10b981` | Section headers, slot badges, positive P&L accent |
| `success` | `#22ba00` | Positive P&L, bullish trends, TP hit |
| `destructive` | `#ff441b` | Negative P&L, bearish trends, SL hit |
| `warning` | `#ffb71c` | Pending states, near-stop, caution |
| `border` | `#ffffff14` | Default borders (8% white) |

### 2.2 Typography

| Style | Font | Size | Weight | Use |
|-------|------|------|--------|-----|
| `h1` | Inter | 42px | 600 | Page title ("Strategy Dashboard") |
| `h2` | Inter | 32px | 600 | Section headers ("Equity Curve") |
| `h3` | Inter | 24px | 600 | Card titles, stat values |
| `h4` | Inter | 20px | 600 | Subsection headers |
| `body-md` | Inter | 16px | 400 | General UI text |
| `body-sm` | Inter | 14px | 400 | Table cells, form content |
| `label-lg` | Inter | 14px | 500 | Button text, interactive labels |
| `label-sm` | Inter | 12px | 500 | Column headers (uppercase), metadata |
| `mono` | JetBrains Mono | 14px | 400 | Prices, P&L, percentages, order IDs |

All financial numbers use `font-feature-settings: 'tnum'` for tabular alignment.

### 2.3 Layout Shell

```
┌─────────────────────────────────────────────────────────┐
│ Sidebar (280px fixed, #0c0e14)                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Logo + Workspace Switcher                            │ │
│ │ Search Input                                         │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ STRATEGY SLOTS (nav section)                         │ │
│ │  ● Turbo         [4 pos]                             │ │
│ │  ● Dynamic       [2 pos]                             │ │
│ │  ● Balanced      [6 pos]                             │ │
│ │  ● Secured       [3 pos]                             │ │
│ │  ● Fortress      [8 pos]                             │ │
│ │  ● TKL           [5 pos]                             │ │
│ │  ● US-Trend-DSL  [mech]                              │ │
│ │  ● EU-Composite  [mech]                              │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ VIEWS                                                │ │
│ │  Portfolio Overview                                  │ │
│ │  Risk Dashboard                                      │ │
│ │  Trade History                                       │ │
│ │  Time Machine                                        │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ SETTINGS                                             │ │
│ │  Configuration                                       │ │
│ │  API Keys                                            │ │
│ │  Notifications                                       │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ User Menu (bottom)                                   │ │
│ │  avatar + name + plan badge                          │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

- Sidebar collapses to 64px icon-only mode below 1024px viewport width
- Active nav item: `bg-[#24acee14]` + `text-[#eef0f6]` (primary-tinted background)
- Slot badges show position count with `badge-primary` style; mechanical slots show `[mech]` badge
- Sidebar section headers use `label-sm` uppercase typography in `on-surface-subtle`

### 2.4 Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| Mobile (< 640px) | Sidebar hidden behind hamburger, single-column, 16px padding |
| Tablet (640–1024px) | Sidebar collapsed to icons, 2-column stat cards, stacked sections |
| Desktop (1024–1440px) | Full sidebar, 2-column `.lp-grid` for slot panels |
| Wide (> 1440px) | Content max-width 1280px, centered with generous margins |

### 2.5 Dark / Light Theme

Dark mode is default. Light mode available via toggle in header. Foundation light overrides:

| Token | Dark | Light |
|-------|------|-------|
| Background | `#0f1117` | `#ffffff` |
| Surface | `#1a1d27` | `#ffffff` |
| Surface Elevated | `#222633` | `#f5f6f8` |
| On-Surface | `#eef0f6` | `#1a1d27` |
| On-Surface Muted | `#9ba1b0` | `#6b7280` |
| Border | `#ffffff14` | `#e5e7eb` |
| Sidebar BG | `#0c0e14` | `#f8f9fb` |

Theme is stored in `localStorage` and applied via `data-theme` attribute on `<html>`. All color references use CSS custom properties (`var(--color-surface)`) so the switch is instantaneous.

---

## 3. Portfolio Overview Page

The default landing page after login. Shows aggregate metrics across all active strategy slots.

### 3.1 Stat Cards Row

Four `card-stat` components in a responsive row (4 cols desktop, 2 cols tablet, 1 col mobile):

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  <StatCard
    label="Portfolio Value"
    value="$124,850"
    icon={IconCoin}
    trend={null}
    mono
  />
  <StatCard
    label="Day P&L"
    value="+$12,450"
    change={+0.52}
    icon={IconTrendingUp}
    mono
  />
  <StatCard
    label="Open Positions"
    value="28"
    icon={IconTarget}
    subtitle="across 6 slots"
  />
  <StatCard
    label="Win Rate"
    value="67.2%"
    icon={IconPercentage}
    subtitle="last 30 trades"
    mono
  />
</div>
```

**StatCard component spec:**
- Background: `surface` (`#1a1d27`)
- Rounded: `lg` (0.75rem)
- Padding: 16px 20px
- Label: `label-sm`, `on-surface-muted`, uppercase
- Value: `h3` (24px, 600), `mono` for financial values, `on-surface`
- Change badge: pill shape, `success-muted` bg + `success` text for positive, `destructive-muted` + `destructive` for negative
- Icon: 20px, `on-surface-subtle`, positioned top-right
- Subtitle: `body-sm`, `on-surface-subtle`

### 3.2 Slot Performance Grid

Below the stat cards, a grid of slot summary cards (2–3 cols desktop):

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
  {slots.map(slot => (
    <SlotSummaryCard
      key={slot.id}
      name={slot.name}
      type={slot.type}         // "scanner" | "mechanical"
      totalReturn={slot.totalReturn}
      winRate={slot.winRate}
      openPositions={slot.openPositions}
      sparkline={slot.equityCurve.slice(-30)}
      status={slot.status}     // "active" | "paused" | "vix-killed"
    />
  ))}
</div>
```

Each `SlotSummaryCard`:
- Background: `surface`, hover: `surface-elevated`
- Header row: slot name (`h4`) + type badge (`badge-primary` for scanner, `badge-default` for mechanical)
- Metrics row: Total Return (mono, green/red) | Win Rate (mono) | Open Positions
- Sparkline: 30-day equity curve, Recharts `AreaChart`, 60px tall, emerald stroke for positive / destructive for negative
- Status indicator: colored dot (green=active, amber=paused, red=vix-killed) + `label-sm` text
- Click navigates to slot detail page

### 3.3 Risk Indicator Panel

A horizontal card showing three risk gauges side-by-side:

```tsx
<div className="flex gap-6 p-5 rounded-xl bg-[#1a1d27]">
  <RiskIndicator label="Volatility" sublabel="VIX" value="16.4" status="Low" color="#22ba00" />
  <RiskIndicator label="Regime" sublabel="Ensemble" value="Risk-On" status="Bullish" color="#10b981" />
  <RiskIndicator label="Correlation" sublabel="Avg ρ" value="0.42" status="Normal" color="#24acee" />
</div>
```

**RiskIndicator component:**
- Glowing dot: 8px circle with `box-shadow: 0 0 8px {color}` + solid fill
- Label: `label-lg`, `on-surface`
- Sublabel: `label-sm`, `on-surface-subtle`
- Value: `mono`, `on-surface`
- Status: `label-sm`, colored text matching the dot

Status thresholds (from `data/risk-snapshots.json`):
- VIX: <15 green "Low", 15-20 blue "Normal", 20-28 amber "Elevated", >28 red "High"
- Regime: Risk-On green, Neutral blue, Early Risk-Off amber, Risk-Off red, Recovery emerald
- Correlation: <0.5 blue "Normal", 0.5-0.7 amber "Elevated", >0.7 red "High"

### 3.4 Sector Trend Badges

Horizontal scrollable row of sector trend pills:

```tsx
<div className="flex gap-2 overflow-x-auto py-2">
  <TrendBadge sector="Technology" trend="Bullish" />
  <TrendBadge sector="Healthcare" trend="Neutral" />
  <TrendBadge sector="Energy" trend="Bearish" />
</div>
```

**TrendBadge component:**
- Bullish: dot `#22ba00` + text `#22ba00` + bg `#22ba00/10`
- Neutral: dot `#ffc936` + text `#ffc936` + bg `#ffc936/10`
- Bearish: dot `#ff441b` + text `#ff441b` + bg `#ff441b/10`
- Shape: fully rounded pill (`rounded-full`)
- Typography: `label-sm` (11px, 500)

---

## 4. Strategy Slot Detail Page

Navigated from sidebar or slot summary card. Shows full detail for a single strategy slot. This page replaces the per-mode `panel()` function from `gen-status-page.js`.

The slot detail page contains **7 sections** organized in a 2-column `.lp-grid` layout on desktop (single column on mobile):

### 4.1 Section 1: How to Trade

Collapsible guide card specific to the slot's trading style.

```tsx
<CollapsibleSection title="How to Trade" defaultOpen={false}>
  <div className="prose prose-sm text-[#9ba1b0]">
    {/* Mode-specific trading guide rendered from slot.config.guide markdown */}
  </div>
</CollapsibleSection>
```

- Background: `surface`
- Collapsed by default (user preference stored in `localStorage`)
- Content: markdown rendered to HTML, body-sm typography

### 4.2 Section 2: Today's Signals

Table of signals generated for the current scan date, filtered to this slot.

```tsx
<SectionCard title="Today's Signals" count={signals.length}>
  <SignalTable signals={filteredSignals} slotConfig={config} />
</SectionCard>
```

**SignalTable columns:**

| Column | Width | Typography | Content |
|--------|-------|------------|---------|
| Ticker | 80px | `label-lg`, `on-surface` | Symbol + flag emoji |
| Score | 60px | `mono`, colored by tier | 0–100, bold if ≥ 90 |
| Strategy | 100px | `label-sm`, `on-surface-muted` | Source tag (e.g., "dsl", "af", "momentum") |
| Entry | 80px | `mono` | Entry price |
| Stop | 80px | `mono`, `destructive` | Stop-loss price |
| TP1 | 80px | `mono`, `success` | Take-profit 1 |
| TP2 | 80px | `mono`, `success` | Take-profit 2 |
| R/R | 60px | `mono` | Risk/reward ratio |
| Sharia | 40px | — | Green check or red X icon |
| Tags | flex | badges | Sector + catalyst badges |

- Table header: `label-sm`, uppercase, `on-surface-muted`, sticky
- Row hover: `surface` background
- Row height: 44px compact
- Score coloring: ≥90 emerald bold, 85-89 success, 80-84 primary, <80 muted
- Empty state: "No signals for today" centered text

### 4.3 Section 3: Equity Curve

Full-width ECharts area chart showing cumulative equity over time.

```tsx
<SectionCard title="Equity Curve" subtitle={`${totalReturn}% total return`}>
  <div className="flex gap-2 mb-4">
    {PERIODS.map(p => (
      <PeriodButton key={p} period={p} active={activePeriod === p} onClick={() => setPeriod(p)} />
    ))}
  </div>
  <EquityChart data={equityData} period={activePeriod} height={320} />
  <PerfStats metrics={metrics} />
</SectionCard>
```

**Period buttons**: `["1W", "1M", "3M", "6M", "YTD", "1Y", "ALL"]`
- Active: `primary` bg, white text
- Inactive: `surface-elevated` bg, `on-surface-muted` text

**EquityChart (ECharts config):**
- Type: area chart with gradient fill
- Line color: emerald `#10b981` (if positive total) or destructive `#ff441b` (if negative)
- Fill: linear gradient from line color at 30% opacity to transparent
- Grid: `#ffffff14` horizontal lines only
- Tooltip: `surface-overlay` bg, mono values, date + equity value + daily change
- X-axis: `label-sm`, `on-surface-subtle`, date labels
- Y-axis: `mono`, `on-surface-subtle`, currency values
- Crosshair: vertical dashed line `#ffffff22`
- Height: 320px (desktop), 240px (mobile)

**PerfStats row** (6 metrics below the chart):

| Metric | Format | Source |
|--------|--------|--------|
| Total Return | `+XX.X%` | `(equity_last / equity_first - 1) * 100` |
| Max Drawdown | `-X.X%` | Maximum peak-to-trough decline |
| Win Rate | `XX.X%` | `wins / (wins + losses) * 100` |
| Profit Factor | `X.XX` | `gross_profit / gross_loss` |
| Closed Trades | `N` | Count of non-premature closed trades |
| Avg Hold | `X.Xd` | Average holding period in days |

Each metric rendered as:
- Label: `label-sm`, `on-surface-subtle`
- Value: `h4` (20px), `mono`, `on-surface`
- Layout: horizontal flex with dividers, wraps on mobile

### 4.4 Section 4: Close Now (Urgent Actions)

Appears only when positions have timed out (exceeded max hold days) or hit terminal exits.

```tsx
{expiredPositions.length > 0 && (
  <SectionCard title="Close Now" variant="warning" count={expiredPositions.length}>
    <div className="space-y-2">
      {expiredPositions.map(pos => (
        <UrgentActionCard key={pos.ticker} position={pos} onClose={handleClose} />
      ))}
    </div>
  </SectionCard>
)}
```

- Card border: `warning` color left border (4px)
- Background: `warning-muted` (`#ffb71c1a`)
- Each row: ticker, days held, current P&L, "Close" button (`button-destructive`)
- Hidden when no expired positions

### 4.5 Section 5: Orders to Place

Active orders that need execution — entries, rotations, and recently executed rotations.

```tsx
<SectionCard title="Orders to Place" count={orders.length}>
  <OrdersTable orders={buyOrders} type="entry" />
  {rotateOrders.length > 0 && (
    <OrdersTable orders={rotateOrders} type="rotate" />
  )}
  {recentRotation && (
    <RotationCard rotation={recentRotation} />
  )}
</SectionCard>
```

**OrdersTable columns:**

| Column | Content |
|--------|---------|
| Action | Badge: "BUY" (`success`), "ROTATE" (`warning`), "CLOSE" (`destructive`) |
| Ticker | Symbol |
| Entry | Target entry price (mono) |
| Stop | Stop-loss (mono, destructive) |
| TP1 / TP2 | Take-profit levels (mono, success) |
| Size | Position size % or shares |
| Broker | Broker badge (Alpaca/IBKR/Saxo/T212/Binance) |

**RotationCard** (recent executed rotation):
- Badge: "JUST EXECUTED" in `accent` pill
- Shows: closed ticker -> new ticker, P&L on closed, entry on new
- Background: `surface-elevated`

### 4.6 Section 6: Open Positions

Live-updating position table with real-time P&L from WebSocket.

```tsx
<SectionCard title="Open Positions" count={positions.length}>
  <PositionTable positions={openPositions} liveData={wsData} config={slotConfig} />
</SectionCard>
```

**PositionTable columns:**

| Column | Width | Content |
|--------|-------|---------|
| Ticker | 80px | Symbol + sparkline (7-day, 60px wide Recharts) |
| Entry | 80px | Entry price (mono) |
| Current | 80px | Live price (mono), updates via WebSocket, flash on change |
| P&L % | 80px | Unrealized P&L %, green/red, mono |
| P&L $ | 80px | Unrealized P&L $, green/red, mono |
| Stop | 70px | Current stop level (may trail) |
| TP1 | 70px | TP1 level, strikethrough if hit |
| Days | 50px | Days held, amber if > 80% of max_hold |
| Status | 100px | Badge: "Trending" / "Entry Zone" / "Near Stop" / "TP1 Hit" |
| Actions | 60px | Close button (icon) |

**Live price behavior:**
- Price cell flashes green (up-tick) or red (down-tick) for 300ms on each WebSocket update
- P&L recalculates in real-time
- Status badge updates based on `evaluatePosition()` logic (see section 5)
- Row background tints subtly based on P&L: positive -> `#22ba0008`, negative -> `#ff441b08`

**Position status classification** (from `evaluatePosition`):

| Status | Condition | Badge Color |
|--------|-----------|-------------|
| TP2 Hit | `current >= tp2` | Gold (`accent`) |
| TP1 Hit | `current >= tp1` | Success |
| Trending | `current > entry * 1.01` | Success (lighter) |
| Entry Zone | `entry * 0.99 <= current <= entry * 1.01` | Warning |
| Underwater | `current < entry * 0.99` | Destructive (lighter) |
| Near Stop | `current <= stop * 1.02` | Destructive |
| Stopped | `current <= stop` | Muted (grayscale) |

### 4.7 Section 7: Trade History

Collapsible table of all closed trades for this slot, newest first.

```tsx
<CollapsibleSection title={`Trade History (${trades.length})`} defaultOpen={false}>
  <TradeHistoryTable trades={closedTrades} />
</CollapsibleSection>
```

**TradeHistoryTable columns:**

| Column | Content |
|--------|---------|
| Ticker | Symbol |
| Entry Date | Scan date (label-sm) |
| Exit Date | Close date (label-sm) |
| Entry | Entry price (mono) |
| Exit | Exit price (mono) |
| P&L % | Realized P&L %, colored |
| Status | Badge: "TP1" / "TP2" / "Stopped" / "Expired" / "Rotated" |
| Hold | Days held |

- Cursor-based pagination: "Show 50 more" button (no page numbers per Foundation spec)
- Rotated trades labeled with `badge-warning` "Rotated" status
- Default collapsed; user preference persisted in `localStorage`

---

## 5. Live Engine (WebSocket)

### 5.1 Connection

```typescript
interface WSConfig {
  url: string;           // wss://api.dailytickers.com/ws
  reconnectDelay: 2000;  // ms, exponential backoff up to 30s
  heartbeat: 30000;      // ping every 30s
  maxReconnects: 50;
}
```

The React app establishes a single WebSocket connection on mount via a `WebSocketProvider` context. All slot detail pages and the portfolio overview consume the same connection.

```tsx
// Context provider at app root
<WebSocketProvider url={wsUrl}>
  <DashboardLayout>
    <SlotDetailPage slotId={activeSlot} />
  </DashboardLayout>
</WebSocketProvider>
```

### 5.2 Message Protocol

**Server -> Client messages:**

```typescript
// Price tick for a position
interface PriceTick {
  type: "tick";
  ticker: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  timestamp: string;    // ISO 8601
}

// Position status change (exit detected)
interface PositionUpdate {
  type: "position_update";
  slotId: string;
  ticker: string;
  status: "sl_hit" | "tp1_hit" | "tp2_hit" | "expired" | "rotated" | "closed";
  exitPrice: number;
  pnlPct: number;
  timestamp: string;
}

// Pipeline phase completion
interface PipelineEvent {
  type: "pipeline";
  phase: "collect" | "generate" | "gate" | "track" | "simulate" | "risk" | "plan" | "execute" | "report";
  status: "started" | "completed" | "failed";
  message: string;
  timestamp: string;
}

// Slot config change (regime recalibration)
interface ConfigUpdate {
  type: "config_update";
  slotId: string;
  changes: Record<string, unknown>;
  reason: string;
  timestamp: string;
}
```

**Client -> Server messages:**

```typescript
// Subscribe to specific tickers (sent on slot page navigation)
interface Subscribe {
  type: "subscribe";
  tickers: string[];
}

// Unsubscribe (sent on navigation away)
interface Unsubscribe {
  type: "unsubscribe";
  tickers: string[];
}

// Manual position close request
interface ClosePosition {
  type: "close";
  slotId: string;
  ticker: string;
}
```

### 5.3 `evaluatePosition(pos, livePrice, cfg)`

Pure function called on each price tick to determine position status and UI state:

```typescript
function evaluatePosition(
  pos: Position,
  livePrice: number,
  cfg: SlotConfig
): PositionEvaluation {
  const pnlPct = ((livePrice - pos.entry) / pos.entry) * 100;
  const daysHeld = daysBetween(pos.scanDate, today());

  // Terminal states (position should be closed)
  if (livePrice <= pos.currentStop) return { status: "stopped", terminal: true, pnlPct };
  if (livePrice >= pos.tp2)         return { status: "tp2_hit", terminal: true, pnlPct };
  if (daysHeld >= cfg.max_hold)     return { status: "expired", terminal: true, pnlPct };

  // Active states
  if (livePrice >= pos.tp1)                          return { status: "tp1_hit", terminal: false, pnlPct };
  if (pnlPct >= cfg.breakeven_trigger_pct)           return { status: "breakeven", terminal: false, pnlPct };
  if (pnlPct > 1)                                    return { status: "trending", terminal: false, pnlPct };
  if (pnlPct >= -1 && pnlPct <= 1)                   return { status: "entry_zone", terminal: false, pnlPct };
  if (livePrice <= pos.currentStop * 1.02)           return { status: "near_stop", terminal: false, pnlPct };

  return { status: "underwater", terminal: false, pnlPct };
}
```

When `terminal: true`, the UI:
1. Shows a toast notification ("NVDA hit TP2 at $945.20 (+7.4%)")
2. Moves the position from Open Positions to Trade History
3. Updates stat cards (win rate, P&L, position count)
4. Flashes the row briefly before removal

### 5.4 CORS Proxies (HTTP Fallback)

When WebSocket is unavailable or for initial data load, the dashboard falls back to HTTP polling via SWR:

```typescript
const PROXY_PRIMARY = "https://api.allorigins.win/get?url=";
const PROXY_FALLBACK = "https://corsproxy.io/?";

async function fetchWithProxy(url: string): Promise<unknown> {
  try {
    const res = await fetch(PROXY_PRIMARY + encodeURIComponent(url));
    const data = await res.json();
    return JSON.parse(data.contents);
  } catch {
    const res = await fetch(PROXY_FALLBACK + encodeURIComponent(url));
    return res.json();
  }
}
```

Polling interval: 60s when WebSocket is connected (backup), 15s when WebSocket is disconnected.

---

## 6. Time Machine

### 6.1 Concept

Time Machine replays historical snapshots by swapping data into the same React components used for live view. There is **no separate Time Machine layout** — the same slot detail page renders with historical data instead of live data.

**Key invariant**: Live is the canonical layout. Time Machine patches data; it never switches containers, templates, or component trees.

### 6.2 UI Controls

A slider in the page header (below stat cards) when Time Machine mode is active:

```tsx
<TimeMachineBar>
  <button onClick={toggleTimeMachine}>
    <IconClock /> Time Machine
  </button>
  {isTimeMachine && (
    <>
      <input
        type="range"
        min={0}
        max={snapshots.length - 1}
        value={snapshotIdx}
        onChange={e => loadSnapshot(Number(e.target.value))}
      />
      <span className="text-[#9ba1b0] text-sm font-mono">
        {snapshots[snapshotIdx].date}
      </span>
      <button onClick={returnToLive}>
        <IconLive /> Back to Live
      </button>
    </>
  )}
</TimeMachineBar>
```

### 6.3 Banner

When viewing a historical snapshot, a persistent banner appears below the header:

```tsx
{isTimeMachine && (
  <div className="bg-[#ffc9361a] border border-[#ffc93640] rounded-lg px-4 py-2 flex items-center gap-2 text-sm">
    <IconClock className="text-[#ffc936]" size={16} />
    <span className="text-[#ffc936]">Viewing snapshot from {snapshotDate}</span>
    <button className="ml-auto text-[#24acee] hover:underline" onClick={returnToLive}>
      Return to Live
    </button>
  </div>
)}
```

### 6.4 Data Flow

```
User slides to date D
  -> fetch /api/v1/snapshots/{slotId}/{date}.json
  -> Response: { signals, positions, trades, equity, metrics, config }
  -> React state update: setSlotData(snapshotData)
  -> All sections re-render with snapshot data (same components)
  -> WebSocket updates paused (subscription cleared)
  -> Live price ticks ignored
  -> Stat cards show snapshot metrics
  -> Equity chart highlights snapshot date with vertical marker

User clicks "Back to Live"
  -> setSlotData(liveData)
  -> WebSocket resubscribed
  -> Components re-render with current data
```

### 6.5 Snapshot Storage

Snapshots generated daily by `gen-api.js` as part of the pipeline:

```
/api/v1/snapshots/{slotId}/
  ├── 2026-05-07.json
  ├── 2026-05-06.json
  ├── 2026-05-05.json
  └── ...
```

Each snapshot JSON:
```json
{
  "date": "2026-05-07",
  "slotId": "balanced",
  "signals": [],
  "positions": [],
  "trades": [],
  "equity": [[1746576000000, 11240], [1746662400000, 11380]],
  "metrics": {
    "totalReturn": 12.4,
    "maxDrawdown": -3.2,
    "winRate": 67.5,
    "profitFactor": 2.1,
    "closedTrades": 42,
    "avgHold": 3.8
  },
  "config": {},
  "risk": {
    "vix": 16.4,
    "regime": "RISK-ON",
    "correlation": 0.42,
    "var95": -1.2
  }
}
```

---

## 7. Command Palette

Global search overlay accessible from any page via `Cmd+K` (Mac) or `Ctrl+K` (Windows).

### 7.1 UI

```tsx
<CommandPalette open={isOpen} onClose={() => setOpen(false)}>
  <input
    placeholder="Search positions, strategies, tickers, dates..."
    value={query}
    onChange={e => setQuery(e.target.value)}
    className="bg-transparent text-[#eef0f6] text-lg w-full outline-none"
  />
  <CommandResults results={results} onSelect={handleSelect} />
</CommandPalette>
```

- Overlay: `surface-overlay` (`#2a2e3d`) with `backdrop-blur-[12px]`, centered
- Modal: `surface-elevated` bg, `rounded-2xl`, 24px padding, max-width 640px
- Shadow: `0 16px 48px rgba(0, 0, 0, 0.4)` (Foundation modal shadow)
- Input: no border, `body-lg` typography
- Results: grouped by category with `label-sm` section headers

### 7.2 Search Categories

| Category | Example Query | Action |
|----------|---------------|--------|
| Positions | "NVDA", "nvidia" | Navigate to slot with that position |
| Slots | "balanced", "turbo" | Navigate to slot detail |
| Dates | "2026-05-01", "last week" | Open Time Machine at that date |
| Actions | "close all", "recalibrate" | Trigger action |
| Settings | "notifications", "api keys" | Navigate to settings page |

Results ranked by recency and relevance. Max 10 results shown. Keyboard navigation (arrow keys + Enter).

---

## 8. Risk Dashboard Page

Dedicated page accessible from sidebar "Risk Dashboard" nav item.

### 8.1 Risk Overview Cards

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  <StatCard label="Portfolio VaR (95%)" value="-$2,480" mono variant="destructive" />
  <StatCard label="Max Drawdown" value="-3.2%" mono />
  <StatCard label="Sharpe Ratio" value="1.84" mono />
  <StatCard label="Calmar Ratio" value="3.87" mono />
</div>
```

### 8.2 Exposure Level

Horizontal gradient bar showing portfolio exposure:

```tsx
<ExposureBar
  current={72}
  max={100}
  thresholds={[
    { at: 50, label: "Conservative", color: "#22ba00" },
    { at: 75, label: "Moderate", color: "#ffc936" },
    { at: 90, label: "Aggressive", color: "#ff441b" },
  ]}
/>
```

- Track: `surface` bg, `rounded-full`, 8px height
- Fill: linear gradient transitioning through threshold colors
- Current marker: white dot with label
- Labels: `label-sm` below the bar

### 8.3 Correlation Matrix

ECharts heatmap showing pairwise correlation between open positions:

- Color scale: blue (negative) -> white (zero) -> red (positive)
- Cell labels: `mono`, correlation coefficient
- Axis labels: ticker symbols
- Data from `/api/v1/risk/correlation.json` (refreshed by `refresh-risk-metrics.js`)

### 8.4 Stress Test Results

Table from MCP `GetPortfolioStressTest`:

| Scenario | Impact | Recovery Est. |
|----------|--------|---------------|
| -10% Market | -$4,200 (-3.4%) | 8 days |
| +50bp Rate Hike | -$1,800 (-1.4%) | 3 days |
| VIX Spike to 35 | -$3,100 (-2.5%) | 5 days |
| Sector Rotation | -$900 (-0.7%) | 2 days |

- Row background tinted by severity: >3% destructive-muted, 1-3% warning-muted
- Data source: `data/risk-snapshots.json`

---

## 9. Content Gating

For multi-tenant SaaS, certain features are gated by subscription tier.

### 9.1 Gated Feature Preview

```tsx
<ContentGate tier="pro" currentTier={user.tier}>
  <div className="relative">
    {/* Actual component rendered at 15% opacity */}
    <div className="opacity-[0.15] pointer-events-none select-none">
      <CorrelationMatrix data={mockData} />
    </div>
    {/* Overlay */}
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[rgba(15,17,23,0.85)] rounded-xl">
      <IconLock size={32} className="text-[#9ba1b0] mb-3" />
      <p className="text-[#eef0f6] font-semibold mb-1">Correlation Matrix</p>
      <p className="text-[#9ba1b0] text-sm mb-4">Available on Pro plan</p>
      <button className="bg-[#ffc936] text-[#1a1d27] px-5 py-2 rounded-lg font-medium hover:bg-[#f0be2e]">
        Upgrade to Pro
      </button>
    </div>
  </div>
</ContentGate>
```

### 9.2 Feature Tiers

| Feature | Free | Basic | Pro |
|---------|------|-------|-----|
| Portfolio Overview | 1 slot | 3 slots | All slots |
| Live Engine (WebSocket) | No | Yes | Yes |
| Time Machine | Last 7 days | Last 30 days | Full history |
| Risk Dashboard | No | VaR only | Full (correlation, stress) |
| Command Palette | No | Yes | Yes |
| Equity Chart Periods | 1M only | 6M | ALL |
| Trade History Export | No | CSV | CSV + JSON |
| API Access | No | 100 req/min | 10K req/min |

---

## 10. Mode Card PNG Generation

For Telegram/Discord/OG image previews, the server generates PNG cards per slot.

### 10.1 Generation

```bash
node tools/gen-mode-cards.js
```

Produces: `scanner/status/mode-{slotId}-{timestamp}.png`

### 10.2 Card Layout (1200x630px)

```
┌──────────────────────────────────────────────────┐
│  ┌─────┐  SLOT_NAME                    DailyTickers│
│  │LOGO │  Strategy Type Badge                      │
│  └─────┘                                           │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ +12.4%   │  │ 67.2%    │  │ 28       │         │
│  │ Return   │  │ Win Rate │  │ Positions│         │
│  └──────────┘  └──────────┘  └──────────┘         │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │  Equity Curve (sparkline, last 30 days)        │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  Top 3: NVDA +7.4% | AAPL +3.2% | META +2.1%     │
│  articles.dailytickers.com         2026-05-07       │
└──────────────────────────────────────────────────┘
```

- Background: `#0f1117` (Foundation dark)
- Text: `#eef0f6` (on-surface)
- Metrics: `mono` font, emerald/destructive coloring
- Generated server-side via Puppeteer or `@resvg/resvg-js` (no browser dependency)

---

## 11. Notifications Integration

The dashboard integrates with the Notification Hub (PRD-22) for in-app alerts.

### 11.1 Notification Bell

Header icon with unread badge count. Click opens a dropdown panel:

```tsx
<NotificationDropdown>
  {notifications.map(n => (
    <NotificationItem
      key={n.id}
      type={n.type}       // "fill" | "exit" | "signal" | "error" | "pipeline"
      message={n.message}
      timestamp={n.timestamp}
      read={n.read}
      onClick={() => markRead(n.id)}
    />
  ))}
</NotificationDropdown>
```

- Dropdown: `surface-elevated` bg, `rounded-lg`, max-height 400px scrollable
- Unread: left border `primary` + slightly elevated background
- Type icons: colored by severity (success for fills, destructive for errors, primary for info)

### 11.2 Toast Notifications

Real-time events from WebSocket show as toasts:

```tsx
<ToastProvider>
  {/* Toasts appear bottom-right, stack upward, auto-dismiss after 5s */}
  <Toast variant="success" title="Position Closed" message="NVDA hit TP2 at $945.20 (+7.4%)" />
  <Toast variant="error" title="Order Failed" message="IBKR rejected AAPL bracket order" />
  <Toast variant="info" title="Pipeline" message="Phase 7: Plan generation completed" />
</ToastProvider>
```

- Background: `surface-elevated`
- Left border: colored by variant (success/error/warning/info)
- Shadow: `0 4px 16px rgba(0, 0, 0, 0.25)` (Foundation toast shadow)
- Auto-dismiss: 5s for info/success, 10s for warnings, persistent for errors

---

## 12. Data Sources

### 12.1 REST API Endpoints (from PRD-10)

| Endpoint | Data | Refresh |
|----------|------|---------|
| `/api/v1/{slotId}/signals.json` | Today's signals | On pipeline Phase 2 |
| `/api/v1/{slotId}/positions.json` | Open positions | On pipeline Phase 4 |
| `/api/v1/{slotId}/equity.json` | Equity curve array | On pipeline Phase 5 |
| `/api/v1/{slotId}/trades.json` | Closed trades | On pipeline Phase 5 |
| `/api/v1/{slotId}/orders.json` | Active orders | On pipeline Phase 7 |
| `/api/v1/{slotId}/risk.json` | Risk metrics | On pipeline Phase 6 |
| `/api/v1/{slotId}/all.json` | All of the above | On pipeline Phase 9 |
| `/api/v1/portfolio/overview.json` | Aggregate stats | On pipeline Phase 9 |
| `/api/v1/risk/correlation.json` | Cross-position correlation | On pipeline Phase 6 |
| `/api/v1/risk/stress.json` | Stress test results | On pipeline Phase 6 |
| `/api/v1/snapshots/{slotId}/{date}.json` | Time Machine snapshot | Daily after pipeline |

### 12.2 SWR Configuration

```typescript
const swrConfig = {
  refreshInterval: 60_000,           // Poll every 60s as backup
  revalidateOnFocus: true,           // Refresh when tab regains focus
  dedupingInterval: 10_000,          // Dedupe identical requests within 10s
  errorRetryCount: 3,
  errorRetryInterval: 5_000,
};
```

WebSocket pushes trigger SWR `mutate()` calls to update the cache immediately, avoiding the 60s poll delay.

---

## 13. Component Inventory

Complete list of React components for the dashboard:

### 13.1 Layout Components

| Component | Description |
|-----------|-------------|
| `DashboardLayout` | Sidebar + header + content area shell |
| `Sidebar` | Fixed nav with slot list, views, settings |
| `Header` | Sticky header with breadcrumb, search trigger, notif bell, avatar |
| `SectionCard` | Wrapper for each dashboard section (title + optional count badge) |
| `CollapsibleSection` | SectionCard with expand/collapse toggle |

### 13.2 Data Display Components

| Component | Description |
|-----------|-------------|
| `StatCard` | Metric card (label, value, change badge, icon) |
| `SlotSummaryCard` | Slot overview with sparkline and key metrics |
| `SignalTable` | Today's signals table |
| `PositionTable` | Open positions with live price updates |
| `TradeHistoryTable` | Closed trades with pagination |
| `OrdersTable` | Pending orders (buy/rotate/close) |
| `EquityChart` | ECharts area chart for equity curve |
| `SparklineChart` | Recharts inline mini-chart (60px) |
| `PerfStats` | Horizontal metrics row below equity chart |

### 13.3 Risk Components

| Component | Description |
|-----------|-------------|
| `RiskIndicator` | Glowing dot + label + value + status |
| `TrendBadge` | Bullish/Neutral/Bearish sector pill |
| `ExposureBar` | Gradient progress bar with thresholds |
| `CorrelationMatrix` | ECharts heatmap |
| `StressTestTable` | Scenario impact table |

### 13.4 Interactive Components

| Component | Description |
|-----------|-------------|
| `CommandPalette` | Search overlay |
| `TimeMachineBar` | Slider + date display + back-to-live button |
| `PeriodButton` | Time period selector (1W/1M/3M/...) |
| `ContentGate` | Blur overlay with upgrade CTA |
| `NotificationDropdown` | Bell click notification list |
| `Toast` | Bottom-right alert with auto-dismiss |
| `UrgentActionCard` | Expired position with close button |
| `RotationCard` | Recently executed rotation display |

---

## 14. Key Invariants

1. **Live is the canonical layout.** Time Machine swaps data, never containers or components. The same `SlotDetailPage` renders both live and historical state.

2. **One WebSocket connection.** All pages share a single persistent connection via `WebSocketProvider`. Subscribe/unsubscribe messages manage which tickers receive ticks.

3. **Foundation tokens everywhere.** No hardcoded colors — all via CSS custom properties. Theme toggle switches all surfaces instantly.

4. **Mono font for money.** Every price, percentage, P&L, and financial metric uses JetBrains Mono with `tnum` feature. No exceptions.

5. **Terminal states are terminal.** When `evaluatePosition` returns `terminal: true`, the position moves to trade history. No manual state management needed — the WebSocket push triggers the transition.

6. **Cursor-based pagination.** Trade history uses "Show more" pattern, never page numbers. Consistent with Foundation spec and real-time data compatibility.

7. **Graceful degradation.** WebSocket down -> SWR polling at 15s. API down -> show last cached data with stale banner. Go engine down -> mechanical slots show "Offline" badge, scanner slots continue.

8. **Stat cards truth source.** `closedTrades` count = `trades.filter(t => !t._premature).length` (same as `computeMetrics` in sweep.js). Never use raw trade array length.

9. **Append-only history.** Snapshot JSON files are never overwritten. Each pipeline run produces a new dated snapshot. Time Machine slider shows all available dates.

10. **Dark by default.** Light mode is opt-in. All component screenshots, OG images, and Telegram cards use the dark theme.
