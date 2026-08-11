#!/usr/bin/env bash
# downstream-split — sépare le downstream en CALCUL (parallélisable, rejouable) et
# DIFFUSION (irréversible, après verdict du panel).
#
#   bash tools/downstream-split.sh compute <DATE> <ASOF>
#   bash tools/downstream-split.sh distribute <DATE>
#
# ── Pourquoi cette séparation ────────────────────────────────────────────────
# Le panel juge le contenu publié ; le downstream ne le modifie pas. Les deux
# peuvent donc tourner ensemble — 8 à 12 min gagnées sur un run complet.
#
# Mais paralléliser le downstream ENTIER serait une faute : il contient des actions
# IRRÉVERSIBLES (git push, image publiée, Telegram). Si le panel trouve ensuite un
# niveau faux, on ne rattrape pas un message déjà parti.
#
# D'où la coupure :
#   compute    → status, api, cartes, synthèse, pont dtx. Local, IDEMPOTENT,
#                rejouable autant de fois qu'il faut. Tourne EN PARALLÈLE du panel.
#   distribute → push, image, notification. APRÈS le verdict, jamais avant.
#
# Coût d'un panel qui refuse : recalculer des fichiers locaux (1-2 min).
# Jamais retirer quelque chose de déjà envoyé.
#
# ── Quels constats forcent un recalcul ───────────────────────────────────────
# Un seul critère : le constat touche-t-il data.json ou signals.json ?
#   OUI (niveau faux, R/R erroné, ticker à retirer) → corriger, re-rendre, puis
#        RELANCER `compute` : les artefacts dérivés sont tous faux.
#   NON (tournure, lien, réserve éditoriale) → les artefacts sont intacts,
#        `compute` n'a pas à être rejoué.
# tools/qa-check.js tranche mécaniquement : il lit signals.json, pas le HTML.
set -uo pipefail
MODE="${1:?usage: downstream-split.sh compute|distribute <DATE> [ASOF]}"
DATE="${2:?}"; ASOF="${3:-}"
DIR="scanner/$DATE"
T0=$(date +%s); log(){ echo "[$(( $(date +%s) - T0 ))s] $*"; }

# Verrou : /desk et /scanner écrivent les MÊMES fichiers (data/, scanner/status/,
# portfolio/v1/). Deux gen-status-page simultanés produisent un fichier corrompu
# SANS erreur. Le second attend au lieu d'écrire par-dessus.
LOCK=/tmp/dailytickers-downstream.lock
acquire(){
  local n=0
  until mkdir "$LOCK" 2>/dev/null; do
    n=$((n+1)); [ $n -eq 1 ] && log "artefacts partagés verrouillés par un autre run — attente"
    [ $n -gt 180 ] && { echo "Verrou tenu >15 min, abandon (verrou fantôme ? rm -rf $LOCK)" >&2; exit 1; }
    sleep 5
  done
  trap 'rmdir "$LOCK" 2>/dev/null' EXIT
}

case "$MODE" in
  compute)
    acquire
    [ -n "$ASOF" ] || { echo "ASOF requis pour compute" >&2; exit 2; }
    # ingestion dtx : --decide ET --replay obligatoires. Sans replay, metrics/equity
    # vides et le dashboard retombe sur un placeholder figé (incident du 23/07).
    if [ -d "$DIR/_dtx11" ] || [ -d "$DIR/_dtx" ]; then
      S="$DIR/_dtx11"; [ -d "$S" ] || S="$DIR/_dtx"
      for d in "$S"/decide_*.json; do
        [ -e "$d" ] || continue
        pf=$(basename "$d" .json); pf=${pf#decide_}
        r="$S/replay_${pf}.json"
        if [ -f "$r" ]; then
          node tools/dtx-mcp-ingest.js --portfolio "$pf" --decide "$d" --replay "$r" --asof "$ASOF" >> /tmp/ds-dtx.log 2>&1
        else
          echo "  $pf : replay absent → ingestion SAUTÉE (decide seul = staging stateless)" | tee -a /tmp/ds-dtx.log
        fi
      done
      node tools/dtx-history-append.js >> /tmp/ds-dtx.log 2>&1
      node tools/dtx-pool-bridge.js --folder "$DATE" --date "$ASOF" >> /tmp/ds-dtx.log 2>&1
      log "dtx ingéré"
    fi
    node tools/gen-status-page.js > /tmp/ds-status.log 2>&1 || { echo "gen-status-page ÉCHEC" >&2; exit 1; }
    log "status page"
    # les trois consommateurs du snapshot, en parallèle — seul gen-api en dépend
    ( node tools/gen-api.js         > /tmp/ds-api.log   2>&1; echo $? > /tmp/ds-api.rc   ) &
    ( node tools/gen-mode-cards.js  > /tmp/ds-cards.log 2>&1; echo $? > /tmp/ds-cards.rc ) &
    ( node tools/daily-synthesis.js > /tmp/ds-synth.log 2>&1; echo $? > /tmp/ds-synth.rc ) &
    wait
    log "api/cartes/synthèse (rc: $(cat /tmp/ds-api.rc) $(cat /tmp/ds-cards.rc) $(cat /tmp/ds-synth.rc))"
    node tools/qa-check.js 2>&1 | grep -E "Checks:|❌" | head -5
    log "CALCUL terminé — rejouable à l'identique si le panel demande une correction"
    ;;

  distribute)
    acquire
    # Irréversible. N'arrive ici qu'APRÈS un verdict de panel favorable.
    bash tools/publish-daily-card.sh --no-sweep --no-telegram > /tmp/ds-card.log 2>&1 \
      || { echo "publish-daily-card ÉCHEC" >&2; exit 1; }
    log "DIFFUSION faite (image + push). Telegram : à envoyer par l'AGENT via le MCP notification."
    ;;

  *) echo "Mode inconnu : $MODE (compute|distribute)" >&2; exit 2 ;;
esac
