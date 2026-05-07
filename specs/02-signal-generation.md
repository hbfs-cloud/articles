# PRD-02: Signal Generation Engine

**Version**: 1.1  
**Depends on**: PRD-01 (Market Data Collection)  
**Consumed by**: PRD-03 (Risk Management), PRD-23 (Unified Strategy Engine — scanner strategy adapter)

---

## 1. Purpose

Transform raw screener candidates from PRD-01 into a scored, validated, diversified set of signals ready for risk gating. Output is `signals.json` written to disk and passed as a structured object to PRD-03.

All logic in this module is deterministic given the same `CollectionResult` input. No MCP calls are made here — all data is sourced from PRD-01's `CollectionResult`.

---

## 2. Inputs / Outputs

**Input**: `CollectionResult` (full schema in PRD-01 § 9)

**Output**:
1. `signals.json` written to `data/signals-{scanDate}.json`
2. `SignalGenerationResult` object passed to PRD-03

---

## 3. `signals.json` — Complete Schema

```json
{
  "scanDate": "2026-05-07",
  "generatedAt": "2026-05-07T23:16:00Z",
  "regime": "NEUTRAL",
  "regimeScore": 50,
  "signals": [
    {
      "ticker": "NVDA",
      "name": "NVIDIA Corp",
      "score": 93,
      "strategy": "Momentum",
      "region": "US",
      "sector": "Technology",
      "exchange": "NASDAQ",
      "market_cap": 2800000000000,
      "adv_usd": 4500000000,
      "entry": 885.40,
      "entry_mid": 887.65,
      "stop": 858.00,
      "tp1": 930.00,
      "tp2": 975.00,
      "rr": "1:2.2",
      "rr_numeric": 2.2,
      "horizon": 10,
      "sharia": true,
      "thesis": "Momentum expansion on AI infrastructure theme. Vol surge 2.1× avg. Dark pool accumulation signal. Insider buy CFO 10k shares Apr 28.",
      "confluence": ["rsi_zone", "vol_surge", "dark_pool", "insider_buy"],
      "invalidations": [],
      "badges": [],
      "source": "auto_screener",
      "dilution_flag": null
    }
  ],
  "tkl_pool": [
    {
      "ticker": "CLSK",
      "name": "CleanSpark Inc",
      "score": 87,
      "strategy": "Momentum",
      "region": "US",
      "sector": "Energy",
      "exchange": "NASDAQ",
      "market_cap": 1200000000,
      "adv_usd": 85000000,
      "entry": 14.22,
      "stop": 13.50,
      "tp1": 15.65,
      "rr": "1:2.0",
      "rr_numeric": 2.0,
      "horizon": 5,
      "sharia": true,
      "source": "tkl_volume_surge",
      "dilution_flag": null,
      "confluence": ["vol_surge", "sma20_hold"],
      "invalidations": []
    }
  ],
  "dropped": [
    {
      "ticker": "WOLF",
      "reason": "dilution_risk_score_gte_70",
      "score_before_drop": 84,
      "details": "flags.dilution_risk_score=78"
    }
  ],
  "stats": {
    "candidates_in": 87,
    "after_market_cap_filter": 72,
    "after_adv_filter": 68,
    "after_anti_duplicate": 61,
    "after_anti_dilution": 58,
    "after_earnings_filter": 55,
    "after_smart_money": 53,
    "main_pool_final": 10,
    "tkl_pool_final": 10,
    "dropped_total": 34
  }
}
```

---

## 4. Validation Pipeline — Complete Decision Tree

Execute checks IN ORDER. Each check can DROP (remove from candidates) or FLAG (continue with penalty or badge).

### Step 0 — Split Candidates

Before scoring, split `CollectionResult` into two parallel pipelines:

- **Main pool**: `screenerCandidates` (from `RunAutoScreener` + `oversold_bounce` + `momentum_expansion` + `breakout_squeeze`)
- **TKL pool**: `tklCandidates` (from `tkl_momentum` + `tkl_breakout` + `tkl_volume_surge`)

Tickers appearing in both pools: keep in main pool only (main pool takes precedence).

---

### Step 1 — Market Cap Filter

**Main pool**: `market_cap >= 500_000_000` (≥ $500M)  
**TKL pool**: `market_cap >= 10_000_000` (≥ $10M)

```
if enrichedData[ticker].quote.market_cap < threshold:
  DROP ticker, reason="market_cap_below_threshold"
```

