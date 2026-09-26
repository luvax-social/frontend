# Frontend Inventory

> Superseded by the source tree in `.claude/rules/struct.md`. Record of work done on 2026-08-21; not maintained.

Work Item 6, sections 6.1 through 6.4, 6.7, and 6.8.
Mapped from the code on branch `chore/admin/panel-reconnaissance`, cut from `develop`.
Design primitives and tokens are in `design-inventory.md`.

The stale structural documentation this corrects is `frontend/.claude/rules/struct.md` and `frontend/.claude/rules/global_rules.md`.

## 6.1 Structure

Actual `src/` tree, annotated.
Contradictions with the stale `struct.md` are marked STALE-DOC.

```text
src/
  api/
    authApi.js            auth endpoints on publicClient; login sends `identifier`
    axiosClient.js        the two axios instances and all interceptors (see 6.2)
    media.service.js      pre-signed R2 upload flow
  assets/                 hero.png, react.svg, vite.svg, .gitkeep
  components/
    common/
      AuthSessionBootstrap.jsx   boot-time session restore (see 6.2.6)
      ConfirmModal.jsx           destructive-confirm dialog, 500 ms arming (design-inventory 6.5)
      ErrorBoundary.jsx          global React error boundary
      GuestRoute.jsx             redirects authenticated users away from the auth page
      NotFoundPage.jsx           top-level 404
      PageLoader.jsx             full-page spinner
      ProtectedRoute.jsx         auth guard, not role-aware (see 6.3.3)
      RouterErrorPage.jsx        router errorElement
    ui/
      button.jsx           shadcn Button (cva); LEGACY, not used by the luvax screens
      card.jsx, input.jsx, label.jsx   shadcn scaffolds; label.jsx uses @radix-ui/react-label
      lx-avatar.jsx        LxAvatar + AVATAR_COLORS
      lx-dropdown-menu.jsx LxDropdownMenu (positioned menu)
      lx-icon.jsx          LxIcon, the inline-SVG icon set (design-inventory 6.5)
      lx-toggle.jsx        LxToggle switch
  config/
    constants.js          ROUTES, routeTo builders, STALE_TIME, HTTP_STATUS, CHAR_LIMITS
    tokens.js             the `v` CSS-variable shorthand object
  context/                .gitkeep only (empty)
  features/
    auth/
      components/          AuthPage (unified login/register/forgot), AuthField, AuthPage.css
      services/authService.js
      utils/authSchemas.js Zod schemas mirroring backend validation
      index.js
    luvax/
      LuvaxApp.jsx         feature root; renders the shell around the routed screen
      LuvaxTweaksContext.jsx  density/appearance context
      components/          ~27 files: shell.jsx, primitives.jsx (Lx primitives), Toast.jsx,
                           ReportModal.jsx, BlockConfirmDialog.jsx, UserCard.jsx, and one
                           file per screen (Feed, Explore, Profile, Notifications, Settings,
                           Composer, Story, PostDetail, Saved, Followers, Following, ...)
      constants/data.js    residual static mock data
      hooks/               useDrainEmptyPages, usePosts, useNotifications, useSocial, useUsers,
                           useSettings, useLivePostUpdates, usePostLikeState, useMediaUpload, ...
    messages/
      MessagesScreen.jsx   plus components/ and data/
    search/
      components/LxHeaderSearch.jsx
  hooks/                  useCommon, useCountdown, useEscapeKey
  pages/
    auth/                 EmailVerificationPage, OAuthCallbackPage, ResetPasswordPage,
                          VerifyEmailNoticePage
    dashboard/DashboardPage.jsx
    HomePage.jsx  (STALE-DOC: struct.md lists this; it is not imported by the router)
    LuvaxPage.jsx         the /app shell page, reads route handle for chrome
  routes/
    index.jsx             createBrowserRouter, the whole tree (see 6.3)
    appScreens.jsx        APP_SCREENS / APP_OVERLAY_SCREENS row list mapped into routes
  services/               shared API modules: post, user, social, notification, message,
                          report, search, story, axiosInstance (re-exports axiosClient),
                          realtime/stompConnection.js
  store/useAuthStore.js   the single Zustand store (see 6.2.5)
  utils/                  cn.js, helpers.js, validationFields.js
  App.jsx, App.css, index.css, main.jsx
```

Contradictions with the stale `struct.md`, each of which is itself the finding:

- STALE-DOC: struct.md says the UI layer is "shadcn/ui + Radix primitives".
Reality: the luvax screens are built from internal `Lx*` primitives (`primitives.jsx`, `ui/lx-*.jsx`).
`shadcn` scaffolds (`ui/button.jsx`, `card.jsx`, `input.jsx`, `label.jsx`) survive but are not used by the screens; only `label.jsx` still pulls `@radix-ui/react-label`, and `button.jsx` pulls `@radix-ui/react-slot`.
- STALE-DOC: struct.md and prior docs imply `lucide-react` is a dependency.
Reality: `lucide-react` is not in `package.json`; icons come from `ui/lx-icon.jsx`.
- STALE-DOC: struct.md says "the whole authenticated application lives at the single `/app` route ... no authenticated screen can be linked to, bookmarked, or reloaded".
Reality: every screen now has a real nested URL (see 6.3).
- STALE-DOC: global_rules.md section 8 says refresh tokens are kept in memory pending migration to an HttpOnly cookie.
Reality: the refresh token is already an HttpOnly cookie; the store keeps an in-memory copy only as a fallback (see 6.2).
- STALE-DOC: struct.md lists `src/features/luvax/components` as "18 files"; it now holds about 27, plus `Toast.jsx`, `ReportModal.jsx`, and `BlockConfirmDialog.jsx`.
- STALE-DOC: struct.md shows only 4 files under `services/`; there are now 9 plus `realtime/`.
- STALE-DOC: struct.md lists `GuestRoute`, `ProtectedRoute`, etc. but not `ConfirmModal.jsx`, which exists in `components/common/`.

## 6.2 The authentication and transport layer

File: `src/api/axiosClient.js` unless noted.

1. Axios instances.
Two: `publicClient` and `axiosClient`, both `axios.create` with `baseURL` = `/api/v1` in dev (Vite proxy) or `VITE_API_URL` (fallback `http://localhost:8080/api/v1`) in prod, timeout 20000.
`withCredentials` is NOT set on either instance globally.
It is passed explicitly only on the refresh call (`AUTH_WITH_CREDENTIALS = true`).
Verdict: usable for the panel, because admin endpoints do not need the refresh cookie (its path is `/api/v1/auth`).
Gap: because `withCredentials` is not global, a cross-origin production login would not store the refresh cookie; in dev the proxy makes this moot.

2. Request interceptor.
On `axiosClient` only: reads `accessToken` from the store and sets `Authorization: Bearer <token>`.
`publicClient` has no request interceptor.
Verdict: usable unchanged.

3. Response interceptor.
`normalizeAxiosError` rewrites `error.message` (and `error.response.data.message`) to a safe, user-facing string, mapping status codes and redacting backend leakage (SQL, Hibernate, stack traces, raw account-status enums) via `REDACTED_PATTERNS`.
The `ApiResponse` envelope is NOT unwrapped here; feature services unwrap `data` themselves.
Verdict: usable unchanged.
Note: the panel must branch on the backend error `code`, but the interceptor surfaces only `error.message`; the panel will read `error.response.data.code` where it needs to distinguish (for example `REPORT_INVALID_TRANSITION`), which is a read the interceptor does not block.

4. 401 handling.
Single in-flight refresh guarded by an `isRefreshing` flag plus a `refreshQueue`.
On 401 (and not a skippable auth path), it sets `originalRequest._retry`, refreshes once, replays the original request, and flushes the queued requests.
On a second 401 (`_retry` already set) or a failed refresh it calls `clearAuthAndRedirect`, which logs out and does a hard `window.location.assign('/login')`.
The retry is capped at one by `_retry`, so a permanently rejected token cannot loop.
Verdict: usable unchanged; this already implements the pattern the handoff recommends in section 6.7.

5. The auth store.
`src/store/useAuthStore.js`.
Shape: `{ accessToken, refreshToken, user, isAuthenticated, isBootstrapping, hasHydrated }`.
Persisted to `localStorage` under key `luvax-auth-session`, and `partialize` persists only `user` and `isAuthenticated`; both tokens are in-memory only.
There is NO dedicated `role` field.
Role is available only inside `user.role` (the login/refresh user object), which is persisted as part of `user`.
Verdict: needs extension.
The gap: role-based routing needs a reliable role; `user.role` exists but the axiosClient refresh path uses `setTokens`, which does not repopulate `user`, so a boot that restores via the interceptor rather than via `AuthSessionBootstrap` would not refresh `user.role`.

6. The boot sequence.
`src/components/common/AuthSessionBootstrap.jsx`, rendered inside `RootLayout` in `routes/index.jsx`, so it runs on app mount.
It waits for the persist middleware to hydrate (`hasHydrated`), runs once (`didRunRef`), sets `isBootstrapping`, then:
if there is no in-memory access token it calls `authApi.refreshSession(...)` (the HttpOnly cookie authenticates it), stores the returned tokens with `setTokens`, and if the refresh response carried a `user` it calls `setUser` (which does restore `user.role`).
As a fallback, if no user is present it calls `authApi.getCurrentUser()` (`GET /api/v1/users/me`, which has no role).
A refresh call therefore happens before the first protected render decision, and `ProtectedRoute` shows `PageLoader` while `isBootstrapping`.
Verdict: usable, but the role restore depends on the refresh response carrying `user`; the panel must not rely on the `/users/me` fallback for role.

