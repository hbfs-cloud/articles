---
name: bar-cross-contamination-bkng-crwd
description: Deux tickers distincts ont partagé la même clôture au centime et le même prix limite à 13 décimales — contamination croisée dans les barres en amont, invisible pour le garde-fou de cohérence qui ne contrôle que les métriques de backtest
metadata:
  type: feedback
---

Constaté le 2026-08-08 pendant le staging dtx du scan 20260810, par un agent de vérification.

## Le fait

Le moteur systematic a émis, sur `stockbox_pit` (et donc aussi sur `book_honest` qui contient cette
poche), deux ordres CREATE portant un `limit_price` **strictement identique à 13 décimales** :

| ticker | limit_price | stop_loss | clôture 2026-08-07 |
|---|---|---|---|
| BKNG | 220.8525981140137 | 189.94321768624442 | 213,88 |
| CRWD | 220.8525981140137 | 187.56056431361608 | 211,57 |

Les stops diffèrent, les clôtures diffèrent : une collision fortuite à 13 décimales est exclue.
Le tampon limite/clôture n'est pas uniforme sur les 10 ordres du portefeuille (de +1,39% sur ALAB à
+4,39% sur PLTR), donc la valeur n'est pas dérivée d'une règle commune.

**La cause est en amont du moteur.** Vérification directe sur les barres quotidiennes :

| date | BKNG close | CRWD close |
|---|---|---|
| 2026-08-05 | 207,02 | 209,86 |
| **2026-08-06** | **207,3899** | **207,3899** |
| 2026-08-07 | 213,88 | 211,57 |

Une seule séance où les deux coïncident au centime, encadrée de deux séances où elles diffèrent.
C'est une contamination croisée dans la série de barres, pas un artefact de calcul.

## Pourquoi rien ne l'a attrapé

`dtx-mcp-ingest.js` appelle `assertReplaySanity()`, qui contrôle les **métriques de backtest**
(drawdown, sharpe, win_rate, cagr, nombre de trades) contre `config/dtx/_sanity-baselines.json`.
Les six modes sont sortis en code 0, `metricsSuspect:false` — et c'était correct : les métriques
étaient saines. Le garde-fou ne regarde simplement pas les **prix des ordres**.

Impact concret : `qty` identique (44) pour les deux lignes, soit environ 9 717 USD de notionnel
chacune, donc un dimensionnement potentiellement faux sur au moins l'une des deux.

**Why:** un garde-fou de cohérence sur les agrégats ne dit rien des valeurs unitaires. Des métriques
de backtest parfaitement normales peuvent coexister avec des ordres du jour faux, parce que le
backtest et la décision du soir n'empruntent pas le même chemin de données. Un mode qui « passe le
sanity gate » n'est donc pas un mode dont les ordres sont vérifiés.

**How to apply:**
1. Ajouter un contrôle d'UNICITÉ sur les ordres d'une même décision : deux `limit_price` identiques
   au-delà de 4 décimales sur des symboles différents = anomalie, à signaler avant exécution.
2. Recouper systématiquement le `limit_price` de chaque ordre avec la clôture du symbole à la date
   d'as-of : le tampon implicite doit être plausible et cohérent avec les autres ordres du même
   portefeuille. Un tampon isolé à +4,39% quand la médiane est à +3% mérite un regard.
3. Signature à reconnaître dans les barres : deux symboles distincts partageant une clôture à
   l'identique sur UNE séance. Le contrôle est bon marché — comparer les clôtures deux à deux sur la
   fenêtre récente — et il attrape une classe d'erreur que rien d'autre ne voit.
4. Ne jamais conclure « données saines » d'un `exit=0` de l'ingest : cet exit n'atteste que des
   métriques de replay. Voir [[gates-certify-green-on-nothing]] — même famille, un contrôle qui
   répond vert sur ce qu'il ne regarde pas.
