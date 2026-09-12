# Actualisation TSM — 12 septembre 2026

Référence de clôture : **11 septembre 2026**. Révision produite dans le worktree isolé, sans modification de `analyses/TSM/index.html` public. AMZN reste inchangé : sa collecte canonique a échoué avant la création d’un artefact.

## Changements matériels

- La thèse reste un **watch** de suivi historique, sans affirmation d’une position exécutée. TSM fabrique des puces pour des clients tiers. Le 6-K du 10 septembre rapporte TWD 514,806 md de revenus d’août (+53,3 % annuel ; +10,1 % mensuel), sans annualisation.
- Le contre-argument est visible : guidance T3 de marge brute à 65–67 % contre 67,7 % au T2. Les résultats T2, la guidance, le ratio ADS/cinq actions ordinaires et le contrôle interne 2025 sont reliés aux six documents primaires locaux hashés.
- La valorisation visible utilise un BPA ADS réalisé de quatre trimestres, $13,86. Sur les 40 séances du 17 juillet au 11 septembre 2026, le P/E correspondant va de 27,03x à 31,67x, médiane 30,11x; le 28 août, $417,52 équivalaient à 30,12x. À 31,26x, le 11 septembre est au 95e percentile de cette courte fenêtre post-T2. Ce n’est ni une moyenne de cycle ni un substitut d’EPS annuel. La croissance d’août soutient la demande, mais la guidance de marge justifie d’attendre une confirmation plutôt que de poursuivre.
- La moyenne pondérée 2025 du 20-F est 25 928,3 millions d’actions ordinaires de base et 25 930,6 millions diluées, dont 2,3 millions potentielles dilutives. Elle est historique; le fully diluted courant reste indisponible. Le 20-F établit aussi que la direction a conclu à l’efficacité de l’ICFR au 31 décembre 2025 et que Deloitte & Touche a fourni une attestation. Le dossier ne déduit aucune conclusion de continuité d’exploitation par silence.
- La note 82/100 est une grille éditoriale publiée dans le sidecar : qualité économique 30, croissance 19, bilan 14, valorisation 12, risques de capital/gouvernance 7. Elle ne contient ni prix, ni RSI, ni objectif de cours.
- `radarValues` technique décoratif est retiré. Les calendriers de comparateurs distinguent les émetteurs des ETF, et les références MCP renvoient vers le sidecar public hashé; les liens SEC restent directs.

## Contrôles finaux

- `node tools/validate-analysis-evidence.js data/analyses-evidence/TSM.json` : **PASS (297 claims)**.
- `node tools/check-analysis-editorial-quality.js --pre-review data/analyses-data/TSM.json` : **PASS**, 0 erreur, 0 avertissement.
- `node tools/check-freshness.js analyses/TSM/_data/harness.json` : **PASS**, 23 sources datées, 0 bloquante; clôture de référence confirmée au 11 septembre.
- Prévisualisation privée : `qa-content --strict` **29/29** ; `check-ai-tells --strict` sans tell évident.
- `git diff --check` : **PASS** ; `analyses/TSM/index.html` est identique au baseline.
- Recherche conventionnelle de marqueurs d’identifiants sur les artefacts TSM : **0 occurrence**. Le contrôle ne liste aucune valeur potentiellement sensible.

## Artefacts nécessaires à une publication reproductible

À versionner, sans les prévisualisations PNG/HTML ni les caches d’échecs :

1. Les sorties publiques `data/analyses-data/TSM.json` et `data/analyses-evidence/TSM.json`.
2. Le calcul et son générateur : `analyses/TSM/_data/calculations.json`, `analyses/TSM/_review/build-refresh.cjs`.
3. L’attestation de collecte : `analyses/TSM/_data/harness.json` et `analyses/TSM/_data/_collect.json`; le harness porte les 23 facettes collectées et le log de plan résolu.
4. Les huit entrées effectivement déclarées par `calculations.json` : barres TSM, barres comparateurs, contexte et événements comparateurs, fondamentaux, techniques, options et corrélations.
5. Les six documents listés par `primary-sec-manifest.json`, ainsi que ce manifest; ces pièces sont nécessaires pour revérifier les constatations SEC/IR. Les deux anciens doublons `primary-424b5-*` ne sont pas nécessaires, les copies canoniques sont sous `primary-extra/`.
6. Le baseline archivé, la grille de score, et l’audit des comparateurs (`parent-comparison-audit.cjs` et `.json`).
7. L’image source Finviz `analyses/TSM/assets/finviz-20260911.png`, puisqu’elle est conservée dans l’analyse.

Les fichiers de prévisualisation, captures navigateur, plan FX, caches de rendu et anciens résultats de revue servent au contrôle local mais ne sont pas nécessaires à la reproduction des chiffres publiés.

## Hashes

