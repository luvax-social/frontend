# Verification Evidence

> Record of work done on 2026-08-14. Not maintained; it is correct as of that date and is not updated as the code moves.

Every path below was exercised through a real browser against both applications running, with real files.

The browser was driven with dev tools attached, and the console was checked at the end of the session.

Account: `luvax_ava`, logged in through the login form rather than by injecting a token.

## Files used

| File | Size | Origin |
|------|------|--------|
| `img-01.png` to `img-11.png` | about 4.5KB each | Generated. Each carries its own number large enough to read in a screenshot |
| `photo.jpg` | 22KB | Generated |
| `photo.webp` | 2.5KB | Generated |
| `animated.gif` | 5KB | Generated, four frames |
| `photo.heic` | 2KB | Generated stub. The refusal path keys on the type the picker reports, not on the bytes |
| `oversize.png` | 104857601 bytes | Generated, exactly one byte over the published ceiling |
| `empty.png` | 0 bytes | Generated, to make exactly one file in a batch fail |
| `file_example_MOV_1280_1_4MB.mov` | 1.4MB, 30.6s | Pre-existing in `docs/video-test/` |
| `file_example_MP4_1280_10MG.mp4` | 9.8MB, 30.5s | Pre-existing in `docs/video-test/` |

## Section 5: one compose surface

### The surface has no type tabs

Loading `/app/compose` renders a caption field, one attach control, and a submit button.
The accessibility tree contains no tab controls.

Submit button on an empty composer: `post text`, disabled.

### Helper text is built from the endpoint

Observed string:

```
gif, jpeg, png, webp · mp4, quicktime, webm · max 180s video · 100MB
```

Every element matches the values `GET /media/constraints` returned in the same session.

### Caption first, then attach, then post

1. Typed `carousel order check one two three #photography` into the caption.
2. Attached `img-01.png`, `img-02.png`, `img-03.png` in one selection.
3. The caption was still present, unchanged, after attaching.
4. The submit button changed from `post text` to `post carousel of 3`.

No mode was changed at any point, because there is no mode.

### Removing every attachment returns a text post

With one image attached the button read `post photo`.
After removing it:

```json
{"submit": "post text", "tiles": 0, "dropZoneBack": true, "placeholder": "say something real..."}
```

The surface returned to a text post with no action from the person beyond the removal.

### Derived type against what the backend stored

Six posts were created through the browser during this session.
Their stored types, read back from `GET /posts/user/{id}`:

```
text      items= 0  a text post with no attachments at all #writing
image     items= 1
carousel  items= 2  this caption must survive a failed upload
carousel  items= 3
carousel  items=10
carousel  items= 3  carousel order check one two three #photography
```

Nothing attached stored as `text`.
One image stored as `image`, not as a carousel of one.
Two, three and ten stored as `carousel`.

## Section 6: many files

### Multiple files in one selection

Three files in a single selection produced three tiles, numbered `1/3`, `2/3`, `3/3`.

Ten files in a single selection produced ten tiles and a `post carousel of 10` button.

### Adding more without losing what is there

Attaching, then attaching again, appends.
Verified during the failure test, where the caption and prior tiles survived a second interaction.

### Images and video mixed in one post

Attached `animated.gif`, `file_example_MOV_1280_1_4MB.mov`, and `photo.webp` together.

Composer state: 2 image tiles, 1 video tile, no rejection, `post carousel of 3`.

Stored result:

```
post 45b2061a-6ade-42ae-aabe-42794afd499c type carousel
  pos 0 image gif  blurhash None
  pos 1 video mov  blurhash None
  pos 2 image webp blurhash None
```

### The picker offers exactly what the server accepts

The `accept` attribute is built from the two published lists and contains exactly seven types, with no additions.

### Individual removal

`remove attachment 2` removed only the second item.
The remaining two kept their uploaded state and were posted without re-uploading.

### Reordering, by a method that works on a phone

Three images attached in source order 1, 2, 3.

Two taps on move controls produced the on-screen order 3, 1, 2.
Confirmed by screenshot: the tiles read 3, 1, 2 at positions `1/3`, `2/3`, `3/3`.

The post was then created, and the stored bytes were hashed against the source files:

```
position 0 -> img-03.png
position 1 -> img-01.png
position 2 -> img-02.png
```

The order shown in the composer is the order stored, proved by content rather than by trusting an id list.

The ten-item carousel was checked the same way and stored as `01 02 03 04 05 06 07 08 09 10`.

### Both carousel bounds

| Case | Result |
|------|--------|
| 1 item | Not a carousel. Stored as `image` |
| 2 items | Created, stored as `carousel` |
| 10 items | Created, stored as `carousel`, order exact |
| 11 items | Prevented before upload |

Selecting eleven files produced:

```
a post holds 10 items at most, so 10 of the 11 you chose were added.
```

