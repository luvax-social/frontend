# Session and Token Flow

> Record of work done on 2026-08-09. Not maintained; it is correct as of that date and is not updated as the code moves.

The previous phase reported that both tokens live in memory, so a refresh logs the user out.
This phase treated that as an unverified claim and tested it against the backend source, the running server, and the browser.

**The claim is correct, and it cannot be fixed from the frontend.**

A session that survives a browser refresh requires a backend change.
What that change would need to provide is set out at the end.

---

## What `POST /auth/login` returns

Request:

```
POST /auth/login
{"identifier":"luvax_ava","password":"ReconPass123!"}
```

Response body, field by field, from `AuthResponse`:

| Field | Type | Purpose |
|-------|------|---------|
| `accessToken` | string | Short-lived JWT, sent as `Authorization: Bearer` |
| `refreshToken` | string | Opaque rotation token |
| `accessTokenExpiresIn` | long | Seconds until the access token expires; observed `900` |
| `tokenType` | string | `"Bearer"` |
| `user` | `AuthenticatedUserResponse` | id, username, email, displayName, role, emailVerified |

Response headers:

```
$ curl -s -D - -o /dev/null -X POST .../auth/login -d '{"identifier":"luvax_ava","password":"ReconPass123!"}'
HTTP/1.1 200
```

**There is no `Set-Cookie` header.**
This is the finding the whole question turns on.

The refresh token is delivered in the response body and nowhere else.
It is not an `HttpOnly` cookie, so it cannot outlive the JavaScript heap that received it.

---

## What `POST /auth/refresh` requires

`RefreshRequest` declares a single `@NotBlank String refreshToken`, read from the JSON body.

The endpoint does not read a cookie, and no filter populates the field from one.
A client that has lost the token value has no way to authenticate the refresh call.

---

## Cookie attributes

Not applicable.
The authentication flow sets no cookie of any kind.

The only cookie machinery in the codebase is `CookieOAuth2AuthorizationRequestRepository`, which stores the OAuth2 state parameter as a tamper-evident HMAC-signed cookie for the duration of a Google sign-in redirect.
It carries no session token and is consumed and cleared when the OAuth callback completes.

---

## CORS

`SecurityConfig` sets `configuration.setAllowCredentials(true)`, and the dev origin is allowed:

