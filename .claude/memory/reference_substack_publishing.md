---
name: substack-publishing
description: Options d'intégration pour publier sur substack.com/@dailytickers — pas d'API officielle, MCP Substack Gateway OSS = voie propre.
metadata:
  type: reference
---

Publication programmatique sur **https://substack.com/@dailytickers** (demandé 2026-06-30).

**Pas d'API officielle** pour poster. L'API dev Substack ne fait que lire des profils publics.

## Options (par ordre de propreté vs les règles du projet)

1. **Substack Gateway OSS (MCP)** — serveur MCP REST language-agnostic exposant les capacités Substack à Claude/n8n/agents. **Voie recommandée** : correspond au "prévoir le mcp si besoin" demandé, et respecte la règle OAuth2/zéro-token-en-.env du projet. À enregistrer comme les autres MCPs (DailyTickers, Memory, Notification).
2. **Wrappers non-officiels** (Python `substack_api` / TS `substack-api`) — reverse-engineered, auth par session cookie `connect.sid`. **Conflit avec la règle "no token en .env"** → à éviter sauf via un secret store MCP.
3. **n8n node** — automatise les **Notes** (updates courts) seulement, PAS les posts longs (newsletters).

## Contrainte clé
La publication de **posts longs** (nos articles) n'est pas bien supportée par l'API non-officielle — surtout des **Notes**. Pour les articles complets : soit l'endpoint reverse-engineered (draft creation) via session cookie, soit publication semi-manuelle.

## MVP pragmatique
- Convertisseur `tools/gen-substack-draft.js` : HTML article DailyTickers → format Substack (markdown/HTML compatible) → draft.
- Push des **Notes** (teasers avec lien vers articles.dailytickers.com) automatiquement via MCP/n8n.
- Posts longs : draft auto + publication manuelle (ou endpoint reverse-engineered si session cookie via secret store).

## Sources
- https://support.substack.com/hc/en-us/articles/45099095296916-Substack-Developer-API (API officielle = lecture profils)
- https://github.com/NHagar/substack_api (wrapper Python non-officiel)
- https://github.com/jakub-k-slys/substack-api (client TS, mentionne Substack Gateway OSS + MCP)
- https://iam.slys.dev/p/substack-automation-with-n8n-how (automatisation Notes via n8n)


## MAJ 2026-07-02 — DÉPLOYÉ
- **LIVE** : https://substack.dailytickers.com/mcp (tools: create_draft, list_drafts,
  publish, create_note, whoami) sur vm-arm-1, port statique 8096, mode cookie=false.
- Secrets via `nomad var put nomad/jobs/substack-mcp substack_cookie='...' [mcp_auth_token='...']`
  (PAS Vault — opérateur ci sans accès ; re-render + restart auto à l'injection).
- Convertisseur : tools/gen-substack-draft.js (articles). Reste : cookie user + enregistrement
  OAuth claude.ai + câblage pipeline (Note auto à la publication).
- ⚠️ endpoints reverse-engineered UNVERIFIED : après cookie, tester whoami + list_drafts
  (read-only) AVANT create_draft/publish.
