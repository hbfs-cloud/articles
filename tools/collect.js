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
const { validateDtxDecision, validateDtxReplay } = require('./lib/dtx-content-gates');
const workflowContract = require('./lib/workflow-contract');
const { isUSTradingDay, previousUSTradingDay } = require('./lib/market-calendar');

const CURRENT_ONLY_TOOLS = new Set(['GetMarketContext', 'GetEarningsCalendarFiltered', 'GetInsiderActivity', 'OptionsAnalytics']);
function latestCompletedUSClose(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const afterClose = Number(parts.hour) > 16 || (Number(parts.hour) === 16 && Number(parts.minute) >= 0);
  return isUSTradingDay(date) && afterClose ? date : previousUSTradingDay(date);
}

/**
 * Date la plus récente RÉELLEMENT PRÉSENTE dans une charge utile, bornée à aujourd'hui.
 *
 * Balaie les dates ISO du JSON sérialisé et rend la plus grande qui ne soit pas dans le futur.
 * Le bornage est essentiel : un calendrier économique ou un calendrier de résultats porte des
 * dates À VENIR, et sans borne c'est l'une d'elles qui sortirait — la garde certifierait alors
 * une fraîcheur puisée dans le futur.
 *
 * Volontairement générique et sans schéma : les charges utiles n'ont pas de forme commune, et une
 * extraction par chemin (`results[].data[].bars`) casserait au premier outil qui change de forme —
 * en rendant `null`, donc en désarmant la garde, ce qui est le pire mode de panne possible.
 * `null` signifie « aucune date lisible », jamais « à jour ».
 */
function maxObservedDate(value) {
  let s;
  try { s = JSON.stringify(value); } catch (_) { return null; }
  if (!s) return null;
  const today = new Date().toISOString().slice(0, 10);
  let best = null;
  const re = /\d{4}-\d{2}-\d{2}/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const d = m[0];
    if (d > today) continue;          // borne : jamais une date future
    if (d < '2000-01-01') continue;   // garde-fou anti-faux positif
    if (best === null || d > best) best = d;
  }
  return best;
}

/** Date de marché maximale portée par une série OHLCV, sans confondre fetchedAt. */
function maxBarDate(value) {
  let best = null;
  const visit = (node, inBars = false) => {
    if (Array.isArray(node)) {
      if (inBars) {
        for (const row of node) {
          const raw = Array.isArray(row) ? row[0]
            : row && typeof row === 'object' ? (row.date || row.time || row.timestamp) : row;
          const match = String(raw || '').match(/\d{4}-\d{2}-\d{2}/);
          if (match && (!best || match[0] > best)) best = match[0];
        }
      }
      for (const item of node) visit(item, inBars);
      return;
    }
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node)) visit(child, inBars || key === 'bars');
  };
  visit(value);
  return best;
}

function findScalarByKey(value, key) {
  if (!value || typeof value !== 'object') return null;
  if (Object.prototype.hasOwnProperty.call(value, key) && value[key] != null) return value[key];
  for (const child of Object.values(value)) {
    const found = findScalarByKey(child, key);
    if (found != null) return found;
  }
  return null;
}

