# Changes Applied

> Record of work done on 2026-08-01. Not maintained; it is correct as of that date and is not updated as the code moves.

One entry per change.
Each states what was wrong, the evidence it was wrong, what changed, and the file touched.

---

## 1. Login posted the wrong field name

**Wrong**: `authApi.login` sent `{ email, password }`.
The backend request record `LoginRequest` declares `{ identifier, password }`.

**Evidence**:

```
POST /auth/login {"email":"nobody@example.com","password":"Password1"}
400 {"code":"MALFORMED_REQUEST_BODY","message":"Request body could not be read"}
```

Reproduced through the browser with valid credentials.
The form showed "Request body could not be read" and no one could log in.

**Changed**: the request body now sends `identifier`, accepting either `values.identifier` or a legacy `values.email` from the caller.
Added `normalizeIdentifier`, which trims always and lowercases only when the value contains `@`, matching the discriminator the server itself uses.
Usernames are left as typed.

**File**: `src/api/authApi.js`

---

## 2. Reset password sent a field the endpoint rejects

**Wrong**: `authApi.resetPassword` sent `{ token, email, newPassword }`.
`ResetPasswordRequest` is annotated `@JsonIgnoreProperties(ignoreUnknown = false)` and declares only `{ token, newPassword }`.

**Evidence**:

```
POST /auth/reset-password {"token":"abc","email":"a@b.com","newPassword":"password123"}
400 {"code":"MALFORMED_REQUEST_BODY"}

POST /auth/reset-password {"token":"abc","newPassword":"password123"}
400 {"code":"AUTH_RESET_TOKEN_INVALID"}
```

The second call reaches token validation.
The first never parses.
Password reset could not have succeeded with any token.

**Changed**: removed `email` from the body.

**File**: `src/api/authApi.js`

Not listed in the task brief.
Found by reading the request record.

---

## 3. The unverified-email branch could never be taken

**Wrong**: the login error handler read `error.response.data.errorCode` and compared it to `'EMAIL_NOT_VERIFIED'`.
The envelope has no `errorCode` field, and the value is `AUTH_EMAIL_NOT_VERIFIED`.

**Evidence**:

```
POST /auth/login {"identifier":"unverified1","password":"password123"}
403 {"success":false,"code":"AUTH_EMAIL_NOT_VERIFIED","message":"This account's email address has not been verified"}
```

Both the field name and the compared value were wrong, so an unverified user fell through to the generic error path.

**Changed**: reads `data.code` and compares against `AUTH_EMAIL_NOT_VERIFIED`.
The email passed forward to the notice screen is now guarded, because the identifier may be a username, in which case there is no address to prefill.

**File**: `src/features/auth/components/AuthPage.jsx`

---

## 4. Client validation was stricter than the server

**Wrong**: the username pattern excluded dots.
The password rule required an uppercase letter and a digit and had no maximum.

**Evidence**: a single registration proves both.

```
POST /auth/register {"username":"ctest.user1","email":"...","password":"lowercaseonly","displayName":"C Test"}
201 CREATED
```

The username contains a dot and the password has neither an uppercase letter nor a digit.
The old form would have blocked this valid account.

**Changed**: the pattern is now `^[a-zA-Z0-9_.]+$`, matching the backend `@Pattern` exactly.
The password rule is now `min(8)` and `max(128)`, matching `@Size` exactly.
Each rule carries a comment naming the annotation it mirrors.

Copy was lowercased to match the established form convention.

**File**: `src/features/auth/utils/authSchemas.js`

See `auth-contract.md` for the security note on removing the complexity rules.

---

## 5. Verification schemas modelled a one-time code the backend does not issue

**Wrong**: `verifySchema` and `forgotPasswordResetSchema` validated a 6 to 12 character `otp`.
The backend issues opaque tokens delivered as email links.
A real token would have failed the maximum-length rule.

**Evidence**: `GET /auth/verify-email?token=...` takes a query parameter, and the token is a SHA-256-hashed value held in Redis, not a short code.

**Changed**: `otp` renamed to `token`, validated for presence only.

Confirmed both schemas had zero importers before changing them, so no form was restructured.

**File**: `src/features/auth/utils/authSchemas.js`

---

## 6. Post status sent the wrong field name

**Wrong**: `updatePostStatus` sent `{ status }`.
`PostStatusTransitionRequest` declares `targetStatus`, annotated `@NotNull`, typed as the `PostStatus` enum.

**Evidence**: read from the request record and the `PATCH /posts/{postId}/status` mapping.

**Changed**: the body now sends `{ targetStatus: status }`.
The JSDoc now names the accepted values: `draft`, `published`, `archived`, `removed`.

**File**: `src/services/post.service.js`

**Reachability**: the only caller is `useUpdatePostStatus` in `src/features/luvax/hooks/usePosts.js`, and that hook has no call site in any screen.
The path is currently unreachable from the user interface.
It was fixed rather than deleted, as instructed.
Because nothing calls it, this fix has no browser-level before and after.

---

## 7. The suggestions endpoint does not exist

**Wrong**: `getSuggestedUsers` called `GET /users/suggestions`.
No such route exists.
The literal `suggestions` is captured by `GET /users/{userId}` and fails UUID conversion.

**Evidence**:

```
GET /users/suggestions
400 {"code":"BAD_REQUEST","message":"Invalid request"}
```

**Changed**: removed the service function, removed the `useSuggestedUsers` hook and its `suggestions` query key, and removed the call site and the suggested block from the right rail.
Removed the follower filtering and the blocked-list filtering that existed only to feed it, along with the imports left dead by the removal.

