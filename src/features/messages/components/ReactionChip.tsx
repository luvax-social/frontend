import { v } from '@/config/tokens';

import type { ReactionChipView } from '../types';

const EMOJI_FONT = '"Segoe UI Emoji", "Segoe UI Symbol", "Apple Color Emoji", sans-serif';

interface Props {
  reaction: ReactionChipView;
  /** Tapping the viewer's own chip removes their reaction. */
  onRemoveMine?: () => void;
}

/**
 * One reaction on a message: the emoji, a count only when more than one person chose it, and a
 * highlight when the viewer is one of them.
 *
 * Tapping the viewer's own chip removes it; someone else's chip is display only.
 */
export function ReactionChip({ reaction, onRemoveMine }: Props) {
  return (
    <button
      type="button"
      aria-label={`${reaction.emoji} reaction`}
      aria-pressed={reaction.mine}
      onClick={() => {
        if (reaction.mine) onRemoveMine?.();
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        height: 22,
        padding: '0 6px',
        borderRadius: 999,
        border: `1px solid ${reaction.mine ? v.accent : v.border}`,
        background: reaction.mine ? v.accentDim : v.base,
        color: v.ink2,
        fontFamily: EMOJI_FONT,
        fontSize: 12,
        lineHeight: 1,
        cursor: reaction.mine ? 'pointer' : 'default',
      }}
    >
      <span>{reaction.emoji}</span>
      {reaction.count > 1 ? (
        <span style={{ fontFamily: v.fontBody, fontSize: 11 }}>{reaction.count}</span>
      ) : null}
    </button>
  );
}
