# Verification Evidence

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

Both applications were running.
The frontend was served by Vite on port 5173 with hot module replacement, and the backend answered on port 8080 with `{"status":"UP"}`.

Verification was done in a real browser at 1440 x 900 for desktop and 390 x 844 for mobile, logged in as `seed_alice`.

Screenshots are in the session scratch directory, not committed:

```text
stage1-desktop-feed-after.png
stage1-desktop-appbar-after.png
stage1-mobile-feed-after.png
```

## A note on the "before" side

This is the weakest part of this evidence and it is stated plainly rather than glossed.

No screenshots were captured before the code changed.
The dev server already running on port 5173 was serving the modified source by the time verification began, so the pre-change interface was no longer reachable without reverting the branch.

What is recorded instead, for every change, is the previous value read directly from the committed source before it was edited, listed in `changes-applied.md`, alongside the measured value after.
For the numeric changes that is stronger evidence than a screenshot pair, because a 2px blur difference or a 1px icon difference is not reliably visible in a screenshot but is exact in a computed style.
For the three removed decorations it is weaker, and the removal is evidenced by element counts rather than by a visible diff.

## Desktop, measured

Read from the live DOM with `getComputedStyle` and `getBoundingClientRect`, not judged by eye.

```text
barBlur:            blur(12px)          design blur(12px)
barClass:           lx-bar
innerPadding:       0px 16px            design '0 16px'
innerGap:           12px                design 12
tabStripGap:        4px                 design 4
tabStripMaxWidth:   560px               design 560
tabButtonBox:       109 x 56            design flex 1 capped 110, height 56
tabIconSize:        22                  design 22
tabSvgStyleColor:   var(--lx-accent)    design sets style.color
tabUnderlineSpans:  0                   design has none
rightGroupGap:      10px                design 10
bell:               36 x 36, radius 50%, border none, bg rgb(240,237,232)
                                        design 36 x 36, '50%', 'none', v.surface
bellIconSize:       18                  design 18
```

`rgb(240, 237, 232)` is the resolved value of the surface token.

### The tab hit target

Measured at **109 x 56**.

The audit recorded this as a regression from 109px to 44px.
The measurement shows the opposite: the buttons were a fixed 44px wide before this change and are about 109px now, because the design lets them flex to fill a 560px strip with a 110px cap.

The change makes the target larger.
Nothing in this stage made any target smaller.

### The filled artwork

Read from the rendered SVG children of the active tab.

```text
home, active:
  path  fill=currentColor      stroke=none
  rect  fill=var(--lx-base)    stroke=none
  svg   fill=none              stroke=var(--lx-accent)

inactive tabs:
  children carry no fill and no stroke of their own, inheriting the SVG stroke
```

The bell, checked specifically because its defect was the most visible, with the notifications tab active:

```text
path  d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"   fill=currentColor  stroke=none
path  d="M13.73 21a2 2 0 0 1-3.46 0"                     fill=none          stroke=currentColor  stroke-width=2
```

The clapper is an open arc again.
Previously both paths were filled, which is what turned it into a solid wedge.

The app bar screenshot shows the filled home in accent with the door knocked out, the other four as outlines, and no underline anywhere.

## Mobile, measured

At 390 x 844:

```text
navBlur:          blur(12px)    design blur(12px)
iconSize:         22            design 22
activeBarCount:   0             design has none
spansPerButton:   [0,0,0,0,0,0] no decoration spans remain on any button
buttonCount:      6
activeSvgChild:   path fill=currentColor stroke=none
```

`spansPerButton` is all zeros because `seed_alice` had nothing unread during this run, so the retained unread badge was not rendering.
That means the badge's retention is evidenced by source and by the active-bar count being zero, not by observing the badge itself.

The mobile screenshot shows six outline or filled icons at the new size with no bar above the active tab.

## The two-window check

Required by section 3.1 and item 9 of the definition of done.

The feed and post detail for the same post, `6ba15040-8fa6-4ba4-a9bd-6600e60c3837`, were open simultaneously in two tabs at desktop width.

