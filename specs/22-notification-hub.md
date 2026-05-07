# PRD-22: Multi-Channel Notification Hub

## Overview

Unified notification management across Telegram, Discord, and in-app toasts (v1). Slack and email are planned for v2.
Replaces the current hardcoded Telegram + Discord implementation in `tools/telegram-publish-notify.js`
and the engine's inline notification calls with a centralized router that supports per-user
channel configuration, routing rules, deduplication, quiet hours, and digest accumulation.

---

## 1. Architecture

```
Event Sources
  ├── Trading Engine  (FILL, TRADE, PHASE events)
  ├── Scheduler       (DAILY_SUMMARY, PIPELINE_FAILED)
  ├── QA Validator    (QA_FAILED)
  └── Alert Worker    (user-defined price/condition alerts)
          │
          ▼
  Notification Router
    1. Resolve user_id from event context
    2. Load user's NotificationConfig (Redis cache, 60s TTL)
    3. Apply severity filter per channel
    4. Apply quiet hours (skip or queue for post-quiet delivery)
    5. Deduplication check (60s window, Redis SET)
    6. Digest accumulation (if channel in digest mode, enqueue; else dispatch)
    7. Per-channel formatting via Template Engine
    8. Dispatch to Channel Adapters
          │
          ├── TelegramAdapter
          ├── DiscordAdapter
          ├── SlackAdapter
          ├── EmailAdapter
          └── WebhookAdapter
                │
                ▼
         notification_log (PostgreSQL)
```

---

## 2. Event Types

> **v1 channels**: Telegram + Discord (primary, free). In-app toasts via Foundation's toast component. Slack + Email are **v2 — future** (interfaces defined but not activated in v1).

| Event | Severity | v1 Default channels | Bypass quiet hours |
|---|---|---|---|
| `ORDER_FILLED` | info | telegram, discord, in-app | No |
| `POSITION_CLOSED` | info | telegram, discord, in-app | No |
| `TP1_HIT` | success | telegram, discord, in-app | No |
| `TP2_HIT` | success | telegram, discord, in-app | No |
| `STOP_LOSS_HIT` | warning | telegram, discord, in-app | No |
| `VIX_KILL` | critical | telegram, discord, in-app | Yes |
| `DD_BREAKER` | critical | telegram, discord, in-app | Yes |
| `SESSION_START` | debug | telegram | No |
| `SESSION_END` | info | telegram, discord | No |
| `PIPELINE_FAILED` | critical | telegram, discord, in-app | Yes |
| `DAILY_SUMMARY` | info | telegram, in-app | No |
| `REGIME_CHANGE` | warning | telegram, discord | No |
| `CREDENTIAL_EXPIRING` | critical | telegram, in-app | Yes |
| `NEW_SIGNALS` | info | telegram, discord, in-app | No |
| `ALERT_TRIGGERED` | info | user-configured | No |
| `QA_FAILED` | critical | telegram, discord, in-app | Yes |

**Severity ordering** (lowest to highest): `debug < info < success < warning < critical`

A channel's `severity_filter` setting means: only deliver events at or above that severity.
Example: `severity_filter: "warning"` → receives `warning`, `critical` but not `info` or `debug`.

---

## 3. Per-User Notification Config

Stored in `notification_configs` table (one row per `user_id + channel`). Also cached in
Redis at key `notif_config:{user_id}` with TTL = 60s.

### 3.1 Full Config Schema

