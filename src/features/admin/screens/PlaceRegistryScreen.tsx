import { getErrorMessage } from '@/utils/errors';
import type { Column } from '../components/RecordTable';
import type { PlaceAdminResponse } from '@/types/domain';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { v } from '@/config/tokens';
import { LxIcon } from '@/components/ui/lx-icon';
import { LxBtn } from '@/features/luvax/components/primitives';
import { toast } from '@/features/luvax/components/Toast';

import { PageHeader, PanelCard } from '../components/PanelPage';
import { RecordTable } from '../components/RecordTable';
import { FilterBar } from '../components/FilterBar';
import { LoadMore } from '../components/LoadMore';
import { LocalTime } from '../components/LocalTime';
import { StatusBadge } from '../components/StatusBadge';
import { ReasonConfirmDialog } from '../components/ReasonConfirmDialog';
import { usePlaceList, usePlaceSearch } from '../hooks/usePlaces';
import { usePlaceActions } from '../hooks/usePlaceActions';
import { useDebouncedSearch } from '../hooks/useDebouncedSearch';
import { describeError } from '../lib/errors';

/**
 * The administrative places registry. Administrator only. Lists and searches every place, whatever
 * its status, and moves a place between active, banned and deleted.
 *
 * Every action asks for a reason, because every action writes an audit row and the reason is the
 * only record of why. Unban also brings back a deleted place, so there is no separate restore.
 * Banning or deleting a place never takes a post down: posts that used it stay published and only
 * lose the place line. When the screen is opened from a place report it carries that report's id,
 * and an action on that place resolves the report in the same transaction.
 */

const STATUS_OPTIONS = [
  { value: 'active', label: 'active' },
  { value: 'banned', label: 'banned' },
  { value: 'deleted', label: 'deleted' },
];

const BAN_CONSEQUENCE =
  'this does not take down any post. posts already at this place stay published and visible; the place line disappears from them, from search, from the location page and from every other surface, and the name is refused on new posts. unbanning returns the place.';
const DELETE_CONSEQUENCE =
  'delete hides this place the same way a ban does and marks it deleted rather than removing it, so the posts that used it keep their reference. unbanning brings a deleted place back.';

type ConfirmType = 'ban' | 'unban' | 'delete';

