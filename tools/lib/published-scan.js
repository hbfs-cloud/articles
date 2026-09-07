'use strict';

// Only indexed edition routes are published scans. A newer staging directory or retrospective
// must not silently become the target of the release checks.
function latestPublishedScan(cards) {
  if (!Array.isArray(cards)) throw new Error('scanner index must be an array');
  const dates = cards.flatMap(card => [...String(card).matchAll(/href=["']\/scanner\/(\d{8})\/(?:index\.html)?["']/g)]
    .map(match => match[1]));
  if (!dates.length) throw new Error('aucune édition datée dans data/scanner.json');
  return dates.sort().at(-1);
}

module.exports = { latestPublishedScan };
