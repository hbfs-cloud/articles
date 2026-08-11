---
name: project_panel_non_negociable
description: Le panel adversarial reste obligatoire avant publication — décision du 2026-08-11, prise en connaissance du coût en temps
metadata:
  type: project
---

**Décision du 2026-08-11 : le panel senior-review adversarial est NON NÉGOCIABLE avant
publication.** Arbitrée explicitement par le propriétaire face à un objectif de latence
de 5 minutes sur `/scanner` — « on les laisse alors c'est trop important ».

**Conséquence sur le budget de latence :** la cible des 5 minutes porte sur la
**collecte et la publication scriptées**, PAS sur le pipeline complet. Le panel est du
raisonnement, il ne se compresse pas comme du transport de données. Un `/scanner` complet
dure donc ~30 minutes et c'est ACCEPTÉ. Ne jamais proposer de retirer le panel pour tenir
un chrono, ni de le déplacer après publication en rattrapage.

**Pourquoi — relevé factuel d'UNE seule journée (2026-08-10/11) :**
- weekly : ~19 cotations fausses, dont le Nikkei annoncé plus forte hausse mondiale alors
  qu'il baissait, 4 inversions de signe (CAC, FTSE, cuivre), un VIX live du lundi étiqueté
  clôture du vendredi, un catalyseur pétrole macro-inversé, un dépassement de sizing
  (31-62% du NLV vs plafond 18,4%), l'absence de disclosure performances passées ;
- analyse USAS : overhang de dilution de 32,5 M d'actions (~10% du capital) manqué,
  soit 11× ce qui était déclaré ;
- article rotation : le panel a trouvé LE catalyseur que l'auteur affirmait inexistant
  (attaques du Golfe du week-end) — thèse entière fausse, prête à être publiée ;
- Top A+ : contrat de date violé, libellé R/R faux, ligne annoncée « exécutable au
  marché » sous le plancher maison ;
- deux BLOCK sur le MÊME weekly pour des raisons opposées (gonflé à 13 391 mots, puis
  amputé de 6 sections obligatoires) — juste les deux fois.

**Piste retenue pour l'avenir (pas encore implémentée) :** calibrer la TAILLE du panel sur
l'enjeu plutôt que le supprimer — 7 relecteurs sur un contenu qui part en email, 3 sur un
scanner quotidien couvert par des gates déterministes, 0 sur un contenu web sans
notification. La matérialité calculée par [[tools/publication-gate.js]] fournit déjà la
mesure d'arbitrage.

Voir [[feedback_publier_avant_la_synthese_du_gate]] et [[feedback_size_threshold_is_not_completeness]].
