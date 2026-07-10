---
name: dtx-oom-sequential-and-scanruns
description: dtx OOM sur gros univers equity = concurrence RAM → régénérer les modes UN À LA FOIS (solo passe). + bug _scanRuns=1 (number) fait crasher les scanners scriptés.
metadata:
  type: feedback
---

# dtx OOM (gros univers) + bug _scanRuns=1

## 1. dtx OOM sur gros univers equity = pression RAM CONCURRENTE
Le serveur systematic (dtx) tue (`signal: killed` / OOM) les replays des modes à **gros univers
equity** — `us_highvol` (~2403 titres), `stockbox_nasdaq` (~5189 titres) — quand ils tournent en
**concurrence** (plusieurs DtxReplay lancés proches). etf_us (~univers ETF) et etf_eu passent.

**Fait clé (2026-07-10)** : ces mêmes modes passent SANS OOM en **séquentiel/solo** (un DtxReplay
entièrement fini + ingéré avant de lancer le suivant), en ~1 min chacun. Le matin ils passaient un
par un ; le soir 3 tentatives concurrentes/rapprochées ont OOM. **Ce n'est PAS un replay corrompu**
(≠ [[dtx-replay-sanity-guard]]) — c'est un kill process avant complétion.

**How to apply** : pour régénérer les gros modes equity, TOUJOURS un à la fois (jamais parallèle),
attendre la fin+ingest avant le suivant ; si OOM, pause ~60s (RAM serveur se libère) + 1 retry.
Fix serveur durable = réduire la RAM du chargement d'univers (batch/date-clamp/stream) — hors repo.
Valeurs saines de référence : us_highvol ~631tr/DD-28%/SR1.87 ; stockbox_nasdaq ~230tr/DD-32%/SR1.55.

## 2. Garde sanity étendu au staging STALE
`qa-check.js` ré-évalue désormais TOUT `data/dtx/*.json` via `assertReplaySanity()` (pas seulement le
frais du jour) → un staging stale corrompu committé avant le garde (ex. us_highvol 07-08 1176tr/DD-64%,
stockbox 1395tr/DD-59%) est maintenant flagué en dur, plus affiché en silence. Gate `total_trades>=10`
pour ne pas flaguer les modes vides/non lancés (metals 0 trades = no-data ≠ corrompu). Voir
[[dtx-replay-sanity-guard]].

## 3. Bug _scanRuns=1 (number) fait crasher les scanners scriptés
Le générateur de `scanner/<date>/signals.json` a écrit `_scanRuns: 1` (un NUMBER) au lieu de `{}`.
Résultat : `highvol-scanner.js`/`etf-scanner.js` crashent (`Cannot create property 'highvol' on number
'1'`) et ne posent jamais leur marqueur `_scanRuns[...]` → qa-check 4c ❌ (« marqueur de scan absent »).
**Fix** : coercer `_scanRuns` en `{}` s'il n'est pas un objet AVANT de lancer les scanners, puis relancer
`highvol-scanner`/`etf-scanner`(US)/`etf-scanner --universe etf-eu` avec `--output signals --folder <date>`
(⚠️ `--folder` = la DATE seule, pas `scanner/<date>` — sinon double préfixe `scanner/scanner/`). Durcissement
possible : rendre les scanners défensifs (coerce _scanRuns en objet en interne).
