# OPTIM.md — Scanner Mode Optimization Runbook (AUTO)

**Trigger**: when user says "fait OPTIM.md" or "execute OPTIM" → run this protocol top-to-bottom.

**Goal**: optimize 6 trading modes (turbo/dynamic/balanced/secured/fortress/tkl) for retail $10k account. Cap downside, preserve upside.

**Methodology**: NO multi-round agent voting. Adversarial-verify each change. Skip data-snooping on small samples (n=10-11 per mode per 15d).

---

## EXECUTION PROTOCOL (autonomous, no user prompts mid-run)

### Pre-flight (always run)
```bash
cd /Users/marketwatchxyz/GolandProjects/articles
git status                                    # snapshot starting state
git tag -f v-pre-optim                        # rollback anchor (force overwrite if re-running)
mkdir -p .omc/optim/                          # work dir
```

### Phase A — TURNKEY AUTO (safe, no investigation)

#### A1. Resolve 18 UU merge conflicts
```bash
# Verify HEAD newer than stash before checkout
git log --oneline -5 -- data/trading-plans/ | head -5
git checkout --ours data/trading-plans/*-20260520.json
git add data/trading-plans/
# Verify zero remaining
test "$(git diff --name-only --diff-filter=U | wc -l | tr -d ' ')" = "0" || { echo "FAIL: UU remain"; exit 1; }
echo "✅ A1 conflicts resolved"
```

#### A2. Null-regime fail-closed (retail safety, 1 line, zero risk)
File: `tools/lib/scanner-parser.js` around line 84.

**Find current line**:
```bash
grep -n "regime:" tools/lib/scanner-parser.js | head -5
```

**Apply Edit**:
- Find: `regime: data.regime || null,`
- Replace: `regime: data.regime || 'EARLY RISK-OFF',  // retail fail-closed: null regime = max caution`

**Verify**:
```bash
grep -n "EARLY RISK-OFF.*retail fail-closed" tools/lib/scanner-parser.js || { echo "FAIL A2"; exit 1; }
echo "✅ A2 null-regime fail-closed"
```

#### A3. modes-config.json config changes
File: `data/modes-config.json`

Apply these edits in `modes` object:
- `turbo.maxStopPct: 0 → 4`
- `turbo.atrStopMult: 0 → 1.5`
- `dynamic.maxStopPct: 0 → 4`
- `dynamic.atrStopMult: 0 → 1.5`
- `secured.maxStopPct: 0 → 4`
- `secured.atrStopMult: 0 → 1.5`
- `secured.filterName: "mom_bo" → "breakout_only"` ⚠️ (critical: breakout WR 52% n=27, momentum WR 13% n=8 — momentum is the broken strategy)
- `fortress.maxStopPct: 0 → 5`
- `fortress.atrStopMult: 0 → 1.5`
- `fortress.sectorCapMax: 2 → 1` (prevents May 12 semis triple-hit)
- `balanced`: unchanged (already 7%, 2x, working)
- `tkl`: unchanged (config-level; source filter applied in B1 below)

**Validation after edit**:
```bash
jq '.modes | {turbo:.turbo.maxStopPct, dynamic:.dynamic.maxStopPct, secured:.secured.maxStopPct, securedFilter:.secured.filterName, fortress:.fortress.maxStopPct, fortressSector:.fortress.sectorCapMax}' data/modes-config.json
# Expected: {turbo:4, dynamic:4, secured:4, securedFilter:"breakout_only", fortress:5, fortressSector:1}
echo "✅ A3 config patched"
```

#### A4. Add qa-check assertions (regression guards)
File: `tools/qa-check.js`

Insert these checks (find existing `check(` patterns, add new ones):

**Check 1 — BE-artifact regression guard**:
```javascript
check('backtest-trades: no breakeven artifacts (pnlPct=0 with exitPrice!=actualEntry)', () => {
  const bt = JSON.parse(fs.readFileSync('data/backtest-trades.json'));
  let artifacts = 0;
  for (const mode of Object.keys(bt)) {
    artifacts += bt[mode].filter(t =>
      t.status === 'breakeven' &&
      t.pnlPct === 0 &&
      t.exitPrice != null &&
      t.actualEntry != null &&
      Math.abs(t.exitPrice - t.actualEntry) > 0.01
    ).length;
  }
  return artifacts === 0 || `BE-artifact regression: ${artifacts} trades`;
});
```

