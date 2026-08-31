<!-- workflow-contract: daily -->
# /daily - Briefing quotidien deterministe

Produit `daily/YYYYMMDD/index.html` en respectant `daily/CLAUDE.md`,
`.claude/skills/content-harness.md` et `.claude/skills/source-policy.md`.

## Inputs

- `date`: date editoriale `YYYYMMDD`.
- `refdate`: derniere cloture US terminee `YYYY-MM-DD`.
- `crypto_refdate`: derniere bougie quotidienne UTC crypto terminee au moment de la collecte. Elle peut
  etre anterieure a `refdate` lorsque la seance US est close mais que la bougie crypto UTC est encore ouverte.
- `focus_symbols`: 1 a 6 noms choisis depuis les sorties du socle du run, jamais depuis une liste
  historique ou la memoire du modele.
- `dry-run`: aucune indexation, notification, publication, commit ou push.

`date` et `refdate` sont explicites et independants. Ne jamais deduire l'un de l'autre dans un plan.

## Collecte

```bash
node tools/validate-workflows.js --workflow daily
bash tools/run-collect.sh daily daily/YYYYMMDD/_data \
  --var date=YYYYMMDD --var refdate=YYYY-MM-DD --var crypto_refdate=YYYY-MM-DD
```

Lire uniquement ce snapshot, classer les candidats par score source puis ticker, et persister
`daily/YYYYMMDD/_data/selection.json` avec les retenus et rejets. Ensuite seulement:

```bash
bash tools/run-collect.sh daily-focus daily/YYYYMMDD/_focus \
  --var date=YYYYMMDD --var refdate=YYYY-MM-DD --var focus_symbols=A,B,C
```

Le wrapper valide le plan, la cloture, les hashes, les appels executes et la fraicheur. Les jetons TTL
passent par un environnement secret ou une saisie masquee; leur valeur ne doit jamais apparaitre dans
une commande, un log, le chat ou un fichier.

Le socle gouverne indices, secteurs, taux/energie, metaux, crypto, regime, earnings et macro. Le harnais
certifie `refdate` pour les actifs de séance US et `crypto_refdate` pour les bougies UTC 24/7; une barre
crypto ouverte reste exclue et le contexte courant ne la transforme jamais en clôture. Hors séance,
`GetOffHoursContext` apporte un verdict courant distinct des barres bornées à `refdate`; il ne remplace
jamais la clôture certifiée et son horodatage doit rester visible. La vague
`daily-focus` gouverne toute affirmation chiffre concernant les noms choisis. Le contexte optionnel
`overview` ne peut gouverner ni chiffre, ni selection, ni niveau.

## Selection Et Calcul

1. Ecrire une courte decision de selection: symbole, source du socle, catalyseur observe, raison de
   conservation ou rejet. Ordonner de facon stable; ticker sert de dernier tie-break.
2. Ne retenir que les noms dont les preuves requises sont presentes dans `_focus/harness.json`.
3. Calculer localement variations, niveaux, distances ATR, correlations et valorisation. Un intrant
   absent donne `na` ou bloque la conclusion; le modele ne complete aucun chiffre.
4. Toute idee de trade vient d'un scanner valide ou d'un payload passe par
   `validate-trade-ideas.js`. Aucune position, equity, ordre ou donnee de compte.
5. Pour chaque hit SEC/action corporate, ouvrir la source primaire. Le web sert aux depots SEC, IR,
   calendriers officiels et attribution de news; jamais a reparer prix, barres, fondamentaux ou flux.

## Redaction

Conserver le layout et les composants du dernier daily valide, sans ecraser une page existante sans
instruction explicite. Separer:

- faits observes et horodates;
- propagation sectorielle et cross-asset;
- scenario de base, scenario contraire et invalidation datee;
- actions simples: attendre, surveiller un niveau, eviter de poursuivre un gap.

Le nombre de sections vient du template courant, pas d'un quota de mots ou d'octets. Toute mise a jour
mi-seance annote l'article d'origine et conserve le texte initial.

## Gates

```bash
node tools/check-freshness.js daily/YYYYMMDD/_data/harness.json
node tools/check-freshness.js daily/YYYYMMDD/_focus/harness.json
node tools/validate-workflows.js --run-plan plans/daily.json daily/YYYYMMDD/_data
node tools/validate-workflows.js --run-plan plans/daily-focus.json daily/YYYYMMDD/_focus
node tools/validate-content-claims.js daily/YYYYMMDD/_data/claims.json
node tools/qa-content.js daily/YYYYMMDD/index.html --strict
node tools/check-ai-tells.js daily/YYYYMMDD/index.html --strict
node tools/validate-content-hierarchy.js daily/YYYYMMDD/index.html
```

Puis trois lectures independantes sur les memes artefacts haches, sans refetch:

- Senior QA: provenance, calculs, template, liens et regressions.
- Contrarian: causalite, omissions, scenario inverse et affirmations trop fortes.
- Retail war room: clarte, actionnabilite, gaps/slippage et invalidation.

Un BLOCK ou un test non nul interdit la publication. Apres chaque correction, rejouer les checks
affectes et les reviewers qui avaient bloque.

## Publication

Seulement apres zero blocker: indexer une fois, verifier le diff explicite, commit/push si le run le
demande, puis envoyer une notification Telegram francaise concise et autosuffisante avec le lien du
daily. Aucun canal externe n'est appele en `dry-run`.
