import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { v } from '@/config/tokens';
import { routeTo } from '@/config/constants';
import { LxIcon } from '@/components/ui/lx-icon';
import { LxTag } from '@/features/luvax/components/primitives';

import { PageHeader, PanelCard } from '../components/PanelPage';
import { RecordTable } from '../components/RecordTable';
import { LoadMore } from '../components/LoadMore';
import { LocalTime } from '../components/LocalTime';
import { EmptyState } from '../components/ListStates';
import { DateRangeControl } from '../components/DateRangeControl';
import { AccountSearchPicker } from '../components/AccountSearchPicker';
import { useUserEvents, WRITTEN_EVENT_TYPES } from '../hooks/useUserEvents';
import { useRateLimitCooldown } from '../hooks/useRateLimitCooldown';
import { useResolveUsername, shortId } from '../hooks/useResolveUsername';
import { describeError } from '../lib/errors';
import { localZone } from '../lib/statistics';

/**
 * The behavioural activity log. Administrator only.
 *
 * Three constraints from the endpoint shape this screen, and each is enforced
 * here rather than discovered from a 400:
 *
 * **Both bounds are mandatory.** The table is partitioned by time, so a query
 * without a window reads every partition ever created and the server refuses
 * one. The screen therefore starts with no range committed and issues nothing at
 * all until a reviewer applies one — not a request that fails, no request.
 *
 * **The window may span at most thirty days**, inclusive. The range control
 * clamps to that before submitting and states the limit on itself.
 *
 * **The filter offers only what the application actually writes**, which is
 * nine types. The `event_type` enumeration declares twenty; most have no
 * writer at all. Offering a filter that can never match would leave an
 * administrator who tried it concluding the log was broken.
 *
 * The endpoint is one of the two tightest in the system, so nothing here fires
 * on a keystroke or a drag; every read follows a deliberate commit.
 */

const MAX_WINDOW_DAYS = 30;

export function ActivityLogScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const accountId = searchParams.get('account') || '';
  const eventType = searchParams.get('type') || '';

  const [range, setRange] = useState(null);
  const cooldown = useRateLimitCooldown();

  const events = useUserEvents({ userId: accountId || undefined, range, eventType });

  useEffect(() => {
    if (!events.isError) {
      return;
    }
    const described = describeError(events.error);
    if (described.code === 'TOO_MANY_REQUESTS') {
      cooldown.start(described.retryAfterSeconds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.isError, events.error]);

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
      { replace: true }
    );
  };

  const { username } = useResolveUsername(accountId || null);

  const columns = [
    {
      key: 'createdAt',
      header: `when (${localZone()})`,
      width: '24%',
      nowrap: true,
      render: (row) => <LocalTime value={row.createdAt} showZone={false} />,
    },
    {
      key: 'eventType',
      header: 'event',
      width: '18%',
      nowrap: true,
      render: (row) => <EventTag type={row.eventType} />,
    },
    {
      key: 'userId',
      header: 'account',
      width: '22%',
      render: (row) => <AccountCell userId={row.userId} />,
    },
    {
      key: 'detail',
      header: 'detail',
      render: (row) => <EventDetail row={row} />,
    },
  ];

  const described = events.isError ? describeError(events.error) : null;
  const showingCooldown = cooldown.cooling;

  return (
    <div>
      <PageHeader title="activity log" />

      <PanelCard title="what to read">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={mono}>account</span>
            <AccountSearchPicker
              value={accountId ? { id: accountId, username } : null}
              onSelect={(account) => setParam('account', account?.id || '')}
              placeholder="one account, or leave empty for every account…"
              id="activity-account-picker"
            />
            <span style={hint}>
              leaving this empty reads across every account, which is a platform-wide view rather
              than an investigation of one person.
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={mono}>event type</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <LxTag size="sm" active={!eventType} onClick={() => setParam('type', '')}>
                all
              </LxTag>
              {WRITTEN_EVENT_TYPES.map((type) => (
                <span key={type.key} title={type.hint}>
                  <LxTag
                    size="sm"
                    active={eventType === type.key}
                    onClick={() => setParam('type', type.key)}
                  >
                    {type.label}
                  </LxTag>
                </span>
              ))}
            </div>
            <span style={hint}>
              these are the {WRITTEN_EVENT_TYPES.length} kinds of event the application writes. the
              underlying enumeration declares twenty; the rest have no writer, so they are not
              offered as filters that could never match. an unfiltered page still shows whatever
              type a row carries.
            </span>
          </div>

          <div style={{ height: 1, background: v.borderSubtle }} />

          <DateRangeControl
            value={range}
            maxDays={MAX_WINDOW_DAYS}
            onCommit={setRange}
            disabled={showingCooldown}
            disabledReason={
              showingCooldown
                ? `the server refused the last request for exceeding its rate limit. this control is held for ${cooldown.remaining} more second${
                    cooldown.remaining === 1 ? '' : 's'
                  }, the delay the server asked for. nothing is being retried in the background.`
                : null
            }
          />
        </div>
      </PanelCard>

      <PanelCard title="events" padded={false}>
        {showingCooldown ? (
          <EmptyState
            icon="clock"
            title="held back by the server's rate limit"
            hint={`the activity log allows a limited number of reads a minute and the last request was refused. the controls return in ${cooldown.remaining} second${
              cooldown.remaining === 1 ? '' : 's'
            }. nothing is being retried in the background.`}
          />
        ) : !events.enabled ? (
          <EmptyState
            icon="clock"
            title="choose a window to read"
            hint={`this log has no unbounded read: the event table is partitioned by time, so both ends of the window are required and a window may span at most ${MAX_WINDOW_DAYS} days. nothing has been requested yet.`}
          />
        ) : (
          <RecordTable
            columns={columns}
            rows={events.rows}
            isLoading={events.isLoading}
            isError={events.isError}
            errorMessage={described?.message}
            onRetry={() => events.refetch()}
            emptyIcon="check"
            emptyTitle="no recorded activity in this window"
            emptyHint={`nothing was recorded here, which is the ordinary case: only ${WRITTEN_EVENT_TYPES.length} kinds of event are written, and a quiet window is a quiet window rather than a fault. widen the range or clear the event filter to look further.`}
            footer={
              <LoadMore
                hasNextPage={events.hasNextPage}
                isFetchingNextPage={events.isFetchingNextPage}
                onLoadMore={() => events.fetchNextPage()}
              />
            }
          />
        )}
      </PanelCard>
    </div>
  );
}

