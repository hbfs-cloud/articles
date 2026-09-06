---
title: "Replay Without Re-Querying"
subtitle: "A reproducible run consumes a frozen bundle instead of asking the market again."
series_id: "retail-systematic-desk"
module_id: "snapshots"
module_title: "Build Reproducible Market Snapshots"
module_episode: 3
episode_number: 15
scheduled_at: "2026-12-11T13:00:00.000Z"
send_email: false
---

*Part 3 of 3 in Build Reproducible Market Snapshots. Lesson 15 of 45 in Build a Retail Systematic Desk, Safely.*

Re-querying after a bug or disagreement changes both data and diagnosis. A replay should be offline, deterministic and side-effect free. Byte equality is meaningful only when runtime, dependencies, serialization and randomness are controlled; otherwise the runner must explain the version difference.

**Input from last Friday:** The accepted independently checkpointed evidence digest.

**Friday deliverable:** An offline replay bundle, owned by the desk operator and retained in the review bundle.

## Build this

Package normalized inputs, configuration version, code version, dependency lock, runtime metadata, fixed seed or recorded randomness, canonical serialization rules and expected outputs. Keep authentication and secrets outside the bundle. Add a runner that refuses network access and broker mutation.

### Minimum record

- `run_id`
- `input_manifest`
- `config_version`
- `runtime_lock`
- `randomness_record`
- `expected_output_hash`

## Test it before moving on

Run the same bundle twice on a clean machine. Compare structured outputs before rendering. Then change only the renderer and prove the decision hash remains stable while presentation changes.

**Operating limit:** The offline replay bundle is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the offline replay bundle (context, not implementation evidence):** [CFTC: Trading Systems Advisory](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/fraudadv_tradingsystem.html); [NIST: Bootstrap Plot](https://www.itl.nist.gov/div898/handbook/eda/section3/bootplot.htm)

Educational, not investment advice.

## Release decision

**GO:** Accept the offline replay bundle only when the test above passes and its retained output matches the minimum record.

**NO-GO:** A rerun that silently downloads fresh data is a new experiment, not a replay.

**Next Friday:** Carry the accepted offline replay bundle into Screen Broad, Then Narrow With Evidence.
