# Changes Applied

> Record of work done on 2026-08-10. Not maintained; it is correct as of that date and is not updated as the code moves.

One entry per change.

---

## 1. No way to like a comment

**What was missing.**
No service function, no hook, no working control.
`CommentRow` had a heart button, but it drove a component-local `useState(false)` and made no request.

**Evidence.**
`const [liked, setLiked] = useState(false)` with `handleLikeToggle` doing nothing but flip it.
No reference to `likeComment` anywhere in the frontend.
The backend has had `POST` and `DELETE /comments/{id}/like` all along.

**What was built.**
`likeComment` and `unlikeComment` service functions, and a `useToggleCommentLike` mutation that adjusts the cached comment optimistically and rolls back on failure.
The control now reads `comment.isLiked` and `comment.likeCount` from the cache.

**Files.** `src/services/post.service.js`, `src/features/luvax/hooks/usePosts.js`, `src/features/luvax/components/PostDetailScreen.jsx`

## 2. The like count was invented on the client

**What was wrong.**
The count rendered as `{liked ? comment.likeCount + 1 : comment.likeCount} likes`.
The displayed number was the server's count plus a local boolean that no request ever backed.
Clicking the heart raised the number without anything being recorded.

**Evidence.**
That expression, next to a `handleLikeToggle` that issued no request.

**What was built.**
The count renders `comment.likeCount` straight from the cache.
The adjustment happens in the mutation, against the cached row, and is reverted if the request fails.

**File.** `src/features/luvax/components/PostDetailScreen.jsx`

## 3. `comment.isLiked` was never read

**What was wrong.**
The field is on every comment on every surface, and the frontend ignored it.
A comment the viewer had already liked rendered with an empty heart, and the state reset on every remount.

**Evidence.**
`isLiked` appears nowhere in the frontend before this change.
Live responses carry it, including on replies.

**What was built.**
`const liked = Boolean(comment.isLiked)`.
There is no local like state left in the component.

**File.** `src/features/luvax/components/PostDetailScreen.jsx`

## 4. The heart was shown on comments that can never be liked

**What was wrong.**
The heart rendered on the viewer's own comments, where the backend answers `403` every time.

**Evidence.**
`403 COMMENT_FORBIDDEN` on liking your own comment, enforced in `CommentServiceImpl.likeComment`.
The button was rendered unconditionally.

**What was built.**
The heart is not rendered on your own comments, and the Like item is dropped from their overflow menu.
The count stays visible as text, so the author loses no information.
The reasoning is in `design-decisions.md`.

**File.** `src/features/luvax/components/PostDetailScreen.jsx`

## 5. No way to edit your own comment

**What was missing.**
No service function, no hook, no control.

**Evidence.**
`PATCH /comments/{commentId}` exists and works; nothing in the frontend called it.

**What was built.**
An `editComment` service function, a `useEditComment` mutation, an Edit item in the overflow menu on your own comments, and an inline editor prefilled with the current body.
Validation mirrors the backend exactly: non-blank after trimming, at most 2200 characters, with a live counter.
A rejected save keeps the editor open holding the draft and shows the error, so it never reads as saved.

**Files.** `src/services/post.service.js`, `src/features/luvax/hooks/usePosts.js`, `src/features/luvax/components/PostDetailScreen.jsx`

## 6. An edit would have stripped the pinned marker

**What would have gone wrong.**
The obvious implementation writes the PATCH response over the cached row.
A single-comment response always reports `pinned: false`, so editing a pinned comment would have quietly demoted it in the list until the next full load.

**Evidence.**
The DTO says pinned is "always false elsewhere, including on single-comment responses", and the live PATCH response confirms it.

**What was built.**
Only `content` and `updatedAt` are copied from the response into the cached row.
Verified: a pinned comment still shows its marker after being edited and reloaded.

**File.** `src/features/luvax/hooks/usePosts.js`

## 7. No way to delete your own comment

**What was missing.**
No service function, no hook, no control, and no confirmation.

