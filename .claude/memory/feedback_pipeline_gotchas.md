---
name: Scanner Pipeline Gotchas (lessons learned 2026-04-28)
description: Recurring bugs in the scanner pipeline + their canonical fixes — check before re-introducing similar code paths
type: feedback
originSessionId: 5f7bec6b-570c-4184-81de-1453678bac51
---
Pipeline `node tools/update-tracking.js → sweep.js → refresh-risk-metrics.js → gen-status-page.js → gen-api.js → publish-daily-card.sh` has historically produced these silent regressions. Always verify the listed checks after non-trivial edits.

**Why:** these bugs all shipped to production and were only caught by user inspection or QA. Each fix is small but the *patterns* (loose greps, status-flag hijacking, count drift, stub fallbacks) repeat.

**How to apply:** before committing changes to any of the listed files, mentally run through this checklist; after pipeline runs, always look at QA output (step 7 of publish-daily-card.sh).

## Fixed bugs to never reintroduce

1. **macOS vs Linux `date` in shell pipeline scripts** (`publish-daily-card.sh`)
   - Symptom: `date: illegal option -- d` on macOS, step 6 (commit) silently fails.
   - Pattern: BSD `date` does not accept `-d '+N days'`. Use a helper:
     ```bash
     if date -v +1d '+%Y' >/dev/null 2>&1; then
       _date_add_days() { date -v "+${1}d" '+%Y%m%d'; }   # BSD
     else
       _date_add_days() { date -d "+${1} days" '+%Y%m%d'; } # GNU
     fi
     ```
   - Fix commit: a40ea8d7

2. **`refresh-risk-metrics.js` falling back to `--stub` silently** when MCP_GATEWAY_URL not set
   - Production gateway URL = `https://gateway.dailytickers.com/mcp`. Always export it before running. Never accept `[info] MCP_GATEWAY_URL not set — writing stub schema` as success.
   - See `reference_mcp_gateway.md`.

3. **QA strategy-label check grepping HTML prose** (`tools/qa-check.js`)
   - Symptom: false positives like "Defensive" matched in setup thesis ("defensive pharma", "defensive hedge").
   - Fix: read `signals.json` (or `data.json` setups[].pattern) and validate against canonical taxonomy `{Momentum, Pullback, Breakout, Pre-Squeeze}` only.
   - Fix commit: a83e1c77

4. **Generic empty-state message "No signals for this mode today"** (`tools/gen-status-page.js`)
   - When a mode legitimately has 0 signals because of filter mismatch (e.g. Secured `breakout_only` on a scan with 0 Breakouts), do not show a generic message. Compute pre/post-filter counts and explain why.
   - Fix commit: ce6c82d7

5. **Trade rendered as "Pending (Nd/Md)" despite horizon already elapsed** (`tools/gen-status-page.js` line ~875)
   - Symptom: NVDA Fortress with `status='expired'`, `holdDays=2`, `horizon=8`, `exitDate=2026-04-17` still rendered "Pending (2d/8d)" twelve days later.
   - Pattern: `_premature` was set whenever `holdDays < cfg.horizon`, but that doesn't mean the trade is still open — it could have been rotated, early-TP, or horizon-elapsed in real time.
   - Fix: render Pending only when `_premature && !_horizonExpired`.
   - Fix commit: 458c2d33

6. **"Orders to Place" count using `actionRows.length`** (`tools/gen-status-page.js` line ~666)
   - Symptom: header showed "2 Orders to Place" for a single rotation because each order pushes 1-3 `<tr>` (main + comparison-card + thesis).
   - Fix: count logical orders: `totalActions = buyOrders.length + rotationCandidates.length`.
   - Fix commit: bcc5fc19

7. **`sweep.js` pending injection bypass `portfolioSize`** (`tools/sweep.js` lines ~1679-1690, 2026-05-05 fix)
   - Symptom: turbo/dynamic (portfolioSize=1) showed 5+ "pending" trades on the same scan day. User saw LMT, ASML, XLK simultaneously in turbo Open Positions.
   - Pattern: per-ticker pre-sim list (`tradesByKey[frozenKey]`) was injected into `merged` for any pending entry not already present, IGNORING portfolio constraints from `simulatePortfolio`.
   - Fix: REMOVED the `pendingToAdd` injection block. `sim2.closedTrades` already includes pending positions from `openPositions` flush at end of simulatePortfolio (line ~947-951), respecting portfolioSize/rotation/sector caps.
   - Verify: `node -e "const t=JSON.parse(require('fs').readFileSync('data/backtest-trades.json','utf8'));for(const id of ['turbo','dynamic']){const a=t[id]||[];const p=a.filter(x=>x.status==='pending');console.log(id,p.length)}"` — must be 0.

