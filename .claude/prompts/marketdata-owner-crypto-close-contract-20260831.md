# Prompt owner MCP marketdata — contrat de clôture crypto 24/7 vs clôture US

Tu es l’owner senior de `dailytickers-mcp`. Traite cet incident comme un défaut P0 de contrat temporel,
pas comme une simple demande de refresh. Ne demande, n’affiche et ne journalise aucun token. Fournis une
cause racine confirmée, un patch, des tests de non-régression, la version déployée et des réponses JSON
avant/après.

## Résumé exécutable

Un daily multi-asset doit certifier la dernière clôture US terminée, ici `2026-08-31`. Les actions et ETF
atteignent cette séance. Pour les cryptos 24/7, la bougie UTC `2026-08-31` était encore ouverte au moment
de la collecte (`2026-08-31T21:50Z`) et devait donc être exclue. Le serveur l’exclut correctement, mais le
contrat ne permet pas au client de distinguer proprement:

- une source réellement stale après une clôture attendue;
- une bougie courante encore ouverte et donc non publiable;
- un refresh réussi qui a ingéré une barre partielle;
- la dernière bougie complète attendue pour cet actif à l’instant de capture.

Répéter `RefreshBars` ne peut pas fermer une bougie avant son heure de clôture. Le workflow reste donc
bloqué par `expects_close=true`, qui compare à tort la date de clôture US avec la date de bougie crypto.
La correction doit conserver le comportement fail-closed: aucune bougie partielle ne doit devenir une
clôture certifiée.

## Reproduction exacte

### Contexte

```text
workflow: daily
editorial_date: 20260831
equity_reference_close: 2026-08-31
capture_time: 2026-08-31T21:50:50.896132074Z
marketdata server_version/deployment_id: 96ce1588
marketdata commit: 96ce15881b345fd6dfb2f94fb757e11565fafb87
QueryData trace_id: trace-3ad62b46-bae7-4c4c-ba76-3f607e41666d
client plan: plans/daily.json
artifact: daily/20260831/_data/bars_crypto.json
harness: daily/20260831/_data/harness.json
```

### Étape 1 — santé

`GetStatus()` indiquait `bars_daily.freshness=2026-08-31`,
`bar_service_1d_max_last_bar_date=2026-08-31` et `ref_lag_sessions=0`. Ce verdict agrège des calendriers
d’actifs différents et ne prouve pas la dernière bougie complète crypto.

### Étape 2 — refresh borné

```json
{
  "tool": "RefreshBars",
  "arguments": {
    "symbols": "BTC-USD,ETH-USD,SOL-USD,XRP-USD"
  }
}
```

Le refresh a répondu `status="completed"`, `mode="per_symbol"` et, pour chacun des quatre symboles,
`last_bar_after="2026-08-31"`, `refreshed=true`. La réponse ne disait pas que cette barre était partielle
ni à quelle heure elle deviendrait une clôture complète.

### Étape 3 — lecture point-in-time

```json
{
  "tool": "QueryData",
  "arguments": {
    "types": "bars_daily",
    "symbols": "BTC-USD,ETH-USD,SOL-USD,XRP-USD",
    "end_date": "2026-08-31",
    "limit": 15
  }
}
```

Réponse observée pour les quatre symboles:

```json
{
  "schema_version": "bars.v2",
  "status": "stale",
  "temporal_mode": "point_in_time",
  "as_of": "2026-08-31",
  "reference_close": "2026-08-31",
  "requested_date": "2026-08-31",
  "expected_session_date": null,
  "served_date": "2026-08-30",
  "sessions_complete": true,
  "partial_excluded": "2026-08-31",
  "refresh_attempted": true,
  "refresh_error": "crypto source binance served 2026-08-30 before requested close 2026-08-31",
  "retry_after_seconds": 30,
  "rejection_reason": "served_end_before_requested_end",
  "coverage": {
    "requested_end": "2026-08-31",
    "served_end": "2026-08-30",
    "complete": true,
    "missing_ranges": []
  },
  "source": "stored_crypto_chain"
}
```

