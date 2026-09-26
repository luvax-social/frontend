# Feature Gap Matrix

> Record of work done on 2026-08-01. Not maintained; it is correct as of that date and is not updated as the code moves.

One row per capability.

**Classification** is one of:

- `backend-missing` - the backend does not support it.
- `frontend-missing` - the backend supports it and the frontend does not call it.
- `contract-mismatch` - both sides exist but disagree, so the call fails or produces the wrong
  result.
- `design-missing` - the design export defines no treatment for it.
- `none` - complete on all three sides.

Where more than one applies the most blocking one is listed first.

**Demo impact** refers to the scenario in `demo-readiness.md`.

## Posts

| Capability | Backend | Frontend | Design | Classification | Demo impact |
|-----------|---------|----------|--------|----------------|-------------|
| View a feed of real posts | Yes, `GET /posts/feed`, cursor-paginated, excludes the viewer's own posts | Yes, `useFeed` infinite query | Yes, `FeedScreen` | none | Step 2 works, but only after the viewer follows someone. An unfollowed account sees an empty feed |
| Create a text post | Yes, `POST /posts` | Yes, `useCreatePost` | Yes, `ComposerScreen` | none | Not in the scenario, needed by the seed |
| Create a post with media | Yes, three-step pre-signed R2 flow | Yes, `useMediaUpload` plus `useCreatePost` | Media is an undesigned coloured rectangle | design-missing | Not in the scenario |
| Open post detail | Yes, `GET /posts/{id}` | Yes, `usePostDetail` | Design uses `CommentModal` overlay, frontend uses a screen | design-missing on the modal | Step 5 works, but through the wrong surface |
| Like a post | Yes, returns `{postId, liked, likeCount}`. 409 on duplicate. Self-like allowed | Yes, `useLikePost` | Yes, but heart colour `#D15B5B` vs `var(--lx-error)` | design-missing on the exact colour | Step 3 works |
| Unlike a post | Yes | Yes | Yes | none | Step 3 works |
| Save a post | Yes, 201 then 409 on duplicate | Yes, `useSavePost` | Yes, bookmark icon | none | Step 4 works |
| List saved posts | Yes, `GET /posts/saved` | **No service, no hook, no screen** | No screen in the export | frontend-missing, design-missing | Not in the scenario, but a saved post the user cannot find later is a weak demo |
| List post likers | Yes, `GET /posts/{id}/likes` with `viewerState` per row | **No service** | No screen | frontend-missing, design-missing | Not in the scenario |
| Edit own post | Yes, `PATCH /posts/{id}`, caption only, 403 for a non-owner | Yes, `useUpdatePost` | Inline edit sheet exists in `PostCard.jsx` | none | Step 19 works |
| Delete own post | Yes, `DELETE /posts/{id}`, soft, 204, 403 for a non-owner | Yes, `useDeletePost` | `ConfirmModal` exists in the export | none | Step 20 works |
| Archive or restore a post | Yes, `PATCH /posts/{id}/status` with `{targetStatus}` | Service sends `{status}` and gets **400** | **contract-mismatch** | Not in the scenario. Dead on arrival if used |
| Post edit history | Yes, `GET /posts/{id}/history` | **No service** | No screen | frontend-missing, design-missing | Not in the scenario |
| Live post like count | **Not broadcast on any topic** | n/a | n/a | backend-missing | Realtime decision is half unworkable; see `open-decisions.md` |

## Comments

