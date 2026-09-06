#!/usr/bin/env node
'use strict';

/**
 * signal-outcomes — mesure ce que deviennent les signaux ÉDITORIAUX publiés.
 *
 * Le repo mesurait les modes de portefeuille (sweep, frozen_*, trade-chain) mais RIEN
 * ne mesurait les setups publiés dans `scanner/<date>/signals.json`. Conséquence réelle :
 * l'espérance du scanner éditorial a pu dériver autour de zéro pendant un mois entier sans
 * qu'aucun artefact du dépôt ne puisse le montrer. Ce script ferme ce trou.
 *
 *   agent → barres MCP (bounded, completed_only) → staging JSON
 *   node tools/signal-outcomes.js --bars <staging.json> [--from YYYYMMDD] [--report]
 *
 * Le staging est { "TICKER": [[date, open, high, low, close, volume], ...] } — exactement
 * la forme rendue par QueryData(types='bars_daily'). Le script ne parle JAMAIS au MCP :
 * frontière LLM/script, cf `.claude/skills/llm-script-boundary.md`.
 *
 * IMMUTABILITÉ — une ligne dont l'horizon est écoulé est SCELLÉE (`sealed: true`) et n'est
 * jamais recalculée, même si les barres changent (split, correction fournisseur). C'est la
 * même règle que `trade-chain.json` : on ne réécrit pas une mesure publiée. Les lignes non
 * scellées sont recalculées à chaque passage.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const LEDGER = path.join(ROOT, 'data', 'signal-outcomes.json');

// ── convention de remplissage ────────────────────────────────────────────────
// Le contrat maison (scanner/CLAUDE.md) impose de calculer le R/R depuis `entry_high`,
// « le pire prix de remplissage autorisé ». On simule donc au pire prix, jamais au milieu
// de zone : une mesure optimiste sur l'entrée est une mesure qui ment sur l'edge.
const GAP_CANCEL_PCT = 0.02; // execution.gate : annuler si le gap dépasse 2% au-dessus de la zone

function arg(name, def = null) {
  const i = process.argv.indexOf(name);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
}
const has = name => process.argv.includes(name);

function isoDir(dir) {
  return String(dir).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
}

function normalizeSignal(sig, meta) {
  // Les scans d'août portent `entry` (scalaire = borne haute) + `entry_low`; les scans
  // récents portent `entry_high`. validate-scan.js accepte les deux formes tant que la
  // zone est non ambiguë — on applique ici exactement la même dérivation.
  const entryHigh = sig.entry_high != null ? sig.entry_high : sig.entry;
  const entryLow = sig.entry_low != null ? sig.entry_low : entryHigh;
  return {
    scanDir: meta.dir,
    scanDate: meta.scanDate || isoDir(meta.dir),
    regime: meta.regime || null,
    ticker: sig.ticker,
    strategy: sig.strategy,
    score: sig.score ?? null,
    referenceClose: sig.price ?? null,
    entryLow,
    entryHigh,
    stop: sig.stop,
    tp1: sig.tp1,
    tp2: sig.tp2 ?? null,
    horizon: sig.horizon || 10,
    atr: (sig.extension && sig.extension.atr) ?? null,
    rsi: (sig.extension && sig.extension.rsi) ?? null,
    dist50dma: (sig.extension && sig.extension.distance_50dma_pct) ?? null,
    sector: sig.sector ?? null,
  };
}

function measure(s, seriesRaw) {
  if (!Array.isArray(seriesRaw) || !seriesRaw.length) return { status: 'no_bars' };
  const B = seriesRaw
    .map(x => ({ d: x[0], o: +x[1], h: +x[2], l: +x[3], c: +x[4] }))
    .filter(x => x.d && Number.isFinite(x.h) && Number.isFinite(x.l))
    .sort((a, z) => (a.d < z.d ? -1 : 1));
  const start = B.findIndex(x => x.d >= isoDir(s.scanDir));
  if (start < 0) return { status: 'session_not_covered' };

  const win = B.slice(start, start + s.horizon);
  if (!win.length) return { status: 'session_not_covered' };
  // L'horizon n'est écoulé que si la fenêtre est pleine ET qu'une barre postérieure existe,
  // sinon on ne sait pas si la dernière séance observée est bien la dernière de l'horizon.
  const mature = win.length === s.horizon && B.length > start + s.horizon;

  const risk = s.entryHigh - s.stop;
  if (!(risk > 0)) return { status: 'invalid_geometry', mature };

  let fillIdx = -1;
  for (let i = 0; i < win.length; i++) {
    const k = win[i];
    if (k.o > s.entryHigh * (1 + GAP_CANCEL_PCT)) continue; // ordre annulé par le gate de gap
    if (k.l <= s.entryHigh && k.h >= s.entryLow) { fillIdx = i; break; }
  }

  const ref = s.referenceClose != null ? s.referenceClose : (start > 0 ? B[start - 1].c : win[0].o);

  if (fillIdx < 0) {
    const best = Math.max(...win.map(k => k.h));
    return {
      status: 'not_triggered', mature,
      sessionsObserved: win.length,
      forgoneMovePct: ref ? +((best / ref - 1) * 100).toFixed(2) : null,
      wouldHaveReachedTp1: best >= s.tp1,
    };
  }

  const fill = s.entryHigh;
  const held = win.slice(fillIdx);
  let exit = null, reason = null, exitIdx = null;
  let mfe = -Infinity, mae = Infinity;

  for (let i = 0; i < held.length; i++) {
    const k = held[i];
    mfe = Math.max(mfe, k.h);
    mae = Math.min(mae, k.l);
    // Convention conservatrice : barres journalières, séquence intrajournalière inconnue.
    // Quand stop ET cible sont touchés le même jour, on retient le STOP. Toute autre
    // convention fabrique de l'edge qui n'existe pas.
    if (k.l <= s.stop) { exit = s.stop; reason = 'stop'; exitIdx = i; break; }
    if (k.h >= s.tp1) { exit = s.tp1; reason = 'tp1'; exitIdx = i; break; }
  }
  if (exit == null) {
    exit = held[held.length - 1].c;
    reason = mature ? 'horizon' : 'open';
    exitIdx = held.length - 1;
  }

  return {
    status: reason === 'open' ? 'running' : 'closed',
    mature,
    triggered: true,
    fillSession: fillIdx,
    fillPrice: +fill.toFixed(4),
    exitReason: reason,
    exitPrice: +exit.toFixed(4),
    heldSessions: exitIdx + 1,
    R: +((exit - fill) / risk).toFixed(4),
    mfeR: +((mfe - fill) / risk).toFixed(4),
    maeR: +((mae - fill) / risk).toFixed(4),
    pnlPct: +((exit / fill - 1) * 100).toFixed(3),
    entryVsReferencePct: ref ? +((fill / ref - 1) * 100).toFixed(3) : null,
  };
}

function collectSignals(fromDir) {
  const dir = path.join(ROOT, 'scanner');
  const out = [];
  for (const d of fs.readdirSync(dir).filter(x => /^\d{8}$/.test(x)).sort()) {
    if (fromDir && d < fromDir) continue;
    const p = path.join(dir, d, 'signals.json');
    if (!fs.existsSync(p)) continue;
    let j;
    try { j = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
    for (const sig of (j.signals || [])) {
      if (!sig || !sig.ticker) continue;
      out.push(normalizeSignal(sig, { dir: d, scanDate: j.scanDate, regime: j.regime }));
    }
  }
  return out;
}

function loadLedger() {
  if (!fs.existsSync(LEDGER)) return { _comment: 'Issues mesurées des signaux éditoriaux publiés. Une ligne scellée est immuable.', version: 1, entries: {} };
  return JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
}

function keyOf(s) { return `${s.scanDir}-${s.ticker}`; }

function main() {
  const barsPath = arg('--bars');
  const fromDir = arg('--from');
  if (!barsPath) {
    console.error('usage: node tools/signal-outcomes.js --bars <staging.json> [--from YYYYMMDD] [--report]');
    console.error('  staging = { "TICKER": [[date,o,h,l,c,v], ...] } (QueryData bars_daily, completed_only)');
    process.exit(2);
  }
  const bars = JSON.parse(fs.readFileSync(barsPath, 'utf8'));
  const signals = collectSignals(fromDir);
  const ledger = loadLedger();

  let sealed = 0, updated = 0, skippedSealed = 0, noBars = 0;
  for (const s of signals) {
    const k = keyOf(s);
    const prev = ledger.entries[k];
    if (prev && prev.sealed) { skippedSealed++; continue; }
    const m = measure(s, bars[s.ticker]);
    if (m.status === 'no_bars') { noBars++; continue; }
    const entry = {
      ...s,
      ...m,
      measuredAt: new Date().toISOString(),
      sealed: Boolean(m.mature) && (m.status === 'closed' || m.status === 'not_triggered'),
    };
    entry.checksum = crypto.createHash('sha256')
      .update(JSON.stringify([k, entry.R ?? null, entry.exitReason ?? null, entry.status]))
      .digest('hex').slice(0, 16);
    ledger.entries[k] = entry;
    if (entry.sealed) sealed++; else updated++;
  }

  ledger.generatedAt = new Date().toISOString();
  ledger.count = Object.keys(ledger.entries).length;
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
  console.log(`[signal-outcomes] ${ledger.count} lignes — ${sealed} scellées ce run, ${updated} en cours, ${skippedSealed} déjà scellées, ${noBars} sans barres`);

  if (has('--report')) report(ledger);
}

function report(ledger) {
  const all = Object.values(ledger.entries).filter(e => e.mature);
  const trig = all.filter(e => e.triggered && e.status === 'closed');
  if (!trig.length) { console.log('\nAucune ligne à horizon écoulé.'); return; }
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length - 1)); };
  const pc = (n, d) => (d ? (n / d * 100).toFixed(0) + '%' : '-');
  const R = trig.map(e => e.R);
  const se = sd(R) / Math.sqrt(R.length);

  console.log(`\n=== SIGNAUX ÉDITORIAUX — ${trig.length} déclenchés à horizon écoulé ===`);
  console.log(`déclenchement      ${pc(trig.length, all.length)} (${all.length - trig.length} jamais entrés)`);
  console.log(`espérance          ${mean(R).toFixed(3)}R  ±${(1.96 * se).toFixed(3)} (IC95)`);
  console.log(`taux de gain       ${pc(R.filter(x => x > 0).length, R.length)}`);
  for (const w of ['stop', 'tp1', 'horizon']) {
    const g = trig.filter(e => e.exitReason === w);
    if (g.length) console.log(`  ${w.padEnd(8)} ${String(g.length).padStart(3)} ${pc(g.length, trig.length).padStart(5)}  R moy ${mean(g.map(e => e.R)).toFixed(2).padStart(6)}  MFE moy ${mean(g.map(e => e.mfeR)).toFixed(2)}R`);
  }
  const byS = {};
  trig.forEach(e => (byS[e.strategy] = byS[e.strategy] || []).push(e.R));
  console.log('\npar stratégie :');
  for (const [k, v] of Object.entries(byS).sort((a, z) => mean(z[1]) - mean(a[1]))) {
    const s = sd(v) / Math.sqrt(v.length);
    console.log(`  ${k.padEnd(13)} n=${String(v.length).padStart(3)}  ${mean(v).toFixed(3).padStart(7)}R  IC95 [${(mean(v) - 1.96 * s).toFixed(2)}, ${(mean(v) + 1.96 * s).toFixed(2)}]`);
  }
}

if (require.main === module) main();
module.exports = { measure, normalizeSignal, collectSignals };
