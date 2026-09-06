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

::audience non_sub,free_sub
Each part stands on its own. This is 43 of 45 in Build a Retail Systematic Desk, Safely; earlier parts cover the groundwork but you can start here.
::end

A language model reads a pile of evidence well. It argues against your thesis well. It is a poor calculator and a worse database, and the trouble is that it never announces which of the three you just asked it to be. It answers in the same confident voice either way.

So sort your steps into three kinds before the model goes anywhere near them. Deterministic: code does the sum and returns the same answer every time. Interpretive: something is being described or challenged, and two sensible answers can both be fine. Side-effecting: the world outside the program changes — a file is written, an order leaves the desk. The model works on the interpretive pile. Only that one.

![A layer must fail loudly or not at all](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/layers_fail_safe.png)

**Input from last Friday:** the accepted action-owned alert policy.

**Friday deliverable:** a side-effect boundary map — one page saying, for every step, what the model may read, what it may say, and what it may never touch.

## Build this

Hand the model a snapshot: a frozen copy of the evening's data, so the model and the checker are looking at the same rows. Require its answer in a schema, meaning a fixed list of fields it must fill and may not extend. Then recompute every hard number outside it and compare.

Toy run, invented figures for illustration: 60 steps in one evening pass. 41 deterministic, 15 interpretive, 4 side-effecting. On a pass broken on purpose, the model's commentary on SYM_A said 180 shares while the computed payload said 120. The payload held, the sentence was flagged, the run stopped for a human. That is the shape of a working boundary.

### Minimum record

- `input_snapshot`
- `allowed_task`
- `structured_output`
- `numeric_recheck` — the number code produced, beside the number prose claimed
- `side_effect_boundary`

## Test it before moving on

Ask the model, in plain words, to change a quantity. The page may print whatever it wrote. The payload must not move by one share. Then strip a required field out of the snapshot and check that the model cannot quietly fill the hole with something plausible.

**Operating limit:** paper only, no live credential, no real account behind any figure above.

## Release decision

**GO:** accept the map when the quantity test leaves the payload untouched and all five fields survive in the retained output.

**NO-GO:** never let good prose overturn a failed check. Confidence is not evidence — a lesson older than this technology ([CFTC: Learn and Protect](https://www.cftc.gov/LearnAndProtect/EducationCenter/index.htm)), and measurement quality still comes from bias and variability you can quantify ([NIST: Issues for Characterization](https://www.itl.nist.gov/div898/handbook/mpc/section1/mpc11.htm)). Educational, not investment advice.

**Next Friday:** the accepted map goes into Use Adversarial Review as a Release Gate.
