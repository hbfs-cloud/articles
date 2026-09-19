# Revue indépendante AAOI — 19 septembre 2026

## Verdict de périmètre

**BLOCK / corrections requises pour la révision locale.** Le verdict `NO TRADE` est prudent et les
blocages connus sont correctement maintenus : RankBeta est en HTTP 403, le calendrier CIEN est
indisponible, le dénominateur fully diluted n'est pas réconcilié et aucune AQ finale ne peut être
certifiée. Cette revue ne vaut donc ni autorisation de publication, ni AQ-1/AQ-1.1, ni validation du
contrat de trading.

Les cinq primaires archivés correspondent aux SHA-256 du manifeste. Les prix passent le contrôle
limité suivant : AAOI contient 300 séances continues jusqu'au 18 septembre ; les 18 comparables ont
125 closes (124 rendements) communes du 23 mars au 18 septembre, sans trou supérieur à un week-end.
Les rendements 5/21 séances affichés sont arithmétiquement reproductibles. Cela ne répare pas les
défauts de preuve et de couverture ci-dessous.

## Défauts matériels

### P0 — Le sidecar `PASS` n'est pas une preuve sémantique

`evidence.json` pointe chaque claim vers le fichier généré `numeric-evidence.json`, puis vers une
copie de la valeur dans `values` ou `string_numeric_claims`. Le hash prouve que les deux sorties ont
été produites ensemble, pas qu'une revendication est soutenue par son input.

La table `claim_provenance` confirme le problème :

- 210 claims de performance/blast radius, y compris tous les tickers, dates, rendements,
  corrélations, bêtas et R², pointent tous vers
  `/data/items/0/results/0/data/0/bars/124/4` — le seul dernier close de LITE.
- Les 51 claims liés aux primaires (dont les 424B5 et les trois 8-K) pointent tous vers
  `/documents/0`, soit le seul 10-Q du manifeste.
- Les 24 claims raccordés aux barres pointent tous vers le dernier close AAOI ; les 17 claims
  fondamentaux vers l'objet fournisseur entier, sans champ, période ni dérivation.

La ligne HTML « 332 valeurs ... reliées au sidecar hashé » est donc trompeuse pour un lecteur ou un
reviewer : elle suggère une traçabilité claim-level qui n'existe pas.

**Correction exigée :** remplacer les pointeurs génériques par, pour chaque claim, le chemin exact
du ticker et des deux closes pour les rendements, les deux séries/date-window/opérateur pour
corrélation-bêta-R², le champ financier exact et son as-of, et le document primaire/accession/anchor
ou extrait local correspondant. Les valeurs dérivées doivent porter leur formule et leurs inputs.
Supprimer l'assertion « 332 ... reliées » jusqu'à ce contrôle sémantique ; le validateur actuel peut
rester un contrôle d'intégrité, jamais une attestation d'évidence.

### P0 — Contradiction avec l'archive sur le prédicat d'activation

Le JSON et le rendu répètent que l'ancien contrat « ne contient pas de règle d'activation » ou qu'une
activation « n'a jamais été définie ». C'est faux au regard du contrat conservé dans
`data/analyses-data/AAOI.json` : il stipule une nouvelle opening range RTH, spread inférieur à 0,60 %,
slippage explicite, risque portefeuille maximal 0,15 %, absence d'événements financement/résultats et
poursuite maximale 0,75 %. Ces conditions ne rendent pas le vieux setup exécutable aujourd'hui, mais
elles sont bien un prédicat documenté.

De plus, le générateur appelle cet input mutable `archive` alors qu'il lit
`data/analyses-data/AAOI.json`, pas un artefact daté sous `analyses/AAOI/archive/`. La révision ne
peut donc pas attester une archive immuable avec ce lien.

**Correction exigée :** dire que le prédicat historique est documenté mais expiré/non revalidé sur la
nouvelle fenêtre ; aucun de ses niveaux ou contrôles ne se transfère dans un ordre actuel. Sourcer ces
niveaux dans un snapshot daté et hashé de l'archive, ou retirer les niveaux du dossier local. Corriger
la même affirmation dans `verdict`, `retail` et la section HTML `archive`.

### P1 — La couverture capitalistique omet des instruments déjà chiffrés dans les primaires

