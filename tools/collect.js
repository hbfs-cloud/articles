#!/usr/bin/env node
'use strict';
/**
 * collect — collecteur MCP déclaratif, piloté par manifeste.
 *
 * Remplace les « salves MCP » que l'agent jouait à la main. Le skill déclare CE
 * QU'IL VEUT dans un manifeste ; ce script l'exécute vague par vague, en
 * parallèle dans chaque vague, sans aucun aller-retour de modèle.
 *
 *   node tools/collect.js --plan plans/weekly.json --out weekly/20260810/_data
 *
 * Sorties :
 *   <out>/<as>.json          une par appel réussi
 *   <out>/_collect.json      journal complet (durées, échecs, appels rejoués)
 *   <out>/harness.json       manifeste de fraîcheur prêt pour check-freshness.js
 *
 * ── Ce que ce script REND AU LLM ────────────────────────────────────────────
 * Rien qu'il puisse calculer lui-même. Le LLM déclare le besoin et lit le
 * résultat ; il ne transporte plus la donnée. Le manifeste de fraîcheur, qui
 * était rédigé à la main (et donc faux dès qu'on oubliait une source), devient
 * un sous-produit mécanique de la collecte.
 *
 * ── Format du manifeste ─────────────────────────────────────────────────────
 * {
 *   "artifact": "weekly/20260810/index.html",
 *   "reference_date": "2026-08-07",        // contrat de date, propagé en end_date
 *   "waves": [
 *     { "name": "marche",
 *       "calls": [
 *         { "as": "regime", "server": "marketdata", "tool": "GetMarketContext",
 *           "args": { "facets": "regime,prediction_markets" },
 *           "freshness": { "max_age_h": 6, "required": true } },
 *         { "as": "bars_indices", "server": "marketdata", "tool": "QueryData",
 *           "args": { "types": "bars_daily", "symbols": "SPY,QQQ,IWM", "end_date": "$refdate" },
 *           "freshness": { "max_age_h": 24, "required": true } }
 *       ] },
 *     { "name": "par-ticker",
 *       "from": "bars_indices",              // vague dépendante : barrière avant exécution
 *       "calls": [ ... ] }
 *   ]
 * }
 *
 * `$refdate` dans n'importe quel argument est remplacé par reference_date : le
 * contrat de date devient structurel au lieu d'être rappelé dans un prompt.
 */

const fs = require('fs');
const path = require('path');
const { callTool, callMany, awaitJob, canCallDirectly, McpAuthError } = require('./lib/mcp-client');

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const has = (n) => process.argv.includes(n);

const planPath = arg('--plan');
const outDir = arg('--out');
const dryRun = has('--dry-run');
const quiet = has('--quiet');

if (!planPath || !outDir) {
  console.error('Usage: node tools/collect.js --plan <manifeste.json> --out <dossier> [--dry-run]');
  process.exit(2);
}

const log = (...a) => { if (!quiet) console.log(...a); };

function substitute(value, refdate) {
  if (typeof value === 'string') return refdate ? value.replace(/\$refdate/g, refdate) : value;
  if (Array.isArray(value)) return value.map(v => substitute(v, refdate));
  if (value && typeof value === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(value)) o[k] = substitute(v, refdate);
    return o;
  }
  return value;
}

/** Un appel async renvoie {job_id,status:'pending'} → on poll jusqu'au bout. */
async function resolveAsync(server, value) {
  if (!value || typeof value !== 'object') return value;
  const jobId = value.job_id || (value.data && value.data.job_id);
  const status = value.status || (value.data && value.data.status);
  if (!jobId || (status !== 'pending' && status !== 'running' && status !== 'async_pending')) return value;
  const pollTool = server === 'systematic' ? 'DtxJobStatus' : 'Jobs';
  return awaitJob(server, jobId, { pollTool });
}