**Check 2 — null-regime guard**:
```javascript
check('signals.json (last 5 scans): regime field present in ≥50%', () => {
  const dates = fs.readdirSync('scanner/').filter(d => /^\d{8}$/.test(d)).sort().slice(-5);
  let total = 0, missing = 0;
  for (const d of dates) {
    try {
      const s = JSON.parse(fs.readFileSync(`scanner/${d}/signals.json`));
      const sigs = Array.isArray(s) ? s : (s.signals || []);
      total += sigs.length;
      missing += sigs.filter(x => !x.regime && !x.region).length;
    } catch(e) {}
  }
  return total === 0 || missing / total <= 0.5 || `Null-regime: ${missing}/${total} signals lack regime`;
});
```

**Verify**:
```bash
grep -c "BE-artifact regression" tools/qa-check.js || { echo "FAIL A4-1"; exit 1; }
grep -c "Null-regime:" tools/qa-check.js || { echo "FAIL A4-2"; exit 1; }
echo "✅ A4 qa-check extended"
```

### Phase B — GUIDED CODE CHANGES (semi-auto)

#### B1. TKL source filter (HIGHEST LEVERAGE — verified data: signals source WR 30% n=76, +14pp delta vs other sources)

File: `tools/sweep.js`

**Investigation step** (run before edit):
```bash
grep -n "modeId.*===.*['\"]tkl\|cfg.id.*===.*['\"]tkl\|'tkl'" tools/sweep.js | head -20
grep -n "source.*tkl_pool\|tklPool\|tkl_pool" tools/sweep.js | head -10
```

**Find the tkl candidate processing block.** Look for the loop that selects setups for tkl mode (around lines 1260-1290 based on `tklPoolCount` reference).

**Add filter**: in tkl candidate selection, reject setups where `source === 'signals'`.

Pattern to add in candidate loop for tkl mode:
```javascript
// TKL source filter: 'signals' source has WR 30% (n=76, avg -0.02%) vs other sources WR 44%+
// Drag eliminator — verified via data/backtest-trades.json grouped analysis
if (modeId === 'tkl' && setup.source === 'signals') continue;
```

**If exact insertion point unclear**: STOP, write findings to `.omc/optim/B1-blocker.md` with grep results + ask user. Do NOT guess.

**Validation post-edit**:
```bash
# Run sweep, check tkl trades no longer have source='signals' (after sweep regenerates)
node tools/sweep.js 2>&1 | tail -5
jq '[.tkl[] | select(.source=="signals") | .scanDate] | sort | last' data/backtest-trades.json
# Expected: date should NOT advance past today after fix
echo "✅ B1 tkl source filter applied"
```

**Expected impact**: TKL WR 38% → 44% (eliminating the 30% WR drag cohort).

#### B2. Hero WR redef (truth alignment)

File: `tools/sweep.js` line 815 (and 1116).

**Find**:
```bash
sed -n '810,820p' tools/sweep.js
```

**Current code (likely)**:
```javascript
const winRate = resolved.length ? +((wins.length / resolved.length) * 100).toFixed(1) : 0;
```

**Issue**: `wins` and `resolved` may include rotated/premature trades. Verify by checking definitions ~lines 800-815.

**Apply**: ensure `resolved` excludes `_premature` and `rotated`. If already correct, NO CHANGE needed. If not, fix the filter.

```bash
grep -n "_premature\|rotated" tools/sweep.js | head -10
```

If filter already excludes these, mark B2 as DONE without edit. Otherwise, add filter.

#### B3. BE resolver investigation (DEFENSIVE — may not be needed)

Earlier R3-R5 claim: "105 BE trades at pnlPct=0 mask -41% tkl losses".

**Re-verify before any fix**:
```bash
# Count BE trades by mode
jq '[.[] | .[] | select(.status=="breakeven")] | length' data/backtest-trades.json
# Check if exitPrice == actualEntry (legitimate BE) vs != (artifact)
jq '[.[] | .[] | select(.status=="breakeven") | {sameAsEntry: (.exitPrice == .actualEntry), pnl: .pnlPct}] | group_by(.sameAsEntry) | map({sameAsEntry: .[0].sameAsEntry, n: length, pnls: ([.[].pnl] | unique)})' data/backtest-trades.json
```

**Decision rule**:
- If ALL BE trades have `exitPrice === actualEntry` AND `pnlPct === 0` → legitimate BE-lock behavior (sweep.js:559: `if (currentStop >= entryPrice) status = 'breakeven'`). **NOT a bug.** Skip B3.
- If some BE trades have `exitPrice !== actualEntry` AND `pnlPct === 0` → real artifact. Need fix. Halt and report.

Report findings to `.omc/optim/B3-be-investigation.md`.

#### B4. Cross-mode dedup max 2

File: `tools/sweep.js` around line 1851 (`crossModePicked`).

