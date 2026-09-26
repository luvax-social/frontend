# Re-Verification

> Record of work done on 2026-08-14. Not maintained; it is correct as of that date and is not updated as the code moves.

Six phases were merged into a tree none of them were written against.
This document records what was exercised in the running application after the merge, feature by feature.
Each item states what was done and what was observed.

The whole stack was run for this: PostgreSQL, Redis, RabbitMQ, Mailpit and Elasticsearch in Docker, the Spring Boot backend on `:8080`, and the Vite dev server on `:5173`.
The browser work was driven through Playwright against the merged frontend.
Two seed accounts were used: `luvax_ava` as the viewer in the browser, and `luvax_ben` and `luvax_dan` as the other actors, driven through the API to produce events "from elsewhere".
Passwords for the seed accounts were set through the application's own forgot-password flow, read back from Mailpit, so no credential was invented and no database row was hand-edited to log in.

The items are grouped by how they were confirmed: exercised in a browser, confirmed at the API in support of a browser check, and not exercised.

## Verified in a browser

### Lineage A

#### Search

Searched `luvax` from the results screen.
The screen has three result kinds as tabs: posts, people and tags.
Posts returned a matching post.
People returned Luvax Ben, Luvax Cleo and Luvax Dan.
Tags returned `#luvax`.
The follow control on a person shows the real relationship: Ben read "following", Dan read "follow".
The selected kind lives in the address: switching to people changed the URL to `?q=luvax&type=people`, so a search can be shared and reloaded.
One gap, recorded in deferred-findings and not caused by the merge: the people follow control reads only `isFollowing`, so Cleo, to whom the viewer had a pending request, read "follow" rather than "requested".

#### Saved posts

Opened `/app/settings/saved` from the account section.
It listed the viewer's two saved posts.
Removed one with its bookmark control.
The row disappeared immediately, the other row stayed, and no reload happened.
This is the combined save resolution working: the optimistic flag plus the saved-list invalidation.

#### Profile tabs

Opened the viewer's own profile.
Three tabs: posts, photos and liked.
Each fired its own request: posts to `/posts/user/{id}`, photos to `/posts/user/{id}?type=image,carousel`, liked to the dedicated `/posts/liked`.
Each showed a different result: posts included the text post and the video, photos dropped both and showed only image and carousel posts, liked showed the single post the viewer had liked.
On another account, Dan's profile, only posts and photos were offered, with no liked tab.
The comma-joined type filter confirms A's backend-contract version of the hook survived, and the dedicated liked endpoint confirms A's implementation was the one kept.

#### Profile tabs and the conformance styling

The profile grid rendered B's `MediaThumb`, ported onto A's screen: media tiles showed the picture, carousel posts carried an item-count badge, the video showed as a video thumbnail, and the text post showed a caption tile rather than a blank square.
This is the Rule 2 styling port confirmed on the surface where it was most at risk.

#### Block from the profile, the full loop

Opened Dan's profile, opened the overflow menu.
The menu carried both a block action and a report action, which is the combined menu resolution: A's block loop and B's real report in one menu.
Chose block; the confirmation dialog appeared with its wording intact, including that unblocking does not restore the follows it removes.
Confirmed the block.
Returned to the feed: Dan's post and name were gone, Ben's posts remained.
Opened the blocked list under settings: it showed one blocked user, Dan.
Unblocked him there; the row disappeared without a reload.
Reopened Dan's profile: it was readable again, and the follow control read "follow" rather than "following", which is correct because the block removed the follow edge.

#### Private accounts

Opened Cleo's profile, a private account the viewer does not follow.
The name carried a lock, the follow control read "requested" because a request was pending, the three counts rendered as a placeholder rather than a number, and the body said the account is private and the request is waiting.
This is A's private treatment and `renderCount` placeholder, both kept in the resolution.

#### Follow requests

Made the viewer private, then had Dan request to follow through the API.
The notifications screen showed "Luvax Dan requested to follow you" with accept and decline controls, and a dedicated requests tab.
Accepted it: the follow row moved to accepted in the database.
Had Dan withdraw and request again, then declined it: the follow row was removed.
Both halves of the control work end to end.

#### Realtime

