# Orchestrator Brief

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

For the planner, who knows the product but has not seen this code and will not run the app.

## What was built

A reviewer can now answer "has this account done this before, and what did we do about it." The
panel gained:
- **Violation history** for an account — its warnings, and for an administrator its strikes —
  reached from a new account-moderation view and from the report detail (closing a previous-phase
  deferral). A moderator sees warnings only; an administrator sees warnings and strikes.
- **Warning issuance**: a vocabulary-driven reason selector plus a required note, issued from the
  account view and the report detail. Administrators may also revoke a warning or strike.
- **Per-account content**: an account's posts and comments as two tabs of one screen, with the
  remove/restore controls reused from the previous phase and removed content visibly distinguished.
- **The audit log**: one screen serving a moderator (its own actions) and an administrator (all),
  with a detail drawer that fetches an action's metadata on open and links back to the originating
  report.

All of it was browser-verified across two live sessions (moderator + administrator) with 30
screenshots. The user-facing app and the previous phase's report queue/detail still work.

## Architectural decisions, and the option rejected

- **Warn eligibility renders for both roles (option b).** Evidence: a moderator may warn an
  ordinary account (200), and an ineligible target is refused with a specific code
  (`ADMIN_TARGET_NOT_WARNABLE`) the panel surfaces honestly. Rejected: option (a),
  administrator-only, which would strip a capability the moderator actually has.
- **Rendering the violation union branches on the discriminator `kind`**, never on a field's
  presence. The union's shape is not in the OpenAPI (typed `any`); it was enumerated by producing
  records.
- **A new minimal account host** (`/admin/users/:userId`) carries only this phase's surfaces — no
  ban/suspend/role/force-logout/profile. Rejected: putting these on nothing, or waiting for the
  account screen; the surfaces need a shareable home now and the account phase will expand it.
- **The drawer renders metadata by recognising keys, with a generic fallback**, rather than
  switching on action type — so an unenumerated shape renders legibly. The open action lives in a
  URL query param so the list stays mounted and the link is shareable.
- **The reason selector is an in-DOM listbox**, not a native `<select>`, so a disabled vocabulary
  entry is visible and unselectable rather than hidden in an OS popup.

## Contract divergences found (full list in `discipline-contract-verification.md`)

- **The warn endpoint path in the prompt does not exist.** It is
  `POST /admin/warnings/for-user/{userId}`, not `POST /admin/users/{userId}/warn`.
- **A moderator MAY issue a warning** — warn is not administrator-only.
- **A revoked record is removed from the violations list**, not marked revoked. This contradicts
  requirement 5.1.6 (see below).
- **The content row carries no media field** — requirement 7.1.5's media array does not exist.
- **The audit log declares only `actionType` and `adminId` filters** — no date range, no target
  filter.
- The violation union discriminator is `kind ∈ {warning, strike}`; cursors are role-scoped
  (cross-role replay → `INVALID_CURSOR`); a moderator gets 404 on a foreign action's detail; every
  observed action type is in the vocabulary; strikes auto-issue every third warning.

## Controls deferred, and why

- **Ban, unban, suspend, unsuspend, role change, force logout** — out of scope; belong to the
  account phase, which will add them to the account host built here.
- **The `adminId` audit filter** renders no control this phase — selecting an actor needs a user
  picker that the account phase's search provides. Recorded, not faked.
- **Strike issuance has no direct control** — strikes are auto-issued by the backend on the third
  warning; there is no issue-strike endpoint.

## Open questions for a human before the next phase

1. **The revoked-record divergence (requirement 5.1.6 / DoD 9).** The backend removes a revoked
   record from the violations list; the panel cannot show a revoked-but-visible record without
   fabricating data. The revocation is preserved in the action log instead.
   Options: **(a, recommended)** accept the server behaviour — the record leaves the discipline
   list and remains auditable in the action log; **(b)** request a backend change to return revoked
   records with a `revokedAt`/`revokedBy` so the discipline list can mark them in place. Recommend
   (a) while the backend is frozen; raise (b) as a backend ticket if in-place marking is required.
2. **The account host's scope.** `/admin/users/:userId` is intentionally minimal. Confirm the
   account phase should expand this same route with the lifecycle controls rather than build a
   separate account-detail screen.

## What could not be verified

- **A revoked record shown as still-present and marked revoked** — impossible without fabricating
  data the backend never returns (divergence above), so the honest outcome (the record leaves; the
  revocation lives in the action log) was verified instead.
- **The `{resultingStatus, strippedHashtags}` and an unknown metadata shape** were exercised by
  response interception, because the reset seed has no banned-hashtag post and the backend never
  emits an unknown shape. The interception tested the exact drawer renderer.

Nothing above is a check the available tooling could in fact have run. Reduced motion — the
previous phase's could-not-verify item — was fully verified this phase and removed from that
phase's brief.
