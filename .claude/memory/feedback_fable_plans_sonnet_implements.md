---
name: fable-plans-sonnet-implements
description: Modèle de travail permanent — Fable planifie/spécifie, Sonnet/Opus implémentent selon complexité, toujours dans des workflow dynamic.
metadata:
  type: feedback
---

Directive permanente du user (2026-07-03), s'applique à TOUTE la suite du travail :

- **Fable** (modèle rapide) = **planifie et spécifie**. Écrit les specs précises, découpe le
  travail, cadre les gotchas et les étapes de vérification. N'implémente pas les gros chantiers
  directement.
- **Sonnet / Opus** = **implémentent**, choisis **selon la complexité** de la tâche (Sonnet par
  défaut ; Opus pour le plus complexe/risqué).
- **Toujours dans des workflow dynamic** : la mise en œuvre passe par le Workflow tool (agents
  avec `model:'sonnet'` ou `'opus'`), pas d'implémentation ad-hoc hors workflow.

**Why** : séparer le raisonnement/planification (rapide, Fable) de l'exécution (agents capables,
parallélisables, isolés) ; garder Fable comme chef d'orchestre. Le user veut ce découpage
systématique, pas au cas par cas.

**How to apply** : à chaque nouvelle tâche non-triviale → (1) Fable produit la spec + critères de
vérif, (2) lancer un Workflow dynamic dont les agent() portent `model:'sonnet'` (ou `'opus'` si
complexe) pour implémenter, (3) Fable revoit le résultat (vérifie les claims des agents — cf
[[scripted-modes-scorecard]], Sonnet a produit 3 claims fausses ce jour), régen/QA, commit.
Exception : correctifs triviaux et clôture d'une tâche déjà implémentée peuvent rester en direct.

Lié : [[scripted-modes-scorecard]], [[go-edge-and-deployment]].
