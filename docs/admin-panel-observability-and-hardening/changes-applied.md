# Changes Applied

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

All source changes are inside the frontend panel feature (`src/features/admin/`) except one shared
file, called out below with its justification. **Nothing in the backend repository was modified**;
the backend was read and called only. **No user-facing application code was changed.**

---

## New — statistics

- **`lib/statistics.js`** — the statistics contract as data and pure functions: the fourteen metrics
  with their unit and their gauge/flow kind, the two granularities with their bucket width, the
  one-year window limit and the thirty-day fine horizon, range clamping, grouping a flat point list
  into one series per dimension, **cutting a series into segments at every gap**, classifying a
  response as empty / measured-zero / has-data, and value-axis rounding.
- **`components/TimeseriesChart.jsx`** — the chart, as inline SVG from `--lx-*` tokens. A line per
  dimension over a **linear time axis**, a marker on every measured point, the line cut at every gap
  and the gap hatched and named. Sized from a `ResizeObserver` measurement, never from constants.
- **`components/DateRangeControl.jsx`** — a bounded range control that **commits on submit**: two
  date fields, a discrete window-length slider, quick presets, and an apply action. Clamps to its
  endpoint's own maximum before submitting and says what it changed.
- **`hooks/useStats.js`** — `useCurrentStats` (five-minute stale time, no polling, an explicit
  refresh) and `useStatsTimeseries` (keyed on the committed range, so nothing fires while a range is
  being edited).
- **`screens/StatisticsScreen.jsx`** — the snapshot panel and the series panel, keeping empty, zero,
  and gap apart everywhere.

## New — activity log

- **`hooks/useUserEvents.js`** — the cursor list, disabled until a range is committed, plus
  `WRITTEN_EVENT_TYPES`: the three types the application actually writes, derived from the backend
  source rather than from the OpenAPI enumeration.
- **`screens/ActivityLogScreen.jsx`** — the account picker, the three-option event filter, the
  bounded range control, and a table that renders exactly what each row carries.

## New — shared

- **`hooks/useRateLimitCooldown.js`** — the cooldown that `useDebouncedSearch` applies to a search
  box, lifted out for controls that are not search boxes. Reads `Retry-After`, holds for exactly
  that long, counts down, never retries.
- **`components/AccountSessionsPanel.jsx`** — the live-session list and the reports-against list.
  Renders the payload's user agent and address as the strings they are, draws no per-session revoke
  because none exists, and links each report to its detail.

## Modified — panel

- **`api/adminApi.js`** — added `getCurrentStats`, `getStatsTimeseries`, and `getUserEvents`, each
  unwrapping the envelope and sending only its endpoint's declared query keys. Two declared-key lists
  added.
- **`components/AccountLifecyclePanel.jsx`** — the session list and the reports-against list replace
  the two counts; the registration and last-login addresses are surfaced as the per-account fields
  they are; **the suspension banner now handles a null end date** as "suspended indefinitely" instead
  of rendering nothing.
- **`components/AccountDisciplinePanel.jsx`** — **the warn control is withheld where the target
  cannot be warned**, and the warn success message now quotes `resultingStatus` alongside
  `strikeIssued`, so a strike names what happened to the account.
- **`components/ViolationHistory.jsx`** — **the revoke confirmation now states that the account
  remains suspended or banned**, because revoking the record does not lift the consequence.
- **`hooks/useAccountDetail.js`** — gained an `enabled` option so a surface both roles reach can read
  the target's role as an administrator without a moderator firing a request that would answer 403.
  The query key is unchanged, so administrators still share one cached copy.
- **`screens/HashtagRegistryScreen.jsx`** — the ban confirmation now leads with the fact that banning
  **does not take down any existing post**.
- **`adminRoutes.jsx`** — the two new screens registered behind the administrator-only guard.
- **`components/AdminShell.jsx`** — two navigation entries added to the administration group.

## Bug fixes found by the hardening sweep

Listed separately because each was a failure of an existing check, not new work.

| Fix | File |
|---|---|
| A range clamped to the module's 365-day constant instead of its own endpoint's limit, so the activity log's 30-day bound was not enforced and a 234-day window reached the server as a 400 | `lib/statistics.js`, `components/DateRangeControl.jsx` |
| The clamp applied silently — the draft-sync effect cleared the explanatory note in the same tick the clamp wrote it | `components/DateRangeControl.jsx` |
| The warn control rendered on targets that cannot be warned | `components/AccountDisciplinePanel.jsx` |
| A strike did not name its outcome | `components/AccountDisciplinePanel.jsx` |
| Revoking a strike implied the account was restored | `components/ViolationHistory.jsx` |
| An indefinite suspension rendered nothing, so a suspended account read as unsuspended | `components/AccountLifecyclePanel.jsx` |
| The hashtag ban confirmation omitted that no existing post comes down | `screens/HashtagRegistryScreen.jsx` |

---

## The one file outside the panel directory

**`src/config/constants.js`** — added `ROUTES.ADMIN_STATISTICS` and `ROUTES.ADMIN_ACTIVITY`, with a
comment on each.

**Justification.** This file is the single source of route paths for the whole application, and the
project's routing rule requires every route to be declared here rather than hardcoded at its call
site. The three previous admin phases added their routes the same way. Nothing outside the panel
changes: two new admin path constants and their comments, no behaviour, no existing value touched.

---

## Not changed, deliberately

- **The backend.** Read and called throughout; never modified. Verified: the backend working tree
  carries no changes from this phase.
- **The user-facing application.** The settings defect was reproduced end to end and diagnosed to
  the backend and its seed script — the frontend requests the correct path with the correct method —
  so per the phase constraint it was recorded rather than patched. It is item 6 of
  `docs/admin-panel/backend-request.md`.
- **No file was moved or renamed.** The cross-feature imports of `LxBtn`, `LxTag`, and the toast
  host remain where previous phases left them; relocating them is still waiting on a phase permitted
  to move files.
- **No dependency was added.** No charting library. The chart is inline SVG.
