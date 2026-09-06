# Backlog — état au 2026-09-06

Ce fichier remplace les listes de tâches éparpillées dans les messages. Une ligne = un travail
identifié, avec sa raison et son critère de fin. Pas de « améliorer X » sans dire à quoi on saura
que c'est fait.

---

## 1. Bloquants — le scanner ne publie pas tant qu'ils tiennent

### 1.1 Vérifier que `regime_authority` ramène bien le bloc régime
`plans/scanner-wave1.json` collecte désormais `GetMarketContext(facets=overview, as_of=$refdate)`
en appel **requis**, parce que `overview.regime` porte l'autorité du régime publié depuis le
2026-09-06. L'ancien appel détaché rendait 181 octets vides, et `regime-reconcile` retombait
silencieusement sur `facets=regime` — moteur d'échelle **inverse** — ce qui aurait publié
**100/100 au lieu de 77,2**.
**Fini quand** : un run de vague 1 produit `_data/regime_authority.json` contenant un
`regime_score` ≤ 1, et `node tools/regime-reconcile.js --dir scanner/<date>` affiche
`autorité marketdata (overview.regime)` avec un score proche de 77.

### 1.2 Récupérer 4 `draft_id` Substack perdus
Semaines 2 à 5 du programme `retail-systematic-desk` — publications des 11, 18, 25 septembre et
2 octobre 2026, donc **les plus proches**. Incident documenté `SUBSTACK-RATE-429-001` : les
programmations ont été vérifiées mais les identifiants ont disparu du résultat local quand un lot
ultérieur a renvoyé 429. `list_drafts` ne remonte pas les brouillons programmés.
**Fini quand** : les 4 identifiants figurent dans `remote-receipts.json` et leurs corps révisés
sont écrits via `update_draft`.

### 1.3 Trancher la publication du scan du 8 septembre
La collecte est certifiée sur la clôture du 4 septembre. Un événement géopolitique majeur —
« U.S., Iran Exchange Attacks », 5 septembre 18:22Z — lui est **postérieur**. Publier des niveaux
calculés sur un monde d'avant sans le mentionner reproduirait exactement le « monde d'hier » que
le contrat de date existe pour empêcher.
**Fini quand** : décision prise — publier avec mention explicite de l'événement, ou recalculer
après ouverture des futures dimanche soir.

---

## 2. Grand nettoyage du dépôt

Demandé le 2026-09-06. À traiter dans cet ordre : mesurer d'abord, supprimer ensuite. La règle
projet « ne jamais supprimer sans validation explicite par item » s'applique — donc chaque lot de
suppression se présente en liste avant exécution.

### 2.1 Inventaire du code mort — PRÉALABLE À TOUT
Rien ne se supprime avant d'avoir la liste. `tools/` contient déjà des fossiles visibles :
`_build-scan-20260827.js`, `_build-scan-20260828.js`, `_build-scan-20260831.js`,
`_build-scan-20260901.js`, `_tmp-fix-impact.js`, `fix-scan-20260812.js` — des scripts de
construction à usage unique, datés, jamais rappelés.
**Fini quand** : un rapport liste, pour chaque fichier de `tools/`, ses appelants (skills,
commandes, hooks, autres scripts, CI) et son dernier commit utile. `refactor_tool` du graphe de
code fait ça mieux qu'un grep.

### 2.2 Supprimer les scripts à usage unique confirmés
Après 2.1, et par lots présentés à la validation.
**Fini quand** : `tools/` ne contient plus de script daté sans appelant, et la suite de tests
passe toujours.

### 2.3 Tests — combler le trou le plus dangereux d'abord
Le dépôt a des validateurs solides mais peu de tests unitaires. Priorité aux fonctions dont une
erreur silencieuse a déjà coûté cher :
- `tools/lib/marketdata-bars-contract.js` — certification des clôtures
- `tools/lib/dtx-content-gates.js` — `sessions_behind`, cohérence de contrat V2
- `tools/regime-reconcile.js` — les DEUX échelles, et le refus du repli non-autoritaire
- `tools/signal-outcomes.js` — remplissage, scellement, immutabilité
- `tools/validate-scan.js` — l'énuméré d'échelles fermé
**Fini quand** : `node --test` couvre ces cinq modules, chaque test partant d'un incident réel
de cette session.

