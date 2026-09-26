# Session Restoration

> Record of work done on 2026-08-10. Not maintained; it is correct as of that date and is not updated as the code moves.

The previous phase concluded that a session could not survive a reload and said exactly what the backend would have to provide.
The backend has since provided it, merged at `1e36f54`.

This phase treated the specification as a claim to be checked rather than a description of what shipped, and tested the running server with `curl` and with a real browser.

## The cookie, as observed

### `POST /auth/login` issues it

```
$ curl -s -D - -o /dev/null -X POST http://localhost:8080/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"identifier":"luvax_ava","password":"ReconPass123!"}'

HTTP/1.1 200
Set-Cookie: luvax_refresh=7SQcyrgYcRWWqtTCwy8wo4DJmo4ICm7paXZ1SwKpWxo; Path=/api/v1/auth;
            Max-Age=2592000; Expires=Tue, 08 Sep 2026 03:39:43 GMT; HttpOnly; SameSite=Lax
```

| Attribute | Value | Note |
|-----------|-------|------|
| Name | `luvax_refresh` | |
| `Path` | `/api/v1/auth` | Sent only to the auth endpoints |
| `Max-Age` | 2592000 | Thirty days, matching `REFRESH_TOKEN_TTL` |
| `HttpOnly` | present | Not readable from JavaScript |
| `SameSite` | `Lax` | The CSRF control for an anonymous, CSRF-exempt endpoint |
| `Secure` | **absent** | The `dev` profile sets `secure: false`, because a `Secure` cookie is never stored over plain HTTP. `application.yaml` defaults it to `true`, so a deployment that forgets to configure it fails closed |

The cookie value equals the `refreshToken` in the response body; the body field is still returned.

### `POST /auth/refresh` reads it, with no body at all

```
$ curl -s -D - -b jar.txt -X POST http://localhost:8080/api/v1/auth/refresh
HTTP/1.1 200
Set-Cookie: luvax_refresh=hmg9MHzWwBd2ay4jjNOoG4c0XQrA_QPloSEmQw0gI6U; ...
```

An empty JSON object works too:

```
$ curl -s -b jar.txt -X POST .../auth/refresh -H "Content-Type: application/json" -d '{}'
200, new access token
```

Both work because `RefreshRequest.refreshToken` is no longer `@NotBlank`; it is declared `RequiredMode.NOT_REQUIRED`.
That detail matters to the frontend, whose request builder drops empty fields and therefore sends `{}` when it holds no token.

### The body still wins when both are present

A valid cookie plus a junk token in the body is rejected, which proves the body is preferred rather than merged or ignored:

```
$ curl -s -b jar.txt -X POST .../auth/refresh -d '{"refreshToken":"garbage-not-a-real-token"}'
401 {"success":false,"code":"AUTH_REFRESH_TOKEN_INVALID","message":"Invalid or revoked refresh token"}
```

Existing non-browser clients keep working unchanged.

### Refresh rotates the cookie

The `Set-Cookie` on the refresh response above carries a different value from the one that went in.
The old value is dead immediately.

### A consumed token is rejected when it arrives by cookie

```
$ curl -s -X POST .../auth/refresh -H "Cookie: luvax_refresh=<rotated-away value>"
401 {"success":false,"code":"AUTH_REFRESH_TOKEN_INVALID","message":"Invalid or revoked refresh token"}
```

Reuse detection is not weakened by the cookie transport.

### `POST /auth/logout` clears it, but only when authenticated

This is the one place where behaviour did not match the assumption, and it mattered.

Unauthenticated:

```
$ curl -s -D - -b jar.txt -X POST .../auth/logout
HTTP/1.1 401
```

No `Set-Cookie`, and the token stayed usable: a following refresh with the same jar returned `200`.

With a bearer token:

```
$ curl -s -D - -b jar.txt -H "Authorization: Bearer $AT" -X POST .../auth/logout
HTTP/1.1 204
Set-Cookie: luvax_refresh=; Path=/api/v1/auth; Max-Age=0;
            Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax
```

A refresh with the same jar afterwards returned `401`.

This is deliberate on the backend: `SecurityConfig` lists `/auth/logout` in `AUTHENTICATED_POST_AUTH_PATHS`, not in the public set.
The frontend was sending it on `publicClient`, which never attaches the bearer token, so logout had always been answering `401`.
That was invisible while there was no cookie.
With a cookie it would have meant a signed-out browser could restore its session on the next reload.
The fix is in `changes-applied.md`.

### The OAuth2 exchange issues it

The Google flow cannot be completed against a real provider locally, so the exchange code was seeded directly into Redis, which is where `OAuth2ExchangeCodeServiceImpl` keeps it (`auth:oauth2:exchange:{code}`, 120 second TTL, value is the user id):

```
$ docker exec backend-redis-1 redis-cli SET auth:oauth2:exchange:deadbeefcafe1234 <ava-user-id> EX 120
$ curl -s -D - -X POST .../auth/oauth2/exchange -d '{"code":"deadbeefcafe1234"}'
HTTP/1.1 200
Set-Cookie: luvax_refresh=VZLmG7OF24ixbQSFIlxSt-O45D2T3WedZR6jsVmdfew; Path=/api/v1/auth;
            Max-Age=2592000; HttpOnly; SameSite=Lax
```

