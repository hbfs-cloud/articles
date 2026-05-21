# CLAUDE.md — DailyTickers Articles Project

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

## MCP_GATEWAY_URL (CRITIQUE)
```bash
MCP_GATEWAY_URL=https://mcp.dailytickers.com/mcp
```
**TOUJOURS exporter, JAMAIS accepter le stub silencieusement.** Sans cette URL, `refresh-risk-metrics.js --stub` écrit un schéma vide.

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
13. **Logo** : brand-bar = logo MW `/logo.svg`. Cartes index.html = logo parqet.com. JAMAIS logo société dans ticker-header.
14. **⚠️ Ticker-header metrics (CRITIQUE)** :
    - `<div class="ticker-metric"><div class="tm-value">VALUE</div><div class="tm-label">LABEL</div></div>` (value AVANT label)
    - **JAMAIS** `metric-value` (font trop grande), **JAMAIS** `metric-label`, **JAMAIS** `ticker-metric-value`/`ticker-metric-label`
    - Structure `ticker-header` plate — PAS de nesting `ticker-header-inner`, `ticker-brand`, `ticker-hero`, etc.
    - **Référence** : `analyses/TARA/index.html` = gold standard
15. **Brand-nav** : `<div class="brand-nav">` (PAS `<nav class="brand-nav">`). JAMAIS `class="active"` en dur.

## Tags — Taxonomie
| Catégorie | Tags | Couleur |
|-----------|------|---------|
| Région | `us`, `eu`, `asia`, `crypto`, `commodity`, `forex`, `etf` | Bleu |
| Secteur | `tech`, `semis`, `healthcare`, `energy`, `financials`, `industrials`, `materials`, `consumer`, `defense` | Vert |
| Thème | `ai`, `earnings`, `geopolitique`, `macro`, `technique`, `options`, `dividende`, `small-cap`, `speculative` | Violet |
| Contenu | `trade-idea`, `formation`, `retrospective` | Ambre |

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

| Skill | Trigger keywords |
|-------|------------------|
| `mcp-forecast-timesfm` | forecast, TimesFM, ForecastRaw, ForecastVix, Backtest |
| `mcp-gateway-tools` | QueryData, GetMarketOverview, GetInstruments, RunScreener, GetRegimeProbability, GetCorrelationMatrix, GetEarningsCalendarFiltered, OptimizeSizing, Polymarket |
| `scanner-pipeline` | scanner, scan du jour, sweep, regime, risk gating, dilution, Sharia, optimize-param, Mountain Plateau, rétrospective |
| `trading-executor` | run-session, gen-trading-plan, broker, alpaca, ibkr, saxo, trading212, binance, paper mode |
| `status-page-architecture` | scanner/status, Time Machine, tmUpdateLive, tmLoadIdx, lp-grid, panel(), rotation tracking |
| `daily-weekly-analysis-workflows` | analyse daily, briefing du jour, nouvelle analyse weekly, analyse [TICKER] |
| `portfolio-api-modes` | portfolio/v1, modes-config, regime-recalibrate, turbo/dynamic/balanced/secured/fortress/tkl |
| `live-tracker-widgets` | live-tracker.js, widget/, allorigins, Yahoo proxy, setup card prices |
| `telegram-notifications-qa` | telegram-publish-notify, topic Telegram, notif article |
| `scheduled-tasks-veille` | veille tech, tâche planifiée, Discord bot, claude-discord-bot |

## Post-tâche : Commit & Push (OBLIGATOIRE)
Après chaque tâche réussie : `add_card.js` → vérifier `git status` → `git add` (fichiers spécifiques) → `git commit` → `git push origin main`.
**Ne PAS push si** : HTML < 10KB, `add_card.js` échoué, génération incomplète.
