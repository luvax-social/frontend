# Backend API Contract

> Superseded by the OpenAPI spec served at `http://localhost:8080/api-docs` under the dev profile. Record of work done on 2026-08-01; not maintained.

Every entry below was produced against a running instance on `http://localhost:8080` at commit
`450212e996881360abf5b04becfa1ee765a72946`.

Base path is `/api/v1`.
All paths in this file are relative to it.

Each entry is marked **runtime-verified** (a real request was sent and the response recorded) or
**code-derived** (read from source only, with the reason it was not exercised).

## The response envelope

Every endpoint that returns a body wraps it in the same envelope.
Confirmed on every single response observed during this audit, success and failure alike.

```json
{
  "success": true,
  "code": "OK",
  "message": "Operation completed successfully",
  "data": { },
  "timestamp": "2026-08-06T16:14:54.121631500Z"
}
```

| Field | Type | Notes |
|-------|------|-------|
| `success` | boolean | true for 2xx, false otherwise |
| `code` | string | A machine-readable code, not the HTTP status. `OK`, `CREATED`, `POST_NOT_FOUND`, `SOCIAL_ALREADY_FOLLOWING`, and so on |
| `message` | string | Human-readable default for the code |
| `data` | object or null | The payload. Null on empty success and on most failures |
| `timestamp` | string | ISO-8601 instant, UTC, with nanosecond precision |

Three endpoints return `204 No Content` with no envelope at all: `DELETE /posts/{id}`,
`DELETE /social/follow/{id}`, `DELETE /social/block/{id}`, plus
`PATCH /social/follow-requests/{id}/approve` and `.../reject`.
A client must not attempt to parse a body from those.

Note the inconsistency: `DELETE /posts/{postId}/save` returns 204 with no body, while
`DELETE /posts/{postId}/like` returns 200 with a full envelope, and
`DELETE /comments/{commentId}` returns 200 with an envelope whose `data` is null.
See `defects.md`.

## Pagination

Two shapes exist.
Every in-scope list endpoint uses the cursor shape.

### Cursor pagination (`CursorPageResponse`)

```json
{
  "content": [ ],
  "pageInfo": {
    "hasNextPage": false,
    "hasPreviousPage": false,
    "startCursor": "ZmVlZDoxNzg2MDMyODg1MTg2Mjc3OjQ0ZDY4ZWE1LTBjNzMtNDIyOS1iMzgwLWM1OTcyYmM1YTE5OQ",
    "endCursor": "ZmVlZDoxNzg2MDMyODg1MDY3NTUwOmVjNDgzOTQ0LWU5ODgtNGQyZi04NmJiLTI5ZDQ0MmI3ODJlMg"
  }
}
```

Cursors are opaque base64.
Decoded they carry a scope prefix, a microsecond timestamp, and a UUID, for example
`feed:1786032885186277:44d68ea5-0c73-4229-b380-c5972bc5a199`.
A client must treat them as opaque; the scope prefix is validated server-side and a cursor from one
list is rejected by another.

Request parameters are `cursor` (optional, omit for the first page) and `limit` (default 20).
`startCursor` and `endCursor` are null when `content` is empty.

### Offset pagination (`PageResponse`)

Declared in `common/response/PageResponse.java` with `page`, `size`, `totalElements`,
`totalPages`, `first`, `last`, `empty`.
No in-scope endpoint was observed returning it.
Code-derived; the class documents itself as being for admin endpoints.

## Error shapes and status codes

All runtime-verified.

| Case | Status | `code` | `data` |
|------|--------|--------|--------|
| Bean validation failure | 400 | `VALIDATION_ERROR` | Object mapping field name to message |
| Unparseable JSON body | 400 | `MALFORMED_REQUEST_BODY` | null |
| Path variable fails type conversion | 400 | `BAD_REQUEST` | null |
| HTTP method not supported on an existing path | 400 | `BAD_REQUEST`, message `HTTP method not supported: POST` | null |
| No or invalid credentials | 401 | `UNAUTHORIZED` | null |
| Authenticated but not permitted | 403 | `FORBIDDEN` or a domain code such as `POST_FORBIDDEN`, `COMMENT_FORBIDDEN` | null |
| Entity absent, or hidden by a block | 404 | `NOT_FOUND` or a domain code such as `POST_NOT_FOUND` | null |
| Duplicate of an action already taken | 409 | `SOCIAL_ALREADY_FOLLOWING`, `POST_ALREADY_LIKED`, `POST_ALREADY_SAVED`, `COMMENT_ALREADY_LIKED`, `SOCIAL_ALREADY_REQUESTED`, `SOCIAL_ALREADY_BLOCKED`, `USER_ALREADY_EXISTS`, `REPORT_DUPLICATE` | null |

