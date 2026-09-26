# Verification Evidence

> Record of work done on 2026-08-14. Not maintained; it is correct as of that date and is not updated as the code moves.

Every change below was exercised in a real browser against both applications running, with dev tools attached.

Account: `luvax_ava`, logged in through the login form.
Desktop width 1280 by 900, mobile width 390 by 560.

## The like state, in two renderings at once

This is Definition of Done item 1 and the reason the work item came first.

**How the two renderings were obtained.**
Post detail is an overlay route mounted over the feed, so opening a post from a feed card leaves both the card and the detail view mounted and visible in the same document.
That is the exact situation the defect describes, and it is what was tested.

**Before the like, both agree.**

```json
{ "feedCount": "1", "overlayText": "1" }
```

**Liking in the overlay moves the feed card too.**

```json
{ "afterLike": { "overlayCount": "0", "feedCount": "0" } }
```

**And the reverse, in both directions.**

```json
{
  "afterRelike":          { "feed": "1", "overlay": "1" },
  "afterFeedSideUnlike":  { "feed": "0", "overlay": "0" }
}
```

Liking from the overlay updates the feed card, and liking from the feed card updates the overlay.
Before this change, only the instance that was clicked moved.

**Rollback on failure.**

The like request was failed at the transport layer by replacing `XMLHttpRequest.prototype.send` for URLs containing `like`, dispatching an error event instead of sending.
The blocked URL was `/api/v1/posts/f15ebaa1-a4f0-4562-a389-1c6765cd43e0/like`.

```json
{
  "before":       { "feed": "0", "overlay": "0" },
  "optimistic":   { "feed": "1", "overlay": "1" },
  "afterFailure": { "feed": "0", "overlay": "0" }
}
```

Both renderings move optimistically, and both roll back together.

The first attempt at this sampled the optimistic state 300ms after the click and saw the pre-click value, because the induced failure fired after 10ms and the rollback had already run.
The failure was delayed to 1500ms so the intermediate state could be observed.
That was a measurement problem, not a defect.

**Console during the rollback test.**

```
[ERROR] [QueryClient] Unable to reach the server. Please check your connection.
[ERROR] [QueryClient] Unable to reach the server. Please check your connection.
```

Both are the induced failures, surfaced by the application's own handler.
No React render error.

**Not verified: two separate browser windows.**
The brief's phrasing asks for two windows.
Two windows are two JavaScript contexts with two independent query caches, so a cache patch in one cannot reach the other by design.
Without a realtime consumer, which this frontend does not have, agreement across two windows could only come from a refetch, not from this change.
What was tested is the two simultaneous renderings inside one window, which is the situation the defect actually describes.

## ConfirmModal

**The overflow menu now gates the block.**

Opening the menu on another author's post:

```json
{ "menuBlockRows": ["Block @luvax_ben"] }
```

Clicking it opens the confirmation rather than blocking:

```json
{
  "message": "block user Are you sure you want to block Luvax Ben? They won't be able to find your profile, posts or story on Luvax. cancel block",
  "armingState": { "label": "block", "disabled": true,  "opacity": "0.5" },
  "armedState":  { "label": "block", "disabled": false, "opacity": "1" },
  "closedByEscape": true
}
```

The confirm button is disabled at `opacity 0.5` immediately after opening, and enabled at `opacity 1` after the 500ms delay.

**The block wording is unchanged**, matching the string captured before the migration.

**Escape closed it without acting**, and `luvax_ben` was not blocked.

## Escape

Verified on `ConfirmModal` directly, as above.
`LxModal` and `LxBottomSheet` receive the behaviour inside the primitive, so every call site built on them inherits it.

**Not individually verified:** each `LxModal` and `LxBottomSheet` call site was not opened one by one and dismissed with Escape.
The hook is applied inside the primitives rather than per call site, so the coverage argument is structural rather than observed.
The report modal's hook was added directly and was not opened and dismissed with Escape either.

The dropdown's own Escape handling was left untouched and not retested.

## Video pauses off screen

**Two earlier attempts were invalid and are recorded so the evidence is not misread.**

Attempt one scrolled the window while the video sat in post detail, which is a fixed overlay.
The element never moved: `rectBefore 203`, `rectAfterTop 203`.

Attempt two scrolled post detail's own pane, which moves only 91 pixels.
The video stayed on screen.

At desktop size the feed did not scroll at all, because its content fitted the viewport (`document.scrollHeight` equalled the 889px window).

**The valid test.**
A video post was created as `luvax_ben`, whom `luvax_ava` follows, so it appeared in her feed.
The viewport was set to 390 by 560 so the feed genuinely scrolled.

```json
{
  "playingBefore": true,
  "before": 172,
  "afterTop": -696,
  "leftViewport": true,
  "pausedAfter": true
}
```

The video was playing, left the viewport entirely, and paused.

## Lazy loading

On a ten-image carousel in post detail:

```json
{
  "mediaImages": 10,
  "allLazy": true,
  "allAsyncDecode": true,
  "frameHeight": 318
}
```

The reserved frame still has a stable non-zero height, so the aspect box Stage 2 added is not regressed.

An earlier check on the feed reported `allLazy: true` over zero images, which is vacuous.
The feed at the time held only text posts and one video.
The carousel check above is the real one.

## The profile tabs

**Against the API**, which establishes what the correct answer is:

```
user posts ''                     -> 12  ['text','image','carousel','carousel','carousel','carousel','video','image','carousel','carousel','carousel','text']
user posts '?type=image,carousel' ->  9  ['image','carousel','carousel','carousel','carousel','image','carousel','carousel','carousel']
liked                             ->  1  rows keyed ['likedAt','post']
```

The filter removes exactly the two text posts and the one video.

**In the browser**, requests observed in the network panel:

```
GET /api/v1/posts/user/{id}?limit=10                       => 200
GET /api/v1/posts/user/{id}?type=image,carousel&limit=10   => 200
GET /api/v1/posts/liked?limit=10                           => 200
```

Grid tiles per tab: `posts` 10 (first page of 12), `photos` 9, `liked` distinct from both.

A first counting attempt reported 3 for every tab because the selector matched the profile's three-item stats row rather than the post grid.
The count was redone against the largest grid on the page.

## What was not verified

**The six work items that were not implemented** were not verified, because they were not built.
They are listed in `README.md` and `deferred-findings.md`.

**Mobile width was exercised only for the video pause check.**
The brief asks for every change to be observed at desktop and mobile.
The like state, ConfirmModal, Escape, lazy loading, and the profile tabs were all observed at desktop width only.

**No before-and-after screenshot pairs were captured.**
The evidence above is DOM and network state rather than images.
The brief asks for before and after at both widths; that standard was not met.

**Notifications, explore, settings, and the report modal were not opened at all** during this stage's verification, so no statement is made about their console state.

**The console was checked** on the feed, post detail, and the profile.
The only errors seen were the two deliberately induced network failures quoted above.
