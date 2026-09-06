<!-- workflow-contract: weekly -->
# /weekly - Revue de la semaine a venir

Produit `weekly/YYYYMMDD/index.html` selon `weekly/CLAUDE.md`,
`.claude/skills/source-policy.md` et le layout du dernier weekly valide.

## Contrat De Date

- `date`: lundi de la semaine couverte, format `YYYYMMDD`.
- `refdate`: derniere cloture US terminee avant la redaction.
- `focus_symbols`: 1 a 8 noms issus du run courant.
- `event_leader`: catalyseur systémique principal, persisté dans la sélection éditoriale.
- `blast_symbols_a` et `blast_symbols_b`: le panier de propagation, scindé en DEUX lots d'au plus six
  noms. 4 a 16 liens économiques documentés autour du catalyseur, répartis entre les deux lots.
  La scission n'est pas cosmétique : un appel de douze symboles expire côté serveur (mesuré quatre
  fois le 2026-09-06, 900 s à chaque tentative), là où huit passent en 73 ms. Un lot unique trop
  large ne dégrade pas la donnée, il rend la propagation NON CERTIFIÉE — et un tableau tronqué
  fabrique la conclusion qu'il illustre.

Une page datee d'un lundi passe qui pretend couvrir la semaine a venir est un bug. Verifier le calendrier
NYSE et l'anti-doublon avant toute collecte.

## Collecte

```bash
node tools/validate-workflows.js --workflow weekly
bash tools/run-collect.sh weekly weekly/YYYYMMDD/_data \
  --var date=YYYYMMDD --var refdate=YYYY-MM-DD
```

Classer les noms du snapshot par score source puis ticker et persister `_data/selection.json`. Fusionner
le calendrier filtré et `earnings_systemic`: une mégacapitalisation ne peut jamais être éliminée parce que
son échéance options est absente, antérieure à l'événement ou mal formée. Documenter séparément les
catalyseurs obligatoires, le classement quantitatif et le panier économique du rayon de propagation. Ne
lancer le plan focus qu'apres cette decision immutable:

```bash
bash tools/run-collect.sh weekly-focus weekly/YYYYMMDD/_focus \
  --var date=YYYYMMDD --var refdate=YYYY-MM-DD --var focus_symbols=A,B,C \
  --var blast_symbols_a=D,E,F --var blast_symbols_b=G,H,I
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

Le rendu doit conserver le standard visuel des Weekly riches: synthèse hiérarchisée puis 6 ECharts
décisionnels minimum lorsque les données existent (multi-actifs, calendrier, earnings/blast radius,
rotation, risques et allocation). Chaque graphique porte une interprétation et une invalidation; une
collection de tableaux ou de paragraphes sans visualisation constitue une régression de publication.

## Gates

```bash
node tools/check-freshness.js weekly/YYYYMMDD/_data/harness.json
node tools/check-freshness.js weekly/YYYYMMDD/_focus/harness.json
node tools/validate-workflows.js --run-plan plans/weekly.json weekly/YYYYMMDD/_data
node tools/validate-workflows.js --run-plan plans/weekly-focus.json weekly/YYYYMMDD/_focus
node tools/validate-content-claims.js weekly/YYYYMMDD/_data/claims.json
node tools/validate-horizon-risk.js weekly/YYYYMMDD/   # tolère l'absence de signals.json
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

## Substack — exploiter le connecteur, pas seulement écrire

Un Substack en texte seul, quand l'article web porte huit graphiques, est un livrable amputé. Deux
capacités sont confirmées sur le déploiement courant, une ne l'est pas :

| Capacité | État | Comment |
|---|---|---|
| Tableaux Markdown | **OK** | Rendus en PNG sur le CDN Substack (`table_format: image`, défaut). **Ne pas mettre de `**gras**` dans une cellule** : les astérisques s'affichent tels quels. |
| Images | **OK** | `upload_image(source_url=…)` en pointant sur `raw.githubusercontent.com/<repo>/main/<chemin>` après un push. Évite de faire transiter du base64. |
| Bloc `::chart {json}` | **NON** | Testé le 2026-09-06 en forme « labels/datasets » ET en option ECharts : les deux retombent en `code_block`. Ne pas s'y fier. |

Procédure pour les graphiques :

```bash
node tools/render-charts-png.js --article weekly/YYYYMMDD/index.html --out weekly/YYYYMMDD/_img
node tools/render-charts-png.js --article weekly/YYYYMMDD/index.html \
     --out weekly/YYYYMMDD/_img/en --labels weekly/YYYYMMDD/_img/labels-en.json
git add weekly/YYYYMMDD/_img && git commit && git push   # les URL brutes doivent répondre 200
```

Le rendeur lit `CHART_SPECS` **dans la page publiée** : le Substack montre les mêmes courbes aux
mêmes valeurs, jamais une saisie parallèle. Le dictionnaire `--labels` traduit titres, notes et
libellés d'axes ; sa clé `forbid` fait échouer le rendu si un mot de la langue source survit — une
légende à moitié traduite ne doit pas pouvoir partir. Le rendeur vérifie aussi que le canvas n'est
pas vide : une image blanche ne se remarque qu'après publication.

Le connecteur n'a pas d'outil de mise à jour d'un article **publié** : `update_draft` modifie le
brouillon sans toucher au corps en ligne. Pour corriger un article déjà publié, il faut
`delete_draft` puis recréer et republier.
