# Deferred Findings

> Record of work done on 2026-08-10. Not maintained; it is correct as of that date and is not updated as the code moves.

Found during this phase, deliberately not acted on, with where each belongs.

## In the comment module

### A comment carries no signal that it was edited

`CommentResponse` has `createdAt` and `updatedAt`, and the two differ on almost every comment, including ones that were never edited.
`trg_comments_updated_at` fires on any update to the row, and the like and reply counters are columns on that row.

No marker was rendered, because any marker built from those two fields would be wrong most of the time.

What it would take is a column written only by the edit path, such as `content_updated_at`, surfaced on the response.
Posts have edit history; comments deliberately do not.

**Belongs to:** a backend change, if the product wants edited comments labelled.

### The client cannot know how many comments a delete will remove

`replyCount` is direct replies only.
Deleting the root of the seeded chain, whose `replyCount` is 1, removed eleven comments.

The confirmation is worded so that it never claims a total it does not have.
Stating the real number would need a `descendantCount` on the response, or a delete response reporting how many rows it marked.

**Belongs to:** a backend change, if the wording should be more specific.

### "1 likes"

The count renders as `{n} likes` with no pluralisation, so a single like reads "1 likes".
Pre-existing, and untouched because copy belongs to the design conformance phase.
The delete confirmation added here does pluralise, so the two are inconsistent until that phase lands.

**Belongs to:** the design conformance phase.

### Report on a comment does nothing

The overflow menu has a Report item with an empty handler, on comments the viewer does not own.
It is visible, appears interactive, and does nothing.

Left exactly as found: section 10 puts report in its own phase covering post, comment, and user together.
Worth noting that it is the same shape of problem the self-like restriction was fixed for, and it should be either wired up or hidden when that phase runs.

**Belongs to:** the report phase.

### Replies load 50 at a time with no pagination control

`useCommentReplies` requests `limit: 50` and never fetches a second page, so a comment with more than fifty direct replies silently shows the first fifty.
The endpoint is cursor paginated and would support it.

**Belongs to:** whichever phase takes on comment pagination.

### Only the first page of top-level comments is ever fetched

`useTopLevelComments` is an infinite query, but nothing in the post detail calls `fetchNextPage`, so a post with more than twenty top-level comments shows twenty.
This matters more now that the pinned block occupies up to three of those slots.

Not addressed here because it is pagination rather than a comment interaction, and the pinned block interacts with it: page two is a keyset stream that assumes the pinned ids were already shown.

**Belongs to:** whichever phase takes on comment pagination.

### The post like control still keeps its state in the component

The defect the brief warned against repeating.
`PostCard` and `PostDetailScreen` hold `liked` and `likeCount` in `useState`, so the same post rendered in the feed and in the detail overlay can disagree, and the state resets on remount.

The comment controls built here do not do this, but the post controls were left alone: they are outside the comment tree, which section 10 puts out of scope.

**Belongs to:** a post interactions phase.

### Moderation rejection is not specifically handled

`CommentServiceImpl.editComment` and the create path can answer `COMMENT_MODERATION_REJECTED`.
The message is shown through the ordinary error display, which is intelligible but generic.
Ordinary text did not trigger it, so the path was not exercised in the browser.

**Belongs to:** the moderation phase, if one is planned.

## Elsewhere

### `sharePost` and `copyPostLink` are used for comments

The comment menu's Share and Copy link items call the post helpers with the post id, so they share the post rather than the comment.
There is no comment-level permalink to share, and creating one is a routing decision.

Pre-existing and unchanged.

**Belongs to:** whichever phase decides whether a comment should be addressable.

## Explicitly out of scope, untouched

Listed in the brief and confirmed not acted on:

- reporting a comment
- comment sort controls
- realtime comment events and the WebSocket client
- whether post detail should be a modal rather than a route
- the design system port and any pixel-perfect work
- search, saved posts, private accounts, follow requests
- post-level defects outside the comment tree
- lint
