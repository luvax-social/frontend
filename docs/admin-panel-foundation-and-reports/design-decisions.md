# Design Decisions

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

Every decision this phase was asked to state, the derived patterns and the tokens they were built from, the error classification, and the copy convention.

## Role in the session

### Where the role lives

The role lives as a dedicated `role` field on the existing `useAuthStore`, in memory only, never persisted.
The alternative considered was deriving it on demand from the persisted `user.role`.
That was rejected because the settled position requires the routing role to be a server fact restored from the boot refresh, not a value read back from browser storage, and because the persisted `user` is the optimistic display shell rather than an authorization source.
The dedicated field is the single normalisation point: it is set from the login and refresh `user.role`, lowercased once at capture, so nothing downstream reasons about casing.

To keep the requirement literal, the `role` is also stripped from the `user` object before it is persisted (`stripPersistedRole` in `useAuthStore.js`), so no role value reaches `localStorage` at all.
This is safe because a workspace-wide search found no reader of `user.role` anywhere in the existing application (`grep -n "\.role" src`, zero matches), so the persisted role was already vestigial.

### How the boot sequence gates the first routing decision

The existing `AuthSessionBootstrap` runs a refresh on mount and holds `isBootstrapping` true until it resolves.
`ProtectedRoute` already shows the full-page loader while `isBootstrapping`, and the panel's `AdminRouteGuard` repeats that check, so the first panel render never happens against a role that is about to change.
The user sees the existing `PageLoader` during the gate, then the correct role tree, with no moderator-to-administrator flicker.
This was verified by reloading the page as an administrator and confirming the escalated navigation item is present on the first paint (see `verification-evidence.md`).

### What happens when the boot refresh fails

The boot refresh already distinguishes a 401 from a network fault.
On a 401 it clears the session; on a network fault it leaves the persisted marker alone and retries on the next load, and `ProtectedRoute` gates on a live in-memory access token so nothing is treated as signed in meanwhile.
This phase did not change that behaviour, so the user-facing application's boot behaviour is unchanged.
The one extension is that the interceptor-driven refresh now also repopulates `role` from the refresh response's `user` (previously `setTokens` dropped it), which only adds correctness and changes no existing path.

## Two route trees

The panel is a single route subtree registered in the central router (`routes/index.jsx`), lazily loaded, gated inside the existing authentication guard.
`AdminRouteGuard` gates panel access on a panel role and redirects an ordinary user to the application; `AdminOnlyRoute` gates the administrator-only branch and renders a full-page "not available" for a moderator so the screen behind it never mounts.

An authenticated ordinary user who reaches `/admin` is redirected to `/app`.
The reasoning: a user has a working surface in the application and no business in the panel, so sending them there beats a dead "not available" page.

Adding a later section does not require restructuring because the tree is data-driven in two places that a new section extends rather than rewrites.
The navigation is one declaration (`NAV_SECTIONS` in `AdminShell.jsx`) filtered by role, so a new item is one entry.
The routes are one array of children under the shell layout route (`adminRoutes.jsx`), so a new screen is one child plus, if administrator-only, wrapping it in the existing `AdminOnlyRoute`.

## Shared request contract

`pickParams(filters, declaredKeys)` reduces a filter object to only an endpoint's declared query keys, dropping undefined, null, and blank values.
Every list call passes its own declared-key list, applied even on the report endpoints that do not enforce it, so the defensive habit holds everywhere.
Request bodies are built with `buildBody`, which drops only undefined keys, from an explicit field map written out at each call site in `adminApi.js`; no form state is ever spread into a body.

## Cursor pagination

Termination is on `pageInfo.hasNextPage` being false (`getNextPageParam`), never on an empty page or a null cursor.
The query key includes the endpoint, the caller's role, and every filter value (`listQueryKey`), so changing a filter or role starts a fresh sequence.
The role is in the key because this phase discovered the report queue returns a different result set to a moderator than to an administrator (see the divergence note below), so it is a concrete instance of the role-scoped-cursor rule, not only the violations endpoint.
An `INVALID_CURSOR` is classified as silent and never surfaced; in practice it is prevented by keying on filters and role.
No numbered pagination exists anywhere, because no list endpoint returns a total.

## Error handling

Errors branch on the envelope `code`, read from `error.response.data.code`, which the shared interceptor preserves even though it rewrites `error.message`.
The classification is the mapping below (`describeError` in `lib/errors.js`).