Source: `enrichedData[ticker].quote.market_cap` (MCP) OR `enrichedData[ticker].fundamentals.marketCap` (Yahoo). Use whichever is non-null. If both null → DROP, reason="market_cap_unavailable".

---

### Step 2 — ADV Filter (Average Daily Volume in USD)

**Main pool**: `adv_usd >= 10_000_000` (≥ $10M)  
**TKL pool**: `adv_usd >= 2_000_000` (≥ $2M)

```
adv_usd = candidate.adv_usd ?? enrichedData[ticker].quote.adv_usd
if adv_usd < threshold:
  DROP ticker, reason="adv_below_threshold"
```

---

### Step 3 — Anti-Duplicate (Open Position Check)

Load `scanner-positions.json` (unified positions file, see PRD-05 §7.2) from disk. This file contains all currently open positions across all strategy slots (formerly "modes").

**Structure expected**:
```json
{
  "positions": [
    { "ticker": "NVDA", "strategySlotId": "balanced", "entryDate": "2026-05-02", "status": "open" }
  ]
}
```

```
openTickers = Set(positions.filter(p => p.status == "open").map(p => p.ticker))
if ticker in openTickers:
  DROP ticker, reason="position_already_open"
```

---

### Step 4 — Anti-Dilution v2 (MCP-Driven)

Source: `enrichedData[ticker].flags` (from `QueryData types=sec_filings,flags days=180`)

**Aggressive underwriter list** (exact strings to match):
```
["H.C. Wainwright", "Maxim Group", "Roth Capital", "Ladenburg Thalmann",
 "Dawson James", "Aegis Capital", "EF Hutton", "Boustead Securities"]
```

**Decision tree** (evaluate IN ORDER, stop at first DROP):

```
flags = enrichedData[ticker].flags

# Rule 1: High dilution risk score
if flags.dilution_risk_score >= 70:
  DROP ticker, reason="dilution_risk_score_gte_70"

# Rule 2: Active shelf + recent S-3
if flags.shelf_active == true:
  s3_filing = sec_filings.find(f => f.type == "S-3" && days_since(f.date) < 90)
  if s3_filing exists:
    DROP ticker, reason="shelf_active_s3_recent"

# Rule 3: ATM program active
if flags.atm_program_active == true:
  DROP ticker, reason="atm_program_active"

# Rule 4: Aggressive underwriter
if flags.aggressive_underwriter == true:
  DROP ticker, reason="aggressive_underwriter"

# Rule 5: Warrants ITM proximity
if flags.warrants_outstanding == true:
  if flags.warrants_itm_proximity != null && flags.warrants_itm_proximity < 0.20:
    DROP ticker, reason="warrants_itm_imminent"

# Rule 6: Recent PIPE
if flags.recent_pipe == true:
  if flags.pipe_date != null && days_since(flags.pipe_date) < 180:
    DROP ticker, reason="recent_pipe_lt_180d"

# Rule 7: Recent reverse split
if flags.reverse_split_recent == true:
  if flags.reverse_split_date != null && days_since(flags.reverse_split_date) < 180:
    DROP ticker, reason="reverse_split_lt_180d"

# Rule 8: Medium dilution risk — penalty only, no DROP
if 40 <= flags.dilution_risk_score < 70:
  score -= 15
  invalidations.push("Dilution risk score " + flags.dilution_risk_score + "/100 — elevated risk")
  dilution_flag = "medium_risk_score_" + flags.dilution_risk_score
```

**Fallback**: If `flags` is null (QueryData returned nothing for this ticker):
- For main pool: trigger `WebSearch "{TICKER} SEC filing S-3 prospectus dilution warrants"` (browser fallback). Parse results manually. If inconclusive → proceed with `dilution_flag: "unverified"`.
- For TKL pool micro-caps: same fallback.

---

### Step 5 — Earnings Window Exclusion

Source: `CollectionResult.earningsExclusions`

```
scanDateObj = Date.parse(scanDate)

for each earningsEvent in earningsExclusions:
  if ticker == earningsEvent.ticker:
    windowStart = Date.parse(earningsEvent.exclusion_window_start)
    windowEnd = Date.parse(earningsEvent.exclusion_window_end)
    if scanDateObj >= windowStart && scanDateObj <= windowEnd:
      DROP ticker, reason="earnings_exclusion_window"
    elif days_until(earningsEvent.earnings_date) <= 7:
      FLAG ticker, badge="earnings_risk"
      # Do NOT drop — tag only
```

