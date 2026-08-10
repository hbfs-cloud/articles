# /retro — Rétrospective scanner harnachée (fills réels → notation intègre → leçons → panel → publish)

Produit la rétrospective d'un scan (`scanner/YYYYMMDD/retro/` selon template `scanner/CLAUDE.md` §5bis)
via le skill **`content-harness`**. Skills compagnons : `scanner-pipeline` (§rétrospective), `senior-review`.
La rétro nourrit `data/scanner-lessons.json` (lessons-engine) — c'est un artefact d'INTÉGRITÉ, pas de com.


## ⚡ Phase de collecte — SCRIPTÉE (obligatoire depuis 2026-08-10)

**Ne joue plus les salves MCP à la main.** Émets un jeton, lance la collecte, lis les
artefacts. Le modèle déclare le besoin ; il ne transporte plus la donnée.

```bash
# 1. l'AGENT émet le jeton (max 60 min marketdata, 1440 systematic)
#    GetReadOnlyToken(minutes=60) / DtxMintReadOnlyToken(ttl_minutes=240)
#    → export MCP_TOKEN_MARKETDATA=… MCP_TOKEN_SYSTEMATIC=…
# 2. collecte parallèle + gate de fraîcheur en une commande
bash tools/run-collect.sh retro <dossier>/_data --var refdate=<derniere_cloture> [--var symbol=X]
```

Ce que ça règle mécaniquement, et qu'on oubliait :
- `$refdate` est substitué dans TOUS les arguments → le contrat de date devient structurel,
  plus aucun `end_date` oublié (cause des inversions de signe du weekly du 10/08) ;
- `harness.json` est un sous-produit de la collecte → une source collectée mais non déclarée
  devient impossible ;
- les appels d'une vague partent en parallèle → la règle R2 de `perf-parallel-mcp` est dans le
  moteur, plus dans un rappel de prompt.

Une variable référencée par le plan mais non fournie est une **erreur**, pas un vide : un
`end_date` absent renverrait « le monde d'aujourd'hui » au lieu de la date visée.

Reste à l'agent, et à lui seul : `RefreshBars` / `DtxRefreshBars` (vraies écritures), la
sélection, la rédaction, les gates adversariaux, la décision de publier.
Doctrine complète : skill `llm-script-boundary`.

## Arguments
`$ARGUMENTS`
- vide → dernier scan dont l'horizon est écoulé et sans rétro.
- `--date YYYYMMDD` → scan explicite.
- `dry-run` → analyse sans publication.

## Phase 0 — Preflight (H0)
`date -u` ; `GetStatus()` (HARD STOP si down) ; `get_context(query='retrospective scanner', workspace='dailystocks')` ;
lire `scanner/YYYYMMDD/{data.json,signals.json}` + `data/scanner-positions.json` + `data/trade-chain.json` ;
créer `scanner/YYYYMMDD/retro-harness.json`.

## Phase 1 — Collecte (H1)
**Salve 1 (vérité prix, par lot)** :
- `QueryData(types='quote', symbols=CSV des 10+TKL)` + bars de la fenêtre du scan (`GetInstruments` si
  QueryData approval-gated) — la rétro se calcule sur des BARRES RÉELLES de la fenêtre, jamais de mémoire.
- `ExplainSymbolMove` sur chaque gagnant/perdant majeur — l'attribution (news ? secteur ? marché ?) fait
  partie de la leçon.
- `GetEarningsCalendarFiltered` rétroactif : un stop-out sur print non anticipé = leçon de process,
  pas de malchance.
**Salve 2 (contexte)** :
- `GetMarketContext(facets='regime')` du jour de la rétro + relire le régime AU MOMENT du scan
  (dans data.json) — juger les setups dans LEUR régime (règle Regime-Aware Eval).
- `GetInsiderActivity(symbols=CSV, days=7)` + `QueryData(types='sec_filings,flags')` sur les perdants :
  dilution/insiders ratés à la sélection = leçon prioritaire.
- Modes scriptés touchés → `DtxReplay` segment (méthodo drift : replay COMPLET, delta relatif interne,
  jamais une fenêtre courte isolée).

## Phase 2 — Fills & stats (déterministe, bloquant)
- Fills via le MODULE PARTAGÉ scan/rétro (assertion CI) — mêmes règles VWAP/gap que le sweep. JAMAIS de
  fill « de tête ».
- Trades clôturés = IMMUABLES (trade-chain SHA-256). La rétro requalifie sa PROPRE notation si besoin,
  jamais les stats scellées.
- R multiples, WR, PF recalculés depuis les fills — chaque chiffre du tableau doit se recalculer.

## Phase 3 — Gate fraîcheur + war room (H2-H3)
`node tools/check-freshness.js scanner/YYYYMMDD/retro-harness.json` (bars/quotes 24h, régime 6h).
War room : Bull défend le process du scan, Bear attaque (survivorship, chance déguisée en skill,
règle violée ?), Retail demande « qu'est-ce que le prochain scan fait DIFFÉREMMENT ? ». Chaque leçon
sortante : falsifiable, scoped (régime×setup), avec `next_retro_check`.

## Phase 4 — Rédaction + leçons
Template §5bis. Notation par ligne argumentée prix à l'appui. Leçons → `data/scanner-lessons.json` via
le format lessons-engine (status, confidence, scope, severity) — les advisory nourrissent la sélection,
elles n'inversent JAMAIS un signal quantitatif.

## Phase 5-6 — QA + Panel (H4-H5, bloquants)
`qa-content --strict` (ou qa-check selon artefact) + `check-ai-tells` + `check-freshness`, puis
senior-review `type:"retro"` (QA·Quant·Trader·Editor), applyFixes. BLOCK = pas de publication.

## Phase 7 — Publication (H6)
add_card si artefact indexé, commit + push `main`, Telegram alias du mode concerné ou `analysis` si
rétro transverse (`format:"html"`), compte-rendu chat avec les leçons ajoutées/dépréciées.

## Garde-fous
- Immutable Trades (violation = abort), Sweep pSize History (jamais de batch-reset).
- Segment Replay Absolute DD non fiable : deltas relatifs uniquement.
- Une rétro qui ne trouve AUCUNE erreur de process est suspecte — le dire si c'est le cas, mais chercher.
- MCP HARD STOP intégral.
