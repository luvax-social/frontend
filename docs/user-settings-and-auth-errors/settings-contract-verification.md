# Settings contract verification

> Record of work done on 2026-08-25. Not maintained; it is correct as of that date and is not updated as the code moves.

Everything below was produced by calling the running backend or by driving the real
interface in a browser. Nothing here is inferred from the OpenAPI document alone; where
the document and the running server disagreed, the server is recorded.

**Environment.** Backend up on `localhost:8080` (`/actuator/health` → `UP`), compose stack
healthy (postgres, redis, rabbitmq, elasticsearch, gorse, mailpit — all `healthy`), frontend
dev server on `localhost:5173`. `bash scripts/seed-dev-data.sh --reset` was run at the start
of this phase: the database held only `seed_mod` beforehand, so the stated prerequisite was
not in fact satisfied and the seed was re-run to satisfy it. Five accounts now exist
(`seed_alice`, `seed_bob`, `seed_carol`, `seed_mod`, `seed_admin`), password `SeedPass123!`.

Calls were made as `seed_alice` (role `user`) unless a line says otherwise. The OpenAPI
document was read from the live `/api-docs`, not the copy committed under `docs/admin-panel/`.

---

## 3.1 What the account can read about itself

Five endpoints return information about the calling account. Every one was called.

### `GET /api/v1/users/me` → 200

```json
{"id":"1d5682b8-…","username":"seed_alice","email":"alice@seed.local",
 "displayName":"Seed Alice","bio":null,"avatarUrl":null,"bannerUrl":null,
 "websiteUrl":null,"isPrivate":false,"isVerified":false,
 "followerCount":1,"followingCount":1,"postCount":2,
 "createdAt":"2026-08-25T00:49:15.208973Z"}
```

| Field | Meaningful to a person | Note |
|---|---|---|
| `username` | yes | editable |
| `email` | yes | **read-only** — see 3.2 |
| `displayName`, `bio`, `avatarUrl`, `bannerUrl`, `websiteUrl` | yes | editable |
| `isPrivate` | yes | editable |
| `isVerified` | yes | **read-only.** The verified badge. Not email verification. |
| `followerCount`, `followingCount`, `postCount` | yes | trigger-maintained, never written by a client |
| `createdAt` | yes | read-only |
| `id` | no | internal identifier |

**`isVerified` is not email verification.** The login response carries a separate
`emailVerified` boolean on its `user` object; `/users/me` does not carry `emailVerified` at
all, and `isVerified` is the profile badge. These are two different things and the current
settings screen conflates them — see the defect note at the end of this document.

### `GET /api/v1/users/me/settings` → 200

Eight booleans plus a timestamp. Full shape in 3.3.

### `GET /api/v1/users/me/warnings` → 200

Cursor page of `{id, reasonKey, note, createdAt}`. Empty for a clean account. Verified
non-empty by issuing a warning as `seed_admin` and reading it back as `seed_alice`:

```json
{"content":[{"id":"38cb864e-…","reasonKey":"spam",
  "note":"contract verification probe warning",
  "createdAt":"2026-08-25T00:50:30.988982Z"}],
 "pageInfo":{"hasNextPage":false,…},"degraded":false}
```

`reasonKey` is a key into `report_reason_configs`, resolvable to a display name through
`GET /api/v1/config/vocabularies` (`spam` → `Spam`).

### `GET /api/v1/social/blocked` → 200 and `GET /api/v1/social/follow-requests` → 200

Both cursor pages. Shapes in 3.4.

### Supporting reads

`GET /api/v1/config/vocabularies` → report reasons and notification types.
`GET /api/v1/media/constraints` → `{acceptedImageMimeTypes, acceptedVideoMimeTypes,
maxFileSizeBytes: 104857600, maxVideoDurationSeconds: 180}`. Both are configuration, not
account state, but the avatar picker depends on the second.

### The account's own standing — what is and is not returned

| Question the account might ask | Answered by | Value |
|---|---|---|
| am I verified? | `/users/me` `isVerified` | yes |
| am I private? | `/users/me` `isPrivate` | yes |
| when was I created? | `/users/me` `createdAt` | yes |
| have I been warned? | `/users/me/warnings` | yes, with reason and note |
| **am I suspended, and until when?** | **nothing** | **no — see below** |

