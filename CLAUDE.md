# CLAUDE.md - Market Watch Articles Project

## Project Overview
Site de publication d'analyses financières institutionnelles hebdomadaires et ponctuelles, hébergé sur GitHub Pages à market-watch.xyz.

## Structure du Projet
```
articles/
├── index.html                    # Page d'accueil (galerie des rapports)
├── assets/style.css              # CSS global (landing page)
├── weekly/                       # Rapports hebdomadaires
│   ├── YYYYMMDD/                 # Format de nommage: date du lundi
│   │   ├── index.html            # Article HTML complet
│   │   └── assets/report.css     # CSS spécifique au rapport
│   └── assets/                   # Assets partagés weekly
├── CLAUDE.md                     # Ce fichier (instructions pour Claude)
├── PROMPT.md                     # Prompts détaillés pour chaque type d'analyse
└── CNAME                         # DNS: market-watch.xyz
```

## MCP Gateway
Le projet utilise un MCP Gateway MarketWatch disponible via les outils `mcp__claude_ai_Gateway__*`.
- **GetMarketOverview**: Snapshot complet du marché (indices, commodities, crypto, rates, sentiment, news)
- **QueryData**: 58 types de données (quotes, bars, technicals, sentiment, news, earnings, etc.)
- **GetInstruments**: Analyse complète d'un symbole (nécessite paramètre `symbols`)
- **RunAutoScreener**: Screener auto-adaptatif avec détection de régime
- **RunScreener**: Screener DSL personnalisé
- **CalculateOptionsGreeks**: Calcul des Greeks pour options
- **AnalyzeOptionsStrategy**: Analyse de stratégies multi-legs
- **LLMAnalysis**: Analyse DeepSeek

## Commandes Utilisateur

### "Nouvelle analyse weekly" / "Update l'article pour next week"
1. Lire le dernier article weekly pour référence (structure HTML + CSS)
2. Collecter les données via MCP Gateway:
   - `GetMarketOverview` (deep) pour snapshot global
   - `QueryData` types: quote, bars_daily pour SPY, QQQ, DIA, IWM, GLD, SLV, USO, TLT, EFA, EEM, FXI, BTC-USD, ETH-USD
   - `QueryData` types: quote pour les cryptos (SOL-USD, XRP-USD, DOGE-USD)
   - WebSearch pour: CPI/inflation, earnings calendar semaine prochaine, géopolitique (Ukraine, Venezuela, Chine), sector rotation, Fed/FOMC
3. Créer le dossier `weekly/YYYYMMDD/` (date du lundi de la semaine couverte)
4. Copier le CSS du dernier article comme base
5. Créer index.html avec toutes les sections (voir PROMPT.md)
6. Mettre à jour index.html principal (ajouter la nouvelle carte en premier, passer l'ancienne en "Archive")
7. Langue: Français, ton institutionnel mais accessible

### "Analyse [TICKER]" (ex: "Analyse BMNR", "Analyse BTC")
1. Collecter via MCP:
   - `GetInstruments` symbols=[TICKER]
   - `QueryData` types: quote,bars_daily,bars_intraday,financials,earnings_quarterly,holders,stats,support_resistance,volume_profile,sentiment_overall,trading_signals,analyst_actions,insider_transactions,ctb,news
   - `QueryData` types: options_chain si applicable
2. Recherche web pour actualités récentes
3. Générer l'analyse complète en 12 sections (voir PROMPT.md pour le template)
4. Format: Article HTML dans un nouveau dossier ou section de l'article weekly

## Conventions
- **Langue**: Français avec accents corrects
- **CSS**: Réutiliser report.css existant, customiser dans `<style>` inline
- **GTM**: Toujours inclure Google Tag Manager (GTM-T5Z595CW)
- **Fonts**: Inter (Google Fonts) + Font Awesome 6.4.0
- **Charts**: ApexCharts + ECharts
- **Responsive**: Mobile-first, breakpoints 768px et 480px
- **Données**: Toujours citer les sources, disclaimer en bas
- **Badges**: badge-red (alerte), badge-blue (info), badge-green (positif), badge-purple (spécial)
- **Classes CSS**: content-card, data-table, metric-grid/metric-card, risk-matrix/risk-item, pedagogy-box, didactic-box, alert-box, geo-alert, calendar-days-grid
