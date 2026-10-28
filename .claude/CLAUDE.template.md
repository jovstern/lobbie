# __PROJECT_NAME__

__ONE_LINE__

Built with `/build` (this kit: `.claude/README.md`). The spec, plan and decisions live in
`docs/superpowers/` and `docs/adr/`; metrics reports in `docs/metrics/`.

## Commands

Filled in by `/build` once the stack is chosen (dev, check, e2e, database scripts).

## How work happens

- `/build` runs the project: discovery questions, an architecture recommendation the user
  decides, one approval of spec and plan, then one milestone at a time. Each milestone is a
  branch `mN-<slug>` and a PR on `jovstern/__PROJECT_NAME__` with a code review, UI review,
  metrics report and demo GIF. **The user merges every PR; Claude waits for the merge.**
- Every agent runs on Opus 5.5 (`opus`).
- Superpowers preferences (they override the skills' defaults):
  - Brainstorming: questions in `AskUserQuestion` batches of up to 4, as many rounds as
    needed; the architecture is the user's decision; one approval of spec and plan together.
  - No git worktrees: work in place on the milestone branch; one commit per task.
  - Subagent-driven development runs one milestone's tasks without stopping, then the
    milestone reviews.
  - When finishing a milestone, do not show the merge/PR menu: push, open the PR, stop.

## This machine

- Databases available: MongoDB at `mongodb://localhost:27017` (Homebrew service); SQLite
  through `better-sqlite3`; hosted Postgres (Neon) or MongoDB Atlas when the user creates
  one. No local Postgres, no Docker. The database is the user's choice in `/build`; never
  pick or connect to one before they answer.
- Secrets live only in `.env*` (git-ignored). Never read, print or commit them; ask the user
  to run any command that needs to show one.
- Tests never touch the app's data: their own database, schema or prefix, cleaned up after.
- `gh` is logged in as `jovstern`. `ffmpeg` is installed (demo GIFs).

## Hard rules

- Follow `.claude/skills/stack-conventions/SKILL.md` (and the stack files the spec names),
  `ui-craft`, `metrics` and `quality-gates`.
- Never push to `master` or merge a PR. Never bypass a hook or check; never skip or delete a
  failing test.
- Ask before changing lint, TypeScript, framework or test configuration.
