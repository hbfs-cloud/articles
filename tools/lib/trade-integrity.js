const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const TRADES_PATH = path.join(ROOT, 'data/backtest-trades.json');
const CHAIN_PATH = path.join(ROOT, 'data/trade-chain.json');

function hashTrade(t) {
  const canonical = JSON.stringify({
    ticker: t.ticker, scanDate: t.scanDate, entryDate: t.entryDate,
    exitDate: t.exitDate, actualEntry: t.actualEntry, exitPrice: t.exitPrice,
    pnlPct: t.pnlPct, status: t.status, strategy: t.strategy,
  });
  return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

function buildChain(trades) {
  let prevHash = '0000000000000000';
  const chain = [];
  for (const t of trades) {
    const tradeHash = hashTrade(t);
    const blockHash = crypto.createHash('sha256')
      .update(prevHash + tradeHash)
      .digest('hex').slice(0, 16);
    chain.push({ tradeHash, blockHash, ticker: t.ticker, scanDate: t.scanDate, status: t.status });
    prevHash = blockHash;
  }
  return chain;
}

function verifyChain(modeId, trades, savedChain) {
  if (!savedChain || savedChain.length === 0) return { valid: true, newTrades: trades.length };
  let prevHash = '0000000000000000';
  for (let i = 0; i < savedChain.length; i++) {
    if (i >= trades.length) {
      return { valid: false, error: `trade #${i} (${savedChain[i].ticker} ${savedChain[i].scanDate}) was DELETED`, index: i };
    }
    const tradeHash = hashTrade(trades[i]);
    const blockHash = crypto.createHash('sha256')
      .update(prevHash + tradeHash)
      .digest('hex').slice(0, 16);
    if (blockHash !== savedChain[i].blockHash) {
      return {
        valid: false,
        error: `trade #${i} (${trades[i].ticker} ${trades[i].scanDate}) was MODIFIED — chain broken`,
        index: i,
        expected: savedChain[i].blockHash,
        got: blockHash,
      };
    }
    prevHash = blockHash;
  }
  return { valid: true, newTrades: trades.length - savedChain.length };
}

function seal() {
  const trades = JSON.parse(fs.readFileSync(TRADES_PATH, 'utf8'));
  const chain = {};
  for (const [modeId, modeTrades] of Object.entries(trades)) {
    if (!Array.isArray(modeTrades)) continue;
    const closed = modeTrades.filter(t => t.status !== 'pending' && t.status !== 'sim2_artifact');
    chain[modeId] = buildChain(closed);
  }
  fs.writeFileSync(CHAIN_PATH, JSON.stringify(chain, null, 2) + '\n');
  const total = Object.values(chain).reduce((s, c) => s + c.length, 0);
  console.log(`✅ Sealed ${total} trades across ${Object.keys(chain).length} modes → ${CHAIN_PATH}`);
  return chain;
}

function verify() {
  if (!fs.existsSync(CHAIN_PATH)) return { ok: true, message: 'No chain file — first run' };
  const savedChains = JSON.parse(fs.readFileSync(CHAIN_PATH, 'utf8'));
  const trades = JSON.parse(fs.readFileSync(TRADES_PATH, 'utf8'));
  const results = {};
  let allValid = true;
  for (const [modeId, savedChain] of Object.entries(savedChains)) {
    const modeTrades = (trades[modeId] || []).filter(t => t.status !== 'pending' && t.status !== 'sim2_artifact');
    const result = verifyChain(modeId, modeTrades, savedChain);
    results[modeId] = result;
    if (!result.valid) {
      allValid = false;
      console.error(`❌ ${modeId}: ${result.error}`);
    } else if (result.newTrades > 0) {
      console.log(`✅ ${modeId}: chain valid, ${result.newTrades} new trades to seal`);
    } else {
      console.log(`✅ ${modeId}: chain valid, no changes`);
    }
  }
  return { ok: allValid, results };
}

module.exports = { seal, verify, hashTrade, buildChain, verifyChain };

if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === 'seal') {
    seal();
  } else if (cmd === 'verify') {
    const { ok } = verify();
    process.exit(ok ? 0 : 1);
  } else {
    console.log('Usage: node trade-integrity.js <seal|verify>');
  }
}
