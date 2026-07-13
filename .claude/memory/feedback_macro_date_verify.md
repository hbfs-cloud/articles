---
name: macro-date-verify-before-publish
description: Toute date d'événement macro (CPI/FOMC/PPI/PCE/NFP…) citée dans un digest de signaux ou un daily DOIT être vérifiée (MCP economic_events + WebSearch/BLS si le MCP ne couvre pas) AVANT publication. NE JAMAIS asserter un jour non vérifié. Le feed MCP economic_events est INCOMPLET (pas de CPI/FOMC) — ticket owner déposé.
metadata:
  type: feedback
---

# Vérifier toute date macro avant de la publier (incident CPI 2026-07-13)

**Incident** : un digest swing-signals du 10/07 a annoncé « CPI **lundi** 8h30 » et a construit toute sa
thèse timing dessus (« tri ce soir, demi-taille avant le chiffre »). FAUX : le CPI (juin) sort **mardi
14/07/2026 8h30 ET** (BLS). Le skill a asserté « lundi » de mémoire.

**Cause racine** : le feed MCP `economic_events` est INCOMPLET — il ne renvoie que Retail Sales + Jobless
Claims (hebdo) + NFP. **Aucun CPI, FOMC, PPI, PCE, ISM, GDP.** Le skill n'avait donc aucune date MCP à
vérifier → il a comblé le trou = hallucination. La règle « zéro fabrication » suppose que le MCP a la
donnée ; ici il ne l'a pas. Ticket owner : `docs/specs/mcp-economic-calendar-request.md`.

**Conséquence supplémentaire** : `is_near_economic_event()` (DSL) que le /scanner utilise pour DROP/tag un
titre proche d'un event macro s'appuie sur ce même feed → **aveugle au CPI/FOMC** (les 2 events les plus
market-moving). Le garde-fou de proximité macro ne se déclenche jamais dessus tant que le feed n'est pas
complété.

**Why** : une date macro fausse fait dérailler tout le cadrage risque d'un digest (demi-taille avant le
mauvais jour), et casse la crédibilité (« quelle erreur »).

**How to apply** : dans TOUT skill qui cite une date macro (swing-signals, signals-desk,
macro-event-playbook, daily) : (1) tenter `QueryData(types='economic_events')` sur la fenêtre ; (2) si
l'event (CPI/FOMC/PPI/PCE) n'y est PAS — ce qui est le cas aujourd'hui — vérifier via WebSearch (BLS/Fed/BEA)
AVANT d'écrire une date + heure ; (3) si non vérifiable, écrire « CPI cette semaine (vérifier la date) » et
NE JAMAIS asserter un jour précis. Ne jamais publier une date macro non vérifiée. Voir [[mcp-only-data-path]].
