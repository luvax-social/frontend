# Changes Applied

> Record of work done on 2026-08-15. Not maintained; it is correct as of that date and is not updated as the code moves.

One entry per change, with the file touched, grouped by the commit that carries it.

## Scale

`feat(common): grow the app to a larger root scale`

- `src/features/luvax/LuvaxApp.jsx`: set a root `zoom` and `--lx-scale` of 1.14 on mount and clear both on unmount, so the app grows at the root and the frozen routes are untouched.

## Feed, one column

`feat(post): make the feed one centred column without card chrome`

- `src/features/luvax/components/FeedScreen.jsx`: replace the two-column masonry with a single centred column at 412 pixels base width; separate posts by a 56 or 44 pixel gap; remove the dead `StoriesCarousel` reference from the empty state; fade the list in.
- `src/features/luvax/components/PostCard.jsx`: remove the card background, border, radius, shadow, and the mobile divider; tighten the internal spacing; grow the caption to 15 pixels, and a text post's caption to 17; give the media a rounded frame on a wide viewport.
- `src/features/luvax/components/PostMedia.jsx`: add a `minAspect` cap of 0.8 so tall media is clamped by ratio and letterboxed rather than cropped.
- `src/features/luvax/components/shell.jsx`: remove the left and right column rules from the desktop and tablet main region.

## Post detail, two panes

`feat(post): lay post detail out as two panes on a wide viewport`

- `src/features/luvax/components/PostDetailScreen.jsx`: split the panel into a media pane and a comment column on a desktop media post; keep the media pane fixed while the comments scroll; keep a single stacked column for a text post and for narrow viewports; carousels work in both layouts.

## Motion

`feat(common): add one motion vocabulary and a stronger overlay scrim`

- `src/index.css`: add `--ease-in` and `--duration-slow`; add the overlay, modal, scrim, toast, and fade-in keyframes; add the reduced-motion rule.
- `src/features/luvax/components/primitives.jsx`: animate the modal panel and scrim on entry; move the bottom sheet's durations onto the vocabulary tokens.
- `src/features/luvax/components/PostDetailScreen.jsx`: strengthen the overlay scrim to 62 percent with a 3 pixel blur and animate the panel on entry.
- `src/features/luvax/components/PostMedia.jsx`: crossfade carousel items.
- `src/features/luvax/components/FeedScreen.jsx`: fade the feed list in.
- `src/features/luvax/components/shell.jsx`: key the main region by screen and fade it in on a screen change.

## Toast

`feat(common): add a toast host and voice silent actions`

- `src/features/luvax/components/Toast.jsx`: a React-held toast host and a `toast()` function, built on the design's values and the motion vocabulary.
- `src/features/luvax/LuvaxApp.jsx`: mount the toast host.
- `src/features/luvax/components/PostCard.jsx` and `PostDetailScreen.jsx`: a toast on copy link, on delete, and on block, each an action whose result is not otherwise on screen. See the note below on which actions got one.

## Notifications

`feat(notification): group by date and use per-type icons and colours`

- `src/features/luvax/components/NotificationsScreen.jsx`: group rows into today, this week, and earlier; derive the notification's category and use the per-type icon and colour maps the row had been ignoring.

## Explore

`feat(post): fix explore search form, uncap people, add empty states`

- `src/features/luvax/components/ExploreScreen.jsx`: uncap the people list from one; make the search a form so Enter commits the query to the address; remove the dead topic state; add a search empty state and a deliberate empty state for the unranked trending grid.

## Search follow state

`fix(social): show requested state on a pending search follow`

- `src/features/luvax/components/UserCard.jsx`: track a requested state alongside following, seed it from the server, and label a pending request "requested".
- `src/features/search/components/SearchScreen.jsx`: pass the pending state through to the card.

## Report modal

`feat(report): add completion animation, warning counter, and stroke`

- `src/index.css`: add the design's `fadeSlideUp` and `checkPop` keyframes.
- `src/features/luvax/components/ReportModal.jsx`: animate the completion panel and the check mark; give the check the design's 2.2 stroke; warn the character counter at ninety percent of the limit rather than at a threshold that could never fire; use the design's ellipsis in the placeholder. The description limit stays at the backend's 2000.

## Copy capitalisation

`fix(common): apply the design's capitalisation to menus and empty states`

- `src/features/luvax/components/PostCard.jsx`: change the two frontend-added menu rows from lower case to the design's sentence case, so the overflow menu no longer mixes cases.
- `src/features/luvax/components/NotificationsScreen.jsx`, `FollowersScreen.jsx`, `FollowingScreen.jsx`, `BlockedUsersScreen.jsx`: lowercase the five capitalised empty-state strings.

## Escape on the post detail

`fix(post): close the post detail overlay on escape`

- `src/features/luvax/components/PostDetailScreen.jsx`: wire the shared Escape hook to the route overlay, which did not inherit it because it is not an `LxModal`.

## Which actions got a toast, and why

A toast speaks only where the result is not already on screen.

- Copy link: the link goes to the clipboard with nothing visible to show for it.
- Post deleted: the card leaves the feed or the overlay closes, so the toast confirms the delete landed.
- Block: from a post's menu there is no on-screen sign it worked.

These did not get a toast, because their result is already visible: like, save, follow and unfollow, a pending request becoming "requested", a comment delete removing its row, and a report, which shows its own completion step.
