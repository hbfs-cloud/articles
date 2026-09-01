#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { buildCardHtml, buildPositions } = require('./gen-mode-cards');

const simulated = {
  label: 'Balanced', color: '#2563eb', performanceScope: 'simulated_backtest',
  portfolioSize: 3, filterName: 'internal_filter', riskProfile: 'Modéré',
};
assert.deepStrictEqual(buildPositions(simulated, 'balanced'), [],
  'retired simulated history must never recreate public open positions');
const retired = buildCardHtml('balanced', simulated, null, []);
assert(retired.includes('Historique retiré · ledger forward actif'));
assert(retired.includes('Aucune position certifiée'));
assert(!/>\+?0\.0+%?</.test(retired) && !/>0\.00x</.test(retired),
  'missing metrics must render as unavailable, never numeric zero');
assert(!retired.includes('internal_filter'), 'internal strategy id must not leak into the card');

const dtx = {
  label: 'DTX Max', color: '#7c3aed', assetClass: 'dtx',
  performanceScope: 'forward_execution', portfolioSize: 15,
  forwardTracking: { status: 'not_started', executedTrades: 0 },
};
assert.deepStrictEqual(buildPositions(dtx, 'best'), [],
  'DTX must have no card position before a certified fill');
const pending = buildCardHtml('best', dtx, null, []);
assert(pending.includes('Suivi réel non démarré'));
assert(!pending.includes('15 slots'), 'versioned capacity must not be presented as a timeless slot count');

console.log('mode card fail-closed tests: PASS');
