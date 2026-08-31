# Prompt owner systematic MCP — restaurer les actions pour tous les membres OAuth

Tu es l’owner senior de `systematic-tss/dtx-mcp`. Corrige et déploie la régression d’autorisation
introduite par le commit `0f314518d4d9b379b356cda82083b0635ef24ddf` du 30 août 2026
(`harden replay parity, strategy evidence, and MCP operations`). Ne demande, n’affiche, ne journalise et
ne commit aucun token ou secret.

## Décision produit explicite

Toute session OAuth valablement authentifiée doit pouvoir utiliser les actions systematic prévues pour
les membres, **quel que soit son rôle ou son tier**, y compris lorsque les claims historiques portent:

```json
{
  "role": "member-free",
  "tier": "free"
}
```

Dans ce service, `member-free` n’est pas un niveau d’abonnement métier et ne doit pas servir de barrière
d’autorisation. C’est un claim générique hérité de la couche OAuth. Ne crée pas une taxonomie artificielle
`admin/operator/systematic-owner` comme prérequis pour les outils MCP normaux.

Cette décision inclut explicitement la possibilité, depuis une session OAuth interactive authentifiée,
d’appeler:

```json
{
  "tool": "DtxMintReadOnlyToken",
  "arguments": {
    "scope": "refresh",
    "ttl_minutes": 60
  }
}
```

et d’obtenir un jeton délégué court permettant `DtxRefreshBars` en plus de la surface readonly/compute.

## Régression reproduite

### Comportement qui fonctionnait vendredi 28 août

Une session OAuth authentifiée pouvait émettre les jetons nécessaires au scanner. Le claim
`role="member-free"` existait déjà depuis le commit `62a39ee336854deb38290a59d7dfa9871266be22`, mais il
n’était pas utilisé pour bloquer le refresh.

### Changement cassant du samedi 30 août

Le commit `0f314518` a ajouté dans `dtx-mcp/internal/httpapi/middleware.go`:

```go
func CanMintRefresh(ctx context.Context) bool {
    if ok, _ := ctx.Value(privilegedKey).(bool); ok {
        return true
    }
    claims := UserFromContext(ctx)
    if claims == nil {
        return false
    }
    switch strings.ToLower(strings.TrimSpace(claims.Role)) {
    case "admin", "operator", "systematic-owner":
        return true
    default:
        return false
    }
}
```

Mais `dtx-mcp/internal/httpapi/oauth_routes.go` continue d’émettre tous les access tokens OAuth ainsi:

```go
access, err := oa.jwt.GenerateAccessToken(sub, email, "member-free", "free")
```

La combinaison rend le refresh impossible pour **toute** session OAuth normale.

### Erreur actuelle exacte

```text
MCP error -32001
reason: unauthorized
retryable: false
message: caller is authenticated but is not authorised to mint refresh scope
```

Input:

```json
{
  "scope": "refresh",
  "ttl_minutes": 60
}
```

Impact: le workflow `$scanner` s’arrête avant la collecte parce que son contrat exige un jeton systematic
`scope="refresh"` afin de pouvoir exécuter le chemin borné `GetHealth -> DtxRefreshBars -> poll GetHealth`
si le snapshot est en retard.

## Correctif requis

### AUTH-REFRESH-001 — supprimer le gate de rôle métier inexistant

`CanMintRefresh` doit autoriser:

1. toute session OAuth interactive dont le JWT d’accès est valide et présente des claims utilisateur;
2. la clé M2M full-access existante;
3. indépendamment de `role` et `tier`.

Forme minimale acceptable:

```go
func CanMintRefresh(ctx context.Context) bool {
    if ok, _ := ctx.Value(privilegedKey).(bool); ok {
        return true
    }
    return UserFromContext(ctx) != nil && ScopeOf(ctx) == ""
}
```

Adapte cette forme à l’architecture réelle, mais ne remplace pas le gate de rôle par une allowlist email,
un tier payant ou une nouvelle classification absente du produit.

### AUTH-REFRESH-002 — empêcher toute escalade depuis un jeton délégué

Un token produit par `DtxMintReadOnlyToken`, qu’il soit `readonly`, `compute` ou `refresh`, ne doit jamais
pouvoir rappeler `DtxMintReadOnlyToken`. La règle est structurelle au dispatch et ne dépend pas du rôle.

Le droit attendu est:

```text
OAuth interactif valide -> peut émettre readonly ou refresh
M2M full-access valide   -> peut émettre readonly ou refresh
token délégué readonly   -> ne peut pas réémettre
token délégué refresh    -> ne peut pas réémettre
anonyme / JWT invalide   -> refus
```

### AUTH-REFRESH-003 — conserver un scope refresh borné

Le jeton `refresh` ne devient pas un jeton administrateur général. Sa surface doit rester l’union exacte:

- observation: `GetHealth`, `DtxListConfigs`, `DtxHowTo`, `DtxRegime`, `DtxJobStatus`;
- compute pur: `DtxDecide`, `DtxReplay`;
- récupération bornée: `DtxRefreshBars`.

Il ne doit pas permettre:

- `DtxMintReadOnlyToken`;
- une opération broker, compte ou ordre;
- une écriture de configuration;
- une action non déclarée dans la surface du scope.

`DtxDecide` reste une proposition structurée et ne place aucun ordre. `DtxRefreshBars` reste global,
idempotent, singleflight, atomique et auto-throttled.

