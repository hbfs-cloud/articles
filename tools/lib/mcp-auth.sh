#!/usr/bin/env bash
# Short-lived MCP credentials without command-line or terminal disclosure.

mcp_require_token() {
  local server="${1:?server required}" upper env_name current token
  upper="$(printf '%s' "$server" | tr '[:lower:]' '[:upper:]')"
  env_name="MCP_TOKEN_${upper}"
  current="${!env_name:-}"
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
