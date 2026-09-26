# Follow-up Changes, Round 3

> Record of work done on 2026-08-16. Not maintained; it is correct as of that date and is not updated as the code moves.

A further round of owner-requested changes, with the decisions and their reasons on the record.

## Post popup

### Media fills the pane; the popup keeps a floor height for comments

The owner rejected the letterbox bars a fixed pane put above and below a landscape image.
The popup now sizes its media pane to the media's own width and aspect ratio, so the image reaches both side edges with no letterbox in any orientation.

A wide landscape, sized this way, is short, and a popup only as tall as the image left the comment column too cramped to read.
So the popup no longer takes the media's height directly.
It keeps a floor height; when the media is shorter than the floor, the image is centred in its column and the column's own surface fills the space evenly above and below it, blended into the popup body rather than boxing the image on all sides.
A portrait taller than the floor makes the popup as tall as the image, and the image fills the pane completely.
The floor is generous - the popup reads as a long panel rather than a squat one - but stays short of the full screen at both ends.

The result: the width is flush with no side gaps, and the comment column always has room to read.

### The info section is compact and borderless

The author row and caption were scaled down - a smaller avatar and smaller type - and the divider lines under them were removed.
Comments are separated by spacing, not lines.
The comment input keeps its previous size.
The net effect is that more comments are visible without changing the input.

### Long comments wrap

A long, unbroken comment ran off the right edge of the comment column.
It now wraps within the column.

## Story rail

The rail was already wider than the post column with slightly smaller avatars.
The avatars are now centred in the rail.
Centring uses a safe alignment, so when the set outgrows the rail it falls back to a scrollable start rather than clipping the first avatars out of reach; new stories entering on the left stay reachable.

## Verified in the browser

Every item was confirmed in a running browser against the live backend, with no console errors.

- A landscape post popup fills its media pane to both side edges with no letterbox, reads as a long panel short of full screen, and shows several comments where before it showed almost none.
- A short landscape image is centred in its column, with the fill above and below blended into the popup body instead of reading as a separate block.
- The author and caption area is compact with no divider lines; comments carry no dividers between them.
- A long, unbroken comment wraps inside the column instead of overflowing.
- The story avatars are centred over the post column.

## Backend was not touched

No backend source file was created, modified, or deleted for these changes.
The separate handoff report for notification deep-linking and the user banner remains the backend team's to act on.
