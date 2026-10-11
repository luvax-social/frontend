import { getErrorMessage } from '@/utils/errors';
import type { Column } from '../components/RecordTable';
import type { AdminUserListItemResponse } from '@/types/admin';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import { v } from '@/config/tokens';
import { LxIcon } from '@/components/ui/lx-icon';

import { PageHeader, PanelCard } from '../components/PanelPage';
import { RecordTable } from '../components/RecordTable';
import { FilterBar } from '../components/FilterBar';
import { LoadMore } from '../components/LoadMore';
import { LocalTime } from '../components/LocalTime';
import { SplitView } from '../components/SplitView';
import { StatusBadge } from '../components/StatusBadge';
import { getSplitSelection, withSelection } from '../lib/splitSelection';
import { AccountModerationScreen } from './AccountModerationScreen';
import { useAccountList, useAccountSearch } from '../hooks/useAccounts';
import { useDebouncedSearch } from '../hooks/useDebouncedSearch';
import { describeError } from '../lib/errors';

/**
 * The account list and search. Administrator only — the route sits behind the
 * administrator-only guard because the backend answers the whole account surface
 * with 403 for a moderator.
 *
 * The only filters are the two the endpoint declares, `status` and `role`, held
 * in the URL so a filtered view is shareable and survives a reload; nothing is
 * filtered client-side. Search is a separate, deliberate action: debounced, fired
 * only at two characters or more, never on a blank query, and disabled for the
 * returned `Retry-After` on a rate-limit refusal. When a search is active it
 * replaces the filtered list, because the search endpoint takes only `q`.
 */

const STATUS_OPTIONS = [
  { value: 'active', label: 'active' },
  { value: 'suspended', label: 'suspended' },
  { value: 'deactivated', label: 'deactivated' },
  { value: 'banned', label: 'banned' },
];
const ROLE_OPTIONS = [
  { value: 'user', label: 'user' },
  { value: 'moderator', label: 'moderator' },
  { value: 'admin', label: 'admin' },
];

