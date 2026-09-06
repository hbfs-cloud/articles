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

::audience non_sub,free_sub
Each part stands on its own. This is 15 of 45 in Build a Retail Systematic Desk, Safely; earlier parts cover the groundwork but you can start here.
::end

Something looks wrong in yesterday's run, so you run it again. The data has moved since. Now you are debugging two things at once and can prove neither. A replay has to be offline: it reads the frozen bundle, touches no network, changes nothing outside itself, and gives the same answer at three in the morning as at noon.

Sameness is conditional. Identical bytes only mean something when the language runtime, the libraries, the way numbers are written to disk, and any randomness are all pinned. If one of those differs, the runner should say which, not shrug.

![Seal the evidence, not the story](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/evidence_chain.png)

**Input from last Friday:** The accepted evidence digest.

**Friday deliverable:** An offline replay bundle a stranger can run on a clean machine.

## Build this

Pack the normalized inputs, the configuration version, the code version, the dependency lock file, notes on the runtime, a fixed seed or a recording of the random draws, the rules for writing output, and the outputs you expect. Keep passwords and keys out of it. Add a runner that refuses to reach the network and refuses to touch a broker account, so a replay can never turn into an accidental trade.

### Minimum record

- `run_id`
- `input_manifest`
- `config_version`
- `runtime_lock`
- `randomness_record`
- `expected_output_hash`

## Test it before moving on

Run the bundle twice on a clean machine and compare the structured output before anything is drawn on screen. Toy figures, invented for the drill: 2,403 rows in, eleven decisions out, same output fingerprint both times, twelve seconds each pass. Then change only the display — swap a table for a chart — and confirm the decision fingerprint holds while the picture changes. That separation is the whole point: presentation is allowed to move, evidence is not.

**Operating limit:** Paper exercise, published for teaching. No production settings, no allocations, no account data, no performance promised.

Further reading: [CFTC: Trading Systems Advisory](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/fraudadv_tradingsystem.html); [NIST: Model Validation](https://www.itl.nist.gov/div898/handbook/pmd/section1/pmd141.htm)

Educational, not investment advice.

## Release decision

**GO:** Two clean-machine runs agree, the renderer swap leaves the decision fingerprint alone, and the bundle carries the minimum record.

**NO-GO:** A rerun that silently downloads fresh data is a new experiment wearing the word replay.

**Next Friday:** Carry the accepted bundle into Screen Broad, Then Narrow With Evidence.
