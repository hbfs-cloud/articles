# PRD-08: Instrument Registry & Cross-Broker Mapping

**Version**: 1.0  
**Source**: `tools/gen-broker-instruments.js`, `tools/trading-executor/instruments/`, `tools/gen-trading-plan.js`  
**Status**: Authoritative specification — implement from this document only.

---

## 1. Overview

The instrument registry maps a canonical internal ticker symbol (e.g. `NVDA`) to its broker-specific identifier, tradability flags, and metadata for each supported broker. It is the single source of truth used by `gen-trading-plan.js` when building plan orders.

**Build tool**: `tools/gen-broker-instruments.js`  
**Output file**: `data/broker-instruments.json`  
**Input files**: `tools/trading-executor/instruments/{broker}.json` for each broker

---

## 2. `broker-instruments.json` — Full Schema

```json
{
  "generated_at": "2026-05-07T22:00:00.000Z",
  "source": "tools/trading-executor/instruments/",
  "brokers": ["alpaca", "ibkr", "trading212", "saxo", "binance"],
  "symbol_count": 5000,
  "symbols": {
    "NVDA": {
      "name": "NVIDIA Corporation",
      "brokers": {
        "alpaca": {
          "symbol": "NVDA",
          "exchange": "NASDAQ",
          "tradable": true,
          "marginable": true,
          "shortable": true,
          "min_order_size": 1,
          "price_increment": 0.01,
          "isin": "US67066G1040",
          "asset_type": "equity",
          "currency": "USD"
        },
        "ibkr": {
          "symbol": "NVDA",
          "exchange": "SMART",
          "tradable": true,
          "marginable": false,
          "shortable": false,
          "min_order_size": 0,
          "price_increment": 0.01,
          "isin": "US67066G1040",
          "asset_type": "equity",
          "currency": "USD"
        },
        "saxo": {
          "symbol": "NVDA:xnas",
          "exchange": "NASDAQ",
          "tradable": true,
          "marginable": false,
          "shortable": false,
          "min_order_size": 0,
          "price_increment": 0.01,
          "uic": 12345,
          "currency": "USD"
        },
        "trading212": {
          "symbol": "NVDA_US_EQ",
          "exchange": "NYSE_ARCA",
          "tradable": true,
          "marginable": false,
          "shortable": false,
          "min_order_size": 0,
          "price_increment": 0.01,
          "isin": "US67066G1040"
        },
        "binance": {
          "symbol": "NVDAUSDT",
          "exchange": "BINANCE",
          "tradable": true,
          "marginable": false,
          "shortable": false,
          "min_order_size": 0,
          "price_increment": 0.01,
          "asset_type": "crypto"
        }
      }
    },
    "BTC": {
      "name": "Bitcoin",
      "brokers": {
        "binance": {
          "symbol": "BTCUSDT",
          "exchange": "BINANCE",
          "tradable": true,
          "marginable": false,
          "shortable": false,
          "min_order_size": 0,
          "price_increment": 0.01,
          "asset_type": "crypto",
          "currency": "USDT"
        }
      }
    }
  }
}
```

### 2.1 Top-Level Fields

| Field | Type | Description |
|---|---|---|
| `generated_at` | ISO string | Build timestamp |
| `source` | string | Path to instruments source directory |
| `brokers` | string[] | List of brokers present in the registry |
| `symbol_count` | number | Total number of canonical symbols |
| `symbols` | Object | Map from canonical ticker → SymbolEntry |

### 2.2 SymbolEntry

| Field | Type | Description |
|---|---|---|
| `name` | string | Company/instrument name |
| `brokers` | Object | Map from broker name → BrokerEntry |

### 2.3 BrokerEntry

