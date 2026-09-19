'use strict';
/**
 * mcp-client — transport MCP partagé, utilisable DEPUIS UN SUBPROCESS.
 *
 * ┌─ Pourquoi ce fichier existe ────────────────────────────────────────────────┐
 * │ Jusqu'ici l'invariant du repo était : « un subprocess node NE PEUT PAS       │
 * │ appeler le MCP (OAuth2, ZÉRO token) ». Il forçait le pattern                 │
 * │   agent → salves MCP → JSON de staging → script --ingest                     │
 * │ qui met l'agent (donc le LLM) DANS LE CHEMIN DE DONNÉES. C'est la cause      │
 * │ n°1 de lenteur des skills : chaque appel coûte un aller-retour de modèle.    │
 * │                                                                              │
 * │ Avec un token à TTL court délivré par le MCP, l'invariant tombe. Le LLM      │
 * │ obtient UN token en début de run, le passe au script, et se retire du        │
 * │ chemin de données. Il ne garde que ce qu'un script ne peut pas faire :       │
 * │ juger, sélectionner, rédiger, contester.                                     │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * SÉCURITÉ — non négociable :
 *   - le token transite par un environnement secret ou stdin (jamais argv : visible en `ps`) ;
 *   - il n'est JAMAIS écrit sur disque, JAMAIS loggé, JAMAIS commité ;
 *   - il est à TTL court : périmé = on redemande, on ne prolonge pas ;
 *   - aucun token long ne doit exister en .env (règle CLAUDE.md inchangée).
 *
 * Variables lues :
 *   MCP_TOKEN_<SERVEUR>             jeton TTL propre au serveur (recommandé)
 *   MCP_TOKEN_<SERVEUR>_EXPIRES_AT  expiration ISO8601 optionnelle
 *   MCP_ACCESS_TOKEN + MCP_ACCESS_TOKEN_SERVER  repli mono-serveur explicite
 *   MCP_SERVER_<NOM>                override d'URL par serveur
 */

const { reassembleJobResponse } = require('./mcp-chunks');

const SERVERS = {
  marketdata: process.env.MCP_SERVER_MARKETDATA || 'https://mcp.dailytickers.com/mcp',
  systematic: process.env.MCP_SERVER_SYSTEMATIC || 'https://systematic.dailytickers.com/mcp',
  notification: process.env.MCP_SERVER_NOTIFICATION || 'https://notification.hbfs-cloud.com/mcp',
  memory: process.env.MCP_SERVER_MEMORY || 'https://memory.hbfs-cloud.com/mcp',
};

const DEFAULT_CONCURRENCY = Number(process.env.MCP_CONCURRENCY || 8);
const DEFAULT_TIMEOUT_MS = Number(process.env.MCP_TIMEOUT_MS || 90_000);
const TOKEN_SAFETY_MARGIN_MS = 30_000; // on refuse un token qui expire dans <30s

function redactSecrets(value) {
  let text = String(value == null ? '' : value);
  for (const [name, secret] of Object.entries(process.env)) {
    if (!/^MCP_(?:TOKEN|ACCESS_TOKEN)/.test(name) || !secret || secret.length < 8) continue;
    text = text.split(secret).join('[REDACTED]');
  }
  return text
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[REDACTED_JWT]');
}

class McpAuthError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'McpAuthError';
    this.actionable = true;
  }
}
class McpCallError extends Error {
  constructor(msg, { server, tool, status, body, retryAfterMs } = {}) {
    super(redactSecrets(msg));
    this.name = 'McpCallError';
    Object.assign(this, { server, tool, status, body: redactSecrets(body), retryAfterMs });
  }
}

// QueryData may return failures inside a Jobs data.items[] matrix, without a
// top-level error. Prefer named cells so callers retain the actual cause.
function queryFailureDetails(value) {
  const failures = [];
  const visit = (node, facet = '') => {
    if (!node || typeof node !== 'object') return;
    facet = node.data_type || facet;
    if (Array.isArray(node.cells)) {
      for (const cell of node.cells) {
        if (!['failed', 'partial', 'stale'].includes(String(cell.status || '').toLowerCase())) continue;
        const reason = cell.error || cell.rejection_reason || cell.status;
        failures.push(`${facet || 'query'}[${cell.symbol || '?'}]: ${typeof reason === 'string' ? reason : JSON.stringify(reason)}`);
      }
    }
    for (const [key, child] of Object.entries(node)) if (key !== 'cells' && child && typeof child === 'object') visit(child, facet);
  };
  visit(value);
  return [...new Set(failures)].map(redactSecrets);
}

