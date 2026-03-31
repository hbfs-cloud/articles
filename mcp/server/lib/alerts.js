/**
 * Alert engine with multi-channel notifications
 * Supports: Desktop, Slack, Discord, Telegram
 * Smart throttling, alert history, rich formatting
 */

import { readFileSync } from 'fs';

let notifier;
try { notifier = (await import('node-notifier')).default; } catch { notifier = null; }

// ══════════════════════════════════════
// ALERT STORE
// ══════════════════════════════════════

const alerts = new Map();     // id -> alert config
const history = [];            // triggered alerts
const throttleMap = new Map(); // ticker:type -> last trigger time
let nextId = 1;
let config = {};

export function configure(cfg) {
  config = cfg || {};
}

// ══════════════════════════════════════
// CRUD
// ══════════════════════════════════════

export function createAlert({ ticker, type, condition, value, message, channels }) {
  const id = nextId++;
  const alert = {
    id,
    ticker: ticker.toUpperCase(),
    type, // entry, stop, tp, price_above, price_below, rvol, vwap_reclaim, news, volume_spike
    condition, // above, below, crosses, equals
    value,
    message: message || `${ticker} ${type} alert`,
    channels: channels || ['desktop'],
    status: 'active', // active, paused, triggered, expired
    createdAt: new Date().toISOString(),
    triggeredAt: null,
    triggerCount: 0
  };
  alerts.set(id, alert);
  return alert;
}

export function getAlert(id) {
  return alerts.get(id);
}

export function listAlerts(filter = {}) {
  let list = [...alerts.values()];
  if (filter.ticker) list = list.filter(a => a.ticker === filter.ticker.toUpperCase());
  if (filter.status) list = list.filter(a => a.status === filter.status);
  if (filter.type) list = list.filter(a => a.type === filter.type);
  return list;
}

export function updateAlert(id, updates) {
  const alert = alerts.get(id);
  if (!alert) return null;
  Object.assign(alert, updates);
  return alert;
}

export function deleteAlert(id) {
  return alerts.delete(id);
}

export function pauseAlert(id) {
  return updateAlert(id, { status: 'paused' });
}

export function resumeAlert(id) {
  return updateAlert(id, { status: 'active' });
}

// ══════════════════════════════════════
// WATCHLIST → AUTO ALERTS
// ══════════════════════════════════════

export function createWatchlistAlerts(watchlist) {
  // Clear old auto-generated alerts
  for (const [id, a] of alerts) {
    if (a.auto) alerts.delete(id);
  }

  for (const pick of watchlist.picks || []) {
    // Entry zone alert
    createAlert({
      ticker: pick.ticker,
      type: 'entry',
      condition: 'near',
      value: pick.entry,
      message: `${pick.ticker} approaching entry zone $${pick.entry} — Scanner score ${pick.score}, ${pick.strategy}`,
      channels: config.alerts?.channels ? Object.keys(config.alerts.channels).filter(c => config.alerts.channels[c]?.enabled) : ['desktop']
    });
    alerts.get(nextId - 1).auto = true;

    // Stop loss alert
    createAlert({
      ticker: pick.ticker,
      type: 'stop',
      condition: 'below',
      value: pick.stop,
      message: `${pick.ticker} STOP HIT $${pick.stop} — Exit position, thesis invalidated`,
      channels: config.alerts?.channels ? Object.keys(config.alerts.channels).filter(c => config.alerts.channels[c]?.enabled) : ['desktop']
    });
    alerts.get(nextId - 1).auto = true;

    // TP1 alert
    createAlert({
      ticker: pick.ticker,
      type: 'tp',
      condition: 'above',
      value: pick.tp1,
      message: `${pick.ticker} TP1 HIT $${pick.tp1} — Consider scaling out 50%`,
      channels: config.alerts?.channels ? Object.keys(config.alerts.channels).filter(c => config.alerts.channels[c]?.enabled) : ['desktop']
    });
    alerts.get(nextId - 1).auto = true;

    // TP2 alert
    if (pick.tp2) {
      createAlert({
        ticker: pick.ticker,
        type: 'tp',
        condition: 'above',
        value: pick.tp2,
        message: `${pick.ticker} TP2 HIT $${pick.tp2} — Full target reached, close remaining`,
        channels: config.alerts?.channels ? Object.keys(config.alerts.channels).filter(c => config.alerts.channels[c]?.enabled) : ['desktop']
      });
      alerts.get(nextId - 1).auto = true;
    }
  }

  return listAlerts({ status: 'active' });
}

// ══════════════════════════════════════
// CHECK ALERTS AGAINST LIVE DATA
// ══════════════════════════════════════

