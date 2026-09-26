# Changes Applied

> Record of work done on 2026-08-12. Not maintained; it is correct as of that date and is not updated as the code moves.

One entry per change: what was missing, the evidence, what was built, and the file touched.

## 1. No client for any of the three search endpoints

**What was missing.**
Three search endpoints existed on the backend and nothing in the frontend called two of them.
`/posts/search` was called only by the explore screen, which substitutes the literal term `a` when the field is blank in order to avoid a `400`.
`/users/search` and `/hashtags/search` had no caller at all.

**Evidence.**
`GET /posts/search?q=light` returns a cursor page of posts, `GET /users/search?q=luvax` returns a cursor page of accounts each carrying `viewerState`, and `GET /hashtags/search?q=obs` returns a cursor page of tags carrying `postCount`.
All three verified at runtime; see `endpoint-verification.md`.

**What was built.**
Three service functions sharing one parameter builder, each returning the response envelope for the caller to unwrap.

**File.** `src/services/search.service.js`, new.

## 2. No paginated query hooks for search

**What was missing.**
Nothing bound the search endpoints to the query cache, so no screen could page them.

**What was built.**
Three infinite query hooks over a shared factory, with a key per result type so the halves cache and page independently.
Each is disabled while the term is blank, because all three endpoints reject a blank `q` with `400 MISSING_REQUIRED_PARAMETER`.
Unlike the feed hooks, these do not poll on an interval or refetch on window focus, since reordering a result list under someone who is reading it is worse than showing a slightly stale one.

**File.** `src/features/search/hooks/useSearch.js`, new.

## 3. The search results screen did not exist

**What was missing.**
`ROUTES.SEARCH` was declared as `/app/search` and registered against no screen, so the address fell through to the in-shell not-found.
The user half of search could not be demonstrated at all.

**Evidence.**
`src/config/constants.js` carried the constant with a comment stating the screen did not exist yet.
`src/routes/appScreens.jsx` had no matching row.

**What was built.**
A screen with three result tabs over the three hooks.
The term lives in the address under `q` and the selected tab under `type`, so a search is shareable and survives a reload.
Input is debounced at 300ms before reaching the address.
Each half owns its own infinite-scroll sentinel, so one running out does not stop another.
People rows reuse the existing `UserCard` in its default mode, seeded from `viewerState.isFollowing`.

**Files.** `src/features/search/components/SearchScreen.jsx`, new. `src/routes/appScreens.jsx`, modified.

## 4. Empty and failure were not distinguishable on search

**What was missing.**
No treatment existed at all, and the naive one would have been wrong: post search returns an empty page rather than an error when its backend is unavailable.

**Evidence.**
Stopping the Elasticsearch container and repeating a query that had just returned a result produced a `200` with an empty content array, byte-identical to a genuine no-match apart from the timestamp.
The user search endpoint continued to return results during the same outage.

**What was built.**
Four distinct states per half: prompt, loading, failure, and empty.
Failure carries its own icon, copy, and the error colour.
The post half's empty copy covers both readings, because on that endpoint an empty response genuinely has two meanings.
The people and tags halves state the empty case plainly, because they do not degrade this way.

**File.** `src/features/search/components/SearchResultsEmpty.jsx`, new.

## 5. The header search led to the wrong screen

**What was missing.**
Submitting the header search navigated to the explore screen, since no results screen existed to send it to.

**What was built.**
The submit handler now navigates to `ROUTES.SEARCH`.
The explore screen's own `q` handling is untouched and still works, which the brief requires.

**File.** `src/features/search/components/LxHeaderSearch.jsx`, modified.

## 6. Nothing consumed the saved posts endpoint

**What was missing.**
`GET /posts/saved` existed and had no caller.
A user could save a post and had nowhere to find it.

**Evidence.**
`GET /posts/saved?limit=2` returns a cursor page whose rows are not bare posts: the post nests under `post` and the row adds `savedAt`.
This differs from the feed and from post search, which both return the post at the top level of the item.

**What was built.**
A service function, an infinite query hook at page size 12, and a screen reusing the profile grid treatment with rows unwrapped from `row.post`.

