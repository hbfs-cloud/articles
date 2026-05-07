# PRD-09: Notification & Reporting System

## Overview

Multi-channel notification system for all trading events, daily portfolio summaries, and alerts.
Covers: Telegram (primary), Discord (secondary), and scanner image cards (OG/social).

---

## 1. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | Yes | Group chat ID (typically `-100xxxxxxxxxx`) |
| `TELEGRAM_TOPIC_TURBO` | No | Thread ID for turbo mode (default: 89) |
| `TELEGRAM_TOPIC_DYNAMIC` | No | Thread ID for dynamic mode (default: 89) |
| `TELEGRAM_TOPIC_BALANCED` | No | Thread ID for balanced mode (default: 90) |
| `TELEGRAM_TOPIC_SECURED` | No | Thread ID for secured mode (default: 91) |
| `TELEGRAM_TOPIC_FORTRESS` | No | Thread ID for fortress mode (default: 91) |
| `TELEGRAM_TOPIC_TKL` | No | Thread ID for tkl mode (default: 1064) |
| `DISCORD_WEBHOOK_URL` | No | Discord channel webhook URL |

Default topic fallback mapping (if env var not set):
```javascript
const DEFAULT_TOPICS = {
  turbo: 89,
  dynamic: 89,
  balanced: 90,
  secured: 91,
  fortress: 91,
  tkl: 1064,
};
```

Article-type topic mapping:
```javascript
const ARTICLE_TOPICS = {
  daily:    73, // Daily News
  weekly:   74, // Weekly Review
  scanner:  72, // Portfolio Live
  analysis: 75, // Stock Analysis
  series:   76, // Learning
  tech:     76, // Learning
  retro:    72, // Portfolio Live
};
```

---

## 2. Event Types

Each event is identified by a `level` string emitted via `engine._log(level, msg, data)`.

| Level | Trigger | Key Data Fields |
|---|---|---|
| `FILL` | Entry order filled | `ticker`, `price`, `qty`, `side`, `strategySlotId`, `presetName`, `broker` |
| `TRADE` | Position closed | `ticker`, `pnlPct`, `reason` (`SL`/`TP1`/`TP2`/`EXPIRED`/`ROTATED`), `strategySlotId` |
| `ERROR` | Adapter/engine error | `message`, `context`, `strategySlotId` |
| `PHASE` | Engine phase transition | `phase` (`CLOSE_SESSION`, `VIX_KILL`, `DD_BREAKER`, `SESSION_START`), `strategySlotId` |

---

## 3. Notifier Class

**File**: `tools/trading-executor/notifier.js`

```javascript
'use strict';
const https = require('https');

// Keys are StrategySlot preset names (backward-compatible with legacy mode names)
// Existing topic IDs preserved: turbo/dynamic=89, balanced=90, secured/fortress=91, tkl=1064
const SLOT_TOPICS = {
  turbo:   'TELEGRAM_TOPIC_TURBO',
  dynamic: 'TELEGRAM_TOPIC_DYNAMIC',
  balanced:'TELEGRAM_TOPIC_BALANCED',
  secured: 'TELEGRAM_TOPIC_SECURED',
  fortress:'TELEGRAM_TOPIC_FORTRESS',
  tkl:     'TELEGRAM_TOPIC_TKL',
};

class Notifier {
  constructor(engine, opts = {}) {
    this.engine          = engine;
    this.strategySlotId  = engine.plan.strategySlotId || engine.plan.mode?.name;
    this.presetName      = engine.plan.presetName || engine.plan.mode?.name;
    this.broker          = engine.plan.broker.name;
    this.telegramToken = opts.telegram_token || process.env.TELEGRAM_BOT_TOKEN;
    this.telegramChat  = opts.telegram_chat  || process.env.TELEGRAM_CHAT_ID;
    this.telegramTopic = process.env[SLOT_TOPICS[this.presetName]] || null;
    this.discordWebhook= opts.discord_webhook || process.env.DISCORD_WEBHOOK_URL;
    this.enabled = !!(this.telegramToken || this.discordWebhook);
    this.quiet   = opts.quiet || false;
    if (this.enabled) this._attach();
  }

  _attach() {
    const eng = this.engine;
    const origLog = eng._log.bind(eng);
    eng._log = (level, msg, data) => {
      origLog(level, msg, data);
      if (level === 'FILL')  this._onFill(msg, data);
      if (level === 'TRADE') this._onTrade(msg, data);
      if (level === 'ERROR') this._onError(msg, data);
      if (level === 'PHASE' && msg.includes('CLOSE_SESSION')) this._onSessionEnd();
    };
  }

  _onFill(msg, data)   { /* see §4 message templates */ }
  _onTrade(msg, data)  { /* see §4 message templates */ }
  _onError(msg, data)  { /* see §4 message templates */ }
  _onSessionEnd()      { /* see §4 message templates */ }

  _send(text)          { /* see §5 transport */ }
  _sendDiscord(text, color) { /* see §5 transport */ }
  _post(host, path, body)   { /* see §5 transport */ }
}
module.exports = { Notifier };
```

