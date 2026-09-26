# Changes Applied

> Record of work done on 2026-08-10. Not maintained; it is correct as of that date and is not updated as the code moves.

One entry per change.

## Session restoration

### 1. The bootstrap gave up instead of trying the cookie

**What was wrong.**
`AuthSessionBootstrap` threw when it held neither an access token nor a refresh token, and the catch logged the user out.
After any reload that is always the case, because both tokens are memory-only.

**Evidence.**
The previous phase measured a reload as issuing zero API requests and landing on the sign-in page.
That was correct behaviour against a backend with no cookie, and is no longer, since `POST /auth/refresh` now falls back to the `HttpOnly` cookie.

**What changed.**
The no-token branch now calls `POST /auth/refresh` with credentials instead of throwing.
A success rehydrates the session with the returned access token, held in memory.
Guest paths still short-circuit, because those pages never need a session.

**File.** `src/components/common/AuthSessionBootstrap.jsx`

### 2. Every bootstrap failure was treated as an ended session

**What was wrong.**
The catch was `catch { logout(); }`.
With the bootstrap now making a network call on every cold load, a dropped connection or a `502` would have discarded a valid thirty-day session.

**Evidence.**
Reading the control flow: nothing distinguished a `401` from a transport failure, and both reached the same `logout()`.

**What changed.**
`401` logs out, exactly as before.
Anything else leaves the persisted session marker alone and logs to the console in development only.
Nothing is treated as signed in during that window, because `ProtectedRoute` gates on a live in-memory access token that this path does not set.

**File.** `src/components/common/AuthSessionBootstrap.jsx`

### 3. Logout was sent unauthenticated, so it never revoked anything

**What was wrong.**
`authApi.logout` posted on `publicClient`, which never attaches the bearer token.
The backend requires one.

**Evidence.**
`SecurityConfig` lists `/auth/logout` in `AUTHENTICATED_POST_AUTH_PATHS`, not in the public set.
Observed directly:

```
POST /auth/logout  (no bearer)   -> 401, no Set-Cookie, refresh token still usable
POST /auth/logout  (with bearer) -> 204, Set-Cookie clears it, refresh token now 401
```

**Why it mattered now.**
Harmless while no cookie existed, since the tokens died with the tab.
With the cookie live, a user who signed out would have been restored on the next reload.

**What changed.**
Logout goes out on `axiosClient`.
The refresh-and-replay interceptor is deliberately left enabled on it, so signing out after the access token has expired still revokes the session rather than failing silently.

**File.** `src/api/authApi.js`

### 4. Credentials were behind an environment flag that was never set

**What was wrong.**
`AUTH_WITH_CREDENTIALS` read `VITE_AUTH_WITH_CREDENTIALS === 'true'`.
That variable is absent from `.env` and `.env.example`, so it was always `false`.

**Evidence.**
Neither env file declares it.
In development the browser talks to the Vite proxy, so the auth calls are same-origin and carry the cookie regardless, which is exactly why the gap would not have shown up locally: it would have appeared only in a cross-origin production deployment, as every reload signing the user out.

**What changed.**
The constant is now unconditionally `true`, with a comment explaining that a cookie-borne credential leaves no room for the call to be optional.

**File.** `src/api/axiosClient.js`

### 5. The refresh interceptor refused to try without an in-memory token

**What was wrong.**
`refreshAccessToken` threw "Your session has expired" whenever the store held no refresh token, without asking the server.

**Evidence.**
An explicit `if (!refreshToken) throw` before the request.
The cookie makes that guard wrong: the server can resolve the token the client no longer has.

**What changed.**
It sends the token when it has one and an empty body when it does not, letting the cookie supply it.
Verified against the running server that both `{}` and a wholly absent body are accepted, because `RefreshRequest.refreshToken` is declared not required.

**File.** `src/api/axiosClient.js`

### 6. The post-expiry redirect fired on the page it was redirecting to

