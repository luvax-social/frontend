# Design decisions

> Record of work done on 2026-08-25. Not maintained; it is correct as of that date and is not updated as the code moves.

## 1. The grouping, and the reasoning behind it

Three groups, seven categories. Two group names were given by the brief; the third was added
because the verified inventory holds real settings that fit neither.

### how you use luvax

The account's own presence, and what it receives.

| Category | Holds |
|---|---|
| profile | picture, banner, display name, username, bio, link |
| notifications | the five `notify_*` booleans |
| saved posts | `GET /posts/saved` |

### who can see your content

Visibility and audience. Everything here changes what somebody else can see or do.

| Category | Holds |
|---|---|
| privacy | private account, activity status, story replies, message requests |
| follow requests | the pending-request list, with approve and decline |
| blocked accounts | the blocked list, with unblock |

### your account

**The group that was added.** The inventory holds six real things that are neither about the
account's presence nor about its audience: the email address, the verified badge, the join
date, the warnings the account has received, the password reset, and signing out. They are
facts about the account and about getting into it.

Naming it took some care. The two given names are clauses written from the person's side —
"how you use luvax", "who can see your content". A third clause in that shape would have been
forced ("what luvax knows about you" reads as a privacy-policy heading, which is the wrong
promise). `your account` keeps the lowercase plain-spoken voice without pretending to be a
question it is not.

### Where things went that did not obviously belong

**`saved posts` is not a preference.** It is content — a list of posts. It sits under
`how you use luvax` for one concrete reason: the settings screen is the **only** place in the
application from which the saved list is reachable (`ROUTES.SAVED` had exactly one navigation
site, the old settings list). Dropping it would have removed a working capability, which this
phase is not permitted to do. It is a category rather than a link-out so that moving to it
follows the same no-back-navigation rule as everything else.

**`follow requests` could have belonged to the profile.** It is a relationship list, and the
profile owns followers and following at their own routes. It went here because approving a
follower is an audience decision — on a private account it is *the* audience decision — and
because, unlike followers and following, it has no other home in the product. Followers and
following were deliberately **not** brought in: they already have addresses, and duplicating
them would mint a second URL for the same list.

**`isPrivate` is shown in two categories and written in one.** The account category lists it
as information beside the verified badge and the join date, because "who can see my posts" is
part of an account's standing. The control lives in privacy. Only one of the two writes.

**The theme toggle was removed from settings.** It is the one control on the old screen that
did something real but had no server behind it. Rendering it beside settings the server does
store would have implied it was of the same kind. It is a browser-local device preference and
keeps working where it already lived; the panel's own header still carries a theme control.

---

## 1a. What a row in the list carries

**Decision.** An icon and a name. Nothing else.

The list first shipped with a one-line strapline under every name — "your name, picture and
bio" under profile, and six more like it. Seven straplines in a column compete with the seven
names they describe, and a person scanning for a name reads twice as much to find it. What a
category is for is now said **once, at the top of the category itself**, where somebody has
actually chosen to read it. The strings did not change; only where they are said did.

The icon is the same internal inline-SVG component the rest of the product uses. One glyph was
missing — a person-with-plus for follow requests — and was added to that component in the
export's own 24×24, 1.5-stroke style, which is what the design rules say to do rather than
reaching for a second icon set.

**The open row is not marked with an accent rule on its leading edge.** It was, and that read
as a highlight colour on a navigation list. It now sits one step up the surface scale with its
name in the heavier weight and its icon in full ink at a heavier stroke — three signals, none
of them a colour the product reserves for something else. Hovering lifts a row one step less.
Neither fill is load-bearing on its own: the selection survives being unable to tell the two
surfaces apart.

## 1b. Searching the list

**Decision.** A field above the group list that filters the names already on screen.

It matches a category's name or its group's title, hides any group left with nothing in it,
and says so plainly when nothing matches. It asks the server nothing, because there is nothing
to ask: the list of settings is a fixed structure, not a collection. That also means it cannot
invent a result — a thing this screen is otherwise careful about.

---

## 2. The category URL strategy

**Decision.** One screen, with the category as a path segment: `/app/settings/:category`. The
bare `/app/settings` is the group list with nothing open.

Routes are declared as two rows in `APP_SCREENS`, both rendering `SettingsScreen`, both under
`screen: 'settings'`.

**What that buys, verified in the browser:** every category has its own address; pasting one
opens that category directly; the browser's back button walks from category to category and
only leaves settings at the list; and because the group list is one component instance that
stays mounted while the category changes, it keeps its scroll offset and issues no request
when the selection moves.

**The option rejected: keeping the category in component state.** It is less code and it was
what the screen effectively did before, since three of the four destinations were separate
screens reached by navigation. It fails the whole point of the phase: the complaint is that
browsing settings means going back and forth, and a rebuild where every category shares one
URL has not fixed that. It also loses the back button, which is the affordance a person
actually reaches for.

**The option rejected: a redirect from `/app/settings` to the first category at desktop.**
This would avoid landing on an empty region on a wide screen. It was rejected because the
redirect could only be correct at one width: at phone width `/app/settings` must be the list,
since the list is the whole screen there. One address would then mean two different things
depending on the viewport, which breaks "pasting that URL opens the same state". The bare
address is the list at every width, and at desktop the region beside it says what it is for.

