# Response Shape Audit

> Record of work done on 2026-08-09. Not maintained; it is correct as of that date and is not updated as the code moves.

Every response type the frontend consumes, compared field by field against a real response body captured from the running server.

Backend commit under test: `450212e` on `develop`.
Data: the four seeded accounts created by `tools/seed/seed.py`.

Two rules governed the audit.
The backend DTO was read first, and never inferred from how the frontend reads it.
Every shape below was then confirmed against an actual response, because a DTO can be reshaped by a serializer.

That second rule mattered immediately.
`CursorPageResponse` declares `content`, `hasNextPage`, `startCursor`, `endCursor`, and `hasPreviousPage` as constructor parameters, which reads like a flat envelope.
The real response nests four of those under `pageInfo`.

---

## Summary

Eleven mismatches were found across nine response types.
All eleven are fixed.

| # | Response type | Field the frontend read | Reality | Effect |
|---|---------------|------------------------|---------|--------|
| 1 | `CursorPageResponse` | `data.hasNextPage`, `data.endCursor` | nested under `data.pageInfo` | infinite scroll stopped after page one on followers, following, and notifications |
| 2 | `PostResponse` / `FeedPostResponse` | `post.username`, `post.author` as a string | `author` is a `UserSummaryResponse` object | feed and explore crashed to the error boundary |
| 3 | `PostResponse` / `FeedPostResponse` | `post.userId`, `post.authorId` | neither exists; the id is `author.id` | follow, block, and view-profile from a post card all received `undefined` |
| 4 | `PostResponse` / `FeedPostResponse` | `post.userAvatarUrl` | does not exist; it is `author.avatarUrl` | no avatar ever rendered on a post |
| 5 | `PostResponse` / `FeedPostResponse` | `post.isLiked`, `post.isSaved` not read | both returned | the heart and bookmark always rendered empty regardless of real state |
| 6 | `PostResponse` / `FeedPostResponse` | `post.commentCount \|\| Math.floor((post.likes \|\| 0) / 8) + 2` | `commentCount` is authoritative | a post with zero comments displayed a fabricated count of 2 |
| 7 | `CommentResponse` | `comment.userId` | does not exist; `author` is embedded | every comment showed "unknown" and fired a wasted profile request per row |
| 8 | `NotificationResponse` | `n.actorId` | does not exist; `actor` is embedded | every notification showed "Someone" and fired a wasted profile request per row |
| 9 | `NotificationResponse` | `n.type === 'like'` / `'comment'` | enum values are `like_post`, `like_comment`, `comment_post`, ... | every notification read "interacted with you" |
| 10 | `UnreadCountResponse` | `data.count` | the field is `unreadCount` | the unread badge never appeared |
| 11 | `UserListItemResponse` | row fields read flat | the user nests under `user`, with `viewerState` alongside | follower and following rows showed "Unknown", "@unknown", no avatar, a dead click target, and always "follow" |

Two further mismatches were found in values rather than field names.

| # | Response type | Read | Reality | Effect |
|---|---------------|------|---------|--------|
| 12 | `PostMediaResponse` | `mediaType === 'VIDEO'` | serialised lower case as `"video"` | every video rendered through the image branch |
| 13 | `FollowRequestResponse` | `req.requester`, `req.requesterId` | the field is `follower` | follow request rows were blank and accept/decline sent `undefined` |

---

## `ApiResponse<T>` envelope

Every response is wrapped.

```json
{ "success": true, "code": "OK", "message": "...", "data": { }, "timestamp": "..." }
```

| Field | Type | Frontend reads it | Path used | Correct |
|-------|------|------------------|-----------|---------|
| `success` | boolean | no | - | - |
| `code` | string | yes | `error.response.data.code` | yes, corrected in the previous phase |
| `message` | string | yes | normalised by the axios interceptor | yes |
| `data` | T | yes | `response.data.data` via `getPayload` / `extractPageContent` | yes |
| `timestamp` | string | no | - | - |

No mismatch.

---

## `CursorPageResponse<T>`

Observed on `GET /posts/feed`:

```json
{
  "content": [ ... ],
  "pageInfo": {
    "hasNextPage": true,
    "hasPreviousPage": false,
    "startCursor": "ZmVlZDoxNzg2MDM0MDU5NzUzOTUzOjliNmZkMmZjLTlmOTYtNGQyNi1hZWMxLTVlNjc5MDA1NjE2Ng",
    "endCursor": "ZmVlZDoxNzg2MDM0MDU5NzUzOTUzOjliNmZkMmZjLTlmOTYtNGQyNi1hZWMxLTVlNjc5MDA1NjE2Ng"
  }
}
```