**What was wrong.**
`clearAuthAndRedirect` skipped its hard navigation only when the path was already `/login`.
But `/login` immediately redirects to `/`, which is where the sign-in form actually renders, so on `/` the guard did not match and a full page reload was triggered to reach a screen already on display.

**Evidence.**
The router maps `/login` to a redirect to `/`, and `/` renders `AuthPage` under `GuestRoute`.

**Why it was fixed here.**
Change 3 routes logout through the interceptor, which can reach this function.
`AuthPage` clears any existing session on mount when handling a re-authentication, so without this fix that path could reload the sign-in page underneath the user.

**What changed.**
The guard now covers both `/` and `/login`.

**File.** `src/api/axiosClient.js`

## Routing

### 7. The whole authenticated application lived at one address

**What was wrong.**
`LuvaxApp` held the visible screen in `useState`, kept a private history array, and mirrored both the screen and its parameters into `sessionStorage` under `lx_screen` and `lx_params`.
Nothing was linkable, the back button left the application, and a reload depended on the mirror.

**Evidence.**
The screen switch in `LuvaxApp.jsx`, and `sessionStorage` observed holding `lx_screen: "notifications"` while the address bar read `/app`.

**What changed.**
`/app` became a layout route with one child route per screen, twenty-two in all.
`LuvaxApp` no longer decides which screen is visible; it renders the shell around an `Outlet` and reads the current screen's identity from the route's `handle` through `useMatches`, which is what keeps the chrome, the active tab, and the tablet pane widths exactly as they were.
The screen state, the history array, the manual `window.scrollTo`, and the `sessionStorage` mirror are gone.

**Files.** `src/features/luvax/LuvaxApp.jsx`, `src/routes/index.jsx`, `src/routes/appScreens.jsx`

### 8. Screens were handed their parameters by their parent

**What was wrong.**
Every screen received a `params` object built by `LuvaxApp`, and navigation passed whole entities through it, for instance `navigate('profile', { user })` and `navigate('post', { post: p })`.
A screen could not render from its address alone.

**Evidence.**
`ProfileScreen` read `params.user?.id`, `PostDetailScreen` read `params.postId || params.post?.id`, the follower screens read `params.userId` and `params.username`, and `ExploreScreen` read `params.q`.

**What changed.**
Each screen reads its own parameters: `useParams` for path segments, `useSearchParams` for the explore query.
Navigation sites pass an identifier in the address instead of an object, built through the `routeTo` helpers.

**Files.** `ProfileScreen.jsx`, `PostDetailScreen.jsx`, `FollowersScreen.jsx`, `FollowingScreen.jsx`, `ExploreScreen.jsx`, `LxHeaderSearch.jsx`, `PostCard.jsx`, `NotificationsScreen.jsx`, `FeedScreen.jsx`, `StoryScreens.jsx`, `ConversationInfoPanel.jsx`

### 9. The follower screens needed a username the address does not carry

**What was wrong.**
Their heading reads "`{username}`'s Followers", and the username arrived in the passed parameters.
An address carrying only an id has no username in it.

**Evidence.**
`const username = params.username || currentUser?.username || 'user'`, which on a cold load would have degraded to the literal "user".

**What changed.**
They read the owner's profile with `useUserProfile(userId)` and take the username from it.
It is normally already in the TanStack Query cache from the profile screen the user came from, so this is usually not an extra request.
Verified: `/app/u/<dan>/followers` opened cold renders "luvax_dan's Followers".

**Files.** `src/features/luvax/components/FollowersScreen.jsx`, `FollowingScreen.jsx`

### 10. The profile screen would have flashed a placeholder name

**What was wrong.**
`user` fell back to the passed object, so the name appeared instantly.
With only an id in the address there is nothing to fall back to, and the existing `|| 'Unknown'` defaults would have rendered "Unknown" and "@unknown" until the fetch returned.

**Evidence.**
`const title = user?.displayName || user?.firstName || user?.username || 'Unknown'`, reached while the query is still in flight.