`AuthController` also writes the cookie on `verifyEmail`.
`register` does not, and should not: it issues no tokens because the address must be verified first.

### In a real browser

`curl` does not enforce cookie attributes the way a browser does, and the browser is what matters.

Signed in through the form at `http://localhost:5173`, then inspected in the page:

```json
{
  "documentCookie": "(empty - nothing JS-readable)",
  "localStorage": { "luvax-auth-session": "{...\"user\":{...},\"isAuthenticated\":true}" },
  "sessionStorage": {}
}
```

The cookie is held and is invisible to page scripts, as intended.
That it is genuinely stored and replayed was confirmed by issuing the barest possible request from the page:

```js
await fetch('/api/v1/auth/refresh', { method: 'POST' })
// -> 200, body carries a new accessToken
```

No body, no explicit `credentials` option, and it still succeeded, which is only possible if the browser attached the cookie.

In development the browser talks to the Vite proxy, so these calls are same-origin and the cookie would ride along regardless of `withCredentials`.
That is why `withCredentials` was made unconditional rather than left behind an environment flag: the flag was unset, and the gap would only have appeared in a cross-origin production deployment, where it would have broken every reload.

## What the frontend now does on a cold load

`AuthSessionBootstrap` used to throw when it held neither token, which was the correct response to a backend with no cookie.
It now attempts a restore.

1. Wait for the persist middleware to rehydrate, then set `isBootstrapping`.
2. If there is no access token, call `POST /auth/refresh` with credentials and whatever refresh token is in memory, which after a reload is nothing. The cookie supplies it.
3. On success, put the new access token and the returned user in memory.
4. On `401`, treat it as no session and log out, exactly as before.
5. On any other failure, do **not** log out.

Step 5 is the deliberate part.
A network error is not an expired session.
Discarding the persisted session marker on a dropped connection would sign out someone whose thirty-day cookie is perfectly valid.
Nothing is treated as signed in during that window either: `ProtectedRoute` requires a live in-memory access token, which this path never sets, so the user sees the sign-in screen and the next load retries.

Guest paths still skip the round trip when no token is held, because those are token-driven pages that never need a session.

Nothing is persisted.
The access token lives in memory, the refresh token lives in a cookie the application cannot read, and `partialize` still writes only `user` and `isAuthenticated`.

`ProtectedRoute` and the `isBootstrapping` gate were verified correct in the previous phase and needed no change; the restore flow did not prove otherwise.

## Evidence for each check

### Sign in, hard refresh, session survives on the same screen

Signed in, navigated to a post, then reloaded:

```
opened post: /app/p/32d5030a-4181-4059-be06-b4b1dc325f2a
hard refresh -> {
  "url": "/app/p/32d5030a-4181-4059-be06-b4b1dc325f2a",
  "overlayPresent": true,
  ...
}
```

Same screen, same parameter, still signed in.
Before this phase the same reload landed on the sign-in page with the screen lost.

### No token in `localStorage` or `sessionStorage`

Inspected after the reload above:

```json
{
  "localStorageKeys": ["luvax-auth-session"],
  "sessionStorageKeys": ["react-router-scroll-positions"],
  "anyTokenInStorage": false,
  "jsReadableCookie": "(none)"
}
```

`luvax-auth-session` holds `user` and `isAuthenticated` only.
`react-router-scroll-positions` is scroll offsets written by `ScrollRestoration`.
The check is a case-insensitive search for "token" across the full contents of both stores, and it finds nothing.

### The sign-in screen does not flash

`isBootstrapping` initialises to `true` in the store rather than `false`, and `ProtectedRoute` renders `PageLoader` while it is true.
The guard therefore never evaluates an unauthenticated state before the restore has had its turn.
Across every cold load in `verification-evidence.md` the page settled on the requested screen; none passed through the sign-in screen.

### Sign out, refresh, not restored

Signed out through the settings screen, then reloaded `/app`:

```json
{
  "urlAfterBootstrap": "http://localhost:5173/",
  "restored": false,
  "localStorage": { "luvax-auth-session": "{\"state\":{\"user\":null,\"isAuthenticated\":false}...}" },
  "cookieStillUsable": 401
}
```

The cookie is dead server-side, not merely dropped by the client.
This check failed before the logout fix.

### An expired access token refreshes and replays

The backend was restarted with `ACCESS_TOKEN_TTL=40` for this check, an environment variable at launch, no file changed.
`XMLHttpRequest` was instrumented in the page, the tab was left idle past the expiry, and a tab was then clicked:

```
GET  /api/v1/notifications/unread-count -> 401
POST /api/v1/auth/refresh               -> 200
GET  /api/v1/notifications/unread-count -> 200
GET  /api/v1/posts/feed?limit=10        -> 200
```

The failed request is retried after the refresh and succeeds, and the user stays where they were.
The backend was restarted with its normal TTL afterwards.
