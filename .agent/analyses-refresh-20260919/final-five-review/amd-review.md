# AMD — revue indépendante locale : primaires, calculs, contrarian et retail

**Date :** 20 septembre 2026. Revue en lecture seule du candidat local
`20260919-update`. Cette note n'est ni une AQ, ni une autorisation de
publication, ni un ordre.

## Empreintes contrôlées

| Artefact | SHA-256 |
| --- | --- |
| `revision/AMD.json` | `19880134f16f6761fa60764911925ea595e99f50b703a08706293b41a040abba` |
| `revision/evidence.json` | `40460c2eee96a399af0b995cf1e18287091af5b19c8d9fc92dc3bf1569bd6b1a` |
| `revision/numeric-evidence.json` / `calculations.json` | `f5b9ce40559b9efb5a17e89d106836e29aa129e92c81a60be88cd58e73e8565a` |
| `revision/primary-manifest.json` | `17b2e1c59a11b25d6acb3eef8ab7d489673fb49b6848e01e4fb79331bc4d2aa7` |
| `amd-revision/build-amd.cjs` | `8592388abc2454fbd9f0ba57f5e5e8896263056da874aeecc57b86b8e0a4c192` |
| `amd-revision/complete-editorial.cjs` | `4c725392d5f0cae91c951c0eddd73d2294e90d2d10580014d3558787e983b989` |
| `amd-revision/build-evidence.cjs` | `1e8e2a555f8bd5cfa85879b22d0a58143418f7d68934e25d00cb1ec5def1efb1` |

Les contrôles actuels passent localement : `validate-analysis-evidence`
passe **267 claims** ; la pré-revue éditoriale stricte passe sans erreur ni
avertissement ; la QA HTML stricte passe 30/30. Ces résultats établissent la
cohérence locale des artefacts, jamais une publication.

## Contrôle des primaires et du capital

Les quatre dépôts archivés sont cohérents avec les claims centraux.

- L'exhibit 99.1 du 4 août, accession `0000002488-26-000121`, donne 11,536
  Md$ de revenus Q2, +50 % sur un an, 6,718 Md$ de Data Center, et une guidance
  Q3 de 13,0 Md$ ± 0,3 Md$. Le candidat distingue correctement le réalisé de
  la guidance.
- Le 10-Q du 5 août, accession `0000002488-26-000123`, donne les actions
  pondérées de base/diluées de 1,632/1,659 milliard. Il établit aussi deux
  warrants, OpenAI et Meta, chacun plafonné à 160 millions d'actions au prix
  d'exercice de 0,01 $. Les jalons combinent achats GPU, objectifs de cours et
  conditions techniques/commerciales ; au 27 juin, aucune action de warrant
  n'était acquise ni exerçable. La fiche ne les transforme pas en actions
  émises et ne fabrique pas de pont fully diluted.
- Le 424B5 du 14 août, accession `0001193125-26-352628`, documente 4,75 Md$
  de notes senior. La qualification comme dette, distincte d'une émission
  d'actions, est exacte.
- Le S-3ASR du 13 août, accession `0001193125-26-348013`, est correctement
  présenté comme une capacité juridique de shelf, non une émission, un produit
  encaissé ou une dilution réalisée.

Les risques partenaires sont donc mieux traités qu'une simple lecture
« partenariat = revenus » : les warrants conditionnels, les garanties de
location de data centers et les conditions de conversion imposent de vérifier
livraisons, revenu reconnu, marge et valeur par action. La source primaire
documente aussi jusqu'à 4,1 Md$ d'exposition brute de garanties de baux de
partenaires ; cette exposition renforce l'intérêt de la prudence sur la
conversion économique, sans être assimilée à une dette additionnelle certaine.

## Recalcul et provenance sémantique

Recalcul indépendant depuis `data/bars.json` et
`data/fundamentals.json` :

| Mesure | Recalcul | Affichage candidat |
| --- | ---: | ---: |
| Clôture du 18 septembre | 559,8200 $ | 559,82 $ |
| Variation journalière | 2,702306 % | 2,7023 % |
| Capitalisation (`close × 1 632 475 042`) | 913,892 Md$ | 913,89 Md$ |
| EV (`capitalisation + dette − trésorerie`) | 905,057 Md$ | implicite |
| EV/EBITDA | 94,6514x | 94,7x |
| EV/revenus | 21,9116x | 21,9x |
| Rendements prix 5 / 21 séances | 8,4649 % / 20,0249 % | valeurs arrondies du dossier |

