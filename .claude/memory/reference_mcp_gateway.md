---
name: mcp-gateway-url-deprecated
description: "OBSOLÈTE — MCP_GATEWAY_URL remplacé par OAuth2 depuis 2026-06-20. Voir [[oauth2-migration]]"
metadata: 
  node_type: memory
  type: reference
  originSessionId: ac53259d-133a-4f6b-a082-5b75b9663be7
---

**OBSOLÈTE depuis 2026-06-20.** Plus besoin d'exporter `MCP_GATEWAY_URL` — le MCP market-data est enregistré via OAuth2 dans Claude Code. Namespace outils courant : `mcp__claude_ai_marketdata__*` (les namespaces `mcp__claude_ai_Gateway__*`, `mcp__claude_ai_DailyTickers__*` et `mcp__dailytickers__*` sont morts).

Voir [[oauth2-migration]] pour le nouveau modèle.
