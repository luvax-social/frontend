# Backend Capability Verification

> Record of work done on 2026-08-12. Not maintained; it is correct as of that date and is not updated as the code moves.

Every claim in the backend's delivery report, checked against the running server before any frontend code was written.

This document was written and committed first, ahead of the feature commits, because the previous phase skipped that step and built on an assumption that turned out to be false.

## How this was verified

Both applications were running with seed data loaded.

| Component | Where | State |
|-----------|-------|-------|
| Backend | `http://localhost:8080` | running, dev profile |
| Frontend | `http://localhost:5173` | running |
| PostgreSQL, Redis, RabbitMQ, Elasticsearch | docker compose | running |
| Mailpit | `http://localhost:8025` | running, container `backend-mailpit-1` |

Sessions were obtained through `POST /api/v1/auth/login` for the seeded accounts.

| Account | Id | Used as |
|---------|-----|---------|
| `luvax_ava` | `556c0a7a-5b64-46e6-bc49-bd062307867f` | the viewer |
| `luvax_ben` | `f70f7348-2a43-470e-a60d-c037cd4e6748` | the other party |
| `luvax_dan` | `e95da1cb-f900-4bd5-b2cb-cf9677014149` | third party for like counts |

The post used throughout is `4600d442-2d3d-4069-8368-7f282ad6f1bc`, Ben's post carrying the seeded comment tree.

Every field quoted below appears in a response actually observed.

## Summary

| Item | Claim | Verdict |
|------|-------|---------|
| 6.1 | Viewer's prior report is knowable | Exists, on all three, with a shape asymmetry |
| 6.2 | Liking your own comment is permitted | Exists |
| 6.3 | Comments carry an explicit edit signal | Exists, including on the broadcast |
| 6.4 | Deletion scope is available | Exists, both surfaces |
| 6.5 | Password rules enforced on the server | Exists, six rules, not the four described |
| 6.6 | Comment sorting is available | Exists, and pinned duplication is fixed |
| 6.7 | Media registration has new failure cases | Exists |
| 6.8 | Post like events are broadcast | Exists |
| 6.9 | Local email verification works | Exists |
| 6.10 | Profile tabs | Investigation, see below |

Nothing in the backend's report was found to be absent from the running server.

Two claims were found to be understated, and both matter to the frontend.

## 6.1 The viewer's prior report is knowable

**Exists.** On all three item types, but not under one shape.

| Item type | Surface | Field path |
|-----------|---------|-----------|
| Post | `GET /posts/feed`, `GET /posts/{id}`, `GET /posts/user/{id}` | `hasReported`, top level |
| Comment | `GET /posts/{postId}/comments` | `hasReported`, top level |
| User | `GET /users/{userId}` | `viewerState.hasReported`, nested |

The user shape differs from the other two.

A client that reads `user.hasReported` by analogy with the post and comment shape reads `undefined` and silently treats a reported account as unreported.

Observed, post, as Ava:

```
GET /api/v1/posts/feed?page=0&size=3
{"id":"8a1ec69f-46c5-45c9-9aee-f6ac92d18ebe","author":{"username":"luvax_dan",...},
 "likeCount":0,"isLiked":false,"isSaved":false,"hasReported":true,...}
```

`hasReported` is `true` on Dan's post, which is the post the seed script reports for spam.

Observed, comment, as Ava:

```
GET /api/v1/posts/4600d442-.../comments
 17dc9377 author=luvax_dan  hasReported=true
 be32aa50 author=luvax_ava  hasReported=false
```

Observed, user, as Ava viewing Ben:

```
GET /api/v1/users/f70f7348-2a43-470e-a60d-c037cd4e6748
"viewerState":{"isFollowing":true,"isFollowRequested":false,"isFollowedBy":true,
               "isBlocking":false,"hasReported":true}
```

### Behaviour on the viewer's own content

`false`, on every type, rather than absent or an error.

```
GET /api/v1/users/556c0a7a-...  (Ava viewing herself)
"viewerState":{...,"hasReported":false}

GET /api/v1/posts/user/556c0a7a-...  (Ava's own post)
 eb18cfec hasReported=false
```

Ava's own comment `be32aa50` likewise reports `false`.

So the field does not double as a "can be reported" signal.

Own content reports `false` while still not being reportable, and the frontend already suppresses the report control on own content separately.

### Behaviour for an unauthenticated caller

Split by resource, because the two resources differ in whether they permit anonymous reads at all.

```
GET /api/v1/users/f70f7348-...   (no Authorization header)
200 OK
"viewerState":{"isFollowing":false,"isFollowRequested":false,"isFollowedBy":false,
               "isBlocking":false,"hasReported":false}

GET /api/v1/posts/4600d442-...   (no Authorization header)
401 UNAUTHORIZED  "Authentication is required"
```

