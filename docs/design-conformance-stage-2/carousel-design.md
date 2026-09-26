# Carousel Design

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

The interaction as built.

## There was no reference

The design export defines no media carousel.

The word `carousel` appears in it five times and every occurrence is `StoriesCarousel`, the row of story avatars at the top of the feed.
There is no multi-item post, no dot indicator, no counter, no swipe affordance, and no post type beyond `text` and `image` in any mock array.

So nothing here is conformance.
Every value below is derived, and every derivation names what it came from.

## The shape of the interaction

One item fills the frame at a time and the viewer moves between them horizontally.

Rejected: a grid of tiles, and a collage.
Both were ruled out by the task description before implementation began.

## The frame does not resize

This was the hardest requirement and it drove the rest of the design.

**The frame takes its aspect ratio from the first item and keeps it for every item.**

The first item is what the post leads with, so it is what the frame should be shaped by.
Items whose own ratio differs are fitted inside that frame with `object-fit: contain`, over a `v.surfaceSunken` backdrop.

Observed: a carousel whose first item is 1400x1050 and whose second is 1050x1400 holds a 315x236 frame across both.
The card does not move.

### What was rejected, and why

**Cropping later items to the frame with `object-fit: cover`.**
This keeps the frame full at every position and never letterboxes.
It was rejected because it reintroduces exactly the defect this stage removes.
Section 5.1 exists because a portrait image was being cropped in the feed.
Fixing that on single images while adding it back on carousels would be incoherent.

**Resizing the frame per item.**
Rejected by the requirement.
It also makes the whole feed jump when a carousel is mid-column in the masonry layout.

**A blurred copy of the item behind the letterbox bars.**
This is what several production applications do and it looks better than a flat backdrop.
It was rejected because it needs a second decode of the same asset for a purely decorative effect, and because the design has no blur treatment anywhere to derive one from.

## Derived values

Every value, and what it came from.

| Element | Value | Derived from |
|---------|-------|--------------|
| Frame ratio | `clamp(width / height, 0.5, 3.0)` of the first item | See the ratio rule below |
| Item fit | `object-fit: contain` | Never crops, which is the point |
| Letterbox backdrop | `v.surfaceSunken` | An existing token, already the backdrop of the explore search input |
| Scrim behind all controls | `rgba(26,24,22,0.28)` | `26,24,22` is the design's own post card shadow colour, `0 2px 8px rgba(26,24,22,0.06)` |
| Dot size | `6px` | The smallest circle that stays legible on a photograph |
| Dot gap | `5px` | The design's tag row gap on the same card |
| Dot colour, active | `v.base` | The page ground colour, so it reads against any image |
| Dot colour, inactive | `v.base` at `0.45` opacity | The quiet end of visible |
| Dot pill padding | `5px 7px`, radius `999` | Radius 999 is the design's own pill radius on `LxTag` and the follow button |
| Counter pill | mono `10`, `v.base`, offset `10` from top and right | mono 10 is the design's timestamp and section label size on this card |
| Counter pill padding | `3px 7px` | One step tighter than the dot pill, which carries taller content |
| Arrow button | `28px` circle | Between the design's 26 avatar and its 30 profile menu button |
| Arrow glyph | `chevronLeft` and `chevronRight` at `16` | The design's profile overflow menu icon size |
| Arrow opacity | `0.85` | Present without competing with the photograph |
| Arrow inset | `8px` from the edge | Half the card's 16px content padding |
| Focus ring | `2px solid v.ink`, offset `2` | `v.ink` is the design's own active tab underline colour |
| Swipe threshold | `40px` | Shortest travel that reads as deliberate rather than a tap that wobbled |

## The ratio rule

The old behaviour was `maxHeight: isMobile ? 360 : 500` with `object-fit: cover`.
At the feed's 315px column a 9:16 image wants to be 560px tall, so the 500px cap truncated it and `cover` cropped the overflow.

The replacement clamps the ratio rather than the pixels:

```
frameRatio = clamp(width / height, 0.5, 3.0)
```

`0.5` is 1:2 and `3.0` is 3:1.

Both bounds sit outside every format the application accepts.
The tallest real asset is 9:16, which is `0.5625`, comfortably inside the floor.
So for every asset in the database the clamp is inert, the frame is the media's true ratio, and `contain` fills it exactly with no letterboxing at all.

The clamp exists only to stop a pathological asset from producing a frame taller than the viewport.

Observed after the change: the 9:16 image renders 315x560, uncropped.
It was 315x500 and cropped before.

## Movement

**Stops at the ends. Does not wrap.**

Wrapping from the last item back to the first hides the fact that the carousel has ended.
The arrows already disappear at each end, which shows the boundary without needing the reader to discover it by overshooting.

Observed: pressing `ArrowRight` twice from position 2 of 3 lands on 3 and stays there.

## The three input methods

**Touch.**
A horizontal swipe of more than 40px moves one item.

**Desktop.**
Circular chevron buttons, always visible rather than revealed on hover.
The requirement asked for a visible affordance on desktop specifically because there is no swipe there, so hiding it behind hover would defeat the point.
The previous arrow is absent at the first item and the next arrow is absent at the last.

**Keyboard.**
The frame is focusable when it holds more than one item, and `ArrowLeft` and `ArrowRight` move between them.
A single-item frame is not focusable, because there is nothing to move between and it would only add a tab stop.

The frame carries `role="group"`, `aria-roledescription="carousel"` and a label naming the item count.
Items that are not showing are `aria-hidden`.

## The indicator is an indicator, not a control

The dots report position and count.
They do not accept clicks.

This was deliberate.
The requirement asked for something that shows how many items there are and which one is showing, and asked for it to stay quiet, because it sits on top of someone's photograph.
Making each dot a click target adds six or ten more interactive elements to a card that already has a card-level click, and it makes the frame's click meaning ambiguous.
Arrows, swipe and arrow keys already cover movement.

## Video inside a carousel

An item may be a video and it plays under the same rules as any other video in the application.

**Only the visible item plays.**
Moving to another item pauses the previous one and resets it to the start.

**Controls appear only on the visible item.**
A video that is not showing has no controls, so it cannot be reached by keyboard through a hidden element.

Observed on the mixed carousel: moving to item 2 and pressing play advances `currentTime`.
Moving back to item 1 leaves the video `paused` with `currentTime` at 0.

The video element carries `data-lxtap="1"` so that using its controls does not also trigger the card-level click that opens post detail.

## What a tile does instead

The profile grid, the photos tab, the explore grid and search results do not get a carousel.
A tile is one square.

They show the first item and a badge carrying the item count.

There is no stacked-layers glyph in the icon table, so the count carries the meaning rather than a symbol.
A video tile with a single item gets the `video` glyph and no number.

## Failure

Both the frame and the tile carry an error branch.

An image or video that fails to load is replaced, inside its already-reserved box, by `v.surfaceSunken` with the matching glyph in `v.ink3` and a mono 10 label.

The box does not collapse, which is the whole point.
Observed: pointing a loaded image at a missing URL left the frame at 317x178 and the card at 336px, both unchanged.
