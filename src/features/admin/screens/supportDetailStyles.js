import { v } from '@/config/tokens';

/**
 * The support detail pane's remaining local styles.
 *
 * Everything that has a shape shared with another detail pane — a labelled
 * fact, a block of written text, a card — comes from `PanelPage` and
 * `DetailPrimitives` instead, so the support console and the report console
 * cannot drift apart. What is left here is what only this screen has: the
 * inline notices and the controls a reviewer types into.
 */

/**
 * A text field a reviewer writes a decision into.
 *
 * On `--lx-base` rather than the card's own `--lx-surface-sunken`, which made
 * an empty field indistinguishable from the card behind it — a reviewer could
 * not see where to click without hunting for the border. The height is set so
 * an empty field still reads as somewhere to write several sentences, and the
 * outline is deliberately not suppressed: the panel's focus ring is what says
 * which field has the caret.
 */
export const textarea = (invalid = false) => ({
  width: '100%',
  minHeight: 84,
  resize: 'vertical',
  fontFamily: v.fontBody,
  fontSize: 14,
  color: v.ink,
  background: v.base,
  border: `1px solid ${invalid ? v.error : v.border}`,
  borderRadius: 10,
  padding: '10px 12px',
  lineHeight: 1.55,
  boxSizing: 'border-box',
});

/** A calm inline notice: an explanation, not an alarm. */
export const notice = (tone = 'neutral') => {
  const palette = {
    neutral: { bg: v.surface, border: v.border, color: v.ink2 },
    bad: { bg: v.errorDim, border: v.error, color: v.errorText },
    warn: { bg: v.warningDim, border: v.warning, color: v.warningText },
  }[tone];
  return {
    background: palette.bg,
    border: `1px solid ${palette.border}`,
    borderRadius: 10,
    padding: '10px 12px',
    fontFamily: v.fontBody,
    fontSize: 13,
    lineHeight: 1.55,
    color: palette.color,
    margin: '0 0 14px',
  };
};

/** The row of actions at the foot of a section. */
export const actionRow = { display: 'flex', gap: 8, flexWrap: 'wrap' };
