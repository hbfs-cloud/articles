# CLAUDE.md — DailyTickers Articles Project

## Design Context (impeccable)
Avant tout travail UI/design, lire **`PRODUCT.md`** (stratégie : registre=product unifié, retail
sérieux multilingue, voix FT/Economist + précision terminal ; anti-réfs : crypto-bro néon, SaaS
générique, Bloomberg overload, cream/sand AI) et **`DESIGN.md`** (système visuel actuel = baseline +
direction de refonte). Refonte pilotée par le skill `impeccable` (`/impeccable <command>`). A11y :
mobile-first dense, RTL arabe, P&L colorblind-safe, WCAG AA, reduced-motion.

## Voix éditoriale (OBLIGATOIRE — tout contenu publié)
Règle #1 de rédaction, tous supports (site, Substack, Telegram, notes) : **concis, direct, actionnable, et JAMAIS "style IA"**. Un lecteur ne doit pas pouvoir dire « c'est écrit par une IA ».

### Contrat de langue par canal (OBLIGATOIRE, à partir du 29 août 2026)

- **Site web** (`articles.dailytickers.com`) : tout nouveau contenu public est rédigé en **français**, avec
  `<html lang="fr">`. Une source ou un ancien modèle anglais ne change jamais cette règle.
- **Telegram** : toute notification publique est en **français**, concise, actionnable et autosuffisante.
  Elle peut contenir le lien vers l'article web, mais le lecteur doit comprendre le contexte, les faits
  décisifs, l'action à prendre ou la condition à surveiller et l'invalidation sans ouvrir le lien.
- **Substack** : tout article ou note est en **anglais**, concis, actionnable et autosuffisant. Le contenu
  Substack ne contient **aucun lien, renvoi, CTA ni référence au site web** ou à une « version complète »
  externe. Il est écrit comme un livrable indépendant, jamais comme la traduction automatique ou le teaser
  tronqué de la page web française.
- **Harnais commun** : les trois livrables reposent sur le même snapshot certifié et les mêmes faits, niveaux,
  conditions et invalidations. Chaque texte passe néanmoins son propre contrôle de langue, d'autosuffisance,
  de cohérence numérique et les revues Senior QA, Contrarian et Retail War Room avant publication.

Ce contrat prévaut sur toute instruction historique indiquant « anglais par défaut » pour le site. Il reste
applicable à tous les workflows actuels et futurs jusqu'à modification explicite de cette règle générale.

**⇒ Spec complète et reproductible (routines cloud incluses) : [`EDITORIAL_STYLE.md`](EDITORIAL_STYLE.md)** — 2 couches (anti-tics + **empreinte intellectuelle** : catalyseur précis vérifié, flux institutionnels réels, asymétrie non-consensuelle, thèse falsifiable) + recette de recherche MCP à exécuter AVANT d'écrire. Un texte « propre mais vide » (aucune info que seul un analyste qui a creusé pourrait écrire) échoue autant qu'un texte truffé de tics.

- **Bannir les tics IA / marketing** : signposting et formules toutes faites — « Hold one idea… », « Here's the thing », « The bottom line », « That divergence is the whole story », « buckle up », « let's dive in », « it's worth noting », « in a world where », « delve », « tapestry », « game-changer », « navigating the… » (FR : « il est important de noter », « force est de constater », « sans plus attendre »…).
- **Voix humaine** : un point de vue, du rythme varié (phrases courtes ET longues, fragments), des images concrètes. Éviter la structure ultra-templatée (contexte → 3 points → outlook → conclusion) et les paragraphes trop lisses/homogènes.
- **Garder les chiffres réels et précis** (niveaux, entries/stops, perfs) — c'est le vrai signal de crédibilité + l'actionnable.
- **JAMAIS de terme interne/technique dans le contenu publié** (texte, légendes, images) : pas de « MCP », « DailyTickers MCP », « Gateway », « market data service », noms de scripts/pipeline. Décrire la donnée (« options flow & levels », « avg constituent return »), pas l'infra.
- **Registre selon le support** : site français = institutionnel (FT/Economist + terminal, cf `PRODUCT.md`) ; Substack anglais et Telegram français = ultra-simple, lisible par un enfant de 10 ans. La concision + l'anti-IA s'appliquent PARTOUT ; seul le registre change.
- **Contrôle** : `node tools/check-ai-tells.js <path> [--strict]` flague les tics avant publication. Zéro finding ≠ garantie humain, mais tout finding = réécrire.

## Project Overview
Site de publication d'analyses financières institutionnelles, hébergé sur GitHub Pages.
- **URL articles** : `https://articles.dailytickers.com/` (CNAME = `articles.dailytickers.com`)
- **Landing marketing** : `https://dailytickers.com/` (site séparé, ne sert PAS les articles)
- **IMPORTANT** : Toujours utiliser `articles.dailytickers.com` pour les URLs d'articles

