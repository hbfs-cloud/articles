# Rétro hebdomadaire locale du 19 septembre 2026

Période : scans du 14 au 18 septembre ; observations jusqu'à la clôture US du 18.
Quatre scans archivés, 35 propositions primaires, 28 symboles. Aucun horizon mûr.

## Reproduction locale sans nouvelle collecte

Depuis la racine du dépôt :

```sh
node tools/build-period-retro.js 20260914 20260918 20260918 --levels-only --run-date 20260919 --cohort scanner/retrospective/20260919/cohort-manifest.json
python3 scanner/retrospective/20260919/_audit/build-review.py
node tools/qa-retro.js scanner/retrospective/20260919
node tools/qa-content.js scanner/retrospective/20260919/index.html --strict
node tools/check-ai-tells.js scanner/retrospective/20260919/index.html --strict
```

Ne pas relancer le renderer générique après le renderer daté : il contient des paragraphes
historiques propres à la cohorte du 12 septembre (56 propositions, GLEN.L, réparation 5m),
inapplicables ici. L'outil daté garde le gabarit visuel, rédige la cohorte courante et retire ces
affirmations. Aucun outil partagé n'a été modifié dans cette tâche.

## Validation et limites

- Workflow retro, fraîcheur et run-plan : PASS sur la collecte principale et le contrôle 5m.
- QA rétro, contenu strict, anti-tics strict : PASS. Contrôle visuel Chrome effectué.
- `qa-check.js <dossier> --strict` refuse un chemin : ce contrôle cible le dernier scan global,
  pas cette rétro. Il n'a pas été contourné ; le gate dédié est `qa-retro.js`.
- Sources JSON/HTML des quatre scans : huit empreintes contrôlées, intactes.
- Corpus courant SEC/événements facultatif partiellement refusé : conservé sans conclusions.
- Pas de performance certifiée : tous les horizons sont immatures, règles LIMIT/invalidation
  non rejouées, divergence de décompte d'horizon, état de mise en ligne non attesté.
- Écarts d'enveloppe daily/intraday pour quatre séries le 18, retrouvés au contrôle 5m.
- Le zéro moyen du moteur sur population vide est explicitement inutilisable ; statistiques
  finales nulles dans diagnostics.json et N/D dans la page.

## Automation flywheel

Collecte, conversion intraday, moteur et QA existants réutilisés. Le renderer ci-joint est
strictement daté, sans abstraction nouvelle. Candidats de travail séparé : rendre le renderer
générique indépendant de l'ancienne cohorte ; tester un replay du contrat LIMIT de séance et des
invalidations ; refuser un rendement moyen zéro lorsque la population mûre est vide. Ne pas
changer le moteur financier ou les réglages de stratégie à l'occasion de cette seule rétro.

Aucune publication, notification, modification broker, indexation, commit ou push.
