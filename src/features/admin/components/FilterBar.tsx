import type { ReactNode } from 'react';
export interface FilterGroup {
  key: string;
  label: ReactNode;
  value?: string;
  options: { value: string; label: ReactNode; disabled?: boolean }[];
}
import { v } from '@/config/tokens';
import { LxTag } from '@/features/luvax/components/primitives';
import { LxIcon } from '@/components/ui/lx-icon';

/**
 * Derived pattern: a filter bar over small, fixed enumerations. Built from
 * `LxTag` in its active state, which is a ready-made filter chip. Each group
 * offers an "all" chip plus one chip per value; selecting a value serialises to
 * only the endpoint's declared parameter keys upstream, and changing any filter
 * resets pagination because the query key includes the filter values.
 *
 * A disabled option renders as unavailable and unselectable rather than hidden,
 * so a value that a historical record still references stays visible.
 *
 * Each condition sits on its own labelled plate rather than in one continuous
 * run of chips, because adjacent conditions with only a gap between them read
 * as a single row and are easy to hit by mistake. Groups never compress: they
 * wrap onto the next line at their natural width. The clear affordance is
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
            <LxTag size="sm" active={!group.value} onClick={() => onChange(group.key, '')}>
              all
            </LxTag>
            {group.options.map((option) => (
              <span
                key={option.value}
                style={option.disabled ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                title={option.disabled ? 'unavailable' : undefined}
              >
                <LxTag
                  size="sm"
                  active={group.value === option.value}
                  onClick={option.disabled ? undefined : () => onChange(group.key, option.value)}
                >
                  {option.label}
                  {option.disabled ? ' (unavailable)' : ''}
                </LxTag>
              </span>
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
