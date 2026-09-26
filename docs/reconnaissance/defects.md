# Defects

> Record of work done on 2026-08-01. Not maintained; it is correct as of that date and is not updated as the code moves.

Everything observed during the audit that is wrong, inconsistent, or will cause a failure.

Nothing here was fixed.

Severity:

- **critical** - blocks the demo or loses data.
- **high** - a user-visible failure or a correctness bug.
- **medium** - wrong behaviour in a case that is reachable but not on the main path.
- **low** - inconsistency, dead code, or stale documentation.

"Frozen" marks the landing page and the six authentication pages, which must not be modified.

## Critical

### D1. Login through the user interface always fails with 400

**Severity: critical. Frozen area: yes.**

Location:

- `src/api/authApi.js:93-103`
- `src/features/auth/utils/authSchemas.js:23-26`
- `src/features/auth/components/AuthPage.jsx:463-464`

The login form collects a field named `email` and `authApi.login` posts
`{ email, password }`.
The backend's `LoginRequest` declares `identifier` and `password`, and rejects the unknown field.

Reproduction, in a browser against the running application:

1. Open `http://localhost:5173/`.
2. Enter a valid, email-verified account and its password.
3. Press "log in".

```
POST http://localhost:5173/api/v1/auth/login  =>  [400] Bad Request
console: Failed to load resource: the server responded with a status of 400 (Bad Request)
```

Reproduction with `curl`, isolating the payload from the UI:

```
POST /api/v1/auth/login   {"email":"luvax_ava@example.com","password":"ReconPass123!"}
400 {"success":false,"code":"MALFORMED_REQUEST_BODY","message":"Request body could not be read"}

POST /api/v1/auth/login   {"identifier":"luvax_ava@example.com","password":"ReconPass123!"}
200 {"success":true,"code":"OK","data":{"accessToken":"...","refreshToken":"...", ...}}
```

The visible label already reads "username or email", and the backend resolves the account type by
the presence of `@`, so only the wire field name is wrong.
Renaming the posted key to `identifier` is the whole fix.

No part of the authenticated application can be reached through the UI until this is resolved.
Because it is in a frozen area, somebody has to decide whether the freeze admits an exception.
See `open-decisions.md`.

## High

### D2. Post status update sends the wrong field name

**Severity: high. Frozen area: no.**

Location: `src/services/post.service.js:83-85`.

```js
axiosInstance.patch(`${POST_API_PATH}/${postId}/status`, { status });
```

The backend's `PostStatusTransitionRequest` declares `targetStatus`.

```
PATCH /api/v1/posts/{id}/status   {"status":"archived"}
400 {"success":false,"code":"MALFORMED_REQUEST_BODY","message":"Request body could not be read"}

PATCH /api/v1/posts/{id}/status   {"targetStatus":"archived"}
200 {"success":true,"code":"OK","data":{ ... "status":"archived" ... }}
```

`useUpdatePostStatus` therefore cannot succeed.
Archiving and restoring a post is dead on arrival.

### D3. The right rail calls an endpoint that does not exist

**Severity: high. Frozen area: no.**

Location: `src/services/social.service.js:69-71`, consumed by
`src/features/luvax/components/shell.jsx`.

```js
axiosInstance.get(`${USERS_API_PATH}/suggestions`);
```

There is no `/users/suggestions` endpoint.
`GET /users/{userId}` matches the path, `"suggestions"` fails UUID conversion, and the request
returns 400.

```
GET /api/v1/users/suggestions
400 {"success":false,"code":"BAD_REQUEST","message":"Invalid request","data":null}
```

The right rail renders on feed and explore at tablet and desktop widths, so this failing request
fires on most screens.

This is the real content of the "route collision" that was reported as a Spring warning.
There is no Spring warning; the backend startup log contains no ambiguous-mapping notice.
The declaration order in `UserController` is fine: Spring's pattern comparator prefers a literal
segment over a template one, and `GET /users/search?q=` was verified to resolve correctly.

Since the backend is read-only, deleting the frontend call is the only available fix.

### D4. The blocked-users list is kept in localStorage instead of read from the server

**Severity: high. Frozen area: no.**

Location:

- `src/features/luvax/hooks/useSocial.js:99-115` and `:129-140`
- `src/features/luvax/components/BlockedUsersScreen.jsx:35`, `:38`
- `src/features/luvax/components/SettingsScreen.jsx:85`
- `src/features/luvax/components/shell.jsx:265`, `:267`

`useBlock` calls the API and then records the blocked id in `localStorage` under
`lx_blocks_{userId}`. Every reader of the blocked list reads that key.
`GET /social/blocked` exists, works, and is never called.

Reproduction:

1. Block a user in browser A.
2. Open the application in browser B, or clear site data in browser A.
3. The blocked-users screen is empty, while the block is still in force server-side.

