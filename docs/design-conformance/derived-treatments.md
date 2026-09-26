# Derived Treatments

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

The design export renders from hardcoded arrays.
Nothing in it ever loads, fails, or comes back empty, so for most surfaces it defines no loading state, no empty state, and no error state.

The frontend has invented these.
This file lists every one of them with its location, so the implementation phase does not overwrite a considered derivation with a guess.

All findings are **[source]** unless marked otherwise.

## One correction to the premise

The design is not entirely silent on empty states.

**[source]** `ExploreScreen` defines a full empty state for a search that matches nothing: `no results` at 15px weight 500 in `v.ink2`, with `try a different word or hashtag` beneath it at 13px in `v.ink3`, in a centred block padded `48px 24px`.

That is the only empty state anywhere in the export, and the frontend does not implement it.
Every other treatment below genuinely has no design counterpart.

## The vocabulary the frontend settled on

Read across all the sites below, the derivations follow a consistent and deliberate pattern.

| Treatment | Type | Colour | Padding | Alignment |
|-----------|------|--------|---------|-----------|
| Loading, full screen | `v.fontMono` 12 | `v.ink3` | 40, or centred in a flex fill | centred |
| Loading, inline or paginated | `v.fontMono` 11 or 12 | `v.ink3` | 20 | centred |
| Empty | `v.fontMono` 12 or `v.fontBody` 14 | `v.ink3` | 40 | centred |
| Error, blocking | `v.fontBody` 14 | `v.error` | 40 | centred |
| Error, inline strip | `v.fontMono` 11 | `v.errorText` on `v.errorDim` | `8px 14px` | left |
| Disabled control | inherits | `v.ink3` | inherits | inherits |

Mono for machine states, body for human-facing errors, `v.ink3` for absence, `v.error` for failure.
This is a coherent system built from tokens and is not a conformance violation.

There is one inconsistency in it, described at the end.

## Loading states

| Location | Copy | Treatment |
|----------|------|-----------|
| `FeedScreen.jsx:85` | `loading feed...` | mono 12, `v.ink3`, centred in the flex fill, padding 40 |
| `ProfileScreen.jsx:89` | `loading profile...` | body 14, `v.ink3`, centred, padding 40 |
| `PostDetailScreen.jsx:591` | `loading post...` | not measured beyond the string |
| `PostDetailScreen.jsx:672` | `loading comments...` | mono 12, `v.ink3`, padding 20, centred |
| `PostDetailScreen.jsx:326` | `loading replies...` | mono 11, `v.ink3`, padding `8px 28px 8px 63px`, indented to align under the parent comment |
| `NotificationsScreen.jsx:209` | `loading notifications...` | mono 12, `v.ink3`, padding 20, centred |
| `NotificationsScreen.jsx:194` | `loading requests...` | mono 12, `v.ink3`, padding 20, centred |
| `FollowersScreen.jsx:61` | `loading followers...` | `v.ink3`, centred in the flex fill |
| `FollowingScreen.jsx:61` | `loading following...` | `v.ink3`, centred in the flex fill |

The `loading replies...` indent is the most considered of these: it is padded to line up with the reply column rather than being centred like the others.

## Pagination footers

A distinct treatment for "there is more, keep scrolling", driven by an intersection sentinel.

| Location | Copy |
|----------|------|
| `FeedScreen.jsx:129` | `scroll for more`, becoming `loading more...` |
| `ExploreScreen.jsx:312` | same |
| `ProfileScreen.jsx:261` | same |
| `PostDetailScreen.jsx:689` | `load more comments`, becoming `loading more...` |
| `FollowersScreen.jsx:107` | `loading more...` only, no idle label |
| `FollowingScreen.jsx:107` | `loading more...` only, no idle label |

All are mono 12 in `v.ink3` at padding 20, centred, except the follower and following variants which are 12px spans in `v.ink3` without the padded block.

The design has no pagination at all: every list is a fixed array.

## Empty states

| Location | Copy | Treatment |
|----------|------|-----------|
| `NotificationsScreen.jsx:220` | `No notifications yet` | mono 12, `v.ink3`, padding 40, centred |
| `NotificationsScreen.jsx:205` | `No pending requests` | mono 12, `v.ink3`, padding 40, centred |
| `BlockedUsersScreen.jsx:35` | `No blocked users` | returned as a subtitle string rather than a block |
| `FollowersScreen.jsx:88` | `No followers yet.` | `v.ink3`, body 14, padding 40, centred |
| `FollowingScreen.jsx:88` | `Not following anyone yet.` | `v.ink3`, body 14, padding 40, centred |

### Surfaces with no empty state

These render nothing at all when their data is empty.

| Surface | What happens |
|---------|--------------|
| Feed | **[observed]** The stories carousel and the `today` label render, then blank space to the bottom of the column. Confirmed at 1440 signed in as the seeded account, whose feed returned zero posts |
| Explore trending | The `trending today` label renders above an empty grid |
| Explore search results | The `posts` label renders above an empty row, and the design's `no results` block is not implemented |
| Profile post grid | The tab strip renders above an empty grid |
| Post detail comments | Not determined |

The feed is the one that matters: it is the landing screen, and a new account with no follows lands on a blank page.

## Error states

### Blocking errors

The screen refuses to render its content.

| Location | Copy |
|----------|------|
| `FeedScreen.jsx:93` | `we couldn't load your feed. check your connection and try again.` |
| `ProfileScreen.jsx:97` | `we couldn't load this profile. check your connection and try again.` |
| `ProfileScreen.jsx:233` | `we couldn't load these posts. check your connection and try again.` |
| `PostDetailScreen.jsx:674` | `we couldn't load comments. try again.` |
| `PostDetailScreen.jsx:600` | `post not found` |

