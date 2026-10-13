import type { ReactNode } from 'react';
export interface FilterGroup {
  key: string;
  label: ReactNode;
  value?: string;
  options: { value: string; label: ReactNode; disabled?: boolean }[];
}
import { v } from '@/config/tokens';
import { LxIcon } from '@/components/ui/lx-icon';

/**
 * A filter bar over small, fixed enumerations. Native toggle buttons retain
 * the filter-chip shape and expose selection to keyboard and assistive input. Each group
 * offers an "all" chip plus one chip per value; selecting a value serialises to
 * only the endpoint's declared parameter keys upstream, and changing any filter
 * resets pagination because the query key includes the filter values.
 *
 * A disabled option renders as unavailable and unselectable rather than hidden,
 * so a value that a historical record still references stays visible.
 *
 * Each condition sits on its own labelled plate rather than in one continuous
 * run of chips, because adjacent conditions with only a gap between them read
 * as a single row and are easy to hit by mistake. Groups wrap onto the next
 * line, and their chips wrap within the available width. The clear affordance is
 * pushed to the end of the bar so it never occupies a position where a
 * condition control is expected.
 *
 * @param {Object[]} groups each `{ key, label, value, options: [{value,label,disabled}] }`
 * @param {(key:string, value:string)=>void} onChange
 * @param {()=>void} onClear
 * @param {boolean} isDirty whether any filter is set away from "all"
 */
export function FilterBar({
  groups,
  onChange,
  onClear,
  isDirty,
}: {
  groups: FilterGroup[];
  onChange: (key: string, value: string) => void;
  onClear: () => void;
  isDirty?: boolean;
}) {
  return (
    <div className="lx-admin-filterbar">
      {groups.map((group) => (
        <div key={group.key} className="lx-admin-filter-group">
          <span className="lx-admin-filter-label" id={`filter-${group.key}`}>
            {group.label}
          </span>
          <div
            className="lx-admin-filter-options"
            role="group"
            aria-labelledby={`filter-${group.key}`}
          >
            <button
              type="button"
              className="lx-admin-filter-chip"
              aria-pressed={!group.value}
              onClick={() => onChange(group.key, '')}
            >
              all
            </button>
            {group.options.map((option) => (
              <button
                type="button"
                className="lx-admin-filter-chip"
                key={option.value}
                disabled={option.disabled}
                aria-pressed={group.value === option.value}
                onClick={() => onChange(group.key, option.value)}
                title={option.disabled ? 'unavailable' : undefined}
              >
                {option.label}
                {option.disabled ? ' (unavailable)' : ''}
              </button>
            ))}
          </div>
        </div>
      ))}

      {isDirty ? (
        <button type="button" onClick={onClear} className="lx-admin-signout lx-admin-filter-clear">
          <LxIcon name="close" size={12} color={v.ink2} />
          clear filters
        </button>
      ) : null}
    </div>
  );
}
