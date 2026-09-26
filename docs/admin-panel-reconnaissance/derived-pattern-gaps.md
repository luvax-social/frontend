# Derived Pattern Gaps

> Record of work done on 2026-08-21. Not maintained; it is correct as of that date and is not updated as the code moves.

Work Item 7.
The design export defines no administrative screen, so the panel is derived work.
For each pattern: the existing token or primitive it would be built from, and the decision that remains open.
No design is proposed here.
Motion and spacing sufficiency is called out per pattern; the base scales are in `design-inventory.md`.

## 1. Record table or list-of-records

Raw material: no table primitive exists.
The closest existing pattern is the infinite list used by `FeedScreen.jsx` and driven by `useDrainEmptyPages`, plus `LxDivider` for row separation, `LxTag` for inline status, `LxAvatar` for the actor or subject, and the `--lx-row-pad` density token.
Open decision: whether a moderation record set is a true multi-column table (columns for id, type, status, date, actions) or a stacked row-card list like the feed.
The report list carries only ids, not names (section 9.2), so a table needs a decision on whether to resolve each id to a username per row (allowed, but rate-limited) or render ids.
Motion and spacing: the spacing scale is sufficient; there is no row-level enter animation and none is needed beyond `lx-fade-in`.

## 2. Filter bar over a record set

Raw material: `LxTag` in its `active` state is a ready-made filter chip; the enums are small and fixed (report status has 5 values, report type 5, account status 4, hashtag status 3, role 3).
Open decision: chip row versus a select control, and whether filters are reflected in the URL (the app already routes every screen and reads query params such as `?q=` and `?type=`, so filters could live in the query string and survive reload).
The hard constraint from section 5.3.1: filters must be serialised to only the endpoint's declared parameter keys, because `/api/v1/admin/**` rejects any undeclared query parameter with 400.
Motion and spacing: sufficient; chips already have hover and active transitions.

## 3. Status indicator across four domains

Raw material: `LxTag` plus the semantic colour tokens, which already cover a four-state vocabulary: `--lx-success` (and text/dim), `--lx-warning`, `--lx-error`, `--lx-accent`, and a neutral built from `--lx-ink-3` / `--lx-surface`.
The states to represent: report status (`pending, reviewing, resolved, dismissed, escalated`), account status (`active, suspended, deactivated, banned`), hashtag status (`active, banned, deleted`), post status (`draft, published, archived, removed`).
Open decision: whether one visual vocabulary serves all four or whether they differ.
One vocabulary can serve all four if mapped by severity rather than by domain: a neutral/positive tone for `active`/`published`/`resolved`, a caution tone for `pending`/`reviewing`/`draft`/`archived`, and a strong-negative tone for `banned`/`removed`/`suspended`/`deactivated`/`dismissed`/`escalated`.
The open call is whether `escalated` and `dismissed` (both terminal-ish but opposite in meaning) should share a tone, which is a product decision, not a technical one.
Blocker to note: `--lx-warning` is not exposed in the `v` object (design-inventory 6.6), so it must be added before a warning tone can be used from JS.
Motion and spacing: sufficient.

## 4. Confirmation dialogue with a required 2000-character reason

Raw material: `ConfirmModal` already provides the destructive-confirm shape with a 500 ms arming delay, a `v.error` confirm button, and a `message` slot that accepts a node.
`CHAR_LIMITS.reportDescription` is already 2000, matching the backend reason limit.
Open decision: whether to extend `ConfirmModal` with a required textarea (and wire the arming delay plus a non-empty and within-limit check into `confirmDisabled`), or build a dedicated reason-confirm on top of `LxModal`.
Every destructive action in this panel (ban, suspend, remove, restore, resolve, dismiss, escalate, warn, delete hashtag, revoke) sends a `reason` (or `note`) capped at 2000, so this pattern is used everywhere and should be decided once.
Motion and spacing: sufficient; `ConfirmModal` already animates.

## 5. Detail drawer or expandable row

Raw material: `LxBottomSheet` (mobile) and `LxModal` (desktop) are both present; the app already routes detail screens (`/app/p/:postId`), so a routed detail panel is also viable.
The need is real because audit `metadata` is only available on the per-row fetch `GET /api/v1/admin/actions/{id}` (section 5.4.4), so opening a row must trigger a fetch.
Open decision: drawer versus expandable-in-place versus a routed detail URL, and where the per-row `metadata` fetch is triggered (on expand, cached by row id).
Motion and spacing: `lx-sheet-in` and `lx-overlay-in` cover the entry; sufficient.

## 6. Load-more affordance

Raw material: the existing infinite-scroll sentinel (`react-intersection-observer` `inView` plus `fetchNextPage`) used across the feed, and the correct termination on `pageInfo.hasNextPage` via `useDrainEmptyPages`.
No list endpoint returns a total, so numbered pagination is impossible (confirmed in section 5.4.4 and handoff 13.7).
Open decision: an auto-loading sentinel (as the feed does) versus an explicit "load more" button.
For a dense moderation table an explicit button is often preferable to auto-load, but the raw material supports either.
Motion and spacing: sufficient.

## 7. Date-range control clamped to 30 days

Raw material: none.
There is no date-picker primitive in the codebase.
The constraint is hard: `GET /api/v1/admin/user-events` requires `from` and `to` and rejects a window over 30 days (section 5.7), and `GET /api/v1/admin/stats/timeseries` rejects `half_hour` granularity over a window older than 30 days.
Open decision: build a minimal from/to control that clamps its own span to 30 days and, for the timeseries, forces `granularity=day` when the range start is more than 30 days ago, versus adopting a dependency (which conflicts with the settled no-new-UI-dependency position, so it would have to be built from native inputs).
This is the single pattern with no existing raw material and the one most likely to need net-new work.
Motion and spacing: not applicable; this is an input, not an animated surface.

## 8. Section-based navigation, two trees by role

Raw material: the routing already supports nested screens under a shell with per-route `handle: { screen, chrome, rightRail }` metadata read back by the shell (`routes/index.jsx`, `appScreens.jsx`), and `LxDropdownMenu` plus the sidebar chrome in `shell.jsx` exist.
The navigation must render two entirely different trees by role: the moderator tree (report queue, report detail, post and comment moderation, warning issuance, violations, my action log) and the administrator tree (all of the moderator surfaces plus escalated queue, full action log, user list and detail, hashtag registry, statistics, activity log).
Open decision: whether the panel is a new top-level route subtree (for example `/admin/*`) or nested under `/app`, and how the role gate is expressed, given that `ProtectedRoute` is not role-aware and the auth store has no dedicated `role` field (only `user.role`).
A role-aware guard and a role-selected nav tree are both net-new; the route-metadata pattern and the guard shape to copy already exist.
Motion and spacing: sufficient; navigation reuses existing chrome transitions.

## The scales, overall

The spacing, radius, and motion scales are sufficient for every pattern above except the date-range control, which needs no motion.
The one token gap is `--lx-warning` not being in the `v` object, which pattern 3 needs.
Everything else is a composition decision over primitives and tokens that already exist.