| Artefact | SHA-256 |
|---|---|
| `data/analyses-data/TSM.json` | `8c8a6c8c7a6af7a0eb210636c91ad715f877be17bffdd24f86bd9ce8fd4ad574` |
| `data/analyses-evidence/TSM.json` | `a89ddde51e070f7662ad526046155a75b71c0fbff644827e5aa04cb7f1ffb868` |
| `analyses/TSM/_data/calculations.json` | `0818498a4e97d181720f6d1d5412c9f2d5eb22e456048c655728bd08ed2229ad` |
| `analyses/TSM/_data/harness.json` | `966c26becca6bffe1dea18d3dd17db4021933b1643b2be0989caa41c560fdde8` |
| `analyses/TSM/_data/_collect.json` | `18cea9b592bdda48c3626ef98e988bc97f7f348cd83c64edbd23700c27f6c3cc` |
| `analyses/TSM/_data/bars.json` | `facceb54e8a5a9a13bd096f4c276b87c23bd1b0b58704045bb0f1fecb50e2d6f` |
| `analyses/TSM/_data/comparison_bars.json` | `25a6b72f67b2695ad2b073f4b1b2b180967d4ff9d0b33e5ad6121082d4f3922f` |
| `analyses/TSM/_data/comparison_context.json` | `ae3e4cf5f8fa8eb465f82d9b4ec0ad42d2d4b13ee98049ff497d93c7febbd398` |
| `analyses/TSM/_data/comparison_earnings.json` | `141e05be6c6cefefcc3c6b77a128ec3161eaab3fbc198b0dc929c2ca4f9c9a13` |
| `analyses/TSM/_data/fundamentals.json` | `76fd96bdf0c8e8c390b49bc87f31f7b18b723637489ad4a15efc52f81ce5dcc6` |
| `analyses/TSM/_data/technicals.json` | `8dd29b653dde0f0a721e2e4851eacf44da873bf0b961d81654fc0b325a988f0d` |
| `analyses/TSM/_data/options.json` | `ad6fc4ae2365bbb6fd03332c905a6ef04e84b01363f13f70b18bbf0cba290fda` |
| `analyses/TSM/_data/current_correlations.json` | `68850209ee01fc76679e4cd5df8a0e9ba69abeb5e3172ca279bf6ca9adc8ccbf` |
| `analyses/TSM/_review/build-refresh.cjs` | `88ef92bff335d2ba385276b7fc8762ee1bfec2f78776910d45cde6ea129ac2fe` |
| `analyses/TSM/_review/primary-sec-manifest.json` | `68bf6da8b339ec56d9e297edf88bca8e5cf4793f5b932f2606f6a0c08a067beb` |
| `analyses/TSM/_review/baseline-TSM.json` | `ab4b6e6abd1aff20a6183cd9375c74e14681e45396fc0cb1c3711527085abea5` |
| `analyses/TSM/_review/score-rubric.json` | `e1cc2ac4a49e0cf2f544f73efb76d3710b009e1cac7886f5223bba2e886a4f07` |
| `analyses/TSM/_review/parent-comparison-audit.cjs` | `2caaf515c135c303f77fe9230bbb2ad7524c591f3db7dda8870fd690af6eda1c` |
| `analyses/TSM/_review/parent-comparison-audit.json` | `bb6b56c99f3a7c14c2a81beccc5f788ad913ad72fd5a54946f9bf58204a1b4bf` |
| `analyses/TSM/assets/finviz-20260911.png` | `accda8c817a84cb2637efd7d5bbf3df7564ee6a18ea75c32c098eaea588a0f3c` |
| `analyses/TSM/_review/preview/index.html` | `cab6f4256bbd1b9e8a0b0e1b7dc5da512b7c5e3d05b91429a99585e2e32d9fc9` |

### Documents primaires inclus par le manifest

- `analyses/TSM/_review/parent-tsm-20f.html` — `c3ebd05cd8fb383f53fc21a0ac497ee12cf908b709c380f9bec4f39c4916647b`
- `analyses/TSM/_review/parent-q2-earnings-guidance.htm` — `6e877956870c87d857d8af23144f35ddcbd3b569d464c962e7cf368c46860be3`
- `analyses/TSM/_review/primary-august-6k.html` — `806a0c50fe923834ddc7dacf6f51d23d86e0f8bbf25a134a7aa72c5af84d4e7f`
- `analyses/TSM/_review/primary-extra/2026-09-01-6k-dividend-adjustment.htm` — `515acf416d70d58de02d1901f0aab9946e802e40c5235007ec175ccaf7b9cd03`
- `analyses/TSM/_review/primary-extra/2022-04-18-424b5-d257631d424b5.htm` — `fd14843058ba241f34cd4300a5d3861cbd338ec70f6bf37608822877ddaed326`
- `analyses/TSM/_review/primary-extra/2021-10-18-424b5-d133627d424b5.htm` — `c478103d2f9df4575990d9f7b644a2fbb3f536c32d03e4d233a46313fa604733`