/**
 * Valide la présence et la fraîcheur du token AVANT toute salve.
 * Échoue tôt et avec un message actionnable : un run à moitié fait sur un token
 * périmé produit un staging partiel qu'on prendrait pour complet.
 */
/**
 * Les jetons sont émis PAR SERVEUR et ne sont pas interchangeables : le JWT
 * marketdata porte aud=dailytickers-mcp, celui de systematic aud=dtx-mcp.
 * On lit donc MCP_TOKEN_<SERVEUR> en priorité. Le repli MCP_ACCESS_TOKEN n'est
 * accepté que si MCP_ACCESS_TOKEN_SERVER lie explicitement le jeton au serveur.
 *
 * ⚠️ AUCUN JETON NE PEUT SE RENOUVELER LUI-MÊME. L'outil d'émission est
 * volontairement hors de la surface read-only des deux serveurs : un script qui
 * voit son jeton expirer NE PEUT PAS en obtenir un autre, il doit repasser par
 * une session authentifiée (l'agent). C'est une décision de sécurité du serveur,
 * pas une limite à contourner — d'où l'échec franc plutôt que la tentative.
 */
function tokenEnvNames(server) {
  const up = String(server || '').toUpperCase();
  return { tok: `MCP_TOKEN_${up}`, exp: `MCP_TOKEN_${up}_EXPIRES_AT` };
}

function requireToken(server) {
  const { tok, exp } = tokenEnvNames(server);
  const genericMatches = process.env.MCP_ACCESS_TOKEN_SERVER === server;
  const token = (server && process.env[tok]) || (genericMatches ? process.env.MCP_ACCESS_TOKEN : null);
  if (!token) {
    throw new McpAuthError(
      `Aucun jeton pour le serveur « ${server || '?'} ».\n` +
      `Attendu : ${tok} (ou MCP_ACCESS_TOKEN avec MCP_ACCESS_TOKEN_SERVER=${server}).\n` +
      "L'AGENT doit émettre un jeton read-only et relancer :\n" +
      "  marketdata → GetReadOnlyToken(minutes)        max 60 min\n" +
      "  systematic → DtxMintReadOnlyToken(ttl_minutes) max 1440 min\n" +
      "Repli : le chemin historique agent → JSON de staging → --ingest reste valide."
    );
  }
  const expIso = (server && process.env[exp]) || process.env.MCP_TOKEN_EXPIRES_AT;
  const deadline = expIso ? Date.parse(expIso) : jwtExpiryMs(token);
  if (Number.isFinite(deadline) && deadline - Date.now() < TOKEN_SAFETY_MARGIN_MS) {
    throw new McpAuthError(
      `Jeton « ${server} » expiré ou sur le point de l'être (${new Date(deadline).toISOString()}).\n` +
      "Un script NE PEUT PAS se renouveler : réémettre depuis une session authentifiée.\n" +
      "Ne JAMAIS prolonger ni réutiliser un jeton périmé."
    );
  }
  return token;
}

/** Lit `exp` d'un JWT sans le vérifier — sert uniquement à échouer tôt côté client. */
function jwtExpiryMs(token) {
  try {
    const p = token.split('.')[1];
    if (!p) return NaN;
    const json = Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const exp = JSON.parse(json).exp;
    return typeof exp === 'number' ? exp * 1000 : NaN;
  } catch { return NaN; }
}

/** true si un appel direct est possible sur ce serveur ; dégradation gracieuse. */
function canCallDirectly(server) {
  try { requireToken(server); return true; } catch { return false; }
}

function serverUrl(server) {
  const url = SERVERS[server];
  if (!url) throw new McpCallError(`Serveur MCP inconnu : ${server}. Connus : ${Object.keys(SERVERS).join(', ')}`);
  return url;
}

let _rpcId = 0;

