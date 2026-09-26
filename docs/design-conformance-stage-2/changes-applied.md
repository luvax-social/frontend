# Changes Applied

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

One entry per change.

Every design value in this file was read from `docs/design/Luvax.html` during this stage, not taken from the audit.
Chunk `ed9a0c12-9a80-4cca-94ad-0719b3a2539b.js`, extracted to a scratch directory outside the repository.

`n/a` in the design column means the design defines nothing for that property.

## Feed post card

Design source: `PostCard`, line 2063 onward.

| Property | Design | Was | Now | File |
|----------|--------|-----|-----|------|
| Card border radius, non-mobile | `12` | `14` | `12` | `PostCard.jsx` |
| Card border | none | `1px solid v.borderSubtle` | none | `PostCard.jsx` |
| Card overflow | `hidden` | not set | `hidden` | `PostCard.jsx` |
| Card background, mobile | `v.base` | `transparent` | `v.base` | `PostCard.jsx` |
| Card click target | `onClick` on the article, skipped inside `[data-lxtap]` | none; media, caption and reply each had their own | `onClick` on the article with the same `[data-lxtap]` opt-out | `PostCard.jsx` |
| Card cursor | `pointer` | not set | `pointer` | `PostCard.jsx` |
| Avatar size | `26` | `28` | `26` | `PostCard.jsx` |
| Caption size, text posts | `16` | `18`, and unreachable, see below | `16` | `PostCard.jsx` |
| Caption size, media posts | `14` | `14` | `14` | `PostCard.jsx` |
| Caption line height | `1.5` | `1.45` | `1.5` | `PostCard.jsx` |
| Like count colour | always `v.ink3` | heart colour when liked | always `v.ink3` | `PostCard.jsx` |
| Media height cap | `post.media.h`, a mock pixel value | `maxHeight 360` mobile / `500` otherwise, with `cover` | ratio-derived frame, `contain`, no pixel cap | `PostCard.jsx`, `PostMedia.jsx` |
| Media items rendered | n/a | first only | all | `PostCard.jsx`, `PostMedia.jsx` |

### The text post caption was unreachable

The previous condition was `post.postType === 'TEXT' || post.type === 'text'`.

`PostType` is serialised by `@JsonValue` as lower case, so the API returns `"text"` and the comparison against `"TEXT"` never matched.
`post.type` does not exist on the API response at all.

Every text post therefore rendered its caption at the media size of 14 rather than the intended larger size, and raising 18 to 16 would have changed nothing on its own.

The condition now lowercases before comparing.
This is the same defect the codebase had already documented for `mediaType` in `helpers.js`.

Observed after the change: a text post renders at 16px with a 24px line height, a media post at 14px with 21px.

### Kept deliberately, against the design

| Property | Design | Kept | Why |
|----------|--------|------|-----|
| Caption `white-space` | not set | `pre-wrap` | Preserves author newlines. The design's mock captions contain none, so it had no reason to set it |
| Heart colour when liked | `#D15B5B` literal | `var(--lx-error)` | Introducing a raw hex would break the token system |
| Mobile card separator | none | `paddingBottom 12` plus `borderBottom 1px solid v.border` | See `design-decisions.md`. With the card background now `v.base` on a `v.base` page, consecutive cards are indistinguishable without it |

## Profile

Design source: `ProfileScreen`, line 3599 onward.

