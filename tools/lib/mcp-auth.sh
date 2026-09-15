#!/usr/bin/env bash
# Short-lived MCP credentials without command-line or terminal disclosure.

mcp_require_token() {
  local server="${1:?server required}" upper env_name current token
  upper="$(printf '%s' "$server" | tr '[:lower:]' '[:upper:]')"
  env_name="MCP_TOKEN_${upper}"
  current="${!env_name:-}"
  # Injection par FICHIER : le chemin voyage dans la commande, jamais la valeur.
  # C'est la seule forme non interactive qui ne recopie pas un secret dans un
  # historique de shell, un journal, ou l'allowlist de permissions de l'agent —
  # d'où 8 JWT retrouvés en clair dans .claude/settings.local.json le 2026-09-15.
  # Le fichier doit être hors dépôt (scratchpad de session) et en 0600.
  if [ -z "$current" ]; then
    local file_name="MCP_TOKEN_FILE_${upper}" token_file
    token_file="${!file_name:-}"
    if [ -n "$token_file" ]; then
      if [ ! -r "$token_file" ]; then
        echo "[mcp-auth] ${file_name} pointe sur un fichier illisible: ${token_file}" >&2
        return 3
      fi
      case "$(cd "$(dirname "$token_file")" && pwd -P)" in
        "$(pwd -P)"|"$(pwd -P)"/*)
          echo "[mcp-auth] refus: un fichier de jeton ne doit pas résider dans le dépôt." >&2
          return 3 ;;
      esac
      current="$(tr -d '\r\n' < "$token_file")"
      if [ -n "$current" ]; then
        printf -v "$env_name" '%s' "$current"
        export "$env_name"
        return 0
      fi
      echo "[mcp-auth] ${file_name} désigne un fichier vide: ${token_file}" >&2
      return 3
    fi
  fi
  if [ -z "$current" ] && [ "${MCP_ACCESS_TOKEN_SERVER:-}" = "$server" ]; then
    current="${MCP_ACCESS_TOKEN:-}"
    if [ -n "$current" ]; then
      printf -v "$env_name" '%s' "$current"
      export "$env_name"
    fi
  fi
  [ -n "$current" ] && return 0

  if [ -t 2 ] && [ -r /dev/tty ]; then
    printf '[mcp-auth] Jeton read-only %s (saisie masquée): ' "$server" >&2
    IFS= read -r -s token </dev/tty || true
    printf '\n' >&2
    if [ -n "$token" ]; then
      printf -v "$env_name" '%s' "$token"
      export "$env_name"
      unset token
      return 0
    fi
  fi

  cat >&2 <<MSG
[mcp-auth] Jeton read-only ${server} absent.
  Émettre le jeton depuis la session MCP authentifiée, puis l'injecter par un
  environnement secret non journalisé, ou relancer ce script dans un terminal
  pour utiliser la saisie masquée. Ne jamais coller sa valeur dans une commande.
MSG
  return 3
}