Observed validation error:

```
POST /posts   {"caption":"missing type"}
400 {"success":false,"code":"VALIDATION_ERROR","message":"Request validation failed",
     "data":{"postType":"must not be null"},"timestamp":"..."}
```

Observed unauthenticated call:

```
GET /posts/feed   (no Authorization header)
401 {"success":false,"code":"UNAUTHORIZED","message":"Authentication is required","data":null,...}
```

Note the method-not-supported case returns 400, not the correct 405.
Recorded in `defects.md`.

## Authentication

`Authorization: Bearer <accessToken>`.
Access tokens are HS256 JWTs with a 900 second lifetime, carrying `sub`, `role`, `jti`, `iss`,
`aud`, `nbf`, `exp`, `iat`.

Every endpoint in this document requires authentication unless stated otherwise.
`GET /users/{userId}` and `GET /users/by-username/{username}` accept an anonymous caller, in which
case `followerCount`, `followingCount`, and `postCount` come back null and `viewerState` is all
false.

### `POST /auth/register` - runtime-verified

Request:

```json
{"username":"recon_alice","email":"recon_alice@example.com",
 "password":"ReconPass123!","displayName":"Recon Alice"}
```

`username` 3-30 chars matching `^[a-zA-Z0-9_.]+$`, `email` a valid address, `password` 8-128 chars,
`displayName` optional, max 100.
Unknown fields are rejected outright (`@JsonIgnoreProperties(ignoreUnknown = false)`).

Response `201`:

```json
{"success":true,"code":"CREATED","message":"Resource created successfully",
 "data":null,"timestamp":"2026-08-06T16:12:37.433938200Z"}
```

Duplicate returns `409 USER_ALREADY_EXISTS`.

Registration does not log the user in and does not return a token.
The account cannot log in until its email is verified.

### `POST /auth/login` - runtime-verified

Request `{"identifier":"recon_alice@example.com","password":"ReconPass123!"}`.
`identifier` accepts either an email or a username; the server branches on the presence of `@`.

Response `200`:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "refreshToken": "PYMF798q0GWVHEDsM6JWzCqJZMN0XxK8peJuuBu_Oko",
  "accessTokenExpiresIn": 900,
  "tokenType": "Bearer",
  "user": {
    "id": "2af13d95-37b8-4901-bbc5-790eb1707c71",
    "username": "recon_alice",
    "email": "recon_alice@example.com",
    "displayName": "Recon Alice",
    "role": "user",
    "emailVerified": true
  }
}
```

An unverified account returns `403 AUTH_EMAIL_NOT_VERIFIED`.
This is a hard gate on every seeded or test account.
See `defects.md` and `seed-data.md`.

## Posts

### `POST /posts` - runtime-verified

Creates a post for the authenticated user.

| Field | Type | Required | Constraint |
|-------|------|----------|------------|
| `caption` | string | no | max 2200. `#tokens` are extracted as hashtags at publish time |
| `postType` | enum | yes | `image`, `video`, `carousel`, `text`, lowercase on the wire |
| `mediaIds` | UUID array | conditional | max 10. Required for image, video, carousel. Must be null or empty for text |
| `status` | enum | no | only `draft` or `published`; defaults to `published` |
| `locationName` | string | no | max 255 |
| `latitude` | decimal | no | -90 to 90 |
| `longitude` | decimal | no | -180 to 180 |

Observed request and `201` response for a text post:

```
POST /posts   {"caption":"alice first text post #recon #luvax","postType":"text"}
```

