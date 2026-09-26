# Observability Contract Verification

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

Everything below was observed against the running backend on this machine, or read from the backend
source at `../backend/src/main/java/...`. Where a fact comes from source rather than from a call it
is labelled **read from source**. Nothing here is inferred from the OpenAPI document alone.

Committed before the first line of this phase's feature code.

Environment: compose stack healthy (postgres, redis, rabbitmq, elasticsearch, mailpit), application
up and collecting. `platform_stats` held 18 contiguous `half_hour` buckets spanning
`2026-08-21T19:00:00Z` → `2026-08-22T03:30:00Z` when verification began, so the statistics surface
was verified against real collected data rather than against an empty table.

**`scripts/seed-dev-data.sh --reset` was deliberately not re-run.** Line 148 of that script is
`DELETE FROM platform_stats;`. Re-running it would have destroyed the eight and a half hours of
collected buckets that make this phase verifiable, and the first replacement bucket would not have
existed for another 30–60 minutes. The seed accounts were confirmed present and usable instead
(`seed_admin`, `seed_mod`, `seed_alice`, `seed_bob`, `seed_carol`). This is recorded as a deviation
from the stated prerequisite, made because following it literally would have defeated its purpose.

---

## 1. Statistics

### 1.1 Paths and who may call them

| Path | Method | Callable by |
|---|---|---|
| `/api/v1/admin/stats/current` | GET | administrator only |
| `/api/v1/admin/stats/timeseries` | GET | administrator only |

Both paths confirmed live. A moderator receives `403 FORBIDDEN` on each:

```
GET /api/v1/admin/stats/current   (moderator)  -> 403
{"success":false,"code":"FORBIDDEN","message":"Access to this resource is forbidden"}
```

**Read from source:** `AdminStatsController` carries a class-level `@PreAuthorize("hasRole('ADMIN')")`.
Its own comment explains why: these paths sit under `/api/v1/admin/` but outside the
`/api/v1/admin/users/**` sub-tree, so the `SecurityConfig` matcher that applies is the broader
`/api/v1/admin/**` rule which admits a moderator, and the narrowing is done in the controller.

### 1.2 `stats/current`, every field

Called live as `seed_admin`. Every field of the response, with the value observed:

| Field | Observed | Notes |
|---|---|---|
| `bucketStart` | `2026-08-22T03:30:00Z` | start of the newest completed bucket |
| `computedAt` | `2026-08-22T04:16:21.951099Z` | **not null** — collection had run |
| `totalUsers` | `170` | scalar |
| `usersByStatus` | `{active:168, banned:1, suspended:1}` | map |
| `usersByRole` | `{admin:1, moderator:1, user:168}` | map |
| `totalPosts` | `3` | scalar |
| `totalComments` | `3` | scalar |
| `totalStories` | `0` | scalar |
| `reportsByStatus` | `{dismissed:1, escalated:1, resolved:1}` | map |
| `reportsByReason` | `{harassment:1, scam:1, spam:1}` | map |
| `topHashtags` | 4 entries, each `{name, postCount}` | `food`, `photography`, `sunset`, `travel`, all `postCount: 0` |
| `topHashtagsLive` | `true` | **read from source:** hardcoded `true` in `AdminStatsServiceImpl.getCurrent()`; it is not a flag that can ever read `false` |

**The computed-at timestamp is not null in this environment.** The null case is therefore
constructed for the screen rather than observed here; see §1.7 for how the panel reaches it and
§7 for how that limitation is handled honestly.

`computedAt` is derived as the maximum `computed_at` across the rows of the newest bucket, and is
null only when that bucket set is empty — i.e. when nothing has ever been collected.

### 1.3 Collection cadence and time-to-first-bucket — **read from source**

`StatsCollectionJob.java`:

```java
@Scheduled(
    initialDelayString = "${app.stats.interval:PT30M}",
    fixedDelayString   = "${app.stats.interval:PT30M}")
public void collect() { collectDue(Instant.now()); }
```

