# CODEX.md - Codex Compatibility Layer

This project was built around Claude Code conventions. For Codex, keep the Claude files as the canonical
project knowledge and translate the agent mechanics conservatively.

## Load Order

At session start, read:

1. `SOUL.md`, `USER.md`, today's and yesterday's `memory/YYYY-MM-DD.md`, and `MEMORY.md` when present in a
   main session.
2. `CLAUDE.md`.
3. The relevant directory-level `CLAUDE.md` before work in `daily/`, `weekly/`, `scanner/`, `analyses/`,
   `portfolio/`, `tech/`, `series/`, or `lab-src/`.
4. Any relevant `.claude/skills/*.md`, `.claude/commands/*.md`, or `.claude/memory/*.md` referenced by
   those files.

Do not duplicate project rules into this file unless they are Codex-specific. `CLAUDE.md` is the source of
truth for product, editorial, scanner, publication, and data-integrity rules.

## Translation Rules

- Treat "Claude", "Claude Code", "agent", and "routines cloud" as applying to Codex when the instruction is
  about project behavior, quality gates, data integrity, or publishing.
- Treat `.claude/commands/<name>.md` as command runbooks. Codex cannot rely on Claude slash-command loading,
  so read the command file and execute the equivalent steps manually.
- Codex does not expose `.claude/commands/*.md` as native slash-menu entries. If the user types a command
  such as `/scanner`, `/daily`, `/weekly`, `/analyse`, `/retro`, `/desk`, `/signals-desk`, `/aplus`, or
  `/series`, route it to the matching `.claude/commands/<name>.md` file and follow that runbook.
- The project skill `.codex/skills/dailytickers-commands/` provides the Codex-side command compatibility
  layer and should be kept in sync with `.claude/commands/`.
- The project skill `.codex/skills/scanner/` is the dedicated `$scanner` shortcut for the historical
  Claude `/scanner` command.
- Treat `.claude/skills/*.md` as project workflow references. They are not Codex system skills, but their
  procedures, gates, and gotchas still apply.
- Treat `.claude/memory/` as project incident memory. Read the relevant index and memory files before risky
  scanner, trading, publishing, or MCP work.
- Do not rename public articles, routes, or educational content merely because they mention Claude or
  Anthropic. Those are content/product references, not agent configuration.

## MCP And External Tools

- Claude project MCP config lives in `.mcp.json`; Codex project MCP config lives in `.codex/config.toml`.
  Keep the server list mirrored between them.
- Never add secrets or tokens to `.env`.
- If a Claude-only MCP namespace is unavailable in Codex, first look for an equivalent connected Codex tool
  or plugin. If no equivalent exists, stop the workflow that depends on fresh proprietary data and report the
  blocked dependency.
- Do not substitute remembered, stale, guessed, or scraped financial data where `CLAUDE.md` requires MCP
  data. The hard-stop and force-refresh rules still apply.

## File And Git Hygiene

- Preserve user changes in the dirty worktree. This repo often has generated scanner/data artifacts.
- Use `AGENTS.md` and this file for Codex-specific behavior. Keep `CLAUDE.md` useful for Claude Code unless
  the user explicitly asks to migrate away from Claude entirely.
- For new enduring project lessons, follow the double-write rule from `CLAUDE.md` when the Memory MCP is
  available; otherwise write the git memory file and note that MCP memory was unavailable.
