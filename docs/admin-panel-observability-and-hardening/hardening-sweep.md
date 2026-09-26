# Hardening Sweep — Section 15, All 51 Items

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

Every item in section 15 of `docs/admin-panel/ADMIN_PANEL_HANDOFF.md`, walked against the built
panel in the browser. This is a review of all four phases as one product, not of this phase's work.

**Outcome key** — `pass`: satisfied as built. `fixed`: failed, and the fix is in this branch.
`explained`: could not be satisfied as written, with the reason. **Nothing is skipped.**

Totals: **44 pass, 5 fixed, 2 explained.**

Both role trees were driven in two simultaneous browser contexts (`@seed_admin` and `@seed_mod`
signed in at the same moment, confirmed by reading each context's identity in the same tick).

---

## 15.1 Session

| # | Item | What was done | Outcome |
|---|---|---|---|
| 1 | Sign in as `admin@seed.local`; land on an administrator route with the administrator group | Signed in through the real form. Landed on `/admin/reports`; navigation rendered 7 links across both groups | **pass** |
| 2 | Sign in as `mod@seed.local`; moderator navigation only — no user list, hashtags, statistics, or activity | Landed on `/admin/reports`; navigation rendered exactly `reports`, `actions` under one group, `moderation`. None of the four administrator entries present | **pass** — [tree-mod-reports.png](screens/tree-mod-reports.png) |
| 3 | Reload; stay signed in and get the correct role immediately, without flickering from moderator to administrator | Reloaded `/admin/statistics` and sampled the navigation 24 times over ~3 s. **One** distinct state observed, the full administrator tree. The moderator-only tree never appeared | **pass** |
| 4 | Invalidate the session; expect exactly one refresh attempt then a redirect to login, **no 401 loop** | Signed in as the moderator, then called the **real** `POST /admin/users/{id}/force-logout` from a separate context (the previous phase had only simulated this). Navigating then produced **exactly one** API call — `401 auth/refresh` — and a redirect to `/`. This closes the accounts phase's deferred item | **pass** |
| 5 | The refresh request carries the `luvax_refresh` cookie | Read the context's cookie jar: `luvax_refresh`, `httpOnly: true`, path `/api/v1/auth` | **pass** |
| 6 | Sign out: 204, cookie cleared, previous token fails if replayed | Clicked sign out: `204 auth/logout`, cookie jar emptied, redirect to `/`. A subsequent protected navigation made one refresh attempt, got 401, and redirected | **pass** |

## 15.2 Role separation

| # | Item | What was done | Outcome |
|---|---|---|---|
| 7 | As moderator, type the user-list route directly; expect an unreachable route, **not** an empty table, **not** a table that 403s | Navigated the moderator directly to `/admin/users`, `/admin/hashtags`, `/admin/escalated`, `/admin/statistics`, `/admin/activity`. All five rendered the not-available page; **no table element** on any; **zero 403 responses** across the whole session | **pass** — [tree-mod-accounts-BLOCKED.png](screens/tree-mod-accounts-BLOCKED.png), [tree-mod-statistics-BLOCKED.png](screens/tree-mod-statistics-BLOCKED.png) |
| 8 | As moderator, **zero** requests to `/admin/reports/escalated/count` | Instrumented every request across a nine-route moderator walk. Count of matching requests: **0** | **pass** |
| 9 | As moderator, the violations screen for an account with a strike shows warnings only, with no empty strike column or placeholder | Opened `seed_alice` (6 active warnings, 1 active strike) as the moderator. Six `WARNING` rows, **no** `STRIKE` text, no revoke controls, no empty column | **pass** — [tree-mod-violations-warnings-only.png](screens/tree-mod-violations-warnings-only.png) |
| 10 | As administrator, the same screen shows the strike | Opened the same account as the administrator: `STRIKE strike #1` renders alongside the warnings, each with a revoke control | **pass** |

## 15.3 Authorization-shaped controls

| # | Item | What was done | Outcome |
|---|---|---|---|
| 11 | An administrator viewing **another administrator**: no ban, suspend, role, or warn controls; not disabled buttons; no 403 toast | **Cannot be exercised: this deployment has exactly one administrator, and creating a second is irreversible** — no API path demotes an administrator (handoff 11.1/13.14), so doing it would permanently consume the only moderator account and leave the rest of the sweep unable to test moderator behaviour. The mechanism was verified instead, two ways. **From source:** `AdminAuthorizationServiceImpl.evaluateActorAndTarget` returns `TARGET_IS_ADMIN` whenever `targetRole == ADMIN`, *regardless of actor*, which makes `canChangeStatus` false and `assignableRoles` empty. **In the browser:** the panel renders lifecycle controls exclusively from capabilities, proven by the self-target case, which reaches all-false capabilities by the sibling branch of the same function and renders no ban, suspend, or role control. The warn control was additionally verified withheld for an `admin` target (item 16's fix) | **explained** |
| 12 | The administrator's own account: no moderation controls | Opened `/admin/users/{seed_admin}` as `seed_admin`: `THIS IS YOU` badge, no ban, suspend, or role control. Only force-logout, which is self-permitted by design | **pass** |
| 13 | `seed_alice`, an ordinary account: the role selector offers exactly one option, `moderator`, and **not** `admin` | Opened the role dialog on an ordinary account. Exactly one option: "promote to moderator". No `admin` option exists to select | **pass** |
| 14 | Promote to moderator; the selector then offers `user` and `admin` | Promoted through the interface, reopened: "demote to user" and "promote to administrator", the latter marked `ONE-WAY — CANNOT BE UNDONE`. Reverted to `user` afterwards | **pass** — [role-selector-widens-after-promotion.png](screens/role-selector-widens-after-promotion.png) |
| 15 | Promoting an ordinary account directly to `admin` is impossible through the interface | At role `user` the option is absent from the dialog; there is no control, field, or path that composes that request. The panel offers exactly `capabilities.assignableRoles` and nothing else | **pass** |
| 16 | `seed_mod`: suspend and ban render; **warn does not**, because a moderator cannot be warned | **Failed on first walk** — the warn control rendered unconditionally on every account. Fixed: where the target's role is knowable the control is withheld. Re-verified: `seed_mod` → no warn control, replaced by "a warning cannot be issued against a moderator account"; suspend, ban, change role, force logout all still render. `seed_admin` → no warn control. An ordinary account → warn control present | **fixed** — [warn-withheld-on-moderator-target.png](screens/warn-withheld-on-moderator-target.png) |

## 15.4 Discipline

| # | Item | What was done | Outcome |
|---|---|---|---|
| 17 | A first warning: success with no mention of suspension | Issued through the dialog: "warning issued — 1 active warning now". No mention of suspension | **pass** |
| 18 | The third warning reports that the account has been suspended, **naming the outcome** | **Failed on first walk** — the message read `strikeIssued` but not `resultingStatus`, so it said a strike was applied without saying what happened to the account. Fixed. Re-verified live: *"warning issued — this was the third active warning, so a strike was applied, and the account is now suspended — 0 active warnings now"*. The account was confirmed `suspended` in the database | **fixed** — [discipline-strike-toast-names-outcome.png](screens/discipline-strike-toast-names-outcome.png) |
| 19 | Revoking that strike states that the account **remains suspended**; it must not imply restoration | **Failed on first walk** — the confirmation said only that the strike would be revoked and removed. Fixed. Re-verified: *"…the account stays suspended — revoking the record does not lift the suspension, which must be lifted separately."* | **fixed** — [discipline-revoke-strike-confirmation.png](screens/discipline-revoke-strike-confirmation.png) |
| 20 | The account is still `suspended` afterwards | Revoked the strike, reloaded the detail: status badge `SUSPENDED`, "suspension ends Aug 29, 2026" | **pass** — [discipline-after-strike-revoked-still-suspended.png](screens/discipline-after-strike-revoked-still-suspended.png) |

## 15.5 Reports

| # | Item | What was done | Outcome |
|---|---|---|---|
| 21 | Escalate a report as the moderator: success | Created a pending report, escalated it through the moderator's interface: "report escalated", status became `ESCALATED`, zero HTTP errors | **pass** — [tree-mod-reports-with-pending.png](screens/tree-mod-reports-with-pending.png) |
| 22 | Reload it as the same moderator: readable, with resolve and dismiss **absent** | Same session, immediately after escalating: the report renders in full; the button set drops to `remove post`, `issue warning`. Also verified on the pre-existing escalated report | **pass** — [tree-mod-escalated-report-no-close-controls.png](screens/tree-mod-escalated-report-no-close-controls.png) |
| 23 | The same report as an administrator: resolve and dismiss available | Opened as `seed_admin`: both controls render | **pass** — [tree-admin-report-detail-post-escalated.png](screens/tree-admin-report-detail-post-escalated.png) |
| 24 | A `story` or `message` report: target read-only, no remove or restore, with a note explaining why | No story exists in this database, so a **message**-target report was created and walked. Renders the message read-only; `hasRemove: false`, `hasRestore: false`; note reads *"a message cannot be taken down from this panel. the available actions are resolve, dismiss, and escalate."* | **pass** — [report-message-target-read-only.png](screens/report-message-target-read-only.png) |
| 25 | Two tabs on one pending report; resolve in both. The second shows a non-alarming message and refetches | Two pages in one context on the same report. First: "report resolved". Second: **"another reviewer already handled this. refreshing."** and the view refetched to `RESOLVED`. No raw error dialogue | **pass** — [report-double-resolve-calm-conflict.png](screens/report-double-resolve-calm-conflict.png) |

## 15.6 Content moderation

| # | Item | What was done | Outcome |
|---|---|---|---|
| 26 | Post with a hashtag → remove → ban that hashtag → restore. The success message names the dropped hashtag | Built the fixture: a post carrying `#dropcheck` and `#keepcheck`, removed it, banned `#dropcheck`, restored through the interface. Message: **"post restored. dropped: #dropcheck"** — the banned tag named, the active one not | **pass** — [restore-names-dropped-hashtag.png](screens/restore-names-dropped-hashtag.png) |
| 27 | Restore a post with no banned hashtags: a plain message with no empty "dropped: " text | Removed and restored a post carrying no banned tag. The server returned `droppedHashtags: []`; the message builder guards on a non-empty array, so the message is a plain "post restored" | **pass** — [restore-plain-no-dropped-text.png](screens/restore-plain-no-dropped-text.png) |

## 15.7 Hashtags

| # | Item | What was done | Outcome |
|---|---|---|---|
| 28 | A hashtag's edit form: the name is non-editable | There is no edit form with a name field. The registry offers status transitions per row (ban, unban, delete, restore), so a name is structurally uneditable — the failure mode cannot arise | **pass** |
| 29 | A status change sends **only** `status` and `note`; `name` must be absent | Captured the request off the wire: `PATCH /admin/hashtags/{id}` with body `{"status":"active","note":"…"}`. No `name` | **pass** |
| 30 | Create offers only `active` and `banned` | Opened the create dialog: exactly two status options, `active` and `banned`. `deleted` absent | **pass** |
| 31 | After creating, navigating to the new hashtag loads (i.e. `targetEntityId` was used, not `data.id`) | The panel does not navigate after create — it refetches the list, and there is no per-hashtag detail route to navigate to. The id-confusion failure the item guards against therefore cannot occur; the created tag was confirmed present in the refetched list | **explained** |
| 32 | A duplicate name gives a **field error on the name input**, not a generic toast | Submitted `travel`, which exists. The dialog stayed open with *"a hashtag with this name already exists"* under `NAME`; no toast was raised | **pass** — [hashtag-duplicate-name-field-error.png](screens/hashtag-duplicate-name-field-error.png) |

## 15.8 Pagination

| # | Item | What was done | Outcome |
|---|---|---|---|
| 33 | Paginate a multi-page list to the end; the final page's items are visible | Account list, 170 accounts. Clicked load-more to exhaustion: **8 clicks, 170 rows rendered**, none missing | **pass** |
| 34 | The loop stops; no request beyond the page where `hasNextPage` became false | The load-more control disappeared after the eighth click and no further request was issued | **pass** |
| 35 | Applying a filter after paginating restarts at page one with **no** `INVALID_CURSOR` | Applied the `banned` filter after full pagination: the list restarted at 1 row, URL `?status=banned`, and **zero HTTP errors** were recorded | **pass** |
| 36 | No numbered pagination control anywhere | Probed every panel route for a numbered pager: none found on any screen | **pass** |

## 15.9 Strictness

| # | Item | What was done | Outcome |
|---|---|---|---|
| 37 | Every list request carries only that endpoint's declared parameters | Collected every GET query string across a full administrator walk. Observed keys only: `status`, `role`, `q`, `cursor`, `limit`, `actionType`, `adminId`, `metric`, `granularity`, `from`, `to`, `userId`, `eventType`, `reportType`. No stray `page`, `sort`, or `search`. Enforced structurally by `pickParams` with a per-endpoint declared-key list | **pass** |
| 38 | Every mutation body carries only declared fields | Captured bodies off the wire: warn `{reasonKey, note}`; hashtag create `{name, status, note}`; hashtag status `{status, note}`; role `{role, reason}`. Bodies are assembled field by field by `buildBody`; no form state is spread | **pass** |
| 39 | A constraint violation appears against the **specific field**, not as a generic toast | The duplicate-hashtag case (item 32) renders against the name input. The warn dialog maps `VALIDATION_ERROR`'s `data` map onto its `reasonKey` and `note` slots | **pass** |

## 15.10 Vocabularies

| # | Item | What was done | Outcome |
|---|---|---|---|
| 40 | The warning reason list comes from `GET /config/vocabularies`, ordered by `sortOrder` | Confirmed the request in the network log. The listbox rendered 8 reasons in `sort_order` (spam 1, nudity 2, violence 3, hate_speech 4, harassment 5, false_information 6, scam 7, other 99) — the database's own order | **pass** |
| 41 | Disable `spam` in the database and reload: "Spam" still appears, rendered unavailable and unselectable, **not** vanished | Ran the `UPDATE`, reloaded. "Spam" present, suffixed **unavailable**, `aria-disabled="true"`, and unselectable. All seven others selectable. The row was restored afterwards | **pass** — [vocabulary-disabled-reason-unavailable.png](screens/vocabulary-disabled-reason-unavailable.png) |
| 42 | An audit row with `actionType: ban_hashtag` shows "Ban Hashtag" from the vocabulary, not a raw key or a client-side transformation | The action log renders "Ban Hashtag"; the raw key `ban_hashtag` appears nowhere in the rendered text | **pass** — [tree-admin-actions.png](screens/tree-admin-actions.png) |

## 15.11 Observability

| # | Item | What was done | Outcome |
|---|---|---|---|
| 43 | Statistics on a freshly reset database: a "no statistics collected yet" empty state; **not** a chart of zeros, **not** an error | `platform_stats` was backed up, emptied, the screen loaded, and the table restored. The screen said "no statistics have been collected yet", showed **no figure tiles at all** (the payload's zeros are placeholders for absent rows, so none are displayed), and drew no chart | **pass** — [stats-before-first-collection.png](screens/stats-before-first-collection.png) |
| 44 | Once data exists, the snapshot displays `computedAt` and is labelled as of that time, not as live | Header reads "as of Aug 22, 2026, 11:46 AM Asia/Saigon", with the bucket start and an explicit sentence that the figures are up to 30 minutes behind and are not live. The word "live" appears only on the top-hashtag list, which the server flags as computed at request time | **pass** — [stats-desktop-light-with-data.png](screens/stats-desktop-light-with-data.png) |
| 45 | A range starting more than 30 days ago forces daily granularity, with **no 400 reaching the user** | The server does not force — it *refuses* an explicit `half_hour` over such a window (see the contract document). So the control prevents it: half-hour renders as "unavailable for this range" with the horizon explained, and an already-selected half-hour falls back to daily with a notice. **Network log: the request went out as `granularity=day`; no 400 was ever issued** | **pass** — [stats-granularity-blocked-and-empty-window.png](screens/stats-granularity-blocked-and-empty-window.png) |
| 46 | The activity log's event-type filter offers **exactly three** options | Three: session start, search, profile view. None of the seventeen unwritten types appear. Derivation and the second-writer complication are in `design-decisions.md` §3 | **pass** — [activity-before-bounds-and-event-filter.png](screens/activity-before-bounds-and-event-filter.png) |
| 47 | A 60-day activity range is prevented by the picker rather than refused by the server | **Failed on first walk** — `clampRange` used the module's 365-day constant instead of the control's own `maxDays`, so a 234-day window went to the server and returned 400. Fixed: the limit is now a parameter. Re-verified: submitting 1 Jan → 22 Aug clamps to exactly 30 days with *"a range may span at most 30 days; the start was moved forward to fit."* and the request goes out inside the bound. The slider cannot be dragged past 30 days at all | **fixed** |
| 48 | Leave the panel open two minutes as administrator: roughly two escalated-count requests, not twenty | Instrumented for 130 s after the screen settled: **2 requests, at 58 s and 119 s** | **pass** |

## 15.12 Null handling

| # | Item | What was done | Outcome |
|---|---|---|---|
| 49 | An audit row with `actionType: issue_strike` shows the actor as "System"; no blank, no crash | Two such rows exist with `admin_id IS NULL`. Both render `Issue Strike … system` in the actor column | **pass** — [tree-admin-actions.png](screens/tree-admin-actions.png) |
| 50 | An account suspended with no end date shows "Suspended indefinitely", not "Not suspended" and not a blank | **Failed on first walk** — the suspension banner was gated on `suspendedUntil` being truthy, so the indefinite case rendered nothing at all and a suspended account read as unsuspended. Fixed: `status` is read first, and the null branch renders "suspended indefinitely — no end date is recorded" | **fixed** |
| 51 | A report whose target is a user shows no empty content block where `text` would be | Opened the user-target report: the content pane renders `USER / SUSPENDED / OWNER @seed_alice` with no empty text block and no remove or restore control | **pass** — [tree-admin-report-detail-user-target.png](screens/tree-admin-report-detail-user-target.png) |

---

## Additional checks beyond the 51

Carried out under §10.2 and §10.3 of this phase's prompt, against every screen from every phase.

| Check | Result |
|---|---|
| **No raw colour value anywhere in the panel** | `grep -rnE "#[0-9a-fA-F]{3,8}\b"` and `grep -rnE "rgba?\(\|hsla?\("` over `src/features/admin/` — **zero matches** across all four phases |
| **Every modal and drawer closes on Escape** | All six overlays register `useEscapeKey`; verified in the browser on the force-logout confirmation and the reason listbox. Escape is intentionally inert while a mutation is in flight, so a half-submitted action cannot be abandoned mid-request |
| **Reduced motion** | Exercised through Playwright media emulation (`prefers-reduced-motion: reduce` confirmed active in the page). Across all eight panel routes, **zero of 400 sampled elements** retained any transition or animation duration, and every screen still rendered in full |
| **Narrow width, every screen** | All eight routes at 390 × 844: **no screen scrolls the page body horizontally**; wide tables scroll inside their own `overflow-x: auto` container; the navigation rail becomes a scrollable top bar and still reaches all seven links |
| **Console errors** | A clean administrator walk over 11 routes produced **zero console errors and zero HTTP responses ≥ 400**. The only console errors recorded anywhere in this phase were (a) deliberately provoked — the rate-limit 429 — and (b) transient Vite HMR artifacts between two edits, neither reproducible on a fresh load. All are listed in `verification-evidence.md` |
| **No control returns 403** | Instrumented both role trees for 403 responses: **zero** in the moderator session and zero in the administrator session |
| **Layout shift on load resolve** | The record table renders a skeleton at the same row height as a populated row, so a list does not jump when data arrives. The statistics chart reserves its measured height before points arrive |
