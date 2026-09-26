# Follow-up Changes, Round 2

> Record of work done on 2026-08-16. Not maintained; it is correct as of that date and is not updated as the code moves.

A third round of owner-requested changes, with the decisions and their reasons on the record.

## Decisions worth noting

### Media fills the frame with no crop

The owner wanted post media to fill its frame with no empty space at the sides.
The side space came from the height cap added in the layout overhaul: a tall portrait was clamped to a wider frame and then letterboxed.
The owner chose to keep the no-crop rule and remove the gaps by using each image's true aspect ratio, so the frame matches the image and it fills with no gap.
This reverses the earlier fixed height cap, on the owner's direction; very tall portraits are now as tall as they are.

### Banner upload is not possible yet

The owner asked whether avatar and banner upload from the device are implemented.
Avatar upload is now implemented: the image goes through the existing pre-signed upload and its CDN URL is saved as the profile avatar.
Banner upload is not, because the backend has no banner or cover column on the user, and the backend is read-only in this work.
This is recorded rather than faked.

### Notification routing

Clicking a notification errored because every notification was opened as a post, but a comment notification carries a comment id and a follow notification carries nothing.
Only a post-type notification carries a post id, so only it opens the post detail now; the others open the actor's profile.
Opening a comment notification's post would need the backend to include the post id on the notification, which it does not today.

### Fluid scale

The fixed root scale read as small on 2K and larger screens.
The scale is now fluid: HD and below keep the comfortable base, and larger screens grow it, clamped so it never shrinks HD or runs away on a very large display.
The post popup is generous on large screens as well.
The options-menu positioning already reads the live scale, so it keeps landing on its anchor.

### Mobile interaction

On mobile a single tap on a post now does nothing, a double-tap on the media likes it, and the comment control opens the detail.
The gap between posts is much tighter on mobile, where space is scarce, while staying clearly larger than the gaps inside a post so the grouping still reads.

## Everything else

Author-first post order, larger story rail, followers and following in a modal with a rapid-tap guard, a red unfollow confirmation, the photos-first tab order, comment threads separated by spacing rather than lines, hashtag click to tag search, muted video autoplay on scroll, and an in-app 404 for signed-in users.

## Verified in the browser

Every item was confirmed in a running browser against the live backend, with no console errors.

- Media fills its frame with no side gaps; the popup follows a portrait's ratio.
- The root scale reads 1.14 on HD and 1.52 on a 2560 wide screen, and returns to 1.14 back on HD.
- The story rail has larger avatars and more height.
- The navigation bar is present on the messages screen.
- A comment notification opens the actor's profile instead of erroring.
- Comment threads have no lines: top-level comments are spaced apart, replies sit tight.
- The profile tabs read photos, posts, liked.
- Followers and following open in a modal over the profile.
- Unfollow opens a red confirmation dialog.
- The avatar upload chain returns a CDN URL and saves it on the profile.
- On mobile the gap between posts is about 25px, a single tap does nothing, and a double-tap on an unliked post fires the like request while an already-liked post is left alone.
- A video is paused before it is reached and autoplays muted once scrolled into view.
- The post leads with the author, then the media, then the caption.
- Clicking a hashtag opens the tag search for it.
- A signed-in user on an unknown address lands on an in-app notice with the nav bar, then returns to the feed.

## Backend was not touched

No backend file was created, modified, or deleted.
The avatar upload uses the media and profile endpoints the backend already implements.
