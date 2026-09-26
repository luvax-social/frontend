# Media Behaviour

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

How posts carrying media actually behave, on every surface where they render.

Video is covered separately in `video-behaviour.md`.
This file covers images, carousels, loading, failure, and the placeholder question.

All findings are **[source]** or **[observed]** as marked.

## The headline

Images work.
Carousels do not.

A carousel post renders exactly one item on every surface in the application, with nothing indicating that more exist.
Two of the six posts created for this audit are carousels, and on every screen they are indistinguishable from single-image posts.

## What the design defines

**[source]** The design renders media as flat coloured rectangles from hardcoded arrays, with an optional `imgUrl`.

| Aspect | What the design defines |
|--------|------------------------|
| Feed card media height | `post.media.h`, a per-post pixel number from the mock array. Not a ratio |
| Feed card media background | `post.media.color`, falling back to `#C4BCB2` |
| Feed card image fit | `width 100%, height 100%, objectFit cover, display block` |
| Feed card media radius | none of its own; the card has `borderRadius 12` with `overflow hidden` |
| Profile grid tile | `background: p.color`, `aspectRatio: p.tall ? '3/4' : '1/1'`, `borderRadius 4`, `gap 2` |
| Comment modal media, desktop | a left pane at `flex 1.1` with the image `objectFit cover` and a caption gradient over it |
| Comment modal media, single column | a 160px-tall strip above the content, non-mobile only |
| Explore `MiniCard` | flat colour block |

**[source]** What the design defines **nothing** for:

- **Carousels.** The word does not appear in the export. There is no multi-item post, no dot indicator, no counter, no swipe affordance, and no `postType` concept beyond `text` and `image`. The design has no carousel at all.
- **Video playback.** `type: 'video'` never appears in any mock post. The `video` glyph exists and the composer offers a video tab, but no design screen renders a playing video.
- **Loading placeholders.** No skeleton, no blur-up, no spinner for media.
- **Failed media.** No error state.
- **Duration or mute badges.** None.
- **Alt text.** The design's `img` elements carry `alt=''`.

This matters for planning: for carousels there is no reference to conform to.
Whatever gets built is a product decision, not a conformance task.

## Surface by surface

Seven surfaces were named for observation.
One of them does not exist.

| Surface | Exists | Media renders |
|---------|--------|---------------|
| Feed | yes | yes, first item only |
| Explore grid | yes | **could not be observed**, see below |
| Profile grid | yes | yes, first item only, video blank |
| Photos tab | yes, but does not filter | same as the profile grid |
| Search results | yes, inside explore | **no media at all** |
| Saved posts | **no such screen** | n/a |
| Post detail | yes | yes, first item only |

### Feed

**[observed]** At 1440 the feed is a two-column masonry, so each card is 315px wide.

| Post | Element | Rendered box | Natural size | Cropped |
|------|---------|--------------|--------------|---------|
| landscape image | `img` | 315 x 177 | 1600 x 900 | no |
| portrait image | `img` | 315 x **500** | 900 x 1600 | **yes** |
| carousel, 3 images | `img` | 315 x 236 | 1400 x 1050 | no |
| carousel, mixed | `img` | 315 x 177 | 1600 x 900 | no |
| video | `video` | 315 x 177 | 1280 x 720 | no |

**[source]** `PostCard.jsx:270,278` sets `maxHeight: isMobile ? 360 : 500` with `objectFit: cover`.

The portrait image at 315px wide wants to be 560px tall.
The 500px cap truncates it and `cover` crops the overflow, so **10.7 percent of a 9:16 image is cut off in the feed**.
Landscape and 4:3 images are unaffected because they never reach the cap.

Every card reported `mediaCount: 1`, including both carousels.

### Explore grid

**[observed]** The explore trending grid rendered **no posts at all**, with no empty state: the `trending today` label sits above blank space.

The explore endpoint returned nothing for this account, so the grid could not be observed with media in it.

