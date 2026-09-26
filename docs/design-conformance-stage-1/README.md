# Design Conformance Stage 1: Icons, Buttons, and the Shell

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

The first of three stages bringing the interface into line with the design export.

This stage changes only what appears on every screen at once: the icon set, the button primitive, and the application shell.
It adds no features.

## What changed, in plain language

**The active navigation icons are the right shape now.**
Every filled glyph used to be the outline drawing with a fill poured into it while the outline stroke stayed switched on, which made each active icon about a stroke-width larger than the design draws it.
The bell was the worst case: its clapper is an open arc in the design, and filling the whole glyph turned that arc into a solid wedge.
The design ships a separate table of filled artwork for exactly this reason, and that table is now ported verbatim.

**Three glyphs that only existed in the design now exist here, and two menu rows stopped lying.**
Unfollow showed a plain person icon and block showed a close cross.
Unfollow now shows a person with a minus, and block shows a prohibition sign.

**Primary buttons use the inverse ink colour.**
Follow, continue, submit and the composer's post button all had dark text on the accent fill.
They now use the light inverse ink the design specifies.

**The app bar, the top tabs and the bottom nav match the design's measurements.**
Blur, paddings, gaps, the logo size, the bell's geometry and the icon sizes were all slightly off.
Three decorations the design does not draw are gone: an underline under the active top tab, and a bar above the active bottom-nav tab.

**The top tab hit target got bigger, not smaller.**
The audit recorded this as a regression from 109px to 44px.
It is the other way round: the tabs were a fixed 44px wide and the design lets them expand to about 109px.
Measured in the browser at 109 x 56.

**The app bar hides when you scroll down and comes back when you scroll up.**

**All four video elements now behave the same way.**
Two of them played with sound.
Opening post detail over the feed mounts the same video twice, so an unmuted overlay could play audio while the copy behind it ran silently.
All four are muted at mount and all four now carry `playsInline`.

## The commits

| Commit | Scope |
|--------|-------|
| `5c960db` | `fix(common): align the icon and button primitives with the design` |
| `3403cac` | `fix(common): align the app shell with the design` |
| the commit carrying this file | `docs(common): record the stage 1 conformance work` |
| `ab264ad` | `fix(common): keep the tablet tab underline` |

Code and documentation are in separate commits.

The documentation commit is named rather than given a hash, because a commit cannot contain its own hash.

## Where the values came from

Every value was read from `docs/design/Luvax.html`, extracted with the procedure in `docs/design/README.md` to a scratch directory outside both working trees.
The extracted chunks are not committed.

The audit under `docs/design-conformance/` was used to find the work, not to supply values.
That mattered: three of its statements did not survive re-reading the source, and they are recorded in `deferred-findings.md`.

## The backend was not modified

The backend repository is read-only for this stage.

```text
$ cd /c/Users/minhg/OneDrive/Desktop/Luvax/backend && git status
On branch develop
Changes to be committed:
  (use "git restore --staged <file>..." to unstage)
        new file:   Makefile
```

That staged `Makefile` is not from this stage.
It is dated 10 August, predates this work, and was already staged when this branch was created.
No file in the backend repository was created, modified or deleted by this stage.

A second backend clone exists at `GitClone/app` and is also unmodified.

```text
$ cd /c/Users/minhg/OneDrive/Desktop/GitClone/app && git status --porcelain
```

Empty.

The browser tool twice wrote screenshots and console logs into that clone's working directory, because it resolves relative output paths against the session's working directory.
Both times the files were moved to the scratch directory and the clone was confirmed clean again.
No screenshot or log remains in either backend repository.

## What this stage did to the environment

The local development database was seeded with `scripts/seed-dev-data.sh` from the backend repository, to obtain a login for browser verification.
That script writes disposable rows to the local compose database and refuses to run against anything non-local.
It writes no files.

## The deliverables

| File | Contents |
|------|----------|
| `changes-applied.md` | Every change, with the design's value, the previous value, the current value and the file |
| `design-decisions.md` | The right rail decision, the mute rule, and every derived value |
| `verification-evidence.md` | What was observed in the browser, and what was not verified |
| `deferred-findings.md` | Everything found and deliberately left alone, with the stage it belongs to |
