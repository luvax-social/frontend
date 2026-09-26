# Uptake Contract Verification

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

Everything below was produced by calling a running server. Nothing is carried over from the
handoff's prose, from `openapi.json`, or from any previous phase's document. Where this phase's
prompt or the handoff states something the server contradicts, the server wins and the divergence
is recorded in §8.

**Committed before the first line of feature code**, as the phase requires.

## 0. Environment this was captured against

| Fact | Value |
|---|---|
| Backend build | `backend@develop` = `69aedbfc` (merge of `feat/admin/panel-backend-requests`, PR #173) |
| Jar | rebuilt this phase; the jar already on disk was from 2026-08-22 01:45 and **predated** the new work (2026-08-23 22:00–23:36), so it did not contain the eight endpoints |
| Flyway | `Current version of schema "public": 82` |
| Compose | `postgres`, `redis`, `rabbitmq`, `elasticsearch`, `mailpit`, `gorse` — all healthy |
| Seed | `bash scripts/seed-dev-data.sh --reset` run against the live stack |
| Base URL | `http://localhost:8080/api/v1` |

Two environment notes that cost time and are recorded so the next person does not repeat them:

- The compose project is **`app`**, not `backend`. The named volumes are `app_postgres_data` and
  friends. `docker compose up -d` from `backend/` creates a *second, empty* project. Use
  `docker compose -p app up -d`, and `COMPOSE_PROJECT_NAME=app bash scripts/seed-dev-data.sh --reset`
  or the script cannot find postgres and refuses.
- The containers were removed (not stopped) partway through this session by something outside it.
  The named volumes survived, so `-p app` brought the same data back intact.

## 1. The eight new endpoints

All eight exist and all eight were called. Common to the four content actions and the session
revocation: body `{"reason": "...", "reportId": "..."}`, `reason` mandatory
(blank → `400 VALIDATION_ERROR`, `{"reason":"must not be blank"}`), response is the standard
audit-row `AdminActionResponse`.

### 1.1 `PATCH /api/v1/admin/stories/{storyId}/remove` and `/restore`

Callable by a **moderator**. Verified against story `852f98a0` (live) and `a4b3ee85` (expired).

| Call | Result |
|---|---|
| remove, live story | `200`, `actionType: remove_story`, `targetEntityType: story`, `metadata: null` |
| remove again | `409 ADMIN_INVALID_TRANSITION` — "Target is already in the requested moderation state" |
| restore | `200`, `actionType: restore_story`, `reportId: null` |
| restore again | `409 ADMIN_INVALID_TRANSITION` |
| remove with `{}` | `400 VALIDATION_ERROR` `{"reason":"must not be blank"}` |
| restore a story id that does not exist | `404 STORY_NOT_FOUND` — "Story not found" |

**The expired-story behaviour, which is the point of the check.** Story `a4b3ee85` was already
expired (`expires_at` 2026-08-22 16:24 +07, in the past). Removing it answered `200`. Restoring it
answered a **bare `200`** — an ordinary success audit row, with nothing in the response
distinguishing it from restoring a live story. Afterwards the row has `deleted_at` cleared and
`expires_at` still in the past: a live row that no feed shows.

The cleanup-job case is the `404 STORY_NOT_FOUND` above: once a story is both removed and expired
and the job has deleted it, restore answers 404, not a success.

**The panel cannot tell these apart before acting, and this is the finding that shapes the copy.**
The report target payload for a story carries exactly:

```
reportType, entityId, ownerId, ownerUsername, status, text, mediaUrls, removed, createdAt
```

There is **no `expiresAt`**, and expiry is **not derivable from `createdAt`**. Measured on the four
stories in this database:

| Story | `created_at` | `expires_at` | `expires_at - created_at` |
|---|---|---|---|
| `852f98a0` | 2026-08-21 22:08:05 | 2026-08-23 21:02:26 | `+1 day 22:54:21` |
| `a4b3ee85` | 2026-08-22 17:24:13 | 2026-08-22 16:24:15 | **`-00:59:57`** |
| `190eb61f` | 2026-08-22 17:27:05 | 2026-08-22 16:27:08 | **`-00:59:57`** |
| `972211ab` | 2026-08-22 17:28:14 | 2026-08-22 16:28:16 | **`-00:59:57`** |

Three of the four expire an hour *before* they were created. A `createdAt + 24h` rule would call all
three unexpired, which is the opposite of the truth. So the panel must not compute expiry; it states
the mechanism instead. See `design-decisions.md`.

### 1.2 `PATCH /api/v1/admin/messages/{messageId}/remove` and `/restore`

Callable by a **moderator**. Verified against message `67c36c6f` (live) and `a9a54362`
(sender-deleted).

| Call | Result |
|---|---|
| remove, live message | `200`, `actionType: remove_message` |
| restore | `200`, `actionType: restore_message` |
| restore a message that moderation has **not** removed | `409 ADMIN_INVALID_TRANSITION` |
| remove a message the **sender** already deleted | `200` — permitted |
| restore that message afterwards | `200` — permitted |

**What the reviewer sees while a message is removed.** The report target payload was read before,
during, and after. While removed it carries `removed: true` and **still carries the full text**
(`"text": "e2e message body"`). Removal withholds the content from the two *participants*; it is not
withheld from the reviewer. The prompt asked this to be verified rather than assumed — it is not
withheld, so no view-side redaction is needed or wanted.

**The sender-deleted rule is not what the handoff describes.** The schema carries two independent
columns:

```
messages.is_deleted / deleted_at   -- the sender's own deletion
messages.admin_removed_at          -- moderation's removal
```

They do not interact. The `409` on a sender-deleted message occurs because `admin_removed_at` is
null — it is the ordinary "already in the requested state" refusal, **not** a special rule about
sender deletion, and it carries the same code and message as a double restore. Once moderation
*has* removed such a message, restoring it answers `200` and leaves `is_deleted = true`: the message
stays invisible to both participants because the sender's deletion is untouched. Confirmed by
direct read after the call:

| Message | `is_deleted` | `admin_removed_at` |
|---|---|---|
| `a9a54362` after moderation remove **and** restore | `t` | `null` |

So a message restore, like a story restore, is not a promise that the content comes back.

### 1.3 `DELETE /api/v1/admin/users/{userId}/sessions/{sessionId}`

**Administrator only** — a moderator receives `403 FORBIDDEN`. Body is the same reason-carrying
`AdminActionRequest`.

| Call | Result |
|---|---|
| revoke a live session | `200`, `actionType: revoke_session`, `metadata: {"alreadyRevoked": false, "sessionId": "..."}` |
| revoke the **same** session again | `200`, `metadata: {"alreadyRevoked": true, "sessionId": "..."}` — a double click is safe |
| same session id under a **different** account | `404 NOT_FOUND` |
| the account's other sessions | survive: the listing went 27 → 26, one row removed |
| moderator attempting it | `403 FORBIDDEN` |

`metadata.alreadyRevoked` is the useful part: it lets the panel avoid telling a reviewer it just
ended a live session when it in fact ended nothing.

### 1.4 `POST /api/v1/auth/session`

| Call | Result |
|---|---|
| with the refresh token belonging to the caller's own login | `200`, `{"sessionId": "6bf2ea5d-2a71-41b6-9fcf-b9833d3b3b3b"}` |
| with `{}` and no refresh cookie | `200`, `{"sessionId": null}` |
| with a refresh token from an **older, rotated** login | `200`, `{"sessionId": null}` |

The null case is not an error and must not be rendered as one. `CurrentSessionResponse` documents it
as "Null when the request carried no usable refresh token", which the third row above reproduces:
the token had been rotated by a later login.

**Correlation is the only mechanism.** There is no session listing endpoint at all — the rows come
embedded in `AdminUserDetailResponse.sessions`, and each row carries only:

```
id, deviceId, userAgent, ipAddress, createdAt, expiresAt
```

No per-row marker of any kind. Marking the caller's own row means matching this endpoint's
`sessionId` against `row.id`, and nothing else can be derived.

### 1.5 `GET /api/v1/admin/user-summaries`

Callable by a **moderator** as well as an administrator, which is what makes it usable on the report
queue.

- Parameter name is **`ids`**.
- **Both** wire forms work: repeated `ids=a&ids=b&ids=c`, and a single comma-joined
  `ids=a,b,c`.
- **`ids[]=a` is rejected with `400`** (a Tomcat-level HTML 400, not the JSON envelope). This is
  Axios's default array serialisation, so the panel must override `paramsSerializer` for this call
  or it fails outright. This is the single most consequential wire detail in this document.

| Call | Result |
|---|---|
| four ids, order `carol, alice, unknown, bob` | `200`, four entries **in exactly that order** |
| an unknown id | present as `{"userId": "...", "found": false, "user": null}` — not omitted |
| exactly 100 ids | `200`, **100 entries** |
| 101 ids | `400 BAD_REQUEST` — "At most 100 identifiers may be resolved in one call" |
| no `ids` parameter | `400 MISSING_REQUIRED_PARAMETER` |
| `ids=` (empty) | `200`, `[]` |

Entry shape:

```json
{"userId":"...","found":true,
 "user":{"id":"...","username":"seed_carol","displayName":"Seed Carol",
         "avatarUrl":null,"isVerified":false}}
```

Display fields only — no status, role, or email, exactly as the handoff says.

### 1.6 `GET /api/v1/reports/escalated/mine`

Declares **`cursor` and `limit` only**. `?status=escalated` →
`400 BAD_REQUEST` "Unsupported query parameter: status. Accepted: cursor, limit".

The behaviour that matters, driven end to end:

1. `seed_mod` escalated report `4e9e73c2`.
2. As `seed_mod`, `escalated/mine` returned it: 1 row, `status: escalated`.
3. `seed_admin` **resolved** that report.
4. As `seed_mod`, `escalated/mine` returned it **again**, now `status: resolved`.

So a report an administrator has since closed still appears. That is the whole point of the
endpoint, and it is confirmed rather than assumed.

As `seed_admin`, the same call returned **0 rows** — its own escalations, of which the administrator
has none, not everyone's.

Related and separately confirmed: the moderator can still `GET /reports/4e9e73c2` after closure
(`200`), the documented exception that keeps its own escalations readable.

Payload key is **`content`**, not `items`:
`{content: [...], pageInfo: {hasNextPage, hasPreviousPage, startCursor, endCursor}, degraded: false}`.

## 2. The five corrected facts

Each was re-established by calling. **Three of the five were already correct in the panel** — see
§8, this phase's prompt is wrong about them.

### 2.1 Window span limit and fine-bucket horizon are two different limits

Measured on `GET /api/v1/admin/stats/timeseries`:

| Request | Result |
|---|---|
| span 364 days, `granularity=day` | `200` |
| span **365** days, `granularity=day` | `200` |
| span **366** days | `400` — "The window may span at most one year" |
| span 400 days | `400` — same |
| `granularity=half_hour`, `from` = now − 29d | `200` |
| `granularity=half_hour`, `from` = now − **30d exactly** | `400` |
| `granularity=half_hour`, `from` = now − 31d | `400` — "Fine buckets are kept for 30 days; a window reaching further back can only be read at day granularity" |
| `granularity=half_hour`, **one-hour** window starting 31d ago | `400` — same |
| `granularity=day`, `from` = now − 31d | `200` |

The one-hour-window row is the proof that the horizon is applied to **`from` alone**, not to the
span. The two limits are independent: span ≤ 365 days; `half_hour` only while `from` is inside 30
days. A 30-day-exactly `from` is already refused, so a control needs a margin below 30 days.

The activity log's own limit is separate and unchanged: `GET /admin/user-events` with a 31-day
window → `400` "The window may span at most 30 days"; 29 days → `200`.

### 2.2 Production rate limit on the statistics series and the activity log

**20 requests a minute** is the documented production figure. It is **not observable here**: 25
rapid `stats/timeseries` calls in the dev profile all returned `200` and no `RateLimit`,
`X-RateLimit`, or `Retry-After` header was returned on any of them. Recorded as
documentation-sourced, not measured, because the dev profile is looser than production and this
phase must build to production.

### 2.3 Worst case to a first statistics snapshot

Just under an hour: the interval is 30 minutes and the partial bucket the process starts inside is
discarded. `platform_stats` was empty for the whole of this session's verification, consistent with
that.

### 2.4 An out-of-range granularity is refused, not forced

| Request | Result |
|---|---|
| `granularity=half_hour` over a window older than the horizon | `400` (§2.1) |
| `granularity=hour` (not in the enum) | `400 BAD_REQUEST` — "Invalid request" |
| granularity **omitted**, 300-day window | `200`, server resolved `granularity: day` |
| granularity **omitted**, 1-day window | `200`, server resolved `granularity: half_hour` |

The server resolves from the window only when granularity is omitted. Note the last row: omission
does **not** mean "daily", it means "the server picks" — and for a short window it picks
`half_hour`.

### 2.5 Hashtag creation status code

`POST /api/v1/admin/hashtags` → **`201`**, envelope `code: "CREATED"`. Confirmed with a clean
status read, twice.

## 3. The renamed restore field

New name: **`remainingBannedHashtags`**. It appears in **two** places in one response — top-level in
`data`, and inside `data.action.metadata`.

The fixture had to be built in a specific order, which is itself worth recording: a post **cannot be
created** while its caption carries a banned tag (`400 POST_BANNED_HASHTAG`,
`data.bannedTags: ["uptakebanned"]`). So the post was created carrying two *active* tags, and the
tags were banned afterwards.

Post `f369e5c1`, caption `uptake restore probe #uptakekeep #uptakesecond`, both tags then banned:

**Restore #1**

```json
{"action":{"actionType":"restore_post",
           "metadata":{"resultingStatus":"published",
                       "remainingBannedHashtags":["uptakekeep","uptakesecond"]},
           "reason":"restore one"},
 "remainingBannedHashtags":["uptakekeep","uptakesecond"]}
```

**Restore #2** (post removed again, then restored again)

```json
{"action":{"actionType":"restore_post",
           "metadata":{"resultingStatus":"published",
                       "remainingBannedHashtags":["uptakekeep","uptakesecond"]},
           "reason":"restore two"},
 "remainingBannedHashtags":["uptakekeep","uptakesecond"]}
```

**Identical both times.** This establishes that the field is the post's present state — the banned
tags the caption still carries after the restore — and not the set that one call changed. Shape is a
flat array of tag names as plain strings, with no `#`.

The audit metadata key changed with it: the drawer previously read
`action.metadata.strippedHashtags` and must now read `action.metadata.remainingBannedHashtags`.
`resultingStatus` is unchanged and still present.

## 4. The extended payloads

### 4.1 `AdminUserDetailResponse.activeWarningCount`

Non-nullable. Driven through the whole sequence against `seed_carol`, reading the account detail
after each step:

| Step | `activeWarningCount` | `status` | `suspendedUntil` |
|---|---|---|---|
| clean account | `0` | `active` | `null` |
| after warning 1 | `1` | `active` | `null` |
| after warning 2 | `2` | `active` | `null` |
| **after warning 3** | **`0`** | **`suspended`** | **`2026-08-29T15:07:47Z`** |

The warning response itself carries `activeWarningCount`, `strikeIssued`, and `strike`. On the third:
`"activeWarningCount": 0, "strikeIssued": true, "strike": {...}`.

So the third warning does three things at once: it issues a strike, it **resets the active warning
count to zero**, and it **suspends the account for seven days**. All three belong in the warning
copy; stating only the strike is the omission the previous phase already had to fix once.

### 4.2 Violations with revoked records

`GET /api/v1/admin/violations/for-user/{userId}` declares `cursor`, `limit`, `includeRevoked`
(default `false`). Rows carry `kind: "warning" | "strike"`.

Against `seed_carol` after one warning and one strike were revoked:

| Setting | Rows |
|---|---|
| omitted (default) | **2** — both live warnings, `revokedAt: null` |
| `includeRevoked=true` | **4** — adds the revoked strike and the revoked warning |

A revoked record carries `revokedAt` (timestamp) and `revokedBy` (a **user id**, so it needs name
resolution like every other actor id):

```json
{"kind":"strike","id":"dc48bfac-...","strikeNumber":1,
 "revokedAt":"2026-08-22T15:08:20.702549Z",
 "revokedBy":"2f0d04c6-efcd-42b1-92af-22c1bd44d758"}
```

**The cursor is scoped on the flag.** The cursor prefixes differ (`YWRtdmZh…` = `admvfa` with
revoked, `YWRtdmY…` = `admvf` without), and crossing them is refused **in both directions**:

| Replay | Result |
|---|---|
| cursor from `includeRevoked=true` → default listing | `400 INVALID_CURSOR` — "Malformed pagination cursor" |
| cursor from default listing → `includeRevoked=true` | `400 INVALID_CURSOR` |

So toggling must restart pagination, never carry a cursor across.

Revoke paths, for the record: `DELETE /admin/warnings/{warningId}` and
`DELETE /admin/strikes/{strikeId}`. There is no `/revoke` suffix; using one answers `404`.

### 4.3 The audit log's new filters

`GET /api/v1/admin/actions` now accepts `targetUserId`, `from`, `to` alongside `adminId`,
`actionType`, `cursor`, `limit`.

| Request | Result |
|---|---|
| `targetUserId=<carol>` | 6 rows, all against carol: `warn_user`, `issue_strike`, `revoke_warning`, `revoke_strike` |
| `from` = 2h ago, `to` = now | 20 rows |
| `targetUserId` + `from` + `to` + `actionType=warn_user` | 3 rows, `actionType` all `warn_user` — they compose |

**The window is half-open, verified at the boundary** rather than assumed. Taking a real row's
`createdAt` as the pivot (`2026-08-22T15:09:28.915675Z`):

| Request | Contains the pivot row? |
|---|---|
| `from=<pivot>` | **yes** — `from` is inclusive |
| `to=<pivot>` | **no** — `to` is exclusive |

**They do not bypass moderator scoping.** As `seed_mod`, `?targetUserId=<carol>` returned **0 rows**,
because every action against carol was taken by the administrator. The filter narrows within the
moderator's own actions; it does not widen to anyone else's.

### 4.4 Media on post rows, and none on comment rows

The endpoints are `GET /api/v1/admin/content/for-user/{userId}/posts` and `/comments` — note **not**
`/admin/content/user/{userId}`, which is a different endpoint returning the single-entity target
shape.

`AdminPostSummaryResponse`: `id, userId, username, status, caption, removed, likeCount,
commentCount, createdAt, mediaUrls`.

`AdminCommentSummaryResponse`: `id, userId, username, postId, parentId, content, moderationStatus,
removed, likeCount, createdAt` — **no `mediaUrls`**, confirmed against both the schema and a live
call.

Post rows also already carry `username`, so they never needed identifier resolution.

Live call: all three of alice's posts returned `mediaUrls: []`. `select count(*) from post_media` is
**0** in this database — every seeded post is a text post, and media upload needs R2 credentials the
dev stack does not have. Fixture media rows are inserted for the rendering check; recorded in
`verification-evidence.md`.

## 5. The changed rules

### 5.1 The report endpoints now reject undeclared parameters

| Request | Result |
|---|---|
| `GET /reports?bogus=1` | `400` — "Unsupported query parameter: bogus. Accepted: cursor, limit, reportType, status" |
| `GET /reports/pending?bogus=1` | `400` — "Unsupported query parameter: bogus. Accepted: cursor, limit" |
| `GET /reports/escalated/mine?status=escalated` | `400` — "Accepted: cursor, limit" |

Note `/reports/pending` accepts **only** `cursor` and `limit` — not `reportType`, not `status`.

### 5.2 `GET /api/v1/users/me/settings` succeeds for a seed account

As `seed_carol`: **`200`**, with the full settings body (`notifyLikes`, `notifyComments`,
`notifyFollows`, `notifyMentions`, `notifyMessages`, `showActivityStatus`, `allowStoryReplies`,
`allowMessageRequests`, `updatedAt`). The previous phase's diagnosis was correct and the defect is
resolved backend-side. A 404 here is now a real fault.

### 5.3 An omitted suspension duration

`PATCH /admin/users/{userId}/suspend` with `{"reason": "..."}` and **no `durationDays`** →
`200`, `actionType: suspend_user`.

The account afterwards reads:

```
status = suspended        suspendedUntil = null
```

This is the trap the phase names. `suspendedUntil` is `null` for an indefinitely suspended account
and *also* `null` for an account that is not suspended at all — `AdminUserDetailResponse` documents
it as "null when the account is not suspended **or the suspension is indefinite**". **`status` is the
only field that distinguishes them**, and anything keying off `suspendedUntil` alone reads an
indefinitely suspended account as unsuspended.

### 5.4 Which activity-log event types write rows in this environment

Established by **producing each one and reading the log back**, not by reading a constant.

Starting state after the seed reset: `session_start` only.

| Event produced by | Type written |
|---|---|
| `POST /auth/login` | `session_start` |
| `GET /users/search?q=` | `search` |
| `GET /users/{id}` | `profile_view` |
| `POST /posts/{id}/view` (`202`) | `post_view` |
| `POST /posts/{id}/like` (`201`) | `post_like` |
| `POST /posts/{id}/save` (`201`) | `post_save` |
| `POST /posts/{id}/comments` (`201`) | `post_comment` |

Final read of `user_events`:

```
post_view 1 | post_like 1 | post_save 1 | post_comment 1
profile_view 2 | search 2 | session_start 35
```

**All seven types write rows here.** The four engagement types land because `gorse` is running as
part of this local stack. Each of the seven was then accepted as an `eventType` filter value on
`GET /admin/user-events` and returned its rows.

This is a **development-only** fact. Nothing about a production deployment of that service was set
up, so a production panel sees three types. The filter is gated on the environment for exactly this
reason; see `design-decisions.md`.

## 6. The report reason list

`GET /config/vocabularies` → `reportReasons`, `notificationTypes`, `moderationActions`.

| Reason | `appliesTo` |
|---|---|
| `spam` | `[]` |
| `nudity` | `["post","comment","story","message"]` |
| `violence` | `["post","comment","story","message"]` |
| `hate_speech` | `["post","comment","story","message"]` |
| `harassment` | `[]` |
| `false_information` | `["post","comment","story"]` |
| `scam` | `[]` |
| `other` | `[]` |

Exactly the four the handoff names carry an empty list: **`spam`, `harassment`, `scam`, `other`**.
An empty `appliesTo` means **every** report type, never none. A filter that treats empty as "matches
nothing" loses these four from every reason list. Note also that `false_information` is the one
reason that does **not** apply to `message`.

## 7. Non-schema facts worth carrying forward

- The paginated envelope key is **`content`** across `escalated/mine`, violations, audit actions,
  account content, and hashtag search. Not `items`.
- `pageInfo` is `{hasNextPage, hasPreviousPage, startCursor, endCursor}` and sits beside a
  `degraded` boolean.
- `endCursor` is non-null past the end of a listing, so `hasNextPage` remains the only stop
  condition.
- Cursors are opaque base64 carrying a scope prefix. They are rejected across scopes (§4.2) and, as
  earlier phases recorded, across roles.

## 8. Divergence table

### 8.1 Against this phase's prompt

| # | The prompt says | The server / codebase says | Consequence |
|---|---|---|---|
| 1 | "The statistics **window span** limit and the separate **fine-bucket horizon** … The panel currently conflates them." | The panel does **not** conflate them. `lib/statistics.js` already carries `MAX_WINDOW_DAYS = 365` and `FINE_HORIZON_DAYS = 30` as separate constants, with `isGranularityAvailable` applying the horizon to `from` alone plus a 5-minute margin, and `clampRange` applying the span. The observability phase found and fixed this (its `design-decisions.md` §529). | Nothing to rebuild. Re-verified against the server and confirmed correct; the control is checked in the browser rather than rewritten. |
| 2 | "**The rate-limit budgets** … corrected to the verified production figure." | Already 20. `DateRangeControl.jsx:15` and `useRateLimitCooldown.js:8` both already say "20 requests a minute in production". | Nothing to correct. |
| 3 | "**The pre-collection message**, corrected to the verified worst case." | Already correct. `StatisticsScreen.jsx:398` already says "the first readable bucket appears **within an hour** of the server starting". | Nothing to correct. |
| 4 | "A message the sender already deleted cannot be restored. The refusal is surfaced as what it is, not as a generic failure." | The refusal **is** the generic failure — identical code and message to a double restore (`409 ADMIN_INVALID_TRANSITION`), because `is_deleted` and `admin_removed_at` are independent columns. Once moderation has removed such a message, restore answers `200` and the message stays hidden by the sender's deletion. | The panel cannot distinguish the two 409s by response. It distinguishes by the target's `removed` flag and words the outcome accordingly. See `design-decisions.md`. |
| 5 | "Where a story has expired … the reviewer is told what actually happened rather than shown a bare success." | A restore of an expired story **is** a bare success, and the target payload carries no `expiresAt`, and expiry is not derivable from `createdAt` (§1.1). | The panel states the mechanism truthfully instead of fabricating a per-story determination it cannot make. Recorded as a new backend request. |
| 6 | "The panel currently resolves account ids one at a time **and caches each**." | Correct. `useResolveUsername` + `ReporterName`, `staleTime/gcTime: Infinity`, keyed `['admin','username',userId]`. | Genuine work; the highest-risk item, as stated. |
| 7 | Batch resolution "up to a hundred in a single request". | Correct, and the wire form matters more than the bound: **`ids[]=` is rejected with 400**, which is Axios's default array serialisation. | The API layer must set an explicit `paramsSerializer` for this call. |
| 8 | Implies a session **listing** endpoint. | There is no listing endpoint. Sessions are embedded in `AdminUserDetailResponse.sessions`. | Marking the caller's row is a correlation against the embedded array. |

Items 1, 2 and 3 mean **three of the five "corrected facts" were already taken up by the previous
phase**. They were re-verified against the server this phase and are recorded here as confirmed, not
rebuilt. The two that were genuinely wrong in the panel are the suspension duration (§5.3) and the
static three-warning statement (§4.1).

### 8.2 Against the handoff

| The handoff says | Actually |
|---|---|
| "A message the **sender** deleted cannot be restored by moderation and answers 409." | True only while moderation has not removed it, and for the ordinary already-in-state reason. After a moderation removal, restore answers `200` and the sender's deletion still hides the message. |
| "Message removal withholds the text … from both participants." | True for participants. **Not** withheld from the reviewer: the report target still carries the full text with `removed: true`. |
| An out-of-range granularity "resolves to daily only when you name no granularity at all". | True, but omission does not imply daily — for a 1-day window the server resolves to `half_hour`. |

### 8.3 Against the five prior verification documents

| Prior document | What it recorded | Now |
|---|---|---|
| `admin-panel-reconnaissance/api-contract-verification.md` §5.4 | restore returns `{action, droppedHashtags}`; `action.metadata.strippedHashtags` | **Superseded.** Both keys renamed to `remainingBannedHashtags`, and the meaning changed from "dropped by this call" to "still carried after the restore". |
| `admin-panel-foundation-and-reports/report-contract-verification.md` items 13–14 | same `droppedHashtags` shape | **Superseded**, same rename. |
| `admin-panel-accounts-and-hashtags/accounts-contract-verification.md` §suspend | "`durationDays` … the panel treats `durationDays` as a **required**, bounded input" | **Superseded.** Omitting it is supported and suspends indefinitely with `suspendedUntil: null`. Bounds 1..3650 remain correct when a duration *is* given. |
| `admin-panel-moderation-history-and-audit/discipline-contract-verification.md` §4.4.2 | "there is no date range and no target filter" on the action log | **Superseded.** `targetUserId`, `from`, `to` now exist and compose with moderator scoping. |
| `admin-panel-observability-and-hardening/observability-contract-verification.md` §160–169, §286–290 | fine horizon 30 days on `from` alone; activity-log window limit 30 days inclusive; window limit one year | **Confirmed unchanged.** All three re-measured this phase and identical. This document's §2.1 reproduces them. |
| `admin-panel-observability-and-hardening/observability-contract-verification.md` §2.3 | the four engagement event types "dead-letter in every environment the panel can observe" | **Superseded.** With `gorse` in the default local stack all four now write rows (§5.4). Development only. |
| `admin-panel-observability-and-hardening/deferred-findings.md` | "revoked records vanish" accepted; event filter should widen "if that service is deployed" | **Both now answered.** `includeRevoked` exists; the service is deployed locally. Corrected in place. |

## 9. What still cannot be done

Unchanged from the handoff, and no route is designed for any of it:

- No totals on any list, anywhere, except the escalated-report counter.
- No per-row "this is you" marker in the session payload — correlation only.
- No media on comment rows.
- No un-revoking a session.

Added by this phase's measurements:

- **A story's expiry is not readable by the panel.** No `expiresAt` on the report target and no
  derivable window. Carried into `backend-request.md` and `deferred-findings.md`.
- **A moderation restore refusal cannot be told apart from a double-click refusal** by response
  alone; both are `409 ADMIN_INVALID_TRANSITION` with the same message.