function semanticFailure(call, value) {
  if (!call || !value || typeof value !== 'object') return null;
  if (call.server === 'marketdata' && call.tool === 'GetStatus') {
    const payload = value.result && typeof value.result === 'object' ? value.result : value;
    const health = payload.health && typeof payload.health === 'object' ? payload.health : payload;
    const state = String(health.status || health.state || '').toLowerCase();
    if (health.ok === false || health.healthy === false || /down|error|unavailable|degraded/.test(state)) {
      return `marketdata GetStatus unhealthy (${state || 'ok=false'})`;
    }
    const expectedClose = call.assert && call.assert.expected_close;
    if (expectedClose) {
      const actualClose = String(findScalarByKey(value, 'bar_service_1d_max_last_bar_date') || '');
      if (!actualClose) return 'marketdata GetStatus missing bar_service_1d_max_last_bar_date';
      if (actualClose !== expectedClose) {
        return `marketdata GetStatus close mismatch (expected ${expectedClose}, got ${actualClose})`;
      }
    }
    const coveredClose = call.assert && call.assert.covers_close;
    if (coveredClose) {
      const actualClose = String(findScalarByKey(value, 'bar_service_1d_max_last_bar_date') || '');
      if (!actualClose) return 'marketdata GetStatus missing bar_service_1d_max_last_bar_date';
      if (actualClose < coveredClose) {
        return `marketdata GetStatus does not cover historical close (required ${coveredClose}, got ${actualClose})`;
      }
    }
    return null;
  }
  if (call.server !== 'systematic') return null;
  const payload = value.result && typeof value.result === 'object' ? value.result : value;
  const status = payload.status || value.status;
  if (call.tool === 'GetHealth') {
    if (payload.ok === false) return 'systematic GetHealth ok=false';
    if (payload.freshness_ok === false) return 'systematic GetHealth freshness_ok=false';
    if (payload.behind_expected === true) return 'systematic GetHealth behind_expected=true';
  }
  if (status === 'stale_data' || status === 'data_date_mismatch') {
    return `systematic ${call.tool} ${status}`;
  }
  if (call.tool === 'DtxListConfigs') {
    const configs = Array.isArray(payload) ? payload
      : Array.isArray(payload.configs) ? payload.configs
        : Array.isArray(payload.data) ? payload.data : null;
    if (!configs || configs.length === 0) return 'systematic DtxListConfigs returned no deployed config';
    const requiredPortfolio = call.assert && call.assert.contains_portfolio;
    if (requiredPortfolio && !configs.some(c => c && (c.id === requiredPortfolio || c.file === requiredPortfolio))) {
      return `systematic DtxListConfigs does not contain required portfolio ${requiredPortfolio}`;
    }
  }
  if (call.tool === 'DtxDecide') {
    const errors = validateDtxDecision(value, {
      asof: call.args && call.args.asof,
      requestId: call.args && call.args.request_id,
      referenceClose: call.args && call.args.expected_data_date,
    });
    if (errors.length) return `systematic DtxDecide contract rejected: ${errors.join('; ')}`;
  }
  if (call.tool === 'DtxReplay') {
    const errors = validateDtxReplay(value, {
      portfolio: call.args && call.args.portfolio,
      referenceClose: call.args && call.args.to,
    });
    if (errors.length) return `systematic DtxReplay contract rejected: ${errors.join('; ')}`;
  }
  if (payload.behind_expected === true) return `systematic ${call.tool} behind_expected=true`;
  return null;
}

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const has = (n) => process.argv.includes(n);

const planPath = arg('--plan');
const outDir = arg('--out');
// --socle <dir>[:<dir>…] : réutiliser les sources déjà collectées par le socle de
// la séance au lieu de les rappeler. Optionnel et strictement additif — sans ce
// drapeau, le comportement historique est inchangé.
// La variable d'environnement COLLECT_SOCLE_DIR fait la même chose, et c'est elle
// qui compte : elle atteint les collect.js lancés par des scripts qu'on ne veut
// pas modifier (scan-parallel.sh notamment). Plusieurs dossiers parce que le
// socle rapide et la chaîne overview détachée n'écrivent pas au même endroit —
// et surtout pas dans le même index, sinon la seconde écrase la première.
const socleDirs = (arg('--socle', process.env.COLLECT_SOCLE_DIR || '') || '')
  .split(':').map(s => s.trim()).filter(Boolean);
if (has('--dry-run')) {
  console.error('[collect] --dry-run est ambigu et n\'exécute pas la collecte. Utiliser --plan-only pour inspecter le plan; les workflows gardent --dry-run pour un run local complet sans effets externes.');
  process.exit(2);
}
const planOnly = has('--plan-only');
const quiet = has('--quiet');
const allowArchived = has('--allow-archived');
const tokenStdin = has('--token-stdin');
const tokenBundleStdin = has('--token-bundle-stdin');
if (tokenStdin && tokenBundleStdin) {
  console.error('[collect] choisir --token-stdin OU --token-bundle-stdin, jamais les deux.');
  process.exit(2);
}
const varsFile = arg('--vars-file');
const cliVars = {};
if (varsFile) Object.assign(cliVars, JSON.parse(require('fs').readFileSync(varsFile, 'utf8')));
process.argv.forEach((a, i) => {
  if (a === '--var' && process.argv[i + 1]) {
    const eq = process.argv[i + 1].indexOf('=');
    if (eq > 0) cliVars[process.argv[i + 1].slice(0, eq)] = process.argv[i + 1].slice(eq + 1);
  }
});

/**
 * Lecture d'un jeton serveur unique ou d'un bundle JSON sur stdin.
 * Un jeton passé en argv est visible dans `ps` pour tout utilisateur de la
 * machine ; passé par un préfixe d'environnement il ne l'est pas, mais il reste
 * dans la ligne de commande que la plupart des harnais journalisent. Stdin ne
 * laisse de trace ni dans l'un ni dans l'autre.
 * Le secret manager du runner écrit sur stdin ; aucune valeur ne passe en argv.
 */