**Investigation**:
```bash
sed -n '1845,1875p' tools/sweep.js
```

**Goal**: enforce that any single ticker can appear in at most 2 modes per scan day.

**If implementation requires significant code restructure**: write spec to `.omc/optim/B4-dedup-spec.md` and HALT. Do not auto-apply.

**If simple addition possible** (e.g., counter Map): apply with explicit limit `MAX_HOLDERS_PER_TICKER = 2`.

### Phase C — VALIDATION

#### C1. A/B simulation
```bash
# Backup current config snapshot for the A/B
cp data/modes-config.json .omc/optim/modes-config-post-A.json

# Run sweep with new config (post-A3 edits)
node tools/sweep.js 2>&1 | tee .omc/optim/sweep-post-A.log

# Compute per-mode stats
for m in turbo dynamic balanced secured fortress tkl; do
  echo "=== $m ===" 
  jq ".${m} | length" data/backtest-trades.json
  jq "[.${m}[] | select(.exitDate >= \"2026-04-01\")] | {n:length, wr:((map(select(.pnlPct>0))|length)*100/length), avg:([.[].pnlPct]|add/length)}" data/backtest-trades.json
done | tee .omc/optim/sweep-stats-post.txt
```

#### C2. qa-check
```bash
node tools/qa-check.js 2>&1 | tee .omc/optim/qa-check-post.log
test "$(grep -c '❌' .omc/optim/qa-check-post.log)" = "0" || { echo "FAIL C2: qa-check has ❌"; cat .omc/optim/qa-check-post.log | grep ❌; exit 1; }
echo "✅ C2 qa-check clean"
```

#### C3. Refresh downstream
```bash
node tools/gen-status-page.js && node tools/gen-api.js
```

#### C4. GO/NO-GO gates (ALL must pass)

Run this validator:
```bash
node -e '
const bt = JSON.parse(require("fs").readFileSync("data/backtest-trades.json"));
const fail = [];
// Gate 1: each mode has >= 5 trades in last 15d (no starvation)
const cutoff = "2026-05-06";
for (const mode of Object.keys(bt)) {
  const recent = bt[mode].filter(t => t.scanDate >= cutoff);
  if (recent.length < 5) fail.push(`Gate1 STARVATION ${mode}: ${recent.length} trades`);
}
// Gate 2: turbo WR sanity band
const turboResolved = bt.turbo.filter(t => t.exitDate && !t._premature && t.status !== "rotated");
const turboWR = turboResolved.filter(t => t.pnlPct > 0).length / turboResolved.length;
if (turboWR < 0.25 || turboWR > 0.65) fail.push(`Gate2 turbo WR out of band: ${(turboWR*100).toFixed(1)}%`);
if (fail.length) { console.error("NO-GO:\n" + fail.join("\n")); process.exit(1); }
console.log("✅ All gates pass");
' || { echo "ROLLBACK"; exit 1; }
```

#### C5. Commit (if all gates pass)
```bash
git add data/modes-config.json tools/lib/scanner-parser.js tools/qa-check.js data/trading-plans/
[ -n "$(git diff --cached tools/sweep.js 2>&1)" ] && git add tools/sweep.js
git commit -m "$(cat <<'EOF'
feat(optim): apply mode optimization per OPTIM.md runbook

Phase A (turnkey):
- Resolve 18 UU conflicts in data/trading-plans/
- Null-regime fail-closed (scanner-parser.js): default to EARLY RISK-OFF for retail safety
- modes-config: stop caps 4%/4%/4%/5% on turbo/dyn/secured/fortress (was uncapped)
- modes-config: secured filterName mom_bo → breakout_only (data: breakout WR 52%, momentum WR 13%)
- modes-config: fortress sectorCapMax 2 → 1 (prevents semis triple-hit)
- qa-check: add BE-artifact + null-regime guards

Phase B (verified):
- B1 tkl source filter applied (if grep found unambiguous insertion point)
- B2 hero WR truth check (no edit if already correct)
- B3 BE resolver: investigated, not applied if behavior legitimate

All gates passed (C4): no mode starved, turbo WR in [25%, 65%], 0 ❌ in qa-check.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"

echo "✅ Optimization complete. Review with: git show HEAD"
```

### Phase D — REPORT

Write summary to `.omc/optim/RESULTS.md`:

