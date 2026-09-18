# Feed suggestion cards — design

Date: 2026-09-18
Status: approved, not yet implemented
Scope: full-stack (frontend `luvax` slice; backend `recommendation`, `hashtag`, `story` modules)

---

## 1. Problem

Hashtag trending and suggested accounts live in `LxRightRail` (`src/features/luvax/components/shell.jsx:454`),
a 280px column mounted beside the feed on desktop and on tablet at or above
`TABLET_RAIL_MIN_WIDTH` (910px). The rail has three problems:

1. It is invisible below 910px, which is most of the traffic this application takes.
2. It shows hashtag **names**, not the posts behind them, so a reader cannot judge whether a
   trending tag is worth opening.
3. Suggested accounts get a 36px avatar and a username. Nothing about the account is visible —
   no banner, no reason the account is being suggested.

Stories are a separate gap: `StoryServiceImpl.getStoryFeed` builds the tray from
`getAcceptedFollowingExcludingBlocks(viewerId)` only, so an account that follows nobody has an
empty story rail and no path to discovering one.

## 2. Goal

Move discovery into the feed itself as three distinct card types, interleaved between posts, and
retire the rail on the feed screen. A reader must be able to tell an embedded story card from a
post at a glance — this is an explicit requirement, not a nice-to-have.

---

## 3. Decisions

Each of these was chosen against alternatives; the alternative and the reason it lost are recorded
so a later reader does not re-open a settled question.

| # | Decision | Rejected alternative |
|---|----------|----------------------|
| D1 | Remove `LxRightRail` from the feed screen; the post column widens | Keep the rail and duplicate suggestions in both places |
| D2 | Story card: horizontal scroller of dark 80×120 portrait tiles carrying a segmented progress bar | Ring band (reads as the top rail repeated); hero + ring grid (two visual languages in one card) |
| D3 | Hashtag card: three tags per card, one 44px thumbnail each, ~150px tall | One tag with three large thumbs; one tag as an editorial mosaic |
| D4 | People card: horizontal scroller of 104px banner tiles | Two-up static; one person full width |
| D5 | Cadence: rotating injection every five posts, at flattened indices 3, 8, 13, 18, … | Front-loaded then sparse; sparse with nothing above the fold |
| D6 | Three queries, one per owning module | One aggregate endpoint; frontend-only fan-out over existing endpoints |
| D7 | New `SuggestedUserResponse` DTO | Add `bannerUrl` to the shared `UserSummaryResponse` |

### D1 — the rail goes

`LxShell` already takes a `showRightRail` prop (`shell.jsx:817`). The feed screen passes it
`false`. The rail stays mounted on Explore, which hosts `LxTrendingRail` and `LxSuggestedRail`
inline (`ExploreScreen.jsx:518-519`) and is unaffected by this work.

On desktop the shell already reserves a 280px spacer when the rail is hidden (`shell.jsx:917`), so
the three-column geometry stays symmetric — 280 spacer + 680 `mainWidth` + 280 spacer — and the
feed column stays horizontally centred. **Hiding the rail therefore does not widen anything by
itself; it empties the right column.** The widening is a separate change, inside `<main>`:

| Constant | Now | After |
|---|---|---|
| `FEED_COLUMN` | 412 | 560 |
| `STORY_RAIL_WIDTH` | 632 | 632 (unchanged) |
| `mainWidth` (shell) | 680 | 680 (unchanged) |

560 fits inside the existing 680 `mainWidth`, so no shell geometry changes. It is chosen to sit
inside the 632 story-rail band rather than exceed it, keeping the two bands concentric, and it
lets the people-card scroller show three tiles before scrolling instead of two.

Reclaiming the now-empty 280px right spacer is deliberately **not** part of this work. It is a
shell-wide change affecting every screen that hides the rail, and folding it in here would put an
unrelated layout regression risk inside a feature branch.

### D2 — the story card, and how it is distinguishable

The requirement is that an embedded story cannot be mistaken for a post. Four signals carry it,
in descending order of strength:

1. **Segmented progress bar** across the top of each tile, one segment per story in that author's
   tray, filled for seen. This is the story viewer's own chrome and nothing else anywhere in
   Luvax uses it. It is the primary signal, and it does double duty by saying how many stories
   are inside.
2. **2:3 portrait tiles on a dark fill.** Post media in this feed is square or landscape on the
   light `--lx-surface`. A dark portrait tile is the opposite silhouette.
3. **Gold ring** on the author avatar overlaid bottom-left, the same `--lx-accent` ring
   `LxAvatar` already draws for `hasStory`.
