---
name: feedback_analyse_publication_speed
description: Fiche /analyse — publier vite : deux tours de relecture au plus, seuls les bloquants rouvrent une relecture, les mineurs partent dans la version suivante
metadata:
  type: feedback
---

Une fiche `/analyse` doit sortir vite. Le 13 octobre 2026, la fiche TRT a demandé cinq tours des trois relectures AQ-1.1 (QA senior, contradicteur, war room) et l'utilisateur a jugé le délai inacceptable : « c'est beaucoup trop long ton truc ! il va falloir publier plus vite ».

**Why:** chaque modification du JSON change son empreinte et invalide l'attestation, ce qui force à relancer les trois relectures. En appliquant aussi les mineurs entre les tours, j'ai rouvert trois tours de plus pour des retouches de forme. Chaque tour corrigé introduisait en outre de nouveaux passages à relire.

**How to apply:**
- Collecte, preuves et contrôles automatiques d'abord ; relectures seulement sur une fiche qui passe tout.
- Deux tours au plus. Entre deux tours, ne corriger QUE les bloquants démontrés (chiffre faux, consigne d'exécution dangereuse, source contredite), sans réécrire autour.
- Un tour qui passe (aucun BLOCK, score ≥ 80) est publié tel quel : ses mineurs sont notés pour la version suivante, jamais appliqués avant publication.
- Pendant les relectures, préparer en parallèle la publication : attestation, carte d'index, liste des fichiers à committer, brouillon Telegram.
- Si un relecteur se bloque, le relancer aussitôt sur le même hash.
- Lien : [[feedback_analyses_factcheck]].
