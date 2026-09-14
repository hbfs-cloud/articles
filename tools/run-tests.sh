#!/usr/bin/env bash
# Lance toutes les suites tools/test-*.js et rend un compte rendu.
#
# Pourquoi ce script : le dépôt portait 42 suites de tests versionnées dont DEUX seulement étaient
# atteignables (test:content-ux). Les 40 autres n'étaient branchées sur aucun hook, aucune CI, aucun
# script npm — donc jamais lancées. Constaté le 2026-09-14 : 39 passaient, une échouait sur une
# régression réelle et deux sur un binaire supprimé en juillet, sans que personne le sache.
# Un test qu'on ne peut pas lancer d'une commande n'est pas un test, c'est un fichier.
#
#   bash tools/run-tests.sh            # tout
#   bash tools/run-tests.sh --quick    # saute les suites navigateur (lentes)
set -uo pipefail
cd "$(dirname "$0")/.."
QUICK=0; [ "${1:-}" = "--quick" ] && QUICK=1
pass=0; fail=0; skip=0; failed=()
for t in tools/test-*.js; do
  n="$(basename "$t")"
  if [ "$QUICK" = "1" ] && [[ "$n" == *browser* ]]; then
    echo "  SKIP  $n (mode rapide)"; skip=$((skip+1)); continue
  fi
  if out="$(node "$t" 2>&1)"; then
    if grep -q '^SKIP ' <<<"$out"; then
      echo "  SKIP  $n — $(grep -m1 '^SKIP ' <<<"$out" | cut -c1-96)"; skip=$((skip+1))
    else
      echo "  ok    $n"; pass=$((pass+1))
    fi
  else
    echo "  ÉCHEC $n"
    grep -m2 -E 'AssertionError|Error:' <<<"$out" | sed 's/^/          /' | cut -c1-150
    fail=$((fail+1)); failed+=("$n")
  fi
done
echo
echo "passés=$pass  ignorés=$skip  échecs=$fail"
[ "$fail" = "0" ] || { printf 'en échec : %s\n' "${failed[*]}"; exit 1; }
