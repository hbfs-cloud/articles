---
name: project-fortress-mandate
description: "Mandat stratégique du mode fortress — participer à la hausse SANS brider le return, mais toujours avec parachute anti-retournement (DD minimisé)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 1cc653cd-e658-47d7-96ef-f273b4affc3e
---

**Mandat du mode fortress** (clarifié par l'utilisateur 2026-06-14, vision "expert senior patrimoine") :

Fortress minimise le drawdown **sans brider les returns**. Ce n'est PAS un mode low-return de pure préservation. C'est un mode **régime-adaptatif** :
- Quand le marché est **euphorique**, il **participe à la hausse** (prend le momentum/upside, ne laisse pas d'argent sur la table).
- Mais il garde **toujours en tête qu'un retournement peut arriver n'importe quand** → il reste protégé pour limiter le DD.
- Il **sait se mettre en défensif quand il le faut** (régime qui se dégrade).

**Erreur à NE PAS refaire** : recommander "breakout_only partout / ne plus prendre de momentum" — ça **bride le return**, l'inverse du mandat. De même, "fortress est low-return by design, accepte-le" est FAUX.

**Bonne approche = "participer AVEC parachute"** :
1. Garder l'upside (momentum/mom_bo en risk-on confirmé).
2. **Verrouiller les gains** (trailing stop — était OFF, c'est une lacune) pour qu'un retournement ne rende pas les gains d'euphorie.
3. **Éviter le pari unique corrélé** (le cluster IA/momentum de juin 2026 a causé -34% / 100% stop-out car 4 slots = 1 seul pari). Vrai cap corrélation/thème/beta, pas seulement GICS.
4. **De-risk proactif quand le régime se dégrade** (le label RISK-ON a laggé en juin pendant que le score chutait → entrées dans un marché qui tournait). Idéalement: regime-score override du label (code).

Critère de succès: cf [[project-mode-success-criteria]] (≥3× SPY/semaine, DD≤8%). Pour fortress, l'accent est DD bas SANS sacrifier l'upside. Évaluer par tronçon + walk-forward (cf [[feedback-regime-aware-eval]]), jamais en replay uniforme.

Cause racine de juin: cf analyse — effondrement par cluster corrélé (NVDA/PLTR/AMZN/GOOGL/ANET entrés 1-4 juin en RISK-ON, tous stop-out le 5 juin à -2.58% SPY). Les modes mono-position (turbo/dynamic) ont survécu; les diversifiés (balanced/fortress) non.
