'use strict';

/**
 * Certified daily bars for non-editorial scanner consumers.
 *
 * This helper deliberately has no cache or public-data fallback.  A caller gets
 * bars only after the Marketdata MCP has proved the requested completed close
 * for every requested symbol.  It is intentionally small so chain C tools use
 * the same completed-bar contract as the collectors. Raw responses, including
 * failed cells and async job IDs, are retained in a private receipt directory.
 */

const contract = require('./marketdata-bars-contract');
const { EQUITY_CALENDAR, CRYPTO_CALENDAR, calendarForSymbol, isSession, nextSession } = require('./equity-session-calendars');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

// Sources de repli par symbole, essayées DANS CET ORDRE quand la série webull se contredit.
// Elles restent toutes des sources marketdata : aucun repli hors MCP, aucune barre synthétique.
const PRIMARY_US_BAR_SOURCE = 'webull';
const ALT_BAR_SOURCES = Object.freeze(['tiingo', 'yahoo']);

function argValue(argv, name, envName) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : process.env[envName];
}

function requireIsoDate(value, label) {
  if (!isValidIsoDate(String(value || ''))) {
    throw new Error(`${label} is required as YYYY-MM-DD; refusing an implicit live close`);
  }
  return value;
}

function requireTimestamp(value) {
  if (!value || !Number.isFinite(Date.parse(value))) {
    throw new Error('--asof is required as an ISO timestamp; refusing an implicit live request');
  }
  return value;
}

function runArgs(argv = process.argv) {
  return {
    refdate: requireIsoDate(argValue(argv, '--refdate', 'SCANNER_REFDATE'), '--refdate'),
    cryptoRefdate: argValue(argv, '--crypto-refdate', 'SCANNER_CRYPTO_REFDATA') || null,
    asOfTimestamp: requireTimestamp(argValue(argv, '--asof', 'SCANNER_ASOF')),
  };
}

function isCryptoSymbol(symbol) {
  return /-USD$/i.test(String(symbol || ''));
}

function isValidIsoDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T00:00:00Z`))
    && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
}

// `allowUnreliableOpen` ne desserre RIEN sur high/low/close : il autorise le seul cas
// où l'open servi sort de [low, high] alors que le reste de la barre est cohérent.
// Le fournisseur produit cet écart en prenant l'open sur une impression pré-marché
// (7 symboles sur 112 le 2026-09-15 ; RefreshBars resert le même open). Seuls les
// consommateurs qui ne lisent pas l'open peuvent l'activer — update-tracking et
// analyses-lifecycle. sweep.js s'en sert comme prix de fill et reste donc strict.
function normalizeBars(row, symbol, calendar, opts = {}) {
  const allowUnreliableOpen = opts.allowUnreliableOpen === true;
  const raw = row && row.bars;
  if (!Array.isArray(raw) || raw.length === 0) throw new Error(`${symbol}: bars_daily returned no bars`);
  const out = [];
  for (const bar of raw) {
    const value = Array.isArray(bar)
      ? { date: bar[0], open: bar[1], high: bar[2], low: bar[3], close: bar[4], volume: bar[5] }
      : bar;
    const date = String(value && value.date || '').slice(0, 10);
    const open = Number(value && value.open), high = Number(value && value.high);
    const low = Number(value && value.low), close = Number(value && value.close);
    const rawVolume = value && value.volume;
    const volume = Number(rawVolume);
    if (rawVolume === null || rawVolume === '' || rawVolume === undefined
      || !isValidIsoDate(date) || ![open, high, low, close, volume].every(Number.isFinite)) {
      throw new Error(`${symbol}: malformed bars_daily row`);
    }
    if (open <= 0 || high <= 0 || low <= 0 || close <= 0 || volume < 0
      || high < Math.max(low, close) || low > Math.min(high, close)) {
      throw new Error(`${symbol}: invalid OHLCV bounds`);
    }
    const openInRange = open >= low && open <= high;
    if (!openInRange && !allowUnreliableOpen) {
      throw new Error(`${symbol}: open ${open} outside [${low}, ${high}] on ${date}`);
    }
    if (!isSession(date, calendar)) throw new Error(`${symbol}: bar on a non-session date ${date} (${calendar})`);
    out.push({ date, open, high, low, close, volume, ...(openInRange ? {} : { open_unreliable: true }) });
  }
  for (let i = 1; i < out.length; i++) {
    const prior = out[i - 1].date, current = out[i].date;
    if (current <= prior) throw new Error(`${symbol}: duplicate or non-monotonic bar date ${current}`);
    const expected = nextSession(prior, calendar);
    if (current !== expected) throw new Error(`${symbol}: incomplete ${calendar} bar sequence (${prior} → ${current}, expected ${expected})`);
  }
  return out;
}

function jobId(value) {
  if (!value || typeof value !== 'object') return null;
  return value.job_id || value.jobId || value.data && (value.data.job_id || value.data.jobId) || null;
}

async function completedResponse(client, args, recordReceipt) {
  const initial = await client.callToolWithRetry('marketdata', 'QueryData', args);
  const id = jobId(initial);
  recordReceipt({ phase: 'initial', args, job_id: id, response: initial });
  if (!id) return initial;
  try {
    const terminal = await client.awaitJob('marketdata', id);
    recordReceipt({ phase: 'terminal', args, job_id: id, response: terminal });
    return terminal;
  } catch (error) {
    recordReceipt({ phase: 'error', args, job_id: id, error: error.message });
    throw error;
  }
}

/**
 * Returns Map<symbol, [{date,open,high,low,close,volume}]>.
 * Every returned series is bounded by, and proves, its requested completed end.
 */
async function fetchCertifiedDailyBars({ symbols, refdate, cryptoRefdate, asOfTimestamp, limit = 160, batchSize = 25, allowUnreliableOpen = false, client = require('./mcp-client'), receiptDir = path.resolve(__dirname, '../../.agent/mcp-daily-bars') }) {
  const requested = [...new Set((symbols || []).map(String).map(s => s.trim()).filter(Boolean))];
  if (!requested.length) return new Map();
  refdate = requireIsoDate(refdate, '--refdate');
  asOfTimestamp = requireTimestamp(asOfTimestamp);
  const groups = new Map();
  for (const symbol of requested) {
    const calendar = calendarForSymbol(symbol);
    if (!groups.has(calendar)) groups.set(calendar, []);
    groups.get(calendar).push(symbol);
  }
  const equities = groups.get(EQUITY_CALENDAR) || [];
  const recordReceipt = receipt => {
    if (!receiptDir) return;
    fs.mkdirSync(receiptDir, { recursive: true });
    const redact = require('./mcp-client').redactSecrets;
    fs.writeFileSync(path.join(receiptDir, `${Date.now()}-${randomUUID()}.json`), redact(JSON.stringify({ captured_at: new Date().toISOString(), ...receipt }, null, 2)));
  };
  const crypto = requested.filter(isCryptoSymbol);
  if (crypto.length) cryptoRefdate = requireIsoDate(cryptoRefdate, '--crypto-refdate');
  if (!client.canCallDirectly('marketdata')) {
    throw new Error('marketdata MCP read-only token unavailable; chain C fails closed (no public-data fallback)');
  }

  const status = await client.callToolWithRetry('marketdata', 'GetStatus', {});
  const statusCheck = contract.validateOperationReadiness(status, {
    equityReferenceClose: equities.length ? refdate : null,
    cryptoCompletedRefdate: crypto.length ? cryptoRefdate : null,
    minimumBuild: contract.MIN_MARKETDATA_BUILD,
  });
  if (statusCheck.errors.length) {
    throw new Error(`marketdata readiness rejected: ${statusCheck.errors.join('; ')}`);
  }

  const result = new Map();
  for (const [calendar, symbols] of groups) {
    const group = { symbols, calendar, expected: calendar === CRYPTO_CALENDAR ? cryptoRefdate : refdate };
    if (!group.symbols.length) continue;
    for (let offset = 0; offset < group.symbols.length; offset += batchSize) {
      const symbolsBatch = group.symbols.slice(offset, offset + batchSize);
      const response = await completedResponse(client, {
        types: 'bars_daily', symbols: symbolsBatch.join(','), limit,
        ...(group.calendar === EQUITY_CALENDAR ? { source: PRIMARY_US_BAR_SOURCE } : {}),
        as_of_timestamp: asOfTimestamp, completion_policy: 'completed_only',
      }, recordReceipt);
      const check = contract.validateQueryData(response, {
        symbols: symbolsBatch.join(','), assetCalendar: group.calendar,
        expectedCompletedEnd: group.expected,
      });
      const repairable = new Map();
      const unrepairable = [];
      for (const error of check.errors) {
        const match = /^([^:]+): (invalid daily OHLCV geometry|daily session continuity failed)/.exec(error);
        if (!match || !symbolsBatch.includes(match[1])) unrepairable.push(error);
        else {
          if (!repairable.has(match[1])) repairable.set(match[1], []);
          repairable.get(match[1]).push(error);
        }
      }
      if (unrepairable.length) {
        throw new Error(`marketdata bars rejected: ${unrepairable.join('; ')}${check.retryAt ? `; retry_at=${check.retryAt}` : ''}${receiptDir ? `; receipt_dir=${receiptDir}` : ''}`);
      }
      const accepted = check.healthyCells.filter(item => item.status === 'completed' && item.row);
      for (const [symbol, reasons] of repairable) {
        let replacement = null, replacementSource = null;
        for (const source of ALT_BAR_SOURCES) {
          const alt = await completedResponse(client, {
            types: 'bars_daily', symbols: symbol, limit,
            as_of_timestamp: asOfTimestamp, completion_policy: 'completed_only', source,
          }, recordReceipt).catch(() => null);
          if (!alt) continue;
          const altCheck = contract.validateQueryData(alt, {
            symbols: symbol, assetCalendar: group.calendar, expectedCompletedEnd: group.expected,
          });
          if (altCheck.errors.length) continue;
          replacement = altCheck.healthyCells.find(item => item.id === symbol && item.status === 'completed' && item.row) || null;
          if (replacement) { replacementSource = source; break; }
        }
        if (!replacement) {
          throw new Error(`${symbol}: série ${PRIMARY_US_BAR_SOURCE} défectueuse et aucun repli cohérent (${ALT_BAR_SOURCES.join(', ')}) — ${reasons.join('; ')}`);
        }
        console.log(`  [source] ${symbol}: série ${PRIMARY_US_BAR_SOURCE} défectueuse → barres reprises sur ${replacementSource} (${reasons.join('; ')})`);
        accepted.push(replacement);
      }
      for (const item of accepted) {
        if (item.status !== 'completed' || !item.row) throw new Error(`${item.id}: no completed daily-bar row`);
        let bars;
        try {
          bars = normalizeBars(item.row, item.id, group.calendar, { allowUnreliableOpen }).filter(bar => bar.date <= group.expected);
        } catch (error) {
          // Défense secondaire : si normalizeBars détecte une incohérence que le contrat
          // de réponse n'a pas classée, rejouer le symbole sur les mêmes sources MCP.
          // Le défaut yahoo du 2026-09-15 : high/low calculés sur la séance régulière SANS
          // l'impression d'ouverture, donc une barre qui se contredit. Vérifié sur STT contre
          // l'intraday 15m (ouverture 187.45 = plus haut réel, yahoo servait high=187.265) :
          // un high tronqué fait MANQUER un take-profit, un low tronqué manque un stop.
          // On rejoue le seul symbole atteint sur tiingo, qui inclut l'ouverture. Aucun repli
          // hors MCP, et si tiingo se contredit aussi on échoue franchement.
          // Deux défauts de série yahoo appellent le même remède : bornes qui se contredisent
          // et séances manquantes au milieu de l'historique (AMKR saute les 21 et 22/07/2026,
          // que tiingo sert). Tout autre échec reste fatal.
          if (!/invalid OHLCV bounds|open .* outside |incomplete .* bar sequence/.test(error.message)) throw error;
          // Un seul fournisseur de repli ne suffit pas : le 2026-09-16 à 20h54 UTC, tiingo
          // était en cooldown côté serveur et NU restait bloqué sur un high tronqué
          // (o=14.01 h=14.00 l=13.58) alors que webull servait la barre juste (h=14.07),
          // confirmée par l'intraday 15 minutes dont la première bougie de séance touche
          // 14.07. Une panne d'un fournisseur secondaire ne doit pas abattre la chaîne
          // quand un autre sert la même vérité : on essaie les replis dans l'ordre et on
          // n'échoue que si AUCUN ne rend une série cohérente.
          let altCell = null, altSource = null;
          for (const source of ALT_BAR_SOURCES) {
            const alt = await completedResponse(client, {
              types: 'bars_daily', symbols: item.id, limit,
              as_of_timestamp: asOfTimestamp, completion_policy: 'completed_only', source,
            }, recordReceipt).catch(() => null);
            if (!alt) continue;
            const altCheck = contract.validateQueryData(alt, {
              symbols: item.id, assetCalendar: group.calendar, expectedCompletedEnd: group.expected,
            });
            if (altCheck.errors.length) continue;
            const cell = altCheck.healthyCells.find(c => c.id === item.id && c.status === 'completed' && c.row);
            if (!cell) continue;
            // Le repli ne vaut que s'il est LUI-MÊME cohérent : une source alternative qui
            // se contredit aussi n'est pas une réparation, on passe à la suivante.
            try {
              bars = normalizeBars(cell.row, item.id, group.calendar).filter(bar => bar.date <= group.expected);
            } catch { continue; }
            altCell = cell; altSource = source; break;
          }
          if (!altCell) throw new Error(`${item.id}: série yahoo défectueuse et aucun repli cohérent (${ALT_BAR_SOURCES.join(', ')}) — ${error.message}`);
          console.log(`  [source] ${item.id}: série yahoo défectueuse → barres reprises sur ${altSource} (${error.message})`);
        }
        const last = bars[bars.length - 1];
        if (!last || last.date !== group.expected) {
          throw new Error(`${item.id}: bars do not end at certified close ${group.expected}`);
        }
        result.set(item.id, bars);
      }
    }
  }
  if (result.size !== requested.length) throw new Error('marketdata returned an incomplete symbol set');
  return result;
}

function barsToHistory(bars) {
  const history = {};
  for (const bar of bars || []) history[bar.date] = { open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume, ...(bar.open_unreliable ? { open_unreliable: true } : {}) };
  return history;
}

module.exports = { EQUITY_CALENDAR, CRYPTO_CALENDAR, runArgs, fetchCertifiedDailyBars, barsToHistory, isCryptoSymbol, normalizeBars };
