---
name: commit-the-evidence-base
description: Publier un article sans committer _data/ (claims.json), _focus/, _build.cjs et _review/ rend sa provenance invérifiable — les éditions précédentes tracent 30+ fichiers, celle du 14/09 n'en traçait aucun.
type: feedback
---

Le commit 2a3a41844 n'a poussé que `index.html`, `QA.md` et les PNG du weekly 20260914. `_data/`
(dont `claims.json`), `_focus/`, `_build.cjs` et `_review/` sont restés non suivis, alors que
weekly/20260831 en trace 33 et weekly/20260907 30.

**Why:** le `QA.md` publié affirmait « 42 claims validées » et donnait `node _build.cjs` comme
instruction de reproduction — deux affirmations invérifiables pour quiconque clone le dépôt, y
compris les routines cloud. Un socle non commité = article sans provenance.

**How to apply:** au moment du commit d'une édition, stager explicitement
`weekly|daily|scanner/<date>/{index.html,QA.md,_build.cjs,_data,_focus,_img,_review,_substack}` —
jamais `git add -A`. Vérifier avec `git ls-files <dir> | wc -l` que le compte est du même ordre que
l'édition précédente avant de pousser.
