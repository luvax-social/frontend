# Changes Applied

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

One entry per change: what was wrong or missing, the evidence, what changed, and the file.

## 1. The saved list stopped paging on an empty page and claimed the viewer had saved nothing

**Wrong.** `SavedPostsScreen` rendered "nothing saved yet." whenever the accumulated row list was empty, and rendered the infinite-scroll sentinel only in the branch where at least one row exists.

**Evidence.** Read directly in the shipped file. An empty first page with `hasNextPage: true` shows the empty notice and never mounts the sentinel, so `fetchNextPage` is never triggered and pagination is dead. The backend states the saved endpoint has always been able to answer a short or empty page while further pages exist.

**Changed.** Added `useDrainEmptyPages`, which advances the query while the accumulated row count is zero and the server still reports a next page, driving the fetch from row count rather than from a viewport sentinel. The empty state is now gated on the server's `hasNextPage`, and a draining list renders the loading state instead.

**Files.** `src/features/luvax/hooks/useDrainEmptyPages.js` (new), `src/features/luvax/components/SavedPostsScreen.jsx`.

## 2. The liked posts endpoint had no client

**Missing.** `GET /posts/liked` existed on the server with no service function, no hook and no surface.

**Evidence.** Verified shape against the running server. Rows are `{post, likedAt}`, mirroring saved's nesting but not its timestamp field, which is `savedAt`.

**Changed.** Added `getLikedPosts` and `useLikedPosts`. The hook takes an `enabled` flag so it does not fire on profiles where the tab is not offered.

**Files.** `src/services/post.service.js`, `src/features/luvax/hooks/usePosts.js`.

## 3. A profile's posts could not be filtered by type

**Missing.** `GET /posts/user/{userId}` accepts `type`, and the client never sent it.

**Evidence.** Declared in the OpenAPI document and verified by probing each value. Accepted set is `image`, `video`, `carousel`, `text`, case insensitive.

**Changed.** `getUserPosts` takes a `type` value and joins multiple values into the comma form. `useUserPosts` takes a `types` array and puts it in the query key.

**Files.** `src/services/post.service.js`, `src/features/luvax/hooks/usePosts.js`.

## 4. An array of types would have failed every request

**Wrong, and it would have been introduced by this phase.** Axios serialises an array as `type[]=image`. That endpoint rejects unrecognised parameters, and `type[]` is not `type`.

**Evidence.**

```
GET /api/v1/posts/user/{id}?type%5B%5D=image
400 {"code":"BAD_REQUEST","message":"Unsupported query parameter: type[]. Accepted: cursor, limit, type"}
```

**Changed.** The service joins the values itself, so an array can never reach the wire in bracket form whatever a caller passes.

**File.** `src/services/post.service.js`.

## 5. `useUserPosts` forwarded arbitrary parameters into a strict endpoint

**Wrong.** The hook spread a caller-supplied `params` object into the query string. Since that endpoint now rejects anything it does not declare, any stray key would turn into a 400.

**Evidence.** No caller passed anything, so nothing was failing. It is a latent fault rather than a live one.

**Changed.** The open parameter bag is gone. The hook takes a types array and an `enabled` flag, and nothing else reaches the query string.

**File.** `src/features/luvax/hooks/usePosts.js`.

## 6. A cursor could be replayed across a tab switch

**Missing.** A cursor is bound to the filter that produced it, and replaying one under a different filter returns 400.

**Evidence.** Verified: a cursor from `type=image` replayed under no filter, under `type=image&type=carousel`, and under `type=video` all returned `400 INVALID_CURSOR`. Reordering the same set returned 200.

**Changed.** The type filter is part of the React Query key, so a filter change is a different query and starts from a null cursor. Replaying a foreign cursor is unrepresentable rather than merely avoided.

**File.** `src/features/luvax/hooks/usePosts.js`.

## 7. Follow state was remembered locally and could not represent a pending request

**Wrong.** `ProfileScreen` derived whether the viewer followed the account by fetching the viewer's entire following list and scanning it into a `useState`, then flipped that state optimistically on click.

**Evidence.** Read in the shipped file. It cannot represent a pending request at all, which is the state a private account returns. It also goes stale as soon as the relationship changes anywhere else, and the optimistic flip had no rollback.

**Changed.** Follow state reads `viewerState.isFollowing` and `viewerState.isFollowRequested` from the profile response. The button reads `follow`, `requested` or `following`. The whole following-list query and the local state are gone.

**File.** `src/features/luvax/components/ProfileScreen.jsx`.

## 8. Private accounts had no state

**Missing.** A private account rendered as an ordinary profile with no posts and three counts showing `0`.

**Evidence.** The three counts arrive as `null`, not zero, and posts, followers and following all answer 403 to a non-follower.

**Changed.** A non-follower now sees a private notice instead of tabs and a grid, worded differently depending on whether a request is pending. Null counts render `-` and are not clickable. The post query is disabled, so the three certain-to-fail requests are not issued.

