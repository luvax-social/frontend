# Design Decisions

> Record of work done on 2026-08-10. Not maintained; it is correct as of that date and is not updated as the code moves.

Each decision, why it went that way, and what was rejected.

---

## The self-like restriction: the control is absent

`POST /comments/{id}/like` answers `403 COMMENT_FORBIDDEN` when the actor wrote the comment.

Three treatments were available.

| Option | Verdict |
|--------|---------|
| Visible and interactive | Ruled out by the brief and correct to rule out. It would fail every single time |
| Visible but disabled | Rejected |
| **Absent** | **Chosen** |

**Why absent.**
A disabled control still makes a claim: that this action exists for you and is unavailable right now.
Nothing about that is true here.
The action does not exist for the author and never will, so there is no state in which the control becomes usable and nothing for the disabled state to be waiting on.
A greyed-out heart on your own comment invites the reader to work out what they did wrong.

Removing it costs nothing, because the heart is only ever an affordance.
The count lives separately, in the metadata line next to the timestamp, and stays visible on your own comments.
An author still sees how many likes their comment has; they simply have no button to add one.

The same rule is applied in the overflow menu: the Like item is not rendered on your own comments, so there is no second route to a guaranteed failure.
The handler also returns early if it is ever reached, so a future caller cannot reintroduce the failing path by accident.

Observed on the seeded post as `luvax_ava`:

```
Luvax Dan  an older comment everyone liked   2 likes   heart: filled
Luvax Ava  a top-level comment               1 likes   heart: ABSENT
Luvax Dan  a newer comment nobody liked      0 likes   heart: empty
```

---

## The missing counter: optimistic adjustment with rollback, and no refetch

The like endpoints return `ApiResponse<Void>`.
The new count has to come from somewhere else.

| Option | Verdict |
|--------|---------|
| Refetch the list after every like | Rejected |
| Optimistic adjustment, no rollback | Rejected outright: a failure leaves a wrong number on screen, which the brief forbids |
| **Optimistic adjustment with rollback, no refetch on success** | **Chosen** |

**Why not refetch.**
Refetching the first page re-runs the pinned selection.
Liking a comment could therefore reorder the list under the reader's cursor at the exact moment they interacted with it, and could move the comment they just liked to a different position.
Section 8 asks for the pinned treatment to hold when a pinned comment is liked or unliked; refetching is the one thing that would break it.
It is also a page-sized response to a one-integer change.

**Why the optimistic value is trustworthy.**
The counter is maintained by `trg_comment_like_count`, which moves it by exactly one per like row.
The client applies exactly the same delta to a base value that came from the server, so the two agree.
This is arithmetic on a known-good number, not a guess at a value the server never sent.

**What happens on failure.**
`onMutate` snapshots the affected cache entry, and `onError` restores it.
A failure therefore cannot leave a wrong number on screen; the row returns to precisely the state the server last described, and the error is shown on the row.

Observed with the like endpoint blocked at the network layer:

```
before : Luvax Dan a newer comment nobody liked  0 likes   pressed=false
after  : Luvax Dan a newer comment nobody liked  0 likes   pressed=false
         "Unable to reach the server. Please check your connection."
```

**The accepted cost.**
If somebody else likes the same comment in the same moment, the local number is one behind until the next natural refetch.
That is a normal property of any counter that is not live, and this application has no realtime channel yet.
It is a better trade than reordering the list on every tap.

### Where the state lives

`comment.isLiked` and `comment.likeCount` are read straight from the query cache.
No component-local `useState` mirrors them, which is the defect the existing post like control has.

This is what makes two renderings of the same comment agree, and it is testable: collapsing a reply thread unmounts the row, and re-expanding mounts a fresh one.

```
after liking a depth-1 reply         : 1 likes  pressed=true
after collapse and re-expand (remount): 1 likes  pressed=true
```

With component-local state the second line would read `0 likes  pressed=false`.

### Invalidation is targeted at one cache entry

A top-level comment lives in `['comments', postId]`; a reply lives in `['commentReplies', parentId]`.
The mutation picks the entry that holds the comment being liked and touches only that one.

Liking a reply produced exactly one request:

```
POST /comments/a161e86f-a643-4fa0-ad9a-daea34ab7f2b/like
```

No refetch of the comment tree.

---

## Deleting a subtree: say that replies go, do not say how many

Deletion soft-deletes the whole descendant tree and leaves no tombstone.
The replies simply vanish.

**Is the reply count available at the point of deletion?**
Partly, and the distinction matters.

`replyCount` is on every comment in the list, so at the moment the user opens the confirmation the client knows whether there are replies and how many **direct** ones there are.
It does not know the size of the whole subtree, because no field carries it.

Measured: deleting the root of the seeded chain, whose `replyCount` is 1, removed eleven comments.
The post's count went from 14 to 3.
A dialogue promising to delete "1 reply" would have been accurate about the field and badly wrong about the outcome.

