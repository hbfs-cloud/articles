# Prompt aux owners MCP — incident de collecte fresh Daily/Weekly

## Contexte

Nous opérons deux serveurs MCP derrière des workflows automatisés:

- `marketdata` / `dailytickers-mcp` pour les données de marché;
- `systematic` pour le contexte DTX.

Le client exécute des collectes strictement datées pour publier un daily et un
weekly. Une collecte qui contient une donnée stale, un fallback implicite ou un
secret visible doit échouer explicitement et produire un diagnostic exploitable.

Ce ticket ne demande pas une explication générale. Il demande une reproduction,
une cause racine, un correctif déployé et des tests de non-régression.

## Incident 1 — daily: `bars_crypto` stale malgré un service healthy

### Input exact

```text
workflow: daily
reference_close: 2026-08-28
expected_data_date: 2026-08-28
required facet: bars_crypto
freshness rule: data must cover the reference close and pass the daily maximum age
```

### Résultat actuel

La collecte daily retourne une enveloppe globale healthy et 11 sources valides,
mais `bars_crypto` s’arrête au `2026-08-24`. Le wrapper bloque correctement la
publication avec une erreur de fraîcheur. Le même serveur a ensuite fourni à la
collecte weekly des données crypto jusqu’au `2026-08-28`.

### Résultat attendu

1. `bars_crypto` doit couvrir `2026-08-28` pour une collecte daily dont la
   clôture de référence est `2026-08-28`.
2. Si le refresh est impossible, retourner `DATA_INSUFFICIENT` ou `STALE` avec:
   `requested_date`, `served_date`, `source`, `last_successful_ingestion`,
   `refresh_attempted`, `refresh_error`, `retry_after`.
3. Ne jamais retourner `healthy=true` comme verdict suffisant lorsque la
   capacité crypto requise est stale.
4. Expliquer pourquoi daily et weekly ont servi des couvertures différentes dans
   la même session et sur la même clôture.

### Tests requis

- daily refdate T-1 avec source à T-1;
- daily refdate T-1 avec source à T-4;
- weekly et daily consécutifs sur la même refdate;
- cache froid, cache chaud, ingestion partiellement échouée;
- aucun fallback vers les données actuelles pour une demande historique.

## Incident 2 — weekly focus: artefact ancien réutilisable après échec

### Input exact

```text
workflow: weekly-focus
reference_close: 2026-08-28
focus_symbols: DELL,MDB,SNOW,PANW,CRDO,HPE,CIEN,ZS
required facets: focus_bars, focus_technicals, focus_fundamentals,
                 focus_events, focus_flows, focus_correlation
```

### Résultat actuel

La tentative de recollecte n’a pas produit une validation fresh complète. Le
répertoire `_focus` contenait déjà un ancien `harness.json` et des JSON datés du
`2026-08-29`. Le contrôle détecte `status` stale de `22,2 h`, mais le système
laisse les anciens artefacts présents, ce qui rend possible une reconstruction
accidentelle avec un mélange ancien/nouveau.

### Résultat attendu

1. Une nouvelle intention doit écrire dans un run isolé ou utiliser un manifest
   atomique.
2. Un run échoué ne doit jamais être présenté comme le run courant.
3. Le builder doit refuser tout mélange de fichiers provenant de runs différents.
4. Chaque artefact doit contenir:

```json
{
  "run_id": "...",
  "intent_id": "...",
  "generated_at": "RFC3339",
  "as_of": "RFC3339",
  "reference_close": "2026-08-28",
  "temporal_mode": "current|snapshot_only|point_in_time",
  "source": "...",
  "schema_version": "..."
}
```

5. Le manifest ne devient `published_candidate=true` qu’après validation de
   toutes les facets et de la fraîcheur.

### Tests requis

- échec d’une seule facet;
- interruption au milieu de l’écriture;
- relance avec le même output directory;
- présence d’un ancien snapshot;
- builder lancé sur un manifest stale;
- vérification que le résultat final ne contient qu’un `run_id`.

## Incident 3 — refresh token refusé alors que le client est authentifié

### Input exact

```json
{
  "minutes": 30,
  "scope": "refresh"
}
```

