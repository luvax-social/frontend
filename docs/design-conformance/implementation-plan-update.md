# Implementation Plan Update

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

Replaces the three provisional estimates in `implementation-plan.md` with measured ones, and places everything this phase found into the three-stage sequence.

Run date: 2026-08-13.
Frontend HEAD at the start of this phase: `7e7bf92`.

## The three estimates, replaced

| Screen | Provisional | Measured | Why it changed |
|--------|-------------|----------|----------------|
| Report modal | medium | **small** | It is the closest reproduction in the application. Every padding, radius, font size and colour on all three steps matches. The gap is two missing keyframes, a stroke value, a dead threshold and one string |
| Post detail | large | **medium** | The 810 lines are mostly comment editing, deletion, threading and reporting, none of which the design has and all of which stay. Conformance work is the two-pane desktop layout, the caption typography, and about twenty values |
| Composer | medium | **small** | Structurally identical to the design. Twelve value differences, one of which is the shared `LxBtn` colour bug, and one of which is the settled tablet treatment |

Two of the three were **over**-estimated.
The one that stayed largest, post detail, dropped a full band.

The net effect on the plan is that the conformance work is smaller than the first audit assumed, and the newly discovered media work is larger than anything it replaced.

## What this phase added that was not in the plan at all

Media behaviour was never sized because it had never been looked at.
It is now the largest single block of remaining work.

| Item | Size | Why |
|------|------|-----|
| Carousels render one item everywhere | **Large** | The design defines no carousel at all, so the interaction has to be designed before it can be built. Four call sites each take `media[0]` and stop |
| Video in the profile grid renders blank | Small | A `.webm` URL is handed to a CSS `background-image` |
| Mute is inconsistent across four `<video>` sites | Small | Feed muted, post detail unmuted, explore has no controls at all |
| Nothing pauses a playing video | Medium | No `IntersectionObserver`, no `.pause()` anywhere in `src/` |
| No aspect-ratio box is reserved before load | Small | `width` and `height` are already returned and never read |
| Portrait images are cropped in the feed | Small | A 500px `maxHeight` truncates a 9:16 image by 10.7 percent |
| Search results render no media | Small | `SearchResultPost` has no media branch |
| No media failure fallback | Small | No `onError` on any `img` or `video`; a broken image collapses its card from 177px to 24px |
| `blurhash` is never produced | Medium | The upload body omits the field, so no asset can have one. Needs client encoding and a render treatment, and the design defines no placeholder |
| Profile tiles are all 1:1 | Medium | The design mixes `3/4` and `1/1`; the backend returns no `tall` flag but does return dimensions |
| Photos tab does not filter | Small | Shows the same eight tiles as posts, including caption-only ones |
| No `playsInline` | Trivial | Will force fullscreen playback on iOS |
| Composer cannot create a carousel | Large, and new capability | Single file input, single `mediaId`. No user can create one through the interface |
| Composer helper text is wrong | Trivial | Says `mp4 · max 60s · 50MB`; the real limits are mp4 and webm, 100MB, no duration limit |
| `.mov` is rejected after being offered | Small, backend decision | `accept="video/*"` lets the picker offer it; the server refuses `video/quicktime` before upload starts |

## The three-stage sequence

### Stage 1: icons, buttons, and the shell

Everything that changes every screen at once.

Carried over from the first audit: the seven filled icon variants, the three missing glyphs, the outline `home` path, the `LxBtn` primary text colour, the `LxTag` active border, the app bar and tab strip values, the bottom nav, and the right rail's missing `suggested` block.

Added by this phase:

| Item | Size | Note |
|------|------|------|
| `LxBtn` primary text colour, `v.ink` to `v.inkInverse` | Small | Now known to affect the composer's post button too, which reimplements the same colours inline at `ComposerScreen.jsx:155`. Both sites must change together, and the report modal is already correct and must not be touched |
| Make `<video>` mute consistent across the four call sites | Small | Decide the rule once, apply everywhere |
| Add `playsInline` to every `<video>` | Trivial | One attribute, four sites |

The `LxBtn` change now has three call sites to reconcile rather than one.
That is the only thing this phase changed about stage 1, and it makes the change slightly larger, not smaller.

### Stage 2: feed and profile

The two screens a reviewer sees first.

Carried over: the post card's twenty differences, the feed empty state, the profile's twenty-three differences, and the follow button that never shows a followed state.

Added by this phase, all of it media:

| Item | Size | Note |
|------|------|------|
| Stop cropping portrait images in the feed | Small | Replace the fixed 500px cap with a ratio-aware cap |
| Reserve an aspect-ratio box before media loads | Small | Removes the layout shift on every first paint. Uses `width` and `height`, already returned |
| Give the profile grid a video branch | Small | Currently a blank square with no indication a video is there |
| Media failure fallback | Small | A broken image currently collapses the card and shifts everything below it |