const mono = {
  fontFamily: v.fontMono,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: v.ink2,
};

const hint = { fontFamily: v.fontBody, fontSize: 12, color: v.ink2 };

function EventTag({ type }) {
  const known = WRITTEN_EVENT_TYPES.find((entry) => entry.key === type);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: v.fontBody,
        fontSize: 12,
        color: v.ink2,
      }}
    >
      <LxIcon
        name={type === 'search' ? 'explore' : type === 'profile_view' ? 'eye' : 'logout'}
        size={12}
        color={v.ink2}
      />
      {known?.label ?? String(type ?? '').replace(/_/g, ' ')}
    </span>
  );
}

/**
 * A row carries a raw account id and no name, so the name is resolved one id at
 * a time and cached. Until it resolves the short id is shown, which is honest
 * and stable, rather than a placeholder that looks like a name.
 */
function AccountCell({ userId }) {
  const { username } = useResolveUsername(userId);
  if (!userId) {
    return <span style={{ color: v.ink2 }}>-</span>;
  }
  return (
    <Link
      to={routeTo.adminUser(userId)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        color: v.ink2,
        textDecoration: 'none',
      }}
    >
      <span style={username ? undefined : { fontFamily: v.fontMono, fontSize: 12 }}>
        {username ? `@${username}` : shortId(userId)}
      </span>
      <LxIcon name="chevronRight" size={12} color={v.ink2} />
    </Link>
  );
}

/**
 * The detail column renders exactly what the row carries and nothing it does
 * not. A search carries its term and the surface it ran against; a profile view
 * carries the account that was viewed; a session start carries neither, and says
 * so rather than showing an empty cell that reads as missing data.
 */
function EventDetail({ row }) {
  if (row.eventType === 'search') {
    const scope = row.metadata?.scope;
    const query = row.metadata?.query;
    if (!query && !scope) {
      return <Muted>no term recorded</Muted>;
    }
    return (
      <span style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink2 }}>
        searched{' '}
        <span style={{ fontFamily: v.fontMono, color: v.ink }}>
          {query ? `"${query}"` : 'an unrecorded term'}
        </span>
        {scope ? <span style={{ color: v.ink2 }}> in {scope}</span> : null}
      </span>
    );
  }

  if (row.eventType === 'profile_view') {
    if (!row.entityId) {
      return <Muted>no account recorded</Muted>;
    }
    return (
      <span style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink2 }}>
        viewed <AccountCell userId={row.entityId} />
      </span>
    );
  }

  if (row.eventType === 'session_start') {
    return <Muted>a session was issued; the record carries no further detail</Muted>;
  }

  return (
    <Muted>
      {row.entityType && row.entityId
        ? `${row.entityType} ${shortId(row.entityId)}`
        : 'no further detail recorded'}
    </Muted>
  );
}

const Muted = ({ children }) => (
  <span style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink2 }}>{children}</span>
);
