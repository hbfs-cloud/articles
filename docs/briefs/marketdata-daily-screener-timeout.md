# Brief owner — marketdata MCP : le screening journalier est inatteignable et échoue en vivier vide

**Serveur** : `mcp.dailytickers.com` · build `d24684fb` (commit `d24684fbb8f415d8bd7632f23a25f7d17a75f24c`, ldflags `2026-09-01T11:52:48Z`)
**Constaté le** : 2026-09-05, sur serveur certifié sain (`bars_daily_us_equity.status=ready`, `served_completed_end=2026-09-04`, `run_screener_price_technical=ready`)
**Impact** : le scanner quotidien US n'a plus de source de vivier. Aucune publication possible.

---

## 1. Le défaut en une phrase

`RunScreener` et `RunAutoScreener` en `timeframe=1d` sur `region=US, asset=stock` **ne terminent jamais** :
ils meurent systématiquement au plafond serveur de 5 minutes, quel que soit le paramétrage. Le seul
`timeframe` qui aboutit est `15m`, parce qu'il ne balaie que l'univers intraday (483 symboles) au lieu
des 22 276 symboles du daily.

## 2. Mesures reproductibles

Toutes lancées **sérialisées** (pool async `idle`, `busy=0`, `queued=0`), serveur sain :

| Appel | Univers | Durée | Issue |
|---|---|---|---|
| `RunScreener` 1d, DSL d'origine | 22 276 | 307 s | `operation=RunScreener timeout phase=custom_scan limit=5m0s: context deadline exceeded` |
| `RunScreener` 1d + `disk_scan=true` | 22 276 | 306 s | idem `phase=custom_scan limit=5m0s` |
| `RunScreener` 1d, clauses réordonnées cheap-first + `min_bars=50` | 22 276 | 307 s | idem |
| `RunScreener` 1d, préfixé `market_cap > 5e8 && avg_volume > 1e6` | 22 276 | 307 s | idem `phase=custom_scan limit=5m0s` |
| `RunAutoScreener` 1d (planchers par défaut) | 22 276 | 598 s | `operation=RunAutoScreener timeout phase=screening limit=5m0s` |
| `RunScreener` 15m (défaut) | 483 | ~180 s | `completed`, 0 candidat |

`pass_expr` utilisé pour les variantes RunScreener :
`rsi14 > 53 && rsi14 < 70 && macd > 0 && vol > 1500000 && close > 10`

La cinquième ligne est la plus instructive : préfixer le `pass_expr` de deux clauses de **métadonnées
statiques** (`market_cap`, `avg_volume` — non dérivées des barres) ne change strictement rien à la durée.
L'évaluateur charge donc les barres et calcule les indicateurs de chaque symbole **avant** d'appliquer
ces clauses. C'est le fondement de la demande n°4.

Un job intermédiaire observé à `progress=24` après ~300 s : l'extrapolation linéaire donne **~20 minutes**
pour un balayage daily complet, soit environ 4× le plafond actuel.

## 3. Pourquoi c'est plus grave que « c'est lent »

**L'échec est silencieux et ressemble à un résultat légitime.** Quand `timeframe` n'est pas passé, le
serveur bascule en `15m` dès que l'univers intraday est prêt (comportement documenté dans le schéma).
Les seuils d'un screener swing sont alors interprétés sur des bougies de 15 minutes :

```
"zero-result diagnosis: clause `vol > 1500000` alone matches 0 of 200 sampled symbols
 — likely the blocking clause"
```

`vol > 1500000` signifie « 1,5 M d'actions sur la bougie courante ». En journalier c'est un plancher de
liquidité banal ; en 15 minutes, plus personne ne passe. Le job rend `status: completed`, `total: 0`,
**exit 0**. Un appelant qui ne lit pas `metadata.timeframe` publie un scan à zéro signal en croyant que
le marché n'offrait rien ce jour-là. Le diagnostic par clause du serveur est excellent et c'est lui qui
nous a mis sur la piste — mais il arrive dans `warnings[]`, pas dans un code d'erreur.

## 4. Ce qui est demandé

Par ordre de valeur décroissante :

1. **Un bornage d'univers explicite sur `RunScreener` / `RunAutoScreener`.**
   Un paramètre `universe_ids` (mêmes identifiants que `ListMarketUniverses`, ex.
   `stockanalysis_current_snapshot:us:index:sp500`) ou `symbols` permettrait un scan daily borné qui
   tient largement dans les 5 minutes. `GetMarketUniverseSnapshot` accepte déjà jusqu'à 8 000 symboles
   de barres : la couche données sait le faire, seul le screener n'expose pas le point d'entrée.

2. **Faire échouer bruyamment le mélange timeframe / seuils.**
   Deux options, non exclusives : (a) rendre le `timeframe` retenu explicite dans une erreur quand le
   défaut diverge de ce que l'appelant a supposé ; (b) promouvoir le « zero-result diagnosis » en
   `status: failed` ou en champ de premier niveau lorsque 100 % de l'univers est éliminé par une clause
   unique. Un vivier vide silencieux est le pire des modes de défaillance pour un pipeline de publication.

