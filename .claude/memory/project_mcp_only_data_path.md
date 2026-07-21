---
name: mcp-only-data-path
description: Décision archi 2026-07-11 — la donnée marché passe par le MCP marketdata, PAS les scripts/univers locaux. node subprocess ne peut pas appeler le MCP → mode data-MCP = ÉTAPE AGENT (agent→MCP→staging→node --ingest). EU couverture RÉSOLUE côté MCP ; eu_smallcap reste DRAFT (stratégie non viable, pas la data).
metadata:
  type: project
---

# Data path = MCP marketdata (décidé 2026-07-11)

## Invariant
La donnée marché (univers, prix, fondamentaux, screening EU/US) passe par **`mcp__marketdata__*`**
(RunScreener/QueryData/GetInstruments/GetMarketContext/RunBacktest), PAS par les fetchers/univers LOCAUX
(`tools/lib/stockanalysis-fetcher.js`, `data/*-universe.json`, Yahoo direct). **Le MCP EST la référence
par décret archi** (comme dtx) — ce n'est PAS un A/B à gagner contre le local. Critère de bascule = le flux
MCP est valide/frais(<48h)/cohérent (barre MCP HARD STOP), PAS « bat le local ». Si le MCP renvoie
stale/incohérent sur un mode couvert → HARD STOP + ticket owner, JAMAIS de retour local en douce, zéro fabrication.

**Exception** : crypto (Binance) / casablanca (BVC) NE sont PAS couverts par le MCP → restent fetch-direct
public légitime (pas du legacy local à virer). metals à confirmer.

## Contrainte dure — mode data-MCP = ÉTAPE AGENT
Un subprocess `node` NE PEUT PAS appeler le MCP (OAuth2, zéro token). Tout scanner/mode qui a besoin de
données MCP doit être une **ÉTAPE AGENT** (agent /scanner ou sous-agent — PAS un `node` dans
publish-daily-card.sh) : l'agent appelle le MCP → écrit un pool/staging → le node downstream (`--ingest`,
sweep, gen-status) lit le pool committé. C'est le pattern du top-10 (agent MCP) et du staging dtx (agent
MCP→ingest, cf [[dtx-architecture]]).

## ⚠️ GOTCHA flip (leçon dure 2026-07-12)
Un flip MCP-primary N'EST PAS COMPLET tant que le PIPELINE n'est pas câblé. Le premier flip a retiré le
fetch local de 10 scanners MAIS `publish-daily-card.sh` les appelait encore SANS `--ingest` → ils refusaient
de tourner → **0 signal en run auto = régression de prod SILENCIEUSE** (masquée par `|| non-blocking`). Un
flip MCP-primary DOIT livrer, dans le MÊME lot : (1) retrait fetch local du scanner, (2) pipeline
staging-check + `--ingest` (pattern candlestick : `if [ -f "$X_STAGE" ]; then --ingest; else skip gracieux`),
(3) skill `/scanner` Phase 1 = l'AGENT produit `/tmp/<name>-stage.json` via MCP AVANT le shell, (4) vérif
e2e (staging MCP → --ingest → signaux > 0). Réparé `aa92811d7`.

## État de la migration local→MCP
- **POC #1 (mode `factor`)** migré via agent-staging `--ingest` (commit 8703c31ec), pattern prouvé et
  réutilisable. Chemin local préservé deprecated, fail-closed (staging manquant → exit 3, zéro fabrication).
- **10 scanners basculés MCP-primary** (momentum/etf/trendline/factor/highvol/forex/stockbox/hybrid/metals/
  candlestick), commits `0be160794`→`20419cdac` + câblage `aa92811d7`. e2e prouvé (momentum 2 / etf 5 / factor 5).
- **Purge univers ENCORE BLOQUÉE** : `fractal-scanner.js` + `gap-scanner.js` (non flippés) lisent encore TOUS
  les `data/*-universe.json` → aucun univers orphelin, rien purgé (correct). `tkl-universe.json` /
  `americanbull-universe` = retrait seulement APRÈS migration de TOUS leurs consommateurs. Ne PAS mass-delete.
- Migration mode par mode, GATED. Beaucoup de modes ne valent pas la migration maintenant (dtx-backed = ROI nul,
  parité Go = risque). Plan : `docs/specs/migration-local-to-mcp.md`.

## Couverture EU — RÉSOLUE côté MCP (v111, 2026-07-12), stratégie non viable
Le blocage EU n'est **PLUS côté MCP** — l'owner a livré le backfill complet (v111), les 4 points vérifiés
live : (#1) backtest deep (`RunBacktest(AIR.PA, from=2022-06-01)` → 52 trades 2023-2026, PF 1.30) ; (#2)
`country` dans les rows du screener EU (démasque les cross-listings non-PEA en une passe) ; (#3) `market_cap`
réel dans les rows (`market_cap>1e9` filtre l'EU correctement) ; (#4) `GetReferentialData` EU. OHLCV EU =
395 barres via QueryData, énumération `RunScreener(region='EU')` = 20+ candidats (gate 200-barres passe).
**⇒ l'infra/data EU marche.**

MAIS re-validation deep de `eu_smallcap` (backfill v111, 2022-2026, total-return ajusté, 13 noms PEA, review
adversariale) : **CAGR +12.0%, maxDD -27.4%, Sharpe 0.35, PF 1.44, WR 53%, 83 trades**. NE BAT PAS la
baseline en risk-adjusted/walk-forward (sous SPY +12.2%/-24.5% DD, perd 3/4 ans ; échoue DD ≤8% et "battre
SPY ≥3×"). Breadth insuffisante (4/13 ≥80). → **KEEP_DRAFT** (commit 4595998a9), minScore 80 maintenu
(anti-pattern 80→72 pour forcer des signaux NON répété), mode MASQUÉ. **C'est la STRATÉGIE momentum EU
small-cap qui n'est pas viable, PAS la data.** Pour activer : trouver une meilleure stratégie EU (pas juste
momentum, plus d'historique), PAS rouvrir un ticket MCP. Spec : `docs/specs/eu-smallcap-pea-scanner.md`.
Mémoire MCP : `decision/eu-smallcap-deep-revalidation-keep-draft`.

Voir [[dtx-architecture]] et [[project-cloud-routine-automerge]].
