---
title: "Use a Complete Machine-Readable Plan"
subtitle: "Execution should receive quantities, protections and gates, not an investment story."
series_id: "retail-systematic-desk"
module_id: "decision-contract"
module_title: "Make Strategy Decisions Machine-Readable"
module_episode: 3
episode_number: 24
scheduled_at: "2027-02-12T13:00:00.000Z"
send_email: false
---

*Part 3 of 3 in Make Strategy Decisions Machine-Readable. Lesson 24 of 45 in Build a Retail Systematic Desk, Safely.*

A complete plan carries candidate identity, side, quantity, broker intent, order type, protection, execution window, promotion policy and reason. At this stage quantities are synthetic fixtures only; portfolio sizing must pass later before paper deployment. Human-readable context explains the choice but never supplies missing operational fields.

**Input from last Friday:** The accepted supersession state record.

**Friday deliverable:** A validated paper-plan fixture, owned by the desk operator and retained in the review bundle.

## Build this

Validate the entire plan before arming any group. Enforce unique identifiers, ordered ranks, one-winner constraints and protection for every new position. Reject the full plan when a required quantity or level is missing.

### Minimum record

- `group_id`
- `candidate_id`
- `rank`
- `order`
- `protection`
- `execution`
- `reason`

## Test it before moving on

Create malformed fixtures for duplicate ranks, absent stops and expired validity. Each should fail before any broker call. A valid single-candidate group should pass without requiring an alternate.

**Operating limit:** The validated paper-plan fixture is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the validated paper-plan fixture (context, not implementation evidence):** [Investor.gov: Types of Orders](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/types-orders); [FINRA: Extended-Hours Trading](https://www.finra.org/investors/insights/extended-hours-trading)

Educational, not investment advice.

## Release decision

**GO:** Accept the validated paper-plan fixture only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Never complete a partially specified plan in the broker or user-interface layer.

**Next Friday:** Carry the accepted validated paper-plan fixture into Backtest on Frozen Point-in-Time Data.