**[source]** From `ExploreScreen.jsx:36-42`, `MiniCard` would render `p.media[0]` as an `<img>`, or a `<video muted>` with **no `controls`**, so a video in the explore grid could not be played even if it appeared.

This is **unknown by observation**.
Determining it needs the explore ranking to return the audit posts, which depends on `post_interaction_scores` being populated by the background scheduler described in the workspace rules.

### Profile grid and photos tab

**[observed]** Ben's profile grid holds eight tiles, each 225 x 225, `background-size: cover`, `border-radius: 0`, `gap: 2`.

| Tile | Content |
|------|---------|
| 1 | `a9de3af6....jpg`, the landscape image, cropped square |
| 2 | `ea8ae2d0....jpg`, carousel item 1, cropped square |
| 3 | `ab6fdc1f....webm` as a CSS background, **renders blank** |
| 4 | `a00db94a....jpg`, the portrait image, cropped square |
| 5 | `a9de3af6....jpg`, the mixed carousel's first item |
| 6, 7, 8 | no background, caption text tiles from the seeded posts |

Every tile is forced to 1:1, so both the 16:9 and the 9:16 images are heavily cropped.
The design mixes `3/4` and `1/1` tiles from a `p.tall` flag; the backend returns no such flag, and the frontend does not derive one from `width` and `height` even though both are available.

**[observed]** Clicking `photos` moves the active underline but the tile count stays at 8, with the same 5 media and 3 caption tiles.
The tab does not filter.

### Search results

**[observed]** Searching `AUDIT` returned `7 found`: one person and six post cards.

**Not one of the six rendered its media.**
All six appear as caption-only cards, including the two image posts and the two videos.

**[source]** `ExploreScreen.jsx:102-152`, `SearchResultPost`, has no media branch at all.
It renders an avatar, an author name, a three-line caption clamp and the first tag.

So a media post is invisible as a media post anywhere in search.

### Post detail

**[observed]** The overlay is `min(556px, 100vw - 32px)` x `min(84vh, 728px)`.

| Post | Element | Box | Natural | Radius |
|------|---------|-----|---------|--------|
| carousel, 3 images | `img` | 516 x 387 | 1400 x 1050 | 14 |
| video | `video` | 522 x 294 | 1280 x 720 | 14 |

**[source]** `PostDetailScreen.jsx:664,666` sets only `width: 100%` and `borderRadius: 14`, with no height cap.

Aspect ratio is therefore **fully respected in post detail**, unlike the feed.
A portrait image renders at its true ratio here and cropped in the feed, so the same post looks materially different on the two surfaces.

The media sits **inside the scrolling comments pane**, at the top, so it scrolls away as the reader moves down the comments.
The design's two-pane comment modal keeps the media fixed beside the comments instead.

## Carousels

**[observed]** On all four surfaces where a carousel renders, exactly one `<img>` is present, and the page contains no counter, no dots, and no element whose class or label mentions a carousel.

**[source]** Every consumer takes `media[0]` and stops:

| File | Line | Expression |
|------|------|-----------|
| `PostCard.jsx` | 120 | `post.media && post.media.length > 0 ? post.media[0] : null` |
| `ProfileScreen.jsx` | 238 | `p.media && p.media.length > 0 ? p.media[0].cdnUrl : null` |
| `ExploreScreen.jsx` | 28 | `p.media && p.media.length > 0 ? p.media[0].cdnUrl : null` |
| `PostDetailScreen.jsx` | via `mainMedia` | first item only |

The backend returns the full ordered array.
The frontend discards everything after index 0 and never reads `media.length`.

For the mixed carousel this is worse than losing items: the post is captioned as containing a video, the first item is an image, and the video is unreachable from every screen.

**[source]** The backend permits mixed carousels because `PostServiceImpl.validateMediaCardinality` returns early on the `CAROUSEL` branch, before the asset-type check that `IMAGE` and `VIDEO` posts get.
Carousels accept 2 to 10 items.

## Loading

**[observed]** No media element in the application declares its dimensions.
`PostCard` renders `<img src>` with `width: 100%` and no `height`, no `width`/`height` attributes, and no `aspect-ratio`.