This is worse than an ordinary cache staleness bug because
`GET /users/{blockedId}` returns **404 for the blocker as well**, verified.
The blocked-users list is the only surface on which a blocked account is visible to the person who
blocked them, so an empty list means the block cannot be undone from the UI at all.

### D5. Block and unblock swallow API errors and then report success

**Severity: high. Frozen area: no.**

Location: `src/features/luvax/hooks/useSocial.js:89-98` and `:119-128`.

```js
mutationFn: async (targetUserId) => {
  try {
    const res = await socialService.blockUser(targetUserId);
    return res;
  } catch (err) {
    // Ignore error if already blocked (e.g. 409, 400)
    console.warn('Block user API error, ignoring:', err);
  }
},
```

The `catch` returns `undefined`, so the mutation resolves and `onSuccess` runs regardless of what
the server did.
A network failure, a 401, or a 500 all produce the same visible outcome as a successful block.

The comment says the intent was to tolerate a duplicate 409, which is reasonable, but the
implementation tolerates everything.
This also violates the project rule that optimistic updates must roll back on failure.

### D6. Text posts render at the wrong font size because of a case mismatch

**Severity: high. Frozen area: no.**

Location: `src/features/luvax/components/PostCard.jsx:317`.

```js
fontSize: post.postType === 'TEXT' || post.type === 'text' ? 18 : 14
```

The backend returns `"postType": "text"`, lowercase, and there is no `type` field on the response.
Neither branch matches.

Every text post renders at 14 instead of the intended 18.
The design specifies 16, so both the intent and the design are missed.

Reproduction: create a text post, observe the caption renders at the media-post size.

## Medium

### D7. Email verification cannot be completed through the API in a local environment

**Severity: medium. Frozen area: yes, the verification page.**

Registration succeeds but login is refused until the address is verified:

```
POST /api/v1/auth/login  {"identifier":"recon_alice@example.com","password":"..."}
403 {"success":false,"code":"AUTH_EMAIL_NOT_VERIFIED",
     "message":"This account's email address has not been verified"}
```

The token is delivered only by email, and the mail provider rejects the domain:

```
ERROR c.a.m.m.s.impl.ResendMailSender | Failed to send email | subject: Welcome to Social |
error: Failed to send email: 422 {"statusCode":422,"name":"validation_error",
"message":"Invalid `to` field. Please use our testing email address instead of domains like
`example.com`. See our documentation for more information."}
```

The token is stored in Redis under `auth:token:email-verification:{sha256}`, so it cannot be
recovered from the store either.

There is no HTTP endpoint that verifies an address without the token.
Any account provisioning therefore requires one direct database write, which is why the seed script
stops and reports rather than proceeding.
See `seed-data.md`.

Note also the email subject is **"Welcome to Social"**, not "Welcome to Luvax".
`MAIL_APP_NAME` is set to `luvax` in `.env`, so the template is not using it consistently.

### D8. Block returns 404 on profiles but 403 on posts

**Severity: medium. Frozen area: no. Backend, read-only.**

`ViewerRelationshipResponse` documents a deliberate stealth block model: a blocked viewer must not
be able to distinguish "this account does not exist" from "this account has blocked me".

The profile endpoint honours that:

```
GET /api/v1/users/{blockerId}   as the blocked user   ->  404 NOT_FOUND
```

The post endpoint does not:

```
GET /api/v1/posts/{blockerPostId}   as the blocked user   ->  403 POST_FORBIDDEN
                                                              "You do not have access to this post"
```

403 confirms the post exists and that access is specifically denied, which is the disclosure the
stealth model is designed to prevent.
Verified in both directions.

Recorded, not fixed: the backend is read-only.

### D9. An unsupported HTTP method returns 400 instead of 405

**Severity: medium. Frozen area: no. Backend, read-only.**

```
POST /api/v1/social/follow-requests/{id}/approve
400 {"success":false,"code":"BAD_REQUEST","message":"HTTP method not supported: POST"}
```

The correct status is `405 Method Not Allowed`, with an `Allow` header.
Returning 400 makes a client-side method error indistinguishable from a validation error.

### D10. Inconsistent response conventions on delete-shaped endpoints

**Severity: medium. Frozen area: no. Backend, read-only.**

| Endpoint | Observed |
|----------|----------|
| `DELETE /posts/{id}` | `204`, no body |
| `DELETE /posts/{id}/save` | `204`, no body |
| `DELETE /social/follow/{id}` | `204`, no body |
| `DELETE /social/block/{id}` | `204`, no body |
| `DELETE /posts/{id}/like` | `200`, full envelope with `{postId, liked, likeCount}` |
| `DELETE /comments/{id}` | `200`, envelope with `data: null` |
| `DELETE /comments/{id}/like` | `200`, envelope with `data: null` |

