# KLAC — revue Contrarian/Retail de clôture, révision corrigée

**Périmètre gelé.** Cette note audite uniquement les artefacts rendus du run `20260919-update`, sans modifier l’article ni ses sources. Elle remplace les constats résolus de la revue précédente pour ces empreintes précises :

| Artefact | SHA-256 | Contrôle |
| --- | --- | --- |
| `revision/KLAC.json` | `91aea77c367daeeadfbbc055e92788c37a8004e69f694b9e7fc12a2111769389` | JSON valide |
| `revision/index.html` | `237b907458f6c6a8dad097d77b4a8d07bd103400d55914658d10b57c55a6d061` | rendu lu |
| `revision/evidence.json` | `f91ff0e55778c06c3b5e14986e2ba8998602326e0281b22603866789fa1a9c84` | JSON valide |
| `revision/numeric-evidence.json` | `e7241c672ce5baf3a8470b4b3840e1ef5af13850e0e9b83a379293bfee81a08b` | JSON valide |

## Décision

**BLOCK pour la validation finale du run.** Ce n’est pas un échec des corrections éditoriales ci-dessous : elles sont vérifiées. La collecte garde toutefois un appel obligatoire `RankBeta` avec `required: true`, `ok: false` et l’erreur `upstream HTTP status 403` dans `data/_collect.json` (call `rank_beta`, lignes 525–533). Une recherche de comparables élargie ne peut donc pas être certifiée et aucun PASS global, ni attestation de publication, n’est justifié.

## Corrections vérifiées

| Ancien risque Contrarian/Retail | État sur les empreintes gelées | Preuve précise |
| --- | --- | --- |
| Anciens niveaux interprétables comme un plan en cours | **Résolu** | Le verdict et la section trade disent « AUCUN ORDRE ACTIF ». Les quatre niveaux sont dans un `<details>` fermé, intitulé « Voir les anciens niveaux — non exécutables », avec table neutre et sans R/R. `tradeIdea.status` vaut `no-trade`; `archiveReferenceClose` vaut `2026-08-27`. |
| Stress de valorisation mal qualifié | **Résolu** | La note distingue une baisse de multiple effective de **34,9 %** (38,40x vers 25x) d’un prix conditionnel de 114,90 $ et d’une variation de **-35,08 %**. Le sidecar donne 38,3987x, 25x et -35,0822 %; il précise que ce n’est ni prévision ni cible. |
| Dilution décrite avec une certitude non disponible | **Résolu** | `capitalStructure.dilutionRisk` vaut `unknown`. Le texte écarte explicitement l’inférence d’absence de capacité d’émission, de pont dilué daté ou d’ajustement de toutes les séries. |
| Profil de risque incohérent avec le score 5/10 | **Résolu** | `risks.riskScore` vaut 5 et `riskProfile` vaut `Moderate`; le rendu explique qu’il s’agit d’une échelle éditoriale sur dix, non d’une probabilité de perte, tout en conservant les cartes de risques élevés séparées. |
| Split non établi par une source primaire directe | **Résolu** | Le manifeste de révision enregistre l’8-K du 2026-06-12, accession `0001193125-26-269375`, hash `d5c3eacfd93f315c6161d973c2e4c0ea95ccc484898737b7866921adb7ec59bf`, et son URL SEC. Le document archivé indique un split forward « ten-for-one ». La JSON et son evidence sidecar le citent avec la limite correcte : le split ne prouve pas l’ajustement de toutes les séries fournisseur. |
| Révision sans preuve numérique liée à sa version | **Résolu au niveau sidecar de révision** | `evidence.json` référence le hash exact de `KLAC.json`; ses **282/282** claims correspondent exactement à la valeur de l’analyse et au pointeur de `numeric-evidence.json`. Ce dernier contient 282 clés de provenance et référence le même hash d’analyse. |

## Lecture retail finale

La version actuelle ne présente pas les niveaux archivés comme une opportunité active : le statut visible, les conditions de réexamen et l’absence de géométrie R/R évitent l’ancrage sur l’ancienne entrée, le stop et les objectifs. La baisse de valorisation est explicitement une sensibilité mécanique. La lecture du capital ne transforme plus le split, les Form 4/144 ou l’absence de découverte d’ATM en affirmation de financement ou de non-dilution.

Aucun nouveau défaut matériel de formulation, de calcul ou de rendu retail n’a été relevé dans ces quatre artefacts. Les limites restantes sont déjà rendues comme limites : classement RankBeta absent, dates de résultats à confirmer, short/emprunt contradictoire autour du split et couverture SEC non exhaustive.

## Résolution requise avant une décision finale

1. Refaire la collecte lorsque `RankBeta` répond avec succès pour le même `as_of`, puis conserver le résultat requis dans `_collect.json`.
2. Régénérer l’analyse, le rendu et les deux sidecars à partir de cette collecte, puis refaire le contrôle de hash et de 282 mappings sur les nouvelles empreintes.
3. Effectuer les gates de run-plan et toute promotion canonique/attestation sur ces nouveaux artefacts. Cette note ne constitue ni cette attestation ni une permission de publication.

La qualité éditoriale et la protection retail sont donc **réparées sur la révision gelée**; la décision de release reste **BLOCK** jusqu’à résolution du gate source obligatoire.
