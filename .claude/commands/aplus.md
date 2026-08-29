<!-- workflow-contract: aplus -->
# /aplus - Setups A+ verifies

Un A+ est actionnable au spot actuel, pas un mouvement deja parti ni un R/R fonde sur un repli
hypothetique. Le gate executable prime sur toute appreciation editoriale. Les sources suivent
`.claude/skills/source-policy.md`.

## Collecte

```bash
node tools/validate-workflows.js --workflow aplus
bash tools/run-collect.sh aplus-screen data/workflow-runs/aplus/YYYYMMDD/screen \
  --var date=YYYYMMDD --var refdate=YYYY-MM-DD
```

Appliquer le tri mecanique du screener, ticker en dernier tie-break, persister `selection.json`, puis
enrichir zero a dix survivants. Zero survivant produit `no_setup` et aucun appel verify/correlation.

```bash
bash tools/run-collect.sh aplus-verify data/workflow-runs/aplus/YYYYMMDD/verify \
  --var date=YYYYMMDD --var refdate=YYYY-MM-DD --var symbols=A,B,C
# Requis seulement pour deux survivants ou plus:
bash tools/run-collect.sh aplus-correlation data/workflow-runs/aplus/YYYYMMDD/correlation \
  --var date=YYYYMMDD --var refdate=YYYY-MM-DD --var symbols=A,B,C
```

Selectionner zero a 10 symboles depuis les screeners du run. Conserver une decision tracee par
symbole et un tie-break ticker stable. Les plans dates archives ne sont jamais rejoues.

## Preuves Eliminatoires

Pour chaque candidat:

1. Guidance explicitement relevee, liee a une source primaire.
2. Au moins cinq beats EPS consecutifs, historique lie a une source.
3. Forward PE <35, ou exception documentee exigeant monopole mondial, croissance EPS >25% et PEG <2.
4. Extension EMA20 <=3%.
5. Au moins 10 seances avant earnings.
6. SEC, dilution, capacite d'emission et action corporate tous `clear`.

Tout hit SEC/action corporate est classe depuis EDGAR/IR. Un resultat vide signifie seulement qu'aucun
hit n'a ete trouve dans la fenetre prouvee. Les reviewers utilisent le meme snapshot hache; ils ne
refetchent pas quatre marches differents.

## Geometrie Et Score

- entree a <=3% du spot;
- stop a au moins 1.5 ATR;
- TP1 a au plus 4 ATR;
- R/R recalcule >=1.5; le composant A+ `risk_reward` vaut 15 seulement a >=2.5;
- correlation maximale <=0.70 pour un panier.

Score binaire exact /100:

| Composant | Points |
|---|---:|
| guidance, 5 beats, valuation, extension | 5 chacun |
| PEG <1.5 | 15 |
| buyback actif | 8 |
| dividende actif | 7 |
| structure validee | 20 |
| R/R >=2.5 | 15 |
| SEC clean + catalyseur verifie | 15 |

`score_components` doit reproduire exactement ces 100 points possibles. A+ exige un score recalcule
>=92; aucun arrondi ou bonus narratif n'est autorise.

## War Room

Quatre votes sur les preuves immuables: `quant`, `pm`, `risk`, `short_seller`. Chaque vote porte
`approve` et `critical_errors[]`. Il faut au moins 3/4, zero erreur critique individuelle et
`war_room.critical_errors=[]`. Une prose de reviewer ne peut pas lever un echec script.

## Payload Et Gate

`candidates.json` porte `status: ready|no_setup`, `reference_close`, `candidates[]` et
`evidence`. Le manifeste lie bars, techniques, calendrier, SEC, guidance, historique EPS, actions
corporate et correlation aux fichiers et SHA-256 certifies par leurs harnais. Chaque
`market_observations` contient un `source_pointer`; `guidance_proof` et chaque ligne
`eps_beat_proof` pointent la ligne source exacte; `sec_review.filings[]` lie accession et JSON Pointer
a une ligne du meme ticker dans l'artefact SEC. La seule presence du ticker ne constitue jamais une preuve.

```bash
node tools/validate-aplus-candidates.js data/workflow-runs/aplus/YYYYMMDD/candidates.json
```

`no_setup` avec zero candidat est une sortie valide si screen et regime sont prouves. Aucun A+ n'est
force pour remplir une cohorte.

## QA Et Publication

Avant toute fiche ou notification: Senior QA, contrarian review et retail war room, puis QA locale du
JSON/HTML. Corriger, recalculer le hash et rejouer les gates affectes jusqu'a zero blocker.

La sortie par defaut est locale, meme sans `dry-run`. `--publish` doit etre present ou l'utilisateur doit
avoir demande explicitement publication/push dans le message courant. Alors seulement publier les
candidats valides et stager des fichiers explicites. Ne jamais inclure tokens, `.mcp.json` ou artefacts
bruts du run.
