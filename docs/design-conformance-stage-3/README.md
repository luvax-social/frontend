# Design Conformance Stage 3

> Record of work done on 2026-08-14. Not maintained; it is correct as of that date and is not updated as the code moves.

## This stage is incomplete

Seven of the brief's work items were delivered.
Six were not.

That is stated first because the rest of this document would otherwise read as a full account of the stage, and it is not one.

**Delivered:** the like state, `ConfirmModal` and every destructive flow migrated onto it, Escape on every overlay, video pausing off screen, lazy loading, and the profile tabs.

**Not delivered:** the toast mechanism, post detail's two-pane layout, notifications, explore, settings, the report modal, and copy capitalisation.

The reason is scope rather than any blocker.
Each remaining item is independently workable, and `deferred-findings.md` says what each still needs.
Nothing was left half-built: every item listed as delivered is finished and verified, and every item not delivered was not started.

## What changed, in plain language

**Liking a post now works properly when the same post is on screen twice.**
Opening a post from the feed leaves the feed card behind it, so the same post is rendered twice at once.
Liking in one used to move only that one, and the other stayed wrong until something refetched.
Both now read the same underlying value, so they always agree, and a like that fails to reach the server rolls both back together.

While fixing this, a worse fault turned up in post detail: it never showed whether you had already liked or saved a post at all.
Those two started as "no" every time the screen opened and only changed if you clicked.
The count beside them was correct, so the screen contradicted itself.
That is fixed by the same change.

**Destructive actions now share one dialogue, and it makes you wait.**
Deleting a post, deleting a comment, and blocking someone were each assembled separately, so they looked and behaved differently.
There is now one dialogue, taken from the design, and its destructive button is inert for half a second after it appears, so a second click aimed at the thing you just pressed cannot land on the irreversible action.

**Blocking from a post's menu now asks first.**
It used to block the moment you clicked, while the same action from a profile asked for confirmation.
The design asks in both places.
The wording is the same wording that already existed, unchanged.

**Escape closes things.**
No modal, sheet, or overlay closed on Escape.
They all do now.
The dropdown, which already did, was left alone.

**A video stops when you scroll past it.**
It used to keep playing, and keep making noise, from a card you could no longer see.
It does not start again by itself when you scroll back.

**Long feeds stop fetching every image at once.**
Images below the fold are deferred.
The space they will occupy is still reserved, so nothing jumps.

**The profile tabs do something.**
`posts`, `photos`, and `liked` all showed the same list, and only the underline moved.
`photos` now asks the server for the posts that carry pictures, and `liked` shows the posts you have liked, which it had never done.

## The commits that carry it

| Commit | What it does |
|--------|--------------|
| `1347679` | `fix(post): hold like and save state in the query cache` |
| `5f450b2` | `feat(common): add a confirm modal with an arming delay` |
| `f62f687` | `feat(common): close overlays on escape and defer offscreen media` |
| `1351e71` | `feat(post): filter the profile grid by the selected tab` |

## The documents

| File | Contents |
|------|----------|
| `stale-findings.md` | Audit claims that turned out to be wrong, including two that matter |
| `changes-applied.md` | One entry per change, with the design's value where one exists |
| `design-decisions.md` | Every decision, what was rejected, and every derived value labelled |
| `verification-evidence.md` | Browser evidence, including the two-rendering like check, and a plain list of what was not verified |
| `deferred-findings.md` | Everything not acted on, including the six work items above |

## Findings worth reading

**The frontend has no realtime consumer.**
The brief asks that the realtime like event's absolute count not fight the optimistic update, and says the realtime work already handled this once.
There is no realtime code in this frontend at all: no WebSocket, no SockJS, no stomp, no EventSource.
The backend publishes the events; nothing here listens.
Nothing was built to defend against a message the application never receives.

**The audit's capitalisation rule is contradicted by the design.**
The audit says modal headings are lowercase and modal buttons Title Case.
The design's own `ConfirmModal` does the opposite: its buttons read `cancel` and `confirm`, and its headings read `Unfollow @name?`.
The copy work was not done in this stage, and it should not be done from the audit's version of the rule.

**Two verification attempts failed for reasons that were not defects**, and are recorded as such in `verification-evidence.md` so the evidence is not misread.

## What was not verified

Stated fully in `verification-evidence.md`.
The most significant gaps:

- **Mobile width was exercised only for the video pause check.**
  The brief asks for every change at both widths.
- **No before-and-after screenshot pairs were captured.**
  Evidence is DOM and network state rather than images.
- **The two-window like check was done as two renderings in one window**, which is what the defect actually describes.
  Two separate windows have independent caches and could only agree via a refetch, since there is no realtime channel.
- **Notifications, explore, settings, and the report modal were never opened**, so no claim is made about their console state.

## Backend repository is unmodified

No file in the backend was created, modified, or deleted.

`git status` in `backend/` at the end of this work:

```
$ git status
On branch develop
Your branch is up to date with 'origin/develop'.

Changes to be committed:
  (use "git restore --staged <file>..." to unstage)
	new file:   Makefile
```

**This is not a clean tree, and it was not clean before this stage started.**
The staged `Makefile` predates this branch and predates the composer rework before it, where the same baseline was recorded at commit `26d986d`.
The status above is identical to that baseline.
Nothing on this branch touched it.

The backend was read during this stage, to confirm the `type` request parameter on `listUserPosts` and the existence of `/posts/liked`.
Reading only.

## Design source

`docs/design/Luvax.html` was extracted with the documented procedure to a scratch directory outside the repository.
The chunks are not committed.

Values applied in this stage were re-read from chunk `9bffeb59-152c-49f9-ae0d-96c787e34723.js`, which carries `ConfirmModal`, the toast, and the menu.
