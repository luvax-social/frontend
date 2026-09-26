# Comment Contract

> Record of work done on 2026-08-10. Not maintained; it is correct as of that date and is not updated as the code moves.

Re-verified against the running server before anything was built.
Backend read at `backend/src/main/java/com/app/modules/comment/`: `CommentController`, `CommentServiceImpl`, `CommentResponse`, `CreateCommentRequest`, `EditCommentRequest`.

Server: `http://localhost:8080/api/v1`, dev profile, seeded database.
Actors: `luvax_ava` (viewer), `luvax_ben`, `luvax_dan`.

## The comment shape

Every endpoint that returns a comment returns this record.
Read from `CommentResponse` and confirmed against live responses.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `postId` | UUID | |
| `author` | `UserSummaryResponse` | `id`, `username`, `displayName`, `avatarUrl`, `isVerified`. Embedded, so no per-row profile fetch |
| `parentId` | UUID or null | null for top-level |
| `rootId` | UUID or null | top-level ancestor |
| `depth` | short | 0 for top-level, capped at 10 |
| `content` | string | |
| `likeCount` | int | trigger-maintained |
| `isLiked` | boolean | whether the viewer has liked it |
| `replyCount` | int | trigger-maintained, **direct replies only** |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | see the warning below |
| `pinned` | boolean | true only within the pinned block on page one |

Observed on a live list response:

```json
{
  "id": "c32ff09b-c189-4aeb-a586-ad7c52f3e601",
  "author": { "id": "f88345ed-...", "username": "luvax_dan", "displayName": "Luvax Dan",
              "avatarUrl": null, "isVerified": false },
  "parentId": null, "rootId": null, "depth": 0,
  "content": "an older comment everyone liked",
  "likeCount": 2, "isLiked": true, "replyCount": 0,
  "createdAt": "2026-08-09T03:39:28.349695Z",
  "updatedAt": "2026-08-09T03:39:28.464924Z",
  "pinned": true
}
```

`isLiked` is present on every comment on every surface, including replies.
Confirmed on `GET /comments/{id}/replies`:

```
reply: c2bcd689 depth=1 isLiked=False pinned=False replyCount=0
```

### `updatedAt` does not mean "edited"

It is tempting to render an "edited" marker from `updatedAt > createdAt`.
That would be wrong.

`trg_comments_updated_at` fires on any update to the row, and the like and reply counters are columns on that row.
The gap is already present on comments that have never been edited and never been liked:

```
id        | like_count | created_at              | updated_at              | differs
1123fde8  | 1          | 10:39:27.762281+07      | 10:39:28.493282+07      | t
a161e86f  | 0          | 10:39:27.826501+07      | 10:39:27.917068+07      | t
49c478a4  | 0          | 10:39:27.888198+07      | 10:39:27.957285+07      | t
```

Triggers on `comments`: `trg_comments_updated_at`, `trg_post_comment_count`, `trg_comment_reply_count`.

**No field on the response distinguishes an edited comment from an unedited one.**
Nothing was surfaced.
What it would take is set out in `design-decisions.md`.

---

## `GET /posts/{postId}/comments`

Lists top-level comments, cursor paginated.
The first page is prefixed with up to three pinned comments, chosen by like count, and those ids are excluded from the chronological remainder.

Observed on the seeded post, `limit=5`:

| Position | Content | likeCount | pinned |
|----------|---------|-----------|--------|
| 1 | an older comment everyone liked | 2 | `true` |
| 2 | a top-level comment | 1 | `true` |
| 3 | a newer comment nobody liked | 0 | `false` |

Only comments with at least one like are pinned, and the pinned pair is ordered by like count rather than by time.
The seed was built so those two orderings differ visibly, and they do: the oldest comment sorts first because it has the most likes.

## `GET /comments/{commentId}/replies`

Direct replies, cursor paginated.
`pinned` is always false here.

---

## `POST /comments/{commentId}/like`

Returns `200` with `ApiResponse<Void>`.
**There is no counter in the response**, which is the constraint that drives the count strategy.

| Case | Status | Code |
|------|--------|------|
| Fresh like | 200 | `OK` |
| Liking your own comment | **403** | `COMMENT_FORBIDDEN` |
| Already liked | **409** | `COMMENT_ALREADY_LIKED` |
| Unknown comment | **404** | `COMMENT_NOT_FOUND` |

```
$ curl -X POST -H "Bearer <ava>" .../comments/1123fde8-.../like     # ava's own comment
403 {"code":"COMMENT_FORBIDDEN","message":"You do not have permission to perform this action on the comment"}

$ curl -X POST -H "Bearer <ben>" .../comments/c32ff09b-.../like     # already liked
409 {"code":"COMMENT_ALREADY_LIKED","message":"Comment already liked"}

$ curl -X POST -H "Bearer <ben>" .../comments/00000000-0000-0000-0000-000000000000/like
404 {"code":"COMMENT_NOT_FOUND","message":"Comment not found"}
```

