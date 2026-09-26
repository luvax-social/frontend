# Changes applied, by area

> Record of work done on 2026-08-24. Not maintained; it is correct as of that date and is not updated as the code moves.

No dependency was added. No file was moved, renamed or reorganised. No
TypeScript file exists. Nothing in the backend repository was modified — its
working tree is clean and its branch pointer is untouched.

---

## A. Files touched in the user-facing application

These are called out separately because that application is finished and in
review. Four files, each justified, each kept as small as it could be.

### `src/main.jsx` — 8 lines

Theme applied before React mounts. It read `lxDarkManual` as though that key
carried the chosen value; it is a flag, and the value lives in `lxDark`. Every
manual choice therefore resolved to light.

**Why it had to be touched.** This is the root cause of the review's fourth
finding, and it is not fixable from inside the panel: the attribute is set before
any route renders. Fixing it in the panel only would have left the application
flashing the wrong theme on every load. The function now reads both keys exactly
as the application already writes them; nothing else in the file changed.

### `src/features/luvax/components/shell.jsx` — 16 lines

The entry point (§3 of the brief). Adds one import, one store read, one derived
boolean, and one conditionally rendered rail button directly above the settings
button.

**Why it had to be touched.** The brief requires the entry to sit in the
application's navigation, directly above settings. That is this file. The button
reuses the row's existing `rowStyle`, `iconWrapStyle` and `labelStyle` rather than
introducing styling of its own, so it cannot drift from its neighbours. Nothing
existing was modified — the change is purely additive.

### `src/features/luvax/components/primitives.jsx` — 1 line

`LxBtn` variant `primary`: label token `--lx-ink-inverse` → `--lx-black`.

**Why it had to be touched.** Measured at **2.08:1** in the light theme — a
near-white label on the light tan accent. The accent is the same colour in both
themes, so the label cannot use a token that flips with the theme; `--lx-black`
is theme-invariant and clears 9:1 on the accent in both. The panel's `apply` and
confirm buttons are `LxBtn`, so the panel could not reach its 4.5:1 bar without
this. It is one token on one line and cannot affect layout.

**It also fixes the same failure everywhere else in the product**, which is a
side effect worth stating plainly rather than hiding: every primary button in
the user-facing application was below AA in the light theme and now is not.

### `src/components/ui/lx-icon.jsx` — 8 lines

Adds two glyphs, `sun` and `moon`, to the existing inline-SVG icon set.

**Why it had to be touched.** The panel's theme control needs a recognisable
glyph and the set had none. The constraint bars a new icon *dependency*, not a
new glyph in the component the constraint names. The change is purely additive —
no existing glyph was altered, so no existing icon can regress.

### `src/hooks/useThemeChoice.js` — new, shared

Not application code, but it sits in the shared `src/hooks/` layer. It
encapsulates the existing two-key storage contract for consumers that render
outside the application shell — which is the panel. It exists so the panel does
not grow a second, rival theme mechanism.

---

## B. The panel — layout

- **`components/panelStyles.js`** — substantially rewritten. Removed the
  `max-width: 1120px` cap that wasted the viewport. Added the split layout
  (`.lx-admin-split` and its two independently scrolling regions), its narrow
  collapse, the selected-row treatment, the back control, the control
  vocabulary, one focus ring, the filter-group plates, and the media grid. Every
  colour is an `--lx-*` token; every space and radius is a scale variable.
- **`components/SplitView.jsx`** — new. The two regions, the empty right region
  that explains itself, and the focus move when the open record changes.
- **`lib/splitSelection.js`** — new. Derives the open record from `?selected`,
  carries every other parameter through, and treats a selection the list does not
  contain as a stale link.
- **`screens/ReportQueueScreen.jsx`** — renders through `SplitView`; rows select
  rather than navigate. What it fetches is unchanged.
- **`screens/AccountListScreen.jsx`** — the same.
- **`screens/ReportDetailScreen.jsx`**, **`screens/AccountModerationScreen.jsx`**
  — each takes an optional id and an `embedded` flag, so one implementation
  serves both the standalone route and the right region. On the standalone route
  the behaviour is byte-for-byte what it was.
- **`components/RecordTable.jsx`** — takes `selectedKey`; rows became focusable
  and answer Enter and Space; header size and colour corrected.

## C. The panel — controls

- **`components/FilterBar.jsx`** — each condition on its own bounded, labelled
  plate; groups wrap rather than compress; the clear affordance moved to the end
  of the bar and now reads `clear filters`.
- **`screens/AuditLogScreen.jsx`** — the native action-type `<select>` moved onto
  the shared control class, which also restored the focus ring its
  `outline: none` had deleted.
- **`components/DateRangeControl.jsx`** — both `datetime-local` inputs moved to
  the control shape (pill, 30px) and given a sensible maximum width so they no
  longer stretch across a full-width screen.
- **`components/AdminShell.jsx`** — header now carries `back to luvax`, the theme
  control and sign out as one group of matching controls, each with an
  accessible name; nav icons and the `@username` moved off the failing token.

## D. The panel — media

- **`components/AdminMediaViewer.jsx`** — new. A thumbnail grid whose items open
  a full viewer with forward and back, Escape to close, arrow keys, and focus
  returned to origin.
- **`screens/ReportDetailScreen.jsx`** and **`components/AccountContent.jsx`** —
  both replaced a plain, unopenable `<img>` grid with it.

## E. The panel — legibility, applied across every file

- `--lx-ink-3` → `--lx-ink-2` for text, **147 occurrences across 29 files**.
- `fontSize: 10` → `11`, **33 occurrences**.
- **`components/StatusBadge.jsx`** — the tone moved from the label into the fill
  and a matching border; the label is now `--lx-ink`.
- `.lx-admin-badge` — label moved to `--lx-black` on the accent fill.

The two sweeps touched these files without changing anything but a colour token
or a font size: `AccountDisciplinePanel`, `AccountLifecyclePanel`,
`AccountSearchPicker`, `AccountSessionsPanel`, `ActionDetailDrawer`,
`HashtagCreateDialog`, `ListStates`, `LocalTime`, `NotAvailable`, `PanelPage`,
`ReasonConfirmDialog`, `ReasonSelect`, `ReporterName`, `RoleChangeDialog`,
`SuspendDialog`, `TimeseriesChart`, `ViolationHistory`, `WarnDialog`,
`ActivityLogScreen`, `HashtagRegistryScreen`, `MyEscalationsScreen`,
`StatisticsScreen`.

## F. Tests

- **`tests/unit/admin/splitSelection.test.js`** — new, 10 cases over the
  selection helper. The existing 68 tests still pass.

---

## What was deliberately not changed

- No request's URL, parameters, body or timing. Verified against the network log.
- No control does anything different, other than a list row now selecting in
  place instead of navigating away — which is the change the phase exists to make.
- No route was added, removed or re-parented. Every path that resolved before
  resolves now.
- No new colour token; no raw hex in anything this phase added.