export function PlaceRegistryScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // A place report opens this screen with the place's name to search for and the report to resolve.
  const reportId = searchParams.get('report');
  const reportPlaceId = searchParams.get('place');
  const initialTerm = searchParams.get('q') ?? '';

  const [status, setStatus] = useState('');
  const search = useDebouncedSearch({ minLength: 1 });
  const list = usePlaceList({ status: status || undefined });
  const searchResult = usePlaceSearch(search.term, { status: status || undefined });
  const placeActions = usePlaceActions();
  const [confirm, setConfirm] = useState<{ type: ConfirmType; place: PlaceAdminResponse } | null>(
    null
  );

  useEffect(() => {
    if (initialTerm) search.setText(initialTerm);
    // Seeds the search box once from the address; later typing is the person's own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const described = searchResult.isError ? describeError(searchResult.error) : null;
    if (described?.retryAfterSeconds) search.startCooldown(described.retryAfterSeconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchResult.isError, searchResult.error]);

  const view = searchResult.active ? searchResult : list;
  const busy = placeActions.update.isPending;

  const runConfirm = (reason: string) => {
    if (!confirm) return;
    const { type, place } = confirm;
    const nextStatus = type === 'ban' ? 'banned' : type === 'delete' ? 'deleted' : 'active';
    const message =
      type === 'ban' ? 'place banned' : type === 'delete' ? 'place deleted' : 'place unbanned';
    placeActions.update.mutate(
      {
        placeId: place.id,
        status: nextStatus,
        note: reason,
        // Only the place the report is about carries the report's id, so an action on any other
        // row can never resolve it by accident.
        ...(reportId && reportPlaceId === place.id ? { reportId } : {}),
      },
      {
        onSuccess: () => {
          toast(message);
          setConfirm(null);
        },
        onError: (err: unknown) => {
          const described = describeError(err);
          if (described.isConflict) view.refetch();
          if (described.kind !== 'silent') toast(described.message);
          setConfirm(null);
        },
      }
    );
  };

  const rowActions = (place: PlaceAdminResponse) => {
    const buttons: [ConfirmType, string, string][] = [];
    if (place.status === 'active') {
      buttons.push(['ban', 'ban', v.error]);
      buttons.push(['delete', 'trash', v.ink2]);
    } else if (place.status === 'banned') {
      buttons.push(['unban', 'check', v.successText]);
      buttons.push(['delete', 'trash', v.ink2]);
    } else {
      buttons.push(['unban', 'check', v.successText]);
    }
    return (
      <span style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
        {buttons.map(([type, icon, color]) => (
          <button
            key={type}
            type="button"
            aria-label={`${type} ${place.name}`}
            title={type}
            onClick={(event) => {
              event.stopPropagation();
              setConfirm({ type, place });
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 9px',
              borderRadius: 999,
              background: v.surface,
              border: `1px solid ${v.border}`,
              cursor: 'pointer',
              fontFamily: v.fontBody,
              fontSize: 12,
              color,
            }}
          >
            <LxIcon name={icon} size={12} color={color} />
            {type}
          </button>
        ))}
      </span>
    );
  };

  const columns: Column<PlaceAdminResponse>[] = [
    {
      key: 'name',
      header: 'place',
      render: (row) => (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: v.fontBody,
            fontSize: 13,
            color: v.ink,
            fontWeight: 500,
          }}
        >
          <LxIcon name="mapPin" size={13} color={v.ink2} />
          {row.name}
        </span>
      ),
    },
    {
      key: 'postCount',
      header: 'posts',
      align: 'right',
      nowrap: true,
      render: (row) => (
        <span style={{ fontFamily: v.fontMono, fontSize: 12, color: v.ink2 }}>
          {row.postCount ?? 0}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'status',
      nowrap: true,
      render: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      key: 'note',
      header: 'note',
      render: (row) => (
        <span style={{ fontFamily: v.fontBody, fontSize: 12, color: v.ink2 }}>
          {row.statusNote ?? ''}
        </span>
      ),
    },
    {
      key: 'created',
      header: 'created',
      nowrap: true,
      render: (row) => <LocalTime value={row.createdAt} showZone={false} />,
    },
    { key: 'actions', header: '', align: 'right', render: rowActions },
  ];

  const confirmProps = (() => {
    if (!confirm) return { open: false };
    const { type, place } = confirm;
    if (type === 'ban') {
      return {
        open: true,
        title: `ban ${place.name}`,
        description: BAN_CONSEQUENCE,
        confirmLabel: 'ban place',
        tone: 'danger',
      };
    }
    if (type === 'delete') {
      return {
        open: true,
        title: `delete ${place.name}`,
        description: DELETE_CONSEQUENCE,
        confirmLabel: 'delete place',
        tone: 'danger',
      };
    }
    return {
      open: true,
      title: `unban ${place.name}`,
      description:
        place.status === 'deleted'
          ? 'this brings the deleted place back to active, usable on posts and in search again.'
          : 'this returns the place to active, usable on posts and in search again.',
      confirmLabel: 'unban place',
      tone: 'default',
    };
  })();

  return (
    <div>
      <PageHeader title="places" />

      {reportId ? (
        <div
          role="note"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '10px 16px',
            marginBottom: 12,
            borderRadius: 8,
            background: v.accentDim,
            fontFamily: v.fontBody,
            fontSize: 13,
            color: v.ink,
          }}
        >
          <span>
            you are acting on a report. banning or deleting the place this report is about resolves
            it.
          </span>
          <LxBtn
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => navigate(`/admin/reports/${reportId}`)}
          >
            back to report
          </LxBtn>
        </div>
      ) : null}

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
                  ? `rate limited - searching again in ${search.cooldownRemaining}s`
                  : 'search places'
              }
              aria-label="search places"
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
        ) : (
          <FilterBar
            groups={[{ key: 'status', label: 'status', value: status, options: STATUS_OPTIONS }]}
            onChange={(_key, value) => setStatus(value)}
            onClear={() => setStatus('')}
            isDirty={Boolean(status)}
          />
        )}

        <RecordTable
          columns={columns}
          rows={view.rows}
          isLoading={view.isLoading}
          isError={view.isError}
          errorMessage={getErrorMessage(view.error, 'Something went wrong.')}
          onRetry={view.refetch}
          emptyIcon="mapPin"
          emptyTitle={searchResult.active ? 'no places match' : 'no places yet'}
          emptyHint={
            searchResult.active
              ? 'no place matches this search.'
              : 'places appear here once someone tags a post with one.'
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

      <ReasonConfirmDialog
        {...confirmProps}
        busy={busy}
        onConfirm={runConfirm}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