---

### Step 6 — Smart Money Bearish Signal

Source: `enrichedData[ticker].unusual_options`

```
opts = enrichedData[ticker].unusual_options

if opts != null:
  if opts.put_call_ratio < 0.4 AND opts.large_put_sweeps > 2 × opts.large_call_sweeps:
    # Inverse signal: low P/C ratio combined with PUT sweep dominance = smart money bearish
    # Note: put_call_ratio < 0.4 = call-heavy, but paired with put sweeps = disguised bearish
    DROP ticker, reason="smart_money_bearish_divergence"
```

Note: `put_call_ratio < 0.4` alone is bullish (calls > puts). DROP only fires when put SWEEP count dominates despite low ratio, indicating large institutional put buying masked by retail calls.

---

### Step 7 — Sharia Compliance Tagging

**Haram sectors** (exact strings, case-insensitive match against `sector` field):
```
["Banks", "Insurance", "Defense", "Alcohol", "Tobacco", "Gambling",
 "Financial Services", "Aerospace & Defense", "Beverages—Brewers",
 "Beverages—Wineries & Distilleries", "Casinos & Gaming"]
```

**Haram ETF types** (match against name or description):
```
["bond", "treasury", "leveraged", "inverse", "2x", "3x", "-2x", "-3x"]
```

**Sharia compliance formula**:
```
fund = enrichedData[ticker].fundamentals

sector_haram = ticker.sector in HARAM_SECTORS
etf_haram = isETF(ticker) AND etfTypeIsHaram(ticker.name)
debt_ratio_fail = fund.debt_to_market_cap > 0.33
interest_ratio_fail = fund.interest_revenue_ratio > 0.05

sharia = NOT (sector_haram OR etf_haram OR debt_ratio_fail OR interest_ratio_fail)
```

`sharia` field is set on every signal. Never drops — tagging only. PRD-03 dashboard uses this field for filtering.

---

### Step 8 — Insider Transaction Signal

Source: `enrichedData[ticker].insider_transactions` (last 180 days)

```
transactions = enrichedData[ticker].insider_transactions
buys = transactions.filter(t => t.type == "buy")
sells = transactions.filter(t => t.type == "sell")

# Score modifiers
if buys.length >= 1 AND sum(buys.value_usd) > 1_000_000:
  score += 5
  badges.push("insider_buy")

if buys.length >= 3:  # Cluster = multiple insiders buying
  score += 10
  badges.push("insider_cluster")

if sells.length >= 1 AND sum(sells.value_usd) > 5_000_000:
  score -= 5
  # No badge for sells — just penalty
```

Apply BEFORE final score normalization. Modifiers stack.

---

## 5. Scoring Engine — Main Pool

### 5.1 Base Score Computation

Compute for each candidate that passed all DROP filters.

```
score = 60  # baseline

# RSI Zone
if 50 <= rsi14 <= 65:  score += 8   # momentum_expansion sweet spot
elif 35 <= rsi14 < 50: score += 5   # pullback zone
elif rsi14 < 35:       score += 6   # oversold bounce

# Volume Surge
vol_ratio = enrichedData[ticker].quote.volume / enrichedData[ticker].quote.avg_volume_20d
if vol_ratio >= 3.0:   score += 10
elif vol_ratio >= 2.0: score += 7
elif vol_ratio >= 1.5: score += 4

# Trend Alignment
if close > sma20 AND sma20 > sma50:  score += 8   # strong uptrend
elif close > sma20:                   score += 5   # above 20d only
elif close > sma50:                   score += 2   # above 50d only

# ATR Expansion (volatility building)
atr_ratio = atr14 / atr28
if atr_ratio >= 1.2:   score += 6
elif atr_ratio >= 1.05: score += 3

# Dark Pool Signal
dp = enrichedData[ticker].dark_pool
if dp != null AND dp.dp_trend == "accumulation" AND dp.dark_pool_pct >= 35:
  score += 7
  confluence.push("dark_pool")

# Social Sentiment
ss = enrichedData[ticker].social_sentiment
if ss != null AND ss.stocktwits_bullish_pct >= 65:
  score += 4
  confluence.push("social_sentiment")

# Capital Flow
cf = enrichedData[ticker].capital_flow
if cf != null AND cf.net_flow_7d_usd > 0 AND cf.institutional_buy_pct >= 60:
  score += 5
  confluence.push("institutional_flow")

# Unusual Options (bullish)
opts = enrichedData[ticker].unusual_options
if opts != null AND opts.call_put_ratio >= 2.0 AND opts.large_call_sweeps >= 2:
  score += 6
  confluence.push("unusual_options_bullish")

# Support proximity (buying near support = lower risk entry)
sr = enrichedData[ticker].support_resistance
if sr != null:
  support_proximity = (close - sr.support_1) / close
  if 0 <= support_proximity <= 0.03:  score += 5   # within 3% of support
  elif 0.03 < support_proximity <= 0.07: score += 2

# FTD Risk (negative)
ftd = enrichedData[ticker].ftd_threshold
if ftd != null AND ftd.on_threshold_list == true:
  score -= 8

# Apply insider modifiers (from Step 8 above)
score += insider_modifier  # already computed

# Clamp to [60, 99]
score = clamp(score, 60, 99)
```

