# Verification Evidence

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

Every check this phase ran, what was driven, and what was observed. Contract-level evidence — request
and response for each endpoint — is in `uptake-contract-verification.md`; this document is the
interface, driven through a real browser against the running stack.

**Environment.** Backend `develop` @ `69aedbfc`, jar rebuilt this phase (the jar on disk predated the
new endpoints), Flyway schema v82, compose project `app` with `gorse` healthy,
`seed-dev-data.sh --reset` applied. Dev server on `:5173`; a real `vite build` served on `:3000` for
the production checks.

**Both roles were driven**, as `seed_admin` and `seed_mod`.

> **Deviation from the phase's wording, recorded rather than glossed.** The phase asks for the two
> role contexts "open simultaneously". The panel's session lives in `localStorage` under one key, so
> two tabs in one browser profile share a single identity and the second sign-in replaces the first.
> The two trees were therefore walked **sequentially in isolated sessions** — sign out, sign in as
> the other role, walk again — which exercises exactly the same surfaces. True simultaneity needs two
> browser profiles, which the available tooling does not open.

---

## 1. Story and message actions

| Check | Driven | Observed | Screenshot |
|---|---|---|---|
| Story target renders remove control | report `7870e263` as administrator and as moderator | *remove story* present; no read-only copy anywhere on the page | `story-target-controls-desktop-light.png` |
| Reason-carrying confirmation | clicked *remove story* | reason textarea, 0/2000 counter, cancel/remove pair, 500ms arming | `story-remove-confirmation-desktop.png` |
| Removal applied | confirmed with a reason | control flipped to *restore story*, `REMOVED` badge on the target | — |
| Restore confirmation states the limit | clicked *restore story* | *put this story back. this lifts the removal only: if the story has already passed its expiry it stays out of every feed, and restoring does not extend its lifetime.* | `story-restore-confirmation-desktop.png` |
| **Expired-story outcome** | removed then restored the already-expired story `a4b3ee85` (report `9f732332`) | toast: *story restored. this lifts the removal only — a story already past its expiry stays out of every feed, and restoring does not extend its lifetime* — not a bare success | `story-expired-restore-toast-desktop.png` |
| Message remove confirmation | report `b429782c` | names what is withheld from **both participants**, before confirming | `message-remove-confirmation-desktop.png` |
| Message removal outcome | confirmed | toast: *message removed. its text and any media are withheld from both participants* | — |
| **Reviewer still sees removed text** | read the target while removed | `true` — the text is still rendered with `removed: true`. Verified rather than assumed; no view-side redaction was added because the server does not do it | — |
| Message restore outcome | restored | *message restored. this lifts the removal only — if the sender had also deleted it, it stays hidden for both participants* | `message-restore-outcome-desktop.png` |
| **409 surfaced as what it is** | had a second reviewer restore the message out-of-band via the API, then clicked restore on the now-stale view | toast: *another reviewer already handled this. refreshing.*; dialog closed; view refetched. Not a raw error | `message-restore-conflict-409-desktop.png` |
| Escape closes the dialog | pressed Escape on the restore confirmation | `document.querySelector('[role="dialog"]')` → `null` | — |

Toasts dwell for 1700ms, shorter than a screenshot round trip. Where a toast is the evidence, the
dwell timer was suspended for the capture only (`window.setTimeout` patched to ignore that one
duration). Nothing in the application was changed to take these pictures.

---

## 2. Batch identifier resolution — the before and after

**The measurement.** `/admin/actions` with no filter, twenty rows, as administrator. The rows
reference five distinct people across their `adminId` and `targetUserId` columns.

| | Requests to resolve identifiers |
|---|---|
| **Before** (per-id mechanism) | **5** — one `GET /admin/content/user/{id}` per distinct person, as the foundation phase recorded: "a page of twenty rows referencing three distinct reporters produced exactly three `admin/content/user/{id}` requests" |
| **After** (batch) | **1** — a single `GET /admin/user-summaries` carrying all five ids |

Read from the network log:

```
[GET] /api/v1/admin/actions?limit=20 => 200
[GET] /api/v1/admin/user-summaries?ids=2f0d04c6…&ids=28faa499…&ids=6db66fb3…
                                  &ids=9bbc0295…&ids=026439a8… => 200
```

**Zero** `content/user` requests were issued anywhere in either role tree.

**The wire form.** The query string shows repeated bare `ids=` keys — the `paramsSerializer:
{ indexes: null }` setting doing its job. Axios's default `ids[]=` is rejected by the server with
`400`, so this is load-bearing, not cosmetic.

**Splitting beyond the bound — driven, not inferred.** The ceiling and the `400` past it were first
established against the server (`uptake-contract-verification.md` §1.5: 100 ids → 200 with 100
entries; 101 → `400 "At most 100 identifiers may be resolved in one call"`).

