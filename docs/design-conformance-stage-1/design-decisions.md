# Design Decisions

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

Three decisions and four derived values.

## 1. The right rail's suggested block

**Decision: build the composition, leave it out of the rail.**

This is option 1 of the three the brief offered, and it was taken because option 2 has no candidate.

### What the design has

The design's `LxRightRail` hardcodes three people: `sol.r` with the bio "morning, window, coffee", `jo.x` with "reading slowly in 2026", and `ren.ko` with "design, restraint".
Each row is a 36px avatar, a 13px semibold name, an 11px ink3 bio that truncates, and a ghost small button reading "follow".

### Why not option 2, a real data source

There is no suggestions endpoint.
The recommendation module exists in the backend as a scaffold with a partition job and no read surface, so nothing serves suggested accounts.

Every existing endpoint that returns a list of users answers a different question.
Followers and following describe an existing relationship, which is the opposite of a suggestion.
Pending follow requests are inbound and already actionable elsewhere.
User search needs a query.
Choosing any of them and calling the result "suggested" would invent a product rule that nobody has decided, and it would be a worse lie than an empty rail, because it would look correct.

### Why not option 3, do not build it

The composition is small, its values are all readable from the design, and reading them now while the design source is open is cheaper than reading them again later.
Building it also makes the missing piece explicit in the code rather than only in a document.

### What was built

`LxSuggestedList` in `shell.jsx`, exported, taking a `users` array and rendering `null` when that array is empty.
It is not referenced by `LxRightRail`.

Every value comes from the design: avatar 36, name 13 at weight 600, bio 11 in ink3 with ellipsis truncation, row gap 12, section gap 12, label 10 mono uppercase at 0.1em tracking with 12 below, and a ghost button at size `sm`.

### What it does not do

It renders no placeholder people.
No name, bio or avatar index from the design's hardcoded three appears anywhere in the code.
This project has already removed fabricated people once, and reintroducing them inside a conformance pass would undo that for the sake of a screenshot.

When a suggestions endpoint exists, this needs a data hook and one line in `LxRightRail`.

## 2. The mute rule

**Rule: every `<video>` mounts muted. Audio is opt-in, through the controls the surface already provides.**

### The reasoning

The concrete failure the audit observed is the reason a rule is needed at all.
Post detail opens as an overlay above the feed, so the same video is mounted twice, and while the overlay copy was unmuted a viewer could produce sound from it while the copy behind played silently.
Any rule that leaves some surfaces unmuted keeps that failure available.

Muted at mount is the only setting where no surface can emit sound the viewer did not ask for.
It is also the only setting compatible with autoplay if any of these ever autoplay, since browsers block autoplay with audio.

Opt-in is not lost.
Three of the four carry `controls`, so unmuting is one click, and it applies to the copy the viewer is actually looking at.

### Applied

All four now carry `muted`.
Two already did; the composer preview and post detail did not.

### What was rejected

Unmuting everything was rejected because it makes the double-mount audible by default rather than only in one direction.

Muting everything except the composer preview was considered, on the argument that a composer is reviewing their own file and wants to hear it.
It was rejected because it keeps a per-surface exception that the next person has to rediscover, and because the composer preview has controls, so the author can unmute in one click.

### What is not fixed here

The double-mount itself.
Post detail over the feed still mounts the same media twice, and this stage only removes the audible symptom.

Adding controls to the explore grid thumbnail was also left alone, since the rule is about mute and the explore screen is out of scope.

## 3. The bottom nav unread badge

**Decision: remove the active bar, keep the unread badge.**

The brief asked for "an active bar and an active dot" to be removed from the bottom nav.

Reading the code, there is one active-state decoration and one badge:

- A 2px span pinned to the top of the active button, keyed on `isActive`. This is the invented active bar. Removed.
- A 8px dot on the notifications button, keyed on `hasNotifications`, driven by pending follow requests and the unread count. This is not an active-state indicator.

The badge was kept.
It is keyed to unread state rather than to which tab is active, it is the only indication anywhere in the bottom nav that something is waiting, and it is fed by live data.
Removing it would delete a working affordance rather than conform a style, and this stage is not supposed to change behaviour beyond what the audit recorded as divergent.

The design has no equivalent because the design has no unread state to model.
The design does render a dot on the app bar's bell, unconditionally, which suggests the intent is for unread to be shown rather than hidden.

This is a deliberate deviation from the literal instruction and is easy to reverse if the reading was wrong.
The same reasoning applies to the notification badge on the desktop top tabs, which is also retained.

## 4. Derived values

Four values could not be read from the design and are labelled here, per the no-fabrication rule.

### 4.1 The hide-on-scroll trigger

The design defines the CSS and gives its header the `lx-bar` class and a `data-lx-bar` attribute, but never adds `lx-bar-hidden` anywhere in any chunk.
The animation is therefore a port and the trigger is a derivation.

| Value | Source |
|-------|--------|
| `transition: transform 220ms ease, opacity 220ms ease` | Design, verbatim |
| `transform: translateY(-100%)` | Design, verbatim |
| `opacity: 0` | Design, verbatim |
| Hide on downward scroll, reveal on upward | Derived, the conventional behaviour for this pattern |
| 56px scroll floor before hiding | Derived from the bar's own height, so the bar never hides while still overlapping the content it belongs to |
| 6px movement threshold | Derived, to ignore sub-pixel and momentum jitter that would otherwise flicker the bar |

### 4.2 The unfollow and block glyphs

The design defines `userMinus` and `ban` but no design screen uses either, so the row assignment is derived from what the rows do.

`userMinus` is applied only when the row would unfollow, because the design ships no `userPlus` and the follow direction is not destructive.

### 4.3 The tablet conditionals

Tablet is out of scope, but several values the design specifies live in ternaries the tablet branch shares.
Rather than change tablet, each was split so the tablet arm keeps its existing value literally.

This is a derivation only in form: no tablet value changed, and every desktop and mobile value is the design's.

### 4.4 The rail width

The rail keeps 280 rather than the design's 300.

The design's 300 is one term of a coherent set: 300 spacer plus 680 feed plus 300 rail is its 1280 shell, stated in a comment in its own source.
This frontend's desktop shell is 1260 with a 280 left column.
Changing only the rail would leave the layout asymmetric and narrow the feed, which is worse than the current small divergence, and changing all of it is the desktop layout that was measured conformant and placed out of scope.

Recorded in `deferred-findings.md` as a set to move together or not at all.
