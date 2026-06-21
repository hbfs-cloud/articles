#!/usr/bin/env node
/**
 * refresh-analyses.js — Re-grade analyses based on current market data.
 *
 * Usage:
 *   node tools/refresh-analyses.js [--max-age 30] [--tickers AAPL,MSFT] [--dry] [--commit]
 *
 * Integrated into the nightly /scanner pipeline:
 *   1. Finds all analyses < max-age days old
 *   2. Fetches current prices via MCP Gateway (bulk) or Yahoo fallback
 *   3. Re-evaluates grade based on price vs trade levels
 *   4. If grade changed: updates JSON, re-renders HTML, updates card badge
 *   5. Optionally commits changes
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data', 'analyses-data');
const GATEWAY = process.env.MCP_GATEWAY_URL || '';

// ─── Grade Scale ────────────────────────────────────────────────────────────

const GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D'];

function gradeIndex(g) {
  const idx = GRADES.indexOf(g);
  return idx >= 0 ? idx : GRADES.length - 1;
}

function shiftGrade(current, delta) {
  const idx = gradeIndex(current);
  const newIdx = Math.max(0, Math.min(GRADES.length - 1, idx + delta));
  return GRADES[newIdx];
}

// ─── MCP JSON-RPC ───────────────────────────────────────────────────────────

function jsonrpcCall(toolName, params) {
  if (!GATEWAY) return Promise.reject(new Error('MCP_GATEWAY_URL not set'));
  const url = new URL(GATEWAY);
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'tools/call',
    params: { name: toolName, arguments: params },
  });
  const transport = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = transport.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + (url.search || ''),
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 30000,
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) reject(new Error(json.error.message || JSON.stringify(json.error)));
          else {
            const content = json.result?.content;
            if (Array.isArray(content) && content[0]?.text) {
              resolve(JSON.parse(content[0].text));
            } else {
              resolve(json.result);
            }
          }
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('MCP timeout')); });
    req.write(body);
    req.end();
  });
}

// ─── Price Fetching ─────────────────────────────────────────────────────────

async function fetchPricesMCP(tickers) {
  const result = await jsonrpcCall('QueryData', {
    symbols: tickers.join(','),
    types: 'quote',
  });
  const prices = {};
  for (const r of (result.results || [])) {
    if (r.data_type !== 'quote' || !r.data) continue;
    const sym = r.symbol || r.symbols?.[0];
    const price = r.data.regularMarketPrice || r.data.price || r.data.close || r.data.last;
    if (sym && price) prices[sym] = parseFloat(price);
  }
  return prices;
}

async function fetchPricesYahoo(tickers) {
  const PROXY = 'https://api.allorigins.win/get?url=';
  const prices = {};
  const concurrency = 6;

  async function fetchOne(ticker) {
    const hosts = ['query2.finance.yahoo.com', 'query1.finance.yahoo.com'];
    for (const host of hosts) {
      try {
        const yahooUrl = `https://${host}/v8/finance/chart/${encodeURIComponent(ticker)}?range=1d&interval=1d`;
        const raw = await httpGet(PROXY + encodeURIComponent(yahooUrl));
        const wrapper = JSON.parse(raw);
        const data = JSON.parse(wrapper.contents);
        const meta = data?.chart?.result?.[0]?.meta;
        if (meta?.regularMarketPrice) {
          prices[ticker] = meta.regularMarketPrice;
          return;
        }
      } catch {}
    }
  }

  for (let i = 0; i < tickers.length; i += concurrency) {
    const batch = tickers.slice(i, i + concurrency);
    await Promise.all(batch.map(fetchOne));
  }
  return prices;
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const transport = url.startsWith('https') ? https : http;
    transport.get(url, { headers: { 'User-Agent': 'DailyTickers/1.0' }, timeout: 15000 }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function fetchPrices(tickers) {
  if (GATEWAY) {
    try {
      console.log(`[MCP] Fetching ${tickers.length} quotes via Gateway...`);
      const prices = await fetchPricesMCP(tickers);
      const found = Object.keys(prices).length;
      console.log(`[MCP] Got ${found}/${tickers.length} prices`);
      if (found > 0) return prices;
    } catch (e) {
      console.error(`[MCP] Failed: ${e.message}, falling back to Yahoo`);
    }
  }
  console.log(`[Yahoo] Fetching ${tickers.length} quotes...`);
  return fetchPricesYahoo(tickers);
}

// ─── Grade Re-evaluation ────────────────────────────────────────────────────

function evaluateGrade(data, currentPrice) {
  const meta = data.meta || {};
  const trade = data.tradeIdea || {};
  const currentGrade = meta.grade || 'B';
  const reasons = [];

  if (!currentPrice || currentPrice <= 0) {
    return { newGrade: currentGrade, reasons: ['No price data'], delta: 0 };
  }

  const entry = trade.entry || trade.entryLow || 0;
  const stop = trade.stop || 0;
  const tp1 = trade.tp1 || 0;
  const tp2 = trade.tp2 || 0;

  if (!entry || !stop) {
    return { newGrade: currentGrade, reasons: ['No trade levels'], delta: 0 };
  }

  let gradeDelta = 0;
  let status = 'active';

  // Trade completed successfully — price above TP2
  if (tp2 > 0 && currentPrice >= tp2) {
    status = 'completed';
    reasons.push(`Trade completed — above TP2 ($${tp2})`);
    return { newGrade: currentGrade, reasons, delta: 0, status };
  }

  // Price above TP1 — trade partially succeeded
  if (tp1 > 0 && currentPrice > tp1) {
    status = 'tp1-hit';
    reasons.push(`Above TP1 ($${tp1})`);
    // Only mild R/R concern — the original call was good
    const upside2 = tp2 > 0 ? tp2 - currentPrice : 0;
    const downside = currentPrice - stop;
    if (tp2 > 0 && downside > 0) {
      const rr2 = upside2 / downside;
      if (rr2 < 0.5) {
        gradeDelta += 1;
        reasons.push(`Remaining R/R to TP2: ${rr2.toFixed(1)}`);
      }
    }
    gradeDelta = Math.min(gradeDelta, 1);
    const newGrade = shiftGrade(currentGrade, gradeDelta);
    return { newGrade, reasons, delta: gradeDelta, status };
  }

  // Price vs stop loss — thesis failing
  if (currentPrice < stop) {
    status = 'stopped';
    gradeDelta += 3;
    reasons.push(`Below stop ($${stop})`);
  } else if (entry > 0 && currentPrice < entry * 0.95) {
    gradeDelta += 2;
    reasons.push(`>5% below entry ($${entry})`);
  } else if (entry > 0 && currentPrice < entry) {
    gradeDelta += 1;
    reasons.push(`Below entry ($${entry})`);
  }

  // R/R at current price (only when below TP1)
  if (tp1 > 0 && stop > 0 && currentPrice > 0) {
    const upside = tp1 - currentPrice;
    const downside = currentPrice - stop;
    if (downside > 0 && upside > 0) {
      const rr = upside / downside;
      if (rr < 0.5) {
        gradeDelta += 2;
        reasons.push(`R/R collapsed to ${rr.toFixed(1)}`);
      } else if (rr < 1.0) {
        gradeDelta += 1;
        reasons.push(`R/R weak at ${rr.toFixed(1)}`);
      }
    }
  }

  // Technical checks
  const tech = data.technicals || {};
  if (tech.rsi14 > 80) {
    gradeDelta += 1;
    reasons.push(`RSI overbought (${tech.rsi14})`);
  }
  if (tech.ema200 && currentPrice < tech.ema200 && entry > tech.ema200) {
    gradeDelta += 1;
    reasons.push(`Broke below EMA200`);
  }

  gradeDelta = Math.min(gradeDelta, 4);
  const newGrade = shiftGrade(currentGrade, gradeDelta);

  return { newGrade, reasons, delta: gradeDelta, status };
}

// ─── Card Badge Update ──────────────────────────────────────────────────────

function updateCardBadge(ticker, oldGrade, newGrade) {
  const jsonFile = path.join(ROOT, 'data', 'analyses.json');
  if (!fs.existsSync(jsonFile)) return;

  let cards = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  const hrefPattern = `analyses/${ticker}/`;

  cards = cards.map(card => {
    if (!card.includes(hrefPattern)) return card;
    const arrow = gradeIndex(newGrade) > gradeIndex(oldGrade) ? '⬇' : '⬆';
    const badgeColor = gradeIndex(newGrade) > gradeIndex(oldGrade) ? 'red' : 'green';
    const badge = `<span class="badge badge-${badgeColor}" style="font-size:0.65rem;margin-left:0.25rem;">${arrow} ${oldGrade} → ${newGrade}</span>`;

    // Remove existing grade-change badge if any
    let updated = card.replace(/<span class="badge badge-(?:red|green)"[^>]*>(?:⬇|⬆)[^<]*<\/span>/g, '');

    // Insert badge after the grade badge
    const gradeMatch = updated.match(/(<span[^>]*grade-badge[^>]*>[^<]*<\/span>)/);
    if (gradeMatch) {
      updated = updated.replace(gradeMatch[0], gradeMatch[0] + badge);
    } else {
      // Insert after report-card-meta
      updated = updated.replace(/(<div class="report-card-meta">[^<]*<\/div>)/, `$1\n    ${badge}`);
    }

    // Update grade in data-grade attribute
    updated = updated.replace(/data-grade="[^"]*"/, `data-grade="${newGrade}"`);

    // Update grade badge content
    const gradeColorMap = { A: '#22c55e', B: '#3b82f6', C: '#f59e0b', D: '#ef4444' };
    const newColor = gradeColorMap[newGrade[0]] || '#64748b';
    updated = updated.replace(
      /(<span[^>]*grade-badge[^>]*style="background:\s*)[^;"]+/,
      `$1${newColor}`
    );
    updated = updated.replace(
      /(<span[^>]*grade-badge[^>]*>)[^<]*/,
      `$1${newGrade}`
    );

    // Update card date to today
    const months = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    const now = new Date();
    const todayStr = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
    updated = updated.replace(
      /(<div class="report-card-meta">)\s*[^<]+/,
      `$1\n        ${todayStr}\n       `
    );

    return updated;
  });

  fs.writeFileSync(jsonFile, JSON.stringify(cards, null, 2), 'utf8');
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter(a => a.startsWith('--')));
  const dryRun = flags.has('--dry');
  const doCommit = flags.has('--commit');

  // Parse --max-age
  let maxAge = 30;
  const maxAgeIdx = args.indexOf('--max-age');
  if (maxAgeIdx >= 0 && args[maxAgeIdx + 1]) maxAge = parseInt(args[maxAgeIdx + 1], 10);

  // Parse --tickers
  let forceTickers = [];
  const tickerIdx = args.indexOf('--tickers');
  if (tickerIdx >= 0 && args[tickerIdx + 1]) {
    forceTickers = args[tickerIdx + 1].split(',').map(t => t.trim().toUpperCase());
  }

  // Find eligible analyses
  const now = Date.now();
  const cutoff = maxAge * 86400000;
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));

  const eligible = [];
  for (const f of files) {
    const ticker = f.replace('.json', '');
    const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
    const date = new Date(data.meta?.date || '2020-01-01');
    const isRecent = (now - date.getTime()) < cutoff;
    const isForced = forceTickers.includes(ticker);

    if (isRecent || isForced) {
      eligible.push({ ticker, data, file: f });
    }
  }

  console.log(`\n🔄 refresh-analyses: ${eligible.length} eligible (max-age=${maxAge}d, forced=${forceTickers.length})`);
  if (!eligible.length) { console.log('Nothing to refresh.'); return; }

  // Fetch all prices in bulk
  const allTickers = eligible.map(e => e.ticker).filter(t => !t.includes('USD') || t === 'XAUUSD');
  const stockTickers = allTickers.filter(t => !t.includes('/') && t !== 'XAUUSD' && t !== 'EURUSD');

  let prices = {};
  if (stockTickers.length) {
    prices = await fetchPrices(stockTickers);
  }

  // Evaluate each
  const changes = [];
  const checked = [];

  for (const { ticker, data, file } of eligible) {
    const currentPrice = prices[ticker] || 0;
    const oldGrade = data.meta?.grade || 'B';
    const { newGrade, reasons, delta, status } = evaluateGrade(data, currentPrice);

    const priceStr = currentPrice ? `$${currentPrice.toFixed(2)}` : 'N/A';
    const statusIcon = { completed: '✅', 'tp1-hit': '🎯', stopped: '🛑', active: '=' };
    const icon = delta > 0 ? '⬇' : (statusIcon[status] || '=');

    if (status === 'completed' || status === 'tp1-hit') {
      console.log(`  ${statusIcon[status]} ${ticker}: ${oldGrade} [${status}] (${priceStr}) — ${reasons.join(', ')}`);
    }

    if (newGrade !== oldGrade) {
      console.log(`  ${icon} ${ticker}: ${oldGrade} → ${newGrade} (${priceStr}) — ${reasons.join(', ')}`);
      changes.push({ ticker, data, file, oldGrade, newGrade, reasons, currentPrice, status });
    } else {
      checked.push(ticker);
    }

    // Track status changes even without grade change
    if (status !== 'active' && data.meta.status !== status) {
      data.meta.status = status;
    }

    // Always update lastCheckedAt
    data.meta.lastCheckedAt = new Date().toISOString();
    if (currentPrice > 0) {
      data.meta.lastCheckedPrice = currentPrice;
    }
  }

  console.log(`\n📊 Results: ${changes.length} grade changes, ${checked.length} unchanged`);

  if (dryRun) {
    console.log('\n[DRY RUN] No files modified.');
    return;
  }

  // Apply changes
  const updatedTickers = [];

  for (const { ticker, data, file, oldGrade, newGrade, reasons, currentPrice } of changes) {
    // Update JSON
    const jsonPath = path.join(DATA_DIR, file);
    data.meta.grade = newGrade;
    data.meta.lastCheckedAt = new Date().toISOString();
    if (currentPrice > 0) data.meta.lastCheckedPrice = currentPrice;

    // Append to gradeHistory
    if (!data.meta.gradeHistory) data.meta.gradeHistory = [];
    data.meta.gradeHistory.push({
      date: new Date().toISOString().slice(0, 10),
      from: oldGrade,
      to: newGrade,
      reason: reasons.join('; '),
      price: currentPrice || null,
    });

    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');

    // Re-render HTML via publish-analysis.js
    try {
      const cmd = `node ${path.join(__dirname, 'publish-analysis.js')} ${jsonPath}`;
      execSync(cmd, { cwd: ROOT, stdio: 'pipe' });
      console.log(`  ✅ Re-rendered ${ticker}`);
    } catch (e) {
      console.error(`  ❌ Render failed for ${ticker}: ${e.message}`);
    }

    // Update card badge in analyses.json
    updateCardBadge(ticker, oldGrade, newGrade);

    updatedTickers.push(ticker);
  }

  // Also save lastCheckedAt for unchanged analyses
  for (const { data, file } of eligible) {
    if (!updatedTickers.includes(file.replace('.json', ''))) {
      fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), 'utf8');
    }
  }

  if (updatedTickers.length > 0) {
    console.log(`\n✅ Updated ${updatedTickers.length} analyses: ${updatedTickers.join(', ')}`);

    if (doCommit) {
      try {
        const filesToAdd = [
          'data/analyses-data/',
          'data/analyses.json',
          ...updatedTickers.map(t => `analyses/${t}/`),
        ];
        execSync(`git add ${filesToAdd.join(' ')}`, { cwd: ROOT, stdio: 'pipe' });
        const msg = `chore(analyses): refresh grades — ${updatedTickers.map(t => {
          const c = changes.find(ch => ch.ticker === t);
          return `${t} ${c.oldGrade}→${c.newGrade}`;
        }).join(', ')}`;
        execSync(`git commit -m "${msg}\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"`, { cwd: ROOT, stdio: 'pipe' });
        console.log('[COMMITTED]');
      } catch (e) {
        console.error(`[COMMIT FAILED] ${e.message}`);
      }
    }
  } else {
    console.log('\n✅ All grades confirmed — no changes needed.');
  }
}

main().catch(e => {
  console.error(`[FATAL] ${e.message}`);
  process.exit(1);
});
