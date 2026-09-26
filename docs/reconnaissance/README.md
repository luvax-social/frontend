# Reconnaissance

> Record of work done on 2026-08-01. Not maintained; it is correct as of that date and is not updated as the code moves.

A full-stack audit of the Luvax backend and frontend, carried out before any feature work on the
post, comment, and social modules.

Nothing here is a plan.
Every file records what was observed, with the evidence attached.

## When this was run

| Item | Value |
|------|-------|
| Date | 2026-08-06 |
| Backend commit | `450212e996881360abf5b04becfa1ee765a72946` |
| Backend commit subject | Merge pull request #142 from zentech-graduation/fix/common/api-contract-and-security-hardening |
| Frontend commit | `102923c2194b37b6033b033c53000ab4e5da9de2` |
| Frontend commit subject | chore(docs): add workspace and git workflow configuration rules |
| Backend build | Spring Boot 4.0.6, Java 21 target, run on JDK 23 |
| Database | PostgreSQL 18.4, Flyway at version 44 |
| Frontend build | Vite 8.0.13, React 19 |

Both applications were started and the backend was exercised with `curl`.
The endpoint contract in this folder is observed behaviour, not inferred behaviour.

## How to read these files

Start with `demo-readiness.md` if you want the short answer to "can we show this to an engineering
lead".
Start with `feature-gap-matrix.md` if you want the full capability picture in one table.

| File | What it holds |
|------|---------------|
| `backend-api-contract.md` | Field-level contract for every in-scope endpoint, with the observed request and response for each. Each entry is marked runtime-verified or code-derived. |
| `backend-data-model.md` | Schema facts the API shape does not reveal: the comment nesting model, the follow state machine, block semantics, and every enum. |
| `frontend-inventory.md` | Routes, screens, data layer, mock data, rule violations, dead code. |
| `design-system-reference.md` | Tokens, typography, the complete icon inventory, and the prop surface of every primitive in the design export. |
| `design-conformance-gaps.md` | Per-screen divergence between the design export and the current frontend, plus the states the design never defines. |
| `feature-gap-matrix.md` | One row per capability, classified. |
| `demo-readiness.md` | The demo scenario step by step with a verdict for each step. |
| `defects.md` | Every bug, warning, and correctness problem observed anywhere. |
| `open-decisions.md` | Decisions that need a human, and the ones already settled. |
| `local-environment-runbook.md` | How to start both applications from a clean state, and every error hit along the way. |
| `seed-data.md` | What the seed script creates and how to run it. |

## Headline findings

1. The backend is far more complete than any document in either repository claims.
   Fifteen modules are implemented, not two.
   `.claude/rules/STRUCT.md` in the workspace root describes eleven of them as "empty scaffolds"
   and states there are 18 Flyway migrations; there are 44.
   Treat every existing structural document as stale.

2. Viewer state is carried on the response DTOs.
   `isLiked` and `isSaved` are on every post, `isLiked` is on every comment, and a
   `viewerState` object is on every user profile and user-list row.
   The N+1 fan-out that the read-only backend constraint was expected to force does not exist.
   See `open-decisions.md`.

3. A realtime transport already exists and is enabled in the dev profile.
   STOMP over SockJS, verified at runtime with a 101 upgrade.
   See investigation 10 in `backend-data-model.md`.

4. The frontend calls two endpoints that the backend rejects.
   `GET /users/suggestions` does not exist and returns 400, and the post status update sends the
   wrong field name and returns 400.
   Both are in `defects.md`.

5. The design token layer is already fully conformant.
   All 50 `--lx-` tokens the export defines are present in the frontend with identical values.
   The divergence is at component level, not token level.

6. `Luvax.html` is not in either repository.
   It was found at `C:\Users\minhg\OneDrive\Desktop\Luvax.html` and used from there.
   It should be committed or stored somewhere the team shares, because the design conformance
   target depends on a file that currently exists on one machine.

## Files changed by this audit

Only `docs/reconnaissance/`, `tools/seed/`, and the `CHANGELOG.md` entry the project rules require
were written, and only in the frontend repository.
The backend repository was not modified.

Frontend `git status --short` on branch `chore/common/full-stack-reconnaissance`, before the
reports were committed:

```
 M CHANGELOG.md
?? docs/
?? tools/
```

Backend `git status --short` on branch `develop`:

```

```

The backend working tree is clean; the command produced no output.

Two changes were made outside the repositories, both to data rather than to files:

- Rows were written to the local PostgreSQL database through the API by the endpoint sweep and the
  seed script.
- `user_credentials.email_verified` was set to true by direct SQL for the audit and seed accounts,
  because email verification cannot be completed through the HTTP API in a local environment.
  See `seed-data.md` and `defects.md`.
