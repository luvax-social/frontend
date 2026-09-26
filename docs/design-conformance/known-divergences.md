# Known Divergences

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

The eight divergences carried in from earlier phases, each confirmed, corrected, or cleared.

Three of the eight were stated on a premise that turns out to be wrong.
The premise is corrected in each case rather than the finding being silently dropped.

All findings are **[source]** unless marked otherwise.

## 1. Post overflow menu uses Title Case

**Status: confirmed as an inconsistency, but the stated premise is wrong.**

The claim was that the design specifies lowercase throughout and the post menu disagrees with the newer profile menu.

The design does not specify lowercase throughout.
`additions.js` lines 98 to 127 build the design's own `LxMenu` items in Title Case: `Like`, `Unlike`, `Share`, `Copy link`, `View author's profile`, `Unfollow @{author}`, `Block @{author}`, `Report`, `Reported`.

The design's voice is mixed by surface, not uniformly lowercase.

| Design surface | Case |
|----------------|------|
| `LxMenu` items | Title Case |
| `ConfirmModal` buttons | lowercase: `cancel`, `confirm` |
| `ReportModal` headings | lowercase: `report post`, `add details`, `report submitted` |
| `ReportModal` buttons | Title Case: `Continue`, `Submit Report`, `Done` |
| `LxBtn` labels across screens | lowercase: `follow`, `accept`, `decline`, `edit profile` |
| Settings rows | lowercase throughout |

So the real defect is not that the frontend deviates from the design here.
The frontend's post menu at `PostCard.jsx:138-227` is internally inconsistent with itself.

| Item | Case |
|------|------|
| `Like` / `Unlike` | Title Case, matching the design |
| `Share` | Title Case, matching the design |
| `Copy link` | Title Case, matching the design |
| `View author's profile` | Title Case, matching the design |
| `Unfollow @{handle}` / `Follow @{handle}` | Title Case, matching the design |
| `Block @{handle}` | Title Case, matching the design |
| `Report` / `Reported` | Title Case, matching the design |
| `edit post` | **lowercase** |
| `delete post` | **lowercase** |

The two lowercase rows are the two the frontend added; the design has no owner actions in its menu.
The profile menu at `ProfileScreen.jsx:112-128` uses `Report` and `Reported`, so it agrees with the post menu, not with the design's lowercase surfaces.

**Where:** `PostCard.jsx:162` and `PostCard.jsx:170`.

**Size:** trivial. Two string literals. The decision of which way to resolve it is the only real work, and it should be resolved against the design's own `LxMenu`, which is Title Case.

## 2. Blocked list empty state is capitalised

**Status: confirmed, and it is wider than stated.**

`BlockedUsersScreen.jsx:35` returns `No blocked users`.

Two more empty states are capitalised in the same way, and two more use a third style with a trailing full stop.

| Location | String | Style |
|----------|--------|-------|
| `BlockedUsersScreen.jsx:35` | `No blocked users` | capitalised, no stop |
| `NotificationsScreen.jsx:205` | `No pending requests` | capitalised, no stop |
| `NotificationsScreen.jsx:220` | `No notifications yet` | capitalised, no stop |
| `FollowersScreen.jsx:88` | `No followers yet.` | capitalised, with a stop |
| `FollowingScreen.jsx:88` | `Not following anyone yet.` | capitalised, with a stop |

Every loading state and every error state in the application is lowercase without a trailing stop.
The empty-state family is the only capitalised family, and it is not internally consistent either.

**Where:** the five locations above.

**Size:** trivial. Five string literals, one decision.

## 3. Comments open as an overlay in the design, a screen in the frontend

**Status: confirmed, and deliberate.**

The design's `PostCard` article-level click calls `window.LX.openComments(post)`, which mounts `CommentModal` over the current screen.
`NotifRow` does the same for comment and reply notifications.
The design's `PostDetailScreen` exists but nothing routes to it in the comment flow, so it is effectively dead in the export.

The frontend opens `/app/post/:postId` as an overlay route through `useOverlayNavigate`.

The route shape was built so either presentation is possible.
`appScreens.jsx:64-68` defines `APP_OVERLAY_SCREENS` and its comment states directly that whether post detail stays an overlay or becomes a full page is a change in one place that does not touch the table.

