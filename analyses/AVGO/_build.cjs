#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'index.html');
let html = fs.readFileSync(file, 'utf8');

html = html
  .replace(/<body(?:\s+class="[^"]*")?>/, '<body class="analysis-avgo">')
  .replace(/\s*<style id="avgo-ux-refactor">[\s\S]*?<\/style>/, '')
  .replace('    <script src="/assets/echarts-responsive.js"></script>\n', '');

if (!html.includes('<!-- avgo-ux-refactor -->')) {
  html = html.replace('</head>', '    <!-- avgo-ux-refactor -->\n</head>');
}

if (!html.includes('/assets/sidebar.js')) {
  html = html.replace('</body>', '    <script src="/assets/sidebar.js"></script>\n</body>');
}

const requiredIds = [
  'verdict',
  'options',
  'optionMaturityChart',
  'coverage',
  'blast-radius',
  'blastChart',
  'riskGaugeChart',
];

for (const id of requiredIds) {
  if (!html.includes(`id="${id}"`)) {
    throw new Error(`AVGO build refused: missing required section or chart #${id}`);
  }
}

const forbiddenUnsupportedClaims = [
  'capitalFlowChart',
  '58.8,303.3',
  '163.8,444.9',
  '58,8 M$ d’entrées',
];

for (const claim of forbiddenUnsupportedClaims) {
  if (html.includes(claim)) {
    throw new Error(`AVGO build refused: unsupported capital-flow claim remains (${claim})`);
  }
}

fs.writeFileSync(file, html);
console.log('AVGO analysis normalized and evidence guardrails passed.');
