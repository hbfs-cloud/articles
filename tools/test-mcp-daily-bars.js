#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { fetchCertifiedDailyBars, runArgs, normalizeBars, EQUITY_CALENDAR, CRYPTO_CALENDAR } = require('./lib/mcp-daily-bars');

function status(ref, cryptoRef = null) {
  const readiness = {
    bars_daily_us_equity: {
      status: 'ready', asset_calendar: 'us_equity_exchange_sessions',
      expected_completed_end: ref, served_completed_end: ref,
    },
  };
  if (cryptoRef) readiness.bars_daily_crypto_utc = {
    status: 'ready', asset_calendar: 'crypto_24_7_utc',
    expected_completed_end: cryptoRef, served_completed_end: cryptoRef,
  };
  return { server_version: '0424cf4b', operation_readiness: readiness };
}

function response(symbol, ref, calendar = 'us_equity_exchange_sessions', complete = true) {
  return { results: [{
    cells: [{ status: 'completed', symbol, asset_calendar: calendar,
      expected_completed_end: ref, served_completed_end: ref, last_bar_complete: complete }],
    data: [{ symbol, asset_calendar: calendar, expected_completed_end: ref,
      served_completed_end: ref, bars: [['2026-09-10', 10, 12, 9, 11, 100], [ref, 11, 13, 10, 12, 120]] }],
  }] };
}

