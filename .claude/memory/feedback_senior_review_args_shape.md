---
name: senior-review-args-shape
description: Le workflow senior-review attend artifacts = tableau d'OBJETS {path, type, label}, pas de chaînes — sinon 0 agent lancé et échec silencieux
metadata:
  type: feedback
---

Le 02/08/2026, l'appel `Workflow({name:"senior-review", args:{artifacts:["weekly/20260803/index.html"], type:"weekly"}})`
a échoué immédiatement avec `undefined is not an object (evaluating 'a.path.split')` sur les 5 étapes
(4 personas + le gate), **0 agent lancé, 0 token consommé, résultat `{"gates":[],"blocked":[]}`**.

**Contrat réel du script** (ligne 10 de `senior-review-*.js`) :
```
args = { artifacts: [{ path, type, label? }], applyFixes?: true }
```
Le `type` est porté **par artefact**, pas au niveau racine. `path` est relatif au repo.

Forme correcte :
```json
{"artifacts":[{"path":"weekly/20260803/index.html","type":"weekly","label":"weekly-20260803"}],
 "applyFixes":true,"context":"..."}
```

**Why:** L'échec est silencieux au sens où le workflow rend `status: completed` avec un résultat vide —
on peut croire que le panel a validé alors qu'aucun relecteur n'a lu l'article. C'est un gate de
publication : un faux PASS est pire qu'un BLOCK.

**How to apply:** Toujours passer `artifacts` en objets `{path,type,label}`. Après tout run de
senior-review, vérifier que `agent_count > 0` et que `gates[]` est non vide AVANT de publier ; un
`{"gates":[],"blocked":[]}` n'est PAS un PASS, c'est un run mort. En cas d'échec, relancer avec
`{scriptPath, resumeFromRunId}` plutôt que de reconstruire l'appel. Voir [[analysis-senior-review-first]]
et [[content-commands-harness]].

**Bonus vérifié le même jour** : mettre le maximum de chiffres déjà vérifiés dans `context` paye —
le relecteur quant a rattrapé 3 confusions de fenêtre 1 séance / 5 séances (Amazon +17,0% semaine dont
+15,3% le seul vendredi ; ETF Chine +5,6% semaine et non -0,05% qui était la variation du vendredi ;
table des extrêmes = séance et non semaine) que les gates automatiques (`qa-content`, `check-ai-tells`)
ne voient pas.
