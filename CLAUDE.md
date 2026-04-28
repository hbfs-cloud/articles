# CLAUDE.md - DailyTickers Articles Project

## Project Overview
Site de publication d'analyses financières institutionnelles, hébergé sur GitHub Pages.
- **URL articles** : `https://articles.dailytickers.com/` (CNAME = `articles.dailytickers.com`)
- **Landing marketing** : `https://articles.dailytickers.com/` (site séparé, ne sert PAS les articles)
- **IMPORTANT** : Toujours utiliser `articles.dailytickers.com` pour les URLs d'articles

## Structure du Projet
```
articles/
├── assets/                       # CSS + JS global partagé
│   ├── report.css                # Theme light — styles partagés tous articles
│   ├── core.js                   # Tag renderer + filtres + mobile nav + scanner collapse
│   ├── live-tracker.js           # Prix temps réel (Yahoo + Binance)
│   └── style.css                 # Landing page CSS
├── weekly/ daily/ analyses/ scanner/ series/ tech/  # Articles HTML statiques
├── data/                         # Index JSON par tab + search_data.js
├── tools/                        # Scripts de publication et d'analyse
│   ├── publish.js                # ⭐ Script unifié de publication (add_card + git + telegram)
│   ├── add_card.js               # Indexe un article dans le JSON du bon tab
│   ├── sweep.js                  # Grid search backtest (scanner)
│   ├── gen-status-page.js        # Dashboard portfolio 5 modes
│   ├── gen-api.js                # Refresh public JSON API portfolio
│   └── ...                       # Autres outils spécialisés
├── portfolio/v1/                 # Public JSON API (Turbo, Dynamic, Balanced, Secured, Fortress)
├── widget/                       # Widgets embarquables (iframe)
└── mcp/                          # MCP server + watchlist.json
```

## Architecture
- **Stack** : HTML statique + CSS (`report.css`) + JS vanilla (`core.js`) + JSON indexes
- **Pas de framework de build** (Astro supprimé) — les articles sont des fichiers HTML directs
- **Publication** : `node tools/publish.js --type <type> --path <path>` enchaîne tout automatiquement

## MCP Gateway
Outils `mcp__claude_ai_Gateway__*` :
- **GetMarketOverview**: Snapshot global (indices, commodities, crypto, rates, sentiment, news). Contient aussi : **trending topics**, **sector variations**, **economic calendar**, **earnings calendar** — exploiter ces champs pour enrichir les articles.
- **QueryData**: 58 types de données (quotes, bars, technicals, sentiment, news, earnings, etc.)
- **GetInstruments**: Analyse complète d'un symbole (`symbols` requis)

## MCP Forecast — TimesFM 2.5-200M

Serveur : `http://ser.tail5d09f.ts.net:8400/mcp/`
Headers obligatoires : `Content-Type: application/json` + `Accept: application/json, text/event-stream`
Outils : `Forecast`, `ForecastVix`, `ForecastRaw`, `Backtest`
Contraintes : max **10 tickers/call**, `lookback_days` ≤ 60, `context_length` ≤ 200

### ⚠️ RÈGLES D'UTILISATION (validées empiriquement — 120 points, 15 tickers, avril 2026)

**JAMAIS afficher la direction TimesFM comme une prévision certaine.**
- Direction globale = 44.2% (pire que le hasard) — pas un signal tradable seul
- Exception : AMZN, META, SPY → 62–75% DIR sur lookback=20j — utilisable comme filtre de confirmation uniquement

**Ce qui marche (≥ 7/10) :**
- **UC2 — Volatilité** : passer ATR(14) ou RVOL(14) à `ForecastRaw` → DIR 67–73% → sizing dynamique et filtre pre_squeeze
- **UC3 — Volume** : passer la série de volume à `ForecastRaw` → DIR 69% → filtre breakout/faux-breakout
- **UC5 — Rotation sectorielle** : `Forecast` sur 10 ETFs sectoriels → ranking relatif valide (0.4s/ticker)
- **ForecastVix** → sizing et régime de marché ✅

**Ce qui est partiel (5–6/10) :**
- **UC1 — Prix/Close** : bandes CI [q10–q90] utilisables comme zones TP/SL calibrées (~80% couverture réelle). Direction = non fiable sauf AMZN/META/SPY
- **UC6 — Scoring setup** : CI_width + vol + secteur combo utile. `confidence` fixe à 0.95 = inutilisable comme filtre

**Ce qui ne marche pas (2/10) :**
- **UC4 — Earnings/XReg** : XReg non implémenté dans ce wrapper. Le modèle est **pire** autour des earnings (DIR 40% vs 56% hors earnings). → **EXCLURE les fenêtres ±3j autour des earnings dates**
- Quarterly fundamentals (revenue, earnings) : Yahoo < 10 trimestres → "Insufficient data"
- Tickers énergie (XOM : 12%), biotech small cap (SRPT : 25%), TSLA (25%) : direction non fiable

### Utilisation correcte par contexte

**Dans une analyse ticker (section Trade Idea) :**
```
1. context_length=200, lookback=20j (fenêtre optimale)
2. Ticker dans {AMZN, META, SPY, NVDA} → direction utilisable comme filtre
3. Tous tickers → CI [lo–hi] = zones TP/SL calibrées (afficher comme "zone de support/résistance probabiliste")
4. Vérifier earnings ±3j → si oui, suspendre le forecast prix sur ce ticker
5. Ne jamais écrire "TimesFM prédit une hausse" → écrire "CI probabiliste : [X – Y]"
```

