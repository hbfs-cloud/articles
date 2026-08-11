#!/usr/bin/env bash
# desk-run — l'exécuteur de /desk. Consomme le plan, lance les chaînes qui sont
# indépendantes en parallèle, passe les gates, et s'arrête net si le chemin
# critique casse.
#
#   bash tools/desk-run.sh                      # plan + collecte + gates
#   bash tools/desk-run.sh --plan-only          # décide, ne collecte rien
#   bash tools/desk-run.sh --verify             # rapproche disque et registre
#   bash tools/desk-run.sh --record <type> --channels web,telegram [--trigger <id>]
#   bash tools/desk-run.sh --authorize-email <type> --materiality N --evidence "…"
#
# ── Ce que ce script ne fait pas ────────────────────────────────────────────
# Il ne rédige rien, ne sélectionne rien, ne publie rien, et il NE POUSSE RIEN.
# Il amène des artefacts datés jusqu'au gate de fraîcheur, et s'arrête là. La
# rédaction, le panel adversarial et la décision de publier appartiennent au
# modèle, et le temps gagné ici est fait pour être dépensé là-bas.
#
# ── Le graphe réel ─────────────────────────────────────────────────────────
#   P0  plan            desk-plan.js, aucun MCP           bloquant, ~1 s
#   O   overview        détachée, personne ne l'attend    non bloquante
#   S   socle           14 appels, une vague, ~30 s       bloquant (B3)
#   V   scanner         scan-parallel.sh (vivier→enrich., dtx, sweep)  ~200 s
#   Pn  produits        après S, en parallèle entre eux
#   B4  fraîcheur       check-freshness sur chaque harnais produit
#   D   downstream      APRÈS B4, en --no-push : rien ne devient public ici
#
# L'ordre B4 → D n'est pas cosmétique. Le downstream se terminait par un
# `git push origin main` : le scanner était donc EN LIGNE avant que la barrière
# de fraîcheur ne se prononce, et « REFUSÉS PAR LES GATES: scanner » s'affichait
# sur du contenu déjà public, sans rollback. Le panel, lui, n'avait même pas
# encore été convoqué.
#
# V part IMMÉDIATEMENT, sans attendre le socle : c'est le chemin critique, et le
# retarder de 30 s pour lui économiser 5 appels serait un mauvais échange. Les
# autres produits, eux, attendent le socle et héritent de ses sources.
set -uo pipefail

# Tout ce fichier parle en chemins relatifs (`tools/…`, `plans/…`, `data/…`), et
# le registre de publication est un fichier sur disque. Se caler sur la racine du
# dépôt n'est donc pas une commodité : lancé depuis un sous-dossier, le script
# lisait un autre registre — donc un autre quota email.
cd "$(dirname "$0")/.." || { echo "ÉCHEC: racine du dépôt introuvable" >&2; exit 1; }

T0=$(date +%s)
log(){ printf '[%3ds] %s\n' "$(( $(date +%s) - T0 ))" "$*"; }
die(){ echo "ÉCHEC: $*" >&2; exit 1; }

# Le socle sert le plus lent en premier ; ce délai borne l'attente de overview.
# Au-delà, on continue SANS lui : il ne porte que de la prose de contexte.
OVERVIEW_DEADLINE_S="${OVERVIEW_DEADLINE_S:-240}"

# ─────────────────────────────────────────────────────────────────────────────
# Sous-commande : enregistrement d'une publication SANS email.
# `email` y est explicitement refusé. C'est la moitié du garde-fou : sans ce
# refus, il suffirait d'appeler --record avec email pour marquer un envoi sans
# jamais passer la vérification de matérialité, et le quota deviendrait
# décoratif.
# ─────────────────────────────────────────────────────────────────────────────
if [ "${1:-}" = "--record" ]; then
  TYPE="${2:?usage: --record <type> --channels web,telegram}"
  shift 2
  CH=""; TRIG=""
  while [ $# -gt 0 ]; do case "$1" in
    --channels) CH="${2:-}"; shift 2;;
    # --trigger : identité de l'événement qui a rendu le produit dû (macro,
    # squeeze). Elle voyage jusqu'au registre parce que c'est ELLE, et non
    # l'horodatage, que le --check du lendemain confrontera. desk-plan l'imprime
    # avec la commande complète, il n'y a rien à reconstituer.
    --trigger) TRIG="${2:-}"; shift 2;;
    *) shift;;
  esac; done
  [ -n "$CH" ] || die "--channels requis"
  # Normalisation AVANT le test. Le filtre littéral laissait passer « web, email »
  # (espace) et « web,EMAIL » (casse) : le premier enregistrait un email par le
  # chemin censé le refuser, le second en enregistrait un que le quota ne comptait
  # pas. Le gate normalise de la même façon — les deux doivent voir la même chaîne.
  CH=$(printf '%s' "$CH" | tr 'A-Z' 'a-z' | tr -d '[:space:]')
  case ",$CH," in *,email,*) die "--record ne peut pas enregistrer un email. L'email passe par --authorize-email, qui vérifie la matérialité et le quota sous verrou.";; esac
  if [ -n "$TRIG" ]; then
    exec node tools/publication-gate.js --record "$TYPE" --channels "$CH" --trigger "$TRIG"
  fi
  exec node tools/publication-gate.js --record "$TYPE" --channels "$CH"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Sous-commande : rapprochement disque ↔ registre. À lancer en fin de /desk et
