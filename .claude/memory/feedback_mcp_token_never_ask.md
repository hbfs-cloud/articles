---
name: mcp-token-never-ask
description: Ne jamais demander à l'utilisateur comment fournir un jeton MCP — émettre, déposer dans le scratchpad, injecter par MCP_TOKEN_FILE_<SERVEUR>, effacer.
type: feedback
---

Demander à l'utilisateur comment fournir un jeton MCP à chaque run est un défaut.
La procédure est figée dans `.claude/skills/mcp-token-procedure.md` et s'exécute sans consultation :
émettre (`GetReadOnlyToken(minutes=60)`), déposer la valeur dans un fichier du scratchpad de session
hors dépôt en 0600, injecter par `MCP_TOKEN_FILE_<SERVEUR>=<chemin>`, effacer en fin de run.

**Why:** l'utilisateur a signalé le 2026-09-15 que la question revenait à chaque pipeline alors que la
réponse ne change pas. Les deux autres voies sont fermées, pas préférentielles : un littéral
`MCP_TOKEN_X='<valeur>'` dans la commande est recopié par Claude Code dans `permissions.allow`
(8 JWT retrouvés en clair dans `.claude/settings.local.json`, expirés le 2026-08-19, fichier non
versionné), et la forme `VAR="$(cat fichier)"` est refusée par le classifieur « Credential
Materialization » du harnais. L'injection par chemin est la seule qui soit à la fois automatique et
sans secret dans une commande.

**How to apply:** au premier script du dépôt qui doit appeler marketdata ou systematic, exécuter la
procédure directement. `tools/lib/mcp-auth.sh` porte le support `MCP_TOKEN_FILE_<SERVEUR>` (ajouté le
2026-09-15) et refuse un fichier de jeton situé dans le dépôt. La saisie masquée `/dev/tty` reste un
repli manuel valable quand un vrai terminal est disponible, jamais le chemin par défaut.

Voir [[mcp-token-procedure]], [[llm-script-boundary]], [[scanner-pipeline]].