**Dans le scanner (post-screener) :**
```
1. ForecastRaw(volume[-150:], horizon=10) → pred_avg > avg20 × 1.1 = volume favorable ✅
2. ForecastRaw(ATR14[-150:], horizon=10) → ATR_forecast > ATR × 1.15 = expansion attendue → éviter
3. ForecastRaw(RVOL14[-150:], horizon=10) → RVOL < × 0.80 = compression probable → squeeze crédible
```

**Dans le weekly (rotation sectorielle) :**
```
Forecast({'tickers': [10 ETFs], 'context': 200, 'horizon': 10})
→ Trier par predicted_return_pct → ranking relatif (NE PAS citer les valeurs absolues)
→ Top 3 = biais long de la semaine | Bottom 3 = biais short / éviter
```

**ForecastVix :**
```
VIX prédit > 30 → doubler les bandes CI sur tous les forecasts prix
VIX prédit en hausse → réduire les tailles de position (sizing ∝ 1/ATR_forecast)
```
- **RunAutoScreener**: Screener auto-adaptatif + détection de régime
- **RunScreener**: Screener DSL personnalisé
- **CalculateOptionsGreeks** / **AnalyzeOptionsStrategy** / **LLMAnalysis**

### Stratégie Sources de Données (PRIORITÉS)

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