The loader itself was then driven with **150 distinct ids** — three real accounts and 147 that do not
exist — by importing the real module in the running application and calling `loadUserSummary` once
per id:

| Observed | Value |
|---|---|
| `MAX_IDS_PER_REQUEST` | `100` |
| Ids requested | 150 |
| **Requests issued** | **2** — one carrying 100 ids, one carrying 50 |
| HTTP status of both | `200` — the bound was respected, no `400` |
| Promises settled | 150 |
| Resolved to a name | 3 (`seed_alice`, `seed_carol`, `seed_bob`) |
| Settled as not-found | 147 |

**Order-independence confirmed in the same run.** The three real ids sat at indexes 0, 1 and 2 of a
150-element request and each came back as its own account — `seed_alice`, `seed_carol`, `seed_bob` in
that order — across a response that was split into two separate calls. Entries are matched by the
`userId` each carries, so a positional bug could not have produced this.

No panel screen renders more than a hundred distinct people in one page, so this path is not reachable
through the interface today; it is verified against the module directly rather than left to the
constant.

**Regression: every screen that showed a name still shows one.** Both role trees walked. On the
moderator's report queue, three rows, all reporters resolved, and a scan for unresolved 8-character
id fragments returned none. The moderator can call the endpoint (`200`), which is what keeps the
report queue renderable without administrator access.

---

## 3. The renamed restore field

**Driven twice on the same post.** Post `f369e5c1`, caption `uptake restore probe #uptakekeep
#uptakesecond`, both tags banned after the post was created (a post cannot be created carrying a
banned tag — `400 POST_BANNED_HASHTAG`).

Remove → restore → remove → restore, reading the message each time:

```
pass 1: post restored. its caption still carries banned hashtags: #uptakekeep, #uptakesecond
pass 2: post restored. its caption still carries banned hashtags: #uptakekeep, #uptakesecond
```

Identical. Both messages are visible in one frame:
`post-restore-twice-same-names-desktop.png`.

**The drawer reads the new key.** An `restore_post` action opened from the audit log shows:

```
METADATA
RESULTING STATUS              published
BANNED HASHTAGS STILL IN THE CAPTION   #uptakekeep, #uptakesecond
```

`drawer-new-metadata-key-desktop.png`. The label changed with the meaning, not just the key.

---

## 4. Sessions

| Check | Driven | Observed | Screenshot |
|---|---|---|---|
| Caller's own row marked | opened the administrator's own account detail | exactly one row badged `THIS SESSION` — the `Mozilla/…Chrome` row, which is the browser | `sessions-own-row-marked-desktop.png` |
| Marker is correlated, not invented | read the app's own `POST /auth/session` response from the network log | `{"sessionId":"470aa8c0-bd02-41d1-a1a2-ad9dfd832bcc"}`, and that id is present in the account detail's `sessions` array. No per-row field was used | — |
| Per-session revoke confirmation | clicked *end* on another session | *this ends one session. every other session this account holds stays signed in, and the account is not banned or suspended. a revoked session cannot be restored — the person signs in again.* | `session-single-revoke-confirmation-desktop.png` |
| **Double click is safe** | clicked confirm twice in immediate succession | exactly **one** toast (*session ended*), no error toast, dialog closed once | — |
| Other sessions survive | after the revoke | the caller's own row still present and still marked; the account remains signed in elsewhere | — |
| Own-session revoke states the consequence | clicked *end* on the `THIS SESSION` row | *this ends the session you are reading this in and signs you out of the panel immediately. the account's other sessions stay signed in…*; confirm reads **end my session and sign out** | `session-own-revoke-confirmation-desktop.png` |
| No un-revoke offered | inspected the list | nothing implies it; a revoked session simply leaves the list | — |
| Administrator-only | moderator called the endpoint directly | `403 FORBIDDEN`; the panel never renders the control for a moderator because the whole lifecycle panel is administrator-gated | — |

The own-session revoke confirmation was **opened and dismissed with Escape**, not confirmed — the
copy is the deliverable, and confirming would have ended the session driving the rest of the run.

---

## 5. Warnings, violations, and the audit log

### 5.1 The warning count

Driven against `seed_carol`, whose active warning count was exactly 2 at the time:

> this account has **2 active warnings**. this one will be the third, which issues a strike
> automatically and resets the count to zero. a strike suspends the account — seven days for a first
> strike, thirty for a second — and a third strike bans it outright.

`warning-third-consequence-desktop.png`. The ladder was read out of the backend source
(`WARNINGS_PER_STRIKE = 3`, `STRIKE_ONE_SUSPENSION_DAYS = 7`, `STRIKE_TWO_SUSPENSION_DAYS = 30`,
`strikeNumber >= 3` → banned) and confirmed by driving three warnings against the endpoint, which
produced a strike, reset the count to 0, and suspended the account until `+7 days`.