```json
{
  "id": "4583190b-000f-42f2-a49a-1b36b934e49b",
  "author": {"id":"2af13d95-...","username":"recon_alice","displayName":"Recon Alice",
             "avatarUrl":null,"isVerified":false},
  "caption": "alice first text post #recon #luvax",
  "postType": "text",
  "status": "published",
  "likeCount": 0, "commentCount": 0, "saveCount": 0,
  "isLiked": false, "isSaved": false,
  "viewCount": 0,
  "locationName": null, "latitude": null, "longitude": null,
  "media": [],
  "createdAt": "2026-08-06T16:13:56.231425Z",
  "updatedAt": "2026-08-06T16:13:58.765358Z"
}
```

Observed `201` response for an image post with one media asset, showing the `media` array shape:

```json
"media": [
  {
    "id": "a2f786bf-be03-4ed4-8606-9a8c0bd1fbb3",
    "mediaAssetId": "11f6cf29-8abc-4736-a809-4c500423b6c7",
    "position": 0,
    "altText": null,
    "cdnUrl": "https://pub-78fa38fa7fe945d096662d38270b9dbd.r2.dev/users/2af13d95-.../media/9eefc72d-....jpg",
    "mediaType": "image",
    "width": 1080,
    "height": 1080,
    "blurhash": "LKO2?U%2Tw=w]~RBVZRi};RPxuwH"
  }
]
```

Note that `updatedAt` is later than `createdAt` on a freshly created post.
A database trigger touches the row after insert, so a client must not use
`createdAt !== updatedAt` to mean "this post was edited".

### `GET /posts/{postId}` - runtime-verified

Returns the same `PostResponse` shape as creation.
`404 POST_NOT_FOUND` for an unknown or soft-deleted id.
`403 POST_FORBIDDEN` when a block exists between the viewer and the author, in either direction.

### `PATCH /posts/{postId}` - runtime-verified

Replaces the caption.
Body `{"caption": "..."}`, required, max 2200, empty string clears it.
Returns `200` with the full `PostResponse`.
Non-owner returns `403 POST_FORBIDDEN`.

### `PATCH /posts/{postId}/status` - runtime-verified

Body is `{"targetStatus": "archived"}`.

**The field is `targetStatus`, not `status`.**
Sending `{"status":"archived"}` returns `400 MALFORMED_REQUEST_BODY`, observed.
The frontend currently sends the wrong field name; see `defects.md`.

Valid transitions per the request DTO documentation: draft to published, published to archived,
archived to published, and any status to removed.
Observed: published to archived and archived to published both return `200`.

### `DELETE /posts/{postId}` - runtime-verified

Soft delete.
Owner or admin only; a non-owner gets `403 POST_FORBIDDEN`.
Returns `204` with no body.

Verified in the database that the row is retained with `status = 'removed'` and `deleted_at` set.
A subsequent `GET /posts/{postId}` returns `404 POST_NOT_FOUND`.

### `GET /posts/feed` - runtime-verified

Chronological feed of posts by accounts the viewer follows.
Cursor-paginated, `limit` default 20.

Returns `FeedPostResponse`, which is `PostResponse` plus one extra field:

```json
"rankingScore": null
```

`rankingScore` is documented as reserved and is always null in the current chronological
implementation.

**The feed does not include the viewer's own posts.**
Observed: with Alice following Bob and having created two posts of her own, her feed returned only
Bob's two posts.
This matters for the demo, because a fresh account sees an empty feed until it follows someone.

Blocked authors are excluded.
Observed: Dave's post was present in Alice's feed before the block and absent immediately after.

### `GET /posts/user/{userId}` - runtime-verified

A user's published posts, cursor-paginated, `PostResponse` items.

### `GET /posts/{postId}/history` - runtime-verified

Append-only caption edit audit for an owned post.
Cursor-paginated.

Observed `200`:

```json
{
  "id": "e7771c26-8cca-4d41-9c1e-d7373e6b011a",
  "postId": "4583190b-000f-42f2-a49a-1b36b934e49b",
  "editor": {"id":"2af13d95-...","username":"recon_alice","displayName":"Recon Alice",
             "avatarUrl":null,"isVerified":false},
  "previousCaption": "alice first text post #recon #luvax",
  "editedAt": "2026-08-06T16:18:32.522975Z"
}
```

