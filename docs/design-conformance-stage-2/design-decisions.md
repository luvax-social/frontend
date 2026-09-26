# Design Decisions

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

Every decision the task delegated, with reasoning and what was rejected.

Section numbers refer to the Stage 2 task description.

---

## Section 5.1 The portrait crop rule

**Decision: clamp the ratio, not the pixels, and fit with `contain`.**

```
frameRatio = clamp(width / height, 0.5, 3.0)
```

The frame takes the media's own aspect ratio.
The clamp bounds are 1:2 and 3:1, both outside every format the application accepts, so for real media the clamp does nothing and the frame is the true ratio.
Media is fitted with `object-fit: contain`, which cannot crop.

**Why this shape.**
The requirement is that a portrait image is not cropped.
Any rule that keeps a height cap and crops the overflow fails that outright.
Any rule that keeps a height cap and letterboxes inside it satisfies the letter of the requirement but renders a 9:16 photograph smaller than before, which is worse than the defect.

The measured difference is small enough to make the cap pointless anyway.
At the feed's 315px column the old cap produced 315x500 with 10.7 percent cropped away.
Removing it entirely produces 315x560.
The cap was buying 60px of vertical space in exchange for cutting a tenth off the photograph.

**Rejected: a 4:5 floor**, the common portrait limit in production social applications.
A 9:16 image is `0.5625`, which is taller than 4:5 at `0.8`.
Under a 4:5 floor it would letterbox to 221x394 inside a 315x394 frame, appearing smaller and with bars on both sides.
That trades a crop for a shrink.

**Rejected: no clamp at all.**
Simpler, and correct for every asset that exists today.
It was rejected because nothing in the upload path currently bounds the ratio, so a 1:20 asset would produce a frame taller than several viewports.
The clamp costs nothing and removes that.

---

## Section 5.2 The aspect-ratio box

**Decision: reserve the box from the backend's `width` and `height`, on every surface.**

`MediaAssetResponse` and `PostMediaResponse` both carry `width` and `height`.
Every asset in the local database has them populated: 19 images and 2 videos, none null.
The frontend never read them.

The frame now sets `aspect-ratio` from those values before any file arrives, so the box exists at first paint.

**Fallback when dimensions are missing.**
Both fields are nullable in the DTO even though nothing in this database is null.
When either is absent or not a positive finite number the ratio falls back to `1`.
Square is the neutral choice and it matches the profile grid tile, so a dimensionless asset degrades to the shape the application already uses most.

---

## Section 5.3 The video tile in the profile grid

**Decision: render a real `<video>` element seeking to its first frame, and mark it with a badge.**

The grid built every tile as a CSS `background-image`.
A video URL handed to `background-image` paints nothing, and because the URL was present the caption fallback was skipped too, so the tile carried neither picture nor text.

The tile is now an element rather than a background, so images and videos can each take their own branch.

The video branch uses `preload="metadata"` with `#t=0.1` appended to the source.
There is no poster frame and none is being built in this stage, so the media fragment asks the browser to seek to the first frame and paint that.

**This worked.**
The webm tile renders its opening frame, verified in the browser.

**It is a hint, not a guarantee.**
It depends on the origin serving range requests. Cloudflare R2 does here.
If a future asset or origin does not, the tile falls back to `v.surfaceSunken` with a `video` glyph, which is still legible as a video and still better than blank.

A single-item video tile also carries a small `video` glyph badge, so a video is identifiable as a video without waiting for or relying on the frame.

**Rejected: generating poster frames.**
Explicitly out of scope for this stage.

**Rejected: leaving it as a caption tile.**
That is the treatment for a post with no media, and a video post has media.

---

## Section 5.4 The broken media fallback

**Decision: hold the reserved box and state what happened.**

There was no `onError` handler on any image or video in the application.
A broken image collapsed from its full height to one line of alt text, showed the browser's default broken-image mark, and shifted everything below it upward.
The profile grid failed more quietly still, leaving a blank tile.

Every image and video now carries an error handler.

The fallback is `v.surfaceSunken` filling the already-reserved box, with the `image` or `video` glyph at 20 in `v.ink3`, and a mono 10 label reading `image unavailable` or `video unavailable`.
On a grid tile the label is dropped and only the glyph shows, because a tile is too small to carry text at a legible size.

**All derived.**
`v.surfaceSunken` is the existing sunken surface token.
`v.ink3` is the design's own tertiary text colour, already used for timestamps on this card.
mono 10 is the design's timestamp and section label size.

**Why it holds the box.**
This is the part that matters.
The reserved box means a failure changes nothing about the layout.
Verified: pointing a loaded image at a missing URL left the frame at 317x178 and the card at 336px, both identical to before the failure.

**Rejected: a retry button.**
It adds an interactive element inside a card that already has a card-level click, for a failure mode that is usually not transient.

---

## Section 5.5 The typed-but-empty tiles

**Decision: no change, because the premise is false.**

The task describes "a large number of posts typed as image, video, or carousel that carry no media asset at all" and asks what to do about them.

**There are none.**

```sql
SELECT p.post_type, count(*) FROM posts p
WHERE p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM post_media pm WHERE pm.post_id = p.id)
GROUP BY p.post_type;

 post_type | count
-----------+-------
 text      |    33
```

Every post in the local database that carries no media is typed `text`.
There is not one `image`, `video` or `carousel` post without media.

