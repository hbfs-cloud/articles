# Substack Series Workflow

This workflow adapts an existing DailyTickers educational series into an independent English Substack
series. It does not translate website HTML and never links back to the website.

## Contract

- One series has one versioned manifest and one immutable evidence set.
- Every episode is English, self-contained, 350-800 words and useful without reading another episode.
- The decision appears near the start. A worked example, an action and a limitation are explicit, but
  their order and presentation vary across episodes.
- Market numbers come from the certified evidence set. Official narrative claims use primary sources.
- A Substack series stays in an existing section during its pilot. Use tags for classification.
- Drafting, validation, scheduling and email delivery are separate side effects.

## Local Gate

```bash
node tools/validate-substack-series.js data/substack/series/<series-id>
node <domain-validator-from-manifest>
node tools/check-ai-tells.js data/substack/series/<series-id>/episode-*.md --strict
```

Then run Senior QA, Contrarian, Retail War Room and AI-Forensics reviews against the same source hashes.
Any unresolved blocker stops draft creation or scheduling.

Record each passing attestation in `harness.json`, then enforce closure:

```bash
node tools/validate-substack-series.js data/substack/series/<series-id> --require-reviews
```

After the reviews pass, build the ignored MCP payloads:

```bash
node tools/build-substack-series-drafts.js data/substack/series/<series-id>
```

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
7. Schedule only the authorized episodes. Email delivery requires explicit authorization.
8. After each publication, apply the series tags and update the prior episode with the exact Substack-only
   previous/next link when needed.
9. Compare results with the publication's own trailing baseline before scheduling the second half.
