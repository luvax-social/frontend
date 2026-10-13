import type { ReportReasonVocabularyResponse } from '@/types/domain';
import { useEffect, useRef, useState } from 'react';

import { v } from '@/config/tokens';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { LxIcon } from '@/components/ui/lx-icon';

/**
 * Derived pattern: a vocabulary-driven reason selector, built in the shared
 * layer because the warning form needs it now and the account phase needs it
 * too. Nothing a human picks from is hardcoded; the options come from the
 * report-reason vocabulary, already sorted by `sortOrder` upstream.
 *
 * A disabled vocabulary entry is rendered as unavailable and unselectable rather
 * than hidden, so a historical reason that has since been disabled stays visible
 * and legible. The list is an in-DOM listbox rather than a native `<select>` so
 * the disabled state is visible without an out-of-page OS dropdown, matching the
 * panel's other custom controls. It exposes listbox/option roles and closes on
 * Escape or an outside click.
 *
 * @param {Object[]} reasons vocabulary entries `{ key, displayName, isEnabled }`, pre-sorted
 * @param {string} value the selected reason key
 * @param {(key:string)=>void} onChange
 * @param {string} [error] a field-level error message to show and colour the border
 * @param {boolean} [disabled] whether the control is inert (e.g. a request in flight)
 * @param {string} [id] the id the label points at
 */
export function ReasonSelect({
  reasons = [],
  value,
  onChange,
  error,
  disabled = false,
  id = 'reason-select',
}: {
  reasons?: ReportReasonVocabularyResponse[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onClickAway = (event: MouseEvent) => {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, [open]);

  useEscapeKey(open, () => setOpen(false));

  const selected = reasons.find((reason) => reason.key === value);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} ref={rootRef}>
      <label
        htmlFor={id}
        style={{
          fontFamily: v.fontMono,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: v.ink2,
        }}
      >
        reason
      </label>
      <div style={{ position: 'relative' }}>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            fontFamily: v.fontBody,
            fontSize: 14,
            color: selected ? v.ink : v.ink2,
            background: v.surfaceSunken,
            border: `1px solid ${error ? v.error : open ? v.accent : v.border}`,
            borderRadius: 10,
            padding: '10px 12px',
            cursor: disabled ? 'default' : 'pointer',
            textAlign: 'left',
          }}
        >
          <span>{selected ? selected.displayName : 'select a reason'}</span>
          <LxIcon name="chevronDown" size={16} color={v.ink2} />
        </button>

        {open ? (
          <ul
            role="listbox"
            aria-label="reason"
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              zIndex: 10,
              margin: 0,
              padding: 4,
              listStyle: 'none',
              maxHeight: 340,
              overflowY: 'auto',
              background: v.base,
              border: `1px solid ${v.border}`,
              borderRadius: 10,
              boxShadow: `0 12px 32px ${v.shadow18}`,
            }}
          >
            {reasons.map((reason) => {
              const isDisabled = reason.isEnabled === false;
              const isSelected = reason.key === value;
              return (
                <li
                  key={reason.key}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={isDisabled}
                  title={isDisabled ? 'unavailable' : undefined}
                  onClick={
                    isDisabled
                      ? undefined
                      : () => {
                          onChange(reason.key);
                          setOpen(false);
                        }
                  }
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '9px 10px',
                    borderRadius: 8,
                    fontFamily: v.fontBody,
                    fontSize: 14,
                    color: isDisabled ? v.ink2 : v.ink,
                    background: isSelected ? v.accentDim : 'transparent',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    opacity: isDisabled ? 0.55 : 1,
                  }}
                >
                  <span>{reason.displayName}</span>
                  {isDisabled ? (
                    <span
                      style={{
                        fontFamily: v.fontMono,
                        fontSize: 11,
                        textTransform: 'uppercase',
                        color: v.ink2,
                      }}
                    >
                      unavailable
                    </span>
                  ) : isSelected ? (
                    <LxIcon name="check" size={14} color={v.accentText} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
      <span
        style={{
          fontFamily: v.fontBody,
          fontSize: 12,
          color: error ? v.errorText : 'transparent',
          minHeight: 16,
        }}
      >
        {error || '.'}
      </span>
    </div>
  );
}
