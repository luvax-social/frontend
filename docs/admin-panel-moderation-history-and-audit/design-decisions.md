# Design Decisions

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

Every decision this phase was asked to state, the derived patterns reused or extended, the tokens
they were built from, and the reasoning. Patterns from the previous phase are reused, not
rebuilt; where one was extended, that is called out.

---

## Reused shared layer (not rebuilt)

The following all existed and were used unchanged: role handling (`useAuthStore.role`,
`isAdminRole`, `ROLES`), the request-contract sanitiser (`pickParams`, `buildBody`), cursor
pagination (`getNextPageParam`, `listQueryKey`, `panelQueryRetry`), error classification
(`describeError`), the vocabulary cache (`useVocabularies`), identifier resolution
(`useResolveUsername`, `ReporterName`, `shortId`), the shell (`AdminShell`, `NAV_SECTIONS`), and
the derived patterns (record table, filter bar, status indicator, reason-carrying confirmation,
load-more, four list states, `LocalTime`, `PanelPage`).

Extended in place:
- **`useVocabularies`** gained `actionKnown(key)` — whether an action type is in the
  moderation-action vocabulary — so the audit log can mark an observed-but-unlisted type. It
  reports "unknown" only after the vocabulary has loaded, so a slow fetch never mislabels a known
  type.
- **`adminApi`** gained the discipline, content, and audit calls (`getViolations`, `warnUser`,
  `revokeWarning`, `revokeStrike`, `getUserPosts`, `getUserComments`, `getActions`, `getAction`),
  each with its declared query-key list; the content remove/restore reuse the existing
  `removePost`/`restorePost`/`removeComment`/`restoreComment`.
- **`AdminShell.NAV_SECTIONS`** gained one entry (`actions`) for both roles.
- **`adminRoutes`** gained two children (`/admin/actions`, `/admin/users/:userId`), neither behind
  the administrator-only guard.
- **`ReportDetailScreen`** gained the account-history region and had its inline restore-message
  logic replaced by the shared `restoreSuccessMessage` helper.
- **`lx-icon`** gained `clock` and `external`, in the existing outline style.

---

## The warn-eligibility decision (Work Item 6.1) — option (b), with evidence

**Chosen: (b) the warn control renders for both roles**, because the backend refuses an ineligible
target with a specific, distinguishable code the panel surfaces honestly.

Evidence (captured in `discipline-contract-verification.md` §4.2.2–4.2.3):
- A moderator calling `POST /admin/warnings/for-user/{ordinaryUser}` returns **200 OK** — a
  moderator may warn an ordinary account.