```typescript
interface NotificationConfig {
  user_id: string;            // UUID
  channels: {
    telegram?: TelegramChannelConfig;
    discord?:  DiscordChannelConfig;
    slack?:    SlackChannelConfig;
    email?:    EmailChannelConfig;
    webhook?:  WebhookChannelConfig;
  };
  quiet_hours?: {
    start:    string;   // "HH:MM" in user's timezone
    end:      string;   // "HH:MM" in user's timezone
    timezone: string;   // IANA tz name, e.g. "Europe/Paris"
  };
  strategySlot_routing?: {
    // Map StrategySlot ID (or preset name) → array of channel names to use for that slot's events
    // Overrides default_channels on the event level for matched slots
    // v1: simple severity-based routing; complex per-slot rules are v2
    [slotIdOrPreset: string]: ChannelName[];
  };
}

// v1 active channels: telegram, discord, in-app
// v2 future channels: slack, email, webhook
type ChannelName = 'telegram' | 'discord' | 'in-app' | 'slack' | 'email' | 'webhook';

interface TelegramChannelConfig {
  enabled:          boolean;
  bot_token:        string;   // AES-256-GCM encrypted in DB; decrypted at runtime
  chat_id:          string;   // e.g. "-100123456789"
  topics?: {
    turbo?:    number;
    dynamic?:  number;
    balanced?: number;
    secured?:  number;
    fortress?: number;
    tkl?:      number;
    default?:  number;  // fallback topic if mode not listed
  };
  severity_filter:  SeverityLevel;  // default: "info"
}

interface DiscordChannelConfig {
  enabled:         boolean;
  webhook_url:     string;    // AES-256-GCM encrypted in DB
  severity_filter: SeverityLevel;  // default: "warning"
  thread_per_mode: boolean;   // if true, create threads keyed by strategySlot name
}

// v1: in-app notifications via Foundation toast component (no external credentials needed)
interface InAppChannelConfig {
  enabled:         boolean;
  severity_filter: SeverityLevel;  // default: "info"
  // Toasts are pushed via WebSocket to the active dashboard session
  // Rendered using Foundation's toast pattern: success/warning/error variants
}

interface SlackChannelConfig {
  enabled:         boolean;
  webhook_url:     string | null;   // AES-256-GCM encrypted
  channel:         string;          // e.g. "#trading-alerts"
  severity_filter: SeverityLevel;   // default: "info"
}

interface EmailChannelConfig {
  enabled:         boolean;
  address:         string;
  digest_mode:     'immediate' | 'daily' | 'weekly';
  digest_time?:    string;    // "HH:MM" UTC for daily digest send
  severity_filter: SeverityLevel;   // default: "warning"
  // Critical events always sent immediately regardless of digest_mode
}

interface WebhookChannelConfig {
  enabled:         boolean;
  url:             string | null;   // AES-256-GCM encrypted
  headers:         Record<string, string>;   // custom auth headers
  events:          EventType[];     // whitelist of event types to POST
  severity_filter: SeverityLevel;   // default: "info"
}

type SeverityLevel = 'debug' | 'info' | 'success' | 'warning' | 'critical';
```

### 3.2 Example Config (JSON)

```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "channels": {
    "telegram": {
      "enabled": true,
      "bot_token": "encrypted:AES256GCM:iv=...:tag=...:data=...",
      "chat_id": "-100123456789",
      "topics": { "turbo": 89, "balanced": 90, "secured": 91, "tkl": 1064 },
      "severity_filter": "info"
    },
    "discord": {
      "enabled": true,
      "webhook_url": "encrypted:AES256GCM:iv=...:tag=...:data=...",
      "severity_filter": "warning",
      "thread_per_mode": false
    },
    "slack": {
      "enabled": false,
      "webhook_url": null,
      "channel": "#trading-alerts",
      "severity_filter": "info"
    },
    "email": {
      "enabled": true,
      "address": "user@example.com",
      "digest_mode": "daily",
      "digest_time": "07:00",
      "severity_filter": "warning"
    },
    "webhook": {
      "enabled": false,
      "url": null,
      "headers": {},
      "events": ["ORDER_FILLED", "POSITION_CLOSED"],
      "severity_filter": "info"
    }
  },
  "quiet_hours": {
    "start": "22:00",
    "end": "07:00",
    "timezone": "Europe/Paris"
  },
  "strategySlot_routing": {
    "turbo":    ["telegram"],
    "balanced": ["telegram", "discord"],
    "secured":  ["telegram", "in-app"]
  }
}
```

---

## 4. Router Class