// One process-wide lane per server: submissions, polls and pages share the same
// request budget, including a cooldown learned by any concurrent worker.
const requestLanes = new Map();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function requestLane(server) {
  if (!requestLanes.has(server)) requestLanes.set(server, { tail: Promise.resolve(), nextAt: 0, blockedUntil: 0 });
  return requestLanes.get(server);
}
async function waitForRequestSlot(server, deadline, intervalMs) {
  const lane = requestLane(server);
  const previous = lane.tail;
  let release;
  lane.tail = new Promise(resolve => { release = resolve; });
  try {
    let timer;
    try {
      await Promise.race([previous, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new McpCallError('Budget de reprise MCP épuisé', { server })), Math.max(0, deadline - Date.now()));
      })]);
    } finally { clearTimeout(timer); }
    for (;;) {
      const now = Date.now();
      if (now >= deadline) throw new McpCallError('Budget de reprise MCP épuisé', { server });
      const wait = Math.max(lane.nextAt, lane.blockedUntil) - now;
      if (wait <= 0) break;
      await sleep(Math.min(wait, deadline - now));
    }
    lane.nextAt = Date.now() + intervalMs;
  } finally { previous.then(release); }
}
function retryHintMs(header, text) {
  const candidates = [];
  if (header != null && String(header).trim() !== '') {
    const seconds = Number(header);
    const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - Date.now();
    if (Number.isFinite(ms) && ms >= 0) candidates.push(ms);
  }
  try {
    const body = JSON.parse(text || '{}');
    const raw = body.retry_after_seconds ?? body.retryAfterSeconds ?? body.error?.retry_after_seconds ?? body.error?.data?.retry_after_seconds;
    const seconds = raw == null ? NaN : Number(raw);
    if (Number.isFinite(seconds) && seconds >= 0) candidates.push(seconds * 1000);
  } catch { /* Non-JSON edge refusals can still carry Retry-After. */ }
  if (!candidates.length) {
    const match = String(text || '').match(/retry[_ -]?after(?:[_ -]?seconds)?[^0-9]{0,8}(\d+(?:\.\d+)?)/i);
    if (match && Number.isFinite(Number(match[1]))) candidates.push(Number(match[1]) * 1000);
  }
  return candidates.length ? Math.ceil(Math.max(...candidates)) : undefined;
}

/**
 * Un appel d'outil MCP (JSON-RPC 2.0 sur HTTP).
 * Retourne le contenu déjà déballé : si l'outil renvoie du JSON on le parse.
 */
async function callTool(server, tool, args = {}, opts = {}) {
  const token = requireToken(server);
  const url = serverUrl(server);
  const deadline = Math.min(opts.deadlineMs || Infinity, Date.now() + (opts.timeoutMs || DEFAULT_TIMEOUT_MS));
  await waitForRequestSlot(server, deadline, opts.requestIntervalMs ?? (server === 'marketdata' ? 1000 : 0));
  const timeout = Math.max(1, deadline - Date.now());

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeout);
  let res, text;
  try {
    res = await fetch(url, {
      method: 'POST',
      signal: ac.signal,
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json, text/event-stream',
        'authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: ++_rpcId,
        method: 'tools/call',
        params: { name: tool, arguments: args },
      }),
    });
    text = await res.text();
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new McpCallError(`Timeout ${timeout}ms`, { server, tool });
    throw new McpCallError(`Réseau : ${redactSecrets(e.message)}`, { server, tool });
  }
  clearTimeout(timer);

  if (res.status === 401 || res.status === 403) {
    throw new McpAuthError(`Jeton refusé (${res.status}) sur ${server}/${tool}. Redemander un jeton.`);
  }
  if (!res.ok) {
    const retryAfterMs = retryHintMs(res.headers.get('retry-after'), text);
    if (res.status === 429) {
      const lane = requestLane(server);
      lane.blockedUntil = Math.max(lane.blockedUntil, Date.now() + Math.max(1000, retryAfterMs ?? 5000));
    }
    throw new McpCallError(`HTTP ${res.status}`, { server, tool, status: res.status, body: text.slice(0, 1000), retryAfterMs });
  }

  let payload;
  try { payload = JSON.parse(text); }
  catch { throw new McpCallError('Réponse non-JSON', { server, tool, body: text.slice(0, 400) }); }

  if (payload.error) {
    if (payload.error.code === -32002 && payload.error.data?.type === 'rate_limited') {
      throw new McpCallError('Quota de calcul MCP épuisé', { server, tool, status: 429,
        body: JSON.stringify(payload.error), retryAfterMs: retryHintMs(null, text) });
    }
    throw new McpCallError(`Erreur MCP : ${redactSecrets(payload.error.message || JSON.stringify(payload.error))}`, { server, tool });
  }
  if (payload.result && payload.result.isError === true) {
    const detail = unwrap(payload.result);
    const reason = redactSecrets(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 1000);
    throw new McpCallError(`Erreur outil MCP : ${reason || 'erreur sans détail'}`, { server, tool, body: reason });
  }
  return unwrap(payload.result);
}

