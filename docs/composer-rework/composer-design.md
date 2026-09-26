# The Compose Surface, As Built

> Record of work done on 2026-08-14. Not maintained; it is correct as of that date and is not updated as the code moves.

## One surface

The composer has no type tabs.

There is a caption field and a way to attach files.
The person can write first, attach first, do both, or do neither.

## Type derivation

The post type is a consequence of what is attached, computed by `derivePostType` in `src/features/luvax/utils/composerMedia.js`.

| Attached | Derived type |
|----------|--------------|
| Nothing | `TEXT` |
| One image | `IMAGE` |
| One video | `VIDEO` |
| Two or more, in any mix | `CAROUSEL` |

Nothing about this is a mode.
Removing the last attachment returns the surface to a text post with no action from the person, and the placeholder and submit label follow it back.

The submit control states what will be created rather than saying `post it`, so the derivation is visible instead of hidden.
It reads `post text`, `post photo`, `post video`, or `post carousel of {n}`.

Each of the four was verified against what the backend stored, not against what the button claimed.
The evidence is in `verification-evidence.md`.

## Divergence from the design

**The design export has three type tabs at `main.js:2817-3093`.
This build removes them.
That is a deliberate divergence and it is the decision this phase implements.**

The reasoning is that the tabs require the person to classify their post before they have made it.
A carousel is not expressible under that model at all, which is why no user could create one even after Stage 2 made carousels viewable.
Deriving the type from the content removes the classification step and makes the carousel reachable by the same gesture that attaches a second file.

Everything else about the composer stays conformant to the design.
The twelve measured differences from `docs/design-conformance/remaining-screen-differences.md` are accounted for in `changes-applied.md`, including the three that the tab removal makes void.

## Reorder method

**Paired move-back and move-forward buttons on every attachment tile.
Drag and drop is not implemented.**

The order decides what a viewer swipes through, so it has to be changeable on a phone.
Drag and drop alone is not sufficient there, as the phase brief notes.

A button was chosen over adding a touch-drag library because a button answers to a tap, a mouse, and a keyboard with one implementation, and it carries an accessible name.
Each control is labelled `move attachment {n} earlier` or `move attachment {n} later`.
The first tile's back control and the last tile's forward control are disabled rather than hidden, so the strip does not reflow as items move.

Reordering was verified end to end: three images attached in the order 1, 2, 3 were rearranged to 3, 1, 2 by tapping, and the created post stored them as 3, 1, 2, confirmed by hashing the stored bytes against the source files.

## Derived values

The design defines no attachment strip, so these values were derived rather than measured.
Each reuses a token or an idiom already present on this screen.

| Value | Choice | Derived from |
|-------|--------|--------------|
| Tile size | 96 x 96 | Fits three across the composer's content width at the narrowest supported viewport |
| Tile radius | 12 | The media box already uses `borderRadius 12` |
| Tile background | `v.surfaceSunken` | The media box background |
| Tile border | `1px solid v.border` | The media box dashed border, solid here because the tile is filled |
| Failed tile border | `1px solid v.error` | The existing form error colour |
| Remove control | `v.black50` circle, `close` icon | Copied unchanged from the single-file preview it replaces |
| Position badge | mono 9 on `v.black50` | The composer's existing mono 9 hashtag label size |
| Progress bar | 3px, `v.accent` on `v.black50` | The accent already carries the character counter ring |
| Strip gap | 8 | The media box already uses `gap 8` |
| Add-more row | dashed `v.border`, `plus` icon 16 | Keeps the drop zone's border idiom at a smaller size |

**The collapsed add control** is also derived.
With attachments present, the empty 160px drop zone would be a large blank above the strip, so the add affordance collapses to a single row reading `add more ({n}/10)`.
The full 160px box, which is the value the design specifies, is what renders when nothing is attached.

## The carousel maximum

`MAX_CAROUSEL_ITEMS = 10` is declared in `composerMedia.js`.

This is the one limit in the composer that is not read from an API.
`GET /media/constraints` publishes formats, size and duration, and does not publish a carousel range.

The value was established by observation against the running server, recorded in `backend-constraints-verified.md`: 1 item is refused, 2 and 10 are accepted, 11 is refused.

The composer prevents an eleventh item itself rather than letting the server refuse it, because the server's refusal at that boundary is a bare `Request validation failed` that names neither the field nor the limit.
The composer's own message names both.

If the constraints endpoint later publishes a carousel range, this constant should be deleted and read from there instead.

## Everything else comes from the endpoint

No format list, size limit, or duration limit is written into the frontend.

| Shown or enforced | Source |
|-------------------|--------|
| File picker `accept` attribute | `acceptedImageMimeTypes` + `acceptedVideoMimeTypes` |
| Helper text under the drop zone | All four constraint fields |
| Wrong-format refusal message | Both accepted lists, named in full |
| Oversize refusal message | `maxFileSizeBytes` |
| Over-length refusal message | `maxVideoDurationSeconds` |

The helper text now renders as `gif, jpeg, png, webp · mp4, quicktime, webm · max 180s video · 100MB`.
The string it replaced, `mp4 · max 60s · 50MB`, was wrong in all three of its claims.

## The duration check is the only duration check

The server bounds the duration the client declares and never opens the file.
This was proved by registering a genuinely 30.5 second video with a declared duration of 1 second and having it accepted.

The composer therefore measures every video with `getMediaMetadata` before uploading, and refuses one that exceeds `maxVideoDurationSeconds`.
If the composer did not measure it, nothing would.

Where the browser cannot read a container's metadata, the measurement fails and the file is allowed through rather than blocked on an unreadable value.
That case is recorded as a known gap in `deferred-findings.md`.

## QuickTime

No code path in the composer or the player calls `canPlayType`.
A search of `src/` returns no occurrence, so nothing needed changing.

The trap is real and was observed directly.
In the browser used for verification, `canPlayType('video/quicktime')` returns the empty string, meaning "no", while that same browser reported `readyState: 4` and a correct 30.528 second duration for the same `.mov` file, and played it in the rendered carousel.

Gating support on `canPlayType` would have refused a file the browser handles correctly.

## HEIC

No special handling was added, and none is needed.

`image/heic` is absent from the server's accepted list, so `validateFile` refuses it and names the accepted types in the same message.
A person who selects one is told what is accepted rather than left to guess.

The file picker's `accept` attribute is built from the server list, so a HEIC is not offered in the first place on systems that honour it.

## Blurhash: not produced

**Decision: the composer does not encode a blurhash, and continues to send the field unset.**

The reasoning:

Stage 2 added an aspect-ratio box, which removed the layout shift a blurhash placeholder would also have solved.
The structural benefit is therefore already banked by other means.

What remains is purely visual, a blurred impression while the image decodes, and rendering it is explicitly out of this phase.
Producing it now means adding an encoder dependency and running a canvas encode per file on the client, on every upload, to populate a column that no surface in the application reads.

That is cost with no observable effect, and it would sit unverifiable in the codebase until some later phase renders it.

The better sequence is for the encoder to arrive together with the thing that consumes it, so that producing and rendering can be verified in one change against real images.

The backend accepts, stores and returns the field, and every asset created during this phase has `blurhash: null`, confirmed in the API responses.
Nothing about this decision blocks the later phase: adding the encode step is a change to one function in `useMediaUpload`.