```typescript
class NotificationRouter {
  async route(event: NotificationEvent): Promise<void> {
    // 1. Resolve config
    const config = await this.loadConfig(event.user_id);

    // 2. Determine target channels
    const targetChannels = this.resolveChannels(event, config);

    // 3. Process each channel
    await Promise.allSettled(targetChannels.map(channel =>
      this.processChannel(event, channel, config)
    ));
  }

  private resolveChannels(event: NotificationEvent, config: NotificationConfig): ChannelName[] {
    // strategySlot_routing takes precedence over event default_channels
    const bySlot = event.strategySlotId && config.strategySlot_routing?.[event.strategySlotId];
    const candidates: ChannelName[] = bySlot ?? event.defaultChannels;

    return candidates.filter(ch => {
      const chCfg = config.channels[ch];
      if (!chCfg?.enabled) return false;

      // Webhook: check event whitelist
      if (ch === 'webhook' && chCfg.events && !chCfg.events.includes(event.type)) return false;

      // Severity filter
      return severityGte(event.severity, chCfg.severity_filter);
    });
  }

  private async processChannel(
    event: NotificationEvent,
    channel: ChannelName,
    config: NotificationConfig
  ): Promise<void> {
    // Quiet hours check (critical events bypass)
    if (event.severity !== 'critical' && await this.isQuietHours(config)) {
      if (channel === 'email' && config.channels.email?.digest_mode !== 'immediate') {
        // Queue for post-quiet delivery
        await this.queueForQuietHoursEnd(event, channel, config);
        return;
      }
      // Non-email channels: skip silently during quiet hours (no queuing)
      return;
    }

    // Deduplication (60s window)
    const dedupKey = `notif_dedup:${config.user_id}:${event.type}:${event.dedupId}`;
    const alreadySent = await this.redis.set(dedupKey, '1', 'NX', 'EX', 60);
    if (!alreadySent) {
      await this.log(event, channel, 'skipped', 'dedup');
      return;
    }

    // Digest accumulation (email in daily/weekly mode — non-critical)
    if (channel === 'email' && event.severity !== 'critical') {
      const emailCfg = config.channels.email!;
      if (emailCfg.digest_mode !== 'immediate') {
        await this.accumulateDigest(event, config.user_id, emailCfg.digest_mode);
        return;
      }
    }

    // Format and dispatch
    const payload = await TemplateEngine.render(event, channel);
    await this.dispatch(event, channel, payload, config);
  }

  private async isQuietHours(config: NotificationConfig): Promise<boolean> {
    if (!config.quiet_hours) return false;
    const { start, end, timezone } = config.quiet_hours;
    const now = new Date().toLocaleTimeString('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit' });
    // Handle overnight spans (e.g. 22:00–07:00)
    if (start > end) return now >= start || now < end;
    return now >= start && now < end;
  }
}
```

---

## 5. Template Engine

### 5.1 Telegram (MarkdownV2)