| Capability | Backend | Frontend | Design | Classification | Demo impact |
|-----------|---------|----------|--------|----------------|-------------|
| Add a comment | Yes, `POST /posts/{id}/comments`, supports `Idempotency-Key` | Yes, `useCreateComment`, sends no idempotency key | Yes, `CommentsSheet` and `CommentModal` | none | Step 6 works |
| Reply to a comment | Yes, via `parentId`, depth 0 to 10 | Yes, same hook with `parentId` | `CommentRow` takes a `depth` prop | none | Step 7 works |
| List top-level comments | Yes, newest first with a pinned top-3-by-likes block on page one | Yes, `useTopLevelComments` | Yes | none | Step 5 works |
| List replies | Yes, `GET /comments/{id}/replies`, chronological, one level per call | Yes, `useCommentReplies` | Yes | none | Step 7 works |
| Render the `pinned` flag | Yes, `pinned: true` on up to 3 comments | Ignored | **No treatment anywhere in the export** | design-missing | Comments will appear in a confusing order with no explanation |
| Like a comment | Yes, `POST /comments/{id}/like`. **403 on your own comment.** No counter in the response | **No service, no hook, no UI** | Like affordance present, colour `#D15B5B` | **frontend-missing** | **Step 8 impossible** |
| Unlike a comment | Yes | **No service** | Yes | **frontend-missing** | Step 8 impossible |
| Edit own comment | Yes, `PATCH /comments/{id}`, 403 for a non-owner. No edit history | **No service, no hook, no UI** | Menu affordance in `LxMenu` | **frontend-missing** | **Step 9 impossible** |
| Delete own comment | Yes, `DELETE /comments/{id}`, soft-deletes the whole subtree | **No service, no hook, no UI** | `LxMenu` plus `ConfirmModal` | **frontend-missing** | **Step 10 impossible** |
| Sort comments by like count | Only implicitly, via the pinned block, top 3, page one, top-level only, needs at least one like. **No sort parameter** | n/a | n/a | backend-missing as an explicit control | Not in the scenario |
| Live new comments | Yes, `/topic/comments.{postId}.events` | **No WebSocket client at all** | n/a | frontend-missing | Realtime decision's workable half |
| Live comment like changes | Yes, `comment.liked.v1` and `comment.unliked.v1` | **No WebSocket client** | n/a | frontend-missing | Realtime decision's workable half |

## Social

| Capability | Backend | Frontend | Design | Classification | Demo impact |
|-----------|---------|----------|--------|----------------|-------------|
| View another user's profile | Yes, `GET /users/{id}` with `viewerState` | Yes, `useUserProfile` | Yes, `ProfileScreen` | none | Step 13 works |
| View another user's posts | Yes, `GET /posts/user/{id}` | Yes, `useUserPosts` | Yes, posts tab | none | Step 15 works |
| Follow | Yes, 201, status `accepted` or `pending` | Yes, `useFollow` | Follow button present | none | Step 14 works |
| Unfollow | Yes, 204 | Yes, `useUnfollow` | Present | none | Not in the scenario |
| Followers list | Yes, `viewerState` per row | Yes, `FollowersScreen.jsx` | **No screen in the export** | design-missing | Not in the scenario |
| Following list | Yes | Yes, `FollowingScreen.jsx` | **No screen** | design-missing | Not in the scenario |
| Private account | Yes, `PATCH /users/me` with `isPrivate`. Non-follower sees null counts | `useUpdateMyProfile` can send it; no UI state for viewing a private profile | **No screen or state** | frontend-missing, design-missing | Not in the scenario |
| Follow request lifecycle | Yes, `GET /social/follow-requests`, `PATCH .../approve`, `.../reject` | Yes, all three hooks, surfaced in `NotificationsScreen` | **No screen** | design-missing | Not in the scenario |
| Block | Yes, 201. Auto-unfollows both directions, removes from feed, search, and profile | `useBlock`, but it **swallows API errors and writes the result to `localStorage`** | `LxMenu` block affordance | **contract-mismatch** | Step 16 partially works |
| Unblock | Yes, 204. Does not restore follows | `useUnblock`, same localStorage pattern | Present | **contract-mismatch** | Step 18 partially works |
| Blocked users list | Yes, `GET /social/blocked`, the **only** surface where a blocked user is visible to the blocker | `BlockedUsersScreen.jsx` reads **`localStorage`**, never the endpoint | **No screen** | **contract-mismatch**, design-missing | Step 18 works only in the browser that performed the block |
| Report a user | Yes, `reportType: "user"` | **No service** | `ReportModal` with `entityLabel` "account" | **frontend-missing** | Not in the scenario |
| Suggested users | **No such endpoint. `GET /users/suggestions` returns 400** | `useSuggestedUsers` calls it from the right rail | Right rail is hardcoded mock | **contract-mismatch** | A permanently failing request on every feed and explore view |

## Search

| Capability | Backend | Frontend | Design | Classification | Demo impact |
|-----------|---------|----------|--------|----------------|-------------|
| Search posts | Yes, `GET /posts/search`, Elasticsearch, stemmed, degrades to empty on outage | Yes, but only as `getExplorePosts` feeding the Explore grid | `LxHeaderSearch` exists | frontend-missing as a search-results surface | **Step 12 partial** |
| Search users | Yes, `GET /users/search`, `viewerState` per row, block-filtered | **No service** | No results screen | **frontend-missing** | **Step 12 impossible for the user half** |
| Search hashtags | Yes, `GET /hashtags/search` | **No service** | No screen | frontend-missing, design-missing | Not in the scenario |
| Trending hashtags | Yes, `GET /hashtags/trending` with rank and period | **No service** | No screen | frontend-missing, design-missing | Not in the scenario |
| Combined post and user results | **No combined endpoint.** Two requests required | n/a | No results screen | backend-missing as one call, design-missing | Step 12 needs a composed screen |

