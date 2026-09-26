# Admin Panel Foundation and Report Review

> Record of work done on 2026-08-21. Not maintained; it is correct as of that date and is not updated as the code moves.

This phase built the frontend foundation for the administrative and moderation panel and the first vertical slice on top of it: the report review workflow.

## What this phase delivered

A moderator can sign in, see the reports awaiting review, open one, see the reported content, and close it.
An administrator can do the same and reach the escalated queue a moderator cannot.

The foundation underneath the workflow:

- Role captured into the session from the login and refresh responses only, and role-based landing after sign-in.
- Two route trees under `/admin`, one per role, lazily loaded, gated inside the existing authentication guard.
- A shared layer every later phase depends on: a declared-key request contract, cursor pagination that terminates on `hasNextPage` and keys on role, error classification, the vocabulary cache, and id-to-username resolution.
- The panel shell with role navigation, the signed-in identity, sign out, and the escalated-count badge.
- The derived patterns: a record table, a filter bar, a status indicator, a reason-carrying confirmation dialogue, a load-more affordance, and the four list states.

The report workflow screens: the report queue, the escalated queue, and the report detail with its actions.

## What a reviewer should open first

1. `report-contract-verification.md`: the sixteen-item contract check against the running backend, committed before any feature code, and the two divergences it found.
2. `design-decisions.md`: every decision the phase was asked to state, the derived patterns and their tokens, the error classification, and the copy convention.
3. `src/features/admin/`: the code, starting at `adminRoutes.jsx` for the tree, `components/AdminShell.jsx` for the shell, and `screens/ReportDetailScreen.jsx` for the workflow.
4. `verification-evidence.md`: what was exercised in a browser and observed.

## How to run it

The backend must be running at `http://localhost:8080` with the compose stack healthy, and the seed accounts must exist (`bash scripts/seed-dev-data.sh` in the backend, every seeded account uses `SeedPass123!`).

From `frontend/`:

```bash
npm install
npm run dev
```

The dev server serves the application at `http://localhost:5173` and proxies `/api/v1` to the backend.

Sign in as `admin@seed.local` to land on the administrator panel, or `mod@seed.local` for the moderator panel.
The report queue starts empty on a fresh seed, because reports are created by ordinary users; create a few by having a seed user report another user's content through the application or the API, then review them in the panel.
