# Deferred Findings

> Record of work done on 2026-08-12. Not maintained; it is correct as of that date and is not updated as the code moves.

Everything found during this phase and deliberately not acted on, with where it belongs.

## Recorded for the realtime phase

### The post like topic is verified and unbuilt

Verification only, as instructed. No client was written.

| Property | Verified value |
|----------|---------------|
| Topic | `/topic/posts.{postId}.events` |
| Endpoint | `/ws/posts`, SockJS; `/ws/comments` serves the same destination |
| Authentication | access token as the `token` query parameter on the handshake |
| Event types | `post.live.liked.v1`, `post.live.unliked.v1` |
| Payload | `{"eventType": "...", "data": {"postId": "...", "likeCount": n}}` |
| Count | absolute, not a delta |

Subscription is refused unless the destination matches `/topic/posts.{uuid}.events` exactly and the post is visible to the subscriber. A missing post and a blocked post are indistinguishable by design.

Full observed frames in `backend-capability-verification.md`, section 6.8.

### The comment broadcast nests the comment payload

`editedAt` on the live comment stream is at `data.comment.editedAt`, not `data.editedAt`.

Worth carrying forward because a first probe of this phase looked at the wrong level and briefly concluded the field was absent.

### Post like state still lives in component state

Already recorded before this phase and unchanged. `PostCard` holds `liked` and `likeCount` in `useState`, so the same post in two places can disagree.

This matters more once the realtime tier lands, since an event would have to reach component state rather than the query cache.

## Recorded for whoever decides on comment sorting

The `sort` parameter exists and works. No control was built, as instructed.

Values are `top`, the default, and `newest`. Omitting the parameter reproduces today's behaviour exactly. An unknown value returns 400 with a message naming the accepted values.

One behaviour to design around: under `sort=top` the pinned block is returned **in addition to** `limit`, so a first page with `limit=3` returns six rows. Under `newest` the same request returns three.

The pinned duplication defect is genuinely fixed, verified by paging to the end in both sorts with no comment appearing twice. The frontend never contained a workaround for it, so nothing was removed.

## Recorded for the profile decision

Covered in full in `profile-tabs-finding.md`.

The screen renders three tabs, two of them decorative and backed by nothing, contradicting two reconnaissance documents that record only one tab as present.

## Media

### The other rejection codes are verified by contract, not by observation

`MEDIA_OBJECT_NOT_UPLOADED` was exercised in the browser and its copy confirmed.

`MEDIA_OBJECT_METADATA_MISMATCH` needs an object whose stored size disagrees with the submitted metadata, and the 503 cases need object storage to be unreachable. Neither is reachable from the browser without either corrupting a real upload or taking storage down.

All of them share one mapping in one switch, and the branch that was exercised proves the mapping reaches the composer. The rest is reasoned from the contract rather than observed.

### Pre-existing broken asset rows are not repaired

As stated in the brief, records created before the server started verifying uploads are not repaired by it.

The seed script's media asset points at an object that was never transferred, so it still 404s. No repair path was built.

Note that the seed script itself now depends on behaviour that no longer exists: it registers an asset without uploading bytes, which the server now refuses with 422. The script will fail at that step on a fresh environment. Left alone because the script is out of this phase's scope, and recorded in the seed documentation.

### The upload ignores the server's `requiredHeaders`

`POST /media/upload` returns `requiredHeaders`, currently `content-type` and `content-length`.

`useMediaUpload` hardcodes `Content-Type` and lets the browser set the length, which happens to match. If the server ever adds a required header, the upload breaks with no signal on the client.

Not changed: it works today, and this phase is adjusting failure presentation rather than rewriting the flow.

## Auth

### The reset-password screens now enforce the policy, and were not exercised in a browser

The password rules live in the shared field, so the two reset schemas tightened along with registration. `POST /auth/reset-password` was verified to enforce the same policy at the API.

The reset screens themselves were not walked through a browser, because that was not in this phase's scope. Now that Mailpit works, a reset link can be followed end to end, so this is cheap to do whenever those screens are next touched.

### `errors` is only mapped on registration

`applyServerFieldErrors` is wired into the registration submit only.

The same envelope shape is returned for any rejected auth request, so the reset and forgot-password forms still show the generic message where a field-level one exists.

### The shared error normalizer does not understand the object form

`axiosClient` reads `data.errors?.[0]?.message`, which expects an array. The backend returns `errors` as an object keyed by field name.

That path therefore never contributes anything. It is harmless today because `data.message` is always present, but it is dead code that looks live.

## Already recorded before this phase, unchanged

Listed so this phase's report is not read as discovering them.

- Escape-key dismissal for modals is missing application-wide.
- The global query error handler logs expected outcomes as errors. It logged the two failures this phase provoked deliberately.
- Messages and stories render mock data.
- Anonymous browsing of posts and comments is unsupported, and the product does not require it.

## Process note

The reporting phase built on the premise that a client cannot know whether a viewer has already reported something, when `hasReported` had already shipped on all three item types.

The check that produced that conclusion asked whether a regular user can list their own reports, which is a different question from whether the item carries the viewer's state.

The lesson worth keeping: verify at the surface the client actually consumes. In this phase the same trap appeared again in miniature, when a probe looked for `editedAt` at `data.editedAt` on the live payload and found nothing, while the field was one level down at `data.comment.editedAt`.
