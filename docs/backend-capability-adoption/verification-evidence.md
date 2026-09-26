# Verification Evidence

> Record of work done on 2026-08-12. Not maintained; it is correct as of that date and is not updated as the code moves.

Browser-level before and after for every item, including the failure cases.

All of it was captured against both applications running with seed data loaded, signed in through the interface rather than through the API.

Accessibility snapshots are quoted rather than screenshots, because they show whether something is a control or a piece of text, which is the distinction several of these changes turn on.

## Environment

| Component | Where |
|-----------|-------|
| Frontend | `http://localhost:5173` |
| Backend | `http://localhost:8080` |
| Mailpit | `http://localhost:8025` |

Signed in as `luvax_ava` through the sign-in form for items 1 to 5, and as a newly registered `luvax_mira` for items 6 and 7.

## 6.1 A prior report is visible before submitting

### Comment, already reported

Dan's seeded comment, which Ava has reported.

Before, the menu offered an action that could only fail:

```
- button "Report" [cursor=pointer]
```

After:

```
- button "Unlike"
- button "Share"
- button "Copy link"
- button "View author's profile"
- generic: Reported
```

The row is a `generic`, not a `button`. There is nothing to click and nothing focusable.

### Comment, not reported

A comment created fresh for this check, so nothing had reported it:

```
- button "Like"
- button "Share"
- button "Copy link"
- button "View author's profile"
- button "Report" [cursor=pointer]
```

The actionable row is unchanged where the item has not been reported.

### The state settles without a reload

Reporting that same comment through the modal, choosing "Spam" and submitting:

```
- dialog "Report comment":
  - generic: report submitted
```

Reopening the same comment's menu, with no page reload:

```
- button "Like"
- button "Share"
- button "Copy link"
- button "View author's profile"
- generic: Reported
```

### Post, already reported

Dan's post in the feed:

```
- button "Like"
- button "Share"
- button "Copy link"
- button "View author's profile"
- button "Unfollow @luvax_dan"
- button "Block @luvax_dan"
- generic: Reported
```

### User, already reported

Ben's profile, reading the nested `viewerState.hasReported`:

```
- generic: Reported
```

## 6.2 Liking your own comment

Ava's own comment, before this change, had no like control at all.

After, on the same comment:

```
- generic: Luvax Ava
- generic: a top-level comment
- generic: 1 likes
- button "like comment" [cursor=pointer]
```

After clicking it:

```
- generic: 2 likes
- button "unlike comment" [pressed]
```

The count moved from 1 to 2 and the control reports its pressed state. No error appeared.

The overflow menu on the viewer's own comment now carries the action too:

```
- button "Unlike"
```

## 6.3 The edited marker

### Positive case

Ava's own comment, edited through the interface from "a top-level comment" to "a top-level comment, now edited":

```
- generic: a top-level comment, now edited
- generic: 1h
- generic "this comment was edited": edited
- generic: 2 likes
```

### Negative case

Dan's comment in the same list has been liked twice and never edited. Its `updatedAt` has moved; its `editedAt` is null:

```
- generic: an older comment everyone liked
- generic: 1h
- generic: 2 likes
```

No marker. This is the case that made `updatedAt` unusable.

### The failure found here

On the first attempt the marker did not appear after saving, only after a reload, because the edit handler dropped `editedAt` from the response.

After the fix, the marker appears on save with no reload. Both cases above were re-captured after the fix.

## 6.4 The delete confirmation states the number

### Before

The dialogue on Ava's comment, which has one direct reply and a ten-deep chain beneath it:

```
deleting this comment also deletes its reply and any replies to those. this cannot be undone.
```

"its reply" describes one comment. The true scope is eleven.

### After

```
delete comment
deleting this comment removes 11 comments in total, including every reply beneath it. this cannot be undone.
```

`GET /comments/be32aa50-.../deletion-scope` returned `{"deletedCommentCount": 11}`.

### Failure case, estimate unavailable

The estimate was forced to fail by rewriting its URL in the page, so the request 404s.

With a cold cache, opening the same dialogue:

```
delete comment
deleting this comment also deletes its reply and any replies to those. this cannot be undone.
```

The fallback wording appears immediately. The dialogue does not block, does not show an empty space, and does not show a wrong number.

### Failure case, estimate late

With the deadline armed unconditionally, the number appeared and then reverted to the fallback wording after 1500 ms even though the estimate had returned 200.

After the fix, the number arrives and stays. Re-captured above.

## 6.5 Registration password rules

### Client-side, a password the old form accepted

`alllowercase1`, which satisfies the previous rule of 8 to 128 characters:

```
- textbox "password must contain at least one uppercase letter."
- generic: password must contain at least one uppercase letter.
```

The message names the rule that failed, and matches what the server would have said.

### Client and server agreement

All fourteen probes were run against the client schema and against `POST /auth/register`. Both accept and reject the same values, and name the same rule.