| Code | HTTP | Kind | Panel behaviour |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | field | map `data` onto per-field errors; an unknown key is ignored |
| `BAD_REQUEST` | 400 | toast | the message is specific and actionable; surface it |
| `MALFORMED_REQUEST_BODY` | 400 | toast | a client bug; generic message |
| `INVALID_CURSOR` | 400 | silent | discard the cursor and restart from the first page |
| `TOO_MANY_REQUESTS` | 429 | toast | read `Retry-After`; never auto-retry |
| `FORBIDDEN` | 403 | page | unreachable if guards are right; full-page state |
| `USER_NOT_FOUND`, `REPORT_NOT_FOUND`, `ADMIN_ACTION_NOT_FOUND`, `POST_NOT_FOUND`, `COMMENT_NOT_FOUND` | 404 | page | full-page not-found |
| `REPORT_INVALID_TRANSITION`, `ADMIN_INVALID_TRANSITION` | 409 | toast (conflict) | calm message, then refetch the entity |
| anything else | any | toast | generic safe message |

TanStack Query retries are set to exclude 429 and `INVALID_CURSOR` (`panelQueryRetry`), overriding the application's global `retry: 1`, so a rate-limited or stale-cursor request never turns into a burst.
Mutations do not auto-retry at all.

## Vocabularies

Fetched once per session after authentication, cached with a one-hour stale time (`useVocabularies`).
The lookup map is built from the full list including disabled entries, so a historical record whose reason has since been disabled still renders its display name rather than a raw key.
This was verified by disabling `spam` in the database and confirming an existing spam report still renders "Spam".

Report statuses (`pending, reviewing, resolved, dismissed, escalated`) and report types (`post, comment, user, story, message`) are hardcoded as fixed sets in `lib/reportSchema.js`.
They come from the API schema, not the vocabulary endpoint: they are the PostgreSQL `report_status` enum (migration V64 added `escalated`) and the `report_type` enum.
A human does not configure them and they carry no display metadata, so they are the correct thing to hardcode; reason values, which a human picks and which carry display labels, always come from the vocabulary.

A vocabulary-driven selector does not exist in this phase (the reason on every action is free text, and the warning reason selector belongs to the next phase), so the "disabled entry unselectable in a selector" behaviour has no surface here.
The `FilterBar` already renders a disabled option as unavailable and unselectable for when a later selector needs it.

## Identifier resolution

`GET /api/v1/admin/content/user/{userId}` is the per-id resolution, reachable by a moderator, cached by user id with an infinite stale time (`useResolveUsername`).

> **Superseded by `docs/admin-panel-backend-capability-uptake/` (backend capability uptake).** The per-id mechanism is **gone**. `GET /api/v1/admin/user-summaries?ids=` resolves up to a hundred ids in one request and is reachable by a moderator. A page of twenty audit rows referencing five distinct people went from five requests to one.

A fully scrolled list of a hundred rows produces at most one request per distinct user id referenced, deduplicated by React Query, and never per row.
In the report queue a page is twenty rows, so a page resolves at most twenty distinct reporters; five pages to a hundred rows resolve at most a hundred distinct people across five user-initiated "load more" actions, well within the production budget of 300 requests per minute on `/api/v1/admin/**`.
In practice reporters repeat, so the real count is far lower; the test page of twenty rows referencing three distinct reporters produced exactly three requests.
While a name is unresolved the row shows the shortened id, which is honest and stable, never a placeholder name.

## Derived patterns

The design export defines no administrative screen, so every pattern below is derived work, built from the existing tokens and primitives.

### Record table (derived)

Built from the border, ink, and surface token scales and the mono type role for the header, plus the density row padding.
No table primitive existed; the closest existing pattern was the feed's infinite list.
It expresses all four list states itself, so every list shows the same populated, empty, loading, and failed states.
Wide content scrolls inside the table's own `overflow-x` container so the page body never scrolls sideways.

### Filter bar (derived)

Built from `LxTag` in its active state, which is a ready-made filter chip, plus the funnel icon added to the icon set.
Changing a filter resets pagination through the query key.
A clear affordance appears when any filter is set away from its default.

