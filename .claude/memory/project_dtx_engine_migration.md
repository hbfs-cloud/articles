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

---

## PHASE 2 FAITE (2026-07-07, commits dae33e745 + 39cd94830, pushés)

**Étape 1 — dtx-scan natif** (`tools/dtx-scan.js` réécrit, `tools/lib/dtx-engine.js` étendu) :
- `dtx-engine.replay/decide` acceptent `{cwd, dataDir}` ; `bars` devient optionnel (omis → NATIF).
  Chemins absolutisés (le binaire chdir dans le data-dir). Mode injecté inchangé (selftest OK).
- `dtx-scan.js` : abandonne dtx-bars (univers/backfill) ; NATIF, `cwd=$DTX_TSS_ROOT` (défaut
  `../systematic-tss`), fail-closed si `data/instruments/` absent. **decide STATELESS/COLD par
  design** (book à plat → set COMPLET des BUY du lendemain, comme l'ancien scanner JS stateless ;
  un state chaud rend decide incrémental → 0 ordre au re-run même asof).
- **Les 13 books produisent en natif, Y COMPRIS les échecs Phase 1** (jp/in/eu_dax/eu_uk/crypto/
  forex sur VRAIS noms étrangers). **Parité us_highvol natif 87.94/27.68/1.87 ≈ publié 87.3/27.7/1.86**
  (quasi-exact). Table (asof 2026-06-30, from 2021-01-01) : etf_eu 68.73/SR2.03, etf_us 52.38/SR1.66,
  stockbox 77.73/SR1.65, forex 7.28/SR2.39, jp 15.56, in 20.23, crypto 40.08(14 tr), us_ablite 20.08,
  eu_dax 21.17, eu_uk 20.69, uk 27.36. metals = 0 trades (config à revoir). CAGR = univers courant
  (survivorship-optimiste, cf README) → signal de parité, pas vérité absolue.

**Étape 2 — câblage gen-status-page** (SCRIPTED live seulement) :
- Bridge `DTX_STAGING_MAP` (dashboard id → staging) : highvol→us_highvol, forex→forex, etf→etf_us,
  etf_eu→etf_eu, stockbox→stockbox_nasdaq. **hybrid = PAS de yaml config/dtx → reste sur sweep.**
- Orders to Place ← dtx `decide` CREATE (`dtxSignalsFor`, tolère MARKET sans limit/stop → "—").
- Equity + hero stats (ret/DD/WR/CAGR/Sharpe/R²) ← dtx `replay` (courbe base-100 ; pit/forward
  neutralisés → dtx = hero). **Profit Factor + Avg Hold = "—"** (replay ne les donne pas → pas de faux 0x/0d).