## Structure du Projet
```
articles/
├── assets/                       # CSS + JS global partagé (report.css, core.js, live-tracker.js, style.css)
├── weekly/ daily/ analyses/ scanner/ series/ tech/  # Articles HTML statiques
├── data/                         # Index JSON par tab + search_data.js
├── tools/                        # publish.js, add_card.js, sweep.js, gen-status-page.js, gen-api.js, regime-recalibrate.js, ...
├── portfolio/v1/                 # Public JSON API (6 modes)
├── widget/                       # Widgets embarquables (iframe)
└── mcp/                          # MCP server + watchlist.json
```

## Architecture
- **Stack** : HTML statique + CSS (`report.css`) + JS vanilla (`core.js`) + JSON indexes
- **Pas de framework de build** (Astro supprimé) — les articles sont des fichiers HTML directs
- **Publication** : `node tools/publish.js --type <type> --path <path>` enchaîne tout automatiquement

## MCPs Enregistrés (OAuth2 — ZÉRO TOKEN EN .env)
Tous les MCPs sont enregistrés via OAuth2 dans Claude Code / claude.ai. **Aucun token dans .env, aucun secret hardcodé.**
- **DailyTickers** : `https://mcp.dailytickers.com/mcp` — données marché, screening, backtesting, portfolio
- **Memory** : `https://memory.hbfs-cloud.com/mcp` — mémoire long-terme partagée entre agents
- **Notification** : `https://notification.hbfs-cloud.com/mcp` — notifications multi-canal (Telegram, Discord, Slack, Email)
- **Broker Simulator** : `https://simulator.dailytickers.com/` — via MCP OAuth2
- **dtx (moteur systematic-tss)** : `https://systematic.dailytickers.com` — backtest/décision/régime des stratégies systematic-tss. Voir la règle dtx ci-dessous.

Namespace outils marché courant : `mcp__claude_ai_marketdata__*` (ex-Gateway/DailyTickers — morts).
**Surface v5 consolidée (2026-07)** : `GetMarketContext`/`Jobs`/`PortfolioRisk`/`GetStatus`/`OptionsAnalytics`
remplacent respectivement GetMarketOverview+GetRegimeProbability+GetPredictionMarkets+GetSeasonality+GetCOTReport,
CheckJobStatus+ListJobs, GetCorrelationMatrix+OptimizeSizing+CalculatePortfolioVaR+GetPortfolioStressTest,
GetHealth+GetVersion, et les outils options (GetOptionsSentiment/CalculateOptionsGreeks/CalculatePortfolioGreeks/
CalculateSABRVolatility/AnalyzeOptionsStrategy). Les anciens noms restent des alias serveur (HTTP OK) mais ne
sont plus découvrables via ToolSearch — toujours utiliser les noms canoniques. Détails : `.claude/skills/mcp-gateway-tools.md`.

**Ne JAMAIS ajouter de token en .env** — utiliser les outils MCP déjà enregistrés.

### ⚙️ dtx MCP — moteur systematic-tss (SEUL MOTEUR — "le MCP fait foi")
Pour TOUTE opération de **backtest / décision / régime** sur les stratégies systematic-tss, utiliser
**EXCLUSIVEMENT le serveur MCP « dtx »** (`systematic.dailytickers.com`). **Cut-over 2026-07-08 : le
binaire dtx local + le bundle `tools/bin/dtx-data/`/`PROVENANCE` ont été SUPPRIMÉS du repo.** Il n'y a
**plus aucun fallback binaire** — le MCP est la source de vérité unique.

Outils MCP :
- `DtxListConfigs()` → liste des 13 stratégies (`id`, `strategy`, `currency`). Toujours passer l'`id` tel
  que retourné (ex: `us_highvol`, `crypto`, `etf_us`).
- `DtxReplay(portfolio, from?, to?)` → backtest depuis une date de départ →
  `{results:[{cagr_pct, max_dd_pct, sharpe, r2, win_rate, total_trades, equity_dates[], equity_values[]}]}`.
- `DtxDecide(portfolio, asof, balances, positions?=[], orders?=[], state?)` → décisions du soir →
  `{state, actions:{CREATE,UPDATE,CANCEL}}`. **GOTCHA** : `balances` DOIT être un OBJET
  `{base_currency, cash_by_currency:{CUR:montant}, total_equity}` (un `{"USD":100000}` plat est normalisé
  mais préférer la forme objet) ; **persister `state`** et le repasser au run suivant.
- `DtxRegime(asof)` → `{regime, regime_score, ...}`.

**Chaîne async** : `DtxDecide`/`DtxReplay` renvoient `{status:"async_pending", job_id}` → poller
`DtxJobStatus(job_id)` jusqu'à `status:"done"` → lire `result`. Le serveur a un **cache OHLCV chaud**
(prefetch auto au boot + chaque soir) et un garde-fou RAM (date-clamp) qui a levé l'OOM des gros univers.

