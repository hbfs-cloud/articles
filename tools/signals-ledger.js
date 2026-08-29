#!/usr/bin/env node
/**
 * signals-ledger.js — registre APPEND-ONLY des signaux émis par signals-desk,
 * + sweep des sorties (au spot, prix fournis par l'agent via MCP) + agrégat de leçons
 * (win-rate / R moyen par famille × régime) pour la boucle d'amélioration.
 *
 * Fichiers :
 *   data/signals-ledger.json   { generatedAt, signals:[...] }   (append-only ; jamais réécrire un signal terminal)
 *   data/signals-lessons.json  { generatedAt, byFamilyRegime:{...}, byFamily:{...}, overall:{...} }
 *
 * Commandes :
 *   node tools/signals-ledger.js append  --payload <file.json>          # ajoute des signaux [{...}]
 *   node tools/signals-ledger.js sweep   --prices <file.json> --asof YYYY-MM-DD   # maj statuts open/triggered
 *   node tools/signals-ledger.js lessons                                # (re)calcule data/signals-lessons.json
 *   node tools/signals-ledger.js report  [--days 30]                    # open + closed récents (JSON, pour le bilan)
 *   node tools/signals-ledger.js list                                   # tout (debug)
 *
 * Statuts : open → triggered → tp1 → tp2 (terminaux : tp2, stopped, expired, skipped).
 * R réalisé = (exit − entry) / (entry − stop). Long-only.
 * Le sweep n'écrase JAMAIS un statut terminal (intégrité track-record).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LEDGER = path.join(ROOT, 'data', 'signals-ledger.json');
const LESSONS = path.join(ROOT, 'data', 'signals-lessons.json');
const TERMINAL = new Set(['tp2', 'stopped', 'expired', 'skipped']);
const DEFAULT_HOLD = 10; // séances
const MIN_MATURE_SAMPLE = 20;

function readJSON(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}
function writeJSON(p, obj) { fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n'); }
function arg(flag, def) { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : def; }
function loadLedger() { return readJSON(LEDGER, { generatedAt: null, signals: [] }); }
function sigId(s) { return `${(s.date || '').replace(/-/g, '')}-${s.ticker}-${s.family || 'swing'}`; }
function num(x) { const n = Number(x); return Number.isFinite(n) ? n : null; }

function cmdAppend(nowIso) {
  const payloadPath = arg('--payload');
  if (!payloadPath) { console.error('append: --payload <file.json> requis'); process.exit(2); }
  const incoming = readJSON(path.resolve(payloadPath), null);
  if (!Array.isArray(incoming)) { console.error('append: le payload doit être un tableau de signaux'); process.exit(2); }
  const ledger = loadLedger();
  const byId = new Map(ledger.signals.map(s => [s.id || sigId(s), s]));
  let added = 0, skipped = 0;
  for (const raw of incoming) {
    const s = {
      id: null, date: raw.date, family: raw.family || 'swing', ticker: raw.ticker,
      direction: raw.direction || 'long', entry: num(raw.entry), stop: num(raw.stop),
      tp1: num(raw.tp1), tp2: num(raw.tp2), rr: num(raw.rr), thesis: raw.thesis || '',
      regime: raw.regime || '', confidence: raw.confidence || '', maxHoldDays: num(raw.maxHoldDays) || DEFAULT_HOLD,
      status: raw.status || 'open', triggered: !!raw.triggered, outcomeR: null, closedDate: null, addedAt: nowIso,
    };
    s.id = sigId(s);
    if (!s.ticker || s.entry == null || s.stop == null) { skipped++; continue; }
    if (byId.has(s.id)) { skipped++; continue; } // append-only, pas de doublon
    ledger.signals.push(s); byId.set(s.id, s); added++;
  }
  ledger.generatedAt = nowIso;
  writeJSON(LEDGER, ledger);
  console.log(JSON.stringify({ ok: true, added, skipped, total: ledger.signals.length }));
}

function cmdSweep(nowIso) {
  const pricesPath = arg('--prices');
  const asof = arg('--asof', (nowIso || '').slice(0, 10));
  if (!pricesPath) { console.error('sweep: --prices <file.json> requis ({TICKER:{price,high,low}} ou {TICKER:price})'); process.exit(2); }
  const prices = readJSON(path.resolve(pricesPath), null);
  if (!prices || typeof prices !== 'object') { console.error('sweep: prices invalide'); process.exit(2); }
  const ledger = loadLedger();
  let updated = 0;
  for (const s of ledger.signals) {
    if (TERMINAL.has(s.status)) continue;                       // ne jamais écraser un terminal
    const q = prices[s.ticker]; if (q == null) continue;
    const price = num(typeof q === 'object' ? q.price : q);
    const high = num(typeof q === 'object' ? (q.high ?? q.price) : q);
    const low = num(typeof q === 'object' ? (q.low ?? q.price) : q);
    // `open` est OPTIONNEL : il ne sert qu'à détecter un trou de cotation sous le stop.
    // Ne PAS passer par num(null) — Number(null) vaut 0, un 0 fini que le test « open < stop »
    // accepte : toute ligne sweepée avec le format documenté {price,high,low} (sans `open`)
    // se retrouvait remplie à 0 et scellée à −30R au lieu de −1R. Absent = pas d'info de gap.
    const open = (q && typeof q === 'object' && q.open != null) ? num(q.open) : null;
    if (price == null) continue;
    // Niveaux ≤ 0 (ou NaN) = ABSENTS, pas des cibles/stop à prix 0 (sinon high>=0 déclenche tp2 à tort → R aberrant).
    const stopLvl = (s.stop != null && s.stop > 0) ? s.stop : null;
    const tp1Lvl = (s.tp1 != null && s.tp1 > 0) ? s.tp1 : null;
    const tp2Lvl = (s.tp2 != null && s.tp2 > 0) ? s.tp2 : null;
    const denom = (s.entry != null && stopLvl != null) ? (s.entry - stopLvl) : null;
    const rOf = (exit) => (denom && denom !== 0) ? +(((exit - s.entry) / denom).toFixed(4)) : null;

    // PORTE D'ENTRÉE. Sans elle, une ligne jamais déclenchée pouvait être enregistrée « stopped »
    // (le stop se compare au bas de barre même si l'entrée n'a jamais été touchée) et le champ
    // `triggered` restait faux sur TOUTE la base — 1 entrée sur 34 le portait, gagnants tp2 compris.
    // Pour un long, l'entrée est servie dès que la barre CONTIENT le niveau : vrai pour une limite
    // sur repli comme pour un ordre de cassure.
    if (!s.triggered) {
      const touche = s.entry != null && low != null && high != null && low <= s.entry && s.entry <= high;
      if (!touche) {
        // Pas encore en position : seule l'expiration de l'ordre peut la fermer, jamais un stop.
        const ageOrdre = s.date ? Math.round((Date.parse(asof) - Date.parse(s.date)) / 86400000) : 0;
        if (ageOrdre >= (s.maxHoldDays || DEFAULT_HOLD) * 1.4) { s.status = 'skipped'; s.closedDate = asof; updated++; }
        continue;
      }
      s.triggered = true; s.triggeredDate = asof; s.status = 'open'; updated++;
    }

    // stop d'abord (conservateur), puis cibles
    if (stopLvl != null && low != null && low <= stopLvl) {
      // Trou de cotation : si la barre OUVRE déjà sous le stop, le remplissage réel est l'ouverture,
      // pas le niveau. Compter −1R dans ce cas idéalise la perte (cas TAK du 04/08 : ouverture 16,35
      // pour un stop à 16,80, soit −1,56R et non −1R).
      const fill = (open != null && open < stopLvl) ? open : stopLvl;
      s.status = 'stopped'; s.outcomeR = rOf(fill); s.closedDate = asof;
      if (fill !== stopLvl) s.gapThroughStop = { open, stop: stopLvl };
      updated++; continue;
    }
    if (tp2Lvl != null && high != null && high >= tp2Lvl) { s.status = 'tp2'; s.outcomeR = rOf(tp2Lvl); s.closedDate = asof; updated++; continue; }
    if (tp1Lvl != null && high != null && high >= tp1Lvl && s.status !== 'tp1') { s.status = 'tp1'; s.outcomeR = rOf(tp1Lvl); updated++; continue; }
    // expiration par horizon
    const ageDays = s.date ? Math.round((Date.parse(asof) - Date.parse(s.date)) / 86400000) : 0;
    if (ageDays >= (s.maxHoldDays || DEFAULT_HOLD) * 1.4) { // ~jours calendaires ≈ 1.4× séances
      s.status = (s.status === 'tp1') ? 'tp2' : 'expired';
      s.outcomeR = (s.status === 'tp2') ? rOf(s.tp1) : rOf(price);
      s.closedDate = asof; updated++;
    }
  }
  ledger.generatedAt = nowIso;
  writeJSON(LEDGER, ledger);
  console.log(JSON.stringify({ ok: true, updated, total: ledger.signals.length }));
}

function cmdLessons(nowIso) {
  const ledger = loadLedger();
  const unique = new Map();
  for (const signal of ledger.signals) {
    if (!TERMINAL.has(signal.status) || signal.outcomeR == null || !signal.closedDate) continue;
    const id = signal.id || sigId(signal);
    if (!unique.has(id)) unique.set(id, signal);
  }
  const closed = [...unique.values()];
  const agg = (key) => {
    const m = {};
    for (const s of closed) {
      const k = key(s); (m[k] ||= { n: 0, wins: 0, sumR: 0 });
      m[k].n++; if (s.outcomeR > 0) m[k].wins++; m[k].sumR += s.outcomeR;
    }
    for (const k of Object.keys(m)) {
      m[k].winRate = +(m[k].wins / m[k].n).toFixed(2);
      m[k].avgR = +(m[k].sumR / m[k].n).toFixed(2);
      m[k].mature = m[k].n >= MIN_MATURE_SAMPLE;
      m[k].policy_use = m[k].mature ? 'eligible_for_reviewed_overlay' : 'advisory_only';
      delete m[k].sumR;
    }
    return m;
  };
  const out = {
    generatedAt: nowIso,
    source: 'data/signals-ledger.json',
    sourceSha256: require('crypto').createHash('sha256').update(fs.readFileSync(LEDGER)).digest('hex'),
    minimumMatureSample: MIN_MATURE_SAMPLE,
    deduplication: 'signal id; terminal with numeric outcomeR and closedDate only',
    n_closed: closed.length,
    byFamilyRegime: agg(s => `${s.family}|${s.regime || 'na'}`),
    byFamily: agg(s => s.family),
    overall: closed.length ? {
      n: closed.length,
      winRate: +(closed.filter(s => s.outcomeR > 0).length / closed.length).toFixed(2),
      avgR: +(closed.reduce((a, s) => a + s.outcomeR, 0) / closed.length).toFixed(2),
      mature: closed.length >= MIN_MATURE_SAMPLE,
      policy_use: closed.length >= MIN_MATURE_SAMPLE ? 'eligible_for_reviewed_overlay' : 'advisory_only',
    } : { n: 0, mature: false, policy_use: 'advisory_only' },
  };
  writeJSON(LESSONS, out);
  console.log(JSON.stringify(out));
}

function cmdReport() {
  const days = Number(arg('--days', '30'));
  const ledger = loadLedger();
  const open = ledger.signals.filter(s => !TERMINAL.has(s.status));
  const cutoff = Date.now() - days * 86400000;
  const closedRecent = ledger.signals.filter(s => TERMINAL.has(s.status) && s.closedDate && Date.parse(s.closedDate) >= cutoff);
  console.log(JSON.stringify({ open, closedRecent, lessons: readJSON(LESSONS, null) }, null, 2));
}

const cmd = process.argv[2];
const nowIso = arg('--now') || new Date().toISOString(); // --now injecté par l'agent pour reproductibilité
if (!fs.existsSync(path.dirname(LEDGER))) fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
switch (cmd) {
  case 'append': cmdAppend(nowIso); break;
  case 'sweep': cmdSweep(nowIso); break;
  case 'lessons': cmdLessons(nowIso); break;
  case 'report': cmdReport(); break;
  case 'list': console.log(JSON.stringify(loadLedger(), null, 2)); break;
  default: console.error('usage: signals-ledger.js <append|sweep|lessons|report|list> [flags]'); process.exit(2);
}
