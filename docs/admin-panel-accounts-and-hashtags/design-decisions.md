# Design Decisions — Accounts and Hashtags

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

Every derived pattern reused here is labelled derived; the new decisions this phase settles follow.

## Reused derived patterns (from prior phases, unchanged)

- **The request-contract sanitiser** (`lib/requestContract.js`, derived): `pickParams` keeps only an
  endpoint's declared query keys; `buildBody` assembles a body field by field. Every new list call
  passes its own declared-key list (`USERS_QUERY_KEYS`, `USER_SEARCH_QUERY_KEYS`,
  `HASHTAGS_QUERY_KEYS`, `HASHTAG_SEARCH_QUERY_KEYS`) and every new mutation builds its body by hand.
- **Cursor pagination** (`lib/pagination.js`, derived): `getNextPageParam` terminates on
  `hasNextPage`; `listQueryKey` scopes a sequence by role and filters; `panelQueryRetry` never
  retries a 429 or a stale cursor. Reused verbatim by the account and hashtag lists.
- **Error classification** (`lib/errors.js`, derived): branch on the envelope `code`, never the
  message. Extended (see below).
- **The vocabulary cache** (`useVocabularies`, derived) and **identifier resolution**
  (`useResolveUsername`, derived): reused as-is; the audit actor chip resolves the actor's username
  through the latter.
- **The shell, the framed card, the record table, the four list states, the load-more, the local
  time, the filter bar, the status badge, and the not-available page** (derived): every new screen
  is built from these. The account list and hashtag registry are `RecordTable` + `FilterBar` +
  `LoadMore`; the state summary uses `StatusBadge` and `LocalTime`.
- **The reason-carrying confirmation** (`ReasonConfirmDialog`, derived) and **the reason selector**
  (`ReasonSelect`, derived): ban, unban, unsuspend, force logout, and every hashtag status action go
  through `ReasonConfirmDialog`; the warn flow keeps `ReasonSelect`.

## New derived patterns (this phase)

- **The debounced-search controller** (`useDebouncedSearch`, derived from the panel's list
  discipline): one hook enforces the debounce, the minimum length, the blank/whitespace guard, and
  the rate-limit cooldown for both account search and the audit actor picker. It blanks the term
  while cooling so no request fires, and never auto-retries.
- **The account search picker** (`AccountSearchPicker`, derived from `ReasonSelect`'s in-DOM listbox
  and the debounced controller): a shared, deliberate picker used by the audit actor filter and
  available to the list.
- **The lifecycle dialogs** (`SuspendDialog`, `RoleChangeDialog`, `HashtagCreateDialog`, derived):
  each quotes the shared confirmation shape — the 500ms arming delay, the portalled overlay,
  Escape-to-close, the cancel-then-confirm pair — rather than extending `ReasonConfirmDialog`,
  because each carries fields that dialog has no slot for (a duration, a role choice, a name and
  status). This is the same decision the previous phase recorded for `WarnDialog`: quote the
  vocabulary, do not fork the base component.

## The capabilities-driven control strategy

**The server decides which controls are legal; the client renders what the capabilities permit and
computes nothing about permission.** The account detail (`GET /admin/users/{id}`, administrator only)
carries a `capabilities` object with three coarse fields — `canChangeStatus`, `canChangeRole`,
`assignableRoles[]` — and no per-action flag.

- **Status controls** gate on `canChangeStatus`. Which transition to offer is *not* in capabilities,
  so it is derived from the current `status` against the verified state machine (active → suspend,
  ban; suspended → unsuspend, ban; banned → unban). This is the minimum derivation the coarse
  capabilities force; it is documented, matches the backend state machine so a rendered control does
  not 409, and a genuine race is caught as a conflict and refetched rather than pre-computed.
- **Role controls** come entirely from `assignableRoles`; the panel offers exactly those roles and
  no more. Nothing is inferred from the target's current role beyond labelling the transition.
- **Force logout** is not represented in capabilities. It is administrator-only and always permitted
  by the server, so it renders whenever the administrator-only detail is available — the one control
  outside the capabilities object, documented as such.
- **Capabilities are unavailable → no lifecycle control renders.** A moderator's 403 on the detail,
  or any non-success state, yields null capabilities and no control. The account moderation screen
  gates the entire "state & actions" card on the administrator role for the same reason, so a
  moderator never sees an empty control card.
- **After any action, the detail (and its capabilities) is refetched before the controls re-render.**
  No action response carries capabilities, so the mutation awaits the detail refetch in `onSuccess`.

## The self-targeting rules

The backend (`AdminAuthorizationServiceImpl`, read from source) refuses self-targeting and
administrator-targeting through the capabilities object: for the caller's own account, and for any
administrator, `canChangeStatus` and `canChangeRole` are false and `assignableRoles` is empty.

- **Where the server refuses a self-targeting action, no control renders for the caller's own
  account** — this falls out of the all-false capabilities, computed by nobody.
- **Force logout is the one self-permitted action** (it is not capability-gated). It renders for the
  caller's own account, and its confirmation states the consequence plainly: it ends every session
  including the current one and signs the reviewer out immediately.

## The one-way door (promotion to administrator)

`moderator → admin` is the only route to administrator, and an administrator can never be demoted
(`TARGET_IS_ADMIN`), so promotion is irreversible through the API. The role dialog surfaces exactly
what `assignableRoles` permits; when `admin` is among them it is visibly distinguished (its own
tone, a "one-way — cannot be undone" label), selecting it raises an irreversibility banner and
switches the confirm to the destructive tone, and the confirm is not pre-armed (the 500ms arming
delay applies). This action was never performed during verification.

## Suspension

The server accepts `durationDays` (1..3650), not an end time. The dialog collects days, bounds them
before submission, and shows the resulting end time (`now + durationDays`) in the reviewer's local
timezone before they confirm. An already-suspended account shows its `suspendedUntil` in local time.

## Force logout (settled)

Force logout revokes all refresh tokens and advances the token epoch, so both the refresh path and
every already-issued access token die at once — verified live (the target's old access token → 401,
refresh → 401). This settles the previous phase's open question; the confirmation wording states
that consequence, and the self variant states that it signs the reviewer out.

## Warning count

The active warning count is available only on the warn *response* (`activeWarningCount`), not on any
read. So the pre-issue count is not shown (recorded in `deferred-findings.md`); the honest post-issue
count is surfaced in the success feedback. The static "three active warnings issue a strike" rule
stays stated in the warn dialog.

## Error classification extension

The account and hashtag lifecycle 409s (`ADMIN_INVALID_TRANSITION`,
`ADMIN_ROLE_TRANSITION_NOT_ALLOWED`, `ADMIN_SELF_ACTION_NOT_ALLOWED`, `ADMIN_TARGET_PROTECTED`) join
the shared conflict set: capabilities normally prevent an ineligible control from rendering, so one
of these arriving means the target's state changed under the reviewer (a race), and the honest
response is a calm message plus a detail refetch, not an alarm. The hashtag duplicate
(`HASHTAG_ALREADY_EXISTS`) is handled at the create form so it shows against the name input.

## Rate-limit discipline

Built to the documented **production** budget of 40/min for the admin search endpoints (the prompt's
"60/min" is the dev figure). Search is debounced, gated to the endpoint's minimum length (2 for
accounts, 1 for hashtags), never fires on a blank or whitespace query, and on a 429 disables the
control for the returned `Retry-After` seconds with an explanation, never auto-retrying.
