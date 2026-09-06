---
title: "Make Every Run Auditable"
subtitle: "A quiet day and a crashed pipeline need different evidence."
series_id: "retail-systematic-desk"
module_id: "ledger-operations"
module_title: "Keep an Audit Trail That Survives Incidents"
module_episode: 3
episode_number: 36
scheduled_at: "2027-05-07T12:00:00.000Z"
send_email: false
---
*Part 3 of 3 in Keep an Audit Trail That Survives Incidents. Lesson 36 of 45 in Build a Retail Systematic Desk, Safely.*

::audience non_sub,free_sub
Each part stands on its own. This is 36 of 45 in Build a Retail Systematic Desk, Safely; earlier parts cover the groundwork but you can start here.
::end

Most scheduled runs decide nothing at all. That is normal. It is also why a quiet day and a dead pipeline have to look different in your records, because from the outside both produce the same thing: no orders.

So silence gets written down. Every run opens an envelope and every run closes it. Closed with `no_action` is a result you can trust. No envelope is an incident, and it should wake you as loudly as a stack trace would.

![A layer must fail loudly or not at all](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/layers_fail_safe.png)

EDGAR has that property at national scale: the absence of a filing on a date is itself information, because the archive is complete by construction ([Investor.gov: Using EDGAR](https://www.investor.gov/introduction-investing/getting-started/researching-investments/using-edgar-research-investments)). Your run log needs the same property in miniature.

Toy week, counts invented for illustration: 5 scheduled runs, 5 envelopes, 4 closed `no_action`, 1 closed `orders_placed`. Wednesday finished in 90 seconds and wrote 14 stage markers, not one of which described a decision.

**Input from last Friday:** the accepted restart drill report.

**Friday deliverable:** a terminal run envelope, owned by the desk operator and kept in the review bundle.

## Build this

One marker per stage: capabilities checked, data health, snapshot taken, decisions produced, gates applied, broker verified, actions attempted. Each timestamped, each linked to a structured output and its fingerprint. The final status closes the envelope and has a small fixed vocabulary: `no_action`, `orders_placed`, `aborted`, `failed`.

Free text logs are for a human reading afterwards. They are not accounting. If the only trace of a fill is a printed line, that fill is not recorded.

Half sessions and holidays deserve a marker too: a run that finds a closed market still opens and closes its envelope, having checked the calendar rather than assumed one ([NYSE: Hours and Calendars](https://www.nyse.com/trade/hours-calendars)).

### Minimum record

- `run_id`
- `started_at`
- `completed_at`
- `stage_markers`
- `final_status`
- `artifacts`

## Test it before moving on

Kill the process after each stage, one test per stage. Monitoring must name the last completed marker inside your alert window, and the envelope must stay open until recovery or a human closes it. In a toy pass of 7 kills: 7 envelopes left open, 0 false completions. A wrapper exiting with status zero while 3 of 7 markers are missing counts as failure.

**Operating limit:** a public engineering pattern exercised on paper, carrying no allocation, no account identifier, no tuned value from anything live, and no performance claim. Educational, not investment advice.

## Release decision

**GO:** accept the envelope when every kill leaves a diagnosable trail and the retained output carries all six fields.

**NO-GO:** never mark a run complete because the wrapper exited cleanly while required stages are absent.

**Next Friday:** carry the accepted envelope into Check Broker Capabilities Before Placement.