A client cannot apply one rule.
The like endpoints returning a fresh counter is genuinely useful; the comment endpoints returning a
null-data 200 rather than 204 is just inconsistent.

### D11. Comment like returns no counter, unlike post like

**Severity: medium. Frozen area: no. Backend, read-only.**

`POST /posts/{id}/like` returns `{postId, liked, likeCount}`.
`POST /comments/{id}/like` returns `data: null`.

Every comment like therefore forces a refetch to display the new count, or an optimistic increment
that the rules elsewhere warn against.

### D12. Liking your own comment is forbidden but liking your own post is allowed

**Severity: medium. Frozen area: no. Backend, read-only.**

```
POST /api/v1/comments/{ownCommentId}/like
403 {"success":false,"code":"COMMENT_FORBIDDEN",
     "message":"You do not have permission to perform this action on the comment"}

POST /api/v1/posts/{ownPostId}/like
201 {"success":true,"code":"CREATED","data":{"postId":"...","liked":true,"likeCount":1}}
```

Confirmed in `CommentServiceImpl.likeComment`, which throws when
`comment.getUserId().equals(actorId)`.
`PostService` has no equivalent guard.

Whichever rule is intended, the two should agree.
Until then any comment like UI must hide or disable the control on the viewer's own comments, and
the error message is misleading: it says "you do not have permission" rather than "you cannot like
your own comment".

### D13. Raw error objects are logged to the console on a production code path

**Severity: medium. Frozen area: no.**

Location: `src/features/luvax/hooks/useSocial.js:95` and `:127`.

```js
console.warn('Block user API error, ignoring:', err);
```

The axios error object carries the full request configuration, including the
`Authorization: Bearer` header.
Project rule 8 forbids logging tokens or sensitive headers in production code.

### D14. `createdAt` and `updatedAt` differ on a freshly created post

**Severity: medium. Frozen area: no. Backend, read-only.**

```
"createdAt": "2026-08-06T16:13:56.231425Z",
"updatedAt": "2026-08-06T16:13:58.765358Z"
```

A database trigger touches the row after insert, so the two timestamps are 2.5 seconds apart on a
post that has never been edited.
Any client that infers "edited" from `createdAt !== updatedAt` will mark every post as edited.

### D15. `upload-complete` accepts an object that was never uploaded

**Severity: medium. Frozen area: no. Backend, read-only.**

`POST /media/upload-complete` was called with a `storageKey` for which no bytes were ever
transferred to R2, and returned `201` with a `cdnUrl`.

This is consistent with the documented "no server-side media inspection at upload time" policy, but
it means a client bug or an interrupted upload silently produces a post whose media 404s in the
browser, with no signal anywhere.

### D16. The media upload omits a header the backend declares as required

**Severity: medium. Frozen area: no.**

Location: `src/features/luvax/hooks/useMediaUpload.js:68-71`.

`POST /media/upload` returns:

```json
"requiredHeaders": {"content-type": "image/jpeg", "content-length": "1048576"}
```

The client sends only `Content-Type`.
It works because a browser sets `Content-Length` automatically for a `File` body, but the code
relies on that rather than on the contract, and the pre-signed URL is signed over both headers.

## Low

### D17. `lucide-react` is a declared dependency with zero imports

**Severity: low. Frozen area: no.**

`package.json:22` declares `"lucide-react": "^1.16.0"`.
A grep across `src/` for `from 'lucide-react'` returns nothing.
The frontend already has its own inline-SVG `LxIcon` at `src/components/ui/lx-icon.jsx`.

### D18. `ROUTES.PROFILE` points at a route that does not exist

**Severity: low. Frozen area: no.**

`src/config/constants.js:22` declares `PROFILE: '/profile'`.
No such route is registered in `src/routes/index.jsx`.
Navigating there renders `NotFoundPage`.

### D19. Two routes for the OAuth callback

**Severity: low. Frozen area: yes.**

`src/routes/index.jsx:69-75` registers both `/oauth2/callback` and `/oauth/callback` for the same
component.
`VITE_GOOGLE_REDIRECT_PATH` uses only `/oauth2/callback`.

### D20. Dead mock exports

**Severity: low. Frozen area: no.**

`FEED_POSTS` and `REPLIES` in `src/features/luvax/constants/data.js` are exported and imported
nowhere.

### D21. `ChangePasswordScreen` calls nothing

**Severity: low. Frozen area: no.**

`src/features/luvax/components/ChangePasswordScreen.jsx` renders a form and uses no hook and no
service.

### D22. `VITE_APP_NAME` is a placeholder

**Severity: low. Frozen area: no.**

`.env` sets `VITE_APP_NAME=MyApp` rather than `Luvax`.

### D23. Structural documentation is badly stale in both repositories

