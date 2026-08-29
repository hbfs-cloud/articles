<!-- workflow-contract: retro -->
# /retro - Retrospective point-in-time du scanner

Mesure toutes les propositions publiees dans la plage demandee. Une retrospective de trois semaines
porte sur chaque scan et chaque ligne de ces semaines, pas sur quelques tickers choisis apres coup.
Les nouvelles donnees suivent `.claude/skills/source-policy.md`; les artefacts historiques restent la
source point-in-time de la decision originale.

## Fixer La Cohorte

1. Resoudre `from` et `to` en dates de session explicites.
2. Enumerer les dossiers scanner dans cette plage depuis le disque/index, puis lire leur
   `signals.json` ou source structuree canonique.
3. Conserver toutes les propositions: remplies, non remplies, ouvertes, expirees et invalides.
4. Enregistrer avant calcul: nombre de scans, propositions par jour, tickers uniques, horizon publie,
   strategie et regime publie a l'epoque.
5. Refuser un rapport dont le denominateur ne se reconcilie pas avec les artefacts sources.

La date de regime vient du scan point-in-time. Un modele de regime recalcule aujourd'hui ne remplace pas
ce que la selection connaissait alors.

## Collecte Par Lot

Pour chaque lot de 1 a 60 symboles et chaque fenetre complete:

```bash
node tools/validate-workflows.js --workflow retro
bash tools/run-collect.sh retro scanner/SCANDATE/retro/_data \
  --var scandate=SCANDATE --var startdate=YYYY-MM-DD \
  --var refdate=YYYY-MM-DD --var symbols=A,B,C
```

Apres chaque lot, normaliser et fusionner les barres collectees vers l'unique entree gouvernante:

```bash
node tools/build-intraday-retro-input.js \
  --in scanner/SCANDATE/retro/_data/bars_intraday.json \
  --out scanner/retrospective/REFDATE/_data/intraday-bars-15m.json \
  --reference-close YYYY-MM-DD --append
```

Le calcul refuse toute session qui n'a pas exactement les 26 timestamps 15 minutes RTH, de 09:30 a
15:45 America/New_York, avec timezone explicite, sans doublon ni trou.

`startdate` couvre la premiere session d'execution possible; `refdate` couvre la derniere session
de l'horizon publie, calculee en seances. Le plan collecte enveloppe daily, ordre des evenements en 15
minutes, benchmarks, SEC, evenements et insiders. Les lots utilisent le chemin async/pagine.
Le preflight historique exige que le service couvre au moins `refdate`; il n'exige pas que la derniere
date globale du service soit egale a cette ancienne cloture. Les requetes restent bornees exactement et
le harnais refuse toute barre posterieure.

`tools/build-mono-retro.js` est un outil daily forensic archive et refuse l'execution normale. Il ne
peut jamais produire la retro active ni une note de performance gouvernante.

## Simulation

- Appliquer exactement entry zone, side, stop, TP1/TP2, horizon, session et regles publiees.
- Les barres daily ne prouvent jamais l'ordre entry/stop/target.
- Une barre 15 min qui contient plusieurs evenements incompatibles est
  `ambiguous_intrabar`. Collecter une granularite plus fine si disponible; sinon ne pas inventer
  l'ordre et ne pas classer le trade comme gain.
- Un partial/no-fill reste distinct d'un trade resolu.
- Les splits/actions corporate sont ajustes avant comparaison d'echelle.
- Les propositions dont l'horizon n'est pas termine restent `open/unresolved`; elles ne rentrent pas
  dans hit rate, profit factor ou moyenne R.
- Recalculer R depuis les niveaux originaux, jamais depuis le texte.

## Denominateurs Et Diagnostics

Publier separement:

- toutes les propositions horizon-complete;
- fills resolus;
- no-fill;
- ambigus;
- ouverts/non matures;
- resultat par famille, regime, secteur, semaine et repeat/new name;
- hit rate, moyenne/mediane R, profit factor, drawdown et dependance aux meilleurs trades;
- sensibilite US stock, US ETF et panier combine;
- comparaison SPY/QQQ/IWM sur la meme fenetre.

Une note globale D ne suffit pas: expliquer si le defaut vient de selection, entree non remplie, target
hors portee, concentration, evenement/SEC manque ou degradation de famille. Toute policy/overlay issue
de la retro porte le chemin et SHA-256 exacts de cette evidence, un cutoff, un minimum d'echantillon et
une date de reexamen.

## Revue

Executer les gates de fraicheur/run, puis:

- Senior QA: reconciliation des denominateurs, math et immutabilite.
- Contrarian: lookahead, survivorship, event-order ambiguity, winner dependency et affirmation causale.
- Retail war room: comparaison avec ce qu'un lecteur pouvait reellement remplir, spread/gap/no-chase.

Zero blocker est requis. Une revue qui ne trouve aucun risque methodologique doit l'expliquer.

## Publication

La sortie par defaut est locale. `--publish` doit etre present ou l'utilisateur doit avoir demande
explicitement publication/push dans le message courant. Alors seulement conserver les artefacts
historiques, publier dans un nouveau chemin, stager explicitement, commit/push apres QA, puis notifier
avec plage exacte, taille de cohorte, verdict et principal correctif.
