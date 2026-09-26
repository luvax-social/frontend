# Endpoint Verification

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

Every contract below was checked against the running backend on 2026-08-13, not inferred from a summary.

Backend commit: `42f6147`.
Authenticated as `luvax_ava`.

## 1. The `type` parameter on `GET /posts/user/{userId}`

### Accepted values

Probed one value at a time rather than assuming the set from the response enum.

| Sent | Result |
|------|--------|
| `type=image` | 200 |
| `type=IMAGE` | 200, so matching is case insensitive |
| `type=text` | 200 |
| `type=video` | 200 |
| `type=carousel` | 200 |
| `type=photo` | 400 |
| `type=reel` | 400 |

The accepted set is `image`, `video`, `carousel`, `text`.
`photo` is not a post type, which matters because it is the word the tab uses.

### Multi-valued forms

| Form | Result |
|------|--------|
| `?type=image,carousel` | 200 |
| `?type=image&type=carousel` | 200 |
| `?type[]=image` | **400** |

The bracket form is the one axios produces by default for an array.

```
GET /api/v1/posts/user/{id}?type%5B%5D=image
400
{"code":"BAD_REQUEST",
 "message":"Unsupported query parameter: type[]. Accepted: cursor, limit, type"}
```

This is why `getUserPosts` joins the values itself instead of handing an array to axios.
Passing an array straight through would have failed on every request.

### The filter genuinely filters

Against an author holding 502 image, 1 video, 1 carousel and 4506 text posts:

| Request | Rows returned |
|---------|--------------|
| no filter, limit 30 | `{text: 24, image: 4, carousel: 1, video: 1}` |
| `type=image,carousel`, limit 30 | `{image: 29, carousel: 1}` |
| `type=video`, limit 30 | `{video: 1}` |

### Cursor binding

A cursor taken from `type=image` and replayed:

| Replayed under | Result |
|----------------|--------|
| `type=image`, the same filter | 200 |
| no filter at all | **400 INVALID_CURSOR** |
| `type=image&type=carousel`, a superset | **400 INVALID_CURSOR** |
| `type=video`, a different filter | **400 INVALID_CURSOR** |

A cursor taken from `type=image&type=carousel` and replayed:

| Replayed under | Result |
|----------------|--------|
| `type=image&type=carousel` | 200 |
| `type=carousel&type=image`, reordered | 200 |
| `type=image,carousel`, comma form | 200 |

Reordering the same set is safe, as the backend stated.

The reason is visible in the cursor itself, which is base64 and carries the filter in its prefix:

```
cursor from type=image            -> pst.image:1786548813387523:322f369c-...
cursor from type=image,carousel   -> pst.image.carousel:1786548813387523:322f369c-...
```

The filter key is normalised, which is what makes reordering safe and a superset unsafe.

### A caveat worth recording

`type` filters on the post's declared type, not on whether the post actually carries media.

In the current database, 150,003 posts are typed `image`, `video` or `carousel` while only 4 posts have a media asset attached:

| post_type | image only | mixed | video only | no media at all |
|-----------|-----------|-------|-----------|-----------------|
| image | 2 | 0 | 0 | 50,500 |
| video | 0 | 0 | 1 | 50,000 |
| carousel | 1 | 0 | 0 | 50,000 |
| text | 0 | 0 | 0 | 54,518 |

So a post typed `image` with no media will appear in the photos tab and render as a caption tile.
That is the data being inconsistent rather than the filter being wrong, and the client cannot correct it without filtering client-side, which would break pagination.
Recorded rather than worked around.

## 2. `GET /posts/liked`

Declared query parameters: `cursor`, `limit`.
There is no path parameter for another user, confirming the list is always the caller's own.

### Shape

```
GET /api/v1/posts/liked?limit=2
200

envelope : success, code, message, data, timestamp
page     : content, pageInfo, degraded
row      : post, likedAt
row.post : id, author, caption, postType, status, likeCount, commentCount,
           saveCount, isLiked, isSaved, hasReported, viewCount, locationName,
           latitude, longitude, media, createdAt, updatedAt
```

### It does not mirror saved exactly

Checked rather than assumed, and the assumption would have been wrong:

| | liked | saved |
|---|---|---|
| page keys | `content`, `pageInfo`, `degraded` | `content`, `pageInfo`, `degraded` |
| post nested under | `post` | `post` |
| timestamp field | `likedAt` | `savedAt` |

The nesting matches. The timestamp field name does not.

### pageInfo

```json
{"hasNextPage": false, "hasPreviousPage": false,
 "startCursor": "...", "endCursor": "..."}
```

