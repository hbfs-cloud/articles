---
name: scanner-20260924-owner-decisions
description: Décisions du propriétaire du 2026-09-24 pour le scanner — DTX en compare_only (aucune stratégie éligible au live) et reprise trading_signals toutes les 2 min, plafonnée ; périmètre = scan du 24/09.
metadata:
  type: project
---

**Contexte (2026-09-24, ~09:10 Paris).** `DtxCatalog(eligible_for_live=true)` renvoyait une liste vide :
aucune stratégie systematic n'était servie en décision (etf_us : lifecycle_not_production,
reference_stats_not_viable, viability_bar_not_met), alors que config/scanner-components.json exige DTX
depuis le 21/09. En parallèle, americanbulls (trading_signals, source requise) expirait sur 7 à 15 symboles.

**Décisions du propriétaire**, réponses à une question posée par la session :
1. DTX → `compare_only` : évaluation de recherche sans actions, affichée comme informative ; jamais
   d'ordre ni de candidat dtx_pool. Posée pour le scan du 24/09 ; à redemander si le catalogue reste vide.
2. trading_signals : « refait des retry jusqu'à tout avoir mais pas en attendant des heures, retry toutes
   les 2m ». Mise en œuvre : reprise ciblée des seuls appels en échec, toutes les 120 s, plafond de
   30 min (15 tentatives), puis HARD STOP. La source reste requise.

**Why:** sans ces décisions, le scan du 24/09 ne pouvait passer ni la chaîne B (DTX) ni la chaîne A
(enrichissement). Un relecteur senior sans accès à la conversation a jugé ces attributions invérifiables :
cette note est la trace.

**Décisions de suivi (2026-09-24 ~10:00 Paris), même mode :**
3. DTX compare_only **jusqu'à nouvel ordre** : tant que le catalogue live est vide ; retour automatique au mode décision dès qu'une stratégie redevient éligible.
4. Formulaire **S-8 non bloquant** (règle durable) : plan salarié, pas une levée ; S-3/424B/ATM/convertibles/3.02/PIPE restent bloquants.
5. Scan du 24/09 : dérogation au minimum 6 actions + 2 ETF, pour cette séance seulement, affichée sur la page ; jamais de remplissage.
6. MSST ratifié dans les exclusions de symboles.

**How to apply:** ne pas étendre compare_only aux scans suivants sans nouvelle décision si le catalogue
live est toujours vide. Les fichiers qui citent ces décisions renvoient à cette note. Voir
[[yahoo-store-holes-pin-source]].
