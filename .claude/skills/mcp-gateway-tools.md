---
name: mcp-gateway-tools
description: MCP market-data tools and data source strategy. Auto-load when user calls QueryData, GetMarketOverview, GetInstruments, RunAutoScreener, RunScreener, GetRegimeProbability, GetCorrelationMatrix, GetEarningsCalendarFiltered, OptimizeSizing, or any mcp__claude_ai_marketdata__* tool. Includes Yahoo Finance fallback rules and Polymarket integration.
user_invocable: false
---

# MCP Market Data

Outils `mcp__claude_ai_marketdata__*` (ex-Gateway/DailyTickers — namespaces morts) :
- **GetMarketOverview**: Snapshot global (indices, commodities, crypto, rates, sentiment, news). Contient aussi : **trending topics**, **sector variations**, **economic calendar**, **earnings calendar** — exploiter ces champs pour enrichir les articles.
- **QueryData**: 58 types de données (quotes, bars, technicals, sentiment, news, earnings, etc.)
- **GetInstruments**: Analyse complète d'un symbole (`symbols` requis)
- **RunAutoScreener**: Screener auto-adaptatif + détection de régime
- **RunScreener**: Screener DSL personnalisé
- **CalculateOptionsGreeks** / **AnalyzeOptionsStrategy**
- **GetRegimeProbability**: model=ensemble, horizon=5 → probabilités RISK-ON, NEUTRAL, EARLY-RISK-OFF, RISK-OFF, RECOVERY
- **GetCorrelationMatrix**: window=60, pearson — max_pair.rho > 0.85 = drop ; avg_off_diagonal > 0.65 = forcer min 2 secteurs
- **GetEarningsCalendarFiltered**: days_ahead=7, min_expected_move=4 → exclusion_window
- **OptimizeSizing**: mode, method=vol_target, max_position_risk_pct, max_pairwise_correlation

## Stratégie Sources de Données (PRIORITÉS)

| Donnée | Source primaire | Fallback |
|--------|----------------|---------|
| Prix spot / variation | Yahoo Finance (live-tracker.js) | MCP `QueryData` types=quote |
| Graphique de prix (chart HTML) | Yahoo Finance `query1/v8/finance/chart/` via proxy | MCP `QueryData` types=bars_daily,bars_intraday |
| Fondamentaux (PE, EPS, market cap…) | Yahoo Finance `query1/v10/finance/quoteSummary/` via proxy | MCP `QueryData` types=financials,stats |
| **Socials & flows** | **MCP `QueryData` types=social_sentiment,capital_flow** — **TOUJOURS, dans TOUS les articles** | — |
| Calendrier éco / earnings | `GetMarketOverview` (champs calendar/earnings) | Browser (Google) |
| Trending / rotation sectorielle | `GetMarketOverview` (champs trending/sectors) | Browser (Google) |
| Insider transactions | MCP `QueryData` types=insider_transactions | Browser (Google) SEC |

**Règles clés** :
- `social_sentiment` et `capital_flow` → **OBLIGATOIRES** dans chaque QueryData pour les tickers analysés (scanner, analyse, daily watch)
- `bars_daily` / `bars_intraday` → utiliser Yahoo Finance directement dans le HTML pour les charts ECharts. MCP seulement si Yahoo échoue.
- `financials` / `stats` → idem, Yahoo `quoteSummary` en primaire. MCP en fallback.
- Calendriers → toujours commencer par `GetMarketOverview` avant le browser (évite les appels redondants).

## Polymarket — Marchés Prédictifs
Intégrer dans **tous les types d'articles** quand pertinent. Signal **complémentaire**, jamais la base d'une thèse.
- `Browser: rechercher "polymarket {sujet}" site:polymarket.com`
- Données clés : probabilité (%), volume ($), tendance vs 7j
- Toujours mentionner le volume et comparer au consensus institutionnel
- Format : `<div class="didactic-box">` avec lien `source-ref` vers Polymarket
- **Où** : Géopolitique, Macro, Crypto, Outlook, Matrice des Risques, Catalyseurs scanner