As a **moderator** the same dialogue reads:

> how many warnings this account already carries cannot be read with your access. three active
> warnings issue a strike: a first strike suspends the account for seven days, a second for thirty,
> and a third bans it.

`warning-moderator-count-unreadable-desktop.png`. Confirmed by calling: a moderator receives `403`
from `GET /admin/users/{id}`.

### 5.2 Revoked violations

| Check | Observed | Screenshot |
|---|---|---|
| Default off | checkbox unchecked on load; two live warnings listed | `violations-revoked-toggle-off-desktop.png` |
| Toggled on | two additional records appear, each badged `REVOKED`, dimmed, with *revoked by @seed_admin · Aug 22, 2026, 10:08 PM* | `violations-revoked-toggle-on-desktop.png` |
| Pagination restarts, no cursor error | toggled on | no error toast; the flag is part of the query key so no cursor crosses. The server rejects a crossed cursor with `400 INVALID_CURSOR` in **both** directions (contract §4.2) | — |
| Revoked records offer no revoke control | inspected | the *revoke* button renders only on unrevoked records; nothing implies un-revoking | — |

### 5.3 The audit log's new filters

| Check | Driven | Observed |
|---|---|---|
| Target filter | picked `@seed_carol` in the target picker | URL `?target=6db66fb3…`; request `?targetUserId=6db66fb3…&limit=20` — **only declared parameters** |
| Window filter | clicked the *last 7 days* preset | request `?targetUserId=…&from=2026-08-15T15:59:42.186Z&to=2026-08-22T15:59:42.186Z&limit=20` — the two compose |
| **Half-open boundary matches the claim** | took a real row's `createdAt` as a pivot | `from=<pivot>` **includes** the pivot row; `to=<pivot>` **excludes** it. Verified on `/admin/actions` **and** `/admin/user-events`, not on one and assumed for the other. The control states *from is included, to is not* |
| **Does not bypass moderator scoping** | as `seed_mod`, filtered by `@seed_carol` | **0 rows** — every action against carol was the administrator's — with the moderator-appropriate empty copy *you have taken no moderation actions for this filter.* |
| Filter works positively for a moderator | as `seed_mod`, filtered by `@seed_alice` | 10 rows, **all** by `@seed_mod`: Remove/Restore Story and Message. It narrows within the caller's own actions |
| Actor filter hidden for a moderator | inspected | not rendered — a moderator already sees only its own actions |

Screenshots: `audit-filters-target-and-window-desktop.png`,
`audit-target-filter-moderator-scoped-desktop.png`.

### 5.4 A moderator's own escalations

Driven end to end: `seed_mod` escalated report `4e9e73c2`; `seed_admin` **resolved** it; the
moderator's escalations list still shows it, carrying `RESOLVED`.

`my-escalations-moderator-desktop.png`. That is the whole point of the endpoint, and it is confirmed
rather than assumed. The screen states it too: *a report stays on this list after it is closed, with
the status it ended in.*

An administrator calling the same screen sees its own escalations, which is none — a different and
smaller list than the escalated queue.

---

## 6. Corrected controls

| Check | Observed | Screenshot |
|---|---|---|
| **Span limit** | *WINDOW LENGTH — 1 DAY — AT MOST 365 DAYS* | `statistics-range-control-desktop.png` |
| **Fine-bucket horizon, enforced separately** | with a 90-day window: *every 30 minutes (unavailable for this range)* and *fine buckets are kept for 30 days… so the half-hour option is offered as unavailable rather than allowed and then refused* — while the 90-day span itself is accepted | `statistics-horizon-enforced-desktop.png` |
| **A refused combination cannot be produced** | network log across both states: `granularity=half_hour` on the 1-day window → `200`; `granularity=day` on the 90-day window → `200`. **No `400` was ever issued** | — |
| Pre-collection message | *the first readable bucket appears **within an hour** of the server starting* | `statistics-range-control-desktop.png` |
| Rate-limit budget | the code states 20 requests a minute in production, in both the range control and the cooldown hook | — |
| Indefinite suspension offered | radio pair *for a set number of days* / *indefinitely*; choosing indefinite hides the duration field, rewrites the description, and renames the confirm to *suspend indefinitely* | `suspension-indefinite-option-desktop.png` |
| An indefinitely suspended account reads as suspended | `SUSPENDED` badge plus *suspended indefinitely — there is no end date, and it lasts until an administrator lifts it* | `suspension-indefinite-account-reads-desktop.png` |
| Post rows render media | two thumbnails on the post row; comment rows carry none | `post-rows-with-media-desktop.png` |

