---
name: mcp-eu-coverage-gap
description: 2026-07-11 — RÉSOLU (backfill MCP le soir même) : OHLCV EU backfillé (AIR.PA 395 barres) + RunScreener region=EU renvoie des candidats → scanner eu_smallcap DÉBLOQUÉ. Résiduels : pas de country dans les rows screener (filtre PEA par ticker QueryData profile.country) + exclure UK/.L + market_cap=0 sur certains.
metadata:
  type: project
---

# Couverture EU du MCP marketdata — BLOQUÉE puis RÉSOLUE le 2026-07-11

## ✅ RÉSOLU (soir 2026-07-11, backfill côté MCP)
L'owner du MCP a livré le backfill EU (brief `docs/specs/mcp-eu-coverage-request.md`). Vérifié en session :
- **Blocker 1 (OHLCV) LEVÉ** : `QueryData(AIR.PA, bars_daily, days=400)` → **395 barres** (2025-06-09→2026-07-08),
  au lieu de ~3. Les indicateurs/ATR EU sont calculables.
- **Blocker 2 (énumération) LEVÉ** : `RunScreener(region='EU', pass_expr='close>0')` → **20+ candidats**
  (ready_symbols 3762/3763), le gate 200-barres passe. Avant = 0.
- ⇒ **Scanner `eu_smallcap` DÉBLOQUÉ, constructible.** Re-jouer `scratchpad/eu-pea-scanner.mjs`.

## Résiduels (non bloquants, à finir côté MCP — brief owner)
- **Pas de champ `country` dans les rows du screener** (blocker 4) → le filtre PEA par domicile se fait
  encore **par ticker** via `QueryData(types='profile').country` (UE/EEE ; EXCLURE UK/GB et les listings
  `.L` de Londres, non PEA-éligibles). Le top-N non-rankté remonte des `0Axx.L` (artefact alphabétique).
- **`market_cap: 0`** sur des rows (gap secmaster) → mcap à récupérer via QueryData quote par ticker.
- `GetReferentialData region=eu` : à re-vérifier (avant : ignorait la région → DB US).

## Contexte diag initial (avant fix) — pour mémoire
Workflow EU-PEA (100% MCP, sim-only) avait diagnostiqué : **BLOCKED_MCP_EU** — rien fabriqué, rien commité
(MCP HARD STOP + [[mcp-only-data-path]]).

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
