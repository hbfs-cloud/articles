---
name: migration-local-to-mcp-rollout
description: 2026-07-11 — POC #1 (mode factor) migré local→MCP via pattern agent-staging --ingest (commit 8703c31ec), pattern prouvé. Rollout restant = GATED, la plupart des modes NE valent PAS/NE doivent PAS être migrés maintenant (dtx-backed = ROI nul, parité Go = risque, EU = bloqué).
metadata:
  type: project
---

# Migration scanners locaux → MCP : POC fait, rollout gated (décisions restantes)

Plan complet : `docs/specs/migration-local-to-mcp.md`. Direction : [[mcp-only-data-path]].

## Fait (POC #1)
- **Mode `factor`** migré local (tkl-universe.json + Yahoo) → **MCP via agent-staging** : agent appelle
  RunScreener US + QueryData bars → JSON stagé → `factor-scanner.js --ingest` construit `factor_pool`
  (pattern EXACT pead --ingest / staging dtx). Commit **8703c31ec**. Chemin local préservé (deprecated),
  fail-closed (staging manquant → exit 3, zéro fabrication), review adversariale a corrigé de vrais bugs
  (hystérésis buffer, rebalance-day, taille frozen). Choisi car : status=test, sim-only, AUCUNE parité Go,
  US couvert MCP. **Pattern prouvé et réutilisable.**

## ⚠️ CORRECTION 2026-07-12 : le MCP EST la référence (pas un A/B à gagner)
User : « le mcp est la ref, pq tu me parles de mcp vs local ? ». Le framing « KEEP_LOCAL car le local bat le
MCP » était FAUX. Le MCP marketdata (comme dtx) est la source de vérité par décret archi. On BASCULE tous les
scanners couverts par le MCP en MCP-PRIMARY + on PURGE la branche fetch local + les univers locaux. **Critère
= le flux MCP est valide/frais(<48h)/cohérent (barre MCP HARD STOP), PAS « bat le local ».** Nuance
nécessaire : ne purger le local QUE là où le MCP COUVRE la data. crypto (Binance) / casablanca (BVC) ne sont
PAS couverts par le MCP → restent fetch-direct public légitime (pas du legacy local à virer).

## ✅ FAIT 2026-07-12 : 10 scanners basculés MCP-primary + pipeline câblé (e2e prouvé)
10 scanners (momentum/etf/trendline/factor/highvol/forex/stockbox/hybrid/metals/candlestick) basculés
MCP-primary : retrait fetch Yahoo/univers local, le chemin `--ingest` (staging produit par l'AGENT via MCP)
devient le SEUL chemin. Commits `0be160794`→`20419cdac` (flips) + `aa92811d7` (câblage pipeline).

⚠️ **LEÇON DURE (gotcha à retenir)** : un flip MCP-primary N'EST PAS COMPLET tant que le PIPELINE n'est pas
câblé. Le flip initial a retiré le fetch local des 10 scanners MAIS `publish-daily-card.sh` les appelait
encore SANS `--ingest` → ils refusaient de tourner → **0 signal en run auto = régression de prod silencieuse**
(masquée par `|| non-blocking`). Cause : un subprocess `node` NE PEUT PAS appeler le MCP. **Un flip
MCP-primary DOIT livrer, dans le MÊME lot** : (1) retrait fetch local du scanner, (2) `publish-daily-card.sh`
staging-check + `--ingest` (pattern candlestick : `if [ -f "$X_STAGE" ]; then --ingest; else skip gracieux`),
(3) skill `/scanner` Phase 1 = l'AGENT produit `/tmp/<name>-stage.json` via MCP AVANT le shell, (4) vérif
e2e (staging MCP → --ingest → signaux > 0). Réparé `aa92811d7`, e2e prouvé (momentum 2 / etf 5 / factor 5).

## Purge univers = ENCORE BLOQUÉE (consommateurs restants)
`fractal-scanner.js` + `gap-scanner.js` (non flippés, general-purpose) lisent encore TOUS les
`data/*-universe.json` → aucun univers n'est orphelin, donc RIEN purgé (correct). Pour purger : migrer aussi
fractal/gap (ou les faire lire un univers MCP), puis supprimer les univers sans consommateur.

## Rollout (mode par mode, gated sur validité MCP)
- **momentum / etf / trendline / factor** : --ingest MCP déjà construit → flip en sole path + retrait branche
  Yahoo/univers local. equity US couvert par le MCP.
- **highvol / forex / stockbox (dtx-backed)** : equity/ordres déjà via dtx MCP ; le JS-scanner data → MCP.
- **etf_eu + eu_smallcap** : MCP EU RÉSOLU (backfill v111, [[mcp-eu-coverage-gap]]) → migrables aussi.
- **crypto / casablanca / (metals?)** : MCP ne couvre pas → fetch-direct public conservé (à confirmer par
  scanner). Si le MCP renvoie stale/incohérent sur un mode couvert → HARD STOP + ticket owner, PAS de retour
  local en douce.

## Retrait legacy (gated, pas encore)
tkl-universe.json = candidat retrait #1 APRÈS que tous ses consommateurs soient migrés. americanbull-universe
partagé par 5 scanners → retrait seulement après les 5. **Aucune suppression avant migration validée.**
Ne PAS mass-delete.
