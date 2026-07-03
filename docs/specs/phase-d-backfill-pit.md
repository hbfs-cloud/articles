# Spec — Phase D : backfill scan point-in-time 2021-2026

**Auteur (plan)** : Fable · **Implémenteur cible** : Opus (data infra complexe/risquée) · **Workflow** : dynamic
**Statut** : BLOQUÉ sur MCP marketdata (données historiques réelles requises) · **Priorité** : la plus haute (déblocage final)

## Pourquoi
Les modes re-portés (highvol, hybrid, forex…) sont en `draft` **non validables** : le moteur articles
accumule les signaux en marche avant (chaque scan quotidien append à `scanner/YYYYMMDD/signals.json`),
il n'existe **aucun scan historique 2021-2024**. Donc `sweep.js` ne peut backtester que depuis le début
du scan forward. Le frère Go, lui, re-scanne toute l'histoire → c'est ce qui prouve les chiffres
(highvol ~87-89% CAGR gate $3M). Sans backfill PIT, impossible de prouver la fidélité au Go.

## Approche (4 étapes)
1. **Acquisition données** (MCP REQUIS) : OHLCV daily de tout l'univers (`data/americanbull-universe.json`
   + forex + etc.) sur 2021-01-01→présent via `GetInstruments` (bars_depth ~1300). Stocker dans le cache
   PIT existant `data/.price-cache` (les scanners le lisent déjà). Confirmer format + couverture avant tout.
2. **Harnais de re-scan historique** : pour chaque jour de trading D ∈ 2021-2026, lancer chaque scanner
   (candlestick, fractal, highvol, hybrid, forex) avec `--date D`/`--as-of D` contre les barres ≤ D. Les
   scanners supportent DÉJÀ le point-in-time (cut `cutIdx` + gate établi médiane 60j). Écrire dans un
   **namespace séparé** `scanner/backfill/YYYYMMDD/signals.json` (format compact possible).
3. **Consommation sweep** : pointer `sweep.js` sur les dossiers backfill → construire l'historique de trades
   complet par mode → frozen stats full-period honnêtes.
4. **Validation** : comparer stats JS backfill vs scorecard Go par mode ; flaguer divergences > seuil.

## Gotchas (CRITIQUES)
- **Survivorship de l'univers** : le fichier univers doit être point-in-time. Utiliser l'univers d'AUJOURD'HUI
  pour toute l'histoire réintroduit le biais. Soit récupérer la composition historique, soit **accepter le
  gate $-volume établi comme contrôle** (il filtre déjà les non-liquides PIT) — décision à trancher.
- **Immutabilité** : le backfill NE DOIT PAS écraser les trades scellés forward ni la chaîne SHA. Namespace
  séparé, comparaison uniquement (cf `[[frozen-portfolio-aware]]`, `[[segment-replay-absolute-dd]]`).
- **Volume** : 5 ans daily × ~3500 tickers = lourd. Batcher, réutiliser le cache, concurrence bornée.
- **MCP HARD STOP** : si données stale/aberrantes → stop, ne rien inventer.

## Critères de succès
Frozen full-period par mode reconstruit depuis le backfill, réconcilié à ±X% du scorecard Go, sans toucher
un seul trade scellé. À ce moment seulement : passage draft→test possible pour un mode.
