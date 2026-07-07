---
name: dtx-engine-migration
description: Migration des scanners scriptés JS → binaire dtx (vrai moteur systematic-tss, JSON-in/out) — full migration décidée 2026-07-07
metadata:
  type: project
---

**Décision (user, 2026-07-07)** : migration COMPLÈTE des scanners scriptés hand-portés en JS vers le
binaire **`dtx`** qui expose le VRAI moteur systematic-tss (scanners + position managers + régime +
sizing + VIX — code exact de prod, commit 076c38ab) en CLI **JSON-in/JSON-out**. But : ne PLUS jamais
ré-implémenter la logique ailleurs, on l'APPELLE. Ça supprime toute la classe de bug « parité iso »
(verify-iso.js, seuils hardcodés, resync) qui a coûté des mois — dtx EST systematic-tss.

**Binaire** : `trading/tools/bin/dtx-{darwin-arm64,linux-amd64}` (git-lfs) + PROVENANCE.json. README :
`trading/tools/bin/README.md`. Sous-commandes `decide|replay|regime`. Rebuild : systematic-tss
`git checkout feat/dtx-binaries && bash scripts/build-dtx.sh`.

**Mode injecté (celui qu'on utilise ici)** : `--bars bars.json` = TU fournis les bars → offline,
déterministe, portable (juste binaire + JSON). Nos fichiers `data/.price-cache/<TICKER>_ohlcv.json`
sont DÉJÀ au bon format ({date,open,high,low,close,volume} array). PIT-safe via price-cache.js.

**Invocations vérifiées (2026-07-07, marchent)** :
- `replay --portfolio cfg.yaml --bars b.json --from D --to D` → stdout JSON {results:[{cagr_pct,
  max_dd_pct,sharpe,r2,win_rate,equity_dates[],equity_values[],...}]}. Logs sur STDERR.
- `decide --portfolio cfg.yaml --asof D --bars b.json --positions pos.json --orders ord.json
  --balances bal.json [--state s.json]` → {state, actions:{CREATE,UPDATE,CANCEL}}. ⚠️ GOTCHA :
  --positions/--orders = ARRAYS JSON ([]) ; --balances = OBJET ({"EUR":100000}). `state` à persister.
- Smoke test : replay us_highvol sur 40 tickers cache → cagr 6.56/dd 13.69/sharpe 0.37, 22 trades, exit 0.

**Book viable (~11 stratégies, configs systematic-tss/config/)** : forex, us_highvol, etf_us, etf_eu,
uk, jp, stockbox_nasdaq, us_ablite, crypto, eu_dax, in, eu_uk (+metals). Caveat : CAGR absolus =
univers biaisé survivorship/look-ahead → le rang relatif vaut, pas les niveaux ; 9/10 flaggées
sharp-peak. Plafond du book = le biais d'univers, pas le tuning. Escape = fournir nos propres listes
d'univers point-in-time en mode injecté.

**Phasage** :
- Phase 1 (déléguée) : vendorer binaires (lfs) + wrapper Node dtx-engine.js + assembleur PIT bars
  dtx-bars.js + orchestrateur dtx-scan.js → sortie STAGING (data/dtx/) sans toucher JS/sweep/signals live.
- Phase 2 : câbler dans gen-status-page (pools) + listes univers PIT + retirer les scanners JS.
- Phase 3 (CONSENTEMENT requis) : re-baseline du track-record (dtx replay ≠ sweep.js scellé) — règle
  immutable-trades, ne jamais toucher les trades clôturés sans accord.
- Cloud : dtx-linux-amd64 committé mais JAMAIS exécuté → valider au 1er run cloud réel.

**Caveats francs (README)** : parité natif mesurée sur 1 seule config (EU DAX) ; crypto/forex/
casablanca câblés mais non exercés par un run réel ; linux-amd64 jamais lancé. Lié à
[[verify-iso-by-running]], [[iso-cache-and-resync]], [[scripted-modes-tss-order-parity]].
