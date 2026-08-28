#!/usr/bin/env node
'use strict';
/**
 * scan-ingest-all.js — ASSEMBLEUR (node, ZÉRO MCP) : transforme les réponses MCP BRUTES déversées par
 * l'agent (/tmp/mcp-raw/<key>.json) en tous les staging que `publish-daily-card.sh` ingère, + lance
 * l'ingest dtx. C'est le « scriptant tout » de la doctrine perf-parallel-mcp (R5) : le MCP ne sort que
 * du brut, node fait TOUT l'assemblage — déterministe, testable A/B, aucune arithmétique de staging à la
 * main côté agent.
 *
 * ENTRÉES (déposées par l'agent après les salves) :
 *   /tmp/scan-plan.json        (node tools/scan-plan.js)
 *   /tmp/scan-plan-bars.json   (node tools/scan-plan.js --resolve-bars)
 *   /tmp/mcp-raw/<key>.json     réponses BRUTES. Pour les barres : forme POSITIONNELLE OBLIGATOIRE
 *                               {symbols:[…ordre exact…], result:<brut QueryData|Jobs>}.
 *
 * SORTIES (ce que le pipeline shell attend) :
 *   /tmp/candlestick-stage.json  {mcp_ok,asof,regime?,candidates:[{ticker,bars}]}          (bars-map, MÉCANIQUE)
 *   /tmp/metals-stage.json       {mcp_ok,asof,bars:{TICKER:[...]}}                          (bars-map, MÉCANIQUE)
 *   /tmp/hybrid-stage.json       {mcp_ok,asof,bars:{TICKER:[...]}}                          (bars-map, MÉCANIQUE)
 *   /tmp/price-stage-NN.json     {symbols,result} (repris tels quels des bruts barres → price-cache)
 *   /tmp/<scanner>-bars-bundle.json  {mcp_ok,asof,bars:{TICKER:[...]}} pour les scanners PRE-SCORÉS
 *       (highvol/momentum/factor/etf/forex/trendline-*) — l'AGENT applique la formule de score
 *       documentée (une ligne, LOCAL, zéro round-trip) et écrit /tmp/<scanner>-stage.json final.
 *   + ingest dtx : /tmp/<id>.decide.json + .replay.json → `node tools/dtx-mcp-ingest.js …` (garde sanity 7).
 *
 * FAIL-CLOSED : brut manquant / mcp_ok implicite faux / couverture 0 → le staging concerné n'est PAS
 * écrit (skip non-bloquant en aval), JAMAIS fabriqué. Sortie ≠ 0 récapitule les manques + les modes dtx
 * suspects (exit 7 propagé) pour alerte.
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const scan = require('./dtx-scan');

const REPO = path.resolve(__dirname, '..');
const RAW_DIR = '/tmp/mcp-raw';
const DTX_MODES = ['best'];
const PRE_SCORED = ['highvol', 'momentum', 'factor', 'etf', 'forex', 'trendline-forex', 'trendline-indices'];

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; } }
function raw(key) { return readJson(path.join(RAW_DIR, `${key}.json`)); }
function writeStage(p, obj) { fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8'); }

// Déballe le résultat QueryData (sync {results} OU Jobs {data:{items:[{results}]}}).
function extractResults(r) {
  if (!r) return [];
  const body = r.result !== undefined ? r.result : r;      // tolère wrapper {symbols,result}
  if (Array.isArray(body?.results)) return body.results;
  if (Array.isArray(body?.data?.items?.[0]?.results)) return body.data.items[0].results;
  if (Array.isArray(body?.data?.items)) return body.data.items.flatMap((it) => it.results || []);
  return [];
}

// Normalise des barres en [[date,o,h,l,c,v],…] ascendantes (accepte array ou objets).
function normBars(bars) {
  if (!Array.isArray(bars)) return null;
  return bars.map((b) => Array.isArray(b)
    ? [b[0], +b[1], +b[2], +b[3], +b[4], +b[5]]
    : [b.date, +b.open, +b.high, +b.low, +b.close, +b.volume]).filter((r) => r[0]);
}

/**
 * Construit une map {TICKER: bars[]} depuis une liste de clés de bruts barres au contrat POSITIONNEL
 * {symbols, result}. data.length DOIT égaler symbols.length (jamais deviner) — sinon le fichier est rejeté.
 */
