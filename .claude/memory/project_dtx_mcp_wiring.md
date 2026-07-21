---
name: dtx-architecture
description: dtx = moteur systematic-tss via MCP hébergé SEUL (cut-over 2026-07-08, binaires+bundle SUPPRIMÉS). Câblage agent→MCP→ingest. v15 cost-honest = 6 stratégies LIVE. Schéma DtxDecide + edge Go durable.
metadata:
  type: project
---

# dtx — architecture (moteur systematic-tss)

## Invariant : le MCP hébergé fait foi (cut-over 2026-07-08)
Pour TOUTE opération backtest/décision/régime des stratégies systematic-tss, le **MCP hébergé
`systematic.dailytickers.com`** (namespace agent `mcp__claude_ai_systematic__*`) est le **SEUL moteur**.
**SUPPRIMÉS du repo (git rm)** : binaires `dtx-{darwin-arm64,linux-amd64,linux-arm64}`, bundle
`tools/bin/dtx-data/` (9.9M), `PROVENANCE.json`, `README.md`, wrapper `tools/lib/dtx-engine.js`, lignes LFS.
**Plus AUCUN fallback binaire** — plus de parité MCP↔binaire (le binaire n'existe plus ; la dérive replay
jour-à-jour du MCP = re-fetch adj-close plus frais = attendue, pas un bug).

`tools/dtx-scan.js` réécrit : ne spawn plus rien, porte le schéma partagé
(`buildStaging`/`extractReplayMetrics`/`writeStaging`/`mapOrder`/`goLiveFor`) + `stagingStatus()`/`--list` ;
un `--mode`/`--all` affiche la marche à suivre et sort en **0** (dégradation gracieuse, jamais bloquant,
jamais de fabrication, jamais de fallback binaire). `publish-daily-card.sh` Step 4d = garde de fraîcheur
seule (`stagingStatus` par mode → warn si staging absent/stale), ne régénère plus rien.

## Contrainte dure (immuable) — câblage agent→MCP→ingest
Un subprocess `node` NE PEUT PAS appeler le MCP (OAuth2 sur claude.ai, règle ZÉRO token en .env — cf
[[project-cloud-routine-automerge]]). Seul l'**AGENT** (`claude -p`, qui a les outils MCP enregistrés) l'appelle. Chaîne :
**agent → `DtxReplay`/`DtxDecide` (poll `DtxJobStatus` : pending→running→done, `result` isolé par job_id) →
écrit les JSON bruts → `node tools/dtx-mcp-ingest.js` → `data/dtx/<id>.json` (`engineMode:"mcp"`)**.
`dtx-mcp-ingest.js` écrit dans le schéma EXACT de `dtx-scan.js` (source unique du schéma, byte-compatible ;
provenance `engine="dtx (systematic-tss) — MCP"`). `PORTFOLIO_TO_MODE` splice le backtest (`--to`=`statusSince`)
sur la courbe live. Cloud vérifié : `mcp__claude_ai_systematic__*` est un connector niveau COMPTE claude.ai
(absent de `.mcp.json`), atteignable en `claude -p` headless (GetHealth OK — voir [[project-cloud-routine-automerge]]).

## GOTCHA schéma DtxDecide (trap silencieux)
`balances` DOIT être un OBJET `{base_currency, cash_by_currency:{CUR:montant}, total_equity}`. Un `{"USD":100000}`
plat parse en **`total_equity=0` → 0 buying power → 0 ordres SILENCIEUX** (le MCP normalise la forme plate par
commodité, mais préférer la forme objet). `positions`/`orders` = ARRAYS JSON `[]`. Output OrderRequest en
**snake_case** : `symbol, side, order_type, limit_price, stop_loss, take_profit, qty, reason, priority`.
`state` persisté → re-run du MÊME asof = incrémental (0 nouvel ordre) ; cold run = reproduit les ordres.
Gros univers (us_highvol 2403, stockbox 5189 titres) : lancer séquentiellement, l'OOM RAM serveur a été levé.

