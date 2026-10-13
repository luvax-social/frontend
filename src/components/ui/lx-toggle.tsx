import { v } from '@/config/tokens';

/**
 * A two-state switch.
 *
 * It reports itself as a switch rather than as a plain button, so its on/off
 * state is announced and it is operable from the keyboard like every other
 * control on the page. `label` gives it an accessible name; without one a
 * switch reads as an unlabelled control, since the text describing it sits in a
 * sibling element rather than inside the button.
 *
 * The knob transition uses the shared duration and easing, so the global
 * prefers-reduced-motion rule neutralises it along with the rest of the
 * application.
 */
interface ToggleProps {
  on?: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
  busy?: boolean;
}

export function LxToggle({ on, onChange, disabled = false, label, busy = false }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(on)}
      aria-label={label}
      aria-busy={busy || undefined}
      disabled={disabled}
      className="lx-toggle"
      onClick={
        disabled
          ? undefined
          : (event) => {
              event.stopPropagation();
              onChange(!on);
            }
      }
      style={{
        width: 38,
        height: 22,
        // Without this the one-pixel border below is added outside the declared
        // size, so the track renders 40x24 while the knob is positioned inside a
        // 38x22 box. The knob then sits a pixel out of true, and only on the
        // side it has travelled to, which is why some switches looked centred
        // and others did not.
        boxSizing: 'border-box',
        flexShrink: 0,
        borderRadius: 999,
        background: on ? v.accent : v.surfaceRaised,
        // The off fill is --lx-surface-raised, which measures 1.25:1 against the
        // page in the dark theme - the switch simply disappears. Neither border
        // token is enough to rescue it there (--lx-border 1.44:1,
        // --lx-border-strong 1.82:1), so the boundary is drawn in --lx-ink-2,
        // which measures 7.92:1 in dark and 5.90:1 in light and clears the 3:1
        // a UI component's visible boundary needs. --lx-ink-3 would also clear
        // it at 3.74:1, but it is the role this product measured as failing and
        // is not used here. The on state keeps a border too, so both states are
        // the same size and nothing shifts when it flips.
        border: `1px solid ${on ? v.accent : v.ink2}`,
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background var(--duration-fast) var(--ease-out)',
      }}
    >
      {/* The track is 38x22 including its border, so the box this knob is
          positioned inside is 36x20. A 16px knob inset by 2 leaves the same two
          pixels on every side in both states; the 18px it used to be could not,
          and overhung whichever end it had travelled to. */}
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: v.white,
          transition: 'left var(--duration-fast) var(--ease-out)',
          boxShadow: `0 1px 3px ${v.shadow18}`,
        }}
      />
    </button>
  );
}
