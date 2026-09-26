---
trigger: always_on
description: Always active. Establishes .workspace/ as the agent working directory and defines the required first-action checklist for every session.
---

# Workspace Rule

## What is `.workspace/`

`.workspace/` exists at the project root. It is the agent's working directory for every task — plans, reports, scripts, progress files, and scratch work all go here. Content is not tracked by git; each developer has their own copy. Writing here does not affect the project or other developers.

## First action — every session, every task

1. Check `.workspace/progress/` for any `*_progress.md` files. If one exists for the current task, read it to determine what is complete and what is pending before doing anything else.
2. Check `.workspace/plans/` for pending work that has not yet started.

There is no `.workspace/README.md` in this repository; the folder guide below is that guide. The backend carries one at `backend/.workspace/README.md`.

## All output goes to `.workspace/`

Do not write plans, reports, or intermediate files to the project root or to any project-owned directory (`src/`, `docs/`, `public/`, etc.) unless the file genuinely belongs to the project — source code, tests, or official documentation.

A script that a future session must be able to run is not scratch work and does not belong here: `.workspace/` is untracked by rule (`.workspace/.gitignore` allows only `.gitignore` and `.gitkeep` through), so anything left in it is gone for the next session and for every other machine. Such a script goes in the tracked `scripts/` directory at the repository root, alongside `dev-server.mjs` and `regenerate_struct_figures.sh`.

## Default subdirectories

| Folder | Contents |
|--------|---------|
| `plans/` | Upcoming work not yet started |
| `progress/` | Active session state — progress tracking files |
| `reports/` | Completed outputs — scans, summaries, PR text |
| `tmp/` | Scratch work; do not rely on these persisting |

Agents may create additional subfolders within any of the above as needed.

## File naming

Name a file as if explaining it to a colleague with no prior session context: `{task-name}_progress.md`, `{task-name}_plan.md`, `{topic}_report.md`. Other agents in future sessions navigate this folder to work out what has been done.

There is no `skill-workspace` in this repository; an earlier revision of this file referred to one. The skills that do exist are under `.claude/skills/`: `frontend-design`, `shadcn`, `ui-ux-pro-max`, `vercel-react-best-practices`, `web-design-guidelines`.