### `GET /posts/search?q=` - runtime-verified

Full-text search of published post captions.
Cursor-paginated, `PostResponse` items.
Backed by Elasticsearch; the controller documents that it degrades to an empty page when search is
unavailable rather than erroring.

Observed: `q=sunsets` matched a post whose caption was "bob post two about sunsets", so matching is
stemmed rather than exact substring.

Note this contradicts the workspace `GLOBAL_RULES.md`, which states there is no Elasticsearch in
v1 and that search uses a PostgreSQL trigram index.
The backend wins: `docker-compose.yaml` runs Elasticsearch 9.0.3 and the pom declares
`spring-boot-starter-data-elasticsearch`.

### `POST /posts/{postId}/like` - runtime-verified

No body.
Returns `201`:

```json
{"postId":"ec483944-e988-4d2f-86bb-29d442b782e2","liked":true,"likeCount":1}
```

Liking twice returns `409 POST_ALREADY_LIKED`.
**The endpoint is not idempotent.**
An optimistic UI must treat 409 as "already in the target state" rather than as an error.

Liking your own post is allowed, observed `201`.
This differs from comments; see below.

### `DELETE /posts/{postId}/like` - runtime-verified

Returns `200` with the same shape:

```json
{"postId":"ec483944-e988-4d2f-86bb-29d442b782e2","liked":false,"likeCount":0}
```

### `GET /posts/{postId}/likes` - runtime-verified

Cursor-paginated list of likers as `UserListItemResponse`:

```json
{
  "user": {"id":"2af13d95-...","username":"recon_alice","displayName":"Recon Alice",
           "avatarUrl":null,"isVerified":false},
  "viewerState": {"isFollowing":false,"isFollowRequested":false,
                  "isFollowedBy":false,"isBlocking":false}
}
```

### `POST /posts/{postId}/save` and `DELETE /posts/{postId}/save` - runtime-verified

Save returns `201` with `data: null`.
Duplicate returns `409 POST_ALREADY_SAVED`.
Unsave returns `204` with no body.
Saving your own post is allowed.

### `GET /posts/saved` - runtime-verified

The viewer's saved posts, cursor-paginated:

```json
{
  "post": { PostResponse },
  "savedAt": "2026-08-06T..."
}
```

## Comments

### `POST /posts/{postId}/comments` - runtime-verified

| Field | Type | Required | Constraint |
|-------|------|----------|------------|
| `postId` | UUID | yes | must equal the path value or the request is rejected 400 |
| `parentId` | UUID | no | null for a top-level comment |
| `content` | string | yes | not blank, max 2200 |

Optional header `Idempotency-Key`.
**Verified: replaying the same key returns 201 and the identical comment id**, so this is true
idempotency, not just deduplication. It is the only write endpoint in the audit that offers it.

Observed `201` for a depth-1 reply:

```json
{
  "id": "33d8aedc-82c2-447e-b02a-59c39665bf46",
  "postId": "ec483944-e988-4d2f-86bb-29d442b782e2",
  "author": {"id":"cea4b377-...","username":"recon_bob","displayName":"recon_bob",
             "avatarUrl":null,"isVerified":false},
  "parentId": "fd5ce1e0-0719-44cd-9300-9e93ea11b622",
  "rootId": "fd5ce1e0-0719-44cd-9300-9e93ea11b622",
  "depth": 1,
  "content": "depth 1 reply",
  "likeCount": 0,
  "isLiked": false,
  "replyCount": 0,
  "createdAt": "2026-08-06T16:15:20.489731Z",
  "updatedAt": "2026-08-06T16:15:24.172592Z",
  "pinned": false
}
```

For a top-level comment both `parentId` and `rootId` are null and `depth` is 0.
`rootId` always points at the top-level ancestor, not the immediate parent.

### `GET /posts/{postId}/comments` - runtime-verified

Top-level comments only, cursor-paginated.
There is **no sort parameter**.

The ordering rule is non-obvious and is the single most important thing to get right in the UI:

