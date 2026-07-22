---
name: scanner-pipeline-fixes-20260722
description: Fixes pipeline /scanner (2026-07-22) — risk-metrics via --ingest MCP connecté, Telegram via MCP, no double-sweep, capital_flow invalide, connector flapping
metadata:
  type: feedback
---

Corrections apportées le 2026-07-22 après un run /scanner lent (~30 min) et buggé. Doctrine « le MCP fait foi » (OAuth2, ZÉRO token → un subprocess `node` ne peut PAS appeler le MCP).

**1. `refresh-risk-metrics.js` → voie `--ingest` (MCP connecté).**
Le script tentait `MCP_GATEWAY_URL=https://mcp.dailytickers.com/mcp` en HTTP direct → le endpoint OAuth2 renvoie « Authorization required » (pas du JSON) → VaR/stress/correlation/regime échouaient. Fix : `node tools/refresh-risk-metrics.js --ingest risk-mcp.json` où l'AGENT écrit `{regimeProbability:<facets.regime>, modes:{<id>:{var95_5d,stressScenarios,...}}}` (GetMarketContext facets=regime + PortfolioRisk sur modes AVEC positions). Mode à 0 position ouverte → `{reason:"no_positions"}` (correct, PAS un stub). Message auth-fail rendu actionnable.

**2. Telegram via le MCP notification connecté.**
`publish-daily-card.sh` a un nouveau flag `--no-telegram` (skip Steps 8/9/10 token-based, garde image+push+QA). L'AGENT envoie ensuite `send_message(to="alerts", format="html", ...)` — HTML only, ZÉRO terme interne (pas de « MCP »/« dtx »/noms de scripts), voix EDITORIAL_STYLE.

**3. Double-sweep évité.** `/scanner` lance `sweep.js` UNE fois (≈5-7 min CPU-bound), puis `publish-daily-card.sh --no-sweep --no-telegram` (sinon re-sweep de 7 min inutile — c'était le vrai time-sink).

**4. `capital_flow` N'EST PAS un data_type valide** (« unknown data_type »). Smart-money = `dark_pool`/`unusual_options`/`trading_signals`/`insider_transactions`. Retiré des listes d'enrichissement dans la commande + le skill.

**5. Corrélation MCP** (`PortfolioRisk action=correlation`) souvent cassée côté serveur (« 0 common trading days » même sur large-caps US) ; mélanger des tickers EU `.PA` avec US casse aussi le calc → US-only. Fallback : concentration manuelle (max 2/secteur + dispersion géo). NE JAMAIS inventer de rho/VaR.

**6. Connector `marketdata` instable** : se déregistre du toolset après quelques appels (redéploiements serveur, ex. build 1ecd5eb 23:51Z). Reconnexion : l'utilisateur lance `/mcp` (l'agent ne peut pas forcer). Batcher agressivement ; gros payloads → fichiers `tool-results`, parser jq/node, pas re-fetch. Voir aussi [[mcp-marketdata-flapping]].

**7. Mode « bull »/candlestick = SUPPRIMÉ (été 2026)** : ne plus l'exécuter (pas de `candlestick-scanner.js`, pas de marqueur `_candlestickScan` attendu).

**Why:** Respecter le HARD STOP (ne jamais fabriquer/skipper) tout en finissant le pipeline sur un connector OAuth2 + serveur instable.

**How to apply:** À chaque /scanner : Phase 5 = sweep(1×) → refresh-risk-metrics --ingest → gen-* → dtx-pool-bridge → `publish-daily-card.sh --no-sweep --no-telegram` → Telegram via MCP. Enrichissement sans `capital_flow`. Corrélation US-only + fallback manuel.