Les résultats reproduisent les arrondis publiés. Le candidat les qualifie
comme snapshot fournisseur sans période comptable identifiée ; il ne les fait
pas passer pour une base TTM certifiée.

Les statistiques de blast radius utilisent 14 comparables, chacun avec 124
rendements communs. Les liens économiques et les calendriers sont explicitement
conditionnels : une corrélation ne devient ni un client, ni une causalité, ni
un revenu AMD. HPE reste signalé comme indisponible.

Aucune probabilité chiffrée de perte, de réalisation ou de réussite ne
subsiste dans le JSON rendu. `build-amd.cjs` crée encore, en étape
intermédiaire, des champs `probability`, `impact` et
`riskRadarValues` arbitraires ; `complete-editorial.cjs` les supprime
explicitement avant l'artefact courant. C'est satisfaisant pour le candidat
hashé, mais le générateur seul ne doit pas être considéré publiable sans cette
étape de finalisation vérifiable.

## Contrarian et protection retail

La lecture contrarian est crédible : la hausse des revenus Data Center et les
annonces de partenaires ne résolvent pas l'adoption ROCm, HBM/foundry/packaging,
les licences export, l'intégration système ni la marge. Le comparatif Q2
inclut une charge MI308 antérieure liée aux contrôles export ; il serait donc
abusif d'extrapoler mécaniquement une amélioration structurelle de marge.

Le dossier traite correctement les options (288 contrats sur trois expiries)
comme quarantainées et les données insiders/CTB comme insuffisantes. Il ne
construit ni squeeze, ni flow directionnel, ni absence d'événement à partir de
ces facettes.

La protection retail est cohérente avec `no-trade` : « AUCUN ORDRE ACTIF »,
archive du 27 août clairement datée, aucune activation RTH, stop, slippage ou
calendrier rejoué. Le texte demande une reconstruction complète avant toute
nouvelle idée et interdit de poursuivre un gap ou le dépassement d'un niveau
archivé.

## Constats à conserver avant release

1. **BLOCK publication — sources obligatoires.** RankBeta reste indisponible
   (HTTP 403) et le calendrier HPE est indisponible. Les statistiques locales
   ne constituent pas un remplacement acceptable ; aucune AQ/publication ne
   doit être conclue.
2. **M1 — documentation de run périmée.** Le README AMD annonce 253 preuves
   et indique que le contrôle éditorial strict n'est pas validé. L'état courant
   contrôlé ici est 267 claims et un contrôle éditorial strict sans erreur ni
   avertissement. Mettre à jour ce récit seulement lors de la prochaine
   régénération, avec les nouvelles empreintes.
3. **M1 — scénario de valorisation non publié à encadrer.**
   `numeric-evidence.json` conserve un `valuation_scenario` mécanique
   (multiple ramené à 70 %, prix 393,4976 $, variation -29,7100 %) qui n'est
   ni affiché dans `AMD.json`, ni relié par `evidence.json` à un claim
   publié. Il ne contamine donc pas le candidat actuel. S'il devient visible,
   il faudra déclarer le haircut arbitraire, son but de sensibilité et
   l'absence de valeur cible ; sinon, le retirer du sidecar.
4. **M1 — granularité des sources primaires.** Les claims AMD pointent
   souvent vers l'objet entier `/documents/N` du manifeste, plutôt que vers
   une ligne/needle et une valeur typée. Les quatre faits principaux ont été
   revus dans les textes locaux, mais un contrôle automatique
   document/needle/valeur renforcerait la preuve sémantique.

**Décision : qualité locale PASS sous les réserves M1 ci-dessus ;
source/publication BLOCK.** Cette revue ne crée aucun PASS AQ.

### Addendum — régénération autonome AMD

Après la revue, le générateur AMD a été rendu autonome et l'evidence a été régénérée. Le SHA de `AMD.json` reste identique à celui du tableau (`19880134f16f6761fa60764911925ea595e99f50b703a08706293b41a040abba`) ; seul `evidence.json` devient `e283546ba7a367a7093d0d4fa63ef67ecc776bc52e8cd1b537813ee6ff8fd600`. Le validateur courant passe toujours `267 claims`. Les constats et blocages de cette revue restent applicables.
