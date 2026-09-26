# Verification Evidence

> Record of work done on 2026-08-01. Not maintained; it is correct as of that date and is not updated as the code moves.

Browser-level before and after for every fix that has a user-reachable path, plus the `curl` evidence behind each contract claim.

Environment: backend `450212e` on `develop` at `http://localhost:8080`, Vite dev server at `http://localhost:5173`, PostgreSQL, Redis, RabbitMQ, and Elasticsearch running from `docker-compose`.

The "before" captures were taken by stashing the branch, exercising the flow in the browser, then restoring.
They are real observations, not reconstructions.

---

## 1. Login

### Before

Navigated to `/login`, entered valid credentials for a verified account, clicked "log in".

Network:

```
POST http://localhost:5173/api/v1/auth/login => [400] Bad Request
```

The page stayed on the login form and rendered the backend's parser message directly:

```
paragraph: Request body could not be read
```

That string is the user-facing state of the application before this branch.
No account could log in.

### After

Same flow, same credentials.

```
POST /api/v1/auth/login          => [200] OK
GET  /api/v1/social/follow-requests    => [200] OK
GET  /api/v1/notifications/unread-count => [200] OK
GET  /api/v1/posts/feed?limit=10       => [200] OK
```

Page URL moved to `/app` and the feed rendered: the story strip, the "today" divider, and the right rail with its trending list.

### Login by username

Cleared storage, returned to `/login`, entered `ctest.user1` rather than the email address.

Result: `/app`, feed reached.
Both identifier forms work through the browser.

### curl backing

```
{"email":"nobody@example.com","password":"Password1"}
400 {"code":"MALFORMED_REQUEST_BODY"}

{"identifier":"ctest.user1@example.com","password":"lowercaseonly"}
200 accessToken + refreshToken, user id 35c650e6-e881-4bde-9d24-dfc7dae8a293

{"identifier":"ctest.user1","password":"lowercaseonly"}
200 accessToken + refreshToken, same user id
```

---

## 2. Registration

### Before

Not separately captured in the browser.
Registration already sent the correct wire shape, so the request itself succeeded before this branch.
What failed was client-side: the form refused valid values before any request was made.

### After

Navigated to `/register`.
The form already presented username, display name, email address, and password.

Submitted deliberately chosen values that the old schema rejected and the backend accepts:

| Field | Value | Old client rule |
|-------|-------|-----------------|
| username | `browser.reg1` | rejected: dot not in `^[a-zA-Z0-9_]+$` |
| password | `alllowercase` | rejected: no uppercase, no digit |

Network:

```
POST /api/v1/auth/register => [201] Created
```

Navigated to `/verify-email-notice`.

The same two values are the ones proven acceptable by the `curl` registration in `auth-contract.md`, so the form and the server now agree.

---

## 3. Unverified email

### Before

The handler compared `data.errorCode` against `EMAIL_NOT_VERIFIED`.
The envelope carries `code`, and the value is `AUTH_EMAIL_NOT_VERIFIED`.
Neither half matched, so the branch was dead and an unverified user fell through to the generic error path.

### After

Logged in with the account just registered, which has not verified its email.

```
POST /api/v1/auth/login => [403]
```

Navigated to `/verify-email-notice`, which rendered:

```
heading:   check your inbox.
paragraph: we sent a verification link to your email address. click the link to activate your account.
textbox:   browser.reg1@example.com
button:    resend verification email
link:      sign in
```

The message is non-technical, the address is prefilled, and the resend control is present and wired to `POST /auth/verify-email/resend`, which the contract document confirms returns `200`.

### curl backing

```
{"identifier":"unverified1","password":"password123"}
403 {"code":"AUTH_EMAIL_NOT_VERIFIED","message":"This account's email address has not been verified"}
```

---

## 4. Suggested users

### Before

The right rail called `GET /users/suggestions` on every feed and explore render.

```
GET /users/suggestions
400 {"code":"BAD_REQUEST","message":"Invalid request"}
```

The literal `suggestions` is captured by `GET /users/{userId}` and fails UUID conversion.

### After

Feed, with dev tools open:

```
POST /api/v1/auth/login                 => [200]
GET  /api/v1/social/follow-requests     => [200]
GET  /api/v1/notifications/unread-count => [200]
GET  /api/v1/posts/feed?limit=10        => [200]
```

Explore:

```
GET /api/v1/posts/search?q=a&limit=10   => [200]
GET /api/v1/social/blocked?limit=20     => [200]
GET /api/v1/notifications/unread-count  => [200]
```

No request to `/users/suggestions` remains on either screen, and no request on either screen fails.

The right rail still renders its trending section, so it did not become visually empty and no empty state was required.

---

## 5. Blocked users

### Before

The list was read from `localStorage` under `lx_blocks_{userId}`, written by the mutation regardless of the server's answer.
Clearing browser storage emptied the list while the server-side block remained in force, which is precisely the divergence the rule against duplicating server state exists to prevent.

The per-row `useUserProfile(userId)` lookup could never resolve, because `GET /users/{blockedId}` returns 404 to the blocker.

### First attempt after the change, which failed

```
GET /social/blocked?cursor=%5Bobject+Object%5D&limit=20 => [400] Bad Request
GET /social/blocked?cursor=%5Bobject+Object%5D&limit=20 => [400] Bad Request
```

Settings showed "blocked users 0 blocked" while the server held one block.

Cause: `queryFn` was passed by reference, so TanStack Query's context object arrived as the cursor argument.
Fixed by wrapping the call.

This is recorded rather than quietly corrected, because the code read correctly and only the browser revealed it.

### After

```
GET /api/v1/social/blocked?limit=20 => [200] OK
```

