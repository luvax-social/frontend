# Implementation Plan

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

Effort size per screen, what drives each estimate, and a proposed sequence.

Sizes are relative, not absolute: **small** is under a day, **medium** is one to three days, **large** is more than three days, for one engineer already familiar with the codebase.

## Sizing

### Design system

| Item | Size | What drives it |
|------|------|----------------|
| Token layer | **None** | Verified conformant. No work |
| `LxIcon` filled variants | **Small** | Seven glyphs of artwork already exist in the export and can be copied. Needs an `ICONS_FILLED` table, the `style.color` line, and a branch change. Mechanical |
| `LxIcon` missing glyphs | **Small** | Three glyphs to add: `mail`, `userMinus`, `ban`. Two of them fix wrong icons on destructive menu rows |
| `LxIcon` outline `home` | **Small** | One path swap |
| `LxBtn` primary text colour | **Small** | One token change, `v.ink` to `v.inkInverse`. Touches every primary button in the application, so it needs a visual pass afterwards, not just the edit |
| `LxBtn` forced lowercase | **Small** | Removing `textTransform` changes every button label at once. The edit is one line; deciding the copy for each label is the actual work |
| `LxTag` active border | **Small** | One value |
| `ConfirmModal` | **Medium** | A primitive that does not exist. Includes the 500 ms arming delay, and then migrating every destructive flow off the ad hoc `LxModal` usages |
| `toast` | **Medium** | No mechanism exists. Five confirmations are currently silent. Needs the host, the component, and the call sites |
| `LxDropdownMenu` restyle | **Small** | Radius, padding, blur, shadow, hover, and animation all differ. Every one is a value in one file. The open question is whether to keep the frontend's better version |

Design system total: one medium-sized new primitive, one medium-sized new mechanism, and roughly eight small value changes.

### Shell

| Item | Size | What drives it |
|------|------|----------------|
| App bar, desktop | **Small** | Eleven measured value differences, all in `shell.jsx`. Blur, paddings, gaps, logo size, bell geometry, avatar size |
| Top tabs, desktop | **Small** | Container gap, button width, alignment, icon size, and removing the invented underline. All in one component |
| Bottom nav, mobile | **Small** | Blur, icon size, and removing the invented active bar and dot |
| Right rail | **Medium** | Width and type values are small. The missing `suggested` block is new composition: three user rows with avatar, name, bio, and a ghost follow button, and it needs a data source decision since the design's is hardcoded |
| Shell, desktop layout | **None** | Measured identical at 1440. No work |
| Shell, mobile layout | **None** | No structural difference found |
| Shell, tablet layout | **Large** | The two sides implement different designs, not different values. The design treats tablet as a wide phone with a bottom nav and a single 640px column; the frontend treats it as a narrow desktop with a top tab strip and a compact rail. Conforming means deleting the frontend's tablet branch and rebuilding it, then re-checking every screen at that viewport |
| Header hide-on-scroll | **Small** | The design's CSS exists in the export and the frontend has no `lx-bar` class. Adding it is a class plus a scroll listener |

### Screens

| Screen | Size | What drives it |
|--------|------|----------------|
| **Settings** | **Small** | Closest match in the application. Every section, row, and sub-label already matches word for word. Only real difference is the toggle knob shadow colour. The `coming soon` additions should be kept |
| **Feed** | **Medium** | The post card carries twenty measured differences, several of them structural: the card-level click target, the caption size and line height, the avatar size, the radius and border. Plus the missing empty state. The card is used on the feed and nowhere else, so the work is concentrated |
| **Profile** | **Medium** | Twenty-three measured differences. Most are values, but two are behavioural: the follow button never showing a followed state, and the grid tile aspect ratio being uniform where the design mixes `3/4` and `1/1`. The mixed ratio needs a data decision since the backend does not return a `tall` flag |
| **Notifications** | **Medium** | Two structural gaps rather than value drift: the missing `today` and `this week` date grouping, and the collapse of six notification types down to two icons and two colours. The `TYPE_ICON` and `TYPE_COLOR` maps already exist and are correct; only `NotifRow` ignores them |
| **Explore** | **Medium** | Fifteen measured differences plus three functional gaps: the people results capped at one, the active topic never filtering, and the design's `no results` empty state not implemented. The search result card is a wholly different component from the design's `MiniCard` |
| **Report modal** | **Unknown, provisionally medium** | The design side is fully measured; the frontend side is not. The 474-line frontend file was not read against it. The estimate is provisional and should not be relied on for scheduling |
| **Post detail** | **Unknown, provisionally large** | Largest screen at 810 lines, and it must absorb the design's `CommentModal` treatment as well as `CommentRow` and `CommentsSheet`. Not measured. Also carries the like-state fix from `known-divergences.md` item 8 |
| **Composer** | **Unknown, provisionally medium** | Not measured. The design's is 291 lines, the frontend's 370 |
| **Story viewer and composer** | **Not sized** | Out of scope as a feature |
| **Onboarding** | **Not sized** | Out of scope as a feature. The frontend's 183 lines against the design's 395 suggests it is materially incomplete, but that is a feature gap, not a conformance one |
| **Messages** | **Not sized** | Out of scope as a feature. Carries ten hardcoded off-palette colours that will look wrong if it is ever demoed |

