# Cinq révisions — livraison du 20 septembre 2026

KLAC, AAOI, AMD, AG et ALLR disposent de nouvelles révisions françaises locales au close du 18 septembre, rendues et revues. **Aucune des cinq n’est publiée sur le site.** Les fichiers canoniques restent inchangés. Les révisions et leurs preuves sont sauvegardées sur main; `_runs` est exclu de l’export Pages.

| Dossier | Preuves numériques | Pré-revue éditoriale | Publication |
| --- | --- | --- | --- |
| KLAC | PASS — 282 claims | PASS | BLOCK — RankBeta |
| AAOI | PASS — 274 claims | PASS | BLOCK — RankBeta, CIEN |
| AMD | PASS — 267 claims | PASS | BLOCK — RankBeta, HPE |
| AG | PASS — 282 claims | PASS | BLOCK — RankBeta |
| ALLR | PASS — 270 claims | 1 erreur : amont coté absent | BLOCK — RankBeta, analystes, VWAP, options, amont |

QA HTML et anti-tics PASS pour les cinq; suite complète `bash tools/test-content-workflows.sh` PASS. `validation.json` contient les empreintes et sorties; `native-source-probe.json` conserve l’appel natif RankBeta correct et son HTTP 403 fournisseur.

Les revues indépendantes Senior/Contrarian/Retail sont dans `klac-aaoi-review.md`, `amd-review.md`, `ag-review.md`, `allr-review.md`. Ce sont des revues locales, **pas des attestations AQ finales**. Les éventuels addenda distinguent une mise à jour du générateur hashé d’une modification du texte revu.

## Changements matériels

- AAOI : financement ATM et warrants client conditionnels, métriques sans confusion de période, comparables économiques, risques de gap et ancien contrat inactif.
- AMD : quatre vrais documents SEC, warrants partenaires conditionnels, dette distincte d’actions, multiples reproductibles et revue contrarian sur exécution industrielle/logicielle.
- AG : quatre vrais documents SEC hachés, scénario mécanique fondé sur EBITDA/cash/dette/actions, suppression de probabilités inventées, calendrier/provenance corrigés.
- ALLR : trésorerie libre distincte du cash restreint, ligne Tumim distincte de cash, IPO du SPAC proposée et conditionnelle, brevet distinct d’autorisation, aucune efficacité clinique ou dilution pleinement réconciliée prétendue. Pfizer reste un concurrent et Eisai un concédant; aucun fournisseur coté inventé.
- Contrôle éditorial : autorise un complément SEC à une véritable source de marché; traite explicitement les anciens niveaux inactifs et conserve les contrôles de géométrie; lit le champ de comparaison réellement rendu. Tests de non-régression inclus.

## Reprise nécessaire

Rétablir RankBeta US, recollecter les calendriers CIEN/HPE et les facets ALLR manquantes via le collecteur gouverné; résoudre le cas amont absent sans relation inventée. Refaire les sources fraîches, le run-plan complet et les attestations AQ indépendantes sur les empreintes finales, puis passer par `publish-analysis.js`. Ne pas recopier directement ces drafts sur les pages canoniques.

La règle du skill analyse impose « Execute the runbook exactly […] the analysis quality gate and same-snapshot reviews ». Les résultats locaux ne permettent pas de contourner les sources obligatoires.