### 5.2 Confluence Count

A signal must have `confluence.length >= 3` to qualify for the top 10.

```
# Confluence signals counted:
rsi_zone       = rsi14 in [35,75]                     → push "rsi_zone"
vol_surge      = vol_ratio >= 1.5                      → push "vol_surge"
sma20_hold     = close > sma20                         → push "sma20_hold"
atr_expansion  = atr_ratio >= 1.05                     → push "atr_expansion"
dark_pool      = dp.dp_trend == "accumulation"         → push "dark_pool"
social_sent    = ss.stocktwits_bullish_pct >= 65       → push "social_sentiment"
inst_flow      = cf.institutional_buy_pct >= 60        → push "institutional_flow"
unusual_opts   = call_put_ratio >= 2.0                 → push "unusual_options_bullish"
support_prox   = support_proximity <= 0.03             → push "near_support"
insider_buy    = see Step 8                            → push "insider_buy" / "insider_cluster"

if confluence.length < 3:
  DROP ticker, reason="insufficient_confluence"
```

### 5.3 Strategy Assignment

Assign exactly one strategy from the allowed set: `["Momentum", "Breakout", "Pullback", "Pre-Squeeze"]`

```
strategy_hint = candidate.strategy_hint  # from screener

if strategy_hint == "momentum_expansion":    strategy = "Momentum"
elif strategy_hint == "breakout_squeeze":    strategy = "Breakout"
elif strategy_hint == "oversold_bounce":     strategy = "Pullback"
elif rsi14 < 40 AND atr_ratio < 1.0:        strategy = "Pre-Squeeze"
else:
  # Derive from RSI + trend
  if rsi14 > 50 AND close > sma20:          strategy = "Momentum"
  elif close > high_52w * 0.97:             strategy = "Breakout"
  elif close < sma20 AND rsi14 < 45:        strategy = "Pullback"
  else:                                      strategy = "Momentum"  # default
```

### 5.4 Entry / Stop / TP Level Computation

```
entry = enrichedData[ticker].quote.last  # current price

# Stop loss
atr = enrichedData[ticker].bars_daily[-1].atr14  # from bars_daily, last bar
  # If atr14 not in bars_daily, use candidate.atr14
stop_distance = atr * 1.5
stop = round(entry - stop_distance, 2)

# TP levels
entry_mid = (entry + stop) / 2  # used for R/R calculation
risk = entry - stop

tp1 = round(entry + risk * 2.0, 2)   # 2:1 minimum
tp2 = round(entry + risk * 3.5, 2)   # extended target

# R/R ratio (always from entry, not entry_mid)
rr_numeric = risk > 0 ? round((tp1 - entry) / risk, 1) : 0
rr = "1:" + rr_numeric.toFixed(1)

# Horizon (trading days)
horizon = strategy == "Momentum" ? 10 : strategy == "Breakout" ? 8 : 5
```

**R/R Gate**:
```
if rr_numeric < 1.5:
  DROP ticker, reason="rr_below_minimum"
```

### 5.5 Score Gate

```
if score < 90:
  DROP ticker from main pool (move to pending_tkl if score >= 85)
```

### 5.6 Thesis Generation

```
thesis = buildThesis(ticker, strategy, confluence, enrichedData[ticker])
```