| Field | Type | Frontend reads it | Path used | Correct |
|-------|------|------------------|-----------|---------|
| `content` | array | yes | `extractPageContent` reads `data.content` | yes |
| `pageInfo.hasNextPage` | boolean | yes | **was** `data.hasNextPage` in three hooks | **no, fixed** |
| `pageInfo.endCursor` | string, nullable | yes | **was** `data.endCursor` in three hooks | **no, fixed** |
| `pageInfo.startCursor` | string, nullable | no | - | - |
| `pageInfo.hasPreviousPage` | boolean | no | - | - |

`usePosts.js` already read `pageInfo` correctly in four places.
`useSocial.js` (followers, following) and `useNotifications.js` did not, so those three lists silently stopped paginating after the first page.

All seven now share one `getNextCursor` helper.

---

## `PostResponse` and `FeedPostResponse`

The two are identical except that `FeedPostResponse` adds `rankingScore`.
The frontend shares `PostCard` across both, so a field present on one and absent on the other would be a hazard; there is none, and `rankingScore` is not read.

Observed on `GET /posts/feed`:

```json
{
  "id": "9b6fd2fc-9f96-4d26-aec1-5e6790056166",
  "author": { "id": "9810eec3-...", "username": "luvax_dan", "displayName": "Luvax Dan", "avatarUrl": null, "isVerified": false },
  "caption": "[luvax-seed] this disappears from the feed once dan is blocked #recon",
  "postType": "text", "status": "published",
  "likeCount": 0, "commentCount": 0, "saveCount": 0,
  "isLiked": false, "isSaved": false, "viewCount": 0,
  "locationName": null, "latitude": null, "longitude": null,
  "media": [],
  "createdAt": "2026-08-06T16:34:19.753953Z",
  "updatedAt": "2026-08-06T16:34:23.99606Z",
  "rankingScore": null
}
```

| Field | Type | Frontend reads it | Path used | Correct |
|-------|------|------------------|-----------|---------|
| `id` | UUID | yes | `post.id` | yes |
| `author` | `UserSummaryResponse` | yes | **was** `post.username \|\| post.author` | **no, fixed** |
| `author.id` | UUID | yes | **was** `post.userId \|\| post.authorId` | **no, fixed** |
| `author.username` | string | yes | **was** `post.username` | **no, fixed** |
| `author.displayName` | string | yes | **was** absent | **no, fixed** |
| `author.avatarUrl` | string, nullable | yes | **was** `post.userAvatarUrl` | **no, fixed** |
| `author.isVerified` | boolean | no | - | - |
| `caption` | string | yes | **was** `post.caption \|\| post.text` | **no, fixed** |
| `postType` | enum, lower case | no | - | - |
| `status` | enum, lower case | no | - | - |
| `likeCount` | int | yes | **was** `post.likeCount \|\| post.likes \|\| 0` | **no, fixed** |
| `commentCount` | int | yes | **was** a fabricated fallback | **no, fixed** |
| `saveCount` | int | no | - | - |
| `isLiked` | boolean | **was not read** | initial state hard-coded `false` | **no, fixed** |
| `isSaved` | boolean | **was not read** | initial state hard-coded `false` | **no, fixed** |
| `viewCount` | int | no | - | - |
| `locationName` / `latitude` / `longitude` | nullable | no | - | - |
| `media` | `PostMediaResponse[]` | yes | `post.media[0]` | yes |
| `createdAt` | timestamp | yes | **was** `post.createdAt \|\| post.time` | **no, fixed** |
| `updatedAt` | timestamp | no | - | - |
| `rankingScore` | double, nullable | no | - | - |

The `post.text`, `post.likes`, `post.time`, and `post.idx` names in the fallback chains come from the static mock data in `features/luvax/constants/data.js`.
They are prototype field names that never existed on any API response.

### Why this crashed rather than degrading

`post.username` is undefined, so `post.username || post.author` evaluates to `post.author`, an object.

Two separate fatal paths followed.
`useRelativeTime` received the object as `seedKey` and called `.startsWith` on it, throwing `seedKey?.startsWith is not a function`.
Rendering the same object as a React child threw `Objects are not valid as a React child`.

Both replaced the whole screen with the error boundary.

---

## `PostMediaResponse`

Observed inside a feed post:

```json
{
  "id": "2244b61d-...", "mediaAssetId": "d6474b81-...", "position": 0, "altText": null,
  "cdnUrl": "https://pub-...r2.dev/users/.../3d152d66-....jpg",
  "mediaType": "image",
  "width": 1080, "height": 1080,
  "blurhash": "LKO2?U%2Tw=w]~RBVZRi};RPxuwH"
}
```

| Field | Type | Frontend reads it | Path used | Correct |
|-------|------|------------------|-----------|---------|
| `cdnUrl` | string | yes | `media.cdnUrl` | yes |
| `mediaType` | enum | yes | **was** `=== 'VIDEO'` | **no, fixed** |
| `altText` | string, nullable | yes | `mainMedia.altText` | yes |
| `id` / `mediaAssetId` / `position` / `width` / `height` / `blurhash` | - | no | - | - |

The enum serialises lower case, matching the PostgreSQL enum.
`=== 'VIDEO'` never matched, so every video rendered through the `<img>` branch.

The request side is not affected: `POST /media/upload` accepts both `"IMAGE"` and `"image"`, verified by sending each.

---

## `CommentResponse`

Observed on `GET /posts/{postId}/comments`:

```json
{
  "id": "4a23f2e0-...", "postId": "cb9aa4f4-...",
  "author": { "id": "9810eec3-...", "username": "luvax_dan", "displayName": "Luvax Dan", "avatarUrl": null, "isVerified": false },
  "parentId": null, "rootId": null, "depth": 0,
  "content": "an older comment everyone liked",
  "likeCount": 2, "isLiked": true, "replyCount": 0,
  "createdAt": "2026-08-06T16:34:20.195946Z",
  "updatedAt": "2026-08-06T16:34:24.454423Z",
  "pinned": true
}
```

| Field | Type | Frontend reads it | Path used | Correct |
|-------|------|------------------|-----------|---------|
| `id` | UUID | yes | `comment.id` | yes |
| `author` | `UserSummaryResponse` | yes | **was** `useUserProfile(comment.userId)` | **no, fixed** |
| `content` | string | yes | `comment.content` | yes |
| `likeCount` | int | yes | `comment.likeCount` | yes |
| `isLiked` | boolean | **not read** | local state initialised `false` | **not fixed, see below** |
| `replyCount` | int | yes | `comment.replyCount` | yes |
| `createdAt` | timestamp | yes | `comment.createdAt` | yes |
| `pinned` | boolean | no | - | out of scope by section 7 |
| `postId` / `parentId` / `rootId` / `depth` / `updatedAt` | - | no | - | - |

There is no `comment.userId`.
The old code fetched a profile per comment row with an undefined id, so every row showed "unknown" while issuing a wasted request.
The author is embedded, so no fetch is needed at all.

`isLiked` is returned and still unread.
Correcting it requires changing the comment like-count display logic, and section 7 excludes comment like from this phase.
Recorded in `deferred-findings.md`.

---

## `CommentBroadcastResponse`

The WebSocket broadcast variant.
It omits `isLiked` and `pinned`, which `CommentResponse` carries.

The frontend does not consume it: there is no WebSocket client, and realtime is out of scope by section 7.

This is the shared-component hazard from section 4.3 waiting to happen.
If a future phase feeds broadcast payloads into the same `CommentRow` that renders `CommentResponse`, `isLiked` and `pinned` will be undefined on live-arriving comments only.
Recorded in `deferred-findings.md`.

---

## `NotificationResponse`

Observed on `GET /notifications`:

```json
{
  "id": "0aa10933-...",
  "actor": { "id": "f34d7750-...", "username": "luvax_ben", "displayName": "Luvax Ben", "avatarUrl": null, "isVerified": false },
  "type": "like_comment",
  "entityType": "comment", "entityId": "4b93fe15-...",
  "isRead": false, "readAt": null,
  "createdAt": "2026-08-06T16:35:29.127328Z"
}
```

| Field | Type | Frontend reads it | Path used | Correct |
|-------|------|------------------|-----------|---------|
| `id` | UUID | yes | `n.id` | yes |
| `actor` | `UserSummaryResponse` | yes | **was** `useUserProfile(n.actorId)` | **no, fixed** |
| `type` | enum | yes | **was** compared to `'like'` / `'comment'` | **no, fixed** |
| `isRead` | boolean | yes | `n.isRead` | yes |
| `entityId` | UUID | yes | `n.entityId` | yes |
| `createdAt` | timestamp | yes | `n.createdAt` | yes |
| `entityType` / `readAt` | - | no | - | - |

