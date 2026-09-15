# Frontend Project Structure

## Overview

React 19 single-page application (SPA) for an Instagram-style social network, built with Vite 8.

Every mechanically derivable figure in this document - the slice inventory, the route table, the
dependency versions, the script list, the environment variables - is produced by
`./scripts/regenerate_struct_figures.sh`.
Run it and paste the section back rather than editing a number by hand.

### Core Stack

| Component | Value |
|-----------|-------|
| Framework | React 19 |
| Build Tool | Vite 8 |
| Package Manager | npm |
| Node.js Requirement | LTS (see `.nvmrc` if present; Vite 8 requires Node 20+) |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite` plugin) |
| UI Components | shadcn/ui + Radix primitives (`components.json` configures aliases and paths) |
| Server State | TanStack Query v5 (`QueryClientProvider` in `src/main.jsx`) |
| Global Client State | Zustand v5 (with `persist` middleware for auth session) |
| HTTP Client | Axios v1 — `src/api/axiosClient.js` exports `axiosClient` (auth) and `publicClient` (no-auth) |
| Realtime | STOMP over SockJS (`@stomp/stompjs`, `sockjs-client`) via `src/services/realtime/stompConnection.js` |
| Routing | React Router DOM v7 — config router (`createBrowserRouter`) |
| Forms | React Hook Form v7 + Zod v4 |
| Testing | Vitest 3 + Testing Library, jsdom |
| Language | JavaScript (no TypeScript; `jsconfig.json` provides IDE path resolution) |

There is no icon-set dependency. The 38 declared packages contain no `lucide-react`, no
`react-icons` and no `@heroicons`; icons are the local `src/components/ui/lx-icon.jsx`.

---

## Full `src/` Tree

```text
src/
├── api/
│   ├── authApi.js             # Auth endpoints; uses publicClient. Login sends `identifier`
│   ├── axiosClient.js         # Axios instances + interceptors; exports axiosClient, publicClient
│   └── media.service.js       # Pre-signed upload URL flow
├── assets/                    # Static assets imported from application code
├── components/
│   ├── common/                # App-level reusable pieces
│   │   ├── AuthSessionBootstrap.jsx   # Bootstraps auth state on app mount
│   │   ├── ConfirmModal.jsx           # Shared confirmation dialog
│   │   ├── ErrorBoundary.jsx          # React error boundary
│   │   ├── GuestRoute.jsx             # Sends an authenticated visitor to their role's landing route
│   │   ├── NotFoundPage.jsx           # 404 page
│   │   ├── PageLoader.jsx             # Full-page loading spinner
│   │   ├── ProtectedRoute.jsx         # Redirects unauthenticated users to /login
│   │   └── RouterErrorPage.jsx        # Error fallback for router-level errors
│   └── ui/                    # shadcn/ui primitives plus Luvax-specific shared UI
│       ├── button.jsx
│       ├── card.jsx
│       ├── input.jsx
│       ├── label.jsx
│       ├── lx-avatar.jsx
│       ├── lx-dropdown-menu.jsx
│       ├── lx-icon.jsx
│       ├── lx-toggle.jsx
│       └── lx-verified-badge.jsx
├── config/
│   ├── constants.js           # ROUTES, API_URL, STALE_TIME, HTTP_STATUS, CHAR_LIMITS, APP_NAME
│   ├── roles.js               # ROLES, normalizeRole, isPanelRole, isAdminRole, landingPathForRole
│   └── tokens.js              # `v` design-token object consumed by the luvax screens
├── context/                   # Reserved - empty
├── features/                  # Six slices; sizes are measured, not estimated
│   ├── admin/                 # Moderation panel
│   │   ├── adminRoutes.jsx    # The /admin route subtree
│   │   ├── api/               # Panel-specific API modules
│   │   ├── components/
│   │   ├── guards/            # Role gates for the panel
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── screens/           # One file per panel screen
│   ├── auth/
│   │   ├── components/        # AuthField.jsx, AuthPage.jsx/.css
│   │   ├── services/          # authService.js
│   │   ├── store/             # Reserved - empty
│   │   └── utils/             # authSchemas.js — Zod schemas mirroring backend validation
│   ├── luvax/                 # Authenticated application shell and screens
│   │   ├── components/        # shell.jsx, primitives.jsx, and one file per screen
│   │   ├── constants/
│   │   ├── hooks/
│   │   ├── utils/
│   │   ├── LuvaxApp.jsx       # Feature root; renders the shell around the routed screen
│   │   └── LuvaxTweaksContext.jsx
│   ├── messages/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── utils/
│   │   └── MessagesScreen.jsx
│   ├── search/
│   │   ├── components/
│   │   └── hooks/
│   └── support/               # Help centre, tickets, appeals, verification requests
│       ├── components/
│       ├── hooks/
│       ├── services/
│       └── utils/
├── hooks/                     # Shared hooks: useCommon, useCountdown, useEscapeKey,
│                              # useImpressionTracking, useRateLimitCooldown, useThemeChoice
├── pages/
│   ├── auth/
│   │   ├── EmailVerificationPage.jsx
│   │   ├── OAuthCallbackPage.jsx
│   │   ├── ResetPasswordPage.jsx
│   │   └── VerifyEmailNoticePage.jsx
│   ├── dashboard/
│   │   └── DashboardPage.jsx
│   └── LuvaxPage.jsx
├── routes/
│   ├── appScreens.jsx         # The authenticated screen table the router and shell both read
│   └── index.jsx              # createBrowserRouter - central route tree
├── services/                  # Shared API modules used across slices
│   ├── axiosInstance.js       # Re-exports axiosClient
│   ├── config.service.js
│   ├── hashtag.service.js
│   ├── impressionQueue.js
│   ├── message.service.js
│   ├── notification.service.js
│   ├── post.service.js
│   ├── realtime/stompConnection.js
│   ├── recommendation.service.js
│   ├── report.service.js
│   ├── search.service.js
│   ├── social.service.js
│   ├── story.service.js
│   ├── suggestion.service.js
│   └── user.service.js
├── store/
│   └── useAuthStore.js        # Zustand; persists user + isAuthenticated only, never tokens
├── utils/
│   ├── cn.js
│   ├── helpers.js
│   ├── requestContract.js
│   └── validationFields.js
├── App.jsx
├── App.css
├── index.css                  # Tailwind v4 import + CSS custom properties
└── main.jsx                   # RouterProvider + QueryClientProvider + global error handling
```

### Slice sizes

Generated by `./scripts/regenerate_struct_figures.sh slices`; tracked files only.

| Slice | Files | Lines |
|-------|-------|-------|
| `admin` | 79 | 13795 |
| `auth` | 8 | 1629 |
| `luvax` | 56 | 16796 |
| `messages` | 16 | 4913 |
| `search` | 4 | 990 |
| `support` | 13 | 2838 |

Total tracked lines under `src/`: 48394.

---

## Module / Feature Organization Pattern

Feature-based ("vertical slice") under `src/features/`. Each feature owns its components,
hooks, services, and utilities. Shared cross-feature concerns live at the `src/` top-level
layers (`components/`, `hooks/`, `services/`, `store/`, `utils/`).

### Pattern for a feature slice:

```text
src/features/<feature>/
├── components/      # Page/form/UI components for this feature
├── hooks/           # TanStack Query hooks and feature orchestration
├── services/        # API calls; must use axiosClient or publicClient — no direct fetch/axios
├── store/           # Optional: local Zustand slice if feature outgrows global store
└── utils/           # Zod schemas, helpers specific to this feature
```

The `admin` slice adds `screens/`, `guards/`, `lib/` and its own `adminRoutes.jsx`, because the
panel is a separate route tree with its own role gate rather than a screen inside the app shell.

---

## Routing Setup

- Config-based routing using `createBrowserRouter` in `src/routes/index.jsx`
- `src/routes/appScreens.jsx` holds the authenticated screen table; the router builds its child
  routes from it and the app shell reads the same list back, so the two cannot disagree about
  which address renders which screen
- `src/features/admin/adminRoutes.jsx` holds the `/admin` subtree
- `ProtectedRoute` (in `src/components/common/`) guards authenticated routes
- `GuestRoute` (in `src/components/common/`) sends an already-authenticated visitor to
  `landingPathForRole(role)`, so a moderator or administrator lands in the panel rather than in
  the user-facing application

**Every authenticated screen has its own address.**
An earlier revision of this document said the opposite - that the whole application lived at a
single `/app` route and no authenticated screen could be linked, bookmarked or reloaded. That
stopped being true when the screen table was introduced, and the route constants below are the
evidence.

### Declared routes

`ROUTES` in `src/config/constants.js` is the single declaration of every path; the router and
every `navigate()` call read it back. Regenerate with
`./scripts/regenerate_struct_figures.sh routes`.

| Constant | Path |
|----------|------|
| `HOME` | `/` |
| `APP` | `/app` |
| `LOGIN` | `/login` |
| `REGISTER` | `/register` |
| `VERIFY_EMAIL` | `/verify-email` |
| `VERIFY_EMAIL_NOTICE` | `/verify-email-notice` |
| `FORGOT_PASSWORD` | `/forgot-password` |
| `RESET_PASSWORD` | `/reset-password` |
| `OAUTH_CALLBACK` | `/oauth2/callback` |
| `DASHBOARD` | `/dashboard` |
| `FEED` | `/app` |
| `EXPLORE` | `/app/explore` |
| `HASHTAG` | `/app/tags/:name` |
| `HASHTAG_DEEP_LINK` | `/tags/:name` |
| `COMPOSE` | `/app/compose` |
| `NOTIFICATIONS` | `/app/notifications` |
| `MESSAGES` | `/app/messages` |
| `SETTINGS` | `/app/settings` |
| `SETTINGS_CATEGORY` | `/app/settings/:category` |
| `EDIT_PROFILE` | `/app/settings/profile` |
| `SETTINGS_NOTIFICATIONS` | `/app/settings/notifications` |
| `SETTINGS_APPEARANCE` | `/app/settings/appearance` |
| `SETTINGS_PRIVACY` | `/app/settings/privacy` |
| `SETTINGS_ACCOUNT` | `/app/settings/account` |
| `SETTINGS_REQUESTS` | `/app/settings/requests` |
| `SETTINGS_SUPPORT` | `/app/settings/support` |
| `CHANGE_PASSWORD` | `/app/settings/password` |
| `BLOCKED_USERS` | `/app/settings/blocked` |
| `SAVED` | `/app/settings/saved` |
| `SUPPORT` | `/app/support` |
| `SUPPORT_TICKET` | `/app/support/:ticketId` |
| `SUPPORT_APPEAL` | `/support/appeal` |
| `SUPPORT_CONFIRM` | `/support/confirm` |
| `SUPPORT_PUBLIC` | `/support/new` |
| `ONBOARDING` | `/app/onboarding` |
| `STORY_COMPOSE` | `/app/stories/new` |
| `PROFILE` | `/app/profile` |
| `USER_PROFILE` | `/app/u/:userId` |
| `USER_FOLLOWERS` | `/app/u/:userId/followers` |
| `USER_FOLLOWING` | `/app/u/:userId/following` |
| `POST_DETAIL` | `/app/p/:postId` |
| `STORY_VIEW` | `/app/stories/:storyId` |
| `SEARCH` | `/app/search` |
| `ADMIN` | `/admin` |
| `ADMIN_REPORTS` | `/admin/reports` |
| `ADMIN_REPORT_DETAIL` | `/admin/reports/:reportId` |
| `ADMIN_ESCALATED` | `/admin/escalated` |
| `ADMIN_MY_ESCALATIONS` | `/admin/my-escalations` |
| `ADMIN_ACTIONS` | `/admin/actions` |
| `ADMIN_USERS` | `/admin/users` |
| `ADMIN_USER` | `/admin/users/:userId` |
| `ADMIN_HASHTAGS` | `/admin/hashtags` |
| `ADMIN_SUPPORT` | `/admin/support` |
| `ADMIN_STATISTICS` | `/admin/statistics` |
| `ADMIN_ACTIVITY` | `/admin/activity` |
| `NOT_FOUND` | `*` |

The three `/support/*` addresses sit outside the authenticated tree on purpose: a banned or
suspended account is refused a session by design, and that is exactly the population an appeal
exists for. Two of them are already built into moderation and confirmation mail that has been
sent, so their shapes are fixed by messages already in inboxes.

---

## State Management

| Layer | Library | What lives here |
|-------|---------|-----------------|
| Server state | TanStack Query | API data, pagination, caching, mutations |
| Global client state | Zustand | Auth session (`useAuthStore`), cross-feature state |
| Feature-local state | React `useState` / `useReducer` | UI state local to one component/feature |

`useAuthStore` persistence:
- Persisted to `localStorage` under key `luvax-auth-session`
- Only `user` (without `role`) and `isAuthenticated` are persisted; `accessToken`, `refreshToken`
  and `role` are in-memory only

---

## API Client Setup

All BE API calls must go through `src/api/axiosClient.js`. Never call `fetch` or `axios.create`
directly in components or hooks. `src/services/axiosInstance.js` is a re-export of `axiosClient`,
kept so the shared service modules can import a default; it is the same instance, not a second one.

| Client | When to use |
|--------|-------------|
| `axiosClient` | Authenticated requests; auto-injects `Authorization: Bearer <token>`, auto-refreshes on 401 |
| `publicClient` | Unauthenticated requests (login, register, forgot-password, OAuth exchange) |

Base URL: `VITE_API_URL` env var (falls back to `http://localhost:8080/api/v1`).
In dev mode (`import.meta.env.DEV`), Vite proxies `/api/v1` to the BE; `axiosClient` uses `/api/v1`.

The refresh token is delivered as an HttpOnly cookie, so the refresh call sends credentials and
never reads the token from JavaScript. An absent in-memory refresh token is not a dead end: the
cookie alone completes the refresh.

---

## Environment Variable Prefix Convention

All FE environment variables must use the `VITE_` prefix (required by Vite for client-side access).

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | BE base URL (e.g., `http://localhost:8080/api/v1`) |
| `VITE_GOOGLE_AUTH_URL` | Google OAuth initiation endpoint on BE |
| `VITE_GOOGLE_REDIRECT_PATH` | FE route BE redirects back to after OAuth |
| `VITE_APP_NAME` | Application name displayed in UI |
| `VITE_APP_ENV` | Environment tag (development / production) |
| `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key for the auth forms, the report dialog and the public support form |

Reference: `.env.example` at the repository root.

---

## Key Scripts

```bash
npm run dev          # Vite dev server with proxy (scripts/dev-server.mjs)
npm run dev:reset    # Dev server with state reset
npm run build        # Vite production build
npm run lint         # ESLint
npm run preview      # Preview production build locally
npm run test         # Vitest, vitest.config.js
npm run test:watch   # Vitest in watch mode
npm run test:live    # Vitest against a running backend, vitest.live.config.js
npm run test:all     # test then test:live
```

`./scripts/regenerate_struct_figures.sh` regenerates the slice table, the route table, the
dependency list, this script list and the environment variable list. It cannot check a prose
claim, only a count, a list, a path or a declared route.
