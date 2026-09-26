# Video Behaviour

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

## The direct answer

**Video works.**

It uploads through the browser composer, it reaches storage, it is registered, it plays in the feed and in post detail, and it carries native controls.

It is not finished.
Five specific things are broken or missing, and one of them will produce audible failure in front of a reviewer.

| Question | Answer |
|----------|--------|
| Does uploading a video through the composer succeed end to end, in the browser? | **Yes**, for `.mp4` and `.webm` |
| Does the created post carry the video, and does it play? | **Yes**, in the feed and in post detail |
| Are controls present? | **Yes**, the browser's native control set |
| Does it autoplay? | **No** |
| Is it muted? | In the feed yes, in post detail **no**, inconsistently |
| Does playback stop when the viewer scrolls away? | **No**. Nothing ever stops a playing video |
| Does a video render in a grid tile? | **No**. The profile grid tile is blank |
| Is a poster or thumbnail shown before playback? | **No**. There is no poster anywhere |
| Does the backend return dimensions and duration? | **Yes**, and correctly |
| Does the frontend use them? | **No**. They are never read |
| Does `.mov` work? | **No**. Rejected by the backend before upload starts |

## Evidence: the upload succeeds

**[observed]** Signed in as `luvax_ava` at a 1440 x 900 viewport, the composer's `video` tab was opened, `docs/video-test/mp4/file_example_MP4_1280_10MG.mp4` was chosen through the real file picker, a caption was typed, and `post it` was pressed.

The network log shows the documented pre-signed flow completing in order:

```
POST http://localhost:5173/api/v1/media/upload            => 200 OK
PUT  https://<account>.r2.cloudflarestorage.com/luvax-develop/users/<id>/media/<uuid>.mp4?X-Amz-...  => 200 OK
POST http://localhost:5173/api/v1/media/upload-complete    => 201 Created
POST http://localhost:5173/api/v1/posts                    => 201 Created
```

The registration response:

```json
{
  "id": "d110a10a-0969-40f1-ad30-af5f24a046ab",
  "mediaType": "video",
  "mimeType": "video/mp4",
  "fileSize": 9840497,
  "width": 1280,
  "height": 720,
  "duration": 31,
  "blurhash": null,
  "cdnUrl": "https://pub-<hash>.r2.dev/users/<id>/media/<uuid>.mp4"
}
```

No step required a workaround.
The preview rendered in the composer before submission with native controls reading `0:00 / 0:30`.

## Evidence: it plays

**[observed]** In the feed, the `<video>` element was driven directly:

```
before: { readyState: 4, duration: 30.543, currentTime: 0, paused: true }
play(): no error
after:  { readyState: 4, currentTime: 2.28, paused: false, videoWidth: 1280, videoHeight: 720 }
```

The same was done on the post detail overlay and behaved identically.
Playback is real, not a still frame.

## What is wrong

### 1. The same video is mounted twice, with different mute states

**[observed]** Opening post detail from the feed leaves the feed card mounted behind the overlay.
Both render the same `cdnUrl`.
Probing the page returned two `<video>` elements for one post:

| Instance | Size | `muted` | `controls` | Radius |
|----------|------|---------|------------|--------|
| Feed card, behind the overlay | 315 x 177 | `true` | yes | 0 |
| Post detail overlay | 522 x 294 | **`false`** | yes | 14 |

Both can be played independently and simultaneously.
Because the overlay instance is not muted, a viewer who presses play there gets audio, while the feed copy behind it can also be playing silently.

**[source]** The mute attribute is set per call site and the four sites disagree:

| File and line | Element | `controls` | `muted` |
|---------------|---------|-----------|---------|
| `ComposerScreen.jsx:275` | preview | yes | no |
| `PostCard.jsx:268` | feed card | yes | **yes** |
| `PostDetailScreen.jsx:664` | post detail | yes | **no** |
| `ExploreScreen.jsx:38` | explore grid card | **no** | yes |

### 2. Nothing stops a playing video, ever

**[source]** A search of `src/` for `.pause()`, `IntersectionObserver`, `autoPlay`, `poster=` and `playsInline` returns **no matches at all**.

There is no scroll handler, no visibility observer, and no route-change teardown for media.
A video started in the feed keeps playing when it is scrolled out of view, and keeps playing when an overlay opens over it.

**[observed]** A scroll test was attempted and was **inconclusive**, because the feed page at this data volume is only about 1845px tall against a 900px viewport, so the video could not be pushed fully out of the viewport.
The source finding above is the basis for this answer, not the scroll test.
To observe it directly you would need a feed long enough to scroll the card off screen, which needs roughly twenty more posts.

### 3. A video in the profile grid renders as a blank tile

**[observed]** Ben's profile grid at 1440 contains eight tiles, each 225 x 225 with `background-size: cover` and radius 0.
The tile for the video post has:

```
background-image: url(".../ab6fdc1f-1a7b-46e4-be5b-cf6e89989b59.webm")
```

