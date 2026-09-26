# Demo Readiness

> Record of work done on 2026-08-01. Not maintained; it is correct as of that date and is not updated as the code moves.

The scenario an engineering lead will walk through, step by step.

Verdict is one of **possible**, **partially possible**, or **impossible**.

Assessment is against the frontend at commit `102923c2194b37b6033b033c53000ab4e5da9de2` running
against the backend at `450212e996881360abf5b04becfa1ee765a72946`, with the seed data from
`tools/seed/seed.py` loaded.

## Summary

**The demo cannot start.**
Step 0, logging in through the user interface, fails with a 400.
That was found by driving a real browser rather than by reading code, and it is reproducible with
`curl`.

Discounting that one blocker, and assuming a session exists:

| Verdict | Steps |
|---------|-------|
| Possible | 8 of 21 |
| Partially possible | 6 of 21 |
| Impossible | 7 of 21 |

Every impossible step is `frontend-missing` or `contract-mismatch`.
**No step is blocked by a missing backend capability.**
That is the single most useful conclusion in this document: the read-only backend constraint costs
nothing in demo terms.

The seven impossible steps after step 0 cluster in two places: comment interaction (like, edit,
delete) and the two surfaces that were never built at all (report, search results).

## Step by step

### 0. Log in

**Verdict: impossible.**

This step was tested in a real browser, not only with `curl`, and it fails.

`POST /auth/login` works perfectly when called directly: verified `200` with a full token payload.

**Blocker: the login form sends the wrong field name.**
`src/api/authApi.js:93-103` posts `{ email, password }`.
The backend's `LoginRequest` declares `identifier` and `password`, and rejects the unknown `email`
field outright.

Reproduced in Chromium against the running application:

```
POST http://localhost:5173/api/v1/auth/login  =>  [400] Bad Request
console: Failed to load resource: the server responded with a status of 400 (Bad Request)
```

Reproduced independently with `curl`:

```
POST /api/v1/auth/login   {"email":"luvax_ava@example.com","password":"ReconPass123!"}
400 {"success":false,"code":"MALFORMED_REQUEST_BODY",
     "message":"Request body could not be read","data":null,...}
```

The mismatch runs the whole way through the frozen auth slice: the Zod schema at
`features/auth/utils/authSchemas.js:23-26` names the field `email`, `AuthPage.jsx:463-464`
registers it as `email`, and `authApi.login` posts it as `email`.
The label already reads "username or email", so only the wire field name is wrong.

**Nothing downstream of this step can be demonstrated through the user interface until it is
fixed.** Every verdict below therefore describes what would happen once a session exists, which is
what the rest of this audit measured directly against the API.

This is in a frozen area, so it is recorded and not fixed. See `defects.md`, entry D1.

Second blocker, independent of the first: **an account cannot log in until its email is verified**,
and email verification cannot be completed through the HTTP API in a local environment.
`POST /auth/login` returns `403 AUTH_EMAIL_NOT_VERIFIED` on a fresh account, and the local mail
provider rejects `example.com` addresses so no token is ever delivered.
See `seed-data.md` for the one manual SQL statement that resolves it.

### 1. View a feed of real posts

**Verdict: possible, with a setup condition.**

`GET /posts/feed` verified.
`FeedScreen` uses `useFeed` and renders live data.

**Blocker if unprepared:** the feed carries only posts by accounts the viewer follows and
**excludes the viewer's own posts**. Verified: with two posts of her own and one followed account,
the viewer's feed returned only the followed account's posts.
A freshly created demo account sees an empty feed.
The seed script establishes the follow graph that makes this step work.

### 2. Like a post

**Verdict: possible.**

`POST /posts/{id}/like` verified, returns `{postId, liked, likeCount}`.
`useLikePost` is wired and `PostCard` renders the control.

Two things to know:

- The endpoint is **not idempotent**; a second like returns `409 POST_ALREADY_LIKED`. An optimistic
  UI must treat that as success.
- Like state is per-card `useState`, so the same post rendered in two places will not agree. The
  design solved this with a shared observer store; the frontend did not.

### 3. Save a post

**Verdict: possible.**

`POST /posts/{id}/save` verified. `useSavePost` is wired.

Weakness rather than blocker: `GET /posts/saved` exists on the backend but there is **no service,
no hook, and no screen** for it. The lead can save a post and then has nowhere to see it. If the
walkthrough is expected to close that loop, it cannot.

### 4. Open post detail

