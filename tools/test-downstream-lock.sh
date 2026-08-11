#!/usr/bin/env bash
# test-downstream-lock — vérifie le verrou de tools/downstream-split.sh.
#
#   bash tools/test-downstream-lock.sh          # ~40 s (délai d'abandon raccourci)
#   bash tools/test-downstream-lock.sh --lent   # ~16 min (délai d'abandon RÉEL)
#
# Ce que le test prouve :
#   (a) deux runs concourants ne se chevauchent JAMAIS dans la section critique ;
#   (b) sur un verrou fantôme, le second abandonne (rc=1) sans voler le verrou ;
#   (c) le verrou est rendu sur tous les chemins de sortie — normal, erreur,
#       SIGTERM, SIGINT — et AUCUN écrivain ne survit à la libération.
#
# ── Pourquoi un `node` factice ─────────────────────────────────────────────────
# Le vrai downstream écrit data/, scanner/status/ et portfolio/v1/. Un test qui
# les écrase pour vérifier un verrou détruirait ce que le verrou protège. On
# substitue donc un `node` en tête de PATH : il trace ses entrées/sorties et ne
# touche aucun fichier du dépôt. La DATE passée (99999999) n'existe pas, ce qui
# neutralise aussi le bloc d'ingestion dtx.
#
# ── Pourquoi `set -m` ──────────────────────────────────────────────────────────
# Sans job control, bash met SIGINT/SIGQUIT à SIG_IGN dans toute commande lancée
# en arrière-plan. Le test de Ctrl-C mesurerait alors le harnais, pas le script.
#
# macOS n'a ni `timeout` ni `gtimeout` : on pilote tout par processus de fond + kill.
set -uo pipefail
set -m

cd "$(dirname "$0")/.." || exit 1
# Surchargeable pour pouvoir rejouer le test contre une version antérieure et
# vérifier qu'il ÉCHOUE dessus : un test qui ne sait pas échouer ne prouve rien.
SCRIPT="${DS_SCRIPT:-tools/downstream-split.sh}"
[ -f "$SCRIPT" ] || { echo "introuvable : $SCRIPT" >&2; exit 1; }

LENT=0; [ "${1:-}" = "--lent" ] && LENT=1
TMP=$(mktemp -d "${TMPDIR:-/tmp}/ds-lock-test.XXXXXX") || exit 1
trap 'pkill -f "$TMP/bin/node" 2>/dev/null; rm -rf "$TMP" "$LOCK" 2>/dev/null' EXIT
LOCK="$TMP/lock"          # jamais le verrou de production : un test ne bloque pas un vrai run
FAIL=0
sl(){ perl -e "select(undef,undef,undef,$1)"; }
ok(){ echo "  OK   $*"; }
ko(){ echo "  ÉCHEC $*"; FAIL=1; }

mkdir -p "$TMP/bin"
cat > "$TMP/bin/node" <<'STUB'
#!/usr/bin/env bash
# Doublure de node : trace, temporise, n'écrit rien du dépôt.
name=$(basename "${1:-?}")
echo "$(perl -MTime::HiRes=time -e 'printf "%.3f", time') $$ IN $name" >> "${STUB_TRACE:-/dev/null}"
case "$name" in
  gen-status-page.js)
    perl -e "select(undef,undef,undef,${STUB_SLEEP_STATUS:-0})"
    [ -n "${STUB_FAIL:-}" ] && exit 3 ;;
  gen-api.js)
    perl -e "select(undef,undef,undef,${STUB_SLEEP_API:-0})"
    # marqueur d'écriture tardive : une ligne ici APRÈS la libération du verrou
    # signifie qu'un autre run pouvait déjà écrire les mêmes fichiers.
    echo "$(perl -MTime::HiRes=time -e 'printf "%.3f", time') ECRITURE" >> "${STUB_WRITES:-/dev/null}" ;;
esac
echo "$(perl -MTime::HiRes=time -e 'printf "%.3f", time') $$ OUT $name" >> "${STUB_TRACE:-/dev/null}"
exit 0
STUB
chmod +x "$TMP/bin/node"
export PATH="$TMP/bin:$PATH"

attendre_verrou(){ local n=0; while [ ! -d "$LOCK" ] && [ $n -lt 100 ]; do n=$((n+1)); sl 0.1; done; }

echo "(a) exclusion mutuelle"
rm -rf "$LOCK"; : > "$TMP/trace"
STUB_TRACE="$TMP/trace" STUB_SLEEP_STATUS=6 DOWNSTREAM_LOCK="$LOCK" \
  bash "$SCRIPT" compute 99999999 2026-01-01 >"$TMP/a1" 2>&1 &
A=$!; sl 1
STUB_TRACE="$TMP/trace" STUB_SLEEP_STATUS=0 DOWNSTREAM_LOCK="$LOCK" DOWNSTREAM_LOCK_POLL_S=1 \
  bash "$SCRIPT" compute 99999999 2026-01-01 >"$TMP/a2" 2>&1 &