| Field | Type | Required | Description |
|---|---|---|---|
| `symbol` | string | Yes | Broker-specific symbol string |
| `exchange` | string | Yes | Exchange identifier (broker-specific format) |
| `tradable` | boolean | Yes | Can orders be placed for this instrument |
| `marginable` | boolean | Yes | Marginable (from source; false if not specified) |
| `shortable` | boolean | Yes | Shortable (from source; false if not specified) |
| `min_order_size` | number | Yes | Minimum order quantity (0 = no minimum enforced) |
| `price_increment` | number | Yes | Minimum price tick (default: 0.01) |
| `isin` | string | No | ISIN if available |
| `uic` | number | No | Saxo UIC (integer); only present in saxo entries |
| `asset_type` | string | No | `'equity'`, `'etf'`, `'crypto'`, `'index'` |
| `currency` | string | No | Instrument currency (e.g. `'USD'`, `'EUR'`, `'USDT'`) |

---

## 3. Per-Broker Instrument Source Files

Each source file lives at `tools/trading-executor/instruments/{broker}.json`.

### 3.1 Common Source File Schema

```json
{
  "broker": "alpaca",
  "fetched_at": "2026-05-07T10:00:00.000Z",
  "instruments": [
    {
      "internal_symbol": "NVDA",
      "broker_symbol": "NVDA",
      "name": "NVIDIA Corporation",
      "exchange": "NASDAQ",
      "tradable": true,
      "marginable": true,
      "shortable": true,
      "min_order_size": 1,
      "price_increment": 0.01,
      "isin": "US67066G1040",
      "asset_type": "equity",
      "currency": "USD"
    }
  ]
}
```

**`internal_symbol`**: The canonical ticker used as the key in `broker-instruments.json`. Must be set by the fetch/build process for each broker. This is the field the normalizer reads.

### 3.2 Alpaca Source

- `internal_symbol` = Alpaca's `symbol` field (identical for US equities).
- `broker_symbol` = same as `internal_symbol`.
- Extra fields preserved: `marginable`, `shortable`, `min_order_size` (from Alpaca `fractionable` / `min_order_size`).
- `asset_type`: Alpaca returns `us_equity` → map to `'equity'`.

**Alpaca fetch endpoint** (for refresh):
```
GET https://api.alpaca.markets/v2/assets?status=active&asset_class=us_equity
Headers: APCA-API-KEY-ID, APCA-API-SECRET-KEY
```
Response is an array of asset objects.

### 3.3 IBKR Source

- `internal_symbol` = ticker symbol (e.g. `NVDA`).
- `broker_symbol` = same.
- `exchange` = `'SMART'` for US equities (IBKR SMART routing).
- `uic` not applicable to IBKR (conid resolved at runtime via Client Portal API search).
- IBKR does not provide a bulk instrument list via Client Portal API — source file is maintained manually or populated from a prior search cache.

### 3.4 Saxo Source

- `internal_symbol` = canonical US ticker (e.g. `NVDA`).
- `broker_symbol` = Saxo display symbol with exchange suffix (e.g. `NVDA:xnas`).
- `uic` = integer Unique Instrument Code. **Must be populated** — the adapter uses this at order time. If UIC is null/missing, the adapter resolves it at runtime via:
  ```
  GET /ref/v1/instruments?Keywords={symbol}&AssetTypes=Stock,ETF&$top=1
  ```
  and caches in `_uicCache`.
- When building the Saxo source file, pre-populate UICs by calling the instrument search endpoint for each ticker. Missing UICs cause runtime latency.

### 3.5 Trading 212 Source

- `internal_symbol` = canonical ticker (see §4 for normalization rules).
- `broker_symbol` = T212's instrument ticker string (e.g. `NVDA_US_EQ`, `TSLA_US_EQ`).
- T212 uses a non-standard ticker format: `{BASE}_{MARKET}_{TYPE}` for equities.
- For London-listed ETFs: T212 appends a lowercase letter suffix to the base ticker (e.g. `KWEBl` for KWEB listed in London). The `internal_symbol` is normalized to the US canonical base (see §4.1).

