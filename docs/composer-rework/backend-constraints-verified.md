# Backend Constraints, Verified

> Record of work done on 2026-08-14. Not maintained; it is correct as of that date and is not updated as the code moves.

Written before any feature code on this branch, as the phase requires.

Every value below was observed against the running server.
Nothing here is taken from reading backend source, and where source reading and observation could disagree, the observation is what is recorded.

## Method

Both applications were started from a cold machine.
Docker Desktop was not running, so PostgreSQL, Redis and RabbitMQ did not exist as containers and the backend process was absent.
The stack was brought up, the backend applied 46 Flyway migrations against an empty database, and `tools/seed/seed.py` created the four `luvax_*` accounts.

Elasticsearch was deliberately not started.
`GET /actuator/health` therefore reports `DOWN`.
That is the Elasticsearch health indicator alone and does not touch the media or post endpoints exercised here.

The probes were issued from `.workspace/tmp/probe_constraints.py` with a real bearer token obtained by logging in as `luvax_ava` through `POST /auth/login`.
The full request and response for every probe is recorded in `.workspace/tmp/probe-log.json`.

These probes use HTTP directly rather than the browser.
That is deliberate for this document: it establishes what the server enforces, independent of any client.
The browser-level evidence for the composer itself is a separate deliverable, `verification-evidence.md`.

## The constraints endpoint

Address: `GET /api/v1/media/constraints`.

### Authentication is required

Request without a token:

```
GET /api/v1/media/constraints
```

Response:

```json
{"success": false, "code": "UNAUTHORIZED", "message": "Authentication is required", "data": null}
```

Status `401`.

### The response, authenticated

Request:

```
GET /api/v1/media/constraints
Authorization: Bearer <token>
```

Response, status `200`:

```json
{
  "success": true,
  "code": "OK",
  "message": "Operation completed successfully",
  "data": {
    "acceptedImageMimeTypes": ["image/gif", "image/jpeg", "image/png", "image/webp"],
    "acceptedVideoMimeTypes": ["video/mp4", "video/quicktime", "video/webm"],
    "maxFileSizeBytes": 104857600,
    "maxVideoDurationSeconds": 180
  },
  "timestamp": "2026-08-13T19:42:10.623465900Z"
}
```

The payload is wrapped in the standard `ApiResponse` envelope, so a client must unwrap `data`.

### Every value it returns

| Field | Observed value |
|-------|----------------|
| `acceptedImageMimeTypes` | `image/gif`, `image/jpeg`, `image/png`, `image/webp` |
| `acceptedVideoMimeTypes` | `video/mp4`, `video/quicktime`, `video/webm` |
| `maxFileSizeBytes` | `104857600`, which is 100MB |
| `maxVideoDurationSeconds` | `180` |

## Do the published values match what is enforced

Each accepted type was confirmed by requesting a pre-signed URL for it, which is where the MIME allowlist and the size ceiling are applied.
Every one of the seven published types was accepted.

| Probe | Status | Response message |
|-------|--------|------------------|
| `IMAGE` / `image/gif` | 200 | success |
| `IMAGE` / `image/jpeg` | 200 | success |
| `IMAGE` / `image/png` | 200 | success |
| `IMAGE` / `image/webp` | 200 | success |
| `VIDEO` / `video/mp4` | 200 | success |
| `VIDEO` / `video/quicktime` | 200 | success |
| `VIDEO` / `video/webm` | 200 | success |

Beyond presigning, four of these were then uploaded end to end and registered as media assets: `image/png` eleven times, `image/gif` once, `video/quicktime` once, `video/mp4` once.
All four produced a `201` from `POST /media/upload-complete` and a real object on R2.

The published list is therefore accurate in both directions for the types tested by upload, and accurate at the validation layer for all seven.

## What a rejection looks like

A refused MIME type names the accepted set verbatim.

Request:

```json
{"mediaType": "IMAGE", "mimeType": "image/heic", "fileSize": 1024}
```

Response, status `400`:

```json
{"success": false, "code": "MEDIA_INVALID_METADATA",
 "message": "Unsupported image MIME type 'image/heic'. Accepted: image/gif, image/jpeg, image/png, image/webp"}
```

The same message shape appears when a video type is submitted under `mediaType: IMAGE`:

```
Unsupported image MIME type 'video/mp4'. Accepted: image/gif, image/jpeg, image/png, image/webp
```

This matters for the composer: the server's own refusal already names the real allowlist, so surfacing the server message is never worse than inventing one.

## Maximum file size, and whether it differs by media type

It does not differ.
One ceiling covers both.

| Probe | Declared size | Status |
|-------|---------------|--------|
| `IMAGE` / `image/png` at the ceiling | 104857600 | 200 |
| `IMAGE` / `image/png` one byte over | 104857601 | 400, `File size exceeds the configured limit` |
| `VIDEO` / `video/mp4` at the ceiling | 104857600 | 200 |
| `VIDEO` / `video/mp4` one byte over | 104857601 | 400, `File size exceeds the configured limit` |

The boundary is inclusive and identical for both media types.

