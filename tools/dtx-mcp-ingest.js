#!/usr/bin/env node
'use strict';
/**
 * dtx-mcp-ingest.js — ingest a hosted dtx MCP (systematic.dailytickers.com) DtxDecide + DtxReplay
 * payload into the staging JSON that gen-status-page reads (data/dtx/<portfolioId>.json).
 *
 * The collector or authenticated agent captures raw DtxDecide/DtxReplay responses without exposing
 * token values. This offline ingest validates and converts those immutable payloads into staging:
 *
 *   authenticated MCP capture writes each raw tool result to a JSON file
 *       → `node tools/dtx-mcp-ingest.js --portfolio <id> --decide <file> [--replay <file>]`
 *         → writes data/dtx/<id>.json in the EXACT schema the NATIVE path (dtx-scan.js) produces
 *           → gen-status-page.js reads it (orders = rank-1 candidates from V2 groups, metrics = replay).
 *
 * The staging schema is built via dtx-scan.js's shared helpers (buildStaging / extractReplayMetrics /
 * writeStaging) so this file is byte-compatible with the binary producer by construction — only the
 * provenance fields differ: engine = "dtx (systematic-tss) — MCP", engineMode = "mcp".
 *
 * The local binary path (`node tools/dtx-scan.js`) stays the OFFLINE / no-agent FALLBACK.
 *
 * DtxDecide JSON shape : Contract V2 with execution_plan.groups[].candidates[].
 *                         actions.CREATE is compatibility output and is never consumed.
 * DtxReplay JSON shape : { portfolio_id, results:[{cagr_pct,max_dd_pct,sharpe,r2,win_rate,
 *                         total_trades,final_equity,equity_dates[],equity_values[], ...}] }
 * Order fields are snake_case; dtx-scan.mapOrder maps them → the staging camelCase order fields.
 *
 * Usage:
 *   node tools/dtx-mcp-ingest.js --portfolio ep --decide decide.json --replay replay.json \
 *        --asof 2026-07-09 [--from 2021-01-01] [--to 2026-07-06] [--out path] [--quiet]
 *
 *   --portfolio <id>   dtx portfolio id (see DtxListConfigs): book_honest|us_highvol|hvep|stockbox_pit|etf_us|ep
 *   --decide <file>    REQUIRED — path to the DtxDecide JSON result (or "-" to read stdin)
 *   --replay <file>    OPTIONAL — path to the DtxReplay JSON result (omit → metrics/equity = null)
 *   --asof YYYY-MM-DD  REQUIRED — the session the decide was run for
 *   --from / --to      OPTIONAL — replay window stamp (default from=2021-01-01, to=go-live splice||asof)
 *   --out <file>       OPTIONAL — override output path (default data/dtx/<id>.json)
 *   --pit              OPTIONAL — POINT-IN-TIME / rétro : écrit data/dtx/<id>@<asof>.json (entrée
 *                      dédiée par as-of) au lieu d'écraser la staging LIVE du mode. Idea #8.
 */

const fs = require('fs');
const path = require('path');
const scan = require('./dtx-scan');
const dtxBars = require('./lib/dtx-bars');
const { validateDtxDecision, validateDtxReplay } = require('./lib/dtx-content-gates');

function parseArgs(argv) {
  const o = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--portfolio' || a === '--mode') o.portfolio = argv[++i];
    else if (a === '--decide') o.decide = argv[++i];
    else if (a === '--replay') o.replay = argv[++i];
    else if (a === '--asof') o.asof = argv[++i];
    else if (a === '--expected-close') o.expectedClose = argv[++i];
    else if (a === '--from') o.from = argv[++i];
    else if (a === '--to') o.to = argv[++i];
    else if (a === '--out') o.out = argv[++i];
    else if (a === '--currency') o.currency = argv[++i];
    else if (a === '--name') o.name = argv[++i];
    else if (a === '--pit') o.pit = true;
    else if (a === '--quiet') o.quiet = true;
  }
  return o;
}

function readJson(p, label) {
  let raw;
  if (p === '-') raw = fs.readFileSync(0, 'utf8');
  else {
    if (!fs.existsSync(p)) throw new Error(`${label}: file not found: ${p}`);
    raw = fs.readFileSync(p, 'utf8');
  }
  let j;
  try { j = JSON.parse(raw); }
  catch (e) { throw new Error(`${label}: invalid JSON in ${p}: ${e.message}`); }
  return j;
}

