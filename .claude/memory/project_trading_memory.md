---
name: trading-memory
description: "Mémoire trading structurée (2026-07-02) : scanner-lessons.json = policy memory (class/status/confidence/evidence/half-life), lessons-engine (decay/promote/contradictions), lessons-retrieve (retrieval capé 3/3/3), _memoryImpact obligatoire, MAE/MFE/J+1-5-20 dans sweep."
metadata:
  type: project
---

# Mémoire trading structurée (livrée 2026-07-02)

Implémente le blueprint "LLM trading memory" adapté : PAS de DB parallèle — extension
de l'existant. Chaîne complète :

- **RAW** : backtest-trades.json enrichi par sweep — `mae_pct`, `mfe_pct`,
  `outcomes{d1,d5,d20}` (qualité du SIGNAL, jours de bourse par calendrier), `r_multiple`.
  Append-only ; backfill des anciens trades = `sweep --backfill-excursions` OPT-IN
  (n'écrit que les 4 clés hors du hash SHA).
- **POLICY** : data/scanner-lessons.json — 41 règles au schéma canonique :
  `class` (market_truth = decay ; **process_rule = invariant, jamais décayé**), status,
  scope, effect, evidence{sample_size,wins,losses,expectancy,tickers,clusters}, confidence,
  half_life_days, expires_at, invalidation_conditions. id/severity/rule verbatim
  (compat validate-scan).
- **MOTEUR** : tools/lessons-engine.js — `--decay` (quotidien via publish-daily-card
  Step 7b, idempotent, auto-dépréciation < 0.30), `--validate` (outcome + evidence patch),
  `--promote` (gates : n≥12, ≥3 tickers, ≥2 clusters, multi-régime, expectancy mesurée),
  `--contradictions` (pénalité symétrique + open_question, jamais de résolution auto).
  53 tests (tools/lessons-engine.test.js).
- **RETRIEVAL** : tools/lessons-retrieve.js — cap 3 règles actives / 3 risques / 3 épisodes,
  confidence ≥ 0.4, scope régime/setup/mode. Consommé par /scanner Phase 0.8.
- **AUDIT** : bloc `_memoryImpact` obligatoire dans signals.json.
- **VALIDATION** : la retro hebdo DOIT sortir decay → contradictions → validate par règle
  testée → report → candidates à promote. **Aucune promotion narrative.**

**Principe absolu** : la mémoire n'inverse jamais un signal quantitatif — elle ajuste
confiance/sizing ou alerte. Les hard_blocks restent enforced par code (validate-scan).
Lié : [[frozen-stats-append-only-advance]], [[modes-config-baseline]], [[screener-reliability-20260702]].
