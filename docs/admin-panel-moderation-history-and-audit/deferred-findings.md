# Deferred Findings

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

Everything noticed and deliberately not acted on, tagged with the phase it belongs to.

## Backend, out of scope (backend is read-only)

- BACKEND: **the warn endpoint path.** The real path is `POST /admin/warnings/for-user/{userId}`;
  the prompt/handoff's `POST /admin/users/{userId}/warn` does not exist. The panel uses the real
  path. Recorded, not a defect.
- BACKEND: **a revoked warning or strike is removed from the violations list**, not returned with a
  revoked marker. The endpoint has no include-revoked parameter. This contradicts requirement
  5.1.6; the panel treats it honestly (the record leaves; the revocation is preserved in the action
  log). If in-place marking is ever required, the backend would need to return revoked records with
  `revokedAt`/`revokedBy`. Recorded as a documentation/product divergence, not a frontend defect.

> **Superseded by `docs/admin-panel-backend-capability-uptake/` (backend capability uptake).** **Delivered.** `GET /admin/violations/for-user/{id}?includeRevoked=true` exists and returns revoked records carrying `revokedAt` and `revokedBy`. The panel now has an *include revoked records* toggle, off by default, and marks a revoked record in place. The cursor is scoped on the flag, so toggling restarts pagination.

- BACKEND: **the per-account content row carries no media field** (posts carry `caption`, comments
  carry `content`; neither carries a media array). Requirement 7.1.5 assumes one. The panel renders

> **Superseded by `docs/admin-panel-backend-capability-uptake/` (backend capability uptake).** **Partly delivered.** `AdminPostSummaryResponse` now carries `mediaUrls` and the panel renders it. Comment rows still carry no media, because comments have no media in this schema — that half is not a gap and is not coming.

  no media because the row has none. Recorded, not a defect.
- BACKEND: **the audit log declares only `actionType` and `adminId` filters** — no date range, no
  target filter. The panel offers only `actionType` (the `adminId` filter needs an account picker).
  Recorded.
- BACKEND: an auto-issued strike's action row carries a null `adminId`; the panel renders it as
  *system*. Recorded, not a defect.

## Deferred to the account phase

- ACCOUNT-PHASE: **ban, unban, suspend, unsuspend, role change, force logout.** Noticed (their
  endpoints and shapes are documented in the backend handoff) and deliberately untouched. They
  belong on the account host built this phase (`/admin/users/:userId`), which the account phase
  should expand rather than replace.
- ACCOUNT-PHASE: **the `adminId` audit filter control.** The endpoint declares it, but selecting an
  actor needs the account search/picker the account phase provides. Rendered as no control this
  phase rather than a filter that cannot be populated.
- ACCOUNT-PHASE: **the account list, account search, and account detail screens** — out of scope,
  noticed, untouched.

## Minor craft refinements (this phase's surfaces)

- CRAFT: **nested Escape.** While the reason listbox is open, pressing Escape closes both the
  listbox and the enclosing warn dialog, because both register a document-level Escape listener.
  This is acceptable (Escape closing a dialog is expected, and the dropdown also closes on selection
  and outside-click), but a future refinement could make Escape close only the innermost overlay.
  Not fixed because it would require threading overlay-stack state through `useEscapeKey`, and the
  current behaviour is not wrong.

## Explicitly not in this phase, noticed and not acted on

Per section 9: the hashtag registry; statistics and the user activity log; the recommendation
module. Their endpoints were confirmed present in the OpenAPI but not consumed.

## Carried from previous phases (still open, not this phase's to fix)

- CLEANUP (a phase allowed to move files): the panel still imports `LxBtn`/`LxTag` from
  `features/luvax/components/primitives.jsx` and `toast`/`ToastHost` from
  `features/luvax/components/Toast.jsx` — cross-feature imports. This phase added more such imports
  because moving files is out of scope. A phase permitted to move files should relocate these shared
  primitives to `src/components/`.
