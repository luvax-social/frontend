# Orchestrator brief — admin panel: layout, entry point, visual polish

> Record of work done on 2026-08-24. Not maintained; it is correct as of that date and is not updated as the code moves.

For the planner. No codebase access assumed, no application run required.

## Outcome

All four review findings are closed. No request changed, no capability was added,
no dependency was added, no file was moved, and the backend was not touched. 68
existing unit tests still pass; 10 new ones cover the selection helper.

## Architectural decisions, and the option rejected in each

**1. The open record is a search parameter, not a nested route.**
Rejected: nesting the detail route under the list route, which is the better
pattern and was the first choice. It was rejected on a hard constraint. The
account *list* is administrator-only; the account *detail* is deliberately not,
because a moderator reaches it from the action log. Nesting would have put the
detail behind the administrator guard and removed a screen moderators have today.
Moving the list out from behind the guard instead would make it mount for a
moderator and fire the request the guard exists to prevent (the backend answers
403). Reports could have been nested, but using two different mechanisms for one
pattern was worse than using one that works for both. Consequence: `?selected=`
on the list screen, and **every path that worked before is untouched**.

**2. Select controls stay native; the shape is what was unified.**
Rejected: converting everything to the in-DOM listbox an earlier phase built.
That listbox renders a description and an unavailability reason per option, which
a native `<option>` cannot carry, so it stays where it is needed. Everything else
is native and now wears one shape — pill, one-pixel border, 12px/500, 30px tall —
defined once. This also restored a focus ring that `outline: none` had deleted.

**3. The media viewer was matched, not reused.**
Rejected: reusing `PostDetailScreen`, the overlay the application opens for a
post. It is a route-level component in another feature that loads comments and
offers liking, saving and commenting. Reusing it would have imported across
features, fired requests this phase may not add, and given a moderation surface
the ability to interact with the content it judges. The new component copies its
behaviour and appearance deliberately, including the same shared Escape hook.

**4. The theme fault was a bug, not a missing control.**
The review guessed the panel had a control and the application did not. It was
the reverse, with a defect underneath: `lxDarkManual` is a flag and `lxDark` is
the value, but the pre-mount bootstrap read the flag as the value, so **every**
manual choice resolved to light. The application flashed and self-corrected; the
panel, with nothing to correct it, could never render dark. Fixed at the source
in `main.jsx`; a control was added to the panel using the same contract.

## Which screens took master-and-detail

**Took it:** reports, accounts — a list whose records have a detail of their own.

**Did not, with reason:** escalated and my escalations (their rows open a report
at a URL the reports screen owns; a split would mint a second address for the
same record); actions (already has an in-place detail drawer addressed by
`?action=` — converting it would be a behaviour change for no gain); hashtags and
activity (no detail route exists); statistics (no list). All of these now use the
full window, which was the other half of the wasted-viewport complaint.

## Contrast, before and after

Measured with a scripted WCAG audit over eight screens in both themes, not judged
by eye.

| | Failing text roles | Worst ratio |
|---|---|---|
| Before, dark | 5 | 3.58 |
| Before, light | 5 | 2.08 |
| **After, dark** | **0** | **6.58** |
| **After, light** | **0** | **5.15** |

Three substitutions, no invented token and no hex: `--lx-ink-3` → `--lx-ink-2`
for panel text (147 sites, one token explained every dark-theme failure);
`--lx-ink-inverse` → `--lx-black` on the accent fill (the accent is
theme-invariant, so the label cannot use a token that flips — this was 2.08);
and the status badge's tone moved from its label into its fill and border, with
the label on `--lx-ink`, because no semantic token is dark enough in the light
theme and inventing one was forbidden. Separately, every 10px label moved to
11px.

## What the review implied should change and was judged already correct

- **The record table's internal horizontal scroll at narrow widths.** The page
  body never scrolls sideways at any width, which is the requirement; the
  alternative hides columns a reviewer needs.
- **`--lx-ink-3` itself.** It remains the right token for a decorative mark and is
  untouched outside the panel. The fix was to stop using it for content.
- **The 26px screen title**, above the export's 22px maximum. The export has no
  page-title role — its 22px is a wordmark — so this stays derived work rather
  than being shrunk to match a value that means something else.

## What could not be verified

Two things, both tooling limits rather than gaps in the work.

**Two role contexts could not be held open simultaneously.** The browser exposes
one storage partition, so a second sign-in replaces the first. Both role trees
were driven end to end sequentially instead. No check was reduced.

**The network comparison against the previous phase is a reading, not a diff.**
That phase recorded its traffic per screen as prose rather than as a
machine-comparable capture, so the live log was read against it by hand. The
finding is that no request's URL, parameters, body or timing changed, and the
only difference in traffic is an absence: selecting a record inside the split
fires the detail's requests *without* the list request a full navigation used to
trigger. Fewer requests, none different.

## One thing left open

A privileged account at phone width still has no entry point. The rail is the
desktop and tablet navigation; the phone bottom bar has no settings entry for the
new one to sit above. Closing it means choosing a placement the review did not
specify, in an application that is finished and in review. It is written up in
`deferred-findings.md` along with five other observations, including that the
design export's own small-label role fails AA product-wide.
