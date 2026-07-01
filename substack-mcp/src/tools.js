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
    'Publish an existing Substack draft by id. send_email=false posts to web only.',
    {
      draft_id: z.union([z.string(), z.number()]),
      send_email: z.boolean().default(false),
    },
    async ({ draft_id, send_email }) => {
      try {
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
