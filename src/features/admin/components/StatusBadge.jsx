import { v } from '@/config/tokens';

/**
 * Derived pattern: a single status indicator that serves every status
 * enumeration in the panel (report, account, hashtag, post). The design export
 * defines no such component, so this is derived work built from the four
 * semantic colour tokens plus a neutral tone from the surface and ink scale.
 *
 * One visual vocabulary serves all four domains by encoding lifecycle position
 * rather than domain. The mapping and its reasoning are recorded in
 * design-decisions.md. Any status not in the map falls back to the neutral tone
 * rather than throwing, so a value added to a backend enum still renders.
 */
/**
 * The label sits on --lx-ink rather than on the tone's own text token. Measured
 * in the light theme, every semantic text token on its matching dim fill falls
 * short of 4.5:1 — warning reads 2.85 and success 3.75 — because both the fill
 * and the text are pale. Darkening the text further would have meant inventing
 * a token, so the hue moved instead: the tone is carried by the fill and a
 * matching border, and the word itself is ink, which clears 4.5:1 on every dim
 * fill in both themes. The status stays colour-coded; it is now also readable.
 */
const TONES = {
  positive: { bg: v.successDim, color: v.ink, border: v.success },
  caution: { bg: v.warningDim, color: v.ink, border: v.warning },
  critical: { bg: v.errorDim, color: v.ink, border: v.error },
  attention: { bg: v.accentDim, color: v.ink, border: v.accent },
  neutral: { bg: v.surface, color: v.ink, border: v.border },
};

const STATUS_TONE = {
  // Healthy live states.
  active: 'positive',
  published: 'positive',
  resolved: 'positive',
  // In progress or awaiting attention.
  pending: 'caution',
  reviewing: 'caution',
  draft: 'caution',
  archived: 'caution',
  suspended: 'caution',
  // Taken out of service.
  banned: 'critical',
  removed: 'critical',
  deactivated: 'critical',
  // Handed up for a higher decision.
  escalated: 'attention',
  // Support ticket lifecycle. open and in_progress are work still to do; answered
  // is a closed-with-an-outcome state and reads as positive, while rejected is
  // closed with the request refused and is understated rather than red, matching
  // how a dismissed report is treated.
  open: 'caution',
  in_progress: 'caution',
  answered: 'positive',
  rejected: 'neutral',
  // Closed with no action taken; deliberately understated rather than red.
  dismissed: 'neutral',
  // Whether a ticket has an owner. Rendered as a badge rather than the bare word
  // "no" so it reads as the same kind of thing as the status beside it, which is
  // what a reader scanning the column expects. Unclaimed is the state that wants
  // a moderator's attention, so it takes the caution tone rather than a critical
  // one: nothing is wrong, it is simply waiting.
  claimed: 'positive',
  unclaimed: 'caution',
  // Not a status. A support ticket carries this alongside its status to say it
  // contests a moderation decision, which is a different axis from where the
  // ticket sits in its lifecycle. It takes the attention tone for the same
  // reason `escalated` does: it is the row a reviewer should look at first.
  appeal: 'attention',
};

export function StatusBadge({ status, size = 'md' }) {
  if (!status) {
    return null;
  }
  const tone = TONES[STATUS_TONE[status]] ?? TONES.neutral;
  const sizes = {
    sm: { fontSize: 11, padding: '2px 8px' },
    md: { fontSize: 11, padding: '3px 10px' },
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: v.fontMono,
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        borderRadius: 999,
        background: tone.bg,
        color: tone.color,
        border: `1px solid ${tone.border ?? 'transparent'}`,
        whiteSpace: 'nowrap',
        ...sizes[size],
      }}
    >
      {status}
    </span>
  );
}
