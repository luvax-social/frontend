/**
 * The support slice's own layout CSS.
 *
 * A stylesheet rather than the inline styles this slice used to carry, for two
 * reasons. The floating label needs sibling and state selectors - `:focus`,
 * `:not(:placeholder-shown)` - which an inline style cannot express at all. And
 * an inline style outranks the stylesheet whatever its specificity, which is
 * precisely how one `outline: 'none'` declaration silently defeated the
 * application's focus ring across three screens and became P7-A11Y-001. Nothing
 * here sets `outline`: the global `:focus-visible` rule in `index.css` draws the
 * ring, and the rules below add the border and glow on top of it rather than in
 * place of it.
 *
 * The field treatment matches the sign-in and sign-up screens deliberately. A
 * person reaching support cannot sign in, so these are often the second screen
 * they see after that one, and two different field languages between them read
 * as two different products. The measurements are the auth page's own: 56px
 * tall, 1.5px border, the label resting inside and rising to straddle the top
 * border once the field has focus or content.
 *
 * Every colour is an `--lx-*` token. No raw hex appears here.
 */
export const SUPPORT_CSS = `
/* These three routes are reached either by a route change from the sign-in
   screen or cold from an email link, unlike the auth page's own views, which
   swap in place inside one mounted route. Without an entrance transition of
   its own, the support route's first paint lands as a hard cut instead of the
   fade-and-rise every auth view gets, reading as a flash by comparison. */
.lx-support-enter {
  animation: lxSupportEnter var(--duration-normal) var(--ease-out) both;
}
@keyframes lxSupportEnter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .lx-support-enter {
    animation: none;
  }
}

.lx-sfield-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 18px;
}

.lx-sfield {
  position: relative;
}

.lx-sfield-control {
  width: 100%;
  box-sizing: border-box;
  height: 56px;
  padding: 0 15px;
  border: 1.5px solid var(--lx-border);
  border-radius: var(--radius-md);
  background: var(--lx-surface-sunken);
  color: var(--lx-ink);
  font-family: var(--font-body);
  font-size: 15px;
  transition:
    border-color var(--duration-fast) var(--ease-out),
    background var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}

/* The label doubles as the placeholder, so the resting state shows one word in
   one place rather than a label above an empty box. It is transparent until the
   field has focus, at which point the label has already risen and the
   placeholder can take its place without the two colliding. */
.lx-sfield-control::placeholder {
  color: transparent;
}
.lx-sfield-control:focus::placeholder {
  color: var(--lx-ink-3);
  transition: color var(--duration-fast) var(--ease-out);
}

.lx-sfield-control:focus {
  border-color: var(--lx-accent);
  background: var(--lx-base);
  box-shadow: 0 0 0 3px var(--lx-accent-dim);
}

/* A textarea holds several lines, so its label rests near the top of the box
   rather than at its vertical centre, where it would float in the middle of
   empty space. */
textarea.lx-sfield-control {
  height: auto;
  min-height: 152px;
  padding: 18px 15px 12px;
  line-height: 1.5;
  resize: vertical;
}

/* The native chevron sits at the browser's own inset, roughly 8px, while the
   field's text is inset 15px, so the two never lined up and the arrow read as
   pushed inward. Drawn here from two gradients instead - the same technique the
   admin panel already uses for its selects - so it follows the theme through
   --lx-ink-2, needs no image file, and ends on the field's own gutter. The
   right padding reserves the space, so a long option cannot run underneath it.

   The gradients live on an ::after of the field wrapper, not on the select's
   own background-image. Chrome's current default select rendering opens an
   anchored popup once appearance: none is set, and that popup reuses
   whatever background-image sits on the select itself for its connector
   notch - stretching this chevron into an oversized white triangle over a
   highlighted trigger the instant the field opened. A select carrying
   appearance: none with no background-image of its own does not trigger
   that path, so the chevron is kept off the element entirely. */
select.lx-sfield-control {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 42px;
}
.lx-sfield:has(> select.lx-sfield-control)::after {
  content: '';
  position: absolute;
  right: 19px;
  top: 50%;
  transform: translateY(calc(-50% + 1px));
  width: 11px;
  height: 6px;
  pointer-events: none;
  background-image:
    linear-gradient(45deg, transparent 50%, var(--lx-ink-2) 50%),
    linear-gradient(135deg, var(--lx-ink-2) 50%, transparent 50%);
  background-position: 0 0, 5px 0;
  background-size: 6px 6px, 6px 6px;
  background-repeat: no-repeat;
}
.lx-sfield:has(> select.lx-sfield-control:focus)::after {
  background-image:
    linear-gradient(45deg, transparent 50%, var(--lx-accent-text) 50%),
    linear-gradient(135deg, var(--lx-accent-text) 50%, transparent 50%);
}
/* Options are painted by the platform, not by this stylesheet, so a dark theme
   otherwise drops a near-white menu out of a near-black field. */
.lx-sfield-control option {
  background: var(--lx-surface);
  color: var(--lx-ink);
}

.lx-sfield label {
  position: absolute;
  left: 13px;
  top: 50%;
  transform: translateY(-50%);
  max-width: calc(100% - 26px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-body);
  font-size: 15px;
  color: var(--lx-ink-3);
  pointer-events: none;
  transition:
    top var(--duration-fast) var(--ease-out),
    font-size var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

/* A textarea's resting label sits on its first line. */
.lx-sfield textarea ~ label {
  top: 28px;
}

/* A select always has a value showing, even when that value is the prompt, so
   its label has nowhere to rest and starts where the others end up. */
.lx-sfield select ~ label,
.lx-sfield .lx-sfield-control:focus ~ label,
.lx-sfield .lx-sfield-control:not(:placeholder-shown) ~ label {
  top: 0;
  font-size: 11px;
  letter-spacing: 0.04em;
  padding: 0 6px;
  color: var(--lx-ink-2);
  background: var(--lx-surface-sunken);
}
.lx-sfield textarea:focus ~ label,
.lx-sfield textarea:not(:placeholder-shown) ~ label {
  top: 0;
  transform: translateY(-50%);
}
.lx-sfield .lx-sfield-control:focus ~ label {
  color: var(--lx-accent-text);
  background: var(--lx-base);
}

.lx-sfield[data-error="true"] .lx-sfield-control {
  border-color: var(--lx-error);
}
.lx-sfield[data-error="true"] .lx-sfield-control:focus {
  box-shadow: 0 0 0 3px var(--lx-error-dim);
}
.lx-sfield[data-error="true"] label {
  top: 0;
  font-size: 11px;
  letter-spacing: 0.04em;
  padding: 0 6px;
  color: var(--lx-error-text);
  background: var(--lx-surface-sunken);
}
.lx-sfield[data-error="true"] textarea ~ label {
  transform: translateY(-50%);
}
.lx-sfield[data-error="true"] .lx-sfield-control:focus ~ label {
  background: var(--lx-base);
}

.lx-sfield-hint {
  font-family: var(--font-body);
  font-size: 12px;
  line-height: 1.45;
  color: var(--lx-ink-2);
  margin: 0;
  padding: 0 2px;
}
.lx-sfield-error {
  font-family: var(--font-body);
  font-size: 12px;
  line-height: 1.35;
  color: var(--lx-error-text);
  margin: 0;
  padding: 0 2px;
  overflow-wrap: anywhere;
}

/* The way back off an anonymous screen. The sign-up page's equivalent is 40px,
   which is under the touch minimum; this one is 44, because the reader most
   likely to use it arrived on a phone from a moderation email. */
.lx-support-back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-pill);
  color: var(--lx-ink-2);
  background: transparent;
  border: none;
  cursor: pointer;
  text-decoration: none;
  flex-shrink: 0;
  transition:
    background var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}
.lx-support-back:hover {
  background: var(--lx-surface-raised);
  color: var(--lx-ink);
}
.lx-support-back svg {
  display: block;
}

.lx-support-head {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 28px;
  /* Pulled back by the back button's own optical padding so its icon starts on
     the column's leading edge. */
  margin-left: -10px;
}
`;