**Verdict: possible.**

`GET /posts/{id}` verified, `usePostDetail` wired, `PostDetailScreen` renders live.

Divergence from design rather than a blocker: the design opens comments as a `CommentModal`
overlay over the feed through `window.LX.openComments(post)`.
The frontend navigates to a separate screen.
`CommentModal` does not exist in the frontend.

### 5. Add a comment

**Verdict: possible.**

`POST /posts/{postId}/comments` verified. `useCreateComment` is wired.

The frontend does not send the `Idempotency-Key` header the backend supports, so a double-submit
creates two comments.

### 6. Reply to a comment

**Verdict: possible.**

Verified to depth 10, the backend maximum.
`useCreateComment` accepts `parentId` and `useCommentReplies` fetches one level.

Note the thread must be walked one level at a time; there is no subtree endpoint.
Deep threads therefore cost one request per expansion.

### 7. Like a comment

**Verdict: impossible.**

Backend: `POST /comments/{commentId}/like` exists and returns 200, verified.

**Blocker: there is no frontend for it.** No entry in `postService`, no hook in `usePosts.js`, and
no control in `PostDetailScreen.jsx`. The capability is entirely absent from the client.

Two constraints to build against:

- **Liking your own comment returns `403 COMMENT_FORBIDDEN`.** Verified at runtime and confirmed in
  `CommentServiceImpl.likeComment`. Posts have no such restriction. The control must be hidden or
  disabled on the viewer's own comments.
- The like response carries no counter, unlike post likes. The client must refetch.

### 8. Edit your own comment

**Verdict: impossible.**

Backend: `PATCH /comments/{commentId}` verified 200 for the owner and `403 COMMENT_FORBIDDEN` for a
non-owner.

**Blocker: no frontend service, hook, or UI.**
The design has the affordance in `LxMenu`; the frontend has neither `LxMenu` nor the call.

### 9. Delete your own comment

**Verdict: impossible.**

Backend: `DELETE /comments/{commentId}` verified, returns 200 with a null-data envelope.

**Blocker: no frontend service, hook, or UI.**

Behaviour to design around when it is built: deleting a comment **soft-deletes its entire
subtree**. Verified in the database that deleting a depth-1 comment marked depths 1 through 4 as
deleted. There is no tombstone; the replies simply vanish. A confirmation dialogue should say so.

### 10. Report a post

**Verdict: impossible.**

Backend: `POST /reports` verified 201, with a duplicate guard returning `409 REPORT_DUPLICATE`.
Design: `ReportModal` is fully specified, three steps, and its eight reasons match the backend
`report_reason` enum exactly, ids included.

**Blocker: no frontend service, hook, or UI.**
This is the cleanest build in the whole gap list: the contract and the design already agree
perfectly. Nothing exists on the client.

### 11. Search by keyword and receive both post and user results

**Verdict: partially possible.**

Posts: `GET /posts/search` verified, stemmed matching. The frontend calls it, but only as
`getExplorePosts` feeding the Explore grid, not as a search-results surface.

Users: `GET /users/search` verified, returns `UserListItemResponse` with `viewerState` and excludes
blocked accounts in both directions. **There is no frontend service for it.**

**Blockers:**

- No user search service, hook, or UI.
- No combined search results screen. The design export contains `LxHeaderSearch` but **no results
  screen at all**.
- There is no combined backend endpoint either, so the screen must issue two requests and compose
  them.

The post half can be shown through Explore.
The user half cannot be shown at all.

### 12. Open another user's profile

**Verdict: possible.**

`GET /users/{userId}` verified. `useUserProfile` wired, `ProfileScreen` live.

One case to handle: `followerCount`, `followingCount`, and `postCount` come back **null** for an
anonymous caller and for a non-follower of a private account. The frontend does not handle null
counts.

### 13. Follow them

**Verdict: possible.**

`POST /social/follow/{id}` verified, 201 with `status: "accepted"`.
`useFollow` wired.

Against a private account the same call returns `status: "pending"` and the profile must then show
a "requested" state driven by `viewerState.isFollowRequested`.
The frontend has no such state.
Avoid a private account in the walkthrough.

### 14. View their posts

**Verdict: possible.**

`GET /posts/user/{userId}` verified. `useUserPosts` wired, rendered on the posts tab.

The design's `photos` and `liked` tabs are dropped by settled decision and the frontend already
shows only `posts`.

### 15. Block them

**Verdict: partially possible.**

