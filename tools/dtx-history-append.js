#!/usr/bin/env node
'use strict';
/**
 * dtx-history-append.js — historise la décision du jour du moteur systematic.
 *
 * Lit les stagings `data/dtx/<mode>.json` (produits par l'agent via MCP puis dtx-mcp-ingest)
 * et append chaque décision dans `data/dtx-engine-history.json`, immuable par (mode, date).
 *
 * À lancer APRÈS dtx-mcp-ingest et AVANT gen-status-page, pour que la page dispose de
 * l'historique du jour.
 *
 * Usage :
 *   node tools/dtx-history-append.js               # tous les stagings présents
 *   node tools/dtx-history-append.js --mode hvep   # un seul
 *   node tools/dtx-history-append.js --dry         # montre sans écrire
 *   node tools/dtx-history-append.js --force       # réécrit un couple (mode,date) existant
 *   node tools/dtx-history-append.js --backfill    # reconstruit l'historique passé depuis les scans
 *
 * BACKFILL — le staging n'existe que pour la séance courante ; les séances passées ne sont
 * connues que par le `dtx_pool` publié dans scanner/<date>/signals.json, c'est-à-dire la forme
 * PONTÉE de l'ordre (après dtx-pool-bridge), pas la décision brute du moteur. Ces entrées sont
 * donc marquées `provenance: 'dtx_pool'` et ne portent ni metrics ni updates/cancels — on ne
 * reconstitue pas ce qu'on n'a pas. Une entrée backfillée ne remplace JAMAIS une entrée issue
 * du staging (`provenance: 'staging'`), qui fait foi.
 *
 * Sortie non nulle si un staging est illisible. Un doublon n'est PAS une erreur (le pipeline
 * peut rejouer) : il est signalé et ignoré.
 */

const fs = require('fs');
const path = require('path');
const hist = require('./lib/dtx-engine-history');

const ROOT = path.join(__dirname, '..');
const DTX_DIR = path.join(ROOT, 'data', 'dtx');

const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const val = f => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const DRY = has('--dry');
const FORCE = has('--force');
const ONLY = val('--mode');
const BACKFILL = has('--backfill');

function backfill(store) {
  const SC = path.join(ROOT, 'scanner');
  const res = { appended: [], duplicate: [] };
  const dirs = fs.existsSync(SC) ? fs.readdirSync(SC).filter(d => /^\d{8}$/.test(d)).sort() : [];
  for (const dir of dirs) {
    const fp = path.join(SC, dir, 'signals.json');
    if (!fs.existsSync(fp)) continue;
    let sig; try { sig = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { continue; }
    const pool = (sig && sig.dtx_pool) || [];
    if (!pool.length) continue;
    const date = sig.scanDate || `${dir.slice(0,4)}-${dir.slice(4,6)}-${dir.slice(6,8)}`;
    const byMode = {};
    for (const o of pool) { const u = o.universe; if (u) (byMode[u] = byMode[u] || []).push(o); }
    for (const [mode, list] of Object.entries(byMode)) {
      if (ONLY && mode !== ONLY) continue;
      const cur = hist.at(mode, date, store);
      // Une entrée issue du staging fait foi : on ne la remplace jamais par du backfill.
      if (cur) { res.duplicate.push(`${mode.padEnd(14)} ${date}  (déjà présent, provenance=${cur.provenance || 'staging'})`); continue; }
      store.modes[mode] = store.modes[mode] || {};
      store.modes[mode][date] = {
        asof: date, generatedAt: null, engineMode: null, engine: null, currency: null,
        provenance: 'dtx_pool',
        orders: list.map(o => ({
          symbol: o.ticker || null, side: 'BUY', orderType: 'LIMIT',
          qty: null, entry: o.entry != null ? Number(o.entry) : null,
          limitPrice: o.entry != null ? Number(o.entry) : null,
          stopLoss: o.stop != null ? Number(o.stop) : null,
          takeProfit: o.tp1 != null ? Number(o.tp1) : null,
          reason: o.pattern || o.strategy || null, orderId: null,
        })),
        updates: [], cancels: [], metrics: null,
        recordedAt: new Date().toISOString(),
      };
      res.appended.push(`${mode.padEnd(14)} ${date}  ordres=${list.length}  (backfill dtx_pool)`);
    }
  }
  return res;
}

function main() {
  if (!fs.existsSync(DTX_DIR)) {
    console.error(`data/dtx/ absent — rien à historiser.`);
    process.exit(0);
  }
  const files = fs.readdirSync(DTX_DIR).filter(f => f.endsWith('.json') && !f.startsWith('.'));
  if (!files.length) { console.log('Aucun staging dtx.'); return; }

  const store = hist.load();
  const res = { appended: [], duplicate: [], forced: [], skipped: [], unreadable: [] };

  if (BACKFILL) {
    const b = backfill(store);
    res.appended.push(...b.appended); res.duplicate.push(...b.duplicate);
  }

  for (const f of files) {
    const mode = f.replace(/\.json$/, '');
    if (ONLY && mode !== ONLY) continue;
    let staging;
    try {
      staging = JSON.parse(fs.readFileSync(path.join(DTX_DIR, f), 'utf8'));
    } catch (e) {
      // Un staging illisible est une VRAIE erreur : on ne l'avale pas.
      res.unreadable.push(`${mode}: ${e.message}`);
      continue;
    }
    staging._provenance = 'staging';
    const r = hist.append(staging, { store, force: FORCE });
    const line = `${(r.mode || mode).padEnd(14)} ${r.date || '—'}  ordres=${r.counts ? r.counts.orders : 0} maj=${r.counts ? r.counts.updates : 0} annul=${r.counts ? r.counts.cancels : 0}`;
    if (r.status === 'appended') res.appended.push(line);
    else if (r.status === 'duplicate') res.duplicate.push(`${line}   (déjà enregistré : ${r.existingCounts.orders} ordres — non réécrit)`);
    else if (r.status === 'forced') res.forced.push(line + '   (RÉÉCRIT via --force)');
    else res.skipped.push(`${mode}: ${r.reason}`);
  }

  console.log(`Registre : ${hist.STORE_PATH}`);
  const show = (t, arr) => { if (arr.length) { console.log(`\n${t}`); arr.forEach(l => console.log('  ' + l)); } };
  show('AJOUTÉS', res.appended);
  show('FORCÉS', res.forced);
  show('DÉJÀ PRÉSENTS (immuables, non réécrits)', res.duplicate);
  show('IGNORÉS', res.skipped);
  show('ILLISIBLES', res.unreadable);

  if (DRY) { console.log('\n[DRY] rien écrit.'); return; }
  if (res.appended.length || res.forced.length) {
    hist.save(store);
    console.log(`\n${res.appended.length + res.forced.length} décision(s) historisée(s).`);
  } else {
    console.log('\nRien de nouveau à historiser.');
  }
  if (res.unreadable.length) process.exit(1);
}

main();
