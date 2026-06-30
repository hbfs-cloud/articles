---
name: feedback-mcp-hard-stop
description: "If MCP DailyTickers blocks or returns weird data, stop ALL article generation/correction immediately. Never substitute with invented data."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ac53259d-133a-4f6b-a082-5b75b9663be7
---

Si le MCP DailyTickers bloque (auth expirée, timeout, erreur réseau) ou renvoie des données incohérentes (prix aberrants, NaN, valeurs stale > 48h) : STOP IMMÉDIAT de toute génération ou correction d'article.

**Why:** Session du 2026-06-21 — un fork agent a halluciné 100% des données d'une rétrospective H1 (META +32% au lieu de -15%, MRVL +27% au lieu de +276%, XOM +42% au lieu de -9%, palmarès entièrement inversé tops/flops). Le MCP était down, l'agent a inventé tous les chiffres. Catastrophique pour la crédibilité du site.

**How to apply:** Avant toute publication de données chiffrées (prix, YTD, performances sectorielles), vérifier que le MCP DailyTickers est connecté ET que les données renvoyées sont fraîches (< 48h). Si le MCP tombe en cours de tâche, suspendre et signaler. Lié à [[feedback-no-hallucination]].
