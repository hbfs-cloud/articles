---
name: feedback-harness-portfolio-coherence
description: Le harness/war-room DOIT vérifier la cohérence panier↔thèse macro (persona Strategist), pas seulement valider chaque trade en isolation
metadata:
  type: feedback
---

# Le war-room doit checker la cohérence PORTEFEUILLE, pas juste chaque trade

**Incident 2026-07-08** : liste de swings court terme sortie avec un narratif « risk-off + demi-taille avant CPI »
mais un panier de **4 longs béta-croissance** (DASH, S, EXEL étendu) + un seul quasi-défensif (CSCO). ChatGPT
l'a démonté en 30 s : *tu dis risk-off, ton book est risk-on*. Le harness (Trader/Quant/Risk/Editor + inline
war-room) avait validé chaque trade **en isolation** (niveaux, R:R, dilution, earnings, RSI = le micro) mais
**personne ne possédait la question panier** : « est-ce que le book EXPRIME la thèse macro annoncée ? ».

**Why** : la validation par-trade rate structurellement le biais facteur agrégé. Un book « diversifié » peut être
secrètement UN pari (tout long-growth, tout momentum, tout rate-sensitive). Si la posture déclarée est
risk-off/réduire-avant-événement et que le book est long le facteur exact que l'événement menace (CPI chaud →
taux réels → compression des multiples → growth souffre), la thèse et les positions se contredisent. Un
war-room qui *a l'air* rigoureux mais rate ça = théâtre de process.

**How to apply** :
- Fix appliqué : persona **Strategist (Macro/PM)** ajoutée à `.claude/workflows/senior-review.js` + skill
  `.claude/skills/senior-review.md`, câblée dans la matrice pour analyses/scanner/daily/weekly + nouveau type
  `basket`. Elle checke : (1) thèse↔book (posture déclarée vs tilt facteur agrégé) → BLOCK si contradiction ;
  (2) biais facteur implicite (réduire le panier à net beta / growth-value / duration / cyclique-défensif /
  concentration) ; (3) positionnement événement (long le facteur que le catalyseur menace ?) ; (4)
  narratif↔risque réel. Fix = repondérer/trim/couper les noms qui contredisent la posture OU corriger le
  narratif — thèse et positions doivent S'ACCORDER.
- Règle générale : **toute liste de trades / tout panier passe la passe Strategist AVANT publication.** Le
  « défensif » se juge au niveau book (décorrélation + facteurs), pas nom par nom. Voir [[feedback_no_false_caveats]],
  [[feedback_regime_aware_eval]].