**Broker-MCP DtxDecide Contract V2 (exécution réelle/paper).** Toute intégration broker qui consomme une
réponse `DtxDecide` V2 (`contract_version:"2.0"` / `execution_plan.groups`) doit suivre
`tools/trading-executor/DTX_DECIDE_V2_CONTRACT.md`. DTX reste l'unique source de stratégie, sizing,
niveaux, protections, fenêtres, promotions et validité. Le broker-mcp exécute uniquement les champs
structurés, valide le contrat complet, persiste l'état opaque DTX, applique idempotence/verrous symbole,
et refuse tout ordre si fraîcheur, protection, validité, support broker ou idempotence ne sont pas
garantis. Ne jamais exécuter `actions.CREATE` en parallèle de `execution_plan.groups`, ne jamais inventer
qty/stop/take-profit/limite/alternate, ne jamais convertir LIMIT en MARKET, ne jamais promouvoir hors
`promotion_policy.promote_on`.

**Câblage scanner (staging des 5 modes scriptés).** Un subprocess `node` NE PEUT PAS appeler le MCP
(OAuth2, ZÉRO token) → seul l'**AGENT** (Claude Code / `claude -p`) l'appelle. Le staging
`data/dtx/<id>.json` est donc produit par l'agent AVANT le pipeline shell :
**agent → DtxReplay/DtxDecide (poll DtxJobStatus) → JSON bruts → `node tools/dtx-mcp-ingest.js` → staging
`engineMode:"mcp"`**. Le staging alimente AUSSI le tracking live : `publish-daily-card.sh` Step 2q
(`tools/dtx-pool-bridge.js`) convertit les ordres CREATE en signaux `dtx_pool` consommés par le sweep
(modes `assetClass:'dtx'`, partition `universe=<modeId>`) — staging stale = zéro candidat pour le mode ce
soir-là (skip bruyant, fix « 0 trades depuis D0 » du 2026-07-16). **Historisation (2026-08-07)** : le staging
est un INSTANTANÉ écrasé à chaque ingestion — `tools/dtx-history-append.js` (pipeline, juste après le
pont) l'archive dans `data/dtx-engine-history.json`, registre append-only **immuable par (mode, date)**
portant ordres/updates/cancels + metrics. C'est la source point-in-time du champ `engine_decision` des
snapshots et du panneau « Décisions du moteur » de `scanner/status` (artefact publié :
`scanner/status/engine-history.json`). Les séances antérieures au 07/08 sont reconstruites depuis le
`dtx_pool` des scans et marquées `provenance:'dtx_pool'` — forme pontée, sans metrics. `tools/dtx-scan.js` ne fait plus tourner de binaire : il porte le schéma partagé
(`buildStaging`/`extractReplayMetrics`/…) + `stagingStatus()`/`--list` ; un `--mode` affiche la marche à
suivre et sort en 0 (dégradation gracieuse, jamais bloquant). Voir skill `scanner-pipeline` §"dtx refresh
— MCP SEUL MOTEUR". Le MCP est accessible en headless : `claude -p` (bot cloud, même compte claude.ai)
voit le connector `mcp__claude_ai_systematic__*` (vérifié 2026-07-08).

### Notification MCP — Outils & Aliases
| Outil | Usage |
|-------|-------|
| `send_message(to, body, format?, thread_id?, priority?)` | Message vers un alias ou channel |
| `send_media(to, media_url, media_type, caption?)` | Image/doc/vidéo vers un alias |
| `send_batch(messages[])` | Multi-canal en un appel |
| `list_channels(service)` | Découvrir les destinations |
| `get_delivery_status(message_id)` | Vérifier livraison |

**⚠️ Format Telegram (OBLIGATOIRE)** : Toujours utiliser `format: "html"` avec des balises HTML.
Telegram ne supporte PAS le Markdown GitHub (`**bold**` reste en texte brut). Utiliser :
- `<b>bold</b>` au lieu de `**bold**`
- `<i>italic</i>` au lieu de `*italic*`
- `<code>code</code>` au lieu de `` `code` ``
- `<a href="url">text</a>` pour les liens
- `\n` pour les sauts de ligne (pas de `<br>`)

**Aliases pré-configurés** (résolus côté serveur, aucun ID exposé aux agents) :
`daily`, `weekly`, `analysis`, `learning`, `scanner-turbo`, `scanner-dynamic`, `scanner-balanced`,
`scanner-orbit`, `scanner-fortress`, `alerts`