**T212 fetch endpoint** (for refresh):
```
GET https://live.trading212.com/api/v0/equity/metadata/instruments
Headers: Authorization: {T212_API_KEY}
```
Returns array of instrument metadata objects. Key fields: `ticker` (broker symbol), `isin`, `name`, `currencyCode`, `type`.

### 3.6 Binance Source

- `internal_symbol` = base asset ticker (e.g. `BTC`, `ETH`, `SOL`, `XRP`).
- `broker_symbol` = USDT pair (e.g. `BTCUSDT`, `ETHUSDT`).
- Only USDT-quoted pairs are included.
- `asset_type` = `'crypto'` for all Binance entries.

**Binance fetch endpoint** (for refresh):
```
GET https://api.binance.com/api/v3/exchangeInfo
// resp.symbols where quoteAsset === 'USDT' and status === 'TRADING'
```

---

## 4. Normalization Rules

Applied by `gen-broker-instruments.js` when building `broker-instruments.json`.

### 4.1 Trading 212 Lowercase Suffix (London ETFs)

T212 uses a lowercase letter suffix on London-listed ETF tickers to distinguish them from US-listed equivalents.

**Rule**:
```javascript
// Regex: uppercase letters followed by exactly one lowercase letter
if (broker === 'trading212' && /^[A-Z]+[a-z]$/.test(internal_symbol)) {
  const base = internal_symbol.replace(/[a-z]$/, '');
  // If the base symbol already exists in the registry (from another broker):
  if (symbols[base]) {
    key = base;   // Merge this T212 entry under the canonical US ticker
  }
  // If base does NOT exist yet in registry: keep the suffixed symbol as-is
  // (edge case: T212 is the only source for this instrument)
}
```

**Examples**:
| T212 `internal_symbol` | Base | Canonical key | Rule |
|---|---|---|---|
| `KWEBl` | `KWEB` | `KWEB` | `KWEB` already in registry from Alpaca → merge |
| `EWZl` | `EWZ` | `EWZ` | `EWZ` already in registry → merge |
| `IEMGl` | `IEMG` | `IEMG` | merge |
| `XYZl` | `XYZ` | `XYZl` | `XYZ` not in registry → keep suffixed |

### 4.2 Missing Fields

Fields absent from the source instrument object get defaults:
```javascript
tradable:       inst.tradable !== false    // default true
marginable:     inst.marginable === true   // default false
shortable:      inst.shortable === true    // default false
min_order_size: inst.min_order_size || 0
price_increment: inst.price_increment || 0.01
```

### 4.3 Broker Entry Merge

If a symbol already exists in `symbols` (from a previously processed broker), merge the new broker entry:
```javascript
if (!symbols[key]) symbols[key] = { name: inst.name || '', brokers: {} };
else if (!symbols[key].name && inst.name) symbols[key].name = inst.name;
symbols[key].brokers[broker] = entry;
```

The `name` field is populated from the first broker that provides it. Subsequent brokers do not overwrite a non-empty `name`.

### 4.4 Symbol Deduplication

Within a single broker's source file, if `internal_symbol` appears more than once, only the first occurrence is kept (subsequent entries are ignored). Log a warning: `WARN: duplicate internal_symbol {symbol} in {broker}.json`.

---

## 5. Lookup Functions (`gen-trading-plan.js`)

These three functions are defined in `gen-trading-plan.js` and consume `data/broker-instruments.json` at startup.

```javascript
// Load at module initialization
const brokerMap = JSON.parse(fs.readFileSync('data/broker-instruments.json', 'utf8'));
const BROKER_LOOKUP = process.env.BROKER || 'paper';  // resolved from --broker CLI arg
```

### 5.1 `brokerSymbol(ticker, broker?)`

Returns the broker-specific symbol string for a given internal ticker.

```javascript
/**
 * @param {string} ticker       - Canonical ticker (e.g. "NVDA")
 * @param {string} [broker]     - Broker name (default: BROKER_LOOKUP from CLI)
 * @returns {string}            - Broker-specific symbol, or ticker unchanged if not found
 */
function brokerSymbol(ticker, broker = BROKER_LOOKUP) {
  const entry = brokerMap.symbols?.[ticker]?.brokers?.[broker];
  return entry?.symbol || ticker;
}
```