The consequence the backend noted is confirmed: a 100MB image is accepted, because the only ceiling in the system is one sized for video.
Nothing in the API offers a smaller image-specific limit, so a composer cannot present one without inventing it.

The rejection message does not name the number.
It says only that the limit was exceeded.
The composer must therefore render the limit from `maxFileSizeBytes` itself if the person is to be told what the ceiling actually is.

## Video duration, and where it is checked

The limit is 180 seconds and it is enforced at `POST /media/upload-complete`.

| Probe | Declared duration | Status |
|-------|-------------------|--------|
| Real 30.6s `.mov`, declared at the ceiling | 180 | 201 created |
| Real 30.6s `.mov`, declared one second over | 181 | 400, `Video duration must not exceed 180 seconds` |
| Real 30.5s `.mp4`, declared as 1 second | 1 | 201 created |

Unlike the size message, the duration message does name the number.

### The duration is checked against the declaration, not against the file

Confirmed, and this is the finding that decides the composer's design.

The third row above is the proof.
The file is genuinely 30.5 seconds long, measured by reading the `mvhd` box of the container directly.
It was declared as 1 second and the server created the asset without complaint.

The first two rows are the same physical file, 30.6 seconds long, differing only in the number the client declared.
One was accepted and one was refused.
The outcome tracked the declaration and ignored the file in every case.

The server never opens the uploaded object to read its duration.
The 180 second rule therefore bounds an honest client and nothing else.

**The composer's own duration check is the only real check.**
If the composer does not measure the file, no layer does.

This is a rule rather than a defence, exactly as the backend stated.
It is recorded here as verified rather than accepted on the backend's word.

## Carousel item range

Confirmed at both ends, and one past each end.

| Probe | Items | Status | Message |
|-------|-------|--------|---------|
| Carousel of 1 | 1 | 400 | `Carousel posts require at least 2 media items` |
| Carousel of 2 | 2 | 201 | created |
| Carousel of 10 | 10 | 201 | created |
| Carousel of 11 | 11 | 400 | `Request validation failed` |

The valid range is 2 to 10 inclusive.

The lower bound produces a specific, quotable message.
The upper bound does not: 11 items trips bean validation on the request DTO and returns only `Request validation failed`, which names neither the limit nor the field.

That asymmetry is a reason for the composer to prevent an eleventh item itself rather than let the server refuse it, because the server's refusal at that boundary tells the person nothing useful.

The endpoint does not publish the carousel range.
`GET /media/constraints` covers formats, size and duration only.
The value 10 used by the composer is therefore derived from this observation, not read from an API, and that is recorded in `composer-design.md`.

## Composition rules

| Probe | Status | Message |
|-------|--------|---------|
| `carousel` mixing one image and one video | 201 | created |
| `image` with 2 media ids | 400 | `Image and video posts require exactly 1 media item` |
| `text` with 1 media id | 400 | `Text posts must not include media` |
| `image` with 1 gif | 201 | created |
| `video` with 1 mp4 | 201 | created |

A carousel may mix images and video freely.
A single-type post may not carry more than one asset, and a text post may not carry any.

This confirms the type derivation the composer needs: the number of attachments decides the type, and only a carousel may hold more than one.

## Order is preserved

Submitted order is stored order.

For the carousel of 10, the ten `mediaAssetId` values returned by `GET /posts/{id}` matched the ten submitted ids in the same sequence, with `position` running 0 through 9.
The mixed carousel behaved the same way, with the image at position 0 and the video at position 1, matching submission order.

The response exposes each item as `media[].mediaAssetId` with an explicit `position`.
The `media[].id` field is a separate per-post row id and is not the asset id.

## Blurhash

Every asset created during these probes returned `"blurhash": null`.

The field is present in the response for every media item.
The upload path accepts it, and nothing in this run populated it.

## What could not be verified

**An over-length video was never tested with a truthful declaration.**
No file longer than 180 seconds was available, and no encoder is installed on this machine to produce one.
The duration limit was exercised only by varying the declared number against files of about 30 seconds.
Given that the server was shown to ignore the file entirely, a truthfully declared 181 second video would be refused by the same code path that refused the falsely declared one, but that specific case was not observed.

**The size ceiling was tested by declaration, not by transferring 100MB.**
`POST /media/upload` validates the declared `fileSize` before any bytes move, which is where the boundary was probed.
`POST /media/upload-complete` separately verifies the stored object against R2, and a declared size that disagrees with the real object is refused there with `MEDIA_OBJECT_METADATA_MISMATCH`.
That mismatch path was not exercised in this run.

**Elasticsearch was absent throughout.**
No probe here depends on it, but the server was not in a fully healthy state and that is stated rather than hidden.

## Backend repository baseline

The backend working tree was already modified before this branch existed.
This is the state at the start of the work, recorded so the end state can be compared against it.

```
$ git status
On branch develop
Your branch is up to date with 'origin/develop'.

Changes to be committed:
  (use "git restore --staged <file>..." to unstage)
	new file:   Makefile

$ git rev-parse --short HEAD
26d986d
```

The staged `Makefile` predates this phase.
No file in the backend repository was created, modified or deleted by this work.
