# Deferred Findings

> Record of work done on 2026-08-14. Not maintained; it is correct as of that date and is not updated as the code moves.

Everything found and deliberately not acted on, with the phase it belongs to.

## Declared out of scope by the phase brief

Recorded, no action taken.

| Finding | Belongs to |
|---------|-----------|
| Rendering a blurhash. This phase decided not to produce one either, with reasoning in `composer-design.md` | A later phase that renders placeholders |
| Notifications, explore, settings and report modal conformance | Conformance follow-up |
| Post detail conformance beyond what the composer creates | Conformance follow-up |
| The like-state fix | Its own phase |
| The `ConfirmModal` primitive and the toast mechanism | Primitive work |
| Video pause on scroll, poster frames, lazy loading | Media playback phase |
| The explore people cap, the topic filter, the explore empty state | Explore phase |
| Copy capitalisation | Copy pass |
| Tablet | Settled, not reopened |
| Lint | Out of scope on this branch |

## Found during this phase

### A video the browser cannot measure is uploaded unchecked

`getMediaMetadata` failures are caught and the file is allowed through, because refusing on an unreadable value would block files that are perfectly valid.

The consequence is that such a video is checked by nobody: the composer could not measure it, and the server never opens the file.

No file tested in this phase hit this path.
It is a narrow gap rather than an open door, but it is real.

**Belongs to:** a media validation phase, and it likely needs a server-side change to close properly, since a client-side check can always be bypassed.

### A zero-byte file is accepted by the composer and refused by the server

`validateFile` checks only the upper size bound, so a zero-byte file passes and fails at the presign step with `File size must be positive`.

This was used deliberately in verification to force one file in a batch to fail, and the failure was handled correctly.
It is still a refusal the composer could have made itself, before a request.

**Belongs to:** a small follow-up to the composer's validation.

### The server's carousel upper-bound refusal names nothing

Submitting eleven media ids returns `Request validation failed`, which names neither the field nor the limit.
The lower bound, by contrast, returns `Carousel posts require at least 2 media items`.

The composer works around this by preventing an eleventh item itself.
The asymmetry remains on the server.

**Belongs to:** a backend phase. The backend is read-only here.

### The size ceiling does not distinguish image from video

One 100MB limit covers both, confirmed at the boundary for each type.
A 100MB image is accepted by a ceiling sized for video.

The composer cannot present a smaller image limit without inventing one, so it presents the real ceiling for both.

**Belongs to:** a backend policy decision, if a per-type ceiling is wanted.

### The oversize refusal from the server does not name the limit

`File size exceeds the configured limit` says only that a limit was passed.
The composer's own message names the figure, so a person never sees the bare server message for this case in normal use.

**Belongs to:** a backend message pass.

### Duration is advisory and the backend knows it

The server bounds the declared number and never reads the file.
This is documented in the backend source as deliberate.

It means the client-side check is the only real one, which is recorded in `composer-design.md` as a property of the design rather than as a defect.

**Belongs to:** noted, no action expected.

### Every media asset has a null blurhash

Confirmed across every asset created in this phase.
The field is accepted, stored and returned, and nothing populates it.

This phase decided not to populate it.

**Belongs to:** the phase that renders placeholders.

### The R2 public URL refuses non-browser clients

Fetching a `cdnUrl` without a browser User-Agent returns `403 Forbidden`.
The same URL loads correctly in the browser.

This affected verification tooling only, not the application.
Worth knowing for any future script that reads stored media.

**Belongs to:** noted, tooling only.

### Elasticsearch absence makes the health endpoint report DOWN

The backend runs and serves every endpoint used here while `/actuator/health` reports `DOWN`, because the Elasticsearch indicator fails.

A developer reading the health endpoint could conclude the application is broken when only search is unavailable.

**Belongs to:** a backend observability decision. The backend is read-only here.

### The story composer still hardcodes a duration limit

`src/features/luvax/components/StoryScreens.jsx:239` reads `tap to record · max 60s`.

This is the same class of defect this phase removed from the post composer: a limit written into the interface rather than read from the server.
Whether 60 seconds is even the right figure for a story was not checked, and no story endpoint was examined.

It was left alone because stories are named as an out-of-scope module in the phase brief.
It is recorded here because the Definition of Done asks that no duration limit be hardcoded anywhere in the frontend, and this one is, so the claim should not be read as unqualified.

The post composer, which is this phase's subject, hardcodes no format list, size limit, or duration limit.

**Belongs to:** a stories phase. The fix is to reuse `useMediaConstraints` and `buildHelperText`, which are already general.

### The backend working tree was dirty before this phase

`backend/` carried a staged `Makefile` on branch `develop` before this branch was created.
It was not touched by this work.

**Belongs to:** whoever staged it.