```
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

Credentialed cross-origin requests are therefore permitted.
The frontend already sends `withCredentials` on the refresh and logout calls.

This means the CORS side of a cookie-based refresh is already in place.
The only missing piece is the backend actually issuing the cookie.

---

## Token lifetimes

From `backend/.env`:

| Token | Setting | Value |
|-------|---------|-------|
| Access | `ACCESS_TOKEN_TTL` | 900 seconds, 15 minutes |
| Refresh | `REFRESH_TOKEN_TTL` | 2592000 seconds, 30 days |

The refresh token is valid for a month.
That is precisely what makes the current arrangement wasteful: a thirty-day credential is discarded the moment the tab reloads.

---

## Rotation and reuse

Refresh tokens rotate. Verified:

```
login          -> refreshToken lwH9LyAxFYTW...
POST /refresh  -> refreshToken 654619WxC0_R...   (a different value)
```

Reuse of the consumed token is rejected:

```
POST /auth/refresh {"refreshToken":"lwH9LyAxFYTW..."}
401 {"success":false,"code":"AUTH_REFRESH_TOKEN_INVALID","message":"Invalid or revoked refresh token"}
```

Tokens are stored SHA-256 hashed in PostgreSQL with device metadata, and `rotate()` uses a conditional update under `REQUIRES_NEW` propagation to detect concurrent rotation and token theft.

The server side of this design is sound.
It is only the delivery mechanism that prevents the client from using it.

---

## What the browser actually holds

Inspected immediately after a successful login:

```json
{
  "localStorage": {
    "luvax-auth-session": "{\"state\":{\"user\":{\"id\":\"19e3d49b-...\",\"username\":\"luvax_ava\",\"email\":\"luvax_ava@example.com\",\"displayName\":\"Luvax Ava\",\"role\":\"user\",\"emailVerified\":true},\"isAuthenticated\":true},\"version\":0}"
  },
  "sessionStorage": { "lx_params": "{}", "lx_screen": "\"notifications\"" },
  "cookies": "(none readable by JS)",
  "containsAccessToken": false,
  "containsRefreshToken": false
}
```

No token is written to either store.
`useAuthStore`'s `partialize` persists only `user` and `isAuthenticated`; both tokens stay in the in-memory slice.

There is no cookie, `HttpOnly` or otherwise.

This satisfies the project security rule and is the correct posture.
It is also the reason the session cannot be restored.

---

## What a refresh does

Hard navigation to `/app` while logged in:

```
Page URL after load: http://localhost:5173/   (redirected to the landing/login route)
API requests issued: none
```

Zero network calls.
The application did not attempt a refresh, because there was nothing to attempt one with.

The persisted state afterwards:

```json
{ "user": null, "isAuthenticated": false }
```

---

## `AuthSessionBootstrap` behaviour

The bootstrap logic is already correct, and no change was warranted.

Its sequence on a cold load:

1. Wait for `hasHydrated`, set by the persist middleware's `onRehydrateStorage`.
2. Set `isBootstrapping` true.
3. Clear any legacy auth storage.
4. If there is neither an access token nor a refresh token, and the path is not a guest path, throw.
5. If there is a refresh token but no access token, call `/auth/refresh` and rehydrate.
6. On any failure, `logout()`.

On a cold load both tokens are null, so step 4 throws and step 6 clears the session.

### It does not flash the login screen

`isBootstrapping` initialises to `true` in the store, not `false`.
`ProtectedRoute` renders `PageLoader` whenever `isBootstrapping` is true, so the guard shows the loader from the very first render rather than briefly evaluating an unauthenticated state.

`ProtectedRoute` additionally requires both `isAuthenticated` and a live in-memory `accessToken`, which closes the window where the rehydrated `isAuthenticated: true` flag could pass the guard while no token exists.

### It does not leave a half-authenticated state

Verified after a hard refresh: the persisted state is `{ user: null, isAuthenticated: false }`, and the user is on the login route.

The stale `isAuthenticated: true` flag that rehydrates from `localStorage` is cleared by the `logout()` in the bootstrap's catch, so the two never disagree for longer than the bootstrap itself.

---

## Conclusion

This is scenario 2 from the brief.

The backend returns the refresh token in the response body only.
The project security rules forbid persisting tokens to `localStorage` or `sessionStorage`.
The backend is read-only in this phase.

Those three facts together make a persistent session unreachable from the frontend.

No frontend change was made, because every available option is either ineffective or a rule violation:

| Option | Why not |
|--------|---------|
| Persist the refresh token to `localStorage` | Directly violates the security rule. A 30-day credential in a store readable by any script is the exact exposure the rule exists to prevent. |
| Persist it to `sessionStorage` | Same violation, and it still does not survive closing the tab. |
| Encrypt it before persisting | The key would have to live alongside it. This is obfuscation, not protection. |
| Call `/auth/refresh` on bootstrap anyway | It requires the token value in the body. There is nothing to send. |
| Keep it in a service worker or a same-origin iframe | Meaningful engineering, still JavaScript-reachable, and far outside this phase. |

---

## What the backend would need to provide

One change, and the frontend work behind it is small.

**Issue the refresh token as an `HttpOnly` cookie on `POST /auth/login`, `POST /auth/register`, and `POST /auth/refresh`, and read it from that cookie in `POST /auth/refresh` when the request body omits it.**

Suggested attributes:

| Attribute | Value | Reason |
|-----------|-------|--------|
| Name | `luvax_refresh` | Distinct from any app cookie |
| `HttpOnly` | true | Unreachable from JavaScript, which is the entire point |
| `Secure` | true in production, false on plain-HTTP localhost | Required for `SameSite=None`, and correct in production regardless |
| `SameSite` | `Lax` | The refresh call is same-site in production. `None` only if the API is served from a different registrable domain, and then `Secure` is mandatory |
| `Path` | `/api/v1/auth` | Restricts the cookie to the endpoints that need it |
| `Max-Age` | 2592000 | Matches the existing `REFRESH_TOKEN_TTL` |

Keeping the body field as well would preserve every existing client, including non-browser ones, so the change need not break anything.

CORS already permits credentialed requests from the dev origin, so no configuration change is needed there.

Once that lands, the frontend change is:

1. `AuthSessionBootstrap` calls `/auth/refresh` with `withCredentials` when it has no tokens, instead of throwing.
2. It treats a `401` as "no session" and logs out, exactly as now.
3. Nothing is persisted. The access token stays in memory, and the refresh cookie is never visible to the application.

`ProtectedRoute` and the `isBootstrapping` gate already handle the resulting loading window correctly, so they would not need to change.

Until then, being logged out by a refresh is the correct and expected behaviour of this build, not a defect in the frontend.