export async function checkAlerts(quotes) {
  const triggered = [];

  for (const [id, alert] of alerts) {
    if (alert.status !== 'active') continue;

    const quote = quotes.find(q => q.symbol === alert.ticker);
    if (!quote) continue;

    let shouldTrigger = false;
    const price = quote.price;

    switch (alert.condition) {
      case 'above':
        shouldTrigger = price >= alert.value;
        break;
      case 'below':
        shouldTrigger = price <= alert.value;
        break;
      case 'near':
        // Within 1.5% of target
        shouldTrigger = Math.abs(price - alert.value) / alert.value <= 0.015;
        break;
      case 'crosses':
        // Would need previous price — simplified
        shouldTrigger = Math.abs(price - alert.value) / alert.value <= 0.005;
        break;
    }

    if (shouldTrigger && !isThrottled(alert)) {
      alert.triggeredAt = new Date().toISOString();
      alert.triggerCount++;
      throttleMap.set(`${alert.ticker}:${alert.type}`, Date.now());

      const enriched = {
        ...alert,
        currentPrice: price,
        rvol: quote.rvol,
        changePct: quote.changePct
      };

      triggered.push(enriched);
      history.push(enriched);

      // Send notifications
      await notify(enriched);
    }
  }

  return triggered;
}

function isThrottled(alert) {
  const key = `${alert.ticker}:${alert.type}`;
  const last = throttleMap.get(key);
  if (!last) return false;
  const throttle = (config.alerts?.throttle || 60) * 1000;
  return Date.now() - last < throttle;
}

// ══════════════════════════════════════
// NOTIFICATIONS
// ══════════════════════════════════════

async function notify(alert) {
  const channels = alert.channels || ['desktop'];

  for (const channel of channels) {
    try {
      switch (channel) {
        case 'desktop':
          await notifyDesktop(alert);
          break;
        case 'slack':
          await notifySlack(alert);
          break;
        case 'discord':
          await notifyDiscord(alert);
          break;
        case 'telegram':
          await notifyTelegram(alert);
          break;
      }
    } catch (err) {
      console.error(`[Alert] Failed to notify ${channel}:`, err.message);
    }
  }
}

async function notifyDesktop(alert) {
  if (!notifier) return;
  const icon = alert.type === 'stop' ? 'warning' : alert.type === 'tp' ? 'info' : 'notification';
  notifier.notify({
    title: `MW Alert: ${alert.ticker} ${alert.type.toUpperCase()}`,
    message: alert.message,
    sound: true
  });
}

async function notifySlack(alert) {
  const webhook = config.alerts?.channels?.slack?.webhook_url;
  if (!webhook) return;

  const color = alert.type === 'stop' ? '#ef4444' : alert.type === 'tp' ? '#10b981' : '#3b82f6';
  const emoji = alert.type === 'stop' ? ':red_circle:' : alert.type === 'tp' ? ':white_check_mark:' : ':bell:';

  await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${emoji} *${alert.ticker}* — ${alert.type.toUpperCase()}\n${alert.message}`
          }
        },
        {
          type: 'context',
          elements: [
            { type: 'mrkdwn', text: `Price: $${alert.currentPrice} | RVOL: ${alert.rvol || 'N/A'} | Change: ${alert.changePct?.toFixed(2)}%` }
          ]
        }
      ],
      attachments: [{ color }]
    })
  });
}

async function notifyDiscord(alert) {
  const webhook = config.alerts?.channels?.discord?.webhook_url;
  if (!webhook) return;

  const color = alert.type === 'stop' ? 0xef4444 : alert.type === 'tp' ? 0x10b981 : 0x3b82f6;
  const emoji = alert.type === 'stop' ? '🔴' : alert.type === 'tp' ? '✅' : '🔔';

  await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title: `${emoji} ${alert.ticker} — ${alert.type.toUpperCase()}`,
        description: alert.message,
        color,
        fields: [
          { name: 'Price', value: `$${alert.currentPrice}`, inline: true },
          { name: 'RVOL', value: `${alert.rvol || 'N/A'}`, inline: true },
          { name: 'Change', value: `${alert.changePct?.toFixed(2)}%`, inline: true }
        ],
        timestamp: alert.triggeredAt,
        footer: { text: 'DailyTickers MCP' }
      }]
    })
  });
}

async function notifyTelegram(alert) {
  const token = config.alerts?.channels?.telegram?.bot_token;
  const chatId = config.alerts?.channels?.telegram?.chat_id;
  if (!token || !chatId) return;

  const emoji = alert.type === 'stop' ? '🔴' : alert.type === 'tp' ? '✅' : '🔔';
  const text = `${emoji} *${alert.ticker}* — ${alert.type.toUpperCase()}\n\n${alert.message}\n\n💰 Price: $${alert.currentPrice} | RVOL: ${alert.rvol || 'N/A'} | Chg: ${alert.changePct?.toFixed(2)}%`;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown'
    })
  });
}

// ══════════════════════════════════════
// HISTORY
// ══════════════════════════════════════

export function getHistory(limit = 50) {
  return history.slice(-limit);
}

export function clearHistory() {
  history.length = 0;
}