### 2.4 Consolider la documentation
État actuel : `CLAUDE.md` racine (13 Ko) + 3 sous-`CLAUDE.md` + `.claude/skills/` + `PRODUCT.md`
+ `DESIGN.md` + `EDITORIAL_STYLE.md` + `SUBSTACK_MCP_PLAN.md` + `docs/`. Le plan Substack décrit
un scaffold Node qui n'existe plus (supprimé le 2026-09-05) alors que la production est en Go
dans un autre dépôt — il est **obsolète et trompeur**.
**Fini quand** : un seul point d'entrée par sujet, aucun document ne décrit un composant disparu,
et les renvois croisés sont vérifiés.

### 2.5 README propre
Il n'y a pas de README racine décrivant ce qu'est ce dépôt, ce qu'il produit, et comment on le
fait tourner. Un nouvel arrivant — humain ou agent — commence par `CLAUDE.md`, qui est un fichier
d'instructions, pas une présentation.
**Fini quand** : `README.md` répond à quoi/pourquoi/comment-lancer en une page, sans dupliquer
`CLAUDE.md`.

### 2.6 ADR — décisions d'architecture
Les décisions structurantes sont enfouies dans des commentaires de code et des fichiers mémoire.
Celles qui méritent un ADR rétroactif, parce qu'elles ont été rediscutées plusieurs fois :
- pourquoi le MCP est l'unique moteur (cut-over dtx, suppression du binaire local)
- la frontière LLM/script et les jetons TTL
- l'autorité du régime, et **pourquoi marketdata a deux moteurs de sens opposé**
- l'immutabilité des trades scellés et la chaîne SHA-256
- le contrat de canal par support (site FR / Substack EN / Telegram FR)
**Fini quand** : `docs/adr/NNNN-titre.md`, format court — contexte, décision, conséquences,
statut — un fichier par décision, référencés depuis le README.

### 2.7 Skills — audit du même défaut que les plans scanner
Les plans du scanner appelaient `RunScreener` sans `timeframe`, ce qui rendait un vivier vide en
`status: completed`. `plans/daily.json`, `aplus-screen.json`, `squeeze.json`,
`signals-desk.json` ont la même forme et n'ont pas été vérifiés.
**Fini quand** : chaque plan appelant un screener déclare son `timeframe` et son `job_max_ms`, et
un test le vérifie pour tous les plans d'un coup.

---

## 3. Suites de la revue du mois

`docs/reviews/scanner-202608.md`. Rien ici ne s'applique sans mesure préalable : n = 85, tous les
IC enjambent zéro.

### 3.1 Laisser tourner l'instrumentation jusqu'à 200 lignes scellées
`tools/signal-outcomes.js` est branché. C'est la condition d'entrée de tout le reste.

### 3.2 Sortir le score de la carte publiée, ou le recalibrer
Corrélation score/rendement ≈ **0 à tous les horizons** (−0,004 à J+3). On publie une hiérarchie
de conviction qui ne discrimine rien. Défaut de conception, indépendant de la significativité.
**Attention** : `sweep.js:285` fait `s.score || 80`. Retirer le champ mettrait les quatre modes
live à zéro candidat. Le retrait est **éditorial**, pas structurel.

### 3.3 Décider du sort de Breakout
−0,220R sur 22 lignes, 55 % de stops, 23 entrées sur 25 au-dessus de la clôture de référence.
Bloqué par `Config Change Backtest` : 30 jours de backtest obligatoires, et le pool est consommé
par les modes.

### 3.4 Resserrer `overextension`, tester le time-stop J+3
RSI > 65 → −0,128R ; ATR > 4 % → −0,117R. Le time-stop J+3 est la seule variante de sortie non
dégradante. À valider en régime-aware via `validate-config-change.js`.

---

## 4. Dette signalée au propriétaire marketdata