function readTokenFromStdin() {
  const fd = 0;
  const chunks = [];
  const buf = Buffer.alloc(65536);
  for (;;) {
    let n;
    try { n = fs.readSync(fd, buf, 0, buf.length, null); }
    catch (e) { if (e.code === 'EAGAIN') continue; if (e.code === 'EOF') break; throw e; }
    if (!n) break;
    chunks.push(Buffer.from(buf.slice(0, n)));
  }
  return Buffer.concat(chunks).toString('utf8').trim();
}

function installTokenBundle(raw) {
  let bundle;
  try { bundle = JSON.parse(raw); }
  catch { throw new Error('--token-bundle-stdin attend un objet JSON valide'); }
  const allowed = new Set(['marketdata', 'systematic']);
  for (const [server, config] of Object.entries(bundle || {})) {
    if (!allowed.has(server)) throw new Error(`serveur inconnu dans le bundle de jetons: ${server}`);
    const entry = typeof config === 'string' ? { token: config } : config;
    if (!entry || typeof entry.token !== 'string' || !entry.token.trim()) throw new Error(`jeton ${server} absent du bundle`);
    const upper = server.toUpperCase();
    process.env[`MCP_TOKEN_${upper}`] = entry.token.trim();
    if (entry.expires_at) process.env[`MCP_TOKEN_${upper}_EXPIRES_AT`] = String(entry.expires_at);
  }
}

if (!planPath || !outDir) {
  console.error('Usage: node tools/collect.js --plan <manifeste.json> --out <dossier> [--plan-only]');
  process.exit(2);
}

const log = (...a) => { if (!quiet) console.log(...a); };

/**
 * Substitution de variables dans les arguments : $refdate, plus tout ce qui est
 * passé en --var nom=valeur. Un plan devient ainsi réutilisable — le même
 * plans/analyse.json sert pour n'importe quel ticker sans réécriture, et le
 * contrat de date reste structurel.
 * Une variable référencée mais non fournie est une ERREUR : substituer par vide
 * produirait un appel silencieusement faux (un end_date absent = « le monde
 * d'aujourd'hui » au lieu de la date visée).
 */
function substitute(value, vars) {
  if (typeof value === 'string') {
    return value.replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g, (m, name) => {
      if (!(name in vars)) throw new Error(`Variable $${name} référencée par le plan mais non fournie (--var ${name}=…)`);
      return vars[name];
    });
  }
  if (Array.isArray(value)) return value.map(v => substitute(v, vars));
  if (value && typeof value === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(value)) o[k] = substitute(v, vars);
    return o;
  }
  return value;
}

function expandCalls(wave, vars) {
  const expanded = [];
  for (const declaration of wave.calls || []) {
    if (!declaration.foreach) {
      expanded.push({
        ...declaration,
        args: substitute(declaration.args || {}, vars),
        ...(declaration.assert ? { assert: substitute(declaration.assert, vars) } : {}),
      });
      continue;
    }
    const cfg = declaration.foreach;
    const raw = vars[cfg.var];
    if (raw == null) throw new Error(`${declaration.as}: variable foreach $${cfg.var} absente`);
    const items = [...new Set(String(raw).split(cfg.separator || ',').map(x => x.trim()).filter(Boolean))];
    if (!items.length) throw new Error(`${declaration.as}: foreach $${cfg.var} ne contient aucun élément`);
    if (items.length > cfg.max) throw new Error(`${declaration.as}: foreach contient ${items.length} éléments, maximum explicite ${cfg.max}`);
    for (const item of items) {
      const suffix = item.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      if (!suffix) throw new Error(`${declaration.as}: élément foreach inutilisable`);
      expanded.push({
        ...declaration,
        foreach: undefined,
        as: `${declaration.as}_${suffix}`,
        args: substitute(declaration.args || {}, { ...vars, item }),
        ...(declaration.assert ? { assert: substitute(declaration.assert, { ...vars, item }) } : {}),
      });
    }
  }
  return expanded;
}

/** Un appel async renvoie {job_id,status:'pending'} → on poll jusqu'au bout. */
async function resolveAsync(server, value, maxMs) {
  if (!value || typeof value !== 'object') return value;
  const jobId = value.job_id || (value.data && value.data.job_id);
  const status = value.status || (value.data && value.data.status);
  if (!jobId || (status !== 'pending' && status !== 'running' && status !== 'async_pending')) return value;
  const pollTool = server === 'systematic' ? 'DtxJobStatus' : 'Jobs';
  // Les books multi-poches (book_honest, hvep, best) rejouent 4 stratégies :
  // 300 s ne suffisent pas. Plafond réglable par appel via job_max_ms.
  return awaitJob(server, jobId, { pollTool, maxMs: maxMs || 300_000 });
}


