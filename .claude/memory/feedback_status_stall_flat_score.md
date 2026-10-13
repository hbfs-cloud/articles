---
name: status-stall-flat-score
description: /scanner/status figé du 4 sept. au 12 oct. 2026 — score éditorial plat (80) contre minScore 85-90, sharia:false codé en dur, crible fortress-pm sauté, DTX en compare_only ; admettre le score plat aurait perdu 3-4 % sur 30 jours, donc config inchangée
type: feedback
---

Constat du 2026-10-13 : les courbes de turbo, dynamic, balanced et fortress s'arrêtaient au 4 septembre,
celle de best au 18 septembre. La page était régénérée chaque soir ; c'est le suivi qui ne prenait plus
aucune entrée.

Causes empilées :
1. `tools/build-scan.js` publie depuis le 2026-09-08 `score: 80, scoreSource: 'flat_no_ranking_asserted'`
   (décision de méthode : score sans pouvoir prédictif, familles incomparables). Les modes exigent
   minScore 90/88/85 → zéro éligible. Le commit d'origine croyait que 80 garderait les modes en vie
   (« sweep.js:285 fait `s.score || 80` ») sans voir le seuil.
2. `build-scan.js` écrit `sharia: false` sur chaque ligne ; fortress (shariaOnly, regimeFilters
   mom_bo/breakout_only) ne peut donc rien lire du panier publié.
3. Le crible propre du skill fortress-pm (STEP 0, mid-cap 2-20 Md$) n'était plus exécuté : les revues
   relisaient seulement le panier publié. Exécuté le 13/10 : 71 titres, 0 A+ (pool vide prouvé).
4. best : DTX en compare_only depuis le 24/09 (décision du propriétaire) → aucun ordre.
5. Affichage : la courbe s'arrêtait à la dernière sortie au lieu de la clôture certifiée.

Preuve qui a tranché (validateur canonique, scans du 08/09 au 12/10, minScore 80) : turbo −3,31 %
(6 trades), dynamic −0,64 % (2), balanced −3,67 % (10) sur 30 jours, contre 0 % en liquidités. Le gate
« battre la config actuelle » refuse le changement. Détail : docs/reviews/scanner-status-arret-20261013.md.

**Why:** un contrat de producteur (score plat) a changé sans que les consommateurs (minScore, shariaOnly)
soient revus ; le système n'a rien cassé bruyamment, il s'est tu. Le silence ressemblait à du calme pendant
cinq semaines, et la page figée ressemblait à une panne alors que le blocage protégeait le capital.

**How to apply:**
- Tout changement de champ produit par `build-scan.js` (score, sharia, strategy) : lister les consommateurs
  (sweep minScore/shariaOnly/regimeFilters, gen-status-page, gen-api) et rejouer `validate-config-change.js`
  sur la fenêtre touchée AVANT de publier.
- Un mode sans entrée depuis plusieurs scans n'est pas forcément cassé : mesurer ce qu'aurait donné
  l'admission avant de « réparer ». Ne jamais abaisser un seuil sans ce backtest.
- `/scanner` étape 9 : exécuter le STEP 0 de fortress-pm (crible propre), pas seulement relire le panier.
- La page status prolonge désormais à plat (« Liquidités ») jusqu'à `frozenUpdate.reference_close` et nomme
  la cause sous chaque courbe ; si une cause affichée ne correspond plus au code, la corriger.
- Décision ouverte (au propriétaire) : règle d'admission sans score pour turbo/dynamic/balanced, ou pause
  officielle via set-mode-status.js. Voir [[preview-must-not-bypass-gates]] et [[fortress-starvation-aug2026]].