`docs/briefs/marketdata-daily-screener-timeout.md`. Corrigé pendant la session : le timeout du
screening journalier. Restent ouverts :
- `RunAutoScreener` toujours cassé (timeout 5 min) — contourné par une bascule sur `RunScreener`
- bornage d'univers non déclaré (5 501 sur 22 276 balayés, sans critère exposé)
- faux-vert de fraîcheur : `bars_daily_us_equity.status: ready` avec la clôture certifiée pendant
  que `bars_daily_universe` est à 0 % et 0 symbole chargé
- pas de `restarting_since` : un redémarrage se lit comme une panne

---

## 5. Principe d'architecture — la logique déterministe sort des `.md`

Posé le 2026-09-06, sur preuve. Un `.md` décrit un WORKFLOW et le jugement qu'on attend d'un
LLM. Il ne contient aucune règle qu'une machine devrait faire respecter. Toute règle
déterministe — seuil, plafond, contrôle de cohérence, ordre d'étapes — vit dans un script qui
échoue quand elle est violée.

### Ce qui a rendu ce principe non négociable

Le scan du 2026-09-08 a été bâti en respectant scrupuleusement `CLAUDE.md`, `scanner/CLAUDE.md`
et `data/scanner-filters.json`. Il échouait quand même son gate bloquant avec **155 constats**.
Raison : **neuf règles déclarées exécutables n'étaient implémentées nulle part.**

- Le plafond sectoriel `max_per_sector: 3` lisait `pick.sector`, un champ de texte libre écrit
  par l'agent dans le manifeste. Le plafond était donc **auto-déclaré** : il suffisait
  d'étiqueter un fonds « ETF-Commodity » plutôt que « Energy » pour loger une quatrième ligne
  énergie sans que rien ne s'en aperçoive.
- `audit_gates.recent_strategy_performance` et l'overlay immuable
  `data/scanner-strategy-overlays.json` n'étaient évalués par aucun code : le panier est parti
  à **80% Momentum** contre 40% autorisés sur preuve mature (PF 0,59, R moyen −0,243).
- `max_distance_200dma_pct`, `min_consolidation_bars`, `allowed_regions`,
  `tickers.min_market_cap_usd`, `min_avg_daily_volume_usd` : déclarés, jamais lus.
- `estimated_valid_bars`, le champ par lequel le screener dit combien de séances de validité il
  accorde encore à sa propre détection : **lu par aucune porte**. Trois signaux périmés sont
  entrés dans la sélection.
- Les screeners tournaient sans borne de capitalisation alors que `CLAUDE.md` l'impose en
  toutes lettres. Résultat : `market_cap: 0` partout, et une porte de capitalisation
  structurellement invérifiable.

Aucun de ces défauts n'était une négligence de rédaction. Ils existaient parce que **la règle
était écrite là où rien ne l'exécute**.

### La forme cible

| Ce qui va où | Contenu |
|---|---|
| `.md` (skill, commande) | l'enchaînement des étapes, les décisions qui demandent du jugement, ce qu'il faut regarder et pourquoi, les pièges déjà rencontrés |
| `.json` (config) | les VALEURS des seuils, versionnées, avec la preuve qui les justifie |
| `.js` (script) | la LECTURE de ces valeurs et l'échec quand elles sont violées |

`tools/build-scan.js` est le premier exemple abouti : il lit `data/scanner-filters.json`, applique
les portes, et refuse d'écrire `signals.json` tant qu'une reste ouverte. Le manifeste éditorial
`_selection.json` ne porte plus que le jugement — quels tickers, quelle thèse — et ne peut plus
contourner une règle, puisque le secteur vient désormais de `sector_map` et non du manifeste.

### 5.1 Auditer les autres commandes sur ce critère
`/daily`, `/weekly`, `/analyse`, `/aplus`, `/retro`, `/series`, `/desk` : pour chacune, lister
les règles déterministes qui ne vivent aujourd'hui que dans un `.md`, et les déplacer.
**Fini quand** : chaque règle chiffrée d'un `.md` de commande est soit dans un script qui la fait
échouer, soit explicitement marquée comme relevant du jugement.

### 5.2 Un test qui interdit la régression
**Fini quand** : un test parcourt `data/scanner-filters.json` (et ses équivalents) et échoue si
une clé de seuil n'est référencée par aucun script — le symétrique de la détection de code mort,
appliqué à la config morte.