Opened a post's detail.
The realtime client connected: the page made a SockJS handshake to `/ws/comments/info` carrying the viewer's token, after loading the STOMP and SockJS clients.
Had Ben create a comment through the API: it arrived in the open screen without a reload, at the bottom, and the pinned top-comment block did not reorder.
Had Ben edit that comment: the text changed live and the comment gained an edited marker.
Had Ben unlike a pinned comment: its like count dropped from one to zero live.
Had Ben delete his comment: it disappeared live.
Had Ben like the post: the post like count moved live from two to three.
The comment count moved live from fourteen to fifteen when Ben's comment arrived.

### Lineage B

#### Carousel viewing

Opened a three-item carousel on post detail.
It showed one item at a time with a counter reading 1/3, a next arrow, and, once past the first item, a previous arrow.
The arrows advanced the counter.
The left and right arrow keys advanced it too, once the media had focus, reaching 3/3 where only the previous arrow remained.

#### Media rendering

On the profile grid, a video was a video thumbnail rather than a blank square, carousel posts carried their item count, and a text post was a caption tile.
On the feed, the video post rendered as a real video player, muted, with its box already reserved before it loaded.

#### Composer

Opened the composer.
There are no type tabs.
The dropzone names the accepted formats, the maximum video length and the size ceiling, read from the server: gif, jpeg, png, webp, mp4, quicktime and webm, 180 seconds, 100MB, which is the server's set and not the old hardcoded mp4-only, 60 second, 50MB text.
Selected three images in one selection.
Each showed as its own thumbnail with a position, a remove control, and reorder arrows, with the earlier arrow disabled on the first and the later arrow disabled on the last.
The post button named the kind: "post carousel of 3".
Reordered the first image to second; the thumbnails reordered.
Posted.

#### The composer and the carousel

The post created through the composer was opened afterward.
It rendered as a carousel, and the items were in the order the composer showed after the reorder: the first item was the image that had been moved to the front, the second was the one moved back.
This is the composer-to-carousel round trip confirmed, which also shows the earlier seed post that displayed its items in a shuffled order was carrying that order in storage, not being reordered by the viewer.

#### Like state

Opened a post from the feed so the feed card and the post detail were both on screen for the same post.
Both showed the same like count.
Toggled the like off: both dropped together to the settled value.
Toggled it back on: both returned together, and the count settled at the correct value rather than overshooting.

#### Like state against realtime, the highest-risk interaction

With the post detail open and the viewer's own like already applied, had Ben like the same post through the API.
The count moved from two to three and settled at three, so the viewer's own earlier like was not double-counted and the remote like still moved the count.
The viewer then toggled their own like off and on: the count settled correctly each time, with no overshoot to four, which is the in-flight guard preventing the broadcast of the viewer's own tap from landing on top of the optimistic update.

#### Confirm dialog

Opened the block confirmation from a post's overflow menu.
The confirm button was inert for about half a second after the dialog appeared, then armed: sampled disabled at 0 and 250 milliseconds and enabled at 650.
The block wording was intact.
Cancelled without blocking.

#### Escape

Opened the report modal from a post's overflow menu; it showed the server's report reasons.
Pressed Escape; the modal closed.

#### Video pause

Played the feed video, then scrolled it out of the viewport.
It paused once it left the viewport.

### Console

Across every surface exercised, the only console errors were the expected 404s from opening a blocked account's profile, which is how the frontend distinguishes a blocked account from a deleted one.
No React render error and no uncaught exception appeared on any surface.

## Verified at the API in support of a browser check

These were driven through the API to produce the events a second user would produce, and their effect was then observed in the browser as recorded above.

- Ben creating, editing, liking, unliking and deleting comments on a post the viewer had open.
- Ben liking a post the viewer had open.
- Dan requesting, withdrawing and re-requesting a follow of the viewer.
- The composer's created post was confirmed in the database to hold three media at positions 0, 1 and 2 in the composer's order before it was opened in the browser.

## Not exercised

- Paging past the first page of search results and of the saved and liked lists.
  The seed data does not fill a first page, so there is no second page to reach.
  The drain-empty-pages behaviour and the infinite-query paging are present in the kept code but were not driven past page one.
- A video inside a carousel playing and pausing on navigation.
  The carousels available carried images; a mixed carousel was not among the ones opened.
- The post detail screen with the realtime connection prevented.
  The connection was allowed throughout; the screen was not exercised with the socket blocked.
- The composer's per-file progress bars.
  The three files were small and uploaded quickly, so the progress state was not held long enough to observe, though the per-file thumbnails, removal and reordering were all confirmed.