**Behavior when broker entry missing**: return `ticker` as-is. This allows unknown tickers to pass through unchanged (paper mode can trade any symbol via Yahoo Finance).

### 5.2 `brokerRestrictions(ticker, broker?)`

Returns tradability and order constraints for a ticker/broker pair.

```javascript
/**
 * @param {string} ticker
 * @param {string} [broker]
 * @returns {BrokerRestrictions}
 */
function brokerRestrictions(ticker, broker = BROKER_LOOKUP) {
  const entry = brokerMap.symbols?.[ticker]?.brokers?.[broker];
  return {
    tradable:        entry?.tradable ?? true,
    marginable:      entry?.marginable ?? false,
    shortable:       entry?.shortable ?? false,
    min_order_size:  entry?.min_order_size ?? 0,
    price_increment: entry?.price_increment ?? 0.01,
  };
}
```

**BrokerRestrictions shape**:
```javascript
{
  tradable: boolean,         // false = skip this ticker for this broker
  marginable: boolean,
  shortable: boolean,
  min_order_size: number,    // 0 = no restriction
  price_increment: number,   // minimum price tick
}
```

### 5.3 `brokerInfo(ticker, broker?)`

Returns the full broker entry object. Used to populate the `order.broker` field in trading plans.

```javascript
/**
 * @param {string} ticker
 * @param {string} [broker]
 * @returns {BrokerEntry | {}}   - Full broker entry or empty object if not found
 */
function brokerInfo(ticker, broker = BROKER_LOOKUP) {
  return brokerMap.symbols?.[ticker]?.brokers?.[broker] || {};
}
```

Returns an empty object `{}` if ticker/broker combination is not in the registry. The plan order's `broker` field will be incomplete but not undefined — callers handle missing UIC at runtime.

---

## 6. Build Process (`gen-broker-instruments.js`)

### 6.1 Entry Point

```javascript
// Usage:
node tools/gen-broker-instruments.js

// Output: data/broker-instruments.json
// Input:  tools/trading-executor/instruments/{broker}.json for each broker in BROKER_FILES
```

### 6.2 Processing Order

Brokers are processed in this fixed order:
```javascript
const BROKER_FILES = {
  alpaca:     'alpaca.json',
  ibkr:       'ibkr.json',
  trading212: 'trading212.json',
  saxo:       'saxo.json',
  binance:    'binance.json',
};
```

Processing order matters for normalization: if Alpaca has `KWEB` and T212 has `KWEBl`, Alpaca must be processed first so that `symbols['KWEB']` exists when T212 is processed.

### 6.3 Algorithm

```javascript
const symbols = {};

for (const [broker, file] of Object.entries(BROKER_FILES)) {
  const fpath = path.join(INSTRUMENTS_DIR, file);
  if (!fs.existsSync(fpath)) {
    console.warn(`  skip ${broker}: ${file} not found`);
    continue;
  }

  const raw = JSON.parse(fs.readFileSync(fpath, 'utf8'));
  const instruments = raw.instruments || [];
  let mapped = 0;

  for (const inst of instruments) {
    let key = inst.internal_symbol;
    if (!key) continue;                          // Skip entries without internal_symbol

    // T212 lowercase suffix normalization (§4.1)
    if (broker === 'trading212' && /^[A-Z]+[a-z]$/.test(key)) {
      const base = key.replace(/[a-z]$/, '');
      if (symbols[base]) key = base;
    }

    // Initialize or merge symbol entry
    if (!symbols[key]) symbols[key] = { name: inst.name || '', brokers: {} };
    else if (!symbols[key].name && inst.name) symbols[key].name = inst.name;

    // Build broker entry
    const entry = {
      symbol:          inst.broker_symbol,
      exchange:        inst.exchange || '',
      tradable:        inst.tradable !== false,
      marginable:      inst.marginable === true,
      shortable:       inst.shortable === true,
      min_order_size:  inst.min_order_size || 0,
      price_increment: inst.price_increment || 0.01,
    };

    // Conditionally include optional fields
    if (inst.isin)       entry.isin       = inst.isin;
    if (inst.uic)        entry.uic        = inst.uic;
    if (inst.asset_type) entry.asset_type = inst.asset_type;
    if (inst.currency)   entry.currency   = inst.currency;

    symbols[key].brokers[broker] = entry;
    mapped++;
  }

  console.log(`  ${broker}: ${mapped} instruments mapped`);
}

// Write output
const output = {
  generated_at:  new Date().toISOString(),
  source:        INSTRUMENTS_DIR,
  brokers:       Object.keys(BROKER_FILES),
  symbol_count:  Object.keys(symbols).length,
  symbols,
};
fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2));
console.log(`Written: ${OUTPUT} (${output.symbol_count} symbols)`);
```