/**
 * Cache court par appel — `"cache_minutes": N` dans le manifeste.
 *
 * Une vague parallèle dure le temps de son appel LE PLUS LENT. Les appels de
 * contexte et les référentiels changent moins vite que les cotations : les rejouer
 * à chaque retry paie leur latence pour un résultat identique.
 *
 * La clé inclut l'outil ET les arguments substitués : changer une expression DSL
 * ou une date de référence invalide le cache automatiquement. Pas de faux positif
 * possible sur un plan modifié.
 *
 * ⛔ N'utiliser QUE sur des appels dont la péremption est sans conséquence
 * (screeners, référentiels). JAMAIS sur un prix, un régime ou un calendrier :
 * le manifeste de fraîcheur cesserait de dire la vérité.
 */
const CACHE_DIR = 'data/collect-cache';
function cacheKey(c) {
  return require('crypto').createHash('sha256')
    .update(`${c.server}|${c.tool}|${JSON.stringify(c.args || {})}`).digest('hex').slice(0, 24);
}
function cacheRead(c) {
  if (!c.cache_minutes) return null;
  try {
    const f = path.join(CACHE_DIR, cacheKey(c) + '.json');
    const st = fs.statSync(f);
    const ageMin = (Date.now() - st.mtimeMs) / 60000;
    if (ageMin > c.cache_minutes) return null;
    return { value: JSON.parse(fs.readFileSync(f, 'utf8')), ageMin };
  } catch { return null; }
}
function cacheWrite(c, value) {
  if (!c.cache_minutes) return;
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(path.join(CACHE_DIR, cacheKey(c) + '.json'), JSON.stringify(value));
  } catch { /* le cache n'est jamais critique */ }
}

/**
 * Socle partagé — un appel identique joué une fois pour N produits.
 *
 * Le socle écrit `_socle.json` : un index qui dit, pour chaque nom de source
 * ATTENDU PAR UN CONSOMMATEUR (`covers`), quel fichier le sert, avec quel outil
 * et à quelle heure RÉELLE. Un plan produit lancé avec `--socle <dir>` y pioche
 * au lieu de rappeler.
 *
 * Trois verrous, parce qu'une réutilisation muette est pire qu'un appel de trop :
 *  1. le socle doit DÉCLARER couvrir ce nom — pas d'appariement heuristique ;
 *  2. serveur ET outil doivent coïncider — un GetStatus ne sert pas un QueryData ;
 *  3. l'âge réel doit tenir dans le max_age_h du CONSOMMATEUR, pas dans celui du
 *     socle. Si le consommateur est plus exigeant, il rappelle.
 * Tout écart → appel normal, jamais de dégradation silencieuse.
 */
const SOCLES = socleDirs.map(dir => {
  try { return { dir, index: JSON.parse(fs.readFileSync(path.join(dir, '_socle.json'), 'utf8')) }; }
  catch { console.error(`[collect] socle ${dir} : index absent ou illisible — les appels concernés seront rejoués.`); return null; }
}).filter(Boolean);
let runtimeRefdate = null;

function callArgsSha256(c) {
  return workflowContract.sha256(workflowContract.stableStringify(c.args || {}));
}

function socleRead(c) {
  for (const { dir, index } of SOCLES) {
    if (!runtimeRefdate || index.reference_date !== runtimeRefdate) continue;
    const e = index.entries && index.entries[c.as];
    if (!e) continue;
    if (e.server !== c.server || e.tool !== c.tool) continue;
    if (!e.args_sha256 || e.args_sha256 !== callArgsSha256(c)) continue;
    const ageMin = (Date.now() - Date.parse(e.as_of)) / 60000;
    const maxH = (c.freshness && c.freshness.max_age_h) || 24;
    if (!(ageMin >= 0) || ageMin / 60 > maxH) continue;   // trop vieux POUR CE consommateur
    try { return { value: JSON.parse(fs.readFileSync(path.join(dir, e.file), 'utf8')), ageMin, as_of: e.as_of }; }
    catch { continue; }
  }
  return null;
}