## ⛔ MCP HARD STOP (IMMUABLE) — avec FORCE-REFRESH avant stop
Si le MCP DailyTickers **bloque** (auth expirée, timeout, erreur réseau) ou **renvoie des données incohérentes** (prix aberrants, NaN) :
1. **STOP IMMÉDIAT** — ne pas continuer la génération/correction d'article
2. **Ne JAMAIS substituer** par des données inventées, estimées, ou issues de mémoire
3. **Signaler** au user : « MCP indisponible, tâche suspendue »
4. **Reprendre** uniquement quand le MCP est reconnecté ET qu'un test QueryData de contrôle renvoie des données fraîches

### 🔄 Données STALE ≠ hard stop d'emblée — FORCE-REFRESH d'abord
Si les données sont **vieilles** (bars en retard, `sessions_behind` > seuil, `max_last_bar_date` ancien, staging dtx périmé) mais le MCP répond, NE PAS hard-stopper tout de suite : **forcer le rafraîchissement** puis re-vérifier.
- **marketdata** (build minimal `0424cf4b`) : certifier séparément
  `operation_readiness.bars_daily_us_equity`, `bars_daily_crypto_utc` et SEC. Comparer
  `served_completed_end` à `expected_completed_end` selon `asset_calendar`; ne jamais utiliser le maximum
  daily global comme preuve. Pour `RefreshBars`, `last_bar_after` peut être ouvert : exiger
  `last_completed_bar_after` et `last_bar_complete=true`. Respecter `retry_at` /
  `next_complete_available_at` au lieu de poller avant l'heure annoncée.
- **systematic (dtx)** : `GetHealth` / `DtxDecide` renvoient `data_asof`/`last_data_date`/`sessions_behind` (et un statut `stale_data` sans actions si trop en retard). Si stale, appeler **`DtxRefreshBars`** (fire-and-forget ~4 min) → **poller `GetHealth`** (`prefetch.running` repasse false, `last_data_date` avance) → puis re-`DtxDecide`.
- **Seulement si** le force-refresh échoue / ne rattrape pas (données toujours stale après refresh) → appliquer le HARD STOP ci-dessus. NE JAMAIS publier/backtester sur des bars périmés « faute de mieux ».

### 📅 Contrat de DATE DE RÉFÉRENCE en input (complément anti-« monde d'hier »)
Le force-refresh récupère les données ; le **contrat de date** empêche de les consommer stale **sans s'en apercevoir**. Passer la date de séance visée EN INPUT des calls de données — le serveur REFUSE/FLAGGE au lieu de renvoyer silencieusement la veille :
- **systematic (dtx)** : `DtxDecide(..., expected_data_date="YYYY-MM-DD")` et `DtxRegime(..., expected_data_date=...)` — le serveur renvoie `status:"data_date_mismatch"` (sans actions) si les OHLCV n'atteignent pas cette date. **OBLIGATOIRE en live** : passer la clôture qu'on veut trader (souvent la séance J), pour que « on a silencieusement pris le monde d'hier » soit impossible au bord clôture/ingestion.
- **marketdata** : borner explicitement avec `QueryData(end_date=D[, form_types])` et `GetInstruments(as_of=D)` pour le point-in-time (sec_filings/financials/earnings/insider → jamais un filing POSTÉRIEUR à D, leçons IOVA/INDO). En amont, vérifier la fraîcheur via `GetStatus` (`max_last_bar_date`/`ref_lag_sessions`) avant la salve.

Cette règle s'applique à TOUS les workflows : scanner, daily, weekly, analyses, retrospectives, refresh-analyses. Nos skills/scripts DOIVENT (1) invoquer `RefreshBars`/`DtxRefreshBars` face à des données trop vieilles ET (2) passer la date de référence (`expected_data_date`/`end_date`/`as_of`) en input pour ne jamais consommer un « monde d'hier » en silence.

## ⚠️ LECTURE OBLIGATOIRE AVANT GÉNÉRATION
Avant de générer un article ou d'appeler `add_card.js`, **TOUJOURS lire le fichier JSON cible** (`data/daily.json`, `data/weekly.json`, etc.) pour :
1. Vérifier l'absence de doublon par URL
2. Lire les titres existants pour cohérence
3. Vérifier le format de date des cartes récentes

**Ne JAMAIS skip cette étape** — les doublons viennent systématiquement d'un `add_card.js` lancé sans lecture préalable.

`add_card.js` filtre par URL pour tous les tabs mais la vérification manuelle reste obligatoire. JAMAIS modifier les JSON à la main.

## Conventions HTML (OBLIGATOIRE pour tous les articles)

