import { getErrorMessage } from '@/utils/errors';
import type { Column } from '../components/RecordTable';
import type { HashtagAdminResponse, AdminCreateHashtagRequest } from '@/types/admin';
import { useEffect, useState } from 'react';

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
import { HashtagCreateDialog } from '../components/HashtagCreateDialog';
import { useHashtagList, useHashtagSearch } from '../hooks/useHashtags';
import { useHashtagActions } from '../hooks/useHashtagActions';
import { useDebouncedSearch } from '../hooks/useDebouncedSearch';
import { describeError, getErrorCode } from '../lib/errors';

/**
 * The administrative hashtag registry. Administrator only. Manages the hashtag
 * vocabulary: list and search, creation, status transitions, and delete.
 *
 * Search is a deliberate action under the same rate-limit discipline as account
 * search. Creation reads the new hashtag's id from the audit action's
 * `targetEntityId`, and a duplicate is shown against the name input, not a toast.
 * Status transitions run behind the shared reason-carrying confirmation; banning
 * a tag warns that a post restored later drops it, and delete states that the
 * record is marked deleted rather than removed.
 */

const STATUS_OPTIONS = [
  { value: 'active', label: 'active' },
  { value: 'banned', label: 'banned' },
  { value: 'deleted', label: 'deleted' },
];

// The sentence that matters most here is the one about what banning does *not*
// do. A reviewer who bans a tag believing the posts carrying it have come down
// will stop looking, and the content stays up. So the limit is stated first and
// plainly, before the consequences that do follow.
const BAN_CONSEQUENCE =
  'this does not take down any existing post. posts already carrying this tag stay published and visible; banning only removes the tag from discovery and refuses it on new posts. a post removed and restored later drops the tag while it stays banned. unbanning returns the tag to active.';
const DELETE_CONSEQUENCE =
  'delete marks this hashtag deleted rather than removing it: it stops being usable and the record remains, findable under the deleted filter. it can be restored to active afterward.';

