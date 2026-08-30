#!/usr/bin/env node
'use strict';

/* Shared presentation gate for daily/weekly/analysis reports.
 * It checks that a reader gets a decision layer before the evidence layer and
 * that partial data is labelled with a reason rather than silently omitted.
 */
const fs = require('fs');
const file = process.argv[2];
if (!file) { console.error('Usage: validate-content-hierarchy.js <article.html>'); process.exit(2); }
const html = fs.readFileSync(file, 'utf8');
const errors = [];
const need = (pattern, message) => { if (!pattern.test(html)) errors.push(message); };
need(/<html[^>]+lang="fr"/i, 'web article must declare lang="fr"');
need(/id="(verdict|alerte|dashboard|executive-summary|summary)"/i, 'missing decision/summary anchor');
need(/(DÉCISION|DECISION|Verdict|Synthèse exécutive|Synthese executive|Alerte du jour)/i, 'missing visible decision heading');
need(/(Conséquence|Consequence|Action|À surveiller|A surveiller)/i, 'missing action/consequence language');
need(/(VALIDÉ|VALIDE|ATTENDRE|BLOQUÉ|BLOQUE|PARTIEL|INCONNU|INDISPONIBLE|no_setup)/i, 'missing explicit data/status vocabulary');
need(/(data-empty-state|data-status|quality|source|observed_at|as_of|refdate)/i, 'missing evidence quality/provenance marker');
need(/(interpretation|Lecture|À retenir|A retenir|scenario|scénario)/i, 'missing interpretation or scenario layer');
need(/echarts|echart-box|chart-host/i, 'missing chart container');
if (/<details[^>]+class="analysis-deep-dive"/i.test(html)) errors.push('primary dossier must not be hidden behind the analysis-deep-dive accordion');
if (errors.length) { console.error(`[hierarchy] FAIL ${file}`); errors.forEach(e => console.error(`  - ${e}`)); process.exit(1); }
console.log(`[hierarchy] PASS ${file}`);
