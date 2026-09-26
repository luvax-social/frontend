# Response to the review

> Record of work done on 2026-08-24. Not maintained; it is correct as of that date and is not updated as the code moves.

The review named four things. Each is answered below with the evidence.

---

## 1. "There is no way into the panel except typing the URL"

**Done.** A `panel` entry now sits in the user-facing side rail, directly above
`settings`, for a privileged account only.

- It uses the rail's own row shape: the same `lx-tab-btn` class, the same row,
  icon-wrap and label styles as its neighbours, the same icon component at the
  same size and stroke, the same lowercase label, the same hover and active
  treatment. It is not a special-looking button.
- Role comes from `isPanelRole(role)` on the auth store — the same source the
  panel's own guards use. Nothing new was introduced to answer "is this person
  privileged".
- **It cannot flash.** The role is held in memory and is absent until the session
  is established, so the gate reads false first and turns true when the role
  arrives. An ordinary account goes `null → 'user'`, which is false throughout.
  Polled 41 times across the first 2.5 seconds of an ordinary account's load:
  never present.
- **Leaving is as reachable as entering.** The panel header now carries
  `back to luvax` beside the theme control and sign out.

Evidence: `screens/after-entrypoint-privileged-admin-dark.png` (present, directly
above settings), `screens/after-entrypoint-ordinary-account-absent-dark.png`
(absent). Verified in the DOM: nav order ends `… profile, panel, profile
settings` for the administrator, and `… profile, profile settings` for the
ordinary account.

**One gap, not closed, recorded instead.** The rail is the desktop and tablet
navigation; at phone width the application shows a bottom bar that has no
settings entry to sit above. A privileged account on a phone therefore still has
no entry point. Closing that means either inventing a placement the review did
not ask for or growing the change in an application that is finished and in
review, so it is written up in `deferred-findings.md` instead.

---

## 2. "The panel occupies roughly half the viewport, and opening a record navigates away from the list"

**Done, both halves.**

**The wasted viewport** was `.lx-admin-content { max-width: 1120px }`. On a
1920-wide screen that left roughly a third of the window empty beside a 232px
rail. The cap is gone; every screen now uses the width it has.

**Opening a record** no longer replaces the list. On reports and accounts the
list holds the left region and the selected record fills the right. Selecting
another record swaps only the right region — no back navigation is involved in
moving between records.

Verified, not assumed:

- **The list does not reload.** With a network recorder installed, selecting a
  record fired only that record's own four requests; selecting a second fired
  only the second record's four. No list request in either case
  (`listRequestFired: false`).
- **The URL still addresses the record**, at `?selected=<id>`; pasted into a
  fresh tab it restored the split, the correct selected row and the detail.
- **Back walks records, not out of the panel**: `?selected=21f51a1b` → back →
  `?selected=f2bc69b5` → back → `/admin/reports`.
- **Every pre-existing URL still works.** `/admin/reports/:reportId` and
  `/admin/users/:userId` both still render standalone, unchanged, with their own
  back links — including for a moderator, who reaches the account record from the
  action log.
- **Nothing selected explains itself**: "no report open — pick a report from the
  queue to see what was reported, who reported it, and what can be done about it."
- **Both regions scroll independently**; a long detail cannot scroll the list away.
- **The selected row is visibly selected** — accent fill plus a bar on its leading
  edge, so the state survives a colour-blind reading.
- **Keyboard**: rows take focus and answer Enter and Space; when the open record
  changes, focus moves into the detail region and it scrolls to its own top.
- **At a narrow width it is not a split**: full-width list, or full-width detail
  with a way back. Measured on all eight screens at 414px — no horizontal page
  scroll anywhere.

Which screens took the pattern, and why the others did not, is in
`design-decisions.md` §1.

Evidence: `screens/after-reports-second-record-selected-dark-desktop.png`,
`screens/after-account-detail-light-desktop.png`,
`screens/after-accounts-empty-detail-light-desktop.png`,
`screens/after-reports-list-light-narrow.png`,
`screens/after-reports-detail-dark-narrow.png`.

