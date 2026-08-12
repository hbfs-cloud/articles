# Demande à l'owner de `mcp.dailytickers.com` (marketdata) — panne du 2026-08-12 + observabilité

*(prompt autoportant : à copier tel quel, il ne suppose aucun contexte de la conversation d'origine)*

---

## Le problème en une phrase

Le service est tombé pendant la fenêtre de production du soir, il a d'abord renvoyé des **429 sur
la résolution des jobs asynchrones** — ce qui a fait accuser un quota client qui n'était pas en
cause — puis des **502 jusque sur `GetStatus`**, l'appel le plus léger.

## Chronologie mesurée (2026-08-12, heures UTC)

| heure | fait |
|---|---|
| 20:14 | `GetStatus` répond, `status: healthy`, `bar_service_status: ready`, barres du 12/08 ingérées (`max_last_bar_date: 2026-08-12`, lag 0). **Mais `goroutines: 21608`**, `heap_alloc_mb: 465`, `sys_mb: 1149` |
| ~20:36 | collecte du soir : 4 screeners échouent, tous en **`job async : HTTP 429`** — `RunAutoScreener`, `RunScreener` ×3. `GetMarketContext` et `GetInsiderActivity` expirent à 90 s |
| 20:36→21:21 | la chaîne met **2 694 s (45 min)** à mourir en continuant à solliciter l'origine |
| 21:20 | `RunScreener` direct → **502 Bad gateway** (Cloudflare `origin_bad_gateway`, ray `a2a286ce5de14e84`) |
| 21:21 | `GetStatus` direct → **502** (ray `a2a2870d0d014e84`) |

**Ce n'est pas un quota client.** Sur toute l'heure, le desk a émis **5 appels de screener** au
total (comptés dans les journaux), face à une limite annoncée de **500/h par jeton**. Le jeton
lecture-seule était valide et non expiré au moment des 429.

## Trois demandes, par ordre d'importance

### 1. Les 21 608 goroutines — la piste

C'est le seul signal anormal visible **avant** la panne, et il l'était déjà 1 h avant les 502. Un
service Go sain tient en dizaines ou centaines de goroutines. 21 608, avec 465 Mo de heap, ressemble
à des goroutines qui ne se terminent pas — typiquement des requêtes sortantes sans timeout, ou des
jobs asynchrones dont le contexte n'est jamais annulé quand le client abandonne.

Piste concrète : les jobs sont plafonnés à 300 s côté serveur, mais le client peut abandonner bien
avant (nous coupons à 90 s sur certains appels). Si l'annulation du client ne propage pas
`context.Cancel` jusqu'aux goroutines de calcul, chaque abandon en laisse une derrière lui.

**Ce que je demande** : vérifier la fuite (un `/debug/pprof/goroutine?debug=1` sur l'origine dira en
deux minutes où elles s'empilent) et, si elle est confirmée, propager l'annulation.

### 2. Le 429 sur le POLLING des jobs est trompeur

L'erreur nous est parvenue sous la forme `job async : HTTP 429` **pendant la résolution** du job
(appels `Jobs`/`CheckJobStatus`), pas à la soumission. Deux lectures possibles, et rien ne permet de
trancher côté client :

- soit le polling a sa propre limite de débit — alors elle doit être **documentée** (nous pollons
  toutes les 6 s, ce qui suit la consigne « poll every 5-10s » de la description de `Jobs`) ;
- soit l'origine était déjà en train de tomber et Cloudflare a rendu 429 avant de rendre 502 —
  auquel cas le code **ment sur la cause**, et c'est ce qui nous a fait chercher un quota pendant
  une demi-heure.

**Ce que je demande** : que la limitation de débit, si elle existe, renvoie un `retry_after` et un
motif typé (`rate_limited` vs `origin_unavailable`). Un 429 nu, sur un service qui va tomber
90 secondes plus tard, envoie le diagnostic dans le mur.

### 3. `GetStatus` doit survivre à la charge

Un endpoint de santé qui répond 502 quand le service est chargé ne sert à rien : c'est précisément
le moment où on l'interroge. Idéalement il ne touche ni la base ni le chemin lourd, et reste servi
même quand les workers sont saturés.

**Critère d'acceptation** : sous la charge d'une salve de screeners, `GetStatus` répond en moins
d'une seconde, avec `status: degraded` si les workers sont saturés — un état intermédiaire vaut
mieux qu'un 502 qui ne distingue pas « surchargé » de « mort ».

## Ce que nous avons corrigé de notre côté (pour information)

- **Coupe-circuit de panne d'origine** : dès 2 appels d'une vague rejetés par l'infrastructure
  (429/502/503/504), la collecte s'arrête immédiatement au lieu de mettre 45 minutes à mourir, et
  nomme la cause « service indisponible ». Nous n'ajouterons plus de charge à une origine en échec.
- Nous appliquons le HARD STOP : **aucun contenu n'a été produit ni publié** sur des données
  partielles. Rien n'a été inventé pour compenser.

## Contexte d'usage

Cette fenêtre (22h00–23h00 Paris) est celle où le desk produit le scan de la séance suivante, le
briefing quotidien et les signaux. Une panne à cette heure-là fait sauter la production du soir en
entier. Les données du jour étaient pourtant bien ingérées à 20:14 — c'est le service qui n'a pas
tenu, pas la donnée qui manquait.

---

### Références utiles pour le diagnostic

- rays Cloudflare : `a2a286ce5de14e84` (RunScreener), `a2a2870d0d014e84` (GetStatus), 2026-08-12 21:20–21:21 UTC
- version servie au moment des faits : `dailytickers-mcp`, commit `b2266ed`, build `20260812T134603Z`
- appels en échec : `RunAutoScreener`, `RunScreener` (momentum US, breakout US, EU),
  `GetMarketContext` (facet overview), `GetInsiderActivity`
