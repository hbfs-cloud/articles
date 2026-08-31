---
title: "Promote From Replay to Live in Stages"
subtitle: "The capstone is a controlled operating process, not an autonomous bot."
series_id: "retail-systematic-desk"
module_id: "ai-lifecycle"
module_title: "Constrain AI and Promote Slowly"
module_episode: 3
episode_number: 45
scheduled_at: "2027-07-09T12:00:00.000Z"
send_email: false
---

*Part 3 of 3 in Constrain AI and Promote Slowly. Lesson 45 of 45 in Build a Retail Systematic Desk, Safely.*

Promotion should move through offline replay, read-only monitoring, paper trading, shadow execution and a tightly bounded live pilot. Each stage has objective evidence, an observation window, rollback and a human owner. Production also requires operational security; passing market tests is not enough.

**Input from last Friday:** The accepted four-role review attestation.

**Friday deliverable:** A staged promotion dossier, owned by the desk operator and retained in the review bundle.

## Build this

Assemble the capstone and add least-privilege credentials, secret storage and rotation, paper/live isolation, controlled egress, redacted audit logs, clock monitoring, tested backup restoration and an independent manual revoke path. Define promotion evidence before collecting results.

### Minimum record

- `stage`
- `entry_criteria`
- `evidence_window`
- `security_gates`
- `rollback`
- `manual_revoke`
- `owner`
- `promotion_verdict`

## Test it before moving on

Run incident drills for stale data, duplicate intent, missing protection and restart recovery. The system is not ready for the next stage until every required drill closes with auditable evidence.

**Operating limit:** The staged promotion dossier is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the staged promotion dossier (context, not implementation evidence):** [CFTC: Trading Systems Advisory](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/fraudadv_tradingsystem.html); [NIST: Bootstrap Plot](https://www.itl.nist.gov/div898/handbook/eda/section3/bootplot.htm)

Educational, not investment advice.

## Release decision

**GO:** Accept the staged promotion dossier only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Never let the system promote itself or increase real-money scope without explicit human approval.

**Next Friday:** Keep the completed dossier in paper mode; any live promotion remains a separate human decision.
