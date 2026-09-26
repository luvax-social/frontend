# Deferred Findings

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

Everything noticed and deliberately not acted on, tagged with the phase it belongs to.

## Deferred to the next phase (account and violations surfaces)

- NEXT-PHASE: the "warn the owner" control on the report detail screen.
It requires the owner's role, which for a definite answer needs `GET /api/v1/admin/users/{ownerId}`, an administrator-only endpoint a moderator cannot call.
Rather than guess, this phase renders nothing.
It belongs with the account surface, where the owner's role is available.
- NEXT-PHASE: the owner's violation history panel on the report detail screen.
It depends on the violations screen, which is built in the next phase.
The endpoint (`GET /api/v1/admin/violations/for-user/{userId}`) and its role-scoped result and role-scoped cursor are already documented in the handoff for that phase.
- NEXT-PHASE: a vocabulary-driven reason selector.
The warning issuance form is the first surface that lets a human pick a reason from the vocabulary, so the "disabled entry rendered unavailable and unselectable" behaviour has its first real use there.
`FilterBar` already renders a disabled option as unavailable and unselectable for when that selector is built.
- NEXT-PHASE: a moderator has no list path back to a report it escalated.
Verified in the browser: a moderator escalated a report, then found it absent from the queue under every filter combination, including a direct navigation to `?status=escalated` and to no status filter at all, both confirmed empty at the network level (`GET /api/v1/reports?status=escalated&limit=20` returns `200` with zero rows for a moderator).
The report is still readable by its id (`/admin/reports/{id}`), so nothing is lost, but there is no route that surfaces it.
The one path back is the moderator's own action log filtered to `actionType=escalate_report`, which is verified to return the moderator's own escalation and, importantly, **the `AdminActionResponse` already carries `reportId`** (`GET /api/v1/admin/actions?actionType=escalate_report` returned the row with `reportId: d52c5431-...` unprompted; no backend change is needed).
The gap is entirely on the frontend side and belongs to the next phase, which is where "my action log" (screen 14.9 in the handoff) is built: that screen must render a link from an audit row to `routeTo.adminReportDetail(row.reportId)` whenever `reportId` is non-null, or a moderator has no way back to something it escalated.

## Deferred to a phase allowed to move files

- CLEANUP: the panel imports `LxBtn` and `LxTag` from `features/luvax/components/primitives.jsx` and `toast`/`ToastHost` from `features/luvax/components/Toast.jsx`, which are cross-feature imports.
The correct home for these shared primitives is `src/components/`, but moving a file is out of scope this phase.
A phase permitted to move files should relocate the shared primitives and the toast host to `src/components/` and update both features' imports.

## Backend, out of scope (backend is read-only)

- BACKEND: `GET /api/v1/reports` returns a role-scoped result set that the handoff and the reconnaissance did not document.
A moderator sees only pending and reviewing reports; an administrator sees all five statuses.
The panel builds correctly against this (the queue query key includes the role), but the handoff's claim that `?status=escalated` is "the escalated queue" for both roles is true only for an administrator.
Recorded, not a defect.
- BACKEND: `GET /api/v1/reports/{reportId}` returns 404 for a moderator once a report is resolved or dismissed, while an administrator reads it.
The panel treats the 404 as a calm not-found.
Recorded, not a defect.
- BACKEND: a bare `token_epoch` increment invalidates access tokens only; the refresh token is not epoch-gated, so the client refreshes and the session self-heals.
The handoff's section 15.1 item 4 implies the epoch bump alone forces a redirect to login.
Observably a redirect requires the refresh token to also be revoked, which is what force-logout does.
Recorded as a documentation refinement, not a code defect.
- ACCOUNT-PHASE: the redirect-to-login path (single refresh, then a clean redirect with no loop) has been verified only under a direct database `token_epoch` increment plus a direct database revocation of the refresh tokens, done by hand to simulate what force-logout does.
It has not been verified against the real `POST /api/v1/admin/users/{userId}/force-logout` endpoint, which is not wired to any control in this phase (the account detail screen that would carry that control is out of scope here).
The two are expected to behave identically, since force-logout is documented to increment the epoch and revoke every refresh token, which is exactly what was simulated, but this must be re-verified against the real endpoint once the account phase wires the force-logout control, rather than assumed from the simulation.
- BACKEND: the strict-query-parameter interceptor is not applied to `/api/v1/reports` or `/api/v1/reports/pending`, only to `/api/v1/admin/**`.
The panel sends only declared keys everywhere regardless.
Previously recorded in the reconnaissance; left untouched.
- BACKEND: the development-profile rate limits are looser than the documented production limits.
The panel is built against the tighter production limits (search debounced, 429 never auto-retried, the escalated poll gated and no faster than 60 seconds).

## Explicitly not in this phase, noticed and not acted on

Per the run configuration, the following areas were noticed and deliberately untouched: the account list, search, and detail screens; ban, unban, suspend, unsuspend, role change, and force logout; warning issuance, the violations screen, and warning or strike revocation; the per-account post and comment listing screens; the hashtag registry; the audit log screens and the action detail drawer; statistics and the user activity log; and the recommendation module.
The endpoints and response shapes for these are documented in the backend handoff and were confirmed present but not consumed.

## Verification limitations

- The reduced-motion state could not be observed under an emulated operating-system preference with the available browser tooling; the mechanism was verified by inspection instead (see `verification-evidence.md`).
- A message-target report was not created, because it requires conversation and message fixtures the panel does not build; the story target verified the same read-only branch.