async function main() {
  const calls = [];
  const client = {
    canCallDirectly: server => server === 'marketdata',
    callToolWithRetry: async (_server, tool, args) => {
      calls.push({ tool, args });
      if (tool === 'GetStatus') return status('2026-09-11');
      return response('AAA', '2026-09-11');
    },
    awaitJob: async () => { throw new Error('unexpected async job'); },
  };
  const bars = await fetchCertifiedDailyBars({
    symbols: ['AAA'], refdate: '2026-09-11', asOfTimestamp: '2026-09-12T06:00:00Z', client,
  });
  assert.equal(bars.get('AAA').at(-1).date, '2026-09-11');
  assert.deepEqual(calls[1].args, {
    types: 'bars_daily', symbols: 'AAA', limit: 160,
    source: 'webull',
    as_of_timestamp: '2026-09-12T06:00:00Z', completion_policy: 'completed_only',
  });

  const fallbackCalls = [];
  const fallbackClient = {
    canCallDirectly: () => true,
    callToolWithRetry: async (_server, tool, args) => {
      fallbackCalls.push({ tool, args });
      if (tool === 'GetStatus') return status('2026-09-11');
      if (args.source === 'yahoo') return response('AAA', '2026-09-11');
      const invalid = response('AAA', '2026-09-11');
      invalid.results[0].data[0].bars[1][1] = 14;
      return invalid;
    },
    awaitJob: async () => { throw new Error('unexpected async job'); },
  };
  const repaired = await fetchCertifiedDailyBars({
    symbols: ['AAA'], refdate: '2026-09-11', asOfTimestamp: '2026-09-12T06:00:00Z',
    client: fallbackClient, receiptDir: null,
  });
  assert.equal(repaired.get('AAA').at(-1).date, '2026-09-11');
  assert.deepEqual(fallbackCalls.filter(call => call.tool === 'QueryData').map(call => call.args.source),
    ['webull', 'tiingo', 'yahoo']);

  await assert.rejects(
    () => fetchCertifiedDailyBars({ symbols: ['AAA'], refdate: '2026-09-11', asOfTimestamp: '2026-09-12T06:00:00Z', client: {
      ...client,
      callToolWithRetry: async (_server, tool) => tool === 'GetStatus' ? status('2026-09-11') : response('AAA', '2026-09-11', 'us_equity_exchange_sessions', false),
    } }),
    /partial|complete=false/,
  );

  // Séance US manquante côté source primaire : rejeu du seul symbole sur les sources MCP de repli.
  const missingSession = () => {
    const stale = response('AAA', '2026-09-11');
    Object.assign(stale.results[0].cells[0], { status: 'partial', rejection_reason: 'us_session_coverage_incomplete', served_completed_end: '2026-09-10' });
    return stale;
  };
  const partialCalls = [];
  const partialClient = servedBy => ({
    canCallDirectly: () => true,
    callToolWithRetry: async (_server, tool, args) => {
      partialCalls.push({ tool, args });
      if (tool === 'GetStatus') return status('2026-09-11');
      if (args.source === servedBy) return response('AAA', '2026-09-11');
      return missingSession();
    },
    awaitJob: async () => { throw new Error('unexpected async job'); },
  });
  const viaTiingo = await fetchCertifiedDailyBars({
    symbols: ['AAA'], refdate: '2026-09-11', asOfTimestamp: '2026-09-12T06:00:00Z',
    client: partialClient('tiingo'), receiptDir: null,
  });
  assert.equal(viaTiingo.get('AAA').at(-1).date, '2026-09-11');
  assert.deepEqual(partialCalls.filter(call => call.tool === 'QueryData').map(call => call.args.source), ['webull', 'tiingo']);
  // Cooldown transitoire d'un fournisseur de repli : on réessaie la même source après une pause, puis on réussit.
  const cooldown = () => ({ results: [{ cells: [{ symbol: 'AAA', status: 'failed', rejection_reason: 'upstream_or_calculation_failed',
    error: 'bars_daily source=tiingo: datasource: all sources failed: tiingo: in cooldown' }], data: [] }] });
  let tiingoCalls = 0;
  const coolingClient = {
    canCallDirectly: () => true,
    callToolWithRetry: async (_server, tool, args) => {
      if (tool === 'GetStatus') return status('2026-09-11');
      if (args.source === 'tiingo') { tiingoCalls += 1; return tiingoCalls <= 2 ? cooldown() : response('AAA', '2026-09-11'); }
      return missingSession();
    },
    awaitJob: async () => { throw new Error('unexpected async job'); },
  };
  const afterCooldown = await fetchCertifiedDailyBars({
    symbols: ['AAA'], refdate: '2026-09-11', asOfTimestamp: '2026-09-12T06:00:00Z',
    client: coolingClient, receiptDir: null, fallbackCooldownWaitMs: 1,
  });
  assert.equal(afterCooldown.get('AAA').at(-1).date, '2026-09-11');
  assert.equal(tiingoCalls, 3, 'tiingo est réessayé après cooldown avant de passer à yahoo');
  // Cooldown persistant : les essais sont bornés, puis échec franc.
  let stuckCalls = 0;
  await assert.rejects(
    () => fetchCertifiedDailyBars({
      symbols: ['AAA'], refdate: '2026-09-11', asOfTimestamp: '2026-09-12T06:00:00Z', receiptDir: null, fallbackCooldownWaitMs: 1,
      client: { ...coolingClient, callToolWithRetry: async (_s, tool, args) => {
        if (tool === 'GetStatus') return status('2026-09-11');
        if (args.source === 'tiingo') { stuckCalls += 1; return cooldown(); }
        return missingSession();
      } },
    }),
    /aucun repli cohérent \(tiingo, yahoo\)/,
  );
  assert.equal(stuckCalls, 4, 'quatre essais au plus sur la source en cooldown');
  // Aucune source de repli cohérente : échec franc, jamais de barre synthétique ni de série qui n'atteint pas la clôture.
  await assert.rejects(
    () => fetchCertifiedDailyBars({
      symbols: ['AAA'], refdate: '2026-09-11', asOfTimestamp: '2026-09-12T06:00:00Z',
      client: partialClient('none'), receiptDir: null,
    }),
    /aucun repli cohérent \(tiingo, yahoo\)/,
  );
  // Une venue étrangère incomplète n'est pas réparable par ce chemin.
  await assert.rejects(
    () => fetchCertifiedDailyBars({
      symbols: ['AAA'], refdate: '2026-09-11', asOfTimestamp: '2026-09-12T06:00:00Z', receiptDir: null,
      client: { ...partialClient('tiingo'), callToolWithRetry: async (_s, tool, args) => {
        if (tool === 'GetStatus') return status('2026-09-11');
        const venue = missingSession();
        venue.results[0].cells[0].rejection_reason = 'venue_session_coverage_incomplete';
        return venue;
      } },
    }),
    /venue_session_coverage_incomplete/,
  );
  await assert.rejects(
    () => fetchCertifiedDailyBars({ symbols: ['BTC-USD'], refdate: '2026-09-11', asOfTimestamp: '2026-09-12T06:00:00Z', client }),
    /crypto-refdate/,
  );
  const cryptoCalls = [];
  const cryptoClient = {
    canCallDirectly: server => server === 'marketdata',
    callToolWithRetry: async (_server, tool, args) => {
      cryptoCalls.push({ tool, args });
      if (tool === 'GetStatus') return status('2026-09-11', '2026-09-11');
      return response('BTC-USD', '2026-09-11', 'crypto_24_7_utc');
    },
    awaitJob: async () => { throw new Error('unexpected async job'); },
  };
  const cryptoBars = await fetchCertifiedDailyBars({
    symbols: ['BTC-USD'], refdate: '2026-09-11', cryptoRefdate: '2026-09-11',
    asOfTimestamp: '2026-09-12T06:00:00Z', client: cryptoClient,
  });
  assert.equal(cryptoBars.get('BTC-USD').at(-1).date, '2026-09-11');
  assert.equal(cryptoCalls[1].args.types, 'bars_daily');
  await assert.rejects(
    () => fetchCertifiedDailyBars({ symbols: ['AAA'], refdate: '2026-09-11', asOfTimestamp: '2026-09-12T06:00:00Z', client: {
      ...client,
      callToolWithRetry: async (_server, tool) => tool === 'GetStatus' ? status('2026-09-10') : response('AAA', '2026-09-11'),
    } }),
    /readiness rejected/,
  );
  await assert.rejects(
    () => fetchCertifiedDailyBars({ symbols: ['AAA', 'BBB'], refdate: '2026-09-11', asOfTimestamp: '2026-09-12T06:00:00Z', client }),
    /incomplete symbol set|missing data row|missing completed cell|terminal cell/,
  );
  assert.throws(() => runArgs(['node', 'tool', '--refdate', '2026-09-11']), /--asof/);
  assert.doesNotThrow(() => normalizeBars({ bars: [
    ['2026-09-10', 10, 12, 9, 11, 100], ['2026-09-11', 11, 13, 10, 12, 120],
  ] }, 'AAA', EQUITY_CALENDAR));
  assert.throws(() => normalizeBars({ bars: [
    ['2026-09-10', 10, 12, 9, 11, 100], ['2026-09-11', 11, 10, 9, 12, 120],
  ] }, 'AAA', EQUITY_CALENDAR), /OHLCV bounds/);
  assert.throws(() => normalizeBars({ bars: [
    ['2026-09-10', 10, 12, 9, 11], ['2026-09-11', 11, 13, 10, 12, 120],
  ] }, 'AAA', EQUITY_CALENDAR), /malformed/);
  for (const volume of [null, '']) {
    assert.throws(() => normalizeBars({ bars: [
      ['2026-09-10', 10, 12, 9, 11, volume], ['2026-09-11', 11, 13, 10, 12, 120],
    ] }, 'AAA', EQUITY_CALENDAR), /malformed/);
  }
  assert.throws(() => normalizeBars({ bars: [
    ['2026-09-10', 10, 12, 9, 11, 100], ['2026-09-10', 11, 13, 10, 12, 120],
  ] }, 'AAA', EQUITY_CALENDAR), /duplicate or non-monotonic/);
  assert.throws(() => normalizeBars({ bars: [
    ['2026-09-10', 10, 12, 9, 11, 100], ['2026-09-14', 11, 13, 10, 12, 120],
  ] }, 'AAA', EQUITY_CALENDAR), /incomplete/);
  assert.doesNotThrow(() => normalizeBars({ bars: [
    ['2026-09-10', 10, 12, 9, 11, 100], ['2026-09-11', 11, 13, 10, 12, 120],
  ] }, 'BTC-USD', CRYPTO_CALENDAR));
  assert.throws(() => normalizeBars({ bars: [
    ['2026-09-10', 10, 12, 9, 11, 100], ['2026-09-12', 11, 13, 10, 12, 120],
  ] }, 'BTC-USD', CRYPTO_CALENDAR), /incomplete/);
  console.log('mcp daily bars tests: PASS');
}

main().catch(error => { console.error(error); process.exit(1); });