**Files.** `src/services/post.service.js`, modified. `src/features/luvax/hooks/usePosts.js`, modified. `src/features/luvax/components/SavedPostsScreen.jsx`, new.

## 7. Saving and unsaving did not keep the saved list current

**What was missing.**
`useSavePost` had no `onSuccess` and no access to the query client, so nothing invalidated anything.

**What was built.**
The mutation now invalidates the saved list on `onSettled`.
`onSettled` rather than `onSuccess`, because saving an already-saved post returns `409`, which means the post is in the target state rather than that anything failed.
This is what makes a post saved from the feed appear on the saved screen, and an unsaved post leave the list without a reload.

**File.** `src/features/luvax/hooks/usePosts.js`, modified.

## 8. There was no way to unsave from the saved screen

**What was missing.**
The obvious route, opening a saved post and unsaving from inside it, does not exist.
`PostDetailScreen` defines `handleSaveToggle` and never renders a control wired to it, so the post detail overlay has no save control at all.

**Evidence.**
Clicking through every button in the post detail action row left the server-side saved count unchanged at two.
`grep` for `handleSaveToggle` in that file returns the definition and no usage.

**What was built.**
A bookmark control on each saved tile that removes the post from the list, stopping event propagation so it does not also open the post.
The underlying `PostDetailScreen` gap was not fixed here and is recorded in `deferred-findings.md`.

**File.** `src/features/luvax/components/SavedPostsScreen.jsx`, new.

## 9. Saved posts had no route and no entry point

**What was built.**
`ROUTES.SAVED` at `/app/settings/saved`, a row in the router, and a "saved" row in the settings account section beneath "change password".
The reasoning for that placement, and the two alternatives rejected, are in `design-decisions.md`.

**Files.** `src/config/constants.js`, modified. `src/routes/appScreens.jsx`, modified. `src/features/luvax/components/SettingsScreen.jsx`, modified.

## 10. The profile tab state never reached the grid

**What was missing.**
Three tabs were rendered and the selected tab reached only the foreground colour and the underline.
The grid mapped over the same posts whatever was selected, so `photos` listed text-only posts and `liked` listed the author's own posts.

**Evidence.**
Selecting `photos` on Ben's profile left the grid identical, still listing all three of his posts including one with no media.

**What was built.**
The grid is now gated on the selected tab.
`posts` keeps its existing query, pagination, and error treatment unchanged.
The other two render a notice.
The pagination sentinel is gated too, so an unsupported tab cannot trigger a page fetch for a list it is not showing.

**File.** `src/features/luvax/components/ProfileScreen.jsx`, modified.

## 11. Two profile tabs have no backing capability

**What was missing.**
No server-side media filter and no liked-posts collection exist.

**Evidence.**
`GET /posts/user/{id}` with `mediaType=IMAGE`, `hasMedia=true`, and `postType=image` each returned the identical unfiltered list of three text posts with `200`.
Unrecognised parameters are silently ignored.
Four candidate liked-posts addresses returned `404`, `404`, `404`, and a `400` caused by the word `liked` failing to parse as a post id.

**What was built.**
A notice component rendering a derived unavailable state for each tab.
It does not claim the list is empty, because that would assert a fact about data nobody has, and it does not imply a fault, because nothing is broken.
No client-side filtering was added; the reasoning is in `design-decisions.md`.
A handover document was written for the backend team.

**Files.** `src/features/luvax/components/UnsupportedTabNotice.jsx`, new. `docs/search-saved-and-tabs/backend-requests.md`, new.

## 12. A stale comment in the route constants

**What was missing.**
`ROUTES.SEARCH` carried a comment stating the screen did not exist and no route was registered.
Building the screen made that untrue.

**What was built.**
The comment now describes what the address carries.

**File.** `src/config/constants.js`, modified.

## Not in this branch

The seed script repair is part of the same brief and lands separately.

The code here came to 816 lines and adding the seed would have crossed the thousand line target the brief sets.

The seed shares no code with these surfaces and is already a separate commit scope.
