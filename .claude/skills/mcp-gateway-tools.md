---
name: mcp-gateway-tools
description: MCP market-data tools and data source strategy. Auto-load when user calls QueryData, GetMarketContext, GetInstruments, RunAutoScreener, RunScreener, Jobs, PortfolioRisk, GetEarningsCalendarFiltered, GetStatus, OptionsAnalytics, or any mcp__claude_ai_marketdata__* tool. Includes Yahoo Finance fallback rules and Polymarket integration.
user_invocable: false
---

# MCP Market Data

Outils `mcp__claude_ai_marketdata__*` (ex-Gateway/DailyTickers — namespaces morts).

**⚠️ Surface v5 consolidée** : les anciens noms ci-dessous (GetMarketOverview, GetRegimeProbability,
GetCorrelationMatrix, OptimizeSizing, CheckJobStatus/ListJobs, GetHealth/GetVersion, CalculatePortfolioVaR,
GetPortfolioStressTest, GetPredictionMarkets, GetSeasonality, GetCOTReport) restent des **alias serveur**
(le HTTP direct marche encore) mais ne sont **plus découvrables via ToolSearch** — toujours utiliser les
noms canoniques ci-dessous pour que l'agent puisse charger l'outil.

- **QueryData**: 58 types de données (quotes, bars, technicals, sentiment, news, earnings, etc.) — inchangé
- **GetInstruments**: Analyse complète d'un symbole (`symbols` requis) — inchangé
- **RunAutoScreener** / **RunScreener** / **RunBacktest** / **ScreenOptions** — inchangés
- **GetMarketContext(facets=...)** — remplace GetMarketOverview/GetRegimeProbability/GetPredictionMarkets/GetSeasonality/GetCOTReport :
  - `facets='overview'` (ex-GetMarketOverview) : snapshot global (indices, commodities, crypto, rates, sentiment, news, trending topics, sector variations, economic calendar, earnings calendar) — **async, appelé SEUL (non combinable), poller via `Jobs`**
  - `facets='regime', model='ensemble', horizon_days=5` (ex-GetRegimeProbability) → probabilités RISK-ON, NEUTRAL, EARLY-RISK-OFF, RISK-OFF, RECOVERY
  - `facets='prediction_markets'` (ex-GetPredictionMarkets), `facets='cot'` + `symbol` (ex-GetCOTReport), `facets='seasonality'` + `symbol` (ex-GetSeasonality) — ces facets **FAST sont combinables en un seul appel**
- **`Jobs(job_id=...)` / `Jobs(intent_id=...)`** — remplace CheckJobStatus/ListJobs (poll des jobs async : RunScreener, RunAutoScreener, RunBacktest, GetMarketContext facets='overview')
- **PortfolioRisk(action=...)** — remplace GetCorrelationMatrix/OptimizeSizing/CalculatePortfolioVaR/GetPortfolioStressTest :
  - `action='correlation', symbols='AAPL,MSFT'` (CSV, pas un array JSON !), `lookback_days`, `method` — ex-GetCorrelationMatrix
  - `action='sizing', signals=[JSON], constraints={JSON}, mode` — ex-OptimizeSizing
  - `action='var'` — ex-CalculatePortfolioVaR ; `action='stress'` — ex-GetPortfolioStressTest
- **GetStatus** — remplace GetHealth/GetVersion
- **OptionsAnalytics** — remplace GetOptionsSentiment/CalculateOptionsGreeks/CalculatePortfolioGreeks/CalculateSABRVolatility/AnalyzeOptionsStrategy (vérifier les actions disponibles via sa description au moment de l'appel)
- **GetEarningsCalendarFiltered**: days_ahead=7, min_expected_move=4 → exclusion_window — inchangé
- **SUPPRIMÉS sans remplaçant direct** (retirer toute référence, ne plus appeler) : ScreenFundamentals, SaveDiscovery, ValidateDiscovery, GetTopDiscoveries, GetDiscoveryStats

## Stratégie Sources de Données (PRIORITÉS)

| Donnée | Source primaire | Fallback |
|--------|----------------|---------|
| Prix spot / variation | Yahoo Finance (live-tracker.js) | MCP `QueryData` types=quote |
| Graphique de prix (chart HTML) | Yahoo Finance `query1/v8/finance/chart/` via proxy | MCP `QueryData` types=bars_daily,bars_intraday |
| Fondamentaux (PE, EPS, market cap…) | Yahoo Finance `query1/v10/finance/quoteSummary/` via proxy | MCP `QueryData` types=financials,stats |
| **Socials & flows** | **MCP `QueryData` types=social_sentiment,capital_flow** — **TOUJOURS, dans TOUS les articles** | — |
| Calendrier éco / earnings | `GetMarketContext(facets='overview')` (champs calendar/earnings) | Browser (Google) |
| Trending / rotation sectorielle | `GetMarketContext(facets='overview')` (champs trending/sectors) | Browser (Google) |
| Insider transactions | MCP `QueryData` types=insider_transactions | Browser (Google) SEC |

**Règles clés** :
- `social_sentiment` et `capital_flow` → **OBLIGATOIRES** dans chaque QueryData pour les tickers analysés (scanner, analyse, daily watch)
- `bars_daily` / `bars_intraday` → utiliser Yahoo Finance directement dans le HTML pour les charts ECharts. MCP seulement si Yahoo échoue.
- `financials` / `stats` → idem, Yahoo `quoteSummary` en primaire. MCP en fallback.
- Calendriers → toujours commencer par `GetMarketContext(facets='overview')` avant le browser (évite les appels redondants).

## Polymarket — Marchés Prédictifs
Intégrer dans **tous les types d'articles** quand pertinent. Signal **complémentaire**, jamais la base d'une thèse.
- `Browser: rechercher "polymarket {sujet}" site:polymarket.com`
- Données clés : probabilité (%), volume ($), tendance vs 7j
- Toujours mentionner le volume et comparer au consensus institutionnel
- Format : `<div class="didactic-box">` avec lien `source-ref` vers Polymarket
- **Où** : Géopolitique, Macro, Crypto, Outlook, Matrice des Risques, Catalyseurs scanner
