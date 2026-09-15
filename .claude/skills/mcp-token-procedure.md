---
name: mcp-token-procedure
description: Procédure déterministe d'obtention et d'injection des jetons MCP à TTL court. Standing order — l'agent l'exécute sans jamais demander à l'utilisateur comment procéder. Auto-load dès qu'un script du dépôt doit appeler marketdata ou systematic.
user_invocable: false
---

# Jetons MCP — procédure permanente

**Ne jamais demander à l'utilisateur comment fournir un jeton.** La procédure est écrite ici ;
l'agent l'applique. Une question sur ce sujet est un défaut, pas une précaution.

## L'ordre d'exécution

1. **Émettre.** Depuis la session MCP authentifiée de l'agent :
   `GetReadOnlyToken(minutes=60)` pour marketdata, `DtxMintReadOnlyToken(ttl_minutes=60)` pour
   systematic. Toujours demander le maximum utile : un jeton qui expire en pleine collecte
   produit un staging partiel qu'on prendrait pour complet.
2. **Déposer.** Écrire la valeur dans un fichier du **scratchpad de session**, hors dépôt,
   puis `chmod 600`. Un nom par serveur : `.mcp-token-marketdata`, `.mcp-token-systematic`.
3. **Injecter par le chemin.** Passer `MCP_TOKEN_FILE_<SERVEUR>=<chemin>` à la commande.
   `tools/lib/mcp-auth.sh` lit le fichier et exporte `MCP_TOKEN_<SERVEUR>` pour les enfants.
   La commande ne contient qu'un chemin.
4. **Effacer.** Supprimer le fichier dès la fin du run, sans attendre l'expiration.

```bash
MCP_TOKEN_FILE_MARKETDATA="$SCRATCH/.mcp-token-marketdata" \
AS_OF_TIMESTAMP=<instant de capture> \
  bash tools/scan-parallel.sh <DATE> <REFDATE> <ASOF>
```

## Pourquoi par fichier, et pas autrement

| Voie | Verdict |
|---|---|
| `MCP_TOKEN_X='<valeur>' cmd` (littéral en commande) | **Interdit.** Claude Code recopie la commande approuvée dans `permissions.allow` : 8 JWT en clair retrouvés dans `.claude/settings.local.json` le 2026-09-15. Visible aussi dans `ps` et l'historique du shell. |
| `VAR="$(cat fichier)" cmd` | **Bloqué par le harnais** (classifieur « Credential Materialization »). Inutile d'insister. |
| Saisie masquée `/dev/tty` | Valable mais exige un vrai terminal ; l'outil Bash de l'agent n'est pas un tty. Repli manuel seulement. |
| `MCP_TOKEN_FILE_<SERVEUR>=<chemin>` | **Voie normale.** Le secret ne traverse aucune commande. Vérifié le 2026-09-15. |
| Écrire le jeton dans `.env`, le dépôt ou un settings | **Interdit**, sans exception. |

`mcp-auth.sh` refuse un fichier de jeton situé dans le dépôt — garde-fou contre un commit accidentel.

## Ce qui reste vrai

- Aucun jeton ne se renouvelle lui-même : `GetReadOnlyToken` n'est pas sur sa propre surface.
  Une collecte de plus de 60 minutes se découpe en segments, un jeton par segment.
- Les jetons ne sont pas interchangeables entre serveurs (`aud=dailytickers-mcp` contre `aud=dtx-mcp`).
- `401/403` interrompt toute la salve : on réémet, on ne prolonge jamais.
- Un jeton expirant dans moins de 30 secondes est refusé plutôt qu'utilisé.
- Le jeton read-only refuse `RefreshBars` ; `DtxRefreshBars` exige `scope="refresh"`.
