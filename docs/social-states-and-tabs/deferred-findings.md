# Deferred Findings

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

Found and deliberately not acted on, with the phase each belongs to.

## Explicitly out of scope for this phase

Listed in the task and recorded without action.

| Finding | Belongs to |
|---------|-----------|
| The realtime client | A realtime phase |
| A comment sort control. `GET /posts/{postId}/comments` declares `sort` and the client never sends it | A comment phase |
| Building messages, stories or onboarding as features | Their own phases |
| The design system port and pixel-perfect work | A design conformance phase |
| Post like state living in component-local state | A state correctness phase |
| Escape-key dismissal for modals, now including `BlockConfirmDialog` | An accessibility phase |
| The global query error handler logging expected outcomes as errors | A logging phase |
| Lint | A lint phase |

## Found during this phase

### 1. Explore is a search for the letter "a"

`post.service.js` substitutes `q = 'a'` when the explore screen has no search term, because `GET /posts/search` requires `q`.

The explore screen is therefore not an explore feed. It is a search for the letter `a` presented as one.

It is a legal request and strict parameter rejection does not touch it, so it was left alone.
It also means explore traffic is indistinguishable from real post search traffic in any metric derived from that endpoint, which the backend team may care about.

**Belongs to:** an explore phase. The likely fix is a real explore or recommendation endpoint.

### 2. Comment replies are capped at 50 and cannot page

`getCommentReplies` sends `limit: 50` and never sends `cursor`, though the endpoint declares it.

A comment with more than 50 direct replies silently shows only the first 50, with nothing indicating more exist.

**Belongs to:** a comment phase.

### 3. The blocked list is read as a single page

The profile screen reads `GET /social/blocked` to tell a blocked account apart from a nonexistent one, and `useBlockedUsers` fetches one page with no pagination.

A viewer who has blocked more accounts than one page holds could open the profile of a blocked account beyond that page and get the generic 404 treatment instead of the blocked state.

Correct for any realistic number of blocks, wrong in principle.

**Belongs to:** a social phase, alongside making the blocked list itself paginate.

### 4. `PostCard` blocks with no confirmation

The profile now confirms before blocking and states the consequences. The post overflow menu still blocks immediately on click.

The same irreversible action is gated in one place and not the other.

Not changed here because the post overflow menu was not in scope and changing it would have widened the diff.

**Belongs to:** a social phase. The `BlockConfirmDialog` component is reusable as is.

### 5. The post overflow menu uses Title Case

`PostCard` renders "Report", "Block @handle" and "View author's profile".

The design export is explicit that all UI copy is lowercase. The new profile menu follows that rule, so the two menus now disagree.

**Belongs to:** a design conformance phase.

### 6. The messages panel components are unreachable

`ConversationListPanel`, `ChatCenterPanel`, `ConversationInfoPanel`, `ConvRow`, `MessageBubble`, `AvatarVisual` and `MediaPlaceholder` are imported only by each other and by no reachable screen.

They are real UI with no data source. Left in place because deleting them is a restructuring this phase does not take on, and because they are the starting point for building messaging properly.

**Belongs to:** a messages phase, which will either use them or delete them.

### 7. The `type` filter is not a media filter

`type` filters on the post's declared type, not on whether the post carries media.

In the current database 150,003 posts are typed `image`, `video` or `carousel` while only 4 carry a media asset. A post typed `image` with no media appears in the photos tab and renders as a caption tile.

This is the data being inconsistent rather than the filter being wrong. The client cannot correct it without filtering client-side, which would break pagination.

**Belongs to:** a data or backend phase. Worth raising with the backend team: whether `image` should imply at least one image asset.

### 8. The seed runbook's documented blocker is stale

`docs/reconnaissance/seed-data.md` states that seeding is blocked because the mail provider rejects `example.com`, and prescribes a manual `UPDATE` against `user_credentials`.

That described the Resend transport. The dev profile now delivers by SMTP to the Mailpit container, so the tokens are readable from the Mailpit API and each account can be verified through `GET /auth/verify-email`.

The manual database write is no longer needed. The runbook was not edited, because it belongs to a previous phase's document set.

**Belongs to:** whoever next owns the reconnaissance docs. The working procedure is recorded in `verification-evidence.md`.

### 9. The branch was not cut from `develop`

`git_workflow.md` requires branching from an up-to-date `develop`.

This branch was cut from `feat/post/search-saved-and-profile-tabs`, because that branch is not merged into `develop` and this phase modifies its code directly: `SavedPostsScreen`, the search screens and `UnsupportedTabNotice` all originate there.

Branching from `develop` would have produced a branch with nothing to build on.

**Belongs to:** whoever merges these branches. The previous phase should land in `develop` before this one.

### 10. The backend working tree was already dirty

`git status` in the backend repository shows a staged `Makefile` addition that predates this phase.

Not created, modified or removed here. See `README.md`.

**Belongs to:** the backend repository owner.

### 11. Pre-existing seed rows point at an unresolvable host

Four media assets in the bulk dataset reference `https://cdn.example.invalid/...`, producing `ERR_NAME_NOT_RESOLVED` console entries on any profile that renders them.

Network failures on image loads, not render errors, and not produced by any change here.

**Belongs to:** a data cleanup task.