**A suspended account cannot see its own suspension, because it cannot reach any
authenticated endpoint at all.** Established, not assumed:

`seed_alice` was suspended for 7 days via `PATCH /api/v1/admin/users/{id}/suspend` as
`seed_admin`. Database confirmed `status=suspended`, `suspended_until=2026-09-01 07:50:01+07`.
Then, as `seed_alice`:

| Call | Result |
|---|---|
| `GET /users/me` with the token issued before suspension | **401** `UNAUTHORIZED` "Authentication is required" |
| `GET /users/me/warnings` with the same token | **401** `UNAUTHORIZED` |
| `GET /posts/feed` with the same token | **401** `UNAUTHORIZED` |
| `POST /auth/login` (fresh sign-in) | **403** `AUTH_ACCOUNT_INACTIVE` "This account is suspended or deactivated" |

Existing sessions are invalidated and a new sign-in is refused. The refusal message says
"suspended or deactivated" without distinguishing the two, and **carries no end date**.

Consequences, both binding on this phase:

1. A settings screen can never render a suspension notice, because a suspended account is
   never authenticated enough to load settings. Section 4.3 of the brief asks for a
   suspension with its end date on the settings screen; that surface cannot exist.
2. The only place a suspension is visible to the person is the **sign-in screen**, as a 403
   on login. That makes it an authentication-surface concern (Work Item 5), not a settings
   concern. The end date is not available to the frontend in any form.

`seed_alice` was unsuspended after the probe.

---

## 3.2 What the account can change about itself

### `PATCH /api/v1/users/me` — profile

Body `UpdateProfileRequest`. Every field optional; partial updates accepted.

| Field | Type | Constraint | Verified refusal |
|---|---|---|---|
| `username` | string | 3–30 chars; letters, digits, underscores, dots | `{"username":"ab"}` → **400** `VALIDATION_ERROR`, `data:{"username":"size must be between 3 and 30"}` · `{"username":"bad name!"}` → **400**, `data:{"username":"Username may only contain letters, digits, underscores and dots"}` · `{"username":"seed_bob"}` → **409** `USER_USERNAME_ALREADY_EXISTS` "Username is already taken" |
| `displayName` | string | 0–100 | length enforced |
| `bio` | string | 0–500 | 501 chars → **400**, `data:{"bio":"size must be between 0 and 500"}` |
| `avatarUrl` | string | 0–2048 | — |
| `bannerUrl` | string | 0–2048 | — |
| `websiteUrl` | string | 0–2048 | **no format validation** — `{"websiteUrl":"not a url"}` → **200**, stored verbatim |
| `isPrivate` | boolean | — | — |

Unknown field → **400** `MALFORMED_REQUEST_BODY` "Request body could not be read".
Verified with `{"email":"new@x.com"}`, which is how email's read-only status was established.

`VALIDATION_ERROR` returns `data` as a **field name → message map**. This is the shape a
per-field error display binds to, and it is why field-level errors are possible at all.

### `PATCH /api/v1/users/me/settings` — preferences

See 3.3.

### `POST` / `DELETE /api/v1/social/block/{targetUserId}`

See 3.4.

### `PATCH /api/v1/social/follow-requests/{requesterId}/approve` and `/reject`

Act on an incoming follow request. Reachable by any account; only a private account
accumulates them.

### `POST /api/v1/auth/forgot-password`

Body `{email}`. Called with `alice@seed.local` → **200**. Sends a reset link to the address.
This is the **only** password path an authenticated person has, and it is unauthenticated —
it takes an email, not a session.

### `POST /api/v1/auth/logout`, `POST /api/v1/media/upload` + `/upload-complete`

Sign-out, and the pre-signed upload used for avatar and banner.

### What does not exist

Each of these was searched for across all 115 declared paths and is absent:

