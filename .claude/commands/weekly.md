<!-- workflow-contract: weekly -->
# /weekly - Revue de la semaine a venir

Produit `weekly/YYYYMMDD/index.html` selon `weekly/CLAUDE.md`,
`.claude/skills/source-policy.md` et le layout du dernier weekly valide.

## Contrat De Date

- `date`: lundi de la semaine couverte, format `YYYYMMDD`.
- `refdate`: derniere cloture US terminee avant la redaction.
- `focus_symbols`: 1 a 8 noms issus du run courant.

Une page datee d'un lundi passe qui pretend couvrir la semaine a venir est un bug. Verifier le calendrier
NYSE et l'anti-doublon avant toute collecte.

## Collecte

```bash
node tools/validate-workflows.js --workflow weekly
bash tools/run-collect.sh weekly weekly/YYYYMMDD/_data \
  --var date=YYYYMMDD --var refdate=YYYY-MM-DD
```

Classer les noms du snapshot par score source puis ticker et persister `_data/selection.json`. Ne lancer
le plan focus qu'apres cette decision immutable:

```bash
bash tools/run-collect.sh weekly-focus weekly/YYYYMMDD/_focus \
  --var date=YYYYMMDD --var refdate=YYYY-MM-DD --var focus_symbols=A,B,C
```

Le socle fournit les clotures cross-asset/sectorielles, regimes, correlations, options, short interest,
earnings et calendrier macro. Les noms du dossier sont selectionnes seulement apres lecture du socle,
puis enrichis par le plan focus. Le contexte optionnel ne gouverne aucun chiffre.

Les jetons TTL restent masques. Aucun appel MCP manuel ne remplace un fichier absent du plan.

## Methode

1. Mesurer la semaine ecoulee avec les barres bornees au `refdate`; ne jamais etiqueter un prix live
   comme cloture.
2. Classer les focus names avec une decision tracee et un tie-break ticker stable.
3. Pour chaque nom, verifier structure, earnings, SEC/actions corporate, flux et attribution du mouvement
   sur la meme fenetre que les pairs.
4. Separer fait observe, evenement date de la semaine a venir, scenario, probabilite qualitative et niveau
   d'invalidation.
5. Utiliser les statistiques de strategie avec leur provenance exacte. Une courbe DtxReplay reconstruite
   n'est pas une courbe de livre `DtxBookEquity`.
6. Le web est reserve aux sources SEC/IR, calendriers officiels et news attribuees. Aucun chiffre de marche
   MCP manquant n'est remplace par une page web.

## Redaction

Le weekly explique une bascule principale et son scenario contraire. Il couvre indices, secteurs,
taux/commodities, metaux, crypto, catalyseurs d'entreprise et calendrier. La densite vient des faits,
tableaux et niveaux; aucun seuil de taille de fichier ne justifie de dupliquer ou rembourrer la prose.

## Gates

```bash
node tools/check-freshness.js weekly/YYYYMMDD/_data/harness.json
node tools/check-freshness.js weekly/YYYYMMDD/_focus/harness.json
node tools/validate-workflows.js --run-plan plans/weekly.json weekly/YYYYMMDD/_data
node tools/validate-workflows.js --run-plan plans/weekly-focus.json weekly/YYYYMMDD/_focus
node tools/validate-content-claims.js weekly/YYYYMMDD/_data/claims.json
node tools/qa-content.js weekly/YYYYMMDD/index.html --strict
node tools/check-ai-tells.js weekly/YYYYMMDD/index.html --strict
node tools/validate-content-hierarchy.js weekly/YYYYMMDD/index.html
```

Faire ensuite, sur le meme snapshot hache, une Senior QA, une revue contrarian et une retail war room.
Les reviewers ne refetchent pas chacun leur version du marche. Zero blocker est requis; toute correction
fait rejouer les checks affectes.

## Publication

La sortie par defaut est locale. `--publish` doit etre present ou l'utilisateur doit avoir demande
explicitement publication/push dans le message courant. Alors seulement indexer une fois, verifier les
fichiers stages, commit/push apres les gates, puis notifier Telegram en francais avec une synthese
autosuffisante et le lien. Substack/email reste une autorisation distincte.
