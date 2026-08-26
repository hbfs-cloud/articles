#!/usr/bin/env node
/**
 * analyses-lifecycle.js — statut mécanique des dossiers d'analyse, sur CLÔTURES uniquement.
 *
 * Chaque soir (chaîne C de scan-parallel / publish-daily-card) :
 *   1. charge les dossiers OUVERTS (active/pending/watch/tp1-hit) de data/analyses-data/,
 *   2. récupère les clôtures quotidiennes depuis la publication (Yahoo v8, proxy en repli),
 *   3. applique les transitions déterministes du plan publié (tradeIdea) :
 *        - déclenchement : première clôture qui atteint la zone d'entrée,
 *        - invalidation : clôture au-delà du stop APRÈS déclenchement → `stopped`,
 *        - validation   : clôture ≥ tp1 → `tp1-hit` ; ≥ tp2 → `tp2-hit`,
 *        - fenêtre      : horizon (séances) écoulé sans issue → `expired`,
 *   4. horodate meta.levelsVerifiedAt / meta.levelsCloseDate (le « vérifié le » des pages),
 *   5. régénère data/analyses-status.json — l'endpoint UNIQUE lu par le garde-fou JS
 *      (assets/core.js) qui bannit les pages dont le statut n'a pas été rafraîchi.
 *
 * Fail-closed : cotation introuvable → AUCUNE transition, AUCUN horodatage (le dossier
 * apparaîtra « non vérifié » côté client — jamais un statut fabriqué). Les statuts
 * terminaux posés éditorialement (invalidated/no-trade/archived…) ne sont JAMAIS écrasés.
 *
 * Usage : node tools/analyses-lifecycle.js [--dry] [--max-age 120] [--tickers AAOI,KLAC]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data', 'analyses-data');
const OUT = path.join(ROOT, 'data', 'analyses-status.json');

const DRY = process.argv.includes('--dry');
const argOf = (n, d) => { const i = process.argv.indexOf(n); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const MAX_AGE_DAYS = parseInt(argOf('--max-age', '120'), 10);
const ONLY = argOf('--tickers', '').split(',').map(s => s.trim()).filter(Boolean);

const OPEN_STATUSES = new Set(['active', 'pending', 'watch', 'tp1-hit']);
const HORIZON_DEFAULT = 20, HORIZON_MIN = 5, HORIZON_MAX = 60;

function todayISO() { return new Date().toISOString().slice(0, 10); }

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'DailyTickers/1.0' }, timeout: 15000 }, res => {
      if (res.statusCode >= 400) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      let s = ''; res.on('data', d => s += d); res.on('end', () => resolve(s));
    }).on('error', reject).on('timeout', function () { this.destroy(new Error('timeout')); });
  });
}

/** Clôtures quotidiennes [{date, close}] triées — Yahoo direct puis proxy allorigins. */
async function fetchCloses(ticker, sinceISO) {
  const ageDays = Math.ceil((Date.now() - new Date(sinceISO)) / 86400000);
  const range = ageDays <= 55 ? '3mo' : '6mo';
  const yurl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=1d`;
  let raw;
  try { raw = await httpGet(yurl); }
  catch { raw = await httpGet('https://api.allorigins.win/raw?url=' + encodeURIComponent(yurl)); }
  const j = JSON.parse(raw);
  const r = j?.chart?.result?.[0];
  const ts = r?.timestamp || [], closes = r?.indicators?.quote?.[0]?.close || [];
  const out = [];
  for (let i = 0; i < ts.length; i++) {
    if (closes[i] == null) continue;
    const d = new Date(ts[i] * 1000).toISOString().slice(0, 10);
    out.push({ date: d, close: closes[i] });
  }
  // CLÔTURES RÉGLÉES uniquement : la barre datée d'aujourd'hui n'est un close qu'une fois TOUS
  // les marchés fermés (US 20h/21h UTC selon DST → cutoff 21h05 UTC ; l'Europe ferme avant).
  // Avant ce cutoff, Yahoo sert la barre du jour EN COURS — un « close » qui bouge encore, sur
  // lequel on ne prend AUCUNE décision (leçon du 26/08 : valeurs EU cotantes entrées en close).
  const today = todayISO();
  const settledToday = new Date().getUTCHours() * 60 + new Date().getUTCMinutes() >= 21 * 60 + 5;
  return out
    .filter(b => b.date > sinceISO && (b.date < today || (b.date === today && settledToday)))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function parseHorizonSessions(h) {
  const nums = String(h || '').match(/\d+/g);
  if (!nums || !nums.length) return HORIZON_DEFAULT;
  return Math.max(HORIZON_MIN, Math.min(HORIZON_MAX, Math.max(...nums.map(Number))));
}

/**
 * Rejoue le plan publié sur les clôtures. Retourne {status, note, closeDate, close} ou null
 * (= rien à changer). Long et short gérés par symétrie (side = signe de tp1 - entry).
 */
function replayPlan(t, pubPrice, closes, horizon, startStatus) {
  const entry = t.entry, stop = t.stop, tp1 = t.tp1 ?? null, tp2 = t.tp2 ?? null;
  if (!(entry > 0) || !(stop > 0)) return null;
  const side = (tp1 != null ? tp1 : entry * (stop < entry ? 1.01 : 0.99)) >= entry ? 1 : -1;
  // Zone d'entrée : « retracement » si l'entrée est du côté opposé au sens du trade par rapport
  // au prix de publication (on attend le repli), « extension » sinon (on attend la cassure).
  const retracement = pubPrice != null ? (side === 1 ? entry <= pubPrice : entry >= pubPrice) : true;
  let triggered = startStatus === 'tp1-hit'; // un TP1 déjà acté implique un déclenchement passé
  let tp1Hit = startStatus === 'tp1-hit';
  let triggerIdx = triggered ? 0 : -1;

  for (let i = 0; i < closes.length; i++) {
    const c = closes[i].close, d = closes[i].date;
    if (!triggered) {
      const hit = retracement ? (side === 1 ? c <= entry : c >= entry)
                              : (side === 1 ? c >= entry : c <= entry);
      if (hit) { triggered = true; triggerIdx = i; }
      else if (i + 1 >= horizon) {
        return { status: 'expired', note: `jamais déclenché — fenêtre de ${horizon} séances écoulée le ${d}`, closeDate: d, close: c };
      }
      if (!triggered) continue;
    }
    // Déclenché (éventuellement cette séance même) : stop d'abord — lecture conservatrice.
    if (side === 1 ? c <= stop : c >= stop) {
      return { status: 'stopped', note: `${tp1Hit ? 'stop après TP1' : 'clôture au stop'} le ${d} (${c.toFixed(2)})`, closeDate: d, close: c };
    }
    if (tp2 != null && (side === 1 ? c >= tp2 : c <= tp2)) {
      return { status: 'tp2-hit', note: `TP2 en clôture le ${d} (${c.toFixed(2)})`, closeDate: d, close: c };
    }
    if (!tp1Hit && tp1 != null && (side === 1 ? c >= tp1 : c <= tp1)) {
      tp1Hit = true;
      // pas de return : on continue à surveiller tp2/stop, mais on mémorise la validation
      var tp1Info = { status: 'tp1-hit', note: `TP1 en clôture le ${d} (${c.toFixed(2)})`, closeDate: d, close: c };
    }
    if (i - triggerIdx + 1 >= horizon) {
      return tp1Hit
        ? { status: 'completed', note: `TP1 atteint puis fenêtre close le ${d}`, closeDate: d, close: c }
        : { status: 'expired', note: `fenêtre de ${horizon} séances écoulée le ${d} sans stop ni objectif`, closeDate: d, close: c };
    }
  }
  if (tp1Hit && startStatus !== 'tp1-hit') return tp1Info || null;
  if (triggered && (startStatus === 'pending' || startStatus === 'watch')) {
    const last = closes[closes.length - 1];
    return { status: 'active', note: `entrée déclenchée en clôture le ${closes[triggerIdx].date}`, closeDate: last.date, close: last.close };
  }
  return null;
}

const DISPLAY = {
  active: 'Dossier d’actualité', pending: 'En attente de déclenchement', watch: 'Sous surveillance',
  'tp1-hit': 'Thèse validée (TP1)', 'tp2-hit': 'Thèse validée (TP2)', completed: 'Clôturé (TP1 atteint)',
  stopped: 'Invalidé (stop touché)', invalidated: 'Thèse invalidée', expired: 'Fenêtre écoulée',
  'no-trade': 'Dossier informatif', archived: 'Archivé', info: 'Dossier informatif',
};

async function main() {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && !f.endsWith('.harness.json'));
  const registry = {}; const transitions = []; const failures = [];
  let checked = 0, stamped = 0;
  const nowISO = new Date().toISOString();

  // Petite parallélisation bornée pour rester poli avec la source.
  const queue = [];
  for (const f of files) {
    const slug = f.replace(/\.json$/, '');
    if (ONLY.length && !ONLY.includes(slug)) { /* hors périmètre : registre quand même */ }
    let d;
    try { d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')); } catch { continue; }
    const meta = d.meta || {}, t = d.tradeIdea || null;
    const status = (t && t.status) || meta.status || (t ? 'active' : 'info');
    const entryReg = {
      status, display: DISPLAY[status] || status,
      publishedAt: meta.date || null, grade: meta.grade || null,
      name: (d.header && d.header.name) || slug,
      verifiedAt: meta.levelsVerifiedAt || null, closeDate: meta.levelsCloseDate || null,
      note: (t && t.statusNote) || null, hasPlan: !!(t && t.entry && t.stop),
    };
    registry[slug] = entryReg;

    const ageDays = meta.date ? (Date.now() - new Date(meta.date)) / 86400000 : Infinity;
    const inScope = t && t.entry && t.stop && OPEN_STATUSES.has(status) && ageDays <= MAX_AGE_DAYS
      && (!ONLY.length || ONLY.includes(slug));
    if (!inScope) continue;

    queue.push(async () => {
      let closes;
      try { closes = await fetchCloses(slug, meta.date); }
      catch (e) { failures.push(`${slug}: ${e.message}`); return; }
      checked++;
      if (!closes.length) { // publié aujourd'hui / pas encore de clôture postérieure : vérifié, rien à rejouer
        meta.levelsVerifiedAt = nowISO; entryReg.verifiedAt = nowISO; stamped++;
        if (!DRY) fs.writeFileSync(path.join(DATA_DIR, f), JSON.stringify(d, null, 2));
        return;
      }
      const horizon = parseHorizonSessions(t.horizon);
      const res = replayPlan(t, d.header && d.header.price, closes, horizon, status);
      const last = closes[closes.length - 1];
      meta.levelsVerifiedAt = nowISO;
      meta.levelsCloseDate = last.date;
      entryReg.verifiedAt = nowISO; entryReg.closeDate = last.date;
      stamped++;
      if (res && res.status !== status) {
        (meta.statusHistory = meta.statusHistory || []).push({ at: nowISO, from: status, to: res.status, note: res.note, close: res.close });
        t.status = res.status; t.statusNote = res.note;
        entryReg.status = res.status; entryReg.display = DISPLAY[res.status] || res.status; entryReg.note = res.note;
        transitions.push(`${slug}: ${status} → ${res.status} (${res.note})`);
      }
      if (!DRY) fs.writeFileSync(path.join(DATA_DIR, f), JSON.stringify(d, null, 2));
    });
  }

  const POOL = 6;
  for (let i = 0; i < queue.length; i += POOL) await Promise.all(queue.slice(i, i + POOL).map(fn => fn()));

  const agg = { generatedAt: nowISO, closeDateMax: Object.values(registry).reduce((m, e) => e.closeDate > m ? e.closeDate : m, ''), entries: registry };
  if (!DRY) fs.writeFileSync(OUT, JSON.stringify(agg, null, 1));

  const counts = {};
  for (const e of Object.values(registry)) counts[e.status] = (counts[e.status] || 0) + 1;
  console.log(`[lifecycle] ${files.length} dossiers · ${checked} vérifiés sur clôtures · ${stamped} horodatés${DRY ? ' (DRY)' : ''}`);
  console.log(`[lifecycle] statuts: ${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + '=' + v).join(' ')}`);
  transitions.forEach(x => console.log('  ↪ TRANSITION ' + x));
  failures.forEach(x => console.log('  ⚠ cotation KO — non vérifié: ' + x));
  if (!transitions.length) console.log('  (aucune transition ce soir)');
}

main().catch(e => { console.error('[lifecycle] ÉCHEC:', e.message); process.exit(1); });
