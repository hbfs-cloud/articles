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

::audience non_sub,free_sub
Each part stands on its own. This is 18 of 45 in Build a Retail Systematic Desk, Safely; earlier parts cover the groundwork but you can start here.
::end

A score with no reason teaches exactly one behavior: click the top row. <mark>Publish the gate that killed the name instead, and readers learn your rules by reading your refusals.</mark>

Two toy rejections, invented for teaching and not observations of any listed company. SYM_A fails on liquidity: average spread 0.8% against a ceiling of 0.3%, the spread being the gap between what buyers offer and sellers ask, which you pay on the way in and again on the way out. SYM_K fails on the event gate: earnings due in 3 days against a 5-day exclusion. Two names, two sentences, no mysterious number out of 100.

![Seal the evidence, not the story](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/evidence_chain.png)

**Friday deliverable:** a gate-by-gate rejection report, built from what was measured rather than from prose a model wrote afterwards.

## Build this

Every gate is a row of structured facts: field, operator, rule class, observed value, pass state, source. Publish the class, not your number. "Liquidity ceiling" is a fair thing to show a reader; the exact threshold you tuned stays private.

### Minimum record

- `field`
- `operator`
- `rule_class`
- `observed`
- `passed`
- `source`

A candidate often fails several gates at once. Pick one controlling gate by fixed priority, data freshness first, then risk, then setup quality, and show the rest underneath. In the toy run, 4 of the 11 candidates failed on more than one gate.

## Test it before moving on

Take one fixture candidate and change a single observation. Move that spread from 0.8% to 0.2% and only the liquidity row may flip. If the event row moves too, your gates are sharing state they should not share. Then compare the printed value against the value the gate compared. A report showing 0.8% while the code tested 0.75% is a small lie that will teach a reader the wrong rule.

**Operating limit:** fixtures on paper, invented thresholds, no account and no performance claim. The deliverable here is an audit trail.

Background reading: [FINRA on best execution](https://www.finra.org/rules-guidance/key-topics/best-execution) for why spread and venue quality deserve a gate at all, and [NIST on measurement processes](https://www.itl.nist.gov/div898/handbook/mpc/section1/mpc11.htm) for the discipline of making the displayed number and the measured number agree.

Educational, not investment advice.

## Release decision

**GO:** one changed observation flips one row, and every displayed value matches the value tested.

**NO-GO:** if a reader cannot tell whether a name died on data, on setup or on risk, the report is decoration.

**Next Friday:** the rejection report carries into Certify a Candidate With Independent Evidence.

> A refusal a reader can check is worth more than a score they can only obey.