`StatsProperties.java` defaults `interval` to `PT30M`, `fineRetention` to `P30D`, `dailyRetention`
to `P365D`, `rollupCron` to `0 20 3 * * *` (UTC). No `app.stats.*` override exists in
`application-dev.yml` or `application-prod.yml`, so every default is in force.

Consequences, all from source:

- The first collection pass runs **30 minutes after startup**, then every 30 minutes thereafter.
- `StatsBuckets.firstFullBucket` skips the bucket the process started inside, because a partial
  bucket would record a fraction of an interval as though it were a whole one and there is no
  backfill to correct it.
- Buckets are aligned to the **epoch**, not to process start.
- Therefore the worst case from a cold start to the first readable bucket is just under
  **60 minutes** (up to 30 minutes of partial bucket that is discarded, then the 30-minute initial
  delay), and the best case is 30 minutes. **"Within 30 minutes" — the wording the handoff asks the
  empty state to use — understates it.** The panel says *within an hour*, which is the honest bound.
- `MAX_BUCKETS_PER_PASS = 48`, so a pass after an outage catches up at most 24 hours of buckets and
  the remainder is picked up by later passes.

### 1.4 `stats/timeseries` with no parameters — what the server resolved

```
GET /api/v1/admin/stats/timeseries        (no query string at all)
```

Every value the server chose:

| Resolved | Value |
|---|---|
| `metric` | `registrations` (controller `@RequestParam(defaultValue = "registrations")`) |
| `granularity` | `half_hour` (resolved from the window, not defaulted) |
| `from` | `2026-08-21T04:34:07.2968435Z` — now minus 24 hours |
| `to` | `2026-08-22T04:34:07.2968435Z` — now |
| `points` | 18 |

**Read from source:** `AdminStatsService.DEFAULT_TIMESERIES_WINDOW = Duration.ofHours(24)`. Both
bounds absent means the last 24 hours; exactly one bound present is refused (§1.6).

### 1.5 Accepted metrics and granularities

**Fourteen metrics**, read from `PlatformMetric.java` and each confirmed to return `200` live:

| Key | Kind | Breakdown |
|---|---|---|
| `users_total` | gauge | none |
| `users_by_status` | gauge | by status |
| `users_by_role` | gauge | by role |
| `posts_total` | gauge | none |
| `comments_total` | gauge | none |
| `stories_total` | gauge | none |
| `reports_by_status` | gauge | by status |
| `reports_by_reason` | gauge | by reason |
| `registrations` | flow | none |
| `posts_created` | flow | none |
| `comments_created` | flow | none |
| `follows_created` | flow | none |
| `likes_created` | flow | none |
| `admin_actions_by_type` | flow | by action type |

The gauge/flow split is not presentation detail. **Read from source**, from `PlatformMetric`'s own
documentation: a gauge is the state of the world at the end of the bucket; a flow is how much
happened inside it. The daily roll-up **sums** flows across a day's buckets and takes the **last**
value for gauges. Summing 48 snapshots of "total users" would produce a number 48 times too large.
The panel therefore never aggregates a series itself — it renders the points the server returned.

**Two granularities**, read from `StatGranularity.java`: `half_hour` and `day`. Note these are the
wire values; the handoff's prose says "daily", and there is no `hour` value — `granularity=hour`
is refused with `400 Invalid request`.

### 1.6 Refusals, with the exact boundary

Each row was found by bisecting against the live server.

| Request | Result | Message |
|---|---|---|
| `from` supplied, `to` absent | `400` | `Supply both 'from' and 'to', or neither for the last 24 hours` |
| `to` not after `from` | `400` | `'to' must be later than 'from'` |
| window of **exactly 365 days** | `200` | — |
| window of **366 days** | `400` | `The window may span at most one year` |
| `granularity=half_hour`, `from` = now − 29d 23h 58m | `200` | granularity honoured |
| `granularity=half_hour`, `from` = now − 30d 0h 02m | `400` | `Fine buckets are kept for 30 days; a window reaching further back can only be read at day granularity` |
| `granularity=day`, same out-of-range window | `200` | day is always available |
| `granularity` omitted, same out-of-range window | `200` | server resolved `day` itself |
| `metric=bogus_metric` | `400` | `Invalid request` |
| `granularity=hour` | `400` | `Invalid request` |

