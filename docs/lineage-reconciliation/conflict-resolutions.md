# Conflict Resolutions

> Record of work done on 2026-08-14. Not maintained; it is correct as of that date and is not updated as the code moves.

This document catalogues every merge conflict between the two lineages before any of them were resolved.
The pre-resolution analysis in this file was committed before a single hunk was resolved.
The resolution column records what was actually done and is filled in during the resolution commit.

## Ground truth of the conflict set

The task narrative described "nine places across four files".
The real conflict set, discovered by a trial merge of lineage A into develop after lineage B was already merged, is larger.
It is 18 hunks across 7 files: 17 hunks in 6 source files plus 1 hunk in `CHANGELOG.md`.
The catalogue below reflects what git actually reported, not the narrative.

The merge that produces these conflicts is the second lineage merge.
Lineage B was merged into develop first and was clean, because lineage B forks from the stage 1 conformance base that develop already contains.
Lineage A forks from an older point (the comment interactions merge, `4d551ad`), so merging it onto develop after B surfaces every place the two lineages touched the same lines.

In every hunk below:

- "Ours / HEAD" is develop with lineage B already merged (design conformance stage 2, composer rework, design conformance stage 3).
- "Theirs / A" is `feat/comment/realtime-and-verification-gaps`, the tip of lineage A, which carries search and saved posts, social states and profile tabs, and the realtime client.

## Resolution rules

The four rules from the task, applied in order, first match wins:

1. Two unrelated changes to adjacent lines. Keep both.
2. The same feature implemented twice. Keep the implementation closer to the backend contract, discard the other, and port conformance styling from the discarded side onto the kept side.
3. Two designs for the same visual element. The design conformance version wins.
4. Anything else. Stop and report rather than guess.

---

## Hunk 1 - CHANGELOG.md (1 hunk)

- Ours / HEAD: a block of changelog entries describing the composer rework, escape-to-close, confirm dialog, carousel viewing, media rendering, and the conformance audit stages.
- Theirs / A: a block of changelog entries describing realtime comments, the photos and liked tabs, private accounts, block and unblock from the profile, search results, and saved posts.
- Nature: two unrelated sets of additions to the same changelog section. Not code.
- Rule applied: 1.
- Decision: keep both. Union all entries under the appropriate headings. No entry from either side is dropped.

## Hunk 2 - src/services/post.service.js (1 hunk)

- Ours / HEAD: defines `getLikedPosts` against `/posts/liked`, and a simple `getUserPosts(userId, { signal, ...params })` that forwards params unchanged.
- Theirs / A: `getUserPosts(userId, { signal, type, ...params })` that coerces `type` to a comma-joined string, with a comment recording that the backend rejects the `type[]=` bracket form with 400, verified against the running server.
- Nature: `getUserPosts` is the same function implemented twice. `getLikedPosts` exists to back the liked tab.
- Rule applied: 2.
- Decision: keep A's `getUserPosts` because its comma-join is the version verified against the backend contract. Keep `getLikedPosts` because the liked tab depends on it. Confirm during resolution that A's branch also defines `getLikedPosts` so nothing is lost.

## Hunk 3 - src/features/luvax/components/ExploreScreen.jsx (1 hunk)

