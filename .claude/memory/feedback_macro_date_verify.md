---
name: macro-date-verify-before-publish
description: Toute date d'événement macro (CPI/FOMC/PPI/PCE/NFP…) citée dans un digest de signaux ou un daily DOIT être vérifiée AVANT publication ; jamais asserter un jour non vérifié. RÉSOLU 2026-07-13 (v115) : le feed MCP economic_events était un faux générateur synthétique (CPI hallucination) → remplacé par un calendrier officiel curé (BLS/Fed/BEA), CPI 14/07 08:30 + FOMC 29/07 vérifiés, is_near_economic_event effectif. Vérifier via MCP en priorité (WebSearch = fallback).
metadata:
  type: feedback
---

# Vérifier toute date macro avant de la publier (incident CPI 2026-07-13)

**Incident** : un digest swing-signals du 10/07 a annoncé « CPI **lundi** 8h30 » et a construit toute sa
thèse timing dessus (« tri ce soir, demi-taille avant le chiffre »). FAUX : le CPI (juin) sort **mardi
14/07/2026 8h30 ET** (BLS). Le skill a asserté « lundi » de mémoire.

**Cause racine (pire que « incomplet »)** : `economic_events` était un **faux générateur synthétique** — le
« parser Yahoo » ignorait le HTML et FABRIQUAIT des dates par heuristiques (CPI≈« le 13 », table FOMC
2025-only donc morte en 2026, aucun PPI/PCE/GDP/ISM/Michigan). Le skill a « vérifié » contre une date
inventée par le MCP lui-même → hallucination des deux côtés.

## ✅ RÉSOLU côté MCP (v115, 2026-07-13, owner)
Remplacé par un **calendrier curé depuis les sources officielles** (BLS/Fed/BEA/Census) : dates exactes H2
2026 pour CPI/PPI/Core PCE/GDP/FOMC(+minutes)/Retail + récurrents calculés par règle (Jobless Claims jeudi,
NFP 1er vendredi, ISM, Michigan), tous avec **heure ET** (`time_et`). Vérifié live par l'owner : CPI
**2026-07-14 08:30 high**, FOMC **2026-07-29 14:00 high**. Bugs collatéraux corrigés : `EqualFold("US","USD")`
toujours faux → `is_near_economic_event` ne se déclenchait JAMAIS (mappé USD→US) ; `SetEconomicEvents` absent
du chemin custom pass_expr (is_near renvoyait false en silence) → ajouté. **`is_near('USD',2,2)` renvoie
maintenant des candidats (0 avant).** Ticket : `docs/specs/mcp-economic-calendar-request.md` (résolu).
⇒ Les skills signaux PEUVENT désormais vérifier la date macro **via MCP** (`economic_events`) — plus besoin
du fallback WebSearch en temps normal. Le gating `is_near_economic_event` du /scanner est effectif.

**Conséquence supplémentaire** : `is_near_economic_event()` (DSL) que le /scanner utilise pour DROP/tag un
titre proche d'un event macro s'appuie sur ce même feed → **aveugle au CPI/FOMC** (les 2 events les plus
market-moving). Le garde-fou de proximité macro ne se déclenche jamais dessus tant que le feed n'est pas
complété.

**Why** : une date macro fausse fait dérailler tout le cadrage risque d'un digest (demi-taille avant le
mauvais jour), et casse la crédibilité (« quelle erreur »).

**How to apply** (depuis v115, feed fiable) : dans TOUT skill qui cite une date macro (swing-signals,
signals-desk, macro-event-playbook, daily) : (1) `QueryData(types='economic_events')` sur la fenêtre —
le feed est maintenant curé/officiel, CPI/FOMC/PPI/PCE/GDP présents avec `time_et` ; utiliser CETTE date ;
(2) fallback WebSearch (BLS/Fed/BEA) SEULEMENT si le MCP est down/incohérent ; (3) si non vérifiable, écrire
« CPI cette semaine (vérifier la date) », JAMAIS un jour précis. Ne jamais publier une date macro non
vérifiée. Le gating `is_near_economic_event` du /scanner est de nouveau effectif. Voir [[mcp-only-data-path]].
