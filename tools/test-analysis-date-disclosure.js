'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const source = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/analyses-data/TSM.json'), 'utf8'));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'analysis-date-disclosure-'));
try {
  for (const [nextEarnings, note, expected] of [
    ['Date non confirmée — estimation fournisseur', 'La date officielle reste indisponible.', true],
    ['Non annoncée', 'Aucune date officielle confirmée.', true],
    ['Not confirmed', 'No confirmed issuer date.', true],
    ['À venir', 'Une publication prochaine est attendue.', false],
    ['Date non confirmée', 'Publication officielle prévue.', false],
  ]) {
    const data = JSON.parse(JSON.stringify(source));
    data.earnings.nextEarnings = nextEarnings;
    data.earnings.beatNote = note;
    const file = path.join(dir, 'TEST.json');
    fs.writeFileSync(file, JSON.stringify(data));
    const result = spawnSync(process.execPath, [path.join(__dirname, 'check-analysis-editorial-quality.js'), '--pre-review', file], { encoding: 'utf8' });
    assert(result.stdout.includes('Editorial quality:'), result.stderr);
    assert.equal(!result.stdout.includes('next earnings date is neither confirmed'), expected, nextEarnings + ' / ' + note);
  }
  console.log('analysis date disclosure: PASS; French and English uncertainty require an explicit supporting note');
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
