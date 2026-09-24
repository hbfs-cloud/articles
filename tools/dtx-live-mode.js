#!/usr/bin/env node
'use strict';
// Mode DTX du scanner, piloté par le catalogue — décision du propriétaire du 2026-09-24, jusqu'à
// nouvel ordre : compare_only tant que la ligne n'est pas eligible_for_live, décision Contract V2
// dès qu'elle l'est. Écrit une seule ligne, `compare_only` ou `decide`, sur la sortie standard.
// Le plan relit le même catalogue dans sa vague `catalog` et refuse un mode incohérent : ce script
// choisit, le harnais prouve.
//
//   node tools/dtx-live-mode.js --portfolio etf_us
const { callTool, unwrap } = require('./lib/mcp-client');

function modeFor(entries, portfolio) {
  if (!Array.isArray(entries)) throw new Error('DtxCatalog: réponse non tabulaire');
  // Fail-closed : seul un `eligible_for_live === true` explicite ouvre le mode décision, donc la
  // voie vers des ordres réels. Champ absent, null, chaîne ou autre valeur = compare_only.
  const live = entries.some(e => e && (e.id === portfolio || e.portfolio === portfolio) && e.eligible_for_live === true);
  return live ? 'decide' : 'compare_only';
}

async function main() {
  const i = process.argv.indexOf('--portfolio');
  const portfolio = i >= 0 ? process.argv[i + 1] : null;
  if (!portfolio) throw new Error('--portfolio requis');
  const raw = await callTool('systematic', 'DtxCatalog', { eligible_for_live: true }, { timeoutMs: 60000 });
  const value = unwrap ? unwrap(raw) : raw;
  const entries = Array.isArray(value) ? value : (value && (value.entries || value.configs || value.data)) || null;
  process.stdout.write(`${modeFor(entries, portfolio)}\n`);
}

if (require.main === module) main().catch(e => { console.error(`[dtx-live-mode] ${e.message}`); process.exit(1); });
module.exports = { modeFor };
