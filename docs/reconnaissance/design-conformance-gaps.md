# Design Conformance Gaps

> Record of work done on 2026-08-01. Not maintained; it is correct as of that date and is not updated as the code moves.

Per-screen divergence between the design export `Luvax.html` and the frontend at commit
`102923c2194b37b6033b033c53000ab4e5da9de2`.

Every row names the specific value that differs.
Nothing here says "needs polish".

## Token layer: fully conformant

A declaration-level diff of the `--lx-` and `--font-` custom properties in
`design/tokens.css` (extracted from the export) against `src/index.css` found **zero tokens present
in the design and missing or different in the frontend**, across both `:root` and
`html[data-theme="dark"]`.

All 50 design tokens are present with identical values.

The frontend declares 36 additional custom properties the design never defines:

| Group | Tokens |
|-------|--------|
| Avatar palette | `--lx-avatar-0` through `--lx-avatar-6` |
| Neutral alphas | `--lx-black`, `--lx-black-35/40/50/55/78`, `--lx-white`, `--lx-white-04/08/12/18/25/30/35/40/45/65/70/75` |
| Ink shadows | `--lx-ink-shadow-12/18/25` |
| Layout density | `--lx-card-pad` (12px and 16px), `--lx-feed-gap` (12px and 8px), `--lx-row-pad` (10px and 14px), each declared twice at different breakpoints |
| Story surface | `--lx-story-surface: #2A2622` |

These are additions rather than divergences.
The density tokens in particular encode a responsive system the export handles with inline
ternaries instead.

**Conclusion: colour and typography conformance is already achieved.**
Every gap below is a component or layout gap.

## `PostCard`

The most-used component and the one with the most measurable divergence.

| Property | Design | Frontend | File |
|----------|--------|----------|------|
| Card `borderRadius`, non-mobile | `12` | `14` | `PostCard.jsx:218` |
| Author avatar `size` | `26` | `28` | `PostCard.jsx:283` |
| Body `fontSize`, text post | `16` | `18` (intended; see below) | `PostCard.jsx:317` |
| Body `fontSize`, media post | `14` | `14` | matches |
| Liked heart colour | `#D15B5B`, a literal | `var(--lx-error)` = `#C47168` | `PostCard.jsx:10` |
| Non-mobile padding | `14px 16px 16px` cozy, `10px 12px 12px` dense | `pad` variable | `PostCard.jsx:267` |
| Mobile padding | not branched | `14px 14px 10px` | `PostCard.jsx:267` |
| Mobile `paddingBottom` | none | `12` | `PostCard.jsx:221` |
| Overflow menu icon size | not specified in the row read | `15` | `PostCard.jsx:309` |
| Action icon sizes | `17` for heart, reply, share, bookmark | `17` for all four | matches |
| Action row `gap` | `18` | `18` | matches |
| Counter font | mono, `11` | mono, `11` | matches |
| Author name | body, `13`, weight `600` | body, `13`, weight `600` | matches |
| Timestamp | mono, `10`, `--lx-ink-3` | mono, `10`, `--lx-ink-3` | matches |
| Card shadow | `0 2px 8px rgba(26,24,22,0.06)` non-mobile, none on mobile | identical | matches |
| Comment affordance | calls `window.LX.openComments(post)`, falling back to `navigate('post')` | always `navigate('post', { postId })` | `PostCard.jsx:362` |
| Like state | shared through `window.__lxStore` with a listener map, so every rendering of a post agrees | local `useState` per card | `PostCard.jsx` |
| `data-lxtap` | on every action button, and the card click handler bails on `closest('[data-lxtap]')` | not present | `PostCard.jsx` |

### The text-post font size is a live bug, not just a divergence

`PostCard.jsx:317` reads:

```js
fontSize: post.postType === 'TEXT' || post.type === 'text' ? 18 : 14
```

The backend returns `postType: "text"`, lowercase, and there is no `type` field on the response at
all.
Neither branch matches, so every text post renders at 14 rather than the intended 18, and the
design calls for 16.
Recorded in `defects.md`.

## `ProfileScreen`

