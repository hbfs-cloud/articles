---
name: screener-reliability-20260702
description: "État de fiabilité RunScreener/RunAutoScreener (testé 2026-07-02) : DSL rising() en conjonction OK, mcap filter OK, AutoScreener régime OK. Gaps gateway : enable_backtest ne rend pas backtest_result, region=eu rend 0 candidat, AutoScreener ignore le floor mcap."
metadata:
  type: reference
---

# Fiabilité screeners MCP (testé en réel 2026-07-02)

**Fonctionne** :
- `RunScreener` DSL custom : `rising('ema50',10)` en conjonction ✅ (bug historique fixé),
  `trend_strength()` en score_expr ✅, filtre `market_cap>` respecté ✅, stop/TP/ATR par candidat.
- `RunAutoScreener` : régime risk_on 0.79 cohérent avec nos scans, 8837 symbols ready,
  candidats enrichis (secteur, industry, next_earnings_date, entry/stop/TP).
- `as_of` point-in-time accepté (walk-forward sans lookahead possible).

**Gaps gateway (backlog marketwatch-gateway)** :
1. `enable_backtest=true` documenté (WR/DD/Sharpe/R² sur 6 fenêtres) mais l'item
   `backtest_result` n'est JAMAIS rendu (2 essais consistants, jobs completed).
   → C'est LA feature pour valider les recettes ; à réparer en priorité.
2. `region='eu'` → 0 candidat même sur une recette large (univers EU pas chargé dans
   le moteur DSL ?). Le fallback du skill /scanner (GetMarketOverview EU movers) reste
   obligatoire pour le quota diversification.
3. `RunAutoScreener` n'a pas de filtre mcap → renvoie des micro-caps RSI 88-90
   (value-traps per lessons) ; toujours filtrer en aval (règle [[screener-mcap-filter]]).

**Fixes écrits le 2026-07-02** (marketwatch-gateway, NON commités/déployés — revue user requise) :
1. RunBacktestExpr() pour les pass_expr custom (RunBacktest ne connaissait que les 4 stratégies
   core → 'strategy not found: custom_dsl' avalé en log.Warn) + backtest_error surfacé en metadata.
2. Univers EU : LoadEUStocksWithCache (staticdata c=EU + mapping suffixes Yahoo .PA/.DE/.SW) gated
   par ENABLE_EU_UNIVERSE=true + filtre région réellement câblé (champ Region était mort).
   Déploiement : deploy → env var → backfill bars EU → pruner les tickers 404.
3. min_market_cap exposé sur RunScreener ET RunAutoScreener (champ MinMarketCap était mort),
   floor appliqué avant scoring, défaut 0 (compat), reco 2e9 dans la description du tool.
Tests : go build/vet/test clean + test réseau live EU (4 tickers réels). 

**Décision user 2026-07-02** : fixer les 3 gaps À LA SOURCE dans marketwatch-gateway AVANT
toute expérience screener (momentum v2 etc.). Usages ensuite : candidate feed Phase 1 du
/scanner, momentum US v2 par sélection DSL (cf [[momentum-us-backtest]]), rétrospectives as_of.

**Décommissionnements même jour** : gen-plans.yml CI supprimé (le cron Convex évoqué dans
son commentaire n'existe plus depuis ~mai 2026 — plans générés localement par le pipeline) ;
externalisation portfolio → simulator.dailytickers.com abandonnée (pit-state.json = source
de vérité unique).