# au début du suivant. Le mode de panne le plus probable n'est pas le
# contournement, c'est l'OUBLI : un `--record` qui saute et le produit ressort en
# double le lendemain.
# ─────────────────────────────────────────────────────────────────────────────
if [ "${1:-}" = "--verify" ]; then shift; exec node tools/desk-verify.js "$@"; fi

# ─────────────────────────────────────────────────────────────────────────────
# Sous-commande : autorisation d'email. SEUL chemin autorisé.
#
# Ce bloc n'est plus qu'un guichet : la décision, le verrou, la consommation du
# quota et l'émission du jeton vivent DANS `publication-gate.js --authorize`, un
# seul processus. Le découpage précédent — verrou ici, décision là-bas — ne
# protégeait rien : le gate exposait par ailleurs un `--check` qui prononçait
# « Email AUTORISÉ » sans verrou et sans rien écrire, et l'enregistrement se
# faisait avec un drapeau `--authorized` que n'importe quel appelant pouvait
# poser. Un verrou qui n'entoure pas le chemin qu'on peut emprunter à côté n'est
# pas un verrou.
#
# Ce que le guichet garantit désormais, parce que le gate le garantit :
#  1. VERROU autour de vérification + enregistrement + émission, dans le même
#     processus. Le 10 août, deux produits ont lu tous les deux un quota libre.
#  2. QUOTA BRÛLÉ AVANT L'ENVOI. Si l'envoi échoue, on a perdu un email autorisé
#     — c'est le bon sens de l'échec.
#  3. JETON À USAGE UNIQUE. C'est la seule partie EXÉCUTOIRE : le point d'envoi
#     le consomme, et sans lui `send_email=true` est refusé.
# ─────────────────────────────────────────────────────────────────────────────
if [ "${1:-}" = "--authorize-email" ]; then
  TYPE="${2:?usage: --authorize-email <type> --materiality N --evidence \"…\"}"
  shift 2
  MAT=""; EV=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --materiality) MAT="${2:-}"; shift 2;;
      --evidence|--materiality-evidence) EV="${2:-}"; shift 2;;
      *) shift;;
    esac
  done
  [ -n "$MAT" ] || die "--materiality N requis (entier 0-100) : un email sans justification chiffrée n'est pas un email autorisé."
  [ -n "$EV" ] || die "--evidence \"…\" requis : le score seul ne justifie rien, il est choisi par la partie qui a intérêt à envoyer. Écrire le fait, le chiffre, l'écart au consensus."
  exec node tools/publication-gate.js --authorize "$TYPE" --materiality "$MAT" --evidence "$EV"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Phase 0 — le plan. Aucun MCP, pure logique : il doit pouvoir tourner même
# sans jeton, et c'est lui qui dit s'il y a une raison d'en demander un.
# ─────────────────────────────────────────────────────────────────────────────
# `${*:-}` et non `"$@"` : sous `set -u`, bash 3.2 (celui de macOS) considère
# encore "$@" comme non lié quand il n'y a aucun argument.
PLAN_ONLY=0
case " ${*:-} " in *" --plan-only "*) PLAN_ONLY=1;; esac

DAY=$(node -e 'process.stdout.write(new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Paris"}).format(new Date()).replace(/-/g,""))')
DESK="data/desk/$DAY"
mkdir -p "$DESK"
PLAN="$DESK/plan.json"

node tools/desk-plan.js --out "$PLAN"
rc=$?
if [ $rc -eq 10 ]; then log "rien n'est dû aujourd'hui — c'est un résultat, pas une panne."; exit 0; fi
[ $rc -eq 0 ] || die "desk-plan a échoué (rc=$rc)"
[ $PLAN_ONLY -eq 1 ] && { log "--plan-only : $PLAN écrit, aucune collecte."; exit 0; }

