---
trigger: model_decision
description: Load when creating branches, writing commit messages, or opening pull requests. Contains the allowed scopes and the repository specific git policy; the shared rules are in the workspace root.
---

# Git Workflow - Frontend

The branch naming, commit message, commit granularity and pull request rules shared with the backend are in the workspace root `.claude/rules/GIT_WORKFLOW.md` (mirrored in `.agents/rules`).
Read that file as well; this one adds only what is specific to the frontend.

develop: Development branch (The main programming activities will be pushed here. Changes, updates, additions, and modifications will all be pushed here.)
main: Production branch (This is the terminal branch, accessible only by the owner.)

`main` is never a PR target for implementation work - it is owner-only, terminal.

## Allowed scopes (pr-lint enforced)

Domain scopes, matching the backend's list:

`admin` · `auth` · `comment` · `common` · `hashtag` · `luvax` · `mail` · `media` · `message` · `messages` · `notification` · `post` · `recommendation` · `report` · `search` · `social` · `story` · `support` · `users`

Layer and tooling scopes, which this project has in addition to the backend's:

`app` · `dashboard` · `routes` · `layouts` · `pages` · `ui` · `hooks` · `services` · `stores` · `config` · `assets` · `build` · `deps` · `db` · `docs` · `ci`

> **This list is the one `.github/workflows/pr-lint.yml` enforces**, and the two are kept in step.
> Three lists disagreed before: the workflow allowed only the layer scopes, this file documented the backend's domain list, and the commits actually being written used `support`, `luvax`, `recommendation` and `common` - none of which the workflow allowed.
>
> `pr-lint` validates the **pull request title only**, not commit messages, which is why the mismatch went unnoticed until a PR was opened.

```
feat(post): add carousel media support
fix(auth): prevent concurrent refresh token consumption
chore(deps): pin the vite major to 8
refactor(common): extract the response envelope unwrapper
```

## Checklist additions

- [ ] `npm run lint` and `npm run test` both pass
- [ ] At least one CODEOWNERS-assigned reviewer has approved
- [ ] `npm run lint` passes before every commit
