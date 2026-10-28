# The kit

How every project is built with Claude Code: Superpowers for the method, plus this layer for
the house rules, the agents and the flow. Every agent runs on Opus 5.5. The default branch is `master`.

## Commands

| Command | What it does |
|---|---|
| `/build [what]` | The whole project: discovery questions → architecture options (you decide) → scaffold and repo → spec and plan (you approve) → milestones, each ending in a PR you merge. Run it again any time; it resumes. |
| `/new-project <name> [description]` | A new folder `~/Mnt/<name>` with a copy of this kit, ready for `/build`. |

## Who does what

| Role | Who | Model |
|---|---|---|
| Planner and coordinator: questions, architecture, spec, plan, dispatching | the main session | Opus |
| Plan reviewer: checks spec and plan before you see them | a fresh subagent | Opus |
| Implementer, one per task, test-driven | Superpowers subagent | Opus |
| Task reviewer: spec compliance and code quality per task | Superpowers subagent | Opus |
| Milestone code review: the whole diff | Superpowers `code-reviewer` | Opus |
| UI/UX review: screenshots at 3 widths, keyboard walk-through, states | `agents/ui-reviewer.md` | Opus |
| Metrics: Lighthouse, Web Vitals, bundle size, axe, API latency, logs | `agents/observer.md` | Opus |
| **You:** answers, the architecture decision, plan approval, every merge | | |

## Where the rules live

- `skills/stack-conventions/` — principles plus one file per stack: `nextjs.md`,
  `react-vite.md`, `node-api.md`, `mongodb.md`, `sql.md`, `styling.md`.
- `skills/ui-craft/` — the bar for a sharp UI and simple UX.
- `skills/metrics/` — budgets, instrumentation, how the observer measures.
- `skills/quality-gates/` — the definition of done.
- `skills/pr-demo/` — demo GIFs on the `pr-media` branch; `protect-master.sh`.
- `starters/nextjs`, `starters/vite-react` — scaffolds with lint, types, Vitest,
  Playwright (console errors fail tests), CI and git hooks; Tailwind or CSS Modules.

## Keeping it current

`~/Mnt/portfolio/.claude` is the source. When a project teaches us something, the fix goes
back here so the next project starts with it.