Ben's profile grid, the specific example the audit used, holds eight posts: five with media and three typed `text`.

```
 post_type | n_media | caption
-----------+---------+----------------------------------------
 carousel  |       2 | AUDIT CAROUSEL mixed image and video
 carousel  |       3 | AUDIT CAROUSEL three images mixed ratios
 video     |       1 | AUDIT VIDEO webm 1280x720
 image     |       1 | AUDIT IMAGE portrait 900x1600
 image     |       1 | AUDIT IMAGE landscape 1600x900
 text      |       0 | [luvax-seed] grain on film is the texture
 text      |       0 | [luvax-seed] morning, window, coffee
 text      |       0 | [luvax-seed] light is the medium
```

The audit stated that the caption tile "is the wrong answer for a post typed `image` that has no media, which is what the seeded rows are".
The seeded rows are typed `text`.

The audit's own standard settles it: it calls the caption tile "a reasonable derivation for a post that genuinely has no media", and that is exactly what these posts are.

So the rendering is correct, and the task's suggested answer of leaving it alone and recording it turns out to be the only correct answer, for a stronger reason than the task anticipated.
There is no data inconsistency either.

The caption tile branch was kept, with a comment recording why it is correct.

---

## Section 6 The feed post card

Applying the design's measured values was mechanical and is listed in `changes-applied.md`.
Three decisions needed judgment.

### The mobile separator

**Decision: keep it, against the design.**

The design's mobile card has background `v.base`, no border, no shadow and no separator.
The page behind it is also `v.base`.

Applying the background faithfully, as this stage did, means consecutive cards share a background with the page and with each other.
Observed at 390px: without a separator they run together into one continuous column and the boundary between two posts disappears.

The frontend's `paddingBottom 12` plus `borderBottom 1px solid v.border` was kept.

This is a legibility divergence created by the design's own background choice, not a failure to conform.
The design's mock feed has coloured media blocks at the top of every card, which supply the visual break that real text-only posts do not.

### The card-level click

**Decision: reproduce the design's mechanism exactly, including its opt-out attribute name.**

The design puts `onClick` on the `<article>` and skips it when `e.target.closest('[data-lxtap]')` matches.
The same mechanism and the same attribute name are now used, so the two implementations read alike.

Seven elements carry the opt-out: the author block, the overflow menu button, the like button, the comment button, the share button, the save button, and the block error banner.
The carousel arrows and the video element carry it from `PostMedia`.

**One thing the design did not have to solve.**
The dropdown menu, the report modal, the edit sheet and the delete confirmation are all rendered as children of the `<article>` in this codebase.
Without the opt-out, every click inside any of them would also open post detail behind the overlay.
They are wrapped in a single `data-lxtap` container.

### The heart colour

**Decision: keep `var(--lx-error)`, against the design's `#D15B5B`.**

The design uses a literal hex.
The frontend uses a token that resolves to `#C47168`.

Writing a raw hex into a component would break the token system that the rest of the application, and Stage 1's work, depends on.
There is no token matching `#D15B5B`, and inventing one to hold a single literal is a token-system change that belongs with a palette decision, not with a card layout stage.

Recorded as a known divergence.

---

## Section 7 The profile

### The follow button state

**Confirmed broken before being touched, as section 2.1 required.**

The audit said the button never shows a followed state.
A later phase reported changing exactly that.

Both are true, about different controls.

The `PostCard` overflow menu has a row that correctly reads `Unfollow @handle` when following and `Follow @handle` when not, and tracks it from `useFollowing`.
That is what the later phase changed.

The profile button is a different control and was still hardcoded:

```jsx
<LxBtn variant="primary" ... >
  follow
</LxBtn>
```

The `following` state was already being computed and stored, and nothing read it.

Confirmed in the browser before any edit: signed in as `luvax_ava`, who follows `luvax_ben`, Ben's profile showed a filled primary button reading `follow`.

Now `variant={following ? 'secondary' : 'primary'}` with the matching label, which is the design's own expression.
Verified toggling in both directions, and the follow relationship was restored afterwards.

### The grid tile aspect ratio

**Decision: uniform `1/1`. Do not derive `3/4` from asset dimensions.**

This decision was put to the repository owner and uniform was chosen.

The design mixes `3/4` and `1/1` from a `p.tall` flag the backend does not return.
The ratio could be derived, since `width` and `height` are available on every asset.

The task adds a constraint the design itself does not satisfy: a grid that mixes ratios must still tile without gaps.
In a three-column CSS grid, mixing `3/4` and `1/1` sizes each row to its tallest tile, so shorter tiles either stretch and distort their crop or leave visible gaps.
Making a mixed grid gapless needs a masonry layout or row normalisation, which is a larger change than this stage's remit and would alter a surface Stage 3 may touch.

Uniform squares satisfy the constraint exactly and keep the profile a calm even field.

Verified: tiles render 223x223 at 1440 with `gap 2` and `padding 2`, tiling without gaps at desktop and at 390px.

**Rejected: deriving the ratio.**
Closer to the design's intent, but it cannot meet the gapless constraint without a layout rewrite.

### The tile crop

**Decision: tiles keep `object-fit: cover`.**

This looks like a contradiction of section 5.1 and is not.

A grid tile is a square crop by definition, and the design crops its tiles too.
The no-crop rule applies to the feed and detail frames, where the media is the subject rather than a thumbnail.
A tile that letterboxed would produce a grid of small images floating in coloured boxes.
