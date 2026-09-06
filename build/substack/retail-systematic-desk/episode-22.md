---
title: "Put Strategy Rules in Versioned Configuration"
subtitle: "Code should execute a declared contract, not hide tunable behavior."
series_id: "retail-systematic-desk"
module_id: "decision-contract"
module_title: "Make Strategy Decisions Machine-Readable"
module_episode: 1
episode_number: 22
scheduled_at: "2027-01-29T13:00:00.000Z"
send_email: false
---
*Part 1 of 3 in Make Strategy Decisions Machine-Readable. Lesson 22 of 45 in Build a Retail Systematic Desk, Safely.*

Rules buried inside code are invisible rules. You nudge a number on a Tuesday, and six weeks later nobody can say which number produced which decision. So move the rules out into a configuration file — a plain settings file the engine reads at startup — give it a version number and a start date, and that question answers itself.

The shape of the file is what this lesson shares. Whatever values you eventually put in it are yours and stay yours.

![Seal the evidence, not the story](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/evidence_chain.png)

**Input from last Friday:** the accepted expiring conditional plan.

**Friday deliverable:** one versioned configuration schema, owned by you, filed with the week's paperwork.

## Build this

A schema is the list of fields the file may contain, with the type each one must be. Cover which universe you trade, when the engine runs, which inputs it needs, who owns risk, and what it emits. Every edit raises the version and records the date it takes effect. New engine behaviour ships switched off; a feature flag — a plain on/off setting — turns it on for one configuration without disturbing the others.

### Minimum record

- `config_id`
- `version`
- `effective_from`
- `universe_ref`
- `schedule`
- `feature_flags`

## Test it before moving on

Point two versions at the same frozen snapshot, a copy of the inputs that nothing is allowed to change mid-test. In a toy pass, with counts invented for the drill, 26 decisions came back and each one carried the version that governed it: 18 under v3, 8 under v4 once its effective date had passed. Then hand the loader a broken file, `max_positons` misspelled and `schedule` missing entirely. It must refuse, name both problems, and stop. Silently filling in a default is the failure mode you are hunting.

**Operating limit:** classroom material, on paper. Nothing here describes a live book, a real allocation, or a setting anyone runs money on.

Background: [questions worth asking before you commit](https://www.investor.gov/introduction-investing/getting-started/five-questions-ask-you-invest) and [why opaque trading systems draw warnings](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/fraudadv_tradingsystem.html).

Educational, not investment advice.

## Release decision

**GO:** both versions replay cleanly, every decision is stamped with its governing version, and the malformed file is rejected.

**NO-GO:** never rewrite an old version so past decisions look like they followed today's rules. That is not tidying up. It destroys the only trail you have.

**Next Friday:** the accepted schema carries into Persist State, Validity and Revisions.
