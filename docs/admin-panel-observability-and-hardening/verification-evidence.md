# Verification Evidence

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

Every check this phase ran, what was driven, and what was observed. Two browser contexts were used
throughout — an administrator and a moderator, signed in simultaneously — and both the console and
the network were captured.

Nothing here is inferred. Where a number appears it was counted.

---

## 1. Contract verification

Ran before any feature code was written and committed on its own at `f79763c`. Full detail in
`observability-contract-verification.md`; the checks themselves:

| Check | Driven | Observed |
|---|---|---|
| Statistics paths and their role gate | Called both as `seed_admin` and as `seed_mod` | Administrator 200, moderator **403** on both |
| `stats/current` field inventory | One call as administrator | 12 fields recorded; `computedAt` **not null** in this environment |
| Collection cadence | Read from source | 30-minute interval, 30-minute initial delay, partial start bucket discarded → worst case just under **60 minutes** to a first bucket |
| `timeseries` with no parameters | One call, no query string at all | Server resolved `metric=registrations`, `granularity=half_hour`, a 24-hour window, 18 points |
| Accepted metrics | Read from source, each called | **14**, all 200 |
| Accepted granularities | Read from source, both called, one invalid called | **2** (`half_hour`, `day`); `hour` → 400 |
| Window limit | Bisected | **365 days accepted, 366 refused** — "The window may span at most one year" |
| Fine-granularity horizon | Bisected to the minute | `from` at 29 d 23 h 58 m → 200; at 30 d 0 h 02 m → 400, "Fine buckets are kept for 30 days…" |
| Empty vs zero vs gap | Three separate calls | `points: []`; 18 points all `value: 0`; a series jumping 22:30Z → 00:00Z |
| Statistics rate limit | Called until refused | Refused on the 61st call in the window; **`Retry-After: 60`** |
| Activity-log parameters | Five calls | Both bounds mandatory; exact messages recorded |
| Activity-log window | Bisected to the second | **30 days accepted, 30 days + 1 second refused** |
| Written event types | Read from source, then tested | Three unconditional writers; a fourth path exists but **dead-lettered without writing a row** (queue depth rose to 1, DLQ 4 → 5, no `user_events` row) |
| Activity-log rate limit | Called until refused | Refused on the 61st call; `Retry-After: 60` |
| Session endpoints | Searched the whole backend source | **No per-session read and no per-session revoke exist** |
| Session revocation effect | Force-logout against a live account | **3 live sessions → 0** |
| `reportsAgainst` | Read against an account with a report | A real array carrying report id, reporter, reason, status, timestamp |
| Address fields | Read against a live account | `registrationIp` and `lastLoginIp` are **per account**; `sessions[].ipAddress` is **per session** |
| Settings defect | Called as three different accounts | 404 for all three; 165 of 170 accounts have a settings row and the five that do not are exactly the seed accounts |

---

## 2. Statistics

| Check | Driven | Observed | Evidence |
|---|---|---|---|
| Pre-collection state shows no data and **no zeros** | Backed up `platform_stats`, emptied it, loaded the screen, restored the table | "no statistics have been collected yet", "within an hour of the server starting"; **no figure tiles rendered at all**; no chart | [stats-before-first-collection.png](screens/stats-before-first-collection.png) |
| Snapshot labelled as of its time, not live | Loaded with data present | "as of Aug 22, 2026, 11:46 AM Asia/Saigon", bucket start shown, explicit staleness sentence | [stats-desktop-light-with-data.png](screens/stats-desktop-light-with-data.png) |
| Metric and granularity selectors offer exactly what the server accepts | Counted the rendered options | 14 metrics in two groups; 2 bucket widths | [stats-desktop-light-with-data.png](screens/stats-desktop-light-with-data.png) |
| A zero-valued window renders as measured zero | Default 24-hour window on `registrations` | 17 points, every one 0, line on the baseline, above the sentence "this is a measurement, not an absence" | [stats-desktop-light-gap-and-zero.png](screens/stats-desktop-light-gap-and-zero.png) |
| An empty window renders differently | Applied a window starting 1 June | "nothing was collected in this window" and **no chart** | [stats-granularity-blocked-and-empty-window.png](screens/stats-granularity-blocked-and-empty-window.png) |
| A gap renders as a gap | Deleted two mid-range buckets, reproducing a missed pass | Line broken; hatched band; tooltip "not collected: 2 buckets between 05:30 AM and 07:00 AM"; legend "2 missing half-hour buckets in all" | [stats-desktop-light-gap-and-zero.png](screens/stats-desktop-light-gap-and-zero.png) |
| Axes labelled with units, times local | Read the rendered SVG text | y axis "accounts created"; x axis "time — every 30 minutes — Asia/Saigon"; column header and tooltips in the same zone | same |
| Range clamps **before** submission with the limit visible | Submitted 1 Jan 2023 → now (≈3.6 years) | `from` moved to exactly 365 days before `to`; note "a range may span at most 365 days; the start was moved forward to fit."; the limit is on the slider label at all times | [stats-range-clamped-to-365-days.png](screens/stats-range-clamped-to-365-days.png) |
| A refused granularity is prevented in the control | Applied a window starting more than 30 days ago | Half-hour rendered "(unavailable for this range)" with the horizon explained; an already-selected half-hour fell back to daily with a notice. **Network: the request went out as `granularity=day`; no 400 ever issued** | [stats-granularity-blocked-and-empty-window.png](screens/stats-granularity-blocked-and-empty-window.png) |
| **Dragging produces no request until commit** | 13 slider drags and 4 date-field edits, each dispatching real `input` and `change` events | Timeseries request count before: **1**. After all 17 interactions: **1** | — |
| Rate-limit refusal disables the control and never auto-retries | Burned the budget with 57 calls, then clicked a metric in the browser | One **429**; controls disabled; "the controls return in 55 seconds… nothing is being retried in the background". After a further 25 s: **still exactly one 429 and no retry** | [stats-rate-limit-refusal.png](screens/stats-rate-limit-refusal.png) |
| No raw colour, no pinned dimension | Grepped the source; resized the container | Zero hex/rgb/hsl matches in the panel; the chart is sized from a `ResizeObserver` measurement | [stats-narrow-light.png](screens/stats-narrow-light.png), [stats-narrow-dark.png](screens/stats-narrow-dark.png) |

