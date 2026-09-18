import { v } from '@/config/tokens';

/**
 * The pieces every detail pane in the panel is built from, so a labelled fact on
 * the report detail, the support ticket and the action log is the same shape in
 * all three rather than three near-identical local copies that drift apart.
 */

/** The small uppercase label above a fact or a field. */
export const detailLabel = {
  fontFamily: v.fontMono,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: v.ink2,
};

/** One labelled fact: a short value that reads as data rather than prose. */
export function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span style={detailLabel}>{label}</span>
      <span
        style={{ fontFamily: v.fontBody, fontSize: 14, color: v.ink, overflowWrap: 'anywhere' }}
      >
        {children}
      </span>
    </div>
  );
}

/** The grid a card's facts sit in; it reflows to one column in a narrow pane. */
export function FieldGrid({ children, min = 160 }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
        gap: 16,
      }}
    >
      {children}
    </div>
  );
}

/**
 * A block of text someone actually wrote — a reporter's note, a support
 * ticket's body, a reply that was sent — set apart on its own raised surface.
 *
 * A card's own background is already `--lx-surface-sunken`, so this uses
 * `--lx-base`: written text would otherwise carry no more visual weight than
 * the labels around it, and it is the one thing on the card a reviewer has to
 * read rather than scan.
 */
export function NoteBlock({ label, children, tone = 'default' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      {label ? <span style={detailLabel}>{label}</span> : null}
      <div
        style={{
          background: v.base,
          border: `1px solid ${tone === 'muted' ? v.borderSubtle : v.border}`,
          borderRadius: 10,
          padding: '12px 14px',
          fontFamily: v.fontBody,
          fontSize: 14,
          color: tone === 'muted' ? v.ink2 : v.ink,
          whiteSpace: 'pre-wrap',
          lineHeight: 1.55,
          overflowWrap: 'anywhere',
        }}
      >
        {children}
      </div>
    </div>
  );
}