All are body 14 in `v.error`, centred, padded 40, except `post not found` which was not measured.

### Inline error strips

The content still renders and a strip explains what failed.

| Location | Copy | Treatment |
|----------|------|-----------|
| `PostCard.jsx:251` | `couldn't block @{handle}. try again.` | `role="alert"`, mono 11, `v.errorText` on `v.errorDim`, padding `8px 14px`, at the top of the card |
| `PostDetailScreen.jsx:772` | `couldn't block this account. try again.` | same pattern |
| `BlockedUsersScreen.jsx:21` | `couldn't unblock. try again.` | mono 10, `v.errorText` |

### Form errors

Held in component state and shown near the submit control.

| Location | Copy |
|----------|------|
| `ComposerScreen.jsx:96` | `we couldn't publish your post. try again.`, or the backend message when there is one |
| `ComposerScreen.jsx:103` | `we couldn't upload your media. try again.`, or `err.uploadMessage` |
| `EditProfileScreen.jsx:57` | `we couldn't save your profile. try again.`, or the backend message |
| `PostDetailScreen.jsx:72` | `that did not work. try again.`, or the backend message |

Each prefers the normalised backend message and falls back to fixed copy, which is the pattern the global rules require.

### Application-level errors

| Location | Purpose |
|----------|---------|
| `components/common/ErrorBoundary.jsx` | React error boundary. Copy is sentence-case and addressed to the user |
| `components/common/RouterErrorPage.jsx` | Router-level failures, with a distinct `Page not found` branch |
| `features/luvax/components/ScreenNotFound.jsx` | An unmatched address inside the authenticated shell, keeping the user in the app |

None of these has a design counterpart because the design has no routing and cannot fail.

## Disabled states

| Location | Control | Treatment |
|----------|---------|-----------|
| `SettingsScreen.jsx:133-159` | Nine privacy and notification toggles | `disabled`, `opacity 0.5`, `cursor not-allowed`. The section header carries a `coming soon` note |
| `primitives.jsx:51-53` | `LxBtn` primary when disabled | `v.surfaceRaised` background, `v.ink3` text, `cursor default`. This one **is** defined by the design and matches |
| `PostCard.jsx:191` | Follow and unfollow menu row while the mutation is in flight | `disabled` on the menu item |
| `ProfileScreen.jsx:158` | Follow button while the mutation is in flight | `disabled` |
| `lx-dropdown-menu.jsx:113` | Any menu item carrying `disabled` | native `disabled` |

The `coming soon` note is the strongest derivation in this list.
It states that a control is not merely broken but not built yet, which is honest and which the design has no way to express.

## The readOnly menu row

`lx-dropdown-menu.jsx:95-103` defines a third row type beyond enabled and disabled.

A `readOnly` row renders as a `div` rather than a `button`, in `v.ink3`, with `cursor: default`.
It is used for the `Reported` row on posts, comments, and profiles.

The reasoning is recorded in the source and is worth preserving: disabling a control implies it will become available later, and a report never reverses, so the row states a fact instead of offering an action that cannot succeed.

This has no design counterpart. The design's `LxMenu` uses a plain `disabled` item with `opacity 0.55` for the same case.

## Relative time

`hooks/useRelativeTime.js`, used by `PostCard`, `NotifRow`, and `RequestRow`.

The design hardcodes time strings in its mock arrays: `14m`, `4h`, `2h`, `6h`.
The frontend derives them from `createdAt`.
The output format matches the design's convention, and the hook takes a `seedKey` so that repeated renders stay stable.

## Optimistic updates with rollback

Not a visual treatment, but a derived behaviour the design has no equivalent for, and one the global rules require.

| Location | Behaviour |
|----------|-----------|
| `PostCard.jsx:44-69` | Like toggles immediately, reconciles to the server's `likeCount` on success, restores both the flag and the count on failure |
| `PostCard.jsx:71-87` | Save toggles immediately, restores on failure |

The design's like has no server and cannot fail, so it simply flips a set in `window.__lxStore`.

## The capitalisation inconsistency

Almost all frontend copy is lowercase, matching the design's voice.

Three strings are not.

| Location | String |
|----------|--------|
| `BlockedUsersScreen.jsx:35` | `No blocked users` |
| `NotificationsScreen.jsx:205` | `No pending requests` |
| `NotificationsScreen.jsx:220` | `No notifications yet` |

Two more are sentence-case with a full stop, which is a third style again.

| Location | String |
|----------|--------|
| `FollowersScreen.jsx:88` | `No followers yet.` |
| `FollowingScreen.jsx:88` | `Not following anyone yet.` |

Every loading and error string in the application is lowercase without a full stop.
So the empty-state family is the only one that is capitalised, and within it the trailing full stop is applied inconsistently.

This is broader than the single blocked-list case carried in from earlier phases.
See `known-divergences.md`.

## What must not be overwritten

Ranked by how much thought is embedded in them.

1. The `readOnly` menu row and its reasoning.
2. The `coming soon` notes and disabled toggles on settings.
3. The `loading replies...` indent that aligns to the reply column.
4. The optimistic like and save rollback paths.
5. The prefer-backend-message-then-fall-back pattern in every form error.
6. The mono-for-machine-states, body-for-human-errors split.

Items 1 through 5 encode decisions that took real thought and that a fresh implementation pass would plausibly get wrong.
