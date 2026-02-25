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
│   │   │   ├── index.html            # Article HTML complet
│   └── assets/                   # Assets partagés weekly
├── analyses/                     # Analyses individuelles par ticker
│   ├── {TICKER}/                 # Dossier par ticker (ex: AAPL/)
│   │   ├── index.html            # Default = beginner/en
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
│       ├── index.html            # Default = beginner/en
│       └── variants.json         # Manifest des variantes (optionnel)
├── scanner/                      # Scans quotidiens algorithmiques
│   └── YYYYMMDD/                 # Format de nommage: date du scan
│       ├── index.html            # Default = beginner/en
│       ├── variants.json         # Manifest des variantes
│       ├── expert/{en,ar}/       # Variantes expert
│       └── beginner/{fr,en,ar}/  # Variantes débutant
│   └── retrospective/            # Rétrospective hebdomadaire du scanner
│       ├── index.html            # Latest = dernière rétrospective
│       ├── variants.json         # Manifest avec archives
│       └── archive/YYYYMMDD/     # Versions précédentes
├── lab/                          # Output Evidence.dev (fichiers statiques commités)
│   ├── index.html                # Dashboard (built by Evidence)
│   ├── explorer/index.html       # Stock Explorer
│   ├── sectors/index.html        # Sector Deep Dive
│   ├── regions/index.html        # Geographic Analysis
│   ├── valuations/index.html     # Valuation Lab
│   ├── earnings/index.html       # Earnings Tracker
│   └── _app/...                  # Assets Evidence (JS, CSS, DuckDB WASM)
├── lab-src/                      # Source Evidence (pas servi par GH Pages)
│   ├── pages/                    # 6 pages Markdown + SQL
│   ├── sources/market/stocks.csv # Dataset 146 stocks
│   ├── evidence.config.yaml
│   └── package.json
├── CLAUDE.md                     # Ce fichier (instructions pour Claude)
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
4. Utiliser impérativement le CSS global: `<link rel="stylesheet" href="/assets/report.css">`
5. Créer index.html avec toutes les sections (voir weekly/CLAUDE.md)
6. Mettre à jour index.html principal (ajouter la nouvelle carte en premier, passer l'ancienne en "Archive")
7. Langue: Français, ton institutionnel mais accessible

### "Analyse [TICKER]" (ex: "Analyse BMNR", "Analyse BTC")
Par défaut, génère **toutes les 6 variantes** (expert + beginner) × (fr + en + ar).
L'utilisateur peut restreindre avec des paramètres : `analyse AAPL expert fr` ou `analyse AAPL beginner en`.

1. **Parser les paramètres** :
   - `level` : beginner, expert (défaut: **beginner**)
   - `langs` : en, fr, ar (défaut: **en**)
   - Combinaisons par défaut = 6 variantes : expert/fr, expert/en, expert/ar, beginner/fr, beginner/en, beginner/ar
2. **Si l'analyse existe déjà** : archiver l'ancienne version
   - Créer `analyses/{TICKER}/archive/{YYYYMMDD}/` (date de l'ancienne analyse)
   - Déplacer l'ancien `index.html` dans l'archive
3. **Collecter via MCP** :
   - `GetInstruments` symbols=[TICKER]
   - `QueryData` types: quote,bars_daily,bars_intraday,financials,earnings_quarterly,holders,stats,support_resistance,volume_profile,sentiment_overall,trading_signals,analyst_actions,insider_transactions,ctb,news
   - `QueryData` types: options_chain si applicable
4. Recherche web pour actualités récentes
5. **Générer la version expert/fr d'abord** (= `analyses/{TICKER}/index.html`, le root)
   - Inclure le switcher langue/niveau dans le hero
   - Utiliser ECharts au maximum (radar, treemap, gauge, bar, pie, heatmap, line)
   - **OBLIGATOIRE** : Inclure une section **Trade Idea** quand c'est pertinent (voir ci-dessous)
   - **OBLIGATOIRE** : Inclure une section **Social Radar** avec analyse du sentiment (StockTwits, Reddit) et un `socialChart` ECharts, comme dans l'article TARA.
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
     "default": { "level": "beginner", "lang": "en" },
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
8. **Section Trade Idea** (obligatoire quand pertinent — actions, ETF, crypto tradables) :
   - Utiliser la classe CSS `trade-box` avec `trade-levels` (entry, stop, TP1, TP2, R/R)
   - **Entrée** : zone de prix avec justification technique (support, EMA, pullback, breakout)
   - **Stop Loss** : niveau d'invalidation technique clair (sous support, 52W low, EMA 200)
   - **TP1 / TP2** : objectifs échelonnés avec raisonnement (consensus, résistance, retracement)
   - **R/R** : ratio risk/reward minimum 1:1.5
   - **Thèse du trade** : dans un `pedagogy-box`, expliquer le setup en 3-4 phrases
   - **Signaux de renforcement** : 4 triggers bullish dans un bloc vert (`background:#f0fdf4; border:1px solid #16a34a`)
   - **Signaux d'annulation** : 4 triggers d'invalidation dans un bloc rouge (`background:#fef2f2; border:1px solid #dc2626`)
   - **Timing & Sizing** : dans un `alert-box`, préciser horizon (swing/moyen terme), catalyseurs calendrier, sizing (% portefeuille), beta, entrée échelonnée
   - Ajouter un lien `<a href="#trade" class="nav-item">Trade Idea</a>` dans la navigation
   - **Non pertinent pour** : indices (STOXX600, KOSPI), thématiques (STABLECOINS), devises (EURUSD) sauf si trade FX explicite
9. Mettre à jour la modale Historique avec les versions archivées
10. Mettre à jour index.html principal (carte avec data-grade + badge)

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
4. **Utiliser le css dark**: `<link rel="stylesheet" href="/assets/report-dark.css">`
5. **Mettre à jour le tab Daily** dans index.html (ajouter la carte du jour)

#### Spécificités Samedi (post-séance vendredi)
Le briefing du samedi est un **briefing complet** qui couvre la séance de vendredi :
- **Toutes les sections standard** : US, Europe, Asie-Pacifique (récap de la séance de vendredi)
- **Bilan hebdomadaire** : récap de la semaine complète (performances 5 jours)
- Crypto (marchés 24/7) : analyse technique BTC, ETH, alts
- Géopolitique : impacts attendus sur l'ouverture lundi
- **Preview semaine prochaine** : earnings, macro, événements clés
- Formation : sujet standard

#### Spécificités Dimanche (marchés fermés)
Le dimanche est le seul jour **crypto-only + géopolitique** :
- Focus crypto (marchés 24/7) : analyse technique détaillée BTC, ETH, alts
- Focus géopolitique : impacts attendus sur l'ouverture lundi
- Pas de sections US/EU/AP (marchés fermés, déjà couverts samedi)
- Formation : sujet plus long/approfondi (ex: "Introduction au Volume Profile")
- Preview lundi : catalyseurs, niveaux à surveiller

#### Plan de Formation Progressive
Les "Formation du Jour" suivent un cursus progressif :
- **Semaine 1** : Bases (indices, lire un graphe, bid/ask, VIX)
- **Semaine 2** : Technique (RSI, MACD, supports/résistances, moyennes mobiles)
- **Semaine 3** : Fondamentaux (P/E, EPS, marges, free cash flow, earnings)
- **Semaine 4** : Avancé (options basics, vol implicite, corrélations, régimes)
- Puis cycle recommence avec des sujets plus avancés

### "Scanner" / "Scan du jour"
1. **Lire la dernière rétrospective** (`scanner/retrospective/index.html`) :
   - Extraire la note globale, hit rates par stratégie, top/flop setups
   - Identifier les stratégies qui sous-performent → réduire leur poids
   - Identifier les secteurs à faux signaux → les éviter ou filtrer plus strict
   - Lister les tickers récemment floppés → les exclure
   - Ajuster les stops si la rétro signale des stops trop serrés/larges
2. **Lire le scan précédent** (`scanner/YYYYMMDD/` le plus récent) :
   - Extraire les 10 tickers pour le filtre anti-doublon (min 70% nouveaux tickers)
3. **Collecter via MCP** :
   - `RunAutoScreener` pour détection du régime + candidats
   - `RunScreener` avec 3 DSL complémentaires (oversold, momentum, breakout)
   - `RunScreener` avec symboles EU : VGK, EWG, EWQ, EWU, SAP, ASML, BBVA, TTE, SIE, LVMHF
   - `RunScreener` avec symboles APAC : EWJ, EWY, EWH, FXI, MCHI
   - `RunScreener` avec ETFs sectoriels/thématiques : XLF, XLE, XLK, XLV, XLI, GLD, SLV, TLT, ARKK, ICLN
   - `QueryData` types: quote,insider_transactions pour **tous** les candidats retenus (validation prix spot obligatoire + détection des achats significatifs d'insiders)
   - **Contrôle P0** : Rejeter tout ticker dont le prix d'entrée calculé diffère de >10% du prix spot
4. **Sélection finale — 10 setups A+** :
   - Score composite ≥ 85/100, confluence technique ≥ 3 signaux
   - **Diversification géographique obligatoire** : min 5 US + 2 EU + 1 APAC + 2 ETFs
   - En régime Risk-Off/Early Risk-Off : min 20% de setups short ou hedges (GLD, TLT, SH, SQQQ)
   - Pondérer les stratégies selon le hit rate de la dernière rétrospective
5. **WebSearch** pour catalyseurs récents de chaque ticker retenu
6. **Créer `scanner/YYYYMMDD/index.html`** (thème light) :
   - Mentionner en intro : "Suite à la rétrospective du DD/MM (note X, hit rate Y%), nous avons ajusté [Z]"
   - Badge géographique sur chaque setup (US 🇺🇸 / Europe 🇪🇺 / Asia 🌏 / ETF 📊)
   - Voir `scanner/CLAUDE.md` Section 5 pour le template complet
7. Créer les variantes multilangue/multiniveau
8. Mettre à jour le tab Scanner dans index.html

### "Rétrospective Scanner" / "Rétro scanner"
Rétrospective hebdomadaire qui évalue les scans des 10 derniers jours et note le scanner.

1. **Lister les scans récents** : Lire tous les `scanner/YYYYMMDD/index.html` des 10 derniers jours
2. **Extraire les setups** : Pour chaque scan, extraire les 10 tickers avec entry/stop/TP/stratégie
3. **Collecter les prix actuels** via MCP :
   - `QueryData` types=quote,bars_daily symbols={tous les tickers}
   - Calculer : hit rate TP1, hit rate TP2, stop rate, P&L moyen
4. **Archiver la version précédente** (si existante) :
   - Déplacer `scanner/retrospective/index.html` → `scanner/retrospective/archive/YYYYMMDD/`
5. **Créer `scanner/retrospective/index.html`** avec :
   - Note globale (A+ à F), dashboard rapide, tableau de tous les setups
   - Analyse par stratégie, top 3 / flop 3, leçons & améliorations
   - Bouton Historique pour naviguer les versions précédentes
6. **Mettre à jour le tab Scanner** dans index.html (ajouter la carte rétrospective)
7. Voir scanner/CLAUDE.md pour le template complet

### Landing Page (index.html) — Tabs
5 tabs principaux : **Hebdo** (weekly), **Daily** (briefing quotidien), **Analyses** (analyses individuelles), **Scanner** (scans quotidiens), **Portfolio** (stratégies systématiques).
- URL state : `?tab=daily`, `?tab=analyses`, `?tab=scanner`, `?tab=portfolio`
- Grade filter : `?grade=A` (tab analyses uniquement)
- Recherche : symbole ticker uniquement
- Mobile : les tabs s'affichent en grille d'icones (5 colonnes) au lieu de texte horizontal
- **Ordre des cartes** (**OBLIGATOIRE**) : Dans tous les tabs, les cartes `.report-card` sont **toujours triées par date décroissante** (plus récent en haut). Exception : dans le tab Scanner, le bloc "Performance du Scanner" reste fixe en tout premier (avant les cartes). Les rétrospectives et scans sont ensuite mélangés et triés strictement par date.

## Conventions
- **Langue**: Anglais beginner par défaut, multilingue optionnel (fr, en, ar, de, es, zh, ja)
- **CSS**: Utiliser EXCLUSIVEMENT le CSS global via racine: `<link rel="stylesheet" href="/assets/report.css">` ou `report-dark.css` pour le scanner. Ne plus jamais recréer le dossier `assets/` localement.
- **Pas de CSS inline** (**OBLIGATOIRE**) : Ne JAMAIS utiliser d'attribut `style="..."` sur les éléments HTML. Toujours utiliser les classes CSS définies dans `report.css` / `report-dark.css`. Si une nouvelle classe est nécessaire, l'ajouter dans le CSS global. Les seules exceptions tolérées sont les `style` sur les conteneurs ECharts (`width`/`height` dynamiques).
- **GTM**: Toujours inclure Google Tag Manager (GTM-T5Z595CW)
- **Fonts**: Inter (Google Fonts) + Font Awesome 6.4.0
- **Charts**: ApexCharts + ECharts
- **Responsive**: Mobile-first, breakpoints 768px et 480px
- **Données**: Toujours citer les sources, disclaimer en bas
- **Logo brand-bar** (**OBLIGATOIRE**) : Dans les pages d'analyses individuelles (`analyses/{TICKER}/`), le `ticker-header` doit **TOUJOURS** utiliser le logo Market Watch (`<img src="https://market-watch.xyz/logo.svg" alt="MW">`), **JAMAIS** le logo de la société. Le logo de la société (parqet.com) est réservé **uniquement** aux cartes de listing dans `index.html`.
- **Logo société dans index.html** : Sur la landing page (cartes `.report-card`), utiliser `<img src="https://assets.parqet.com/logos/symbol/{TICKER}?format=jpg">` avec fallback initiales. Pour les tickers européens, utiliser le ticker court (AIR, AF, ENX) et non AIR.PA.
- **Accents** (**OBLIGATOIRE**) : Toujours utiliser les caractères accentués français (é, è, ê, ë, à, â, ù, û, ô, î, ï, ç). Ne JAMAIS écrire "resultat" → écrire "résultat", "benefice" → "bénéfice", "marche" → "marché", "premiere" → "première", etc. Les entités HTML (`&eacute;`, `&agrave;`) sont acceptables dans le HTML mais les caractères UTF-8 directs sont préférés.
- **Badges**: badge-red (alerte), badge-blue (info), badge-green (positif), badge-purple (spécial)
- **Classes CSS**: content-card, data-table, metric-grid/metric-card, risk-matrix/risk-item, pedagogy-box, didactic-box, alert-box, geo-alert, calendar-days-grid
- **Tags** (**OBLIGATOIRE**) : Chaque `.report-card` dans `index.html` **doit** avoir un attribut `data-tags="tag1,tag2,..."`. Taxonomie :
  | Catégorie | Tags | Couleur CSS |
  |-----------|------|-------------|
  | Région | `us`, `eu`, `asia`, `crypto`, `commodity`, `forex`, `etf` | Bleu (`data-cat="region"`) |
  | Secteur | `tech`, `semis`, `healthcare`, `energy`, `financials`, `industrials`, `materials`, `consumer`, `defense` | Vert (`data-cat="sector"`) |
  | Thème | `ai`, `earnings`, `geopolitique`, `macro`, `technique`, `options`, `dividende`, `small-cap`, `speculative` | Violet (`data-cat="theme"`) |
  | Contenu | `trade-idea`, `formation`, `retrospective` | Ambre (`data-cat="content"`) |
  - Les tags sont rendus automatiquement en chips colorés par le JS (`tagMeta` object)
  - Cliquer sur un tag active le filtre global (AND cumulatif)
- **URL params** : `?tab=daily`, `?grade=A`, `?tags=crypto,ai` — tous combinables
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
  - `every friday at 23:00 articles rétrospective scanner` — Rétrospective scanner hebdo Ven 23h
  - `every sunday at 18:00 articles nouvelle analyse weekly` — Weekly hebdo
  - `schedules` / `list` — Lister toutes les tâches planifiées
  - `pause #1` / `resume #1` / `cancel #1` / `run #1` — Gérer les tâches

### Tâches actives

| Tâche | Schedule | Commande Discord |
|-------|----------|-----------------|
| Briefing Daily | Tous les jours 7h00 | `every day at 07:00 articles analyse daily` |
| Scanner Quotidien | Lun-Ven 23h00 | `every weekday at 23:00 articles scan du jour` |
| Rétrospective Scanner | Vendredi 23h00 | `every friday at 23:00 articles rétrospective scanner` |
