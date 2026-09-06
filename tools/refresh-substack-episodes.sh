#!/usr/bin/env bash
# Reconstruit les épisodes Substack illustrés, de bout en bout.
#
# L'ordre n'est pas négociable et chaque étape échoue bruyamment :
#   1. les schémas de mécanisme (rarement à refaire — seulement si schematics.js a bougé)
#   2. les exemples chiffrés, qui REFUSENT tout nombre absent de l'épisode
#   3. la construction, qui refuse une phrase-clé introuvable ou une figure inconnue
#   4. l'état de poussée, qui dit ce qui reste et ce qui a bougé depuis la dernière fois
#
# Construire avant de rendre laisserait passer une figure déclarée mais inexistante ; c'est arrivé,
# et l'épisode partait sans son image sans que rien ne le signale.
#
#   bash tools/refresh-substack-episodes.sh            # exemples + construction
#   bash tools/refresh-substack-episodes.sh --full     # + re-rendu des 27 schémas
set -euo pipefail
cd "$(dirname "$0")/.."

FULL=0
[[ "${1:-}" == "--full" ]] && FULL=1

if [[ $FULL -eq 1 ]]; then
  echo "▸ schémas de mécanisme"
  node tools/render-schematics.js --out substack-assets/schematics
fi

echo "▸ exemples chiffrés"
node tools/render-worked-examples.js

echo "▸ construction des épisodes"
node tools/build-substack-episode.js --all --out build/substack

echo "▸ état de poussée"
node tools/episode-push-state.js
