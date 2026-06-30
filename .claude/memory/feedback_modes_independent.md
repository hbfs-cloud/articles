---
name: Portfolio modes are independent strategies — no cross-mode gating
description: Turbo/Dynamic/Balanced/Secured/Fortress are 5 alternative strategies, not pieces of one portfolio. A ticker in multiple modes is a confirmation signal, not duplication.
type: feedback
originSessionId: 51885ca4-8420-4dc9-a7af-8b1c6d2cb3eb
---
Turbo / Dynamic / Balanced / Secured / Fortress portfolio modes are **five independent alternative strategies**, not five slices of a single portfolio. A user replicating Dynamic is not replicating Balanced or Fortress in parallel.

Do NOT introduce cross-mode gating (e.g. "a ticker cannot appear in more than N modes"). If an audit flags a ticker being present in all five modes as a "concentration risk", that is a misread: it actually means the setup is strong enough to qualify under all five filter profiles, which is a confirmation signal.

**Why:** Introduced a `CROSS_MODE_MAX_PRESENCE = 2` cap in `tools/gen-status-page.js` on 2026-04-11 based on an audit agent flag. User corrected it the same day: "on s'en fou qu'il y ait la même action sur des modes différents non ?" — the cap was removed the same session. Modes must stay independent.

**How to apply:** When working on `gen-status-page.js`, `gen-api.js`, or any allocation logic, treat each mode in isolation. No cross-mode bookkeeping, no global ticker presence counter, no filter that references another mode's state. The only per-mode constraints that matter are `portfolioSize`, `topN`, `minScore`, `filterName`, `horizon`, `rotation`, `maxStopPct` — all defined in `data/modes-config.json`.
