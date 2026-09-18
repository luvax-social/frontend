/**
 * The panel's own layout CSS, kept inside the panel rather than added to the
 * global stylesheet. Every colour references an --lx-* token; no raw hex
 * appears here. Spacing and radius use the existing scale variables. Motion
 * uses the existing durations and easings, so the reduced-motion rule in the
 * global stylesheet neutralises these transitions along with the rest.
 *
 * The layout is desktop-first: a fixed navigation rail beside a content column.
 * Below a narrow breakpoint the rail becomes a horizontal bar at the top rather
 * than adopting the user-facing application's bottom navigation.
 *
 * Two vocabularies are held here deliberately.
 *
 * Controls. The design export gives one shape for anything clickable: a pill at
 * --radius-pill, a one-pixel --lx-border, body type at 12px/500, and a control
 * around 28-30px tall. Native selects, native date inputs and the panel's own
 * buttons are all brought onto that shape here so a control never looks foreign
 * beside the button it sits next to.
 *
 * Muted text. The export renders its small uppercase labels in --lx-ink-3,
 * which measures about 2.8:1 on the light base and 3.6:1 on the dark one. That
 * is below the 4.5:1 this surface is held to, so every label the panel treats
 * as readable content uses --lx-ink-2 instead. This is a recorded divergence
 * from the export, not an oversight, and no token was invented for it:
 * --lx-ink-3 remains in use for genuinely decorative marks.
 */