3. **Documenter le plafond de 5 minutes comme une contrainte de conception.**
   Le schéma de `RunScreener` expose `timeout` (défaut 30 s, max 90 s), ce qui suggère à tort que
   l'appelant contrôle la durée. Le vrai plafond est le cap job de 300 s, invisible dans la surface de
   l'outil et non ajustable. À défaut de le relever, l'énoncer.

4. **Pousser les clauses de métadonnées statiques avant le chargement des barres.**
   Le DSL expose `market_cap`, `avg_volume`, `in_index`, `sector`, `exchange`, `asset_type` — aucune
   n'est dérivée des barres. Mesure ci-dessus : préfixer le `pass_expr` de
   `market_cap > 5e8 && avg_volume > 1e6` ne fait **rien gagner** (307 s, même timeout), donc ces clauses
   sont évaluées après le calcul des indicateurs. Les pousser en amont (predicate pushdown) élaguerait
   l'univers à coût quasi nul : un plancher à 500 M$ de capitalisation et 1 M d'actions de volume moyen
   retire l'essentiel des 22 276 symboles avant qu'une seule barre ne soit lue. C'est le meilleur rapport
   effort/gain identifié, et il bénéficierait à tous les appelants sans changer une ligne de DSL.

## 4bis. Facette `regime` — alignement demandé sur `DtxRegime`

Défaut distinct du screener, trouvé pendant la même revue : les deux moteurs de régime
décrivent le même état avec des chiffres **opposés**.

| Source | Aujourd'hui (clôture 2026-09-04) | Échelle |
|---|---|---|
| `systematic.DtxRegime` | `RISK_ON`, `regime_score = 0.79` | 0–1, **haut = risk-on** |
| `marketdata.GetMarketContext(facets=regime)` | `current_state = risk_on`, `regime_score = 0` | 0–100 **défensivité**, *0 = plein risk-on* |

Un consommateur qui câble `regime_score` sans lire le champ `scale` publie une inversion de
signe silencieuse. Le piège est réel et non théorique : un test de sous-chaîne naïf `0-1`
matche à l'intérieur de la chaîne `"0-100 defensiveness"`, ce qui suffit à retourner le sens.

**Contrat cible retenu — marketdata s'aligne sur `DtxRegime` :**

```
{
  "regime":       "RISK_ON" | "NEUTRAL" | "EARLY_RISK_OFF" | "RISK_OFF" | "RECOVERY",
  "regime_score": 0.0 .. 1.0,     // haut = risk-on, MÊME sens que DtxRegime
  "data_asof":        "YYYY-MM-DD",
  "requested_asof":   "YYYY-MM-DD",
  "sessions_behind":  0
}
```

Trois exigences qui comptent autant que le format :

1. **Même sens et même unité que `DtxRegime`.** Pas de champ `scale` à interpréter : si deux
   sources doivent être comparables, l'unité doit être imposée, pas décrite.
2. **Rejouabilité point-in-time.** La facette est aujourd'hui *current-only*. C'est ce qui la
   disqualifie comme référence publiable : une valeur qu'on ne peut pas réauditer après coup ne
   peut pas soutenir un article. `DtxRegime` accepte `asof` + `expected_data_date` et rend
   `sessions_behind` — même surface attendue ici.
3. **Ne pas rendre un avis sans le dire.** La réponse du jour porte
   `current_state_confidence: 0.5` avec `probabilities: {risk_on: 0.5, neutral: 0.5}` — un pile
   ou face — et un avertissement sur ses propres entrées (`insufficient daily bars for TLT (36)`).
   Conserver ces champs après alignement : un contradicteur qui signale qu'il n'a pas d'avis est
   utile ; un contradicteur muet ne l'est pas.

Côté client, l'alignement est déjà instrumenté : `tools/regime-reconcile.js` prend systematic
pour autorité, marketdata pour contradicteur, et refuse la publication sur désaccord de label ou
écart supérieur à `max_bullish_divergence_pts` (15). Il tourne aujourd'hui et **bloque** :
79/100 contre 100/100, soit 21 points d'écart.

## 5. Contexte d'exploitation

Un incident distinct, probablement lié à la charge, est survenu pendant ces essais : après plusieurs
scans daily lourds, l'origine a renvoyé des `502 origin_bad_gateway`, puis le service a redémarré et
**servi une clôture antérieure** (`served_completed_end` régressé de `2026-09-04` à `2026-09-02`,
`bar_service_status=bootstrapping`, couverture 24,9 %). Le serveur a signalé la régression lui-même
(`bar_service_1d_witness_stale: "SPY serves last 2026-09-02 while the freshest close is 2026-09-04"`),
ce qui a permis de bloquer côté client — le contrat de fraîcheur a bien joué son rôle. Reconstruction
complète en ~3 minutes. À considérer si les scans daily plein-univers doivent rester possibles : ils
semblent capables de faire tomber l'origine.

