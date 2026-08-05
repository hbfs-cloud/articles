---
name: project-dette-technique-analyses
description: "Défauts de gabarit corrigés dans render-analysis.js mais NON propagés au parc, et pourquoi le re-rendu global casse"
metadata:
  node_type: memory
  type: project
---

# Dette technique du parc d'analyses (5 août 2026)

Sept défauts de gabarit ont été corrigés **dans `tools/render-analysis.js`**, mais une page ne les
reçoit qu'au moment où elle est re-rendue. Le parc reste donc majoritairement non migré.

## État mesuré au 5 août 2026 (sur `analyses/*/index.html`)

| Défaut | Fichiers touchés | Corrigé dans le moteur |
|---|---|---|
| Modal historique sans bouton d'ouverture | **60** | oui |
| `<i class="fa-solid fa-solid">` (icône vide) | **27** | oui |
| Tuile `<div class="tm-value">N/A</div>` | **39** | oui |
| `style="width:<prose>%"` (jauge cassée) | 1 | oui |
| Classe CSS `.badge-gray` inexistante | — | oui (classe ajoutée à report.css) |
| Liens d'archive au mauvais format de date | — | oui |
| Conteneur ECharts radar orphelin | — | oui |

## Pourquoi `publish-analysis.js --re-render` ne suffit pas

Testé le 5 août : sur 256 fiches, **3 rendues puis plantage**. Deux classes d'erreur :

- `TypeError: Cannot read properties of undefined (reading 'toFixed')`
- `TypeError: Cannot read properties of undefined (reading 'ticker')`

Des fiches anciennes ont des champs absents que le moteur suppose présents. La validation les signale
(`.header.metrics.beta must be number, got string`) sans empêcher le rendu, puis le rendu casse plus loin.

**Une migration globale exige d'abord de durcir le moteur** contre les champs manquants — sinon elle
s'arrête à la première fiche mal formée et laisse le parc à moitié migré. Une tentative partielle a été
annulée le 5 août pour cette raison (3 fichiers modifiés + 5 dossiers d'archive parasites, tous revenus).

## Marche à suivre quand ce sera repris

1. Durcir `render-analysis.js` : accès défensif sur tout champ optionnel des fiches anciennes.
2. Lancer `--re-render` et compter les échecs restants.
3. Corriger les fiches qui échouent encore, une par une, sur données réelles.
4. Re-mesurer le tableau ci-dessus, viser zéro.

En attendant, chaque analyse republiée individuellement récupère les sept correctifs automatiquement.