**Thesis template by strategy**:
- **Momentum**: `"{name} momentum expansion on {top_theme}. Vol {vol_ratio}× avg. {social_if_any}. {insider_if_any}."`
- **Breakout**: `"{name} breaking {resistance} level with {vol_ratio}× volume. ATR expansion {atr_ratio}×. {dark_pool_if_any}."`
- **Pullback**: `"{name} oversold bounce from {support} support. RSI {rsi14} recovering. {flow_if_any}."`
- **Pre-Squeeze**: `"{name} pre-squeeze setup. ATR compression vs 28d. RSI {rsi14} coiling. Vol drying up."`

Max 200 characters. No hallucinated data — only reference values already in enrichedData.

---

## 6. Scoring Engine — TKL Pool

### 6.1 TKL Score Formula

```
# Raw score (same computation as § 5.1, but with TKL thresholds)
raw_score = computeBaseScore(candidate, enrichedData)

# Strategy bonus
stratBonus = {
  "Momentum": 3,
  "Breakout": 2,
  "Pre-Squeeze": 4,
  "Pullback": 1
}[strategy]

# TKL normalized score (range: 85 to 91)
tkl_score = 85 + (stratBonus * 0.4) + clamp((rr_numeric - 1.5) * 4, 0, 6)
tkl_score = round(tkl_score, 0)
tkl_score = clamp(tkl_score, 85, 91)
```

### 6.2 TKL Confluence Minimum

Same confluence signals, but minimum threshold is **2** (vs 3 for main pool).

```
if confluence.length < 2:
  DROP from TKL pool, reason="insufficient_confluence_tkl"
```

### 6.3 TKL R/R Gate

Same minimum: `rr_numeric >= 1.5`. Only TP1 required (no TP2 for TKL signals).

### 6.4 TKL Score Gate

```
if tkl_score < 82:
  DROP from TKL pool, reason="tkl_score_below_82"
```

---

## 7. Diversification Rules

Applied after all per-ticker filters. Operates on the sorted candidate list (descending score).

### 7.1 Geographic Diversification

**Target composition**:
- Min 5 US tickers
- Min 2 EU tickers (region = `EU`)
- Min 1 APAC ticker (region = `APAC`)
- Min 2 ETFs (instrument type = `ETF`)

**Enforcement**: If minimum counts not met after filtering, do NOT add lower-quality tickers to fill. Instead, log `WARN:diversification_incomplete` and finalize with available tickers.

### 7.2 Sector Cap

Main pool: max 3 tickers per sector.

```
sectorCount = {}
for candidate in sorted_candidates:
  sector = candidate.sector
  if sectorCount[sector] >= 3:
    DROP ticker, reason="sector_cap_exceeded"
  else:
    sectorCount[sector]++
    add to final list
```

### 7.3 Anti-Repeat (Previous Scan)

Load previous scan's `signals.json` (date = most recent file in `data/signals-*.json`).

```
prevTickers = Set(prevSignals.signals.map(s => s.ticker))
newTickers = currentCandidates.map(c => c.ticker)
repeatCount = newTickers.filter(t => prevTickers.has(t)).length
repeatPct = repeatCount / newTickers.length

if repeatPct > 0.30:  # More than 30% repeats = more than 30% old tickers
  # Force-rotate: sort candidates by score, keep top-scoring repeats
  # Remove lowest-scoring repeats until repeatPct <= 0.30
  while repeatPct > 0.30:
    lowestRepeat = sorted repeats by score ascending, take first
    DROP lowestRepeat, reason="anti_repeat_rotation"
    recompute repeatPct
```

Target: **at most 30% repeats** from previous scan (≥ 70% new tickers).

### 7.4 Final Selection

After all filters and diversification:

```
# Main pool: take top 10 by score (descending)
mainPool = candidates.slice(0, 10)

# TKL pool: take top 10 by tkl_score (descending)
tklPool = tklCandidates.slice(0, 10)
```

If main pool has < 10 candidates after all filters: do not pad. Use however many pass.  
If TKL pool has < 5: log `WARN:tkl_pool_thin`.

---

## 8. `regimeScore` Computation

```
regime = CollectionResult.regime.current_state
confidence = CollectionResult.regime.current_state_confidence

regimeScoreMap = {
  "RISK-ON":      { base: 80, direction: +1 },
  "RECOVERY":     { base: 70, direction: +1 },
  "NEUTRAL":      { base: 50, direction:  0 },
  "EARLY RISK-OFF": { base: 30, direction: -1 },
  "RISK-OFF":     { base: 10, direction: -1 }
}

base = regimeScoreMap[regime].base
regimeScore = round(base * confidence + 50 * (1 - confidence))
regimeScore = clamp(regimeScore, 0, 100)
```