4. **`24h` expiry pill** in `--lx-accent-dim` / `--lx-accent-text` in the card header.

The header reads `stories · people you may know` in the mono eyebrow style.

**Approved deviation — the scrim.** The author name sits on the tile's cover image and needs a
scrim behind it to hold 4.5:1 contrast. That scrim is a bottom-to-top `linear-gradient`, which
`DESIGN.md` §4 forbids for decoration. Approved here as a **functional** exception: it exists only
for legibility, it carries no hue of its own, and it appears nowhere but behind text on a story
tile. It is not a licence for gradients elsewhere — any other use still falls under the §4 ban.
The rejected alternative was a flat `rgba(26,24,22,0.55)` bar behind the name row.

### D3 — the hashtag card

Three trending hashtags per card. Each row: a 44px rounded thumbnail of the tag's top post, the
tag name at 13px/600, and the post count in mono beneath it, with `--lx-border-subtle` hairlines
between rows. A `explore` link sits in the header.

This was chosen over deeper single-tag layouts. The accepted cost, recorded so it is not
rediscovered as a bug: **a 44px thumbnail is a texture swatch, not a post preview.** The card
tells a reader that a tag is busy and roughly what it looks like; it does not let them judge
individual posts. If that proves too thin in use, the upgrade path is two tags with three
thumbnails each, which was designed and costs about 135px more height.

`postCount` is nullable and null is not zero — the personalised trending tab returns it routinely
for a tag absent from the current snapshot. Render `new`, never an en dash and never `0`. This
matches the existing rule in `LxTrendingRail.jsx`.

### D4 — the people card

Horizontal scroller of 104px-wide tiles. Each tile: a 42px banner strip, a 38px avatar straddling
its lower edge, display name, `@handle`, a one-line reason in gold mono, a pill `follow` button,
and a dismiss `×` in the top-right corner over the banner.

Two consequences accepted with this choice:

- **This is the second horizontal scroller in the feed**, alongside the story card. Mitigated by
  silhouette: story tiles are dark, portrait, 80×120; people tiles are light, near-square, 104px
  wide with a banner. The shared gesture is acceptable because the two are not visually confusable.
- **At 104px the banner is a 42px sliver.** It reads as a colour field more than an image. This
  is the deliberate trade for fitting three-plus people per injection.

**Banner fallback.** `bannerUrl` is nullable and most accounts will not have set one. The fallback
is a flat `--lx-accent-dim` wash — not a grey box, and not a gradient, which `DESIGN.md` §4
forbids outright.

**The reason line.** `UserSuggestion.sources` is a `TEXT` column already populated by
`SuggestionPrecomputeJob` with comma-separated labels from `SuggestionServiceImpl:162-165`:
`graph`, `gorse`, `affinity`. v1 exposes the label and the client maps it to copy:

| Label | Copy |
|---|---|
| `graph` | followed by people you follow |
| `gorse` | similar to accounts you follow |
| `affinity` | posts you've engaged with |
| (several) | first by the order above |
| (none / unknown) | line omitted entirely |

The column stores the label, not a count and not the matched hashtag. **"3 mutuals" and
"#analogue" are out of scope for v1** and need extra queries; they are recorded in §8 as
follow-up work.

### D5 — cadence

Injection slots are computed from the **flattened, already-filtered** post array — after
`extractPageContent` and after the `canViewerSeePost` filter — at indices 3, 8, 13, 18, and every
five thereafter. Type rotates `stories → people → hashtags → stories → …`.

Computing from the flattened index rather than per API page matters: page size is not fixed, and
`canViewerSeePost` can shrink a page arbitrarily. Anchoring to pages would make the spacing
visibly irregular.

Four rules hold regardless:

- **A card with no data does not render and does not consume its slot.** The next eligible type
  takes it. No empty shells mid-feed, no gaps.
- **Never two injected cards adjacent**, even when one slot's data resolves late.
- **Dismiss is per card, session-scoped, and closes the gap** rather than leaving a hole.
- **If the feed is shorter than the first slot**, cards append at the end rather than being
  dropped. A brand-new account with two posts is exactly the reader who needs them.

Both tabs get injections. "Following" is thinner than "for you" for a new account, so it needs
them more, not less.

---

## 4. Backend contract

Three endpoints, each in the module that owns its data (D6). Independent failure is the point:
these are decorations, and a trending outage must not take the people card down with it.

### 4.1 `GET /api/v1/recommendations/suggestions` — extended

Response element changes from `UserListItemResponse` to a new `SuggestedUserResponse`:

