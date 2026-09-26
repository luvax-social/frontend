# Backend Data Model

> Superseded by `backend/database/schema.sql`, which is regenerated from the migration set. Record of work done on 2026-08-01; not maintained.

Schema facts, enums, and behavioural rules that the API shape alone does not reveal.

Sources are the running PostgreSQL 18.4 database at Flyway version 44, the JPA entities, and the
service implementations.

## Enum types

Read directly from `pg_type` and `pg_enum` on the running database.
Values are lowercase in the database and lowercase on the wire, except `mediaType` on the two media
request bodies, which is uppercase.

| Enum type | Values |
|-----------|--------|
| `post_status` | draft, published, archived, removed |
| `post_type` | image, video, carousel, text |
| `follow_status` | pending, accepted |
| `media_type` | image, video |
| `report_reason` | spam, nudity, violence, hate_speech, harassment, false_information, scam, other |
| `report_status` | pending, reviewing, resolved, dismissed |
| `report_type` | post, comment, user, story, message |
| `notification_type` | like_post, like_comment, comment_post, reply_comment, follow, follow_request, mention_post, mention_comment, story_view, message |
| `user_role` | user, moderator, admin |
| `user_status` | active, suspended, deactivated, banned |
| `story_type` | image, video |
| `message_type` | text, image, video, post_share, story_share |
| `oauth_provider` | google, facebook, apple |
| `admin_action_type` | ban_user, unban_user, suspend_user, unsuspend_user, remove_post, restore_post, remove_comment, restore_comment, resolve_report, dismiss_report |
| `event_type` | post_view, post_like, post_unlike, post_save, post_unsave, post_share, post_comment, story_view, story_reply, profile_view, profile_follow, profile_unfollow, search, hashtag_click, comment_like, comment_reply, message_send, session_start, session_end, app_open |

The design export's report reason list matches `report_reason` value for value.
No mapping layer is needed there.

## Migrations

44 Flyway migrations applied, ending at
`V44 - add email case insensitive index`.

The workspace `.claude/rules/STRUCT.md` states 18 migrations, V01 to V18.
That document is stale by 26 migrations.

## The twelve required investigations

### 1. Viewer state fields

**Present. There is no N+1 problem.**

| Response | Viewer field | Verified |
|----------|--------------|----------|
| `PostResponse`, `FeedPostResponse` | `isLiked`, `isSaved` | runtime |
| `CommentResponse` | `isLiked` | runtime |
| `PublicUserProfileResponse` | `viewerState` object | runtime |
| `UserListItemResponse` (likers, followers, following, blocked, search) | `viewerState` object | runtime |
| `FollowRequestResponse` | `viewerState` object | runtime |

`ViewerRelationshipResponse` carries four booleans, all always present and never null:

```json
{"isFollowing": false, "isFollowRequested": false,
 "isFollowedBy": false, "isBlocking": false}
```

An anonymous viewer or a self-reference resolves to all four false rather than the object being
omitted, so a client never has to branch on presence.
`isFollowing` and `isFollowRequested` are mutually exclusive, because the `follows` row for a pair
is either `accepted` or `pending` and never both.

There is deliberately **no "this user has blocked me" field**.
The class documentation is explicit that this is a stealth block model and that a boolean
confirming the block is exactly the disclosure the model forbids.
An account that has blocked the viewer is excluded from the result set entirely rather than
included with a flag.

Consequence for the frontend: a feed page of twenty posts needs exactly one request.
See `open-decisions.md`, where this is quantified against the assumption the audit was asked to
test.

Two viewer fields are **not** available:

- `CommentBroadcastResponse`, the WebSocket payload, omits `isLiked` and `pinned` entirely, because
  one serialised blob is shared by every subscriber.
- There is no per-entity "have I reported this" flag, and no endpoint a regular user can call to
  list their own reports.

### 2. Comment nesting model

**Arbitrary depth up to a hard cap of 10.**

The `comments` table:

| Column | Type | Note |
|--------|------|------|
| `parent_id` | uuid, nullable | immediate parent, FK to `comments`, `ON DELETE CASCADE` |
| `root_id` | uuid, nullable | top-level ancestor, FK to `comments`, `ON DELETE CASCADE` |
| `depth` | smallint, not null, default 0 | |

```
CHECK (depth >= 0 AND depth <= 10)
```