---

## 9. Complete Processing Order

```
1.  Split candidates → main pool + TKL pool
2.  Step 1: Market cap filter          [both pools, different thresholds]
3.  Step 2: ADV filter                 [both pools, different thresholds]
4.  Step 3: Anti-duplicate (open pos)  [both pools]
5.  Step 4: Anti-dilution v2           [both pools]
6.  Step 5: Earnings window            [both pools]
7.  Step 6: Smart money bearish check  [both pools]
8.  Main pool: computeBaseScore()      [main pool only]
8b. Apply insider modifiers            [main pool only]
9.  Main pool: confluence check ≥ 3    [main pool only]
10. Main pool: strategy assignment     [main pool only]
11. Main pool: entry/stop/TP levels    [main pool only]
12. Main pool: R/R gate ≥ 1.5         [main pool only]
13. Main pool: score gate ≥ 90         [main pool only]
14. TKL pool: computeBaseScore()       [TKL pool only]
14b. Apply insider modifiers           [TKL pool only]
15. TKL pool: confluence check ≥ 2     [TKL pool only]
16. TKL pool: strategy assignment      [TKL pool only]
17. TKL pool: entry/stop/TP levels     [TKL pool only]
18. TKL pool: R/R gate ≥ 1.5          [TKL pool only]
19. TKL pool: tkl_score formula        [TKL pool only]
20. TKL pool: score gate ≥ 82          [TKL pool only]
21. Step 7: Sharia tagging             [both pools — no DROP]
22. Step 8: Insider badges             [both pools — already applied in 8b/14b]
23. Diversification: geo + sector cap  [main pool]
24. Diversification: anti-repeat       [main pool]
25. Final selection: top 10 main       [main pool]
26. Final selection: top 10 TKL        [TKL pool]
27. Thesis generation                  [both pools]
28. regimeScore computation
29. Write signals.json
30. Return SignalGenerationResult → PRD-03
```

---

## 10. Error Handling

| Condition | Action |
|-----------|--------|
| `scanner-positions.json` (unified positions) missing | Log WARN, skip anti-duplicate (Step 3) |
| `enrichedData[ticker]` entirely null | DROP ticker, reason="no_enrichment_data" |
| `fundamentals` null (Sharia check) | Set `sharia: null` (unknown), do not tag false |
| Previous signals file missing | Skip anti-repeat check (Step 24), log WARN |
| Main pool < 3 after all filters | ERROR: insufficient signals, abort pipeline |
| TKL pool < 1 after filters | WARN: tkl_pool_empty, set `tkl_pool: []` |
| Score computation produces NaN | Set score=60, log ERROR:score_nan:{ticker} |
| R/R computation: stop >= entry | DROP ticker, reason="invalid_levels_stop_gte_entry" |

---

## 11. `SignalGenerationResult` — Output to PRD-03

```json
{
  "scanDate": "2026-05-07",
  "regime": "NEUTRAL",
  "regimeScore": 50,
  "mainPool": [
    {
      "ticker": "NVDA",
      "score": 93,
      "strategy": "Momentum",
      "entry": 885.40,
      "stop": 852.15,
      "tp1": 930.00,
      "tp2": 975.00,
      "rr_numeric": 2.2,
      "horizon": 10,
      "region": "US",
      "sector": "Technology",
      "market_cap": 2800000000000,
      "adv_usd": 4500000000,
      "sharia": true,
      "confluence": ["rsi_zone", "vol_surge", "dark_pool", "insider_buy"],
      "badges": ["insider_buy"],
      "invalidations": [],
      "dilution_flag": null
    }
  ],
  "tklPool": [ /* same shape, tkl_score instead of score */ ],
  "collectionResult": { /* PRD-01 CollectionResult — passed through for PRD-03 risk gating */ }
}
```

> **Unified Engine note**: This PRD defines the scanner signal generation path, which is wrapped as a `Strategy` adapter by the Unified Strategy Engine (PRD-23 §4). The output `Signal[]` format (PRD-23 §3.1) is a superset of the `signals` array defined here. Scanner-specific fields (e.g. `confluence`, `badges`, `dilution_flag`) are preserved as-is in the unified format. Anti-duplicate checks reference `strategySlotId` (replacing legacy `modeId`).

<!-- Consistency pass: aligned with PRD-23 Unified Strategy Engine, 2026-05-07 -->
