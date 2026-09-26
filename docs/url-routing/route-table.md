# Route Table

> Superseded by `src/config/constants.js` (the `ROUTES` object) and the route table in `.claude/rules/struct.md`. Record of work done on 2026-08-10; not maintained.

## How the screens were enumerated

Derived from `LuvaxApp.jsx` as it stood before this phase, not from any prior list.

Eleven screens came from the `screens` map: `feed`, `explore`, `compose`, `profile`, `notifications`, `settings`, `edit-profile`, `change-password`, `blocked`, `followers`, `following`.

Five more were handled outside that map by their own branches: `onboarding` rendered with no shell, `messages` rendered in a bespoke fixed pane, and `post`, `story-view`, and `story-compose` rendered as overlays on top of a base screen chosen from an in-memory history stack.

Sixteen screens in total.
`onboarding` was reachable only through a stale `sessionStorage` value, since nothing navigated to it; it still gets an address, because losing reachability is not allowed.

## Public routes

Unchanged by this phase except where noted.

| Path | Guard | Component | Notes |
|------|-------|-----------|-------|
| `/` | guest | `AuthPage` | Login, register, and forgot password by `?view=` |
| `/login` | none | redirect | Redirects to `/` preserving the query string |
| `/register` | none | redirect | Redirects to `/?view=register` |
| `/forgot-password` | none | redirect | Redirects to `/?view=forgot` |
| `/verify-email` | none | `EmailVerificationPage` | Token driven |
| `/verify-email-notice` | none | `VerifyEmailNoticePage` | |
| `/reset-password` | none | `ResetPasswordPage` | Token driven |
| `/oauth2/callback` | none | `OAuthCallbackPage` | |
| `/dashboard` | protected | `DashboardPage` | Pre-existing stub, left alone |
| `*` | none | `NotFoundPage` | Outside the shell, for addresses that are not part of the application |

`/oauth/callback` was removed.
`OAuth2AuthenticationSuccessHandler` on the backend redirects to `{frontendBaseUrl}/oauth2/callback?code=...` and nothing else produces the shorter form; `VITE_GOOGLE_REDIRECT_PATH` is also `/oauth2/callback`.
The alias had no producer, so it was an unused second address for one page.
The permissive pattern in `authApi.isGoogleCallbackPath`, which still matches both spellings, is a guard against a misconfigured auth URL rather than a consumer, and was left as is.

## Authenticated routes

All of these sit under one layout route at `/app`, behind a single `ProtectedRoute`.
The guard is applied once at the layout rather than repeated per child, and the shell, sidebar, right rail, and bottom navigation render once for all of them.

| Path | Parameters | Component | Renders when the parameter is missing or invalid |
|------|-----------|-----------|--------------------------------------------------|
| `/app` | none | `FeedScreen` | n/a |
| `/app/explore` | `?q`, `?focusSearch` | `ExploreScreen` | No query means the default explore grid, which is the unsearched state |
| `/app/compose` | none | `ComposerScreen` | n/a |
| `/app/notifications` | none | `NotificationsScreen` | n/a |
| `/app/messages` | none | `MessagesScreen` | n/a |
| `/app/settings` | none | `SettingsScreen` | n/a |
| `/app/settings/profile` | none | `EditProfileScreen` | n/a |
| `/app/settings/password` | none | `ChangePasswordScreen` | n/a |
| `/app/settings/blocked` | none | `BlockedUsersScreen` | n/a |
| `/app/profile` | none | `ProfileScreen` | Always the viewer's own profile |
| `/app/u/:userId` | `userId` | `ProfileScreen` | A malformed id gets `400` and a well-formed unknown id gets `404`; both render "we couldn't load this profile", inside the shell |
| `/app/u/:userId/followers` | `userId` | `FollowersScreen` | A private account answers `403` and renders the existing "Private Account" panel; other failures render the empty list |
| `/app/u/:userId/following` | `userId` | `FollowingScreen` | Same as followers |
| `/app/p/:postId` | `postId` | `PostDetailScreen` | Renders "post not found", which is the screen's existing error branch |
| `/app/stories/new` | none | `StoryComposerScreen` | n/a |
| `/app/stories/:storyId` | `storyId` | `StoryViewScreen` | An unknown id falls back to the placeholder story the screen already used |
| `/app/onboarding` | none | `OnboardingScreen` | Renders with no shell, as before |
| `/app/*` | none | `ScreenNotFound` | Anything unmatched inside the application |

Every path is declared in `src/config/constants.js` under `ROUTES`.
Parameterised paths are built with the `routeTo` helpers in the same file, so no navigation site assembles a path string by hand.

The route table itself lives in `src/routes/appScreens.jsx` and is turned into router children by `src/routes/index.jsx`.
Both the router and the layout read that one list, so the address that renders a screen and the screen rendered behind an overlay can never disagree.

## Decisions

### Profile addressing: id, not username

`GET /users/by-username/{username}` was checked before deciding, and it works:

```
GET /api/v1/users/by-username/luvax_ben     -> 200, full profile
GET /api/v1/users/by-username/does_not_exist -> 404
```

The route still uses the id, for three reasons.