| Property | Design | Frontend | File |
|----------|--------|----------|------|
| Header avatar | `80` by `80` | `76` by `76` | `ProfileScreen.jsx:88` |
| Avatar overlap onto the cover | `marginTop: -40` | `marginTop: -38` | `ProfileScreen.jsx:86` |
| Display name `fontSize` | `22` | `24` | `ProfileScreen.jsx:122` |
| Display name `letterSpacing` | `-0.02em` | `-0.03em` | `ProfileScreen.jsx:122` |
| Display name font and weight | display, `700` | display, `700` | matches |
| Name block padding | `12px 16px 0` | `14px 16px 0` | `ProfileScreen.jsx:120` |
| Stats row `gap` | `28` | `30` | `ProfileScreen.jsx:130` |
| Stats row padding | `16px 16px 16px` | `20px 16px 14px` | `ProfileScreen.jsx:130` |
| Bio `maxWidth` | `480` | `480` | matches |
| Bio style | body, `14`, `--lx-ink-2`, `lineHeight 1.5`, `marginTop 10` | identical | matches |
| Handle | mono, `11`, `--lx-ink-3` | mono, `11`, `--lx-ink-3` | matches |
| Tabs | `['posts', 'photos', 'liked']` | `['posts']` only | `ProfileScreen.jsx:12` |

The tab difference is **not** a gap to close.
The settled decision drops `photos` and `liked`, and the frontend already matches that decision.

## `FeedScreen`

| Property | Design | Frontend | File |
|----------|--------|----------|------|
| Stories carousel data | mock array | mock array `STORIES` | equally unreal |
| Story avatar size | not branched by viewport | `48` desktop, `44` tablet | `FeedScreen.jsx:37` |
| "Add story" tile | not branched | `54` desktop, `48` tablet, plus icon `20`/`18` | `FeedScreen.jsx:29`, `:34` |
| Carousel `gap` | not branched | `14` desktop, `10` tablet | `FeedScreen.jsx:14` |
| Carousel padding | not branched | `14px 14px 12px` desktop, `12px 12px 10px` tablet | `FeedScreen.jsx:15` |
| Story label | not branched | body `11` desktop, `10` tablet, weight `500`, `maxWidth` 60/52, ellipsised | `FeedScreen.jsx:40`, `:42` |
| Column padding | not branched | `10px 0 24px` mobile, `14px 16px` otherwise | `FeedScreen.jsx:97` |
| Loading state | none defined | mono `12`, `--lx-ink-3`, padding `40`, centred | `FeedScreen.jsx:78` |
| Error state | none defined | body `14`, `--lx-error`, padding `40`, centred | `FeedScreen.jsx:86` |

The frontend adds a tablet tier the export does not distinguish inside the feed column.
That is an addition rather than a violation, but it is unreviewed against the design.

## `ExploreScreen`

| Property | Design (`MiniCard`) | Frontend | File |
|----------|---------------------|----------|------|
| Card `borderRadius` | `12` | `10` | `ExploreScreen.jsx:25` |
| Card padding | `12px 12px 14px` | `10px 12px 12px` | `ExploreScreen.jsx:36` |
| Author row `gap` | `8` | `6` | `ExploreScreen.jsx:37` |
| Author name | body, `11`, weight `500`, `--lx-ink-2` | identical | matches |
| Caption | body, `12`, `lineHeight 1.5` | identical, but single-line ellipsis | `ExploreScreen.jsx:42` |
| Topic chips | `LxTag` from `TOPICS` | `LxTag` from mock `TOPICS` | equally unreal |

## `PostDetailScreen` and comments

This is the largest structural gap.

| Concern | Design | Frontend |
|---------|--------|----------|
| Primary comment surface | `CommentModal`, an overlay opened over the feed via `window.LX.openComments(post)` | A full screen reached by `navigate('post', { postId })` |
| `CommentModal` | Exists in `lx-additions`, props `{ post, onClose, navigate, viewport }` | **Does not exist** |
| `CommentRow` | Standalone, takes an explicit `depth` prop | A local function inside `PostDetailScreen.jsx` |
| `CommentMenuPortal` | Portal anchored on a button ref, props `{ btnRef, items, onClose }` | **Does not exist** |
| Per-comment hover menu | `.lx-comment-row .lx-hover-menu` at `opacity 0`, `1` on `:hover`, forced to `1` under `@media (hover: none)` | **Does not exist** |
| Comment like colour | `#D15B5B` | no comment like control at all |
| Comment like, edit, delete | present as menu affordances | **No service, no hook, no UI** |
| Reply threading | `depth` prop drives indentation | Replies fetched via `useCommentReplies`, one level |
| Pinned comments | not modelled | not modelled |

