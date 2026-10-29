---
name: aplus-grading-empirical
description: Grille de notation A+ empirique validée sur 29 setups (juin 2026) — 4 éliminatoires + 6 critères pondérés /100
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ac53259d-133a-4f6b-a082-5b75b9663be7
---

Grille A+ validée empiriquement sur cohorte 29 setups réels (10/06–21/06/2026).

**4 ÉLIMINATOIRES (échec = plafond A, max 88/100) :**
1. Guidance relevée par le management (discriminant #1 : 100% des A+ l'ont, 91% des A ne l'ont pas)
2. ≥5 EPS beats consécutifs
3. PE forward <35x (exception documentée si monopole tech + EPS >25%/an + PEG <2 — cas validé ASML)
4. Extension EMA20 ≤3% (DECK lesson : 3.8% ext = seul A+ sous-performeur)

**6 critères pondérés (/100) :** PEG <1.5 (15pts), buyback (8pts), dividende (7pts), structure technique consolidation >3sem (20pts), R/R ≥2.5 (15pts), SEC clean (15pts).

**Seuils :** A+ ≥92, A ≥88. Earnings dans 10j → "earnings play", pas swing A+.

**Why:** Étude empirique de l'user. A+ : moy +4.2%, 0 stop. A hors earnings : +0.3%, 1 stop (DGX = sans guidance + ext 3.5%). Le combo guidance+EPS beats est le discriminant le plus puissant.

**How to apply:** Appliquer dans tous les pipelines de notation : skill aplus-setups, scanner-pipeline, analyses, routine cloud Setup A+. Les 4 éliminatoires sont des gates durs. Mis à jour dans les 3 skills + mémoire MCP (priority=critical).

Liens : [[aplus-screening-dsl]], [[no-hallucination]]

**Mise à jour du 29 octobre 2026 (décision du propriétaire) — vivier A+ vide depuis le 10 août.**
Deux causes structurelles, pas un marché sans A+ :
1. `earnings_surprises` et `earnings_quarterly` (Yahoo) ne servent que 4 trimestres : « ≥5 beats » est
   indémontrable (21 dossiers à 4/4 rejetés du 13 au 29 octobre). Règle provisoire : 4 beats sur 4 trimestres
   servis passent, avec `eps_beats_provisional: true` et `eps_quarters_served: 4`, mention « historique limité »
   sur la fiche ; retour à 5 dès qu'une source sert 5 trimestres (`tools/lib/trade-idea-gates.js` l'impose).
   Aucune autre source ne comble : `earnings_reactions` a 8 publications sans BPA ni consensus, la SEC n'a pas
   le consensus.
2. Le crible Fortress filtrait la liquidité en ACTIONS (`vol>2500000`) : vivier de titres à 17-25 $ médian,
   jamais de compounder. Remplacé par `close*sma(vol,20)>2e7` (≥ 20 M$/jour) : 199 noms au lieu de 53 sur la
   clôture du 28 octobre, 78 à 4/4 beats et PER prévisionnel < 35 contre 16.

**How to apply (complément) :** si le vivier A+ reste vide plus de deux semaines hors saison des résultats,
chercher d'abord un critère indémontrable par la donnée servie avant de conclure à l'absence de setup.
