---
name: project-mode-success-criteria
description: "Objectif de perf des modes scanner — ≥3× SPY chaque semaine, max DD ≤ 8%, benchmark SPY"
metadata: 
  node_type: memory
  type: project
  originSessionId: 1cc653cd-e658-47d7-96ef-f273b4affc3e
---

**Critère de succès officiel des modes scanner/status** (donné par l'utilisateur 2026-06-14) :

- **Benchmark = SPY.** Toujours comparer la performance d'un mode au SPY.
- **Cible : ≥ 3× la perf SPY chaque semaine.** Le mode doit faire au moins 3 fois mieux que le SPY, chaque semaine (pas seulement en cumulé).
- **Contrainte : max drawdown ≤ 8%.**

C'est la fonction-objectif pour toute optimisation/recalibration de mode. Un mode qui ne bat pas 3× SPY hebdo ou dépasse 8% de DD est à corriger.

**Méthodo d'évaluation** (cf [[feedback-regime-aware-eval]]) : optimiser sur le **tronçon où le mode a sous-performé** (pas tout l'historique). Ex: balanced est mauvais depuis ~20 avril 2026 (a fait +52% fév→20 avril puis plat/négatif ensuite) — donc optimiser balanced sur 20 avril → présent, contre SPY sur la même fenêtre. Outils: `tools/optimize-mode.js --from`, `tools/regime-strategy-breakdown.js`, `tools/project-config-impact.js` (tous read-only, réutilisent les primitives sweep.js exportées).

Ne jamais appliquer un changement de config sans : (1) projeter l'impact chiffré sur les trades réels du tronçon, (2) le présenter à l'utilisateur, (3) le laisser choisir. Versionner (modes-config-history.json), append-only, ne pas push git avant validation.