### 6.4 Paths

```javascript
const INSTRUMENTS_DIR = path.join(__dirname, 'trading-executor', 'instruments');
const OUTPUT = path.join(__dirname, '..', 'data', 'broker-instruments.json');
```

(`__dirname` = `tools/`)

---

## 7. Handling Missing Instruments

### 7.1 Ticker Not Available on a Broker

When `brokerSymbol(ticker, broker)` returns the original ticker unchanged (because no entry exists), the order is still built in the plan. The Engine will attempt to place the order via the adapter. The adapter will either:
- Successfully resolve it at runtime (e.g. IBKR conid search, Saxo UIC search).
- Throw `SYMBOL_NOT_FOUND` error → Engine logs ERROR, skips the order (plan `error_handlers.SYMBOL_NOT_FOUND.action = 'SKIP'`).

### 7.2 tradable === false

In `gen-trading-plan.js`, before building an order for a ticker, check tradability:
```javascript
const restrictions = brokerRestrictions(signal.ticker);
if (!restrictions.tradable) {
  orders.push({ id: orderId, action: 'SKIP', reason: 'NOT_TRADABLE', ticker: signal.ticker });
  continue;
}
```

SKIP orders are included in the plan for audit purposes but never submitted to the broker.

### 7.3 min_order_size Enforcement

When computing `shares` for an order:
```javascript
const restrictions = brokerRestrictions(signal.ticker);
let shares = Math.floor(positionNominal / entryPrice);
if (restrictions.min_order_size > 0) {
  shares = Math.max(shares, restrictions.min_order_size);
}
if (shares === 0) {
  // Skip — cannot place 0-share order
  orders.push({ id: orderId, action: 'SKIP', reason: 'INSUFFICIENT_CAPITAL', ticker: signal.ticker });
  continue;
}
```

### 7.4 Missing Broker Source File

If a broker's source file does not exist in `tools/trading-executor/instruments/`, `gen-broker-instruments.js` prints a warning and continues:
```
  skip {broker}: {file} not found
```
The registry is built from available files. The broker is still listed in `brokers[]` array if it was defined in `BROKER_FILES` (for documentation purposes), but no symbols will have entries for it.

---

## 8. Instrument Source File Refresh

Source files are not auto-updated during normal pipeline runs. They are static and updated manually or via a dedicated refresh script.

### 8.1 Refresh Process (Manual)

For each broker, run the broker's fetch endpoint (§3.x) and write output to `instruments/{broker}.json` in the required schema.

After refreshing any source file:
```bash
node tools/gen-broker-instruments.js
```

This rebuilds `data/broker-instruments.json` from all source files.

### 8.2 When to Refresh

- New tickers added to scanner watchlist.
- Broker instrument universe changes (new listings, delistings).
- After a Saxo token refresh (UIC cache may be stale if instruments were reclassified).
- Periodic maintenance: weekly at minimum.

---

## 9. Special Cases by Broker

### 9.1 Alpaca

