import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

import type { UserSummaryResponse } from '@/types/domain';
import { v } from '@/config/tokens';
import { LxIcon } from '@/components/ui/lx-icon';
import { useAuthStore } from '@/store/useAuthStore';
import { extractPageContent, getUserSummary } from '@/utils/helpers';
import { getUserSearchTerms, useUserSearch } from '@/features/search/hooks/useSearch';

import { LxAvatar } from '../primitives';

export interface PersonRowState {
  /** Short text shown at the right of the row, such as `invited`. */
  badge?: string;
  /** A sentence under the name that explains why the row cannot be chosen. */
  note?: string;
  disabled?: boolean;
}

/**
 * A search box over accounts with a result list, shared by the tag and collaborator dialogs.
 *
 * The search is the same people search the rest of the application uses. The signed-in account is
 * never offered, because nobody tags or invites themselves. `rowState` lets the caller mark a row
 * as already chosen or unavailable without this component knowing why.
 */
export function PersonSearch({
  onChoose,
  rowState,
  placeholder = 'search people',
  emptyHint,
  autoFocus = true,
}: {
  onChoose: (user: UserSummaryResponse) => void;
  rowState?: (user: UserSummaryResponse) => PersonRowState;
  placeholder?: string;
  emptyHint?: ReactNode;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState('');
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [term] = getUserSearchTerms(query);
  const search = useUserSearch(term || '');

  const users = useMemo(() => {
    const seen = new Set<string>();
    const rows = search.data?.pages?.flatMap((page) => extractPageContent(page)) ?? [];
    return rows
      .map((row) => getUserSummary(row, 'user') as UserSummaryResponse)
      .filter((user) => {
        if (!user.id || user.id === currentUserId || seen.has(user.id)) return false;
        seen.add(user.id);
        return true;
      });
  }, [search.data, currentUserId]);

  return (
    <div>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 14px',
          background: v.surfaceSunken,
          border: `1px solid ${v.border}`,
          borderRadius: 999,
        }}
      >
        <LxIcon name="explore" size={16} color={v.ink3} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          autoFocus={autoFocus}
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: v.fontBody,
            fontSize: 14,
            color: v.ink,
          }}
        />
      </label>

      <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
        {users.map((user) => {
          const state = rowState?.(user) ?? {};
          const disabled = Boolean(state.disabled);
          return (
            <li key={user.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChoose(user)}
                data-person={user.username ?? undefined}
                style={{
                  appearance: 'none',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '9px 8px',
                  background: 'none',
                  border: 'none',
                  borderRadius: 8,
                  textAlign: 'left',
                  cursor: disabled ? 'default' : 'pointer',
                  opacity: disabled ? 0.55 : 1,
                }}
              >
                <LxAvatar size={32} src={user.avatarUrl} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: 'block',
                      fontFamily: v.fontBody,
                      fontSize: 14,
                      fontWeight: 500,
                      color: v.ink,
                    }}
                  >
                    {user.username}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontFamily: v.fontBody,
                      fontSize: 12,
                      color: v.ink3,
                    }}
                  >
                    {state.note ?? user.displayName}
                  </span>
                </span>
                {state.badge ? (
                  <span
                    style={{
                      fontFamily: v.fontBody,
                      fontSize: 12,
                      color: v.accentText,
                      background: v.accentDim,
                      borderRadius: 999,
                      padding: '3px 10px',
                    }}
                  >
                    {state.badge}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      {term && !search.isLoading && users.length === 0 ? (
        <p style={{ margin: '10px 4px', fontFamily: v.fontBody, fontSize: 13, color: v.ink3 }}>
          No one found.
        </p>
      ) : null}
      {!term && emptyHint ? (
        <p style={{ margin: '10px 4px', fontFamily: v.fontBody, fontSize: 13, color: v.ink3 }}>
          {emptyHint}
        </p>
      ) : null}
    </div>
  );
}