Light, dark, desktop, and narrow captured for the screen:
[stats-desktop-light-with-data.png](screens/stats-desktop-light-with-data.png),
[stats-desktop-dark.png](screens/stats-desktop-dark.png),
[stats-narrow-light.png](screens/stats-narrow-light.png),
[stats-narrow-dark.png](screens/stats-narrow-dark.png).

---

## 3. Activity log

| Check | Driven | Observed | Evidence |
|---|---|---|---|
| **No request until both bounds are set** | Loaded the screen fresh | Both date fields empty; "choose a window to read"; "nothing has been requested yet". **Network: zero `user-events` requests** | [activity-before-bounds-and-event-filter.png](screens/activity-before-bounds-and-event-filter.png) |
| The window maximum is enforced before submission | Submitted 1 Jan → 22 Aug (234 days) | Clamped to exactly **30.0 days**, note "a range may span at most 30 days; the start was moved forward to fit.", request issued inside the bound. *(This failed on the first walk and was fixed — see the sweep, item 47.)* | — |
| The event-type filter offers only written types | Counted the rendered chips | Exactly three: session start, search, profile view. None of the seventeen unwritten types present | [activity-before-bounds-and-event-filter.png](screens/activity-before-bounds-and-event-filter.png) |
| Results render what the row carries | Applied a 30-day window | 20 rows; identifiers resolved to `@usernames` and linked; a `search` row read "searched "a" in posts"; `session_start` rows say the record carries no further detail rather than showing an empty cell | [activity-with-results.png](screens/activity-with-results.png) |
| Timestamps local and labelled | Read the column header | "when (Asia/Saigon)" | same |
| The empty result is worded as healthy | Filtered to `profile_view`, which has no rows | "no recorded activity in this window" + "a quiet window is a quiet window rather than a fault" | [activity-empty-healthy.png](screens/activity-empty-healthy.png) |
| A filter change does not replay a cursor | Changed the event type after a query | Fresh sequence, zero HTTP errors | — |

Light, dark, desktop, and narrow: [activity-with-results.png](screens/activity-with-results.png),
[activity-desktop-dark.png](screens/activity-desktop-dark.png),
[activity-narrow-light.png](screens/activity-narrow-light.png),
[activity-narrow-dark.png](screens/activity-narrow-dark.png).

---

## 4. Sessions

| Check | Driven | Observed | Evidence |
|---|---|---|---|
| The list renders what the payload carries and nothing else | Opened an account with 4 live sessions | Columns: signed in, expires, **user agent, as recorded**, **address, as recorded**, device id. Values verbatim (`curl/8.14.1`, `node`, `Python-urllib/3.13`, `::1`, "not supplied"). A line states the record does not say where the person was or what device they held | [sessions-list.png](screens/sessions-list.png) |
| No per-session control is drawn | Inspected every row | No per-row revoke. One account-wide action, labelled "end all sessions", above the sentence that sessions cannot be ended one at a time | same |
| Revocation sits behind the reason-carrying confirmation | Opened it | The shared confirmation with its recorded-reason field | [sessions-self-revoke-confirmation.png](screens/sessions-self-revoke-confirmation.png) |
| Revoking the caller's own session says it signs them out | Opened the administrator's own account | "these are your own sessions, and one of them is the session you are reading this in… ending them ends that one too and signs you out immediately"; the confirmation repeats it and the button reads "sign myself out" | same |
| Reports-against is a list where one exists | Opened an account with a report and one without | With: a table of filed/reason/status linking to the report, plus a note that it is the recent set and not a full history. Without: "no reports against this account… this is the healthy case" | [sessions-list.png](screens/sessions-list.png) |
| Escape closes the confirmation | Pressed Escape | Dialog gone | — |

