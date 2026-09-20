# Revue indépendante — AG (20 septembre 2026)

Périmètre lu en lecture seule : `analyses/AG/_runs/20260919-update/{revision,primary}` et `.agent/analyses-refresh-20260919/ag-revision`.

| Artefact | SHA-256 |
|---|---|
| `revision/AG.json` | `b2e4787c120537dc3ad04300f35e9dcea9c1b2e07fb9720b8d7f54d71960aa75` |
| `revision/evidence.json` | `9ef8460dc1f58c5deed6c2885ace4fe8fb5f814d65b64a4a9f90cc4dd8dbdffc` |
| `revision/numeric-evidence.json` | `866f18434b230e9c1a0ae8269bf51d2beaff6df37623db58941b266c7f1e39f2` |

Les contrôles locaux actuellement disponibles passent : evidence `282 claims`, pré-revue stricte `0 erreur / 0 avertissement`, et QA HTML stricte `30/30`. Cela ne constitue pas une attestation AQ ni une autorisation de publication.

## Primaires vérifiés

Les quatre fichiers HTML existent, correspondent aux hash du manifest et portent les informations utilisées avec les limites appropriées :

| Document | SHA-256 | Constat vérifié |
|---|---|---|
| 40-F, 31 mars | `8fec7dc5b041ef047c0b3a98ad45eab30499951ced6e28ae637f3c4fed3c42fa` | 491 322 304 actions à la clôture de FY2025 ; ce n’est pas un pont fully diluted courant. |
| 6-K San Martin, 7 juillet | `2f9674f17909b60c31637f7a0af2e2842e7e62aeae8945a97a9a7491110c567f` | Cession proposée à 90 M$ avec conditions et paiements futurs : aucun encaissement n’est traité comme acquis. |
| 6-K résultats T2, 30 juillet | `b6041121a4f9967684d87f55e13d7f8821c1447031db32ffaadc0486f45610c8` | 415,5 M$ de revenus, 194,6 M$ de free cash-flow, AISC de 25,68 $/oz AgEq ; les métriques sont attribuables à 70 % pour Los Gatos. |
| 6-K San Dimas, 9 septembre | `04f408f740be53fb9d9246864c6a77d0bc33b7dd204cb1e7809e0cbd3847b49e` | Environ 117 000 m de forage prévus en 2026 ; le texte ne le transforme pas en réserve, revenu ou cash-flow. |

La lecture contrarian est donc prudente et justifiée : le métal ne suffit pas à déduire le bénéfice par action face aux coûts, au peso, aux récupérations, au capital et à la quote-part de Los Gatos. Les corrélations restent descriptives ; aucune causalité client ou squeeze n’est inventée.

La partie retail conserve bien le contrat du 27 août comme archive : `no-trade`, aucune entrée, taille, stop ou cible active. Elle explicite liquidité, spread, slippage, gap et calendrier à vérifier avant toute révision.

## Blocages et écarts

1. **BLOCK sémantique — scénario chiffré.** `numeric-evidence.json` calcule 20,67058 $ à partir du snapshot fournisseur, contre 19,84 $ de clôture, soit **+4,1864 %**. La même valeur est étiquetée `downside_pct`. Le scénario est correctement qualifié comme mécanique, sans juste valeur ni ordre, mais ce libellé inverse son sens économique et doit être corrigé avant validation finale.
2. **BLOCK publication — sources obligatoires.** RankBeta est toujours en HTTP 403, le pont fully diluted courant manque et les données retail obligatoires ne permettent pas de réactiver le contrat archivé.
3. **Mise à jour requise — documentation de run.** `ag-revision/README.md` affirme encore que l’evidence échoue volontairement avec 25 claims et met en avant l’ancien écart 19,89 $. Les artefacts actuels donnent 282 claims PASS et la limitation actuelle indique que la réserve 19,89 $ a été retirée. Cette documentation n’est plus une description fiable du run final.

**Verdict : qualité locale des sources et du contenu PASS sous réserve de l’écart de libellé ci-dessus ; publication BLOCK** tant que le libellé du scénario, RankBeta, le capital fully diluted et les gates retail ne sont pas résolus. Aucune attestation AQ PASS n’est donnée.

### Addendum — champ contractuel de variation

La vérification du contrat de `tools/validate-analysis-evidence.js` montre que `downside_pct` est imposé comme la variation signée `100 × (prix / close − 1)`, sans convention imposant un signe négatif. Dans le sidecar régénéré, 20,67058 $ rapporté à 19,84 $ donne donc correctement `+4,1864 %` : une hausse mécanique, et non un risque de baisse.

Le `valuation_status` du générateur et de `numeric-evidence.json` indique désormais explicitement cette convention, le caractère mécanique du calcul, l’absence de juste valeur et l’absence d’ordre. Le scénario n’est pas présent dans `AG.json` ni dans le rendu public. Le point 1 du blocage précédent est donc **levé** : il s’agissait d’une ambiguïté du nom contractuel, pas d’une erreur de calcul ou d’une affirmation publiée. Les seuls blocages de publication restent RankBeta HTTP 403, le pont fully diluted et les données retail/contrat non réconciliées.

Empreintes après régénération : `AG.json` demeure `b2e4787c120537dc3ad04300f35e9dcea9c1b2e07fb9720b8d7f54d71960aa75`; `evidence.json` est `4e777d70c80a6cf3baf64ce548d64ed2c2d1866b7cb9794320c3397853c2de0f`; `numeric-evidence.json` est `ac5aa71589348236a80969632c08376b5223ad1aed15e43230b5560efde8eaa6`. Le validateur passe toujours 282 claims.
