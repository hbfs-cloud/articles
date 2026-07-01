# Substack MCP — Plan de déploiement (préparation)

> Statut : **PLAN + scaffold local uniquement**. Rien n'est déployé, aucun repo distant créé,
> aucun secret exposé. Ce document + `substack-mcp/` sont le point de départ.
>
> Contexte : publier nos articles DailyTickers sur `https://substack.com/@dailytickers` via un
> **MCP claude.ai** (comme DailyTickers / Memory / Notification), hébergé sur **VM Oracle** dans un
> **repo privé**, sur le même modèle opérationnel que les MCPs `*.hbfs-cloud.com` (OAuth2, zéro token
> en `.env`, Docker derrière reverse-proxy TLS).

---

## 1. Rappel de la contrainte Substack (source : `reference_substack_publishing.md`)

- **Pas d'API officielle d'écriture.** L'API dev Substack ne lit que des profils publics.
- La seule voie programmatique pour créer/publier des **posts longs** (nos articles) = **endpoints
  internes reverse-engineered**, authentifiés par **cookie de session** (`connect.sid` +
  `substack.sid`).
- Les libs non-officielles de référence : `NHagar/substack_api` (Python) et `jakub-k-slys/substack-api` (TS).
- Le corps d'un post Substack n'est **pas** du Markdown brut : c'est un document **ProseMirror JSON**
  (`{ type:"doc", content:[...] }`). Il faut donc convertir Markdown → ProseMirror avant POST.
- **Notes** (teasers courts) : mieux supportées, endpoint séparé (`/api/v1/comment/feed` / `notes`).

Conséquence directe sur l'archi : le MCP encapsule un **client Substack "session-cookie"**. Le cookie
est un **secret utilisateur** obtenu par login interactif — il n'est jamais commité, jamais en `.env`
du repo. En prod il vit dans un **secret store** (Infisical, comme signal-monitor sur hetzner) et est
injecté au conteneur à l'exécution.

---

## 2. Architecture du serveur MCP (minimal)

```
Claude.ai / Claude Code
        │  (MCP over Streamable HTTP, OAuth2 bearer)
        ▼
  reverse-proxy TLS (Caddy)  ──  https://substack.dailytickers.com/mcp
        │
        ▼
  substack-mcp (Node, @modelcontextprotocol/sdk)
        │  StreamableHTTPServerTransport
        ├── tool: create_draft   (HTML article → gen-substack-draft.convert → ProseMirror → POST /drafts)
        ├── tool: list_drafts     (GET /drafts, filtre published=false)
        ├── tool: publish         (POST /drafts/{id}/prepublish → /publish)
        └── tool: create_note     (bonus : teaser Notes, endpoint séparé)
        │
        ▼
  substack-client.js  ── cookie de session (Infisical) ── *.substack.com/api/v1
```

Choix techniques :

- **SDK** : `@modelcontextprotocol/sdk` (déjà utilisé par `mcp/server`). Version stdio existante →
  ici on prend **`StreamableHTTPServerTransport`** (transport HTTP requis pour un MCP claude.ai remote,
  comme les `*.hbfs-cloud.com`).
- **Auth entrante (claude.ai → MCP)** : OAuth2 bearer, validé par le reverse-proxy + un check de token
  dans le serveur (`MCP_AUTH_TOKEN` en prod via secret store). Aligne sur la règle projet
  "OAuth2 / zéro token en `.env` du repo".
- **Auth sortante (MCP → Substack)** : cookie de session utilisateur (secret store). Le MCP ne stocke
  jamais le mot de passe Substack ; seulement le cookie, rotable.
- **Réutilisation** : le tool `create_draft` **réutilise `tools/gen-substack-draft.js`** (`convert()`
  exporté) pour transformer un article HTML en `{ title, subtitle, body_markdown, canonical_url, tags,
  note }`, puis convertit `body_markdown` → ProseMirror.

### Outils exposés

| Tool | Entrée | Action | Sortie |
|------|--------|--------|--------|
| `create_draft` | `path` (article HTML) **ou** `title`+`subtitle`+`body_markdown` | convert → ProseMirror → `POST /api/v1/drafts` | `{ draft_id, url, title }` |
| `list_drafts` | `limit?` | `GET /api/v1/drafts` filtré `is_published=false` | `[{ id, title, updated_at, url }]` |
| `publish` | `draft_id`, `send_email?` | `POST /drafts/{id}/prepublish` → `POST /drafts/{id}/publish` | `{ post_id, url, published_at }` |
| `create_note` *(bonus)* | `path` **ou** `body`, `link?` | teaser Notes → endpoint notes | `{ note_id, url }` |

> ⚠️ Les chemins d'endpoints (`/api/v1/drafts`, `/prepublish`, `/publish`) sont **reverse-engineered et
> NON garantis** — à valider live avec un vrai cookie (voir §6 checklist). Le scaffold les isole dans
> `substack-client.js` pour n'avoir qu'un seul endroit à corriger.

---

## 3. Auth Substack — approche session-cookie (détaillée)

1. L'utilisateur se connecte **une fois** à `substack.com` dans un navigateur (email magic-link ou
   password). C'est **l'étape interactive incontournable** — pas d'automatisation possible/propre.
2. On récupère les cookies de session : `substack.sid` (et/ou `connect.sid`). DevTools →
   Application → Cookies → `*.substack.com`.
3. Ce cookie est stocké **dans le secret store** (Infisical projet `substack-mcp`), jamais dans git,
   jamais dans le `.env` du repo. En dev local : `substack-mcp/.env` (git-ignoré) uniquement, à titre
   temporaire.
4. `substack-client.js` envoie le cookie dans l'en-tête `Cookie:` de chaque requête, avec le bon
   `Referer`/`Origin` (`https://dailytickers.substack.com`).