**The two limits are different things and the prompt conflates them.**

- The **window limit is one year**, applied to the span `to − from`.
- The **fine-granularity horizon is 30 days**, applied to `from` alone against `now`. It is a rolling
  boundary: `from.isBefore(now.minus(fineRetention))` forces `day`. A one-hour window whose `from`
  is 31 days old is still refused at `half_hour`, even though the window is tiny.

**Read from source**, `AdminStatsServiceImpl.resolveGranularity`, on why the refusal exists rather
than an empty answer: the rows were rolled up and deleted, and an empty chart is indistinguishable
from a stretch in which nothing happened. Requesting `day` over a recent window is always honoured;
only `half_hour` over an old window is refused.

### 1.7 Empty result versus zero-valued buckets — **the distinction, established from the server**

These are three genuinely different server responses and the screen renders all three differently.

**(a) Empty — no buckets exist in the window.** `points` is an empty array.

```
GET .../timeseries?granularity=day&from=<now-30d-2m>&to=<now>
-> 200 {"metric":"registrations","granularity":"day","from":...,"to":...,"points":[]}
```

No daily rows have ever been rolled up on this deployment, so every day-granularity read returns
`[]`. This says *nothing was ever recorded here*.

**(b) Measured zero — buckets exist and their value is 0.**

```
GET .../timeseries                       (last 24h, half_hour)
-> 18 points, every one {"bucketStart": ..., "dimension": "", "value": 0}
```

This says *the job ran, looked, and counted nothing*. It is a fact about the platform.

**Read from source**, `PlatformMetric`'s documentation, on why the two are distinguishable at all:

> `GROUP BY` produces no row for an empty group, so a dimension nobody holds in a bucket has no row
> rather than a row holding zero, and every reader treats a missing dimension as zero.

A metric with no breakdown selects the empty string as its dimension and uses a bare `count(*)`,
which returns one row even when the count is zero. So an un-broken-down metric in a collected bucket
always yields a point, and its value may legitimately be 0. A broken-down metric yields no row for a
dimension nobody holds. This was visible in the stored data: `registrations` has 18 rows (one per
bucket) while `users_by_status` has 39 rows across 18 buckets, because `banned` and `suspended`
only appear once accounts entered those states.

**(c) A gap — a bucket inside the window was never collected.** The bucket is simply absent from
`points`; there is no null placeholder and no zero.

To observe this, two mid-range buckets were deleted from `platform_stats`
(`2026-08-22 06:00+07` and `06:30+07`, 40 rows). This reproduces exactly what a missed collection
pass leaves behind — there is no backfill, so a bucket that was never written can never be written
later. Confirmed at the API level:

```
GET .../timeseries?metric=users_total&from=2026-08-21T19:00:00Z&to=2026-08-22T04:00:00Z
-> 16 points
   2026-08-21T22:30:00Z  170
   2026-08-22T00:00:00Z  170     <- 23:00Z and 23:30Z absent, not zero
```

**A chart that joins 22:30 to 00:00 with a straight line asserts two measurements that were never
taken.** The chart breaks the line across any interval wider than one bucket.

The fixture mutation is recorded in `deferred-findings.md`. It is not reversible; that is the point.

### 1.8 Rate limit

Called until refused, in one 60-second window:

```
timeseries: refused on the 61st call in the window  (10 boundary calls + 50 loop calls)
-> HTTP 429  TOO_MANY_REQUESTS
   Retry-After: 60
   {"success":false,"code":"TOO_MANY_REQUESTS","message":"Too many requests. Please wait before trying again."}
```

Configured budgets, read from source:

| Path | dev | **prod** |
|---|---|---|
| `/api/v1/admin/stats/timeseries` | 60 / 60s | **20 / 60s** |
| `/api/v1/admin/user-events` | 60 / 60s | **20 / 60s** |
| `/api/v1/admin/users/search` | 60 / 60s | 40 / 60s |
| `/api/v1/admin/hashtags/search` | 60 / 60s | 40 / 60s |
| `/api/v1/admin/**` | 150 / 60s | 120 / 60s |

**Divergence from the prompt.** The prompt states these two endpoints are "the tightest in the
system at 30 per minute". The documented production figure is **20 per minute** — tighter still.
The panel is built to 20.

---

## 2. Activity log

### 2.1 Path, parameters, and which are required

`GET /api/v1/admin/user-events` — **administrator only**; a moderator receives `403 FORBIDDEN`
(confirmed live). **Read from source:** `AdminUserEventController` carries the same class-level
`@PreAuthorize("hasRole('ADMIN')")` and the same explanatory comment as the stats controller.

| Parameter | Required | Type | Notes |
|---|---|---|---|
| `userId` | no | uuid | omitting it reads across all accounts |
| `from` | **yes** | ISO date-time | |
| `to` | **yes** | ISO date-time | |
| `eventType` | no | enum | see §2.3 |
| `cursor` | no | string | scope `ADMIN_USER_EVENTS` |
| `limit` | no | int 1..100 | defaults to 20 |

The endpoint carries `@StrictQueryParameters`, so an undeclared key is refused.

### 2.2 Window boundary, found by bisection

| Request | Result | Message |
|---|---|---|
| no parameters at all | `400` | `Both 'from' and 'to' are required; the activity log has no unbounded read` |
| `from` only | `400` | same message |
| `to` not after `from` | `400` | `'to' must be later than 'from'` |
| window of **exactly 30 days** | `200` | — |
| window of **30 days + 1 second** | `400` | `The window may span at most 30 days` |

The boundary is exact to the second. **Read from source:** the check is
`Duration.between(from, to).compareTo(Duration.ofDays(30)) > 0`, so 30 days is inclusive.

### 2.3 Declared event types versus written event types

**Twenty declared**, read from `UserEventType.java`: `post_view`, `post_like`, `post_unlike`,
`post_save`, `post_unsave`, `post_share`, `post_comment`, `story_view`, `story_reply`,
`profile_view`, `profile_follow`, `profile_unfollow`, `search`, `hashtag_click`, `comment_like`,
`comment_reply`, `message_send`, `session_start`, `session_end`, `app_open`.

**Three written.** **Read from source**, `UserEventRecorder.java` — the only unconditional writer:

| Type | Line | Called from |
|---|---|---|
| `SESSION_START` | `UserEventRecorder.java:85` | `AuthServiceImpl.java:469` |
| `SEARCH` | `UserEventRecorder.java:97` | `PostSearchServiceImpl.java:71` and `:145`, `UserSearchServiceImpl.java:58` |
| `PROFILE_VIEW` | `UserEventRecorder.java:102` | `UserServiceImpl.java:163` |

The backend's own OpenAPI contract asserts the same thing in `AdminUserEventApi.java:32`:

> **Only three event types are ever written.** … The `event_type` enum declares seventeen further
> values that exist in the schema and have no writer, so a log showing only three kinds of row is
> the system working as designed and not a defect.

**A second writer exists that the handoff does not mention.** `RecommendationFeedbackConsumer.java`
writes four further types — `POST_LIKE`, `POST_SAVE`, `POST_VIEW`, `POST_COMMENT` — into the same
table through `UserEventJdbcRepository.insertIgnoreDuplicate`. It is gated on
`app.recommendation.consumer.enabled`, which is `true` in **both** `application-dev.yml` and
`application-prod.yml`. On the source alone, seven types have a writer, not three.

