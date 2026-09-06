# Hebdo 20260907 — changements de méthode et revues

Clôture de référence : 2026-09-04. Publication : dimanche 6 septembre 2026.

Ce document enregistre ce qui a changé dans la *façon* de produire un hebdo, et ce que trois revues
indépendantes ont trouvé. Les chiffres publiés vivent dans `weekly/20260907/_data/claims.json`,
chacun lié à un pointeur JSON dans un artefact dont l'empreinte est enregistrée.

---

## Partie I — Outillage

### 1. Le constructeur d'hebdo devient générique

`weekly/20260831/_build.cjs` faisait 832 lignes et câblait AVGO en dur trente fois. Structure HTML,
chiffres et prose vivaient dans le même fichier daté : impossible de rejouer une semaine passée avec
la méthode courante, impossible de vérifier qu'un chiffre publié dérivait d'un artefact.

Remplacé par `tools/build-weekly.js` + `weekly/YYYYMMDD/_editorial.json`. **Aucun nombre n'est saisi
dans le manifeste** : il ne peut que référencer une mesure par son nom, et une référence inconnue
fait échouer le rendu au lieu de laisser un trou dans la phrase.

### 2. Un contrôle bloquant était insatisfiable

`tools/collect.js` hachait `{artifact, refdate, waves}` mais enregistrait sous `resolved_input` un
objet différent (`{artifact, equity_reference_close, crypto_completed_refdate, as_of_timestamp,
waves}`). `validateCollectedArtifact` recalcule l'empreinte depuis `resolved_input` et la compare à
`input_sha256` : **la comparaison ne pouvait plus jamais réussir**, donc aucun article dont un
chiffre venait d'une collecte récente ne pouvait passer `validate-content-claims.js`.

Corrigé : on hache exactement ce qu'on enregistre. Un contrôle qu'aucune donnée honnête ne peut
satisfaire ne protège de rien — il apprend à passer outre.

### 3. Le validateur poussait à ne pas instrumenter

Il ne connaissait que `sum_divide_pct`. Or une performance est `(a/b − 1) × 100` et un multiple de
volume est `a/b` : les deux formes dont un hebdo est presque entièrement fait. Faute de pouvoir les
déclarer, la seule façon de passer le contrôle était de **ne pas lier ces chiffres**.

Ajouts : `ratio_pct`, `ratio`, `ratio_to_mean` (dont les pointeurs de moyenne sont énumérés un par
un — une fenêtre décrite par des bornes laisserait choisir l'intervalle après avoir vu le résultat),
le format `fr` (virgule décimale, espace fine, signe moins typographique, ordinal du premier du
mois) et le format `fr_date`.

`build-weekly.js` **importe** `renderValue` du validateur au lieu d'avoir son propre formateur.

### 4. Échappatoire déclarée pour les littéraux

« S&P 500 » est un nom propre, une empreinte SHA-256 est un identifiant. Exiger qu'ils soient liés
les rendrait impubliables et pousserait à renommer l'indice. `data-literal` les admet, mais chaque
texte doit figurer dans `manifest.literals` — liste courte, relue, et le contrôle refuse aussi bien
un littéral non déclaré qu'un littéral déclaré absent de la page.

### 5. `blast_bars` : le nombre de symboles, pas la forme de l'appel

Quatre exécutions expirées à 900 s. Isolé : les deux seuls appels combinant `adjusted:true` et
`days:N` étaient aussi les deux seuls à expirer. Après alignement sur `limit:120`,
`focus_correlation` (huit symboles) est passé de 900 s à **76 ms**. `blast_bars` (douze) continuait
d'expirer → la variable est le **nombre de symboles**, seuil entre huit et douze.

Scindé en deux lots de six : **31 secondes, les deux certifiés**. Contrat exécutable mis à jour
(`blast_symbols_a` / `blast_symbols_b`, plafond 6 par lot).

---

## Partie II — Ce que les revues ont trouvé

Trois revues indépendantes sur l'artefact rendu : Senior QA, Contrarian, Dev senior. Les deux
premières ont convergé sur le même défaut central, et il était grave.

### La troncature fabriquait la conclusion

Faute d'avoir certifié `blast_bars`, la première version publiait la chaîne sur **six** titres au
lieu de douze, en invoquant un échec de collecte. Deux problèmes.

D'abord l'affirmation était fausse : les barres des six autres étaient sur le disque, recopiées par
la voie agent. Ensuite et surtout, **la coupe changeait la conclusion** :

| affirmation à six | réalité à douze |
|---|---|
| « Broadcom est le seul dans le rouge » | trois baissent : MSFT, AMD, AVGO |
| « Micron mène » | Micron est **quatrième** — CRM, SMCI et DELL le devancent |
| « le seul en baisse est celui qui a publié » | **deux des trois baissiers n'ont rien publié** |

La phrase qui portait toute la thèse ne survivait qu'à la troncature. Corrigé en certifiant les
douze, ce qui a inversé la conclusion de l'article.

### Le précédent Broadcom disait l'inverse de ce qu'on lui faisait dire

L'article présentait Broadcom comme le cas d'école d'une « barre haute » sanctionnée. Mesuré : le
titre entrait dans sa publication à **−0,50 %** sur trois séances et **−5,7 %** sur vingt et une. La
barre n'était pas haute, elle était basse. Et sur les −14,90 % du mois, **−12,10 points étaient
acquis avant le communiqué** ; la publication a coûté −3,39 %.

Attribuer un mois à un événement qui n'en explique qu'une fraction est une inversion de causalité,
mesurable dans les fichiers de la page elle-même.

### Une date de publication dérivée d'une barre de prix

`prec_report_date` pointait vers `bars/117/0` — c'est-à-dire « la séance qui précède le plus gros
écart ». C'est l'heuristique **exactement** condamnée par l'incident PANW/ADI du 2026-08-25, et
l'article s'en réclamait deux sections plus haut.

Corrigé à la racine : ajout des appels `chain_reactions_a` / `chain_reactions_b`, qui rendent les
réactions **datées par numéro d'accession SEC**. Effet immédiat — les deux dates que j'avais
dérivées des barres étaient **fausses d'un jour** (Salesforce le 26 et non le 27 août, Dell le 1er
et non le 2 septembre), et la réaction de Dell mesurée sur sa vraie fenêtre vaut **+7,94 %** et non
les +15,81 % de la seule séance du lendemain.