**[source]** `ProfileScreen.jsx:241` builds every tile as a CSS background:

```js
background: mediaUrl ? `url(${mediaUrl}) center/cover no-repeat` : 'color-mix(...)'
```

`mediaUrl` is `p.media[0].cdnUrl` with no type check, so a video URL is handed to `background-image`.
CSS cannot decode a video as a background image, so the tile paints nothing.
Because the URL is present, the caption fallback in the same expression is also skipped, so the tile carries no text either.

The result is an empty square in the grid with no indication that a video is there.

### 4. There is no poster, and no use of the metadata the backend already returns

**[observed]** Every `<video>` probed had `poster: null` and `preload: "metadata"`.

**[source]** No `poster` attribute is set anywhere.
The first frame appears only once the browser has fetched enough of the file; until then the element is a black box at whatever size the layout gives it.

The backend returns `width`, `height` and `duration` on every video asset, verified above as `1280`, `720`, `31`.
**[source]** Nothing in `src/` reads `media.width`, `media.height` or `media.duration`.
Consequences:

- No aspect-ratio box is reserved before the file loads, so the layout shifts when it arrives.
- No duration badge is shown anywhere, although the design has no such badge either.

### 5. `playsInline` is absent

**[source]** Not set on any of the four `<video>` elements.

On iOS Safari a video without `playsinline` takes over the screen in the native fullscreen player as soon as it plays.
This has not been observed on a device and is a known platform behaviour rather than a measurement.
Determining it needs a real iOS device or the Xcode simulator.

## What `.mov` does

**[observed]** A `.mov` upload was attempted through the same API path used by the composer.
It fails at the **first** step, before any bytes are transferred:

```
POST /api/v1/media/upload  =>  400
{"success":false,"code":"MEDIA_INVALID_METADATA",
 "message":"Media MIME type is not allowed"}
```

**[source]** `MediaProperties.java:21` allows exactly two video types:

```java
private List<String> allowedVideoMimeTypes = List.of("video/mp4", "video/webm");
```

`video/quicktime` is not in the list, and `MediaMetadataValidator.validateMimeType` rejects anything outside it.

### What this looks like to a user

The composer's file input uses `accept="video/*"`, so the OS picker **offers** `.mov` files and lets the user choose one.
The preview renders, because the browser can decode it locally.
The user then presses `post it` and gets:

> we couldn't read that file. try a different one.

**[source]** That string comes from `useMediaUpload.js:23`, mapped from the `MEDIA_INVALID_METADATA` code.

The message never says which formats are allowed.
The composer's own helper text reads `mp4 · max 60s · 50MB`, which is wrong in two of its three claims: `webm` is also accepted, and the real size ceiling is 100MB, not 50MB.
The 60s duration claim is unenforced on both sides.

`.mov` is the default capture format for every iPhone, so this is the single most likely upload failure a real user would hit.

## Limits, as actually configured

**[source]** From the backend, not from the composer's label.

| Constraint | Value | Where |
|-----------|-------|-------|
| Allowed video MIME types | `video/mp4`, `video/webm` | `MediaProperties.java:21` |
| Allowed image MIME types | `image/jpeg`, `image/png`, `image/webp` | `MediaProperties.java:19` |
| Maximum file size | **100 MB** | `max_media_size_mb` in `V18__add_metadata_config_tables.sql:23` |
| Duration limit | **none enforced** | `MediaMetadataValidator.validateDuration` only requires a non-negative integer, and requires it to be present for video |
| Pre-signed URL lifetime | 10 minutes | `MediaProperties.R2.uploadUrlTtl` |

The composer's `mp4 · max 60s · 50MB` label matches none of these.
The design carries the identical string, so the frontend inherited it rather than inventing it.

## Where video is fine

To be clear about what does not need work:

- The upload flow itself is correct and follows the documented pre-signed pattern exactly.
- Client-side metadata extraction works. `useMediaUpload.getMediaMetadata` reads `videoWidth`, `videoHeight` and `duration` from a detached `<video>` element before uploading, and the values it sends match what the file actually contains.
- Upload progress is reported and shown as `uploading {n}%` on the post button.
- Playback in the feed and in post detail is real and reliable.
- The error mapping in `useMediaUpload.js` is careful, distinguishes five failure codes, and deliberately keeps the chosen file so a retry does not require reselecting it.

## Summary of work

| Item | Size | Stage |
|------|------|-------|
| Give the profile grid a video branch instead of a CSS background | Small | 2 |
| Make mute consistent across the four call sites | Small | 1 |
| Pause a playing video when its card leaves the viewport | Medium | 3 |
| Reserve an aspect-ratio box from `width` and `height` | Small | 2 |
| Add `playsInline` | Trivial | 1 |
| Add a poster frame | Medium, needs a backend thumbnail or a client capture | 3 |
| Correct the composer's format and size helper text | Trivial | 3 |
| Accept `.mov`, or filter the file picker so it cannot be chosen | Small, but it is a backend decision | 3 |