(async function main() {
  const planBytes = fs.readFileSync(planPath);
  const plan = JSON.parse(planBytes.toString('utf8'));
  if (plan.archived === true && !allowArchived) {
    console.error(`[collect] Plan archivé (${plan.snapshot_date || 'date inconnue'}) : ${planPath}. ` +
      'Utiliser le plan actif paramétrique; --allow-archived est réservé à une reproduction forensic explicite.');
    process.exit(2);
  }
  const configured = workflowContract.findPlanSpec(planPath);
  if (configured) {
    const contractErrors = workflowContract.validatePlan(plan, configured.planSpec);
    if (contractErrors.length) {
      console.error(`[collect] Contrat invalide pour ${configured.rel}:`);
      for (const error of contractErrors) console.error(`  - ${error}`);
      process.exit(2);
    }
  }
  const refdate = cliVars.refdate || plan.reference_date || null;
  runtimeRefdate = refdate;
  const vars = { ...(plan.vars || {}), ...cliVars, ...(refdate ? { refdate } : {}) };
  if (configured) {
    const runtimeErrors = workflowContract.validateRuntimeVariables(configured.planSpec, vars);
    if (runtimeErrors.length) throw new Error(`Variables runtime invalides: ${runtimeErrors.join('; ')}`);
  }
  if (refdate && !/^\d{4}-\d{2}-\d{2}$/.test(refdate)) throw new Error(`refdate illisible: ${refdate}`);
  if (refdate && refdate > new Date().toISOString().slice(0, 10)) throw new Error(`refdate future interdite: ${refdate}`);
  const artifact = substitute(plan.artifact || '', vars);
  const waves = (plan.waves || []).map(wave => ({ ...wave, calls: expandCalls(wave, vars) }));
  const latestClose = latestCompletedUSClose();
  const currentOnly = waves.flatMap(wave => wave.calls || []).filter(call => CURRENT_ONLY_TOOLS.has(call.tool));
  if (refdate && refdate !== latestClose && currentOnly.length) {
    throw new Error(`refdate historique ${refdate}: outils current-only interdits (${[...new Set(currentOnly.map(call => call.tool))].join(', ')}); derniere cloture complete ${latestClose}`);
  }
  const aliases = waves.flatMap(w => (w.calls || []).map(c => c.as));
  const duplicateAliases = aliases.filter((name, i) => aliases.indexOf(name) !== i);
  if (duplicateAliases.length) throw new Error(`alias d'appel dupliqué après expansion: ${[...new Set(duplicateAliases)].join(', ')}`);
  const totalCalls = waves.reduce((n, w) => n + (w.calls || []).length, 0);
  const planSha256 = workflowContract.sha256(planBytes);
  const inputSha256 = workflowContract.sha256(workflowContract.stableStringify({ artifact, refdate, waves }));
  const neededServers = [...new Set(waves.flatMap(w => (w.calls || []).map(c => c.server)))];

  if (planOnly) {
    log(`[collect] ${path.basename(planPath)} — ${waves.length} vague(s), ${totalCalls} appel(s), date de référence ${refdate || '(aucune)'}`);
    let served = 0;
    for (const w of waves) for (const c of w.calls || []) {
      // Le dry-run doit dire ce que le socle SERVIRAIT, pas seulement ce que le
      // plan demande. Sans ça, la mutualisation n'était vérifiable qu'en dépensant
      // de vrais appels — donc jamais vérifiée avant de partir en production.
      const soc = socleRead(c);
      if (soc) served++;
      log(`  ${w.name.padEnd(14)} ${c.as.padEnd(22)} ${c.server}.${c.tool}${soc ? `   ♻︎ socle (${soc.ageMin.toFixed(0)} min)` : ''}`);
    }
    if (SOCLES.length) log(`[collect] socle : ${served}/${totalCalls} appel(s) évité(s)`);
    process.exit(0);
  }

  if (tokenStdin) {
    if (neededServers.length !== 1) {
      console.error('[collect] --token-stdin est réservé à un plan mono-serveur; utiliser --token-bundle-stdin.');
      process.exit(3);
    }
    const t = readTokenFromStdin();
    if (!t) { console.error('[collect] --token-stdin demandé mais stdin est vide.'); process.exit(3); }
    process.env.MCP_ACCESS_TOKEN = t;
    process.env.MCP_ACCESS_TOKEN_SERVER = neededServers[0];
  }
  if (tokenBundleStdin) {
    const raw = readTokenFromStdin();
    if (!raw) { console.error('[collect] --token-bundle-stdin demandé mais stdin est vide.'); process.exit(3); }
    installTokenBundle(raw);
  }

  const missing = neededServers.filter(s => !canCallDirectly(s));
  if (missing.length) {
    console.error(
      `[collect] Aucun jeton utilisable pour : ${missing.join(", ")} — collecte directe impossible.\n` +
      "  Émettre un jeton TTL par serveur et l'injecter sans afficher sa valeur.\n" +
      "  Le chemin historique (agent → JSON de staging → --ingest) reste disponible et n'est pas cassé."
    );
    process.exit(3);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const startedAt = new Date().toISOString();
  const journal = {
    contract_version: '1.0',
    workflow: configured ? configured.workflow : null,
    plan: path.relative(workflowContract.ROOT, path.resolve(planPath)).replace(/\\/g, '/'),
    plan_sha256: planSha256,
    input_sha256: inputSha256,
    resolved_input: { artifact, refdate, waves },
    artifact,
    reference_date: refdate,
    started_at: startedAt,
    waves: [],
  };
  const sources = [];
  let failures = 0;

  // Une vague parallèle dure le temps de son appel LE PLUS LENT. Or les plus lents
  // sont souvent les moins gouvernants : sur l'enrichissement scanner, la médiane
  // est à 9 s et le plafond à 97 s, fixé par les seuls appels de flux (dark_pool,
  // unusual_options, sentiment) — qui COLORENT une sélection sans la gouverner.
  // Une vague marquée "detached": true tourne donc en dernier, sous délai, et son
  // absence n'échoue JAMAIS le run : les données gouvernantes ne l'attendent pas.
  const critiques = waves.filter(w => !w.detached);
  const detachees = waves.filter(w => w.detached);
  for (const wave of [...critiques, ...detachees]) {
    const failuresBeforeWave = failures;
    const estDetachee = !!wave.detached;
    const calls = wave.calls || [];
    if (!calls.length) continue;
    const t0 = Date.now();
    log(`[collect] vague « ${wave.name} » — ${calls.length} appel(s) en parallèle`);

    // Servir d'abord ce qui est en cache frais, n'appeler que le reste.
    const cached = new Map();
    const toCall = [];
    for (const c of calls) {
      const soc = socleRead(c);
      if (soc) { cached.set(c.as, { ...soc, fromSocle: true }); log(`   ♻︎ ${c.as} (socle, ${soc.ageMin.toFixed(0)} min)`); continue; }
      const hit = cacheRead(c);
      if (hit) { cached.set(c.as, hit); log(`   ⚡ ${c.as} (cache, ${hit.ageMin.toFixed(0)} min)`); }
      else toCall.push(c);
    }

    let results;
    try {
      // Le délai doit ANNULER les requêtes, pas seulement cesser de les regarder :
      // une promesse en vol garde la boucle d'événements vivante et le process
      // attend quand même. On propage donc le budget en timeoutMs par appel, ce
      // qui déclenche l'AbortController du client.
      const budget = estDetachee ? (wave.deadline_ms || 45_000) : 0;
      // Ne jamais muter le plan résolu après le calcul de input_sha256. Le journal
      // conserve ce plan par référence ; ajouter timeoutMs directement sur les
      // appels rendait ensuite la provenance impossible à vérifier.
      const callsToRun = budget
        ? toCall.map(c => ({ ...c, timeoutMs: Math.min(c.timeoutMs || budget, budget) }))
        : toCall;
      const salve = callMany(callsToRun, {
        onResult: (r) => log(`   ${r.ok ? '✓' : '✗'} ${r.as} (${r.ms}ms)${r.ok ? '' : ' — ' + r.error}`),
      });
      results = budget
        ? await Promise.race([salve, new Promise(res => setTimeout(() => res(
            callsToRun.map(c => ({ as: c.as, ok: false, error: `délai détaché ${budget}ms dépassé`, ms: budget }))), budget))])
        : await salve;
    } catch (e) {
      if (e instanceof McpAuthError) { console.error(`[collect] ${e.message}`); process.exit(3); }
      throw e;
    }

    // résolution des jobs async, elle aussi en parallèle
    // Réinsérer les résultats servis par le cache, dans l'ordre du plan.
    const byAs = new Map(results.map(r => [r.as, r]));
    for (const [as, hit] of cached) byAs.set(as, {
      as, ok: true, value: hit.value, ms: 0, fromCache: true, fromSocle: !!hit.fromSocle,
      // Horodatage RÉEL de la valeur servie. Déclarer « maintenant » pour un
      // screener vieux de 5 h ferait mentir le manifeste de fraîcheur — c'est
      // exactement ce que check-freshness est censé rendre impossible.
      asOf: hit.as_of || new Date(Date.now() - (hit.ageMin || 0) * 60000).toISOString(),
    });
    results = calls.map(c => byAs.get(c.as)).filter(Boolean);

    // Le temps d'un appel async est dominé par l'ATTENTE du job, pas par la
    // soumission. Journaliser seulement la soumission donnait « 0,5 s » sur un
    // screener qui tourne 5 minutes — diagnostic inutilisable.
    await Promise.all(results.map(async (r, i) => {
      if (!r.ok) return;
      const tw = Date.now();
      try { r.value = await resolveAsync(calls[i].server, r.value, calls[i].job_max_ms); }
      catch (e) { r.ok = false; r.error = `job async : ${e.message}`; }
      r.waitMs = Date.now() - tw;
      r.ms += r.waitMs;
    }));

    // ── COUPE-CIRCUIT DE PANNE D'ORIGINE ────────────────────────────────────────────────
    // Le 2026-08-12, le service marketdata est tombé (429 sur la résolution des jobs, puis 502
    // Cloudflare jusque sur GetStatus). La collecte a mis 2 694 s — 45 minutes — à mourir, en
    // continuant à frapper une origine déjà à terre, pour finir par un échec de toute façon.
    // Deux dégâts : 45 minutes perdues, et de la charge ajoutée à un serveur en détresse.
    //
    // Une panne d'origine n'est pas un échec d'appel : elle ne se réessaie pas utilement dans la
    // même salve. Dès que plusieurs appels de la vague remontent un code d'infrastructure, on
    // arrête tout et on le NOMME — « service indisponible » se diagnostique en une seconde, là où
    // « job async : HTTP 429 » a fait accuser un quota qui n'était pas en cause.
    const OUTAGE_RE = /\b(429|502|503|504)\b|bad gateway|service unavailable|origin/i;
    const outage = results.filter(r => !r.ok && OUTAGE_RE.test(String(r.error || '')));
    if (outage.length >= 2 && !estDetachee) {
      const codes = [...new Set(outage.map(r => (String(r.error).match(/\b(429|502|503|504)\b/) || [])[1]).filter(Boolean))];
      console.error(`[collect] ⛔ PANNE D'ORIGINE — ${outage.length} appel(s) de la vague « ${wave.name} » rejetés par l'infrastructure${codes.length ? ` (${codes.join(', ')})` : ''}.`);
      for (const r of outage.slice(0, 4)) console.error(`           ✗ ${r.as} — ${r.error}`);
      console.error(`           Ce n'est ni un quota ni une donnée manquante : le service ne répond pas.`);
      console.error(`           Collecte interrompue — insister ajouterait de la charge à une origine déjà en échec.`);
      journal.outage = { wave: wave.name, count: outage.length, codes, at: new Date().toISOString() };
      journal.finished_at = new Date().toISOString();
      journal.failures = failures + outage.length;
      fs.writeFileSync(path.join(outDir, '_collect.json'), JSON.stringify(journal, null, 2));
      process.exit(4);
    }

    const waveLog = { name: wave.name, ms: Date.now() - t0, calls: [] };
    for (let i = 0; i < results.length; i++) {
      const r = results[i], c = calls[i];
      const semanticError = r.ok ? semanticFailure(c, r.value) : null;
      waveLog.calls.push({
        as: r.as,
        server: c.server,
        tool: c.tool,
        required: c.freshness ? c.freshness.required !== false : true,
        detached: estDetachee,
        ok: r.ok && !semanticError,
        ms: r.ms,
        wait_ms: r.waitMs || 0,
        error: r.error || semanticError || null,
      });
      if (!r.ok) {
        if (estDetachee) { log(`   ~ ${r.as} indisponible — vague détachée, non bloquant`); continue; }
        failures++; continue;
      }
      if (semanticError) {
        if (estDetachee) { log(`   ~ ${r.as} refusé — ${semanticError} (vague détachée, non bloquant)`); continue; }
        log(`   ✗ ${r.as} — ${semanticError}`);
        failures++; continue;
      }
      const sourceBody = JSON.stringify(r.value, null, 2);
      fs.writeFileSync(path.join(outDir, `${r.as}.json`), sourceBody);
      waveLog.calls[i].output_sha256 = workflowContract.sha256(sourceBody);
      if (!r.fromCache) cacheWrite(c, r.value);
      if (c.freshness) {
        sources.push({
          name: r.as,
          sha256: workflowContract.sha256(sourceBody),
          as_of: r.asOf || new Date().toISOString(),
          // SÉANCE RÉELLEMENT DÉCRITE par la charge utile — distincte de l'heure de collecte.
          //
          // POURQUOI (incident du 2026-08-12) : la collecte est partie 9 minutes après la clôture
          // US, juste avant l'ingestion des barres du jour. check-freshness a certifié
          // « 10 sources vérifiées, 0 bloquante(s) », toutes à « 0,0 h », alors que les DIX
          // décrivaient la séance de la VEILLE. Un briefing publié dessus aurait raconté hier en
          // se présentant comme celui du jour, et rien dans le harnais ne l'aurait dit : l'âge de
          // la collecte et la date du contenu sont deux grandeurs différentes, et seule la
          // première était mesurée.
          data_through: c.freshness.expects_close ? maxBarDate(r.value) : maxObservedDate(r.value),
          max_age_h: c.freshness.max_age_h,
          required: c.freshness.required !== false,
          // Opt-in : cette source DOIT atteindre la clôture de référence. Réservé aux séries de
          // marché — un calendrier économique porte des dates futures, un screener une date
          // d'exécution : leur imposer la clôture produirait de faux blocages.
          ...(c.freshness.expects_close ? { expects_close: true, reference_close: refdate || null } : {}),
          // Un socle partagé ne doit PAS devenir un harnais partagé : chaque produit
          // garde SON harness.json, où la source héritée est nommée comme telle.
          // Sinon on ne sait plus, six mois après, quel article s'appuyait sur quoi.
          note: (r.fromSocle ? 'socle partagé — ' : '')
            + (c.freshness.note || `${c.server}.${c.tool}${refdate ? ` (date de référence ${refdate})` : ''}`),
        });
      }
    }
    journal.waves.push(waveLog);
    log(`[collect] vague « ${wave.name} » terminée en ${waveLog.ms}ms`);
    if (wave.gate && failures > failuresBeforeWave) {
      journal.blocked_at_gate = wave.name;
      log(`[collect] gate « ${wave.name} » refusé — aucune vague aval exécutée`);
      break;
    }
  }

  journal.finished_at = new Date().toISOString();
  journal.failures = failures;
  journal.executed_calls = journal.waves.reduce((n, wave) => n + wave.calls.length, 0);
  journal.skipped_calls = totalCalls - journal.executed_calls;
  fs.writeFileSync(path.join(outDir, '_collect.json'), JSON.stringify(journal, null, 2));

  // Index de socle — écrit UNIQUEMENT si le plan se déclare socle. Il ne liste que
  // ce qui a réellement abouti : un appel en échec ne doit pas apparaître comme
  // disponible, sinon le consommateur croirait hériter d'une source qui n'existe pas.
  if (plan.socle) {
    const entries = {};
    for (const w of journal.waves) for (const cl of w.calls) {
      if (!cl.ok) continue;
      const src = sources.find(s => s.name === cl.as);
      const decl = waves.flatMap(x => x.calls || []).find(x => x.as === cl.as);
      if (!decl) continue;   // un appel journalisé sans déclaration = plan modifié en vol, on n'invente pas
      for (const cover of (decl.covers || [decl.as])) {
        entries[cover] = {
          file: `${cl.as}.json`, as: cl.as, server: cl.server, tool: cl.tool,
          as_of: (src && src.as_of) || journal.finished_at,
          max_age_h: (decl.freshness && decl.freshness.max_age_h) || null,
          args_sha256: callArgsSha256(decl),
        };
      }
    }
    fs.writeFileSync(path.join(outDir, '_socle.json'),
      JSON.stringify({ reference_date: refdate, generated_at: journal.finished_at, entries }, null, 2));
    log(`[collect] index de socle écrit — ${Object.keys(entries).length} nom(s) de source couverts`);
  }

  if (sources.length) {
    const harness = {
      contract_version: '1.0',
      workflow: configured ? configured.workflow : null,
      generated_at: journal.finished_at,
      artifact,
      content: artifact.endsWith('/index.html') ? path.dirname(artifact) : artifact,
      reference_close: refdate,
      plan: journal.plan,
      plan_sha256: planSha256,
      input_sha256: inputSha256,
      sources,
    };
    fs.writeFileSync(path.join(outDir, 'harness.json'), JSON.stringify(harness, null, 2));
    log(`[collect] manifeste de fraîcheur écrit — ${sources.length} source(s) datée(s)`);
  }

  const wall = Date.parse(journal.finished_at) - Date.parse(startedAt);
  log(`[collect] ${journal.executed_calls - failures}/${journal.executed_calls} appel(s) exécuté(s) en ${wall}ms — ${failures} échec(s), ${journal.skipped_calls} non lancé(s)`);
  // --quiet supprime la PROGRESSION, jamais la RAISON D'UN ÉCHEC. Sans cette
  // sortie, un appelant qui redirige vers un fichier récupérait un log VIDE avec
  // un code retour 1 : impossible de savoir quel appel a lâché ni pourquoi.
  // Mesuré le 12/08 — trois échecs de scan-parallel sous concurrence, trois logs
  // vides, diagnostic aveugle. Un mode silencieux qui tait aussi les pannes ne
  // rend pas le run discret, il le rend indébogable.
  if (failures) {
    console.error(`[collect] ÉCHEC — ${failures}/${totalCalls} appel(s), plan ${planPath}`);
    for (const w of journal.waves) {
      for (const c of w.calls) {
        if (!c.ok) console.error(`  ✗ ${c.as} (${c.tool}@${c.server}, vague « ${w.name} ») — ${c.error || 'sans message'}`);
      }
    }
  }
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('[collect]', e.stack || e.message); process.exit(1); });
