# Screen Differences

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

One section per screen present on both sides.
Concrete values only.

Each section states the depth of comparison reached.
Where a property was not measured, that is stated rather than guessed.

All findings are **[source]** unless marked otherwise.

---

## Application shell

Depth: full comparison of `LxShell`, `LxAppBar`, `LxTopTabs`, `LxBottomNav`, and `LxRightRail`.

### Desktop layout

**[observed]** Measured at 1440 x 900 in both applications.

| Element | Design | Frontend |
|---------|--------|----------|
| Main column | x=377, width 680 | x=377, width 680 |
| Right rail | x=1057, width 300 | x=1057, width 280 |
| Main column with no rail | x=377, width 680 | x=377, width 680 |
| Header | full width, height 56 | full width, height 56 |

The main column lands in the same place in both, at both rail states.
The design achieves this by rendering a 300px spacer only when the rail is shown and letting flex centring do the rest; the frontend achieves it by always rendering a 280px spacer inside a 1260px centred container.
Different mechanisms, same result, so this is not worth changing.

The rail is 20px narrower on the frontend.

### App bar

| Property | Design | Frontend |
|----------|--------|----------|
| Height | 56 at every viewport | 56 desktop and mobile, **52 tablet** |
| Backdrop blur | `blur(12px)` | `blur(10px)` |
| Inner max width | desktop 1280, tablet 640, mobile 100% | desktop 1260, tablet 948, mobile 100% |
| Inner layout | flex row | CSS grid, three columns |
| Inner padding | mobile `0 12px`, otherwise `0 16px` | mobile `0 12px`, tablet `0 6px`, desktop `0 28px` |
| Inner gap | mobile 0, otherwise 12 | mobile 0, tablet 10, desktop 20 |
| Logo font size | 22 | desktop 24, tablet 21, mobile 20 |
| Logo letter spacing | `-0.03em` | desktop and tablet `-0.045em`, mobile `-0.04em` |
| Subpages with a back header | `post`, `settings` | `post`, `settings`, `edit-profile`, `change-password`, `blocked` |
| Back button target | always `navigate('feed')` | `navigate(-1)`, real history |
| Mobile compose button | `padding 6`, icon `plus` 22 in `v.ink2` | `padding 4`, `marginLeft -4`, icon `plus` 22 in `v.ink` |
| Bell button | `background v.surface`, no border, `borderRadius 50%`, 36 x 36 | `background none`, `1px solid v.border`, `borderRadius 999px`, 32 x 32 desktop, 34 x 34 tablet |
| Bell icon | size 18 | size 19 desktop, 20 tablet |
| Bell dot | always rendered, 7 x 7, at `top 6 right 6` | rendered only when unread, 6 x 6, at `top 5 right 5` |
| Avatar | 32 | 32 desktop, 30 tablet |
| Tabs shown at | desktop only | desktop and tablet |
| Tablet centre slot | `LxHeaderSearch`, centred | `LxTopTabs` in compact mode |
| Hide on scroll | CSS exists: `header.lx-bar.lx-bar-hidden` translates `-100%` over 220ms | no `lx-bar` class anywhere; header never hides |

**[observed]** Measured element positions at 1440.

| Element | Design | Frontend |
|---------|--------|----------|
| Logo | x=93, 61 x 26 | x=119, 65 x 24 |
| Tab 1 | x=405, width 109 | x=443, width 44 |
| Tab 2 | x=518 | x=561 |
| Tab 3 | x=631 | x=679 |
| Tab 4 | x=743 | x=797 |
| Tab 5 | x=856 | x=915 |
| Tab pitch | 113 | 118 |
| Bell button | x=1187, 36 x 36 | x=1189, 32 x 32 |
| Avatar button | x=1233, 32 x 32 | x=1235, 32 x 32 |
| Search box | x=977, 200 x 36 | not measured |

The tab hit target is 109px wide in the design and 44px wide in the frontend, a reduction of roughly 60 percent in clickable area, and the whole strip sits 38px further right.

### Top tabs

