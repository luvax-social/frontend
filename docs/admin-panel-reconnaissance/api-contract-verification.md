# API Contract Verification

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

Work Item 5.
Every claim below was checked by calling the running backend on 2026-08-21, `develop@c297b03`, unless it is explicitly labelled read from source.
Bearer and refresh tokens are redacted to their first eight characters where shown.

The verdict up front: the handoff is accurate.
Of the 47 role-matrix rows, 46 match exactly and 1 diverges in a way the handoff itself already documents elsewhere.
Every one of the five headline traps holds.
Every one of the six response-shape divergences holds.
The one class of claim that does not hold universally is the strict-query-parameter rule (section 5.3.1) and the rate-limit numbers (section 5.8), both because the handoff describes a stricter or different profile than the one that runs in development.

## 5.1 Sessions

Both sessions were obtained with `POST /api/v1/auth/login`, body `{"identifier":"<email>","password":"SeedPass123!"}`.

| Item | seed_mod | seed_admin |
|---|---|---|
| Login HTTP status | 200 | 200 |
| `data.user.role` present, casing | `"moderator"` (lowercase) | `"admin"` (lowercase) |
| JWT `role` claim, casing | `"MODERATOR"` (uppercase) | `"ADMIN"` (uppercase) |
| JWT `epoch` claim | present (integer) | present (integer) |
| `GET /api/v1/users/me` has `role` | no | no |

Login response shape (admin, tokens redacted):

```json
{
  "success": true,
  "code": "OK",
  "message": "Operation completed successfully",
  "data": {
    "accessToken": "eyJhbGci...",
    "refreshToken": "q0tD56Uy...",
    "accessTokenExpiresIn": 900,
    "tokenType": "Bearer",
    "user": {
      "id": "2f0d04c6-efcd-42b1-92af-22c1bd44d758",
      "username": "seed_admin",
      "email": "admin@seed.local",
      "displayName": "Seed Admin",
      "role": "admin",
      "emailVerified": true
    }
  }
}
```

`Set-Cookie` header, verbatim (dev):

```
Set-Cookie: luvax_refresh=ely2yKS-...; Path=/api/v1/auth; Max-Age=2592000; Expires=Sun, 20 Sep 2026 11:52:27 GMT; HttpOnly; SameSite=Lax
```

Path `/api/v1/auth`, `SameSite=Lax`, `Max-Age=2592000`, `HttpOnly` present, and `Secure` is absent in development.
This matches the handoff section 6.3 exactly.

`GET /api/v1/users/me` returns the same profile shape for both roles, and neither carries a `role` field.
Keys observed: `id, username, email, displayName, bio, avatarUrl, bannerUrl, websiteUrl, isPrivate, isVerified, followerCount, followingCount, postCount, createdAt`.

## 5.2 The role matrix

Every one of the 47 endpoints was called with a moderator token, an administrator token, and no token.
State-changing endpoints used real, least-destructive targets: `seed_alice`, `seed_bob`, and `seed_carol` as subjects, disposable posts and comments and reports created as fixtures (handoff section 5.7 plus additional posts and comments).
The moderator column for administrator-only rows was called with a valid target so a 403 reflects authorization, not a missing target.

`claim` columns are the handoff section 8.4 base status.
Divergences are marked below the table.

