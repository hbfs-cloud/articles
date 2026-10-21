---
name: feedback_analyse_publication_speed
description: Fiche /analyse — MODE RAPIDE (19/10/2026) : un seul passage de relecture, corrections appliquées sans re-relecture, publication ; l'empreinte/attestation ne doit plus imposer de tours successifs
metadata:
  type: feedback
---

**Décision du propriétaire, 19 octobre 2026 (mode « Rapide »).** Après LEU, FUFU et ALMU, où chaque correction changeait l'empreinte du JSON et forçait les trois relecteurs à revalider (FUFU : trois allers-retours, plusieurs heures), l'utilisateur : « ton systeme d'enpreinte est debile, avant tu arrivais a faire une analyse en moins de 5m, la c'est du grand n'importe quoi ». Il a choisi : un seul passage de relecture, corrections appliquées sans re-relire, publication.

Historique : le 13 octobre 2026, TRT avait déjà demandé cinq tours (« c'est beaucoup trop long ton truc ! il va falloir publier plus vite »).

**Why:** l'attestation AQ-1.1 liée à l'empreinte rend chaque retouche coûteuse (re-relecture complète) ; l'utilisateur préfère la vitesse, les contrôles automatiques restant bloquants.

**How to apply:**
- Lancer les trois relecteurs (QA senior, contradicteur, war room) en parallèle dès que la fiche passe les contrôles automatiques, un seul passage.
- Appliquer en une fois les faits faux, omissions de dépôt et consignes d'exécution dangereuses qu'ils relèvent ; reporter le reste.
- Relancer les contrôles automatiques (preuves, qualité éditoriale --pre-review, qa-content, ai-tells), puis publier sans second tour : rendu par `tools/render-analysis.js` et indexation par `tools/add_card.js` (publish-analysis.js refuse sans attestation à jour). Archiver d'abord l'ancienne page si nécessaire.
- Après publication : `analyses-lifecycle.js` puis commit de `data/analyses-status.json` (sinon « niveaux non vérifiés »), notification Telegram ≤ 100 mots.
- Lien : [[feedback_analyses_factcheck]].

**Pièges d'outillage du mode rapide (BRUN, 21 octobre 2026) :**
- `analyses-lifecycle.js` exige `--refdate YYYY-MM-DD --asof <ISO>` et un jeton lu par `tools/lib/mcp-auth.sh` (le client lit `MCP_TOKEN_MARKETDATA`, pas le fichier) : `MCP_TOKEN_FILE_MARKETDATA=<fichier 0600 du scratchpad> bash -c 'source tools/lib/mcp-auth.sh && mcp_require_token marketdata && node tools/analyses-lifecycle.js …'`, puis effacer le fichier.
- Même avec `--tickers X`, il **réécrit tout** `data/analyses-status.json` : il a supprimé le bloc `symbol_exclusions` du scanner, ramené `closeDateMax` et vidé le `verifiedAt` d'autres fiches. Repartir de `git show HEAD:data/analyses-status.json` et n'y ajouter que l'entrée du ticker publié.
- Société issue d'une SPAC sans 10-K : `manualFinancials` (douze mois = exercice de l'ancienne société lu dans le S-1/POS AM + semestre − semestre précédent, comme FUFU), `minBars` à la longueur de l'historique coté, `ema200: 0` avec `ma200Available: false` (le schéma exige un nombre), au plus trois résistances, `ogDescription` ≤ 200 caractères.
- Le hook de pré-commit lance node : `NODE_OPTIONS= git commit …` si la session a un préchargement cassé.
