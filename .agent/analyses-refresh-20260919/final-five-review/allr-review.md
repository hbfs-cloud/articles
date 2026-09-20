# ALLR — revue indépendante locale : primaires, capital, clinique et retail

**Date :** 20 septembre 2026. Revue en lecture seule du candidat local
`20260919-update`. Cette note n'est ni une AQ, ni une autorisation de
publication, ni une recommandation ou un ordre.

## Empreintes contrôlées

| Artefact | SHA-256 |
| --- | --- |
| `revision/ALLR.json` | `259b6457a8f7fd1bd942153c846baadee8daf271bc7aa2edf20a54abf527fd4f` |
| `revision/evidence.json` | `6f98231079b86b74072e9aa2293c923fa7d53cf894f49b718d049d26294ffe3f` |
| `revision/calculations.json` | `d634a1142dda9eecd82f898754236942b411bca8d4a7bed1c9f7344c4e5fd874` |
| `revision/primary-manifest.json` | `8def7ee98c871d8be302bc02eb8702ed01bb73b91fe715787e2c369af8eb9981` |
| `revision/ALLR-archive-snapshot-20260828.json` | `67b7a12dd173afd08710af45232800ce673460852c1524333d5192378b0ae4c7` |
| `allr-revision/build-allr.cjs` | `3fa3e4c2e133623618937f0f56d2c68d893cc0bdba8cf8f876a71ffe05be1b63` |

Les contrôles rejoués donnent `validate-analysis-evidence` **PASS (270
claims)** et le renderer `--dry` **PASS**. La pré-revue éditoriale stricte a
un seul échec : absence de relation `upstream` dans le blast radius. C'est une
limite matérielle et légitime : Eisai est le concédant historique des droits de
stenoparib, sans fournisseur coté ni relation d'approvisionnement prouvée dans
ce corpus. Créer une telle relation pour satisfaire le gate serait une
fabrication. Ce dossier n'est donc pas prêt pour publication.

## Primaires, liquidité et capital

Les quatre documents du manifeste existent localement, ont des hashes distincts
et correspondent aux URLs EDGAR et accessions déclarées :

| Document | SHA-256 |
| --- | --- |
| 10-Q ALLR, `0001437749-26-027830` | `5f55b17393119876dacba272c5b2a2d19c5b065ea72cb2a1f777f8541fc0f178` |
| Exhibit SPAC ALLR, `0001213900-26-099576` | `210c9ce849047ff248be5e5263fa73b7580b3d63ed73e1fcd977c2d7a748693c` |
| Exhibit brevet ALLR, `0001213900-26-100350` | `e230d7f7c582818b819510d46c31eab5a927e426d521d9129572ca1e1e7caa3c` |
| S-1 ALLN, `0001493152-26-042104` | `c6c5f8e3dd2b12fc68c9d9fc3a953f9b0d93fbe575b91dfccac4f6a98e1a916a` |

La distinction de liquidité est correcte : le 10-Q au 30 juin sépare 16,982
M$ de cash de 9,999 M$ de cash restreint. Le total de 26,981 M$ ne doit donc
pas être décrit comme une réserve libre. Le flux de trésorerie opérationnel H1
de -7,057 M$, les dépenses opérationnelles de 5,384 M$ et la perte nette H1 de
6,155 M$ sont employés comme contexte, sans être transformés en prévision de
revenu ou de cours.

Le traitement du capital est également prudent. Tumim est une facilité d'achat
d'actions, non du cash : 6,0 M$ de capacité et 5,998 M$ restant au 30 juin. La
décote liée au VWAP et le nombre d'actions variable justifient le risque de
dilution, mais ne donnent pas un total fully diluted. Les notes Streeterville,
l'ancien ATM terminé et les instruments de rémunération sont explicitement
séparés. Les 15,910,724 actions outstanding et les 19,124,363 émises du 10-Q
ne sont pas confondues.

Le SPAC est traité correctement comme une proposition extérieure et
conditionnelle. L'IPO annoncée de 100 M$ (115 M$ en cas de surallocation) et
les warrants du sponsor concernent ALLN ; ils ne deviennent ni un titre ALLR,
ni de la trésorerie clinique d'ALLR. Cette séparation est essentielle au cas
contrarian : une communication sur le SPAC peut attirer l'attention sans
améliorer les ressources disponibles pour un essai.

## Clinique, comparables et protection retail

Le récit clinique garde la bonne hiérarchie de preuve. La fabrication dite
« Phase 3-ready », le brevet japonais du diagnostic DRP et les phases 2 du
stenoparib sont des jalons de préparation ou de propriété intellectuelle. Ils
ne valent ni efficacité future, ni approbation, ni revenu commercial. Eisai est
nommé comme concédant historique ; la fiche refuse explicitement d'en faire un
client coté, un fournisseur coté ou une source de revenus inventée.

Les chiffres de marché et d'indicateurs sont pris depuis le même
`data/instrument.json` certifié : les facets
`instrument_comprehensive_financial`, `instrument_comprehensive_stats` et
`instrument_technicals` sont relus par le générateur. La clôture est 1,21 $ au
18 septembre ; les 13 comparables ont chacun 124 rendements communs. Les
corrélations, bêtas et R² sont présentés comme descriptifs et non comme une
probabilité clinique, une causalité ou une relation commerciale.

Le statut `no-trade` est cohérent. Les niveaux 1,39 / 1,33 / 1,4919 / 1,5499
sont identifiés comme archive historique inactive ; aucune activation RTH,
aucun VWAP, aucun spread, aucune profondeur et aucune taille ne sont déduits.
La pédagogie retail traite explicitement le gap clinique/financement, le
slippage, la liquidité et l'interdiction de poursuivre une annonce.

## Blocages et défauts à conserver

1. **BLOCK publication — univers amont absent.** Le seul échec de pré-revue
   est légitime. Le générateur contient encore une construction intermédiaire
   qui qualifie PFE d'`upstream`, mais le JSON final le corrige en
   `direct_peer`. Cette correction finale est sémantiquement nécessaire : PFE
   est un comparable thérapeutique, pas un fournisseur amont documenté d'ALLR.
   Ne pas réintroduire ce faux lien uniquement pour passer le gate.
2. **BLOCK publication — sources de marché obligatoires.** RankBeta est
   indisponible ; options et fenêtre intraday/VWAP sont absents. Les 300 barres
   et les calculs locaux ne remplacent pas ces sources.
3. **M1 — statut du générateur.** La présence de la relation `upstream`
   intermédiaire puis de son écrasement dans l'artefact final rend la chaîne de
   génération moins lisible. Elle ne falsifie pas le JSON hashé revu ici, mais
   une future refonte devrait représenter explicitement « aucun amont coté
   prouvé » au lieu de créer puis retirer une classe invalide.
4. **M1 — valeur clinique et capital.** Le 10-Q fournit un horizon de
   ressources estimé d'au moins douze mois, pas une garantie. La disponibilité
   clinique, les termes effectifs de Tumim et toute émission future restent à
   vérifier avant qu'un dossier puisse discuter d'une exposition.

**Décision : cohérence locale des preuves PASS, mais publication/AQ finale
BLOCK.** Ce rapport ne modifie ni le dossier ALLR, ni son générateur, ni ses
preuves.
