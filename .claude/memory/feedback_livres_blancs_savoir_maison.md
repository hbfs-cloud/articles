---
name: livres-blancs-savoir-maison
description: Les livres blancs DailyTickers doivent partir de notre savoir et de notre expérience propres (moteur, carnets, incidents, protocoles, données), jamais de sujets grand public « main street »
metadata:
  type: feedback
---

Le 13 octobre 2026, cinq livres blancs ont été publiés sur des sujets grand public (levier ×3, épargne dormante, frais,
meilleures séances, risque par trade ; commit e23041ad8, Telegram `learning` message 2097). L'utilisateur les a gardés
mais a dit : « c'était pas ça que j'attendais, je voulais pas des trucs main street mais des trucs qui se basent sur notre
savoir et expérience ».

**Why:** un livre blanc DailyTickers doit apporter ce que personne d'autre ne peut écrire : nos propres mesures et nos
propres erreurs. Un sujet que n'importe quel blog d'épargne traite ne différencie rien, même bien chiffré.

**How to apply:** avant de proposer un livre blanc, partir de nos sources propres :
- le catalogue du moteur systématique et sa barre d'éligibilité ;
- les carnets tenus en temps réel (portefeuilles modèles, jamais « réels ») contre les rejeux ;
- les incidents datés (IA, données, exécution) et leurs correctifs ;
- les protocoles (lecture SEC anti-dilution, contrat de date, relectures adverses) ;
- l'historique du scanner et ses résultats mesurés.
Le chiffre dominant doit sortir de ces sources. Thèmes validés par l'utilisateur le 13 octobre 2026 : la grille des setups A+, jouer les publications de résultats, la rotation sectorielle et la force relative, les squeezes, les thèses de fond (chaîne de l'IA, rareté), la lecture du régime de marché ; « concis, actionnable, illustré, compréhensible par un enfant de 10 ans ». Montrer les PDF à l'utilisateur AVANT de publier (« j'aurais dû vérifier plus tôt »). Décrire la méthode sans jargon interne (pas de noms d'outils, de modes ni
de scripts). Voir [[livre-pdf-methode]] et [[feedback-no-hallucination]].

Suite : les six livres blancs « savoir maison » ont été montrés, validés (« publie tout ») et publiés le 13 octobre 2026
(commit df9dbe788, Telegram `learning` message 2098 ; sources `.agent/lb2-<slug>/`, publication via
`.agent/livres-communs/publier_lb2.py`). Leçon : la page de série vers laquelle pointe l'appel à l'action se
fact-checke aussi avant publication. Trois pages en contenaient des erreurs : TPR avec les chiffres d'un autre trimestre,
un « squeeze » démenti par les positions vendeuses publiées ensuite, et des « cas réels » de mars 2026 que les données ne
confirmaient pas. Elles ont été corrigées par une note datée, et les cas de mars sont devenus des cas d'école.

**La règle vaut aussi pour les livres.** Le 13 octobre 2026, après publication des livres « Jouer gros sans se ruiner »
et « Investir en bon père de famille » (sujets génériques : cent ans de bourse, inflation, enveloppes, levier, crypto),
l'utilisateur a dit : « tu m'as fait du main street alors que je voulais un truc qui tape, ça fait quand même presque
1 an que ce repo existe ». Un livre doit se nourrir de l'historique du dépôt (premier commit le 20 déc. 2025) :
rétrospectives hebdomadaires (`data/retro-summary.json` : 1 429 signaux, 386 résolus, 34,6 % d'objectifs atteints),
règles nées des pertes (`data/scanner-lessons.json`, 56 règles), issue des fiches d'analyse (`data/analyses-status.json`),
carnets, incidents datés. Le chiffre qui dérange passe devant, la méthode derrière.
