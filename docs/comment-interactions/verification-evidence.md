# Verification Evidence

> Record of work done on 2026-08-10. Not maintained; it is correct as of that date and is not updated as the code moves.

Both applications running against the seeded database.
Signed in as `luvax_ava` in Chromium with the console captured.
Surface exercised: the post detail overlay at `/app/p/32d5030a-4181-4059-be06-b4b1dc325f2a`.

The seeded post carries three top-level comments and a reply chain ten deep.
Two of the three are pinned, and the oldest sorts first because it has the most likes, so like order and time order visibly disagree.

---

## Like and unlike

### Happy path

Round trip on another person's comment:

```
before      : Luvax Dan  an older comment everyone liked   2 likes   heart filled
after unlike: Luvax Dan  an older comment everyone liked   1 likes   heart empty
after like  : Luvax Dan  an older comment everyone liked   2 likes   heart filled
```

The count is correct after both directions.

### Your own comment: no control

Rendered as `luvax_ava`:

```
Luvax Dan  an older comment everyone liked   2 likes   heart: filled
Luvax Ava  a top-level comment               1 likes   heart: ABSENT
Luvax Dan  a newer comment nobody liked      0 likes   heart: empty
```

The heart is not in the DOM on the viewer's own comment, and the count is still shown.
The overflow menu on that comment offers no Like item either:

```
own comment    : Share, Copy link, View author's profile, Edit, Delete
other's comment: Like, Share, Copy link, View author's profile, Report
```

There is no control anywhere that appears interactive and always fails.

### The same comment in two places agrees

Collapsing a reply thread unmounts the row; re-expanding mounts a fresh one.
With the previous component-local state this reset the heart.

```
after liking a depth-1 reply           : 1 likes   pressed=true
after collapse and re-expand (remount) : 1 likes   pressed=true
after unliking                         : 0 likes   pressed=false
```

The state survives the remount because it lives in the query cache.

### Invalidation is precise

Requests caused by liking a reply one level down:

```
["POST /comments/a161e86f-a643-4fa0-ad9a-daea34ab7f2b/like"]
```

One request.
No refetch of the comment tree and no refetch of the post.

### Like while offline

The like endpoint blocked at the network layer:

```
before: Luvax Dan a newer comment nobody liked  0 likes  pressed=false
after : Luvax Dan a newer comment nobody liked  0 likes  pressed=false
        "Unable to reach the server. Please check your connection."
```

The optimistic change is rolled back, so no wrong number is left on screen, and the message is intelligible.

### Like a comment you cannot like

Unreachable from the interface by design, since the control is absent on your own comments.
Verified at the API instead, and the guard in the handler returns early if it is ever reached:

```
POST /comments/<ava's own comment>/like  as ava
403 {"code":"COMMENT_FORBIDDEN","message":"You do not have permission to perform this action on the comment"}
```

---

## Edit

### Happy path, and it persists

```
Edit clicked -> textarea present: true
after save, editor closed      : true
shows edited text              : true
after a full page reload       : true
```

The comment body read `a top-level comment (edited in browser)` after reloading.

A pinned comment stays pinned after being edited:

```
pinned marker survived the edit: true
```

### Cancel leaves the comment unchanged

Typed `THIS SHOULD NOT PERSIST` into the editor and cancelled:

```
after cancel, original body intact and the draft gone: true
```

### Empty content

```
draft "   " -> save disabled: true
```

The client refuses before the request, matching the backend's `@NotBlank`.

### Content over the backend limit

```
draft of 2201 characters -> save disabled: true
counter shows            : 2201/2200
```

The limit is 2200 because that is the backend's `@Size(max = 2200)`, not a number the client chose.

### An edit the server rejects

The `PATCH` intercepted and answered `403 COMMENT_FORBIDDEN`:

```
editor still open        : true
message shown            : "You do not have permission to perform this action on the comment"
```

After reloading, the comment still shows the last genuinely saved body and not the rejected draft:

```
body is the last SAVED text, rejected draft absent: true
```

A failed edit never reads as though it saved.

---

## Delete

### A leaf comment: the confirmation does not mention replies

```
delete comment
are you sure you want to delete this comment? this cannot be undone.
cancel  delete
```

### A comment with replies: the confirmation says so

```
delete comment
deleting this comment also deletes its reply and any replies to those. this cannot be undone.
cancel  delete
```

Singular because that comment has one direct reply; it reads "its 3 replies" when there are three.

### Cancelling

```
after cancel, comment still present: true
```

### The subtree goes, without a reload

Deleting the root of the seeded chain:

```
subtree gone from the list without a reload: true
post.commentCount 14 -> 3
```

Eleven comments went, which is the whole chain.
The post's count followed without a page reload.

Measured again on a two-node tree built for the purpose:

```
post.commentCount 16 -> 14
id        depth  deleted
170c27c8  0      t
c2bcd689  1      t
```

### Deleting a comment you do not own

No control is rendered, so this is unreachable from the interface.
Verified at the API:

```
DELETE /comments/<ava's comment>  as ben
403 {"code":"COMMENT_FORBIDDEN"}
```

### State restored afterwards

These checks consumed part of the seeded comment tree.
The subtree was restored and the throwaway probes removed, so the database is back at the seeded baseline:

```
post.commentCount = 13
deepest reply still present = depth 10
```

---

## Pinned comments

### The marker, and that ordering is now explicable

```
TOP COMMENT  Luvax Dan  an older comment everyone liked   2 likes
TOP COMMENT  Luvax Ava  a top-level comment               1 likes
             Luvax Dan  a newer comment nobody liked      0 likes
```

The two promoted comments are labelled, the one below is not, and the boundary between the promoted block and the chronological remainder is visible.
The oldest comment being first is now self-explanatory.

### It holds when a pinned comment is liked and unliked

```
before      : TOP COMMENT ... 2 likes | TOP COMMENT ... 1 likes | (none) ... 0 likes
after unlike: TOP COMMENT ... 1 likes | TOP COMMENT ... 1 likes | (none) ... 0 likes
after relike: TOP COMMENT ... 2 likes | TOP COMMENT ... 1 likes | (none) ... 0 likes
```

Only the number changes.
Nothing is reordered under the reader and no marker appears or disappears mid-session.

---

## Idempotency on creation

Two clicks on send as fast as the page could dispatch them:

```
Idempotency-Key values sent: ["86440d07-79ab-4096-84c7-fef93b241d52",
                              "86440d07-79ab-4096-84c7-fef93b241d52"]
occurrences of the comment on screen: 1
```

Confirmed in the database:

```sql
SELECT count(*) FROM comments WHERE content LIKE 'double-submit probe%' AND deleted_at IS NULL;
1
```

One comment, from two submissions.

Distinctness across genuinely separate submissions was verified at the API, where a different key with an identical body created a second comment.

---

## Console

No React render error on any comment surface across every interaction above.

The only `ERROR` lines in the session are the failures that were deliberately induced, plus the existing development-only logger:

```
403 (Forbidden) .../comments/1123fde8-...        <- the mocked rejected-edit test
[QueryClient] You do not have permission ...      <- dev-only handler in main.jsx
net::ERR_INTERNET_DISCONNECTED .../like           <- the offline-like test
[QueryClient] Unable to reach the server ...      <- dev-only handler in main.jsx
401 (Unauthorized) .../posts/32d5030a-...         <- an unauthenticated probe fetch from the test harness, not the application
```

## Build

```
$ npm run build
✓ built in 528ms
```

The pre-existing chunk-size advisory is unchanged and unrelated.
