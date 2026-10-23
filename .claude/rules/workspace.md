---
trigger: always_on
description: Always active. Establishes .workspace/ as the agent working directory; the shared checklist is in the workspace root and this file adds what is specific to this repository.
---

# Workspace Rule - Frontend

The shared rule is in the workspace root `.claude/rules/WORKING_DIRECTORY.md` (mirrored in `.agents/rules`).
Read that file as well; this one adds only what is specific to the frontend.

## Frontend additions

- There is no `.workspace/README.md` in this repository; the shared folder guide is that guide. The backend carries one at `backend/.workspace/README.md`.
- Do not write plans, reports, or intermediate files to `src/`, `docs/`, `public/` or the project root unless the file is source code, a test, or official documentation.
- A script a future session must be able to run goes in the tracked `scripts/` directory at the repository root, alongside `dev-server.mts` and `regenerate_struct_figures.sh`.
- There is no `skill-workspace` in this repository; an earlier revision of this file referred to one. The skills that do exist are under `.claude/skills/`: `frontend-design`, `shadcn`, `ui-ux-pro-max`, `vercel-react-best-practices`, `web-design-guidelines`.