Enforced twice: by that database constraint and by `MAX_DEPTH = 10` in `CommentServiceImpl`, which
throws `COMMENT_DEPTH_EXCEEDED` when a reply would exceed it.

Runtime evidence: replies were created successfully to depth 4 during endpoint verification and to
depth 10 by the seed script, with `depth` incrementing correctly and `root_id` staying pinned to the
depth-0 ancestor at every level.

So the model is 11 levels in total, 0 through 10.
It is neither single-level reply nor truly unbounded.

`reply_count` counts direct children only, maintained by the `trg_comment_reply_count` trigger.
There is no subtree count anywhere, and no endpoint returns a subtree in one call.

### 3. Comment sort

**No sort parameter exists on any comment endpoint.**

Top-level comments, `GET /posts/{postId}/comments`:

- Default and only order is newest first, keyset on `(created_at, id)` descending.
- The first page (no `cursor`) prepends a pinned block of up to `PINNED_COMMENT_COUNT = 3`
  comments, ordered by `(like_count, created_at, id)` descending.
- Eligibility for the pinned block requires `like_count > 0`. The repository query has
  `AND like_count > 0` in its `WHERE` clause, documented as preventing every zero-like post from
  pinning its three newest comments and duplicating the head of the body.
- Pinned ids are excluded from the chronological remainder in SQL, not in Java, so `LIMIT` counts
  post-filter rows and a full page is still returned.
- Page two onward, reached with `cursor`, is pure chronological with no pinned block.

Replies, `GET /comments/{commentId}/replies`:

- Newest first on every page.
- **No pinned block ever applies to replies.**

So sorting by like count is available, but only implicitly, only for the top three, only on the
first page, only for top-level comments, and only once at least one like exists.
A client cannot request a like-count sort of the whole list.

Runtime evidence for the threshold: the same comment came back `"pinned": false` at zero likes and
`"pinned": true` after one like.

Both queries also exclude any commenter in a block relationship with the viewer, in either
direction.

### 4. Report

Request payload, `POST /reports`:

```json
{"reportType": "post", "reportReason": "spam",
 "entityId": "<uuid>", "description": "optional, max 2000"}
```

`reportType` accepts `post`, `comment`, `user`, `story`, `message`.
Verified at runtime for `post`, `comment`, and `user`; all returned `201`.

`reportReason` accepts exactly the eight `report_reason` enum values listed above.

Response is the full report row including `status` (`pending` on creation), `reviewedBy`,
`reviewedAt`, `resolutionNote`, all null initially.

**Duplicate guard: yes.**
A second report of the same entity by the same reporter returns `409 REPORT_DUPLICATE`, verified at
runtime.
It is backed by a unique index added in migration V30, so it holds under concurrency.

Reading reports requires a moderator or administrator role.
`GET /reports` and `GET /reports/pending` both returned `403 FORBIDDEN` for a regular account.
There is no endpoint through which a user can see their own reports.

### 5. Search

Three search endpoints, all cursor-paginated, all runtime-verified.

| Endpoint | Matches on | Backing store |
|----------|-----------|---------------|
| `GET /posts/search?q=` | published post captions | Elasticsearch |
| `GET /users/search?q=` | username substring | PostgreSQL |
| `GET /hashtags/search?q=` | hashtag name | PostgreSQL |

Users are searchable.
Hashtags are searchable.
There is no combined endpoint that returns posts and users in one response; a search screen showing
both must issue two requests.

Post search is stemmed, not substring: `q=sunsets` matched a caption reading
"bob post two about sunsets".
The controller documents that it degrades to an empty page rather than erroring when Elasticsearch
is unavailable, which means a search outage is silent and looks identical to "no results".

Ranking is whatever Elasticsearch relevance returns for posts, and cursor order for users and
hashtags.
No explicit ranking parameter is exposed.

Block exclusion applies: accounts in a block relationship with the viewer are absent from user
search in both directions, verified at runtime.

`GET /hashtags/trending` exists separately and returns `rank`, `postCount`, `periodStart`, and
`periodEnd`, populated by a scheduled job.

This contradicts the workspace `GLOBAL_RULES.md`, which lists "No Elasticsearch in v1" as a
deliberate scope simplification.
The backend is authoritative and Elasticsearch is present and in use.