**Severity: low. Frozen area: no.**

| Document | Claim | Reality |
|----------|-------|---------|
| Workspace `.claude/rules/STRUCT.md` | "`users`, `social`, `media`, `post`, `comment`, `hashtag`, `story`, `notification`, `message`, `report`, `admin`, `recommendation`: Empty scaffolds" | All implemented, with controllers, services, and DTOs |
| Workspace `.claude/rules/STRUCT.md` | "Flyway (18 migrations, V01-V18)" | 44 migrations, at `V44` |
| Workspace `.claude/rules/GLOBAL_RULES.md` | "No Elasticsearch in v1; username/hashtag search uses PostgreSQL `pg_trgm`" | Elasticsearch 9.0.3 in `docker-compose.yaml`, `spring-boot-starter-data-elasticsearch` in the pom, and post search is served by it |
| Workspace `.claude/rules/GLOBAL_RULES.md` | "Notifications: No real-time WebSocket delivery in v1. Clients must poll" | A STOMP WebSocket notification topic exists and is enabled in the dev profile |
| Frontend `.claude/rules/struct.md` | Lists `LoginPage.jsx`, `useAuth.js`, `assets/hero.png`, a `features/dashboard` slice | None of these exist |
| Frontend `.claude/rules/struct.md` | Describes `src/components/ui/` as four shadcn primitives | Also contains `lx-avatar.jsx`, `lx-dropdown-menu.jsx`, `lx-icon.jsx` |
| Frontend `.claude/rules/struct.md` | Does not mention `features/messages`, `features/search`, `config/tokens.js`, or 14 of the current screens | All present |

Anyone reading these to orient themselves will be misled about what exists.

### D24. `Luvax.html` is not in version control

**Severity: low, rising to high if the machine is lost. Frozen area: no.**

The design conformance target is defined by a 1,071,864-byte file at
`C:\Users\minhg\OneDrive\Desktop\Luvax.html`, outside both repositories and outside any git
history. A search of both working trees and of the full git history in both repositories found no
copy.

### D25. Backend startup emits three CGLIB proxy warnings

**Severity: low. Frozen area: no. Backend, read-only.**

```
WARN o.s.aop.framework.CglibAopProxy | Public final method
[public final void org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService
.setClaimTypeConverterFactory(java.util.function.Function)] cannot get proxied via CGLIB,
consider removing the final marker or using interface-based JDK proxies.
```

Three of these, for `setClaimTypeConverterFactory`, `setOauth2UserService`, and
`setRetrieveUserInfo`.
They are framework noise from proxying `OidcUserService` and are the only warnings in an otherwise
clean startup.

For completeness: no ambiguous-mapping warning, no missing-bean warning, and no error appears
anywhere in the startup log. 44 migrations applied in 0.803 seconds and the application started in
26.1 seconds.

### D26. Feature flags for realtime are hardcoded in yaml rather than driven by environment

**Severity: low. Frozen area: no. Backend, read-only.**

`COMMENT_LIVE_ENABLED` and `NOTIFICATION_LIVE_ENABLED` appear in `.env.example` and are read by
`application.yaml`, both defaulting to `false`.
`application-dev.yml` then hardcodes `app.comment.live.enabled: true` and
`app.notification.live.enabled: true`, overriding the environment entirely.

Setting the environment variable in a dev environment has no effect, which is surprising and will
waste somebody's afternoon.

### D27. Inconsistent field naming between hashtag search and hashtag trending

**Severity: low. Frozen area: no. Backend, read-only.**

`GET /hashtags/search` returns items keyed `id`.
`GET /hashtags/trending` returns items keyed `hashtagId`.
Same entity, two names.

### D28. `mediaType` casing differs between request and response

**Severity: low. Frozen area: no. Backend, read-only.**

`POST /media/upload` and `POST /media/upload-complete` accept `"mediaType": "IMAGE"`, uppercase.
Every response, including `upload-complete`'s own, returns `"mediaType": "image"`, lowercase.
Every other enum on the wire is lowercase in both directions.

## Not defects

Recorded so nobody re-investigates them.

- **`GET /users/search` is not shadowed by `GET /users/{userId}`.** Declaration order in
  `UserController` puts `/search` after `/{userId}`, which looks wrong, but Spring's `PathPattern`
  comparator prefers a literal segment over a template segment regardless of declaration order.
  Verified at runtime.
- **`npm run lint` is clean.** Zero errors, zero warnings across all 80 source files.
- **No console errors on the landing or auth page** before submission. Three console messages, none
  at warning level or above.
- **The direct `axios.put` in `useMediaUpload`** technically violates the project rule against
  calling axios directly, but it is correct: the pre-signed R2 upload must not carry the
  application's `Authorization` header, and the shared client's interceptor would add it.