function barsMapFromKeys(keys, warns) {
  const map = {};
  for (const key of keys) {
    const r = raw(key);
    if (!r) { warns.push(`bars ${key}: brut absent`); continue; }
    if (!Array.isArray(r.symbols)) { warns.push(`bars ${key}: pas de champ symbols[] (contrat positionnel violé) — rejeté`); continue; }
    const results = extractResults(r).filter((x) => x && (x.data_type === 'bars_daily' || x.bars || x.data));
    if (results.length !== r.symbols.length) {
      warns.push(`bars ${key}: mapping positionnel impossible (${results.length} résultats vs ${r.symbols.length} symboles) — rejeté, jamais deviner`);
      continue;
    }
    r.symbols.forEach((sym, i) => {
      const b = normBars(results[i]?.bars || results[i]?.data || results[i]);
      if (b && b.length) map[sym] = b;
    });
  }
  return map;
}

// Toutes les clés de bruts barres présentes dans /tmp/mcp-raw (static + dynamiques).
function allBarKeys() {
  try {
    return fs.readdirSync(RAW_DIR)
      .filter((f) => /^bars_.*\.json$/.test(f))
      .map((f) => f.replace(/\.json$/, ''));
  } catch (_) { return []; }
}

function subset(map, tickers) {
  const out = {};
  for (const t of tickers) if (map[t]) out[t] = map[t];
  return out;
}