### 6. Follow model

**Private accounts and follow requests are fully implemented.**

The `follows` table is the entire state machine:

| Column | Note |
|--------|------|
| `follower_id`, `following_id` | composite primary key |
| `status` | `follow_status`, default `accepted` |
| `created_at` | |

```
CHECK (follower_id <> following_id)
```

There is no separate follow-request table.
A pending request is a `follows` row with `status = 'pending'`.
That is why the approve and reject endpoints are keyed by `{requesterId}` rather than by a request
id, and why `FollowRequestResponse.id` is the requester's user id.

State machine:

| From | Event | Endpoint | To |
|------|-------|----------|-----|
| no row | follow a public account | `POST /social/follow/{id}` | row, `accepted` |
| no row | follow a private account | `POST /social/follow/{id}` | row, `pending` |
| `pending` | target approves | `PATCH /social/follow-requests/{requesterId}/approve` | `accepted` |
| `pending` | target rejects | `PATCH /social/follow-requests/{requesterId}/reject` | no row |
| `pending` | requester cancels | `DELETE /social/follow/{id}` | no row |
| `accepted` | unfollow | `DELETE /social/follow/{id}` | no row |
| `accepted` or `pending` | either party blocks | `POST /social/block/{id}` | no row, both directions |
| `accepted` | follow again | `POST /social/follow/{id}` | 409 `SOCIAL_ALREADY_FOLLOWING` |
| `pending` | follow again | `POST /social/follow/{id}` | 409 `SOCIAL_ALREADY_REQUESTED` |

Runtime evidence: setting `isPrivate: true` on an account and then following it returned
`201` with `"status": "pending"`; the target's `GET /social/follow-requests` listed the requester;
`PATCH .../approve` returned `204`.

Private account visibility: a non-follower reading a private profile gets `200` with
`isPrivate: true` but `followerCount`, `followingCount`, and `postCount` all **null**.
Identity fields remain visible.

The private flag is set through `PATCH /users/me` with `{"isPrivate": true}`.
It is **not** in `/users/me/settings`, which is a common wrong guess.

Counters are maintained by the `trg_follow_counts` trigger on the `follows` table, so a client must
never adjust `followerCount` itself beyond an optimistic display that is reconciled on refetch.

### 7. Block semantics

All of the following is runtime-verified.

`blocks` is `(blocker_id, blocked_id, created_at)` with a composite primary key and
`CHECK (blocker_id <> blocked_id)`.

**Auto-unfollow: yes, in both directions.**
`SocialServiceImpl.blockUser` deletes the `follows` row for `(blocker, blocked)` and the row for
`(blocked, blocker)`.
Verified: after Alice blocked Dave, Dave was absent from both Alice's following list and her
followers list.

**Feed exclusion: yes.**
Dave's post was present in Alice's feed before the block and absent immediately after.

**Search exclusion: yes, symmetric.**
After the block, `GET /users/search?q=recon` returned neither Dave (for Alice) nor Alice (for Dave).

**Profile: 404 in both directions.**
`GET /users/{daveId}` as Alice returned `404 NOT_FOUND`.
`GET /users/{aliceId}` as Dave returned `404 NOT_FOUND`.
This is the stealth model working as designed for the blocked party, but it also means **the
blocker cannot open the profile of someone they blocked**.

That has a direct UI consequence: `GET /social/blocked` is the only surface on which a blocked
account is visible to the blocker, so any unblock control must live on a blocked-users screen.
Verified that the list returns the blocked user with `"isBlocking": true`.

**Post access: 403, in both directions.**
`GET /posts/{davePost}` as Alice returned `403 POST_FORBIDDEN`.
`GET /posts/{alicePost}` as Dave returned the same.

Note the inconsistency: the profile endpoint returns 404 and hides existence, while the post
endpoint returns 403 and confirms existence.
For a strict stealth model these should agree.
Recorded in `defects.md`.

**Unblock restores visibility but not the follow graph.**
After `DELETE /social/block/{daveId}`, the blocked list was empty and `GET /users/{daveId}`
returned `200`.
The follow edges destroyed by the block were not recreated; both parties must follow again.

### 8. Post edit and delete

Both implemented.

Edit is caption-only, `PATCH /posts/{postId}` with `{"caption": "..."}`.
Media, type, and location cannot be changed after creation.
Owner only; a non-owner receives `403 POST_FORBIDDEN`.

