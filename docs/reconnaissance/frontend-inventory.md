# Frontend Inventory

> Superseded by the source tree in `.claude/rules/struct.md`. Record of work done on 2026-08-01; not maintained.

The frontend as it actually is at commit `102923c2194b37b6033b033c53000ab4e5da9de2`.

80 JavaScript and JSX files under `src/`.
`npm run lint` passes with zero errors and zero warnings.

Note that `.claude/rules/struct.md` in this repository describes a much smaller tree: it lists
`features/auth`, `features/dashboard`, and `features/luvax` only, and names files such as
`LoginPage.jsx`, `useAuth.js`, and `hero.png` that no longer exist.
Treat it as stale.

## Routes

Routing is config-based in `src/routes/index.jsx` with `createBrowserRouter`.

| Path | Guard | Component | Note |
|------|-------|-----------|------|
| `/` | `GuestRoute` | `AuthPage` | The unified auth screen. Frozen |
| `/verify-email` | none | `EmailVerificationPage` | Frozen |
| `/verify-email-notice` | none | `VerifyEmailNoticePage` | Frozen |
| `/login` | none | `LoginRedirect` | Redirects to `/` preserving query and state |
| `/register` | none | `Navigate` | Redirects to `/?view=register` |
| `/forgot-password` | none | `Navigate` | Redirects to `/?view=forgot` |
| `/reset-password` | none | `ResetPasswordPage` | Frozen |
| `/oauth2/callback` | none | `OAuthCallbackPage` | Frozen |
| `/oauth/callback` | none | `OAuthCallbackPage` | Duplicate alias of the above |
| `/app` | `ProtectedRoute` | `LuvaxPage` | **The entire authenticated application** |
| `/dashboard` | `ProtectedRoute` | `DashboardPage` | Reachable only by typing the URL |
| `*` | none | `NotFoundPage` | Outside `RootLayout`, so no `AuthSessionBootstrap` |

`RootLayout` renders `AuthSessionBootstrap` and an `Outlet`, with `RouterErrorPage` as the router
error element.

### The single-route problem

Everything a demo would show lives at `/app`.
`LuvaxApp.jsx` holds `screen` in `useState` and switches on it: `feed`, `explore`, `post`,
`profile`, `compose`, `notifications`, `settings`, `messages`, `onboarding`, `story-view`,
`story-compose`, plus the followers, following, blocked, edit-profile, and change-password screens.

Consequences, all of which bear on the demo:

- No deep link to a post, a profile, or a search result.
- The browser back button leaves the application entirely rather than going back one screen.
- A page refresh always returns to the feed, losing the current screen and its parameters.
- `ROUTES.PROFILE` is declared in `src/config/constants.js:22` as `/profile` but no such route
  exists in the router.

## Screens: live data or mock

| Screen | File | Data source |
|--------|------|-------------|
| Feed | `features/luvax/components/FeedScreen.jsx` | Live, `useFeed` infinite query |
| Stories carousel inside Feed | same | **Mock**, `STORIES` from `features/luvax/constants/data.js` |
| Explore | `features/luvax/components/ExploreScreen.jsx` | Live posts via `useExplore`; topic chips are **mock** `TOPICS` |
| Post detail | `features/luvax/components/PostDetailScreen.jsx` | Live, `usePostDetail`, `useTopLevelComments`, `useCommentReplies` |
| Profile | `features/luvax/components/ProfileScreen.jsx` | Live, `useUserProfile`, `useUserPosts` |
| Composer | `features/luvax/components/ComposerScreen.jsx` | Live create; suggested tags are **mock** `SUGGESTED_TAGS` |
| Notifications | `features/luvax/components/NotificationsScreen.jsx` | Live, `useNotifications`, `usePendingFollowRequests` |
| Followers | `features/luvax/components/FollowersScreen.jsx` | Live, `useFollowers` |
| Following | `features/luvax/components/FollowingScreen.jsx` | Live, `useFollowing` |
| Blocked users | `features/luvax/components/BlockedUsersScreen.jsx` | **localStorage**, not the backend. See below |
| Settings | `features/luvax/components/SettingsScreen.jsx` | Mixed; reads auth store and localStorage |
| Edit profile | `features/luvax/components/EditProfileScreen.jsx` | Live, `useUpdateMyProfile` |
| Change password | `features/luvax/components/ChangePasswordScreen.jsx` | No hooks at all; inert |
| Onboarding | `features/luvax/components/OnboardingScreen.jsx` | **Mock**, `INTEREST_CATEGORIES` |
| Story view and compose | `features/luvax/components/StoryScreens.jsx` | **Mock**, local state only |
| Messages | `features/messages/MessagesScreen.jsx` | **Mock**, `THREADS` from `features/messages/data/mockThreads.js` |