**Evidence.**
`DELETE /comments/{commentId}` exists and cascades to the subtree; nothing in the frontend called it.

**What was built.**
A `deleteComment` service function, a `useDeleteComment` mutation, a Delete item in the overflow menu on your own comments, and a confirmation built on the existing `LxModal`, matching the structure the post delete confirmation already uses.
The wording states the consequence for replies when there are replies and stays silent when there are none.
On success the comment lists and the post are refetched, so the subtree disappears and the post's comment count follows, with no page reload.

**Files.** `src/services/post.service.js`, `src/features/luvax/hooks/usePosts.js`, `src/features/luvax/components/PostDetailScreen.jsx`

## 8. Edit and delete had to be restricted to the author

**What was needed.**
Controls that only appear on comments the viewer wrote, decided from the response rather than from anything the client remembers.

**What was built.**
`author.id === currentUser.id`, where `author` is the `UserSummaryResponse` embedded in the comment and `currentUser` is the session user.
Confirmed in the browser: the menu on the viewer's own comment offers Share, Copy link, View author's profile, Edit, Delete; the menu on somebody else's offers Like, Share, Copy link, View author's profile, Report.

**File.** `src/features/luvax/components/PostDetailScreen.jsx`

## 9. The pinned flag was ignored

**What was wrong.**
The backend promotes up to three comments by like count and marks them `pinned`.
The frontend rendered them in the order received with no indication of why, so the first three comments appeared in an order the reader could not explain and that shifted as likes arrived.

**Evidence.**
`pinned` appears nowhere in the frontend before this change.
On the seeded post the oldest comment is first because it has the most likes.

**What was built.**
A derived marker, `♥ TOP COMMENT`, in the accent colour above pinned comments, using the micro-label idiom already in the application.
No client-side re-sorting: the rows render in server order, because page two is a keyset stream that assumes the pinned block was displayed separately.

**File.** `src/features/luvax/components/PostDetailScreen.jsx`

## 10. A double submit created two comments

**What was wrong.**
The backend accepts an `Idempotency-Key` header and honours it.
The frontend sent none, so two rapid clicks created two comments.

**Evidence.**
`@RequestHeader(value = "Idempotency-Key", required = false)` on `createComment`, and the frontend's `createComment` sending no headers.
Verified server-side that a replayed key returns the original comment id.

**What was built.**
`createComment` sends the header when a key is supplied.
`useCreateComment` holds one key per submission in a ref, reusing it across a retry and clearing it only on success, so a double submit replays and a genuinely new comment gets a fresh key.

**Files.** `src/services/post.service.js`, `src/features/luvax/hooks/usePosts.js`

## 11. Creating a comment did not update the post's comment count

**What was wrong.**
`useCreateComment` invalidated the comment lists but not the post, so the count on the post detail stayed behind until something else refetched it.

**Evidence.**
The mutation invalidated `['commentReplies', parentId]` and `['comments', postId]` only.
`commentCount` lives on the post.

**What was built.**
`['post', postId]` is invalidated too, matching what the delete path does.

**File.** `src/features/luvax/hooks/usePosts.js`

## 12. The comment menu called a `navigate` that was no longer in scope

**What was wrong.**
"View author's profile" in the comment menu called `navigate?.('profile', { user: author })`.
`navigate` had been a prop; it is not, and it is not declared in `CommentRow`, so the optional-call syntax does not help.
Clicking the item would have thrown a `ReferenceError`.

**Evidence.**
`CommentRow({ comment, onReply, indent = 0, postId })` with a body referencing `navigate`.

**Where it came from.**
Introduced in the routing phase, when the `navigate` prop was removed from `CommentRow` and this one call site was missed.
It was latent because it only runs on click, and that menu item had not been clicked.

**What was built.**
`CommentRow` takes `useNavigate()` and the item navigates with `routeTo.userProfile(author.id)`.

**File.** `src/features/luvax/components/PostDetailScreen.jsx`
