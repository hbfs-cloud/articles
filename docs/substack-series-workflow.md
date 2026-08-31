# Substack Series Workflow

This workflow adapts an existing DailyTickers educational series into an independent English Substack
series. It does not translate website HTML and never links back to the website.

## Contract

- One series has one versioned manifest and one immutable evidence set.
- Every episode is English, self-contained, within the word range declared by its manifest, and useful
  without reading another episode. The current evergreen program uses 400-650 words.
- The decision appears near the start. A worked example, an action and a limitation are explicit, but
  their order and presentation vary across episodes.
- Market numbers come from the certified evidence set. Official narrative claims use primary sources.
- A Substack series stays in an existing section during its pilot. Use tags for classification.
- Drafting, validation, scheduling and email delivery are separate side effects. Email is disabled by
  default and requires a separate, explicit authorization.

## Local Gate

```bash
node tools/validate-substack-series.js data/substack/series/<series-id>
node <domain-validator-from-manifest>
node tools/check-ai-tells.js data/substack/series/<series-id>/episode-*.md --strict
```

Then run Senior QA, Contrarian, Retail War Room and AI-Forensics reviews against the same source hashes.
Any unresolved blocker stops draft creation or scheduling.

Remote readback is a post-review release gate, not a prerequisite for a content-review PASS. Before remote
operations, the harness must say `phase: pre_schedule` and must not describe planned timestamps as verified.
The workflow is complete only after every remote draft has been updated for the reviewed snapshot, validated,
scheduled, and read back with the exact time, public audience and `email_audience: null`.

Record each passing attestation in `harness.json`, then enforce closure:

```bash
node tools/validate-substack-series.js data/substack/series/<series-id> --require-reviews
```

After the reviews pass, build the ignored MCP payloads:

```bash
node tools/build-substack-series-drafts.js data/substack/series/<series-id>
```

For the 84-episode evergreen program, rebuild and reconcile the canonical 307-chapter inventory before
freezing the review snapshot:

```bash
node tools/build-substack-evergreen-calendar.js
node tools/build-substack-evergreen-inventory.js
node tools/build-substack-evergreen-modules.js
node tools/validate-substack-evergreen-program.js
node tools/build-substack-evergreen-harness.js
```

`inventory.json` must contain one disposition row for every catalog chapter. A calendar slot is not a
remote receipt. It becomes `verified_scheduled` only after a Substack readback records the draft ID,
exact timestamp, public audience and `email_audience: null`.

## Remote Sequence

1. Check the Substack session with `whoami` and list current sections.
2. Create all episodes as drafts with `create_draft` in the existing section. Use `draft_json` only when
   the MCP server can read the caller's filesystem; otherwise read the generated JSON locally and pass
   `title`, `subtitle` and `body_markdown` inline.
3. Reapply section, audience, SEO description/title and social title with `update_draft`, then assert the
   returned draft metadata. Do not assume `create_draft` persisted optional metadata.
4. Run `validate_draft` for every remote draft.
5. Inspect the rendered mobile and desktop draft before scheduling when the connector exposes a preview
   surface. If it does not, record that limitation and proceed only for prose-only drafts with no images,
   charts, tables or audience blocks after structural validation. Complex layouts fail closed without a
   rendered preview.
6. Read `get_post_schedule` before scheduling. Replace an existing schedule only when the current value
   was inspected and replacement is intended; then read it again and compare time and audiences exactly.
7. Schedule only the authorized episodes. Omit `email_audience` unless email delivery was separately and
   explicitly authorized, then verify the stored schedule has `email_audience: null` when email is off.
8. After each publication, apply the series tags and update the prior episode with the exact Substack-only
   previous/next link when needed.
9. For a normal pilot, compare results with the publication's own trailing baseline before scheduling the
   second half. An explicitly authorized full evergreen program may schedule the complete reviewed curriculum;
   record that authorization in each manifest and keep email disabled throughout.