**It does not produce rows.** Tested end to end rather than assumed: a post was liked as
`seed_carol`, the engagement event was published, the queue depth rose to 1, a consumer was
confirmed attached and active on `recommendation.feedback.queue`, and the message then moved to
`recommendation.feedback.dlq` (depth 4 → 5). No `user_events` row appeared. The consumer cannot
complete because it calls a Gorse service that is not part of this deployment — there is no Gorse
container in the compose stack and no `gorse` key in any `application*.yml`.

Stored data over the life of this database, which agrees:

```
SELECT event_type, count(*) FROM user_events GROUP BY 1;
 search        |  1
 session_start | 54
```

**Settled: the filter offers exactly three options** — `session_start`, `search`, `profile_view`.
The reasoning is in `design-decisions.md`; the short form is that the four engagement types fail
the test the rule exists to apply, which is whether choosing the option can ever return a row.
Nothing is hidden by this: the unfiltered list renders whatever `eventType` a row carries, so if a
deployment ever does write an engagement row it appears in the list — only the filter shortcut is
absent, and that is recorded in `deferred-findings.md`.

### 2.4 Row shape, and whether it needs a second fetch

```json
{
  "id":         "223ab929-d449-4989-aedb-9765c26c4272",
  "userId":     "e13ebd6a-dde8-46a8-a882-42844934b462",
  "eventType":  "session_start",
  "entityType": null,
  "entityId":   null,
  "metadata":   null,
  "createdAt":  "2026-08-22T04:33:55.970314Z"
}
```

**Yes, it needs a second fetch.** `userId` is a raw uuid with no accompanying username, and
`entityId` likewise. This is the same problem section 13.8 of the handoff describes for the audit
log, and the panel already has the answer: `useResolveUsername`, which resolves one id through
`GET /api/v1/admin/content/user/{userId}` and caches it. Unlike the audit log the rows here are
usually all the *same* account, so a page of 20 rows costs one lookup.

`metadata` **is** present on the list rows (unlike the audit log, where it is omitted from the list
and only appears on the detail). A `search` row carries `{"scope": ..., "query": ...}`; a
`profile_view` row carries `entityType: "user"` and the viewed account as `entityId`.

### 2.5 Rate limit

```
user-events: refused on the 61st call in the window
-> HTTP 429  Retry-After: 60
```

Dev 60/60s, **production 20/60s**. Built to 20.

---

## 3. Sessions and the remaining account fields

### 3.1 There is no per-session endpoint, and no per-session revoke

Searched the whole backend source for a session detail or session revocation path. **Neither
exists.**

| What the prompt describes | What exists |
|---|---|
| an endpoint returning session detail | **none** — sessions arrive only as the `sessions[]` array embedded in `GET /api/v1/admin/users/{userId}` |
| an endpoint revoking *a* session | **none** — the only revocation is `POST /api/v1/admin/users/{userId}/force-logout`, which revokes **every** session of the account at once |

`GET /api/v1/admin/users/{userId}` and `POST /api/v1/admin/users/{userId}/force-logout` are both
**administrator only**. There is no path that accepts a session id.

This confirms the accounts phase's recorded note ("per-session revoke, which the API does not
currently expose") against the source rather than against expectation.

### 3.2 What a session record carries

**Read from source**, `AdminUserSessionResponse.java`, and confirmed live:

| Field | Type | Observed |
|---|---|---|
| `id` | uuid | `658d6696-5fac-4c3c-b6fe-79bff08b5ddd` — the refresh-token row identifier |
| `deviceId` | string, nullable | `null` on every session observed |
| `userAgent` | string, nullable | `"curl/8.14.1"`, `"node"` |
| `ipAddress` | string, nullable | `"::1"` |
| `createdAt` | timestamp | `2026-08-22T04:35:46.074693Z` |
| `expiresAt` | timestamp | `2026-09-21T04:35:46.073133Z` |

The record's own documentation: *"A session is live when its refresh token is neither revoked nor
past its expiry. The refresh token value itself is never exposed; only its row identifier and device
metadata are."*