Ten tiles were added, and the add control changed to `10 is the maximum` and became disabled.
No request was made for the eleventh file.

### Per-file progress, and one failure among several

Attached `img-04.png`, `empty.png`, `img-05.png` with the caption `this caption must survive a failed upload`.

`empty.png` is zero bytes, which the server refuses at the presign step, so exactly one file in the batch fails while the others succeed.

After pressing post:

```json
{
  "stillOnComposer": "/app/compose",
  "alert": "some files didn't upload. retry or remove them, then post again.",
  "caption": "this caption must survive a failed upload",
  "tiles": 3,
  "retryButtons": 1,
  "tileStatus": ["ready", "failed", "ready"]
}
```

The caption survived.
All three tiles survived.
The two successful uploads stayed marked `ready`, and only the failed one offered a retry.

Removing the failed tile and posting again created the post from the two already-uploaded files without re-uploading them:

```
post 58647595-b089-41fe-b53b-2b6fce556f38 type carousel items 2
caption: this caption must survive a failed upload
  pos 0 img-04.png
  pos 1 img-05.png
```

### Submission is blocked while uploads are outstanding

The submit button switches to `uploading {n} of {m}` and is disabled while any item is in the uploading state.

## Section 7: formats

### `image/gif`

Uploaded through the browser and stored as an `image` media item with a `.gif` object.
Rendered in the profile grid with `naturalWidth: 400`, confirming the browser decoded it.

### `video/quicktime`

Uploaded through the browser as part of the mixed carousel.

Played in the rendered carousel:

```json
{"src": "mov", "readyState": 4, "duration": 30.528, "advancedFrom": 0, "currentTime": 0.861071, "playing": true}
```

`currentTime` advanced from 0, so the file is genuinely playing rather than merely present.

### The QuickTime trap, observed

In the same browser, at the same moment:

```json
{"canPlayQuicktime": "", "canPlayMp4": "maybe", "readyState": 4, "duration": 30.528}
```

`canPlayType('video/quicktime')` returns the empty string, meaning the browser reports it cannot play the format, while that same browser has the same file loaded with full metadata and plays it.

No code path in `src/` calls `canPlayType`, so nothing gated on this answer.
Had anything done so, the `.mov` would have been refused.

### HEIC

Selecting `photo.heic`:

```json
{
  "alert": "photo.heic: that file type isn't accepted. accepted types are image/gif, image/jpeg, image/png, image/webp, video/mp4, video/quicktime, video/webm.",
  "tiles": 0
}
```

Refused before upload, and the message names every accepted type.

The picker reported no MIME type for this file on this system, so the message says `that file type` rather than `image/heic`.
That is the honest rendering of what the browser supplied.

### Wrong format, too large, too long

| Case | Outcome |
|------|---------|
| Wrong format | Refused before upload, accepted types named |
| Too large | Refused before upload, real limit named |
| Too long | **Not verified in the browser.** See below |

The oversize case:

```json
{"alert": "oversize.png is over the 100MB limit.", "tiles": 0, "uploadCalls": 0}
```

`uploadCalls: 0` confirms the refusal happened before any byte was sent, and the `100MB` figure is rendered from `maxFileSizeBytes`.

## Console

Zero errors and zero warnings across the whole session, checked with `all: true` after every path above had been exercised.

No React render error appeared on any surface touched: the composer, the feed, the profile grid, and post detail.

## What was not verified

**A genuinely over-length video was never tested.**
No video longer than 180 seconds was available and no encoder is installed on this machine, so one could not be produced.

What was verified is that the composer measures duration correctly: it read `30.528` seconds from the `.mov` before uploading it.
The threshold comparison itself was exercised only in isolation, where a declared 181 seconds against a 180 second limit produces `v.mp4: 181s is over the 180s limit.`

The two halves of the check are each verified.
The combination, a real file over the limit refused in the browser, is not.

**Video duration is not checked when the browser cannot read the container.**
`getMediaMetadata` failures are caught and the file is allowed through rather than blocked on an unreadable value.
Since the server never opens the file either, such a video would pass unchecked.
This did not occur with any file tested, and it is recorded in `deferred-findings.md`.

**A zero-byte file is not refused client-side.**
It was used deliberately here to force a server-side failure, and it worked because the composer's size check only tests the upper bound.
Recorded in `deferred-findings.md`.

**Retry was observed offered but not observed succeeding.**
The failing file was invalid by construction, so retrying it would fail again.
The retry control appeared on exactly the failed tile and on no other.
A transient failure that succeeds on retry was not simulated.

**Tablet was not exercised.**
Out of scope for this phase, and the tablet treatment is settled.

**Elasticsearch was not running** for the whole session, so `/actuator/health` reported `DOWN` throughout.
Nothing in the composer path touches it.