function rateLimitDelayMs(error) {
  if (!(error instanceof McpCallError) || error.status !== 429) return null;
  const hint = error.retryAfterMs ?? retryHintMs(null, error.body);
  // Never shorten a server deadline: an excessive delay exhausts the caller's
  // bounded budget and remains an error for the quality gate.
  return Math.max(1000, hint ?? 5000);
}

async function callToolWithRetry(server, tool, args = {}, opts = {}) {
  const retries = Number.isInteger(opts.rateLimitRetries) ? Math.max(0, Math.min(8, opts.rateLimitRetries)) : 4;
  const deadline = Math.min(opts.deadlineMs || Infinity, Date.now() + (opts.timeoutMs || DEFAULT_TIMEOUT_MS));
  const callArgs = { ...args };
  if (server === 'marketdata' && ['RunScreener', 'RunAutoScreener', 'RunBacktest', 'GetInstruments', 'GetTradingSnapshot', 'GetMarketOverview'].includes(tool)
      && !callArgs.intent_id && !callArgs.pagination_token) {
    callArgs.intent_id = require('crypto').randomUUID();
  }
  for (let attempt = 0; ; attempt++) {
    try { return await callTool(server, tool, callArgs, { ...opts, deadlineMs: deadline }); }
    catch (error) {
      const hint = rateLimitDelayMs(error);
      if (hint == null || attempt >= retries) throw error;
      const delay = Math.max(hint, Math.min(30_000, 1000 * 2 ** attempt)) + Math.floor(Math.random() * 250);
      if (Date.now() + delay >= deadline) throw error;
      await sleep(delay);
    }
  }
}

/** Déballe le format MCP {content:[{type:'text',text}]} et parse le JSON si c'en est. */
function unwrap(result) {
  if (!result) return null;
  const parts = result.content;
  if (!Array.isArray(parts)) return result;
  const texts = parts.filter(p => p && p.type === 'text' && typeof p.text === 'string').map(p => p.text);
  if (!texts.length) return result;
  const joined = texts.join('');
  try { return JSON.parse(joined); } catch { return joined; }
}

/**
 * Salve parallèle avec plafond de concurrence.
 * Chaque entrée : {server, tool, args, as?}.
 * Ne rejette JAMAIS globalement : renvoie {as, ok, value|error} par appel, pour
 * qu'un échec isolé n'annule pas une collecte de 40 appels.
 */
async function callMany(calls, { concurrency = DEFAULT_CONCURRENCY, onResult } = {}) {
  for (const s of new Set(calls.map(c => c.server))) requireToken(s); // échoue tôt, par serveur
  const out = new Array(calls.length);
  let cursor = 0;

  async function worker() {
    for (;;) {
      const i = cursor++;
      if (i >= calls.length) return;
      const c = calls[i];
      const label = c.as || `${c.server}.${c.tool}`;
      const t0 = Date.now();
      try {
        const value = await callToolWithRetry(c.server, c.tool, c.args || {}, c);
        out[i] = { as: label, ok: true, value, ms: Date.now() - t0 };
      } catch (e) {
        if (e instanceof McpAuthError) throw e; // auth cassée = tout s'arrête
        out[i] = { as: label, ok: false, error: redactSecrets(e.message), ms: Date.now() - t0 };
      }
      if (onResult) onResult(out[i], i, calls.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, calls.length) }, worker));
  return out;
}

/**
 * Poll d'un job async jusqu'à complétion.
 * Les gros appels (overview, screeners, replay) renvoient {job_id,status:'pending'}.
 */