The next cursor is `endCursor`, not `nextCursor`.
Reading `nextCursor` yields undefined and silently ends pagination after one page.

## 3. The incompleteness flag

The flag is named `degraded`.

It sits on the page, beside `content` and `pageInfo`.
It is **not** inside `pageInfo`.

### Behaviour with the search backend up and then down

Elasticsearch was stopped and restarted to observe this, as the previous phase did.

| Endpoint | ES up | ES down |
|----------|-------|---------|
| `GET /posts/search` | `degraded=false`, 3 rows | **`degraded=true`, 0 rows** |
| `GET /hashtags/search` | `degraded=false` | `degraded=false` |
| `GET /users/search` | `degraded=false`, 3 rows | `degraded=false`, 3 rows |
| `GET /posts/feed` | `degraded=false`, 3 rows | `degraded=false`, 3 rows |

Both backend statements hold.

Post search sets the flag and returns an empty page rather than an error, which is exactly why the two cases were previously indistinguishable.

Hashtag search does not set it, because its fallback answers from the primary database.
Its results stay complete for the query and only the ranking changes.

Elasticsearch was restarted afterwards and post search returned `degraded=false` with rows again.

## 4. Strict rejection of undeclared parameters

```
GET /api/v1/posts/user/{id}?hasMedia=true
400
{"code":"BAD_REQUEST",
 "message":"Unsupported query parameter: hasMedia. Accepted: cursor, limit, type"}

GET /api/v1/posts/user/{id}?mediaType=IMAGE  -> 400
GET /api/v1/posts/user/{id}?postType=IMAGE   -> 400
```

None of the three is sent by the frontend.
See `outbound-parameter-audit.md`.

## 5. Private accounts

`GET /users/{userId}` for a private account the viewer does not follow:

```json
{"id": "...", "username": "luvax_cleo", "displayName": "Luvax Cleo",
 "bio": null, "avatarUrl": null, "websiteUrl": null,
 "isPrivate": true, "isVerified": false,
 "followerCount": null, "followingCount": null, "postCount": null,
 "createdAt": "...",
 "viewerState": {"isFollowing": false, "isFollowRequested": true,
                 "isFollowedBy": false, "isBlocking": false,
                 "hasReported": false}}
```

The three counts are `null`, not zero.

What a non-follower may and may not read:

| Request | Result |
|---------|--------|
| `GET /users/{id}` | 200 with identity, counts null |
| `GET /posts/user/{id}` | **403 POST_FORBIDDEN** |
| `GET /social/users/{id}/followers` | **403 FORBIDDEN** |
| `GET /social/users/{id}/following` | **403 FORBIDDEN** |

The pending request is carried by `viewerState.isFollowRequested`, which is what the requested state is driven from.

### Follow request row shape

`GET /social/follow-requests` as the account being requested:

```json
{"id": "cdc21663-...", 
 "follower": {"id": "cdc21663-...", "username": "luvax_ava",
              "displayName": "Luvax Ava", "avatarUrl": null,
              "isVerified": false},
 "status": "pending", "createdAt": "...",
 "viewerState": {...}}
```

The row `id` and `follower.id` are the same value, and it is the `requesterId` the approve and reject endpoints take.

## 6. Blocking

The most important finding here contradicts the natural assumption.

| Step | Result |
|------|--------|
| `POST /social/block/{id}` | 201 |
| `GET /users/{id}` as the blocker | **404 NOT_FOUND** |
| `GET /posts/user/{id}` as the blocker | **404** |
| `GET /users/{random uuid}` | 404, the same status |

**A blocked account's profile answers 404, not a readable profile carrying `isBlocking: true`.**

So `viewerState.isBlocking` is never observable for someone the viewer has blocked, because there is no profile left to carry it.
A blocked account and a nonexistent account are indistinguishable by status code.

`GET /social/blocked` is the only readable record that tells them apart:

```json
{"user": {"id": "...", "username": "luvax_dan", "displayName": "Luvax Dan",
          "avatarUrl": null, "isVerified": false},
 "viewerState": {"isBlocking": true, ...}}
```

This is why the profile screen reads the blocked list rather than the profile's own viewer state.

### Unblock, and what it does not restore

| Step | Result |
|------|--------|
| `DELETE /social/block/{id}` | 204 |
| `GET /users/{id}` afterwards | 200, readable again |

Before the block, Ava and Dan followed each other.
After unblocking:

```json
"viewerState": {"isFollowing": false, "isFollowedBy": false, ...}
"followerCount": 0, "followingCount": 0
```

The mutual follows are gone and unblocking does not bring them back.
This confirms the wording in the block confirmation dialog, which states it plainly rather than implying the block is fully reversible.