- Warning a moderator target returns **403 `ADMIN_TARGET_NOT_WARNABLE`** ("Only an ordinary account
  can be warned") — a specific code, not a generic 403.
- A self-action returns **409 `ADMIN_SELF_ACTION_NOT_ALLOWED`**.

**Why (a) was rejected.** Option (a) would render the control for administrators only and defer the
moderator path. But the moderator path is not blocked by the server — a moderator genuinely can
warn ordinary accounts — so gating the control to administrators would remove a capability the
moderator actually has, on the strength of a role check the panel does not even need. The endpoint
that carries the target's role is administrator-only, which was the previous phase's reason to
defer; but with (b) the panel does not need the target's role in advance, because an ineligible
target is refused with a code it can show. The refusal ("only an ordinary account can be warned")
is a controls-render-not-disable outcome: the control appears, and an ineligible target produces an
honest message rather than a silent absence that would leave a moderator wondering why a control it
should have is missing.

This decision required the captured refusal, which is why it was not taken until §4.2 was run.

---

## The reason field uses the report-reason vocabulary, not free text

Contract §4.2.4: the warn endpoint's `reasonKey` is validated against the `reportReasons`
vocabulary — an unrecognised or disabled key returns 422 `WARNING_REASON_DISABLED`. So the reason
is a vocabulary key, not free text, and the selector is vocabulary-driven. The `note` is separate
free text, required and non-blank, bounded to 2000 characters (the endpoint's `@Size`), with the
count visible before the limit is hit.

---

## Rendering the violation union — branch on `kind`

`AdminViolationResponse` is typed `any` in OpenAPI; the shape was enumerated empirically
(§4.1.3). It is a discriminated union on `kind`:
- `warning`: `{ kind, id, userId, actorId, reasonKey, note, createdAt }`
- `strike`: `{ kind, id, userId, actorId, strikeNumber, createdAt }`

`reasonKey`/`note` exist only on the warning branch, `strikeNumber` only on the strike branch.
`ViolationHistory` branches on `record.kind`, never on a field being present, so adding a field to
either branch cannot flip the rendering. A `kind` value that is neither renders a generic row
rather than crashing.

The query key includes the caller's role (`listQueryKey('violations', role, …)`), because the
result set and the cursor are both role-scoped: a moderator sees warnings only, an administrator
sees warnings and strikes, and a cross-role cursor returns `INVALID_CURSOR`. Keying on the role
means the panel never issues a cross-role cursor.

---

## The revoked-record divergence — honest state over fabrication

Requirement 5.1.6 asks for a revoked record to remain visible, marked revoked. Contract §4.1.5
establishes the backend **removes** a revoked warning or strike from the violations list and
exposes no include-revoked parameter. Rendering a revoked-but-visible record would require
inventing data the server never returns, which §2.1 forbids.

Decision: the revoke control (administrator only, behind the shared reason-carrying confirmation)
performs the revocation; on success the history refetches and the record leaves. The revocation is
**not lost** — it is preserved in the action log as a `revoke_warning` / `revoke_strike` action
carrying the reason and metadata, which is this phase's other deliverable. So a revocation remains
auditable, in the audit trail rather than in the discipline list. This divergence is recorded
prominently; DoD item 9's "marked revoked in place" cannot be produced honestly.

---

## The account moderation host (`/admin/users/:userId`) — deliberately minimal

The phase's surfaces (violation history, warn control, per-account content) must be reachable "from
an account context", but the account list, search, and detail screens are explicitly out of scope.
Resolution: a minimal `AccountModerationScreen` at `/admin/users/:userId` that hosts **only** this
phase's surfaces — the discipline history + warn control and the posts/comments content — with **no
ban, suspend, unsuspend, role change, force logout, or profile**. It is reached by URL from a
report's owner (the report-detail region) and from an audit row's target account link, so a
specific account's record is a shareable link. The account phase will expand this host with the
lifecycle controls; this phase deliberately does not.

---

## Metadata rendering strategy (the drawer)

Metadata exists only on `GET /admin/actions/{actionId}`, never on list rows (§4.4.3), so the list
carries no metadata column and opening a row is the only thing that fetches a detail. The metadata
object's shape depends on the action type; six distinct shapes were enumerated (§4.4.5).

The drawer renders metadata by **recognising keys**, not by switching on the action type, so a
known key renders the same wherever it appears:
- `reasonKey` → the reason's display name; `strikeNumber` → the number; `resultingStatus` → the
  status; `consequenceApplied` → yes/no; `triggeredByModeratorId` → a resolved username;
  `strippedHashtags` → `#tag, #tag` (or nothing when empty); `warningIds` → a count.
- **Unknown-shape fallback:** any key not recognised is rendered with a humanized label and its
  value (a nested object as pretty JSON), so an unenumerated shape renders legibly rather than
  blank or broken. A null metadata renders an explicit "no additional detail recorded." rather than
  an empty region.

This was verified against all six shapes and a forced unknown shape (evidence E.6/E.7).

---

## The report route-back (closing the previous phase's gap)

A row whose `reportId` is non-null links to `routeTo.adminReportDetail(reportId)`. `escalate_report`
(and report-originated resolve/dismiss) carry a non-null `reportId`, including on a **moderator's
own** `escalate_report` (§4.4.6). This is the route back the previous phase recorded as missing: a
moderator that escalated a report reaches it from its own action log via this link.

> **Superseded by `docs/admin-panel-backend-capability-uptake/` (backend capability uptake).** This is no longer the route. `GET /api/v1/reports/escalated/mine` exists and is surfaced as the *my escalations* screen, which also shows the outcome a link to one report never did. The drawer no longer links an `escalate_report` row; it points at that screen.


---

## Drawer URL state and portalling

The open action lives in the `action` query parameter (`?action={id}`), not in a nested route, so
the list stays mounted behind the drawer and a specific action is a shareable link. The drawer is
portalled to `document.body` (never clipped by a scrolling ancestor) and closes on Escape via the
shared `useEscapeKey`.

---

## The reason selector — an in-DOM listbox (derived)

Built in the shared layer (`ReasonSelect`) because the warn form needs it now and the account phase
needs it too. First built as a native `<select>`, then rebuilt as an in-DOM listbox: a native
select's open state is an out-of-page OS popup that cannot be screenshotted or styled, and a
disabled `<option>` cannot be shown "unavailable" in a capture. The listbox renders each option
as a `role="option"`; a disabled vocabulary entry is greyed, labelled "unavailable", and
unselectable (`aria-disabled`, no click handler) rather than hidden. Built from the surface, ink,
border, and accent token scales; closes on Escape or an outside click. Options are ordered by the
vocabulary's `sortOrder` (already sorted by `useVocabularies`).

Nested-Escape note: while the listbox is open, Escape closes both the listbox and the enclosing
dialog (both register a document Escape listener). This is acceptable — Escape closing a dialog is
the expected behaviour (DoD 33) and the dropdown also closes on selection and outside-click — and is
recorded in `deferred-findings.md` as a minor refinement.

---

## The warn dialog (derived)

`WarnDialog` quotes the shared reason-confirm dialogue's shape — the same 500 ms arming delay,
portalled overlay, Escape-to-close, and cancel-then-confirm button pair — so the panel keeps one
confirmation vocabulary, but it carries the two fields the warn endpoint requires (a
vocabulary-driven `reasonKey` and a required, bounded `note`) rather than a single free-text reason.
Both fields are required; an empty submit produces a per-field message, not a generic toast. A
server `VALIDATION_ERROR` maps onto the same per-field slots; a key matching no field is ignored.
The confirm is inert during the arming delay and while the request is in flight.

---

## Violation and content record rows (derived)

The violation records and the content rows are stacked cards rather than the record table, because
a warning's note and a post's caption are free text that does not fit tabular columns cleanly; the
audit log, whose rows are uniform, uses the record table. Both express the four list states through
the shared `EmptyState`/`LoadingState`/`FailedState`. The kind badge reuses the semantic tone
tokens: a caution tone (`--lx-warning*`) for a warning, a critical tone (`--lx-error*`) for a
strike. Removed content is dimmed with a strikethrough and a critical "removed" badge; the reviewer
sees at a glance what was already acted on.

---

## Copy convention

Follows the previous phase: lowercase for controls, inline labels, and section headings; uppercase
reserved for the small mono eyebrows on field labels, table headers, and badges. Empty states are
worded as the healthy steady state where they are one ("clean record", "no posts").
