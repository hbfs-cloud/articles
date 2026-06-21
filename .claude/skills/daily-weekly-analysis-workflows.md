---
name: daily-weekly-analysis-workflows
description: Article generation workflows for daily briefing, weekly review, ticker analysis, scanner retrospective. Auto-load when user says analyse daily, briefing du jour, nouvelle analyse weekly, analyse [TICKER], rétrospective scanner. Sub-CLAUDE.md in daily/, weekly/, scanner/ holds full templates — this skill is the workflow checklist.
user_invocable: false
---

# Article Generation Workflows

## "Nouvelle analyse weekly"
**Langue par défaut : anglais intermediate.** Voir `weekly/CLAUDE.md` pour template complet et 18 sections obligatoires.

1. **Date** : weekly couvre semaine **À VENIR**. Dossier = `weekly/YYYYMMDD/` (YYYYMMDD = lundi). Anti-doublon : `ls weekly/` ET `grep "YYYYMMDD" data/weekly.json` — NE PAS ajouter si URL existe.
2. **Référence** : Lire `weekly/20260223/index.html` pour layout exact
3. **Collecte MCP** : `GetMarketOverview` (deep — trending, sector variations, economic calendar) + `QueryData` types=quote,**social_sentiment,capital_flow**,trading_signals (SPY, QQQ, DIA, IWM, GLD, SLV, USO, TLT, EFA, EEM, FXI, BTC-USD, ETH-USD, SOL-USD, XRP-USD) + WebSearch (géopolitique, earnings clés, Polymarket)
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

## "Analyse Daily" / "Briefing du jour"
**Langue par défaut : anglais intermediate.** Voir `daily/CLAUDE.md` pour template complet et 17 sections obligatoires.

1. **Collecte MCP** : `GetMarketOverview` (deep — exploiter trending, sector variations, economic calendar, earnings calendar) + `QueryData` types=quote,**social_sentiment,capital_flow**,trading_signals (SPY, QQQ, DIA, IWM, EFA, EEM, FXI, GLD, SLV, USO, TLT, BTC-USD, ETH-USD, SOL-USD, XRP-USD) + WebSearch (géopolitique, Polymarket)
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
