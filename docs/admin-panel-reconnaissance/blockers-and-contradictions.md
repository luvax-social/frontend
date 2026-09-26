# Blockers and Contradictions

> Record of work done on 2026-08-21. Not maintained; it is correct as of that date and is not updated as the code moves.

Anything that would stop or misdirect the next phase.
Nothing here was acted on; this phase changed no application code.

## Hard blockers

None.
The backend runs, both sessions were obtained, every administrative endpoint responds, and the recommendation module does not block the panel.
The next phase can proceed.

## Capabilities the panel needs that do not exist yet in the frontend

These are gaps, not defects.
Each is stated as a gap, not a proposed fix.

1. Role-based route gating.
`ProtectedRoute` (`src/components/common/ProtectedRoute.jsx`) gates on authentication only.
The panel needs two route trees by role, and there is no role-aware guard.
2. A role field in the auth store.
`useAuthStore` has no dedicated `role`; role exists only inside `user.role`.
The refresh path in `axiosClient.js` uses `setTokens`, which does not repopulate `user`, so `user.role` can go stale on an interceptor-driven refresh (the boot path in `AuthSessionBootstrap` does repopulate it).
The settled position (role comes from login and refresh only, never `/users/me`) is correct against the backend, but the store does not yet hold role as a first-class value.
3. A date-range control that clamps to 30 days.
No date-picker primitive exists; two administrative endpoints require it (`user-events`, `stats/timeseries`).
4. A reason-carrying confirmation.
`ConfirmModal` has the 500 ms arming delay and the destructive styling but no 2000-character reason textarea; every destructive admin action needs one.
5. A `warning` colour token in JS.
`--lx-warning` exists in `index.css` but is absent from the `v` object in `tokens.js`, so a warning-toned status badge cannot be built from JS without adding it.
6. A statistics or chart primitive.
None exists; the statistics screen needs charts, and the settled position forbids a new UI dependency, so charts are net-new internal work.
7. Icons for the admin domain.
`lx-icon.jsx` lacks a shield, a chart glyph, a filter glyph, a calendar glyph, and a check glyph; each is one map entry to add.

## Contradictions between the two handoff documents and the settled positions

The backend handoff (`docs/admin-panel/ADMIN_PANEL_HANDOFF.md`) advises things the run configuration overrides.
The run configuration wins; these are recorded so the next phase does not follow the handoff into them.

1. TypeScript.
Handoff line 13: "Generate your TypeScript types from that file."
Settled position: plain JavaScript; `openapi.json` is a contract reference only.
2. Component library.
Handoff line 15: target stack includes `shadcn/ui`.
Settled position: no new UI dependency; build from the internal `Lx*` primitives.
The shadcn scaffolds still physically present in `src/components/ui/` (`button.jsx`, `card.jsx`, `input.jsx`, `label.jsx`) are legacy and are not the panel's building blocks.
3. Icons.
Implied by the shadcn direction: an external icon set.
Settled position and reality: the internal inline-SVG `LxIcon`.

## Contradictions between the handoff and the running backend

Full detail in `api-contract-verification.md` section 5.9.
The ones that will misdirect the next phase if missed:

1. Strict query parameters are not universal.
Handoff section 5 and 7.5 present "undeclared query parameters produce HTTP 400" as a general rule.
It holds only for `/api/v1/admin/**`.
`GET /api/v1/reports` and `GET /api/v1/reports/pending` (both panel surfaces) return 200 with an undeclared parameter.
Do not assume a stray parameter will be caught on the report-queue endpoints.
2. Rate-limit numbers are the prod profile, not dev.
The dev profile (the one that runs locally) allows `stats/timeseries` and `user-events` at 60 per minute (handoff says 30), the broad admin rule at 150 (handoff says 300), login at 10 per 60 seconds (handoff says per 900 seconds), refresh at 100, and ws-ticket at 200.
Only the two search endpoints match at 60 per minute.
Build against the search limit; do not hard-code the other numbers from the handoff into the interface.
3. `POST /api/v1/admin/hashtags` returns 201, not 200.
The 8.4 table says 200; the endpoint returns 201, consistent with the handoff's own section 9.8.
4. The no-token claim is a filter statement, not an observable-status statement.
All 47 endpoints return 401 with no token; login and refresh are not exceptions to returning 401, only to being rejected by the auth filter.

## Contradictions between the stale structural documentation and the code

The planner's structural documentation (`frontend/.claude/rules/struct.md`, `global_rules.md`) is stale.
The material contradictions are enumerated in `frontend-inventory.md` section 6.1.
The load-bearing ones:

1. Routing is now URL-per-screen, not a single `/app` route with screens held in component state.
2. The refresh token is already an HttpOnly cookie, not held in memory pending migration.
3. `lucide-react` is gone; icons are internal `LxIcon`.
4. The UI layer is internal `Lx*` primitives, not shadcn/Radix (a few shadcn scaffolds survive unused).

## Environment contradictions

1. The backend `.env` in use is stale relative to `.env.example` (missing `REFRESH_COOKIE_*`, `GORSE_*`, `STATS_*`, `TZ`, and consumer flags); the application starts anyway on `application.yaml` defaults.
Detail in `environment-bringup.md` section 4.2.
2. The backend's own `struct.md` says 72 migrations; the code and database are at 74.
The workspace `STRUCT.md` says 18, and is far more stale.
3. The running backend on port 8080 is served from a second checkout (`GitClone/app`) on the same `develop@c297b03`, not from the workspace submodule at `backend/`; both are the same commit with clean trees, so source citations to `backend/` are valid.
4. JDK on the machine is 23, while `pom.xml` pins `java.version` to 21; the build compiles with `--release 21` and runs on 23 without incident.