| Property | Design | Frontend |
|----------|--------|----------|
| Container gap | 4 | 74, compact 38 |
| Container max width | 560 | 596, compact 300 |
| Container flex | `flex: 1` | `flex: 0 0 auto`, `width: 100%` |
| Button sizing | `flex: 1`, `maxWidth: 110` | `flex: 0 0 auto`, `width: 44`, compact 40 |
| Button vertical alignment | `justifyContent: center` | `justifyContent: flex-start` with `paddingTop: 16`, compact 11 |
| Icon size | 22 | 23, compact 21 |
| Active underline | none | 12 x 1.5 pill at the bottom, `rgba(200, 169, 126, 0.78)` at `opacity 0.45` |
| Notification dot | none | 6 x 6 accent dot on the bell tab when unread |
| Tab set | `feed`, `explore`, `messages`, `compose`, `notifications` | identical |
| Labels | defined in the array, never rendered | identical, also never rendered |

The active underline is a frontend invention and hardcodes the accent, so it will not follow an accent change.

### Bottom nav

| Property | Design | Frontend |
|----------|--------|----------|
| Backdrop blur | `blur(12px)` | `blur(10px)` |
| Icon size | 22 | 20 |
| Active indicator | none | 2px accent bar across the top, inset 28 percent each side |
| Notification dot | none | 8 x 8 accent dot at `top 6, right 25%` |
| Tab set | six, adding `profile` | identical |
| Height | 56 | 56 |

### Right rail

| Property | Design | Frontend |
|----------|--------|----------|
| Width | 300 | 280, compact 196 |
| Padding | `20px 20px` | `20px 20px`, compact `12px 10px 12px 12px` |
| Sections | **two**: trending and suggested | **one**: trending only |
| Section label letter spacing | `0.1em` | `0.12em` |
| Section label margin bottom | 12 | 14 |
| Trending row gap | 8 | 12 |
| Trending index width | 18 | 18, compact 15 |
| Trending label size and weight | 14, weight 500 | 15, weight 600 |
| Suggested block | three users: `LxAvatar` 36, name 13 weight 600, bio 11 `v.ink3` truncated, ghost `follow` button size sm | **absent** |
| Data source | hardcoded array | hardcoded array, identical contents |

**[observed]** Confirmed at 1440: the design rail renders TRENDING and SUGGESTED with three follow rows; the frontend rail renders TRENDING only and stops.

The suggested block is the single largest missing piece of composition in the shell.

### Tablet layout

The two sides implement fundamentally different tablet designs.

| Property | Design | Frontend |
|----------|--------|----------|
| Structure | one 640px centred column with left and right borders | three columns: 82px spacer, main, rail or spacer |
| Main width | 640 minus borders | 604 normally, 704 on settings-family screens, 784 on compose |
| Shell max width | 640 | 910, 1010, or 1090 to match |
| Bottom navigation | `LxBottomNav` rendered, `paddingBottom: 72` | none; tablet uses the top tab strip |
| Right rail | none | `LxRightRail` in compact mode on feed and explore |
| App bar content | logo, centred search, bell, avatar | logo, compact tab strip, search, bell, avatar |

The design treats tablet as a wide phone.
The frontend treats it as a narrow desktop.
Bringing tablet into conformance is a rewrite of the tablet branch, not an adjustment.

### Mobile layout

Design and frontend agree: app bar, `main` with `paddingBottom: 72`, fixed `LxBottomNav`.
No structural difference found.

---

## Feed

Depth: full comparison of `FeedScreen`, `StoriesCarousel`, and `PostCard`.

### Feed screen

| Property | Design | Frontend |
|----------|--------|----------|
| Body padding | `14px 16px`, `paddingBottom 24` | desktop and tablet `14px 16px`; **mobile `10px 0 24px`** |
| "today" label | mono 10, `v.ink3`, `0.1em`, uppercase, `padding 2px 2px 12px` | identical on desktop; mobile `padding 0 14px 12px` |
| Multi-column breakpoint | tablet and desktop | tablet and desktop |
| Column count | 2 | 2 |
| Column gap | 12 cozy, 8 dense | identical |
| Item wrapper | `breakInside avoid`, `marginBottom gap`, `display inline-block`, `width 100%` | identical |
| Data | hardcoded `FEED_POSTS` | backend feed, paginated with an intersection sentinel |
| Loading state | none | `loading feed...`, mono 12, `v.ink3`, centred, padding 40 |
| Error state | none | `we couldn't load your feed. check your connection and try again.`, 14 `v.error` |
| Empty state | none | **none** |
| Infinite scroll footer | none | `scroll for more` / `loading more...`, mono 12 |

