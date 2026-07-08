---
name: reference-dtx-mcp
description: Serveur MCP dtx (systematic.dailytickers.com) = voie CANONIQUE pour backtest/décision/régime systematic-tss ; binaire local = fallback offline only
metadata:
  type: reference
---

# dtx MCP — moteur systematic-tss hébergé

Depuis 2026-07-08, **toute opération backtest / décision / régime** sur les stratégies systematic-tss
passe **EXCLUSIVEMENT** par le serveur MCP « dtx » : `https://systematic.dailytickers.com` (OAuth2, branché
sur claude.ai). **Ne PLUS appeler** le binaire dtx local ni les fichiers `tools/bin/dtx-data/`/`PROVENANCE`
vendorés — ils restent **fallback offline uniquement** si le MCP est injoignable. Résout le résidu de
[[project_dtx_engine_migration]] (cache OHLCV froid → replays non-déterministes) : le serveur a un **cache
chaud persistant** (prefetch auto au boot + chaque soir) → replays déterministes, plus de rate-limit Yahoo.

## Outils
- `DtxListConfigs()` → 13 stratégies `{id, strategy, currency}`. Toujours passer l'`id` retourné (ex:
  `us_highvol`, `crypto`, `etf_us`).
- `DtxReplay(portfolio, from?, to?)` → `{results:[{cagr_pct, max_dd_pct, sharpe, r2, win_rate,
  total_trades, equity_dates[], equity_values[]}]}`.
- `DtxDecide(portfolio, asof, balances, positions?=[], orders?=[], state?)` → `{state,
  actions:{CREATE,UPDATE,CANCEL}}`. **GOTCHA** : `balances` = OBJET `{base_currency,
  cash_by_currency:{CUR:montant}, total_equity}` (un `{"USD":100000}` plat est normalisé mais préférer
  l'objet) ; **persister `state`** et le repasser au run suivant.
- `DtxRegime(asof)` → `{regime, regime_score, ...}`.

## Infra serveur
Cache OHLCV chaud (déterministe), gestion RAM (date-clamp), 13 stratégies (crypto=Binance, actions/ETF=Yahoo).

## Consumer repo articles
`tools/lib/dtx-engine.js` a un **patch de transport MCP prêt** → au go du user, basculer `dtx-scan.js` sur
le MCP (fallback binaire vendoré si injoignable). Voir CLAUDE.md § « dtx MCP ».
