# EDITORIAL_STYLE.md — Voix éditoriale DailyTickers (canonique, reproductible)

> **Règle #1, tous supports, tous auteurs (humains ET routines cloud).** Tout contenu publié
> doit être **concis, direct, actionnable, et indétectable comme IA**. Un lecteur averti ne
> doit ni pouvoir dire « c'est écrit par une IA », ni sentir un texte « propre mais vide ».
> Ce fichier est la source de vérité. Les routines cloud (daily/weekly/scanner/analyses) le
> lisent via le repo et DOIVENT l'appliquer avant publication (site, Substack, Telegram).

Il y a **deux couches**. La couche 1 ne suffit pas : un texte peut être « propre » et quand même
crier IA parce qu'il n'a **aucune empreinte intellectuelle**. La couche 2 est ce qui distingue un
analyste d'un LLM alimenté par des données.

---

## Couche 1 — Style (anti-tics)

- **Bannir le signposting et les formules toutes faites.** Interdits (liste vivante, cf
  `tools/check-ai-tells.js`) : « Hold one idea… », « Here's the thing / here's what / here's how »,
  « The bottom line », « That divergence is the whole story », « One more thing », « Two numbers
  will tell me… », « And one to leave alone », « buckle up », « let's dive in », « it's worth
  noting », « in a world where », « delve », « tapestry », « game-changer », « navigating the… ».
  FR : « il est important de noter », « force est de constater », « sans plus attendre ».
- **Pas d'analogie explicative forcée** (« Picture musical chairs… », « Think of it like… »). C'est
  la signature n°1 d'un LLM à qui on demande de vulgariser. Si une image sert, qu'elle soit brève,
  originale et non-scolaire.
- **Pas de structure scolaire** hook → analogie → ce qui a baissé → ce qui a monté → pourquoi pas un
  krach → 3 idées → 2 indicateurs → conclusion. C'est le template GPT par défaut. Varier l'ordre,
  fondre l'analyse dans le récit, ne pas numéroter mécaniquement.
- **Varier le rythme.** Phrases courtes ET longues, fragments assumés. Éviter les paragraphes trop
  lisses et homogènes (chaque paragraphe de même longueur = tell).
- **Punctuation.** Pas de surdose d'em-dash (`—`) : max ~6 pour 500 mots. Préférer point,
  deux-points, virgule. Pas de tricolons parfaits à répétition (« X, Y, and Z » partout).
- **Voix + opinion.** Un point de vue assumé (« I'd rather own the bounce than the blow-off »),
  pas une synthèse neutre. Le « je » d'analyste est autorisé et souhaitable.

## Couche 2 — Empreinte intellectuelle (le vrai signal humain)

Un bon article contient de l'info que **seul quelqu'un qui a creusé** pourrait écrire. Checklist
obligatoire (chaque article doit cocher ≥4) :

1. **Le catalyseur PRÉCIS et vérifié**, pas « tech en baisse ». Ex : pas « les semis chutent » mais
   « peur de **glut mémoire** : SanDisk/Micron/Seagate plongent ensemble, Micron publie dans une
   plainte, l'industrie demande à Washington de ne pas distordre le marché mémoire ». → via
   `QueryData types=news`.
2. **Les flux institutionnels réels** : qui se positionne, où. Ex : « ~29 000 calls GDX au strike
   $82, 5× l'open interest » / « puts SMH empilés de $400 à $585 = couverture, pas achat de creux ».
   → via `QueryData types=unusual_options,dark_pool`.
3. **Une asymétrie / nuance non-consensuelle.** Ex : « les deux gagnants ne sont pas le même trade :
   les mines sortent d'une correction (sous 50/200-day, RSI 40s = tôt) ; la santé est à un plus-haut
   52s RSI 72 = tard ». → via `QueryData types=technicals,quote` (RSI/EMA/52w).
4. **Une thèse falsifiable + conséquence semaine suivante.** « Je change d'avis si la peur passe de
   la mémoire au compute (Nvidia casse) ou si le 10Y franchit 4,49 % ». Pas de conclusion molle.
5. **Un cadre d'auteur reconnaissable** : une lentille (positionnement, ce-qui-casse-en-premier,
   qualité vs momentum) qui revient et donne une personnalité au propos.
6. **Chiffres réels et précis** (niveaux, entries/stops, perfs, contrats) — jamais inventés
   (règle No Hallucination). C'est le socle de crédibilité ET l'actionnable.

> Test décisif : si un lecteur pouvait obtenir ~le même texte en collant les prix du jour dans un
> LLM avec « écris une newsletter grand public sur la rotation », l'article a échoué. Ajoute du
> spécifique vérifié jusqu'à ce que ce ne soit plus vrai.

---

## Recette reproductible (à exécuter AVANT d'écrire — routines incluses)

```
1. Contexte marché      : GetMarketContext facets=regime ; QueryData types=indices,commodities,
                          crypto,rates,performance_rotations
2. Catalyseur vérifié   : QueryData types=news symbols=<noms au cœur du move>   (le VRAI pourquoi)
3. Flux institutionnels : QueryData types=unusual_options,dark_pool symbols=<gagnants+perdants>
4. Asymétrie/technique  : QueryData types=quote,technicals symbols=<véhicules>  (RSI/EMA/52w)
5. Niveaux actionnables : entries/stops/targets ancrés sur EMA/ATR/52w réels (jamais inventés)
6. Écrire selon couches 1+2, puis  node tools/check-ai-tells.js <path> --strict
```

## Registre par canal (la concision + l'anti-IA s'appliquent PARTOUT ; seul le niveau change)

- **Site** (`articles.dailytickers.com`) : institutionnel, FT/Economist + précision terminal (cf
  `PRODUCT.md`). Dense, mono pour la data.
- **Substack / Telegram** : ultra-simple, lisible par un enfant de 10 ans — MAIS jamais superficiel
  (couche 2 obligatoire quand même). Simple ≠ vide.

## Contrôle

- `node tools/check-ai-tells.js <path.html|path.md> [--strict]` — flague les tics de la couche 1.
  Zéro finding ≠ garantie ; ça n'attrape PAS l'absence d'empreinte (couche 2 = jugement).
- Avant toute publication : relire contre la checklist couche 2 (≥4 cochés) et le linter.

## Exemplaire de référence

Le post Substack « The best stock of the year just cracked… » (juillet 2026) : ouvre sur un fait
précis et surprenant (SanDisk, meilleure action du S1, s'effondre), catalyseur vérifié (glut
mémoire), flux réels (calls GDX / puts SMH), asymétrie (mines tôt vs santé tard), thèse falsifiable
(mémoire→compute, 10Y 4,49 %), cadre d'auteur, niveaux réels, 0 tic. Contre-exemple : la v2
« musical chairs » (analogie forcée + plan scolaire + zéro empreinte) — rejetée.