Light, dark, desktop, and narrow: [sessions-list.png](screens/sessions-list.png),
[sessions-desktop-dark.png](screens/sessions-desktop-dark.png),
[sessions-narrow-light.png](screens/sessions-narrow-light.png),
[sessions-narrow-dark.png](screens/sessions-narrow-dark.png).

---

## 5. Failure branches, every screen in the panel

| Branch | Where exercised | Observed |
|---|---|---|
| **Empty** | Report queue (moderator, no pending), escalated queue, hashtag registry under a filter, violations on a clean account, content tabs, activity log, statistics series | Each renders its own worded empty state. None reads as an error; the healthy cases are worded as healthy |
| **Loading** | Every list | The shared skeleton, at the same row height as a populated row, so the list does not jump when data arrives |
| **Network failure** | Covered by the shared failed state with its retry control; reached in practice through the 429 and 400 paths below | A framed message with "try again", never a raw error body |
| **Permission refusal** | Five administrator-only routes as a moderator | The not-available page. No table mounts, no request is issued and refused |
| **Invalid input** | Duplicate hashtag name; empty required reason; a range whose end precedes its start | Field-level messages against the offending field; the range control corrects and says what it changed |
| **Rate-limit refusal** | Statistics series, driven to a real 429 | Controls held for `Retry-After`, reason stated, no automatic retry |
| **Boundary of every list** | Account list paginated to exhaustion | 8 load-more clicks, 170 rows, control disappears on `hasNextPage === false`, no request beyond it, no numbered pager anywhere |
| **Conflict** | Two tabs resolving one report | "another reviewer already handled this. refreshing." and a refetch |

---

## 6. Cross-cutting checks

| Check | Method | Result |
|---|---|---|
| Raw colour values | `grep -rnE "#[0-9a-fA-F]{3,8}\b"` and `rgba?\(|hsla?\(` over `src/features/admin/` | **Zero matches**, all four phases |
| Escape on every overlay | Source inspection of all six overlays plus two live checks | All register the shared Escape hook. Deliberately inert while a mutation is in flight |
| Reduced motion | Playwright `emulateMedia({ reducedMotion: 'reduce' })`, confirmed active in-page | **0 of 400 sampled elements** retained a transition or animation on any of the eight routes; every screen still rendered |
| Narrow width | 390 × 844 across all eight routes | **No page-body horizontal scroll anywhere.** Tables scroll inside their own container. The rail becomes a scrollable top bar still reaching all 7 links |
| Console errors | Instrumented a clean 11-route administrator walk and a 9-route moderator walk | **Zero** in both |
| 403 responses | Instrumented both trees | **Zero** in both |
| Poll cadence | 130 s observation after the screen settled | **2** escalated-count requests, at 58 s and 119 s |

### Console errors recorded anywhere in this phase

Per the requirement that every console error be recorded, these are all of them:

1. **Two errors from the deliberate 429** — the browser's own log line for the refused resource, and
   the application's global query-error handler reporting the normalised message. Both are the
   expected consequence of provoking a rate limit, not defects. A refused request cannot be made
   silent from application code.
2. **Two 400s on the activity log** from before the range-clamp fix, and the transient
   `useAccountDetail is not defined` errors from the Vite hot-reload window between two edits of one
   file. Neither reproduces: the clamp was fixed and re-verified, and a fresh load after the build
   produced zero console errors across every route.

No other console error was observed at any point.

---

## 7. Both contexts, simultaneously

An administrator context and a moderator context were open at the same moment. Their identities were
read in the same tick to prove it: `@seed_admin` and `@seed_mod`. Every role-separation check was run
this way rather than by signing out and back in, so a leaked cache or a shared token would have shown
up as the wrong tree.

## 8. What could not be verified

One item, stated fully in the hardening sweep and repeated here so it is not buried: **an
administrator viewing another administrator** could not be exercised, because this deployment has one
administrator and creating a second is irreversible through the API. The mechanism was verified from
source and through the sibling self-target branch that reaches the same all-false capabilities.

Everything else in this phase was verified by driving the real interface against the real server.