**Instantiation** (in `tools/trading-executor/index.js`):
```javascript
const engine = new Engine(plan, adapter, { verbose, logDir });
new Notifier(engine);   // attaches by side-effect; no return value needed
```

---

## 4. Message Templates

### 4.1 ORDER_FILLED (`level === 'FILL'`)

```
[PAPER] FILL: {ticker}            ← paper mode prefix
✅ FILL: {ticker}                 ← live mode prefix

Full message:
{prefix} <b>{ticker}</b>
Slot: {STRATEGY_SLOT_LABEL} | Broker: {broker}
Side: BUY | Qty: {qty} @ ${price}
```

Implementation:
```javascript
_onFill(msg, data) {
  const prefix = this.broker === 'paper' ? '📝 [PAPER]' : '✅';
  this._send(`${prefix} FILL: ${msg}`);
}
```

### 4.2 POSITION_CLOSED (`level === 'TRADE'`)

```
{prefix} TRADE: {ticker}

Full message:
{prefix} <b>{ticker}</b> closed
Slot: {STRATEGY_SLOT_LABEL} | Broker: {broker}
P&L: {+/-}{pnlPct}% | Reason: {SL|TP1|TP2|EXPIRED|ROTATED}
```

Implementation:
```javascript
_onTrade(msg, data) {
  const prefix = this.broker === 'paper' ? '📝 [PAPER]' : '📈';
  this._send(`${prefix} TRADE: ${msg}`);
}
```

### 4.3 ERROR (`level === 'ERROR'`)

```
⚠️ ERROR [{strategySlotId}/{broker}]: {message}
```

Implementation:
```javascript
_onError(msg, data) {
  this._send(`⚠️ ERROR [${this.strategySlotId}/${this.broker}]: ${msg}`);
}
```

### 4.4 SESSION_END (`PHASE === 'CLOSE_SESSION'`)

Collect counts from engine state then send summary:

```javascript
_onSessionEnd() {
  const states  = this.engine.orderState;
  const filled  = [...states.values()].filter(os => os.state === 'FILLED').length;
  const skipped = [...states.values()].filter(os => os.state === 'SKIPPED').length;
  const errors  = this.engine.errors.length;
  const closes  = this.engine.trades.filter(t => t.exitDate).length;
  const prefix  = this.broker === 'paper' ? '[PAPER] ' : '';
  this._send(
    `${prefix}📋 Session end — ${this.strategySlotId}/${this.broker}\n` +
    `Filled: ${filled} | Closed: ${closes} | Skipped: ${skipped} | Errors: ${errors}`
  );
}
```

### 4.5 Scanner Status Notification (`tools/notify-scanner-status.js`)

Sent for each mode after each scanner run. Message format:

```html
📊 <b>{STRATEGY_SLOT_LABEL} — {YYYYMMDD}</b>
Régime: {regime} | WR {wr}%  PF {pf}x

🗂 <b>Action required</b>   ← only if positions expiring
⛔ <b>{TICKER}</b> {+/-pct}% → CLOSE
⏰ <b>{TICKER}</b> {+/-pct}% TP1 {price} · 2d left

📥 <b>{N} slot(s) open</b> ({alloc}% each)
  • {TICKER} [{strategy}] Score {score} | Entry {entry} SL {stop} TP {tp1} R/R {rr}

📂 <b>Positions ({active}/{portfolioSize})</b>
  {TICKER} {+/-pct}% · {daysLeft}d {⚠️ if <=1d}

⚖️ Risk: {worst}% ▬ +{best}%  ▲ now {current}%

🔗 https://articles.dailytickers.com/scanner/status/
```

### 4.6 Article Publish Notification (`tools/telegram-publish-notify.js`)

```html
{emoji} <b>{title}</b>
<i>{dateStr}</i>

{description, max 280 chars}…

🔗 <a href="{url}">Read on DailyTickers →</a>
```

Type → emoji mapping:
```javascript
{ daily:'📰', weekly:'📊', scanner:'🎯', analysis:'📈', retro:'🔁', series:'📚', tech:'⚡' }
```

**Guard**: `--path` is mandatory. If empty and not `--dry-run`: `process.exit(1)`. If file not on disk: `process.exit(1)`.

---

## 5. Transport Layer

> **v1 transports**: Telegram + Discord (primary, free). In-app toasts handled by PRD-22 NotificationHub. Slack, Email, and Webhook are **v2 — future**.

### 5.1 Telegram sendMessage

