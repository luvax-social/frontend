# Test Media Created

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

What this audit created, how, and where it lives.

All of it was left in place.
Nothing existing was deleted or altered.

## How it was created

Only the documented pre-signed upload flow was used:

1. `POST /api/v1/media/upload` with `mediaType`, `mimeType`, `fileSize`, returning `uploadUrl` and `storageKey`.
2. `PUT` of the file bytes directly to the returned Cloudflare R2 pre-signed URL.
3. `POST /api/v1/media/upload-complete` with the storage key and client-measured metadata.
4. `POST /api/v1/posts` with `caption`, `postType` and `mediaIds`.

No database write was made.
No object-storage write was made by any route other than the pre-signed `PUT`.

The video post by `luvax_ava` was created **through the browser composer**, because section 5.4 required the browser path to be proven.
The remaining posts were created by a script driving the same public API, because the composer cannot produce them: it accepts exactly one file and has no carousel affordance.

The script is at `scratchpad/make_media.py` outside both repositories and was not committed.

## Source files

### Images

Generated with PIL into the design's palette so grid tiles are identifiable and do not clash with the neon seeded media.
They live in the scratch directory, not in either repository.

| File | Dimensions | Ratio | Bytes | Format |
|------|-----------|-------|-------|--------|
| `landscape_1600x900.jpg` | 1600 x 900 | 16:9 landscape | 46,366 | JPEG |
| `portrait_900x1600.jpg` | 900 x 1600 | 9:16 portrait | 45,214 | JPEG |
| `square_1200x1200.png` | 1200 x 1200 | 1:1 | 9,924 | PNG |
| `carousel_a_1400x1050.jpg` | 1400 x 1050 | 4:3 landscape | 52,787 | JPEG |
| `carousel_b_1050x1400.jpg` | 1050 x 1400 | 3:4 portrait | 49,366 | JPEG |

Both a clearly portrait and a clearly landscape image were included deliberately, because the design's profile grid mixes tile ratios and the frontend's does not.

### Video

Supplied in the repository at `docs/video-test/`, untracked at the time of this audit.

| File | Dimensions | Duration | Bytes | Result |
|------|-----------|----------|-------|--------|
| `mp4/file_example_MP4_1280_10MG.mp4` | 1280 x 720 | 31 s | 9,840,497 | **Accepted**, uploaded through the browser composer |
| `webm/file_example_WEBM_1280_3_6MB.webm` | 1280 x 720 | 30 s | 3,540,257 | **Accepted**, uploaded through the API |
| `mov/file_example_MOV_1280_1_4MB.mov` | 1280 x 720 | 30 s | 1,455,455 | **Rejected**. See `video-behaviour.md` |

The larger `mp4/file_example_MP4_1920_18MG.mp4` and the two remaining `mov` and `webm` variants were not uploaded.
They were not needed once format acceptance was established, and leaving them out keeps the seeded data small.

## Media assets registered

All six succeeded.
Every one came back with `blurhash: null`, because the frontend never sends the field.

| Asset id | Type | Dimensions | Duration | Owner |
|----------|------|-----------|----------|-------|
| `d110a10a-0969-40f1-ad30-af5f24a046ab` | video/mp4 | 1280 x 720 | 31 | luvax_ava |
| `26f5ea5c-e06d-4c85-9d1a-05eeb7fec968` | image/jpeg | 1600 x 900 | - | luvax_ben |
| `56f32079-461e-47d3-9b3c-e03946683182` | image/jpeg | 900 x 1600 | - | luvax_ben |
| `8f23edee-1602-47b0-8311-45115102687f` | image/png | 1200 x 1200 | - | luvax_ben |
| `59ec1c27-9676-477c-b7a8-5e4b7aacccce` | image/jpeg | 1400 x 1050 | - | luvax_ben |
| `8e7a27e9-04cb-408f-9424-f6f5ff842916` | image/jpeg | 1050 x 1400 | - | luvax_ben |
| `0c9293e4-1d8f-4752-9044-9a3d265041cf` | video/webm | 1280 x 720 | 30 | luvax_ben |

Storage keys follow `users/{userId}/media/{uuid}.{ext}` in the `luvax-develop` bucket.

## Posts created

Six posts.
Every caption is prefixed `AUDIT ` so they are trivially separable from the `[luvax-seed]` data and from anything a person creates later.

| Post id | Type | Caption | Author |
|---------|------|---------|--------|
| (created in browser) | VIDEO | `AUDIT VIDEO MP4 1280x720 30s #film` | luvax_ava |
| `6aef5963-e86f-4636-9544-69d831f00a62` | IMAGE | `AUDIT IMAGE landscape 1600x900 #light` | luvax_ben |
| `ed9c534e-a436-45ca-b687-7efa7ee94d4c` | IMAGE | `AUDIT IMAGE portrait 900x1600 #analog` | luvax_ben |
| `113fe31b-f46c-4943-a7a6-92eaf6fd5cd0` | VIDEO | `AUDIT VIDEO webm 1280x720 #film` | luvax_ben |
| `915d47b9-07cc-487f-8e1a-6521e701c9eb` | CAROUSEL | `AUDIT CAROUSEL three images mixed ratios #texture` | luvax_ben |
| `5d28fe39-7c59-4603-8193-7ec47a7e1004` | CAROUSEL | `AUDIT CAROUSEL mixed image and video #silence` | luvax_ben |

The three-image carousel carries the 4:3, 3:4 and 1:1 images in that order.
The mixed carousel carries the 16:9 landscape image followed by the webm video.

## One social change was also made

`luvax_ava` now **follows** `luvax_ben`.

This was necessary and is recorded because it is a data change beyond media.

The feed endpoint returns only posts by followed accounts and does not include the viewer's own.
Before the follow, `GET /posts/feed` returned `content: []` even with Ava's own video post in existence, so the feed could not be observed with media at all.
Ava followed nobody at the start of this audit, despite `docs/reconnaissance/local-environment-runbook.md` describing Ava and Ben as a mutual follow.

The follow returned `201` and the relationship is `accepted`.
It has been left in place, since without it the feed is empty and unobservable.

## What this data now demonstrates

| Question | Answered by |
|----------|-------------|
| Does a single image post render | the two IMAGE posts |
| Does aspect ratio survive | the deliberate landscape and portrait pair |
| Does a video post render and play | the two VIDEO posts, one uploaded through the browser |
| Does a carousel expose its items | the three-image CAROUSEL |
| Does the backend permit a mixed carousel | the mixed CAROUSEL, which was accepted |
| What a `.mov` failure looks like | the rejected upload attempt |
| Whether the typed-but-empty posts still misrender | the seeded posts now sitting beside real ones in the same grid |

## Backend rules confirmed while doing this

**[source]** From `PostServiceImpl.validateMediaCardinality`:

- `CAROUSEL` requires at least 2 media items and at most `max_post_media_items`, which is **10**.
- `IMAGE` and `VIDEO` require exactly 1, and the asset type must match the post type.
- The carousel branch **returns before the type check**, so a carousel may legally mix images and video.

That last point answers section 5.1 directly: **the backend does permit a mixed carousel**, and it was created successfully.
Whether that is intentional is a separate question; the code path reads as an oversight rather than a decision, because no comment marks it as deliberate.