B=$!; wait $A; wait $B
grep -q "attente" "$TMP/a2" && ok "le second a attendu au lieu d'écrire" || ko "le second n'a pas signalé d'attente"
python3 - "$TMP/trace" <<'PY' || FAIL=1
import sys, collections
ev = [l.split() for l in open(sys.argv[1]) if l.strip()]
# le shell principal de chaque run est celui qui exécute gen-status-page
shells = [e[1] for e in ev if e[3] == 'gen-status-page.js' and e[2] == 'IN']
spans = sorted((min(float(e[0]) for e in ev if e[1] == s),
                max(float(e[0]) for e in ev if e[1] == s)) for s in shells)
if len(spans) < 2:
    print("  ÉCHEC (a) : un seul run tracé, test invalide"); sys.exit(1)
if all(spans[i][1] < spans[i+1][0] for i in range(len(spans)-1)):
    print("  OK   sections critiques disjointes (écart %.2fs)" % (spans[1][0]-spans[0][1])); sys.exit(0)
print("  ÉCHEC (a) : sections critiques CHEVAUCHANTES — le verrou ne protège rien"); sys.exit(1)
PY

echo "(b) verrou fantôme"
rm -rf "$LOCK"; mkdir -p "$LOCK"
if [ $LENT -eq 1 ]; then TRIES=180; POLL=5; ATTENDU=900; else TRIES=3; POLL=2; ATTENDU=6; fi
S=$(date +%s)
DOWNSTREAM_LOCK="$LOCK" DOWNSTREAM_LOCK_MAX_TRIES=$TRIES DOWNSTREAM_LOCK_POLL_S=$POLL \
  bash "$SCRIPT" compute 99999999 2026-01-01 >"$TMP/b.out" 2>"$TMP/b.err"
RC=$?; E=$(( $(date +%s) - S ))
[ $RC -eq 1 ] && ok "abandon avec rc=1" || ko "rc=$RC au lieu de 1"
[ $E -ge $ATTENDU ] && [ $E -le $(( ATTENDU + 30 )) ] && ok "a patienté ${E}s (attendu ~${ATTENDU}s)" \
  || ko "a patienté ${E}s, hors de la cible ~${ATTENDU}s"
grep -q "verrou fantôme" "$TMP/b.err" && ok "message d'abandon sur stderr" || ko "pas de message d'abandon"
[ -d "$LOCK" ] && ok "n'a PAS volé le verrou d'autrui" || ko "a supprimé un verrou qu'il ne détenait pas"
rm -rf "$LOCK"

echo "(c) libération sur chaque sortie"
cas(){ # $1 libellé, $2 signal, $3 env, $4 sleep gen-status-page
  rm -rf "$LOCK"; : > "$TMP/writes"
  env $3 STUB_SLEEP_STATUS="$4" STUB_WRITES="$TMP/writes" STUB_SLEEP_API=10 \
      DOWNSTREAM_LOCK="$LOCK" bash "$SCRIPT" compute 99999999 2026-01-01 >"$TMP/c.out" 2>&1 &
  local P=$!
  attendre_verrou
  [ -d "$LOCK" ] || { ko "$1 : verrou jamais pris (test invalide)"; return; }
  case "$2" in
    TERM|INT) kill -"$2" "$P" 2>/dev/null ;;
    groupe)   kill -INT -"$P" 2>/dev/null ;;
  esac
  local libere=NON i trel=0
  # 120 x 0,25 s = 30 s : il faut couvrir le cas nominal complet (gen-status-page
  # PUIS gen-api temporisé), pas seulement une interruption précoce.
  for i in $(seq 1 120); do
    sl 0.25
    [ -d "$LOCK" ] || { libere=OUI; trel=$(perl -MTime::HiRes=time -e 'printf "%.3f", time'); break; }
  done
  wait "$P" 2>/dev/null
  local orphelins; orphelins=$(pgrep -f "$TMP/bin/node" | wc -l | tr -d ' ')
  sl 2   # laisser à un éventuel écrivain survivant le temps de se manifester
  # Seules les écritures POSTÉRIEURES à la libération sont fautives : pendant la
  # section critique, écrire est précisément ce que le run a le droit de faire.
  local tardives; tardives=$(awk -v t="$trel" '$1 > t' "$TMP/writes" | wc -l | tr -d ' ')
  if [ "$libere" = OUI ] && [ "$orphelins" = 0 ] && [ "$tardives" = 0 ]; then
    ok "$1 : verrou rendu, aucun écrivain survivant"
  else
    ko "$1 : libéré=$libere, écrivains encore vivants=$orphelins, écritures après libération=$tardives"
  fi
  pkill -f "$TMP/bin/node" 2>/dev/null; rm -rf "$LOCK"
}
# Un délai non nul est indispensable même sur les cas « rapides » : sans lui le run
# prend et rend le verrou entre deux sondages, et le test se déclare invalide.
cas "sortie normale"           none   ""            2
cas "échec gen-status-page"    none   "STUB_FAIL=1" 2
cas "SIGTERM"                  TERM   ""            5
cas "SIGINT (shell seul)"      INT    ""            5
cas "SIGINT groupe (Ctrl-C)"   groupe ""            5
# SIGKILL n'est pas testé comme une réussite : aucun processus ne peut l'intercepter.
# Le verrou survit forcément — c'est précisément le verrou fantôme que (b) couvre.

echo
[ $FAIL -eq 0 ] && echo "VERROU OK — (a) exclusion, (b) abandon propre, (c) libération complète" \
                || echo "VERROU DÉFAILLANT — voir les lignes ÉCHEC ci-dessus"
exit $FAIL