Le client bloque ensuite correctement:

```text
bars_crypto: SÉANCE EN RETARD — la donnée s’arrête au 2026-08-30,
la clôture de référence est le 2026-08-31.
```

## Défauts à corriger

### CRYPTO-CLOSE-001 — date de référence sans calendrier d’actif

`end_date` et `reference_close` sont interprétés comme une date de séance unique alors qu’un batch peut
mélanger actions US, ETF et actifs 24/7. À `21:50Z`, la séance actions US du 31 est terminée mais la
bougie crypto UTC du 31 ne l’est pas.

Le serveur doit exposer, par symbole ou calendrier:

```json
{
  "asset_calendar": "crypto_24_7_utc",
  "bar_timezone": "UTC",
  "bar_interval": "1d",
  "capture_time": "RFC3339",
  "requested_end": "YYYY-MM-DD",
  "expected_completed_end": "YYYY-MM-DD",
  "served_completed_end": "YYYY-MM-DD",
  "current_bar_date": "YYYY-MM-DD|null",
  "current_bar_complete": false,
  "current_bar_closes_at": "RFC3339|null",
  "next_complete_available_at": "RFC3339|null"
}
```

Le champ `expected_session_date` ne doit plus être `null` lorsque le serveur connaît le calendrier et
l’heure de capture.

### CRYPTO-CLOSE-002 — `stale` confond retard d’ingestion et bougie ouverte

Une bougie exclue parce qu’elle est encore ouverte n’est pas une erreur d’ingestion. Retourner une erreur
typée, par exemple `requested_bar_not_closed`, ou un statut `partial/current_bar_open`, avec la prochaine
heure utile. Conserver `stale` uniquement lorsque `served_completed_end < expected_completed_end`.

Ne pas imposer exactement ces noms si le schéma existant a une meilleure convention, mais la distinction
doit être structurée, stable et testable. Aucun client ne doit parser un message humain pour la déduire.

### CRYPTO-CLOSE-003 — refresh déclaré réussi sans qualité de la barre

`RefreshBars.last_bar_after="2026-08-31"` laisse croire que la clôture du 31 est disponible. Ajouter au
résultat par symbole:

```json
{
  "last_bar_after": "2026-08-31",
  "last_completed_bar_after": "2026-08-30",
  "last_bar_complete": false,
  "partial_bar_present": true,
  "partial_bar_closes_at": "2026-09-01T00:00:00Z"
}
```

Un refresh réussi ne doit jamais renseigner `refresh_error`. Dans le cas observé, le message
`crypto source binance served ...` décrit l’état temporel après refresh, pas l’échec du refresh.

### CRYPTO-CLOSE-004 — `retry_after_seconds=30` est mensonger

À `21:50Z`, la bougie ne pouvait pas être complète 30 secondes plus tard. `retry_after_seconds` doit être
calculé depuis la clôture UTC plus le SLA d’ingestion, ou rester `null` avec `retry_at`. Une boucle de
refresh toutes les 30 secondes est coûteuse et ne peut pas réussir avant la frontière temporelle.

### CRYPTO-CLOSE-005 — santé globale non exploitable par actif

Ajouter à `GetStatus.operation_readiness` des capacités séparées, au minimum:

- `bars_daily_us_equity` avec dernière séance complète et témoins;
- `bars_daily_crypto_utc` avec dernière bougie complète, bougie courante et heure de clôture;
- statut d’ingestion distinct de l’état ouvert/fermé de la bougie.

`bar_service_1d_max_last_bar_date=2026-08-31` ne doit jamais suffire à certifier toutes les classes
d’actifs.

### CRYPTO-CLOSE-006 — API pour demander « dernière bougie complète à cet instant »

Proposer et implémenter une forme non ambiguë, rétrocompatible, par exemple l’une de ces options:

1. `as_of_timestamp` + `completion_policy="completed_only"`;
2. `end_policy="last_completed_at_capture"`;
3. un endpoint de résolution de calendrier qui donne l’`end_date` correcte par actif avant `QueryData`.

