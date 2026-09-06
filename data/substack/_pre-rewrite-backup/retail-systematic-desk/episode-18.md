---
title: "Explain Every Rejection"
subtitle: "A rejected candidate is useful feedback when the failed gate is explicit."
series_id: "retail-systematic-desk"
module_id: "scanner"
module_title: "Build a Scanner That Can Say No"
module_episode: 3
episode_number: 18
scheduled_at: "2027-01-01T13:00:00.000Z"
send_email: false
---

*Part 3 of 3 in Build a Scanner That Can Say No. Lesson 18 of 45 in Build a Retail Systematic Desk, Safely.*

Opaque scores teach users to chase the top row. A better scanner exposes the controlling gate: stale data, event veto, weak liquidity, unreachable target, missing filing review or portfolio conflict. The reason should come from structured observations, not generated prose.

**Input from last Friday:** The accepted no-setup run record.

**Friday deliverable:** A gate-by-gate rejection report, owned by the desk operator and retained in the review bundle.

## Build this

Store each gate as field, operator, threshold class, observed value, source and pass state. Public tutorials should use toy values and generic rule classes; production parameters remain private.

### Minimum record

- `field`
- `operator`
- `rule_class`
- `observed`
- `passed`
- `source`

## Test it before moving on

For a fixture candidate, alter one observation at a time and confirm only the matching gate changes. The displayed value must equal the value used by the gate.

**Operating limit:** The gate-by-gate rejection report is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the gate-by-gate rejection report (context, not implementation evidence):** [Investor.gov: Researching Investments](https://www.investor.gov/introduction-investing/getting-started/researching-investments); [Investor.gov: How to Read a 10-K](https://www.investor.gov/introduction-investing/getting-started/researching-investments/how-read-10-k)

Educational, not investment advice.

## Release decision

**GO:** Accept the gate-by-gate rejection report only when the test above passes and its retained output matches the minimum record.

**NO-GO:** If a user cannot tell whether a name failed on data, setup or risk, the scanner is not actionable.

**Next Friday:** Carry the accepted gate-by-gate rejection report into Certify a Candidate With Independent Evidence.
