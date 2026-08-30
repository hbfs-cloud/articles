# Prompt owner MCP marketdata - audit reproductible du 30 août 2026

Tu es l'owner senior du MCP `dailytickers-mcp`. Corrige les défauts ci-dessous sans casser les schémas visibles. Pour chaque cas, fournis cause racine, patch, test de non-régression, version déployée et exemple de réponse corrigée. Les observations proviennent d'un run AVGO authentifié, clôture attendue `2026-08-28`, versions vues successivement `c8e6b2e3` puis `8064b400`. Ne demande et n'affiche aucun token.

## Format obligatoire pour chaque ID

Ne réponds pas par une synthèse générale. Pour chaque `MDP-*`, restitue exactement les champs suivants :

1. `input`: appel complet, paramètres, contexte temporel, pagination et état d'authentification non secret.
2. `expected`: schéma, cardinalité, ordre, temporalité, fraîcheur, qualité et comportement partiel attendus.
3. `current`: sortie JSON ou erreur exacte observée, avec symbole/facet/page concerné, version serveur et limites connues.
4. `root_cause`: cause confirmée ou hypothèse explicitement étiquetée, jamais présentée comme un fait non vérifié.
5. `impact`: conséquences sur l'attribution, le point-in-time, la décision ou la sécurité.
6. `proposal`: module/fichier, patch précis, évolution de schéma et compatibilité.
7. `regression_test`: fixture d'entrée, assertions exactes, cas nominal, erreur, partial failure, ETF/symbole récent et pagination si applicable.
8. `acceptance`: critères mesurables de succès et exemple de réponse corrigée minimale.
9. `owner_status`: `fixed`, `in_progress`, `blocked` ou `not_reproducible`, version/commit déployé, date et preuve du test.

Joins en annexe les payloads complets ou des extraits JSON suffisamment longs pour vérifier les champs contestés; ne remplace jamais une valeur absente par `0`, une date actuelle ou une hypothèse. Distingue toujours défaut MCP, défaut de client local et défaut de données upstream.

## Priorité P0 - contrat de données et isolation

### MDP-001 - `bars_daily` batch non auto-descriptif et `limit` incohérent
- Input: `QueryData(types="bars_daily", symbols="NVDA,AMD,MRVL,ALAB,CRDO,ANET,MU,TSM,AMKR,LRCX,COHR,SMCI,DELL,HPE,VRT,ETN,GEV,CEG,VST,CSCO,ORCL,IBM,SMH,SOXX,QQQ", end_date="2026-08-28", limit=30, include_partial=false, force_async=true)` puis toutes les pages de `Jobs`.
- Attendu: chaque élément porte `symbol`; 30 barres maximum par symbole; mêmes bornes sémantiques; ordre non significatif; `sessions_complete` et source par symbole.
- Actuel: les 25 objets `data[]` n'ont ni `symbol` ni `ticker`; le client doit les associer par index à `results.symbols[]`. NVDA/AMD/... reçoivent 520-531 barres depuis `2024-07-18`, alors que GEV/CSCO/ORCL/IBM/SOXX n'en reçoivent que 28-29. `limit=30` est donc ignoré ou appliqué différemment selon le symbole.
- Risque: mauvaise attribution silencieuse si le serveur réordonne ou omet un symbole; régression et niveaux faux.
- Acceptation: test batch avec symbole absent/ETF/récent; chaque payload est nommé, indépendant, borné à 30 et accompagné d'un statut par symbole.

### MDP-002 - une erreur symbole/facet fait tomber tout le batch
- Input: `QueryData(types="metadata,financials,stats,technicals,calendar,earnings_reactions,earnings_surprises,analyst_trend,short_interest,ctb,sec_catalysts", symbols=<25 symboles ci-dessus>, force_async=true)`.
- Attendu: matrice résultat `type x symbol`; `completed|not_applicable|failed` par cellule; les cellules saines survivent.
- Actuel: `calendar` échoue entièrement sur `QQQ -> quote -> 1m bars timeout`; `earnings_reactions` entièrement sur `cookie prime timeout`; `analyst_trend` entièrement sur timeout; `short_interest` entièrement car QQQ n'a pas de SI; `ctb` entièrement sur rate-limit wait; `sec_catalysts` entièrement sur timeout. Metadata est partiel et plusieurs actions/ETF échouent via une dépendance quote 1m.
- Acceptation: QQQ retourne `not_applicable` pour financials/earnings/SI; un timeout QQQ n'efface jamais AVGO/NVDA; `partial` contient les succès nommés.

