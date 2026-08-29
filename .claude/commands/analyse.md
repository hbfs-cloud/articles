<!-- workflow-contract: analyse -->
# /analyse - Fiche individuelle harnachee

Alias Codex: `$analyse` et `$analysis`. Produit `data/analyses-data/TICKER.json`, puis
`analyses/TICKER/index.html`, selon `analyses/CLAUDE.md`, `.claude/skills/source-policy.md` et le
renderer existant.

## Inputs

- Un seul symbole canonique, resolu par le MCP; ne jamais deviner/corriger le ticker.
- `refdate`: derniere cloture complete utilisee par tous les niveaux.
- `dry-run`: collecte, JSON, rendu local et QA seulement.

Si une fiche existe, la lire et conserver son historique. Ne pas remplacer Finviz ou une autre source
de graphique existante sans demande explicite du user.

## Collecte

```bash
node tools/validate-workflows.js --workflow analyse
bash tools/run-collect.sh analyse analyses/TICKER/_data \
  --var symbol=TICKER --var refdate=YYYY-MM-DD
```

Le plan couvre instrument, 260 barres, fondamentaux, earnings, analystes, techniques, SEC/flags,
actions corporate, insiders/institutionnels, short/CTB/FTD/dark pool, options et signaux composites.
Les sources de contexte optionnelles ne peuvent combler une preuve requise absente.

## Verification Primaire

1. Ouvrir chaque depot SEC decisionnel et conserver accession, date, URL EDGAR directe, security type,
   capacite encore ouverte et consequence. Classer dette et equity separement.
2. Verifier guidance et resultats via 10-Q/10-K/8-K ou IR. Une date earnings non confirmee reste
   explicitement non confirmee.
3. Attribuer le mouvement contre secteur/pairs sur la meme fenetre avant de le dire specifique au titre.
4. Verifier splits et echelle: spot, entree, stop, targets, ATR et moyennes doivent partager la meme
   echelle ajustee.
5. Le web est autorise pour SEC/IR et news attribuees. Il ne remplace pas barres, techniques,
   fondamentaux, options ou flux MCP.

## Calcul Local

- `valuation-multi.js`: seules les methodes dont tous les intrants existent contribuent.
- `value-quality-board.js`: sortie structuree, aucun chiffre reecrit par le modele.
- R/R recalcule depuis les niveaux, pourcentages recalcule depuis l'entree.
- Stop confronte au niveau technique cite dans la prose.
- Entree actionnable au spot; sinon statut `watch/wait`, jamais faux setup valide.
- Le grade de dossier n'est pas un label A+. A+ passe exclusivement par
  `validate-aplus-candidates.js`.

## JSON Et QA

Produire un contenu individualise, avec sources proximales et consequences financieres. Puis:

Ecrire aussi `data/analyses-evidence/TICKER.json`: SHA-256 du JSON d'analyse et, pour **chaque valeur
numerique** du JSON, valeur exacte, `as_of`, artefact relatif, SHA-256 et `source_pointer`. Les nombres
calcules sont d'abord produits dans un artefact JSON de calcul deterministe certifie, puis pointes comme
les observations MCP. Ce sidecar bloque toute valeur simplement declaree sans liaison semantique.

```bash
node tools/check-freshness.js analyses/TICKER/_data/harness.json
node tools/validate-workflows.js --run-plan plans/analyse.json analyses/TICKER/_data
node tools/validate-analysis-evidence.js data/analyses-evidence/TICKER.json
node tools/check-analysis-editorial-quality.js --strict --pre-review data/analyses-data/TICKER.json
node tools/publish-analysis.js data/analyses-data/TICKER.json --dry
node tools/qa-content.js analyses/TICKER/index.html --strict
node tools/check-ai-tells.js analyses/TICKER/index.html --strict
```

Faire ensuite trois revues independantes sur le meme JSON et les memes preuves hachees:

- Senior QA: schema, calculs, source mapping, renderer et regressions.
- Contrarian: dilution/capacite, valorisation, causalite, risques omis et invalidation.
- Retail war room: actionnabilite, gap, liquidite/slippage, sizing et no-chase.

La revue externe AQ-1 finale exige au moins deux reviewers nommes, les 38 checks attestes, zero echec,
score >=80 et le SHA-256 exact du JSON dans
`data/analysis-editorial-reviews/YYYYMMDD.json`. Apres creation du manifeste:

```bash
node tools/check-analysis-editorial-quality.js --strict data/analyses-data/TICKER.json
```

Toute modification ulterieure du JSON invalide le hash et impose une nouvelle revue.

## Publication

Zero blocker requis. Publier depuis le JSON valide, verifier que le rendu conserve les corrections,
stager uniquement les fichiers de la fiche/revue/index necessaires, puis commit/push si demande. Aucune
notification ni publication externe en `dry-run`.
