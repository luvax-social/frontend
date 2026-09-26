# Orchestrator Brief

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

For the planner, who knows the product but has not seen this code and will not run the app.

## What was built

A reviewer can now find any account, read its state, and take every account-lifecycle action the
server permits, and can manage the hashtag vocabulary. The panel gained:

- **An account list and search** at `/admin/users` — status and role filters, a debounced,
  rate-limited search, rows that show role and status so triage needs no second fetch. Administrator
  only.
- **A capabilities-driven account detail** — the existing discipline/content screen expanded for
  administrators with ban, unban, suspend, unsuspend, role change, and force logout, every control
  rendered from the server's `capabilities` object and refetched after each action.
- **A hashtag registry** at `/admin/hashtags` — list, search, create, status transitions, and
  delete. Administrator only.
- **The audit log's actor filter**, deferred last phase for want of a picker, now using account
  search.

All of it was browser-verified across an administrator and a moderator context (and a regular user
for the user-app regression), with 31 screenshots. The user-facing app and the previous phases still
work.

## Architectural decisions, and the option rejected

- **Controls render from capabilities, computing nothing about permission (option b).** The server's
  `capabilities` object is coarse (`canChangeStatus`, `canChangeRole`, `assignableRoles`); which
  *status* transition to offer is derived from the current status against the verified state machine,
  because capabilities do not enumerate transitions. Rejected: inferring permission from status,
  which would render controls the server then refuses.
- **Force logout renders outside capabilities.** It has no capability flag and is always permitted to
  an administrator, so it renders whenever the administrator-only detail loaded; on the caller's own
  account its confirmation states it signs them out. Rejected: hiding it (the server permits it) and
  gating it on a capability that does not exist.
- **The account list, search, and hashtag registry are administrator-only routes.** The backend
  answers the entire account surface and the hashtag admin surface with 403 to a moderator, so these
  sit behind the administrator guard and never mount for a moderator. Rejected: rendering them and
  letting them 403.
- **The account detail's lifecycle card is gated on the administrator role**, so a moderator sees the
  discipline and content surfaces with no empty control card. Rejected: rendering the card and
  showing nothing inside it.
- **New field-carrying dialogs quote the shared confirmation shape rather than extending it** — the
  same decision the previous phase made for the warn dialog.

## Contract divergences found (full list in `accounts-contract-verification.md`)

- **The capabilities object is three coarse fields, not per-action flags.** No force-logout flag.
- **Suspend takes `durationDays` (1..3650), not an end time.** The panel computes and shows the end
  time locally.
- **The production search rate limit is 40/min, not the prompt's 60** (60 is the dev budget). Built
  to 40/min.
- **The whole account surface is administrator-only** — moderator gets 403 on list, search, detail,
  and every lifecycle action.
- **A created hashtag's id is in `targetEntityId`** of the returned audit action, not `id`.
- **Force logout is POST**, not PATCH; it revokes all refresh tokens and advances the token epoch, so
  the target's access token and refresh both die at once (verified live — settles last phase's open
  question).
- **Delete marks a hashtag `deleted`; it does not remove the record.** Duplicate create → 409
  `HASHTAG_ALREADY_EXISTS`.
- **Role transitions (from source):** user↔moderator and moderator→admin are permitted; user→admin is
  skip-level refused; an existing administrator can never be changed, so promotion to administrator
  is the irreversible one-way door.

## Controls deferred, and why

- **Statistics, the user activity log, per-session detail and revoke, and the hardening sweep** —
  out of scope; the final phase. `sessions`, `reportsAgainst`, and the IP fields on the detail are
  surfaced only as counts for now.
- **A pre-issue warning count** — no read endpoint exposes it (only the warn response does), so it is
  not shown; the post-issue count is surfaced honestly instead.

## Open questions for a human before the next phase

1. **Pre-issue warning count.** Showing "this account has N warnings" before issuing needs a backend
   read that returns the active count. Options: **(a, recommended)** keep the post-issue surfacing;
   **(b)** add the active count to the violations payload or account detail. Recommend (a) while the
   backend is frozen.
2. **Indefinite suspension.** `durationDays` is schema-optional but its omitted behaviour is
   unsettled; the panel requires a bounded duration. If indefinite suspension is wanted, pin the
   server behaviour for an omitted `durationDays` first.
3. **User-facing settings 404.** `GET /users/me/settings` returns 404 for a seed user on the
   user-facing settings page — pre-existing, not this phase, not fixed (backend read-only, user app
   out of scope). Flagged for whoever owns that surface.

## What could not be verified

- **An administrator target distinct from self**, and the `ADMIN_TARGET_PROTECTED` refusal live —
  the seed set has one administrator, who is the caller, so "administrator target" and "self"
  coincide. The rule that neither is actionable (and that promotion to administrator is irreversible)
  was read from the backend source and is documented as such; creating a second administrator was
  forbidden. Nothing above is a check the tooling could have run.
