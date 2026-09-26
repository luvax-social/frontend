# Layout Overhaul

> Record of work done on 2026-08-15. Not maintained; it is correct as of that date and is not updated as the code moves.

A change of direction and the finish of design conformance stage 3, combined because they touch the same files.

## What changed, in plain language

The feed is now one centred column instead of two posts side by side.
The dividing lines, the card behind each post, and the border down the column are gone, and posts are told apart by the space between them alone.
Everything in the app is larger and easier to read, grown at the root so the proportions hold.
Post captions are larger again on top of that, because a wider column at the old size would only make the lines longer.

A media post opened on a wide screen now shows the media on the left and the comments on the right, with the media staying put while the comments scroll.
A text post stays a single column, and a narrow screen stacks the media above the comments.

Motion was added across overlays, menus, the carousel, toasts, likes, content loading, and screen changes, with one shared set of durations and easings, and it all turns off when the reader asks for reduced motion.
The scrim behind an open post is stronger, so the post holds attention without hiding the feed entirely.

The six remaining stage 3 items were finished: a toast mechanism, notifications grouped by date with their per-type icons, the explore search form and empty states, the report modal's completion animation and counter, the settings measured values, and the copy capitalisation.
A pending follow request in search now reads "requested" instead of "follow".

## The copy capitalisation rule

Re-derived from the design source across every surface.

- Sentence case, with the first word capitalised and proper nouns and @handles keeping their own case: dialogue and modal titles, dropdown menu rows, selectable list options such as report reasons, and full-sentence body prose.
- Lower case: navigation and tab labels, pill and action buttons such as cancel, confirm, follow, and following, tags, section eyebrows, and empty-state lines.

This matches the design's own confirmation dialogue, whose heading is sentence case and whose buttons are lower case, and it is the opposite of what an earlier audit had recorded.
Applied here to the two categories the task named: the five capitalised empty-state strings, now lower case, and the post overflow menu, whose two frontend-added rows were lower case among the design's sentence-case rows and are now sentence case.

## The commits that carry it

| Commit | What it does |
|--------|--------------|
| `5ad7d5b` | `feat(common): grow the app to a larger root scale` |
| `68aa4f0` | `feat(post): make the feed one centred column without card chrome` |
| `c90fd3e` | `feat(post): lay post detail out as two panes on a wide viewport` |
| `533b5d9` | `feat(common): add one motion vocabulary and a stronger overlay scrim` |
| `82bd017` | `feat(common): add a toast host and voice silent actions` |
| `95a910a` | `feat(notification): group by date and use per-type icons and colours` |
| `48b1ea8` | `feat(post): fix explore search form, uncap people, add empty states` |
| `6716c5c` | `fix(social): show requested state on a pending search follow` |
| `9cb88a2` | `feat(report): add completion animation, warning counter, and stroke` |
| `c237ffe` | `fix(common): apply the design's capitalisation to menus and empty states` |
| `457812c` | `fix(post): close the post detail overlay on escape` |

The scale, the layout, the motion, and the stage 3 items are separable in history, and this documentation is committed apart from the code.

## The documents

| File | Contents |
|------|----------|
| `layout-decisions.md` | The content width, the spacing ratio, the media cap, the post detail breakpoint, the grid columns, and the reasoning for each |
| `scale-decisions.md` | How the scale was changed at the root, the new values, and its effect on the frozen pages |
| `motion-vocabulary.md` | The durations, easings, which surface uses which, reduced motion, and the scrim |
| `changes-applied.md` | One entry per change, with the file touched |
| `design-divergences.md` | Every place this task deliberately differs from the design, and why |
| `verification-evidence.md` | Before and after screenshots, the section 12 check item by item, and what was not verified |
| `deferred-findings.md` | Everything found and not acted on |

## Backend repository was not touched

No file in the backend was created, modified, or deleted.

`git status` in `backend/` at the end of this work:

```
On branch develop
Your branch is up to date with 'origin/develop'.

Changes to be committed:
  (use "git restore --staged <file>..." to unstage)
	new file:   Makefile
```

This is not a clean tree, and it was not clean before this task started.
The staged `Makefile` predates this work and was recorded the same way by the lineage reconciliation before it.
Nothing in this task touched it.
The backend was read to confirm API contracts and to run the application for verification, which produces only gitignored build artifacts.
