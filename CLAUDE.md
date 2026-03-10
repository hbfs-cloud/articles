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
- **GetMarketOverview**: Snapshot global (indices, commodities, crypto, rates, sentiment, news)
- **QueryData**: 58 types de données (quotes, bars, technicals, sentiment, news, earnings, etc.)
- **GetInstruments**: Analyse complète d'un symbole (`symbols` requis)
- **RunAutoScreener**: Screener auto-adaptatif + détection de régime
- **RunScreener**: Screener DSL personnalisé
- **CalculateOptionsGreeks** / **AnalyzeOptionsStrategy** / **LLMAnalysis**

## Polymarket — Marchés Prédictifs
Intégrer dans **tous les types d'articles** quand pertinent. Signal **complémentaire**, jamais la base d'une thèse.
- `WebSearch "polymarket {sujet}" site:polymarket.com`
- Données clés : probabilité (%), volume ($), tendance vs 7j
- Toujours mentionner le volume et comparer au consensus institutionnel
- Format : `<div class="didactic-box">` avec lien `source-ref` vers Polymarket
- **Où** : Géopolitique, Macro, Crypto, Outlook, Matrice des Risques, Catalyseurs scanner

## Commandes Utilisateur

### "Nouvelle analyse weekly"
**Langue par défaut : anglais intermediate.** Voir `weekly/CLAUDE.md` pour le template complet et les 18 sections obligatoires.

1. **Date** : Le weekly couvre la semaine **À VENIR**. Dossier = `weekly/YYYYMMDD/` (YYYYMMDD = lundi). Vérifier anti-doublon avec `ls weekly/`.
2. **Référence** : Lire `weekly/20260223/index.html` pour reproduire le layout exact
3. **Collecte MCP** : `GetMarketOverview` (deep) + `QueryData` (SPY, QQQ, DIA, IWM, GLD, SLV, USO, TLT, EFA, EEM, FXI, BTC-USD, ETH-USD, SOL-USD, XRP-USD) + WebSearch (calendrier, géopolitique, earnings)
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
2. **Collecte MCP** : `GetInstruments` + `QueryData` (quote, bars_daily, bars_intraday, financials, earnings_quarterly, holders, stats, support_resistance, volume_profile, sentiment_overall, trading_signals, analyst_actions, insider_transactions, ctb, news, options_chain)
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

1. **Collecte MCP** : `GetMarketOverview` (deep) + `QueryData` (SPY, QQQ, DIA, IWM, EFA, EEM, FXI, GLD, SLV, USO, TLT, BTC-USD, ETH-USD, SOL-USD, XRP-USD) + WebSearch (calendrier, géopolitique, earnings, Polymarket)
2. **Générer** `daily/YYYYMMDD/index.html`. CSS = `/assets/report.css`.
3. **Samedi** = briefing complet (récap vendredi + bilan semaine + preview lundi)
4. **Dimanche** = crypto-only + géopolitique (marchés fermés)
5. **Formation progressive** : cursus 4 semaines cyclique (Bases → Technique → Fondamentaux → Avancé)
6. **Indexer + Push** :
   ```bash
   node tools/add_card.js daily/YYYYMMDD/index.html
   git add daily/YYYYMMDD/ data/daily.json data/search_data.js data/radar.json
   git commit -m "feat: briefing quotidien DD mois YYYY — {titre court}"
   git push origin main
   ```

### "Scanner" / "Scan du jour"
**Langue par défaut : anglais intermediate.** Voir `scanner/CLAUDE.md` pour le template complet, les sections, et la méthodologie.

1. **Lire TOUTES les rétrospectives** (`scanner/retrospective/YYYYMMDD/`) pour cumuler les enseignements
2. **Lire le scan précédent** pour filtre anti-doublon (min 70% nouveaux tickers)
3. **Collecte MCP** : `RunAutoScreener` + `RunScreener` (3 DSL + EU + APAC + ETFs) + `QueryData` (quote, insider_transactions)
4. **Sélection : 10 setups A+** (score ≥ 85, confluence ≥ 3 signaux, diversification géo : min 5 US + 2 EU + 1 APAC + 2 ETFs)
5. **Titre carte OBLIGATOIRE** : `Top 10 A+ {REGIME} — {TICKER1}, ..., {TICKER10}`
6. **Indexer + Push** :
   ```bash
   node tools/add_card.js scanner/YYYYMMDD/index.html
   git add scanner/YYYYMMDD/ data/scanner.json data/search_data.js mcp/watchlist.json data/radar.json
   git commit -m "feat: scanner YYYYMMDD — {régime}, 10 setups A+"
   git push origin main
   ```

### "Rétrospective Scanner"
**Langue par défaut : anglais intermediate.** Voir `scanner/CLAUDE.md` section 5bis pour le template complet.

1. Lire tous les scans des 10 derniers jours, extraire les setups
2. Collecter prix actuels via `QueryData` (quote, bars_daily)
3. Créer `scanner/retrospective/YYYYMMDD/index.html` (note A+ à F, dashboard, tableau, top/flop)
4. Mettre à jour redirect `scanner/retrospective/index.html`
5. Mettre à jour le dashboard "Performance du Scanner" dans `index.html` (KPIs + 3 ECharts)
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
- Indexation : `node tools/add_card.js chemin/vers/index.html` (JAMAIS modifier index.html à la main pour ajouter une carte)

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
2. **Brand Bar** : `<nav class="brand-bar">` + `brand-bar-inner` + logo `/logo.svg`. TOUJOURS présent.
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

### Post-tâche : Commit & Push (OBLIGATOIRE)
Après chaque tâche réussie : `add_card.js` → vérifier `git status` → `git add` (fichiers spécifiques) → `git commit` → `git push origin main`.
**Ne PAS push si** : HTML < 10KB, `add_card.js` échoué, génération incomplète.
