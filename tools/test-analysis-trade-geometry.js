'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'analysis-trade-geometry-'));
try {
  const check = changes => {
    const file = path.join(dir, 'TEST.json');
    fs.writeFileSync(file, JSON.stringify({ meta: {}, header: { ticker: 'TEST' },
      tradeIdea: { entry: 100, stop: 95, tp1: 110, rr: '1:2.00', stopPct: '-5%', tp1Pct: '10%', ...changes },
      technicals: { setupNote: 'Entry 100 and stop 95.' } }));
    const result = spawnSync(process.execPath, [path.join(__dirname, 'check-analysis-editorial-quality.js'), '--pre-review', file], { encoding: 'utf8' });
    assert(result.stdout.includes('Editorial quality:'), result.stderr);
    return result.stdout;
  };
  assert(!/geometry contains|directionally inconsistent|percentage does not match|published R\/R does not match/.test(check({})), 'one valid target is sufficient');
  assert(!/geometry contains|directionally inconsistent|percentage does not match/.test(check({ tp2: 120, tp2Pct: '20%' })));
  assert(check({ tp2: 105, tp2Pct: '5%' }).includes('directionally inconsistent'));
  assert(check({ tp1: null }).includes('directionally inconsistent'));
  assert(check({ rr: '1:3.00' }).includes('published R/R does not match'));
  console.log('trade geometry: PASS; optional TP2 retains TP1, direction and R/R checks');
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