Every edit appends a row to the post edit history, readable at `GET /posts/{postId}/history`,
carrying the editor and the previous caption.
The history is append-only.

Delete is `DELETE /posts/{postId}`, returning `204`.
Owner or admin only; a non-owner receives `403 POST_FORBIDDEN`.

**Delete is soft.**
Verified in the database that after deletion the row persists with `status = 'removed'` and
`deleted_at` set.
`GET /posts/{postId}` then returns `404 POST_NOT_FOUND`.

Separately, `PATCH /posts/{postId}/status` transitions the lifecycle: draft to published, published
to archived, archived to published, any status to removed.
Archive is therefore a reversible hide, distinct from delete.

### 9. Comment edit and delete

Both implemented.

Edit is `PATCH /comments/{commentId}` with `{"content": "..."}`, owner only,
`403 COMMENT_FORBIDDEN` otherwise.
There is no comment edit history table, unlike posts.

Delete is `DELETE /comments/{commentId}`, owner or admin, returning `200` with a null-data
envelope rather than 204.

**Deleting a comment soft-deletes its entire subtree.**
The repository method is documented as soft-deleting a comment and every descendant in a single
statement.
Verified: deleting the depth-1 comment of a four-deep chain left `deleted_at` set on depths 1, 2, 3
and 4, while the depth-0 root remained live.

So there is no tombstone and no "comment deleted" placeholder preserving the replies.
Replies to a deleted comment vanish with it.

### 10. Realtime transport

**A transport exists, is implemented, and is enabled in the dev profile.**

STOMP over SockJS, with a Spring simple broker.

| Item | Value |
|------|-------|
| Handshake | `/ws/comments` and `/ws/notifications`, both `withSockJS()` |
| Auth | JWT as the `token` query parameter, because a browser cannot set headers on a WebSocket upgrade |
| Broker prefix | `/topic` |
| Application destination prefix | guarded by `BrokerSendGuardInterceptor`, which rejects a forged client `SEND` to any `/topic/**` destination |
| Comment topic | `/topic/comments.{postId}.events` |
| Notification topic | `/topic/notifications.{recipientId}` |
| Envelope | `{"eventType": "...", "data": { }}` |
| Comment event types | `comment.created.v1`, `comment.edited.v1`, `comment.deleted.v1`, `comment.liked.v1`, `comment.unliked.v1` |
| Feature flags | `app.comment.live.enabled`, `app.notification.live.enabled` |

Runtime evidence:

```
GET /ws/comments/websocket                      -> 401
GET /ws/comments/websocket?token=<accessToken>  -> 101 Switching Protocols
GET /ws/comments/info                           -> 200
GET /ws/notifications/info                      -> 200
```

The feature flags are absent from `backend/.env`, so they default to `false`, but
`application-dev.yml` hardcodes both to `true` and the dev profile is the default active profile.
The endpoints are therefore live in the standard local setup.
Whoever deploys must be aware the flags are yaml-hardcoded rather than environment-driven.

Two constraints:

- Broadcast frames use `CommentBroadcastResponse`, which omits `isLiked` and `pinned`. The keys are
  absent, not false. `isLiked` is only ever correct on a `CommentResponse` returned over REST.
- `CommentLiveBlockFilterInterceptor` filters the outbound channel per subscriber so a blocked
  counterparty's comment never reaches the blocked viewer.

The subscription is authenticated per topic: `CommentWebSocketAuthInterceptor` matches
`/topic/comments\.([0-9a-fA-F-]{36})\..+` and `NotificationWebSocketAuthInterceptor` matches
`/topic/notifications\.([0-9a-fA-F-]{36})`, so a client cannot subscribe to another user's
notification stream.

`WebSocketRevocationSweepService` runs on `WEBSOCKET_REVOCATION_INTERVAL` (default PT30S) and closes
sessions whose token has been revoked.

**Post like count is not broadcast.**
The comment topic carries comment events only.
Live post like counts are not available on any transport.

### 11. Route collision on `GET /users/suggestions`

**The premise is stale, and the real problem is on the frontend.**

There is no `/users/suggestions` endpoint anywhere in the backend.
`ApiConstants.Users` declares exactly `ME`, `BY_ID`, `BY_USERNAME`, `SEARCH`, `ME_SETTINGS`.

