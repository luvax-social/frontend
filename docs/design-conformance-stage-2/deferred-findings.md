# Deferred Findings

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

Everything found and deliberately not acted on, with the stage it belongs to.

---

## 1. Findings that turned out not to be defects

These were on the list to fix and were removed from it after checking.

### 1.1 The typed-but-empty tiles do not exist

Task section 5.5 and the audit both describe posts typed `image`, `video` or `carousel` that carry no media.

There are none.
All 33 media-less posts are typed `text`, for which the caption tile is the correct treatment.

Full evidence in `design-decisions.md`.

**No stage. Closed.**

### 1.2 The photos tab does not filter, and neither does the design's

The audit records that clicking `photos` moves the underline but does not change the grid, and lists "make the photos tab filter" as stage 3 work.

The design behaves identically.
`ProfileScreen` in the export declares `var [tab, setTab] = React.useState('posts')` and renders `PROFILE_POSTS` unconditionally.
The tab sets state that the body ignores, in the design and in the frontend alike.

So the frontend currently matches the design exactly, and making the tab filter would be a divergence from it rather than a conformance fix.

It is still probably the right product behaviour.
That makes it a product decision, not a conformance task, and it needs the same treatment as the carousel: decide the behaviour, then build it.

**Stage 3, reframed as a product decision rather than a defect.**

The `liked` tab has the same shape and the same reasoning.

### 1.3 The follow button claim and its counter-claim

Both were true, about different controls.
Resolved and fixed in this stage. See `design-decisions.md`.

**Closed.**

### 1.4 The explore video thumbnail has no controls

Stage 1 deferred this, noting that `MiniCard` renders `<video muted>` with no `controls`, so a video in the explore grid could not be played.

It is now moot.
`MiniCard` uses `MediaThumb`, and a tile is not a player.
It shows a frame and a video badge, and clicking it opens post detail, where the video plays under the normal rules.

**Closed by this stage.**

---

## 2. Real findings, not in this stage's remit

### 2.1 Explore people results are capped at one

`SearchResultPerson` results are sliced to a single entry, so at most one person is ever shown regardless of how many match.
The design shows every match.

This is a functional limit rather than a styling difference.

**Stage 3, explore.**

### 2.2 The active topic chip filters nothing

`activeTopic` is set by the chip row and never read.
In the design, an active topic filters results and can trigger a search on its own with no query.

**Stage 3, explore.**

### 2.3 The explore search field is not a form

The design wraps the input in a `form` with a prevented `onSubmit`.
The frontend uses a plain `div`, so pressing Enter does nothing.

**Stage 3, explore.**

### 2.4 The explore empty search state is absent

The design defines one: `no results` at body 15 weight 500 in `v.ink2`, with `try a different word or hashtag` at body 13 in `v.ink3`, in a `48px 24px` centred container.

The frontend renders the `posts` label above an empty row.

This stage used that geometry as the source for the feed's empty state, so the pattern is now present in the codebase and applying it to explore is a small change.

**Stage 3, explore.**

### 2.5 `blurhash` is null on every asset and cannot currently be otherwise

The backend accepts, stores and returns `blurhash`.
The upload path never sends it: `media.service.js` and `useMediaUpload.js` build the `upload-complete` body from `storageKey`, `mediaType`, `mimeType`, `fileSize`, `width`, `height` and `duration` only.

Every asset in the database has `blurhash: null`, confirmed again during this stage: 21 assets, 0 with a hash.

Making it work needs two changes, not one: encode a hash client side at upload time, and render it while the image decodes.
The first belongs with the composer.

The aspect-ratio box added by this stage already removes the layout shift that a blurhash placeholder would also have solved, so the remaining benefit is purely visual.

**Composer stage for production, a later stage for rendering.**

### 2.6 No lazy loading

No `loading="lazy"` and no `decoding` attribute anywhere, so every image in a long feed is fetched eagerly.

Explicitly out of scope for this stage.

**Stage 3.**

### 2.7 Video does not pause on scroll

A video that scrolls out of view keeps playing.
Only carousel position stops a video today, which this stage added.

Explicitly out of scope.

**Stage 3.**

### 2.8 The authenticated application has one URL for many screens

Noted in the frontend's own `struct.md` as a known constraint rather than a bug.
Post detail and profile do now have addressable routes, which this stage relied on for the two-window check.

**Recorded, no stage assigned.**

---

## 3. Explicitly excluded by the task

Recorded, no action taken.

| Item | Belongs to |
|------|-----------|
| The composer, including creating carousels and the unified compose surface | Composer stage |
| The media constraints endpoint the backend has published | Composer stage |
| The 180-second video duration limit | Composer stage |
| Notifications conformance | Stage 3 |
| Explore conformance beyond media | Stage 3 |
| Settings conformance | Stage 3 |
| Report modal conformance | Stage 3 |
| Post detail conformance beyond the media inside it | Stage 3 |
| The like-state fix | Stage 3 |
| The `ConfirmModal` primitive | Stage 3 |
| The toast mechanism | Stage 3 |
| Poster frames | Stage 3 |
| Copy capitalisation | Stage 3 |
| Tablet layout | Settled, not to be reopened |
| Lint | Out of scope |

---

## 4. Known divergences created or kept by this stage

Each is argued in `design-decisions.md`.

| Divergence | Reason |
|------------|--------|
| Mobile card separator kept | Without it, cards on a `v.base` background are indistinguishable from the page and each other |
| Heart colour stays `var(--lx-error)` rather than `#D15B5B` | A raw hex would break the token system |
| Caption keeps `white-space: pre-wrap` | Preserves author newlines the design's mock data never contains |
| Profile grid stays uniform `1/1` | The task requires a gapless grid, which the design's mixed ratios do not deliver in three columns |
| Grid tiles keep `object-fit: cover` | A tile is a square crop by definition, and the design crops its tiles too |
| Carousel letterboxes non-matching items | The alternative is cropping them, which is the defect this stage removes |

---

## 5. Environment limitations

### 5.1 The explore trending grid cannot be observed

`post_interaction_scores` holds 0 rows, so the explore endpoint returns nothing and the grid renders no cards.

The table is populated by a background scheduler that has not run in this environment.

The `MiniCard` change could not be observed and is not claimed as verified.

### 5.2 The backend working tree was not clean at the start

A staged `Makefile` was already present, dated three days before this session.
It is not from this stage and was left untouched.