Templates use MarkdownV2. Special characters (`_*[]()~\`>#+-=|{}.!`) must be escaped with `\`.

**ORDER_FILLED**:
```
*Order Filled* \| {MODE} {BROKER}
{EMOJI} {SIDE} {TICKER} @ \${PRICE}
Qty: {QTY} \| Score: {SCORE}
```

**POSITION_CLOSED — TP1_HIT**:
```
*TP1 Hit* \| {MODE}
{TICKER} closed \+{PNL_PCT}% \({HOLD_DAYS}d\)
Entry: \${ENTRY_PRICE} → Exit: \${EXIT_PRICE}
Portfolio P&L: \+{TOTAL_RETURN}%
```

**POSITION_CLOSED — STOP_LOSS_HIT**:
```
*Stop Loss* \| {MODE}
{TICKER} closed \-{PNL_PCT}% \({HOLD_DAYS}d\)
Entry: \${ENTRY_PRICE} → Exit: \${EXIT_PRICE}
```

**VIX_KILL**:
```
🚨 *VIX Kill Triggered* \| {MODE}
VIX: {VIX_LEVEL} \(threshold: {THRESHOLD}\)
All entries blocked for this session\.
```

**DD_BREAKER**:
```
🚨 *Drawdown Breaker* \| {MODE}
Current DD: \-{DD_PCT}% \(limit: \-{LIMIT_PCT}%\)
Session closed\. No new entries until reset\.
```

**REGIME_CHANGE**:
```
⚠️ *Regime Change* \| All Modes
{FROM} → {TO}
VIX: {VIX_LEVEL} \| Regime prob: {PROB}%
Advisor recommends: {RECOMMENDATION}
```

**DAILY_SUMMARY**:
```
📊 *Daily Summary* \| {DATE}
{MODE} \| Return: \+{TOTAL_RETURN}% \| DD: \-{MAX_DD}%
Closed today: {CLOSED_TODAY} trades \| WR: {WIN_RATE}%
Open positions: {OPEN_COUNT}
```

**NEW_SIGNALS**:
```
🎯 *New Signals* \| {MODE} \| {SCAN_DATE}
Regime: {REGIME}
Top picks: {TICKER1} \({SCORE1}\), {TICKER2} \({SCORE2}\), {TICKER3} \({SCORE3}\)
[View full scan]({SCAN_URL})
```

Telegram messages include an **inline keyboard** for non-debug events:
```json
{
  "inline_keyboard": [[
    { "text": "View Dashboard", "url": "https://autotrader.dailytickers.com/dashboard" },
    { "text": "Mute 1h", "callback_data": "mute:1h:{user_id}:{channel}" }
  ]]
}
```

Topic routing: `message_thread_id = config.channels.telegram.topics[event.strategySlotId] ?? config.channels.telegram.topics[event.presetName] ?? config.channels.telegram.topics.default`. Existing topic IDs (turbo=89, balanced=90, secured=91, tkl=1064) are preserved as-is for backward compatibility.

Photo sends: `DAILY_SUMMARY` and `NEW_SIGNALS` events attach the mode card PNG if available
(`scanner/status/mode-{mode}-{timestamp}.png`). Use `sendPhoto` with `caption` instead of
`sendMessage`. Max photo size: 10 MB. Fallback to `sendMessage` if file not found.

### 5.2 Discord (Embeds)

**Color coding**:
```javascript
const COLORS = {
  success: 0x27ae60,  // green
  info:    0x3498db,  // blue
  warning: 0xe67e22,  // orange
  critical: 0xe74c3c, // red
  debug:   0x95a5a6,  // grey
};
```

**ORDER_FILLED embed**:
```json
{
  "embeds": [{
    "title": "Order Filled — {MODE} {BROKER}",
    "color": 3498219,
    "fields": [
      { "name": "Ticker", "value": "{TICKER}", "inline": true },
      { "name": "Side",   "value": "{SIDE}",   "inline": true },
      { "name": "Price",  "value": "${PRICE}", "inline": true },
      { "name": "Qty",    "value": "{QTY}",    "inline": true },
      { "name": "Score",  "value": "{SCORE}",  "inline": true }
    ],
    "footer": { "text": "DailyTickers AutoTrader" },
    "timestamp": "{ISO8601_TIMESTAMP}"
  }]
}
```

**STOP_LOSS_HIT / TP1_HIT / TP2_HIT embed**:
```json
{
  "embeds": [{
    "title": "{EVENT_LABEL} — {MODE}",
    "color": "{COLOR_BY_SEVERITY}",
    "description": "{TICKER} | {PNL_PCT}% | {HOLD_DAYS} days",
    "fields": [
      { "name": "Entry",  "value": "${ENTRY_PRICE}", "inline": true },
      { "name": "Exit",   "value": "${EXIT_PRICE}",  "inline": true },
      { "name": "P&L",    "value": "{PNL_ABS}",     "inline": true }
    ],
    "components": [{
      "type": 1,
      "components": [{
        "type": 2,
        "style": 5,
        "label": "View Dashboard",
        "url": "https://autotrader.dailytickers.com/dashboard"
      }]
    }],
    "timestamp": "{ISO8601_TIMESTAMP}"
  }]
}
```

Thread creation: If `thread_per_mode = true`, the adapter creates a thread named `{MODE} — {YYYYMMDD}`
on first event of the day, then posts subsequent events for that mode into the thread.
Thread IDs are cached in Redis: `discord_thread:{user_id}:{mode}:{YYYYMMDD}`.

### 5.3 Slack (Block Kit)

**ORDER_FILLED**:
```json
{
  "blocks": [
    {
      "type": "header",
      "text": { "type": "plain_text", "text": ":white_check_mark: Order Filled — {MODE}" }
    },
    {
      "type": "section",
      "fields": [
        { "type": "mrkdwn", "text": "*Ticker:*\n{TICKER}" },
        { "type": "mrkdwn", "text": "*Side:*\n{SIDE}" },
        { "type": "mrkdwn", "text": "*Price:*\n${PRICE}" },
        { "type": "mrkdwn", "text": "*Score:*\n{SCORE}" }
      ]
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": { "type": "plain_text", "text": "View Position" },
          "url": "https://autotrader.dailytickers.com/dashboard",
          "action_id": "view_position"
        },
        {
          "type": "button",
          "text": { "type": "plain_text", "text": "Acknowledge" },
          "action_id": "ack_{EVENT_ID}",
          "style": "primary"
        }
      ]
    }
  ]
}
```

**DAILY_SUMMARY (Slack)**:
```json
{
  "blocks": [
    { "type": "header", "text": { "type": "plain_text", "text": ":bar_chart: Daily Summary — {DATE}" } },
    {
      "type": "section",
      "text": { "type": "mrkdwn", "text": "*{MODE}*  |  Return: *+{TOTAL_RETURN}%*  |  DD: *-{MAX_DD}%*\nClosed today: *{CLOSED_TODAY}* trades  |  Win rate: *{WIN_RATE}%*" }
    },
    { "type": "divider" },
    {
      "type": "context",
      "elements": [{ "type": "mrkdwn", "text": "Regime: *{REGIME}*  |  VIX: {VIX_LEVEL}  |  Open positions: {OPEN_COUNT}" }]
    }
  ]
}
```

Scheduled summaries: `DAILY_SUMMARY` is dispatched at the time set in the scheduler (PRD-15).
The Slack adapter sends to the `channel` field in config (e.g. `#trading-alerts`), not via
direct message.

