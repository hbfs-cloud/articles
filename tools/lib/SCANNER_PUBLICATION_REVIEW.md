# Publication documentaire du scanner

Ce mode publie une revue de surveillance sans certifier de panier ni recalculer de performance.
Il ne collecte aucune donnée, ne charge aucun client MCP/token et n'envoie aucune notification.

```sh
node tools/gen-status-page.js --publication-only scanner/YYYYMMDD/review.json
node tools/gen-api.js --publication-only scanner/YYYYMMDD/review.json
node --test tools/tests/scanner-publication-review.test.js
```

Aucun autre argument n'est accepté dans ce mode. Les branches quittent les générateurs avant
leurs imports métier, collecte, réconciliation et écritures habituelles. La date du dossier,
la date de revue et l'URL doivent correspondre ; la clôture est la séance US précédente dans
le calendrier local vérifié. Les dates futures sont refusées. Les sources sont des fichiers
locaux relatifs au dépôt dont les SHA256 sont vérifiés ; les counts et la watchlist sont reliés
au fichier public `review-evidence.json` (`product: scanner_surveillance_evidence`).

Contrat `review.json` : schema_version 1, product scanner_surveillance_review,
status review_only, actionability_certified false, orders [], excluded_components ["dtx"].
La watchlist contient seulement ticker et status verification_pending. Les champs supplémentaires
(niveaux d'entrée/stop/cible, quantités, scores, probabilités…) sont refusés. Le nom descriptif
d'une source peut être accompagné d'un `path` relatif ; sans path, name est le chemin vérifié.

## Écritures autorisées

- Statut : `scanner/status/index.html` (bannière française et garde des scripts live non-DTX),
  `scanner/status/publication.json`.
- API : `portfolio/v1/publication.json`, puis `orders.json`, `signals.json`, `all.json`
  de chaque mode non-DTX existant, y compris les alias racine du mode balanced, et les agrégats
  `portfolio/v1/status.json` et `portfolio/v1/modes.json`.
  Les listes courantes orders/signals deviennent vides, status.acceptsNewEntries devient false,
  et publication_review décrit la portée de la suspension. Les autres champs sont inchangés,
  notamment updatedAt/date/scanDate : ce sont les dates des anciennes données, pas celles de la revue.
- Archives des seuls fichiers publics remplacés sous
  `scanner/YYYYMMDD/_publication/archive/{status,api}/<chemin-original>`.
- Manifestes `_publication/{status,api}-manifest.json` : SHA256 avant/après et archives,
  baseline de préservation, date de traitement distincte. Aucun chemin absolu ni capture privée.

Aucun changement de signals.json/data.json historiques du scanner, de data/, de history/,
de dates.json, d'engine-history.json ou des endpoints DTX. Aucun changement des endpoints séparés
positions/trades/equity/actions. Dans all.json, stats/equityCurve/positions/closedTrades/closeNow
et les autres champs historiques restent sémantiquement identiques. Aucune fausse clôture ou
liquidation n'est créée. Le chargement d'un dossier API inconnu contenant ces endpoints échoue.

Les manifestes permettent de rejouer chaque branche sans nouvel effet ; un changement ultérieur
non autorisé des fichiers protégés, d'une archive ou d'une sortie provoque un échec.
Un nouveau document nécessite une revue explicite de la publication existante ; les archives
ne sont jamais remplacées automatiquement.

## Protection des générations normales

`entryGate(root, scanDateCompact, assetClass, now)` vérifie les sidecars contre le review.json
et sa source. Il bloque les nouvelles entrées non-DTX des éditions antérieures ou égales à la
revue. Il protège les deux calculs BUY/ROTATE (HTML et snapshot) de gen-status-page et le calcul
des ordres de gen-api. Une édition ultérieure reste soumise à tous ses contrôles ordinaires ;
DTX reste hors de cette garde. Cette fonction n'est pas une certification et ne modifie aucun ledger.
La génération normale reste une opération plus large que la publication documentaire.

API JS : `validateReview(root, reviewPath, now?)` retourne
`{review, dir, review_path, review_sha256}` ; `publishReview({root,reviewPath,target,now?})`
retourne le manifeste (target = status ou api). Toutes les erreurs sont bloquantes.

## Séquence de publication

1. Construire les éléments publics depuis les captures contrôlées (`build-scanner-review.js`).
   L'adaptateur et le texte du 20260908 sont volontairement datés : nouvelles dates ou valeurs
   exigent une nouvelle revue des événements et du texte. Ne jamais remplacer la date seule.
2. `node tools/render-scanner.js scanner/YYYYMMDD/ --review`. Une revue existante bloque
   le renderer ordinaire pour empêcher le retour accidentel des anciens plans.
3. Panel contrarian, retail et technique ; validation article, contenu et navigateur.
4. Mettre à jour la carte/index avant la capture des manifestes de préservation.
5. Appliquer les deux branches `--publication-only`, puis
   `node tools/validate-scanner-review.js scanner/YYYYMMDD/review.json --publication`.
   Ce contrôle vérifie le rendu exact, les sources et les manifestes sans nouvelle écriture.
   Il ne transforme jamais l'échec du validateur de panier en réussite.
6. Commit/push avec liste explicite des fichiers de publication et outils, sans captures privées,
   tracking, rafraîchissement DTX ou notification ; vérifier le déploiement et les sorties publiques.

Le suivi désactive également Signal Live Tracker, Position MtM, les mises à jour d'actions et
LiveEngine UI dans les panneaux non-DTX gelés. Les panneaux DTX gardent leur comportement.
Les agrégats API status/modes suspendent les permissions et compteurs d'ordres non-DTX ;
les objets DTX restent identiques.