## Reporting

| Capability | Backend | Frontend | Design | Classification | Demo impact |
|-----------|---------|----------|--------|----------------|-------------|
| Report a post | Yes, 8 reasons, duplicate guard returns 409 | **No service, no hook, no UI** | `ReportModal`, 3 steps, reasons match the enum exactly | **frontend-missing** | **Step 11 impossible** |
| Report a comment | Yes | **No service** | `ReportModal` | frontend-missing | Not in the scenario |
| Report a user | Yes | **No service** | `ReportModal` | frontend-missing | Not in the scenario |
| See what I have reported | **No endpoint. `GET /reports` is 403 for a regular user** | n/a | `ReportModal` step 3 confirmation and an `onSubmitted` callback | backend-missing | The UI can only remember a submission locally within the session |

## Media

| Capability | Backend | Frontend | Design | Classification | Demo impact |
|-----------|---------|----------|--------|----------------|-------------|
| Pre-signed upload URL | Yes, real Cloudflare R2, 600s expiry | Yes, `mediaService.createUploadUrl` | n/a | none | Not in the scenario |
| Direct PUT to storage | Client responsibility | Yes, raw `axios.put`. Sends `Content-Type` but not the `content-length` in `requiredHeaders` | n/a | none in practice; the browser sets it | Not in the scenario |
| Register the asset | Yes, **no server-side object inspection** | Yes | n/a | none | Not in the scenario |
| Render post media | `cdnUrl`, `width`, `height`, `blurhash` all returned | Rendered | **Coloured rectangle only. Real aspect ratios and `blurhash` are undesigned** | design-missing | Not in the scenario |

## Cross-cutting

| Capability | Backend | Frontend | Design | Classification | Demo impact |
|-----------|---------|----------|--------|----------------|-------------|
| Viewer state without an N+1 fan-out | Yes. `isLiked`, `isSaved`, `viewerState` on every relevant DTO | Consumed | n/a | none | Removes the concern the audit was asked to quantify |
| Deep-linkable URLs | n/a | **No. The whole app is one route, `/app`, with `screen` in `useState`** | n/a | frontend-missing | Every step is affected: no back button, no refresh, no shareable link |
| Loading, empty, error states | n/a | Partial. Feed has both, most screens have neither | **None defined anywhere in the export** | design-missing | Any slow or failed step shows nothing |
| Null counts on a private or anonymous profile | Returns `null` for the three counts | Not handled | Undesigned | frontend-missing, design-missing | Not in the scenario |
| Self-like forbidden on comments | 403 `COMMENT_FORBIDDEN` | n/a, no comment like UI | Undesigned | design-missing | Will bite as soon as comment likes are built |
| Email verification to create an account | Required, and unresolvable through the API locally | n/a | n/a | backend-missing as an API-only path | Blocks any pure-API account provisioning. See `seed-data.md` |

## Out-of-scope modules, for reference

Not being built, but the navigation references them and the settled decision is to render their
tabs disabled.

| Module | Backend | Frontend | Design |
|--------|---------|----------|--------|
| Notifications | Implemented, verified 200, populated asynchronously, WebSocket topic available | Implemented and live | `NotificationsScreen`, `NotifRow` |
| Stories | Implemented, `GET /stories/feed` verified 200 | Mock only, `STORIES` array | `StoryViewScreen`, `StoryComposerScreen`, `StoriesCarousel` |
| Messages | Implemented, `GET /conversations` verified 200 | Mock only, `THREADS` array | `MessagesScreen`, `ConvRow`, `ConvOptionsMenu`, `MsgMenu` |
| Settings | Implemented, `GET`/`PATCH /users/me/settings` | Partially wired; some toggles read localStorage | `SettingsScreen`, `SettingsRow`, `Toggle` |
| Onboarding | No endpoint | Mock only | `OnboardingScreen` |
| Admin and moderation | 13 endpoints implemented | None | None |

Stories and messages are the notable ones: **the backend implements them and the frontend shows
mock data**, so those tabs are not empty shells for lack of a backend.