**File.** `src/features/luvax/components/ProfileScreen.jsx`.

## 9. Block was not reachable from the profile

**Missing.** Blocking required finding one of the account's posts and using the post overflow menu. The profile had no overflow menu at all.

Note: the task described the profile menu as containing only a report action. There was no menu on the profile screen. Report and block both live in `PostCard`.

**Changed.** Added an overflow menu to the profile with block, unblock and report. Blocking opens a confirmation. Unblocking does not, because it destroys nothing.

**Files.** `src/features/luvax/components/ProfileScreen.jsx`, `src/features/luvax/components/BlockConfirmDialog.jsx` (new).

## 10. A blocked profile would have rendered as a connection error

**Wrong, and it is the finding that changed the design.** Blocking makes the profile answer **404**, not a readable profile carrying `isBlocking: true`.

**Evidence.**

```
POST /social/block/{id}      -> 201
GET  /users/{id}             -> 404 NOT_FOUND
GET  /users/{random uuid}    -> 404 NOT_FOUND
```

So `viewerState.isBlocking` is never observable for an account the viewer has blocked, and a blocked account is indistinguishable from a nonexistent one by status. The screen would have shown "we couldn't load this profile. check your connection and try again." for something the viewer deliberately did.

**Changed.** The screen reads `GET /social/blocked` and answers the blocked case before the error case, naming the account from the blocked row since the profile cannot be read. It offers unblock inline.

**File.** `src/features/luvax/components/ProfileScreen.jsx`.

## 11. The block confirmation had to be accurate about irreversibility

**Evidence.** Ava and Dan followed each other. After block and then unblock, `isFollowing` and `isFollowedBy` were both false and Dan's counts had dropped to zero. The follows are destroyed and not restored.

**Changed.** The dialog states the four immediate consequences and closes with the irreversible one in an error-toned block. It does not say "you can always unblock".

**File.** `src/features/luvax/components/BlockConfirmDialog.jsx`.

## 12. The search empty state hedged because it could not tell two cases apart

**Wrong, though it was correct when written.** The post half read `no posts match "x"` followed by `or search is temporarily unavailable.`

**Evidence.** The page now carries `degraded`, beside `content` and `pageInfo` rather than inside `pageInfo`. Verified by stopping Elasticsearch: post search returned `degraded=true` with zero rows, while hashtag search, user search and feed stayed `false`.

**Changed.** Added `isPageDegraded`. The post half renders a distinct degraded state saying the search is temporarily unavailable and that this is not an empty result, and suggests retrying. The genuine empty state no longer hedges. The `ambiguousEmpty` prop is gone.

**Files.** `src/utils/helpers.js`, `src/features/search/components/SearchResultsEmpty.jsx`, `src/features/search/components/SearchScreen.jsx`.

## 13. The profile tabs rendered a placeholder for capabilities that now exist

**Changed.** `UnsupportedTabNotice` existed because neither a media filter nor a liked list was available. Both now are, so both tabs are real and the component was deleted.

**Files.** `src/features/luvax/components/UnsupportedTabNotice.jsx` (deleted), `src/features/luvax/components/ProfileScreen.jsx`.

## 14. A `lock` icon did not exist

**Changed.** Added a `lock` glyph in the same 24x24, 1.5-stroke style as the rest, as the design export directs when a glyph is missing, rather than importing a second icon set.

**File.** `src/components/ui/lx-icon.jsx`.

## 15 to 22. Fabricated data

Eight separate items removed. Each is documented with its evidence in `fabricated-data-removal.md`.

| | What | File |
|---|---|---|
| 15 | Invented conversations, with photographs of real people as avatars, reachable via "view profile" to an id that cannot exist | `src/features/messages/data/mockThreads.js` deleted, `MessagesScreen.jsx` replaced |
| 16 | Invented stories, and a viewer that invented a story for any unrecognised id | `constants/data.js`, `StoryScreens.jsx`, `FeedScreen.jsx` |
| 17 | Invented trending tags, numbered as a ranking, with a pointer cursor and no handler | `shell.jsx` |
| 18 | Invented explore topic chips that filtered nothing | `constants/data.js`, `ExploreScreen.jsx` |
| 19 | Invented bios attached to real accounts via a fallback string | `ExploreScreen.jsx` |
| 20 | Invented composer tag suggestions | `constants/data.js`, `ComposerScreen.jsx` |
| 21 | Invented onboarding interests, plus a promise to shape the feed that nothing could keep | `constants/data.js`, `OnboardingScreen.jsx` |
| 22 | Dead invented exports `PROFILE_POSTS`, `TRENDING`, `NOTIFS` | `constants/data.js` |

## 23. The messages tab presented a feature that is not in this build

**Changed.** The tab stays visible and is now disabled, using the design export's button disabled treatment, with a title explaining why. Applied to both the side rail and the bottom bar.

**File.** `src/features/luvax/components/shell.jsx`.