## 6. Comment vérifier le correctif

```
RunScreener(
  pass_expr = "rsi14 > 53 && rsi14 < 70 && macd > 0 && vol > 1500000 && close > 10",
  score_expr = "rsi14 + (macd > 0 ? 15 : 0)",
  region = "US", asset = "stock", timeframe = "1d", top_k = 40
)
```

Attendu : `status: completed` avec `metadata.timeframe == "1d"`, `metadata.total_symbols` reflétant
l'univers réellement balayé, et un nombre de candidats non nul un jour de marché normal.

### Résultat de la vérification — build `87424cc4`, 2026-09-05 17:13Z

**Corrigé.** `PLAIN-1d OK in 258s — total=40 cands=40 tf=1d syms=5501`. Le scan journalier
personnalisé termine désormais sous le plafond, avec 40 candidats et le bon timeframe. Les
demandes 1 et 3 sont satisfaites de fait.

**Une réserve, qui est la demande 2 restée ouverte.** L'univers balayé est passé de 22 276 à
**5 501 symboles**, alors que `GetStatus` au même instant rend `bars_daily_universe` à
`coverage_progress: 100.0%`, `ready_symbols: 22276`, `service_status: ready`. Les barres sont donc
toutes là : le gain de temps vient d'un **bornage de l'univers de screening à ~25 %**, pas d'une
accélération. C'est vraisemblablement le predicate pushdown demandé en 4, et c'est la bonne
solution — mais **le critère de bornage n'est déclaré nulle part dans la réponse**. Le seul témoin
est `metadata.total_symbols`, qu'un appelant peut parfaitement ne pas lire.

C'est précisément le mode de défaillance décrit en §3 : un résultat qui a l'air complet et qui
porte en réalité un quart de l'univers. Deux demandes concrètes :

- exposer le critère appliqué et le décompte exclu, par exemple
  `metadata.universe_filter: "market_cap>=5e8 && avg_volume>=1e6"` avec
  `metadata.symbols_excluded: 16775` ;
- rendre le bornage **contrôlable par l'appelant** plutôt qu'implicite, afin qu'un consommateur
  qui a besoin des small caps puisse le dire — et surtout puisse savoir qu'il ne les a pas.

### Coupures répétées le 2026-09-05 — churn de déploiement, PAS surcharge

Trois interruptions dans la soirée (20:40Z, 21:44Z, plus celle de 17:00Z). Ma première hypothèse
était la surcharge par les screeners journaliers. **Les identifiants de build la contredisent :**

```
d24684fb  →  87424cc4 (17:08Z)  →  ee084ad1 (21:32Z)  →  079e9503 (21:45Z)
```

Quatre déploiements en une soirée. À 21:45Z, `GetStatus` répond `bar_service_status: initializing`,
`coverage_progress: 0.0%`, `num_gc: 128`, `alloc_mb: 113`, `goroutines: 60` — l'empreinte d'un
processus qui vient de démarrer, pas d'un serveur saturé. Les 502 coupent les requêtes en vol au
moment du redémarrage, et le cache de barres repart de zéro à chaque fois.

Ce n'est donc pas un défaut de capacité et il n'y a rien à durcir côté charge. Deux remarques
utiles quand même, sur ce que le redémarrage rend visible :

1. **Faux-vert pendant la reconstruction.** Aux trois coupures, `bars_daily_us_equity.status`
   restait `ready` avec `served_completed_end: 2026-09-04` pendant que `bars_daily_universe`
   affichait `0.0%` et `ready_symbols: 0`. Une clôture déclarée certifiée alors qu'aucune barre
   n'est chargée. Un client qui ne croiserait que le premier champ — ce que la documentation
   invite pourtant à faire via `operation_readiness.<operation>.status` — publierait sur du vide.
   Le gate devrait refléter la couverture, ou le dire.
2. **Reconstruction ~3 minutes**, mesurée deux fois. C'est rapide, mais suffisant pour tuer une
   collecte en cours. Un en-tête de version ou un champ `restarting_since` permettrait à un
   appelant d'attendre proprement au lieu d'interpréter un 502 comme une panne.

Côté client, notre part est faite : `collect.js` porte un coupe-circuit qui interrompt la collecte
au premier 502 plutôt que d'insister sur une origine en échec, et les chaînes du scanner sont
désormais lancées séparément pour ne pas cumuler leur pression de sondage.

**Non corrigé et sans lien avec le screener :** `sec_live` est repassé en `initializing` avec
`SEC current-filings startup scan exceeded 2000 entries before reaching the 72h recovery horizon`,
et `sec_historical.certified_days` est retombé de 29 à 0. La découverte `sec_filings,flags` par
`QueryData` reste fonctionnelle (vérifiée le même jour, 4/4 cellules `completed`), donc la chaîne
de preuve dilution du scanner n'est pas bloquée — mais l'ingestion SEC mérite un regard séparé.