- All US equities use ticker symbols directly as both `internal_symbol` and `broker_symbol`.
- No suffix, no numeric ID.
- `exchange` values: `'NASDAQ'`, `'NYSE'`, `'ARCA'`, `'BATS'`.

### 9.2 IBKR

- All US equities route via `exchange: 'SMART'` (IBKR SMART routing).
- `conid` (IBKR's contract ID) is **not stored** in the registry — it is resolved at runtime via Client Portal API search and cached per session in `_conidCache`.
- European stocks: exchange code is the MIC code (e.g. `'IBIS'` for Deutsche Börse, `'LSE'` for London Stock Exchange).

### 9.3 Saxo

- `broker_symbol` uses exchange-qualified format: `{TICKER}:{EXCHANGE_MIC}` (e.g. `NVDA:xnas`, `AIR:xpar`).
- `uic` is a required integer. If 0 or missing: adapter resolves via Saxo instrument search endpoint and the result is cached in `_uicCache`. The registry UIC serves as a pre-warm for the cache.
- Simulation and live use the same symbol format and UICs.

### 9.4 Trading 212

- `broker_symbol` format: `{TICKER}_{MARKET}_{TYPE}` (e.g. `NVDA_US_EQ`, `AAPL_US_EQ`, `TSLA_US_EQ`).
- London ETFs: `broker_symbol` includes the lowercase suffix in T212's system (e.g. `KWEBl`), but `internal_symbol` in the registry is normalized to the canonical US base (`KWEB`). The `broker_symbol` field in the BrokerEntry correctly preserves `KWEBl` as what the API expects.
- T212 is long-only: `shortable` is always `false`.
- T212 has no native quote API: getQuote uses Yahoo Finance fallback (see PRD-07 §4.5).
- ~23 US ETFs available on US exchanges are not listed on T212. These tickers will have no `trading212` entry in the registry; orders skip cleanly via `tradable` check.

### 9.5 Binance

- `internal_symbol` = base asset only: `BTC`, `ETH`, `SOL`, `XRP`, `BNB`, etc.
- `broker_symbol` = USDT pair: `BTCUSDT`, `ETHUSDT`, `SOLUSDT`.
- Only USDT-quoted spot pairs are included.
- `asset_type` = `'crypto'` for all Binance entries.
- Binance is used exclusively for `tkl` mode.
- For order placement, the adapter uses `broker_symbol` directly (the `BTCUSDT` form).

---

## 10. Integration with `gen-trading-plan.js`

The three lookup functions (`brokerSymbol`, `brokerRestrictions`, `brokerInfo`) are called during plan order construction for each signal:

```javascript
// In makeOrder(signal, action, overrideQty):
const sym         = brokerSymbol(signal.ticker);          // broker-specific symbol
const restrictions = brokerRestrictions(signal.ticker);   // tradability check + min size
const info        = brokerInfo(signal.ticker);            // full broker entry for plan metadata

if (!restrictions.tradable) {
  return { id: orderId, action: 'SKIP', reason: 'NOT_TRADABLE', ticker: signal.ticker };
}

// ...compute shares, prices...

return {
  id: orderId,
  action: action,
  ticker: signal.ticker,
  broker_symbol: sym,
  broker: info,          // BrokerEntry (symbol, exchange, isin, uic, currency, asset_type, etc.)
  entry: { ... },
  exit: { ... },
  conditions: [ ... ],
  metadata: { ... },
};
```

The `order.broker` field in the plan is the raw BrokerEntry object. The adapter reads `order.broker.symbol` at execution time to confirm the symbol to use. For Saxo, it also reads `order.broker.uic` to pre-warm the UIC cache.

> **Unified Engine note**: The instrument registry is shared across all signal sources (PRD-23). Mechanical strategies (Go bridge) produce signals with canonical tickers that are resolved through this same registry before plan generation.

<!-- Consistency pass: aligned with PRD-23 Unified Strategy Engine, 2026-05-07 -->