This is recorded in `docs/url-routing/` and should not be reopened.
The frontend's version is strictly better: the design's modal cannot be linked to, and the whole point of the routing work was that every screen has an address.

**Where:** `PostCard.jsx:257,286,334,382`, `useOverlayNavigate.js`, `appScreens.jsx:64-68`.

**Size:** none. No change wanted.

The design's modal geometry is recorded in `primitive-audit.md` in case the overlay is ever restyled to match it more closely.

## 4. Report description capped at 500 in the design, 2000 in the frontend

**Status: confirmed, and deliberate.**

The design caps at 500: `additions.js:206` slices to `e.target.value.slice(0,500)` and the counter reads `{n}/500`, turning `v.errorText` above 450.

The frontend caps at 2000: `report.service.js:55` defines `REPORT_DESCRIPTION_MAX_LENGTH = 2000`, and `ReportModal.jsx:278` slices to it while `ReportModal.jsx:305` renders `{n}/2000`.

The backend accepts 2000, and the settled position is that the backend contract wins over the design where the two disagree on a limit.
Capping at 500 would reject input the server would have accepted.

**Where:** `report.service.js:55`, `ReportModal.jsx:278,305`.

**Size:** none. No change wanted.

One detail is worth carrying forward: the design turns the counter red at 90 percent of its limit. Whether the frontend does the same at 1800 was not determined and needs `ReportModal.jsx` read around line 234, where an `overLimit` flag exists.

## 5. Heart colour differs between a literal and the error token

**Status: confirmed.**

| Side | Value | Resolves to |
|------|-------|-------------|
| Design | `LX_LIKE_COLOR = '#D15B5B'` at `main.js:4985` | `#D15B5B` |
| Frontend | `HEART_COLOR = 'var(--lx-error)'` at `PostCard.jsx:15` | `#C47168` |

These are different colours.
The design's is a more saturated red; the error token is browner and lower in chroma.

The design uses the literal in two places: `PostCard` at `main.js:2191` and `CommentModal` at `additions.js:307`.
It is a deliberate one-off, not a token, and it is the only place in the entire export where a like-specific colour appears.

The frontend also spreads the colour further than the design does: `PostCard.jsx:378` tints the like **count** with it when liked, where the design keeps the count at `v.ink3` regardless.

**Where:** `PostCard.jsx:15`, applied at `PostCard.jsx:372,376,378`.

**Size:** trivial to change the value. The open question is whether `#D15B5B` should become a token, since it is now used in at least two components and will be used in the post detail overlay too. That is a five-minute decision, not a task.

## 6. Filled icons fill the outline path instead of using separate artwork

**Status: confirmed, and the effect is larger than stated.**

The design has an `ICONS_FILLED` table with seven entries.
Every one of them sets `stroke: "none"` explicitly, and three of them are genuinely different artwork rather than a filled outline.

The frontend has no filled table.
`lx-icon.jsx:39-52` special-cases `home` with bespoke artwork, and for every other glyph `lx-icon.jsx:59` sets `fill` on the `<svg>` while leaving the stroke on.

Consequences, per glyph:

| Glyph | Effect |
|-------|--------|
| `bell` | The clapper `M13.73 21a2 2 0 0 1-3.46 0` is an open arc. Filling it closes it into a solid lens the design never draws. The design instead redraws the clapper stroked at width 2 |
| `explore` | The handle keeps a 1.5 stroke where the design specifies 2.5 |
| `profile`, `heart`, `bookmark`, `chat` | Fill plus a retained 1.5 stroke renders each shape roughly 1.5px larger in every direction than the design's fill-only shape |
| `home` | The frontend's bespoke door is `M10 22v-5.5...`, 4 wide and 6.5 tall from y=15.5. The design's is `rect x=9 y=13 w=6 h=9 rx=1`, 6 wide and 9 tall from y=13 |

All seven filled glyphs appear in the primary navigation in their active state, so this is visible on every screen at every viewport.

A related blocker: the design's filled artwork uses `fill="currentColor"`, and the frontend's `LxIcon` does not set `style.color` on the `<svg>` the way the design's does at `main.js:994`. Porting the artwork verbatim requires adding that line.

