---
name: panel-fixes-html-only-lost-on-rerender
description: Le panel senior corrige le HTML rendu ; tout re-rendu depuis le JSON source efface silencieusement son travail — reporter les correctifs dans le JSON avant de re-rendre
metadata:
  type: feedback
---

Incident 2026-08-03, analyse CCJ. Le panel senior a appliqué **plus de 40 correctifs** en place dans
`analyses/CCJ/index.html` (dont un programme d'émission actif de 500 M$, un bêta réalisé de 2,25 contre
1,00 par défaut, une sortie de trade inventée, une attribution de baisse fausse). J'ai ensuite lancé
`node tools/render-analysis.js data/analyses-data/CCJ.json` pour appliquer un correctif de rendu sans
rapport — et j'ai **tout écrasé**, sans le moindre avertissement.

**Why:** pour les analyses, `data/analyses-data/<T>.json` est la source et le HTML est un artefact
dérivé. Le panel, lui, édite l'artefact. Les deux conventions sont raisonnables séparément et
incompatibles ensemble : le rendu écrase toujours, en silence, et rien dans la chaîne ne détecte que le
HTML était plus récent que le JSON. Aucune erreur, aucun exit code — juste des correctifs disparus.

**How to apply:**
1. Après un panel senior sur une analyse : **ne jamais re-rendre** depuis le JSON sans avoir d'abord
   reporté les correctifs dans le JSON. Un `git status` montrant `M analyses/<T>/index.html` après
   panel est le signal d'alerte.
2. Récupération si l'écrasement a eu lieu : le journal du workflow
   (`<transcriptDir>/journal.jsonl`) contient un tableau `fixed[]` détaillé par relecteur. Les
   correctifs y sont décrits assez précisément pour être reportés à la main dans le JSON.
3. Reporter dans le JSON plutôt que ré-appliquer au HTML : c'est le seul endroit où un correctif
   survit au re-rendu suivant, et cela vaut aussi pour les publications futures du même ticker.
4. Corollaire : un correctif de gabarit (`tools/render-analysis.js`) impose de re-rendre TOUTES les
   fiches concernées — donc de vérifier d'abord si l'une d'elles porte des correctifs de panel non
   reportés.
