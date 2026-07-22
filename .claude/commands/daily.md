# /daily — Briefing quotidien harnaché (collecte complète → war room → panel → publish → Telegram)

Produit `daily/YYYYMMDD/index.html` (17 sections, template `daily/CLAUDE.md`, gold standard récent :
dernier daily publié) en appliquant le skill **`content-harness`** de bout en bout. Skills compagnons :
`daily-weekly-analysis-workflows`, `perf-parallel-mcp`, `senior-review`, `telegram-notifications-qa`.

## Arguments
`$ARGUMENTS`
- vide → date du jour (Paris). Samedi = bilan hebdo complet ; dimanche = crypto + géopolitique.
- `--date YYYYMMDD` → date explicite.
- `ne poste pas` / `dry-run` → tout sauf add_card/push/Telegram.

## Phase 0 — Preflight (H0)
1. `date -u` pour le jour réel (leçon « On est le lundi 20 juillet idiot » : ne JAMAIS déduire le jour).
2. `GetStatus()` → down = HARD STOP. `get_context(query='daily briefing', workspace='dailystocks')`.
3. Anti-doublon : `grep "YYYYMMDD" data/daily.json` → existe = STOP, signaler.
4. Créer `daily/YYYYMMDD/harness.json` (manifeste de fraîcheur, rempli à chaque salve).

## Phase 1 — Collecte (H1, trois salves parallèles)
**Salve 1 (macro, un seul message)** :
- `GetMarketContext(facets='overview')` async → poll `Jobs` (indices, commodities, FX, crypto, taux,
  régime switcher, sentiment presse, news datées, halts, mouvements sectoriels).
- `GetMarketContext(facets='regime', model='ensemble', horizon_days=5)` (confiance + transition + crise 5j).
- `DtxRegime(asof=today)` — contrôle croisé moteur systematic ; divergence > 1 cran = à écrire.
- `GetEarningsCalendarFiltered(days_ahead=2, min_expected_move=2)` (prints du jour + demain, consensus,
  moves implicites — indisponibles hors séance options : le dire).
- `GetInsiderActivity(days=3)`.
- `OptionsAnalytics(action='sentiment', symbol=<print majeur du soir>)` — term structure VIX complète
  9D/30D/3M/6M + P/C du dossier.
- `WatchlistDigest()` — la watchlist (IOVA/ALT/ALLR/EQX…) se rafraîchit À CHAQUE daily, pas sur demande.

**Salve 2 (détail)** :
- `QueryData(types='quote,social_sentiment,capital_flow,trading_signals', symbols=CSV indices+secteurs+crypto)`
  — si approval-gated : petits lots, sinon `GetInstruments` sur les 3-5 tickers clés du jour.
- `ExplainSymbolMove` sur les 2-3 top/bottom movers AVANT de raconter leur mouvement.
- WebSearch : séance Europe/Asie du matin, géopolitique, attribution news — chaque fait daté.

**Salve 3 (si trade ideas)** : reprendre les setups du scanner du jour (`scanner/YYYYMMDD/data.json`) —
JAMAIS recalculer des niveaux à la main. `PortfolioRisk(action='correlation', symbols=CSV string)` si
l'article présente ≥2 lignes ensemble ; écarter/mentionner les paires > 0,7.

## Phase 2 — Gate fraîcheur (H2, bloquant)
`node tools/check-freshness.js daily/YYYYMMDD/harness.json` — budgets du skill `content-harness`
(régime 6h, clôtures 24h, calendriers 24h, insiders 96h). Exit 1 = STOP, recollecter.

## Phase 3 — War room retail (H3)
Bull / Bear-contrarian / Lecteur retail sur les données collectées. L'article porte UNE thèse du jour
avec au moins une lecture non-consensuelle falsifiable (niveau + date d'invalidation), et chaque section
clé répond à « et donc ? » (niveau, taille, invalidation). Tracer dans le chat en 3-6 lignes ce que la
war room a écarté.

## Phase 4 — Rédaction
Template `daily/CLAUDE.md` (17 sections, FAB 6 items, dashboard 8 cartes, ECharts). Français, accents
UTF-8 directs, chaque chiffre horodaté (« clôture mardi », « ~12h20 Paris »), sources `.source-ref`
par section, zéro vocabulaire d'outillage interne. > 30 KB.

## Phase 5 — QA locale (H4, bloquant)
`qa-content --strict` + `check-ai-tells --strict` + `check-freshness`. Un finding = corriger avant de continuer.

## Phase 6 — Panel senior (H5, bloquant)
`Workflow({scriptPath: ".claude/workflows/senior-review.js", args:{artifacts:[{path:"daily/YYYYMMDD/index.html", type:"daily", label:"Daily JJ/MM"}], applyFixes:true}})`
BLOCK = ne pas publier. Après FIXED : re-passer Phase 5 (le panel modifie le fichier).

## Phase 7 — Publication (H6)
1. `node tools/add_card.js daily/YYYYMMDD/index.html` (sauf si le gate du panel l'a déjà fait — vérifier
   `git status`, jamais deux cartes).
2. `data/radar.json` réécrit (régime, risques, events, opportunités du jour — min 4 par catégorie).
3. Commit fichiers explicites + push `main`.
4. Telegram alias `daily`, `format:"html"` : titre, 3-5 puces ultra-simples (registre enfant de 10 ans),
   lien `https://articles.dailytickers.com/daily/YYYYMMDD/`.
5. Compte-rendu chat : verdict panel + gates + ce que la war room a écarté.

## Garde-fous (non négociables)
- MCP HARD STOP intégral (jamais de substitution, jamais d'estimation).
- Pas de section Portfolio/positions dans un daily.
- Niveaux de trade = ceux du scanner du jour, sinon pas de niveaux.
- `--skip` quoi que ce soit = uniquement sur demande explicite du user dans LA session.