8. **TKL pool scores all=99** (`tools/sweep.js` `buildSetups`, 2026-05-05)
   - Symptom: scanner generation hardcodes `score: 99` for ALL tkl_pool entries (raw screener output meaningless). Sorting + minScore gate broken.
   - Fix: at parse time in sweep, derive composite score for `source==='tkl_pool'`:
     `score = min(95, round(85 + stratBonus*0.4 + rrBonus))` where stratBonus={breakout:4, momentum:4, pre_squeeze:3, pullback:3, else:2} and rrBonus = clamp((rr-1.5)*4, 0, 6).
   - Range [85, 95] preserves eligibility for high-minScore modes (turbo/dynamic=90 take R/R≥2.5 with breakout/momentum) without artificial exclusion.

9. **Equity curve discontinuity 126%→111% D-1→D** (`tools/gen-status-page.js`, 2026-05-05)
   - Symptom: TKL/Fortress equity charts had a step-down between historical points (snapshot equity.v[-1] from `simulatePortfolio` MtM) and today's last point (`computeStatsFromTrades.returnTotal`).
   - Fix: BOTH today and history points use `100 + stats.ret` (computeStatsFromTrades). When building modeEquityHistory from snapshot files, read `snap.modes[id].stats.ret` (NOT `equity.v[lastIdx]`). For Time Machine view, slice `modeCharts[modeId]` to the snapshot date instead of using `d.equity` from the fetched snapshot.

10. **Scanner regime mismatch signals.json vs data.json** (2026-05-05 — May 4 scan)
    - Symptom: data.json had `regime: "RECOVERY"` (regime_score 0.41, ensemble probs aligned) but signals.json had `regime: "RISK-ON"`. Downstream tools read signals.json so they thought it was RISK-ON.
    - Fix: at scanner generation time, ensure both files share the same regime label. data.json is source of truth; signals.json must mirror it.

11. **Time Machine rotation card persists on historical view** (`tools/gen-status-page.js` `tmUpdateLive`, 2026-05-05)
    - Symptom: clicking back to D-3 still showed today's "JUST EXECUTED LMT→GOOGL" rotation card.
    - Fix: in tmUpdateLive, hide `[data-section="orders"] .cta-card` containing "JUST EXECUTED" + hide `[data-section="watch"]` and `[data-section="closenow"]`. tmShowLive restores via `_tmLiveCache`.

12. **Mobile left-shift on fortress/tkl tab pick** (`tools/gen-status-page.js`, 2026-05-05)
    - Symptom: at 375px viewport, picking Fortress or TKL caused the entire page to shift horizontally left.
    - Pattern: `scrollIntoView({inline:'center'})` scrolled the window (not just the tab strip) when the tab was off-screen.
    - Fix: `html,body{overflow-x:hidden;max-width:100vw}` + `.mode-panel{min-width:0;max-width:100%;overflow-x:hidden}` + replace scrollIntoView with `tabs.scrollTo({left, behavior:'smooth'})` contained inside `.mode-tabs`.

13. **TKL pool backfill via MCP screener `as_of`** (2026-05-05)
    - When historical scanner produced empty `tkl_pool: []` (e.g. 5/01, 5/04), backfill via `mcp__claude_ai_marketdata__RunScreener` with `as_of=YYYY-MM-DDT22:00:00Z` and the TKL-Momentum DSL. Validate sharia + dedup vs main top10 before writing.

## Patterns to watch when editing

- **Don't grep rendered HTML for taxonomy or status checks.** Always read the structured JSON source (`signals.json`, `data.json`, `backtest-trades.json`).
- **Don't conflate "row count" with "logical entity count".** When a renderer pushes multiple TRs per record, count records explicitly.
- **Don't trust a single status flag** (`_premature`, `status==='expired'`, etc.) — combine with time-based gates (`_horizonExpired`, `exitDate < today`).
- **Don't accept `--stub` outputs as success** unless explicitly running offline.
- **Always test cross-platform shell** (`date`, `sed`, `grep -E`) — at minimum BSD on macOS + GNU on Linux runners.


## Gotchas ajoutés 2026-07-02 (session overhaul)
- **Whitelist de champs = tueur silencieux** : simulateTrade/projections whitelistent les
  champs ; tout nouveau champ consommé en aval (universe, mae_pct...) doit être ajouté aux
  DEUX whitelists (retour simulateTrade ~l.1067 + projection closedTrades ~l.1800) sinon
  filtre no-op destructeur (incident : 100% des trades des modes universe-filtered rejetés).
- **Jour férié NYSE** : la résolution de date DOIT passer par tools/lib/market-calendar.js
  (incident 20260703 : 4 juillet samedi → férié observé vendredi, scan sur séance inexistante).
- **pit-engine resume** : reconcileModes() réconcilie config↔état — un mode ajouté à
  modes-config après la création du pit-state n'était jamais seedé.
- **Renderer --strict obligatoire** (Phase 4) : bloque les data.json désaccentués/tronqués
  générés par la session LLM.
- **Carte Performance index.html** : regex bilingue (l'anglicisation de la carte avait
  no-opé le refresh pendant 3 semaines).
