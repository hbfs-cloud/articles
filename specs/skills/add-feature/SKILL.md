---
name: add-feature
description: Add a new feature to the platform — from requirements through PR with tests and CLAUDE.md updates
version: 1.0.0
---

# Add Feature

## When to Use

- Implementing a new PRD or sub-feature from an existing PRD
- Adding a new MCP tool endpoint
- Adding a new scanner to the Go bridge
- Adding a new UI component or page
- User asks to build, add, or implement something new

## Prerequisites

- PRD document exists for the feature (or requirements are clearly stated)
- Feature branch strategy agreed upon
- Tests can be run locally (`go test ./...` or `npm test`)
- QA script available (`tools/qa-check.js` or equivalent)

## Steps

### Step 1: Clarify Requirements (Think Before Coding)

Before writing any code, answer these questions:
- What is the exact input/output contract?
- Which existing modules are affected?
- Which PRDs reference this feature?
- Are there data schema changes required?
- Is there a migration needed?

If any answer is unclear, ask the user before proceeding. A 2-minute clarification prevents a 2-hour rewrite.

### Step 2: Identify Affected Modules

Use the code graph or grep to locate:
- Go packages that need changes (`internal/`, `cmd/`)
- React components or pages (`frontend/src/`)
- MCP tool definitions (`mcp/`)
- Config files (`strategy-slots.json`, `scanner-defaults.json`, `modes-config.json`)
- Data schemas or mart definitions (PRD-24 analytics)

Document the blast radius before touching anything.

### Step 3: Create Feature Branch

```bash
git checkout -b feat/<short-description>
```

Naming convention: `feat/`, `fix/`, `chore/`, `refactor/` prefix.

### Step 4: Implement with Tests (Goal-Driven Execution)

Write the test first (or alongside), not after. For Go:

```bash
# Run tests as you go
go test ./internal/<package>/... -run TestYourFeature -v
```

For frontend:
```bash
npm test -- --testPathPattern=YourComponent
```

Implementation rules:
- No speculative code (Simplicity First) — only what the feature requires
- No backwards-compatibility shims for code that can simply be changed
- No feature flags unless the user explicitly requested them
- Match the style of surrounding code

### Step 5: Update CLAUDE.md Files

Every feature that changes a workflow, adds a tool, or introduces a new pattern must update the relevant CLAUDE.md:
- Root `CLAUDE.md` if it affects the top-level workflow
- Package-level `CLAUDE.md` if it affects a specific module
- Add the new MCP tool to the tool reference table if applicable

### Step 6: Create or Update Skill

If the feature introduces a new repeatable workflow (e.g., a new pipeline step, a new type of analysis), create a new skill in `specs/skills/<skill-name>/SKILL.md` or update an existing one.

### Step 7: Run QA Validation

```bash
node tools/qa-check.js
```

Target: 0 failures (❌). Warnings (⚠️) must be investigated — do not dismiss without understanding. Fix all failures before proceeding.

Also run:
```bash
go build ./...          # No compile errors
go test ./...           # All tests pass
go vet ./...            # No vet issues
```

### Step 8: Create PR with Checklist

PR description must include:

```markdown
## What
One paragraph describing what was built.

## Why
Which PRD or user request drives this.

## Checklist
- [ ] CLAUDE.md updated (root and/or package level)
- [ ] Skill created or updated in specs/skills/
- [ ] Tests written and passing
- [ ] QA check: 0 failures
- [ ] No speculative code added (Simplicity First)
- [ ] No feature flags added without explicit request
- [ ] Schema migrations included if needed
- [ ] Breaking changes documented
```

## MCP Tools Used

| Tool | Purpose |
|------|---------|
| QueryAnalytics | Validate data layer changes against marts |
| GetMarketOverview | Verify market data tools still return expected shape |
| RunScreener | Smoke-test scanner changes end-to-end |

## Output

- Feature implementation in the appropriate package
- Tests (unit + integration where applicable)
- Updated CLAUDE.md file(s)
- New or updated skill in `specs/skills/`
- PR with checklist — ready for review

## Error Handling

- **QA check failures**: Fix all ❌ before creating PR. Never skip with `--no-verify`.
- **Test failures in unrelated packages**: Investigate — your change may have an unintended side effect. Fix or document if pre-existing.
- **CLAUDE.md conflict**: If another branch also updated CLAUDE.md, merge carefully — preserve both sets of changes.
- **Scope creep detected**: Stop and consult user if implementation requires touching more modules than initially identified. Don't silently expand scope.

## Examples

### Example 1: Add New MCP Tool

```
Feature: Add GetSignalHistory MCP tool (PRD-20)
→ Step 1: Input = {slot_id, days}, Output = []Signal with timestamps
→ Step 2: Affects mcp/handlers.go, internal/analytics/query.go
→ Step 3: git checkout -b feat/get-signal-history
→ Step 4: Implement handler + query, write TestGetSignalHistory
→ Step 5: Update CLAUDE.md tool table in PRD-20 section
→ Step 6: Update run-backtest/SKILL.md to reference new tool
→ Step 7: qa-check 0 failures, go test passes
→ Step 8: PR with checklist
```

### Example 2: Add React Dashboard Widget

```
Feature: Regime probability gauge on portfolio dashboard
→ Step 1: Uses GetRegimeProbability MCP, displays 5-state gauge
→ Step 2: Affects frontend/src/components/RegimeGauge.tsx + Dashboard.tsx
→ Step 3: git checkout -b feat/regime-gauge
→ Step 4: Component + test, mock MCP response in test
→ Step 5: No CLAUDE.md change needed (UI only)
→ Step 6: No new skill needed
→ Step 7: npm test passes, qa-check 0 failures
→ Step 8: PR
```
