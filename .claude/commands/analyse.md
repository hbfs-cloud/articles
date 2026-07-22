# /analyse — Analyse ticker harnachée (bundle MCP complet → valuation → dilution → grading → panel → publish)

Produit/actualise `analyses/{TICKER}/` via le pipeline JSON (`data/analyses-data/{TICKER}.json` →
`tools/publish-analysis.js`) en appliquant le skill **`content-harness`**. Skills compagnons :
`daily-weekly-analysis-workflows` (§Analyse [TICKER] + encart valorisation), `aplus-setups`, `senior-review`.

## Arguments
`$ARGUMENTS`
- `TICKER` (obligatoire) — tout asset type (stock, etf, crypto, forex, commodity, index).
- `--update --grade X --reason "…"` → re-grade rapide sans régénération (publish-analysis --update).
- `dry-run` → JSON + validation sans publication.

## Phase 0 — Preflight (H0)
`GetStatus()` (HARD STOP si down) ; `get_context(query='analyse {TICKER}', workspace='dailystocks')` ;
si l'analyse existe → archiver dans `analyses/{TICKER}/archive/{YYYYMMDD}/` ; créer
`data/analyses-data/{TICKER}.harness.json`.

## Phase 1 — Collecte (H1) — le bundle COMPLET, c'est ici que la sous-utilisation se corrige
**Salve 1 (instrument)** :
- `GetInstruments(symbols='{TICKER}')` — bundle intégral : quote, technicals (RSI/EMA/ATR/MACD),
  support/résistance, short interest + CTB + days-to-cover, options OI/max pain/P&C, sentiment
  multi-sources (social, vidéo, news), capital flow, dark pool, calendrier (earnings/dividendes), profil.
- `GetSymbolSignals(symbol='{TICKER}')` + `ExplainSymbolMove(symbol='{TICKER}')` (le mouvement récent
  s'explique, il ne se paraphrase pas).
- `QueryData(types='financials,stats,earnings_quarterly,analyst_actions,insider_transactions,news,holders', symbols='{TICKER}')`
  (lots si approval-gated).
- `GetReferentialData` si référentiel nécessaire (secteur/industrie/indices d'appartenance).
**Salve 2 (options & positionnement)** :
- `OptionsAnalytics(action='sentiment', symbol='{TICKER}')` — P/C, IV si disponible (0,01 = donnée
  bidon, ne pas citer).
- `ScreenOptions` sur le ticker — flux inhabituels, strikes chargés.
- `GetInsiderActivity(symbols='{TICKER}', days=30)`.
- `GetEarningsCalendarFiltered(days_ahead=7)` — print imminent = fenêtre d'exclusion dans le Trade Idea.
**Salve 3 (risque)** :
- Anti-dilution OBLIGATOIRE : `QueryData(types='sec_filings,flags', days=180)` + WebSearch
  `"{TICKER} SEC S-3 prospectus warrants ATM"` (S-3/shelf, warrants ITM, ATM, underwriters agressifs,
  PIPE, reverse split, serial diluter) → risque = mention rouge Risks + impact Trade Idea (score↓,
  stop élargi, ou exclusion).
- `PortfolioRisk(action='correlation')` vs book ouvert si le Trade Idea entre au book.
- `DtxRegime` + `GetMarketContext(facets='regime')` — le grade vit dans un régime.

## Phase 2 — Modules déterministes (bloquants, zéro chiffre LLM)
- Valorisation : financials MCP → fichier → `node tools/lib/valuation-multi.js --in fin.json --ticker {TICKER}`
  (DCF/Owner Earnings/EV-EBITDA/EBO ; input manquant = méthode `na`, jamais estimée).
- Board Value/Quality : `node tools/lib/value-quality-board.js --in fundamentals.json` (5 personas).
- Grading A+ : grille `aplus-setups` — 4 éliminatoires (guidance relevée, ≥5 EPS beats, PE fwd <35x,
  ext EMA20 ≤3%) + scoring /100. Le grade sort de la grille, pas du feeling.

## Phase 3 — Gate fraîcheur + war room (H2-H3)
`node tools/check-freshness.js data/analyses-data/{TICKER}.harness.json` (quote 24h, financials 168h,
SEC 168h, régime 6h). War room : Bull (thèse), Bear (le démontage en 30 secondes — dilution, valuation,
crowding, macro inversée), Retail (entrée actionnable ≤3% du spot, stop, taille, invalidation datée).
Verdict et grade DOIVENT survivre au Bear.

## Phase 4 — JSON + rendu
`data/analyses-data/{TICKER}.json` conforme `tools/lib/analysis-schema.json` (meta/header/verdict/
business/fundamentals/technicals/risks/tradeIdea ; référence : `MATX.json`). Chaque champ = donnée de
session. Puis `node tools/publish-analysis.js data/analyses-data/{TICKER}.json --dry` pour valider.

## Phase 5-6 — QA + Panel (H4-H5, bloquants)
`qa-content --strict` sur le HTML rendu + `check-ai-tells` + `check-freshness`, puis senior-review
`type:"analyses"` (panel COMPLET dont Strategist + Value/Quality Board), applyFixes ; BLOCK = ne pas
publier ; re-QA après fixes.

## Phase 7 — Publication (H6)
`node tools/publish-analysis.js data/analyses-data/{TICKER}.json --commit` (validate → render →
add_card → commit) puis push `main`. Telegram alias `analysis` en `format:"html"` (verdict, grade,
niveaux, lien `https://articles.dailytickers.com/analyses/{TICKER}/`). Compte-rendu chat.

## Garde-fous
- Watchlist (IOVA/ALT/ALLR/EQX…) : toute session daily/weekly les rafraîchit ; /analyse sur un ticker
  watchlist met à jour grade + carte, avec justification chiffrée de tout changement de note.
- No Hallucination (leçon ALT/IOVA/ALLR) : 52W, cash, mcap, événements = MCP/WebSearch de session.
- Pas de faux caveats ; R/R calculé à une entrée actionnable ≤3% du spot.
- MCP HARD STOP intégral.