| # | Method and path | claim MOD | obs MOD | claim ADMIN | obs ADMIN | no-token |
|---|---|---|---|---|---|---|
| 1 | POST /api/v1/auth/login | 200 | 200 | 200 | 200 | 401 |
| 2 | POST /api/v1/auth/refresh | 200 | 200 | 200 | 200 | 401 |
| 3 | POST /api/v1/auth/logout | 204 | 204 | 204 | 204 | 401 |
| 4 | POST /api/v1/auth/ws-ticket | 200 | 200 | 200 | 200 | 401 |
| 5 | GET /api/v1/users/me | 200 | 200 | 200 | 200 | 401 |
| 6 | GET /api/v1/users/me/warnings | 200 | 200 | 200 | 200 | 401 |
| 7 | GET /api/v1/config/vocabularies | 200 | 200 | 200 | 200 | 401 |
| 8 | GET /api/v1/reports | 200 | 200 | 200 | 200 | 401 |
| 9 | GET /api/v1/reports/pending | 200 | 200 | 200 | 200 | 401 |
| 10 | GET /api/v1/reports/{reportId} | 200 | 200 | 200 | 200 | 401 |
| 11 | PATCH /api/v1/reports/{reportId}/status | 200 | 200 | 200 | 200 | 401 |
| 12 | GET /api/v1/admin/actions | 200 (own only) | 200 | 200 (all) | 200 | 401 |
| 13 | GET /api/v1/admin/actions/{actionId} | 404 | 404 | 200 | 200 | 401 |
| 14 | GET /api/v1/admin/actions/for-user/{userId} | 200 | 200 | 200 | 200 | 401 |
| 15 | GET /api/v1/admin/content/for-user/{userId}/posts | 200 | 200 | 200 | 200 | 401 |
| 16 | GET /api/v1/admin/content/for-user/{userId}/comments | 200 | 200 | 200 | 200 | 401 |
| 17 | GET /api/v1/admin/content/{entityType}/{entityId} | 200 | 200 | 200 | 200 | 401 |
| 18 | PATCH /api/v1/admin/posts/{postId}/remove | 200 | 200 | 200 | 200 | 401 |
| 19 | PATCH /api/v1/admin/posts/{postId}/restore | 200 | 200 | 200 | 200 | 401 |
| 20 | PATCH /api/v1/admin/comments/{commentId}/remove | 200 | 200 | 200 | 200 | 401 |
| 21 | PATCH /api/v1/admin/comments/{commentId}/restore | 200 | 200 | 200 | 200 | 401 |
| 22 | GET /api/v1/admin/reports/{reportId}/target | 200 | 200 | 200 | 200 | 401 |
| 23 | PATCH /api/v1/admin/reports/{reportId}/resolve | 200 | 200 | 200 | 200 | 401 |
| 24 | PATCH /api/v1/admin/reports/{reportId}/dismiss | 200 | 200 | 200 | 200 | 401 |
| 25 | PATCH /api/v1/admin/reports/{reportId}/escalate | 200 | 200 | 200 | 200 | 401 |
| 26 | GET /api/v1/admin/reports/escalated/count | 403 | 403 | 200 | 200 | 401 |
| 27 | GET /api/v1/admin/violations/for-user/{userId} | 200 | 200 | 200 | 200 | 401 |
| 28 | POST /api/v1/admin/warnings/for-user/{userId} | 200 | 200 | 200 | 200 | 401 |
| 29 | DELETE /api/v1/admin/warnings/{warningId} | 403 | 403 | 200 | 200 | 401 |
| 30 | DELETE /api/v1/admin/strikes/{strikeId} | 403 | 403 | 200 | 200 | 401 |
| 31 | GET /api/v1/admin/users | 403 | 403 | 200 | 200 | 401 |
| 32 | GET /api/v1/admin/users/search | 403 | 403 | 200 | 200 | 401 |
| 33 | GET /api/v1/admin/users/{userId} | 403 | 403 | 200 | 200 | 401 |
| 34 | PATCH /api/v1/admin/users/{userId}/ban | 403 | 403 | 200 | 200 | 401 |
| 35 | PATCH /api/v1/admin/users/{userId}/unban | 403 | 403 | 200 | 200 | 401 |
| 36 | PATCH /api/v1/admin/users/{userId}/suspend | 403 | 403 | 200 | 200 | 401 |
| 37 | PATCH /api/v1/admin/users/{userId}/unsuspend | 403 | 403 | 200 | 200 | 401 |
| 38 | PATCH /api/v1/admin/users/{userId}/role | 403 | 403 | 200 | 200 | 401 |
| 39 | POST /api/v1/admin/users/{userId}/force-logout | 403 | 403 | 200 | 200 | 401 |
| 40 | GET /api/v1/admin/hashtags | 403 | 403 | 200 | 200 | 401 |
| 41 | GET /api/v1/admin/hashtags/search | 403 | 403 | 200 | 200 | 401 |
| 42 | POST /api/v1/admin/hashtags | 403 | 403 | 200 | **201** | 401 |
| 43 | PATCH /api/v1/admin/hashtags/{hashtagId} | 403 | 403 | 200 | 200 | 401 |
| 44 | DELETE /api/v1/admin/hashtags/{hashtagId} | 403 | 403 | 200 | 200 | 401 |
| 45 | GET /api/v1/admin/stats/current | 403 | 403 | 200 | 200 | 401 |
| 46 | GET /api/v1/admin/stats/timeseries | 403 | 403 | 200 | 200 | 401 |
| 47 | GET /api/v1/admin/user-events | 403 | 403 | 200 | 200 | 401 |

