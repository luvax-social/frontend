# Changes Applied

> Record of work done on 2026-08-14. Not maintained; it is correct as of that date and is not updated as the code moves.

One entry per change.
Each records what was wrong, the evidence, what changed, and the file touched.

---

## 1. The composer could not read the server's limits

**What was wrong.**
The frontend had no way to ask the server what it accepts.
Every limit shown or applied was a local guess.

**Evidence.**
`GET /api/v1/media/constraints` exists and returns four values, confirmed against the running server and recorded in `backend-constraints-verified.md`.
No frontend code referenced it.

**What changed.**
Added `mediaService.getConstraints()`, and a `useMediaConstraints` hook that fetches it once and caches it for `STALE_TIME.LONG`.

**Files.**
`src/api/media.service.js`, `src/features/luvax/hooks/useMediaConstraints.js`.

---

## 2. The helper text described three rules the server does not apply

**What was wrong.**
The video drop zone read `mp4 · max 60s · 50MB`.

**Evidence.**
The server accepts `video/mp4`, `video/quicktime` and `video/webm`, allows 180 seconds, and allows 104857600 bytes.
All three claims in the string were false.
The image string `jpg, png · max 10MB` was equally wrong: `image/gif` and `image/webp` are also accepted, and the ceiling is 100MB rather than 10MB.

**What changed.**
`buildHelperText` renders the line from the constraints response.
It now reads `gif, jpeg, png, webp · mp4, quicktime, webm · max 180s video · 100MB`.

**Files.**
`src/features/luvax/utils/composerMedia.js`, `src/features/luvax/components/ComposerScreen.jsx`.

---

## 3. The type had to be chosen before the content

**What was wrong.**
Three tabs set `type` state, and the type decided what could be attached and what was sent.
Writing a caption and then attaching a photo required changing tab.

**Evidence.**
`ComposerScreen.jsx:202-227` rendered the tab strip, and `handlePost` mapped the tab to `postType` at line 80.

**What changed.**
The tab strip is deleted.
`derivePostType` computes the type from the attachment list on every render.

**Files.**
`src/features/luvax/components/ComposerScreen.jsx`, `src/features/luvax/utils/composerMedia.js`.

---

## 4. Only one file could be attached, so no carousel was reachable

**What was wrong.**
`handleFileChange` read `event.target.files[0]`, the input had no `multiple`, and `handlePost` built a single-element `mediaIds` array.

**Evidence.**
Recorded in `docs/design-conformance/remaining-screen-differences.md` under Carousel: "no user can create a carousel through the interface".

**What changed.**
State holds an ordered array of attachment items.
The input takes `multiple`, and a new selection appends rather than replaces.

**Files.**
`src/features/luvax/components/ComposerScreen.jsx`.

---

## 5. There was no way to manage what was attached

**What was wrong.**
With one file there was nothing to manage.
With many, there was no removal, no ordering, and no per-file state.

**What changed.**
Added `ComposerAttachments`, an ordered strip where each tile carries its own preview, position, remove control, reorder controls, progress bar, and retry control.

**Files.**
`src/features/luvax/components/ComposerAttachments.jsx`.

---

## 6. Progress could not describe more than one file

**What was wrong.**
`useMediaUpload` held a single `progress` number in hook state.
With several files in flight, one number cannot say which file it refers to.

**What changed.**
`uploadMedia(file, { onProgress })` accepts a callback so the caller tracks each file separately.
The existing hook state is left in place and the argument is optional, so no other caller is affected.
`getMediaMetadata` is now returned from the hook, because the composer must measure a video's duration before uploading it.

**Files.**
`src/features/luvax/hooks/useMediaUpload.js`.

---

## 7. One failed file would have cost the whole post

**What was wrong.**
The single-file composer had nothing to lose beyond the one file.
A multi-file composer that aborts on first failure would discard successful uploads and the caption.

**Evidence.**
Verified in the browser: three files attached, one of which the server refuses.
Two uploaded, one failed, the caption and all three tiles survived, and the failed tile offered a retry.

**What changed.**
Each file uploads independently.
A failure marks only that item and leaves the rest untouched.
Submission is blocked while any upload is outstanding, and successful uploads are not repeated when the person posts again.

**Files.**
`src/features/luvax/components/ComposerScreen.jsx`.

---

## 8. Nothing was checked before uploading

**What was wrong.**
The composer sent whatever was chosen and let the server refuse it after the bytes had moved.

**What changed.**
`validateFile` checks type and size, and `validateDuration` checks measured video duration, both before any request is made.
Verified: an oversize file produced zero network calls.

**Files.**
`src/features/luvax/utils/composerMedia.js`, `src/features/luvax/components/ComposerScreen.jsx`.

---

## 9. The oversize message repeated the limit as the file size

**What was wrong.**
A file one byte over the ceiling rendered as `100MB is over the 100MB limit`, because both round to the same figure.

**Evidence.**
Found while exercising the pure functions before wiring them to the interface.

**What changed.**
When the two render alike, the file size is dropped and only the limit is named.

**Files.**
`src/features/luvax/utils/composerMedia.js`.

---

## 10. The cap message described the wrong quantity

**What was wrong.**
Selecting eleven files produced `there is room for 10 more, so the rest were not added`, stated after those ten had just been added.

**Evidence.**
Observed in the browser while verifying the upper bound.

**What changed.**
The message now reads `a post holds 10 items at most, so 10 of the 11 you chose were added`.

**Files.**
`src/features/luvax/components/ComposerScreen.jsx`.

---

## 11. `canPlayType` audit

**What changed: nothing.**

A search of `src/` for `canPlayType` returns no occurrence, so no code path gates QuickTime on it and there was nothing to fix.

This is recorded as verified rather than changed.
The trap was confirmed to be real: in the verification browser `canPlayType('video/quicktime')` returns the empty string while the same browser plays the file correctly.

---

## 12. The twelve measured conformance differences

From `docs/design-conformance/remaining-screen-differences.md`, composer section.
All twelve are accounted for.

| # | Property | Action |
|---|----------|--------|
| 1 | Post button text colour when enabled | **Changed** to `v.inkInverse` |
| 2 | Header bottom border | **Changed** to `1px solid v.border` |
| 3 | Tab strip bottom border | **Void.** The tab strip is removed |
| 4 | Tab active underline | **Void.** The tab strip is removed |
| 5 | Tab padding | **Void.** The tab strip is removed |
| 6 | Avatar row padding | **Changed** to `20px 16px 0` |
| 7 | `you` label margin bottom | **Changed** to 8 |
| 8 | Media box height | **Changed** to a fixed `height: 160` at every viewport |
| 9 | Media box icon size | **Changed** to 36 |
| 10 | Media box overflow | **Kept** as `hidden`, needed for the preview |
| 11 | Post enabled condition | **Kept and extended.** Now governed by the derived type, and still blocks while pending |
| 12 | Tablet layout | **Kept.** Settled as the frontend's own, and out of scope |

Items 3, 4 and 5 are void rather than ignored: they measure properties of a component this phase deletes.
Items 10, 11 and 12 are deliberate keeps, two of which the audit itself recorded as correct.

**Files.**
`src/features/luvax/components/ComposerScreen.jsx`.
