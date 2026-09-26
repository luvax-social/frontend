# Comment Interactions

> Record of work done on 2026-08-10. Not maintained; it is correct as of that date and is not updated as the code moves.

The first phase that builds a feature rather than infrastructure.

Three steps of the demo walkthrough were impossible: liking a comment, editing your own, and deleting your own.
The backend implemented all three.
The client had nothing: no service function, no hook, no working control.

## What was built, in plain language

**You can like and unlike a comment.**
The heart now reflects whether you have actually liked it, which the response has always said and the client had never read.
The count moves immediately and is put back if the request fails, so a failure never leaves a wrong number on screen.

**Your own comments have no heart.**
The backend refuses a like on your own comment, so rather than offer a button that always fails, there is no button.
The count stays visible, so nothing is hidden from you.

**You can edit your own comment.**
An inline editor prefilled with the current text, with the same limits the backend enforces and nothing invented on top.
Cancelling changes nothing, and a rejected save keeps your draft in the editor rather than pretending it went through.

**You can delete your own comment.**
Behind a confirmation, because deletion takes every reply with it and leaves nothing behind.
When there are replies the confirmation says so; when there are none it does not.
The comment and its replies disappear without a page reload and the post's comment count follows.

**Edit and delete appear only on your own comments**, decided from the response rather than from anything the client remembers.

**The first comments now explain themselves.**
The backend promotes up to three comments by like count, and the client had been rendering them in that order with no indication of why, so the oldest comment appearing first looked arbitrary.
They are now labelled `TOP COMMENT`.

**Posting a comment twice no longer creates two.**
The backend has always accepted an idempotency key; the client never sent one.

## What was deliberately not done

No "edited" marker.
`updatedAt` looks like it would supply one, but it moves whenever the like or reply counter changes, so most unedited comments would be labelled as edited.
Nothing on the response distinguishes an edited comment, so nothing was rendered.
`design-decisions.md` sets out what the backend would need to add.

The confirmation does not promise how many comments a deletion will remove.
`replyCount` counts direct replies only, and the real cascade is much larger: deleting a comment with one direct reply removed eleven.

## One defect fixed in passing

The comment menu's "View author's profile" called a `navigate` that was no longer in scope, left behind when the routing phase removed that prop.
Clicking it would have thrown.
It was latent because nobody had opened that menu item.
Fixed here because it is on the surface this phase owns.

## The commits

| Commit | Subject |
|--------|---------|
| `998ad88` | `feat(comment): add like, edit, delete, pinned marker and idempotent create` |
| `docs` commit | this directory and the changelog entry |

Branch: `feat/comment/comment-interactions`, cut from `refactor/common/url-routing`, which carries the prerequisite phases.

Code is 427 changed lines across three files, inside the thousand-line target.
Documentation is committed separately so the code is reviewable on its own.

## The backend was not touched

Required check, run from `backend/`:

```
$ git status
On branch develop
Your branch is up to date with 'origin/develop'.

nothing to commit, working tree clean
```

Every contract was read from the source and then re-verified against the running server before anything was built against it.
That re-verification is what caught the `updatedAt` trap and the size of the delete cascade.

## The rest of this directory

| File | What is in it |
|------|---------------|
| `comment-contract.md` | Every comment endpoint touched, with observed requests and responses for success and failure |
| `design-decisions.md` | The self-like treatment, the missing counter, the delete wording, and the pinned treatment, each with what was rejected |
| `changes-applied.md` | One entry per change: what was missing or wrong, the evidence, what was built, which file |
| `verification-evidence.md` | Browser-level evidence for every capability and every failure case |
| `deferred-findings.md` | What was found and left alone, and where it belongs |
