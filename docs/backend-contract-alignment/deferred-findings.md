# Deferred Findings

> Record of work done on 2026-08-01. Not maintained; it is correct as of that date and is not updated as the code moves.

Everything found during this phase and deliberately not acted on.
Each entry names the phase it belongs to.

The first entry is the one to read.
It was discovered during verification, it is severe, and it was found only because this phase unblocked login.

---

## 1. Post author is an object, and every post-rendering component treats it as a string

**Severity**: high.
Any screen that renders a post crashes.

**Phase**: the next one. This is a contract alignment defect of exactly the kind this phase existed to fix, and it should be treated as the direct continuation of it.

The backend returns the post author as a nested object:

```json
{
  "id": "4f9681dc-fcbe-4c0c-ad86-35e4d382949f",
  "author": {
    "id": "49d7a0dc-d350-4edc-8483-ffb61c92f58c",
    "username": "target.user",
    "displayName": "Target User",
    "avatarUrl": null,
    "isVerified": false
  },
  "caption": "a post from target user",
  ...
}
```

There is no `username`, no `userId`, no `authorId`, and no `userAvatarUrl` at the top level of a post.

The frontend reads all four.
`ExploreScreen.jsx:19` and `PostCard.jsx:105-108` both do:

```js
const authorName = post.username || post.author || 'Unknown';
const targetUserId = post.userId || post.authorId;
const avatarUrl = post.userAvatarUrl;
```

`post.username` is undefined, so the expression falls through to `post.author`, which is an object.
Rendering it as a React child throws:

```
Objects are not valid as a React child (found: object with keys {id, username, displayName, avatarUrl, isVerified}).
```

Observed in the browser as a full-page error boundary reading "Something went wrong" in place of the explore screen, as soon as any post exists.

`targetUserId` resolving to `undefined` is the same defect with a quieter failure: the follow, block, and view-profile actions on a post card all receive `undefined` as the target.

**Why it was not fixed here**: it is a sixth contract mismatch beyond the five this phase enumerates, and correcting it means normalising the author shape across `PostCard`, `ExploreScreen`, `PostDetailScreen`, and every other post-rendering surface.
The brief instructs stopping and reporting rather than growing the branch past its size budget, so it is reported.

**Why it was invisible until now**: nobody could log in, so no authenticated screen was reachable.
Fixing login is what exposed it.
It is not a regression from this branch: `ExploreScreen.jsx` and the author-reading lines of `PostCard.jsx` were not modified.

---

## 2. Repository-wide lint failure from a line-ending conflict

**Severity**: medium. Blocks any "lint is clean" gate.

**Phase**: a tooling or infrastructure change, on its own branch.

`npm run lint` reports 9,464 problems, of which 9,306 are ``Delete `␍` ``.
It reported 9,900 before this branch.

Cause:

- `core.autocrlf` is `true`, so Windows checkouts get CRLF.
- No `.gitattributes` exists.
- `.prettierrc` sets `"endOfLine": "lf"`.

Every line of every checked-out file violates the rule on Windows.

Two candidate fixes, both repository-wide:

1. Add `.gitattributes` with `* text=auto eol=lf` and renormalise. Correct and permanent, but rewrites the working copy of the entire tree.
2. Set `"endOfLine": "auto"` in `.prettierrc`. A one-line change that makes the rule pass on Windows and remain correct on Linux.

The remaining 158 findings are genuine formatting and unused-variable issues across 23 files, and are independent of the line-ending question.

Full measurements in `verification-evidence.md`.

---

## 3. A hard refresh cannot preserve the session

**Severity**: medium as a user experience issue, deliberate as a security posture.

**Phase**: the auth token storage migration already noted in the structure documentation.

Both the access token and the refresh token are held in memory only.
`useAuthStore` persists `user` and `isAuthenticated` to `localStorage` but never the tokens, so a reload leaves the application believing it is authenticated with no credential to present.

The practical effect is that any hard refresh returns the user to the login screen.

This is pre-existing and intentional.
The structure documentation already records the planned migration of the refresh token to an `HttpOnly` cookie, which is what would fix it.

It is noted here because it is the reason one clause of this phase's definition of done, "survives a hard refresh", could not be verified as literally written.
The underlying property, that the blocked list is read from the server rather than from client storage, was verified by re-authenticating in a clean session.

---

## 4. Verification and reset are modelled as code entry, not link entry

**Severity**: low. No screen currently uses either schema.

**Phase**: whichever phase builds out the verification and password-reset screens.

`verifySchema` and `forgotPasswordResetSchema` were written around a 6 to 12 character one-time code.
The backend issues opaque tokens delivered as links, consumed via `GET /auth/verify-email?token=...`.

The schemas were corrected in this phase to validate a token for presence only, since a real token would have failed the old maximum-length rule.

The interaction design was not changed.
Neither schema has an importer, so no form was restructured and no screen was touched.
When those screens are built, they should read the token from the URL rather than prompt for a code.

---

## 5. `updatePostStatus` is unreachable

**Severity**: low.

**Phase**: whichever phase builds post archiving.

The field name was corrected from `status` to `targetStatus`, as instructed.
The only caller is `useUpdatePostStatus`, and that hook has no call site in any screen, so the corrected path cannot be exercised from the interface.

---

## 6. `usePendingFollowRequests` passes `queryFn` by reference

**Severity**: none today. Latent.

**Phase**: cleanup, whenever that surface is next touched.

```js
queryFn: socialService.getPendingFollowRequests,
```

This is the same pattern that produced the `cursor=[object Object]` defect in the blocked list.
It is harmless only because `getPendingFollowRequests` currently takes no arguments.
The moment it gains a cursor parameter, it will break in exactly the same way.

---

## 7. Areas listed as out of scope, confirmed untouched

Recorded for completeness. No action taken on any of them.

- Routing. The entire authenticated application is one route, `/app`, with screen state held internally. Navigation between screens does not change the URL, which is why screens cannot be linked to or reloaded.
- The design system port and all pixel-perfect work.
- Comment like, edit, and delete.
- Report. The menu item exists on `PostCard` and `PostDetailScreen` with an empty `onClick`.
- Search results.
- Saved posts list.
- The `pinned` comment flag.
- Stories, messages, notifications, onboarding, and settings.
- The missing `Idempotency-Key` header on comment creation. Note that post creation does send one; comment creation does not.
- Loading, empty, and error states outside those this phase touched.

---

## 8. Workspace rule files describe a structure that does not exist

**Severity**: medium for agents, none at runtime.

**Phase**: a root-repository documentation change. It belongs to the aggregator repository, not to this one, so it could not be committed from this branch.

The root `.claude/rules/` files describe submodules at `Luvax/` and `app-fe/`.
The actual submodules are `backend/` and `frontend/`.

The same files describe the backend as having 18 migrations with most modules as "empty scaffolds".
The backend's own `.claude/rules/struct.md` records 43 migrations with every module except `recommendation` implemented, plus Elasticsearch and WebSocket infrastructure the root files do not mention.

Any agent routed by the root files will look for directories that do not exist and will assume capabilities are missing that are in fact built.