- On the first page (no `cursor`), up to three comments are prepended as a pinned block. They are
  the top-level comments with the highest `like_count`, ordered by
  `(like_count, created_at, id)` descending, and they carry `"pinned": true`.
  Only comments with `like_count > 0` are eligible; a post with no comment likes has no pinned
  block at all.
- The remainder of the first page is the newest-first keyset stream with the pinned ids excluded,
  so nothing appears twice.
- Page two onward, reached with `cursor`, is pure newest-first with no pinned block.

Runtime evidence for the threshold: the same comment returned `"pinned": false` while it had zero
likes and `"pinned": true` after one like was added.

`replyCount` is a direct-child count, not a subtree count.

### `GET /comments/{commentId}/replies` - runtime-verified

Direct replies to one comment, cursor-paginated, newest first.
**No pinned block applies to replies**; the ordering is purely chronological on every page.

To render a full thread the client must walk the tree one level at a time.
There is no endpoint that returns a subtree in one call.

### `PATCH /comments/{commentId}` - runtime-verified

Body `{"content": "..."}`, not blank, max 2200.
Returns `200` with the full `CommentResponse`.
Non-owner returns `403 COMMENT_FORBIDDEN`, observed.

### `DELETE /comments/{commentId}` - runtime-verified

Returns `200` with an envelope whose `data` is null, not 204.

**Deleting a comment soft-deletes its entire subtree in one statement.**
Verified in the database: after deleting the depth-1 comment of a chain running to depth 4, all
four rows carried a non-null `deleted_at` while the depth-0 root stayed live.
The subsequent replies listing for the root returned an empty array.

### `POST /comments/{commentId}/like` and `DELETE /comments/{commentId}/like` - runtime-verified

Both return `200` with `data: null`.
There is no counter in the response, unlike post likes; the client must refetch to get the new
`likeCount`.

Duplicate like returns `409 COMMENT_ALREADY_LIKED`.

**Liking your own comment returns `403 COMMENT_FORBIDDEN`.**
Runtime-verified, and confirmed in `CommentServiceImpl.likeComment`, which throws when
`comment.getUserId().equals(actorId)`.
Posts have no such restriction.
The UI must hide or disable the like control on the viewer's own comments.

## Social

### `POST /social/follow/{targetUserId}` - runtime-verified

No body.
Returns `201`:

```json
{
  "followerId": "2af13d95-37b8-4901-bbc5-790eb1707c71",
  "followingId": "cea4b377-33a5-4ce3-8b1c-de8d02e98d24",
  "status": "accepted",
  "createdAt": "2026-08-06T16:14:48.791701Z"
}
```

Against a private account the same call returns `201` with `"status": "pending"`, observed.
Duplicate returns `409 SOCIAL_ALREADY_FOLLOWING` or `409 SOCIAL_ALREADY_REQUESTED`.

### `DELETE /social/follow/{targetUserId}` - runtime-verified

Returns `204`, no body.
Also cancels a pending request.

### `GET /social/follow-requests` - runtime-verified

Pending inbound requests, cursor-paginated:

```json
{
  "id": "2af13d95-37b8-4901-bbc5-790eb1707c71",
  "follower": {"id":"2af13d95-...","username":"recon_alice","displayName":"Recon Alice",
               "avatarUrl":null,"isVerified":false},
  "status": "pending",
  "createdAt": "2026-08-06T16:16:38.8653Z",
  "viewerState": {"isFollowing":false,"isFollowRequested":false,
                  "isFollowedBy":false,"isBlocking":false}
}
```

Note `id` is the requester's user id, not a separate request identifier.
That is consistent with the approve and reject paths, which take `{requesterId}`.

### `PATCH /social/follow-requests/{requesterId}/approve` and `/reject` - runtime-verified

**These are `PATCH`, not `POST`.**
Sending `POST` returns `400` with message `HTTP method not supported: POST`, observed.
Both return `204` with no body.

### `POST /social/block/{targetUserId}` - runtime-verified

Returns `201` with `data: null`.
Duplicate returns `409 SOCIAL_ALREADY_BLOCKED`.

