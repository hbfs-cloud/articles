'use strict';

// Notifier — sends trading events to Telegram and/or Discord.
// Attaches to Engine events. Works in paper and live mode identically.
// Config via env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_TOPIC_*
//                 DISCORD_WEBHOOK_URL

const https = require('https');

const MODE_TOPICS = {
  turbo: 'TELEGRAM_TOPIC_TURBO',
  dynamic: 'TELEGRAM_TOPIC_DYNAMIC',
  balanced: 'TELEGRAM_TOPIC_BALANCED',
  secured: 'TELEGRAM_TOPIC_SECURED',
  fortress: 'TELEGRAM_TOPIC_FORTRESS',
  tkl: 'TELEGRAM_TOPIC_TKL',
};

class Notifier {
  constructor(engine, opts = {}) {
    this.engine = engine;
    this.mode = engine.plan.mode.name;
    this.broker = engine.plan.broker.name;
    this.telegramToken = opts.telegram_token || process.env.TELEGRAM_BOT_TOKEN;
    this.telegramChat = opts.telegram_chat || process.env.TELEGRAM_CHAT_ID;
    this.telegramTopic = process.env[MODE_TOPICS[this.mode]] || null;
    this.discordWebhook = opts.discord_webhook || process.env.DISCORD_WEBHOOK_URL;
    this.enabled = !!(this.telegramToken || this.discordWebhook);
    this.quiet = opts.quiet || false;

    if (this.enabled) this._attach();
  }

  _attach() {
    const eng = this.engine;
    const origLog = eng._log.bind(eng);

    eng._log = (level, msg, data) => {
      origLog(level, msg, data);
      if (level === 'FILL') this._onFill(msg, data);
      if (level === 'TRADE') this._onTrade(msg, data);
      if (level === 'ERROR') this._onError(msg, data);
      if (level === 'PHASE' && msg.includes('CLOSE_SESSION')) this._onSessionEnd();
    };
  }

  _onFill(msg, data) {
    const prefix = this.broker === 'paper' ? '📝 [PAPER]' : '✅';
    this._send(`${prefix} FILL: ${msg}`);
  }

  _onTrade(msg, data) {
    const prefix = this.broker === 'paper' ? '📝 [PAPER]' : '💰';
    this._send(`${prefix} ${msg}`);
  }

  _onError(msg, data) {
    this._send(`🚨 ERROR (${this.mode}/${this.broker}): ${msg}`);
  }

  _onSessionEnd() {
    const states = this.engine.orderState;
    const filled = [...states.values()].filter(os => os.state === 'FILLED').length;
    const skipped = [...states.values()].filter(os => os.state === 'SKIPPED').length;
    const errors = this.engine.errors.length;
    const closes = this.engine.trades.filter(t => t.type === 'CLOSE').length;
    const prefix = this.broker === 'paper' ? '📝 [PAPER] ' : '';

    const lines = [
      `${prefix}📊 Session Complete — ${this.mode}/${this.broker}`,
      `Filled: ${filled} | Skipped: ${skipped} | Closed: ${closes} | Errors: ${errors}`,
    ];

    // List fills
    for (const [id, os] of states) {
      if (os.state === 'FILLED') {
        const fill = os.fills[0];
        lines.push(`  → ${os.ticker} @ $${fill?.price?.toFixed(2) || '?'} x${fill?.qty || '?'}`);
      }
    }

    this._send(lines.join('\n'));
  }

  async _send(text) {
    if (!this.enabled || this.quiet) return;
    const promises = [];
    if (this.telegramToken && this.telegramChat) promises.push(this._sendTelegram(text));
    if (this.discordWebhook) promises.push(this._sendDiscord(text));
    await Promise.allSettled(promises);
  }

  _sendTelegram(text) {
    const body = {
      chat_id: this.telegramChat,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    };
    if (this.telegramTopic) body.message_thread_id = +this.telegramTopic;

    return this._post(`api.telegram.org`, `/bot${this.telegramToken}/sendMessage`, body);
  }

  _sendDiscord(text) {
    const url = new URL(this.discordWebhook);
    return this._post(url.hostname, url.pathname, { content: text });
  }

  _post(host, path, body) {
    return new Promise((resolve) => {
      const data = JSON.stringify(body);
      const req = https.request({
        hostname: host,
        port: 443,
        path,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      }, (res) => {
        res.resume();
        res.on('end', resolve);
      });
      req.on('error', resolve);
      req.setTimeout(10000, () => { req.destroy(); resolve(); });
      req.write(data);
      req.end();
    });
  }
}

module.exports = { Notifier };