The enum members are `like_post`, `like_comment`, `comment_post`, `reply_comment`, `follow`, `follow_request`, `mention_post`, `mention_comment`, `story_view`, `message`.
Neither `'like'` nor `'comment'` is a member, so every row fell through to "interacted with you".

---

## `UnreadCountResponse`

Observed on `GET /notifications/unread-count`:

```json
{ "unreadCount": 8 }
```

| Field | Type | Frontend reads it | Path used | Correct |
|-------|------|------------------|-----------|---------|
| `unreadCount` | long | yes | **was** `data.count` | **no, fixed** |

The account had eight unread notifications and the badge never appeared.

---

## `UserSummaryResponse`

```json
{ "id": "9810eec3-...", "username": "luvax_dan", "displayName": "Luvax Dan", "avatarUrl": null, "isVerified": false }
```

| Field | Type | Frontend reads it | Path used | Correct |
|-------|------|------------------|-----------|---------|
| `id` | UUID | yes | via `getUserSummary` | yes |
| `username` | string | yes | via `getUserSummary` | yes |
| `displayName` | string | yes | via `getDisplayName` | yes |
| `avatarUrl` | string, nullable | yes | via `getUserSummary` | yes |
| `isVerified` | boolean | no | - | - |

No mismatch in the type itself.
Every mismatch was in how callers reached it.

---

## `UserListItemResponse`

Observed on `GET /social/users/{userId}/followers`:

```json
{
  "user": { "id": "9810eec3-...", "username": "luvax_dan", "displayName": "Luvax Dan", "avatarUrl": null, "isVerified": false },
  "viewerState": { "isFollowing": true, "isFollowRequested": false, "isFollowedBy": true, "isBlocking": false }
}
```

| Field | Type | Frontend reads it | Path used | Correct |
|-------|------|------------------|-----------|---------|
| `user` | `UserSummaryResponse` | yes | **was** read flat as the row itself | **no, fixed** |
| `viewerState.isFollowing` | boolean | **was not read** | `UserCard` defaulted to `false` | **no, fixed** |
| `viewerState.isFollowRequested` | boolean | no | - | - |
| `viewerState.isFollowedBy` | boolean | no | - | - |
| `viewerState.isBlocking` | boolean | no | - | - |

Five call sites read this shape flat.
Two rendered rows (`FollowersScreen`, `FollowingScreen`) and three tested membership to decide whether a follow button says "Follow" or "Unfollow" (`PostCard`, `PostDetailScreen`, `ProfileScreen`).

The membership tests compared `item.id` against a user id.
`item.id` is undefined on every row, so the test always returned false and the button always offered "Follow", including for accounts the viewer already follows.

`BlockedUsersScreen` already read `row.user` correctly, having been written against this shape in the previous phase.

---

## `FollowRequestResponse`

Observed on `GET /social/follow-requests`:

```json
{
  "id": "19e3d49b-...",
  "follower": { "id": "19e3d49b-...", "username": "luvax_ava", "displayName": "Luvax Ava", "avatarUrl": null, "isVerified": false },
  "status": "pending",
  "createdAt": "2026-08-06T16:34:23.718273Z",
  "viewerState": { "isFollowing": false, "isFollowRequested": false, "isFollowedBy": false, "isBlocking": false }
}
```

| Field | Type | Frontend reads it | Path used | Correct |
|-------|------|------------------|-----------|---------|
| `follower` | `UserSummaryResponse` | yes | **was** `req.requester` | **no, fixed** |
| `follower.id` | UUID | yes | **was** `req.requesterId \|\| user.id` | **no, fixed** |
| `createdAt` | timestamp | yes | `req.createdAt` | yes |
| `id` / `status` / `viewerState` | - | no | - | - |

The response was additionally read as `requestsResponse?.data || requestsResponse || []`, which yields the `{content, pageInfo}` object rather than an array.
`requests.length` was therefore undefined, so the badge never showed and the tab always read "No pending requests" even with a request outstanding.

---

## `PublicUserProfileResponse`

Observed on `GET /users/{userId}` where the viewer does not follow a private account:

```json
{
  "id": "85fc0952-...", "username": "luvax_cleo", "displayName": "Luvax Cleo",
  "bio": null, "avatarUrl": null, "websiteUrl": null,
  "isPrivate": true, "isVerified": false,
  "followerCount": null, "followingCount": null, "postCount": null,
  "createdAt": "2026-08-06T16:34:09.95746Z",
  "viewerState": { "isFollowing": false, "isFollowRequested": true, "isFollowedBy": false, "isBlocking": false }
}
```

