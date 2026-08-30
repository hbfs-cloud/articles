# Spécification de correction MCP Marketdata — AVGO / analyse institutionnelle retail

Tu es l’owner du MCP `dailytickers-mcp`. Cette spécification est autonome. Elle ne remplace pas une réponse d’analyse et ne demande pas au client de masquer les données manquantes. Elle décrit les défauts observés pendant la construction d’une fiche AVGO au 30 août 2026 et les corrections nécessaires pour rendre le MCP exploitable dans des analyses financières détaillées, reproductibles et orientées retail expert.

## 1. Résultat produit attendu

Une analyse AVGO doit pouvoir récupérer et distinguer proprement:

- quote et clôture de référence;
- barres daily et intraday;
- performance YTD, 1 an et 3 ans;
- benchmark SPY, QQQ et ETF secteur;
- pairs directs, leaders, amont, aval et second ordre;
- corrélations, bêta, R², observations communes et liquidité;
- fondamentaux, résultats, guidance et valorisation;
- SEC, insiders, institutionnels, dilution et dette;
- options par échéance, IV, expected move, open interest et flux inhabituel;
- flux de capitaux avec définition exacte des catégories;
- short interest, CTB et FINRA short volume;
- sentiment social avec volume et direction séparés;
- contexte macro, taux, dollar, commodities, crypto, or, énergie et géopolitique;
- calendrier earnings des pairs;
- qualité, fraîcheur, source, temporalité et erreurs par facet.

Une facet absente ne doit être déclarée `INDISPONIBLE` qu’après une tentative de récupération explicite. Si une facet échoue mais que les autres réussissent, la réponse doit rester partielle et exploitable.

## 2. Format obligatoire de chaque réponse

Chaque réponse de tool doit inclure, au niveau global et au niveau de chaque symbole/facet quand applicable:

```json
{
  "server_version": "...",
  "commit": "...",
  "deployment_id": "...",
  "trace_id": "...",
  "intent_id": "...",
  "status": "completed | pending | partial | failed",
  "temporal_mode": "current | point_in_time | snapshot_only",
  "as_of": "...",
  "quality": "high | medium | low | insufficient",
  "market_state": "open | closed | premarket | after_hours | weekend | unknown",
  "observed_at": "...",
  "event_time": "...",
  "ingested_at": "...",
  "age_seconds": 0,
  "source": "...",
  "warnings": [],
  "errors": [],
  "not_applicable_reason": null,
  "data": {}
}
```

Les timestamps doivent distinguer événement, observation, ingestion et dépôt/filing. `null` signifie inconnu; il ne doit jamais être remplacé par zéro, une chaîne vide ou une date actuelle implicite.

## 3. Défauts fonctionnels reproduits

### MKT-001 — `GetSymbolSignals` accepte une forme différente de celle annoncée

- Input attendu: `GetSymbolSignals({"symbols":"AVGO"})` ou schéma explicitement mono-symbole.
- Résultat observé: `symbol is required` avec `symbols`; succès seulement avec `{"symbol":"AVGO"}`.
- Attendu: support documenté mono-symbole et multi-symboles, ou rejet JSON Schema avant exécution.
- Impact: perte silencieuse des scores opportunity/risk/squeeze dans le générateur.
- Correction: choisir une forme canonique (`symbols` tableau recommandé), conserver un alias compatible si nécessaire et retourner les résultats par symbole.
- Test: mono, multi, symbole inconnu, symbole vide, mélange valide/invalide.
- Acceptation: aucune divergence entre `tools/list`, `GetHelp`, JSON Schema et implémentation.

### MKT-002 — `GetMarketContext` rejette globalement des facets inconnues

- Input: `GetMarketContext({"facets":"regime,commodities,crypto,rates,market_sentiment"})`.
- Résultat observé: `unknown facet "commodities" — must be one of: overview, regime, prediction_markets, cot, seasonality`.
- Attendu: `overview` doit fournir commodities/crypto/rates, ou la route exacte doit être exposée. Une facet invalide ne doit pas supprimer les facets valides.
- Impact: impossibilité de récupérer le contexte macro utile au blast radius.
- Correction: réponse `partial` avec `facets.regime` valide et erreur localisée pour `commodities`; documenter la route `overview`.
- Test: batch valide/invalide, toutes facets valides, overview async, cache miss historique.

### MKT-003 — `QueryData` renvoie une erreur facet au milieu d’un résultat exploitable

- Input: `QueryData({"symbols":"AVGO","types":"options_chain,vol_surface,implied_probability,unusual_options","limit":200})`.
- Résultat observé: job complété, chaîne disponible, mais erreur `implied_probability requires a positive level (the price level to evaluate)` dans le même résultat. L’enveloppe contenait `age_seconds:null`, `event_time:null`, `ingested_at:null`, `quality:null`, `source:null`.
- Attendu: succès partiel: options chain, surface et unusual disponibles; `implied_probability` rejetée avec erreur structurée indiquant que `level` manque.
- Correction: validation des paramètres avant job; erreurs par type; enveloppe complète par facet.
- Test: avec/sans `level`, niveau négatif, plusieurs niveaux, batch mixed success/failure.