The backend returns `pinned: true` on up to three comments on the first page.
**Neither the design nor the frontend has any treatment for that flag.**
It is a backend concept with no visual design at all.

## `ComposerScreen`

| Property | Design | Frontend | File |
|----------|--------|----------|------|
| Header label | present | body `13`, weight `500`, `--lx-ink-2`, text "new post" | `ComposerScreen.jsx:138` |
| Submit button | `LxBtn` | inline button, `fontSize 14`, `borderRadius 999`, padding `7px 16px` | `ComposerScreen.jsx:144-150` |
| Header border | not branched | `1.5px solid --lx-border-strong` on non-tablet, none on tablet | `ComposerScreen.jsx:133` |
| Tablet insets | not present | `tabletBodyPadLeft` and `tabletBodyPadRight` variables, `contentLeftInset` of 50 desktop, 48 mobile | `ComposerScreen.jsx:106`, `:132` |
| Suggested tags | `SUGGESTED_TAGS` mock | same mock | equally unreal |

The frontend's submit control is a hand-rolled button rather than `LxBtn`, so it does not inherit
the variant, size, or disabled treatment defined in the design system.
`7px 16px` matches no `LxBtn` size (`sm` is `5px 14px`, `md` is `9px 20px`).

## Shell, navigation, and app bar

| Concern | Design | Frontend |
|---------|--------|----------|
| Bottom nav tabs | 6: feed, explore, messages, compose, notifications, profile | present in `shell.jsx` |
| Top tabs | 5, omitting profile | present |
| Nav active treatment | `--lx-accent`, `stroke 1.8`, `filled: true` | `LxIcon` supports `filled`, but only `home` has real filled artwork |
| Bottom nav blur | literal `blur(12px)`, not the `--lx-glass-blur` token (`10px`) | to be checked when ported |
| App bar scroll hide | `header.lx-bar.lx-bar-hidden` at `translateY(-100%)`, `opacity 0`, `220ms ease` | present in `index.css` |
| `LxHeaderSearch` | exists in `lx-additions`, props `{ navigate }` | exists at `src/features/search/components/LxHeaderSearch.jsx` |
| Right rail | `LxRightRail`, `width 300`, hardcoded mock content | `shell.jsx` calls `useSuggestedUsers`, which targets a nonexistent endpoint and always 400s |

The right rail is the one place where the frontend went beyond the design and hit a wall: the
design's rail is decorative mock, and the attempt to make it real targets an endpoint the backend
does not have.

## Icons

Covered in `frontend-inventory.md`.
Summary of the conformance position:

| Item | Status |
|------|--------|
| `LxIcon` component signature | Identical in both |
| Outline glyph set | Design 27, frontend 28, with 5 frontend-only and 3 design-only |
| Filled variants | Design defines 7 (`bell`, `bookmark`, `chat`, `explore`, `heart`, `home`, `profile`); the frontend special-cases `home` only and otherwise fakes `filled` by setting `fill` on the outline path |
| `lucide-react` | Declared but unused. Removing it is a `package.json` change with no code impact |

Design-only glyphs the frontend must gain: `ban`, `mail`, `userMinus`.
Frontend-only glyphs with no design equivalent: `alert`, `chevronLeft`, `edit`, `message`, `trash`.

## States the design does not define

The export renders from hardcoded mock arrays.
There is no loading, empty, error, offline, or permission-denied state anywhere in it.

Per the settled decision these are derived from tokens and do not count as pixel-perfect
violations.
Each one below must be **labelled as derived** wherever it lands.

### Screens needing derived loading, empty, and error states