The server-side table is in `backend-capability-verification.md`, section 6.5.

| Probe | Server | Client |
|-------|--------|--------|
| 7 characters | reject, at least 8 | reject, at least 8 |
| 8 characters | accept | accept |
| 64 characters | accept | accept |
| 65 characters | reject, at most 64 | reject, at most 64 |
| no uppercase | reject, uppercase | reject, uppercase |
| no digit and no special | reject, digit or special | reject, digit or special |
| digit only | accept | accept |
| special only | accept | accept |
| internal space | reject, whitespace | reject, whitespace |
| trailing space | reject, whitespace | reject, whitespace |
| tab | reject, whitespace | reject, whitespace |
| zero width U+200B | reject, whitespace | reject, whitespace |
| 64 chars, 125 bytes | reject, 72 bytes | reject, 72 bytes |
| U+2160 as the only uppercase | accept | accept |

The last row failed on the first attempt: the server accepted it with 201 while the client rejected it. That is recorded as change 8 in `changes-applied.md`.

## 6.9 Registering and verifying through the browser

End to end, with no database write.

1. Registered at `/register` as `luvax_mira` / `luvax_mira@example.com` with `MiraPass1!`. Landed on the verification notice.

2. Mailpit held two messages for that address:

```
Luvax  a few seconds ago  To: luvax_mira@example.com  Verify your email address
Luvax  a few seconds ago  To: luvax_mira@example.com  Welcome to Social
```

3. The verification mail rendered in the Mailpit interface with a working link:

```
Verify your email address
Hello luvax_mira,
link "Verify Email Address" -> http://localhost:5173/verify-email?token=YhKcr4oB_tK36nimGEdkCMCsr8UCphXzz3wWDu42zkA
This link expires in 24 hours.
```

4. Following the link landed on `/app` already signed in.

5. Signed out and signed back in with `luvax_mira` / `MiraPass1!`, which reached `/app`.

The `UPDATE user_credentials` statement in the runbook was not run at any point.

## 6.7 Media upload

### Failure case, object never arrived

The direct upload was stubbed in the page to report success without transferring anything, which is what an interrupted upload looks like to the server. Nothing was written to storage for this run.

Selecting `probe.jpg` (336 bytes) in the composer and posting:

```
- generic: your file didn't finish uploading. try again.
```

`POST /api/v1/media/upload-complete` answered `422`.

The failure is retryable in practice, not just in wording. The composer kept the selection and the action:

```
- generic: you
- img "preview"
- textbox "add a caption (optional)"
- button "post it" [cursor=pointer]
```

The preview is still there and "post it" is still enabled, so a retry is one click away.

### Successful case

Run afterwards with no stubbing, following explicit approval to write to the bucket.

The full sequence, from the network panel:

```
[POST] /api/v1/media/upload         => 200 OK
[PUT]  https://<account>.r2.cloudflarestorage.com/luvax-develop/users/<userId>/media/<uuid>.jpg  => 200 OK
[POST] /api/v1/media/upload-complete => 201 Created
[POST] /api/v1/posts                 => 201 Created
```

Registration returns 201 rather than 422 once the object genuinely exists, which is the new check passing rather than being absent.

The image then resolves from the CDN, fetched from the rendered page:

```
{ status: 200, type: "image/jpeg", bytes: 336 }
```

This is the first media in this project that renders. The seed data's asset has always 404ed, because it was registered without any bytes being sent.

The remaining rejection codes share the same mapping in the same switch. Only `MEDIA_OBJECT_NOT_UPLOADED` was reachable in the browser without provoking a storage outage, so the others are verified by the contract rather than by observation. That limit is recorded in `deferred-findings.md`.

## 6.10 Profile tabs

Ben's profile renders three tabs:

```
- button "posts"
- button "photos"
- button "liked"
```

Selecting "photos" leaves the grid identical, still listing the same three posts including a text-only one:

```
- generic: "[luvax-seed] grain on film is the texture of memory #film"
- generic: "[luvax-seed] morning, window, coffee #photography"
- generic: "[luvax-seed] light is the medium, not the message #observation"
```

Detail in `profile-tabs-finding.md`.

## Console

Checked with dev tools open on every surface touched: feed, post detail, profile, settings, registration, verification, and the composer.

No React render errors, and no errors of any kind on a clean load.

The only errors observed at any point were deliberately provoked by this verification:

- `404` on the rewritten `deletion-scope` URL, from the forced-failure test
- `422` on `media/upload-complete`, from the stubbed-upload test
- `[QueryClient] Requested resource was not found`, the global handler logging those same two expected outcomes, which is an already-recorded finding and not something this phase introduced

One React warning appeared once, mid-session, reading "The final argument passed to useEffect changed size between renders". It was produced by hot module replacement swapping in an edited hook while the component was mounted, and does not occur on a clean load. Confirmed by reloading and repeating the same interaction with zero console errors.