| Property | Design | Was | Now | File |
|----------|--------|-----|-----|------|
| Cover band background | `v.surfaceRaised` | `color-mix(in srgb, var(--lx-surface-raised) 82%, var(--lx-base))` | `v.surfaceRaised` | `ProfileScreen.jsx` |
| Avatar row offset | `marginTop -40` | `-38` | `-40` | `ProfileScreen.jsx` |
| Avatar size | `80 x 80` | `76 x 76` | `80 x 80` | `ProfileScreen.jsx` |
| Avatar border | `3px solid var(--lx-base)` | `4px` plus `boxShadow 0 0 0 1px v.base` | `3px`, no shadow | `ProfileScreen.jsx` |
| Follow button variant | `following ? 'secondary' : 'primary'` | always `primary` | `following ? 'secondary' : 'primary'` | `ProfileScreen.jsx` |
| Follow button label | `following ? 'following' : 'follow'` | always `follow` | `following ? 'following' : 'follow'` | `ProfileScreen.jsx` |
| Follow button geometry | `LxBtn size sm` defaults, `marginBottom 0` | `minWidth 62`, `height 30`, `padding 0 14px`, `fontSize 13`, `borderRadius 999`, `translateY(6px)` | defaults, `marginBottom 0` | `ProfileScreen.jsx` |
| Name block padding | `12px 16px 0` | `14px 16px 0` | `12px 16px 0` | `ProfileScreen.jsx` |
| Name size | `22` | `24` | `22` | `ProfileScreen.jsx` |
| Name letter spacing | `-0.02em` | `-0.03em` | `-0.02em` | `ProfileScreen.jsx` |
| Stats padding | `16px 16px 16px` | `20px 16px 14px` | `16px 16px 16px` | `ProfileScreen.jsx` |
| Stats gap | `28` | `30` | `28` | `ProfileScreen.jsx` |
| Stat value size | mono `16` | mono `14` | mono `16` | `ProfileScreen.jsx` |
| Stat label letter spacing | `0.08em` | `0.14em` | `0.08em` | `ProfileScreen.jsx` |
| Tab padding | `12px 0` | `13px 0 14px` | `12px 0` | `ProfileScreen.jsx` |
| Grid padding | `2` | `2px 0 0` | `2` | `ProfileScreen.jsx` |
| Tile radius | `4` | `0` | `4` | `ProfileScreen.jsx` |
| Tile aspect ratio | `3/4` when `p.tall`, else `1/1` | always `1/1` | always `1/1`, deliberately | `ProfileScreen.jsx` |
| Tile rendering | flat colour | CSS `background-image` | `<img>` or `<video>` element | `ProfileScreen.jsx`, `MediaThumb.jsx` |

### Kept deliberately, against the design

The design has no equivalent for these, so they are frontend capability rather than divergence.
All were left in place.

The verified badge, the handle shown only when it differs from the display name, the clickable follower and following stats, the loading state, the profile error state, the posts error state, and the overflow menu that opens the report flow.

## Media defects

| Defect | Was | Now | File |
|--------|-----|-----|------|
| Portrait cropped in the feed | `maxHeight 500` plus `cover` cropped 10.7 percent of a 9:16 image | ratio clamp plus `contain`, renders 315x560 uncropped | `helpers.js`, `PostMedia.jsx` |
| No aspect box before load | no element declared dimensions | `aspect-ratio` from the backend's `width` and `height` | `helpers.js`, `PostMedia.jsx`, `MediaThumb.jsx` |
| Video in profile grid blank | video URL handed to a CSS `background-image` | `<video preload="metadata">` with `#t=0.1`, plus a video badge | `MediaThumb.jsx` |
| Broken media had no fallback | collapsed to one line of alt text, shifted the page up | holds the reserved box, shows a glyph and a label | `PostMedia.jsx`, `MediaThumb.jsx` |
| Typed-but-empty tiles | caption tile | unchanged, deliberately | see `design-decisions.md` |

## Carousel reach

| Surface | Was | Now | File |
|---------|-----|-----|------|
| Feed card | `media[0]` only | full carousel | `PostCard.jsx` |
| Post detail | `media[0]` only | full carousel | `PostDetailScreen.jsx` |
| Profile grid | `media[0]` as a background image | first item plus a count badge | `ProfileScreen.jsx` |
| Photos tab | same as the grid | same as the grid | `ProfileScreen.jsx` |
| Explore grid | `media[0]`, video with no controls | first item plus a count badge | `ExploreScreen.jsx` |
| Search results | no media at all | first item plus a count badge | `ExploreScreen.jsx` |

## Feed empty state

| Property | Design | Was | Now | File |
|----------|--------|-----|-----|------|
| Empty feed | n/a | nothing, a blank column | derived empty state | `FeedScreen.jsx` |
| Container | `48px 24px`, centred | n/a | `48px 24px`, centred | `FeedScreen.jsx` |
| Title | body `15`, weight `500`, `v.ink2`, `marginBottom 4` | n/a | identical | `FeedScreen.jsx` |
| Subtitle | body `13`, `v.ink3` | n/a | identical | `FeedScreen.jsx` |

The geometry is not invented.
It is the design's own empty state from the Explore screen, chunk line 4010.
Only the copy is new, because the design defines no empty feed.

## One incidental fix

| Property | Was | Now | File |
|----------|-----|-----|------|
| Feed body padding | `padding` shorthand plus a separate `paddingBottom` | single `padding` shorthand | `FeedScreen.jsx` |

React warns when a shorthand and a non-shorthand property for the same value are both updated across a rerender, and this fired on every viewport change.
It is on a surface this stage touches and the fix is one line, so it was folded into the empty state commit rather than left to produce console noise during verification.