export function AccountListScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') || '';
  const role = searchParams.get('role') || '';

  const search = useDebouncedSearch({ minLength: 2 });
  const list = useAccountList({ status: status || undefined, role: role || undefined });
  const searchResult = useAccountSearch(search.term);

  useEffect(() => {
    const described = searchResult.isError ? describeError(searchResult.error) : null;
    if (described?.retryAfterSeconds) {
      search.startCooldown(described.retryAfterSeconds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchResult.isError, searchResult.error]);

  const searching = searchResult.active || search.tooShort || search.cooling;
  const view = searchResult.active ? searchResult : list;

  // The open account is a history entry of its own, so back walks from one
  // account to the account before it and finally to the bare list.
  const { selectedId, hasSelection } = getSplitSelection(searchParams, view.rows);
  const openRecord = (id: string) =>
    setSearchParams(withSelection(searchParams, id), { replace: false });
  const closeRecord = () => setSearchParams(withSelection(searchParams, null), { replace: false });

  const setFilter = (key: string, value: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) {
          next.set(key, value);
        } else {
          next.delete(key);
        }
        return next;
      },
      { replace: false }
    );
  };

  const columns: Column<AdminUserListItemResponse>[] = [
    {
      key: 'account',
      header: 'account',
      render: (row) => (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink, fontWeight: 500 }}>
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
                maxWidth: 220,
              }}
            >
              {row.displayName}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'email',
      header: 'email',
      nowrap: true,
      render: (row) => <span style={{ color: v.ink2 }}>{row.email}</span>,
    },
    {
      key: 'role',
      header: 'role',
      nowrap: true,
      render: (row) => <StatusBadge status={row.role} size="sm" />,
    },
    {
      key: 'status',
      header: 'status',
      nowrap: true,
      render: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      key: 'joined',
      header: 'joined',
      nowrap: true,
      render: (row) => <LocalTime value={row.createdAt} showZone={false} />,
    },
    {
      key: 'lastLogin',
      header: 'last login',
      nowrap: true,
      render: (row) =>
        row.lastLoginAt ? (
          <LocalTime value={row.lastLoginAt} showZone={false} />
        ) : (
          <span style={{ color: v.ink2 }}>never</span>
        ),
    },
    {
      key: 'chevron',
      header: '',
      align: 'right',
      width: 40,
      render: () => <LxIcon name="chevronRight" size={14} color={v.ink2} />,
    },
  ];

  const isDirty = Boolean(status || role);

  const listPane = (
    <div>
      <PageHeader title="accounts" />

      <PanelCard padded={false}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            borderBottom: `1px solid ${v.border}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flex: 1,
              minWidth: 0,
              background: v.surfaceSunken,
              border: `1px solid ${search.cooling ? v.warning : v.border}`,
              borderRadius: 999,
              padding: '8px 14px',
            }}
          >
            <LxIcon name="explore" size={15} color={v.ink2} />
            <input
              type="text"
              value={search.text}
              disabled={search.cooling}
              placeholder={
                search.cooling
                  ? `rate limited — searching again in ${search.cooldownRemaining}s`
                  : 'search by username or name (min 2 characters)'
              }
              onChange={(event) => search.setText(event.target.value)}
              style={{
                flex: 1,
                minWidth: 0,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontFamily: v.fontBody,
                fontSize: 14,
                color: v.ink,
              }}
            />
            {search.text ? (
              <button
                type="button"
                aria-label="clear search"
                onClick={search.reset}
                style={{
                  display: 'inline-flex',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 2,
                }}
              >
                <LxIcon name="close" size={14} color={v.ink2} />
              </button>
            ) : null}
          </div>
        </div>

        {search.cooling ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              borderBottom: `1px solid ${v.border}`,
              background: v.warningDim,
              fontFamily: v.fontBody,
              fontSize: 13,
              color: v.warningText,
            }}
          >
            <LxIcon name="clock" size={14} color={v.warningText} />
            search is rate limited. it will be available again in {search.cooldownRemaining}s. no
            automatic retry.
          </div>
        ) : search.tooShort ? (
          <div
            style={{
              padding: '10px 16px',
              borderBottom: `1px solid ${v.border}`,
              fontFamily: v.fontBody,
              fontSize: 13,
              color: v.ink2,
            }}
          >
            keep typing — search needs at least two characters.
          </div>
        ) : searchResult.active ? (
          <div
            style={{
              padding: '10px 16px',
              borderBottom: `1px solid ${v.border}`,
              fontFamily: v.fontBody,
              fontSize: 13,
              color: v.ink2,
            }}
          >
            showing search results. status and role filters apply to the full list, not to search.
          </div>
        ) : (
          <FilterBar
            groups={[
              { key: 'status', label: 'status', value: status, options: STATUS_OPTIONS },
              { key: 'role', label: 'role', value: role, options: ROLE_OPTIONS },
            ]}
            onChange={setFilter}
            onClear={() => setSearchParams({}, { replace: false })}
            isDirty={isDirty}
          />
        )}

        <RecordTable
          columns={columns}
          rows={view.rows}
          onRowClick={(row) => openRecord(row.id)}
          selectedKey={selectedId}
          isLoading={view.isLoading}
          isError={view.isError}
          errorMessage={getErrorMessage(view.error, 'Something went wrong.')}
          onRetry={view.refetch}
          emptyIcon={searching ? 'explore' : 'profile'}
          emptyTitle={searchResult.active ? 'no accounts match' : 'no accounts here'}
          emptyHint={
            searchResult.active
              ? 'no account matches this search.'
              : isDirty
                ? 'no account matches these filters.'
                : 'no accounts to show.'
          }
          footer={
            <LoadMore
              hasNextPage={view.hasNextPage}
              isFetchingNextPage={view.isFetchingNextPage}
              onLoadMore={() => view.fetchNextPage()}
            />
          }
        />
      </PanelCard>
    </div>
  );

  return (
    <SplitView
      list={listPane}
      hasSelection={hasSelection}
      onClose={closeRecord}
      backLabel="back to accounts"
      emptyIcon="profile"
      emptyTitle="no account open"
      emptyHint="pick an account from the list to see its state, its history, and what can be done about it."
      detail={
        selectedId ? (
          <AccountModerationScreen key={selectedId} userId={selectedId} embedded />
        ) : null
      }
    />
  );
}
