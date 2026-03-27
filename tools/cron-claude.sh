#!/bin/bash
# cron-claude.sh — Wrapper pour lancer claude --print avec OMC activé
#
# Lit ANTHROPIC_API_KEY depuis openclaw auth-profiles (token "anthropic:manual")
# puis invoque claude --print avec permission bypassPermissions
#
# Usage:
#   ./tools/cron-claude.sh "prompt..." [--model MODEL] [--timeout SECONDS]
#
# Exemple:
#   ./tools/cron-claude.sh "Génère le scan du jour..." --model claude-opus-4-6

set -e
cd "$(dirname "$0")/.."

# ─── Args ────────────────────────────────────────────────────────────────────
PROMPT=""
MODEL="claude-opus-4-6"
TIMEOUT=1800

while [[ $# -gt 0 ]]; do
  case "$1" in
    --model)    MODEL="$2";   shift 2 ;;
    --timeout)  TIMEOUT="$2"; shift 2 ;;
    *)          PROMPT="$1";  shift ;;
  esac
done

if [ -z "$PROMPT" ]; then
  echo "Usage: $0 \"prompt...\" [--model MODEL] [--timeout SECONDS]" >&2
  exit 1
fi

# ─── API Key ──────────────────────────────────────────────────────────────────
PROFILES="/home/ci/.openclaw/agents/main/agent/auth-profiles.json"
if [ -f "$PROFILES" ]; then
  API_KEY=$(node -e "
    const d = require('$PROFILES');
    const p = d.profiles['anthropic:manual'];
    if (p && p.token) process.stdout.write(p.token);
  " 2>/dev/null)
fi

if [ -z "$API_KEY" ] && [ -n "$ANTHROPIC_API_KEY" ]; then
  API_KEY="$ANTHROPIC_API_KEY"
fi

if [ -z "$API_KEY" ]; then
  echo "❌ No ANTHROPIC_API_KEY found" >&2
  exit 1
fi

echo "=== cron-claude.sh ===" >&2
echo "Model: $MODEL | Timeout: ${TIMEOUT}s" >&2
echo "OMC: active (via ~/.claude/CLAUDE.md)" >&2
echo "" >&2

# ─── Run ─────────────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY="$API_KEY" timeout "$TIMEOUT" \
  claude --print \
    --permission-mode bypassPermissions \
    --model "$MODEL" \
    "$PROMPT"