5. **Rotation** : le cookie expire (semaines). Prévoir un tool/health-check `whoami` qui détecte le
   401 et notifie (via Notification MCP) pour re-login. Respecte le **MCP HARD STOP** : cookie
   expiré → stop, pas de publication à l'aveugle.

Pourquoi pas de password en clair : Substack impose souvent un **magic-link email** (pas de flow
password stable) + captcha → login scripté non fiable. Le cookie post-login est la seule prise propre.

---

## 4. Structure du repo privé

Repo **privé** dédié `dailytickers/substack-mcp` (séparé du repo articles public — parité avec la
séparation `mcp.dailytickers.com` / articles). Contenu = ce qui est scaffoldé ici :

```
substack-mcp/
├── package.json            # deps: @modelcontextprotocol/sdk, express, zod
├── .gitignore              # .env, node_modules, *.cookie
├── .env.example            # variables (SANS valeurs) — cookie/token via secret store en prod
├── README.md               # run local + prod
├── src/
│   ├── server.js           # MCP + StreamableHTTP + bearer check
│   ├── tools.js            # définitions create_draft / list_drafts / publish / create_note
│   ├── substack-client.js  # client session-cookie (endpoints reverse-engineered, isolés)
│   └── markdown-to-prosemirror.js  # convert body_markdown → doc ProseMirror
├── deploy/
│   ├── Dockerfile
│   ├── docker-compose.yml  # prod : conteneur + réseau proxy
│   └── Caddyfile           # TLS + reverse-proxy /mcp
└── test/
    └── smoke.test.js       # convert + prosemirror sans réseau
```

Note : le converter `tools/gen-substack-draft.js` reste dans le repo **articles** (il connaît la
structure des articles). Le MCP l'importe soit en dépendance git, soit via un petit copy au build. Le
scaffold local l'importe par chemin relatif documenté (à ajuster au packaging du repo privé).

---

## 5. Déploiement VM Oracle (pattern hbfs-cloud / hetzner)

Modèle de référence dans les notes projet : MCPs OAuth2 servis sous `*.hbfs-cloud.com/mcp`, conteneurs
Docker/Nomad derrière proxy TLS, secrets via **Infisical** (cf. `reference_hetzner.md`,
`project_oauth2_migration.md`). Transposé sur **VM Oracle** :

1. **Provision VM Oracle** (Ampere/x86, Ubuntu 22.04). Ouvrir 443 (+ 80 pour ACME). DNS
   `substack.dailytickers.com` → IP de la VM.
2. **Docker + Caddy** (ou réutiliser le proxy existant si la VM Oracle héberge déjà la
   dailytickers-platform). Caddy termine le TLS et proxifie `/mcp` → conteneur `substack-mcp:8080`.
3. **Secrets** : brancher Infisical (même schéma que signal-monitor). Injecter à l'exécution :
   `SUBSTACK_COOKIE`, `SUBSTACK_PUBLICATION` (`dailytickers`), `MCP_AUTH_TOKEN`. **Aucun** de ces
   secrets n'est dans l'image ni dans git.
4. **Build & run** : `docker compose -f deploy/docker-compose.yml up -d` (pull du repo privé via
   deploy key read-only).
5. **Enregistrer le MCP dans claude.ai** en OAuth2 (comme DailyTickers/Memory/Notification) pointant
   sur `https://substack.dailytickers.com/mcp`.
6. **Smoke test prod** : `list_drafts` (lecture) avant tout `create_draft`/`publish`.

CI/CD : simple — push sur `main` du repo privé → webhook/pull sur la VM → `docker compose up -d --build`.
Rollback = image précédente.

---

## 6. Ce qui nécessite une action interactive de l'utilisateur

Ces étapes **ne peuvent pas** être faites par l'agent (secrets / comptes / infra) :

1. **Login Substack** (interactif) : se connecter à `substack.com/@dailytickers`, récupérer le cookie
   de session (`substack.sid`), le déposer dans le secret store (ou `substack-mcp/.env` en dev local).
   → Sans ce cookie, aucun draft/publish possible.
2. **Créer le repo privé** `dailytickers/substack-mcp` (GitHub) + deploy key read-only pour la VM.
3. **Provisionner la VM Oracle** : instance + firewall (443/80) + DNS `substack.dailytickers.com`.
4. **Secret store** : créer le projet Infisical `substack-mcp`, y mettre `SUBSTACK_COOKIE`,
   `SUBSTACK_PUBLICATION`, `MCP_AUTH_TOKEN`.
5. **Enregistrer le MCP** dans claude.ai (flow OAuth2) une fois l'URL en ligne.
6. **Valider les endpoints reverse-engineered** en live (le premier `create_draft` réel) — c'est le
   moment où on ajuste `substack-client.js` si Substack a changé de schéma.

---

## 7. Risques & garde-fous

- **Endpoints non-officiels instables** : Substack peut casser le schéma sans préavis → tout est isolé
  dans `substack-client.js`, tests de fumée + `whoami` health-check.
- **ProseMirror ≠ Markdown** : la fidélité tableaux/citations dépend du converter markdown→ProseMirror
  (le scaffold couvre paragraphes, titres, listes, gras/italique, liens, blockquote, tables, hr, code).
- **Secret leakage** : cookie = secret sensible. `.gitignore` strict, jamais loggé, jamais dans l'image.
- **HARD STOP** : cookie expiré / 401 / réponse incohérente → stop, notif, pas de publication aveugle.
- **Idempotence** : `create_draft` ne doit pas dupliquer — dédup par `canonical_url` dans le body
  (marqueur) ou check `list_drafts` avant.
