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
#   compute    → risk-metrics, ingestion dtx, status, api, cartes, synthèse, pont
#                dtx. Local, IDEMPOTENT, rejouable autant de fois qu'il faut.
#                Tourne EN PARALLÈLE du panel.
#   distribute → push, image, notification. APRÈS le verdict, jamais avant.
#
# `compute` NE lance PAS update-tracking ni sweep : ils tournent déjà dans la
# chaîne C de scan-parallel.sh, en parallèle du vivier. Les relancer ici doublerait
# 1 min 27 de sweep pour un résultat identique. En revanche il ingère bien
# /tmp/risk-mcp.json (produit par l'AGENT, seul à pouvoir appeler le MCP) et
# ÉCHOUE si la VaR publiée serait périmée.
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
LOCK="${DOWNSTREAM_LOCK:-/tmp/dailytickers-downstream.lock}"
# 180 x 5 s = 900 s = 15 min. Paramétrable UNIQUEMENT pour que le test du verrou
# fantôme soit exécutable en secondes ; la valeur par défaut est le contrat.
LOCK_MAX_TRIES="${DOWNSTREAM_LOCK_MAX_TRIES:-180}"
LOCK_POLL_S="${DOWNSTREAM_LOCK_POLL_S:-5}"
# Rendre le verrou AVANT d'avoir arrêté les tâches de fond serait pire que pas de
# verrou du tout : gen-api/gen-mode-cards/daily-synthesis sont lancés en `&` et
# NE meurent PAS avec le shell (un SIGTERM ne vise que le shell). Mesuré le 11/08 :
# verrou rendu à +1,5 s, gen-api écrivait encore data/ et portfolio/v1 à +12 s —
# 10 s pendant lesquelles un autre run détient le verrou et écrit les mêmes
# fichiers. Exactement la corruption que ce verrou existe pour empêcher.
# Un kill sur le seul subshell ne suffit pas : il laisse le `node` qu'il a lancé
# orphelin et toujours écrivant. On descend donc d'un niveau via ps.
release(){
  # idempotent : les gestionnaires INT/TERM sortent, ce qui déclenche AUSSI le
  # trap EXIT — sans ce garde, release tournerait deux fois.
  [ -n "${_released:-}" ] && return 0
  _released=1
  local p g
  for p in $(jobs -p 2>/dev/null); do
    for g in $(ps -Ao pid=,ppid= | awk -v pp="$p" '$2==pp{print $1}'); do kill "$g" 2>/dev/null; done
    kill "$p" 2>/dev/null
  done
  wait 2>/dev/null
  rmdir "$LOCK" 2>/dev/null
}
acquire(){
  local n=0
  until mkdir "$LOCK" 2>/dev/null; do
    n=$((n+1)); [ $n -eq 1 ] && log "artefacts partagés verrouillés par un autre run — attente"
    # Durée calculée, pas écrite en dur : un message qui annonce 15 min après en
    # avoir attendu 6 s est un mensonge dans les logs le jour où on cherche pourquoi.
    [ $n -gt "$LOCK_MAX_TRIES" ] && { echo "Verrou tenu >$(( LOCK_MAX_TRIES * LOCK_POLL_S ))s, abandon (verrou fantôme ? rm -rf $LOCK)" >&2; exit 1; }
    sleep "$LOCK_POLL_S"
  done
  # Un trap de signal ne sort PAS tout seul : sans le `exit`, le script libérerait
  # le verrou puis CONTINUERAIT d'écrire sans verrou — pire que pas de verrou.
  # Vertu supplémentaire : bash diffère un trap jusqu'à la fin de la commande au
  # premier plan, donc le node en cours finit d'écrire AVANT qu'on rende le verrou,
  # au lieu d'être orphelin par la mort brutale du shell.
  trap 'release' EXIT
  trap 'release; exit 130' INT
  trap 'release; exit 143' TERM
}