## AI Forecast — MCP (`mcp__forecast__*`)
Outils : `Forecast` (multi-ticker), `ForecastRaw` (série brute custom), `ForecastVix` (régime VIX), `Backtest` (validation accuracy).
Service Python + TimesFM sur `ser` (Nomad/Docker, port 8400). Graceful degradation partout — si service down, pipeline continue sans forecast.
**⚠️ XReg/covariates NON implémentées** dans le MCP (modèle TimesFM le supporte mais le wrapper ne l'expose pas → UC4 = FAIL).

### Évaluation empirique (120 points, 15 tickers, 8 fenêtres)

| Use Case | Score | Verdict |
|----------|-------|---------|
| UC1 — Close Forecast (prix) | 6/10 | PARTIEL — 44% direction globale, seulement indices/mega-caps (SPY 62%, AMZN/META 75%) |
| UC2 — Volatilité (ATR/RVOL) | 8/10 | FORT — vol mean-reverting, 67-73% direction, meilleur UC pour pre_squeeze |
| UC3 — Volume | 8.5/10 | TRÈS FORT — 69% direction, filtre breakout actionnable |
| UC4 — Earnings/XReg | 2/10 | FAIL — XReg non implémenté, modèle -16pp autour des earnings |
| UC5 — Multi-séries/Rotation | 7.5/10 | BON — ranking sectoriel cohérent, 0.4s/ticker, spread/ratio |
| UC6 — Scoring de setups | 5/10 | PARTIEL — direction seule = inutile, multi-facteur (CI_width + vol + secteur) = utile |

### Règles d'utilisation (OBLIGATOIRE)

**✅ UTILISER pour :**
- **Bandes CI** = zones TP/SL calibrées (q10-q90 couvre ~80% des réalisations)
- **Volatilité forecast** (ATR/RVOL) = pre_squeeze, sizing dynamique, alerte expansion vol
- **Volume forecast** = filtre faux breakout, confirmation volume, post-screener enrichi
- **Rotation sectorielle** = ranking relatif ETFs sectoriels (hebdo), spread/ratio forecast
- **Filtre de concordance** sur SPY, AMZN, META uniquement (≥62% précision)

**❌ NE PAS UTILISER pour :**
- Direction comme signal primaire (44% global = pire que le hasard)
- Horizon > 10j (bandes trop larges)
- Biotech/small-caps catalytiques (sauts FDA imprévisibles)
- Fenêtres earnings ±5j (exclure ces périodes)
- Confidence brute du modèle (toujours 0.95 = non discriminant, utiliser CI_width à la place)

### Architecture scanner (post-screener)
```
Pour chaque ticker retenu :
1. ForecastRaw(volume[-150:], horizon=10) → pred_avg > avg20×1.1 = volume favorable ✅
2. ForecastRaw(ATR[-150:], horizon=10) → RVOL_forecast < RVOL_now×0.80 = squeeze ✅
3. Forecast({tickers, horizon=10}) → CI haute = TP max réaliste
4. Si mega-cap/indice : direction = filtre confirmation
5. CI_width < 5% = confirmer | > 10% = réduire taille 50%
```

### Architecture rotation (weekly)
```
Chaque lundi :
1. Forecast({tickers: 10_ETFs_sectoriels, context: 200, horizon: 10})
2. Trier par predicted_return_pct → top 3 = biais long, bottom 3 = éviter
3. Spread (XLE/SPY, XLK/SPY) via ForecastRaw → axe macro
```

### Fenêtre optimale
- **Lookback** : 20j pour direction (67% sur mega-caps), 150 bars pour vol/volume
- **Horizon** : 5-10j max

## Commandes Utilisateur

### "Nouvelle analyse weekly"
**Langue par défaut : anglais intermediate.** Voir `weekly/CLAUDE.md` pour le template complet et les 18 sections obligatoires.

1. **Date** : Le weekly couvre la semaine **À VENIR**. Dossier = `weekly/YYYYMMDD/` (YYYYMMDD = lundi). Vérifier anti-doublon : `ls weekly/` ET `grep "YYYYMMDD" data/weekly.json` — NE PAS ajouter si l'URL existe déjà.
2. **Référence** : Lire `weekly/20260223/index.html` pour reproduire le layout exact
3. **Collecte MCP** : `GetMarketOverview` (deep — trending, sector variations, economic calendar) + `QueryData` types=quote,**social_sentiment,capital_flow**,trading_signals (SPY, QQQ, DIA, IWM, GLD, SLV, USO, TLT, EFA, EEM, FXI, BTC-USD, ETH-USD, SOL-USD, XRP-USD) + WebSearch (géopolitique, earnings clés, Polymarket)
4. **Générer** : `weekly/YYYYMMDD/index.html` avec les 18 sections (> 100KB). CSS = `/assets/report.css`. FAB obligatoire, PAS de hero-brand-link.
5. **Indexer + Push** :
   ```bash
   node tools/publish.js --type weekly --path weekly/YYYYMMDD/index.html
   ```

### "Analyse [TICKER]"
Par défaut, génère **une seule variante** : `intermediate/en`.

1. **Si existe déjà** : archiver dans `analyses/{TICKER}/archive/{YYYYMMDD}/`
2. **Collecte MCP** : `GetInstruments` + `QueryData` (quote, **social_sentiment, capital_flow**, sentiment_overall, trading_signals, analyst_actions, insider_transactions, ctb, news, options_chain, support_resistance, volume_profile, earnings_quarterly, holders)
   - `bars_daily`, `bars_intraday` : utiliser Yahoo Finance directement dans le HTML (`query1.finance.yahoo.com/v8/finance/chart/`). MCP uniquement si Yahoo échoue.
   - `financials`, `stats` : utiliser Yahoo `quoteSummary?modules=financialData,defaultKeyStatistics,summaryDetail` en primaire. MCP en fallback.
3. **⚠️ Dilution Check (OBLIGATOIRE)** : `WebSearch "{TICKER} SEC filing S-3 prospectus dilution warrants"` + vérifier `insider_transactions` et `news` pour :
   - Prospectus S-3/shelf registration déposé à la SEC (dilution potentielle)
   - Warrants actifs ou récemment exercés
   - Fonds agressifs connus (H.C. Wainwright, Maxim Group, Roth Capital, Ladenburg Thalmann) dans les underwriters
   - ATM (At-The-Market) offerings en cours
   - Historique de dilutions répétées (serial diluters)
   - **Si risque détecté** : mention obligatoire en rouge dans la section Risks + impact sur le Trade Idea (réduire le score, élargir le stop, ou exclure)
3. **Générer** `analyses/{TICKER}/index.html` :
   - Switcher langue/niveau dans le hero
   - ECharts au maximum (radar, treemap, gauge, bar, pie, heatmap, line)
   - **Section Trade Idea** obligatoire pour tickers tradables (classe `trade-box` + `trade-levels`, R/R ≥ 1:1.5)
   - **Section Social Radar** obligatoire (sentiment StockTwits/Reddit + `socialChart` ECharts)
   - Non pertinent pour indices/thématiques/devises
4. **Créer `variants.json`** dans le dossier ticker
5. **Indexer + Push** :
   ```bash
   node tools/update_history.js analyses/{TICKER}/index.html
   node tools/publish.js --type analysis --path analyses/{TICKER}/index.html
   ```

### "Analyse Daily" / "Briefing du jour"
**Langue par défaut : anglais intermediate.** Voir `daily/CLAUDE.md` pour le template complet et les 17 sections obligatoires.

1. **Collecte MCP** : `GetMarketOverview` (deep — exploiter trending, sector variations, economic calendar, earnings calendar) + `QueryData` types=quote,**social_sentiment,capital_flow**,trading_signals (SPY, QQQ, DIA, IWM, EFA, EEM, FXI, GLD, SLV, USO, TLT, BTC-USD, ETH-USD, SOL-USD, XRP-USD) + WebSearch (géopolitique, Polymarket)
2. **⚠️ ANTI-DOUBLON OBLIGATOIRE** : Avant de lancer add_card.js, vérifier que l'URL `/daily/YYYYMMDD/` n'existe PAS déjà dans `data/daily.json` avec `grep "YYYYMMDD" data/daily.json`. Si elle existe déjà → NE PAS ajouter, signaler le doublon.
3. **Générer** `daily/YYYYMMDD/index.html`. CSS = `/assets/report.css`.
4. **Samedi** = briefing complet (récap vendredi + bilan semaine + preview lundi)
5. **Dimanche** = crypto-only + géopolitique (marchés fermés)
6. **Formation progressive** : cursus 4 semaines cyclique (Bases → Technique → Fondamentaux → Avancé)
7. **Format date obligatoire dans `report-card-meta`** : `DD mois YYYY` en français minuscule (ex: `14 mars 2026`). JAMAIS de format anglais ("March 14"), JAMAIS de majuscule sur le mois ("Mars"), JAMAIS de suffixe ("— Vendredi", "— Tuesday Full Market"), JAMAIS d'espaces superflus.
8. **Indexer + Push** :
   ```bash
   node tools/publish.js --type daily --path daily/YYYYMMDD/index.html
   ```

### "Scanner" / "Scan du jour"
**Langue par défaut : anglais intermediate.** Voir `scanner/CLAUDE.md` pour le template complet, les sections, et la méthodologie.

**⚠️ Convention de date :** Le scanner couvre la **prochaine séance de trading**. Si généré après 22h30 : dossier = D+1 (jour ouvrable suivant). **Vendredi soir → lundi (D+3).**

1. **Lire TOUTES les rétrospectives** (`scanner/retrospective/YYYYMMDD/`) pour cumuler les enseignements
2. **Lire le scan précédent** pour filtre anti-doublon (min 70% nouveaux tickers)
3. **Collecte MCP** : `RunAutoScreener` + `RunScreener` (3 DSL + EU + APAC + ETFs) + `GetMarketOverview` (trending, sectors, calendar) + `GetRegimeProbability` (model=ensemble, horizon=5) + `QueryData` (quote, **social_sentiment, capital_flow, insider_transactions, dark_pool, unusual_options, ftd_threshold, sec_filings, flags**) pour les 10 tickers retenus
4. **⚠️ Dilution Filter v2 MCP-driven (OBLIGATOIRE)** : `QueryData types=sec_filings,flags days=180` par ticker candidat. Disqualification automatique sur :
   - `flags.dilution_risk_score >= 70` ou `flags.shelf_active=true` + S-3 récent
   - `flags.atm_program_active=true` ou `flags.aggressive_underwriter=true` (Wainwright, Maxim, Dawson James, Roth, Ladenburg)
   - `flags.warrants_outstanding` ITM imminents (proximity < 0.20)
   - `flags.recent_pipe` (< 180j) ou `flags.reverse_split_recent` (< 180j)
   - Score 40-69 → **-15 pts + flag obligatoire dans Invalidations**
   - Fallback WebSearch uniquement si `sec_filings` retourne vide pour un micro-cap. Voir `scanner/CLAUDE.md` "Anti-Dilution v2".
5. **⚠️ Risk Gating Post-Screener (OBLIGATOIRE — Risk Layer v1)** : avant de figer le top 10, appliquer 4 vérifs MCP :
   - `GetRegimeProbability` : si `crisis > 0.30` ou `early_risk_off > 0.50` → top réduit à 5, breakout_only, taille × 0.5
   - `GetCorrelationMatrix` (window=60, pearson) : `max_pair.rho > 0.85` → drop le score le plus bas ; `avg_off_diagonal > 0.65` → forcer min 2 secteurs
   - `GetEarningsCalendarFiltered` (days_ahead=7, min_expected_move=4) : si ticker dans `exclusion_window` → DISQUALIFIER ou tag "earnings risk"
   - `OptimizeSizing` (mode=balanced, method=vol_target, max_position_risk_pct=1.0, max_pairwise_correlation=0.7) : utiliser `risk_pct` retourné pour caler les sizes
6. **⚠️ Sharia Compliance Tagging (OBLIGATOIRE)** : Pour chaque ticker retenu, évaluer la conformité Sharia (secteur haram, ratios dette/market cap > 33%, intérêts > 5% du CA, ETFs levier/bonds). Ajouter `data-sharia="true"` ou `data-sharia="false"` sur chaque `<tr>` du synthèse et chaque `<div class="setup-card">`. Voir `scanner/CLAUDE.md` section "Sharia Compliance Tagging" pour les critères complets.
7. **Sélection : 10 setups A+** (score ≥ **90** — relevé de 85 en v4 risk layer, confluence ≥ 3 signaux, diversification géo : min 5 US + 2 EU + 1 APAC + 2 ETFs)
8. **Titre carte OBLIGATOIRE** : `Top 10 A+ {REGIME} — {TICKER1}, ..., {TICKER10}`
9. **Indexer + Push HTML d'abord** (AVANT le pipeline) :
   ```bash
   node tools/publish.js --type scanner --path scanner/YYYYMMDD/index.html --no-notify
   ```
   ⚠️ `--no-notify` obligatoire ici — la notification Telegram est gérée par publish-daily-card.sh (step 8 média).

10. **Pipeline Quotidien (Append-only) — Risk Layer v1** — ⚠️ **AUTOMATIQUE, NE JAMAIS DEMANDER** :
    Après chaque scanner publié (step 9), lancer le pipeline complet **sans demander confirmation**. Le job "scanner du jour" inclut TOUJOURS ce pipeline. NE JAMAIS dire "veux-tu que je lance la suite" ni "reste manuel". Si une étape échoue → diagnostiquer et continuer ; si elle est bloquante → reporter à l'utilisateur après avoir tenté.
    ```bash
    node tools/update-tracking.js           # Tracking exits (prix Yahoo)
    node tools/sweep.js                     # Append-only: ajoute les nouveaux trades fermés (défaut sûr)
    MCP_GATEWAY_URL=https://gateway.dailytickers.com/mcp \
      node tools/refresh-risk-metrics.js    # VaR + stress + correlation + regimeProb → data/risk-snapshots.json
    node tools/gen-status-page.js           # Snapshot J + Dashboard (lit risk-snapshots.json)
    node tools/gen-api.js                   # Refresh public JSONs (50 endpoints, dont risk.json par mode)
    ./tools/publish-daily-card.sh           # Image, sweep, media, Telegram + git push final
    ```
    Sans `MCP_GATEWAY_URL` → `refresh-risk-metrics.js --stub` écrit un schéma vide, le pipeline continue (graceful degradation). **⚠️ MCP_GATEWAY_URL=`https://gateway.dailytickers.com/mcp` est dispo en prod** — TOUJOURS l'exporter, ne jamais accepter le stub silencieusement.

    **Post-pipeline checklist OBLIGATOIRE** (regressions historiques — voir mémoire `feedback_pipeline_gotchas.md`) :
    - QA check (`tools/qa-check.js` — step 7 du publish-daily-card.sh) doit afficher 0 ❌ ; investiguer chaque échec (pas seulement les ⚠️)
    - Vérifier `scanner/status/index.html` pour chaque mode : pas de "Pending (Nd/Md)" sur trades dont l'`exitDate` est passé, comptage "Orders to Place" cohérent avec rangées affichées
    - `data/risk-snapshots.json` ne doit pas être un stub vide si MCP_GATEWAY_URL était set
    - QA strategy-label check lit `signals.json` (pas le HTML) — si modifié, ne pas re-grepper le HTML
    - Date arithmétique shell : tout `date -d` doit avoir un fallback BSD `date -v` (voir helper dans publish-daily-card.sh)

9. **Sweep Stratégique (ON-DEMAND uniquement)** :
   ```bash
   node tools/sweep.js --full-sweep        # Grid search complet — découvre la meilleure stratégie
   ```
   - **Ne se lance JAMAIS automatiquement** — uniquement sur demande explicite de l'utilisateur
   - Met à jour `modes-config.json` avec les paramètres optimaux découverts
   - **Ne touche PAS à l'historique des trades** (`backtest-trades.json` reste intact)
   - Les nouveaux paramètres s'appliquent aux trades **futurs** uniquement
   - Après un sweep stratégique : régénérer status page + API pour refléter la nouvelle config

### "Rétrospective Scanner"
**Langue par défaut : anglais intermediate.** Voir `scanner/CLAUDE.md` section 5bis pour le template complet.

1. Lire tous les scans des 10 derniers jours, extraire les setups
2. Collecter prix actuels via `QueryData` (quote, bars_daily)
3. Créer `scanner/retrospective/YYYYMMDD/index.html` (note unifiée A+ à F = 50% Setup HR + 50% Portfolio Sim via sweep.js, dashboard, tableau, top/flop, equity curve)
4. Mettre à jour redirect `scanner/retrospective/index.html`
5. Mettre à jour le dashboard "Performance du Scanner" dans `index.html` (KPIs + 3 ECharts)
   - **CONVENTION CUMULÉE** : afficher stats sur **TOUTES les rétros** (pas seulement la dernière)
   - KPIs : Hit Rate cumulé (`TP1 / (TP1 + stops)` sur résolu uniquement), meilleur pick all-time, nb scans/setups total, pire pick all-time
   - Période : de la 1ère rétro à la plus récente — label ex: `"Feb 10 – Mar 13, 4 rétros cumulées"`
   - Rétros provisoires (< 60% résolu) : marquées `*` dans labels charts
   - Chart "Hit Rate par Rétro" : un point/barre par rétro + barre orange `% résolu` en overlay (yAxis2)
   - Chart "Top Picks" : best/worst all-time toutes rétros confondues
   - Chart résultats : stacked bars TP1/Stop/Open par rétro (ne jamais masquer les "open")
   - Ne pas skiper les positions ouvertes — les afficher explicitement avec leur count
6. **Indexer + Push** :
   ```bash
   node tools/publish.js --type retro --path scanner/retrospective/YYYYMMDD/index.html
   ```

## Landing Page (index.html)
6 tabs : **Hebdo**, **Daily**, **Analyses**, **Scanner**, **Radar**, **Séries**. Tech dans le footer (`?tab=tech`).
- URL state : `?tab=daily`, `?grade=A`, `?tags=crypto,ai` — combinables
- Cartes toujours triées par date décroissante. Exception : bloc "Performance du Scanner" fixe en premier dans le tab Scanner.
- **⚠️ LECTURE OBLIGATOIRE AVANT GÉNÉRATION** : Avant de générer un article ou d'appeler `add_card.js`, TOUJOURS lire le fichier JSON cible (`data/daily.json`, `data/weekly.json`, etc.) pour :
  1. Vérifier l'absence de doublon par URL
  2. Lire les titres existants pour cohérence
  3. Vérifier le format de date des cartes récentes
  - **Ne JAMAIS skip cette étape** — les doublons viennent systématiquement d'un `add_card.js` lancé sans lecture préalable
- **⚠️ ANTI-DOUBLON CODE** : `add_card.js` filtre désormais par URL pour tous les tabs (daily, weekly, scanner, series, analyses). Mais la vérification manuelle reste obligatoire.
- **Format date `report-card-meta`** : TOUJOURS `DD mois YYYY` en français minuscule (`14 mars 2026`). Ni anglais, ni majuscule sur le mois (`Mars` ❌), ni suffixe textuel (`— Vendredi` ❌), ni espaces superflus.
- Indexation : `node tools/add_card.js chemin/vers/index.html` (JAMAIS modifier les JSON à la main pour ajouter une carte)

## Radar — `data/radar.json`
Mis à jour à chaque publication (daily, weekly, scanner). Rédigé par Claude, pas mécanique.
- 20-30 items, min 4 par catégorie : `risk` (rouge), `event` (ambre), `opportunity` (vert), `regime` (bleu)
- `importance` 1-10 : taille du blip + distance au centre. Labels si ≥ 7.
- `link` : URL relative vers la section exacte (`/daily/YYYYMMDD/#section-id`)
- Supprimer items obsolètes. Opportunités = picks scanner score ≥ 88.

## Live Price Tracker (`assets/live-tracker.js`)
Script partagé pour prix temps réel sur les setup cards. **OBLIGATOIRE pour scanner.**
```html
<script src="/assets/live-tracker.js"></script>
```
- Yahoo Finance via `api.allorigins.win/get` + Binance pour crypto
- Classification : TP2 Hit (or) → TP1 Hit (vert) → Trending (vert) → Entry Zone (ambre) → Underwater (rouge clair) → Near Stop (rouge) → Stopped (gris/grayscale)
- Cache sessionStorage 5 min, max 6 requêtes parallèles

### Proxy CORS — Convention Projet
**TOUJOURS** `api.allorigins.win/get` (pas `/raw` — pas de headers CORS) :
```javascript
var url = 'https://api.allorigins.win/get?url=' + encodeURIComponent(yahooUrl);
fetch(url).then(r => r.json()).then(d => {
  var yahoo = JSON.parse(d.contents); // /get wraps dans { contents: "..." }
});
```
Fallback : `corsproxy.io` (peut retourner 403). **JAMAIS** `allorigins.win/raw`.

## Portfolio API — `/portfolio/v1/`
API publique servant les signaux et l'equity des 5 modes.
- **Modes** : `turbo`, `dynamic`, `balanced`, `secured`, `fortress` — paramètres définis dans `data/modes-config.json` (ajustés par sweep).
- **Endpoints par mode** : `/portfolio/v1/{mode}/[signals|positions|equity|orders|actions|trades|all].json`
- **Documentation** : `https://articles.dailytickers.com/integrations/portfolio/`
- **Génération** : `node tools/gen-api.js` (dépend de `backtest-trades.json` et `scanner-positions.json`).

## Scanner Status Page — Architecture & Time Machine (`scanner/status/`)

**Rule de vie #1 : LIVE est le template canonique. Time Machine = bind data historique dans les sections Live existantes. JAMAIS l'inverse.**

### Pipeline génération
1. `tools/gen-status-page.js` produit `scanner/status/index.html` server-side
2. Pour chaque mode, `panel(id, cfg, m, trades, ec, chartId, active)` génère 7 sections HTML :
   - `1. How to trade` (mode-specific guide, collapsible)
   - `2. Today's Signals` (table tbody from `signalsFor(cfg)`)
   - `3. Equity Curve` (perf-hero with `chart-{modeId}` container, perf-stats values)
   - `4. Close Now` (cta-card if any timed-out positions)
   - `5. Orders to Place` (cta-orders with buy + rotate rows + recentRotation card)
   - `6. Open Positions` (table tbody from current positions)
   - `7. Trade History` (collapsible tbody from `mTrades`)
3. `live-engine-ui.js` ajoute `lp-card` (live ticker strip) + organize sections en `.lp-grid` 2-cols (desktop)
4. `assets/live-engine.js` initialise WebSocket + ticks live sur les position rows

### Time Machine — pattern correct
Slider (`#timeSlider`) → `tmLoadIdx(idx)` :
1. **Capture le live HTML** : `_tmCaptureLive(modeId)` snapshot `panel.querySelector('.lp-grid').innerHTML` au premier swap (cache local `_tmLiveCache`)
2. Fetch `/scanner/status/history/{date}.json`
3. Appel `tmUpdateLive(modeId, snapData, mCfg)` qui :
   - Met à jour les 6 valeurs `.perf-hero .perf-stats .ps .ps-v` (Total Return, DD, WR, PF, Trades, Avg Hold)
   - Re-init le chart `chart-{modeId}` avec `mk(...)` et nouvelle equity
   - Replace `tbody` de Today's Signals, Open Positions, Trade History avec rows formatées depuis snap
4. Banner shows "Viewing snapshot from YYYY-MM-DD"
5. `tmShowLive()` : restore `grid.innerHTML = _tmLiveCache[modeId]`, re-init chart depuis `modeCharts[modeId]`

### ⛔ Anti-patterns (testés en session, ECHECS confirmés)
- ❌ **Phase B v1/v2/v3** : Drop sections Live + tout binder dans un nouveau `mp-host` template (MODE_PANEL_TPL). Casse le grid CSS 2-cols, supprime widgets live (sparkline/gauge/scenario bar), layout linéaire au lieu de dashboard.
- ❌ Switch `display:none` entre `.lp-grid` (Live) et `.tm-render` (TM custom template). Layouts visuellement différents → user confusion.
- ❌ Marquer sections Live `legacy-hidden` + injecter template à côté. Double layout, double charts, double stats.
- ❌ Refactoriser tmRenderInto pour produire HTML diff. Génère ineluctablement un layout différent du Live.

### ✅ Pattern validé (production)
**Le Live HTML est la SOURCE DE VÉRITÉ unique pour le layout.** Le Time Machine ne switche JAMAIS de container — il appelle `tmUpdateLive()` qui édite seulement les `tbody` / valeurs stats / chart data, in-place.

### Si tu dois ajouter une nouvelle section au panel mode :
1. Edit `panel()` dans `tools/gen-status-page.js` pour émettre la nouvelle `<section class="section-card">` avec son `<h3>` unique
2. Ajoute un cas dans `tmUpdateLive()` qui matche par regex sur le `<h3>` text et update son `tbody`/data
3. Si data live (ticker price) : ajouter handlers dans `assets/live-engine.js` `evaluatePosition()` et `live-engine-ui.js` `updateRow()`
4. Test via `node tools/gen-status-page.js && python3 -m http.server 8088 && playwright nav http://localhost:8088/scanner/status/`
5. Test Time Machine click slider → vérifier la section update avec data historique
6. **JAMAIS push sans validation Playwright locale + check console errors**

### Fichiers en jeu (priorité décroissante)
1. `tools/gen-status-page.js` — server-side render (~1900 LOC). Le `panel()` function est à respecter — pas de gros refacto sans validation.
2. `assets/live-engine.js` — WebSocket + position eval (570 LOC). Termine sur SL/TP/EXPIRED via `_terminal` flag.
3. `assets/live-engine-ui.js` — DOM updates per tick (1100 LOC). `createCard`, `buildPositionRows`, `reorganizePanel`.
4. `assets/mode-panel-binder.js` — binder utilitaire (140 LOC). Utilisé pour Time Machine OPTIONAL fallback, peut être supprimé si tmUpdateLive suffit.
5. `tools/gen-api.js` — public API JSON. Lit risk-snapshots.json + history snapshots.

### Stats truth source
- `m.trades` (hero "Closed Trades") = `closedTrades.filter(!_premature).length` (computeMetrics)
- "Trade History" header count = même filter (cohérent)
- `frozen.trades` (sweep computeStatsFromTrades) ≠ ne pas réutiliser pour le hero, inclut les premature

### Rotation tracking
- Quand sweep rotate (close worst, buy candidate) → `closedTrades.push({...worst, status:'rotated', exitDate:day, pnlPct:forcePnl})`
- gen-status-page panel() détecte `recentExecutedRotation` en comparant prevSnap.modes[id].orders ROTATE vs current pos
- Render comme card "JUST EXECUTED" dans la section "Orders to Place"
- Trade row labeled "Rotated" (pas "Pending") via `rotatedKeys` Set + status override

## Widgets (`/widget/`)
- **Galerie** : `/widget/gallery.html` — 6 types avec previews et embed code
- **Types** : `picks` (watchlist), `dashboard` (indicateurs), `regime` (VIX-based), `sector` (rotation), `movers` (top/flop), `radar` (risques)
- Régime dynamique : VIX < 15 RISK-ON, 15-20 NEUTRAL, 20-28 EARLY RISK-OFF, > 28 RISK-OFF
- Proxy : allorigins `/get` + Binance directe. Cache sessionStorage 5 min, polling 30s.

## Conventions HTML (OBLIGATOIRE pour tous les articles)
Les templates complets sont dans les sous-CLAUDE.md (daily/, weekly/, scanner/). Voici les règles transversales :

1. **`<html>`** : `lang="{en|fr|ar}" data-tags="{tags}" data-tab="{type}"` + optionnel `data-level`, `data-grade`
2. **Brand Bar** : `<nav class="brand-bar">` + `brand-bar-inner` + logo `/logo.svg` + **`brand-nav`** (menu principal : Hebdo, Daily, Analyses, Scanner, Radar, Séries). TOUJOURS présent. Le lien actif est auto-highlight via CSS `data-tab` (pas de `class="active"` en dur).
3. **Tags** : `<div id="article-clickable-tags" class="card-tags"></div>` dans le hero. Peuplé par `tag-renderer.js`.
4. **FAB** : `<div class="fnav">` avec 6 items. Obligatoire pour scanner, daily, analyses, tech, series. Pas pour weekly.
5. **Footer** : `<footer class="article-footer">`. JAMAIS `report-footer`, `site-footer`, etc.
6. **Scripts** : `core.js` + `tag-renderer.js` avant `</body>`. Ajouter `echarts-responsive.js` si ECharts, `live-tracker.js` si scanner.
7. **CSS** : EXCLUSIVEMENT `/assets/report.css`. JAMAIS de dossier `assets/` local, JAMAIS `report-dark.css`.
8. **Pas de CSS inline** sauf conteneurs ECharts et blocs Confirmations/Invalidations scanner.
9. **GTM** : GTM-T5Z595CW sur toutes les pages.
10. **Fonts** : Inter (Google Fonts) + Font Awesome 6.4.0.
11. **Charts** : ECharts préféré. Ne pas mélanger ApexCharts et ECharts dans un même article.
12. **Accents français obligatoires** : UTF-8 direct (résultat, bénéfice, marché, première).
13. **Logo** : brand-bar = logo MW `/logo.svg`. Cartes index.html = logo parqet.com. JAMAIS de logo société dans le ticker-header.
14. **⚠️ Ticker-header metrics (CRITIQUE)** : Les métriques dans le hero utilisent EXCLUSIVEMENT ces classes définies dans `report.css` :
    - `<div class="ticker-metric"><div class="tm-value">VALUE</div><div class="tm-label">LABEL</div></div>` (value AVANT label)
    - **JAMAIS** `metric-value` (font trop grande 1.75rem), **JAMAIS** `metric-label`, **JAMAIS** `ticker-metric-value`/`ticker-metric-label` (n'existent pas)
    - Structure `ticker-header` plate — PAS de nesting `ticker-header-inner`, `ticker-brand`, `ticker-hero`, `ticker-top` etc.
    - **Référence** : `analyses/TARA/index.html` = gold standard pour le ticker-header
15. **Brand-nav** : `<div class="brand-nav">` (PAS `<nav class="brand-nav">`). JAMAIS `class="active"` en dur (CSS gère via `data-tab`).

### Tags — Taxonomie
| Catégorie | Tags | Couleur |
|-----------|------|---------|
| Région | `us`, `eu`, `asia`, `crypto`, `commodity`, `forex`, `etf` | Bleu |
| Secteur | `tech`, `semis`, `healthcare`, `energy`, `financials`, `industrials`, `materials`, `consumer`, `defense` | Vert |
| Thème | `ai`, `earnings`, `geopolitique`, `macro`, `technique`, `options`, `dividende`, `small-cap`, `speculative` | Violet |
| Contenu | `trade-idea`, `formation`, `retrospective` | Ambre |

### Internationalisation
- Boutons cartes : traduits dynamiquement par `translateCardButtons()` — ne PAS coder en dur dans les JSON
- Badge "Latest Report" (weekly) : ajouté par JS, jamais en dur
- Filtres : `data-i18n` + objet `translations` (5 langues : en, fr, ar, es, zh)

## Tâches Planifiées
Gérées via le **bot Discord** (`claude-discord-bot`), pas via cron.

| Tâche | Schedule | Commande |
|-------|----------|----------|
| Briefing Daily | Tous les jours 7h | `every day at 07:00 articles analyse daily` |
| Scanner | Lun-Ven 23h | `every weekday at 23:00 articles scan du jour` |
| Rétrospective | Vendredi 23h | `every friday at 23:00 articles rétrospective scanner` |
| Veille Tech | Tous les jours 18h | `every day at 18:00 articles veille tech 18h` |

### "Veille Tech 18h" — Intelligence & Sujets
Rapport de veille stratégique pour la rédaction de dailytickers.com. **Pas d'article HTML généré**, rapport Discord uniquement.

1. **Trends du moment** (WebSearch) :
   - Systematic trading & quant finance : nouvelles stratégies, backtests publiés, librairies open-source
   - AI agentic pour la finance : agents LLM, copilots trading, tools GenAI en prod
   - Fintech & finance software : releases, levées de fonds, acquisitions
   - Cybersécurité : vulnérabilités critiques, attaques notables, outils défensifs
   - Data science / ML / LLMs : papers arXiv récents, benchmarks, modèles publiés

2. **Veille concurrentielle** (WebSearch) :
   - Blogs quant : QuantConnect, Alpaca, Man Institute, Two Sigma, Alpha Architect, Quantocracy
   - Publications tech-finance : Bloomberg, Refinitiv, Morningstar tech
   - Newsletters & agrégateurs : ML-quant.com, The Gradient, Import AI

3. **Réseaux sociaux & communautés** :
   - Reddit : r/algotrading, r/MachineLearning, r/datascience, r/netsec (top posts semaine)
   - HackerNews : fils "Ask HN" et "Show HN" pertinents
   - GitHub Trending : repos finance/ML/security du jour

4. **Propositions éditoriales** : 5 à 8 sujets d'articles avec :
   - Titre accrocheur
   - Angle différenciant (pourquoi nous, pourquoi maintenant)
   - Tags taxonomie (voir section Tags)
   - Priorité éditoriale (1 = urgent, 3 = backlog)

Format sortie : sections **gras** Discord, listes concises, aucun HTML.

### Post-tâche : Commit & Push (OBLIGATOIRE)
Après chaque tâche réussie : `add_card.js` → vérifier `git status` → `git add` (fichiers spécifiques) → `git commit` → `git push origin main`.
**Ne PAS push si** : HTML < 10KB, `add_card.js` échoué, génération incomplète.

## Notification Telegram — Règles QA (CRITIQUE, NE JAMAIS SKIP)

### Principe général
**La notification Telegram est LA vitrine publique de chaque publication. Une notif erronée = mauvaise image.**

### Pipeline correct (dans cet ordre)
1. Générer + indexer + push l'article HTML
2. Lancer le pipeline media : `bash tools/publish-with-media.sh --type TYPE --path PATH`
   - Si timeout video → fallback text automatique (patch implémenté)
   - **JAMAIS** appeler `telegram-publish-notify.js` sans `--path`
   - **JAMAIS** appeler `telegram-publish-notify.js --help` en production

### QA Checklist par type d'article

#### Daily Briefing
- [ ] Titre contient la date du jour (ex: "March 29, 2026") — PAS une date passée
- [ ] Snapshot marché contient ≥ 4 indices réels avec % de variation
- [ ] Lien pointe vers `/daily/YYYYMMDD/` correct (pas un autre slug)
- [ ] Audio ou vidéo joint si disponible — sinon notification text seule (pas de silence)
- [ ] Topic Telegram : 73 (Daily News)

#### Weekly Review
- [ ] Titre contient la semaine couverte (ex: "Week of March 24")
- [ ] Performance 5 jours des indices incluse
- [ ] Lien vers `/weekly/YYYYMMDD/`
- [ ] Topic Telegram : 74 (Weekly Review)

#### Scanner
- [ ] Top 3 setups avec ticker + score dans la notif
- [ ] Régime du marché (risk-on/off) mentionné
- [ ] Lien vers `/scanner/YYYYMMDD/`
- [ ] Topic Telegram : 72 (Portfolio Live)
- [ ] Pas de Short Squeeze dans le top 3

#### Stock Analysis
- [ ] Ticker et nom de la société en titre
- [ ] Thèse de trade en 1 ligne
- [ ] Lien vers `/analyses/TICKER/`
- [ ] Topic Telegram : 75 (Stock Analysis)

#### Series / Learning / Tech
- [ ] Sujet clairement identifiable en titre
- [ ] Lien correct
- [ ] Topic Telegram : 76 (Learning)

### Erreurs qui ne doivent JAMAIS se reproduire
- ❌ Notif envoyée avec `artPath = ''` → message fallback générique
- ❌ `telegram-publish-notify.js` appelé sans `--path` (maintenant bloqué par guard)
- ❌ Article daté J publié avec contenu de J-1
- ❌ Notification envoyée avant le push Git
- ❌ Notification en doublon (deux messages pour le même article)

### Commande manuelle de re-notification (si notif ratée)
```bash
cd /home/ci/projects/articles
node tools/telegram-publish-notify.js --type daily --path daily/YYYYMMDD/index.html --dry-run
# Vérifier le preview, puis sans --dry-run
node tools/telegram-publish-notify.js --type daily --path daily/YYYYMMDD/index.html
```