These four belong in stage 2 rather than stage 3 because they are defects a reviewer sees on the two screens stage 2 already touches, and because three of the four are in files stage 2 is opening anyway.

**Carousels are deliberately not here.**
They render on the feed and the profile, so they belong here by surface, but they need an interaction designed first and that would block stage 2 behind a design decision.
They are in stage 3 for that reason, and the mitigation is that a carousel currently renders as a plausible single-image post rather than as something visibly broken.

### Stage 3: everything else

Carried over: notifications, explore, settings, the `ConfirmModal` primitive, the toast mechanism, and the like-state fix.

Added by this phase:

| Item | Size | Note |
|------|------|------|
| Report modal conformance | **Small** | Two keyframes, a stroke, a threshold, a string |
| Composer conformance | **Small** | Twelve values, minus the two handled in stage 1 |
| Post detail conformance | **Medium** | Two-pane desktop layout for image posts, caption typography, entry animation, about twenty values |
| Carousel rendering with an indicator | **Large** | Needs the interaction designed first. No design reference exists |
| Pause video when its card leaves the viewport | Medium | |
| Media in search results | Small | |
| Mixed profile tile ratios | Medium | |
| `loading="lazy"` below the fold | Small | |
| Make the photos tab filter | Small | |
| `blurhash` production and use | Medium | Product decision first: the design defines no placeholder |
| Correct the composer helper text | Trivial | |
| Resolve `.mov` | Small | Either accept it or stop offering it in the picker. Backend decision |
| Poster frame for video | Medium | Needs a backend thumbnail or a client-side capture |
| Composer carousel authoring | **Large** | New capability, not conformance |

### The like-state fix, now confirmed

It stays in stage 3 and its medium size is unchanged, but the fix is now better understood.

`PostDetailScreen.jsx:362-363` holds `liked` and `likeCount` in component state exactly as `PostCard` does, so opening post detail from the feed produces two independent copies of the same post's like state.

The same file already does it correctly for comments at lines 59-60, reading `comment.isLiked` and `comment.likeCount` straight from query data.
So the fix has a working pattern to copy from twenty lines away, in the same file.
That lowers the risk, not the effort: the optimistic rollback in both `PostCard` and `PostDetailScreen` must survive the move into the mutation lifecycle.

## Revised totals

| Bucket | First audit | After this phase |
|--------|-------------|------------------|
| Trivial | 3 | 6 |
| Small | 14 | 26 |
| Medium | 8 | 13 |
| Large | 1, deferred | 3, of which one deferred and two are carousel work |
| Unknown, needs measurement | 3 screens | **0** |

Every provisional estimate is now a real one.

The shape of the remaining work has changed: the design-conformance gap is narrower than the first audit assumed, and a media gap that was never on the plan is now the largest item on it.

## What is still not measured

Stated plainly rather than left implicit.

| Item | Why not | What would settle it |
|------|---------|---------------------|
| Media in the explore grid | The explore endpoint returned no posts for this account, so it could never be observed with media | The `post_interaction_scores` background scheduler needs to have run |
| `playsInline` behaviour on iOS | No device available | A real iPhone or the Xcode simulator |
| Video pausing on scroll, observed rather than read | The feed at this data volume is only about 1845px tall against a 900px viewport, so the card could not be pushed off screen | Roughly twenty more posts in the feed |
| `LxHeaderSearch` frontend geometry | Carried over from the first audit, still not measured | One render measurement at 1440 |
| Report modal step 2 and step 3 against the design, pixel by pixel | Completed this phase | Nothing outstanding |

## Working tree state

Verified at the end of this phase.

Frontend:

```
$ git status --short --branch
## develop...origin/develop [ahead 1]
?? docs/design-conformance/media-behaviour.md
?? docs/design-conformance/remaining-screen-differences.md
?? docs/design-conformance/test-media-created.md
?? docs/design-conformance/video-behaviour.md
?? docs/video-test/
```

The four untracked files under `docs/design-conformance/` are this phase's reports, plus this file, and are what the commit adds.

`docs/video-test/` is the sample video directory supplied for this audit.
It was untracked before this phase started and is deliberately **not** committed: it is 38MB of sample media, this phase only used three of its six files, and the brief names the reports as the only deliverable.
It is left in place untouched.

The browser automation wrote screenshots into the frontend working directory during the run.
They were moved to the scratch directory and the tree was re-verified before committing.

Backend:

```
$ git status --short --branch
## develop...origin/develop
A  Makefile
```

The backend tree was **not** clean, exactly as at the end of the previous phase.
The staged `Makefile` predates both audits.
This phase read backend source and called the backend's public API; it never wrote to the backend repository.

## Data left behind

Six posts and seven media assets were created, and `luvax_ava` now follows `luvax_ben`.

All of it is recorded in `test-media-created.md` and left in place.
Every caption is prefixed `AUDIT ` so the data is separable from the `[luvax-seed]` rows and from anything created later.