### MKT-004 — options hors séance dépendantes d’un spot ambigu

- Input: `QueryData({"symbols":"AVGO","types":"options_chain,vol_surface,unusual_options","limit":200})` hors séance.
- Résultat observé: contrats et IV retournés, mais la réponse ne normalise pas clairement `spot_source`, qualité et état de marché au niveau de la surface.
- Attendu: spot de clôture ou last-known daté, source explicite, age, état fermé et méthode de calcul.
- Correction: exposer `spot`, `spot_observed_at`, `spot_source`, `market_state`, `temporal_mode`, `quality`, `warnings` au niveau de la réponse options.
- Test: marché ouvert, fermé, week-end, quote stale, absence de quote.

### MKT-005 — `implied_probability` ne propose pas de route ergonomique

- Input incomplet: `QueryData(types="implied_probability", symbols="AVGO")`.
- Résultat observé: `implied_probability requires a positive level`.
- Attendu: le schéma doit rendre `level` obligatoire, avec exemple dans `GetHelp`; pour plusieurs niveaux, accepter un tableau ou une route batch.
- Correction: validation immédiate et message indiquant `level`, unité, devise et date de référence.
- Test: zéro, négatif, décimal, plusieurs niveaux, niveau hors chaîne.

### MKT-006 — les flux de capitaux existent mais ne sont pas exposés comme surface stable

- Input: `GetInstruments({"symbols":"AVGO"})`.
- Résultat observé: l’item instrument contient un historique capital_flow du 24 au 28 août. Au 28 août: grandes transactions 58,8 M$ d’entrées, 163,8 M$ de sorties, net -105,1 M$; particuliers 303,3 M$ d’entrées, 444,9 M$ de sorties.
- Attendu: type public documenté `capital_flow`, avec date, devise, unités, définitions des populations et qualité.
- Correction: exposer cette donnée dans `QueryData`, `GetInstruments` et éventuellement `GetSymbolSignals`; ajouter `capital_flow` à `GetHelp`.
- Test: cinq jours, symbole sans données, devise non USD, valeurs nulles; vérifier qu’il n’est jamais nommé dark pool.

### MKT-007 — performance historique incomplète sans diagnostic exploitable

- Input: `QueryData(types="bars_daily", symbols="AVGO,QQQ,SOXX", start_date="2023-08-28", end_date="2026-08-28", adjusted=true, include_partial=false)`.
- Résultat observé côté fiche: YTD et 3 ans non calculables; performance 1 an disponible; benchmarks absents.
- Attendu: chaque symbole doit renvoyer couverture demandée, première/dernière barre, trous, source et raison précise si la fenêtre est tronquée.
- Correction: ne pas retourner seulement une série tronquée; exposer `coverage`, `missing_ranges`, `requested_start`, `served_start`, `served_end`.
- Test: fenêtre complète, fenêtre dépassant la rétention, symbole récent, jours fériés, mélange de couvertures.

### MKT-008 — corrélations comparables impossibles sans raison par symbole

- Input: `RankBeta` ou `QueryData` pour AVGO et l’univers pairs/leaders/secteur.
- Résultat observé: certains titres ont moins de 60 observations communes; corrélation, bêta et R² deviennent indisponibles.
- Attendu: réponse par symbole avec `observations_common`, minimum requis, dates communes et raison `insufficient_overlap`.
- Correction: ne jamais supprimer la ligne; retourner un statut explicite et distinguer non-vérifiable de faible corrélation.
- Test: 0, 1, 59, 60 et plus de 60 observations; séries avec trous.

### MKT-009 — expected move des earnings non renseigné sans cause exploitable

- Input: `GetEarningsCalendarFiltered` pour DELL, CRDO, HPE.
- Résultat observé: événements connus, expected move `null`, warning agrégé mélangeant marché fermé, absence de chaîne, illiquidité et budget.
- Attendu: `implied_move_status` par symbole: `available`, `market_closed`, `no_chain`, `illiquid`, `timeout`, `budget_exhausted`, `not_applicable`.
- Correction: exposer expiration, chaîne utilisée, spot, IV et horodatages.
- Test: chaque cause individuellement et batch mixte.

### MKT-010 — calendrier et analystes contaminés par les timeouts quote/1m

- Input: `QueryData(types="calendar,analyst_actions,analyst_trend,financials", symbols="AVGO")` hors séance.
- Résultat observé: calendar timeout via quote → 1m; analyst actions/trend timeout ou rate-limit malgré fondamentaux disponibles.
- Attendu: les facets fondamentales et calendrier doivent fonctionner avec la dernière quote datée; les analystes doivent échouer isolément.
- Correction: découpler les dépendances 1m, singleflight/circuit breaker, cache et erreurs facet-locales.
- Test: marché fermé, quote stale, rate limit, succès partiel.

### MKT-011 — SEC/insiders/institutionnels sans couverture uniforme