| Capability | Status |
|---|---|
| Change password while signed in | **absent.** Only `forgot-password` (email loop) and `reset-password` (token). No authenticated change-password endpoint. |
| Change email | **absent.** `email` is rejected by `PATCH /users/me`. |
| Delete or deactivate account | **absent.** No path matches delete/deactivate/close. |
| List or revoke own sessions | **absent** for the account. An administrator can revoke another account's session; a person cannot see their own. |
| Two-factor / MFA | absent |
| Data export / download | absent |
| Theme, language, locale, timezone | absent. Theme is a browser-local preference only. |
| Story-view notification preference | absent. `notify_*` covers likes, comments, follows, mentions, messages — nothing else. |
| Muted or restricted accounts | absent as an account-level list. `mute` exists only per conversation. |
| Close-friends / any second audience list | absent |

---

## 3.3 The settings record

### Shape — `GET /api/v1/users/me/settings`

| Field | Type | Default observed |
|---|---|---|
| `notifyLikes` | boolean | true |
| `notifyComments` | boolean | true |
| `notifyFollows` | boolean | true |
| `notifyMentions` | boolean | true |
| `notifyMessages` | boolean | true |
| `showActivityStatus` | boolean | true |
| `allowStoryReplies` | boolean | true |
| `allowMessageRequests` | boolean | true |
| `updatedAt` | date-time | read-only, server-set |

Eight writable booleans. Nothing else.

### Write semantics — established by calling, not by reading the schema

| Probe | Request | Result |
|---|---|---|
| Is a partial update accepted? | `PATCH {"notifyLikes":false}` | **200.** Response carried `notifyLikes:false` and all seven others unchanged. |
| Does an omitted field survive? | re-read `GET` immediately after | **Yes.** All seven omitted fields retained their prior values. An omitted field is left alone; it is not reset or nulled. |
| What does an empty body do? | `PATCH {}` | **200**, no change, `updatedAt` not advanced. |
| What does an explicit null do? | `PATCH {"notifyComments":null}` | **200**, no change. A null is treated as absent, not as a value. |
| What does an unknown field do? | `PATCH {"notifyLikes":true,"bogusField":"x"}` | **400** `MALFORMED_REQUEST_BODY` "Request body could not be read". The whole request is rejected — the known field is not applied. |

**Conclusion: partial update, omitted means unchanged, unknown field is fatal to the whole
request.** A mutation body must therefore carry only the fields that changed and only
declared names.

---

## 3.4 The blocked list and relationships

### Blocked accounts — readable

`GET /api/v1/social/blocked` with declared query parameters `cursor` (string) and `limit`
(integer, default 20, 1–100). Cursor-paginated, opaque base64 cursors, `pageInfo`
`{hasNextPage, hasPreviousPage, startCursor, endCursor}` plus a `degraded` flag.

A row:

```json
{"user":{"id":"ae6ed5f2-…","username":"seed_carol","displayName":"Seed Carol",
         "avatarUrl":null,"isVerified":false},
 "viewerState":{"isFollowing":false,"isFollowRequested":false,
                "isFollowedBy":false,"isBlocking":true,"hasReported":false}}
```

### Blocking and unblocking — full cycle verified

| Call | Result |
|---|---|
| `POST /social/block/{carol}` | **201** `CREATED` |
| `GET /social/blocked` | carol present, `viewerState.isBlocking:true` |
| `POST /social/block/{carol}` again | **409** `SOCIAL_ALREADY_BLOCKED` "User already blocked" |
| `DELETE /social/block/{carol}` | **204**, empty body |
| `DELETE /social/block/{carol}` again | **404** `NOT_FOUND` "Block relationship not found" |

Unblocking is `DELETE /social/block/{targetUserId}`.

### Other relationship lists a settings screen could own

| List | Endpoint | Owned by settings? |
|---|---|---|
| Incoming follow requests | `GET /social/follow-requests` (+ approve/reject) | **Yes.** It is an audience-control decision about who may see the account's content, and it has no other home in the product. Verified non-empty as `seed_bob`, who is private and holds a pending request from `seed_alice`: row is `{id, follower:{…}, status:"pending", createdAt, viewerState}`, `status` enum `pending`/`accepted`. |
| Followers / following | `GET /social/users/{userId}/followers` and `/following` | **No.** Already owned by the profile screen at its own routes. Duplicating them in settings would mint a second address for the same list. |