There is no location, no city, no resolved device name, and no "current session" marker. The payload
cannot tell the reviewer which of these sessions is their own.

### 3.3 What revocation does to the other sessions

Performed against `seed_carol`, which held three live sessions:

```
before  3 sessions: [658d6696, a3aa3b5f, 837aa39d]
POST /api/v1/admin/users/{carol}/force-logout   {"reason": "..."}   -> 200
after   0 sessions: []
```

**All three died.** The action returns an `AdminActionResponse` with `actionType: "force_logout"`,
and its audit metadata records how many sessions were revoked. There is no way to end one session
and leave the others.

### 3.4 `reportsAgainst` — a list exists

It is a real array, not a count. **Read from source**, `AdminUserReportResponse.java`, confirmed
live against `seed_alice`:

```json
[{ "id":           "46e9f60d-80e2-4039-b0d7-1818faa8f846",
   "reporterId":   "a0bcedec-e369-497a-a9c9-6e2843dabe00",
   "reportReason": "harassment",
   "status":       "dismissed",
   "createdAt":    "2026-08-21T19:24:39.747154Z" }]
```

It carries a report id, so each row links to the existing report detail screen. Described in the
schema as "most recent reports filed against this account" — it is a bounded recent set, not a
paginated history, and there is no cursor behind it. The panel says so rather than implying the
list is complete.

### 3.5 The address fields — per account, not per session

Both kinds exist and they are different things.

| Field | Level | Observed on `seed_carol` |
|---|---|---|
| `registrationIp` | **per account** | `null` |
| `lastLoginIp` | **per account** | `"::1"` |
| `lastLoginAt` | **per account** | `2026-08-22T04:35:46.070108Z` |
| `sessions[].ipAddress` | **per session** | `"::1"` — recorded at that session's issuance |

`registrationIp` was null on every seed account, because the seed script inserts users directly
rather than through the registration path that records it. An address is an address: the panel
renders these as the literal strings the payload carries, and never as a location.

---

## 4. The user-facing settings defect

### 4.1 Reproduced

Reproduced at the API level across three different accounts, and end to end in the browser
(evidence in `verification-evidence.md`):

```
GET /api/v1/users/me/settings     Authorization: Bearer <seed_bob>
-> 404 {"success":false,"code":"NOT_FOUND","message":"Requested resource was not found"}

same for seed_carol  -> 404
same for seed_admin  -> 404
```

### 4.2 Cause: the backend, not the frontend

**The frontend is calling the correct path.** `src/services/user.service.js:26` issues
`GET ${USERS_API_PATH}/me/settings`, resolving to `/api/v1/users/me/settings`. The backend maps
exactly that path — `ApiConstants.Users.ROOT` (`/api/v1/users`) + `ME_SETTINGS` (`/me/settings`) —
on `UserController.getMySettings` at line 113, with the `PATCH` counterpart at line 123. Path,
method, and prefix all match. There is no frontend defect here.

**The 404 is a missing row.** `UserServiceImpl.getMySettings` (line 195):

```java
UserSettings settings = settingsRepository.findById(userId)
        .orElseThrow(() -> new AppException(ApiErrorCode.NOT_FOUND));
```

The row is absent for exactly the seed accounts:

```
SELECT count(*) FROM users;          -> 170
SELECT count(*) FROM user_settings;  -> 165

username   | has_settings
seed_admin | f
seed_alice | f
seed_bob   | f
seed_carol | f
seed_mod   | f
```

165 of 170 accounts have a settings row; the five that do not are precisely the five the seed script
creates. `scripts/seed-dev-data.sh` contains no `user_settings` insert (grepped). An account created
through normal registration gets its row and its settings page works; a seed account never had one.

**Per §3.4.4 this is recorded and nothing is changed.** The cause is in the backend and its seed
script, both read-only for this phase. It is carried into `docs/admin-panel/backend-request.md`.