Le 424B5 du 21 août indique 84 906 289 actions au 20 août et exclut notamment 1 090 055 RSU non
acquises et 629 463 PSU. Le 10-Q décrit aussi le customer warrant Amazon : jusqu'à 7 945 399 actions
à 23,6956 $, dont 1 324 233 exerçables à l'émission et 6 621 166 conditionnées à 4 Md$ d'achats sur
dix ans. La révision les remplace par « RSU, PSU, convertibles et warrant exigent une
réconciliation », sans table, montant, condition ni impact. C'est une omission matérielle pour le
lecteur retail, même si le total fully diluted courant reste légitimement bloqué.

L'ATM de 600 M$ est correctement traité comme une capacité, non comme une émission déjà réalisée.
Le prospectus fournit toutefois son illustration au 20 août : 4 647 561 actions à 129,10 $ pour
600 M$ ; elle doit être explicitement présentée comme hypothèse historique du prospectus, jamais
comme un compte courant ni additionnée au dénominateur actuel sans preuve.

**Correction exigée :** ajouter une matrice capital lisible : instrument, actions/nominal connus,
strike, condition de vesting/exercice, date/as-of, source primaire et statut « inclus/non inclus dans
le dénominateur ». Conserver le blocage du total fully diluted et ne pas convertir l'ATM en dilution
actuelle. La section doit satisfaire la couverture warrants demandée par `analyses/CLAUDE.md`.

### P1 — Le scénario de valorisation est économiquement invalide

`calculations.json` et `numeric-evidence.json` construisent un `valuationScenario` avec
`scenarioMultiple = 0` appliqué à un EBITDA de -32,106 M$. Cela fixe mécaniquement l'EV à zéro,
l'equity à la trésorerie nette (199,597 M$), un prix d'environ 2,35 $ et une baisse d'environ
97,8 %. Ce n'est ni un multiple, ni une hypothèse de faillite ou de liquidation documentée ; la
valeur devient une pseudo-précision réutilisable malgré l'absence de scénario affiché dans le rendu.

**Correction exigée :** retirer entièrement ce calcul et ses claims, ou le remplacer par
`non_applicable` tant que l'EBITDA est négatif. Un vrai scénario nécessiterait des hypothèses
publiées (marge, revenus, cash burn, dette, dilution) et une qualification explicite, sans quoi il
ne doit pas exister dans les artefacts d'évidence.

### P1 — Le bêta de comparables est ambigu et doit expliciter son sens

Le code calcule `beta(x,y) = cov(r_peer,r_AAOI) / var(r_peer)`. Chaque valeur est donc le bêta
d'**AAOI par rapport au pair** (régression de `r_AAOI` sur `r_peer`), alors que la table l'intitule
seulement « Bêta » sous le ticker du pair. Le 1,1528 de LITE est interprétable dans ce sens, mais pas
comme un bêta de LITE vs AAOI. Corrélation et R² sont symétriques, pas ce bêta.

**Correction exigée :** libeller explicitement la métrique et sa formule (« β AAOI vs pair »), ou
recalculer le bêta pair-vs-AAOI si c'est l'intention éditoriale. Joindre les deux séries, les dates et
la formule à chaque preuve. Le statut descriptif jusqu'au retour de RankBeta demeure indispensable.

### P2 — Les fondamentaux fournisseur sont temporellement indéterminés

Les chiffres 596,0 M$ de revenus, -32,1 M$ d'EBITDA, 28,92 % de marge brute et 86,4 % de croissance
sont étiquetés « instantané fournisseur ; période non inférée ». Cette réserve évite une fausse
certitude mais ne permet pas au lecteur de savoir s'il compare TTM, trimestre ou exercice avec le
close du 18 septembre. Le 10-Q archivé contient des chiffres trimestriels explicites, notamment
191,922 M$ de revenus Q2 et la concentration des dix premiers clients à 99 % ; le rendu local les
mentionne seulement de façon qualitative.

**Correction recommandée :** afficher la période et l'as-of déclarés par le fournisseur ; à défaut,
retirer ces KPI du verdict/fondamentaux et privilégier les mesures primaires avec période identifiée.

## Lecture retail et rendu

Le `NO TRADE`, l'absence de taille/ordre et l'avertissement de gap sont appropriés. Le rendu est
lisible et n'affiche pas une grande carte `N/A`. Toutefois les trois P0/P1 ci-dessus contaminent les
deux éléments qui donnent sa crédibilité au document : le panneau de contrôles promet une evidence
qu'il ne fournit pas, et la section archive explique mal pourquoi les anciens niveaux ne peuvent plus
servir. Après correction, conserver les deux gates externes comme `BLOCK`, refaire la revue de
provenance et le contrôle de rendu local ; ne pas conclure à une publication ou à une AQ complète.
