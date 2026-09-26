# The Composer: One Surface, Many Files

> Record of work done on 2026-08-14. Not maintained; it is correct as of that date and is not updated as the code moves.

## What changed, in plain language

Before this phase, the composer asked you to pick a kind of post before you had made one.
Three tabs decided whether you were writing text, adding a photo, or adding a video, and switching tabs was the only way to change your mind.
It took exactly one file, so a carousel could not be made at all: the feature Stage 2 built for viewing carousels had no way to create one except through a script.

Now there is one surface.
You write, or you attach, or you do both in either order.
The type of post is worked out from what you attached: nothing is a text post, one image is an image post, one video is a video post, and two or more of anything is a carousel.
The post button says which of those it is about to create, so the reasoning is visible rather than hidden.

You can attach several files at once, add more without losing the ones already there, remove any one of them, and change their order.
Reordering is done by tapping a back or forward control on each thumbnail, so it works on a phone rather than only with a mouse.
The order you see is the order that gets stored, which matters because it is what a viewer swipes through.

Each file uploads on its own and shows its own progress.
If one of six fails, the other five and your caption stay exactly where they are, and the failed one offers a retry.
You cannot post while anything is still uploading.

The composer also stopped inventing rules.
It used to say `mp4 · max 60s · 50MB`, and all three of those claims were wrong.
It now asks the server what it accepts and repeats the answer, so the text cannot drift again.
Files that are the wrong format or too large are refused before a single byte is sent, and the refusal names the real limit.

`.gif` and `.mov` files, which the backend recently started accepting, both upload and display.

## The commits that carry it

| Commit | What it does |
|--------|--------------|
| `1b259ae` | `docs(media): record verified backend upload constraints` |
| `3c147be` | `feat(media): fetch upload constraints from the server` |
| `378f12b` | `feat(post): derive composer limits and post type from constraints` |
| `85e61cd` | `feat(media): report upload progress per file` |
| `ae23ff3` | `feat(post): rebuild the composer as one surface for many files` |
| `d792e0b` | `fix(post): state how many files were added when the cap is hit` |

The constraints document was committed first, before any feature code, as the phase required.

## The documents

| File | Contents |
|------|----------|
| `backend-constraints-verified.md` | What the server actually enforces, observed rather than read from its source |
| `composer-design.md` | The surface as built: type derivation, reorder method, the divergence from the design, every derived value, and the blurhash decision |
| `changes-applied.md` | One entry per change, with the evidence for each |
| `verification-evidence.md` | Browser-level evidence for every path, and a plain statement of what was not verified |
| `deferred-findings.md` | Everything found and deliberately not acted on |

## Two decisions worth reading

**The type tabs were removed, which diverges from the design export.**
That divergence is the decision this phase implements, and the reasoning is in `composer-design.md`.

**A blurhash is still not produced.**
Stage 2's aspect-ratio box already removed the layout shift, nothing in the application renders a blurhash, and rendering one is out of this phase.
Adding an encoder to fill a column no surface reads is cost without effect.
The full reasoning is in `composer-design.md`.

## What was not verified

Stated fully in `verification-evidence.md`.
The most significant gap: **no genuinely over-length video was tested**, because none was available and no encoder is installed on this machine.
The composer was shown to measure duration correctly, and the threshold comparison was verified in isolation, but the two were not exercised together in the browser.

One further qualification: the **story** composer still hardcodes `max 60s`.
Stories are an out-of-scope module, so it was left alone, but it means the claim that no duration limit is hardcoded anywhere in the frontend holds for the post composer rather than for the whole application.
Recorded in `deferred-findings.md`.

## Backend repository is unmodified

The phase required the backend be treated as read-only.
No file in it was created, modified, or deleted.

`git status` in `backend/` at the end of this work:

```
$ git status
On branch develop
Your branch is up to date with 'origin/develop'.

Changes to be committed:
  (use "git restore --staged <file>..." to unstage)
	new file:   Makefile
```

**This is not a clean tree, and it was not clean before this phase started either.**
The staged `Makefile` was already present when the branch was cut, recorded in `backend-constraints-verified.md` alongside the starting commit `26d986d`.
The status above is byte-for-byte identical to that baseline.
Nothing on this branch touched it.

## Environment note

Both applications were started from a cold machine for this work.
Docker Desktop was not running, so PostgreSQL, Redis and RabbitMQ did not exist as containers, and the backend process was absent.

Elasticsearch was deliberately not started, since nothing in the composer path uses it.
As a result `/actuator/health` reported `DOWN` for the whole session.
That is the Elasticsearch health indicator alone.