**The wording.**
With replies:

> deleting this comment also deletes its reply and any replies to those. this cannot be undone.

The direct count is stated because it is known, and "and any replies to those" carries the cascade without inventing a total.
It pluralises on the real number: "its 3 replies" when there are three.

Without replies, the cascade is not mentioned at all, as the brief requires:

> are you sure you want to delete this comment? this cannot be undone.

**What would be needed to state the true number.**
A `descendantCount` on `CommentResponse`, or a delete response that reported how many rows it marked.
Neither exists.
Both are backend changes and the backend is read-only in this phase, so this is recorded rather than worked around.

**After deletion.**
The number of removed rows is unknown to the client, so the affected lists are refetched rather than patched, and the post is refetched too because its `commentCount` drops by the size of the whole subtree.
This is the one place where invalidation is the honest choice: there is nothing to compute locally.

---

## Editing: no "edited" marker, because nothing on the response supports one

`CommentResponse` carries `createdAt` and `updatedAt`, and comparing them looks like an easy edit indicator.

It is wrong.
`trg_comments_updated_at` fires on any update to the row, and `like_count` and `reply_count` are columns on that row.
Comments that have never been edited, and in some cases never even been liked, already show a gap:

```
like_count | created_at         | updated_at         | differs
1          | 10:39:27.762281+07 | 10:39:28.493282+07 | t
0          | 10:39:27.826501+07 | 10:39:27.917068+07 | t
0          | 10:39:27.888198+07 | 10:39:27.957285+07 | t
```

Rendering "edited" from that would label most of the seeded comments as edited, none of which were.
That is exactly the fabricated-signal pattern the brief says this project has already paid for repeatedly, so nothing was surfaced.

**What would be needed.**
A column written only by the edit path, such as `content_updated_at`, exposed on the response.
Posts already have edit history; comments deliberately do not.
Recorded in `deferred-findings.md`.

### The edit result is merged field by field

A single-comment response always reports `pinned: false`, including for a comment that is pinned in the list.
Spreading the whole response over the cached row would therefore silently strip the pinned marker off any comment in the pinned block the moment its author edited it.

Only `content` and `updatedAt` are copied across.
Verified: after editing a pinned comment and reloading, the marker is still there.

---

## Pinned comments: a derived treatment

The design export defines nothing for this, so the treatment is **derived** from existing tokens.

A small uppercase label sits above the comment, in the accent colour, preceded by a filled heart glyph:

> ♥ TOP COMMENT

Built from tokens already in use: `v.fontMono` at 9px with `0.14em` letter spacing and uppercase, in `v.accent`.
That is the same micro-label idiom the application already uses for the trending rail heading and the profile stat captions, so it introduces no new visual vocabulary.

**Why it reads without explanation.**
The requirement is that a reader can tell why those comments are first.
The word "top" plus a heart says the ordering is by likes, and the label is absent from everything below the block, so the boundary between "these were promoted" and "these are in time order" is visible rather than implied.
An unlabelled accent bar or a tint would have marked the comments as different without saying in what way, which is the current problem restated rather than solved.

**No client-side re-sorting.**
The rows are rendered in the order the server sent them.
Page two is a keyset stream that assumes the pinned block was displayed separately, so merging and re-sorting into chronological order would break pagination.

**It holds across a like.**
Because liking does not refetch, the pinned flags and the row order are untouched by an interaction:

```
before      : TOP COMMENT ... 2 likes | TOP COMMENT ... 1 likes | (none) ... 0 likes
after unlike: TOP COMMENT ... 1 likes | TOP COMMENT ... 1 likes | (none) ... 0 likes
after relike: TOP COMMENT ... 2 likes | TOP COMMENT ... 1 likes | (none) ... 0 likes
```

Only the number changes.
The server re-selects the block on the next genuine load, which is the right moment for the ordering to change.

---

## The idempotency key: one key per submission, held across retries

The key is generated when a submission starts and kept in a ref until that submission succeeds.

- A rapid double submit reuses the key, because the first attempt has not resolved, so the backend replays and returns the same comment.
- A retry after a failure reuses the key, because it is only cleared on success.
- A genuinely new comment gets a fresh key, because the previous one was cleared.

`crypto.randomUUID()` supplies the value.

Rejected: deriving the key from the content, the post, and the parent.
It looks stable and is, but it makes two legitimately identical comments indistinguishable, so the second would silently return the first.
Posting "nice" twice under the same photo is ordinary behaviour, not a double submit.

Observed on a rapid double click:

```
Idempotency-Key sent: ["86440d07-79ab-4096-84c7-fef93b241d52",
                       "86440d07-79ab-4096-84c7-fef93b241d52"]
comment occurrences on screen: 1
database rows matching the marker: 1
```
