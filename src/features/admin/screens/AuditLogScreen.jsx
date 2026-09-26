import { useSearchParams } from 'react-router-dom';

import { v } from '@/config/tokens';
import { isAdminRole } from '@/config/roles';
import { useAuthStore } from '@/store/useAuthStore';
import { LxIcon } from '@/components/ui/lx-icon';

import { PageHeader, PanelCard } from '../components/PanelPage';
import { RecordTable } from '../components/RecordTable';
import { LoadMore } from '../components/LoadMore';
import { LocalTime } from '../components/LocalTime';
import { ReporterName } from '../components/ReporterName';
import { SplitView } from '../components/SplitView';
import { ActionDetailPanel } from '../components/ActionDetailPanel';
import { AccountSearchPicker } from '../components/AccountSearchPicker';
import { DateRangeControl } from '../components/DateRangeControl';
import { getSplitSelection, withSelection } from '../lib/splitSelection';
import { useActions } from '../hooks/useActions';
import { useVocabularies } from '../hooks/useVocabularies';
import { useResolveUsername } from '../hooks/useResolveUsername';

/**
 * The actor filter, administrator only. Selecting an actor sets the `adminId`
 * query the log endpoint declares, using the account search built this phase —
 * the previous phase declared this filter but rendered no control for want of a
 * picker. The selected actor is held in the `actor` URL parameter so a
 * filtered-by-actor view is shareable, and its username is resolved for the chip.
 */
function ActorFilter({ actorId, onChange }) {
  const { username } = useResolveUsername(actorId);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderBottom: `1px solid ${v.border}`,
        flexWrap: 'wrap',
      }}
    >
      <LxIcon name="profile" size={14} color={v.ink2} />
      <span
        style={{
          fontFamily: v.fontMono,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: v.ink2,
        }}
      >
        actor
      </span>
      <AccountSearchPicker
        value={actorId ? { id: actorId, username } : null}
        onSelect={(account) => onChange(account?.id || '')}
        placeholder="filter by who acted…"
        id="audit-actor-picker"
      />
    </div>
  );
}

/**
 * The widest window the range control offers here.
 *
 * Unlike the activity log, this endpoint imposes **no span limit at all** — a
 * 3650-day window is accepted (`uptake-contract-verification.md` §4.3). The only
 * rule it enforces is that `to` must be later than `from`, which the control
 * already enforces. So this number is the control's widest preset rather than a
 * server refusal being anticipated, and no larger value would be rejected.
 */
const MAX_WINDOW_DAYS = 365;

/**
 * The target filter. Offered to both roles, unlike the actor filter: it narrows
 * the log to actions taken **against** one account, and that question is as
 * meaningful for a moderator reviewing what it did to someone as it is for an
 * administrator.
 *
 * It does not widen what a moderator may see. The server composes this with the
 * role scoping, so a moderator filtering by an account another administrator
 * acted on gets an empty page rather than that administrator's rows — verified,
 * not assumed.
 */
function TargetFilter({ targetUserId, onChange }) {
  const { username } = useResolveUsername(targetUserId);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderBottom: `1px solid ${v.border}`,
        flexWrap: 'wrap',
      }}
    >
      <LxIcon name="flag" size={14} color={v.ink2} />
      <span
        style={{
          fontFamily: v.fontMono,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: v.ink2,
        }}
      >
        target
      </span>
      <AccountSearchPicker
        value={targetUserId ? { id: targetUserId, username } : null}
        onSelect={(account) => onChange(account?.id || '')}
        placeholder="filter by who was acted on…"
        id="audit-target-picker"
      />
    </div>
  );
}

