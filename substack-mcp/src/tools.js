/**
 * tools.js — MCP tool registration: create_draft, list_drafts, publish, create_note.
 *
 * Reuses the articles repo converter (tools/gen-substack-draft.js) to turn a published HTML article
 * into { title, subtitle, body_markdown, canonical_url, tags, note }, then converts Markdown ->
 * ProseMirror before POSTing to Substack. Never publishes without an explicit `publish` call.
 */
'use strict';

import { z } from 'zod';
import { createRequire } from 'module';
import { resolve } from 'path';
import { markdownToProseMirror, noteToProseMirror } from './markdown-to-prosemirror.js';

const require = createRequire(import.meta.url);

// Lazy-load the CJS converter from the articles repo (path configurable via env).
function loadConverter() {
  const rel = process.env.GEN_SUBSTACK_DRAFT || '../tools/gen-substack-draft.js';
  const abs = resolve(process.cwd(), rel);
  // eslint-disable-next-line import/no-dynamic-require
  return require(abs); // exports { convert, renderDraftMarkdown }
}

const ok = obj => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });
const fail = msg => ({ isError: true, content: [{ type: 'text', text: msg }] });

/**
 * Garde-fou email, côté serveur. `send_email=true` est un booléen : sans point
 * d'application ici, le refus du gate de publication n'était qu'une convention
 * documentaire, et un seul paramètre suffisait à réveiller tous les abonnés.
 *
 * Le jeton à usage unique est émis par `publication-gate.js --authorize`, sous
 * verrou, APRÈS consommation du quota (1 email / 24 h, tous types confondus).
 * Ceinture ET bretelles : un hook PreToolUse local applique la même règle avant
 * l'appel. Les deux consomment le même jeton, une fois chacun — un second envoi
 * se présenterait avec le même rôle et serait refusé.
 *
 * Si le module n'est pas joignable, on REFUSE par défaut : ne pas savoir
 * vérifier n'est pas une raison d'envoyer.
 *
 * ── L'échappatoire, et pourquoi elle existe ─────────────────────────────────
 * Déployé loin du dépôt, ce serveur ne voit aucun jeton — le refus par défaut
 * rendrait alors TOUT email impossible, y compris légitime. Un garde-fou qui
 * ferme le chemin normal ne se contourne pas : il se désactive en bloc, et on
 * perd aussi celui qui marchait. `EMAIL_GRANT_MODE=hook-only` délègue donc
 * explicitement l'application au hook PreToolUse local, qui lui tourne toujours
 * là où le modèle tourne. C'est un choix de déploiement, conscient et écrit,
 * pas un défaut silencieux : la valeur par défaut reste le refus.
 */
function consumeEmailGrant() {
  const rel = process.env.EMAIL_GRANT_LIB || '../tools/lib/email-grant.js';
  let lib;
  try { lib = require(resolve(process.cwd(), rel)); }
  catch (e) {
    if (process.env.EMAIL_GRANT_MODE === 'hook-only') {
      return { ok: true, delegated: true, note: 'vérification déléguée au hook PreToolUse (EMAIL_GRANT_MODE=hook-only)' };
    }
    return { ok: false, reason: `garde-fou email injoignable (${e.message}). Un envoi non vérifiable est un envoi refusé. Trois issues : publier avec send_email=false ; exposer tools/lib/email-grant.js au serveur via EMAIL_GRANT_LIB / DESK_EMAIL_GRANT_DIR ; ou, si le serveur est déployé hors du dépôt et que l'application repose sur le hook local, poser EMAIL_GRANT_MODE=hook-only côté déploiement.` };
  }
  return lib.consume('*', 'server');
}

/**
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {import('./substack-client.js').SubstackClient} client
 */
export function registerTools(server, client) {
  server.tool(
    'create_draft',
    'Create a Substack draft from a DailyTickers HTML article (path) or from explicit fields. Does NOT publish.',
    {
      path: z.string().optional().describe('Absolute/relative path to an article HTML file or its directory'),
      title: z.string().optional(),
      subtitle: z.string().optional(),
      body_markdown: z.string().optional().describe('Markdown body (used when path is not provided)'),
      audience: z.enum(['everyone', 'only_paid', 'founding']).default('everyone'),
    },
    async ({ path, title, subtitle, body_markdown, audience }) => {
      try {
        let draft;
        if (path) {
          const { convert } = loadConverter();
          draft = convert(resolve(process.cwd(), path));
        } else if (title && body_markdown) {
          draft = { title, subtitle: subtitle || '', body_markdown };
        } else {
          return fail('Provide either `path` or (`title` + `body_markdown`).');
        }
        const body = markdownToProseMirror(draft.body_markdown);
        const res = await client.createDraft({
          title: draft.title,
          subtitle: draft.subtitle,
          body,
          audience,
        });
        return ok({ draft_id: res.id, title: draft.title, canonical_url: draft.canonical_url || null, raw: res });
      } catch (e) {
        return fail(`${e.code === 'SUBSTACK_AUTH' ? 'HARD STOP — ' : ''}create_draft failed: ${e.message}`);
      }
    }
  );

  server.tool(
    'list_drafts',
    'List unpublished Substack drafts.',
    { limit: z.number().int().min(1).max(100).default(20) },
    async ({ limit }) => {
      try {
        return ok(await client.listDrafts({ limit }));
      } catch (e) {
        return fail(`${e.code === 'SUBSTACK_AUTH' ? 'HARD STOP — ' : ''}list_drafts failed: ${e.message}`);
      }
    }
  );

  server.tool(
    'publish',
    'Publish an existing Substack draft by id. send_email=false posts to web only (the default, and the normal path). send_email=true additionally emails every subscriber and CANNOT be undone: it requires a single-use grant minted by `publication-gate.js --authorize`, which enforces cadence, a 24h all-types email quota and a justified materiality score. Without a valid grant the publish is refused.',
    {
      draft_id: z.union([z.string(), z.number()]),
      send_email: z.boolean().default(false),
    },
    async ({ draft_id, send_email }) => {
      try {
        if (send_email === true) {
          const g = consumeEmailGrant();
          if (!g.ok) return fail(`HARD STOP — ${g.reason}`);
        }
        return ok(await client.publish(draft_id, { sendEmail: send_email }));
      } catch (e) {
        return fail(`${e.code === 'SUBSTACK_AUTH' ? 'HARD STOP — ' : ''}publish failed: ${e.message}`);
      }
    }
  );

  server.tool(
    'create_note',
    'Post a short Substack Note (teaser) linking back to an article. From path (uses article note) or explicit body.',
    {
      path: z.string().optional(),
      body: z.string().optional(),
    },
    async ({ path, body }) => {
      try {
        let text = body;
        if (!text && path) {
          const { convert } = loadConverter();
          text = convert(resolve(process.cwd(), path)).note;
        }
        if (!text) return fail('Provide `path` or `body`.');
        return ok(await client.createNote(noteToProseMirror(text)));
      } catch (e) {
        return fail(`${e.code === 'SUBSTACK_AUTH' ? 'HARD STOP — ' : ''}create_note failed: ${e.message}`);
      }
    }
  );
}
