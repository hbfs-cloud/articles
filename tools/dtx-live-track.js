#!/usr/bin/env node
'use strict';
/**
 * dtx-live-track.js — CLI du tracker live des modes scriptés (lib: tools/lib/dtx-live-track.js).
 *
 * Usage :
 *   node tools/dtx-live-track.js --backfill
 *       Reconstruit la série live depuis les snapshots RÉELS scanner/status/history/*.json
 *       (>= go-live de chaque mode). Idempotent : les (mode,date) déjà présents sont ignorés.
 *       Aucun point inventé — un snapshot manquant reste un trou.
 *
 *   node tools/dtx-live-track.js --drift [--replay-dir /tmp]
 *       Calcule le drift backtest↔live par mode depuis les fichiers <dir>/<id>.replay-live.json
 *       (produits par l'AGENT : DtxReplay(portfolio=<id>, from=<go-live>, to=<aujourd'hui>) —
 *       un subprocess node NE PEUT PAS appeler le MCP). Fichier absent → drift inchangé (null),
 *       jamais estimé.
 *
 *   node tools/dtx-live-track.js --report
 *       Affiche l'état de la série + drift par mode (utilisé par la QA).
 *
 * Le point QUOTIDIEN est appendu par gen-status-page.js (même source que les hero stats de la
 * page — un seul écrivain le soir), pas par ce CLI.
 */

const fs = require('fs');
const path = require('path');
const T = require('./lib/dtx-live-track');

const ROOT = path.join(__dirname, '..');
const HISTORY_DIR = path.join(ROOT, 'scanner', 'status', 'history');
const DTX_MODES = ['best'];

function goLiveOf(modeId) {
  try {
    const mc = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'modes-config.json'), 'utf8')).modes;
    const ss = mc[modeId] && mc[modeId].statusSince;
    return ss ? String(ss).slice(0, 10) : null;
  } catch { return null; }
}

function backfill() {
  const track = T.loadTrack();
  const files = fs.readdirSync(HISTORY_DIR).filter(f => /^\d{8}\.json$/.test(f)).sort();
  let added = 0, skipped = 0;
  for (const f of files) {
    const dateISO = `${f.slice(0, 4)}-${f.slice(4, 6)}-${f.slice(6, 8)}`;
    let snap;
    try { snap = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, f), 'utf8')); } catch { continue; }
    for (const id of DTX_MODES) {
      const gl = goLiveOf(id);
      if (!gl || dateISO < gl) continue;
      const mode = (snap.modes || {})[id];
      if (!mode || !mode.stats || typeof mode.stats.ret !== 'number') continue;
      const ok = T.appendPoint(track, id, {
        date: dateISO,
        goLive: gl,
        ret: mode.stats.ret,
        unrealized: mode.stats.unrealized,
        trades: mode.stats.trades,
        ordersPublished: null, // inconnu rétroactivement — jamais inventé
      });
      ok ? added++ : skipped++;
    }
  }
  T.saveTrack(track);
  console.log(`[dtx-live-track] backfill : ${added} points ajoutés, ${skipped} déjà présents (${files.length} snapshots parcourus)`);
}

function drift(replayDir) {
  const track = T.loadTrack();
  const asof = new Date().toISOString().slice(0, 10);
  let done = 0, missing = [];
  for (const id of DTX_MODES) {
    const p = path.join(replayDir, `${id}.replay-live.json`);
    if (!fs.existsSync(p)) { missing.push(id); continue; }
    let raw;
    try { raw = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { missing.push(id + ' (illisible)'); continue; }
    const d = T.computeDrift(track, id, raw, asof);
    if (d) { done++; console.log(`  ${id}: live ${d.live_ret_pct}% vs replay ${d.replay_ret_pct}% → drift ${d.drift_pp > 0 ? '+' : ''}${d.drift_pp} pp [${d.status}]`); }
    else missing.push(id + ' (fenêtre replay non couvrante ou série vide)');
  }
  T.saveTrack(track);
  console.log(`[dtx-live-track] drift : ${done}/${DTX_MODES.length} modes calculés${missing.length ? ' — sans drift : ' + missing.join(', ') : ''}`);
  // Non bloquant : l'absence de replay-live est un état dégradé documenté, pas une erreur.
}

function report() {
  const track = T.loadTrack();
  for (const id of DTX_MODES) {
    const m = track.modes[id];
    if (!m) { console.log(`${id}: AUCUN point live`); continue; }
    const last = m.points[m.points.length - 1];
    const d = m.drift;
    console.log(`${id}: ${m.points.length} pts depuis ${m.goLive} | dernier ${last.date} ret ${last.ret}%` +
      (d ? ` | drift ${d.drift_pp > 0 ? '+' : ''}${d.drift_pp} pp [${d.status}] (replay ${d.replay_ret_pct}% au ${d.asof})` : ' | drift: non calculé'));
  }
}

const args = process.argv.slice(2);
if (args.includes('--backfill')) backfill();
else if (args.includes('--drift')) {
  const i = args.indexOf('--replay-dir');
  drift(i >= 0 && args[i + 1] ? args[i + 1] : '/tmp');
} else if (args.includes('--report')) report();
else { console.log('Usage: dtx-live-track.js --backfill | --drift [--replay-dir DIR] | --report'); process.exit(2); }