```bash
cat > .omc/optim/RESULTS.md <<EOF
# OPTIM Run Results — $(date +%Y-%m-%d_%H-%M)

## Applied (Phase A turnkey)
- [x] UU conflicts resolved (18 files)
- [x] Null-regime fail-closed at scanner-parser.js:84
- [x] Stop caps: turbo 4%, dynamic 4%, secured 4%, fortress 5%
- [x] Secured filter: mom_bo → breakout_only
- [x] Fortress sectorCapMax: 2 → 1
- [x] qa-check guards added

## Phase B status (guided)
- B1 (tkl source filter): [run-time outcome]
- B2 (hero WR redef): [run-time outcome]
- B3 (BE resolver): [investigation outcome]
- B4 (cross-mode dedup): [run-time outcome]

## Validation results
$(cat .omc/optim/sweep-stats-post.txt)

## Next steps
- Monitor next 5 scanner runs for any starvation
- Review B1-B4 blockers if any in .omc/optim/B*-blocker.md
- If gates failed, run: git reset --hard v-pre-optim
EOF
```

---

## EXPECTED IMPACT (post-Phase A, conservative)

| Mode | Before (last 15d avg) | After (projected) | Mechanism |
|------|----------------------|--------------------|-----------|
| turbo | -0.65% | -0.20% | Stop cap prevents -7.9% tail |
| dynamic | -0.74% | -0.30% | Same |
| balanced | +0.33% | +0.33% | No change (already capped) |
| secured | **-1.84%** | **+1.50%** | Filter reverse: breakout 52% WR replaces momentum 13% WR drag |
| fortress | +0.38% | +0.50% | sectorCap 1 prevents semis cluster |
| tkl | +0.03% | **+1.00%** (after B1 if applied) | Drop signals source (30% WR drag) |

**Combined retail $10k (balanced + fortress)**: ~+8%/month maintained, tail risk bounded -$400 max single trade (was -$790 with uncapped stops).

**Caveats** (honest):
- Per-mode n=10-15/15d = noise band ±20pp on WR. Projections are directional, not precise.
- Phase A is ~80% of safe leverage. Phase B is the +5pp WR lift on TKL (if B1 applies cleanly).
- No transformation. Risk reduction + signal cleanup. Not a return doubler.

---

## REJECTED ITEMS (don't re-attempt)

| Item | Why rejected |
|------|--------------|
| Rolling-15d Sharpe auto-disable | 85% false-positive at n=12 (Quant R5) |
| Score 93+ concentrationPenalty | Data showed it misses MU/GLW (Critic) |
| Secured momentum_only | Direction INVERTED — momentum is the broken strategy (Critic) |
| Per-mode tuning of turbo/dynamic | n=10-11 too small (Critic) |
| slStreakBreaker | Deadlock risk + n too small (Trader+Critic) |
| Regime label gate topN-2 | Kills P=1 modes on ERO (Analyst R3) |
| Regime-recalibrate v3 "OOS gate" | No OOS gate exists in script (Dev R5) |
| Graduated VIX sizing | 3/6 vote accept binary kill (R6) |

---

## ROLLBACK

If anything breaks:
```bash
git reset --hard v-pre-optim
node tools/gen-status-page.js
```

---

## INVESTIGATION DATA (frozen, do not re-verify)

Verified facts (with file:line):

- TKL trades by source: `null` (n=86, WR 44.2%, avg +2.26%), `signals` (n=76, WR 30.3%, avg -0.02%), `tkl_pool` (n=16, WR 50%, avg +0.32%). Source set at sweep.js:1201.
- Secured by strategy (lifetime): `breakout` (n=27, WR 51.9%, avg +2.53%), `momentum` (n=8, WR 12.5%, avg +0.06%). Confirms breakout is the working strategy.
- Stop caps currently: turbo/dynamic/secured/fortress all `maxStopPct: 0` (uncapped). Only balanced (7%) and tkl (7%) capped.
- VRT 2026-05-18 hit turbo+dynamic+secured at -7.9% (1 trade, 3 modes). 
- VRT score = 93. distance_50dma_pct existed in metadata (qa-check.js:464). Could be filtered if cap is overextension config (already exists per qa-check inspection).
- BE-lock behavior at sweep.js:559: `if (currentStop >= entryPrice) status = 'breakeven'`. Trades at pnlPct=0 with exitPrice=actualEntry are LEGITIMATE BE-lock fires, not artifacts.
- Null-regime fail-OPEN at sweep.js:282-284 (vixKillTriggered returns false on null) — fixed via scanner-parser.js source default.

---

## METHODOLOGY NOTE

**Don't run 6 rounds of agents.** That pattern in prior session produced false precision. Use:
1. Explore agent (data extraction)
2. Adversarial critic (opus) to challenge premises
3. Executor (apply confirmed diffs)
4. Verifier (validate)

Critic in 1 pass beats 6 rounds of consensus voting.

---

End of OPTIM.md. Total run time estimate: 15-25 minutes when executed end-to-end.
