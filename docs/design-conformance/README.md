# Design Conformance Audit

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

## What this is

This directory measures the distance between the committed design export and the implemented frontend.

It is a measurement, not a change.
No interface code was written, no defect was fixed, and no token, spacing value, or colour was adjusted.
Everything found is recorded here instead.

The purpose is to size the conformance work accurately enough to plan against, so the implementation phase does not discover missing screens halfway through.

## When it was run

Audit date: 2026-08-13.

| Repository | Branch | HEAD at audit time |
|------------|--------|--------------------|
| Frontend | `develop` | `bb4996c1cdc0847a2b8dcfe14e0fa951fb083841` |
| Backend | `develop` | `42f61479eeed04bc5583f424771203b25f09d6c5` |

Design reference: `docs/design/Luvax.html`, 1,071,874 bytes, as committed at the frontend HEAD above.

## How the design export was read

The export is a self-extracting bundle.
The extraction procedure documented in `docs/design/README.md` was run unmodified and reproduced the documented manifest exactly: 29 entries, of which six are JavaScript.

| Chunk | Size | Contents |
|-------|------|----------|
| `ed9a0c12-...` | 176,988 B | Token stylesheet, `LxIcon` and its icon tables, every primitive, every screen except messages, `App` |
| `9bffeb59-...` | 30,633 B | `LxMenu`, `ReportModal`, `CommentModal`, `LxHeaderSearch`, `ConfirmModal`, toast |
| `3b513cf1-...` | 44,507 B | `MessagesScreen`, `ConvRow`, `ConvOptionsMenu`, `MsgMenu` |

The remaining three JavaScript entries are React, React DOM, and the design-tool runtime, and were ignored.
Chunks were extracted to a scratch directory outside both repositories and were not committed.

The orientation carried into this audit was partly wrong and is corrected in the reports.
The export defines 31 CSS custom properties rather than an unspecified "full token set", exposes 27 outline icons with 7 filled variants, defines 20 primitives, and routes 11 screens.

## How to read these files

| File | What it answers |
|------|-----------------|
| `screen-inventory.md` | Which screens exist on each side, and a verdict on every screen that exists on only one |
| `screen-differences.md` | For each screen present on both sides, which concrete values differ |
| `token-audit.md` | Whether the token layer conforms, verified independently |
| `primitive-audit.md` | Prop surface, variants, and states for every primitive, plus the full icon comparison |
| `derived-treatments.md` | Loading, empty, error, and disabled treatments the frontend invented because the design defines none |
| `known-divergences.md` | The eight divergences carried in from earlier phases, each confirmed or cleared |
| `implementation-plan.md` | Effort size per screen and a proposed sequence |

## Source-read versus observed

Findings from reading source and findings from looking at the running application are not equally reliable, so every finding is tagged.

- **[source]** means the difference was established by comparing the design JavaScript against the frontend JavaScript. This is the majority of findings and is exact for any value written as a literal.
- **[observed]** means the difference was established by rendering both applications and measuring. This is used where a value is computed at runtime, or where layout geometry is the thing in question.

Where the two disagree, observed wins.
One finding in `token-audit.md` was reversed by observation after source reading suggested a divergence that does not exist at runtime.

## What was rendered

Both applications were started and measured at a 1440 x 900 desktop viewport.

- The design export was served over HTTP from a scratch copy and rendered from the committed file.
- The frontend was rendered from the running Vite dev server at `localhost:5173`, signed in as the seeded account `luvax_ava`, against the running backend at `localhost:8080`.

The seeded feed returned no posts, so the feed body could not be observed with content.
Profile, explore, and the shell were observed with real data.
Screenshots and geometry measurements were written to the scratch directory, not to either repository.

## Coverage depth

Coverage is not uniform, and `screen-differences.md` states the depth reached for every screen.

Full property-by-property comparison was completed for the token layer, every primitive, the icon tables, the application shell, the post card, the feed, the profile, explore, notifications, settings, and the report and comment modals.

The composer, post detail, story viewer, story composer, onboarding, and messages screens received a structural comparison only.
Their entries record the differences that were established and state plainly what was not measured, rather than guessing.
Closing those gaps needs roughly a further 2,000 lines read on each side and is the first thing to do if the sizing in `implementation-plan.md` needs to be tighter.

## Working tree state

Verified at the end of the audit.

Frontend:

```
$ git status --short --branch
## develop...origin/develop
```

That status was captured before the reports were written.
The frontend tree was otherwise clean, and this phase adds exactly two things: this directory, and one line in `CHANGELOG.md` as the project changelog rule requires.
No existing frontend file was modified.

The browser automation wrote screenshots into the frontend working directory during the run.
They were moved to the scratch directory and the tree was re-verified before committing.

One em dash appears in `screen-differences.md`, inside a backticked verbatim quote of the design's own string `optional — helps our team review faster`.
The house style forbids the em dash in prose, but altering a quoted source literal would make the audit inaccurate, so the quote is reproduced exactly.

Backend:

```
$ git status --short --branch
## develop...origin/develop
A  Makefile
```

The backend tree was **not** clean at audit time.
One staged file, `Makefile`, was already in the index before this audit started.
This audit never wrote to the backend repository and did not create it.
It is recorded here because the audit was required to paste the status output, and reporting it as clean would be false.