Corroborating signal, not relied upon: the backend repository carries an unmerged branch named
`fix/users/seed-user-settings`, which suggests this is already known there.

---

## 5. Divergence table against all four prior verification documents

Compared against `admin-panel-reconnaissance/api-contract-verification.md`,
`admin-panel-foundation-and-reports/`, `admin-panel-moderation-history-and-audit/`, and
`admin-panel-accounts-and-hashtags/accounts-contract-verification.md`, plus the prompt and the
handoff.

| # | Claim, and where it is made | What was observed | Consequence |
|---|---|---|---|
| 1 | Prompt §2: timeseries and activity log are "the tightest in the system at 30 per minute" | production is **20/min** for both; dev is 60/min | panel built to 20 |
| 2 | Prompt §4.2.3 and handoff 14.14: clamp the statistics **date range** to a verified maximum implied to be 30 days | the **window** limit is **one year**; the **30-day figure is the fine-granularity horizon**, applied to `from` alone, not to the span | the range control clamps at one year; the 30-day rule drives the granularity control instead |
| 3 | Handoff 15.11 item 45: "set the range to start more than 30 days ago, **expect the granularity to be forced to daily**" | the server does **not** force; it **refuses** with `400` when `half_hour` is explicitly requested. It resolves to `day` only when granularity is *omitted* | the control prevents the refused combination itself, which is what the prompt asks for and what the handoff item was trying to describe |
| 4 | Handoff 13.3 and 15.11 item 46: exactly three event types are written | three are written by the unconditional recorder, but a **second writer exists** (`RecommendationFeedbackConsumer`, enabled in dev *and* prod) for four more. Observed: its messages dead-letter and write nothing | filter offers three; the seven-writer finding is recorded rather than acted on |

> **Superseded by `docs/admin-panel-backend-capability-uptake/` (backend capability uptake).** The four engagement types **no longer dead-letter**: the recommender service is part of the default local stack, and `post_like`, `post_save`, `post_view`, and `post_comment` were each produced and read back out of `user_events`. This is true of the development stack only; no production deployment of that service exists, so a production panel still sees three. The filter is now gated on the environment.

| 5 | Handoff 14.14 / 13.1: empty state should say the first snapshot appears "within 30 minutes of the server starting" | source gives a worst case just under **60 minutes** (discarded partial bucket + 30-minute initial delay) | the panel says *within an hour* |
| 6 | Prompt §3.3.1 and §6.3: locate "the endpoint that revokes a session"; revocation "sits behind the shared reason-carrying confirmation" | **no per-session revoke exists**. Only account-wide `force-logout` | the session list is read-only; the only revocation offered is the existing account-wide force-logout, worded as ending every session |
| 7 | Accounts phase: `reportsAgainst` "carries report ids and reasons" | confirmed — plus `status` and `createdAt` | rendered as a linked list |
| 8 | Accounts phase: `durationDays` omitted is "unsettled" | still unsettled; not re-tested this phase, as it needs a non-suspended disposable target and the behaviour is a backend question | carried to `backend-request.md` unchanged |
| 9 | Reconnaissance: dev rate limits diverge from the handoff's stated numbers | confirmed again for the two endpoints of this phase | built to prod figures throughout |
| 10 | Handoff 13.2: `topHashtagsLive` flags that top hashtags were computed live | **read from source:** it is a hardcoded `true` and can never read `false` | rendered as a static statement about that panel, not as a conditional flag |
| 11 | Handoff 13.7: no total count anywhere | confirmed for both new endpoints — the activity log is a cursor page with `hasNextPage`; the timeseries is not paginated at all | load-more, no numbered pagination |
| 12 | Prompt §3.1.7: establish whether an empty window returns "an empty array, or buckets with zero values" | **both occur, and a third case exists** — an absent bucket inside a returned series. Three distinct states, not two | three distinct renderings; see §1.7 |

No claim from a prior phase was found to be wrong. Items 1–6 are divergences between this prompt or
the handoff and the running server; the server was taken as authoritative in every case.
