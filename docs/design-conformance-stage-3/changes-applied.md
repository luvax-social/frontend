# Changes Applied

> Record of work done on 2026-08-14. Not maintained; it is correct as of that date and is not updated as the code moves.

One entry per change.
Each records the design's value where one exists, the previous value, what it is now, and the file touched.

---

## 1. Post like and save state moved into the query cache

**Design value.**
None.
This is an architectural defect rather than a conformance gap.

**Previously.**
`PostCard` held `liked`, `likeCount`, and `saved` in `useState` seeded from a prop.
`PostDetailScreen` held its own separate copies, and its `liked` and `saved` were seeded from `false` and never synchronised at all.

The optimistic update and its rollback lived in the click handler, so only the instance that fired the mutation moved.
Opening post detail from a feed card renders the same post twice at once, and the two disagreed until a refetch.

**Now.**
Both read from the post the query cache supplies.
The optimistic update lives in the mutation's `onMutate`, patching every cache entry holding the post, and `onError` restores the snapshots it captured.
The server's authoritative count, when the endpoint returns one, is applied through the same patch in `onSuccess` so it reaches both renderings.

**Files.**
`src/features/luvax/hooks/usePostLikeState.js` (new), `src/features/luvax/hooks/usePosts.js`, `src/features/luvax/components/PostCard.jsx`, `src/features/luvax/components/PostDetailScreen.jsx`.

---

## 2. `ConfirmModal` primitive

**Design value.**
Chunk `9bffeb59-152c-49f9-ae0d-96c787e34723.js` lines 26 to 54, re-read from source at the time of writing.

| Property | Design | Now |
|----------|--------|-----|
| Arming delay | 500ms, reset on title or message change | same |
| Overlay | `fixed`, `inset 0`, `zIndex 2147483400`, centered, `padding 16` | same |
| Scrim | `v.scrim`, click closes | same |
| Panel | `width 340`, `v.base`, radius 16, `0 20px 60px rgba(26,24,22,0.26)`, `padding 28px 24px 22px`, `gap 16` | same, plus `maxWidth 100%` |
| Title | `fontDisplay` 700 / 18 / `-0.02em` / `v.ink`, `marginBottom 8` | same |
| Message | `fontBody` 14 / `v.ink3` / `lineHeight 1.55` | same |
| Cancel | `flex 1`, `11px 0`, radius 999, `v.surface`, 14 / 500 / `v.ink2`, label `cancel` | same |
| Confirm armed | `v.error`, 14 / 600, `#fff` | same, using `v.white` |
| Confirm disarmed | `v.surfaceRaised`, `v.ink3`, `opacity 0.5` | same |
| Transition | `opacity 0.25s, background 0.25s, color 0.25s` | same |

**Derived, labelled.**
`maxWidth: '100%'` was added so the fixed 340 panel cannot overflow a narrow phone.
`role="dialog"`, `aria-modal`, and `aria-label` were added; the design has none.
`message` accepts a node rather than only a string, because the confirmations being migrated carry emphasis and an inline failure notice that would otherwise be lost.
`confirmDisabled` was added so a pending mutation can hold the button.

**Previously.**
No such primitive.
Destructive confirmations were assembled from the generic `LxModal` at each call site, and none carried a delay.

**Files.**
`src/features/luvax/components/ConfirmModal.jsx` (new).

---

## 3. Destructive flows migrated onto it

Four confirmations found and migrated, plus one action that had no confirmation at all.

| Flow | Previously | Now |
|------|-----------|-----|
| Delete post, from the feed card | `LxModal` | `ConfirmModal` |
| Delete post, from post detail | `LxModal` | `ConfirmModal` |
| Delete comment | `LxModal` | `ConfirmModal` |
| Block, from post detail | `LxModal` | `ConfirmModal` |
| Block, from the post overflow menu | **no confirmation, blocked on click** | `ConfirmModal` |

**The block wording is unchanged**, as required.
Captured before the migration and compared after:

> Are you sure you want to block **{name}**? They won't be able to find your profile, posts or story on Luvax.