Endpoints concernés:

- `marketdata.GetReadOnlyToken`;
- `systematic.DtxMintReadOnlyToken`.

### Résultat actuel

Le scope `readonly` est émis et permet les collectes de lecture. Le scope
`refresh`, nécessaire pour réparer ou avancer le snapshot, est refusé côté
marketdata dans une session pourtant authentifiée. Le client ne peut donc pas
réparer `bars_crypto` et doit bloquer la publication.

### Résultat attendu

- `readonly` n’autorise jamais les mutations;
- `refresh` est émis uniquement après contrôle d’autorisation explicite;
- en cas de refus, l’erreur doit distinguer `unauthorized`, `scope_disabled`,
  `server_not_ready`, `rate_limited` et `refresh_not_supported`;
- `GetHelp` et `tools/list` doivent refléter la capacité réelle;
- le token ne doit apparaître ni dans les logs, ni dans les traces, ni dans les
  exceptions, ni dans les artifacts;
- le TTL, `expires_at`, scope et permissions doivent être visibles sans exposer
  la valeur du JWT.

### Tests requis

- readonly autorisé et refresh interdit;
- refresh autorisé pour un utilisateur autorisé;
- refresh refusé pour un utilisateur non autorisé;
- token expiré;
- scope inconnu;
- rate limit;
- audit des logs avec recherche de motifs JWT.

## Incident 4 — saisie de tokens par le wrapper

### Input exact

Le wrapper shell demande successivement les tokens `marketdata` et
`systematic` via `/dev/tty`, puis lance `tools/collect.js`.

### Résultat actuel

Lors d’une saisie PTY automatisée, la valeur JWT a été renvoyée dans la sortie
du terminal au lieu de rester strictement masquée. Même si le client ne la
publie pas, ce comportement est une fuite de secret.

### Résultat attendu

1. La saisie doit rester non-échoïque dans un terminal réel et dans un PTY.
2. Les prompts doivent être distincts et confirmer uniquement le serveur et le
   scope, jamais la valeur.
3. Le wrapper doit accepter un mécanisme secret non journalisé documenté, par
   exemple un descripteur de fichier protégé ou un environnement injecté par le
   parent, sans token dans la ligne de commande.
4. Toute détection d’écho, de token dans stdout/stderr, ou de token dans une
   exception doit arrêter le run et effacer les variables en sortie.

### Tests requis

- terminal interactif macOS;
- PTY automatisé;
- stdin non-TTY;
- token avec caractères spéciaux;
- échec d’authentification;
- capture complète stdout/stderr et `ps` pour vérifier l’absence du secret.

## Contrat commun de réponse

Pour chaque facet et chaque run, retourner des champs structurés:

```json
{
  "status": "completed|partial|stale|failed",
  "run_id": "...",
  "intent_id": "...",
  "as_of": "...",
  "reference_close": "...",
  "temporal_mode": "...",
  "source": "...",
  "observed_at": "...",
  "ingested_at": "...",
  "age_seconds": 0,
  "coverage": {"requested_end": "...", "served_end": "..."},
  "quality": "high|medium|low|insufficient",
  "warnings": [],
  "errors": [],
  "refresh_attempted": false,
  "rejection_reason": null
}
```

Une date absente reste `null` avec une raison. Elle ne doit jamais être
remplacée par la date courante.

## Livrable attendu des owners

Répondre sous cette forme, pour chaque incident:

```text
ID:
Owner:
Cause racine:
Fichier/module corrigé:
Version ou deployment_id:
Migration de schéma:
Input de reproduction:
Réponse actuelle:
Réponse attendue:
Tests ajoutés:
Résultat des tests:
Limites restantes:
Date de déploiement:
```

La correction est acceptée uniquement si:

- une collecte stale reste bloquée;
- une collecte fresh est atomique et homogène;
- daily et weekly donnent une couverture cohérente pour la même clôture;
- refresh est correctement autorisé ou refusé avec une cause explicite;
- aucun secret n’apparaît dans stdout, stderr, logs, traces ou artifacts;
- les clients peuvent diagnostiquer l’incident sans lire les logs internes.
