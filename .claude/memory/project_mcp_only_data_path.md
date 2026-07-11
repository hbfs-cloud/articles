---
name: mcp-only-data-path
description: Décision archi 2026-07-11 — la donnée marché passe par le MCP marketdata, PAS les scripts locaux (stockanalysis-fetcher, eu-universe.json, Yahoo direct). Ces scanners locaux sont legacy à migrer/virer.
metadata:
  type: project
---

# Data path = MCP marketdata (décidé 2026-07-11)

**Direction utilisateur** : « tout ces scripts sont a virer, on a le mcp marketdata pour ca ». La donnée
marché (univers, prix, fondamentaux, screening EU/US) passe par **`mcp__marketdata__*`**
(RunScreener/QueryData/GetInstruments/GetMarketContext/RunBacktest), PAS par les fetchers/univers LOCAUX
(`tools/lib/stockanalysis-fetcher.js`, `data/eu-universe.json`, `data/*-universe.json`, Yahoo direct).

**Contrainte à respecter** : un subprocess `node` NE PEUT PAS appeler le MCP (OAuth2, zéro token). Donc tout
scanner/mode qui a besoin de données MCP doit être une **ÉTAPE AGENT** (l'agent /scanner, ou un sous-agent de
workflow — pas un `node` dans publish-daily-card.sh), qui appelle le MCP → écrit un pool dans signals.json →
le node downstream (sweep/gen-status) lit le pool committé. C'est déjà le pattern du **top-10** (agent MCP) et
du **staging dtx** (agent MCP → ingest). Les nouveaux modes (eu_smallcap, event-driven, quality fondamentale
du factor) suivent ce pattern, pas un fetcher local.

**Chantier séparé à planifier** : MIGRER les scanners locaux JS (momentum/etf/highvol/fractal/trendline/…
qui lisent des univers locaux + Yahoo) vers le MCP, et VIRER les fetchers/univers legacy. Ne PAS faire de
mass-delete brutal (risqué) — migration mode par mode, gated. Voir [[systematic-north-star]] (sim-only) et
le pattern staging dtx.

**Impact immédiat** : le scanner EU-PEA (`eu_smallcap`) est construit 100% MCP (agent-produit), pas via
eu-universe.json/stockanalysis-fetcher.
