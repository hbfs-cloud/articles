#!/usr/bin/env node
// tools/gen-tickers-index.js
// Scans analyses/ directory and outputs data/tickers-index.json
// (array of uppercase ticker symbols that have an index.html)

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ANALYSES_DIR = path.join(ROOT, 'analyses');
const OUTPUT = path.join(ROOT, 'data', 'tickers-index.json');

const tickers = fs.readdirSync(ANALYSES_DIR)
    .filter(function(name) {
        const indexPath = path.join(ANALYSES_DIR, name, 'index.html');
        return fs.existsSync(indexPath);
    })
    .map(function(name) { return name.toUpperCase(); })
    .sort();

fs.writeFileSync(OUTPUT, JSON.stringify(tickers, null, 2));
console.log('tickers-index.json written: ' + tickers.length + ' tickers');
console.log(tickers.join(', '));
