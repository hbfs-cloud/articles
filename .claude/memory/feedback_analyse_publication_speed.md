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