```javascript
function _send(text) {
  if (!this.telegramToken || !this.telegramChat) return;
  const body = {
    chat_id: this.telegramChat,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: false,
  };
  if (this.telegramTopic) body.message_thread_id = parseInt(this.telegramTopic, 10);
  this._post('api.telegram.org', `/bot${this.telegramToken}/sendMessage`, body);
  if (this.discordWebhook) this._sendDiscord(text, 0x3b82f6);
}
```

### 5.2 Telegram sendPhoto

Used by `tools/notify-scanner-status.js` when a PNG card is available:

```bash
curl -s -X POST https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto \
  -F chat_id=${CHAT_ID} \
  -F message_thread_id=${topicId} \
  -F photo=@${imagePath} \
  -F caption=${caption} \
  -F parse_mode=HTML
```

### 5.3 Telegram sendAudio

Used for portfolio update audio clips:

```bash
curl -s -X POST https://api.telegram.org/bot${BOT_TOKEN}/sendAudio \
  -F chat_id=${CHAT_ID} \
  -F message_thread_id=${topicId} \
  -F audio=@${audioPath} \
  -F title="${title}" \
  -F performer=DailyTickers \
  -F caption=<${captionFile} \
  -F parse_mode=HTML
```

### 5.4 Discord Webhook

```javascript
_sendDiscord(text, color = 0x3b82f6) {
  if (!this.discordWebhook) return;
  const stripped = text.replace(/<[^>]+>/g, '');
  const url = new URL(this.discordWebhook);
  this._post(url.hostname, url.pathname, {
    embeds: [{ description: stripped, color }],
  });
}
```

Discord color coding by event:
```javascript
const DISCORD_COLORS = {
  FILL:    0x22c55e,   // green
  TRADE:   0x3b82f6,   // blue
  ERROR:   0xef4444,   // red
  PHASE:   0xf59e0b,   // amber
  SCANNER: 0x8b5cf6,   // purple
};
```

### 5.5 Generic POST

```javascript
_post(host, path, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: host, port: 443, path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => { res.resume(); res.on('end', resolve); });
    req.on('error', resolve);
    req.setTimeout(10000, () => { req.destroy(); resolve(); });
    req.write(data);
    req.end();
  });
}
```

---

## 6. Scanner Image Card (`tools/generate-scanner-image.js`)

Generates a Puppeteer-rendered PNG from an HTML template.

**Output**: `scanner/status/mode-{mode}-{timestamp}.png`

**Template blocks** (5 sections):
1. **Header**: Mode name, color badge, date, regime label
2. **Guide**: Mode-specific "How to Trade" blurb (max 3 lines)
3. **Top 3 Signals**: Ticker, score, strategy, entry/SL/TP1, R/R ratio
4. **Portfolio**: Open positions with P&L%, days remaining
5. **Stats**: Total Return, Win Rate, Profit Factor, Max DD

**Per-mode card generator** (`tools/gen-mode-cards.js`):
- Reads metrics from `scanner/status/index.html` (parses `.perf-stats .ps-v` values)
- Saves PNG to `scanner/status/mode-{mode}-{timestamp}.png`
- Updates `scanner/status/manifest.json`:

```json
{
  "generated_at": "ISO-8601",
  "modes": {
    "balanced": {
      "path": "scanner/status/mode-balanced-1778014543222.png",
      "timestamp": 1778014543222,
      "stats": {
        "ret": 35.2,
        "dd": -4.1,
        "wr": 60.0,
        "pf": 4.68,
        "trades": 42
      }
    }
  }
}
```

---

## 7. Graceful Degradation

- No `TELEGRAM_BOT_TOKEN` → skip all Telegram calls, no crash.
- No `DISCORD_WEBHOOK_URL` → skip Discord, no crash.
- Notification failure (HTTP error, timeout 10s) → log warning, pipeline continues.
- Paper mode → all messages prefixed `[PAPER]` or `📝 [PAPER]`.
- `--dry-run` flag on any notify script → print message to stdout, no HTTP call.

---

## 8. Topic Routing Logic

Topic routing is per-StrategySlot. Existing topic IDs (turbo/dynamic=89, balanced=90, secured/fortress=91, tkl=1064) are preserved as backward-compatible defaults.

```javascript
function getTopicForSlot(presetName) {
  const envKey = `TELEGRAM_TOPIC_${presetName.toUpperCase()}`;
  if (process.env[envKey]) return parseInt(process.env[envKey], 10);
  return DEFAULT_TOPICS[presetName] || null;
}
```

---

## 9. Redaction

All error messages passed to Telegram/Discord must have the bot token redacted:

```javascript
function redactToken(str) {
  return String(str || '').replace(
    /bot[A-Za-z0-9_-]{20,}/g,
    'bot[REDACTED]'
  );
}
```
