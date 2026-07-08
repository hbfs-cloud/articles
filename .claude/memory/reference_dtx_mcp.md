---
name: reference-dtx-mcp
description: Serveur MCP dtx (systematic.dailytickers.com) = SEUL moteur backtest/décision/régime systematic-tss ("le MCP fait foi") ; binaire local + bundle SUPPRIMÉS le 2026-07-08
metadata:
  type: reference
---

# dtx MCP — moteur systematic-tss hébergé (SEUL MOTEUR)

Depuis le **cut-over 2026-07-08**, **toute opération backtest / décision / régime** sur les stratégies
systematic-tss passe **EXCLUSIVEMENT** par le serveur MCP « dtx » : `https://systematic.dailytickers.com`
(OAuth2, connector claude.ai). **"Le MCP fait foi."** Le binaire dtx local (`tools/bin/dtx-darwin-arm64`,
`dtx-linux-amd64`, stray `dtx-linux-arm64`) + le bundle `tools/bin/dtx-data/` + `PROVENANCE.json` +
`README.md` + `tools/lib/dtx-engine.js` + les lignes LFS de `.gitattributes` ont été **SUPPRIMÉS du repo**.
Il n'y a **PLUS aucun fallback binaire**. Le serveur a un **cache chaud persistant** (prefetch auto au
boot + chaque soir) → replays quasi-déterministes (dérive légère jour-à-jour = re-fetch adj-close plus
frais, attendu), plus de rate-limit Yahoo, et un garde-fou RAM (date-clamp) qui a levé l'OOM des gros
univers (`us_highvol` 2403 titres, `stockbox_nasdaq` 5189 titres).

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

**Chaîne async** : `DtxDecide`/`DtxReplay` renvoient `{status:"async_pending", job_id}` → poller
`DtxJobStatus(job_id)` jusqu'à `status:"done"` → `result` (isolé par job_id). Cache chaud → souvent inline.

## Infra serveur
Cache OHLCV chaud, gestion RAM (date-clamp), 13 stratégies (crypto=Binance, actions/ETF=Yahoo).
GetHealth (2026-07-08) : `{ok, binary_ok, data_dir_ok, config_count:13, cache_writable, provenance:{commit
9a680ed4, dtx-linux-arm64 sha256 7e8c28da…, go1.26.0}}`.

## Consumer repo articles (câblage MCP-only)
Un subprocess `node` NE PEUT PAS appeler le MCP (OAuth2, ZÉRO token). Seul l'**AGENT** (Claude Code /
`claude -p`) détient `mcp__claude_ai_systematic__*`. Donc le staging `data/dtx/<id>.json` des 5 modes
scriptés (`us_highvol`, `forex`, `etf_us`, `etf_eu`, `stockbox_nasdaq`) est produit par l'agent AVANT le
pipeline shell : **agent → DtxReplay/DtxDecide (poll DtxJobStatus) → JSON bruts →
`node tools/dtx-mcp-ingest.js` → staging `engineMode:"mcp"`**. `tools/dtx-scan.js` ne spawn plus de
binaire (porte seulement le schéma partagé `buildStaging`/`extractReplayMetrics`/… + `stagingStatus()` +
`--list` ; `--mode` = guidance + exit 0 gracieux). `publish-daily-card.sh` Step 4d = garde de fraîcheur
(warn si staging manquant/stale), ne régénère plus rien. Voir CLAUDE.md § « dtx MCP » + skill
`scanner-pipeline` §"dtx refresh — MCP SEUL MOTEUR".

## Cloud routine (bot Discord) — vérifiée 2026-07-08
La routine nuit 23h (schedules.json #1) lance `claude --dangerously-skip-permissions --model opus -p -`
sur la même machine (launchd) que la session locale, **même compte claude.ai**. Le connector
`mcp__claude_ai_systematic__*` est un **connector de niveau COMPTE** (pas dans `.mcp.json` ni
`~/.claude.json`) → disponible en headless. **Prouvé** : un `claude -p` headless a appelé `GetHealth` et
reçu un résultat live. Le prompt du schedule #1 a été renforcé pour appeler explicitement la chaîne dtx MCP
+ ingest avant le shell.