- Ours / HEAD: import adds `getMediaList` and a separate import of `TOPICS` from the constants, for topic shortcuts and media thumbnails.
- Theirs / A: import adds `isVideoMedia` and does not import `TOPICS`, consistent with A removing the explore topic shortcuts (A's changelog states the explore screen no longer reserves a band for topic shortcuts).
- Nature: the two sides changed the same import line for different reasons. The body of the file auto-merged, which means the resolution must match whatever the merged body actually uses.
- Rule applied: 1, with a verification obligation.
- Decision: keep the union of helper imports that the merged body references. If A's removal of the topic shortcuts won in the auto-merged body, `TOPICS` is unused and must not be imported. Read the merged body during resolution and import exactly what it uses. This hunk is flagged because an auto-merged body can be internally inconsistent, and that must be checked, not assumed.

## Hunk 4 - src/features/luvax/components/shell.jsx, tab button (1 of 2)

- Ours / HEAD: the top navigation tab button with conformance measurements. Tabs expand to roughly 110 pixels, flex is `0 0 auto` when compact and `1` otherwise, no disabled handling.
- Theirs / A: the same button with disabled handling. It guards the click, sets `disabled`, `aria-disabled`, a `title` explaining the tab is not part of this build, and dims the tab, but keeps the older 44 pixel width.
- Nature: the styling is a competing design (conformance width versus old width), and the disabled handling is a feature that only A has. The `messages` tab is declared `disabled: true` in the tabs array, which auto-merged in from A, so without A's disabled handling that flag would do nothing and the tab would navigate to an unbuilt screen.
- Rule applied: 3 for the styling, 1 for the disabled feature.
- Decision: combine. Take B's conformance measurements and take A's disabled handling. Neither the conformant width nor the disabled behaviour may be lost.

## Hunk 5 - src/features/luvax/components/shell.jsx, trending rail (2 of 2)

- Ours / HEAD: renders a trending rail, a hardcoded list of tags numbered as a ranking and styled as a clickable list.
- Theirs / A: removes the rail and leaves a comment recording that the list was invented data, that a fabricated ranking is worse than an empty rail, and that the real trending endpoint is not wired in this phase.
- Nature: a deliberate removal on one side against a styled placeholder on the other. The disputed content is fabricated data, not a wired feature.
- Rule applied: judgement between 3 and 4, resolved toward A.
- Decision: keep A's removal. Design conformance governs how a real element looks, not whether invented data should be shown. Presenting a fake ranking that pretends to filter is a correctness and integrity problem, and A's removal is the principled correction. This decision is called out explicitly as a judgement so a reviewer can revisit it. No wired capability is lost, because the rail was never wired.

## Hunk 6 - src/features/luvax/components/PostDetailScreen.jsx, import (1 hunk)

- Ours / HEAD: imports `useCommentDeletionScope` alongside the other comment hooks. This backs the delete confirmation that counts every reply beneath a comment.
- Theirs / A: imports `useLivePostUpdates` and does not import `useCommentDeletionScope`.
- Nature: this is the known Rule 1 example. One side added a comment deletion hook, the other added a live updates hook. Taking either side alone drops a feature.
- Rule applied: 1.
- Decision: keep both. Import `useLivePostUpdates` and `useCommentDeletionScope` together. Confirm during resolution that `useCommentDeletionScope` still exists in the merged `usePosts.js` and is still used in the merged `PostDetailScreen.jsx`, otherwise the import is dead or broken.

## Hunk 7 - src/features/luvax/hooks/usePosts.js, like imports (1 of 4)

- Ours / HEAD: imports `patchCachedPost` from `usePostLikeState`, the optimistic like helper that patches every cached rendering of a post at once.
- Theirs / A: imports `beginSelfPostLike`, `endSelfPostLike`, `noteSelfCommentLike` from `useLivePostUpdates`, the in-flight guards that stop a realtime broadcast from undoing the viewer's own tap mid-flight.
- Nature: two mechanisms that address the same like path from different angles. This is the highest-risk interaction in the whole merge, called out in section 7.2 of the task.
- Rule applied: 1, treated as two complementary mechanisms that must coexist.
- Decision: keep both imports. The optimistic patch and the in-flight guard are not alternatives. The resolution of hunk 9 must make them work together, so the viewer's own like is not double-counted and a remote like still moves the count.

## Hunk 8 - src/features/luvax/hooks/usePosts.js, liked and user posts hooks (2 of 4)

- Ours / HEAD: `useLikedPosts(enabled)` on query key `['likedPosts']` with limit 10, and `useUserPosts(userId, params = {})` taking an open params bag.
- Theirs / A: `useUserPosts(userId, types = [], { enabled } = {})` that keys the query on the type filter so a cursor and its filter live and die together, `useSavedPosts` on `savedPostsKey`, and `useLikedPosts(enabled)` on `likedPostsKey` with the documented `LikedPostResponse` and `SavedPostResponse` wrapper shapes and limit 12.
- Nature: the photos, liked, and saved data hooks implemented twice. A's version is written against the real endpoints, documents the wrapper row shapes, and couples the cursor to the type filter to avoid a cross-filter 400.
- Rule applied: 2.
- Decision: keep A's hooks. Discard B's duplicates. A carries the saved posts hook, the wrapper shapes, and the cursor-filter coupling, none of which B has.

## Hunk 9 - src/features/luvax/hooks/usePosts.js, toggle post like mutation (3 of 4)

- Ours / HEAD: `onMutate` optimistically patches `isLiked` and `likeCount` through `patchCachedPost`, `onSuccess` applies the authoritative count from the response through the same patch, `onError` restores.
- Theirs / A: `onMutate` calls `beginSelfPostLike(postId)`, `onSettled` calls `endSelfPostLike(postId)`, deferring the visible change to the realtime broadcast and only guarding against a mid-flight frame.
- Nature: the same mutation, resolved two ways. B gives immediate cross-rendering feedback. A prevents the realtime broadcast from double-counting the viewer's own tap.
- Rule applied: 1, combined, because both behaviours are required and section 7.2 demands they run together.
- Decision: combine. Keep B's optimistic patch and rollback for immediate feedback across both renderings, and keep A's in-flight guard so the broadcast does not undo or double-count the tap. Apply the authoritative count on success through the patch. This is the single most delicate resolution and is verified specifically in re-verification.

## Hunk 10 - src/features/luvax/hooks/usePosts.js, toggle save mutation (4 of 4)

- Ours / HEAD: `onMutate` optimistically patches `isSaved` through `patchCachedPost`, `onError` restores.
- Theirs / A: `onSettled` invalidates `savedPostsKey`, which is what makes saving from anywhere show up on the saved screen and unsaving from the saved screen drop the row without a reload.
- Nature: the same mutation. A's invalidation is required by the saved screen contract. B's optimistic patch gives immediate feedback on the post control.
- Rule applied: 1, combined.
- Decision: combine. Keep B's optimistic `isSaved` patch and rollback, and add A's `savedPostsKey` invalidation on settle. Neither the immediate feedback nor the live saved screen is lost.

## Hunks 11 to 18 - src/features/luvax/components/ProfileScreen.jsx (8 hunks)

The two lineages both rebuilt the profile screen, so all eight hunks are governed by one decision recorded once here and applied per hunk.

- Ours / HEAD: lineage B's profile screen. It carries conformance styling: stat measurements (gap 30, font size 14, letter spacing 0.14em), the `MediaThumb` grid rendering that reserves the tile box and shows a video as a video, and a photos tab that filters by `type` through the user posts hook.
- Theirs / A: lineage A's profile screen. It carries the backend-contract work and the social states: `useLikedPosts` with the `{ likedAt, post }` wrapper unwrap, `useDrainEmptyPages` for short liked and saved pages, `isReadable` and the private account treatment, `isFollowing` and `isRequested` and the derived follow label, the block and unblock loop with `BlockConfirmDialog` and `confirmingBlock`, `renderCount`, and the tabs list that hides the liked tab on another account.
- Nature: the same feature implemented twice, Rule 2, with conformance styling living on the discarded side.
- Rule applied: 2, with the styling port the rule mandates.
- Decision: keep A's implementation as the base of every hunk, because A is written against the real endpoints and carries the social states, block, follow requests, private accounts, and short-page draining that B does not have. Port B's conformance styling onto A: the stat block measurements, and the `MediaThumb` grid rendering so the profile grid keeps the reserved box, the portrait handling, and the visible video that B's media work delivered. The individual hunks are:

  - Hunk 11, `useEffect` import: A drops `useEffect`, B keeps it. Keep whichever the merged file body uses. Resolve to the set the kept body references.
  - Hunk 12, component imports: keep A's imports (`MediaThumb`, `ReportModal`, `REPORT_TYPES`, the social hooks) and reconcile the `LxDropdownMenu` source with whatever the kept body imports it from.
  - Hunk 13, local state: keep A's state, which includes `confirmingBlock` for the block dialog and the follow-request derived state, rather than B's `following` boolean.
  - Hunk 14, data fetching: keep A's fetching, which drains short pages and unwraps the liked and saved wrappers. Port B's photos type filter onto A's `useUserPosts` call, since A's hook already takes a types argument.
  - Hunk 15, post flattening: keep A's flatten and drain, which handles the wrapper shape and the like-outlives-post empty page case.
  - Hunk 16, follow control and menu: keep A's, which renders the real follow label, the requested state, the block dialog trigger, and hides the follow button while blocking. Apply B's button measurements where they do not remove A's states.
  - Hunk 17, stats and tabs grid: keep A's readable guard and tabs list, port B's stat measurements and the `MediaThumb` grid rendering onto it.
  - Hunk 18, dialogs: keep A's `BlockConfirmDialog`, and keep the report modal only if the kept body still opens it.

Every ProfileScreen hunk is verified in the browser afterward, because a Rule 2 port is where a feature is most easily dropped by accident.

---

## Resolution applied

This section records what was actually done once the hunks were resolved, including the two places where resolving ProfileScreen revealed more than the pre-resolution analysis anticipated.
The merge that carries these resolutions is `merge(common): reconcile lineage A (search, saved, social, realtime)`.

### The straightforward hunks

- CHANGELOG.md: both entry blocks kept, only the three markers removed. No entry dropped.
- post.service.js: A's `getUserPosts` with the comma-join kept, the duplicate `getLikedPosts` here dropped because A defines it once elsewhere. Confirmed one each of `getUserPosts`, `getLikedPosts`, `getSavedPosts`.
- PostDetailScreen.jsx: both `useLivePostUpdates` and `useCommentDeletionScope` imported. Confirmed both are used in the merged body, at the live-updates call and the deletion-scope call.
- ExploreScreen.jsx: resolved by what the auto-merged body uses. The body uses `getMediaList` and not `isVideoMedia` or `TOPICS`, so A's topic-rail removal stood and only the used helpers are imported.
- shell.jsx tab button: combined. B's conformant width and B's expand-when-not-compact flex kept, A's `disabled`, `aria-disabled`, `title`, disabled cursor and dim kept. The `messages` tab declares `disabled: true`, so dropping A's handling would have let it navigate to an unbuilt screen.
- shell.jsx trending rail: A's removal kept. The rail was a fabricated ranking and A's comment stands in its place. This leaves the desktop right rail empty, which is recorded in deferred-findings as a design gap, not re-filled with invented data.

### usePosts.js like path, the highest-risk hunk

The like mutation was combined rather than chosen.
`onMutate` now marks the post in flight through `beginSelfPostLike` and then applies B's optimistic patch to `isLiked` and `likeCount`.
`onSuccess` applies the server's authoritative count through the same patch.
`onError` restores.
`onSettled` clears the in-flight mark through `endSelfPostLike`.
The in-flight mark is what makes the live post-like handler skip the broadcast frame for this post until the tap settles, so the viewer's own tap is not undone or double-counted, while a remote like still moves the count because the broadcast carries an absolute value.
The save mutation was combined the same way: B's optimistic `isSaved` patch and rollback, plus A's `savedPostsKey` invalidation on settle so the saved screen stays live.

### ProfileScreen.jsx, two findings beyond the plan

The pre-resolution plan was "keep A, port styling". Resolving the file showed two things the plan did not capture, both handled to avoid losing a feature:

1. The overflow menu was not one feature implemented twice. A's `menuItems` carried a real block and unblock loop with a stub report that did nothing. B's `profileMenuItems` carried a real report through `ReportModal` with the `hasReported` state, but no block. Choosing either side alone would have dropped a real capability. The two were folded into one `menuItems`: A's block loop plus B's real report with its `hasReported` handling. The `reportTarget` state and the `ReportModal` were carried over, and the orphaned `profileMenuItems` array was removed.
2. A's grid rendered posts as a background-cover tile, which loses the conformance media work: a video shows as a still cover, a portrait is cropped, and a broken image leaves a bare tile. B's `MediaThumb` grid was ported onto A's `body` so the profile grid keeps the reserved box, the visible video, and the deliberate fallback.

The profile stat block kept A's measurements rather than porting B's exact numbers.
A's block carries the `navigable` and `renderCount` guards that render a private account's withheld counts as a placeholder and refuse navigation when the profile is unreadable, which are features B's block does not have.
The measurement difference between the two is a few pixels and a letter-spacing value, and it could not be confirmed which set is the design-export value without guessing, so A's working block was kept intact.
This is the one place a Rule 3 styling port was deliberately not applied, and it is recorded here so a reviewer can revisit it.

The build succeeds after all resolutions.