**What changed.**
A loading state is rendered while the profile is loading and nothing identifiable is known yet, worded to match the equivalent state in `PostDetailScreen`.
This is an addition rather than a change to any existing rendered state, and it replaces a flash of wrong data.

**File.** `src/features/luvax/components/ProfileScreen.jsx`

### 11. Appearance settings had no way to reach the screens

**What was wrong.**
`tweaks` and `setTweak` were props threaded from `LuvaxApp` into every screen.
Route elements are not rendered by a parent that can pass props.

**Evidence.**
`FeedScreen` uses `tweaks.density` and `tweaks.showTags`; `SettingsScreen` reads `tweaks.dark` and calls `setTweak`.

**What changed.**
A small context provides the appearance settings and the viewport to the screens under the layout.
It carries appearance only; navigation state stays in the URL.

**Files.** `src/features/luvax/LuvaxTweaksContext.jsx`, and the screens that read it

### 12. Nav targets and path strings were screen ids

**What was wrong.**
The shell navigated with `navigate('feed')`, `navigate('profile')` and so on, and `ROUTES` did not contain any authenticated screen path.
`ROUTES.PROFILE` was declared as `/profile` with no route registered anywhere.

**Evidence.**
`ROUTES` held ten public paths and the unrouted `/profile`.
Every tab in `LxTopTabs` and `LxBottomNav` navigated by screen id.

**What changed.**
Every path is declared in `ROUTES`; parameterised ones are built with `routeTo`.
The tab tables keep their `id` for deciding which tab looks active and gain a `path` for where the tab goes.
`ROUTES.PROFILE` is now `/app/profile` and is routed.

**Files.** `src/config/constants.js`, `src/features/luvax/components/shell.jsx`

### 13. `/oauth/callback` was a second address for one page

**What was wrong.**
Both `/oauth2/callback` and `/oauth/callback` rendered `OAuthCallbackPage`.

**Evidence.**
`OAuth2AuthenticationSuccessHandler` redirects to `{frontendBaseUrl}/oauth2/callback?code=...` and nothing produces the shorter form.
`VITE_GOOGLE_REDIRECT_PATH` is `/oauth2/callback`.
Nothing in the frontend referenced `ROUTES.OAUTH_CALLBACK_ALT`.

**What changed.**
The alias route, its constant, and its entry in the bootstrap's guest-path set were removed.
The permissive pattern in `authApi.isGoogleCallbackPath` was left alone; it guards against a misconfigured auth URL rather than consuming the alias.

**Files.** `src/routes/index.jsx`, `src/config/constants.js`, `src/components/common/AuthSessionBootstrap.jsx`

### 14. A bad address inside the application dropped the user out of it

**What was wrong.**
`/app` matched exactly one route, so anything below it fell through to the global `NotFoundPage`, outside the shell, with no navigation.

**Evidence.**
The router had a single `/app` entry and a top-level `*`.

**What changed.**
`/app/*` renders a not-found panel inside the shell, with a way back to the feed.
Bad identifiers are handled by the screen that owns them, since only that screen knows what a failed lookup means; those states are listed in `route-table.md`.

**File.** `src/features/luvax/components/ScreenNotFound.jsx`

### 15. Scroll position was reset by hand

**What was wrong.**
The old navigate function called `window.scrollTo(0, 0)` on every screen change, and going back could not restore anything.

**What changed.**
`<ScrollRestoration />` at the router root.
New addresses start at the top and going back restores the previous offset.
Its limits for paginated lists are set out in `route-table.md` and `deferred-findings.md`.

**File.** `src/routes/index.jsx`

### 16. The old screen mirror would have lingered in existing browsers

**What was wrong.**
No code writes `lx_screen` or `lx_params` any more, but a browser that had run the previous build still held them, leaving a stale second copy of navigation state.

**Evidence.**
Both keys were present in `sessionStorage` in the test browser after the change.

**What changed.**
The layout removes both keys once on mount.

**File.** `src/features/luvax/LuvaxApp.jsx`