The user endpoint answers anonymously and defaults every viewer-state flag to `false`, which is safe.

The post endpoint refuses anonymous callers, so the question does not arise there.

Anonymous browsing is out of scope for this phase and this changes nothing about that.

### What this makes wrong

`ReportModal.jsx` and the overflow menus offer "Report" identically whether or not the viewer has already reported the item.

The only way a user learns they already reported something is to open the modal, choose a reason, submit, and receive the duplicate error handled in `useReports.js:35`.

The information needed to say so up front was already on the item being rendered.

### Documents now stale

- `docs/reporting/report-contract.md` and `docs/reporting/design-decisions.md` record that a client cannot know whether the viewer has already reported a target, and that the duplicate error is therefore the only available signal. That premise is false and was false when written.

## 6.2 Liking your own comment is permitted

**Exists.**

```
POST /api/v1/comments/{ownCommentId}/like     (as the comment's author)
200 OK
likeCount 0 -> 1, isLiked false -> true
```

The comment was created by Ava and liked by Ava in the same session.

This previously returned `403 COMMENT_FORBIDDEN`.

### What this makes wrong

`PostDetailScreen.jsx:126-128` removes the like item from the overflow menu when `isOwn`.

`PostDetailScreen.jsx:64-69` guards `handleLikeToggle` with an early return for `isOwn`, and the comment above it states the backend rejects the like.

Both are now wrong, and the comment states something untrue about the server.

### Documents now stale

- `docs/reconnaissance/local-environment-runbook.md` lists `403 COMMENT_FORBIDDEN` when liking a comment as an error to expect, with "like it as a different account" as the resolution.
- `docs/reconnaissance/seed-data.md` records that `POST /comments/{id}/like` returns 403 when the actor is the author.
- `docs/comment-interactions/design-decisions.md` records the removal of the control as deliberate.

## 6.3 Comments carry an explicit edit signal

**Exists.** Field name `editedAt`, a nullable timestamp.

It is set only by a content change, and `updatedAt` is confirmed useless for the purpose.

Observed on the same comment across three states:

| State | `editedAt` | `updatedAt` |
|-------|-----------|-------------|
| Just created | `null` | `2026-08-12T05:45:01.9...` |
| After a like, no edit | `null` | `2026-08-12T05:45:01.950879Z` |
| After a content edit | `2026-08-12T05:45:02.013078Z` | `2026-08-12T05:45:02.018394Z` |

The like moved `updatedAt` and left `editedAt` null, which is precisely why the previous phase could not use `updatedAt`.

The seeded comment `17dc9377` shows the same thing at rest: `createdAt` `04:59:54.943262Z`, `updatedAt` `04:59:55.048147Z`, `editedAt` `null`.

### On the live broadcast

**Present, but nested.**

Subscribed to `/topic/comments.{postId}.events` and edited a comment.

```
eventType: comment.edited.v1
data.comment.content  = "[ws-probe] edited body"
data.comment.editedAt = "2026-08-12T05:50:25.397151Z"
```

The field is at `data.comment.editedAt`, not `data.editedAt`.

A first probe that looked at `data.editedAt` reported the field absent, which was a probe error rather than a backend gap.

Recorded here because the realtime phase will consume this payload and the nesting is easy to get wrong.

### What this makes wrong

Nothing renders an edited marker today.

An edited comment is indistinguishable from an unedited one.

### Documents now stale

- `docs/comment-interactions/design-decisions.md` records that no edit signal exists and that no marker is therefore rendered. The first half is now false.

## 6.4 Deletion scope is available

**Exists.** Both surfaces, and they diverge exactly as described.

| Surface | Method and path | Response |
|---------|----------------|----------|
| Estimate | `GET /api/v1/comments/{commentId}/deletion-scope` | `{"deletedCommentCount": n}` |
| Authoritative | `DELETE /api/v1/comments/{commentId}` | `{"deletedCommentCount": n}` |

Both return the same schema, `CommentDeletionScopeResponse`.

The schema documents the count as the target plus every descendant at any depth, excluding already soft-deleted descendants, and explicitly warns it is not `replyCount`.

The divergence was reproduced deliberately.

```
create comment, add 2 descendants
GET  /comments/{id}/deletion-scope   -> {"deletedCommentCount": 3}
add 1 further reply
DELETE /comments/{id}                -> {"deletedCommentCount": 4}
```

The estimate said 3, a reply arrived, and the delete removed 4.

### Authorization

The estimate is owner-only, and refuses others as a not-found rather than a forbidden.

```
GET /api/v1/comments/{avaComment}/deletion-scope   (as Ben)
404  COMMENT_NOT_FOUND  "Comment not found"
```

This matters for the frontend fallback: a non-owner never sees the dialogue, so a 404 here means something unexpected and should fall back to the unnumbered wording rather than surfacing an error.

### What this makes wrong