# Lecture du plan. Un seul point d'accès pour éviter que bash réinterprète des
# dates ou des chemins que desk-plan a déjà calculés.
pj(){ node -e "const p=require('./$PLAN');$1" ; }
REF=$(pj 'process.stdout.write(p.reference_close)')
ASOF=$(pj 'process.stdout.write(p.session)')
SESSION_C=$(pj 'process.stdout.write(p.session_compact)')
DUE=$(pj 'process.stdout.write(p.due.map(d=>d.type).join(" "))')
is_due(){ case " $DUE " in *" $1 "*) return 0;; *) return 1;; esac; }

log "plan : [$DUE] · clôture $REF · séance $ASOF"

# ─────────────────────────────────────────────────────────────────────────────
# Jetons. Ils viennent de l'ENVIRONNEMENT et de nulle part ailleurs : aucun
# jeton n'est écrit sur disque, aucun ne passe en argv (visible dans `ps`).
# Aucun jeton ne se renouvelle lui-même — un run de plus de 60 min doit être
# segmenté, avec réémission par l'agent.
# ─────────────────────────────────────────────────────────────────────────────
[ -n "${MCP_TOKEN_MARKETDATA:-}${MCP_ACCESS_TOKEN:-}" ] || cat >&2 <<'MSG'
[desk-run] Aucun jeton marketdata dans l'environnement.
  L'AGENT en émet un puis relance :
    GetReadOnlyToken(minutes=60)        → export MCP_TOKEN_MARKETDATA=…
    DtxMintReadOnlyToken(ttl_minutes)   → export MCP_TOKEN_SYSTEMATIC=…
MSG
[ -n "${MCP_TOKEN_MARKETDATA:-}${MCP_ACCESS_TOKEN:-}" ] || exit 3
[ -n "${MCP_TOKEN_SYSTEMATIC:-}${MCP_ACCESS_TOKEN:-}" ] || log "⚠ pas de jeton systematic : régime dtx et décisions du moteur seront absents du socle."

SOCLE="$DESK/_socle"
SOCLE_OV="$DESK/_socle_overview"
mkdir -p "$SOCLE" "$SOCLE_OV"

# ── Chaîne O : overview, détachée ───────────────────────────────────────────
# Lancée en premier parce que c'est la plus lente et la plus instable (63 s à
# 298 s mesurés), et dans son PROPRE dossier pour ne pas courir après l'index du
# socle. Personne ne l'attend : elle ne porte aucun chiffre publié.
( node tools/collect.js --plan plans/socle-overview.json --out "$SOCLE_OV" --quiet --var refdate="$REF" \
    > "$DESK/O.log" 2>&1; echo $? > "$DESK/O.rc" ) & PO=$!

# ── Chaîne V : scanner ─────────────────────────────────────────────────────
# Part MAINTENANT, volontairement sans le socle. C'est le chemin critique
# (~200 s) : lui faire attendre 30 s de socle pour lui économiser 5 appels
# rapides serait payer 30 s pour en gagner 3.
PV=""
if is_due scanner; then
  ( bash tools/scan-parallel.sh "$SESSION_C" "$REF" "$ASOF" > "$DESK/V.log" 2>&1; echo $? > "$DESK/V.rc" ) & PV=$!
  log "V lancée — scanner $SESSION_C (vivier→enrichissement · dtx · suivi+sweep)"
fi

# ── Chaîne S : socle partagé ───────────────────────────────────────────────
node tools/collect.js --plan plans/socle.json --out "$SOCLE" --quiet --var refdate="$REF" > "$DESK/S.log" 2>&1
SRC=$?
[ -f "$SOCLE/_socle.json" ] || die "socle sans index : aucune source partageable. On ne poursuit pas sur des données partielles."
log "S terminée (rc=$SRC) — $(node -e "process.stdout.write(String(Object.keys(require('./$SOCLE/_socle.json').entries).length))") nom(s) de source couverts"

# ── Barrière B3 : socle complet avant toute rédaction ───────────────────────
# Puis on rejoue le plan AVEC le socle : les produits conditionnés à la donnée
# (densité de la saison des résultats, événement macro de tier 1) ne pouvaient
# pas être tranchés avant. Rejouer coûte une seconde et ne rappelle rien.
node tools/desk-plan.js --socle "$SOCLE" --out "$PLAN" >/dev/null
DUE=$(pj 'process.stdout.write(p.due.map(d=>d.type).join(" "))')
log "plan réévalué avec le socle : [$DUE]"
# Le socle peut RETIRER un produit (saison des résultats trop creuse, aucun
# événement de tier 1). Se retrouver sans rien à écrire est alors le bon
# résultat, pas un échec de collecte.
if [ -z "$DUE" ]; then log "plus rien n'est dû après lecture du socle — arrêt propre."; wait "$PO" 2>/dev/null; exit 0; fi