### MDP-003 - routage ETF vers des sources actions
- Input: même batch avec `QQQ,SMH,SOXX` et types `financials,stats,calendar,earnings_reactions,short_interest`.
- Attendu: `not_applicable` typé sans appel inutile à quote/cookie/FINRA.
- Actuel: tentatives de sources actions et cookie; QQQ peut faire échouer la facet entière.
- Acceptation: taxonomie instrument résolue avant le fan-out et aucun retry action-only pour un ETF.

### MDP-004 - Jobs contredit `GetHelp`
- Input: toute `QueryData(..., force_async=true)` puis `Jobs(job_id=...)`.
- Attendu selon aide: chaque `data.items[]` routable par son champ `type`.
- Actuel: `data.items[0]` n'a pas `type`; il contient `results[]`, dont le routeur réel est `data_type`. Présence en plus de `_chunk_field/_chunk_index/_chunk_total` sans contrat clair.
- Acceptation: soit ajouter `type` à chaque item, soit corriger aide/schéma et garantir `results[].data_type`; exemple paginé complet.

## Priorité P0 - exactitude des facets

### MDP-005 - FINRA short volume invalide
- Input: `QueryData(types="short_interest,ctb,ctb_history,ftd_threshold,finra_short_volume", symbols="AVGO", end_date="2026-08-28", days=365)`.
- Attendu: historique FINRA ou erreur source temporaire correctement typée; jamais de faux signal directionnel.
- Actuel exact: `FINRA regShoDaily HTTP 400: Sorting is allowed only if all partitions keys are specified in EQUAL CompareFilter. Partition keys missing or not using EQUAL CompareFilter: tradeReportDate`.
- Proposition: requête partitionnée par égalité/date, pagination côté serveur, test sur plage multi-jours; conserver la règle que le volume short FINRA n'est pas du dark pool.

### MDP-006 - options dépendent d'une quote 1m hors séance
- Input: `QueryData(types="options_chain,vol_surface,implied_probability,options_history,unusual_options,max_pain", symbols="AVGO", end_date="2026-08-28", max_expirations=4, moneyness_min=0.7, moneyness_max=1.3)`.
- Attendu: spot `last_known`/clôture complète datée hors séance, ou `DATA_INSUFFICIENT` par facet; schéma indique que `implied_probability.level` est requis.
- Actuel: chain/surface échouent `failed to fetch spot -> quote -> 1m bars: context deadline exceeded`; history/max_pain timeout; implied_probability échoue car `level` absent; unusual_options seul complète avec tableau vide. Pourtant `GetInstruments` avait un max pain et un ratio calls/puts datés du 29 août.
- Acceptation: fallback spot explicite et daté; pas de dépendance 1m lorsque le marché est fermé; cohérence entre composite et QueryData; raison d'indisponibilité par facet.

### MDP-007 - calendrier et analystes dépendent de quote 1m/cookie
- Input: `QueryData(types="profile,financials,stats,earnings_quarterly,earnings_reactions,earnings_surprises,earnings_yearly,calendar,analyst_actions,analyst_trend,holders,dividends", symbols="AVGO", end_date="2026-08-28")`.
- Actuel: calendar `quote -> 1m bars timeout`; analyst_actions `rate limit wait timeout`; analyst_trend timeout. Les autres facets sont saines.
- Attendu: calendrier/fondamentaux ne dépendent pas du flux 1m; cache/circuit breaker; succès partiels conservés.

### MDP-008 - `seasonality` annoncé au mauvais routeur
- Input: `QueryData(types="technicals,...,seasonality,correlations", symbols="AVGO", end_date="2026-08-28")`.
- Actuel: `unsupported data_type seasonality; use GetMarketContext(facets='seasonality')`, alors que la documentation générale liste `seasonality` parmi les types symbol-level QueryData.
- Acceptation: retirer ce type du schéma QueryData ou implémenter l'alias; `GetHelp` doit donner une route unique.

## Priorité P1 - temps, auth et découverte

### MDP-009 - paramètres `as_of` exposés mais rejetés
- Cas: `GetReferentialData` expose `as_of` mais reste current-only; `GetMarketContext` expose un `as_of` générique mais le facet `regime` le rejette, seul `overview` historique l'accepte.
- Attendu: schémas discriminés par facet/tool avec `temporal_mode=current|point_in_time|snapshot_only`; rejet avant exécution avec route alternative.
- Acceptation: impossible de construire une requête acceptée par JSON Schema mais rejetée uniquement pour cette règle temporelle.

