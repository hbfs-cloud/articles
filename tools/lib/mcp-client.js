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
 *   - le token transite par l'ENVIRONNEMENT uniquement (jamais argv : visible en `ps`) ;
 *   - il n'est JAMAIS écrit sur disque, JAMAIS loggé, JAMAIS commité ;
 *   - il est à TTL court : périmé = on redemande, on ne prolonge pas ;
 *   - aucun token long ne doit exister en .env (règle CLAUDE.md inchangée).
 *
 * Variables lues :
 *   MCP_ACCESS_TOKEN       (requis)  jeton porteur à TTL court
 *   MCP_TOKEN_EXPIRES_AT   (optionnel) ISO8601 ; si absent on ne peut pas pré-valider
 *   MCP_SERVER_<NOM>       (optionnel) override d'URL par serveur
 */

const SERVERS = {
  marketdata: process.env.MCP_SERVER_MARKETDATA || 'https://mcp.dailytickers.com/mcp',
  systematic: process.env.MCP_SERVER_SYSTEMATIC || 'https://systematic.dailytickers.com/mcp',
  notification: process.env.MCP_SERVER_NOTIFICATION || 'https://notification.hbfs-cloud.com/mcp',
  memory: process.env.MCP_SERVER_MEMORY || 'https://memory.hbfs-cloud.com/mcp',
};

const DEFAULT_CONCURRENCY = Number(process.env.MCP_CONCURRENCY || 8);
const DEFAULT_TIMEOUT_MS = Number(process.env.MCP_TIMEOUT_MS || 90_000);
const TOKEN_SAFETY_MARGIN_MS = 30_000; // on refuse un token qui expire dans <30s

class McpAuthError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'McpAuthError';
    this.actionable = true;
  }
}
class McpCallError extends Error {
  constructor(msg, { server, tool, status, body } = {}) {
    super(msg);
    this.name = 'McpCallError';
    Object.assign(this, { server, tool, status, body });
  }
}

/**
 * Valide la présence et la fraîcheur du token AVANT toute salve.
 * Échoue tôt et avec un message actionnable : un run à moitié fait sur un token
 * périmé produit un staging partiel qu'on prendrait pour complet.
 */
/**
 * Les jetons sont émis PAR SERVEUR et ne sont pas interchangeables : le JWT
 * marketdata porte aud=dailytickers-mcp, celui de systematic aud=dtx-mcp.
 * On lit donc MCP_TOKEN_<SERVEUR> en priorité, MCP_ACCESS_TOKEN en repli.
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
  const token = (server && process.env[tok]) || process.env.MCP_ACCESS_TOKEN;
  if (!token) {
    throw new McpAuthError(
      `Aucun jeton pour le serveur « ${server || '?'} ».\n` +
      `Attendu : ${tok} (ou MCP_ACCESS_TOKEN en repli).\n` +
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

/**
 * Un appel d'outil MCP (JSON-RPC 2.0 sur HTTP).
 * Retourne le contenu déjà déballé : si l'outil renvoie du JSON on le parse.
 */
async function callTool(server, tool, args = {}, opts = {}) {
  const token = requireToken(server);
  const url = serverUrl(server);
  const timeout = opts.timeoutMs || DEFAULT_TIMEOUT_MS;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeout);
  let res;
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
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new McpCallError(`Timeout ${timeout}ms`, { server, tool });
    throw new McpCallError(`Réseau : ${e.message}`, { server, tool });
  }
  clearTimeout(timer);

  if (res.status === 401 || res.status === 403) {
    throw new McpAuthError(`Jeton refusé (${res.status}) sur ${server}/${tool}. Redemander un jeton.`);
  }
  const text = await res.text();
  if (!res.ok) throw new McpCallError(`HTTP ${res.status}`, { server, tool, status: res.status, body: text.slice(0, 400) });

  let payload;
  try { payload = JSON.parse(text); }
  catch { throw new McpCallError('Réponse non-JSON', { server, tool, body: text.slice(0, 400) }); }

  if (payload.error) {
    throw new McpCallError(`Erreur MCP : ${payload.error.message || JSON.stringify(payload.error)}`, { server, tool });
  }
  return unwrap(payload.result);
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
        const value = await callTool(c.server, c.tool, c.args || {}, c);
        out[i] = { as: label, ok: true, value, ms: Date.now() - t0 };
      } catch (e) {
        if (e instanceof McpAuthError) throw e; // auth cassée = tout s'arrête
        out[i] = { as: label, ok: false, error: e.message, ms: Date.now() - t0 };
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
async function awaitJob(server, jobId, { pollTool = 'Jobs', idArg = 'job_id', intervalMs = 6000, maxMs = 300_000 } = {}) {
  const deadline = Date.now() + maxMs;
  for (;;) {
    const r = await callTool(server, pollTool, { [idArg]: jobId });
    const status = r && (r.status || (r.data && r.data.status));
    if (status === 'completed' || status === 'done') return r;
    if (status === 'failed') {
      // Remonter la RAISON du serveur : « job en échec » sans motif oblige à
      // rejouer l'appel à la main pour diagnostiquer, ce qui annule le gain.
      const d = r.data || r;
      const why = d.error || d.message || d.reason || (d.result && d.result.error) || '';
      throw new McpCallError(`Job ${jobId} en échec${why ? ' — ' + String(why).slice(0, 300) : ' (aucun motif renvoyé)'}`,
        { server, tool: pollTool, body: JSON.stringify(d).slice(0, 500) });
    }
    if (Date.now() > deadline) throw new McpCallError(`Job ${jobId} non terminé après ${maxMs}ms`, { server, tool: pollTool });
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

module.exports = {
  SERVERS, callTool, callMany, awaitJob,
  requireToken, canCallDirectly,
  McpAuthError, McpCallError,
};