The self-like rejection is in `CommentServiceImpl.likeComment`:

```java
if (comment.getUserId().equals(actorId)) {
    throw new AppException(ApiErrorCode.COMMENT_FORBIDDEN);
}
```

The count does move, it is simply not returned.
Liking and then re-reading the list:

```
before: likeCount=1 isLiked=False
POST /like -> 200
after:  likeCount=2 isLiked=True
```

## `DELETE /comments/{commentId}/like`

| Case | Status | Code |
|------|--------|------|
| Removing your like | 200 | `OK` |
| Not currently liked | **409** | `COMMENT_NOT_LIKED` |
| Unknown comment | 404 | `COMMENT_NOT_FOUND` |

There is no self-restriction on unlike, which is consistent: you can never have liked your own comment in the first place.

---

## `PATCH /comments/{commentId}`

Body `{"content": "..."}`.
Returns `200` with the full updated comment.

| Case | Status | Code |
|------|--------|------|
| Owner edits | 200 | `OK` |
| Non-owner edits | **403** | `COMMENT_FORBIDDEN` |
| Blank content | **400** | `VALIDATION_ERROR` |
| Over 2200 characters | **400** | `VALIDATION_ERROR` |

`EditCommentRequest` declares `@NotBlank @Size(max = 2200) String content`.
The client mirrors exactly those two rules and invents nothing.

```
$ curl -X PATCH -H "Bearer <ben>" -d '{"content":"hijacked"}' .../comments/<ava's comment>
403 {"code":"COMMENT_FORBIDDEN"}

$ curl -X PATCH -H "Bearer <ava>" -d '{"content":""}' .../comments/<ava's comment>
400 {"code":"VALIDATION_ERROR","message":"Request validation failed","data":{"content":"must not be blank"}}

$ curl -X PATCH -H "Bearer <ava>" -d '{"content":"<2201 chars>"}' .../comments/<ava's comment>
400 {"code":"VALIDATION_ERROR","data":{"content":"size must be between 0 and 2200"}}
```

Successful edit, observed:

```
content   = 'edited by contract check'
createdAt = 2026-08-09T08:06:33.62437Z
updatedAt = 2026-08-09T08:06:34.083429Z
replyCount= 0   pinned= False   isLiked= False
```

Note `pinned: False` on that response even for a comment that is pinned in the list.
The DTO says so explicitly: pinned is "always false elsewhere, including on single-comment responses".
This is why the edit result is merged field by field into the cached row rather than spread over it.

The service also normalises the content and runs it past a moderation check, which can answer `COMMENT_MODERATION_REJECTED`.
That path was not triggered by ordinary text and is handled generically by the error display.

---

## `DELETE /comments/{commentId}`

Returns `200` with `ApiResponse<Void>`.
Owner or admin only.

| Case | Status | Code |
|------|--------|------|
| Owner deletes | 200 | `OK` |
| Non-owner deletes | **403** | `COMMENT_FORBIDDEN` |

### The cascade is deeper than `replyCount` suggests

`commentRepository.softDeleteSubtree(commentId, now)` marks the entire descendant tree.

Observed on a two-node tree:

```
post.commentCount before = 16
parent 170c27c8 replyCount = 1
DELETE -> 200
post.commentCount after  = 14        (parent + its reply)

id        | depth | deleted
170c27c8  | 0     | t
c2bcd689  | 1     | t
```

Observed again on the seeded chain, which is where it matters:

```
post.commentCount before = 14
deleted the root of the seeded reply chain, whose replyCount is 1
post.commentCount after  = 3
```

Eleven comments went, not two.
`replyCount` counts **direct** replies only, so the client knows a comment has replies but cannot know how many descendants exist in total.
The confirmation wording is built around that limit and is discussed in `design-decisions.md`.

The post's `commentCount` is maintained by `trg_post_comment_count` and drops by the size of the whole subtree, so the post has to be refetched after a delete.

---

## `POST /posts/{postId}/comments`

Body `{postId, parentId, content}`, returns `201` with the created comment.
`CreateCommentRequest` declares the same `@NotBlank @Size(max = 2200)` on content.

### `Idempotency-Key` is honoured

The header is declared on the controller:

```java
@RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey
```

Optional, and any string is accepted.
Observed:

```
POST with Idempotency-Key: phase5-test-key-0001  -> id 170c27c8-a236-488e-8fd2-eff5ce6dd5e3
POST with the same key, same body               -> id 170c27c8-a236-488e-8fd2-eff5ce6dd5e3   (replay, same comment)
POST with Idempotency-Key: phase5-test-key-0002  -> id c60470a1-0666-4b53-91db-9988a0073602   (new comment)
```

A replay returns the original comment rather than creating a second one, and a different key creates a genuinely new comment even when the body is identical.