**[observed]** Signed in as the seeded account, the feed returned zero posts and rendered the stories carousel, the "today" label, and then nothing.
There is no empty state, so a user with an empty feed sees a blank column.

### Stories carousel

| Property | Design | Frontend |
|----------|--------|----------|
| Gap | not compared | 14, tablet 10 |
| Padding | not compared | `14px 14px 12px`, tablet `12px 12px 10px` |
| Own-story tile | not compared | 54 circle, `v.surface`, `1px solid v.borderStrong`, `plus` icon 20 in `v.ink2` |
| Other tiles | not compared | `LxAvatar` 48 with `hasStory` |
| Label | not compared | 11, weight 500, `v.ink` or `v.ink3` when viewed, truncated at 60px |
| Data | hardcoded `STORIES` | hardcoded `STORIES` in `constants/data.js` |

The carousel's design-side geometry was not compared property by property.
Both sides render from mock data, and stories are out of scope as a feature, so this was deprioritised.

### Post card

| Property | Design | Frontend |
|----------|--------|----------|
| Background, desktop and tablet | `v.surface` | `v.surface` |
| Background, mobile | `v.base` | `transparent` |
| Border radius, non-mobile | 12 | 14 |
| Border, non-mobile | none | `1px solid v.borderSubtle` |
| Box shadow, non-mobile | `0 2px 8px rgba(26,24,22,0.06)` | identical |
| `overflow` | `hidden` | not set; the media corners are rounded individually instead |
| Mobile separator | none | `paddingBottom 12` plus `borderBottom 1px solid v.border` |
| Card click | the whole `article` opens the comment modal | no card-level click; media, caption, and the reply button each open the post detail overlay |
| Content padding | cozy `14px 16px 16px`, dense `10px 12px 12px` | identical, except mobile which uses `14px 14px 10px` |
| Avatar size | 26 | 28 |
| Author name | 13, weight 600, `v.ink` | identical |
| Separator and time | mono 10, `v.ink3` | identical |
| Caption size | text posts 16, image posts 14 | text posts **18**, image posts 14 |
| Caption line height | 1.5 | **1.45** |
| Caption white space | default | `pre-wrap` |
| Tag row | `gap 5`, `flexWrap`, `marginTop gap`, `LxTag size sm` | identical |
| Action row | `gap 18`, `marginTop gap + 2` | identical |
| Heart icon size | 17 | 17 |
| Heart colour when liked | `#D15B5B` literal | `var(--lx-error)`, `#C47168` |
| Like count colour | always `v.ink3` | `v.ink3`, or the heart colour when liked |
| Reply count | `Math.floor(post.likes / 8) + 2`, fabricated | `post.commentCount` from the backend |
| Share button | icon only, no handler | icon plus a working share handler |
| Bookmark | 17, `marginLeft auto`, `v.ink` when saved | identical |
| Like animation | none in the card; `[data-lxtap]` gives a 220ms transform | `lx-heart-bump` keyframes, 340ms |
| Save animation | none | `lx-bookmark` bump on the same keyframes |
| Overflow menu | `LxMenu`, trigger icon 16, `padding 4`, `borderRadius 6`, menu width 216 | bespoke 20 x 20 button, icon 15, `LxDropdownMenu` width 248 |
| Like state | shared through `window.__lxStore` with a per-post listener registry | component-local `useState` |
| Media | fixed `post.media.h`, flat colour with an optional image | real image or video, `maxHeight 360` mobile / 500 otherwise |
| Owner actions | none | `edit post` and `delete post` rows, an edit bottom sheet, and a delete confirmation |
| Block error banner | none | `role="alert"` strip, mono 11, `v.errorText` on `v.errorDim` |

---

## Explore

Depth: full comparison.