---

## 3.5 The cancelled sign-in — reproduced, not reasoned about

Google sign-in is configured well enough locally to reach the consent screen. The flow was
driven in a real browser through Playwright.

### The full chain

1. `GET http://localhost:5173/` — the unified auth page. Pressed **continue with google**.
2. `→ https://accounts.google.com/v3/signin/accountchooser?…` with
   `redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Fapi%2Fv1%2Fauth%2Foauth2%2Fcallback%2Fgoogle`,
   `response_type=code`, `scope=openid email profile`, `state=l-o14hFF…`, PKCE `S256`.
   **The redirect target is the backend, not the frontend.**
3. Selected the signed-in Google account.
4. `→ https://accounts.google.com/signin/oauth/id?…requestPath=/signin/oauth/v3/consent` —
   the consent screen, offering **Huỷ** (cancel) and **Tiếp tục** (continue).
5. Pressed **Huỷ**.
6. `→ GET http://localhost:8080/api/v1/auth/oauth2/callback/google?error=access_denied&state=l-o14hFFMZ_lUnRDKaD8v0pkunq0UvuefBDJ1my4tU8%3D`
   → **HTTP 500**, `content-type: text/html`. **Terminal. No further redirect.**

### What the person ends up looking at

The Spring Boot **Whitelabel Error Page**, served by the backend on `localhost:8080`:

```
Whitelabel Error Page
This application has no explicit mapping for /error, so you are seeing this as a fallback.
Tue Aug 25 07:53:53 GMT+07:00 2026
There was an unexpected error (type=Internal Server Error, status=500).
No message available
java.lang.StackOverflowError
	at org.springframework.core.BridgeMethodResolver.findBridgedMethod(BridgeMethodResolver.java:71)
	at org.springframework.aop.support.AopUtils.invokeJoinpointUsingReflection(AopUtils.java:356)
	at org.springframework.aop.framework.JdkDynamicAopProxy.invoke(JdkDynamicAopProxy.java:215)
	at jdk.proxy4/jdk.proxy4.$Proxy325.authenticate(Unknown Source)
	… (the frame triple repeats for the length of the trace)
```

A **Java stack trace is rendered to the person**, and the recursion means the backend's own
OAuth2 failure handler is never reached.

Browser console at that moment:
`Failed to load resource: the server responded with a status of 500 () @ …/callback/google?error=access_denied…`

Screenshot: `screens/oauth-cancel-BEFORE-backend-error.png`.

### Who serves the page — established, not assumed

**The backend serves it.** Final URL origin is `http://localhost:8080`. The frontend is not
in the chain at any point after step 1, is never redirected to, and has no route, handler or
listener that can observe this. There is no error indication delivered to the frontend
because there is no redirect to the frontend.

### A second, different failure shape

The same callback called **without** the OAuth authorization-request cookie (plain `curl`,
no cookie jar) does reach the failure handler and returns a clean envelope:

| Query | Result |
|---|---|
| `?error=access_denied&state=abc` | **401** `application/json` `{"success":false,"code":"AUTH_TOKEN_INVALID",…}` |
| `?error=access_denied` | 401, same |
| `?code=fakecode123&state=abc` | 401, same |
| `?error=invalid_scope&state=abc` | 401, same |
| (no query at all) | 401, same |

No `Location` header in any case — **no variant redirects to the frontend**.

So the callback has two observed outcomes, and both strand the person on the backend origin:

- **with the real flow cookie (an actual cancellation): HTTP 500, Whitelabel HTML, Java stack trace**
- **without it: HTTP 401, raw JSON envelope**

Neither is a frontend page. The distinction matters only for describing the defect; it does
not change what the frontend can do, which is nothing.

### The other failure modes

