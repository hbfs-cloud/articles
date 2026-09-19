# Addendum final — contrôle du routage de réhabilitation

**Date :** 19 septembre 2026. Cette note contrôle uniquement la version corrigée de `derive.cjs` et `reassessment.json`. Elle ne collecte rien, ne relance pas le dérivé et ne modifie aucun JSON source.

## Verdict

**PASS conditionnel pour la seule file de recherche.** Les 69 routes sont toutes présentes une fois, les décisions totalisent 69, et le routage distingue désormais la reprise technique, la donnée à résoudre, la surveillance et le seul ancien setup vérifié inutilisable.

**BLOCK pour setup, exécution, AQ, article et publication.** Les 69 lignes ont `full_rehabilitation_certified=false`, `old_trade_reactivated=false`, `primary_event_review.complete_for_new_setup=false` et `new_contract_gate="NOT_PRODUCED"`. Les 11 `RESEARCH_PRIORITY` et 29 `RESEARCH_REVIEW` sont donc 40 priorités de recherche, **pas 40 réhabilitations validées**.

| Classe | Nombre | Décision de contrôle |
|---|---:|---|
| `RESEARCH_PRIORITY` | 11 | PASS seulement pour commencer une reconstruction de dossier. |
| `RESEARCH_REVIEW` | 29 | PASS seulement pour recherche/réexamen. |
| `DATA_QUARANTINE` | 3 | PASS pour isoler les données, BLOCK pour calcul de setup. |
| `DEFER_RECHECK` | 25 | PASS comme watchlist réversible, jamais un rejet définitif. |
| `EXCLUDE_BROKEN_VERIFIED` | 1 | PASS : BTM exclut le seul ancien setup Nasdaq vérifié, sans conclure sur toute négociation future éventuelle. |

## Contrôles réussis

- La somme `11 + 29 + 3 + 25 + 1` est égale à 69; `rows` et les symboles uniques sont aussi à 69.
- La fenêtre descriptive reste explicitement limitée à 39 séances US du 27 juillet au 18 septembre. Les indicateurs longs et les comparaisons avec les niveaux historiques restent exclus.
- Les trois quarantaines conservent `unapproved_diagnostic.invalid_for_routing=true`; le ratio volume non calculable est maintenant explicité par `volume_baseline_zero` lorsque la base est nulle.
- ABTC a une récupération d’identité hashée dans l’entrée ciblée; elle lève seulement cette déficience de profil et ne recertifie ni ses niveaux ni sa liquidité.
- Les cinq narratifs primaires sont stockés séparément pour ALT, GOSS, SNEX, BTM et ABTC. Les cinq gardent une revue primaire obligatoire avant tout contrat neuf.
- Les six exceptions disposent désormais d’un motif, d’une source, d’un owner et d’une date `review_by` : ALT, BTSG, SNEX, TEX, CPAY et MDLZ.
- La reprise courte est reproductible : les trois clôtures, le rendement deux séances et le booléen de deux clôtures montantes sont enregistrés. AMZN, EMR, ITRG et MPWR rejoignent seulement `RESEARCH_REVIEW` malgré leur rendement cinq séances négatif.

## Limites qui restent bloquantes

- Les labels textuels « Réintégrer » doivent être lus comme « prioriser la recherche ». Les enums `RESEARCH_*` et les gates fermées l’emportent; conserver cette formulation explicite dans README/ledger/queue pour prévenir une lecture comme signal.
- Les anciens entry/stop/TP restent non comparables pour les 69 routes. Le dérivé le confirme avec `old.levels_comparable=false`; aucune exception ne réarme l’ancien stop.
- GOSS reste en quarantaine d’unités; APLD et DGX restent en quarantaine de discontinuité. Les chiffres diagnostics ne peuvent pas servir à un ranking.
- BTM est correctement plus restrictif qu’une simple anomalie de flux : la revue primaire lie Chapter 11, suspension Nasdaq et absence d’appel aux barres figées. L’exclusion vise l’ancien scénario Nasdaq seulement et ne prétend pas annuler les actions ni exclure tout marché éventuel futur.
- La découverte SEC et les cinq notes narratives ne remplacent pas l’examen primaire requis par symbole avant un nouveau contrat. Le modèle n’a pas produit entrée, stop, cibles, taille, convention de déclenchement ou preuve de liquidité.

## Empreintes vérifiées

| Entrée | SHA-256 |
|---|---|
| `rehabilitation69/derive.cjs` | `f495e03396b0b3439b1fae04b03200f473f3ca46f44f1e50e48df8d0f5c06945` |
| `rehabilitation69/reassessment.json` | `80d944ffb124db1a6e9d45079f2dac80da7a891208993092895d3fefa269893d` |
| `rehabilitation69/primary-review.json` | `768b9701eed0bac23c629238cb63950e2c5c172506981311e1742e96e26f0359` |
| `rehabilitation69/targeted-data/alt_financials_identity.json` | `ee9d3f75106f6e96594ddc190426ca39d5dbb5a14014c3c2b9124f18daa92e80` |

Le manifeste `reassessment.json.inputs` contient 30 entrées hashées : exclusions initiales, cinq narratifs/identité ciblée, et neuf vagues de barres, contexte et événements. `node --check derive.cjs` passe. Aucun fichier public ni article n’est inclus dans ce contrôle.

**Aucune attestation AQ et aucune autorisation de publication ne sont émises.**

## Post-correction sémantique
Le rerun conserve 69 routes et les comptes 11/29/3/25/1; seuls les labels deviennent des files de recherche ou de résolution de données.
`reassessment.json` SHA-256 : `1fd9d923d33395a5c29ace2e4beb23f711268edc88ea12164a6f31b0ad450425`.
