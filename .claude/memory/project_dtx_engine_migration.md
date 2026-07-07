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

**⚠️ MODE NATIF = LE BON (corrigé 2026-07-07)** : on OMET `--bars` → dtx **résout lui-même l'univers**
depuis les filtres du YAML (region/min_market_cap/stocks/etfs/forex_universe/blacklist via staticdata)
ET **fetch l'OHLCV lui-même** (Yahoo/Binance/BVC), exactement comme cmd/backtest. **Les books gèrent
eux-mêmes leur cache + univers** — on ne construit RIEN (ni listes univers, ni backfill bars). Prouvé :
`replay eu_dax` natif → cagr 17.86/dd 20.38/sharpe 0.81/r2 0.87/52 trades sur les VRAIS noms DAX
(MRK.DE/SIE.DE/UN0.DE). Contrainte : **lancer depuis la racine systematic-tss** (a besoin de
`data/instruments/<broker>.json` + staticdata + réseau) — PAS autoportant → à gérer côté cloud.
Mon erreur Phase 1 = avoir câblé le mode INJECTÉ (`--bars` avec notre price-cache biaisé/incomplet) →
jp/in/eu échouaient. Le mode injecté (`--bars`) reste utile pour un run 100% offline/portable, mais
le book se pilote en NATIF.

**Invocations vérifiées (2026-07-07, marchent)** :
- `replay --portfolio cfg.yaml --bars b.json --from D --to D` → stdout JSON {results:[{cagr_pct,
  max_dd_pct,sharpe,r2,win_rate,equity_dates[],equity_values[],...}]}. Logs sur STDERR.
- `decide --portfolio cfg.yaml --asof D --bars b.json --positions pos.json --orders ord.json
  --balances bal.json [--state s.json]` → {state, actions:{CREATE,UPDATE,CANCEL}}.
  - ⚠️ `--positions`/`--orders` = ARRAYS JSON (`[]`).
  - ⚠️⚠️ **CORRIGÉ** : `--balances` n'est PAS un objet plat `{"USD":100000}` (ça parse en
    `total_equity=0` → 0 buying power → **0 ordres SILENCIEUX**). Vrai schéma (cmd/dtx/decide_cmd.go) :
    `{base_currency, cash_by_currency:{CUR:amt}, total_equity}`. Le wrapper `dtx-engine.js` accepte la
    forme plate par commodité et la normalise.
  - ⚠️ Output OrderRequest en **snake_case** : `symbol, side, order_type, limit_price, stop_loss,
    take_profit, qty, reason, priority` (pas de TimeInForce/OCOGroup/TrailingStop dans la sérialisation).
  - Certains fichiers cache portent des timestamps `YYYY-MM-DDThh:mm:ss` que le moteur rejette →
    dtx-bars.js normalise en `YYYY-MM-DD`.
  - `state` persisté (`data/dtx/state/<mode>.json`) → re-run du MÊME asof = non-idempotent (les entrées
    du jour sont déjà "created" → 0 nouveaux ordres). Correct pour cadence live ; cold run (rm state) =
    reproduit les ordres.
- Preuve reproduite (asof 2026-06-30, cold) : replay us_highvol cagr 44.91/dd 24.95/sharpe 1.19/117
  trades ; decide → 2 BUY (ATEX qty145, ABVX qty112). stockbox → 8 rotations dont 7/8 = box publiée
  (parité forte). etf_us/us_ablite/etf_eu/metals OK. crypto/forex = vrais bars mais 0 trades (régime
  gating + histo court). jp/in/eu_dax/eu_uk = **échouent honnêtement** (cache sans tickers .T/.NS/.DE).

**Book viable (~11 stratégies, configs systematic-tss/config/)** : forex, us_highvol, etf_us, etf_eu,
uk, jp, stockbox_nasdaq, us_ablite, crypto, eu_dax, in, eu_uk (+metals). Caveat : CAGR absolus =
univers biaisé survivorship/look-ahead → le rang relatif vaut, pas les niveaux ; 9/10 flaggées
sharp-peak. Plafond du book = le biais d'univers, pas le tuning. Escape = fournir nos propres listes
d'univers point-in-time en mode injecté.

**Phasage** :
- Phase 1 (déléguée) : vendorer binaires (lfs) + wrapper Node dtx-engine.js + assembleur PIT bars
  dtx-bars.js + orchestrateur dtx-scan.js → sortie STAGING (data/dtx/) sans toucher JS/sweep/signals live.
- Phase 2 : basculer dtx-scan.js en MODE NATIF (lancé depuis racine systematic-tss, dtx résout
  univers + fetch data pour TOUS les books y compris jp/in/eu/crypto/forex) + câbler la sortie dans
  les pools de gen-status-page + retirer les scanners JS. (Les « listes univers PIT » et « backfill
  bars étrangers » de mon plan initial sont MOOT en natif — les books gèrent ça eux-mêmes.)
- Phase 3 (CONSENTEMENT requis) : re-baseline du track-record (dtx replay ≠ sweep.js scellé) — règle
  immutable-trades, ne jamais toucher les trades clôturés sans accord.
- Cloud : dtx-linux-amd64 committé mais JAMAIS exécuté → valider au 1er run cloud réel.

**Caveats francs (README)** : parité natif mesurée sur 1 seule config (EU DAX) ; crypto/forex/
casablanca câblés mais non exercés par un run réel ; linux-amd64 jamais lancé. Lié à
[[verify-iso-by-running]], [[iso-cache-and-resync]], [[scripted-modes-tss-order-parity]].