| Field | Type | Frontend reads it | Path used | Correct |
|-------|------|------------------|-----------|---------|
| `id` | UUID | yes | `user.id` | yes |
| `username` | string | yes | `user.username` | yes |
| `displayName` | string | yes | `user.displayName` | yes |
| `bio` | string, nullable | yes | `user.bio` | yes |
| `avatarUrl` | string, nullable | yes | `user.avatarUrl` | yes |
| `isPrivate` | boolean | no | - | - |
| `followerCount` | Integer, **nullable** | yes | **was** `\|\| 0` | **no, fixed** |
| `followingCount` | Integer, **nullable** | yes | **was** `\|\| 0` | **no, fixed** |
| `postCount` | Integer, **nullable** | yes | **was** `\|\| 0` | **no, fixed** |
| `viewerState` | object | no on this screen | - | see deferred findings |
| `websiteUrl` / `isVerified` / `createdAt` | - | no | - | - |

The three counts are `Integer`, not `int`, and come back null for an anonymous caller or a non-follower of a private account.

`|| 0` rendered a hidden count as `0`, which is a defined value but a false one: it stated the account has zero posts and zero followers rather than that the numbers are not visible.
They now render an en dash.

The dead alternates `user.postsCount` and `user.followersCount` in the same expression exist on no response type and were removed.

---

## `UserProfileResponse`

`GET /users/me`, the caller's own profile.

```json
{
  "id": "19e3d49b-...", "username": "luvax_ava", "email": "luvax_ava@example.com",
  "displayName": "Luvax Ava", "bio": null, "avatarUrl": null, "websiteUrl": null,
  "isPrivate": false, "isVerified": false,
  "followerCount": 2, "followingCount": 2, "postCount": 1,
  "createdAt": "2026-08-06T16:34:09.330787Z"
}
```

Here the three counts are primitive `int` and never null, and there is no `viewerState`.

This is the section 4.3 shared-component case: `ProfileScreen` renders both this type and `PublicUserProfileResponse`.
`formatCount` handles both, passing a real number through unchanged and rendering the nullable case as an en dash.

No other mismatch.

---

## `HashtagResponse`

`{ id, name, postCount, createdAt }`.

The frontend never requests it.
Both the explore topic chips and the right rail trending list are hard-coded string arrays.
This is a feature gap, not a shape mismatch, and is recorded in `deferred-findings.md`.

---

## `MediaUploadUrlResponse`

Observed on `POST /media/upload`:

```json
{ "storageKey": "users/19e3d49b-.../media/cd5a9b43-....jpg", "uploadUrl": "https://...r2.cloudflarestorage.com/...", "method": "...", "requiredHeaders": { }, "expiresAt": "..." }
```

| Field | Frontend reads it | Path used | Correct |
|-------|------------------|-----------|---------|
| `uploadUrl` | yes | destructured from the payload | yes |
| `storageKey` | yes | destructured from the payload | yes |
| `method` / `requiredHeaders` / `expiresAt` | no | - | - |

No mismatch.
`requiredHeaders` being ignored is noted in `deferred-findings.md`, since the server returns headers it expects on the `PUT`.

---

## `MediaAssetResponse`

`{ id, userId, storageKey, cdnUrl, mediaType, mimeType, fileSize, width, height, duration, blurhash, createdAt }`.

Consumed only to obtain the created asset id during upload.
No mismatch.

---

## Types not consumed by the frontend

Audited to confirm they are unreferenced, and left alone.

`AdminActionResponse`, `AdminActionSummaryResponse`, `ReportResponse`, `ReportSummaryResponse`, `StoryResponse`, `StoryFeedItemResponse`, `StoryMediaResponse`, `StoryViewerResponse`, `StoryViewActionResponse`, `ConversationResponse`, `ConversationSummaryResponse`, `ParticipantResponse`, `PostEditHistoryResponse`, `SavedPostResponse`, `HashtagTrendingResponse`, `UserSettingsResponse`, `LikeActionResponse`, `FollowResponse`.

`LikeActionResponse` (`{ postId, liked, likeCount }`) is the one exception worth noting: it is read, and correctly, as `result.likeCount` in the like mutation handler.

The messages and stories screens render entirely from static mock data and issue no requests, so there is no response to compare against.