**On the three "corrected facts" that were already correct.** The span/horizon split, the 20-per-
minute budget, and the within-an-hour message were all already right in the panel — the observability
phase found and fixed them. They were **re-verified against the server** this phase and confirmed
rather than rebuilt. The divergence is recorded in `uptake-contract-verification.md` §8.1.

**On the rate limit.** 20/minute is the documented production figure and is **not observable here**:
25 rapid series calls in the dev profile all returned `200` with no rate-limit headers. Recorded as
documentation-sourced, not measured.

**Media fixture.** `post_media` is empty in a seeded database and media upload needs R2 credentials
the dev stack does not have, so two `media_assets` rows were inserted pointing at locally served
images and attached to one of alice's posts. Two story media rows were repointed the same way, so
the story screenshots show the rendering rather than a broken external CDN link. Recorded in
`deferred-findings.md` as fixture state.

---

## 7. The activity log filter, both branches

| Build | Filters offered | Copy |
|---|---|---|
| Development (`:5173`) | 7 — session start, search, profile view, post like, post save, post view, post comment | *these are the 7 kinds of event this environment writes… four of these are written by a consumer that runs in the local stack only, so a production panel offers three.* |
| **Production** (`vite build`, served on `:3000`) | **3** — session start, search, profile view | *these are the 3 kinds of event this environment writes… a development stack additionally records four engagement types, through a consumer that no production deployment runs.* |

`activity-filter-development-build.png`, `activity-filter-production-build.png`.

**Stronger than a rendering check.** `grep` over the production bundle finds `session_start` and
finds **none** of `post_like`, `post_save`, `post_view`, `post_comment` — the four are tree-shaken
out of the shipped JavaScript, not merely hidden.

The seven types were established by **producing each one and reading the log back**, not by reading a
constant (contract §5.4).

---

## 8. Craft and regression

| Check | Result |
|---|---|
| Only declared query parameters | Every list request inspected in the network log carries declared keys only. The report endpoints now enforce this too: `?bogus=1` → `400` on `/reports`, `/reports/pending`, and `/reports/escalated/mine` |
| Only declared body fields | Bodies are built field by field through `buildBody`; the indefinite suspension omits `durationDays` entirely rather than sending `null` |
| No raw hex colour | `grep -nE "#[0-9a-fA-F]{3,8}\b"` over every file this phase added or changed → no matches outside hashtag strings like `#uptakekeep` |
| Escape closes modals and drawers | Verified on the restore confirmation, the warn dialogue, the suspend dialogue, the session revoke confirmation, and the action drawer |
| Reduced motion | The global guard in `index.css` (`@media (prefers-reduced-motion: reduce)`) zeroes animation and transition durations for `*`. This phase added no animation of its own, so the existing guard covers everything new |
| Narrow width | 390 × 844 across the touched screens. `documentElement.scrollWidth === clientWidth` → **no horizontal page overflow**; the nav becomes a horizontal scroller, filters and date fields stack, tables scroll inside their own container |
| Both themes | `data-theme="dark"` on the list screens; tokens resolve, no unreadable contrast |
| Role trees | Administrator: reports, my escalations, actions, escalated, accounts, hashtags, statistics, activity. Moderator: reports, my escalations, actions. **No control returned 403**; a moderator reaching an administrator-only route gets *not available — this area is available to administrators only* with a way back, not an error |
| User-facing application | `/app/settings` loads for `seed_carol` with real values; `GET /users/me/settings` → **200**. The previous phase's 404 is resolved backend-side |

Screenshots: `audit-log-desktop-light.png`, `audit-log-desktop-dark.png`, `audit-log-narrow-dark.png`,
`my-escalations-narrow-dark.png`, `story-target-controls-narrow-light.png`,
`user-settings-loads-desktop.png`.

---

## 9. Console

Every console error observed across the whole run, and why each one is there:

| Error | Cause |
|---|---|
| `401` on `/api/v1/auth/refresh` | The bootstrap refresh attempt while signed out. Pre-existing and expected on the sign-in screen |
| `ERR_NAME_NOT_RESOLVED` on `cdn.example.local/…` and `cdn.example/…` | Seed and e2e fixture media rows pointing at hosts that do not exist. Fixture data, not panel behaviour; two story rows were repointed at local images, the rest were left as seeded |
| `409` on `/admin/messages/{id}/remove` and `/restore`, plus two `[QueryClient]` lines | The conflict branch **deliberately driven** in §1. The panel surfaced them as *another reviewer already handled this* |
| `401` on `/api/v1/auth/session` | A hand-rolled diagnostic `fetch` run from the console during debugging, which carried no `Authorization` header. Not an application request — the app's own call to the same endpoint returned `200` |

**No unexplained console error appeared during any check.**
