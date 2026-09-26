# Verification Evidence

> Record of work done on 2026-08-12. Not maintained; it is correct as of that date and is not updated as the code moves.

Every surface exercised in a real browser with dev tools attached.

Frontend at `http://localhost:5173`, backend at `http://localhost:8080/api/v1`, both running with seed data loaded.

Signed in as `luvax_ava` unless stated otherwise.

Observed on 2026-08-12.

## Coverage summary

| Surface | Populated | Empty | Loading | Failure | Pagination |
|---------|-----------|-------|---------|---------|------------|
| Search, posts | yes | yes | yes | yes | yes, page 3 |
| Search, people | yes | yes | yes | yes | yes, page 3 |
| Search, tags | yes | yes | yes | yes | not reachable, see note |
| Saved posts | yes | yes | yes | yes | yes, page 2 |
| Profile, posts tab | yes | not reachable, see note | yes | yes | existing behaviour, unchanged |
| Profile, photos tab | not applicable | not applicable | not applicable | not applicable | not applicable |
| Profile, liked tab | not applicable | not applicable | not applicable | not applicable | not applicable |

The `photos` and `liked` tabs have a single derived state, because there is no request to be in flight, to fail, or to return rows.

That state is exercised below.

## A note on the account used

The first attempt at the follow-control check was run while the browser happened to be signed in as `luvax_mira`, an account that follows nobody.

Every row correctly read "follow", which is indistinguishable from the bug being checked for.

The check was re-run as `luvax_ava`, who follows two of the four accounts, so that a correct result and a hardcoded label produce different output.

This is recorded because the first observation would have been worthless as evidence either way.

## Search: populated

`/app/search?q=luvax`, posts tab.

```
posts | people | tags
[luvax-seed] my own post, editable and deletable in the demo #luvax
[luvax-seed] morning, window, coffee #photography
[luvax-seed] grain on film is the texture of memory #film
[luvax-seed] light is the medium, not the message #observation
[luvax-seed] this disappears from the feed once dan is blocked #recon
```

`/app/search?q=obs&type=tags`:

```
posts | people | tags
#observation
1 post
```

## Search: the follow control reflects the real relationship

`/app/search?q=luvax&type=people`, signed in as Ava.

```
Luvax Ben   @luvax_ben    [following]
Luvax Dan   @luvax_dan    [following]
Luvax Cleo  @luvax_cleo   [follow]
luvax_mira  @luvax_mira   [follow]
```

This matches the seed graph.

Ava and Ben follow each other, Ava and Dan follow each other, Ava's follow of Cleo is still pending because Cleo is private, and Ava has no relationship with Mira.

Mixed states in a single list is the evidence: a hardcoded label could not produce two different values in the same render.

The state is read from `viewerState.isFollowing` on each row.

## Search: empty, and how it differs from failure

Empty, people half, `/app/search?q=zzzznotarealterm&type=people`:

```
no people match "zzzznotarealterm"
```

Empty, posts half, `/app/search?q=zzzznotarealterm&type=posts`:

```
no posts match "zzzznotarealterm"
or search is temporarily unavailable.
```

Failure, people half, with `**/users/search*` aborted at the network layer:

```
we couldn't search people.
check your connection and try again.
```

The two are different copy, a different icon, and a different colour.

The post half carries the extra line because post search returns an empty page rather than an error when Elasticsearch is down, so an empty response there genuinely has two meanings.

That behaviour was verified directly by stopping the container; see `endpoint-verification.md`.

## Search: loading

With `**/posts/search*` delayed by three seconds, measured 900ms after navigation:

```
posts | people | tags
searching posts...
```

After the delay elapsed, the populated grid rendered.

## Search: the halves are independent

With `**/users/search*` still blocked, the posts tab was opened on the same term.

```
posts | people | tags
[luvax-seed] my own post, editable and deletable in the demo #luvax
[luvax-seed] morning, window, coffee #photography
[luvax-seed] grain on film is the texture of memory #film
```

One half failing does not affect the others.

## Search: pagination past the first page

The seed creates fewer rows than one page, so pagination could not be exercised against it.

Rather than skip the check, the rows were created: 25 posts carrying the term `paginationprobe` and 25 accounts prefixed `pageprobe_`.

The script that created them is throwaway and lives in `.workspace/tmp/`, deliberately not added to the seed.

It creates only and deletes nothing.

Post half, `/app/search?q=paginationprobe`:

- Tiles after first paint: 10
- Tiles after scrolling to the end: 25

Requests captured:

```
/posts/search?q=paginationprobe&limit=10
/posts/search?q=paginationprobe&cursor=MTA&limit=10
/posts/search?q=paginationprobe&cursor=MjA&limit=10
```

People half, `/app/search?q=pageprobe&type=people`:

- Rows rendered: 25

Requests captured:

```
/users/search?q=pageprobe&limit=10
/users/search?q=pageprobe&cursor=MTA&limit=10
/users/search?q=pageprobe&cursor=MjA&limit=10
```

Both halves fetched three pages.

The people half reached all 25 rows before the first measurement because its sentinel was already in view, so the request log rather than a row count is the evidence there.