```
SuggestedUserResponse
  user        UserSummaryResponse   unchanged, still the shared record
  viewerState ViewerRelationshipResponse
  bannerUrl   String   nullable
  sources     String   nullable, comma-separated: graph | gorse | affinity
```

`bannerUrl` and `sources` are **not** added to `UserSummaryResponse`. That record is deliberately
viewer-independent and embedded in cached and broadcast payloads across posts, comments and
notifications; widening it would bloat every one of them for two fields only this card needs.
Its own class comment makes that intent explicit.

`sources` is already persisted and requires no new computation — only projection through the
service and into the DTO.

### 4.2 `GET /api/v1/hashtags/trending/previews` — new

```
query: size (default 3, max 10), scope (for-you | platform, default for-you)

response: List<TrendingPreviewResponse>
  hashtagId   UUID
  name        String
  postCount   Integer   nullable — null means "no count in this window", not zero
  pinned      boolean
  previewUrl  String    nullable — CDN url of the tag's top post cover
```

Serves the existing trending snapshot joined to one cover image per tag. Exists specifically to
avoid the client issuing `GET /hashtags/{id}/posts` once per tag, which is the N+1 the
frontend-only approach would have required.

A tag whose top post has no renderable media returns `previewUrl: null`; the client renders the
`--lx-accent-dim` fallback rather than dropping the row.

### 4.3 `GET /api/v1/stories/discovery` — new

```
query: limit (default 8, max 20)

response: List<StoryFeedItemResponse>   — the existing tray DTO, reused unchanged
```

Returns active stories from accounts the viewer does **not** follow, drawn from the same suggestion
candidates `SuggestionServiceImpl` already produces.

Filtering is server-side and non-negotiable:

- **Private accounts are excluded entirely.** This mirrors `listUserStories`, which throws
  `STORY_FORBIDDEN` for a private target without an accepted follow.
- **Blocks in either direction exclude the account**, matching the stealth-block model used
  throughout — indistinguishable from the account not existing.
- **Dismissed suggestions are excluded**, same as `/suggestions`.
- **Expired stories are excluded** by `expires_at`, never by row absence.

Reusing `StoryFeedItemResponse` means the existing story viewer navigates a discovery entry with
no changes.

**Accepted behavioural consequence:** opening a discovery story writes an ordinary `story_views`
row, and the author sees the viewer in their viewer list. This is the correct behaviour for a
public account and matches what `GET /stories/user/{userId}` already permits today — that endpoint
serves a public account's stories to a non-follower. This work changes discoverability, not the
privacy boundary.

---

## 5. Frontend architecture

### 5.1 New files

```
src/features/luvax/
├── components/feed/
│   ├── FeedStoryCard.jsx        D2 — scroller of segmented portrait tiles
│   ├── FeedHashtagCard.jsx      D3 — three tag rows
│   ├── FeedPeopleCard.jsx       D4 — scroller of banner tiles
│   └── FeedInjectedCard.jsx     shared chrome: header, eyebrow, dismiss
├── hooks/
│   ├── useTrendingPreviews.js   4.2
│   └── useStoryDiscovery.js     4.3
└── utils/feedInterleave.js      D5 — pure, no React
```

`useSuggestions.js` gains `bannerUrl` and `sources` in its existing `toRow` adapter. That adapter
already exists precisely to keep the wire format out of the component, so this is the intended
extension point and no component signature changes.

### 5.2 The interleave function

`feedInterleave.js` exports one pure function and holds all of D5:

```
interleaveFeed(posts, cards, dismissed) -> Array<{ kind: 'post'|'card', ... }>
```

Pure and React-free so the cadence rules are unit-testable without rendering anything — the four
rules in D5 are exactly the cases that regress silently in a component test.

### 5.3 Changes to existing files

| File | Change |
|---|---|
| `FeedScreen.jsx` | `FEED_COLUMN` 412 → 560; render the interleaved list instead of `posts.map`; pass `showRightRail={false}` |
| `shell.jsx` | No change — `showRightRail` already exists and the hidden-rail spacer already works |
| `hooks/useSuggestions.js` | `toRow` carries `bannerUrl` and `sources` |
| `services/suggestion.service.js` | No change — shape is passed through |

`LxRightRail`, `LxTrendingRail` and `LxSuggestedRail` are **not** deleted. Explore still mounts
them, and that surface is out of scope.

### 5.4 State and caching

Per `global_rules.md` §2, all three sources are TanStack Query server state. None goes in Zustand.