7. What the app does with `GET /api/v1/users/me`.
Only `AuthSessionBootstrap` uses it, as `authApi.getCurrentUser()`, and only as a fallback to populate the profile when the refresh response did not include a user.
It is not used for role and carries none.
Verdict: usable for header display, absent for role.

QueryClient: `src/main.jsx`.
`staleTime` 5 minutes, `retry: 1`, `refetchOnWindowFocus: false`, with a `QueryCache`/`MutationCache` `onError` that suppresses 401 (handled by the interceptor) and logs otherwise.
Note for the panel: the global `retry: 1` will retry once even on 429; the handoff warns against auto-retrying 429, so panel queries against rate-limited endpoints must override `retry` to exclude 429.

## 6.3 Routing

1. Router file: `src/routes/index.jsx`, `createBrowserRouter`.
The tree is a single `RootLayout` (renders `AuthSessionBootstrap`, `ScrollRestoration`, and a `Suspense` boundary) with children: a `GuestRoute` wrapping the auth page at `/`, token-driven public pages (`/verify-email`, `/reset-password`, `/oauth2/callback`, and redirects for `/login`, `/register`, `/forgot-password`), and a `ProtectedRoute` wrapping `/app` and `/dashboard`.
Under `/app` (`LuvaxPage`) the children are generated from `APP_SCREENS` and `APP_OVERLAY_SCREENS` in `src/routes/appScreens.jsx`, each carrying a `handle: { screen, chrome, rightRail }` that the shell reads back to choose its chrome.
Every screen has a real URL.

2. Route path constants: `src/config/constants.js`, `ROUTES`, with `routeTo` builders for parameterised paths.
Screens include `/app` (feed), `/app/explore`, `/app/compose`, `/app/notifications`, `/app/messages`, `/app/settings` and its children (`/profile`, `/password`, `/blocked`, `/saved`), `/app/onboarding`, `/app/stories/new`, `/app/profile`, `/app/u/:userId` (+ `/followers`, `/following`), `/app/p/:postId`, `/app/stories/:storyId`, `/app/search`.
`CHAR_LIMITS.reportDescription` is already 2000, mirroring the backend reason limit.

3. Guards: `ProtectedRoute` (`components/common/ProtectedRoute.jsx`) requires `isAuthenticated` AND a live in-memory `accessToken`, shows `PageLoader` while `isBootstrapping`, and on failure `Navigate`s to `ROUTES.LOGIN` with `state.from.pathname` only.
`GuestRoute` redirects authenticated users away from the auth page.
Neither is role-aware in any way.
On failure, `ProtectedRoute` redirects to login; `GuestRoute` redirects into the app.

4. Unauthenticated entry: `/login` (and `/register`, `/forgot-password`) redirect to `/` (with a `?view=` for register/forgot), which renders `AuthPage` under `GuestRoute`.
An authenticated user lands at `/app` (the feed).

## 6.4 Server and client state

1. QueryClient config: covered in 6.2 (staleTime 5 min, retry 1, refetchOnWindowFocus false, global onError).

2. Cache-lifetime constants: `src/config/constants.js`, `STALE_TIME = { SHORT: 30_000, MEDIUM: 300_000, LONG: 1_800_000 }`.
The QueryClient default staleTime (5 min) is hard-coded in `main.jsx`, not read from `STALE_TIME`.

3. Existing cursor-paginated queries (`useInfiniteQuery`), with termination logic.
All derive the next page param from the backend `pageInfo`, and terminate on `hasNextPage`, via the shared helper `src/features/luvax/hooks/useDrainEmptyPages.js` (which explicitly keys off `pageInfo.hasNextPage`, not page length).

| Hook file | Feeds |
|---|---|
| `src/features/luvax/hooks/usePosts.js` | feed (`getFeed`), explore (`getExplorePosts`) |
| `src/features/luvax/hooks/useNotifications.js` | notifications list |
| `src/features/luvax/hooks/useSocial.js` | followers, following |
| `src/features/luvax/hooks/useUsers.js` | user-facing lists |
| `src/features/luvax/components/PostDetailScreen.jsx` | comments (`hasNextComments`) |
| `src/features/luvax/components/SavedPostsScreen.jsx` | saved posts |
| `src/services/post.service.js` (line ~179 comment) | states the "page until `pageInfo.hasNextPage` is false" rule |

The panel can reuse this exact pattern and the `useDrainEmptyPages` helper.