### L'échantillon était dans le dossier, et l'article écrivait ne pas l'avoir

`focus_fundamentals.json` contenait les **huit dernières publications d'Oracle**, datées SEC. Leur
contenu retourne complètement la thèse initiale :

- 4 hausses, 4 baisses — **aucun avantage directionnel** ;
- amplitude médiane **10,08 %** contre **11,68 %** d'implicite ;
- vendre cette amplitude aurait gagné **six fois sur huit** et perdu **9,5 points au total**, à
  cause d'une seule réaction à **+37,68 %** ;
- cette réaction date du **9 septembre 2025**, et l'autre septembre de la série (**9 septembre
  2024**) fait +9,93 % : les deux septembres sont des hausses ;
- la séance de réaction clôture **au-dessus de son ouverture sept fois sur huit**, y compris sur les
  quatre baisses — ce qui réfute le conseil « ne pas poursuivre l'ouverture » que l'article donnait.

### La fenêtre de la « pré-hausse » était choisie

Les +12,35 % d'Oracle sont mesurés depuis 141,32 $, **le plus bas cours de clôture du mois**. Sur
cinq séances, la hausse est de +5,26 %. Et les trois séances se sont faites entre **0,85 et 1,02
fois** le volume moyen — c'est-à-dire que la convention de l'article lui-même (« pas de validation
sous deux fois le volume ») **rejette** la hausse sur laquelle il était bâti.

Le fait est conservé et publié avec ses deux réserves, parce qu'il sera cité partout cette semaine.

### Aucune condition de démenti

Le tableau *Si… Alors* gagnait dans les deux directions : un écart haussier était reclassé en piège
à éviter plutôt que compté comme une erreur. Une condition de démenti explicite est désormais écrite
dans la section Trades, avec engagement de bilan la semaine suivante.

---

## Partie III — Autres corrections

- Tri du calendrier **par instant réel** et non par chaîne : « 08:30−04:00 » est postérieur à
  « 14:15+02:00 » alors que la comparaison lexicale plaçait les chiffres américains avant la BCE.
- « la plus grosse séance en volume de la fenêtre » : **faux** (60,2 M contre un maximum de 81,0 M).
  Superlatif retiré.
- « les trois rendent du terrain » sur la crypto : **faux**, deux des trois montaient sur la semaine.
- Ordre des tableaux **dérivé** et non déclaré : le tableau sectoriel listait un ordre saisi qui
  ressemblait à un classement sans en être un.
- Comptages en toutes lettres avec capitale en tête de phrase (« . cinq des six » → « Cinq des six »).
- Double négation « perd −1,96 % », « a gagné +12,4 % ».
- « l'énergie est le seul secteur du bon côté » : six des onze sont positifs sur le mois — reformulé
  en « le seul dont la hausse vient directement du baril ».
- « un baril à +19,4 % » : la mesure porte sur un fonds adossé au contrat le plus rapproché, pas sur
  le baril. Et l'écart avec ExxonMobil est en partie structurel, pas un jugement de marché.
- `weekly/20260907/claims.json` (racine) était un vestige périmé divergeant de `_data/claims.json` :
  supprimé.

## Limites déclarées dans l'article

- Date de publication d'Oracle : source de calendrier unique, non recoupée.
- Mouvement du brut : constaté, non expliqué — pas de source datée établissant la cause.
- Seuil « deux fois le volume » : convention de travail, pas résultat statistique. L'article
  l'applique d'ailleurs à sa propre thèse, qu'il rejette.
- Aucun discriminant n'est proposé pour expliquer ce qui sépare les neuf hausses des trois baisses :
  les deux plus fortes hausses sont des réactions à des résultats, mais sept des neuf n'ont rien
  publié.
