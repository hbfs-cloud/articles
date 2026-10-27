---
name: analyse-bottom-and-reviews-in-fiche
description: Fiche /analyse — plancher (bottom) publié dans la fiche ; depuis le 27 octobre 2026 les relectures ne sont PLUS publiées, remplacées par le tribunal en fin de fiche (gabarit FICO)
metadata:
  type: feedback
---

Le 26 octobre 2026, pendant la fiche FICO, le propriétaire a demandé : « estimes moi le bottom + review contrarian etc... tu me met tout ça dans l'analyse ».

**Why:** il veut voir dans la page où le titre pourrait s'arrêter et ce que les relecteurs ont contesté, pas seulement un verdict.

**How to apply:**
- Bloc JSON `bottomEstimation` (rendu « Estimation du plancher », en français depuis ce jour) : `method` obligatoire, trois planchers datés et sourcés (techniques sur barres certifiées, plancher de valeur à un multiple de pairs nommé), au moins un cas qui intègre une baisse des profits, une phrase « aucun plancher n'est un prix d'achat », pas de `probability` ni de `progress` (pris pour des probabilités).
- ~~Bloc `reviewPanel` publié~~ : **révoqué le 27 octobre 2026**. Le propriétaire : « il faut retirer "Relectures indépendantes", remettre le tribunal avec les avocats à la fin ». Les trois relectures restent faites ; `reviewPanel` peut rester dans le JSON, le moteur ne le rend plus.
- Bloc `tribunal` (rendu en dernière section) : question du juge, plaidoiries alternées accusation/défense (≥ 2 chacune, l'accusation ouvre), verdict ; faits de la fiche seulement, chiffres calculés dans le générateur.
- Gabarit du 27 octobre 2026 (FICO = référence pour toutes les fiches) : graphique avant tableau, détail dépliable ; fondamentaux en fiches de faits groupées (`rows[].group`) ; performance en barres triées ; propagation en nuage + six liens + trois cartes de scénarios. Spécification : `.claude/commands/analyse.md` § Gabarit de la fiche.
- `tradeIdea.banner` (facultatif) quand la phrase de bandeau dérivée des niveaux omettrait une condition décisive (« seulement après les résultats »).
- Les trois relectures lancées en parallèle restent en mode rapide ([[feedback_analyse_publication_speed]]).
- Leçon FICO : un trou Yahoo du 21 au 24 juillet 2026 touchait plusieurs titres (FICO, SPGI, MSCI, TRU, UWMC, PFSI, ITB) ; RefreshBars ciblé a réparé, Tiingo était en pause ([[yahoo-store-holes-pin-source]]).
