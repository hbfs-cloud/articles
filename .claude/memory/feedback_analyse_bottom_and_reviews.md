---
name: analyse-bottom-and-reviews-in-fiche
description: Fiche /analyse — le propriétaire veut l'estimation du plancher (bottom) et les relectures (contrôle qualité, contradicteur, war room) publiées DANS la fiche (FICO, 26 octobre 2026)
metadata:
  type: feedback
---

Le 26 octobre 2026, pendant la fiche FICO, le propriétaire a demandé : « estimes moi le bottom + review contrarian etc... tu me met tout ça dans l'analyse ».

**Why:** il veut voir dans la page où le titre pourrait s'arrêter et ce que les relecteurs ont contesté, pas seulement un verdict.

**How to apply:**
- Bloc JSON `bottomEstimation` (rendu « Estimation du plancher », en français depuis ce jour) : `method` obligatoire, trois planchers datés et sourcés (techniques sur barres certifiées, plancher de valeur à un multiple de pairs nommé), au moins un cas qui intègre une baisse des profits, une phrase « aucun plancher n'est un prix d'achat », pas de `probability` ni de `progress` (pris pour des probabilités).
- Bloc JSON `reviewPanel` (rendu « Relectures indépendantes ») : verdict, points contestés et corrections de chaque relecteur, chiffres calculés dans le générateur, jamais recopiés.
- `tradeIdea.banner` (facultatif) quand la phrase de bandeau dérivée des niveaux omettrait une condition décisive (« seulement après les résultats »).
- Les trois relectures lancées en parallèle restent en mode rapide ([[feedback_analyse_publication_speed]]).
- Leçon FICO : un trou Yahoo du 21 au 24 juillet 2026 touchait plusieurs titres (FICO, SPGI, MSCI, TRU, UWMC, PFSI, ITB) ; RefreshBars ciblé a réparé, Tiingo était en pause ([[yahoo-store-holes-pin-source]]).
