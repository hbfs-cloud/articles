---
name: add-broker
description: Add a new broker adapter to the platform. Walks through BrokerAdapter interface implementation, instrument mapping, credential config, and validation.
version: 1.0.0
---

# Add Broker Adapter

## When to Use

- Adding support for a new brokerage (e.g., Kraken, Webull, Degiro)
- Porting an existing broker adapter from Node.js to Go
- Adding a paper-trading shim for a broker that lacks a sandbox API

## Prerequisites

- Go 1.24+ development environment
- Broker API documentation available
- Test account or sandbox credentials for the target broker
- PRD-07 (`specs/07-broker-adapters.md`) read for the 9-method adapter interface

## Steps

### Step 1: Choose Reference Implementation

Study the closest existing adapter:

| Market | Reference | File |
|--------|-----------|------|
| US equities | Alpaca | `internal/broker/alpaca.go` |
| EU equities | Saxo | `internal/broker/saxo.go` |
| Crypto | Binance | `internal/broker/binance.go` |
| UK equities | Trading212 | `internal/broker/trading212.go` |
| Global | IBKR | `internal/broker/ibkr.go` |

### Step 2: Implement BrokerAdapter Interface

Create `internal/broker/<name>.go`. Implement the canonical interface from PRD-25 §8.2:

- `Connect(ctx, creds)` — authenticate with broker API
- `Disconnect()` — close connections, cancel subscriptions
- `GetAccount()` — fetch buying power, equity, margin
- `GetPositions()` — list open positions with current P&L
- `GetOrders()` — list pending/filled orders
- `PlaceOrder(ctx, order)` — submit order with bracket (SL + TP)
- `CancelOrder(ctx, orderID)` — cancel pending order
- `GetOrderStatus(ctx, orderID)` — poll fill status
- `GetQuote(ctx, symbol)` — fetch current bid/ask/last
- `MapSymbol(symbol, assetClass)` — translate internal symbol to broker format
- `Ping()` — health check

### Step 3: Implement Instrument Mapping

In `MapSymbol()`, handle:
- US equities: usually 1:1 (NVDA → NVDA)
- EU equities: exchange suffix (AIR.PA → AIR:xpar for Saxo)
- Crypto: base+quote pair (BTC-USD → BTCUSDT for Binance)
- ETFs: London-listed suffixes for T212 (KWEB → KWEBl)

Document edge cases in `internal/broker/<name>/INSTRUMENT_NOTES.md`.

### Step 4: Add Credentials to .env.example

```bash
DT_BROKER_<NAME>_KEY=<your_key_here>
DT_BROKER_<NAME>_SECRET=<your_secret_here>
DT_BROKER_<NAME>_PAPER=true
```

Follow `DT_BROKER_*` naming convention from PRD-25 §6.1.

### Step 5: Register in Broker Factory

Add to `internal/broker/factory.go`:

```go
case "<name>":
    return New<Name>Adapter(cfg), nil
```

### Step 6: Add to Instrument Registry

Update `internal/instrument/registry.go` with broker-specific symbol mappings. Cross-reference PRD-08 for ISIN/UIC conventions.

### Step 7: Write Tests

- Unit tests: `internal/broker/<name>_test.go` — mock HTTP responses
- Integration test: `internal/broker/<name>_integration_test.go` — sandbox API (build tag `//go:build integration`)
- Test bracket order flow: place entry → verify SL/TP attached → cancel

### Step 8: Update Configuration

Add broker to `config.example.json` with default mode mappings and capital allocation.

### Step 9: Validate End-to-End

```bash
go test ./internal/broker/<name>/... -v
go run ./cmd/autotrader --mode bridge --broker <name> --dry-run
```

Run a paper trade session to verify the full lifecycle: connect → place → fill → bracket → exit.

## MCP Tools Used

| Tool | Purpose |
|------|---------|
| `GetInstruments` | Verify symbol mapping against DailyTickers registry |
| `QueryData(types=quote)` | Cross-check broker quotes against Yahoo Finance |

## Output

- `internal/broker/<name>.go` — adapter implementation
- `internal/broker/<name>_test.go` — unit tests
- Updated `.env.example` with credential placeholders
- Updated `config.example.json` with broker entry
- Updated `internal/broker/factory.go` registration

## Error Handling

- **Auth failure**: Return clear error with broker's error code. Never retry auth silently.
- **Rate limiting**: Implement exponential backoff per broker's documented limits.
- **Symbol not found**: Return `ErrInstrumentNotMapped` — do not guess mappings.
- **Sandbox unavailable**: Fall back to paper adapter with logged warning.

## Examples

### Example 1: Adding Kraken (Crypto)

```
1. Reference: internal/broker/binance.go (crypto pattern)
2. Implement: KrakenAdapter with WebSocket for fills
3. MapSymbol: BTC-USD → XXBTZUSD (Kraken format)
4. Env: DT_BROKER_KRAKEN_KEY, DT_BROKER_KRAKEN_SECRET, DT_BROKER_KRAKEN_PAPER=true
5. Test: Place limit buy on Kraken sandbox, verify bracket SL/TP
```

### Example 2: Adding Degiro (EU Equities)

```
1. Reference: internal/broker/saxo.go (EU pattern)
2. Implement: DegiroAdapter with session-based auth (no persistent API key)
3. MapSymbol: AIR.PA → productId lookup via Degiro search API
4. Env: DT_BROKER_DEGIRO_USER, DT_BROKER_DEGIRO_PASS, DT_BROKER_DEGIRO_PAPER=true
5. Note: No bracket orders — simulate with separate SL/TP orders
```