async function awaitJob(server, jobId, {
  pollTool = 'Jobs',
  idArg = 'job_id',
  intervalMs = 6000,
  maxMs = 300_000,
  maxPages = 100,
  // Le défaut serveur (70 000 octets) fait ÉCHOUER une page dont le contenu le
  // dépasse : `Jobs` renvoie alors une erreur « paginated response too large »
  // au lieu d'une page, et la boucle voit un statut absent. On demande donc le
  // plafond serveur (262 144) sur TOUTES les pages — la même valeur partout,
  // sinon le découpage `_chunk_index` diffère d'une page à l'autre.
  pageMaxsize = 262_144,
  call = callToolWithRetry,
} = {}) {
  const paged = server === 'marketdata' && pollTool === 'Jobs';
  const pollArgs = () => (paged ? { [idArg]: jobId, maxsize: pageMaxsize } : { [idArg]: jobId });
  const deadline = Date.now() + maxMs;
  const read = args => {
    if (Date.now() >= deadline) throw new McpCallError(`Job ${jobId}: budget de récupération épuisé`, { server, tool: pollTool });
    return call(server, pollTool, args, { deadlineMs: deadline });
  };
  for (;;) {
    const r = await read(pollArgs());
    const status = r && (r.status || (r.data && r.data.status));
    if (status === 'completed' || status === 'done') {
      if (!paged) return r;
      const firstData = r && r.data;
      let pagination = (r && r.pagination) || (firstData && firstData.pagination);
      if (!pagination || pagination.has_next !== true) return reassembleJobResponse(r);
      if (!Array.isArray(firstData.items)) throw new McpCallError(`Job ${jobId}: pagination annoncée sans data.items[]`, { server, tool: pollTool });

      const merged = { ...r, data: { ...firstData, items: [...firstData.items] } };
      const seen = new Set();
      let fetched = 1;
      while (pagination && pagination.has_next === true) {
        if (fetched >= maxPages) throw new McpCallError(`Job ${jobId}: pagination dépasse ${maxPages} pages`, { server, tool: pollTool });
        const nextPage = pagination.next_page || (Number(pagination.page || fetched) + 1);
        const key = `${nextPage}|${pagination.pagination_token || ''}`;
        if (seen.has(key)) throw new McpCallError(`Job ${jobId}: boucle de pagination détectée (${key})`, { server, tool: pollTool });
        seen.add(key);
        const pageArgs = { [idArg]: jobId, page: nextPage, maxsize: pageMaxsize };
        if (pagination.pagination_token) pageArgs.pagination_token = pagination.pagination_token;
        const page = await read(pageArgs);
        const pageStatus = page && (page.status || (page.data && page.data.status));
        if (pageStatus !== 'completed' && pageStatus !== 'done') {
          throw new McpCallError(`Job ${jobId}: page ${nextPage} dans un état inattendu (${pageStatus || 'absent'})`, { server, tool: pollTool });
        }
        if (!page.data || !Array.isArray(page.data.items)) {
          throw new McpCallError(`Job ${jobId}: page ${nextPage} sans data.items[]`, { server, tool: pollTool });
        }
        merged.data.items.push(...page.data.items);
        pagination = page.pagination || page.data.pagination || { has_next: false };
        fetched++;
      }
      const exhausted = { ...pagination, has_next: false, pages_fetched: fetched, exhausted: true };
      merged.pagination = exhausted;
      if (firstData.pagination) merged.data.pagination = exhausted;
      return reassembleJobResponse(merged);
    }
    if (status === 'failed' || status === 'error') {
      // Remonter la RAISON du serveur : « job en échec » sans motif oblige à
      // rejouer l'appel à la main pour diagnostiquer, ce qui annule le gain.
      const d = r.data || r;
      const why = queryFailureDetails(r).slice(0, 3).join('; ') || d.error || d.message || d.reason || (d.result && d.result.error) || r.error || r.message || r.reason || '';
      const error = new McpCallError(`Job ${jobId} en échec${why ? ' — ' + redactSecrets(why).slice(0, 1000) : ' (aucun motif renvoyé)'}`,
        { server, tool: pollTool, body: redactSecrets(JSON.stringify(d)).slice(0, 500) });
      // Diagnostic only: retain the failed envelope, never promote it to a
      // completed/pagination-exhausted result or add it to a freshness manifest.
      error.failedResponse = JSON.parse(redactSecrets(JSON.stringify(r)));
      throw error;
    }
    if (Date.now() > deadline) throw new McpCallError(`Job ${jobId} non terminé après ${maxMs}ms`, { server, tool: pollTool });
    const hinted = Number(r?.retry_after_seconds ?? r?.data?.retry_after_seconds);
    const delay = Math.max(intervalMs, Number.isFinite(hinted) && hinted >= 0 ? hinted * 1000 : 0);
    await sleep(Math.min(delay, Math.max(0, deadline - Date.now())));
  }
}

module.exports = {
  SERVERS, callTool, callToolWithRetry, callMany, awaitJob, rateLimitDelayMs,
  requireToken, canCallDirectly,
  redactSecrets, queryFailureDetails,
  McpAuthError, McpCallError,
};