/**
 * The moderation action log. One implementation serves two views: a moderator
 * sees only its own actions, an administrator sees all. The result set is
 * role-scoped at the backend, so the two are the same screen with different
 * copy, not two screens.
 *
 * Four filters are offered and each is one the endpoint declares: `actionType`,
 * `adminId` (administrator only, since a moderator already sees only its own
 * actions), `targetUserId`, and a half-open time window. Nothing is filtered
 * client-side, and no filter the endpoint does not support is drawn.
 *
 * Every filter lives in the URL, so a filtered view is a shareable link. Rows
 * never show `metadata` — it exists only on the per-action fetch, which opens
 * in the right region beside the log.
 */
function ActionTypeFilter({ actions, value, onChange }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        borderBottom: `1px solid ${v.border}`,
        flexWrap: 'wrap',
      }}
    >
      <LxIcon name="filter" size={14} color={v.ink2} />
      <span
        style={{
          fontFamily: v.fontMono,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: v.ink2,
        }}
      >
        action type
      </span>
      <div style={{ position: 'relative' }}>
        {/* The shared control class, so this sits in the same row as the
            buttons and the date inputs and looks like one of them. The chevron
            stays the icon component's rather than a painted one. */}
        <select
          className="lx-admin-control"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={{ paddingRight: 30 }}
        >
          <option value="">all actions</option>
          {actions.map((action) => (
            <option key={action.key} value={action.key}>
              {action.displayName}
            </option>
          ))}
        </select>
        <span
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
          }}
        >
          <LxIcon name="chevronDown" size={14} color={v.ink2} />
        </span>
      </div>
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontFamily: v.fontBody,
            fontSize: 12,
            color: v.ink2,
          }}
        >
          <LxIcon name="close" size={12} color={v.ink2} />
          clear
        </button>
      ) : null}
    </div>
  );
}

