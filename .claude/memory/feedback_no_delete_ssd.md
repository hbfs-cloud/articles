---
name: Never delete SSD data without explicit approval
description: Ne jamais supprimer de données sur le disque externe (Extreme SSD) sans validation explicite de l'utilisateur
type: feedback
---

Ne JAMAIS déplacer, supprimer ou modifier des fichiers sans validation explicite de l'utilisateur pour CHAQUE élément.

**Why:** Incidents multiples : (1) suppression d'un backup sur le SSD sans demander, (2) déplacement de salma-video et systematic-tss malgré refus explicite ("salma-video non"). L'utilisateur a perdu confiance.

**How to apply:**
- Avant toute opération destructive (rm, mv, rsync avec suppression) : lister ce qui sera affecté et demander confirmation AVANT d'exécuter.
- Quand l'utilisateur donne une liste de choses à faire/ne pas faire, respecter CHAQUE item à la lettre.
- Ne JAMAIS lancer en parallèle des opérations que l'utilisateur n'a pas toutes validées.
- En cas de doute, demander plutôt qu'agir.
