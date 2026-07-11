---
name: mcp-eu-coverage-gap
description: 2026-07-11 — le MCP marketdata sert l'EU en per-ticker (QueryData quote/profile.country/mcap/EUR) mais NE PEUT PAS alimenter un scanner EU : ~3 barres OHLCV EU seulement + aucune énumération EU (RunScreener region=eu → 0, GetReferentialData region=eu renvoie la DB US). Scanner eu_smallcap BLOQUÉ jusqu'au backfill MCP.
metadata:
  type: project
---

# Couverture EU du MCP marketdata = insuffisante pour un scanner (diag 2026-07-11)

Workflow EU-PEA (100% MCP, sim-only) a diagnostiqué la vraie couverture EU du MCP `marketdata`.
Verdict : **BLOCKED_MCP_EU** — rien fabriqué, rien commité (MCP HARD STOP + [[mcp-only-data-path]]).

## Ce qui MARCHE (per-ticker via QueryData)
`QueryData(symbols=..., types=...)` sert bien l'EU en per-ticker : `quote` (price/marketCap/volume/52w/EUR),
`profile` (**country/domicile** — SEUL discriminant PEA vérifiable via MCP : AIR.PA=Netherlands, ALO.PA=France,
VLA.PA=France…), `stats` (float/shares/beta), `metadata` (venue+currency, PAS de country).

## Ce qui est CASSÉ pour un scanner (2 blockers indépendants)
1. **Pas d'historique OHLCV EU** : `bars_daily` EU = ~3 séances (earliest 2026-07-08) → aucun indicateur
   momentum/ATR/breakout ni niveau entrée/stop calculable.
2. **Pas d'énumération EU** : `RunScreener region=eu` → 0 pour tout pass_expr (gate 200 barres : 3764/3764
   skipped « insufficient history » ; 0 SILENCIEUX sur le chemin custom pass_expr). `GetReferentialData
   region=eu` ignore la région → renvoie la DB US (NVDA/GOOGL, 0 ticker EU, pas de colonne country).
`GetStatus`=healthy (22775 symbols) → PAS un down réseau, une couverture données EU insuffisante.

## Le « il faut faire » = côté MCP/data-team (par priorité)
1. **Backfill OHLCV EU à ≥250 barres** (idéalement 2-5 ans) dans cache screener ET QueryData bars_daily —
   fix racine (débloque gate 200-barres + calcul indicateurs).
2. `RunScreener region=eu` opérationnel + warning[] sur le chemin custom pass_expr (0 silencieux aujourd'hui).
3. Vraie **énumération EU** : filtre region réel sur GetReferentialData (ou reference-list EU dédiée) AVEC
   colonne country/HQ pour filtrer le domicile dès l'énumération.
4. Exposer `country` dans les rows candidats du screener (aujourd'hui via profile seulement, 1 appel/ticker).
5. Gaps secmaster : STLA.MI (aucune donnée), BC8.DE (mcap=0), VWS.CO (mcap en DKK au lieu d'EUR).

## Conséquence opérationnelle
Le mode `eu_smallcap` reste en SPEC (`docs/specs/eu-smallcap-pea-scanner.md`), inactif. **NE PAS re-tenter
le scanner EU avant le backfill MCP.** Une fois l'EU backfillé côté MCP → rejouer le workflow
`scratchpad/eu-pea-scanner.mjs` (McpDataPrep passera OK au lieu de BLOCKED_MCP_EU). Voir
[[systematic-north-star]] (sim-only) et [[mcp-only-data-path]] (pas de fetchers locaux).
