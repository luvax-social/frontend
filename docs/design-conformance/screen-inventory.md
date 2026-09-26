# Screen Inventory

> Superseded by `src/routes/appScreens.jsx`, which the router and the shell both read. Record of work done on 2026-08-13; not maintained.

Every screen on both sides, and the correspondence between them.

All findings in this file are **[source]** unless marked otherwise.

## Screens in the design export

The design routes screens from a single `App` component holding a `screen` string in state.
Eleven identifiers reach a screen component.

| Design screen id | Component | Chrome |
|------------------|-----------|--------|
| `feed` | `FeedScreen` | `LxShell`, right rail on desktop |
| `explore` | `ExploreScreen` | `LxShell`, right rail on desktop |
| `compose` | `ComposerScreen` | `LxShell`, no rail |
| `post` | `PostDetailScreen` | `LxShell`, no rail |
| `profile` | `ProfileScreen` | `LxShell`, no rail |
| `notifications` | `NotificationsScreen` | `LxShell`, no rail |
| `settings` | `SettingsScreen` | `LxShell`, no rail |
| `onboarding` | `OnboardingScreen` | Bare, no shell |
| `messages` | `MessagesScreen` | Fixed full-height pane, own branch in `App` |
| `story-view` | `StoryViewScreen` | Overlay over the last non-story screen |
| `story-compose` | `StoryComposerScreen` | Overlay over the last non-story screen |

Three further surfaces are overlays rather than routed screens.

| Design overlay | Opened by |
|----------------|-----------|
| `ReportModal` | `window.LX.openReport` from `LxMenu` |
| `CommentModal` | `window.LX.openComments` from `PostCard` and `NotifRow` |
| `ConfirmModal` | `LxMenu` destructive actions |

The design has no not-found screen, no followers list, no following list, no blocked list, no edit profile screen, and no change password screen.
`SettingsScreen` reaches `edit profile` and `change password` as rows that do not navigate anywhere.

## Screens in the frontend

The frontend routes screens from `src/routes/appScreens.jsx`.
Fourteen entries in `APP_SCREENS`, three in `APP_OVERLAY_SCREENS`, and one fallback.

| Frontend screen id | Component | Chrome |
|--------------------|-----------|--------|
| `feed` | `FeedScreen` | `shell`, right rail |
| `explore` | `ExploreScreen` | `shell`, right rail |
| `compose` | `ComposerScreen` | `shell` |
| `notifications` | `NotificationsScreen` | `shell` |
| `messages` | `MessagesScreen` | `messages` |
| `settings` | `SettingsScreen` | `shell` |
| `edit-profile` | `EditProfileScreen` | `shell` |
| `change-password` | `ChangePasswordScreen` | `shell` |
| `blocked` | `BlockedUsersScreen` | `shell` |
| `profile` | `ProfileScreen` | `shell` |
| `profile` (other user) | `ProfileScreen` | `shell` |
| `followers` | `FollowersScreen` | `shell` |
| `following` | `FollowingScreen` | `shell` |
| `onboarding` | `OnboardingScreen` | `bare` |
| `post` | `PostDetailScreen` | overlay |
| `story-compose` | `StoryComposerScreen` | overlay |
| `story-view` | `StoryViewScreen` | overlay |
| `not-found` | `ScreenNotFound` | `shell` |

Overlays on the frontend are real addresses that render over whichever screen they were opened from, rather than transient component state.

Frontend surfaces that are modals rather than screens: `ReportModal`, `LxModal`, `LxBottomSheet`, `LxDropdownMenu`.
There is no `ConfirmModal`; its role is filled by `LxModal` used ad hoc per call site.

Outside the authenticated shell the frontend also has `AuthPage` (login, register, forgot password), `EmailVerificationPage`, `VerifyEmailNoticePage`, `ResetPasswordPage`, `OAuthCallbackPage`, `DashboardPage`, `HomePage`, and `NotFoundPage`.
The design defines none of these.

## Correspondence

### Present on both sides

| Screen | Design | Frontend | Notes |
|--------|--------|----------|-------|
| Feed | yes | yes | Differences in `screen-differences.md` |
| Explore | yes | yes | |
| Composer | yes | yes | |
| Post detail | yes | yes | Design opens it as a modal over the feed, frontend as an overlay route |
| Profile | yes | yes | |
| Notifications | yes | yes | |
| Settings | yes | yes | Closest match of any screen |
| Onboarding | yes | yes | Out of scope as a feature |
| Messages | yes | yes | Out of scope as a feature |
| Story viewer | yes | yes | Out of scope as a feature |
| Story composer | yes | yes | Out of scope as a feature |
| Report modal | yes | yes | |
| Comment surface | modal | overlay screen | Composition differs by design decision |

### Design only

| Screen or surface | Verdict |
|-------------------|---------|
| `ConfirmModal` | **Build it.** This is not a screen but it is a defined primitive with specific behaviour, including a 500 ms delay before the destructive button becomes usable. The frontend replaces it with `LxModal` configured differently at each call site, so destructive confirmations are inconsistent and none of them carry the delay. Recorded in `primitive-audit.md`. |
| `LxSidebar` | **Do not build.** The design defines a 220px desktop sidebar with five tabs, but `LxShell` never renders it at any viewport. It is exported on `window` and unused. It is dead code in the reference, not a missing screen. |
| `LxTopBar` | **Do not build.** Defined as a generic sticky bar with left, centre, and right slots, exported, and never rendered by any screen. Superseded by `LxAppBar`. |
| `LxBottomSheet` (design usage) | **Already present.** The frontend has it and uses it for post editing. The design defines it but no design screen renders it. |

### Frontend only

| Screen | Why it exists | Verdict |
|--------|---------------|---------|
| `EditProfileScreen` | The design's settings row for `edit profile` navigates nowhere. A real product needs the destination. | Correct, not divergent. Derived deliberately. |
| `ChangePasswordScreen` | Same. The design's row is inert. | Correct, not divergent. |
| `BlockedUsersScreen` | The design's `blocked users` row is inert, and the backend exposes a block list. | Correct, not divergent. |
| `FollowersScreen` | The design's follower stat is not clickable. The backend exposes the list. | Correct, not divergent. |
| `FollowingScreen` | Same. | Correct, not divergent. |
| `ScreenNotFound` | The design cannot produce an unmatched address because it has no addresses. Once screens have URLs, a mistyped one must land somewhere inside the shell. | Correct, not divergent. Required by the routing decision recorded in `docs/url-routing/`. |
| `AuthPage` and the auth pages | The design starts at the authenticated feed and defines no sign-in. | Correct, not divergent. Frozen; see the settled positions in the audit brief. |
| `DashboardPage`, `HomePage`, `NotFoundPage` | Scaffolding predating the design export. | Not divergent, but they are outside the design's scope entirely and should not be styled against it. |

## Consequences for planning

No screen the product needs is missing from the frontend.
The gap is not screen coverage, it is per-screen fidelity plus one missing primitive.

The three screens the design defines and the product does not need are messages, stories, and onboarding, all of which the frontend already has in some form and all of which are out of scope as features.
Their navigation entries are expected to render disabled, which is a separate piece of work from conformance and is not sized in `implementation-plan.md` as a design task.
