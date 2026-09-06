---
title: "Discover Capabilities at Runtime"
subtitle: "A client should ask what a service can do instead of trusting last month's schema."
series_id: "retail-systematic-desk"
module_id: "data-health"
module_title: "Make Data Quality Executable"
module_episode: 1
episode_number: 7
scheduled_at: "2026-10-16T12:00:00.000Z"
send_email: false
---
*Part 1 of 3 in Make Data Quality Executable. Lesson 7 of 45 in Build a Retail Systematic Desk, Safely.*

::audience non_sub,free_sub
Each part stands on its own. This is 7 of 45 in Build a Retail Systematic Desk, Safely; earlier parts cover the groundwork but you can start here.
::end

Services change under you. A tool gets renamed, a field quietly disappears, an account loses the right to place one kind of order. If your program is carrying last month's list of what the service can do, it will happily call something that no longer exists, and it will find that out halfway through a run. Ask instead. Every morning, before anything else.

**Input from last Friday:** the accepted partial-failure fixture pack, meaning the file of saved fake responses you replay in tests.

![Seal the evidence, not the story](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/evidence_chain.png)

**Friday deliverable:** a capability bootstrap report, one page saying what the service claimed it could do at the start of today's run, filed with the run's paperwork.

## Build this

Add a bootstrap step: a first phase whose only job is to ask the service four questions. Which version are you? Are you healthy? What can you do? What shape are your fields? Keep the answer for this run and this run only. Then hold the list you need against the list you were given, and stop right there if something required is absent. No data collected, no order drafted.

For each capability write down: its name, the service version, a schema hash (a short fingerprint of the field layout, so a silent rename turns into a different number instead of a surprise), whether you need it, and the verdict.

A toy run, with numbers invented purely for illustration: the service advertises 34 capabilities, this desk needs 6, five fingerprints match yesterday's, and the sixth, attaching a protective stop to an entry in one instruction, is no longer offered on that account. The run halts with nothing sent.

## Test it before moving on

Point the program at a fake service with one required capability deleted. It has to stop during bootstrap and leave nothing behind: no cached rows, no half-built orders. Then add an optional capability nobody asked for, and check that yesterday's decisions come out identical until you switch it on deliberately.

**Operating limit:** paper only. The report is an engineering artefact holding no live parameter, no position size and no account number, and it tells you nothing about whether any of this earns money.

Background worth ten minutes: [the CFTC's advisory on claims made for automated trading systems](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/fraudadv_tradingsystem.html) and [Investor.gov on order types](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/types-orders), since venues and accounts differ on which ones they accept.

Educational, not investment advice.

## Release decision

**GO:** accept the report when the deletion test halts cleanly and the saved file carries all five fields for every capability.

**NO-GO:** a schema sitting on your laptop is not permission. If the service does not advertise it today, you do not call it today.

**Next Friday:** the accepted report becomes the input to Make Freshness a Blocking Field.