The right rail still renders its trending section, so it is not visually empty and no empty state was added.
No mock data was substituted.

**Files**: `src/services/social.service.js`, `src/features/luvax/hooks/useSocial.js`, `src/features/luvax/components/shell.jsx`

---

## 8. Blocked users were mirrored into localStorage

**Wrong**: `useBlock` and `useUnblock` wrapped the API call in `try/catch`, swallowed the error, and wrote to `lx_blocks_{userId}` regardless of whether the server accepted the change.
`BlockedUsersScreen`, `SettingsScreen`, and `shell.jsx` all read that key instead of the backend.
`useBlock` also logged the raw error object with `console.warn`.

This duplicated server state in client storage and applied an optimistic update with no rollback, against two explicit project rules.
A block performed in one browser was invisible in another while the server-side block remained in force.

**Evidence**: `GET /social/blocked` exists and returns the list.

```
GET /social/blocked
200 {"data":{"content":[{"user":{"id":"49d7a0dc-...","username":"target.user","displayName":"Target User","avatarUrl":null,"isVerified":false},"viewerState":{"isFollowing":false,"isFollowRequested":false,"isFollowedBy":false,"isBlocking":true}}],"pageInfo":{...}}}
```

**Changed**:

- Added `getBlockedUsers`, following the existing cursor-paged service convention.
- Added a `useBlockedUsers` query and a `blocked` query key.
- `useBlock` and `useUnblock` now call the service directly. The error propagates. Both invalidate the blocked list on success.
- Removed the `console.warn` calls that logged raw error objects.
- Removed every read and write of `lx_blocks_{userId}` and the `lx_blocks_changed` window event.
- `BlockedUsersScreen` renders from the server response, which carries the username, display name, and avatar directly.
- `SettingsScreen` derives its count from the same query.

**Files**: `src/services/social.service.js`, `src/features/luvax/hooks/useSocial.js`, `src/features/luvax/components/BlockedUsersScreen.jsx`, `src/features/luvax/components/SettingsScreen.jsx`, `src/features/luvax/components/shell.jsx`

**Secondary correction**: the per-row `useUserProfile(userId)` lookup was removed.
`GET /users/{blockedId}` returns 404 to the blocker, so that lookup could never have resolved.
The old screen could not have displayed a blocked user's name even when the list was populated.

---

## 9. A failed block reported itself as a success

**Wrong**: with the `try/catch` removed, the mutation error propagates, but no call site rendered it.
`PostCard` called `block.mutate(targetUserId)` with no handler.
`PostDetailScreen` closed its modal only on success, leaving it open and silent on failure.

**Evidence**: two reproducible failures.

```
POST /social/block/{self}       400 {"code":"SOCIAL_SELF_BLOCK","message":"You cannot block yourself"}
POST /social/block/{alreadyBlocked} 409 {"code":"SOCIAL_ALREADY_BLOCKED","message":"User already blocked"}
```

**Changed**: `PostCard` renders an inline alert when `block.isError`.
`PostDetailScreen` renders an inline message inside the confirm modal and disables the block button while the mutation is pending.
`BlockedUsersScreen` renders an inline message when an unblock fails.

All three use existing tokens, `v.errorText` and `v.errorDim`.
No toast system or new component was introduced.

**Files**: `src/features/luvax/components/PostCard.jsx`, `src/features/luvax/components/PostDetailScreen.jsx`, `src/features/luvax/components/BlockedUsersScreen.jsx`

---

## 10. The blocked query passed a context object as a cursor

**Wrong**: `useBlockedUsers` was first written as `queryFn: socialService.getBlockedUsers`.
TanStack Query calls `queryFn` with a context object, which arrived as the `cursor` argument.

**Evidence**: caught in the browser network tab, not by reading the code.

```
GET /social/blocked?cursor=%5Bobject+Object%5D&limit=20
400 Bad Request
```

The settings row read "0 blocked" while the server held one block.

**Changed**: the function is wrapped rather than passed by reference, and forwards the abort signal.

```
GET /social/blocked?limit=20
200 OK
```

**File**: `src/features/luvax/hooks/useSocial.js`

This defect was introduced and fixed within this phase.
It is recorded because it is the clearest argument for the browser-level verification the phase required: the code read correctly and was wrong.

---

## 11. Design reference committed

`Luvax.html` existed only at `C:\Users\minhg\OneDrive\Desktop\Luvax.html`, in no repository.
It is the pixel-perfect reference for every interface task in the project.

Copied to `docs/design/Luvax.html`, byte-identical to the original, verified with `cmp`.

Added `docs/design/README.md` describing what the file is, that it must not be edited, the manifest structure, and a runnable extraction procedure.

Extraction was verified against the committed copy, not the desktop original: 29 manifest entries, and the three Luvax chunks at 176,988, 30,633, and 44,507 bytes, matching the sizes recorded during reconnaissance.

**Files**: `docs/design/Luvax.html`, `docs/design/README.md`

---

## 12. Dependency and dead code removed

`lucide-react` had zero imports in `src/`.
Removed via `npm uninstall`.

`FEED_POSTS` and `REPLIES` had zero importers, confirmed by searching `src/` for both names.
Removed.

**Files**: `package.json`, `package-lock.json`, `src/features/luvax/constants/data.js`

---

## 13. Structure rules refreshed

`.claude/rules/struct.md` described a source tree that no longer exists and named deleted files.
Agents read this file, so a stale copy actively misleads them.

Updated to match the current tree.

**File**: `.claude/rules/struct.md`
