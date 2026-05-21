---
name: status-page-architecture
description: Scanner status page architecture + Time Machine pattern. Auto-load when user edits scanner/status/**, tools/gen-status-page.js, assets/live-engine.js, assets/live-engine-ui.js, mentions Time Machine, tmUpdateLive, tmLoadIdx, lp-grid, panel(), or rotation tracking. Includes anti-patterns from prior failed refactors.
user_invocable: false
---

# Scanner Status Page — Architecture & Time Machine

**Règle de vie #1 : LIVE est le template canonique. Time Machine = bind data historique dans sections Live existantes. JAMAIS l'inverse.**

## Pipeline génération
1. `tools/gen-status-page.js` produit `scanner/status/index.html` server-side
2. Pour chaque mode, `panel(id, cfg, m, trades, ec, chartId, active)` génère 7 sections HTML :
   - `1. How to trade` (mode-specific guide, collapsible)
   - `2. Today's Signals` (table tbody from `signalsFor(cfg)`)
   - `3. Equity Curve` (perf-hero with `chart-{modeId}` container, perf-stats values)
   - `4. Close Now` (cta-card if timed-out positions)
   - `5. Orders to Place` (cta-orders with buy + rotate rows + recentRotation card)
   - `6. Open Positions` (table tbody from current positions)
   - `7. Trade History` (collapsible tbody from `mTrades`)
3. `live-engine-ui.js` ajoute `lp-card` (live ticker strip) + organize sections en `.lp-grid` 2-cols (desktop)
4. `assets/live-engine.js` initialise WebSocket + ticks live sur position rows

## Time Machine — pattern correct
Slider (`#timeSlider`) → `tmLoadIdx(idx)` :
1. **Capture le live HTML** : `_tmCaptureLive(modeId)` snapshot `panel.querySelector('.lp-grid').innerHTML` au premier swap (cache local `_tmLiveCache`)
2. Fetch `/scanner/status/history/{date}.json`
3. Appel `tmUpdateLive(modeId, snapData, mCfg)` qui :
   - Met à jour 6 valeurs `.perf-hero .perf-stats .ps .ps-v` (Total Return, DD, WR, PF, Trades, Avg Hold)
   - Re-init chart `chart-{modeId}` avec `mk(...)` et nouvelle equity
   - Replace `tbody` de Today's Signals, Open Positions, Trade History avec rows formatées
4. Banner shows "Viewing snapshot from YYYY-MM-DD"
5. `tmShowLive()` : restore `grid.innerHTML = _tmLiveCache[modeId]`, re-init chart depuis `modeCharts[modeId]`

## ⛔ Anti-patterns (testés en session, ECHECS confirmés)
- ❌ **Phase B v1/v2/v3** : Drop sections Live + binder dans `mp-host` template (MODE_PANEL_TPL). Casse grid CSS 2-cols, supprime widgets live (sparkline/gauge/scenario bar).
- ❌ Switch `display:none` entre `.lp-grid` (Live) et `.tm-render` (TM custom template). Layouts visuellement différents.
- ❌ Marquer sections Live `legacy-hidden` + injecter template à côté. Double layout, double charts, double stats.
- ❌ Refactoriser tmRenderInto pour produire HTML diff. Génère layout différent du Live.

## ✅ Pattern validé (production)
**Le Live HTML est la SOURCE DE VÉRITÉ unique pour le layout.** Time Machine ne switche JAMAIS de container — appelle `tmUpdateLive()` qui édite seulement les `tbody` / valeurs stats / chart data, in-place.

## Si tu dois ajouter une nouvelle section au panel mode :
1. Edit `panel()` dans `tools/gen-status-page.js` pour émettre nouvelle `<section class="section-card">` avec son `<h3>` unique
2. Ajoute cas dans `tmUpdateLive()` qui matche par regex sur `<h3>` text et update son `tbody`/data
3. Si data live (ticker price) : ajouter handlers dans `assets/live-engine.js` `evaluatePosition()` et `live-engine-ui.js` `updateRow()`
4. Test via `node tools/gen-status-page.js && python3 -m http.server 8088 && playwright nav http://localhost:8088/scanner/status/`
5. Test Time Machine click slider → vérifier section update avec data historique
6. **JAMAIS push sans validation Playwright locale + check console errors**

## Fichiers en jeu (priorité décroissante)
1. `tools/gen-status-page.js` — server-side render (~1900 LOC). `panel()` à respecter — pas de gros refacto sans validation.
2. `assets/live-engine.js` — WebSocket + position eval (570 LOC). Termine sur SL/TP/EXPIRED via `_terminal` flag.
3. `assets/live-engine-ui.js` — DOM updates per tick (1100 LOC). `createCard`, `buildPositionRows`, `reorganizePanel`.
4. `assets/mode-panel-binder.js` — binder utilitaire (140 LOC). Optional fallback.
5. `tools/gen-api.js` — public API JSON. Lit risk-snapshots.json + history snapshots.

## Stats truth source
- `m.trades` (hero "Closed Trades") = `closedTrades.filter(!_premature).length` (computeMetrics)
- "Trade History" header count = même filter (cohérent)
- `frozen.trades` (sweep computeStatsFromTrades) ≠ ne pas réutiliser pour hero, inclut premature

## Rotation tracking
- Quand sweep rotate (close worst, buy candidate) → `closedTrades.push({...worst, status:'rotated', exitDate:day, pnlPct:forcePnl})`
- gen-status-page panel() détecte `recentExecutedRotation` en comparant prevSnap.modes[id].orders ROTATE vs current pos
- Render comme card "JUST EXECUTED" dans section "Orders to Place"
- Trade row labeled "Rotated" (pas "Pending") via `rotatedKeys` Set + status override
