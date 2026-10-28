---
name: new-project
description: Start a new project in its own folder under ~/Mnt with a copy of this kit (agents, skills, starters, settings, CLAUDE.md), ready for /build. Use when the user wants to start a new project.
argument-hint: "<project-name> [one-line description]"
disable-model-invocation: true
---

# /new-project

1. Take the name from `$ARGUMENTS` (lowercase, digits, dashes); ask only if it is missing.
   The description is optional.
2. Run `bash .claude/skills/new-project/new-project.sh <name> "<description>"`. It creates
   `~/Mnt/<name>` with a git repo, copies this kit's `.claude/` (without local settings),
   writes `CLAUDE.md` from the template, adds the Figma MCP for that folder, and commits.
   It refuses if the folder exists.
3. Tell the user, in 3 lines: the folder, then
   `cd ~/Mnt/<name> && claude`, then `/build <what to build>`. The GitHub repo, the stack and
   the scaffold are decided inside `/build`.

**Keeping projects in sync with the kit:** this folder (`~/Mnt/portfolio`) is the kit's
home. When a project improves a skill or agent, copy the change back here (and commit it) so
the next project starts with it. To refresh an existing project from the kit, copy
`.claude/agents`, `.claude/skills` and `.claude/starters` over and review the diff.