Tags could not be paged: the whole database contains six hashtags, which is under one page, and inventing hashtags purely to force a third pagination path was not worth the data it would leave behind.

The tags half uses the same hook, the same cursor helper, and the same sentinel as the two halves that were proven, so this is a gap in evidence rather than a gap in implementation, and it is recorded as such.

## Search: the term survives a reload and can be shared

`/app/search?q=luvax&type=people` was opened directly as a cold navigation, not reached by typing.

It rendered the people results for `luvax` with the people tab selected.

Selecting a different tab updates the address to match, so the address always describes what is on screen.

Typing writes the term to the address after the debounce: after typing `silence`, the address became `/app/search?type=tags&q=silence`.

## Search: debounce

With a request counter attached to `/hashtags/search`, the term `silence` was typed one character at a time with a 60ms delay between keystrokes.

Requests issued: **1**.

Seven keystrokes produced one request.

## Search: reached from the header

From the feed, typing `film` into the header search field and pressing Enter navigated to `/app/search?q=film` and rendered the matching post.

The explore screen's own `q` handling was checked separately and still works: `/app/explore?q=film` renders its existing inline results view unchanged.

## Saved posts: reachable, and populated

Settings, account section:

```
ACCOUNT
edit profile
change password
saved            posts you bookmarked
email            luvax_ava@example.com
```

Selecting it navigates to `/app/settings/saved` and lists Ava's saved posts.

## Saved posts: unsaving removes the row without a reload

Starting state: 2 tiles.

The bookmark control on the first tile was clicked.

Ending state: 1 tile, with the removed post gone from the list.

```
saved
[luvax-seed] morning, window, coffee #photography
```

No navigation occurred.

The page's navigation entry remained the original load throughout, so the row was removed by the list re-reading itself rather than by a reload.

## Saved posts: empty

After unsaving the last remaining post:

```
saved
nothing saved yet.
tap the bookmark on a post to keep it here.
```

## Saved posts: saving elsewhere makes it appear here

From the empty state, a post was saved from the feed using the bookmark control on a feed card.

Returning to `/app/settings/saved`:

```
saved
[luvax-seed] this disappears from the feed once dan is blocked #recon
```

## Saved posts: loading and failure

Loading, with `**/posts/saved*` delayed three seconds:

```
saved
loading your saved posts...
```

Failure, with `**/posts/saved*` aborted:

```
saved
we couldn't load your saved posts.
check your connection and try again.
```

## Saved posts: pagination past the first page

Ava's two original seed saves were restored and 20 probe posts were saved, giving more than one page at a page size of 12.

- Tiles after first paint: 12
- Tiles after scrolling to the end: 23

Requests captured:

```
/posts/saved?limit=12
/posts/saved?cursor=c2F2OjE3ODY1Mjk1ODcxMzgyMzQ6ZDNmZDE0OWEtYzMyNy00ZDFjLWJkODgtNzQzOWMyYTM4YzY5&limit=12
```

## Profile tabs: each tab now shows a different result

Ben's profile, `/app/u/f70f7348-2a43-470e-a60d-c037cd4e6748`.

`posts`, 3 tiles:

```
[luvax-seed] grain on film is the texture of memory #film
[luvax-seed] morning, window, coffee #photography
[luvax-seed] light is the medium, not the message #observation
```

`photos`, 0 tiles:

```
photo-only posts aren't available yet.
this view needs a way to ask for a profile's posts that carry media, which the server does not offer yet.
```

`liked`, 0 tiles:

```
liked posts aren't available yet.
this view needs a way to ask for the posts an account has liked, which the server does not offer yet.
```

Back to `posts`, 3 tiles, unchanged.

This is the specific defect fixed.

Before this change, selecting `photos` left the identical grid on screen, text-only posts included.

## Profile tabs: switching does not refetch

A request counter was attached to `/posts/user/`.

The profile was loaded, then posts, photos, liked, and posts were selected in turn.

Total requests to the user posts endpoint: **1**.

```
/posts/user/f70f7348-2a43-470e-a60d-c037cd4e6748?limit=10
```

The cached result served every return to the `posts` tab.

## Console

Dev tools were open throughout.

No React render error appeared on any surface touched.

The only errors logged were the network requests deliberately blocked during the failure checks, plus the application's own query error handler reporting those same blocked requests:

```
Failed to load resource: net::ERR_FAILED  .../users/search?q=luvax&limit=10
[QueryClient] Unable to reach the server. Please check your connection.
```

Both are the expected consequence of aborting the request on purpose.

The query error handler logging expected outcomes as errors is on the list of things this phase does not address.

## Build

`npx vite build` completes with no errors after every change.

The only warning is the pre-existing chunk size notice, unchanged from before this work.

## Data left behind

Nothing was deleted.

Created during verification and intentionally left in place, since the brief forbids deleting and these are harmless:

- 25 posts by `luvax_ava` whose captions contain `paginationprobe`
- 25 accounts named `pageprobe_00` through `pageprobe_24`
- 20 additional saved-post rows for `luvax_ava`, pointing at those probe posts

Ava's two original seed saves were unsaved during the unsave and empty-state checks and were then restored.

The accounts the backend team created for administrative testing were not touched.