- Input: `QueryData(types="insider,insider_transactions,insider_ownership,institutional_holdings,sec_catalysts,sec_filings", symbols="AVGO")`.
- Attendu: corpus EDGAR officiel, `reported_at`, filing time, accession, source URL, temporal mode, couverture et distinction Form 4/13F/position.
- Correction: manifest de couverture par symbole/type/date; séparer `no_filing`, `not_covered`, `timeout`, `data_not_applicable`.
- Test: Form 4 amendment, 13F retardé, shelf registration, symbole sans CIK, pagination.

### MKT-012 — social: volume disponible mais sentiment directionnel absent

- Input: `GetInstruments({"symbols":"AVGO"})` avec social.
- Résultat observé: compteur Webull de 79 513 posts disponible, mais aucune direction haussière/baissière robuste; la fiche affichait `INDISPONIBLE` partout.
- Attendu: séparer `post_count`, période, source, engagement, sentiment directionnel et qualité. Si seul le volume existe, afficher le volume et `direction unavailable`.
- Correction: ne jamais transformer absence de sentiment en absence totale de données.
- Test: volume seul, sentiment complet, source vide, périodes incohérentes.

### MKT-013 — FINRA short volume mal routé

- Input: `QueryData(types="finra_short_volume", symbols="AVGO", end_date="2026-08-28", days=365)`.
- Résultat observé: `HTTP 400 ... Partition keys missing ... tradeReportDate`.
- Attendu: historique ou erreur source typée, jamais une interprétation directionnelle.
- Correction: partition égalité/date côté serveur, pagination et exposition de la couverture.
- Test: un jour, plage multi-jours, absence de date, symbole inconnu.

### MKT-014 — timestamps manquants dans les réponses et artefacts

- Input: toute requête composite, ainsi que les artefacts persistés d’analyse.
- Résultat observé: plusieurs enveloppes ont `event_time`, `observed_at`, `ingested_at`, `quality` et `source` à `null`; des fichiers `_data/*.json` peuvent exister sans timestamp explicite.
- Attendu: chaque artifact doit porter `generated_at`, `as_of`, `reference_close`, `temporal_mode`, `source`, `source_sha256` et `schema_version`; les données internes doivent porter leurs propres timestamps.
- Correction: manifest obligatoire, validation fail-closed et migration des anciens artifacts avec statut `legacy_timestamp_missing` plutôt qu’invention de date.
- Test: fichier sans timestamp, timestamp invalide, artifact partiel, reprise après interruption.

### MKT-015 — version/déploiement non homogènes dans un même travail

- Input: plusieurs jobs soumis dans la même intention.
- Résultat observé: commits/déploiements différents apparaissent selon les réponses.
- Attendu: chaque job conserve sa version de calcul ou déclare explicitement une migration.
- Correction: figer `deployment_id` par job, retourner commit/worker/trace partout, refuser silencieusement les mélanges.
- Test: déploiement pendant job, retry, pagination, jobs parallèles.

### MKT-016 — healthy global incompatible avec une couverture historique incomplète

- Input: `GetStatus`.
- Résultat observé: service healthy alors que bar service bootstrapping et couverture témoin limitée.
- Attendu: verdicts indépendants par surface: quote, daily, intraday, options, SEC, macro, historique.
- Correction: `health` global + `capabilities[]` détaillées avec `ready`, `coverage`, `freshness`, `degraded_reason`.
- Test: bootstrapping, DB saine mais source externe en panne, barres récentes absentes.

## 4. Règles de non-régression

- Une panne d’une facet ne doit jamais effacer les facets saines.
- Une donnée absente reste `null` avec raison structurée; elle ne devient jamais zéro.
- Une donnée current-only ne doit jamais être présentée comme point-in-time.
- Une faible corrélation ne doit jamais être confondue avec une corrélation non calculable.
- Le volume FINRA short n’est jamais appelé dark pool, accumulation ou flux acheteur.
- L’open interest n’est jamais présenté comme flux directionnel.
- Le max pain n’est jamais présenté comme support, résistance ou breakeven.
- Une IV calculée sur cinq contrats doit porter son échantillon et sa qualité.
- Une source Webull, Yahoo, SEC ou autre doit être nommée dans chaque facet.
- Les résultats paginés doivent être concaténés sans recalcul; les tokens doivent être réutilisables.
- Les jobs `pending/running` ne doivent pas être déclarés échoués avant leur délai contractuel.
- Aucun token, JWT ou secret ne doit apparaître dans les logs, réponses ou artifacts.

## 5. Livrable owner requis

Retourner un tableau, sans texte générique:

| ID | Endpoint/module | Cause racine | Patch livré | Test ajouté | Version | Statut |
|---|---|---|---|---|---|---|

Pour chaque incident, joindre:

1. input exact;
2. réponse JSON actuelle;
3. réponse JSON attendue;
4. migration ou changement de schéma;
5. test de non-régression;
6. compatibilité avec les anciens clients;
7. date de déploiement;
8. limites restantes.

Le statut `fixed` n’est accepté que si le test reproduisant le défaut passe, si `tools/list` et `GetHelp` sont cohérents, et si une réponse mixte ne perd aucune donnée valide.
