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
├── analyses/                     # Analyses individuelles par ticker
│   ├── {TICKER}/                 # Dossier par ticker (ex: AAPL/)
│   │   ├── index.html            # Default = expert/fr (rétrocompatible)
│   │   ├── assets/report.css     # CSS partagé toutes variantes
│   │   ├── variants.json         # Manifest des variantes disponibles
│   │   ├── expert/               # Niveau expert
│   │   │   ├── fr/index.html     # Français expert
│   │   │   ├── en/index.html     # English expert
│   │   │   └── ar/index.html     # العربية expert
│   │   ├── intermediate/         # Niveau intermédiaire
│   │   │   └── fr/index.html
│   │   ├── beginner/             # Niveau débutant
│   │   │   └── fr/index.html
│   │   └── archive/              # Versions précédentes
│   │       └── YYYYMMDD/
│   │           └── index.html
├── scanner/                      # Scans quotidiens algorithmiques
│   └── YYYYMMDD/                 # Format de nommage: date du scan
│       ├── index.html            # Default = expert/fr
│       ├── assets/report.css     # CSS spécifique (thème dark)
│       ├── variants.json         # Manifest des variantes
│       ├── expert/{en,ar}/       # Variantes expert
│       └── beginner/{fr,en,ar}/  # Variantes débutant
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
Par défaut, génère **toutes les 6 variantes** (expert + beginner) × (fr + en + ar).
L'utilisateur peut restreindre avec des paramètres : `analyse AAPL expert fr` ou `analyse AAPL beginner en`.

1. **Parser les paramètres** :
   - `level` : beginner, expert (défaut: **les deux**)
   - `langs` : fr, en, ar (défaut: **les trois**)
   - Combinaisons par défaut = 6 variantes : expert/fr, expert/en, expert/ar, beginner/fr, beginner/en, beginner/ar
2. **Si l'analyse existe déjà** : archiver l'ancienne version
   - Créer `analyses/{TICKER}/archive/{YYYYMMDD}/` (date de l'ancienne analyse)
   - Déplacer l'ancien `index.html` dans l'archive
   - Copier le CSS dans l'archive
3. **Collecter via MCP** :
   - `GetInstruments` symbols=[TICKER]
   - `QueryData` types: quote,bars_daily,bars_intraday,financials,earnings_quarterly,holders,stats,support_resistance,volume_profile,sentiment_overall,trading_signals,analyst_actions,insider_transactions,ctb,news
   - `QueryData` types: options_chain si applicable
4. Recherche web pour actualités récentes
5. **Générer la version expert/fr d'abord** (= `analyses/{TICKER}/index.html`, le root)
   - Inclure le switcher langue/niveau dans le hero
   - Utiliser ECharts au maximum (radar, treemap, gauge, bar, pie, heatmap, line)
6. **Générer les 5 autres variantes** en parallèle (via agents) :
   - `analyses/{TICKER}/expert/en/index.html` — traduction anglaise expert
   - `analyses/{TICKER}/expert/ar/index.html` — traduction arabe expert (dir="rtl")
   - `analyses/{TICKER}/beginner/fr/index.html` — version simplifiée FR
   - `analyses/{TICKER}/beginner/en/index.html` — version simplifiée EN
   - `analyses/{TICKER}/beginner/ar/index.html` — version simplifiée AR (dir="rtl")
   - Adapter le contenu selon le niveau (beginner = plus pédagogique, moins de jargon)
   - Adapter la langue (traduire tout le contenu)
   - Chaque variante inclut le switcher pour naviguer entre les versions
7. **Créer/mettre à jour `variants.json`** dans le dossier ticker :
   ```json
   {
     "ticker": "AAPL",
     "default": { "level": "expert", "lang": "fr" },
     "variants": [
       { "level": "expert", "lang": "fr", "path": "." },
       { "level": "expert", "lang": "en", "path": "expert/en" },
       { "level": "expert", "lang": "ar", "path": "expert/ar" },
       { "level": "beginner", "lang": "fr", "path": "beginner/fr" },
       { "level": "beginner", "lang": "en", "path": "beginner/en" },
       { "level": "beginner", "lang": "ar", "path": "beginner/ar" }
     ],
     "date": "YYYY-MM-DD"
   }
   ```
8. Mettre à jour la modale Historique avec les versions archivées
9. Mettre à jour index.html principal (carte avec data-grade + badge)

### "Scanner" / "Scan du jour"
1. Collecter via MCP:
   - `RunAutoScreener` pour détection du régime + candidats
   - `RunScreener` avec 3 DSL complémentaires (oversold, momentum, breakout)
   - `QueryData` types: quote pour les 10 tickers retenus
2. WebSearch pour catalyseurs récents
3. Créer `scanner/YYYYMMDD/index.html` (thème dark)
4. Créer les variantes multilangue/multiniveau
5. Mettre à jour le tab Scanner dans index.html
6. Voir PROMPT.md Section 5 pour le template complet

### Landing Page (index.html) — Tabs
4 tabs principaux : **Hebdo** (weekly), **Analyses** (analyses individuelles), **Scanner** (scans quotidiens), **Portfolio** (stratégies systématiques).
- URL state : `?tab=analyses`, `?tab=scanner`, `?tab=portfolio`
- Grade filter : `?grade=A` (tab analyses uniquement)
- Recherche : symbole ticker uniquement

## Conventions
- **Langue**: Français par défaut, multilingue optionnel (fr, en, ar, de, es, zh, ja)
- **CSS**: Réutiliser report.css existant, customiser dans `<style>` inline
- **GTM**: Toujours inclure Google Tag Manager (GTM-T5Z595CW)
- **Fonts**: Inter (Google Fonts) + Font Awesome 6.4.0
- **Charts**: ApexCharts + ECharts
- **Responsive**: Mobile-first, breakpoints 768px et 480px
- **Données**: Toujours citer les sources, disclaimer en bas
- **Badges**: badge-red (alerte), badge-blue (info), badge-green (positif), badge-purple (spécial)
- **Classes CSS**: content-card, data-table, metric-grid/metric-card, risk-matrix/risk-item, pedagogy-box, didactic-box, alert-box, geo-alert, calendar-days-grid

## Tâches Planifiées (Scheduled Tasks)

Les tâches planifiées sont gérées via le **bot Discord** (`claude-discord-bot`), pas via cron.

### Architecture
- **Bot Discord** : `/Users/marketwatchxyz/GolandProjects/claude-discord-bot/`
- **Schedules** : `claude-discord-bot/schedules.json` (source de vérité)
- **Commandes Discord** :
  - `every weekday at 23:00 articles scan du jour` — Scanner quotidien Lun-Ven 23h
  - `every sunday at 18:00 articles nouvelle analyse weekly` — Weekly hebdo
  - `schedules` / `list` — Lister toutes les tâches planifiées
  - `pause #1` / `resume #1` / `cancel #1` / `run #1` — Gérer les tâches

### Tâches actives

| Tâche | Schedule | Commande Discord |
|-------|----------|-----------------|
| Scanner Quotidien | Lun-Ven 23h00 | `every weekday at 23:00 articles scan du jour` |
