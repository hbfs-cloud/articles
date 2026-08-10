# /weekly — Revue hebdomadaire harnachée (semaine À VENIR, collecte complète → war room → panel → publish)

Produit `weekly/YYYYMMDD/index.html` (YYYYMMDD = lundi de la semaine COUVERTE, 18 sections, template
`weekly/CLAUDE.md`, layout de référence `weekly/20260223/`) via le skill **`content-harness`** intégral.
Skills compagnons : `daily-weekly-analysis-workflows`, `sector-rotation`, `macro-event-playbook`,
`perf-parallel-mcp`, `senior-review`.

## Arguments
`$ARGUMENTS`
- vide → prochain lundi (ou lundi courant si on est dimanche/lundi).
- `--date YYYYMMDD` → lundi explicite.
- `dry-run` → tout sauf publication.

## Phase 0 — Preflight (H0)
`date -u` ; `GetStatus()` (HARD STOP si down) ; `get_context(query='weekly review', workspace='dailystocks')` ;
anti-doublon `ls weekly/` + `grep "YYYYMMDD" data/weekly.json` ; créer `weekly/YYYYMMDD/harness.json`.

## Phase 1 — Collecte (H1)
**Salve 1 (bilan de la semaine écoulée + régime)** :
- `GetMarketContext(facets='overview')` async (poll `Jobs`) + `facets='regime'` ensemble 5j.
- `DtxRegime(asof)` — croisement systematic ; consigner les DEUX scores dans l'article (section régime).
- `QueryData(types='quote,social_sentiment,capital_flow,trading_signals', symbols='SPY,QQQ,DIA,IWM,GLD,SLV,USO,TLT,EFA,EEM,FXI,BTC-USD,ETH-USD,SOL-USD,XRP-USD')`
  (petits lots si approval-gated).
- `OptionsAnalytics(action='sentiment')` — term structure VIX : la pente 9D→6M EST une section du weekly.
- **`QueryData(types='unusual_options,dark_pool,max_pain', symbols=<noms de la thèse>)` — OBLIGATOIRE.**
  L'empreinte L2 d'`EDITORIAL_STYLE` exige au moins un flux institutionnel réel ; un weekly sans aucun
  (intérêt ouvert, dark pool, put-call, max pain) est BLOQUÉ au panel quelle que soit la qualité du reste.
- ⛔ Toute valeur présentée comme « clôture du <jour> » se demande en `bars_daily` **avec `end_date`**.
  `indices`/`commodities`/`quote` nus renvoient le dernier prix : lancés un lundi matin ils rapportent du
  live que l'on étiquette ensuite « clôture de vendredi » (incident 20260810, 4 inversions de signe).
- `ExplainSymbolMove` sur les 3 mouvements de la semaine qu'on raconte.

**Salve 2 (semaine à venir)** :
- `GetEarningsCalendarFiltered(days_ahead=7, min_expected_move=3)` — le mur de prints de la semaine,
  avec consensus et fenêtres d'exclusion.
- `GetInsiderActivity(days=7)` — flux initiés hebdo.
- `RunScreener`/`RunAutoScreener` — leaders/laggards par secteur pour la section rotation (mcap > $2B
  dans le DSL, sinon penny stocks).
- `WatchlistDigest()`.
- WebSearch : calendrier macro (Fed/BCE/CPI/NFP), géopolitique, Polymarket via `GetMarketContext`.

**Salve 3 (book & modes)** : `PortfolioRisk(action='correlation')` sur les lignes ouvertes du scanner si
la section book les montre ; performance des modes = chiffres des générateurs (`data/backtest-results.json`
frozen_*), JAMAIS retapés à la main ; modes scriptés = `DtxReplay`/staging seulement si section dédiée.

## Phase 2 — Gate fraîcheur (H2, bloquant)
`node tools/check-freshness.js weekly/YYYYMMDD/harness.json`. Budgets standard ; clôtures vendredi
tolérées 72h le week-end.

## Phase 3 — War room retail (H3)
La question du weekly : « quelle est LA bascule de la semaine, et qu'est-ce qui l'invaliderait ? »
Bull/Bear/Retail ; au moins un scénario non-consensuel falsifiable daté ; le plan de la semaine dit
aussi ce qu'on NE fait PAS (et pourquoi).

## Phase 4 — Rédaction
18 sections, > 100 KB, anglais intermediate par défaut (sauf demande contraire), badge « Latest Report »

⛔ **Le seuil de 100 KB se franchit par la DONNÉE, jamais par la prose** (incident 20260810 : BLOCK slop L4,
13 391 mots sur 40 sections pour ~20 faits, dont 5 sections qui se dupliquent). Cible rédactionnelle :
**~4 000 mots**. Le volume vient des tableaux, cartes de métriques, blocs de niveaux et graphiques ECharts —
denses en octets, sobres en mots. Si l'article approche 100 KB en ajoutant des paragraphes, c'est le signe
qu'il manque des données, pas des mots : retourner en collecte. Deux sections qui disent la même chose sous
deux titres = coupe immédiate. Un weekly qui n'atteint pas 100 KB avec ~4 000 mots denses doit collecter
plus (flux institutionnels, niveaux par titre, comparaisons datées), pas écrire plus.
géré par JS (jamais en dur), FAB, `/assets/report.css`, chiffres horodatés, sources par section.

## Phase 5-6 — QA + Panel (H4-H5, bloquants)
`qa-content --strict` + `check-ai-tells --strict` + `check-freshness`, puis senior-review
(`type:"weekly"`, applyFixes) ; BLOCK = pas de publication ; re-QA après fixes.

## Phase 7 — Publication (H6)
1. `node tools/publish.js --type weekly --path weekly/YYYYMMDD/index.html` — add_card APPEND pour
   weekly → REMONTER la carte en tête de `data/weekly.json` via l'outil (jamais d'édition JSON à la main).
2. `data/radar.json` mis à jour (events de la semaine).
3. Commit + push `main` ; Telegram alias `weekly` en `format:"html"` ; compte-rendu chat.

## Garde-fous
- Le weekly couvre la semaine À VENIR — un weekly daté du lundi passé est un bug.
- Prévisions : formulées en zones probabilistes avec niveaux d'invalidation, jamais en certitudes.
- Perfs des modes : uniquement les frozen stats des générateurs. Écart vu = investiguer, pas maquiller.
- MCP HARD STOP + interdits du skill `content-harness` (jargon interne, chiffres hors session).