`PostDetailScreen.jsx:319` states "deleting this comment also deletes its N replies and any replies to those", where N is `comment.replyCount`.

`replyCount` counts direct replies only.

For the seeded depth-10 thread the dialogue says "1 reply" where the true scope is the whole subtree, so the current wording understates the consequence rather than merely being vague.

## 6.5 Password rules are enforced on the server

**Exists, and there are six rules rather than the four described.**

Each rule was probed independently through `POST /api/v1/auth/register`, with everything else held valid.

| Probe | Status | `errors.password` |
|-------|--------|-------------------|
| 7 characters | 400 | Password must be at least 8 characters long |
| 8 characters | 201 | accepted |
| 64 characters | 201 | accepted |
| 65 characters | 400 | Password must be at most 64 characters long |
| no uppercase | 400 | Password must contain at least one uppercase letter |
| no digit and no special | 400 | Password must contain at least one digit or one special character |
| digit only, no special | 201 | accepted |
| special only, no digit | 201 | accepted |
| internal space | 400 | Password must not contain whitespace or invisible characters |
| trailing space | 400 | Password must not contain whitespace or invisible characters |
| tab | 400 | Password must not contain whitespace or invisible characters |
| zero width space U+200B | 400 | Password must not contain whitespace or invisible characters |
| 64 characters, 125 bytes UTF-8 | 400 | Password must be at most 72 bytes long when encoded as UTF-8 |

The two rules the delivery report did not mention:

- a 72 byte cap on the UTF-8 encoding, which is reachable within the 64 character limit using non-ASCII characters
- invisible characters, rejected by the same rule as whitespace, demonstrated with U+200B

The digit-or-special rule is genuinely a disjunction, confirmed in both directions.

### Error envelope

Field-level, as claimed.

```
400
{"success":false,"code":"VALIDATION_ERROR","message":"Request validation failed",
 "errors":{"password":"Password must contain at least one uppercase letter"}}
```

The specific failing rule is named in `errors.password`.

### What this makes wrong

The registration form enforces a looser policy than the server, so a password the form accepts can still be rejected on submit.

A rejection currently surfaces the generic envelope `message` rather than the specific `errors.password` text, so the user is told validation failed without being told which rule.

## 6.6 Comment sorting is available

**Exists.** Verification only, no control built, as instructed.

Parameter `sort` on `GET /api/v1/posts/{postId}/comments`.

```
"sort": {"type":"string","default":"top","enum":["top","newest"]}
```

The endpoint paginates by `cursor` and `limit`, not `page` and `size`.

| Value | Behaviour |
|-------|-----------|
| omitted | identical to `top`, verified by comparing the returned id sequences |
| `top` | pinned block of liked top-level comments first, then the body |
| `newest` | pure reverse chronology, `pinned` false on every row |
| anything else | `400 BAD_REQUEST`, "Unknown sort value; accepted values are 'top' and 'newest'" |

Omitting the parameter reproduces today's behaviour exactly.

One behaviour worth recording for whoever builds the control: under `sort=top` the pinned block is returned **in addition to** `limit`, so a first page with `limit=3` returned six rows, three pinned and three body.

Under `newest` the same request returned three.

### Pinned duplication

**Fixed.**

Tested by creating six top-level comments, liking three of them so the pinned block was populated, then paging with `limit=3` to the end.

```
sort=top     page1 6 rows, page2 2 rows, total 8, unique 8, duplicates none
sort=newest  page1 3 rows, page2 3 rows, page3 2 rows, total 8, unique 8, duplicates none
```

No comment appeared in both the pinned block and the body, in either sort.

The probe comments were deleted afterwards.

### Frontend workaround

**None exists**, so there is nothing to remove.

The only `pinned` handling in the frontend is in `usePosts.js:220` and `usePosts.js:261-263`, which preserve the pinned marker across cache updates because the single-comment response reports `pinned` as false.

That is unrelated to the duplication defect and is still needed.

### An unrelated observation

The seeded zero-like comment "a newer comment nobody liked" no longer appears in either sort.

It is soft-deleted in the database, from earlier phase testing, so its absence is correct behaviour rather than a sorting defect.

## 6.7 Media registration has new failure cases

**Exists.**

Declared on `POST /api/v1/media/upload-complete`:

| Status | Code | Meaning |
|--------|------|---------|
| 422 | `MEDIA_OBJECT_NOT_UPLOADED` | no object under the storage key |
| 422 | `MEDIA_OBJECT_METADATA_MISMATCH` | object size or content type differs from the metadata |
| 503 | `MEDIA_STORAGE_UNAVAILABLE` | object storage could not be reached to verify |
| 503 | `MEDIA_CDN_NOT_CONFIGURED` | CDN configuration missing |
| 409 | `MEDIA_STORAGE_KEY_ALREADY_EXISTS` | pre-existing, unchanged |