### Mock data locations

| File | Exports | Consumed by |
|------|---------|-------------|
| `src/features/luvax/constants/data.js` | `STORIES`, `TOPICS`, `SUGGESTED_TAGS`, `INTEREST_CATEGORIES`, `TWEAK_DEFAULTS`, `ACCENT_PALETTES`, `FONT_MAP` | Feed, Explore, Composer, Onboarding, LuvaxApp |
| `src/features/luvax/constants/data.js` | `FEED_POSTS`, `REPLIES` | **Nobody. Dead exports** |
| `src/features/messages/data/mockThreads.js` | `THREADS` | `MessagesScreen` |

## Data layer

### Clients

`src/api/axiosClient.js` exports `axiosClient` (authenticated) and `publicClient`.
Base URL is `/api/v1` in dev, so Vite proxies to the backend; in production it is
`VITE_API_URL` with a `http://localhost:8080/api/v1` fallback.
A response interceptor normalises errors and a request interceptor injects the bearer token; a 401
triggers a refresh and replays the original request.

`src/services/axiosInstance.js` is a three-line re-export of `axiosClient`.
Both import paths are in use across the codebase, which is confusing but not broken.

### Services and the endpoints they target

| Service function | Method and path | Backend status |
|------------------|-----------------|----------------|
| `postService.createPost` | `POST /posts` | correct |
| `postService.getFeed` | `GET /posts/feed` | correct |
| `postService.getExplorePosts` | `GET /posts/search` | correct |
| `postService.getUserPosts` | `GET /posts/user/{userId}` | correct |
| `postService.getPostById` | `GET /posts/{postId}` | correct |
| `postService.updatePost` | `PATCH /posts/{postId}` | correct |
| `postService.deletePost` | `DELETE /posts/{postId}` | correct |
| `postService.updatePostStatus` | `PATCH /posts/{postId}/status` body `{status}` | **wrong field name, backend needs `targetStatus`, returns 400** |
| `postService.likePost` / `unlikePost` | `POST` / `DELETE /posts/{postId}/like` | correct |
| `postService.savePost` / `unsavePost` | `POST` / `DELETE /posts/{postId}/save` | correct |
| `postService.getComments` | `GET /posts/{postId}/comments` | correct |
| `postService.getCommentReplies` | `GET /comments/{commentId}/replies` | correct |
| `postService.createComment` | `POST /posts/{postId}/comments` | correct, but sends no `Idempotency-Key` |
| `socialService.followUser` / `unfollowUser` | `POST` / `DELETE /social/follow/{id}` | correct |
| `socialService.blockUser` / `unblockUser` | `POST` / `DELETE /social/block/{id}` | correct |
| `socialService.getFollowers` / `getFollowing` | `GET /social/users/{id}/followers` and `/following` | correct |
| `socialService.getPendingFollowRequests` | `GET /social/follow-requests` | correct |
| `socialService.approveFollowRequest` / `rejectFollowRequest` | `PATCH /social/follow-requests/{id}/approve` and `/reject` | correct |
| `socialService.getSuggestedUsers` | `GET /users/suggestions` | **endpoint does not exist, returns 400** |
| `userService.getUserProfile` | `GET /users/{userId}` | correct |
| `userService.updateMyProfile` | `PATCH /users/me` | correct |
| `notificationService.*` | `GET /notifications`, `/unread-count`, `PATCH /{id}/read`, `/read-all` | correct |
| `mediaService.createUploadUrl` / `completeUpload` | `POST /media/upload` and `/upload-complete` | correct |