export function AuditLogScreen() {
  const role = useAuthStore((state) => state.role);
  const isAdmin = isAdminRole(role);
  const [searchParams, setSearchParams] = useSearchParams();

  const actionType = searchParams.get('type') || '';
  const actorId = searchParams.get('actor') || '';
  const targetUserId = searchParams.get('target') || '';

  // The window lives in the URL as two ISO instants so a filtered view is a
  // shareable link, and is read back as milliseconds for the range control.
  // Both must be present or neither is applied: a half-specified window would
  // silently mean something different from what the reviewer set.
  const fromIso = searchParams.get('from') || '';
  const toIso = searchParams.get('to') || '';
  const range = fromIso && toIso ? { fromMs: Date.parse(fromIso), toMs: Date.parse(toIso) } : null;

  const { moderationActions, actionLabel, actionKnown } = useVocabularies();
  const {
    rows,
    isLoading,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useActions({
    actionType: actionType || undefined,
    adminId: isAdmin ? actorId || undefined : undefined,
    targetUserId: targetUserId || undefined,
    from: range ? new Date(range.fromMs).toISOString() : undefined,
    to: range ? new Date(range.toMs).toISOString() : undefined,
  });

  const setParam = (key, value) => {
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

  // Both bounds move together, in one history entry, so back undoes the whole
  // window rather than half of it.
  const commitRange = (next) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next) {
          params.set('from', new Date(next.fromMs).toISOString());
          params.set('to', new Date(next.toMs).toISOString());
        } else {
          params.delete('from');
          params.delete('to');
        }
        return params;
      },
      { replace: false }
    );
  };

  // The open action is carried in the same `selected` parameter every other
  // split screen in the panel uses, so one helper governs all four.
  const { selectedId, hasSelection } = getSplitSelection(searchParams, rows);
  const openAction = (row) => setSearchParams(withSelection(searchParams, row.id));
  const closeRecord = () => setSearchParams(withSelection(searchParams, null));

  const columns = [
    {
      key: 'action',
      header: 'action',
      nowrap: true,
      render: (row) => {
        const known = actionKnown(row.actionType);
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink, fontWeight: 500 }}>
              {known ? actionLabel(row.actionType) : row.actionType}
            </span>
            {!known ? (
              <span
                title="not in the moderation-action vocabulary"
                style={{
                  fontFamily: v.fontMono,
                  fontSize: 9,
                  textTransform: 'uppercase',
                  color: v.warningText,
                  background: v.warningDim,
                  borderRadius: 999,
                  padding: '1px 6px',
                }}
              >
                unknown
              </span>
            ) : null}
          </span>
        );
      },
    },
    {
      key: 'actor',
      header: 'by',
      nowrap: true,
      // An auto-issued strike carries no acting administrator; show it as system
      // rather than a blank cell.
      render: (row) =>
        row.adminId ? (
          <ReporterName userId={row.adminId} prefix="@" />
        ) : (
          <span
            style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink2, fontStyle: 'italic' }}
          >
            system
          </span>
        ),
    },
    {
      key: 'target',
      header: 'target',
      nowrap: true,
      render: (row) =>
        row.targetUserId ? (
          <ReporterName userId={row.targetUserId} prefix="@" />
        ) : (
          <span style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink2 }}>
            {row.targetEntityType}
            {row.targetEntityId ? (
              <span style={{ fontFamily: v.fontMono, fontSize: 11, color: v.ink2, marginLeft: 6 }}>
                {row.targetEntityId.slice(0, 8)}
              </span>
            ) : null}
          </span>
        ),
    },
    {
      key: 'report',
      header: 'report',
      nowrap: true,
      render: (row) =>
        row.reportId ? (
          <LxIcon name="flag" size={13} color={v.ink2} />
        ) : (
          <span style={{ color: v.ink2 }}>—</span>
        ),
    },
    {
      key: 'when',
      header: 'when',
      nowrap: true,
      render: (row) => <LocalTime value={row.createdAt} showZone={false} />,
    },
    {
      key: 'chevron',
      header: '',
      align: 'right',
      width: 40,
      render: () => <LxIcon name="chevronRight" size={14} color={v.ink2} />,
    },
  ];

  const list = (
    <div>
      <PageHeader title={isAdmin ? 'action log' : 'my actions'} />
      <PanelCard padded={false}>
        <ActionTypeFilter
          actions={moderationActions}
          value={actionType}
          onChange={(value) => setParam('type', value)}
        />
        {isAdmin ? (
          <ActorFilter actorId={actorId} onChange={(value) => setParam('actor', value)} />
        ) : null}
        <TargetFilter targetUserId={targetUserId} onChange={(value) => setParam('target', value)} />
        {/* The rows above inset their content 16px from the card edge; this wrapper
            matches that and the statistics screen's own DateRangeControl, which sits
            in a padded PanelCard rather than one tightened to 4px like this was. */}
        <div style={{ padding: '16px' }}>
          <DateRangeControl
            value={range}
            maxDays={MAX_WINDOW_DAYS}
            onCommit={commitRange}
            unsetHint="no time window is applied — the log is showing every action. set both ends and apply to narrow it."
          />
        </div>
        <RecordTable
          columns={columns}
          rows={rows}
          keyField="id"
          onRowClick={openAction}
          selectedKey={selectedId}
          isLoading={isLoading}
          isError={isError}
          errorMessage={error?.message}
          onRetry={refetch}
          emptyIcon="clock"
          emptyTitle={isAdmin ? 'no actions yet' : 'no actions yet'}
          emptyHint={
            isAdmin
              ? 'no moderation actions have been recorded for this filter.'
              : 'you have taken no moderation actions for this filter.'
          }
          footer={
            <LoadMore
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              onLoadMore={() => fetchNextPage()}
            />
          }
        />
      </PanelCard>
    </div>
  );

  return (
    <SplitView
      list={list}
      hasSelection={hasSelection}
      onClose={closeRecord}
      backLabel="back to the log"
      emptyIcon="clock"
      emptyTitle="no action open"
      emptyHint="pick a row from the log to see who acted, on what, and everything the record carries."
      detail={selectedId ? <ActionDetailPanel key={selectedId} actionId={selectedId} /> : null}
    />
  );
}