| Property | Design | Frontend |
|----------|--------|----------|
| Search wrapper | `form` with `onSubmit` prevented | plain `div`, no form, so Enter does nothing |
| Header padding | `12px 16px 14px`, `background v.base`, `borderBottom 1px v.border` | identical |
| Input | 15, `v.surfaceSunken`, `1px solid v.border`, radius 999, `padding 10px 40px 10px 34px` | identical except `padding 10px 42px 10px 34px` |
| Placeholder | `search people, hashtags...` | `search posts, people, hashtags...` |
| Search icon | `explore` 15 `v.ink3`, absolute `left 12` | identical |
| Clear button | 22 x 22, `v.surfaceRaised`, shown when the query is non-empty | 24 x 24, same fill, shown when the trimmed query is non-empty |
| Clear also resets the topic | yes | **no** |
| Topic chips | all 10 topics | `TOPICS.slice(0, 8)`, so 8 |
| Chip row padding | `12px 16px` always | `12px 16px`, or `12px 16px 0` while searching |
| Active topic filters results | yes | **no**; `activeTopic` is set and never read |
| Search triggered by | a query **or** an active topic | a query only |
| Results heading | display 17, weight 700, `letterSpacing -0.02em` | display 22, no explicit weight, `letterSpacing -0.035em` |
| Results heading text | `#topic` when a topic is active with no query, otherwise `results` | always `results` |
| Query echo | mono 11 | mono 12 |
| Result count | mono 11, `marginLeft auto` | mono 12, right-aligned via `space-between` |
| Section label | mono 10, `0.1em`, `padding 4px 16px 12px` | mono 10, `0.12em`, `marginTop 14` or `26`, `marginBottom 14` |
| People results | every match | **`.slice(0, 1)`, so at most one person is ever shown** |
| People row | `div`, `padding 10px 12px`, `borderRadius 10`, `gap 12`, avatar 40, name 14 weight 600, bio 12 | `button`, `padding 0 2px 0 4px`, `gap 14`, avatar 40, name 14 **weight 700**, bio **13** with `marginTop 3` |
| People bio source | the mock `PEOPLE` array | `SEARCH_BIOS`, a hardcoded map keyed by username, falling back to `quiet notes, passing thoughts` |
| Post results layout | `columnCount` 3 desktop / 2 otherwise, `columnGap 8`, `MiniCard` | flex wrap, fixed 210px `SearchResultPost` cards, `gap 12` |
| Post result card | media, author, caption | no media at all; avatar 20, author 12, caption clamped to 3 lines at `minHeight 60`, first tag in `v.accent` at 12 weight 600 |
| Trending grid | `MiniCard` in `columnCount` columns | `MiniCard` in `columnCount` columns |
| `MiniCard` | not compared property by property | `v.surface`, radius 10, avatar 18, author 11 `v.ink2`, caption 12 truncated to one line |
| Empty search state | **`no results`** at 15 weight 500 `v.ink2`, plus `try a different word or hashtag` at 13 `v.ink3`, `padding 48px 24px`, centred | **absent**; the `posts` label renders above an empty row |

Two findings stand out.
The design does define an empty state here, which contradicts the premise that it defines none.
And the people results are capped at one, which is a functional limit rather than a styling difference.

---

## Profile

Depth: full comparison.

