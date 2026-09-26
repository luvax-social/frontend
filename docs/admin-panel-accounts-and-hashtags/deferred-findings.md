# Deferred Findings

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

Everything noticed and not acted on, tagged with the phase it belongs to.

## Recorded absence (this phase, by design)

- **Pre-issue warning count is not available.** No read endpoint exposes an account's current active
  warning count: the violations list (`GET /admin/violations/for-user/{id}`) is a cursor page with no
  total and no count field, the account detail carries no count, and `GET /users/me/warnings` is
  likewise a page with no total. The count exists only on the warn *response*
  (`AdminWarnUserResponse.activeWarningCount`). Per requirement 5.5, no pre-issue count is shown
  (computing it from a partial page would fabricate it); the honest post-issue count is surfaced in
  the warn success feedback instead. If the panel is required to show "this account has N warnings"
  *before* issuing, that needs a backend read that returns the active count (a small addition to the
  violations payload or the account detail). **Recommendation:** accept the post-issue surfacing;
  raise the pre-issue count as a backend ticket only if product requires it.

## Belongs to the final phase (statistics, activity log, hardening) — recorded, not acted on

- **Statistics and the user activity log.** `GET /admin/stats/current`, `/admin/stats/timeseries`,
  and `/admin/user-events` exist and are administrator-only. Not built this phase.
- **The section 15 hardening sweep.** Not this phase.
- **`AdminUserSessionResponse` detail is summarised as a count.** The account detail returns a
  `sessions` array (device, user-agent, ip, created/expires). This phase surfaces only the count in
  the state summary. A per-session table (and per-session revoke, which the API does not currently
  expose) belongs to the activity/hardening phase if wanted.
- **`registrationIp` / `lastLoginIp` on the detail are not surfaced.** They are available on
  `AdminUserDetailResponse` but are PII with no triage use in this phase; surfacing them is a
  hardening/statistics decision.
- **`reportsAgainst` on the detail is surfaced only as a count.** The array carries report ids and
  reasons; linking each to the report detail is a small enhancement left for a later pass to avoid
  widening this phase.

## Pre-existing, not caused by this phase (recorded per §9.2, not fixed)

- **User-facing settings page: `GET /users/me/settings` returns 404.** Signing in as `seed_bob` and
  opening `/app/settings` produces two 404s on `/api/v1/users/me/settings` and a QueryClient
  "Requested resource was not found" console error. This is in the user-facing application, is
  unrelated to the admin panel, and this phase changed nothing in that area. Likely a seed-data or
  backend issue (the seed user has no settings row, or the path differs). **Not fixed**, because the
  constraint forbids changing the user-facing application and the backend is read-only; recorded for
  whoever owns the settings surface.

## Contract observations worth a backend ticket (not blocking)

- **The prompt's stated search rate limit (60/min) is the dev budget; production is 40/min.** Built
  to the stricter production figure. No action needed unless the two profiles are meant to match.
- **`durationDays` is optional in the suspend schema** (only `reason` is required), but a suspension
  with no duration was not observably supported (the only such call in verification hit an
  already-suspended target and returned a transition conflict, so the "no duration" path is
  unsettled). The panel treats the duration as required and bounded, which is the safe reading and
  is needed to show a resulting end time. If indefinite suspension is a product requirement, the
  server behaviour for an omitted `durationDays` should be pinned down first.
