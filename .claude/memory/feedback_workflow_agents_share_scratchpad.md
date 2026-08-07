---
name: workflow-agents-share-scratchpad
description: Les agents d'un même workflow partagent le répertoire scratchpad — des fichiers intermédiaires à noms génériques se collisionnent et corrompent silencieusement les résultats
metadata:
  type: feedback
---

Incident 2026-08-07, workflow `dtx-engine-replay` (6 agents en parallèle, un par portefeuille).

Deux agents ont signalé, indépendamment, que leurs fichiers de travail avaient été modifiés hors
de leurs propres écritures — signalés par un system-reminder comme « modifiés par l'utilisateur ou
un linter », donc présentés comme intentionnels. Le contenu réécrit n'était pas un reformatage :

- l'agent `book_honest` a vu **disparaître** 10 ordres de rotation (ALAB, AMD, ARM, CRWD, DDOG,
  MRVL, MU, PANW, SNDK, STX) et les quantités des ordres restants gonflées environ 5× ;
- l'agent `etf_us` a vu **apparaître** ces mêmes 10 ordres, avec leurs stops variables.

Mêmes tickers, directions opposées : c'est une **collision de fichiers scratchpad**. Les deux
agents écrivaient des fichiers intermédiaires à noms génériques (`s01.json`) dans le répertoire de
travail partagé de la session.

**Le dégât évité de justesse.** Les 10 ordres déplacés portaient précisément tous les stops larges
(−24% à −45,7%). Si l'agent `book_honest` avait propagé la version altérée, la statistique demandée
serait tombée à médiane = min = max = −20,00% — une réponse fausse, cohérente, et non détectable,
sur le seul chiffre qui motivait le workflow. Les deux agents ont détecté l'incohérence et
reconstruit depuis les réponses verbatim du moteur.

**Why:** le scratchpad est propre à la SESSION, pas à l'agent. Rien n'isole les agents parallèles
les uns des autres, et un fichier écrasé ne produit aucune erreur — il produit une autre réponse.
Le system-reminder rend la chose pire encore en présentant l'altération comme voulue.

**How to apply:**
1. Dans un prompt de workflow parallèle, imposer un **préfixe unique par agent** pour tout fichier
   intermédiaire : `<scratchpad>/<label-agent>/…`, jamais un nom générique.
2. Mieux : demander à l'agent de n'écrire qu'un **seul fichier final** dont le nom porte déjà son
   identité (ici `data/dtx-replay/<mode>.json`), et de garder ses intermédiaires en mémoire.
3. Un system-reminder annonçant qu'un fichier a été « modifié par l'utilisateur ou un linter » sur
   un fichier que l'agent vient d'écrire lui-même est un **signal d'alarme**, pas une information
   anodine : vérifier le contenu avant de le réutiliser.
4. Corollaire de contrôle : toujours re-vérifier soi-même les sorties d'un workflow parallèle
   plutôt que de faire confiance aux résumés — ici, la vérification indépendante des 5 fichiers a
   confirmé leur cohérence stratégie par stratégie.
