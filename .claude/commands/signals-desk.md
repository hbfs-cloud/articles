<!-- workflow-contract: signals-desk -->
# /signals-desk - Idees du jour verifiees

Produit zero a cinq idees publiques US stock. Ce workflow ne lit ni positions, ni comptes, ni ordres
broker. Il suit `.claude/skills/signals-desk.md` et `.claude/skills/source-policy.md`.

## Collecte

```bash
node tools/validate-workflows.js --workflow signals-desk
bash tools/run-collect.sh signals-desk data/workflow-runs/signals-desk/YYYYMMDD/candidates \
  --var date=YYYYMMDD --var refdate=YYYY-MM-DD
```

Trier le vivier par score source, famille puis ticker, persister `selection.json`, puis seulement
verifier zero a cinq noms. Un vivier vide produit `no_setup` sans appel verify.

```bash
bash tools/run-collect.sh signals-desk-verify data/workflow-runs/signals-desk/YYYYMMDD/verify \
  --var date=YYYYMMDD --var refdate=YYYY-MM-DD --var symbols=A,B,C
```

Le premier plan produit regime, benchmarks, deux screeners US, macro et earnings. Choisir au plus cinq
noms en journalisant score source, famille et motif. Le second plan collecte barres, techniques, SEC,
evenements, flux, signaux mono-symbole et correlation. Les lots lourds passent par le chemin async
paginate teste.

## Payload

Ecrire `ideas.json` avec `status: ready|no_setup`, `reference_close`, `ideas[]` et `evidence`.
Chaque idee comporte au minimum ticker, famille, side, spot, entree, stop, TP1, ATR14, R/R, data date,
distance earnings, statut SEC et source IDs.

Le manifeste evidence lie bars, techniques, calendrier, SEC, flux et correlation aux fichiers et
SHA-256 certifies par les harnais. En `no_setup`, screen et regime restent requis.

```bash
node tools/validate-trade-ideas.js data/workflow-runs/signals-desk/YYYYMMDD/ideas.json
```

Le gate impose notamment:

- entree a <=3% du spot;
- stop a >=1.5 ATR;
- TP1 a <=3 ATR et R/R recalcule >=1.5;
- au moins quatre seances avant earnings;
- SEC `clear|not_applicable` verifie entre refdate et aujourd'hui;
- correlation paire <=0.70;
- si trois idees ou plus, aucune famille >60%.

Une idee qui echoue devient un rejet journalise, pas un niveau modifie par le modele.

## Revue Et Digest

Les trois reviewers lisent le meme snapshot hache:

- Senior QA: schema, calcul, provenance et ledger.
- Contrarian: catalyseur, dilution, crowded trade, cible hors portee.
- Retail war room: gap, liquidite/slippage, no-chase et invalidation simple.

Apres zero blocker, produire un digest Telegram HTML concis mais autosuffisant: contexte, pour chaque
idee entree/stop/TP1/invalidation, puis principal risque. Aucun jargon interne. `no_setup` produit un
message explicite sans inventer de ligne.

Avant envoi, executer `node tools/signal-alerts.js --pending`; publier uniquement les evenements encore
non notifies, puis les marquer apres succes. Append au ledger seulement apres validation et reconcile
avec le contenu effectivement envoye.

## Effets Externes

`dry-run` interdit post, indexation, commit et push. Une invocation qui autorise le post envoie Telegram
seulement apres les gates. Substack/email n'est jamais implicite.