The first was exercised live, since it needs no upload.

```
POST /api/v1/media/upload
200  storageKey users/556c0a7a-.../media/05bf95f9-....jpg
     method PUT
     requiredHeaders {"content-type":"image/jpeg","content-length":"12345"}

POST /api/v1/media/upload-complete   (same storageKey, no bytes ever uploaded)
422  MEDIA_OBJECT_NOT_UPLOADED  "No uploaded object exists for this storage key"
```

The pre-signed URL points at a real Cloudflare R2 bucket, not a local emulator.

### What this makes wrong

The registration call that previously always succeeded can now fail for a reason the user can act on.

An upload that failed part way now leaves a registration that is rejected rather than a broken asset row, and the composer must offer a retry rather than treating it as fatal.

### Documents now stale

- `docs/reconnaissance/seed-data.md` records that `POST /media/upload-complete` performs no server-side object inspection, and that an asset row and `cdnUrl` are returned for an object that was never transferred. That is no longer true, and the seed script depends on the old behaviour.

## 6.8 Post like events are broadcast

**Exists.** Verification only, no realtime client built, as instructed.

Recorded so the realtime phase can build against observed facts.

| Property | Value |
|----------|-------|
| Topic | `/topic/posts.{postId}.events` |
| Endpoint | `/ws/posts`, SockJS, and `/ws/comments` serves the same destination |
| Authentication | JWT as the `token` query parameter on the handshake |
| Event types | `post.live.liked.v1`, `post.live.unliked.v1` |
| Payload | `{"eventType": "...", "data": {"postId": "...", "likeCount": n}}` |
| Count semantics | absolute, not a delta |

Observed frames, subscribed as Ava, triggered by Ben liking then unliking:

```
{"data":{"likeCount":3,"postId":"4600d442-..."},"eventType":"post.live.liked.v1"}
{"data":{"likeCount":2,"postId":"4600d442-..."},"eventType":"post.live.unliked.v1"}
```

Subscription requirements, from `PostWebSocketAuthInterceptor`:

- the destination must match `/topic/posts.{uuid}.events` exactly, and a prefix that does not match the full pattern is rejected
- the post must be visible to the subscriber, and a missing post and a blocked post produce an identical error so the two cannot be distinguished
- because STOMP destinations are broker-wide, a client already connected to `/ws/comments` can subscribe here without opening a second connection

Outbound frames are filtered per session for blocks, so a blocked viewer does not receive the event.

## 6.9 Local email verification works

**Exists.**

The mail transport is now Mailpit in docker compose, container `backend-mailpit-1`, SMTP on 1025 and the web interface on 8025.

The previous blocker was Resend rejecting `example.com` destinations, which meant no verification link was ever delivered.

Mailpit accepts every address, so the seeded domain now works.

Observed, from registrations made during the password probing above:

```
GET http://localhost:8025/api/v1/messages
noreply@luvax.online -> pwt_97e033184f@example.com   "Verify your email address"
noreply@luvax.online -> pwt_97e033184f@example.com   "Welcome to Social"
```

Both mails are delivered per registration, and the verification link points at the frontend:

```
http://localhost:5173/verify-email?token=tt6VJqzhcV0xrl1lSA530rTJuMJMoODkP6BrAgIalWQ
```

That route already exists in the frontend and is handled by `EmailVerificationPage.jsx`.

The end to end browser walk is recorded in `verification-evidence.md`.

### Documents now stale

- `docs/reconnaissance/local-environment-runbook.md` documents a manual `UPDATE user_credentials` statement as the only way to reach a usable session, and states the mail provider rejects `example.com`. Both are now false. This runbook is corrected by this phase, because a runbook describes how to do something rather than recording what was once true.
- `docs/reconnaissance/seed-data.md` records the same blocker as the one hard blocker of the seed script.

## 6.10 Profile tabs

Investigation only, no change made.

The frontend renders **three** tabs, hardcoded:

```jsx
// ProfileScreen.jsx:212
{['posts', 'photos', 'liked'].map(t => (
```

The `tab` state is declared at `ProfileScreen.jsx:21` and consumed only for the active styling at lines 215 and 218.

It never reaches a query or the grid.

The grid at line 230 renders `posts` unconditionally, whatever tab is selected.

So `photos` and `liked` are decorative: selecting one moves the underline and changes nothing else.

Neither is backed by an endpoint, and no endpoint for either is called anywhere in the frontend.

Full detail and the document conflict are in `profile-tabs-finding.md`.

## Verification method notes

The pre-existing staged `Makefile` in the backend repository was present before this phase began and was not created by it.

The backend working tree baseline is recorded in `README.md`.

Probe data created during verification was cleaned up where it was not needed as evidence.

Registrations made by the password probing remain, as unverified accounts named `pwt_*`, and are harmless on a local database.