Settings row: `blocked users  1 blocked`.

Blocked list screen:

```
1 blocked user
  Target User
  @target.user
  [unblock]
```

The display name and handle come from the server response, which the previous implementation could not have obtained.

Unblock:

```
DELETE /api/v1/social/block/49d7a0dc-d350-4edc-8483-ffb61c92f58c => [204] No Content
GET    /api/v1/social/blocked?limit=20                           => [200] OK
```

Screen: `No blocked users`.

Database confirms the same:

```
SELECT blocker_id, blocked_id FROM blocks;
(0 rows)
```

### Server as the source of truth across a fresh session

Logged out, logged in again as the same account in a clean session.
The blocked screen fetched `GET /social/blocked` and rendered "No blocked users", matching the database rather than any client-side remnant.

This is the property that matters: the list is derived from the server on every load, so two browsers cannot disagree.

**Not verified as specified**: the brief asks for a hard refresh and a second browser profile.
A hard refresh cannot preserve the session in this application, because both tokens are held in memory only and are deliberately never persisted.
Reloading returns the user to the login screen regardless of this change.
The equivalent property was verified by re-authenticating in a clean session, which exercises the same server round trip.
The in-memory token design is pre-existing and is recorded in `deferred-findings.md`.

### curl backing

```
POST /social/block/{target}   201 CREATED
GET  /social/blocked          200 content[0].user = {id, username: "target.user", displayName: "Target User", avatarUrl: null, isVerified: false}
DELETE /social/block/{target} 204
GET  /social/blocked          200 content: []
```

---

## 6. A failed block surfaces as a failure

### Before

The mutation caught every error, logged the raw object with `console.warn`, and then wrote the block to `localStorage` as though it had succeeded.
A rejected block was indistinguishable from an accepted one.

### After

The `try/catch` is gone, so the error reaches the caller, and three surfaces render it: an inline alert on `PostCard`, a message inside the confirm modal on `PostDetailScreen`, and a message on the unblock row in `BlockedUsersScreen`.

Two reproducible server rejections back this:

```
POST /social/block/{self}            400 {"code":"SOCIAL_SELF_BLOCK","message":"You cannot block yourself"}
POST /social/block/{alreadyBlocked}  409 {"code":"SOCIAL_ALREADY_BLOCKED","message":"User already blocked"}
```

**Scope of the browser verification**: the unblock failure path renders on a screen that was exercised end to end.
The two block failure surfaces were verified by reading the rendered condition and by confirming the mutation no longer swallows errors, together with the `curl` evidence above.
Driving a 409 through `PostCard` in the browser requires a post from a blockable author in the feed, and the feed rendering path is currently broken by a separate defect described in `deferred-findings.md`.
That is stated plainly rather than claimed as verified.

---

## 7. Post status

No browser evidence, because there is no browser path.

`updatePostStatus` is called only by `useUpdatePostStatus`, and that hook has no call site in any screen.
The field name was corrected from `status` to `targetStatus` against the backend record, and the endpoint remains unreachable from the interface.

---

## 8. Design reference extraction

Verified against the committed copy at `docs/design/Luvax.html`, not the desktop original.

```
cmp Luvax.html docs/design/Luvax.html   -> identical
manifest entries: 29
Counter({'font/woff2': 17, 'image/jpeg': 6, 'application/javascript': 3, 'text/javascript': 3})

ed9a0c12... ->  176988 B  "(function(){var s=document.createElement('style');..."
9bffeb59... ->   30633 B  "// lx-additions.js - LxMenu, ReportModal, CommentModal, Lx..."
3b513cf1... ->   44507 B  "// lx-messages.js - Luvax Web Messages screen..."
3d3fd702... ->   62106 B  design-tool runtime
52133e6d... ->   10751 B  react.production.min.js
5d30086c... ->  131835 B  react-dom.production.min.js
```

The three Luvax chunk sizes match those recorded during reconnaissance exactly, so the committed copy is the same artefact and the documented procedure still works.

---

## 9. Lint

`npm run lint` does not pass, and it did not pass before this branch.
The claim is not made.

Measured by stashing the branch and running the same command:

| | Problems | Errors |
|---|---|---|
| Before this branch | 9,900 | 9,864 |
| After this branch | 9,464 | 9,428 |

Breakdown after:

| Count | Rule | Message |
|-------|------|---------|
| 9,306 | `prettier/prettier` | ``Delete `␍` `` |
| 158 | mixed | genuine formatting and unused-variable findings across 23 files |

The dominant cause is a repository-wide configuration conflict, not code:

- `git config core.autocrlf` is `true`, so files are checked out with CRLF on Windows.
- There is no `.gitattributes`.
- `.prettierrc` sets `"endOfLine": "lf"`.

Every checked-out line therefore violates the formatting rule on a Windows working copy.
Clearing it means either adding `.gitattributes` and renormalising the tree, or changing the `endOfLine` setting.
Both are repository-wide changes far outside this phase's stated scope, and either would produce a diff an order of magnitude larger than the size budget this branch was told to stay within.

The files this branch touched were checked individually.
They introduce no new rule violations beyond the patterns already present in the surrounding code, and one genuine breakage introduced mid-change, an undefined `currentUser` in `SettingsScreen`, was caught by this check and fixed before commit.

This is reported as a finding rather than actioned.
It is recorded in `deferred-findings.md`.

---

## 10. Backend untouched

```
$ git status
On branch develop
Your branch is up to date with 'origin/develop'.

nothing to commit, working tree clean

$ git log --oneline -1
450212e Merge pull request #142 from zentech-graduation/fix/common/api-contract-and-security-hardening
```

The backend was read and exercised, never modified.
