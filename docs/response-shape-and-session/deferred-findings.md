# Deferred Findings

> Record of work done on 2026-08-09. Not maintained; it is correct as of that date and is not updated as the code moves.

Everything found during this phase and deliberately not acted on, with the phase it belongs to.

---

## 1. A persistent session requires a backend change

**Phase**: a backend phase, before any frontend work on session restoration.

The backend returns the refresh token in the response body only and sets no cookie.
The project security rules forbid persisting tokens to `localStorage` or `sessionStorage`.
The backend is read-only in this phase.

A session that survives a browser refresh is therefore unreachable from the frontend.

The backend needs to issue the refresh token as an `HttpOnly` cookie on login, register, and refresh, and read it from that cookie when the request body omits it.
Suggested attributes, the frontend work that follows, and why each frontend-only workaround was rejected are in `session-and-token-flow.md`.

CORS already permits credentialed requests from the dev origin, so that part is done.

---

## 2. `comment.isLiked` is returned and not read

**Phase**: whichever phase implements comment like.

`CommentResponse` carries `isLiked`, and a real response showed `"isLiked": true` on a seeded comment.
`CommentRow` initialises its local `liked` state to `false` regardless, so a comment the viewer has liked always renders an unfilled heart.

This was left alone because correcting it is not a one-line change.
The row renders its count as `liked ? comment.likeCount + 1 : comment.likeCount`, which assumes `liked` starts false and represents a local increment.
Initialising from `isLiked` without also reworking that expression would display `likeCount + 1` for an already-liked comment, making the count worse rather than better.

Reworking it means touching the comment like display logic, and section 7 excludes comment like from this phase.

---

## 3. `CommentBroadcastResponse` omits fields that `CommentResponse` carries

**Phase**: the realtime phase.

The WebSocket broadcast variant has no `isLiked` and no `pinned`.
The REST variant has both.

Nothing consumes the broadcast type today, because there is no WebSocket client.

This is the shared-component hazard from section 4.3 waiting to happen.
If a future phase feeds broadcast payloads into the same `CommentRow` that renders REST comments, those two fields will be undefined on live-arriving comments and defined on fetched ones, which is the kind of difference that produces a bug report about comments behaving differently depending on how they arrived.

Worth deciding deliberately when the realtime client is built: either widen the broadcast DTO, or have the client merge broadcasts into the cached REST shape rather than rendering them directly.

---

## 4. Hashtags are hard-coded

**Phase**: the hashtag phase.

`HashtagResponse` exists and the backend implements trending, but the frontend requests neither.

- The right rail trending list is a literal array in `shell.jsx`: `['light', 'analog', 'morning', 'silence', 'film', 'observation']`.
- The explore topic chips come from a `TOPICS` constant.

This violates the project rule against hardcoding data that should come from the backend.
It is a feature gap rather than a shape mismatch, so no response was compared and nothing was changed.

---

## 5. `viewerState` on a profile is not read

**Phase**: the profile or social phase.

`PublicUserProfileResponse` carries `viewerState` with `isFollowing`, `isFollowRequested`, `isFollowedBy`, and `isBlocking`.

`ProfileScreen` ignores it and instead derives the follow state by fetching the viewer's entire following list and searching it for the target id.
That is a much more expensive way to obtain a value the profile response already contains, and it is only correct while the following list fits in the pages already fetched.

The membership test itself was fixed in this phase, because it was reading the list rows at the wrong nesting level.
Replacing the whole approach with `viewerState.isFollowing` is a behavioural change to the profile follow button and belongs with the profile work.

`isBlocking` is likewise unread, so a profile does not currently indicate that the viewer has blocked the account.

---

## 6. `requiredHeaders` from the upload URL response is ignored

**Phase**: the media phase.

`MediaUploadUrlResponse` returns `requiredHeaders`, a map the server expects to be sent on the `PUT` to R2.
`useMediaUpload` destructures only `uploadUrl` and `storageKey`.

Uploads currently succeed, so this is latent rather than broken.
It will stop being latent the moment the presign starts requiring a header, for example a checksum or a content-type binding.

---

## 7. 994 formatting problems, now visible

**Phase**: a formatting phase of its own.

Removing the line-ending conflict revealed 994 `prettier/prettier` problems that were previously unreportable, because each affected line was already spending its one error slot on `Delete ␍`.

They are mechanically fixable with `npx prettier --write src`, but that is a repository-wide reformat, which section 2.3 forbids, and it would destroy `git blame` across the luvax components and conflict with every open branch.

It should be done deliberately, in one commit that touches nothing else, at a moment when few branches are open.

Counts by file are in `lint-baseline.md`.

---

## 8. 51 genuine lint warnings

**Phase**: alongside or after the formatting pass, but judged individually.

Unchanged by this branch, and not introduced by it:

| Count | Rule |
|-------|------|
| 24 | `no-unused-vars` |
| 10 | `react-hooks/set-state-in-effect` |
| 7 | `react-hooks/exhaustive-deps` |
| 4 | `react-refresh/only-export-components` |
| 4 | `react-hooks/rules-of-hooks` |
| 1 | `prefer-const` |
| 1 | `react-hooks/immutability` |

The four `react-hooks/rules-of-hooks` occurrences deserve attention first.
That rule catches genuine correctness problems rather than style, and a violation usually means a hook is called conditionally, which produces bugs that only appear on a specific render order.

Section 6.2 explicitly asked for these to be counted rather than fixed.

---

## 9. Messages and stories render entirely from mock data

**Phase**: the messages and stories phases, both excluded by section 7.

Neither screen issues a request.
`MessagesScreen` and `StoryScreens` render from static constants, which is why they have no response shapes to audit.

`StoryScreens.jsx` is the single largest source of formatting problems at 126, which is a consequence of it never having been wired to real data.

---

## 10. Post status transitions remain unreachable

**Phase**: whichever phase builds post archiving.

Noted in the previous phase and still true.
`updatePostStatus` sends the correct `targetStatus` field, and `useUpdatePostStatus` has no call site in any screen.

---

## 11. The `pinned` comment flag

**Phase**: excluded by section 7.

`CommentResponse` returns `pinned`, and a seeded comment showed `"pinned": true`.
No component reads it, so a pinned comment renders identically to any other.

Recorded here only to note that the field exists and is populated, so the work is display rather than plumbing.

---

## 12. Areas confirmed untouched

Recorded for completeness. No action taken.

- Routing. The whole authenticated application is still one route at `/app`, with screen state in component state and `sessionStorage`. This remains the next phase.
- The design system port and all pixel-perfect work.
- Comment edit and delete.
- Report. The menu item exists with an empty `onClick`.
- Search results.
- Saved posts list.
- Realtime and the WebSocket client.
- Onboarding and settings.
- The missing `Idempotency-Key` header on comment creation. Post creation sends one; comment creation does not.
- Password complexity. The backend enforces length only and the frontend now mirrors it exactly. That is correct: the frontend must not be stricter than the server. If a stronger policy is wanted it belongs in `RegisterRequest`, where it would bind every client. Recorded as a backend backlog item, unchanged here.
