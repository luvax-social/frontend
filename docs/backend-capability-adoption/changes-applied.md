# Changes Applied

> Record of work done on 2026-08-12. Not maintained; it is correct as of that date and is not updated as the code moves.

One entry per change, with what was wrong, the evidence, what changed and where.

Every entry was exercised in a browser; the evidence is in `verification-evidence.md`.

## 1. A prior report is visible before submitting

**What was wrong**

The report control was offered identically whether or not the viewer had already reported the item.

The only way to discover a prior report was to open the modal, pick a reason, submit, and receive the duplicate error.

**Evidence**

Posts and comments carry `hasReported` at the top level; users carry `viewerState.hasReported`.

Ava's session reported `hasReported: true` on Dan's seeded post and comment, and `false` on her own content.

Full observations in `backend-capability-verification.md`, section 6.1.

**What changed**

Where `hasReported` is true, the actionable "Report" row is replaced by a non-interactive "Reported" row.

Where it is false, the row is unchanged.

The submit mutation now refetches the reported item, so the control settles into the reported state without a reload. It does the same on a duplicate rejection, because that answer means the server already holds the report and the cached copy is the stale one. This is what keeps the up-front state and the duplicate error in agreement.

**Files**

- `src/components/ui/lx-dropdown-menu.jsx`, added a `readOnly` row kind
- `src/features/luvax/components/PostCard.jsx`
- `src/features/luvax/components/PostDetailScreen.jsx`
- `src/features/luvax/components/ProfileScreen.jsx`
- `src/features/luvax/hooks/useReports.js`

## 2. The like control is back on your own comments

**What was wrong**

The control was removed, and a code comment asserted the backend rejects the like.

Both the removal and the assertion are now false.

**Evidence**

`POST /comments/{id}/like` as the comment's author returned 200, and the count moved from 0 to 1.

**What changed**

The `isOwn` guard was removed from the heart control, from the overflow menu item, and from the toggle handler.

The comment stating that the backend refuses the like was deleted rather than reworded, since it no longer describes anything.

**Files**

- `src/features/luvax/components/PostDetailScreen.jsx`

## 3. An edited comment says so

**What was wrong**

Nothing distinguished an edited comment from an unedited one, because `updatedAt` also moves when a comment is liked or replied to.

**Evidence**

On one comment: after a like, `editedAt` was null while `updatedAt` had moved; after a content edit, `editedAt` was set.

**What changed**

An "edited" marker renders in the comment's meta row, driven only by `editedAt`.

`updatedAt` is not consulted for this.

**Files**

- `src/features/luvax/components/PostDetailScreen.jsx`

## 4. The edited marker survives the edit that caused it

**What was wrong**

Found while exercising change 3 in the browser: the marker did not appear after saving an edit, only after a later refetch.

The edit handler copied `content` and `updatedAt` out of the response and dropped `editedAt`.

**Evidence**

Editing a comment updated the body on screen with no marker; reloading the page showed the marker.

**What changed**

`editedAt` is copied out of the edit response alongside the body.

The handler still avoids spreading the whole response, because a single-comment response reports `pinned` as false and would strip the pinned marker.

**Files**

- `src/features/luvax/hooks/usePosts.js`

## 5. The delete confirmation states how many comments go

**What was wrong**

The dialogue said "deleting this comment also deletes its N replies and any replies to those", where N was `replyCount`, which counts direct replies only.

On the seeded thread that read "its reply" where the true scope was eleven comments.

**Evidence**

`GET /comments/{id}/deletion-scope` returned `{"deletedCommentCount": 11}` for that comment.

**What changed**

The dialogue fetches the estimate when it opens and states the total.

If the estimate fails, or has not arrived within 1500 ms, the dialogue falls back to the previous unnumbered wording and keeps it for the life of the dialogue.

The delete response's authoritative count is used to drop the deleted subtree's own replies cache entry.

Lists are still refetched rather than patched; the reasoning is in `design-decisions.md`.

**Files**

- `src/services/post.service.js`
- `src/features/luvax/hooks/usePosts.js`
- `src/features/luvax/components/PostDetailScreen.jsx`

## 6. The estimate is not discarded once it has arrived

**What was wrong**

Found while exercising change 5 in the browser: the number appeared and then reverted to the unnumbered wording after 1500 ms, even though the estimate had arrived immediately.

The deadline was unconditional rather than being about whether an answer was outstanding.

**Evidence**

The dialogue showed the fallback wording while the network panel showed `deletion-scope` had returned 200.

**What changed**

The deadline is armed only while the request is still in flight.

Once an answer is in, it stays on screen.

**Files**

- `src/features/luvax/components/PostDetailScreen.jsx`

## 7. The registration form enforces the server's password policy

**What was wrong**

The form enforced a minimum of 8 and a maximum of 128 characters and nothing else, and a code comment stated that no complexity requirement exists server-side.

The server enforces six rules, so the form accepted passwords the server rejects.

A rejection surfaced the generic envelope message rather than the rule that failed.

**Evidence**

Each rule was probed independently against `POST /auth/register`. The table is in `backend-capability-verification.md`, section 6.5.

**What changed**

The shared password field mirrors all six rules, in the server's order, reporting one message at a time as the server does.

Lengths are counted in code points and the byte ceiling is measured on the UTF-8 encoding, matching the server.

The field is shared with the two password-reset schemas, and `POST /auth/reset-password` was verified to enforce the same policy, so all three now agree with the server. The login schema is deliberately untouched.

Rejected registrations now place the server's own `errors` message beside the field it belongs to.

**Files**

- `src/features/auth/utils/authSchemas.js`
- `src/features/auth/components/AuthPage.jsx`

## 8. The uppercase rule matches what the server counts as uppercase

**What was wrong**

Found while exercising change 7: the client tested `\p{Lu}`, but the server uses `Character.isUpperCase`, which is also true for characters carrying Other_Uppercase.

The client would have rejected a password the server accepts, which the schema's own contract forbids.

**Evidence**

`Ⅰabcdefg1`, whose only uppercase character is U+2160 ROMAN NUMERAL ONE, was accepted by the server with 201 while the client schema rejected it.

**What changed**

The test is now `\p{Uppercase}`, which matches that character.

Re-checked against all fourteen probes: client and server now agree on every one.

**Files**

- `src/features/auth/utils/authSchemas.js`

## 9. Media upload failures say what happened and invite a retry

**What was wrong**

Registration can now be refused because the object is missing, its size or type disagrees with the metadata, or storage cannot be reached.

Every failure collapsed into one generic sentence, and the composer discarded the error entirely.

**Evidence**

Requesting an upload URL and calling `upload-complete` without transferring any bytes returned `422 MEDIA_OBJECT_NOT_UPLOADED`.

**What changed**

Failures map to specific copy naming what happened, and every one of them is worded as retryable.

The chosen file is deliberately kept on failure, so a retry does not mean finding the file again.

**Files**

- `src/features/luvax/hooks/useMediaUpload.js`
- `src/features/luvax/components/ComposerScreen.jsx`

## Not changed, deliberately

- No comment sort control was built. The parameter is recorded in the verification document.
- No realtime client was built. The topic and payload are recorded in the verification document.
- The profile tab set is unchanged. The finding is in `profile-tabs-finding.md`.
- No pinned-duplication workaround was removed, because the frontend never contained one.