### `DELETE /social/block/{targetUserId}` - runtime-verified

Returns `204`, no body.
Verified that the block list is empty afterwards and the previously hidden profile becomes
readable again (`200`).
The follow edges destroyed by the block are **not** restored.

### `GET /social/blocked` - runtime-verified

Cursor-paginated `UserListItemResponse`, observed with `"isBlocking": true` on every row.

This is the only surface on which a blocked account is visible to the blocker, because
`GET /users/{blockedId}` returns 404 for the blocker too.
Any unblock affordance must live here.

### `GET /social/users/{userId}/followers` and `/following` - runtime-verified

Cursor-paginated `UserListItemResponse`.
Observed follower row with a mutual relationship:

```json
{
  "user": {"id":"cea4b377-...","username":"recon_bob","displayName":"recon_bob",
           "avatarUrl":null,"isVerified":false},
  "viewerState": {"isFollowing":true,"isFollowRequested":false,
                  "isFollowedBy":true,"isBlocking":false}
}
```

## Users

### `GET /users/me` - runtime-verified

```json
{
  "id": "2af13d95-37b8-4901-bbc5-790eb1707c71",
  "username": "recon_alice",
  "email": "recon_alice@example.com",
  "displayName": "Recon Alice",
  "bio": null,
  "avatarUrl": null,
  "websiteUrl": null,
  "isPrivate": false,
  "isVerified": false,
  "followerCount": 1,
  "followingCount": 1,
  "postCount": 1,
  "createdAt": "2026-08-06T16:12:37.368023Z"
}
```

`isVerified` is the administrator-granted platform badge, not email confirmation.
Email confirmation appears only as `emailVerified` in the login response.

### `PATCH /users/me` - runtime-verified

Partial update.
Fields: `username`, `displayName`, `bio` (max 500), `avatarUrl` (max 2048), `websiteUrl`
(max 2048), `isPrivate` (boolean).
Unknown fields rejected.
Empty string clears `bio`, `avatarUrl`, `websiteUrl`.
Returns `200` with the full `UserProfileResponse`.

Observed: `{"isPrivate": true}` returns `200` and subsequent follows against that account come back
`pending`.

### `GET /users/{userId}` - runtime-verified

```json
{
  "id": "e9d67777-ec12-4985-9d71-6e69f9184d28",
  "username": "recon_carol",
  "displayName": "recon_carol",
  "bio": null,
  "avatarUrl": null,
  "websiteUrl": null,
  "isPrivate": true,
  "isVerified": false,
  "followerCount": null,
  "followingCount": null,
  "postCount": null,
  "createdAt": "2026-08-06T16:13:15.942596Z",
  "viewerState": {"isFollowing":false,"isFollowRequested":true,
                  "isFollowedBy":false,"isBlocking":false}
}
```

The three counts are null when the caller is anonymous, and were also null here for an
authenticated non-follower of a private account.
A client must handle null counts, not assume integers.

Returns `404 NOT_FOUND` when a block exists in either direction.

### `GET /users/by-username/{username}` - runtime-verified

Same shape.
The controller documents the match as case-sensitive, though migrations V42 and V44 add
case-insensitive indexes on username and email.

### `GET /users/search?q=` - runtime-verified

Cursor-paginated `UserListItemResponse`, matched on username substring.
Accounts in a block relationship with the viewer are excluded in both directions, observed.

Note the route ordering in `UserController`: `/me`, `/me/settings`, `/{userId}`,
`/by-username/{username}`, `/search`.
`/search` is declared after `/{userId}`, but Spring's pattern comparator prefers the literal over
the template, so `GET /users/search?q=` resolves correctly.
Verified at runtime.

### `GET /users/me/settings` and `PATCH /users/me/settings` - runtime-verified

```json
{
  "notifyLikes": true, "notifyComments": true, "notifyFollows": true,
  "notifyMentions": true, "notifyMessages": true,
  "showActivityStatus": true, "allowStoryReplies": true, "allowMessageRequests": true,
  "updatedAt": "2026-08-06T16:13:15.945911Z"
}
```

Note there is **no `isPrivate` here**.
The private account flag lives on the profile, set through `PATCH /users/me`.

