# Verification Evidence

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

What was observed, and what was not.

## Method

Both applications running.

The backend was started with `./mvnw spring-boot:run` and served on 8080.
Postgres, Redis, RabbitMQ and Mailpit were already up in Docker.
The frontend dev server ran on 5173.

Signed in as `luvax_ava`, who follows `luvax_ben`, so the feed returns Ben's posts.

Observed in a real browser through Playwright, at 1440x900 and at 390x844.
Measurements are `getBoundingClientRect` and `getComputedStyle` readings taken in the live page, not estimates from screenshots.

All six of the audit's media posts were confirmed present before starting:

```
 post_type | caption                                    | n_media
-----------+--------------------------------------------+---------
 image     | AUDIT IMAGE landscape 1600x900 #light      |       1
 image     | AUDIT IMAGE portrait 900x1600 #analog      |       1
 video     | AUDIT VIDEO webm 1280x720 #film            |       1
 video     | AUDIT VIDEO MP4 1280x720 30s #film         |       1
 carousel  | AUDIT CAROUSEL mixed image and video       |       2
 carousel  | AUDIT CAROUSEL three images mixed ratios   |       3
```

## The carousel

### Count and structure, feed at 1440

| Post | Before | After |
|------|--------|-------|
| carousel, 3 images | 1 `<img>`, no counter, no dots | `group` labelled `post media, 3 items`, counter `1/3`, 3 dots |
| carousel, mixed | 1 `<img>`, no counter, no dots | `group` labelled `post media, 2 items`, counter `1/2`, 2 dots |
| single image | 1 `<img>` | 1 `<img>`, no counter, no dots, not focusable |

### Movement in both directions

Clicking the next arrow on the three-image carousel moved `1/3` to `2/3`.
Both arrows were then present.
Two `ArrowRight` presses from `2/3` reached `3/3` and stayed there, and only the previous arrow remained.

**Stops at the ends. Does not wrap.** Confirmed in both directions.

### The frame does not resize

The three-image carousel carries a 4:3, a 3:4 and a 1:1 image.

| Position | Item natural size | Frame |
|----------|-------------------|-------|
| 1/3 | 1400x1050 | 315x236 |
| 2/3 | 1050x1400 | 315x236 |
| 3/3 | 1200x1200 | 315x236 |

The frame held 315x236 across a landscape, a portrait and a square item.

### Keyboard

The frame receives focus and reports `aria-label="post media, 3 items"`.
`ArrowRight` and `ArrowLeft` move between items.
The focus ring computed as `rgb(26, 24, 22)` at `2px`, which is `v.ink`.

Single-item frames are not focusable and add no tab stop.

### Video inside a carousel

On the mixed carousel, moving to item 2 and playing:

```
playing:          { paused: false, currentTime: 0.33, controls: true, src: ...webm }
after moving away:{ paused: true,  currentTime: 0 }
```

The video plays, and moving to another item pauses it and resets it.

**This video was unreachable from anywhere in the application before this stage.**

### Swipe

**Not verified by real touch input.**
The swipe handler is implemented on `touchstart` and `touchend` with a 40px threshold, and it was not exercised with synthetic or real touch events.
Desktop arrows and keyboard were verified instead.
This is the one interaction method in section 4.2 that was not observed working.

## Portrait crop, section 5.1

| | Before | After |
|--|--------|-------|
| Rendered box | 315x500 | 315x560 |
| Natural | 900x1600 | 900x1600 |
| `object-fit` | `cover` | `contain` |
| Cropped | yes, 10.7 percent | no |

560 is 315 divided by the true ratio of 0.5625, so the image renders at its full shape.

Landscape and 4:3 were unaffected, as expected: both render 315x177 and 315x236 respectively, matching their natural ratios.

## Aspect box before load, section 5.2

Every media frame now declares `aspect-ratio` computed from the backend's `width` and `height`.

Observed values on the feed: `1.77778 / 1` for 16:9, `1.33333 / 1` for 4:3, `0.5625 / 1` for 9:16.