## v15 cost-honest (cut-over 2026-07-13) — 6 stratégies LIVE
Le moteur v15 (spread 10bp + stamp 50bp, participation 10%, TOTAL_RETURN, PIT membership NDX, frozen
2026-07-08) ne valide plus que **6 stratégies** (ids frais 1:1 mode==portfolio==staging file), métriques
re-mesurées via `DtxReplay` from 2021 :
- `book_honest` 57.7%/DD21.2/Sh1.41/R²0.93 (blend hv30/sbp30/etf20/ep15) — **LE CORE**
- `us_highvol` 81.3/28.6/1.77/0.93
- `hvep` 75.9/28.2/1.83/0.95 (hv70+ep30)
- `stockbox_pit` 40.0/21.8/1.37/0.86 (index-rotation PIT)
- `etf_us` 37.1/20.2/1.43/0.74
- `ep` 26.6/25.2/1.08/0.95

`data/modes-config.json` = 6 live + 19 stopped ; `DTX_STAGING_MAP` dans `gen-status-page.js` = identity sur
les 6 ; staging v15 committée dans `data/dtx/<id>.json` (whitelist `.gitignore` ; la cloud pipeline LIT la
staging committée). **Tous les anciens scriptings** (turbo, dynamic, balanced, secured, fortress, aplus,
hybrid, highvol, etf, etf_eu, forex, stockbox, tkl, alpha, factor, pead, filings, gap, eu_smallcap) passés
`status:stopped` (historique immuable conservé, `publiclyVisible:false`, cachés via `NON_PUBLIC_STATUSES`).
Books multi-sleeve (book_honest, hvep) : `extractReplayMetrics` lit `results[0]` → badges = vraies métriques
combined, courbe = blend rebasé 100k (biais DD ~2-4pt vs badge, normal en biweekly). QA `qa-check` ❌0
(SEALED-PRIMARY ✅ car ids frais = 0 sealed sweep). Tuées cost-honest (honnêtes mais sous barre) : uk (stamp
0.5%), forex (edge<spread), etf_eu, jp, crypto, momentum_explosion, parallel_book, optimal_honest.
Vérolées look-ahead retirées : tous les anciens "meilleurs candidats" (fonds_mohamed, arsenal_mindd,
survivor, idx_sp500_rotation…).

## Edge Go durable (finding réutilisable, systematic-tss)
Le SEUL signal stable (data-driven, univers gaté honnête US+DE) = **volume-surge + range-expansion**.
Trend/momentum/RSI/distMA = **bruit** (le signe s'inverse chaque année). highvol survit *parce qu'*elle
trade ce signal : gate $3M → **89% CAGR / DD 27.7% / Sharpe 1.86** (Pareto-strict, le champion). Gate établi
= regime-aware, valeurs par stratégie qui bougent (resync avant tout port). Cloner le scanner US sur un autre
marché ÉCHOUE (magnitude US-concentrée) → il faut une stratégie NATIVE (uk-selective : 50%/SR1.81). Outil de
détection d'edge tout-marché : `scripts/edge_discovery.py` (Go) + colonne DollarVolume PIT.

## Historique (folded, pour mémoire)
Migration décidée 2026-07-07 : abandon des scanners hand-portés JS → binaire dtx (vrai moteur systematic-tss,
commit 076c38ab puis 43d53455). Phases 1→2.6 : mode natif (dtx résout univers + fetch OHLCV lui-même),
câblage gen-status-page, découplage cloud (staging committé lu par le cloud), bundle vendorisé autoportant
(dépendance sibling systematic-tss cassée). Parité prouvée EXACTE vs `cmd/backtest` Go (universe_provider
partagé, 4 books champ-à-champ). Puis cut-over MCP 2026-07-08 → tout ce chemin binaire supprimé. Le
track-record scellé (`frozen_<mode>`, sweep.js, trade-chain.json) reste immuable (règle immutable-trades).
Lié : [[project-mcp-only-data-path]], [[project-cloud-routine-automerge]].
