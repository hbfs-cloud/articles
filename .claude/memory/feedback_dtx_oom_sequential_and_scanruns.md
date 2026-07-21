---
name: dtx-oom-sequential-and-scanruns
description: dtx OOM sur gros univers equity = concurrence RAM → régénérer les modes UN À LA FOIS (solo passe). + bug _scanRuns=1 (number) fait crasher les scanners scriptés.
metadata:
  type: feedback
---

## 1. dtx OOM sur gros univers equity = pression RAM CONCURRENTE — régénérer UN À LA FOIS
Le serveur dtx tue (`signal: killed` / OOM) les replays des modes à **gros univers equity** — `us_highvol` (~2403 titres), `stockbox_nasdaq` (~5189 titres) — quand plusieurs DtxReplay tournent en **concurrence**. etf_us / etf_eu passent. **Fait clé :** ces mêmes modes passent SANS OOM en **séquentiel/solo** (~1 min chacun, un DtxReplay entièrement fini + ingéré avant le suivant). Ce n'est PAS un replay corrompu (≠ [[dtx-replay-sanity-guard]]) — c'est un kill process avant complétion.

**How to apply :** pour les gros modes equity, TOUJOURS un à la fois (jamais parallèle), attendre fin+ingest avant le suivant ; si OOM, pause ~60s + 1 retry. Valeurs saines de référence : us_highvol ~631tr / DD-28% / SR1.87 ; stockbox_nasdaq ~230tr / DD-32% / SR1.55.

## 2. Garde sanity étendu au staging STALE
`qa-check.js` ré-évalue TOUT `data/dtx/*.json` via `assertReplaySanity()` (pas seulement le frais du jour) → un staging stale corrompu committé avant le garde (ex. us_highvol 07-08 1176tr/DD-64%) est flagué en dur au lieu d'être affiché en silence. Gate `total_trades>=10` pour ne pas flaguer les modes vides/non lancés (metals 0 trades = no-data ≠ corrompu). Voir [[dtx-replay-sanity-guard]].

## 3. Bug _scanRuns=1 (number) fait crasher les scanners scriptés
`signals.json` écrit parfois `_scanRuns: 1` (NUMBER) au lieu de `{}` → `highvol-scanner.js`/`etf-scanner.js` crashent (`Cannot create property … on number '1'`), marqueur `_scanRuns[...]` jamais posé, qa-check 4c ❌. **Fix :** coercer `_scanRuns` en `{}` s'il n'est pas un objet AVANT de lancer les scanners (⚠️ `--folder` = la DATE seule, pas `scanner/<date>`, sinon double préfixe).