### MDP-010 - `GetOffHoursContext` documenté mais absent de `tools/list`
- Observation: `GetHelp` le décrit et le runbook l'autorise, mais il n'est pas visible dans la découverte de tools de la session.
- Attendu: tool visible avec schéma réel, ou aide retirée/feature flag explicite.

### MDP-011 - délégation de token en impasse
- Input: appel visible `GetReadOnlyToken` depuis la connexion MCP readonly authentifiée.
- Actuel exact: `-32601 readonly token: tool GetReadOnlyToken not permitted`.
- Attendu: documenter quel principal peut le demander et fournir un flux de délégation sans exposer le secret; sinon cacher le tool aux connexions qui ne pourront jamais l'appeler.

## Priorité P1 - résilience, qualité et observabilité

### MDP-012 - timeout transitoire opaque
- Input: `GetSymbolSignals(symbol="AVGO")`.
- Actuel: premier appel timeout à 90 s sans job, progression ni diagnostic; retry identique réussi.
- Attendu: idempotency/intent id, erreur typée (`upstream_timeout`, retryable), `retry_after_seconds`, trace id, ou async job.

### MDP-013 - cookie priming répété
- Actuel récurrent: `cookie prime: context deadline exceeded` dans earnings_reactions et autres facets.
- Proposition: session/cookie partagé, singleflight, cache de validité, circuit breaker et métriques de taux de succès/latence; ne pas refaire le prime par symbole.

### MDP-014 - expected move sans raison typée
- Input: `GetEarningsCalendarFiltered(symbols=<comparables>, days_ahead=14, include_implied_move=true)`.
- Actuel: DELL `2026-09-01 AMC`, CRDO `2026-09-01 AMC`, HPE `2026-09-02 AMC`, mais implied move `null`; warning agrège marché fermé, illiquidité et budget.
- Attendu: `implied_move_status=available|market_closed|no_chain|illiquid|timeout|budget_exhausted` par symbole, âge/source/expiration utilisée.

### MDP-015 - enveloppe qualité non uniforme
- Attendu pour chaque facet/symbole: `source`, `quality`, `market_state`, `observed_at`, `event_time`, `ingested_at`, `age_seconds`, `temporal_mode`, `warnings`, `not_applicable_reason`.
- Actuel: enveloppe partielle/inégale; `RankBeta` indique utilement `market_cap_point_in_time=false`, mais les autres surfaces ne suivent pas ce standard. `quality_metrics` peut afficher grade C/`limited_results` tout en comptant seulement une requête agrégée, sans dire quelles cellules manquent.

### MDP-016 - version change pendant un même travail
- Observation: réponses vues avec `c8e6b2e3`, puis `8064b400` (`build_timestamp=2026-08-30T04:10:00Z`) sans identifiant de déploiement/session uniforme dans chaque réponse.
- Attendu: `server_version`, `commit`, `deployment_id` et éventuellement `worker_id` dans chaque réponse/job; un job doit rester attaché à une version ou déclarer la migration.

### MDP-017 - état service ambigu
- `GetStatus` version `8064b400`: `status=healthy`, DB et SEC healthy, clôture 1d `2026-08-28`, mais `bar_service_status=bootstrapping`, progrès `51.8%`, witnesses QQQ/SPY/VIX seulement `7 bars`.
- Attendu: séparer disponibilité requête courante, couverture univers et profondeur historique; fournir un verdict exploitable par type/timeframe au lieu d'un healthy global ambigu.

## Corrections client déjà réalisées, à ne pas attribuer au serveur
- Le client local n'avait pas réellement l'option `collect.js --ingest` pourtant mentionnée dans son message: ajout d'un ingest mécanique hashé.
- Le publisher local ignorait les erreurs de schéma non `required` et gérait mal `integer` dans une union: corrigé fail-closed.
- Le validateur local revalidait le même gros artefact pour chaque claim: cache ajouté.
- Ces fixes ne remplacent aucune correction MCP ci-dessus.

## Definition of done
1. Tests unitaires et intégration pour chaque MDP, dont batches mélangeant action/ETF/symbole récent/timeout.
2. `tools/list`, JSON Schemas et `GetHelp` cohérents et versionnés.
3. Aucun batch sain détruit par une cellule en échec; aucune association symbole par position.
4. Temporalité et non-applicabilité explicites; aucune donnée absente convertie en zéro.
5. Jobs paginés reproductibles, erreurs retryables typées, trace ids et version serveur partout.
6. Réponse finale owner sous forme de tableau: ID, cause racine, fichier/module, patch, test, version livrée, statut.