| Failure | How produced | Backend response |
|---|---|---|
| Expired or replayed exchange code | `POST /auth/oauth2/exchange {"code":"bogus-code-that-never-existed"}` | **400** `AUTH_OAUTH2_EXCHANGE_CODE_INVALID` "OAuth2 exchange code is invalid or has expired" |
| Missing / blank code | `POST …exchange {}` and `{"code":""}` | **400** `VALIDATION_ERROR`, `data:{"code":"must not be blank"}` |
| Invalid email-verification token | `GET /auth/verify-email?token=badtoken` | **400** `AUTH_VERIFY_TOKEN_INVALID` "Email verification token is invalid or has expired" |
| Invalid password-reset token | `POST /auth/reset-password {"token":"badtoken",…}` | **400** `AUTH_RESET_TOKEN_INVALID` "Invalid or expired reset token" |
| Suspended account signing in | `POST /auth/login` as suspended `seed_alice` | **403** `AUTH_ACCOUNT_INACTIVE` "This account is suspended or deactivated" |

The exchange code is single-use with a 120-second TTL; an expired and a replayed code both
surface as the same `AUTH_OAUTH2_EXCHANGE_CODE_INVALID`, so they are one case to the person,
not two. A network interruption mid-flow was not separately produced — see the limitation
note below.

**These five are reachable by the frontend**, because they are responses to calls the
frontend makes. They are the material for the authentication error work. The cancellation is
not among them.

### Denied scope

Not separately reproducible against this client. Google's consent screen for the requested
scopes (`openid email profile`) offers only cancel or continue — there are no per-scope
checkboxes to decline, because these are the base identity scopes. Declining is therefore the
same act as cancelling and produces the same `error=access_denied`. Recorded as a case that
collapses into cancellation rather than as an untested one.

---

## 3.6 The phone navigation

Walked in a 390 × 844 viewport, signed in as `seed_alice`.

**The bottom bar carries six tabs and none of them is settings.** In source order from
`BOTTOM_TABS`: home, message, post (compose), search (explore), notification, profile. All
six are icon-only, 56px tall, in a fixed glass bar.

**The side rail is the only nav that carries settings, and it does not exist at phone
width.** `LxSideRail` renders for desktop and tablet only. It carries, bottom-anchored, a
`panel` entry (rendered only when `isPanelRole(role)`) directly above a `settings` entry.
That is exactly the arrangement the brief describes: the previous phase placed the panel
entry above a settings entry that the phone navigation does not have.

**How settings is actually reached at phone width:** from the **own-profile screen**, via a
pill button labelled `edit profile` in the profile header, which calls
`navigate(ROUTES.SETTINGS)` (`ProfileScreen.jsx:575`). It is an `LxBtn variant="secondary"
size="sm"`. It is the only route into settings at that width.

Screenshot: `screens/phone-nav-BEFORE-profile-entry.png`.

**Therefore the phone entry point to the panel belongs beside that pill**, as a sibling
control of the same shape in the same profile header row — that being "however settings is
actually reached at that width". Placing it in the bottom bar was rejected: the bar is a
six-slot primary-destination row with no settings slot to sit adjacent to, and adding a
seventh icon-only slot visible to two roles out of three would reflow the bar per-role.

Role is sourced from `useAuthStore((s) => s.role)` through `isPanelRole()`, held in memory
only and absent until the session is established. It therefore reads false first and turns
true once the role arrives — the entry appears late for a privileged account rather than
appearing for an ordinary one and then vanishing.

Incidental finding: that pill is labelled `edit profile` but navigates to the settings
index, not to the profile editor. Recorded in `deferred-findings.md`.

---

## Inventory table — every setting the backend supports

This table is the input to the grouping. A row exists only where a real endpoint backs it.