| Property | Design | Frontend |
|----------|--------|----------|
| Cover band height | 88 | 88 |
| Cover band background | `v.surfaceRaised` | `color-mix(in srgb, var(--lx-surface-raised) 82%, var(--lx-base))` |
| Avatar row offset | `marginTop -40` | `marginTop -38` |
| Avatar size | 80 x 80 | 76 x 76 |
| Avatar fill | `#C8A97E` literal | the user's `avatarUrl`, or `v.avatar0` |
| Avatar border | `3px solid var(--lx-base)` | `4px solid var(--lx-base)` plus `boxShadow 0 0 0 1px v.base` |
| Follow button | `variant` toggles `primary` and `secondary`; label toggles `follow` and `following` | always `variant="primary"`; label **always `follow`**, never reflects the followed state |
| Follow button geometry | `LxBtn size sm` defaults | overridden: `minWidth 62`, `height 30`, `padding 0 14px`, `fontSize 13` |
| Overflow menu | none | 30 x 30 circle, `1px solid v.border`, `more` icon 16, opening a report menu |
| Self action | `edit profile`, `variant secondary`, `size sm` | identical, plus `transform translateY(6px)` |
| Name block padding | `12px 16px 0` | `14px 16px 0` |
| Name | display 22, weight 700, `letterSpacing -0.02em` | display 24, weight 700, `letterSpacing -0.03em` |
| Verified badge | none | `check` icon 18 in `v.accent` when `isVerified` |
| Handle | mono 11, `v.ink3`, `marginTop 2`, always shown | mono 11, `marginTop 4`, shown only when the display name differs from the username |
| Bio | 14 `v.ink2`, `lineHeight 1.5`, `marginTop 10`, `maxWidth 480` | identical, except `marginTop 0` when the bio is empty |
| Stats gap | 28 | 30 |
| Stats padding | `16px 16px 16px` | `20px 16px 14px` |
| Stat value | mono 16, weight 500 | mono **14**, weight 500 |
| Stat label | mono 9, uppercase, `letterSpacing 0.08em` | mono 9, uppercase, `letterSpacing 0.14em` |
| Stats clickable | no | followers and following navigate to their lists |
| Tabs | `posts`, `photos`, `liked`, 13 weight 500, `padding 12px 0`, 2px ink underline | identical except `padding 13px 0 14px` |
| Tab behaviour | sets state, body ignores it | sets state, body ignores it |
| Grid columns | 3 at every viewport | 3 at every viewport |
| Grid gap and padding | `gap 2`, `padding 2` | `gap 2`, `padding 2px 0 0` |
| Tile radius | 4 | 0 |
| Tile aspect ratio | `3/4` when `p.tall`, otherwise `1/1` | always `1/1` |
| Tile content | flat colour | the first media image, or the caption clamped to 3 lines at 11px `v.ink3` over `color-mix(in srgb, var(--lx-surface-raised) 82%, #d8d1c4 18%)` |
| Trailing spacer | 24 | 24 |
| Loading state | none | `loading profile...` |
| Profile error state | none | `we couldn't load this profile. check your connection and try again.` |
| Posts error state | none | `we couldn't load these posts. check your connection and try again.` |
| Empty grid state | none | none |

**[observed]** Rendered at 1440 signed in as the seeded account.
The name renders at display 24 as `Luvax Ava`, the handle at mono 11, stats read `39 / 0 / 0`, and the stat labels are visibly wider-tracked than the design's.
The post grid rendered as saturated primary-colour tiles, well outside the design palette; this comes from the seeded media, not from the frontend's styling, and would not appear with real photography.

The follow button never showing a followed state is the most consequential item here: it is a state the design defines and the frontend cannot express.

---

## Notifications

Depth: full comparison.

| Property | Design | Frontend |
|----------|--------|----------|
| Tab strip | `all`, `mentions`, `requests`, 13 weight 500, `padding 12px 0`, 2px ink underline, sticky | identical |
| Tab strip z-index | 20 | 5 |
| Tab badge | none | 6 x 6 accent dot on `requests` when pending, at `top 12, right 20%` |
| Tabs functional | no; the body ignores the tab | yes; `requests` switches the data source |
| Date group headers | `today` above the first three and `this week` above the rest, mono 10, `0.1em`, uppercase, `padding 14px 16px 6px` and `16px 16px 6px` | **absent**; no date grouping at all |
| Row padding and gap | `12px 16px`, `gap 12`, `alignItems flex-start` | identical |
| Unread background | `var(--lx-accent-dim)` | `var(--lx-accent-dim)` |
| Row border | `1px solid v.borderSubtle` | identical |
| Avatar | 40 | 40 |
| Type badge | 20 x 20 circle at `bottom -2, right -2`, `2px solid var(--lx-base)` | identical |
| Badge colours | six literals: like `#C47168`, follow and request `#7A9E7A`, comment `#C8A97E`, mention `#9B7EA8`, story `#7A9EB8` | tokens `v.error`, `v.success`, `v.accent`, `v.avatar2`, `v.avatar3`, resolving to the same hex values |
| Badge icon selection | per type through `TYPE_ICON`, six distinct icons | **binary**: `profile` for follow types, `heart` for everything else |
| Badge colour selection | per type through `TYPE_COLOR` | **binary**: `v.success` for follow types, `v.error` for everything else |
| Badge icon filled | only when the type is `like` | whenever the type is not a follow, so comments and mentions render a filled heart |
| Badge icon colour | `#fff` literal | `v.white` token, same value |
| Actor and text | actor `strong` weight 600, text `v.ink2`, 14, `lineHeight 1.4` | identical, and the actor is clickable |
| Target excerpt | `"target"` line at 12 `v.ink3`, `marginTop 3`, single-line ellipsis | **absent** |
| Time | mono 10, `v.ink3`, `marginTop 4` | identical |
| Follow request actions | `accept` primary sm and `decline` ghost sm, `gap 6` | identical, and wired to real mutations |
| Loading state | none | `loading notifications...` / `loading requests...`, mono 12 |
| Empty state | none | `No notifications yet` / `No pending requests`, mono 12, padding 40 |