**Partially verified.**
The declared box was confirmed present on every frame, and the failure case below proves the box holds independently of the media.
A first paint on a cold cache was not filmed, so the absence of shift at first load is inferred from the reserved box rather than watched directly.

## Video in the profile grid, section 5.3

Before: the third tile in Ben's grid was blank. A video URL in a CSS `background-image` painted nothing, and the caption fallback was skipped because a URL was present, so the tile carried no text either.

After: the tile paints the video's opening frame, with a `video` glyph badge in the corner.

The `#t=0.1` media fragment worked against Cloudflare R2.

## Broken media, section 5.4

A loaded image was pointed at a missing URL and the error handler allowed to run.

| | Before failure | After failure |
|--|----------------|---------------|
| Frame box | 317x178 | 317x178 |
| Card height | 336 | 336 |
| `<img>` present | yes | no |
| Content | the photograph | `image unavailable` with an `image` glyph |

**Nothing moved.**
The previous behaviour collapsed the box to roughly 24px and shifted everything below it upward.

Verified on the feed frame. The grid tile shares the same fallback path and the same reserved box, and was verified by code path rather than by breaking a live tile.

## Typed-but-empty tiles, section 5.5

Verified by query that no post typed `image`, `video` or `carousel` lacks media.
All 33 media-less posts are typed `text`.

The three caption tiles on Ben's profile are text posts and still render as caption tiles.
No change was made. See `design-decisions.md`.

## Feed post card, section 6

Computed values read from the live page at 1440:

| Property | Design | Measured after |
|----------|--------|----------------|
| Border radius | 12 | `12px` |
| Border width | none | `0px` |
| Overflow | hidden | `hidden` |
| Cursor | pointer | `pointer` |
| Avatar | 26 | `26` |
| Caption, text post | 16 / 1.5 | `16px` / `24px` |
| Caption, media post | 14 / 1.5 | `14px` / `21px` |
| `data-lxtap` elements | n/a | 7 |

### The card click target

| Action | Result |
|--------|--------|
| Click like | stayed on `/app`, like toggled |
| Click carousel arrow | stayed on `/app`, item advanced |
| Click caption or card whitespace | navigated to `/app/p/6aef5963-...` |

## Feed empty state, section 6

Reached by unfollowing `luvax_ben` through the interface, which left `luvax_ava` following nobody.

Before: the stories carousel, the `today` label, then blank space.

After, at both 1440 and 390:

| Part | Measured |
|------|----------|
| Container | `padding 48px 24px`, `text-align center` |
| Title | `15px`, weight `500`, `margin-bottom 4px` |
| Subtitle | `13px` |
| Stories carousel | still present |

This matches the design's own Explore empty state geometry exactly.

**The follow was restored afterwards**, because the audit's notes record it as load-bearing: without it the feed is empty and unobservable.

```
  status  | follower  | following
----------+-----------+------------
 pending  | luvax_ava | luvax_cleo
 accepted | luvax_ava | luvax_ben
```

A like left on `AUDIT IMAGE landscape` during click testing was also removed. Confirmed: 0 likes remain on any AUDIT post.

## Profile, section 7

Computed values read from the live page:

| Property | Design | Measured after |
|----------|--------|----------------|
| Cover background | `v.surfaceRaised` | `rgb(232, 227, 220)` |
| Avatar | 80, border 3px, no shadow | `80px`, `3px`, `none` |
| Name | 22, `-0.02em`, display font | `22px`, `-0.44px`, `Syne` |
| Name block padding | `12px 16px 0` | present |
| Stat value | mono 16 | `16px` |
| Stat label tracking | `0.08em` | `0.72px` at 9px, which is `0.08em` |
| Tab padding | `12px 0` | `12px 0px` |
| Grid gap / padding | 2 / 2 | `2px` / `2px` |
| Tile radius | 4 | `4px` |
| Tile aspect | uniform `1/1` by decision | `1 / 1`, 223x223 |

The grid tiles without gaps at 1440 and at 390.

### The follow button, before and after

Before, with `luvax_ava` following `luvax_ben`:

> filled primary button reading `follow`

After:

| State | Label | Background | Border |
|-------|-------|-----------|--------|
| following | `following` | `rgb(240, 237, 232)` | `1px` |
| not following | `follow` | `rgb(200, 169, 126)` | `0px` |
| restored | `following` | `rgb(240, 237, 232)` | `1px` |

Toggled in both directions and restored.

## Search results

Before: none of the six posts rendered media. All six were caption-only cards.

After, all six:

| Caption | Media element | Badge |
|---------|---------------|-------|
| AUDIT VIDEO webm | `<video>` | video glyph |
| AUDIT VIDEO MP4 | `<video>` | video glyph |
| AUDIT IMAGE landscape | `<img>` | none |
| AUDIT IMAGE portrait | `<img>` | none |
| AUDIT CAROUSEL mixed | `<img>` | `2` |
| AUDIT CAROUSEL three images | `<img>` | `3` |

Thumb radius `8px` on all six.

## The two-window check

The feed in one window and post detail for the same post in another, both at 1440, on `AUDIT CAROUSEL three images mixed ratios`.

| | Feed | Post detail |
|--|------|-------------|
| Items | 3 | 3 |
| Counter | `1/3` | `1/3` |
| Aspect ratio | `1.33333 / 1` | `1.33333 / 1` |
| First item natural | 1400x1050 | 1400x1050 |
| Like count | 0 | 0 |

Consistent.

The one intentional difference is the corner radius: the feed card clips its own corners so the frame passes `radius 0`, while post detail is a standalone block at `radius 14`, which is the value that file already used.

Repeated for the mixed carousel, where the video played on both surfaces.

## Console

Definition of Done item 15.

Checked with dev tools open, on a fresh load of each surface this stage touched:

| Surface | Errors | Warnings |
|---------|--------|----------|
| Feed | 0 | 0 |
| Post detail | 0 | 0 |
| Profile | 0 | 0 |
| Explore search results | 0 | 0 |
| Feed after a resize to 390 | 0 | 0 |

The resize case previously produced a React warning about mixing the `padding` shorthand with `paddingBottom` on the feed body.
That was fixed and the warning is gone.

Transient `ReferenceError: isTextPost is not defined` entries appear in the session history.
They came from a hot-reload between two edits, where the usage landed before the declaration.
They do not occur on any fresh load and are not present in the final build.

## Untouched surfaces

Definition of Done item 14.

```
$ git diff --name-only develop..HEAD | grep -iE "auth|landing|HomePage|AuthPage|tablet"
NONE - auth, landing and tablet files untouched

$ git diff develop..HEAD -U0 | grep -iE "^\+.*tablet"
NONE - no tablet branch added or modified
```

Eight files changed, all inside `src/features/luvax/components/` and `src/utils/helpers.js`.

## Backend integrity

Definition of Done item 16. The output is pasted in `README.md`.

No backend file was created, modified or deleted.
The one staged `Makefile` predates this session by three days and was already present in the session's opening `git status`.

## What was not verified

Stated plainly.

**Swipe on a touch device.**
The handler is implemented and reviewed but was never exercised with touch events, real or synthetic.

**The explore trending grid.**
It still renders nothing, exactly as the audit found.

```sql
SELECT count(*) FROM post_interaction_scores;
 count
-------
     0
```

The explore endpoint ranks from `post_interaction_scores`, which is populated by a background scheduler that has not run in this environment.
The grid returned zero cards, so `MiniCard` could not be observed with media in it.

The change to `MiniCard` is the same `MediaThumb` component verified on the profile grid and in search results, so the risk is low, but it was not observed and is not claimed as verified.

**First paint on a cold cache.**
The reserved aspect box was confirmed present, and the failure case proves it holds independently of the media, but a first load was not filmed frame by frame.

**The grid tile error fallback with a genuinely broken URL.**
Verified on the feed frame and by shared code path, not by breaking a live grid tile.

**Anything outside this stage.**
Notifications, settings, the report modal, the composer, messages, stories and onboarding were not opened or checked.

**Tablet.**
Not touched and not checked, as instructed.

**Lint.**
Out of scope, not run.