| Screen | Loading | Empty | Error |
|--------|---------|-------|-------|
| Feed | needed. A frontend version exists at `FeedScreen.jsx:78` and is already derived | needed, and highly likely: the feed excludes the viewer's own posts, so a new account sees nothing | needed. Exists at `FeedScreen.jsx:86` |
| Explore | needed | needed | needed. Post search degrades to an empty page on an Elasticsearch outage, so empty and error look identical |
| Post detail | needed | needed for a post with no comments | needed for 404 and for 403 on a blocked author's post |
| Comment thread and replies | needed per expansion | needed | needed |
| Profile | needed | needed for a user with no posts | needed for 404, which is also what a block returns |
| Followers, following | needed | needed | needed |
| Blocked users | needed | needed | needed |
| Search results, posts and users | needed | needed | needed |
| Saved posts | needed | needed | needed |
| Composer | needed, including media upload progress | not applicable | needed for upload failure and for post creation failure |
| Notifications | needed | needed | needed |

### Components needing derived states

| Component | Missing state |
|-----------|---------------|
| `LxAvatar` | The design avatar is a flat colour circle with **no image source prop**. Real avatars, the fallback when `avatarUrl` is null, and the broken-image case are all undesigned |
| `LxBtn` | `disabled` only restyles the `primary` variant. A disabled `secondary`, `ghost`, or `danger` is undesigned, which matters for the settled decision to render out-of-scope nav tabs disabled |
| `LxBtn` | No loading or pending state for a submit in flight |
| `PostCard` | No treatment for a post with `status: archived`, for a null caption, or for a carousel of more than one media item |
| `PostCard` | Media is a coloured rectangle of fixed height. Real images with an unknown aspect ratio, and the `blurhash` placeholder the backend supplies, are undesigned |
| `CommentRow` | No treatment for the backend's `pinned: true` flag |
| `CommentRow` | No treatment for a deleted comment. The backend soft-deletes the whole subtree, so there is no tombstone to design around, but the disappearance needs handling |
| Comment like control | Must be hidden or disabled on the viewer's own comment, since the backend returns 403. Undesigned |
| `LxTag` | Renders a `span`, so it has no focus or keyboard-activation state even when `onClick` is supplied |
| Any counter | The backend's `followerCount`, `followingCount`, and `postCount` are **null** for an anonymous viewer and for a non-follower of a private account. A null count is undesigned |

### Whole surfaces the design does not contain at all

Per the settled decisions these are to be derived from existing tokens and patterns, and labelled
as derived.

| Surface | Why it is needed |
|---------|------------------|
| Followers screen | `GET /social/users/{id}/followers` exists and the frontend already has `FollowersScreen.jsx` |
| Following screen | Same |
| Blocked users screen | `GET /social/blocked` is the **only** surface on which a blocked account is visible to the blocker, since their profile 404s. Unblock has nowhere else to live |
| Follow request inbox | `GET /social/follow-requests` plus approve and reject |
| Private account state on a profile | `isPrivate: true` with null counts, and a "requested" button state driven by `viewerState.isFollowRequested` |
| Blocked state on a profile | There is no such state to design: a blocked profile returns 404. The design need is the 404 treatment itself |
| Search results | Posts and users come from two separate endpoints and must be composed into one screen |
| Saved posts | `GET /posts/saved` exists, no design and no frontend screen |
| Post edit history | `GET /posts/{id}/history` exists, no design and no frontend screen |

## Summary

| Layer | Conformance |
|-------|-------------|
| Colour and typography tokens | Complete. 50 of 50 identical |
| Primitive prop surfaces | Close. `LxIcon` matches exactly; `LxBtn`, `LxTag`, `LxAvatar` need verification against the tables in `design-system-reference.md` |
| Component measurements | Divergent in specific, listed values on `PostCard`, `ProfileScreen`, `MiniCard`, `ComposerScreen` |
| Comment architecture | Structurally different. `CommentModal` and `CommentMenuPortal` do not exist, and comment like, edit, and delete have no frontend at all |
| Shared like state | Design uses a global observer; the frontend uses per-card local state |
| Icons | Component matches, glyph set nearly matches, filled variants largely missing |
| Derived states | None defined by the design. All must be built and labelled |
