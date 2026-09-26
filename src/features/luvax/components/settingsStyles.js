/**
 * The settings screen's own layout CSS.
 *
 * Derived pattern. The design export covers a reading surface and has no
 * settings screen to copy, so the two regions are built from the export's own
 * surface, border, spacing and radius tokens. Every colour is an --lx-* token;
 * no raw hex appears here. Motion uses the existing durations and easings, so
 * the global prefers-reduced-motion rule neutralises these transitions with the
 * rest of the application.
 *
 * The shape matches the panel's master-and-detail from the previous phase
 * deliberately rather than by import: `SplitView` lives in the admin feature,
 * and a feature may not import another feature's internals. Matching the
 * behaviour is the point; sharing the file would mean moving it, which this
 * phase may not do.
 *
 * Muted text. The export renders its small labels in --lx-ink-3, which measures
 * below 4.5:1 on both themes. Nothing here uses it for text: every readable
 * label is --lx-ink-2. --lx-ink-3 remains correct for a purely decorative mark.
 */
export const SETTINGS_CSS = `
.lx-settings {
  display: grid;
  grid-template-columns: 268px minmax(0, 1fr);
  flex: 1;
  /* Both columns are exactly the height of the screen, which is what makes the
     rule between them run the whole way down instead of stopping wherever the
     shorter column's content happens to end. Each column scrolls inside itself
     rather than scrolling the page. */
  height: calc(100vh / var(--lx-scale));
}

.lx-settings-groups,
.lx-settings-category {
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow-y: auto;
}
.lx-settings-groups {
  border-right: 1px solid var(--lx-border);
  padding: var(--space-6) var(--space-3) var(--space-8) var(--space-4);
}
.lx-settings-category {
  /* The measure is centred by growing the region's own side padding rather than
     by giving the content auto margins. Everything inside - the back button at a
     narrow width as well as the fields - then shares one leading edge, which
     auto margins on each child could not do without stretching the button's hit
     area across the whole column. The floor keeps the ordinary gutter once the
     region is narrower than the measure. */
  padding: var(--space-6) max(var(--space-6), (100% - 560px) / 2) var(--space-12);
}
/* The region fills the width it is given, but the content inside it keeps a
   readable measure: a text field stretched to the full region is harder to
   scan and read back than one held near the export's reading width.
   It is centred in the region rather than pinned to its leading edge, so the
   space left over by the measure falls on both sides instead of pooling on the
   right. Below the split breakpoint the region is narrower than the measure, so
   the auto margins collapse and this changes nothing. */
.lx-settings-measure {
  outline: none;
  max-width: 560px;
}

.lx-settings-title {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--lx-ink);
  margin: 0 0 var(--space-4);
  padding-left: var(--space-3);
}

/* Filters the list of names. It searches what is already on screen and asks
   the server nothing. */
.lx-settings-search {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--lx-surface-sunken);
  border: 1px solid var(--lx-border);
  border-radius: var(--radius-pill);
  padding: 0 var(--space-3);
  height: 36px;
  margin: 0 var(--space-2) var(--space-6);
  transition: border-color var(--duration-fast) var(--ease-out);
}
.lx-settings-search:focus-within { border-color: var(--lx-accent); }
.lx-settings-search-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: none;
  outline: none;
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--lx-ink);
  /* The browser's own clear affordance would sit beside the one below it. */
  appearance: none;
}
.lx-settings-search-input::-webkit-search-cancel-button { display: none; }
.lx-settings-search-input::placeholder { color: var(--lx-ink-2); }
.lx-settings-search-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
}
.lx-settings-no-match {
  font-family: var(--font-body);
  font-size: 13px;
  line-height: 1.5;
  color: var(--lx-ink-2);
  margin: 0 var(--space-3);
}

.lx-settings-group + .lx-settings-group { margin-top: var(--space-6); }
.lx-settings-group-title {
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--lx-ink-2);
  padding: 0 var(--space-2) var(--space-2);
  margin: 0;
}

/* A row is an icon and a name. What the category is for is said once, at the
   top of the category itself, rather than under every name here: seven
   straplines compete with the seven names they describe. */
.lx-settings-link {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  text-align: left;
  border: none;
  background: none;
  cursor: pointer;
  padding: 9px var(--space-3);
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  color: var(--lx-ink);
  transition: background var(--duration-fast) var(--ease-out);
}
.lx-settings-link-label {
  font-size: 14px;
  font-weight: 500;
  letter-spacing: -0.01em;
  min-width: 0;
}
/* Hovering lifts the row a step off the page; the open one sits a step higher
   again and carries its name in the heavier weight. Both are the surface scale
   the rest of the product uses, so nothing here is a highlight colour and there
   is no marker on the leading edge. */
.lx-settings-link:hover { background: var(--lx-surface); }
.lx-settings-link[aria-current="page"] { background: var(--lx-surface-raised); }
.lx-settings-link[aria-current="page"] .lx-settings-link-label { font-weight: 600; }

/* One focus ring for every control on this surface, on a token that stays
   visible against the base, the raised fill and the selected fill in both
   themes. */
.lx-settings :focus-visible,
.lx-settings-back:focus-visible {
  outline: 2px solid var(--lx-accent-text);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
/* The region wrapper is focused in code when the category changes, so a
   screen reader lands on the new content. It is not a tab stop and must not
   draw a ring around the whole region as though it were one. */
.lx-settings-measure:focus,
.lx-settings-measure:focus-visible { outline: none; }

/* Only rendered below the split breakpoint, which is to say only where the
   pointer is a finger. It measured 40px tall, so it is the one control on this
   screen a phone user must tap and could miss. */
.lx-settings-back {
  display: none;
  align-items: center;
  gap: var(--space-1);
  min-height: 44px;
  border: none;
  background: none;
  cursor: pointer;
  padding: 0 0 var(--space-4);
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 500;
  color: var(--lx-ink-2);
}

.lx-settings-category-head { margin-bottom: var(--space-6); }
.lx-settings-heading {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--lx-ink);
  margin: 0;
}
/* The strapline that used to sit under every name in the list. It is said here
   instead, once, where the person has actually chosen to read it. */
.lx-settings-description {
  font-family: var(--font-body);
  font-size: 13px;
  line-height: 1.5;
  color: var(--lx-ink-2);
  margin: var(--space-2) 0 0;
}

/* A row of settings: a label and its explanation on the left, the control on
   the right, separated from the next by a hairline rather than by a box. */
.lx-settings-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) 0;
  border-bottom: 1px solid var(--lx-border-subtle);
}
.lx-settings-row:last-child { border-bottom: none; }
.lx-settings-row-text { flex: 1; min-width: 0; }
.lx-settings-row-label {
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 500;
  color: var(--lx-ink);
  letter-spacing: -0.01em;
}
.lx-settings-row-sub {
  font-family: var(--font-body);
  font-size: 12px;
  color: var(--lx-ink-2);
  margin-top: 2px;
}
/* A value the server returns but offers no way to change reads as information:
   plain text in the row, with no control shape implying it could be edited. */
.lx-settings-readonly {
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--lx-ink-2);
  text-align: right;
  flex-shrink: 0;
}

.lx-settings-section + .lx-settings-section { margin-top: var(--space-8); }
.lx-settings-section-title {
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 600;
  color: var(--lx-ink-2);
  margin: 0 0 var(--space-2);
  letter-spacing: -0.01em;
}

.lx-settings-note {
  font-family: var(--font-body);
  font-size: 13px;
  line-height: 1.5;
  color: var(--lx-ink-2);
  margin: 0;
}

/* A navigation offered inside a section body rather than from the group list.
   Underlined and accent-toned, because a bare coloured word is not an
   affordance on a touch screen where there is no cursor to change, and it is
   44px tall so it can be hit at 390. The rule is defined here rather than
   inline: an inline style outranks the stylesheet whatever its specificity, so
   a focus ring declared globally can be silently defeated by one, which is
   exactly what P7-A11Y-001 recorded across three support screens. */
.lx-settings-textlink {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0;
  border: none;
  background: none;
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--lx-accent-text);
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

/* Empty, loading and failed states share one frame so a category never renders
   as an unexplained blank region. */
.lx-settings-state {
  border: 1px solid var(--lx-border);
  border-radius: var(--radius-lg);
  padding: var(--space-8) var(--space-6);
  text-align: center;
}
.lx-settings-state h3 {
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 600;
  color: var(--lx-ink);
  margin: var(--space-3) 0 var(--space-1);
}
.lx-settings-state p {
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--lx-ink-2);
  margin: 0;
}

/* A failed save states what went wrong beside the value that failed, and the
   value stays in the field. */
.lx-settings-error {
  font-family: var(--font-body);
  font-size: 12px;
  color: var(--lx-error-text);
  margin-top: var(--space-1);
}
/* The fill is deliberately the page base rather than --lx-error-dim: measured
   against that tint, --lx-error-text comes out at 1.44:1 in the dark theme,
   because there the dim fill and the text tone are both light. The error is
   carried by the border and the text tone instead, which clears the threshold
   in both themes. No token was invented to get there. */
.lx-settings-banner {
  border: 1px solid var(--lx-error);
  background: var(--lx-base);
  color: var(--lx-error-text);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  font-family: var(--font-body);
  font-size: 13px;
  margin-bottom: var(--space-4);
}
.lx-settings-saved {
  font-family: var(--font-body);
  font-size: 12px;
  color: var(--lx-success-text);
}

.lx-settings-field { margin-bottom: var(--space-4); }
.lx-settings-label {
  display: block;
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 500;
  color: var(--lx-ink-2);
  margin-bottom: var(--space-1);
}
.lx-settings-input,
.lx-settings-textarea {
  width: 100%;
  box-sizing: border-box;
  background: var(--lx-surface-sunken);
  border: 1px solid var(--lx-border);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  font-family: var(--font-body);
  font-size: 15px;
  color: var(--lx-ink);
  transition: border-color var(--duration-fast) var(--ease-out);
}
.lx-settings-textarea { resize: vertical; min-height: 84px; line-height: 1.5; }
.lx-settings-input:focus,
.lx-settings-textarea:focus { border-color: var(--lx-accent); }
.lx-settings-input[aria-invalid="true"],
.lx-settings-textarea[aria-invalid="true"] { border-color: var(--lx-error); }
/* The export specifies --lx-ink-3 for a placeholder, but that is the role this
   product measured as failing, and this phase may not use it. --lx-ink-2 is the
   same intent above the threshold. */
.lx-settings-input::placeholder,
.lx-settings-textarea::placeholder { color: var(--lx-ink-2); }

.lx-settings-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-6);
}

/* A person row: used by blocked accounts and by follow requests. */
.lx-settings-person {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--lx-border-subtle);
}
.lx-settings-person:last-child { border-bottom: none; }
.lx-settings-person-text { flex: 1; min-width: 0; }
.lx-settings-person-name {
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 500;
  color: var(--lx-ink);
}
.lx-settings-person-handle {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--lx-ink-2);
  margin-top: 1px;
}
.lx-settings-person-actions { display: flex; gap: var(--space-2); flex-shrink: 0; }

/* A warning the account has received. Stated plainly, in the same tone the
   panel uses, without softening and without a decorative alarm. */
.lx-settings-warning {
  border: 1px solid var(--lx-border);
  border-left: 2px solid var(--lx-warning);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  margin-bottom: var(--space-3);
}
.lx-settings-warning-reason {
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 600;
  color: var(--lx-ink);
}
.lx-settings-warning-note {
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--lx-ink-2);
  margin-top: var(--space-1);
  line-height: 1.5;
}
.lx-settings-warning-when {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--lx-ink-2);
  margin-top: var(--space-2);
}

/* Below the split breakpoint the screen is not a split. Whichever region is not
   in play is removed, so the group list is the whole width until a category is
   opened and the category is the whole width afterwards, with a way back. That
   is a layout change, not a pair of panes scrolling sideways. */
@media (max-width: 899px) {
  .lx-settings { grid-template-columns: minmax(0, 1fr); height: auto; }
  .lx-settings-groups {
    border-right: none;
    padding: var(--space-4) var(--space-4) var(--space-8);
  }
  .lx-settings-category {
    padding: var(--space-4) max(var(--space-4), (100% - 560px) / 2) var(--space-12);
  }
  .lx-settings-groups,
  .lx-settings-category { height: auto; overflow-y: visible; }
  .lx-settings.has-category .lx-settings-groups { display: none; }
  .lx-settings:not(.has-category) .lx-settings-category { display: none; }
  .lx-settings-back { display: inline-flex; }
  .lx-settings-title { display: none; }
}
`;