/** Cherche une DATE DE CALCUL dans le payload decide (le MCP corrigé peut la stamper, typiquement dans
 *  `state`). Retourne 'YYYY-MM-DD' ou null. Best-effort : si absente, le garde anti-gel s'appuie sur la
 *  comparaison batch-vs-précédent (b), qui elle est toujours disponible. */
function extractComputedDate(decide) {
  if (!decide || typeof decide !== 'object') return null;
  const st = decide.state && typeof decide.state === 'object' ? decide.state : {};
  const cands = [
    decide.asof, decide.as_of, decide.date, decide.decision_date, decide.computed_for,
    st.asof, st.as_of, st.last_asof, st.last_decision_date, st.decision_date, st.date, st.as_of_date,
    decide.meta && decide.meta.asof,
  ];
  for (const c of cands) {
    if (typeof c === 'string' && /^\d{4}-\d{2}-\d{2}/.test(c)) return c.slice(0, 10);
  }
  return null;
}

/** Resolve the 4 fields the staging needs (id / name / currency / initial_capital) for a portfolio.
 *  The MCP (systematic.dailytickers.com) is the SOLE config source of truth — strategy logic, allocations
 *  and how-tos live THERE, never here. So a local config/dtx/portfolio_<id>.yaml is NOT required: if one
 *  exists it is honoured (back-compat), otherwise the fields are synthesized from CLI flags the agent
 *  already holds from DtxListConfigs (--currency, --name). Never throw on a missing local yaml. */
function resolveMode(portfolioId, opts) {
  const modes = scan.discoverModes();
  const m = modes[portfolioId];
  if (m && !m.error && m.path) {
    return { modeInfo: m, cfg: dtxBars.readConfig(m.path) };
  }
  const currency = opts.currency || 'USD';
  const name = opts.name || portfolioId;
  const cfg = { id: portfolioId, name, currency, initial_capital: 100000 };
  const modeInfo = { id: portfolioId, name, currency, initialCapital: 100000, file: null, path: null };
  return { modeInfo, cfg };
}

