---
title: "Use Adversarial Review as a Release Gate"
subtitle: "Different reviewers should attack correctness, risk and usability on the same snapshot."
series_id: "retail-systematic-desk"
module_id: "ai-lifecycle"
module_title: "Constrain AI and Promote Slowly"
module_episode: 2
episode_number: 44
scheduled_at: "2027-07-02T12:00:00.000Z"
send_email: false
---
*Part 2 of 3 in Constrain AI and Promote Slowly. Lesson 44 of 45 in Build a Retail Systematic Desk, Safely.*

::audience non_sub,free_sub
Each part stands on its own. This is 44 of 45 in Build a Retail Systematic Desk, Safely; earlier parts cover the groundwork but you can start here.
::end

One reviewer reading your work will mostly agree with it. Not from laziness — from sharing your assumptions. The gaps you cannot see are the gaps a second pair of eyes was hired to find, and a reviewer who thinks like you has the same blind spots in the same places.

So split the job by role, and let each role attack a different thing. Are the numbers real and traceable? Does the code do what the note says? What if the opposite is true? Can this be executed safely? Would an ordinary reader act on it and get hurt? Four verdicts, five, whatever the desk needs. The harshest one wins. Averaging verdicts defeats the entire point of collecting them.

![Without the record, the loop is just repetition](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/journal_loop.png)

**Input from last Friday:** the accepted side-effect boundary map.

**Friday deliverable:** a review attestation — a signed record of who checked what, on which exact version, and what they concluded.

## Build this

Everyone reviews the same hashed artifact. A hash is a short fingerprint of the file: change one character and the fingerprint changes, so nobody can approve version A while version B ships. Give each role a blocking checklist, not an open invitation to comment. Findings carry a pointer to the evidence and a severity. Fix, rebuild the snapshot, review again — because an approval belongs to a fingerprint, not to a project.

Toy gate, invented figures: 4 roles, 23 checks, 19 clean. Three findings ranked low. One ranked blocking, on SYM_D, where a stop level in the note did not match the one in the payload. That single finding held the release even though the other three roles had signed off.

### Minimum record

- `review_role`
- `snapshot_hash`
- `finding` — with a pointer to the line or row it came from
- `severity`
- `verdict`
- `attested_at`

## Test it before moving on

Edit one reviewed file after approval and run the gate. It has to fail on the fingerprint alone, before anybody reads anything.

Then the harder test. Build a set where every item passes on its own but the combination is wrong: two positions leaning the same way, sized as if they were independent. If no role is looking at the whole, nothing catches it. Someone must be reviewing the book, not the rows.

**Operating limit:** these attestations describe a paper exercise. No deployed setting, no allocation, no account.

## Release decision

**GO:** accept when the tampered file is refused and every field above survives in the retained record.

**NO-GO:** a style pass is not a correctness pass. Clean writing and a phrase linter prove nothing about the arithmetic underneath ([FINRA: Books and Records](https://www.finra.org/rules-guidance/key-topics/books-records); [Investor.gov: How to Avoid Fraud](https://www.investor.gov/protect-your-investments/fraud/how-avoid-fraud)). Educational, not investment advice.

**Next Friday:** the accepted attestation goes into Promote From Replay to Live in Stages.
