---
name: dailytickers-commands
description: Run DailyTickers workflows migrated from Claude slash commands, including /scanner, /daily, /weekly, /analyse, /retro, /desk, /signals-desk, /aplus, /series, and related market playbooks.
metadata:
  short-description: DailyTickers Claude-command compatibility
---

# DailyTickers Commands

This project was originally operated with Claude slash commands stored in `.claude/commands/`.
Codex does not auto-load those files as native slash commands. When the user invokes one of the
commands below, treat the matching `.claude/commands/<name>.md` file as the runbook.

## Routing

Map the user request to the command file:

- `/analyse` -> `.claude/commands/analyse.md`
- `/aplus` -> `.claude/commands/aplus.md`
- `/daily` -> `.claude/commands/daily.md`
- `/desk` -> `.claude/commands/desk.md`
- `/earnings-reaction` -> `.claude/commands/earnings-reaction.md`
- `/macro-event-playbook` -> `.claude/commands/macro-event-playbook.md`
- `/make-video` -> `.claude/commands/make-video.md`
- `/retro` -> `.claude/commands/retro.md`
- `/run-session` -> `.claude/commands/run-session.md`
- `/scanner` -> `.claude/commands/scanner.md`
- `/sector-funnel` -> `.claude/commands/sector-funnel.md`
- `/sector-rotation` -> `.claude/commands/sector-rotation.md`
- `/series` -> `.claude/commands/series.md`
- `/signals-desk` -> `.claude/commands/signals-desk.md`
- `/signals-desk-fire-and-forget` -> `.claude/commands/signals-desk-fire-and-forget.md`
- `/squeeze-radar` -> `.claude/commands/squeeze-radar.md`
- `/swing-signals` -> `.claude/commands/swing-signals.md`
- `/weekly` -> `.claude/commands/weekly.md`

## Execution Rules

1. Read `CLAUDE.md`, `CODEX.md`, and the matching command file before taking workflow actions.
2. Read any `.claude/skills/*.md`, `.claude/workflows/*`, or `.claude/memory/*.md` files named by the command.
3. Translate Claude-specific mechanics conservatively:
   - `Skill(skill="x")` means read `.claude/skills/x.md` or `.claude/skills/x/SKILL.md`.
   - `Workflow({ name: "x" })` means inspect the matching `.claude/workflows/` file or local script before running.
   - `mcp__claude_ai_*` calls mean use the equivalent Codex MCP/server tool when available. If no equivalent exists, stop rather than fabricate data.
4. Preserve every blocking gate in the command runbook. Do not skip validation, freshness, panel, publication, or notification gates unless the runbook allows it and the user explicitly approves that skip in the current session.
5. Keep side-effect boundaries from `CLAUDE.md`: no public posting, broker execution, email, push, or other external action unless the command explicitly requires it and the user has authorized it in this session or the repository runbook already defines it as mandatory.

This skill is the compatibility layer for Codex. It does not make Claude `.claude/commands/*.md`
files native Codex slash-menu entries.

Dedicated shortcuts may also exist for common commands. `$scanner` maps directly to the same
`.claude/commands/scanner.md` runbook.
