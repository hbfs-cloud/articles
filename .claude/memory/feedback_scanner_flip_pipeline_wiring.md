---
name: mcp-primary-flip-requires-pipeline-wiring
description: Un flip scanner MCP-primary (retrait fetch local) n'est PAS complet sans câbler le pipeline. Un node subprocess ne peut pas appeler le MCP → si publish-daily-card.sh appelle le scanner sans --ingest, 0 signal en run auto (régression silencieuse masquée par || non-blocking). Livrer flip + staging-check/--ingest + producteur agent Phase 1 + e2e dans le même lot.
metadata:
  type: feedback
---

# GOTCHA — un flip MCP-primary DOIT inclure le câblage pipeline (sinon 0 signal)

**Incident 2026-07-12** : 10 scanners basculés MCP-primary (retrait fetch Yahoo/univers local) mais
`publish-daily-card.sh` les appelait encore SANS `--ingest` → les scanners refusaient de tourner
(exit propre « fournir --ingest ») → **0 signal en run auto**, masqué par `|| echo non-blocking` =
régression de prod silencieuse. Seul candlestick avait été correctement câblé.

**Cause** : un subprocess `node` NE PEUT PAS appeler le MCP (OAuth2, zéro token). Le staging (univers +
barres via le namespace marketdata de l'agent) est produit par l'**AGENT** (`/scanner` local ou
`claude -p` cloud), pas par le node du shell.

**Why** : retirer le fetch local d'un scanner sans lui fournir la voie MCP côté pipeline le laisse sans
AUCUNE source → 0 signal. Le `|| non-blocking` du shell cache la panne — `node --check` passe, mais la prod
est cassée.

**How to apply** : un flip MCP-primary DOIT livrer dans le MÊME lot (sinon ne pas flipper) :
1. Retrait fetch local du scanner (`--ingest` devient seul chemin).
2. `publish-daily-card.sh` — pattern candlestick :
   `X_STAGE="${X_STAGE:-/tmp/x-stage.json}"; if [ -f "$X_STAGE" ]; then node x-scanner.js --ingest "$X_STAGE" …; else echo "skip non-bloquant"; fi`
3. Skill `/scanner` Phase 1 — l'AGENT produit `/tmp/x-stage.json` via `RunScreener`+`QueryData bars_daily`
   AVANT le shell.
4. Vérif **e2e** : produire staging → `--ingest` → signaux > 0 + marqueur `_scanRuns`. Pas juste
   `node --check`.

Réparé commit `aa92811d7` (e2e prouvé : momentum 2 / etf 5 / factor 5 signaux). Modèle de référence =
**candlestick**. Voir [[migration-local-to-mcp-rollout]] + [[mcp-only-data-path]].