### AUTH-REFRESH-004 — garder les protections opérationnelles

Conserver:

- `MCP_REFRESH_TOKEN_MINT_ENABLED` comme kill switch technique global, activé en production;
- le TTL maximum de 24 heures et le défaut court;
- le rate limit par sujet OAuth/JTI;
- les erreurs structurées `scope_disabled`, `server_not_ready`, `rate_limited`,
  `refresh_not_supported`, `unknown_scope`;
- la redaction des secrets dans chemins, logs, erreurs et traces;
- l’impossibilité de mettre le token en argv ou dans un artifact.

Le kill switch est une mesure d’exploitation globale, pas une politique par rôle.

### AUTH-REFRESH-005 — aligner documentation et schémas

Supprimer des descriptions de `DtxMintReadOnlyToken`, `GetHelp`, README et runbook toute affirmation
selon laquelle `refresh` exige `operator/admin/systematic-owner`. Remplacer par:

```text
Any valid interactive OAuth session or full-access M2M caller may mint a short-lived refresh-scoped
token. Delegated scoped tokens cannot mint another token.
```

Le JSON Schema, `tools/list`, `DtxHowTo` et les tests doivent refléter exactement le même contrat.

## Tests bloquants

Ajouter ou modifier au minimum les tests suivants:

1. OAuth `role=member-free,tier=free` peut émettre `scope=readonly`.
2. OAuth `role=member-free,tier=free` peut émettre `scope=refresh`.
3. OAuth avec rôle vide mais claims utilisateur valides peut émettre `scope=refresh`.
4. Les rôles historiques `admin`, `operator`, `systematic-owner` continuent de fonctionner sans traitement
   privilégié particulier.
5. M2M full-access peut émettre `scope=refresh`.
6. Token délégué readonly ne peut pas appeler `DtxMintReadOnlyToken`.
7. Token délégué refresh ne peut pas appeler `DtxMintReadOnlyToken`.
8. Token délégué refresh peut appeler `DtxRefreshBars`.
9. Token délégué readonly ne peut pas appeler `DtxRefreshBars`.
10. JWT invalide, access token expiré et appel anonyme sont refusés.
11. `MCP_REFRESH_TOKEN_MINT_ENABLED=false` refuse tout le monde avec `scope_disabled`, y compris OAuth et
    M2M.
12. Le rate limit renvoie `rate_limited`, `retryable=true` et `retry_after_seconds` sans exposer le token.
13. Capture complète stdout/stderr/logs/traces: aucun motif JWT ni bearer secret.
14. Test d’intégration: OAuth member -> mint refresh -> `GetHealth(expected_close)` ->
    `DtxRefreshBars` -> poll -> snapshot atomique ou `already_running`.
15. Test scanner: le jeton obtenu permet `tools/dtx-refresh-if-stale.js`, puis le plan DTX complet, sans
    clé M2M ni contournement local.

Remplacer le test actuel qui affirme:

```text
ordinary authenticated OAuth member minted refresh scope -> failure expected
```

par le contrat inverse décidé ici.

## Critères d’acceptation

- `DtxMintReadOnlyToken(scope="refresh")` réussit depuis la connexion OAuth actuelle portant
  `role="member-free"`.
- Le résultat expose `scope`, `expires_at`, permissions et limites sans journaliser la valeur du token.
- Le jeton appelle `DtxRefreshBars` mais ne peut pas se réémettre ni sortir de sa surface.
- Le scanner passe son preflight avec ce jeton.
- Aucune allowlist email, aucun abonnement, aucun rôle artificiel n’est requis.
- Les tests unitaires, intégration, auth, schema et race passent.
- L’image déployée expose un commit/version vérifiable et le test production est rejoué après déploiement.

## Déploiement et vérification production

1. Partir de la branche canonique `main` propre de `systematic-tss`.
2. Appliquer le patch et les tests; ne pas modifier les stratégies, stats ou configurations de portefeuille.
3. Lancer les tests ciblés auth/MCP puis la suite complète pertinente.
4. Déployer `dtx-mcp` avec un tag immuable lié au commit.
5. Vérifier `/ready`, puis `GetHealth(expected_close=<dernière clôture US>)`.
6. Reconnecter la session OAuth seulement si le format des claims change; la correction recommandée ne
   doit pas l’exiger.
7. Depuis une session OAuth `member-free`, émettre un token refresh de 15 minutes et appeler
   `DtxRefreshBars`.
8. Relancer le scanner DailyTickers complet; aucun skip ou fallback readonly n’est accepté.

## Format obligatoire de la réponse owner

```text
Incident: AUTH-REFRESH-001..005
Cause racine confirmée:
Commit fautif:
Fichiers modifiés:
Ancien contrat:
Nouveau contrat:
Tests ajoutés/modifiés:
Résultats des tests:
Version/commit/image déployée:
Preuve production OAuth member-free:
Preuve DtxRefreshBars:
Preuve scanner:
Secrets/logs audités:
Limites restantes:
Statut: fixed|in_progress|blocked|not_reproducible
```

Ne marque `fixed` que lorsque la preuve production montre qu’un OAuth `member-free` peut émettre le
scope refresh, que le token peut exécuter `DtxRefreshBars`, qu’il ne peut pas se réémettre et que le
scanner complet passe sans exception de sécurité.
