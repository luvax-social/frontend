import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

import { LxIcon } from '@/components/ui/lx-icon';
import { v } from '@/config/tokens';

import { isSingleEmoji } from '../utils/emoji';
import { QUICK_REACTIONS, REACTION_TRIGGER_ATTRIBUTE } from '../utils/reactionOptions';

const EMOJI_FONT = '"Segoe UI Emoji", "Segoe UI Symbol", "Apple Color Emoji", sans-serif';

interface Props {
  /** The caller's current reaction on this message, highlighted in the picker. */
  current: string | null;
  onPick: (emoji: string) => void;
  /** Called when the highlighted reaction is tapped again. */
  onRemove: () => void;
  onClose: () => void;
}

const optionStyle = (pressed: boolean): CSSProperties => ({
  width: 30,
  height: 30,
  borderRadius: 999,
  border: pressed ? `1px solid ${v.accent}` : '1px solid transparent',
  background: pressed ? v.accentDim : 'transparent',
  fontFamily: EMOJI_FONT,
  fontSize: 18,
  lineHeight: 1,
  cursor: 'pointer',
  padding: 0,
  flexShrink: 0,
});

/**
 * The reaction picker: six quick reactions and an any-emoji field.
 *
 * The caller's current reaction is highlighted, and tapping it again removes it. The any-emoji
 * field takes whatever the device's own emoji keyboard types; it submits one emoji and refuses
 * anything else before a request is made, though the server stays the authority on what is valid.
 * The parent anchors the picker above its bubble.
 */
export function ReactionPicker({ current, onPick, onRemove, onClose }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [fieldOpen, setFieldOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const handlePointer = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || rootRef.current?.contains(target)) return;
      // The button that opens the picker toggles it itself; closing here would reopen it.
      if (target.closest(`[${REACTION_TRIGGER_ATTRIBUTE}]`)) return;
      onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('pointerdown', handlePointer);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('pointerdown', handlePointer);
    };
  }, [onClose]);

  const choose = (emoji: string) => (emoji === current ? onRemove() : onPick(emoji));

  const submitCustom = () => {
    const value = custom.trim();
    if (!isSingleEmoji(value)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    choose(value);
  };

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label="reactions"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '5px 7px',
        borderRadius: 24,
        border: `1px solid ${v.border}`,
        background: v.base,
        boxShadow: `0 8px 24px ${v.shadow18}`,
        width: 'max-content',
        maxWidth: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={`react with ${emoji}`}
            aria-pressed={emoji === current}
            onClick={() => choose(emoji)}
            style={optionStyle(emoji === current)}
          >
            {emoji}
          </button>
        ))}
        <button
          type="button"
          aria-label="choose any emoji"
          aria-expanded={fieldOpen}
          onClick={() => setFieldOpen((open) => !open)}
          style={{
            ...optionStyle(false),
            border: `1px solid ${v.border}`,
            fontFamily: v.fontBody,
          }}
        >
          <LxIcon name="plus" size={13} color={v.ink2} />
        </button>
      </div>
      {fieldOpen ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 2px 2px' }}>
          <input
            autoFocus
            aria-label="any emoji"
            aria-invalid={invalid}
            value={custom}
            maxLength={32}
            placeholder="Type an emoji"
            onChange={(event) => {
              setCustom(event.target.value);
              setInvalid(false);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submitCustom();
              }
            }}
            style={{
              height: 28,
              borderRadius: 999,
              border: `1px solid ${invalid ? v.error : v.borderSubtle}`,
              background: v.surfaceSunken,
              color: v.ink,
              fontFamily: EMOJI_FONT,
              fontSize: 14,
              padding: '0 12px',
              outline: 'none',
            }}
          />
          {invalid ? (
            <span style={{ fontFamily: v.fontBody, fontSize: 11, color: v.errorText }}>
              Use one emoji.
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