Divergences from the claimed status:

- Row 42, `POST /api/v1/admin/hashtags`, administrator: observed **201 CREATED**, claimed 200 in the section 8.4 table.
This is not a real contradiction; the handoff's own section 9.8 shows this endpoint returning "HTTP 201, code CREATED".
The 8.4 summary table is simply imprecise for this one row.
Treat the success status as 201 for this endpoint and 200 for every other write.

Every moderator 403 carries code `FORBIDDEN` (all 20 administrator-only rows verified).
Row 13 moderator carries code `ADMIN_ACTION_NOT_FOUND` at 404.

### No-token pass

All 47 endpoints return HTTP 401 with no token.
45 of the 47 return code `UNAUTHORIZED` (rejected by the authentication filter before reaching a handler).
The two exceptions reach their handler and 401 for a domain reason: `POST /api/v1/auth/login` returns `AUTH_INVALID_CREDENTIALS` (the request body carried invalid credentials), and `POST /api/v1/auth/refresh` returns `AUTH_REFRESH_TOKEN_INVALID` (no refresh cookie was sent).

This is a refinement of the handoff's claim in section 8.2.
The handoff says "every endpoint except login and refresh returns 401 when called with no token", which reads as though login and refresh do not return 401.
Observably, all 47 return 401; login and refresh differ only in the error code and in that a well-formed call to them succeeds.
The count that matches the "returns 401 because authentication is required" claim is 45.

## 5.3 The five headline traps

### Trap 1: undeclared parameters and fields

Undeclared query parameter: this holds on `/api/v1/admin/**` but not universally.

- `GET /api/v1/admin/users?limitt=2` returns HTTP 400 `BAD_REQUEST`, message `Unsupported query parameter: limitt. Accepted: cursor, limit, role, status`.
- The same rejection with the enumerated accepted list was confirmed on `/api/v1/admin/users`, `/api/v1/admin/actions` (`Accepted: actionType, adminId, cursor, limit`), `/api/v1/admin/hashtags` (`Accepted: cursor, limit, status`), `/api/v1/admin/stats/timeseries` (`Accepted: from, granularity, metric, to`), `/api/v1/admin/user-events` (`Accepted: cursor, eventType, from, limit, to, userId`), and `/api/v1/admin/users/search` (`Accepted: cursor, limit, q`).
- It does NOT hold on the report queue: `GET /api/v1/reports?bogus=1` returns HTTP 200, and `GET /api/v1/reports/pending?bogus=1` returns HTTP 200.

The panel's report-queue screens read `/api/v1/reports` and `/api/v1/reports/pending`, and a stray query parameter there is silently ignored rather than rejected.
The strict rule can be relied on only for `/api/v1/admin/**`.
Stripping filter objects to declared keys is still the correct defensive practice everywhere.

