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
    as_of_timestamp: '2026-09-12T06:00:00Z', completion_policy: 'completed_only',
  });

  await assert.rejects(
    () => fetchCertifiedDailyBars({ symbols: ['AAA'], refdate: '2026-09-11', asOfTimestamp: '2026-09-12T06:00:00Z', client: {
      ...client,
      callToolWithRetry: async (_server, tool) => tool === 'GetStatus' ? status('2026-09-11') : response('AAA', '2026-09-11', 'us_equity_exchange_sessions', false),
    } }),
    /partial|complete=false/,
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