export const PANEL_CSS = `
.lx-admin-shell {
  display: grid;
  grid-template-columns: 232px minmax(0, 1fr);
  min-height: 100vh;
  background: var(--lx-base);
  color: var(--lx-ink);
  font-family: var(--font-body);
}
.lx-admin-sidebar {
  position: sticky;
  top: 0;
  align-self: start;
  height: 100vh;
  overflow-y: auto;
  border-right: 1px solid var(--lx-border);
  background: var(--lx-surface-sunken);
  padding: var(--space-4) var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
.lx-admin-brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-2) 0;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 18px;
  letter-spacing: -0.02em;
  color: var(--lx-ink);
}
.lx-admin-nav { display: flex; flex-direction: column; gap: var(--space-6); }
.lx-admin-nav-group { display: flex; flex-direction: column; gap: 2px; }
.lx-admin-nav-heading {
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--lx-ink-2);
  padding: 0 var(--space-2) var(--space-1);
}
.lx-admin-navlink {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 9px var(--space-3);
  border-radius: var(--radius-md);
  color: var(--lx-ink-2);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out);
}
.lx-admin-navlink:hover { background: var(--lx-surface); color: var(--lx-ink); }
.lx-admin-navlink.is-active { background: var(--lx-accent-dim); color: var(--lx-accent-text); }
.lx-admin-badge {
  margin-left: auto;
  min-width: 20px;
  height: 18px;
  padding: 0 6px;
  border-radius: var(--radius-pill);
  background: var(--lx-accent);
  /* The accent fill is the same colour in both themes, so the label cannot use
     a token that flips with the theme. --lx-ink-inverse measured 2.08:1 here in
     the light theme. --lx-black is theme-invariant and clears 9:1 on the accent
     in both. */
  color: var(--lx-black);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* The main column owns the viewport height so a split screen can give each of
   its two regions its own scrollbar. Screens that do not split keep scrolling
   as one column, which is what .lx-admin-content still does. */
.lx-admin-main { display: flex; flex-direction: column; min-width: 0; height: 100vh; }
.lx-admin-header {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-6);
  border-bottom: 1px solid var(--lx-border);
  background: var(--lx-glass-bg);
  backdrop-filter: blur(12px);
}
.lx-admin-header-actions { display: flex; align-items: center; gap: var(--space-2); }
.lx-admin-content {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-6);
  width: 100%;
}
/* A split screen manages its own padding and scrolling inside the two regions,
   so the wrapper's own padding is dropped for it — otherwise the wrapper's
   band stacks with each region's own inset, doubling the gap along the split's
   outer edges. Detected structurally with :has() rather than a class the
   screen would need to remember to add: :has(> .lx-admin-split) carries higher
   specificity than the plain .lx-admin-content rules above and in the narrow
   breakpoint below, so this wins over both without an !important. */
.lx-admin-content:has(> .lx-admin-split) { overflow: hidden; padding: 0; }

/* ─── Control vocabulary ─────────────────────────────────────────────────
   One shape for every clickable or editable control, taken from the design
   export's button: pill, one-pixel border, 12px/500 body type. */
.lx-admin-control,
.lx-admin-select,
.lx-admin-shell input[type="date"],
.lx-admin-shell input[type="datetime-local"],
.lx-admin-shell input[type="time"] {
  appearance: none;
  -webkit-appearance: none;
  height: 30px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-pill);
  border: 1px solid var(--lx-border);
  background: var(--lx-base);
  color: var(--lx-ink);
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 500;
  line-height: 28px;
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out),
              border-color var(--duration-fast) var(--ease-out);
}
/* The chevron is drawn from the border token so a native select carries the
   same affordance as the panel's own menus without a background image file. */
.lx-admin-select {
  padding-right: var(--space-8);
  background-image:
    linear-gradient(45deg, transparent 50%, var(--lx-ink-2) 50%),
    linear-gradient(135deg, var(--lx-ink-2) 50%, transparent 50%);
  background-position:
    calc(100% - 16px) calc(50% + 1px),
    calc(100% - 11px) calc(50% + 1px);
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
}
.lx-admin-control:hover,
.lx-admin-select:hover,
.lx-admin-shell input[type="date"]:hover,
.lx-admin-shell input[type="datetime-local"]:hover {
  background: var(--lx-surface);
  border-color: var(--lx-border-strong);
}
.lx-admin-control:disabled,
.lx-admin-select:disabled,
.lx-admin-shell input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--lx-surface-sunken);
  border-color: var(--lx-border);
}
.lx-admin-select option:disabled { color: var(--lx-ink-3); }
/* A native date input paints its own inner widgets; these keep them on the
   panel's ink rather than the browser's default near-black. */
.lx-admin-shell input[type="date"],
.lx-admin-shell input[type="datetime-local"] {
  font-family: var(--font-mono);
  cursor: text;
}
.lx-admin-shell input[type="date"]::-webkit-calendar-picker-indicator,
.lx-admin-shell input[type="datetime-local"]::-webkit-calendar-picker-indicator {
  cursor: pointer;
  opacity: 0.7;
}
.lx-admin-text-input {
  height: 30px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-pill);
  border: 1px solid var(--lx-border);
  background: var(--lx-base);
  color: var(--lx-ink);
  font-family: var(--font-body);
  font-size: 12px;
  width: 100%;
}
.lx-admin-text-input::placeholder { color: var(--lx-ink-2); }

/* One focus ring for the whole panel, on a token that stays visible against
   every surface in both themes. */
.lx-admin-shell :is(a, button, select, input, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--lx-accent-text);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

.lx-admin-signout {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  height: 30px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-pill);
  border: 1px solid var(--lx-border);
  background: transparent;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 500;
  color: var(--lx-ink-2);
  text-decoration: none;
  transition: background var(--duration-fast) var(--ease-out);
}
.lx-admin-signout:hover { background: var(--lx-surface); color: var(--lx-ink); }

.lx-admin-row:hover { background: var(--lx-surface); }
.lx-admin-panel-card {
  background: var(--lx-surface-sunken);
  border: 1px solid var(--lx-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

/* ─── Filter bar ─────────────────────────────────────────────────────────
   Each condition is its own labelled group on its own bounded plate, so two
   adjacent conditions cannot read as one run of chips. Groups wrap onto the
   next line rather than compressing. */
.lx-admin-filterbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--lx-border);
}
.lx-admin-filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex: 0 0 auto;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--lx-border-subtle);
  border-radius: var(--radius-lg);
  background: var(--lx-surface-sunken);
}
.lx-admin-filter-label {
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--lx-ink-2);
}
.lx-admin-filter-options { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
/* The clear affordance sits apart from the conditions, pushed to the end of the
   bar, so it is never where a condition control is expected. */
.lx-admin-filter-clear { margin-left: auto; align-self: center; }

/* ─── Master and detail ──────────────────────────────────────────────────
   The list holds the left region and the selected record fills the right. Each
   region scrolls on its own, so a long detail never scrolls the list away. */
.lx-admin-split {
  display: grid;
  grid-template-columns: minmax(460px, 44%) minmax(0, 1fr);
  height: 100%;
  min-height: 0;
}
/* The table sizes to the region it is in rather than to its standalone
   minimum, so the list pane never clips a column or scrolls sideways. */
/* Deliberately NOT table-layout: fixed. Fixed layout honours the declared
   widths but clips anything wider than its share rather than growing it, which
   truncated the status badge mid-word and ran it under the next column. Auto
   layout keeps the badges intact; the subject gets its share by being the one
   column that declares a large width while the rest size to their content. */
.lx-admin-split-list table { min-width: 0 !important; }
.lx-admin-split-list {
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  border-right: 1px solid var(--lx-border);
  padding: var(--space-6) var(--space-4) var(--space-6) var(--space-6);
}
.lx-admin-split-detail {
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-6);
}
/* Every other surface in the panel — the list, and each section of a populated
   detail — sits inside a bordered .lx-admin-panel-card. An empty detail region
   drawn as bare centred text had no such frame, so it read as leftover space
   next to the list's contained card rather than as the panel's other half.
   This gives it the same border and fill, so the pair reads as two matching
   panes even with nothing selected. */
.lx-admin-detail-empty {
  height: 100%;
  min-height: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  text-align: center;
  padding: var(--space-8);
  color: var(--lx-ink-2);
  background: var(--lx-surface-sunken);
  border: 1px solid var(--lx-border);
  border-radius: var(--radius-lg);
}
.lx-admin-detail-empty h2 {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 600;
  color: var(--lx-ink);
}
.lx-admin-detail-empty p { font-size: 13px; max-width: 34ch; color: var(--lx-ink-2); }

/* The selected row is marked on its leading edge as well as by fill, so the
   selection survives a colour-blind reading and a low-contrast display. */
.lx-admin-row.is-selected,
.lx-admin-selectable.is-selected {
  background: var(--lx-accent-dim);
  box-shadow: inset 3px 0 0 0 var(--lx-accent);
}
.lx-admin-selectable { cursor: pointer; }
.lx-admin-back {
  display: none;
  align-items: center;
  gap: var(--space-2);
  height: 30px;
  padding: 0 var(--space-3);
  margin-bottom: var(--space-4);
  border-radius: var(--radius-pill);
  border: 1px solid var(--lx-border);
  background: transparent;
  color: var(--lx-ink-2);
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}
.lx-admin-back:hover { background: var(--lx-surface); color: var(--lx-ink); }

/* ─── Media ──────────────────────────────────────────────────────────────
   Thumbnails open a full viewer. The grid is the panel's own; the viewer's
   controls follow the user-facing post carousel. */
.lx-admin-media-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.lx-admin-media-thumb {
  width: 96px;
  height: 96px;
  padding: 0;
  border: 1px solid var(--lx-border);
  border-radius: var(--radius-md);
  background: var(--lx-surface-sunken);
  overflow: hidden;
  cursor: pointer;
  position: relative;
  transition: border-color var(--duration-fast) var(--ease-out);
}
.lx-admin-media-thumb:hover { border-color: var(--lx-border-strong); }
.lx-admin-media-thumb img,
.lx-admin-media-thumb video { width: 100%; height: 100%; object-fit: cover; display: block; }

@media (max-width: 1100px) {
  .lx-admin-split { grid-template-columns: minmax(320px, 40%) minmax(0, 1fr); }
}

/* From 1400 up the list takes the larger share. The detail pane holds a
   two-line empty state whenever nothing is selected, which on a queue screen is
   most of the time, so the wider viewport is better spent on the rows a
   moderator is actually reading. Below this the 44 percent split still gives
   the detail enough room for a claimed ticket's body. */
@media (min-width: 1400px) {
  .lx-admin-split { grid-template-columns: minmax(720px, 62%) minmax(0, 1fr); }
}

/* At a narrow width the split is not a split: the list is the screen, and a
   selected record replaces it with a full-width detail carrying a way back.
   This is a layout change rather than a horizontal scroll. */
@media (max-width: 860px) {
  .lx-admin-shell { grid-template-columns: 1fr; }
  .lx-admin-main { height: auto; min-height: 100vh; }
  .lx-admin-content { overflow-y: visible; }
  .lx-admin-sidebar {
    position: static;
    height: auto;
    flex-direction: row;
    align-items: center;
    gap: var(--space-4);
    overflow-x: auto;
    border-right: none;
    border-bottom: 1px solid var(--lx-border);
    padding: var(--space-3) var(--space-4);
  }
  .lx-admin-nav { flex-direction: row; gap: var(--space-4); }
  .lx-admin-nav-group { flex-direction: row; align-items: center; gap: var(--space-2); }
  .lx-admin-nav-heading { display: none; }
  .lx-admin-content { padding: var(--space-4); }
  .lx-admin-header { padding: var(--space-3) var(--space-4); }

  .lx-admin-split { display: block; height: auto; }
  .lx-admin-split-list,
  .lx-admin-split-detail {
    overflow-y: visible;
    border-right: none;
    padding: var(--space-4);
  }
  /* Only one of the two regions is on screen at a narrow width. */
  .lx-admin-split.has-selection .lx-admin-split-list { display: none; }
  .lx-admin-split:not(.has-selection) .lx-admin-split-detail { display: none; }
  .lx-admin-back { display: inline-flex; }

  /* Each condition takes the full width and its chips wrap inside it. Held at
     their desktop width the groups would overflow the card, which clips rather
     than scrolls, putting the last options out of reach entirely. */
  .lx-admin-filter-group { flex: 1 1 100%; min-width: 0; }
  .lx-admin-filter-clear { margin-left: 0; }
}

/* The hit region and the drawn shape are allowed to differ, and here they do.
   The header's three controls are 30px tall by design and measured 32x30 at
   390, well under the 44x44 a touch target needs. Rather than inflating the
   pills - which would change the header's proportions on every screen - each
   control gets a centred overlay that is at least 44x44. The pill still looks
   the same; the area that responds to a thumb is bigger than the pill.

   The controls sit 8px apart, so a 7px overhang on each side cannot make two
   targets overlap. */
@media (max-width: 860px) {
  .lx-admin-header-actions .lx-admin-control,
  .lx-admin-header-actions .lx-admin-signout {
    position: relative;
  }
  .lx-admin-header-actions .lx-admin-control::after,
  .lx-admin-header-actions .lx-admin-signout::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 100%;
    height: 100%;
    min-width: 44px;
    min-height: 44px;
  }
}

/* Below this the header's three controls cannot hold their labels and the row
   wraps into the identity. Each keeps its icon and its accessible name. */
@media (max-width: 560px) {
  .lx-admin-header-actions .lx-admin-signout { padding: 0 var(--space-2); }
  .lx-admin-header-actions .lx-admin-signout span { display: none; }
}
`;
