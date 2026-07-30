---
name: scanner-filter-before-enrich-order
description: Le filtre résultats doit tourner sur le vivier COMPLET en Vague 1, avant tout enrichissement par ticker — doctrine perf existante mais non appliquée, désormais forcée par le gate G4 pipeline_order
metadata:
  type: feedback
---

**La doctrine perf existait déjà et n'a pas été appliquée.** `.claude/skills/perf-parallel-mcp.md`
(23/07/2026, marqué `OBLIGATOIRE`, auto-load pour scanner) place nommément
`GetEarningsCalendarFiltered` en **Vague 1**, avec les screeners, et interdit d'alterner
« un fetch, un calcul, un fetch ».

**Incident 20260730** — le filtre résultats a tourné en **Vague 3** :
- F et PFE ont été sélectionnés, puis enrichis intégralement (dilution, flux, initiés, techniques),
  **puis** disqualifiés sur la fenêtre de résultats. F avait publié le 28/07, PFE publiait le 04/08.
- Rework en cascade : re-sélection, puis 5 candidats de remplacement tués par le garde-fou de
  structure, puis re-calcul des 7 lignes après échec du gate `entry_strategy_coherence`.
- Coût : ~15 min de reprise pure sur un run de 78 min. Le reproche utilisateur — « ça fait des mois
  que je te demande d'optimiser /scanner » — était fondé : la règle est écrite, obligatoire,
  chargée automatiquement, et rien ne l'empêchait d'être ignorée.

**Leçon structurante : un document de plus ne corrige pas un ordre d'exécution.** Le correctif doit
être mécanique.

**Gate G4 `pipeline_order`** (`tools/validate-scan.js`, config `scanner-filters.json#audit_gates.pipeline_order`,
`active_from: 2026-07-31`) — `signals.json` doit porter :
```json
"_pipelineOrder": {
  "earnings_screened_at": "…Z",     // strictement AVANT enrichment_started_at
  "enrichment_started_at": "…Z",
  "candidates_screened": 39,        // vivier complet, ≥ 2× les lignes publiées
  "method": "8-K item 2.02 sur le vivier complet, avant toute salve enrichissement"
}
```
plus `earnings_source: "8k_item_202"` sur chaque ligne publiée. Publication refusée sinon.

Testé dans les quatre sens avant commit : scan antérieur grandfathered → passe ; gate armé sans bloc
→ échoue ; bloc conforme → **passe** (satisfiable) ; ordre inversé → échoue en nommant les deux
horodatages.

**Ordre correct pour tout run /scanner :**
1. **Vague 1** (aucune dépendance, UN seul message) : screeners, régime, `GetStatus`,
   `GetEarningsCalendarFiltered`, `economic_events`, et le screen 8-K item 2.02 sur le vivier brut.
2. Élaguer : résultats ±3 séances, positions ouvertes, sous-MM200, dilution — **avant** de dépenser
   le moindre appel d'enrichissement.
3. **Vague 2/3** : barres, techniques, flux, initiés — uniquement sur les survivants.

Related: [[earnings-date-ground-truth-is-8k-item-202]], [[marketdata-path-and-coverage-traps]],
[[no-skip-pipeline-steps]].
