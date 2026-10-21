import { useRef, useState } from 'react';

import { LxDropdownMenu } from '@/components/ui/lx-dropdown-menu';
import { v } from '@/config/tokens';

import type { ReactionChipView } from '../types';

const EMOJI_FONT = '"Segoe UI Emoji", "Segoe UI Symbol", "Apple Color Emoji", sans-serif';

interface Props {
  reaction: ReactionChipView;
  /** Tapping the viewer's own chip removes their reaction. */
  onRemoveMine?: () => void;
  /** Reports someone else's reaction from the chip menu. */
  onReport?: (reactionId: string) => void;
}

/**
 * One reaction on a message: the emoji, a count only when more than one person chose it, and a
 * highlight when the viewer is one of them.
 *
 * Tapping the viewer's own chip removes it. Tapping someone else's opens a menu with the report
 * action; the viewer's own reaction is never offered for a report.
 */
export function ReactionChip({ reaction, onRemoveMine, onReport }: Props) {
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const reportable = !reaction.mine && reaction.reactionId !== null && Boolean(onReport);

  const handleClick = () => {
    if (reaction.mine) onRemoveMine?.();
    else if (reportable) setMenuOpen((open) => !open);
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-label={`${reaction.emoji} reaction`}
        aria-pressed={reaction.mine}
        onClick={handleClick}
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
          cursor: reaction.mine || reportable ? 'pointer' : 'default',
        }}
      >
        <span>{reaction.emoji}</span>
        {reaction.count > 1 ? (
          <span style={{ fontFamily: v.fontBody, fontSize: 11 }}>{reaction.count}</span>
        ) : null}
      </button>
      {reportable ? (
        <LxDropdownMenu
          anchorRef={anchorRef}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          width={172}
          items={[
            {
              id: 'report-reaction',
              icon: 'flag',
              label: 'report reaction',
              tone: 'danger',
              onClick: () => onReport?.(reaction.reactionId!),
            },
          ]}
        />
      ) : null}
    </>
  );
}