(async function main() {
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const refdate = plan.reference_date || null;
  const waves = plan.waves || [];
  const totalCalls = waves.reduce((n, w) => n + (w.calls || []).length, 0);

  if (dryRun) {
    log(`[collect] ${path.basename(planPath)} — ${waves.length} vague(s), ${totalCalls} appel(s), date de référence ${refdate || '(aucune)'}`);
    for (const w of waves) for (const c of w.calls || []) {
      log(`  ${w.name.padEnd(14)} ${c.as.padEnd(22)} ${c.server}.${c.tool}`);
    }
    process.exit(0);
  }

  if (!canCallDirectly()) {
    console.error(
      "[collect] Pas de jeton MCP utilisable — collecte directe impossible.\n" +
      "  L'AGENT doit obtenir un jeton à TTL court et relancer avec MCP_ACCESS_TOKEN positionné.\n" +
      "  Le chemin historique (agent → JSON de staging → --ingest) reste disponible et n'est pas cassé."
    );
    process.exit(3);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const startedAt = new Date().toISOString();
  const journal = { plan: planPath, artifact: plan.artifact || null, reference_date: refdate, started_at: startedAt, waves: [] };
  const sources = [];
  let failures = 0;

  for (const wave of waves) {
    const calls = (wave.calls || []).map(c => ({ ...c, args: substitute(c.args || {}, refdate) }));
    if (!calls.length) continue;
    const t0 = Date.now();
    log(`[collect] vague « ${wave.name} » — ${calls.length} appel(s) en parallèle`);

    let results;
    try {
      results = await callMany(calls, {
        onResult: (r) => log(`   ${r.ok ? '✓' : '✗'} ${r.as} (${r.ms}ms)${r.ok ? '' : ' — ' + r.error}`),
      });
    } catch (e) {
      if (e instanceof McpAuthError) { console.error(`[collect] ${e.message}`); process.exit(3); }
      throw e;
    }

    // résolution des jobs async, elle aussi en parallèle
    await Promise.all(results.map(async (r, i) => {
      if (!r.ok) return;
      try { r.value = await resolveAsync(calls[i].server, r.value); }
      catch (e) { r.ok = false; r.error = `job async : ${e.message}`; }
    }));

    const waveLog = { name: wave.name, ms: Date.now() - t0, calls: [] };
    for (let i = 0; i < results.length; i++) {
      const r = results[i], c = calls[i];
      waveLog.calls.push({ as: r.as, server: c.server, tool: c.tool, ok: r.ok, ms: r.ms, error: r.error || null });
      if (!r.ok) { failures++; continue; }
      fs.writeFileSync(path.join(outDir, `${r.as}.json`), JSON.stringify(r.value, null, 2));
      if (c.freshness) {
        sources.push({
          name: r.as,
          as_of: new Date().toISOString(),
          max_age_h: c.freshness.max_age_h,
          required: c.freshness.required !== false,
          note: c.freshness.note || `${c.server}.${c.tool}${refdate ? ` (date de référence ${refdate})` : ''}`,
        });
      }
    }
    journal.waves.push(waveLog);
    log(`[collect] vague « ${wave.name} » terminée en ${waveLog.ms}ms`);
  }

  journal.finished_at = new Date().toISOString();
  journal.failures = failures;
  fs.writeFileSync(path.join(outDir, '_collect.json'), JSON.stringify(journal, null, 2));

  if (sources.length) {
    const harness = { artifact: plan.artifact || null, reference_close: refdate, sources };
    fs.writeFileSync(path.join(outDir, 'harness.json'), JSON.stringify(harness, null, 2));
    log(`[collect] manifeste de fraîcheur écrit — ${sources.length} source(s) datée(s)`);
  }

  const wall = Date.parse(journal.finished_at) - Date.parse(startedAt);
  log(`[collect] ${totalCalls - failures}/${totalCalls} appel(s) en ${wall}ms — ${failures} échec(s)`);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('[collect]', e.stack || e.message); process.exit(1); });