Before the file arrives the element has zero intrinsic height, so the card occupies less vertical space and the content below sits higher.
When the image decodes, the card grows and everything after it moves down.

This was observed indirectly rather than by watching a first paint: pointing a loaded image at a missing URL collapsed its box from **177px to 24px** and moved the rest of the card up by the same amount.
The reverse of that shift is what happens on every first load.

**[source]** No `loading="lazy"` and no `decoding` attribute anywhere, so every image in a long feed is fetched eagerly.

**[source]** No skeleton, shimmer, or placeholder is rendered for media on any surface.
There is no media loading state at all, only the post-level `loading feed...` text that precedes the whole list.

## Failure

**[observed]** An image whose URL 404s:

- collapses from 177px tall to **24px**, the height of its alt text line;
- shows the browser's default broken-image affordance plus the alt string `post image`;
- shifts every element below it upward;
- produces no message, no retry, and no styled fallback.

**[source]** There is no `onError` handler on any `<img>` or `<video>` in `src/`.
The only `onError` occurrences are TanStack mutation callbacks.

The profile grid fails more quietly still: a broken URL in a CSS `background-image` leaves the tile blank with no alt text and no broken-image glyph, which is exactly what the video tile already does.

## Blurhash

**Confirmed: still true, and the gap is on the sending side.**

**[source]** The backend accepts and stores it.
`MediaUploadCompleteRequest` carries a `blurhash` field and `MediaMetadataValidator.validate` passes it through to `ValidatedMediaMetadata`.
`MediaAssetResponse` returns it.

**[source]** `media.service.js:21-24` and `useMediaUpload.js:107-115` build the `upload-complete` body from `storageKey`, `mediaType`, `mimeType`, `fileSize`, `width`, `height` and `duration`.
**`blurhash` is not among them.**

**[observed]** Every one of the seven assets created for this audit came back with `blurhash: null`, including the one uploaded through the browser composer.

So the field is not merely unused on render: it is never produced.
No existing asset in this database can have one, because the only client that writes assets does not compute it.

**[source]** The design defines no placeholder treatment during load, blur-based or otherwise, so there is no reference for what a blurhash would render as.
Using it would be a product decision.

Making it work needs two changes, not one: encode a hash client-side at upload time, and render it as a background while the image decodes.

## The typed-but-empty problem

**Confirmed: still happens, and real media now sits beside it.**

**[observed]** Three of the eight tiles in Ben's profile grid are seeded posts with no media asset.
They render as caption tiles: centred text at 11px in `v.ink3`, clamped to three lines, on a `color-mix(in srgb, var(--lx-surface-raised) 82%, #d8d1c4 18%)` background.

They now appear in the same grid as five real media tiles, so the grid mixes photographs with paragraphs of text.
On the `photos` tab, which does not filter, they still appear.

**[source]** `ProfileScreen.jsx:241,248` produces this deliberately: when `mediaUrl` is absent the tile falls back to a tinted background and prints the caption.

It is a reasonable derivation for a post that genuinely has no media.
It is the wrong answer for a post **typed** `image` that has no media, which is what the seeded rows are, because the tile then claims to be a photo grid entry while showing text.

The caption fallback cannot distinguish the two cases without reading `postType`, which it does not do.

## Summary of work

| Item | Size | Stage |
|------|------|-------|
| Render all carousel items, with an indicator | **Large**. No design reference exists, so the interaction must be designed first | 3 |
| Render media in search results | Small | 3 |
| Stop cropping portrait images in the feed | Small. Replace the 500px cap with a ratio cap | 2 |
| Reserve an aspect-ratio box before load | Small. `width` and `height` are already returned | 2 |
| Give the profile grid a video branch | Small | 2 |
| Mix profile tile ratios from `width` and `height` | Medium | 3 |
| Add a media error fallback | Small | 3 |
| Add `loading="lazy"` below the fold | Small | 3 |
| Produce and use `blurhash` | Medium, and a product decision first | 3 |
| Make the photos tab filter | Small | 3 |
