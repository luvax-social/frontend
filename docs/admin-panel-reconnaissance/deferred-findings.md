# Deferred Findings

> Record of work done on 2026-08-21. Not maintained; it is correct as of that date and is not updated as the code moves.

Things noticed and deliberately not acted on, each tagged with the phase it belongs to.
This phase changed no application code in either repository.

## Backend (out of scope: backend is read-only)

- BACKEND: `POST /api/v1/admin/hashtags` returns 201 while the handoff's own role-matrix table (8.4) says 200.
The endpoint is self-consistent with section 9.8; only the summary table is wrong.
Not a code defect; a documentation inconsistency in the handoff.
- BACKEND: the strict-query-parameter interceptor is not applied to `/api/v1/reports` or `/api/v1/reports/pending`, only to `/api/v1/admin/**`.
Whether that is intended (report endpoints predate the interceptor) is a backend question.
Left untouched.
- BACKEND: the dev-profile rate limits diverge from the handoff's stated numbers.
This is a configuration choice in `application-dev.yml`, not a bug.
Left untouched.
- BACKEND: `reportReasons` entries `spam`, `harassment`, `scam`, and `other` carry an empty `appliesTo` array while the others enumerate entity types.
Whether an empty array means "applies to all" or "applies to none" is a backend semantics question the panel should confirm before filtering the reason selector by entity type.

## Backend data hygiene (out of scope)

- BACKEND: `seed_alice.follower_count` reads 2 after `--reset` while the seed follow graph implies 1, because reset does not recompute trigger-maintained counters or clear the follow graph.
A stray follow from earlier testing survives.
Recorded, not corrected.

## This phase left the fixture data mutated (expected)

The contract verification created and mutated data on purpose.
The next phase should run `bash scripts/seed-dev-data.sh --reset` from the checkout that owns the running compose stack before it needs a clean baseline.
State left behind, for the record:

- `seed_bob` is suspended (auto-strike from three warnings) and force-logged-out.
- `seed_carol` and `seed_alice` carry warnings; `seed_alice` was moved to role `moderator` during the role-matrix row 38 test and was not reverted.
- Several disposable posts, comments, reports, and hashtags (`matrixtag`, `divtag1`, `idcheck1`, `dropme2`, and others) exist.
- Reports exist in all five statuses.

None of this affects a fresh `--reset`.

## Frontend, later panel-build phase

- PHASE-BUILD: the QueryClient sets a global `retry: 1`, which will retry once even on 429.
The handoff warns against auto-retrying 429.
Panel queries against rate-limited endpoints should override `retry` to exclude 429.
Noticed, not changed (changing the global default is a decision for the build phase).
- PHASE-BUILD: `withCredentials` is set only on the refresh call in `axiosClient.js`, not globally.
For a cross-origin production deployment the login response's `Set-Cookie` would not be stored without credentials on the login call.
In dev the Vite proxy makes this moot.
A deployment-time concern, not a panel-build blocker.
- PHASE-BUILD: two button systems coexist (`LxBtn` in use, shadcn `Button` legacy and unused).
Removing the unused shadcn scaffolds is a cleanup, explicitly out of scope for this phase and not required for the panel.
- PHASE-BUILD: `src/pages/HomePage.jsx` exists but is not imported by the router.
Possible dead file; not verified exhaustively and not touched.

## Frontend design tokens, later panel-build phase

- PHASE-BUILD: `--lx-warning` and its `-dim`/`-text` variants exist in `index.css` but are not exposed in the `v` object in `tokens.js`.
The status-indicator pattern needs them.
Adding them is a one-line change deferred to the build phase.
- PHASE-BUILD: there is no `--font-size-*` token scale; font sizes are inline per component.
The panel will match sizes by hand.
Not a gap to fill in this phase.

## Documentation drift, later documentation phase

- PHASE-DOCS: `frontend/.claude/rules/struct.md` and `global_rules.md` are stale on routing, tokens, and the icon library (detail in `frontend-inventory.md` 6.1).
- PHASE-DOCS: `backend/.claude/rules/struct.md` says 72 migrations; actual is 74.
- PHASE-DOCS: the workspace-level `STRUCT.md` says 18 migrations and 5 backend services without Elasticsearch or the recommendation module, far out of date.

None of these were edited; they are outside this phase's write scope (only `frontend/docs/` was written).