The two large items are the missing date grouping and the collapse of six notification types down to two icons.
The `TYPE_ICON` and `TYPE_COLOR` maps exist in the frontend and are correct; only `RequestRow` reads them, while `NotifRow` ignores them in favour of the binary branch.

---

## Settings

Depth: full comparison of structure and labels, full comparison of the three settings primitives.

This is the closest match in the application.

| Property | Design | Frontend |
|----------|--------|----------|
| Section headers | `account`, `appearance`, `privacy`, `notifications`, `support` | identical, in the same order |
| Row labels | 18 rows, from `edit profile` to `about luvax` | identical, in the same order |
| Sub-labels | `follows system · toggle to override`, `only approved followers can see your posts`, `let people see when you were last active`, `people can dm you in response to stories`, `people you don't follow can dm you` | identical wording |
| Danger block | `sign out` and `delete account` | identical |
| Version footer | contains `v1.0` and `2026` | `luvax · v1.0 · 2026`, mono 10, centred, `padding 20px 16px` |
| Body padding bottom | not compared | 40 |
| `coming soon` notes | none | added to the `privacy` and `notifications` section headers |
| Toggles in privacy and notifications | interactive | `disabled`, `opacity 0.5`, `cursor not-allowed` |
| `edit profile` row destination | nothing | `/app/settings/profile` |
| `change password` row destination | nothing | `/app/settings/password` |
| `blocked users` row | no destination, no count | navigates, and shows a live `{n} blocked` sub-label |
| `email` row sub-label | static | the real email plus ` · verified` when verified |
| Toggle knob shadow | `0 1px 3px rgba(0,0,0,0.18)` | `0 1px 3px rgba(26,24,22,0.18)` |
| `SectionHeader` | plain div | flex with `gap 8` to carry the `note` |

Everything else in `SettingsRow`, `Toggle`, and `SectionHeader` matches exactly.

The differences are all additions driven by scope decisions: three rows became real destinations, and the features that do not exist are disabled and labelled rather than left pretending to work.

---

## Report modal

Depth: full comparison.

| Property | Design | Frontend |
|----------|--------|----------|
| Reasons | 8: `spam`, `nudity`, `violence`, `hate_speech`, `harassment`, `false_information`, `scam`, `other` | matches the backend enum; the set was not diffed against the design list |
| Description cap | 500, enforced by `slice(0, 500)` | 2000, `REPORT_DESCRIPTION_MAX_LENGTH` in `report.service.js:55` |
| Counter | `{n}/500`, mono 10, turning `v.errorText` above 450 | `{n}/2000` |
| Overlay | `z-index 2147483300`, scrim `v.scrim`, click closes | `z-index 2000`, scrim, click closes |
| Panel | width 480, `maxHeight 90vh`, column with `gap 14` | not compared |
| Preview card | `v.surface`, `1px solid v.border`, radius 12, `padding 13px 15px`; avatar 30; author 13 weight 600; entity label mono 10 uppercase `0.06em`; a `reporting` pill in `--lx-warning-text` on `--lx-warning-dim`; the text clamped to 3 lines | not compared |
| Step 1 heading | display 18 weight 700, `report {entity}` lowercase, sub `why are you reporting this?` | not compared |
| Reason row | `padding 13px 20px`, `gap 14`, 20px radio with a 10px dot, label 14 weight 500, description 12 `v.ink3`, `chevronRight` 13 | label 14 weight 500 confirmed; the rest not compared |
| Reason list max height | 340, scrolling | not compared |
| Step 1 button | `Continue`, 15 weight 500, `padding 13px 20px`, radius 999, `v.accent` on enable and `v.surfaceRaised` when disabled | not compared |
| Step 2 | back chevron, `add details`, sub `optional — helps our team review faster`; `Selected reason` and `Additional context` labels in mono 10 uppercase `0.08em`; textarea `minHeight 96` on `v.surfaceSunken` radius 10 | not compared |
| Step 2 buttons | `Submit Report` primary and `skip and submit without details` as a 13px ghost | not compared |
| Step 3 | 64px success circle on `--lx-success-dim` with a `check` at 28 stroke 2.2, animated by `checkPop` 420ms; heading `report submitted` at display 20; body copy; a mono 11 disclaimer block on `v.surface` radius 8; a `Done` outline button; the whole panel animated by `fadeSlideUp` 280ms | not compared |
| Escape closes | no | no |

