#!/usr/bin/env node

/**
 * Market Watch MCP Setup Wizard
 * Interactive setup for config.yaml
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = resolve(__dirname, 'config.yaml');
const examplePath = resolve(__dirname, 'config.example.yaml');

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(r => rl.question(q, r));

async function main() {
  console.log('\n  Market Watch MCP — Setup Wizard\n');
  console.log('  This will create your config.yaml with your preferences.\n');

  if (existsSync(configPath)) {
    const overwrite = await ask('  config.yaml already exists. Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('  Setup cancelled.\n');
      rl.close();
      return;
    }
  }

  // Copy example config
  copyFileSync(examplePath, configPath);
  let config = readFileSync(configPath, 'utf8');

  // DeepSeek
  console.log('\n  --- AI Provider (for analysis, sentiment, DD) ---');
  console.log('  DeepSeek is free via browser extension (recommended)');
  console.log('  Or use DeepSeek API (free tier available at platform.deepseek.com)');
  const deepseekKey = await ask('  DeepSeek API key (or press Enter to skip): ');
  if (deepseekKey) {
    config = config.replace(/deepseek:\n    api_key: ""/, `deepseek:\n    api_key: "${deepseekKey}"`);
  }

  // Slack
  console.log('\n  --- Notifications ---');
  const slackUrl = await ask('  Slack webhook URL (or Enter to skip): ');
  if (slackUrl) {
    config = config.replace(/slack:\n      enabled: false\n      webhook_url: ""/, `slack:\n      enabled: true\n      webhook_url: "${slackUrl}"`);
  }

  // Discord
  const discordUrl = await ask('  Discord webhook URL (or Enter to skip): ');
  if (discordUrl) {
    config = config.replace(/discord:\n      enabled: false\n      webhook_url: ""/, `discord:\n      enabled: true\n      webhook_url: "${discordUrl}"`);
  }

  // Telegram
  const tgToken = await ask('  Telegram bot token (or Enter to skip): ');
  if (tgToken) {
    const tgChat = await ask('  Telegram chat ID: ');
    config = config.replace(/telegram:\n      enabled: false\n      bot_token: ""\n      chat_id: ""/, `telegram:\n      enabled: true\n      bot_token: "${tgToken}"\n      chat_id: "${tgChat}"`);
  }

  // Custom tickers
  const custom = await ask('\n  Custom tickers to monitor (comma-separated, or Enter): ');
  if (custom) {
    const tickers = custom.split(',').map(t => `"${t.trim().toUpperCase()}"`).join(', ');
    config = config.replace(/custom_tickers: \[\]/, `custom_tickers: [${tickers}]`);
  }

  writeFileSync(configPath, config);

  console.log('\n  config.yaml created successfully!');
  console.log('\n  Next steps:');
  console.log('    1. Start the MCP server:  node index.js');
  console.log('    2. Start the dashboard:   node dashboard.js');
  console.log('    3. Add to Claude Code:');
  console.log(`       "mcpServers": { "market-watch": { "command": "node", "args": ["${resolve(__dirname, 'index.js')}"] } }`);
  console.log('    4. Install the browser extension from mcp/extension/');
  console.log('');

  rl.close();
}

main().catch(err => { console.error(err); rl.close(); process.exit(1); });
