# CLAUDE.md - Market Watch Articles Project

## Project Overview
Site de publication d'analyses financières institutionnelles, hébergé sur GitHub Pages.
- **URL articles** : `https://articles.market-watch.xyz/` (CNAME = `articles.market-watch.xyz`)
- **Landing marketing** : `https://market-watch.xyz/` (site séparé, ne sert PAS les articles)
- **IMPORTANT** : Toujours utiliser `articles.market-watch.xyz` pour les URLs d'articles

## Structure du Projet
```
articles/
├── src/                          # Source Astro (nouveaux articles)
│   ├── components/               # 36 composants réutilisables (*.astro)
│   ├── layouts/                  # 8 layouts (Base, Daily, Weekly, Analyses, Analysis, Scanner, Series, Tech)
│   ├── content/                  # Collections MDX (daily/, tech/)
│   └── pages/                    # Routes dynamiques
├── assets/                       # CSS + JS global partagé
│   ├── report.css                # Theme light (3000+ lignes)
│   ├── core.js                   # Tag renderer + filtres
│   ├── live-tracker.js           # Prix temps réel (Yahoo + Binance)
│   └── style.css                 # Landing page CSS
├── weekly/ daily/ analyses/ scanner/ series/ tech/  # Legacy HTML
├── data/                         # Index JSON par tab + search_data.js
├── tools/                        # add_card.js, migrate_astro.js, etc.
├── widget/                       # Widgets embarquables (iframe)
└── mcp/                          # MCP server + watchlist.json
```

## Architecture Hybride (Astro + Legacy)
- **Nouveaux articles** : MDX dans `src/content/`, rendus via layouts Astro
- **Articles existants** (433) : HTML legacy copié dans `dist/` par `copy-legacy.mjs`
- **Build** : `npm run build` = `astro build` + `copy-legacy.mjs`
- **Migration tool** : `node tools/migrate_astro.js --apply` standardise tous les HTML legacy

## MCP Gateway
Outils `mcp__claude_ai_Gateway__*` :
- **GetMarketOverview**: Snapshot global (indices, commodities, crypto, rates, sentiment, news). Contient aussi : **trending topics**, **sector variations**, **economic calendar**, **earnings calendar** — exploiter ces champs pour enrichir les articles.
- **QueryData**: 58 types de données (quotes, bars, technicals, sentiment, news, earnings, etc.)
- **GetInstruments**: Analyse complète d'un symbole (`symbols` requis)
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

## Commandes Utilisateur

### "Nouvelle analyse weekly"
**Langue par défaut : anglais intermediate.** Voir `weekly/CLAUDE.md` pour le template complet et les 18 sections obligatoires.

1. **Date** : Le weekly couvre la semaine **À VENIR**. Dossier = `weekly/YYYYMMDD/` (YYYYMMDD = lundi). Vérifier anti-doublon : `ls weekly/` ET `grep "YYYYMMDD" data/weekly.json` — NE PAS ajouter si l'URL existe déjà.
2. **Référence** : Lire `weekly/20260223/index.html` pour reproduire le layout exact
3. **Collecte MCP** : `GetMarketOverview` (deep — trending, sector variations, economic calendar) + `QueryData` types=quote,**social_sentiment,capital_flow**,trading_signals (SPY, QQQ, DIA, IWM, GLD, SLV, USO, TLT, EFA, EEM, FXI, BTC-USD, ETH-USD, SOL-USD, XRP-USD) + WebSearch (géopolitique, earnings clés, Polymarket)
4. **Générer** : `weekly/YYYYMMDD/index.html` avec les 18 sections (> 100KB). CSS = `/assets/report.css`. FAB obligatoire, PAS de hero-brand-link.
5. **Indexer + Push** :
   ```bash
   node tools/add_card.js weekly/YYYYMMDD/index.html
   git add weekly/YYYYMMDD/ data/weekly.json data/search_data.js data/radar.json
   git commit -m "feat: weekly YYYYMMDD — {titre court}"
   git push origin main
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
   node tools/add_card.js analyses/{TICKER}/index.html
   git add analyses/{TICKER}/ data/analyses.json data/search_data.js
   git commit -m "feat: analyse {TICKER} — {titre court}"
   git push origin main
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
   node tools/add_card.js daily/YYYYMMDD/index.html
   git add daily/YYYYMMDD/ data/daily.json data/search_data.js data/radar.json
   git commit -m "feat: briefing quotidien DD mois YYYY — {titre court}"
   git push origin main
   ```

### "Scanner" / "Scan du jour"
**Langue par défaut : anglais intermediate.** Voir `scanner/CLAUDE.md` pour le template complet, les sections, et la méthodologie.

**⚠️ Convention de date :** Le scanner couvre la **prochaine séance de trading**. Si généré après 22h30 : dossier = D+1 (jour ouvrable suivant). **Vendredi soir → lundi (D+3).**

1. **Lire TOUTES les rétrospectives** (`scanner/retrospective/YYYYMMDD/`) pour cumuler les enseignements
2. **Lire le scan précédent** pour filtre anti-doublon (min 70% nouveaux tickers)
3. **Collecte MCP** : `RunAutoScreener` + `RunScreener` (3 DSL + EU + APAC + ETFs) + `GetMarketOverview` (trending, sectors, calendar) + `QueryData` (quote, **social_sentiment, capital_flow**, insider_transactions) pour les 10 tickers retenus
4. **⚠️ Dilution Filter (OBLIGATOIRE)** : Pour chaque ticker candidat (surtout small/mid-caps), `WebSearch "{TICKER} dilution warrants SEC S-3"` pour détecter :
   - Shelf registrations / S-3 filings récents
   - Warrants, ATM offerings, fonds toxiques (H.C. Wainwright, Maxim, Roth Capital, etc.)
   - Serial diluters → **EXCLURE du scan** (leçon INDO : setup technique parfait mais dilution massive non détectée)
5. **Sélection : 10 setups A+** (score ≥ 85, confluence ≥ 3 signaux, diversification géo : min 5 US + 2 EU + 1 APAC + 2 ETFs)
5. **Titre carte OBLIGATOIRE** : `Top 10 A+ {REGIME} — {TICKER1}, ..., {TICKER10}`
6. **Indexer + Push** :
   ```bash
   node tools/add_card.js scanner/YYYYMMDD/index.html
   git add scanner/YYYYMMDD/ data/scanner.json data/search_data.js mcp/watchlist.json data/radar.json
   git commit -m "feat: scanner YYYYMMDD — {régime}, 10 setups A+"
   git push origin main
   # Pipeline post-scan (tracking + image Telegram + sweep + mode cards + status page) :
   ./tools/publish-daily-card.sh
   ```

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
   node tools/add_card.js scanner/retrospective/YYYYMMDD/index.html
   git add scanner/retrospective/YYYYMMDD/ scanner/retrospective/index.html data/scanner.json data/search_data.js index.html
   git commit -m "feat: rétrospective scanner — Note X, Y% HR"
   git push origin main
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
5. **Footer** : `<footer class="article-footer">`. JAMAIS `report-footer`, `site-footer`, etc. TOUJOURS inclure les liens Telegram + Discord : `<a href="https://t.me/+gl06cNSLV2RiZmE0">Telegram</a>` et `<a href="https://discord.gg/eb4Ack9aPZ">Discord</a>`.
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
Rapport de veille stratégique pour la rédaction de market-watch.xyz. **Pas d'article HTML généré**, rapport Discord uniquement.

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