Le choix appartient à l’owner, mais il doit permettre à un même run de certifier:

```text
actions US: completed through 2026-08-31
crypto UTC: completed through 2026-08-30 at capture 2026-08-31T21:50Z
crypto live/off-hours: observation courante séparée, jamais présentée comme clôture
```

## Contrat client attendu après correction

Le client DailyTickers conservera deux horloges explicites:

- `equity_refdate`: dernière clôture US terminée;
- `crypto_completed_refdate`: dernière bougie crypto UTC terminée à `capture_time`.

Le gate `expects_close` comparera chaque artifact à la date complète attendue pour son calendrier, et non
à une date globale. `GetOffHoursContext` pourra fournir une observation crypto courante horodatée, mais ne
remplacera jamais la série de clôtures complètes.

La réponse owner doit préciser le changement client exact nécessaire dans `plans/daily.json`, le manifeste
de fraîcheur et `check-freshness.js`. Ne demande pas au client de désactiver le gate, de passer
`include_partial=true` comme clôture, de substituer une API web ou de publier sur une donnée stale.

## Tests de non-régression obligatoires

1. Capture crypto à `2026-08-31T21:50:00Z`: dernière bougie complète = `2026-08-30`, courante 31 ouverte.
2. Capture à `2026-08-31T23:59:59Z`: le 31 reste partiel.
3. Capture à `2026-09-01T00:00:00Z`: comportement explicite pendant la frontière d’ingestion.
4. Capture après SLA d’ingestion: le 31 devient complet et le 1er courant/partiel.
5. Refresh avant minuit UTC: `last_bar_after=31`, mais `last_completed_bar_after=30`.
6. Refresh après minuit UTC: le 31 devient complet seulement si l’upstream le prouve.
7. Batch BTC/ETH/SOL/XRP: statut et calendrier par symbole, aucun appariement par index.
8. Batch mixte SPY/BTC-USD: aucune date de clôture globale appliquée silencieusement aux deux actifs.
9. Week-end et jour férié US: calendrier actions et calendrier crypto restent indépendants.
10. Heure d’été Europe/US: toute sémantique serveur reste UTC; aucun calcul fondé sur l’heure locale du client.
11. Upstream réellement stale après l’heure de clôture: statut bloquant distinct de `current_bar_open`.
12. `include_partial=false`: aucune barre ouverte n’entre dans `bars`; `include_partial=true`: la barre porte
    obligatoirement `complete=false` et ne satisfait jamais un gate de clôture.

## Critères d’acceptation

- Le serveur distingue explicitement date demandée, dernière bougie complète attendue, dernière bougie
  complète servie et bougie courante.
- Un refresh avant clôture ne prétend jamais avoir créé une clôture complète.
- `retry_at`/`retry_after_seconds` correspond à une échéance réellement utile.
- `GetStatus` fournit une readiness par calendrier/classe d’actif.
- Le daily peut rester fail-closed tout en acceptant une série crypto complète jusqu’au 30 dans le snapshot
  multi-asset du 31 à `21:50Z`.
- La donnée live est séparée des clôtures certifiées.
- `tools/list`, `GetHelp`, JSON Schema et exemples sont cohérents.
- Aucun token ou secret n’apparaît dans les tests, logs, traces ou réponses.

## Format obligatoire de la réponse owner

```text
ID:
Cause racine confirmée:
Défaut serveur, client ou contrat partagé:
Fichier/module corrigé:
Changement de schéma:
Compatibilité descendante:
Input de reproduction:
Réponse actuelle:
Réponse corrigée:
Tests ajoutés:
Résultat des tests:
Version/commit/deployment_id:
Date de déploiement:
Changement client requis:
Limites restantes:
Statut: fixed|in_progress|blocked|not_reproducible
```

Ne marque `fixed` que si le test à `21:50Z` passe sans publier la barre partielle, si le test après minuit
passe avec la nouvelle clôture complète, et si le workflow client peut certifier les deux calendriers sans
relâcher son gate de fraîcheur.
