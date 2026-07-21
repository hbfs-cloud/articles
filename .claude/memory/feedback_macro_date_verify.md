---
name: macro-date-verify-before-publish
description: Toute date d'événement macro (CPI/FOMC/PPI/PCE/NFP…) citée dans un digest de signaux ou un daily DOIT être vérifiée AVANT publication ; jamais asserter un jour non vérifié. RÉSOLU 2026-07-13 (v115) : le feed MCP economic_events était un faux générateur synthétique (CPI hallucination) → remplacé par un calendrier officiel curé (BLS/Fed/BEA), CPI 14/07 08:30 + FOMC 29/07 vérifiés, is_near_economic_event effectif. Vérifier via MCP en priorité (WebSearch = fallback).
metadata:
  type: feedback
---

**Règle :** dans TOUT skill/article qui cite une date macro (swing-signals, signals-desk, macro-event-playbook, daily), vérifier la date AVANT de publier — jamais l'asserter de mémoire.

**Why :** une date macro fausse fait dérailler tout le cadrage risque d'un digest (ex. « demi-taille avant le chiffre » posée sur le mauvais jour) et casse la crédibilité. Incident 2026-07-13 : un digest a annoncé « CPI lundi 8h30 » alors que le CPI (juin) sortait mardi 14/07 8h30 ET.

**How to apply :**
1. `QueryData(types='economic_events')` sur la fenêtre — le feed est curé/officiel (CPI/PPI/Core PCE/GDP/FOMC+minutes/Retail avec `time_et`, récurrents calculés : Jobless Claims jeudi, NFP 1er vendredi, ISM, Michigan). Utiliser CETTE date.
2. Fallback WebSearch (BLS/Fed/BEA) SEULEMENT si le MCP est down/incohérent.
3. Si non vérifiable : écrire « CPI cette semaine (vérifier la date) », JAMAIS un jour précis.

Le gating `is_near_economic_event()` du /scanner s'appuie sur ce même feed (mapping `is_near('USD',2,2)`) et est effectif.

*Historique : le feed `economic_events` était avant v115 (2026-07-13) un faux générateur synthétique qui fabriquait les dates par heuristiques (CPI≈« le 13 », FOMC 2025-only) → hallucination ; remplacé par le calendrier officiel curé, `is_near_economic_event` réparé (bug `EqualFold("US","USD")` + `SetEconomicEvents` absent du chemin custom pass_expr). Ticket `docs/specs/mcp-economic-calendar-request.md` résolu.* Voir [[mcp-only-data-path]].
