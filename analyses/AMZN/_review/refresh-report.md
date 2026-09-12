# AMZN refresh — 12 septembre 2026

## État du brouillon

- Référence de marché : clôture du 11 septembre 2026, **256,78 $**.
- Collecte MCP : 23 sources déclarées ; contrôle de fraîcheur et validation du plan passants.
- Preuve : **323 claims** validés par `validate-analysis-evidence`.
- Validation du schéma et rendu : `node tools/render-analysis.js data/analyses-data/AMZN.json --dry` passe.
- Pré-revue stricte, `qa-content` 29/29 et `check-ai-tells` passent sur le preview privé.
- Publication, commit et HTML public : non effectués.

## Contenu et corrections de schéma

- Le statut reste **watch** : géométrie archivée conservée, sans nouvelle exécution affirmée.
- La guidance T3 donne 197–202 Md$ de ventes et 22,5–26,5 Md$ de résultat opérationnel. Prime Day exclu des deux années, la croissance serait environ 400 pb plus élevée ; le décalage déprime donc le taux guidé et le FX défavorable vaut environ 80 pb.
- Le P/E GAAP est 20,66x sur quatre BPA trimestriels. Sa médiane post-T2, 30 observations, est 21,01x. Une sensibilité illustrative porte le P/E à 27,54x si le BPA vaut 75 % de 12,43 $ : hypothèse analytique non prévisionnelle, sans retrait net d’impôts Anthropic.
- Les comparables ont YTD et un an `N/D` faute d’historique reconstruit. La comparaison sur 21 séances est AMZN -3,93 %, GOOGL -1,47 % et QQQ -1,22 % ; les rendements courts des comparables restent dans la propagation.
- Cinq documents primaires sont visibles : 8-K T2, Exhibit 99.1, 10-Q, 424B5 et 8-K Item 5.02. Les conclusions de septembre restent limitées aux dépôts : aucune émission finalisée ou dilution courante n’est déduite.
- Normalisation stricte : impacts d’actualité enumérés `neutral`, `beatStreak` entier 2, actions en circulation formatées en chaîne lisible, risque de dilution `unknown`, régime `risk-on` issu du snapshot du 12 septembre, score de risque qualitatif 6/10 (`High`) et social sans checklist factice. Le champ `blastRadius.reference` non prévu a été retiré ; les calculs restent audités dans `calculations.json`.
- La note fondamentale B est 72/100 (seuil B 70–79), distincte du watch.

## Limites déclarées

- La date du 29 octobre reste une estimation fournisseur, non confirmée par l’émetteur.
- Sentiment Reddit et tendances de recherche étaient détachés à la collecte ; aucun substitut n’est affiché. La couverture SEC des initiés reste partielle.
- Les ratios fournisseur à période non fournie restent secondaires et ne définissent ni prévision ni objectif de cours.

## Hashes du gel candidat

- `data/analyses-data/AMZN.json`: `bf809f050b74bb5c60951de6b56d2f1b22afcd49988e1bfc7210a1171cc1a720`
- `data/analyses-evidence/AMZN.json`: `cedf2e61912c080517b3a89ffe36ae6e2d894a0db77939157408f7a861da3024`
- `analyses/AMZN/_data/calculations.json`: `97cf32a6591c2fb498d1b5f8f1f81a38e8e504cb0f9ec1a7b0024ddb21d8922c`
- `analyses/AMZN/_review/primary-sec-manifest.json`: `fdbb0f268311354f7c4f1f7b5d49ab88c7407938d35a0b60c83cd599dfff84a4`
- `analyses/AMZN/_review/preview/index.html`: `d9d56b1b54383ef05ecdfe9932245175161b3cec281a8b977327705dd01aaa1b`