1. **`<html>`** : `lang="{en|fr|ar}" data-tags="{tags}" data-tab="{type}"` + optionnel `data-level`, `data-grade`
2. **Brand Bar** : `<nav class="brand-bar">` + `brand-bar-inner` + logo `/logo.svg` + **`brand-nav`** (Hebdo, Daily, Analyses, Scanner, Radar, Séries). Lien actif auto-highlight via CSS `data-tab` (pas de `class="active"` en dur).
3. **Tags** : `<div id="article-clickable-tags" class="card-tags"></div>` dans hero. Peuplé par `tag-renderer.js`.
4. **FAB** : `<div class="fnav">` avec 6 items. Obligatoire pour scanner, daily, analyses, tech, series. Pas pour weekly.
5. **Footer** : `<footer class="article-footer">`. JAMAIS `report-footer`, `site-footer`, etc.
6. **Scripts** : `core.js` + `tag-renderer.js` avant `</body>`. Ajouter `echarts-responsive.js` si ECharts, `live-tracker.js` si scanner.
7. **CSS** : EXCLUSIVEMENT `/assets/report.css`. JAMAIS dossier `assets/` local, JAMAIS `report-dark.css`.
8. **Pas de CSS inline** sauf conteneurs ECharts et blocs Confirmations/Invalidations scanner.
9. **GTM** : GTM-T5Z595CW sur toutes les pages.
10. **Fonts** : Inter (Google Fonts) + Font Awesome 6.4.0.
11. **Charts** : ECharts préféré. Ne pas mélanger ApexCharts et ECharts dans un même article.
12. **Accents français OBLIGATOIRES** : UTF-8 direct (résultat, bénéfice, marché, première).
13. **Logo** : brand-bar = logo MW `/logo.svg`. Cartes index.html = logo parqet.com. JAMAIS logo société dans ticker-header. **Images générées (charts/boards/PNG pour Substack/Telegram) : embarquer le VRAI `/logo.svg` (radar `#50b4ee`) en data-URI, JAMAIS un wordmark dessiné à la main.** Template de référence : `tools/templates/positioning-board.html`.
14. **⚠️ Ticker-header metrics (CRITIQUE)** :
    - `<div class="ticker-metric"><div class="tm-value">VALUE</div><div class="tm-label">LABEL</div></div>` (value AVANT label)
    - **JAMAIS** `metric-value` (font trop grande), **JAMAIS** `metric-label`, **JAMAIS** `ticker-metric-value`/`ticker-metric-label`
    - Structure `ticker-header` plate — PAS de nesting `ticker-header-inner`, `ticker-brand`, `ticker-hero`, etc.
    - **Référence** : `analyses/TARA/index.html` = gold standard
15. **Brand-nav** : `<div class="brand-nav">` (PAS `<nav class="brand-nav">`). JAMAIS `class="active"` en dur.

## Tags — Taxonomie
| Catégorie | Tags | Couleur |
|-----------|------|---------|
| Région | `us`, `eu`, `asia`, `em`, `crypto`, `commodity`, `forex`, `etf` | Bleu |
| Secteur | `tech`, `semis`, `healthcare`, `energy`, `financials`, `industrials`, `materials`, `consumer`, `defense`, `software`, `gold`, `mining`, `agriculture`, `biotech`, `utilities`, `staples`, `comms`, `airlines`, `quantum` | Vert |
| Thème | `ai`, `earnings`, `geopolitique`, `macro`, `technique`, `options`, `dividende`, `small-cap`, `speculative`, `momentum`, `short-squeeze`, `value`, `defensive`, `education`, `penny-stocks`, `debutant` | Violet |
| Contenu | `trade-idea`, `formation`, `retrospective` | Ambre |
| Spécial | `special-edition` | Rouge |

Tags méta tech-vertical (cat `theme`, réservés à `/tech`, usage rare) : `architecture`, `sql`, `snowflake`, `singer`, `opensource`, `societe`, `securite` — déjà reconnus par `assets/core.js` (`tagMeta`) mais absents de la liste courte ci-dessus.

