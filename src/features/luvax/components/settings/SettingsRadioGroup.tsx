import type { KeyboardEvent } from 'react';
import { useId, useRef } from 'react';

export interface RadioOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

/**
 * A single-choice group built to the radio group pattern: one `radiogroup`
 * containing `radio` buttons, a roving tab stop, and arrow keys that move and
 * select together.
 *
 * Only the selected option is a tab stop (the first when nothing is selected),
 * so Tab enters and leaves the group once and the arrow keys move inside it.
 * Arrow keys wrap, and Home and End jump to the ends. Moving selects, so every
 * arrow press calls `onChange`; a caller that saves on change therefore saves on
 * each press, which is the pattern's behaviour rather than an extra step.
 *
 * `variant="list"` stacks options with their explanation beneath, for a choice
 * that needs reading; `variant="segmented"` is one pill track for short labels.
 * The group's accessible name is `label`; the caller draws any visible heading.
 */
export function SettingsRadioGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  variant = 'list',
}: {
  label: string;
  options: readonly RadioOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  disabled?: boolean;
  variant?: 'list' | 'segmented';
}) {
  const baseId = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const tabStop = selectedIndex >= 0 ? selectedIndex : 0;

  const choose = (index: number) => {
    const next = options[index];
    if (!next) return;
    if (next.value !== value) onChange(next.value);
    buttons.current[index]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (disabled) return;
    const last = options.length - 1;
    let target: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        target = index === last ? 0 : index + 1;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        target = index === 0 ? last : index - 1;
        break;
      case 'Home':
        target = 0;
        break;
      case 'End':
        target = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    choose(target);
  };

  const segmented = variant === 'segmented';

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={segmented ? 'lx-segmented' : 'lx-radio-list'}
    >
      {options.map((option, index) => {
        const checked = index === selectedIndex;
        const labelId = `${baseId}-${index}-label`;
        const descriptionId = option.description ? `${baseId}-${index}-description` : undefined;
        return (
          <button
            key={option.value}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-labelledby={labelId}
            aria-describedby={descriptionId}
            tabIndex={index === tabStop ? 0 : -1}
            disabled={disabled}
            className={segmented ? 'lx-segmented-option' : 'lx-radio-option'}
            onClick={() => choose(index)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {segmented ? null : <span className="lx-radio-dot" aria-hidden="true" />}
            <span className="lx-radio-text">
              <span id={labelId} className="lx-radio-label">
                {option.label}
              </span>
              {option.description ? (
                <span id={descriptionId} className="lx-radio-description">
                  {option.description}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
