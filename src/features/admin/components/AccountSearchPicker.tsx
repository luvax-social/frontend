import type { ReactNode } from 'react';
export interface AccountSelection {
  id: string;
  username?: string;
}
import { useEffect, useRef, useState } from 'react';

import { v } from '@/config/tokens';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { LxIcon } from '@/components/ui/lx-icon';

import { StatusBadge } from './StatusBadge';
import { useDebouncedSearch } from '../hooks/useDebouncedSearch';
import { useAccountSearch } from '../hooks/useAccounts';
import { describeError } from '../lib/errors';

/**
 * A deliberate, debounced account picker built on the account search endpoint,
 * shared by the audit log's actor filter and available to the account list.
 *
 * Search is not a request per keystroke: the term is debounced and only fires at
 * two characters or more, never on a blank or whitespace query. A rate-limit
 * refusal disables the input for the returned `Retry-After` and says why, and is
 * never retried automatically. A selected account is shown as a chip with a
 * clear control; clearing returns to the search input.
 *
 * @param {{id:string, username?:string}|null} value the chosen account
 * @param {(account:{id:string, username:string}|null)=>void} onSelect
 * @param {string} [placeholder]
 * @param {string} [id]
 */
export function AccountSearchPicker({
  value,
  onSelect,
  placeholder = 'search accounts…',
  id = 'account-picker',
}: {
  value: AccountSelection | null;
  onSelect: (account: AccountSelection | null) => void;
  placeholder?: string;
  id?: string;
}) {
  const { text, setText, term, cooling, cooldownRemaining, startCooldown, tooShort, reset } =
    useDebouncedSearch({ minLength: 2 });
  const { rows, isLoading, isError, error, active } = useAccountSearch(term);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const described = isError ? describeError(error) : null;
    if (described?.retryAfterSeconds) {
      startCooldown(described.retryAfterSeconds);
    }
    // Only react to a fresh error; startCooldown is stable enough for this guard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isError, error]);

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

  if (value) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 6px 5px 12px',
          borderRadius: 999,
          background: v.accentDim,
          border: `1px solid ${v.accent}`,
        }}
      >
        <LxIcon name="profile" size={13} color={v.accentText} />
        <span style={{ fontFamily: v.fontBody, fontSize: 13, color: v.accentText }}>
          @{value.username || value.id.slice(0, 8)}
        </span>
        <button
          type="button"
          aria-label="clear selected account"
          onClick={() => {
            onSelect(null);
            reset();
          }}
          style={{
            display: 'inline-flex',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 2,
          }}
        >
          <LxIcon name="close" size={13} color={v.accentText} />
        </button>
      </span>
    );
  }

  const showDropdown = open && (active || tooShort || cooling || isError);

  return (
    <div ref={rootRef} style={{ position: 'relative', width: 260, maxWidth: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: v.surfaceSunken,
          border: `1px solid ${cooling ? v.warning : v.border}`,
          borderRadius: 999,
          padding: '6px 12px',
        }}
      >
        <LxIcon name="explore" size={14} color={v.ink2} />
        <input
          id={id}
          type="text"
          value={text}
          disabled={cooling}
          placeholder={cooling ? `rate limited — retry in ${cooldownRemaining}s` : placeholder}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
          }}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontFamily: v.fontBody,
            fontSize: 13,
            color: v.ink,
          }}
        />
        {isLoading && active ? <LxIcon name="clock" size={13} color={v.ink2} /> : null}
      </div>

      {showDropdown ? (
        <div
          role="listbox"
          aria-label="account results"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 20,
            maxHeight: 300,
            overflowY: 'auto',
            background: v.base,
            border: `1px solid ${v.border}`,
            borderRadius: 12,
            boxShadow: `0 12px 32px ${v.shadow18}`,
            padding: 4,
          }}
        >
          {cooling ? (
            <Hint>rate limited. searching is paused for {cooldownRemaining}s.</Hint>
          ) : tooShort ? (
            <Hint>keep typing — at least two characters.</Hint>
          ) : isError ? (
            <Hint>{describeError(error).message}</Hint>
          ) : isLoading ? (
            <Hint>searching…</Hint>
          ) : rows.length === 0 ? (
            <Hint>no accounts match.</Hint>
          ) : (
            rows.map((row) => (
              <button
                key={row.id}
                type="button"
                role="option"
                onClick={() => {
                  onSelect({ id: row.id, username: row.username });
                  setOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = v.surface)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                  <span
                    style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink, fontWeight: 500 }}
                  >
                    @{row.username}
                  </span>
                  {row.displayName ? (
                    <span
                      style={{
                        fontFamily: v.fontBody,
                        fontSize: 12,
                        color: v.ink2,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {row.displayName}
                    </span>
                  ) : null}
                </span>
                <StatusBadge status={row.role} size="sm" />
                <StatusBadge status={row.status} size="sm" />
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

const Hint = ({ children }: { children?: ReactNode }) => (
  <div style={{ padding: '10px 12px', fontFamily: v.fontBody, fontSize: 13, color: v.ink2 }}>
    {children}
  </div>
);