- **Trade History = INCHANGÉ (sweep)** : `dtx replay` n'a AUCUN tableau per-trade ni flag `--trades`
  (vérifié cmd/dtx/replay_cmd.go : seulement l'agrégat). → source per-trade impossible depuis replay.
- Fail-safe : pas de staging → fallback gracieux (ancien pool signaux + equity sweep).
- QUALITY (turbo/dynamic/balanced/secured/fortress/aplus) NON touchés (turbo +112.24% vérifié).
- **Browser-verifié (Playwright 1440px + 390px)** : orders rendus, canvas equity présent, hero peuplé,
  ZÉRO régression layout (bodyOverflow=false desktop+mobile).

**PAS retiré (contrairement au plan initial) — DÉCISION honnête** : les scanners JS (highvol-scanner.js,
etf-scanner.js, forex/candlestick/crypto/…) ÉCRIVENT `signals.json` qui alimente `sweep.js` → le
**track-record SCELLÉ** (`frozen_<mode>`) + les snapshots **Time Machine** + `posFor` positions. Phase 2
n'a remplacé QUE l'AFFICHAGE live (orders/equity/stats), pas le pipeline scellé. Donc les scanners +
`verify-iso.js`/`iso-alignment.json` restent LOAD-BEARING → **on ne retire rien tant que Phase 3
(re-baseline, consentement) n'est pas faite**. Retirer casserait signals.json (partagé) + les modes quality.
NB : les modes scriptés n'avaient AUCUN track-record scellé avant (frozen_highvol/forex/stockbox absents)
→ dtx remplit un vide, ne déplace pas de donnée scellée.

**LIMITES connues** : (1) fenêtre replay = 2021-présent → total return énorme (+3098% highvol) à côté des
quality since-launch (~+112%) — honnête (courbe pluriannuelle visible) mais **décision produit à confirmer**
(trivial à changer via `--from`). (2) Labels axe MM/DD répètent sur une courbe pluriannuelle (limite
pré-existante). (3) Time Machine des modes scriptés reste sur les snapshots JS (pas dtx) → léger décrochage
historique. (4) metals = 0 trades natif.

**CLOUD (requirement natif)** : la routine nightly qui lance `dtx-scan.js` doit avoir **systematic-tss
checké out avec son contexte data** (`data/instruments/<broker>.json` + staticdata) **+ réseau** (fetch
Yahoo/Binance/BVC), et pointer `DTX_TSS_ROOT` dessus. Injecté serait 100% portable mais on est en natif.
**`dtx-linux-amd64` = ELF valide JAMAIS exécuté** → valider au 1er run cloud (`git lfs pull` +
`node tools/lib/dtx-engine.js --selftest`). Ne PAS reconfigurer le trigger ici — juste ce requirement noté.

**PHASE 3 (reste, CONSENTEMENT)** : re-baseline du track-record scellé (dtx replay = source de vérité vs
sweep), ce qui permettrait ENSUITE de retirer les scanners JS + le pipeline iso. Règle immutable-trades.

---

## PHASE 2.5 — CLOUD-VIABLE (DÉCOUPLAGE) FAITE (2026-07-07)

**Problème résolu** : Phase 2 avait câblé la machinerie mais dtx-scan n'était wired dans AUCUN
pipeline, et le staging `data/dtx/*.json` était **gitignoré** → la routine cloud 23h (sandbox qui
clone SEULEMENT `articles`, sans `../systematic-tss` ni réseau) ne voyait jamais de sortie dtx → les
modes scriptés retombaient silencieusement sur le pool JS legacy. **Pas cloud-viable.**

**Architecture = DÉCOUPLAGE** : le natif dtx tourne EN AMONT (dev local / box `ser` où
systematic-tss + réseau existent) et **COMMITTE le staging** ; le cloud **LIT seulement** le staging
committé (zéro systematic-tss, zéro binaire Linux exécuté, zéro réseau requis côté cloud).

**Changements (commit à venir)** :
1. **`data/dtx/.gitignore`** : les 5 staging WIRED (`us_highvol/forex/etf_us/etf_eu/stockbox_nasdaq`)
   sont maintenant VERSIONNÉS (whitelist `!<mode>.json`) ; `state/` + portfolios non-câblés restent
   ignorés (byproducts regénérables, machine-local).
2. **`tools/dtx-scan.js`** : flag **`--skip-if-no-tss`** → si `../systematic-tss`/`$DTX_TSS_ROOT`
   absent, `exit 0` + warning (fail-SAFE) au lieu de `exit 3` (fail-closed). Un run manuel direct SANS
   le flag garde le hard-error. Le pipeline passe le flag → jamais de blocage cloud.
3. **`tools/publish-daily-card.sh`** : Step 4d (avant gen-status-page) boucle `dtx-scan --mode <M>
   --asof $SCAN_DATE_ISO --skip-if-no-tss` sur les 5 modes ; date de séance hoistée en tête (SCAN_DATE
   + SCAN_DATE_ISO) ; `data/dtx/*.json` ajouté au `git add` du commit.
4. **`.claude/skills/scanner-pipeline.md`** : étape dtx dans le bloc pipeline + section « dtx refresh
   (DÉCOUPLÉ) » (exigence de fraîcheur + cron proposé).

**PARITÉ (preuve de correction, vs Go — pas vs les scanners JS)** : `cmd/backtest` (Go, buildé
`go build -o bin/backtest ./cmd/backtest`) VS `dtx replay` natif, MÊME config + fenêtre
(2024-01-01→2024-07-01). **Champ-à-champ EXACT (headline ET courbe equity dates+valeurs)** sur les 4
books testés :
| book | cagr | dd | sharpe | trades | final_equity | verdict |
|---|---|---|---|---|---|---|
| eu_dax | 1.14 | 9.41 | 0.15 | 12 | 100566.43 | EXACT |
| us_highvol | 166.96 | 11.08 | 2.67 | 78 | 163113.81 | EXACT |
| etf_us | 16.48 | 11.1 | 0.81 | 198 | 107895.61 | EXACT |
| stockbox_nasdaq | 35.12 | 24.45 | 0.97 | 18 | 116181.21 | EXACT |
Aucune divergence → le moteur dtx EST cmd/backtest (universe_provider partagé). Confirme la claim
README d'une parité qui n'était mesurée que sur eu_dax.

**DRY-RUN CLOUD SIMULÉ** (`DTX_TSS_ROOT=/nonexistent`) : dtx-scan skip proprement (exit 0, warning)
pour les 5 modes → `gen-status-page` + `gen-api` tournent jusqu'au bout en LISANT le staging committé
(les 5 modes marqués `[dtx]`) → `qa-check` **0 ❌** (38 ✅ / 7 ⚠️ pré-existants). Playwright 1440px
(HTTP) : highvol/etf/stockbox rendent chart canvas + « Backtest 2021 »/« backtest + live » + panneau
Orders (etf/stockbox 24 rows ; highvol 0 = jour calme légitime, 0 CREATE), 0 hard JS error,
overflowX=0 (aucune régression layout). **⇒ la routine 23h ne casse PAS si systematic-tss est absent.**

**BINAIRE LINUX = MOOT pour le cloud** : avec le découplage, le cloud ne LANCE jamais dtx (il lit du
JSON) → le risque « dtx-linux-amd64 jamais exécuté » ne concerne plus le chemin cloud. (Un fallback
cloud-side serait possible — dtx-linux + nos bars via `--bars`, sans systematic-tss — mais NON
nécessaire tant que le staging est rafraîchi en amont ; non construit, à dessein.)

**EXIGENCE RÉCURRENTE (à ne pas oublier)** : le staging vaut le dernier `dtx-scan` amont. Un host
systematic-tss+réseau (dev nightly ou `ser`) DOIT `dtx-scan` + committer `data/dtx/` AVANT le 23h
cloud, sinon le site affiche le dernier staging committé (stale, pas cassé). Cron proposé (~22h30,
NON configuré sur ser depuis ici) : voir `.claude/skills/scanner-pipeline.md` § « dtx refresh
(DÉCOUPLÉ) ». Le `statusSince` de chaque mode pilote le splice backtest→live (`--to`).

---

## PHASE 2.6 — NATIF AUTOPORTANT : dépendance systematic-tss CASSÉE (2026-07-07)

**But atteint** : le natif `dtx` n'a PLUS besoin du repo frère `systematic-tss`. Il tourne avec le
binaire + un **bundle data vendorisé in-repo** + le réseau (fetch OHLCV). Le cloud peut donc lancer le
natif dès qu'il a le réseau (Yahoo/Binance) ; **plus aucune dépendance au sibling repo**.

**Comment (approche prouvée, reprise du repo `trading`)** — PAS le vendoring brut 34M de
`data/instruments/`, mais un **BUNDLE compacté 9,9 Mo** à `articles/tools/bin/dtx-data/` (git-lfs) :
univers (frozen ticker lists stockanalysis) + instruments brokers, champs strippés/minifiés/élagués
par market-cap (behavior-preserving, parité vérifiée). Le binaire **Jul-2026 (commit `43d53455`)**
auto-découvre un dossier `dtx-data/` **à côté du binaire**, ou prend `--data-dir DIR` / `$DTX_DATA_DIR`.
Les binaires articles ont été **mis à jour** vers ce build (l'ancien `076c38ab` ne supportait pas
`--data-dir`). Cache OHLCV → `$DTX_WRITABLE_CACHE_DIR` (sinon MkdirTemp) → **checkout read-only OK**.

**Fichiers vendorisés (commit)** : `tools/bin/{dtx-darwin-arm64,dtx-linux-amd64,PROVENANCE.json,
README.md}` (binaires Jul-7 écrasent les vieux) + bundle `tools/bin/dtx-data/**` (15 fichiers lfs) :
build-report.json, data/instruments/{alpaca,saxo,trading212}.json, cache/stockanalysis/stock/{US,UK,DE,
JP,IN}/tickers-frozen.json, cache/stockanalysis/etf/US/... + **5 fichiers EU ETF minifiés ajoutés
localement pour etf_eu** (etf/{FR,DE,NL,IT,ES}, strip aux 5 champs ETF `averageVolume/etfCategory/
etfCountry/exchange/name` — identique au minifier du bundle, 10,9M brut → 707K). IBKR ne requiert aucun
fichier (construit depuis staticdata). forex/crypto = univers INLINE dans le YAML (rien à bundler).

**Rewire** : `tools/dtx-scan.js` — `TSS_ROOT`/cwd remplacés par `resolveDataCtx()` : `DTX_DATA_DIR` →
`tools/bin/dtx-data` (bundle, défaut) → `../systematic-tss` (fallback legacy cwd). Passe `dataDir` (→
`--data-dir`) à `engine.decide/replay`. Pose `DTX_WRITABLE_CACHE_DIR` (défaut `os.tmpdir/dtx-ohlcv-cache`).
`.gitattributes` : `tools/bin/dtx-*` + `tools/bin/dtx-data/**` en lfs. `.gitignore` : négation
`!tools/bin/dtx-data/cache/**` (la règle globale `cache/` masquait le bundle). `dtx-engine.js` déjà
compatible `dataDir`/`--data-dir` (juste comments MAJ).

**PREUVE (systematic-tss DÉPLACÉ `../systematic-tss.hidden`, injoignable)** — 5 modes wired natif,
bundle + réseau seuls, asof 2026-07-06, from 2024-01-01 :
| mode | orders (decide) | replay | vs sibling |
|---|---|---|---|
| us_highvol | 0 | cagr 111.24 / 383 tr | EXACT (orders + replay) |
| forex | 1 | cagr 5.32 / 388 tr | EXACT (orders + replay) |
| etf_us | 7 | cagr 41–43 / ~1240 tr | orders EXACT ; replay ≠ (voir caveat) |
| stockbox_nasdaq | 8 | cagr 157 / 104 tr | orders EXACT ; replay ≈ |
| etf_eu | 0 | 0 trades | **byte-identique au sibling** (0=0) |

**decide (= les picks du dashboard) = EXACT vs sibling pour les 5 modes.** ⇒ la dépendance repo est
bien cassée : tout ce qui est lu du disque vient du bundle.

**CAVEAT réseau (honnête, pas une régression)** : le **replay** (courbe equity) est NON-déterministe
quand le cache OHLCV est froid. Le sibling est déterministe UNIQUEMENT parce qu'il a un `cache/yahoo/`
CHAUD local (aucun fetch) ; le bundle ne vendorise QUE le référentiel univers (pas l'OHLCV) → il fetch
tout en live et se fait **rate-limiter (429) par Yahoo** → sous-ensemble de symboles différent à chaque
run (etf_us : 1231 vs 1249 tr entre 2 runs bundle ; sibling stable 1118). C'est le caveat README
« déterminisme replay = cache chaud ». **Résidu = RÉSEAU, pas le sibling repo.** Pour un replay
déterministe : chauffer/persister `$DTX_WRITABLE_CACHE_DIR` en amont.

**etf_eu = 0 trades en natif** : l'univers CHARGE bien depuis le bundle (« ETFs loaded: 3161 » —
mes fichiers EU ETF minifiés marchent), mais l'étape OHLCV échoue (« failed to load any symbols
(errors: 3192) ») — **Yahoo ne sert pas l'OHLCV des tickers ETF européens**. IDENTIQUE avec le sibling
(0=0) → limitation data-source pré-existante, PAS liée à la migration.

**RÉSIDU unique** = le **réseau** (Yahoo/Binance OHLCV), plus le repo sibling. Le fallback legacy
`../systematic-tss` (cwd) reste pour un dev qui l'a encore. `--skip-if-no-tss` (alias `--skip-if-no-data`)
ne se déclenche plus que si git-lfs n'a pas pull `tools/bin/dtx-data/`.