# Le socle et l'overview sont servis aux plans produits par variable
# d'environnement plutôt que par argument : ainsi tout `collect.js` lancé en
# aval en hérite, y compris ceux appelés par des scripts qu'on ne modifie pas.
export COLLECT_SOCLE_DIR="$SOCLE:$SOCLE_OV"

# ── Chaînes produits : après S, en parallèle entre elles ────────────────────
PIDS=""; NAMES=""
launch(){ # launch <nom> <plan> <out> [--var k=v ...]
  local name="$1" plan="$2" out="$3"; shift 3
  mkdir -p "$out"
  ( node tools/collect.js --plan "plans/$plan.json" --out "$out" --quiet --var refdate="$REF" "$@" \
      > "$DESK/$name.log" 2>&1; echo $? > "$DESK/$name.rc" ) &
  PIDS="$PIDS $!"; NAMES="$NAMES $name:$out"
  log "$name lancé → $out"
}

is_due daily    && launch daily    daily       "daily/$DAY/_data"
is_due signals  && launch signals  signals-desk "$DESK/signals"
is_due rotation && launch rotation rotation    "$DESK/rotation"
if is_due weekly; then
  MON=$(pj 'const w=p.due.find(d=>d.type==="weekly");process.stdout.write(w&&w.vars.monday?w.vars.monday.replace(/-/g,""):"")')
  [ -n "$MON" ] && launch weekly weekly "weekly/$MON/_data"
fi
if is_due retro; then
  # La rétro a besoin de $symbols, produits depuis les signaux du scan clos. La
  # charnière n'existe pas encore : on refuse de la remplacer par une recopie du
  # modèle, qui est exactement le transport de données que la doctrine interdit.
  if [ -x tools/extract-retro-symbols.js ] || [ -f tools/extract-retro-symbols.js ]; then
    SCAN=$(pj 'const r=p.due.find(d=>d.type==="retro");process.stdout.write(r?r.vars.scan:"")')
    mkdir -p "scanner/$SCAN/retro/_data"
    node tools/extract-retro-symbols.js --scan "scanner/$SCAN" --out "scanner/$SCAN/retro/_data/vars.json" \
      > "$DESK/retro-symbols.log" 2>&1 \
      && launch retro retro "scanner/$SCAN/retro/_data" --vars-file "scanner/$SCAN/retro/_data/vars.json" \
      || log "⚠ retro écartée : vivier de symboles introuvable"
  else
    log "⚠ retro écartée : tools/extract-retro-symbols.js manquant (voir plan.json → due[].blocker)"
  fi
fi

for p in $PIDS; do wait "$p"; done
log "chaînes produits terminées"

# ── overview : on lui laisse sa laisse, pas une minute de plus ──────────────
if kill -0 "$PO" 2>/dev/null; then
  while kill -0 "$PO" 2>/dev/null && [ $(( $(date +%s) - T0 )) -lt "$OVERVIEW_DEADLINE_S" ]; do sleep 2; done
  if kill -0 "$PO" 2>/dev/null; then
    kill "$PO" 2>/dev/null
    log "⚠ overview abandonné après ${OVERVIEW_DEADLINE_S}s — le run continue SANS lui (prose de contexte uniquement)."
  fi
fi
wait "$PO" 2>/dev/null
[ "$(cat "$DESK/O.rc" 2>/dev/null || echo 1)" = "0" ] && log "O terminée — overview disponible" || log "⚠ overview absent"

# ── V : on l'attend, c'est le chemin critique ───────────────────────────────
# On l'attend ICI, mais on ne lance PAS son downstream : celui-ci se terminait
# par un push sur main, donc publiait avant B4. Le downstream part plus bas,
# après la barrière de fraîcheur, et en --no-push.
if [ -n "$PV" ]; then
  wait "$PV"
  VRC=$(cat "$DESK/V.rc" 2>/dev/null || echo 1)
  [ "$VRC" = "0" ] || die "chaîne scanner en échec (voir $DESK/V.log) — on ne publie PAS un scan sur des données partielles."
  log "V terminée"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Barrière B4 — fraîcheur. Bloquante PAR PRODUIT, pas pour tout le run : un