The inline failure notice that follows it (`couldn't block this account. try again.`) also survives, which is why `message` accepts a node.

**Files.**
`src/features/luvax/components/PostCard.jsx`, `src/features/luvax/components/PostDetailScreen.jsx`.

---

## 4. Escape closes every overlay

**Design value.**
None.
The design has no Escape handling anywhere, so this is a deliberate improvement.

**Previously.**
No modal, sheet, or overlay closed on Escape.
The dropdown menu was the only surface that did.

**Now.**
One hook, `useEscapeKey(isOpen, onClose)`, applied at the primitive level so every call site inherits it at once:

| Surface | How it is covered |
|---------|-------------------|
| Every `LxModal` | hook added inside the primitive |
| Every `LxBottomSheet` | hook added inside the primitive |
| `ReportModal` | hook added directly, since it is not built on `LxModal` |
| `ConfirmModal` | hook built in from the start |
| `LxDropdownMenu` | **untouched.** It already had its own `window` listener, which still works |

**Files.**
`src/hooks/useEscapeKey.js` (new), `src/features/luvax/components/primitives.jsx`, `src/features/luvax/components/ReportModal.jsx`.

---

## 5. Video pauses when its card leaves the viewport

**Design value.**
None.

**Previously.**
Nothing paused a video except moving between carousel items.
A video scrolled out of view kept playing, audio included.

**Now.**
An `IntersectionObserver` at a 0.25 threshold pauses any playing video that leaves the viewport.

**Derived, labelled.**
Playback is not resumed on the way back.
The reader stopped watching, and restarting unasked would be its own surprise.

**Files.**
`src/features/luvax/components/PostMedia.jsx`.

---

## 6. Images below the fold are deferred

**Design value.**
None.

**Previously.**
Every media image was fetched eagerly.

**Now.**
`loading="lazy"` and `decoding="async"` on the media image.

The aspect box Stage 2 added still holds: the frame reserves its height independently of the image, so deferring the fetch cannot reintroduce the layout shift.
Observed on a ten-image carousel: ten images, all lazy, all async, frame height stable at 318px.

**Files.**
`src/features/luvax/components/PostMedia.jsx`.

---

## 7. The profile tabs filter

**Design value.**
The design's tabs do not filter.
Matching it would mean shipping a control that does nothing, which the brief rules out as worse than diverging.

**Previously.**
All three tabs requested the same list.
`useUserPosts(user?.id)` was called with no parameters, so `posts`, `photos`, and `liked` showed identical content and only the underline moved.

**Now.**

| Tab | Request |
|-----|---------|
| `posts` | `/posts/user/{id}?limit=10` |
| `photos` | `/posts/user/{id}?type=image,carousel&limit=10` |
| `liked` | `/posts/liked?limit=10` |

The type parameter name and its comma-delimited form were read from the backend's `PostApi.listUserPosts`, which is documented as accepting either repeated values or one comma-delimited value.

**Derived, labelled.**
`photos` maps to `image,carousel` rather than `image` alone.
A carousel of photographs is what most people mean by photos, and excluding it would hide most of the picture posts this application can now create.

The liked list's rows are `{ likedAt, post }` rather than bare posts, so the post is lifted out before the grid sees it.

**Observed.**
12 posts unfiltered, 9 under the photos filter, correctly excluding two text posts and one video.
In the browser: 10 tiles on `posts` (first page of 12), 9 on `photos`, and a distinct list on `liked`.

**Files.**
`src/services/post.service.js`, `src/features/luvax/hooks/usePosts.js`, `src/features/luvax/components/ProfileScreen.jsx`.

---

## Not applied

The following work items from the brief were not completed in this stage.
They are listed here so this document is not read as a full account of the brief.

- The toast mechanism, section 5.2.
- Post detail's two-pane desktop layout and measured values, section 6.1.
- Notifications date grouping and per-type icons, section 6.2.
- Explore's four functional gaps and fifteen values, section 6.3.
- Settings and report modal values, sections 6.4 and 6.5.
- Copy capitalisation, section 7.1.

See `README.md` for why, and `deferred-findings.md` for what each still needs.
