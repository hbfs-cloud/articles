---
name: oauth2-migration
description: "Migration OAuth2 MCPs — plus aucun token en .env, tous les MCPs enregistrés via claude.ai"
metadata: 
  node_type: memory
  type: project
  originSessionId: ac53259d-133a-4f6b-a082-5b75b9663be7
---

Tous les MCPs sont désormais enregistrés via OAuth2 dans Claude Code / claude.ai. Aucun token en .env requis.

**MCPs enregistrés :**
- DailyTickers (`https://mcp.dailytickers.com/mcp`) — données marché, screening, backtesting, portfolio
- Memory (`https://memory.hbfs-cloud.com/mcp`) — mémoire long-terme partagée entre agents
- Telegram — notifications via MCP enregistré (plus de TELEGRAM_BOT_TOKEN)
- Broker Simulator (`https://simulator.dailytickers.com/`) — via MCP OAuth2

**Why:** Sécurité + simplicité. Plus de secrets qui traînent dans .env, plus de MCP_GATEWAY_URL à exporter manuellement. Élimine les incidents de stub silencieux quand l'env var est oubliée.

**How to apply:** Ne JAMAIS ajouter de token en .env. Ne JAMAIS exporter MCP_GATEWAY_URL. Les scripts sont lancés par Claude Code qui a accès aux MCPs. Si un script a besoin de données MCP, utiliser les outils MCP déjà enregistrés. Fichiers mis à jour : CLAUDE.md, `.claude/skills/scanner-pipeline.md`, `.claude/skills/trading-executor.md`.

**Migration date :** 2026-06-20. Annoncée par l'utilisateur, appliquée dans la session.
