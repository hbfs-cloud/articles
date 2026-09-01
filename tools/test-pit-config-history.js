#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const { buildHistoryResolverFromData } = require('./pit-engine');

const currentModes = {
  legacy: { portfolioSize: 99, futureGate: true },
  introducedLater: { portfolioSize: 7 },
};
const history = { versions: [
  {
    id: 'v1', timestamp: '2026-06-01T22:00:00Z',
    hash: 'h1', config: { legacy: { portfolioSize: 1 } },
  },
  {
    id: 'v2', timestamp: null, effectiveFrom: '2026-06-03',
    hash: 'h2', config: { legacy: { portfolioSize: 3 } },
  },
  {
    id: 'v3-early', timestamp: '2026-06-04T20:00:00Z', effectiveFrom: '2026-06-05',
    hash: 'h3a', config: { legacy: { portfolioSize: 4 } },
  },
  {
    id: 'v3-late', timestamp: '2026-06-04T21:00:00Z', effectiveFrom: '2026-06-05',
    hash: 'h3b', config: {
      legacy: { portfolioSize: 5 },
      introducedLater: { portfolioSize: 2 },
    },
  },
] };
const configHash = config => `sha256:${crypto.createHash('sha256')
  .update(JSON.stringify(config)).digest('hex')}`;
for (const version of history.versions) version.config_sha256 = configHash(version.config);

const resolve = buildHistoryResolverFromData(history, currentModes);
assert.throws(() => resolve('2026-05-31'), /No PIT config snapshot/);

const v1 = resolve('2026-06-02');
assert.strictEqual(v1.legacy.portfolioSize, 1);
assert.strictEqual(v1.legacy.futureGate, undefined, 'current fields must not leak into old snapshots');
assert.strictEqual(v1.legacy.__configVersion, 'v1');
assert.strictEqual(v1.legacy.__configEffectiveFrom, '2026-06-01');
assert.strictEqual(v1.introducedLater, undefined, 'future modes must remain absent');

const v2 = resolve('2026-06-03');
assert.strictEqual(v2.legacy.portfolioSize, 3, 'effectiveFrom works without timestamp');
assert.strictEqual(v2.legacy.__configVersion, 'v2');
assert.strictEqual(v2.legacy.__configHash, history.versions[1].config_sha256,
  'canonical config hash takes precedence');

const v3 = resolve('2026-06-05');
assert.strictEqual(v3.legacy.portfolioSize, 5, 'same-day snapshots resolve by archived timestamp');
assert.strictEqual(v3.introducedLater.portfolioSize, 2);

assert.throws(
  () => buildHistoryResolverFromData({ versions: [] }, currentModes),
  /no valid effective snapshot/,
);
assert.throws(
  () => buildHistoryResolverFromData({ versions: [{
    id: 'tampered', effectiveFrom: '2026-06-01', config_sha256: history.versions[0].config_sha256,
    config: { legacy: { portfolioSize: 999 } },
  }] }, currentModes),
  /snapshot hash mismatch/,
);

console.log('PIT config-history contract: PASS');
