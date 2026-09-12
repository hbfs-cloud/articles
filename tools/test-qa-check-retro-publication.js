#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { classifyRetroPublication } = require('./lib/retro-publication');

const marker = '<html data-retro-publication="coverage_review">';
const validResults = {
  publication: { type: 'coverage_review', cohort_performance_certified: false },
};

assert.deepStrictEqual(classifyRetroPublication(marker, validResults), { kind: 'coverage_review' });
assert.deepStrictEqual(classifyRetroPublication('<html data-retro-publication="forensic_audit">', validResults), { kind: 'coverage_review' });
assert.strictEqual(classifyRetroPublication('', {}).kind, 'performance');

const markerOnly = classifyRetroPublication(marker, {});
assert.strictEqual(markerOnly.kind, 'invalid_coverage_review');
assert.match(markerOnly.reason, /publication\.type/);

const falseCertification = classifyRetroPublication(marker, {
  publication: { type: 'coverage_review', cohort_performance_certified: true },
});
assert.strictEqual(falseCertification.kind, 'invalid_coverage_review');
assert.match(falseCertification.reason, /cohort_performance_certified=false/);

const sidecarOnly = classifyRetroPublication('', validResults);
assert.strictEqual(sidecarOnly.kind, 'invalid_coverage_review');
assert.match(sidecarOnly.reason, /marqueur HTML documentaire/);

console.log('✅ test-qa-check-retro-publication: coverage review requires matching HTML marker and uncertified JSON sidecar.');
