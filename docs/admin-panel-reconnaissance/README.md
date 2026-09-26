# Admin Panel Reconnaissance

> Record of work done on 2026-08-21. Not maintained; it is correct as of that date and is not updated as the code moves.

What this phase established, and what the next phase can rely on.
Read the other seven files for the evidence.

## State of the system

The backend runs.
It is `develop@c297b03`, Spring Boot on JDK 23, Flyway at schema version 74, serving on `http://localhost:8080` with health UP.
The five-service compose stack (postgres, rabbitmq, redis, mailpit, elasticsearch) is healthy.
The Gorse recommendation module is a separate, un-started compose stack and does not block the panel; it added only the administrator-only `GET /api/v1/admin/user-events` to the surface the panel touches and touched the frontend not at all.
Seeding is idempotent; a `--reset` recovered a clean baseline; all five seed accounts authenticate.
A moderator session and an administrator session were both obtained.

## What the next phase can rely on

- The handoff (`docs/admin-panel/ADMIN_PANEL_HANDOFF.md`) is accurate.
The 47-endpoint role matrix matches in 46 of 47 rows; the one difference (row 42 returns 201, not 200) is documented in the handoff's own section 9.8.
All five headline traps and all six response-shape divergences hold exactly.
Cursor scope, vocabularies, and the statistics and activity-log behaviour all match.
- Two contract caveats matter for building, both in `api-contract-verification.md`.
First, the strict-query-parameter rule holds only for `/api/v1/admin/**`; the report-queue endpoints (`/reports`, `/reports/pending`) accept undeclared parameters with 200.
Second, the handoff's rate-limit numbers are the production profile; the dev profile that runs locally allows `stats/timeseries` and `user-events` at 60 per minute, the broad admin rule at 150, and login at 10 per 60 seconds; only the two search endpoints match at 60 per minute.
- The frontend transport layer is usable largely unchanged: two axios clients, a request interceptor that attaches the bearer, a response interceptor that normalizes and redacts errors, and a single-flight 401 refresh that replays once and hard-redirects on failure.
- Routing is URL-per-screen (the stale docs say otherwise): every screen has a real nested route under `/app`, driven by a `handle: { screen, chrome, rightRail }` metadata pattern the panel can copy.
- Cursor pagination is already implemented correctly (terminates on `pageInfo.hasNextPage`) via `useDrainEmptyPages`; reuse it.
- The design system is internal `Lx*` primitives and `--lx-*` tokens, not shadcn/Radix and not `lucide-react`.
`LxBtn`, `LxTag`, `LxModal`, `LxBottomSheet`, `LxAvatar`, `LxDropdownMenu`, `LxToggle`, `ConfirmModal` (500 ms arming), and `toast`/`ToastHost` cover most panel needs.

## What the next phase must build net-new

Role-based route gating (the guard is not role-aware and the store holds no dedicated role, only `user.role`), a reason-carrying confirmation (extend `ConfirmModal`), a date-range control clamped to 30 days (no picker exists), a record-table and filter-bar composition, a status-indicator vocabulary (needs `--lx-warning` added to the `v` object), and statistics charts (no chart primitive, and no new dependency is allowed).
Detail in `derived-pattern-gaps.md` and `blockers-and-contradictions.md`.

## What could not be verified, and why

- The set of variables the application refuses to start without was not re-derived by deletion.
The running `.env` already satisfies them, and emptying required secrets on a working local environment was judged not worth the disruption; the enforced set is stated from the handoff and `application.yaml` instead.
Attempted-and-decided-against, not blocked.
- A true cold-start Flyway "Successfully applied N migrations" line was not observed, because the database was already migrated; the count (74) comes from `flyway_schema_history` and the "up to date, version 74" start-up line.
- The statistics screens could only be seen empty.
`stats/current` returns nulls and `timeseries` returns no points because no 30-minute bucket has been collected yet; the emptiness condition and the 30-minute interval are established (the latter read from source), but populated statistics were not observed.
Not attemptable within the phase without running the app for 30-plus minutes.
- The full set of written `user_events` types was established from source (7 possible: `session_start`, `search`, `profile_view`, `post_like`, `post_save`, `post_view`, `post_comment`) and labelled read from source; only `session_start` was actually present in the database, so the other six write paths were not observed firing.
- The frontend was inventoried by reading the code, not by running it in a browser.
The transport and routing behaviour is stated from source with the interactive checks noted where done; no browser session was driven.
- Elasticsearch cold-start timing was not re-measured, because the stack was already healthy on arrival.

## Deliverables in this directory

`environment-bringup.md`, `api-contract-verification.md`, `frontend-inventory.md`, `design-inventory.md`, `derived-pattern-gaps.md`, `blockers-and-contradictions.md`, `deferred-findings.md`, and this `README.md`.
The two prerequisite inputs are committed unchanged at `docs/admin-panel/`.
Nothing in either repository was modified outside `docs/`.