| Setting | Read by | Written by | Constraints / refusals |
|---|---|---|---|
| username | `GET /users/me` `.username` | `PATCH /users/me` `{username}` | 3–30; letters, digits, `_`, `.`; 409 `USER_USERNAME_ALREADY_EXISTS` if taken |
| display name | `GET /users/me` `.displayName` | `PATCH /users/me` `{displayName}` | 0–100 |
| bio | `GET /users/me` `.bio` | `PATCH /users/me` `{bio}` | 0–500 |
| avatar | `GET /users/me` `.avatarUrl` | `PATCH /users/me` `{avatarUrl}` after `POST /media/upload` + `/upload-complete` | URL ≤ 2048; image mime and ≤ 100 MB per `/media/constraints` |
| banner | `GET /users/me` `.bannerUrl` | `PATCH /users/me` `{bannerUrl}` | same as avatar |
| website | `GET /users/me` `.websiteUrl` | `PATCH /users/me` `{websiteUrl}` | ≤ 2048; **no server-side format check** |
| private account | `GET /users/me` `.isPrivate` | `PATCH /users/me` `{isPrivate}` | boolean |
| notify likes | `GET /users/me/settings` `.notifyLikes` | `PATCH /users/me/settings` | boolean; partial |
| notify comments | `…​.notifyComments` | `PATCH /users/me/settings` | boolean; partial |
| notify follows | `…​.notifyFollows` | `PATCH /users/me/settings` | boolean; partial |
| notify mentions | `…​.notifyMentions` | `PATCH /users/me/settings` | boolean; partial |
| notify messages | `…​.notifyMessages` | `PATCH /users/me/settings` | boolean; partial |
| show activity status | `…​.showActivityStatus` | `PATCH /users/me/settings` | boolean; partial |
| allow story replies | `…​.allowStoryReplies` | `PATCH /users/me/settings` | boolean; partial |
| allow message requests | `…​.allowMessageRequests` | `PATCH /users/me/settings` | boolean; partial |
| blocked accounts | `GET /social/blocked` (`cursor`, `limit`) | `DELETE /social/block/{id}` to unblock | 204 on success; 404 if not blocked |
| incoming follow requests | `GET /social/follow-requests` (`cursor`, `limit`) | `PATCH /social/follow-requests/{id}/approve` \| `/reject` | — |
| warnings received | `GET /users/me/warnings` (`cursor`, `limit`) | none — read-only | `reasonKey` resolves via `/config/vocabularies` |
| verified badge | `GET /users/me` `.isVerified` | none — read-only | information only |
| account created | `GET /users/me` `.createdAt` | none — read-only | information only |
| email address | `GET /users/me` `.email` | none — read-only; `PATCH` rejects the field | information only |
| password | not readable | `POST /auth/forgot-password {email}` — sends a reset link | 200 regardless; no authenticated change endpoint |
| sign out | — | `POST /auth/logout` | — |

**Twenty-three rows. Everything a settings screen may render comes from this table.**

---

## Defects found in the current implementation while verifying

Recorded here because they were found by this work; each is acted on or deferred in the
documents named.

1. **`delete account` is a red button wired to nothing.** `SettingsScreen.jsx` renders it
   with no `onClick` at all, and no delete endpoint exists. Removed this phase.
2. **`story views` is a permanently disabled toggle labelled "coming soon".** No backing
   field. Removed this phase.
3. **`help center`, `terms & privacy`, `about luvax`** are rows with `onClick={() => {}}`.
   Removed this phase.
4. **`change password` opens a 41-line "coming soon" stub.** Replaced this phase with the
   real `forgot-password` action.
5. **The email row's verified indicator never reflects reality.** It reads
   `currentUser?.isVerified` from the auth store, but the store's user carries
   `emailVerified`, not `isVerified` — so the suffix never renders, while a green check icon
   renders unconditionally regardless of state. Corrected this phase.
6. **The profile pill labelled `edit profile` navigates to the settings index.** Deferred.

## What could not be verified

- **A network interruption mid-OAuth-flow.** Producing a genuine transport failure between
  Google and the backend callback is not something the tooling here can stage; killing the
  backend mid-flow produces a browser-level connection error page on the backend origin,
  which is the same class of unreachable-frontend outcome already recorded in 3.5 and adds
  nothing new. Not claimed as tested.
- **A replayed exchange code using a genuinely issued code.** A real successful sign-in was
  not completed (cancelling was the object of the exercise), so replay was exercised with a
  fabricated code, which the server answers with the same
  `AUTH_OAUTH2_EXCHANGE_CODE_INVALID` as an expired one. The code path is shared; the
  distinction is not observable to a client.