| Property | Feed | Post detail |
|----------|------|-------------|
| Bar blur | `blur(12px)` | `blur(12px)` |
| Inner padding | `0px 16px` | `0px 16px` |
| Inner gap | `12px` | `12px` |
| Bell width | 36 | 36 |
| Bell radius | `50%` | `50%` |
| Bell border | `none` | `none` |
| Bell background | `rgb(240, 237, 232)` | `rgb(240, 237, 232)` |
| Bell glyph | 18 | 18 |

Identical on every value.

The tab strip is absent on post detail, and that is existing behaviour rather than a mismatch: post detail is a subpage, so the app bar renders its back header instead of the tabs, which is what it did before this change.

## Primary buttons

The accent fill is `#C8A97E` and the inverse ink is `#F9F7F4`.

| Button | Measured | Verdict |
|--------|----------|---------|
| Composer post button, enabled | `color: rgb(249,247,244)` on `rgb(200,169,126)` | Inverse ink on accent |
| Composer post button, disabled | `color: rgb(155,144,136)` on `rgb(232,227,220)` | ink3 on surfaceRaised, matching the design's disabled primary |
| Profile follow button | `color: rgb(249,247,244)` on `rgb(200,169,126)` | Inverse ink on accent |

The composer's button is the inline reimplementation, so both the primitive and the copy were confirmed separately.

## Tag active border

With one hashtag chip selected in the composer:

```text
#observation   borderColor rgba(0, 0, 0, 0)      selected, transparent as the design specifies
#photography   borderColor rgb(221, 215, 207)    unselected, the border token, unchanged
#writing       borderColor rgb(221, 215, 207)
#light         borderColor rgb(221, 215, 207)
```

## Header hide-on-scroll

Driven with a temporary spacer so the page could scroll regardless of content, then removed.

```text
at top:            class "lx-bar"
scrolled to 400:   class "lx-bar lx-bar-hidden", transform matrix(1, 0, 0, 1, 0, -56)
scrolled up to 200: class "lx-bar"
back to top:       class "lx-bar"
```

`translateY(-100%)` resolves to -56px, the bar's own height, which is correct.

## Console

Item 11 of the definition of done.

Zero errors and zero warnings across the feed, post detail, compose and a user profile, at both widths.

```text
Total messages: 3 (Errors: 0, Warnings: 0)
```

Two 401 responses appeared earlier in the session, before the local database had been seeded, from a login attempt against an empty user table.
They are authentication responses to a request with no valid account, not render errors, and they stopped once accounts existed.

No React render error appeared on any surface touched.

## Build

`npm run build` was run after each work item and passed each time.

```text
✓ 288 modules transformed.
✓ built in 506ms
```

## What was not verified

Stated plainly, as instructed.

**`playsInline` was not tested.**
It changes behaviour only on iOS Safari, which takes over the screen with its native fullscreen player without it.
No iOS device was available.
The attribute is present on all four elements, confirmed both in source and in the DOM, but its effect is unverified.

**No video was observed playing.**
The seeded database has no video media, and creating one needs a presigned upload the local environment cannot complete.
The mute rule was verified as attributes on all four call sites in source and through the build, not by hearing or failing to hear audio.
The specific failure the rule addresses, two mounted copies of one video disagreeing, was therefore not reproduced or observed fixed.

**The retained unread badge was not seen rendering.**
The test account had nothing unread during verification.

**Before screenshots do not exist**, for the reason given at the top.

**Tablet was not verified in a browser**, because it is out of scope.
It was protected structurally instead: every value this stage changed sits behind a conditional whose tablet arm keeps its previous literal value.

One tablet regression was introduced and then corrected.
Removing the active tab underline removed it from tablet too, because the span was shared by both branches.
It was restored behind the tablet conditional, and desktop was re-measured afterwards at zero underline spans and 109 x 56 tabs.
The tablet arm itself was confirmed by reading the diff, not by rendering at a tablet width.

**The auth and landing pages were not verified beyond loading.**
They are frozen.
The login page was used to sign in and rendered normally, which is worth noting because the button primitive changed underneath it, but no deliberate inspection was made.

**Dark mode was not checked.**
Every value changed is a token reference or a geometric number, so no colour was hardcoded, but the interface was only observed in its default theme.
