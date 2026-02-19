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
├── daily/                        # Briefings quotidiens
│   └── YYYYMMDD/                 # Format de nommage: date du briefing
│       ├── index.html            # Default = expert/fr
│       ├── assets/report.css     # CSS spécifique
│       └── variants.json         # Manifest des variantes (optionnel)
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

### "Analyse Daily" / "Briefing du jour"
Briefing matinal quotidien publié à 7h00. Couvre US, EU, Asie-Pacifique et Crypto. Le weekend, focus crypto et géopolitique.

1. **Collecter via MCP** :
   - `GetMarketOverview` (deep) pour snapshot global (indices, commodities, crypto, rates, regime, sentiment, news)
   - `QueryData` types: quote,bars_daily pour SPY, QQQ, DIA, IWM, EFA, EEM, FXI, GLD, SLV, USO, TLT, BTC-USD, ETH-USD, SOL-USD, XRP-USD
2. **WebSearch** pour :
   - Calendrier économique du jour/semaine (CPI, FOMC, PMI, GDP, etc.)
   - Actualités géopolitiques majeures (Ukraine, Chine, tariffs, etc.)
   - Earnings calendar du jour
3. **Créer `daily/YYYYMMDD/index.html`** avec les sections :
   - Hero + badges clés du jour
   - Navigation Grid
   - Alerte du jour (événement #1)
   - Dashboard Rapide (4x4 métriques avec badges couleur)
   - Bilan de la veille / semaine passée
   - Agenda du jour & semaine (calendrier Lun-Ven)
   - Marchés US (indices, secteurs, movers)
   - Marchés Europe (DAX, CAC, FTSE)
   - Marchés Asie-Pacifique (Nikkei, HSI, ASX)
   - Crypto (BTC, ETH, alts, niveaux clés)
   - Géopolitique (impacts marché)
   - **Formation du Jour** — leçon pédagogique liée à un événement (ex: "Comprendre le Core PCE", "Lire un carnet d'ordres", "L'impact du VIX")
   - **Idées de Trading** — 2-3 trades swing argumentés avec entrée/stop/target/R:R
   - Ce qu'il faut surveiller aujourd'hui
   - Sources & Disclaimer
4. **Copier le report.css** du scanner comme base CSS
5. **Mettre à jour le tab Daily** dans index.html (ajouter la carte du jour)

#### Spécificités Weekend (Sam-Dim)
- Focus crypto (marchés 24/7) : analyse technique détaillée BTC, ETH, alts
- Focus géopolitique : impacts attendus sur l'ouverture lundi
- Pas de sections US/EU/AP marchés fermés
- Formation : sujet plus long/approfondi (ex: "Introduction au Volume Profile")

#### Plan de Formation Progressive
Les "Formation du Jour" suivent un cursus progressif :
- **Semaine 1** : Bases (indices, lire un graphe, bid/ask, VIX)
- **Semaine 2** : Technique (RSI, MACD, supports/résistances, moyennes mobiles)
- **Semaine 3** : Fondamentaux (P/E, EPS, marges, free cash flow, earnings)
- **Semaine 4** : Avancé (options basics, vol implicite, corrélations, régimes)
- Puis cycle recommence avec des sujets plus avancés

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
5 tabs principaux : **Hebdo** (weekly), **Daily** (briefing quotidien), **Analyses** (analyses individuelles), **Scanner** (scans quotidiens), **Portfolio** (stratégies systématiques).
- URL state : `?tab=daily`, `?tab=analyses`, `?tab=scanner`, `?tab=portfolio`
- Grade filter : `?grade=A` (tab analyses uniquement)
- Recherche : symbole ticker uniquement
- Mobile : les tabs s'affichent en grille d'icones (5 colonnes) au lieu de texte horizontal

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
- **Compteurs de tabs** (**OBLIGATOIRE**) : À chaque ajout d'article, **toujours** mettre à jour le compteur du tab correspondant dans `index.html` :
  - `<span class="tab-count" id="weeklyCount">N</span>` — nombre de cartes dans `#tab-weekly`
  - `<span class="tab-count" id="dailyCount">N</span>` — nombre de cartes dans `#tab-daily`
  - `<span class="tab-count" id="scannerCount">N</span>` — nombre de cartes dans `#tab-scanner`
  - `analysesCount` est calculé dynamiquement par JS (pas de mise à jour manuelle)

## Tâches Planifiées (Scheduled Tasks)

Les tâches planifiées sont gérées via le **bot Discord** (`claude-discord-bot`), pas via cron.

### Architecture
- **Bot Discord** : `/Users/marketwatchxyz/GolandProjects/claude-discord-bot/`
- **Schedules** : `claude-discord-bot/schedules.json` (source de vérité)
- **Commandes Discord** :
  - `every day at 07:00 articles analyse daily` — Briefing quotidien 7h (tous les jours)
  - `every weekday at 23:00 articles scan du jour` — Scanner quotidien Lun-Ven 23h
  - `every sunday at 18:00 articles nouvelle analyse weekly` — Weekly hebdo
  - `schedules` / `list` — Lister toutes les tâches planifiées
  - `pause #1` / `resume #1` / `cancel #1` / `run #1` — Gérer les tâches

### Tâches actives

| Tâche | Schedule | Commande Discord |
|-------|----------|-----------------|
| Briefing Daily | Tous les jours 7h00 | `every day at 07:00 articles analyse daily` |
| Scanner Quotidien | Lun-Ven 23h00 | `every weekday at 23:00 articles scan du jour` |
