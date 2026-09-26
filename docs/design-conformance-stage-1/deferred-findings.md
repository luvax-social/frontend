# Deferred Findings

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

Everything found during this stage and deliberately not acted on.

## 1. Audit statements that did not survive re-reading the design

The brief required every value to be re-read from the design source rather than taken from the audit.
Three statements changed as a result, which is the reason that rule exists.

### 1.1 The outline home door is a polyline, not a rectangle

The brief describes the design's outline `home` door as "a rectangle at a specific position and size".

The design's outline `home` is a roof path plus `polyline points="9 22 9 12 15 12 15 22"`.
The rectangle, `rect x=9 y=13 width=6 height=9 rx=1`, belongs to the **filled** variant.

Both were ported correctly, each to its own variant.
No action outstanding; recorded because the description would mislead the next reader.

### 1.2 The tab hit target claim is inverted

The brief passes on an audit finding that the tab hit target drops from 109px to 44px, and asks for it to be stated plainly if matching the design makes the target smaller.

It does the opposite.
The frontend had a fixed 44px width; the design flexes to about 109px.
Measured at 109 x 56 after the change.

No action outstanding.
Worth correcting in the audit so a future reader does not try to undo the improvement.

### 1.3 The desktop avatar was already conformant

The brief lists avatar size among eleven app bar differences.
The design specifies 32 and the desktop app bar already used 32.

The tablet avatar is 30, which may be what was measured, and tablet is out of scope.

## 2. Glyphs the design defines but never uses

`mail`, `userMinus` and `ban` are all defined in the design's outline table, and no design screen references any of them.
Verified across all six extracted chunks.

`userMinus` and `ban` were assigned to the unfollow and block rows as a derivation, explained in `design-decisions.md`.

`mail` has no call site.
It exists as a glyph because the design defines it, and whichever surface should use it is a question for a screen stage.

## 3. Other outline glyphs that differ from the design

This stage was scoped to the filled table, the outline `home`, and the three missing glyphs.
While reading the two tables side by side, other outline glyphs were also seen to differ.

| Glyph | Difference |
|-------|-----------|
| `flag` | The design draws a pennant with a separate pole line; the frontend draws a different two-path shape |
| `link` | Both are chain links but the path coordinates differ |
| `alert` | The frontend's is a bespoke circle plus line plus filled dot; the design's differs |

Not changed, because the brief named exactly which glyphs to touch.
Belongs to whichever stage revisits the icon set as a whole.

## 4. The delete row uses the wrong glyph, inconsistently

`PostCard.jsx` gives its delete row `icon: 'close'`.
`PostDetailScreen.jsx` gives its delete row `icon: 'trash'`.

The same destructive action shows a different glyph depending on which surface the menu opened from.
`trash` is clearly the right one and the design defines it.

Not changed, because the brief named only the two rows that needed the new glyphs, and the menus themselves are screen work.
Small and worth folding into the post card or post detail screen pass.

## 5. Forced lowercase on the button primitive

`textTransform: 'lowercase'` remains on `LxBtn`.

The design's button carries no `textTransform` at all, and the design's own voice is mixed by surface: menu items are Title Case, button labels lowercase, modal headings lowercase, modal buttons Title Case.

Explicitly deferred by the brief.
Removing it changes every label in the application at once and needs a per-surface copy decision that has not been made.

## 6. The desktop layout widths are a set

| Property | Design | Frontend |
|----------|--------|----------|
| App bar inner max width | 1280 | 1260 |
| Side column width | 300 | 280 |
| Right rail width | 300 | 280 |
| App bar grid columns | not a grid | `244px minmax(596px, 1fr) 276px` |

The design states its own arithmetic in a source comment: 300 plus 680 plus 300 is 1280.
The frontend's 1260 is internally coherent with its own 280 columns.

The rail's type values were brought into line and its width was not, because moving one term of the set leaves the layout asymmetric and narrows the feed.
The desktop shell layout was measured conformant and placed out of scope.

Either move all four together in a stage that owns the desktop layout, or record 1260 as an accepted divergence.
Do not move them one at a time.

## 7. Fabricated accounts still render, outside this stage's reach

Item 6 of the definition of done asks that no fabricated account render anywhere.
That is not true of the application after this stage, and it was not true before it.

The feed's story rail renders `sol.r`, `jo.x`, `ren.ko`, `lea.p`, `noa.b` and `mara.v`, visible in both the desktop and mobile screenshots.
Three of those names are the design's hardcoded suggested users; all six are invented people with no data source.

This stage added none of them and removed none of them.
The story rail is feed screen work, explicitly out of scope, and removing it would change what the feed renders.

The part of item 6 this stage controls is met: the suggested composition renders nothing when handed nothing, and no invented name, bio or avatar index from the design appears anywhere in the code this stage wrote.

Flagged prominently because the definition of done cannot be honestly ticked without saying where the remaining ones are.
Belongs to the feed screen stage.

## 8. The double-mounted video

Opening post detail over the feed mounts the same video element twice, once in the card behind and once in the overlay.

This stage muted all four call sites, which removes the audible symptom, and the brief states the double-mount itself is a separate problem.

Still outstanding.
It is also a wasted network fetch and two decoders for one video, not only an audio problem.

## 9. The explore grid thumbnail has no controls

Three of the four video elements carry `controls`; the explore grid does not.

The mute rule is about mute and was applied to all four.
Whether a grid thumbnail should be playable at all is an explore screen question.

## 10. Left alone as instructed

Recorded so a reader knows they were seen rather than missed.

| Item | Why |
|------|-----|
| Tablet branch | Out of scope. Every changed value is behind a conditional whose tablet arm keeps its previous literal value |
| Dropdown menu | The frontend's version is kept by settled position |
| The design's `LxTag` transition | The design has none and the frontend has one; a frontend improvement, not a divergence to correct |
| Report modal buttons | Already correct at `ReportModal.jsx:224`, and instructed not to touch |
| Auth and landing pages | Frozen. The button primitive changed underneath them, which is noted in the verification evidence |
| Screen-specific work | Feed, profile, notifications, explore, settings, post detail, composer, report modal |
| Carousels, like-state, `ConfirmModal`, toasts | Out of scope |
| Media aspect ratios, posters, lazy loading, blurhash, pause-on-scroll | Out of scope |
| Empty states, copy capitalisation | Out of scope |
| Lint | Out of scope |

## 11. Environment observations

Not code findings, but they affected this session and will affect the next.

The `docs/video-test/` directory in the frontend is untracked and was not created by this stage.
It was left alone.

The backend repository at `Luvax/backend` has a staged `Makefile` dated 10 August that predates this work.
It is untouched and is noted in `README.md` so the git status output there is not misread as this stage having modified the backend.

The browser automation tool resolves relative output paths against the session working directory, which was a backend clone.
It wrote screenshots and console logs there twice.
Both times they were moved to scratch and the clone was reconfirmed clean.
Anyone repeating this verification should set the output directory explicitly or work from the frontend directory.
