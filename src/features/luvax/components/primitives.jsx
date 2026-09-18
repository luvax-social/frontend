import { useEffect } from 'react';
import { v } from '@/config/tokens';
import { LxIcon } from '@/components/ui/lx-icon';
import { LxAvatar } from '@/components/ui/lx-avatar';
import { LxDropdownMenu } from '@/components/ui/lx-dropdown-menu';
import { useEscapeKey } from '@/hooks/useEscapeKey';

export { LxIcon, LxAvatar, LxDropdownMenu };

export function LxTag({ children, active = false, onClick, size = 'md' }) {
  const sizes = {
    sm: { fontSize: 11, padding: '3px 9px' },
    md: { fontSize: 12, padding: '5px 12px' },
  };

  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontFamily: v.fontBody,
        fontWeight: 500,
        borderRadius: 999,
        background: active ? v.accentDim : v.surface,
        color: active ? v.accentText : v.ink2,
        border: `1px solid ${active ? 'transparent' : v.border}`,
        cursor: onClick ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
        transition: 'background 150ms ease-out, color 150ms ease-out, border-color 150ms ease-out',
        ...sizes[size],
      }}
    >
      {children}
    </span>
  );
}

export function LxBtn({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  disabled = false,
  style = {},
  // Forwarded rather than defaulted, so existing call sites keep the browser's
  // own default and nothing changes for them. Without this a caller inside a
  // <form> cannot opt out of submitting: a button with no type submits, so a
  // `type="button"` that never reaches the DOM silently does nothing.
  type,
  ...rest
}) {
  const sizes = {
    sm: { fontSize: 12, padding: '5px 14px' },
    md: { fontSize: 14, padding: '9px 20px' },
    lg: { fontSize: 16, padding: '12px 28px' },
  };
  const variants = {
    // The accent fill is the same colour in both themes, so the label cannot
    // use a token that flips with it. --lx-ink-inverse is near-white in the
    // light theme and measured 2.08:1 on the accent; --lx-black is
    // theme-invariant and clears 9:1 on the accent in both.
    primary: { background: v.accent, color: v.black, border: 'none' },
    secondary: { background: v.surface, color: v.ink, border: `1px solid ${v.border}` },
    ghost: { background: 'transparent', color: v.ink, border: `1px solid ${v.border}` },
    danger: { background: 'transparent', color: v.error, border: `1px solid ${v.error}` },
  };
  if (disabled) {
    // Every variant has to read as disabled, not only the filled one. An
    // outlined button that keeps its full contrast looks clickable and then
    // does nothing, which is how a support reviewer ends up clicking "close as
    // rejected" repeatedly without being told the reply box is what is empty.
    variants.primary = { background: v.surfaceRaised, color: v.ink3, border: 'none' };
    variants.secondary = { background: v.surface, color: v.ink3, border: `1px solid ${v.border}` };
    variants.ghost = { background: 'transparent', color: v.ink3, border: `1px solid ${v.border}` };
    variants.danger = { background: 'transparent', color: v.ink3, border: `1px solid ${v.border}` };
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      {...rest}
      style={{
        fontFamily: v.fontBody,
        fontWeight: 500,
        borderRadius: 999,
        cursor: disabled ? 'default' : 'pointer',
        letterSpacing: '-0.01em',
        textTransform: 'lowercase',
        transition: 'all 150ms ease-out',
        ...sizes[size],
        ...variants[variant],
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function LxDivider({ mx = 0 }) {
  return <div style={{ height: 1, background: v.border, margin: `0 ${mx}px` }} />;
}

export function LxBottomSheet({ open, onClose, children, height = '70vh' }) {
  useEscapeKey(open, onClose);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Render nothing when closed. A sheet left mounted parks its shadowed, rounded
  // panel just below the fold; with one sheet per post, dozens stack and their
  // upward box-shadows bleed into the viewport as a banded curve at the bottom.
  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: v.scrim,
          animation: 'lx-scrim-in var(--duration-normal) var(--ease-out)',
          zIndex: 999,
        }}
      />
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          maxWidth: 640,
          margin: '0 auto',
          background: v.base,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          boxShadow: `0 -20px 60px ${v.shadow18}`,
          animation: 'lx-sheet-in var(--duration-slow) var(--ease-out)',
          zIndex: 1000,
          height,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px', flexShrink: 0 }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 2, background: v.border }} />
        </div>
        {children}
      </div>
    </>
  );
}

export function LxModal({ open, onClose, title, children, actions, zIndex = 1000 }) {
  useEscapeKey(open, onClose);

  if (!open) return null;
  return (
    <>
      <div
        onClick={onClose}
        className="lx-scrim"
        style={{
          position: 'fixed',
          inset: 0,
          background: v.scrim,
          zIndex,
        }}
      />
      <div
        className="lx-modal-panel"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: v.base,
          borderRadius: 12,
          width: 'calc(100% - 32px)',
          maxWidth: 320,
          boxShadow: `0 20px 60px ${v.shadow25}, 0 4px 16px ${v.shadow12}`,
          overflow: 'hidden',
          zIndex: zIndex + 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {title ? (
          <div
            style={{
              padding: '16px 20px',
              borderBottom: `1px solid ${v.border}`,
              fontFamily: v.fontDisplay,
              fontSize: 16,
              fontWeight: 600,
              color: v.ink,
            }}
          >
            {title}
          </div>
        ) : null}
        <div
          style={{
            padding: '20px',
            fontFamily: v.fontBody,
            fontSize: 14,
            color: v.ink2,
            lineHeight: 1.5,
          }}
        >
          {children}
        </div>
        {actions ? (
          <div
            style={{
              padding: '12px 20px',
              borderTop: `1px solid ${v.border}`,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              background: v.surfaceRaised,
            }}
          >
            {actions}
          </div>
        ) : null}
      </div>
    </>
  );
}