function main() {
  const opts = parseArgs(process.argv);
  const t0 = Date.now();
  if (!opts.portfolio) { console.error('ERROR: --portfolio <id> required'); process.exit(2); }
  if (!opts.decide) { console.error('ERROR: --decide <file> required (DtxDecide JSON)'); process.exit(2); }
  if (!opts.asof) { console.error('ERROR: --asof YYYY-MM-DD required'); process.exit(2); }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(opts.expectedClose || ''))) { console.error('ERROR: --expected-close YYYY-MM-DD required'); process.exit(2); }

  const { modeInfo, cfg } = resolveMode(opts.portfolio, opts);
  const currency = cfg.currency || 'USD';

  // 1) decide payload → validated Contract V2 groups. Tolerate the MCP result wrapper.
  const decideEnvelope = readJson(opts.decide, 'decide');
  const decideErrors = validateDtxDecision(decideEnvelope, { asof: opts.asof, referenceClose: opts.expectedClose });
  if (decideErrors.length) {
    console.error(`ERROR: DtxDecide Contract V2 rejected: ${decideErrors.join('; ')}`);
    process.exit(3);
  }
  const decide = decideEnvelope && decideEnvelope.result && typeof decideEnvelope.result === 'object'
    ? decideEnvelope.result : decideEnvelope;
  if (!decide || !Array.isArray(decide.execution_plan && decide.execution_plan.groups)) {
    console.error(`ERROR: decide JSON has no Contract V2 execution_plan.groups (got keys: ${decide ? Object.keys(decide).join(',') : 'null'})`);
    process.exit(3);
  }

  // 2) optional replay payload → metrics + equity (same window stamp logic as the native path).
  let metrics = null, equity = null, replayErr = null;
  if (opts.replay) {
    try {
      let rep = readJson(opts.replay, 'replay');
      const replayErrors = validateDtxReplay(rep, { portfolio: opts.portfolio, referenceClose: opts.expectedClose });
      if (replayErrors.length) throw new Error(`DtxReplay rejected: ${replayErrors.join('; ')}`);
      if (rep && !rep.results && rep.result && rep.result.results) rep = rep.result;
      if (!rep || !Array.isArray(rep.results)) throw new Error('replay JSON has no results[]');
      const from = opts.from || scan.DEFAULT_FROM;
      const to = opts.to || scan.goLiveFor(cfg.id) || opts.asof;
      ({ metrics, equity } = scan.extractReplayMetrics(rep, from, to));
      if (!metrics) throw new Error('replay results[0] empty');
    } catch (e) {
      console.error(`ERROR: ${e.message}`);
      process.exit(4);
    }
  }

  const out = scan.buildStaging({
    modeInfo, cfg, asof: opts.asof, currency,
    decision: decide, metrics, equity, replayErr,
    engineLabel: 'dtx (systematic-tss) — MCP', engineMode: 'mcp', t0,
  });

  // POINT-IN-TIME (idea #8) : --pit → écrit dans data/dtx/<id>@<asof>.json (entrée dédiée par as-of)
  // pour qu'un replay de RÉTRO n'écrase JAMAIS la staging LIVE du mode (data/dtx/<id>.json), et
  // réciproquement. Sans --pit → chemin live inchangé (pipeline nocturne intact). --out prime toujours.
  const outPath = opts.out || scan.stagingPathFor(modeInfo.id, { asof: opts.asof, pit: opts.pit });

  // ── ⛔ ANTI-GEL (frozen-orders) — tripwire de régression (root cause corrigée côté MCP le 21/07/2026) ──
  // Bug 09→21/07 : DtxDecide renvoyait des CREATE FIGÉS à J-9, ré-ingérés en silence chaque soir. Les
  // contrôles de fraîcheur portaient sur les ENTRÉES (prix/NaN/stale >48h), JAMAIS sur la SORTIE du
  // moteur : un 200 OK au corps gelé passait tous les gardes. Ici on confronte la sortie à l'asof demandé
  // AVANT d'écrire. Contrairement à metricsSuspect (écrit-puis-exit-7), un batch figé NE DOIT PAS être
  // écrit — sinon dtx-pool-bridge le transforme en dtx_pool et le sweep tracke des trades fantômes.
  const frozenReasons = [];
  // (a) Date de calcul stampée par le moteur ≠ CLÔTURE ATTENDUE.
  //
  // CORRIGÉ LE 2026-09-06. La garde comparait la date de calcul du moteur à `--asof`, c'est-à-dire
  // à la SÉANCE pour laquelle la décision est prise. Sous le Contrat V2 ces deux dates diffèrent
  // toujours : le moteur calcule sur la dernière clôture complétée (D) une décision valable pour
  // la séance suivante (D+1) — la réponse du 2026-09-06 portait requested_asof 2026-09-04 et un
  // execution_plan valide de 2026-09-08T13:30Z à 19:55Z. La garde rejetait donc systématiquement
  // l'ingestion dès qu'on lui passait la bonne séance, et le pont dtx-pool-bridge, qui exige lui
  // que le staging porte la date de SÉANCE, ne pouvait jamais être satisfait en même temps. Les
  // deux outils se contredisaient : aucune valeur de `--asof` ne les satisfaisait tous les deux.
  //
  // La comparaison correcte est avec `--expected-close`. Elle conserve l'intention d'origine —
  // détecter un corps gelé venu d'une autre séance — et la renforce, puisqu'elle vérifie
  // désormais que le moteur a bien calculé sur la clôture qu'on lui a demandée.
  const computedDate = extractComputedDate(decide);
  const expectedComputed = opts.expectedClose || opts.asof;
  if (computedDate && computedDate !== expectedComputed) {
    frozenReasons.push(`date de calcul moteur ${computedDate} ≠ clôture attendue ${expectedComputed} (réponse d'une autre séance)`);
  }
  // (b) Batch CREATE byte-identique au staging d'une séance DIFFÉRENTE = figé (prix/order_id/reason=Score
  //     varient chaque jour → un batch NON VIDE identique sur deux asof distincts n'a pas été recalculé).
  //     N'affecte NI un premier run (pas de précédent) NI un re-run du même asof (prior.asof === asof, ex. --pit).
  if (Array.isArray(out.orders) && out.orders.length > 0 && fs.existsSync(outPath)) {
    let prior = null;
    try { prior = JSON.parse(fs.readFileSync(outPath, 'utf8')); } catch (_) { prior = null; }
    if (prior && prior.asof && prior.asof !== opts.asof && Array.isArray(prior.orders)
        && JSON.stringify(prior.orders) === JSON.stringify(out.orders)) {
      // V2 can legitimately emit the same economic orders for the next session when
      // both decisions consume the same completed close (Friday -> Monday is the
      // common case). Stable prices are not proof of a frozen engine if the response
      // carries a fresh idempotent call and a new, valid execution plan for --asof.
      const plan = decide.execution_plan || {};
      const validFrom = Date.parse(plan.valid_from || '');
      const validUntil = Date.parse(plan.valid_until || '');
      const v2RecalculationProof = decide.contract_version === '2.0'
        && decide.requested_asof === opts.asof
        && decide.data_asof === decide.expected_data_date
        && decide.data_asof <= opts.asof
        && decide.request_id && decide.run_id && decide.call_id && plan.plan_id
        && Number.isFinite(validFrom) && Number.isFinite(validUntil) && validUntil > validFrom;
      if (v2RecalculationProof) {
        console.log(`  [${modeInfo.id}] batch économique inchangé vs ${prior.asof}, mais recalcul V2 prouvé par request/run/call/plan + fenêtre ${plan.valid_from}→${plan.valid_until}`);
      } else {
        frozenReasons.push(`batch CREATE (${out.orders.length} ordres) byte-identique au staging du ${prior.asof} sans preuve V2 complète de recalcul — réponse potentiellement figée pour ${opts.asof}`);
      }
    }
  }
  if (frozenReasons.length) {
    console.error(`⛔ [${modeInfo.id}] DECIDE FIGÉ — staging NON écrit (anti-gel), séance ${opts.asof} :`);
    for (const r of frozenReasons) console.error(`     • ${r}`);
    console.error(`   → Le MCP dtx doit RECALCULER pour cette séance. Re-appeler DtxDecide(${cfg.id}, asof=${opts.asof}) puis ré-ingérer.`);
    console.error(`     Staging précédent CONSERVÉ = stale → Step 4d / qa-check le remontent ; ALERTER Telegram 'alerts'. JAMAIS ingérer un batch figé en silence.`);
    process.exit(8);
  }

  scan.writeStaging(out, outPath);

  if (!opts.quiet) {
    console.log(`  [${modeInfo.id}] MCP ${currency} | orders(CREATE)=${out.orders.length}`);
    if (metrics) console.log(`    replay ${metrics.from}→${metrics.to}: cagr=${metrics.cagr_pct} dd=${metrics.max_dd_pct} sharpe=${metrics.sharpe} trades=${metrics.total_trades} wr=${metrics.win_rate}`);
    else if (replayErr) console.log(`    replay SKIPPED/ERROR: ${replayErr}`);
    console.log(`    → ${path.relative(scan.REPO_ROOT, outPath)} (${out.tookMs}ms)`);
  }

  // DETERMINISTIC SANITY GATE — a corrupt/param-drifted replay (2026-07-09 incident: DD-89.6%,
  // 2-8× trade blowup) is caught HERE, at ingest, before the number can reach the status page.
  // The staging is still written (metricsSuspect:true + _sanityWarning[…]) so the corruption is
  // auditable and qa-check.js fails loud on it — but we exit NON-ZERO so the calling routine sees
  // the failure, ALERTS Telegram (alias 'alerts'), and does NOT publish this mode's metrics.
  if (out.metricsSuspect) {
    console.error(`⛔ [${modeInfo.id}] REPLAY SUSPECT — métriques hors bornes de sanité (staging marqué metricsSuspect:true, NON publiable) :`);
    for (const w of out._sanityWarning) console.error(`     • ${w}`);
    console.error(`   → Le MCP dtx est sain (vérifié). Un replay aberrant = param drift / job result corrompu au run.`);
    console.error(`     Re-appeler DtxReplay(${cfg.id}, from=2021-01-01, to=<J-1 ou 2026-07-06>), re-vérifier trades vs baseline, PUIS ré-ingérer.`);
    console.error(`     ALERTER Telegram 'alerts' + NE PAS publier les métriques de ce mode.`);
    process.exitCode = 7;
  }
  return out;
}

if (require.main === module) main();

module.exports = { main };