The description cap divergence is deliberate and correct; see `known-divergences.md`.
The rest of this modal is the largest single block of unmeasured surface in the audit.
Closing it needs a full read of `ReportModal.jsx`, roughly 474 lines, against `additions.js` lines 168 to 227.

---

## Post detail

Depth: structural only.

Established:

- The design has no post detail screen in the sense the frontend does. `PostDetailScreen` exists and is routed, but `PostCard` and `NotifRow` both open `CommentModal` instead, so the design's post detail is effectively dead in the same way `LxSidebar` is.
- The frontend renders post detail as an overlay route over whichever screen it was opened from, at `/app/post/:postId`.
- The frontend file is 810 lines, the largest screen in the application.
- **[source]** Three hardcoded colours live here: `rgba(26,24,22,0.34)` at line 613, `rgba(0,0,0,0.14)` at line 713, and `rgba(10, 8, 6, 0.18)` at line 749.
- **[source]** It carries a `loading more...` infinite-scroll footer at line 689.

Not measured: layout, spacing, typography, comment row treatment, composer bar, action bar, and every interaction affordance.
Determining these needs `PostDetailScreen.jsx` read against `main.js` lines 3108 to 3562, which cover `CommentRow`, `CommentsSheet`, and `PostDetailScreen`, plus `additions.js` lines 264 to 344 for `CommentModal`.

---

## Composer

Depth: structural only.

Established:

- Present on both sides, routed as `compose`, shown inside the shell with no rail.
- The design's screen is `main.js` lines 2817 to 3108, and it defines `SUGGESTED_TAGS` as a 10-item array.
- **[source]** The design's composer source contains the numeric literals 280, 500, and 600, at least one of which is a character limit, but which one governs the caption was not determined.
- The frontend's screen is 370 lines.
- **[source]** The frontend's tablet shell widens the main column to 784 for compose specifically and drops its left border, which is a treatment the design's tablet layout has no equivalent for.

Not measured: media picker, type tabs, tag entry, character counter, and the submit affordance.

---

## Story viewer and story composer

Depth: structural only.

Established:

- Both exist on both sides.
- The design renders them as overlays over the last non-story screen, reusing a shared `StoryStage` with `STORY_CARD_RADIUS = 18` and `STORY_RATIO = 9 / 16`.
- The frontend renders them as overlay routes, from a single 300-line `StoryScreens.jsx`.
- The frontend has a `--lx-story-surface` token at `#2A2622` with no design counterpart.

Not measured: everything else.

Stories are out of scope as a feature, so this was deprioritised deliberately.

---

## Onboarding

Depth: structural only.

Established:

- Both exist, both render bare with no shell.
- The design's is `main.js` lines 4272 to 4667, roughly 395 lines, and defines `INTEREST_CATEGORIES` as a 16-item array.
- The frontend's is 183 lines, so it is materially smaller than the design's and is very unlikely to reproduce all of its steps.

Not measured: step count, per-step layout, or content.

Onboarding is out of scope as a feature.

---

## Messages

Depth: structural only.

Established:

- Both exist. The design's is a single 498-line chunk; the frontend's is a 439-line screen plus seven components.
- Both render in a fixed full-height pane rather than the standard shell.
- **[source]** The frontend contains three colours outside the palette entirely: `#2c2621`, `#c4b9a8`, and `#fff5f2` at `MessagesScreen.jsx` lines 405, 406, and 424.
- **[source]** Six further hardcoded alpha colours live in `mockThreads.js`.
- **[source]** The design's message composer caps input with `maxLength` and sends on Enter without Shift; the frontend's was not compared.

Not measured: everything else.

Messages is out of scope as a feature.