case "$MODE" in
  compute)
    # Valider AVANT de prendre le verrou : un appel malformé n'a aucune raison de
    # faire patienter un run légitime.
    [ -n "$ASOF" ] || { echo "ASOF requis pour compute" >&2; exit 2; }
    acquire

    # ── risk-metrics : l'étape que la coupure CALCUL/DIFFUSION avait PERDUE ────
    # downstream-parallel.sh la lançait (étape 0) ; downstream-split ne la lançait
    # plus, et la doc du /scanner continuait d'annoncer qu'il s'en chargeait. Sans
    # elle, gen-status-page relit data/risk-snapshots.json tel quel et publie la
    # VaR de la veille sans le dire — aucun contrôle de fraîcheur ne l'en empêche.
    # Elle a sa place dans `compute` : locale, idempotente, sans appel MCP (c'est
    # l'AGENT qui produit /tmp/risk-mcp.json, le script ne fait qu'ingérer).
    RISK_SNAP="data/risk-snapshots.json"
    RISK_IN="${RISK_MCP_FILE:-/tmp/risk-mcp.json}"
    # Un risk-mcp.json vieux d'un jour n'est pas une donnée fraîche : l'ingérer
    # réécrit `asOf` à maintenant et fait passer la VaR d'hier pour celle du jour.
    # On refuse d'ingérer une capture périmée, au lieu de la relabelliser.
    RISK_MAX_AGE_H="${RISK_MAX_AGE_H:-12}"
    if [ -f "$RISK_IN" ] && node -e "
      const fs=require('fs');
      const h=(Date.now()-fs.statSync(process.argv[1]).mtimeMs)/3.6e6;
      process.exit(h <= Number(process.argv[2]) ? 0 : 1);
    " "$RISK_IN" "$RISK_MAX_AGE_H"; then
      node tools/refresh-risk-metrics.js --ingest "$RISK_IN" > /tmp/ds-risk.log 2>&1 \
        || { echo "refresh-risk-metrics ÉCHEC (voir /tmp/ds-risk.log)" >&2; exit 1; }
      log "risk-metrics ingéré"
    fi
    # Garde de fraîcheur, qu'il y ait eu ingestion ou non. Une étape rendue
    # manuelle sans garde est une étape qui saute : on ÉCHOUE au lieu de publier
    # une VaR périmée en silence.
    node -e "
      const fs=require('fs');
      const [f,maxH]=process.argv.slice(1);
      let s; try { s=JSON.parse(fs.readFileSync(f,'utf8')); } catch { s=null; }
      if(!s||!s.asOf){ console.error('  '+f+' absent ou illisible'); process.exit(1); }
      const h=(Date.now()-Date.parse(s.asOf))/3.6e6;
      if(!(h<=Number(maxH))){ console.error('  '+f+' date du '+s.asOf+' ('+h.toFixed(1)+' h) — au-delà de '+maxH+' h'); process.exit(1); }
    " "$RISK_SNAP" "$RISK_MAX_AGE_H" || {
      echo "VaR périmée — l'AGENT doit produire $RISK_IN (GetMarketContext regime + PortfolioRisk par mode) AVANT compute." >&2
      echo "N'INVENTE JAMAIS de VaR. Pour un rejeu délibéré sur des chiffres connus périmés : RISK_MAX_AGE_H=<h> devant la commande." >&2
      exit 1
    }

    # ingestion dtx : --decide ET --replay obligatoires. Sans replay, metrics/equity
    # vides et le dashboard retombe sur un placeholder figé (incident du 23/07).
    # Le staging lu est celui que scan-parallel.sh ÉCRIT (`_dtx`), et lui seul. Une
    # branche préférait `_dtx11`, un dossier daté en dur du 11/08 que la collecte ne
    # rafraîchit jamais : relancer la collecte pour le même dossier laissait compute
    # ingérer un staging figé et publier les décisions de midi comme celles de la
    # clôture. Un autre emplacement se passe explicitement, il ne se devine pas.
    S="${DTX_STAGING_DIR:-$DIR/_dtx}"
    if [ -d "$S" ]; then
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
