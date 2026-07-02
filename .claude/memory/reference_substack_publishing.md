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

## MAJ 2026-07-02 — Câblage pipeline (OPTIONNEL, non-bloquant)
- **tools/substack-publish.js** : CLI. Prend un chemin d'article HTML, génère le draft
  via `gen-substack-draft.js` (require en module, spawn en fallback), écrit toujours
  `data/substack-drafts/<slug>.json` en local (jamais réseau-dépendant). Si
  `SUBSTACK_MCP_URL` (défaut `https://substack.dailytickers.com/mcp`) est joignable
  ET `MCP_AUTH_TOKEN` est présent en env → POST JSON-RPC 2.0 `tools/call` `create_note`
  (teaser), + `create_draft` avec `--draft`. Sans bearer → mode draft-only local
  (aucun appel réseau, message clair). Timeouts courts (8s par défaut,
  `SUBSTACK_TIMEOUT_MS`), aucune exception non catchée. Exit codes : 0=OK
  (draft écrit, POST ok ou non tenté), 1=génération draft échouée, 2=POST tenté
  et échoué (draft quand même sauvegardé).
- **Câblé dans `tools/publish-daily-card.sh`** en Step 10, après la notification
  scanner, non-bloquant (`|| echo ... non-blocking`), désactivable via `SUBSTACK_DISABLE=1`.
- **Testé 2026-07-02** avec un bearer factice contre le vrai serveur : la requête
  atteint bien `substack.dailytickers.com` et `create_note` échoue proprement
  (401 — "session cookie expired or invalid", le serveur tourne encore en
  mode `cookie=false`). Confirme que le serveur est up mais pas encore
  configuré côté cookie Substack — reste à faire : injecter `substack_cookie`
  + `mcp_auth_token` via `nomad var put` (cf. section précédente) avant que
  ce step passe en mode "live" en prod.


## MAJ 2026-07-02 soir — OAuth 2.1 + /settings DÉPLOYÉS
- /mcp **fail-closed** (401 + WWW-Authenticate sans token valide ; JWT forgé rejeté).
  Cause de l'ouverture initiale : gate `token==""` passait tout quand mcp_auth_token
  absent malgré OAuth actif — corrigé (authConfigured = token OU clés RSA).
- **Page /settings** : login Google (session HMAC distincte du JWT machine, callback
  DÉDIÉ /settings/auth/callback), formulaire cookie write-only, test whoami, hot-swap
  sans redeploy, stockage AES-256-GCM dans /local (limite : un redeploy perd le cookie
  → re-coller ; host_volume à ajouter pour la persistance). Alerte Discord sur 401
  Substack (debounce 30min, env DISCORD_WEBHOOK, absente = log).
- **SÉQUENCE USER pour activer la publication** :
  1. GCP console (client OAuth partagé ou dédié) : ajouter LES DEUX redirect URIs —
     https://substack.dailytickers.com/auth/google/callback ET
     https://substack.dailytickers.com/settings/auth/callback
  2. Injecter google_client_id/google_client_secret dans la nomad var
     nomad/jobs/substack-mcp (ou me donner le GO pour les copier host-side depuis Vault
     si tu m'ouvres l'accès)
  3. claude.ai → Settings → Connectors → Add custom connector →
     https://substack.dailytickers.com/mcp (login Google)
  4. Ouvrir https://substack.dailytickers.com/settings → coller le cookie substack.com
     → bouton Tester (whoami)
  5. Premier usage : whoami + list_drafts (read-only) AVANT create_draft/publish
     (endpoints reverse-engineered non vérifiés en écriture)
- Payant : create_draft audience='only_paid'|'founding' ; publish send_email bool.
- Pipeline articles : tools/substack-publish.js câblé non-bloquant (SUBSTACK_DISABLE=1).
- Code substack-mcp NON COMMITÉ dans dailystocks-platform (revue user) : mcpauth,
  websession, settingsstore, settings, alert + main.go durci + tests verts.
