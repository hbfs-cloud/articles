---
title: "Keep the Language Model Out of Arithmetic"
subtitle: "Use AI for interpretation and review, while code owns numbers and state."
series_id: "retail-systematic-desk"
module_id: "ai-lifecycle"
module_title: "Constrain AI and Promote Slowly"
module_episode: 1
episode_number: 43
scheduled_at: "2027-06-25T12:00:00.000Z"
send_email: false
---

*Part 1 of 3 in Constrain AI and Promote Slowly. Lesson 43 of 45 in Build a Retail Systematic Desk, Safely.*

A language model can summarize evidence, challenge a thesis and improve explanations. It should not transport datasets, calculate position size, choose hidden thresholds or mutate broker state from prose. Deterministic scripts own arithmetic, schemas, hashes and release gates.

**Input from last Friday:** The accepted action-owned alert policy.

**Friday deliverable:** An AI side-effect boundary map, owned by the desk operator and retained in the review bundle.

## Build this

Mark each pipeline step as deterministic, interpretive or side-effecting. Feed the model a frozen structured snapshot. Validate its output against the same schema and recompute every hard number outside the model.

### Minimum record

- `input_snapshot`
- `allowed_task`
- `structured_output`
- `numeric_recheck`
- `side_effect_boundary`

## Test it before moving on

Ask the model to change a quantity in narrative text. The renderer may display commentary, but the order payload must remain unchanged. Remove a required field and ensure the model cannot repair it.

**Operating limit:** The AI side-effect boundary map is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the AI side-effect boundary map (context, not implementation evidence):** [CFTC: Trading Systems Advisory](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/fraudadv_tradingsystem.html); [NIST: Bootstrap Plot](https://www.itl.nist.gov/div898/handbook/eda/section3/bootplot.htm)

Educational, not investment advice.

## Release decision

**GO:** Accept the AI side-effect boundary map only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Never allow persuasive prose to override a failed deterministic gate.

**Next Friday:** Carry the accepted AI side-effect boundary map into Use Adversarial Review as a Release Gate.