### 5.3 Toujours inspecter l'artefact RENDU, jamais seulement le JSON
Le 2026-09-06, `validate-scan`, `qa-content`, `check-ai-tells` et les portes qualité passaient
tous, sur une page qui affichait « allocation recommandée au panier complet : 0% », trois
politiques d'entrée contradictoires, un « R/R exact 1:0,71 pour toutes les lignes » démenti par
le tableau juste au-dessus, et un titre de section « semaine du Séance du mardi 8 septembre ».
Tout venait du gabarit du renderer, qu'aucun contrôle ne confrontait au contenu.
**Fini quand** : un contrôle compare les affirmations du gabarit aux données (politique d'entrée,
R/R, dimensionnement, légendes conditionnelles) et échoue en cas de contradiction.

## 6. Les preuves d'un article publié dépendent d'un fichier de plan mutable

`validate-content-claims.js` délègue la provenance à `validateCollectedArtifact`, qui relit
`plans/<plan>.json` **sur le disque courant** et compare son empreinte à celle enregistrée dans le
journal de collecte :

```js
const planPath = path.resolve(root, journal.plan || '');
if (... sha256(fs.readFileSync(planPath)) !== journal.plan_sha256) errors.push('plan file hash mismatch');
```

Conséquence mesurée le 2026-09-06. `plans/weekly-focus.json` a été modifié ce jour-là (profondeur
de `blast_bars` ramenée de 120 à 90 séances, parce que douze symboles sur 120 séances dépassaient
la limite de la tâche asynchrone et faisaient échouer l'appel entier). Cette modification, qui ne
touche aucune donnée déjà collectée, a rendu **invalides les 72 preuves de `weekly/20260831/`,
article publié depuis une semaine** :

```
$ node tools/validate-content-claims.js weekly/20260831/_data/claims.json
[content-claims] FAIL
  - avgo_price: source collector provenance invalid: plan file hash mismatch
  ... (72 fois)
```

Rien n'a bougé dans l'article ni dans ses artefacts. Le contrôle échoue parce qu'un fichier
*voisin*, qui décrit comment on collecte **aujourd'hui**, a changé.

C'est un défaut de conception, pas un incident : il rend le corpus publié fragile à toute
évolution de la collecte, et il pousse à ne plus jamais toucher aux plans — c'est-à-dire à figer
l'outillage pour préserver l'apparence de vérifiabilité de l'historique. L'incitation est
exactement inversée.

### Ce que la vérification devrait établir

Qu'à l'instant de la collecte, l'artefact a bien été produit par le plan déclaré. Le journal
contient déjà tout ce qu'il faut : `journal.plan_sha256` ET `journal.resolved_input`, qui est
l'expansion complète du plan pour ce run. Comparer le journal à lui-même suffit à établir la
cohérence interne ; relire le fichier courant n'ajoute aucune garantie et introduit une dépendance
au futur.

### Piste

Verrouiller le plan **au moment de la collecte** plutôt qu'au moment du contrôle : archiver le
contenu du plan résolu à côté des artefacts (`_data/plan.snapshot.json`) et faire porter la
comparaison sur cet instantané. Le fichier vivant de `plans/` peut alors évoluer sans réécrire le
passé, et un article ancien reste vérifiable exactement tel qu'il a été produit.

À traiter avec §5 : c'est le même principe, appliqué à la preuve plutôt qu'à la logique — ce qui
est figé doit l'être *dans* l'artefact, pas dans un fichier qu'on continue d'éditer.

## 7. Inventaire du code à usage unique remplacé (suppression à valider par item)

Le principe du §5 a produit deux constructeurs génériques — `tools/build-scan.js` (2026-09-05) et
`tools/build-weekly.js` (2026-09-06). Ils rendent caduc l'essentiel des scripts datés ci-dessous.

**Rien n'est supprimé ici.** La règle du dépôt interdit de retirer un fichier sans validation
explicite, item par item. Cette liste existe pour rendre cette validation possible en une passe,
avec ce qu'il faut vérifier avant chaque suppression.

| Fichier | Taille | Remplacé par | À vérifier avant suppression |
|---|---|---|---|
| `tools/_build-scan-20260827.js` | 16 K | `tools/build-scan.js` | Le scan du 27/08 est publié et figé ; le script ne sert plus qu'à le rejouer. |
| `tools/_build-scan-20260828.js` | 16 K | idem | idem |
| `tools/_build-scan-20260831.js` | 28 K | idem | idem |
| `tools/_build-scan-20260901.js` | 28 K | idem | idem |
| `tools/_tmp-fix-impact.js` | 8 K | — | Correctif ponctuel du 12/08, jamais rejoué depuis. Vérifier qu'aucun plan ne l'appelle. |
| `tools/_supp-enrich-20260908.js` | 16 K | — | Enrichissement supplétif du scan 20260908. À conserver tant que le chemin agent→staging n'est pas généralisé (cf. §5.1). |
| `tools/_supp-enrich-20260908.bars.js` | 24 K | — | idem |
| `tools/_weekly-blast-20260907.js` | 12 K | la collecte scindée (§8) | **Caduc depuis le 2026-09-06** : `blast_bars_a`/`blast_bars_b` passent et sont certifiés, ce palliatif n'a plus d'objet. Jamais versionné — il ne reste que dans les copies de travail. |
| `weekly/20260831/_build.cjs` | 60 K | `tools/build-weekly.js` | **Attention** : ce fichier documente comment l'article publié a été produit. Le supprimer efface la traçabilité d'un article en ligne. Archiver plutôt que supprimer. |
| `daily/20260830/_build.cjs` | 44 K | (aucun équivalent générique) | Un `tools/build-daily.js` reste à écrire. Ne pas supprimer avant. |
| `daily/volume-evolution-now/_build.cjs` | 24 K | — | Page hors-série. Vérifier si elle est encore liée depuis l'index. |
| `analyses/AVGO/_build.cjs` | 4 K | — | idem, analyse datée. |

Total concerné : environ 172 Ko de code, dont **88 Ko sans aucun successeur générique**
(`daily/*/_build.cjs`) — ce qui indique la prochaine pièce à écrire : `tools/build-daily.js`, sur
le même patron que les deux autres.

### Ordre recommandé

1. Écrire `tools/build-daily.js` (le daily est le format le plus fréquent, donc le plus coûteux à
   maintenir en copier-coller).
2. Archiver les `_build.cjs` d'articles publiés sous `archive/builders/` plutôt que les effacer.
3. Supprimer les quatre `_build-scan-*.js`, dont le successeur est en service et éprouvé.
4. Statuer sur les supplétifs `_supp-enrich-*` une fois le §5.1 traité. Le supplétif `_weekly-blast-*` est déjà caduc.

## 8. `blast_bars` et `focus_correlation` expirent côté serveur

Trois exécutions du 2026-09-06, toutes soldées par `Job … non terminé après 900000ms` sur ces deux
appels seulement, tandis que les cinq autres du même plan répondent en moins de 100 ms.

Observation qui isole la cause : ces deux appels étaient les **seuls** à combiner `adjusted: true`
et `days: N`. Réduire la profondeur de 120 à 90 séances n'a rien changé — la taille n'est donc pas
en cause. `focus_bars`, même outil, huit symboles, `limit: 120` sans `adjusted`, répond en 73 ms.

Les deux appels ont été alignés sur cette forme (`limit: 120`, sans `adjusted`, sans `days`).

**Résultat, mesuré.** `focus_correlation` (huit symboles) est passé de « expire à 900 s » à **76 ms** et
est désormais certifié. `blast_bars` (douze symboles) continue d'expirer. La cause n'est donc pas la
forme de l'appel — corrigée et vérifiée — mais le **nombre de symboles** : le seuil est quelque part
entre huit et douze pour ce type de tâche. Un troisième essai a d'ailleurs échoué en `HTTP 429`,
c'est-à-dire un refus de débit, ce qui suggère que la tâche consomme le quota en boucle plutôt que
d'aboutir.

**Contournement retenu pour l'hebdo du 7 septembre** : la chaîne d'infrastructure est publiée sur les
six titres couverts par `focus_bars` (huit symboles, certifié) au lieu de douze, et la limitation est
écrite dans la section « Méthode et limites » de l'article. Six lignes prouvées valent mieux que douze
dont la moitié ne l'est pas.

**Piste pour le prochain hebdo** : scinder `blast_bars` en deux appels de six symboles, ou verser les
noms de la chaîne dans `focus_symbols` — qui fonctionne à huit et qu'il faudrait tester à douze pour
situer le seuil précisément.

À signaler au propriétaire marketdata avec §4. Contournement en attendant : le chemin
agent→staging (`tools/_weekly-blast-20260907.js`), qui produit les mêmes barres mais **sans
certification de collecte** — donc inutilisable pour un chiffre publié sous contrôle de preuves.
C'est exactement le coût de ce blocage : il ne dégrade pas la donnée, il dégrade la *preuve*.

## 9. Ce qui reste ouvert sur le contrôle de preuves (revue Dev du 2026-09-06)

Une revue de code adversariale a produit **douze contournements exécutés** contre
`validate-content-claims.js`, chacun avec sa preuve de concept. Neuf sont fermés (voir
`docs/reviews/weekly-20260907-methode.md` et les tests de `tools/test-content-claims.js`, qui
couvrent désormais chaque brèche). Trois restent, avec leur raison.

### 9.1 Les nombres écrits en toutes lettres échappent au détecteur — et la page les utilise

`hasNumber` a été élargi aux chiffres Unicode (`٤٢`, `４２`, `½`, `²⁵` passaient). Mais
« quatre points », « dix-huit pour cent » restent invisibles.

Ce n'est pas théorique. `weekly/20260907/_editorial.json` contient « Couvre les **deux**
rendez-vous de la semaine » et « le calme des **neuf** prochains jours » — deux affirmations
chiffrées, écrites à la main, non liées. Et `tools/build-weekly.js` institutionnalise la pratique
via `mot()`, qui rend les comptages en lettres précisément parce qu'un chiffre non lié serait
refusé.

La différence entre les deux cas est réelle : `mot()` **calcule** son comptage à partir de la
donnée, donc il ne peut pas diverger ; une tournure saisie dans le manifeste le peut. Mais le
contrôle ne sait pas les distinguer.

**Piste** : un lexique français (`un`…`vingt`, `cent`, `mille`, `pour cent`) appliqué au texte
issu du manifeste uniquement, et un `data-claim` avec un rendu « en lettres » pour les comptages
dérivés. Le risque à surveiller est le faux positif : « un » est aussi un article.

### 9.2 Soixante-seize journaux de collecte ne peuvent plus être vérifiés

Inventaire au 2026-09-06 :

| forme de `resolved_input` | nombre | verdict |
|---|---|---|
| complète, écrite après le correctif de `collect.js` | 2 | vérifiable |
| complète, écrite **avant** le correctif | 3 | **échec permanent** |
| forme à trois clés (`agent-collect-ingest.js`, `ingest-collection.js`) | 7 | vérifiable |
| **absente** (outillage plus ancien) | **76** | **échec permanent** |

Les trois artefacts en échec appartiennent à `scanner/20260908`, **déjà publié** (commit
`afd1c2ad8`). Leur provenance est désormais invérifiable, non parce que la donnée est douteuse mais
parce que l'empreinte stockée l'a été sous l'ancienne forme.

C'est le même piège qu'au §6 : laisser en l'état reproduit exactement le défaut que le correctif
dénonce — un contrôle qu'aucune donnée honnête ne peut satisfaire.

**Trois options, à trancher** : (a) re-collecter, coûteux et impossible pour les dates passées ;
(b) un script de remédiation qui recalcule `input_sha256` depuis le `resolved_input` existant, en
consignant l'opération dans le journal lui-même ; (c) une clause de compatibilité **datée** dans
`validateCollectedArtifact` : avant telle date, l'absence de `resolved_input` n'est pas une erreur.
La (b) est préférable — elle rend l'historique vérifiable au lieu de l'exempter.

### 9.3 Trois écritures indépendantes de la même structure

`collect.js`, `agent-collect-ingest.js` et `ingest-collection.js` construisent chacun leur
`resolved_input`, avec des formes différentes. C'est la cause racine du bug corrigé aujourd'hui, et
elle est toujours là. **Piste** : une fonction unique `buildResolvedInput()` dans
`tools/lib/workflow-contract.js` rendant `{ resolvedInput, inputSha256 }`, employée par les trois.

### 9.4 Deux défauts mineurs du constructeur, non déclenchés aujourd'hui

- `renderFrenchDate` ne lit que le préfixe `YYYY-MM-DD` et **ignore le décalage horaire**, alors que
  le tri du calendrier se fait sur l'instant réel. Un événement Asie-Pacifique
  (`2026-09-11T02:00+09:00`, soit le 10 à 17 h UTC) serait trié avant un événement américain du 10
  tout en s'affichant « 11 septembre ». La page du 07/09 est indemne : elle ne contient que des
  décalages `+02:00` et `-04:00`. **Piste** : convertir vers Europe/Paris avant de rendre, et trier
  sur la même grandeur.
- `man.tables.indices` est un tableau nu, donc dans un ordre saisi à la main — ce que le commentaire
  du fichier condamne par ailleurs. **Piste** : rendre `sort` obligatoire, ou exiger un
  `order: "declared"` explicite pour que le choix soit lisible plutôt que tacite.

### 9.5 Échec de test antérieur et sans rapport

`tools/test-series-ux.js` échoue sur `tech/track-record/index.html` (« runtime is missing or not
cache-busted »). Aucun fichier de `tech/` n'est touché par les travaux du jour. À traiter avec le
nettoyage du §7.

## 10. Contenu evergreen : le chiffre qui dérive

Constat du 2026-09-07, en enrichissant les 129 épisodes programmés jusqu'en avril 2028.

`audit-episode-claims.js` classe 112 phrases en « agrégat sans étude citée ». La lecture de
l'inventaire montre que l'étiquette recouvre **deux problèmes distincts**, qui n'appellent pas le
même remède — et que le second est le plus grave.

**(a) La statistique de population réellement inventée.** « 85 % des week-ends laissent un écart de
2,3 % », « en moyenne 0,35 % pour le tracker S&P » : aucune des sources pédagogiques SEC, OCC ou
CFTC citées ne publie ces chiffres. Remède : sourcer, calculer soi-même, ou couper le nombre en
gardant l'affirmation qualitative.

**(b) Le fait de fonds qui dérive, présenté comme fixe.** « SPY charges 0.09% a year, VOO charges
0.03% », « QQQ's ten largest holdings make up about 52% », « technology near 30%, financials 13% ».
Ces chiffres sont vérifiables et probablement justes à la rédaction. Le défaut n'est pas la source :
c'est que **l'épisode sera lu en 2028**. Des frais, une concentration d'indice, un poids sectoriel
et un recouvrement entre deux fonds bougent tous. Publier « QQQ's top ten are about 52% » sans date
revient à affirmer en avril 2028 quelque chose qui n'aura pas été mesuré depuis deux ans.

Certains épisodes le font déjà bien — « By 2025 the ten largest companies were roughly 37% » porte
sa date et reste vrai quel que soit le jour de lecture. C'est la forme à généraliser.

**Remède retenu** : dater le chiffre plutôt que le supprimer. La correction n'introduit aucun nombre
nouveau, donc elle passe le garde-fou de `lib/episode-illustration.js`, et elle rend la phrase
honnête à n'importe quelle date de lecture.

**Portée** : etf-toolkit 21, gap-risk-survival 19, correlation-and-seasonality 12, bonds-and-rates
10, high-beta-proxies 10, central-bank-playbook 9, economic-calendar 8, puis six séries à 5 ou
moins. `retail-systematic-desk` (45 épisodes) et `market-checklist` sont quasi indemnes.

**Piste d'outillage** : `audit-episode-claims.js` gagnerait une classe `drifting` — un nombre
attaché à un ticker ou à un indice nommé, sans millésime dans la phrase. C'est mécaniquement
détectable, et c'est ce qui distingue (b) de (a).