function main() {
  const plan = readJson('/tmp/scan-plan.json');
  const bars = readJson('/tmp/scan-plan-bars.json');
  if (!plan) { console.error('⛔ /tmp/scan-plan.json absent — lancer `node tools/scan-plan.js` d\'abord'); process.exit(2); }
  const asof = plan.scanDate;
  const folder = plan.folder;
  const warns = [];
  const written = [];

  // Régime : lu du brut ctx_regime si présent (sinon null, non bloquant).
  let regime = null;
  const cr = raw('ctx_regime');
  try { regime = cr?.result?.facets?.regime?.regime || cr?.regime || null; } catch (_) {}

  // 1) MAP GLOBALE des barres (positionnel, dédupé) — sert à tous les scanners bars-map + bundles.
  const barMap = barsMapFromKeys(allBarKeys(), warns);
  const haveTickers = Object.keys(barMap);
  if (!haveTickers.length) warns.push('AUCUNE barre assemblée — tous les stagings bars-map/bundles seront skippés (fail-closed)');

  // perScanner : de scan-plan-bars ; fallback = tous les tickers dispos.
  const perScanner = bars?.perScanner || {};
  const tickersFor = (s) => (perScanner[s] && perScanner[s].length ? perScanner[s] : haveTickers);

  // 2) STAGINGS bars-map MÉCANIQUES (candlestick/metals/hybrid) — construits à 100% depuis les barres.
  const candTk = tickersFor('candlestick');
  const candBars = subset(barMap, candTk);
  if (Object.keys(candBars).length) {
    writeStage('/tmp/candlestick-stage.json', {
      mcp_ok: true, asof, regime, universeFetched: Object.keys(candBars).length,
      candidates: Object.entries(candBars).map(([ticker, b]) => ({ ticker, bars: b })),
    });
    written.push('candlestick');
  } else warns.push('candlestick: 0 barre → staging non écrit (skip)');

  for (const s of ['metals', 'hybrid']) {
    const b = subset(barMap, tickersFor(s));
    if (Object.keys(b).length) {
      writeStage(`/tmp/${s}-stage.json`, { mcp_ok: true, asof, regime, bars: b });
      written.push(s);
    } else warns.push(`${s}: 0 barre → staging non écrit (skip)`);
  }

  // 3) BUNDLES pre-scored : barres brutes par scanner → l'agent scorera LOCALEMENT (formule documentée).
  for (const s of PRE_SCORED) {
    const b = subset(barMap, tickersFor(s));
    if (Object.keys(b).length) {
      writeStage(`/tmp/${s}-bars-bundle.json`, { mcp_ok: true, asof, regime, bars: b });
      written.push(`${s}(bundle)`);
    } else warns.push(`${s}: 0 barre → bundle non écrit (skip)`);
  }

  // 4) PRICE-CACHE : les bruts barres dynamiques sont DÉJÀ au format {symbols,result} → copie en price-stage.
  const dynKeys = allBarKeys().filter((k) => /^bars_dyn_/.test(k));
  let pn = 0;
  for (const k of dynKeys) {
    const r = raw(k);
    if (r && Array.isArray(r.symbols)) { fs.writeFileSync(`/tmp/price-stage-${String(pn).padStart(2, '0')}.json`, JSON.stringify(r), 'utf8'); pn++; }
  }
  if (pn) written.push(`price-cache(${pn} lots)`);
  else warns.push('price-cache: aucun lot bars_dyn_* → sweep sans prix frais ce soir (dégradation honnête)');

  // 5) DTX : bruts decide/replay → fichiers → dtx-mcp-ingest.js par mode (garde sanity exit 7 propagée).
  const dtxSuspect = [];
  const dtxFrozen = [];
  const dtxSkipped = [];
  for (const id of DTX_MODES) {
    const dec = raw(`dtx_${id}_decide`);
    const rep = raw(`dtx_${id}_replay`);
    const decBody = dec?.result || dec;
    const repBody = rep?.result || rep;
    if (!decBody || !(decBody.actions || decBody.result?.actions)) { dtxSkipped.push(`${id}(decide absent)`); continue; }
    const decPath = `/tmp/${id}.decide.json`;
    const repPath = `/tmp/${id}.replay.json`;
    fs.writeFileSync(decPath, JSON.stringify(decBody), 'utf8');
    const args = ['tools/dtx-mcp-ingest.js', '--portfolio', id, '--decide', decPath, '--asof', asof, '--from', scan.DEFAULT_FROM];
    if (repBody && (repBody.results || repBody.result?.results)) {
      fs.writeFileSync(repPath, JSON.stringify(repBody), 'utf8');
      const to = String(scan.goLiveFor(id) || asof).slice(0, 10);
      args.push('--replay', repPath, '--to', to);
    }
    const res = cp.spawnSync('node', args, { cwd: REPO, encoding: 'utf8' });
    process.stdout.write(res.stdout || '');
    if (res.stderr) process.stderr.write(res.stderr);
    if (res.status === 7) { dtxSuspect.push(id); written.push(`dtx:${id}(SUSPECT)`); }
    else if (res.status === 8) { dtxFrozen.push(id); }   // anti-gel : staging précédent conservé stale, jamais écrasé
    else if (res.status === 0) written.push(`dtx:${id}`);
    else dtxSkipped.push(`${id}(ingest exit ${res.status})`);
  }

  // ── Rapport ──
  console.log(`\n📦 scan-ingest-all → folder=${folder} asof=${asof}`);
  console.log(`   ÉCRIT : ${written.join(', ') || '(rien)'}`);
  if (warns.length) { console.log('   ⚠️  SKIPS (fail-closed, jamais fabriqué) :'); for (const w of warns) console.log(`      • ${w}`); }
  if (dtxSuspect.length) console.error(`   ⛔ DTX SUSPECT (metricsSuspect, exit 7) : ${dtxSuspect.join(', ')} → ALERTER Telegram 'alerts', NE PAS publier ces métriques.`);
  if (dtxFrozen.length) console.error(`   ⛔ DTX FIGÉ (anti-gel, exit 8) : ${dtxFrozen.join(', ')} → réponse DtxDecide non recalculée pour cette séance. Re-appeler DtxDecide(asof=${asof}), ALERTER Telegram 'alerts'. Staging précédent conservé stale.`);
  if (dtxSkipped.length) console.error(`   ⚠️  DTX SKIPPÉS : ${dtxSkipped.join(', ')} → staging conservé stale, jamais fabriqué.`);

  // exit non-zéro si un mode dtx est suspect (7) ou figé (8) — aligne les gardes ; jamais bloquant sur un simple skip.
  if (dtxSuspect.length) process.exitCode = 7;
  else if (dtxFrozen.length) process.exitCode = 8;
}

if (require.main === module) main();
module.exports = { barsMapFromKeys, extractResults, normBars };