### 5.4 Email (HTML)

Responsive HTML template. Fixed layout: header → body → CTA button → footer.

**Structure**:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{SUBJECT}</title>
  <style>
    /* Inline CSS — email clients strip <style> tags */
    body { font-family: -apple-system, Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: #1a1a2e; padding: 24px; text-align: center; }
    .header h1 { color: #ffffff; font-size: 18px; margin: 0; }
    .body { padding: 24px; }
    .metric { display: inline-block; text-align: center; margin: 8px; }
    .metric-value { font-size: 24px; font-weight: bold; }
    .metric-label { font-size: 12px; color: #666; }
    .cta { text-align: center; padding: 24px; }
    .btn { background: #0066cc; color: #ffffff; padding: 12px 24px;
           text-decoration: none; border-radius: 4px; font-weight: bold; }
    .footer { padding: 16px; text-align: center; color: #999; font-size: 12px; }
    .unsubscribe { color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>DailyTickers AutoTrader — {EVENT_LABEL}</h1>
    </div>
    <div class="body">
      <!-- Event-specific content block injected here -->
      {CONTENT_BLOCK}
    </div>
    <div class="cta">
      <a href="https://autotrader.dailytickers.com/dashboard" class="btn">View Dashboard</a>
    </div>
    <div class="footer">
      DailyTickers AutoTrader &bull; {TIMESTAMP}<br>
      <a href="https://autotrader.dailytickers.com/unsubscribe?token={UNSUBSCRIBE_TOKEN}" class="unsubscribe">
        Unsubscribe from email notifications
      </a>
    </div>
  </div>
</body>
</html>
```

**Content block per event** (TP1_HIT example):
```html
<p>Your position in <strong>{TICKER}</strong> hit <strong>TP1</strong> in the <strong>{MODE}</strong> mode.</p>
<table style="width:100%; border-collapse:collapse;">
  <tr>
    <td style="padding:8px; border-bottom:1px solid #eee;"><strong>Entry price</strong></td>
    <td style="padding:8px; border-bottom:1px solid #eee;">${ENTRY_PRICE}</td>
  </tr>
  <tr>
    <td style="padding:8px; border-bottom:1px solid #eee;"><strong>Exit price</strong></td>
    <td style="padding:8px; border-bottom:1px solid #eee;">${EXIT_PRICE}</td>
  </tr>
  <tr>
    <td style="padding:8px; border-bottom:1px solid #eee;"><strong>P&amp;L</strong></td>
    <td style="padding:8px; border-bottom:1px solid #eee; color:#27ae60;">+{PNL_PCT}%</td>
  </tr>
  <tr>
    <td style="padding:8px;"><strong>Hold time</strong></td>
    <td style="padding:8px;">{HOLD_DAYS} days</td>
  </tr>
</table>
```

**Digest accumulation**: Non-critical events with `digest_mode: "daily"` are stored in Redis
list `digest:{user_id}:email:{YYYYMMDD}`. At `digest_time` UTC, the scheduler triggers
`EmailAdapter.sendDigest(user_id, date)` which:
1. Fetches all events from the list.
2. Groups by event type and mode.
3. Renders a single digest email summarizing all events.
4. Sends via SMTP/SES and clears the Redis list.

Critical events bypass digest: they are sent immediately via `EmailAdapter.sendImmediate()`.

**Unsubscribe**: Each email contains a signed token (`HMAC-SHA256(user_id + channel + salt)`).
The `/unsubscribe` endpoint verifies the token and sets `channels.email.enabled = false`.

**Transport**: AWS SES preferred (env: `AWS_SES_REGION`, `AWS_SES_FROM_ADDRESS`).
Fallback: SMTP (env: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`).

### 5.5 Webhook (HTTP POST)

```json
{
  "event_id": "uuid",
  "event_type": "ORDER_FILLED",
  "severity": "info",
  "user_id": "uuid",
  "mode": "balanced",
  "broker": "alpaca",
  "timestamp": "2026-05-07T14:32:00Z",
  "data": {
    "ticker": "NVDA",
    "side": "long",
    "price": 120.50,
    "qty": 10,
    "score": 93
  }
}
```

**Retry logic**: 3 attempts with exponential backoff (1s, 4s, 16s). On 3rd failure, write to
dead-letter queue (Redis list `dlq:webhook:{user_id}`) and log error in `notification_log`.

Dead-letter queue: Processed by a background worker every 5 minutes. After 3 DLQ attempts,
mark `notification_log.status = 'dead'` and send a `WEBHOOK_DELIVERY_FAILED` email alert
to the user.

```javascript
async function dispatchWebhook(url, headers, payload, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) return { success: true, status: res.status };
      if (res.status < 500) throw new Error(`Non-retryable status: ${res.status}`);
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
      await sleep(Math.pow(4, attempt) * 1000);
    }
  }
}
```

---

## 6. Deduplication

Dedup key: `notif_dedup:{user_id}:{event_type}:{dedupId}` with TTL = 60 seconds.

`dedupId` is computed per event:
- Fill/trade events: `{ticker}:{mode}:{entry_date}:{status}`
- VIX_KILL: `{mode}:{session_date}`
- DD_BREAKER: `{mode}:{session_date}`
- Regime change: `{from}:{to}:{date}`
- Daily summary: `{mode}:{date}`
- New signals: `{mode}:{scan_date}`

If Redis `SET NX` returns null (key existed), skip dispatch and log `status = 'skipped'`.

**Session digest supersedes individual events**: If a `SESSION_END` event triggers a
`DAILY_SUMMARY`, any individual `ORDER_FILLED` or `POSITION_CLOSED` events within the same
60-second window that were already sent are not re-included in the summary. The summary
aggregates from the DB (`notification_log`) rather than re-sending the same data.

---

## 7. Quiet Hours Logic

```javascript
function isInQuietHours(quietHours, nowUtc) {
  if (!quietHours) return false;
  const { start, end, timezone } = quietHours;

  // Convert nowUtc to user's local time
  const localTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(nowUtc);  // e.g. "22:30"

  // Handle overnight span (e.g. 22:00 to 07:00)
  if (start > end) {
    return localTime >= start || localTime < end;
  }
  return localTime >= start && localTime < end;
}
```

**Behavior during quiet hours**:
- `critical` severity → always dispatch immediately (VIX_KILL, DD_BREAKER, PIPELINE_FAILED,
  CREDENTIAL_EXPIRING, QA_FAILED bypass quiet hours on all channels).
- `email` in `daily` digest mode → event accumulates in digest list regardless of quiet hours;
  digest is sent at `digest_time` (which should be outside quiet hours).
- All other events on all other channels → silently dropped (not queued for later delivery).
  Rationale: market events are time-sensitive; a delayed Telegram message about a fill from
  22:05 sent at 07:00 is misleading.

**Post-quiet delivery** (email queue only): events queued during quiet hours for
`immediate`-mode email are held in Redis list `quiet_queue:{user_id}:email` and flushed
at `quiet_hours.end` by the scheduler.

---

## 8. Rate Limits

| Limit | Scope | Value |
|---|---|---|
| Max notifications per user per channel per hour | user + channel | 50 |
| Max Telegram messages per bot per second (Telegram limit) | bot-wide | 30 |
| Max webhook retries in DLQ | per event | 3 |
| Digest accumulation max events | per digest period | 200 |

Rate limit enforcement (per user per channel):
```javascript
const key = `notif_rate:{user_id}:{channel}:{hourWindow}`;
const count = await redis.incr(key);
await redis.expire(key, 3600);
if (count > 50) {
  await log(event, channel, 'skipped', 'rate_limit');
  return;
}
```

---

## 9. Database Schema

```sql
-- Per-user, per-channel notification configuration
CREATE TABLE notification_configs (
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel    VARCHAR(20) NOT NULL CHECK (channel IN ('telegram','discord','slack','email','webhook')),
  config     JSONB       NOT NULL DEFAULT '{}',
  enabled    BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel)
);

CREATE INDEX idx_notif_configs_user ON notification_configs(user_id);

-- Quiet hours stored as top-level config in a separate row for ergonomics:
-- channel = 'global', config = { quiet_hours: {...}, mode_routing: {...} }
-- Adapter reads 'global' row first, then per-channel rows.

-- Immutable audit log of all dispatched/skipped/failed notifications
CREATE TABLE notification_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id),
  event_id    UUID        NOT NULL,   -- dedupId-derived; unique per real-world event
  event_type  VARCHAR(50) NOT NULL,
  channel     VARCHAR(20) NOT NULL,
  status      VARCHAR(20) NOT NULL CHECK (status IN ('sent','failed','skipped','queued','dead')),
  payload     JSONB,                  -- rendered payload sent to channel (for debugging)
  error       TEXT,                   -- error message on failure
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notif_log_user    ON notification_log(user_id, created_at DESC);
CREATE INDEX idx_notif_log_event   ON notification_log(event_id, channel);
CREATE INDEX idx_notif_log_status  ON notification_log(status) WHERE status IN ('failed','dead');

-- Digest accumulation queue (supplement to Redis — persisted for recovery)
CREATE TABLE digest_queue (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id),
  channel     VARCHAR(20) NOT NULL,
  period      DATE        NOT NULL,   -- digest period (day for daily, week-start for weekly)
  event_type  VARCHAR(50) NOT NULL,
  payload     JSONB       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  dispatched  BOOLEAN     NOT NULL DEFAULT false,
  dispatched_at TIMESTAMPTZ
);

CREATE INDEX idx_digest_pending ON digest_queue(user_id, channel, period, dispatched)
  WHERE dispatched = false;
```

---

## 10. Backward Compatibility (Migration from Current System)

The existing `telegram-publish-notify.js` and inline engine notification calls continue to
work unchanged during the migration period. The Hub is introduced as an opt-in layer:

1. Engine emits events to a Redis pub/sub channel (`notif:events`).
2. Hub subscribes and routes to configured user channels.
3. Legacy `telegram-publish-notify.js` continues sending to the hardcoded group until
   `NOTIFICATION_HUB_ENABLED=true` is set, at which point it becomes a no-op.

**Mapping from legacy env vars to Hub config**:
```javascript
// Legacy env → Hub default config for platform-level (non-user) notifications
// Topic keys are StrategySlot preset names (backward-compatible with legacy mode names)
const PLATFORM_CONFIG = {
  telegram: {
    bot_token: process.env.TELEGRAM_BOT_TOKEN,
    chat_id:   process.env.TELEGRAM_CHAT_ID,
    topics: {
      turbo:    parseInt(process.env.TELEGRAM_TOPIC_TURBO)    || 89,
      dynamic:  parseInt(process.env.TELEGRAM_TOPIC_DYNAMIC)  || 89,
      balanced: parseInt(process.env.TELEGRAM_TOPIC_BALANCED) || 90,
      secured:  parseInt(process.env.TELEGRAM_TOPIC_SECURED)  || 91,
      fortress: parseInt(process.env.TELEGRAM_TOPIC_FORTRESS) || 91,
      tkl:      parseInt(process.env.TELEGRAM_TOPIC_TKL)      || 1064,
    },
  },
  discord: {
    webhook_url: process.env.DISCORD_WEBHOOK_URL,
  },
  // v1: in-app toasts enabled by default for all platform events (no credentials required)
  'in-app': { enabled: true },
};
```

Article-type notifications (daily/weekly/scanner/analysis publications) remain handled by
`telegram-publish-notify.js` with its existing topic mapping — these are not user-scoped
events and are not routed through the Hub.