Undeclared request-body field: this holds.
`POST /api/v1/admin/warnings/for-user/{id}` with body `{"reasonKey":"spam","note":"x","bogusField":"y"}` returns HTTP 400 `MALFORMED_REQUEST_BODY`, message `Request body could not be read`.
The message does not name the offending field.

### Trap 2: pagination terminates on `hasNextPage`

`GET /api/v1/reports?limit=3` walked to the end over 10 reports:

```
page 1: 3 items, hasNextPage=true,  endCursor non-null
page 2: 3 items, hasNextPage=true,  endCursor non-null
page 3: 3 items, hasNextPage=true,  endCursor non-null
page 4: 1 item,  hasNextPage=false, endCursor non-null
one request past the end (using the last endCursor): 0 items, hasNextPage=false
```

The last non-empty page still carries `hasNextPage=false`, and `endCursor` is non-null even on the request past the end.
Stopping on an empty page or a null cursor would be wrong; stopping on `hasNextPage=false` is correct.

### Trap 3: `GET /api/v1/users/me` has no role

Restated from section 5.1: confirmed for both `seed_mod` and `seed_admin`, no `role` key on the payload.

### Trap 4: moderator 404 on another actor's action, 200 on its own

- Moderator `GET /api/v1/admin/actions/{id}` for an administrator-performed action returns HTTP 404 `ADMIN_ACTION_NOT_FOUND`.
- Moderator `GET /api/v1/admin/actions/{id}` for one of its own actions (taken from the moderator's own `GET /api/v1/admin/actions` page) returns HTTP 200 and includes `metadata`.

Both halves confirmed.

### Trap 5: promotion to `admin` is irreversible (read from source, not performed)

No account was promoted.

Read from source, `backend/src/main/java/com/app/modules/admin/service/impl/AdminAuthorizationServiceImpl.java`:

- `evaluateActorAndTarget` returns `TARGET_IS_ADMIN` whenever the target's role is `ADMIN` (lines around 108-109).
- `evaluateRoleTransition` (lines 57-75) returns that `TARGET_IS_ADMIN` outcome for any requested role when the target is an administrator, which `assertMayChangeUserRole` maps to `ADMIN_TARGET_PROTECTED` (403).
- `capabilities` is derived (lines 32-44) by asking `evaluateRoleTransition` about every candidate role; for an administrator target every candidate is refused, so `assignableRoles` is empty and `canChangeRole` is false.
- A `user` to `admin` request is a `SKIP_LEVEL` outcome (line 71-72), mapped to `ADMIN_ROLE_TRANSITION_NOT_ALLOWED` (409); promotion must go `user` then `moderator` then `admin`.

Confirmed by calling `GET /api/v1/admin/users/{adminId}` for `seed_admin`:

```json
"capabilities": { "canChangeStatus": false, "canChangeRole": false, "assignableRoles": [] }
```

An administrator target exposes no assignable roles and cannot be demoted through the API.

## 5.4 Response-shape divergences

### 5.4.1 restore wraps, remove and comment endpoints do not

Confirmed by calling.

- `PATCH /api/v1/admin/posts/{id}/remove` returns `data` as an `AdminActionResponse` directly: keys `id, adminId, actionType, targetUserId, targetEntityType, targetEntityId, reportId, reason, metadata, createdAt`, `actionType: "remove_post"`.
- `PATCH /api/v1/admin/posts/{id}/restore` returns `data` as `{ action, droppedHashtags }` (wrapped).
- `PATCH /api/v1/admin/comments/{id}/remove` and `/restore` both return `data` as an `AdminActionResponse` directly (no wrapper, no `droppedHashtags`).

> **Superseded by `docs/admin-panel-backend-capability-uptake/` (backend capability uptake).** `droppedHashtags` is now **`remainingBannedHashtags`** with a changed meaning — the banned tags the caption still carries after the restore. `action.metadata.strippedHashtags` became `action.metadata.remainingBannedHashtags`. The comment endpoints are unchanged.


### 5.4.2 non-empty `droppedHashtags`, reproduced end to end

- Created a post as `seed_carol` with caption `drop end2end #dropme2 test`.
Hashtag `dropme2` was created and linked with `postCount=1`, so hashtag extraction to `post_hashtags` is synchronous even though the outbox consumers are disabled.
- Banned the hashtag with `PATCH /api/v1/admin/hashtags/{id}` (`status:banned`); `actionType: "ban_hashtag"`.
- Removed then restored the post.
Restore response:

```json
"data": {
  "action": { "...": "AdminActionResponse", "metadata": { "resultingStatus": "published", "strippedHashtags": ["dropme2"] } },
  "droppedHashtags": ["dropme2"]
}
```

`droppedHashtags` and `action.metadata.strippedHashtags` both carry `["dropme2"]`.

### 5.4.3 hashtag creation identifier

`POST /api/v1/admin/hashtags` returns HTTP 201 with `data` as the audit action.

```
data.id           = 0a2e23c5-...  (the audit action's id)
data.targetEntityId = 194a684e-...  (the new hashtag's id)
```

Fetched the created hashtag by name via search: its real id equals `data.targetEntityId` (true), and does not equal `data.id` (false).
Navigate to a new hashtag with `data.targetEntityId`, never `data.id`.

### 5.4.4 audit list omits `metadata`

`GET /api/v1/admin/actions?limit=50` returned 39 entries; not one carried a `metadata` key.
`GET /api/v1/admin/actions/{id}` for the first of those entries does carry `metadata`.
Checked across an entire page of 39 rows, larger than the 13 rows the handoff checked.

### 5.4.5 content endpoint `reportType` echo and null pattern

`GET /api/v1/admin/content/{entityType}/{entityId}`, three entity types side by side:

| entityType | `reportType` returned | `status` | `text` |
|---|---|---|---|
| post | `"post"` | `"published"` | the caption |
| comment | `"comment"` | `null` | the comment body |
| user | `"user"` | `"active"` | `null` |

The field literally named `reportType` echoes the requested `entityType` even though no report is involved.
`status` is null for a comment; `text` is null for a user.

### 5.4.6 report status endpoint performs only pending to reviewing

Confirmed by calling.

- `PATCH /api/v1/reports/{id}/status` with `{"status":"reviewing"}` on a pending report: HTTP 200, status becomes `reviewing`.
- The same endpoint with `{"status":"resolved"}` on that now-reviewing report: HTTP 409 `REPORT_INVALID_TRANSITION`, message `Invalid report status transition`.
- The same endpoint with `{"status":"reviewing"}` again on the reviewing report: HTTP 409 `REPORT_INVALID_TRANSITION`.

The endpoint accepts all five status values in its schema but only advances `pending` to `reviewing`.
Resolve, dismiss, and escalate are the separate `/api/v1/admin/reports/{id}/...` endpoints.

## 5.5 Role-dependent data and cursor scope

### 5.5.1 violations, moderator versus administrator

Against `seed_bob` (given warnings and one auto-strike), read at the same moment:

- Moderator `GET /api/v1/admin/violations/for-user/{bob}`: 3 entries, all `kind: warning`.
- Administrator, same endpoint, same account: 4 entries, `3 warning + 1 strike`.

The administrator sees the strike the moderator does not.
This is derived from the caller's role, not a filter.

### 5.5.2 cursor is scoped to the role variant

- A cursor obtained by the moderator on the violations endpoint, replayed by the administrator: HTTP 400 `INVALID_CURSOR`.
- A cursor obtained by the administrator, replayed by the moderator: HTTP 400 `INVALID_CURSOR`.

Both directions reject.

### 5.5.3 cursor is scoped to the endpoint

A cursor from `GET /api/v1/admin/actions` used on `GET /api/v1/admin/users`: HTTP 400 `INVALID_CURSOR`, message `Malformed pagination cursor`.

### 5.5.4 admin actions, moderator own versus administrator all

For the same window:

- Moderator `GET /api/v1/admin/actions?limit=100`: 8 entries, every `adminId` equal to the moderator's own id.
- Administrator, same call: 41 entries.

The moderator sees only its own actions.

## 5.6 Vocabularies and enumerations

`GET /api/v1/config/vocabularies` returns three lists.

| List | Entry count |
|---|---|
| `reportReasons` | 8 |
| `notificationTypes` | 11 |
| `moderationActions` | 22 |

Full `reportReasons` (every entry `isEnabled: true`):

| key | displayName | appliesTo |
|---|---|---|
| spam | Spam | [] |
| nudity | Nudity or Sexual Content | post, comment, story, message |
| violence | Violence or Dangerous Content | post, comment, story, message |
| hate_speech | Hate Speech | post, comment, story, message |
| harassment | Harassment or Bullying | [] |
| false_information | False Information | post, comment, story |
| scam | Scam or Fraud | [] |
| other | Other | [] |

No entry in any of the three lists has `isEnabled` false.
Note that `appliesTo` is an empty array for `spam`, `harassment`, `scam`, and `other`; do not read an empty `appliesTo` as "applies to nothing" without confirming intended behaviour with the backend.

`moderationActions` keys are identical to the 22 `actionType` values declared in the OpenAPI `GET /api/v1/admin/actions` `actionType` enum.
The set difference is empty in both directions; no key is present in one and absent from the other.
Each `moderationActions` entry carries `{ key, displayName, requiresReason, isReversible, isEnabled }`, which is usable for driving a reason requirement and a reversible label in the panel.

`GET /api/v1/admin/user-events` declares 20 `eventType` values in its OpenAPI parameter enum (confirmed: `post_view, post_like, post_unlike, post_save, post_unsave, post_share, post_comment, story_view, story_reply, profile_view, profile_follow, profile_unfollow, search, hashtag_click, comment_like, comment_reply, message_send, session_start, session_end, app_open`).

Read from source, only 7 of those 20 have a write path:

- `backend/src/main/java/com/app/modules/recommendation/service/UserEventRecorder.java` writes `SESSION_START` (line 85), `SEARCH` (line 97), `PROFILE_VIEW` (line 102), off the request thread.
- `backend/src/main/java/com/app/modules/recommendation/consumer/RecommendationFeedbackConsumer.java` writes `POST_LIKE` (line 173), `POST_SAVE` (line 175), `POST_VIEW` (line 177), `POST_COMMENT` (line 179), from the recommendation feedback queue.

No other `event_type` value is written anywhere in the source.
In this environment the `user_events` table contained only `session_start` (11 rows from logins), because the four consumer-driven types require the recommendation feedback events to flow and the two remaining recorder types require the user-facing search and profile-view actions.
The handoff's "only 3 are ever present" refers to the three `UserEventRecorder` types; the source ceiling is 7.

## 5.7 Statistics and activity-log reality

- `GET /api/v1/admin/stats/current`: `computedAt` is null, `bucketStart` is null, `totalUsers` is 0, the map fields are `{}`.
The system has collected no bucket.
- Collection interval, read from source: `backend/.../StatsCollectionJob.java` is `@Scheduled(initialDelayString = "${app.stats.interval:PT30M}", fixedDelayString = "${app.stats.interval:PT30M}")`, default `PT30M`; `StatsProperties.java` defaults `interval` to `PT30M`.
The first bucket appears only after the application has run past the first epoch-aligned 30-minute boundary, and the partial bucket a process starts inside is skipped, so statistics can read empty for up to and beyond the first 30 minutes.
- `GET /api/v1/admin/stats/timeseries` with no parameters resolves to `metric=registrations`, `granularity=half_hour`, `from=` 24 hours ago, `to=` now, `points=[]`.
- `GET /api/v1/admin/stats/timeseries?granularity=half_hour&from=<60 days ago>&to=<now>`: HTTP 400 `BAD_REQUEST`, message `Fine buckets are kept for 30 days; a window reaching further back can only be read at day granularity`.
- `GET /api/v1/admin/user-events` with no `from`/`to`: HTTP 400 `BAD_REQUEST`, message `Both 'from' and 'to' are required; the activity log has no unbounded read`.
- `GET /api/v1/admin/user-events` with a 31-day window: HTTP 400, message `The window may span at most 30 days`.
- The same with a 30-day window: HTTP 200.

## 5.8 Rate limits

The active profile is `dev`.
The handoff's section 7.6 rate-limit numbers describe a stricter profile than the one that runs in development.
The dev numbers come from `backend/src/main/resources/application-dev.yml`, `app.rate-limit.endpoint-rules`.

| Path | Handoff (7.6) | Dev profile (running) | Verified by calling |
|---|---|---|---|
| `/api/v1/admin/users/search` | 60 / 60s | 60 / 60s | yes: first 429 at request 61, `Retry-After: 60` |
| `/api/v1/admin/hashtags/search` | 60 / 60s | 60 / 60s | read from config |
| `/api/v1/admin/stats/timeseries` | 30 / 60s | 60 / 60s | yes: 45 consecutive 200s, no 429 |
| `/api/v1/admin/user-events` | 30 / 60s | 60 / 60s | yes: 45 consecutive 200s, no 429 |
| `/api/v1/admin/**` (broad) | 300 / 60s | 150 / 60s | read from config |
| `/api/v1/auth/login` | 10 / 900s | 10 / 60s | read from config |
| `/api/v1/auth/refresh` | 60 / 60s | 100 / 60s | read from config |
| `/api/v1/auth/ws-ticket` | 60 / 60s | 200 / 60s | read from config |

The search limit is the one number that matches in both profiles and is the one that will actually shape a search-as-you-type input: 60 per minute, debounce at least 300 ms.
`Retry-After` is 60 and is exposed to the browser (`Access-Control-Expose-Headers: Retry-After` per handoff 6.8), so it is readable from a browser context.

Login limit and the development flush, from source and handoff 7.7:
login is 10 attempts, keyed on IP plus email, over a 60-second window in dev (900 seconds in the base/prod profile).
The rate-limit keys are Redis keys matching `auth:ratelimit:*`.
Flush with:

```
docker compose exec -T redis redis-cli -a <redis-password> --scan --pattern 'auth:ratelimit:*' | xargs -r ... DEL
```

Observed while testing: the rate limiter runs before authentication, so it counts even requests that then 401 on an expired token (the search endpoint returned 429 at request 61 even though every request 401'd).

## 5.9 Divergence report

Claims checked: the full 47-row role matrix (three ways each), the five headline traps, the six response-shape divergences, four cursor-scope claims, the vocabulary counts and contents, five statistics and activity-log claims, and the rate-limit table.

| Handoff claim | Status | What was observed |
|---|---|---|
| Row 42 `POST /admin/hashtags` returns 200 (table 8.4) | Inaccurate (self-contradicted) | Returns 201 CREATED; the handoff's own section 9.8 shows 201 |
| "Undeclared query parameters produce HTTP 400" (5, 7.5) as a universal rule | Incomplete | Holds for `/api/v1/admin/**`; `GET /api/v1/reports` and `/reports/pending` accept undeclared query params with 200 |
| "Every endpoint except login and refresh returns 401 with no token" (8.2) | Imprecise | All 47 return 401; login and refresh return 401 too, with domain codes, because they reach their handler |
| Rate limits: timeseries and user-events 30/60s (7.6) | Not true in dev | Dev profile allows 60/60s for both |
| Rate limits: admin broad 300/60s, login 10/900s, refresh 60, ws-ticket 200/... (7.6) | Not true in dev | Dev profile: admin 150, login 10/60s, refresh 100, ws-ticket 200 |
| Everything else in sections 5-13 that was checked | Holds | Matched observation exactly |

No other inaccuracy was found.
The handoff is a reliable contract document with the caveats above; the two that matter for building are the query-parameter scope and the rate-limit profile.
