#!/usr/bin/env bash
# Installe les hooks versionnés dans .git/hooks.
#
# Pourquoi un installeur : `.git/hooks/` n'est pas versionné, et `core.hooksPath` ne peut pas être
# repointé vers `tools/git-hooks/` parce que Git LFS pose ses propres hooks dans `.git/hooks`. La
# copie est donc le seul mécanisme — encore faut-il qu'elle existe. Le 2026-09-14, la copie active
# avait deux mois de retard sur la source.
set -euo pipefail
cd "$(dirname "$0")/.."
DEST="$(git rev-parse --git-path hooks)"
for h in tools/git-hooks/*; do
  name="$(basename "$h")"
  cp "$h" "$DEST/$name"
  chmod +x "$DEST/$name"
  echo "installé : $name"
done
echo "OK — $DEST"