## Reports

### `POST /reports` - runtime-verified

| Field | Type | Required |
|-------|------|----------|
| `reportType` | enum `post`, `comment`, `user`, `story`, `message` | yes |
| `reportReason` | enum `spam`, `nudity`, `violence`, `hate_speech`, `harassment`, `false_information`, `scam`, `other` | yes |
| `entityId` | UUID | yes |
| `description` | string, max 2000 | no |

Observed `201`:

```json
{
  "id": "730788a3-d459-4760-992b-907eb8096d68",
  "reporterId": "2af13d95-37b8-4901-bbc5-790eb1707c71",
  "reportType": "post",
  "reportReason": "spam",
  "entityId": "ec483944-e988-4d2f-86bb-29d442b782e2",
  "description": "recon audit report",
  "status": "pending",
  "reviewedBy": null,
  "reviewedAt": null,
  "resolutionNote": null,
  "createdAt": "2026-08-06T16:18:14.42468Z"
}
```

Reporting the same entity twice as the same reporter returns `409 REPORT_DUPLICATE`, observed.
The guard is backed by a unique index added in migration V30.

Verified for `post`, `comment`, and `user` target types, all `201`.

### `GET /reports`, `GET /reports/pending`, `GET /reports/{id}`, `PATCH /reports/{id}/status`

`GET /reports` and `GET /reports/pending` both returned `403 FORBIDDEN` for a regular account,
observed.
These require a moderator or administrator role.

Reports are therefore **write-only for an ordinary user**.
There is no "my reports" endpoint, so a client cannot show a user what they have reported, and
cannot pre-disable a report control for an already-reported entity except by remembering the
409 locally.

`GET /reports/{id}` and `PATCH /reports/{id}/status` are code-derived.
Not exercised because no moderator or administrator account exists in this environment and creating
one requires a database write, which the audit avoided for role escalation.

## Media

### `POST /media/upload` - runtime-verified

Request `{"mediaType":"IMAGE","mimeType":"image/jpeg","fileSize":1048576}`.
Note `mediaType` is uppercase here, unlike the lowercase enums elsewhere on the wire.

Observed `200`:

```json
{
  "storageKey": "users/2af13d95-.../media/9eefc72d-c310-4966-99e3-ddbb0e81c3fb.jpg",
  "uploadUrl": "https://<account>.r2.cloudflarestorage.com/luvax-develop/users/...?X-Amz-Algorithm=...",
  "method": "PUT",
  "requiredHeaders": {"content-type": "image/jpeg", "content-length": "1048576"},
  "expiresAt": "2026-08-06T16:24:08.808949700Z"
}
```

The URL is a real Cloudflare R2 pre-signed URL with a 600 second expiry.
The client must `PUT` to it directly with both headers in `requiredHeaders`.

### `POST /media/upload-complete` - runtime-verified

| Field | Required | Note |
|-------|----------|------|
| `storageKey` | yes | the value returned above, max 512 |
| `mediaType` | yes | `IMAGE` or `VIDEO` |
| `mimeType` | yes | max 100 |
| `fileSize` | yes | positive |
| `width` | yes | positive |
| `height` | yes | positive |
| `duration` | no | must be null for images |
| `blurhash` | no | max 100 |

Observed `201`, returning `id`, `userId`, `storageKey`, `cdnUrl`, `mediaType` (lowercase in the
response), `mimeType`, `fileSize`, `width`, `height`, `duration`, `blurhash`, `createdAt`.

**No server-side object inspection occurs.**
Verified: calling `upload-complete` without ever transferring bytes to R2 still returns `201` and
creates the asset row.
The resulting `cdnUrl` will 404 in a browser.
This is what allows the seed script to create posts with a media relation without uploading files,
and it is also a correctness hazard worth knowing about.

## Hashtags

### `GET /hashtags/search?q=` - runtime-verified

Cursor-paginated:

```json
{"id":"00e6f44d-7bec-401b-b694-8b2c3fdc3579","name":"recon","postCount":4,
 "createdAt":"2026-08-06T16:13:58.765Z"}
```

### `GET /hashtags/trending` - runtime-verified