# weekly dont une source est périmée n'a aucune raison d'empêcher le daily de
# sortir. Le produit fautif, lui, est retiré du plan.
# ─────────────────────────────────────────────────────────────────────────────
OK=""; KO=""
# Initialisé AVANT le bloc scanner : sous `set -u`, une variable seulement
# affectée à l'intérieur d'un `if` non pris fait planter la lecture d'après.
scan_ok=0
for entry in $NAMES; do
  name="${entry%%:*}"; out="${entry#*:}"
  rc=$(cat "$DESK/$name.rc" 2>/dev/null || echo 1)
  if [ ! -f "$out/harness.json" ]; then KO="$KO $name(pas de harnais)"; continue; fi
  if node tools/check-freshness.js "$out/harness.json" > "$DESK/$name.freshness.log" 2>&1; then
    [ "$rc" = "0" ] && OK="$OK $name" || KO="$KO $name(collecte rc=$rc)"
  else
    KO="$KO $name(fraîcheur)"
  fi
done
if is_due scanner; then
  # scan-parallel écrit un harnais PAR VAGUE (_data = vivier, _data2 =
  # enrichissement) ; le harnais racine est celui du harnais éditorial, qui
  # n'existe pas encore à ce stade. Les deux vagues doivent passer : un
  # enrichissement frais sur un vivier périmé reste un scan périmé.
  scan_ok=1
  for h in "scanner/$SESSION_C/_data/harness.json" "scanner/$SESSION_C/_data2/harness.json"; do
    [ -f "$h" ] || { KO="$KO scanner(pas de harnais $h)"; scan_ok=0; break; }
    node tools/check-freshness.js "$h" > "$DESK/scanner.freshness.log" 2>&1 || { KO="$KO scanner(fraîcheur)"; scan_ok=0; break; }
  done
  [ $scan_ok -eq 1 ] && OK="$OK scanner"
fi

# ── D : downstream scanner, APRÈS B4 et sans jamais publier ─────────────────
# Il ne tourne que si le scan a passé la fraîcheur, et il tourne en --no-push :
# artefacts locaux, fichiers stagés, aucun commit, aucun push. Rendre public est
# une décision qui vient après le panel — jamais un effet de bord de la collecte.
if is_due scanner && [ $scan_ok -eq 1 ]; then
  bash tools/downstream-parallel.sh "$SESSION_C" "$ASOF" --no-push > "$DESK/V-downstream.log" 2>&1 \
    || die "downstream scanner en échec (voir $DESK/V-downstream.log)"
  log "downstream scanner fait — artefacts LOCAUX, rien n'a été poussé"
elif is_due scanner; then
  log "⚠ downstream scanner NON lancé : le scan n'a pas passé la barrière de fraîcheur."
fi

node -e "
const fs=require('fs');const p=JSON.parse(fs.readFileSync('$PLAN','utf8'));
const ok='$OK'.trim().split(/\s+/).filter(Boolean);
p.collected=ok; p.rejected='$KO'.trim().split(/\s+/).filter(Boolean);
p.collected_at=new Date().toISOString();
fs.writeFileSync('$PLAN',JSON.stringify(p,null,2));"

echo
log "PRÊTS À RÉDIGER :${OK:- aucun}"
[ -n "$KO" ] && log "REFUSÉS PAR LES GATES :$KO  ← ne pas publier, recollecter. Jamais estimer."
echo
cat <<'EOF'
  Rien n'a été poussé. Rien n'est public. La suite appartient au modèle :
    1. war room / sélection sur un vivier déjà conforme
    2. rédaction — Substack ANGLAIS, Telegram FRANÇAIS (html, <b>, aucun terme interne)
    3. gates : qa-content --strict, check-ai-tells --strict
    4. panel senior-review — BLOCK = on ne publie pas. C'est le poste qu'on ne comprime pas.
    5. publication web (git add ciblé + commit + push) puis Telegram, puis :
         bash tools/desk-run.sh --record <type> --channels web,telegram
       email UNIQUEMENT via :
         bash tools/desk-run.sh --authorize-email <type> --materiality N --evidence "<justification>"
       → émet un jeton à usage unique valable 10 min. Sans lui, send_email=true est REFUSÉ
         au point d'envoi (hook PreToolUse + handler du serveur). Ce n'est plus une consigne.
    6. contrôle de bouclage — un --record oublié republie demain :
         bash tools/desk-run.sh --verify
EOF
node tools/desk-verify.js >/dev/null 2>&1 || log "⚠ des artefacts récents n'ont pas de ligne de registre — lancer  bash tools/desk-run.sh --verify"

[ -n "$OK" ] || die "aucun produit n'a passé les gates."
exit 0