**Where:** `lx-icon.jsx:35-68`.

**Size:** small. Copy `ICONS_FILLED` across, add the `style.color` line, and branch on the table instead of on `name === 'home'`. The artwork already exists and does not need to be drawn.

## 7. No modal closes on the Escape key

**Status: confirmed for modals, with two corrections.**

**Correction one.** One overlay does close on Escape. `lx-dropdown-menu.jsx:62-66` registers a `keydown` listener and calls `onClose` on `Escape`. It is a popover rather than a modal, but the blanket statement is not accurate.

Every other overlay does not. A search of `src/` finds `Escape` at exactly four lines, all four inside `lx-dropdown-menu.jsx`.

Confirmed as not closing on Escape:

| Surface | Closes by |
|---------|-----------|
| `ReportModal` | scrim click, or the explicit close and done buttons |
| `LxModal` | scrim click, or its action buttons |
| `LxBottomSheet` | scrim click |
| Post detail overlay | its own back or close affordance |
| Story viewer and composer | their own close affordance |

**Correction two.** This is not a divergence from the design.
A search of all three design chunks finds zero occurrences of `Escape` and no `keydown` listener anywhere.
The design's `ReportModal`, `CommentModal`, `ConfirmModal`, and `LxMenu` all close on scrim click or explicit button only.

So the frontend matches the design exactly here, and the frontend is in fact slightly ahead because its dropdown does handle Escape.

This belongs on an accessibility list, not a conformance list.
Fixing it would be a deliberate improvement on the reference rather than a move toward it.

**Where:** `ReportModal.jsx`, `primitives.jsx` (`LxModal`, `LxBottomSheet`), `PostDetailScreen.jsx`, `StoryScreens.jsx`.

**Size:** small per surface, five surfaces. A shared `useEscapeKey` hook would cover all of them at once.

## 8. Post like state is component-local

**Status: confirmed.**

`PostCard.jsx:20-22` holds `liked`, `likeCount`, and `saved` in `useState` seeded from the post prop.
Nothing synchronises two `PostCard` instances rendering the same post, and nothing synchronises a card against the post detail overlay opened from it.

The design solves exactly this problem.
`main.js:4986` creates `window.__lxStore` with a `likes` set and a `listeners` map.
`main.js:2071-2077` has every `PostCard` subscribe to its own post id on mount and unsubscribe on unmount, and `_lxToggleLike` at `main.js:4987-4991` notifies every subscriber.
Two renderings of the same post in the design always agree.

The frontend is the only side with this defect, and it has a live trigger: opening the post detail overlay from a feed card renders the same post twice at once, so liking in one place leaves the other stale until a refetch.

There is a second-order effect. `PostCard.jsx:57-61` reconciles `likeCount` to the server's value on mutation success, but only for the instance that fired the mutation.

**Where:** `PostCard.jsx:20-22,44-87`, and wherever `PostDetailScreen` holds its own like state.

**Size:** medium. The correct fix is not to copy the design's global store but to let TanStack Query own it, since the like already round-trips to the server. That means moving the optimistic update into the mutation's `onMutate` with a cache patch and rollback in `onError`, which is a rewrite of two handlers plus the query key design. The derived rollback behaviour listed in `derived-treatments.md` must survive the change.

## Summary

| # | Divergence | Status | Size |
|---|-----------|--------|------|
| 1 | Menu Title Case | Confirmed as internal inconsistency; premise corrected | Trivial |
| 2 | Capitalised empty states | Confirmed, and wider than stated | Trivial |
| 3 | Comments overlay versus screen | Confirmed, deliberate | None |
| 4 | Report cap 500 versus 2000 | Confirmed, deliberate | None |
| 5 | Heart colour | Confirmed | Trivial |
| 6 | Filled icon artwork | Confirmed, larger than stated | Small |
| 7 | No Escape on modals | Confirmed, but matches the design; not a conformance issue | Small |
| 8 | Local like state | Confirmed | Medium |

Two need no action.
Three are string or value edits.
Two are small mechanical changes.
One, the like state, is real engineering.
