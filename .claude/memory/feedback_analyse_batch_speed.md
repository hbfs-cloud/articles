---
name: feedback_analyse_batch_speed
description: Lot /analyse de plusieurs fiches (27 octobre 2026, 14 tickers) — trop lent ; chaque constructeur fait SA passe de trois relectures et l'orchestrateur publie au fil de l'eau, jamais de relectures centralisées en second temps
metadata:
  type: feedback
---

Le 27 octobre 2026, refonte de 14 fiches au gabarit FICO. Le propriétaire : « c pas normal que ce soit aussi lent » (et, avant, « je t'avais bien dit de tout mettre à jour en profondeur » en voyant une fiche encore à l'ancienne version).

**Why:** j'ai interdit aux constructeurs de lancer leurs propres relecteurs pour les centraliser. Résultat : construction (35-45 min) → attente → trois relectures lancées par moi (≈ 40 min, limitées par le plafond de 20 sous-agents simultanés) → renvoi au constructeur pour corrections (15-30 min). Trois allers-retours au lieu d'un, plus une coupure d'usage qui a tué dix agents en vol. Les relectures ont pourtant trouvé de vraies erreurs (CCJ, HPE, ORCL, APLD, PURR, EQX) : elles restent obligatoires, c'est l'enchaînement qui était lent.

**How to apply:**
- Chaque constructeur lance lui-même ses trois relectures en parallèle dès que ses contrôles passent, applique les blocages en une fois et rend une fiche prête à publier ([[feedback_analyse_publication_speed]]).
- Vagues de cinq constructeurs au plus (chacun ouvre trois relecteurs : 5 × 4 = 20 = plafond).
- L'orchestrateur publie chaque fiche dès son rapport, sans attendre les autres : `analyses-lifecycle.js --tickers T`, fusion de la seule entrée dans `data/analyses-status.json` (format indent 1, repartir de HEAD), reconstruction déterministe par le build du run (le cycle de vie ajoute `meta.levelsVerifiedAt` et casse l'empreinte du sidecar), rendu, `add_card.js`, commit ciblé, push HTTPS via gh, Telegram alias `daily` au style FICO (simple, « Le plan : », « On oublie si »), `publication-gate.js --record`.
- Après un push, attendre la fin du déploiement Pages (les pushs rapprochés annulent les déploiements précédents) avant de dire « en ligne ».