export function HashtagRegistryScreen() {
  const [status, setStatus] = useState('');
  const search = useDebouncedSearch({ minLength: 1 });
  const list = useHashtagList({ status: status || undefined });
  const searchResult = useHashtagSearch(search.term, { status: status || undefined });
  const hashtagActions = useHashtagActions();

  const [createOpen, setCreateOpen] = useState(false);
  const [nameError, setNameError] = useState('');
  const [confirm, setConfirm] = useState<{
    type: 'ban' | 'unban' | 'restore' | 'delete';
    tag: HashtagAdminResponse;
  } | null>(null); // { type, tag }

  useEffect(() => {
    const described = searchResult.isError ? describeError(searchResult.error) : null;
    if (described?.retryAfterSeconds) {
      search.startCooldown(described.retryAfterSeconds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchResult.isError, searchResult.error]);

  const view = searchResult.active ? searchResult : list;
  const busy = hashtagActions.update.isPending || hashtagActions.remove.isPending;

  const submitCreate = ({ name, status: initialStatus, note }: AdminCreateHashtagRequest) => {
    setNameError('');
    hashtagActions.create.mutate(
      { name, status: initialStatus, note },
      {
        onSuccess: () => {
          // The response is the audit action; the new hashtag's id is
          // targetEntityId. The lists refetch through the mutation, so the tag
          // is reachable immediately.
          toast('hashtag created');
          setCreateOpen(false);
        },
        onError: (err: unknown) => {
          const code = getErrorCode(err);
          if (code === 'HASHTAG_ALREADY_EXISTS') {
            setNameError('a hashtag with this name already exists');
            return;
          }
          const described = describeError(err);
          if (described.kind === 'field' && described.fields?.name) {
            setNameError(described.fields.name);
            return;
          }
          if (described.kind !== 'silent') {
            toast(described.message);
          }
          setCreateOpen(false);
        },
      }
    );
  };

  const runConfirm = (reason: string) => {
    if (!confirm) {
      return;
    }
    const { type, tag } = confirm;
    const done = (message: string) => () => {
      toast(message);
      setConfirm(null);
    };
    const onError = (err: unknown) => {
      const described = describeError(err);
      if (described.isConflict) {
        view.refetch();
      }
      if (described.kind !== 'silent') {
        toast(described.message);
      }
      setConfirm(null);
    };
    if (type === 'delete') {
      hashtagActions.remove.mutate(
        { hashtagId: tag.id, reason },
        { onSuccess: done('hashtag deleted'), onError }
      );
      return;
    }
    const nextStatus = type === 'ban' ? 'banned' : 'active';
    const message =
      type === 'ban'
        ? 'hashtag banned'
        : type === 'restore'
          ? 'hashtag restored'
          : 'hashtag unbanned';
    hashtagActions.update.mutate(
      { hashtagId: tag.id, status: nextStatus, note: reason },
      { onSuccess: done(message), onError }
    );
  };

  const rowActions = (tag: HashtagAdminResponse) => {
    const buttons: ['ban' | 'unban' | 'restore' | 'delete', string, string][] = [];
    if (tag.status === 'active') {
      buttons.push(['ban', 'ban', v.error]);
      buttons.push(['delete', 'trash', v.ink2]);
    } else if (tag.status === 'banned') {
      buttons.push(['unban', 'check', v.successText]);
      buttons.push(['delete', 'trash', v.ink2]);
    } else if (tag.status === 'deleted') {
      buttons.push(['restore', 'check', v.successText]);
    }
    return (
      <span style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
        {buttons.map(([type, icon, color]) => (
          <button
            key={type}
            type="button"
            aria-label={`${type} ${tag.name}`}
            title={type}
            onClick={(event) => {
              event.stopPropagation();
              setConfirm({ type, tag });
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

  const columns: Column<HashtagAdminResponse>[] = [
    {
      key: 'name',
      header: 'hashtag',
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
          <LxIcon name="hash" size={13} color={v.ink2} />
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
      key: 'created',
      header: 'created',
      nowrap: true,
      render: (row) => <LocalTime value={row.createdAt} showZone={false} />,
    },
    { key: 'actions', header: '', align: 'right', render: rowActions },
  ];

  const confirmProps = (() => {
    if (!confirm) {
      return { open: false };
    }
    const { type, tag } = confirm;
    if (type === 'ban') {
      return {
        open: true,
        title: `ban #${tag.name}`,
        description: BAN_CONSEQUENCE,
        confirmLabel: 'ban hashtag',
        tone: 'danger',
      };
    }
    if (type === 'delete') {
      return {
        open: true,
        title: `delete #${tag.name}`,
        description: DELETE_CONSEQUENCE,
        confirmLabel: 'delete hashtag',
        tone: 'danger',
      };
    }
    if (type === 'restore') {
      return {
        open: true,
        title: `restore #${tag.name}`,
        description: 'this returns the hashtag to active, usable in posts and search again.',
        confirmLabel: 'restore hashtag',
        tone: 'default',
      };
    }
    return {
      open: true,
      title: `unban #${tag.name}`,
      description: 'this returns the hashtag to active, usable in posts again.',
      confirmLabel: 'unban hashtag',
      tone: 'default',
    };
  })();

  return (
    <div>
      <PageHeader
        title="hashtags"
        right={
          <LxBtn
            variant="primary"
            size="sm"
            onClick={() => {
              setNameError('');
              setCreateOpen(true);
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <LxIcon name="plus" size={14} color={v.inkInverse} />
              create hashtag
            </span>
          </LxBtn>
        }
      />

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
                  : 'search hashtags'
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
          emptyIcon="hash"
          emptyTitle={searchResult.active ? 'no hashtags match' : 'no hashtags yet'}
          emptyHint={
            searchResult.active
              ? 'no hashtag matches this search.'
              : 'create a hashtag to start the vocabulary.'
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

      <HashtagCreateDialog
        open={createOpen}
        busy={hashtagActions.create.isPending}
        nameError={nameError}
        onConfirm={submitCreate}
        onClose={() => setCreateOpen(false)}
      />

      <ReasonConfirmDialog
        {...confirmProps}
        busy={busy}
        onConfirm={runConfirm}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
