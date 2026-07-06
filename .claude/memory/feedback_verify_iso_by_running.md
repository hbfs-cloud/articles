---
name: verify-iso-by-running
description: Vérifier l'iso d'un scanner JS porté vs systematic-tss en LANÇANT le Go (backtest/scanner-debug/oracle dédié), jamais en lisant seulement le code. Comparaison juste = candidats-scanner par date, pas l'état.
metadata:
  type: feedback
---

Quand on prétend qu'un scanner JS articles est un port ISO d'un scanner Go systematic-tss, **prouver en exécutant le Go**, pas en lisant le code (leçon 2026-07-06, le user a insisté 2×).

**Why:** une analyse de code a affirmé "gate liquidité fidèle, 0 = légitime" — le run a montré l'inverse (Go highvol sort DAVE, pas 0). Et une explication "Go n'a pas la data" était fausse (parquets présents). Lire le code sur-estime la fidélité ; seul le run révèle les divergences réelles.

**How to apply:**
- Go scanner-debug : `cd systematic-tss && go build -o bin/backtest ./cmd/backtest && ./bin/backtest -config <cfg> -start S -end E -scanner-debug /tmp/x.csv`, filtrer la colonne `Strategy`.
- Stratégies de **portefeuille** (index-rotation) n'émettent RIEN dans scanner-debug → oracle dédié (ex `cmd/stockbox-overlap` réutilisant `computeRanking`).
- **Comparaison juste** : Go porte des ordres pending/positions d'un jour à l'autre (ÉTAT) ; le scanner JS est stateless. Comparer les **candidats-scanner par date**, pas les positions/pending (piège DAVE = ordre d'état, pas signal du jour).
- Outil de resync permanent : `tools/verify-iso.js` + manifeste `data/iso-alignment.json` (tss_git_sha + config_sha256, `--check-drift`). Le régime n'est PAS un simple flag "off" pour les scriptés — certains scanners (etf-momentum) l'utilisent comme filtre régime-dépendant.

Lié : [[iso-cache-and-resync]], [[scripted-modes-scorecard]].
