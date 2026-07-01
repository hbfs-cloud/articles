# substack-mcp

MCP server (for claude.ai / Claude Code) that turns DailyTickers HTML articles into Substack drafts and
publishes them. See `../SUBSTACK_MCP_PLAN.md` for the full architecture, auth model, and deployment plan.

**Substack has no official write API.** This server drives reverse-engineered internal endpoints with a
**session cookie** (captured after an interactive login). Those endpoints are isolated in
`src/substack-client.js` — the one place to fix if Substack changes its schema.

## Tools

- `create_draft` — `{ path }` (article HTML) or `{ title, subtitle, body_markdown }` → new Substack draft.
- `list_drafts` — list unpublished drafts.
- `publish` — publish a draft by id.
- `create_note` — (bonus) short Substack Note teaser.

## Run locally

```bash
cp .env.example .env      # fill SUBSTACK_COOKIE (from interactive login), SUBSTACK_PUBLICATION, MCP_AUTH_TOKEN
npm install
npm start                 # serves MCP over Streamable HTTP on http://localhost:$PORT/mcp
```

`list_drafts` first (read-only) to validate the cookie before any write.

## Production

Docker behind a TLS reverse-proxy (Caddy), secrets injected from Infisical — see plan §5. Never bake the
cookie or auth token into the image or git.

## Status

Scaffold. The reverse-engineered endpoint paths in `substack-client.js` are **UNVERIFIED** and must be
confirmed live against a real session cookie before relying on `create_draft` / `publish`.