The id is what the data already carries.
`ProfileScreen` fetched with `useUserProfile(params.user?.id)` and every navigation site already passed an id.
A username is not carried everywhere; notification actors, for one, are not guaranteed to include it.
Routing by username would mean inventing an identifier at sites that do not have one, which the brief forbids.

The id is stable.
The application has an edit-profile screen that can change a username.
A username URL breaks for every link already shared the moment someone renames themselves, and it breaks silently, resolving to `404` or, worse, to whoever took the handle next.

Routing by username would also mean a new service call, a new hook, and a change to the profile fetch key, which is new API surface in a phase whose brief says it builds no new features.

**Handling of the option not chosen.**
A readable `/app/u/@username` alias is still available later and does not require revisiting this table.
It would resolve the handle to an id and render the same screen, so the canonical address stays what it is now.
`GET /users/by-username/{username}` is verified working and waiting for it.
This is recorded in `deferred-findings.md`.

The cost accepted in the meantime is that a shared profile link is a UUID and tells a human nothing about whose profile it is.

### Own profile: a distinct path, and the id path also works

`/app/profile` is the canonical address for the viewer's own profile, and `/app/u/<their own id>` renders exactly the same screen.

A distinct path is necessary rather than merely tidy.
The header avatar and the bottom-nav "you" tab link to the viewer's own profile, and they render while the user object may still be null during session restoration.
`/app/u/:userId` cannot be constructed without an id, so those controls would have nothing to point at.
`/app/profile` needs no id and is always constructible.

The screen already branched on self versus other, and still does: with no `userId` in the address it treats the viewer as the subject, which is the same condition it used before.

This also reconciles `ROUTES.PROFILE`, which was declared as `/profile` with no route registered anywhere.
It is now `/app/profile` and is actually routed.

### Post detail: a full route, rendered as an overlay

The address is `/app/p/:postId`, a real route, not a query parameter on whatever screen the reader happened to be on.
That matters because the link is meant to be shareable: `buildPostLink` in `utils/helpers.js` was returning `${origin}${pathname}#post-${id}`, a placeholder hash that resolved to nothing, precisely because no real post address existed.

Whether it draws as an overlay or as a full page is decided in one place, `LuvaxApp`, by the `chrome: 'overlay'` flag on the route.
Nothing about the address depends on that choice, so the design conformance phase can turn it into a full page, or hand it to `window.LX.openComments`, by changing that flag and the layout branch.
The route table does not move either way.
That is how the shape avoids foreclosing the outcome.

For now it stays an overlay, because that is what it is today and this phase changes no visuals.

### Backdrop behind an overlay

An overlay draws over an 18 percent scrim, so the screen behind it is visible and part of the design.

Navigating to an overlay records the address it was opened from in history state, and the layout renders that screen behind it.
History state is per entry, so back, forward, and reload all reproduce the same backdrop.
Opening an overlay address cold has no such state and falls back to the feed, which is exactly what the previous implementation did whenever its history stack was empty, as it always was after a reload.

**One visible difference, recorded as required.**
Opening a post from another person's profile previously showed that person's profile behind the scrim.
It now shows the viewer's own profile, because the backdrop is rendered from the address alone and the address of an overlay carries no profile id.
Propagating the backdrop's parameters would mean a screen reading parameters from somewhere other than its own URL, which section 6 of the brief explicitly forbids, so the difference is accepted rather than fixed.
It is transient, behind a scrim, and the correct profile returns as soon as the overlay closes.

### Search: reserved, not built

`ROUTES.SEARCH` is declared as `/app/search`.
No route is registered against it and no screen exists, so the address currently renders the in-shell not-found.

Building the screen is a single row in `APP_SCREENS`.
The constant exists so the phase that builds it does not have to redesign addresses first.

Search today is still explore with a query, at `/app/explore?q=...`, which now survives a reload and can be shared.

### Unknown paths inside the application

`/app/*` renders `ScreenNotFound` inside the shell.

Falling through to the global `NotFoundPage` would drop a signed-in user onto a bare page with no navigation, which is a poor answer to a mistyped or stale link.
Keeping it inside the shell leaves the header and tabs in place, and the panel offers a way back to the feed.

A bad identifier is a different case and is handled by the screen that owns it, since only that screen knows what a failed lookup means.
Those responses are in the parameters column above.
None of them is a crash or a blank region.

## Scroll behaviour

`<ScrollRestoration />` is mounted at the root.
Navigating to a new address starts at the top of the page, and going back restores the previous offset.
This replaces the manual `window.scrollTo(0, 0)` the old navigate function performed.

It restores the document scroller.
The feed, explore, and profile lists are paginated with `useInView` and remount on a route change, so their position is restored only to the extent the document scroller carries it, and refetching more pages is driven by the sentinel coming back into view.
Restoring an infinite list to an exact item across a remount needs the list virtualised and its state lifted out of the component, which is a change to how those lists are built rather than to routing.
It is not attempted here rather than half-implemented, and is recorded in `deferred-findings.md`.

`ScrollRestoration` keeps its offsets in `sessionStorage` under `react-router-scroll-positions`.
That is scroll offsets only; it holds no navigation state and no credentials.