**The report queue's status filter options are derived from the observed role-scoped result set, and differ by role.**
`GET /api/v1/reports` was found, during contract verification, to return a moderator only `pending` and `reviewing` reports; `resolved`, `dismissed`, and `escalated` always return an empty page for a moderator, confirmed again in this delta by escalating a report as a moderator and finding no status filter, including `escalated` itself, ever surfaces it.
A filter option that is provably incapable of returning a row is not an honest empty state, it is noise, and `escalated` is the worst instance because a moderator who just escalated a report will look for it there first and always find nothing.
The moderator's status filter therefore offers exactly `pending` and `reviewing` (`MODERATOR_REPORT_STATUSES` in `lib/reportSchema.js`); the administrator's offers the full five-value `REPORT_STATUSES` set, since an administrator's list is not scoped.
This was not an open design question; it follows directly from the contract verification and is implemented in `ReportQueueScreen.jsx`, gated on `isAdminRole(role)`.
Verified in the browser in both sessions (`verification-evidence.md` checks 36 and 37).

### Status indicator (derived)

Built from the four semantic colour tokens (`success`, `warning`, `error`, `accent`, each with a `-dim` background and a `-text` foreground) plus a neutral tone from the surface and ink-3 scale.
One visual vocabulary serves report, account, hashtag, and post status by encoding lifecycle position rather than domain: a positive tone for healthy live states (`active`, `published`, `resolved`), a caution tone for in-progress or waiting states (`pending`, `reviewing`, `draft`, `archived`, `suspended`), a critical tone for taken-out-of-service states (`banned`, `removed`, `deactivated`), an attention tone for `escalated`, and a deliberately understated neutral tone for `dismissed`.
The open call the reconnaissance flagged, whether `escalated` and `dismissed` share a tone, is resolved by separating them: `escalated` is an open state awaiting a higher decision and gets the attention tone, while `dismissed` is a benign closure with no action taken and gets neutral, so a red "strong-negative" tone is never applied to a report that was found harmless.
An unknown status falls back to neutral rather than throwing.
This required exposing the warning tokens in the `v` shorthand, which existed in CSS but were absent from the JavaScript object.

### Confirmation dialogue with a mandatory reason (derived)

Built as a dedicated component (`ReasonConfirmDialog`) rather than by extending the shared `ConfirmModal`, and it deliberately mirrors that modal's vocabulary so the product keeps one confirmation language: the same 500 millisecond arming delay, the same cancel-then-confirm button pair, and the destructive confirm colour.
`ConfirmModal` has no reason concept and no way to hand a submitted value back to its caller, so threading a required textarea and its value through the modal's `message` node would fork its behaviour anyway; a dedicated component that quotes the arming delay and button shape adds the reason affordance without a second visual vocabulary.
It is portalled to the document body so a scrolling ancestor cannot clip it, closes on Escape, and holds its confirm inert during the arming delay and while a mutation is in flight.
The confirm is not disabled on an empty reason, so an empty submit produces a field-level message rather than a generic toast.
`CHAR_LIMITS.reportDescription`, already 2000, is the limit.

### Load-more affordance (derived)

Built from the existing `LxBtn`, driven by `hasNextPage`, rendering nothing once it is false.
An explicit button was chosen over an auto-loading sentinel because a dense moderation table reads better when the reviewer chooses to extend it.

### The four list states (derived)

Populated is the caller's own content; empty, loading, and failed are the derived `EmptyState`, `LoadingState`, and `FailedState` in `ListStates.jsx`, built from the surface, ink, and error token scales and the icon set.
The same four are used everywhere a list renders.

## Copy convention

The convention derived for the panel's surfaces is lowercase for controls, inline labels, and section headings, with uppercase reserved for the small mono eyebrows on field labels, table headers, and status badges.
The evidence is the existing `ConfirmModal`, whose destructive-confirm buttons read `cancel` and `confirm` in lowercase, and the dashboard eyebrow in `index.css`, which uses uppercase with wide letter-spacing in the mono font.
Empty states are worded as the healthy steady state where they are one: the report queue's empty state reads "the queue is clear" rather than as a failure.

## Contract divergences that shaped the design

Two behaviours found during verification (see `report-contract-verification.md`) shaped the build.
The report queue returns a role-scoped result set, a moderator seeing only pending and reviewing reports, which is why the queue query key includes the role and why the escalated queue is genuinely administrator-only at the data layer rather than only by guard.
A moderator receives 404 on a resolved or dismissed report, which is why the report detail screen renders a 404 as a calm not-found, and it is what makes the two-window conflict resolve to a calm message rather than an error.
