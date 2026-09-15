# Frontend Global Rules

---

## 1. Component Architecture

- **Feature-first**: new business logic and UI belong in `src/features/<feature>/`.
  The six slices are `admin`, `auth`, `luvax`, `messages`, `search` and `support`.
- **Shared primitives**: components used by more than one feature belong in `src/components/`.
  - `src/components/ui/` — low-level design-system primitives (shadcn/ui scaffolds).
  - `src/components/common/` — route guards, error boundaries, and shared app-level pages.
- **No cross-feature imports**: a feature must not import directly from another feature's
  internal modules. Shared logic must be extracted to `src/components/`, `src/hooks/`,
  `src/services/`, `src/store/`, or `src/utils/` before being consumed.
- **Page components**: large page-level components live in `src/features/<feature>/components/`
  (preferred) or `src/pages/` (transitional location for stubs not yet in a feature module).

---

## 2. State Management Policy

| Layer | Library | What lives here | Notes |
|-------|---------|-----------------|-------|
| Server state | TanStack Query | API data, mutations, pagination, caching | Cache TTLs defined in `src/config/constants.js` (STALE_TIME) |
| Global client state | Zustand | Auth session, cross-feature state | `src/store/useAuthStore.js` is the current global store |
| Feature-local state | React `useState` / `useReducer` | UI state local to one component | Default unless sharing is needed |

Rules:
- Prefer TanStack Query for any data that originates from the BE. Do not duplicate server
  state in Zustand.
- Zustand global stores are for persistent or cross-feature client state, not API cache.
- Only `user` (with `role` stripped) and `isAuthenticated` are persisted to `localStorage`.
  Tokens and `role` must never be persisted (see `useAuthStore` `partialize` config).
- Optimistic UI updates must include rollback logic that runs on API failure.

---

## 3. API Layer Rules

- All BE API calls must go through `src/api/axiosClient.js`.
- Use `axiosClient` for authenticated requests; use `publicClient` for public/auth endpoints.
- Never call `fetch` or `axios.create()` directly in components, hooks, or feature services.
- Feature-specific API wrappers belong in `src/features/<feature>/services/`.
- API base URL must come from the `VITE_API_URL` environment variable only — never hardcoded.
- All BE responses follow the `ApiResponse<T>` envelope. Feature services must unwrap `data`
  before returning to hooks/components.
- Error messages from the BE are normalized by `axiosClient`'s response interceptor.
  Components should display `error.message` — do not access `error.response.data.message`
  directly unless there is a documented reason.

---

## 4. Environment Variables

- Prefix: `VITE_` (Vite convention; variables without this prefix are not accessible in browser code)
- Never hardcode API URLs, OAuth URLs, tokens, keys, or any environment-specific value
- Never commit `.env` files; commit only `.env.example`
- Reference: `.env.example` at the repository root

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | BE REST API base URL |
| `VITE_GOOGLE_AUTH_URL` | Google OAuth start URL (points to BE) |
| `VITE_GOOGLE_REDIRECT_PATH` | FE callback path after Google OAuth |
| `VITE_APP_NAME` | Display name of the application |
| `VITE_APP_ENV` | Deployment environment tag |
| `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key for the auth forms, the report dialog and the public support form |

---

## 5. Type Safety

The project uses plain JavaScript. TypeScript is not configured.

- `jsconfig.json` is present for IDE path resolution and basic inference — it is not a TypeScript
  build step.
- Prop types and data shapes are validated at runtime via Zod schemas (see
  `src/features/auth/utils/authSchemas.js` as the canonical example).
- Prefer explicit Zod schemas for all form data and API request payloads.
- Do not add TypeScript files (`.ts`, `.tsx`) without first aligning with the team — this is a
  deliberate language choice.

---

## 6. Routing Rules

- Routing is config-based. `src/routes/index.jsx` is the root router; `src/routes/appScreens.jsx`
  holds the authenticated screen table it builds its children from, and
  `src/features/admin/adminRoutes.jsx` holds the `/admin` subtree.
- New routes must be added to one of those three tables — no ad-hoc `<Routes>` trees elsewhere in
  feature code.
- Route path constants are defined in `src/config/constants.js` under `ROUTES`. Use them for
  `navigate()` calls and `<Link>` components; never hardcode path strings.
- Route guards:
  - `ProtectedRoute`: wraps any route that requires authentication; redirects to `/login` if not
    authenticated.
  - `GuestRoute`: wraps login/register routes; sends an already-authenticated visitor to
    `landingPathForRole(role)` from `src/config/roles.js`, so a moderator or administrator lands
    in the panel rather than in the user-facing application.

---

## 7. Commit and Changelog Rules

- Commit format: `<type>(<scope>): <subject>` — same Conventional Commits convention as BE.
- Allowed scopes are FE-specific; see `git_workflow.md` beside this file for the full allowlist,
  which is kept in step with `.github/workflows/pr-lint.yml`.
- A CHANGELOG.md entry is required after every completed task — see `changelog_rule.md` beside
  this file.
- Comments: English only. No decorative dividers. No commented-out code in commits.

---

## 8. Security Rules

- Access tokens must never be written to `localStorage` or `sessionStorage`.
- The refresh token is delivered as an HttpOnly cookie and is never readable by JavaScript. A
  copy may sit in memory when a response carries one, but the cookie alone completes a refresh
  and is what the interceptor relies on.
- The `clearLegacyAuthStorage` utility in `useAuthStore.js` is the single point for wiping auth
  artifacts on logout; call it exclusively, do not write ad-hoc localStorage cleanup code.
- Never log tokens, user PII, or sensitive headers to the console in production code.
- All user-facing error messages must be normalized (the `axiosClient` interceptor handles this).
  Never surface raw BE error bodies, SQL details, or Java stack traces in the UI.