### Cross-cutting

| Item | Size | What drives it |
|------|------|----------------|
| Like state sharing | **Medium** | Real engineering. Should move into TanStack Query rather than copying the design's global store, and must preserve the existing optimistic rollback |
| Empty states | **Small** | Four surfaces have none: feed, explore trending, explore search, profile grid. The vocabulary already exists |
| Copy capitalisation | **Trivial** | Five strings, one decision |
| Escape on modals | **Small** | One shared hook, five call sites. Not a conformance item |

## Proposed sequence

The order below is derived from three things the audit established: what blocks what, what is visible on every screen, and what the demo actually shows.

### Phase 1: the icon and button layer

`LxIcon` filled variants, the three missing glyphs, the outline `home`, and the `LxBtn` primary text colour.

This goes first because it is the only work that changes every screen at once.
Seven filled glyphs sit in the primary navigation at all times, and the primary button colour affects follow, accept, continue, and submit on five screens.
Doing it first means every later screen pass is checked against already-correct chrome, and it is cheap: the artwork exists and the button change is one token.

Do **not** bundle the `textTransform` removal here.
It changes every label in the application and needs the copy decision from `known-divergences.md` item 1 settled first.

### Phase 2: the shell at desktop and mobile

App bar, top tabs, bottom nav, and the right rail including the missing `suggested` block.

Desktop and mobile layout are already correct and measured, so this is value work plus one piece of new composition.
It comes second because the shell frames every screen, and because the tab hit target dropping from 109px to 44px is a usability regression worth closing early.

Explicitly excluded: tablet.

### Phase 3: feed and post card

The single highest-value screen.
It is the landing screen, it is what a demo opens on, and the post card is the most-reused composition in the product.

Bundle the empty state here.
The feed currently renders a blank column for an account with no follows, which was observed directly, and that is the worst thing a demo can do.

### Phase 4: profile

Second most demo-relevant.
Take the follow button state fix with it, since a follow button that never shows `following` is a functional defect and not a styling one.

### Phase 5: notifications and explore

Both medium, both mostly structural rather than value drift.
Notifications needs date grouping and the per-type icons; explore needs the people cap lifted, the topic filter wired, and the design's empty state implemented.

Neither is on the critical demo path, which is why they sit here rather than earlier.

### Phase 6: settings

Deliberately last among the in-scope screens, because it is nearly conformant already.
Doing it early would spend a day for almost no visible change.

### Phase 7: measure what was not measured

Report modal, post detail, and composer.

These three carry provisional estimates that should not be scheduled against.
Before committing to them, complete the comparison: roughly 2,000 lines on each side, which is a day of reading and would convert three unknowns into real numbers.

Post detail should absorb the like-state fix, since that screen is where the defect actually shows.

### Not scheduled

Tablet, sized large, is deferred rather than dropped.
It is a rebuild rather than an adjustment, and no decision has been recorded on whether the design's tablet treatment is even wanted now that the frontend's version exists and works.
That decision should be made explicitly before any tablet work starts, because the frontend's narrow-desktop tablet is arguably the better product even though it is not the reference.

Stories, onboarding, and messages are out of scope as features.

## What this audit did not settle

Three things need a decision before or during implementation, and none of them is the audit's to make.

1. **Whether `LxDropdownMenu` should be downgraded to match the design.** The frontend's menu has better hover, focus, animation, and radius than the design's. Pixel-perfect conformance says change it; product sense says keep it.
2. **Whether the frontend's tablet layout should be replaced.** See above.
3. **Whether `#D15B5B` becomes a token.** It is now used in more than one place and will be used in a third.

## Total

| Bucket | Count |
|--------|-------|
| No work needed | Token layer, desktop shell layout, mobile shell layout, two of the eight known divergences |
| Trivial | 3 items |
| Small | 14 items |
| Medium | 8 items |
| Large | 1 item, deferred |
| Unknown, needs measurement first | 3 screens |

The headline is that the conformance gap is narrower than "the largest remaining piece of work" implies for the design system and the desktop shell, and wider than expected on tablet.
No screen the product needs is missing.
The work is concentrated in per-screen fidelity, one absent primitive, one absent toast mechanism, and one genuine architectural fix in the like state.