Backend: `POST /social/block/{id}` verified 201. Auto-unfollows in both directions, removes the
user from the feed, from user search in both directions, returns 404 on both profiles, and 403 on
both users' posts. All verified.

Frontend: `useBlock` calls the endpoint, but:

- It wraps the call in `try/catch` and **swallows any error**, then writes to `localStorage` in
  `onSuccess` regardless. A block that failed server-side still shows as blocked.
- The authoritative record is kept in `localStorage` under `lx_blocks_{userId}` rather than read
  from `GET /social/blocked`.

The visible outcome will look right during the demo because the API call does succeed.
It is classified partial because the client's state is not derived from the server's.

### 16. Confirm their content disappears from the feed

**Verdict: possible.**

Verified directly: the blocked user's post was present in the feed before the block and absent
immediately after.
`useBlock` calls `queryClient.resetQueries` on `feed`, `explore`, and `userPosts`, so the refetch
happens.

This step will demo cleanly.

### 17. Unblock them

**Verdict: partially possible.**

Backend: `DELETE /social/block/{id}` verified 204. The blocked list empties and the profile becomes
readable again. The destroyed follow edges are **not** restored.

Frontend: `BlockedUsersScreen` exists, but it reads the list from **`localStorage`, never from
`GET /social/blocked`**.

**Blockers:**

- Unblock works only in the browser and profile that performed the block. A different browser, a
  cleared cache, or a second device shows an empty blocked list even though the server-side block is
  still in force.
- This matters more than it looks, because `GET /users/{blockedId}` returns **404 for the blocker
  too**. The blocked-users screen is the only place an unblock control can live. If that list is
  empty, the block is unreachable.

### 18. Return to your own profile

**Verdict: possible.**

`GET /users/me` verified. The bottom nav has a profile tab.

### 19. Edit your own post

**Verdict: possible.**

`PATCH /posts/{postId}` verified 200 for the owner, `403 POST_FORBIDDEN` for a non-owner.
`useUpdatePost` is wired and `PostCard.jsx` has an inline edit sheet.

Only the caption is editable; media, type, and location are fixed after creation.
Every edit appends to `GET /posts/{id}/history`, which has no frontend.

### 20. Delete your own post

**Verdict: possible.**

`DELETE /posts/{postId}` verified 204, soft delete, `403` for a non-owner.
`useDeletePost` wired, and the delete invalidates `feed` and `userPosts`.

## Cross-cutting problems that affect the whole walkthrough

### No URLs

The entire authenticated application is one route, `/app`, with the current screen held in
`useState` inside `LuvaxApp.jsx`.

- The browser back button exits the application rather than going back a screen.
- A refresh at any point returns to the feed and loses the current screen.
- Nothing is linkable. The lead cannot be sent a URL for a post or a profile.

Any accidental refresh during the demo restarts the walkthrough from step 1.

### A request that always fails

`shell.jsx` calls `useSuggestedUsers`, which targets `GET /users/suggestions`.
That endpoint does not exist; the path is matched by `GET /users/{userId}` and `"suggestions"`
fails UUID conversion, returning **400**. Verified.

The right rail is visible on feed and explore at tablet and desktop widths, so this failing request
fires on most screens in the walkthrough.
It will be visible in the network tab if anyone opens dev tools.

### Missing loading and empty states

Only `FeedScreen` has both a loading and an error state.
Most screens have neither, and the design export defines none at all.
Any step that is slow or fails shows an empty region.

### Post search failure is silent

`GET /posts/search` degrades to an empty page rather than erroring when Elasticsearch is
unavailable.
"No results" and "search is down" are indistinguishable to the client.
If the Elasticsearch container is not running, search silently returns nothing.

## What to fix first, ordered by demo value

Stated as observations, not as a plan.

0. The login field name. One word, and nothing else in the walkthrough is reachable without it.
   It sits in a frozen area, so somebody has to decide whether the freeze admits an exception.
1. Comment like, edit, and delete. Three impossible steps, one backend module, all contracts
   verified.
2. Report. One impossible step, and the design and the backend enum already agree exactly.
3. Search results screen with the user half. One partial step, needs a new service and a new screen.
4. Blocked list from `GET /social/blocked` instead of `localStorage`. Turns two partial steps into
   possible ones and removes a correctness trap.
5. Remove the `GET /users/suggestions` call. One line, removes a permanently failing request.
6. Real routing. Not a scenario step, but it determines whether a refresh mid-demo is survivable.
