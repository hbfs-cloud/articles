---
name: eur-opportunities
description: Produce or review a DailyTickers EUR equity opportunities article with geographically broad discovery, an attributed Islamic equity screen, reproducible swing statistics and contextual dilution analysis. Use for $eur-opportunities, /eur-opportunities, or requests for the recurring EUR opportunities workflow.
---

# EUR opportunities

Follow [the runbook](../../../.claude/commands/eur-opportunities.md), `daily/CLAUDE.md` for article presentation, and `.claude/skills/source-policy.md` for provenance. Use `tools/eur-opportunities.py` for `collect`, `study` and `validate`; inspect each command's `--help` before choosing arguments. The EUR workflow has the user's standing authorization to obtain alternative public financial sources. Preserve their identity, timestamps, adjustments and hashes; this permission does not apply automatically to unrelated workflows.

Discover the current provider universe across EUR markets each run, then rank the eligible observations. Do not reuse a fixed list of companies, countries, dates, or a previous article's ranking. Distinguish a dated provider Islamic screen from an individually recalculated religious certification. Evaluate dilution by magnitude, purpose, settlement terms and observed market response; an equity authorization, employee plan or convertible label alone is not an exclusion.

Historical hit rates describe their measured sample, not calibrated future probabilities. Label the actual horizon, outcomes, costs, observations and uncertainty. Review the same hashed evidence through senior QA, contrarian and retail execution perspectives. Validation of calculations does not establish corporate, religious, editorial or publication approval. Publish only when the current invocation authorizes it and the relevant checks pass; notification requires its own explicit authorization. Creating this workflow does not schedule it or authorize broker actions.

Dividend handling is a publication prerequisite: follow the runbook's dividend section and run `tools/eur-dividend-gate.py` on every ranked candidate. Keep price return after modeled costs, dividend entitlement and paid personal net cash separate. Use one split-adjusted price basis for ranking and every technical level; never add a cash dividend to an adjusted-close return. Calendar unknown means research only; an in-window ex-date requires a new price plan. Do not call a dividend an automatic economic loss or assume that a EUR listing pays EUR dividends. The evidence replay and final `tools/eur-publication-check.py` must pass on the reviewed HTML and evidence hashes before publication.
