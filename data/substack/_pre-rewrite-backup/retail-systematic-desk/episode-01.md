---
title: "Freeze the Scope Before You Write Code"
subtitle: "A narrow mandate prevents a prototype from quietly becoming an uncontrolled trading desk."
series_id: "retail-systematic-desk"
module_id: "mandate"
module_title: "Start With a Mandate, Not a Model"
module_episode: 1
episode_number: 1
scheduled_at: "2026-09-04T12:00:00.000Z"
send_email: false
---

*Part 1 of 3 in Start With a Mandate, Not a Model. Lesson 1 of 45 in Build a Retail Systematic Desk, Safely.*

Write down the market, holding period, permitted instruments, decision time, account constraints and maximum operational complexity. A first system for liquid US stocks at one daily decision point is easier to observe than a machine spanning options, crypto, premarket and several brokers. Scope is a risk control because every extra surface creates another clock, identifier and failure mode.

**Input from last Friday:** A blank repository and a named human owner.

**Friday deliverable:** A signed mandate, owned by the desk operator and retained in the review bundle.

## Build this

Create a one-page mandate with explicit inclusions and exclusions. Give every future feature a default answer of no until it has data coverage, a test plan and an owner. The mandate should also name the human who can pause the system and the condition that forces a return to paper mode.

### Minimum record

- `market and session`
- `instrument types`
- `holding horizon`
- `allowed order families`
- `paper or live mode`
- `owner and kill path`

## Test it before moving on

Hand the mandate to another person and ask them to classify five hypothetical requests. They should agree on whether each request is in scope without asking what you meant. If they disagree, the specification is not operational yet.

**Operating limit:** The signed mandate is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the signed mandate (context, not implementation evidence):** [Investor.gov: Five Questions to Ask Before You Invest](https://www.investor.gov/introduction-investing/getting-started/five-questions-ask-you-invest); [FINRA: Concentration Risk](https://www.finra.org/investors/insights/concentration-risk)

Educational, not investment advice.

## Release decision

**GO:** Accept the signed mandate only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Do not build a scanner while the universe, decision clock or permitted products can still change during a run.

**Next Friday:** Carry the accepted signed mandate into Define Non-Goals and Kill Criteria.
