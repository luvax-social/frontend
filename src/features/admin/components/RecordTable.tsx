import type { CSSProperties, Key, ReactNode } from 'react';
export interface Column<T> {
  key: string;
  header: ReactNode;
  width?: CSSProperties['width'];
  align?: CSSProperties['textAlign'];
  nowrap?: boolean;
  render?: (row: T) => ReactNode;
}
interface TableProps<T> {
  columns: Column<T>[];
  rows?: T[];
  keyField?: keyof T;
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => unknown;
  emptyIcon?: string;
  emptyTitle?: string;
  emptyHint?: ReactNode;
  footer?: ReactNode;
}
import { v } from '@/config/tokens';

import { EmptyState, FailedState, LoadingState } from './ListStates';

/**
 * Derived pattern: a dense, scannable, aligned record table. It has no
 * equivalent in the design export, so it is derived from the existing tokens
 * (the border, ink, and surface scales and the mono type role for the header).
 * It expresses all four list states itself, so every list in the panel shows
 * the same populated, empty, loading, and failed states.
 *
 * Columns are declared as objects; a `render` function draws each cell so a
 * cell can hold a badge or a resolved name rather than only text. Wide content
 * scrolls inside the table's own container rather than the page body.
 *
 * @param {Object[]} columns each `{ key, header, width, align, render }`
 * @param {Object[]} rows
 */
export function RecordTable<T extends { id: string }>({
  columns,
  rows = [],
  keyField = 'id',
  onRowClick,
  selectedKey = null,
  isLoading = false,
  isError = false,
  errorMessage,
  onRetry,
  emptyIcon = 'check',
  emptyTitle = 'nothing here yet',
  emptyHint,
  footer = null,
}: TableProps<T>) {
  const hasRows = rows.length > 0;

  if (isLoading && !hasRows) {
    return <LoadingState />;
  }
  if (isError && !hasRows) {
    return <FailedState message={errorMessage} onRetry={onRetry} />;
  }
  if (!hasRows) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} hint={emptyHint} />;
  }

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          minWidth: 640,
          borderCollapse: 'collapse',
          fontFamily: v.fontBody,
        }}
      >
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  textAlign: col.align ?? 'left',
                  width: col.width,
                  padding: '10px 16px',
                  borderBottom: `1px solid ${v.border}`,
                  fontFamily: v.fontMono,
                  fontSize: 11,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: v.ink2,
                  whiteSpace: 'nowrap',
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isSelected = selectedKey !== null && row[keyField] === selectedKey;
            return (
              <tr
                key={row[keyField] as Key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                // The row is the control, so it takes focus and answers Enter and
                // Space the way a button would. Without this the selection in a
                // split screen would be reachable only with a pointer.
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? 'button' : undefined}
                aria-current={isSelected ? 'true' : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                className={`lx-admin-row${isSelected ? ' is-selected' : ''}`}
                style={{
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background var(--duration-fast) var(--ease-out)',
                }}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      textAlign: col.align ?? 'left',
                      padding: '13px 16px',
                      borderBottom: `1px solid ${v.borderSubtle}`,
                      fontSize: 13,
                      color: v.ink2,
                      verticalAlign: 'middle',
                      whiteSpace: col.nowrap ? 'nowrap' : 'normal',
                    }}
                  >
                    {col.render ? col.render(row) : (row[col.key as keyof T] as ReactNode)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {footer}
    </div>
  );
}