```json
{"hashtagId":"00e6f44d-...","name":"recon","postCount":4,"rank":1,
 "periodStart":"2026-08-05T16:00:00Z","periodEnd":"2026-08-06T16:16:56.291202Z"}
```

Note the id field is named `hashtagId` here and `id` in the search response.

## Out-of-scope modules, confirmed present

These are not being built, but the frontend navigation references them and the design export
contains screens for them, so their status matters.

| Endpoint | Status | Evidence |
|----------|--------|----------|
| `GET /notifications` | Implemented, returns `200` | runtime-verified |
| `GET /notifications/unread-count` | Implemented, returns `200` | runtime-verified |
| `PATCH /notifications/{id}/read`, `PATCH /notifications/read-all` | Implemented | code-derived |
| `GET /stories/feed` | Implemented, returns `200` | runtime-verified |
| `GET /conversations` | Implemented, returns `200` | runtime-verified |
| `/api/v1/admin/**` | Implemented, 13 endpoints | code-derived, requires an admin role |

Observed notification item:

```json
{
  "id": "f7898075-9b89-4324-b127-582d7da47aab",
  "actor": {"id":"dc3ce5c5-...","username":"recon_dave","displayName":"recon_dave",
            "avatarUrl":null,"isVerified":false},
  "type": "follow",
  "entityType": null,
  "entityId": null,
  "isRead": false,
  "readAt": null,
  "createdAt": "2026-08-06T16:16:56.194666Z"
}
```

Notifications are produced asynchronously through RabbitMQ and are populated in this environment,
so they are not a stub.

## Realtime transport - runtime-verified

STOMP over SockJS.

| Item | Value |
|------|-------|
| Endpoints | `/ws/comments` and `/ws/notifications`, both with SockJS fallback |
| Broker | Spring simple broker, destination prefix `/topic` |
| Comment topic | `/topic/comments.{postId}.events` |
| Notification topic | `/topic/notifications.{recipientId}` |
| Authentication | JWT access token as the `token` **query parameter** on the handshake URL, because a browser cannot set an `Authorization` header on a WebSocket upgrade |
| Enabled by | `app.comment.live.enabled` and `app.notification.live.enabled`, both hardcoded `true` in `application-dev.yml` |

Handshake evidence:

```
GET /ws/comments/websocket                        -> 401
GET /ws/comments/websocket?token=<accessToken>    -> 101 Switching Protocols
```

`GET /ws/comments/info` and `GET /ws/notifications/info` both return `200` with a SockJS info
document.

Message envelope on the comment topic, from `CommentLiveFanoutConsumer`:

```json
{"eventType": "comment.created.v1", "data": { }}
```

Event types: `comment.created.v1`, `comment.edited.v1`, `comment.deleted.v1`,
`comment.liked.v1`, `comment.unliked.v1`.
This covers both halves of the settled realtime decision: new comments and comment like changes on
the open post.

Two constraints the client must respect:

- The broadcast payload is `CommentBroadcastResponse`, which deliberately **omits `isLiked` and
  `pinned`**. One serialised blob is shared by every subscriber, so a viewer-dependent field cannot
  be resolved. The keys are absent, not false.
- An outbound interceptor filters frames per subscriber so a blocked counterparty's comment never
  reaches the blocked viewer.

Note that **post like count is not broadcast**. The comment topic carries comment events only.
Live post like counts would require polling or a refetch.

## Endpoints not exercised

| Endpoint | Why |
|----------|-----|
| `GET /reports/{reportId}`, `PATCH /reports/{reportId}/status` | Requires a moderator or administrator role; no such account exists and creating one needs a direct database write |
| All `/api/v1/admin/**` | Same reason |
| `POST /auth/verify-email`, `/forgot-password`, `/reset-password`, `/verify-email/resend` | Require a token delivered by email; the local mail provider rejects the seed email domain, so no token is obtainable |
| `POST /auth/oauth2/exchange` | Requires a live Google OAuth round trip |
| Story and message write endpoints | Out of scope as product features; read endpoints were probed to confirm the modules respond |
| Offset `PageResponse` shape | No in-scope endpoint returns it |
