---
name: trading-executor
description: Auto-execution DSL for broker order placement. Auto-load when user runs run-session.js, gen-trading-plan.js, mentions broker (alpaca/ibkr/saxo/trading212/binance), or works in tools/trading-executor/**. Covers config, env vars, engine lifecycle, paper mode, notifications.
user_invocable: false
---

# Trading Executor (auto-execution post-pipeline)

Automated order execution DSL. Generates a plan from scanner signals, executes against a broker.

## Setup
```bash
cp tools/trading-executor/config.example.json tools/trading-executor/config.json
# Edit config.json: set modes per broker, capital. Credentials via env vars only.
```

## Auth — MCPs OAuth2 (ZÉRO TOKEN EN .env)
Tous les MCPs (DailyTickers, Telegram, Memory, brokers) sont enregistrés via OAuth2 dans Claude Code.
**Aucun token en .env, aucun secret hardcodé.** Les scripts accèdent aux services via les MCPs enregistrés.
- Brokers (Alpaca, IBKR, Saxo, Trading212, Binance) : credentials via MCP broker-simulator OAuth2
- Notifications (Telegram, Discord) : via MCP enregistré

## Usage
```bash
# Batch: all configured mode/broker pairs
node tools/trading-executor/run-session.js

# Single mode/broker
node tools/trading-executor/run-session.js --mode balanced --broker alpaca

# Paper simulation (same notifs as live)
node tools/trading-executor/run-session.js --broker paper

# Dry-run (plan only, no execution)
node tools/trading-executor/run-session.js --dry-run

# Manual: generate plan then execute separately
node tools/gen-trading-plan.js --mode balanced --broker alpaca
node tools/trading-executor/index.js --plan data/trading-plans/balanced-alpaca-20260505.json --verbose
```

**How modes are determined:** `config.json` maps each broker account to modes array. `run-session.js` iterates all pairs. Filter with `--mode` / `--broker`.

**Engine lifecycle:** connect → reconcile positions → VIX kill check → close expired → rotate → place entries (VWAP gate, gap-up, spread checks) → monitor fills → bracket exits (SL + TP1 50% + TP2) → breakeven trigger → circuit breaker → session end → log export.

**Notifications:** Every fill/close/error → Telegram (per-mode topic) + Discord. Paper mode prefixes `[PAPER]`. No Telegram token = silent (no crash).

**Adapters:** `paper` (simulation), `alpaca`, `ibkr`, `saxo`, `trading212`, `binance`. All implement same interface.

**Pipeline integration:** Final step of downstream pipeline (after `publish-daily-card.sh`).