| Query | Stale time | Reason |
|---|---|---|
| suggestions | `STALE_TIME.MEDIUM` | precomputed, changes slowly |
| trending previews | `STALE_TIME.MEDIUM` | periodic snapshot by design |
| story discovery | `STALE_TIME.SHORT` | 24h expiry; a stale entry means a dead tile |

Dismissal is session-local component state, not persisted. The existing
`useDismissSuggestion` mutation continues to handle **per-account** dismissal server-side; card
dismissal is a separate, lighter thing and deliberately does not call it.

Follow-from-card reuses `useFollowSuggestion` unchanged, including its existing rule that the
optimistic patch marks the row **pending**, never "following" — only the server knows whether the
target is private. That rule is load-bearing and must not be relaxed for the new card.

---

## 6. Error, empty and loading states

| State | Behaviour |
|---|---|
| Query loading | Card does not render. No mid-feed skeleton — an empty shell between two posts is worse than no card. |
| Query error | Card does not render. Never an error message mid-feed; these are decorations and a failed decoration is silence. |
| Query empty | Card does not render and does not consume its slot (D5). |
| Partial data | Renders with whatever tiles resolved. A scroller with two tiles is valid. |
| Image fails | `--lx-accent-dim` fallback for banners and hashtag previews; avatar falls back to the existing `AVATAR_COLORS` behaviour. |

---

## 7. Testing

Unit (`vitest`, `npm run test`):

- `feedInterleave` — all four D5 rules, plus: feed shorter than the first slot; every card type
  empty; a dismissed card closing the gap; page boundaries not affecting slot positions.
- `useSuggestions` `toRow` — null `bannerUrl`, absent `sources`, multi-label `sources` precedence.
- Source-label → copy mapping, including unknown label omits the line.

Component:

- Story card renders one progress segment per story and fills seen ones.
- Hashtag card renders `new` for null `postCount`, never `0` and never an en dash.
- People card renders the accent-dim fallback when `bannerUrl` is null.
- Follow from a people tile renders `pending`, not `following`.

Backend (JUnit 5 + Testcontainers):

- `/stories/discovery` excludes private accounts, blocked accounts in both directions, dismissed
  suggestions, already-followed accounts, and expired stories.
- `/hashtags/trending/previews` returns null `previewUrl` rather than omitting a tag.
- `/recommendations/suggestions` still answers for a cold-start account with no follows.

---

## 8. Out of scope

Recorded so the boundary is explicit rather than rediscovered mid-implementation.

- **Mutual counts and matched hashtag names in the reason line.** Needs a count query per
  suggestion and a schema change to record which hashtag the affinity source matched. The v1 copy
  in D4 is the honest version of what is currently stored.
- **Explore screen.** Keeps its inline rail copies untouched.
- **Mobile layout.** The cards are built responsive, but mobile-specific tuning of tile sizes and
  scroller affordances is a follow-up.
- **Dismissal persistence across sessions** for cards, as distinct from accounts.
- **Raising the rail's own metadata contrast.** `LxTrendingRail` and `LxSuggestedList` render mono
  counts and handles in `--lx-ink-3` (#9B9088) on `--lx-surface` (#F0EDE8), which measures about
  2.5:1 and is below WCAG AA for text. The new cards use `--lx-ink-2` (#574F47, about 6.3:1) for
  the equivalent text, so this work does not add to the problem — but fixing the existing rail is
  a separate change to a shared component and is not in this branch.
- **Real-time story arrival.** The discovery query refetches on its stale time like everything
  else; §8 of the root `GLOBAL_RULES.md` already records that v1 has no WebSocket delivery for
  this kind of data.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Two horizontal scrollers compete for the same trackpad gesture | Distinct silhouettes (D4). If it still confuses in use, the people card falls back to the designed two-up static layout. |
| Three extra requests on every feed mount | Independent stale times; `/suggestions` is rate-limited and already handled by the existing `useRateLimitCooldown` pattern in `FeedTabPanel`. |
| A 44px hashtag thumbnail under-delivers on "show me trending posts" | Accepted in D3 with a designed upgrade path. |
| Widening `FEED_COLUMN` to 560 disturbs `PostCard` internal layout | `PostCard` takes `viewport` and is already flexible; verify at 560 before committing to it, and verify media aspect handling in `PostMedia`. |
| Discovery stories surface strangers to accounts that expected followers only | Private accounts excluded server-side; the existing `suggestible` profile setting (`settingsCategories.jsx:602`) already lets an account opt out of being suggested, and that filter applies to the discovery candidate set too. |