⚠️ **Double registre non synchronisé** : `assets/core.js` (`tagMeta`, rendu tag-chips sur la page article) et `index.html` (`tagMeta` local, rendu tag-chips sur les cartes listing) sont deux copies indépendantes de la même taxonomie. `index.html` n'a PAS `software`, `societe`, `securite`, `architecture`, `sql`, `snowflake`, `singer`, `opensource` → ces tags ne s'affichent jamais en chip sur les cartes de la landing page (seulement sur la page article elle-même). Un tag absent des DEUX registres (ex: `trading`, `automation`, `data` utilisés dans `data/tech.json`) est silencieusement omis PARTOUT (pas de chip, pas d'erreur, pas de fallback couleur) — à corriger en synchronisant les deux `tagMeta` si ces tags doivent rester.

## Format date `report-card-meta`
TOUJOURS `DD mois YYYY` en français minuscule (ex: `14 mars 2026`). JAMAIS anglais ("March 14"), JAMAIS majuscule mois, JAMAIS suffixe textuel ("— Vendredi"), JAMAIS espaces superflus.

## Landing Page (index.html)
6 tabs : **Hebdo**, **Daily**, **Analyses**, **Scanner**, **Radar**, **Séries**. Tech dans le footer (`?tab=tech`).
- URL state : `?tab=daily`, `?grade=A`, `?tags=crypto,ai` — combinables
- Cartes triées par date décroissante. Exception : "Performance du Scanner" fixe en premier dans tab Scanner.
- Indexation : `node tools/add_card.js chemin/vers/index.html`

## Radar — `data/radar.json`
Mis à jour à chaque publication (daily, weekly, scanner). Rédigé par Claude, pas mécanique.
- 20-30 items, min 4 par catégorie : `risk` (rouge), `event` (ambre), `opportunity` (vert), `regime` (bleu)
- `importance` 1-10 : taille du blip + distance au centre. Labels si ≥ 7.
- `link` : URL relative vers section exacte (`/daily/YYYYMMDD/#section-id`)
- Supprimer items obsolètes. Opportunités = picks scanner score ≥ 88.

## Internationalisation
- Boutons cartes : traduits dynamiquement par `translateCardButtons()` — pas en dur dans JSON
- Badge "Latest Report" (weekly) : ajouté par JS, jamais en dur
- Filtres : `data-i18n` + objet `translations` (5 langues : en, fr, ar, es, zh)

## Sub-CLAUDE.md (auto-load par dossier)
- `daily/CLAUDE.md` — template daily briefing (17 sections)
- `weekly/CLAUDE.md` — template weekly review (18 sections)
- `scanner/CLAUDE.md` — template scanner + méthodologie Sharia + Anti-Dilution v2

## Skill Index (auto-load par triggers)
Skills dans `.claude/skills/` chargent à la demande selon les mots-clés du prompt. Liste :

**Commandes éditoriales harnachées** (`.claude/commands/`) : `/daily`, `/weekly`, `/retro`, `/analyse`,
`/aplus`, `/series`, `/scanner` — chacune exécute le skill transverse `content-harness` (salves MCP
complètes marketdata+systematic, manifeste `harness.json` + `tools/check-freshness.js` BLOQUANT
anti-stale, war room retail avant rédaction, senior-review avant publication, erreurs bloquantes
codifiées). Ne pas générer un daily/weekly/retro/analyse/series « à la main » quand la commande existe.

| Skill | Trigger keywords |
|-------|------------------|
| `content-harness` | harness, harnais, war room, freshness, stale data, salve MCP, gate publication |
| `aplus-setups` | setup A+, setups A+, 10 setups du mois, confluence 5 axes, grille éliminatoire, guidance relevée, screen A+, war room A+ (commande : `/aplus`) |
| `mcp-forecast-timesfm` | forecast, TimesFM, ForecastRaw, ForecastVix, Backtest |
| `mcp-gateway-tools` | QueryData, GetMarketContext, GetInstruments, RunScreener, Jobs, PortfolioRisk, GetEarningsCalendarFiltered, GetStatus, OptionsAnalytics, Polymarket |
| `perf-parallel-mcp` | performance, lent, salve parallèle, isoler MCP, paralléliser, batch QueryData, scan-plan, scan-ingest-all, background pipeline (doctrine transverse — TOUT skill MCP l'applique) |
| `scanner-pipeline` | scanner, scan du jour, sweep, regime, risk gating, dilution, Sharia, optimize-param, Mountain Plateau, rétrospective |
| `trading-executor` | run-session, gen-trading-plan, broker, alpaca, ibkr, saxo, trading212, binance, paper mode |
| `status-page-architecture` | scanner/status, Time Machine, tmUpdateLive, tmLoadIdx, lp-grid, panel(), rotation tracking |
| `daily-weekly-analysis-workflows` | analyse daily, briefing du jour, nouvelle analyse weekly, analyse [TICKER] |
| `portfolio-api-modes` | portfolio/v1, modes-config, regime-recalibrate, turbo/dynamic/balanced/secured/orbit/bull/aplus/highvol/casablanca/momentum/etf/etf_eu/trendline/fortress |
| `live-tracker-widgets` | live-tracker.js, widget/, allorigins, Yahoo proxy, setup card prices |
| `telegram-notifications-qa` | telegram-publish-notify, topic Telegram, notif article |
| `scheduled-tasks-veille` | veille tech, tâche planifiée, Discord bot, claude-discord-bot |
| `fortress-pm` | fortress, fortress pm, fortress halal, pm halal, portfolio manager fortress |
| `signals-desk` | meilleurs signaux, signaux du jour, desk signaux, best setups, pick les meilleurs, signaux auto, run signaux, signal desk (CHEF D'ORCHESTRE — sélectionne + poste) |
| `swing-signals` | swing, signaux swing, swings tactiques, trade court terme, bilan swing, quels signaux today, coups rapides, jouable aujourd'hui |
| `squeeze-radar` | squeeze, short squeeze, short interest, cost to borrow, CTB, days to cover, gamma squeeze |
| `earnings-reaction` | earnings, résultats, post-earnings, earnings drift, gap and go, beat, guidance relevée, saison des résultats, PEAD |
| `sector-funnel` | analyse sectorielle, secteur du moment, funnel sectoriel, entonnoir, sector deep dive (commande : `/sector-funnel`) |
| `sector-rotation` | rotation, rotation sectorielle, force relative, RS, leaders, quel secteur, surpondérer, sous-pondérer, sector tilt |
| `macro-event-playbook` | CPI, Fed, FOMC, macro, événement, playbook, OPEP, jobs, NFP, calendrier économique, positionnement, de-risk |

## Mode Status State Machine
Doc complète : [`tools/lib/MODE_STATUS.md`](tools/lib/MODE_STATUS.md). Résumé :

- 8 états : `draft → test → deploying → live → pausing → paused → stopped` (+ `paused → live` resume, + `live`/`pausing → liquidated → paused|stopped`)
- **`pausing`** = sortie progressive intelligente. Pas de nouvelles entrées NI de rotation, mais SL/TP/horizon/trailing continuent sur les positions ouvertes jusqu'à fermeture naturelle. Puis transition vers `paused`.
- **`deploying`** = ramp-up au fil de l'eau. Entries acceptées en `paper-ramp` pour validation conditions réelles avant flip vers `live`.
- **`liquidated`** = urgence. Toutes positions fermées au marché à la prochaine séance, sans regarder SL/TP/horizon. Compliance, panic, blackswan.
- Stockage : `data/modes-config.json` (état courant via `status` + `statusSince` + `statusReason` + `statusNextReviewAt`) ; `data/modes-status-history.json` (log append-only).
- API : `portfolio/v1/status.json` agrégé + bloc `status` dans tous endpoints per-mode. OpenAPI v1.3.0+.
- CLI : `node tools/set-mode-status.js --mode X --to STATE --reason "..." --review YYYY-MM-DD`. Rejette transitions illégales (override : `--force`).
- Pipeline : `gen-api`, `gen-status-page`, `gen-trading-plan`, `pit-engine` respectent le status. `pit-engine` gate via `statusSince` pour backtest reproductible et inclut une passe de liquidation forcée.

## Memory (`.claude/memory/`)
Toutes les mémoires projet (feedbacks, décisions, références) sont dans `.claude/memory/`. Ce dossier est
versionné dans git et accessible aux routines cloud. Il contient 29 feedbacks, 16 décisions projet, et
4 références externes. **Lire les fichiers pertinents AVANT toute opération** — ils codifient les
leçons d'incidents passés (INDO dilution, IOVA hallucination, sweep rewrite, etc.).

Index : `.claude/memory/MEMORY.md`. Fichiers nommés `feedback_*.md`, `project_*.md`, `reference_*.md`.

**⚠️ DOUBLE-WRITE OBLIGATOIRE** : Toute nouvelle règle, feedback, décision projet ou référence DOIT être
persistée dans les DEUX systèmes :
1. **Git** : fichier `.claude/memory/<type>_<slug>.md` avec frontmatter (name, description, type) + mise à jour de `MEMORY.md`
2. **MCP Memory** : `remember(workspace='dailystocks', type=..., name=..., ...)` avec tags et priority

Ne JAMAIS écrire dans un seul des deux. Git = accessible aux routines cloud (clone le repo).
MCP Memory = accessible à tous les agents (get_context/search). Les deux sont nécessaires.

## Operational Rules (OBLIGATOIRE — toutes routines)
Règles critiques issues de feedbacks et incidents passés. S'appliquent à toutes les sessions (locales ET cloud).

### Data Integrity
- **Immutable Trades** : JAMAIS modifier des trades clôturés ou leurs stats. SHA-256 chain dans `trade-chain.json`. `sweep.js` avorte en cas de violation.
- **Config Change Backtest** : Backtest 30 jours OBLIGATOIRE avant tout changement de config turbo/balanced/dynamic/fortress. Doit battre la config actuelle.
- **No Hallucination** : JAMAIS inventer de données financières (52W, cash, mcap, événements). Toujours MCP/WebSearch. Leçon ALT/IOVA/ALLR juin 2026.
- **Analyses Factcheck** : Toujours fact-checker les analyses avec MCP avant publication. Les fork agents hallucinent 52W range, cash, market cap.
- **Sweep pSize History** : `portfolioSize` varie dans le temps (`modes-config-history.json`). Jamais batch-reset sans consentement explicite.
- **Invalid Cohorts** : un trade scellé qu'on ne peut plus exploiter statistiquement (filtre inopérant, bug de sélection) ne se supprime NI ne se corrige — il se **déclare** dans `data/invalid-cohorts.json` (fenêtre de dates + champ + modes + raison). Lecture : `tools/lib/invalid-cohorts.js`, branché dans `tools/lib/mode-stats.js`. Le **marquage** est systématique (`invalidCohortTrades` / `invalidCohorts` / `invalidCohortExcluded` dans toutes les stats) ; l'**exclusion** est opt-in (`opts.excludeInvalidCohorts` ou `EXCLUDE_INVALID_COHORTS=1`) pour ne pas réécrire une equity curve publiée par accident. Impact : `node tools/invalid-cohort-report.js`. Cohorte active : `scanDate` ∈ [2026-06-16 … 2026-07-13] (93 trades) — seuils de score jamais atteignables, donc aucune sélection réelle.

### Scanner Pipeline
- **No Skip** : Jamais skipper une étape du pipeline (anti-dilution, MCP enrichment, risk gating, validation) sans accord explicite.
- **Dilution Check** : Toujours vérifier SEC filings (S-3, warrants, ATM, fonds toxiques) avant de recommander. Leçon INDO.
- **Screener Mcap Filter** : RunScreener DSL DOIT borner la capitalisation, sinon ne retourne que des penny stocks.
  ⚠️ La notation `$2B` / `$10M` **n'est pas du DSL valide** — le moteur renvoie `unknown name $2B` et le job
  échoue en compilation (vérifié le 2026-08-10). Écrire des littéraux numériques : `market_cap>2e9`,
  `avg_volume>1e7`. Un screener qui échoue à la compilation rend un vivier VIDE, pas un vivier dégradé —
  d'où des scans « 0 candidat » inexpliqués.
- **Candlestick Bull Pipeline** : `/scanner` doit exécuter `candlestick-scanner.js` avant sweep/gen-status-page, sinon bull = 0 signaux.
- **Candlestick No MCP** : `candlestick-scanner.js` utilise le fichier univers local, JAMAIS MCP RunScreener.
- **Scanner Date Convention** : Dossier scanner = prochaine séance (D+1 après 22h30, D+3 vendredi soir).
- **Pipeline Gotchas** : 13 bugs récurrents documentés. Vérifier QA après chaque pipeline run.

### Mode Strategy
- **Modes Independent** : Les 5+ modes sont des stratégies alternatives indépendantes. Pas de cross-mode gating. Même ticker dans plusieurs modes = confirmation.
- **Regime-Aware Eval** : JAMAIS évaluer un changement de config par replay uniforme sur toute la période. Configs = regime-aware + weekly-adaptive.
- **Segment Replay Absolute DD** : DD/return absolu d'un replay segment = NON FIABLE. Utiliser uniquement deltas relatifs A/B.
- **Optimize-Param Static Artifact** : `optimize-param.js` surestime (filtres statiques). Toujours revalider via `validate-config-change.js`.
- **Tiered Mcap Oscillation** : En oscillation régime : <$2B reject, $2-10B ×0.5, $10-50B ×0.7.
- **TKL Identity** : TKL = spécialiste momentum avec DD maîtrisé, PAS "small-cap". Inclut quality momentum tous caps.
- **Fortress Mandate** : Fortress = participer au upside AVEC parachute, PAS un mode low-return. Trailing + décorrélation + de-risk.
- **Mode Success Criteria** : Modes doivent battre SPY ≥3× chaque semaine, max DD ≤8%.
- **A+ Grading** : 4 éliminatoires (guidance relevée, ≥5 EPS beats, PE fwd <35x, ext EMA20 ≤3%) + scoring /100.

### Publication
- **Content QA Gate** : AVANT tout `add_card.js`/commit d'un article éditorial (analyse, daily, weekly), passer le gate structurel : `node tools/qa-content.js <path> --strict` (exit 1 = bloquant). Complète `tools/qa-check.js` (scanner). Fact-check MCP = étape runtime séparée (voir en-tête du script).
- **add_card Ordering** : `add_card.js` APPEND pour weekly/series/tech → remonter en tête après ajout. Landing trie par ordre du JSON, pas par date.
- **No Portfolio Section** : JAMAIS de section Portfolio/positions dans les dailys. Pas dans le template.
- **No False Caveats** : Ne pas inventer de faux caveats (liquidité, slippage) pour tempérer — vérifier les chiffres.
- **Pipeline Updates Format** : Inclure l'heure (HH:MM) dans chaque update de progression.

### Vidéo
- **No Auto Video** : Jamais lancer de vidéo sauf demande explicite dans la session courante.
- **Video Style** : Français, style dynamique/abordable/didactique, quizzes toutes les 15-20 min.

### Général
- **No Delete SSD** : JAMAIS supprimer/déplacer des fichiers sans validation explicite par item.

## Post-tâche : Commit & Push (OBLIGATOIRE)
Après chaque tâche réussie : `add_card.js` → vérifier `git status` → `git add` (fichiers spécifiques) → `git commit` → `git push origin main`.
**Ne PAS push si** : HTML < 10KB, `add_card.js` échoué, génération incomplète.