---

## 3. "The interface is unpolished"

Four named faults; each treated as a symptom and fixed everywhere.

**Dropdowns did not match the buttons beside them.** The action log's action-type
`<select>` and both `datetime-local` inputs were rectangular, differently sized,
and the select had `outline: none`, which deleted its focus ring. There is now
one control shape — pill, one-pixel border, 12px/500, 30px tall — defined once
and worn by every select, date input and button in the panel, with one focus
ring and one disabled treatment. See `design-decisions.md` §2 for the
native-versus-listbox decision.
Evidence: `screens/before-actions-light-desktop.png` →
`screens/after-actions-light-desktop.png`.

**Filters were crowded and misclickable.** Conditions sat adjacent with only a
gap, reading as one run of chips. Each condition now sits on its own bounded,
labelled plate with real separation. Groups wrap rather than compress. The clear
affordance is pushed to the end of the bar, away from where a condition control
is expected, and now reads `clear filters`. A narrow-width defect found while
testing this: held at desktop width the groups overflowed a card that clips
rather than scrolls, putting the last options out of reach — at narrow widths each
group now takes the full width and its chips wrap inside it.
Evidence: `screens/before-reports-light-desktop.png` →
`screens/after-reports-light-desktop.png`.

**Text was too small and too close in colour to its background.** Measured, not
judged, across all eight screens in both themes. Before: five failing roles in
dark (all `--lx-ink-3`, 3.58–3.74) and five in light (down to 2.08). After: zero
failing roles anywhere, worst role 6.58 in dark and 5.15 in light. Size: every
10px label moved to 11px. No token was invented and no hex introduced. Full
numbers, the three substitutions, and a recorded divergence from the design
export are in `contrast-audit.md`.

**Images were thumbnails that could not be opened.** Media anywhere in the panel
— the reported content on a report, and every post on an account's content tab —
now opens a full viewer with forward and back across that record's media. Escape
closes it, arrows move between items, focus returns to the thumbnail it was
opened from. Verified by driving it: opened at item 2 of 4, ArrowRight took it to
3/4, Escape closed it, and focus landed back on "open reported media, item 2 of
4". It matches the application's post viewer deliberately rather than reusing it;
the reason is in `design-decisions.md` §3. No dependency was added.
Evidence: `screens/after-media-viewer-open-dark-desktop.png`.

---

## 4. "Theme switching does not work everywhere it should"

**Done, and the cause was a real bug rather than a missing control.**

The review's guess was that the panel had a control and the application did not.
The truth was the other way round: the application had the control, the panel had
none, and underneath both a storage bug meant a manual dark choice could never
survive a load.

`lxDarkManual` is a flag saying a choice was made; `lxDark` holds the value.
`main.jsx` read the flag as though it were the value, so `'1' === 'true'` was
false and **every manual choice resolved to light**. In the application
`LuvaxApp` mounted a moment later and corrected it — a flash of the wrong theme
on every load. In the panel nothing mounts to correct it, so dark was
unreachable entirely.

Reproduced before the fix: with `lxDarkManual='1'` and `lxDark='true'` stored,
the panel loaded with `data-theme="light"` and a light background —
`screens/before-theme-bug-dark-requested-renders-light.png`.

Fixed at the source: `main.jsx` now reads both keys as the application writes
them. A theme control was added to the panel header, using that same contract
through a small shared hook rather than a second mechanism. Verified after: the
panel toggle flips the theme, the choice survives a reload with no flash, and
writing exactly what the settings screen writes now produces the right theme in
*both* the application and the panel. System preference remains the default until
a choice is stored.

Every panel screen was then checked in both themes, which is what the contrast
measurement above covers.

---

## Nothing from the review was declined

All four were acted on. Three things the review implied and this phase concluded
were already correct — the table's internal horizontal scroll, `--lx-ink-3`'s
continued existence outside the panel, and the 26px screen title — are argued in
`design-decisions.md` §6. The one item not closed, the phone-width entry point,
is in `deferred-findings.md`.