4. Filter/body spreading (the pattern the handoff warns against).
It exists.
`src/services/post.service.js` defines `getFeed = ({ signal, ...params })`, `getExplorePosts`, `getUserPosts`, `getSavedPosts`, `getLikedPosts` the same way, and the luvax hooks call them with `{ ...params, cursor: pageParam, limit }` spread into the request params.
These hit non-admin endpoints (`/posts/feed` and so on), which do not enforce strict query parameters, so the pattern works today.
It must not be carried into the admin panel services, because `/api/v1/admin/**` rejects undeclared query parameters with 400 (section 5.3.1).
No case was found of form state being spread into a request body; the auth services build bodies explicitly from Zod-validated fields.

5. Client state: `src/store/useAuthStore.js` (auth session) is the only global Zustand store.
UI state such as density and appearance lives in `src/features/luvax/LuvaxTweaksContext.jsx` (React context) and in per-component `useState`.
There is no global store holding filter or panel state.

## 6.7 Copy and interaction conventions

1. Case.
UI action copy is predominantly lowercase.
Example: `ConfirmModal.jsx` renders buttons labelled `cancel` and `confirm` (default), on the destructive-confirm surface.
Title-case and uppercase appear as deliberate accents: the dashboard eyebrow uses `text-transform: uppercase` with letter-spacing in a mono font (`.dashboard-card__eyebrow` in `index.css`).
The convention to carry into the panel: lowercase for controls and inline labels, reserve uppercase for small mono eyebrows.

2. Form validation.
React Hook Form plus Zod (`@hookform/resolvers`).
Schemas live beside the feature, canonically `src/features/auth/utils/authSchemas.js`, mirroring backend `@Size`/format rules; `src/utils/validationFields.js` and `src/config/constants.js` `CHAR_LIMITS` hold shared limits.
Validation is triggered by the resolver on submit and displayed as a field-level error beneath the input (`AuthField.jsx`).

3. The four list states, best existing examples.

| State | Best example |
|---|---|
| populated | `src/features/luvax/components/FeedScreen.jsx` (infinite list with `inView` sentinel) |
| empty | `src/features/luvax/components/SavedPostsScreen.jsx` (empty-state branch) |
| loading | `src/components/common/PageLoader.jsx` and per-screen skeleton branches in `FeedScreen.jsx` |
| failed | `src/features/luvax/components/ExploreScreen.jsx` (isError branch); errors arrive pre-normalized on `error.message` |

## 6.8 Reuse assessment

One line per screen in handoff section 14 (14.1 through 14.15).
Primitives named are the real `Lx*` names; see `design-inventory.md`.

| Screen | Existing primitives that cover part of it | What is missing |
|---|---|---|
| 14.1 Login | `AuthPage`, `AuthField`, Zod schemas | only a role-based post-login redirect |
| 14.2 Report queue | `LxTag` (status), infinite-list pattern, `useDrainEmptyPages`, `LxAvatar` | record-table layout, filter bar over fixed enums, id-to-username resolution per row |
| 14.3 Escalated queue | same as report queue (it is `?status=escalated`) | administrator-only route guard; escalated-count poll |
| 14.4 Report detail | `LxModal` or a routed panel, `LxTag`, `LxAvatar` | detail layout binding report + target (`/reports/{id}/target`) |
| 14.5 Post moderation | `LxBtn`, `ConfirmModal`, `LxTag`, `PostMedia`/`MediaThumb` | reason textarea in confirm; `droppedHashtags` surfacing on restore |
| 14.6 Comment moderation | `LxBtn`, `ConfirmModal`, `LxTag` | reason textarea in confirm; comment record row |
| 14.7 Warning issuance | `LxModal`, reason select from `moderationActions`/`reportReasons`, `LxBtn` | reason-key select bound to vocabulary; strike-outcome surfacing from response |
| 14.8 Violations history | infinite-list pattern, `LxTag`, `LxDivider` | role-scoped query key (warnings vs warnings+strikes); discriminated-union row |
| 14.9 My action log (mod) | infinite-list pattern, `LxTag` | audit-row table; per-row detail fetch for `metadata` |
| 14.10 Full action log (admin) | same as 14.9 | administrator-only guard; actor filter |
| 14.11 User list and search (admin) | infinite-list pattern, `LxAvatar`, `LxTag`, `LxHeaderSearch` as a debounce reference | administrator-only guard; status/role filter bar; debounced search at 60/min |
| 14.12 User detail (admin) | `LxAvatar`, `LxTag`, `LxToggle`, `LxBtn`, `ConfirmModal` | capabilities-driven control rendering; sessions/reports panels; reason confirms |
| 14.13 Hashtag registry (admin) | `LxTag` (status), `LxBtn`, `ConfirmModal`, `LxModal` | status filter; create/edit form using `targetEntityId`; immutable-name field |
| 14.14 Statistics (admin) | `LxTag`, cards | chart rendering, date-range control clamped to 30 days, `computedAt` staleness banner, empty-state |
| 14.15 User activity log (admin) | infinite-list pattern | mandatory 30-day date-range control; event-type filter |
