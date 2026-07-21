---
name: daily-weekly-analysis-workflows
description: Article generation workflows for daily briefing, weekly review, ticker analysis, scanner retrospective. Auto-load when user says analyse daily, briefing du jour, nouvelle analyse weekly, analyse [TICKER], rétrospective scanner. Sub-CLAUDE.md in daily/, weekly/, scanner/ holds full templates — this skill is the workflow checklist.
user_invocable: false
---

# Article Generation Workflows

## ⚡ Exécution (doctrine `perf-parallel-mcp`)
Le goulot = les appels MCP en série. Isoler le MCP en salves parallèles (R2), batcher `QueryData`
multi-symboles (R3), preflight `GetStatus` 1× (R4). **Salve 1** (un seul message, tous les tool_use //) :
lancer `GetMarketContext(facets='overview')` async (poll `Jobs`), `QueryData` quote/social_sentiment/capital_flow/trading_signals
sur TOUT le panier d'indices en UN seul CSV (SPY/QQQ/DIA/IWM/GLD/TLT/BTC-USD…), `GetInstruments` (analyse ticker), `WebSearch` géopolitique/Polymarket.
**Salve 2** (//): enrichissement par ticker — `QueryData` analyst_actions/insider_transactions/ctb/news/options_chain/earnings_quarterly/financials/stats
+ support_resistance/volume_profile + bars. **Salve 3** (//): dilution — `WebSearch` SEC S-3/warrants + `insider_transactions`/`news`.
Rédaction/valorisation (`valuation-multi.js`) = code local (zéro MCP). Fail-closed + MCP HARD STOP conservés (la perf n'assouplit aucun invariant).

## "Nouvelle analyse weekly"
**Langue par défaut : anglais intermediate.** Voir `weekly/CLAUDE.md` pour template complet et 18 sections obligatoires.

1. **Date** : weekly couvre semaine **À VENIR**. Dossier = `weekly/YYYYMMDD/` (YYYYMMDD = lundi). Anti-doublon : `ls weekly/` ET `grep "YYYYMMDD" data/weekly.json` — NE PAS ajouter si URL existe.
2. **Référence** : Lire `weekly/20260223/index.html` pour layout exact
3. **Collecte MCP** : `GetMarketContext(facets='overview')` (canonique, ex-GetMarketOverview — async seul, poller via `Jobs`; deep — trending, sector variations, economic calendar) + `QueryData` types=quote,**social_sentiment,capital_flow**,trading_signals (SPY, QQQ, DIA, IWM, GLD, SLV, USO, TLT, EFA, EEM, FXI, BTC-USD, ETH-USD, SOL-USD, XRP-USD) + WebSearch (géopolitique, earnings clés, Polymarket)
4. **Générer** : `weekly/YYYYMMDD/index.html` avec 18 sections (> 100KB). CSS = `/assets/report.css`. FAB obligatoire, PAS de hero-brand-link.
5. **Indexer + Push** :
   ```bash
   node tools/publish.js --type weekly --path weekly/YYYYMMDD/index.html
   ```

## "Analyse [TICKER]"
**Pipeline structuré** : LLM produit un JSON → `publish-analysis.js` valide, rend en HTML et indexe.
Supporte tous les asset types : stock, etf, crypto, forex, commodity, index.

1. **Si existe déjà** : archiver dans `analyses/{TICKER}/archive/{YYYYMMDD}/`
2. **Collecte MCP** : `GetInstruments` + `QueryData` (quote, **social_sentiment, capital_flow**, sentiment_overall, trading_signals, analyst_actions, insider_transactions, ctb, news, options_chain, support_resistance, volume_profile, earnings_quarterly, holders)
   - `bars_daily`, `bars_intraday` : Yahoo Finance primaire. MCP fallback.
   - `financials`, `stats` : Yahoo `quoteSummary?modules=financialData,defaultKeyStatistics,summaryDetail` primaire. MCP fallback.
3. **⚠️ Dilution Check (OBLIGATOIRE)** : `WebSearch "{TICKER} SEC filing S-3 prospectus dilution warrants"` + vérifier `insider_transactions` et `news` pour :
   - Prospectus S-3/shelf registration SEC, warrants actifs, fonds agressifs (H.C. Wainwright, Maxim Group, Roth Capital, Ladenburg Thalmann), ATM offerings, serial diluters
   - **Si risque** : mention rouge dans Risks + impact Trade Idea (réduire score, élargir stop, ou exclure)
4. **Produire le JSON** dans `data/analyses-data/{TICKER}.json` :
   - Schéma : `tools/lib/analysis-schema.json` — champs required : meta, header, verdict, business, fundamentals, technicals, risks, tradeIdea
   - `meta.assetType` : "stock" | "etf" | "crypto" | "forex" | "commodity" | "index" — pilote le rendu (chart source, format prix)
   - Toutes les données doivent venir de MCP/WebSearch — JAMAIS inventées
   - Référence JSON : `data/analyses-data/MATX.json`
   - **Grading A+ (grille empirique juin 2026)** — 4 éliminatoires obligatoires : (1) guidance relevée, (2) ≥5 EPS beats consécutifs, (3) PE fwd <35x, (4) extension EMA20 ≤3%. Scoring pondéré /100 : PEG (15pts), buyback (8pts), dividende (7pts), structure (20pts), R/R≥2.5 (15pts), SEC clean (15pts). A+ ≥92, A ≥88. Détails dans `.claude/skills/aplus-setups.md`.
5. **Publier** :
   ```bash
   node tools/publish-analysis.js data/analyses-data/{TICKER}.json --commit
   ```
   Ce script enchaîne : validate JSON → render HTML → add_card.js → git commit.
   Utiliser `--dry` pour valider sans écrire.
6. **Quick update** (re-grade sans régénération complète) :
   ```bash
   node tools/publish-analysis.js --update {TICKER} --grade B+ --reason "R/R collapsed" --commit
   ```

### Encart valorisation — « ce qu'en pensent 5 méthodes de valorisation »
Axe de score CONSULTATIF, chiffré et vérifiable (anti-slop). Lib déterministe `tools/lib/valuation-multi.js`
(idée #5) : elle NE FETCH RIEN — l'agent tire les financials du MCP et les lui passe. Aucun LLM dans la
math, aucun chiffre fabriqué (fail-closed : un input manquant ⇒ la méthode devient `na`, jamais estimée).

1. **Collecter les financials MCP** (l'agent, pas le subprocess) : `QueryData types=financials,stats,quote`
   → `profitMargins, totalRevenue, totalCash, totalDebt, ebitda, earningsGrowth/revenueGrowth, bookValue,
   sharesOutstanding, beta, price`. Passer aussi, SI disponibles depuis un autre type MCP : `freeCashFlow`
   (→ DCF), `depreciation`/`capex`/`netIncome` (→ Owner Earnings), `interestCoverage` ou `ebit`+`interestExpense`
   (→ coût de la dette du WACC), `medianEvEbitda` ou `evEbitdaHistory[]` (→ EV/EBITDA médian). Chaque champ absent
   ⇒ méthode `na` FLAGGÉE (jamais comblée). Si MCP stale/incohérent → **MCP HARD STOP**, on ne valorise pas.
2. **Écrire les financials dans un fichier** puis lancer :
   ```bash
   node tools/lib/valuation-multi.js --in financials.json --ticker {TICKER}
   ```
   Blend déterministe : **DCF 35% + Owner Earnings 35% + EV/EBITDA médian 20% + Residual Income (EBO) 10%**,
   sur scénarios **bear/base/bull 20/60/20** ; WACC = CAPM (rf 4,5% + β×6%, coût dette via interest coverage,
   tax shield 0,75, clampé [6%,20%]) ; croissance haute plafonnée 25% (10% si mcap>50 Md), terminal 3%.
   Sortie au **schéma pivot** `{ signal, confidence, reasoning }` (réutilise `tools/lib/signal-schema.js`) :
   `signal = weighted_gap = (valeur_modèle − marketCap)/marketCap` → bullish >+15%, bearish <−15% ; confidence
   explicable `= min(|gap|/0.30 × 100, 100)`.
3. **Rédiger l'encart** dans l'analyse à partir de la SORTIE (jamais d'un chiffre inventé par le LLM) :
   valeur modèle vs capitalisation, gap %, méthodes utilisées (ex. `4/4`), fourchette bear/base/bull, WACC,
   et honnêteté sur les méthodes `na`. Le LLM = narration seulement. Contrat pivot commun au board Value/Quality
   (`tools/lib/value-quality-board.js`) → les deux axes se juxtaposent proprement dans l'analyse.
   Smoke-test / exemple reproductible : `node tools/lib/valuation-multi.js --self-test`.

## "Analyse Daily" / "Briefing du jour"
**Langue par défaut : anglais intermediate.** Voir `daily/CLAUDE.md` pour template complet et 17 sections obligatoires.

1. **Collecte MCP** : `GetMarketContext(facets='overview')` (canonique, ex-GetMarketOverview — async seul, poller via `Jobs`; deep — exploiter trending, sector variations, economic calendar, earnings calendar) + `QueryData` types=quote,**social_sentiment,capital_flow**,trading_signals (SPY, QQQ, DIA, IWM, EFA, EEM, FXI, GLD, SLV, USO, TLT, BTC-USD, ETH-USD, SOL-USD, XRP-USD) + WebSearch (géopolitique, Polymarket)
2. **⚠️ ANTI-DOUBLON OBLIGATOIRE** : avant `add_card.js`, vérifier que URL `/daily/YYYYMMDD/` n'existe PAS dans `data/daily.json` avec `grep "YYYYMMDD" data/daily.json`. Si existe → NE PAS ajouter, signaler doublon.
3. **Générer** `daily/YYYYMMDD/index.html`. CSS = `/assets/report.css`.
4. **Samedi** = briefing complet (récap vendredi + bilan semaine + preview lundi)
5. **Dimanche** = crypto-only + géopolitique (marchés fermés)
6. **Formation progressive** : cursus 4 semaines cyclique (Bases → Technique → Fondamentaux → Avancé)
7. **Format date OBLIGATOIRE `report-card-meta`** : `DD mois YYYY` français minuscule (ex: `14 mars 2026`). JAMAIS format anglais ("March 14"), JAMAIS majuscule mois ("Mars"), JAMAIS suffixe ("— Vendredi"), JAMAIS espaces superflus.
8. **Indexer + Push** :
   ```bash
   node tools/publish.js --type daily --path daily/YYYYMMDD/index.html
   ```

## "Rétrospective Scanner"
**Langue par défaut : anglais intermediate.** Voir `scanner/CLAUDE.md` section 5bis pour template complet.

Workflow détaillé dans le skill `scanner-pipeline`.