No ambiguous-mapping warning appears in the startup log.
Grepping the entire boot log for `suggestion`, `ambiguous`, and `shadow` returns nothing.
The only warnings at startup are three `CglibAopProxy` notices about final methods on
`OidcUserService`, which are framework noise.

What actually happens, runtime-verified:

```
GET /api/v1/users/suggestions
400 {"success":false,"code":"BAD_REQUEST","message":"Invalid request","data":null,...}
```

`GET /users/{userId}` matches the path, `"suggestions"` fails `UUID` conversion, and the global
handler turns that into a 400.

The frontend calls this endpoint.
`src/services/social.service.js:69` defines `getSuggestedUsers` against `/users/suggestions`, and
`src/features/luvax/components/shell.jsx` uses it, so the right rail issues a request that always
fails.

On declaration order in `UserController`: `/me`, `/me/settings`, `/{userId}`,
`/by-username/{username}`, `/search`.
`/search` is declared after `/{userId}`, which looks like a collision, but Spring's
`PathPattern` comparator prefers a literal segment over a template segment regardless of
declaration order.
Verified that `GET /users/search?q=recon` resolves correctly and returns results.

**The fix, not applied:** either delete `getSuggestedUsers` and its call site on the frontend, or
add a real suggestions endpoint to the backend. Since the backend is read-only for this project,
the frontend change is the only available option. Declaration order in `UserController` needs no
change.

### 12. Response envelope and error shape

Covered in full in `backend-api-contract.md`.
Summary:

- `ApiResponse<T>` is `{success, code, message, data, timestamp}` and is used by every endpoint that
  returns a body, including every error.
- Cursor pagination is `{content, pageInfo{hasNextPage, hasPreviousPage, startCursor, endCursor}}`
  with opaque base64 cursors.
- Offset pagination (`PageResponse`) exists in code for admin surfaces but no in-scope endpoint
  returns it.
- Validation errors are `400 VALIDATION_ERROR` with `data` as a field-name to message map.
- Status codes: 400 validation and malformed body and bad path type, 401 unauthenticated,
  403 forbidden, 404 not found, 409 duplicate action.
- Five endpoints return `204` with no envelope at all.
- An unsupported HTTP method returns 400 rather than 405.

## Counters and triggers

Every counter is maintained by a database trigger.
Application code and frontend code must never write them.

| Counter | Table | Trigger |
|---------|-------|---------|
| `follower_count`, `following_count` | `users` | `trg_follow_counts` |
| `post_count` | `users` | `trg_post_count` |
| `like_count` | `posts` | `trg_post_like_count` |
| `comment_count` | `posts` | `trg_post_comment_count` |
| `save_count` | `posts` | `trg_post_save_count` |
| `like_count` | `comments` | `trg_comment_like_count` |
| `reply_count` | `comments` | `trg_comment_reply_count` |
| `post_count` | `hashtags` | `trg_hashtag_post_count` |

All have `CHECK (column >= 0)`.
`posts.view_count` is the exception: it is not trigger-maintained and is updated by a background
job, so it lags.

The frontend may show a counter optimistically, but must reconcile from the next server response
rather than treat its own arithmetic as authoritative.

## Soft delete

`users`, `posts`, `comments`, `stories` carry `deleted_at`.
`messages` uses `is_deleted` plus `deleted_at`.

A soft-deleted user does not release their username or email; the unique constraints hold
regardless of `deleted_at`.

`UserSummaryResponse` resolves a deleted or unknown author to a placeholder whose `username` is
null and whose `displayName` is a fixed marker, so a client never has to branch on a missing
author. The `username` field is therefore nullable in every embedded author object.

## Asynchronous infrastructure

The backend runs a transactional outbox plus a RabbitMQ consumer inbox, neither of which is
described in any existing document.

- `outbox_events` with a publisher that batches, confirms, and retries with backoff.
- `processed_messages` for consumer-side idempotency.
- Consumers for mail, notification, hashtag, post, comment, and story, all enabled in the dev
  profile.

This matters to the frontend in one way: notifications and hashtag counts are eventually
consistent. A follow produced a notification row within a second during this audit, but the
delivery path is asynchronous and a client must not assume read-your-writes on those surfaces.