### Backend capabilities with no frontend service at all

| Capability | Endpoint |
|-----------|----------|
| Edit a comment | `PATCH /comments/{commentId}` |
| Delete a comment | `DELETE /comments/{commentId}` |
| Like or unlike a comment | `POST` / `DELETE /comments/{commentId}/like` |
| Report anything | `POST /reports` |
| List saved posts | `GET /posts/saved` |
| List post likers | `GET /posts/{postId}/likes` |
| Search users | `GET /users/search` |
| Search hashtags | `GET /hashtags/search` |
| Trending hashtags | `GET /hashtags/trending` |
| Read the blocked list | `GET /social/blocked` |
| Post edit history | `GET /posts/{postId}/history` |
| Look up a profile by username | `GET /users/by-username/{username}` |
| Read or write user settings | `GET` / `PATCH /users/me/settings` |
| Realtime comment or notification stream | `/ws/comments`, `/ws/notifications` |

### Hooks

| File | Hooks |
|------|-------|
| `features/luvax/hooks/usePosts.js` | `useFeed`, `useExplore`, `useUserPosts`, `usePostDetail`, `useCreatePost`, `useUpdatePostStatus`, `useUpdatePost`, `useDeletePost`, `useLikePost`, `useSavePost`, `useTopLevelComments`, `useCommentReplies`, `useCreateComment` |
| `features/luvax/hooks/useSocial.js` | `useFollow`, `useUnfollow`, `useFollowers`, `useFollowing`, `usePendingFollowRequests`, `useBlock`, `useUnblock`, `useApproveFollowRequest`, `useRejectFollowRequest`, `useSuggestedUsers` |
| `features/luvax/hooks/useUsers.js` | `useUserProfile`, `useUpdateMyProfile` |
| `features/luvax/hooks/useNotifications.js` | `useNotifications`, `useUnreadCount`, `useMarkAllAsRead` |
| `features/luvax/hooks/useMediaUpload.js` | `useMediaUpload` |
| `features/luvax/hooks/useViewport.js`, `useRelativeTime.js` | presentation helpers |
| `hooks/useCommon.js`, `hooks/useCountdown.js` | shared helpers |

There is no `useAuth.js`; auth lives in `features/auth/services/authService.js`, `src/api/authApi.js`,
and `src/store/useAuthStore.js`.

## Global rule violations

Rules are from `.claude/rules/global_rules.md` in this repository.

| Rule | Violation | Location |
|------|-----------|----------|
| Section 2: "Do not duplicate server state in Zustand" and by extension in any client store | The blocked-user list is maintained in `localStorage` under `lx_blocks_{userId}` even though `GET /social/blocked` exists and returns the authoritative list | `features/luvax/hooks/useSocial.js:103`, `:106`, `:135`; `features/luvax/components/BlockedUsersScreen.jsx:35`, `:38`; `features/luvax/components/SettingsScreen.jsx:85`; `features/luvax/components/shell.jsx:265`, `:267` |
| Section 3: "Never call `fetch` or `axios.create()` directly in components, hooks, or feature services" | `import axios from 'axios'` and a direct `axios.put` to the pre-signed URL | `features/luvax/hooks/useMediaUpload.js:2`, `:71` |
| Section 2: "Optimistic UI updates must include rollback logic that runs on API failure" | `useBlock` and `useUnblock` swallow the API error in a `try/catch` and then update `localStorage` in `onSuccess` regardless, so a failed block still shows as blocked | `features/luvax/hooks/useSocial.js:90-116`, `:119-141` |
| Section 6: "Route path constants are defined in `constants.js` under `ROUTES`. Use them" | `ROUTES.PROFILE` is `/profile` but no such route is registered | `config/constants.js:22` |
| Section 8: "Never log tokens, user PII, or sensitive headers to the console in production code" | `console.warn('Block user API error, ignoring:', err)` logs the raw error object on a code path that runs in production | `features/luvax/hooks/useSocial.js:95`, `:127` |
| Section 1: "A feature must not import directly from another feature's internal modules" | Not violated. `features/messages` and `features/search` are self-contained | none |

