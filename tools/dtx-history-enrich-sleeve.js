#!/usr/bin/env node
'use strict';
/**
 * dtx-history-enrich-sleeve.js — ajoute le tag de POCHE aux entrées déjà enregistrées du registre
 * `data/dtx-engine-history.json`, sans toucher à la décision.
 *
 * POURQUOI. Le tag de poche (uhv_tp999 / ep / etf_us / mx) est lu dans `DtxDecide.state` depuis le
 * 2026-08-12. Les séances enregistrées AVANT cette lecture portent des ordres sans `sleeve` : le
 * registre est le point-in-time qui dit sous quelle règle un ordre devait sortir, et sans la poche
 * il ne le dit plus (take-profit et horizon diffèrent d'une poche à l'autre).
 *
 * POURQUOI PAS `--force`. Le registre est immuable par (mode, date), et c'est ce qui lui donne sa
 * valeur : une décision enregistrée ne se réécrit pas. `--force` réécrit l'entrée ENTIÈRE, y compris
 * `recordedAt`, les prix et les quantités — on perdrait l'invariant pour compléter un champ. Cet
 * outil fait l'inverse :
 *
 *   1. il ne lit QUE le payload MCP archivé de la même (mode, date) — `scanner/<YYYYMMDD>/_dtx/
 *      decide_<mode>.json` — c'est-à-dire la source dont l'entrée est elle-même issue ;
 *   2. il n'écrit QUE `sleeve`, et seulement là où il est absent ou nul ;
 *   3. il REFUSE d'écrire si un autre champ de l'ordre diverge du payload (symbol, qty, entry,
 *      stopLoss) : une divergence signifierait que l'entrée et le payload ne décrivent pas la même
 *      séance, et alors il n'y a rien à enrichir — il y a un incident à comprendre ;
 *   4. il horodate l'enrichissement dans l'entrée (`_sleeveEnrichedAt` + source), pour qu'une
 *      relecture voie que ce champ est arrivé APRÈS coup et d'où il vient.
 *
 * La décision (quoi acheter, combien, à quel prix, avec quel stop) reste bit pour bit celle qui a
 * été enregistrée. Seule sa provenance est complétée, de façon traçable.
 *
 * Usage :
 *   node tools/dtx-history-enrich-sleeve.js [--mode best] [--date 2026-08-12] [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const { sleeveIndex } = require('./dtx-scan.js');

const ROOT = path.resolve(__dirname, '..');
const HIST = path.join(ROOT, 'data', 'dtx-engine-history.json');

const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : null; };
const ONLY_MODE = flag('mode');
const ONLY_DATE = flag('date');
const DRY = argv.includes('--dry-run');

/** Payload DtxDecide archivé pour (mode, date), ou null. */
function archivedDecide(mode, date) {
  const folder = date.replace(/-/g, '');
  for (const sub of ['_dtx', '_dtx11', '_dtx2']) {
    const p = path.join(ROOT, 'scanner', folder, sub, `decide_${mode}.json`);
    if (!fs.existsSync(p)) continue;
    try {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      return { decision: j.result || j, path: path.relative(ROOT, p) };
    } catch (_) { /* illisible → on continue de chercher */ }
  }
  return null;
}

const NUM_FIELDS = ['qty', 'entry', 'stopLoss'];
const near = (a, b) => {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(Number(a) - Number(b)) <= Math.max(1e-6, Math.abs(Number(a)) * 1e-9);
};

function main() {
  const store = JSON.parse(fs.readFileSync(HIST, 'utf8'));
  const report = { enriched: [], skipped: [], refused: [] };

  for (const [mode, sessions] of Object.entries(store.modes || {})) {
    if (ONLY_MODE && mode !== ONLY_MODE) continue;
    for (const [date, entry] of Object.entries(sessions)) {
      if (ONLY_DATE && date !== ONLY_DATE) continue;
      const orders = Array.isArray(entry.orders) ? entry.orders : [];
      const missing = orders.filter((o) => !o.sleeve);
      if (!orders.length || !missing.length) { report.skipped.push(`${mode} ${date} — déjà complet (${orders.length} ordres)`); continue; }

      const arch = archivedDecide(mode, date);
      if (!arch) { report.skipped.push(`${mode} ${date} — aucun payload MCP archivé (rien à lire, rien d'inventé)`); continue; }

      const { map, conflicts } = sleeveIndex(arch.decision);
      if (!Object.keys(map).length) { report.skipped.push(`${mode} ${date} — le payload ne porte pas d'état par poche`); continue; }

      // Garde d'identité : l'entrée et le payload doivent décrire la MÊME décision.
      const create = (arch.decision.actions && arch.decision.actions.CREATE) || [];
      const byMissing = [];
      let refused = null;
      for (const o of orders) {
        const src = create.find((c) => c.symbol === o.symbol);
        if (!src) { refused = `ordre ${o.symbol} absent du payload archivé`; break; }
        const srcEntry = src.limit_price != null ? src.limit_price : src.entry;
        if (!near(o.qty, src.qty) || !near(o.entry, srcEntry) || !near(o.stopLoss, src.stop_loss)) {
          refused = `ordre ${o.symbol} : l'entrée enregistrée et le payload divergent (qty/entry/stopLoss) — ce n'est pas la même séance`;
          break;
        }
        if (!o.sleeve && map[o.symbol]) byMissing.push([o, map[o.symbol]]);
      }
      if (refused) { report.refused.push(`${mode} ${date} — ${refused}`); continue; }
      if (create.length !== orders.length) {
        report.refused.push(`${mode} ${date} — ${create.length} ordres au payload vs ${orders.length} au registre`);
        continue;
      }
      if (!byMissing.length) { report.skipped.push(`${mode} ${date} — aucune poche à rattacher (état sans recouvrement d'ordres)`); continue; }

      for (const [o, sleeve] of byMissing) o.sleeve = sleeve;
      entry._sleeveEnrichedAt = new Date().toISOString();
      entry._sleeveSource = `${arch.path} → state[<poche>].pm_state.position_open_dates`;
      const by = {};
      for (const o of orders) by[o.sleeve || '—'] = (by[o.sleeve || '—'] || 0) + 1;
      report.enriched.push(`${mode} ${date} — ${byMissing.length}/${orders.length} ordres tagués ${JSON.stringify(by)}${conflicts.length ? ` (ambigus laissés null : ${conflicts.join(', ')})` : ''}`);
    }
  }

  console.log('Enrichissement du registre (champ `sleeve` uniquement) :');
  for (const l of report.enriched) console.log(`  ✅ ${l}`);
  for (const l of report.skipped) console.log(`  ·  ${l}`);
  for (const l of report.refused) console.log(`  ⛔ ${l}`);
  if (!report.enriched.length) { console.log('Rien à enrichir.'); return; }
  if (DRY) { console.log('[DRY-RUN] rien écrit.'); return; }
  fs.writeFileSync(HIST, JSON.stringify(store, null, 2) + '\n', 'utf8');
  console.log(`→ ${path.relative(ROOT, HIST)} mis à jour.`);
  if (report.refused.length) process.exit(1);
}

main();
