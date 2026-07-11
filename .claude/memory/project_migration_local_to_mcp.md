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

## Rollout restant = décision, PAS churn autonome
D'après la recon honnête (13 scanners), la plupart des migrations restantes NE valent pas un basculement
autonome — chacune a un vrai tradeoff :
- **momentum US** : candidat "sûr" suivant MAIS central (alimente le composite top-10) → A/B plus lourd que
  factor, pas un POC trivial. À faire avec backtest A/B soigné si on veut avancer.
- **highvol / forex / etf / stockbox (dtx-backed)** : leur equity/ordres sont DÉJÀ autoritatifs via le MCP
  **dtx**. Migrer leur data locale ne déplace que le marker JS-port AFFICHÉ, pas les chiffres du mode →
  **ROI quasi nul, pas prioritaire.**
- **etf / etf_eu / trendline / casablanca** : drift de parité Go déjà flaggé par qa-check → **risque de
  régression**, à traiter EN DERNIER avec A/B strict par régime. casablanca en plus non couvert MCP.
- **etf_eu + momentum eu** : **BLOQUÉS** tant que le MCP EU n'est pas backfillé ([[mcp-eu-coverage-gap]]).
- **crypto / casablanca** : restent fetch-direct (Binance/BVC publics) — HORS migration, comme gap voie A.

## Retrait legacy (gated, pas encore)
tkl-universe.json = candidat retrait #1 APRÈS que tous ses consommateurs soient migrés. americanbull-universe
partagé par 5 scanners → retrait seulement après les 5. **Aucune suppression avant migration validée.**
Ne PAS mass-delete.