**Addresses that existed before the rebuild still resolve.** `/app/settings/profile` and
`/app/settings/blocked` are now category addresses for the same content. `/app/settings/saved`
is unchanged. `/app/settings/password` was a screen that only said it was not built yet; it
now resolves to the account category, which carries the only password action the backend
actually offers. An unrecognised segment renders the group list beside a message saying the
link no longer points at a setting, rather than a broken screen or a 404 out of the app.

---

## 3. The navigation rail overlay

The rail already overlaid rather than pushed: it is `position: fixed`, so expanding it cannot
reflow the page. That was verified rather than assumed — with the rail closed and then
hovered, every content coordinate is identical.

**Settings sits flush against the rail, and is therefore what the rail expands over.** Every
other screen is a reading column centred in the page, which left a wide gap between the rail
and the settings list and meant the expanded rail covered nothing. Settings now takes the full
width from the rail's collapsed edge instead, so the group list begins exactly where the rail
ends. Measured closed and hovered: the rail goes 68 → 223 rendered pixels and overlaps the
list, while the group list and the category region stay at 68 and 374 — the layout does not
move, which was always the requirement. The form fields the person types into are in the
category region, well clear of the expanded rail.

**What was missing was the keyboard.** The rail expanded on `mouseenter` only, so the labels —
its only readable naming of its destinations — were a mouse-only affordance. Focus entering
the rail now opens it exactly as hover does, and focus leaving closes it, using React's
bubbling focus events and a `relatedTarget` containment check so moving between two buttons
inside the rail does not flicker it shut.

**Reduced motion** is handled by the global rule already in the stylesheet: every transition
here uses the shared `--duration-*` and `--ease-out` tokens, so `prefers-reduced-motion:
reduce` neutralises them along with the rest of the application. Measured under emulation:
all three transitions resolve to `1e-06s` and the screen still renders correctly.

**The rail's labels were moved off `--lx-ink-3`.** They are the only place the rail names
where its icons go, which makes them content rather than decoration, and that token measures
below the threshold in both themes.

---

## 4. Patterns derived rather than taken from the export

The design export covers a reading surface. It has no settings screen, so each of these is
built from the export's own tokens and labelled as derived in the source:

- **The centred measure.** The category region fills whatever width it is given,
  but the content inside it is held to a readable measure and centred in that
  region rather than pinned to its leading edge — at a wide viewport the leftover
  space otherwise pooled entirely on the right. The centring is done by growing
  the region's own side padding, not by giving each child auto margins: that way
  the back button at a narrow width and the fields share one leading edge, which
  per-child margins could not do without stretching the button's hit area across
  the whole column. A floor on the padding keeps the ordinary gutter once the
  region is narrower than the measure.
- **The two-region layout** (`.lx-settings`) — a group list beside a category, each region
  scrolling on its own, collapsing to one full-width region at a narrow width. Derived.
- **The settings row** (`.lx-settings-row`) — label and explanation on the left, control on
  the right, separated by a hairline rather than boxed. Derived from the export's divider and
  spacing tokens.
- **The read-only row** (`.lx-settings-readonly`) — a value with no endpoint behind it, drawn
  as plain text. Derived, and deliberately not a disabled control: a greyed-out input implies
  the value could be edited under some other condition, and for `email` none exists.
- **The state block** (`.lx-settings-state`) — one frame shared by loading, empty and failure,
  so a category never renders as an unexplained blank region and the layout does not jump when
  a request resolves. Derived.
- **The warning card** (`.lx-settings-warning`) — a warning the account has received, stated
  plainly with a single tone marker on the leading edge. Derived.
- **The authentication outcome page** (`AuthNotice`) — reuses the auth surface's existing
  centred-card composition (`lx-shell` / `lx-col` / `lx-card` / `lx-head`) rather than
  inventing a second one. Its only new part is a two-tone badge: calm for an outcome the
  person chose, problem for one that actually failed.

### Matched rather than reused

The panel built a master-and-detail in the previous phase, and this is the same pattern. It is
**matched deliberately, not imported**: `SplitView` and `panelStyles` live in the admin
feature, and the frontend rules forbid a feature importing another feature's internals.
Extracting them to a shared location would mean moving files, which this phase may not do. The
behaviour is copied — two regions, independent scroll, collapse at a narrow width, focus and
scroll reset on selection change — and the CSS is written from the same tokens.

---

## 5. Colour decisions forced by measurement

Two pairings failed when measured and were changed. No token was invented for either.

**The failure banner.** `--lx-error-text` on `--lx-error-dim` measures **1.44:1** in the dark
theme, because there the dim tint and the text tone are both light. The banner now sits on
`--lx-base` and carries the error in its border and text tone: **7.02:1** text, **4.98:1**
border in dark.

**The toggle.** Its off fill is `--lx-surface-raised`, which measures **1.25:1** against the
page in dark — the switch disappears. Neither border token rescues it (`--lx-border` 1.44:1,
`--lx-border-strong` 1.82:1). The boundary is drawn in `--lx-ink-2` instead: **7.92:1** off,
**7.95:1** on, clearing the 3:1 a UI component's visible boundary needs. `--lx-ink-3` would
also have cleared it at 3.74:1 and was not used, because it is the role this product measured
as failing and this phase may not use it.

**The auth surface's primary button** carried `--lx-ink-inverse` on `--lx-accent`, the same
2.08:1 pairing the panel corrected in the previous phase. This phase's pages use that button,
so it is now `--lx-black`, which is theme-invariant and measures **9.43:1** on the accent.