The `axios.put` in `useMediaUpload` is defensible on its merits: the pre-signed R2 upload must not
carry the application's `Authorization` header, and the interceptor would add it.
It is recorded because the rule as written admits no exception, not because the code is wrong.

Note that the media upload sends only `Content-Type`, while the backend's `requiredHeaders` also
names `content-length`.
A browser sets `Content-Length` automatically for a `File` body, so this works in practice, but it
relies on that rather than on the documented contract.

## Dead code and unused exports

| Item | Location |
|------|----------|
| `FEED_POSTS` | `features/luvax/constants/data.js`, exported, imported nowhere |
| `REPLIES` | `features/luvax/constants/data.js`, exported, imported nowhere |
| `lucide-react` | Declared in `package.json:22`. Zero imports anywhere in `src/`. An unused 1.16.0 dependency |
| `useSuggestedUsers` and `socialService.getSuggestedUsers` | Live code, but the endpoint does not exist, so it can only ever fail |
| `/oauth/callback` | Duplicate alias of `/oauth2/callback`; only `/oauth2/callback` is referenced by `VITE_GOOGLE_REDIRECT_PATH` |
| `ROUTES.PROFILE` | Declared, unroutable |
| `/dashboard` and `DashboardPage` | Registered and protected, but nothing in the application navigates to it |
| `ChangePasswordScreen` | Renders, but uses no hook and calls no service |
| `src/services/axiosInstance.js` | A re-export shim kept alongside direct `@/api/axiosClient` imports |

## The post composer flow

`features/luvax/components/ComposerScreen.jsx` with `useMediaUpload` and `useCreatePost`.

The flow is implemented end to end and matches the backend contract:

1. Read width, height, and duration client-side from an `Image` or `video` element.
2. `POST /media/upload` for a pre-signed URL.
3. Raw `axios.put` of the file to R2.
4. `POST /media/upload-complete` with the metadata.
5. `POST /posts` with `mediaIds`.

**Verified that the backend half of this flow works**: a pre-signed URL was issued, an asset was
registered, and an image post carrying that asset was created and returned with a populated `media`
array.
That was done with `curl`, not through the composer UI, so the composer's own success is
code-derived rather than observed.

Text posts are created with no media, which the backend accepts.

## Icons

`lucide-react` is a declared dependency with **zero imports**.
The frontend already has its own inline-SVG `LxIcon` at `src/components/ui/lx-icon.jsx`, matching
the design export's component signature exactly:
`{ name, size = 20, color, filled = false, stroke = 1.5 }`.

The porting decision in `open-decisions.md` is therefore mostly already done.
What remains is a name-set reconciliation and the filled variants.

Frontend icon names (28):
`alert`, `back`, `bell`, `bookmark`, `chat`, `check`, `chevronLeft`, `chevronRight`, `close`,
`edit`, `explore`, `eye`, `flag`, `hash`, `heart`, `home`, `image`, `link`, `message`, `more`,
`plus`, `profile`, `reply`, `send`, `settings`, `share`, `trash`, `type`, `video`

| Direction | Names |
|-----------|-------|
| In the frontend, absent from the design set | `alert`, `chevronLeft`, `edit`, `message`, `trash` |
| In the design set, absent from the frontend | `ban`, `mail`, `userMinus` |

The five frontend-only glyphs are the answer to "report any glyph currently used in the frontend
that has no equivalent in the design icon set".
None of them come from `lucide-react`; they are already local inline SVG.

Filled variants are the real gap.
The design defines seven: `bell`, `bookmark`, `chat`, `explore`, `heart`, `home`, `profile`.
The frontend's `LxIcon` special-cases `home` only and otherwise implements `filled` by setting the
SVG `fill` attribute on the outline path, which is not the same artwork.
