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
const dryRun = has('--dry-run');
const quiet = has('--quiet');
const tokenStdin = has('--token-stdin');
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
 * Lecture du jeton sur stdin — chemin PRÉFÉRÉ.
 * Un jeton passé en argv est visible dans `ps` pour tout utilisateur de la
 * machine ; passé par un préfixe d'environnement il ne l'est pas, mais il reste
 * dans la ligne de commande que la plupart des harnais journalisent. Stdin ne
 * laisse de trace ni dans l'un ni dans l'autre.
 *   printf '%s' "$TOKEN" | node tools/collect.js --plan … --token-stdin
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

if (!planPath || !outDir) {
  console.error('Usage: node tools/collect.js --plan <manifeste.json> --out <dossier> [--dry-run]');
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
 * Une vague parallèle dure le temps de son appel LE PLUS LENT. Sur le vivier
 * scanner, screen_eu prend 87 s et fixe à lui seul la durée des 13 appels. Or un
 * screener européen ne change pas d'une heure à l'autre : le rejouer à chaque run
 * paie 87 s pour un résultat identique.
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

function socleRead(c) {
  for (const { dir, index } of SOCLES) {
    const e = index.entries && index.entries[c.as];
    if (!e) continue;
    if (e.server !== c.server || e.tool !== c.tool) continue;
    const ageMin = (Date.now() - Date.parse(e.as_of)) / 60000;
    const maxH = (c.freshness && c.freshness.max_age_h) || 24;
    if (!(ageMin >= 0) || ageMin / 60 > maxH) continue;   // trop vieux POUR CE consommateur
    try { return { value: JSON.parse(fs.readFileSync(path.join(dir, e.file), 'utf8')), ageMin, as_of: e.as_of }; }
    catch { continue; }
  }
  return null;
}

(async function main() {
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const refdate = cliVars.refdate || plan.reference_date || null;
  const vars = { ...(plan.vars || {}), ...cliVars, ...(refdate ? { refdate } : {}) };
  const waves = plan.waves || [];
  const totalCalls = waves.reduce((n, w) => n + (w.calls || []).length, 0);

  if (dryRun) {
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
    const t = readTokenFromStdin();
    if (!t) { console.error('[collect] --token-stdin demandé mais stdin est vide.'); process.exit(3); }
    process.env.MCP_ACCESS_TOKEN = t;
  }

  const neededServers = [...new Set(waves.flatMap(w => (w.calls || []).map(c => c.server)))];
  const missing = neededServers.filter(s => !canCallDirectly(s));
  if (missing.length) {
    console.error(
      `[collect] Aucun jeton utilisable pour : ${missing.join(", ")} — collecte directe impossible.\n` +
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

  // Une vague parallèle dure le temps de son appel LE PLUS LENT. Or les plus lents
  // sont souvent les moins gouvernants : sur l'enrichissement scanner, la médiane
  // est à 9 s et le plafond à 97 s, fixé par les seuls appels de flux (dark_pool,
  // unusual_options, sentiment) — qui COLORENT une sélection sans la gouverner.
  // Une vague marquée "detached": true tourne donc en dernier, sous délai, et son
  // absence n'échoue JAMAIS le run : les données gouvernantes ne l'attendent pas.
  const critiques = waves.filter(w => !w.detached);
  const detachees = waves.filter(w => w.detached);
  for (const wave of [...critiques, ...detachees]) {
    const estDetachee = !!wave.detached;
    const calls = (wave.calls || []).map(c => ({ ...c, args: substitute(c.args || {}, vars) }));
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
      if (budget) for (const c of toCall) c.timeoutMs = Math.min(c.timeoutMs || budget, budget);
      const salve = callMany(toCall, {
        onResult: (r) => log(`   ${r.ok ? '✓' : '✗'} ${r.as} (${r.ms}ms)${r.ok ? '' : ' — ' + r.error}`),
      });
      results = budget
        ? await Promise.race([salve, new Promise(res => setTimeout(() => res(
            toCall.map(c => ({ as: c.as, ok: false, error: `délai détaché ${budget}ms dépassé`, ms: budget }))), budget))])
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

    const waveLog = { name: wave.name, ms: Date.now() - t0, calls: [] };
    for (let i = 0; i < results.length; i++) {
      const r = results[i], c = calls[i];
      waveLog.calls.push({ as: r.as, server: c.server, tool: c.tool, ok: r.ok, ms: r.ms, wait_ms: r.waitMs || 0, error: r.error || null });
      if (!r.ok) {
        if (estDetachee) { log(`   ~ ${r.as} indisponible — vague détachée, non bloquant`); continue; }
        failures++; continue;
      }
      fs.writeFileSync(path.join(outDir, `${r.as}.json`), JSON.stringify(r.value, null, 2));
      if (!r.fromCache) cacheWrite(c, r.value);
      if (c.freshness) {
        sources.push({
          name: r.as,
          as_of: r.asOf || new Date().toISOString(),
          max_age_h: c.freshness.max_age_h,
          required: c.freshness.required !== false,
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
  }

  journal.finished_at = new Date().toISOString();
  journal.failures = failures;
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
        };
      }
    }
    fs.writeFileSync(path.join(outDir, '_socle.json'),
      JSON.stringify({ reference_date: refdate, generated_at: journal.finished_at, entries }, null, 2));
    log(`[collect] index de socle écrit — ${Object.keys(entries).length} nom(s) de source couverts`);
  }

  if (sources.length) {
    const harness = { artifact: plan.artifact || null, reference_close: refdate, sources };
    fs.writeFileSync(path.join(outDir, 'harness.json'), JSON.stringify(harness, null, 2));
    log(`[collect] manifeste de fraîcheur écrit — ${sources.length} source(s) datée(s)`);
  }

  const wall = Date.parse(journal.finished_at) - Date.parse(startedAt);
  log(`[collect] ${totalCalls - failures}/${totalCalls} appel(s) en ${wall}ms — ${failures} échec(s)`);
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
